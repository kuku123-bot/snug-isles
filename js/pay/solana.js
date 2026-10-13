// Just enough Solana to take a USDC payment, without any wallet library: addresses, the token account of a wallet, the payment transaction,
// asking the blockchain about it, and checking that a purchase really happened. Pure (Node + browser; needs crypto.subtle for SHA-256).
//
// How a purchase works: the buyer's wallet sends USDC to the owner's token account in one small transaction. Every purchase carries a
// "reference" (a made-up account that is only ever used by this buyer for this item, the Solana Pay way), so the game can find the payment
// again later, on any device, with one question to the blockchain. That also makes "Restore purchases" possible without any server.
import { b58encode, pubkeyBytes } from './base58.js';
import { MERCHANT, USDC_MINT, USDC_DECIMALS, SKU_BY_ID, microUsdc, RPC_URLS } from '../data/store.js';

export const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
export const ATA_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
export const SYSTEM_PROGRAM = '11111111111111111111111111111111';
export const MEMO_PROGRAM = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

const enc = new TextEncoder();
const subtle = () => globalThis.crypto.subtle;
export const sha256 = async (bytes) => new Uint8Array(await subtle().digest('SHA-256', bytes));
const concat = (...arrs) => { const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0)); let o = 0; for (const a of arrs) { out.set(a, o); o += a.length; } return out; };

// ------------------------------------------------------------------ addresses
const P = 2n ** 255n - 19n;
const mod = (a) => ((a % P) + P) % P;
function pow(base, exp) { let r = 1n, b = mod(base), e = exp; while (e > 0n) { if (e & 1n) r = (r * b) % P; b = (b * b) % P; e >>= 1n; } return r; }
const inv = (a) => pow(a, P - 2n);
const D = mod(-121665n * inv(121666n));

/** is this 32-byte value a point on the ed25519 curve (then it can belong to a wallet that has a private key; token accounts must NOT be) */
export function isOnCurve(bytes) {
  let y = 0n;
  for (let i = 31; i >= 0; i--) y = (y << 8n) | BigInt(i === 31 ? bytes[i] & 0x7f : bytes[i]);
  y = mod(y);
  const y2 = (y * y) % P, u = mod(y2 - 1n), v = mod(D * y2 + 1n);
  if (v === 0n) return false;
  const x2 = mod(u * inv(v));
  return x2 === 0n || pow(x2, (P - 1n) / 2n) === 1n;
}

/** a program-derived address: the address a program (not a person) controls, from seeds */
export async function findProgramAddress(seeds, programId) {
  const prog = pubkeyBytes(programId);
  for (let bump = 255; bump >= 0; bump--) {
    const hash = await sha256(concat(...seeds, Uint8Array.of(bump), prog, enc.encode('ProgramDerivedAddress')));
    if (!isOnCurve(hash)) return { address: b58encode(hash), bump };
  }
  throw new Error('no program address found');
}

/** the USDC account of a wallet (its associated token account) */
export async function usdcAccountOf(owner) {
  return (await findProgramAddress([pubkeyBytes(owner), pubkeyBytes(TOKEN_PROGRAM), pubkeyBytes(USDC_MINT)], ATA_PROGRAM)).address;
}

/** the reference of one buyer's purchase of one item: the same every time, so the payment can always be found again */
export async function referenceOf(buyer, sku) {
  return b58encode(await sha256(enc.encode(`snug-isles/v1/${buyer}/${sku}`)));
}

// ------------------------------------------------------------------ the payment transaction
function compact(n) { const out = []; let v = n; for (;;) { let b = v & 0x7f; v >>= 7; if (v) { out.push(b | 0x80); } else { out.push(b); break; } } return out; }
const u64le = (n) => { const out = new Uint8Array(8); let v = BigInt(n); for (let i = 0; i < 8; i++) { out[i] = Number(v & 255n); v >>= 8n; } return out; };

/**
 * Compile instructions into an unsigned legacy transaction (one empty signature slot for the buyer, who pays the tiny network fee).
 * instructions: [{ program, keys: [{ pubkey, signer, writable }], data: Uint8Array }]
 */
export function compileTransaction(feePayer, instructions, blockhash) {
  const meta = new Map(); // address -> { signer, writable }
  const touch = (pubkey, signer, writable) => { const m = meta.get(pubkey) || { signer: false, writable: false }; m.signer ||= signer; m.writable ||= writable; meta.set(pubkey, m); };
  touch(feePayer, true, true);
  for (const ix of instructions) { for (const k of ix.keys) touch(k.pubkey, !!k.signer, !!k.writable); touch(ix.program, false, false); }
  const all = [...meta.entries()], group = (s, w) => all.filter(([, m]) => m.signer === s && m.writable === w).map(([k]) => k);
  const sw = group(true, true), sr = group(true, false), nw = group(false, true), nr = group(false, false);
  const ordered = [feePayer, ...sw.filter((k) => k !== feePayer), ...sr, ...nw, ...nr];
  const index = new Map(ordered.map((k, i) => [k, i]));
  const bytes = [sw.length + sr.length, sr.length, nr.length, ...compact(ordered.length)];
  const chunks = [Uint8Array.from(bytes)];
  for (const k of ordered) chunks.push(pubkeyBytes(k));
  chunks.push(pubkeyBytes(blockhash));
  const ixBytes = [...compact(instructions.length)];
  chunks.push(Uint8Array.from(ixBytes));
  for (const ix of instructions) chunks.push(Uint8Array.from([index.get(ix.program), ...compact(ix.keys.length), ...ix.keys.map((k) => index.get(k.pubkey)), ...compact(ix.data.length)]), ix.data);
  const message = concat(...chunks);
  const nsig = sw.length + sr.length;
  return concat(Uint8Array.from(compact(nsig)), new Uint8Array(64 * nsig), message);
}

/**
 * The purchase: [create the owner's USDC account if it does not exist yet (the buyer pays its small deposit)] + [send the USDC, naming the
 * reference] + [a short note that shows in explorers]. Nothing else can happen in it.
 * opts: { buyer, sku, blockhash, createOwnerAccount }
 */
export async function buildPurchase({ buyer, sku, blockhash, createOwnerAccount }) {
  const item = SKU_BY_ID[sku];
  if (!item) throw new Error('Unknown item');
  const [buyerAta, merchantAta, reference] = await Promise.all([usdcAccountOf(buyer), usdcAccountOf(MERCHANT), referenceOf(buyer, sku)]);
  const ixs = [];
  if (createOwnerAccount) {
    ixs.push({ program: ATA_PROGRAM, data: Uint8Array.of(1), keys: [
      { pubkey: buyer, signer: true, writable: true }, { pubkey: merchantAta, writable: true }, { pubkey: MERCHANT }, { pubkey: USDC_MINT }, { pubkey: SYSTEM_PROGRAM }, { pubkey: TOKEN_PROGRAM },
    ] }); // "create it if it is not there" (instruction 1)
  }
  ixs.push({ program: TOKEN_PROGRAM, data: concat(Uint8Array.of(12), u64le(microUsdc(item.price)), Uint8Array.of(USDC_DECIMALS)), keys: [ // TransferChecked
    { pubkey: buyerAta, writable: true }, { pubkey: USDC_MINT }, { pubkey: merchantAta, writable: true }, { pubkey: buyer, signer: true }, { pubkey: reference },
  ] });
  ixs.push({ program: MEMO_PROGRAM, data: enc.encode(`Snug Isles: ${item.name}`), keys: [] });
  return { tx: compileTransaction(buyer, ixs, blockhash), buyerAta, merchantAta, reference, price: item.price };
}

// ------------------------------------------------------------------ asking the blockchain
/** a tiny JSON-RPC client that tries one server after another until one answers */
export class Rpc {
  constructor(urls = RPC_URLS, fetchFn) { this.urls = urls; this.fetch = fetchFn || ((...a) => globalThis.fetch(...a)); this.n = 0; }
  async call(method, params = []) {
    let last = null;
    for (let round = 0; round < 2; round++) {
      for (let i = 0; i < this.urls.length; i++) {
        const url = this.urls[(this.n + i) % this.urls.length];
        try {
          const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null, to = ctl && setTimeout(() => ctl.abort(), 12000);
          const res = await this.fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: ctl ? ctl.signal : undefined });
          if (to) clearTimeout(to);
          if (!res.ok) throw new Error('HTTP ' + res.status);
          const j = await res.json();
          if (j.error) { const e = new Error(j.error.message || 'RPC error'); e.rpc = j.error; if (j.error.code === 429 || /rate|limit|forbidden|not available|plan|key/i.test(j.error.message || '')) { last = e; continue; } throw e; }
          this.n = (this.n + i) % this.urls.length; // stay with the one that works
          return j.result;
        } catch (e) { if (e && e.rpc) throw e; last = e; }
      }
    }
    throw last || new Error('Could not reach the Solana network');
  }
}

/** USDC the wallet holds (in micro-USDC) and its SOL (lamports) for the network fee; no USDC account means no USDC */
export async function balancesOf(rpc, owner) {
  const ata = await usdcAccountOf(owner);
  const [sol, usdc] = await Promise.all([
    rpc.call('getBalance', [owner, { commitment: 'confirmed' }]).then((r) => r.value),
    // (the free servers refuse the special token-balance question, but answer the plain "show me this account" one)
    rpc.call('getAccountInfo', [ata, { encoding: 'jsonParsed', commitment: 'confirmed' }]).then((r) => {
      const parsed = r && r.value && r.value.data && r.value.data.parsed;
      return parsed && parsed.info && parsed.info.tokenAmount ? BigInt(parsed.info.tokenAmount.amount) : 0n;
    }),
  ]);
  return { sol, usdc };
}
/** does the owner's USDC account already exist (if not, the first buyer's transaction creates it) */
export async function merchantAccountExists(rpc) {
  const r = await rpc.call('getAccountInfo', [await usdcAccountOf(MERCHANT), { encoding: 'base64', commitment: 'confirmed' }]);
  return !!(r && r.value);
}

/**
 * Did this buyer really pay for this item? Looks at the payments that name the buyer's reference for the item and accepts one that
 * succeeded and moved at least the price in USDC from the buyer to the owner. Returns the transaction's signature, or null.
 */
export async function findPayment(rpc, buyer, sku) {
  const item = SKU_BY_ID[sku];
  if (!item) return null;
  const [reference, merchantAta] = await Promise.all([referenceOf(buyer, sku), usdcAccountOf(MERCHANT)]);
  const sigs = await rpc.call('getSignaturesForAddress', [reference, { limit: 10, commitment: 'confirmed' }]);
  for (const s of sigs || []) {
    if (s.err) continue;
    const tx = await rpc.call('getTransaction', [s.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }]);
    if (tx && isPayment(tx, { buyer, merchantAta, price: item.price })) return s.signature;
  }
  return null;
}

/** pure check of one parsed transaction: succeeded, and a USDC "transfer checked" from the buyer to the owner's account of at least the price */
export function isPayment(tx, { buyer, merchantAta, price }) {
  if (!tx || !tx.meta || tx.meta.err) return false;
  const want = microUsdc(price);
  const ixs = (tx.transaction && tx.transaction.message && tx.transaction.message.instructions) || [];
  for (const ix of ixs) {
    const p = ix.parsed;
    if (ix.program !== 'spl-token' || !p || p.type !== 'transferChecked') continue;
    const i = p.info || {};
    if (i.mint !== USDC_MINT || i.destination !== merchantAta || i.authority !== buyer) continue;
    let amount; try { amount = BigInt(i.tokenAmount && i.tokenAmount.amount); } catch (e) { continue; }
    if (amount >= want) return true;
  }
  return false;
}

/** wait (a while) for a payment that was just sent to show up */
export async function waitForPayment(rpc, buyer, sku, { tries = 40, every = 2000, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  for (let i = 0; i < tries; i++) {
    try { const sig = await findPayment(rpc, buyer, sku); if (sig) return sig; } catch (e) { /* the servers are busy: try again */ }
    await sleep(every);
  }
  return null;
}

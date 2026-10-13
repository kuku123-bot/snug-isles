// The Supporter Shop: addresses, the payment transaction (it can only pay the owner's USDC account), finding payments, the wallet handshake, what is worn.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { b58encode, b58decode, pubkeyBytes } from '../js/pay/base58.js';
import { MERCHANT, USDC_MINT, SKUS, SKU_BY_ID, COS, COS_ALL, microUsdc, maskOf, formatUsd, RPC_URLS, CLUSTER } from '../js/data/store.js';
import { isOnCurve, usdcAccountOf, referenceOf, buildPurchase, compileTransaction, isPayment, findPayment, Rpc, balancesOf, TOKEN_PROGRAM, ATA_PROGRAM, MEMO_PROGRAM, SYSTEM_PROGRAM } from '../js/pay/solana.js';
import { purchase, restoreAll, PayError } from '../js/pay/purchase.js';
import { friendlyError } from '../js/pay/wallets.js';
import { makeSim, step } from './helpers.js';
import { applyState, buildStateMsg } from '../js/net/protocol.js';

const BUYER = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'; // any real wallet address
const BLOCKHASH = 'FnfXymbDhHCYFLWRqJ5k88956ULSFKei1srbNPzYNDW'; // a 32-byte value in base58 is all the format needs
const MERCHANT_ATA = '6iVkAXjUrDiZGHw39wTrL4yjJ5BY3eEpo3UXBajuffrq'; // checked against the real blockchain: owned by MERCHANT, mint USDC

test('addresses: base58 round trips, the owner wallet, the USDC mint and the programs are real 32-byte addresses', () => {
  for (const a of [MERCHANT, USDC_MINT, TOKEN_PROGRAM, ATA_PROGRAM, SYSTEM_PROGRAM, MEMO_PROGRAM, BUYER]) { assert.equal(pubkeyBytes(a).length, 32, a); assert.equal(b58encode(b58decode(a)), a); }
  assert.throws(() => pubkeyBytes('0OIl'), /valid/i);
  assert.throws(() => pubkeyBytes('abc'), /valid/i);
  assert.equal(MERCHANT, '3uPkK4Xa6554PHtiPiob2EbGo6PX1nk3oA3r93nAQkni', 'the receiving wallet is exactly the one the owner gave');
  assert.equal(USDC_MINT, 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 'native USDC on Solana (Circle)');
});

test('the receiving wallet appears, spelled exactly the same, on the Terms page (people can compare it with the payment screen)', () => {
  assert.ok(fs.readFileSync(new URL('../static/terms.html', import.meta.url), 'utf8').includes(MERCHANT));
});

test('token accounts: a wallet is on the curve, its USDC account is not, and it is the very account the blockchain has for the owner', async () => {
  assert.equal(isOnCurve(pubkeyBytes(MERCHANT)), true);
  const ata = await usdcAccountOf(MERCHANT);
  assert.equal(ata, MERCHANT_ATA);
  assert.equal(isOnCurve(pubkeyBytes(ata)), false, 'a token account has no private key');
  assert.notEqual(await usdcAccountOf(BUYER), ata);
});

test('references: always the same for the same buyer and item, different for everything else', async () => {
  const a = await referenceOf(BUYER, 'crown');
  assert.equal(a, await referenceOf(BUYER, 'crown'));
  assert.notEqual(a, await referenceOf(BUYER, 'badge'));
  assert.notEqual(a, await referenceOf(MERCHANT, 'crown'));
  assert.equal(pubkeyBytes(a).length, 32);
});

// a small reader of the transaction format, to look inside what we built
function readTx(bytes) {
  let o = 0;
  const compact = () => { let n = 0, shift = 0; for (;;) { const b = bytes[o++]; n |= (b & 0x7f) << shift; if (!(b & 0x80)) return n; shift += 7; } };
  const nsig = compact(); const sigs = []; for (let i = 0; i < nsig; i++) { sigs.push(bytes.slice(o, o + 64)); o += 64; }
  const header = [bytes[o++], bytes[o++], bytes[o++]];
  const nkeys = compact(); const keys = []; for (let i = 0; i < nkeys; i++) { keys.push(b58encode(bytes.slice(o, o + 32))); o += 32; }
  const blockhash = b58encode(bytes.slice(o, o + 32)); o += 32;
  const nix = compact(); const ixs = [];
  for (let i = 0; i < nix; i++) { const prog = keys[bytes[o++]]; const na = compact(); const accs = []; for (let j = 0; j < na; j++) accs.push(keys[bytes[o++]]); const nd = compact(); const data = bytes.slice(o, o + nd); o += nd; ixs.push({ prog, accs, data }); }
  assert.equal(o, bytes.length, 'the whole transaction was understood');
  return { sigs, header, keys, blockhash, ixs };
}
const u64 = (d, at) => { let v = 0n; for (let i = 7; i >= 0; i--) v = (v << 8n) | BigInt(d[at + i]); return v; };

test('the payment transaction can only send the price in USDC to the owner (nothing else can move)', async () => {
  for (const item of SKUS) for (const createOwnerAccount of [false, true]) {
    const { tx, merchantAta, buyerAta, reference } = await buildPurchase({ buyer: BUYER, sku: item.id, blockhash: BLOCKHASH, createOwnerAccount });
    const t = readTx(tx);
    assert.equal(t.sigs.length, 1); assert.ok(t.sigs[0].every((b) => b === 0), 'unsigned: the wallet signs it');
    assert.equal(t.keys[0], BUYER, 'the buyer pays the fee');
    assert.equal(t.blockhash, BLOCKHASH);
    assert.deepEqual(t.header.slice(0, 1), [1], 'one signer');
    // only these programs, no plain SOL transfer
    const progs = new Set(t.ixs.map((i) => i.prog));
    for (const p of progs) assert.ok([TOKEN_PROGRAM, ATA_PROGRAM, MEMO_PROGRAM].includes(p), 'unexpected program ' + p);
    assert.ok(!progs.has(SYSTEM_PROGRAM));
    // the one transfer: the exact price, to the owner's USDC account, signed by the buyer
    const transfers = t.ixs.filter((i) => i.prog === TOKEN_PROGRAM);
    assert.equal(transfers.length, 1);
    const tr = transfers[0];
    assert.equal(tr.data[0], 12, 'transfer-checked'); assert.equal(u64(tr.data, 1), microUsdc(item.price)); assert.equal(tr.data[9], 6, 'USDC has 6 decimals');
    assert.deepEqual(tr.accs, [buyerAta, USDC_MINT, merchantAta, BUYER, reference]);
    assert.equal(merchantAta, MERCHANT_ATA);
    // the optional "open the account" step only ever opens the owner's account, paid by the buyer
    const opens = t.ixs.filter((i) => i.prog === ATA_PROGRAM);
    assert.equal(opens.length, createOwnerAccount ? 1 : 0);
    if (createOwnerAccount) { assert.deepEqual(opens[0].accs, [BUYER, MERCHANT_ATA, MERCHANT, USDC_MINT, SYSTEM_PROGRAM, TOKEN_PROGRAM]); assert.deepEqual([...opens[0].data], [1]); }
    // only the buyer and the two token accounts can change
    const writable = t.keys.filter((k, i) => i < t.header[0] - t.header[1] || (i >= t.header[0] && i < t.keys.length - t.header[2]));
    assert.deepEqual(new Set(writable), new Set([BUYER, buyerAta, MERCHANT_ATA]), `${item.id}: writable accounts`);
  }
});

test('a price table that makes sense: whole cents, the pack is cheaper than its parts, micro-USDC conversion is exact', () => {
  for (const s of SKUS) { assert.ok(Number.isInteger(s.price) && s.price >= 50, s.id); assert.ok(s.grants.length >= 1 && s.grants.every((g) => g in COS)); }
  const singles = SKUS.filter((s) => s.grants.length === 1).reduce((a, s) => a + s.price, 0);
  assert.ok(SKU_BY_ID.pack.price < singles, 'the pack is a saving');
  assert.equal(microUsdc(250), 2_500_000n); assert.equal(formatUsd(250), '$2.50');
  assert.equal(maskOf(['pack']), COS_ALL); assert.equal(maskOf(['badge', 'crown']), COS.badge | COS.crown); assert.equal(maskOf(['nope']), 0);
});

// ------------------------------------------------------------------ finding payments
const tokenIx = (o = {}) => ({ program: 'spl-token', parsed: { type: 'transferChecked', info: { authority: BUYER, destination: MERCHANT_ATA, mint: USDC_MINT, source: 'SRC', tokenAmount: { amount: String(microUsdc(SKU_BY_ID.crown.price)), decimals: 6 }, ...o } } });
const parsedTx = (ix = tokenIx(), err = null) => ({ meta: { err }, transaction: { message: { instructions: [ix] } } });
const ctx = { buyer: BUYER, merchantAta: MERCHANT_ATA, price: SKU_BY_ID.crown.price };

test('isPayment accepts a real payment of at least the price and rejects everything else', () => {
  assert.equal(isPayment(parsedTx(), ctx), true);
  assert.equal(isPayment(parsedTx(tokenIx({ tokenAmount: { amount: String(microUsdc(SKU_BY_ID.crown.price) + 5n), decimals: 6 } })), ctx), true, 'more is fine');
  assert.equal(isPayment(parsedTx(tokenIx({ tokenAmount: { amount: String(microUsdc(SKU_BY_ID.crown.price) - 1n), decimals: 6 } })), ctx), false, 'a bit short');
  assert.equal(isPayment(parsedTx(tokenIx({ mint: 'So11111111111111111111111111111111111111112' })), ctx), false, 'another token');
  assert.equal(isPayment(parsedTx(tokenIx({ destination: 'SomebodyElse' })), ctx), false, 'paid to somebody else');
  assert.equal(isPayment(parsedTx(tokenIx({ authority: MERCHANT })), ctx), false, 'paid by somebody else');
  assert.equal(isPayment(parsedTx(tokenIx(), { InstructionError: [0, 'x'] }), ctx), false, 'failed on the chain');
  assert.equal(isPayment(parsedTx({ program: 'system', parsed: { type: 'transfer', info: {} } }), ctx), false);
  assert.equal(isPayment(null, ctx), false);
  assert.equal(isPayment({ meta: {}, transaction: {} }, ctx), false);
});

function mockRpc(handlers) { return { calls: [], async call(method, params) { this.calls.push(method); const h = handlers[method]; if (!h) throw new Error('unexpected ' + method); return typeof h === 'function' ? h(params) : h; } }; }

test('findPayment: finds the payment by the reference, skips failed ones, says null when there is none', async () => {
  const ref = await referenceOf(BUYER, 'crown');
  const rpc = mockRpc({
    getSignaturesForAddress: (p) => { assert.equal(p[0], ref); return [{ signature: 'FAILED', err: {} }, { signature: 'WRONG' }, { signature: 'GOOD' }]; },
    getTransaction: (p) => (p[0] === 'GOOD' ? parsedTx() : parsedTx(tokenIx({ tokenAmount: { amount: '1', decimals: 6 } }))),
  });
  assert.equal(await findPayment(rpc, BUYER, 'crown'), 'GOOD');
  assert.ok(!rpc.calls.includes('x'));
  assert.equal(await findPayment(mockRpc({ getSignaturesForAddress: [] }), BUYER, 'crown'), null);
  assert.equal(await findPayment(mockRpc({}), BUYER, 'unknown-item'), null);
});

test('Rpc: tries the next server when one is busy or refuses, and sticks with the one that works', async () => {
  const seen = [];
  const fetchFn = async (url) => {
    seen.push(url);
    if (url.includes('busy')) return { ok: true, json: async () => ({ error: { code: 429, message: 'Too many requests' } }) };
    if (url.includes('down')) return { ok: false, status: 403, json: async () => ({}) };
    return { ok: true, json: async () => ({ result: 42 }) };
  };
  const rpc = new Rpc(['https://busy.example', 'https://down.example', 'https://good.example'], fetchFn);
  assert.equal(await rpc.call('x'), 42);
  seen.length = 0; assert.equal(await rpc.call('y'), 42);
  assert.deepEqual(seen, ['https://good.example'], 'the working server is tried first next time');
  const bad = new Rpc(['https://one.example'], async () => ({ ok: true, json: async () => ({ error: { code: -32602, message: 'Invalid param' } }) }));
  await assert.rejects(() => bad.call('z'), /Invalid param/);
  const none = new Rpc(['https://one.example'], async () => { throw new Error('offline'); });
  await assert.rejects(() => none.call('z'), /offline/);
  assert.ok(RPC_URLS.length >= 2 && RPC_URLS.every((u) => u.startsWith('https://')));
});

test('balancesOf reads SOL and USDC with plain account lookups (the free servers refuse the special token calls)', async () => {
  const rpc = mockRpc({ getBalance: { value: 123456 }, getAccountInfo: { value: { data: { parsed: { info: { tokenAmount: { amount: '2500000' } } } } } } });
  assert.deepEqual(await balancesOf(rpc, BUYER), { sol: 123456, usdc: 2_500_000n });
  assert.ok(!rpc.calls.includes('getTokenAccountBalance') && !rpc.calls.includes('getTokenAccountsByOwner'));
  const none = mockRpc({ getBalance: { value: 5 }, getAccountInfo: { value: null } });
  assert.equal((await balancesOf(none, BUYER)).usdc, 0n);
});

// ------------------------------------------------------------------ the purchase
const fakeWallet = (paid) => ({ name: 'Fake', features: { 'solana:signAndSendTransaction': { async signAndSendTransaction(i) { paid.push(i); return [{ signature: new Uint8Array(64).fill(7) }]; } } } });
const account = { address: BUYER, publicKey: pubkeyBytes(BUYER) };
function purchaseRpc({ usdc = 5_000_000n, sol = 50_000_000, merchantOpen = true, paidAfterSend = true } = {}) {
  const state = { sent: false };
  const rpc = mockRpc({
    getSignaturesForAddress: () => (state.sent && paidAfterSend ? [{ signature: 'SIG' }] : []),
    getTransaction: () => parsedTx(tokenIx({ tokenAmount: { amount: String(microUsdc(SKU_BY_ID.crown.price)), decimals: 6 } })),
    getBalance: { value: sol },
    getAccountInfo: (p) => (p[0] === MERCHANT_ATA ? { value: merchantOpen ? { data: ['', 'base64'] } : null } : { value: { data: { parsed: { info: { tokenAmount: { amount: String(usdc) } } } } } }),
    getLatestBlockhash: { value: { blockhash: BLOCKHASH } },
  });
  rpc.markSent = () => { state.sent = true; };
  return rpc;
}

test('purchase: checks first, shows the wallet exactly our transaction, and waits for the payment to appear', async () => {
  const paid = [], rpc = purchaseRpc(), steps = [];
  const w = fakeWallet(paid); const orig = w.features['solana:signAndSendTransaction'].signAndSendTransaction; w.features['solana:signAndSendTransaction'].signAndSendTransaction = async (i) => { rpc.markSent(); return orig(i); };
  const r = await purchase({ wallet: w, account, sku: 'crown', rpc, onStep: (s) => steps.push(s), wait: { tries: 3, every: 1, sleep: async () => {} } });
  assert.deepEqual(r, { sig: 'SIG', already: false });
  assert.deepEqual(steps, ['check', 'sign', 'confirm']);
  assert.equal(paid.length, 1);
  assert.equal(paid[0].chain, CLUSTER); assert.equal(paid[0].account, account);
  const built = (await buildPurchase({ buyer: BUYER, sku: 'crown', blockhash: BLOCKHASH, createOwnerAccount: false })).tx;
  assert.deepEqual([...paid[0].transaction], [...built], 'the wallet is shown exactly the payment we built');
});

test('purchase: opens the owner\'s account when it is missing (and asks for a little more SOL then)', async () => {
  const paid = [], rpc = purchaseRpc({ merchantOpen: false }), w = fakeWallet(paid), o = w.features['solana:signAndSendTransaction'].signAndSendTransaction;
  w.features['solana:signAndSendTransaction'].signAndSendTransaction = async (i) => { rpc.markSent(); return o(i); };
  await purchase({ wallet: w, account, sku: 'crown', rpc, wait: { tries: 2, every: 1, sleep: async () => {} } });
  assert.equal(readTx(paid[0].transaction).ixs.filter((i) => i.prog === ATA_PROGRAM).length, 1);
  await assert.rejects(() => purchase({ wallet: fakeWallet([]), account, sku: 'crown', rpc: purchaseRpc({ merchantOpen: false, sol: 1_000_000 }) }), (e) => e.code === 'no-sol');
});

test('purchase: refuses (before anything is sent) with no USDC or no SOL, and never charges twice', async () => {
  const paid = [];
  await assert.rejects(() => purchase({ wallet: fakeWallet(paid), account, sku: 'crown', rpc: purchaseRpc({ usdc: 1_000_000n }) }), (e) => e instanceof PayError && e.code === 'no-usdc' && /1\.00 USDC/.test(e.message));
  await assert.rejects(() => purchase({ wallet: fakeWallet(paid), account, sku: 'crown', rpc: purchaseRpc({ sol: 100 }) }), (e) => e.code === 'no-sol');
  await assert.rejects(() => purchase({ wallet: fakeWallet(paid), account, sku: 'nothing', rpc: purchaseRpc() }), (e) => e.code === 'unknown');
  assert.equal(paid.length, 0, 'nothing was sent');
  const rpc = purchaseRpc(); rpc.markSent();
  const r = await purchase({ wallet: fakeWallet(paid), account, sku: 'crown', rpc });
  assert.deepEqual(r, { sig: 'SIG', already: true }); assert.equal(paid.length, 0, 'already paid: no second payment');
});

test('purchase: a payment that does not show up in time says so kindly, and Restore finds it later', async () => {
  const rpc = purchaseRpc({ paidAfterSend: false }), w = fakeWallet([]);
  await assert.rejects(() => purchase({ wallet: w, account, sku: 'crown', rpc, wait: { tries: 2, every: 1, sleep: async () => {} } }), (e) => e.code === 'slow' && /Restore/.test(e.message));
  const found = await restoreAll({ buyer: BUYER, rpc: purchaseRpc().markSent === undefined ? rpc : (() => { const r = purchaseRpc(); r.markSent(); return r; })(), skus: ['crown', 'badge'] });
  assert.deepEqual(Object.keys(found).sort(), ['badge', 'crown']);
});

test('friendlyError turns wallet and network errors into plain sentences', () => {
  assert.match(friendlyError(Object.assign(new Error('User rejected the request.'), { code: 4001 })), /cancelled/);
  assert.match(friendlyError(new Error('Failed to fetch')), /reach the Solana network/);
  assert.match(friendlyError(new Error('Blockhash not found')), /try again/);
  assert.match(friendlyError(new PayError('no-usdc', 'Add some USDC')), /Add some USDC/);
});

// ------------------------------------------------------------------ the wallet handshake and what is worn
test('wallets: the game finds Wallet Standard wallets that can pay on Solana, in any order of loading', async () => {
  const listeners = {};
  globalThis.window = { addEventListener: (n, f) => { (listeners[n] = listeners[n] || []).push(f); }, dispatchEvent: (e) => { for (const f of listeners[e.type] || []) f(e); return true; } };
  const good = { name: 'Good', chains: ['solana:mainnet'], features: { 'standard:connect': { connect: async () => ({ accounts: [{ address: BUYER, chains: ['solana:mainnet'] }] }) }, 'solana:signAndSendTransaction': {} } };
  const noPay = { name: 'ConnectOnly', chains: ['solana:mainnet'], features: { 'standard:connect': {} } };
  const evm = { name: 'EvmOnly', chains: ['eip155:1'], features: { 'standard:connect': {}, 'solana:signAndSendTransaction': {} } };
  const { solanaWallets, connectWallet } = await import('../js/pay/wallets.js?t=' + Date.now());
  // a wallet that was ready before the game: it registers when the game announces itself
  window.addEventListener('wallet-standard:app-ready', (e) => e.detail.register(good, noPay, evm));
  const list = solanaWallets();
  assert.deepEqual(list.map((w) => w.name), ['Good']);
  // a wallet that loads later: it fires the register event with a callback
  const late = { name: 'Late', chains: ['solana:mainnet'], features: { 'standard:connect': {}, 'solana:signTransaction': {} } };
  const ev = Object.assign(new Event('wallet-standard:register-wallet'), {}); Object.defineProperty(ev, 'detail', { value: (api) => api.register(late) });
  window.dispatchEvent(ev);
  assert.deepEqual(solanaWallets().map((w) => w.name).sort(), ['Good', 'Late']);
  const c = await connectWallet(good);
  assert.equal(c.account.address, BUYER);
  delete globalThis.window;
});

test('owned and worn: an owned pack gives all four, hiding one hides only that one, bad storage is harmless', async () => {
  const store = {};
  globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  const o = await import('../js/pay/owned.js?t=' + Date.now());
  assert.equal(o.ownedMask(), 0); assert.equal(o.wornMask(), 0);
  o.addOwned('crown', 'SIG1', BUYER);
  assert.equal(o.wornMask(), COS.crown); assert.equal(o.ownsSku('crown'), true); assert.equal(o.ownsSku('badge'), false);
  o.addOwned('pack', 'SIG2', BUYER);
  assert.equal(o.wornMask(), COS_ALL);
  o.setWorn(COS.trail, false);
  assert.equal(o.wornMask(), COS_ALL & ~COS.trail);
  o.setWorn(COS.trail, true);
  assert.equal(o.wornMask(), COS_ALL);
  o.addOwned('made-up', 'x', 'y'); assert.equal(Object.keys(o.getOwned()).includes('made-up'), false, 'unknown items are ignored');
  store['snug.owned'] = '{broken'; assert.equal(o.ownedMask(), 0);
  globalThis.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(o.ownedMask(), 0); o.addOwned('badge', 's', 'b'); // no crash
  delete globalThis.localStorage;
});

test('cosmetics reach the partner: the cos command is limited to the four looks and travels in the state message', () => {
  const s = makeSim('classic', { enemyDensity: 0 }, 5);
  const a = s.addPlayer('a', 'Alice'), b = s.addPlayer('b', 'Bob');
  s.exec('a', { c: 'cos', m: COS.crown | COS.trail });
  assert.equal(a.cos, COS.crown | COS.trail);
  s.exec('a', { c: 'cos', m: 0xffff }); assert.equal(a.cos, COS_ALL, 'only the four known looks');
  s.exec('a', { c: 'cos', m: 'junk' }); assert.equal(a.cos, 0); s.exec('a', { c: 'cos', m: -1 }); assert.equal(a.cos, COS_ALL);
  s.exec('a', { c: 'cos', m: COS.badge });
  const msg = buildStateMsg(s, { pid: 'b' });
  const m = makeSim('classic', { enemyDensity: 0 }, 5).world;
  m.players.set('a', { pid: 'a', name: 'Alice', look: {}, x: 0, y: 0, online: true, sample: [] });
  m.players.set('b', { pid: 'b', name: 'Bob', look: {}, x: 0, y: 0, online: true });
  applyState(m, msg, 1000, 'b');
  assert.equal(m.players.get('a').cos, COS.badge, 'the partner sees the badge');
  assert.equal(b.cos | 0, 0);
});

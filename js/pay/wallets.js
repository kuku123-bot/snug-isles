// Talking to the player's wallet through the Wallet Standard, the common language of Phantom, MetaMask (its Solana support), Solflare, Backpack...
// No wallet library: the wallets announce themselves with two browser events and expose "features" we call. The game never sees a private key.
import { b58encode } from './base58.js';
import { CLUSTER } from '../data/store.js';

const found = [];
let started = false;
function start() {
  if (started || typeof window === 'undefined') return;
  started = true;
  const api = Object.freeze({ register: (...ws) => { for (const w of ws) if (!found.includes(w)) found.push(w); return () => { for (const w of ws) { const i = found.indexOf(w); if (i >= 0) found.splice(i, 1); } }; } });
  try { window.addEventListener('wallet-standard:register-wallet', (e) => { try { e.detail(api); } catch (err) { /* a broken wallet must not break the game */ } }); } catch (e) { /* ignore */ }
  try { const ev = new Event('wallet-standard:app-ready'); Object.defineProperty(ev, 'detail', { value: api }); window.dispatchEvent(ev); } catch (e) { /* ignore */ }
}

/** the Solana wallets in this browser that can connect and pay */
export function solanaWallets() {
  start();
  return found.filter((w) => {
    const f = w.features || {};
    const chains = w.chains || [];
    return f['standard:connect'] && (f['solana:signAndSendTransaction'] || f['solana:signTransaction']) && (!chains.length || chains.includes(CLUSTER));
  });
}

/** ask the wallet to connect; resolves to { wallet, account } with account.address the player's Solana address */
export async function connectWallet(wallet) {
  const res = await wallet.features['standard:connect'].connect();
  const accounts = (res && res.accounts) || wallet.accounts || [];
  const account = accounts.find((a) => !a.chains || a.chains.includes(CLUSTER)) || accounts[0];
  if (!account || !account.address) throw new Error('No account was shared from the wallet');
  return { wallet, account };
}

/** the wallet shows the payment and the player approves it there; resolves to the transaction's signature (a text) */
export async function signAndSend(wallet, account, txBytes, rpc) {
  const f = wallet.features;
  if (f['solana:signAndSendTransaction']) {
    const out = await f['solana:signAndSendTransaction'].signAndSendTransaction({ account, chain: CLUSTER, transaction: txBytes });
    const first = Array.isArray(out) ? out[0] : out;
    return b58encode(first.signature);
  }
  const out = await f['solana:signTransaction'].signTransaction({ account, chain: CLUSTER, transaction: txBytes });
  const signed = (Array.isArray(out) ? out[0] : out).signedTransaction;
  let bin = ''; for (const b of signed) bin += String.fromCharCode(b);
  return rpc.call('sendTransaction', [btoa(bin), { encoding: 'base64', preflightCommitment: 'confirmed' }]);
}

/** a friendly sentence for what went wrong */
export function friendlyError(e) {
  const m = String((e && (e.message || e.name)) || e || '');
  if (e && e.code === 'no-usdc') return e.message;
  if (e && e.code === 'no-sol') return e.message;
  if (/reject|denied|cancel|declin|4001|user closed/i.test(m) || (e && e.code === 4001)) return 'You cancelled it in your wallet. Nothing was paid.';
  if (/insufficient|0x1\b|custom program error: 0x1/i.test(m)) return 'The wallet says there is not enough USDC (or SOL for the tiny network fee).';
  if (/blockhash/i.test(m)) return 'That took too long and the network turned it down. Nothing was paid, please try again.';
  if (/fetch|network|HTTP|reach/i.test(m)) return 'Could not reach the Solana network just now. Nothing was paid, please try again in a moment.';
  return 'Something went wrong: ' + m.slice(0, 140);
}

// Buying one item: look before paying, build the payment, let the wallet ask the player, wait until the payment shows on the blockchain.
import { SKU_BY_ID, microUsdc, formatUsd } from '../data/store.js';
import { balancesOf, merchantAccountExists, buildPurchase, findPayment, waitForPayment } from './solana.js';
import { signAndSend } from './wallets.js';

export class PayError extends Error { constructor(code, message) { super(message); this.code = code; } }

const FEE_LAMPORTS = 20_000n;          // a few thousandths of a cent
const ACCOUNT_DEPOSIT = 2_100_000n;    // the small refundable deposit for opening the owner's USDC account, only if it does not exist yet

/**
 * Pays for `sku` with the connected wallet. Resolves to { sig, already } where sig is the payment's signature; already = it had been paid before
 * (nothing is charged twice). Throws PayError / wallet errors (use friendlyError).
 * wait: options for how long to wait for the payment to appear (tests make it quick).
 */
export async function purchase({ wallet, account, sku, rpc, onStep = () => {}, wait }) {
  const item = SKU_BY_ID[sku];
  if (!item) throw new PayError('unknown', 'That item does not exist.');
  const buyer = account.address;
  onStep('check');
  const before = await findPayment(rpc, buyer, sku).catch(() => null);
  if (before) return { sig: before, already: true };
  const [{ sol, usdc }, exists] = await Promise.all([balancesOf(rpc, buyer), merchantAccountExists(rpc)]);
  if (usdc < microUsdc(item.price)) throw new PayError('no-usdc', `Your wallet has ${(Number(usdc) / 1e6).toFixed(2)} USDC on Solana, and this costs ${formatUsd(item.price)}. Add some USDC (on the Solana network) and try again.`);
  if (BigInt(sol) < FEE_LAMPORTS + (exists ? 0n : ACCOUNT_DEPOSIT)) throw new PayError('no-sol', 'Your wallet needs a tiny bit of SOL for the network fee (a few cents of SOL is plenty).');
  const bh = (await rpc.call('getLatestBlockhash', [{ commitment: 'confirmed' }])).value.blockhash;
  const { tx } = await buildPurchase({ buyer, sku, blockhash: bh, createOwnerAccount: !exists });
  onStep('sign');
  await signAndSend(wallet, account, tx, rpc);
  onStep('confirm');
  const sig = await waitForPayment(rpc, buyer, sku, wait);
  if (!sig) throw new PayError('slow', 'The payment was sent, but the network is slow to confirm it. Wait a minute and press "Restore my purchases": if it went through, it will appear.');
  return { sig, already: false };
}

/** look for everything this wallet already paid for; resolves to { sku: signature } */
export async function restoreAll({ buyer, rpc, skus }) {
  const out = {};
  for (const sku of skus) { const sig = await findPayment(rpc, buyer, sku); if (sig) out[sku] = sig; }
  return out;
}

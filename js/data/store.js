// The Supporter Shop: what can be bought with USDC on Solana, and where the money goes. Pure data (Node + browser).
// SAFETY: MERCHANT is the one place the receiving wallet lives. Nothing (no link, no setting, no other player) can change it at run time.

export const MERCHANT = '3uPkK4Xa6554PHtiPiob2EbGo6PX1nk3oA3r93nAQkni';           // where every payment goes (the owner's Solana wallet)
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';           // native USDC on Solana, issued by Circle (developers.circle.com/stablecoins/usdc-contract-addresses)
export const USDC_DECIMALS = 6;
export const CLUSTER = 'solana:mainnet';

/**
 * Servers the game asks about the blockchain (to read balances, to find out that a payment happened). They are tried in this order.
 * The free public ones are slow and sometimes busy: put a free key from Helius, QuickNode or Alchemy FIRST in this list for a public launch.
 */
export const RPC_URLS = [
  'https://solana-rpc.publicnode.com',
  'https://api.mainnet-beta.solana.com',
  'https://solana.api.onfinality.io/public',
];

// cosmetic bits (what a player wears is sent to the other player as these)
export const COS = { badge: 1, goldname: 2, trail: 4, crown: 8 };
export const COS_ALL = 15;

/** price is in USDC cents (200 = $2.00). grants: what owning it gives. icon: a sprite name. */
export const SKUS = [
  { id: 'badge', name: 'Supporter Badge', price: 100, grants: ['badge'], icon: 'cos_badge', desc: 'A shiny golden star next to your name, for everyone to see. Thank you!' },
  { id: 'goldname', name: 'Golden Name', price: 200, grants: ['goldname'], icon: 'cos_name', desc: 'Your name glows golden above your head.' },
  { id: 'trail', name: 'Rainbow Trail', price: 300, grants: ['trail'], icon: 'cos_trail', desc: 'Sparkles in every color follow your steps.' },
  { id: 'crown', name: 'Royal Crown', price: 300, grants: ['crown'], icon: 'cos_crown', desc: 'A little golden crown for the ruler of the isles.' },
  { id: 'pack', name: 'Supporter Pack', price: 700, grants: ['badge', 'goldname', 'trail', 'crown'], icon: 'cos_pack', desc: 'All four: badge, golden name, rainbow trail and crown. The best way to say thanks.' },
];
export const SKU_BY_ID = Object.fromEntries(SKUS.map((s) => [s.id, s]));

/** price in micro-USDC (what the token transfer carries) */
export const microUsdc = (cents) => BigInt(cents) * 10n ** BigInt(USDC_DECIMALS - 2);
export const formatUsd = (cents) => `$${(cents / 100).toFixed(2)}`;

/** the cosmetics (as bit mask) an owned set of skus gives */
export function maskOf(skuIds) {
  let m = 0;
  for (const id of skuIds) { const s = SKU_BY_ID[id]; if (s) for (const g of s.grants) m |= COS[g] || 0; }
  return m;
}

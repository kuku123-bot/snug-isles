// The Supporter Shop: optional cosmetics paid for with USDC on Solana (Phantom, MetaMask or another Solana wallet). They never change how the game plays.
import { h, ic, clear } from '../dom.js';
import { SKUS, SKU_BY_ID, MERCHANT, COS, formatUsd } from '../../data/store.js';
import { Rpc } from '../../pay/solana.js';
import { solanaWallets, connectWallet, friendlyError } from '../../pay/wallets.js';
import { purchase, restoreAll } from '../../pay/purchase.js';
import { getOwned, addOwned, ownsSku, wornMask, setWorn } from '../../pay/owned.js';

let conn = null; // the connected wallet { wallet, account } (kept while the game runs, so reopening the shop does not ask again)
const short = (a) => `${a.slice(0, 4)}…${a.slice(-4)}`;
const COS_NAMES = { badge: 'Badge', goldname: 'Golden name', trail: 'Rainbow trail', crown: 'Crown' };

export function supporterPanel(g, data, ui) {
  let sel = 'pack', confirming = false, busy = false, status = '', bad = false;
  const body = h('div', { class: 'col supp', style: 'gap:10px;min-width:min(88vw,500px);max-height:70vh;overflow:auto' });
  const rpc = new Rpc();
  const say = (t, isBad = false) => { status = t; bad = isBad; render(); };

  async function doConnect(wallet) {
    try { say(`Opening ${wallet.name}…`); conn = await connectWallet(wallet); say(''); } catch (e) { conn = null; say(friendlyError(e), true); }
  }
  async function doBuy(sku) {
    if (busy) return;
    busy = true; confirming = false;
    try {
      const r = await purchase({ wallet: conn.wallet, account: conn.account, sku, rpc, onStep: (s) => say(s === 'check' ? 'Checking your wallet…' : s === 'sign' ? `Open ${conn.wallet.name} and approve the payment…` : 'Payment sent! Waiting for the network to confirm it (about 15 seconds)…') });
      addOwned(sku, r.sig, conn.account.address);
      g.announceCosmetics();
      g.audio.play('levelup');
      g.toast(r.already ? 'You already owned this: restored!' : 'Thank you so much! It is yours.', 'good');
      status = r.already ? 'You already owned this, so nothing was charged.' : 'Thank you so much! It is yours.'; bad = false;
    } catch (e) { status = friendlyError(e); bad = true; }
    busy = false; render();
  }
  async function doRestore() {
    if (busy) return;
    busy = true; say('Looking for your purchases on the blockchain…');
    try {
      const found = await restoreAll({ buyer: conn.account.address, rpc, skus: SKUS.map((s) => s.id) });
      for (const sku in found) addOwned(sku, found[sku], conn.account.address);
      g.announceCosmetics();
      const n = Object.keys(found).length;
      status = n ? `Found ${n} purchase${n === 1 ? '' : 's'} for this wallet. Welcome back!` : 'No purchases found for this wallet yet.'; bad = false;
    } catch (e) { status = friendlyError(e); bad = true; }
    busy = false; render();
  }

  function walletRow() {
    const ws = solanaWallets();
    if (conn) return h('div', { class: 'row suppwallet' }, h('span', { class: 'chip ok' }, `${conn.wallet.name} · ${short(conn.account.address)}`), h('button', { class: 'btn small', onclick: () => { conn = null; confirming = false; render(); } }, 'Disconnect'));
    if (!ws.length) return h('div', { class: 'col', style: 'gap:6px' },
      h('div', { class: 'small' }, 'To pay you need a Solana wallet in this browser, like Phantom or MetaMask. Get one, then reload this page:'),
      h('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' },
        h('a', { class: 'btn small blue', href: 'https://phantom.com/download', target: '_blank', rel: 'noopener', style: 'text-decoration:none' }, 'Get Phantom'),
        h('a', { class: 'btn small blue', href: 'https://metamask.io/download', target: '_blank', rel: 'noopener', style: 'text-decoration:none' }, 'Get MetaMask')));
    return h('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' }, h('span', { class: 'small' }, 'Connect a wallet:'), ...ws.map((w) => h('button', { class: 'btn small good', onclick: () => doConnect(w) }, w.icon ? h('img', { src: w.icon, width: 18, height: 18, alt: '' }) : null, w.name)));
  }

  function detail() {
    const it = SKU_BY_ID[sel], owned = ownsSku(sel), box = h('div', { class: 'panel suppdetail', style: 'background:var(--paper2);padding:10px;gap:8px;display:flex;flex-direction:column' });
    box.append(h('div', { class: 'row' }, ic(it.icon, 4), h('div', { class: 'grow' }, h('b', { style: 'font-size:19px' }, it.name), h('div', { class: 'small' }, it.desc))));
    if (owned) {
      box.append(h('div', { class: 'chip ok' }, 'You own this. Thank you! ♥'));
      const worn = wornMask();
      box.append(h('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' }, ...it.grants.map((gr) => h('button', { class: 'btn small' + ((worn & COS[gr]) ? ' good' : ''), onclick: () => { setWorn(COS[gr], !(worn & COS[gr])); g.announceCosmetics(); render(); } }, `${(worn & COS[gr]) ? 'Wearing' : 'Hidden'}: ${COS_NAMES[gr]}`))));
      return box;
    }
    if (confirming && conn) {
      box.append(h('div', { class: 'small' }, `You are about to pay ${formatUsd(it.price)} in USDC (on the Solana network) for ${it.name}. Your wallet will ask you to approve it. Payments on a blockchain cannot be undone.`),
        h('div', { class: 'small', style: 'word-break:break-all' }, 'Paid to: ', h('b', null, MERCHANT)),
        h('div', { class: 'row', style: 'gap:6px' }, h('button', { class: 'btn good' + (busy ? ' disabled' : ''), onclick: () => doBuy(sel) }, `Pay ${formatUsd(it.price)}`), h('button', { class: 'btn', onclick: () => { confirming = false; render(); } }, 'Not now')));
      return box;
    }
    box.append(h('button', { class: 'btn good' + (!conn || busy ? ' disabled' : ''), onclick: () => { if (!conn || busy) { g.audio.play('error', { vol: 0.5 }); return; } confirming = true; render(); } }, conn ? `Buy · ${formatUsd(it.price)} USDC` : 'Connect a wallet to buy'));
    return box;
  }

  function render() {
    clear(body);
    body.append(
      h('div', { class: 'small' }, 'The whole game is free. These are optional extras to say thanks, and they only change how you look: nothing here makes the game easier. Paid in USDC on Solana.'),
      walletRow(),
      h('div', { class: 'crgrid', style: 'max-height:none;min-width:0;flex:none' }, ...SKUS.map((s) => h('div', { class: 'crcard' + (sel === s.id ? ' on' : '') + (ownsSku(s.id) ? ' can' : ''), title: s.name, onclick: () => { sel = s.id; confirming = false; g.audio.play('click', { vol: 0.5 }); render(); } },
        ic(s.icon, 3), h('span', { class: 'crtitle' }, s.name), h('span', { class: 'shopprice' }, ownsSku(s.id) ? 'Owned ✓' : formatUsd(s.price))))),
      detail(),
      status ? h('div', { class: 'small', style: `font-weight:700;color:${bad ? '#c0304a' : '#2a7a2a'}`, role: 'status' }, status) : null,
      h('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap;align-items:center' },
        conn ? h('button', { class: 'btn small' + (busy ? ' disabled' : ''), onclick: doRestore }, 'Restore my purchases') : null,
        h('a', { class: 'small', href: 'terms.html', target: '_blank', rel: 'noopener' }, 'Terms'), h('a', { class: 'small', href: 'privacy.html', target: '_blank', rel: 'noopener' }, 'Privacy')));
  }
  render();
  return { title: 'Supporter Shop', icon: 'cos_badge', body, sig: () => '', refresh: () => {} };
}

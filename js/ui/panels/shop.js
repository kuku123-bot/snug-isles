// The Marketplace window: Buy (today's random goods, bought with the shared coins) and Sell (anything from your bag, 10% better than a Market Stall).
import { h, ic, itemIc, clear, esc, tip } from '../dom.js';
import { ITEMS, itemDesc } from '../../data/items.js';
import { TAG_DEAL, TAG_RARE, restockCost } from '../../data/shop.js';
import { calcStats } from '../../sim/player.js';
import { marketNear, sellBonusOf } from '../../sim/shop.js';
import { invCount } from '../../sim/inventory.js';
import { fmtNum } from '../../util.js';

export function shopPanel(g, data, ui) {
  const me = () => g.me, world = () => g.world;
  let tab = 'buy', sel = -1, qty = 1;
  const rail = h('div', { class: 'col crrail' }), grid = h('div', { class: 'crgrid scroll' }), detail = h('div', { class: 'col crdetail' });
  const body = h('div', { class: 'crafter shop' }, rail, grid, detail);
  const shop = () => world().shared.shop || null;
  const items = () => (shop() ? shop().items : []);
  const techs = () => world().techs.size;
  const mul = (id) => (world().shared.market && world().shared.market[id]) || 1;
  const bonus = () => sellBonusOf(marketNear(world(), me()));
  const sellPrice = (id) => Math.max(1, Math.round(ITEMS[id].sell * mul(id) * calcStats(world(), me()).sellMul * bonus()));
  const coins = () => world().coins;

  const coinRow = () => h('div', { class: 'row shopcoins' }, ic('i_coin', 2), h('b', { style: 'font-size:20px' }, fmtNum(coins())), h('span', { class: 'muted small' }, ' coins'));
  const btn = (label, cls, fn, off) => h('button', { class: `btn ${cls}` + (off ? ' disabled' : ''), onclick: () => { if (off) { g.audio.play('error', { vol: 0.5 }); return; } fn(); } }, label);
  const price = (n) => h('span', { class: 'shopprice' }, ic('i_coin', 1), String(n));

  function renderRail() {
    clear(rail);
    const mk = (id, label, pic) => h('div', { class: 'crst' + (tab === id ? ' on' : ''), title: label, onclick: () => { tab = id; sel = -1; qty = 1; g.audio.play('click', { vol: 0.5 }); render(); } }, h('div', { class: 'crpic' }, ic(pic, 3)), h('span', { class: 'crname' }, label));
    rail.append(mk('buy', 'Buy', 'ui_bag'), mk('sell', 'Sell', 'i_coin'));
  }

  // ------------------------------------------------------------ buy
  function renderBuy() {
    const list = items(), s = shop();
    if (!s) { grid.appendChild(h('div', { class: 'muted', style: 'padding:14px;grid-column:1/-1' }, 'The shopkeeper is setting out the goods…')); return; }
    list.forEach((e, i) => {
      const [id, n, p, tag] = e, can = n > 0 && coins() >= p;
      const card = h('div', { class: 'crcard' + (sel === i ? ' on' : '') + (n <= 0 ? ' locked' : can ? ' can' : ' far'), title: ITEMS[id].name, onclick: () => { sel = i; qty = 1; g.audio.play('click', { vol: 0.5 }); render(); } },
        itemIc(id, 3), h('span', { class: 'crtitle' }, ITEMS[id].name), n > 0 ? h('span', { class: 'crqty' }, '×' + n) : null,
        n > 0 ? price(p) : h('span', { class: 'shopprice sold' }, 'Sold out'),
        tag === TAG_DEAL ? h('span', { class: 'shoptag deal' }, 'Deal!') : tag === TAG_RARE ? h('span', { class: 'shoptag rare' }, 'Rare!') : null);
      tip(card, () => `<b>${esc(ITEMS[id].name)}</b><br>${esc(itemDesc(ITEMS[id]) || '')}`);
      grid.appendChild(card);
    });
  }
  function detailBuy() {
    const e = items()[sel];
    if (!e) { detail.appendChild(h('div', { class: 'muted', style: 'padding:12px' }, 'Pick something from the shelves. The goods change every day!')); }
    else {
      const [id, n, p, tag] = e, it = ITEMS[id], have = invCount(me().inv, id), afford = Math.floor(coins() / p);
      detail.append(h('div', { class: 'row' }, itemIc(id, 4), h('div', { class: 'grow' }, h('b', { style: 'font-size:19px' }, it.name), tag === TAG_DEAL ? h('div', { class: 'small', style: 'color:#2a9a2a;font-weight:700' }, 'A third off today!') : tag === TAG_RARE ? h('div', { class: 'small', style: 'color:#a050d8;font-weight:700' }, 'A rare find') : null)),
        h('div', { class: 'small' }, itemDesc(it) || ''),
        h('div', { class: 'row small' }, price(p), h('span', { class: 'muted' }, `each · ${n} left · you have ${have}`)));
      const buy = (k) => { g.cmd({ c: 'buy', i: sel, item: id, n: k }); g.audio.play('click', { vol: 0.5 }); };
      const opts = [[1, 'Buy 1']].concat(n >= 5 ? [[5, 'Buy 5']] : [], n > 1 ? [[n, `Buy all ${n}`]] : []);
      detail.append(h('div', { class: 'row', style: 'flex-wrap:wrap;gap:6px' }, ...opts.filter(([k], j, a) => j === 0 || k !== a[j - 1][0]).map(([k, l]) => btn(`${l} · ${p * k}c`, 'good', () => buy(k), n <= 0 || coins() < p * k))));
      if (n > 0 && afford < 1) detail.append(h('div', { class: 'small', style: 'color:#c0304a' }, `You need ${p - coins()} more coins.`));
    }
    detail.append(h('div', { class: 'sep' }), coinRow(), h('div', { class: 'small muted' }, 'Fresh goods every day.'),
      btn(`New goods · ${restockCost(shop() ? shop().rr : 0, techs())}c`, 'blue small', () => { g.cmd({ c: 'restock' }); sel = -1; }, coins() < restockCost(shop() ? shop().rr : 0, techs())));
  }

  // ------------------------------------------------------------ sell
  function renderSell() {
    const p = me(); let any = false;
    p.inv.forEach((st, i) => {
      if (!st || !(ITEMS[st.id].sell > 0)) return;
      any = true;
      const m = mul(st.id), card = h('div', { class: 'crcard' + (sel === i ? ' on' : '') + (m > 1.1 ? ' can' : ''), title: ITEMS[st.id].name, onclick: () => { sel = i; qty = 1; g.audio.play('click', { vol: 0.5 }); render(); } },
        itemIc(st.id, 3), h('span', { class: 'crtitle' }, ITEMS[st.id].name), h('span', { class: 'crqty' }, '×' + st.n), price(sellPrice(st.id)),
        m > 1.1 ? h('span', { class: 'shoptag deal' }, 'In demand!') : null);
      grid.appendChild(card);
    });
    if (!any) grid.appendChild(h('div', { class: 'muted', style: 'padding:14px;grid-column:1/-1' }, 'Nothing in your bag to sell yet. Cooked food, bars and potions sell for much more than raw materials!'));
  }
  function detailSell() {
    const s = me().inv[sel];
    if (!s || !(ITEMS[s.id].sell > 0)) detail.append(h('div', { class: 'muted', style: 'padding:12px' }, 'Pick something from your bag to sell.'));
    else {
      const each = sellPrice(s.id), m = mul(s.id);
      detail.append(h('div', { class: 'row' }, itemIc(s.id, 4), h('div', { class: 'grow' }, h('b', { style: 'font-size:19px' }, ITEMS[s.id].name), h('div', { class: 'small' }, `${each} coins each` + (m > 1.1 ? ' · in demand today! ▲' : m < 0.9 ? ' · cheap today ▼' : '')))));
      const sell = (k) => { g.cmd({ c: 'sell', i: sel, n: k }); g.audio.play('click', { vol: 0.5 }); };
      const opts = [[1, 'Sell 1']].concat(s.n > 10 ? [[10, 'Sell 10']] : [], s.n > 1 ? [[s.n, `Sell all ${s.n}`]] : []);
      detail.append(h('div', { class: 'row', style: 'flex-wrap:wrap;gap:6px' }, ...opts.map(([k, l]) => btn(`${l} · ${each * k}c`, 'good', () => sell(k)))));
    }
    detail.append(h('div', { class: 'sep' }), coinRow(), h('div', { class: 'small muted' }, bonus() > 1 ? 'The Marketplace pays 10% more than a Market Stall.' : ''));
  }

  function render() {
    renderRail(); clear(grid); clear(detail);
    if (tab === 'buy') { renderBuy(); detailBuy(); } else { renderSell(); detailSell(); }
  }
  render();
  return { title: 'Marketplace', icon: 'ui_pin', body, sig: () => `${me().rev}:${coins()}:${tab}:${sel}:${qty}:${shop() ? shop().rr + '/' + shop().day + '/' + shop().items.map((e) => e[1]).join(',') : '-'}`, refresh: render };
}

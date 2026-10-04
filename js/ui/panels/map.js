// World map: land grid with biomes, ownership, buy prices.
import { h, ic, clear } from '../dom.js';
import { BIOMES } from '../../data/biomes.js';
import { landPrice } from '../../sim/worldgen.js';
import { calcStats } from '../../sim/player.js';
import { fmtNum } from '../../util.js';

export function mapPanel(g, data, ui) {
  const w = () => g.world;
  let sel = null;
  const grid = h('div', { class: 'mapgrid' });
  const info = h('div', { class: 'panel', style: 'background:var(--paper2);padding:8px 10px;min-height:70px' });
  const body = h('div', { class: 'col' }, grid, info);
  function render() {
    const world = w(), me = g.me;
    clear(grid); clear(info);
    grid.style.gridTemplateColumns = `repeat(${world.gw}, minmax(30px, 44px))`;
    const disc = calcStats(world, me).landDiscount;
    const buyable = new Set(g.landTags.map((t) => t.gx + ',' + t.gy));
    for (let gy = 0; gy < world.gh; gy++) for (let gx = 0; gx < world.gw; gx++) {
      const own = world.isLandOwned(gx, gy), key = gx + ',' + gy, can = buyable.has(key);
      const b = BIOMES[world.biomeMap[world.landIndex(gx, gy)]];
      const el = h('div', { class: 'mapcell' + (own ? ' own' : '') + (can ? ' buy' : '') + (!own && !can ? ' far' : '') + (sel === key ? ' sel' : ''), style: `background:${b.color}`, onclick: () => { if (own || can) { sel = key; render(); } } });
      if (!own && can) el.append(h('span', { style: 'font-size:11px;color:#fff;text-shadow:0 1px 0 #000,1px 0 0 #000,-1px 0 0 #000' }, fmtNum(landPrice(world, gx, gy, disc))));
      if (own) {
        const [ox, oy] = world.landOrigin(gx, gy);
        for (const p of world.players.values()) { if (p.online && Math.floor(p.x / 16 - ox) >= 0 && Math.floor(p.x / 16 - ox) < 20 && Math.floor(p.y / 16 - oy) >= 0 && Math.floor(p.y / 16 - oy) < 20) el.append(h('span', { class: 'me', style: `background:${p.pid === g.localPid ? '#fff' : '#ff8fb3'};left:${p.pid === g.localPid ? 4 : 14}px;top:4px` })); }
      }
      grid.appendChild(el);
    }
    if (sel) {
      const [gx, gy] = sel.split(',').map(Number);
      const b = BIOMES[world.biomeMap[world.landIndex(gx, gy)]];
      const own = world.isLandOwned(gx, gy);
      const price = landPrice(world, gx, gy, disc);
      info.append(h('div', { class: 'row', style: 'flex-wrap:wrap' }, h('div', { class: 'grow', style: 'min-width:200px' }, h('b', { style: 'font-size:18px' }, b.name), h('div', { class: 'small' }, b.blurb), h('div', { class: 'small muted' }, own ? 'Yours' : `Tier ${b.tier} biome`)),
        own ? null : h('button', { class: 'btn good' + (world.coins >= price ? '' : ' disabled'), onclick: () => { if (world.coins < price) { g.toast(`Need ${price - world.coins} more coins`, 'warn'); return; } g.cmd({ c: 'buyLand', gx, gy }); g.audio.play('buy'); } }, ic('i_coin', 2), `Buy · ${fmtNum(price)}`)));
    } else info.append(h('div', { class: 'muted small' }, 'Glowing lands next to your island are for sale. Tap one to see what grows there.' + ` You have ${fmtNum(world.coins)} coins.`));
  }
  render();
  return { title: 'World Map', icon: 'ui_map', body, sig: () => `${w().landRev}:${w().coins}`, refresh: render };
}

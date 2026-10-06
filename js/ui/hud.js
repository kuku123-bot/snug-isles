// Heads-up display: hearts, xp, coins, clock, minimap, hotbar and quick buttons (DOM).
import { h, ic, itemIc, tip, esc, clear } from './dom.js';
import { ITEMS, itemDesc } from '../data/items.js';
import { calcStats, HOTBAR } from '../sim/player.js';
import { refKey } from './drag.js';
import { xpForLevel } from '../data/skills.js';
import { nightness, phaseOf, clockText } from '../sim/daynight.js';
import { fmtNum } from '../util.js';
import { GROUND_IDS, BIOMES } from '../data/biomes.js';
import { BUILD, WALL_IDS } from '../data/build.js';
import { MOBS } from '../data/mobs.js';
import { GOAL_BY_ID, nextGoal } from '../data/goals.js';
import { census } from '../sim/goals.js';
import { colorRGB } from '../data/paint.js';

const GROUND_RGB = { water: [51, 136, 220], grass: [108, 194, 78], sand: [241, 220, 154], snow: [236, 244, 255], swamp: [79, 143, 98], grave: [127, 115, 146], volcano: [93, 74, 83], crystal: [203, 184, 244], void: [43, 33, 88] };

export class HUD {
  constructor(game, root) {
    this.g = game; this.root = root;
    this.last = {};
    this.pickLog = [];
    this.mmT = 0;
    this.build();
  }

  build() {
    const g = this.g, root = this.root;
    clear(root);
    this.heartsEl = h('div', { class: 'hearts' });
    this.lvlBadge = h('span', { class: 'badge' }, '1');
    this.xpFill = h('i');
    this.spDot = h('span', { class: 'small', style: 'font-weight:700;color:#7a4ab8' });
    this.lvlEl = h('div', { class: 'lvl' }, this.lvlBadge, h('div', { class: 'xpbar' }, this.xpFill), this.spDot);
    this.energyFill = h('i', { style: 'background:#ffd84a' });
    this.hungerFill = h('i', { style: 'background:#ff9a5a' });
    this.hungerMeter = h('div', { class: 'meter' }, ic('ui_hunger', 1), h('div', { class: 'bar' }, this.hungerFill));
    this.meters = h('div', { class: 'meters' }, h('div', { class: 'meter' }, ic('ui_bolt', 1), h('div', { class: 'bar' }, this.energyFill)), this.hungerMeter);
    this.partnerEl = h('div', { class: 'pill small', style: 'display:none;font-size:14px;padding:2px 10px 2px 6px' });
    this.cozyEl = h('div', { class: 'pill small', style: 'display:none;font-size:14px' });
    this.goalTxt = h('span'); this.goalProg = h('span', { class: 'gp' });
    this.goalPill = h('div', { class: 'goalpill', style: 'display:none', onclick: () => { g.audio.play('click'); g.ui.toggle('goals'); } }, ic('ui_star', 1), this.goalTxt, this.goalProg);
    const tl = h('div', { class: 'hud-tl' }, this.heartsEl, this.lvlEl, this.meters, this.goalPill, this.partnerEl);

    this.coinNum = h('span', null, '0');
    this.coinPill = h('div', { class: 'pill', onclick: () => g.ui.open('map') }, ic('i_coin', 2), this.coinNum);
    this.clockIc = h('span');
    this.clockTxt = h('span', null, '06:00');
    this.clockPill = h('div', { class: 'pill' }, this.clockIc, this.clockTxt);
    this.wxEl = h('span');
    const tc = h('div', { class: 'hud-tc' }, this.coinPill, this.clockPill, this.cozyEl);

    this.mm = h('canvas', { class: 'minimap', width: 56, height: 56, onclick: () => g.ui.open('map') });
    this.mmCtx = this.mm.getContext('2d');
    this.mmImg = this.mmCtx.createImageData(56, 56);
    const btn = (icon, act, key, label) => {
      const b = h('div', { class: 'hbtn', title: label, onclick: (e) => { g.audio.play('click'); act(); } }, ic(icon, 2), key ? h('span', { class: 'keycap' }, key) : null);
      return b;
    };
    this.skillBtn = btn('ui_skills', () => g.ui.toggle('skills'), 'K', 'Skills');
    this.skillDot = h('span', { class: 'dot', style: 'display:none' });
    this.skillBtn.appendChild(this.skillDot);
    const hb = h('div', { class: 'hbtns' },
      btn('ui_bag', () => g.ui.toggle('inventory'), 'I', 'Bag'),
      btn('ui_hammer', () => g.ui.toggle('craft'), 'C', 'Craft'),
      btn('ui_house', () => g.ui.toggle('build'), 'B', 'Build'),
      btn('ui_flask', () => g.ui.toggle('tech'), 'T', 'Research'),
      this.skillBtn,
      btn('ui_map', () => g.ui.toggle('map'), 'M', 'Map'),
      btn('ui_smile', () => g.ui.toggle('emote'), 'G', 'Emotes'),
      btn('ui_gear', () => g.ui.toggle('pause'), 'Esc', 'Menu'));
    const tr = h('div', { class: 'hud-tr' }, this.mm, hb);

    this.slots = [];
    const hot = h('div', { class: 'hotbar' });
    for (let i = 0; i < HOTBAR; i++) {
      const s = h('div', { class: 'slot', dataset: { ref: refKey({ k: 'p', i }) }, onclick: () => { g.selectSlot(i); }, onpointerdown: (e) => { e.stopPropagation(); } });
      this.slots.push(s); hot.appendChild(s);
    }
    this.hotbar = hot;
    this.pickups = h('div', { class: 'pickups' });
    this.statusRow = h('div', { class: 'statusrow' });
    this.bossName = h('div', { class: 'nm' }); this.bossFill = h('i');
    this.bossEl = h('div', { class: 'bossbar', style: 'display:none' }, this.bossName, h('div', { class: 'bar' }, this.bossFill));
    this.buildBar = h('div', { class: 'buildbar', style: 'display:none' });
    this.buildSide = h('div', { class: 'buildside', style: 'display:none' }); // the color picker: beside the world, not over the place you are building
    // join requests live above every panel (the "Play together" window would otherwise cover them)
    let jr = document.getElementById('joinreqs');
    if (!jr) { jr = h('div', { id: 'joinreqs', class: 'joinreqs' }); document.getElementById('app').appendChild(jr); }
    jr.replaceChildren(); this.joinReqs = jr;
    root.append(tl, tc, tr, this.pickups, this.statusRow, this.bossEl, this.buildBar, this.buildSide, hot);
    window.addEventListener('resize', () => this.layoutBuildSide());
    this.last = {};
    this.refreshAll();
  }

  /** host: someone new knocks. decide({allow, as}) answers; `as` hands them a returning player's old character */
  askJoin(info, decide, link) {
    const g = this.g;
    g.audio.play('join');
    let card = null;
    const answer = (d) => { if (card) card.remove(); decide(d); };
    const claim = (info.claim || []).map((c) => h('button', { class: 'btn small blue', onclick: () => answer({ allow: true, as: c.pid }) }, `This is ${c.name} (level ${c.level || 1}) — keep their character`));
    card = h('div', { class: 'joinreq panel' },
      h('div', { class: 'row' }, ic('ui_people', 2), h('div', { class: 'grow' }, h('b', null, info.name), ' wants to join your world')),
      h('div', { class: 'small muted' }, 'Only let in someone you invited.'),
      h('div', { class: 'col', style: 'gap:6px' },
        h('button', { class: 'btn small good', onclick: () => answer({ allow: true }) }, claim.length ? 'Let in as a new player' : 'Let them in'), ...claim,
        h('button', { class: 'btn small red', onclick: () => answer(null) }, 'Not now')));
    card._link = link;
    this.joinReqs.append(card);
  }
  cancelJoin(link) { for (const c of [...this.joinReqs.children]) if (c._link === link) c.remove(); }

  logPickup(item, n) {
    const it = ITEMS[item]; if (!it) return;
    // merge with a recent identical entry
    const last = this.pickups.lastChild;
    if (last && last.dataset.item === item && last.dataset.age < 1.5) { /* new element anyway; keep simple */ }
    const el = h('div', { dataset: { item } }, itemIc(item, 2), `+${n} ${it.name}`);
    this.pickups.appendChild(el);
    while (this.pickups.children.length > 5) this.pickups.removeChild(this.pickups.firstChild);
    setTimeout(() => el.remove(), 3500);
  }

  /** the corner pill that names the next Island Goal */
  refreshGoal() {
    const g = this.g, w = g.world;
    const done = new Set((w && w.shared.flags.goals) || []);
    const nxt = g.settings.showGoals === false ? null : nextGoal(done);
    this.goalNow = nxt;
    this.goalPill.style.display = nxt ? '' : 'none';
    if (!nxt) return;
    this.goalTxt.textContent = nxt.title;
    const pr = nxt.prog ? nxt.prog(census(w)) : null;
    this.goalProg.textContent = pr ? ` ${pr[0]}/${pr[1]}` : '';
  }

  refreshAll() { this.last = {}; this.update(0, true); this.renderHotbar(); this.refreshGoal(); }

  renderHotbar() {
    const g = this.g, p = g.me;
    if (!p) return;
    for (let i = 0; i < HOTBAR; i++) {
      const s = this.slots[i], st = p.inv[i];
      clear(s);
      s.className = 'slot' + (i === p.sel ? ' sel' : '') + (st ? '' : ' empty');
      s.appendChild(h('span', { class: 'k' }, String(i + 1)));
      if (st) {
        s.appendChild(itemIc(st.id, 2));
        if (st.n > 1) s.appendChild(h('span', { class: 'n' + (st.n >= 1000 ? ' n4' : st.n >= 100 ? ' n3' : '') }, st.n));
      }
      s.onpointerenter = null;
      if (st) tip(s, () => `<b>${esc(ITEMS[st.id].name)}</b><br>${esc(itemDesc(ITEMS[st.id])).replace(/\n/g, '<br>')}`);
    }
    this.last.inv = p.rev;
  }

  update(dt, force) {
    const g = this.g, p = g.me, w = g.world;
    if (!p) return;
    const L = this.last;
    this.goalT = (this.goalT || 0) + dt;
    const gl = (w.shared.flags.goals || []).length;
    if (gl !== this.goalLen || (this.goalT > 2 && this.goalNow && this.goalNow.prog)) { this.goalT = 0; this.goalLen = gl; this.refreshGoal(); }
    const st = calcStats(w, p);
    if (force || L.hp !== p.hp || L.mhp !== st.maxHp) {
      L.hp = p.hp; L.mhp = st.maxHp;
      const n = Math.ceil(st.maxHp / 4);
      if (this.heartsEl.children.length !== n) { clear(this.heartsEl); for (let i = 0; i < n; i++) this.heartsEl.appendChild(ic('ui_heart', 2)); }
      for (let i = 0; i < n; i++) {
        const v = p.hp - i * 4;
        const name = v >= 3 ? 'ui_heart' : v >= 1 ? 'ui_heart_half' : 'ui_heart_empty';
        const el = this.heartsEl.children[i];
        if (el.dataset.k !== name) { const ne = ic(name, 2); ne.dataset.k = name; el.replaceWith(ne); }
      }
    }
    if (force || L.xp !== Math.floor(p.xp) || L.lv !== p.level) {
      L.xp = Math.floor(p.xp); L.lv = p.level;
      this.lvlBadge.textContent = p.level;
      this.xpFill.style.width = Math.min(100, (p.xp / xpForLevel(p.level)) * 100) + '%';
    }
    if (force || L.sp !== p.sp) { L.sp = p.sp; this.spDot.textContent = p.sp > 0 ? `+${p.sp}` : ''; this.skillDot.style.display = p.sp > 0 ? '' : 'none'; this.skillDot.textContent = p.sp; }
    const en = Math.round(p.energy), hu = Math.round(p.hunger);
    if (force || L.en !== en) { L.en = en; this.energyFill.style.width = Math.min(100, (p.energy / st.maxEnergy) * 100) + '%'; }
    if (force || L.hu !== hu) { L.hu = hu; this.hungerFill.style.width = p.hunger + '%'; this.hungerFill.style.background = p.hunger < 25 ? '#ff6b7a' : '#ff9a5a'; }
    this.hungerMeter.style.display = w.settings.hunger ? '' : 'none';
    if (force || L.coins !== w.coins) { L.coins = w.coins; this.coinNum.textContent = fmtNum(w.coins); }
    const phase = phaseOf(w.time, w.settings.dayLength || 480);
    const night = nightness(phase) > 0.5;
    const clk = clockText(phase) + (w.shared.weather ? ' ☔' : '');
    if (force || L.clk !== clk || L.night !== night) {
      L.clk = clk; L.night = night;
      this.clockTxt.textContent = `Day ${w.day + 1} · ${clk}`;
      clear(this.clockIc); this.clockIc.appendChild(ic(night ? 'ui_moon' : 'ui_sun', 2));
    }
    // cozy badge
    const cz = p.cozy | 0;
    if (force || L.cozy !== cz) {
      L.cozy = cz;
      if (cz >= 10) { this.cozyEl.style.display = ''; clear(this.cozyEl); this.cozyEl.append(ic('ui_cozy', 1), cz >= 40 ? ` Dreamy ${cz}` : cz >= 25 ? ` Very cozy ${cz}` : ` Cozy ${cz}`); }
      else this.cozyEl.style.display = 'none';
    }
    // buffs
    const bk = Object.keys(p.buffs).filter((k) => p.buffs[k].t > 0).map((k) => k + Math.ceil(p.buffs[k].t / 10)).join(',') + (p.sleeping ? '|z' : '') + (p.sit ? '|s' : '');
    if (force || L.buffs !== bk) {
      L.buffs = bk; clear(this.statusRow);
      for (const k of Object.keys(p.buffs)) { const b = p.buffs[k]; if (b.t > 0) this.statusRow.appendChild(h('div', { class: 'status' }, `${k[0].toUpperCase() + k.slice(1)} ${Math.ceil(b.t)}s`)); }
      if (p.sleeping) this.statusRow.appendChild(h('div', { class: 'status' }, 'Zzz... move to get up'));
      else if (p.sit) this.statusRow.appendChild(h('div', { class: 'status' }, 'Sitting... move to get up'));
    }
    // partner
    const partner = g.partner();
    const pk = partner ? partner.name + partner.hp : '';
    if (force || L.partner !== pk) {
      L.partner = pk;
      if (partner) { this.partnerEl.style.display = ''; clear(this.partnerEl); this.partnerEl.append(ic('ui_people', 1), ` ${partner.name} `, ic('ui_heart', 1), ` ${Math.ceil(partner.hp / 4)}`); } else this.partnerEl.style.display = 'none';
    }
    // boss
    const bid = w.shared.bossUp;
    const boss = bid ? w.mobs.get(bid) : null;
    if (boss) { this.bossEl.style.display = ''; this.bossName.textContent = MOBS[boss.type].name; this.bossFill.style.width = Math.max(0, (boss.hp / boss.maxhp) * 100) + '%'; }
    else this.bossEl.style.display = 'none';
    if (L.inv !== p.rev) this.renderHotbar();
    else {
      // selection highlight only
      for (let i = 0; i < HOTBAR; i++) { const on = i === p.sel; if (this.slots[i].classList.contains('sel') !== on) this.slots[i].classList.toggle('sel', on); }
    }
    // minimap
    this.mmT -= dt;
    if (force || this.mmT <= 0) { this.mmT = 0.3; this.drawMinimap(); }
  }

  drawMinimap() {
    const g = this.g, w = g.world, p = g.me;
    if (!p) return;
    const S = 56, d = this.mmImg.data;
    const cx = Math.floor(p.x / 16), cy = Math.floor(p.y / 16);
    const z = 1; // one tile per pixel
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const tx = cx - 28 + x, ty = cy - 28 + y, o = (y * S + x) * 4;
      let c = GROUND_RGB.water;
      if (w.inb(tx, ty)) {
        const i = w.idx(tx, ty);
        const gr = w.ground[i];
        if (gr) {
          c = GROUND_RGB[GROUND_IDS[gr]];
          const wc = w.wall[i];
          if (wc) c = w.wallCol[i] ? colorRGB(w.wallCol[i]) : [110, 74, 58]; // painted pieces show their color on the map too
          else if (w.floor[i]) c = w.floorCol[i] ? colorRGB(w.floorCol[i]) : [c[0] * 0.8 + 40, c[1] * 0.75 + 30, c[2] * 0.7 + 10];
          else if (w.occ[i]) { const t = w.things.get(w.occ[i]); const dd = t && BUILD[t.type]; c = dd ? (t.col ? colorRGB(t.col) : [200, 150, 90]) : [c[0] * 0.7, c[1] * 0.8, c[2] * 0.7]; }
        } else if (w.isLandOwned && false) c = c;
      } else c = [29, 21, 48];
      d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    }
    this.mmCtx.putImageData(this.mmImg, 0, 0);
    const dot = (px, py, col) => { const x = Math.round(px / 16) - cx + 28, y = Math.round(py / 16) - cy + 28; if (x < 1 || y < 1 || x > S - 2 || y > S - 2) return; this.mmCtx.fillStyle = '#2a1f3d'; this.mmCtx.fillRect(x - 2, y - 2, 5, 5); this.mmCtx.fillStyle = col; this.mmCtx.fillRect(x - 1, y - 1, 3, 3); };
    for (const o of w.players.values()) if (o.online && o.pid !== p.pid) dot(o.x, o.y, '#ff8fb3');
    for (const m of w.mobs.values()) if (m.boss) dot(m.x, m.y, '#ff4a5a');
    dot(p.x, p.y, '#ffffff');
  }

  /** build mode bar */
  /** the panel at the side of the screen while building (null hides it) */
  setBuildSide(node) {
    clear(this.buildSide);
    if (node) { this.buildSide.style.display = 'block'; this.buildSide.appendChild(node); this.layoutBuildSide(); } else this.buildSide.style.display = 'none';
  }
  /** keep the side panel (the color picker) under the HUD buttons and clear of the build bar (the bar is centred: on a narrow screen the two would meet);
   *  when there is too little room it switches to its compact size, and past that it scrolls */
  layoutBuildSide() {
    const side = this.buildSide;
    if (!side || side.style.display === 'none') return;
    const vr = this.root.getBoundingClientRect(), hb = this.root.querySelector('.hbtns');
    const top = Math.round((hb ? hb.getBoundingClientRect().bottom : vr.top + 100) + 8 - vr.top);
    side.classList.remove('tight');
    side.style.top = top + 'px'; side.style.maxHeight = '';
    let bottom = vr.height - 8;
    if (this.buildBar.style.display !== 'none') {
      const b = this.buildBar.getBoundingClientRect(), s = side.getBoundingClientRect();
      if (b.right > s.left - 6 && b.left < s.right) bottom = Math.min(bottom, b.top - vr.top - 8);
    }
    side.style.maxHeight = Math.max(150, bottom - top) + 'px';
    if (side.scrollHeight > side.clientHeight + 1) side.classList.add('tight');
  }
  setBuildBar(node) { clear(this.buildBar); if (node) { this.buildBar.style.display = 'flex'; this.buildBar.appendChild(node); } else this.buildBar.style.display = 'none'; }
}

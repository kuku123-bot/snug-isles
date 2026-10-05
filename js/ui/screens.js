// Full-screen menus: title, worlds, new world, character, join. (DOM over the animated title scene)
import { formatRelayKey, parseRelayKey } from '../net/relaykey.js';
import { h, ic, clear, itemIc } from './dom.js';
import { optionsEditor } from './options.js';
import { PRESETS, presetSettings, DEFAULTS } from '../data/difficulty.js';
import { SKIN_TONES, HAIR_COLORS, OUTFIT_COLORS, HAIR_STYLES, ACCESSORIES, playerFrame } from '../gfx/art/player.js';
import { pixmapToCanvas } from '../gfx/canvasutil.js';
import { timeAgo } from '../util.js';

export function portrait(look, scale = 3, dir = 0, frame = 0) {
  const pm = playerFrame(look, dir, frame);
  const c = pixmapToCanvas(pm, scale);
  c.style.imageRendering = 'pixelated';
  return c;
}

export class Screens {
  constructor(app) { this.app = app; this.root = document.getElementById('ui'); this.timer = null; }
  clear() { clear(this.root); if (this.timer) { clearInterval(this.timer); this.timer = null; } }
  show(node) { this.clear(); this.root.appendChild(node); }
  btn(label, icon, fn, cls = '') { return h('button', { class: 'btn ' + cls, onclick: () => { this.app.audio.unlock(); this.app.audio.play('click'); fn(); } }, icon ? ic(icon, 2) : null, label); }

  title() {
    const app = this.app;
    const standalone = window.navigator.standalone || matchMedia('(display-mode: standalone)').matches;
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const menu = h('div', { class: 'menu' },
      this.btn('Play', 'ui_sun', () => this.worlds(), 'primary'),
      this.btn('Play together', 'ui_people', () => this.together(), 'blue'),
      this.btn('Your character', 'ui_smile', () => this.character(), 'warn'),
      h('div', { class: 'row' }, h('div', { class: 'grow' }, this.btn('Settings', 'ui_gear', () => this.settingsScreen())), h('div', { class: 'grow' }, this.btn('Help', 'ui_book', () => this.help()))));
    const hint = ios && !standalone ? h('div', { class: 'panel small', style: 'max-width:380px;padding:6px 10px;text-align:center' }, 'Tip: open this page in Safari, tap ', ic('ui_arrow', 1), ' Share → "Add to Home Screen". It becomes a full-screen app: no address bar, no browser zoom, works offline.') : null;
    const wrap = h('div', { class: 'title-wrap' }, h('div', { class: 'logo' }, 'Snug', h('br'), 'Isles', h('small', null, 'A COZY ISLAND FOR TWO')), menu, hint, h('div', { class: 'small', style: 'color:#fff;text-shadow:0 2px 0 var(--ink),1px 0 0 var(--ink),-1px 0 0 var(--ink);opacity:.9' }, `v${app.version} · made with love`));
    this.show(wrap);
  }

  frame(title, body, { back = () => this.title(), width = 'min(94vw, 760px)', footer = null } = {}) {
    const head = h('div', { class: 'win-head' }, h('div', { class: 'xbtn', style: 'background:var(--paper2)', onclick: () => { this.app.audio.play('close'); back(); } }, ic('ui_arrow', 2, 'flipx')), h('h2', null, title));
    const win = h('div', { class: 'panel win', style: `width:${width};max-height:94%` }, head, body, footer);
    const scrim = h('div', { class: 'scrim', style: 'background:rgba(29,21,48,.38)' }, win);
    this.show(scrim);
    return win;
  }

  together() {
    const body = h('div', { class: 'col', style: 'gap:12px' },
      h('div', { class: 'small' }, 'One of you hosts the world, the other joins with a short code. Both of you keep a copy of the world, so either device can host next time.'),
      this.btn('Host a world', 'ui_house', () => this.worlds({ host: true }), 'primary'),
      this.btn('Join my partner', 'ui_link', () => this.join(), 'good'),
      h('div', { class: 'small muted' }, 'Tip: the Mac makes the steadiest host. Keep the host window in front while you play.'));
    this.frame('Play together', body, { width: 'min(94vw, 460px)' });
  }

  async worlds(opts = {}) {
    const app = this.app;
    const listEl = h('div', { class: 'col scroll', style: 'max-height:56vh;gap:8px' }, h('div', { class: 'muted' }, 'Loading…'));
    const note = h('div', { class: 'small', style: 'min-height:18px' });
    const picker = h('input', { type: 'file', accept: '.json,application/json', style: 'display:none', onchange: async () => { const f = picker.files && picker.files[0]; picker.value = ''; if (!f) return; try { await app.importWorld(f); this.worlds(opts); } catch (err) { note.textContent = err.message || String(err); } } });
    const body = h('div', { class: 'col', style: 'gap:10px' },
      h('div', { class: 'row', style: 'gap:8px' }, h('div', { class: 'grow' }, this.btn('New world', 'ui_plus', () => this.newWorld(opts), 'good')), this.btn('Open a backup', 'ui_bag', () => picker.click()), picker), note, listEl);
    this.frame(opts.host ? 'Host which world?' : 'Your worlds', body);
    const rows = await app.listWorlds();
    clear(listEl);
    if (!rows.length) listEl.append(h('div', { class: 'muted', style: 'padding:14px;text-align:center' }, 'No worlds yet — create your first island!'));
    for (const m of rows) {
      const card = h('div', { class: 'save-card' },
        h('div', { class: 'row', style: 'gap:0;flex:none' }, ...(m.players || []).slice(0, 2).map((p) => portrait(p.look, 3))),
        h('div', { class: 'grow' }, h('b', { style: 'font-size:18px' }, m.name || 'Our Isles'), h('div', { class: 'small' }, `Day ${m.day || 1} · ${m.lands || 1} land${(m.lands || 1) > 1 ? 's' : ''} · ${(m.players || []).map((p) => p.name).join(' & ') || '—'}`), h('div', { class: 'small muted' }, `${m.preset || 'Classic'} · ${timeAgo(m.updated)}`)),
        h('div', { class: 'col', style: 'gap:6px' }, this.btn(opts.host ? 'Host' : 'Play', 'ui_check', () => app.startSaved(m.id, opts.host ? 'host' : 'solo'), 'good'),
          h('div', { class: 'row', style: 'gap:6px' },
            h('button', { class: 'btn small', title: 'Save a backup file', onclick: async (e) => { e.stopPropagation(); try { const r = await app.exportWorld(m.id); if (r !== 'cancelled') note.textContent = r === 'shared' ? 'Backup shared — keep it somewhere safe!' : 'Backup saved to your downloads.'; } catch (err) { note.textContent = err.message || String(err); } } }, ic('ui_bag', 1), 'Backup'),
            h('button', { class: 'btn small red', title: 'Delete', onclick: (e) => { e.stopPropagation(); if (confirm(`Delete "${m.name}" forever?`)) app.deleteWorld(m.id).then(() => this.worlds(opts)); } }, ic('ui_trash', 1)))));
      listEl.append(card);
    }
  }

  newWorld(opts = {}) {
    const app = this.app;
    const nameIn = h('input', { type: 'text', value: 'Our Isles', maxlength: 24, placeholder: 'World name' });
    const seedIn = h('input', { type: 'text', placeholder: 'Random', maxlength: 24 });
    const ed = optionsEditor({ ...DEFAULTS, ...presetSettings('classic') });
    const create = this.btn('Create & start', 'ui_check', () => app.createWorld({ name: nameIn.value.trim() || 'Our Isles', seed: seedIn.value.trim(), settings: ed.get(), mode: opts.host ? 'host' : 'solo' }), 'good');
    const body = h('div', { class: 'col scroll', style: 'max-height:66vh;gap:10px' },
      h('div', { class: 'opt-grid' }, h('div', { class: 'field' }, h('label', null, 'World name'), nameIn), h('div', { class: 'field' }, h('label', null, 'Seed (optional)'), seedIn)),
      h('div', { class: 'sep' }), h('b', { style: 'font-size:19px' }, 'Pick your style of play'), h('div', { class: 'small muted' }, 'You can tweak every rule below. Most can be changed later from the pause menu.'), ed.el);
    this.frame('New world', body, { back: () => this.worlds(opts), width: 'min(96vw, 900px)', footer: h('div', { class: 'row', style: 'justify-content:flex-end' }, create) });
  }

  character(ret = null) {
    const app = this.app, pr = app.profile;
    const look = { ...pr.look };
    const prev = h('div', { class: 'row', style: 'justify-content:center;gap:8px;min-height:190px;align-items:flex-end' });
    let step = 0;
    const draw = () => {
      clear(prev);
      const f = [0, 1, 0, 3][step & 3];
      prev.append(portrait(look, 8, 0, f), portrait(look, 6, 2, f), portrait(look, 6, 1, f));
    };
    this.timer = setInterval(() => { step++; draw(); }, 220);
    const nameIn = h('input', { type: 'text', value: pr.name, maxlength: 12, placeholder: 'Your name', oninput: (e) => { pr.name = e.target.value; } });
    const swatches = (key, colors, extra = 0) => h('div', { class: 'row', style: 'flex-wrap:wrap;gap:6px' }, ...colors.map((c, i) => h('div', { style: `width:var(--sw,36px);height:var(--sw,36px);border-radius:50%;background:${c};border:4px solid ${look[key] === i ? 'var(--pink-d)' : 'var(--ink)'};cursor:pointer;box-shadow:${look[key] === i ? '0 0 0 3px var(--pink)' : 'none'}`, onclick: () => { look[key] = i; this.app.audio.play('click', { vol: .4 }); rerender(); } })));
    const choices = (key, names) => h('div', { class: 'seg', style: 'flex-wrap:wrap' }, ...names.map((n, i) => h('button', { class: look[key] === i ? 'on' : '', onclick: () => { look[key] = i; this.app.audio.play('click', { vol: .4 }); rerender(); } }, n)));
    const form = h('div', { class: 'col charform', style: 'gap:8px' });
    function rerender() { draw(); clear(form); form.append(h('div', { class: 'field' }, h('label', null, 'Name'), nameIn), h('div', { class: 'field' }, h('label', null, 'Hair style'), choices('hair', HAIR_STYLES)), h('div', { class: 'field' }, h('label', null, 'Hair color'), swatches('hairColor', HAIR_COLORS)), h('div', { class: 'field' }, h('label', null, 'Skin'), swatches('skin', SKIN_TONES)), h('div', { class: 'field' }, h('label', null, 'Outfit color'), swatches('outfit', OUTFIT_COLORS)), h('div', { class: 'field' }, h('label', null, 'Accessory'), choices('accessory', ACCESSORIES))); }
    rerender();
    const save = this.btn('Looks great!', 'ui_check', () => { pr.look = look; pr.name = (nameIn.value || 'Friend').trim().slice(0, 12) || 'Friend'; pr.customized = true; app.saveProfile(); clearInterval(this.timer); ret ? ret() : this.title(); }, 'good');
    const rnd = this.btn('Surprise me', 'ui_star', () => { look.hair = Math.floor(Math.random() * HAIR_STYLES.length); look.hairColor = Math.floor(Math.random() * HAIR_COLORS.length); look.skin = Math.floor(Math.random() * SKIN_TONES.length); look.outfit = Math.floor(Math.random() * OUTFIT_COLORS.length); look.accessory = Math.floor(Math.random() * ACCESSORIES.length); rerender(); }, 'warn');
    const body = h('div', { class: 'row', style: 'align-items:flex-start;gap:16px;flex-wrap:wrap' }, h('div', { class: 'col', style: 'align-items:center;gap:10px;min-width:200px;flex:1' }, h('div', { class: 'panel', style: 'background:linear-gradient(#9ad8ff,#c8f0b0);padding:14px 10px;width:100%' }, prev), rnd), h('div', { class: 'scroll', style: 'flex:1.4;min-width:260px;max-height:calc(100vh - 200px)' }, form));
    this.frame('Your character', body, { back: ret || undefined, footer: h('div', { class: 'row', style: 'justify-content:flex-end' }, save), width: 'min(96vw, 820px)' });
  }

  join(note = '', preset = {}) {
    const app = this.app;
    const codeIn = h('input', { type: 'text', placeholder: 'ABCDE', maxlength: 8, autocapitalize: 'characters', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false', style: 'font-size:34px;text-align:center;letter-spacing:8px;text-transform:uppercase;font-weight:700', value: preset.code || app.profile.lastCode || '' });
    const keyIn = h('input', { type: 'text', placeholder: 'XXXX-XXXX-XXXX-XXXX', maxlength: 24, autocapitalize: 'characters', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false', style: 'font-size:20px;text-align:center;letter-spacing:2px;text-transform:uppercase;font-weight:700', value: preset.relayKey ? (formatRelayKey(parseRelayKey(preset.relayKey) || '') || preset.relayKey) : '' });
    for (const el of [codeIn, keyIn]) { el.addEventListener('focus', () => { app.input.typing = true; }); el.addEventListener('blur', () => { app.input.typing = false; }); }
    const status = h('div', { class: 'small', style: 'min-height:20px;text-align:center' }, note);
    const nameIn = h('input', { type: 'text', value: app.profile.name || 'Friend', maxlength: 12, placeholder: 'Your name', autocomplete: 'off' });
    nameIn.addEventListener('focus', () => { app.input.typing = true; }); nameIn.addEventListener('blur', () => { app.input.typing = false; });
    const keep = () => ({ code: codeIn.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, ''), relayKey: keyIn.value });
    const go = this.btn('Join!', 'ui_link', () => {
      const nm = (nameIn.value || '').trim().slice(0, 12);
      if (nm && nm !== app.profile.name) { app.profile.name = nm; app.profile.customized = true; app.saveProfile(); }
      const c = codeIn.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      const rk = keyIn.value.trim() ? keyIn.value : null;
      if (rk && !parseRelayKey(rk)) { status.textContent = 'The backup code has 16 letters and numbers (like ABCD-EFGH-JKMN-PQRS).'; return; }
      if (c.length < 4 && !rk) { status.textContent = 'Type the code your partner sees.'; return; }
      status.textContent = 'Connecting…';
      app.joinGame(c.length >= 4 ? c : '', (msg) => { status.textContent = msg; }, { relayKey: rk });
    }, 'good');
    const more = h('details', { open: !!preset.relayKey },
      h('summary', { style: 'cursor:pointer;font-weight:700' }, 'Joining does not work? Use a backup code'),
      h('div', { class: 'col', style: 'gap:6px;margin-top:6px' }, h('div', { class: 'small' }, 'Your partner can turn on "Backup connection" in Invite / players and read you a longer code. It works on stricter networks (a little slower).'), keyIn));
    const body = h('div', { class: 'col', style: 'gap:10px;align-items:stretch' },
      h('div', { class: 'small' }, 'Ask your partner to open their world, tap "Invite / players" in the pause menu, and read you the code.'), h('div', { class: 'field' }, h('label', null, 'Room code'), codeIn),
      h('div', { class: 'row', style: 'align-items:flex-end' }, h('div', { class: 'field grow' }, h('label', null, 'Your name'), nameIn), h('button', { class: 'btn small', onclick: () => { const k = keep(); app.profile.name = (nameIn.value || 'Friend').trim().slice(0, 12) || 'Friend'; this.character(() => this.join(note, { code: k.code, relayKey: k.relayKey })); } }, ic('ui_smile', 1), 'Change look')), go, status, more,
      h('div', { class: 'sep' }), h('button', { class: 'btn small', onclick: () => this.manual() }, 'Code not working? Pair manually'));
    this.frame('Join my partner', body, { back: () => this.together(), width: 'min(94vw, 440px)' });
    if (preset.auto) setTimeout(() => go.click(), 250); else setTimeout(() => codeIn.focus(), 100);
  }

  manual() {
    const app = this.app;
    const out = h('textarea', { class: 'sdp', readonly: true, placeholder: 'Your answer code will appear here' });
    const inp = h('textarea', { class: 'sdp', placeholder: 'Paste the host\'s code here' });
    for (const t of [inp]) { t.addEventListener('focus', () => { app.input.typing = true; }); t.addEventListener('blur', () => { app.input.typing = false; }); }
    const status = h('div', { class: 'small', style: 'min-height:20px' });
    const go = this.btn('Make my answer', 'ui_link', async () => { status.textContent = 'Working…'; try { const ans = await app.manualJoin(inp.value.trim(), (m) => { status.textContent = m; }); out.value = ans; status.textContent = 'Send this answer code back to the host, then wait…'; } catch (e) { status.textContent = 'That code did not work: ' + (e.message || e); } }, 'good');
    const copy = this.btn('Copy', 'ui_check', () => { out.select(); navigator.clipboard && navigator.clipboard.writeText(out.value); status.textContent = 'Copied!'; });
    const body = h('div', { class: 'col', style: 'gap:8px' }, h('div', { class: 'small' }, 'Manual pairing works with no internet server. Host: open the pause menu → Invite → "Manual pairing" and copy the code to your partner.'), inp, go, out, copy, status);
    this.frame('Manual pairing', body, { back: () => this.join(), width: 'min(94vw, 520px)' });
  }

  settingsScreen() {
    const app = this.app;
    // reuse the in-game settings panel with a tiny shim
    const fake = { settings: app.settings, app, audio: app.audio, touch: { layout() {} }, view: app.view, showNames: true };
    import('./panels/menus.js').then(({ settingsPanel }) => {
      const p = settingsPanel(fake, {}, { close() {} });
      this.frame('Settings', p.body, { width: 'min(94vw, 480px)' });
    });
  }
  help() {
    const fake = { settings: app => 0 };
    import('./panels/menus.js').then(({ helpPanel }) => {
      const p = helpPanel({}, {}, { close() {} });
      this.frame('How to play', p.body, { width: 'min(94vw, 600px)' });
    });
  }
}

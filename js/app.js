// App orchestrator: boot, screens, starting/saving games, main loop.
import { buildBook } from './gfx/art/index.js';
import { spawnMob } from './sim/combat.js';
import { Sprites } from './gfx/sprites.js';
import { setSprites } from './ui/dom.js';
import { View } from './engine/view.js';
import { Input } from './engine/input.js';
import { AudioEngine } from './engine/audio.js';
import { Renderer } from './render/renderer.js';
import { Screens } from './ui/screens.js';
import { TitleScene } from './game/titleScene.js';
import { Game } from './game/game.js';
import { Sim } from './sim/sim.js';
import { serializeWorld, restoreWorld, saveMeta } from './sim/serialize.js';
import { presetSettings, PRESETS, OPTIONS, sanitizeSettings } from './data/difficulty.js';
import { saveWorldRecord, loadWorldRecord, listWorlds, deleteWorld, requestPersistence, lsGet, lsSet, uid } from './engine/storage.js';
import { makeBackup, parseBackup, backupFileName, MAX_BACKUP_BYTES } from './engine/backup.js';
import { strHash } from './util.js';
import { DEFAULT_LOOK } from './sim/player.js';

export const VERSION = '0.1.0';
const DEFAULT_SETTINGS = { master: 0.9, music: 0.35, sfx: 0.8, smartTools: true, screenShake: true, fadeWalls: true, showNames: true, touchControls: 'auto', leftHanded: false, uiScale: 1, zoomBias: 0, wakeLock: true, approveJoins: true, showGoals: true };

export class App {
  constructor() {
    this.version = VERSION;
    this.settings = { ...DEFAULT_SETTINGS, ...lsGet('snug.settings', {}) };
    this.profile = lsGet('snug.profile', null) || { pid: uid(), name: 'Friend', look: { ...DEFAULT_LOOK, hair: 2, hairColor: 4, outfit: 0, accessory: 1 } };
    if (!this.profile.pid) this.profile.pid = uid();
    this.game = null;
    this.last = 0;
    this.saving = false;
  }

  async boot() {
    const t0 = performance.now();
    this.canvas = document.getElementById('game');
    this.host = document.getElementById('app');
    this.saveProfile();
    this.book = buildBook();
    if (this.book.missingArt.length) console.warn('placeholder art for', this.book.missingArt);
    this.sprites = new Sprites(this.book);
    await this.sprites.prepareDom();
    setSprites(this.sprites);
    this.view = new View(this.canvas, this.host);
    this.view.bias = this.settings.zoomBias || 0; this.view.resize();
    this.input = new Input(this.canvas);
    this.audio = new AudioEngine();
    this.audio.setVolumes(this.settings.master, this.settings.sfx, this.settings.music);
    this.renderer = new Renderer(this.canvas, this.sprites, this.book);
    this.applyUiScale();
    this.screens = new Screens(this);
    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.onResize(), 200));
    // first user gesture unlocks audio (iOS requirement)
    const unlock = () => { this.audio.unlock(); };
    window.addEventListener('pointerdown', unlock, { passive: true }); window.addEventListener('keydown', unlock, { passive: true }); window.addEventListener('touchend', unlock, { passive: true });
    this.title = new TitleScene(this);
    this.showTitle();
    document.getElementById('loading').classList.add('done');
    setTimeout(() => document.getElementById('loading').remove(), 700);
    requestAnimationFrame((t) => this.loop(t));
    console.log(`Snug Isles ${VERSION} booted in ${(performance.now() - t0).toFixed(0)}ms, ${this.book.names().length} sprites`);
    window.__snug = this;
    this.dbg = { spawnMob }; // test/debug helpers (perf scene, e2e)
    this.handleUrl();
    if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !location.search.includes('nosw') && !/localhost|127\.0\.0\.1/.test(location.hostname)) navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  onResize() {
    this.view.resize();
    this.checkOrientation();
  }
  checkOrientation() {
    const portrait = window.innerHeight > window.innerWidth;
    const touch = navigator.maxTouchPoints > 0;
    document.getElementById('rotate').classList.toggle('hidden', !(portrait && touch && this.game));
  }
  applyUiScale() { document.documentElement.style.setProperty('--ui', String(this.settings.uiScale || 1)); document.getElementById('ui').style.zoom = ''; document.documentElement.style.fontSize = ''; }
  saveSettings() { lsSet('snug.settings', this.settings); }
  saveProfile() { lsSet('snug.profile', this.profile); }

  showTitle() { this.screens.title(); }

  // ------------------------------------------------------------------ url helpers (used by tests / shortcuts)
  handleUrl() {
    const q = new URLSearchParams(location.search);
    if (q.get('quick')) {
      const preset = q.get('quick') === '1' ? 'cozy' : q.get('quick');
      this.createWorld({ name: 'Test Isles', seed: q.get('seed') || 'test', settings: presetSettings(preset), mode: 'solo' });
    } else if (q.get('join')) this.screens.join(), this.joinGame(q.get('join').toUpperCase(), () => {});
  }

  // ------------------------------------------------------------------ worlds
  listWorlds() { return listWorlds(); }
  /** save a world to a file (share sheet on iPad, download on Mac) */
  async exportWorld(id) {
    const data = await loadWorldRecord(id);
    if (!data) throw new Error('That world could not be found.');
    const meta = (await listWorlds()).find((m) => m.id === id) || {};
    const text = JSON.stringify(makeBackup(data, meta, VERSION));
    const name = backupFileName(meta.name || data.name, meta.day);
    const file = new File([text], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && /iPad|iPhone|Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 0) {
      try { await navigator.share({ files: [file], title: 'Snug Isles world backup' }); return 'shared'; } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(a.href); }, 5000);
    return 'downloaded';
  }
  /** load a backup file as a NEW world (never overwrites an existing one) */
  async importWorld(file) {
    if (!file) throw new Error('No file chosen.');
    if (file.size > MAX_BACKUP_BYTES) throw new Error('That file is too big to be a Snug Isles world.');
    const { data, meta } = parseBackup(await file.text());
    const id = uid();
    const now = Date.now();
    await saveWorldRecord(id, data, { ...meta, name: (meta.name || data.name || 'Our Isles') + ' (restored)', updated: now });
    return id;
  }
  async deleteWorld(id) { await deleteWorld(id); }
  presetName(settings) {
    for (const p of PRESETS) { const ps = presetSettings(p.id); if (OPTIONS.every((o) => o.locked || settings[o.id] === ps[o.id])) return p.name; }
    return 'Custom rules';
  }

  async createWorld({ name, seed, settings, mode }) {
    const seedNum = seed ? strHash(seed) : Math.floor(Math.random() * 2 ** 31);
    const sim = Sim.create({ seed: seedNum, settings });
    sim.addPlayer(this.profile.pid, this.profile.name, this.profile.look);
    const id = uid();
    await this.beginGame(sim, { mode, saveId: id, name });
  }
  async startSaved(id, mode = 'solo') {
    const data = await loadWorldRecord(id);
    if (!data) { alert('That world could not be loaded.'); return; }
    const { sim } = restoreWorld(data);
    sim.addPlayer(this.profile.pid, this.profile.name, this.profile.look);
    await this.beginGame(sim, { mode, saveId: id, name: data.name || 'Our Isles' });
  }
  async beginGame(sim, { mode, saveId, name }) {
    if (this.game) this.game.destroy();
    this.screens.clear();
    sim.world.record = false;
    const game = new Game(this, { mode: 'solo', sim, pid: this.profile.pid, saveId, saveName: name });
    this.game = game;
    try { game.init(); } catch (e) { console.error('game init failed', e); this.game = null; try { game.destroy(); } catch (e2) { /* ignore */ } this.showTitle(); alert('Sorry, the world could not start: ' + (e && e.message)); return; }
    game.showNames = this.settings.showNames;
    this.checkOrientation();
    await this.saveWorld(game);
    requestPersistence();
    if (mode === 'host') this.startHosting(game);
  }
  /** a mirror world received from the host becomes a running (client) game */
  beginClientGame(world, link, name, ctx) {
    if (this.game) { const old = this.game; this.game = null; try { old.destroy(); } catch (e) { /* ignore */ } }
    this.screens.clear();
    const game = new Game(this, { mode: 'client', world, net: link, pid: this.profile.pid, saveName: name });
    game.joinCtx = ctx;
    this.game = game;
    try { game.init(); link.attach(game); } catch (e) { console.error('client init failed', e); this.game = null; this.showTitle(); alert('Sorry, could not enter the world: ' + (e && e.message)); return; }
    game.showNames = this.settings.showNames;
    this.checkOrientation();
    game.toast(`Joined ${link.hostName || 'your partner'}'s world!`, 'good');
    this.audio.play('join');
  }
  async saveClientCopy(data) {
    try {
      if (!data || !data.worldId) return;
      const id = 'copy-' + data.worldId;
      const w = restoreWorld(data, { withSim: false }).world;
      const meta = { name: `${data.name || 'Our Isles'} (partner copy)`, preset: this.presetName(w.settings), lands: w.ownedCount(), day: (data.day || 0) + 1, coins: data.coins, players: (data.players || []).map((p) => ({ name: p.name, level: p.level, look: p.look })), updated: Date.now(), copyOf: data.worldId };
      await saveWorldRecord(id, data, meta);
    } catch (e) { console.warn('could not save partner copy', e); }
  }
  async saveWorld(game) {
    if (!game.saveId || game.mode === 'client' || this.saving) return;
    this.saving = true;
    try {
      const data = serializeWorld(game.sim);
      data.name = game.saveName;
      const meta = saveMeta(game.sim, { name: game.saveName, preset: this.presetName(game.world.settings) });
      await saveWorldRecord(game.saveId, data, meta);
    } finally { this.saving = false; }
  }
  async quitToTitle() {
    const g = this.game;
    if (g) { try { await g.save(); } catch (e) { /* ignore */ } g.destroy(); this.game = null; }
    document.getElementById('rotate').classList.add('hidden');
    this.showTitle();
  }

  // ------------------------------------------------------------------ multiplayer (loaded on demand)
  async startHosting(game) { const m = await import('./net/session.js'); return m.startHosting(this, game); }
  async joinGame(code, onStatus) { const m = await import('./net/session.js'); return m.joinGame(this, code, onStatus); }
  async manualJoin(offer, onStatus) { const m = await import('./net/session.js'); return m.manualJoin(this, offer, onStatus); }

  // ------------------------------------------------------------------ loop
  loop(now) {
    const dt = Math.min(0.05, Math.max(0.0005, (now - (this.last || now)) / 1000));
    this.last = now;
    try {
      if (this.game) { this.game.update(dt); this.game.render(); }
      else { this.title.update(dt); this.renderer.draw(this.title); }
    } catch (e) { console.error(e); this.errCount = (this.errCount || 0) + 1; if (this.errCount > 20) return; }
    requestAnimationFrame((t) => this.loop(t));
  }
}

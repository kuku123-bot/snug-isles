// Menu backdrop: a little cottage scene at dusk, rendered by the real engine (so it doubles as an art showcase).
import { TILE } from '../util.js';
import { Sim } from '../sim/sim.js';
import { presetSettings } from '../data/difficulty.js';
import { wallCodeOf, floorCodeOf, decoCodeOf } from '../sim/world.js';
import { spawnMob } from '../sim/combat.js';
import { FX } from './fx.js';
import { renderText } from '../gfx/bitfont.js';
import { hex } from '../gfx/pixmap.js';
import { makePlayer } from '../sim/player.js';

export class TitleScene {
  constructor(app) {
    this.app = app;
    this.view = app.view; this.audio = app.audio; this.settings = app.settings;
    this.t = 0; this.camX = 0; this.camY = 0; this.cam = { x: 0, y: 0 };
    this.hover = null; this.builder = null; this.landTags = []; this.showNames = false; this.localPid = 'x'; this.fadeWalls = false; this.partnerArrow = null; this.night = 0;
    this.me = null; this.pstates = new Map();
    this.fx = new FX(this);
    this.hud = { logPickup() {} };
    this.sim = Sim.create({ seed: 20261004, settings: { ...presetSettings('dreamy'), enemyDensity: 0, weather: 0, dayLength: 480 } });
    this.world = this.sim.world;
    this.world.hooks.fx = (k, x, y, a, b, c) => this.fx.onEvent(k, x, y, a, b, c);
    this.buildScene();
  }
  pstate(pid) { let s = this.pstates.get(pid); if (!s) { s = { dir: 0, flip: false, moving: false, walkT: 0, swing: null, hurt: 0 }; this.pstates.set(pid, s); } return s; }
  makeText(str, color, outline = '#2a1f3d') {
    const pm = renderText(str, hex(color), { outline: outline.startsWith('rgba') ? null : hex(outline) });
    const c = document.createElement('canvas'); c.width = pm.w; c.height = pm.h;
    c.getContext('2d').putImageData(new ImageData(pm.bytes(), pm.w, pm.h), 0, 0);
    return c;
  }

  buildScene() {
    const w = this.world;
    const [ox, oy] = w.landOrigin(w.gw >> 1, w.gw >> 1);
    const cx = ox + 10, cy = oy + 10;
    this.cx = cx; this.cy = cy;
    // clear resources from the stage area so the scene is composed deliberately
    for (const t of [...w.things.values()]) { if (t.x >= cx - 11 && t.x <= cx + 9 && t.y >= cy - 8 && t.y <= cy + 8) w.removeThing(t.id, true); }
    const wall = (x, y, id, st = 0) => w.setWall(x, y, wallCodeOf(id), st, true);
    const floor = (x, y, id) => w.setFloor(x, y, floorCodeOf(id), true);
    const thing = (id, x, y, flip = false) => w.addThing(id, x, y, { flip, silent: true });
    // house: x 6..14 (9 wide), y 5..10 (6 tall), door at front center
    const hx0 = cx - 7, hy0 = cy - 6, hw = 9, hh = 6;
    for (let y = hy0; y < hy0 + hh; y++) for (let x = hx0; x < hx0 + hw; x++) {
      const edge = x === hx0 || y === hy0 || x === hx0 + hw - 1 || y === hy0 + hh - 1;
      if (edge) wall(x, y, 'wall_plaster'); else floor(x, y, ((x + y) % 2) ? 'floor_parquet' : 'floor_parquet');
    }
    wall(hx0 + 4, hy0 + hh - 1, 'door_plaster', 1);
    wall(hx0 + 2, hy0 + hh - 1, 'window_plaster'); wall(hx0 + 6, hy0 + hh - 1, 'window_plaster');
    wall(hx0 + 2, hy0, 'window_plaster'); wall(hx0 + 6, hy0, 'window_plaster');
    wall(hx0, hy0 + 3, 'window_plaster');
    w.setDeco(hx0 + 2, hy0, decoCodeOf('curtains_pink'), true); w.setDeco(hx0 + 6, hy0, decoCodeOf('curtains_pink'), true);
    w.setDeco(hx0 + 4, hy0, decoCodeOf('painting_meadow'), true); w.setDeco(hx0 + 1, hy0 + hh - 1, decoCodeOf('wreath'), true);
    for (let y = hy0 + 1; y < hy0 + hh - 1; y++) for (let x = hx0 + 1; x < hx0 + hw - 1; x++) if (x >= hx0 + 3 && x <= hx0 + 5 && y >= hy0 + 2 && y <= hy0 + 4) floor(x, y, 'floor_carpet_pink');
    thing('cottage_bed', hx0 + 1, hy0 + 1);
    thing('cottage_nightstand', hx0 + 2, hy0 + 2);
    thing('cottage_lamp', hx0 + 2, hy0 + 1);
    thing('cottage_bookshelf', hx0 + 6, hy0 + 1);
    thing('cottage_table_round', hx0 + 4, hy0 + 3);
    thing('cottage_chair', hx0 + 3, hy0 + 3); thing('cottage_chair', hx0 + 5, hy0 + 3, true);
    thing('plant_fern', hx0 + 7, hy0 + 1); thing('plant_flowerpot', hx0 + 7, hy0 + 4);
    thing('fireplace', hx0 + 5, hy0 + 1);
    // garden
    for (let x = hx0 - 1; x < hx0 + hw + 1; x++) if (x < hx0 + 3 || x > hx0 + 5) wall(x, hy0 + hh + 2, 'fence_picket');
    wall(hx0 + 4, hy0 + hh + 2, 'gate_picket');
    for (let y = hy0 + hh; y < hy0 + hh + 2; y++) { wall(hx0 - 1, y, 'fence_picket'); wall(hx0 + hw, y, 'fence_picket'); }
    floor(hx0 + 4, hy0 + hh, 'floor_cobble'); floor(hx0 + 4, hy0 + hh + 1, 'floor_cobble'); floor(hx0 + 4, hy0 + hh + 2, 'floor_cobble'); floor(hx0 + 4, hy0 + hh + 3, 'floor_cobble');
    thing('flower_bed', hx0 + 1, hy0 + hh); thing('flower_bed', hx0 + 2, hy0 + hh); thing('flower_bed', hx0 + 6, hy0 + hh); thing('flower_bed', hx0 + 7, hy0 + hh);
    thing('lantern_post', hx0 + 3, hy0 + hh + 1); thing('lantern_post', hx0 + 5, hy0 + hh + 1);
    thing('oak', hx0 - 2, hy0 + 1); thing('oak', hx0 + hw + 1, hy0);
    // campfire corner
    const fx = hx0 + hw + 3, fy = hy0 + 4;
    thing('campfire', fx, fy); thing('bench', fx - 1, fy + 1); thing('log_pile', fx + 2, fy - 1); thing('barrel', fx + 2, fy + 1); thing('plant_sunflower', fx + 1, fy + 2);
    thing('tent', fx + 2, fy - 3);
    thing('mailbox', hx0 + hw + 1, hy0 + hh + 1);
    // two friends sitting by the fire
    const a = makePlayer(w, 'a', 'Mochi', { skin: 1, hair: 2, hairColor: 4, outfit: 0, accessory: 1 });
    const b = makePlayer(w, 'b', 'Pip', { skin: 2, hair: 0, hairColor: 1, outfit: 1, accessory: 0 });
    a.id = 9001; b.id = 9002; a.online = b.online = true;
    a.x = (fx - 0.9) * TILE; a.y = (fy + 2) * TILE - 3; b.x = (fx + 1.5) * TILE; b.y = (fy + 2) * TILE - 3;
    a.sit = { id: 0 }; b.sit = { id: 0 };
    w.players.set('a', a); w.players.set('b', b);
    this.pstate('a').dir = 1; this.pstate('b').dir = 1; // facing the fire
    this.pstate('a').dir = 2; this.pstate('a').flip = false; this.pstate('b').dir = 2; this.pstate('b').flip = true;
    // critters
    this.bunny = spawnMob(this.sim, 'bunny', (hx0 - 3) * TILE, (hy0 + hh + 3) * TILE);
    this.chick = spawnMob(this.sim, 'chick', (hx0 + 10) * TILE, (hy0 + hh + 3) * TILE);
    w.time = w.settings.dayLength * 0.665;
    this.camBase = { x: (cx - 1.5) * TILE, y: (cy - 1.2) * TILE };
    this.fireX = (fx + 0.5) * TILE; this.fireY = fy * TILE;
    this.world.tileDirty.length = 0;
  }

  update(dt) {
    this.t += dt;
    const w = this.world;
    w.time = w.settings.dayLength * (0.652 + 0.03 * (0.5 + 0.5 * Math.sin(this.t * 0.05)));
    this.sim.update(dt);
    w.time = w.settings.dayLength * (0.652 + 0.03 * (0.5 + 0.5 * Math.sin(this.t * 0.05)));
    for (const m of w.mobs.values()) { m.rx = m.x; m.ry = m.y; m.moving = m.st === 'wander' || m.st === 'run'; }
    this.fx.update(dt);
    if (Math.random() < dt * 4) this.fx.burst(this.fireX, this.fireY - 2, 1, ['#ffb347', '#ff7a3d', '#ffe066'], { speed: 8, up: 26, grav: -30, life: 0.8, size: 1, spread: 4 });
    const k = this.t * 0.08;
    const landscape = this.view.w / this.view.h > 1.2;
    const shift = landscape ? this.view.w * 0.2 : 0; // leave room for the menu column on the left
    this.cam.x = this.camBase.x - this.view.w / 2 - shift + Math.sin(k) * 18; this.cam.y = this.camBase.y - this.view.h / 2 + Math.cos(k * 0.8) * 8 - (landscape ? 0 : 36);
    this.camX = Math.round(this.cam.x); this.camY = Math.round(this.cam.y);
  }
}

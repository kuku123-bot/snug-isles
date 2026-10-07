// In-game menus: pause, settings, help, rules editor, emote wheel, fainted overlay.
import { h, ic, clear, itemIc } from '../dom.js';
import { optionsEditor } from '../options.js';
import { sanitizeSettings } from '../../data/difficulty.js';
import { openZoomFix } from '../zoomfix.js';

export function pausePanel(g, data, ui) {
  if (g.mode === 'solo') g.paused = true;
  const b = (label, icon, fn, cls = '') => h('button', { class: 'btn ' + cls, style: 'width:100%;font-size:19px;justify-content:flex-start', onclick: () => { g.audio.play('click'); fn(); } }, ic(icon, 2), label);
  const body = h('div', { class: 'col', style: 'min-width:min(80vw,320px);gap:10px' },
    b('Back to the game', 'ui_check', () => ui.close(), 'good'),
    b('Island goals', 'ui_star', () => ui.open('goals')),
    b('Take a photo', 'ui_smile', () => { ui.close(); setTimeout(() => g.photo(), 120); }),
    b('How to play', 'ui_book', () => ui.open('help')),
    b('Settings', 'ui_gear', () => ui.open('settings')),
    b('Fix zoom', 'ui_plus', () => openZoomFix(g.app)),
    g.mode !== 'client' ? b('World rules', 'ui_sword', () => ui.open('rules')) : null,
    b(g.mode === 'solo' ? 'Play together' : g.mode === 'host' ? 'Invite / players' : 'Connection', 'ui_people', () => ui.open('mp'), 'blue'),
    g.mode !== 'client' ? b('Save now', 'ui_bag', () => { g.save().then(() => g.toast('Saved!', 'good')); }) : null,
    b(g.mode === 'client' ? 'Leave world' : 'Save & quit to title', 'ui_cross', () => { g.app.quitToTitle(); }, 'red'));
  return { title: g.saveName || 'Paused', icon: 'ui_gear', body, onClose: () => { if (g.mode === 'solo') g.paused = false; }, sig: () => '' };
}

export function settingsPanel(g, data, ui) {
  const s = g.settings, app = g.app;
  const slider = (label, key, apply) => h('div', { class: 'field' }, h('label', null, label), h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: s[key], oninput: (e) => { s[key] = +e.target.value; apply && apply(); app.saveSettings(); } }));
  const toggle = (label, key, desc, after) => {
    const el = h('div', { class: 'row', style: 'cursor:pointer;padding:4px 0', onclick: () => { s[key] = !s[key]; app.saveSettings(); after && after(); redraw(); } }, h('div', { class: 'grow' }, h('b', null, label), desc ? h('div', { class: 'small muted' }, desc) : null), h('div', { class: 'seg', style: 'min-width:92px' }, h('button', { class: s[key] ? '' : 'on' }, 'Off'), h('button', { class: s[key] ? 'on' : '' }, 'On')));
    return el;
  };
  const choice = (label, key, opts, after) => h('div', { class: 'field' }, h('label', null, label), h('div', { class: 'seg' }, ...opts.map(([v, l]) => h('button', { class: s[key] === v ? 'on' : '', onclick: () => { s[key] = v; app.saveSettings(); after && after(); redraw(); } }, l))));
  const body = h('div', { class: 'col scroll', style: 'max-height:66vh;min-width:min(86vw,420px);gap:10px' });
  function redraw() {
    clear(body);
    body.append(
      slider('Master volume', 'master', () => app.audio.setVolumes(s.master, s.sfx, s.music)), slider('Music', 'music', () => app.audio.setVolumes(s.master, s.sfx, s.music)), slider('Sound effects', 'sfx', () => app.audio.setVolumes(s.master, s.sfx, s.music)),
      h('div', { class: 'sep' }),
      toggle('Smart tools', 'smartTools', 'Automatically picks the best pickaxe / sword / bow for what you hit.'),
      toggle('See-through walls', 'fadeWalls', 'Walls near you fade so you never get hidden behind them.'),
      toggle('Goal tracker', 'showGoals', 'Shows the next Island Goal in the corner.', () => g.hud && g.hud.refreshGoal && g.hud.refreshGoal()), toggle('Guide arrow', 'showGuide', 'A bobbing arrow that points at what the next goal needs.'), toggle('Screen shake', 'screenShake'), toggle('Name tags', 'showNames', null, () => { g.showNames = s.showNames; }),
      choice('Touch controls', 'touchControls', [['auto', 'Auto'], ['on', 'Always'], ['off', 'Never']], () => g.touch.layout()),
      toggle('Left-handed layout', 'leftHanded', 'Swap the joystick and buttons.', () => g.touch.layout()),
      choice('Picture', 'look', [['smooth', 'Smooth'], ['soft', 'Soft'], ['pixel', 'Pixel']], () => app.applyLook()),
      choice('Zoom', 'zoomBias', [[-1, 'Out'], [0, 'Normal'], [1, 'In'], [2, 'Closer']], () => { g.view.bias = s.zoomBias; g.view.resize(); }),
      choice('Menu size', 'uiScale', [[0.9, 'Small'], [1, 'Normal'], [1.15, 'Large'], [1.3, 'Huge']], () => app.applyUiScale()),
      h('div', { class: 'field' }, h('label', null, 'Screen zoomed by accident?'), h('button', { class: 'btn warn', onclick: () => openZoomFix(app) }, ic('ui_plus', 1), 'Fix zoom')),
      toggle('Keep screen awake', 'wakeLock', 'Stops the iPad from sleeping while you play.'),
      toggle('Ask before new players join', 'approveJoins', 'When you host: someone new using your room code must be let in by you first.'));
  }
  redraw();
  return { title: 'Settings', icon: 'ui_gear', body, sig: () => '' };
}

export function helpPanel(g, data, ui) {
  const row = (k, t) => h('div', { class: 'row small', style: 'align-items:flex-start' }, h('span', { class: 'chip', style: 'min-width:92px;justify-content:center;font-weight:700' }, k), h('span', null, t));
  const body = h('div', { class: 'col scroll', style: 'max-height:66vh;min-width:min(88vw,520px);gap:6px' },
    h('b', { style: 'font-size:18px' }, 'Keyboard & mouse (Mac)'),
    row('WASD', 'Move'), row('Mouse', 'Aim; hold left-click to mine, chop, fight'), row('Space', 'Dash'), row('E / F', 'Interact (open, sit, lie down, open doors). On a seat or bed it gets you up again'), row('1-8 / Wheel', 'Choose hotbar item'),
    row('I · C · B', 'Bag · Craft · Build'), row('T · K · M', 'Research · Skills · Map'), row('R / Shift+R', 'Turn the piece you are placing (the wheel does too). Everything turns in quarter turns: stations, chests, lamps, windows, doors, floors...'), row('X', 'Remove tool: pieces, berry bushes, opened chests, stumps'), row('V', 'Paint tool: color anything you built'), row('Drag', 'Move items between bag slots, onto the hotbar, onto Wearing, into chests'), row('G', 'Emotes'), row('P', 'Take a photo of what you see'), row('Esc', 'Menu'),
    h('div', { class: 'sep' }), h('b', { style: 'font-size:18px' }, 'Touch (iPad)'),
    row('Left thumb', 'Drag anywhere in the lower-left to walk'), row('Big button', 'Hold to mine / chop / fight (it auto-aims!)'), row('Hand button', 'Interact with what is nearby'), row('Tap things', 'Tap doors, chests, stations, animals, and land tags'),
    row('Building', 'Pick a piece: a see-through preview shows where it goes (green fits, red says why not). Walls and floors: tap or drag, "Rect" fills whole rooms. Furniture: slide the preview, tap Rotate to turn it, then Place. Color: pick any color you like before you build, or use the Paint brush on pieces already standing (free). Pick copies the color of a piece.'),
    row('Moving items', 'Drag an item in the bag onto another slot or onto the hotbar. (Tap an item, then tap where it goes, works too.)'),
    row('Critters', 'Bunnies, chicks and other wild critters can be hunted: hit one with a sword or pickaxe while aimed at it. Pets you hatched can never be hurt.'),
    h('div', { class: 'sep' }), h('b', { style: 'font-size:18px' }, 'Tips'),
    h('div', { class: 'small' }, '• Chop trees and mine rocks, craft a Workbench, then sell goods at a Market Stall (or a Marketplace) to buy new lands (follow the glowing price tags).'),
    h('div', { class: 'small' }, '• Build a Research Table to unlock a huge tech tree: new tools, furniture sets, automation and more. Pick a branch, tap a box to read about it: yellow boxes are ready, green ones are done.'),
    h('div', { class: 'small' }, '• Screen suddenly too big or too small? Pause menu (or Settings) → Fix zoom.'),
    h('div', { class: 'small' }, '• Every level gives a skill point for the Skills tree: tap a box and press Learn. New boxes open up as you learn the ones before them.'),
    h('div', { class: 'small' }, '• Enclose a room with walls & a door, add furniture, and your Cozy bonus grows. Lie down in a bed any time to rest (it also becomes your respawn point); at night, sleeping skips the night. Chairs, sofas and benches seat one person per cushion.'),
    h('div', { class: 'small' }, '• Lost? The NEXT card (top left) shows the one thing to do now, and the pink arrow points at it. Menu → Guide arrow turns the arrow off.'),
    h('div', { class: 'small' }, '• Research Explosives for bombs: tap with a bomb in your hand to throw it. Bombs break rocks, hurt monsters and open cracked boulders (treasure inside!). They never hurt you or your buildings. Frost bombs freeze monsters, fire bombs burn them, and fireworks are just for fun.'),
    h('div', { class: 'small' }, '• Bosses: build an altar (Spore, Sun, Frost, Bone, Magma, Crystal, Void, or the Slime Altar), put the offering in your bag and press E. Watch for the red ! - it means an attack is coming. A shiny Golden Slime now and then runs from you: catch it for treasure!'),
    h('div', { class: 'small' }, '• Lighthouses: everything growing inside the glowing circle gives more, grows back faster, and now and then a new resource pops up. Little Lighthouse (Seaside research), Lighthouse (Optics) and Grand Lighthouse (crystal age). Lighthouses stack up: build them with overlapping circles for even more. The circle shows while you stand near one.'),
    h('div', { class: 'small' }, '• Marketplace (research Trade, then Marketplace): press E to buy a fresh random selection every day, or sell your things for 10% more. "New goods" costs a few coins if you want another look.'),
    h('div', { class: 'small' }, '• Game too slow or too fast? Pause menu → World rules → Game pace.'),
    h('div', { class: 'small' }, '• Every slot holds up to 9999. The Pack Mule skill adds bag slots and Warehouse Keeper makes every chest bigger, for both of you.'),
    h('div', { class: 'small' }, '• Nearby chests count as part of your bag when crafting and building. Machines next to a chest load themselves.'));
  return { title: 'How to play', icon: 'ui_book', body, sig: () => '' };
}

export function rulesPanel(g, data, ui) {
  const w = g.world;
  const ed = optionsEditor(w.settings, { lockLocked: true, onChange: (s) => { Object.assign(w.settings, sanitizeSettings({ ...w.settings, ...s })); if (g.net) g.net.broadcastSettings(); } });
  const body = h('div', { class: 'scroll', style: 'max-height:68vh;min-width:min(90vw,640px)' }, ed.el);
  return { title: 'World rules', icon: 'ui_sword', body, sig: () => '' };
}

export function emotePanel(g, data, ui) {
  const list = [['heart', 0], ['bang', 1], ['ask', 2], ['note', 3], ['star', 4], ['sweat', 5], ['zzz', 6], ['happy', 7]];
  const body = h('div', { class: 'row', style: 'gap:10px;flex-wrap:wrap;justify-content:center;min-width:min(80vw,380px)' }, ...list.map(([n, i]) => h('div', { class: 'hbtn', style: 'width:64px;height:64px', onclick: () => { g.cmd({ c: 'emote', e: i }); ui.close(); } }, ic('emote_' + n, 4))));
  return { title: 'Emote', icon: 'ui_smile', body, sig: () => '' };
}

export function deadPanel(g, data, ui) {
  const el = h('div', { class: 'scrim clear' }, h('div', { class: 'panel', style: 'position:absolute;top:24%;left:50%;transform:translateX(-50%);text-align:center;pointer-events:none;padding:14px 26px' }, h('h2', null, 'You fainted…'), h('div', null, 'You will wake up in a moment.')));
  const p = { title: '', shell: el, passive: true, sig: () => '', tick: () => { const me = g.me; if (me && me.dead <= 0) ui.close(true); } };
  return p;
}

export function lostPanel(g, data, ui) {
  const st = data.state;
  const msg = h('div', { style: 'font-size:18px;text-align:center;min-height:50px' });
  const btns = h('div', { class: 'row', style: 'justify-content:center;flex-wrap:wrap' });
  function render() {
    msg.textContent = st.msg;
    clear(btns);
    if (st.final) {
      btns.append(h('div', { class: 'small muted', style: 'width:100%;text-align:center' }, 'A copy of the world is saved on this device. You can host it yourself from Play together → Host a world.'),
        st.canRetry && st.retry ? h('button', { class: 'btn good', onclick: () => st.retry() }, ic('ui_link', 2), 'Try again') : null,
        h('button', { class: 'btn red', onclick: () => g.app.quitToTitle() }, ic('ui_cross', 2), 'Back to title'));
    } else btns.append(h('button', { class: 'btn', onclick: () => { st.stop = true; g.app.quitToTitle(); } }, 'Leave'));
  }
  render();
  const body = h('div', { class: 'col', style: 'min-width:min(86vw,360px);gap:12px' }, msg, btns);
  return { title: 'Connection lost', icon: 'ui_link', body, noClose: true, noScrimClose: true, sig: () => `${st.msg}:${st.final}:${st.tries}`, refresh: render };
}

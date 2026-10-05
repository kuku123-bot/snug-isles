// "Fix zoom": one small dialog for every kind of zoom trouble. A web page cannot change the browser's own page zoom (no browser allows
// that), so this undoes what the page CAN undo (pinch / double-tap zoom, the game's own zoom and menu size) and says exactly what to
// press for the rest. Opened from the title screen, the pause menu and Settings.
import { h, ic } from './dom.js';
import { forceResetZoom } from '../engine/nozoom.js';

export function openZoomFix(app) {
  if (document.getElementById('zoomfix')) return;
  const touch = navigator.maxTouchPoints > 0, ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const status = h('div', { class: 'zf-status small', role: 'status' }, 'Pinching or double-tapping can zoom the page. These put everything back.');
  const done = (msg) => { status.textContent = msg; status.className = 'zf-status small ok'; app.game && app.game.toast ? app.game.toast(msg, 'good') : 0; };
  const close = () => { el.remove(); window.removeEventListener('keydown', onKey, true); };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  const reset = h('button', { class: 'btn good big', onclick: () => { const was = forceResetZoom(); done(was > 1.01 ? 'Zoom reset! The screen is back to normal.' : 'Zoom reset. If it still looks too big or too small, try the steps below.'); } }, ic('ui_check', 2), 'Reset zoom now');
  const normal = h('button', { class: 'btn warn', onclick: () => {
    const s = app.settings; s.zoomBias = 0; s.uiScale = 1; app.saveSettings();
    app.view.bias = 0; app.view.resize(); app.applyUiScale();
    done('Game zoom and menu size are back to normal.');
  } }, ic('ui_house', 1), 'Game zoom and menu size back to normal');
  const steps = h('div', { class: 'zf-steps small' },
    h('b', null, 'Still too big or too small? Then the browser’s own page zoom is on:'),
    ...(ios || touch ? [h('div', null, h('b', null, 'iPad / iPhone (Safari or Brave): '), 'tap ', h('b', null, 'aA'), ' next to the address bar and set the page to ', h('b', null, '100%'), '. In Brave also check Settings → Default page zoom.')] : []),
    h('div', null, h('b', null, 'Mac / Windows: '), 'press ', h('b', null, 'Cmd+0'), ' (', h('b', null, 'Ctrl+0'), ' on Windows), or use the browser menu → Zoom → Reset.'),
    h('div', null, h('b', null, 'Best fix: '), 'open the game in ', h('b', null, 'Safari'), ' → Share → ', h('b', null, 'Add to Home Screen'), '. It then runs as a full-screen app with no browser zoom at all.'));
  const win = h('div', { class: 'panel zf-win' },
    h('div', { class: 'row' }, h('h2', { class: 'grow', style: 'font-size:24px' }, 'Fix the zoom'), h('div', { class: 'xbtn', title: 'Close', onclick: close }, ic('ui_cross', 2))),
    status, reset, normal, steps, h('button', { class: 'btn', onclick: close }, 'Done'));
  const el = h('div', { id: 'zoomfix', class: 'zf-scrim', onclick: (e) => { if (e.target === el) close(); } }, win);
  window.addEventListener('keydown', onKey, true);
  document.getElementById('app').appendChild(el);
  reset.focus && reset.focus({ preventScroll: true });
}

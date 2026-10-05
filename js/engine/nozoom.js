// A game must never zoom the page. iOS Safari ignores `user-scalable=no`, so every route to a zoom is closed here:
// pinch (Safari's gesture events, trackpad pinch), browser zoom shortcuts, double-tap (CSS touch-action plus a script guard), and focus-zoom on form
// fields (CSS font sizes >= 16px). Two-thumb play is untouched: only the end of a quick second tap is ever cancelled. If the page somehow ends up zoomed anyway it is snapped back.
const VIEWPORT = 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';

export function lockZoom() {
  const opt = { passive: false };
  // Safari (iPad and Mac): pinch arrives as gesture events
  for (const t of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(t, (e) => e.preventDefault(), opt);
  // Chrome/Edge/Firefox: trackpad pinch and ctrl+wheel arrive as wheel events with ctrlKey
  window.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, opt);
  // browser zoom shortcuts (the game's own +/- keys, without Ctrl/Cmd, still work). Ctrl/Cmd+0 is left alone on purpose: it only puts the
  // browser back to its normal size, so if a browser (Brave, Chrome...) remembers a zoomed level for this site it is the way back out
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '_'].includes(e.key)) e.preventDefault();
  }, opt);
  // double-tap zoom: CSS touch-action should stop it, but iOS browsers built on WKWebView (Brave, Chrome, Edge...) can still zoom on a quick
  // second tap. Cancelling the end of the second tap of a quick pair is what stops it; the page then gets its click by hand, so tapping one
  // button twice fast still counts twice. Drags, text fields and multi-finger touches are left alone (double-tap selects a word in a field).
  let startX = 0, startY = 0, startT = 0, multi = false, lastEnd = -1e9, lastX = 0, lastY = 0;
  document.addEventListener('touchstart', (e) => { const t = e.touches[0]; multi = e.touches.length > 1; startX = t.clientX; startY = t.clientY; startT = e.timeStamp; }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (e.touches.length || !e.changedTouches.length) return;
    const t = e.changedTouches[0], el = e.target;
    const tap = !multi && e.timeStamp - startT < 400 && Math.hypot(t.clientX - startX, t.clientY - startY) < 14;
    const quick = e.timeStamp - lastEnd < 350 && Math.hypot(t.clientX - lastX, t.clientY - lastY) < 70;
    if (tap) { lastEnd = e.timeStamp; lastX = t.clientX; lastY = t.clientY; } else lastEnd = -1e9;
    if (!tap || !quick || !e.cancelable) return;
    if (el && el.closest && el.closest('input, textarea, select, [contenteditable]')) return;
    e.preventDefault();
    if (el && el.dispatchEvent) el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, clientX: t.clientX, clientY: t.clientY }));
  }, opt);
  // after the on-screen keyboard closes iOS can leave the page nudged or zoomed: put it back
  document.addEventListener('focusout', () => setTimeout(() => { window.scrollTo(0, 0); resetIfZoomed(); }, 120));
  // safety net: if the visual viewport is ever zoomed (a browser that ignored all of the above), snap back
  const vv = window.visualViewport;
  if (vv) { vv.addEventListener('resize', resetIfZoomed); vv.addEventListener('scroll', () => { if (vv.scale <= 1.001) return; resetIfZoomed(); }); }
}

/** the "Fix zoom" button: undo any pinch / double-tap zoom right now (a page cannot change the browser's own page zoom, see ui/zoomfix.js). Returns the zoom it found. */
export function forceResetZoom() {
  const vv = window.visualViewport, was = vv ? vv.scale : 1;
  const m = document.querySelector('meta[name=viewport]');
  if (m) {
    m.setAttribute('content', VIEWPORT.replace('maximum-scale=1,', 'maximum-scale=1.0001,')); // changing the string makes Safari re-apply the viewport, which resets pinch zoom
    requestAnimationFrame(() => m.setAttribute('content', VIEWPORT));
  }
  window.scrollTo(0, 0);
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  setTimeout(() => window.dispatchEvent(new Event('resize')), 80); // the game re-measures the screen
  return was;
}

function resetIfZoomed() {
  const vv = window.visualViewport;
  if (!vv || vv.scale <= 1.01) return;
  const m = document.querySelector('meta[name=viewport]');
  if (!m) return;
  // changing the viewport string makes Safari re-apply it, which resets the zoom
  m.setAttribute('content', VIEWPORT.replace('maximum-scale=1,', 'maximum-scale=1.0001,'));
  requestAnimationFrame(() => m.setAttribute('content', VIEWPORT));
}

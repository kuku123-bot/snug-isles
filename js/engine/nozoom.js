// A game must never zoom the page. iOS Safari ignores `user-scalable=no`, so every route to a zoom is closed here:
// pinch (Safari's gesture events, trackpad pinch), browser zoom shortcuts, double-tap (CSS touch-action), and focus-zoom on form
// fields (CSS font sizes >= 16px). Two-thumb play is untouched: touches themselves are never cancelled. If the page somehow ends up zoomed anyway it is snapped back.
const VIEWPORT = 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';

export function lockZoom() {
  const opt = { passive: false };
  // Safari (iPad and Mac): pinch arrives as gesture events
  for (const t of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(t, (e) => e.preventDefault(), opt);
  // Chrome/Edge/Firefox: trackpad pinch and ctrl+wheel arrive as wheel events with ctrlKey
  window.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, opt);
  // browser zoom shortcuts (the game's own +/- keys, without Ctrl/Cmd, still work)
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '_', '0'].includes(e.key)) e.preventDefault();
  }, opt);
  // after the on-screen keyboard closes iOS can leave the page nudged or zoomed: put it back
  document.addEventListener('focusout', () => setTimeout(() => { window.scrollTo(0, 0); resetIfZoomed(); }, 120));
  // safety net: if the visual viewport is ever zoomed (a browser that ignored all of the above), snap back
  const vv = window.visualViewport;
  if (vv) { vv.addEventListener('resize', resetIfZoomed); vv.addEventListener('scroll', () => { if (vv.scale <= 1.001) return; resetIfZoomed(); }); }
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

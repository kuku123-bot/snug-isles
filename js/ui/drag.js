// Dragging items between slots: pick a stack up with the mouse or a finger and drop it on another slot (bag, hotbar, wearing, chests, machines).
// One set of listeners for the whole page, because slots are rebuilt all the time: any element marked data-ref='{"k":"p","i":3}' (see slotEl and
// the hotbar) is both something to pick up and somewhere to drop. A short press without moving is still a tap, so selecting and using keep working.
// The simulation decides what a drop does (move, merge or swap); the highlight here is only a hint.
import { h, itemIc, hideTip } from './dom.js';
import { ITEMS, fuelValue } from '../data/items.js';
import { BUILD } from '../data/build.js';
import { processRecipes } from '../sim/machines.js';

const START = { mouse: 5, pen: 7, touch: 9 }; // px a pointer must travel before a press becomes a drag
const TOUCH_LIFT = 40; // a finger covers the item: its picture rides this far above the fingertip
const st = { g: null, bound: false, arm: null, drag: null, quiet: 0, epoch: 0 };

/** bumps whenever a drag finishes (panels use it to clear their selection) */
export const dragEpoch = () => st.epoch;
export const refKey = (ref) => JSON.stringify(ref);
/** is this the slot being dragged right now? (a rebuilt slot uses it to stay dimmed) */
export const isLifted = (ref) => !!st.drag && st.drag.key === refKey(ref);

/** the stack a slot reference points at, in the world as this screen has it */
export function stackAt(g, ref) {
  const p = g.me, w = g.world;
  if (!p || !ref) return null;
  if (ref.k === 'p') return p.inv[ref.i] || null;
  if (ref.k === 'e') return p.equip[ref.slot] || null;
  const t = w.things.get(ref.id);
  if (!t || !t.s) return null;
  if (ref.k === 't') return (t.s.inv && t.s.inv[ref.i]) || null;
  if (ref.k === 'm') return t.s[ref.f] || null;
  return null;
}

/** would this stack be accepted by that slot? (the same rules the simulation applies; it has the last word) */
export function canDrop(g, ref, stack) {
  const it = ITEMS[stack.id];
  if (!it) return false;
  if (ref.k === 'e') return (ref.slot === 'charm' && !!it.charm) || it.armor === ref.slot;
  if (ref.k === 'p') return true;
  const t = g.world.things.get(ref.id), def = t && BUILD[t.type];
  if (!def) return false;
  if (ref.k === 't') return !(def.conf && def.conf.foodOnly) || !!(it.food || it.fish);
  if (ref.k === 'm') {
    if (ref.f === 'out') return false;
    if (ref.f === 'inp') return processRecipes(g.world, def.conf.kind).some((r) => r.input === stack.id);
    return fuelValue(stack.id) > 0 && !def.conf.noFuel;
  }
  return false;
}

const slotUnder = (x, y) => { const el = document.elementFromPoint(x, y); return el && el.closest ? el.closest('.slot[data-ref]') : null; };
const parse = (el) => { try { return JSON.parse(el.dataset.ref); } catch (e) { return null; } };
const aim = (d, e) => [e.clientX, e.clientY - (d.type === 'touch' ? TOUCH_LIFT : 0)]; // where the picture is, which is where a drop lands

function mark(d, el, how) {
  if (d.over && d.over !== el && d.over.isConnected) delete d.over.dataset.drop;
  d.over = el;
  if (el) { if (how) el.dataset.drop = how; else delete el.dataset.drop; }
}
function lift(ref, on) {
  for (const el of document.querySelectorAll('.slot[data-ref]')) if (el.dataset.ref === refKey(ref)) { if (on) el.dataset.lift = '1'; else delete el.dataset.lift; }
}

function begin(a) {
  const g = st.g, stack = stackAt(g, a.ref);
  if (!stack) { st.arm = null; return; }
  const n = stack.n > 1 ? h('span', { class: 'n' + (stack.n >= 1000 ? ' n4' : stack.n >= 100 ? ' n3' : '') }, stack.n) : null;
  const ghost = h('div', { class: 'slot drag-ghost' }, itemIc(stack.id, 2), n);
  document.body.appendChild(ghost);
  st.drag = { id: a.id, type: a.type, ref: a.ref, key: refKey(a.ref), stack, ghost, over: null };
  st.arm = null;
  document.body.classList.add('dragging');
  hideTip();
  lift(a.ref, true);
  g.audio.play('click', { vol: 0.4 });
}
function move(e) {
  const d = st.drag;
  d.ghost.style.transform = `translate(${Math.round(e.clientX - 24)}px, ${Math.round(e.clientY - 24 - (d.type === 'touch' ? TOUCH_LIFT : 0))}px) scale(1.12)`;
  const [x, y] = aim(d, e), el = slotUnder(x, y), ref = el && parse(el);
  if (!ref || el.dataset.ref === refKey(d.ref)) return mark(d, null, null);
  mark(d, el, canDrop(st.g, ref, d.stack) ? 'ok' : 'no');
}
function end(drop, e) {
  const d = st.drag, g = st.g;
  if (!d) return;
  const el = drop ? slotUnder(...aim(d, e)) : null, to = el && parse(el);
  mark(d, null, null);
  lift(d.ref, false);
  d.ghost.remove();
  st.drag = null; st.arm = null;
  document.body.classList.remove('dragging');
  st.quiet = performance.now() + 150; // the click that follows the release must not select or use the slot
  st.epoch++;
  if (!to || refKey(to) === d.key) return;
  if (!canDrop(g, to, d.stack)) { g.audio.play('error', { vol: 0.5 }); g.toast('That does not go there.', 'info'); return; }
  g.cmd({ c: 'inv', op: 'move', from: d.ref, to, n: 0 });
  g.audio.play('click', { vol: 0.6 });
}

export function initDrag(g) {
  st.g = g;
  if (st.bound) return;
  st.bound = true;
  const cap = { capture: true };
  document.addEventListener('pointerdown', (e) => {
    if (st.drag) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const el = e.target.closest && e.target.closest('.slot[data-ref]');
    if (!el) return;
    const ref = parse(el);
    if (ref && stackAt(st.g, ref)) st.arm = { id: e.pointerId, type: e.pointerType, x: e.clientX, y: e.clientY, ref };
  }, cap);
  window.addEventListener('pointermove', (e) => {
    const a = st.arm;
    if (a && !st.drag && e.pointerId === a.id && Math.hypot(e.clientX - a.x, e.clientY - a.y) >= (START[a.type] || 7)) begin(a);
    if (st.drag && e.pointerId === st.drag.id) move(e);
  }, cap);
  window.addEventListener('pointerup', (e) => {
    if (st.arm && e.pointerId === st.arm.id) st.arm = null;
    if (st.drag && e.pointerId === st.drag.id) end(true, e);
  }, cap);
  window.addEventListener('pointercancel', (e) => {
    if (st.arm && e.pointerId === st.arm.id) st.arm = null;
    if (st.drag && e.pointerId === st.drag.id) end(false, e);
  }, cap);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && st.drag) { e.stopPropagation(); e.preventDefault(); end(false); } }, cap);
  window.addEventListener('blur', () => { if (st.drag) end(false); st.arm = null; });
  document.addEventListener('click', (e) => { if (st.quiet > performance.now()) { st.quiet = 0; e.stopPropagation(); e.preventDefault(); } }, cap);
}

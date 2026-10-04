// Multiplayer session glue: hosting a world, joining one, reconnecting, and keeping a backup copy of the world.
import { HostLink } from './host.js';
import { ClientLink } from './client.js';
import { restoreWorld } from '../sim/serialize.js';
import { openHostPeer, connectToHost, manualHostOffer, manualGuestAnswer } from './transport.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------------ hosting
export async function startHosting(app, game) {
  if (game.net) { game.ui.open('mp'); return; }
  const sim = game.sim;
  const st = { code: null, status: 'Opening your world…', sig: 0, peer: null, offer: null, closed: false };
  const hl = new HostLink(sim, {
    localPid: game.localPid, saveName: game.saveName, worldId: game.saveId,
    onJoin: (p) => { game.toast(`${p.name} joined your world!`, 'good'); game.audio.play('join'); st.status = `${p.name} is here!`; st.sig++; },
    onLeave: (p) => { game.toast(`${p.name} left.`, 'info'); st.status = 'Waiting for your partner…'; st.sig++; },
  });
  const net = {
    hl,
    get code() { return st.code; }, get status() { return st.status; }, get sig() { return st.sig; },
    get rtt() { return 0; },
    tick: (dt) => hl.tick(dt),
    tellRemote: (pid, ev) => hl.tellRemote(pid, ev),
    broadcastSettings: () => hl.broadcastSettings(),
    inviteUrl: () => (st.code ? `${location.origin}${location.pathname}?join=${st.code}` : ''),
    manual: (hh) => manualHostBlock(hh, st, hl, game),
    close() {
      if (st.closed) return; st.closed = true;
      try { hl.sendBackup(); } catch (e) { /* ignore */ }
      setTimeout(() => { hl.close(); }, 120);
      setTimeout(() => { try { st.peer && st.peer.destroy(); } catch (e) { /* ignore */ } }, 900);
    },
  };
  game.net = net; game.mode = 'host';
  sim.world.record = true;
  game.hud.refreshAll();
  try {
    const { peer, code } = await openHostPeer(sim.world.shared.flags.room, {
      onConnection: (conn) => hl.attach(conn),
      onStatus: (s) => { if (!hl.clientCount) st.status = s; st.sig++; },
      onFatal: (e) => { st.status = 'Connection problem: ' + (e.message || e.type); st.sig++; },
    });
    st.peer = peer; st.code = code; sim.world.shared.flags.room = code; st.status = 'Waiting for your partner…'; st.sig++;
    app.saveWorld(game);
    game.ui.open('mp');
  } catch (e) {
    st.status = 'Could not reach the matchmaking server: ' + (e.message || e) + ' You can still pair manually below.'; st.sig++;
    game.ui.open('mp');
  }
}

function manualHostBlock(hh, st, hl, game) {
  const offerBox = hh('textarea', { class: 'sdp', readonly: true, placeholder: '1) Tap "Make invite code", then send it to your partner' });
  const ansBox = hh('textarea', { class: 'sdp', placeholder: "2) Paste your partner's answer code here" });
  ansBox.addEventListener('focus', () => { game.input.typing = true; }); ansBox.addEventListener('blur', () => { game.input.typing = false; });
  const note = hh('div', { class: 'small', style: 'min-height:18px' });
  const make = hh('button', { class: 'btn small', onclick: async () => { note.textContent = 'Making a code…'; try { st.offer = await manualHostOffer(); offerBox.value = st.offer.code; note.textContent = 'Send this code to your partner (Messages, AirDrop, anything).'; } catch (e) { note.textContent = 'Could not make a code: ' + e.message; } } }, 'Make invite code');
  const copy = hh('button', { class: 'btn small', onclick: () => { offerBox.select(); navigator.clipboard && navigator.clipboard.writeText(offerBox.value); note.textContent = 'Copied!'; } }, 'Copy');
  const go = hh('button', { class: 'btn small good', onclick: async () => { if (!st.offer) { note.textContent = 'Make an invite code first.'; return; } note.textContent = 'Connecting…'; try { const conn = await st.offer.accept(ansBox.value); hl.attach(conn); note.textContent = 'Connected!'; st.offer = null; } catch (e) { note.textContent = 'That did not work: ' + e.message; } } }, 'Connect');
  return hh('details', { style: 'margin-top:6px' }, hh('summary', { style: 'cursor:pointer;font-weight:700' }, 'Manual pairing (no internet server)'), hh('div', { class: 'col', style: 'gap:6px;margin-top:6px' }, make, offerBox, copy, ansBox, go, note));
}

// ------------------------------------------------------------------ joining
export async function joinGame(app, code, onStatus) {
  try {
    app.profile.lastCode = code; app.saveProfile();
    onStatus('Connecting to the matchmaking server…');
    const { peer, conn } = await connectToHost(code, { onStatus });
    await finishJoin(app, conn, { peer, code, onStatus });
  } catch (e) { onStatus(e.message || String(e)); }
}

export async function manualJoin(app, offerCode, onStatus) {
  const { answerCode, conn } = await manualGuestAnswer(offerCode);
  conn.then((c) => finishJoin(app, c, { peer: null, code: null, onStatus })).catch((e) => onStatus(e.message));
  return answerCode;
}

function finishJoin(app, conn, ctx) {
  const profile = app.profile;
  return new Promise((resolve, reject) => {
    let started = false;
    const link = new ClientLink(conn, {
      pid: profile.pid, name: profile.name, look: profile.look,
      onSnapshot: (data) => { started = true; beginClient(app, data, link, ctx); resolve(); },
      onKick: (reason) => { if (!started) reject(new Error(reason)); else lost(app, link, ctx, reason, true); },
      onClose: () => { if (!started) reject(new Error('The connection closed before the world loaded.')); else lost(app, link, ctx, 'Connection lost'); },
      onBackup: (data) => app.saveClientCopy(data),
      onHostLeft: () => lost(app, link, ctx, 'Your partner closed the world.', true),
    });
    link.start();
    setTimeout(() => { if (!started) { reject(new Error('Loading the world took too long.')); try { conn.close(); } catch (e) { /* ignore */ } } }, 30000);
  });
}

function buildMirror(data, pid) {
  const { world } = restoreWorld(data, { withSim: false });
  for (const q of data.online || []) { const p = world.players.get(q); if (p) p.online = true; }
  const me = world.players.get(pid); if (me) me.online = true;
  world.record = false;
  return world;
}

function beginClient(app, data, link, ctx) {
  const world = buildMirror(data, app.profile.pid);
  app.beginClientGame(world, link, data.name || 'Our Isles', ctx);
  app.saveClientCopy(data);
}

// ------------------------------------------------------------------ connection loss + auto reconnect
function lost(app, link, ctx, reason, final = false) {
  const game = app.game;
  if (!game || game.net !== link || game.mode !== 'client') return;
  if (game.lostState) return;
  const state = { msg: reason, final: final || !ctx.code, tries: 0, stop: false };
  game.lostState = state;
  game.ui.open('lost', { state });
  if (state.final) return;
  (async () => {
    for (let i = 1; i <= 24 && !state.stop; i++) {
      state.tries = i; state.msg = `Reconnecting… (try ${i})`;
      await wait(i === 1 ? 800 : 2500);
      if (state.stop || app.game !== game) return;
      try {
        const { conn } = await connectToHost(ctx.code, { timeoutMs: 9000 });
        const ok = await new Promise((resolve) => {
          const nl = new ClientLink(conn, {
            pid: app.profile.pid, name: app.profile.name, look: app.profile.look,
            onSnapshot: (data) => { const world = buildMirror(data, app.profile.pid); game.swapWorld(world, nl); game.lostState = null; game.ui.closeAll(true); game.toast('Reconnected!', 'good'); app.saveClientCopy(data); resolve(true); },
            onKick: (r) => { state.msg = r; resolve(false); }, onClose: () => resolve(false), onBackup: (d) => app.saveClientCopy(d), onHostLeft: () => lost(app, nl, ctx, 'Your partner closed the world.', true),
          });
          nl.start();
          setTimeout(() => resolve(false), 15000);
        });
        if (ok) return;
      } catch (e) { state.msg = 'Waiting for your partner… (' + (e.message || 'offline') + ')'; }
    }
    state.final = true; state.msg = 'Could not reconnect. Your partner may have closed the world.';
  })();
}

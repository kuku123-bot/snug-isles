// Multiplayer session glue: hosting a world, joining one, reconnecting, and keeping a backup copy of the world.
import { HostLink } from './host.js';
import { ClientLink } from './client.js';
import { restoreWorld } from '../sim/serialize.js';
import { openHostPeer, connectToHost, manualHostOffer, manualGuestAnswer } from './transport.js';
import { RelayHost, connectRelay } from './relay.js';
import { makeRelayKey, parseRelayKey } from './relaykey.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------------ hosting
export async function startHosting(app, game) {
  if (game.net) { game.ui.open('mp'); return; }
  const sim = game.sim;
  const st = { code: null, status: 'Opening your world…', sig: 0, peer: null, offer: null, closed: false, relay: null, relayKey: null, relayStatus: '' };
  const hl = new HostLink(sim, {
    localPid: game.localPid, saveName: game.saveName, worldId: game.saveId,
    approve: game.settings.approveJoins === false ? null : (info, decide, link) => game.hud.askJoin(info, decide, link),
    onAskCancel: (link) => game.hud.cancelJoin(link),
    onMismatch: (theirs, mine) => game.toast(`Your partner's game is a different version (${theirs} vs ${mine}). If anything acts strange, reload both devices.`, 'warn'),
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
    get relayOn() { return !!st.relay; }, get relayKey() { return st.relayKey; }, get relayStatus() { return st.relayStatus; },
    /** the encrypted backup connection through public relay servers, for networks that block direct connections */
    async enableRelay() {
      if (st.relay || st.closed) return;
      let key = parseRelayKey(sim.world.shared.flags.relayKey);
      if (!key) { key = makeRelayKey(); sim.world.shared.flags.relayKey = key; }
      st.relayKey = key; st.relayStatus = 'Connecting to the relay servers…'; st.sig++;
      const r = new RelayHost(key, { onConnection: (conn) => hl.attach(conn), onStatus: (s) => { st.relayStatus = s; st.sig++; } });
      st.relay = r;
      try { await r.start(); app.saveWorld(game); } catch (e) { st.relay = null; st.relayStatus = e.message || 'Could not reach the relay servers.'; st.sig++; throw e; }
      st.sig++;
    },
    inviteUrl: () => (st.code ? `${location.origin}${location.pathname}?join=${st.code}${st.relay ? '&relay=' + st.relayKey : ''}` : ''),
    manual: (hh) => manualHostBlock(hh, st, hl, game),
    close() {
      if (st.closed) return; st.closed = true;
      try { hl.sendBackup(); } catch (e) { /* ignore */ }
      try { st.relay && st.relay.stop(); } catch (e) { /* ignore */ }
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
      onStatus: (s) => { if (!hl.clientCount && st.status !== s) { st.status = s; st.sig++; } },
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
  const make = hh('button', { class: 'btn small', onclick: async () => { note.textContent = 'Making a code…'; try { if (st.offer) st.offer.cancel(); st.offer = await manualHostOffer(); offerBox.value = st.offer.code; note.textContent = 'Send this code to your partner (Messages, AirDrop, anything).'; } catch (e) { note.textContent = 'Could not make a code: ' + e.message; } } }, 'Make invite code');
  const copy = hh('button', { class: 'btn small', onclick: () => { offerBox.select(); navigator.clipboard && navigator.clipboard.writeText(offerBox.value); note.textContent = 'Copied!'; } }, 'Copy');
  const go = hh('button', { class: 'btn small good', onclick: async () => { if (!st.offer) { note.textContent = 'Make an invite code first.'; return; } note.textContent = 'Connecting…'; try { const conn = await st.offer.accept(ansBox.value); hl.attach(conn); note.textContent = 'Connected!'; st.offer = null; } catch (e) { note.textContent = 'That did not work: ' + e.message; } } }, 'Connect');
  return hh('details', { style: 'margin-top:6px' }, hh('summary', { style: 'cursor:pointer;font-weight:700' }, 'Manual pairing (no internet server)'), hh('div', { class: 'col', style: 'gap:6px;margin-top:6px' }, make, offerBox, copy, ansBox, go, note));
}

// ------------------------------------------------------------------ joining
export async function joinGame(app, code, onStatus, { relayKey = null } = {}) {
  try {
    const rk = relayKey ? parseRelayKey(relayKey) : null;
    if (relayKey && !rk) throw new Error('That backup code does not look right (it has 16 letters and numbers).');
    if (code) app.profile.lastCode = code;
    if (rk) app.profile.lastRelayKey = rk;
    app.saveProfile();
    let conn = null, peer = null, usedRelay = false;
    if (code) {
      onStatus('Connecting to the matchmaking server…');
      try { ({ peer, conn } = await connectToHost(code, { onStatus, attempts: rk ? 2 : 3 })); } catch (e) { if (!rk) throw e; onStatus('The direct connection did not work. Trying the backup relay…'); }
    }
    if (!conn) {
      if (!rk) throw new Error('Type the room code your partner sees.');
      ({ conn } = await connectRelay(rk, { onStatus })); usedRelay = true;
    }
    await finishJoin(app, conn, { peer, code, relayKey: rk, usedRelay, onStatus });
  } catch (e) {
    const hint = relayKey ? '' : ' Still stuck? Ask your partner to turn on "Backup connection" (Invite / players) and enter the backup code under "Joining does not work?".';
    onStatus((e.message || String(e)) + hint);
  }
}

export async function manualJoin(app, offerCode, onStatus) {
  const { answerCode, conn } = await manualGuestAnswer(offerCode);
  conn.then((c) => finishJoin(app, c, { peer: null, code: null, onStatus })).catch((e) => onStatus(e.message));
  return answerCode;
}

function finishJoin(app, conn, ctx) {
  const profile = app.profile;
  return new Promise((resolve, reject) => {
    let started = false, timer = null;
    const arm = (ms, msg) => { clearTimeout(timer); timer = setTimeout(() => { if (started) return; reject(new Error(msg)); try { conn.close(); } catch (e) { /* ignore */ } }, ms); };
    const link = new ClientLink(conn, {
      pid: profile.pid, name: profile.name, look: profile.look,
      onSnapshot: (data) => { started = true; clearTimeout(timer); beginClient(app, data, link, ctx); resolve(); },
      onKick: (reason) => { clearTimeout(timer); if (!started) reject(new Error(reason)); else lost(app, link, ctx, reason, true); },
      onClose: () => { clearTimeout(timer); if (!started) reject(new Error('The connection closed before the world loaded.')); else lost(app, link, ctx, 'Connection lost'); },
      onBackup: (data) => app.saveClientCopy(data),
      onHostLeft: () => lost(app, link, ctx, 'Your partner closed the world.', true),
      onWait: () => { if (ctx.onStatus) ctx.onStatus('Waiting for your partner to let you in…'); arm(110000, 'Your partner did not answer in time.'); },
      onMismatch: (theirs, mine) => { ctx.mismatch = [theirs, mine]; },
    });
    link.start();
    arm(30000, 'Loading the world took too long.');
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
  if (ctx.mismatch && app.game) app.game.toast(`Your partner's game is a different version (${ctx.mismatch[0]} vs ${ctx.mismatch[1]}). If anything acts strange, reload both devices.`, 'warn');
}

// ------------------------------------------------------------------ connection loss + auto reconnect
function lost(app, link, ctx, reason, final = false) {
  const game = app.game;
  if (!game || game.net !== link || game.mode !== 'client') return;
  if (game.lostState) return;
  const state = { msg: reason, final: final || !(ctx.code || ctx.relayKey), tries: 0, stop: false };
  game.lostState = state;
  game.ui.open('lost', { state });
  if (state.final) return;
  (async () => {
    for (let i = 1; i <= 24 && !state.stop; i++) {
      state.tries = i; state.msg = `Reconnecting… (try ${i})`;
      await wait(i === 1 ? 800 : 2500);
      if (state.stop || app.game !== game) return;
      try {
        let conn = null;
        if (ctx.code && !ctx.usedRelay) { try { ({ conn } = await connectToHost(ctx.code, { timeoutMs: 9000, attempts: ctx.relayKey ? 1 : 3 })); } catch (e) { if (!ctx.relayKey) throw e; } }
        if (!conn && ctx.relayKey) { ({ conn } = await connectRelay(ctx.relayKey)); ctx.usedRelay = true; }
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

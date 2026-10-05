// Multiplayer panel (invite code / players / connection).
import { h, ic, clear } from '../dom.js';
import { formatRelayKey } from '../../net/relaykey.js';

export function mpPanel(g, data, ui) {
  const body = h('div', { class: 'col', style: 'min-width:min(88vw,400px);max-width:480px;gap:10px' });
  // the manual-pairing block holds half-typed codes and an open/closed <details>: build it once and re-attach it on re-renders
  let manualEl = null, manualNet = null;
  // same for the backup-connection block (kept alive across re-renders so the section does not snap shut)
  const relayBody = h('div', { class: 'col', style: 'gap:6px;margin-top:6px' });
  const relayEl = h('details', { style: 'margin-top:6px' }, h('summary', { style: 'cursor:pointer;font-weight:700' }, 'Backup connection (if your partner cannot connect)'), relayBody);
  function renderRelay() {
    const net = g.net; clear(relayBody);
    relayBody.append(h('div', { class: 'small' }, 'Some networks (carrier-grade NAT, certain hotspots) block direct connections. The backup connection sends everything, end-to-end encrypted, through free public relay servers. A little slower, but it works almost everywhere.'));
    if (!net || !net.enableRelay) return;
    if (!net.relayOn) {
      const note = h('div', { class: 'small', style: 'min-height:18px' }, net.relayStatus || '');
      relayBody.append(h('button', { class: 'btn small good', onclick: async (e) => { e.currentTarget.classList.add('disabled'); note.textContent = 'Connecting to the relay servers…'; try { await net.enableRelay(); } catch (err) { note.textContent = err.message || String(err); e.currentTarget.classList.remove('disabled'); } } }, ic('ui_link', 1), 'Turn on backup connection'), note);
      return;
    }
    const code = formatRelayKey(net.relayKey);
    relayBody.append(h('div', { class: 'small' }, net.relayStatus || ''),
      h('div', { class: 'code-box', style: 'font-size:22px;letter-spacing:2px' }, code),
      h('div', { class: 'small' }, 'Send your partner this backup code too. On the join screen it goes under "Joining does not work?".'),
      h('div', { class: 'row', style: 'flex-wrap:wrap' },
        h('button', { class: 'btn small', onclick: () => { navigator.clipboard && navigator.clipboard.writeText(code); g.toast('Backup code copied!', 'good'); } }, 'Copy backup code'),
        h('button', { class: 'btn small blue', onclick: () => { navigator.clipboard && navigator.clipboard.writeText(net.inviteUrl()); g.toast('Invite link (with backup) copied!', 'good'); } }, 'Copy invite link')));
  }
  function render() {
    clear(body);
    const net = g.net;
    if (!net) {
      body.append(h('div', null, 'Invite your partner into this world! They join from their own iPad or Mac with a short code — you can both build, fight and explore together.'),
        h('button', { class: 'btn good', style: 'font-size:19px', onclick: () => { g.app.startHosting(g).then(render); render(); } }, ic('ui_people', 2), 'Open my world to my partner'));
      return;
    }
    if (g.mode === 'client') {
      body.append(h('div', { class: 'pill' }, ic('ui_link', 1), ' Connected to ', h('b', null, net.hostName || 'host')), h('div', { class: 'small muted' }, `Ping ${Math.round(net.rtt || 0)} ms · a backup copy of this world is kept on your device.`),
        h('button', { class: 'btn red', onclick: () => g.app.quitToTitle() }, 'Leave world'));
      return;
    }
    body.append(h('div', { class: 'small' }, net.status || ''));
    if (net.code) {
      body.append(h('div', { class: 'code-box' }, net.code), h('div', { class: 'small' }, 'Your partner taps "Play together → Join my partner" and types this code. Keep this window open while you play.'));
      const url = net.inviteUrl();
      body.append(h('div', { class: 'row', style: 'flex-wrap:wrap' },
        h('button', { class: 'btn small', onclick: () => { navigator.clipboard && navigator.clipboard.writeText(net.code); g.toast('Code copied!', 'good'); } }, 'Copy code'),
        h('button', { class: 'btn small blue', onclick: () => { navigator.clipboard && navigator.clipboard.writeText(url); g.toast('Invite link copied!', 'good'); } }, 'Copy invite link'),
        navigator.share ? h('button', { class: 'btn small good', onclick: () => navigator.share({ title: 'Snug Isles', text: 'Join my world in Snug Isles!', url }).catch(() => {}) }, 'Share…') : null));
    }
    const list = h('div', { class: 'col', style: 'gap:4px' });
    for (const p of g.world.players.values()) if (p.online) list.append(h('div', { class: 'row' }, ic('ui_people', 1), h('b', null, p.name), p.pid === g.localPid ? h('span', { class: 'muted small' }, ' (you)') : h('span', { class: 'chip ok' }, 'connected')));
    body.append(h('div', { class: 'sep' }), h('b', null, 'Players'), list);
    renderRelay(); body.append(relayEl);
    if (net.manual) { if (manualNet !== net) { manualEl = net.manual(h); manualNet = net; } body.append(manualEl); }
  }
  render();
  return { title: 'Play together', icon: 'ui_people', body, sig: () => `${g.net ? g.net.sig : 'x'}:${[...g.world.players.values()].filter((p) => p.online).length}:${g.net ? g.net.code : ''}`, refresh: render };
}

// Multiplayer panel (invite code / players / connection).
import { h, ic, clear } from '../dom.js';

export function mpPanel(g, data, ui) {
  const body = h('div', { class: 'col', style: 'min-width:min(88vw,400px);max-width:480px;gap:10px' });
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
    if (net.manual) body.append(net.manual(h));
  }
  render();
  return { title: 'Play together', icon: 'ui_people', body, sig: () => `${g.net ? g.net.sig : 'x'}:${[...g.world.players.values()].filter((p) => p.online).length}:${g.net ? g.net.code : ''}`, refresh: render };
}

// Browser transports. Primary: PeerJS (WebRTC data channels, free public signaling). Fallback: manual copy/paste pairing
// with a raw RTCPeerConnection (needs no server at all). Both expose the same conn interface used by HostLink/ClientLink.
import { Peer } from 'peerjs';

export const ROOM_PREFIX = 'snugisles-';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid mix-ups when reading a code aloud
export function makeCode(n = 5) {
  const a = new Uint8Array(n); crypto.getRandomValues(a);
  return [...a].map((b) => ALPHABET[b % ALPHABET.length]).join('');
}

const ICE = [
  { urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' },
  // public relay as a last resort for strict networks (traffic stays DTLS-encrypted end to end)
  { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turns:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
];

export function peerOptions() {
  const q = new URLSearchParams(location.search);
  const o = { debug: +(q.get('peerdebug') || 0), config: { iceServers: ICE, iceCandidatePoolSize: 2 } };
  if (q.get('peerhost')) { o.host = q.get('peerhost'); o.port = +q.get('peerport') || 9000; o.path = q.get('peerpath') || '/'; o.secure = q.get('peersecure') === '1'; }
  return o;
}

/** common conn wrapper */
class BaseConn {
  constructor() { this.onmessage = null; this.onclose = null; this._closed = false; }
  _fireClose() { if (this._closed) return; this._closed = true; if (this.onclose) this.onclose(); }
}
export class PeerConn extends BaseConn {
  constructor(dc) {
    super();
    this.dc = dc;
    dc.on('data', (d) => { if (this.onmessage) this.onmessage(typeof d === 'string' ? d : new TextDecoder().decode(d)); });
    dc.on('close', () => this._fireClose());
    dc.on('error', () => this._fireClose());
  }
  send(s) { this.dc.send(s); }
  close() { try { this.dc.close(); } catch (e) { /* ignore */ } this._fireClose(); }
  get open() { return this.dc.open && !this._closed; }
  get buffered() { return (this.dc.dataChannel && this.dc.dataChannel.bufferedAmount) || 0; }
}
export class RtcConn extends BaseConn {
  constructor(dc, pc) {
    super();
    this.dc = dc; this.pc = pc;
    dc.binaryType = 'arraybuffer';
    dc.onmessage = (e) => { if (this.onmessage) this.onmessage(typeof e.data === 'string' ? e.data : new TextDecoder().decode(e.data)); };
    dc.onclose = () => this._fireClose();
    dc.onerror = () => this._fireClose();
    pc.onconnectionstatechange = () => { if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) setTimeout(() => { if (pc.connectionState !== 'connected') this._fireClose(); }, 1500); };
  }
  send(s) { this.dc.send(s); }
  close() { try { this.dc.close(); this.pc.close(); } catch (e) { /* ignore */ } this._fireClose(); }
  get open() { return this.dc.readyState === 'open' && !this._closed; }
  get buffered() { return this.dc.bufferedAmount || 0; }
}

// ------------------------------------------------------------------ PeerJS host/client
/** Register a PeerJS peer under snugisles-<code>. Retries with a new code if the id is taken. Resolves {peer, code}. */
export function openHostPeer(preferredCode, { onConnection, onStatus = () => {}, onFatal = () => {} }) {
  return new Promise((resolve, reject) => {
    let code = preferredCode || makeCode(), tries = 0, settled = false;
    const attempt = () => {
      const peer = new Peer(ROOM_PREFIX + code, peerOptions());
      peer.on('open', () => { settled = true; onStatus('Waiting for your partner…'); resolve({ peer, code }); });
      peer.on('connection', (dc) => { dc.on('open', () => onConnection(new PeerConn(dc))); });
      peer.on('disconnected', () => { onStatus('Reconnecting to the matchmaking server…'); try { peer.reconnect(); } catch (e) { /* ignore */ } });
      peer.on('error', (err) => {
        if (err.type === 'unavailable-id' && !settled && tries < 6) { tries++; code = makeCode(); try { peer.destroy(); } catch (e) { /* ignore */ } attempt(); return; }
        if (!settled) { reject(err); return; }
        if (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error') onStatus('Matchmaking server hiccup — retrying…');
        else onFatal(err);
      });
    };
    attempt();
    setTimeout(() => { if (!settled) reject(new Error('The matchmaking server did not answer. Check your internet connection (or use manual pairing).')); }, 15000);
  });
}

function connectOnce(code, { onStatus = () => {}, timeoutMs = 9000 } = {}) {
  return new Promise((resolve, reject) => {
    const peer = new Peer(undefined, peerOptions());
    let done = false, dcRef = null;
    const fail = (e, fatal = false) => { if (done) return; done = true; clearTimeout(timer); try { peer.destroy(); } catch (x) { /* ignore */ } e.fatal = fatal; reject(e); };
    const timer = setTimeout(() => fail(new Error('No answer. Make sure your partner\'s world is open and the code is right.')), timeoutMs);
    peer.on('error', (err) => {
      if (err.type === 'peer-unavailable') fail(new Error('No world with that code is open right now.'), true);
      else fail(new Error(err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error' ? 'Could not reach the matchmaking server. Check your internet.' : (err.message || String(err))));
    });
    peer.on('open', () => {
      onStatus('Looking for your partner…');
      const dc = peer.connect(ROOM_PREFIX + code, { reliable: true, serialization: 'raw' });
      if (!dc) return fail(new Error('Could not start the connection.'));
      dcRef = dc;
      dc.on('open', () => { if (done) return; done = true; clearTimeout(timer); onStatus('Connected! Loading the world…'); resolve({ peer, conn: new PeerConn(dc) }); });
      dc.on('error', (e) => fail(new Error('Connection error: ' + (e.message || e))));
      // bail out of a dead negotiation early instead of waiting for the full timeout
      const watch = () => {
        const pc = dc.peerConnection;
        if (!pc) { setTimeout(watch, 150); return; }
        let dis = null;
        pc.addEventListener('iceconnectionstatechange', () => {
          if (done) return;
          if (pc.iceConnectionState === 'failed') fail(new Error('Could not establish a direct connection.'));
          if (pc.iceConnectionState === 'disconnected' && !dis) dis = setTimeout(() => { if (!done && !dc.open) fail(new Error('The connection stalled.')); }, 3500);
        });
      };
      watch();
    });
  });
}

/** Connect to a host room. Retries a few times: WebRTC negotiation can occasionally stall on the first attempt. */
export async function connectToHost(code, { onStatus = () => {}, timeoutMs = 9000, attempts = 3 } = {}) {
  let last = null;
  for (let i = 0; i < attempts; i++) {
    try { return await connectOnce(code, { onStatus, timeoutMs }); } catch (e) {
      last = e;
      if (e.fatal && i >= 1) break; // "no such room" twice in a row: give up
      if (i < attempts - 1) onStatus(`Still trying… (attempt ${i + 2} of ${attempts})`);
    }
  }
  throw last;
}

// ------------------------------------------------------------------ manual (serverless) pairing
const RTC_CFG = { iceServers: ICE.slice(0, 3) };
async function deflate(str) {
  if (typeof CompressionStream === 'undefined') return 'R' + btoa(unescape(encodeURIComponent(str)));
  const cs = new CompressionStream('deflate-raw'); const w = cs.writable.getWriter(); w.write(new TextEncoder().encode(str)); w.close();
  const buf = new Uint8Array(await new Response(cs.readable).arrayBuffer());
  let s = ''; for (const b of buf) s += String.fromCharCode(b);
  return 'Z' + btoa(s);
}
async function inflate(code) {
  code = code.trim().replace(/\s+/g, '');
  const kind = code[0], body = code.slice(1);
  if (kind === 'R') return decodeURIComponent(escape(atob(body)));
  const bin = atob(body); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  const ds = new DecompressionStream('deflate-raw'); const w = ds.writable.getWriter(); w.write(u); w.close();
  return await new Response(ds.readable).text();
}
function gathered(pc) {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') return resolve();
    const done = () => { pc.removeEventListener('icegatheringstatechange', chk); resolve(); };
    const chk = () => { if (pc.iceGatheringState === 'complete') done(); };
    pc.addEventListener('icegatheringstatechange', chk);
    setTimeout(done, 4500);
  });
}
/** Host: creates an invite code. accept(answerCode) resolves an RtcConn once the partner pastes their answer. */
export async function manualHostOffer() {
  const pc = new RTCPeerConnection(RTC_CFG);
  const dc = pc.createDataChannel('snug', { ordered: true });
  await pc.setLocalDescription(await pc.createOffer());
  await gathered(pc);
  const code = await deflate(JSON.stringify({ type: pc.localDescription.type, sdp: pc.localDescription.sdp }));
  const opened = new Promise((resolve, reject) => { dc.onopen = () => resolve(new RtcConn(dc, pc)); setTimeout(() => reject(new Error('Timed out waiting for the connection')), 120000); });
  return {
    code,
    async accept(answerCode) { const d = JSON.parse(await inflate(answerCode)); await pc.setRemoteDescription(d); return opened; },
  };
}
/** Guest: takes the host's invite code, returns {answerCode, conn: Promise<RtcConn>} */
export async function manualGuestAnswer(offerCode) {
  const pc = new RTCPeerConnection(RTC_CFG);
  const conn = new Promise((resolve, reject) => {
    pc.ondatachannel = (e) => { const dc = e.channel; const go = () => resolve(new RtcConn(dc, pc)); if (dc.readyState === 'open') go(); else dc.onopen = go; };
    setTimeout(() => reject(new Error('Timed out waiting for the host')), 180000);
  });
  await pc.setRemoteDescription(JSON.parse(await inflate(offerCode)));
  await pc.setLocalDescription(await pc.createAnswer());
  await gathered(pc);
  const answerCode = await deflate(JSON.stringify({ type: pc.localDescription.type, sdp: pc.localDescription.sdp }));
  return { answerCode, conn };
}

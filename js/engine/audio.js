// Procedural audio (no asset files): SFX synthesised with WebAudio + a gentle generative lullaby that changes mood at night.
const MIDI = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.sfxVol = 0.8; this.musicVol = 0.35; this.master = 0.9;
    this.enabled = true;
    this.mood = 'day';
    this.musicOn = false;
    this._timer = null;
    this.nextBar = 0; this.bar = 0;
    this.noiseBuf = null;
    this.lastPlayed = {};
    this.rainOn = false;
  }

  /** must be called from a user gesture */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this.enabled = false; return; }
      this.ctx = new AC({ latencyHint: 'interactive' });
      const c = this.ctx;
      this.masterGain = c.createGain(); this.masterGain.gain.value = this.master;
      this.sfxGain = c.createGain(); this.sfxGain.gain.value = this.sfxVol;
      this.musicGain = c.createGain(); this.musicGain.gain.value = this.musicVol;
      // soft limiter so bursts of sound never clip
      this.comp = c.createDynamicsCompressor(); this.comp.threshold.value = -14; this.comp.ratio.value = 6; this.comp.attack.value = 0.004; this.comp.release.value = 0.2;
      this.sfxGain.connect(this.comp); this.musicGain.connect(this.comp); this.comp.connect(this.masterGain); this.masterGain.connect(c.destination);
      // echo for music
      this.echo = c.createDelay(1); this.echo.delayTime.value = 0.32;
      const fb = c.createGain(); fb.gain.value = 0.34; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
      this.echo.connect(lp); lp.connect(fb); fb.connect(this.echo);
      this.echoSend = c.createGain(); this.echoSend.gain.value = 0.5; this.echoSend.connect(this.echo);
      const eo = c.createGain(); eo.gain.value = 0.55; lp.connect(eo); eo.connect(this.musicGain);
      // white noise buffer
      const len = c.sampleRate * 1.5; this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
  }
  setVolumes(m, s, mu) {
    if (m !== undefined) this.master = m; if (s !== undefined) this.sfxVol = s; if (mu !== undefined) this.musicVol = mu;
    if (this.ctx) { this.masterGain.gain.value = this.master; this.sfxGain.gain.value = this.sfxVol; this.musicGain.gain.value = this.musicVol; }
  }
  get ready() { return this.enabled && this.ctx && this.ctx.state === 'running'; }

  // ------------------------------------------------------------ building blocks
  tone(freq, dur, o = {}) {
    if (!this.ready) return;
    const c = this.ctx, t0 = (o.at || c.currentTime), osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + dur);
    if (o.detune) osc.detune.value = o.detune;
    const a = o.attack || 0.004, v = (o.vol === undefined ? 0.3 : o.vol);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(o.dest || this.sfxGain);
    if (o.echo) g.connect(this.echoSend);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }
  noise(dur, o = {}) {
    if (!this.ready) return;
    const c = this.ctx, t0 = o.at || c.currentTime, src = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
    src.buffer = this.noiseBuf; src.loop = true;
    f.type = o.type || 'bandpass'; f.frequency.setValueAtTime(o.freq || 1000, t0); if (o.to) f.frequency.exponentialRampToValueAtTime(Math.max(40, o.to), t0 + dur); f.Q.value = o.q || 0.9;
    const v = o.vol === undefined ? 0.3 : o.vol;
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + (o.attack || 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(o.dest || this.sfxGain);
    src.start(t0, Math.random()); src.stop(t0 + dur + 0.05);
  }
  note(midi, dur = 0.5, vol = 0.25) { this.unlock(); this.bell(MIDI(midi), dur, vol); }
  bell(freq, dur, vol = 0.2, at) {
    if (!this.ready) return;
    this.tone(freq, dur, { type: 'sine', vol, at, attack: 0.003, echo: true, dest: this.sfxGain });
    this.tone(freq * 2.01, dur * 0.5, { type: 'sine', vol: vol * 0.35, at, attack: 0.003, dest: this.sfxGain });
  }

  // ------------------------------------------------------------ SFX
  play(name, o = {}) {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    // rate-limit identical sounds so rapid events don't turn into noise
    const minGap = { pickup: 0.035, chop: 0.05, mine: 0.05, hit: 0.04, coin: 0.05, shoot: 0.08, pop: 0.05 }[name] || 0.02;
    if (this.lastPlayed[name] && now - this.lastPlayed[name] < minGap) return;
    this.lastPlayed[name] = now;
    const v = (o.vol === undefined ? 1 : o.vol), p = o.pitch || 1;
    const r = (a, b) => a + Math.random() * (b - a);
    switch (name) {
      case 'pickup': this.tone(660 * p, 0.09, { type: 'sine', vol: 0.22 * v }); this.tone(990 * p, 0.12, { type: 'sine', vol: 0.2 * v, at: now + 0.05 }); break;
      case 'chop': this.noise(0.09, { freq: r(700, 1000), q: 0.8, vol: 0.5 * v }); this.tone(r(150, 190), 0.12, { type: 'triangle', to: 80, vol: 0.4 * v }); break;
      case 'mine': this.noise(0.05, { freq: r(2200, 3200), q: 1.2, vol: 0.3 * v }); this.tone(r(900, 1300), 0.09, { type: 'square', to: 600, vol: 0.12 * v }); this.tone(130, 0.1, { type: 'triangle', to: 70, vol: 0.3 * v }); break;
      case 'hit': this.noise(0.08, { freq: 1500, q: 0.7, vol: 0.4 * v }); this.tone(r(220, 300), 0.1, { type: 'square', to: 120, vol: 0.14 * v }); break;
      case 'clink': this.tone(1700, 0.1, { type: 'triangle', vol: 0.2 }); this.tone(2400, 0.08, { type: 'sine', vol: 0.12 }); break;
      case 'treefall': this.noise(0.5, { type: 'lowpass', freq: 900, to: 120, vol: 0.6 * v, q: 0.4 }); this.tone(90, 0.3, { type: 'sine', to: 45, vol: 0.5 * v, at: now + 0.08 }); break;
      case 'rockbreak': this.noise(0.28, { freq: 1100, to: 300, q: 0.6, vol: 0.55 * v }); this.tone(100, 0.2, { type: 'triangle', to: 50, vol: 0.45 * v }); this.tone(140, 0.15, { type: 'triangle', to: 70, vol: 0.3 * v, at: now + 0.06 }); break;
      case 'coin': this.tone(988, 0.07, { type: 'square', vol: 0.12 }); this.tone(1319, 0.22, { type: 'square', vol: 0.12, at: now + 0.06 }); break;
      case 'levelup': [72, 76, 79, 84, 88].forEach((m, i) => this.bell(MIDI(m), 0.5, 0.2, now + i * 0.07)); this.tone(MIDI(60), 0.6, { type: 'triangle', vol: 0.2, echo: true }); break;
      case 'place': this.tone(380, 0.1, { type: 'sine', to: 640, vol: 0.28 }); this.noise(0.05, { freq: 600, vol: 0.2 }); break;
      case 'placewall': this.tone(260, 0.1, { type: 'triangle', to: 420, vol: 0.3 }); this.noise(0.07, { freq: 500, q: 0.6, vol: 0.28 }); break;
      case 'remove': this.tone(600, 0.1, { type: 'sine', to: 260, vol: 0.25 }); this.noise(0.06, { freq: 900, vol: 0.18 }); break;
      case 'craft': [76, 79, 83].forEach((m, i) => this.tone(MIDI(m), 0.12, { type: 'triangle', vol: 0.2, at: now + i * 0.06 })); this.bell(MIDI(88), 0.4, 0.15, now + 0.18); break;
      case 'research': [67, 71, 74, 79, 83, 86].forEach((m, i) => this.bell(MIDI(m), 0.8, 0.16, now + i * 0.09)); break;
      case 'skill': this.bell(MIDI(84), 0.3, 0.2); this.bell(MIDI(91), 0.5, 0.2, now + 0.09); break;
      case 'land': this.tone(70, 1.0, { type: 'sine', to: 35, vol: 0.6 }); this.noise(0.9, { type: 'lowpass', freq: 400, to: 80, vol: 0.5 }); [60, 64, 67, 72, 76].forEach((m, i) => this.bell(MIDI(m), 0.9, 0.16, now + 0.3 + i * 0.1)); break;
      case 'splash': this.noise(0.22, { freq: 1400, to: 400, q: 0.7, vol: 0.4 * v }); break;
      case 'bite': this.tone(1200, 0.07, { type: 'square', vol: 0.15 }); this.tone(1600, 0.1, { type: 'square', vol: 0.15, at: now + 0.08 }); break;
      case 'catch': [72, 76, 79].forEach((m, i) => this.tone(MIDI(m), 0.16, { type: 'triangle', vol: 0.25, at: now + i * 0.08 })); this.noise(0.2, { freq: 1500, to: 500, vol: 0.3 }); break;
      case 'harvest': this.noise(0.18, { freq: 3000, q: 0.5, vol: 0.2 }); this.tone(520, 0.08, { type: 'sine', to: 780, vol: 0.2 }); break;
      case 'plant': this.noise(0.1, { type: 'lowpass', freq: 500, vol: 0.3 }); this.tone(240, 0.1, { type: 'sine', to: 160, vol: 0.25 }); break;
      case 'eat': this.noise(0.05, { freq: 2500, q: 1, vol: 0.3 }); this.noise(0.05, { freq: 2200, q: 1, vol: 0.3, at: now + 0.09 }); this.tone(500, 0.12, { type: 'sine', to: 750, vol: 0.15, at: now + 0.16 }); break;
      case 'equip': this.tone(1500, 0.14, { type: 'triangle', vol: 0.2 }); this.noise(0.06, { freq: 3500, q: 1, vol: 0.2 }); break;
      case 'faint': this.tone(520, 0.6, { type: 'triangle', to: 130, vol: 0.3 }); break;
      case 'hurt': this.noise(0.12, { type: 'lowpass', freq: 1200, to: 300, vol: 0.5 }); this.tone(330, 0.2, { type: 'square', to: 150, vol: 0.2 }); break;
      case 'boom': this.noise(0.5, { type: 'lowpass', freq: 800, to: 60, vol: 0.7 }); this.tone(70, 0.4, { type: 'sine', to: 35, vol: 0.5 }); break;
      case 'warn': this.tone(520, 0.14, { type: 'square', vol: 0.18 }); this.tone(390, 0.18, { type: 'square', vol: 0.18, at: now + 0.15 }); break;
      case 'bossspawn': this.tone(80, 1.2, { type: 'sawtooth', to: 50, vol: 0.3 }); this.noise(1.1, { type: 'lowpass', freq: 600, to: 100, vol: 0.5 }); [48, 51, 55].forEach((m, i) => this.tone(MIDI(m), 1.0, { type: 'sawtooth', vol: 0.12, at: now + 0.3 + i * 0.15 })); break;
      case 'victory': [67, 72, 76, 79, 84, 79, 84, 88].forEach((m, i) => this.bell(MIDI(m), 0.6, 0.2, now + i * 0.11)); break;
      case 'shoot': this.tone(900, 0.1, { type: 'square', to: 220, vol: 0.12 * v }); break;
      case 'dig': this.noise(0.2, { freq: 600, to: 250, q: 0.5, vol: 0.4 }); this.tone(120, 0.12, { type: 'triangle', to: 70, vol: 0.3 }); break;
      case 'chest': [72, 76, 79, 84, 88, 91].forEach((m, i) => this.bell(MIDI(m), 0.6, 0.17, now + i * 0.06)); break;
      case 'ping': this.bell(MIDI(88), 0.5, 0.2); break;
      case 'emote': this.tone(700, 0.1, { type: 'sine', to: 1000, vol: 0.2 }); break;
      case 'squee': this.tone(900, 0.2, { type: 'sine', to: 1500, vol: 0.2 * v }); break;
      case 'dooropen': this.tone(180, 0.14, { type: 'sawtooth', to: 260, vol: 0.07 * v }); this.noise(0.06, { freq: 700, vol: 0.12 * v }); break;
      case 'doorclose': this.noise(0.07, { type: 'lowpass', freq: 500, vol: 0.3 * v }); this.tone(110, 0.08, { type: 'triangle', to: 70, vol: 0.2 * v }); break;
      case 'poof': this.noise(0.25, { type: 'lowpass', freq: 1800, to: 300, vol: 0.4 * v, q: 0.3 }); this.tone(500, 0.15, { type: 'sine', to: 900, vol: 0.08 }); break;
      case 'pop': this.tone(420, 0.09, { type: 'sine', to: 760, vol: 0.2 * v }); break;
      case 'click': this.tone(880, 0.04, { type: 'sine', vol: 0.14 }); break;
      case 'open': this.tone(520, 0.08, { type: 'sine', to: 780, vol: 0.18 }); this.tone(780, 0.08, { type: 'sine', to: 1040, vol: 0.14, at: now + 0.05 }); break;
      case 'close': this.tone(780, 0.07, { type: 'sine', to: 520, vol: 0.16 }); break;
      case 'error': this.tone(180, 0.18, { type: 'square', to: 140, vol: 0.14 }); break;
      case 'buy': [72, 79, 84].forEach((m, i) => this.tone(MIDI(m), 0.1, { type: 'square', vol: 0.1, at: now + i * 0.05 })); this.tone(1319, 0.25, { type: 'square', vol: 0.1, at: now + 0.17 }); break;
      case 'step': this.noise(0.04, { type: 'lowpass', freq: 600, vol: 0.05 * v }); break;
      case 'join': [76, 79, 83, 88].forEach((m, i) => this.bell(MIDI(m), 0.5, 0.2, now + i * 0.08)); break;
      case 'thunder': this.noise(1.4, { type: 'lowpass', freq: 400, to: 60, vol: 0.6, q: 0.3 }); break;
    }
  }

  // ------------------------------------------------------------ music
  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    this.nextBar = this.ctx.currentTime + 0.3;
    this._timer = setInterval(() => this._schedule(), 120);
  }
  stopMusic() { this.musicOn = false; if (this._timer) clearInterval(this._timer); this._timer = null; }
  setMood(m) { this.mood = m; }
  _schedule() {
    if (!this.ready || !this.musicOn) return;
    const c = this.ctx;
    while (this.nextBar < c.currentTime + 0.5) { this._bar(this.nextBar); const beat = 60 / (this.mood === 'night' ? 66 : 84); this.nextBar += beat * 4; this.bar++; }
  }
  _bar(t) {
    const night = this.mood === 'night';
    const beat = 60 / (night ? 66 : 84);
    // progression in C (day) / A minor-ish (night): chords as root midi + intervals
    const PROG = night
      ? [[57, [0, 3, 7]], [53, [0, 4, 7]], [48, [0, 4, 7]], [55, [0, 4, 7]], [57, [0, 3, 7]], [52, [0, 3, 7]], [53, [0, 4, 7]], [55, [0, 4, 7]]]
      : [[60, [0, 4, 7]], [57, [0, 3, 7]], [53, [0, 4, 7]], [55, [0, 4, 7]], [60, [0, 4, 7]], [64, [0, 3, 7]], [53, [0, 4, 7]], [55, [0, 4, 7, 10]]];
    const [root, iv] = PROG[this.bar % PROG.length];
    const pent = night ? [0, 3, 5, 7, 10, 12, 15] : [0, 2, 4, 7, 9, 12, 14];
    const mg = this.musicGain;
    // pad
    for (const i of iv) this._pad(MIDI(root - 12 + i), t, beat * 4, night ? 0.06 : 0.05);
    // bass
    this._pluck(MIDI(root - 24), t, beat * 1.5, 0.16, 'triangle');
    this._pluck(MIDI(root - 24 + (iv[2] || 7) - 0), t + beat * 2, beat * 1.2, 0.1, 'triangle');
    // melody: eighth-note grid with probability, drawn from pentatonic around the chord
    let last = 7;
    for (let s = 0; s < 8; s++) {
      const p = night ? 0.28 : 0.46;
      if (Math.random() > p && !(s === 0 && Math.random() < 0.6)) continue;
      let k = last + (Math.random() < 0.5 ? -1 : 1) * (Math.random() < 0.6 ? 1 : 2);
      k = Math.max(0, Math.min(pent.length - 1, k)); last = k;
      const m = root + 12 + pent[k] + (night ? 0 : (Math.random() < 0.15 ? 12 : 0));
      this._marimba(MIDI(m), t + s * beat * 0.5, night ? 0.5 : 0.32, night ? 0.1 : 0.13);
    }
    // gentle sparkle on bar starts
    if (this.bar % 4 === 0) this._marimba(MIDI(root + 24), t + beat * 3, 0.9, 0.05);
  }
  _pad(freq, t, dur, vol) {
    const c = this.ctx, osc = c.createOscillator(), osc2 = c.createOscillator(), g = c.createGain();
    osc.type = 'sine'; osc2.type = 'triangle'; osc.frequency.value = freq; osc2.frequency.value = freq * 1.003;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.35); g.gain.linearRampToValueAtTime(0.0001, t + dur * 1.05);
    osc.connect(g); osc2.connect(g); g.connect(this.musicGain); g.connect(this.echoSend);
    osc.start(t); osc2.start(t); osc.stop(t + dur * 1.1); osc2.stop(t + dur * 1.1);
  }
  _pluck(freq, t, dur, vol, type = 'triangle') {
    const c = this.ctx, osc = c.createOscillator(), g = c.createGain();
    osc.type = type; osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(this.musicGain); osc.start(t); osc.stop(t + dur + 0.05);
  }
  _marimba(freq, t, dur, vol) {
    const c = this.ctx;
    for (const [mul, v, d] of [[1, 1, 1], [3.9, 0.2, 0.35], [9.2, 0.06, 0.15]]) {
      const osc = c.createOscillator(), g = c.createGain();
      osc.type = 'sine'; osc.frequency.value = freq * mul;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur * d);
      osc.connect(g); g.connect(this.musicGain); g.connect(this.echoSend);
      osc.start(t); osc.stop(t + dur * d + 0.05);
    }
  }

  // ------------------------------------------------------------ ambience
  setRain(on) {
    if (!this.ready) { this.rainOn = on; return; }
    if (on && !this._rain) {
      const c = this.ctx, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      src.buffer = this.noiseBuf; src.loop = true; f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 0.5;
      g.gain.value = 0; g.gain.linearRampToValueAtTime(0.06, c.currentTime + 2);
      src.connect(f); f.connect(g); g.connect(this.sfxGain); src.start();
      this._rain = { src, g };
    } else if (!on && this._rain) {
      const r = this._rain; this._rain = null;
      r.g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1.5); setTimeout(() => { try { r.src.stop(); } catch (e) { /* ok */ } }, 1800);
    }
  }
}

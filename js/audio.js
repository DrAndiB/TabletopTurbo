// Synthesised sound: toy-car engines, skids, bumps, jingles. No audio files.
export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
    try { this.muted = localStorage.getItem('tabletop-turbo.muted') === '1'; } catch (e) { /* ignore */ }
    this.engines = [];
    this.musicOn = false;
  }

  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.master);
    this.music = ctx.createGain(); this.music.gain.value = 0.22; this.music.connect(this.master);
    // shared noise buffer
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    return true;
  }

  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem('tabletop-turbo.muted', m ? '1' : '0'); } catch (e) { /* ignore */ }
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  // ---- engines
  createEngines(n) {
    this.stopEngines();
    if (!this.ctx) return; // audio starts only after a click or key press
    this.ensure();
    const ctx = this.ctx;
    for (let i = 0; i < n; i++) {
      const o1 = ctx.createOscillator(); o1.type = 'sawtooth';
      const o2 = ctx.createOscillator(); o2.type = 'square';
      const lfo = ctx.createOscillator(); lfo.frequency.value = 23 + i * 3;
      const lfoGain = ctx.createGain(); lfoGain.gain.value = 6;
      lfo.connect(lfoGain); lfoGain.connect(o1.frequency); lfoGain.connect(o2.frequency);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 3;
      const g = ctx.createGain(); g.gain.value = 0;
      const g2 = ctx.createGain(); g2.gain.value = 0.35;
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      o1.connect(f); o2.connect(g2); g2.connect(f); f.connect(g);
      if (pan) { g.connect(pan); pan.connect(this.sfx); } else g.connect(this.sfx);
      // skid
      const sk = ctx.createBufferSource(); sk.buffer = this.noise; sk.loop = true;
      const skf = ctx.createBiquadFilter(); skf.type = 'bandpass'; skf.frequency.value = 1500 + i * 120; skf.Q.value = 2.5;
      const skg = ctx.createGain(); skg.gain.value = 0;
      sk.connect(skf); skf.connect(skg);
      if (pan) skg.connect(pan); else skg.connect(this.sfx);
      o1.start(); o2.start(); lfo.start(); sk.start();
      this.engines.push({ o1, o2, lfo, f, g, pan, sk, skg, base: 92 + i * 9 });
    }
  }
  stopEngines() {
    for (const e of this.engines) {
      try { e.o1.stop(); e.o2.stop(); e.lfo.stop(); e.sk.stop(); } catch (err) { /* already stopped */ }
      e.g.disconnect(); e.skg.disconnect();
    }
    this.engines = [];
  }
  // speedFrac 0..1, throttle 0..1, slip 0.., pan -1..1, vol 0..1
  updateEngine(i, speedFrac, throttle, slip, pan, vol) {
    const e = this.engines[i];
    if (!e) return;
    const t = this.ctx.currentTime;
    // fake gear steps so it sounds like it is revving up
    const gears = 3;
    const gpos = Math.min(0.999, speedFrac) * gears;
    const inGear = gpos - Math.floor(gpos);
    const f = e.base * (1 + Math.floor(gpos) * 0.35 + inGear * 0.9 + throttle * 0.12);
    e.o1.frequency.setTargetAtTime(f, t, 0.04);
    e.o2.frequency.setTargetAtTime(f * 0.5, t, 0.04);
    e.f.frequency.setTargetAtTime(500 + 1600 * speedFrac + 600 * throttle, t, 0.05);
    e.g.gain.setTargetAtTime(vol * (0.05 + 0.05 * throttle + 0.04 * speedFrac), t, 0.06);
    const sv = Math.max(0, Math.min(1, (slip - 7) / 25)) * vol * 0.28;
    e.skg.gain.setTargetAtTime(sv, t, 0.05);
    if (e.pan) e.pan.pan.setTargetAtTime(Math.max(-0.9, Math.min(0.9, pan)), t, 0.05);
  }
  silenceEngines() {
    if (!this.ctx) return;
    for (const e of this.engines) { e.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08); e.skg.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05); }
  }

  // ---- one-shots
  tone(freq, dur, { type = 'square', vol = 0.2, when = 0, slideTo = null, attack = 0.005 } = {}) {
    if (!this.ensure()) return;
    const ctx = this.ctx, t = ctx.currentTime + when;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.sfx);
    o.start(t); o.stop(t + dur + 0.05);
  }
  noiseBurst(dur, { freq = 800, q = 1, vol = 0.3, type = 'lowpass', pan = 0, when = 0 } = {}) {
    if (!this.ensure()) return;
    const ctx = this.ctx, t = ctx.currentTime + when;
    const s = ctx.createBufferSource(); s.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = s.connect(f).connect(g);
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; node = node.connect(p); }
    node.connect(this.sfx);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  bump(strength, pan = 0) {
    const v = Math.min(0.5, 0.06 + strength * 0.012);
    this.noiseBurst(0.12, { freq: 500 + strength * 20, vol: v, pan });
    this.tone(90 + Math.random() * 30, 0.12, { type: 'sine', vol: v * 0.8 });
  }
  clack(strength, pan = 0) {
    const v = Math.min(0.35, 0.05 + strength * 0.01);
    this.tone(1900 + Math.random() * 600, 0.06, { type: 'sine', vol: v });
    this.noiseBurst(0.03, { freq: 4000, type: 'highpass', vol: v * 0.6, pan });
  }
  thud(strength) { this.tone(70, 0.18, { type: 'sine', vol: Math.min(0.4, strength * 0.006), slideTo: 45 }); }
  fall() { this.tone(950, 0.7, { type: 'triangle', vol: 0.16, slideTo: 140 }); }
  plop() { this.tone(300, 0.25, { type: 'sine', vol: 0.25, slideTo: 80 }); this.noiseBurst(0.15, { freq: 600, vol: 0.12 }); }
  jump() { this.tone(300, 0.25, { type: 'triangle', vol: 0.1, slideTo: 700 }); }
  beep(go = false) { this.tone(go ? 880 : 440, go ? 0.5 : 0.22, { type: 'square', vol: 0.14 }); }
  out() { this.tone(330, 0.16, { type: 'square', vol: 0.12 }); this.tone(220, 0.3, { type: 'square', vol: 0.12, when: 0.15 }); }
  roundWin() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, { type: 'square', vol: 0.11, when: i * 0.09 }));
  }
  matchWin() {
    const seq = [523, 523, 523, 659, 784, 659, 784, 1047];
    const dur = [0.12, 0.12, 0.12, 0.25, 0.12, 0.12, 0.12, 0.6];
    let t = 0;
    seq.forEach((f, i) => { this.tone(f, dur[i] + 0.05, { type: 'square', vol: 0.11, when: t }); this.tone(f / 2, dur[i] + 0.05, { type: 'triangle', vol: 0.08, when: t }); t += dur[i]; });
  }
  click() { this.tone(1200, 0.04, { type: 'square', vol: 0.05 }); }

  // ---- small chiptune loop for menus
  startMusic() {
    if (this.musicOn || !this.ensure()) return;
    this.musicOn = true;
    const ctx = this.ctx;
    const bpm = 132, step = 60 / bpm / 2;
    const bass = [45, 45, 52, 45, 50, 50, 52, 52, 45, 45, 52, 45, 47, 47, 52, 55];
    const lead = [69, 0, 72, 76, 0, 74, 72, 0, 69, 0, 72, 76, 79, 0, 76, 0, 74, 0, 72, 74, 0, 76, 72, 0, 69, 0, 67, 69, 0, 0, 0, 0];
    const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
    let next = ctx.currentTime + 0.1, i = 0;
    const tick = () => {
      if (!this.musicOn) return;
      while (next < ctx.currentTime + 0.25) {
        const b = bass[(i >> 1) % bass.length];
        if (i % 2 === 0) this.musicNote(mtof(b - 12), step * 1.8, 'triangle', 0.5, next);
        const l = lead[i % lead.length];
        if (l) this.musicNote(mtof(l), step * 0.9, 'square', 0.18, next);
        if (i % 4 === 2) this.musicHat(next);
        next += step; i++;
      }
      this.musicTimer = setTimeout(tick, 60);
    };
    tick();
  }
  musicNote(f, dur, type, vol, t) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.music); o.start(t); o.stop(t + dur + 0.02);
  }
  musicHat(t) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource(); s.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    s.connect(f).connect(g).connect(this.music); s.start(t, Math.random()); s.stop(t + 0.06);
  }
  stopMusic() { this.musicOn = false; clearTimeout(this.musicTimer); }
}

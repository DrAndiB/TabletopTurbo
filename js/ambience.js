// Background sounds per world (a quiet bed plus occasional events: birds, clinks, drips, thunder...) and the
// gameplay cues worlds trigger (train whistles, sluice-gate clank, escapement tick). All synthesised.
//
// AMBIENT[id] = { bed: [layer...], ev: [[event, minGap, maxGap, firstAfter, vol]...] }
//   bed layers: { n: noise ('white' | 'pink' | 'brown' | 'crackle' | a loop from makeNoises), f: [filter type, Hz, Q],
//   g: gain, am: [rate Hz, depth 0..1] (slow swell), sweep: [rate Hz, +-Hz] (filter wander) }
//   or { hum: [Hz...], g, type }.
//   events are EV functions below, each a short burst of a few nodes that disconnect when done.
// The Ambience player schedules events ahead on the AudioContext clock (Sound calls pump()).
import { mulberry, hashStr } from './music.js';

const TAU = Math.PI * 2;

// ---------------------------------------------------------------- shared noise and loop buffers
export function makeNoises(ctx) {
  const sr = ctx.sampleRate, r = mulberry(99);
  const buf = (sec, fill) => { const n = Math.floor(sr * sec), b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0); fill(d, n); return b; };
  const N = {};
  N.white = buf(2, (d, n) => { for (let i = 0; i < n; i++) d[i] = r() * 2 - 1; });
  N.pink = buf(2, (d, n) => {
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < n; i++) { const w = r() * 2 - 1; b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0527; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; }
  });
  N.brown = buf(2, (d, n) => { let x = 0; for (let i = 0; i < n; i++) { x = (x + 0.02 * (r() * 2 - 1)) / 1.02; d[i] = x * 3.5; } });
  // sparse pops: fire, sparks, radio static, lift-off crackle
  N.crackle = buf(3, (d, n) => {
    for (let i = 0; i < n; i++) d[i] = 0;
    for (let k = 0; k < 260; k++) {
      const at = Math.floor(r() * (n - 400)), a = (0.2 + r() * 0.8) * (r() < 0.1 ? 1 : 0.4), len = 20 + Math.floor(r() * 140);
      for (let i = 0; i < len; i++) d[at + i] += (r() * 2 - 1) * a * Math.exp(-i / (len * 0.25));
    }
  });
  // grains of grit: gravel and dirt under the tyres
  N.gravel = buf(2, (d, n) => {
    for (let i = 0; i < n; i++) d[i] = (r() * 2 - 1) * 0.08;
    for (let k = 0; k < 900; k++) {
      const at = Math.floor(r() * (n - 300)), a = 0.3 + r() * 0.7, len = 60 + Math.floor(r() * 200), f = 0.05 + r() * 0.25;
      for (let i = 0; i < len; i++) d[at + i] += Math.sin(i * f * TAU * 0.25) * (r() * 2 - 1) * a * Math.exp(-i / (len * 0.3));
    }
  });
  // soft, packed crunch: snow
  N.snow = buf(2, (d, n) => {
    let lp = 0;
    for (let i = 0; i < n; i++) d[i] = 0;
    for (let k = 0; k < 500; k++) {
      const at = Math.floor(r() * (n - 2000)), a = 0.4 + r() * 0.6, len = 400 + Math.floor(r() * 1400);
      for (let i = 0; i < len; i++) { lp += 0.35 * ((r() * 2 - 1) - lp); d[at + i] += lp * a * Math.sin(Math.PI * i / len); }
    }
  });
  // short hits for events
  const hit = (sec, fn) => buf(sec, (d, n) => { for (let i = 0; i < n; i++) d[i] = fn(i / sr); });
  N.clack = hit(0.08, (t) => (Math.sin(TAU * 2650 * t) * 0.7 + Math.sin(TAU * 4100 * t) * 0.3) * Math.exp(-t * 90) + (r() * 2 - 1) * Math.exp(-t * 900) * 0.5);
  N.key = hit(0.05, (t) => (r() * 2 - 1) * Math.exp(-t * 400) * 0.6 + Math.sin(TAU * 1900 * t) * Math.exp(-t * 160) * 0.4);
  N.click = hit(0.03, (t) => (r() * 2 - 1) * Math.exp(-t * 700) * 0.7 + Math.sin(TAU * 3100 * t) * Math.exp(-t * 300) * 0.4);
  N.clock = buf(2, (d, n) => {
    for (let i = 0; i < n; i++) {
      const t = i / sr, u = t % 1, f = t < 1 ? 1800 : 1350;
      d[i] = u < 0.06 ? (Math.sin(TAU * f * u) * 0.6 + (r() * 2 - 1) * 0.4 * Math.exp(-u * 600)) * Math.exp(-u * 120) : 0;
    }
  });
  N.ticks = buf(1, (d, n) => { // a small watch: six light ticks a second
    for (let i = 0; i < n; i++) { const u = (i / sr) % (1 / 6); d[i] = u < 0.03 ? (Math.sin(TAU * 4200 * u) * 0.6 + (r() * 2 - 1) * 0.3) * Math.exp(-u * 260) : 0; }
  });
  N.ratchet = buf(1.1, (d, n) => {
    for (let i = 0; i < n; i++) d[i] = 0;
    for (let k = 0; k < 14; k++) { const at = Math.floor(sr * (k * 0.075 + r() * 0.01)); for (let i = 0; i < 600 && at + i < n; i++) d[at + i] += ((r() * 2 - 1) * 0.6 + Math.sin(TAU * 2300 * i / sr) * 0.5) * Math.exp(-i / (sr * 0.003)); }
  });
  N.bell = buf(4, (d, n) => { // church bell (partials of a minor-third bell), played at any pitch by playbackRate
    const P = [[0.5, 0.5, 3.5], [1, 1, 2.8], [1.19, 0.45, 2.2], [1.5, 0.3, 1.8], [2, 0.35, 1.4], [2.52, 0.18, 0.9], [3.01, 0.12, 0.7]];
    for (let i = 0; i < n; i++) { const t = i / sr; let s = 0; for (const [ra, a, t60] of P) s += Math.sin(TAU * 330 * ra * t) * a * Math.exp(-6.9 * t / t60); d[i] = s * 0.35 * Math.min(1, t * 800); }
  });
  return N;
}

// ---------------------------------------------------------------- tiny helpers for event voices
function out(A, pan) {
  const ctx = A.ctx, g = ctx.createGain(), nodes = [g];
  g.gain.value = 0;
  if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-0.95, Math.min(0.95, pan)); g.connect(p); p.connect(A.bus); nodes.push(p); }
  else g.connect(A.bus);
  return { g, nodes };
}
function osc(ctx, type, f) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; }
function src(A, name, loop = false) { const s = A.ctx.createBufferSource(); s.buffer = A.N[name]; s.loop = loop; return s; }
function filt(ctx, type, f, q = 0.7) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
// stop the sources at `end` and disconnect everything once the first one has ended
function finish(sources, nodes, end) {
  for (const s of sources) s.stop(end);
  sources[0].onended = () => { for (const n of nodes) try { n.disconnect(); } catch (e) { /* gone */ } };
}
function blip(A, t, f, dur, v, pan, type = 'sine') { // a decaying tone
  const { g, nodes } = out(A, pan), o = osc(A.ctx, type, f);
  o.connect(g); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t); finish([o], [o, ...nodes], t + dur + 0.02);
}
function hitBuf(A, t, name, v, pan, rate = 1) {
  const { g, nodes } = out(A, pan), s = src(A, name);
  s.playbackRate.value = rate; s.connect(g); g.gain.value = v;
  s.start(t); finish([s], [s, ...nodes], t + s.buffer.duration / rate + 0.02);
}

// ---------------------------------------------------------------- events (A = {ctx, N, bus}, r = random)
export const EV = {
  birds(A, t, v, r, pan) {
    const { g, nodes } = out(A, pan), o = osc(A.ctx, 'sine', 3000), F = o.frequency, G = g.gain;
    o.connect(g);
    const n = 2 + Math.floor(r() * 5), base = 2400 + r() * 2000, fall = r() < 0.5;
    let tt = t;
    for (let i = 0; i < n; i++) {
      const d = 0.04 + r() * 0.08, f1 = base * (0.85 + r() * 0.3), f2 = f1 * (fall ? 0.68 : 1.45);
      F.setValueAtTime(f1, tt); F.exponentialRampToValueAtTime(f2, tt + d);
      G.setValueAtTime(0, tt); G.linearRampToValueAtTime(v, tt + 0.008); G.linearRampToValueAtTime(0, tt + d);
      tt += d + 0.025 + r() * 0.09;
    }
    o.start(t); finish([o], [o, ...nodes], tt + 0.05);
  },
  trill(A, t, v, r, pan) {
    const ctx = A.ctx, { g, nodes } = out(A, pan), o = osc(ctx, 'sine', 3400 + r() * 1200), l = osc(ctx, 'sine', 22 + r() * 10), lg = ctx.createGain();
    lg.gain.value = 500; l.connect(lg); lg.connect(o.frequency); o.connect(g);
    const d = 0.4 + r() * 0.5;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.04); g.gain.setTargetAtTime(0, t + d, 0.04);
    o.start(t); l.start(t); finish([o, l], [o, l, lg, ...nodes], t + d + 0.2);
  },
  peep(A, t, v, r, pan) { for (let i = 0, n = 1 + Math.floor(r() * 3); i < n; i++) blip(A, t + i * 0.32, 2700 + r() * 300, 0.18, v, pan); },
  clink(A, t, v, r, pan) {
    const f = 2600 + r() * 1800;
    blip(A, t, f, 0.35, v, pan); blip(A, t, f * 2.76, 0.12, v * 0.4, pan);
    if (r() < 0.4) blip(A, t + 0.11 + r() * 0.1, f * 1.07, 0.25, v * 0.7, pan);
  },
  glasses(A, t, v, r, pan) { const f = 3000 + r() * 900; blip(A, t, f, 0.9, v, pan); blip(A, t, f * 2.32, 0.3, v * 0.3, pan); blip(A, t + 0.06 + r() * 0.04, f * 1.13, 0.8, v * 0.8, pan); blip(A, t + 0.06, f * 2.6, 0.25, v * 0.25, pan); },
  kettle(A, t, v, r, pan) {
    const ctx = A.ctx, { g, nodes } = out(A, pan), o = osc(ctx, 'sine', 1900), s = src(A, 'white', true), bp = filt(ctx, 'bandpass', 1900, 25), sg = ctx.createGain();
    sg.gain.value = 0.6; s.connect(bp); bp.connect(sg); sg.connect(g); o.connect(g);
    o.frequency.setValueAtTime(1900, t); o.frequency.linearRampToValueAtTime(2350, t + 4); bp.frequency.setValueAtTime(1900, t); bp.frequency.linearRampToValueAtTime(2350, t + 4);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 1.5); g.gain.setValueAtTime(v, t + 3.5); g.gain.linearRampToValueAtTime(0, t + 4.5);
    o.start(t); s.start(t); finish([o, s], [o, s, bp, sg, ...nodes], t + 4.6);
  },
  mower(A, t, v, r, pan) {
    const ctx = A.ctx, { g, nodes } = out(A, pan), a = osc(ctx, 'sawtooth', 68), b = osc(ctx, 'sawtooth', 69.3), lp = filt(ctx, 'lowpass', 260), am = osc(ctx, 'sine', 9), ag = ctx.createGain();
    a.connect(lp); b.connect(lp); lp.connect(g); ag.gain.value = v * 0.3; am.connect(ag); ag.connect(g.gain);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 4); g.gain.linearRampToValueAtTime(0, t + 9);
    for (const o of [a, b, am]) o.start(t);
    finish([a, b, am], [a, b, am, ag, lp, ...nodes], t + 9.1);
  },
  bee(A, t, v, r, pan) {
    const ctx = A.ctx, { g, nodes } = out(A, 0), o = osc(ctx, 'sawtooth', 200 + r() * 60), l = osc(ctx, 'sine', 7 + r() * 4), lg = ctx.createGain(), bp = filt(ctx, 'bandpass', 900, 1.5);
    lg.gain.value = 14; l.connect(lg); lg.connect(o.frequency); o.connect(bp); bp.connect(g);
    let p = null;
    if (ctx.createStereoPanner) { p = ctx.createStereoPanner(); g.disconnect(); g.connect(p); p.connect(A.bus); const s = r() < 0.5 ? -1 : 1; p.pan.setValueAtTime(-0.8 * s, t); p.pan.linearRampToValueAtTime(0.8 * s, t + 3); }
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 1.4); g.gain.linearRampToValueAtTime(0, t + 3);
    o.start(t); l.start(t); finish([o, l], [o, l, lg, bp, ...nodes, ...(p ? [p] : [])], t + 3.1);
  },
  pop(A, t, v, r, pan) { hitBuf(A, t, 'click', v, pan, 0.4 + r() * 0.3); },
  windup(A, t, v, r, pan) { hitBuf(A, t, 'ratchet', v, pan, 0.85 + r() * 0.3); },
  scratch(A, t, v, r, pan) {
    const ctx = A.ctx, { g, nodes } = out(A, pan), s = src(A, 'white', true), bp = filt(ctx, 'bandpass', 3800, 1.2);
    s.connect(bp); bp.connect(g);
    let tt = t;
    for (let i = 0, n = 4 + Math.floor(r() * 8); i < n; i++) {
      const d = 0.06 + r() * 0.16;
      g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(v * (0.6 + r() * 0.4), tt + 0.02); g.gain.linearRampToValueAtTime(0, tt + d);
      bp.frequency.setValueAtTime(3000 + r() * 2000, tt);
      tt += d + r() * 0.08;
    }
    s.start(t, r()); finish([s], [s, bp, ...nodes], tt + 0.05);
  },
  drip(A, t, v, r, pan) {
    const { g, nodes } = out(A, pan), o = osc(A.ctx, 'sine', 800), f0 = 700 + r() * 500;
    o.connect(g); o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 1.9, t + 0.035);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    o.start(t); finish([o], [o, ...nodes], t + 0.15);
  },
  bubbles(A, t, v, r, pan) {
    const { g, nodes } = out(A, pan), o = osc(A.ctx, 'sine', 500), F = o.frequency, G = g.gain;
    o.connect(g);
    let tt = t;
    for (let i = 0, n = 3 + Math.floor(r() * 6); i < n; i++) {
      const f = 350 + r() * 600;
      F.setValueAtTime(f, tt); F.exponentialRampToValueAtTime(f * 2, tt + 0.04);
      G.setValueAtTime(v * (0.5 + r() * 0.5), tt); G.exponentialRampToValueAtTime(0.001, tt + 0.06);
      tt += 0.07 + r() * 0.12;
    }
    o.start(t); finish([o], [o, ...nodes], tt + 0.05);
  },
  gurgle(A, t, v, r, pan) {
    const ctx = A.ctx, { g, nodes } = out(A, pan), s = src(A, 'brown', true), bp = filt(ctx, 'bandpass', 280, 4);
    s.connect(bp); bp.connect(g);
    let tt = t;
    for (let i = 0, n = 5 + Math.floor(r() * 6); i < n; i++) {
      bp.frequency.setValueAtTime(200 + r() * 260, tt);
      g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(v, tt + 0.03); g.gain.linearRampToValueAtTime(0, tt + 0.1);
      tt += 0.1 + r() * 0.08;
    }
    s.start(t, r()); finish([s], [s, bp, ...nodes], tt + 0.05);
  },
  clacks(A, t, v, r, pan) { hitBuf(A, t, 'clack', v, pan, 0.9 + r() * 0.2); if (r() < 0.6) hitBuf(A, t + 0.12 + r() * 0.2, 'clack', v * 0.6, pan, 0.9 + r() * 0.2); },
  typing(A, t, v, r, pan) { let tt = t; for (let i = 0, n = 5 + Math.floor(r() * 14); i < n; i++) { hitBuf(A, tt, 'key', v * (0.6 + r() * 0.4), pan, 0.8 + r() * 0.4); tt += 0.06 + r() * 0.12; } },
  radio(A, t, v, r, pan) {
    const ctx = A.ctx, { g, nodes } = out(A, pan), s = src(A, 'crackle', true), bp = filt(ctx, 'bandpass', 1600, 1.4), am = osc(ctx, 'square', 18 + r() * 20), ag = ctx.createGain();
    s.connect(bp); bp.connect(g); ag.gain.value = v * 0.5; am.connect(ag); ag.connect(g.gain);
    const d = 0.5 + r() * 0.8;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.05); g.gain.setValueAtTime(v, t + d); g.gain.linearRampToValueAtTime(0, t + d + 0.1);
    s.start(t, r() * 2); am.start(t); finish([s, am], [s, am, ag, bp, ...nodes], t + d + 0.15);
  },
  drill(A, t, v, r, pan) {
    const ctx = A.ctx, { g, nodes } = out(A, pan), o = osc(ctx, 'sawtooth', 380), lp = filt(ctx, 'lowpass', 1400, 2), d = 1 + r() * 1.2;
    o.connect(lp); lp.connect(g);
    o.frequency.setValueAtTime(260, t); o.frequency.setTargetAtTime(470 + r() * 80, t, 0.15); o.frequency.setTargetAtTime(240, t + d, 0.2);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.15); g.gain.setTargetAtTime(0, t + d, 0.15);
    o.start(t); finish([o], [o, lp, ...nodes], t + d + 0.8);
  },
  beeps(A, t, v, r, pan) { const f = r() < 0.5 ? 1250 : 1580; for (let i = 0, n = 2 + Math.floor(r() * 3); i < n; i++) blip(A, t + i * 0.16, i % 2 ? f * 1.25 : f, 0.09, v, pan, 'square'); },
  whistle(A, t, v, r, pan) { CUES.whistle(A, t, pan, v, { far: true }); },
  railclack(A, t, v, r, pan) { for (let i = 0; i < 4; i++) hitBuf(A, t + i * 0.19 + (i % 2) * 0.05, 'clack', v * (i % 2 ? 0.6 : 1), pan, 0.45); },
  ding(A, t, v, r, pan) { const f = [1320, 1480, 1760, 1980][Math.floor(r() * 4)]; blip(A, t, f, 0.45, v, pan); blip(A, t, f * 1.5, 0.3, v * 0.4, pan); blip(A, t, f * 3.01, 0.12, v * 0.2, pan); },
  creak(A, t, v, r, pan) {
    const ctx = A.ctx, { g, nodes } = out(A, pan), o = osc(ctx, 'sawtooth', 95), bp = filt(ctx, 'bandpass', 650 + r() * 300, 5), am = osc(ctx, 'square', 14 + r() * 10), ag = ctx.createGain(), d = 0.8 + r() * 1.2;
    o.connect(bp); bp.connect(g); ag.gain.value = v * 0.45; am.connect(ag); ag.connect(g.gain);
    o.frequency.setValueAtTime(85 + r() * 30, t); o.frequency.linearRampToValueAtTime(120 + r() * 50, t + d);
    am.frequency.setValueAtTime(10 + r() * 6, t); am.frequency.linearRampToValueAtTime(24 + r() * 10, t + d);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * 0.55, t + 0.2); g.gain.linearRampToValueAtTime(0, t + d);
    o.start(t); am.start(t); finish([o, am], [o, am, ag, bp, ...nodes], t + d + 0.05);
  },
  thunder(A, t, v, r, pan) {
    const ctx = A.ctx, { g, nodes } = out(A, pan), s = src(A, 'brown', true), lp = filt(ctx, 'lowpass', 220, 0.8);
    s.connect(lp); lp.connect(g);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.4); g.gain.setTargetAtTime(v * 0.45, t + 0.6, 0.4);
    g.gain.setValueAtTime(v * 0.5, t + 1.6); g.gain.linearRampToValueAtTime(v * 0.8, t + 2); g.gain.setTargetAtTime(0, t + 2.2, 0.9);
    lp.frequency.setValueAtTime(320, t); lp.frequency.setTargetAtTime(140, t + 0.5, 1);
    s.start(t, r()); finish([s], [s, lp, ...nodes], t + 6.5);
  },
  cheer(A, t, v, r, pan) {
    const ctx = A.ctx, { g, nodes } = out(A, pan), s = src(A, 'pink', true), bp = filt(ctx, 'bandpass', 1000, 0.9);
    s.connect(bp); bp.connect(g);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.5); g.gain.setTargetAtTime(0, t + 1.1, 0.4);
    s.start(t, r()); finish([s], [s, bp, ...nodes], t + 3);
  },
  ridebell(A, t, v, r, pan) {
    const ctx = A.ctx, { g, nodes } = out(A, pan), o = osc(ctx, 'sine', 2250), o2 = osc(ctx, 'sine', 5480), am = osc(ctx, 'square', 24), ag = ctx.createGain(), d = 0.8 + r() * 0.8;
    o2.connect(g); o.connect(g); ag.gain.value = v * 0.5; am.connect(ag); ag.connect(g.gain);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * 0.5, t + 0.01); g.gain.setValueAtTime(v * 0.5, t + d); g.gain.linearRampToValueAtTime(0, t + d + 0.3);
    o.start(t); o2.start(t); am.start(t); finish([o, o2, am], [o, o2, am, ag, ...nodes], t + d + 0.35);
  },
  churchbells(A, t, v, r, pan) {
    const ctx = A.ctx, rates = [1, 0.89, 0.8, 0.75, 0.67], n = 4 + Math.floor(r() * 4);
    const { g, nodes } = out(A, pan), lp = filt(ctx, 'lowpass', 1600, 0.6);
    lp.connect(g); g.gain.value = v;
    const srcs = [];
    for (let i = 0; i < n; i++) {
      const s = src(A, 'bell'); s.playbackRate.value = rates[Math.floor(r() * rates.length)] * 0.9;
      s.connect(lp); s.start(t + i * 0.85); srcs.push(s);
    }
    for (const s of srcs) s.stop(t + n * 0.85 + 4.5);
    srcs[srcs.length - 1].onended = () => { for (const x of [...srcs, lp, ...nodes]) try { x.disconnect(); } catch (e) { /* gone */ } };
  },
  coo(A, t, v, r, pan) {
    const ctx = A.ctx, { g, nodes } = out(A, pan), o = osc(ctx, 'sine', 380), am = osc(ctx, 'sine', 28), ag = ctx.createGain(), F = o.frequency;
    o.connect(g); ag.gain.value = v * 0.35; am.connect(ag); ag.connect(g.gain);
    let tt = t;
    for (let i = 0, n = 2 + Math.floor(r() * 2); i < n; i++) {
      const d = i === n - 1 ? 0.55 : 0.32, f = 330 + r() * 40;
      F.setValueAtTime(f, tt); F.linearRampToValueAtTime(f * 1.22, tt + d * 0.35); F.linearRampToValueAtTime(f * 1.05, tt + d);
      g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(v * 0.6, tt + 0.06); g.gain.linearRampToValueAtTime(0, tt + d);
      tt += d + 0.08;
    }
    o.start(t); am.start(t); finish([o, am], [o, am, ag, ...nodes], tt + 0.05);
  },
  splash(A, t, v, r, pan) {
    const ctx = A.ctx, { g, nodes } = out(A, pan), s = src(A, 'white', true), bp = filt(ctx, 'bandpass', 900, 0.8);
    s.connect(bp); bp.connect(g);
    bp.frequency.setValueAtTime(600, t); bp.frequency.exponentialRampToValueAtTime(2400, t + 0.3);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.03); g.gain.setTargetAtTime(0, t + 0.08, 0.12);
    s.start(t, r()); finish([s], [s, bp, ...nodes], t + 0.8);
  },
};

// ---------------------------------------------------------------- per-world background
const AMBIENT = {
  breakfast: { bed: [{ n: 'brown', f: ['lowpass', 400, 0.7], g: 0.05 }], ev: [['birds', 3, 8, 1, 0.022], ['trill', 9, 20, 6, 0.012], ['clink', 5, 13, 3, 0.03], ['kettle', 40, 70, 18, 0.014]] },
  garden: { bed: [{ n: 'pink', f: ['bandpass', 2400, 0.6], g: 0.008, am: [0.11, 0.6] }], ev: [['birds', 2, 6, 0.5, 0.024], ['trill', 6, 14, 3, 0.012], ['bee', 7, 16, 4, 0.02], ['mower', 30, 50, 10, 0.012]] },
  gingerbread: { bed: [{ n: 'crackle', f: ['highpass', 900, 0.7], g: 0.06 }, { n: 'brown', f: ['lowpass', 280, 0.7], g: 0.05, am: [0.4, 0.35] }], ev: [['pop', 2, 6, 1, 0.05]] },
  toybox: { bed: [{ n: 'brown', f: ['lowpass', 300, 0.7], g: 0.03 }], ev: [['windup', 7, 16, 3, 0.03], ['peep', 20, 35, 12, 0.006]] },
  desk: { bed: [{ n: 'clock', g: 0.04 }, { n: 'brown', f: ['lowpass', 350, 0.7], g: 0.025 }], ev: [['scratch', 4, 10, 2, 0.02], ['birds', 15, 30, 8, 0.008]] },
  bathroom: { bed: [{ n: 'brown', f: ['lowpass', 500, 0.7], g: 0.025 }], ev: [['drip', 2.4, 3.6, 0.6, 0.05], ['gurgle', 9, 20, 5, 0.04], ['bubbles', 6, 14, 3, 0.025]] },
  pool: { bed: [{ n: 'pink', f: ['bandpass', 520, 0.8], g: 0.05, am: [0.37, 0.5] }, { n: 'pink', f: ['bandpass', 1400, 1.5], g: 0.02, am: [0.23, 0.6] }], ev: [['clacks', 5, 12, 2, 0.04], ['clink', 9, 20, 6, 0.016]] },
  watertable: { bed: [{ n: 'brown', f: ['lowpass', 650, 0.7], g: 0.07, am: [0.28, 0.6], sweep: [0.17, 200] }, { n: 'white', f: ['bandpass', 2600, 1.2], g: 0.006, am: [0.5, 0.7] }], ev: [['splash', 6, 14, 3, 0.02], ['birds', 8, 18, 5, 0.012]] },
  workshop: { bed: [{ hum: [50, 100, 150], g: 0.006 }, { n: 'crackle', f: ['bandpass', 2000, 1], g: 0.025 }], ev: [['radio', 8, 18, 4, 0.02], ['drill', 18, 35, 9, 0.012]] },
  boardroom: { bed: [{ n: 'white', f: ['lowpass', 900, 0.6], g: 0.018 }, { hum: [120], g: 0.004 }], ev: [['typing', 4, 10, 1.5, 0.03], ['clink', 20, 40, 12, 0.012]] },
  mars: { bed: [{ n: 'white', f: ['bandpass', 650, 0.7], g: 0.05, am: [0.13, 0.7], sweep: [0.07, 380] }], ev: [['beeps', 8, 18, 3, 0.012], ['radio', 14, 28, 9, 0.014]] },
  railway: { bed: [{ n: 'brown', f: ['lowpass', 350, 0.7], g: 0.035 }], ev: [['whistle', 22, 40, 10, 0.45], ['railclack', 10, 22, 5, 0.03], ['birds', 10, 22, 4, 0.01]] },
  pinball: { bed: [{ hum: [60, 120], g: 0.005 }, { n: 'pink', f: ['bandpass', 700, 0.8], g: 0.02, am: [0.3, 0.5] }], ev: [['ding', 2.5, 7, 1, 0.025], ['beeps', 12, 25, 6, 0.008]] },
  chemlab: { bed: [{ n: 'crackle', f: ['highpass', 5000, 0.7], g: 0.03 }, { hum: [100], g: 0.003 }], ev: [['bubbles', 1.5, 4, 0.5, 0.03], ['gurgle', 10, 20, 6, 0.025]] },
  dollhouse: { bed: [{ n: 'white', f: ['bandpass', 450, 3], g: 0.04, am: [0.09, 0.8], sweep: [0.05, 200] }], ev: [['creak', 6, 14, 3, 0.03], ['thunder', 24, 45, 12, 0.09]] },
  watchmaker: { bed: [{ n: 'ticks', g: 0.025 }, { n: 'white', f: ['bandpass', 2200, 2], g: 0.012, am: [11, 0.5] }], ev: [['windup', 12, 25, 6, 0.012]] },
  moselle: { bed: [{ n: 'brown', f: ['lowpass', 500, 0.7], g: 0.035, am: [0.21, 0.4] }], ev: [['glasses', 7, 16, 3, 0.022], ['birds', 3, 8, 1, 0.02], ['peep', 9, 20, 5, 0.012]] },
  fouer: { bed: [{ n: 'pink', f: ['bandpass', 650, 0.7], g: 0.06, am: [0.33, 0.5] }, { n: 'pink', f: ['bandpass', 1700, 1.2], g: 0.02, am: [0.19, 0.6] }], ev: [['ridebell', 10, 22, 4, 0.025], ['cheer', 14, 30, 8, 0.03], ['ding', 6, 14, 3, 0.012]] },
  grund: { bed: [{ n: 'brown', f: ['lowpass', 550, 0.7], g: 0.06, am: [0.4, 0.4] }, { n: 'white', f: ['bandpass', 1300, 1.5], g: 0.01, am: [0.7, 0.6] }], ev: [['bubbles', 2, 6, 1, 0.015], ['churchbells', 45, 70, 15, 0.03], ['birds', 6, 14, 3, 0.012]] },
  oldtown: { bed: [{ n: 'pink', f: ['bandpass', 800, 0.8], g: 0.045, am: [0.29, 0.5] }, { n: 'pink', f: ['bandpass', 2100, 1.4], g: 0.012, am: [0.41, 0.6] }], ev: [['coo', 6, 14, 2, 0.03], ['clink', 10, 22, 5, 0.012], ['peep', 15, 30, 8, 0.008]] },
};
export const ambientFor = (id) => AMBIENT[id] || null;

export class Ambience {
  constructor(A, id, dest) {
    this.def = AMBIENT[id] || { bed: [], ev: [] };
    this.ctx = A.ctx; this.N = A.N;
    this.out = this.ctx.createGain(); this.out.gain.value = 0; this.out.connect(dest);
    this.A = { ctx: A.ctx, N: A.N, bus: this.out };
    this.r = mulberry(hashStr('amb' + id));
    this.srcs = []; this.running = false; this.next = [];
  }
  start(t) {
    const ctx = this.ctx;
    for (const L of this.def.bed) {
      const g = ctx.createGain(); g.gain.value = L.g; g.connect(this.out);
      let s;
      if (L.hum) { for (const f of L.hum) { const o = osc(ctx, L.type || 'sine', f); o.connect(g); o.start(t); this.srcs.push(o); } continue; }
      s = src(this.A, L.n, true); this.srcs.push(s);
      let node = s;
      if (L.f) { const f = filt(ctx, L.f[0], L.f[1], L.f[2]); node.connect(f); node = f; if (L.sweep) this.lfo(L.sweep[0], L.sweep[1], f.frequency, t); }
      node.connect(g);
      if (L.am) this.lfo(L.am[0], L.g * L.am[1], g.gain, t);
      s.start(t, this.r() * 1.5);
    }
    this.next = this.def.ev.map((e) => t + (e[3] ?? 1) + this.r() * 2);
    this.out.gain.setValueAtTime(0, t); this.out.gain.linearRampToValueAtTime(1, t + 1.5);
    this.running = true;
  }
  lfo(rate, depth, param, t) {
    const o = osc(this.ctx, 'sine', rate * (0.9 + this.r() * 0.2)), g = this.ctx.createGain();
    g.gain.value = depth; o.connect(g); g.connect(param); o.start(t); this.srcs.push(o);
  }
  pump(until) {
    if (!this.running) return;
    const now = this.ctx.currentTime;
    this.def.ev.forEach((e, i) => {
      let n = 0;
      while (this.next[i] < until && n++ < 8) {
        if (this.next[i] > now - 0.05) EV[e[0]](this.A, this.next[i], e[4] ?? 0.02, this.r, (this.r() * 2 - 1) * 0.7);
        this.next[i] += e[1] + this.r() * (e[2] - e[1]);
      }
    });
  }
  pause() { if (!this.running) return; this.running = false; const t = this.ctx.currentTime; this.out.gain.cancelScheduledValues(t); this.out.gain.setTargetAtTime(0, t, 0.05); }
  resume() {
    if (this.running || this.stopped) return;
    const t = this.ctx.currentTime; this.running = true;
    this.next = this.next.map((x) => Math.max(x, t + 0.2));
    this.out.gain.cancelScheduledValues(t); this.out.gain.setTargetAtTime(1, t, 0.1);
  }
  stop(fade = 0.6) {
    if (this.stopped) return;
    this.stopped = true; this.running = false;
    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t); this.out.gain.setTargetAtTime(0, t, fade / 4);
    for (const s of this.srcs) try { s.stop(t + fade + 0.1); } catch (e) { /* stopped */ }
    setTimeout(() => { try { this.out.disconnect(); } catch (e) { /* gone */ } }, (fade + 7) * 1000);
  }
}

// ---------------------------------------------------------------- gameplay cues, see Sound.cue()
export const CUES = {
  // steam whistle: a three-note chord with breath, two toots (o.far: distant, muffled, one toot)
  whistle(A, t, pan, v, o = {}) {
    const ctx = A.ctx, { g, nodes } = out(A, pan), lp = filt(ctx, 'lowpass', o.far ? 1300 : 2600, 0.7), s = src(A, 'white', true), bp = filt(ctx, 'bandpass', 1100, 1.5), sg = ctx.createGain();
    const base = o.far ? 470 : 540, oscs = [1, 1.26, 1.5].map((k) => osc(ctx, 'sawtooth', base * k));
    for (const x of oscs) x.connect(lp);
    s.connect(bp); bp.connect(sg); sg.connect(lp); sg.gain.value = 1.4; lp.connect(g);
    const G = g.gain, toots = o.far ? [[0, 1.1]] : [[0, 0.3], [0.42, 0.95]];
    G.setValueAtTime(0, t);
    for (const [a, d] of toots) {
      G.setValueAtTime(0, t + a); G.linearRampToValueAtTime(v * 0.09, t + a + 0.07); G.setValueAtTime(v * 0.09, t + a + d); G.linearRampToValueAtTime(0, t + a + d + 0.15);
      for (const x of oscs) { x.detune.setValueAtTime(-60, t + a); x.detune.linearRampToValueAtTime(0, t + a + 0.1); }
    }
    const end = t + toots[toots.length - 1][0] + toots[toots.length - 1][1] + 0.2;
    for (const x of oscs) x.start(t);
    s.start(t, Math.random());
    finish([...oscs, s], [...oscs, s, bp, sg, lp, ...nodes], end);
  },
  // wooden toy train: a bright two-tone "toot toot"
  toot(A, t, pan, v) {
    const ctx = A.ctx;
    [[0, 880], [0.24, 740]].forEach(([a, f]) => {
      const { g, nodes } = out(A, pan), o1 = osc(ctx, 'triangle', f), o2 = osc(ctx, 'sine', f * 2.01), s = src(A, 'white', true), bp = filt(ctx, 'bandpass', f * 2, 3), sg = ctx.createGain();
      sg.gain.value = 0.25; o1.connect(g); o2.connect(sg); s.connect(bp); bp.connect(sg); sg.connect(g);
      g.gain.setValueAtTime(0, t + a); g.gain.linearRampToValueAtTime(v * 0.12, t + a + 0.03); g.gain.setValueAtTime(v * 0.12, t + a + 0.17); g.gain.linearRampToValueAtTime(0, t + a + 0.22);
      o1.start(t + a); o2.start(t + a); s.start(t + a, Math.random());
      finish([o1, o2, s], [o1, o2, s, bp, sg, ...nodes], t + a + 0.25);
    });
  },
  // a crossing bell strike
  bell(A, t, pan, v) { blip(A, t, 2093, 0.2, v * 0.05, pan); blip(A, t, 3136, 0.12, v * 0.022, pan); },
  // sluice gate about to move: a heavy metal clank and the ratchet
  clank(A, t, pan, v) {
    const ctx = A.ctx, { g, nodes } = out(A, pan), c = osc(ctx, 'sine', 170), m = osc(ctx, 'sine', 170 * 2.41), mg = ctx.createGain();
    mg.gain.setValueAtTime(900, t); mg.gain.exponentialRampToValueAtTime(20, t + 0.25); m.connect(mg); mg.connect(c.frequency); c.connect(g);
    g.gain.setValueAtTime(v * 0.16, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    c.start(t); m.start(t); finish([c, m], [c, m, mg, ...nodes], t + 0.55);
    hitBuf(A, t + 0.12, 'ratchet', v * 0.05, pan, 1.4);
  },
  // the escapement: tick and tock on alternate beats
  tick(A, t, pan, v, o = {}) {
    const f = o.alt ? 2600 : 1950;
    blip(A, t, f, 0.035, v * 0.07, pan, 'square'); blip(A, t + 0.004, f * 2, 0.014, v * 0.03, pan, 'triangle');
    hitBuf(A, t, 'click', v * 0.06, pan, o.alt ? 1.1 : 0.9);
  },
};

// Procedural music for Tabletop Turbo: one original piece per world plus the menu theme. No audio files.
//
// - A piece (PIECES below) is a key, a tempo, chord charts for a few sections, a form and a list of parts.
//   compileSong() turns it into a loop of note events. Melodies are generated from a seed: chord-aware,
//   mostly stepwise, a rhythmic motif that repeats and answers, a contrasting bar and a cadence, so every
//   tune is original (no quotations of existing music).
// - Plucked strings (Karplus-Strong), bells, mallets, pianos and drums are rendered once per pitch into small
//   AudioBuffers (MusicKit.prepare, before the race behind the loading card): a note is then one buffer source
//   and one gain. Leads and basses are persistent monophonic voices played by automation (no nodes per note);
//   organs, accordions and pads create a short-lived oscillator per chord note.
// - Player schedules the loop a few hundred ms ahead (Sound calls pump()), can lock its bars to the game
//   clock (Watchmaker's Bench) and adds a layer and a few % of tempo on the final lap.

const TAU = Math.PI * 2;
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

// ---------------------------------------------------------------- harmony
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const pcOf = (s) => { let p = NOTE[s[0]]; for (let i = 1; i < s.length; i++) p += s[i] === '#' ? 1 : s[i] === 'b' ? -1 : 0; return ((p % 12) + 12) % 12; };
const mod12 = (x) => ((x % 12) + 12) % 12;
const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], mixolydian: [0, 2, 4, 5, 7, 9, 10],
};
const QUAL = {
  '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], 6: [0, 4, 7, 9], m6: [0, 3, 7, 9],
  9: [0, 4, 7, 10, 14], dim: [0, 3, 6], dim7: [0, 3, 6, 9], m7b5: [0, 3, 6, 10], sus4: [0, 5, 7], '7sus4': [0, 5, 7, 10],
};
const chordCache = new Map();
function chord(sym) {
  let c = chordCache.get(sym);
  if (c) return c;
  const m = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/.exec(sym);
  if (!m || !QUAL[m[2]]) throw new Error('music: unknown chord ' + sym);
  const root = pcOf(m[1]), iv = QUAL[m[2]];
  c = { sym, root, iv, bass: m[3] ? pcOf(m[3]) : root, pcs: iv.map((i) => mod12(root + i)) };
  chordCache.set(sym, c);
  return c;
}
// the key's scale with the chord's own tones put in (a chord tone outside the key replaces its neighbours)
function chordScale(ch, scale) {
  const s = new Set(scale);
  for (const pc of ch.pcs) if (!s.has(pc)) { s.delete(mod12(pc + 1)); s.delete(mod12(pc - 1)); s.add(pc); }
  return s;
}
// a bar of a chord chart: 'C', 'C G' (two halves), 'C . G' (C for two thirds); '.' holds the previous chord
function parseBar(str, bs) {
  const toks = str.trim().split(/\s+/), seg = bs / toks.length, out = [];
  toks.forEach((t, i) => {
    if (t === '.' && out.length) out[out.length - 1].len += seg;
    else out.push({ ch: chord(t), at: Math.round(i * seg), len: seg });
  });
  return out;
}
const chordAt = (bar, at) => { let c = bar[0]; for (const x of bar) if (x.at <= at) c = x; return c.ch; };
// rhythm strings, one char per step: 'x' note, 'o' softer note, '.' hold, '-' rest
function parseRhythm(str) {
  const out = [];
  let cur = null;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === 'x' || c === 'o') { cur = { at: i, len: 1, v: c === 'x' ? 1 : 0.6 }; out.push(cur); }
    else if (c === '.' && cur) cur.len++;
    else cur = null;
  }
  return out;
}
const placePc = (pc, center) => { let m = center + mod12(pc - center); if (m - center > 6) m -= 12; return m; };
function nearestIn(list, m) { let b = list[0], d = Infinity; for (const x of list) { const e = Math.abs(x - m); if (e < d) { d = e; b = x; } } return b; }
function notesIn(set, lo, hi) { const out = []; for (let m = lo; m <= hi; m++) if (set.has(mod12(m))) out.push(m); return out; }

// ---------------------------------------------------------------- melody rhythms (one bar each)
const RH = {
  pop: ['x.x.x...x...x.x.', 'x..x..x.x.......', '--x.x.x.x..x....', 'x...x.xx..x.x...', 'x.x...x.x.x.x...'],
  folk: ['x.x.x.x.x...x...', 'x...x.x.x.x.x...', 'x.xxx...x.x.x...', '--x.x.x.x...x...', 'x..x..x.x.x.x...'],
  march: ['x.x.x.x.x.x.x...', 'x..xx...x..xx...', 'x.x.x.x.x...x...', 'x...x.x.x...x...', 'x..xx.x.x.x.x...'],
  lofi: ['x.....x.x.......', '--x...x...x.x...', 'x...x.....x.....', '----x.x.x...x...', 'x.x.....x.......'],
  jazz: ['x.x.xxx.', '-xx.x.x.', 'x..x..x.', 'x.xx-x..', '--x.x.xx', 'xxx.x...'],
  calypso: ['x..x..x.x.x.x...', '--x..x..x.x.x...', 'x..x..x...x.x.x.', 'x.x..x..x...x...', '--x.x..x..x.x...'],
  rock: ['x.x...x.x.x.x...', 'x...x.x.x...x.x.', 'x.x.x.x.x..x..x.', '--x.x.x.x.x.x...', 'x..x..x.x.......'],
  bossa: ['x...x..x..x.x...', '--x...x...x.x...', 'x.....x.x...x...', 'x..x..x...x.....', '--x.x...x.x.....'],
  space: ['x.......x.......', 'x...........x...', 'x...x...x.......', 'x.......x...x...', 'x...............'],
  chip: ['x.x.xxx.x.x.xxx.', 'xxx.x.x.xxx.x.x.', 'x.x.x.x.x.x.x.x.', 'x..x..x.x.x.x.x.', 'x.xxx.x.x.xxx...'],
  funk: ['x..x..x...x.x...', '--x.x..x..x..x..', 'x.xx..x.-.x.x...', 'x...x..x.xx.....', '--x..x.x..x.x...'],
  baroque: ['x.x.x.x.x.x.x.x.', 'x...x.x.x...x.x.', 'x.x.x.xxx...x...', 'x...x...x.x.x.x.', 'xxx.x.x.x.x.x...'],
  ragtime: ['x.xx.x.xx.x.x...', '-x.x.xx.x.x.x...', 'x..x..x.x.x.x...', 'x.x..x..x.xx.x..', '--xx.x.xx...x...'],
  reel: ['x.x.x.x.x.x.x.x.', 'xxx.x.x.xxx.x.x.', 'x.x.xxx.x.x.x...', 'x.xxx.x.x.x.xxx.', 'x.x.x.x.x...x.x.'],
  chamber: ['x.x.x.x.x.xxx...', 'xxx.x.x.x...x.x.', 'x.x.x.xxx.x.x...', 'x...x.x.x.x.x.x.', 'x.xxx.x.x...x...'],
  waltz: ['x...x...x...', 'x.....x.x...', 'x...x.x.x...', 'x.x.x...x...', '----x...x...', 'x...x.......'],
  theremin: ['x...........', 'x.......x...', 'x.....x.....', 'x...x...x...'],
  slow: ['x...............', 'x.......x.......', 'x...........x...', '--------x.......'],
};
const CAD = {
  pop: ['x...........----', 'x.x.x.......----', 'x.......x.......'],
  folk: ['x.......x.......', 'x...........----', 'x.x.x...........'],
  march: ['x...x...x...----', 'x...........----'],
  lofi: ['x...............', 'x.......--------', '--x.............'],
  jazz: ['x.......', 'x...----', '-x......'],
  calypso: ['x..x..x.........', 'x...........----'],
  rock: ['x.......x...----', 'x...........----'],
  bossa: ['x...............', 'x.....x.........'],
  space: ['x...............', 'x.......--------'],
  chip: ['x...x...x.......', 'x.x.x...........'],
  funk: ['x.......--------', 'x..x..x.........'],
  baroque: ['x...x...x.......', 'x.......x.......'],
  ragtime: ['x..x..x.........', 'x...x...x.......'],
  reel: ['x.x.x...x.......', 'x...x...x.......'],
  chamber: ['x.x.x...x.......', 'x...............'],
  waltz: ['x...........', 'x.......----'],
  theremin: ['x...........'],
  slow: ['x...............'],
};
const RHP = {}, CADP = {};
for (const k in RH) { RHP[k] = RH[k].map(parseRhythm); CADP[k] = CAD[k].map(parseRhythm); }

// ---------------------------------------------------------------- instruments
// kind 'buf': rendered per pitch (syn: ks = plucked string, fm = two-operator bell, add = partials
//   [ratio, amp, t60], piano, saw = decaying synth pluck); damp = release when the note ends (s).
// kind 'mono': persistent voice; wave = oscillator type, harmonic amplitudes or {pulse}; env [a, d, s, r];
//   vib [rate, cents, delay]; glide (s); scoop (start pitch ratio); fenv [extra Hz, decay].
// kind 'poly': an oscillator (det: a detuned pair, in cents) per note; busFilter on the part's bus.
const REED = [1, 0.75, 0.62, 0.5, 0.42, 0.35, 0.28, 0.22, 0.18, 0.14, 0.11, 0.08];
export const INST = {
  guitar: { kind: 'buf', syn: 'ks', t60: 2.4, bright: 0.5, pick: 0.18, len: 1.7, damp: 0.12 },
  nylon: { kind: 'buf', syn: 'ks', t60: 2.0, bright: 0.28, pick: 0.22, len: 1.6, damp: 0.14 },
  uke: { kind: 'buf', syn: 'ks', t60: 1.1, bright: 0.62, pick: 0.27, len: 1.1, damp: 0.08 },
  harp: { kind: 'buf', syn: 'ks', t60: 3.0, bright: 0.26, pick: 0.45, len: 2.0 },
  harpsi: { kind: 'buf', syn: 'ks', t60: 1.6, bright: 0.8, pick: 0.08, stretch: 0.3, oct: 0.3, len: 1.3, damp: 0.09 },
  clav: { kind: 'buf', syn: 'ks', t60: 0.6, bright: 0.95, pick: 0.06, stretch: 0.25, len: 0.7, damp: 0.03, drive: 1.6 },
  twang: { kind: 'buf', syn: 'ks', t60: 2.0, bright: 0.62, pick: 0.13, stretch: 0.35, len: 1.5, damp: 0.12, drive: 1.8 },
  chug: { kind: 'buf', syn: 'ks', t60: 0.35, bright: 0.55, pick: 0.15, len: 0.5, damp: 0.07, drive: 2.2 },
  upright: { kind: 'buf', syn: 'ks', t60: 1.3, bright: 0.16, pick: 0.2, len: 1.2, damp: 0.08 },
  pizz: { kind: 'buf', syn: 'ks', t60: 0.5, bright: 0.35, pick: 0.3, len: 0.6 },
  celesta: { kind: 'buf', syn: 'fm', ratio: 4, index: 1.3, idecay: 9, t60: 1.8, len: 1.6 },
  epiano: { kind: 'buf', syn: 'fm', ratio: 1, index: 1.7, idecay: 3, t60: 3.2, len: 2.0, tine: 0.07, damp: 0.18 },
  musicbox: { kind: 'buf', syn: 'add', partials: [[1, 1, 2.4], [6.27, 0.22, 0.45], [17.55, 0.06, 0.12]], click: 0.05, len: 1.8 },
  toypiano: { kind: 'buf', syn: 'add', partials: [[1, 1, 0.9], [3.02, 0.12, 0.3], [6.27, 0.34, 0.22], [17.55, 0.1, 0.05]], click: 0.12, len: 1.0 },
  glock: { kind: 'buf', syn: 'add', partials: [[1, 1, 1.6], [2.76, 0.32, 0.45], [5.4, 0.14, 0.2]], click: 0.05, len: 1.5 },
  xylo: { kind: 'buf', syn: 'add', partials: [[1, 1, 0.45], [3.93, 0.4, 0.14], [9.24, 0.1, 0.05]], click: 0.15, len: 0.6 },
  marimba: { kind: 'buf', syn: 'add', partials: [[1, 1, 0.9], [4, 0.25, 0.25], [9.9, 0.05, 0.07]], click: 0.08, len: 1.0 },
  steel: { kind: 'buf', syn: 'add', partials: [[1, 1, 1.3], [2, 0.6, 0.9], [3, 0.28, 0.55], [4.03, 0.12, 0.3], [5.08, 0.06, 0.18]], click: 0.03, len: 1.3 },
  vibes: { kind: 'buf', syn: 'add', partials: [[1, 1, 2.6], [4, 0.22, 0.6], [10, 0.04, 0.15]], trem: [5.2, 0.35], click: 0.03, len: 2.0, damp: 0.25 },
  piano: { kind: 'buf', syn: 'piano', t60: 2.4, honky: 7, len: 1.6, damp: 0.12 },
  synpluck: { kind: 'buf', syn: 'saw', t60: 0.8, damp: 0.5, len: 0.9 },
  bubble: { kind: 'buf', syn: 'bubble', len: 0.22 },

  popLead: { kind: 'mono', wave: 'square', wave2: 'sawtooth', mix2: 0.6, det2: 7, filter: ['lowpass', 1800, 0.9], vib: [5.5, 6, 0.25], env: [0.008, 0.25, 0.65, 0.08], glide: 0.012, gain: 0.3 },
  chipLead: { kind: 'mono', wave: { pulse: 0.25 }, filter: ['lowpass', 2600, 0.6], env: [0.004, 0.1, 0.8, 0.04], vib: [6, 6, 0.3], gain: 0.22 },
  chipArp: { kind: 'mono', wave: { pulse: 0.125 }, env: [0.003, 0.06, 0.6, 0.02], gain: 0.13 },
  chipBass: { kind: 'mono', wave: 'triangle', env: [0.003, 0.05, 0.9, 0.03], gain: 0.75 },
  fiddle: { kind: 'mono', wave: 'sawtooth', filter: ['lowpass', 2100, 0.7], peak: [900, 1.5, 2.5], vib: [5.4, 7, 0.3], env: [0.045, 0.2, 0.85, 0.1], glide: 0.03, gain: 0.22 },
  theremin: { kind: 'mono', wave: [1, 0.12, 0.04], vib: [4.8, 12, 0.25], env: [0.12, 0.3, 0.9, 0.3], glide: 0.11, gain: 0.4 },
  accordion: { kind: 'mono', wave: REED, wave2: REED, det2: 10, mix2: 0.85, filter: ['lowpass', 2000, 0.5], env: [0.03, 0.1, 0.9, 0.07], gain: 0.2 },
  flute: { kind: 'mono', wave: [1, 0.28, 0.08, 0.04], vib: [5, 7, 0.28], env: [0.06, 0.2, 0.85, 0.1], glide: 0.02, gain: 0.38 },
  oboe: { kind: 'mono', wave: [1, 0.8, 0.55, 0.38, 0.24, 0.15, 0.09, 0.05], filter: ['lowpass', 1900, 0.6], vib: [5.2, 6, 0.28], env: [0.04, 0.2, 0.8, 0.08], glide: 0.02, gain: 0.27 },
  softLead: { kind: 'mono', wave: 'triangle', wave2: 'sine', mix2: 0.7, det2: -1200, filter: ['lowpass', 1500, 0.5], vib: [0.7, 14, 0], env: [0.02, 0.5, 0.55, 0.25], gain: 0.42 },
  bloop: { kind: 'mono', wave: 'sine', wave2: 'triangle', det2: 1200, mix2: 0.25, env: [0.005, 0.15, 0.6, 0.06], glide: 0.03, scoop: 0.84, gain: 0.45 },
  organLead: { kind: 'mono', wave: [1, 0.7, 0.85, 0.45, 0.55, 0.25, 0.3, 0.15, 0.12], filter: ['lowpass', 2600, 0.5], vib: [6.6, 3, 0.2], env: [0.01, 0.1, 0.9, 0.05], gain: 0.2 },
  synLead: { kind: 'mono', wave: 'sawtooth', filter: ['lowpass', 900, 5], fenv: [3200, 0.1], env: [0.005, 0.15, 0.6, 0.05], glide: 0.03, gain: 0.28 },
  popBass: { kind: 'mono', wave: 'sawtooth', wave2: 'sine', mix2: 1.2, filter: ['lowpass', 650, 1], env: [0.005, 0.15, 0.7, 0.05], gain: 0.42 },
  subBass: { kind: 'mono', wave: 'sine', wave2: 'sawtooth', mix2: 0.3, filter: ['lowpass', 900, 0.7], env: [0.01, 0.3, 0.8, 0.1], gain: 0.62 },
  tuba: { kind: 'mono', wave: [1, 0.7, 0.5, 0.35, 0.2, 0.12], filter: ['lowpass', 900, 0.7], env: [0.03, 0.2, 0.75, 0.08], gain: 0.45 },
  slapBass: { kind: 'mono', wave: 'sawtooth', filter: ['lowpass', 450, 4], fenv: [2000, 0.07], env: [0.003, 0.2, 0.6, 0.05], gain: 0.4 },
  rockBass: { kind: 'mono', wave: 'sawtooth', wave2: 'square', mix2: 0.4, filter: ['lowpass', 850, 1], env: [0.004, 0.2, 0.7, 0.04], gain: 0.34 },
  organBass: { kind: 'mono', wave: [1, 0.5, 0.35, 0.2], env: [0.01, 0.1, 0.9, 0.06], gain: 0.5 },

  organ: { kind: 'poly', wave: [1, 0.85, 0.6, 0.55, 0, 0.35, 0, 0.25], env: [0.01, 0.1, 0.9, 0.08], vib: [6.2, 9], gain: 0.15 },
  bandOrgan: { kind: 'poly', wave: [1, 0.7, 0.8, 0.5, 0.55, 0.3, 0.3, 0.2, 0.15, 0.1], env: [0.008, 0.08, 0.85, 0.05], vib: [6.8, 6], gain: 0.12 },
  squeeze: { kind: 'poly', wave: REED, det: [-12, 12], env: [0.03, 0.1, 0.85, 0.06], gain: 0.08 },
  pad: { kind: 'poly', wave: 'sawtooth', det: [-9, 9], busFilter: ['lowpass', 1100, 0.6], env: [0.5, 0.5, 0.8, 0.8], gain: 0.07 },
  strings: { kind: 'poly', wave: 'sawtooth', det: [-7, 6], busFilter: ['lowpass', 1500, 0.5], env: [0.15, 0.3, 0.85, 0.4], vib: [5, 4], gain: 0.07 },
  brass: { kind: 'poly', wave: 'sawtooth', det: [-5, 5], busFilter: ['lowpass', 1800, 1.5], env: [0.02, 0.15, 0.6, 0.08], gain: 0.09 },
  kit: { kind: 'drums' },
};

// ---------------------------------------------------------------- buffer synthesis (plain JS, once per pitch)
function bq(type, f, Q, sr) {
  const w = TAU * Math.min(f, sr * 0.45) / sr, cs = Math.cos(w), al = Math.sin(w) / (2 * Q), a0 = 1 + al;
  let b0, b1, b2;
  if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; }
  else if (type === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; }
  else { b0 = al; b1 = 0; b2 = -al; }
  b0 /= a0; b1 /= a0; b2 /= a0;
  const a1 = -2 * cs / a0, a2 = (1 - al) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x) => { const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
}
function finish(d, peak = 0.8) {
  let m = 0;
  for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > m) m = a; }
  const k = m > 0 ? peak / m : 0, n = d.length, fade = Math.min(n, 256);
  for (let i = 0; i < n; i++) d[i] *= k;
  for (let i = 0; i < fade; i++) d[n - 1 - i] *= i / fade;
  return d;
}
// Karplus-Strong string with a fractional delay (in tune up high), pick position and brightness
function ks1(out, f, sr, p, amp, r) {
  const D = sr / f, s = p.stretch ?? 0.5, L = D - s, Li = Math.floor(L), Lf = L - Li, size = Li + 4;
  const ring = new Float32Array(size);
  const n0 = Math.max(2, Math.round(D)), exc = new Float32Array(n0), a = 0.08 + 0.9 * p.bright;
  let lp = 0;
  for (let i = 0; i < n0; i++) { lp += a * ((r() * 2 - 1) - lp); exc[i] = lp; }
  const pk = Math.max(1, Math.round((p.pick ?? 0.15) * n0));
  for (let i = n0 - 1; i >= pk; i--) exc[i] -= exc[i - pk];
  const t60 = p.t60 * Math.pow(220 / f, 0.5), g = Math.pow(10, -3 / (t60 * f));
  let w = 0, dc = 0, dcy = 0;
  for (let n = 0; n < out.length; n++) {
    const i0 = (w - Li + size * 2) % size, i1 = (i0 - 1 + size) % size, i2 = (i0 - 2 + size) % size;
    const yL = ring[i0] * (1 - Lf) + ring[i1] * Lf, yL1 = ring[i1] * (1 - Lf) + ring[i2] * Lf;
    const y = (n < n0 ? exc[n] : 0) + g * ((1 - s) * yL + s * yL1);
    ring[w] = y; w = (w + 1) % size;
    dcy = y - dc + 0.995 * dcy; dc = y; // DC blocker
    out[n] += dcy * amp;
  }
}
function renderKS(f, sr, p, r) {
  const out = new Float32Array(Math.floor(sr * p.len));
  ks1(out, f, sr, p, 1, r);
  if (p.oct) ks1(out, f * 2.003, sr, p, p.oct, r);
  if (p.drive) { const k = Math.tanh(p.drive); let m = 0; for (const v of out) m = Math.max(m, Math.abs(v)); for (let i = 0; i < out.length; i++) out[i] = Math.tanh(out[i] / m * p.drive) / k; }
  return out;
}
function renderFM(f, sr, p) {
  const n = Math.floor(sr * p.len), out = new Float32Array(n);
  const t60 = p.t60 * Math.pow(440 / f, 0.35), kA = Math.exp(-6.9 / (t60 * sr)), kI = Math.exp(-p.idecay / sr);
  const wc = TAU * f / sr, wm = wc * p.ratio, wt = wc * 14, att = Math.max(1, 0.002 * sr);
  let pc = 0, pm = 0, pt = 0, amp = 1, idx = p.index, ti = p.tine || 0;
  for (let i = 0; i < n; i++) {
    let y = Math.sin(pc + idx * Math.sin(pm));
    if (ti) { y += ti * Math.sin(pt) * Math.exp(-i / (0.05 * sr)); pt += wt; }
    out[i] = y * amp * (i < att ? i / att : 1);
    pc += wc; pm += wm; amp *= kA; idx *= kI;
    if (pc > 1e4) { pc %= TAU; pm %= TAU; pt %= TAU; }
  }
  return out;
}
// sum of decaying partials (recursive oscillators, no Math.sin per sample)
function renderAdd(f, sr, p, r) {
  const n = Math.floor(sr * p.len), out = new Float32Array(n), att = Math.max(1, (p.attack ?? 0.002) * sr);
  for (const [ratio, amp, t60] of p.partials) {
    const fr = f * ratio;
    if (fr > sr * 0.45) continue;
    const w = TAU * fr / sr, c = Math.cos(w), s = Math.sin(w), k = Math.exp(-6.9 / (t60 * Math.pow(440 / Math.max(110, f), 0.25) * sr));
    let x = 1, y = 0, a = amp;
    for (let i = 0; i < n; i++) {
      const nx = x * c - y * s; y = x * s + y * c; x = nx;
      out[i] += y * a; a *= k;
      if ((i & 1023) === 0) { const m = 1 / Math.hypot(x, y); x *= m; y *= m; }
    }
  }
  for (let i = 0; i < Math.min(n, att); i++) out[i] *= i / att;
  if (p.click) { const h = bq('hp', 2500, 0.7, sr); for (let i = 0; i < Math.min(n, sr * 0.01); i++) out[i] += h(r() * 2 - 1) * p.click * Math.exp(-i / (0.0015 * sr)); }
  if (p.trem) { const [rt, dp] = p.trem; for (let i = 0; i < n; i++) out[i] *= 1 - dp * (0.5 - 0.5 * Math.cos(TAU * rt * i / sr)); }
  return out;
}
function renderPiano(f, sr, p, r) {
  const parts = [];
  for (let h = 1; h <= 12; h++) {
    if (f * h > sr * 0.4) break;
    const ratio = h * Math.sqrt(1 + 0.0004 * h * h);
    parts.push([ratio, Math.pow(h, -1.15) * (h === 7 ? 0.3 : 1), p.t60 * Math.pow(h, -0.7)]);
  }
  const a = renderAdd(f, sr, { partials: parts, len: p.len, click: 0.04 }, r);
  if (p.honky) { const b = renderAdd(f * Math.pow(2, p.honky / 1200), sr, { partials: parts, len: p.len }, r); for (let i = 0; i < a.length; i++) a[i] += b[i] * 0.6; }
  return a;
}
function renderSaw(f, sr, p, r) {
  const parts = [];
  for (let h = 1; f * h < Math.min(9000, sr * 0.4); h++) parts.push([h, 1 / h, p.t60 / (1 + h * p.damp)]);
  return renderAdd(f, sr, { partials: parts, len: p.len, attack: 0.003 }, r);
}
function renderBubble(f, sr, p) {
  const n = Math.floor(sr * p.len), out = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    ph += TAU * f * (1 + 0.7 * (1 - Math.exp(-t * 35))) / sr;
    out[i] = Math.sin(ph) * Math.exp(-t * 18) * Math.min(1, t * 400);
  }
  return out;
}
function renderNote(spec, f, sr, r) {
  switch (spec.syn) {
    case 'ks': return renderKS(f, sr, spec, r);
    case 'fm': return renderFM(f, sr, spec);
    case 'add': return renderAdd(f, sr, spec, r);
    case 'piano': return renderPiano(f, sr, spec, r);
    case 'saw': return renderSaw(f, sr, spec, r);
    default: return renderBubble(f, sr, spec);
  }
}

// drums and percussion: rendered once per context
const exp = Math.exp;
function metallic(sr, freqs, t) { let s = 0; for (const f of freqs) s += ((f * t) % 1) < 0.5 ? 1 : -1; return s / freqs.length; }
const HAT = [205.3, 304.4, 369.6, 522.7, 540, 800].map((x) => x * 2.1);
const DRUMS = {
  k: [0.45, (t, r) => Math.sin(TAU * (48 * t + 110 * (1 - exp(-t * 28)) / 28)) * exp(-t * 8) + (r() * 2 - 1) * exp(-t * 600) * 0.3],
  s: [0.3, (t, r, f) => Math.sin(TAU * 190 * t) * exp(-t * 25) * 0.5 + f.hp(r() * 2 - 1) * exp(-t * 15) * 0.8, { hp: ['hp', 1200, 0.7] }],
  h: [0.12, (t, r, f, sr) => f.hp(metallic(sr, HAT, t) * 0.6 + (r() * 2 - 1) * 0.4) * exp(-t * 45), { hp: ['hp', 7000, 0.7] }],
  oh: [0.55, (t, r, f, sr) => f.hp(metallic(sr, HAT, t) * 0.6 + (r() * 2 - 1) * 0.4) * exp(-t * 7), { hp: ['hp', 7000, 0.7] }],
  cl: [0.3, (t, r, f) => { const e = (t < 0.03 ? exp(-((t % 0.011) * 300)) : 0) + exp(-t * 16) * 0.6; return f.bp(r() * 2 - 1) * e; }, { bp: ['bp', 1300, 1.2] }],
  rim: [0.08, (t, r) => Math.sin(TAU * 1700 * t) * exp(-t * 90) + Math.sin(TAU * 820 * t) * exp(-t * 60) * 0.6 + (r() * 2 - 1) * exp(-t * 900) * 0.3],
  sh: [0.14, (t, r, f) => f.hp(r() * 2 - 1) * Math.min(1, t / 0.015) * exp(-Math.max(0, t - 0.015) * 35), { hp: ['hp', 5000, 0.7] }],
  tb: [0.3, (t, r, f) => (f.hp(r() * 2 - 1) * 0.6 + (Math.sin(TAU * 5200 * t) + Math.sin(TAU * 7600 * t) + Math.sin(TAU * 9300 * t)) * 0.2) * exp(-t * 16), { hp: ['hp', 6500, 0.8] }],
  sl: [0.4, (t, r, f) => { let s = 0; for (let j = 0; j < 5; j++) { const t0 = j * 0.013; if (t > t0) s += (Math.sin(TAU * (5200 + j * 830) * t) + 0.6 * Math.sin(TAU * (7300 + j * 610) * t)) * exp(-(t - t0) * 22); } return (s * 0.25 + f.hp(r() * 2 - 1) * 0.35 * exp(-t * 20)); }, { hp: ['hp', 7000, 0.8] }],
  wb: [0.1, (t) => Math.sin(TAU * 1050 * t) * exp(-t * 55) + Math.sin(TAU * 2780 * t) * exp(-t * 90) * 0.3],
  cg: [0.4, (t, r) => Math.sin(TAU * (190 * t + 30 * (1 - exp(-t * 30)) / 30)) * exp(-t * 14) + (r() * 2 - 1) * exp(-t * 300) * 0.2],
  bg: [0.25, (t, r) => Math.sin(TAU * (380 * t + 40 * (1 - exp(-t * 40)) / 40)) * exp(-t * 26) + (r() * 2 - 1) * exp(-t * 400) * 0.2],
  br: [0.3, (t, r, f) => f.lp(r() * 2 - 1) * Math.min(1, t / 0.03) * exp(-t * 14), { lp: ['lp', 3200, 0.6] }],
  tm: [0.6, (t) => Math.sin(TAU * (95 * t + 50 * (1 - exp(-t * 12)) / 12)) * exp(-t * 8)],
  rd: [1.2, (t, r, f, sr) => f.hp(metallic(sr, HAT.map((x) => x * 1.3), t)) * exp(-t * 3) * 0.6 + Math.sin(TAU * 3400 * t) * exp(-t * 5) * 0.2, { hp: ['hp', 5500, 0.7] }],
  cr: [1.6, (t, r, f, sr) => f.hp(r() * 2 - 1 + metallic(sr, HAT, t) * 0.5) * exp(-t * 2.6), { hp: ['hp', 3500, 0.7] }],
  bd: [0.9, (t, r, f) => Math.sin(TAU * (55 * t + 25 * (1 - exp(-t * 6)) / 6)) * exp(-t * 4.5) + f.lp(r() * 2 - 1) * exp(-t * 30) * 0.5, { lp: ['lp', 400, 0.7] }],
  cy: [0.9, (t, r, f, sr) => f.hp(r() * 2 - 1 + metallic(sr, HAT, t) * 0.4) * exp(-t * 5), { hp: ['hp', 4000, 0.7] }],
  tri: [1.2, (t) => (Math.sin(TAU * 4200 * t) + 0.35 * Math.sin(TAU * 8900 * t)) * exp(-t * 3) * Math.min(1, t * 2000)],
  // 8-bit kit: stepped amplitudes and sample-and-hold noise
  ck: [0.2, (t) => Math.round(Math.sin(TAU * (40 * t + 140 * (1 - exp(-t * 40)) / 40)) * exp(-t * 18) * 8) / 8],
  cs: [0.16, (t, r, f) => Math.round(f.sh(t, r, 7000) * exp(-t * 22) * 8) / 8, { sh: 'sh' }],
  ch: [0.05, (t, r, f) => Math.round(f.sh(t, r, 16000) * exp(-t * 70) * 8) / 8, { sh: 'sh' }],
};
function renderDrum(name, sr, r) {
  const [len, fn, fdef] = DRUMS[name];
  const n = Math.floor(sr * len), out = new Float32Array(n), f = {};
  if (fdef) for (const k in fdef) {
    if (fdef[k] === 'sh') { let v = 0, last = -1; f.sh = (t, rr, rate) => { const s = Math.floor(t * rate); if (s !== last) { last = s; v = rr() * 2 - 1; } return v; }; }
    else f[k] = bq(fdef[k][0], fdef[k][1], fdef[k][2], sr);
  }
  for (let i = 0; i < n; i++) out[i] = fn(i / sr, r, f, sr);
  return finish(out, 0.85);
}

// ---------------------------------------------------------------- the pieces
// sections: chord charts, one string per bar. parts (played in this order):
//   melody {inst, rh, range, seed}   double {of, inst, oct}   bass {inst, r, n, center}
//   comp {inst, r, voice, center, strum, arp}   drums {pat: {name: rhythm or [per bar]}, fill}   counter {inst, r, center}
// layer: 'final' plays only on the final lap; secs: only in these sections. gain/pan/send per part.
const B = {
  pop8: { r: 'x.x.x.x.x.x.x.x.', n: ['R', 'R', 'R', 'O', 'R', 'R', '5', 'R'] },
  root4: { r: 'x...x...x...x...', n: ['R', 'R', '5', 'R'] },
  march: { r: 'x.......x.......', n: ['R', '5-'] },
  waltz: { r: 'x...........', n: [['R'], ['5-']] },
  walk2: { r: 'x.x.x.x.', n: ['R', 'S', 'S', 'A'] },
  walk4: { r: 'x...x...x...x...', n: ['R', 'S', 'S', 'A'] },
  bossa: { r: 'x.....x.x.....x.', n: ['R', '5', 'R', '5'] },
  calypso: { r: 'x..x..x.x..x..x.', n: ['R', 'R', '5', 'R', 'R', '5', 'O'] },
  rock8: { r: 'x.x.x.x.x.x.x.x.', n: ['R'] },
  funk: { r: 'x..x..x.x.xx..x.', n: ['R', 'O', 'b7', 'R', '5', 'O', 'R'] },
  pedal: { r: 'x...............', n: ['R'] },
  lofi: { r: 'x.....x.x.......', n: ['R', '5', 'R'] },
  reel: { r: 'x...x.x.x...x.x.', n: ['R', 'R', '5', 'R', 'O', '5'] },
  chip8: { r: 'x.x.x.x.x.x.x.x.', n: ['R', 'O'] },
};
const DR = {
  pop: { pat: { k: 'x.......x.x.....', s: '....x.......x...', cl: '....x.......x...', h: 'x.o.x.o.x.o.x.o.' }, fill: { s: '....x.......x.xx', k: 'x.......x.x.x...' } },
  folk: { pat: { k: 'x.......x.......', rim: '....x.......x...', sh: 'x.o.x.o.x.o.x.o.' }, fill: { rim: '....x.......x.xx' } },
  march: { pat: { bd: 'x.......x.......', s: '..o.x.o...o.x.oo', cy: ['x...............', '................'] }, fill: { s: 'xoxoxoxoxoxox...' } },
  lofi: { pat: { k: 'x......x..x.....', s: '....x.......x...', h: 'x.o.x.o.x.o.xoo.' } },
  bubbly: { pat: { k: 'x.....x...x.....', cl: '....x.......x...', h: '..x...x...x...x.' }, fill: { cl: '....x.......x.xx' } },
  jazz: { pat: { rd: 'x.xxx.xx', h: '..x...x.', br: ['......o.', '...o....'], k: 'o.......' } },
  calypso: { pat: { k: 'x.......x.......', cg: '...x..x....x..x.', bg: 'x.o...o.x.o...o.', sh: 'x.o.x.o.x.o.x.o.' } },
  rock: { pat: { k: 'x.......x.x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', cr: ['x...............', '................', '................', '................'] }, fill: { s: '....x.....xxxxxx' } },
  bossa: { pat: { rim: 'x..x..x...x..x..', sh: 'xoooxoooxoooxooo', k: 'x.....x.x.....x.' } },
  space: { pat: { k: ['x...............', '........o.......'], tri: ['................', '........o.......', '................', '................'] } },
  ragtime: { pat: { br: 'xoooxoooxoooxooo', k: 'x.......x.......', wb: '....x.......x...' } },
  chip: { pat: { ck: 'x.......x.x.....', cs: '....x.......x...', ch: 'x.x.x.x.x.x.x.x.' }, fill: { cs: '....x.......xxxx' } },
  funk: { pat: { k: 'x..x......x..x..', s: '....x..o.o..x...', h: 'xoxoxoxoxoxoxoxo', oh: '..............x.' }, fill: { s: '....x..o.o..xxxx' } },
  organWaltz: { pat: { tm: 'x...........' }, fill: { tm: 'x.......x.x.' } },
  waltz: { pat: { k: 'o...........', br: '....x...x...', sh: 'x.o.x.o.x.o.' } },
  sleigh: { pat: { sl: 'x...o...o...', bd: 'o...........' }, fill: { sl: 'x.o.x.o.x.o.' } },
  bandOrgan: { pat: { bd: 'x.......x.......', cy: 'o...............', s: '..o.o...o.o.o.o.' }, fill: { s: 'xoxoxoxoxoxoxoxo' } },
  folkrock: { pat: { k: 'x.....x.x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', tb: '....x.......x...' }, fill: { s: '....x.......xxxx' } },
  chamber: { pat: { k: 'x.......x.......', rim: '....x.......x...', sh: 'x.o.x.o.x.o.x.o.' } },
};

export const PIECES = {
  // menu theme: calm and unobtrusive (slow, soft chords, music box over electric piano, no drums)
  menu: {
    level: 1.26, bpm: 76, key: 'F', form: 'A B',
    sections: {
      A: ['Fmaj7', 'Am7', 'Bbmaj7', 'C7sus4', 'Fmaj7', 'Dm7', 'Gm7', 'C7sus4'],
      B: ['Bbmaj7', 'Am7', 'Gm7', 'Fmaj7', 'Dm7', 'Bbmaj7', 'Gm7', 'C7sus4'],
    },
    parts: [
      { id: 'lead', play: 'melody', inst: 'musicbox', rh: 'slow', range: [69, 84], seed: 29, send: 0.4, gain: 0.8 },
      { id: 'keys', play: 'comp', inst: 'epiano', r: 'x.......x.......', voice: 'full', center: 60, strum: 0.04, gain: 0.2, send: 0.35 },
      { id: 'harp', play: 'comp', inst: 'harp', r: 'x...x...x...x...', arp: 'up', span: 2, center: 57, gain: 0.55, pan: -0.25, send: 0.35 },
      { id: 'pad', play: 'comp', inst: 'pad', r: 'x...............', voice: 'full', center: 57, send: 0.4, gain: 0.9 },
      { id: 'bass', play: 'bass', inst: 'subBass', ...B.pedal, center: 41, gain: 0.35 },
    ],
  },
  breakfast: {
    level: 0.759, bpm: 128, key: 'D', form: 'A B A C',
    sections: {
      A: ['D', 'A', 'Bm', 'G', 'D', 'A', 'G A', 'D'],
      B: ['G', 'A', 'F#m', 'Bm', 'G', 'A', 'Em', 'A7'],
      C: ['Bm', 'G', 'D', 'A', 'Em', 'F#m', 'G', 'A7'],
    },
    parts: [
      { id: 'lead', play: 'melody', inst: 'popLead', rh: 'pop', range: [64, 80], seed: 11, send: 0.2, gain: 1.0 },
      { id: 'keys', play: 'comp', inst: 'epiano', r: '..x...x...x...x.', voice: 'triad', center: 62, gain: 0.25, pan: -0.25 },
      { id: 'bass', play: 'bass', inst: 'popBass', ...B.pop8, center: 40, gain: 0.422 },
      { id: 'drums', play: 'drums', ...DR.pop, gain: 0.569 },
      { id: 'glock', play: 'double', of: 'lead', inst: 'glock', oct: 12, gain: 0.652, pan: 0.3, layer: 'final' },
      { id: 'shaker', play: 'drums', pat: { sh: 'xoooxoooxoooxooo' }, gain: 0.753, layer: 'final' },
    ],
  },
  garden: {
    level: 2.88, bpm: 116, key: 'G', form: 'A B A',
    sections: { A: ['G', 'C', 'G', 'D', 'Em', 'C', 'D', 'G'], B: ['C', 'G', 'Am', 'Em', 'C', 'G', 'A7', 'D'] },
    parts: [
      { id: 'lead', play: 'melody', inst: 'guitar', rh: 'folk', range: [62, 81], seed: 7, gain: 0.85, pan: 0.15 },
      { id: 'uke', play: 'comp', inst: 'uke', r: 'x...x.o.x.o.x.o.', voice: 'triad', center: 66, strum: 0.014, gain: 0.254, pan: -0.3 },
      { id: 'bass', play: 'bass', inst: 'upright', ...B.root4, center: 40, gain: 0.33 },
      { id: 'drums', play: 'drums', ...DR.folk, gain: 0.203 },
      { id: 'flute', play: 'double', of: 'lead', inst: 'flute', oct: 12, gain: 0.158, layer: 'final', pan: 0.25 },
    ],
  },
  gingerbread: {
    level: 0.733, bpm: 138, meter: 3, key: 'F', form: 'A B A C',
    sections: {
      A: ['F', 'C', 'Dm', 'Bb', 'F', 'Gm', 'C7', 'F'],
      B: ['Bb', 'F', 'Gm', 'C', 'Am', 'Dm', 'G7', 'C7'],
      C: ['Dm', 'Bb', 'F', 'C', 'Bb', 'C', 'F', 'F'],
    },
    parts: [
      { id: 'lead', play: 'melody', inst: 'celesta', rh: 'waltz', range: [69, 88], seed: 5, send: 0.3, gain: 1.0 },
      { id: 'harp', play: 'comp', inst: 'harp', r: 'x...x...x...', arp: 'up', span: 2, center: 57, gain: 1.32, pan: -0.3, send: 0.3 },
      { id: 'pad', play: 'comp', inst: 'strings', r: 'x...........', voice: 'full', center: 62, gain: 1.14, send: 0.35 },
      { id: 'bass', play: 'bass', inst: 'pizz', ...B.waltz, center: 43, gain: 2 },
      { id: 'bells', play: 'drums', ...DR.sleigh, gain: 0.8, pan: 0.25 },
      { id: 'glock', play: 'double', of: 'lead', inst: 'glock', oct: 12, gain: 0.96, layer: 'final', pan: 0.3 },
    ],
  },
  toybox: {
    level: 0.767, bpm: 132, key: 'C', form: 'A B A C',
    sections: {
      A: ['C', 'G7', 'C', 'F', 'C', 'G7', 'C G7', 'C'],
      B: ['F', 'C', 'G', 'C', 'Am', 'D7', 'G', 'G7'],
      C: ['F', 'Bb', 'F', 'C7', 'F', 'Bb', 'C7', 'F'],
    },
    parts: [
      { id: 'lead', play: 'melody', inst: 'toypiano', rh: 'march', range: [67, 86], seed: 21, gain: 1.0 },
      { id: 'xylo', play: 'comp', inst: 'xylo', r: '..x...x...x...x.', arp: 'updown', span: 2, center: 72, gain: 1.19, pan: 0.35 },
      { id: 'pah', play: 'comp', inst: 'toypiano', r: '....x.......x...', voice: 'triad', center: 62, gain: 0.552, pan: -0.25 },
      { id: 'bass', play: 'bass', inst: 'tuba', ...B.march, center: 41, gain: 0.977 },
      { id: 'drums', play: 'drums', ...DR.march, gain: 0.499 },
      { id: 'piccolo', play: 'double', of: 'lead', inst: 'flute', oct: 12, gain: 0.414, layer: 'final' },
    ],
  },
  desk: {
    level: 0.955, bpm: 80, swing: 0.18, key: 'F', form: 'A B A B',
    sections: { A: ['Fmaj7', 'Em7', 'Dm7', 'Cmaj7'], B: ['Bbmaj7', 'Am7', 'Gm7', 'C7sus4'] },
    parts: [
      { id: 'lead', play: 'melody', inst: 'softLead', rh: 'lofi', range: [64, 79], seed: 13, send: 0.25, gain: 1.0 },
      { id: 'keys', play: 'comp', inst: 'epiano', r: 'x.......--x.....', voice: 'full', center: 60, strum: 0.03, gain: 0.201, send: 0.3 },
      { id: 'bass', play: 'bass', inst: 'subBass', ...B.lofi, center: 38, gain: 0.359 },
      { id: 'drums', play: 'drums', ...DR.lofi, gain: 0.472 },
      { id: 'vibes', play: 'double', of: 'lead', inst: 'vibes', oct: 12, gain: 0.711, layer: 'final', pan: 0.3 },
    ],
  },
  bathroom: {
    level: 0.851, bpm: 126, key: 'A', form: 'A B A',
    sections: { A: ['A', 'F#m', 'D', 'E', 'A', 'F#m', 'Bm E', 'A'], B: ['D', 'E', 'C#m', 'F#m', 'Bm', 'E', 'A', 'E7'] },
    parts: [
      { id: 'lead', play: 'melody', inst: 'bloop', rh: 'pop', range: [66, 83], seed: 17, send: 0.25, gain: 1.0 },
      { id: 'pluck', play: 'comp', inst: 'synpluck', r: '..x...x...x...x.', voice: 'triad', center: 64, gain: 0.548, pan: -0.3 },
      { id: 'bass', play: 'bass', inst: 'popBass', r: 'x.xx..x.x.xx..x.', n: ['R', 'O', 'R', 'R', 'R', 'O', 'R', '5'], center: 40, gain: 0.412 },
      { id: 'drums', play: 'drums', ...DR.bubbly, gain: 0.581 },
      { id: 'bubbles', play: 'comp', inst: 'bubble', r: 'x.x.x.x.x.x.x.x.', arp: 'up', span: 2, center: 76, gain: 0.614, pan: 0.35, layer: 'final' },
    ],
  },
  pool: {
    level: 1.19, bpm: 118, sub: 2, swing: 0.3, key: 'Bb', form: 'A B A',
    sections: {
      A: ['Bbmaj7', 'G7', 'Cm7', 'F7', 'Dm7', 'G7', 'Cm7 F7', 'Bbmaj7'],
      B: ['Ebmaj7', 'Ab7', 'Dm7', 'G7', 'Cm7', 'F7', 'Dm7 G7', 'Cm7 F7'],
    },
    parts: [
      { id: 'lead', play: 'melody', inst: 'vibes', rh: 'jazz', range: [65, 84], seed: 29, send: 0.3, pan: 0.15, gain: 1.0 },
      { id: 'piano', play: 'comp', inst: 'piano', r: 'x..x....', voice: 'shell', center: 60, gain: 0.496, pan: -0.25 },
      { id: 'bass', play: 'bass', inst: 'upright', ...B.walk2, center: 38, gain: 0.869 },
      { id: 'drums', play: 'drums', ...DR.jazz, gain: 0.318 },
      { id: 'brush', play: 'drums', pat: { br: 'o.o.o.o.' }, gain: 0.62, layer: 'final' },
    ],
  },
  watertable: {
    level: 0.912, bpm: 112, key: 'C', form: 'A B A',
    sections: { A: ['C', 'F', 'G7', 'C', 'Am', 'F', 'G7', 'C'], B: ['F', 'C', 'G', 'C', 'F', 'C', 'D7', 'G7'] },
    parts: [
      { id: 'lead', play: 'melody', inst: 'steel', rh: 'calypso', range: [64, 84], seed: 31, send: 0.25, gain: 1.0 },
      { id: 'strum', play: 'comp', inst: 'uke', r: '..x...x...x...x.', voice: 'triad', center: 62, strum: 0.01, gain: 0.885, pan: -0.3 },
      { id: 'bass', play: 'bass', inst: 'subBass', ...B.calypso, center: 40, gain: 0.343 },
      { id: 'drums', play: 'drums', ...DR.calypso, gain: 0.45 },
      { id: 'steel2', play: 'counter', inst: 'steel', r: 'x...x...x...x...', center: 67, gain: 0.715, pan: 0.35, layer: 'final' },
    ],
  },
  workshop: {
    level: 1.93, bpm: 140, key: 'E', scale: 'mixolydian', form: 'A B A B',
    sections: { A: ['E', 'E', 'A', 'E', 'B', 'A', 'E', 'B7'], B: ['A', 'A', 'E', 'E', 'C', 'D', 'E', 'E'] },
    parts: [
      { id: 'lead', play: 'melody', inst: 'twang', rh: 'rock', range: [59, 78], seed: 37, pan: 0.2, send: 0.25, gain: 1.0 },
      { id: 'rhythm', play: 'comp', inst: 'chug', r: 'x.x.x.x.x.x.x.x.', voice: 'power', center: 52, gain: 0.153, pan: -0.35 },
      { id: 'bass', play: 'bass', inst: 'rockBass', ...B.rock8, center: 40, gain: 0.32 },
      { id: 'drums', play: 'drums', ...DR.rock, gain: 0.229 },
      { id: 'tamb', play: 'drums', pat: { tb: 'x.o.x.o.x.o.x.o.' }, gain: 0.509, layer: 'final', pan: 0.3 },
    ],
  },
  boardroom: {
    level: 0.63, bpm: 126, key: 'F', form: 'A B A',
    sections: {
      A: ['Fmaj7', 'Dm7', 'Gm7', 'C7', 'Am7', 'D7', 'Gm7 C7', 'Fmaj7'],
      B: ['Bbmaj7', 'Bbm6', 'Am7', 'Dm7', 'Gm7', 'C9', 'Fmaj7', 'Gm7 C7'],
    },
    parts: [
      { id: 'lead', play: 'melody', inst: 'flute', rh: 'bossa', range: [64, 81], seed: 41, send: 0.3, gain: 1.0 },
      { id: 'guitar', play: 'comp', inst: 'nylon', r: 'x..x..x...x..x..', voice: 'full', center: 58, strum: 0.008, gain: 0.546, pan: -0.3 },
      { id: 'bass', play: 'bass', inst: 'subBass', ...B.bossa, center: 38, gain: 0.398 },
      { id: 'drums', play: 'drums', ...DR.bossa, gain: 0.515 },
      { id: 'vibes', play: 'double', of: 'lead', inst: 'vibes', oct: 0, gain: 0.552, layer: 'final', pan: 0.3 },
    ],
  },
  mars: {
    level: 0.661, bpm: 96, key: 'D', scale: 'minor', form: 'A B A',
    sections: { A: ['Dm', 'Bb', 'C', 'Am', 'Dm', 'Bb', 'Gm', 'A'], B: ['F', 'C', 'Gm', 'Dm', 'Bb', 'F', 'Gm', 'A7sus4'] },
    parts: [
      { id: 'lead', play: 'melody', inst: 'theremin', rh: 'space', range: [58, 77], seed: 43, send: 0.45, gain: 1.0 },
      { id: 'arp', play: 'comp', inst: 'synpluck', r: 'x.x.x.x.x.x.x.x.', arp: 'updown', span: 2, center: 57, gain: 0.982, pan: -0.3, send: 0.35 },
      { id: 'pad', play: 'comp', inst: 'pad', r: 'x...............', voice: 'full', center: 57, send: 0.4, gain: 1.17 },
      { id: 'bass', play: 'bass', inst: 'subBass', ...B.pedal, center: 38, gain: 0.513 },
      { id: 'drums', play: 'drums', ...DR.space, gain: 1.32 },
      { id: 'arp2', play: 'comp', inst: 'synpluck', r: '..x...x...x...x.', arp: 'up', span: 1, center: 76, gain: 1.68, pan: 0.35, send: 0.4, layer: 'final' },
    ],
  },
  railway: {
    level: 1.16, bpm: 100, key: 'C', form: 'A B A',
    sections: { A: ['C', 'A7', 'D7', 'G7', 'C', 'E7', 'F G7', 'C'], B: ['F', 'F#dim7', 'C/G', 'A7', 'D7', 'G7', 'C', 'G7'] },
    parts: [
      { id: 'lead', play: 'melody', inst: 'piano', rh: 'ragtime', range: [64, 84], seed: 47, gain: 0.9 },
      { id: 'stride', play: 'comp', inst: 'piano', r: '....x.......x...', voice: 'triad', center: 58, gain: 0.293 },
      { id: 'bass', play: 'bass', inst: 'piano', ...B.march, center: 41, gain: 0.661 },
      { id: 'drums', play: 'drums', ...DR.ragtime, gain: 0.387 },
      { id: 'clank', play: 'drums', pat: { wb: '..o...o...o...o.' }, gain: 1.05, layer: 'final' },
    ],
  },
  pinball: {
    level: 1.8, bpm: 156, key: 'A', scale: 'minor', form: 'A B A C',
    sections: {
      A: ['Am', 'F', 'G', 'E', 'Am', 'F', 'G E', 'Am'],
      B: ['F', 'G', 'Em', 'Am', 'Dm', 'G', 'C', 'E7'],
      C: ['Dm', 'E', 'Am', 'F', 'Dm', 'E', 'Am', 'E7'],
    },
    parts: [
      { id: 'lead', play: 'melody', inst: 'chipLead', rh: 'chip', range: [64, 83], seed: 53, gain: 1.0 },
      { id: 'arp', play: 'comp', inst: 'chipArp', r: 'xxxxxxxxxxxxxxxx', arp: 'up', span: 1, center: 64, gain: 1.36 },
      { id: 'bass', play: 'bass', inst: 'chipBass', ...B.chip8, center: 40, gain: 0.188 },
      { id: 'drums', play: 'drums', ...DR.chip, gain: 0.259 },
      { id: 'harm', play: 'counter', inst: 'chipLead', r: 'x.......x.......', center: 69, gain: 0.536, layer: 'final' },
    ],
  },
  chemlab: {
    level: 1.62, bpm: 104, key: 'E', scale: 'dorian', form: 'A B A',
    sections: {
      A: ['Em7', 'A7', 'Em7', 'A7', 'Em7', 'A7', 'Cmaj7', 'B7'],
      B: ['Am7', 'D7', 'Gmaj7', 'Cmaj7', 'Am7', 'D7', 'F#m7b5', 'B7'],
    },
    parts: [
      { id: 'lead', play: 'melody', inst: 'synLead', rh: 'funk', range: [62, 79], seed: 59, send: 0.2, gain: 1.0 },
      { id: 'clav', play: 'comp', inst: 'clav', r: '..x..x....x..x..', voice: 'full', center: 62, gain: 0.468, pan: -0.3 },
      { id: 'bass', play: 'bass', inst: 'slapBass', ...B.funk, center: 40, gain: 0.569 },
      { id: 'drums', play: 'drums', ...DR.funk, gain: 0.269 },
      { id: 'brass', play: 'comp', inst: 'brass', r: 'x.....x.........', voice: 'triad', center: 67, pan: 0.3, secs: ['B'] },
      { id: 'bubbles', play: 'comp', inst: 'bubble', r: '..x.x...x...x.x.', arp: 'updown', span: 2, center: 74, gain: 0.434, pan: 0.35, layer: 'final' },
    ],
  },
  dollhouse: {
    level: 0.624, bpm: 138, meter: 3, key: 'D', scale: 'minor', form: 'A B A C',
    sections: {
      A: ['Dm', 'Gm', 'A7', 'Dm', 'Bb', 'Gm', 'E7', 'A7'],
      B: ['F', 'C', 'Dm', 'A', 'Bb', 'Gm', 'A7', 'Dm'],
      C: ['Gm', 'Dm', 'E7', 'A', 'Dm', 'Bb', 'A7', 'Dm'],
    },
    parts: [
      { id: 'lead', play: 'melody', inst: 'theremin', rh: 'theremin', range: [58, 77], seed: 61, send: 0.4, gain: 1.0 },
      { id: 'organ', play: 'comp', inst: 'organ', r: '----x...x...', voice: 'triad', center: 60, pan: -0.15, send: 0.3, gain: 1.84 },
      { id: 'bass', play: 'bass', inst: 'organBass', ...B.waltz, center: 38, gain: 0.804 },
      { id: 'box', play: 'counter', inst: 'celesta', r: '........x...', center: 79, gain: 0.896, pan: 0.35, send: 0.4 },
      { id: 'drums', play: 'drums', ...DR.organWaltz, gain: 0.711 },
      { id: 'musicbox', play: 'double', of: 'lead', inst: 'musicbox', oct: 12, gain: 0.789, layer: 'final', pan: 0.25 },
    ],
  },
  watchmaker: {
    // one bar = one swing of the balance wheel (BAL.P = 2.8 s), a chord per beat (1.4 s); see sync
    level: 1.02, bpm: 60 / 0.7, key: 'G', form: 'A B', sync: { bar: 2.8 },
    sections: {
      A: ['G D', 'Em Bm', 'C G', 'Am D', 'G D/F#', 'Em C', 'Am D7', 'G'],
      B: ['Em B7', 'Em Am', 'D7 G', 'C B7', 'Em Am', 'D G', 'C D7', 'G'],
    },
    parts: [
      { id: 'lead', play: 'melody', inst: 'musicbox', rh: 'baroque', range: [72, 91], seed: 67, send: 0.3, pan: 0.15, gain: 1.0 },
      { id: 'harpsi', play: 'comp', inst: 'harpsi', r: 'xxxxxxxxxxxxxxxx', arp: 'alberti', center: 60, gain: 1.11, pan: -0.25 },
      { id: 'bass', play: 'bass', inst: 'harpsi', ...B.walk4, center: 45, gain: 1.64 },
      { id: 'box2', play: 'comp', inst: 'musicbox', r: '..x...x...x...x.', arp: 'updown', span: 2, center: 79, gain: 0.51, pan: 0.35, layer: 'final' },
    ],
  },
  moselle: {
    level: 2.57, bpm: 144, meter: 3, key: 'G', form: 'A B A B',
    sections: { A: ['G', 'Em', 'Am', 'D7', 'G', 'B7', 'C . D7', 'G'], B: ['C', 'G', 'D', 'G', 'Em', 'A7', 'D', 'D7'] },
    parts: [
      { id: 'lead', play: 'melody', inst: 'accordion', rh: 'waltz', range: [60, 79], seed: 71, send: 0.25, pan: 0.15, gain: 1.0 },
      { id: 'guitar', play: 'comp', inst: 'guitar', r: '----x...x...', voice: 'triad', center: 60, strum: 0.012, gain: 0.261, pan: -0.3 },
      { id: 'bass', play: 'bass', inst: 'guitar', ...B.waltz, center: 45, gain: 0.669 },
      { id: 'drums', play: 'drums', ...DR.waltz, gain: 0.182 },
      { id: 'squeeze', play: 'comp', inst: 'squeeze', r: '----x...x...', voice: 'triad', center: 64, gain: 0.541, layer: 'final' },
    ],
  },
  fouer: {
    level: 2.14, bpm: 128, key: 'F', form: 'A B A C',
    sections: {
      A: ['F', 'C7', 'F', 'Bb', 'F', 'C7', 'F C7', 'F'],
      B: ['C', 'G7', 'C', 'F', 'Dm', 'G7', 'C', 'C7'],
      C: ['Bb', 'F7', 'Bb', 'Eb', 'Bb', 'F7', 'Bb', 'C7'],
    },
    parts: [
      { id: 'lead', play: 'melody', inst: 'organLead', rh: 'march', range: [62, 80], seed: 73, send: 0.25, gain: 1.0 },
      { id: 'glock', play: 'double', of: 'lead', inst: 'glock', oct: 12, gain: 0.187, pan: 0.3 },
      { id: 'pah', play: 'comp', inst: 'bandOrgan', r: '....x.......x...', voice: 'triad', center: 60, pan: -0.2, gain: 0.785 },
      { id: 'bass', play: 'bass', inst: 'tuba', ...B.march, center: 41, gain: 0.351 },
      { id: 'drums', play: 'drums', ...DR.bandOrgan, gain: 0.188 },
      { id: 'roll', play: 'drums', pat: { s: 'oooooooooooooooo' }, gain: 0.215, layer: 'final' },
    ],
  },
  grund: {
    level: 2.09, bpm: 132, key: 'D', scale: 'mixolydian', form: 'A B A B',
    sections: { A: ['D', 'D', 'C', 'G', 'D', 'D', 'G A', 'D'], B: ['Bm', 'G', 'D', 'A', 'Bm', 'G', 'Em A', 'D'] },
    parts: [
      { id: 'lead', play: 'melody', inst: 'fiddle', rh: 'reel', range: [57, 77], seed: 79, send: 0.25, pan: 0.15, gain: 1.0 },
      { id: 'guitar', play: 'comp', inst: 'guitar', r: 'x...x.o.x.o.x.o.', voice: 'triad', center: 59, strum: 0.012, gain: 0.264, pan: -0.3 },
      { id: 'bass', play: 'bass', inst: 'rockBass', ...B.reel, center: 40, gain: 0.3 },
      { id: 'drums', play: 'drums', ...DR.folkrock, gain: 0.218 },
      { id: 'fiddle2', play: 'counter', inst: 'fiddle', r: 'x.......x.......', center: 66, gain: 0.554, pan: -0.15, layer: 'final' },
    ],
  },
  oldtown: {
    level: 2.29, bpm: 138, key: 'A', form: 'A B A C',
    sections: {
      A: ['A', 'E/G#', 'F#m', 'C#m/E', 'D', 'A/C#', 'Bm7 E', 'A'],
      B: ['D', 'E', 'C#m', 'F#m', 'Bm', 'E', 'A', 'E7'],
      C: ['F#m', 'D', 'A', 'E', 'D', 'C#m', 'Bm7', 'E7'],
    },
    parts: [
      { id: 'lead', play: 'melody', inst: 'oboe', rh: 'chamber', range: [60, 79], seed: 83, send: 0.25, pan: 0.1, gain: 1.0 },
      { id: 'harpsi', play: 'comp', inst: 'harpsi', r: 'x.x.x.x.x.x.x.x.', arp: 'updown', span: 2, center: 57, gain: 0.54, pan: -0.3 },
      { id: 'pad', play: 'comp', inst: 'strings', r: 'x...............', voice: 'full', center: 62, gain: 0.304, send: 0.3 },
      { id: 'bass', play: 'bass', inst: 'pizz', ...B.root4, center: 43, gain: 0.697 },
      { id: 'drums', play: 'drums', ...DR.chamber, gain: 0.168 },
      { id: 'glock', play: 'double', of: 'lead', inst: 'glock', oct: 12, gain: 0.194, layer: 'final', pan: 0.3 },
    ],
  },
};
// worlds without a piece of their own (new or renamed worlds) borrow one
export const pieceFor = (id) => PIECES[id] ? id : 'breakfast';

// ---------------------------------------------------------------- compiling a piece into note events
function genMelody(sec, o, r) {
  const nb = sec.length, PL = nb % 4 === 0 ? 4 : nb % 3 === 0 ? 3 : nb;
  const [lo, hi] = o.range, mid = (lo + hi) / 2, span = hi - lo;
  const rhs = RHP[o.rh], cads = CADP[o.rh];
  const pick = (list, not) => { for (let k = 0; k < 10; k++) { const x = list[Math.floor(r() * list.length)]; if (x !== not) return x; } return list[0]; };
  const mA = pick(rhs), mB = pick(rhs, mA), cad1 = pick(cads), cad2 = cads.length > 1 ? pick(cads, cad1) : cad1;
  const scaleOf = (ch) => notesIn(chordScale(ch, o.scale), lo - 2, hi + 2);
  const toneOf = (ch) => notesIn(new Set(ch.pcs), lo, hi);
  const bars = [];
  let prev = nearestIn(toneOf(sec[0][0].ch), mid), last = 0, motif = null;
  for (let b = 0; b < nb; b++) {
    const pos = b % PL, ph = Math.floor(b / PL), lastPh = ph === Math.floor((nb - 1) / PL), bar = sec[b];
    if (ph % 2 === 1 && pos < 2 && bars[b - PL]) {
      // the answering phrase opens like the first one (fitted to its chords)
      bars[b] = bars[b - PL].map((n) => {
        const ch = chordAt(bar, n.at), sc = scaleOf(ch);
        let m = sc.includes(n.midi) ? n.midi : nearestIn(sc, n.midi);
        if (n.strong) m = nearestIn(toneOf(ch), m);
        return { ...n, midi: m };
      });
      prev = bars[b][bars[b].length - 1]?.midi ?? prev;
      continue;
    }
    const cadBar = pos === PL - 1;
    const rh = cadBar ? (lastPh ? cad1 : cad2) : pos === 2 ? mB : mA;
    const notes = [];
    rh.forEach((n, j) => {
      const ch = chordAt(bar, n.at), sc = scaleOf(ch), ct = toneOf(ch);
      const strong = n.at % (o.sub * (o.meter === 3 ? 3 : 2)) === 0 || n.len >= o.sub * 2;
      let m;
      if (cadBar && j === 0) {
        const want = lastPh ? [ch.root] : [mod12(ch.root + ch.iv[1]), mod12(ch.root + ch.iv[2])];
        m = nearestIn(notesIn(new Set(want), lo, hi), prev);
      } else if (pos === 1 && motif && rh === mA && j < motif.length) {
        // the motif again, as a sequence on the new chord
        if (j === 0) m = nearestIn(ct, prev + (r() < 0.5 ? 2 : -1));
        else { const i = sc.indexOf(nearestIn(sc, prev)); m = sc[Math.max(0, Math.min(sc.length - 1, i + motif[j]))]; }
      } else {
        let d;
        if (Math.abs(last) >= 3) d = -Math.sign(last); // fill the gap after a leap
        else {
          const mags = [0, 1, 1, 1, 1, 2, 2, 3, 4], mag = mags[Math.floor(r() * mags.length)];
          const phase = (pos + n.at / o.bs) / PL;
          const up = r() < 0.5 + (phase < 0.5 ? 0.15 : -0.15) + ((mid - prev) / span) * 0.9;
          d = mag * (up ? 1 : -1);
        }
        const i = sc.indexOf(nearestIn(sc, prev));
        m = sc[Math.max(0, Math.min(sc.length - 1, i + d))];
      }
      if (strong) m = nearestIn(ct, m);
      m = Math.max(lo, Math.min(hi, m));
      const i0 = sc.indexOf(nearestIn(sc, prev)), i1 = sc.indexOf(nearestIn(sc, m));
      last = i1 - i0;
      notes.push({ at: n.at, len: n.len, midi: m, v: n.v * (strong ? 1 : 0.85), strong, step: last });
      prev = m;
    });
    if (pos === 0) motif = notes.map((n) => n.step);
    bars[b] = notes;
  }
  return bars;
}

function voicing(ch, center, kind, prev) {
  let pcs;
  if (kind === 'power') pcs = [ch.root, mod12(ch.root + 7)];
  else if (kind === 'shell') pcs = [mod12(ch.root + ch.iv[1]), mod12(ch.root + (ch.iv[3] ?? ch.iv[2]))];
  else if (kind === 'triad') pcs = ch.pcs.slice(0, 3);
  else pcs = ch.pcs.length > 4 ? [ch.pcs[0], ch.pcs[1], ch.pcs[3], ch.pcs[4]] : ch.pcs;
  let best = null, bc = Infinity;
  for (let k = 0; k < pcs.length; k++) {
    const order = pcs.slice(k).concat(pcs.slice(0, k)), notes = [];
    let m = center - 7 + mod12(order[0] - (center - 7));
    for (const pc of order) { while (mod12(m) !== pc) m++; notes.push(m); m++; }
    let cost = Math.abs(notes.reduce((a, b) => a + b, 0) / notes.length - center);
    if (prev && prev.length === notes.length) for (let i = 0; i < notes.length; i++) cost += 0.2 * Math.abs(notes[i] - prev[i]);
    if (cost < bc) { bc = cost; best = notes; }
  }
  if (kind === 'power') best.push(best[0] + 12);
  return best;
}

export function compileSong(id) {
  const P = PIECES[id];
  const meter = P.meter || 4, sub = P.sub || 4, bs = meter * sub, stepDur = 60 / P.bpm / sub;
  const keyPc = pcOf(P.key), scale = (SCALES[P.scale || 'major']).map((i) => mod12(i + keyPc));
  const secs = {};
  for (const k in P.sections) secs[k] = P.sections[k].map((b) => parseBar(b, bs));
  const bars = [], reps = {};
  for (const name of P.form.split(/\s+/)) {
    reps[name] = (reps[name] ?? -1) + 1;
    secs[name].forEach((ch, i) => bars.push({ sec: name, i, n: secs[name].length, rep: reps[name], ch, start: bars.length * bs, last: i === secs[name].length - 1 }));
  }
  const steps = bars.length * bs, ev = [];
  const check = (s, what) => { if (s.length !== bs) console.warn(`music ${id}: ${what} rhythm '${s}' is ${s.length} steps, the bar has ${bs}`); return s; };
  const nextRoot = (b, at) => { const bar = bars[b]; for (const c of bar.ch) if (c.at > at) return c.ch.bass; return bars[(b + 1) % bars.length].ch[0].ch.bass; };
  const order = [...new Set(P.form.split(/\s+/))];
  for (const part of P.parts) {
    const r = mulberry(part.seed ?? hashStr(id + part.id));
    const push = (step, dur, midi, vel, off = 0) => ev.push({ step, dur, part: part.id, midi, vel, off, layer: part.layer || null });
    const inSecs = (bar) => !part.secs || part.secs.includes(bar.sec);
    if (part.play === 'melody') {
      const mel = {};
      order.forEach((name, k) => {
        const sh = [0, 3, -2, 5][k % 4];
        mel[name] = genMelody(secs[name], { range: [part.range[0] + sh, part.range[1] + sh], rh: part.rh, scale, sub, meter, bs }, mulberry((part.seed ?? 1) * 977 + k * 131));
      });
      for (const bar of bars) if (inSecs(bar)) for (const n of mel[bar.sec][bar.i]) push(bar.start + n.at, n.len, n.midi, n.v);
    } else if (part.play === 'double') {
      for (const e of ev.filter((x) => x.part === part.of)) ev.push({ ...e, part: part.id, midi: e.midi + (part.oct || 0), layer: part.layer || e.layer });
    } else if (part.play === 'bass') {
      const rh = parseRhythm(check(part.r, 'bass'));
      let prev = part.center;
      bars.forEach((bar, b) => {
        if (!inSecs(bar)) return;
        const toks = Array.isArray(part.n[0]) ? part.n[b % part.n.length] : part.n;
        rh.forEach((o, j) => {
          const ch = chordAt(bar.ch, o.at), tok = toks[j % toks.length];
          const root = placePc(ch.bass, part.center);
          const sc = chordScale(ch, scale);
          let m = root;
          if (tok === 'O') m = root + 12;
          else if (tok === '5') m = root + (ch.iv.includes(6) && !ch.iv.includes(7) ? 6 : 7);
          else if (tok === '5-') m = root - 5;
          else if (tok === '3') m = root + ch.iv[1];
          else if (tok === 'b7') m = root + 10;
          else if (tok === 'A' || tok === 'S') {
            const target = placePc(nextRoot(b, o.at), prev);
            if (tok === 'A') m = target + (target > prev ? -1 : 1);
            else { const dir = Math.sign(target - prev) || 1; m = prev + dir; while (!sc.has(mod12(m))) m += dir; if (m === target) m += dir; }
          }
          while (m < part.center - 9) m += 12;
          while (m > part.center + 12) m -= 12;
          prev = m;
          push(bar.start + o.at, o.len, m, o.v);
        });
      });
    } else if (part.play === 'comp') {
      const rh = parseRhythm(check(part.r, 'comp'));
      let prevV = null, k = 0;
      for (const bar of bars) {
        if (!inSecs(bar)) continue;
        for (const o of rh) {
          const ch = chordAt(bar.ch, o.at);
          let v = voicing(ch, part.center, part.voice || 'triad', prevV);
          prevV = v;
          if (part.arp) {
            if (part.span === 2) v = v.concat(v.map((x) => x + 12));
            let seq = v;
            if (part.arp === 'updown') seq = v.concat(v.slice(1, -1).reverse());
            else if (part.arp === 'alberti') seq = [v[0], v[2] ?? v[1], v[1], v[2] ?? v[1]];
            push(bar.start + o.at, o.len, seq[k++ % seq.length], o.v);
          } else {
            const up = o.v < 1 && part.strum; // soft strokes are up-strums
            const notes = up ? [...v].reverse() : v;
            notes.forEach((m, i) => push(bar.start + o.at, o.len, m, o.v * (up ? 0.8 : 1), (part.strum || 0) * i));
          }
        }
      }
    } else if (part.play === 'counter') {
      const rh = parseRhythm(check(part.r, 'counter'));
      let prev = part.center;
      for (const bar of bars) {
        if (!inSecs(bar)) continue;
        for (const o of rh) {
          const ch = chordAt(bar.ch, o.at);
          const pref = [mod12(ch.root + ch.iv[1]), mod12(ch.root + (ch.iv[3] ?? ch.iv[2]))];
          const m = nearestIn(notesIn(new Set(pref), part.center - 6, part.center + 7), prev);
          prev = m;
          push(bar.start + o.at, o.len, m, o.v * 0.9);
        }
      }
    } else if (part.play === 'drums') {
      bars.forEach((bar, b) => {
        if (!inSecs(bar)) return;
        const pat = bar.last && part.fill ? { ...part.pat, ...part.fill } : part.pat;
        for (const name in pat) {
          const s = Array.isArray(pat[name]) ? pat[name][bar.i % pat[name].length] : pat[name];
          for (const o of parseRhythm(check(s, 'drum ' + name))) push(bar.start + o.at, 1, name, o.v * (0.92 + r() * 0.16));
        }
      });
    }
  }
  const events = new Array(steps);
  for (const e of ev) (events[e.step % steps] ||= []).push(e);
  return { id, steps, stepDur, swing: P.swing || 0, events, parts: P.parts, level: P.level ?? 1, finalTempo: P.sync ? 1 : (P.finalTempo ?? 1.04), sync: P.sync || null, count: ev.length };
}

// ---------------------------------------------------------------- playback
// Shared per AudioContext: wavetables, rendered notes and drums.
export class MusicKit {
  constructor(ctx, reverbIn) { this.ctx = ctx; this.rev = reverbIn; this.bufs = new Map(); this.waves = new Map(); this.rng = mulberry(12345); }
  setWave(o, w) {
    if (typeof w === 'string') { o.type = w; return; }
    const key = JSON.stringify(w);
    let pw = this.waves.get(key);
    if (!pw) {
      const n = 48, re = new Float32Array(n), im = new Float32Array(n);
      if (w.pulse) for (let h = 1; h < n; h++) re[h] = (2 / (h * Math.PI)) * Math.sin(h * Math.PI * w.pulse);
      else w.forEach((a, i) => { im[i + 1] = a; });
      pw = this.ctx.createPeriodicWave(re, im);
      this.waves.set(key, pw);
    }
    o.setPeriodicWave(pw);
  }
  buffer(inst, midi) {
    const key = inst + ':' + midi;
    let b = this.bufs.get(key);
    if (!b) {
      const sr = this.ctx.sampleRate, d = finish(renderNote(INST[inst], mtof(midi), sr, mulberry(hashStr(key))));
      b = this.ctx.createBuffer(1, d.length, sr); b.getChannelData(0).set(d);
      this.bufs.set(key, b);
    }
    return b;
  }
  drum(name) {
    const key = 'drum:' + name;
    let b = this.bufs.get(key);
    if (!b) {
      const sr = this.ctx.sampleRate, d = renderDrum(name, sr, mulberry(hashStr(key)));
      b = this.ctx.createBuffer(1, d.length, sr); b.getChannelData(0).set(d);
      this.bufs.set(key, b);
    }
    return b;
  }
  // render every note a song will need now (before the race), and forget other songs' notes
  prepare(song) {
    const need = new Set();
    for (const list of song.events) if (list) for (const e of list) {
      const p = song.parts.find((x) => x.id === e.part), spec = INST[p.inst || 'kit'];
      if (spec.kind === 'buf') need.add(p.inst + ':' + e.midi);
      else if (spec.kind === 'drums') need.add('drum:' + e.midi);
    }
    for (const k of [...this.bufs.keys()]) if (!need.has(k) && !k.startsWith('drum:')) this.bufs.delete(k);
    for (const k of need) { const i = k.indexOf(':'), a = k.slice(0, i), b = k.slice(i + 1); if (a === 'drum') this.drum(b); else this.buffer(a, +b); }
  }
}

class Mono {
  constructor(kit, s, dest) {
    const ctx = kit.ctx;
    this.s = s; this.end = 0;
    this.o = ctx.createOscillator(); kit.setWave(this.o, s.wave);
    const mix = ctx.createGain();
    this.o.connect(mix);
    if (s.wave2) {
      this.o2 = ctx.createOscillator(); kit.setWave(this.o2, s.wave2); this.o2.detune.value = s.det2 || 0;
      const g2 = ctx.createGain(); g2.gain.value = s.mix2 ?? 0.5; this.o2.connect(g2).connect(mix);
    }
    let node = mix;
    if (s.filter) { this.f = ctx.createBiquadFilter(); this.f.type = s.filter[0]; this.f.frequency.value = s.filter[1]; this.f.Q.value = s.filter[2] ?? 0.7; node.connect(this.f); node = this.f; }
    if (s.peak) { const pk = ctx.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = s.peak[0]; pk.Q.value = s.peak[1]; pk.gain.value = s.peak[2]; node.connect(pk); node = pk; }
    this.g = ctx.createGain(); this.g.gain.value = 0;
    node.connect(this.g); this.g.connect(dest);
    if (s.vib) {
      this.lfo = ctx.createOscillator(); this.lfo.frequency.value = s.vib[0];
      this.vg = ctx.createGain(); this.vg.gain.value = s.vib[2] ? 0 : s.vib[1];
      this.lfo.connect(this.vg); this.vg.connect(this.o.detune); if (this.o2) this.vg.connect(this.o2.detune);
    }
    const t = ctx.currentTime;
    this.o.start(t); if (this.o2) this.o2.start(t); if (this.lfo) this.lfo.start(t);
  }
  note(t, midi, dur, vel) {
    const s = this.s, [a, d, su, r] = s.env, fr = mtof(midi);
    const legato = !!s.glide && t < this.end + 0.02;
    for (const o of this.o2 ? [this.o, this.o2] : [this.o]) {
      const F = o.frequency;
      if (legato) F.setTargetAtTime(fr, t, s.glide);
      else if (s.scoop) { F.setValueAtTime(fr * s.scoop, t); F.setTargetAtTime(fr, t, 0.02); }
      else F.setValueAtTime(fr, t);
    }
    const G = this.g.gain;
    G.cancelScheduledValues(t);
    G.setTargetAtTime(vel, t, legato ? 0.015 : a / 3);
    G.setTargetAtTime(vel * su, t + a, d / 3);
    G.setTargetAtTime(0, t + dur, r / 3);
    if (s.fenv && this.f) { const Ff = this.f.frequency; Ff.cancelScheduledValues(t); Ff.setValueAtTime(s.filter[1] + s.fenv[0] * vel, t); Ff.setTargetAtTime(s.filter[1], t, s.fenv[1]); }
    if (this.vg && s.vib[2] && !legato) { const V = this.vg.gain; V.cancelScheduledValues(t); V.setValueAtTime(0, t); V.setTargetAtTime(s.vib[1], t + s.vib[2], 0.12); }
    this.end = t + dur;
  }
  hush(t) { const G = this.g.gain; G.cancelScheduledValues(t); G.setTargetAtTime(0, t, 0.03); this.end = 0; }
  stop(t) { for (const o of [this.o, this.o2, this.lfo]) if (o) try { o.stop(t); } catch (e) { /* stopped */ } }
}

export class Player {
  constructor(kit, song, dest) {
    const ctx = kit.ctx;
    this.kit = kit; this.song = song; this.ctx = ctx;
    this.out = ctx.createGain(); this.out.gain.value = 0; this.out.connect(dest);
    this.parts = {};
    for (const p of song.parts) {
      const spec = INST[p.inst || 'kit'];
      const bus = ctx.createGain(); bus.gain.value = (p.gain ?? 1) * (spec.kind === 'poly' ? spec.gain : 1);
      let node = bus;
      if (spec.busFilter) { const f = ctx.createBiquadFilter(); f.type = spec.busFilter[0]; f.frequency.value = spec.busFilter[1]; f.Q.value = spec.busFilter[2]; node.connect(f); node = f; }
      if (p.pan && ctx.createStereoPanner) { const pn = ctx.createStereoPanner(); pn.pan.value = p.pan; node.connect(pn); node = pn; }
      node.connect(this.out);
      const send = p.send ?? 0.15;
      if (send > 0 && kit.rev) { const sg = ctx.createGain(); sg.gain.value = send; node.connect(sg); sg.connect(kit.rev); }
      const part = { p, spec, bus };
      if (spec.kind === 'mono') { const vg = ctx.createGain(); vg.gain.value = spec.gain; vg.connect(bus); part.voice = new Mono(kit, spec, vg); }
      if (spec.kind === 'poly' && spec.vib) {
        part.lfo = ctx.createOscillator(); part.lfo.frequency.value = spec.vib[0];
        part.lfoG = ctx.createGain(); part.lfoG.gain.value = spec.vib[1]; part.lfo.connect(part.lfoG); part.lfo.start();
      }
      this.parts[p.id] = part;
    }
    this.step = 0; this.next = 0; this.final = false; this.tempo = 1; this.running = false; this.sync = null;
  }
  // sync: {g0, off()} locks step 0 of the loop to game time g0 (+ whole loops); off() = audio minus game time
  start(t, sync = null) {
    this.step = 0; this.running = true; this.sync = sync;
    this.next = sync ? sync.g0 + sync.off() : t;
    const g = this.out.gain, t0 = Math.max(this.ctx.currentTime, t - 0.05);
    g.cancelScheduledValues(0); g.setValueAtTime(0, t0); g.linearRampToValueAtTime(this.song.level, t0 + 0.1);
  }
  setFinal(on) { this.final = on; this.tempo = on ? this.song.finalTempo : 1; }
  pause() {
    if (!this.running) return;
    this.running = false;
    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t); this.out.gain.setTargetAtTime(0, t, 0.04);
    for (const k in this.parts) if (this.parts[k].voice) this.parts[k].voice.hush(t);
  }
  resume() {
    if (this.running || this.stopped) return;
    const t = this.ctx.currentTime + 0.05;
    this.running = true; this.next = t;
    this.out.gain.cancelScheduledValues(t); this.out.gain.setTargetAtTime(this.song.level, t, 0.05);
  }
  stop(fade = 0.5) {
    if (this.stopped) return;
    this.stopped = true; this.running = false;
    const ctx = this.ctx, t = ctx.currentTime;
    this.out.gain.cancelScheduledValues(t); this.out.gain.setTargetAtTime(0, t, fade / 4);
    for (const k in this.parts) { const P = this.parts[k]; if (P.voice) P.voice.stop(t + fade + 0.1); if (P.lfo) P.lfo.stop(t + fade + 0.1); }
    // let the tails ring out, then let go of the graph
    setTimeout(() => { try { this.out.disconnect(); for (const k in this.parts) this.parts[k].bus.disconnect(); } catch (e) { /* gone */ } }, (fade + 1.5) * 1000);
  }
  // schedule every step that starts before `until` (AudioContext time)
  pump(until) {
    if (!this.running) return;
    const S = this.song, now = this.ctx.currentTime;
    let guard = 0;
    while (guard++ < 4096) {
      const sd = S.stepDur / this.tempo;
      if (this.sync) {
        const want = this.sync.g0 + this.step * S.stepDur + this.sync.off();
        if (Math.abs(want - this.next) > 0.03) this.next = want;
      }
      if (this.next >= until) break;
      if (this.next >= now - 0.02) {
        const list = S.events[this.step];
        if (list) for (const e of list) if (!e.layer || this.final) this.play(e, this.next + (S.swing && (this.step & 1) ? S.swing * sd : 0) + e.off, sd);
      }
      this.next += sd;
      if (++this.step >= S.steps) { this.step = 0; if (this.sync) this.sync.g0 += S.steps * S.stepDur; }
    }
  }
  play(e, t, sd) {
    const P = this.parts[e.part], spec = P.spec, ctx = this.ctx, dur = e.dur * sd;
    if (spec.kind === 'mono') { P.voice.note(t, e.midi, dur * 0.92, e.vel); return; }
    if (spec.kind === 'poly') {
      const g = ctx.createGain(), [a, d, su, r] = spec.env, fr = mtof(e.midi), oscs = [];
      for (const det of spec.det || [0]) {
        const o = ctx.createOscillator(); this.kit.setWave(o, spec.wave); o.frequency.value = fr; o.detune.value = det;
        o.connect(g); if (P.lfoG) P.lfoG.connect(o.detune);
        o.start(t); o.stop(t + dur + r * 2 + 0.05); oscs.push(o);
      }
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(e.vel, t + a); g.gain.setTargetAtTime(e.vel * su, t + a, d / 3); g.gain.setTargetAtTime(0, t + dur, r / 3);
      g.connect(P.bus);
      oscs[0].onended = () => { g.disconnect(); if (P.lfoG) for (const o of oscs) try { P.lfoG.disconnect(o.detune); } catch (err) { /* gone */ } };
      return;
    }
    const buf = spec.kind === 'drums' ? this.kit.drum(e.midi) : this.kit.buffer(P.p.inst, e.midi);
    const s = ctx.createBufferSource(); s.buffer = buf;
    const g = ctx.createGain(); g.gain.setValueAtTime(e.vel, t);
    let end = t + buf.duration;
    if (spec.damp) { g.gain.setTargetAtTime(0, t + dur, spec.damp / 3); end = Math.min(end, t + dur + spec.damp * 2); }
    s.connect(g); g.connect(P.bus);
    s.start(t); s.stop(end);
    s.onended = () => g.disconnect();
  }
}

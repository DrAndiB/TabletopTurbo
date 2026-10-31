// World: Nile Cruise (Pharaoh Cup, table 2 of 4). A class's big school-project diorama of the Nile at Aswan on a
// classroom table, late on a golden afternoon: a long tray of real water, dyed a little teal, winds round a long island
// through banks of moss and model grass, papyrus reeds, paper palms, mud-brick houses, desert sand and stacked-cardboard
// hills. Toy speedboats race downstream along the north channel, past a temple with a pylon gate, two painted clay
// colossi and an obelisk, and shoot the cataract: white water between granite boulders, a strong current that carries
// you, a little sideways wander and a choice of lines between the rocks. The south channel runs upstream, against a
// gentle current through calm water, past the felucca harbour, where two feluccas tack slowly across the river. Toy
// crocodiles lurk in two muddy inlets: their eyes surface first, then one lunges into the outer lane and sinks back.
// A hippo yawns in a side pool by the west bend; a sandstone quarry with an unfinished obelisk fills the east bend.

const TRACK = [
  [-120, 64, 18], [-80, 66, 18], [-40, 64, 17], [-8, 58, 16], [20, 50, 16], [46, 52, 17], [72, 62, 22], [102, 68, 26],
  [132, 64, 24], [158, 52, 20], [180, 30, 20], [190, 0, 20], [184, -28, 20], [164, -50, 18], [134, -62, 18], [106, -66, 17],
  [82, -62, 15], [56, -54, 24], [30, -52, 25], [6, -58, 22], [-14, -66, 14], [-38, -72, 18], [-70, -72, 18], [-104, -68, 18],
  [-136, -60, 18], [-162, -44, 20], [-184, -16, 20], [-184, 16, 20], [-168, 42, 20], [-146, 58, 18],
];
const W = 18;
const START_S = 676;
const PI = Math.PI, TAU = PI * 2;
// the tray of water (the diorama) on the classroom table; 1-unit terrain grid over it
const TRAY = { x0: -216, x1: 216, z0: -122, z1: 96 };
const GW = TRAY.x1 - TRAY.x0 + 1, GH = TRAY.z1 - TRAY.z0 + 1, G0X = TRAY.x0, G0Z = TRAY.z0;
const HMIN = -5, HMAX = 7, FMAX = 20;
const TABLE_Y = -6, RIM_Y = 3.4, RIM_W = 3;
// the cataract: entry s, length, current (units/s), sideways wander; rocks in the river [s offset, lateral, radius];
// the two CPU lines through it [s offset, lateral]
const CAT = {
  s0: 482, len: 122, v: 15, wander: 3.2,
  rocks: [[38, -1.0, 3.0], [60, 5.2, 2.0], [60, -5.6, 2.0], [84, 0.5, 2.2]],
  lines: [
    [[0, 0], [20, 2.5], [38, 6.4], [50, 3], [60, -0.2], [70, -2.8], [84, -6.4], [104, -2], [122, 0]],
    [[0, 0], [20, 4], [38, 6.8], [50, 3], [60, -0.2], [70, 3], [84, 6.8], [104, 2], [122, 0]],
  ],
};
// open water beyond the road edge (side +1 = right = outer bank): the harbour bay, the hippo pool, croc inlets
const OPEN = [
  { s: 226, half: 34, side: -1, depth: 13, buoys: true },
  { s: 800, half: 15, side: 1, depth: 11, buoys: true },
  { s: 72, half: 8, side: 1, depth: 3.5, buoys: false },
  { s: 352, half: 8, side: 1, depth: 3.5, buoys: false },
];
// shallow, slow patches on the inside of two bends: a sandbar and a bed of water hyacinth
const SHALLOWS = [{ s: 412, lat: -6.2, la: 11, lc: 2.7, top: 0.06, kind: 'sand' }, { s: 795, lat: -6.6, la: 12, lc: 2.7, top: -0.35, kind: 'weed' }];
// toy crocodiles: arc length, bank side, phase (s); the cycle (s): eyes surface, lunge out, hold, back, sink
const CROCS = [{ s: 72, side: 1, ph: 0.6 }, { s: 352, side: 1, ph: 5.0 }];
const CROC = { P: 8.5, rise: 1.6, out: 0.36, hold: 0.36, back: 0.6, sink: 0.9, reach: 4.6, len: 6.4, r: 1.0 };
// feluccas tacking across the wide water by the harbour: centre s, phase; cycle: leg, turn, half-crossing, drift
const FELS = [{ s: 208, ph: 0 }, { s: 247, ph: 11.5 }];
const FEL = { P: 22, leg: 9, A: 6.4, ds: 5, hw: 4.4, hd: 1.45 };
const HIPPO = { s: 800, P: 11, ph: 2 };
const TEMPLE = { x: -88, z: -101 };
const QUARRY = { x: 150, z: -2 };

let A = null; // runtime state shared by build / tick / animate

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mod = (a, n) => ((a % n) + n) % n;
const raceT = (t) => t - (A ? A.t0 : 0);

// crocodile c at time t: y (head height), k (0 = in the inlet, 1 = lunged out), jaw (0 shut .. 1 open), u (cycle time)
const CS = { y: 0, k: 0, jaw: 0, u: 0 };
function crocAt(c, t, o = CS) {
  const u = mod(raceT(t) + c.ph, CROC.P);
  const t1 = CROC.rise, t2 = t1 + CROC.out, t3 = t2 + CROC.hold, t4 = t3 + CROC.back, t5 = t4 + CROC.sink;
  const DEEP = -2.6, EYES = -0.4, UP = 0.08;
  o.k = 0; o.jaw = 0; o.u = u;
  if (u < t1) o.y = lerp(DEEP, EYES, ss(0, t1 * 0.75, u));
  else if (u < t2) { const f = (u - t1) / CROC.out; o.k = 1 - (1 - f) * (1 - f); o.y = lerp(EYES, UP, f); o.jaw = f; }
  else if (u < t3) { o.k = 1; o.y = UP; o.jaw = 1 - ss(0.3, 0.55, (u - t2) / CROC.hold); }
  else if (u < t4) { const f = (u - t3) / CROC.back; o.k = 1 - ss(0, 1, f); o.y = lerp(UP, EYES, f); }
  else if (u < t5) o.y = lerp(EYES, DEEP, ss(t4, t5, u));
  else o.y = DEEP;
  return o;
}

// felucca f at time t: world pose, heel (-1..1) and sail side (-1..1)
const FO = { x: 0, z: 0, angle: 0, heel: 0, sail: 0 };
function felAt(f, t, o = FO) {
  const tr = A.track, P = FEL.P, Lg = FEL.leg, Tn = P / 2 - Lg;
  const u = mod(t + f.ph, P);
  const prof = (x) => (x < 0.12 ? (x * x) / 0.24 / 0.88 : x > 0.88 ? 1 - ((1 - x) * (1 - x)) / 0.24 / 0.88 : (x - 0.06) / 0.88);
  const rel = Math.atan2(2 * FEL.A, FEL.ds);
  let lat, s, ang, heel, sail;
  if (u < Lg) { const q = prof(u / Lg); lat = -FEL.A + 2 * FEL.A * q; s = f.s - FEL.ds / 2 + FEL.ds * q; ang = rel; heel = 1; sail = 1; }
  else if (u < Lg + Tn) { const g = ss(0, 1, (u - Lg) / Tn); lat = FEL.A; s = f.s + FEL.ds / 2; ang = rel + g * PI; heel = Math.cos(g * PI); sail = heel; }
  else if (u < 2 * Lg + Tn) { const q = prof((u - Lg - Tn) / Lg); lat = FEL.A - 2 * FEL.A * q; s = f.s + FEL.ds / 2 - FEL.ds * q; ang = rel + PI; heel = -1; sail = -1; }
  else { const g = ss(0, 1, (u - 2 * Lg - Tn) / Tn); lat = -FEL.A; s = f.s - FEL.ds / 2; ang = rel + PI + g * PI; heel = -Math.cos(g * PI); sail = heel; }
  const p = tr.place(s, lat);
  o.x = p.x; o.z = p.z; o.angle = p.angle + ang; o.heel = heel; o.sail = sail;
  return o;
}

// the CPU line through the cataract (lateral at s offset d)
function catLine(k, d) {
  const pts = CAT.lines[k];
  for (let i = 1; i < pts.length; i++) {
    if (d <= pts[i][0]) { const a = pts[i - 1], b = pts[i]; return lerp(a[1], b[1], ss(a[0], b[0], d)); }
  }
  return 0;
}

export default {
  id: 'nile',
  name: 'Nile Cruise',
  blurb: 'Speedboats on a school diorama of the Nile: shoot the cataract, mind the crocodiles.',
  vehicle: 'boat',
  seed: 89,
  track: { points: TRACK, width: W, startS: START_S },
  bounds: { minX: TRAY.x0, maxX: TRAY.x1, minZ: TRAY.z0, maxZ: TRAY.z1 },
  fallOffEdges: false,
  floorY: -80,
  offCourse: 18,
  wake: { color: 0xf2fbf6 },
  dustColor: 0xeef8f2,
  lighting: {
    sunDir: [-0.78, 0.52, 0.3], sunColor: 0xffd29c, sunIntensity: 2.9,
    hemiSky: 0xbcd0ee, hemiGround: 0x8c6a3e, hemiIntensity: 0.55,
    envIntensity: 0.45, exposure: 1.0, background: 0x2e241c, shadowRadius: 2.2,
  },

  async build(K) {
    const { THREE: T, TX, r, track } = K;
    const L = track.length;
    const Q = (K.quality && K.quality.grass) || 0.7;
    const V2 = (a, b = a) => new T.Vector2(a, b);
    A = { t0: 0, prevState: null, prevCountT: 0, uTime: { value: 0 }, track, crocs: [], fels: [], rocks: [], jars: [], L };
    const keep = [];
    const wrapS = (s) => mod(s, L);
    const dS = (a, b) => { let d = wrapS(a - b); if (d > L / 2) d -= L; return d; };
    const PLC = new Map();
    const PL = (c, rough = 0.4) => { const k = c + ':' + rough; if (!PLC.has(k)) PLC.set(k, K.plastic(c, rough)); return PLC.get(k); };
    const STD = new Map();
    const SM = (c, rough = 0.8, extra = null) => { const k = c + ':' + rough; if (extra) return K.std({ color: c, roughness: rough, ...extra }); if (!STD.has(k)) STD.set(k, K.std({ color: c, roughness: rough })); return STD.get(k); };
    const mergeGroup = (g) => {
      g.updateMatrixWorld(true);
      const inv = new T.Matrix4().copy(g.matrixWorld).invert();
      const buckets = new Map();
      g.traverse((o) => { if (o.isMesh && !Array.isArray(o.material)) { const k = o.material.uuid; if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(o); } });
      const out = new T.Group();
      for (const list of buckets.values()) {
        const geos = list.map((o) => {
          const gg = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
          gg.applyMatrix4(new T.Matrix4().multiplyMatrices(inv, o.matrixWorld));
          for (const k of Object.keys(gg.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) gg.deleteAttribute(k);
          if (!gg.attributes.uv) gg.setAttribute('uv', new T.BufferAttribute(new Float32Array(gg.attributes.position.count * 2), 2));
          return gg;
        });
        const hasC = geos.some((q) => q.attributes.color);
        if (hasC) for (const q of geos) if (!q.attributes.color) q.setAttribute('color', new T.BufferAttribute(new Float32Array(q.attributes.position.count * 3).fill(1), 3));
        const m = new T.Mesh(K.BufferGeometryUtils.mergeGeometries(geos, false), list[0].material);
        m.castShadow = true; m.receiveShadow = true;
        out.add(m);
      }
      return out;
    };
    // batched contact shadows (opacity rides in the unused y scale)
    const contacts = [];
    const AO = (x, z, rx, rz = rx, op = 0.35, ang = 0, y = 0.06) => contacts.push({ x, y, z, ry: -ang, sx: rx * 2, sy: op, sz: rz * 2 });

    // ============================================================================
    // FIELDS: distance to the river, heights, colours, currents
    // ============================================================================
    const NC = GW * GH;
    const DIST = new Float32Array(NC).fill(1e9), SI = new Int32Array(NC).fill(-1);
    for (let i = 0; i < track.N; i += 2) {
      const x = track.x[i], z = track.z[i], R = track.w[i] / 2 + 26;
      const x0 = Math.max(0, Math.floor(x - R - G0X)), x1 = Math.min(GW - 1, Math.ceil(x + R - G0X));
      const z0 = Math.max(0, Math.floor(z - R - G0Z)), z1 = Math.min(GH - 1, Math.ceil(z + R - G0Z));
      for (let gz = z0; gz <= z1; gz++) {
        const dz = gz + G0Z - z, row = gz * GW;
        for (let gx = x0; gx <= x1; gx++) {
          const dx = gx + G0X - x, d = dx * dx + dz * dz, k = row + gx;
          if (d < DIST[k]) { DIST[k] = d; SI[k] = i; }
        }
      }
    }
    for (let k = 0; k < NC; k++) DIST[k] = SI[k] >= 0 ? Math.sqrt(DIST[k]) : 99;
    const latOf = (k, x, z) => { const i = SI[k]; return (x - track.x[i]) * -track.tz[i] + (z - track.z[i]) * track.tx[i]; };
    const openAt = (s, side, buoysOnly = false) => {
      let v = 0;
      for (const o of OPEN) {
        if (o.side !== side || (buoysOnly && !o.buoys)) continue;
        const d = dS(s, o.s) / o.half;
        if (d > -1 && d < 1) v += o.depth * Math.sqrt(1 - d * d);
      }
      return v;
    };
    const catW = (s) => { const u = wrapS(s - CAT.s0); return u > CAT.len ? 0 : ss(0, 14, u) * (1 - ss(CAT.len - 14, CAT.len, u)); };
    const inCat = (s, m = 0) => { const u = wrapS(s - CAT.s0 + m); return u < CAT.len + 2 * m; };

    // noise
    const NS = 256;
    const nA = TX.noiseField(NS, { seed: 891, period: 6, oct: 5 });
    const nB = TX.noiseField(NS, { seed: 892, period: 16, oct: 3 });
    const samp = (f, u, v) => {
      u = ((u % NS) + NS) % NS; v = ((v % NS) + NS) % NS;
      const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, i1 = (i + 1) % NS, j1 = (j + 1) % NS;
      return lerp(lerp(f[j * NS + i], f[j * NS + i1], fu), lerp(f[j1 * NS + i], f[j1 * NS + i1], fu), fv);
    };
    const n1 = (x, z) => samp(nA, x * 0.6 + 40, z * 0.6 + 90);
    const n2 = (x, z) => samp(nB, x * 1.6, z * 1.6);
    const sNoise = (s) => samp(nB, s * 0.35, 17.3);

    // flattened ground under the temple and the quarry; cultivated fields (striped green)
    const FLATS = [
      { x0: TEMPLE.x - 34, x1: TEMPLE.x + 34, z0: TEMPLE.z - 16, z1: TEMPLE.z + 20, y: 2.0 },
      { x0: QUARRY.x - 24, x1: QUARRY.x + 22, z0: QUARRY.z - 22, z1: QUARRY.z + 20, y: 2.2 },
    ];
    const flatW = (f, x, z) => Math.min(ss(f.x0 - 5, f.x0, x), 1 - ss(f.x1, f.x1 + 5, x), ss(f.z0 - 5, f.z0, z), 1 - ss(f.z1, f.z1 + 5, z));
    const FIELDS = [[-104, 28, -60, 42, 0.05], [-40, 26, -6, 38, -0.12], [104, 22, 146, 34, 0.1], [-120, -40, -80, -30, 0.04], [60, -36, 104, -26, -0.06]];

    const H = new Float32Array(NC), E = new Float32Array(NC);
    const CR = new Float32Array(NC), CG = new Float32Array(NC), CB = new Float32Array(NC);
    const C = (h) => new T.Color(h);
    const cBed = C(0x6b5f3e), cBed2 = C(0x55603a), cMud = C(0x4a3a24), cMoss = C(0x41621f), cMoss2 = C(0x5b7a26), cGrass = C(0x86a03c),
      cDry = C(0xb4a25c), cSand = C(0xd9b778), cSand2 = C(0xe9cf98), cField = C(0x5f8a2a), cField2 = C(0x7aa236), cBar = C(0xd7c08c);
    const tmpC = new T.Color();
    const mix = (a, b, t) => tmpC.copy(a).lerp(b, clamp(t, 0, 1));
    for (let gz = 0; gz < GH; gz++) for (let gx = 0; gx < GW; gx++) {
      const k = gz * GW + gx, x = gx + G0X, z = gz + G0Z;
      const a = n1(x, z), b = n2(x, z);
      let e = 40, s = -1, i = SI[k], lat = 0, hw = 9, cat = 0;
      if (i >= 0) {
        s = i * track.ds; hw = track.w[i] / 2; lat = latOf(k, x, z);
        e = DIST[k] - (hw + 0.2 + openAt(s, lat >= 0 ? 1 : -1));
        cat = catW(s);
      }
      const land = 1.7 + 0.5 * (a - 0.5) + 0.25 * (b - 0.5) + ss(10, 32, e) * (0.5 + 1.8 * a);
      let y;
      if (e >= 0) y = -0.5 + (land + 0.5) * ss(0, 4.5, e);
      else {
        const deep = lerp(3.2 + 0.6 * sNoise(s), 2.2, cat);
        y = -0.5 - (deep - 0.5) * ss(0, 5.5, -e) + 0.3 * (b - 0.5);
      }
      let bar = 0;
      if (i >= 0) for (const sb of SHALLOWS) {
        const q = (dS(s, sb.s) / sb.la) ** 2 + ((lat - sb.lat) / sb.lc) ** 2;
        if (q < 2.4 && e < 1) { const yy = sb.top - 0.25 * (b - 0.5) - 1.8 * ss(0.5, 1.6, q); if (yy > y) { y = yy; if (sb.kind === 'sand') bar = 1 - ss(0.4, 1.4, q); } }
      }
      for (const f of FLATS) { const w = flatW(f, x, z); if (w > 0 && e > 2) y = lerp(y, f.y, w * ss(2, 5, e)); }
      H[k] = clamp(y, HMIN + 0.2, HMAX - 0.2); E[k] = e;
      // colour
      let c;
      if (bar > 0) c = mix(cBed, cBar, bar * 1.4);
      else if (e < 0) c = mix(cBed, cBed2, b);
      else if (e < 1.6) c = mix(cMud, cMoss, ss(0.8, 1.6, e) * 0.5);
      else {
        const gw = 6 + 6 * a;
        c = mix(cMoss, cMoss2, b);
        c.lerp(cGrass, ss(0.45, 0.8, a * 0.6 + b * 0.5) * 0.8);
        c.lerp(cDry, ss(gw, gw + 4, e));
        c.lerp(a > 0.55 ? cSand2 : cSand, ss(gw + 3, gw + 9, e));
        if (e > gw + 6) c.lerp(cSand2, ss(0.5, 0.75, b) * 0.6);
        for (const [x0, z0, x1, z1, ang] of FIELDS) {
          const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, ca = Math.cos(ang), sa = Math.sin(ang);
          const lx = (x - cx) * ca + (z - cz) * sa, lz = -(x - cx) * sa + (z - cz) * ca;
          if (Math.abs(lx) < (x1 - x0) / 2 && Math.abs(lz) < (z1 - z0) / 2 && e > 3) { c = mix(cField, cField2, mod(lz, 2.4) < 1.2 ? 0.15 : 0.85); c.lerp(cMoss, (b - 0.5) * 0.4); }
        }
      }
      const sh = 0.92 + (a - 0.5) * 0.18 + (b - 0.5) * 0.1;
      CR[k] = c.r * sh; CG[k] = c.g * sh; CB[k] = c.b * sh;
    }
    const hAt = (x, z) => {
      const fx = clamp(x - G0X, 0, GW - 1.001), fz = clamp(z - G0Z, 0, GH - 1.001);
      const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * GW + i;
      return lerp(lerp(H[k], H[k + 1], u), lerp(H[k + GW], H[k + GW + 1], u), v);
    };
    const eAt = (x, z) => { const gx = Math.round(clamp(x - G0X, 0, GW - 1)), gz = Math.round(clamp(z - G0Z, 0, GH - 1)); return E[gz * GW + gx]; };
    const groundY = (x, z) => Math.max(0, hAt(x, z));
    // tall props must not hide the road: their footprint and the spot their top covers on screen stay clear of it
    const clearView = (x, z, h, rad) => K.offRoad(x, z, rad + 1.5) && K.offRoad(x, z - 0.55 * h, rad + 1.5);
    const inTray = (x, z, m = 4) => x > TRAY.x0 + m && x < TRAY.x1 - m && z > TRAY.z0 + m && z < TRAY.z1 - m;

    // currents along the track (gameplay, tick) and in the water (shader)
    const CUR = new Float32Array(track.N), CATW = new Float32Array(track.N);
    const win = (s, a, b, rr) => ss(a, a + rr, s) * (1 - ss(b - rr, b, s));
    for (let i = 0; i < track.N; i++) {
      const s = i * track.ds;
      let v = -3.2 * win(s, 8, 292, 16) + 3.0 * win(s, 412, 728, 16);
      const cw = catW(s);
      CUR[i] = lerp(v, CAT.v, cw); CATW[i] = cw;
    }
    A.CUR = CUR; A.CATW = CATW;

    // rocks in the cataract (colliders) and granite boulders on its banks: also feed the foam
    const rockSpots = [];
    for (const [o, lat, rad] of CAT.rocks) { const p = track.place(CAT.s0 + o, lat); rockSpots.push({ x: p.x, z: p.z, r: rad, s: CAT.s0 + o, lat, live: true }); }
    const bankRocks = [];
    {
      const rr = K.rng(321);
      for (let s = CAT.s0 - 12; s < CAT.s0 + CAT.len + 12; s += 2.6) {
        for (const side of [-1, 1]) {
          if (rr() < 0.25) continue;
          const p = track.at(s), rad = rr.range(1.2, 3.0) * (1 + 0.4 * (1 - catW(s)));
          const q = track.place(s, side * (p.w / 2 + 0.9 + rad * 0.6 + rr() * 1.4));
          bankRocks.push({ x: q.x, z: q.z, r: rad, ry: rr() * 6 });
        }
      }
    }

    const FX = new Float32Array(NC), FZ = new Float32Array(NC), SHORE = new Float32Array(NC);
    {
      const land = new Uint8Array(NC);
      for (let k = 0; k < NC; k++) land[k] = H[k] > -0.05 ? 1 : 0;
      for (const rk of [...rockSpots, ...bankRocks]) {
        const R = rk.r * 0.95, x0 = Math.floor(rk.x - R - G0X), x1 = Math.ceil(rk.x + R - G0X), z0 = Math.floor(rk.z - R - G0Z), z1 = Math.ceil(rk.z + R - G0Z);
        for (let gz = Math.max(0, z0); gz <= Math.min(GH - 1, z1); gz++) for (let gx = Math.max(0, x0); gx <= Math.min(GW - 1, x1); gx++) {
          if (Math.hypot(gx + G0X - rk.x, gz + G0Z - rk.z) < R) land[gz * GW + gx] = 1;
        }
      }
      const RD = 3;
      for (let gz = 0; gz < GH; gz++) for (let gx = 0; gx < GW; gx++) {
        const k = gz * GW + gx;
        if (land[k]) { SHORE[k] = 1; continue; }
        let m = 9;
        for (let j = -RD; j <= RD; j++) for (let i = -RD; i <= RD; i++) {
          const xx = gx + i, zz = gz + j;
          if (xx < 0 || zz < 0 || xx >= GW || zz >= GH || land[zz * GW + xx]) m = Math.min(m, Math.hypot(i, j));
        }
        SHORE[k] = Math.max(0, 1 - m / 3.2);
        const si = SI[k];
        if (si >= 0) {
          const hw = track.w[si] / 2, d = DIST[k];
          const v = CUR[si] * (1 - 0.4 * Math.min(1, (d / hw) ** 2)) * (d < hw + 2 ? 1 : 0.3);
          const wv = CATW[si] * 2.5 * Math.sin(si * track.ds * 0.11);
          FX[k] = track.tx[si] * v - track.tz[si] * wv; FZ[k] = track.tz[si] * v + track.tx[si] * wv;
        }
      }
    }
    const dataTex = (() => {
      const d = new Uint8Array(NC * 4);
      for (let k = 0; k < NC; k++) {
        d[k * 4] = Math.round(clamp((H[k] - HMIN) / (HMAX - HMIN), 0, 1) * 255);
        d[k * 4 + 1] = Math.round(128 + clamp(FX[k] / FMAX, -1, 1) * 127);
        d[k * 4 + 2] = Math.round(128 + clamp(FZ[k] / FMAX, -1, 1) * 127);
        d[k * 4 + 3] = Math.round(SHORE[k] * 255);
      }
      const t = new T.DataTexture(d, GW, GH, T.RGBAFormat, T.UnsignedByteType);
      t.magFilter = T.LinearFilter; t.minFilter = T.LinearFilter; t.generateMipmaps = false;
      t.wrapS = t.wrapT = T.ClampToEdgeWrapping; t.flipY = false; t.needsUpdate = true;
      return t;
    })();

    // ============================================================================
    // TEXTURES
    // ============================================================================
    const noiseTex = (() => {
      const f1 = TX.noiseField(256, { seed: 311, period: 8, oct: 4 }), f2 = TX.noiseField(256, { seed: 312, period: 4, oct: 4 });
      return TX.toTexture(TX.paint(256, 256, (x, y, u, v, o) => { const k = y * 256 + x; o[0] = f1[k] * 255; o[1] = f2[k] * 255; o[2] = 128; }), { srgb: false });
    })();
    const waterN = TX.toTexture(TX.normalFromHeight(TX.noiseField(256, { seed: 321, period: 10, oct: 4, gain: 0.55 }), 256, 256, 5.0), { srgb: false });
    const skyEnv = (() => {
      const c = TX.makeCanvas(512, 256), g = c.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 0, 128);
      gr.addColorStop(0, '#4f86c8'); gr.addColorStop(0.7, '#e9c48e'); gr.addColorStop(1, '#ffe2b0');
      g.fillStyle = gr; g.fillRect(0, 0, 512, 128);
      g.fillStyle = '#8a6a48'; g.fillRect(0, 128, 512, 128);
      g.fillStyle = '#5d6e3a'; for (let x = 0; x < 512; x += 6) g.fillRect(x, 116 + Math.sin(x * 0.07) * 4, 7, 16);
      const t = TX.toTexture(c, { wrap: false }); t.mapping = T.EquirectangularReflectionMapping;
      return t;
    })();
    const detail = TX.mottledTextures({ size: 512, a: 0xf2efe8, b: 0xc9c4b8, c: 0xffffff, seed: 893, period: 16, speck: 0.35, bump: 3.4, pebbles: 160, pebbleColor: 0xb8b0a0 });
    const graniteTex = (() => {
      const rr = K.rng(77), f = TX.noiseField(256, { seed: 94, period: 8, oct: 4 });
      return TX.toTexture(TX.paint(256, 256, (x, y, u, v, o) => {
        const n = f[y * 256 + x], q = rr();
        let c0 = 150 + n * 70, c1 = 120 + n * 55, c2 = 118 + n * 50;
        if (q < 0.1) { c0 *= 0.35; c1 *= 0.35; c2 *= 0.38; } else if (q < 0.18) { c0 = 240; c1 = 232; c2 = 226; } else if (q < 0.3) { c0 *= 1.15; c1 *= 0.86; c2 *= 0.84; }
        o[0] = clamp(c0, 0, 255); o[1] = clamp(c1, 0, 255); o[2] = clamp(c2, 0, 255);
      }));
    })();
    const sandstoneTex = (() => {
      const f = TX.noiseField(256, { seed: 95, period: 8, oct: 5 }), g2 = TX.noiseField(256, { seed: 96, period: 32, oct: 2, sx: 0.12, sy: 1 }), rr = K.rng(95);
      return TX.toTexture(TX.paint(256, 256, (x, y, u, v, o) => {
        const n = f[y * 256 + x], band = g2[y * 256 + x];
        const k = 0.86 + 0.22 * n + 0.045 * Math.sin(v * 24 + band * 5) + (rr() - 0.5) * 0.12;
        o[0] = clamp(222 * k, 0, 255); o[1] = clamp(184 * k, 0, 255); o[2] = clamp(128 * k, 0, 255);
      }));
    })();
    // glyph-like painted marks (no real writing): suns, water lines, eyes, ankh-like loops, birds, reeds, scarabs, lotus
    const glyph = (g, x, y, s, kind, col) => {
      g.save(); g.translate(x, y); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = Math.max(1, s * 0.12); g.lineCap = 'round';
      g.beginPath();
      switch (kind) {
        case 0: g.arc(0, 0, s * 0.35, 0, TAU); g.stroke(); g.beginPath(); g.arc(0, 0, s * 0.08, 0, TAU); g.fill(); break;
        case 1: g.moveTo(-s * 0.45, 0); for (let i = 0; i <= 6; i++) g.lineTo(-s * 0.45 + i * s * 0.15, i % 2 ? -s * 0.12 : s * 0.12); g.stroke(); break;
        case 2: g.ellipse(0, 0, s * 0.42, s * 0.2, 0, 0, TAU); g.stroke(); g.beginPath(); g.arc(0, 0, s * 0.1, 0, TAU); g.fill(); g.beginPath(); g.moveTo(-s * 0.1, s * 0.2); g.lineTo(-s * 0.2, s * 0.45); g.stroke(); break;
        case 3: g.ellipse(0, -s * 0.25, s * 0.14, s * 0.18, 0, 0, TAU); g.moveTo(-s * 0.25, -s * 0.04); g.lineTo(s * 0.25, -s * 0.04); g.moveTo(0, -s * 0.06); g.lineTo(0, s * 0.45); g.stroke(); break;
        case 4: g.ellipse(0, 0, s * 0.28, s * 0.14, 0, 0, TAU); g.fill(); g.beginPath(); g.arc(s * 0.26, -s * 0.16, s * 0.09, 0, TAU); g.fill(); g.beginPath(); g.moveTo(-s * 0.2, 0); g.lineTo(-s * 0.45, s * 0.12); g.lineTo(-s * 0.4, -s * 0.05); g.fill(); g.beginPath(); g.moveTo(0, s * 0.1); g.lineTo(0, s * 0.4); g.stroke(); break;
        case 5: g.ellipse(0, 0, s * 0.1, s * 0.42, 0.15, 0, TAU); g.fill(); break;
        case 6: g.moveTo(-s * 0.4, s * 0.2); g.lineTo(-s * 0.2, -s * 0.2); g.lineTo(0, s * 0.2); g.lineTo(s * 0.2, -s * 0.2); g.lineTo(s * 0.4, s * 0.2); g.stroke(); break;
        case 7: g.arc(0, s * 0.15, s * 0.32, PI, TAU); g.closePath(); g.fill(); break;
        case 8: g.ellipse(0, 0, s * 0.2, s * 0.3, 0, 0, TAU); g.fill(); g.beginPath(); for (const sy of [-0.15, 0, 0.15]) { g.moveTo(-s * 0.2, s * sy); g.lineTo(-s * 0.38, s * (sy + 0.08)); g.moveTo(s * 0.2, s * sy); g.lineTo(s * 0.38, s * (sy + 0.08)); } g.stroke(); break;
        case 9: for (let i = -2; i <= 2; i++) { g.moveTo(0, s * 0.35); g.quadraticCurveTo(i * s * 0.12, 0, i * s * 0.16, -s * 0.35); } g.stroke(); break;
        default: g.rect(-s * 0.3, -s * 0.3, s * 0.6, s * 0.6); g.moveTo(-s * 0.3, 0); g.lineTo(s * 0.3, 0); g.stroke();
      }
      g.restore();
    };
    const PAINT = ['#8a3a20', '#244e8c', '#2f6e52', '#a8761c', '#6a2a18'];
    const glyphColumns = (g, x0, y0, w, h, cols, cell, rr, colors = PAINT) => {
      const cw = w / cols;
      g.strokeStyle = 'rgba(90,60,30,0.45)'; g.lineWidth = 1.5;
      for (let c = 0; c <= cols; c++) { g.beginPath(); g.moveTo(x0 + c * cw, y0); g.lineTo(x0 + c * cw, y0 + h); g.stroke(); }
      for (let c = 0; c < cols; c++) {
        for (let y = y0 + cell * 0.6; y < y0 + h - cell * 0.4; y += cell * 1.05) {
          if (rr() < 0.12) { // a cartouche
            const ch = cell * 3; if (y + ch > y0 + h) continue;
            g.strokeStyle = colors[0]; g.lineWidth = 2; g.beginPath(); g.ellipse(x0 + (c + 0.5) * cw, y + ch / 2 - cell * 0.3, cw * 0.36, ch / 2, 0, 0, TAU); g.stroke();
            for (let q = 0; q < 3; q++) glyph(g, x0 + (c + 0.5) * cw, y + q * cell * 0.85 + cell * 0.1, cell * 0.6, Math.floor(rr() * 11), colors[1 + (q % 3)]);
            y += ch; continue;
          }
          glyph(g, x0 + (c + 0.5) * cw, y, cell * 0.8, Math.floor(rr() * 11), colors[Math.floor(rr() * colors.length)]);
        }
      }
    };
    const stoneCanvas = (w, h, base, seed) => {
      const f = TX.noiseField(256, { seed, period: 8, oct: 4 });
      return TX.paint(w, h, (x, y, u, v, o) => {
        const n = TX.sampleField(f, 256, u * 256, v * 256), k = 0.88 + n * 0.2;
        o[0] = clamp(base[0] * k, 0, 255); o[1] = clamp(base[1] * k, 0, 255); o[2] = clamp(base[2] * k, 0, 255);
      });
    };

    // ============================================================================
    // TERRAIN (vertex-coloured moss, grass, mud and sand) and the WATER
    // ============================================================================
    const terrMat = K.std({ vertexColors: true, map: detail.map, normalMap: detail.normalMap, normalScale: V2(0.8), roughness: 0.93 });
    {
      const CH = 48;
      for (let cz = 0; cz < GH - 1; cz += CH) for (let cx = 0; cx < GW - 1; cx += CH) {
        const nx = Math.min(CH, GW - 1 - cx), nz = Math.min(CH, GH - 1 - cz), W1 = nx + 1;
        const nv = (nx + 1) * (nz + 1);
        const P = new Float32Array(nv * 3), Nn = new Float32Array(nv * 3), U = new Float32Array(nv * 2), Cc = new Float32Array(nv * 3);
        let maxY = -9;
        for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
          const gx = cx + i, gz = cz + j, k = gz * GW + gx, v = j * W1 + i;
          const x = gx + G0X, z = gz + G0Z;
          P[v * 3] = x; P[v * 3 + 1] = H[k]; P[v * 3 + 2] = z; maxY = Math.max(maxY, H[k]);
          const hl = H[gz * GW + Math.max(0, gx - 1)], hr = H[gz * GW + Math.min(GW - 1, gx + 1)];
          const hu = H[Math.max(0, gz - 1) * GW + gx], hd = H[Math.min(GH - 1, gz + 1) * GW + gx];
          const ddx = (hr - hl) / 2, ddz = (hd - hu) / 2, l = Math.hypot(ddx, 1, ddz);
          Nn[v * 3] = -ddx / l; Nn[v * 3 + 1] = 1 / l; Nn[v * 3 + 2] = -ddz / l;
          U[v * 2] = x / 12; U[v * 2 + 1] = -z / 12;
          Cc[v * 3] = CR[k]; Cc[v * 3 + 1] = CG[k]; Cc[v * 3 + 2] = CB[k];
        }
        const idx = [];
        for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
          const a = j * W1 + i, b = a + 1, c = a + W1, d = c + 1;
          if (Math.abs(P[a * 3 + 1] - P[d * 3 + 1]) < Math.abs(P[b * 3 + 1] - P[c * 3 + 1])) idx.push(a, c, d, a, d, b);
          else idx.push(a, c, b, b, c, d);
        }
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('normal', new T.BufferAttribute(Nn, 3));
        g.setAttribute('uv', new T.BufferAttribute(U, 2)); g.setAttribute('color', new T.BufferAttribute(Cc, 3));
        g.setIndex(idx); g.computeBoundingSphere();
        const m = new T.Mesh(g, terrMat); m.receiveShadow = true; m.castShadow = false; void maxY;
        K.group.add(m); keep.push(m);
      }
    }
    {
      const mat = K.phys({ color: 0xffffff, roughness: 0.05, metalness: 0, ior: 1.33, specularIntensity: 1, transparent: true, envMap: skyEnv, envMapIntensity: 0.9 });
      mat.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, {
          uTime: A.uTime, uData: { value: dataTex }, uGrid: { value: new T.Vector4(G0X, G0Z, 1 / GW, 1 / GH) }, uWN: { value: waterN }, uNoiseT: { value: noiseTex },
          uShallow: { value: new T.Color(0x9edcc4) }, uMid: { value: new T.Color(0x34a2a4) }, uDeep: { value: new T.Color(0x14606e) },
        });
        sh.vertexShader = 'varying vec2 vWXZ;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
        sh.fragmentShader = `varying vec2 vWXZ;
          uniform float uTime; uniform sampler2D uData, uWN, uNoiseT; uniform vec4 uGrid; uniform vec3 uShallow, uMid, uDeep;
          float gDepth; vec2 gFlow; float gShore; vec3 gNW = vec3(0.0, 1.0, 0.0);
          vec3 flowN(vec2 p, vec2 fl, float sc, float ofs) {
            float t = uTime * 0.6 + ofs;
            float p0 = fract(t), p1 = fract(t + 0.5);
            float w = abs(0.5 - p0) * 2.0;
            vec3 a = texture2D(uWN, p * sc - fl * p0 * sc * 1.66).xyz;
            vec3 b = texture2D(uWN, p * sc - fl * p1 * sc * 1.66 + 0.43).xyz;
            return mix(b, a, w) * 2.0 - 1.0;
          }
          ` + sh.fragmentShader
          .replace('#include <color_fragment>', `#include <color_fragment>
            {
              vec4 hs = texture2D(uData, (vWXZ - uGrid.xy + 0.5) * uGrid.zw);
              float hgt = hs.r * ${(HMAX - HMIN).toFixed(1)} + ${HMIN.toFixed(1)};
              gDepth = max(0.0, -hgt);
              gFlow = (hs.gb * 2.0 - 1.0) * ${FMAX.toFixed(1)};
              gShore = hs.a;
              float kd = 1.0 - exp(-gDepth * 0.42);
              vec3 wc = mix(uShallow, uMid, smoothstep(0.0, 0.6, kd));
              wc = mix(wc, uDeep, smoothstep(0.6, 1.0, kd));
              float alpha = 0.1 + 0.8 * kd;
              vec2 fp = vWXZ;
              float fnz = texture2D(uNoiseT, fp * 0.09 + vec2(uTime * 0.03, -uTime * 0.02)).g;
              float fnz2 = texture2D(uNoiseT, fp * 0.21 - vec2(uTime * 0.05, uTime * 0.04)).r;
              float lap = 0.5 + 0.5 * sin(uTime * 1.7 + fp.x * 0.23 + fp.y * 0.31 + fnz * 6.0);
              float band = gShore * (1.0 - smoothstep(0.05, 1.25, gDepth));
              float fs = length(gFlow);
              float foam = smoothstep(0.62, 0.8, band * 0.88 + fnz2 * 0.35 - 0.12 + lap * 0.12) * 0.5;
              // rapids: white water round the rocks and streaks drawn along by the current
              foam = max(foam, smoothstep(0.35, 0.8, gShore) * smoothstep(6.0, 12.0, fs) * (0.6 + 0.4 * fnz2));
              vec3 sn = flowN(fp * 0.6, gFlow, 0.11, 0.21);
              float streak = smoothstep(0.42, 0.75, sn.x * 0.5 + 0.5) * smoothstep(1.5, 9.0, fs) * 0.5;
              float white = smoothstep(0.45, 0.8, sn.y * 0.5 + 0.5 + fnz * 0.35 - 0.1) * smoothstep(8.0, 15.0, fs) * 0.75;
              foam = max(foam, max(streak * (0.5 + 0.5 * fnz), white));
              diffuseColor.rgb = mix(wc, vec3(1.0, 0.99, 0.95), foam);
              diffuseColor.a = max(alpha, foam * 0.92);
            }`)
          .replace('#include <normal_fragment_maps>', `{
              vec2 p = vWXZ;
              vec3 a = flowN(p, gFlow + vec2(0.6, 0.4), 0.085, 0.0);
              vec3 b = texture2D(uWN, p * 0.041 + vec2(-0.016, 0.021) * uTime).xyz * 2.0 - 1.0;
              vec3 c = texture2D(uWN, p * 0.19 + vec2(0.031, 0.012) * uTime + 0.5).xyz * 2.0 - 1.0;
              vec2 d = a.xy * 0.5 + b.xy * 0.5 + c.xy * 0.2;
              d *= 0.5 + 0.4 * smoothstep(0.0, 1.5, gDepth) + 0.9 * smoothstep(3.0, 14.0, length(gFlow));
              vec3 nW = normalize(vec3(d.x, 3.2, d.y));
              gNW = nW;
              normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
            }`)
          .replace('#include <opaque_fragment>', `
            float aOut = diffuseColor.a;
            vec3 spk = vec3(0.0);
            #if NUM_DIR_LIGHTS > 0
            {
              vec3 gn = texture2D(uWN, vWXZ * 0.43 + vec2(uTime * 0.07, -uTime * 0.05)).xyz * 2.0 - 1.0;
              vec3 nW2 = normalize(gNW + vec3(gn.x, 0.0, gn.y) * 0.22);
              vec3 n2 = normalize((viewMatrix * vec4(nW2, 0.0)).xyz);
              vec3 Rv = reflect(-geometryViewDir, n2);
              float g = pow(max(dot(Rv, directionalLights[0].direction), 0.0), 500.0);
              spk = directionalLights[0].color * g * 16.0;
            }
            #endif
            gl_FragColor = vec4(totalDiffuse + totalEmissiveRadiance + (totalSpecular + spk) / max(aOut, 0.05), aOut);`);
      };
      mat.customProgramCacheKey = () => 'nile-water';
      const g = new T.PlaneGeometry(GW + 1, GH + 1, 1, 1); g.rotateX(-PI / 2);
      const m = K.mesh(g, mat, (TRAY.x0 + TRAY.x1) / 2, 0, (TRAY.z0 + TRAY.z1) / 2, { cast: false, receive: false });
      m.receiveShadow = false; keep.push(m);
    }

    // ============================================================================
    // COLLIDERS: banks (or cork lines at the open water), cataract rocks
    // ============================================================================
    const buoyRuns = [];
    {
      for (const side of [-1, 1]) {
        const pts = [];
        let run = null;
        for (let s = 0; s < L - 1; s += 3.5) {
          const p = track.at(s), buoy = openAt(s, side, true) > 1.6;
          const off = buoy ? p.w / 2 + 0.7 : p.w / 2 + 2.5;
          const q = { x: p.x + p.nx * side * off, z: p.z + p.nz * side * off, r: buoy ? 0.45 : 1.5, buoy };
          pts.push(q);
          if (buoy) { if (!run) buoyRuns.push(run = { side, s0: s, s1: s }); run.s1 = s; } else run = null;
        }
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i], q = pts[(i + 1) % pts.length];
          K.capsule(p.x, p.z, q.x, q.z, Math.min(p.r, q.r), p.buoy && q.buoy ? 2 : 6);
        }
      }
      for (const rk of rockSpots) K.circle(rk.x, rk.z, rk.r, 50);
    }
    // slow patches: the sandbar and the hyacinth bed
    for (const sb of SHALLOWS) {
      const poly = [];
      for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; const p = track.place(sb.s + Math.cos(a) * sb.la * 0.85, sb.lat + Math.sin(a) * sb.lc * 0.85); poly.push([p.x, p.z]); }
      K.surface('slow', { poly });
    }

    // ============================================================================
    // SHARED GEOMETRY AND MATERIALS
    // ============================================================================
    const rockGeo = (() => {
      const g = new T.IcosahedronGeometry(1, 2);
      const pos = g.attributes.position, rr = K.rng(5), seen = new Map();
      for (let i = 0; i < pos.count; i++) {
        const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
        if (!seen.has(key)) seen.set(key, 0.84 + rr() * 0.26);
        const k = seen.get(key);
        pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k * 0.78, pos.getZ(i) * k);
      }
      g.computeVertexNormals();
      return g;
    })();
    const graniteMat = K.std({ map: graniteTex, color: 0xffffff, roughness: 0.5 });
    // world-space (triplanar) sandstone so big blocks don't stretch the layering
    const triMat = (tex, color, sc = 1 / 9, rough = 0.85) => {
      const m = K.std({ map: tex, color, roughness: rough });
      m.onBeforeCompile = (sh) => {
        sh.vertexShader = 'varying vec3 vWP3;\nvarying vec3 vWN3;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          { vec4 wq = vec4(transformed, 1.0); vec3 wn = objectNormal;
            #ifdef USE_INSTANCING
            wq = instanceMatrix * wq; wn = mat3(instanceMatrix) * wn;
            #endif
            vWP3 = (modelMatrix * wq).xyz; vWN3 = normalize(mat3(modelMatrix) * wn); }`);
        sh.fragmentShader = 'varying vec3 vWP3;\nvarying vec3 vWN3;\n' + sh.fragmentShader.replace('#include <map_fragment>', `
          { vec3 bw = pow(abs(normalize(vWN3)), vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
            vec2 sc = vec2(${sc.toFixed(4)});
            vec4 tx = texture2D(map, vWP3.zy * sc) * bw.x + texture2D(map, vWP3.xz * sc) * bw.y + texture2D(map, vWP3.xy * sc) * bw.z;
            diffuseColor.rgb *= tx.rgb; }`);
      };
      m.customProgramCacheKey = () => 'nile-tri' + sc.toFixed(3);
      return m;
    };
    const sandstone = triMat(sandstoneTex, 0xffffff);
    const sandstoneDark = triMat(sandstoneTex, 0xc9a682);
    const woodMat = K.std({ color: 0x8a5a32, roughness: 0.7 });
    const woodLight = K.std({ color: 0xb98a55, roughness: 0.7 });
    // a lofted wooden hull (forward = +x): stations along x, round bilge, sheer rising to a pointed bow
    const hullGeo = (len, beam, depth, sheer, colFn) => {
      const NSt = 20, NP = 10, pos = [], col = [], idx = [];
      const cc = new T.Color();
      const sec = [];
      for (let i = 0; i <= NSt; i++) {
        const u = i / NSt, x = (u - 0.5) * len;
        const f = Math.pow(Math.sin(PI * (0.07 + 0.93 * u)), 0.55);
        const hb = (beam / 2) * f, top = depth * 0.5 + sheer * Math.pow(Math.abs(u - 0.42) / 0.58, 2.2), kz = -depth * 0.5 * (0.35 + 0.65 * f);
        const row = [];
        for (let j = 0; j <= NP; j++) {
          const a = (j / NP) * PI, zz = -Math.cos(a) * hb, yy = top + (kz - top) * Math.sin(a);
          row.push(pos.length / 3); pos.push(x, yy, zz);
          colFn(cc, (yy - kz) / Math.max(0.01, top - kz), u); col.push(cc.r, cc.g, cc.b);
        }
        sec.push(row);
      }
      for (let i = 0; i < NSt; i++) for (let j = 0; j < NP; j++) { const a = sec[i][j], b = sec[i][j + 1], c = sec[i + 1][j], d = sec[i + 1][j + 1]; idx.push(a, c, b, b, c, d); }
      // transom
      const c0 = pos.length / 3; const s0 = sec[0];
      pos.push(pos[s0[0] * 3], pos[s0[0] * 3 + 1], 0); col.push(col[s0[3] * 3], col[s0[3] * 3 + 1], col[s0[3] * 3 + 2]);
      for (let j = 0; j < NP; j++) idx.push(c0, s0[j], s0[j + 1]);
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
      g.setIndex(idx); g.computeVertexNormals();
      g.setAttribute('uv', new T.BufferAttribute(new Float32Array(pos.length / 3 * 2), 2));
      return g.toNonIndexed();
    };
    const hullMat = K.std({ vertexColors: true, roughness: 0.6, side: T.DoubleSide });
    // a parametric triangle with a belly (sails)
    const sailGeo = (a, b, c, belly, n = 8) => {
      const pos = [], idx = [], uv = [];
      const id = (i, j) => (i * (i + 1)) / 2 + j;
      for (let i = 0; i <= n; i++) for (let j = 0; j <= i; j++) {
        const wa = 1 - i / n, wb = (i - j) / n, wc = j / n;
        pos.push(a[0] * wa + b[0] * wb + c[0] * wc, a[1] * wa + b[1] * wb + c[1] * wc, belly * 27 * wa * wb * wc);
        uv.push(wb + wc * 0.5, wa);
      }
      for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) { idx.push(id(i, j), id(i + 1, j), id(i + 1, j + 1)); if (j < i) idx.push(id(i, j), id(i + 1, j + 1), id(i, j + 1)); }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals();
      return g;
    };
    const sailTex = (() => {
      const c = TX.paint(128, 128, (x, y, u, v, o) => { const seam = Math.abs(((u * 7) % 1) - 0.5) > 0.47 ? 0.9 : 1; const k = (0.95 + 0.05 * Math.sin(v * 40)) * seam; o[0] = 250 * k; o[1] = 246 * k; o[2] = 236 * k; });
      return TX.toTexture(c);
    })();
    const sailMat = K.std({ map: sailTex, side: T.DoubleSide, roughness: 0.85 });
    const felHullGeo = hullGeo(8.8, 2.9, 1.5, 0.9, (cc, h, u) => cc.setHex(h > 0.86 ? 0x2f6fb0 : h > 0.78 ? 0xf3ead8 : h > 0.2 ? 0xe9dcc0 : 0x8a3a24));
    const makeFelucca = (furled) => {
      const g = new T.Group();
      g.add(new T.Mesh(felHullGeo, hullMat));
      for (const x of [-2.4, 0.2, 2.2]) { const th = new T.Mesh(new T.BoxGeometry(0.4, 0.12, 2.3 - Math.abs(x) * 0.3), woodLight); th.position.set(x, 0.45, 0); g.add(th); }
      const mast = new T.Mesh(new T.CylinderGeometry(0.1, 0.15, 9, 7), woodMat); mast.position.set(1.6, 4.6, 0); mast.rotation.z = 0.06; g.add(mast);
      const body = mergeGroup(g);
      const root = new T.Group(); root.add(body);
      const rig = new T.Group(); rig.position.set(1.6, 0, 0); root.add(rig);
      const tack = [3.2, 1.2], peak = [-5.2, 11.6], clew = [-4.6, 1.15];
      const yl = Math.hypot(peak[0] - tack[0], peak[1] - tack[1]);
      const yard = new T.Mesh(new T.CylinderGeometry(0.07, 0.11, yl + 0.8, 6), woodMat);
      yard.position.set((tack[0] + peak[0]) / 2, (tack[1] + peak[1]) / 2, 0); yard.rotation.z = Math.atan2(peak[1] - tack[1], peak[0] - tack[0]) - PI / 2;
      rig.add(yard);
      if (furled) {
        const roll = new T.Mesh(new T.CylinderGeometry(0.28, 0.2, yl * 0.9, 8), sailMat);
        roll.position.copy(yard.position); roll.position.x -= 0.2; roll.rotation.z = yard.rotation.z; rig.add(roll);
        rig.rotation.y = 0.2;
      } else {
        const boom = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, tack[0] - clew[0], 6), woodMat); boom.position.set((tack[0] + clew[0]) / 2, 1.1, 0); boom.rotation.z = PI / 2; rig.add(boom);
        const sail = new T.Mesh(sailGeo(tack, peak, clew, 0.75), sailMat); rig.add(sail);
      }
      return { root, rig };
    };

    // ============================================================================
    // THE CATARACT: granite boulders in the rapids and along the banks
    // ============================================================================
    {
      const rl = [];
      const rr = K.rng(404);
      for (const rk of rockSpots) {
        rl.push({ x: rk.x, y: rk.r * 0.12, z: rk.z, sx: rk.r * 1.02, sy: rk.r * 0.95, sz: rk.r * 0.98, ry: rr() * 6, color: rr.pick([0xd8c4bc, 0xc0aca6, 0xe2d2c8]) });
        for (let i = 0; i < 2; i++) { const a = rr() * TAU, d = rk.r * 0.55; rl.push({ x: rk.x + Math.cos(a) * d, y: 0, z: rk.z + Math.sin(a) * d, s: rk.r * rr.range(0.4, 0.55), ry: rr() * 6, color: 0xb8a49c }); }
        A.rocks.push({ x: rk.x, z: rk.z, r: rk.r });
      }
      for (const b of bankRocks) rl.push({ x: b.x, y: hAt(b.x, b.z) * 0.4 - b.r * 0.15, z: b.z, sx: b.r, sy: b.r * rr.range(0.7, 1.0), sz: b.r * rr.range(0.8, 1.1), ry: b.ry, color: rr.pick([0xd6c2b8, 0xbfa9a0, 0xa89490, 0xe0d0c4]) });
      K.instances(rockGeo, graniteMat, rl, { colors: true });
    }

    // ============================================================================
    // REEDS (papyrus), GRASS, LILY PADS, LOTUS, FLOATING LEAVES
    // ============================================================================
    const swayMat = (mat) => {
      mat.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = A.uTime;
        sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <project_vertex>', `
          vec4 mvPosition = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
          { float hy = max(0.0, mvPosition.y); float ph = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.23;
            float sw = sin(uTime * 1.5 + ph) * 0.014 + sin(uTime * 2.6 + ph * 1.7) * 0.006;
            mvPosition.x += sw * hy * hy; mvPosition.z += sw * 0.5 * hy * hy; }
          #endif
          mvPosition = modelViewMatrix * mvPosition;
          gl_Position = projectionMatrix * mvPosition;`);
      };
      mat.customProgramCacheKey = () => 'nile-sway' + (mat.alphaTest || 0);
      return mat;
    };
    const quaySpan = { s0: START_S - 60, s1: START_S + 34 }; // the temple quay (north bank)
    const onQuay = (s, side) => side > 0 && wrapS(s - quaySpan.s0) < quaySpan.s1 - quaySpan.s0;
    {
      const stems = [], heads = [];
      const rr = K.rng(505);
      const eul = new T.Euler(), v = new T.Vector3();
      const clump = (x, z, n, hMax) => {
        for (let i = 0; i < n; i++) {
          const a = rr() * TAU, d = Math.sqrt(rr()) * 1.6, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
          const h = rr.range(0.55, 1) * hMax, rx = rr.range(-0.16, 0.16), rz = rr.range(-0.16, 0.16), ry = rr() * 6;
          const y0 = Math.max(-0.2, hAt(px, pz)) - 0.1;
          stems.push({ x: px, y: y0, z: pz, sx: 1, sy: h, sz: 1, rx, rz, ry });
          eul.set(rx, ry, rz, 'YXZ'); v.set(0, h, 0).applyEuler(eul);
          heads.push({ x: px + v.x, y: y0 + v.y, z: pz + v.z, rx, ry, rz, s: rr.range(0.75, 1.05), color: rr.pick([0x8fb04a, 0xa6bf5a, 0x7da23e, 0xb4c868]) });
        }
      };
      const step = 7.5 / Math.max(0.45, Q);
      for (const side of [-1, 1]) {
        for (let s = rr() * 4; s < L; s += step * rr.range(0.7, 1.4)) {
          if (inCat(s, 10) || onQuay(s, side) || openAt(s, side, true) > 0.5 || Math.abs(dS(s, START_S)) < 8) continue;
          if (rr() < 0.25) continue;
          const p = track.at(s), q = track.place(s, side * (p.w / 2 + 1.6 + rr() * 2.0));
          clump(q.x, q.z, 4 + Math.floor(rr() * 5), rr.range(3.2, 5.0));
        }
      }
      // round the bay and the hippo pool
      for (const o of OPEN) {
        if (!o.buoys) continue;
        for (let k = 0; k < 14 * Q + 6; k++) {
          const s = o.s + rr.range(-o.half, o.half), p = track.at(s), dd = openAt(s, o.side, true);
          const q = track.place(s, o.side * (p.w / 2 + 0.2 + dd + rr.range(0.6, 2.2)));
          if (hAt(q.x, q.z) > -0.6 && hAt(q.x, q.z) < 1.6) clump(q.x, q.z, 3 + Math.floor(rr() * 4), rr.range(3, 4.6));
        }
      }
      const stemGeo = new T.CylinderGeometry(0.05, 0.075, 1, 4, 1, true); stemGeo.translate(0, 0.5, 0);
      K.instances(stemGeo, swayMat(K.std({ color: 0x6f9a38, roughness: 0.7 })), stems, { cast: true });
      const umbelTex = (() => {
        const c = TX.makeCanvas(128, 128), g = c.getContext('2d');
        const rr2 = K.rng(66);
        g.strokeStyle = 'rgba(255,255,255,1)';
        for (let i = 0; i < 120; i++) { const a = rr2() * TAU, l = 40 + rr2() * 24; g.lineWidth = 1 + rr2() * 1.5; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.cos(a) * l, 64 + Math.sin(a) * l); g.stroke(); }
        return TX.toTexture(c, { wrap: false });
      })();
      const ug = new T.ConeGeometry(1.0, 0.75, 10, 1, true); ug.rotateX(PI); ug.translate(0, 0.37, 0);
      // map the cone as seen from above: radial uv
      { const p = ug.attributes.position, uv = ug.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, 0.5 + p.getX(i) * 0.5, 0.5 + p.getZ(i) * 0.5); }
      K.instances(ug, swayMat(K.std({ color: 0xffffff, map: umbelTex, alphaTest: 0.4, side: T.DoubleSide, roughness: 0.8 })), heads, { colors: true, cast: true });
    }
    {
      // static model grass in tufts
      const tg = (() => {
        const pos = [];
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * TAU, lean = 0.35, w = 0.09;
          const bx = Math.cos(a) * 0.1, bz = Math.sin(a) * 0.1, tx = Math.cos(a) * lean, tz = Math.sin(a) * lean;
          pos.push(bx - Math.sin(a) * w, 0, bz + Math.cos(a) * w, bx + Math.sin(a) * w, 0, bz - Math.cos(a) * w, tx, 1, tz);
        }
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
        const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
        g.setAttribute('uv', new T.BufferAttribute(new Float32Array(pos.length / 3 * 2), 2));
        return g;
      })();
      const tufts = [];
      const rr = K.rng(606);
      for (let i = 0; i < 30000 && tufts.length < 2400 * Q + 300; i++) {
        const x = rr.range(TRAY.x0 + 3, TRAY.x1 - 3), z = rr.range(TRAY.z0 + 3, TRAY.z1 - 3), e = eAt(x, z);
        if (e < 1.6 || e > 14 || hAt(x, z) < 0.3 || FLATS.some((f) => flatW(f, x, z) > 0.2)) continue;
        const s = rr.range(0.7, 1.5);
        tufts.push({ x, y: hAt(x, z) - 0.05, z, ry: rr() * 6, sx: s, sy: s * rr.range(0.8, 1.4), sz: s, color: rr.pick([0x6e9a30, 0x8fb040, 0x5e8a2a, 0xa6b450, 0x7fa83a]) });
      }
      K.instances(tg, K.std({ color: 0xffffff, roughness: 0.85, side: T.DoubleSide }), tufts, { colors: true, cast: false });
    }
    {
      // lily pads with lotus flowers, floating leaves: calm water near the banks
      const padG = new T.CircleGeometry(1, 14, 0.35, TAU - 0.7); padG.rotateX(-PI / 2);
      const pads = [], flowers = [], leaves = [];
      const rr = K.rng(707);
      for (let i = 0; i < 4000 && pads.length < 170 * Q + 50; i++) {
        const s = rr() * L, side = rr() < 0.5 ? -1 : 1;
        if (inCat(s, 12) || Math.abs(dS(s, START_S)) < 10) continue;
        const p = track.at(s), lat = side * (p.w / 2 - 0.6 + rr() * (2.2 + openAt(s, side, true)));
        const q = track.place(s, lat);
        if (hAt(q.x, q.z) > -0.35) continue;
        const sc = rr.range(0.55, 1.15);
        pads.push({ x: q.x, y: 0.03, z: q.z, ry: rr() * 6, s: sc, color: rr.pick([0x4f8a2e, 0x5f9a36, 0x3f7a28, 0x6aa040]) });
        if (rr() < 0.18) flowers.push({ x: q.x + 0.2, y: 0.05, z: q.z, ry: rr() * 6, s: sc * 0.9, color: rr.pick([0xf4c6d6, 0xffffff, 0xe8a0c0, 0xa8c8f0]) });
      }
      K.instances(padG, K.std({ color: 0xffffff, roughness: 0.45, side: T.DoubleSide }), pads, { colors: true, cast: false });
      const fl = new T.ConeGeometry(0.42, 0.6, 7, 1, true); fl.translate(0, 0.3, 0); fl.rotateX(PI); fl.translate(0, 0.62, 0);
      K.instances(fl, K.std({ color: 0xffffff, roughness: 0.55, side: T.DoubleSide }), flowers, { colors: true, cast: false });
      const lg = (() => { const s = new T.Shape(); s.moveTo(-1, 0); s.quadraticCurveTo(0, 0.6, 1.1, 0); s.quadraticCurveTo(0, -0.6, -1, 0); const g = new T.ShapeGeometry(s, 5); g.rotateX(-PI / 2); return g; })();
      for (let i = 0; i < 60; i++) {
        const s = rr() * L, p = track.at(s), q = track.place(s, rr.range(-p.w / 2, p.w / 2));
        leaves.push({ x: q.x, y: 0.035, z: q.z, ry: rr() * 6, s: rr.range(0.6, 1.2), color: rr.pick([0x8aa03a, 0xb8a040, 0x9c7a34, 0x6a8a2e]) });
      }
      K.instances(lg, K.std({ color: 0xffffff, roughness: 0.6, side: T.DoubleSide }), leaves, { colors: true, cast: false });
      // water hyacinth on the weed bed: leafy rosettes with lilac flowers
      const wb = SHALLOWS[1], ros = [], spikes = [];
      for (let i = 0; i < 70; i++) {
        const a = rr() * TAU, d = Math.sqrt(rr());
        const q = track.place(wb.s + Math.cos(a) * d * wb.la, wb.lat + Math.sin(a) * d * wb.lc * 1.1);
        ros.push({ x: q.x, y: 0.1, z: q.z, sx: rr.range(0.6, 1.0), sy: 0.35, sz: rr.range(0.6, 1.0), ry: rr() * 6, color: rr.pick([0x3f7a2a, 0x4f8a30, 0x5a9a38]) });
        if (rr() < 0.35) spikes.push({ x: q.x, y: 0.3, z: q.z, s: rr.range(0.25, 0.4), color: rr.pick([0xb49ae0, 0xc8aef0, 0x9c84d0]) });
      }
      K.instances(new T.SphereGeometry(1, 10, 6), K.std({ color: 0xffffff, roughness: 0.5 }), ros, { colors: true, cast: false });
      K.instances(new T.ConeGeometry(0.6, 1.8, 6), K.std({ color: 0xffffff, roughness: 0.6 }), spikes, { colors: true, cast: false });
    }

    // ============================================================================
    // CORK LINES at the open water, START / FINISH
    // ============================================================================
    {
      const floats = [];
      let n = 0;
      for (const run of buoyRuns) {
        const pts = [];
        for (let s = run.s0 - 2; s <= run.s1 + 2; s += 1.8) {
          const p = track.at(s), q = track.place(s, run.side * (p.w / 2 + 0.7));
          pts.push(new T.Vector3(q.x, 0.08, q.z));
          floats.push({ x: q.x, y: 0.12, z: q.z, ry: -p.angle, sx: 1.2, sy: 0.85, sz: 0.85, color: (n++ % 6 < 3) ? 0xd8402c : 0xf2ede0 });
        }
        if (pts.length > 3) K.mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), pts.length * 2, 0.08, 5, false), SM(0xe8e2d0, 0.8), 0, 0, 0, { cast: false });
      }
      const fmat = K.phys({ color: 0xffffff, roughness: 0.4, clearcoat: 0.4 });
      fmat.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = A.uTime;
        sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          #ifdef USE_INSTANCING
          { float ph = instanceMatrix[3].x * 0.41 + instanceMatrix[3].z * 0.27; transformed.y += sin(uTime * 2.1 + ph) * 0.1 / 0.85; }
          #endif`);
      };
      fmat.customProgramCacheKey = () => 'nile-bob';
      keep.push(K.instances(new T.SphereGeometry(0.55, 12, 8), fmat, floats, { colors: true }));
    }
    {
      const p = track.at(START_S);
      const c = TX.makeCanvas(256, 64), g = c.getContext('2d');
      for (let y = 0; y < 2; y++) for (let x = 0; x < 16; x++) { g.fillStyle = (x + y) % 2 ? '#1b1b1b' : '#f7f4ec'; g.fillRect(x * 16, y * 32, 16, 32); }
      const strip = new T.Mesh(new K.RoundedBoxGeometry(p.w + 1.5, 0.3, 2.2, 2, 0.12), K.std({ map: TX.toTexture(c, { wrap: false }), roughness: 0.6 }));
      strip.position.set(p.x, 0.04, p.z); strip.rotation.y = -p.angle + PI / 2;
      K.add(strip, { cast: false }); keep.push(strip);
      const fc = TX.makeCanvas(128, 96), fg = fc.getContext('2d');
      for (let y = 0; y < 6; y++) for (let x = 0; x < 8; x++) { fg.fillStyle = (x + y) % 2 ? '#111' : '#fafafa'; fg.fillRect(x * 16, y * 16, 16, 16); }
      const flagMat = K.std({ map: TX.toTexture(fc, { wrap: false }), side: T.DoubleSide, roughness: 0.7 });
      for (const side of [-1, 1]) {
        const q = track.place(START_S, side * (p.w / 2 + 2.4)), y0 = groundY(q.x, q.z), hp = side > 0 ? 11 : 6;
        K.mesh(new T.CylinderGeometry(0.2, 0.24, hp, 8), woodLight, q.x, y0 + hp / 2, q.z);
        const fl = new T.Mesh(new T.PlaneGeometry(4, 2.8, 6, 1), flagMat);
        const pp = fl.geometry.attributes.position;
        for (let i = 0; i < pp.count; i++) pp.setZ(i, Math.sin((pp.getX(i) + 2) * 1.3) * 0.3 * (pp.getX(i) + 2) / 4);
        fl.geometry.computeVertexNormals();
        fl.position.set(q.x + 2, y0 + hp - 1.4, q.z); fl.rotation.y = 0.15;
        K.add(fl);
        AO(q.x, q.z, 1.2, 1.2, 0.4, 0, y0 + 0.05);
      }
    }

    // ============================================================================
    // LANDMARK: the temple (pylon gate, two seated colossi, an obelisk) on its stone quay
    // ============================================================================
    {
      const tx = TEMPLE.x, tz = TEMPLE.z, y0 = 2.0;
      const rr = K.rng(808);
      // painted relief for the pylon faces
      const reliefTex = (() => {
        const c = stoneCanvas(256, 288, [226, 196, 146], 97), g = c.getContext('2d');
        // border band
        const bc = ['#244e8c', '#c9a227', '#8a3a20', '#2f6e52'];
        for (let i = 0; i < 16; i++) { g.fillStyle = bc[i % 4]; g.fillRect(i * 16, 0, 16, 10); }
        // two big striding figures (generic, flat painted)
        const fig = (x, flip, colA, colB) => {
          g.save(); g.translate(x, 0); g.scale(flip, 1);
          g.fillStyle = colA; g.beginPath(); g.ellipse(0, 70, 11, 13, 0, 0, TAU); g.fill(); // head
          g.fillStyle = colB; g.beginPath(); g.moveTo(-10, 60); g.lineTo(-6, 34); g.lineTo(6, 34); g.lineTo(10, 60); g.fill(); // tall crown
          g.fillStyle = colA; g.fillRect(-12, 84, 24, 52); // torso
          g.fillStyle = '#f2ead8'; g.beginPath(); g.moveTo(-14, 136); g.lineTo(14, 136); g.lineTo(20, 182); g.lineTo(-18, 182); g.fill(); // kilt
          g.fillStyle = colA; g.fillRect(-12, 182, 8, 56); g.fillRect(6, 182, 8, 56); g.fillRect(16, 232, 14, 6); g.fillRect(-16, 232, 12, 6);
          g.strokeStyle = colA; g.lineWidth = 6; g.beginPath(); g.moveTo(10, 92); g.lineTo(34, 118); g.stroke(); // arm
          g.strokeStyle = '#a8761c'; g.lineWidth = 3; g.beginPath(); g.moveTo(36, 60); g.lineTo(36, 238); g.stroke(); // staff
          g.beginPath(); g.ellipse(36, 54, 6, 8, 0, 0, TAU); g.stroke();
          g.restore();
        };
        fig(80, 1, '#a24a2a', '#c9a227'); fig(176, -1, '#9a4426', '#2a5a9a');
        glyphColumns(g, 6, 20, 40, 260, 2, 18, rr); glyphColumns(g, 210, 20, 40, 260, 2, 18, rr);
        g.fillStyle = 'rgba(80,50,20,0.08)'; for (let i = 0; i < 300; i++) g.fillRect(rr() * 256, rr() * 288, 2 + rr() * 3, 1 + rr() * 2);
        return TX.toTexture(c, { wrap: false });
      })();
      const sideTex = (() => {
        const c = stoneCanvas(256, 256, [222, 190, 140], 98), g = c.getContext('2d');
        glyphColumns(g, 10, 10, 236, 236, 7, 22, rr);
        return TX.toTexture(c, { wrap: false });
      })();
      const relief = K.std({ map: reliefTex, roughness: 0.85 }), sideM = K.std({ map: sideTex, roughness: 0.85 }), topM = SM(0xd4b07a, 0.9);
      const cornTex = (() => {
        const c = TX.makeCanvas(256, 32), g = c.getContext('2d');
        const cols = ['#2a5a9a', '#d8c08a', '#2f6e52', '#d8c08a', '#a24a2a', '#d8c08a'];
        for (let i = 0; i < 32; i++) { g.fillStyle = cols[i % 6]; g.fillRect(i * 8, 0, 8, 26); }
        g.fillStyle = '#c9a227'; g.fillRect(0, 26, 256, 6);
        return TX.toTexture(c, { repeat: [3, 1] });
      })();
      const cornM = K.std({ map: cornTex, roughness: 0.8 });
      const battered = (w, h, d, kx = 0.82, kz = 0.78) => {
        const g = new T.BoxGeometry(w, h, d); const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) { p.setX(i, p.getX(i) * kx); p.setZ(i, p.getZ(i) * kz); }
        g.translate(0, h / 2, 0); g.computeVertexNormals();
        return g;
      };
      const PH = 19, PW = 16, PD = 7.5;
      for (const sx of [-1, 1]) {
        const x = tx + sx * 10.5;
        K.mesh(battered(PW, PH, PD), [sideM, sideM, topM, topM, relief, sideM], x, y0, tz);
        K.mesh(new K.RoundedBoxGeometry(PW * 0.86, 1.4, PD * 0.84, 2, 0.3), cornM, x, y0 + PH + 0.5, tz);
        // flagpoles with pennants in the niches
        for (const dx of [-3.6, 3.6]) {
          K.mesh(new T.CylinderGeometry(0.16, 0.2, 26, 6), woodMat, x + dx, y0 + 13, tz + PD * 0.42);
          const pen = new T.Mesh(new T.PlaneGeometry(4.2, 1.1), SM(rr.pick([0xb83a24, 0x2a5a9a, 0xe8dcc0]), 0.8, { side: T.DoubleSide }));
          pen.position.set(x + dx + 2.1, y0 + 24.6, tz + PD * 0.42); pen.rotation.y = 0.25; K.add(pen);
        }
        AO(x, tz, PW * 0.65, PD * 0.75, 0.5, 0, y0 + 0.05);
      }
      // the gate between the towers, its dark doorway and a winged disc over it
      K.mesh(battered(6, 13.5, 6, 0.95, 0.95), [sideM, sideM, topM, topM, sideM, sideM], tx, y0, tz);
      K.mesh(new K.RoundedBoxGeometry(7.4, 1.4, 6.6, 2, 0.3), cornM, tx, y0 + 14, tz);
      K.mesh(new T.BoxGeometry(3.2, 8, 0.4), SM(0x2a1c12, 1), tx, y0 + 4, tz + 3.05, { cast: false });
      const wd = TX.makeCanvas(256, 64), wg = wd.getContext('2d');
      wg.fillStyle = '#c9a227'; wg.beginPath(); wg.arc(128, 32, 18, 0, TAU); wg.fill();
      for (const sxx of [-1, 1]) for (let i = 0; i < 6; i++) { wg.fillStyle = i % 2 ? '#2a5a9a' : '#2f8a6a'; wg.beginPath(); wg.moveTo(128 + sxx * 20, 24 + i * 3); wg.lineTo(128 + sxx * (110 - i * 10), 14 + i * 7); wg.lineTo(128 + sxx * (104 - i * 10), 22 + i * 7); wg.lineTo(128 + sxx * 20, 30 + i * 3); wg.fill(); }
      const disc = new T.Mesh(new T.PlaneGeometry(6, 1.5), K.std({ map: TX.toTexture(wd, { wrap: false }), transparent: true, alphaTest: 0.3, roughness: 0.7 }));
      disc.position.set(tx, y0 + 11, tz + 3.0 + 0.02); K.add(disc, { cast: false });
      // forecourt paving and the stone quay with steps down to the water
      const flagTex = (() => {
        const c = stoneCanvas(512, 128, [214, 186, 142], 101), g = c.getContext('2d');
        g.strokeStyle = 'rgba(110,80,50,0.55)'; g.lineWidth = 2;
        for (let j = 0; j < 4; j++) { g.beginPath(); g.moveTo(0, j * 32); g.lineTo(512, j * 32); g.stroke(); for (let i = 0; i < 12; i++) { const x = i * 44 + (j % 2) * 22 + rr() * 8; g.beginPath(); g.moveTo(x, j * 32); g.lineTo(x, j * 32 + 32); g.stroke(); } }
        return TX.toTexture(c, { wrap: false });
      })();
      K.mesh(new T.BoxGeometry(72, 0.6, 14), [sandstone, sandstone, K.std({ map: flagTex, roughness: 0.9 }), sandstone, sandstone, sandstone], tx, y0 + 0.05, tz + 10.5, { cast: false });
      const quay = [];
      for (let s = quaySpan.s0; s < quaySpan.s1; s += 2.6) {
        const p = track.at(s);
        for (const [course, y] of [[0, -0.3], [1, 0.75]]) {
          const q = track.place(s + course * 1.3, p.w / 2 + 1.75);
          quay.push({ x: q.x, y, z: q.z, ry: -p.angle, sx: 2.5, sy: 1.05, sz: 1.7, color: rr.pick([0xffffff, 0xf0e4d0, 0xe4d2b8]) });
        }
      }
      K.instances(new K.RoundedBoxGeometry(1, 1, 1, 1, 0.08), sandstone, quay, { colors: true });
      for (let i = 0; i < 4; i++) K.mesh(new T.BoxGeometry(8 + i * 0.6, 0.45, 1.1), sandstone, tx, 2.1 - i * 0.55, tz + 17.6 + i * 1.0, { cast: false });
      // the two seated colossi (painted clay)
      const skin = PL(0xb5643a, 0.6), kilt = PL(0xf0e8d6, 0.6), throneM = triMat(sandstoneTex, 0xe8d0a8), dark = PL(0x1e1612, 0.4);
      const nemesTex = (() => { const c = TX.makeCanvas(64, 64), g = c.getContext('2d'); for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#2a4f96' : '#d8b03a'; g.fillRect(0, i * 8, 64, 8); } return TX.toTexture(c); })();
      const nemes = K.std({ map: nemesTex, roughness: 0.55 });
      const colossus = (x, z) => {
        const g = new T.Group();
        const add = (geo, m, px, py, pz, rx = 0, ry = 0, rz = 0) => { const o = new T.Mesh(geo, m); o.position.set(px, py, pz); o.rotation.set(rx, ry, rz); g.add(o); return o; };
        add(new T.BoxGeometry(6.4, 1.4, 7.6), throneM, 0, 0.7, 0);
        add(new T.BoxGeometry(5.6, 7.2, 3.2), throneM, 0, 5, -2.0);
        add(new T.BoxGeometry(5.2, 1.5, 4.6), kilt, 0, 5.1, 0.4);
        for (const sx of [-1.25, 1.25]) {
          add(new T.BoxGeometry(1.5, 4.0, 1.6), skin, sx, 3.4, 2.3);
          add(new T.BoxGeometry(1.6, 0.7, 2.4), skin, sx, 1.75, 2.8);
          add(new T.BoxGeometry(0.9, 3.6, 1.0), skin, sx * 2.05, 7.2, 0.6, 0.35, 0, 0);
          add(new T.BoxGeometry(1.0, 0.6, 1.5), skin, sx * 1.6, 6.0, 2.2);
        }
        const torso = add(new T.CylinderGeometry(1.4, 1.1, 4.4, 4), skin, 0, 7.9, -0.2, 0, PI / 4, 0); torso.scale.set(1.45, 1, 0.75);
        add(new T.SphereGeometry(1.05, 16, 12), skin, 0, 10.9, 0.0).scale.set(0.95, 1.12, 1);
        add(new T.CylinderGeometry(1.05, 1.6, 2.6, 4, 1, true), nemes, 0, 10.7, -0.35, 0, PI / 4, 0).scale.set(1.3, 1, 0.9);
        add(new T.BoxGeometry(2.4, 0.5, 2.0), nemes, 0, 12.1, -0.2);
        for (const sx of [-1, 1]) add(new T.BoxGeometry(0.7, 2.6, 0.35), nemes, sx * 1.15, 9.3, 0.55);
        add(new T.BoxGeometry(0.42, 1.0, 0.4), skin, 0, 9.45, 0.82);
        for (const sx of [-0.38, 0.38]) { add(new T.SphereGeometry(0.17, 8, 6), kilt, sx, 11.1, 0.92); add(new T.SphereGeometry(0.09, 6, 5), dark, sx, 11.1, 1.04); }
        add(new T.BoxGeometry(0.6, 0.12, 0.2), PL(0x7a2a1a, 0.5), 0, 10.4, 0.98);
        const m = mergeGroup(g); m.position.set(x, y0, z); K.add(m);
        AO(x, z, 4.5, 5.2, 0.45, 0, y0 + 0.06);
      };
      colossus(tx - 8.6, tz + 9.5); colossus(tx + 8.6, tz + 9.5);
      // the obelisk, east of the gate, on its plinth: pink granite with incised glyph columns and a gold tip
      {
        const ox = tx + 25, oz = tz + 10;
        const oc = (() => {
          const c = TX.makeCanvas(256, 256), g = c.getContext('2d');
          const im = TX.paint(256, 256, (x, y, u, v, o) => { const n = TX.sampleField(TX.noiseField(64, { seed: 99, period: 4, oct: 3 }), 64, u * 64, v * 64); o[0] = 200 + n * 30; o[1] = 150 + n * 22; o[2] = 140 + n * 20; });
          g.drawImage(im, 0, 0);
          for (let f = 0; f < 4; f++) glyphColumns(g, f * 64 + 18, 8, 28, 240, 1, 16, rr, ['#6a3a30', '#5a2e26', '#7a4436']);
          return TX.toTexture(c, { wrap: false });
        })();
        const OH = 22, ob = new T.CylinderGeometry(1.25, 1.8, OH, 4, 1); ob.rotateY(PI / 4); ob.translate(0, OH / 2, 0);
        K.mesh(new T.BoxGeometry(5, 1.6, 5), sandstoneDark, ox, y0 + 0.8, oz);
        K.mesh(ob, K.std({ map: oc, roughness: 0.55 }), ox, y0 + 1.6, oz);
        const tip = new T.ConeGeometry(1.25, 1.8, 4); tip.rotateY(PI / 4);
        K.mesh(tip, K.metal(0xe0b44a, 0.3), ox, y0 + 1.6 + OH + 0.9, oz);
        AO(ox, oz, 3.6, 3.6, 0.5, 0, y0 + 0.06);
      }
      // sphinx-like lions? no: a pair of offering stands and pots by the gate
      for (const sx of [-1, 1]) {
        K.mesh(new T.CylinderGeometry(0.7, 0.9, 2.2, 10), sandstoneDark, tx + sx * 3.8, y0 + 1.1, tz + 6.5);
        K.mesh(new T.SphereGeometry(0.8, 10, 8), PL(0xc06a3a, 0.6), tx + sx * 3.8, y0 + 2.6, tz + 6.5);
      }
    }

    // ============================================================================
    // LANDMARK: the sandstone quarry inside the east bend, with an unfinished obelisk
    // ============================================================================
    {
      const qx = QUARRY.x, qz = QUARRY.z, y0 = 2.0;
      const blk = (w, h, d, x, y, z, m = sandstone) => K.mesh(new K.RoundedBoxGeometry(w, h, d, 2, 0.35), m, x, y + h / 2, z);
      blk(38, 3.2, 30, qx, y0, qz);
      blk(30, 2.6, 22, qx + 2, y0 + 3.2, qz - 2);
      blk(14, 2.2, 12, qx + 7, y0 + 5.8, qz - 5);
      // stepped cuts down the south-west face
      for (let i = 0; i < 4; i++) blk(6 - i, 0.9, 3.2, qx - 15 + i * 1.2, y0 + i * 0.8, qz + 14 - i * 1.6, sandstoneDark);
      // the trench with the unfinished obelisk lying in it
      K.mesh(new T.BoxGeometry(24, 0.4, 6), SM(0x9a7a52, 0.95), qx - 1, y0 + 5.62, qz + 3, { cast: false });
      const ob = new T.CylinderGeometry(1.2, 1.7, 22, 4, 1); ob.rotateY(PI / 4); ob.rotateZ(PI / 2);
      K.mesh(ob, sandstoneDark, qx - 1, y0 + 6.6, qz + 3);
      // cut blocks, a wooden sledge with rollers, rope
      const rr = K.rng(909), blocks = [];
      for (let i = 0; i < 14; i++) {
        const a = rr() * TAU, d = rr.range(19, 27), x = qx + Math.cos(a) * d, z = qz + Math.sin(a) * d * 0.85;
        if (!K.offRoad(x, z, 4) || eAt(x, z) < 3) continue;
        blocks.push({ x, y: groundY(x, z) + 0.7, z, sx: rr.range(2.2, 3.4), sy: 1.4, sz: rr.range(1.6, 2.4), ry: rr() * 3, color: rr.pick([0xffffff, 0xf0dcc0, 0xe0c8a8]) });
        AO(x, z, 2.2, 1.8, 0.3, 0, groundY(x, z) + 0.05);
      }
      K.instances(new K.RoundedBoxGeometry(1, 1, 1, 1, 0.1), sandstone, blocks, { colors: true });
      const sx = qx - 22, sz = qz - 6, sy = groundY(sx, sz);
      K.mesh(new T.BoxGeometry(7, 0.5, 3), woodMat, sx, sy + 1.4, sz);
      for (const dx of [-2.5, 0, 2.5]) K.mesh(new T.CylinderGeometry(0.5, 0.5, 4, 10), woodLight, sx + dx, sy + 0.5, sz, { rx: PI / 2 });
      K.mesh(new K.RoundedBoxGeometry(4.5, 2.2, 2.4, 2, 0.2), sandstone, sx, sy + 2.75, sz);
      K.mesh(new T.TorusGeometry(1.0, 0.18, 6, 18), SM(0xc8a870, 0.9), sx - 5, sy + 0.2, sz + 2.4, { rx: PI / 2 });
      AO(qx, qz, 22, 18, 0.45, 0, y0 + 0.05);
      AO(sx, sz, 4.5, 2.5, 0.4, 0, sy + 0.05);
    }

    // ============================================================================
    // STACKED-CARDBOARD HILLS (cut contour layers, painted sand on top)
    // ============================================================================
    {
      const edgeTex = (() => {
        const c = TX.makeCanvas(128, 32), g = c.getContext('2d');
        g.fillStyle = '#b08a5a'; g.fillRect(0, 0, 128, 32);
        g.fillStyle = '#c9a473'; g.fillRect(0, 0, 128, 5); g.fillRect(0, 27, 128, 5);
        g.strokeStyle = '#8a6a42'; g.lineWidth = 2; g.beginPath();
        for (let x = 0; x <= 128; x += 2) g.lineTo(x, 16 + Math.sin(x * 0.4) * 8);
        g.stroke();
        return TX.toTexture(c, { repeat: [0.4, 1] });
      })();
      const edgeM = K.std({ map: edgeTex, roughness: 0.9 });
      const capM = K.std({ map: detail.map, color: 0xe2c48c, roughness: 0.95 });
      const HILLS = [[34, -96, 14, 6], [92, -99, 15, 7], [150, -90, 12, 5], [-150, -96, 13, 6], [-196, -100, 9, 4], [10, 28, 10, 5], [-150, 2, 10, 4], [-20, -8, 14, 6], [60, 0, 12, 6]];
      const capsGeo = [], sidesGeo = [];
      const rr = K.rng(1010);
      for (const [hx, hz, R, n] of HILLS) {
        if (eAt(hx, hz) < R * 0.7 || !clearView(hx, hz, n * 1.3, R)) continue;
        for (let i = 0; i < n; i++) {
          const rad = R * (1 - i / (n + 0.6)) * rr.range(0.92, 1.05);
          const cx = hx + rr.range(-1.5, 1.5) * i * 0.4, cz = hz + rr.range(-1.5, 1.5) * i * 0.4;
          const poly = K.blobOutline(rr, cx, cz, rad, 0.3, 28, 1.25, rr() * PI);
          const sh = new T.Shape(); sh.moveTo(poly[0][0] - cx, -(poly[0][1] - cz));
          for (let k = 1; k < poly.length; k++) sh.lineTo(poly[k][0] - cx, -(poly[k][1] - cz));
          sh.closePath();
          const g = new T.ExtrudeGeometry(sh, { depth: 1.3, bevelEnabled: false, curveSegments: 4 });
          g.rotateX(-PI / 2); g.translate(cx, groundY(hx, hz) - 0.3 + i * 1.3, cz);
          // split caps (group 0) and sides (group 1)
          for (const gr of g.groups) {
            const part = new T.BufferGeometry();
            for (const att of ['position', 'normal', 'uv']) {
              const src = g.attributes[att], sz = src.itemSize;
              part.setAttribute(att, new T.BufferAttribute(src.array.slice(gr.start * sz, (gr.start + gr.count) * sz), sz));
            }
            (gr.materialIndex === 0 ? capsGeo : sidesGeo).push(part);
          }
        }
        AO(hx, hz, R * 1.1, R * 1.0, 0.4, 0, groundY(hx, hz) + 0.05);
      }
      // side uvs: along the outline (x+z) / 6, across the layer
      for (const g of sidesGeo) { const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + p.getZ(i)) / 6, mod(p.getY(i), 1.3) / 1.3); }
      for (const g of capsGeo) { const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 12, p.getZ(i) / 12); }
      if (capsGeo.length) {
        K.add(new T.Mesh(K.BufferGeometryUtils.mergeGeometries(capsGeo, false), capM));
        K.add(new T.Mesh(K.BufferGeometryUtils.mergeGeometries(sidesGeo, false), edgeM));
      }
    }

    // ============================================================================
    // VILLAGES (mud-brick houses), PALMS, POTS, BOATS
    // ============================================================================
    const occupied = [];
    const free = (x, z, rad) => occupied.every((o) => Math.hypot(o[0] - x, o[1] - z) > o[2] + rad);
    {
      const rr = K.rng(1111);
      const bodies = [], roofs = [], doors = [], wins = [], domes = [];
      const VILL = [[62, 38, 22, 9, 9], [134, 34, 18, 8, 8], [-136, 2, 16, 18, 9], [-145, 86, 26, 4, 6], [20, 86, 22, 4, 4], [-30, -42, 22, 5, 4], [120, -30, 14, 10, 5]];
      for (const [vx, vz, rx, rz, n] of VILL) {
        let made = 0;
        for (let t = 0; t < 120 && made < n; t++) {
          const x = vx + rr.range(-rx, rx), z = vz + rr.range(-rz, rz);
          const w = rr.range(3.4, 6.2), d = rr.range(3.2, 5.2), h = rr.range(2.6, 4.4);
          const rad = Math.max(w, d) * 0.6;
          if (!inTray(x, z, rad + 2) || eAt(x, z) < 2.5 || hAt(x, z) < 1.0 || !clearView(x, z, h, rad) || !free(x, z, rad + 0.6)) continue;
          if (FLATS.some((f) => x > f.x0 - 6 && x < f.x1 + 6 && z > f.z0 - 6 && z < f.z1 + 6)) continue;
          occupied.push([x, z, rad]);
          const nr = track.distTo(x, z), tp = track.at(nr.s);
          const ry = Math.atan2(tp.z - z, tp.x - x); // face the river: local +z towards it
          const yaw = -ry + PI / 2;
          const y = groundY(x, z) - 0.3;
          const col = rr.pick([0x9c6b43, 0xa8794c, 0x8e5f3a, 0xb38a5c, 0xe6dac0, 0xc9a070]);
          bodies.push({ x, y, z, sx: w, sy: h, sz: d, ry: yaw, color: col });
          roofs.push({ x, y: y + h, z, sx: w + 0.3, sy: 0.35, sz: d + 0.3, ry: yaw, color: col });
          const fx = Math.sin(yaw), fz = Math.cos(yaw); // local +z in world
          const lx = Math.cos(yaw), lz = -Math.sin(yaw);
          const doorOff = rr.range(-w * 0.25, w * 0.25);
          doors.push({ x: x + fx * (d / 2 + 0.03) + lx * doorOff, y: y + 0.9, z: z + fz * (d / 2 + 0.03) + lz * doorOff, sx: 1.1, sy: 1.9, sz: 0.12, ry: yaw, color: rr.pick([0x2a5a9a, 0x2f8a7a, 0x3a2416, 0x4a8ac0, 0x2a1c12]) });
          for (const wx of [-1, 1]) if (rr() < 0.7) wins.push({ x: x + fx * (d / 2 + 0.03) + lx * (wx * w * 0.32), y: y + h * 0.66, z: z + fz * (d / 2 + 0.03) + lz * (wx * w * 0.32), sx: 0.7, sy: 0.7, sz: 0.12, ry: yaw, color: 0x2a1c12 });
          if (rr() < 0.35) domes.push({ x, y: y + h + 0.2, z, s: Math.min(w, d) * 0.42, color: col });
          AO(x, z, w * 0.75, d * 0.75, 0.42, yaw, y + 0.36);
          made++;
        }
      }
      const box = new T.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
      const mud = K.std({ color: 0xffffff, map: detail.map, roughness: 0.95 });
      K.instances(box, mud, bodies, { colors: true });
      K.instances(box, mud, roofs, { colors: true });
      K.instances(new T.BoxGeometry(1, 1, 1), K.std({ color: 0xffffff, roughness: 0.7 }), [...doors, ...wins], { colors: true, cast: false });
      if (domes.length) K.instances(new T.SphereGeometry(1, 14, 8, 0, TAU, 0, PI / 2), mud, domes, { colors: true });
    }
    // paper palm trees
    {
      const rr = K.rng(1212);
      const trunkTex = (() => { const c = TX.paint(64, 128, (x, y, u, v, o) => { const ring = (v * 18) % 1; const k = ring < 0.25 ? 0.72 : 1 - ring * 0.15; o[0] = 150 * k; o[1] = 104 * k; o[2] = 62 * k; }); return TX.toTexture(c); })();
      const frondTex = (() => {
        const c = TX.paint(256, 64, (x, y, u, v, o) => {
          const d = Math.abs(v - 0.5) * 2, taper = 0.25 + 0.75 * Math.sin(PI * Math.min(1, u * 1.15 + 0.02));
          const cut = ((u * 22 + d * 0.9) % 1) < 0.2 && d > 0.14;
          const inside = d < taper && !cut;
          const k = 0.82 + 0.18 * (1 - d) + (d < 0.06 ? -0.2 : 0);
          o[0] = 70 * k; o[1] = 140 * k; o[2] = 52 * k; o[3] = inside ? 255 : 0;
        });
        return TX.toTexture(c, { wrap: false });
      })();
      const trunkG = new T.CylinderGeometry(0.26, 0.42, 1, 7, 6); trunkG.translate(0, 0.5, 0);
      { const p = trunkG.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + 1.3 * y * y); } trunkG.computeVertexNormals(); }
      const frondG = (() => {
        const NSg = 10, pos = [], uv = [], idx = [];
        for (let i = 0; i <= NSg; i++) {
          const u = i / NSg, x = u, y = 0.32 * u - 0.6 * u * u;
          for (let j = 0; j <= 2; j++) { const v = j / 2, zz = (v - 0.5) * 0.42, yy = y - Math.abs(v - 0.5) * 0.12; pos.push(x, yy, zz); uv.push(u, v); }
        }
        for (let i = 0; i < NSg; i++) for (let j = 0; j < 2; j++) { const a = i * 3 + j, b = a + 1, c = a + 3, d = c + 1; idx.push(a, c, b, b, c, d); }
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
        g.setIndex(idx); g.computeVertexNormals(); return g;
      })();
      const trunks = [], fronds = [], nuts = [], ground = [];
      const tryPalm = (x, z, h) => {
        if (!inTray(x, z, 5) || eAt(x, z) < 2.2 || hAt(x, z) < 0.6 || !clearView(x, z, h + 2, 4.5) || !free(x, z, 3.2)) return false;
        if (FLATS.some((f) => x > f.x0 && x < f.x1 && z > f.z0 && z < f.z1)) return false;
        occupied.push([x, z, 2.2]);
        const ry = rr() * TAU, y = groundY(x, z) - 0.2;
        trunks.push({ x, y, z, sx: 1, sy: h, sz: 1, ry });
        const top = { x: x + Math.cos(ry) * 1.3, y: y + h, z: z - Math.sin(ry) * 1.3 };
        const nf = 8;
        for (let i = 0; i < nf; i++) fronds.push({ x: top.x, y: top.y, z: top.z, ry: (i / nf) * TAU + rr.range(-0.25, 0.25), rz: rr.range(-0.2, 0.35), s: rr.range(4.2, 5.6), color: rr.pick([0xffffff, 0xe8f0d8, 0xd8e8c0]) });
        for (let i = 0; i < 3; i++) nuts.push({ x: top.x + rr.range(-0.4, 0.4), y: top.y - 0.4, z: top.z + rr.range(-0.4, 0.4), s: 0.32 });
        if (rr() < 0.6) { const a = rr() * TAU; ground.push({ x: x + Math.cos(a) * 3, y: groundY(x + Math.cos(a) * 3, z + Math.sin(a) * 3) + 0.08, z: z + Math.sin(a) * 3, ry: rr() * 6, rz: -0.3, s: rr.range(3, 4.5), color: rr.pick([0xc8b070, 0xa8a050, 0xd0b878]) }); }
        AO(x, z, 2.2, 2.2, 0.35, 0, y + 0.25);
        return true;
      };
      let made = 0;
      const want = 60 * Q + 26;
      for (let t = 0; t < 900 && made < want; t++) {
        const s = rr() * L, side = rr() < 0.5 ? -1 : 1, p = track.at(s);
        const q = track.place(s, side * (p.w / 2 + 0.2 + openAt(s, side) + rr.range(4.5, 14)));
        if (tryPalm(q.x, q.z, rr.range(8, 12.5))) made++;
      }
      for (const [gx, gz] of [[70, 30], [140, 26], [-128, 10], [-60, 40], [-90, -40], [100, -30], [-30, 34]]) for (let i = 0; i < 4; i++) tryPalm(gx + rr.range(-10, 10), gz + rr.range(-6, 6), rr.range(8, 12));
      const trunkM = K.std({ map: trunkTex, roughness: 0.85 });
      K.instances(trunkG, trunkM, trunks);
      const frondM = K.std({ color: 0xffffff, map: frondTex, alphaTest: 0.5, side: T.DoubleSide, roughness: 0.75 });
      K.instances(frondG, frondM, fronds, { colors: true });
      K.instances(new T.SphereGeometry(1, 8, 6), SM(0x6a4a24, 0.6), nuts);
      if (ground.length) K.instances(frondG, frondM, ground, { colors: true, cast: false });
    }
    // clay pots and jars by the houses and on the quay; fishing boats pulled up on the banks and in the bay
    {
      const rr = K.rng(1313);
      const potG = K.lathe([[0, 0], [0.7, 0.05], [1.05, 0.6], [1.1, 1.2], [0.8, 1.8], [0.45, 2.05], [0.52, 2.3], [0.42, 2.32], [0.36, 2.1], [0, 2.1]], 14);
      const pots = [];
      for (let t = 0; t < 900 && pots.length < 46; t++) {
        const s = rr() * L, side = rr() < 0.5 ? -1 : 1, p = track.at(s);
        const q = track.place(s, side * (p.w / 2 + 0.2 + openAt(s, side) + rr.range(3.5, 7)));
        if (!inTray(q.x, q.z) || eAt(q.x, q.z) < 2.5 || hAt(q.x, q.z) < 0.8 || !K.offRoad(q.x, q.z, 3)) continue;
        const n = 1 + Math.floor(rr() * 3);
        for (let i = 0; i < n; i++) {
          const x = q.x + rr.range(-1.4, 1.4), z = q.z + rr.range(-1.4, 1.4), sc = rr.range(0.55, 0.95);
          pots.push({ x, y: groundY(x, z) - 0.05, z, s: sc, ry: rr() * 6, color: rr.pick([0xc0663a, 0xa8552e, 0xd08050, 0x8a4a2a]) });
          AO(x, z, sc * 1.4, sc * 1.4, 0.35, 0, groundY(x, z) + 0.05);
        }
      }
      K.instances(potG, K.std({ color: 0xffffff, roughness: 0.75 }), pots, { colors: true });
      const boatCols = [[0x2f7ab8, 0xf2ece0], [0x3a9a5a, 0xf0d860], [0xc84a2a, 0xf2ece0], [0xe8c040, 0x2f6fb0]];
      const boatG = boatCols.map(([a, b]) => hullGeo(4.6, 1.7, 0.95, 0.35, (cc, h) => cc.setHex(h > 0.8 ? a : h > 0.3 ? b : 0x6a3a22)));
      const placeBoat = (x, z, y, ry, k, tilt = 0) => {
        const g = new T.Group(); g.add(new T.Mesh(boatG[k % 4], hullMat));
        const seat = new T.Mesh(new T.BoxGeometry(0.35, 0.1, 1.3), woodLight); seat.position.set(0.2, 0.3, 0); g.add(seat);
        for (const sz of [-0.55, 0.55]) { const oar = new T.Mesh(new T.BoxGeometry(3.6, 0.08, 0.25), woodLight); oar.position.set(-0.2, 0.42, sz * 0.6); oar.rotation.y = sz * 0.15; g.add(oar); }
        const m = mergeGroup(g); m.position.set(x, y, z); m.rotation.set(tilt, ry, 0, 'YXZ'); K.add(m);
        AO(x, z, 2.6, 1.2, 0.3, -ry, Math.max(0, y) + 0.05);
      };
      let k = 0;
      for (const [s, side, inWater] of [[218, -1, 1], [236, -1, 1], [40, 1, 0], [100, -1, 0], [150, 1, 0], [740, -1, 0], [870, 1, 0], [300, -1, 0]]) {
        const p = track.at(s), op = openAt(s, side, true);
        const q = track.place(s, side * (p.w / 2 + 0.2 + (inWater ? op * 0.6 : 3.2)));
        if (!K.offRoad(q.x, q.z, 1.6)) continue;
        placeBoat(q.x, q.z, inWater ? 0.05 : groundY(q.x, q.z) * 0.6 - 0.1, -p.angle + side * 0.4 + (inWater ? PI / 2 : 0), k++, inWater ? 0 : 0.1);
      }
      // the harbour jetty out into the bay, two feluccas moored at it with furled sails
      const hb = OPEN[0], hp = track.at(hb.s);
      const j0 = track.place(hb.s, -(hp.w / 2 + 0.2 + hb.depth + 1.5)), j1 = track.place(hb.s, -(hp.w / 2 + 3.2));
      const jl = Math.hypot(j1.x - j0.x, j1.z - j0.z), ja = Math.atan2(j1.z - j0.z, j1.x - j0.x);
      const planks = [], posts = [];
      for (let d = 0; d < jl; d += 0.75) planks.push({ x: j0.x + Math.cos(ja) * d, y: 1.1, z: j0.z + Math.sin(ja) * d, ry: -ja, sx: 0.65, sy: 0.18, sz: 3.2, color: rr.pick([0xb98a55, 0xa87a48, 0xc89a62]) });
      for (let d = 0; d < jl; d += 3) for (const sd of [-1.5, 1.5]) posts.push({ x: j0.x + Math.cos(ja) * d - Math.sin(ja) * sd, y: -1, z: j0.z + Math.sin(ja) * d + Math.cos(ja) * sd, sy: 2.3 });
      K.instances(new T.BoxGeometry(1, 1, 1), K.std({ color: 0xffffff, roughness: 0.75 }), planks, { colors: true });
      K.instances(new T.CylinderGeometry(0.22, 0.22, 1, 6).translate(0, 0.5, 0), woodMat, posts);
      for (const sd of [-1, 1]) {
        const f = makeFelucca(true), d = jl * 0.45;
        f.root.position.set(j0.x + Math.cos(ja) * d - Math.sin(ja) * sd * 3.6, 0.1, j0.z + Math.sin(ja) * d + Math.cos(ja) * sd * 3.6);
        f.root.rotation.y = -ja + (sd > 0 ? 0 : PI);
        K.add(f.root); keep.push(f.root); A.moored = A.moored || []; A.moored.push(f.root);
      }
    }

    // ============================================================================
    // MOVING: feluccas tacking across the wide water, crocodiles, the hippo
    // ============================================================================
    for (const fd of FELS) {
      const f = makeFelucca(false);
      K.add(f.root); keep.push(f.root);
      const o = { ...fd, root: f.root, rig: f.rig };
      A.fels.push(o);
      K.mover({ type: 'box', hw: FEL.hw, hd: FEL.hd, h: 3.2 }, (t) => { const q = felAt(o, t); return { x: q.x, z: q.z, angle: q.angle }; });
    }
    {
      const skin = K.phys({ color: 0x4f6b2c, roughness: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.4 });
      const belly = PL(0xb8b06a, 0.5), eyeY = PL(0xe8c020, 0.3), blk = PL(0x111111, 0.2), wht = PL(0xf4f0e0, 0.4), pink = PL(0xd86a6a, 0.6);
      for (const cd of CROCS) {
        const p = track.at(cd.s), hw = p.w / 2;
        const nx = p.nx * cd.side, nz = p.nz * cd.side;
        const c = { ...cd, x0: p.x, z0: p.z, nx, nz, hw, angle: Math.atan2(-nz, -nx) };
        // the toy: local +x = snout (towards the road), origin at the back of the head
        const root = new T.Group(), body = new T.Group(), jaw = new T.Group();
        const add = (g, geo, m, x, y, z, sx = 1, sy = 1, sz = 1, rz = 0) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.rotation.z = rz; g.add(o); return o; };
        const sph = new T.SphereGeometry(1, 16, 10);
        add(body, new K.RoundedBoxGeometry(2.6, 0.5, 1.15, 2, 0.2), skin, 1.2, -0.05, 0);
        add(body, sph, skin, -0.1, 0.15, 0, 0.8, 0.5, 0.75);
        for (const sz of [-0.42, 0.42]) { add(body, sph, skin, -0.1, 0.5, sz, 0.34, 0.3, 0.34); add(body, sph, eyeY, -0.02, 0.6, sz, 0.22, 0.2, 0.22); add(body, sph, blk, 0.12, 0.62, sz, 0.06, 0.16, 0.08); }
        add(body, sph, skin, -3.0, 0.0, 0, 2.6, 0.62, 1.05);
        add(body, sph, belly, -3.0, -0.28, 0, 2.4, 0.4, 0.95);
        add(body, new T.ConeGeometry(0.75, 4.6, 8), skin, -7.6, -0.05, 0, 1, 1, 0.6, PI / 2);
        for (let i = 0; i < 9; i++) add(body, new T.ConeGeometry(0.16, 0.38, 4), skin, -1.4 - i * 0.75, 0.55 - Math.max(0, i - 4) * 0.08, 0);
        for (const [lx, lz] of [[-1.6, 1], [-1.6, -1], [-4.2, 1], [-4.2, -1]]) add(body, new K.RoundedBoxGeometry(0.6, 0.35, 1.0, 1, 0.12), skin, lx, -0.25, lz * 1.05);
        // upper jaw on a hinge at the back of the head
        add(jaw, new K.RoundedBoxGeometry(2.6, 0.42, 1.05, 2, 0.18), skin, 1.25, 0.18, 0);
        add(jaw, new T.BoxGeometry(2.3, 0.08, 0.9), pink, 1.2, -0.02, 0);
        for (let i = 0; i < 6; i++) for (const sz of [-0.42, 0.42]) add(jaw, new T.ConeGeometry(0.07, 0.2, 4), wht, 0.5 + i * 0.36, -0.12, sz, 1, 1, 1, PI);
        for (const sz of [-0.18, 0.18]) add(jaw, sph, skin, 2.35, 0.42, sz, 0.12, 0.1, 0.12);
        const bodyM = mergeGroup(body), jawM = mergeGroup(jaw);
        const jawPivot = new T.Group(); jawPivot.position.set(-0.1, 0.15, 0); jawM.position.set(0.1, -0.15, 0); jawPivot.add(jawM);
        root.add(bodyM, jawPivot);
        K.add(root); keep.push(root);
        c.root = root; c.jaw = jawPivot;
        A.crocs.push(c);
        K.mover({ type: 'capsule', r: CROC.r, h: 0 }, (t) => {
          const q = crocAt(c, t);
          const lat = hw + 1.4 - q.k * CROC.reach, hx = c.x0 + nx * lat, hz = c.z0 + nz * lat;
          return { x1: hx - nx * 0.6, z1: hz - nz * 0.6, x2: hx + nx * CROC.len, z2: hz + nz * CROC.len, h: q.k > 0.12 ? 2.6 : 0 };
        });
        // a little warning marker on the bank: a croc-shaped sign on a stick
        const sgp = track.place(cd.s - 7, cd.side * (hw + 5.5)), sy = groundY(sgp.x, sgp.z);
        K.mesh(new T.CylinderGeometry(0.12, 0.12, 4, 6), woodLight, sgp.x, sy + 2, sgp.z);
        const sc = TX.makeCanvas(128, 128), sg = sc.getContext('2d');
        sg.fillStyle = '#f2d23a'; sg.beginPath(); sg.moveTo(64, 6); sg.lineTo(122, 64); sg.lineTo(64, 122); sg.lineTo(6, 64); sg.closePath(); sg.fill();
        sg.lineWidth = 6; sg.strokeStyle = '#1a1a1a'; sg.stroke();
        sg.fillStyle = '#1a1a1a'; sg.beginPath(); sg.ellipse(64, 70, 34, 9, 0, 0, TAU); sg.fill(); sg.beginPath(); sg.moveTo(92, 66); sg.lineTo(112, 60); sg.lineTo(110, 70); sg.fill();
        sg.beginPath(); sg.arc(82, 58, 5, 0, TAU); sg.fill(); for (let i = 0; i < 4; i++) sg.fillRect(44 + i * 12, 76, 4, 10);
        const sign = new T.Mesh(new T.PlaneGeometry(2.6, 2.6), K.std({ map: TX.toTexture(sc, { wrap: false }), transparent: true, alphaTest: 0.3, side: T.DoubleSide, roughness: 0.6 }));
        sign.position.set(sgp.x, sy + 4.2, sgp.z); sign.rotation.set(-0.75, 0.25, 0, 'YXZ'); K.add(sign);
      }
    }
    {
      // the hippo in its side pool
      const hp = track.at(HIPPO.s), side = 1, lat = hp.w / 2 + 0.2 + OPEN[1].depth * 0.55;
      const q = track.place(HIPPO.s, side * lat);
      const g = new T.Group(), jawG = new T.Group();
      const hm = K.phys({ color: 0x8a7684, roughness: 0.45, clearcoat: 0.35 }), pk = PL(0xe08a96, 0.5), wh = PL(0xf6f2e6, 0.4), bk = PL(0x111111, 0.2);
      const sph = new T.SphereGeometry(1, 18, 12);
      const add = (gg, geo, m, x, y, z, sx, sy, sz) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); gg.add(o); return o; };
      add(g, sph, hm, -3.2, -0.4, 0, 4.2, 2.0, 2.6);
      add(g, sph, hm, 0.6, 0.4, 0, 1.8, 1.4, 1.6);
      add(g, new K.RoundedBoxGeometry(2.6, 1.0, 2.4, 2, 0.45), hm, 2.0, 0.55, 0, 1, 1, 1);
      for (const sz of [-0.75, 0.75]) { add(g, sph, hm, 0.2, 1.75, sz, 0.32, 0.32, 0.32); add(g, sph, wh, 0.5, 1.68, sz, 0.2, 0.2, 0.2); add(g, sph, bk, 0.66, 1.68, sz, 0.09, 0.12, 0.1); add(g, sph, hm, -0.4, 1.95, sz * 1.15, 0.22, 0.32, 0.14); add(g, sph, bk, 3.2, 1.1, sz * 0.5, 0.1, 0.08, 0.14); }
      add(jawG, new K.RoundedBoxGeometry(2.6, 0.7, 2.3, 2, 0.3), hm, 1.3, -0.35, 0, 1, 1, 1);
      add(jawG, new T.BoxGeometry(2.2, 0.1, 1.9), pk, 1.3, 0.02, 0, 1, 1, 1);
      for (const sz of [-0.85, 0.85]) add(jawG, new T.ConeGeometry(0.18, 0.7, 6), wh, 2.3, 0.35, sz, 1, 1, 1);
      const body = mergeGroup(g), jaw = mergeGroup(jawG);
      const root = new T.Group(), pivot = new T.Group(); pivot.position.set(0.7, 0.1, 0); jaw.position.set(-0.7, -0.1, 0); pivot.add(jaw);
      root.add(body, pivot);
      root.position.set(q.x, -3, q.z); root.rotation.y = -(hp.angle + PI * 0.75);
      K.add(root); keep.push(root);
      A.hippo = { root, jaw: pivot, x: q.x, z: q.z };
    }
    // floating water jars to bump around
    {
      const jm = K.std({ color: 0xc0663a, roughness: 0.7 });
      const jg = K.lathe([[0, 0], [0.8, 0.1], [1.15, 0.7], [1.1, 1.3], [0.6, 1.8], [0.5, 2.1], [0.6, 2.2], [0, 2.2]], 16);
      for (const [s, lat] of [[40, 4], [262, -6], [700, 5], [880, -5]]) {
        const p = track.place(s, lat);
        const mesh = new T.Mesh(jg, jm); K.add(mesh); mesh.position.set(p.x, -0.6, p.z);
        const d = K.physics.addDynamic({ x: p.x, z: p.z, r: 1.2, m: 0.7, h: 2.5, mesh, friction: 4.5, baseY: -0.6, slide: true, spin: 0.05 });
        d.respawn = 5;
        A.jars.push({ d, mesh, ph: r() * 6 }); keep.push(mesh);
      }
    }

    // ============================================================================
    // THE TRAY, THE CLASSROOM TABLE, PENCILS, GLUE, A RULER, THE LABEL CARD
    // ============================================================================
    {
      const ply = TX.woodTextures({ size: 512, seed: 41, planks: 1, base: 0xd2b080, dark: 0xa8834e, light: 0xe8cc9c, ringFreq: 30, gap: 0, roughBase: 0.6 });
      const plyM = K.std({ map: ply.map, normalMap: ply.normalMap, roughness: 0.7 });
      const wx = (TRAY.x1 - TRAY.x0) / 2 + RIM_W / 2, cx = (TRAY.x0 + TRAY.x1) / 2, cz = (TRAY.z0 + TRAY.z1) / 2, wz = (TRAY.z1 - TRAY.z0) / 2 + RIM_W / 2;
      const hgt = RIM_Y - TABLE_Y;
      K.mesh(new T.BoxGeometry(2 * wx + RIM_W, hgt, RIM_W), plyM, cx, TABLE_Y + hgt / 2, cz - wz, { cast: false });
      K.mesh(new T.BoxGeometry(2 * wx + RIM_W, hgt, RIM_W), plyM, cx, TABLE_Y + hgt / 2, cz + wz, { cast: false });
      K.mesh(new T.BoxGeometry(RIM_W, hgt, 2 * wz - RIM_W), plyM, cx - wx, TABLE_Y + hgt / 2, cz, { cast: false });
      K.mesh(new T.BoxGeometry(RIM_W, hgt, 2 * wz - RIM_W), plyM, cx + wx, TABLE_Y + hgt / 2, cz, { cast: false });
      // classroom table (light laminate) and the floor far below
      const lam = TX.woodTextures({ size: 1024, seed: 43, planks: 1, base: 0xd8c4a0, dark: 0xb8a07a, light: 0xeadcc0, ringFreq: 14, gap: 0, roughBase: 0.45 });
      for (const t of Object.values(lam)) t.repeat.set(4, 3);
      K.mesh(new T.BoxGeometry(620, 4, 400), K.std({ map: lam.map, normalMap: lam.normalMap, roughnessMap: lam.roughnessMap, normalScale: V2(0.4) }), 0, TABLE_Y - 2, cz, { cast: false });
      K.mesh(new T.BoxGeometry(620, 3, 400), SM(0x6a6a70, 0.5), 0, TABLE_Y - 5.5, cz, { cast: false });
      const fl = TX.paint(256, 256, (x, y, u, v, o) => { const t = ((Math.floor(u * 4) + Math.floor(v * 4)) % 2) ? 0.9 : 1; o[0] = 160 * t; o[1] = 168 * t; o[2] = 150 * t; });
      K.mesh(new T.PlaneGeometry(2400, 2400), K.std({ map: TX.toTexture(fl, { repeat: [40, 40] }), roughness: 0.6 }), 0, -80, 0, { rx: -PI / 2, cast: false });
      AO(cx, cz, wx + 6, wz + 6, 0.5, 0, TABLE_Y + 0.05);
      // coloured pencils
      const pencil = (x, z, ry, col, len = 17) => {
        const g = new T.Group();
        const b = new T.Mesh(new T.CylinderGeometry(0.45, 0.45, len, 6), PL(col, 0.4)); b.rotation.z = PI / 2; g.add(b);
        const cone = new T.Mesh(new T.CylinderGeometry(0.45, 0.12, 2.2, 6), SM(0xe0c090, 0.8)); cone.rotation.z = -PI / 2; cone.position.x = len / 2 + 1.1; g.add(cone);
        const tip = new T.Mesh(new T.ConeGeometry(0.12, 0.5, 6), PL(col, 0.4)); tip.rotation.z = -PI / 2; tip.position.x = len / 2 + 2.45; g.add(tip);
        const m = mergeGroup(g); m.position.set(x, TABLE_Y + 0.45, z); m.rotation.y = ry; K.add(m);
        AO(x, z, len / 2 + 1, 0.9, 0.35, -ry, TABLE_Y + 0.03);
      };
      pencil(232, -30, 0.3, 0x2f6fd0); pencil(236, -22, 0.12, 0xe0402c); pencil(230, 30, -1.2, 0x2fae5a); pencil(-236, 40, 1.4, 0xf2c230); pencil(-230, -48, 0.5, 0x8a4fd8); pencil(-240, -36, 0.2, 0xff8a1e);
      // glue stick, eraser, wooden ruler (east end)
      const lt = TX.makeCanvas(256, 128), lg2 = lt.getContext('2d');
      lg2.fillStyle = '#f4f0e6'; lg2.fillRect(0, 0, 256, 128); lg2.fillStyle = '#7a3ac8'; lg2.fillRect(0, 30, 256, 68);
      lg2.fillStyle = '#ffffff'; lg2.font = '44px "Lilita One", Impact, sans-serif'; lg2.textAlign = 'center'; lg2.fillText('GLUE STICK', 128, 80);
      const gs = new T.Group();
      const gb = new T.Mesh(new T.CylinderGeometry(1.8, 1.8, 9, 24), K.std({ map: TX.toTexture(lt, { wrap: true }), roughness: 0.5 })); gb.position.y = 4.5; gs.add(gb);
      const gc = new T.Mesh(new T.CylinderGeometry(1.9, 1.9, 3.2, 24), PL(0x7a3ac8, 0.35)); gc.position.y = 10.4; gs.add(gc);
      gs.rotation.z = PI / 2; gs.position.set(244, TABLE_Y + 1.8, 8); gs.rotation.y = 0.5; K.add(gs);
      AO(240, 8, 7, 2.4, 0.4, 0.5, TABLE_Y + 0.03);
      K.mesh(new K.RoundedBoxGeometry(5, 1.6, 2.6, 2, 0.3), PL(0xf08aa0, 0.7), 228, TABLE_Y + 0.8, 60, { ry: 0.6 });
      const rc = TX.makeCanvas(1024, 64), rg = rc.getContext('2d');
      rg.fillStyle = '#e2c48a'; rg.fillRect(0, 0, 1024, 64); rg.fillStyle = '#3a2a1a'; rg.font = '20px Rubik, sans-serif'; rg.textAlign = 'center';
      for (let i = 0; i <= 300; i++) { const x = 12 + i * 3.333; rg.fillRect(x, 0, 1.4, i % 10 === 0 ? 22 : i % 5 === 0 ? 15 : 9); if (i % 10 === 0) rg.fillText(String(i / 10), x, 42); }
      K.mesh(new T.BoxGeometry(31, 0.4, 3.2), [woodLight, woodLight, K.std({ map: TX.toTexture(rc, { wrap: false }), roughness: 0.6 }), woodLight, woodLight, woodLight], 236, TABLE_Y + 0.2, -60, { ry: PI / 2 - 0.1 });
      AO(236, -60, 2, 16, 0.3, 0.1, TABLE_Y + 0.03);
      // the label card at the west end: a folded tent card facing the class
      const cc = TX.makeCanvas(512, 256), cg = cc.getContext('2d');
      cg.fillStyle = '#fbf6e8'; cg.fillRect(0, 0, 512, 256);
      cg.strokeStyle = '#c9a227'; cg.lineWidth = 10; cg.strokeRect(10, 10, 492, 236);
      cg.fillStyle = '#244e8c'; cg.font = '58px "Lilita One", Impact, sans-serif'; cg.textAlign = 'center'; cg.fillText('THE RIVER NILE', 256, 92);
      cg.fillStyle = '#8a3a20'; cg.font = '34px Rubik, sans-serif'; cg.fillText('at Aswan  -  Class 4B project', 256, 146);
      cg.fillStyle = '#3a2a1a'; cg.font = '24px Rubik, sans-serif'; cg.fillText('the first cataract, the temple, feluccas', 256, 196);
      const rr = K.rng(1414);
      for (let i = 0; i < 6; i++) glyph(cg, 40 + i * 86, 228, 22, Math.floor(rr() * 11), '#c9a227');
      const card = new T.Group();
      const face = new T.Mesh(new T.PlaneGeometry(36, 18), K.std({ map: TX.toTexture(cc, { wrap: false }), roughness: 0.8 }));
      face.position.set(0, 8.2, 4.3); face.rotation.x = -0.5; card.add(face);
      const back = new T.Mesh(new T.PlaneGeometry(36, 18), SM(0xf2ead6, 0.85)); back.position.set(0, 8.2, -4.3); back.rotation.x = 0.5 + PI; card.add(back);
      card.position.set(-238, TABLE_Y, 4); card.rotation.y = PI / 2 + 0.25; K.add(card);
      AO(-238, 4, 6, 19, 0.35, -(PI / 2 + 0.25), TABLE_Y + 0.03);
    }

    // ---------------- contact shadows: one instanced draw ----------------
    {
      const g = new T.PlaneGeometry(1, 1); g.rotateX(-PI / 2);
      const mat = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, alphaMap: TX.blobShadowTexture(), depthWrite: false });
      mat.onBeforeCompile = (sh) => {
        sh.vertexShader = 'varying float vOp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\nvOp = length(instanceMatrix[1].xyz);\n#endif');
        sh.fragmentShader = 'varying float vOp;\n' + sh.fragmentShader.replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\ndiffuseColor.a *= vOp;');
      };
      mat.customProgramCacheKey = () => 'nile-ao';
      const im = K.instances(g, mat, contacts.filter((c) => c.sx > 0.1), { cast: false, receive: false });
      im.renderOrder = 1;
    }

    // ---------------- merge static meshes per material (fewer draw calls) ----------------
    {
      const BU = K.BufferGeometryUtils;
      K.group.updateMatrixWorld(true);
      const isKept = (o) => { for (let p = o; p; p = p.parent) if (keep.includes(p)) return true; return false; };
      const buckets = new Map();
      K.group.traverse((o) => {
        if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || isKept(o)) return;
        if (o.material.transparent || o.renderOrder) return;
        if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
        const c = o.geometry.boundingSphere.center.clone().applyMatrix4(o.matrixWorld);
        if (o.geometry.boundingSphere.radius * o.matrixWorld.getMaxScaleOnAxis() > 70) return;
        const cell = Math.floor((c.x + 300) / 100) + ':' + Math.floor((c.z + 300) / 100);
        const key = o.material.uuid + cell + (o.castShadow ? 'c' : '') + (o.receiveShadow ? 'r' : '');
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(o);
      });
      for (const list of buckets.values()) {
        if (list.length < 2) continue;
        const geos = [];
        for (const o of list) {
          const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
          g.applyMatrix4(o.matrixWorld);
          for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
          if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
          if (!g.attributes.normal) g.computeVertexNormals();
          geos.push(g);
        }
        const hasCol = geos.some((g) => g.attributes.color);
        if (hasCol !== geos.every((g) => g.attributes.color)) continue;
        const merged = BU.mergeGeometries(geos, false);
        if (!merged) continue;
        const m = new T.Mesh(merged, list[0].material);
        m.castShadow = list[0].castShadow; m.receiveShadow = list[0].receiveShadow;
        for (const o of list) o.parent.remove(o);
        K.group.add(m);
      }
    }
  },

  // fixed rate: the croc clock, the river currents, CPU drivers through the rapids and round the crocodiles
  tick(dt, time, game) {
    if (!A || !A.CUR) return;
    // a countdown starts the crocodile clock again
    const newCount = game.state === 'countdown' && (A.prevState !== 'countdown' || game.countT > (A.prevCountT ?? 0) + 0.01);
    if (newCount) A.t0 = time + Math.max(0, game.countT);
    A.prevState = game.state; A.prevCountT = game.countT;
    if (game.state === 'countdown') return; // held on the grid: the water doesn't carry anyone back
    const tr = game.track, Lr = tr.length;
    for (const e of game.cars) {
      const c = e.car;
      if (e.out || c.state !== 'drive' || c.airborne) continue;
      const i = tr.idx(e.trackS), v = A.CUR[i], cw = A.CATW[i];
      // the river carries the boat (its own velocity is relative to the water)
      let fx = 0, fz = 0;
      if (v) { const k = 1 - 0.35 * Math.min(1, (e.lateral / (tr.w[i] / 2)) ** 2); fx = tr.tx[i] * v * k; fz = tr.tz[i] * v * k; }
      if (cw > 0) {
        const wl = cw * CAT.wander * Math.sin(e.trackS * 0.11 + time * 1.3); fx += -tr.tz[i] * wl; fz += tr.tx[i] * wl;
        // the water splits round the boulders: it never pins a boat against one, it carries it round the side
        for (const rk of A.rocks) {
          const dx = c.x - rk.x, dz = c.z - rk.z, d = Math.hypot(dx, dz), w = 1 - (d - rk.r) / 4.5;
          if (w <= 0 || d < 0.01) continue;
          const nx = dx / d, nz = dz / d, vn = fx * nx + fz * nz, wk = Math.min(1, w);
          if (vn < 0) { fx -= nx * vn * wk * 1.15; fz -= nz * vn * wk * 1.15; }
          const sd = (-tr.tz[i] * dx + tr.tx[i] * dz) >= 0 ? 1 : -1;
          fx += -tr.tz[i] * sd * 5 * wk; fz += tr.tx[i] * sd * 5 * wk;
        }
      }
      c.x += fx * dt; c.z += fz * dt;
      if (!e.ai) continue;
      // CPU drivers: a line through the rocks of the cataract
      const look = 6 + Math.max(0, c.fwdSpeed) * 0.28, sl = e.trackS + look;
      const dc = mod(sl - CAT.s0, Lr);
      let want = null;
      if (dc < CAT.len) want = catLine(c.index % 2, dc);
      // ...and away from a crocodile that is surfacing or lunging on their side
      for (const cr of A.crocs) {
        const q = crocAt(cr, time);
        if (q.u > CROC.rise + CROC.out + CROC.hold + 0.2) continue;
        const d = mod(cr.s - e.trackS, Lr);
        if (d > 45 && d < Lr - 6) continue;
        want = -cr.side * 2.5;
      }
      if (want !== null) {
        const shift = want - e.ai.lineOffset(sl);
        e.ai.avoid += (shift - e.ai.avoid) * Math.min(1, dt * 10);
      }
    }
  },

  animate(time, dt, game) {
    if (!A) return;
    A.uTime.value = time;
    const live = game && (game.state === 'race' || game.state === 'countdown' || game.state === 'roundEnd' || game.state === 'attract');
    const P = game && game.particles && dt > 0 && dt < 0.2 ? game.particles : null;
    // feluccas
    for (const f of A.fels) {
      const q = felAt(f, time);
      f.root.position.set(q.x, 0.15 + Math.sin(time * 1.7 + f.ph) * 0.06, q.z);
      f.root.rotation.set(q.heel * 0.13 + Math.sin(time * 1.3 + f.ph) * 0.03, -q.angle, 0, 'YXZ');
      f.rig.rotation.y = -q.sail * 0.38;
      f.rig.scale.z = q.sail >= 0 ? Math.max(0.15, q.sail) : Math.min(-0.15, q.sail);
    }
    if (A.moored) A.moored.forEach((m, i) => { m.position.y = 0.1 + Math.sin(time * 1.4 + i * 2) * 0.05; m.rotation.x = Math.sin(time * 1.1 + i) * 0.03; });
    // crocodiles
    for (const c of A.crocs) {
      const q = crocAt(c, time);
      const lat = c.hw + 1.4 - q.k * CROC.reach;
      c.root.position.set(c.x0 + c.nx * lat, q.y, c.z0 + c.nz * lat);
      c.root.rotation.set(0, -c.angle, q.k > 0 ? -0.05 * q.k : 0);
      c.jaw.rotation.z = q.jaw * 0.55;
      if (P && live && game.onScreen(c.root.position.x, 0, c.root.position.z, 0.15)) {
        const hx = c.root.position.x - c.nx * 1.5, hz = c.root.position.z - c.nz * 1.5;
        if (q.u < CROC.rise && Math.random() < dt * 14) P.emit(hx + (Math.random() - 0.5) * 2, 0.1, hz + (Math.random() - 0.5) * 2, { color: 0xffffff, size: 0.45, life: 0.5, spread: 0.6, up: 1.2, grav: 0, grow: 1.6, alpha: 0.75 });
        if (q.k > 0.05 && q.k < 0.95 && q.u < CROC.rise + CROC.out && Math.random() < dt * 60) P.emit(hx, 0.3, hz, { color: 0xf4fcf8, size: 0.9, life: 0.5, spread: 6, up: 7, grav: 30, grow: 1.3, alpha: 0.85 });
      }
    }
    // the hippo: bubbles, up, a big yawn, down again
    if (A.hippo) {
      const H = A.hippo, u = mod(time + HIPPO.ph, HIPPO.P);
      const up = ss(1.6, 2.6, u) * (1 - ss(6.2, 7.4, u));
      H.root.position.y = lerp(-3.4, -0.9, up) + Math.sin(time * 1.8) * 0.08 * up;
      H.jaw.rotation.z = -ss(3.2, 3.9, u) * (1 - ss(4.8, 5.4, u)) * 0.75;
      if (P && live && u < 1.8 && Math.random() < dt * 18 && game.onScreen(H.x, 0, H.z, 0.1)) P.emit(H.x + (Math.random() - 0.5) * 4, 0.1, H.z + (Math.random() - 0.5) * 3, { color: 0xffffff, size: 0.5, life: 0.55, spread: 0.5, up: 1.5, grav: 0, grow: 1.5, alpha: 0.7 });
    }
    // floating jars bob
    for (const j of A.jars) if (j.d.state === 'live') { j.mesh.position.y += Math.sin(time * 2 + j.ph) * 0.12; j.mesh.rotation.x = Math.sin(time * 1.6 + j.ph) * 0.08; }
    // spray off the rocks in the rapids
    if (P && live) {
      for (const rk of A.rocks) {
        if (Math.random() > dt * 12 || !game.onScreen(rk.x, 0, rk.z, 0.1)) continue;
        const a = Math.random() * TAU;
        P.emit(rk.x + Math.cos(a) * rk.r, 0.3, rk.z + Math.sin(a) * rk.r, { color: 0xffffff, size: 0.8, life: 0.55, spread: 4, up: 5, grav: 22, grow: 1.5, alpha: 0.8 });
      }
    }
  },
};

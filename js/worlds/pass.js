// World: Switchback Pass (Drift Cup, table 2 of 4). A model-maker's 1:100 diorama of an alpine pass road, still on
// the hobby workbench between paint tins, brushes and a box of spare pines. From the Gasthof Kehre and its viewpoint
// car park the road runs west along the rim of a deep gorge, climbs three linked hairpins (Kehre 1-3) between stone
// retaining walls, sweeps up under the snowy peaks through an arched avalanche gallery (ice in its shade), snakes
// through a run of fast S-bends under the chairlift, sweeps round past the alpine lake and drops back along the
// gorge, past a gap in the guard rail and over the old stone bridge. Raced on drift coupes.
import * as THREE from '../../vendor/three.bundle.js';

const TRACK = [
  [-35, 66], [-122, 68.8, 17], [-135.6, 58.5, 17], [-136.4, 42.9, 17], [-123.9, 31.3, 17], [-62.1, 34.7, 17],
  [-49.8, 23.5, 17], [-49.8, 8.5, 17], [-62.1, -2.7, 17], [-123.9, 0.7, 17], [-136.2, -10.5, 17], [-136.2, -25.5, 17],
  [-123.9, -36.7, 17], [-80, -46], [-40, -62], [0, -64], [38, -70], [76, -59], [114, -67], [150, -46], [155, -8],
  [147, 32], [122, 61], [84, 72], [45, 64], [5, 68],
];
const W = 16.5;
const BOUNDS = { minX: -174, maxX: 178, minZ: -114, maxZ: 112 };
const BASE = 16; // thickness of the diorama board: the workbench top is at -BASE (and so is the gorge floor)
// the gorge: centreline from beyond the east board edge to beyond the west edge, rim half-width
const GORGE = [[192, 92], [150, 93], [118, 93], [96, 92.2], [72, 92.6], [46, 93], [16, 95], [-14, 96], [-48, 93], [-86, 91], [-118, 91], [-143, 84], [-158, 70], [-165, 54], [-184, 42]];
const GHW = 8.5;
// the stream from the lake, under the old bridge, over the gorge rim as a waterfall
const STREAM = [[80, 16], [70, 28], [59, 42], [50, 55], [46, 64], [45, 74], [44.6, 86]];
const SHW = 2.2;
const LAKE = { x: 96, z: 6, rx: 22, rz: 12.5, a: -0.22 };
// chairlift: valley station by the inn, top station on the shoulder of the peak
const LIFT = { x0: 16, z0: 37, x1: 46, z1: -100 };
const PI = Math.PI, TAU = PI * 2;
let A = null; // runtime state shared by build / animate

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export default {
  id: 'pass',
  name: 'Switchback Pass',
  blurb: 'Three linked hairpins, a gorge with a gap in the rail, S-bends under the snow.',
  vehicle: 'drifter',
  seed: 21,
  track: { points: TRACK, width: W, startS: 905 },
  bounds: BOUNDS,
  fallOffEdges: true,
  floorY: -BASE + 0.08, // off the board (or into the gorge) you land on the workbench
  offCourse: 16,
  offroad: { kind: 'slow', margin: 1.5 },
  skidColor: 0x161618,
  dust: {
    normal: null,
    slow: { color: 0xb8ad98, size: 0.9, life: 0.55, up: 3, grav: 14, alpha: 0.65, grow: 1.6, rate: 1.4 },
    slick: { color: 0xeef6ff, size: 0.6, life: 0.4, up: 2.5, grav: 20, alpha: 0.85, grow: 1.2, rate: 1.6 },
    water: { color: 0xe8f4f8, size: 0.9, life: 0.5, up: 6, grav: 28, alpha: 0.8, grow: 1.5, rate: 2.6 },
  },
  lighting: {
    sunDir: [0.72, 0.66, 0.44], sunColor: 0xfff3e2, sunIntensity: 2.95,
    hemiSky: 0xc2d6ff, hemiGround: 0x4a4840, hemiIntensity: 0.6,
    envIntensity: 0.42, exposure: 1.0, background: 0x1a1d22, shadowRadius: 2.0,
  },

  async build(K) {
    const { THREE: T, TX, r, track } = K;
    const L = track.length;
    const V2 = (a, b = a) => new T.Vector2(a, b);
    const BU = K.BufferGeometryUtils;
    const lowQ = K.quality && K.quality.tilt === false;
    A = { L, fade: 0, lastT: null };
    const keep = []; // meshes that must not be merged (animated, transparent, already batched)
    const sAt = (x, z) => track.distTo(x, z).s;
    const sDist = (a, b) => { const d = (((b - a) % L) + L) % L; return d > L / 2 ? d - L : d; }; // signed a -> b
    const inS = (s, a, b) => { const d = (((s - a) % L) + L) % L; return d <= (((b - a) % L) + L) % L; };
    const wAt = (s) => track.w[track.idx(s)];

    // ---------------------------------------------------------------- noise
    const NF = TX.noiseField(256, { seed: 21, period: 8, oct: 4 });
    const NF2 = TX.noiseField(256, { seed: 47, period: 16, oct: 3 });
    const bil = (f, x, y) => {
      x = ((x % 256) + 256) % 256; y = ((y % 256) + 256) % 256;
      const x0 = x | 0, y0 = y | 0, x1 = (x0 + 1) & 255, y1 = (y0 + 1) & 255, fx = x - x0, fy = y - y0;
      return (f[y0 * 256 + x0] * (1 - fx) + f[y0 * 256 + x1] * fx) * (1 - fy) + (f[y1 * 256 + x0] * (1 - fx) + f[y1 * 256 + x1] * fx) * fy;
    };
    const n1 = (x, z, sc, o = 0) => bil(NF, x * sc + 37 + o, z * sc + 91 + o * 0.7);
    const n2 = (x, z, sc, o = 0) => bil(NF2, x * sc + 11 + o, z * sc + 53);

    // ---------------------------------------------------------------- distance fields (1-unit grid): road, gorge, stream
    const G0X = BOUNDS.minX - 10, G0Z = BOUNDS.minZ - 10, GW = BOUNDS.maxX - BOUNDS.minX + 21, GH = BOUNDS.maxZ - BOUNDS.minZ + 21;
    const RD = new Float32Array(GW * GH).fill(60), RS = new Float32Array(GW * GH), RLAT = new Float32Array(GW * GH);
    for (let i = 0; i < track.N; i += 2) {
      const x = track.x[i], z = track.z[i], hw = track.w[i] / 2, R = hw + 26, R2 = R * R;
      const nx = -track.tz[i], nz = track.tx[i];
      const gx0 = Math.max(0, Math.floor(x - R - G0X)), gx1 = Math.min(GW - 1, Math.ceil(x + R - G0X));
      const gz0 = Math.max(0, Math.floor(z - R - G0Z)), gz1 = Math.min(GH - 1, Math.ceil(z + R - G0Z));
      for (let gz = gz0; gz <= gz1; gz++) {
        const dz = gz + G0Z - z, dz2 = dz * dz;
        for (let gx = gx0; gx <= gx1; gx++) {
          const dx = gx + G0X - x, d2 = dx * dx + dz2, k = gz * GW + gx, cur = RD[k] + hw;
          if (d2 > R2 || d2 >= cur * cur) continue;
          RD[k] = Math.sqrt(d2) - hw; RS[k] = i * track.ds; RLAT[k] = dx * nx + dz * nz;
        }
      }
    }
    // a polyline (centripetal spline, 1-unit spacing) and its distance field
    const lineField = (pts, reach) => {
      const cv = new T.CatmullRomCurve3(pts.map(([x, z]) => new T.Vector3(x, 0, z)), false, 'centripetal');
      const len = cv.getLength(), n = Math.ceil(len);
      const P = cv.getSpacedPoints(n).map((v) => [v.x, v.z]);
      const Tn = P.map((p, i) => { const a = P[Math.max(0, i - 1)], b = P[Math.min(n, i + 1)]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; });
      const step = len / n;
      const D = new Float32Array(GW * GH).fill(reach + 1), DA = new Float32Array(GW * GH), DL = new Float32Array(GW * GH);
      for (let i = 0; i <= n; i++) {
        const [x, z] = P[i];
        const gx0 = Math.max(0, Math.floor(x - reach - G0X)), gx1 = Math.min(GW - 1, Math.ceil(x + reach - G0X));
        const gz0 = Math.max(0, Math.floor(z - reach - G0Z)), gz1 = Math.min(GH - 1, Math.ceil(z + reach - G0Z));
        for (let gz = gz0; gz <= gz1; gz++) {
          const dz = gz + G0Z - z, dz2 = dz * dz;
          for (let gx = gx0; gx <= gx1; gx++) {
            const dx = gx + G0X - x, d2 = dx * dx + dz2, k = gz * GW + gx;
            if (d2 >= D[k] * D[k]) continue;
            D[k] = Math.sqrt(d2); DA[k] = i * step; DL[k] = -dx * Tn[i][1] + dz * Tn[i][0];
          }
        }
      }
      return { P, Tn, step, len, n, D, DA, DL };
    };
    const GF = lineField(GORGE, 34), SF = lineField(STREAM, 14);
    const gridBil = (F, x, z, def) => {
      const gx = x - G0X, gz = z - G0Z;
      if (gx < 0 || gz < 0 || gx >= GW - 1 || gz >= GH - 1) return def;
      const x0 = gx | 0, z0 = gz | 0, fx = gx - x0, fz = gz - z0, k = z0 * GW + x0;
      return (F[k] * (1 - fx) + F[k + 1] * fx) * (1 - fz) + (F[k + GW] * (1 - fx) + F[k + GW + 1] * fx) * fz;
    };
    const gridN = (F, x, z, def) => {
      const gx = Math.round(x - G0X), gz = Math.round(z - G0Z);
      if (gx < 0 || gz < 0 || gx >= GW || gz >= GH) return def;
      return F[gz * GW + gx];
    };
    const roadD = (x, z) => gridBil(RD, x, z, 60); // distance from the road edge (< 0 on the road)
    const roadS = (x, z) => gridN(RS, x, z, 0);
    const roadLat = (x, z) => gridN(RLAT, x, z, 0);
    const gorD = (x, z) => gridBil(GF.D, x, z, 99);
    const gorA = (x, z) => gridN(GF.DA, x, z, 0);
    const strD = (x, z) => gridBil(SF.D, x, z, 99);
    const strA = (x, z) => gridN(SF.DA, x, z, 0);
    const inGorge = (x, z, m = 0) => gorD(x, z) < GHW + m;
    const inStream = (x, z, m = 0) => strD(x, z) < SHW + m && strA(x, z) < SF.len - 0.5;
    const lakeQ = (x, z) => { // < 1 inside the lake
      const dx = x - LAKE.x, dz = z - LAKE.z, c = Math.cos(LAKE.a), s = Math.sin(LAKE.a);
      const u = (dx * c + dz * s) / LAKE.rx, v = (-dx * s + dz * c) / LAKE.rz, ang = Math.atan2(v, u);
      return Math.hypot(u, v) / (1 + 0.12 * Math.sin(ang * 3 + 1.3) + 0.07 * Math.sin(ang * 5 + 0.4));
    };
    // stream bed depth: deeper where it runs through its little ravine under the bridge
    const sDepth = (a) => lerp(1.25, 2.5, ss(SF.len * 0.32, SF.len * 0.5, a));

    // ---------------------------------------------------------------- key places along the lap
    const S = {
      start: 905, hp1: sAt(-137, 50.5), hp2: sAt(-48.5, 16), hp3: sAt(-137, -18), gal0: 458, gal1: 497,
      gap: sAt(84, 72), bridge: sAt(46, 64), ne: sAt(151, -46),
    };
    A.S = S;
    // the three spurs between the switchback legs: inside side of each hairpin, from the open end of the leg below
    // (masonry wall facing the camera) round the rock nose to the leg above (bank and guard rail)
    const SPURS = [
      { side: 1, apex: S.hp1, a: sAt(-56, 67.5), b: sAt(-67, 34.6) },
      { side: -1, apex: S.hp2, a: sAt(-119, 31.4), b: sAt(-119, 0.9) },
      { side: 1, apex: S.hp3, a: sAt(-68, -2.4), b: sAt(-96, -42.5) },
    ];
    for (const sp of SPURS) { sp.na = sp.apex - 21; sp.nb = sp.apex + 21; }
    // gravel run-offs: outside of Kehre 2 and 3 and the north-east corner [s0, s1, side, depth]
    const ROSPEC = [[S.hp2 - 24, S.hp2 + 24, 1, 10], [S.hp3 - 24, S.hp3 + 22, -1, 9], [S.ne - 26, S.ne + 18, -1, 7]];
    const TOP = 2.7; // spur top above the road
    const WOFF = 2.2; // masonry wall face: distance from the road edge
    const spurAt = (x, z) => {
      const d = roadD(x, z);
      if (d < 0.05 || d > 30) return null;
      const s = roadS(x, z), lat = roadLat(x, z);
      for (const sp of SPURS) if (Math.sign(lat) === sp.side && inS(s, sp.a, sp.b)) return sp;
      return null;
    };
    const spurTaper = (sp, s) => ss(0, 14, sDist(sp.a, s)) * ss(0, 12, sDist(s, sp.b));
    const spurH = (sp, x, z) => {
      const s = roadS(x, z), d = roadD(x, z), tp = spurTaper(sp, s);
      const rough = (n1(x, z, 2.2, 17) - 0.5) * 0.9;
      if (inS(s, sp.a, sp.na)) { // masonry side
        if (d < WOFF + 0.2) return 0;
        if (d < WOFF + 1.4) return -0.25;
        return TOP * tp + rough * tp;
      }
      if (inS(s, sp.na, sp.nb)) { // the rock nose
        const nd = WOFF + 0.6;
        if (d < nd) return 0;
        return (TOP + 1.4 + rough * 2.2) * ss(nd, nd + 1.4, d);
      }
      return lerp(0.12, TOP + rough, ss(1.4, 8, d)) * tp; // bank down to the rail of the leg above
    };

    // ---------------------------------------------------------------- terrain height model
    // the foot of the northern massif: a smooth line a few units north of the northmost road edges
    const FX0 = BOUNDS.minX - 12, FN = BOUNDS.maxX - BOUNDS.minX + 25;
    const FOOT = new Float32Array(FN);
    for (let i = 0; i < FN; i++) {
      const x = FX0 + i;
      let m = -44;
      for (let k = 0; k < track.N; k += 3) {
        const dx = Math.abs(track.x[k] - x);
        if (dx > 40) continue;
        m = Math.min(m, track.z[k] - track.w[k] / 2 - 4.2 + 0.011 * dx * dx);
      }
      FOOT[i] = m;
    }
    for (let pass = 0; pass < 3; pass++) {
      const c = FOOT.slice();
      for (let i = 0; i < FN; i++) { let a = 0, n = 0; for (let k = -4; k <= 4; k++) { const j = i + k; if (j >= 0 && j < FN) { a += Math.min(c[j], c[i] + 0.4 * Math.abs(k)); n++; } } FOOT[i] = Math.min(c[i], a / n); }
    }
    const zFoot = (x) => { const f = clamp(x - FX0, 0, FN - 1.001), i = f | 0, t = f - i; return FOOT[i] * (1 - t) + FOOT[i + 1] * t; };
    const PEAKS = [[-150, 20, 26], [-88, 30, 24], [-22, 36, 26], [46, 22, 22], [104, 34, 26], [166, 22, 22]];
    const peakH = (x) => { let h = 24; for (const [px, a, w] of PEAKS) h += a * Math.exp(-(((x - px) / w) ** 2)); return h; };
    const H = (x, z) => {
      const sp = spurAt(x, z);
      if (sp) return spurH(sp, x, z);
      const rd = roadD(x, z);
      let h = 0;
      // the northern massif: peaks, ribs and gullies, crags
      {
        const d = zFoot(x) - z;
        if (d > -4) {
          const rise = Math.pow(ss(-2, 26, d + (n1(x, z, 0.07, 3) - 0.5) * 6), 0.7);
          let hm = peakH(x) * rise * (0.82 + 0.36 * n1(x, z, 0.08, 44)) + 16 * ss(22, 44, d) * (0.4 + n1(x, z, 0.5, 12));
          const rb = bil(NF, x * 2.1 + 5 + z * 0.35, z * 0.42 + 70), rib = 0.5 - Math.abs(rb - 0.5) * 2.4, rib2 = bil(NF2, x * 3.4 + 17, z * 0.9 + 9) - 0.5;
          hm += (rib * 20 + rib2 * 8) * ss(2, 14, d) * (1 - 0.4 * ss(40, 60, hm)); // sharp buttresses and gullies down the face
          hm += (n2(x, z, 1.3, 4) - 0.5) * 5 * ss(1, 8, d); // crags
          if (hm > 5 && hm < 46) hm += Math.sin(hm * 0.75 + n1(x, z, 0.6, 3) * 5) * 1.2; // ledges
          h = Math.max(h, hm * ss(-38, -50, z + (n1(x, z, 0.05, 8) - 0.5) * 8));
        }
      }
      // the mountain slope carried over the gallery roof (rockfall protection)
      if (rd > 1.2 && rd < 16) {
        const s = roadS(x, z);
        if (roadLat(x, z) < 0 && inS(s, S.gal0 - 6, S.gal1 + 6)) h = Math.max(h, 9.3 * ss(S.gal0 - 6, S.gal0 - 1, s) * ss(S.gal1 + 6, S.gal1 + 1, s) * ss(1.2, 2.4, rd) + h * ss(5, 14, rd));
      }
      // west slopes behind the western hairpins, north of where the gorge leaves the board
      h = Math.max(h, 19 * ss(-147, -172, x + (n1(x, z, 0.06, 2) - 0.5) * 8) * ss(36, 22, z) + (n2(x, z, 0.2, 2) - 0.5) * 2.5 * ss(-150, -160, x));
      // east bank above the long right-hander
      h = Math.max(h, 11 * ss(164, 180, x + (n1(x, z, 0.06, 6) - 0.5) * 7) * ss(84, 70, z));
      // rolling infield hills (kept low: they must not hide the road north of them)
      {
        const inf = ss(-36, -24, x) * ss(150, 136, x) * ss(-52, -40, z) * ss(56, 44, z);
        const flat = Math.max(ss(30, 18, Math.hypot(x + 6, (z - 42) * 1.4)), ss(LAKE.rx + 14, LAKE.rx, Math.hypot(x - LAKE.x, (z - LAKE.z) * 1.5)));
        h = Math.max(h, 6.5 * ss(0.38, 0.72, n1(x, z, 0.75, 90)) * inf * (1 - flat) * ss(5, 16, rd));
      }
      // a low rocky strip beyond the gorge, along the south edge
      h = Math.max(h, (1.2 + 3.6 * n1(x, z, 0.9, 31)) * ss(GHW + 1, GHW + 4, gorD(x, z)) * ss(80, 96, z));
      // keep the road corridor (and the gravel run-offs) at road level
      h = lerp(0, h, ss(1.0, 3.6, rd));
      if (rd < 16) { const s = roadS(x, z), lat = roadLat(x, z); for (const [a, b, side, dp] of ROSPEC) if (Math.sign(lat) === side && inS(s, a - 4, b + 4)) h = lerp(0, h, ss(1.6 + dp, 4.6 + dp, rd)); }
      // the lake: a shallow bowl with a pebble beach
      { const q = lakeQ(x, z); if (q < 1.35) h = lerp(-2.4 * ss(1, 0.35, q), h, ss(1.0, 1.35, q)); }
      // stream banks, gorge rim
      { const sd = strD(x, z); if (sd < SHW + 5) h = lerp(0, h, ss(SHW + 1, SHW + 5, sd)); }
      { const gd = gorD(x, z); if (gd < GHW + 6) h = lerp(0, h, ss(GHW + 1.2, GHW + 6, gd)); }
      return Math.max(h, -2.6);
    };

    // ---------------------------------------------------------------- textures
    const grassTex = (() => { // alpine meadow flock: dots rasterised in JS, a few flower specks
      const Sz = 512, N = Sz * Sz;
      const nA = TX.noiseField(256, { seed: 3, period: 6, oct: 4 });
      const R = new Float32Array(N), G = new Float32Array(N), B = new Float32Array(N), Hh = new Float32Array(N);
      for (let y = 0; y < Sz; y++) for (let x = 0; x < Sz; x++) {
        const t = TX.sampleField(nA, 256, x / 2, y / 2), k = y * Sz + x;
        R[k] = 92 + t * 40; G[k] = 116 + t * 38; B[k] = 52 + t * 18;
      }
      const cols = [0x6f9a3c, 0x86a846, 0x5a8034, 0xa2b45a, 0x4c7030, 0xb8b868, 0x7c9a40, 0x98a24c, 0xc4b670].map((c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255]);
      const flw = [0xf4f2ea, 0xf2d84a, 0x9a72d0, 0x4a7ad8, 0xe8789a].map((c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255]);
      const rr = K.rng(5);
      for (let i = 0; i < 9600; i++) {
        const flower = i > 9300;
        const cx = rr() * Sz, cy = rr() * Sz, rad = flower ? 0.8 + rr() * 0.6 : 0.6 + rr() * 1.3, col = flower ? flw[(rr() * flw.length) | 0] : cols[(rr() * cols.length) | 0], al = flower ? 0.95 : 0.45 + rr() * 0.5;
        const lum = (col[0] * 0.3 + col[1] * 0.59 + col[2] * 0.11) / 255;
        for (let y = Math.floor(cy - rad - 1); y <= cy + rad + 1; y++) for (let x = Math.floor(cx - rad - 1); x <= cx + rad + 1; x++) {
          const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy), a = al * clamp(rad + 0.5 - d, 0, 1);
          if (a <= 0) continue;
          const k = (((y % Sz) + Sz) % Sz) * Sz + (((x % Sz) + Sz) % Sz);
          R[k] += (col[0] - R[k]) * a; G[k] += (col[1] - G[k]) * a; B[k] += (col[2] - B[k]) * a;
          Hh[k] += (lum + 0.35 - Hh[k]) * a;
        }
      }
      const c = TX.paint(Sz, Sz, (x, y, u, v, o) => { const k = y * Sz + x; o[0] = R[k]; o[1] = G[k]; o[2] = B[k]; });
      for (let k = 0; k < N; k++) Hh[k] += (R[k] * 0.3 + G[k] * 0.59 + B[k] * 0.11) / 255;
      return { map: TX.toTexture(c), normalMap: TX.toTexture(TX.normalFromHeight(Hh, Sz, Sz, 1.6), { srgb: false }) };
    })();
    const rockTex = (() => { // grey alpine limestone: faint beds, joints and cracks, rain streaks, lichen
      const Sz = 512, q = K.rng(9);
      const nA = TX.noiseField(256, { seed: 41, period: 5, oct: 4 });
      const nB = TX.noiseField(256, { seed: 43, period: 14, oct: 3 });
      const c = TX.paint(Sz, Sz, (x, y, u, v, o) => {
        const a = TX.sampleField(nA, 256, u * 256, v * 256), b = TX.sampleField(nB, 256, u * 256, v * 256);
        const bed = 0.94 + 0.06 * Math.sin(v * TAU * 7 + b * 5);
        const k = bed * (0.84 + (a - 0.5) * 0.42 + (b - 0.5) * 0.26);
        o[0] = 168 * k; o[1] = 166 * k; o[2] = 160 * k;
      });
      const g = c.getContext('2d');
      const wrap = (fn) => { for (const ox of [-Sz, 0, Sz]) for (const oy of [-Sz, 0, Sz]) fn(ox, oy); };
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (let i = 0; i < 46; i++) { // joints: jagged dark cracks with a pale lip
        const x0 = q() * Sz, y0 = q() * Sz, steps = 4 + (q() * 6 | 0), hor = q() < 0.55;
        const pts = [[x0, y0]];
        for (let k = 0; k < steps; k++) { const [px, py] = pts[pts.length - 1]; pts.push(hor ? [px + 14 + q() * 26, py + (q() - 0.5) * 14] : [px + (q() - 0.5) * 16, py + 12 + q() * 22]); }
        const a1 = 0.16 + q() * 0.14, a2 = 0.4 + q() * 0.35, lw = 1.1 + q() * 1.8;
        wrap((ox, oy) => {
          g.strokeStyle = `rgba(250,248,240,${a1})`; g.lineWidth = 1.6; g.beginPath(); pts.forEach(([px, py], k) => (k ? g.lineTo(px + ox, py + oy - 1.8) : g.moveTo(px + ox, py + oy - 1.8))); g.stroke();
          g.strokeStyle = `rgba(36,36,40,${a2})`; g.lineWidth = lw; g.beginPath(); pts.forEach(([px, py], k) => (k ? g.lineTo(px + ox, py + oy) : g.moveTo(px + ox, py + oy))); g.stroke();
        });
      }
      for (let i = 0; i < 30; i++) {
        const x = q() * Sz, y = q() * Sz, rad = 20 + q() * 55, col = q() < 0.4 ? '120,124,112' : q() < 0.6 ? '70,70,74' : '222,218,206', al = 0.14 + q() * 0.14;
        wrap((ox, oy) => { const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad); gr.addColorStop(0, `rgba(${col},${al})`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2); });
      }
      for (let i = 0; i < 80; i++) { // rain streaks
        const x = q() * Sz, y = q() * Sz, len = 30 + q() * 90, w = 2 + q() * 7, al = 0.12 + q() * 0.14;
        wrap((ox, oy) => { const gr = g.createLinearGradient(0, y + oy, 0, y + oy + len); gr.addColorStop(0, `rgba(44,42,40,${al})`); gr.addColorStop(1, 'rgba(44,42,40,0)'); g.fillStyle = gr; g.fillRect(x + ox, y + oy, w, len); });
      }
      for (let i = 0; i < 2400; i++) { // lichen: rust orange, sulphur yellow, grey-green; speckle
        const t = q(), x = q() * Sz, y = q() * Sz;
        g.fillStyle = t < 0.12 ? `rgba(206,128,52,${0.3 + q() * 0.35})` : t < 0.22 ? `rgba(200,196,92,${0.3 + q() * 0.3})` : t < 0.42 ? `rgba(120,132,104,${0.25 + q() * 0.3})` : t < 0.7 ? `rgba(40,40,44,${0.15 + q() * 0.2})` : `rgba(250,248,240,${0.1 + q() * 0.16})`;
        g.beginPath(); g.arc(x, y, 0.7 + q() * (t < 0.42 ? 3.2 : 2.2), 0, TAU); g.fill();
      }
      return TX.toTexture(c);
    })();
    const stoneTex = (seed, base, k0 = 1) => { // rubble masonry: rough blocks, 4 units wide and 2 tall per tile
      const c = TX.makeCanvas(256, 128), g = c.getContext('2d');
      const rr = K.rng(seed);
      g.fillStyle = '#5a5650'; g.fillRect(0, 0, 256, 128);
      for (let row = 0; row < 5; row++) {
        let x = row % 2 ? -18 : 0;
        const rh = 128 / 5;
        while (x < 256) {
          const w = 22 + rr() * 30, k = (0.74 + rr() * 0.36) * k0, tint = rr() * 14;
          g.fillStyle = `rgb(${base[0] * k + tint | 0},${base[1] * k + tint | 0},${base[2] * k | 0})`;
          g.beginPath(); g.roundRect(x + 2, row * rh + 2 + (rr() - 0.5) * 2, w - 3, rh - 4, 4); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.09)'; g.fillRect(x + 3, row * rh + 3, w - 6, 3);
          g.fillStyle = 'rgba(0,0,0,0.14)'; g.fillRect(x + 3, row * rh + rh - 6, w - 6, 3);
          x += w;
        }
      }
      for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${rr() < 0.5 ? '255,255,255' : '0,0,0'},${0.05 + rr() * 0.07})`; g.fillRect(rr() * 256, rr() * 128, 2, 2); }
      for (let i = 0; i < 50; i++) { g.fillStyle = `rgba(70,96,46,${0.12 + rr() * 0.22})`; g.beginPath(); g.arc(rr() * 256, 100 + rr() * 28, 2 + rr() * 5, 0, TAU); g.fill(); }
      return TX.toTexture(c);
    };
    const masonry = stoneTex(71, [176, 170, 158]);
    const stoneMat = K.std({ map: masonry, vertexColors: true, roughness: 0.9, side: T.DoubleSide });
    const asphalt = (() => { // fine grey asphalt, white edge lines and a dashed centre line; 256 px across, 16 units along
      const Wd = 256, Hd = 512, q = K.rng(61);
      const nA = TX.noiseField(256, { seed: 63, period: 32, oct: 3 });
      const h = new Float32Array(Wd * Hd);
      const c = TX.paint(Wd, Hd, (x, y, u, v, o) => {
        const t = TX.sampleField(nA, 256, x, y / 2), sp = q();
        let k = 0.9 + (t - 0.5) * 0.16 + (sp < 0.08 ? 0.22 : sp < 0.16 ? -0.16 : 0);
        k *= 1 - 0.07 * Math.exp(-(((u - 0.3) / 0.07) ** 2)) - 0.07 * Math.exp(-(((u - 0.7) / 0.07) ** 2)); // polished wheel tracks
        h[y * Wd + x] = sp < 0.08 ? 1 : sp < 0.3 ? 0.6 : 0.3 + t * 0.2;
        o[0] = 66 * k; o[1] = 67 * k; o[2] = 70 * k;
      });
      const g = c.getContext('2d');
      g.lineCap = 'round';
      for (let i = 0; i < 3; i++) { g.strokeStyle = `rgba(26,26,28,${0.22 + q() * 0.12})`; g.lineWidth = 2; g.beginPath(); let x = 40 + q() * 170, y = q() * Hd; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (q() - 0.5) * 30; y += 10 + q() * 20; g.lineTo(x, y); } g.stroke(); } // tar-sealed cracks
      g.fillStyle = 'rgba(244,244,236,0.92)';
      g.fillRect(Wd * 0.028, 0, Wd * 0.026, Hd); g.fillRect(Wd * (1 - 0.054), 0, Wd * 0.026, Hd);
      for (let k = 0; k < 2; k++) g.fillRect(Wd * 0.4875, k * 256 + 40, Wd * 0.025, 128);
      return { map: TX.toTexture(c), normalMap: TX.toTexture(TX.normalFromHeight(h, Wd, Hd, 1.4), { srgb: false }) };
    })();
    const gravel = TX.mottledTextures({ size: 256, a: 0xb6ad9c, b: 0x8e8778, c: 0xd2c8b4, seed: 23, period: 10, speck: 0.3, bump: 3, pebbles: 260, pebbleColor: 0x9a9284 });
    const woodTex = (() => { // weathered dark larch boards (vertical), 4 units per tile
      const c = TX.makeCanvas(256, 256), g = c.getContext('2d'), q = K.rng(91);
      for (let i = 0; i < 16; i++) {
        const k = 0.8 + q() * 0.3;
        g.fillStyle = `rgb(${92 * k | 0},${58 * k | 0},${34 * k | 0})`; g.fillRect(i * 16, 0, 16, 256);
        for (let j = 0; j < 14; j++) { g.strokeStyle = `rgba(30,18,10,${0.15 + q() * 0.2})`; g.lineWidth = 1; g.beginPath(); const x = i * 16 + 2 + q() * 12; g.moveTo(x, 0); g.bezierCurveTo(x + (q() - 0.5) * 6, 80, x + (q() - 0.5) * 6, 170, x, 256); g.stroke(); }
        g.fillStyle = 'rgba(20,12,6,0.55)'; g.fillRect(i * 16, 0, 1.5, 256);
      }
      return TX.toTexture(c);
    })();
    const shingleTex = (() => { // weathered grey wooden shingles
      const c = TX.makeCanvas(256, 256), g = c.getContext('2d'), q = K.rng(93);
      g.fillStyle = '#3e3a36'; g.fillRect(0, 0, 256, 256);
      for (let row = 0; row < 16; row++) for (let i = 0; i < 13; i++) {
        const x = i * 20 + (row % 2) * 10 - 10, y = row * 16, k = 0.68 + q() * 0.42;
        g.fillStyle = `rgb(${120 * k | 0},${110 * k | 0},${100 * k | 0})`; g.fillRect(x + 1, y + 1, 18, 15);
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + 1, y + 13, 18, 3);
      }
      return TX.toTexture(c);
    })();
    const waterN = (() => {
      const Sz = 256, h = new Float32Array(Sz * Sz);
      const nA = TX.noiseField(256, { seed: 81, period: 10, oct: 3 });
      for (let y = 0; y < Sz; y++) for (let x = 0; x < Sz; x++) h[y * Sz + x] = TX.sampleField(nA, 256, x, y) + 0.12 * Math.sin((x * 0.4 + y) * 0.32);
      return TX.toTexture(TX.normalFromHeight(h, Sz, Sz, 2.4), { srgb: false });
    })();

    // ---------------------------------------------------------------- helpers: geometry, baking, contact shadows
    const contacts = [];
    let gy = () => 0; // terrain height (set once the grid exists)
    const AO = (x, z, rx, rz = rx, op = 0.4, ang = 0, y = null) => contacts.push({ x, y: (y ?? gy(x, z)) + 0.07, z, ry: -ang, sx: rx * 2, sy: op, sz: rz * 2 });
    const xf = (g, o = {}) => {
      const m = new T.Matrix4().compose(new T.Vector3(o.x || 0, o.y || 0, o.z || 0), new T.Quaternion().setFromEuler(new T.Euler(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ')), new T.Vector3(o.sx ?? o.s ?? 1, o.sy ?? o.s ?? 1, o.sz ?? o.s ?? 1));
      return g.applyMatrix4(m);
    };
    const colorize = (g, c, k = 1) => {
      g = g.index ? g.toNonIndexed() : g;
      const col = new T.Color(c), n = g.attributes.position.count, a = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { a[i * 3] = col.r * k; a[i * 3 + 1] = col.g * k; a[i * 3 + 2] = col.b * k; }
      g.setAttribute('color', new T.BufferAttribute(a, 3));
      return g;
    };
    const tidy = (g, extra = []) => {
      if (g.index) g = g.toNonIndexed();
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color', 'uv', ...extra].includes(k)) g.deleteAttribute(k);
      if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!g.attributes.color) colorize(g, 0xffffff);
      return g;
    };
    const merge = (parts) => BU.mergeGeometries(parts.map((g) => tidy(g)), false);
    // world-scale box-projected UVs, chosen per triangle by its facing (masonry blocks keep their size)
    const boxUV = (g, sx, sy, y0 = null) => {
      if (g.index) g = g.toNonIndexed();
      const p = g.attributes.position, n = p.count, uv = new Float32Array(n * 2);
      let yb = y0;
      if (yb === null) { yb = 1e9; for (let i = 0; i < n; i++) yb = Math.min(yb, p.getY(i)); }
      for (let i = 0; i + 2 < n; i += 3) {
        const ax = p.getX(i), ay = p.getY(i), az = p.getZ(i);
        const e1x = p.getX(i + 1) - ax, e1y = p.getY(i + 1) - ay, e1z = p.getZ(i + 1) - az;
        const e2x = p.getX(i + 2) - ax, e2y = p.getY(i + 2) - ay, e2z = p.getZ(i + 2) - az;
        const fx = Math.abs(e1y * e2z - e1z * e2y), fy = Math.abs(e1z * e2x - e1x * e2z), fz = Math.abs(e1x * e2y - e1y * e2x);
        for (let k = i; k < i + 3; k++) {
          const x = p.getX(k), y = p.getY(k) - yb, z = p.getZ(k);
          if (fy >= fx && fy >= fz) { uv[k * 2] = x / sx; uv[k * 2 + 1] = z / sy; } else if (fx >= fz) { uv[k * 2] = z / sx; uv[k * 2 + 1] = y / sy; } else { uv[k * 2] = x / sx; uv[k * 2 + 1] = y / sy; }
        }
      }
      g.setAttribute('uv', new T.BufferAttribute(uv, 2));
      return g;
    };
    const uvBox = new Map();
    const uvb = (g, mat) => { const b = uvBox.get(mat); return b ? boxUV(g, b[0], b[1], b[2] ?? null) : g; };
    uvBox.set(stoneMat, [4, 2, 0]);
    const bakeQ = new Map();
    const CELL = 110;
    const bake = (geo, mat, x = 0, z = 0, cast = true) => {
      const key = mat.uuid + (cast ? 'c' : '') + Math.floor((x + 330) / CELL) + ':' + Math.floor((z + 330) / CELL);
      if (!bakeQ.has(key)) bakeQ.set(key, { mat, cast, parts: [] });
      bakeQ.get(key).parts.push(geo);
    };
    const flushBake = () => {
      for (const { mat, cast, parts } of bakeQ.values()) {
        const g = merge(parts);
        g.computeBoundingSphere();
        const m = new T.Mesh(g, mat); m.castShadow = cast; m.receiveShadow = true;
        keep.push(m); K.group.add(m);
      }
      bakeQ.clear();
    };
    const chunked = (geo, mat, list, opts = {}, cell = 110) => {
      const b = new Map();
      for (const it of list) { const k = Math.floor((it.x + 330) / cell) + ',' + Math.floor((it.z + 330) / cell); if (!b.has(k)) b.set(k, []); b.get(k).push(it); }
      const out = [];
      for (const l of b.values()) { const im = K.instances(geo, mat, l, opts); keep.push(im); out.push(im); }
      return out;
    };
    const vc = K.std({ vertexColors: true, roughness: 0.78 });
    const vcSatin = K.phys({ vertexColors: true, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.35 });
    const vcMetal = K.std({ vertexColors: true, roughness: 0.36, metalness: 0.75 });
    const woodMat = K.std({ map: woodTex, vertexColors: true, roughness: 0.82 });
    uvBox.set(woodMat, [4, 4, 0]);
    const prop = (geo, col, o, mat = vc, cast = true) => { const g = uvb(colorize(xf(geo, o), col), mat); bake(g, mat, o.x || 0, o.z || 0, cast); return g; };
    const frame = (cx, cy, cz, ry, s = 1) => {
      const M = new T.Matrix4().compose(new T.Vector3(cx, cy, cz), new T.Quaternion().setFromEuler(new T.Euler(0, ry, 0)), new T.Vector3(s, s, s));
      return (geo, col, o = {}, mat = vc, cast = true) => { let g = colorize(xf(geo, o), col); g.applyMatrix4(M); g = uvb(g, mat); bake(g, mat, cx, cz, cast); return g; };
    };
    const blocked = [];
    const block = (x, z, hw, hd, ang = 0, pad = 0) => blocked.push({ x, z, hw: hw + pad, hd: hd + pad, c: Math.cos(ang), s: Math.sin(ang) });
    const isBlocked = (x, z, m = 0) => { for (const b of blocked) { const dx = x - b.x, dz = z - b.z; const a = dx * b.c + dz * b.s, c = -dx * b.s + dz * b.c; if (Math.abs(a) < b.hw + m && Math.abs(c) < b.hd + m) return true; } return false; };
    // a swept profile along frames {x, z, nx, nz, y}; prof = [[offset along n, height, shade?], ...] or a function of the frame
    const sweep = (frames, prof, { uS = 4, vS = 2, col = null, flip = null } = {}) => {
      const fl = flip ?? !!frames[0].flip;
      const pos = [], uv = [], idx = [], cl = [];
      const P0 = typeof prof === 'function' ? prof(frames[0], 0) : prof;
      const pu = [0]; for (let k = 1; k < P0.length; k++) pu.push(pu[k - 1] + Math.hypot(P0[k][0] - P0[k - 1][0], P0[k][1] - P0[k - 1][1]));
      let acc = 0;
      frames.forEach((f, i) => {
        if (i) acc += Math.hypot(f.x - frames[i - 1].x, f.z - frames[i - 1].z);
        const P = typeof prof === 'function' ? prof(f, i) : prof;
        P.forEach(([o, y, c], k) => { pos.push(f.x + f.nx * o, f.y + y, f.z + f.nz * o); uv.push(acc / uS, pu[k] / vS); const q = c ?? col ?? 1; cl.push(q, q, q); });
      });
      const NP = P0.length;
      for (let i = 0; i < frames.length - 1; i++) for (let k = 0; k < NP - 1; k++) { const a = i * NP + k, b = a + 1, c2 = a + NP, d = c2 + 1; if (fl) idx.push(a, c2, b, b, c2, d); else idx.push(a, b, c2, b, d, c2); }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new T.Float32BufferAttribute(cl, 3));
      g.setIndex(idx); g.computeVertexNormals();
      return g;
    };
    // frames along a road edge (side -1 left, +1 right), `off` beyond the edge
    const roadFrames = (s0, s1, side, off, step = 1) => {
      const out = [], n = Math.max(1, Math.ceil(Math.abs(s1 - s0) / step));
      for (let i = 0; i <= n; i++) {
        const s = s0 + ((s1 - s0) * i) / n, p = track.at(s), o = side * (p.w / 2 + off);
        out.push({ x: p.x + p.nx * o, z: p.z + p.nz * o, nx: p.nx * side, nz: p.nz * side, y: 0, s, flip: side < 0 });
      }
      return out;
    };
    const tint = (g, c) => { const cc = new T.Color(c), ca = g.attributes.color; for (let i = 0; i < ca.count; i++) ca.setXYZ(i, ca.getX(i) * cc.r, ca.getY(i) * cc.g, ca.getZ(i) * cc.b); return g; };
    const labelMat = (w, h, draw, extra = {}) => K.std({ map: TX.labelTexture(w, h, draw), roughness: 0.55, ...extra });

    // ---------------------------------------------------------------- terrain mesh (one height grid, chunked) + rock/snow shader
    const TX0 = BOUNDS.minX, TX1 = BOUNDS.maxX, TZ0 = BOUNDS.minZ, TZ1 = BOUNDS.maxZ;
    const NXg = 282, NZg = 181;
    const nx = NXg + 1, nz = NZg + 1;
    const XS = [], ZS = [];
    for (let i = 0; i < nx; i++) XS.push(TX0 + ((TX1 - TX0) * i) / NXg);
    for (let j = 0; j < nz; j++) ZS.push(TZ0 + ((TZ1 - TZ0) * j) / NZg);
    const HG = new Float32Array(nx * nz);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) HG[j * nx + i] = H(XS[i], ZS[j]);
    const dxg = (TX1 - TX0) / NXg, dzg = (TZ1 - TZ0) / NZg;
    gy = (x, z) => {
      const fx = clamp((x - TX0) / dxg, 0, NXg - 0.001), fz = clamp((z - TZ0) / dzg, 0, NZg - 0.001);
      const i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j, k = j * nx + i;
      return (HG[k] * (1 - tx) + HG[k + 1] * tx) * (1 - tz) + (HG[k + nx] * (1 - tx) + HG[k + nx + 1] * tx) * tz;
    };
    const slopeAt = (x, z) => Math.hypot(gy(x + 0.8, z) - gy(x - 0.8, z), gy(x, z + 0.8) - gy(x, z - 0.8)) / 1.6;
    const ROCK = new Float32Array(nx * nz), SNOW = new Float32Array(nx * nz);
    const terrainMat = K.std({ map: grassTex.map, normalMap: grassTex.normalMap, normalScale: V2(0.7), vertexColors: true, roughness: 0.93 });
    terrainMat.onBeforeCompile = (sh) => {
      sh.uniforms.rockMap = { value: rockTex };
      sh.vertexShader = 'attribute float aRock;\nattribute float aSnow;\nvarying float vRock;\nvarying float vSnow;\nvarying vec3 vWP;\nvarying vec3 vWN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvRock = aRock;\nvSnow = aSnow;\nvWP = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;\nvWN = normalize( mat3( modelMatrix ) * objectNormal );');
      sh.fragmentShader = 'uniform sampler2D rockMap;\nvarying float vRock;\nvarying float vSnow;\nvarying vec3 vWP;\nvarying vec3 vWN;\n' + sh.fragmentShader.replace('#include <map_fragment>', `
        #ifdef USE_MAP
          vec4 gC = texture2D( map, vMapUv );
          vec4 rC = gC;
          vec3 bw = pow( abs( normalize( vWN ) ), vec3( 4.0 ) ); bw /= bw.x + bw.y + bw.z;
          vec3 q = vWP / 22.0;
          if ( vRock > 0.01 || vSnow > 0.01 ) {
            rC = texture2D( rockMap, vec2( q.z + 0.37, q.y ) ) * bw.x + texture2D( rockMap, vec2( q.x, q.y ) ) * bw.z + texture2D( rockMap, vec2( q.x, q.z ) ) * bw.y;
          }
          vec3 col = mix( gC.rgb, rC.rgb, vRock );
          float lum = dot( rC.rgb, vec3( 0.33 ) );
          vec3 snow = vec3( 0.93, 0.95, 0.99 ) * ( 0.9 + 0.12 * lum );
          float snowK = smoothstep( 0.3, 0.55, vSnow + ( lum - 0.3 ) * 0.8 );
          diffuseColor.rgb *= col;
        #endif`).replace('#include <color_fragment>', '#include <color_fragment>\n  #ifdef USE_MAP\n  diffuseColor.rgb = mix( diffuseColor.rgb, snow, snowK );\n  #endif');
    };
    // cells left out of the terrain: the gorge (its own mesh), the stream channel, the lake bed is kept
    const cut = (x, z) => inGorge(x, z, 0.35) || (inStream(x, z, 0.3) && roadD(x, z) > -1);
    {
      const NRM = new Float32Array(nx * nz * 3), COL = new Float32Array(nx * nz * 3), UV = new Float32Array(nx * nz * 2);
      const cGrass = [[0.98, 1.0, 0.9], [1.08, 1.04, 0.82], [0.88, 0.96, 0.86], [1.04, 0.98, 0.8]];
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
        const k = j * nx + i, x = XS[i], z = ZS[j], h = HG[k];
        const i0 = Math.max(0, i - 1), i1 = Math.min(nx - 1, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(nz - 1, j + 1);
        const dhx = (HG[j * nx + i1] - HG[j * nx + i0]) / (XS[i1] - XS[i0]);
        const dhz = (HG[j1 * nx + i] - HG[j0 * nx + i]) / (ZS[j1] - ZS[j0]);
        const l = Math.hypot(dhx, 1, dhz);
        NRM[k * 3] = -dhx / l; NRM[k * 3 + 1] = 1 / l; NRM[k * 3 + 2] = -dhz / l;
        const slope = Math.hypot(dhx, dhz);
        const nz1 = n1(x, z, 0.05, 11), nz2 = n2(x, z, 0.12, 3);
        // rock on steep faces and above the alpine meadows; snow on the high, less steep ground
        let rock = clamp(ss(0.75, 1.45, slope + (nz1 - 0.5) * 0.5) + ss(22, 30, h + (nz2 - 0.5) * 8) * 0.85, 0, 1);
        const sp = spurAt(x, z);
        if (sp && inS(roadS(x, z), sp.na, sp.nb) && h > 1) rock = Math.max(rock, 0.9); // rock noses
        const lap = (HG[j * nx + i0] + HG[j * nx + i1] + HG[j0 * nx + i] + HG[j1 * nx + i]) / 4 - h; // > 0 in a gully
        const sn0 = n1(x, z, 1.1, 77), mass = ss(-40, -52, z);
        const couloir = ss(0.12, 0.5, lap + (sn0 - 0.5) * 0.3) * ss(7, 13, h + (sn0 - 0.5) * 6);
        const ledge = ss(15, 23, h + (sn0 - 0.5) * 10) * (1 - ss(1.4, 2.4, slope));
        const dF = zFoot(x) - z, neve = ss(0.47, 0.6, n1(x * 1.6, z * 0.45, 1.3, 31)) * ss(1.0, 3.5, dF) * ss(14, 6, dF) * ss(1.0, 3.0, h);
        const snow = clamp(Math.max(couloir, ledge, neve * 0.85, ss(30, 36, h) * (1 - ss(1.3, 2.1, slope))) * mass * (1 - ss(2.6, 3.4, slope)), 0, 1);
        ROCK[k] = rock; SNOW[k] = snow;
        const ga = cGrass[(nz1 * 3.99) | 0], gb = cGrass[(nz2 * 3.99) | 0];
        const t = (nz1 * 7) % 1;
        let cr = lerp(ga[0], gb[0], t), cg = lerp(ga[1], gb[1], t), cb = lerp(ga[2], gb[2], t);
        // drier, browner grass high up; a pebble beach round the lake
        const dry = ss(8, 22, h) * 0.5;
        cr *= 1 + dry * 0.18; cg *= 1 - dry * 0.04; cb *= 1 - dry * 0.12;
        const lq = lakeQ(x, z);
        if (lq < 1.3) { const w = ss(1.3, 1.0, lq); cr = lerp(cr, 1.5, w); cg = lerp(cg, 1.42, w); cb = lerp(cb, 1.45, w); }
        if (lq < 1.0) { const w = ss(1.0, 0.5, lq); cr = lerp(cr, 0.75, w); cg = lerp(cg, 0.85, w); cb = lerp(cb, 0.8, w); }
        const rk = (0.86 + nz2 * 0.26) * (0.8 + 0.3 * n1(x, z, 1.4, 21)) * clamp(1 - lap * 0.3, 0.55, 1.15);
        cr = lerp(cr, rk, rock); cg = lerp(cg, rk * 0.99, rock); cb = lerp(cb, rk * 0.98, rock);
        { // scree fans: pale grey stone spilling onto the meadow at the foot of the face
          const d = zFoot(x) - z, fan = ss(-3, 1, d) * ss(9, 3, d) * ss(0.42, 0.62, n1(x * 1.5, z * 0.4, 1.0, 5)) * ss(-40, -50, z);
          ROCK[k] = Math.max(ROCK[k], fan * 0.9); rock = Math.max(rock, fan * 0.9);
          cr = lerp(cr, 1.12, fan); cg = lerp(cg, 1.1, fan); cb = lerp(cb, 1.06, fan);
        }
        COL[k * 3] = cr; COL[k * 3 + 1] = cg; COL[k * 3 + 2] = cb;
        UV[k * 2] = (x + h * 0.35) / 6; UV[k * 2 + 1] = (z - h * 0.75) / 6;
      }
      const buildChunk = (i0, i1, j0, j1) => {
        const w = i1 - i0 + 1, hgt = j1 - j0 + 1;
        const pos = new Float32Array(w * hgt * 3), nrm = new Float32Array(w * hgt * 3), col = new Float32Array(w * hgt * 3), uv = new Float32Array(w * hgt * 2), rk = new Float32Array(w * hgt), sn = new Float32Array(w * hgt);
        let maxH = -1e9;
        for (let j = 0; j < hgt; j++) for (let i = 0; i < w; i++) {
          const k = (j0 + j) * nx + i0 + i, o = j * w + i;
          pos[o * 3] = XS[i0 + i]; pos[o * 3 + 1] = HG[k]; pos[o * 3 + 2] = ZS[j0 + j];
          nrm[o * 3] = NRM[k * 3]; nrm[o * 3 + 1] = NRM[k * 3 + 1]; nrm[o * 3 + 2] = NRM[k * 3 + 2];
          col[o * 3] = COL[k * 3]; col[o * 3 + 1] = COL[k * 3 + 1]; col[o * 3 + 2] = COL[k * 3 + 2];
          uv[o * 2] = UV[k * 2]; uv[o * 2 + 1] = UV[k * 2 + 1]; rk[o] = ROCK[k]; sn[o] = SNOW[k];
          maxH = Math.max(maxH, HG[k]);
        }
        const idx = [];
        for (let j = 0; j < hgt - 1; j++) for (let i = 0; i < w - 1; i++) {
          const cx = (XS[i0 + i] + XS[i0 + i + 1]) / 2, cz = (ZS[j0 + j] + ZS[j0 + j + 1]) / 2;
          if (cut(cx, cz)) continue;
          const p = j * w + i, q = p + 1, s2 = p + w, t2 = s2 + 1;
          idx.push(p, s2, q, q, s2, t2);
        }
        if (!idx.length) return null;
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.BufferAttribute(pos, 3));
        g.setAttribute('normal', new T.BufferAttribute(nrm, 3));
        g.setAttribute('color', new T.BufferAttribute(col, 3));
        g.setAttribute('uv', new T.BufferAttribute(uv, 2));
        g.setAttribute('aRock', new T.BufferAttribute(rk, 1));
        g.setAttribute('aSnow', new T.BufferAttribute(sn, 1));
        g.setIndex(idx);
        g.computeBoundingSphere();
        return { g, maxH };
      };
      const xs = [0, 56, 113, 170, 226, NXg], zs = [0, 45, 90, 136, NZg];
      for (let a = 0; a < xs.length - 1; a++) for (let b = 0; b < zs.length - 1; b++) {
        const c = buildChunk(xs[a], xs[a + 1], zs[b], zs[b + 1]);
        if (!c) continue;
        const m = new T.Mesh(c.g, terrainMat);
        m.castShadow = c.maxH > 9; m.receiveShadow = true;
        keep.push(m); K.group.add(m);
      }
    }
    const rockAt = (x, z) => { const i = Math.round((x - TX0) / dxg), j = Math.round((z - TZ0) / dzg); return i < 0 || j < 0 || i >= nx || j >= nz ? 1 : ROCK[j * nx + i]; };
    const snowAt = (x, z) => { const i = Math.round((x - TX0) / dxg), j = Math.round((z - TZ0) / dzg); return i < 0 || j < 0 || i >= nx || j >= nz ? 0 : SNOW[j * nx + i]; };
    // a rock mesh drawn with the terrain material (tri-planar rock): every vertex rock, optional snow by height
    const rockify = (g, snowY = 99) => {
      g = tidy(g);
      const n = g.attributes.position.count, rk = new Float32Array(n).fill(1), sn = new Float32Array(n);
      for (let i = 0; i < n; i++) sn[i] = ss(snowY, snowY + 4, g.attributes.position.getY(i));
      g.setAttribute('aRock', new T.BufferAttribute(rk, 1)); g.setAttribute('aSnow', new T.BufferAttribute(sn, 1));
      return g;
    };
    const rockParts = [];

    // ---------------------------------------------------------------- the gorge: rock walls down to the workbench, a stream in its bed, holes
    {
      const fr = [];
      const inB = (q) => q[0] <= BOUNDS.maxX + 0.5 && q[0] >= BOUNDS.minX - 0.5;
      for (let i = 0; i <= GF.n; i++) {
        const q = GF.P[i], f = { x: q[0], z: q[1], nx: -GF.Tn[i][1], nz: GF.Tn[i][0], d: i * GF.step };
        if (i > 0 && inB(q) !== inB(GF.P[i - 1])) {
          const pq = GF.P[i - 1], edge = (q[0] > BOUNDS.maxX || pq[0] > BOUNDS.maxX) ? BOUNDS.maxX : BOUNDS.minX, t = (edge - pq[0]) / (q[0] - pq[0]);
          fr.push({ ...f, x: lerp(pq[0], q[0], t), z: lerp(pq[1], q[1], t), d: (i - 1 + t) * GF.step });
        }
        if (inB(q)) fr.push(f);
      }
      // cross-section: lip on the plateau, rim, ledges down a steep wall, scree, the stream bed; mirrored
      const FL = -BASE + 0.1;
      const half = (d, e) => { // e = -1 left (north for a westward gorge), +1 right
        const a = n1(d * 2.4, e * 40, 1.0, 7) - 0.5, b = n2(d * 3.2, e * 30, 1.0, 3) - 0.5, c = n1(d * 6, e * 9, 1.0, 21) - 0.5;
        const w0 = GHW + 1.6, w1 = GHW - 0.05;
        return [
          [w0, 0.02], [w1 + 0.4, 0.02], [w1, -0.35], [w1 - 0.3 + a * 2.2 + c, -2.0], [w1 + 0.3 + b * 2.6, -3.6], [w1 - 1.6 + a * 2.0 - c, -4.8],
          [w1 - 0.8 + b * 2.4 + c, -7.0], [w1 - 2.4 + a * 2.2, -8.8], [w1 - 1.6 + b * 2.0 - c, -10.8], [w1 - 3.2 + a * 1.6, -12.6], [w1 - 4.3 + c, -14.6], [w1 - 5.6, FL + 0.25], [2.6, FL],
        ];
      };
      const pos = [], cl = [], idx = [];
      let NP = 0;
      fr.forEach((f) => {
        const L1 = half(f.d, -1), R1 = half(f.d, 1);
        const prof = L1.map(([o, y]) => [-o, y]).concat(R1.slice().reverse().map(([o, y]) => [o, y]));
        NP = prof.length;
        prof.forEach(([o, y]) => {
          pos.push(f.x + f.nx * o, y, f.z + f.nz * o);
          const depth = clamp(-y / BASE, 0, 1), k = (1 - Math.pow(depth, 0.8) * 0.7) * (0.88 + 0.2 * n1(f.d * 4, y * 3, 1.0, 2));
          cl.push(k * 0.98, k, k * 1.02);
        });
      });
      for (let i = 0; i < fr.length - 1; i++) for (let k = 0; k < NP - 1; k++) { const a = i * NP + k, b = a + 1, c2 = a + NP, d = c2 + 1; idx.push(a, b, c2, b, d, c2); }
      let g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(cl, 3));
      g.setIndex(idx); g.computeVertexNormals();
      g = g.toNonIndexed(); g.computeVertexNormals();
      const n = g.attributes.position.count, rk = new Float32Array(n), sn = new Float32Array(n), uv = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) { const y = g.attributes.position.getY(i); rk[i] = y > -0.1 ? 0 : y < FL + 0.2 ? 0.55 : 1; }
      g.setAttribute('aRock', new T.BufferAttribute(rk, 1)); g.setAttribute('aSnow', new T.BufferAttribute(sn, 1)); g.setAttribute('uv', new T.BufferAttribute(uv, 2));
      for (let i = 0; i < n; i++) { const p = g.attributes.position; uv[i * 2] = p.getX(i) / 6; uv[i * 2 + 1] = p.getZ(i) / 6; }
      const m = new T.Mesh(g, terrainMat); m.receiveShadow = true; m.castShadow = true; keep.push(m); K.group.add(m);
      // the stream in the gorge bed: glossy water with a moving ripple
      const resin = K.phys({ color: 0x3a6a62, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.04, normalMap: waterN, normalScale: V2(0.35), transparent: true, opacity: 0.88, envMapIntensity: 1.3 });
      A.water = waterN;
      const wp = [], wu = [], wi = [];
      fr.forEach((f) => { const hw = 2.4 + 0.6 * n1(f.d, 0, 0.1, 5); for (const e of [-1, 1]) { wp.push(f.x + f.nx * hw * e, FL + 0.22, f.z + f.nz * hw * e); wu.push(e * hw / 10 + 0.5, f.d / 10); } });
      for (let i = 0; i < fr.length - 1; i++) { const a = i * 2; wi.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      const wg = new T.BufferGeometry();
      wg.setAttribute('position', new T.Float32BufferAttribute(wp, 3)); wg.setAttribute('uv', new T.Float32BufferAttribute(wu, 2));
      wg.setIndex(wi); wg.computeVertexNormals();
      const wnr = wg.attributes.normal; for (let i = 0; i < wnr.count; i++) wnr.setXYZ(i, 0, 1, 0);
      const wm = new T.Mesh(wg, resin); wm.receiveShadow = true; wm.renderOrder = 1; keep.push(wm); K.group.add(wm);
      A.resin = resin;
      // boulders and scree down in the bed
      const bl = [];
      for (let i = 0; i < fr.length; i += 3) {
        const f = fr[i];
        for (let k = 0; k < 2; k++) { const o = (r() < 0.5 ? -1 : 1) * r.range(2.8, 4.6); bl.push({ x: f.x + f.nx * o, y: FL + 0.2, z: f.z + f.nz * o, s: r.range(0.35, 1.0), ry: r() * TAU, rx: r() * 3, color: r.pick([0x8a8a86, 0x6e6e6a, 0x9a968e]) }); }
      }
      A.gorgeBoulders = bl;
      // physics: the gorge is a chain of holes (cars fall in and land on the workbench level below)
      for (let i = 0; i < fr.length; i += 3) { const f = fr[i]; K.hole(f.x, f.z, GHW - 0.15); }
      A.gorgeFrames = fr;
      // dev check: the rim must stay clear of the road (3+ units at the gap, 4+ elsewhere)
      let worst = 99, ws = 0;
      for (const f of fr) { const d = roadD(f.x, f.z) - GHW; if (d < worst) { worst = d; ws = roadS(f.x, f.z); } }
      if (worst < 3.0) console.warn(`pass: gorge rim only ${worst.toFixed(1)} from the road at s=${ws.toFixed(0)}`);
    }

    // ---------------------------------------------------------------- the road: asphalt with painted lines, gravel shoulders, start line
    {
      const roadMat = K.std({ map: asphalt.map, normalMap: asphalt.normalMap, normalScale: V2(0.55), roughness: 0.86, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      const segU = 4, pos = [], uv = [], idx = [], rows = [];
      for (let s = 0; s < L - 0.01; s += 1) rows.push(s);
      rows.push(L);
      rows.forEach((s) => {
        const p = track.at(s);
        for (let j = 0; j <= segU; j++) { const u = j / segU, o = (u - 0.5) * p.w; pos.push(p.x + p.nx * o, 0.06, p.z + p.nz * o); uv.push(u, s / 16); }
      });
      for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < segU; j++) { const a = i * (segU + 1) + j, b = a + 1, cc = a + segU + 1, d = cc + 1; idx.push(a, b, cc, b, d, cc); }
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx); geo.computeVertexNormals();
      const nr = geo.attributes.normal; for (let i = 0; i < nr.count; i++) nr.setXYZ(i, 0, 1, 0);
      const m = new T.Mesh(geo, roadMat); m.receiveShadow = true; keep.push(m); K.group.add(m);
      // gravel shoulders (lighter than the verge, so the edge reads at speed)
      for (const t of Object.values(gravel)) t.repeat.set(1, 1);
      const shMat = K.std({ map: gravel.map, normalMap: gravel.normalMap, normalScale: V2(0.6), vertexColors: true, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
      for (const side of [-1, 1]) {
        const fr = roadFrames(0, L, side, 0, 1);
        const g = sweep(fr, [[-0.1, 0.045, 0.95], [0.7, 0.04, 1], [1.5, 0.02, 0.9]], { uS: 6, vS: 6 });
        const mm = new T.Mesh(g, shMat); mm.receiveShadow = true; keep.push(mm); K.group.add(mm);
      }
      // start / finish: a chequered band across the asphalt
      const c = TX.makeCanvas(256, 64), g2 = c.getContext('2d');
      for (let y = 0; y < 4; y++) for (let x = 0; x < 16; x++) { g2.fillStyle = (x + y) % 2 ? '#1b1b1b' : '#f2efe6'; g2.fillRect(x * 16, y * 16, 16, 16); }
      const p = track.at(S.start);
      const sm = K.mesh(new T.PlaneGeometry(p.w, 3.0), K.std({ map: TX.toTexture(c, { wrap: false }), roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), p.x, 0.09, p.z, { cast: false });
      sm.rotation.order = 'YXZ'; sm.rotation.y = -p.angle + PI / 2; sm.rotation.x = -PI / 2;
      keep.push(sm);
    }

    // ---------------------------------------------------------------- guard rails (galvanised W-beam on posts), with the gap over the gorge
    const railMat = K.std({ color: 0xe4e8ec, roughness: 0.28, metalness: 0.7, side: T.DoubleSide });
    const postList = [];
    const RAIL_OFF = 0.9;
    const rail = (s0, s1, side, { coll = true, ends = true } = {}) => {
      const fr = roadFrames(s0, s1, side, RAIL_OFF, 0.8);
      const g = sweep(fr, [[0.02, 0.6], [0.16, 0.68], [0.07, 0.82], [0.16, 0.96], [0.02, 1.04], [0.0, 1.04], [0.0, 0.6]], { uS: 4, vS: 1 });
      bake(g, railMat, fr[0].x, fr[0].z);
      for (let i = 0; i < fr.length; i += 3) { const f = fr[i]; postList.push({ x: f.x + f.nx * 0.3, y: 0.5, z: f.z + f.nz * 0.3, ry: -Math.atan2(f.nz, f.nx) }); }
      if (ends) for (const f of [fr[0], fr[fr.length - 1]]) postList.push({ x: f.x + f.nx * 0.3, y: 0.5, z: f.z + f.nz * 0.3, ry: -Math.atan2(f.nz, f.nx) });
      if (coll) for (let i = 0; i < fr.length - 3; i += 3) { const a = fr[i], b = fr[Math.min(fr.length - 1, i + 4)]; K.capsule(a.x + a.nx * 0.2, a.z + a.nz * 0.2, b.x + b.nx * 0.2, b.z + b.nz * 0.2, 0.3, 1.5); }
      return fr;
    };
    const GAP = { a: S.gap - 9, b: S.gap + 9 };
    A.gap = GAP;
    rail(S.ne + 92, GAP.a, -1);
    rail(GAP.b, S.bridge - 10, -1);
    rail(S.bridge + 10, L + S.hp1 + 17, -1); // along the start straight, leg 1 and round the outside of Kehre 1

    // ---------------------------------------------------------------- the switchbacks: spur walls, rock noses, upper-leg rails
    const masonryList = [];
    for (const sp of SPURS) {
      // masonry retaining wall along the inside edge of the leg below, its top following the spur
      const m0 = sp.a + 6, m1 = sp.na + 1.5;
      const fr = roadFrames(m0, m1, sp.side, WOFF, 0.8);
      const prof = (f) => {
        const t = TOP * spurTaper(sp, f.s) + 0.35;
        return [[0, -0.3, 0.86], [0.16, t, 0.97], [0.08, t + 0.04, 1.0], [0.08, t + 0.34, 1.1], [1.25, t + 0.34, 1.12], [1.25, t - 0.2, 1.0]];
      };
      const g = sweep(fr, prof, { uS: 4, vS: 2 });
      tint(g, 0xece6da);
      bake(g, stoneMat, fr[0].x, fr[0].z);
      masonryList.push(fr);
      for (let i = 0; i < fr.length - 3; i += 3) { const a = fr[i], b = fr[Math.min(fr.length - 1, i + 4)]; K.capsule(a.x + a.nx * 0.6, a.z + a.nz * 0.6, b.x + b.nx * 0.6, b.z + b.nz * 0.6, 0.6, 4); }
      // the rock nose round the inside of the hairpin
      const fn = roadFrames(sp.na - 1, sp.nb + 1, sp.side, WOFF + 0.4, 0.7);
      const rprof = (f) => {
        const a = n1(f.s * 1.3, sp.side * 20, 0.6, 3) - 0.5, b = n2(f.s * 0.9, 9, 0.5, 5) - 0.5;
        return [[0.6, -0.4], [0.1 + a * 0.6, 0.9], [0.5 + b * 0.8, 2.0], [0.0 + a * 0.7, 3.1 + b], [0.9 + b * 0.6, TOP + 1.6 + a * 1.4], [2.6, TOP + 1.9 + b], [4.2, TOP + 1.4]];
      };
      rockParts.push(sweep(fn, rprof, { uS: 4, vS: 2 }));
      for (let i = 0; i < fn.length - 3; i += 3) { const a = fn[i], b = fn[Math.min(fn.length - 1, i + 4)]; K.capsule(a.x + a.nx * 1.0, a.z + a.nz * 1.0, b.x + b.nx * 1.0, b.z + b.nz * 1.0, 0.85, 5); }
      // the leg above: guard rail along its inside edge, the spur's bank falling away behind it
      rail(sp.nb + 1, sp.b - 5, sp.side);
    }

    // ---------------------------------------------------------------- terrain rising beside the road stops cars (cliffs, banks)
    for (let s = 0; s < L; s += 2.5) {
      if (inS(s, S.gal0 - 3, S.gal1 + 3)) continue;
      const p = track.at(s);
      for (const side of [-1, 1]) {
        if (spurAt(p.x + p.nx * side * (p.w / 2 + 3), p.z + p.nz * side * (p.w / 2 + 3))) continue;
        for (let o = p.w / 2 + 1.2; o < p.w / 2 + 16; o += 0.8) {
          const x = p.x + p.nx * o * side, z = p.z + p.nz * o * side;
          const hh = gy(x, z);
          if (hh > 2.2 && (rockAt(x, z) > 0.35 || hh > 3.6)) { K.circle(x + p.nx * side * 1.0, z + p.nz * side * 1.0, 1.6, Math.max(5, hh)); break; }
          if (inGorge(x, z, 1)) break;
        }
      }
    }

    // ---------------------------------------------------------------- gravel run-offs: outside of Kehre 2 and 3 and the north-east corner
    const gravelMat = K.std({ map: gravel.map, normalMap: gravel.normalMap, normalScale: V2(0.8), roughness: 0.96, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const runoff = (s0, s1, side, depth) => {
      const poly = [], inner = [], outer = [];
      for (let s = s0; s <= s1 + 0.01; s += 2) {
        const p = track.at(s), k = Math.sin(clamp((s - s0) / (s1 - s0), 0, 1) * PI);
        const o1 = side * (p.w / 2 + 1.2), o2 = side * (p.w / 2 + 1.2 + depth * (0.35 + 0.65 * Math.sqrt(k)) + (n1(s, side, 0.4, 3) - 0.5) * 1.2);
        inner.push([p.x + p.nx * o1, p.z + p.nz * o1]); outer.push([p.x + p.nx * o2, p.z + p.nz * o2]);
      }
      poly.push(...inner, ...outer.reverse());
      K.flatShape(poly, gravelMat, 0.035);
      K.surface('slow', { poly });
      return { inner, outer };
    };
    const RO = ROSPEC.map(([a, b, side, dp]) => runoff(a, b, side, dp));
    A.runoffs = RO;

    // ---------------------------------------------------------------- the avalanche gallery: back wall, arcade, roof (fades while cars are inside)
    {
      const g0 = S.gal0, g1 = S.gal1;
      // back wall against the cliff (north = left side)
      const bw = roadFrames(g0 - 3, g1 + 3, -1, 0.5, 0.8);
      const wallG = sweep(bw, [[0, -0.2, 0.86], [0, 7.3, 0.96], [1.6, 7.3, 1.0], [1.6, -0.2, 0.9]], { uS: 4, vS: 2 });
      tint(wallG, 0xe2ddd2);
      bake(wallG, stoneMat, bw[0].x, bw[0].z);
      for (let i = 0; i < bw.length - 3; i += 3) { const a = bw[i], b = bw[Math.min(bw.length - 1, i + 4)]; K.capsule(a.x + a.nx * 0.7, a.z + a.nz * 0.7, b.x + b.nx * 0.7, b.z + b.nz * 0.7, 0.7, 8); }
      // roof slab + scree on top, and the arcade of stone arches on the valley side: one fading material each
      const roofMat = K.std({ map: grassTex.map, normalMap: grassTex.normalMap, vertexColors: true, roughness: 0.95, transparent: true, opacity: 1 });
      const arcMat = K.std({ map: masonry, vertexColors: true, roughness: 0.9, transparent: true, opacity: 1, side: T.DoubleSide });
      const fr = roadFrames(g0 - 1.5, g1 + 1.5, 1, 0, 0.8);
      const roofG = sweep(fr, (f) => { const w = track.at(f.s).w, a = 0.84 + 0.3 * n1(f.s * 3, 1, 1, 9), b = 0.84 + 0.3 * n1(f.s * 3, 7, 1, 2); return [[-w - 2.3, 7.2, 0.8], [-w - 2.3, 9.4, 1.25], [-w * 0.6, 8.9, a], [-w * 0.25, 8.6, b], [-0.3, 8.42, a * 0.95], [0.55, 8.3, 2.3], [0.9, 8.1, 2.4], [0.9, 6.9, 2.2]]; }, { uS: 6, vS: 6 });
      tint(roofG, 0xffffff);
      const roof = new T.Mesh(roofG, roofMat); roof.castShadow = true; roof.receiveShadow = true; keep.push(roof); K.group.add(roof);
      // arcade: one wall panel per bay with an arched opening, piers between
      const parts = [];
      const bays = 6, bl = (g1 - g0) / bays;
      for (let b = 0; b < bays; b++) {
        const sm = g0 + (b + 0.5) * bl, p = track.place(sm, track.at(sm).w / 2 + 1.1);
        const sh = new T.Shape();
        sh.moveTo(-bl / 2 - 0.02, -0.1); sh.lineTo(bl / 2 + 0.02, -0.1); sh.lineTo(bl / 2 + 0.02, 7.0); sh.lineTo(-bl / 2 - 0.02, 7.0); sh.closePath();
        const ho = new T.Path(), hw = bl / 2 - 0.75;
        ho.moveTo(-hw, -0.05); ho.lineTo(hw, -0.05); ho.lineTo(hw, 3.6); ho.absarc(0, 3.6, hw, 0, PI, false); ho.lineTo(-hw, -0.05);
        sh.holes.push(ho);
        const eg = new T.ExtrudeGeometry(sh, { depth: 1.1, bevelEnabled: false, curveSegments: 12 });
        eg.translate(0, 0, -0.55);
        colorize(eg, 0xe6e0d4);
        xf(eg, { x: p.x, y: 0, z: p.z, ry: -p.angle });
        parts.push(boxUV(eg, 4, 2, 0));
        // the piers stop cars
        const pq = track.place(g0 + b * bl, track.at(g0 + b * bl).w / 2 + 1.1);
        K.circle(pq.x, pq.z, 0.75, 7);
      }
      { const pq = track.place(g1, track.at(g1).w / 2 + 1.1); K.circle(pq.x, pq.z, 0.75, 7); }
      const arc = new T.Mesh(merge(parts), arcMat); arc.castShadow = true; arc.receiveShadow = true; keep.push(arc); K.group.add(arc);
      A.gallery = { s0: g0 - 2, s1: g1 + 2, mats: [roofMat, arcMat], meshes: [roof, arc] };
      // dark shade under the roof (soft, so the road stays readable)
      // the icy patch: meltwater from the cliff froze along the back wall, off the racing line
      const ip = track.place(g0 + 27, -(track.at(g0 + 27).w / 2 - 2.6));
      const ice = K.phys({ color: 0xdfeefa, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, opacity: 0.72, envMapIntensity: 1.6 });
      const icePoly = K.blobOutline(r, ip.x, ip.z, 3.6, 0.3, 32, 2.1, ip.angle);
      const im = K.flatShape(icePoly, ice, 0.1); im.renderOrder = 1; keep.push(im);
      K.surface('slick', { poly: icePoly });
      A.icePoly = icePoly;
      // icicles hanging from the roof edge above it, a frost rim along the wall foot
      for (let k = 0; k < 9; k++) { const q = track.place(g0 + 21 + k * 1.4, -(track.at(g0 + 21).w / 2 + 0.3)); prop(new T.ConeGeometry(0.16, 0.9 + r() * 0.8, 6).rotateX(PI), 0xe8f4ff, { x: q.x, y: 6.6, z: q.z }, vcSatin); }
      // the summit sign at the west portal (north side, against the cliff)
      const sq = track.place(g0 - 10, -(track.at(g0 - 10).w / 2 + 2.2));
      const sf = frame(sq.x, 0, sq.z, -sq.angle);
      for (const e of [-1, 1]) sf(new T.CylinderGeometry(0.12, 0.12, 4.2, 8), 0x8a8e94, { x: e * 1.5, y: 2.1 }, vcMetal);
      sf(new T.BoxGeometry(3.8, 1.9, 0.12), 0x5a3a24, { y: 3.4 }, vc);
      const sign = K.mesh(new T.PlaneGeometry(3.7, 1.8), labelMat(256, 124, (g) => {
        g.fillStyle = '#6a4024'; g.fillRect(0, 0, 256, 124); g.strokeStyle = '#f4ecd8'; g.lineWidth = 5; g.strokeRect(6, 6, 244, 112);
        g.fillStyle = '#f4ecd8'; g.textAlign = 'center'; g.font = '700 38px Rubik, Arial'; g.fillText('TORNA PASS', 128, 56); g.font = '700 30px Rubik, Arial'; g.fillText('2183 m', 128, 98);
      }), sq.x + Math.cos(sq.angle + PI / 2) * 0.08, 3.4, sq.z + Math.sin(sq.angle + PI / 2) * 0.08, { ry: -sq.angle, cast: false });
      void sign;
      K.circle(sq.x, sq.z, 0.5, 4);
    }

    // ---------------------------------------------------------------- the stream: channel, water, the old stone bridge, the waterfall
    {
      const fr = [];
      for (let i = 0; i <= SF.n; i++) { const q = SF.P[i]; fr.push({ x: q[0], z: q[1], nx: -SF.Tn[i][1], nz: SF.Tn[i][0], d: i * SF.step, y: 0 }); }
      const chan = sweep(fr, (f) => {
        const dp = sDepth(f.d), a = n1(f.d, 3, 0.5, 2) - 0.5;
        return [[-SHW - 1.2, 0.02, 1], [-SHW, -0.1, 0.9], [-SHW + 0.3 + a * 0.3, -dp * 0.6, 0.7], [-SHW * 0.45, -dp, 0.55], [SHW * 0.45, -dp, 0.55], [SHW - 0.3 - a * 0.3, -dp * 0.6, 0.7], [SHW, -0.1, 0.9], [SHW + 1.2, 0.02, 1]];
      }, { uS: 4, vS: 2 });
      rockParts.push(chan);
      const water = K.phys({ color: 0x3e7a78, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03, normalMap: waterN, normalScale: V2(0.4), transparent: true, opacity: 0.85, envMapIntensity: 1.3 });
      A.streamMat = water;
      const wp = [], wu = [], wi = [];
      fr.forEach((f) => { const dp = sDepth(f.d), y = -dp + 0.45, hw = SHW * 0.62; for (const e of [-1, 1]) { wp.push(f.x + f.nx * hw * e, y, f.z + f.nz * hw * e); wu.push(e * hw / 6 + 0.5, f.d / 6); } });
      for (let i = 0; i < fr.length - 1; i++) { const a = i * 2; wi.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      const wg = new T.BufferGeometry();
      wg.setAttribute('position', new T.Float32BufferAttribute(wp, 3)); wg.setAttribute('uv', new T.Float32BufferAttribute(wu, 2));
      wg.setIndex(wi); wg.computeVertexNormals();
      const wn = wg.attributes.normal; for (let i = 0; i < wn.count; i++) wn.setXYZ(i, 0, 1, 0);
      const wm = new T.Mesh(wg, water); wm.receiveShadow = true; wm.renderOrder = 1; keep.push(wm); K.group.add(wm);
      // off the road the stream is a wet, slow scramble
      const poly = [];
      for (const e of [-1, 1]) {
        const side = [];
        for (let i = 0; i < fr.length; i += 2) { const f = fr[i]; if (roadD(f.x, f.z) < 2.5) continue; side.push([f.x + f.nx * SHW * e, f.z + f.nz * SHW * e, f.d]); }
        poly.push(side);
      }
      // two water patches: lake side and gorge side of the road
      const sb = track.at(S.bridge);
      const sbA = strA(sb.x, sb.z);
      for (const part of [(q) => q[2] < sbA, (q) => q[2] > sbA]) {
        const a = poly[0].filter(part), b = poly[1].filter(part);
        if (a.length > 1 && b.length > 1) K.surface('water', { poly: a.map((q) => [q[0], q[1]]).concat(b.reverse().map((q) => [q[0], q[1]])) });
      }
      // the old stone bridge: segmental arch faces on both road edges, parapets with end piers
      const p = track.at(S.bridge);
      for (const side of [-1, 1]) {
        const half = 8.5;
        const pf = roadFrames(S.bridge - half, S.bridge + half, side, 0.15, 0.6);
        const pg = sweep(pf, [[0, -0.1, 0.85], [0, 1.25, 0.95], [-0.08, 1.3, 1.05], [-0.08, 1.48, 1.1], [0.88, 1.48, 1.1], [0.88, 1.3, 1.05], [0.8, 1.25, 0.95], [0.8, -2.8, 0.75]], { uS: 4, vS: 2 });
        tint(pg, 0xd8d0c0);
        bake(pg, stoneMat, pf[0].x, pf[0].z);
        for (let i = 0; i < pf.length - 3; i += 3) { const a = pf[i], b = pf[Math.min(pf.length - 1, i + 4)]; K.capsule(a.x + a.nx * 0.4, a.z + a.nz * 0.4, b.x + b.nx * 0.4, b.z + b.nz * 0.4, 0.45, 2.2); }
        for (const e of [-1, 1]) {
          const q = track.place(S.bridge + e * (half + 0.6), side * (track.at(S.bridge).w / 2 + 0.6));
          prop(new T.BoxGeometry(1.4, 2.0, 1.4), 0xd8d0c0, { x: q.x, y: 0.95, z: q.z, ry: -q.angle }, stoneMat);
          prop(new T.BoxGeometry(1.7, 0.3, 1.7), 0xe8e2d6, { x: q.x, y: 2.05, z: q.z, ry: -q.angle }, stoneMat);
          K.circle(q.x, q.z, 0.9, 3);
        }
      }
      // spandrel faces with the arch over the stream (across the road), seen from the valley side
      {
        const dp = sDepth(strA(p.x, p.z)), span = SHW * 2 + 0.6, rise = 1.5;
        const R = (span * span / 4 + rise * rise) / (2 * rise), springY = -dp + 0.6, cyy = springY + rise - R;
        const shape = new T.Shape();
        shape.moveTo(-9, -dp - 0.4); shape.lineTo(9, -dp - 0.4); shape.lineTo(9, 0.0); shape.lineTo(-9, 0.0); shape.closePath();
        const hole = new T.Path(), a0 = Math.asin(span / 2 / R);
        hole.moveTo(-span / 2, -dp - 0.5); hole.lineTo(span / 2, -dp - 0.5); hole.lineTo(span / 2, springY);
        hole.absarc(0, cyy, R, PI / 2 - a0, PI / 2 + a0, false); hole.lineTo(-span / 2, -dp - 0.5);
        shape.holes.push(hole);
        const wb = track.at(S.bridge).w + 1.8;
        const eg = new T.ExtrudeGeometry(shape, { depth: wb, bevelEnabled: false, curveSegments: 10 });
        eg.translate(0, 0, -wb / 2);
        colorize(eg, 0xd8d0c0);
        // local x along the stream (across the road), local z along the road
        const sa = Math.atan2(SF.Tn[Math.round(strA(p.x, p.z) / SF.step)][1], SF.Tn[Math.round(strA(p.x, p.z) / SF.step)][0]);
        xf(eg, { x: p.x, y: 0, z: p.z, ry: -sa });
        bake(boxUV(eg, 4, 2, -dp), stoneMat, p.x, p.z);
      }
      // the waterfall: from the stream's end down the north wall of the gorge into a foaming pool
      const end = fr[fr.length - 1];
      const fallTex = (() => {
        const c = TX.makeCanvas(64, 256), g = c.getContext('2d'), q = K.rng(55);
        const gr = g.createLinearGradient(0, 0, 64, 0); gr.addColorStop(0, 'rgba(200,226,236,0)'); gr.addColorStop(0.2, 'rgba(200,226,236,0.35)'); gr.addColorStop(0.5, 'rgba(220,238,244,0.5)'); gr.addColorStop(0.8, 'rgba(200,226,236,0.35)'); gr.addColorStop(1, 'rgba(200,226,236,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
        for (let i = 0; i < 160; i++) { const x = 6 + q() * 52; g.fillStyle = `rgba(255,255,255,${0.25 + q() * 0.6})`; g.fillRect(x, q() * 256, 0.8 + q() * 2, 14 + q() * 60); }
        return TX.toTexture(c);
      })();
      fallTex.repeat.set(1, 2);
      const fallMat = K.std({ map: fallTex, transparent: true, opacity: 1, roughness: 0.3, depthWrite: false, side: T.DoubleSide, emissive: 0x9ab8c4, emissiveIntensity: 0.2 });
      A.fallTex = fallTex;
      // the gorge centre nearest the stream's end, and the direction from it back up to the lip
      const ga = Math.round(gorA(end.x, end.z) / GF.step), gc = GF.P[ga], gn = [-GF.Tn[ga][1], GF.Tn[ga][0]];
      const up = (end.x - gc[0]) * gn[0] + (end.z - gc[1]) * gn[1] > 0 ? 1 : -1;
      const at = (o) => [gc[0] + gn[0] * o * up, gc[1] + gn[1] * o * up];
      const ac = [-gn[1] * up, gn[0] * up]; // along the rim
      const top = at(GHW + 0.3), bot = at(GHW - 4.9), wf = SHW * 0.75, yT = -sDepth(SF.len) + 0.45, yB = -BASE + 0.35;
      const fp = [top[0] - ac[0] * wf, yT, top[1] - ac[1] * wf, top[0] + ac[0] * wf, yT, top[1] + ac[1] * wf, bot[0] - ac[0] * wf * 1.3, yB, bot[1] - ac[1] * wf * 1.3, bot[0] + ac[0] * wf * 1.3, yB, bot[1] + ac[1] * wf * 1.3];
      const fg = new T.BufferGeometry();
      fg.setAttribute('position', new T.Float32BufferAttribute(fp, 3)); fg.setAttribute('uv', new T.Float32BufferAttribute([0, 1, 1, 1, 0, 0, 1, 0], 2));
      fg.setIndex([0, 2, 1, 1, 2, 3]); fg.computeVertexNormals();
      const fm = new T.Mesh(fg, fallMat); fm.renderOrder = 2; keep.push(fm); K.group.add(fm);
      // a ribbon of water over the lip
      const lip = at(GHW + 1.6);
      prop(new T.BoxGeometry(SHW * 1.5, 0.12, 1.4), 0xcfe6ee, { x: (lip[0] + top[0]) / 2, y: yT + 0.02, z: (lip[1] + top[1]) / 2, ry: -Math.atan2(ac[1], ac[0]) }, vcSatin, false);
      const foam = K.std({ color: 0xf4f8fa, roughness: 0.5, transparent: true, opacity: 0.8, depthWrite: false });
      const pool = at(GHW - 5.6);
      for (let k = 0; k < 7; k++) { const fmx = K.mesh(new T.CircleGeometry(r.range(0.7, 1.4), 14), foam, pool[0] + r.range(-1.8, 1.8), -BASE + 0.42, pool[1] + r.range(-1.2, 1.2), { rx: -PI / 2, cast: false }); fmx.renderOrder = 2; keep.push(fmx); }
      A.streamFrames = fr;
    }

    // ---------------------------------------------------------------- the alpine lake: resin water, pebble beach, reeds, a jetty and a rowing boat
    {
      const pts = [];
      for (let k = 0; k < 72; k++) {
        const ang = (k / 72) * TAU, rr = 1 + 0.12 * Math.sin(ang * 3 + 1.3) + 0.07 * Math.sin(ang * 5 + 0.4);
        const u = Math.cos(ang) * rr * LAKE.rx, v = Math.sin(ang) * rr * LAKE.rz, c = Math.cos(LAKE.a), s = Math.sin(LAKE.a);
        pts.push([LAKE.x + u * c - v * s, LAKE.z + u * s + v * c]);
      }
      const lakeMat = K.phys({ color: 0x2e6a78, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03, normalMap: waterN, normalScale: V2(0.3), transparent: true, opacity: 0.84, envMapIntensity: 1.4 });
      const lm = K.flatShape(pts, lakeMat, -0.38);
      lm.renderOrder = 1; keep.push(lm);
      A.lakeMat = lakeMat;
      K.surface('water', { poly: pts });
      // reeds on the south-west shore, pebbles all round, a few boulders
      const reeds = [], pebbles = [];
      for (let k = 0; k < 72; k++) {
        const [x, z] = pts[k], cx = x - LAKE.x, cz = z - LAKE.z, l = Math.hypot(cx, cz);
        for (let j = 0; j < 4; j++) { const o = r.range(-0.6, 1.8); pebbles.push({ x: x + (cx / l) * o + r.range(-0.8, 0.8), y: gy(x, z) + 0.05, z: z + (cz / l) * o + r.range(-0.8, 0.8), s: r.range(0.12, 0.34), ry: r() * TAU, color: r.pick([0xb8b4aa, 0x9a968e, 0xd0ccc2, 0x8a8a84]) }); }
        if ((k > 26 && k < 44) && r() < 0.8) for (let j = 0; j < 5; j++) reeds.push({ x: x - (cx / l) * r.range(0, 2) + r.range(-0.7, 0.7), y: -0.5, z: z - (cz / l) * r.range(0, 2) + r.range(-0.7, 0.7), sx: 0.12, sz: 0.12, sy: r.range(1.6, 2.8), rx: r.range(-0.15, 0.15), rz: r.range(-0.15, 0.15), color: r.pick([0x8a9a48, 0x9aaa58, 0xb0a860]) });
      }
      K.instances(new T.ConeGeometry(1, 1, 4).translate(0, 0.5, 0), K.std({ vertexColors: false, color: 0xffffff, roughness: 0.8 }), reeds, { colors: true, cast: false });
      A.pebbles = pebbles;
      // the jetty and the rowing boat on the north shore
      const jx = LAKE.x - 4, jz = LAKE.z - LAKE.rz * 0.92;
      const jf = frame(jx, 0, jz, 0.15);
      jf(new T.BoxGeometry(2.4, 0.22, 8), 0xe8dcc8, { y: 0.15, z: 3.4 }, woodMat);
      for (const [ex, ez] of [[-1.1, 0.4], [1.1, 0.4], [-1.1, 6.8], [1.1, 6.8]]) jf(new T.CylinderGeometry(0.14, 0.14, 1.4, 6), 0x5a4430, { x: ex, y: -0.4, z: ez }, vc);
      const bf = frame(jx + 2.6, -0.3, jz + 5.2, 0.5);
      const hull = K.lathe([[0.01, 0], [0.75, 0.05], [0.95, 0.5], [0.98, 0.62]], 14);
      bf(hull, 0xf0ece0, { sz: 2.4 }, vcSatin);
      bf(new T.BoxGeometry(1.7, 0.08, 0.35), 0x8a6a48, { y: 0.5 }, woodMat);
      bf(new T.BoxGeometry(0.08, 0.06, 2.6), 0x8a6a48, { x: 0.3, y: 0.62, ry: 0.3 }, woodMat);
      AO(jx + 2.6, jz + 5.2, 1.4, 2.6, 0.25, 0.5, -0.36);
      K.circle(jx, jz + 3.4, 1.4, 1);
    }

    // ---------------------------------------------------------------- the Gasthof Kehre: stone ground floor, timber upper floor, balcony, terrace
    const INN = { x: -12, z: 31, w: 17, d: 12 };
    {
      const { x: cx, z: cz } = INN, f = frame(cx, 0, cz, 0);
      const hw = INN.w / 2, hd = INN.d / 2;
      f(new T.BoxGeometry(INN.w, 4.2, INN.d), 0xf2eee6, { y: 2.1 }, stoneMat); // whitewashed rubble stone
      f(new T.BoxGeometry(INN.w + 0.1, 4.8, INN.d + 0.1), 0x9a6a44, { y: 6.6 }, woodMat); // larch boards
      // gable roof, ridge north-south (the gable end with its balcony faces the valley), wood shingles
      const pitch = 0.46, run = hw + 1.6, rise = Math.tan(pitch) * run, slab = run / Math.cos(pitch);
      const roofM = K.std({ map: shingleTex, vertexColors: true, roughness: 0.86 });
      for (const e of [-1, 1]) {
        const g = new T.BoxGeometry(slab, 0.45, INN.d + 3.4);
        const uvA = g.attributes.uv; for (let i = 0; i < uvA.count; i++) uvA.setXY(i, uvA.getX(i) * slab / 3, uvA.getY(i) * (INN.d + 3.4) / 3);
        f(g, 0xd8d2ca, { x: e * run / 2, y: 9.0 + rise / 2, rz: -e * pitch }, roofM);
      }
      // the gables (timber triangles), front and back
      const tri = new T.Shape(); tri.moveTo(-hw, 0); tri.lineTo(hw, 0); tri.lineTo(0, Math.tan(pitch) * hw); tri.closePath();
      for (const e of [-1, 1]) { const g = new T.ExtrudeGeometry(tri, { depth: 0.3, bevelEnabled: false }); g.translate(0, 9.0, e > 0 ? hd - 0.3 : -hd); f(g, 0x8a5c3a, {}, woodMat); }
      // ridge beam and a stone chimney
      f(new T.BoxGeometry(0.5, 0.5, INN.d + 3.6), 0x5a3a24, { y: 9.0 + rise + 0.15 }, vc);
      f(new T.BoxGeometry(1.4, 3.4, 1.4), 0xd8d2c8, { x: 3.6, y: 11.6, z: -2.4 }, stoneMat);
      f(new T.BoxGeometry(1.7, 0.3, 1.7), 0x8a8a86, { x: 3.6, y: 13.4, z: -2.4 }, vc);
      // windows with green shutters (ground floor and upper floor, south and side faces)
      const win = (x, y, z, ry, w = 1.3, h = 1.5) => {
        const fw = frame(cx + x, y, cz + z, ry);
        fw(new T.BoxGeometry(w + 0.3, h + 0.3, 0.12), 0xf6f2ea, { z: 0.02 }, vcSatin);
        fw(new T.BoxGeometry(w, h, 0.14), 0x1e2a32, { z: 0.04 }, vcSatin);
        fw(new T.BoxGeometry(w + 0.3, 0.12, 0.3), 0xf6f2ea, { y: -h / 2 - 0.1, z: 0.12 }, vcSatin);
        for (const e of [-1, 1]) fw(new T.BoxGeometry(w * 0.55, h + 0.1, 0.08), 0x2e6a3a, { x: e * (w / 2 + w * 0.32), z: 0.08 }, vcSatin);
      };
      for (const x of [-5.6, -2.0, 4.6]) win(x, 2.3, hd, 0);
      for (const x of [-5.6, -2.0, 2.0, 5.6]) win(x, 6.8, hd + 0.05, 0);
      for (const z of [-3, 1.5]) { win(hw + 0.05, 6.8, z, PI / 2); win(-hw - 0.05, 6.8, z, -PI / 2); win(hw, 2.3, z, PI / 2); }
      // door with a stone arch, a wooden sign board above it
      const fd = frame(cx + 1.4, 0, cz + hd, 0);
      fd(new T.BoxGeometry(1.8, 2.8, 0.2), 0x5a3a22, { y: 1.4, z: 0.05 }, woodMat);
      fd(new T.TorusGeometry(1.15, 0.22, 6, 12, PI), 0xd8d0c4, { y: 2.8, z: 0.12 }, vc);
      const board = K.mesh(new T.PlaneGeometry(6.4, 1.1), labelMat(512, 88, (g) => {
        g.fillStyle = '#4a2e1a'; g.fillRect(0, 0, 512, 88); g.strokeStyle = '#d8b878'; g.lineWidth = 4; g.strokeRect(5, 5, 502, 78);
        g.fillStyle = '#f2dcae'; g.textAlign = 'center'; g.font = '700 50px Georgia, serif'; g.fillText('Gasthof Kehre', 256, 62);
      }), cx, 3.75, cz + hd + 0.08, { cast: false });
      void board;
      // the balcony across the gable, with geraniums in flower boxes
      const fb = frame(cx, 0, cz + hd, 0);
      fb(new T.BoxGeometry(INN.w + 0.6, 0.25, 1.8), 0x7a5234, { y: 4.55, z: 0.9 }, woodMat);
      fb(new T.BoxGeometry(INN.w + 0.6, 1.0, 0.12), 0x8a5c3a, { y: 5.2, z: 1.75 }, woodMat);
      fb(new T.BoxGeometry(INN.w + 0.6, 0.14, 0.2), 0x5a3a24, { y: 5.75, z: 1.75 }, vc);
      fb(new T.BoxGeometry(INN.w - 1, 0.42, 0.42), 0x6a4a2a, { y: 5.95, z: 1.75 }, vc);
      const ger = [];
      for (let k = 0; k < 46; k++) ger.push({ x: cx + r.range(-hw + 0.2, hw - 0.2), y: 6.25 + r.range(0, 0.25), z: cz + hd + 1.75 + r.range(-0.2, 0.2), s: r.range(0.16, 0.28), color: r.pick([0xd8243a, 0xe83a52, 0xc81830, 0xf05a78, 0x3a7a2a, 0x4a8a34]) });
      for (const z of [-3, 1.5]) for (let k = 0; k < 6; k++) ger.push({ x: cx + hw + 0.4, y: 6.0 + r.range(0, 0.2), z: cz + z + r.range(-0.8, 0.8), s: r.range(0.15, 0.25), color: r.pick([0xd8243a, 0xe83a52, 0x3a7a2a]) });
      K.instances(new T.IcosahedronGeometry(1, 0), K.std({ color: 0xffffff, roughness: 0.6 }), ger, { colors: true, cast: false });
      AO(cx, cz, hw + 1.5, hd + 1.5, 0.5);
      K.box(cx, cz, hw + 0.2, hd + 0.2, 0, 14);
      block(cx, cz, hw + 1, hd + 4);
      // terrace in front: flagstones, tables with red-and-white parasols, benches
      const fl = TX.labelTexture(256, 128, (g) => { g.fillStyle = '#8a847a'; g.fillRect(0, 0, 256, 128); const q = K.rng(3); for (let y = 0; y < 4; y++) for (let x = 0; x < 6; x++) { const k = 0.8 + q() * 0.3; g.fillStyle = `rgb(${190 * k | 0},${182 * k | 0},${168 * k | 0})`; g.fillRect(x * 43 + 2, y * 32 + 2, 39, 28); } }, { wrap: true });
      K.mesh(new T.PlaneGeometry(INN.w + 2, 5.4), K.std({ map: fl, roughness: 0.9 }), cx, 0.05, cz + hd + 2.9, { rx: -PI / 2, cast: false });
      const para = TX.labelTexture(128, 32, (g) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f4f0e8' : '#c8242e'; g.fillRect(i * 16, 0, 16, 32); } });
      const paraMat = K.std({ map: para, roughness: 0.7, side: T.DoubleSide });
      for (const [tx, tz] of [[-5.5, 3.0], [0.2, 3.4], [5.8, 2.8]]) {
        const ft = frame(cx + tx, 0, cz + hd + tz, r() * 2);
        ft(new T.CylinderGeometry(0.75, 0.75, 0.1, 14), 0x8a5c3a, { y: 0.95 }, woodMat);
        ft(new T.CylinderGeometry(0.07, 0.07, 3.0, 6), 0xe8e4dc, { y: 1.5 }, vcSatin);
        for (const e of [-1, 1]) ft(new T.BoxGeometry(1.6, 0.1, 0.4), 0x7a5234, { y: 0.55, z: e * 1.15 }, woodMat);
        const pm = K.mesh(new T.ConeGeometry(1.9, 0.75, 16, 1, true), paraMat, cx + tx, 3.0, cz + hd + tz, {});
        void pm;
        AO(cx + tx, cz + hd + tz, 1.6, 1.6, 0.3);
      }
    }

    // ---------------------------------------------------------------- the car park (with a few parked cars) and the viewpoint over the gorge
    {
      const x0 = -32, x1 = 6, z0 = 43.5, z1 = 53.5;
      const c = TX.makeCanvas(512, 136), g = c.getContext('2d');
      const q = K.rng(17);
      g.fillStyle = '#4a4b4e'; g.fillRect(0, 0, 512, 136);
      for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${q() < 0.5 ? '255,255,255' : '0,0,0'},${0.04 + q() * 0.06})`; g.fillRect(q() * 512, q() * 136, 2, 2); }
      g.fillStyle = 'rgba(240,240,232,0.85)';
      for (let k = 0; k <= 9; k++) g.fillRect(12 + k * 52, 6, 4, 58);
      g.fillRect(12, 6, 472, 3);
      const cpMat = K.std({ map: TX.toTexture(c, { wrap: false }), roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
      K.mesh(new T.PlaneGeometry(x1 - x0, z1 - z0), cpMat, (x0 + x1) / 2, 0.04, (z0 + z1) / 2, { rx: -PI / 2, cast: false });
      K.surface('normal', { poly: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]] });
      // bollards along the road side, an opening in the middle
      for (let x = x0 + 1; x <= x1 - 1; x += 3.2) {
        if (x > -15 && x < -8) continue;
        prop(new T.CylinderGeometry(0.22, 0.25, 1.1, 8), 0xe8e4dc, { x, y: 0.55, z: z1 + 0.6 }, vcSatin);
        prop(new T.CylinderGeometry(0.26, 0.26, 0.2, 8), 0xc8242e, { x, y: 0.9, z: z1 + 0.6 }, vcSatin);
        K.circle(x, z1 + 0.6, 0.3, 1.2);
      }
      // parked cars: little generic hatchbacks
      const car = (x, z, ry, col) => {
        const fc = frame(x, 0, z, ry);
        fc(new K.RoundedBoxGeometry(4.0, 1.1, 1.9, 2, 0.35), col, { y: 0.8 }, vcSatin);
        fc(new K.RoundedBoxGeometry(2.3, 0.8, 1.7, 2, 0.3), col, { x: -0.3, y: 1.6 }, vcSatin);
        fc(new T.BoxGeometry(2.2, 0.62, 1.74), 0x1e2630, { x: -0.3, y: 1.62 }, vcSatin);
        for (const [wx, wz] of [[1.3, 0.85], [-1.3, 0.85], [1.3, -0.85], [-1.3, -0.85]]) fc(new T.CylinderGeometry(0.38, 0.38, 0.3, 12).rotateX(PI / 2), 0x1a1a1a, { x: wx, y: 0.38, z: wz }, vc);
        AO(x, z, 2.4, 1.3, 0.45, ry);
        K.box(x, z, 2.0, 1.0, -ry, 2.2);
      };
      car(-27.5, 47.5, PI / 2 + 0.04, 0x2a5aa8); car(-22.3, 47.4, PI / 2 - 0.05, 0xd8d4c8); car(-1.6, 47.6, PI / 2 + 0.03, 0xb8302a);
      block((x0 + x1) / 2, (z0 + z1) / 2, (x1 - x0) / 2 + 1, (z1 - z0) / 2 + 1);
      // the viewpoint: a flagstone terrace on the gorge rim, a railing, a coin telescope and a bench
      const vs = sAt(-14, 66), vp = track.place(vs, -(track.at(vs).w / 2 + 6.4));
      const vf = frame(vp.x, 0, vp.z, -vp.angle);
      vf(new T.BoxGeometry(9, 0.12, 4.2), 0xf4efe6, { y: 0.04 }, stoneMat);
      for (let k = -4; k <= 4; k += 2) vf(new T.CylinderGeometry(0.07, 0.07, 1.1, 6), 0x3a3e44, { x: k, y: 0.6, z: -2.0 }, vcMetal);
      vf(new T.BoxGeometry(8.4, 0.1, 0.1), 0x3a3e44, { y: 1.1, z: -2.0 }, vcMetal);
      vf(new T.CylinderGeometry(0.12, 0.16, 1.4, 8), 0x2a6a3a, { x: 2, y: 0.7, z: -1.0 }, vcMetal);
      vf(new T.CylinderGeometry(0.22, 0.3, 0.9, 10).rotateX(PI / 2 - 0.2), 0x2a6a3a, { x: 2, y: 1.55, z: -1.0 }, vcMetal);
      vf(new T.BoxGeometry(2.6, 0.12, 0.6), 0x8a5c3a, { x: -2, y: 0.55, z: -0.4 }, woodMat);
      vf(new T.BoxGeometry(2.6, 0.5, 0.1), 0x8a5c3a, { x: -2, y: 0.95, z: -0.7 }, woodMat);
      AO(vp.x, vp.z, 5, 2.4, 0.25, vp.angle);
      block(vp.x, vp.z, 5, 2.6, vp.angle);
    }

    // ---------------------------------------------------------------- the chairlift: valley station, pylons, cables, chairs going round
    {
      const ax = LIFT.x0, az = LIFT.z0, bx = LIFT.x1, bz = LIFT.z1;
      const len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len, px = -uz, pz = ux; // along, across
      const sup = [[0, 6.6], [0.22, 21], [0.52, 24], [0.86, 20], [1, 6.5]]; // fraction along, height above ground
      const pts = sup.map(([t, h]) => { const x = ax + ux * len * t, z = az + uz * len * t; return { t, x, z, g: gy(x, z), h }; });
      // raise supports so the cable keeps 7 units over the ground (and 20 over the road it crosses)
      for (let it = 0; it < 3; it++) for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        for (let k = 1; k < 20; k++) {
          const f = k / 20, x = lerp(a.x, b.x, f), z = lerp(a.z, b.z, f), y = lerp(a.g + a.h, b.g + b.h, f);
          const need = gy(x, z) + (roadD(x, z) < 2 ? 18 : 7);
          if (y < need) { const add = need - y; if (i + 1 < pts.length - 1) b.h += add * (f > 0.4 ? 1 : 0.5); if (i > 0) a.h += add * (f <= 0.6 ? 1 : 0.5); }
        }
      }
      A.lift = { pts, ux, uz, px, pz, len };
      const steel = 0x8e9298;
      // valley and top stations: concrete base, a roof, the big horizontal bull wheel
      for (const [i, ry] of [[0, 0], [pts.length - 1, PI]]) {
        const p = pts[i], fs = frame(p.x, p.g, p.z, -Math.atan2(uz, ux) + ry);
        fs(new T.BoxGeometry(7, 3.6, 6), 0xd8d4cc, { x: -1.6, y: 1.8 }, stoneMat);
        fs(new T.BoxGeometry(8.4, 0.4, 7.4), 0x5a6068, { x: -1.4, y: p.h + 1.6 }, vcMetal);
        for (const [ex, ez] of [[-4.6, -3.2], [-4.6, 3.2], [2.2, -3.2], [2.2, 3.2]]) fs(new T.CylinderGeometry(0.18, 0.18, p.h + 1.6, 8), steel, { x: ex, y: (p.h + 1.6) / 2, z: ez }, vcMetal);
        fs(new T.CylinderGeometry(1.75, 1.75, 0.3, 24), 0xc8302a, { x: 1.0, y: p.h }, vcMetal);
        fs(new T.CylinderGeometry(0.3, 0.3, 1.2, 10), steel, { x: 1.0, y: p.h + 0.7 }, vcMetal);
        AO(p.x, p.z, 5, 4.5, 0.45);
        K.box(p.x - ux * 1.6, p.z - uz * 1.6, 3.6, 3.1, Math.atan2(uz, ux), p.g + 5);
        block(p.x, p.z, 6, 6);
      }
      // pylons: a tapered steel tube with a crossarm and sheave trains
      for (let i = 1; i < pts.length - 1; i++) {
        const p = pts[i], fp = frame(p.x, p.g - 0.3, p.z, -Math.atan2(uz, ux));
        fp(new T.CylinderGeometry(0.42, 0.62, p.h + 0.3, 10), steel, { y: (p.h + 0.3) / 2 }, vcMetal);
        fp(new T.BoxGeometry(0.4, 0.4, 4.8), steel, { y: p.h + 0.3 }, vcMetal);
        for (const e of [-1, 1]) fp(new T.BoxGeometry(1.6, 0.35, 0.3), 0x3a3e44, { y: p.h + 0.05, z: e * 1.75 }, vcMetal);
        fp(new T.CylinderGeometry(0.9, 0.9, 0.4, 12), 0xd8d4cc, { y: 0.0 }, stoneMat);
        AO(p.x, p.z, 1.6, 1.6, 0.5);
        K.circle(p.x, p.z, 0.8, p.g + p.h);
        block(p.x, p.z, 1.5, 1.5);
      }
      // cables: the up line and the down line, 1.75 to each side of the centreline
      const cable = K.std({ color: 0x2a2a2c, roughness: 0.5, metalness: 0.6 });
      const cg = [];
      for (const e of [-1, 1]) for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const v1 = new T.Vector3(a.x + px * e * 1.75, a.g + a.h + 0.15, a.z + pz * e * 1.75), v2 = new T.Vector3(b.x + px * e * 1.75, b.g + b.h + 0.15, b.z + pz * e * 1.75);
        const d = v2.clone().sub(v1), l = d.length();
        const g = new T.CylinderGeometry(0.06, 0.06, l, 5, 1, true);
        g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.clone().normalize()));
        g.translate((v1.x + v2.x) / 2, (v1.y + v2.y) / 2, (v1.z + v2.z) / 2);
        cg.push(g);
      }
      const cm = new T.Mesh(merge(cg), cable); cm.castShadow = true; keep.push(cm); K.group.add(cm);
      // chairs: hanger, seat, backrest, footrest; instanced and moved round the loop in animate()
      const P = [];
      P.push(colorize(new T.CylinderGeometry(0.05, 0.05, 2.6, 5).translate(0, -1.3, 0), 0x3a3e44));
      P.push(colorize(new T.BoxGeometry(0.9, 0.12, 1.5).translate(0.1, -2.6, 0), 0xffffff));
      P.push(colorize(new T.BoxGeometry(0.12, 0.8, 1.5).translate(-0.32, -2.15, 0), 0xffffff));
      P.push(colorize(new T.BoxGeometry(0.06, 0.06, 1.5).translate(0.62, -2.9, 0), 0x3a3e44));
      const chairGeo = merge(P);
      const NCH = 26;
      const list = []; for (let i = 0; i < NCH; i++) list.push({ x: 0, y: -50, z: 0, color: [0xc8302a, 0x2a5aa8, 0xe8b830, 0x2a8a4a][i % 4] });
      const chairs = K.instances(chairGeo, K.phys({ vertexColors: true, roughness: 0.45, clearcoat: 0.4 }), list, { colors: true });
      chairs.frustumCulled = false; keep.push(chairs);
      // the loop: up on the east line (e = +1), round the top wheel, down the west line
      const segs = [];
      let acc = 0;
      for (const e of [1, -1]) {
        const seq = e > 0 ? pts : pts.slice().reverse();
        for (let i = 0; i < seq.length - 1; i++) {
          const a = seq[i], b = seq[i + 1];
          const v1 = [a.x + px * e * 1.75, a.g + a.h + 0.15, a.z + pz * e * 1.75], v2 = [b.x + px * e * 1.75, b.g + b.h + 0.15, b.z + pz * e * 1.75];
          const l = Math.hypot(v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2]);
          segs.push({ v1, v2, l, a0: acc, dir: Math.atan2(v2[2] - v1[2], v2[0] - v1[0]) }); acc += l;
        }
      }
      A.chairs = { im: chairs, segs, total: acc, n: NCH, m4: new T.Matrix4(), q: new T.Quaternion(), e: new T.Euler(), v: new T.Vector3(), one: new T.Vector3(1, 1, 1) };
    }

    // ---------------------------------------------------------------- signs: hairpin numbers, a curve warning before the gap, chevrons, km stones
    {
      const plate = (s, side, off, draw, extra = {}, wd = 1.7, ht = 1.7, h = 2.6) => {
        const p = track.place(s, side * (track.at(s).w / 2 + off));
        const fs = frame(p.x, 0, p.z, -p.angle);
        fs(new T.CylinderGeometry(0.08, 0.08, h, 6), 0x9aa0a8, { y: h / 2 }, vcMetal);
        // the plate faces somewhere between the oncoming driver and the camera
        const m = K.mesh(new T.PlaneGeometry(wd, ht), labelMat(128, Math.round(128 * ht / wd), draw, extra), p.x, h, p.z, { cast: true });
        m.rotation.set(0, Math.atan2(-p.tx * 0.55, -p.tz * 0.55 + 1), 0);
        const back = K.mesh(new T.PlaneGeometry(wd, ht), signBack, p.x, h, p.z, { cast: false });
        back.rotation.copy(m.rotation);
        K.circle(p.x, p.z, 0.25, h);
        return p;
      };
      const signBack = K.std({ color: 0x8a8e94, roughness: 0.5, side: T.BackSide });
      const hairpinSign = (n, right) => (g) => {
        g.fillStyle = '#f6f4ee'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#1e5aa8'; g.lineWidth = 10; g.strokeRect(5, 5, 118, 118);
        g.strokeStyle = '#1a1a1a'; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath();
        const sx = right ? 1 : -1;
        g.moveTo(64 - sx * 22, 100); g.lineTo(64 - sx * 22, 56); g.arc(64, 56, 22, PI, 0, false); g.lineTo(64 + sx * 22, 74); g.stroke();
        g.fillStyle = '#1a1a1a'; g.beginPath(); g.moveTo(64 + sx * 22 - 11, 70); g.lineTo(64 + sx * 22 + 11, 70); g.lineTo(64 + sx * 22, 88); g.closePath(); g.fill();
        g.fillStyle = '#c8242e'; g.font = '700 30px Rubik, Arial'; g.textAlign = 'center'; g.fillText(String(n), 64, 36);
      };
      plate(S.hp1 - 40, -1, 2.0, hairpinSign(1, true));
      plate(S.hp2 - 40, 1, 2.4, hairpinSign(2, false));
      plate(S.hp3 - 40, -1, 2.4, hairpinSign(3, true));
      // warning before the corner over the gorge: a red-bordered triangle with a right bend
      plate(GAP.a - 46, 1, 2.0, (g) => {
        g.fillStyle = 'rgba(0,0,0,0)'; g.clearRect(0, 0, 128, 128);
        g.fillStyle = '#c8242e'; g.beginPath(); g.moveTo(64, 6); g.lineTo(124, 118); g.lineTo(4, 118); g.closePath(); g.fill();
        g.fillStyle = '#f6f4ee'; g.beginPath(); g.moveTo(64, 30); g.lineTo(106, 106); g.lineTo(22, 106); g.closePath(); g.fill();
        g.strokeStyle = '#1a1a1a'; g.lineWidth = 7; g.beginPath(); g.moveTo(52, 100); g.lineTo(52, 74); g.quadraticCurveTo(52, 58, 72, 58); g.stroke();
        g.fillStyle = '#1a1a1a'; g.beginPath(); g.moveTo(70, 48); g.lineTo(84, 58); g.lineTo(70, 68); g.closePath(); g.fill();
      }, { transparent: true, alphaTest: 0.5 });
      // a direction post at the car park: arrow boards to the next village and to the summit
      {
        const q = track.place(sAt(12, 66), track.at(sAt(12, 66)).w / 2 + 2.4);
        prop(new T.CylinderGeometry(0.12, 0.14, 4.4, 8), 0x9aa0a8, { x: q.x, y: 2.2, z: q.z }, vcMetal);
        const arrow = (txt, sub, right) => (g) => {
          g.clearRect(0, 0, 256, 64); g.fillStyle = '#f4f2ea'; g.beginPath();
          if (right) { g.moveTo(4, 6); g.lineTo(220, 6); g.lineTo(252, 32); g.lineTo(220, 58); g.lineTo(4, 58); } else { g.moveTo(252, 6); g.lineTo(36, 6); g.lineTo(4, 32); g.lineTo(36, 58); g.lineTo(252, 58); }
          g.closePath(); g.fill(); g.strokeStyle = '#1e4a8a'; g.lineWidth = 5; g.stroke();
          g.fillStyle = '#1e3a6a'; g.font = '700 26px Rubik, Arial'; g.textAlign = 'center'; g.fillText(txt, right ? 112 : 144, 31); g.font = '20px Rubik, Arial'; g.fillText(sub, right ? 112 : 144, 52);
        };
        for (const [k, txt, sub, right] of [[0, 'Valbrina', '12 km', true], [1, 'Torna Pass', '3 km', false]]) {
          const m = K.mesh(new T.PlaneGeometry(3.2, 0.8), labelMat(256, 64, arrow(txt, sub, right), { transparent: true, alphaTest: 0.5, side: T.DoubleSide }), q.x + (right ? 1.5 : -1.5), 3.9 - k * 0.95, q.z + 0.15, { cast: true });
          void m;
        }
        K.circle(q.x, q.z, 0.3, 4.4);
      }
      // red-and-white chevron boards behind the run-offs and on the gorge corner
      const chevMat = labelMat(128, 64, (g) => { g.fillStyle = '#c8242e'; g.fillRect(0, 0, 128, 64); g.fillStyle = '#f6f4ee'; for (let i = -1; i < 5; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32 + 16, 0); g.lineTo(i * 32 + 32, 32); g.lineTo(i * 32 + 16, 64); g.lineTo(i * 32, 64); g.lineTo(i * 32 + 16, 32); g.closePath(); g.fill(); } });
      const chev = (x, z, ang) => {
        const m = K.mesh(new T.PlaneGeometry(2.2, 1.1), chevMat, x, 1.5, z, {}); m.rotation.set(0, -ang, 0);
        for (const e of [-1, 1]) prop(new T.CylinderGeometry(0.07, 0.07, 1.5, 6), 0x9aa0a8, { x: x + Math.cos(ang) * e * 0.9, y: 0.75, z: z + Math.sin(ang) * e * 0.9 }, vcMetal);
        K.circle(x, z, 0.4, 2);
      };
      for (const ro of RO) for (let i = 4; i < ro.outer.length - 4; i += 5) {
        const [x, z] = ro.outer[i], [x2, z2] = ro.outer[i + 1];
        chev(x + (x - ro.inner[i][0]) * 0.08, z + (z - ro.inner[i][1]) * 0.08, Math.atan2(z2 - z, x2 - x));
      }
      // kilometre stones: white with a red cap, on the right every 120 units
      const kms = [];
      for (let s = 30; s < L; s += 120) {
        const p = track.place(s, track.at(s).w / 2 + 1.7);
        if (inS(s, S.gal0 - 4, S.gal1 + 4) || !K.offRoad(p.x, p.z, 1) || inGorge(p.x, p.z, 2) || spurAt(p.x, p.z)) continue;
        kms.push({ x: p.x, y: 0.5, z: p.z, ry: -p.angle, color: 0xf4f2ec }, { x: p.x, y: 1.05, z: p.z, ry: -p.angle, sy: 0.25, color: 0xc8242e });
      }
      K.instances(new K.RoundedBoxGeometry(0.7, 1.0, 0.35, 2, 0.12), K.std({ color: 0xffffff, roughness: 0.7 }), kms, { colors: true });
    }

    // ---------------------------------------------------------------- the gap in the rail: bent rail ends, striped marker posts, a lost rail section in the gorge
    {
      for (const s of [GAP.a, GAP.b]) {
        const p = track.place(s, -(track.at(s).w / 2 + RAIL_OFF + 0.3));
        prop(new T.CylinderGeometry(0.16, 0.16, 1.6, 8), 0xf6f4ee, { x: p.x, y: 0.8, z: p.z }, vcSatin);
        for (let k = 0; k < 3; k++) prop(new T.CylinderGeometry(0.17, 0.17, 0.22, 8), 0xc8242e, { x: p.x, y: 0.4 + k * 0.45, z: p.z }, vcSatin);
        K.circle(p.x, p.z, 0.3, 1.6);
      }
      // the missing section lies on a ledge below the rim
      const q = track.place(S.gap, -(track.at(S.gap).w / 2 + 9.5));
      prop(new T.BoxGeometry(9, 0.38, 0.12), 0xb8bcc0, { x: q.x, y: -4.6, z: q.z, ry: -q.angle + 0.2, rz: 0.25 }, vcMetal);
      // tyre marks running over the edge
      const sk = K.std({ color: 0x141414, roughness: 0.95, transparent: true, opacity: 0.6, depthWrite: false });
      for (const e of [-1, 1]) {
        const a = track.place(S.gap - 14, -(track.at(S.gap).w / 2 - 4.0 + e * 0.9)), b = track.place(S.gap + 1, -(track.at(S.gap).w / 2 + 3.4 + e * 0.9));
        const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, l = Math.hypot(b.x - a.x, b.z - a.z);
        const m = K.mesh(new T.PlaneGeometry(l, 0.42), sk, mx, 0.1, mz, { cast: false }); m.rotation.set(-PI / 2, 0, -Math.atan2(b.z - a.z, b.x - a.x)); m.renderOrder = 1; keep.push(m);
      }
    }

    // ---------------------------------------------------------------- snow poles along the edges (orange and black, as on every pass road)
    {
      const poles = [], tips = [];
      for (const side of [-1, 1]) {
        for (let s = 3 + (side > 0 ? 6 : 0); s < L; s += 13) {
          if (inS(s, S.gal0 - 3, S.gal1 + 3) || inS(s, S.bridge - 11, S.bridge + 11)) continue;
          const p = track.place(s, side * (track.at(s).w / 2 + 2.0));
          if (!K.offRoad(p.x, p.z, 1.2) || inGorge(p.x, p.z, 1.2) || gy(p.x, p.z) > 0.8 || inStream(p.x, p.z, 1)) continue;
          if (spurAt(p.x, p.z)) continue;
          poles.push({ x: p.x, y: 1.0, z: p.z, color: 0xe86a1a }); tips.push({ x: p.x, y: 2.05, z: p.z, color: 0x1a1a1a });
        }
      }
      const pg = new T.CylinderGeometry(0.075, 0.075, 2.0, 6);
      K.instances(pg, K.std({ color: 0xffffff, roughness: 0.5 }), poles, { colors: true });
      K.instances(new T.CylinderGeometry(0.08, 0.08, 0.3, 6), K.std({ color: 0xffffff, roughness: 0.5 }), tips, { colors: true });
    }

    // the rock parts (noses, stream channel) share the terrain material
    {
      const rg = BU.mergeGeometries(rockParts.map((g) => rockify(g)), false);
      const m = new T.Mesh(rg, terrainMat); m.castShadow = true; m.receiveShadow = true; keep.push(m); K.group.add(m);
    }
    // guard rail posts
    K.instances(new T.BoxGeometry(0.18, 1.0, 0.3), K.std({ color: 0xb4b8bc, roughness: 0.4, metalness: 0.7 }), postList);

    // ---------------------------------------------------------------- trees (spruce and golden larch), dwarf pines, boulders, scree, flowers, grass
    {
      const flock = (() => {
        const Sz = 256, h = new Float32Array(Sz * Sz), q = K.rng(17);
        const fA = TX.noiseField(Sz, { seed: 19, period: 22, oct: 2 });
        for (let i = 0; i < h.length; i++) h[i] = fA[i] * 0.8 + q() * 0.2;
        return TX.toTexture(TX.normalFromHeight(h, Sz, Sz, 3.2), { srgb: false });
      })();
      const treeMat = K.std({ vertexColors: true, roughness: 0.95, normalMap: flock, normalScale: V2(0.7) });
      const coneUV = (g) => { const p = g.attributes.position, uv = new Float32Array(p.count * 2); for (let i = 0; i < p.count; i++) { uv[i * 2] = (p.getX(i) + p.getZ(i) * 0.6) * 6; uv[i * 2 + 1] = (p.getY(i) - p.getZ(i) * 0.3) * 6; } g.setAttribute('uv', new T.BufferAttribute(uv, 2)); return g; };
      const spruceGeo = (() => { // unit height: a slender spruce with drooping tiers
        const P = [];
        P.push(colorize(new T.CylinderGeometry(0.012, 0.025, 0.24, 5, 1, true).translate(0, 0.12, 0), 0x4a3424));
        const tiers = 6;
        for (let k = 0; k < tiers; k++) {
          const t = k / tiers, rad = 0.21 * (1 - t * 0.86) + 0.012, y0 = 0.1 + t * 0.8, hgt = 0.27 - t * 0.09;
          const g = new T.ConeGeometry(rad, hgt, 8, 1, true);
          const p = g.attributes.position;
          for (let i = 0; i < p.count; i++) if (p.getY(i) < 0) { const a = Math.atan2(p.getZ(i), p.getX(i)), j = 1 + 0.16 * Math.sin(a * 4 + k * 1.7); p.setXYZ(i, p.getX(i) * j, p.getY(i) - 0.02 * (1 + Math.sin(a * 3 + k)), p.getZ(i) * j); }
          g.rotateY(k * 0.7); g.translate(0, y0 + hgt / 2, 0); g.computeVertexNormals();
          coneUV(g);
          P.push(colorize(g, new T.Color(1, 1, 1).multiplyScalar(0.72 + t * 0.36)));
        }
        return merge(P);
      })();
      const larchGeo = (() => { // a looser, lighter cone with gaps between whorls
        const P = [];
        P.push(colorize(new T.CylinderGeometry(0.01, 0.022, 0.5, 5, 1, true).translate(0, 0.25, 0), 0x5a4030));
        for (let k = 0; k < 6; k++) {
          const t = k / 6, rad = 0.17 * (1 - t * 0.82) + 0.02, y0 = 0.2 + t * 0.7, hgt = 0.17 - t * 0.04;
          const g = new T.ConeGeometry(rad, hgt, 7, 1, true);
          const p = g.attributes.position;
          for (let i = 0; i < p.count; i++) if (p.getY(i) < 0) { const a = Math.atan2(p.getZ(i), p.getX(i)), j = 1 + 0.2 * Math.sin(a * 3 + k * 2.3); p.setXYZ(i, p.getX(i) * j, p.getY(i) + 0.03 * Math.sin(a * 2 + k), p.getZ(i) * j); }
          g.rotateY(k * 1.1); g.translate(0, y0 + hgt / 2, 0); g.computeVertexNormals(); coneUV(g);
          P.push(colorize(g, new T.Color(1, 1, 1).multiplyScalar(0.7 + t * 0.4 + (k % 2) * 0.08)));
        }
        return merge(P);
      })();
      const pineGeo = (() => { // dwarf mountain pine: a low clump
        const P = [], q = K.rng(14);
        for (let k = 0; k < 3; k++) { let g = new T.IcosahedronGeometry(0.36 + q() * 0.1, 0); g.deleteAttribute('uv'); g = BU.mergeVertices(g); g.computeVertexNormals(); xf(g, { x: (q() - 0.5) * 0.7, y: 0.2 + q() * 0.1, z: (q() - 0.5) * 0.7, sy: 0.6, ry: q() * 3 }); coneUV(g); P.push(colorize(g, new T.Color(1, 1, 1).multiplyScalar(0.8 + q() * 0.3))); }
        return merge(P);
      })();
      const spruces = [], larches = [], pines = [];
      const spruceCols = [0x2c4a2c, 0x34522f, 0x2a4228, 0x3a5a34, 0x304c30];
      const larchCols = [0xc8a844, 0xb89a3c, 0xd2b456, 0xa4a044, 0x8e9c44, 0xbcaa4c];
      // a tree may not hide the road behind it (the camera looks north at 62 degrees)
      const hides = (x, z, h, rad) => {
        const reach = h * 0.56 + 1.5;
        for (let k = -rad; k <= reach; k += 1) for (const ox of [-rad * 0.7, 0, rad * 0.7]) if (roadD(x + ox, z - k) < 0.8) return true;
        return false;
      };
      const okTree = (x, z, rad, roadM = 3) => {
        if (x < TX0 + 2 || x > TX1 - 2 || z > TZ1 - 2 || z < TZ0 + 2) return false;
        if (roadD(x, z) < roadM + rad) return false;
        if (inGorge(x, z, 2 + rad) || inStream(x, z, 1.5 + rad) || lakeQ(x, z) < 1.2) return false;
        if (isBlocked(x, z, rad * 0.5)) return false;
        return true;
      };
      const cramped = (x, z, rad) => {
        for (const c of K.physics.colliders) {
          if (c.moverFn || (c.bb && (x + rad < c.bb[0] || x - rad > c.bb[2] || z + rad < c.bb[1] || z - rad > c.bb[3]))) continue;
          if (K.physics.circleVsCollider(x, z, rad, c)) return true;
        }
        return false;
      };
      const addTree = (kind, x, z, h, col) => {
        const near = roadD(x, z) < 14 && kind !== 'pine';
        if (near && cramped(x, z, 0.6 + 5.0)) return false;
        const y = gy(x, z) - 0.15;
        const t = { x, y, z, ry: r() * TAU, rx: r.range(-0.04, 0.04), rz: r.range(-0.04, 0.04), color: col, near };
        if (kind === 'spruce') { t.sx = t.sz = h * r.range(0.9, 1.15); t.sy = h; spruces.push(t); } else if (kind === 'larch') { t.sx = t.sz = h * r.range(0.95, 1.2); t.sy = h; larches.push(t); } else { t.sx = t.sz = h; t.sy = h * 0.7; pines.push(t); }
        if (near) K.circle(x, z, 0.6, y + h);
        if (kind !== 'pine') AO(x, z, h * 0.16, h * 0.16, 0.32, 0, y + 0.15); else AO(x, z, h * 0.45, h * 0.45, 0.25, 0, y + 0.15);
        return true;
      };
      // the same trees (and colliders) at every quality, so the course never changes with the graphics setting:
      // Low only draws fewer of the ones away from the road (below)
      const QN = 1;
      const thin = (list) => (lowQ ? list.filter((t, i) => t.near || i % 4 !== 3) : list);
      // forests on the lower slopes of the massif, the west slopes and the infield hills (clumps from noise)
      for (let i = 0; i < 26000 && spruces.length + larches.length < 760 * QN; i++) {
        const x = r.range(TX0 + 3, TX1 - 3), z = r.range(TZ0 + 3, TZ1 - 3);
        const h0 = gy(x, z);
        if (h0 > 21 || rockAt(x, z) > 0.4 || snowAt(x, z) > 0.05 || slopeAt(x, z) > 1.15) continue;
        if (n1(x, z, 0.55, 400) < (h0 > 2 ? 0.42 : 0.58)) continue;
        if (spurAt(x, z)) continue;
        const larch = r() < (h0 > 9 ? 0.45 : 0.22);
        const hh = (larch ? r.range(14, 20) : r.range(15, 24)) * (h0 > 14 ? 0.8 : 1);
        if (!okTree(x, z, 2.2, 4) || hides(x, z, hh + h0, 1.5)) continue;
        addTree(larch ? 'larch' : 'spruce', x, z, hh, larch ? r.pick(larchCols) : r.pick(spruceCols));
      }
      // small larches and dwarf pines on the switchback spurs
      for (let i = 0; i < 4000; i++) {
        const x = r.range(-146, -40), z = r.range(-46, 78);
        const sp = spurAt(x, z);
        if (!sp || roadD(x, z) < 4.5 || inS(roadS(x, z), sp.na - 2, sp.nb + 2)) continue;
        const hh = r.range(5, 8.5);
        if (hides(x, z, hh + TOP, 1) || !okTree(x, z, 1, 4.5)) continue;
        if (r() < 0.5) addTree('larch', x, z, hh, r.pick(larchCols)); else addTree('pine', x, z, r.range(2.2, 3.4), r.pick([0x2a4a2a, 0x34522e, 0x3e5a34]));
      }
      // dwarf pines on rocky ground and in the verges
      for (let i = 0; i < 9000 && pines.length < 240 * QN; i++) {
        const x = r.range(TX0 + 2, TX1 - 2), z = r.range(TZ0 + 2, TZ1 - 2);
        const h0 = gy(x, z);
        if (h0 > 27 || snowAt(x, z) > 0.1 || roadD(x, z) < 3.5 || isBlocked(x, z) || inGorge(x, z, 1.5) || lakeQ(x, z) < 1.25 || inStream(x, z, 1)) continue;
        if (n1(x, z, 0.8, 222) < 0.48) continue;
        if (hides(x, z, h0 + 2.5, 1)) continue;
        addTree('pine', x, z, r.range(2.0, 3.6), r.pick([0x2a4a2a, 0x34522e, 0x3e5a34, 0x2e4426]));
      }
      chunked(spruceGeo, treeMat, thin(spruces), { colors: true }, 130);
      chunked(larchGeo, treeMat, thin(larches), { colors: true }, 140);
      chunked(pineGeo, treeMat, thin(pines), { colors: true, cast: false }, 140);
      // boulders: verges, meadows, the foot of the cliffs, the gorge bed
      const bGeo = (() => { // an angular, faceted block of limestone
        let g = new T.IcosahedronGeometry(1, 1); g.deleteAttribute('uv'); g = BU.mergeVertices(g);
        const p = g.attributes.position, q = K.rng(8);
        for (let i = 0; i < p.count; i++) { const k = 0.66 + q() * 0.62, y = p.getY(i); p.setXYZ(i, p.getX(i) * k, (y > 0.55 ? 0.55 + (y - 0.55) * 0.3 : y) * k * 0.8, p.getZ(i) * k); }
        g = g.toNonIndexed(); g.computeVertexNormals();
        const pp = g.attributes.position, uv = new Float32Array(pp.count * 2);
        for (let i = 0; i < pp.count; i++) { uv[i * 2] = pp.getX(i) * 0.6 + pp.getZ(i) * 0.4; uv[i * 2 + 1] = pp.getY(i) * 0.6 + pp.getZ(i) * 0.2; }
        g.setAttribute('uv', new T.BufferAttribute(uv, 2));
        return g;
      })();
      const bMat = K.std({ map: rockTex, vertexColors: false, color: 0xffffff, roughness: 0.9 });
      const boulders = A.gorgeBoulders.slice();
      for (let i = 0; i < 9000 && boulders.length < 300; i++) {
        const x = r.range(TX0 + 2, TX1 - 2), z = r.range(TZ0 + 2, TZ1 - 2);
        const rd = roadD(x, z);
        if (rd < 2.6 || isBlocked(x, z, 1) || inGorge(x, z, 2) || lakeQ(x, z) < 1.1 || inStream(x, z, 1.2)) continue;
        const h0 = gy(x, z), sl = slopeAt(x, z);
        const want = (sl > 0.5 && sl < 1.4 && h0 < 26) ? 0.5 : (rd < 9 ? 0.12 : 0.06);
        if (r() > want) continue;
        const sc = rd < 6 ? r.range(0.5, 1.2) : r.range(0.6, 2.4);
        if (hides(x, z, h0 + sc * 1.4, sc)) continue;
        boulders.push({ x, y: h0 + sc * 0.3, z, s: sc, ry: r() * TAU, rx: r.range(-0.3, 0.3), color: r.pick([0xb4b2ac, 0x9a9892, 0xc8c4bc, 0x8a8884]) });
        if (rd < 9 && sc > 0.8) K.circle(x, z, sc * 0.85, h0 + sc);
        AO(x, z, sc * 1.2, sc * 1.2, 0.35, 0, h0);
      }
      const bGeo0 = (() => { let g = new T.IcosahedronGeometry(1, 0); g.deleteAttribute('uv'); g = BU.mergeVertices(g); const p = g.attributes.position, q = K.rng(9); for (let i = 0; i < p.count; i++) { const k = 0.8 + q() * 0.35; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.7, p.getZ(i) * k); } g = g.toNonIndexed(); g.computeVertexNormals(); const uv = new Float32Array(g.attributes.position.count * 2); for (let i = 0; i < uv.length / 2; i++) { uv[i * 2] = g.attributes.position.getX(i) + g.attributes.position.getZ(i) * 0.5; uv[i * 2 + 1] = g.attributes.position.getY(i); } g.setAttribute('uv', new T.BufferAttribute(uv, 2)); return g; })();
      for (let i = 0, nc = 0; i < 20000 && nc < 110; i++) {
        const x = r.range(TX0 + 3, TX1 - 3), z = r.range(TZ0 + 2, -44);
        const d = zFoot(x) - z, h0 = gy(x, z);
        if (d < 1 || h0 < 1.5 || h0 > 30 || roadD(x, z) < 6 || snowAt(x, z) > 0.4) continue;
        if (n1(x * 1.3, z, 1.2, 66) < 0.5) continue;
        const sc = r.range(1.6, 4.2) * (h0 > 16 ? 0.8 : 1);
        boulders.push({ x, y: h0 - sc * 0.2, z, sx: sc * r.range(0.8, 1.3), sy: sc * r.range(0.8, 1.4), sz: sc * r.range(0.7, 1.1), ry: r() * TAU, rx: r.range(-0.4, 0.2), color: r.pick([0xd0ccc4, 0xc0bcb4, 0xd8d4cc, 0xb4b0a8]) });
        nc++;
      }
      chunked(bGeo, bMat, boulders.filter((b) => (b.s ?? 2) >= 0.95), { colors: true }, 140);
      chunked(bGeo0, bMat, boulders.filter((b) => b.s != null && b.s < 0.95), { colors: true, cast: false }, 140);
      // scree fans at the foot of the cliffs, pebbles round the lake
      const scree = A.pebbles.slice();
      for (let i = 0; i < 40000 && scree.length < 3200; i++) {
        const x = r.range(TX0 + 1, TX1 - 1), z = r.range(TZ0 + 1, TZ1 - 1);
        const h0 = gy(x, z), sl = slopeAt(x, z);
        if (roadD(x, z) < 1.6 || inGorge(x, z, 0.5) || sl > 1.5 || isBlocked(x, z)) continue;
        if (!(rockAt(x, z) > 0.25 && rockAt(x, z) < 0.95) && r() > 0.03) continue;
        scree.push({ x, y: h0 + 0.05, z, s: r.range(0.12, 0.42), ry: r() * TAU, rx: r() * 2, color: r.pick([0xc0beb6, 0xa8a69e, 0x8e8c86, 0xd2d0c8]) });
      }
      chunked(new T.OctahedronGeometry(1, 0).scale(1, 0.6, 0.85), K.std({ color: 0xffffff, roughness: 0.9 }), lowQ ? scree.filter((p, i) => i % 2 === 0) : scree, { colors: true, cast: false }, 140);
      // alpine grass tufts and flowers (gentian blue, edelweiss white, yellow, pink)
      const Q = (K.quality && K.quality.grass) || 0.7;
      const pos = [], nrm = [], col = [], idx = [];
      const tr = K.rng(77);
      for (let b = 0; b < 3; b++) {
        const a = tr() * TAU, rad = tr() * 0.25, ox = Math.cos(a) * rad, oz = Math.sin(a) * rad;
        const h = 0.5 + tr() * 0.35, w = 0.1 + tr() * 0.05, rot = tr() * TAU, lean = 0.08 + tr() * 0.18, la = a + tr.range(-0.6, 0.6);
        const cr = Math.cos(rot), sr = Math.sin(rot), base = pos.length / 3;
        for (const [t, hw2] of [[0, w / 2], [0.5, w * 0.35], [1, 0]]) {
          const y = t * h, bend = lean * t * t;
          for (const sgn of t < 1 ? [-1, 1] : [0]) { const lx = sgn * hw2; pos.push(ox + lx * cr + Math.cos(la) * bend, y, oz + lx * sr + Math.sin(la) * bend); nrm.push(-sr * 0.3, 1, cr * 0.3); const k = 0.72 + 0.28 * t; col.push(k * 0.97, k, k * 0.85); }
        }
        idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2, base + 2, base + 3, base + 4);
      }
      const tuft = new T.BufferGeometry();
      tuft.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); tuft.setAttribute('normal', new T.Float32BufferAttribute(nrm, 3)); tuft.setAttribute('color', new T.Float32BufferAttribute(col, 3));
      tuft.setIndex(idx);
      const tufts = [], flowers = [];
      const cols = [0xa8b858, 0xb8c068, 0x94ac4c, 0xc8c478, 0xb0b660, 0x88a444, 0xc4b46c];
      const n = Math.round(5600 * Q);
      for (let i = 0, tries = 0; i < n && tries < n * 5; tries++) {
        const x = tr.range(TX0 + 1, TX1 - 1), z = tr.range(TZ0 + 1, TZ1 - 1);
        const rd = roadD(x, z);
        if (rd < 1.6 || inGorge(x, z, 1) || inStream(x, z, 0.6) || lakeQ(x, z) < 1.15 || isBlocked(x, z) || rockAt(x, z) > 0.45 || snowAt(x, z) > 0.1) continue;
        if (tr() > (rd < 5 ? 0.75 : 0.42)) continue;
        tufts.push({ x, y: gy(x, z) - 0.05, z, ry: tr() * TAU, s: tr.range(0.9, 1.5), sy: tr.range(1.0, 1.6), color: tr.pick(cols) });
        i++;
        if (tr() < 0.12) flowers.push({ x: x + 0.3, y: gy(x, z) + tr.range(0.3, 0.6), z, s: tr.range(0.1, 0.17), color: tr.pick([0xffffff, 0xf6e04a, 0x3a6ae0, 0x2a52c8, 0xe86aa0, 0xb07ad8]) });
      }
      chunked(tuft, K.std({ vertexColors: true, side: T.DoubleSide, roughness: 0.85 }), tufts, { colors: true, cast: false, receive: false }, 140);
      chunked(new T.IcosahedronGeometry(1, 0), K.std({ color: 0xffffff, roughness: 0.6 }), flowers, { colors: true, cast: false, receive: false }, 200);
    }

    // ---------------------------------------------------------------- the diorama board, the workbench and the model-maker's things
    {
      const edgeTop = (x, z) => {
        if (inGorge(x, z, 0.1)) return -BASE + 0.1;
        return Math.max(-0.4, gy(x, z));
      };
      const fasciaMat = K.phys({ color: 0x2e2018, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3 });
      const sides = [
        { a: BOUNDS.minX - 1.2, b: BOUNDS.maxX + 1.2, at: (u) => [u, BOUNDS.maxZ], place: (g) => g.translate(0, 0, BOUNDS.maxZ) },
        { a: BOUNDS.minX - 1.2, b: BOUNDS.maxX + 1.2, at: (u) => [u, BOUNDS.minZ], place: (g) => g.translate(0, 0, BOUNDS.minZ - 1.2) },
        { a: BOUNDS.minZ, b: BOUNDS.maxZ, at: (u) => [BOUNDS.maxX, u], place: (g) => { g.rotateY(-PI / 2); g.translate(BOUNDS.maxX, 0, 0); } },
        { a: BOUNDS.minZ, b: BOUNDS.maxZ, at: (u) => [BOUNDS.minX, u], place: (g) => { g.rotateY(-PI / 2); g.translate(BOUNDS.minX - 1.2, 0, 0); } },
      ];
      for (const sd of sides) {
        const sh = new T.Shape();
        sh.moveTo(sd.a, -BASE); sh.lineTo(sd.b, -BASE);
        for (let u = sd.b; u >= sd.a - 0.01; u -= 0.75) { const [x, z] = sd.at(clamp(u, sd.a + 1.2, sd.b - 1.2)); sh.lineTo(u, edgeTop(clamp(x, BOUNDS.minX + 0.3, BOUNDS.maxX - 0.3), clamp(z, BOUNDS.minZ + 0.3, BOUNDS.maxZ - 0.3)) + 0.05); }
        sh.closePath();
        const g = new T.ExtrudeGeometry(sh, { depth: 1.2, bevelEnabled: false });
        sd.place(g);
        const m = new T.Mesh(g, fasciaMat); m.receiveShadow = true; m.castShadow = true; K.group.add(m);
      }
      // where the gorge leaves the board, its walls are seen in section: painted rock on the cut face
      // the workbench: a pale beech top, far larger than the board
      const MY = -BASE; // bench top
      const beech = TX.woodTextures({ size: 256, seed: 31, planks: 6, base: 0xc8a272, dark: 0x9a7448, light: 0xe0c094, ringFreq: 14, gap: 0.003, roughBase: 0.55 });
      for (const t of Object.values(beech)) t.repeat.set(5, 3.5);
      K.mesh(new T.BoxGeometry(780, 5, 560), K.std({ map: beech.map, normalMap: beech.normalMap, roughnessMap: beech.roughnessMap, normalScale: V2(0.5) }), 0, MY - 2.5, 0, { cast: false });
      // a brass plaque on the front of the board
      const plq = TX.labelTexture(512, 96, (g2) => {
        const gr = g2.createLinearGradient(0, 0, 0, 96); gr.addColorStop(0, '#e8c87a'); gr.addColorStop(0.5, '#c89a44'); gr.addColorStop(1, '#a87a2a');
        g2.fillStyle = gr; g2.fillRect(0, 0, 512, 96);
        g2.strokeStyle = '#6a4a1a'; g2.lineWidth = 4; g2.strokeRect(8, 8, 496, 80);
        g2.fillStyle = '#3a2a10'; g2.font = '700 36px Georgia, serif'; g2.textAlign = 'center'; g2.fillText('Torna Pass', 256, 50);
        g2.font = 'italic 20px Georgia, serif'; g2.fillText('2183 m  ·  scale 1:100', 256, 78);
      });
      K.mesh(new T.PlaneGeometry(26, 4.9), K.std({ map: plq, roughness: 0.3, metalness: 0.75 }), -60, -BASE / 2 - 1, BOUNDS.maxZ + 1.22, { cast: false });
      // model paint tins
      const tinLabel = TX.labelTexture(256, 64, (g2) => {
        g2.fillStyle = '#f2efe6'; g2.fillRect(0, 0, 256, 64);
        g2.fillStyle = '#2a3a5a'; g2.fillRect(0, 0, 256, 14); g2.fillRect(0, 50, 256, 14);
        g2.fillStyle = '#2a3a5a'; g2.font = '700 20px Rubik, Arial'; g2.textAlign = 'center';
        g2.fillText('MODEL ENAMEL', 64, 40); g2.fillText('MATT  14 ml', 192, 40);
      });
      const tinSide = K.std({ map: tinLabel, roughness: 0.4, metalness: 0.3 });
      const tins = [[-22, 122, 0x6a6e74], [-17.5, 124.5, 0xf2f2ee], [-23.5, 127, 0x2e4a2e], [-14, 121.5, 0x8a7a5a], [-18.5, 129, 0xd8d0b8], [96, 124, 0x3a4a6a], [100.5, 126, 0xb8b4aa], [-196, 30, 0x5a6a4a], [-198, 36, 0x7a8088], [196, -40, 0x4a3a2a]];
      for (const [x, z, c] of tins) {
        prop(new T.CylinderGeometry(1.75, 1.75, 2.3, 28, 1, true), 0xffffff, { x, y: MY + 1.15, z, ry: r() * TAU }, tinSide);
        prop(new T.CylinderGeometry(1.82, 1.82, 0.3, 28), c, { x, y: MY + 2.42, z }, vcMetal);
        AO(x, z, 2.4, 2.4, 0.45, 0, MY - 0.05);
      }
      // dabs of grey and white on a palette lid
      prop(new T.CylinderGeometry(2.6, 2.6, 0.2, 28), 0xd8dade, { x: -6, y: MY + 0.1, z: 125 }, vcMetal);
      for (const [dx, dz, c] of [[0.8, 0.4, 0x6a6e74], [-0.9, -0.3, 0xf2f2ee], [0.1, -1.1, 0x2e4a2e]]) prop(new T.SphereGeometry(0.62, 14, 6, 0, TAU, 0, PI / 2), c, { x: -6 + dx, y: MY + 0.2, z: 125 + dz, sy: 0.25 }, vcSatin);
      // tweezers, a craft knife and brushes by the front edge
      for (const e of [-1, 1]) prop(new T.BoxGeometry(12, 0.14, 0.62), 0xd8dade, { x: 30 - Math.sin(0.25) * e * 0.45, y: MY + 0.2, z: 121 + Math.cos(0.25) * e * 0.45, ry: 0.25 + e * 0.035 }, vcMetal);
      AO(30, 121, 6.5, 1.2, 0.3, -0.25, MY - 0.05);
      const fk = frame(62, MY + 0.45, 124, -0.4);
      fk(new T.CylinderGeometry(0.42, 0.42, 11, 12).rotateZ(PI / 2), 0x9aa0a8, {}, vcMetal);
      fk(new T.BoxGeometry(2.4, 0.06, 0.55), 0xd8dade, { x: 6.6 }, vcMetal);
      fk(new T.CylinderGeometry(0.5, 0.5, 0.9, 12).rotateZ(PI / 2), 0x2a2a2a, { x: 5.2 }, vcMetal);
      AO(62, 124, 7, 0.9, 0.3, 0.4, MY - 0.05);
      const brush = (x, z, ry, len = 17, col = 0x1e3a6a) => {
        const fb2 = frame(x, MY + 0.35, z, ry);
        fb2(new T.CylinderGeometry(0.32, 0.2, len, 12).rotateZ(PI / 2), col, { x: -len / 2 }, vcSatin);
        fb2(new T.CylinderGeometry(0.34, 0.3, 1.8, 12).rotateZ(PI / 2), 0xc8b070, { x: 0.9 }, vcMetal);
        fb2(new T.ConeGeometry(0.3, 1.6, 10).rotateZ(-PI / 2), 0x3a2a1e, { x: 2.6 }, vc);
        AO(x - (len / 2) * Math.cos(ry), z + (len / 2) * Math.sin(ry), len / 2 + 2, 0.8, 0.3, ry, MY - 0.05);
      };
      brush(-88, 122, 0.1); brush(-52, 127, -0.25, 14, 0x8a2a1e); brush(194, 10, 1.4, 15, 0x2a5a3a);
      // an open box of spare 1:100 pines and a bag of grey scree by the front left
      {
        const bx = -128, bz = 128, fb = frame(bx, MY, bz, 0.12);
        fb(new T.BoxGeometry(22, 3.2, 10), 0xd8cfb8, { y: 1.6 }, vc);
        fb(new T.BoxGeometry(21, 0.2, 9), 0x6a5a40, { y: 3.0 }, vc);
        const lid = K.mesh(new T.PlaneGeometry(22, 3.2), labelMat(512, 74, (g) => { g.fillStyle = '#2e4a2e'; g.fillRect(0, 0, 512, 74); g.fillStyle = '#f4eedc'; g.font = '700 40px Rubik, Arial'; g.textAlign = 'center'; g.fillText('ALPINE PINES  1:100  ·  24 pcs', 256, 52); }), bx + Math.sin(0.12) * 5.02, MY + 1.6, bz + Math.cos(0.12) * 5.02, { ry: 0.12, cast: false });
        void lid;
        const spare = [];
        for (let k = 0; k < 6; k++) spare.push({ x: bx - 8 + k * 3.1, y: MY + 2.3, z: bz - 1.2 + (k % 2) * 2.4, rz: PI / 2, ry: 0.12, sx: 15, sy: 15, sz: 15, color: r.pick([0x2c4a2c, 0x34522f]) });
        K.instances(new T.ConeGeometry(0.2, 1, 8).translate(0, 0.5, 0), K.std({ color: 0xffffff, roughness: 0.9 }), spare, { colors: true });
        AO(bx, bz, 12, 6, 0.45, 0.12, MY - 0.05);
        const bag = frame(-96, MY, 132, -0.3);
        bag(new T.SphereGeometry(4, 16, 10), 0xe8e6e2, { y: 2.2, sx: 1.2, sy: 0.6 }, vcSatin);
        const scr = [];
        for (let k = 0; k < 70; k++) scr.push({ x: -96 + r.gauss() * 3.5 + 6, y: MY + 0.15, z: 132 + r.gauss() * 2.4 - 3, s: r.range(0.12, 0.35), ry: r() * 6, color: r.pick([0xb4b2ac, 0x8e8c86, 0xd2d0c8]) });
        K.instances(new T.DodecahedronGeometry(1, 0), K.std({ color: 0xffffff, roughness: 0.9 }), scr, { colors: true, cast: false });
        AO(-96, 132, 5, 3, 0.4, -0.3, MY - 0.05);
      }
      // a bottle of scenic glue and a jar of brushes on the west side
      const bottle = K.lathe([[2.2, 0], [2.4, 0.4], [2.4, 7.2], [1.9, 8.2], [0.9, 8.8], [0.9, 9.4]], 32);
      prop(bottle, 0xf4f2ea, { x: -194, y: MY, z: 76 }, vcSatin);
      prop(new T.ConeGeometry(0.85, 2.4, 20), 0x2a6aa8, { x: -194, y: MY + 10.6, z: 76 }, vcSatin);
      K.mesh(new T.CylinderGeometry(2.42, 2.42, 3.6, 32, 1, true), labelMat(256, 64, (g2) => { g2.fillStyle = '#2a6aa8'; g2.fillRect(0, 0, 256, 64); g2.fillStyle = '#fff'; g2.font = '700 24px Rubik, Arial'; g2.textAlign = 'center'; g2.fillText('SCENIC GLUE', 128, 32); g2.font = '16px Rubik, Arial'; g2.fillText('dries matt', 128, 54); }), -194, MY + 3.9, 76, { ry: 0.5 });
      AO(-194, 76, 3.2, 3.2, 0.45, 0, MY - 0.05);
      const jar = K.lathe([[2.9, 0], [3.1, 0.3], [3.1, 7.5], [3.3, 7.8], [3.0, 7.9], [2.85, 7.6], [2.85, 0.5], [0, 0.4]], 32);
      K.mesh(jar, K.glass(0xeef4f6, 0.22), -192, MY, -60, { cast: false });
      K.mesh(new T.CylinderGeometry(2.8, 2.8, 4.2, 28), K.liquid(0x9aa8a0, { transparent: true, opacity: 0.55 }), -192, MY + 2.5, -60);
      for (const [dx, dz, rx, rz, c] of [[0.8, 0.4, 0.18, -0.22, 0x1e3a6a], [-0.9, 0.6, -0.15, 0.2, 0x8a2a1e], [0.2, -1, 0.25, 0.1, 0x2a5a3a], [-0.4, -0.2, -0.05, -0.12, 0xd8b030]]) {
        prop(new T.CylinderGeometry(0.28, 0.18, 16, 10), c, { x: -192 + dx, y: MY + 8, z: -60 + dz, rx, rz }, vcSatin);
      }
      AO(-192, -60, 3.8, 3.8, 0.45, 0, MY - 0.05);
      // a steel rule along the east edge
      const rule = TX.labelTexture(1024, 64, (g2) => { g2.fillStyle = '#cfd3d8'; g2.fillRect(0, 0, 1024, 64); g2.fillStyle = '#1a1a1a'; for (let i = 0; i <= 300; i++) { const x = 8 + i * 3.36; g2.fillRect(x, 0, 1.2, i % 10 ? (i % 5 ? 12 : 18) : 26); if (i % 10 === 0) { g2.font = '12px Rubik, Arial'; g2.fillText(String(i / 10), x + 2, 42); } } });
      prop(new T.BoxGeometry(31, 0.12, 2.6), 0xd8dade, { x: 192, y: MY + 0.06, z: 40, ry: PI / 2 - 0.08 }, vcMetal);
      K.mesh(new T.PlaneGeometry(31, 2.6), K.std({ map: rule, roughness: 0.35, metalness: 0.6 }), 192, MY + 0.125, 40, { rx: -PI / 2, cast: false }).rotation.set(-PI / 2, 0, PI / 2 - 0.08);
      AO(192, 40, 1.8, 16, 0.3, -0.08, MY - 0.05);
      // spilt flock and offcuts by the front edge
      const sc = [];
      for (let i = 0; i < 80; i++) { const x = r.range(-70, 70), z = 114 + r.range(1.5, 14); sc.push({ x, y: MY + 0.08, z, s: r.range(0.1, 0.22), color: r.pick([0xd8c8a8, 0x9a8a72, 0x8aa04a, 0xb4b2ac]) }); }
      K.instances(new T.IcosahedronGeometry(1, 0), K.std({ color: 0xffffff, roughness: 0.9 }), sc, { colors: true, cast: false });
      // the workshop floor far below
      K.mesh(new T.PlaneGeometry(2600, 2600), K.std({ color: 0x34302c, roughness: 0.9 }), 0, MY - 76, 0, { rx: -PI / 2, cast: false });
    }

    flushBake();
    // ---------------------------------------------------------------- contact shadows (one instanced draw) + merge
    {
      const g = new T.PlaneGeometry(1, 1); g.rotateX(-PI / 2);
      const mat = new T.MeshBasicMaterial({ color: 0x0a0804, transparent: true, alphaMap: TX.blobShadowTexture(), depthWrite: false });
      mat.onBeforeCompile = (sh) => {
        sh.vertexShader = 'varying float vOp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\nvOp = length(instanceMatrix[1].xyz);\n#endif');
        sh.fragmentShader = 'varying float vOp;\n' + sh.fragmentShader.replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\ndiffuseColor.a *= vOp;');
      };
      if (contacts.length) { const im = K.instances(g, mat, contacts, { cast: false, receive: false }); im.renderOrder = 1; keep.push(im); }
    }
    {
      K.group.updateMatrixWorld(true);
      const isKept = (o) => { for (let q = o; q; q = q.parent) if (keep.includes(q)) return true; return false; };
      const buckets = new Map();
      K.group.traverse((o) => {
        if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || isKept(o)) return;
        if (o.material.transparent || o.renderOrder) return;
        if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
        const c = o.geometry.boundingSphere.center.clone().applyMatrix4(o.matrixWorld);
        if (o.geometry.boundingSphere.radius * o.matrixWorld.getMaxScaleOnAxis() > 70) return;
        const cell = Math.floor((c.x + 330) / CELL) + ':' + Math.floor((c.z + 330) / CELL);
        const key = o.material.uuid + cell + (o.castShadow ? 'c' : '') + (o.receiveShadow ? 'r' : '');
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(o);
      });
      for (const list of buckets.values()) {
        if (list.length < 2) continue;
        const geos = [];
        for (const o of list) {
          let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
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
    void wAt; void masonryList; void inStream;
  },

  animate(time, dt, game) {
    if (!A) return;
    if (A.water) A.water.offset.set(time * 0.03, -time * 0.06);
    if (A.fallTex) A.fallTex.offset.y = time * 1.6;
    // chairs round the lift loop
    const C = A.chairs;
    if (C) {
      const sp = 3.2, gap = C.total / C.n;
      for (let i = 0; i < C.n; i++) {
        let u = (((time * sp + i * gap) % C.total) + C.total) % C.total;
        let sg = C.segs[0];
        for (const q of C.segs) { if (u >= q.a0 && u < q.a0 + q.l) { sg = q; break; } }
        const f = clamp((u - sg.a0) / sg.l, 0, 1);
        C.v.set(lerp(sg.v1[0], sg.v2[0], f), lerp(sg.v1[1], sg.v2[1], f), lerp(sg.v1[2], sg.v2[2], f));
        C.e.set(0, -sg.dir, 0);
        C.q.setFromEuler(C.e);
        C.m4.compose(C.v, C.q, C.one);
        C.im.setMatrixAt(i, C.m4);
      }
      C.im.instanceMatrix.needsUpdate = true;
    }
    // the gallery roof and arcade turn see-through while a car is inside
    const G = A.gallery;
    if (G && game && game.cars) {
      let under = false;
      for (const e of game.cars) { if (e.out || !e.car || e.car.state !== 'drive') continue; const s = e.trackS; if (s > G.s0 && s < G.s1) under = true; }
      const fdt = Math.min(0.2, Math.max(dt || 0, time - (A.lastT ?? time))); A.lastT = time;
      A.fade += ((under ? 1 : 0) - A.fade) * (1 - Math.exp(-fdt * (under ? 10 : 3)));
      G.mats[0].opacity = 1 - 0.8 * A.fade; G.mats[1].opacity = 1 - 0.7 * A.fade;
      for (const m of G.mats) m.depthWrite = A.fade < 0.4;
    }
  },
};

// World: Branch Line Bash. A hobbyist's H0 (1:87) model railway layout in a cosy attic. At H0 scale the toy
// cars are true model-car size, so everything around them is a real miniature landscape: an alpine valley with
// a half-timbered village, an onion-domed church in the hairpin, a station, a farm, flocked forests, resin
// water, a stone-arch viaduct over a gorge, a road tunnel through the mountain (it turns see-through while a
// car is inside) and a branch-line train that runs to a timetable over two level crossings.
import * as THREE from '../../vendor/three.bundle.js';
import { Track } from '../track.js';

const TRACK = [
  [-95, 77], [-30, 80], [35, 78], [85, 70], [120, 50], [138, 18], [141, -20], [128, -50], [100, -66], [70, -70],
  [50, -61], [42, -38], [40, -10], [32, 10], [16, 18], [0, 12], [-6, -8], [-8, -36], [-12, -54], [-26, -65], [-50, -67.5],
  [-84, -67.5], [-116, -66.5], [-139, -50], [-145, -22], [-138, 2], [-143, 30], [-127, 62],
];
const BOUNDS = { minX: -165, maxX: 165, minZ: -112, maxZ: 100 };
const VIA = { s0: 627, s1: 645, s2: 672, s3: 690, h: 5 }; // viaduct: ramp up, deck, ramp down (road arc length); deck height
const TUN = { s0: 348, s1: 402 }; // road tunnel through the mountain spur
const RC = { cx: 72, cz: 4, R: 38 }; // the railway: a stadium-shaped loop (semicircle centres +-cx, radius R)
const RAIL_PTS = (() => {
  const p = [], { cx, cz, R } = RC;
  for (let x = -60; x <= 60; x += 20) p.push([x, cz + R]);
  for (let k = 1; k < 8; k++) { const a = Math.PI / 2 - (k * Math.PI) / 8; p.push([cx + R * Math.cos(a), cz + R * Math.sin(a)]); }
  for (let x = 60; x >= -60; x -= 20) p.push([x, cz - R]);
  for (let k = 1; k < 8; k++) { const a = -Math.PI / 2 - (k * Math.PI) / 8; p.push([-cx + R * Math.cos(a), cz + R * Math.sin(a)]); }
  return p;
})();
// branch-line mixed train: tank loco, coach, covered van, timber wagon (lengths), timetable
const TRAIN = { V: 26, acc: 8, dwell: 9, lens: [12.6, 16, 11, 11.4], gap: 0.6, r: 1.55, h: 4.6 };
const RIVER = [[-75, -116], [-75, -100], [-74.5, -90], [-73.5, -80], [-73, -68], [-71.5, -56], [-68, -45], [-65, -34], [-66, -24], [-69, -14], [-71, -4]];
const RIVER_BED = [[-116, 14], [-95, 11.5], [-92.5, -2.6], [-82, -4], [-67, -4.6], [-52, -2.6], [-38, -1.6], [-10, -1.9]];
const LAKE = { x: -72, z: 5, r: 16.5 };
const WATER_Y = -0.85;

let A = null; // runtime state for tick / animate
const PI = Math.PI;

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const pl = (pts, x) => { // piecewise linear [[x, y]...]
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) return lerp(pts[i - 1][1], pts[i][1], (x - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]));
  return pts[pts.length - 1][1];
};

function roadY(s) {
  const { s0, s1, s2, s3, h } = VIA;
  if (s <= s0 || s >= s3) return 0;
  if (s < s1) return (h * (s - s0)) / (s1 - s0);
  if (s <= s2) return h;
  return (h * (s3 - s)) / (s3 - s2);
}

// ---- train timetable: dwell at the station, then one full lap with smooth acceleration and braking
function tOfRun(d) {
  const S = A.sched, { V, acc } = TRAIN;
  if (d <= S.da) return Math.sqrt((2 * d) / acc);
  if (d <= S.D - S.da) return S.ta + (d - S.da) / V;
  return S.tr - Math.sqrt((2 * Math.max(0, S.D - d)) / acc);
}
function cycleT(t) { const P = A.sched.P; return (((t - A.t0) % P) + P) % P; }
function trainRun(t) { // [distance run from the stop, speed]
  const S = A.sched, { V, acc, dwell } = TRAIN;
  let u = cycleT(t);
  if (u < dwell) return [0, 0];
  u -= dwell;
  if (u < S.ta) return [0.5 * acc * u * u, acc * u];
  if (u < S.tr - S.ta) return [S.da + V * (u - S.ta), V];
  const w = Math.max(0, S.tr - u);
  return [S.D - 0.5 * acc * w * w, acc * w];
}
function railTop(s) { // rail head height: set flush into the road at the level crossings
  let d = 1e9;
  const L = A.rail.length;
  for (const c of A.lc) { const q = Math.abs((((s - c.railS) % L) + L * 1.5) % L - L / 2); if (q < d) d = q; }
  return 0.46 - 0.36 * ss(17, 6, d);
}

export default {
  id: 'railway',
  name: 'Branch Line Bash',
  blurb: 'An H0 model railway: race a timetabled train over the crossings, viaduct and tunnel.',
  vehicle: 'sports',
  seed: 87,
  track: { points: TRACK, width: 14, startS: 40 },
  bounds: BOUNDS,
  fallOffEdges: true,
  floorY: -76,
  offCourse: 16,
  offroad: { kind: 'slow', margin: 1.5 },
  skidColor: 0x1e1e20,
  dust: {
    normal: null,
    slow: { color: 0xb9b2a4, size: 1.0, life: 0.6, up: 2.5, grav: 6, alpha: 0.45, grow: 1.8, rate: 1.2 },
    sticky: { color: 0x4a3420, size: 0.7, life: 0.5, up: 5, grav: 40, alpha: 0.95, grow: 1, rate: 2 },
    slick: { color: 0xd8862a, size: 0.65, life: 0.7, up: 4, grav: 14, alpha: 0.95, grow: 1, rate: 1.6 },
  },
  lighting: {
    sunDir: [-0.62, 1.05, -0.4], sunColor: 0xffdcb0, sunIntensity: 2.9,
    hemiSky: 0xe9e4da, hemiGround: 0x5a4a38, hemiIntensity: 0.62,
    envIntensity: 0.42, exposure: 1.02, background: 0x221a14, shadowRadius: 2.2,
    fog: { color: 0x40342b, near: 190, far: 620 },
  },

  async build(K) {
    const { THREE: T, TX, r, track } = K;
    const TAU = PI * 2, L = track.length;
    const V2 = (a, b = a) => new T.Vector2(a, b);
    const BU = K.BufferGeometryUtils;
    A = { t0: 0, fade: 0, lcBell: [0, 0], puff: 0, lastWarn: [false, false] };
    const keep = []; // objects that must not be merged (animated)

    // ---------------------------------------------------------------- noise
    const NF = TX.noiseField(256, { seed: 17, period: 8, oct: 4 });
    const NF2 = TX.noiseField(256, { seed: 29, period: 16, oct: 3 });
    const bil = (f, x, y) => {
      x = ((x % 256) + 256) % 256; y = ((y % 256) + 256) % 256;
      const x0 = x | 0, y0 = y | 0, x1 = (x0 + 1) & 255, y1 = (y0 + 1) & 255, fx = x - x0, fy = y - y0;
      return (f[y0 * 256 + x0] * (1 - fx) + f[y0 * 256 + x1] * fx) * (1 - fy) + (f[y1 * 256 + x0] * (1 - fx) + f[y1 * 256 + x1] * fx) * fy;
    };
    const n1 = (x, z, sc, o = 0) => bil(NF, x * sc + 37 + o, z * sc + 91 + o * 0.7);
    const n2 = (x, z, sc, o = 0) => bil(NF2, x * sc + 11 + o, z * sc + 53);

    // ---------------------------------------------------------------- railway geometry + timetable
    const rail = new Track(RAIL_PTS, { width: 4, spacing: 0.5 });
    A.rail = rail;
    const RL = rail.length;
    const TL = TRAIN.lens.reduce((a, b) => a + b, 0) + TRAIN.gap * (TRAIN.lens.length - 1);
    A.TL = TL;
    A.off = []; { let o = 0; for (const l of TRAIN.lens) { A.off.push(o); o += l + TRAIN.gap; } }
    {
      const { V, acc, dwell } = TRAIN;
      const ta = V / acc, da = (V * V) / (2 * acc), D = RL;
      const tr = 2 * ta + (D - 2 * da) / V;
      A.sched = { ta, da, tr, D, P: dwell + tr };
    }
    A.sStop = rail.distTo(-15, RC.cz + RC.R).s; // loco front stops at the east end of the platform
    // level crossings: where the hairpin legs cross the north side of the loop
    A.lc = [];
    for (const [a, b] of [[425, 460], [560, 595]]) {
      let lo = a, hi = b;
      const zc = RC.cz - RC.R;
      const f = (s) => track.at(s).z - zc;
      const sgn = Math.sign(f(lo));
      for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (Math.sign(f(m)) === sgn) lo = m; else hi = m; }
      const p = track.at(lo);
      const rs = rail.distTo(p.x, p.z).s;
      const dA = (((rs - 2.6 - A.sStop) % RL) + RL) % RL, dD = Math.min(RL, dA + TL + 5.2);
      A.lc.push({ roadS: lo, railS: rs, x: p.x, z: p.z, angle: p.angle, tA: TRAIN.dwell + tOfRun(dA), tD: TRAIN.dwell + tOfRun(dD) });
    }

    // ---------------------------------------------------------------- distance fields (1-unit grid): road edge, road s/lateral, rail
    const G0X = -172, G0Z = -120, GW = 346, GH = 228;
    const RD = new Float32Array(GW * GH).fill(60), RS = new Float32Array(GW * GH), RLAT = new Float32Array(GW * GH), RR = new Float32Array(GW * GH).fill(60);
    for (let i = 0; i < track.N; i += 2) {
      const x = track.x[i], z = track.z[i], hw = track.w[i] / 2, R = hw + 30;
      const nx = -track.tz[i], nz = track.tx[i];
      const gx0 = Math.max(0, Math.floor(x - R - G0X)), gx1 = Math.min(GW - 1, Math.ceil(x + R - G0X));
      const gz0 = Math.max(0, Math.floor(z - R - G0Z)), gz1 = Math.min(GH - 1, Math.ceil(z + R - G0Z));
      for (let gz = gz0; gz <= gz1; gz++) {
        const dz = gz + G0Z - z;
        for (let gx = gx0; gx <= gx1; gx++) {
          const dx = gx + G0X - x, d = Math.sqrt(dx * dx + dz * dz) - hw, k = gz * GW + gx;
          if (d < RD[k]) { RD[k] = d; RS[k] = i * track.ds; RLAT[k] = dx * nx + dz * nz; }
        }
      }
    }
    for (let i = 0; i < rail.N; i += 2) {
      const x = rail.x[i], z = rail.z[i], R = 14;
      const gx0 = Math.max(0, Math.floor(x - R - G0X)), gx1 = Math.min(GW - 1, Math.ceil(x + R - G0X));
      const gz0 = Math.max(0, Math.floor(z - R - G0Z)), gz1 = Math.min(GH - 1, Math.ceil(z + R - G0Z));
      for (let gz = gz0; gz <= gz1; gz++) for (let gx = gx0; gx <= gx1; gx++) {
        const d = Math.hypot(gx + G0X - x, gz + G0Z - z), k = gz * GW + gx;
        if (d < RR[k]) RR[k] = d;
      }
    }
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
    const roadD = (x, z) => gridBil(RD, x, z, 60);
    const roadS = (x, z) => gridN(RS, x, z, -1);
    const roadLat = (x, z) => gridN(RLAT, x, z, 0);
    const railD = (x, z) => gridBil(RR, x, z, 60);

    // river polyline (densified Catmull-Rom) and distance to it
    const riverPts = (() => {
      const c = new T.CatmullRomCurve3(RIVER.map(([x, z]) => new T.Vector3(x, 0, z)));
      return c.getSpacedPoints(120).map((v) => [v.x, v.z]);
    })();
    const riverInfo = (x, z) => {
      let best = 1e9, bz = 0;
      for (let i = 0; i < riverPts.length - 1; i++) {
        const [ax, az] = riverPts[i], [bx, bz2] = riverPts[i + 1];
        const vx = bx - ax, vz = bz2 - az, l2 = vx * vx + vz * vz;
        const t = clamp(((x - ax) * vx + (z - az) * vz) / l2, 0, 1);
        const d = Math.hypot(x - ax - vx * t, z - az - vz * t);
        if (d < best) { best = d; bz = az + vz * t; }
      }
      return [best, bz];
    };
    const lakeR = (a) => LAKE.r + 2.2 * Math.sin(3 * a + 1) + 1.3 * Math.sin(5 * a + 2.2);

    // ---------------------------------------------------------------- terrain height model
    const footZ = (x) => -80 + 2.4 * Math.sin(x / 19 + 1) + 1.6 * Math.sin(x / 7.7 + 2) + (n1(x, 0, 0.06, 5) - 0.5) * 3;
    const band = (x, z) => {
      const t = footZ(x) - z;
      if (t < -1) return 0;
      const peak = 27 + 17 * n1(x, 0, 0.011, 300) + 5 * Math.sin(x / 31);
      const foot = 8 + 5 * n1(x, z, 0.035, 120);
      const fh = foot * Math.pow(ss(-1, 13, t), 0.9);
      const cliff = Math.max(0, peak - foot) * Math.pow(ss(8, 31, t + (n1(x, 0, 0.05, 7) - 0.5) * 7), 0.8);
      const crag = (n1(x, z, 0.09, 60) - 0.5) * 8 * ss(8, 16, t) + (n2(x, z, 0.21, 9) - 0.5) * 2.2 * ss(1, 6, t);
      return Math.max(0, fh + cliff + crag);
    };
    const spurH = (s, lat, x, z) => {
      const along = ss(TUN.s0 - 18, TUN.s0 + 1, s) * ss(TUN.s1 + 18, TUN.s1 - 1, s);
      if (along <= 0) return 0;
      const across = lat > 0 ? 1 : ss(-34, -9, lat);
      const mid = Math.sin(PI * clamp((s - TUN.s0) / (TUN.s1 - TUN.s0), 0, 1));
      return (10.6 + 8.5 * mid + 4 * n1(x, z, 0.05, 77) * mid + (n2(x, z, 0.2, 4) - 0.5) * 1.6) * along * across;
    };
    const HILLS = [[-128, 52, 26, 17, 1], [-120, -40, 22, 13, 1], [128, -12, 9, 26, 0.7], [-158, 0, 8, 70, 0.8], [157, 5, 7, 70, 0.8], [-52, -52, 34, 7, 0.5], [12, -52, 14, 6, 0.35], [-104, 88, 20, 5, 0.25], [92, 92, 18, 4, 0.2]];
    const hillMask = (x, z) => { let m = 0; for (const [hx, hz, ax, az, k] of HILLS) m = Math.max(m, k * ss(1, 0.35, Math.hypot((x - hx) / ax, (z - hz) / az))); return m; };
    const H = (x, z) => {
      const rd = roadD(x, z), s = roadS(x, z), lat = roadLat(x, z);
      const inTun = s > TUN.s0 && s < TUN.s1 && Math.abs(lat) < 34;
      let m = Math.max(band(x, z), spurH(s, lat, x, z));
      if (!inTun) m *= ss(1.0, 5.5, rd);
      const hl = Math.max(0, n1(x, z, 0.024, 200) - 0.4) * 11 * ss(8, 22, rd) * hillMask(x, z);
      let h = Math.max(m, hl);
      // river: a gorge through the mountains, then a channel to the lake
      const [rdist, rz] = riverInfo(x, z);
      if (rdist < 16) {
        const bed = pl(RIVER_BED, rz);
        const wall = rz < -60 ? 2.5 : 7;
        const rw = rz < -60 ? 3.4 : 3.8;
        h = Math.min(h, lerp(bed, Math.max(h, bed), ss(rw - 0.6, rw + wall, rdist)));
      }
      const ld = Math.hypot(x - LAKE.x, z - LAKE.z);
      if (ld < LAKE.r + 8) { const lr = lakeR(Math.atan2(z - LAKE.z, x - LAKE.x)); h = Math.min(h, lerp(-2.1, h, ss(lr - 3, lr + 1.6, ld))); }
      // rail bed flat (except where the girder bridge crosses the river)
      const rr = railD(x, z);
      if (rr < 6.5 && rdist > 7) h = lerp(0, h, ss(3.2, 6.5, rr));
      // board edges (south / east / west, below the mountains)
      if (z > -76) h *= ss(0, 4, Math.min(x - BOUNDS.minX, BOUNDS.maxX - x, BOUNDS.maxZ - z));
      return h;
    };

    // ---------------------------------------------------------------- textures
    const grassTex = (() => {
      const S = 512;
      const nA = TX.noiseField(256, { seed: 3, period: 6, oct: 4 });
      const c = TX.paint(S, S, (x, y, u, v, o) => {
        const t = TX.sampleField(nA, 256, u * 256, v * 256);
        o[0] = 70 + t * 34; o[1] = 104 + t * 40; o[2] = 40 + t * 16;
      });
      const g = c.getContext('2d');
      const cols = ['#5d8f34', '#79a843', '#4a7a2a', '#97b85a', '#3d6622', '#a9b866', '#6e9a3a', '#8c9e4c'];
      const rr = K.rng(5);
      for (let i = 0; i < 9000; i++) {
        const x = rr() * S, y = rr() * S, rad = 0.6 + rr() * 1.3;
        g.fillStyle = cols[(rr() * cols.length) | 0]; g.globalAlpha = 0.45 + rr() * 0.5;
        for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) { g.beginPath(); g.arc(x + ox, y + oy, rad, 0, TAU); g.fill(); }
      }
      g.globalAlpha = 1;
      const nrm = TX.normalFromHeight(TX.heightFromCanvasLuma(c), S, S, 3.5);
      return { map: TX.toTexture(c), normalMap: TX.toTexture(nrm, { srgb: false }) };
    })();
    const rockTex = (() => {
      const S = 512;
      const nA = TX.noiseField(256, { seed: 41, period: 5, oct: 5 });
      const nB = TX.noiseField(256, { seed: 43, period: 3, oct: 4 });
      const c = TX.paint(S, S, (x, y, u, v, o) => {
        const a = TX.sampleField(nA, 256, u * 256, v * 256), b = TX.sampleField(nB, 256, u * 256, v * 256);
        const facet = Math.abs(a - 0.5) * 2;
        const k = 0.8 + (b - 0.5) * 0.5 - ss(0.62, 0.9, facet) * 0.32 + ss(0.15, 0, facet) * 0.1;
        o[0] = 158 * k; o[1] = 154 * k; o[2] = 146 * k;
      });
      const g = c.getContext('2d'), q = K.rng(9);
      g.lineCap = 'round';
      for (let i = 0; i < 90; i++) {
        let x = q() * S, y = q() * S;
        g.strokeStyle = `rgba(36,30,24,${0.35 + q() * 0.3})`; g.lineWidth = 1 + q() * 2;
        g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 7; k++) { x += (q() - 0.5) * 34; y += 4 + q() * 20; g.lineTo(x, y); }
        g.stroke();
      }
      for (let i = 0; i < 1400; i++) { g.fillStyle = q() < 0.55 ? `rgba(84,104,56,${0.18 + q() * 0.3})` : `rgba(236,230,214,${0.12 + q() * 0.2})`; g.beginPath(); g.arc(q() * S, q() * S, 0.8 + q() * 3, 0, TAU); g.fill(); }
      return TX.toTexture(c);
    })();
    const stoneTex = (light = false) => { // ashlar blocks: 4 units wide, 2 tall per tile
      const c = TX.makeCanvas(256, 128), g = c.getContext('2d');
      const rr = K.rng(light ? 71 : 73);
      g.fillStyle = light ? '#8d8476' : '#6f675c'; g.fillRect(0, 0, 256, 128);
      for (let row = 0; row < 4; row++) {
        let x = row % 2 ? -24 : 0;
        while (x < 256) {
          const w = 34 + rr() * 30, k = 0.82 + rr() * 0.3;
          const base = light ? [176, 166, 148] : [150, 140, 124];
          g.fillStyle = `rgb(${base[0] * k | 0},${base[1] * k | 0},${base[2] * k | 0})`;
          g.fillRect(x + 2, row * 32 + 2, w - 3, 28);
          g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x + 2, row * 32 + 2, w - 3, 4);
          g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x + 2, row * 32 + 26, w - 3, 4);
          x += w;
        }
      }
      for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${rr() < 0.5 ? '255,255,255' : '0,0,0'},${0.05 + rr() * 0.07})`; g.fillRect(rr() * 256, rr() * 128, 2, 2); }
      return TX.toTexture(c);
    };
    const stoneMap = stoneTex(false), stoneMapL = stoneTex(true);
    const stoneMat = K.std({ map: stoneMap, roughness: 0.9, vertexColors: true });
    const stonePlain = K.std({ map: stoneMap, roughness: 0.9 });

    // ---------------------------------------------------------------- terrain mesh (one height grid, chunked)
    const TX0 = BOUNDS.minX, TX1 = BOUNDS.maxX, TZ0 = BOUNDS.minZ, TZ1 = BOUNDS.maxZ;
    const NXg = 220, NZg = 142;
    const nx = NXg + 1, nz = NZg + 1;
    const XS = [], ZS = [];
    for (let i = 0; i < nx; i++) XS.push(TX0 + ((TX1 - TX0) * i) / NXg);
    for (let j = 0; j < nz; j++) ZS.push(TZ0 + ((TZ1 - TZ0) * j) / NZg);
    const HG = new Float32Array(nx * nz);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) HG[j * nx + i] = H(XS[i], ZS[j]);
    const dxg = (TX1 - TX0) / NXg, dzg = (TZ1 - TZ0) / NZg;
    const gy = (x, z) => { // terrain height (bilinear on the mesh grid)
      const fx = clamp((x - TX0) / dxg, 0, NXg - 0.001), fz = clamp((z - TZ0) / dzg, 0, NZg - 0.001);
      const i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j, k = j * nx + i;
      return (HG[k] * (1 - tx) + HG[k + 1] * tx) * (1 - tz) + (HG[k + nx] * (1 - tx) + HG[k + nx + 1] * tx) * tz;
    };
    A.gy = gy;
    const ROCK = new Float32Array(nx * nz);
    // tunnel cut-away region: everything over the tunnel fades while a car is inside
    const inFade = (x, z) => { const s = roadS(x, z), lat = roadLat(x, z); return s > TUN.s0 + 0.4 && s < TUN.s1 - 0.4 && lat > -30 && lat < 13; };
    {
      const NRM = new Float32Array(nx * nz * 3), COL = new Float32Array(nx * nz * 3), UV = new Float32Array(nx * nz * 2);
      const cGrass = [[0.98, 1.0, 0.92], [1.12, 1.06, 0.82], [0.86, 0.94, 0.86], [1.05, 0.98, 0.78]];
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
        const k = j * nx + i, x = XS[i], z = ZS[j], h = HG[k];
        const i0 = Math.max(0, i - 1), i1 = Math.min(nx - 1, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(nz - 1, j + 1);
        const dhx = (HG[j * nx + i1] - HG[j * nx + i0]) / (XS[i1] - XS[i0]);
        const dhz = (HG[j1 * nx + i] - HG[j0 * nx + i]) / (ZS[j1] - ZS[j0]);
        const l = Math.hypot(dhx, 1, dhz);
        NRM[k * 3] = -dhx / l; NRM[k * 3 + 1] = 1 / l; NRM[k * 3 + 2] = -dhz / l;
        const slope = Math.hypot(dhx, dhz);
        const nz1 = n1(x, z, 0.05, 11), nz2 = n2(x, z, 0.12, 3);
        let rock = clamp(ss(0.85, 1.6, slope + (nz1 - 0.5) * 0.5) + ss(17, 32, h + (nz2 - 0.5) * 8) * 0.8, 0, 1);
        if (h < -0.6) rock = Math.max(rock, ss(-0.6, -2.4, h) * 0.35);
        ROCK[k] = rock;
        // grass hue variation, darker under trees / near water, dry verges by the road
        const ga = cGrass[(nz1 * 3.99) | 0], gb = cGrass[(nz2 * 3.99) | 0];
        const t = (nz1 * 7) % 1;
        let cr = lerp(ga[0], gb[0], t), cg = lerp(ga[1], gb[1], t), cb = lerp(ga[2], gb[2], t);
        const rdv = roadD(x, z);
        if (rdv < 3) { const w = 1 - Math.max(0, rdv) / 3; cr *= 1 + w * 0.12; cg *= 1 - w * 0.02; cb *= 1 - w * 0.1; }
        const rrv = railD(x, z);
        if (rrv < 4.5) { const w = ss(4.5, 2.6, rrv); cr = lerp(cr, 0.9, w * 0.4); cg = lerp(cg, 0.78, w * 0.4); cb = lerp(cb, 0.62, w * 0.4); }
        if (h < -0.4) { const w = ss(-0.4, -1.6, h); cr = lerp(cr, 0.55, w); cg = lerp(cg, 0.5, w); cb = lerp(cb, 0.36, w); }
        // rock tint + snow on the peaks
        const rk = (0.78 + nz2 * 0.3) * (0.78 + 0.34 * n1(x, z, 0.31, 21));
        cr = lerp(cr, rk, rock); cg = lerp(cg, rk * 0.98, rock); cb = lerp(cb, rk * 0.97, rock);
        const snow = ss(30, 35, h + (nz1 - 0.5) * 7) * (1 - ss(1.0, 1.6, slope) * 0.6);
        cr = lerp(cr, 1.75, snow); cg = lerp(cg, 1.78, snow); cb = lerp(cb, 1.85, snow);
        COL[k * 3] = cr; COL[k * 3 + 1] = cg; COL[k * 3 + 2] = cb;
        UV[k * 2] = (x + h * 0.35) / 6; UV[k * 2 + 1] = (z - h * 0.75) / 6;
      }
      const terrainMat = (fading) => {
        const m = K.std({ map: grassTex.map, normalMap: grassTex.normalMap, normalScale: V2(0.7), vertexColors: true, roughness: 0.95, transparent: fading });
        m.onBeforeCompile = (sh) => {
          sh.uniforms.rockMap = { value: rockTex };
          sh.vertexShader = 'attribute float aRock;\nvarying float vRock;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvRock = aRock;');
          sh.fragmentShader = 'uniform sampler2D rockMap;\nvarying float vRock;\n' + sh.fragmentShader.replace('#include <map_fragment>', `
            #ifdef USE_MAP
              vec4 gC = texture2D( map, vMapUv );
              vec4 rC = texture2D( rockMap, vMapUv * 0.55 );
              diffuseColor *= mix( gC, rC, vRock );
            #endif`);
        };
        return m;
      };
      const tMat = terrainMat(false), fMat = terrainMat(true);
      A.spurMat = fMat;
      const buildChunk = (i0, i1, j0, j1, pick) => {
        const w = i1 - i0 + 1, hgt = j1 - j0 + 1;
        const pos = new Float32Array(w * hgt * 3), nrm = new Float32Array(w * hgt * 3), col = new Float32Array(w * hgt * 3), uv = new Float32Array(w * hgt * 2), rk = new Float32Array(w * hgt);
        let maxH = -1e9;
        for (let j = 0; j < hgt; j++) for (let i = 0; i < w; i++) {
          const k = (j0 + j) * nx + i0 + i, o = j * w + i;
          pos[o * 3] = XS[i0 + i]; pos[o * 3 + 1] = HG[k]; pos[o * 3 + 2] = ZS[j0 + j];
          nrm[o * 3] = NRM[k * 3]; nrm[o * 3 + 1] = NRM[k * 3 + 1]; nrm[o * 3 + 2] = NRM[k * 3 + 2];
          col[o * 3] = COL[k * 3]; col[o * 3 + 1] = COL[k * 3 + 1]; col[o * 3 + 2] = COL[k * 3 + 2];
          uv[o * 2] = UV[k * 2]; uv[o * 2 + 1] = UV[k * 2 + 1]; rk[o] = ROCK[k];
          maxH = Math.max(maxH, HG[k]);
        }
        const idx = [];
        for (let j = 0; j < hgt - 1; j++) for (let i = 0; i < w - 1; i++) {
          const cx = (XS[i0 + i] + XS[i0 + i + 1]) / 2, cz = (ZS[j0 + j] + ZS[j0 + j + 1]) / 2;
          if (!pick(cx, cz)) continue;
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
        g.setIndex(idx);
        g.computeBoundingSphere();
        return { g, maxH };
      };
      const xs = [0, 55, 110, 165, NXg], zs = [0, 36, 72, 107, NZg];
      for (let a = 0; a < xs.length - 1; a++) for (let b = 0; b < zs.length - 1; b++) {
        const c = buildChunk(xs[a], xs[a + 1], zs[b], zs[b + 1], (x, z) => !inFade(x, z));
        if (!c) continue;
        const m = new T.Mesh(c.g, tMat);
        m.castShadow = c.maxH > 3; m.receiveShadow = true;
        keep.push(m); K.group.add(m);
      }
      // the fading spur over the tunnel
      let fi0 = nx, fi1 = 0, fj0 = nz, fj1 = 0;
      for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) if (inFade(XS[i] + dxg / 2, ZS[j] + dzg / 2)) { fi0 = Math.min(fi0, i); fi1 = Math.max(fi1, i + 1); fj0 = Math.min(fj0, j); fj1 = Math.max(fj1, j + 1); }
      const fc = buildChunk(fi0, fi1, fj0, fj1, inFade);
      { // the mountain's cut face, seen when it turns see-through: dark plaster-and-rock floor at table height
        const fx0 = XS[fi0], fx1 = XS[fi1], fz0 = ZS[fj0], fz1 = ZS[fj1];
        const pc = TX.paint(256, 256, (x, y, u, v, o) => { const n = TX.sampleField(TX.noiseField(256, { seed: 5, period: 12, oct: 3 }), 256, x, y); const k = 0.86 + n * 0.18 + (Math.random() - 0.5) * 0.06; o[0] = 222 * k; o[1] = 214 * k; o[2] = 198 * k; });
        const pt = TX.toTexture(pc); pt.repeat.set((fx1 - fx0) / 24, (fz1 - fz0) / 24);
        const cut = new T.Mesh(new T.PlaneGeometry(fx1 - fx0, fz1 - fz0), K.std({ map: pt, roughness: 0.95 }));
        cut.rotation.x = -PI / 2; cut.position.set((fx0 + fx1) / 2, -0.06, (fz0 + fz1) / 2); cut.receiveShadow = true;
        keep.push(cut); K.group.add(cut);
      }
      const fm = new T.Mesh(fc.g, fMat);
      fm.castShadow = true; fm.receiveShadow = true; fm.renderOrder = 2;
      keep.push(fm); K.group.add(fm);
      A.spurMesh = fm;
    }
    const rockAt = (x, z) => { const i = Math.round((x - TX0) / dxg), j = Math.round((z - TZ0) / dzg); return i < 0 || j < 0 || i >= nx || j >= nz ? 1 : ROCK[j * nx + i]; };

    // ---------------------------------------------------------------- helpers: geometry, contact shadows, baking
    const contacts = [];
    const AO = (x, z, rx, rz = rx, op = 0.4, ang = 0, y = null) => contacts.push({ x, y: (y ?? Math.max(0, gy(x, z))) + 0.06, z, ry: -ang, sx: rx * 2, sy: op, sz: rz * 2 });
    const xf = (g, o = {}) => {
      const m = new T.Matrix4().compose(new T.Vector3(o.x || 0, o.y || 0, o.z || 0), new T.Quaternion().setFromEuler(new T.Euler(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ')), new T.Vector3(o.sx ?? o.s ?? 1, o.sy ?? o.s ?? 1, o.sz ?? o.s ?? 1));
      return g.applyMatrix4(m);
    };
    const colorize = (g, c) => {
      g = g.index ? g.toNonIndexed() : g;
      const col = new T.Color(c), n = g.attributes.position.count, a = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; }
      g.setAttribute('color', new T.BufferAttribute(a, 3));
      return g;
    };
    const tidy = (g) => {
      if (g.index) g = g.toNonIndexed();
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color', 'uv'].includes(k)) g.deleteAttribute(k);
      if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!g.attributes.color) colorize(g, 0xffffff);
      return g;
    };
    const merge = (parts) => BU.mergeGeometries(parts.map(tidy), false);
    // Baker: many static parts that share a material are merged per area into one mesh (vertex colours carry the tint)
    const bakeQ = new Map();
    const bake = (geo, mat, x = 0, z = 0, cast = true) => {
      const key = mat.uuid + (cast ? 'c' : '') + Math.floor((x + 200) / 110) + ':' + Math.floor((z + 200) / 110);
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
    // Chunked instancing (frustum culling skips what is off screen)
    const chunked = (geo, mat, list, opts = {}, cell = 100) => {
      const b = new Map();
      for (const it of list) { const k = Math.floor((it.x + 200) / cell) + ',' + Math.floor((it.z + 200) / cell); if (!b.has(k)) b.set(k, []); b.get(k).push(it); }
      const out = [];
      for (const l of b.values()) { const im = K.instances(geo, mat, l, opts); keep.push(im); out.push(im); }
      return out;
    };
    const vc = K.std({ vertexColors: true, roughness: 0.75 });
    const vcSatin = K.phys({ vertexColors: true, roughness: 0.48, clearcoat: 0.25, clearcoatRoughness: 0.4 });
    const vcMetal = K.std({ vertexColors: true, roughness: 0.38, metalness: 0.7 });
    const vcDouble = K.std({ vertexColors: true, roughness: 0.6, side: T.DoubleSide });
    const glowMat = K.std({ vertexColors: true, emissive: 0xffe0a0, emissiveIntensity: 0.7, roughness: 0.4 });
    const prop = (geo, col, o, mat = vc, cast = true) => { const g = colorize(xf(geo, o), col); bake(g, mat, o.x || 0, o.z || 0, cast); return g; };
    // exclusion zones for scenery (buildings, fields, platform...)
    const blocked = [];
    const block = (x, z, hw, hd, ang = 0, pad = 0) => blocked.push({ x, z, hw: hw + pad, hd: hd + pad, c: Math.cos(ang), s: Math.sin(ang) });
    const isBlocked = (x, z, m = 0) => { for (const b of blocked) { const dx = x - b.x, dz = z - b.z; const a = dx * b.c + dz * b.s, c = -dx * b.s + dz * b.c; if (Math.abs(a) < b.hw + m && Math.abs(c) < b.hd + m) return true; } return false; };
    const local = (cx, cz, a, along, side) => [cx + Math.cos(a) * along - Math.sin(a) * side, cz + Math.sin(a) * along + Math.cos(a) * side];
    const warnRoad = (what, x, z, m = 0.5) => { if (!K.offRoad(x, z, m)) console.warn(`railway: ${what} on road at ${x.toFixed(1)},${z.toFixed(1)}`); };

    // ---------------------------------------------------------------- the road: model asphalt with painted lines
    {
      const W = 256, Hh = 512, RW = 16; // texture: 16 units across, 16 along
      const nA = TX.noiseField(256, { seed: 61, period: 32, oct: 3 });
      const hgt = new Float32Array(W * Hh);
      const rr = K.rng(19);
      const c = TX.paint(W, Hh, (x, y, u, v, o) => {
        const lat = (u - 0.5) * RW, e = RW / 2 - Math.abs(lat);
        const hn = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453, grain = hn - Math.floor(hn);
        const blot = TX.sampleField(nA, 256, u * 64, v * 256);
        let k = 0.92 + (grain - 0.5) * 0.22 + (blot - 0.5) * 0.18;
        const wear = Math.exp(-(((Math.abs(lat) - 3.4) / 1.1) ** 2)) * 0.07; // lighter tyre tracks
        let R = 84 * (k + wear), G = 86 * (k + wear), B = 90 * (k + wear), al = 255;
        let hh = grain * 0.5 + blot * 0.3;
        if (e < 0.85) { // gravel shoulder feathering into the grass
          const gk = 0.75 + grain * 0.5;
          R = 150 * gk; G = 140 * gk; B = 120 * gk;
          al = 255 * ss(0, 0.6, e + (grain - 0.5) * 0.25);
          hh = grain;
        }
        const line = (c0, w) => Math.abs(lat - c0) < w / 2;
        const edgeL = line(-RW / 2 + 1.55, 0.36) || line(RW / 2 - 1.55, 0.36);
        const dash = line(0, 0.3) && (y % 256) < 128;
        if (edgeL || dash) { R = 232; G = 232; B = 226; hh += 0.25; }
        o[0] = R; o[1] = G; o[2] = B; o[3] = al;
        hgt[y * W + x] = hh;
      });
      const g = c.getContext('2d');
      for (let i = 0; i < 6; i++) { // repaired patches and a crack or two
        g.fillStyle = `rgba(40,42,46,${0.18 + rr() * 0.12})`;
        const px = 40 + rr() * 170, py = rr() * 480;
        g.fillRect(px, py, 18 + rr() * 30, 14 + rr() * 40);
      }
      g.strokeStyle = 'rgba(30,30,32,0.5)'; g.lineWidth = 1;
      for (let i = 0; i < 5; i++) { g.beginPath(); let px = 30 + rr() * 190, py = rr() * 512; g.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (rr() - 0.5) * 16; py += 6 + rr() * 8; g.lineTo(px, py); } g.stroke(); }
      const roadMat = K.std({ map: TX.toTexture(c), normalMap: TX.toTexture(TX.normalFromHeight(hgt, W, Hh, 1.6), { srgb: false }), normalScale: V2(0.6), roughness: 0.82, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      const segU = 4, pos = [], uv = [], idx = [];
      const rows = [];
      for (let s = 0; s < L - 0.01;) { rows.push(s); s += s > VIA.s0 - 2 && s < VIA.s3 + 2 ? 0.5 : 1; }
      rows.push(L);
      rows.forEach((s) => {
        const p = track.at(s), y = roadY(s) + 0.06;
        for (let j = 0; j <= segU; j++) {
          const u = j / segU, o = (u - 0.5) * RW;
          pos.push(p.x + p.nx * o, y, p.z + p.nz * o);
          uv.push(u, s / RW);
        }
      });
      for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < segU; j++) {
        const a = i * (segU + 1) + j, b = a + 1, cc = a + segU + 1, d = cc + 1;
        idx.push(a, b, cc, b, d, cc);
      }
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx); geo.computeVertexNormals();
      const nr = geo.attributes.normal;
      for (let i = 0; i < nr.count; i++) if (nr.getY(i) < 0) nr.setXYZ(i, -nr.getX(i), -nr.getY(i), -nr.getZ(i));
      const m = new T.Mesh(geo, roadMat);
      m.receiveShadow = true; m.renderOrder = 1;
      keep.push(m); K.group.add(m);
    }

    // ---------------------------------------------------------------- railway: ballast, sleepers, rails
    {
      const rows = [];
      for (let s = 0; s <= RL; s += 0.8) rows.push(Math.min(s, RL));
      // ballast with sloped shoulders
      const bt = TX.mottledTextures({ size: 256, a: 0x8f877a, b: 0x5e574e, c: 0x2e2a26, seed: 91, period: 48, speck: 0.55, bump: 5, pebbles: 900, pebbleColor: 0x9a9284 });
      const bMat = K.std({ map: bt.map, normalMap: bt.normalMap, normalScale: V2(1.2), roughness: 0.95 });
      const prof = [[-2.8, -0.05], [-1.95, 1], [1.95, 1], [2.8, -0.05]];
      const pos = [], uv = [], idx = [];
      rows.forEach((s) => {
        const p = rail.at(s), top = railTop(s) - 0.28;
        prof.forEach(([o, k]) => { pos.push(p.x + p.nx * o, k > 0 ? top : -0.05, p.z + p.nz * o); uv.push(o / 2.4, s / 2.4); });
      });
      for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < 3; j++) { const a = i * 4 + j, b = a + 1, c = a + 4, d = c + 1; idx.push(a, b, c, b, d, c); }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals();
      const nr = g.attributes.normal; for (let i = 0; i < nr.count; i++) if (nr.getY(i) < 0) nr.setXYZ(i, -nr.getX(i), -nr.getY(i), -nr.getZ(i));
      const bm = new T.Mesh(g, bMat); bm.receiveShadow = true; keep.push(bm); K.group.add(bm);
      // sleepers
      const sl = [];
      for (let s = 0.4; s < RL; s += 0.72) {
        const p = rail.at(s);
        sl.push({ x: p.x, y: railTop(s) - 0.24, z: p.z, ry: -p.angle + PI / 2, color: new T.Color(0x4a3a2c).multiplyScalar(0.8 + r() * 0.35).getHex() });
      }
      chunked(new T.BoxGeometry(2.7, 0.16, 0.3), K.std({ color: 0xffffff, roughness: 0.9 }), sl, { colors: true, cast: false }, 140);
      // rails: polished heads, rusty sides
      const rp = [], rc = [], ri = [];
      for (const side of [-0.83, 0.83]) {
        const base = rp.length / 3;
        rows.forEach((s) => {
          const p = rail.at(s), top = railTop(s), bot = top - 0.2;
          for (const [o, y, c] of [[-0.08, bot, 0.35], [-0.08, top, 0.5], [-0.05, top, 0.92], [0.05, top, 0.92], [0.08, top, 0.5], [0.08, bot, 0.35]]) {
            rp.push(p.x + p.nx * (side + o), y, p.z + p.nz * (side + o));
            rc.push(c, c * (c < 0.6 ? 0.82 : 0.98), c * (c < 0.6 ? 0.7 : 1));
          }
        });
        for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < 5; j++) { const a = base + i * 6 + j, b = a + 1, c = a + 6, d = c + 1; ri.push(a, b, c, b, d, c); }
      }
      const rg = new T.BufferGeometry();
      rg.setAttribute('position', new T.Float32BufferAttribute(rp, 3)); rg.setAttribute('color', new T.Float32BufferAttribute(rc, 3));
      rg.setIndex(ri); rg.computeVertexNormals();
      const railMesh = new T.Mesh(rg, K.std({ vertexColors: true, metalness: 0.75, roughness: 0.32, side: T.DoubleSide }));
      railMesh.receiveShadow = true; keep.push(railMesh); K.group.add(railMesh);
    }

    // ---------------------------------------------------------------- level crossings: rubber panels, St Andrew's crosses, lights, half-barriers
    const crossTex = TX.labelTexture(256, 256, (g) => {
      g.translate(128, 128); g.rotate(PI / 4);
      for (const rot of [0, PI / 2]) {
        g.save(); g.rotate(rot);
        g.fillStyle = '#c41a1a'; g.fillRect(-124, -20, 248, 40);
        g.fillStyle = '#f6f3ea'; g.fillRect(-118, -13, 236, 26);
        g.restore();
      }
      g.fillStyle = '#c41a1a'; g.fillRect(-20, -20, 40, 40); g.fillStyle = '#f6f3ea'; g.fillRect(-13, -13, 26, 26);
    });
    const crossMat = K.std({ map: crossTex, alphaTest: 0.5, side: T.DoubleSide, roughness: 0.5 });
    const boomTex = TX.labelTexture(256, 16, (g) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f4f1e8' : '#d0201c'; g.fillRect(i * 32, 0, 32, 16); } });
    const boomMat = K.std({ map: boomTex, roughness: 0.45 });
    const panelTex = (() => {
      const c = TX.paint(128, 128, (x, y, u, v, o) => { const rib = (Math.floor(v * 32) % 2) * 10; const n = Math.random() * 10; o[0] = o[1] = 46 + rib + n; o[2] = 50 + rib + n; });
      const g = c.getContext('2d'); g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 2; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, 128); g.stroke(); }
      return TX.toTexture(c);
    })();
    const panelMat = K.std({ map: panelTex, roughness: 0.85 });
    A.lcVis = [];
    const haloTex = TX.blobShadowTexture();
    for (const c of A.lc) {
      const ra = rail.at(c.railS).angle;
      // panels: between and beside the rails, across the full road width
      for (const o of [-1.45, 0, 1.45]) {
        const [px, pz] = local(c.x, c.z, ra + PI / 2, o, 0);
        K.mesh(new T.BoxGeometry(17, 0.12, o === 0 ? 1.3 : 1.05), panelMat, px, 0.1, pz, { ry: -ra, cast: false });
      }
      const lmA = K.std({ color: 0x3a0806, emissive: 0xff2010, emissiveIntensity: 0, roughness: 0.3 }), lmB = lmA.clone(), lmBoom = lmA.clone();
      const haloA = new T.MeshBasicMaterial({ color: 0xff3a1a, alphaMap: haloTex, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending }), haloB = haloA.clone();
      const lights = [[], []], halos = [[], []];
      const vis = { booms: [], mats: [lmA, lmB, lmBoom], halos: [haloA, haloB] };
      // equipment on the right-hand side for both directions of travel
      for (const dir of [1, -1]) {
        const ha = c.angle + (dir < 0 ? PI : 0); // heading of traffic approaching from this side
        const [bx, bz] = local(c.x, c.z, ha, -4.3, 8.9);
        warnRoad('crossing post', bx, bz, 0.5);
        const M = new T.Matrix4().compose(new T.Vector3(bx, 0, bz), new T.Quaternion().setFromEuler(new T.Euler(0, -ha, 0)), new T.Vector3(1, 1, 1));
        const P = (g, col, o, mat = vc) => { const gg = colorize(xf(g, o), col); gg.applyMatrix4(M); bake(gg, mat, bx, bz); };
        P(new T.CylinderGeometry(0.13, 0.15, 6.2, 10), 0xf2f0ea, { y: 3.1 });
        for (let b = 0; b < 4; b++) P(new T.CylinderGeometry(0.155, 0.155, 0.45, 10), 0x1b1b1b, { y: 0.5 + b * 1.2 });
        P(new T.PlaneGeometry(3.4, 3.4), 0xffffff, { x: -0.2, y: 5.4, ry: -PI / 2 }, crossMat);
        P(new K.RoundedBoxGeometry(0.3, 1.0, 2.1, 2, 0.12), 0x151515, { x: -0.25, y: 3.7 });
        P(new K.RoundedBoxGeometry(0.8, 1.6, 0.9, 2, 0.12), 0xe8e4da, { x: -0.6, y: 0.8, z: -1.2 });
        for (const [k, sz] of [[0, -0.55], [1, 0.55]]) {
          P(new T.CylinderGeometry(0.3, 0.3, 0.3, 12, 1, true, 0, PI), 0x111111, { x: -0.55, y: 3.82, z: sz, rz: PI / 2 }, vcDouble);
          lights[k].push(tidy(xf(new T.SphereGeometry(0.2, 12, 8), { x: -0.45, y: 3.7, z: sz }).applyMatrix4(M)));
          halos[k].push(tidy(xf(new T.PlaneGeometry(1.8, 1.8), { x: -0.75, y: 3.7, z: sz, ry: -PI / 2 }).applyMatrix4(M)));
        }
        // the half-barrier: a red-white boom over the right-hand lane, pivoting beside the road
        const pivot = new T.Group();
        pivot.position.copy(new T.Vector3(-0.6, 1.25, -1.2).applyMatrix4(M));
        pivot.rotation.order = 'YXZ'; pivot.rotation.y = -ha;
        const boom = new T.Mesh(new T.BoxGeometry(0.24, 0.24, 8.2).translate(0, 0, -4.1), boomMat); boom.castShadow = true; pivot.add(boom);
        const bl = new T.Mesh(merge([-2.5, -5.5, -8.0].map((z) => new T.SphereGeometry(0.12, 8, 6).translate(0, 0.17, z))), lmBoom); pivot.add(bl);
        K.group.add(pivot); keep.push(pivot);
        vis.booms.push(pivot);
        AO(bx, bz, 1.4, 1.4, 0.35);
      }
      for (const k of [0, 1]) {
        const lm = new T.Mesh(merge(lights[k]), k ? lmB : lmA); K.group.add(lm); keep.push(lm);
        const hm = new T.Mesh(merge(halos[k]), k ? haloB : haloA); hm.renderOrder = 3; K.group.add(hm); keep.push(hm);
      }
      A.lcVis.push(vis);
    }

    // ---------------------------------------------------------------- the train: tank loco, coach, van, timber wagon (merged, vertex coloured)
    {
      const W = (len, parts, fn) => fn(parts, len);
      const box = (P, c, w, h, d, x, y, z, o = {}) => P.push(colorize(xf(new T.BoxGeometry(w, h, d), { x, y, z, ...o }), c));
      const rbox = (P, c, w, h, d, x, y, z, rad = 0.15, o = {}) => P.push(colorize(xf(new K.RoundedBoxGeometry(w, h, d, 2, rad), { x, y, z, ...o }), c));
      const cyl = (P, c, r1, r2, h, x, y, z, o = {}, seg = 16) => P.push(colorize(xf(new T.CylinderGeometry(r1, r2, h, seg), { x, y, z, ...o }), c));
      const wheelset = (P, x, rad, col = 0x2a2a2a) => {
        for (const sz of [-0.83, 0.83]) { cyl(P, col, rad, rad, 0.22, x, rad, sz, { rx: PI / 2 }, 18); cyl(P, 0x9a9a9a, rad * 0.35, rad * 0.35, 0.26, x, rad, sz, { rx: PI / 2 }, 10); }
        cyl(P, 0x333333, 0.12, 0.12, 1.5, x, rad, 0, { rx: PI / 2 }, 6);
      };
      const buffers = (P, len, y, col = 0x1c1c1c) => {
        for (const e of [-1, 1]) for (const sz of [-0.95, 0.95]) {
          cyl(P, col, 0.13, 0.13, 0.5, e * (len / 2 - 0.1), y, sz, { rz: PI / 2 }, 8);
          cyl(P, 0xb0b0b0, 0.26, 0.26, 0.08, e * (len / 2 + 0.12), y, sz, { rz: PI / 2 }, 12);
        }
      };
      const roofArc = (P, c, len, wid, y) => { const g = new T.CylinderGeometry(wid / 2, wid / 2, len, 20, 1, false, 0, PI); xf(g, { rz: PI / 2 }); xf(g, { sy: 0.32, y }); P.push(colorize(g, c)); };
      const vehicles = [];
      // 0: tank loco (black, red frames)
      vehicles.push(W(TRAIN.lens[0], [], (P, len) => {
        const red = 0x8e1b14, blk = 0x1c1d1f, brass = 0xc9a24a;
        box(P, red, len - 0.6, 0.45, 2.7, 0, 1.25, 0);
        box(P, red, 0.35, 0.9, 3.0, len / 2 - 0.35, 1.05, 0); box(P, red, 0.35, 0.9, 3.0, -len / 2 + 0.35, 1.05, 0);
        for (const wx of [-2.6, 0, 2.6]) {
          for (const sz of [-1.08, 1.08]) { cyl(P, red, 0.8, 0.8, 0.2, wx + 1.2, 0.8, sz, { rx: PI / 2 }, 20); cyl(P, 0x2a2a2a, 0.82, 0.82, 0.12, wx + 1.2, 0.8, sz * 0.96, { rx: PI / 2 }, 20); }
        }
        for (const sz of [-1.22, 1.22]) box(P, 0xb8b8b8, 5.6, 0.16, 0.08, 1.2, 0.95, sz);
        for (const sz of [-1.15, 1.15]) cyl(P, blk, 0.42, 0.42, 1.4, 4.8, 1.25, sz, { rz: PI / 2 }, 12);
        cyl(P, blk, 1.12, 1.12, 6.0, 2.6, 2.75, 0, { rz: PI / 2 }, 24);
        cyl(P, 0x111214, 1.2, 1.2, 1.1, 5.45, 2.75, 0, { rz: PI / 2 }, 24);
        cyl(P, 0x2a2a2a, 0.9, 0.9, 0.12, 6.02, 2.75, 0, { rz: PI / 2 }, 20);
        cyl(P, blk, 0.36, 0.42, 1.25, 5.1, 4.35, 0, {}, 14);
        cyl(P, blk, 0.48, 0.38, 0.18, 5.1, 5.0, 0, {}, 14);
        cyl(P, brass, 0.5, 0.58, 0.55, 2.6, 4.05, 0, {}, 14);
        P.push(colorize(xf(new T.SphereGeometry(0.5, 14, 8, 0, TAU, 0, PI / 2), { x: 2.6, y: 4.3 }), brass));
        cyl(P, blk, 0.4, 0.48, 0.5, 0.6, 3.95, 0, {}, 12);
        for (const sz of [-1.18, 1.18]) { rbox(P, blk, 4.8, 1.75, 0.62, 2.35, 2.55, sz, 0.1); box(P, red, 4.6, 0.07, 0.04, 2.35, 3.35, sz * 1.27); box(P, red, 4.6, 0.07, 0.04, 2.35, 1.78, sz * 1.27); }
        rbox(P, blk, 3.2, 2.95, 2.9, -2.4, 2.95, 0, 0.12);
        rbox(P, 0x262626, 3.7, 0.22, 3.2, -2.4, 4.5, 0, 0.1);
        for (const sz of [-1.46, 1.46]) { box(P, 0x0b1218, 1.1, 0.95, 0.06, -2.0, 3.55, sz); box(P, red, 2.6, 0.07, 0.04, -2.4, 2.4, sz * 1.0); }
        for (const sx of [-0.85, 0.85]) box(P, 0x0b1218, 0.06, 0.75, 0.7, -0.78, 3.7, sx);
        box(P, blk, 2.0, 1.7, 2.6, -5.0, 2.3, 0);
        P.push(colorize(xf(new T.DodecahedronGeometry(1, 1), { x: -5.0, y: 3.2, sx: 0.95, sy: 0.35, sz: 1.2 }), 0x0d0d0d));
        for (const sz of [-0.8, 0.8]) { cyl(P, 0xf0ead8, 0.16, 0.16, 0.2, 6.15, 1.75, sz, { rz: PI / 2 }, 8); }
        buffers(P, len, 1.05);
        return merge(P);
      }));
      // 1: two-axle coach, bottle green with a grey roof
      vehicles.push(W(TRAIN.lens[1], [], (P, len) => {
        const g = 0x2d5a3c;
        box(P, 0x2a2a2a, len - 1.2, 0.4, 2.4, 0, 1.0, 0);
        for (const wx of [-5.2, 5.2]) wheelset(P, wx, 0.55);
        for (const wx of [-5.2, 5.2]) box(P, 0x222222, 2.0, 0.5, 2.7, wx, 0.9, 0);
        rbox(P, g, len - 1.6, 2.5, 2.95, 0, 2.5, 0, 0.12);
        box(P, 0x24482f, len - 1.4, 0.12, 3.02, 0, 1.3, 0);
        for (const sz of [-1.49, 1.49]) {
          box(P, 0xd8cfae, len - 2.0, 0.06, 0.04, 0, 3.55, sz * 1.0);
          for (let k = 0; k < 6; k++) box(P, 0x0f1a20, 1.25, 1.0, 0.05, -5 + k * 2, 3.0, sz);
        }
        for (const e of [-1, 1]) { box(P, 0x1e1e1e, 0.7, 0.12, 2.6, e * (len / 2 - 0.55), 1.45, 0); for (const sz of [-1.2, 1.2]) box(P, 0x111111, 0.06, 1.6, 0.06, e * (len / 2 - 0.35), 2.2, sz); }
        roofArc(P, 0x707274, len - 0.9, 3.2, 3.75);
        for (let k = 0; k < 4; k++) cyl(P, 0x5c5e60, 0.18, 0.2, 0.3, -4.5 + k * 3, 4.28, 0, {}, 8);
        buffers(P, len, 1.05);
        return merge(P);
      }));
      // 2: covered van, oxide red with a grey roof
      vehicles.push(W(TRAIN.lens[2], [], (P, len) => {
        const ox = 0x7c3424;
        box(P, 0x262626, len - 0.8, 0.4, 2.4, 0, 1.0, 0);
        for (const wx of [-3.2, 3.2]) { wheelset(P, wx, 0.55); box(P, 0x222222, 1.8, 0.5, 2.7, wx, 0.9, 0); }
        rbox(P, ox, len - 1.2, 2.75, 2.9, 0, 2.55, 0, 0.08);
        for (const sz of [-1.47, 1.47]) {
          box(P, 0x5a2418, 3.2, 2.5, 0.05, 0, 2.5, sz);
          box(P, 0x2a2a2a, 3.6, 0.1, 0.07, 0, 3.8, sz); box(P, 0x2a2a2a, 3.6, 0.1, 0.07, 0, 1.25, sz);
          for (const x of [-3.6, -2.2, 2.2, 3.6]) box(P, 0x5a2418, 0.12, 2.6, 0.06, x, 2.55, sz);
          box(P, 0x5a2418, 0.1, 2.2, 0.06, -1.45, 2.55, sz, { rz: 0.9 }); box(P, 0x5a2418, 0.1, 2.2, 0.06, 1.45, 2.55, sz, { rz: -0.9 });
        }
        roofArc(P, 0x6a6a68, len - 0.8, 3.1, 3.92);
        buffers(P, len, 1.05);
        return merge(P);
      }));
      // 3: stake wagon with logs
      vehicles.push(W(TRAIN.lens[3], [], (P, len) => {
        box(P, 0x2b2b2b, len - 0.8, 0.45, 2.4, 0, 1.0, 0);
        for (const wx of [-3.4, 3.4]) { wheelset(P, wx, 0.55); box(P, 0x222222, 1.8, 0.5, 2.7, wx, 0.9, 0); }
        box(P, 0x6b5136, len - 0.9, 0.22, 2.9, 0, 1.36, 0);
        for (const x of [-4.4, -1.5, 1.5, 4.4]) for (const sz of [-1.38, 1.38]) box(P, 0x3a3a3a, 0.16, 2.4, 0.16, x, 2.6, sz);
        const logC = [0x7a5a3a, 0x6a4c30, 0x8a6a46];
        let k = 0;
        for (const [ly, lzs] of [[1.95, [-0.95, 0, 0.95]], [2.75, [-0.5, 0.5]], [3.5, [0]]]) for (const lz of lzs) {
          cyl(P, logC[k % 3], 0.44, 0.48, len - 1.4 - (k % 2) * 0.6, (k % 2) * 0.3, ly, lz, { rz: PI / 2 }, 10);
          for (const e of [-1, 1]) cyl(P, 0xd8b88a, 0.4, 0.4, 0.04, e * ((len - 1.4 - (k % 2) * 0.6) / 2 + 0.01) + (k % 2) * 0.3, ly, lz, { rz: PI / 2 }, 10);
          k++;
        }
        buffers(P, len, 1.05);
        return merge(P);
      }));
      const trainMat = K.phys({ vertexColors: true, roughness: 0.42, metalness: 0.15, clearcoat: 0.35, clearcoatRoughness: 0.35 });
      A.trainMeshes = vehicles.map((g) => { const m = new T.Mesh(g, trainMat); m.castShadow = true; m.receiveShadow = true; K.group.add(m); keep.push(m); return m; });
      A.trainShadow = TRAIN.lens.map((l) => { const m = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.4, alphaMap: TX.blobShadowTexture(), depthWrite: false })); m.rotation.x = -PI / 2; m.scale.set(l + 1.5, 4.2, 1); m.renderOrder = 1; K.group.add(m); keep.push(m); return m; });
      // one capsule per vehicle shoves anything caught on the rails
      TRAIN.lens.forEach((len, i) => {
        K.mover({ type: 'capsule', r: TRAIN.r, h: TRAIN.h }, (t) => {
          const hs = A.sStop + trainRun(t)[0] - A.off[i];
          const p = rail.at(hs - 1.0), q = rail.at(hs - len + 1.0);
          return { x1: p.x, z1: p.z, x2: q.x, z2: q.z };
        });
      });
    }

    // ---------------------------------------------------------------- viaduct: ramps, deck, parapets, arches over the gorge
    {
      const { s0, s1, s2, s3, h } = VIA;
      const pu = track.at((s0 + s1) / 2), pd = track.at((s2 + s3) / 2), pm = track.at((s1 + s2) / 2);
      K.ramp(pu.x, pu.z, pu.angle, s1 - s0, 16.4, h, 0);
      K.ramp(pd.x, pd.z, pd.angle + PI, s3 - s2, 16.4, h, 0);
      K.platform(pm.x, pm.z, (s2 - s1) / 2 + 0.6, 8.2, pm.angle, h);
      // parapet / retaining walls (stone) and their colliders
      for (const side of [-1, 1]) {
        const pos = [], uv = [], col = [], idx = [];
        let n = 0;
        for (let s = s0 - 1.5; s <= s3 + 1.5; s += 0.75) {
          const p = track.at(s), top = roadY(s) + 1.15, deck = s > s1 && s < s2;
          const bot = deck ? h - 0.9 : -0.6;
          for (const [o, y, u, c] of [[7.5, bot, 0, 0.85], [7.5, top, 1, 0.95], [7.5, top + 0.15, 1.1, 1.25], [8.5, top + 0.15, 1.4, 1.25], [8.5, top, 1.5, 0.95], [8.5, bot, 2.5, 0.85]]) {
            pos.push(p.x + p.nx * o * side, y, p.z + p.nz * o * side); uv.push(s / 4, (y + u) / 2); col.push(c, c, c);
          }
          n++;
        }
        for (let i = 0; i < n - 1; i++) for (let j = 0; j < 5; j++) { const a = i * 6 + j, b = a + 1, c = a + 6, d = c + 1; idx.push(a, b, c, b, d, c); }
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
        g.setIndex(idx); g.computeVertexNormals();
        const m = new T.Mesh(g, K.std({ map: stoneMapL, vertexColors: true, roughness: 0.88, side: T.DoubleSide })); m.castShadow = true; m.receiveShadow = true; keep.push(m); K.group.add(m);
        for (let s = s0 - 1; s < s3 + 1; s += 3) { const a = track.place(s, side * 8.05), b = track.place(Math.min(s + 3, s3 + 1), side * 8.05); K.capsule(a.x, a.z, b.x, b.z, 0.5, h + 1.6); }
      }
      // arches: an extruded stone wall with three arched openings, spanning the gorge under the deck
      const span = s2 - s1 + 7, half = span / 2, nA = 3, pier = 2.6;
      const aw = (span - 4 - (nA - 1) * pier) / nA;
      const shape = new T.Shape();
      shape.moveTo(-half, -9); shape.lineTo(half, -9); shape.lineTo(half, h - 0.5); shape.lineTo(-half, h - 0.5); shape.closePath();
      for (let k = 0; k < nA; k++) {
        const x0 = -half + 2 + k * (aw + pier), x1 = x0 + aw, xc = (x0 + x1) / 2, rad = aw / 2, spring = h - 1.4 - rad;
        const hole = new T.Path();
        hole.moveTo(x0, -8.5); hole.lineTo(x1, -8.5); hole.lineTo(x1, spring);
        hole.absarc(xc, spring, rad, 0, PI, false);
        hole.lineTo(x0, -8.5);
        shape.holes.push(hole);
      }
      const eg = new T.ExtrudeGeometry(shape, { depth: 15.6, bevelEnabled: false, curveSegments: 14 });
      eg.translate(0, 0, -7.8);
      const uvA = eg.attributes.uv; for (let i = 0; i < uvA.count; i++) uvA.setXY(i, uvA.getX(i) / 4, uvA.getY(i) / 2);
      colorize(eg, 0xffffff);
      const vm = new T.Mesh(eg, stoneMat);
      vm.position.set(pm.x, 0, pm.z); vm.rotation.y = -pm.angle;
      vm.castShadow = true; vm.receiveShadow = true; K.group.add(vm);
      // deck slab edge (string course) under the parapets
      for (const side of [-1, 1]) {
        const p = track.place((s1 + s2) / 2, side * 7.9);
        prop(new T.BoxGeometry(span, 0.5, 1.4), 0x9a907e, { x: p.x, y: h - 0.45, z: p.z, ry: -pm.angle });
      }
      // cutwaters at the piers' feet
      for (let k = 1; k < nA; k++) {
        const xL = -half + 2 + k * (aw + pier) - pier / 2;
        for (const e of [-1, 1]) {
          const [cx, cz] = local(pm.x, pm.z, pm.angle, xL, e * 8.3);
          K.mesh(new T.CylinderGeometry(1.3, 1.5, 6, 4), stonePlain, cx, -3.5, cz, { ry: -pm.angle + PI / 4 });
        }
      }
      block(pm.x, pm.z, (s3 - s0) / 2 + 2, 10, pm.angle);
    }

    // ---------------------------------------------------------------- road tunnel: portals, lining, lamps, walls
    {
      const portal = (s, out) => { // out: -1 = the outside is at smaller s (east portal), +1 = west portal
        const p = track.at(s);
        const shape = new T.Shape();
        shape.moveTo(-14, -1); shape.lineTo(14, -1); shape.lineTo(14, 11.5); shape.lineTo(9, 12.6); shape.lineTo(-9, 12.6); shape.lineTo(-14, 11.5); shape.closePath();
        const hole = new T.Path();
        hole.moveTo(-8.1, -0.5); hole.lineTo(8.1, -0.5); hole.lineTo(8.1, 5.6);
        hole.absellipse(0, 5.6, 8.1, 3.6, 0, PI, false);
        hole.lineTo(-8.1, -0.5);
        shape.holes.push(hole);
        const eg = new T.ExtrudeGeometry(shape, { depth: 2.2, bevelEnabled: false, curveSegments: 16 });
        const uvA = eg.attributes.uv; for (let i = 0; i < uvA.count; i++) uvA.setXY(i, uvA.getX(i) / 4, uvA.getY(i) / 2);
        colorize(eg, 0xf0ece4);
        eg.rotateY(PI / 2); // extrusion now along +x (the road direction), face across the road
        eg.translate(out < 0 ? -0.4 : -1.8, 0, 0);
        const m = new T.Mesh(eg, stoneMat); m.position.set(p.x, 0, p.z); m.rotation.y = -p.angle; m.castShadow = true; m.receiveShadow = true; K.group.add(m);
        // keystone + date plaque
        const plaque = TX.labelTexture(128, 48, (g) => { g.fillStyle = '#b3a993'; g.fillRect(0, 0, 128, 48); g.strokeStyle = '#6e6656'; g.lineWidth = 4; g.strokeRect(3, 3, 122, 42); g.fillStyle = '#4a4438'; g.font = '700 30px Georgia, serif'; g.textAlign = 'center'; g.fillText('1897', 64, 35); });
        const [qx, qz] = local(p.x, p.z, p.angle, out * 0.46, 0);
        const pq = K.mesh(new T.PlaneGeometry(3.2, 1.2), K.std({ map: plaque, roughness: 0.8 }), qx, 10.6, qz, { ry: Math.atan2(out * Math.cos(p.angle), out * Math.sin(p.angle)) });
        // wing walls into the rock
        for (const e of [-1, 1]) {
          const [wx, wz] = local(p.x, p.z, p.angle, out * 3.2, e * 15.0);
          K.mesh(new T.BoxGeometry(7, 9, 1.6), stonePlain, wx, 3.6, wz, { ry: -p.angle + e * out * 0.35 });
          K.box(wx, wz, 3.5, 1.0, p.angle - e * out * 0.35, 12);
        }
        return pq;
      };
      portal(TUN.s0, -1); portal(TUN.s1, 1);
      // lining walls + lamps (seen when the mountain turns see-through)
      const lampMat = K.std({ color: 0xfff0c0, emissive: 0xffd27a, emissiveIntensity: 1.4 });
      const lamps = [];
      for (const side of [-1, 1]) {
        const pos = [], uv = [], idx = [];
        let n = 0;
        for (let s = TUN.s0 - 0.5; s <= TUN.s1 + 0.5; s += 1) {
          const p = track.at(s);
          for (const [o, y] of [[8.3, -0.5], [8.3, 6.6], [9.4, 7.8]]) { pos.push(p.x + p.nx * o * side, y, p.z + p.nz * o * side); uv.push(s / 4, y / 2); }
          n++;
        }
        for (let i = 0; i < n - 1; i++) for (let j = 0; j < 2; j++) { const a = i * 3 + j, b = a + 1, c = a + 3, d = c + 1; idx.push(a, b, c, b, d, c); }
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
        g.setIndex(idx); g.computeVertexNormals();
        const m = new T.Mesh(g, K.std({ map: stoneMap, color: 0x8a8478, roughness: 0.9, side: T.DoubleSide })); m.receiveShadow = true; keep.push(m); K.group.add(m);
        for (let s = TUN.s0 - 2; s < TUN.s1 + 2; s += 2.5) { const a = track.place(s, side * 8.8), b = track.place(s + 2.5, side * 8.8); K.capsule(a.x, a.z, b.x, b.z, 0.6, 14); }
        for (let s = TUN.s0 + 5; s < TUN.s1 - 3; s += 8) { const p = track.place(s, side * 8.15); lamps.push({ x: p.x, y: 5.2, z: p.z, ry: -p.angle }); }
      }
      K.instances(new T.BoxGeometry(0.9, 0.35, 0.25), lampMat, lamps, { cast: false });
    }

    // ---------------------------------------------------------------- rock walls: wherever the terrain rises steeply beside the road, cars are stopped
    {
      for (let s = 0; s < L; s += 2.5) {
        if (s > VIA.s0 - 2 && s < VIA.s3 + 2) continue;
        if (s > TUN.s0 - 3 && s < TUN.s1 + 3) continue;
        const p = track.at(s);
        for (const side of [-1, 1]) {
          for (let o = p.w / 2 + 0.8; o < p.w / 2 + 17; o += 0.8) {
            const x = p.x + p.nx * o * side, z = p.z + p.nz * o * side;
            const hh = gy(x, z);
            if (hh > 2.2 && (rockAt(x, z) > 0.3 || hh > 3.5)) { K.circle(x + p.nx * side * 0.9, z + p.nz * side * 0.9, 1.5, Math.max(4, hh)); break; }
            if (hh < -0.7 && roadD(x, z) > 1) { break; }
          }
        }
      }
    }

    // ---------------------------------------------------------------- water: resin river, lake, waterfall, reeds; holes for cars that drive in
    {
      const wn = (() => {
        const S = 256, h = new Float32Array(S * S);
        const nA = TX.noiseField(256, { seed: 81, period: 10, oct: 3 });
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) h[y * S + x] = TX.sampleField(nA, 256, x, y) + 0.15 * Math.sin((x + y * 0.3) * 0.35);
        return TX.toTexture(TX.normalFromHeight(h, S, S, 2.2), { srgb: false });
      })();
      wn.repeat.set(1, 1);
      const resin = K.phys({ color: 0x23463f, roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, normalMap: wn, normalScale: V2(0.25), transparent: true, opacity: 0.86, envMapIntensity: 1.3 });
      A.resin = resin;
      // river ribbon (follows the bed down the gorge)
      const pts = riverPts;
      const pos = [], uv = [], idx = [];
      let acc = 0;
      for (let i = 0; i < pts.length; i++) {
        const [x, z] = pts[i], [x2, z2] = pts[Math.min(pts.length - 1, i + 1)], [x0, z0] = pts[Math.max(0, i - 1)];
        let tx = x2 - x0, tz = z2 - z0; const l = Math.hypot(tx, tz); tx /= l; tz /= l;
        const w = z < -60 ? 3.3 : 4.2;
        const bed = pl(RIVER_BED, z);
        const y = Math.max(bed + (z < -93 ? 0.35 : 0.85), z > -40 ? WATER_Y : -99);
        if (i) acc += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]);
        for (const e of [-1, 1]) { pos.push(x - tz * w * e, y, z + tx * w * e); uv.push(e * 0.25 + 0.5, acc / 10); }
      }
      for (let i = 0; i < pts.length - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals();
      const nr = g.attributes.normal; for (let i = 0; i < nr.count; i++) if (nr.getY(i) < 0) nr.setXYZ(i, -nr.getX(i), -nr.getY(i), -nr.getZ(i));
      const rm = new T.Mesh(g, resin); rm.receiveShadow = true; rm.renderOrder = 1; keep.push(rm); K.group.add(rm);
      // lake
      const lp = [];
      for (let k = 0; k < 64; k++) { const a = (k / 64) * TAU, rr = lakeR(a) - 0.6; lp.push([LAKE.x + Math.cos(a) * rr, LAKE.z + Math.sin(a) * rr]); }
      const lake = K.flatShape(lp, resin, WATER_Y);
      lake.renderOrder = 1;
      // waterfall: silicone streaks down the step in the gorge
      {
        const c = TX.makeCanvas(128, 256), wg = c.getContext('2d');
        wg.fillStyle = 'rgba(220,235,240,0.0)'; wg.fillRect(0, 0, 128, 256);
        const q = K.rng(5);
        for (let i = 0; i < 70; i++) { const x = 14 + q() * 100; wg.strokeStyle = `rgba(${235 + q() * 20},${245},${255},${0.25 + q() * 0.5})`; wg.lineWidth = 1 + q() * 4; wg.beginPath(); wg.moveTo(x, 0); wg.bezierCurveTo(x + (q() - 0.5) * 6, 80, x + (q() - 0.5) * 10, 170, x + (q() - 0.5) * 12, 256); wg.stroke(); }
        const fadeG = wg.createLinearGradient(0, 0, 0, 40); fadeG.addColorStop(0, 'rgba(0,0,0,1)'); fadeG.addColorStop(1, 'rgba(0,0,0,0)');
        wg.globalCompositeOperation = 'destination-out'; wg.fillStyle = fadeG; wg.fillRect(0, 0, 128, 40); wg.globalCompositeOperation = 'source-over';
        const wt = TX.toTexture(c, { wrap: false });
        const wf = K.mesh(new T.PlaneGeometry(6.2, 15.5, 1, 8), K.std({ map: wt, transparent: true, depthWrite: false, roughness: 0.2, side: T.DoubleSide, emissive: 0x334044, emissiveMap: wt }), -74.6, 4.6, -93.2, { rx: -0.25, cast: false });
        keep.push(wf); A.fall = wt;
        // foam at its foot
        const foam = [];
        for (let i = 0; i < 40; i++) foam.push({ x: -74.5 + r.range(-3.2, 3.2), y: -3.3, z: -90 + r.range(-1.4, 3), s: r.range(0.3, 0.8), sy: 0.3 });
        K.instances(new T.IcosahedronGeometry(1, 1), K.std({ color: 0xf4fbff, roughness: 0.3, transparent: true, opacity: 0.85 }), foam, { cast: false });
      }
      // reeds and rushes around the lake and along the river banks
      const reedGeo = new T.ConeGeometry(0.07, 1, 4, 1); reedGeo.translate(0, 0.5, 0);
      const reeds = [];
      const reedCols = [0x7d8a3c, 0x9a9a48, 0x6b7a34, 0xb2a05a, 0x8a9440];
      const clump = (x, z, n) => { for (let k = 0; k < n; k++) { const a = r() * TAU, d = r() * 1.2; reeds.push({ x: x + Math.cos(a) * d, y: gy(x, z) - 0.1, z: z + Math.sin(a) * d, rx: r.range(-0.25, 0.25), rz: r.range(-0.25, 0.25), sy: r.range(1.4, 3.0), sx: 1, sz: 1, color: r.pick(reedCols) }); } };
      for (let k = 0; k < 46; k++) { const a = r() * TAU, rr = lakeR(a) - r.range(-0.4, 1.4); clump(LAKE.x + Math.cos(a) * rr, LAKE.z + Math.sin(a) * rr, 7 + ((r() * 8) | 0)); }
      for (let i = 50; i < pts.length - 2; i += 2) { for (const e of [-1, 1]) { if (r() < 0.55) { const [x, z] = pts[i]; const [x2, z2] = pts[i + 1]; let tx = x2 - x, tz = z2 - z; const l = Math.hypot(tx, tz); const o = 4.6 + r() * 0.8; const px = x - (tz / l) * o * e, pz = z + (tx / l) * o * e; if (roadD(px, pz) > 3 && railD(px, pz) > 4) clump(px, pz, 5 + ((r() * 5) | 0)); } } }
      K.instances(reedGeo, K.std({ color: 0xffffff, roughness: 0.8 }), reeds, { colors: true, cast: false });
      // water lilies
      const lilies = [];
      for (let k = 0; k < 22; k++) { const a = r() * TAU, rr = lakeR(a) - r.range(2.5, 6); lilies.push({ x: LAKE.x + Math.cos(a) * rr, y: WATER_Y + 0.03, z: LAKE.z + Math.sin(a) * rr, ry: r() * TAU, s: r.range(0.45, 0.8), color: r.pick([0x3f7a34, 0x4d8a3a, 0x356a2c]) }); }
      const lilyGeo = new T.CylinderGeometry(1, 1, 0.05, 12, 1, false, 0.4, TAU - 0.4);
      K.instances(lilyGeo, K.std({ color: 0xffffff, roughness: 0.5 }), lilies, { colors: true, cast: false });
      const flw = lilies.filter(() => r() < 0.4).map((l) => ({ x: l.x + 0.2, y: WATER_Y + 0.18, z: l.z, s: 0.22, color: r.pick([0xffffff, 0xf6c6d8]) }));
      K.instances(new T.IcosahedronGeometry(1, 0), K.std({ color: 0xffffff, roughness: 0.4 }), flw, { colors: true, cast: false });
      // holes: a car that drives into the river or lake drops in
      for (let i = 0; i < pts.length; i += 3) {
        const [x, z] = pts[i];
        if (z < -60) continue;
        if (railD(x, z) < 5 || roadD(x, z) < 4) continue;
        K.hole(x, z, 3.4);
      }
      for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU, rr = lakeR(a) - 6; K.hole(LAKE.x + Math.cos(a) * rr, LAKE.z + Math.sin(a) * rr, 6); }
      K.hole(LAKE.x, LAKE.z, 9);
      // rowing boat with an angler
      {
        const bx = LAKE.x + 4, bz = LAKE.z - 3;
        const hull = K.lathe([[0.01, 0], [1.1, 0.12], [1.4, 0.5], [1.5, 0.9]], 16);
        const bm = K.mesh(hull, K.std({ color: 0x9a5a32, roughness: 0.6, side: T.DoubleSide }), bx, WATER_Y - 0.35, bz);
        bm.scale.set(2.4, 0.8, 1);
        bm.rotation.y = 0.5;
        K.mesh(new T.BoxGeometry(0.5, 0.12, 2.6), K.std({ color: 0x6a3c20 }), bx, WATER_Y + 0.35, bz, { ry: 0.5 });
        A.angler = [bx, bz];
      }
    }

    // ---------------------------------------------------------------- rail girder bridge over the river
    {
      const s = rail.distTo(-65, RC.cz - RC.R).s, p = rail.at(s);
      for (const e of [-1, 1]) {
        const [gx, gz] = local(p.x, p.z, p.angle, 0, e * 2.25);
        prop(new T.BoxGeometry(13, 1.5, 0.22), 0x3c4a3f, { x: gx, y: 0.35, z: gz, ry: -p.angle }, vcSatin);
        prop(new T.BoxGeometry(13, 0.18, 0.8), 0x2f3a33, { x: gx, y: 1.1, z: gz, ry: -p.angle }, vcSatin);
        for (const a of [-1, 1]) { const [ax, az] = local(p.x, p.z, p.angle, a * 7.2, e * 0.6); K.mesh(new T.BoxGeometry(2.2, 3.6, 5.8), stonePlain, ax, -1.4, az, { ry: -p.angle }); }
      }
    }

    // ---------------------------------------------------------------- buildings
    const facade = (kind) => { // 8 units wide x 12 tall per tile, 32 px per unit
      const c = TX.makeCanvas(256, 384), g = c.getContext('2d');
      const rr = K.rng(100 + kind.length * 7 + kind.charCodeAt(0));
      const Y = (u) => 384 - u * 32, X = (u) => u * 32;
      const plaster = { half: '#f1ebdc', yellow: '#e9cf86', pink: '#e8b9a6', chalet: '#f3efe6', barn: '#7a5a3c', church: '#f4f1ea', station: '#d9c49a', grey: '#d8d6cf' }[kind];
      g.fillStyle = plaster; g.fillRect(0, 0, 256, 384);
      for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${rr() < 0.5 ? '255,255,255' : '60,50,40'},${0.03 + rr() * 0.05})`; g.fillRect(rr() * 256, rr() * 384, 2 + rr() * 3, 2 + rr() * 3); }
      // plinth
      g.fillStyle = kind === 'barn' ? '#8a8378' : '#9c968a'; g.fillRect(0, Y(0.7), 256, 0.7 * 32);
      g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(0, Y(0.7), 256, 3);
      const win = (cx, y0, w, hgt, shutter = null, arch = false, frame = '#f6f4ee', box = false) => {
        if (shutter) { g.fillStyle = shutter; g.fillRect(X(cx - w / 2 - 0.55), Y(y0 + hgt), 0.5 * 32, hgt * 32); g.fillRect(X(cx + w / 2 + 0.05), Y(y0 + hgt), 0.5 * 32, hgt * 32); g.fillStyle = 'rgba(0,0,0,0.25)'; for (let k = 1; k < 6; k++) { g.fillRect(X(cx - w / 2 - 0.55), Y(y0 + hgt) + k * hgt * 32 / 6, 16, 1.5); g.fillRect(X(cx + w / 2 + 0.05), Y(y0 + hgt) + k * hgt * 32 / 6, 16, 1.5); } }
        g.fillStyle = frame; g.fillRect(X(cx - w / 2 - 0.1), Y(y0 + hgt + 0.1), (w + 0.2) * 32, (hgt + 0.2) * 32);
        if (arch) { g.beginPath(); g.arc(X(cx), Y(y0 + hgt), (w / 2 + 0.1) * 32, PI, 0); g.fill(); }
        const gr = g.createLinearGradient(0, Y(y0 + hgt), 0, Y(y0)); gr.addColorStop(0, '#2c3a44'); gr.addColorStop(1, '#16202a');
        g.fillStyle = gr; g.fillRect(X(cx - w / 2 + 0.06), Y(y0 + hgt - 0.06), (w - 0.12) * 32, (hgt - 0.12) * 32);
        if (arch) { g.beginPath(); g.arc(X(cx), Y(y0 + hgt - 0.06), (w / 2 - 0.06) * 32, PI, 0); g.fill(); }
        g.fillStyle = frame; g.fillRect(X(cx) - 1.5, Y(y0 + hgt), 3, hgt * 32); g.fillRect(X(cx - w / 2), Y(y0 + hgt * 0.62), w * 32, 3);
        g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(X(cx - w / 2 + 0.1), Y(y0 + hgt - 0.1), 6, hgt * 18);
        if (box) { g.fillStyle = '#5a3a22'; g.fillRect(X(cx - w / 2 - 0.2), Y(y0 + 0.05), (w + 0.4) * 32, 8); for (let k = 0; k < 9; k++) { g.fillStyle = rr() < 0.7 ? '#d8242a' : '#f05a8a'; g.beginPath(); g.arc(X(cx - w / 2) + rr() * w * 32, Y(y0 + 0.2) - rr() * 6, 3 + rr() * 2.5, 0, TAU); g.fill(); } g.fillStyle = '#3f7a2c'; for (let k = 0; k < 6; k++) g.fillRect(X(cx - w / 2) + rr() * w * 32, Y(y0 + 0.05) - 4, 4, 4); }
      };
      if (kind === 'half') {
        for (const cx of [2, 6]) win(cx, 1.3, 1.1, 1.5, '#3f6a3a', false, '#f6f4ee', true);
        // timber frame on the upper floors
        g.fillStyle = '#4a2e1c';
        const beam = (x0, y0, x1, y1, w = 0.32) => { g.lineWidth = w * 32; g.strokeStyle = '#4a2e1c'; g.beginPath(); g.moveTo(X(x0), Y(y0)); g.lineTo(X(x1), Y(y1)); g.stroke(); };
        for (const fy of [3.9, 4.25, 7.4, 7.8, 11.3]) beam(0, fy, 8, fy, 0.3);
        for (let px = 0; px <= 8; px += 2) { beam(px, 4.1, px, 7.6); beam(px, 7.6, px, 11.4); }
        for (const [a, b] of [[0, 2], [6, 8]]) { beam(a, 4.25, b, 7.4); beam(a, 7.8, b, 11.3); }
        beam(2, 4.25, 3, 5.4); beam(4, 4.25, 3, 5.4); beam(4, 7.8, 5, 9); beam(6, 7.8, 5, 9);
        for (const cx of [3, 5]) win(cx, 5.2, 1.0, 1.4, null, false, '#f6f4ee', true);
        for (const cx of [1, 7]) win(cx, 8.7, 0.9, 1.3, null, false, '#f6f4ee');
      } else if (kind === 'yellow' || kind === 'pink' || kind === 'grey') {
        const sh = kind === 'yellow' ? '#3a6a46' : kind === 'pink' ? '#f4f0e6' : '#6a4a2e';
        for (const cx of [2, 6]) { win(cx, 1.3, 1.1, 1.55, sh, false, '#f6f4ee', kind === 'pink'); win(cx, 4.9, 1.1, 1.55, sh, false, '#f6f4ee', true); win(cx, 8.5, 0.9, 1.3, null); }
        g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, Y(4.0), 256, 6); g.fillRect(0, Y(7.6), 256, 6);
        g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(0, Y(4.0) - 4, 256, 4);
      } else if (kind === 'chalet') {
        for (const cx of [2, 6]) win(cx, 1.3, 1.2, 1.5, '#7a3a1e', false, '#f6f4ee');
        const wd = g.createLinearGradient(0, 0, 0, 1); g.fillStyle = '#6b4426'; g.fillRect(0, 0, 256, Y(4.0));
        for (let y = 0; y < Y(4.0); y += 9) { g.fillStyle = `rgba(0,0,0,${0.18 + rr() * 0.12})`; g.fillRect(0, y, 256, 1.5); g.fillStyle = `rgba(255,220,180,${0.05 + rr() * 0.05})`; g.fillRect(0, y + 2, 256, 2); }
        for (const cx of [2, 6]) win(cx, 5.0, 1.2, 1.5, '#7a3a1e', false, '#efe6d2', true);
        // balcony rail line
        g.fillStyle = '#4a2c16'; g.fillRect(0, Y(5.1), 256, 9);
        for (let x = 4; x < 256; x += 12) { g.fillStyle = '#5a3820'; g.fillRect(x, Y(5.1) - 30, 6, 30); }
        g.fillStyle = '#4a2c16'; g.fillRect(0, Y(6.1), 256, 6);
        for (let k = 0; k < 40; k++) { g.fillStyle = rr() < 0.75 ? '#d8242a' : '#f06a9a'; g.beginPath(); g.arc(rr() * 256, Y(6.15) - rr() * 8, 3 + rr() * 2.5, 0, TAU); g.fill(); }
        for (const cx of [2, 6]) win(cx, 8.6, 0.9, 1.3, null, false, '#efe6d2');
      } else if (kind === 'barn') {
        for (let x = 0; x < 256; x += 14) { g.fillStyle = `rgba(0,0,0,${0.25 + rr() * 0.15})`; g.fillRect(x, 0, 2, Y(0.7)); g.fillStyle = `rgba(255,230,190,${0.04 + rr() * 0.06})`; g.fillRect(x + 4, 0, 4, Y(0.7)); }
        g.fillStyle = 'rgba(30,20,10,0.55)'; g.fillRect(X(1.0), Y(4.6), 6 * 32, 3.9 * 32);
        g.strokeStyle = '#3e2a18'; g.lineWidth = 6; g.strokeRect(X(1.0), Y(4.6), 6 * 32, 3.9 * 32);
        g.beginPath(); g.moveTo(X(1.0), Y(4.6)); g.lineTo(X(4), Y(0.7)); g.lineTo(X(7), Y(4.6)); g.stroke();
        win(4, 7.5, 1.0, 1.0, null, false, '#c8b898');
      } else if (kind === 'church') {
        for (const cx of [2, 6]) win(cx, 3.0, 1.3, 4.2, null, true, '#e6e0d2');
        g.fillStyle = 'rgba(180,170,150,0.5)'; g.fillRect(0, Y(9.2), 256, 8);
      } else if (kind === 'station') {
        for (const cx of [2, 6]) { win(cx, 1.2, 1.4, 2.4, null, true, '#e8dcc0'); win(cx, 5.4, 1.1, 1.7, '#2f5a3e', false, '#efe6d2'); }
        g.fillStyle = '#9a4a32'; for (let y = 0; y < 12; y += 1) { g.fillRect(0, Y(y + 1), 14, 15); g.fillRect(242, Y(y + 0.5), 14, 15); }
        g.fillStyle = 'rgba(120,80,50,0.5)'; g.fillRect(0, Y(4.6), 256, 10);
      }
      const t = TX.toTexture(c);
      return K.std({ map: t, roughness: 0.85, vertexColors: true });
    };
    const FAC = {};
    for (const k of ['half', 'yellow', 'pink', 'chalet', 'barn', 'church', 'station', 'grey']) FAC[k] = facade(k);
    const roofTex = (() => {
      const c = TX.makeCanvas(256, 256), g = c.getContext('2d');
      const rr = K.rng(33);
      g.fillStyle = '#d0d0d0'; g.fillRect(0, 0, 256, 256);
      for (let row = 0; row < 16; row++) for (let i = 0; i < 17; i++) {
        const x = i * 16 + (row % 2) * 8 - 8, y = row * 16;
        const k = 0.75 + rr() * 0.35;
        g.fillStyle = `rgb(${220 * k | 0},${214 * k | 0},${208 * k | 0})`;
        g.beginPath(); g.moveTo(x + 1, y); g.lineTo(x + 15, y); g.lineTo(x + 15, y + 11); g.quadraticCurveTo(x + 8, y + 17, x + 1, y + 11); g.closePath(); g.fill();
        g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x + 1, y + 13, 14, 3);
      }
      return TX.toTexture(c);
    })();
    const roofMat = K.std({ map: roofTex, vertexColors: true, roughness: 0.8 });
    const ROOFC = { red: 0xb4573a, brown: 0x8a4a32, slate: 0x5a5e66, dark: 0x6a3a2a, wood: 0x6a5240 };
    // a house: pentagonal prism (walls with a facade texture) + roof slopes + chimney
    const house = ({ x, z, ry = 0, len = 11, dep = 8, wall = 7.2, rise = 3.6, kind = 'half', roof = 'red', over = 0.8, chimney = true, door = true, y0 = null }) => {
      const base = y0 ?? Math.max(0, gy(x, z));
      const pos = [], uv = [], nrm = [];
      const tri = (a, b, c, n, ua, ub, uc) => {
        const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        const cx = e1[1] * e2[2] - e1[2] * e2[1], cy = e1[2] * e2[0] - e1[0] * e2[2], cz = e1[0] * e2[1] - e1[1] * e2[0];
        const flip = cx * n[0] + cy * n[1] + cz * n[2] < 0;
        for (const [p, u] of flip ? [[a, ua], [c, uc], [b, ub]] : [[a, ua], [b, ub], [c, uc]]) { pos.push(...p); uv.push(...u); nrm.push(...n); }
      };
      const quad = (a, b, c, d, n, ua, ub, uc, ud) => { tri(a, b, c, n, ua, ub, uc); tri(a, c, d, n, ua, uc, ud); };
      const hl = len / 2, hd = dep / 2, Wt = 8, Ht = 12, yb = -0.8;
      for (const e of [-1, 1]) {
        quad([-hl, yb, e * hd], [hl, yb, e * hd], [hl, wall, e * hd], [-hl, wall, e * hd], [0, 0, e], [0, yb / Ht], [len / Wt, yb / Ht], [len / Wt, wall / Ht], [0, wall / Ht]);
        // gable end (pentagon = quad + triangle)
        const gx = e * hl;
        quad([gx, yb, -hd], [gx, yb, hd], [gx, wall, hd], [gx, wall, -hd], [e, 0, 0], [0, yb / Ht], [dep / Wt, yb / Ht], [dep / Wt, wall / Ht], [0, wall / Ht]);
        tri([gx, wall, -hd], [gx, wall, hd], [gx, wall + rise, 0], [e, 0, 0], [0, wall / Ht], [dep / Wt, wall / Ht], [dep / 2 / Wt, (wall + rise) / Ht]);
      }
      let wg = new T.BufferGeometry();
      wg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); wg.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); wg.setAttribute('normal', new T.Float32BufferAttribute(nrm, 3));
      const tint = new T.Color(1, 1, 1).multiplyScalar(0.92 + r() * 0.12);
      colorize(wg, tint);
      xf(wg, { x, y: base, z, ry });
      bake(wg, FAC[kind], x, z);
      // roof
      const slope = Math.hypot(hd + over, rise * (hd + over) / hd), pitch = Math.atan2(rise, hd);
      const rc = new T.Color(ROOFC[roof]).multiplyScalar(0.9 + r() * 0.2);
      for (const e of [-1, 1]) {
        const g = new T.BoxGeometry(len + over * 2, 0.3, slope);
        const p = g.attributes.position, u = g.attributes.uv;
        for (let i = 0; i < p.count; i++) u.setXY(i, (p.getX(i) + len) / 3, (p.getZ(i) + slope) / 3);
        xf(g, { rx: e * pitch });
        const mid = (hd + over) / 2;
        xf(g, { z: e * mid, y: wall + rise - rise * (mid / hd) + 0.2 });
        const g2 = colorize(g, rc);
        xf(g2, { x, y: base, z, ry });
        bake(g2, roofMat, x, z);
      }
      const ridge = colorize(xf(new T.CylinderGeometry(0.22, 0.22, len + over * 2, 6), { rz: PI / 2, y: wall + rise + 0.3 }), rc.clone().multiplyScalar(0.8));
      bake(xf(ridge, { x, y: base, z, ry }), vc, x, z);
      if (chimney) {
        const cxl = r.range(-hl * 0.5, hl * 0.5), czl = r.range(-hd * 0.4, hd * 0.4);
        const ch = colorize(xf(new T.BoxGeometry(0.9, 2.6, 0.9), { x: cxl, y: wall + rise - rise * Math.abs(czl) / hd + 0.7, z: czl }), r() < 0.5 ? 0xa8584a : 0xe8e2d6);
        bake(xf(ch, { x, y: base, z, ry }), vc, x, z);
      }
      if (door) {
        const dg = colorize(xf(new T.BoxGeometry(1.4, 2.4, 0.2), { x: r.range(-hl * 0.5, hl * 0.5), y: 1.0, z: hd + 0.05 }), r.pick([0x5a3420, 0x3a5a3a, 0x7a2a1e]));
        bake(xf(dg, { x, y: base, z, ry }), vc, x, z);
      }
      K.box(x, z, hl + 0.2, hd + 0.2, -ry, 20);
      block(x, z, hl + over, hd + over, -ry, 1.5);
      AO(x, z, hl + 2.2, hd + 2.2, 0.45, -ry);
    };

    // village west of the hairpin
    const HOUSES = [
      { x: -31, z: -21, ry: 0, len: 11, dep: 8, kind: 'half' }, { x: -45, z: -17, ry: PI / 2, len: 10, dep: 8, kind: 'yellow', roof: 'brown' },
      { x: -29, z: -5, ry: 0.06, len: 10, dep: 7.5, kind: 'pink' }, { x: -44, z: 1, ry: 0.1, len: 12, dep: 8, kind: 'half', roof: 'dark' },
      { x: -30, z: 12, ry: PI / 2, len: 9, dep: 7, kind: 'chalet', roof: 'wood', rise: 2.6, over: 1.4 }, { x: -46, z: 19, ry: -0.05, len: 10, dep: 8, kind: 'yellow' },
      { x: -31, z: 29, ry: 0, len: 11, dep: 7.5, kind: 'grey', roof: 'slate' }, { x: -2, z: 33, ry: 0, len: 10, dep: 7, kind: 'pink', roof: 'brown' },
      { x: 17, z: 34, ry: 0.04, len: 11, dep: 7, kind: 'half' }, { x: 59, z: 4, ry: PI / 2, len: 13, dep: 10, kind: 'chalet', roof: 'wood', rise: 2.8, over: 1.6 },
      // farm
      { x: 84, z: 18, ry: 0, len: 15, dep: 11, kind: 'chalet', roof: 'wood', rise: 3, over: 1.8, wall: 7.6 },
      { x: 98, z: -2, ry: PI / 2, len: 17, dep: 11, kind: 'barn', roof: 'slate', rise: 4, chimney: false, door: false, wall: 6.4 },
      { x: 77, z: -2, ry: 0, len: 8, dep: 6, kind: 'barn', roof: 'red', rise: 2.4, chimney: false, door: false, wall: 4.2 },
      // houses along the start straight / south-west
      { x: -112, z: 38, ry: 0.3, len: 10, dep: 8, kind: 'half', roof: 'red' },
    ];
    for (const hcfg of HOUSES) house(hcfg);

    // church in the hairpin: nave, tower with clock faces, onion dome
    {
      const cx = 17, cz = -12;
      house({ x: cx, z: cz, ry: PI / 2, len: 20, dep: 10, wall: 8.4, rise: 5, kind: 'church', roof: 'red', chimney: false, door: false });
      // apse
      const apse = colorize(xf(new T.CylinderGeometry(4.4, 4.4, 8.4, 20, 1, false, 0, PI), { x: cx, y: 4.2 - 0.8, z: cz + 10, ry: -PI / 2 }), 0xf2efe6);
      bake(apse, vc, cx, cz);
      bake(colorize(xf(new T.ConeGeometry(5.0, 3.4, 20, 1, false, 0, PI), { x: cx, y: 8.4 - 0.8 + 1.7, z: cz + 10, ry: -PI / 2 }), 0x5a5e66), vc, cx, cz);
      const tz = cz - 12.5;
      bake(colorize(xf(new T.BoxGeometry(6.2, 19, 6.2), { x: cx, y: 9.5 - 0.8, z: tz }), 0xf4f1ea), vc, cx, cz);
      bake(colorize(xf(new T.BoxGeometry(6.6, 0.5, 6.6), { x: cx, y: 18.5, z: tz }), 0xc8bca6), vc, cx, cz);
      for (const [dx, dz, ry] of [[0, 3.12, 0], [0, -3.12, PI], [3.12, 0, PI / 2], [-3.12, 0, -PI / 2]]) {
        bake(colorize(xf(new T.PlaneGeometry(1.6, 3.0), { x: cx + dx * 1.01, y: 16.2, z: tz + dz * 1.01, ry }), 0x2a2420), vc, cx, cz);
      }
      const clock = TX.labelTexture(128, 128, (g) => {
        g.fillStyle = '#1e2a4a'; g.beginPath(); g.arc(64, 64, 62, 0, TAU); g.fill();
        g.strokeStyle = '#d9b44a'; g.lineWidth = 5; g.beginPath(); g.arc(64, 64, 58, 0, TAU); g.stroke();
        g.fillStyle = '#e8c55a'; for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; g.fillRect(64 + Math.cos(a) * 46 - 3, 64 + Math.sin(a) * 46 - 3, 6, 6); }
        g.strokeStyle = '#e8c55a'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(64, 64); g.lineTo(64, 26); g.moveTo(64, 64); g.lineTo(92, 74); g.stroke();
      });
      const cm = K.std({ map: clock, transparent: true, alphaTest: 0.4, roughness: 0.4 });
      for (const [dx, dz, ry] of [[0, 3.13, 0], [0, -3.13, PI], [3.13, 0, PI / 2], [-3.13, 0, -PI / 2]]) K.mesh(new T.PlaneGeometry(2.6, 2.6), cm, cx + dx * 1.005, 12.5, tz + dz * 1.005, { ry, cast: false });
      const onion = K.lathe([[3.1, 0], [3.0, 0.6], [2.2, 1.0], [2.9, 2.4], [3.2, 3.6], [2.6, 4.9], [1.2, 6.2], [0.5, 7.0], [0.55, 7.5], [0.25, 8.4], [0.15, 9.4], [0.01, 9.6]], 28);
      K.mesh(onion, K.phys({ color: 0x3f7a64, roughness: 0.45, metalness: 0.4, clearcoat: 0.3 }), cx, 18.75, tz);
      K.mesh(new T.BoxGeometry(0.12, 2.0, 0.12), K.metal(0xe0b84a, 0.25), cx, 28.9, tz);
      K.mesh(new T.BoxGeometry(1.1, 0.12, 0.12), K.metal(0xe0b84a, 0.25), cx, 29.3, tz);
      K.box(cx, tz, 3.2, 3.2, 0, 30);
      block(cx, tz, 3.5, 3.5, 0, 1.5); block(cx, cz + 10, 4.5, 4.5, 0, 1);
      AO(cx, tz, 5, 5, 0.5);
      // churchyard wall and gravestones
      const yard = [];
      for (let k = 0; k < 18; k++) { const gx = cx + r.range(-9, -6.5) * (k % 2 ? 1 : -1) * -1, gz = cz + r.range(-6, 10); yard.push({ x: k % 2 ? cx + r.range(6.2, 9) : cx - r.range(6.2, 9), y: 0.5, z: gz, ry: r.range(-0.15, 0.15), color: r.pick([0x8a867e, 0x6e6a62, 0x9a968c]) }); }
      K.instances(new K.RoundedBoxGeometry(1.1, 1.2, 0.3, 2, 0.12), K.std({ color: 0xffffff, roughness: 0.8 }), yard, { colors: true });
    }

    // station: building, platform with canopy, nameboards, benches, lamps
    {
      const sz = RC.cz + RC.R; // rail z on the south straight
      const pz0 = sz + 2.15, pzw = 6.0; // platform from the edge, width
      const px0 = -78, px1 = -14;
      const pcx = (px0 + px1) / 2, pcz = pz0 + pzw / 2;
      const ptex = (() => { const c = TX.paint(128, 128, (x, y, u, v, o) => { const j = (Math.floor(u * 4) + Math.floor(v * 4)) % 2 ? 6 : 0; const n = Math.random() * 12; const seam = (x % 32 < 2 || y % 32 < 2) ? -30 : 0; o[0] = 168 + j + n + seam; o[1] = 164 + j + n + seam; o[2] = 156 + j + n + seam; }); return TX.toTexture(c); })();
      ptex.repeat.set((px1 - px0) / 4, pzw / 4);
      const platTop = K.std({ map: ptex, roughness: 0.9 });
      const platSide = K.std({ color: 0x8c8678, roughness: 0.9 });
      K.mesh(new T.BoxGeometry(px1 - px0, 0.98, pzw), platSide, pcx, 0.49, pcz);
      K.mesh(new T.PlaneGeometry(px1 - px0, pzw), platTop, pcx, 0.985, pcz, { rx: -PI / 2, cast: false });
      K.mesh(new T.BoxGeometry(px1 - px0, 0.02, 0.3), K.std({ color: 0xf2f0e8, roughness: 0.6 }), pcx, 1.02, pz0 + 0.8, { cast: false });
      K.mesh(new T.BoxGeometry(px1 - px0, 0.06, 0.45), K.std({ color: 0xd8d2c2, roughness: 0.7 }), pcx, 1.0, pz0 + 0.2, { cast: false });
      K.box(pcx, pcz, (px1 - px0) / 2, pzw / 2, 0, 1.0);
      block(pcx, pcz, (px1 - px0) / 2, pzw / 2, 0, 0.5);
      // building behind the platform
      const bx = -47, bz = pz0 + pzw + 5.2;
      house({ x: bx, z: bz, ry: 0, len: 20, dep: 9, wall: 7.6, rise: 3.2, kind: 'station', roof: 'slate', over: 1.0, y0: 0 });
      house({ x: bx - 14.5, z: bz + 0.5, ry: 0, len: 8, dep: 7, wall: 4.6, rise: 2.2, kind: 'station', roof: 'slate', chimney: false, y0: 0 });
      // canopy along the platform
      const cpx = -44, clen = 34;
      const cMat = K.std({ color: 0x2f4a3a, roughness: 0.55, metalness: 0.3 });
      for (let k = 0; k <= 4; k++) prop(new T.CylinderGeometry(0.16, 0.18, 3.8, 8), 0x2f4a3a, { x: cpx - clen / 2 + 1 + k * (clen - 2) / 4, y: 2.9, z: pz0 + pzw - 1.4 }, vcSatin);
      prop(new T.BoxGeometry(clen, 0.22, 3.6), 0x6e6a64, { x: cpx, y: 4.9, z: pz0 + pzw - 2.0, rx: -0.1 });
      prop(new T.BoxGeometry(clen, 0.45, 0.12), 0x7a3a26, { x: cpx, y: 4.75, z: pz0 + pzw - 3.85 });
      // nameboards
      const nb = TX.labelTexture(512, 96, (g) => { g.fillStyle = '#f6f4ec'; g.fillRect(0, 0, 512, 96); g.strokeStyle = '#141414'; g.lineWidth = 10; g.strokeRect(5, 5, 502, 86); g.fillStyle = '#141414'; g.font = '700 58px Rubik, Arial, sans-serif'; g.textAlign = 'center'; g.fillText('Tannenbrück', 256, 68); });
      const nbm = K.std({ map: nb, roughness: 0.4 });
      for (const nx2 of [-70, -22]) {
        for (const e of [-1, 1]) prop(new T.CylinderGeometry(0.1, 0.1, 3.6, 6), 0x222222, { x: nx2 + e * 2.2, y: 2.8, z: pz0 + 3.0 });
        prop(new T.BoxGeometry(5.6, 1.1, 0.1), 0x1a1a1a, { x: nx2, y: 4.2, z: pz0 + 3.0 });
        for (const e of [-1, 1]) prop(new T.PlaneGeometry(5.5, 1.0).rotateY(e < 0 ? PI : 0).translate(0, 0, e * 0.06), 0xffffff, { x: nx2, y: 4.2, z: pz0 + 3.0 }, nbm);
      }
      // lamps, benches, clock, luggage
      for (const lx of [-74, -60, -30, -18]) {
        prop(new T.CylinderGeometry(0.1, 0.13, 4.4, 8), 0x2f4a3a, { x: lx, y: 3.2, z: pz0 + 1.7 }, vcSatin);
        prop(new T.CylinderGeometry(0.15, 0.45, 0.5, 10), 0x2f4a3a, { x: lx, y: 5.5, z: pz0 + 1.7 }, vcSatin);
        prop(new T.SphereGeometry(0.28, 10, 8), 0xfff4d0, { x: lx, y: 5.25, z: pz0 + 1.7 }, glowMat, false);
      }
      for (const bx2 of [-52, -36, -66]) {
        const bz2 = pz0 + 4.6;
        prop(new T.BoxGeometry(2.6, 0.12, 0.7), 0x8a5a32, { x: bx2, y: 1.75, z: bz2 });
        prop(new T.BoxGeometry(2.6, 0.6, 0.1), 0x8a5a32, { x: bx2, y: 2.15, z: bz2 + 0.35 });
        for (const e of [-1, 1]) prop(new T.BoxGeometry(0.12, 0.75, 0.6), 0x2a2a2a, { x: bx2 + e * 1.1, y: 1.38, z: bz2 });
      }
      // milk churns + luggage cart near the building
      const churns = [];
      for (let k = 0; k < 5; k++) churns.push({ x: -28 + k * 0.75, y: 1.0, z: pz0 + 4.8 + (k % 2) * 0.6, s: 1 });
      K.instances(K.lathe([[0.01, 0], [0.32, 0], [0.34, 0.6], [0.24, 0.85], [0.18, 1.0], [0.22, 1.05], [0.01, 1.1]], 12), K.metal(0xc8ccd0, 0.35), churns);
      AO(bx, bz, 13, 7, 0.5);
      A.station = { pz0, px0, px1 };
      // forecourt: paved, a bus stop sign, a phone box
      const fc = TX.paint(128, 128, (x, y, u, v, o) => { const n = Math.random() * 14; const s2 = (x % 16 < 1 || y % 16 < 1) ? -24 : 0; o[0] = 150 + n + s2; o[1] = 146 + n + s2; o[2] = 138 + n + s2; });
      const ft = TX.toTexture(fc); ft.repeat.set(1, 1);
      K.flatShape([[-74, pz0 + pzw], [-14, pz0 + pzw], [-12, 71.5], [-76, 71.5]], K.std({ map: ft, roughness: 0.9 }), 0.04);
      // a country bus waiting at the stop, flower tubs
      {
        const bo = { x: -23, z: 64.5, ry: 0 };
        prop(new K.RoundedBoxGeometry(12, 3.0, 3.0, 2, 0.35).translate(0, 2.2, 0), 0xefe6d0, bo, vcSatin);
        prop(new T.BoxGeometry(12.06, 0.9, 3.06).translate(0, 1.15, 0), 0xb8282a, bo, vcSatin);
        prop(new T.BoxGeometry(9.6, 1.05, 3.08).translate(-0.6, 2.75, 0), 0x18222c, bo, vcSatin);
        prop(new T.BoxGeometry(0.1, 1.3, 2.6).translate(6.02, 2.6, 0), 0x18222c, bo, vcSatin);
        prop(new T.BoxGeometry(11, 0.3, 2.6).translate(0, 3.8, 0), 0xd8d4c8, bo, vcSatin);
        for (const wx of [-3.8, 3.8]) for (const e of [-1, 1]) prop(new T.CylinderGeometry(0.62, 0.62, 0.4, 14).rotateX(PI / 2).translate(wx, 0.62, e * 1.35), 0x161616, bo, vcSatin);
        AO(bo.x, bo.z, 6.8, 2.2, 0.5); K.box(bo.x, bo.z, 6, 1.6, 0, 4);
        for (const [tx, tz] of [[-70, 70], [-62, 70], [-30, 70.2], [-14.5, 56]]) {
          prop(new T.CylinderGeometry(0.75, 0.6, 0.9, 12).translate(0, 0.45, 0), 0x9a6a44, { x: tx, z: tz });
          for (let k = 0; k < 7; k++) prop(new T.IcosahedronGeometry(0.3, 0), r.pick([0xd8242a, 0xf05a8a, 0xf2f0ea, 0x4a8a3a]), { x: tx + r.range(-0.45, 0.45), y: 1.0 + r() * 0.3, z: tz + r.range(-0.45, 0.45) });
        }
      }
      block(-45, 66, 32, 6, 0, 0);
    }

    // ---------------------------------------------------------------- fields, farm track, fences, cows, hay bales
    {
      const furrow = (() => { const c = TX.paint(256, 256, (x, y, u, v, o) => { const f = 0.5 + 0.5 * Math.sin(u * TAU * 16 + Math.sin(v * 9) * 0.6); const n = Math.random() * 18; o[0] = 92 + f * 34 + n; o[1] = 66 + f * 24 + n; o[2] = 44 + f * 14 + n; }); return TX.toTexture(c); })();
      const wheat = (() => { const c = TX.paint(256, 256, (x, y, u, v, o) => { const f = 0.5 + 0.5 * Math.sin(u * TAU * 22); const n = Math.random() * 40; o[0] = 196 + n * 0.8 - f * 20; o[1] = 168 + n * 0.6 - f * 22; o[2] = 84 + n * 0.3 - f * 10; }); return TX.toTexture(c); })();
      const field = (poly, tex, rot, rep = 0.08) => {
        const m = K.flatShape(poly, K.std({ map: tex, roughness: 0.95 }), 0.05);
        const u = m.geometry.attributes.uv, p = m.geometry.attributes.position;
        const c = Math.cos(rot), s = Math.sin(rot);
        for (let i = 0; i < u.count; i++) { const x = p.getX(i), z = p.getZ(i); u.setXY(i, (x * c + z * s) * rep, (-x * s + z * c) * rep); }
        let a = 1e9, b = 1e9, cc = -1e9, d = -1e9; for (const [x, z] of poly) { a = Math.min(a, x); b = Math.min(b, z); cc = Math.max(cc, x); d = Math.max(d, z); }
        block((a + cc) / 2, (b + d) / 2, (cc - a) / 2, (d - b) / 2);
        return m;
      };
      field([[66, -29], [100, -29], [102, -17], [67, -16]], furrow, 0.02, 0.12);
      field([[54, 26], [70, 25], [71, 36.5], [53, 36.5]], wheat, 0.4, 0.15);
      // wheat ears as instanced tufts so the field has some height
      const ears = [];
      for (let i = 0; i < 260; i++) { const x = r.range(55, 69), z = r.range(26.5, 35.5); ears.push({ x, y: 0, z, ry: r() * TAU, sy: r.range(0.7, 1.1), s: 1, color: r.pick([0xd8b860, 0xc8a24a, 0xe0c878]) }); }
      const earGeo = new T.ConeGeometry(0.3, 1.1, 5, 1); earGeo.translate(0, 0.55, 0);
      K.instances(earGeo, K.std({ color: 0xffffff, roughness: 0.9 }), ears, { colors: true, cast: false });
      // farm track (dirt) from the farmyard to the road
      const tp = [[93, 9], [98, 21], [103, 33], [109, 44], [114, 52]];
      const dirt = K.std({ color: 0x7a5e40, roughness: 0.98 });
      for (let i = 0; i < tp.length - 1; i++) {
        const [ax, az] = tp[i], [bx, bz] = tp[i + 1], a = Math.atan2(bz - az, bx - ax), l = Math.hypot(bx - ax, bz - az);
        K.mesh(new T.PlaneGeometry(l + 3, 3.6), dirt, (ax + bx) / 2, 0.045, (az + bz) / 2, { rx: -PI / 2, rz: -a, cast: false });
      }
      // meadow fence with cows (between the railway curve and the road)
      const mp = [[116, -6], [128, -8], [127, 12], [121, 28], [108, 35]];
      const posts = [], rails = [];
      for (let i = 0; i < mp.length; i++) {
        const [ax, az] = mp[i], [bx, bz] = mp[(i + 1) % mp.length], l = Math.hypot(bx - ax, bz - az), a = Math.atan2(bz - az, bx - ax);
        const n = Math.ceil(l / 2.6);
        for (let k = 0; k < n; k++) { const t = k / n; posts.push({ x: ax + (bx - ax) * t, y: 0, z: az + (bz - az) * t, ry: r() }); }
        for (const ry2 of [0.7, 1.35]) rails.push({ x: (ax + bx) / 2, y: ry2, z: (az + bz) / 2, ry: -a, sx: l, sy: 1, sz: 1 });
      }
      const postGeo = new T.CylinderGeometry(0.11, 0.13, 1.6, 6); postGeo.translate(0, 0.8, 0);
      const wood = K.std({ color: 0x6a5038, roughness: 0.85 });
      K.instances(postGeo, wood, posts);
      K.instances(new T.BoxGeometry(1, 0.1, 0.08), wood, rails);
      // cows (brown alpine cattle)
      const cowParts = [];
      const cb = (w, h, d, x, y, z, c, o = {}) => cowParts.push(colorize(xf(new K.RoundedBoxGeometry(w, h, d, 1, Math.min(w, h, d) * 0.3), { x, y, z, ...o }), c));
      cb(2.6, 1.15, 1.05, 0, 1.45, 0, 0xffffff);
      cb(0.9, 0.62, 0.62, 1.55, 1.75, 0, 0xffffff, { rz: -0.3 });
      cb(0.4, 0.32, 0.5, 1.95, 1.55, 0, 0xd8ccc0);
      for (const [lx, lz] of [[-0.95, -0.35], [-0.95, 0.35], [0.95, -0.35], [0.95, 0.35]]) cb(0.24, 1.05, 0.24, lx, 0.5, lz, 0xe0e0e0);
      for (const e of [-1, 1]) cb(0.1, 0.1, 0.45, 1.5, 2.15, e * 0.32, 0xeeeeee, { rx: e * 0.6 });
      const cowGeo = merge(cowParts);
      const cows = [];
      for (const [x, z, a] of [[119, 2, 0.4], [122, 12, 2.2], [115, 22, -0.8], [123, -3, 3.4], [114, 29, 1.2], [117, 12, 0.1]]) { cows.push({ x, y: 0, z, ry: a, s: 0.95 + r() * 0.15, color: r.pick([0x8a5a3a, 0x7a4a2e, 0x9a6a46, 0x5a3a26]) }); AO(x, z, 1.8, 1.0, 0.35, -a); }
      K.instances(cowGeo, K.std({ vertexColors: true, roughness: 0.8 }), cows, { colors: true });
      for (const c of cows) block(c.x, c.z, 1.6, 1.6);
      block(119, 12, 9, 21);
      // round hay bales by the road: shove them around!
      const baleTex = (() => { const c = TX.paint(64, 64, (x, y, u, v, o) => { const n = Math.random() * 50; o[0] = 196 + n * 0.6; o[1] = 170 + n * 0.5; o[2] = 96 + n * 0.3; }); return TX.toTexture(c); })();
      const baleMat = K.std({ map: baleTex, roughness: 0.95 });
      const baleGeo = new T.CylinderGeometry(1.35, 1.35, 1.5, 20); baleGeo.rotateZ(PI / 2);
      for (const [s, off] of [[224, -9.4], [229, -10.2], [236, -9.6], [262, 9.4]]) {
        const p = track.place(s, off);
        const m = K.mesh(baleGeo, baleMat, p.x, 1.35, p.z, { ry: r() * TAU });
        keep.push(m);
        K.physics.addDynamic({ x: p.x, z: p.z, r: 1.35, m: 0.9, h: 2.7, mesh: m, slide: true, friction: 14, baseY: 1.35 });
      }
      // tractor parked at the farmyard
      {
        const P = [];
        const add = (g, c, o) => P.push(colorize(xf(g, o), c));
        add(new T.BoxGeometry(3.0, 1.0, 1.5), 0x3a7a3a, { x: 0.6, y: 1.5 });
        add(new T.BoxGeometry(1.6, 1.9, 1.6), 0x3a7a3a, { x: -0.9, y: 2.0 });
        add(new T.BoxGeometry(1.5, 0.9, 1.55), 0x101820, { x: -0.9, y: 2.7 });
        add(new T.BoxGeometry(1.8, 0.12, 1.8), 0x2a2a2a, { x: -0.9, y: 3.25 });
        for (const e of [-1, 1]) { add(new T.CylinderGeometry(1.0, 1.0, 0.55, 16), 0x1a1a1a, { x: -1.0, y: 1.0, z: e * 1.0, rx: PI / 2 }); add(new T.CylinderGeometry(0.6, 0.6, 0.4, 14), 0x1a1a1a, { x: 1.6, y: 0.6, z: e * 0.85, rx: PI / 2 }); add(new T.CylinderGeometry(0.5, 0.5, 0.58, 12), 0xc83a2a, { x: -1.0, y: 1.0, z: e * 1.0, rx: PI / 2 }); }
        add(new T.CylinderGeometry(0.1, 0.1, 1.2, 6), 0x222222, { x: 1.4, y: 2.4 });
        const tg = merge(P);
        const tm = new T.Mesh(tg, vcSatin); tm.position.set(90, 0, 8); tm.rotation.y = 0.9; tm.castShadow = true; tm.receiveShadow = true; K.group.add(tm);
        AO(90, 8, 2.6, 1.6, 0.4, -0.9); K.circle(90, 8, 2, 3.4); block(90, 8, 2.5, 2.5);
      }
      // muck heap
      K.spill(104, 12, 2.4, K.std({ color: 0x3a2a1a, roughness: 1 }), { y: 0.5, thick: 0.6, lump: 0.5 });
    }

    // ---------------------------------------------------------------- hazards: mud from the farm track, gravel road works, wet leaves
    const leafColors = [0xd8862a, 0xc85a1e, 0xe6b23a, 0x9a4a1a, 0xb8782a, 0x7a5a2a];
    {
      // mud (sticky) where the tractor comes out onto the road
      const mudMat = K.phys({ color: 0x3e2a18, roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.25 });
      for (const [s, off, rad, st] of [[204, -4.6, 2.4, 1.6], [209, -1.6, 2.2, 1.9], [214, -4.2, 2.7, 1.5], [219, -0.6, 1.7, 1.7], [224, -4.4, 1.7, 1.4]]) {
        const p = track.place(s, off);
        const sp = K.spill(p.x, p.z, rad, mudMat, { lump: 0.5, stretch: st, angle: p.angle, y: 0.17, thick: 0.15 });
        K.surface('sticky', { poly: sp.poly });
      }
      // tractor tyre tracks from the farm track out onto the road
      const treads = [];
      for (let k = 0; k < 46; k++) {
        const t = k / 45;
        const p = track.place(203 + t * 31, lerp(-7.2, -2.5, ss(0, 0.5, t)));
        for (const e of [-0.95, 0.95]) {
          const q = { x: p.x + p.nx * e, z: p.z + p.nz * e };
          if (r() < 0.12 + t * 0.5) continue;
          treads.push({ x: q.x, y: 0.1, z: q.z, ry: -p.angle + PI / 2, sx: 0.75, sy: 1, sz: 0.32, color: r.pick([0x3a2814, 0x4a3420, 0x2e2010]) });
        }
      }
      K.instances(new T.BoxGeometry(1, 0.05, 1), K.std({ color: 0xffffff, roughness: 0.6 }), treads, { colors: true, cast: false });
      const clods = [];
      for (let i = 0; i < 40; i++) { const p = track.place(r.range(200, 232), r.range(-6.5, 5)); clods.push({ x: p.x, y: 0.12, z: p.z, s: r.range(0.15, 0.4), ry: r() * 6, color: r.pick([0x3a2a1a, 0x4a3420, 0x5a4028]) }); }
      K.instances(new T.DodecahedronGeometry(1, 0), K.std({ color: 0xffffff, roughness: 0.9 }), clods, { colors: true, cast: false });
      // cow pats in the meadow, one on the road edge
      for (const [x, z] of [[118, 7], [120, 19], [115, 16]]) K.spill(x, z, 0.42, mudMat, { y: 0.12, thick: 0.12, n: 12 });

      // gravel (slow): resurfacing works before the tunnel
      const gs0 = 312, gs1 = 338;
      const gt = TX.mottledTextures({ size: 256, a: 0xa8a294, b: 0x7a756a, c: 0x5a564e, seed: 23, period: 40, speck: 0.6, bump: 6, pebbles: 1400, pebbleColor: 0xb8b2a4 });
      gt.map.repeat.set(1, 1);
      const gMat = K.std({ map: gt.map, normalMap: gt.normalMap, normalScale: V2(1.3), roughness: 0.96, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
      {
        const pos = [], uv = [], idx = [];
        let n = 0;
        for (let s = gs0; s <= gs1; s += 1) {
          const p = track.at(s), k = Math.min(1, (s - gs0) / 2, (gs1 - s) / 2);
          for (const o of [-7.6, 7.6]) { const ww = o * (0.7 + 0.3 * k); pos.push(p.x + p.nx * ww, 0.13, p.z + p.nz * ww); uv.push(ww / 6, s / 6); }
          n++;
        }
        for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
        const nr = g.attributes.normal; for (let i = 0; i < nr.count; i++) if (nr.getY(i) < 0) nr.setXYZ(i, -nr.getX(i), -nr.getY(i), -nr.getZ(i));
        const m = new T.Mesh(g, gMat); m.receiveShadow = true; m.renderOrder = 1; keep.push(m); K.group.add(m);
        const poly = [];
        for (let s = gs0; s <= gs1; s += 2) { const p = track.place(s, -7.4); poly.push([p.x, p.z]); }
        for (let s = gs1; s >= gs0; s -= 2) { const p = track.place(s, 7.4); poly.push([p.x, p.z]); }
        K.surface('slow', { poly });
        // loose chippings scattered beyond
        const chips = [];
        for (let i = 0; i < 160; i++) { const p = track.place(r.range(gs0 - 6, gs1 + 8), r.range(-7.5, 7.5)); chips.push({ x: p.x, y: 0.1, z: p.z, s: r.range(0.12, 0.3), ry: r() * 6, color: r.pick([0xb8b2a4, 0x8a857a, 0xa09a8c]) }); }
        K.instances(new T.DodecahedronGeometry(1, 0), K.std({ color: 0xffffff, roughness: 0.9 }), chips, { colors: true, cast: false });
        // road works: cones, striped boards, a little road roller, gravel heap
        const cones = [];
        for (let s = gs0 - 4; s < gs1 + 4; s += 4) { const p = track.place(s, 8.4); cones.push({ x: p.x, y: 0, z: p.z }); }
        const coneGeo = merge([colorize(new T.ConeGeometry(0.42, 1.3, 12).translate(0, 0.75, 0), 0xf2601a), colorize(new T.CylinderGeometry(0.3, 0.33, 0.25, 12).translate(0, 0.85, 0), 0xf6f4ee), colorize(new T.BoxGeometry(1.0, 0.12, 1.0).translate(0, 0.06, 0), 0x222222)]);
        K.instances(coneGeo, vcSatin, cones);
        const bt2 = TX.labelTexture(128, 32, (g) => { for (let i = -2; i < 10; i++) { g.fillStyle = i % 2 ? '#f6f3ea' : '#d01e1a'; g.beginPath(); g.moveTo(i * 16, 32); g.lineTo(i * 16 + 16, 32); g.lineTo(i * 16 + 32, 0); g.lineTo(i * 16 + 16, 0); g.fill(); } }, { wrap: true });
        const boardMat = K.std({ map: bt2, roughness: 0.6 });
        for (const s of [gs0 - 8, gs1 + 6]) {
          const p = track.place(s, -9.3);
          prop(new T.BoxGeometry(3.6, 0.7, 0.1).translate(0, 1.4, 0), 0xffffff, { x: p.x, z: p.z, ry: -p.angle }, boardMat);
          for (const e of [-1, 1]) prop(new T.BoxGeometry(0.12, 1.6, 0.12).translate(e * 1.5, 0.8, 0), 0xf2f0ea, { x: p.x, z: p.z, ry: -p.angle });
        }
        const rp = track.place(gs1 - 4, -11.8);
        const ro = { x: rp.x, z: rp.z, ry: -rp.angle + 0.3 };
        prop(new T.CylinderGeometry(0.95, 0.95, 2.4, 18).rotateX(PI / 2).translate(1.4, 0.95, 0), 0x6a6a6a, ro, vcSatin);
        prop(new K.RoundedBoxGeometry(2.6, 1.3, 2.0, 2, 0.2).translate(-0.6, 1.45, 0), 0xf2b21a, ro, vcSatin);
        prop(new T.BoxGeometry(1.2, 1.2, 1.8).translate(-0.9, 2.65, 0), 0x1a2028, ro, vcSatin);
        prop(new T.BoxGeometry(1.5, 0.12, 2.1).translate(-0.9, 3.3, 0), 0xf2b21a, ro, vcSatin);
        for (const e of [-1, 1]) prop(new T.CylinderGeometry(0.8, 0.8, 0.5, 14).rotateX(PI / 2).translate(-1.4, 0.8, e * 0.85), 0x1a1a1a, ro, vcSatin);
        AO(rp.x, rp.z, 2.6, 1.8, 0.4, rp.angle); K.circle(rp.x, rp.z, 1.8, 3.4);
        const hp = track.place(gs0 - 2, -12.5);
        K.spill(hp.x, hp.z, 2.6, K.std({ map: gt.map, normalMap: gt.normalMap, roughness: 0.95 }), { y: 0.9, thick: 0.9, lump: 0.4 });
      }

      // wet leaves (slick) under autumn trees on the west S-bend
      const ls0 = 768, ls1 = 794;
      const poly = [];
      for (let s = ls0; s <= ls1; s += 2) { const p = track.place(s, -7.3 + Math.sin(s * 0.4) * 0.5); poly.push([p.x, p.z]); }
      for (let s = ls1; s >= ls0; s -= 2) { const p = track.place(s, 4.5 + Math.sin(s * 0.3) * 1.5); poly.push([p.x, p.z]); }
      K.surface('slick', { poly });
      const leafTex = TX.labelTexture(64, 64, (g) => { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(32, 2); g.bezierCurveTo(58, 18, 54, 46, 32, 62); g.bezierCurveTo(10, 46, 6, 18, 32, 2); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(32, 6); g.lineTo(32, 60); g.stroke(); });
      const leaves = [];
      for (let i = 0; i < 520; i++) {
        const onRoad = i < 380;
        const p = onRoad ? track.place(r.range(ls0 - 4, ls1 + 4), r.range(-7.5, 5.5)) : track.place(r.range(ls0 - 20, ls1 + 20), r.pick([-1, 1]) * r.range(7.5, 16));
        leaves.push({ x: p.x, y: 0.14 + r() * 0.04, z: p.z, ry: r() * TAU, rx: -PI / 2 + r.range(-0.2, 0.2), s: r.range(0.45, 0.8), color: r.pick(leafColors) });
      }
      K.instances(new T.PlaneGeometry(1, 1), K.std({ map: leafTex, alphaTest: 0.5, side: T.DoubleSide, roughness: 0.4, color: 0xffffff }), leaves, { colors: true, cast: false });
      const wetMat = K.phys({ color: 0x1a1a1c, roughness: 0.1, clearcoat: 1, transparent: true, opacity: 0.35, depthWrite: false });
      const p = track.place((ls0 + ls1) / 2, -1);
      K.spill(p.x, p.z, 11, wetMat, { lump: 0.3, stretch: 1.6, angle: p.angle, y: 0.12, thick: 0.02 });
    }

    // ---------------------------------------------------------------- road furniture: delineator posts, guard rails, chevrons, signs
    {
      const posts = [], bands = [];
      for (let s = 0; s < L; s += 9) {
        if (s > VIA.s0 - 3 && s < VIA.s3 + 3) continue;
        if (s > TUN.s0 - 4 && s < TUN.s1 + 4) continue;
        if (A.lc.some((c) => Math.abs(s - c.roadS) < 10)) continue;
        if (s > 20 && s < 135) continue; // station forecourt / start
        for (const side of [-1, 1]) {
          const p = track.place(s, side * 8.6);
          if (isBlocked(p.x, p.z) || gy(p.x, p.z) > 1 || gy(p.x, p.z) < -0.3 || railD(p.x, p.z) < 4) continue;
          posts.push({ x: p.x, y: 0, z: p.z, ry: -p.angle });
          bands.push({ x: p.x, y: 0.95, z: p.z, ry: -p.angle });
        }
      }
      const pg = merge([colorize(new T.BoxGeometry(0.22, 1.25, 0.2).translate(0, 0.62, 0), 0xf4f2ec), colorize(new T.BoxGeometry(0.24, 0.26, 0.22).translate(0, 0.95, 0), 0x151515), colorize(new T.BoxGeometry(0.05, 0.12, 0.08).translate(-0.12, 0.95, 0), 0xffb020)]);
      K.instances(pg, vcSatin, posts);
      // guard rails on the outside of the fast corners
      const grMat = K.metal(0xc4c8cc, 0.35);
      const rails = [], gposts = [];
      for (const [a, b, side] of [[160, 262, 1], [690, 748, 1], [596, 622, 1], [796, 830, -1]]) {
        for (let s = a; s < b; s += 2) {
          const p = track.place(s, side * 8.3), q = track.place(s + 2, side * 8.3);
          rails.push({ x: (p.x + q.x) / 2, y: 0.85, z: (p.z + q.z) / 2, ry: -Math.atan2(q.z - p.z, q.x - p.x), sx: Math.hypot(q.x - p.x, q.z - p.z) + 0.05, sy: 1, sz: 1 });
          if (Math.round(s) % 4 === 0) gposts.push({ x: p.x + p.nx * side * 0.15, y: 0, z: p.z + p.nz * side * 0.15 });
        }
        for (let s = a; s < b; s += 3) { const p = track.place(s, side * 8.4), q = track.place(Math.min(b, s + 3), side * 8.4); K.capsule(p.x, p.z, q.x, q.z, 0.35, 1.3); }
      }
      K.instances(new T.BoxGeometry(1, 0.42, 0.12), grMat, rails);
      const gpg = new T.BoxGeometry(0.16, 1.0, 0.16); gpg.translate(0, 0.5, 0);
      K.instances(gpg, K.metal(0x8a8e92, 0.5), gposts);
      // chevron boards round the hairpin and NW corner
      const chev = TX.labelTexture(128, 64, (g) => { g.fillStyle = '#d01e1a'; g.fillRect(0, 0, 128, 64); g.fillStyle = '#f6f3ea'; for (const x of [18, 58, 98]) { g.beginPath(); g.moveTo(x, 6); g.lineTo(x + 18, 32); g.lineTo(x, 58); g.lineTo(x + 12, 58); g.lineTo(x + 30, 32); g.lineTo(x + 12, 6); g.fill(); } });
      const chevMat = K.std({ map: chev, roughness: 0.5 });
      for (const [s, side] of [[495, -1], [508, -1], [521, -1], [534, -1], [715, 1], [728, 1]]) {
        const p = track.place(s, side * 9.6);
        const ry = Math.atan2(-Math.cos(p.angle), -Math.sin(p.angle));
        prop(new T.BoxGeometry(2.4, 1.2, 0.08).translate(0, 1.4, 0), 0xffffff, { x: p.x, z: p.z, ry }, chevMat);
        for (const e of [-1, 1]) prop(new T.BoxGeometry(0.1, 1.4, 0.1).translate(e * 0.9, 0.7, -0.06), 0x777777, { x: p.x, z: p.z, ry });
      }
      // road signs (one atlas)
      const atlas = TX.makeCanvas(512, 256), ag = atlas.getContext('2d');
      const cell = (i, draw) => { ag.save(); ag.translate((i % 4) * 128, Math.floor(i / 4) * 128); draw(ag); ag.restore(); };
      const tri = (g, inner) => { g.fillStyle = '#d01e1a'; g.beginPath(); g.moveTo(64, 8); g.lineTo(122, 112); g.lineTo(6, 112); g.closePath(); g.fill(); g.fillStyle = '#f8f6f0'; g.beginPath(); g.moveTo(64, 30); g.lineTo(104, 102); g.lineTo(24, 102); g.closePath(); g.fill(); g.fillStyle = '#151515'; inner(g); };
      cell(0, (g) => tri(g, (g2) => { g2.fillRect(40, 84, 48, 6); for (let k = 0; k < 4; k++) g2.fillRect(44 + k * 12, 66, 6, 18); g2.fillRect(40, 64, 48, 4); }));
      cell(1, (g) => tri(g, (g2) => { g2.fillRect(42, 76, 44, 12); g2.fillRect(48, 64, 26, 12); g2.beginPath(); g2.arc(50, 92, 5, 0, TAU); g2.arc(78, 92, 5, 0, TAU); g2.fill(); g2.fillRect(76, 56, 4, 10); }));
      cell(2, (g) => tri(g, (g2) => { g2.fillRect(58, 56, 6, 40); g2.beginPath(); g2.arc(60, 56, 10, PI, 0); g2.fill(); g2.fillRect(40, 92, 40, 6); }));
      cell(3, (g) => { g.fillStyle = '#d01e1a'; g.beginPath(); g.arc(64, 64, 58, 0, TAU); g.fill(); g.fillStyle = '#f8f6f0'; g.beginPath(); g.arc(64, 64, 44, 0, TAU); g.fill(); g.fillStyle = '#151515'; g.font = '700 48px Rubik, Arial'; g.textAlign = 'center'; g.fillText('60', 64, 81); });
      cell(4, (g) => { g.fillStyle = '#f2c81e'; g.fillRect(4, 30, 120, 68); g.strokeStyle = '#151515'; g.lineWidth = 5; g.strokeRect(9, 35, 110, 58); g.fillStyle = '#151515'; g.font = '700 21px Rubik, Arial'; g.textAlign = 'center'; g.fillText('Tannenbrück', 64, 70); });
      cell(5, (g) => { g.fillStyle = '#1e4a9a'; g.fillRect(8, 8, 112, 112); g.fillStyle = '#f8f6f0'; g.beginPath(); g.moveTo(26, 104); g.lineTo(26, 58); g.arc(64, 58, 38, PI, 0); g.lineTo(102, 104); g.closePath(); g.fill(); g.fillStyle = '#1e4a9a'; g.beginPath(); g.moveTo(40, 104); g.lineTo(40, 62); g.arc(64, 62, 24, PI, 0); g.lineTo(88, 104); g.closePath(); g.fill(); });
      cell(6, (g) => tri(g, (g2) => { g2.beginPath(); g2.moveTo(52, 100); g2.lineTo(58, 60); g2.lineTo(70, 60); g2.lineTo(80, 100); g2.fill(); g2.fillRect(46, 52, 36, 6); }));
      cell(7, (g) => { g.fillStyle = '#f8f6f0'; g.fillRect(4, 40, 120, 48); g.strokeStyle = '#151515'; g.lineWidth = 4; g.strokeRect(6, 42, 116, 44); g.fillStyle = '#151515'; g.font = '700 22px Rubik, Arial'; g.textAlign = 'left'; g.fillText('Bahnhof', 14, 72); g.beginPath(); g.moveTo(100, 52); g.lineTo(118, 64); g.lineTo(100, 76); g.fill(); });
      const at = TX.toTexture(atlas, { wrap: false });
      const signParts = [], poles = [];
      const sign = (s, side, idx, sz = 2.2, h = 3.6) => {
        const p = track.place(s, side * 9.4);
        if (isBlocked(p.x, p.z)) return;
        const g = new T.PlaneGeometry(sz, sz);
        const u = g.attributes.uv; const cx0 = (idx % 4) / 4, cy0 = 1 - Math.floor(idx / 4) / 2;
        for (let i = 0; i < u.count; i++) u.setXY(i, cx0 + u.getX(i) / 4, cy0 - 0.5 + u.getY(i) / 2);
        const back = new T.PlaneGeometry(sz * 0.98, sz * 0.98); back.rotateY(PI); back.translate(0, 0, -0.02);
        const both = merge([colorize(g, 0xffffff), colorize(back, 0x777777)]);
        xf(both, { y: h, ry: Math.atan2(-Math.cos(p.angle), -Math.sin(p.angle)) });
        xf(both, { x: p.x, z: p.z });
        signParts.push(both);
        poles.push({ x: p.x, y: 0, z: p.z, sy: h - sz * 0.3 });
      };
      for (const c of A.lc) sign(c.roadS - 26, 1, 0);
      sign(186, 1, 1); sign(300, 1, 2); sign(340, 1, 5, 2.2, 4.4); sign(140, 1, 3); sign(600, 1, 3); sign(470, 1, 6);
      sign(856, 1, 4, 2.6); sign(15, -1, 7, 2.4, 3.2);
      const sm = new T.Mesh(merge(signParts), K.std({ map: at, vertexColors: true, roughness: 0.5, side: T.DoubleSide, alphaTest: 0.3 }));
      sm.castShadow = true; sm.receiveShadow = true; K.group.add(sm);
      const pole = new T.CylinderGeometry(0.08, 0.08, 1, 6); pole.translate(0, 0.5, 0);
      K.instances(pole, K.metal(0x9a9ea2, 0.4), poles.map((q) => ({ ...q, sx: 1, sz: 1 })));
    }

    // ---------------------------------------------------------------- start / finish: banner over the road + chequered line
    {
      const s0 = 40, p = track.at(s0);
      const c = TX.makeCanvas(256, 32), g = c.getContext('2d');
      for (let y = 0; y < 2; y++) for (let x = 0; x < 16; x++) { g.fillStyle = (x + y) % 2 ? '#1b1b1b' : '#f7f4ec'; g.fillRect(x * 16, y * 16, 16, 16); }
      const lm = K.std({ map: TX.toTexture(c, { wrap: false }), roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
      const line = K.mesh(new T.PlaneGeometry(14, 1.75), lm, p.x, 0.08, p.z, { cast: false });
      line.rotation.order = 'YXZ'; line.rotation.y = -p.angle + PI / 2; line.rotation.x = -PI / 2;
      const bc = TX.makeCanvas(1024, 160), bg = bc.getContext('2d');
      bg.fillStyle = '#c4161c'; bg.fillRect(0, 0, 1024, 160);
      for (let y = 0; y < 2; y++) for (let x = 0; x < 64; x++) { bg.fillStyle = (x + y) % 2 ? '#111' : '#f6f3ea'; bg.fillRect(x * 16, y * 16, 16, 16); bg.fillRect(x * 16, 128 + y * 16, 16, 16); }
      bg.fillStyle = '#fff'; bg.font = '84px "Lilita One", Impact, sans-serif'; bg.textAlign = 'center'; bg.fillText('START · ZIEL', 512, 112);
      const banner = K.std({ map: TX.toTexture(bc, { wrap: false }), roughness: 0.75 });
      const tp = track.place(s0 + 7, -12);
      prop(new T.BoxGeometry(5, 3.4, 4), 0xf4f2ec, { x: tp.x, y: 1.7, z: tp.z });
      prop(new T.BoxGeometry(5.8, 0.3, 4.8), 0x3a3a3a, { x: tp.x, y: 3.55, z: tp.z });
      prop(new T.BoxGeometry(4.6, 2.2, 3.6), 0xf4f2ec, { x: tp.x, y: 4.8, z: tp.z });
      prop(new T.BoxGeometry(4.0, 1.1, 0.1), 0x1a2a3a, { x: tp.x, y: 5.0, z: tp.z + 1.82 });
      prop(new T.BoxGeometry(1.2, 2.2, 0.1), 0x5a3a22, { x: tp.x - 1.2, y: 1.1, z: tp.z + 2.02 });
      prop(new T.BoxGeometry(5.4, 0.25, 4.4), 0xc4161c, { x: tp.x, y: 6.0, z: tp.z });
      for (const e of [-1, 1]) prop(new T.BoxGeometry(0.2, 2.2, 0.2), 0x9a9a9a, { x: tp.x + e * 4.2, y: 7.2, z: tp.z + 0.6 });
      K.mesh(new T.BoxGeometry(10.4, 1.65, 0.16), banner, tp.x, 7.7, tp.z + 0.7);
      AO(tp.x, tp.z, 4, 3.4, 0.45); K.box(tp.x, tp.z, 2.6, 2.1, 0, 7); block(tp.x, tp.z, 3, 2.6);
      // chequered flags on poles either side of the line
      const fl = TX.labelTexture(64, 48, (g2) => { for (let y = 0; y < 3; y++) for (let x = 0; x < 4; x++) { g2.fillStyle = (x + y) % 2 ? '#111' : '#f6f3ea'; g2.fillRect(x * 16, y * 16, 16, 16); } });
      const flagMat = K.std({ map: fl, side: T.DoubleSide, roughness: 0.8 });
      for (const off of [-9.4, 9.6]) {
        const q = track.place(s0, off);
        prop(new T.CylinderGeometry(0.1, 0.12, 6.2, 8), 0xe8e8e8, { x: q.x, y: 3.1, z: q.z }, vcMetal);
        const fg = new T.PlaneGeometry(2.6, 1.8, 6, 1); const fp = fg.attributes.position; for (let i = 0; i < fp.count; i++) fp.setZ(i, Math.sin((fp.getX(i) + 1.3) * 2.2) * 0.25);
        fg.computeVertexNormals();
        K.mesh(fg, flagMat, q.x + 1.35, 5.3, q.z, { ry: -0.2 });
        AO(q.x, q.z, 0.7, 0.7, 0.35); K.circle(q.x, q.z, 0.3, 6);
      }
      // spectators behind a rope on the south verge
      A.crowd = [];
      for (let k = 0; k < 9; k++) { const q = track.place(s0 - 12 + k * 3.2, 10.8 + r.range(-0.4, 0.6)); A.crowd.push([q.x, q.z]); }
    }

    // ---------------------------------------------------------------- trees: flocked conifers, deciduous clumps, bushes (instanced, chunked)
    const flock = (() => { const S = 256, h = new Float32Array(S * S); for (let i = 0; i < h.length; i++) h[i] = Math.random(); const t = TX.toTexture(TX.normalFromHeight(h, S, S, 2.6), { srgb: false }); t.repeat.set(3, 3); return t; })();
    const conGeo = (() => {
      const P = [];
      const tiers = 6;
      for (let k = 0; k < tiers; k++) {
        const t = k / tiers, rad = 1.0 - t * 0.78, y0 = 0.12 + t * 0.82, hgt = 0.3;
        const g = new T.ConeGeometry(rad * 0.22, hgt, 9, 1, true); g.translate(0, y0 + hgt / 2, 0);
        const pp = g.attributes.position; for (let i = 0; i < pp.count; i++) { const a = Math.atan2(pp.getZ(i), pp.getX(i)); const w = 1 + 0.12 * Math.sin(a * 5 + k * 2); pp.setX(i, pp.getX(i) * w); pp.setZ(i, pp.getZ(i) * w); }
        g.computeVertexNormals();
        P.push(colorize(g, new T.Color(1, 1, 1).multiplyScalar(0.75 + t * 0.35)));
      }
      P.push(colorize(new T.CylinderGeometry(0.03, 0.045, 0.2, 6).translate(0, 0.1, 0), 0x4a3426));
      return merge(P);
    })();
    const decGeo = (() => {
      const P = [];
      const q = K.rng(12);
      P.push(colorize(new T.CylinderGeometry(0.045, 0.07, 0.5, 7).translate(0, 0.25, 0), 0x4a3a2c));
      for (let k = 0; k < 4; k++) {
        const a = (k / 3) * TAU + q(), d = k ? 0.17 + q() * 0.1 : 0, y = 0.55 + (k ? q() * 0.28 : 0.24);
        let g = new T.IcosahedronGeometry(0.27 + q() * 0.1, 1);
        g.deleteAttribute('uv'); g = BU.mergeVertices(g);
        const pp = g.attributes.position; for (let i = 0; i < pp.count; i++) { const k2 = 1 + (q() - 0.5) * 0.28; pp.setXYZ(i, pp.getX(i) * k2, pp.getY(i) * k2 * 0.9, pp.getZ(i) * k2); }
        g.computeVertexNormals();
        xf(g, { x: Math.cos(a) * d, y, z: Math.sin(a) * d });
        P.push(colorize(g, new T.Color(1, 1, 1).multiplyScalar(0.8 + (y - 0.5) * 0.6)));
      }
      return merge(P);
    })();
    const bushGeo = (() => {
      const P = []; const q = K.rng(14);
      for (let k = 0; k < 3; k++) { let g = new T.IcosahedronGeometry(0.34 + q() * 0.12, 1); g.deleteAttribute('uv'); g = BU.mergeVertices(g); g.computeVertexNormals(); xf(g, { x: (q() - 0.5) * 0.5, y: 0.25 + q() * 0.12, z: (q() - 0.5) * 0.5, sy: 0.8 }); P.push(colorize(g, new T.Color(1, 1, 1).multiplyScalar(0.8 + q() * 0.3))); }
      return merge(P);
    })();
    const treeMat = K.std({ vertexColors: true, roughness: 0.95, normalMap: flock, normalScale: V2(1.4) });
    const cons = [], decs = [], bushes = [];
    const conCols = [0x2c4a2a, 0x355630, 0x2a4224, 0x3c5a34, 0x29402a];
    const decCols = [0x4f7a2e, 0x5f8a34, 0x6a9a3a, 0x48702a, 0x7a9a3c, 0x587e30];
    const autumn = [0xc8641e, 0xd8902a, 0xb84a1a, 0xe0b030, 0xa8601c];
    const portals = [TUN.s0, TUN.s1].map((s) => track.at(s));
    const nearPortal = (x, z) => portals.some((p) => Math.hypot(x - p.x, z - p.z) < 15);
    const okTree = (x, z, rad, roadM = 3) => {
      if (nearPortal(x, z)) return false;
      if (x < TX0 + 2 || x > TX1 - 2 || z > TZ1 - 2 || z < TZ0 + 2) return false;
      if (roadD(x, z) < roadM + rad) return false;
      if (railD(x, z) < 3.6 + rad) return false;
      const h = gy(x, z); if (h < -0.4) return false;
      if (isBlocked(x, z, rad)) return false;
      if (inFade(x, z)) return false;
      if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 2.5) return false;
      if (riverInfo(x, z)[0] < 5.5) return false;
      return true;
    };
    const addTree = (kind, x, z, hgt, col) => {
      const y = gy(x, z) - 0.15;
      const w = hgt * (kind === 'con' ? 0.42 : 0.62) * r.range(0.85, 1.15);
      const t = { x, y, z, ry: r() * TAU, sx: kind === 'con' ? w : w, sy: hgt, sz: w, rx: r.range(-0.04, 0.04), rz: r.range(-0.04, 0.04), color: col };
      if (kind === 'con') { t.sx = hgt; t.sz = hgt; cons.push(t); } else if (kind === 'dec') { t.sx = t.sz = hgt * 0.78; decs.push(t); } else bushes.push(t);
      if (roadD(x, z) < 18 && kind !== 'bush') K.circle(x, z, kind === 'con' ? 0.7 : 0.6, hgt);
      AO(x, z, hgt * (kind === 'con' ? 0.24 : 0.32), hgt * (kind === 'con' ? 0.24 : 0.32), 0.35, 0, y + 0.15);
    };
    // mountain forest
    const conMix = conCols.concat([0x4a6a3a, 0x3e5e30, 0x223622]);
    for (let i = 0; i < 8000 && cons.length < 470; i++) {
      const x = r.range(TX0 + 3, TX1 - 3), z = r.range(-109, -64);
      const h = gy(x, z);
      if (h < 0.8 || h > 24 || rockAt(x, z) > 0.5) continue;
      if (!okTree(x, z, 1.5, 4)) continue;
      if (n1(x, z, 0.06, 400) < 0.36) continue; // meadow clearings between the stands
      addTree('con', x, z, r.range(9, 16) * (1 - h / 70), r.pick(conMix));
    }
    // spur flanks (outside the cut-away)
    for (let i = 0; i < 500; i++) {
      const x = r.range(50, 130), z = r.range(-62, -36);
      const h = gy(x, z); if (h < 1.5 || rockAt(x, z) > 0.5) continue;
      if (!okTree(x, z, 1.5, 4)) continue;
      addTree('con', x, z, r.range(9, 15), r.pick(conCols));
    }
    // woods and groups in the lowlands
    const grove = (cx, cz, rad, n, mix, hR = [8, 13], cols = decCols) => {
      for (let k = 0, tries = 0; k < n && tries < n * 12; tries++) {
        const a = r() * TAU, d = Math.sqrt(r()) * rad, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
        const kind = r() < mix ? 'con' : 'dec';
        if (!okTree(x, z, 1.4)) continue;
        addTree(kind, x, z, r.range(hR[0], hR[1]) * (kind === 'con' ? 1.15 : 1), kind === 'con' ? r.pick(conCols) : r.pick(cols));
        k++;
      }
    };
    grove(-128, 50, 18, 30, 0.4, [8, 13]); // south-west wood
    grove(-122, -38, 16, 22, 0.55, [8, 12]); // north-west wood
    grove(-154, 0, 9, 12, 0.3, [8, 12], autumn); // outside the west bend: autumn colours over the wet leaves
    grove(-127, 6, 6, 5, 0.1, [7, 10], autumn);
    grove(155, 0, 9, 18, 0.45, [9, 14]); // east board edge
    grove(155, 60, 7, 7, 0.3, [8, 12]);
    grove(-156, 70, 6, 7, 0.4, [8, 12]);
    grove(126, -14, 7, 8, 0.2, [8, 12]); // east strip
    grove(-38, -48, 10, 7, 0.2, [6, 9]); // low trees in the north strip
    grove(16, -48, 8, 5, 0.3, [6, 9]);
    grove(-100, -48, 8, 6, 0.4, [7, 10]);
    grove(-40, 36, 6, 3, 0, [7, 10]); grove(-18, -28, 5, 2, 0, [7, 9]); grove(5, -24, 4, 2, 0, [7, 9]); grove(30, -26, 4, 2, 0, [7, 9]);
    grove(-88, 26, 7, 5, 0.1, [7, 11], [0x8aa848, 0x9ab85a, 0x7a9a40]); // willows by the lake
    grove(-58, -10, 5, 4, 0.1, [7, 10], [0x8aa848, 0x9ab85a]);
    grove(46, 4, 4, 2, 0, [8, 11]); grove(64, 6, 6, 3, 0, [8, 11]);
    for (const x of [-66, -34]) addTree('dec', x, 69.8, 7.5, r.pick(decCols));
    // orchard in the south-east corner: rows of little apple trees
    {
      const apples = [];
      for (let ox = 124; ox <= 160; ox += 6.2) for (let oz = 58; oz <= 80; oz += 6.4) {
        const x = ox + r.range(-0.5, 0.5) + (Math.round(oz) % 2) * 1.6, z = oz + r.range(-0.5, 0.5);
        if (!okTree(x, z, 2.4)) continue;
        const hgt = r.range(5, 6.4);
        addTree('dec', x, z, hgt, r.pick([0x6a9a3a, 0x7aa844, 0x5f8a34]));
        for (let k = 0; k < 7; k++) { const a = r() * TAU, d = r.range(0.8, 1.9); apples.push({ x: x + Math.cos(a) * d, y: gy(x, z) + hgt * r.range(0.5, 0.85), z: z + Math.sin(a) * d, s: 0.24, color: r.pick([0xc8281e, 0xd84a1e, 0xe8c040, 0xb8201a]) }); }
      }
      K.instances(new T.IcosahedronGeometry(1, 0), K.std({ color: 0xffffff, roughness: 0.45 }), apples, { colors: true, cast: false });
    }
    // poplar row along the farm track
    for (let k = 0; k < 6; k++) { const x = 89 + k * 3.2, z = 13 + k * 5.6; if (okTree(x, z, 0.8)) { decs.push({ x, y: gy(x, z) - 0.1, z, ry: r() * 6, sx: 4.2, sy: 14, sz: 4.2, color: r.pick(decCols) }); AO(x, z, 2.6, 2.6, 0.3); } }
    // hedges / bushes: along the south edge (low, never hiding the road), field edges, gardens
    for (let x = -158; x < 160; x += 4.2) { const z = 95 + r.range(-1, 1); if (okTree(x, z, 0.8, 3)) addTree('bush', x, z, r.range(2.2, 3.2), r.pick(decCols)); }
    for (let i = 0; i < 110; i++) {
      const x = r.range(TX0 + 4, TX1 - 4), z = r.range(-64, 92);
      if (!okTree(x, z, 1.0, 2.5)) continue;
      if (z > 82 && gy(x, z) > 0.5) continue;
      addTree('bush', x, z, r.range(2, 3.6), r.pick(decCols.concat([0x3f6a2a])));
    }
    chunked(conGeo, treeMat, cons, { colors: true }, 130);
    // boulders and scree at the mountain foot and in the gorge
    {
      let bg = new T.IcosahedronGeometry(1, 1); bg.deleteAttribute('uv'); bg = BU.mergeVertices(bg);
      const bp = bg.attributes.position, q = K.rng(31);
      for (let i = 0; i < bp.count; i++) { const k = 0.75 + q() * 0.5; bp.setXYZ(i, bp.getX(i) * k, bp.getY(i) * k * 0.8, bp.getZ(i) * k); }
      bg.computeVertexNormals();
      const rocks = [];
      for (let i = 0; i < 2500 && rocks.length < 170; i++) {
        const x = r.range(TX0 + 3, TX1 - 3), z = r.range(-104, -58);
        const h = gy(x, z), rk = rockAt(x, z);
        if (h < 0.3 || roadD(x, z) < 3 || inFade(x, z) || nearPortal(x, z) || isBlocked(x, z)) continue;
        const nearRiver = riverInfo(x, z)[0] < 7;
        if (h > 7 || rk > 0.6) continue;
        if (!(rk > 0.2 || nearRiver) && r() > 0.2) continue;
        const sz = r.range(0.5, 1.6) * (nearRiver ? 0.9 : 1.15);
        rocks.push({ x, y: h + sz * 0.1, z, ry: r() * TAU, rx: r.range(-0.3, 0.3), s: sz, color: r.pick([0xc8c2b8, 0xb8b2a8, 0xd4cec2, 0xa8a298]) });
      }
      chunked(bg, K.std({ color: 0xffffff, roughness: 0.9, flatShading: true }), rocks, { colors: true }, 170);
    }
    {
      const spurTrees = [];
      for (let i = 0; i < 1500 && spurTrees.length < 60; i++) {
        const x = r.range(50, 130), z = r.range(-84, -40);
        if (!inFade(x, z) || nearPortal(x, z)) continue;
        const h = gy(x, z);
        if (h < 5 || rockAt(x, z) > 0.45) continue;
        const hh = r.range(9, 14);
        spurTrees.push({ x, y: h - 0.2, z, ry: r() * TAU, sx: hh, sy: hh, sz: hh, color: r.pick(conCols) });
      }
      const fm = treeMat.clone(); fm.transparent = true;
      A.spurTreeMat = fm;
      A.spurTrees = chunked(conGeo, fm, spurTrees, { colors: true }, 300);
      for (const m of A.spurTrees) m.renderOrder = 2;
    }
    chunked(decGeo, treeMat, decs, { colors: true }, 130);
    chunked(bushGeo, treeMat, bushes, { colors: true, cast: true }, 130);

    // ---------------------------------------------------------------- static grass tufts and meadow flowers
    {
      const Q = (K.quality && K.quality.grass) || 0.7;
      const pos = [], nrm = [], col = [], idx = [];
      const tr = K.rng(77);
      for (let b = 0; b < 5; b++) {
        const a = tr() * TAU, rad = tr() * 0.25;
        const ox = Math.cos(a) * rad, oz = Math.sin(a) * rad;
        const h = 0.55 + tr() * 0.4, w = 0.1 + tr() * 0.05, rot = tr() * TAU, lean = 0.08 + tr() * 0.18, la = a + tr.range(-0.6, 0.6);
        const cr = Math.cos(rot), sr = Math.sin(rot), base = pos.length / 3;
        for (const [t, hw] of [[0, w / 2], [0.5, w * 0.35], [1, 0]]) {
          const y = t * h, bend = lean * t * t;
          for (const sgn of t < 1 ? [-1, 1] : [0]) {
            const lx = sgn * hw;
            pos.push(ox + lx * cr + Math.cos(la) * bend, y, oz + lx * sr + Math.sin(la) * bend);
            nrm.push(-sr * 0.3, 1, cr * 0.3);
            const k = 0.72 + 0.28 * t; col.push(k * 0.97, k, k * 0.85);
          }
        }
        idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2, base + 2, base + 3, base + 4);
      }
      const tuft = new T.BufferGeometry();
      tuft.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); tuft.setAttribute('normal', new T.Float32BufferAttribute(nrm, 3)); tuft.setAttribute('color', new T.Float32BufferAttribute(col, 3));
      tuft.setIndex(idx);
      const gMat = K.std({ vertexColors: true, side: T.DoubleSide, roughness: 0.85 });
      const tufts = [];
      const cols = [0x9ac850, 0xb0d060, 0x88b844, 0xc8d070, 0xa8c058, 0xd0c878, 0x7aa83e];
      const n = Math.round(11500 * Q);
      for (let i = 0, tries = 0; i < n && tries < n * 4; tries++) {
        const x = tr.range(TX0 + 1, TX1 - 1), z = tr.range(-100, TZ1 - 1);
        const rd = roadD(x, z);
        if (rd < 0.8) continue;
        const near = rd < 6 ? 1.6 : 1;
        if (tr() > 0.45 * near) continue;
        if (railD(x, z) < 3.1 || isBlocked(x, z) || inFade(x, z) || rockAt(x, z) > 0.4) continue;
        const h = gy(x, z); if (h < -0.35) continue;
        const s = tr.range(0.9, 1.5);
        tufts.push({ x, y: h - 0.05, z, ry: tr() * TAU, s, sy: s * tr.range(0.8, 1.5), color: tr.pick(cols) });
        i++;
      }
      chunked(tuft, gMat, tufts, { colors: true, cast: false }, 90);
      const flowers = [];
      for (let i = 0; i < 700; i++) {
        const cx = tr.range(TX0 + 4, TX1 - 4), cz = tr.range(-90, 95);
        const x = cx, z = cz;
        if (roadD(x, z) < 1.5 || railD(x, z) < 3.5 || isBlocked(x, z) || inFade(x, z) || rockAt(x, z) > 0.4 || gy(x, z) < -0.3) continue;
        flowers.push({ x, y: gy(x, z) + tr.range(0.3, 0.7), z, s: tr.range(0.1, 0.17), color: tr.pick([0xffffff, 0xf6e04a, 0xe84a6a, 0xb07ad8, 0xffffff, 0xf2f0a0]) });
      }
      chunked(new T.IcosahedronGeometry(1, 0), K.std({ color: 0xffffff, roughness: 0.6 }), flowers, { colors: true, cast: false }, 110);
    }

    // ---------------------------------------------------------------- tiny people (H0 figures ~2 units tall)
    {
      const bodyP = [];
      bodyP.push(colorize(new T.CylinderGeometry(0.2, 0.17, 0.95, 8).translate(0, 0.48, 0), 0x4a4e5a));
      bodyP.push(colorize(new T.CylinderGeometry(0.27, 0.22, 0.75, 8).translate(0, 1.32, 0), 0xffffff));
      for (const e of [-1, 1]) bodyP.push(colorize(new T.CylinderGeometry(0.07, 0.07, 0.7, 6).translate(e * 0.3, 1.3, 0), 0xffffff));
      const figGeo = merge(bodyP);
      const headGeo = new T.SphereGeometry(0.17, 10, 8).translate(0, 1.87, 0);
      const people = [];
      const shirt = [0xc83a2a, 0x2a5aa8, 0xe8c84a, 0x3a8a4a, 0xf2f0ea, 0x8a3a8a, 0xd87a2a, 0x3a3a3a];
      const person = (x, z, y = null, a = r() * TAU) => people.push({ x, y: y ?? Math.max(0, gy(x, z)), z, ry: a, s: r.range(0.95, 1.08), color: r.pick(shirt) });
      const st = A.station;
      for (let k = 0; k < 9; k++) person(r.range(st.px0 + 4, st.px1 - 6), st.pz0 + r.range(1.6, 5), 1.0);
      for (const [x, z] of A.crowd) person(x, z, 0, -PI / 2 + r.range(-0.4, 0.4));
      for (const [x, z] of [[-38, -10], [-37, -9.2], [-24, 6], [-40, 26], [-12, 40], [30, -2], [28, -1], [9, 26], [-52, 10], [70, 28], [88, 6], [-36, 34]]) person(x, z);
      person(A.angler[0], A.angler[1], WATER_Y + 0.2);
      for (const [x, z] of [[-30, -100], [-27, -99], [-24, -101]]) person(x, z); // hikers
      for (const c of A.lc) { const [x, z] = local(c.x, c.z, c.angle, -11, -10); if (K.offRoad(x, z, 1) && railD(x, z) > 4) person(x, z, 0, -c.angle); }
      const pp = people.filter((q) => q.y > -1);
      K.instances(figGeo, vcSatin, pp, { colors: true });
      K.instances(headGeo, K.std({ color: 0xffffff, roughness: 0.6 }), pp.map((q) => ({ ...q, color: r.pick([0xe8b896, 0xd8a07a, 0xf0c8a8, 0xa8704a]) })), { colors: true });
    }

    // ---------------------------------------------------------------- the baseboard, backdrop and the attic below
    {
      const fasciaMat = K.std({ color: 0x2c3a2c, roughness: 0.55, metalness: 0.05 });
      const FB = -14;
      K.mesh(new T.BoxGeometry(332, -FB + 0.35, 1.2), fasciaMat, 0, FB / 2 + 0.17, BOUNDS.maxZ + 0.6, { cast: false });
      // side fascias follow the terrain profile (mountains at the back)
      for (const sx of [BOUNDS.minX - 0.6, BOUNDS.maxX + 0.6]) {
        const sh = new T.Shape();
        sh.moveTo(BOUNDS.maxZ + 1.2, FB);
        sh.lineTo(BOUNDS.minZ - 1, FB);
        for (let z = BOUNDS.minZ - 1; z <= BOUNDS.maxZ + 1.2; z += 2) sh.lineTo(z, Math.max(0.35, gy(sx > 0 ? BOUNDS.maxX - 0.5 : BOUNDS.minX + 0.5, clamp(z, BOUNDS.minZ, BOUNDS.maxZ)) + 0.3));
        const g = new T.ExtrudeGeometry(sh, { depth: 1.2, bevelEnabled: false });
        g.rotateY(-PI / 2); g.translate(sx + 0.6, 0, 0);
        const m = new T.Mesh(g, fasciaMat); m.receiveShadow = true; K.group.add(m);
      }
      // painted backdrop: sky and distant Alps
      const bc = TX.makeCanvas(2048, 512), g = bc.getContext('2d');
      const sky = g.createLinearGradient(0, 0, 0, 512); sky.addColorStop(0, '#7fa6cf'); sky.addColorStop(0.55, '#bcd3e6'); sky.addColorStop(1, '#efe2c8');
      g.fillStyle = sky; g.fillRect(0, 0, 2048, 512);
      const q = K.rng(61);
      for (let i = 0; i < 26; i++) { const x = q() * 2048, y = 40 + q() * 160, w = 80 + q() * 200; const cg = g.createRadialGradient(x, y, 0, x, y, w); cg.addColorStop(0, 'rgba(255,255,255,0.55)'); cg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = cg; g.beginPath(); g.ellipse(x, y, w, w * 0.32, 0, 0, TAU); g.fill(); }
      const ridge = (y0, amp, col, seed, snow = false) => {
        const rr = K.rng(seed);
        const ys = [];
        let y = y0;
        for (let x = 0; x <= 2048; x += 8) { const pk = Math.abs(Math.sin(x / (90 + seed * 7) + seed)) ** 1.6; y = y0 - amp * pk - amp * 0.25 * Math.sin(x / 37 + seed * 3) - rr() * amp * 0.06; ys.push([x, y]); }
        g.fillStyle = col; g.beginPath(); g.moveTo(0, 512); for (const [x, yy] of ys) g.lineTo(x, yy); g.lineTo(2048, 512); g.closePath(); g.fill();
        if (snow) { g.fillStyle = 'rgba(248,250,255,0.9)'; for (const [x, yy] of ys) if (yy < y0 - amp * 0.62) { g.beginPath(); g.moveTo(x - 6, yy + 18); g.lineTo(x, yy); g.lineTo(x + 6, yy + 18); g.fill(); g.fillRect(x - 4, yy, 8, (y0 - amp * 0.62 - yy) * 0.8 + 6); } }
      };
      ridge(330, 170, '#a6b4c8', 3, true);
      ridge(370, 130, '#8a9cb2', 5, true);
      ridge(420, 90, '#6d8098', 9);
      ridge(470, 60, '#5a7056', 11);
      const bt = TX.toTexture(bc, { wrap: false });
      const back = new T.Mesh(new T.PlaneGeometry(334, 92), new T.MeshBasicMaterial({ map: bt, color: 0xe4ddd2 }));
      back.position.set(0, 32, BOUNDS.minZ - 0.8); keep.push(back); K.group.add(back);
      K.mesh(new T.BoxGeometry(334, 93, 1.0), fasciaMat, 0, 32, BOUNDS.minZ - 1.8, { cast: false });
      // frame and legs under the layout
      const frameMat = K.std({ color: 0x6a4a30, roughness: 0.7 });
      K.mesh(new T.BoxGeometry(326, 2, 206), frameMat, 0, FB - 1, -6, { cast: false });
      for (const [lx, lz] of [[-155, 92], [155, 92], [-155, -104], [155, -104], [0, 92], [0, -104]]) K.mesh(new T.BoxGeometry(6, 62, 6), frameMat, lx, -45, lz, { cast: false });
      // attic floor (wide pine boards) and a rag rug
      const fw = TX.woodTextures({ size: 512, seed: 7, planks: 5, base: 0x9a7048, dark: 0x6a4628, light: 0xc0905e, ringFreq: 16, gap: 0.006, roughBase: 0.55 });
      for (const t of Object.values(fw)) t.repeat.set(1800 / 110, 1800 / 110);
      K.mesh(new T.PlaneGeometry(1800, 1800), K.std({ map: fw.map, normalMap: fw.normalMap, roughnessMap: fw.roughnessMap, normalScale: V2(0.4) }), 0, -76, 0, { rx: -PI / 2, cast: false });
      const rugC = TX.paint(256, 256, (x, y, u, v, o) => { const d = Math.max(Math.abs(u - 0.5), Math.abs(v - 0.5)); const band = Math.floor(d * 18) % 3; const n = Math.random() * 20; const c = [[138, 52, 40], [206, 182, 140], [96, 70, 52]][band]; o[0] = c[0] + n; o[1] = c[1] + n; o[2] = c[2] + n; });
      K.mesh(new T.PlaneGeometry(440, 320), K.std({ map: TX.toTexture(rugC, { wrap: false }), roughness: 1 }), 0, -75.8, 10, { rx: -PI / 2, cast: false });
      const shm = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.5, alphaMap: TX.blobShadowTexture(), depthWrite: false }));
      shm.rotation.x = -PI / 2; shm.scale.set(440, 300, 1); shm.position.set(-20, -75.7, 20); K.group.add(shm);
    }

    // ---------------------------------------------------------------- the operator's corner: control panel + transformer, mug, loco box, tweezers
    {
      // control panel with a track diagram (SE corner of the board)
      const cx = 140, cz = 88;
      const mc = TX.makeCanvas(512, 256), g = mc.getContext('2d');
      g.fillStyle = '#25402e'; g.fillRect(0, 0, 512, 256);
      g.strokeStyle = '#f2d24a'; g.lineWidth = 8; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(60, 70); g.lineTo(452, 70); g.arc(452, 128, 58, -PI / 2, PI / 2); g.lineTo(60, 186); g.arc(60, 128, 58, PI / 2, PI * 1.5); g.stroke();
      g.strokeStyle = '#e8e2d0'; g.lineWidth = 5; g.beginPath(); g.moveTo(140, 186); g.lineTo(200, 160); g.lineTo(330, 160); g.lineTo(380, 186); g.stroke();
      for (const [x, y] of [[170, 196], [360, 196], [256, 60], [300, 60]]) { g.fillStyle = '#d02a22'; g.beginPath(); g.arc(x, y, 9, 0, TAU); g.fill(); }
      g.fillStyle = '#e8e2d0'; g.font = '700 22px Rubik, Arial'; g.fillText('TANNENBRÜCK', 196, 140);
      for (let k = 0; k < 6; k++) { g.fillStyle = '#c8c8c8'; g.fillRect(40 + k * 40, 218, 18, 26); g.fillStyle = '#222'; g.fillRect(45 + k * 40, 222, 8, 12); }
      const panelTop = K.std({ map: TX.toTexture(mc, { wrap: false }), roughness: 0.5 });
      const woodP = K.std({ color: 0x7a5434, roughness: 0.6 });
      const pnl = new T.Group();
      const body = new T.Mesh(new T.BoxGeometry(26, 2.4, 11), woodP); body.position.y = 1.2; pnl.add(body);
      const topM = new T.Mesh(new T.BoxGeometry(25, 0.3, 10.2), woodP); topM.position.set(0, 2.6, 0); topM.rotation.x = 0.16; pnl.add(topM);
      const topP = new T.Mesh(new T.PlaneGeometry(24.4, 9.8), panelTop); topP.position.set(0, 2.76, 0.02); topP.rotation.x = -PI / 2 + 0.16; pnl.add(topP);
      // transformer with a big knob
      const tr = new T.Mesh(new K.RoundedBoxGeometry(9, 4.2, 7, 3, 0.5), K.plastic(0x2a4a8a, 0.35)); tr.position.set(-20, 2.1, -0.5); pnl.add(tr);
      const knob = new T.Mesh(K.lathe([[0.01, 0], [2.6, 0], [2.7, 0.4], [2.4, 1.3], [0.01, 1.4]], 32), K.plastic(0x141414, 0.3)); knob.position.set(-20, 4.2, -0.5); pnl.add(knob);
      const arrow = new T.Mesh(new T.BoxGeometry(0.4, 0.1, 2.0), K.std({ color: 0xf2f0ea })); arrow.position.set(-20, 5.62, 0.3); arrow.rotation.y = 0.5; pnl.add(arrow);
      const lbl = TX.labelTexture(256, 64, (g2) => { g2.fillStyle = '#e8e8e8'; g2.fillRect(0, 0, 256, 64); g2.fillStyle = '#222'; g2.font = '700 30px Rubik, Arial'; g2.textAlign = 'center'; g2.fillText('◄  0  ►   16 V', 128, 43); });
      const lm2 = new T.Mesh(new T.PlaneGeometry(6, 1.5), K.std({ map: lbl })); lm2.position.set(-20, 3.2, 3.02); pnl.add(lm2);
      pnl.position.set(cx, 0, cz); pnl.rotation.y = 0.05;
      K.add(pnl);
      AO(cx - 4, cz, 22, 8, 0.45, 0.05);
      K.box(cx - 4, cz, 18, 6, -0.05, 6);
      block(cx - 4, cz, 19, 7);
      // coffee mug on the board's south-west corner
      const mx = -150, mz = 86;
      const prof = [[3.9, 0], [4.4, 0.3], [4.6, 1.2], [4.6, 9.4], [4.2, 9.6], [4.1, 1.4], [0, 1.2]];
      const mug = K.lathe(prof, 48);
      const mugTex = TX.labelTexture(512, 128, (g2) => { g2.fillStyle = '#c8442a'; g2.fillRect(0, 0, 512, 128); g2.fillStyle = '#f6efe0'; g2.font = '700 40px Rubik, Arial'; g2.fillText('H0  ●  1:87', 40, 78); g2.fillText('H0  ●  1:87', 300, 78); });
      K.mesh(mug, K.ceramic(0xc8442a), mx, 0, mz);
      K.mesh(new T.CylinderGeometry(4.62, 4.62, 4, 48, 1, true), K.ceramic(0xffffff, { map: mugTex }), mx, 5, mz, { ry: 0.6 });
      K.mesh(new T.TorusGeometry(2.4, 0.6, 12, 24, PI * 1.25), K.ceramic(0xc8442a), mx + 4.8, 5, mz, { rz: -PI * 0.62 });
      K.mesh(new T.CircleGeometry(4.15, 40), K.liquid(0x2a160a), mx, 8.2, mz, { rx: -PI / 2 });
      AO(mx, mz, 5.6, 5.6, 0.5); K.circle(mx, mz, 4.6, 10); block(mx, mz, 6, 6);
      // loco box (made-up brand) and tweezers
      const lb = TX.labelTexture(512, 128, (g2) => { g2.fillStyle = '#f2ead6'; g2.fillRect(0, 0, 512, 128); g2.fillStyle = '#1e3a6a'; g2.fillRect(0, 0, 150, 128); g2.fillStyle = '#f2ead6'; g2.font = '700 64px Rubik, Arial'; g2.fillText('H0', 30, 86); g2.fillStyle = '#1e3a6a'; g2.font = '700 34px Georgia, serif'; g2.fillText('Tenderlok BR 89', 170, 60); g2.font = '22px Rubik, Arial'; g2.fillText('Art.-Nr. 4410 · Spur H0 · 1:87', 170, 98); });
      const lbm = K.std({ map: lb, roughness: 0.7 }), lbs = K.std({ color: 0xe8dcc0, roughness: 0.8 });
      K.mesh(new T.BoxGeometry(20, 4.4, 5.4), lbs, -130, 2.2, 92, { ry: -0.12 });
      const lid = K.mesh(new T.PlaneGeometry(19.6, 5.0), lbm, -130, 4.42, 92, { cast: false });
      lid.rotation.order = 'YXZ'; lid.rotation.y = -0.12; lid.rotation.x = -PI / 2;
      AO(-130, 92, 11, 3.5, 0.45, -0.12); K.box(-130, 92, 10, 2.8, 0.12, 4.5); block(-130, 92, 11, 3.5, 0.12);
      for (const e of [-1, 1]) prop(new T.BoxGeometry(11, 0.18, 0.4), 0xd0d4d8, { x: -145, y: 0.4, z: 76 + e * 0.35, ry: 0.5 + e * 0.04 }, vcMetal);
    }

    // ---------------------------------------------------------------- contact shadows (one instanced draw) + merge
    flushBake();
    {
      const g = new T.PlaneGeometry(1, 1); g.rotateX(-PI / 2);
      const mat = new T.MeshBasicMaterial({ color: 0x0a0804, transparent: true, alphaMap: TX.blobShadowTexture(), depthWrite: false });
      mat.onBeforeCompile = (sh) => {
        sh.vertexShader = 'varying float vOp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\nvOp = length(instanceMatrix[1].xyz);\n#endif');
        sh.fragmentShader = 'varying float vOp;\n' + sh.fragmentShader.replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\ndiffuseColor.a *= vOp;');
      };
      const im = K.instances(g, mat, contacts, { cast: false, receive: false });
      im.renderOrder = 1; keep.push(im);
    }
    {
      K.group.updateMatrixWorld(true);
      const isKept = (o) => { for (let p = o; p; p = p.parent) if (keep.includes(p)) return true; return false; };
      const buckets = new Map();
      K.group.traverse((o) => {
        if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || isKept(o)) return;
        if (o.material.transparent || o.renderOrder) return;
        if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
        const c = o.geometry.boundingSphere.center.clone().applyMatrix4(o.matrixWorld);
        if (o.geometry.boundingSphere.radius * o.matrixWorld.getMaxScaleOnAxis() > 70) return;
        const cell = Math.floor((c.x + 200) / 110) + ':' + Math.floor((c.z + 200) / 110);
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
  },

  // fixed-rate: CPU drivers wait at a closed level crossing instead of driving into the train
  tick(dt, time, game) {
    if (!A || !A.lc) return;
    // a new race starts with the train standing at the platform, departing shortly after GO
    if (game.state === 'countdown' && game.raceTime === 0 && game.countFull && game.countT > 2.9 && !A.synced) {
      A.t0 = time - (TRAIN.dwell - 6.5);
      A.synced = true;
    }
    if (game.state !== 'countdown') A.synced = false;
    const Lr = game.track.length;
    const u = cycleT(time);
    for (const e of game.cars) {
      if (!e.ai || e.out) continue;
      const c = e.car;
      if (c.state !== 'drive' || c.airborne) continue;
      for (const lc of A.lc) {
        const d = ((((lc.roadS - e.trackS) % Lr) + Lr) % Lr);
        if (d > 70) continue;
        const tArr = lc.tA - u, tClr = lc.tD - u;
        if (tClr < -0.1 || tArr > 10) continue;
        const sp = Math.max(0, c.fwdSpeed);
        if (tArr > (d + 6) / Math.max(sp, 8) + 0.9) continue; // can clear it before the train arrives
        const stopD = d - 7.6;
        if (stopD < -1.2) continue; // committed
        const vmax = Math.sqrt(2 * 75 * Math.max(0, stopD));
        if (sp > vmax) { const k = vmax / Math.max(sp, 0.01); c.vx *= k; c.vz *= k; }
        e.ai.stuckT = 0;
      }
    }
  },

  animate(time, dt, game) {
    if (!A || !A.trainMeshes) return;
    const rail = A.rail;
    // ---- train
    const [run, speed] = trainRun(time);
    const head = A.sStop + run;
    for (let i = 0; i < A.trainMeshes.length; i++) {
      const len = TRAIN.lens[i], sf = head - A.off[i];
      const pa = rail.at(sf - len * 0.22), pb = rail.at(sf - len * 0.78);
      const m = A.trainMeshes[i];
      const mx = (pa.x + pb.x) / 2, mz = (pa.z + pb.z) / 2;
      m.position.set(mx, railTop(sf - len / 2), mz);
      m.rotation.set(0, -Math.atan2(pa.z - pb.z, pa.x - pb.x), 0);
      const sh = A.trainShadow[i]; sh.position.set(mx, 0.05 + railTop(sf - len / 2) * 0.5, mz); sh.rotation.z = -Math.atan2(pa.z - pb.z, pa.x - pb.x);
    }
    // smoke from the loco chimney
    if (game && game.particles && dt > 0) {
      const loco = A.trainMeshes[0];
      const c = Math.cos(loco.rotation.y), s = Math.sin(loco.rotation.y);
      const lx = 5.1; // chimney, local x from the mesh origin
      const wx = loco.position.x + c * lx, wz = loco.position.z - s * lx, wy = loco.position.y + 5.2;
      const pdt = Math.min(0.12, Math.max(dt, time - (A.lastPuffT ?? time))); A.lastPuffT = time;
      if (game.onScreen(wx, wy, wz, 0.2)) {
        A.puff += pdt * (speed > 1 ? 3 + speed * 0.32 : 1.6);
        while (A.puff > 1) {
          A.puff -= 1;
          game.particles.emit(wx, wy, wz, { vx: -c * speed * 0.15, vz: s * speed * 0.15, vy: 3 + speed * 0.08, spread: 1.2, up: 1.5, grav: -1.5, color: speed > 1 ? 0xe8e6e2 : 0xcfcac2, size: 1.0, life: 1.6, alpha: 0.55, grow: 2.2 });
          if (speed > 1 && game.sound.ctx && (game.state === 'race' || game.state === 'roundEnd') && Math.random() < 0.5) game.sound.noiseBurst(0.09, { freq: 700, q: 0.8, vol: 0.02, type: 'bandpass', pan: game.panOf(wx, wz) });
        }
      }
      // departure whistle
      const u = cycleT(time);
      if (A.lastU != null && A.lastU < TRAIN.dwell - 0.8 && u >= TRAIN.dwell - 0.8 && game.onScreen(wx, wy, wz, 0.3) && game.sound.ctx && game.state !== 'attract') {
        game.sound.tone(1180, 0.55, { type: 'triangle', vol: 0.06, slideTo: 1240 }); game.sound.tone(1480, 0.5, { type: 'sine', vol: 0.04, when: 0.05 });
      }
      A.lastU = u;
    }
    // ---- level crossings: lights, half-barriers, bell
    const u = cycleT(time);
    A.lc.forEach((lc, i) => {
      const warn = u > lc.tA - 5.2 && u < lc.tD + 1.4;
      const down = ss(lc.tA - 4.2, lc.tA - 2.7, u) * (1 - ss(lc.tD + 0.25, lc.tD + 1.7, u));
      const vis = A.lcVis[i];
      for (const b of vis.booms) b.rotation.x = (1 - down) * (PI / 2 - 0.02);
      const ph = Math.floor(time * 2.6) % 2;
      for (let k = 0; k < 2; k++) { const on = warn && k === ph; vis.mats[k].emissiveIntensity = on ? 3.2 : 0; vis.halos[k].opacity = on ? 0.75 : 0; }
      vis.mats[2].emissiveIntensity = warn ? 2.6 : 0;
      if (warn && game && game.sound.ctx && (game.state === 'race' || game.state === 'roundEnd' || game.state === 'countdown') && game.onScreen(lc.x, 2, lc.z, 0.25)) {
        A.lcBell[i] -= dt;
        if (A.lcBell[i] <= 0) { A.lcBell[i] = 0.42; game.sound.tone(1560, 0.12, { type: 'sine', vol: 0.035 }); game.sound.tone(2340, 0.08, { type: 'sine', vol: 0.015 }); }
      }
    });
    // ---- the mountain over the tunnel turns see-through while a car is inside
    let inside = false;
    if (game && game.cars) for (const e of game.cars) {
      if (e.out || !e.car || e.car.state !== 'drive') continue;
      if (e.trackS > TUN.s0 - 1.5 && e.trackS < TUN.s1 + 1.5 && Math.abs(e.lateral) < 11) inside = true;
    }
    const fdt = Math.min(0.2, Math.max(dt, time - (A.lastT ?? time))); A.lastT = time;
    A.fade += ((inside ? 1 : 0) - A.fade) * (1 - Math.exp(-fdt * (inside ? 8 : 2.5)));
    const op = 1 - 0.86 * A.fade;
    A.spurMat.opacity = op;
    A.spurMat.depthWrite = A.fade < 0.5;
    A.spurMesh.castShadow = A.fade < 0.35;
    A.spurTreeMat.opacity = 1 - A.fade; A.spurTreeMat.depthWrite = A.fade < 0.3;
    for (const m of A.spurTrees) { m.castShadow = A.fade < 0.35; m.visible = A.fade < 0.97; }
  },
};

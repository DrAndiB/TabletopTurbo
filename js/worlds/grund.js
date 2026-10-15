// World: Grund Prix. A model-maker's diorama of Luxembourg City's Grund and Clausen quarters, still on the
// hobby table between glue pots, paint tins, brushes and tweezers. The Alzette winds through a deep green valley
// between sandstone cliffs and old fortress walls; the cobbled road follows it, crosses it on three stone arch
// bridges and one splashy ford, loops round the Neimënster abbey and its square cloister, climbs a hairpin past
// the Wenzel wall onto the Rham plateau, drops into Clausen, weaves through the arches of the railway viaduct
// (a little railcar rumbles over now and then), runs along the café terraces of the Rives de Clausen (watch the
// tourist road-train) and squeezes through the Bock rock under the castle bridge. Raced on toy rally cars.
import * as THREE from '../../vendor/three.bundle.js';
import { Track } from '../track.js';

const TRACK = [
  [-125, 78], [-102, 78.5], [-80, 78], [-58, 77], [-38, 77.5], [-19, 77], [5, 74.9], [10.9, 69], [13, 52], [13, 40],
  [13, 25], [12, 8], [13.6, 2], [18, -2.4], [24, -4], [30, -2.4], [34.4, 2], [36, 8], [35, 25], [35, 40], [35, 57],
  [37.1, 65], [43, 70.9], [51, 73], [62, 73], [69, 73], [77, 70.9], [82.9, 65], [85, 57], [85, 40], [85, 23], [85, 6],
  [87, -1.5], [92.5, -7], [100, -9], [113, -9], [127, -12], [139, -20], [145.5, -36], [140, -52], [126, -60],
  [106, -62.5], [80, -63], [50, -64.5], [20, -63.5], [-2, -64], [-22, -62], [-38, -55], [-48, -41], [-49, -24],
  [-44, -9], [-46, 7], [-53, 21], [-67, 28], [-92, 30], [-114, 33], [-130, 44], [-136, 61],
];
const W = 13;
const BOUNDS = { minX: -166, maxX: 166, minZ: -106, maxZ: 100 };
const TABLE_Y = -6; // the hobby table the diorama board stands on
// Rham plateau (platform), the hairpin landing round the Wenzel wall's end tower, and the three ramps
const PL = { x0: 24, x1: 104, z0: 40, z1: 100, h: 8 };
const LD = { x0: 4, x1: 44, z0: -12, z1: 10, h: 4 };
const HP = { x: 24, z: 8, r: 12 }; // hairpin centre (track arc)
const WZ = { x0: 22, x1: 26, z0: 8.5, z1: 99 }; // Wenzel wall between the two ramps, then the plateau's west face
const RAMP1 = { x: 13, z: 25, len: 30, wid: 17 }; // up north 0 -> 4
const RAMP2 = { x: 35, z: 25, len: 30, wid: 17 }; // up south 4 -> 8
const RAMP3 = { x: 85, z: 23, len: 34, wid: 17 }; // down north 8 -> 0
// the Alzette, from upstream (east board edge) to downstream (south board edge)
const RIVER = [
  [182, -38.5], [166, -37.5], [146, -36], [131, -34.5], [118, -33], [104, -32], [80, -28.5], [50, -36], [20, -40],
  [-15, -40], [-45, -41], [-70, -37], [-88, -24], [-95, 0], [-92, 30], [-83, 58], [-79, 78], [-76, 96], [-75, 114],
];
const WL_HI = 0.12, WL_LO = -2.3; // water level above / below the weir
// railway viaduct over Clausen: north portal in the cliffs to the portal in the Rham knoll
const RAIL = [[95, -116], [96, -100], [99, -80], [101, -62], [104, -36], [107, -10], [110, 14], [113, 34], [116, 52]];
const VIA_H = 13; // deck top
const PI = Math.PI, TAU = PI * 2;
let A = null; // runtime state shared by build / tick / animate

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---- the tourist road-train: waits in its depot behind the houses, then one loop (out of the east gate, along
// the Rives de Clausen in the right-hand lane, back in through the west gate). Pure function of time.
const RTRAIN = { V: 10.5, acc: 6, dwell: 7, lens: [5.4, 5.6, 5.6], gap: 0.7, r: 1.45, h: 4.4 };
function roadTrainHead(t) {
  const S = A.rt;
  let u = (((t - S.t0) % S.P) + S.P) % S.P;
  if (u < RTRAIN.dwell) return 0;
  u -= RTRAIN.dwell;
  if (u < S.ta) return 0.5 * RTRAIN.acc * u * u;
  return Math.min(S.L, S.da + RTRAIN.V * (u - S.ta));
}
// ---- the railcar on the viaduct: shuttles between the two tunnels with a pause in each
const RCAR = { V: 15, acc: 5, dwell: 9, lens: [11.5, 11.5], gap: 0.5 };
function railcarHead(t) { // distance of the train's centre from the north tunnel end of the rail path
  const S = A.rc;
  const u = (((t - S.t0) % S.P) + S.P) % S.P;
  const run = (q) => (q < S.ta ? 0.5 * RCAR.acc * q * q : q < S.tr - S.ta ? S.da + RCAR.V * (q - S.ta) : S.D - 0.5 * RCAR.acc * (S.tr - q) ** 2);
  if (u < RCAR.dwell) return [S.a, 0];
  if (u < RCAR.dwell + S.tr) return [S.a + run(u - RCAR.dwell), 1];
  if (u < 2 * RCAR.dwell + S.tr) return [S.a + S.D, 0];
  return [S.a + S.D - run(u - 2 * RCAR.dwell - S.tr), -1];
}

export default {
  id: 'grund',
  name: 'Grund Prix',
  blurb: 'A model of Grund and Clausen: the winding Alzette, the Bock rock and the viaduct.',
  vehicle: 'rally',
  seed: 23,
  track: { points: TRACK, width: W, startS: 26 },
  bounds: BOUNDS,
  fallOffEdges: true,
  floorY: TABLE_Y + 0.08, // off the board you land on the cutting mat
  offCourse: 16,
  offroad: { kind: 'slow', margin: 1.5 },
  skidColor: 0x2a2622,
  dust: {
    normal: null,
    slow: { color: 0x7fa04a, size: 0.8, life: 0.5, up: 2.5, grav: 12, alpha: 0.7, grow: 1.4, rate: 1.4 },
    water: { color: 0xe8f4f6, size: 0.9, life: 0.55, up: 7, grav: 30, alpha: 0.85, grow: 1.6, rate: 3.2 },
    sticky: { color: 0xf4f2ea, size: 0.6, life: 0.5, up: 3, grav: 30, alpha: 0.9, grow: 1, rate: 2 },
  },
  lighting: {
    sunDir: [-0.66, 1.0, 0.2], sunColor: 0xffe6c4, sunIntensity: 2.8,
    hemiSky: 0xdfe8f2, hemiGround: 0x5a4c3a, hemiIntensity: 0.62,
    envIntensity: 0.42, exposure: 1.02, background: 0x221c18, shadowRadius: 2.2,
  },

  async build(K) {
    const { THREE: T, TX, r, track } = K;
    const L = track.length;
    const V2 = (a, b = a) => new T.Vector2(a, b);
    const BU = K.BufferGeometryUtils;
    const PH = K.physics;
    A = { fade: 0, lastT: null, L: track.length, lastHead: 0, wasMoving: false };
    const keep = []; // meshes that must not be merged (animated, transparent, already batched)
    const sAt = (x, z) => track.distTo(x, z).s;
    const sDist = (a, b) => { const d = (((b - a) % L) + L) % L; return d > L / 2 ? d - L : d; };
    const inS = (s, a, b) => { const d = (((s - a) % L) + L) % L; return d <= (((b - a) % L) + L) % L; };

    // ---------------------------------------------------------------- physics: ramps, landing, plateau
    K.ramp(RAMP1.x, RAMP1.z, -PI / 2, RAMP1.len, RAMP1.wid, LD.h, 0);
    K.platform((LD.x0 + LD.x1) / 2, (LD.z0 + LD.z1) / 2, (LD.x1 - LD.x0) / 2, (LD.z1 - LD.z0) / 2, 0, LD.h);
    K.ramp(RAMP2.x, RAMP2.z, PI / 2, RAMP2.len, RAMP2.wid, PL.h - LD.h, LD.h);
    K.platform((PL.x0 + PL.x1) / 2, (PL.z0 + PL.z1) / 2, (PL.x1 - PL.x0) / 2, (PL.z1 - PL.z0) / 2, 0, PL.h);
    K.ramp(RAMP3.x, RAMP3.z, PI / 2, RAMP3.len, RAMP3.wid, PL.h, 0);
    const gAt = (x, z) => PH.groundAt(x, z).g;

    // key places along the lap (arc lengths)
    const S = {
      start: 26, br1: sAt(-79, 78), r1a: sAt(13, 40), r1b: sAt(13, 10), r2a: sAt(35, 10), r2b: sAt(35, 40),
      r3a: sAt(85, 40), r3b: sAt(85, 6), via1: sAt(108, -9.5), ford: sAt(145.5, -36), via2: sAt(101, -62.5),
      rivesA: sAt(92, -62.8), rivesB: sAt(24, -63.6), bock: sAt(-6, -64), br2: sAt(-48, -41), br3: sAt(-92, 30),
    };
    A.S = S;
    const elevated = (s) => inS(s, S.r1a - 2, S.r3b + 2); // the climb, the plateau and the descent
    const roadG = new Float32Array(track.N);
    for (let i = 0; i < track.N; i++) roadG[i] = gAt(track.x[i], track.z[i]);

    // ---------------------------------------------------------------- noise
    const NF = TX.noiseField(256, { seed: 23, period: 8, oct: 4 });
    const NF2 = TX.noiseField(256, { seed: 37, period: 16, oct: 3 });
    const bil = (f, x, y) => {
      x = ((x % 256) + 256) % 256; y = ((y % 256) + 256) % 256;
      const x0 = x | 0, y0 = y | 0, x1 = (x0 + 1) & 255, y1 = (y0 + 1) & 255, fx = x - x0, fy = y - y0;
      return (f[y0 * 256 + x0] * (1 - fx) + f[y0 * 256 + x1] * fx) * (1 - fy) + (f[y1 * 256 + x0] * (1 - fx) + f[y1 * 256 + x1] * fx) * fy;
    };
    const n1 = (x, z, sc, o = 0) => bil(NF, x * sc + 37 + o, z * sc + 91 + o * 0.7);
    const n2 = (x, z, sc, o = 0) => bil(NF2, x * sc + 11 + o, z * sc + 53);

    // ---------------------------------------------------------------- distance fields (1-unit grid): road, river
    const G0X = BOUNDS.minX - 8, G0Z = BOUNDS.minZ - 8, GW = BOUNDS.maxX - BOUNDS.minX + 17, GH = BOUNDS.maxZ - BOUNDS.minZ + 17;
    const RD = new Float32Array(GW * GH).fill(60), RS = new Float32Array(GW * GH), RLAT = new Float32Array(GW * GH);
    const RV = new Float32Array(GW * GH).fill(60), RVA = new Float32Array(GW * GH);
    for (let i = 0; i < track.N; i += 2) {
      const x = track.x[i], z = track.z[i], hw = track.w[i] / 2, R = hw + 22, R2 = R * R; // nothing reads further out
      const nx = -track.tz[i], nz = track.tx[i];
      const gx0 = Math.max(0, Math.floor(x - R - G0X)), gx1 = Math.min(GW - 1, Math.ceil(x + R - G0X));
      const gz0 = Math.max(0, Math.floor(z - R - G0Z)), gz1 = Math.min(GH - 1, Math.ceil(z + R - G0Z));
      for (let gz = gz0; gz <= gz1; gz++) {
        const dz = gz + G0Z - z, dz2 = dz * dz;
        for (let gx = gx0; gx <= gx1; gx++) {
          const dx = gx + G0X - x, d2 = dx * dx + dz2, k = gz * GW + gx, cur = RD[k] + hw;
          if (d2 > R2 || d2 >= cur * cur) continue; // squared tests first: most cells are already nearer another sample
          RD[k] = Math.sqrt(d2) - hw; RS[k] = i * track.ds; RLAT[k] = dx * nx + dz * nz;
        }
      }
    }
    // the river: a densified centreline (1 unit), its half-width, water level and bed along it
    const rivCurve = new T.CatmullRomCurve3(RIVER.map(([x, z]) => new T.Vector3(x, 0, z)), false, 'centripetal');
    const RLEN = rivCurve.getLength();
    const RNP = Math.ceil(RLEN);
    const rivP = rivCurve.getSpacedPoints(RNP).map((v) => [v.x, v.z]);
    const rivT = rivP.map((p, i) => { const a = rivP[Math.max(0, i - 1)], b = rivP[Math.min(RNP, i + 1)]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; });
    const rStep = RLEN / RNP;
    const rIdxAtX = (x) => { let b = 0, bd = 1e9; rivP.forEach((p, i) => { if (Math.abs(p[0] - x) < bd && p[1] < -20) { bd = Math.abs(p[0] - x); b = i; } }); return b; };
    const dFord = rIdxAtX(145.5) * rStep, dWeir = rIdxAtX(127) * rStep;
    A.dWeir = dWeir;
    const rivHW = (d) => lerp(5, 6.6, ss(dFord + 16, dFord + 6, d)) - 0.4 * ss(RLEN - 160, RLEN - 120, d);
    const rivWL = (d) => lerp(WL_HI, WL_LO, ss(dWeir - 2.2, dWeir + 2.2, d));
    const rivBed = (d) => rivWL(d) - lerp(0.8, 1.25, ss(dWeir - 2, dWeir + 2, d));
    for (let i = 0; i <= RNP; i++) {
      const [x, z] = rivP[i], R = 30;
      const gx0 = Math.max(0, Math.floor(x - R - G0X)), gx1 = Math.min(GW - 1, Math.ceil(x + R - G0X));
      const gz0 = Math.max(0, Math.floor(z - R - G0Z)), gz1 = Math.min(GH - 1, Math.ceil(z + R - G0Z));
      for (let gz = gz0; gz <= gz1; gz++) {
        const dz = gz + G0Z - z, dz2 = dz * dz;
        for (let gx = gx0; gx <= gx1; gx++) {
          const dx = gx + G0X - x, d2 = dx * dx + dz2, k = gz * GW + gx;
          if (d2 >= RV[k] * RV[k]) continue;
          RV[k] = Math.sqrt(d2); RVA[k] = i * rStep;
        }
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
    const roadD = (x, z) => gridBil(RD, x, z, 60); // distance from the road edge (< 0 on the road)
    const roadS = (x, z) => gridN(RS, x, z, -1);
    const rivD = (x, z) => gridBil(RV, x, z, 60); // distance from the river centreline
    const rivA = (x, z) => gridN(RVA, x, z, 0);
    const inRiver = (x, z, m = 0) => rivD(x, z) < rivHW(rivA(x, z)) + m;
    const inPlat = (x, z) => x > PL.x0 && x < PL.x1 && z > PL.z0 && z < PL.z1 + 2;

    // ---------------------------------------------------------------- terrain height model
    const footN = (x) => { // foot of the northern cliffs: the upper town (NW), the Bock (centre), behind the Rives (NE)
      const a = lerp(-81, -72, ss(-50, -42, x));
      return lerp(a, -89.5, ss(13, 22, x)) + (n1(x, 0, 0.07, 3) - 0.5) * 2.2;
    };
    const knollH = (x, z) => {
      const xw = x + Math.min(1, (n1(x, z, 0.05, 13) - 0.6) * 14); // a ragged west face (never closer to the descent)
      return 19.5 * ss(22, 31, z + (n1(x, z, 0.08, 9) - 0.5) * 3) * ss(97, 109, xw) + (n2(x, z, 0.1, 5) - 0.5) * 2.4 * ss(26, 34, z) * ss(104, 112, x);
    };
    const H = (x, z) => {
      let h = 0;
      // northern cliffs and the upper town on top; the Bock rock juts forward between x -42 and 14
      const t = footN(x) - z;
      if (t > -2) {
        const bock = ss(-48, -40, x) * ss(18, 12, x);
        const top = lerp(27 + 3 * n1(x, z, 0.02, 40), 21 + 2 * n1(x, z, 0.05, 4), bock);
        const rise = Math.pow(ss(-0.6, lerp(7.5, 4, bock), t + (n1(x, z, 0.09, 60) - 0.5) * 2), 0.85);
        const crag = (n1(x, z, 0.11, 70) - 0.5) * 7 * ss(1, 6, t) * (1 - ss(10, 16, t)) + (n2(x, z, 0.3, 9) - 0.5) * 2.6 * ss(0, 4, t) * (1 - ss(9, 14, t));
        let hc = top * rise + crag;
        if (rise > 0.08 && rise < 0.95) hc += Math.sin(hc * 1.7 + n1(x, z, 0.05, 3) * 3) * 0.8; // ledges in the rock
        h = Math.max(h, hc);
      }
      // the Bock's lower tip south of the cutting, a rock knoll over the river with casemates
      {
        const ax = ss(-37, -30, x) * ss(14, 8, x), az = ss(-47.2, -49.2, z) * ss(-57.6, -56.3, z);
        h = Math.max(h, (5.6 + 1.2 * n1(x, z, 0.2, 21)) * Math.min(ax, az) * ss(0, 0.25, Math.min(ax, az)));
      }
      // the green valley sides: under the upper town (NW) and along the west board edge
      {
        const rv = rivD(x, z);
        const nw = ss(-40, -52, x) * ss(-44, -54, z);
        const slope = (13 + 3 * n1(x, z, 0.03, 11)) * ss(9, 44, rv) * nw;
        const west = 17 * ss(-143, -160, x + (n1(x, z, 0.05, 2) - 0.5) * 6);
        h = Math.max(h, slope, west);
        h += (n1(x, z, 0.06, 80) - 0.45) * 2.2 * ss(4, 12, roadD(x, z)) * ss(8, 14, rv);
      }
      // the Rham knoll (east of the plateau): the viaduct disappears into it
      if (x > 92 && z > 16) h = Math.max(h, knollH(x, z));
      // the plateau itself
      if (inPlat(x, z)) h = Math.max(h, PL.h);
      // keep the road corridor at the road's own level (the climb has its own masonry)
      const rd = roadD(x, z);
      if (rd < 4) {
        const s = roadS(x, z), i = track.idx(s);
        if (!elevated(s) || roadG[i] > PL.h - 0.5) h = lerp(roadG[i], h, ss(1.0, 3.2, rd));
      }
      // keep the quays flat by the river
      const rv = rivD(x, z), hw = rivHW(rivA(x, z));
      if (rv < hw + 6) h = lerp(0, h, ss(hw + 0.6, hw + 3.4, rv));
      // board edges: keep the south edge low except under the plateau and the knoll
      h = Math.max(h, -0.5);
      return h;
    };

    // ---------------------------------------------------------------- textures
    const grassTex = (() => { // static-grass flock: dots rasterised in JS (no slow canvas read-back for the normal map)
      const Sz = 512, N = Sz * Sz;
      const nA = TX.noiseField(256, { seed: 3, period: 6, oct: 4 });
      const R = new Float32Array(N), G = new Float32Array(N), B = new Float32Array(N), Hh = new Float32Array(N);
      for (let y = 0; y < Sz; y++) for (let x = 0; x < Sz; x++) {
        const t = TX.sampleField(nA, 256, x / 2, y / 2), k = y * Sz + x;
        R[k] = 66 + t * 34; G[k] = 100 + t * 42; B[k] = 38 + t * 16;
      }
      const cols = [0x5d8f34, 0x79a843, 0x4a7a2a, 0x97b85a, 0x3d6622, 0xa9b866, 0x6e9a3a, 0x86a04a].map((c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255]);
      const rr = K.rng(5);
      for (let i = 0; i < 9000; i++) {
        const cx = rr() * Sz, cy = rr() * Sz, rad = 0.6 + rr() * 1.3, col = cols[(rr() * cols.length) | 0], al = 0.45 + rr() * 0.5;
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
      const nrm = TX.normalFromHeight(Hh, Sz, Sz, 1.75);
      return { map: TX.toTexture(c), normalMap: TX.toTexture(nrm, { srgb: false }) };
    })();
    const rockTex = (() => { // Luxembourg sandstone: warm grey-gold beds broken into blocks by joints, rain streaks, lichen
      const Sz = 512, q = K.rng(9);
      const nA = TX.noiseField(256, { seed: 41, period: 4, oct: 4 });
      const nB = TX.noiseField(256, { seed: 43, period: 16, oct: 3 });
      // beds of uneven thickness that add up to exactly one tile (so the texture wraps)
      const beds = [];
      { let y = 0; while (y < Sz - 30) { const h = 26 + q() * 74; beds.push([y, Math.min(h, Sz - y)]); y += h; } const last = beds[beds.length - 1]; last[1] = Sz - last[0]; }
      const bedK = beds.map(() => 0.88 + q() * 0.22), bedW = beds.map(() => q());
      const bedAt = (y) => { for (let i = beds.length - 1; i >= 0; i--) if (y >= beds[i][0]) return i; return 0; };
      const c = TX.paint(Sz, Sz, (x, y, u, v, o) => {
        const a = TX.sampleField(nA, 256, u * 256, v * 256), b = TX.sampleField(nB, 256, u * 256, v * 256);
        const bi = bedAt(y), t = (y - beds[bi][0]) / beds[bi][1];
        let k = bedK[bi] * (0.86 + (a - 0.5) * 0.34 + (b - 0.5) * 0.22) * (1.04 - 0.12 * t * t); // each bed darker towards its base
        const warm = clamp(0.45 + bedW[bi] * 0.4 + (a - 0.5) * 0.6, 0, 1);
        o[0] = (172 + 30 * warm) * k; o[1] = (160 + 14 * warm) * k; o[2] = (132 - 16 * warm) * k;
      });
      const g = c.getContext('2d');
      const wrapX = (fn) => { for (const ox of [-Sz, 0, Sz]) fn(ox); };
      g.lineCap = 'round'; g.lineJoin = 'round';
      // bed joints: broken dark lines with a pale lip above (the ledge catches the light)
      for (const [y0] of beds) {
        let x = q() * 40;
        while (x < Sz) {
          const len = 30 + q() * 120, yy = y0 + (q() - 0.5) * 3, dy = (q() - 0.5) * 3, a1 = 0.18 + q() * 0.12, a2 = 0.45 + q() * 0.3, lw = 1.6 + q() * 1.8;
          wrapX((ox) => {
            g.strokeStyle = `rgba(250,240,214,${a1})`; g.lineWidth = 2; g.beginPath(); g.moveTo(x + ox, yy - 2.2); g.lineTo(x + len + ox, yy - 2.2 + dy); g.stroke();
            g.strokeStyle = `rgba(44,34,24,${a2})`; g.lineWidth = lw; g.beginPath(); g.moveTo(x + ox, yy); g.lineTo(x + len + ox, yy + dy); g.stroke();
          });
          x += len + 10 + q() * 70;
        }
      }
      // vertical joints splitting each bed into blocks, with shaded sides
      beds.forEach(([y0, h]) => {
        let x = q() * 30;
        while (x < Sz) {
          const xx = x, top = y0 + 1 + (q() < 0.3 ? q() * h * 0.5 : 0), bot = y0 + h - 1 - (q() < 0.3 ? q() * h * 0.4 : 0);
          const j1 = (q() - 0.5) * 10, j2 = (q() - 0.5) * 10, wd = 6 + q() * 10, al = 0.12 + q() * 0.16, a2 = 0.4 + q() * 0.35, lw = 1.2 + q() * 2;
          wrapX((ox) => {
            const sh = g.createLinearGradient(xx + ox - wd, 0, xx + ox, 0); sh.addColorStop(0, 'rgba(30,20,10,0)'); sh.addColorStop(1, `rgba(30,20,10,${al})`);
            g.fillStyle = sh; g.beginPath(); g.moveTo(xx + ox - wd, top); g.lineTo(xx + ox, top); g.lineTo(xx + ox + j1, (top + bot) / 2); g.lineTo(xx + ox + j2, bot); g.lineTo(xx + ox - wd + j2, bot); g.closePath(); g.fill();
            g.strokeStyle = `rgba(36,26,16,${a2})`; g.lineWidth = lw;
            g.beginPath(); g.moveTo(xx + ox, top); g.quadraticCurveTo(xx + ox + j1 * 1.6, (top + bot) / 2, xx + ox + j2, bot); g.stroke();
          });
          x += 40 + q() * 110;
        }
      });
      // weathered grey-green and darker patches, rain streaks running down from the ledges, lichen and moss
      for (let i = 0; i < 34; i++) {
        const x = q() * Sz, y = q() * Sz, rad = 20 + q() * 55, col = q() < 0.5 ? '110,116,96' : q() < 0.5 ? '60,50,40' : '214,196,150', al = 0.16 + q() * 0.14;
        wrapX((ox) => { for (const oy of [-Sz, 0, Sz]) { const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad); gr.addColorStop(0, `rgba(${col},${al})`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2); } });
      }
      for (let i = 0; i < 70; i++) {
        const x = q() * Sz, y = q() * Sz, len = 30 + q() * 90, w = 3 + q() * 8, al = 0.16 + q() * 0.16;
        wrapX((ox) => { const gr = g.createLinearGradient(0, y, 0, y + len); gr.addColorStop(0, `rgba(40,34,28,${al})`); gr.addColorStop(1, 'rgba(40,34,28,0)'); g.fillStyle = gr; g.fillRect(x + ox, y, w, len); });
      }
      for (let i = 0; i < 2600; i++) {
        const t = q(), x = q() * Sz, y = q() * Sz;
        g.fillStyle = t < 0.3 ? `rgba(84,104,52,${0.25 + q() * 0.35})` : t < 0.45 ? `rgba(190,196,170,${0.25 + q() * 0.3})` : t < 0.52 ? `rgba(196,150,70,${0.25 + q() * 0.3})` : t < 0.7 ? `rgba(40,34,28,${0.15 + q() * 0.2})` : `rgba(246,236,206,${0.1 + q() * 0.18})`;
        g.beginPath(); g.arc(x, y, 0.8 + q() * (t < 0.3 ? 4 : 2.6), 0, TAU); g.fill();
      }
      return TX.toTexture(c);
    })();
    const stoneTex = (seed, base, k0 = 1) => { // ashlar blocks: 4 units wide, 2 tall per tile
      const c = TX.makeCanvas(256, 128), g = c.getContext('2d');
      const rr = K.rng(seed);
      g.fillStyle = '#6f6656'; g.fillRect(0, 0, 256, 128);
      for (let row = 0; row < 4; row++) {
        let x = row % 2 ? -24 : 0;
        while (x < 256) {
          const w = 30 + rr() * 34, k = (0.8 + rr() * 0.32) * k0;
          g.fillStyle = `rgb(${base[0] * k | 0},${base[1] * k | 0},${base[2] * k | 0})`;
          g.fillRect(x + 2, row * 32 + 2, w - 3, 28);
          g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x + 2, row * 32 + 2, w - 3, 4);
          g.fillStyle = 'rgba(0,0,0,0.13)'; g.fillRect(x + 2, row * 32 + 26, w - 3, 4);
          x += w;
        }
      }
      for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${rr() < 0.5 ? '255,255,255' : '0,0,0'},${0.05 + rr() * 0.07})`; g.fillRect(rr() * 256, rr() * 128, 2, 2); }
      for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(70,96,46,${0.15 + rr() * 0.25})`; g.beginPath(); g.arc(rr() * 256, 100 + rr() * 28, 2 + rr() * 5, 0, TAU); g.fill(); } // moss low down
      return TX.toTexture(c);
    };
    const ashlar = stoneTex(71, [190, 172, 138]);
    const stoneMat = K.std({ map: ashlar, vertexColors: true, roughness: 0.88, side: T.DoubleSide });
    const slateTex = (() => {
      const c = TX.makeCanvas(256, 256), g = c.getContext('2d');
      const rr = K.rng(33);
      g.fillStyle = '#2a2c30'; g.fillRect(0, 0, 256, 256);
      for (let row = 0; row < 16; row++) for (let i = 0; i < 12; i++) {
        const x = i * 24 + (row % 2) * 12 - 12, y = row * 16;
        const k = 0.72 + rr() * 0.4;
        g.fillStyle = `rgb(${150 * k | 0},${156 * k | 0},${166 * k | 0})`;
        g.fillRect(x + 1, y + 1, 22, 14);
        g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x + 1, y + 1, 22, 2);
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + 1, y + 13, 22, 2);
      }
      return TX.toTexture(c);
    })();
    const roofMat = K.std({ map: slateTex, vertexColors: true, roughness: 0.62, metalness: 0.05 });
    // slate cones for towers and spires: UVs scaled so the slates stay small whatever the cone's size
    const slateCone = (rad, hgt, segs) => {
      const g = new T.ConeGeometry(rad, hgt, segs), uv = g.attributes.uv, sl = Math.hypot(rad, hgt);
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (TAU * rad) / 3.2, uv.getY(i) * sl / 2.4);
      return g;
    };
    const cobble = (() => { // granite setts in rows across the road, gutters along the edges; 13 x 13 units per tile
      const Sz = 512, rows = 28, rh = Sz / rows;
      const c = TX.makeCanvas(Sz, Sz), g = c.getContext('2d');
      const Hc = new Float32Array(Sz * Sz); // sett domes for the normal map, rasterised in JS (no canvas read-back)
      g.fillStyle = '#4e4840'; g.fillRect(0, 0, Sz, Sz);
      const rr = K.rng(51);
      const gut = 34; // gutter width in px each side
      const sett = (x, y, w, h, dark) => {
        const k = (0.74 + rr() * 0.42) * (dark ? 0.78 : 1), tt = rr();
        const b = tt < 0.36 ? [132, 128, 124] : tt < 0.7 ? [146, 132, 112] : [118, 118, 126];
        g.fillStyle = `rgb(${b[0] * k | 0},${b[1] * k | 0},${b[2] * k | 0})`;
        g.beginPath(); g.roundRect(x + 1.4, y + 1.4, w - 2.8, h - 2.8, 3.5); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(x + 3, y + 2, w - 6, 2);
        const cx = x + w / 2, cy = y + h / 2, hx = w / 2 - 1.4, hy = h / 2 - 1.4, rc = 3.5, rf = Math.max(w, h) * 0.62;
        for (let py = Math.max(0, Math.floor(cy - hy)); py < Math.min(Sz, Math.ceil(cy + hy)); py++) {
          for (let px = Math.max(0, Math.floor(cx - hx)); px < Math.min(Sz, Math.ceil(cx + hx)); px++) {
            const ex = Math.max(0, Math.abs(px + 0.5 - cx) - (hx - rc)), ey = Math.max(0, Math.abs(py + 0.5 - cy) - (hy - rc));
            if (ex * ex + ey * ey > rc * rc) continue;
            Hc[py * Sz + px] = 1 - 0.533 * Math.min(1, Math.hypot(px + 0.5 - cx, py + 0.5 - cy) / rf);
          }
        }
      };
      for (let row = 0; row < rows; row++) {
        let x = gut - rr() * 18;
        while (x < Sz - gut) { const w = Math.min(17 + rr() * 9, Sz - gut - x); if (w > 6) sett(Math.max(gut, x), row * rh, w - Math.max(0, gut - x), rh, false); x += w; }
      }
      for (const x0 of [0, Sz - gut]) for (let y = 0; y < Sz; y += 23.27) for (let k = 0; k < 2; k++) sett(x0 + k * gut / 2, y + (k ? 11 : 0), gut / 2, 23.27, true);
      g.fillStyle = 'rgba(255,255,255,0.05)'; // tyre-polished tracks
      for (const cx of [0.3, 0.7]) g.fillRect(Sz * cx - 30, 0, 60, Sz);
      const nrm = TX.normalFromHeight(Hc, Sz, Sz, 2.2);
      return { map: TX.toTexture(c), normalMap: TX.toTexture(nrm, { srgb: false }) };
    })();

    // ---------------------------------------------------------------- helpers: geometry, baking, contact shadows
    const contacts = [];
    const AO = (x, z, rx, rz = rx, op = 0.4, ang = 0, y = null) => contacts.push({ x, y: (y ?? Math.max(0, gy(x, z))) + 0.07, z, ry: -ang, sx: rx * 2, sy: op, sz: rz * 2 });
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
    const tidy = (g) => {
      if (g.index) g = g.toNonIndexed();
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color', 'uv'].includes(k)) g.deleteAttribute(k);
      if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!g.attributes.color) colorize(g, 0xffffff);
      return g;
    };
    const merge = (parts) => BU.mergeGeometries(parts.map(tidy), false);
    // world-scale box-projected UVs, chosen per triangle by its facing: masonry blocks keep their size on any
    // box or tower (plain box / cylinder UVs stretch a 4 x 2 ashlar tile round a whole tower: it reads as wood)
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
    const uvBox = new Map(); // material -> [units per tile across, up] for props built with prop() / frame()
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
    const chunked = (geo, mat, list, opts = {}, cell = 120) => {
      const b = new Map();
      for (const it of list) { const k = Math.floor((it.x + 330) / cell) + ',' + Math.floor((it.z + 330) / cell); if (!b.has(k)) b.set(k, []); b.get(k).push(it); }
      const out = [];
      for (const l of b.values()) { const im = K.instances(geo, mat, l, opts); keep.push(im); out.push(im); }
      return out;
    };
    const vc = K.std({ vertexColors: true, roughness: 0.78 });
    const vcSatin = K.phys({ vertexColors: true, roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.4 });
    const vcMetal = K.std({ vertexColors: true, roughness: 0.38, metalness: 0.7 });
    const glowMat = K.std({ vertexColors: true, emissive: 0xffd9a0, emissiveIntensity: 0.9, roughness: 0.4 });
    const prop = (geo, col, o, mat = vc, cast = true) => { const g = uvb(colorize(xf(geo, o), col), mat); bake(g, mat, o.x || 0, o.z || 0, cast); return g; };
    // a group of parts in a local frame (cx, cy, cz, ry): build a prop in its own coordinates
    const frame = (cx, cy, cz, ry, s = 1) => {
      const M = new T.Matrix4().compose(new T.Vector3(cx, cy, cz), new T.Quaternion().setFromEuler(new T.Euler(0, ry, 0)), new T.Vector3(s, s, s));
      return (geo, col, o, mat = vc, cast = true) => { let g = colorize(xf(geo, o), col); g.applyMatrix4(M); g = uvb(g, mat); bake(g, mat, cx, cz, cast); return g; };
    };
    const blocked = [];
    const block = (x, z, hw, hd, ang = 0, pad = 0) => blocked.push({ x, z, hw: hw + pad, hd: hd + pad, c: Math.cos(ang), s: Math.sin(ang) });
    const isBlocked = (x, z, m = 0) => { for (const b of blocked) { const dx = x - b.x, dz = z - b.z; const a = dx * b.c + dz * b.s, c = -dx * b.s + dz * b.c; if (Math.abs(a) < b.hw + m && Math.abs(c) < b.hd + m) return true; } return false; };
    const local = (cx, cz, a, along, side) => [cx + Math.cos(a) * along - Math.sin(a) * side, cz + Math.sin(a) * along + Math.cos(a) * side];
    const warnRoad = (what, x, z, m = 0.5) => { if (!K.offRoad(x, z, m)) console.warn(`grund: ${what} on road at ${x.toFixed(1)},${z.toFixed(1)}`); };
    // a swept profile along a list of frames {x, z, nx, nz, y}: prof = [[offset along n, height], ...]
    const sweep = (frames, prof, { uS = 4, vS = 2, col = null } = {}) => {
      const pos = [], uv = [], idx = [], cl = [];
      const pu = [0]; for (let k = 1; k < prof.length; k++) pu.push(pu[k - 1] + Math.hypot(prof[k][0] - prof[k - 1][0], prof[k][1] - prof[k - 1][1]));
      let acc = 0;
      frames.forEach((f, i) => {
        if (i) acc += Math.hypot(f.x - frames[i - 1].x, f.z - frames[i - 1].z);
        prof.forEach(([o, y, c], k) => { pos.push(f.x + f.nx * o, f.y + y, f.z + f.nz * o); uv.push(acc / uS, pu[k] / vS); const q = c ?? col ?? 1; cl.push(q, q, q); });
      });
      const P = prof.length;
      for (let i = 0; i < frames.length - 1; i++) for (let k = 0; k < P - 1; k++) { const a = i * P + k, b = a + 1, c2 = a + P, d = c2 + 1; idx.push(a, b, c2, b, d, c2); }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new T.Float32BufferAttribute(cl, 3));
      g.setIndex(idx); g.computeVertexNormals();
      return g;
    };
    // frames along the road edge (side -1 left, +1 right), following the ground under the road
    const roadFrames = (s0, s1, side, off, step = 1, yFn = null) => {
      const out = [], n = Math.max(1, Math.ceil(Math.abs(s1 - s0) / step));
      for (let i = 0; i <= n; i++) {
        const s = s0 + ((s1 - s0) * i) / n, p = track.at(s), o = side * (W / 2 + off);
        out.push({ x: p.x + p.nx * o, z: p.z + p.nz * o, nx: p.nx * side, nz: p.nz * side, y: yFn ? yFn(s) : roadG[track.idx(s)], s });
      }
      return out;
    };
    // a masonry parapet along a road edge, with colliders
    const parapet = (s0, s1, side, { off = 0.9, top = 1.2, bot = -0.2, th = 0.8, h = 3.2, mat = stoneMat, col = 0xf2ede2, coll = true } = {}) => {
      const fr = roadFrames(s0, s1, side, off, 0.75);
      const g = sweep(fr, [[0, bot, 0.82], [0, top, 0.95], [-0.1, top + 0.08, 1.1], [-0.1, top + 0.22, 1.2], [th + 0.1, top + 0.22, 1.2], [th + 0.1, top + 0.08, 1.1], [th, top, 0.95], [th, bot, 0.82]]);
      const c = new T.Color(col), ca = g.attributes.color;
      for (let i = 0; i < ca.count; i++) ca.setXYZ(i, ca.getX(i) * c.r, ca.getY(i) * c.g, ca.getZ(i) * c.b);
      bake(g, mat, fr[0].x, fr[0].z);
      if (coll) for (let i = 0; i < fr.length - 3; i += 3) { const a = fr[i], b = fr[Math.min(fr.length - 1, i + 3)]; K.capsule(a.x + a.nx * th / 2, a.z + a.nz * th / 2, b.x + b.nx * th / 2, b.z + b.nz * th / 2, th / 2 + 0.1, Math.max(a.y, b.y) + h); }
      return fr;
    };

    // ---------------------------------------------------------------- terrain mesh (one height grid, chunked)
    const TX0 = BOUNDS.minX, TX1 = BOUNDS.maxX, TZ0 = BOUNDS.minZ, TZ1 = BOUNDS.maxZ;
    const NXg = 222, NZg = 138;
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
    {
      const NRM = new Float32Array(nx * nz * 3), COL = new Float32Array(nx * nz * 3), UV = new Float32Array(nx * nz * 2);
      const cGrass = [[0.96, 1.0, 0.9], [1.1, 1.05, 0.8], [0.84, 0.94, 0.86], [1.02, 0.98, 0.78]];
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
        const k = j * nx + i, x = XS[i], z = ZS[j], h = HG[k];
        const i0 = Math.max(0, i - 1), i1 = Math.min(nx - 1, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(nz - 1, j + 1);
        const dhx = (HG[j * nx + i1] - HG[j * nx + i0]) / (XS[i1] - XS[i0]);
        const dhz = (HG[j1 * nx + i] - HG[j0 * nx + i]) / (ZS[j1] - ZS[j0]);
        const l = Math.hypot(dhx, 1, dhz);
        NRM[k * 3] = -dhx / l; NRM[k * 3 + 1] = 1 / l; NRM[k * 3 + 2] = -dhz / l;
        const slope = Math.hypot(dhx, dhz);
        const nz1 = n1(x, z, 0.05, 11), nz2 = n2(x, z, 0.12, 3);
        const flatTop = inPlat(x, z) && h < PL.h + 0.3;
        let rock = flatTop ? 0 : clamp(ss(0.9, 1.7, slope + (nz1 - 0.5) * 0.5), 0, 1);
        ROCK[k] = rock;
        const ga = cGrass[(nz1 * 3.99) | 0], gb = cGrass[(nz2 * 3.99) | 0];
        const t = (nz1 * 7) % 1;
        let cr = lerp(ga[0], gb[0], t), cg = lerp(ga[1], gb[1], t), cb = lerp(ga[2], gb[2], t);
        const rdv = roadD(x, z);
        if (rdv < 2.5) { const w = 1 - Math.max(0, rdv) / 2.5; cr *= 1 + w * 0.1; cb *= 1 - w * 0.08; }
        const rk = (0.86 + nz2 * 0.26) * (0.8 + 0.3 * n1(x, z, 0.31, 21));
        cr = lerp(cr, rk * 0.98, rock); cg = lerp(cg, rk * 0.93, rock); cb = lerp(cb, rk * 0.82, rock);
        COL[k * 3] = cr; COL[k * 3 + 1] = cg; COL[k * 3 + 2] = cb;
        UV[k * 2] = (x + h * 0.35) / 6; UV[k * 2 + 1] = (z - h * 0.75) / 6;
      }
      const tMat = K.std({ map: grassTex.map, normalMap: grassTex.normalMap, normalScale: V2(0.7), vertexColors: true, roughness: 0.95 });
      tMat.onBeforeCompile = (sh) => {
        sh.uniforms.rockMap = { value: rockTex };
        // rock is mapped tri-planar in world space (beds stay level and blocks keep their size on every face)
        sh.vertexShader = 'attribute float aRock;\nvarying float vRock;\nvarying vec3 vWP;\nvarying vec3 vWN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvRock = aRock;\nvWP = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;\nvWN = normalize( mat3( modelMatrix ) * objectNormal );');
        sh.fragmentShader = 'uniform sampler2D rockMap;\nvarying float vRock;\nvarying vec3 vWP;\nvarying vec3 vWN;\n' + sh.fragmentShader.replace('#include <map_fragment>', `
          #ifdef USE_MAP
            vec4 gC = texture2D( map, vMapUv );
            vec4 rC = gC;
            if ( vRock > 0.01 ) {
              vec3 bw = pow( abs( normalize( vWN ) ), vec3( 4.0 ) ); bw /= bw.x + bw.y + bw.z;
              vec3 q = vWP / 24.0;
              rC = texture2D( rockMap, vec2( q.z + 0.37, q.y ) ) * bw.x + texture2D( rockMap, vec2( q.x, q.y ) ) * bw.z + texture2D( rockMap, vec2( q.x, q.z ) ) * bw.y;
            }
            diffuseColor *= mix( gC, rC, vRock );
          #endif`);
      };
      // cells inside the river channel are left out (the channel is its own mesh)
      const pick = (x, z) => !inRiver(x, z, 0.35);
      const buildChunk = (i0, i1, j0, j1) => {
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
      const xs = [0, 56, 111, 166, NXg], zs = [0, 35, 69, 104, NZg];
      for (let a = 0; a < xs.length - 1; a++) for (let b = 0; b < zs.length - 1; b++) {
        const c = buildChunk(xs[a], xs[a + 1], zs[b], zs[b + 1]);
        if (!c) continue;
        const m = new T.Mesh(c.g, tMat);
        m.castShadow = c.maxH > 2.5; m.receiveShadow = true;
        keep.push(m); K.group.add(m);
      }
    }
    const rockAt = (x, z) => { const i = Math.round((x - TX0) / dxg), j = Math.round((z - TZ0) / dzg); return i < 0 || j < 0 || i >= nx || j >= nz ? 1 : ROCK[j * nx + i]; };

    // ---------------------------------------------------------------- the road: granite setts, kerbs, start line
    const FORD_DIP = (s) => -0.16 * ss(9, 5, Math.abs(sDist(S.ford, s)));
    const roadY = (s) => roadG[track.idx(s)] + FORD_DIP(s);
    {
      const roadMat = K.std({ map: cobble.map, normalMap: cobble.normalMap, normalScale: V2(0.85), roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      const segU = 4, pos = [], uv = [], idx = [];
      const rows = [];
      for (let s = 0; s < L - 0.01;) { rows.push(s); s += elevated(s) ? 0.5 : 1; }
      rows.push(L);
      rows.forEach((s) => {
        const p = track.at(s), y = roadY(s) + 0.06;
        for (let j = 0; j <= segU; j++) { const u = j / segU, o = (u - 0.5) * W; pos.push(p.x + p.nx * o, y, p.z + p.nz * o); uv.push(u, s / W); }
      });
      for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < segU; j++) { const a = i * (segU + 1) + j, b = a + 1, cc = a + segU + 1, d = cc + 1; idx.push(a, b, cc, b, d, cc); }
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx); geo.computeVertexNormals();
      const nr = geo.attributes.normal;
      for (let i = 0; i < nr.count; i++) if (nr.getY(i) < 0) nr.setXYZ(i, -nr.getX(i), -nr.getY(i), -nr.getZ(i));
      const m = new T.Mesh(geo, roadMat); m.receiveShadow = true;
      keep.push(m); K.group.add(m);
      // granite kerbs on both edges (light, so the road edge reads at a glance)
      for (const side of [-1, 1]) {
        const fr = roadFrames(0, L, side, 0, 1, roadY);
        const g = sweep(fr, [[-0.05, 0.02, 0.8], [0, 0.2, 1], [0.08, 0.26, 1.08], [0.66, 0.26, 1.08], [0.74, 0.2, 1], [0.8, -0.1, 0.8]], { uS: 3, vS: 3 });
        const mm = new T.Mesh(g, K.std({ map: ashlar, vertexColors: true, roughness: 0.7, color: 0xe2ded6 }));
        mm.receiveShadow = true; mm.castShadow = false; keep.push(mm); K.group.add(mm);
      }
      // start / finish: chequered setts painted across the road
      const c = TX.makeCanvas(256, 64), g = c.getContext('2d');
      for (let y = 0; y < 4; y++) for (let x = 0; x < 16; x++) { g.fillStyle = (x + y) % 2 ? '#1b1b1b' : '#f2efe6'; g.fillRect(x * 16, y * 16, 16, 16); }
      const p = track.at(S.start);
      const sm = K.mesh(new T.PlaneGeometry(W, 3.2), K.std({ map: TX.toTexture(c, { wrap: false }), roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), p.x, 0.08, p.z, { cast: false });
      sm.rotation.order = 'YXZ'; sm.rotation.y = -p.angle + PI / 2; sm.rotation.x = -PI / 2;
      keep.push(sm);
      // a cloth banner on two poles beside the line (north side, facing the camera) and chequered flags
      const bn = TX.labelTexture(512, 96, (g2) => {
        g2.fillStyle = '#f4f0e4'; g2.fillRect(0, 0, 512, 96);
        for (let i = 0; i < 32; i++) { g2.fillStyle = i % 2 ? '#1b1b1b' : '#f4f0e4'; g2.fillRect(i * 16, 0, 16, 10); g2.fillStyle = i % 2 ? '#f4f0e4' : '#1b1b1b'; g2.fillRect(i * 16, 86, 16, 10); }
        g2.fillStyle = '#c8241e'; g2.font = '64px "Lilita One", Impact, sans-serif'; g2.textAlign = 'center'; g2.fillText('GRUND PRIX', 256, 72);
      });
      const bq = track.place(S.start, -(W / 2 + 2.6));
      const fb = frame(bq.x, 0, bq.z, -p.angle);
      for (const e of [-1, 1]) { fb(new T.CylinderGeometry(0.14, 0.16, 7.4, 8), 0xe8e4dc, { x: e * 5.2, y: 3.7 }, vcSatin); K.circle(bq.x + e * 5.2 * Math.cos(p.angle), bq.z + e * 5.2 * Math.sin(p.angle), 0.35, 8); }
      K.mesh(new T.PlaneGeometry(10.2, 1.9), K.std({ map: bn, roughness: 0.8, side: T.DoubleSide }), bq.x, 6.3, bq.z, { ry: -p.angle, cast: true });
      block(bq.x, bq.z, 6, 1.2, p.angle);
    }

    // ---------------------------------------------------------------- the Alzette: stone channel, resin water, weir, ford
    {
      // frames along the river, clipped exactly at the board edges
      const fr = [];
      const inB = (q) => q[0] <= BOUNDS.maxX && q[1] <= BOUNDS.maxZ;
      for (let i = 0; i <= RNP; i++) {
        const q = rivP[i], f = { x: q[0], z: q[1], nx: -rivT[i][1], nz: rivT[i][0], y: 0, d: i * rStep };
        if (i > 0 && inB(q) !== inB(rivP[i - 1])) { // add the crossing point
          const pq = rivP[i - 1], t = q[0] > BOUNDS.maxX || pq[0] > BOUNDS.maxX ? (BOUNDS.maxX - pq[0]) / (q[0] - pq[0]) : (BOUNDS.maxZ - pq[1]) / (q[1] - pq[1]);
          fr.push({ ...f, x: lerp(pq[0], q[0], t), z: lerp(pq[1], q[1], t), d: (i - 1 + t) * rStep });
        }
        if (inB(q)) fr.push(f);
      }
      // bed + walls + coping, one cross-section swept along the river
      const pos = [], uv = [], cl = [], idx = [];
      const prof = (d) => {
        const hw = rivHW(d), b = rivBed(d), top = d < dWeir ? 0.55 : 0.35;
        return [[-hw - 1.9, 0, 1.05], [-hw - 1.9, top, 1.1], [-hw - 0.15, top, 1.15], [-hw, top - 0.1, 1.0], [-hw, b, 0.7], [-hw * 0.5, b - 0.25, 0.55], [hw * 0.5, b - 0.25, 0.55], [hw, b, 0.7], [hw, top - 0.1, 1.0], [hw + 0.15, top, 1.15], [hw + 1.9, top, 1.1], [hw + 1.9, 0, 1.05]];
      };
      const NP = 12;
      fr.forEach((f) => {
        prof(f.d).forEach(([o, y, c], k) => { pos.push(f.x + f.nx * o, y, f.z + f.nz * o); uv.push(f.d / 4, (k * 1.3 + y) / 2); cl.push(c, c * 0.98, c * 0.94); });
      });
      for (let i = 0; i < fr.length - 1; i++) for (let k = 0; k < NP - 1; k++) { const a = i * NP + k, b = a + 1, c2 = a + NP, d = c2 + 1; idx.push(a, b, c2, b, d, c2); }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new T.Float32BufferAttribute(cl, 3));
      g.setIndex(idx); g.computeVertexNormals();
      // the coping must not stick up through the road where it crosses (bridges, the ford)
      const pa = g.attributes.position;
      for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), z = pa.getZ(i); if (pa.getY(i) > 0 && roadD(x, z) < 0.9) pa.setY(i, -0.05); }
      g.computeVertexNormals();
      const cm = new T.Mesh(g, stoneMat); cm.receiveShadow = true; cm.castShadow = false; keep.push(cm); K.group.add(cm);
      // water: resin with a moving ripple normal map
      const wn = (() => {
        const Sz = 256, h = new Float32Array(Sz * Sz);
        const nA = TX.noiseField(256, { seed: 81, period: 10, oct: 3 });
        for (let y = 0; y < Sz; y++) for (let x = 0; x < Sz; x++) h[y * Sz + x] = TX.sampleField(nA, 256, x, y) + 0.12 * Math.sin((x * 0.4 + y) * 0.32);
        return TX.toTexture(TX.normalFromHeight(h, Sz, Sz, 2.4), { srgb: false });
      })();
      const resin = K.phys({ color: 0x31584a, roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, normalMap: wn, normalScale: V2(0.3), transparent: true, opacity: 0.86, envMapIntensity: 1.3 });
      A.water = wn;
      const wp = [], wu = [], wi = [];
      fr.forEach((f) => { const hw = rivHW(f.d) + 0.02, y = rivWL(f.d); for (const e of [-1, 1]) { wp.push(f.x + f.nx * hw * e, y, f.z + f.nz * hw * e); wu.push((e * hw) / 10 + 0.5, f.d / 10); } });
      for (let i = 0; i < fr.length - 1; i++) { const a = i * 2; wi.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      const wg = new T.BufferGeometry();
      wg.setAttribute('position', new T.Float32BufferAttribute(wp, 3)); wg.setAttribute('uv', new T.Float32BufferAttribute(wu, 2));
      wg.setIndex(wi); wg.computeVertexNormals();
      const wnr = wg.attributes.normal; for (let i = 0; i < wnr.count; i++) if (wnr.getY(i) < 0) wnr.setXYZ(i, -wnr.getX(i), -wnr.getY(i), -wnr.getZ(i));
      const wm = new T.Mesh(wg, resin); wm.receiveShadow = true; wm.renderOrder = 1; keep.push(wm); K.group.add(wm);
      // colliders: quay walls on both banks (bridges and the ford have their own)
      for (const e of [-1, 1]) {
        for (let i = 0; i < fr.length - 3; i += 3) {
          const a = fr[i], b = fr[i + 3], ha = rivHW(a.d) + 0.9, hb = rivHW(b.d) + 0.9;
          const ax = a.x + a.nx * ha * e, az = a.z + a.nz * ha * e, bx = b.x + b.nx * hb * e, bz = b.z + b.nz * hb * e;
          if (roadD(ax, az) < 1.2 || roadD(bx, bz) < 1.2) continue;
          if (ax < BOUNDS.minX - 2 || ax > BOUNDS.maxX + 2 || az > BOUNDS.maxZ + 2) continue;
          K.capsule(ax, az, bx, bz, 0.9, 3);
        }
      }
      // a car that somehow gets into the channel drops in
      for (let i = 0; i < fr.length; i += 4) { const f = fr[i]; if (roadD(f.x, f.z) > 6 && f.x < BOUNDS.maxX && f.z < BOUNDS.maxZ) K.hole(f.x, f.z, rivHW(f.d) - 1); }
      A.rivFrames = fr;
    }

    // ---------------------------------------------------------------- bridges: low stone arches, parapets
    for (const sb of [S.br1, S.br2, S.br3]) {
      const p = track.at(sb);
      const half = 10.5; // along the road: parapets from sb - half to sb + half
      for (const side of [-1, 1]) {
        parapet(sb - half, sb + half, side, { off: 0.9, top: 1.1, th: 0.9 });
        // end pillars
        for (const e of [-1, 1]) {
          const q = track.place(sb + e * (half + 0.4), side * (W / 2 + 1.35));
          prop(new T.BoxGeometry(1.5, 1.9, 1.5), 0xe8e0d0, { x: q.x, y: 0.75, z: q.z, ry: -q.angle }, stoneMat);
          prop(new T.BoxGeometry(1.8, 0.3, 1.8), 0xf4eee4, { x: q.x, y: 1.8, z: q.z, ry: -q.angle }, stoneMat);
          K.circle(q.x, q.z, 0.95, 3);
        }
      }
      // arch faces under the deck on both sides: a segmental arch over the water
      const ri = rivA(p.x, p.z), hw = rivHW(ri), b = rivBed(ri);
      const span = hw * 2 + 0.6, rise = Math.max(1.2, -b - 0.9);
      const R = (span * span / 4 + rise * rise) / (2 * rise), cyy = -0.7 - R;
      const shape = new T.Shape();
      shape.moveTo(-span / 2 - 3, b - 0.4); shape.lineTo(span / 2 + 3, b - 0.4); shape.lineTo(span / 2 + 3, -0.02); shape.lineTo(-span / 2 - 3, -0.02); shape.closePath();
      const hole = new T.Path();
      const a0 = Math.asin(span / 2 / R);
      hole.moveTo(-span / 2, b - 0.5); hole.lineTo(span / 2, b - 0.5);
      hole.absarc(0, cyy, R, PI / 2 - a0, PI / 2 + a0, false);
      hole.lineTo(-span / 2, b - 0.5);
      shape.holes.push(hole);
      const eg = new T.ExtrudeGeometry(shape, { depth: W + 2.2, bevelEnabled: false, curveSegments: 10 });
      eg.translate(0, 0, -(W + 2.2) / 2);
      const uvA = eg.attributes.uv; for (let i = 0; i < uvA.count; i++) uvA.setXY(i, uvA.getX(i) / 4, uvA.getY(i) / 2);
      colorize(eg, 0xece4d4);
      // orient: the arch spans across the river (local x along the river), deck along the road (local z)
      xf(eg, { x: p.x, y: 0, z: p.z, ry: -p.angle });
      bake(eg, stoneMat, p.x, p.z);
    }

    // ---------------------------------------------------------------- the ford: water over the setts, marker posts
    {
      const sf = S.ford;
      const ri = rivA(track.at(sf).x, track.at(sf).z), hw = rivHW(ri);
      const span = hw + 2.2;
      // water surface on the road (slows you, splashes)
      const poly = [];
      for (const [e, o] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const q = track.place(sf + e * span, o * (W / 2 + 0.6)); poly.push([q.x, q.z]); }
      K.surface('water', { poly: [poly[0], poly[1], poly[2], poly[3]] });
      // posts along both edges of the causeway (white-banded depth markers)
      for (const side of [-1, 1]) for (let k = -span; k <= span + 0.01; k += 2.6) {
        const q = track.place(sf + k, side * (W / 2 + 1.1));
        prop(new T.CylinderGeometry(0.32, 0.36, 2.6, 8), 0xf2efe8, { x: q.x, y: 0.6, z: q.z }, vcSatin);
        prop(new T.CylinderGeometry(0.34, 0.34, 0.5, 8), 0xc8241e, { x: q.x, y: 1.3, z: q.z }, vcSatin);
        K.circle(q.x, q.z, 0.55, 3);
      }
      A.ford = { s: sf };
    }

    // ---------------------------------------------------------------- climb: ramps, the landing bastion, the Wenzel wall, the plateau walls
    {
      // parapet along the outside of the whole climb (left side: west of ramp 1, round the landing, east of ramp 2)
      parapet(S.r1a + 1, S.r2b + 1, -1, { off: 1.1, top: 1.2, th: 1.0, h: 3 });
      // ramp 3: both sides
      for (const side of [-1, 1]) parapet(S.r3a - 1, S.r3b, side, { off: 1.1, top: 1.2, th: 1.0, h: 3 });
      // ramp embankments: side faces from the ground up to the ramp surface
      const embank = (s0, s1, side, off) => {
        const fr = roadFrames(s0, s1, side, off, 0.75);
        const g = sweep(fr.map((f) => ({ ...f, y: 0 })), [[0, -0.3, 0.8], [0, 1, 0.95]], { uS: 4, vS: 2 });
        const pa = g.attributes.position;
        for (let i = 0; i < pa.count; i += 2) { const f = fr[i / 2]; pa.setY(i + 1, f.y); }
        g.computeVertexNormals();
        bake(g, stoneMat, fr[0].x, fr[0].z);
      };
      embank(S.r1a, S.r1b, -1, 2.0); embank(S.r2a, S.r2b, -1, 2.0);
      embank(S.r3a, S.r3b, -1, 2.0); embank(S.r3a, S.r3b, 1, 2.0);
      // ramp tops beside the road (between the road and the parapets / walls): plain setts
      const deckMat = K.std({ map: cobble.map, normalMap: cobble.normalMap, normalScale: V2(0.6), roughness: 0.85, color: 0xb8b0a4 });
      const deck = (s0, s1, o0, o1) => {
        const pos = [], uvv = [], idx = [], n = Math.ceil(Math.abs(s1 - s0) / 0.75);
        for (let i = 0; i <= n; i++) {
          const s = s0 + ((s1 - s0) * i) / n, p = track.at(s), y = roadG[track.idx(s)] + 0.03;
          for (const o of [o0, o1]) { pos.push(p.x + p.nx * o, y, p.z + p.nz * o); uvv.push(0.03 + (o - o0) / W * 0.1, s / W); }
        }
        for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uvv, 2));
        g.setIndex(idx); g.computeVertexNormals();
        const nr = g.attributes.normal; for (let i = 0; i < nr.count; i++) if (nr.getY(i) < 0) nr.setXYZ(i, -nr.getX(i), -nr.getY(i), -nr.getZ(i));
        const m = new T.Mesh(g, deckMat); m.receiveShadow = true; keep.push(m); K.group.add(m);
      };
      deck(S.r1a, S.r2b, -W / 2 - 2.1, -W / 2 + 0.1); deck(S.r1a, S.r2b, W / 2 - 0.1, W / 2 + 3.2);
      deck(S.r3a, S.r3b, -W / 2 - 2.1, -W / 2 + 0.1); deck(S.r3a, S.r3b, W / 2 - 0.1, W / 2 + 2.1);
      // the landing: a round bastion under the hairpin (half cylinder of masonry), arcade niches
      {
        const R = HP.r + W / 2 + 2.1;
        const g = new T.CylinderGeometry(R, R + 0.3, LD.h + 0.3, 40, 1, true, PI, PI);
        const uvA = g.attributes.uv, pa = g.attributes.position;
        for (let i = 0; i < uvA.count; i++) uvA.setXY(i, (Math.atan2(pa.getZ(i), pa.getX(i)) * R) / 4, (pa.getY(i) + LD.h / 2) / 2);
        colorize(g, 0xe6ddcc);
        xf(g, { x: HP.x, y: (LD.h - 0.3) / 2, z: HP.z, ry: -PI / 2 });
        bake(g, stoneMat, HP.x, HP.z);
        const top = new T.CircleGeometry(R, 40, 0, PI); top.rotateX(-PI / 2);
        colorize(top, 0x9a9488); xf(top, { x: HP.x, y: LD.h - 0.02, z: HP.z });
        bake(top, stoneMat, HP.x, HP.z, false);
      }
      // the Wenzel wall: from the hairpin tower south between the ramps, then the plateau's west face
      {
        const wx = (WZ.x0 + WZ.x1) / 2, len = WZ.z1 - WZ.z0, wzc = (WZ.z0 + WZ.z1) / 2;
        K.box(wx, wzc, (WZ.x1 - WZ.x0) / 2, len / 2, 0, 16);
        K.circle(HP.x, HP.z + 0.6, 3.6, 18);
        const wallTop = (z) => (z < PL.z0 ? lerp(LD.h + 5.2, PL.h + 3.4, ss(HP.z, PL.z0, z)) : PL.h + 2.2);
        const fr = [];
        for (let z = WZ.z0; z <= WZ.z1 + 0.01; z += 1) fr.push({ x: wx, z, nx: 1, nz: 0, y: 0 });
        const g = sweep(fr, [[-1.9, -0.3, 0.85], [-1.9, 1, 1], [1.9, 1, 1], [1.9, -0.3, 0.85]], { uS: 4, vS: 2 });
        const pa = g.attributes.position;
        for (let i = 0; i < pa.count; i++) if (pa.getY(i) > 0) pa.setY(i, wallTop(pa.getZ(i)));
        g.computeVertexNormals();
        bake(g, stoneMat, wx, wzc);
        // a parapet with merlons along both edges of the wall walk
        for (const e of [-1, 1]) {
          const pf = fr.map((f) => ({ ...f, x: wx + e * 1.55, y: wallTop(f.z) }));
          bake(sweep(pf, [[-0.35, -0.05, 0.9], [-0.35, 0.5, 1.0], [0.35, 0.5, 1.05], [0.35, -0.05, 0.95]], { uS: 4, vS: 2, col: 0.95 }), stoneMat, wx, wzc);
          for (let z = WZ.z0 + 2.4; z < WZ.z1 - 1; z += 2.1) prop(new T.BoxGeometry(0.7, 0.8, 1.0), 0xece4d2, { x: wx + e * 1.55, y: wallTop(z) + 0.85, z }, stoneMat);
        }
        // round towers with slate cones: the hairpin tower and two along the wall
        for (const [tz, tr, th] of [[HP.z + 0.6, 3.4, 17], [PL.z0 - 2, 3.0, 15], [PL.z0 + 33, 3.2, 14]]) {
          prop(new T.CylinderGeometry(tr, tr + 0.4, th, 24), 0xe4dac6, { x: wx, y: th / 2 - 0.3, z: tz }, stoneMat);
          prop(new T.CylinderGeometry(tr + 0.35, tr + 0.35, 0.6, 24), 0xf0e8d8, { x: wx, y: th - 0.2, z: tz }, stoneMat);
          prop(slateCone(tr + 0.6, tr * 1.5, 24), 0x5a606a, { x: wx, y: th + tr * 0.75, z: tz }, roofMat);
          for (let k = 0; k < 4; k++) { const a = k * PI / 2 + 0.4; prop(new T.BoxGeometry(0.5, 1.1, 0.4), 0x1e1a16, { x: wx + Math.cos(a) * (tr + 0.12), y: th * 0.6, z: tz + Math.sin(a) * (tr + 0.12), ry: -a + PI / 2 }); }
          if (tz > PL.z0) K.circle(wx, tz, tr, th);
        }
      }
      // the plateau's north face (retaining wall) between and beside the ramps, with a parapet on top
      for (const [x0, x1] of [[RAMP2.x + RAMP2.wid / 2, RAMP3.x - RAMP3.wid / 2], [RAMP3.x + RAMP3.wid / 2, PL.x1 - 2]]) {
        const cx = (x0 + x1) / 2;
        prop(new T.BoxGeometry(x1 - x0, PL.h + 0.2, 1.6), 0xe0d6c2, { x: cx, y: PL.h / 2 - 0.1, z: PL.z0 + 0.8 }, stoneMat);
        prop(new T.BoxGeometry(x1 - x0, 1.2, 0.9), 0xece4d4, { x: cx, y: PL.h + 0.6, z: PL.z0 + 0.6 }, stoneMat);
        K.box(cx, PL.z0 + 0.6, (x1 - x0) / 2, 0.6, 0, PL.h + 3);
      }
      // a fortification parapet along the plateau's south side
      prop(new T.BoxGeometry(PL.x1 - PL.x0 - 4, 1.4, 1.2), 0xe6dccb, { x: (PL.x0 + PL.x1) / 2, y: PL.h + 0.7, z: 96.2 }, stoneMat);
      K.box((PL.x0 + PL.x1) / 2, 96.2, (PL.x1 - PL.x0) / 2, 0.8, 0, PL.h + 3);
      // and along its east edge, where the plateau meets the wooded knoll (no dropping off into the hill)
      prop(new T.BoxGeometry(1.2, 1.4, PL.z1 - PL.z0 - 4.5), 0xe6dccb, { x: PL.x1 - 0.9, y: PL.h + 0.7, z: (PL.z0 + PL.z1) / 2 - 1.6 }, stoneMat);
      K.box(PL.x1 - 0.9, (PL.z0 + PL.z1) / 2, 0.8, (PL.z1 - PL.z0) / 2, 0, PL.h + 3);
    }

    // ---------------------------------------------------------------- terrain rising beside the road stops cars (rock faces, the knoll)
    for (let s = 0; s < L; s += 2.5) {
      if (inS(s, S.r1a - 2, S.r2b + 2) || inS(s, S.r3a - 2, S.r3b + 2)) continue;
      const p = track.at(s), g0 = roadG[track.idx(s)];
      for (const side of [-1, 1]) {
        for (let o = p.w / 2 + 0.8; o < p.w / 2 + 17; o += 0.8) {
          const x = p.x + p.nx * o * side, z = p.z + p.nz * o * side;
          const hh = gy(x, z) - g0;
          if (hh > 2.0 && (rockAt(x, z) > 0.3 || hh > 3.4)) { K.circle(x + p.nx * side * 0.9, z + p.nz * side * 0.9, 1.5, g0 + Math.max(4, hh)); break; }
          if (inRiver(x, z, 1)) break;
        }
      }
    }

    // ---------------------------------------------------------------- the railway viaduct over Clausen, its tunnels and the railcar
    {
      const rc = new T.CatmullRomCurve3(RAIL.map(([x, z]) => new T.Vector3(x, 0, z)), false, 'centripetal');
      const RLn = rc.getLength(), NRs = Math.ceil(RLn / 0.5), rsd = RLn / NRs;
      const rp = rc.getSpacedPoints(NRs).map((v) => [v.x, v.z]);
      const railAt = (d) => {
        const f = clamp(d / rsd, 0, NRs - 0.001), i = f | 0, t = f - i, a = rp[i], b = rp[i + 1];
        const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        return { x: lerp(a[0], b[0], t), z: lerp(a[1], b[1], t), tx: (b[0] - a[0]) / l, tz: (b[1] - a[1]) / l };
      };
      A.railAt = railAt;
      // where the deck leaves the cliff and enters the knoll
      let dA = 0, dB = RLn;
      for (let d = 0; d < RLn; d += 0.5) { const q = railAt(d); if (gy(q.x, q.z) < VIA_H - 3) { dA = d; break; } }
      for (let d = RLn; d > 0; d -= 0.5) { const q = railAt(d); if (gy(q.x, q.z) < VIA_H - 3) { dB = d; break; } }
      dA -= 1.5; dB += 1.5;
      // piers: about every 19 units, never near the road (the road threads through the arches)
      const PT = 3.2, VW = 5.8;
      const good = (d) => { const q = railAt(d); return roadD(q.x, q.z) > PT / 2 + 2.6 && roadD(q.x + q.tz * VW / 2, q.z - q.tx * VW / 2) > 2.4 && roadD(q.x - q.tz * VW / 2, q.z + q.tx * VW / 2) > 2.4; };
      const piers = [dA];
      for (let d = dA; d < dB - 14;) {
        let best = null;
        for (let k = 0; k <= 32; k++) { const c = d + 19 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.5; if (c > d + 9 && c < d + 27 && good(c)) { best = c; break; } }
        if (best === null || best > dB - 7) break;
        piers.push(best); d = best;
      }
      piers.push(dB);
      // bays: a stone wall with one arched opening each, between consecutive pier centres
      const deckBot = VIA_H - 0.9;
      for (let i = 0; i < piers.length - 1; i++) {
        const a = railAt(piers[i]), b = railAt(piers[i + 1]);
        const Lc = Math.hypot(b.x - a.x, b.z - a.z);
        let yb = 0;
        for (let k = 0; k <= 8; k++) { const x = lerp(a.x, b.x, k / 8), z = lerp(a.z, b.z, k / 8); yb = Math.min(yb, inRiver(x, z, 0.5) ? rivBed(rivA(x, z)) : gy(x, z)); }
        yb -= 1.2;
        const sh = new T.Shape();
        sh.moveTo(0, yb); sh.lineTo(Lc, yb); sh.lineTo(Lc, deckBot); sh.lineTo(0, deckBot); sh.closePath();
        const t0 = i === 0 ? PT : PT / 2, t1 = i === piers.length - 2 ? PT : PT / 2;
        const span = Lc - t0 - t1, rr = span / 2, cyy = Math.max(yb + 1, deckBot - 1.1 - rr);
        const hole = new T.Path();
        hole.moveTo(t0, yb - 1); hole.lineTo(Lc - t1, yb - 1); hole.lineTo(Lc - t1, cyy);
        hole.absarc(t0 + rr, cyy, rr, 0, PI, false);
        hole.lineTo(t0, yb - 1);
        sh.holes.push(hole);
        const eg = new T.ExtrudeGeometry(sh, { depth: VW, bevelEnabled: false, curveSegments: 14 });
        eg.translate(0, 0, -VW / 2);
        const uvA = eg.attributes.uv; for (let k = 0; k < uvA.count; k++) uvA.setXY(k, uvA.getX(k) / 4, uvA.getY(k) / 2);
        colorize(eg, 0xe8dcc4);
        xf(eg, { x: a.x, z: a.z, ry: -Math.atan2(b.z - a.z, b.x - a.x) });
        bake(eg, stoneMat, (a.x + b.x) / 2, (a.z + b.z) / 2);
        // pilaster strips on the pier faces and cutwaters in the river
        if (i > 0) {
          const ang = Math.atan2(a.tz, a.tx);
          prop(new T.BoxGeometry(PT + 0.5, 0.45, VW + 0.6), 0xf2e8d6, { x: a.x, y: cyy + 0.1, z: a.z, ry: -ang }, stoneMat);
          if (inRiver(a.x, a.z, 1)) for (const e of [-1, 1]) prop(new T.CylinderGeometry(1.4, 1.6, 4.5, 4), 0xd8ccb4, { x: a.x - a.tz * e * (VW / 2 + 0.4), y: rivBed(rivA(a.x, a.z)) + 1.6, z: a.z + a.tx * e * (VW / 2 + 0.4), ry: -ang + PI / 4 }, stoneMat);
          K.box(a.x, a.z, PT / 2, VW / 2, ang, VIA_H + 1);
          // a pier standing just off the bank: a low wall from it to the quay leaves no car-sized pocket between
          const hwR = rivHW(rivA(a.x, a.z)), rd0 = rivD(a.x, a.z);
          if (!inRiver(a.x, a.z, 1) && rd0 < hwR + 10) {
            const sg = rivD(a.x + a.tx, a.z + a.tz) < rd0 ? 1 : -1;
            let d = 0;
            while (d < 12 && rivD(a.x + a.tx * sg * d, a.z + a.tz * sg * d) > hwR + 1.0) d += 0.25;
            if (d > PT / 2 && d < 12) {
              const ex = a.x + a.tx * sg * d, ez = a.z + a.tz * sg * d;
              K.capsule(a.x, a.z, ex, ez, 1.4, 4);
              prop(new T.BoxGeometry(d, 2.2, 2.6), 0xd8ccb4, { x: (a.x + ex) / 2, y: 0.8, z: (a.z + ez) / 2, ry: -ang }, stoneMat);
            }
          }
        }
        block((a.x + b.x) / 2, (a.z + b.z) / 2, Lc / 2 + 1, VW / 2 + 1.5, Math.atan2(b.z - a.z, b.x - a.x));
      }
      // deck with cornice and parapets, ballast, sleepers and rails
      const fr = [];
      for (let d = dA - 0.5; d <= dB + 0.5; d += 0.75) { const q = railAt(d); fr.push({ x: q.x, z: q.z, nx: -q.tz, nz: q.tx, y: 0 }); }
      const H0 = VIA_H;
      bake(sweep(fr, [[-2.8, H0 - 1.5, 0.8], [-3.2, H0 - 1.0, 0.9], [-3.2, H0 - 0.55, 1.05], [-2.95, H0 - 0.5, 1.0], [-2.95, H0 + 0.75, 1.05], [-2.55, H0 + 0.75, 1.1], [-2.55, H0, 0.95],
        [2.55, H0, 0.95], [2.55, H0 + 0.75, 1.1], [2.95, H0 + 0.75, 1.05], [2.95, H0 - 0.5, 1.0], [3.2, H0 - 0.55, 1.05], [3.2, H0 - 1.0, 0.9], [2.8, H0 - 1.5, 0.8]]), stoneMat, 104, -20);
      bake(sweep(fr, [[-1.9, H0 + 0.02, 0.35], [-1.5, H0 + 0.32, 0.42], [1.5, H0 + 0.32, 0.42], [1.9, H0 + 0.02, 0.35]], { col: 1 }), vc, 104, -20, false);
      const sl = [];
      for (let d = dA - 0.5; d < dB + 0.5; d += 0.62) { const q = railAt(d); sl.push({ x: q.x, y: H0 + 0.4, z: q.z, ry: -Math.atan2(q.tz, q.tx) + PI / 2, color: new T.Color(0x4a3a2c).multiplyScalar(0.8 + r() * 0.35).getHex() }); }
      K.instances(new T.BoxGeometry(2.5, 0.14, 0.26), K.std({ color: 0xffffff, roughness: 0.9 }), sl, { colors: true, cast: false });
      for (const e of [-0.72, 0.72]) bake(sweep(fr, [[e - 0.07, H0 + 0.47, 0.6], [e - 0.07, H0 + 0.63, 1], [e + 0.07, H0 + 0.63, 1], [e + 0.07, H0 + 0.47, 0.6]], { col: 0.85 }), vcMetal, 104, -20, false);
      // tunnel portals: masonry faces with a dark arched mouth
      for (const [d, out] of [[dA, -1], [dB, 1]]) {
        const q = railAt(d), ang = Math.atan2(q.tz, q.tx);
        const sh = new T.Shape();
        sh.moveTo(-6.5, -2); sh.lineTo(6.5, -2); sh.lineTo(6.5, 9.5); sh.lineTo(-6.5, 9.5); sh.closePath();
        const hole = new T.Path(); hole.moveTo(-2.6, -1.5); hole.lineTo(2.6, -1.5); hole.lineTo(2.6, 3.2); hole.absarc(0, 3.2, 2.6, 0, PI, false); hole.lineTo(-2.6, -1.5);
        sh.holes.push(hole);
        const eg = new T.ExtrudeGeometry(sh, { depth: 1.6, bevelEnabled: false, curveSegments: 12 });
        eg.translate(0, 0, -0.8);
        const uvA = eg.attributes.uv; for (let k = 0; k < uvA.count; k++) uvA.setXY(k, uvA.getX(k) / 4, uvA.getY(k) / 2);
        colorize(eg, 0xe2d6be);
        xf(eg, { x: q.x, y: H0, z: q.z, ry: -ang + PI / 2 });
        bake(eg, stoneMat, q.x, q.z);
        const back = new T.PlaneGeometry(5.4, 6); colorize(back, 0x0c0a08);
        xf(back, { x: q.x - q.tx * out * 1.2, y: H0 + 3, z: q.z - q.tz * out * 1.2, ry: -ang + PI / 2 });
        bake(back, vc, q.x, q.z, false);
      }
      // the railcar: two red-and-cream units (vertex-coloured, one group per car)
      const carMat = K.phys({ vertexColors: true, roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.25 });
      A.railcars = RCAR.lens.map((len, i) => {
        const P = [];
        const add = (g, c, o) => P.push(colorize(xf(g, o), c));
        add(new K.RoundedBoxGeometry(len, 1.5, 2.5, 2, 0.3), 0xb8261e, { y: 1.35 });
        add(new K.RoundedBoxGeometry(len, 1.25, 2.5, 2, 0.25), 0xf0e6cc, { y: 2.65 });
        add(new K.RoundedBoxGeometry(len - 0.3, 0.5, 2.3, 2, 0.22), 0x6e6e72, { y: 3.4 });
        for (let k = 0; k < 6; k++) for (const e of [-1, 1]) add(new T.PlaneGeometry(1.2, 0.8), 0x1c2630, { x: -len / 2 + 1.6 + k * (len - 3.2) / 5, y: 2.65, z: e * 1.27, ry: e > 0 ? 0 : PI });
        const cab = i === 0 ? -1 : 1;
        add(new T.PlaneGeometry(1.9, 0.75), 0x1c2630, { x: cab * (len / 2 + 0.01), y: 2.75, ry: cab * PI / 2 });
        add(new T.CircleGeometry(0.16, 10), 0xfff4c8, { x: cab * (len / 2 + 0.02), y: 1.0, z: 0.75, ry: cab * PI / 2 });
        add(new T.CircleGeometry(0.16, 10), 0xfff4c8, { x: cab * (len / 2 + 0.02), y: 1.0, z: -0.75, ry: cab * PI / 2 });
        for (const e of [-1, 1]) add(new T.BoxGeometry(2.4, 0.7, 2.0), 0x26262a, { x: e * (len / 2 - 2), y: 0.45 });
        const m = new T.Mesh(merge(P), carMat); m.castShadow = true; m.receiveShadow = true;
        K.group.add(m); keep.push(m);
        return m;
      });
      const TLr = RCAR.lens.reduce((a, b) => a + b, 0) + RCAR.gap;
      const a0 = dA - TLr / 2 - 4, D = dB + TLr / 2 + 4 - a0;
      const ta = RCAR.V / RCAR.acc, da = RCAR.V * RCAR.V / (2 * RCAR.acc), tr = 2 * ta + (D - 2 * da) / RCAR.V;
      A.rc = { t0: 3, a: a0, D, ta, da, tr, P: 2 * (RCAR.dwell + tr), dA, dB, TL: TLr };
      A.railShadow = RCAR.lens.map((l) => { const m = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.35, alphaMap: TX.blobShadowTexture(), depthWrite: false })); m.rotation.x = -PI / 2; m.scale.set(l + 1, 3.6, 1); m.renderOrder = 1; K.group.add(m); keep.push(m); return m; });
    }

    // ---------------------------------------------------------------- the Bock: the castle bridge over the cutting, casemates in the rock
    {
      const p = track.at(S.bock), ang = p.angle;
      // the bridge: a stone arch across the road (its own material so it can turn see-through over a car)
      const span = W + 2.4, rr = span / 2, deck = rr + 3.0, len = 24, wid = 5.2;
      const sh = new T.Shape();
      sh.moveTo(-len / 2, -0.5); sh.lineTo(len / 2, -0.5); sh.lineTo(len / 2, deck); sh.lineTo(-len / 2, deck); sh.closePath();
      const hole = new T.Path(); hole.moveTo(-rr, -1); hole.lineTo(rr, -1); hole.lineTo(rr, 0.6); hole.absarc(0, 0.6, rr, 0, PI, false); hole.lineTo(-rr, -1);
      sh.holes.push(hole);
      const eg = new T.ExtrudeGeometry(sh, { depth: wid, bevelEnabled: false, curveSegments: 18 });
      eg.translate(0, 0, -wid / 2);
      const uvA = eg.attributes.uv; for (let k = 0; k < uvA.count; k++) uvA.setXY(k, uvA.getX(k) / 4, uvA.getY(k) / 2);
      const parts = [colorize(eg, 0xe0d2b8)];
      // parapets and a lantern on the bridge
      for (const e of [-1, 1]) {
        parts.push(colorize(xf(new T.BoxGeometry(len, 1.25, 0.6), { y: deck + 0.62, z: e * (wid / 2 - 0.3) }), 0xf4ecdc));
        parts.push(colorize(xf(new T.BoxGeometry(len + 0.3, 0.22, 0.8), { y: deck + 1.33, z: e * (wid / 2 - 0.3) }), 0xfaf4e8));
        parts.push(colorize(xf(new T.BoxGeometry(len + 0.2, 0.35, 0.3), { y: deck - 0.35, z: e * (wid / 2 + 0.1) }), 0xf0e6d2)); // string course
      }
      let bg = merge(parts);
      xf(bg, { x: p.x, z: p.z, ry: -ang + PI / 2 });
      bg = boxUV(bg, 4, 2, 0);
      const bMat = K.std({ map: ashlar, vertexColors: true, roughness: 0.88, transparent: true, opacity: 1 });
      const bm = new T.Mesh(bg, bMat); bm.castShadow = true; bm.receiveShadow = true; K.group.add(bm); keep.push(bm);
      // the cobbled path over the top and two lanterns
      const tMat = K.std({ map: cobble.map, normalMap: cobble.normalMap, roughness: 0.85, color: 0x9c948a, transparent: true, opacity: 1 });
      const tg = new T.PlaneGeometry(len, wid - 1.0); tg.rotateX(-PI / 2);
      const tuv = tg.attributes.uv; for (let k = 0; k < tuv.count; k++) { const u0 = tuv.getX(k), v0 = tuv.getY(k); tuv.setXY(k, 0.3 + v0 * 0.4, u0 * len / 13); }
      xf(tg, { y: deck + 0.02 }); xf(tg, { x: p.x, z: p.z, ry: -ang + PI / 2 });
      const tm = new T.Mesh(tg, tMat); tm.receiveShadow = true; bm.add(tm); tm.position.set(0, 0, 0);
      bm.remove(tm); K.group.add(tm); keep.push(tm);
      const lan = [];
      for (const e of [-1, 1]) { const [lx, lz] = local(p.x, p.z, ang - PI / 2, e * (rr + 1.2), 0); lan.push([lx, lz]); }
      A.bockBridge = { mat: bMat, mat2: tMat, mesh: bm, s: S.bock, lan };
      block(p.x, p.z, len / 2 + 2.5, wid / 2 + 2.5, ang + PI / 2);
      for (const [lx, lz] of lan) {
        const fl = frame(lx, deck, lz, 0);
        fl(new T.CylinderGeometry(0.1, 0.14, 2.6, 8), 0x23332c, { y: 1.3 }, vcSatin);
        fl(new T.CylinderGeometry(0.34, 0.24, 0.6, 6), 0xfff0c8, { y: 2.85 }, glowMat, false);
        fl(new T.ConeGeometry(0.42, 0.4, 6), 0x23332c, { y: 3.35 }, vcSatin);
      }
      // casemate windows: small dark arches in the south-facing rock faces of the Bock and the cliffs
      const cc = TX.makeCanvas(64, 96), cg = cc.getContext('2d');
      cg.fillStyle = 'rgba(0,0,0,0)'; cg.fillRect(0, 0, 64, 96);
      cg.fillStyle = '#c8b894'; cg.beginPath(); cg.moveTo(4, 96); cg.lineTo(4, 34); cg.arc(32, 34, 28, PI, 0); cg.lineTo(60, 96); cg.closePath(); cg.fill();
      cg.fillStyle = '#16120e'; cg.beginPath(); cg.moveTo(14, 90); cg.lineTo(14, 36); cg.arc(32, 36, 18, PI, 0); cg.lineTo(50, 90); cg.closePath(); cg.fill();
      const cmat = K.std({ map: TX.toTexture(cc, { wrap: false }), transparent: true, alphaTest: 0.5, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
      // rows of embrasures at gallery levels in the south faces of the Bock and its spur (the casemates)
      const wins = [];
      const winAt = (x, z0, z1, Y) => {
        for (let z = z0; z > z1; z -= 0.25) {
          const h = gy(x, z);
          if (h < Y) continue;
          const e = 0.6, hx = (gy(x + e, z) - gy(x - e, z)) / (2 * e), hz = (gy(x, z + e) - gy(x, z - e)) / (2 * e);
          const sl = Math.hypot(hx, hz);
          if (sl < 1.3 || hz > -0.8 || roadD(x, z) < 1) return;
          const nxw = -hx / sl, nzw = -hz / sl;
          wins.push({ x: x + nxw * 0.3, y: h + 0.1, z: z + nzw * 0.3, ry: Math.atan2(nxw, nzw), rx: -(PI / 2 - Math.atan(sl)) * 0.8, s: r.range(0.95, 1.15) });
          return;
        }
      };
      for (const [Y, x0, x1, z0, z1, step] of [[6, -46, 16, -66, -104, 2.7], [11, -46, 16, -66, -104, 2.7], [15.5, -46, 16, -66, -104, 3.2], [2.6, -36, 13, -48.5, -56, 2.5]]) {
        for (let x = x0; x < x1; x += step) if (r() < 0.8) winAt(x + r.range(-0.2, 0.2), z0, z1, Y);
      }
      K.instances(new T.PlaneGeometry(1.1, 1.6), cmat, wins, { cast: false });
      // the spur south of the cutting is solid rock (the terrain is only a picture): fill its footprint so nobody
      // can slip in at its low ends and get trapped between the rock and the quay wall
      for (let z = -48.4; z >= -57; z -= 1.9) {
        let x0 = null;
        for (let x = -42; x <= 18.01; x += 0.5) {
          const solid = x < 18 && gy(x, z) > 1.2 && roadD(x, z) > 1.4 && !inRiver(x, z, 1.2);
          if (solid && x0 === null) x0 = x;
          if (!solid && x0 !== null) { if (x - x0 > 1.2) K.capsule(x0 + 0.5, z, x - 0.5, z, 1.2, 7); x0 = null; }
        }
      }
      // ruined castle walls and a tower stump on top of the Bock
      for (const [x, z, w, d, rot] of [[-30, -84, 10, 1.4, 0.2], [-14, -80, 12, 1.4, -0.1], [-2, -88, 1.4, 9, 0.1], [-22, -95, 8, 1.4, 0]]) {
        const y = gy(x, z);
        prop(new T.BoxGeometry(w, 2.6 + r() * 1.6, d), 0xd8ccb2, { x, y: y + 1, z, ry: rot }, stoneMat);
      }
      prop(new T.CylinderGeometry(2.6, 2.9, 5, 18), 0xd4c6aa, { x: -8, y: gy(-8, -92) + 2, z: -92 }, stoneMat);
    }

    // ---------------------------------------------------------------- the tourist road-train (out of the east gate, along the Rives, in at the west gate)
    {
      const pts = [];
      const lane = 3.6;
      // the road runs westwards: s grows from the east end to the west end. The east gate stands well west of the
      // bend out of the ford, so drivers running wide out of it are back in the left lane before they meet the train
      const GXE = 76, sOn = sAt(GXE - 4, -63), sOff = S.rivesB - 2;
      const pOn = track.place(sOn, lane), pOff = track.place(sOff, lane);
      pts.push([96, -98], [86, -95.6], [78.2, -91.5], [GXE, -85.5], [GXE, -80], [pOn.x + 4, pOn.z - 4]);
      for (let s = sOn; s <= sOff; s += 8) { const q = track.place(s, lane); pts.push([q.x, q.z]); }
      pts.push([pOff.x - 4, pOff.z - 3.5], [pOff.x - 6, pOff.z - 12], [pOff.x - 6.5, -86], [pOff.x - 4, -95], [pOff.x + 20, -99.5], [60, -100.5], [85, -100]);
      const rt = new Track(pts, { width: 4, spacing: 0.5 });
      const TLt = RTRAIN.lens.reduce((a, b) => a + b, 0) + RTRAIN.gap * (RTRAIN.lens.length - 1);
      const ta = RTRAIN.V / RTRAIN.acc, da = RTRAIN.V * RTRAIN.V / (2 * RTRAIN.acc);
      A.rt = { path: rt, L: rt.length, t0: 0, ta, da, P: RTRAIN.dwell + ta + (rt.length - da) / RTRAIN.V, TL: TLt };
      A.rt.off = []; { let o = 0; for (const l of RTRAIN.lens) { A.rt.off.push(o); o += l + RTRAIN.gap; } }
      // the vehicles: a little locomotive-style tractor and two open carriages with canopies and passengers
      const rtMat = K.phys({ vertexColors: true, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3 });
      const people = [0xc83a2a, 0x2a5aa8, 0xe8c84a, 0x3a8a4a, 0xf2f0ea, 0x8a3a8a, 0xd87a2a];
      A.rtCars = RTRAIN.lens.map((len, i) => {
        const P = [];
        const add = (g, c, o) => P.push(colorize(xf(g, o), c));
        if (i === 0) {
          add(new K.RoundedBoxGeometry(len - 1.6, 1.1, 2.5, 2, 0.25), 0x2f6a3e, { x: -0.6, y: 1.0 });
          add(new T.CylinderGeometry(0.85, 0.85, 2.6, 16).rotateZ(PI / 2), 0x2f6a3e, { x: 0.4, y: 1.95 });
          add(new T.CylinderGeometry(0.9, 0.9, 0.12, 16).rotateZ(PI / 2), 0xd8b040, { x: 1.75, y: 1.95 });
          add(new T.CylinderGeometry(0.28, 0.36, 1.1, 12), 0x1e1e1e, { x: 1.1, y: 3.1 });
          add(new T.CylinderGeometry(0.42, 0.42, 0.18, 12), 0xd8b040, { x: 1.1, y: 3.62 });
          add(new K.RoundedBoxGeometry(1.8, 2.2, 2.5, 2, 0.2), 0x2f6a3e, { x: -1.45, y: 2.1 });
          add(new K.RoundedBoxGeometry(2.3, 0.25, 2.8, 2, 0.1), 0xc8241e, { x: -1.45, y: 3.3 });
          add(new T.PlaneGeometry(1.2, 0.8), 0x1c2630, { x: -0.54, y: 2.5, ry: PI / 2 });
          add(new T.CircleGeometry(0.22, 10), 0xfff4c8, { x: 2.07, y: 1.95, ry: PI / 2 });
          add(new T.CylinderGeometry(0.3, 0.3, 0.3, 10), 0xffb020, { x: -1.45, y: 3.58 }); // beacon base
          for (const [x, rad] of [[1.2, 0.55], [-0.4, 0.55], [-1.7, 0.75]]) for (const e of [-1, 1]) add(new T.CylinderGeometry(rad, rad, 0.4, 14).rotateX(PI / 2), 0x1c1c1c, { x, y: rad, z: e * 1.15 });
          add(new K.RoundedBoxGeometry(0.5, 0.8, 2.6, 2, 0.15), 0xc8241e, { x: 2.3, y: 0.6 });
        } else {
          add(new K.RoundedBoxGeometry(len - 0.4, 0.9, 2.5, 2, 0.2), 0xf0e6cc, { y: 0.95 });
          add(new K.RoundedBoxGeometry(len - 0.4, 0.22, 2.56, 2, 0.08), 0x2f6a3e, { y: 1.45 });
          for (const e of [-1, 1]) for (const x of [-len / 2 + 0.5, len / 2 - 0.5]) add(new T.CylinderGeometry(0.07, 0.07, 1.5, 6), 0xd8b040, { x, y: 2.2, z: e * 1.1 });
          add(new K.RoundedBoxGeometry(len - 0.2, 0.18, 2.8, 2, 0.08), 0xc8241e, { y: 3.0 });
          for (let k = 0; k < 3; k++) add(new T.BoxGeometry(0.35, 0.5, 2.1), 0x6a4a2e, { x: -len / 2 + 1.2 + k * 1.6, y: 1.55 });
          for (let k = 0; k < 4; k++) { const px = -len / 2 + 1.0 + (k % 3) * 1.6 + 0.3, pz = (k % 2 ? 0.55 : -0.55); add(new T.CylinderGeometry(0.22, 0.2, 0.75, 8), people[(i * 3 + k) % people.length], { x: px, y: 1.85, z: pz }); add(new T.SphereGeometry(0.17, 8, 6), 0xe8b896, { x: px, y: 2.4, z: pz }); }
          for (const x of [-len / 2 + 1, len / 2 - 1]) for (const e of [-1, 1]) add(new T.CylinderGeometry(0.42, 0.42, 0.35, 12).rotateX(PI / 2), 0x1c1c1c, { x, y: 0.42, z: e * 1.15 });
          add(new T.BoxGeometry(0.8, 0.12, 0.12), 0x1c1c1c, { x: len / 2 + 0.2, y: 0.5 });
        }
        const m = new T.Mesh(merge(P), rtMat); m.castShadow = true; m.receiveShadow = true;
        K.group.add(m); keep.push(m);
        return m;
      });
      // the orange beacon on the loco roof (flashes while it is out on the road)
      A.rtBeacon = new T.Mesh(new T.SphereGeometry(0.26, 12, 8), K.std({ color: 0xffa020, emissive: 0xff7a00, emissiveIntensity: 0 }));
      A.rtCars[0].add(A.rtBeacon); A.rtBeacon.position.set(-1.45, 3.85, 0);
      A.rtShadow = RTRAIN.lens.map((l) => { const m = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.4, alphaMap: TX.blobShadowTexture(), depthWrite: false })); m.rotation.x = -PI / 2; m.scale.set(l + 1.2, 3.4, 1); m.renderOrder = 1; K.group.add(m); keep.push(m); return m; });
      // one capsule per vehicle shoves cars it bumps (the hidden part of its loop is behind the houses)
      RTRAIN.lens.forEach((len, i) => {
        K.mover({ type: 'capsule', r: RTRAIN.r, h: RTRAIN.h }, (t) => {
          const hs = roadTrainHead(t) - A.rt.off[i];
          const p = rt.at(hs - 0.9), q = rt.at(hs - len + 0.9);
          return { x1: p.x, z1: p.z, x2: q.x, z2: q.z };
        });
      });
      // the two gates: archways through the row of houses (the train vanishes behind them)
      A.rtGates = [[GXE, -80], [pOff.x - 6.2, -80]];
      A.rt.gE = rt.distTo(GXE, -77).s; A.rt.gW = rt.distTo(pOff.x - 6.2, -77).s;
      // the train's loop in race-track coordinates where it runs on (or pulls out onto) the road: CPU drivers
      // read it in tick() to keep to the left lane past it, or to follow it when they are boxed in
      const mStep = 0.5, mN = Math.ceil(rt.length / mStep);
      A.rt.mStep = rt.length / mN; A.rt.mN = mN;
      A.rt.mS = new Float32Array(mN); A.rt.mLat = new Float32Array(mN); A.rt.mNear = new Uint8Array(mN);
      for (let k = 0; k < mN; k++) {
        const q = rt.at(k * A.rt.mStep), n = track.distTo(q.x, q.z);
        A.rt.mS[k] = n.s; A.rt.mLat[k] = n.lateral;
        A.rt.mNear[k] = Math.abs(n.lateral) < W / 2 + 9 && inS(n.s, S.rivesA - 25, S.rivesB + 25) ? 1 : 0;
      }
    }

    // ---------------------------------------------------------------- houses: plastered facades, slate roofs with dormers
    const facade = (kind) => { // 8 units wide x 12 tall per tile, 32 px per unit; white plaster, tinted per house
      const c = TX.makeCanvas(256, 384), g = c.getContext('2d');
      const rr = K.rng(300 + kind.length * 13 + kind.charCodeAt(1));
      const Y = (u) => 384 - u * 32, X = (u) => u * 32;
      g.fillStyle = '#f6f3ec'; g.fillRect(0, 0, 256, 384);
      for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${rr() < 0.5 ? '255,255,255' : '70,60,50'},${0.03 + rr() * 0.05})`; g.fillRect(rr() * 256, rr() * 384, 2 + rr() * 3, 2 + rr() * 3); }
      g.fillStyle = '#a49c90'; g.fillRect(0, Y(0.8), 256, 0.8 * 32); // stone plinth
      g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(0, Y(0.8), 256, 3);
      const win = (cx, y0, w, h, { shutter = null, arch = false, frame = '#ebe6dc', box = false, glass = 0 } = {}) => {
        if (shutter) { g.fillStyle = shutter; g.fillRect(X(cx - w / 2 - 0.55), Y(y0 + h), 0.5 * 32, h * 32); g.fillRect(X(cx + w / 2 + 0.05), Y(y0 + h), 0.5 * 32, h * 32); g.fillStyle = 'rgba(0,0,0,0.25)'; for (let k = 1; k < 6; k++) { g.fillRect(X(cx - w / 2 - 0.55), Y(y0 + h) + (k * h * 32) / 6, 16, 1.5); g.fillRect(X(cx + w / 2 + 0.05), Y(y0 + h) + (k * h * 32) / 6, 16, 1.5); } }
        g.fillStyle = frame; g.fillRect(X(cx - w / 2 - 0.16), Y(y0 + h + 0.16), (w + 0.32) * 32, (h + 0.32) * 32);
        if (arch) { g.beginPath(); g.arc(X(cx), Y(y0 + h), (w / 2 + 0.16) * 32, PI, 0); g.fill(); }
        const gr = g.createLinearGradient(0, Y(y0 + h), 0, Y(y0)); gr.addColorStop(0, glass ? '#3a4a52' : '#2a3842'); gr.addColorStop(1, '#141c24');
        g.fillStyle = gr; g.fillRect(X(cx - w / 2 + 0.05), Y(y0 + h - 0.05), (w - 0.1) * 32, (h - 0.1) * 32);
        if (arch) { g.beginPath(); g.arc(X(cx), Y(y0 + h - 0.05), (w / 2 - 0.05) * 32, PI, 0); g.fill(); }
        if (!glass) { g.fillStyle = frame; g.fillRect(X(cx) - 1.5, Y(y0 + h), 3, h * 32); g.fillRect(X(cx - w / 2), Y(y0 + h * 0.66), w * 32, 3); }
        g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(X(cx - w / 2 + 0.1), Y(y0 + h - 0.1), 5, h * 18);
        g.fillStyle = '#d8d2c6'; g.fillRect(X(cx - w / 2 - 0.3), Y(y0 - 0.02), (w + 0.6) * 32, 5); // sill
        if (box) { g.fillStyle = '#5a3a22'; g.fillRect(X(cx - w / 2 - 0.1), Y(y0 + 0.05), (w + 0.2) * 32, 7); for (let k = 0; k < 8; k++) { g.fillStyle = rr() < 0.7 ? '#d8242a' : '#f08ab0'; g.beginPath(); g.arc(X(cx - w / 2) + rr() * w * 32, Y(y0 + 0.2) - rr() * 6, 2.5 + rr() * 2.5, 0, TAU); g.fill(); } }
      };
      const band = (y) => { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, Y(y), 256, 5); g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(0, Y(y) - 4, 256, 4); };
      if (kind === 'town') {
        for (const cx of [1.4, 4, 6.6]) { win(cx, 1.5, 1.0, 1.75); win(cx, 4.6, 1.0, 1.8, { box: rr() < 0.4 }); win(cx, 7.7, 1.0, 1.6); win(cx, 10.4, 0.9, 1.2); }
        band(3.9); band(7.1);
      } else if (kind === 'cottage') {
        for (const cx of [2, 6]) { win(cx, 1.4, 1.1, 1.5, { shutter: '#3f6a46' }); win(cx, 4.6, 1.1, 1.5, { shutter: '#3f6a46', box: true }); win(cx, 7.8, 0.9, 1.3); }
        band(4.0);
      } else if (kind === 'shop') {
        for (const cx of [2, 6]) { win(cx, 1.0, 2.6, 2.3, { arch: true, glass: 1, frame: '#3a3430' }); win(cx, 4.6, 1.0, 1.7, { box: true }); win(cx, 7.7, 1.0, 1.6); win(cx, 10.4, 0.9, 1.2); }
        band(3.9); g.fillStyle = 'rgba(40,30,20,0.55)'; g.fillRect(0, Y(4.05), 256, 7);
      } else if (kind === 'abbey') {
        for (const cx of [1.33, 4, 6.66]) { win(cx, 1.4, 0.9, 1.5, { arch: true }); win(cx, 4.1, 0.9, 1.6); win(cx, 6.8, 0.9, 1.6); win(cx, 9.5, 0.8, 1.3); }
        band(3.6);
      } else if (kind === 'church') {
        for (const cx of [2, 6]) win(cx, 2.6, 1.4, 5.0, { arch: true, frame: '#d8ccb6' });
        g.fillStyle = 'rgba(160,140,110,0.45)'; for (let y = 0; y < 12; y += 0.5) { g.fillRect(0, Y(y + 0.5), 10, 15); g.fillRect(246, Y(y + 0.25), 10, 15); }
      } else if (kind === 'barracks') {
        for (const cx of [1.33, 4, 6.66]) { win(cx, 1.4, 1.0, 1.6); win(cx, 4.4, 1.0, 1.6); win(cx, 7.4, 0.9, 1.4); }
        band(3.8);
      }
      return K.std({ map: TX.toTexture(c), roughness: 0.86, vertexColors: true });
    };
    const FAC = {};
    for (const k of ['town', 'cottage', 'shop', 'abbey', 'church', 'barracks']) { FAC[k] = facade(k); uvBox.set(FAC[k], [8, 12]); }
    const PLASTER = [0xf2e8d2, 0xecd29c, 0xeac6b4, 0xf6f4ee, 0xd2d8d8, 0xd2dcc0, 0xf2cca4, 0xe2dace, 0xd8c0a8];
    const house = ({ x, z, ry = 0, len = 9, dep = 8, wall = 8, rise = 3.6, kind = 'town', tint = null, over = 0.5, chimney = true, door = true, dorm = true, y0 = null, coll = true, slate = 0x5a606a }) => {
      const base = y0 ?? Math.max(0, gy(x, z));
      const pos = [], uv = [], nrm = [];
      const tri = (a, b, c, n, ua, ub, uc) => {
        const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        const cx = e1[1] * e2[2] - e1[2] * e2[1], cy = e1[2] * e2[0] - e1[0] * e2[2], cz = e1[0] * e2[1] - e1[1] * e2[0];
        const flip = cx * n[0] + cy * n[1] + cz * n[2] < 0;
        for (const [p, u] of flip ? [[a, ua], [c, uc], [b, ub]] : [[a, ua], [b, ub], [c, uc]]) { pos.push(...p); uv.push(...u); nrm.push(...n); }
      };
      const quad = (a, b, c, d, n, ua, ub, uc, ud) => { tri(a, b, c, n, ua, ub, uc); tri(a, c, d, n, ua, uc, ud); };
      const hl = len / 2, hd = dep / 2, Wt = 8, Ht = 12, yb = -1.2;
      const u0 = r() * 0.5;
      for (const e of [-1, 1]) {
        quad([-hl, yb, e * hd], [hl, yb, e * hd], [hl, wall, e * hd], [-hl, wall, e * hd], [0, 0, e], [u0, yb / Ht], [u0 + len / Wt, yb / Ht], [u0 + len / Wt, wall / Ht], [u0, wall / Ht]);
        const gx = e * hl;
        quad([gx, yb, -hd], [gx, yb, hd], [gx, wall, hd], [gx, wall, -hd], [e, 0, 0], [0, yb / Ht], [dep / Wt, yb / Ht], [dep / Wt, wall / Ht], [0, wall / Ht]);
        tri([gx, wall, -hd], [gx, wall, hd], [gx, wall + rise, 0], [e, 0, 0], [0, wall / Ht], [dep / Wt, wall / Ht], [dep / 2 / Wt, (wall + rise) / Ht]);
      }
      const wg = new T.BufferGeometry();
      wg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); wg.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); wg.setAttribute('normal', new T.Float32BufferAttribute(nrm, 3));
      colorize(wg, new T.Color(tint ?? r.pick(PLASTER)).multiplyScalar(0.94 + r() * 0.08));
      xf(wg, { x, y: base, z, ry });
      bake(wg, FAC[kind], x, z);
      // slate roof: two slopes, ridge, dormers, chimney
      const slope = Math.hypot(hd + over, (rise * (hd + over)) / hd), pitch = Math.atan2(rise, hd);
      const rc = new T.Color(slate).multiplyScalar(0.88 + r() * 0.22);
      for (const e of [-1, 1]) {
        const g = new T.BoxGeometry(len + over * 2, 0.28, slope);
        const p = g.attributes.position, u = g.attributes.uv;
        for (let i = 0; i < p.count; i++) u.setXY(i, (p.getX(i) + len) / 3, (p.getZ(i) + slope) / 3);
        xf(g, { rx: e * pitch });
        const mid = (hd + over) / 2;
        xf(g, { z: e * mid, y: wall + rise - rise * (mid / hd) + 0.18 });
        const g2 = colorize(g, rc);
        xf(g2, { x, y: base, z, ry });
        bake(g2, roofMat, x, z);
      }
      bake(xf(colorize(xf(new T.CylinderGeometry(0.2, 0.2, len + over * 2, 6), { rz: PI / 2, y: wall + rise + 0.25 }), rc.clone().multiplyScalar(0.75)), { x, y: base, z, ry }), vc, x, z);
      const f = frame(x, base, z, ry);
      if (dorm && len > 5.5) {
        const nd = Math.max(1, Math.floor((len - 1.5) / 3.2));
        for (let k = 0; k < nd; k++) {
          const dx = -((nd - 1) * 3.2) / 2 + k * 3.2, dz = hd * 0.42, dy = wall + rise * (1 - 0.42) - 0.3;
          f(new T.BoxGeometry(1.5, 1.5, 1.6), 0xf0ece4, { x: dx, y: dy + 0.6, z: dz + 0.1 });
          f(new T.BoxGeometry(0.9, 0.95, 0.05), 0x222a32, { x: dx, y: dy + 0.65, z: dz + 0.92 });
          for (const e of [-1, 1]) f(new T.BoxGeometry(0.95, 0.12, 1.9), slate, { x: dx + e * 0.42, y: dy + 1.62, z: dz + 0.1, rz: e * -0.75 }, roofMat);
        }
      }
      if (chimney) f(new T.BoxGeometry(0.9, 2.4, 0.9), r() < 0.5 ? 0xc8beb0 : 0x9a5a48, { x: r.range(-hl * 0.6, hl * 0.6), y: wall + rise * 0.7 + 0.7, z: -hd * 0.3 });
      if (door && kind !== 'abbey') f(new T.BoxGeometry(1.3, 2.3, 0.2), r.pick([0x5a3420, 0x3a5a4a, 0x7a2a1e, 0x2e3e5a]), { x: r.range(-hl * 0.5, hl * 0.5), y: 1.0, z: hd + 0.05 });
      if (coll) K.box(x, z, hl + 0.1, hd + 0.1, -ry, base + wall + 2);
      block(x, z, hl + over, hd + over, -ry, 1.0);
      AO(x, z, hl + 1.8, hd + 1.8, 0.45, -ry, base);
    };
    // a row of houses along the road: front facing the road, random widths, skipping anything in the way
    const PLAZA = []; // [x, z, r] spots kept free (cafés, gates, signs...)
    const rowAlong = (s0, s1, side, { set = 3, dep = 8, wallR = [7, 9.5], kinds = ['town'], maxTop = 99, gap = [0.2, 1.4] } = {}) => {
      const placed = [];
      for (let s = s0; s < s1;) {
        const len = r.range(6.5, 10), wall = r.range(wallR[0], wallR[1]);
        const sm = s + len / 2, p = track.at(sm), o = side * (W / 2 + set + dep / 2);
        const x = p.x + p.nx * o, z = p.z + p.nz * o;
        const ry = Math.atan2(-p.nx * side, -p.nz * side);
        let ok = wall + 3.6 <= maxTop;
        const ca = Math.cos(-ry), sa = Math.sin(-ry);
        let hmin = 1e9, hmax = -1e9;
        for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]]) {
          const lx = (a * len) / 2, lz = (b * dep) / 2, qx = x + lx * ca - lz * sa, qz = z + lx * sa + lz * ca;
          if (roadD(qx, qz) < set - 0.6 || inRiver(qx, qz, 5.5) || isBlocked(qx, qz, -1.35) || PLAZA.some(([px, pz, pr]) => Math.hypot(qx - px, qz - pz) < pr)) ok = false;
          if (qx < BOUNDS.minX + 3 || qx > BOUNDS.maxX - 3 || qz < BOUNDS.minZ + 3 || qz > BOUNDS.maxZ - 3) ok = false;
          const hh = gy(qx, qz); hmin = Math.min(hmin, hh); hmax = Math.max(hmax, hh);
        }
        if (hmax - hmin > 1.6) ok = false;
        if (ok) { const kind = r.pick(kinds); house({ x, z, ry, len: len - 0.3, dep, wall, kind, y0: hmin, rise: r.range(3.0, 4.2) }); placed.push({ x, z, ry, len: len - 0.3, dep, kind, s: sm, y: hmin }); }
        s += len + (ok ? r.range(gap[0], gap[1]) : 2.5);
      }
      return placed;
    };

    // ---- Neimënster abbey: four wings round a square cloister, the church of St John beside it
    {
      const cx = -70, cz = -16, half = 11, wd = 5.4, wall = 8.6;
      house({ x: cx, z: cz - half + wd / 2, ry: PI, len: half * 2, dep: wd, wall, kind: 'abbey', tint: 0xeee6d6, door: false, rise: 3.2, chimney: false });
      house({ x: cx, z: cz + half - wd / 2, ry: 0, len: half * 2, dep: wd, wall, kind: 'abbey', tint: 0xeee6d6, door: false, rise: 3.2, chimney: false });
      house({ x: cx - half + wd / 2, z: cz, ry: -PI / 2, len: half * 2 - wd * 2, dep: wd, wall, kind: 'abbey', tint: 0xeae0ce, door: false, rise: 3.2, chimney: false, dorm: false });
      house({ x: cx + half - wd / 2, z: cz, ry: PI / 2, len: half * 2 - wd * 2, dep: wd, wall, kind: 'abbey', tint: 0xeae0ce, door: false, rise: 3.2, chimney: false, dorm: false });
      // cloister garden: lawn quarters, gravel cross paths, a well, the arcade walks round it
      const inner = half - wd;
      const lq = K.rng(61);
      const lawn = TX.paint(128, 128, (x, y, u, v, o) => {
        const path = Math.abs(u - 0.5) < 0.06 || Math.abs(v - 0.5) < 0.06 || Math.max(Math.abs(u - 0.5), Math.abs(v - 0.5)) > 0.42;
        const n = lq() * 20;
        if (path) { o[0] = 196 + n; o[1] = 184 + n; o[2] = 160 + n; } else { const st = Math.floor(u * 12) % 2 ? 8 : -8; o[0] = 78 + n + st; o[1] = 128 + n + st; o[2] = 52 + n; }
      });
      K.mesh(new T.PlaneGeometry(inner * 2, inner * 2), K.std({ map: TX.toTexture(lawn, { wrap: false }), roughness: 0.92 }), cx, 0.05, cz, { rx: -PI / 2, cast: false });
      prop(new T.CylinderGeometry(0.9, 1.0, 0.9, 16), 0xd8ccb4, { x: cx, y: 0.45, z: cz }, stoneMat);
      prop(new T.TorusGeometry(0.75, 0.12, 6, 18), 0x6a6460, { x: cx, y: 1.6, z: cz, rx: PI / 2 }, vcMetal);
      for (let k = 0; k < 4; k++) { const a = (k / 4) * TAU + PI / 4; prop(new T.SphereGeometry(0.7, 10, 8), 0x4a7a32, { x: cx + Math.cos(a) * 2.2, y: 0.6, z: cz + Math.sin(a) * 2.2, sy: 0.9 }, vc); }
      // arcades: arched openings on the inner faces (dark recesses with pale arch frames)
      const arc = TX.makeCanvas(64, 96), ag = arc.getContext('2d');
      ag.fillStyle = '#e6dcc8'; ag.fillRect(0, 0, 64, 96);
      ag.fillStyle = '#2a2420'; ag.beginPath(); ag.moveTo(10, 96); ag.lineTo(10, 40); ag.arc(32, 40, 22, PI, 0); ag.lineTo(54, 96); ag.closePath(); ag.fill();
      ag.fillStyle = 'rgba(0,0,0,0.15)'; ag.fillRect(0, 0, 64, 6);
      const amat = K.std({ map: TX.toTexture(arc, { wrap: false }), roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      const arches = [];
      for (let k = 0; k < 5; k++) {
        const t = -inner + 1.1 + (k * (inner * 2 - 2.2)) / 4;
        arches.push({ x: cx + t, y: 1.25, z: cz - inner + 0.03, ry: 0 }, { x: cx + t, y: 1.25, z: cz + inner - 0.03, ry: PI }, { x: cx - inner + 0.03, y: 1.25, z: cz + t, ry: PI / 2 }, { x: cx + inner - 0.03, y: 1.25, z: cz + t, ry: -PI / 2 });
      }
      K.instances(new T.PlaneGeometry(1.7, 2.5), amat, arches, { cast: false });
      // church of St John: nave with a west tower and a slender slate spire
      const chx = -73, chz = 2.5;
      house({ x: chx, z: chz, ry: 0, len: 15, dep: 7, wall: 7.5, rise: 4, kind: 'church', tint: 0xf0e8d8, door: false, dorm: false, chimney: false });
      const tx0 = chx - 9.5;
      prop(new T.BoxGeometry(5, 15, 5), 0xece2cc, { x: tx0, y: 6.3, z: chz }, FAC.church);
      prop(new T.BoxGeometry(5.5, 0.5, 5.5), 0xd8ccb4, { x: tx0, y: 13.9, z: chz }, stoneMat);
      prop(slateCone(3.6, 9, 8), 0x4c525c, { x: tx0, y: 18.6, z: chz, ry: PI / 8 }, roofMat);
      prop(new T.CylinderGeometry(0.07, 0.07, 1.8, 5), 0xd8b040, { x: tx0, y: 23.8, z: chz }, vcMetal);
      prop(new T.BoxGeometry(0.9, 0.08, 0.08), 0xd8b040, { x: tx0, y: 24.1, z: chz }, vcMetal);
      for (const [dx, dz, ry] of [[0, 2.52, 0], [0, -2.52, PI], [2.52, 0, PI / 2], [-2.52, 0, -PI / 2]]) prop(new T.PlaneGeometry(1.0, 2.0), 0x1e1a16, { x: tx0 + dx, y: 11, z: chz + dz, ry });
      const clock = TX.labelTexture(128, 128, (g) => {
        g.fillStyle = '#f2ece0'; g.beginPath(); g.arc(64, 64, 60, 0, TAU); g.fill();
        g.strokeStyle = '#2a2420'; g.lineWidth = 5; g.beginPath(); g.arc(64, 64, 56, 0, TAU); g.stroke();
        g.fillStyle = '#2a2420'; for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; g.fillRect(64 + Math.cos(a) * 46 - 3, 64 + Math.sin(a) * 46 - 3, 6, 6); }
        g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(64, 64); g.lineTo(64, 28); g.moveTo(64, 64); g.lineTo(90, 72); g.stroke();
      });
      K.mesh(new T.PlaneGeometry(2.2, 2.2), K.std({ map: clock, transparent: true, alphaTest: 0.4, roughness: 0.5 }), tx0, 8.4, chz + 2.53, { cast: false });
      K.box(tx0, chz, 2.6, 2.6, 0, 24); block(tx0, chz, 3, 3, 0, 1);
      AO(tx0, chz, 4.2, 4.2, 0.5);
      block(cx, cz, half + 1, half + 1, 0, 0.5);
      A.cloister = [cx, cz, inner];
    }

    // ---- clipped hedges on low stone plinths fence off the insides of the open corners (no cutting across)
    const hedge = (s0, s1, side, off = 3.2) => {
      const fr = roadFrames(s0, s1, side, off, 0.8);
      bake(sweep(fr, [[0, -0.2, 0.75], [0, 0.55, 0.9], [0.9, 0.55, 0.9], [0.9, -0.2, 0.75]], { col: 1 }), stoneMat, fr[0].x, fr[0].z);
      const g = sweep(fr, [[0.05, 0.5, 0.75], [0.0, 1.5, 0.95], [0.25, 1.85, 1.1], [0.65, 1.85, 1.1], [0.9, 1.5, 0.95], [0.85, 0.5, 0.75]], { uS: 2, vS: 2 });
      const ca = g.attributes.color, hc = new T.Color(0x3f6a2a);
      for (let i = 0; i < ca.count; i++) ca.setXYZ(i, ca.getX(i) * hc.r, ca.getY(i) * hc.g, ca.getZ(i) * hc.b);
      bake(g, vc, fr[0].x, fr[0].z);
      for (let i = 0; i < fr.length - 3; i += 3) { const a = fr[i], b = fr[Math.min(fr.length - 1, i + 3)]; K.capsule(a.x + a.nx * 0.45, a.z + a.nz * 0.45, b.x + b.nx * 0.45, b.z + b.nz * 0.45, 0.55, 2.6); }
      for (const f of fr) if (r() < 0.25) block(f.x + f.nx * 0.45, f.z + f.nz * 0.45, 0.8, 0.8);
    };
    hedge(S.br3 + 11.5, L + S.start - 18, -1, 3.0); // inside the west loop, from the bridge to the first house
    hedge(S.r3b + 1, S.r3b + 21, 1, 2.6); // inside the bend at the foot of the descent

    // ---- the Rham plateau: two long barracks blocks, a round tower, an orchard
    house({ x: 60, z: 47.5, ry: PI, len: 32, dep: 7, wall: 6.4, kind: 'barracks', tint: 0xeee6d8, y0: PL.h, rise: 3.2, slate: 0x50565e });
    house({ x: 60, z: 59, ry: 0, len: 30, dep: 7, wall: 6.0, kind: 'barracks', tint: 0xe8dcc6, y0: PL.h, rise: 3.0, slate: 0x50565e });
    // courtyard walls with closed carriage gates between the two blocks (no squeezing through to the far side)
    for (const wx of [45.6, 74.4]) {
      prop(new T.BoxGeometry(1.2, 4.2, 5.2), 0xe6dccb, { x: wx, y: PL.h + 1.9, z: 53.3 }, stoneMat);
      prop(new T.BoxGeometry(1.5, 0.35, 5.5), 0xf2ead8, { x: wx, y: PL.h + 4.1, z: 53.3 }, stoneMat);
      const e = wx < 60 ? -1 : 1;
      prop(new T.BoxGeometry(0.12, 2.8, 3.0), 0x5a3a24, { x: wx + e * 0.62, y: PL.h + 1.4, z: 53.3 });
      prop(new T.BoxGeometry(0.14, 0.2, 3.2), 0x2a2a2a, { x: wx + e * 0.66, y: PL.h + 2.0, z: 53.3 });
      K.box(wx, 53.3, 0.7, 2.9, 0, PL.h + 5);
    }
    for (const [tx, tz] of [[93.5, 88], [32, 90]]) {
      prop(new T.CylinderGeometry(3.1, 3.4, 9, 22), 0xe4d8c2, { x: tx, y: PL.h + 4.2, z: tz }, stoneMat);
      prop(slateCone(3.6, 4.6, 22), 0x4c525c, { x: tx, y: PL.h + 11, z: tz }, roofMat);
      K.circle(tx, tz, 3.2, PL.h + 12); block(tx, tz, 3.6, 3.6, 0, 1); AO(tx, tz, 4.5, 4.5, 0.5, 0, PL.h);
    }

    // ---- street fronts (rows along the road)
    rowAlong(S.start - 18, S.br1 - 13, -1, { set: 3, wallR: [7.5, 9.5] }); // Grund, north of the start straight
    rowAlong(S.br1 + 12, S.r1a - 30, -1, { set: 3, wallR: [7.5, 10], kinds: ['town', 'shop'] });
    rowAlong(S.start - 26, S.br1 - 13, 1, { set: 3.5, dep: 7, wallR: [5.2, 6.2], kinds: ['cottage'], maxTop: 10 }); // low cottages on the south side
    rowAlong(S.br1 + 12, S.r1a - 32, 1, { set: 3.5, dep: 7, wallR: [5.2, 6.2], kinds: ['cottage'], maxTop: 10 });
    rowAlong(S.r1a - 26, S.r1a - 2, -1, { set: 3, wallR: [7, 9] }); // the approach to the climb
    rowAlong(S.r3b + 14, S.via1 - 8, 1, { set: 3, wallR: [7, 9], kinds: ['town', 'shop'] }); // Clausen, south side of the east road
    rowAlong(S.via1 + 8, S.ford - 22, 1, { set: 3, wallR: [7, 9] });
    rowAlong(S.br2 + 12, S.br3 - 40, -1, { set: 3, wallR: [7.5, 9.5], kinds: ['town', 'shop'] }); // Grund, east of the abbey
    rowAlong(S.br3 + 14, L + S.start - 30, 1, { set: 3, wallR: [6.5, 8.5], kinds: ['cottage', 'town'] }); // west bank, outside the west loop
    // Clausen between the climb and the descent: houses and the little church of St Cunegonde
    for (const [x, z, ry, len, wall, kind] of [[52, 28, 0, 9, 8, 'town'], [62, 29, 0, 8, 7.5, 'shop'], [52, 15, PI / 2, 8, 7, 'cottage'], [71.3, 18, -PI / 2, 9, 8, 'town'], [66, -4, PI, 9, 7.5, 'town'], [55, -6, PI, 8, 7, 'cottage']]) house({ x, z, ry, len, wall, kind });
    {
      const chx = 61, chz = 7;
      house({ x: chx, z: chz, ry: PI / 2, len: 12, dep: 6.5, wall: 6.5, rise: 3.6, kind: 'church', tint: 0xf2ece2, door: false, dorm: false, chimney: false });
      prop(new T.BoxGeometry(4, 12, 4), 0xf0e8da, { x: chx, y: 5.5, z: chz + 7.5 }, FAC.church);
      prop(slateCone(2.9, 7, 4), 0x4c525c, { x: chx, y: 14.9, z: chz + 7.5, ry: PI / 4 }, roofMat);
      prop(new T.SphereGeometry(0.3, 8, 6), 0xd8b040, { x: chx, y: 18.6, z: chz + 7.5 }, vcMetal);
      K.box(chx, chz + 7.5, 2, 2, 0, 18); block(chx, chz + 7.5, 2.5, 2.5, 0, 1); AO(chx, chz + 7.5, 3.4, 3.4, 0.5);
    }
    // the upper town on the cliffs: tall fronts along the top edge, facing south over the valley
    for (let x = -158; x < 160;) {
      const len = r.range(7, 10.5);
      const xm = x + len / 2;
      let ze = -91.5; // the cliff edge
      for (let z = -104; z < -60; z += 0.5) { if (gy(xm, z) < gy(xm, -104) - 1.5) { ze = z; break; } }
      const dep = clamp(ze - 1 - (BOUNDS.minZ + 0.6), 0, 7), zt = ze - 1 - dep / 2; // fit between the board's back edge and the drop
      const okSpot = !(xm > 88 && xm < 104) && dep > 4.5 && zt < -86 && gy(xm, zt) > 18;
      if (okSpot) house({ x: xm, z: zt, ry: 0, len: len - 0.2, dep, wall: r.range(8, 11), kind: r.pick(['town', 'town', 'shop']), y0: gy(xm, zt) - 0.4, coll: false });
      x += len + r.range(0, 0.6);
    }

    // ---- Rives de Clausen: café fronts with striped awnings and terraces of tiny tables; the road-train's gates
    const terrace = { tables: [], chairs: [], shades: [], sitters: [] };
    {
      for (const [gx, gz] of A.rtGates) PLAZA.push([gx, gz, 6.2]);
      for (let s = 0; s < A.rt.L; s += 2) { const q = A.rt.path.at(s); if (q.z > -84 && q.z < -69.5) PLAZA.push([q.x, q.z, 3.4]); }
      const fronts = rowAlong(S.rivesA - 8, S.rivesB + 12, 1, { set: 7.6, dep: 8, wallR: [7.5, 9.5], kinds: ['shop', 'shop', 'town'], gap: [0.1, 0.6] });
      // striped awnings: one atlas, five colour rows (picked through the UVs)
      const cafeCols = ['#b8282a', '#2a6a4a', '#1e4a8a', '#d88a1a', '#7a2a5a'];
      const awn = TX.makeCanvas(128, 160), ag = awn.getContext('2d');
      cafeCols.forEach((cc, k) => { for (let i = 0; i < 8; i++) { ag.fillStyle = i % 2 ? '#f6f2e8' : cc; ag.fillRect(i * 16, k * 32, 16, 32); } ag.fillStyle = 'rgba(0,0,0,0.12)'; ag.fillRect(0, k * 32 + 26, 128, 6); });
      const awnMat = K.std({ map: TX.toTexture(awn), roughness: 0.8, side: T.DoubleSide });
      const shadeCols = [0xc8302e, 0x2f7a52, 0x2a5aa0, 0xe09a2a, 0x8a3a6a];
      for (const f of fronts) {
        if (f.kind !== 'shop') continue;
        const ci = (r() * cafeCols.length) | 0, fr = frame(f.x, f.y, f.z, f.ry);
        const ag2 = new T.PlaneGeometry(f.len - 0.8, 2.0, 1, 1).rotateX(-PI / 2 + 0.5);
        const uvA = ag2.attributes.uv; for (let k = 0; k < uvA.count; k++) uvA.setXY(k, uvA.getX(k) * (f.len - 0.8) / 2, 1 - (ci + 0.1 + uvA.getY(k) * 0.8) / 5);
        const g3 = colorize(xf(ag2, { y: 3.7, z: f.dep / 2 + 0.9 }), 0xffffff);
        g3.applyMatrix4(new T.Matrix4().compose(new T.Vector3(f.x, f.y, f.z), new T.Quaternion().setFromEuler(new T.Euler(0, f.ry, 0)), new T.Vector3(1, 1, 1)));
        bake(g3, awnMat, f.x, f.z);
        fr(new T.BoxGeometry(f.len - 0.8, 0.32, 0.06), shadeCols[ci], { y: 3.12, z: f.dep / 2 + 1.75 }, vc);
        // planters with flowers at the terrace corners
        for (const e of [-1, 1]) {
          fr(new T.BoxGeometry(0.9, 0.7, 0.9), 0x6a4a32, { x: e * (f.len / 2 - 0.6), y: 0.35, z: f.dep / 2 + 6.0 }, vc);
          fr(new T.IcosahedronGeometry(0.6, 0), r.pick([0xd8242a, 0xf08ab0, 0xf2d84a]), { x: e * (f.len / 2 - 0.6), y: 0.95, z: f.dep / 2 + 6.0, sy: 0.7 }, vc);
        }
        // tables between the facade and the kerb, a parasol over each table in the outer row
        const nT = f.len > 8.5 ? 3 : 2;
        for (let k = 0; k < nT; k++) for (const dz of [2.6, 4.9]) {
          const lx = -f.len / 2 + 1.6 + (k * (f.len - 3.2)) / Math.max(1, nT - 1) + r.range(-0.3, 0.3), lz = f.dep / 2 + dz;
          const [tx, tz] = local(f.x, f.z, -f.ry + PI / 2, lz, -lx);
          if (PLAZA.some(([px, pz, pr]) => Math.hypot(tx - px, tz - pz) < pr) || roadD(tx, tz) < 1.4) continue;
          terrace.tables.push({ x: tx, y: f.y, z: tz, ry: r() * TAU });
          for (let c = 0; c < 2; c++) { const a = r() * TAU + c * PI; terrace.chairs.push({ x: tx + Math.cos(a) * 0.95, y: f.y, z: tz + Math.sin(a) * 0.95, ry: -a + PI / 2, color: r.pick([0x2a2a2a, 0x8a6a4a, 0x3a5a4a]) }); if (r() < 0.6) terrace.sitters.push([tx + Math.cos(a) * 0.95, tz + Math.sin(a) * 0.95, f.y, -a - PI / 2]); }
          if (dz > 4) terrace.shades.push({ x: tx, y: f.y, z: tz, ry: r() * TAU, color: shadeCols[ci] });
        }
      }
      // gates: stone archways through the house row (the road-train comes and goes through them)
      const gateSign = K.std({ map: TX.labelTexture(256, 64, (g2) => { g2.fillStyle = '#2f6a3e'; g2.fillRect(0, 0, 256, 64); g2.strokeStyle = '#d8b040'; g2.lineWidth = 4; g2.strokeRect(5, 5, 246, 54); g2.fillStyle = '#f4f0e0'; g2.font = '700 26px Rubik, Arial'; g2.textAlign = 'center'; g2.fillText('Petit Train · Tours', 128, 42); }), roughness: 0.5 });
      // amber lamps on each gate flash while the train is about to come out of it or go into it
      A.gateLamps = [0, 1].map(() => K.std({ color: 0xffb040, emissive: 0xff8a10, emissiveIntensity: 0, roughness: 0.3 }));
      A.rtGates.forEach(([gx, gz], gi) => {
        for (const e of [-1, 1]) {
          prop(new T.BoxGeometry(0.9, 1.1, 0.5), 0x23332c, { x: gx + e * 3.4, y: 4.9, z: gz + 3.7 }, vcSatin);
          K.mesh(new T.SphereGeometry(0.36, 12, 8), A.gateLamps[gi], gx + e * 3.4, 4.9, gz + 4.0, { cast: false });
        }
      });
      // the depot sheds behind the gates, built against the rock: the train is out of sight until it rolls out
      for (const [gx] of A.rtGates) house({ x: gx - 0.4, z: -88.2, ry: 0, len: 7.8, dep: 9, wall: 6.6, rise: 3.2, kind: 'barracks', tint: 0xe2d8c4, y0: 0, door: false, chimney: false, dorm: false });
      for (const [gx, gz] of A.rtGates) {
        const sh = new T.Shape();
        sh.moveTo(-4.4, -0.5); sh.lineTo(4.4, -0.5); sh.lineTo(4.4, 6.8); sh.lineTo(-4.4, 6.8); sh.closePath();
        const hole = new T.Path(); hole.moveTo(-2.5, -1); hole.lineTo(2.5, -1); hole.lineTo(2.5, 3.1); hole.absarc(0, 3.1, 2.5, 0, PI, false); hole.lineTo(-2.5, -1);
        sh.holes.push(hole);
        const eg = new T.ExtrudeGeometry(sh, { depth: 7, bevelEnabled: false, curveSegments: 12 });
        eg.translate(0, 0, -3.5);
        const uvA = eg.attributes.uv; for (let k = 0; k < uvA.count; k++) uvA.setXY(k, uvA.getX(k) / 4, uvA.getY(k) / 2);
        colorize(eg, 0xe8dcc6); xf(eg, { x: gx, y: 0, z: gz });
        bake(eg, stoneMat, gx, gz);
        for (let k = -3; k <= 3; k += 2) prop(new T.BoxGeometry(1.0, 0.9, 7.2), 0xf0e6d2, { x: gx + k * 1.15, y: 7.2, z: gz }, stoneMat); // crenellations
        prop(new T.BoxGeometry(5.6, 6, 0.1), 0x0e0c0a, { x: gx, y: 2.5, z: gz - 2.9 }, vc, false);
        prop(new T.PlaneGeometry(3.6, 0.9), 0xffffff, { x: gx, y: 6.0, z: gz + 3.53 }, gateSign, false);
        for (const e of [-1, 1]) K.box(gx + e * 3.45, gz, 0.95, 3.5, 0, 9);
        K.box(gx, gz - 2.4, 2.6, 0.7, 0, 7); // the dark depot doors (cars stop there; the train is kinematic)
        block(gx, gz, 4.6, 3.8, 0, 0.5);
      }
    }

    // ---- the weir below the ford: white water tumbling over a stone sill
    {
      const foam = TX.makeCanvas(128, 256), fg = foam.getContext('2d');
      const q = K.rng(5);
      for (let i = 0; i < 90; i++) { const x = q() * 128; fg.strokeStyle = `rgba(255,255,255,${0.25 + q() * 0.55})`; fg.lineWidth = 1 + q() * 4; fg.beginPath(); fg.moveTo(x, 0); fg.bezierCurveTo(x + (q() - 0.5) * 8, 80, x + (q() - 0.5) * 10, 170, x + (q() - 0.5) * 12, 256); fg.stroke(); }
      for (let i = 0; i < 260; i++) { fg.fillStyle = `rgba(255,255,255,${0.3 + q() * 0.5})`; fg.beginPath(); fg.arc(q() * 128, 180 + q() * 76, 1 + q() * 3, 0, TAU); fg.fill(); }
      const ft = TX.toTexture(foam); ft.repeat.set(2, 1);
      A.foam = ft;
      const fm = K.std({ map: ft, transparent: true, depthWrite: false, roughness: 0.3, emissive: 0x405058, emissiveMap: ft });
      const fr = A.rivFrames.filter((f) => f.d > dWeir - 3 && f.d < dWeir + 5);
      const pos = [], uv = [], idx = [];
      fr.forEach((f, i) => { const hw = rivHW(f.d) - 0.05, y = rivWL(f.d) + 0.06; for (const e of [-1, 1]) { pos.push(f.x + f.nx * hw * e, y, f.z + f.nz * hw * e); uv.push((e + 1) * 0.5, (f.d - dWeir + 3) / 8); } if (i < fr.length - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } });
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals();
      const nr = g.attributes.normal; for (let i = 0; i < nr.count; i++) if (nr.getY(i) < 0) nr.setXYZ(i, -nr.getX(i), -nr.getY(i), -nr.getZ(i));
      const m = new T.Mesh(g, fm); m.renderOrder = 2; keep.push(m); K.group.add(m);
      const bub = [];
      for (const f of fr) if (f.d > dWeir + 1.5) for (let k = 0; k < 6; k++) { const o = r.range(-1, 1) * (rivHW(f.d) - 0.6); bub.push({ x: f.x + f.nx * o, y: rivWL(f.d) + 0.05, z: f.z + f.nz * o, s: r.range(0.18, 0.45), sy: 0.4 }); }
      K.instances(new T.IcosahedronGeometry(1, 1), K.std({ color: 0xf4fbff, roughness: 0.3, transparent: true, opacity: 0.85 }), bub, { cast: false });
    }

    // ---------------------------------------------------------------- a gravel promenade along the Alzette below the Rives, benches
    const strollers = [];
    {
      const gc = TX.makeCanvas(128, 128), gg = gc.getContext('2d'), q = K.rng(91);
      gg.fillStyle = '#cbbd9c'; gg.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 900; i++) { const t = q(); gg.fillStyle = t < 0.4 ? '#a8987a' : t < 0.75 ? '#ddd2b6' : '#8e826a'; gg.beginPath(); gg.arc(q() * 128, q() * 128, 0.6 + q() * 1.4, 0, TAU); gg.fill(); }
      const pathMat = K.std({ map: TX.toTexture(gc), roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
      const segs = [];
      let cur = [];
      for (const f of A.rivFrames) {
        const o = rivHW(f.d) + 4.4, x = f.x + f.nx * o, z = f.z + f.nz * o;
        const ok = f.x > -4 && f.x < 93 && roadD(x, z) > 2.6 && !isBlocked(x, z, 0.5);
        if (ok) cur.push({ x, z, nx: f.nx, nz: f.nz, y: 0.02 }); else if (cur.length) { segs.push(cur); cur = []; }
      }
      if (cur.length) segs.push(cur);
      const benches = [];
      for (const sg of segs) {
        if (sg.length < 6) continue;
        const g = sweep(sg, [[-1.15, 0.02, 0.92], [-0.9, 0.05, 1], [0.9, 0.05, 1], [1.15, 0.02, 0.92]], { uS: 6, vS: 6 });
        const m = new T.Mesh(g, pathMat); m.receiveShadow = true; keep.push(m); K.group.add(m);
        sg.forEach((f, i) => {
          if (i % 2 === 0) block(f.x, f.z, 1.4, 1.4);
          if (i % 14 === 7) { const bx = f.x - f.nx * 1.9, bz = f.z - f.nz * 1.9; benches.push({ x: bx, y: 0, z: bz, ry: Math.atan2(-f.nx, -f.nz) }); K.circle(bx, bz, 0.9, 2); block(bx, bz, 1.6, 1.2); }
          if (i % 9 === 4 && r() < 0.7) strollers.push([f.x + f.nx * r.range(-0.6, 0.6), f.z + f.nz * r.range(-0.6, 0.6)]);
        });
      }
      const benchGeo = merge([
        colorize(new T.BoxGeometry(2.4, 0.12, 0.7).translate(0, 0.62, 0), 0x8a5a32),
        colorize(new T.BoxGeometry(2.4, 0.5, 0.1).translate(0, 1.0, -0.36).rotateX(-0.12), 0x8a5a32),
        colorize(new T.BoxGeometry(0.1, 0.62, 0.66).translate(-1.05, 0.31, 0), 0x2e3a30),
        colorize(new T.BoxGeometry(0.1, 0.62, 0.66).translate(1.05, 0.31, 0), 0x2e3a30),
      ]);
      if (benches.length) K.instances(benchGeo, vc, benches);
      for (const bn of benches) AO(bn.x, bn.z, 1.6, 0.8, 0.35, -bn.ry, 0);
    }

    // ---------------------------------------------------------------- the climb's footprint is not for trees or houses
    block(24, 14, 21, 27); block(RAMP3.x, RAMP3.z, 9.5, 18); block(24, 54, 3, 46);
    const GLUE = (() => { const s = sAt(58, 73), p = track.place(s, 3.2); return { s, p, bx: p.x + 9, bz: p.z + 13, ba: 0.35 }; })();
    block(GLUE.bx - 3, GLUE.bz, 11.5, 1.6, -GLUE.ba, 1);

    // ---------------------------------------------------------------- trees (flocked foam), bushes, ivy, grass tufts, flowers
    {
      // foam flock: clumpy bumps a few pixels across at play distance (the clumps need UVs for it, see foamUV)
      const flock = (() => {
        const Sz = 256, h = new Float32Array(Sz * Sz), q = K.rng(17);
        const fA = TX.noiseField(Sz, { seed: 19, period: 22, oct: 2 });
        for (let i = 0; i < h.length; i++) h[i] = fA[i] * 0.8 + q() * 0.2;
        return TX.toTexture(TX.normalFromHeight(h, Sz, Sz, 3.2), { srgb: false });
      })();
      // one oblique planar projection per clump: UVs linear in position keep the normal-mapped shading smooth
      const foamUV = (g, k = 1.1) => {
        const p = g.attributes.position, uv = new Float32Array(p.count * 2);
        for (let i = 0; i < p.count; i++) {
          uv[i * 2] = (p.getX(i) + p.getZ(i) * 0.55) * k; uv[i * 2 + 1] = (p.getY(i) - p.getZ(i) * 0.4 + p.getX(i) * 0.2) * k;
        }
        g.setAttribute('uv', new T.BufferAttribute(uv, 2));
        return g;
      };
      // bend the clump normals towards the outside of the whole crown: it shades as one soft mass, the lobes
      // only break up its outline (low-poly lobes with their own normals read as faceted plastic)
      const bendN = (g, cy, k = 0.6) => {
        const p = g.attributes.position, n = g.attributes.normal;
        for (let i = 0; i < p.count; i++) {
          let ox = p.getX(i), oy = (p.getY(i) - cy) * 0.8, oz = p.getZ(i);
          const l = Math.hypot(ox, oy, oz) || 1; ox /= l; oy /= l; oz /= l;
          const nx = n.getX(i) * (1 - k) + ox * k, ny = n.getY(i) * (1 - k) + oy * k + 0.08, nz = n.getZ(i) * (1 - k) + oz * k, m = Math.hypot(nx, ny, nz) || 1;
          n.setXYZ(i, nx / m, ny / m, nz / m);
        }
        return g;
      };
      const decGeo = (() => { // low-poly foam clumps (the flock normal map does the rest)
        const P = [], q = K.rng(12);
        P.push(colorize(new T.CylinderGeometry(0.045, 0.07, 0.5, 5, 1, true).translate(0, 0.25, 0), 0x4a3a2c));
        for (let k = 0; k < 6; k++) {
          const a = (k / 5) * TAU + q(), d = k ? 0.18 + q() * 0.1 : 0, y = 0.55 + (k ? q() * 0.3 : 0.26);
          let g = new T.IcosahedronGeometry(0.25 + q() * 0.09, 0);
          g.deleteAttribute('uv'); g = BU.mergeVertices(g);
          const pp = g.attributes.position; for (let i = 0; i < pp.count; i++) { const k2 = 1 + (q() - 0.5) * 0.3; pp.setXYZ(i, pp.getX(i) * k2, pp.getY(i) * k2 * 0.9, pp.getZ(i) * k2); }
          g.computeVertexNormals();
          xf(g, { x: Math.cos(a) * d, y, z: Math.sin(a) * d, rx: q() * 3, ry: q() * 3 });
          foamUV(g); bendN(g, 0.66);
          P.push(colorize(g, new T.Color(1, 1, 1).multiplyScalar(0.78 + (y - 0.5) * 0.6)));
        }
        return merge(P);
      })();
      const conGeo = (() => {
        const P = [];
        for (let k = 0; k < 6; k++) {
          const t = k / 6, rad = 1.0 - t * 0.78, y0 = 0.12 + t * 0.82, hgt = 0.3;
          const g = new T.ConeGeometry(rad * 0.22, hgt, 9, 1, true); g.translate(0, y0 + hgt / 2, 0);
          g.computeVertexNormals(); P.push(colorize(g, new T.Color(1, 1, 1).multiplyScalar(0.75 + t * 0.35)));
        }
        P.push(colorize(new T.CylinderGeometry(0.03, 0.045, 0.2, 6).translate(0, 0.1, 0), 0x4a3426));
        return merge(P);
      })();
      const bushGeo = (() => {
        const P = [], q = K.rng(14);
        for (let k = 0; k < 4; k++) { let g = new T.IcosahedronGeometry(0.3 + q() * 0.1, 0); g.deleteAttribute('uv'); g = BU.mergeVertices(g); g.computeVertexNormals(); xf(g, { x: (q() - 0.5) * 0.55, y: 0.25 + q() * 0.12, z: (q() - 0.5) * 0.55, sy: 0.8, ry: q() * 3 }); foamUV(g, 1.6); bendN(g, 0.2, 0.55); P.push(colorize(g, new T.Color(1, 1, 1).multiplyScalar(0.8 + q() * 0.3))); }
        return merge(P);
      })();
      const treeMat = K.std({ vertexColors: true, roughness: 0.95, normalMap: flock, normalScale: V2(0.75) });
      const decs = [], cons = [], bushes = [];
      const decCols = [0x4f7a2e, 0x5f8a34, 0x6a9a3a, 0x48702a, 0x7a9a3c, 0x587e30, 0x3f6a28];
      const conCols = [0x2c4a2a, 0x355630, 0x2a4224, 0x3c5a34];
      const willow = [0x8aa848, 0x9ab85a, 0x7a9a40];
      const okTree = (x, z, rad, roadM = 3) => {
        if (x < TX0 + 2 || x > TX1 - 2 || z > TZ1 - 2 || z < TZ0 + 2) return false;
        if (roadD(x, z) < roadM + rad) return false;
        if (inRiver(x, z, 1.6 + rad)) return false;
        if (isBlocked(x, z, rad * 0.5)) return false;
        if (PLAZA.some(([px, pz, pr]) => Math.hypot(x - px, z - pz) < pr)) return false;
        return true;
      };
      // a trunk about a car's length from a wall or another trunk leaves a pocket a car can't turn out of: such
      // trees are left out (trunks near the road are colliders so cars don't drive through them)
      const cramped = (x, z, rad) => {
        for (const c of PH.colliders) {
          if (c.moverFn || (c.bb && (x + rad < c.bb[0] || x - rad > c.bb[2] || z + rad < c.bb[1] || z - rad > c.bb[3]))) continue;
          if (PH.circleVsCollider(x, z, rad, c)) return true;
        }
        return false;
      };
      const addTree = (kind, x, z, hgt, col) => {
        const coll = (kind === 'dec' || kind === 'con') && roadD(x, z) < 16;
        if (coll && cramped(x, z, 0.65 + 5.4)) return false;
        const y = gy(x, z) - 0.15;
        const t = { x, y, z, ry: r() * TAU, rx: r.range(-0.05, 0.05), rz: r.range(-0.05, 0.05), color: col };
        if (kind === 'con') { t.sx = t.sz = hgt; t.sy = hgt; cons.push(t); } else if (kind === 'dec') { t.sx = t.sz = hgt * 0.8; t.sy = hgt; decs.push(t); } else if (kind === 'ivy') { t.sx = t.sz = hgt; t.sy = hgt * 0.55; t.y -= 0.3; bushes.push(t); } else { t.sx = t.sz = hgt; t.sy = hgt * 0.8; bushes.push(t); }
        if (coll) K.circle(x, z, 0.65, y + hgt);
        if (kind !== 'ivy') AO(x, z, hgt * (kind === 'bush' ? 0.4 : 0.3), hgt * (kind === 'bush' ? 0.4 : 0.3), 0.33, 0, y + 0.15);
        return true;
      };
      // woods on the valley sides and round the knoll (clumps from noise)
      for (let i = 0; i < 14000 && decs.length + cons.length < 470; i++) {
        const x = r.range(TX0 + 3, TX1 - 3), z = r.range(TZ0 + 3, TZ1 - 3);
        const h = gy(x, z);
        if (h < 0.9 || rockAt(x, z) > 0.42) continue;
        if (inPlat(x, z) && h < PL.h + 1) continue;
        if (n1(x, z, 0.07, 400) < 0.4) continue;
        if (!okTree(x, z, 1.6, 4)) continue;
        const con = r() < 0.18;
        addTree(con ? 'con' : 'dec', x, z, r.range(7, 12) * (con ? 1.1 : 1), con ? r.pick(conCols) : r.pick(decCols));
      }
      // along the river banks: willows and alders
      for (let i = 0; i < A.rivFrames.length; i += 4) {
        const f = A.rivFrames[i];
        for (const e of [-1, 1]) {
          if (r() > 0.42) continue;
          const o = rivHW(f.d) + r.range(3.2, 6), x = f.x + f.nx * o * e, z = f.z + f.nz * o * e;
          if (!okTree(x, z, 1.4, 3.2) || gy(x, z) > 2) continue;
          addTree('dec', x, z, r.range(7, 10.5), r.pick(willow.concat(decCols)));
        }
      }
      // gardens and squares in town
      for (let i = 0; i < 1600; i++) {
        const x = r.range(TX0 + 4, TX1 - 4), z = r.range(-60, TZ1 - 6);
        if (!okTree(x, z, 1.4, 3.5) || gy(x, z) > 1.2) continue;
        if (r() < 0.75) continue;
        if (inPlat(x, z)) continue;
        if (z > 84 && x > -10) continue;
        if (r() < 0.45) addTree('bush', x, z, r.range(2, 3.4), r.pick(decCols)); else addTree('dec', x, z, r.range(5.5, 9), r.pick(decCols));
      }
      // the plateau: an avenue along the south strip, trees on the east strip
      for (let x = PL.x0 + 6; x < PL.x1 - 6; x += 5.5) { const z = 87 + r.range(-0.8, 0.8); if (okTree(x, z, 1.2, 4)) addTree('dec', x, z, r.range(7, 9), r.pick(decCols)); }
      for (let z = 44; z < 70; z += 5) { const x = 96 + r.range(-0.6, 0.6); if (okTree(x, z, 1.2, 3)) addTree('dec', x, z, r.range(6, 8), r.pick(decCols)); }
      // bushes on the cliff tops and the Bock; ivy and shrubs clinging to the rock faces
      for (let i = 0; i < 9000 && bushes.length < 430; i++) {
        const x = r.range(TX0 + 2, TX1 - 2), z = r.range(TZ0 + 2, -40);
        const h = gy(x, z), rk = rockAt(x, z);
        if (h < 3 || isBlocked(x, z) || roadD(x, z) < 2.5) continue;
        if (rk > 0.45 && n1(x, z, 0.12, 9) > 0.52) addTree('ivy', x, z, r.range(1.6, 3.0), r.pick([0x4a6a2a, 0x3f5e26, 0x5a7a30]));
        else if (rk < 0.4 && h > 14 && r() < 0.5) addTree('bush', x, z, r.range(2, 3.4), r.pick(decCols));
      }
      // the Rham knoll the viaduct runs into: a wood on top, scrub and ivy on its rocky west face
      for (let i = 0, n = 0; i < 5000 && n < 95; i++) {
        const x = r.range(100, TX1 - 3), z = r.range(18, TZ1 - 3);
        const h = gy(x, z), rk = rockAt(x, z);
        if (h < 2 || isBlocked(x, z, 0.5) || roadD(x, z) < 5) continue;
        if (rk > 0.42) { if (n1(x, z, 0.15, 31) > 0.45) { addTree('ivy', x, z, r.range(1.8, 3.2), r.pick([0x4a6a2a, 0x3f5e26, 0x5a7a30])); n++; } continue; }
        if (n1(x, z, 0.09, 77) < 0.3 || !okTree(x, z, 1.4, 5)) continue;
        if (r() < 0.25) addTree('bush', x, z, r.range(2.2, 3.6), r.pick(decCols));
        else { const con = r() < 0.3; addTree(con ? 'con' : 'dec', x, z, r.range(7, 11.5), con ? r.pick(conCols) : r.pick(decCols)); }
        n++;
      }
      chunked(decGeo, treeMat, decs, { colors: true }, 85);
      chunked(conGeo, treeMat, cons, { colors: true }, 110);
      chunked(bushGeo, treeMat, bushes.filter((b) => b.sy > b.sx * 0.79), { colors: true, cast: false }, 85);
      chunked(bushGeo, treeMat, bushes.filter((b) => b.sy <= b.sx * 0.79), { colors: true, cast: false }, 110);
      // static grass tufts and flowers
      const Q = (K.quality && K.quality.grass) || 0.7;
      const pos = [], nrm = [], col = [], idx = [];
      const tr = K.rng(77);
      for (let b = 0; b < 4; b++) {
        const a = tr() * TAU, rad = tr() * 0.25, ox = Math.cos(a) * rad, oz = Math.sin(a) * rad;
        const h = 0.55 + tr() * 0.4, w = 0.1 + tr() * 0.05, rot = tr() * TAU, lean = 0.08 + tr() * 0.18, la = a + tr.range(-0.6, 0.6);
        const cr = Math.cos(rot), sr = Math.sin(rot), base = pos.length / 3;
        for (const [t, hw] of [[0, w / 2], [0.5, w * 0.35], [1, 0]]) {
          const y = t * h, bend = lean * t * t;
          for (const sgn of t < 1 ? [-1, 1] : [0]) { const lx = sgn * hw; pos.push(ox + lx * cr + Math.cos(la) * bend, y, oz + lx * sr + Math.sin(la) * bend); nrm.push(-sr * 0.3, 1, cr * 0.3); const k = 0.72 + 0.28 * t; col.push(k * 0.97, k, k * 0.85); }
        }
        idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2, base + 2, base + 3, base + 4);
      }
      const tuft = new T.BufferGeometry();
      tuft.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); tuft.setAttribute('normal', new T.Float32BufferAttribute(nrm, 3)); tuft.setAttribute('color', new T.Float32BufferAttribute(col, 3));
      tuft.setIndex(idx);
      const tufts = [], flowers = [];
      const cols = [0x9ac850, 0xb0d060, 0x88b844, 0xc8d070, 0xa8c058, 0x7aa83e];
      const n = Math.round(7000 * Q);
      for (let i = 0, tries = 0; i < n && tries < n * 4; tries++) {
        const x = tr.range(TX0 + 1, TX1 - 1), z = tr.range(TZ0 + 1, TZ1 - 1);
        const rd = roadD(x, z);
        if (rd < 1.2 || inRiver(x, z, 2.2) || isBlocked(x, z) || rockAt(x, z) > 0.4) continue;
        if (tr() > (rd < 5 ? 0.7 : 0.4)) continue;
        tufts.push({ x, y: gy(x, z) - 0.05, z, ry: tr() * TAU, s: tr.range(0.9, 1.5), sy: tr.range(1.0, 1.7), color: tr.pick(cols) });
        i++;
        if (tr() < 0.07) flowers.push({ x: x + 0.3, y: gy(x, z) + tr.range(0.35, 0.7), z, s: tr.range(0.1, 0.17), color: tr.pick([0xffffff, 0xf6e04a, 0xe84a6a, 0xb07ad8, 0xf2f0a0]) });
      }
      chunked(tuft, K.std({ vertexColors: true, side: T.DoubleSide, roughness: 0.85 }), tufts, { colors: true, cast: false, receive: false }, 90);
      chunked(new T.IcosahedronGeometry(1, 0), K.std({ color: 0xffffff, roughness: 0.6 }), flowers, { colors: true, cast: false, receive: false }, 200);
    }

    // ---------------------------------------------------------------- street lamps, name plates, little people
    {
      const lampP = [], glassP = [];
      lampP.push(colorize(new T.CylinderGeometry(0.32, 0.4, 0.6, 10).translate(0, 0.3, 0), 0xffffff));
      lampP.push(colorize(new T.CylinderGeometry(0.11, 0.15, 4.6, 8).translate(0, 2.8, 0), 0xffffff));
      lampP.push(colorize(new T.CylinderGeometry(0.42, 0.28, 0.16, 6).translate(0, 5.1, 0), 0xffffff));
      lampP.push(colorize(new T.ConeGeometry(0.5, 0.5, 6).translate(0, 6.15, 0), 0xffffff));
      lampP.push(colorize(new T.SphereGeometry(0.1, 6, 4).translate(0, 6.45, 0), 0xffffff));
      glassP.push(colorize(new T.CylinderGeometry(0.42, 0.3, 0.75, 6).translate(0, 5.55, 0), 0xffe6b0));
      const lampGeo = merge(lampP), glassGeo = merge(glassP);
      const lamps = [];
      const skip = (s) => [S.br1, S.br2, S.br3, S.ford, S.bock].some((b) => Math.abs(sDist(b, s)) < 13) || (elevated(s) && roadG[track.idx(s)] < PL.h - 0.5);
      let side = 1;
      for (let s = 6; s < L - 4; s += 17) {
        if (skip(s)) continue;
        side = -side;
        const k = track.at(s).curv;
        const kk = [k, track.at(s + 8).curv, track.at(s - 8).curv].reduce((m, v) => (Math.abs(v) > Math.abs(m) ? v : m), 0);
        const bend = Math.abs(kk) > 1 / 55;
        if (bend && kk * side < 0) continue; // never on the outside of a bend, where cars run wide
        const p = track.place(s, side * (W / 2 + (bend ? 3.3 : 2.6))), y = roadG[track.idx(s)]; // further out on the inside (apexes)
        if (isBlocked(p.x, p.z, 0.2) || inRiver(p.x, p.z, 1.5) || PLAZA.some(([px, pz, pr]) => Math.hypot(p.x - px, p.z - pz) < pr)) continue;
        lamps.push({ x: p.x, y, z: p.z, ry: r() * TAU, color: 0x23332c });
        K.circle(p.x, p.z, 0.35, y + 6);
        AO(p.x, p.z, 0.7, 0.7, 0.4, 0, y);
      }
      K.instances(lampGeo, vcSatin, lamps, { colors: true });
      K.instances(glassGeo, glowMat, lamps.map((l) => ({ ...l, color: 0xfff0c8 })), { colors: true, cast: false });
      // blue enamel street-name plates on posts
      const NAMES = ['Grund', 'Rue Münster', 'Neimënster', 'Montée du Rham', 'Plateau du Rham', 'Clausen', 'Rives de Clausen', 'Bock'];
      const atlas = TX.labelTexture(256, 64 * NAMES.length, (g) => {
        NAMES.forEach((txt, k) => {
          const y0 = k * 64;
          g.fillStyle = '#1d4f9a'; g.fillRect(0, y0, 256, 64);
          g.strokeStyle = '#f4f2ea'; g.lineWidth = 5; g.strokeRect(6, y0 + 6, 244, 52);
          g.fillStyle = '#f4f2ea'; g.font = `700 ${txt.length > 13 ? 26 : 30}px Rubik, Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 128, y0 + 34);
        });
      });
      const plateMat = K.std({ map: atlas, roughness: 0.35, metalness: 0.1 });
      const plate = (txt, x, z, ry, y = 0) => {
        const k = NAMES.indexOf(txt), fr = frame(x, y, z, ry);
        fr(new T.CylinderGeometry(0.09, 0.09, 3.6, 6), 0x2a2a2a, { y: 1.8 });
        fr(new T.BoxGeometry(3.1, 0.85, 0.08), 0x1d4f9a, { y: 3.2 });
        const pg = new T.PlaneGeometry(3.0, 0.75); const uvA = pg.attributes.uv;
        for (let i = 0; i < uvA.count; i++) uvA.setXY(i, uvA.getX(i), 1 - (k + 1 - uvA.getY(i)) / NAMES.length);
        fr(pg, 0xffffff, { y: 3.2, z: 0.05 }, plateMat, false);
        K.circle(x, z, 0.3, y + 4);
      };
      const signAt = (txt, s, side) => {
        const p = track.place(s, side * (W / 2 + 2.8)), y = roadG[track.idx(s)];
        if (isBlocked(p.x, p.z, 0)) return;
        plate(txt, p.x, p.z, 0, y);
      };
      signAt('Grund', S.start + 12, -1);
      signAt('Rue Münster', S.br2 + 18, -1);
      signAt('Neimënster', S.br3 - 14, 1);
      signAt('Montée du Rham', S.r1a - 8, -1);
      signAt('Plateau du Rham', S.r2b + 10, 1);
      signAt('Clausen', S.r3b + 7, -1);
      signAt('Rives de Clausen', S.via2 + 14, -1);
      signAt('Bock', S.bock + 16, 1);
      // a ford warning sign (red triangle with waves) on both approaches
      const warn = TX.labelTexture(128, 128, (g) => {
        g.fillStyle = '#f4f2ea'; g.beginPath(); g.moveTo(64, 6); g.lineTo(122, 116); g.lineTo(6, 116); g.closePath(); g.fill();
        g.strokeStyle = '#c8241e'; g.lineWidth = 12; g.lineJoin = 'round'; g.beginPath(); g.moveTo(64, 12); g.lineTo(116, 110); g.lineTo(12, 110); g.closePath(); g.stroke();
        g.strokeStyle = '#1d4f9a'; g.lineWidth = 6; for (const y of [74, 90]) { g.beginPath(); for (let x = 36; x <= 92; x += 2) g.lineTo(x, y + Math.sin(x * 0.3) * 4); g.stroke(); }
      });
      const wm = K.std({ map: warn, transparent: true, alphaTest: 0.4, roughness: 0.4, side: T.DoubleSide });
      for (const e of [-1, 1]) {
        const s = S.ford + e * 15, p = track.place(s, -(W / 2 + 2.8) * e);
        prop(new T.CylinderGeometry(0.09, 0.09, 3.8, 6), 0x2a2a2a, { x: p.x, y: 1.9, z: p.z });
        K.mesh(new T.PlaneGeometry(1.6, 1.6), wm, p.x, 3.6, p.z, { ry: Math.atan2(-p.tx * e, -p.tz * e) });
        K.circle(p.x, p.z, 0.3, 4);
      }
      // H0-ish figures: on the pavements, the café terraces, the cloister, the bridges and the plateau
      const bodyP = [];
      bodyP.push(colorize(new T.CylinderGeometry(0.2, 0.17, 0.95, 8).translate(0, 0.48, 0), 0x3e4250));
      bodyP.push(colorize(new T.CylinderGeometry(0.27, 0.22, 0.75, 8).translate(0, 1.32, 0), 0xffffff));
      for (const e of [-1, 1]) bodyP.push(colorize(new T.CylinderGeometry(0.07, 0.07, 0.7, 6).translate(e * 0.3, 1.3, 0), 0xffffff));
      const figGeo = merge(bodyP), headGeo = new T.SphereGeometry(0.17, 10, 8).translate(0, 1.87, 0);
      const sitGeo = merge([colorize(new T.CylinderGeometry(0.26, 0.22, 0.75, 8).translate(0, 0.95, 0), 0xffffff), colorize(new T.BoxGeometry(0.42, 0.18, 0.6).translate(0, 0.52, 0.2), 0x3e4250)]);
      const shirt = [0xc83a2a, 0x2a5aa8, 0xe8c84a, 0x3a8a4a, 0xf2f0ea, 0x8a3a8a, 0xd87a2a, 0x3a3a3a, 0x6ab0d8];
      const skin = [0xe8b896, 0xd8a07a, 0xf0c8a8, 0xa8704a];
      const people = [], heads = [];
      const person = (x, z, y = null, a = r() * TAU) => { const yy = y ?? Math.max(0, gy(x, z)); people.push({ x, y: yy, z, ry: a, s: r.range(0.95, 1.08), color: r.pick(shirt) }); heads.push({ x, y: yy, z, ry: a, s: 1, color: r.pick(skin) }); };
      for (let i = 0; i < 260 && people.length < 46; i++) {
        const s = r() * L, side = r() < 0.5 ? -1 : 1, p = track.place(s, side * (W / 2 + r.range(1.4, 2.6)));
        if (elevated(s) && roadG[track.idx(s)] < PL.h - 0.5) continue;
        if (isBlocked(p.x, p.z, 0.2) || inRiver(p.x, p.z, 1.6) || roadD(p.x, p.z) < 0.9) continue;
        person(p.x, p.z, roadG[track.idx(s)]);
      }
      const [ccx, ccz, ci] = A.cloister;
      for (let k = 0; k < 6; k++) person(ccx + r.range(-ci + 1, ci - 1), ccz + r.range(-ci + 1, ci - 1), 0.05);
      for (const [x, z] of [[-74, -4.5], [-69, -4], [-60, 4]]) person(x, z);
      for (const [x, z] of strollers) person(x, z, 0.04);
      const sitters = terrace.sitters.map(([x, z, y, a]) => ({ x, y, z, ry: a, s: 1, color: r.pick(shirt) }));
      K.instances(figGeo, vcSatin, people, { colors: true });
      K.instances(sitGeo, vcSatin, sitters, { colors: true });
      K.instances(headGeo, K.std({ color: 0xffffff, roughness: 0.6 }), heads.concat(sitters.map((q) => ({ ...q, y: q.y - 0.5, color: r.pick(skin) }))), { colors: true });
      // café furniture (instanced)
      const tableGeo = merge([colorize(new T.CylinderGeometry(0.55, 0.55, 0.07, 14).translate(0, 0.92, 0), 0xf2efe8), colorize(new T.CylinderGeometry(0.05, 0.05, 0.9, 6).translate(0, 0.45, 0), 0x2a2a2a), colorize(new T.CylinderGeometry(0.28, 0.28, 0.04, 10).translate(0, 0.02, 0), 0x2a2a2a)]);
      const chairGeo = merge([colorize(new T.BoxGeometry(0.45, 0.06, 0.45).translate(0, 0.5, 0), 0xffffff), colorize(new T.BoxGeometry(0.45, 0.55, 0.06).translate(0, 0.78, -0.2), 0xffffff), colorize(new T.BoxGeometry(0.05, 0.5, 0.05).translate(0.18, 0.25, 0.18), 0xffffff), colorize(new T.BoxGeometry(0.05, 0.5, 0.05).translate(-0.18, 0.25, 0.18), 0xffffff)]);
      const shadeGeo = merge([colorize(new T.ConeGeometry(1.6, 0.6, 8, 1, true).translate(0, 2.55, 0), 0xffffff), colorize(new T.CylinderGeometry(0.04, 0.04, 2.5, 5).translate(0, 1.25, 0), 0xd8d8d8)]);
      K.instances(tableGeo, vcSatin, terrace.tables, { colors: false });
      K.instances(chairGeo, vc, terrace.chairs, { colors: true });
      K.instances(shadeGeo, K.std({ vertexColors: true, roughness: 0.75, side: T.DoubleSide }), terrace.shades, { colors: true });
      for (const t of terrace.tables) AO(t.x, t.z, 1.1, 1.1, 0.3, 0, t.y);
    }

    // ---------------------------------------------------------------- the model-maker's glue: a brush left on the plateau, PVA spilt over the road
    {
      const p = GLUE.p;
      const glue = K.phys({ color: 0xece8de, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity: 0.8, sheen: 0.5, sheenColor: new T.Color(0xffffff) });
      const sp = K.spill(p.x, p.z, 4.6, glue, { lump: 0.4, stretch: 1.6, angle: p.angle, y: PL.h + 0.12, thick: 0.22 });
      K.surface('sticky', { poly: sp.poly });
      for (let i = 1; i < 5; i++) K.spill(p.x + r.range(-1.5, 1.5) + i * 0.6, p.z + 5 + i * 2.2, r.range(0.6, 1.2), glue, { y: PL.h + 0.1, thick: 0.15, n: 18 });
      // the brush: wooden handle, crimped ferrule, white bristles tipped with glue
      const { bx, bz, ba } = GLUE;
      const fb = frame(bx, PL.h + 0.75, bz, ba);
      fb(new T.CylinderGeometry(0.62, 0.45, 15, 16).rotateZ(PI / 2), 0xb83a2a, { x: -6 }, vcSatin);
      fb(new T.CylinderGeometry(0.68, 0.62, 3.2, 16).rotateZ(PI / 2), 0xd8d8dc, { x: 3.1 }, vcMetal);
      fb(new T.CylinderGeometry(0.9, 0.66, 3.4, 16).rotateZ(PI / 2), 0xf0e8d8, { x: 6.4, sy: 0.7 }, vc);
      K.capsule(bx - Math.cos(ba) * 13, bz + Math.sin(ba) * 13, bx + Math.cos(ba) * 7, bz - Math.sin(ba) * 7, 0.8, PL.h + 1.6);
      AO(bx - 3, bz, 11, 1.6, 0.4, -ba, PL.h);
    }

    // ---------------------------------------------------------------- the diorama board, the hobby table and its cutting mat
    {
      const edgeTop = (x, z) => {
        if (inRiver(x, z, 0.2)) return rivBed(rivA(x, z)) - 0.3;
        return Math.max(-0.4, gy(x, z));
      };
      const fasciaMat = K.phys({ color: 0x3a261a, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3 });
      const sides = [
        { a: BOUNDS.minX - 1.2, b: BOUNDS.maxX + 1.2, at: (u) => [u, BOUNDS.maxZ], place: (g) => g.translate(0, 0, BOUNDS.maxZ) },
        { a: BOUNDS.minX - 1.2, b: BOUNDS.maxX + 1.2, at: (u) => [u, BOUNDS.minZ], place: (g) => g.translate(0, 0, BOUNDS.minZ - 1.2) },
        { a: BOUNDS.minZ, b: BOUNDS.maxZ, at: (u) => [BOUNDS.maxX, u], place: (g) => { g.rotateY(-PI / 2); g.translate(BOUNDS.maxX, 0, 0); } },
        { a: BOUNDS.minZ, b: BOUNDS.maxZ, at: (u) => [BOUNDS.minX, u], place: (g) => { g.rotateY(-PI / 2); g.translate(BOUNDS.minX - 1.2, 0, 0); } },
      ];
      for (const sd of sides) {
        const sh = new T.Shape();
        sh.moveTo(sd.a, TABLE_Y); sh.lineTo(sd.b, TABLE_Y);
        for (let u = sd.b; u >= sd.a - 0.01; u -= 1) { const [x, z] = sd.at(clamp(u, sd.a + 1.2, sd.b - 1.2)); sh.lineTo(u, edgeTop(clamp(x, BOUNDS.minX + 0.3, BOUNDS.maxX - 0.3), clamp(z, BOUNDS.minZ + 0.3, BOUNDS.maxZ - 0.3)) + 0.05); }
        sh.closePath();
        const g = new T.ExtrudeGeometry(sh, { depth: 1.2, bevelEnabled: false });
        sd.place(g);
        const m = new T.Mesh(g, fasciaMat); m.receiveShadow = true; m.castShadow = true; K.group.add(m);
      }
      // resin edges where the Alzette runs off the board (the water seen in section)
      const secMat = K.phys({ color: 0x2c4c40, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.92 });
      for (const [x, z, ry] of [[BOUNDS.maxX + 0.02, -37.5, PI / 2], [-75.3, BOUNDS.maxZ + 0.02, 0]]) {
        const d = rivA(clamp(x, BOUNDS.minX, BOUNDS.maxX - 0.5), clamp(z, BOUNDS.minZ, BOUNDS.maxZ - 0.5)), hw = rivHW(d), b = rivBed(d) - 0.3, wl = rivWL(d);
        K.mesh(new T.PlaneGeometry(hw * 2, wl - b), secMat, x, (wl + b) / 2, z, { ry, cast: false });
      }
      // hobby table: a pale beech worktop far larger than the board
      const beech = TX.woodTextures({ size: 256, seed: 31, planks: 6, base: 0xc8a272, dark: 0x9a7448, light: 0xe0c094, ringFreq: 14, gap: 0.003, roughBase: 0.55 });
      for (const t of Object.values(beech)) t.repeat.set(4, 3);
      K.mesh(new T.BoxGeometry(760, 4, 560), K.std({ map: beech.map, normalMap: beech.normalMap, roughnessMap: beech.roughnessMap, normalScale: V2(0.5) }), 0, TABLE_Y - 2, 0, { cast: false });
      // green self-healing cutting mat with a printed grid under and around the board
      const MW = 430, MD = 300;
      const c = TX.makeCanvas(1024, 714), g = c.getContext('2d');
      g.fillStyle = '#2f6a4c'; g.fillRect(0, 0, 1024, 714);
      const px = 1024 / MW;
      for (let i = 0; i * 2.5 < MW; i++) { const x = i * 2.5 * px; g.fillStyle = i % 4 ? 'rgba(200,232,210,0.35)' : 'rgba(236,248,236,0.7)'; g.fillRect(x, 0, i % 4 ? 1 : 2, 714); }
      for (let i = 0; i * 2.5 < MD; i++) { const y = i * 2.5 * px; g.fillStyle = i % 4 ? 'rgba(200,232,210,0.35)' : 'rgba(236,248,236,0.7)'; g.fillRect(0, y, 1024, i % 4 ? 1 : 2); }
      g.strokeStyle = 'rgba(240,220,90,0.8)'; g.lineWidth = 2;
      for (const a of [0.25, 0.5, 0.75]) { g.beginPath(); g.moveTo(0, 714 * a); g.lineTo(1024, 714 * a); g.stroke(); g.beginPath(); g.moveTo(1024 * a, 0); g.lineTo(1024 * a, 714); g.stroke(); }
      g.strokeStyle = 'rgba(236,248,236,0.55)'; g.lineWidth = 1.5;
      for (let a = 0; a < 4; a++) { g.beginPath(); g.moveTo(40, 674 - a * 60); g.lineTo(40 + 160 + a * 60, 674); g.stroke(); } // 30/45/60 degree guides
      g.fillStyle = 'rgba(236,248,236,0.8)'; g.font = '12px Rubik, Arial'; g.textAlign = 'center';
      for (let i = 0; i * 10 < MW; i++) { g.fillText(String(i), i * 10 * px + 2, 12); g.fillText(String(i), i * 10 * px + 2, 708); }
      g.font = '700 22px Rubik, Arial'; g.textAlign = 'left'; g.fillText('SELF HEALING  ·  A2  ·  mm / cm', 700, 692);
      const mat = K.std({ map: TX.toTexture(c, { wrap: false }), roughness: 0.82 });
      K.mesh(new T.BoxGeometry(MW, 0.25, MD), mat, 0, TABLE_Y + 0.12, -3, { cast: false });
      // a brass plaque on the front of the board
      const plq = TX.labelTexture(512, 96, (g2) => {
        const gr = g2.createLinearGradient(0, 0, 0, 96); gr.addColorStop(0, '#e8c87a'); gr.addColorStop(0.5, '#c89a44'); gr.addColorStop(1, '#a87a2a');
        g2.fillStyle = gr; g2.fillRect(0, 0, 512, 96);
        g2.strokeStyle = '#6a4a1a'; g2.lineWidth = 4; g2.strokeRect(8, 8, 496, 80);
        g2.fillStyle = '#3a2a10'; g2.font = '700 34px Georgia, serif'; g2.textAlign = 'center'; g2.fillText('Grund & Clausen', 256, 50);
        g2.font = 'italic 20px Georgia, serif'; g2.fillText('Luxembourg  ·  scale 1:100', 256, 76);
      });
      K.mesh(new T.PlaneGeometry(26, 4.9), K.std({ map: plq, roughness: 0.3, metalness: 0.75 }), -30, -2.6, BOUNDS.maxZ + 1.22, { cast: false });
      const MY = TABLE_Y + 0.25; // top of the cutting mat
      // model paint tins (generic enamels): little round tins with coloured lids and printed labels
      const tinLabel = TX.labelTexture(256, 64, (g2) => {
        g2.fillStyle = '#f2efe6'; g2.fillRect(0, 0, 256, 64);
        g2.fillStyle = '#1e2a4a'; g2.fillRect(0, 0, 256, 14); g2.fillRect(0, 50, 256, 14);
        g2.fillStyle = '#1e2a4a'; g2.font = '700 20px Rubik, Arial'; g2.textAlign = 'center';
        g2.fillText('MODEL ENAMEL', 64, 40); g2.fillText('MATT  14 ml', 192, 40);
      });
      const tinSide = K.std({ map: tinLabel, roughness: 0.4, metalness: 0.3 });
      const tins = [[-36, 106, 0xb8282a], [-31.5, 108.5, 0x3a6a2e], [-37.5, 111, 0x8a8a8a], [-28, 105.5, 0xd8b030], [-32.5, 113, 0x6a4a2e], [118, 108, 0x2a4a8a], [122.5, 110, 0x4a7a3a], [-182, 30, 0xe8e2d4], [-184, 36, 0x5a6066]];
      for (const [x, z, c] of tins) {
        prop(new T.CylinderGeometry(1.75, 1.75, 2.3, 28, 1, true), 0xffffff, { x, y: MY + 1.15, z, ry: r() * TAU }, tinSide);
        prop(new T.CylinderGeometry(1.82, 1.82, 0.3, 28), c, { x, y: MY + 2.42, z }, vcMetal);
        AO(x, z, 2.4, 2.4, 0.45, 0, MY - 0.05);
      }
      // dabs of paint on a palette lid
      prop(new T.CylinderGeometry(2.6, 2.6, 0.2, 28), 0xd8dade, { x: -22, y: MY + 0.1, z: 110 }, vcMetal);
      for (const [dx, dz, c] of [[0.8, 0.4, 0x3a6a2e], [-0.9, -0.3, 0xe8e2d4], [0.1, -1.1, 0xb8282a]]) prop(new T.SphereGeometry(0.62, 14, 6, 0, TAU, 0, PI / 2), c, { x: -22 + dx, y: MY + 0.2, z: 110 + dz, sy: 0.25 }, vcSatin);
      // tweezers, a craft knife and a fine brush lying by the front edge
      for (const e of [-1, 1]) prop(new T.BoxGeometry(12, 0.14, 0.62), 0xd8dade, { x: 22 - Math.sin(0.25) * e * 0.45, y: MY + 0.2, z: 107 + Math.cos(0.25) * e * 0.45, ry: 0.25 + e * 0.035 }, vcMetal);
      AO(22, 107, 6.5, 1.2, 0.3, -0.25, MY - 0.05);
      const fk = frame(52, MY + 0.45, 109, -0.4);
      fk(new T.CylinderGeometry(0.42, 0.42, 11, 12).rotateZ(PI / 2), 0x9aa0a8, {}, vcMetal);
      fk(new T.BoxGeometry(2.4, 0.06, 0.55), 0xd8dade, { x: 6.6 }, vcMetal);
      fk(new T.CylinderGeometry(0.5, 0.5, 0.9, 12).rotateZ(PI / 2), 0x2a2a2a, { x: 5.2 }, vcMetal);
      AO(52, 109, 7, 0.9, 0.3, 0.4, MY - 0.05);
      const brush = (x, z, ry, len = 17, col = 0x1e3a6a) => {
        const fb2 = frame(x, MY + 0.35, z, ry);
        fb2(new T.CylinderGeometry(0.32, 0.2, len, 12).rotateZ(PI / 2), col, { x: -len / 2 }, vcSatin);
        fb2(new T.CylinderGeometry(0.34, 0.3, 1.8, 12).rotateZ(PI / 2), 0xc8b070, { x: 0.9 }, vcMetal);
        fb2(new T.ConeGeometry(0.3, 1.6, 10).rotateZ(-PI / 2), 0x3a2a1e, { x: 2.6 }, vc);
        AO(x - (len / 2) * Math.cos(ry), z + (len / 2) * Math.sin(ry), len / 2 + 2, 0.8, 0.3, ry, MY - 0.05);
      };
      brush(-96, 108, 0.1); brush(-60, 112, -0.25, 14, 0x8a2a1e); brush(176, 40, 1.4, 15, 0x2a5a3a);
      // a PVA glue bottle and a jar of brushes in water at the west end
      const bottle = K.lathe([[2.2, 0], [2.4, 0.4], [2.4, 7.2], [1.9, 8.2], [0.9, 8.8], [0.9, 9.4]], 32);
      prop(bottle, 0xf4f2ea, { x: -150, y: MY, z: 112 }, vcSatin);
      prop(new T.ConeGeometry(0.85, 2.4, 20), 0xe86a1a, { x: -150, y: MY + 10.6, z: 112 }, vcSatin);
      K.mesh(new T.CylinderGeometry(2.42, 2.42, 3.6, 32, 1, true), K.std({ map: TX.labelTexture(256, 64, (g2) => { g2.fillStyle = '#2a6aa8'; g2.fillRect(0, 0, 256, 64); g2.fillStyle = '#fff'; g2.font = '700 26px Rubik, Arial'; g2.textAlign = 'center'; g2.fillText('WOOD & PVA', 128, 32); g2.font = '16px Rubik, Arial'; g2.fillText('dries clear', 128, 54); }), roughness: 0.5 }), -150, MY + 3.9, 112, { ry: 0.5 });
      AO(-150, 112, 3.2, 3.2, 0.45, 0, MY - 0.05);
      // open glue pots with a brush standing in them (front left and by the east edge)
      const potLabel = K.std({ map: TX.labelTexture(256, 64, (g2) => { g2.fillStyle = '#f4f2ea'; g2.fillRect(0, 0, 256, 64); g2.fillStyle = '#c8302e'; g2.fillRect(0, 0, 256, 12); g2.fillRect(0, 52, 256, 12); g2.fillStyle = '#2a2a2a'; g2.font = '700 22px Rubik, Arial'; g2.textAlign = 'center'; g2.fillText('HOBBY GLUE', 64, 40); g2.fillText('HOBBY GLUE', 192, 40); }), roughness: 0.45 });
      const potWet = K.phys({ color: 0xf8f6f0, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05 });
      const pot = K.lathe([[2.4, 0], [2.6, 0.3], [2.65, 3.1], [2.85, 3.25], [2.85, 3.5], [2.45, 3.5], [2.4, 0.4], [0, 0.35]], 32);
      for (const [gx, gz, a] of [[-46, 106.5, 0.5], [176, -60, 2.2]]) {
        prop(pot, 0xf0eee8, { x: gx, y: MY, z: gz }, vcSatin);
        K.mesh(new T.CylinderGeometry(2.67, 2.67, 1.9, 32, 1, true), potLabel, gx, MY + 1.65, gz, { ry: a });
        K.mesh(new T.CircleGeometry(2.42, 28), potWet, gx, MY + 2.7, gz, { rx: -PI / 2, cast: false });
        const ca = Math.cos(a), sa = Math.sin(a);
        prop(new T.CylinderGeometry(0.3, 0.22, 12, 10), 0x1e3a6a, { x: gx + ca * 1.9, y: MY + 7.6, z: gz + sa * 1.9, rx: sa * 0.32, rz: -ca * 0.32 }, vcSatin);
        prop(new T.CylinderGeometry(0.33, 0.3, 1.6, 10), 0xc8b070, { x: gx + ca * 0.7, y: MY + 2.6, z: gz + sa * 0.7, rx: sa * 0.32, rz: -ca * 0.32 }, vcMetal);
        AO(gx, gz, 3.4, 3.4, 0.45, 0, MY - 0.05);
      }
      const jar = K.lathe([[2.9, 0], [3.1, 0.3], [3.1, 7.5], [3.3, 7.8], [3.0, 7.9], [2.85, 7.6], [2.85, 0.5], [0, 0.4]], 32);
      K.mesh(jar, K.glass(0xeef4f6, 0.22), -186, MY, -36, { cast: false });
      K.mesh(new T.CylinderGeometry(2.8, 2.8, 4.2, 28), K.liquid(0x9aa8a0, { transparent: true, opacity: 0.55 }), -186, MY + 2.5, -36);
      for (const [dx, dz, rx, rz, c] of [[0.8, 0.4, 0.18, -0.22, 0x1e3a6a], [-0.9, 0.6, -0.15, 0.2, 0x8a2a1e], [0.2, -1, 0.25, 0.1, 0x2a5a3a], [-0.4, -0.2, -0.05, -0.12, 0xd8b030]]) {
        prop(new T.CylinderGeometry(0.28, 0.18, 16, 10), c, { x: -186 + dx, y: MY + 8, z: -36 + dz, rx, rz }, vcSatin);
      }
      AO(-186, -36, 3.8, 3.8, 0.45, 0, MY - 0.05);
      // a steel rule along the east edge and a box of static grass flock
      const rule = TX.labelTexture(1024, 64, (g2) => { g2.fillStyle = '#cfd3d8'; g2.fillRect(0, 0, 1024, 64); g2.fillStyle = '#1a1a1a'; for (let i = 0; i <= 300; i++) { const x = 8 + i * 3.36; g2.fillRect(x, 0, 1.2, i % 10 ? (i % 5 ? 12 : 18) : 26); if (i % 10 === 0) { g2.font = '12px Rubik, Arial'; g2.fillText(String(i / 10), x + 2, 42); } } });
      prop(new T.BoxGeometry(31, 0.12, 2.6), 0xd8dade, { x: 178, y: MY + 0.06, z: -18, ry: PI / 2 - 0.08 }, vcMetal);
      K.mesh(new T.PlaneGeometry(31, 2.6), K.std({ map: rule, roughness: 0.35, metalness: 0.6 }), 178, MY + 0.125, -18, { rx: -PI / 2, cast: false }).rotation.set(-PI / 2, 0, PI / 2 - 0.08);
      AO(178, -18, 1.8, 16, 0.3, -0.08, MY - 0.05);
      const fq = K.rng(62), flk = TX.labelTexture(256, 128, (g2) => { g2.fillStyle = '#6a9a3a'; g2.fillRect(0, 0, 256, 128); for (let i = 0; i < 400; i++) { g2.fillStyle = `rgba(${40 + fq() * 60 | 0},${90 + fq() * 70 | 0},${30 + fq() * 30 | 0},0.8)`; g2.fillRect(fq() * 256, fq() * 128, 2, 4); } g2.fillStyle = '#f4f2ea'; g2.fillRect(20, 30, 216, 52); g2.fillStyle = '#2a4a1e'; g2.font = '700 28px Rubik, Arial'; g2.textAlign = 'center'; g2.fillText('STATIC GRASS', 128, 64); g2.font = '16px Rubik, Arial'; g2.fillText('spring meadow · 4 mm', 128, 100); });
      prop(new T.BoxGeometry(7, 4.5, 4.4), 0x5a8a32, { x: 182, y: MY + 2.25, z: 22, ry: 0.3 }, vc);
      const flm = K.std({ map: flk, roughness: 0.7 });
      K.mesh(new T.PlaneGeometry(7, 4.4), flm, 182, MY + 4.52, 22, { rx: -PI / 2, cast: false }).rotation.set(-PI / 2, 0, 0.3);
      K.mesh(new T.PlaneGeometry(7, 4.5), flm, 182 + Math.sin(0.3) * 2.21, MY + 2.25, 22 + Math.cos(0.3) * 2.21, { ry: 0.3, cast: false });
      AO(182, 22, 4.6, 3.4, 0.4, -0.3, MY - 0.05);
      // spilt flock and offcuts
      const sc = [];
      for (let i = 0; i < 90; i++) { const x = 168 + r.range(4, 22), z = r.range(14, 34); sc.push({ x, y: MY + 0.1, z, s: r.range(0.12, 0.3), color: r.pick([0x6a9a3a, 0x8aaa4a, 0x4a7a2a]) }); }
      for (let i = 0; i < 60; i++) { const x = r.range(-60, 60), z = 102 + r.range(1.5, 14); sc.push({ x, y: MY + 0.08, z, s: r.range(0.1, 0.22), color: r.pick([0xd8c8a8, 0x9a8a72, 0x6a9a3a]) }); }
      K.instances(new T.IcosahedronGeometry(1, 0), K.std({ color: 0xffffff, roughness: 0.9 }), sc, { colors: true, cast: false });
      // the workshop floor far below the table
      K.mesh(new T.PlaneGeometry(2400, 2400), K.std({ color: 0x3a3430, roughness: 0.9 }), 0, -76, 0, { rx: -PI / 2, cast: false });
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
      // merge the remaining loose static meshes per material and area (fewer draw calls)
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
    void isBlocked; void block; void local; void warnRoad; void frame; void glowMat; void vcMetal; void chunked; void n2; void Track;
  },

  tick(dt, time, game) {
    if (!A) return;
    // a grid slot or respawn inside a ramp footprint at table level: lift the car onto the surface
    for (const e of game.cars) {
      const c = e.car;
      if (e.out || c.state !== 'drive' || c.airborne || c.speed > 4) continue;
      const g = game.physics.groundAt(c.x, c.z).g;
      if (g > c.y + 0.85) c.y = g;
    }
    // ---- the tourist road-train on the Rives: CPU drivers keep to the left lane past it, and follow it
    // (waiting for a gap) when they are stuck behind it with another car alongside
    const R = A.rt;
    if (!R || !R.mS) return;
    // at a race start, time the first trip so the train is out on the Rives ~4 s before the leaders get there
    if (game.state === 'countdown' && game.countFull && game.countT > 3.0 && !A.rtSynced) { R.t0 = time + game.countT - 0.9; A.rtSynced = true; }
    if (game.state !== 'countdown') A.rtSynced = false;
    const head = roadTrainHead(time), Lt = R.L, Lr = A.L, s0 = A.S.rivesA;
    const rel = (s) => { const d = (((s - s0) % Lr) + Lr) % Lr; return d > Lr - 80 ? d - Lr : d; };
    let rear = 1e9, front = -1e9, latMin = 99;
    for (let i = 0; i < RTRAIN.lens.length; i++) {
      const hs = head - R.off[i];
      for (let f = 0; f <= 2; f++) {
        const q = hs - (RTRAIN.lens[i] * f) / 2, k = Math.round((((q % Lt) + Lt) % Lt) / R.mStep) % R.mN;
        if (!R.mNear[k]) continue;
        const rs = rel(R.mS[k]);
        if (rs < rear) rear = rs;
        if (rs > front) front = rs;
        if (R.mLat[k] < latMin) latMin = R.mLat[k];
      }
    }
    if (latMin > 50) return;
    const vT = Math.max(0, (head - roadTrainHead(time - 0.1)) / 0.1);
    const safe = latMin - RTRAIN.r - 1.9; // a car centred left of this line clears the train
    for (const e of game.cars) {
      const ai = e.ai || (e.finished ? e.cooldown : null);
      if (!ai || e.out) continue;
      const c = e.car;
      if (c.state !== 'drive' || c.airborne) continue;
      const cs = rel(e.trackS), dRear = rear - cs;
      if (cs > front + 3 || dRear > 50 || cs < -70) continue;
      const lo = ai.lineOffset(e.trackS + 6 + Math.max(0, c.fwdSpeed) * 0.28);
      const tgt = safe - (e.lateral > safe - 1 && dRear < 35 ? 2.4 : 0.8); // aim well left when it's still in the train's lane
      if (lo + ai.avoid > tgt) ai.avoid = tgt - lo;
      if (e.lateral <= safe || dRear < -1.5) continue;
      // still in the train's lane behind it (wide out of the bend, or boxed in): brake only as hard as needed to
      // stay off its tail while the line above takes the car left; close behind it, it waits for the gap
      const vmax = vT + Math.sqrt(2 * 60 * Math.max(0, dRear - 4.5));
      const sp = Math.max(0, c.fwdSpeed);
      if (sp > vmax) { const k = vmax / Math.max(sp, 0.01); c.vx *= k; c.vz *= k; }
      if (sp > vmax || dRear < 8) { e.holdT = 0.3; ai.stuckT = 0; }
    }
  },

  animate(time, dt, game) {
    if (!A) return;
    if (A.water) A.water.offset.set(time * 0.012, -time * 0.05);
    const live = game && (game.state === 'race' || game.state === 'roundEnd' || game.state === 'countdown');
    const snd = game && game.sound && game.sound.ctx && live;
    // ---- railcar on the viaduct
    if (A.railcars) {
      const [c, dir] = railcarHead(time), S = A.rc;
      let off = -S.TL / 2;
      A.railcars.forEach((m, i) => {
        const len = RCAR.lens[i], mid = c + off + len / 2;
        off += len + RCAR.gap;
        const pa = A.railAt(mid + len * 0.3), pb = A.railAt(mid - len * 0.3);
        const vis = mid + len / 2 > S.dA - 1 && mid - len / 2 < S.dB + 1;
        m.visible = vis; A.railShadow[i].visible = vis;
        if (!vis) return;
        const x = (pa.x + pb.x) / 2, z = (pa.z + pb.z) / 2, a = Math.atan2(pa.z - pb.z, pa.x - pb.x);
        m.position.set(x, VIA_H + 0.62, z); m.rotation.set(0, -a, 0);
        const sh = A.railShadow[i]; sh.position.set(x, VIA_H + 0.38, z); sh.rotation.z = -a;
      });
      const mov = dir !== 0;
      if (snd && mov && !A.wasMoving && game.onScreen(A.railAt(c).x, VIA_H, A.railAt(c).z, 0.4)) { game.sound.tone(520, 0.35, { type: 'triangle', vol: 0.035 }); game.sound.tone(660, 0.3, { type: 'triangle', vol: 0.03, when: 0.12 }); }
      A.wasMoving = mov;
    }
    // ---- tourist road-train
    if (A.rtCars) {
      const head = roadTrainHead(time), rt = A.rt.path;
      A.rtCars.forEach((m, i) => {
        const len = RTRAIN.lens[i], sf = head - A.rt.off[i];
        const pa = rt.at(sf - len * 0.2), pb = rt.at(sf - len * 0.8);
        const x = (pa.x + pb.x) / 2, z = (pa.z + pb.z) / 2, a = Math.atan2(pa.z - pb.z, pa.x - pb.x);
        m.position.set(x, 0, z); m.rotation.set(0, -a, 0);
        const sh = A.rtShadow[i]; sh.position.set(x, 0.1, z); sh.rotation.z = -a;
      });
      // warnings: the loco's beacon and the gate lamps flash from 2.5 s before it leaves the depot
      const R = A.rt, u = (((time - R.t0) % R.P) + R.P) % R.P;
      const soon = u < RTRAIN.dwell && u > RTRAIN.dwell - 2.5;
      const out = soon || (head > 0 && head < R.gW + R.TL + 4);
      const blink = Math.floor(time * 3) % 2 === 0;
      A.rtBeacon.material.emissiveIntensity = out && blink ? 3 : 0.1;
      A.gateLamps[0].emissiveIntensity = (soon || (head > 0 && head < R.gE + R.TL + 3)) && blink ? 3.2 : 0;
      A.gateLamps[1].emissiveIntensity = head > R.gW - 26 && head < R.gW + R.TL + 3 && !blink ? 3.2 : 0;
      // a toot when it leaves the gate
      if (snd && head > 0 && A.lastHead === 0) { const p = rt.at(head); if (game.onScreen(p.x, 1, p.z, 0.4)) { game.sound.tone(880, 0.18, { type: 'square', vol: 0.03 }); game.sound.tone(880, 0.22, { type: 'square', vol: 0.03, when: 0.26 }); } }
      A.lastHead = head;
    }
    // ---- the castle bridge turns see-through while a car is under it
    if (A.bockBridge && game && game.cars) {
      let under = false;
      for (const e of game.cars) { if (e.out || !e.car || e.car.state !== 'drive') continue; const d = Math.abs(((((e.trackS - A.bockBridge.s) % A.L) + A.L * 1.5) % A.L) - A.L / 2); if (d < 6) under = true; }
      const fdt = Math.min(0.2, Math.max(dt || 0, time - (A.lastT ?? time))); A.lastT = time;
      A.fade += ((under ? 1 : 0) - A.fade) * (1 - Math.exp(-fdt * (under ? 10 : 3)));
      A.bockBridge.mat.opacity = 1 - 0.62 * A.fade; A.bockBridge.mat2.opacity = 1 - 0.7 * A.fade;
      A.bockBridge.mat.depthWrite = A.fade < 0.4; A.bockBridge.mat2.depthWrite = A.fade < 0.4;
      A.bockBridge.mesh.castShadow = A.fade < 0.4;
    }
  },
};

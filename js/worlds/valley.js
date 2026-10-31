// World: Sandstorm Valley (Pharaoh Cup, table 4 of 4, expert). A large museum diorama of a valley of royal tombs at
// sunset on a display table: layered limestone cliffs along the north edge with dark tomb doorways, a temple built in
// three terraces against them (central ramps, colonnades, statues), a graded desert road through the dunes, a dry
// ravine (the wadi) and the archaeologists' work camp. From the start on the long dune straight the road runs east,
// snakes north through the open dunes, comes back west along an avenue of sphinxes, climbs the temple's three ramps,
// weaves through the ruined colonnade on the top terrace, runs along a narrow ledge under the cliff with the wadi's
// gorge below, drops back to the valley floor and jumps the wadi on the way home.
// Every 21 s a sandstorm sweeps across the table from the east: the camp horn sounds, the light dims, sand snakes along
// the ground ahead of a rolling wall of dust, and while the front passes over a car a strong crosswind pushes it
// sideways (strongest on the open dunes, weaker in the shelter of the cliffs and the temple). The sand drifts it
// leaves on the open road slow you down for a few seconds after it has gone. Raced on rally cars.

const TRACK = [
  [-110, 86], [-40, 87], [30, 87], [92, 86], [128, 78], [148, 58], [152, 36], [145, 15], [149, -5], [140, -21], [122, -30],
  [90, -31], [55, -31], [26, -31], [9, -35], [0, -46], [0, -62], [0, -78], [0, -92], [-3, -100], [-12, -106], [-30, -106, 14.5],
  [-55, -106, 12], [-80, -106, 12], [-105, -106, 12], [-128, -104], [-148, -96], [-158, -78], [-160, -50], [-160, -20],
  [-159, 15], [-155, 48], [-144, 70], [-125, 82],
];
const W = 13.5;
const START = 40;
const BOUNDS = { minX: -182, maxX: 182, minZ: -128, maxZ: 106 };
const PI = Math.PI, TAU = PI * 2, DEG = PI / 180;
// the temple: three terraces against the cliff (height, x range, front z; all reach back to the cliff at BACK),
// climbed on the axis x = 0 by three ramps (front z, top z, base height), each STEP high
const TERR = [{ h: 3, x0: -48, x1: 48, z0: -58 }, { h: 6, x0: -46, x1: 46, z0: -76 }, { h: 9, x0: -50, x1: 50, z0: -94 }];
const RAMPS = [[-46, -58, 0], [-64, -76, 3], [-82, -94, 6]];
const STEP = 3, TOPH = 9, BACK = -118;
// the ledge under the cliff: flat from x0 to xD0, then down to the valley floor at xD1; its inner (cliff) and outer
// (gorge) edges in z
const LEDGE = { x0: -50, xD0: -66, xD1: -116, z: -106, zIn: -113.8, zOut: -99.4 };
// the wadi: a dry ravine from the temple's west flank, under the ledge, then south-west across the west straight
const WADI = [[-50, -93], [-72, -93], [-94, -92.5], [-106, -84], [-113, -68], [-118, -50], [-128, -38], [-145, -31], [-165, -28], [-188, -26]];
const JUMP = { len: 9, h: 2.3, runUp: 38 };
// the sandstorm: cycle (s), first warning after GO, warning before the front reaches the east edge (xE), camp horn,
// front speed, band (wind builds over `a` units behind the front, holds to `b`, gone at `c`), wind (displacement in
// units/s on open ground), its direction, the share of it along the car's heading, streamers ahead of the front
const STORM = { P: 21, first: 2, warn: 3.5, horn: 0.3, V: 38, xE: 192, a: 7, b: 52, c: 92, S: 12, dir: [-0.94, 0.34], along: 0.38, ahead: 70 };
// sand drifts the storm leaves on the open road: near (x, z), side of the road, radius
const DRIFTS = [[-15, 87, 1, 3.7], [72, 87, -1, 3.7], [150, 28, -1, 3.5], [146, -12, 1, 3.4], [-159, 8, 1, 3.6], [-157, 40, -1, 3.6]];
const LIGHT = {
  sunDir: [-0.82, 0.38, 0.42], sunColor: 0xff9e62, sunIntensity: 3.4,
  hemiSky: 0xffb4a8, hemiGround: 0x6a3a34, hemiIntensity: 0.62,
  envIntensity: 0.36, exposure: 1.0, background: 0x1a1315, shadowRadius: 2.4,
  fog: { color: 0xc48a52, near: 600, far: 1600 },
};

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const mod = (a, n) => ((a % n) + n) % n;

let A = null; // runtime state for tick / animate

// ---- the storm clock: a pure function of the time since GO (A.t0 is set when a countdown starts)
const raceT = (t) => t - (A ? A.t0 : 0);
function stormU(t) { const r = raceT(t); return r < STORM.first ? -1 : mod(r - STORM.first, STORM.P); }
function frontX(u) { return u < 0 ? 1e4 : STORM.xE + STORM.V * (STORM.warn - u); }
// the front is not a straight line: bulges roll along it
const bulge = (z, t) => 6 * Math.sin(z * 0.045 + t * 0.6) + 4 * Math.sin(z * 0.11 - t * 0.9);
// wind strength 0..1 at (x, z): builds just behind the front, holds, dies away in the tail
function bandK(x, z, xf, t) {
  const d = x - xf - bulge(z, t);
  if (d <= 0 || d >= STORM.c) return 0;
  return ss(0, STORM.a, d) * (1 - ss(STORM.b, STORM.c, d));
}
// the cliffs and the temple's walls break the wind
function exposure(x, z) {
  let e = 1 - 0.45 * ss(-60, -100, z);
  if (x > -55 && x < 55 && z < -40) e *= 0.6;
  return e;
}
// a sand drift at x: builds once the front has passed, lingers, then blows away (0..1)
function driftAmt(x, t) {
  const r = raceT(t) - STORM.first;
  if (r < 0) return 0;
  const uPass = STORM.warn + (STORM.xE - x) / STORM.V + 0.8;
  const k = Math.floor((r - uPass) / STORM.P);
  if (k < 0) return 0;
  const tau = r - uPass - k * STORM.P;
  return tau < 1.6 ? ss(0, 1.6, tau) : tau < 9 ? 1 : 1 - ss(9, 10.5, tau);
}

export default {
  id: 'valley',
  name: 'Sandstorm Valley',
  blurb: 'Climb the temple terraces, hug the cliff ledge, jump the wadi and ride out the sandstorm.',
  vehicle: 'rally',
  seed: 101,
  track: { points: TRACK, width: W, startS: START },
  // head-to-head restarts move on past the wadi jump
  noGrid() { return A && A.sJ0 != null ? [[A.sJ0 - 14, A.sW + A.hwAlong + 2]] : []; },
  bounds: BOUNDS,
  fallOffEdges: true,
  floorY: -76,
  offCourse: 16,
  offroad: { kind: 'slow', margin: 1.5 },
  skidColor: 0x6b4a2c,
  dustColor: 0xd9b07a,
  dust: {
    normal: { color: 0xd8b07c, size: 1.4, life: 1.1, up: 1.3, grav: 0.4, alpha: 0.26, grow: 2.4, rate: 0.8 },
    slow: { color: 0xe2ba84, size: 1.6, life: 1.3, up: 2.4, grav: 0.8, alpha: 0.42, grow: 2.4, rate: 1.6 },
  },
  lighting: LIGHT,

  async build(K) {
    const { THREE: T, TX, r, track } = K;
    const BU = K.BufferGeometryUtils;
    const L = track.length;
    const V2 = (a, b = a) => new T.Vector2(a, b);
    const lowQ = !!(K.quality && K.quality.tilt === false);
    A = { t0: 0, prevState: null, prevCountT: 0, prevU: null, flashed: false, drifts: [], flags: [], ready: false, lastKc: 0, windT: 0 };
    const sAt = (x, z) => track.distTo(x, z).s;
    const TX0 = BOUNDS.minX, TX1 = BOUNDS.maxX, TZ0 = BOUNDS.minZ, TZ1 = BOUNDS.maxZ;

    // ============================================================ noise
    const NF = TX.noiseField(256, { seed: 101, period: 8, oct: 4 });
    const NF2 = TX.noiseField(256, { seed: 113, period: 16, oct: 3 });
    const bil = (f, x, y) => {
      x = ((x % 256) + 256) % 256; y = ((y % 256) + 256) % 256;
      const x0 = x | 0, y0 = y | 0, x1 = (x0 + 1) & 255, y1 = (y0 + 1) & 255, fx = x - x0, fy = y - y0;
      return (f[y0 * 256 + x0] * (1 - fx) + f[y0 * 256 + x1] * fx) * (1 - fy) + (f[y1 * 256 + x0] * (1 - fx) + f[y1 * 256 + x1] * fx) * fy;
    };
    const n1 = (x, z, sc, o = 0) => bil(NF, x * sc + 37 + o, z * sc + 91 + o * 0.7);
    const n2 = (x, z, sc, o = 0) => bil(NF2, x * sc + 11 + o, z * sc + 53);

    // ============================================================ merging helpers (static parts, per material and 140-unit cell)
    const _q = new T.Quaternion(), _e = new T.Euler(), _v = new T.Vector3(), _s = new T.Vector3(), _c = new T.Color();
    const mtx = (o) => new T.Matrix4().compose(_v.set(o.x || 0, o.y || 0, o.z || 0), _q.setFromEuler(_e.set(o.rx || 0, o.ry || 0, o.rz || 0, o.order || 'YXZ')), _s.set(o.sx ?? o.s ?? 1, o.sy ?? o.s ?? 1, o.sz ?? o.s ?? 1));
    const boxUV = (g, sc) => {
      const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
      for (let i = 0; i < p.count; i++) {
        const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
        let u, v;
        if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); } else if (ax >= az) { u = p.getZ(i); v = p.getY(i); } else { u = p.getX(i); v = p.getY(i); }
        uv[i * 2] = u * sc; uv[i * 2 + 1] = v * sc;
      }
      g.setAttribute('uv', new T.BufferAttribute(uv, 2));
    };
    // geometry with a colour (vertex colours), transformed; `wuv` = box-projected world UVs at that scale
    const prep = (geo, c, M, wuv = 0) => {
      const g = geo.index ? geo.toNonIndexed() : geo.clone();
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
      g.morphAttributes = {};
      if (!g.attributes.normal) g.computeVertexNormals();
      if (M) g.applyMatrix4(M);
      if (wuv) boxUV(g, wuv);
      else if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.attributes.color || c != null) {
        _c.set(c ?? 0xffffff);
        const n = g.attributes.position.count, a = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; }
        g.setAttribute('color', new T.BufferAttribute(a, 3));
      }
      g.clearGroups();
      return g;
    };
    const bins = new Map();
    const put = (geo, c, o, mat, { cast = true, wuv = mat.userData.wuv || 0 } = {}) => {
      const g = prep(geo, c, mtx(o || {}), wuv);
      const x = o?.x ?? 0, z = o?.z ?? 0;
      const key = mat.uuid + (cast ? 'c' : 'n') + Math.floor((x + 420) / 140) + ':' + Math.floor((z + 420) / 140);
      if (!bins.has(key)) bins.set(key, { mat, cast, parts: [] });
      bins.get(key).parts.push(g);
    };
    // a pre-built multi-part geometry (already coloured) placed like put()
    const putG = (geo, o, mat, opts) => put(geo, null, o, mat, opts);
    const flushBins = () => {
      for (const { mat, cast, parts } of bins.values()) {
        const g = BU.mergeGeometries(parts, false);
        if (!g) continue;
        g.computeBoundingSphere();
        const m = new T.Mesh(g, mat); m.castShadow = cast; m.receiveShadow = true;
        K.group.add(m);
      }
      bins.clear();
    };
    // a coloured part list -> one geometry (for statues etc. that are placed many times)
    const parts = (list) => BU.mergeGeometries(list.map(([geo, c, o]) => prep(geo, c, mtx(o || {}))), false);
    const box = (w, h, d) => new T.BoxGeometry(w, h, d);
    const rbox = (w, h, d, rad = 0.2, seg = 2) => new K.RoundedBoxGeometry(w, h, d, seg, Math.min(rad, w / 2.01, h / 2.01, d / 2.01));
    const cyl = (r1, r2, h, seg = 12, open = false) => new T.CylinderGeometry(r1, r2, h, seg, 1, open);
    const sph = (rad, ws = 12, hs = 8) => new T.SphereGeometry(rad, ws, hs);
    // contact shadows: one instanced mesh, opacity in the instance's y scale
    const contacts = [];
    const AO = (x, z, rx, rz = rx, op = 0.4, ang = 0, y = 0.07) => contacts.push({ x, y, z, ry: -ang, sx: rx * 2, sy: op, sz: rz * 2 });
    const canvas = (w, h, draw) => { const c = TX.makeCanvas(w, h); draw(c.getContext('2d'), w, h); return c; };

    // ============================================================ sections of the lap and the road height along it
    const S = {
      A0: sAt(0, RAMPS[0][0]), A1: sAt(0, RAMPS[0][1]), B0: sAt(0, RAMPS[1][0]), B1: sAt(0, RAMPS[1][1]), C0: sAt(0, RAMPS[2][0]), C1: sAt(0, RAMPS[2][1]),
      L0: sAt(LEDGE.x0, LEDGE.z), D0: sAt(LEDGE.xD0, LEDGE.z), D1: sAt(LEDGE.xD1, -105.6),
    };
    const roadY = (s) => {
      if (s < S.A0 || s > S.D1) return 0;
      if (s < S.A1) return STEP * (s - S.A0) / (S.A1 - S.A0);
      if (s < S.B0) return STEP;
      if (s < S.B1) return STEP + STEP * (s - S.B0) / (S.B1 - S.B0);
      if (s < S.C0) return 2 * STEP;
      if (s < S.C1) return 2 * STEP + STEP * (s - S.C0) / (S.C1 - S.C0);
      if (s < S.D0) return TOPH;
      return TOPH * (1 - (s - S.D0) / (S.D1 - S.D0));
    };
    const onStone = (s) => s > S.A0 - 2 && s < S.D1 + 2; // the temple, the ledge and its descent
    const wAt = (s) => track.w[track.idx(s)];
    A.S = S;

    // ============================================================ distance fields (1-unit grid): road, wadi
    const G0X = TX0 - 6, G0Z = TZ0 - 6, GW = Math.ceil(TX1 - TX0) + 13, GH = Math.ceil(TZ1 - TZ0) + 13;
    const RD = new Float32Array(GW * GH).fill(60), RS = new Float32Array(GW * GH), RLAT = new Float32Array(GW * GH);
    for (let i = 0; i < track.N; i += 2) {
      const x = track.x[i], z = track.z[i], hw = track.w[i] / 2, R = hw + 24, R2 = R * R;
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
    // a polyline (centripetal spline, 1-unit spacing) and its distance field
    const lineField = (pts, reach) => {
      const cv = new T.CatmullRomCurve3(pts.map(([x, z]) => new T.Vector3(x, 0, z)), false, 'centripetal');
      const len = cv.getLength(), n = Math.ceil(len);
      const P = cv.getSpacedPoints(n).map((v) => [v.x, v.z]);
      const Tn = P.map((p, i) => { const a = P[Math.max(0, i - 1)], b = P[Math.min(n, i + 1)]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; });
      const step = len / n;
      const D = new Float32Array(GW * GH).fill(reach + 1), DA = new Float32Array(GW * GH);
      for (let i = 0; i <= n; i++) {
        const [x, z] = P[i];
        const gx0 = Math.max(0, Math.floor(x - reach - G0X)), gx1 = Math.min(GW - 1, Math.ceil(x + reach - G0X));
        const gz0 = Math.max(0, Math.floor(z - reach - G0Z)), gz1 = Math.min(GH - 1, Math.ceil(z + reach - G0Z));
        for (let gz = gz0; gz <= gz1; gz++) {
          const dz = gz + G0Z - z, dz2 = dz * dz;
          for (let gx = gx0; gx <= gx1; gx++) {
            const dx = gx + G0X - x, d2 = dx * dx + dz2, k = gz * GW + gx;
            if (d2 >= D[k] * D[k]) continue;
            D[k] = Math.sqrt(d2); DA[k] = i * step;
          }
        }
      }
      const at = (a) => { const i = clamp(Math.round(a / step), 0, n); return { x: P[i][0], z: P[i][1], tx: Tn[i][0], tz: Tn[i][1] }; };
      return { P, Tn, step, len, n, D, DA, at };
    };
    const WF = lineField(WADI, 16);
    const wadiD = (x, z) => gridBil(WF.D, x, z, 99);
    const wadiA = (x, z) => gridN(WF.DA, x, z, 0);
    const wadiHW = (a, x) => lerp(6.4, 4.8, ss(46, 74, a)) * (1 - 0.45 * ss(-166, -180, x));
    const wadiFloor = (a, x) => lerp(lerp(-12, -6.5, ss(40, 85, a)), -0.5, ss(-164, -179, x));

    // ============================================================ terrain height
    // cliff foot line: wavy in the open, straight behind the temple and along the ledge
    const zFoot = (x) => {
      const base = -116.5 + 2.2 * Math.sin(x / 19 + 0.5) + 1.4 * Math.sin(x / 7.3 + 2);
      const kT = ss(-56, -50, x) * ss(56, 50, x), kL = ss(-128, -121, x) * ss(-46, -51, x);
      return lerp(lerp(base, BACK, kT), LEDGE.zIn - 0.1, kL);
    };
    const cliffTop = (x) => 33 + 7 * n1(x, 0, 0.03, 700) + 7 * ss(70, 10, Math.abs(x));
    // layered limestone: three faces with benches between, a ragged top
    const cliffH = (x, z) => {
      const t = zFoot(x) - z;
      if (t < -0.6) return -99;
      const top = cliffTop(x), L1 = top * 0.38, L2 = top * 0.7, w = (n1(x, z, 0.12, 40) - 0.5) * 1.6;
      const y = L1 * ss(-0.5, 1.5, t) + 0.6 * ss(1.5, 3.4, t) + (L2 - L1 - 0.6) * ss(3.4 + w, 5.2 + w, t) + (top - L2) * ss(6.8 + w, 8.6 + w, t);
      return y + (n1(x, z, 0.35, 77) - 0.5) * 1.4 * ss(0, 2, t) + (n2(x, z, 0.5) - 0.5) * 0.8 * ss(0.5, 3, t);
    };
    // dunes: transverse ridges across the east wind, gentle on the windward (east) side, a steep slip face to the west
    const CAMP = { x: 102, z: -76, rx: 50, rz: 30 }, SITE = { x: -82, z: 30, r: 30 }, DIG = { x: 40, z: 28, rx: 30, rz: 16 };
    const ampAt = (x, z) => {
      let a = 0.85 + 2.0 * ss(10, 70, x) * ss(-46, -26, z) + 1.2 * ss(80, 97, z) - 0.6 * ss(-60, -92, z);
      const dc = Math.hypot((x - CAMP.x) / CAMP.rx, (z - CAMP.z) / CAMP.rz), dsit = Math.hypot(x - SITE.x, z - SITE.z) / SITE.r;
      a *= 1 - 0.85 * ss(1.1, 0.7, dc);
      a *= 1 - 0.7 * ss(1.1, 0.6, dsit);
      a *= 1 - 0.85 * ss(1.1, 0.7, Math.hypot((x - DIG.x) / DIG.rx, (z - DIG.z) / DIG.rz));
      return Math.max(0.08, a);
    };
    const DS = { f: 0, amp: 0 };
    const duneH = (x, z) => {
      const w = n1(x, z, 0.03);
      const u = x * 0.96 + z * 0.28 + (w - 0.5) * 30 + (n1(x, z, 0.08, 300) - 0.5) * 8;
      const f = ((u / 17) % 1 + 1) % 1, amp = ampAt(x, z);
      const shape = f < 0.22 ? (f / 0.22) ** 1.5 : (1 - (f - 0.22) / 0.78) ** 1.4;
      DS.f = f; DS.amp = amp;
      return shape * amp * (0.55 + 0.45 * n1(x, z, 0.05, 900)) + (n1(x, z, 0.045, 150) - 0.5) * 0.9;
    };
    const H = (x, z) => {
      let h = duneH(x, z);
      const d = roadD(x, z), s = roadS(x, z);
      if (d < 9 && z < -96 && x < -46 && x > -136 && s > S.L0 - 4 && s < S.D1 + 6) {
        // the ledge: the road and the shelf up to the cliff at road height, an embankment down on the open side
        const y0 = roadY(s);
        if (d < 0.7 || roadLat(x, z) > 0) h = y0;
        else h = Math.max(h * ss(0.7, 8, d), y0 - (d - 0.7) * 1.6);
      } else if (d < 5) h *= ss(0.3, 5, d);
      // the temple's levelled forecourt
      h *= 1 - ss(60, 52, Math.abs(x)) * ss(-36, -44, z);
      const c = cliffH(x, z);
      if (c > h) h = c;
      // the wadi: a ravine with steep walls and a gravel floor
      const wd = wadiD(x, z);
      if (wd < 10 && x < -47) {
        const a = wadiA(x, z), hw = wadiHW(a, x), fl = wadiFloor(a, x) + (wd / hw) ** 2 * 0.9;
        const k = (1 - ss(hw - (z < -96 ? 0.4 : 1.1), hw + (z < -96 ? 0.5 : 1.0), wd)) * ss(-47.5, -50.5, x);
        h = lerp(h, Math.min(h, fl), k);
        if (z > -97) h += 0.35 * Math.exp(-(((wd - hw - 1.3) / 0.8) ** 2)) * ss(-47.5, -52, x);
      }
      // the diorama's frame (the cliffs run on to it)
      const e = Math.min(x - TX0, TX1 - x, TZ1 - z);
      return z > zFoot(x) + 1 ? h * ss(0, 5, e) : h;
    };
    A.H = H;

    // ============================================================ physics: the temple
    {
      for (const t of TERR) K.platform((t.x0 + t.x1) / 2, (t.z0 + BACK) / 2, (t.x1 - t.x0) / 2, (t.z0 - BACK) / 2, 0, t.h);
      for (const [za, zb, base] of RAMPS) {
        const p0 = track.at(sAt(0, za)), p1 = track.at(sAt(0, zb));
        K.ramp((p0.x + p1.x) / 2, (p0.z + p1.z) / 2, Math.atan2(p1.z - p0.z, p1.x - p0.x), Math.hypot(p1.x - p0.x, p1.z - p0.z) + 0.4, W + 2, STEP, base);
      }
    }
    // the ledge: a flat platform, then the descent as a chain of short ramps (they reach the cliff on the inside)
    {
      const xa = LEDGE.xD0, xb = LEDGE.x0 + 0.5;
      K.platform((xa + xb) / 2, (LEDGE.zIn + LEDGE.zOut) / 2, (xb - xa) / 2 + 0.2, (LEDGE.zOut - LEDGE.zIn) / 2, 0, TOPH);
      const n = Math.round((S.D1 - S.D0) / 4), sl = (S.D1 - S.D0) / n;
      for (let i = 0; i < n; i++) {
        const s0 = S.D0 + i * sl, s1 = s0 + sl;
        const p0 = track.place(s0, 0.6), p1 = track.place(s1, 0.6);
        const y0 = roadY(s0 + 0.001), y1 = roadY(s1 - 0.001);
        K.ramp((p0.x + p1.x) / 2, (p0.z + p1.z) / 2, Math.atan2(p0.z - p1.z, p0.x - p1.x), Math.hypot(p1.x - p0.x, p1.z - p0.z) + 0.35, 14.4, y0 - y1, y1);
      }
    }
    // walls: low masonry walls along the climb and the top terrace road, the terrace edges; a rock wall where the descent
    // leaves the gorge; the cliff
    const wallSeg = []; // visual segments [s0, s1, side]
    const roadWall = (side, s0, s1, h = 1.4) => {
      const n = Math.max(1, Math.ceil((s1 - s0) / 3.5));
      for (let i = 0; i < n; i++) {
        const a = s0 + ((s1 - s0) * i) / n, b = s0 + ((s1 - s0) * (i + 1)) / n;
        const pa = track.place(a, side * (wAt(a) / 2 + 1.0)), pb = track.place(b, side * (wAt(b) / 2 + 1.0));
        K.capsule(pa.x, pa.z, pb.x, pb.z, 0.5, Math.max(roadY(a), roadY(b)) + h, { solid: true });
      }
      wallSeg.push([s0, s1, side]);
    };
    const sTopEnd = sAt(LEDGE.x0 + 0.5, LEDGE.z);
    roadWall(-1, S.A0 - 3, sTopEnd);
    roadWall(1, S.A0 - 3, S.C1 + 0.5);
    // the top terrace east of the climb: its south edge and east end
    for (let x = 8.6; x < TERR[2].x1; x += 4) K.capsule(x, TERR[2].z0 - 0.6, Math.min(TERR[2].x1, x + 4), TERR[2].z0 - 0.6, 0.5, TOPH + 1.3, { solid: true });
    K.capsule(TERR[2].x1 - 0.5, TERR[2].z0, TERR[2].x1 - 0.5, BACK, 0.5, TOPH + 1.3, { solid: true });
    // rock wall on the open side of the descent once the gorge has turned away
    const sRock0 = sAt(-92, LEDGE.z), sRock1 = sAt(-113, -105.8);
    {
      const n = Math.ceil((sRock1 - sRock0) / 3);
      for (let i = 0; i < n; i++) {
        const a = sRock0 + ((sRock1 - sRock0) * i) / n, b = sRock0 + ((sRock1 - sRock0) * (i + 1)) / n;
        const pa = track.place(a, -(wAt(a) / 2 + 1.2)), pb = track.place(b, -(wAt(b) / 2 + 1.2));
        K.capsule(pa.x, pa.z, pb.x, pb.z, 0.8, Math.max(roadY(a), roadY(b)) + 1.6, { solid: true });
      }
    }
    // the cliff: solid boxes along its foot
    for (let x = TX0; x < TX1; x += 6) {
      const zf = Math.max(zFoot(x), zFoot(x + 3), zFoot(x + 6)) - (x + 3 > -52 && x + 3 < 52 ? 0 : 0.2);
      const z0 = Math.min(zf + 0.25, x + 3 < -46 && x + 3 > -124 ? LEDGE.zIn + 0.15 : zf + 0.25);
      K.box(x + 3, (z0 + TZ0 - 8) / 2, 3.05, (z0 - TZ0 + 8) / 2, 0, 80, { solid: true });
    }

    // ============================================================ physics: the wadi (gorge under the ledge, ravine across the west straight)
    // where the wadi crosses the west straight
    const crossing = (() => {
      let best = null;
      for (let a = 100; a < WF.len - 5; a += 0.25) {
        const q = WF.at(a);
        if (q.x > -140) continue;
        const nn = track.distTo(q.x, q.z);
        if (!best || nn.dist < best.d) best = { a, d: nn.dist, s: nn.s, q };
      }
      return best;
    })();
    const sW = crossing.s, pW = track.at(sW), hwW = wadiHW(crossing.a, pW.x);
    const crossSin = Math.abs(crossing.q.tx * pW.tz - crossing.q.tz * pW.tx) || 1;
    const hwAlong = hwW / crossSin;
    A.sW = sW;
    K.trapdoor(pW.x, pW.z, hwAlong, W / 2 + 3.5, pW.angle, true);
    {
      // short rectangles along the ravine (except where the crossing's own hole is)
      for (let a = 0; a < WF.len - 1; a += 2.5) {
        const q0 = WF.at(a), q1 = WF.at(Math.min(WF.len, a + 2.5));
        const mx = (q0.x + q1.x) / 2, mz = (q0.z + q1.z) / 2;
        if (mx < -171 || mx > -50.5) continue;
        const hw = wadiHW(a + 1.25, mx) - 0.25;
        const nn = track.distTo(mx, mz);
        if (a > 100 && nn.dist < W / 2 + 4.5) continue;
        K.trapdoor(mx, mz, Math.hypot(q1.x - q0.x, q1.z - q0.z) / 2 + 0.6, a < 44 ? -93 - LEDGE.zOut : hw, Math.atan2(q1.z - q0.z, q1.x - q0.x), true);
      }
    }
    // the jump: a ramp whose lip is at the wadi's near edge
    const sJ1 = sW - hwAlong - 0.15, sJ0 = sJ1 - JUMP.len;
    A.sJ0 = sJ0; A.hwAlong = hwAlong;
    {
      const p = track.at((sJ0 + sJ1) / 2);
      K.ramp(p.x, p.z, p.angle, JUMP.len, W + 2, JUMP.h, 0);
    }

    // ============================================================ physics: colliders of the scenery are added with their visuals below
    // the sand drifts (surfaces switched on and off in tick)
    for (const [x, z, side, rad] of DRIFTS) {
      const s = sAt(x, z), lat = side * (wAt(s) / 2 - rad + 0.9), p = track.place(s, lat);
      const surf = K.surface('normal', { x: p.x, z: p.z, r: rad });
      A.drifts.push({ s, lat, r: rad, x: p.x, z: p.z, ang: p.angle, surf, g: 0, mesh: null });
    }

    // ============================================================ textures
    const tex = (c, rep = [1, 1], wrap = true, srgb = true) => TX.toTexture(c, { repeat: rep, wrap, srgb });
    // limestone masonry (blocks with fine joints), world-space UVs
    const masonry = (() => {
      const S2 = 256, hg = new Float32Array(S2 * S2);
      const c = TX.paint(S2, S2, (x, y, u, v, o) => {
        const row = y >> 5, off = (row * 37) % 64, bx = (x + off) % 64, bi = ((x + off) >> 6) & 3, by = y & 31;
        const joint = bx < 2 || by < 2;
        const hs = Math.sin(row * 12.9898 + bi * 78.233) * 43758.5453, tn = hs - Math.floor(hs);
        const g = bil(NF, x * 0.5, y * 0.5), g2 = bil(NF2, x * 2, y * 2);
        const k = joint ? 0.84 : (0.95 + tn * 0.07) * (0.95 + (g - 0.5) * 0.16 + (g2 - 0.5) * 0.1);
        o[0] = 240 * k; o[1] = 228 * k; o[2] = 206 * k;
        hg[y * S2 + x] = joint ? 0.15 : 0.6 + (g2 - 0.5) * 0.3 - (bx < 4 || by < 4 ? 0.12 : 0);
      });
      return { map: tex(c), normal: tex(TX.normalFromHeight(hg, S2, S2, 1.6), [1, 1], true, false) };
    })();
    const grainN = (() => {
      const S2 = 128, hg = new Float32Array(S2 * S2);
      for (let y = 0; y < S2; y++) for (let x = 0; x < S2; x++) hg[y * S2 + x] = bil(NF, x * 2, y * 2) * 0.7 + bil(NF2, x * 4, y * 4) * 0.3;
      return tex(TX.normalFromHeight(hg, S2, S2, 3), [1, 1], true, false);
    })();
    const mStone = K.std({ vertexColors: true, map: masonry.map, normalMap: masonry.normal, normalScale: V2(0.7), roughness: 0.86 });
    mStone.userData.wuv = 1 / 11;
    const mSmooth = K.std({ vertexColors: true, normalMap: grainN, normalScale: V2(0.45), roughness: 0.74 });
    mSmooth.userData.wuv = 1 / 3;
    // weathered limestone for the temple's big surfaces (mottled, world-space)
    const mott = TX.mottledTextures({ size: 256, a: 0xffffff, b: 0xeae2d2, c: 0xf6eee0, seed: 61, period: 4, speck: 0.05, bump: 1.6 });
    const mTemple = K.std({ vertexColors: true, map: mott.map, normalMap: mott.normalMap, normalScale: V2(0.55), roughness: 0.86 });
    mTemple.userData.wuv = 1 / 9;
    const mWood = K.std({ vertexColors: true, normalMap: grainN, normalScale: V2(0.6), roughness: 0.8 });
    mWood.userData.wuv = 1 / 2;
    const mFabric = K.std({ vertexColors: true, roughness: 0.95, side: T.DoubleSide });
    const mDark = K.std({ color: 0x0b0806, roughness: 1 });
    // painted frieze: generic glyph-like signs (eyes, reeds, water lines, birds, loops) between coloured borders
    const glyphTex = (() => {
      const c = TX.makeCanvas(512, 64), g = c.getContext('2d'), rr = K.rng(77);
      g.fillStyle = '#efe2c2'; g.fillRect(0, 0, 512, 64);
      g.fillStyle = '#2a4f9a'; g.fillRect(0, 0, 512, 6); g.fillRect(0, 58, 512, 6);
      g.fillStyle = '#d9a21b'; g.fillRect(0, 6, 512, 3); g.fillRect(0, 55, 512, 3);
      for (let i = 0; i < 16; i++) {
        const x = i * 32 + 16, kind = (i * 7 + 3) % 6, col = rr() < 0.5 ? '#1a2f6a' : rr() < 0.5 ? '#9a2a1a' : '#1a1410';
        g.fillStyle = col; g.strokeStyle = col; g.lineWidth = 2.6;
        g.beginPath();
        if (kind === 0) { g.ellipse(x, 32, 10, 5, 0, 0, TAU); g.stroke(); g.beginPath(); g.arc(x, 32, 3, 0, TAU); g.fill(); g.fillRect(x - 2, 37, 2, 9); }
        else if (kind === 1) { for (let k = 0; k < 3; k++) { g.moveTo(x - 10, 22 + k * 7); for (let q = 0; q <= 4; q++) g.lineTo(x - 10 + q * 5, 22 + k * 7 + (q % 2 ? -3 : 0)); } g.stroke(); }
        else if (kind === 2) { g.moveTo(x, 48); g.lineTo(x, 18); g.stroke(); g.beginPath(); g.ellipse(x + 4, 20, 5, 2.5, 0.5, 0, TAU); g.fill(); }
        else if (kind === 3) { g.ellipse(x, 30, 9, 6, 0, 0, TAU); g.fill(); g.beginPath(); g.arc(x + 9, 24, 4, 0, TAU); g.fill(); g.fillRect(x - 6, 35, 2, 12); g.fillRect(x + 3, 35, 2, 12); }
        else if (kind === 4) { g.arc(x, 22, 6, 0, TAU); g.stroke(); g.fillRect(x - 9, 28, 18, 3); g.fillRect(x - 1.5, 28, 3, 20); }
        else { g.ellipse(x, 33, 7, 10, 0, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(x, 23); g.lineTo(x, 43); g.stroke(); }
      }
      return tex(c, [1, 1], true);
    })();
    const mGlyph = K.std({ map: glyphTex, roughness: 0.8 });
    // a painted frieze strip facing south (+z), the signs at their proper proportions
    const band = (len, h, o) => {
      const g = new T.PlaneGeometry(len, h), uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * len / (h * 8));
      put(g, 0xffffff, o, mGlyph, { cast: false });
    };

    // the valley floor: macro colour (sand tones, gravel, the wadi floor, paths), a world-space grain, wind ripples
    const MW = 1024, MH = Math.round(1024 * (TZ1 - TZ0) / (TX1 - TX0));
    const mpx = (x) => (x - TX0) / (TX1 - TX0) * MW, mpy = (z) => (z - TZ0) / (TZ1 - TZ0) * MH, sxp = MW / (TX1 - TX0);
    const macroC = (() => {
      const lo = TX.paint(MW / 2, Math.round(MH / 2), (px, py, u, v, o) => {
        const x = TX0 + u * (TX1 - TX0), z = TZ0 + v * (TZ1 - TZ0);
        const a = n1(x, z, 0.06), b = n1(x, z, 0.013, 400), c = n2(x, z, 0.09);
        let R = 222, G = 174, B = 110;
        const t = (a - 0.5) * 1.5 + (b - 0.5) * 1.3;
        R += t * 30; G += t * 26; B += t * 16;
        const och = ss(0.58, 0.72, c) * 0.55; // ochre-red patches
        R = lerp(R, 204, och); G = lerp(G, 132, och); B = lerp(B, 82, och);
        // gravel plain at the cliff foot
        const gv = ss(-82, -100, z) * 0.6;
        R = lerp(R, 186, gv); G = lerp(G, 158, gv); B = lerp(B, 124, gv);
        // dune crests: a pale brink, a warmer slip face
        duneH(x, z);
        const an = Math.min(1, DS.amp / 1.6), f = DS.f;
        const brink = Math.exp(-(((f - 0.22) / 0.025) ** 2)) * an, lee = (f < 0.2 ? 1 : 0) * an;
        R += brink * 26 - lee * 6; G += brink * 24 - lee * 10; B += brink * 22 - lee * 10;
        // the camp: trampled, paler
        const dc = Math.hypot((x - CAMP.x) / CAMP.rx, (z - CAMP.z) / CAMP.rz);
        const tr = ss(1.0, 0.6, dc) * 0.45;
        R = lerp(R, 232, tr); G = lerp(G, 204, tr); B = lerp(B, 158, tr);
        // the wadi floor: grey-brown gravel
        const wd = wadiD(x, z);
        if (wd < 9 && x < -47) { const k = 1 - ss(wadiHW(wadiA(x, z), x) - 1.2, wadiHW(wadiA(x, z), x) + 0.4, wd); R = lerp(R, 150, k); G = lerp(G, 126, k); B = lerp(B, 100, k); }
        o[0] = clamp(R, 0, 255); o[1] = clamp(G, 0, 255); o[2] = clamp(B, 0, 255);
      });
      const c = TX.makeCanvas(MW, MH), g = c.getContext('2d');
      g.imageSmoothingEnabled = true; g.drawImage(lo, 0, 0, MW, MH);
      const rr = K.rng(202);
      // footpaths from the camp to the tombs, through the valley
      const path = (pts, wid, alpha) => {
        g.strokeStyle = `rgba(244,222,182,${alpha})`; g.lineWidth = wid * sxp; g.lineCap = 'round'; g.lineJoin = 'round';
        g.beginPath(); pts.forEach(([x, z], i) => { const X = mpx(x + (rr() - 0.5) * 0.6), Z = mpy(z + (rr() - 0.5) * 0.6); if (i) g.lineTo(X, Z); else g.moveTo(X, Z); }); g.stroke();
      };
      path([[60, -50], [72, -62], [80, -82], [80, -112]], 1.6, 0.5);
      path([[96, -66], [104, -80], [110, -96], [112, -112]], 1.8, 0.55);
      path([[104, -84], [128, -92], [146, -100], [150, -112]], 1.3, 0.45);
      path([[60, -50], [40, -44], [24, -40]], 1.2, 0.35);
      path([[-60, 46], [-74, 34], [-82, 22], [-96, 10], [-112, -6], [-126, -20]], 1.2, 0.35);
      path([[-82, 30], [-60, 26], [-40, 18], [-20, 10]], 1.0, 0.3);
      // excavation squares at the west site and the camp trench
      g.strokeStyle = 'rgba(120,84,52,0.6)'; g.lineWidth = 1.2;
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) g.strokeRect(mpx(-92 + i * 4), mpy(26 + j * 4), 4 * sxp, 4 * sxp);
      g.fillStyle = 'rgba(126,90,58,0.55)';
      for (const [i, j] of [[0, 0], [1, 1], [2, 0], [3, 2], [1, 2]]) g.fillRect(mpx(-92 + i * 4) + 1, mpy(26 + j * 4) + 1, 4 * sxp - 2, 4 * sxp - 2);
      g.fillStyle = 'rgba(96,66,42,0.75)'; g.fillRect(mpx(83), mpy(-99), 10 * sxp, 5 * sxp);
      // pebbles and gravel, darker at the cliff foot and in the wadi
      for (let i = 0; i < 2600; i++) {
        const x = rr.range(TX0, TX1), z = rr.range(TZ0, TZ1), wd = wadiD(x, z);
        const dense = z < -84 || (wd < 6 && x < -48);
        if (!dense && rr() < 0.55) continue;
        g.fillStyle = rr() < 0.6 ? `rgba(${90 + rr() * 50},${70 + rr() * 40},${52 + rr() * 30},${0.35 + rr() * 0.4})` : `rgba(250,236,210,${0.25 + rr() * 0.3})`;
        g.fillRect(mpx(x), mpy(z), 1 + rr() * 1.8, 1 + rr() * 1.4);
      }
      // potsherd specks round the camp and the site
      for (let i = 0; i < 160; i++) {
        const cx = rr() < 0.6 ? CAMP.x : SITE.x, cz = cx === CAMP.x ? CAMP.z : SITE.z;
        const x = cx + rr.gauss() * 22, z = cz + rr.gauss() * 14;
        g.fillStyle = `rgba(${150 + rr() * 30},${92 + rr() * 20},${60 + rr() * 20},0.35)`; g.fillRect(mpx(x), mpy(z), 1.2, 1.0);
      }
      return c;
    })();
    const macroTex = TX.toTexture(macroC, { wrap: false });
    const detailTex = (() => {
      const c = TX.paint(256, 256, (x, y, u, v, o) => {
        const hn = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453, nn = hn - Math.floor(hn);
        const k = 128 + (nn - 0.5) * 20 + (bil(NF2, u * 256, v * 256) - 0.5) * 36;
        o[0] = k; o[1] = k * 0.99; o[2] = k * 0.98;
      });
      const g = c.getContext('2d'), rr = K.rng(91);
      for (let i = 0; i < 200; i++) {
        const x = rr() * 256, y = rr() * 256, rad = 0.8 + rr() * rr() * 3, dark = rr() < 0.55;
        for (const [ox, oy] of [[0, 0], [256, 0], [-256, 0], [0, 256], [0, -256]]) {
          g.fillStyle = dark ? `rgba(60,44,30,${0.3 + rr() * 0.3})` : `rgba(250,228,196,${0.3 + rr() * 0.3})`;
          g.beginPath(); g.ellipse(x + ox, y + oy, rad, rad * 0.75, rr() * 3, 0, TAU); g.fill();
        }
      }
      return TX.toTexture(c, { srgb: false });
    })();
    // wind ripples: crests across the east wind (north-south)
    const ripple = (() => {
      const S2 = 512, hf = new Float32Array(S2 * S2), warp = TX.noiseField(256, { seed: 41, period: 4, oct: 3 });
      for (let y = 0; y < S2; y++) for (let x = 0; x < S2; x++) {
        const u = x / S2, v = y / S2, w = bil(warp, u * 256, v * 256);
        const ph = 18 * u + (w - 0.5) * 2.4 + Math.sin(v * TAU * 2) * 0.15, f = ph - Math.floor(ph);
        hf[y * S2 + x] = (f < 0.7 ? f / 0.7 : (1 - f) / 0.3) * 0.65 + bil(NF2, u * 512, v * 512) * 0.35;
      }
      return TX.toTexture(TX.normalFromHeight(hf, S2, S2, 1.7), { srgb: false });
    })();
    ripple.repeat.set((TX1 - TX0) / 10, (TZ1 - TZ0) / 10);
    // limestone strata for the cliffs and the ravine walls, looked up by world height
    const strataTex = (() => {
      const rr = K.rng(404), layers = [];
      const pal = [[240, 228, 202], [228, 204, 160], [244, 236, 216], [218, 186, 144], [234, 214, 180], [212, 174, 134], [238, 222, 194], [224, 192, 154], [248, 242, 226], [204, 170, 134]];
      let y = 0;
      while (y < 512) { const t = 8 + rr() * rr() * 44; layers.push([y, y + t, pal[(rr() * pal.length) | 0], rr()]); y += t; }
      const c = TX.paint(64, 512, (x, yy, u, v, o) => {
        const py = 511 - yy;
        let L0 = layers[0];
        for (const Ly of layers) if (py >= Ly[0] && py < Ly[1]) { L0 = Ly; break; }
        const n = bil(NF, u * 256, v * 64 + L0[3] * 50);
        const edge = Math.min(py - L0[0], L0[1] - py) < 1.2 ? 0.8 : 1;
        const k = edge * (0.88 + (n - 0.5) * 0.45) * (0.95 + 0.05 * Math.sin(py * 2.3 + L0[3] * 9));
        o[0] = L0[2][0] * k; o[1] = L0[2][1] * k; o[2] = L0[2][2] * k;
      });
      return TX.toTexture(c);
    })();
    const terrainShader = (sh) => {
      sh.uniforms.tDetail = { value: detailTex };
      sh.uniforms.tStrata = { value: strataTex };
      sh.vertexShader = 'attribute float aCliff;\nvarying float vCliff;\nvarying vec3 vWP;\nvarying vec3 vWN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWN = normalize(mat3(modelMatrix) * objectNormal);\nvCliff = aCliff;');
      sh.fragmentShader = 'uniform sampler2D tDetail;\nuniform sampler2D tStrata;\nvarying float vCliff;\nvarying vec3 vWP;\nvarying vec3 vWN;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        { float fl = smoothstep(0.45, 0.85, abs(vWN.y));
          vec2 pf = vWP.xz, pv = vec2(vWP.x + vWP.z * 0.7, vWP.y * 1.5);
          vec3 d1 = mix(texture2D(tDetail, pv / 9.0).rgb, texture2D(tDetail, pf / 9.0).rgb, fl);
          vec3 d2 = mix(texture2D(tDetail, pv / 31.0 + 0.37).rgb, texture2D(tDetail, pf / 31.0 + 0.37).rgb, fl);
          diffuseColor.rgb *= d1 * d2 * 4.0;
          if (vCliff > 0.002) {
            float wob = sin(vWP.x * 0.07) * 0.8 + sin(vWP.x * 0.23 + vWP.z * 0.13) * 0.3;
            vec3 st = texture2D(tStrata, vec2(vWP.x / 37.0 + vWP.z / 83.0, (vWP.y + 14.0 + wob) / 64.0)).rgb;
            st *= mix(0.8, 1.0, fl) * d1 * 2.0;
            diffuseColor.rgb = mix(diffuseColor.rgb, st, vCliff);
          } }`).replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize(mix(normal, nonPerturbedNormal, clamp(vCliff * 1.5, 0.0, 1.0)));');
    };
    const sandMat = K.std({ map: macroTex, normalMap: ripple, normalScale: V2(0.8), vertexColors: true, roughness: 0.95 });
    sandMat.onBeforeCompile = terrainShader;

    // ============================================================ terrain mesh (one height grid, chunked)
    {
      const XS = [], ZS = [];
      for (let x = TX0; x <= TX1 + 0.01; x += 1.5) XS.push(x);
      for (let z = TZ0; z < -82; z += 0.75) ZS.push(z);
      for (let z = -82; z <= TZ1 + 0.01; z += 1.4) ZS.push(z);
      const nx = XS.length, nz = ZS.length;
      const HG = new Float32Array(nx * nz);
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) HG[j * nx + i] = H(XS[i], ZS[j]);
      const NRM = new Float32Array(nx * nz * 3), COL = new Float32Array(nx * nz * 3), CL = new Float32Array(nx * nz);
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        const i0 = Math.max(0, i - 1), i1 = Math.min(nx - 1, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(nz - 1, j + 1);
        const dhx = (HG[j * nx + i1] - HG[j * nx + i0]) / (XS[i1] - XS[i0]), dhz = (HG[j1 * nx + i] - HG[j0 * nx + i]) / (ZS[j1] - ZS[j0]);
        const l = Math.hypot(dhx, 1, dhz), ny = 1 / l;
        NRM[k * 3] = -dhx / l; NRM[k * 3 + 1] = ny; NRM[k * 3 + 2] = -dhz / l;
        const x = XS[i], z = ZS[j], h = HG[k];
        CL[k] = ss(0.8, 0.55, ny);
        duneH(x, z);
        const crest = (Math.exp(-(((DS.f - 0.22) / 0.04) ** 2)) - 0.3) * Math.min(1, DS.amp / 1.4);
        const kk = (1 + clamp(h * 0.05, -0.25, 0.1)) * (0.86 + 0.14 * ny) * (1 + crest * 0.12) * (h < -1 ? 0.75 + 0.25 * ss(-12, -1, h) : 1);
        COL[k * 3] = kk * 1.01; COL[k * 3 + 1] = kk; COL[k * 3 + 2] = kk * 0.98;
      }
      const xsplit = [0, 40, 81, 121, 162, 202, nx - 1], zsplit = [0, ZS.findIndex((z) => z >= -82), Math.floor((nz + ZS.findIndex((z) => z >= -82)) / 2), nz - 1];
      for (let a = 0; a < xsplit.length - 1; a++) for (let b = 0; b < zsplit.length - 1; b++) {
        const i0 = xsplit[a], i1 = xsplit[a + 1], j0 = zsplit[b], j1 = zsplit[b + 1];
        const w = i1 - i0 + 1, hgt = j1 - j0 + 1;
        const pos = new Float32Array(w * hgt * 3), nrm = new Float32Array(w * hgt * 3), col = new Float32Array(w * hgt * 3), uv = new Float32Array(w * hgt * 2), cl = new Float32Array(w * hgt);
        let minY = 1e9;
        for (let j = 0; j < hgt; j++) for (let i = 0; i < w; i++) {
          const gi = i0 + i, gj = j0 + j, k = gj * nx + gi, o = j * w + i;
          pos[o * 3] = XS[gi]; pos[o * 3 + 1] = HG[k]; pos[o * 3 + 2] = ZS[gj];
          minY = Math.min(minY, HG[k]);
          nrm[o * 3] = NRM[k * 3]; nrm[o * 3 + 1] = NRM[k * 3 + 1]; nrm[o * 3 + 2] = NRM[k * 3 + 2];
          col[o * 3] = COL[k * 3]; col[o * 3 + 1] = COL[k * 3 + 1]; col[o * 3 + 2] = COL[k * 3 + 2]; cl[o] = CL[k];
          uv[o * 2] = (XS[gi] - TX0) / (TX1 - TX0); uv[o * 2 + 1] = 1 - (ZS[gj] - TZ0) / (TZ1 - TZ0);
        }
        const idx = [];
        for (let j = 0; j < hgt - 1; j++) for (let i = 0; i < w - 1; i++) { const p = j * w + i, q = p + 1, s2 = p + w, t2 = s2 + 1; idx.push(p, s2, q, q, s2, t2); }
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.BufferAttribute(pos, 3));
        g.setAttribute('normal', new T.BufferAttribute(nrm, 3));
        g.setAttribute('color', new T.BufferAttribute(col, 3));
        g.setAttribute('uv', new T.BufferAttribute(uv, 2));
        g.setAttribute('aCliff', new T.BufferAttribute(cl, 1));
        g.setIndex(idx);
        g.computeBoundingSphere();
        const m = new T.Mesh(g, sandMat);
        m.castShadow = b === 0 || minY < -2; m.receiveShadow = true;
        K.group.add(m);
      }
    }

    // ============================================================ the road: a graded desert track; stone paving on the temple and the ledge
    const RWv = W + 5, vScale = L / Math.round(L / 30);
    const ribbon = (s0, s1, width, mat, yOf, step = 1) => {
      const segU = 6, pos = [], uv = [], idx = [], rows = [];
      for (let s = s0; s < s1;) { rows.push(s); s += step; }
      rows.push(s1);
      rows.forEach((s) => {
        const p = track.at(s);
        for (let j = 0; j <= segU; j++) {
          const u = j / segU, o = (u - 0.5) * width * (wAt(s) / W);
          const x = p.x + p.nx * o, z = p.z + p.nz * o;
          pos.push(x, yOf(s, x, z), z); uv.push(u, s / vScale);
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
      const m = new T.Mesh(geo, mat); m.receiveShadow = true; m.castShadow = false; m.renderOrder = 1;
      K.group.add(m);
      return m;
    };
    {
      // compacted sand: paler and greyer than the dunes, two worn wheel tracks, gravel, loose sand at the verges
      const TW = 256, TH = 1024, fe = 2.5 / RWv, uOf = (lat) => (lat / RWv + 0.5) * TW, pxu = TW / RWv;
      const lanes = [-3.3, 3.3];
      const rh = new Float32Array(TW * TH);
      const c = TX.paint(TW, TH, (x, y, u, v, o) => {
        const e = Math.min(u, 1 - u), en = (bil(NF, u < 0.5 ? 20 : 200, v * 256 * 1.5) - 0.5) * 0.08;
        const al = ss(0.004, fe * 1.2 + en, e);
        const n = bil(NF2, u * 48, v * 256), hn = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453, nn = hn - Math.floor(hn);
        const lat = (u - 0.5) * RWv;
        let rut = 0;
        for (const ln of lanes) for (const sd of [-1.05, 1.05]) { const d = Math.abs(lat - ln - sd - Math.sin(v * TAU * 3 + ln) * 0.12); rut = Math.max(rut, 1 - ss(0.15, 0.45, d)); }
        const verge = 1 - ss(fe * 0.6, fe * 1.8, e);
        const k = (0.92 + (n - 0.5) * 0.22 + (nn - 0.5) * 0.12) * (1 - rut * 0.13);
        o[0] = lerp(206, 232, verge * 0.8) * k; o[1] = lerp(178, 196, verge * 0.8) * k; o[2] = lerp(138, 140, verge * 0.8) * k;
        o[3] = al * 255;
        rh[y * TW + x] = 0.5 + (nn - 0.5) * 0.25 + (n - 0.5) * 0.4 - rut * 0.35;
      });
      const g = c.getContext('2d'), rr = K.rng(23);
      for (let i = 0; i < 520; i++) {
        const x = uOf(rr.range(-7, 7)), y = rr() * TH, rad = 0.6 + rr() * 1.3;
        g.fillStyle = rr() < 0.55 ? `rgba(110,84,60,${0.35 + rr() * 0.3})` : `rgba(250,236,214,${0.35 + rr() * 0.3})`;
        g.beginPath(); g.ellipse(x, y, rad, rad * 0.7, rr() * 3, 0, TAU); g.fill();
      }
      // tyre marks: faint long arcs
      for (let i = 0; i < 6; i++) {
        g.strokeStyle = 'rgba(90,64,44,0.12)'; g.lineWidth = 0.35 * pxu;
        const l0 = rr.range(-5, 5), ph = rr() * TAU;
        g.beginPath(); for (let y = 0; y <= TH; y += 8) { const X = uOf(l0 + Math.sin(y / TH * TAU + ph) * 1.5); if (y) g.lineTo(X, y); else g.moveTo(X, y); } g.stroke();
      }
      const roadMat = K.std({ map: TX.toTexture(c), normalMap: TX.toTexture(TX.normalFromHeight(rh, TW, TH, 2.0), { srgb: false }), normalScale: V2(0.8), roughness: 0.94, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      const yv = (s, x, z) => Math.max(H(x, z), 0) + 0.07;
      ribbon(S.D1 + 1, sW - hwAlong, RWv, roadMat, yv);
      ribbon(sW + hwAlong, L + S.A0 - 1, RWv, roadMat, yv);
      // flagstones on the temple and the ledge
      const ST = 256, SH = 512, stH = new Float32Array(ST * SH);
      const sc = TX.paint(ST, SH, (x, y, u, v, o) => {
        const e = Math.min(u, 1 - u), al = ss(0.0, 0.03, e);
        const row = Math.floor(y / 40), off = (row % 2) * 32, bx = (x + off) % 64, by = y % 40;
        const joint = bx < 2 || by < 2;
        const hs = Math.sin(row * 7.1 + Math.floor((x + off) / 64) * 3.7) * 43758.5453, tn = hs - Math.floor(hs);
        const n = bil(NF2, u * 64, v * 128), sand = ss(0.55, 0.8, bil(NF, u * 32 + 9, v * 96));
        let k = joint ? 0.72 : 0.9 + tn * 0.1 + (n - 0.5) * 0.16;
        o[0] = lerp(232 * k, 222, sand * 0.6); o[1] = lerp(218 * k, 186, sand * 0.6); o[2] = lerp(192 * k, 140, sand * 0.6);
        o[3] = al * 255;
        stH[y * ST + x] = joint ? 0.2 : 0.6 + (n - 0.5) * 0.2;
      });
      const stoneRoadMat = K.std({ map: TX.toTexture(sc), normalMap: TX.toTexture(TX.normalFromHeight(stH, ST, SH, 2.2), { srgb: false }), normalScale: V2(0.7), roughness: 0.85, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      ribbon(S.A0 - 2, S.D1 + 2, W + 0.6, stoneRoadMat, (s) => roadY(s) + 0.08, 0.5);
    }

    // ============================================================ start / finish: a chequered strip with two pennants
    {
      const p = track.at(START);
      const c = canvas(512, 96, (g) => { for (let y = 0; y < 3; y++) for (let x = 0; x < 16; x++) { g.fillStyle = (x + y) % 2 ? '#241812' : '#f5efe2'; g.fillRect(x * 32, y * 32, 32, 32); } const rr = K.rng(3); g.fillStyle = 'rgba(200,150,90,0.35)'; for (let i = 0; i < 260; i++) g.fillRect(rr() * 512, rr() * 96, 2 + rr() * 4, 1 + rr() * 3); });
      const m = K.mesh(new T.PlaneGeometry(W + 0.4, 2.8), K.std({ map: tex(c, [1, 1], false), roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), p.x, 0.1, p.z, { cast: false });
      m.rotation.order = 'YXZ'; m.rotation.y = -p.angle + PI / 2; m.rotation.x = -PI / 2; m.renderOrder = 2;
      const flagMat = K.std({ color: 0x2a5aa8, roughness: 0.8, side: T.DoubleSide });
      const flagMat2 = K.std({ color: 0xd9a21b, roughness: 0.8, side: T.DoubleSide });
      for (const side of [-1, 1]) {
        const q = track.place(START, side * (W / 2 + 2.2));
        put(cyl(0.12, 0.14, 4.2, 8), 0x6a4a2a, { x: q.x, y: 2.1, z: q.z }, mWood);
        put(sph(0.22, 8, 6), 0xd9a21b, { x: q.x, y: 4.3, z: q.z }, mSmooth);
        AO(q.x, q.z, 0.6, 0.6, 0.45);
        K.circle(q.x, q.z, 0.3, 4.4);
        const fg = new T.Mesh(new T.PlaneGeometry(1.8, 1.0, 6, 1).translate(0.9, 0, 0), side > 0 ? flagMat : flagMat2);
        fg.position.set(q.x, 3.7, q.z); fg.castShadow = true;
        K.group.add(fg);
        A.flags.push({ m: fg, x: q.x, z: q.z, ph: side * 1.7 });
      }
    }

    // ============================================================ road edges: white-painted stones; on the ledge a row on the drop side
    const rockGeo = (() => {
      let g = new T.IcosahedronGeometry(1, 0);
      g.deleteAttribute('normal'); g.deleteAttribute('uv');
      g = BU.mergeVertices(g);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), q = 1 + Math.sin(x * 4.1 + 2) * Math.sin(z * 3.7 + 1) * 0.2 + Math.sin(y * 3 + x * 2) * 0.12; p.setXYZ(i, x * q, y * q * (y < 0 ? 0.5 : 0.8), z * q); }
      g.computeVertexNormals();
      return g;
    })();
    const boulderGeo = (() => {
      let g = new T.IcosahedronGeometry(1, 1);
      g.deleteAttribute('normal'); g.deleteAttribute('uv');
      g = BU.mergeVertices(g);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), q = 0.84 + Math.sin(x * 5.1 + 1) * Math.sin(y * 4.3 + 2) * Math.sin(z * 4.7 + 3) * 0.2 + Math.sin(x * 2.1 + z * 1.7) * 0.1; p.setXYZ(i, x * q, (y < 0 ? y * 0.6 : y * 0.85) * q, z * q); }
      g.computeVertexNormals();
      return g;
    })();
    const rockMat = K.std({ roughness: 0.82, normalMap: grainN, normalScale: V2(0.8) });
    const stones = [], rocks = [];
    {
      const white = [0xf4f0e6, 0xebe4d6, 0xfaf8f2, 0xe2dacb];
      const bare = [0xc8a878, 0xb89468, 0xd2b488];
      const skip = (s) => (s > sJ0 - 2 && s < sW + hwAlong + 1.5);
      for (const side of [-1, 1]) {
        for (const p of track.edgePoints(side, 1.5, 0.75)) {
          const s = p.s;
          if (s > S.A0 - 4 && s < S.D1 + 3) continue;
          if (skip(s)) continue;
          const j = r.range(-0.2, 0.35) * side, x = p.x + Math.cos(p.angle + PI / 2) * j, z = p.z + Math.sin(p.angle + PI / 2) * j;
          const sc = r.range(0.34, 0.54);
          stones.push({ x, y: Math.max(0, H(x, z)) + sc * 0.3, z, ry: r() * TAU, sx: sc * r.range(1, 1.4), sy: sc, sz: sc, color: r() < 0.14 ? r.pick(bare) : r.pick(white) });
        }
      }
      // the ledge: a row on the drop side (on the deck), none against the cliff
      for (const p of track.edgePoints(-1, 1.5, 0.15, S.L0 - 1, sRock0)) {
        const sc = r.range(0.32, 0.46);
        stones.push({ x: p.x, y: roadY(p.s) + sc * 0.3, z: p.z, ry: r() * TAU, sx: sc * 1.2, sy: sc, sz: sc, color: r.pick(white) });
      }
      // the rock wall on the open side of the descent
      for (let s = sRock0; s < sRock1; s += 1.1) {
        const p = track.place(s, -(wAt(s) / 2 + 1.2 + r.range(-0.2, 0.3)));
        const sc = r.range(0.8, 1.25);
        rocks.push({ x: p.x, y: roadY(s) + sc * 0.4, z: p.z, ry: r() * TAU, rx: r.range(-0.3, 0.3), sx: sc * r.range(1, 1.4), sy: sc * r.range(0.8, 1.1), sz: sc, color: r.pick([0xcaa47a, 0xb89068, 0xd8b88c]) });
      }
    }

    // ============================================================ the temple
    {
      const lime = 0xeee2c8, lime2 = 0xe2d2b2, shade = 0xd8c6a2;
      // the three terraces (blocks reaching back to the cliff), cornice along their fronts
      for (const t of TERR) {
        put(box(t.x1 - t.x0, t.h, t.z0 - BACK), 0xdcc6a0, { x: (t.x0 + t.x1) / 2, y: t.h / 2, z: (t.z0 + BACK) / 2 }, mTemple);
        for (const [a, b] of [[t.x0, -W / 2 - 1], [W / 2 + 1, t.x1]]) put(box(b - a, t.h - (t.h > STEP ? STEP : 0) - 0.02, 0.12), 0xe2d0ac, { x: (a + b) / 2, y: (t.h > STEP ? t.h - STEP : 0) + (t.h - (t.h > STEP ? STEP : 0)) / 2, z: t.z0 + 0.06 }, mStone);
        for (const sd of [-1, 1]) put(box(0.12, t.h - 0.02, t.z0 - BACK), 0xe2d0ac, { x: sd > 0 ? t.x1 + 0.06 : t.x0 - 0.06, y: t.h / 2, z: (t.z0 + BACK) / 2 }, mStone);
        for (let k = 0; k < 5; k++) { const x = lerp(t.x0 + 4, t.x1 - 4, r()), z = t.z0 - r.range(2, 5); if (Math.abs(x) < W / 2 + 4) continue; put(sph(r.range(1.2, 2.4), 10, 6), 0xd8b47e, { x, y: t.h, z, sy: 0.22, sx: r.range(1, 1.8) }, mTemple, { cast: false }); }
        for (const [a, b] of [[t.x0 - 0.2, -W / 2 - 1.6], [W / 2 + 1.6, t.x1 + 0.2]]) put(box(b - a, 0.35, 0.8), lime2, { x: (a + b) / 2, y: t.h - 0.18, z: t.z0 + 0.1 }, mStone);
        AO((t.x0 + t.x1) / 2, t.z0 + 1.2, (t.x1 - t.x0) / 2 + 1, 2.2, 0.35, 0, t.h === STEP ? 0.07 : t.h - STEP + 0.07);
      }
      // the ramps (wedges)
      const wedge = (len, wid, y0, y1) => {
        const g = new T.BoxGeometry(len, 1, wid).toNonIndexed();
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) { const x = p.getX(i), yy = p.getY(i); p.setY(i, yy > 0 ? y0 + (y1 - y0) * (x / len + 0.5) : 0); }
        g.computeVertexNormals();
        return g;
      };
      for (const [za, zb, base] of RAMPS) {
        const p0 = track.at(sAt(0, za)), p1 = track.at(sAt(0, zb)), len = Math.hypot(p1.x - p0.x, p1.z - p0.z);
        put(wedge(len, W + 2, base, base + STEP), 0xd4bf98, { x: (p0.x + p1.x) / 2, y: 0, z: (p0.z + p1.z) / 2, ry: -Math.atan2(p1.z - p0.z, p1.x - p0.x) }, mTemple);
      }
      // low walls along the road (masonry with a coping), following the ramps' slope
      for (const [s0, s1, side] of wallSeg) {
        const n = Math.max(1, Math.ceil((s1 - s0) / 2.6));
        for (let i = 0; i < n; i++) {
          const a = s0 + ((s1 - s0) * i) / n, b = s0 + ((s1 - s0) * (i + 1)) / n;
          const pa = track.place(a, side * (wAt(a) / 2 + 1.0)), pb = track.place(b, side * (wAt(b) / 2 + 1.0));
          const ya = roadY(a), yb = roadY(b), len = Math.hypot(pb.x - pa.x, pb.z - pa.z), ang = Math.atan2(pb.z - pa.z, pb.x - pa.x);
          const sl = Math.atan2(yb - ya, len);
          put(box(len + 0.12, 1.25, 0.9), 0xd8c29a, { x: (pa.x + pb.x) / 2, y: (ya + yb) / 2 + 0.55, z: (pa.z + pb.z) / 2, ry: -ang, rz: sl }, mTemple);
          put(box(len + 0.14, 0.22, 1.1), 0xeadcbe, { x: (pa.x + pb.x) / 2, y: (ya + yb) / 2 + 1.25, z: (pa.z + pb.z) / 2, ry: -ang, rz: sl }, mTemple);
        }
      }
      // parapets round the top terrace east of the climb
      put(box(TERR[2].x1 - 8.6, 1.1, 0.8), 0xd8c29a, { x: (TERR[2].x1 + 8.6) / 2, y: TOPH + 0.55, z: TERR[2].z0 - 0.6 }, mStone);
      put(box(0.8, 1.1, TERR[2].z0 - BACK), lime2, { x: TERR[2].x1 - 0.5, y: TOPH + 0.55, z: (TERR[2].z0 + BACK) / 2 }, mStone);

      // a square pillar (drum joints, a painted band under the abacus)
      const pillar = (x, z, y, h, sz = 1.3, broken = false) => {
        put(box(sz + 0.5, 0.35, sz + 0.5), lime2, { x, y: y + 0.17, z }, mSmooth);
        put(box(sz, h, sz), 0xe8dcc0, { x, y: y + h / 2, z }, mTemple);
        if (!broken) {
          put(box(sz + 0.04, 0.3, sz + 0.04), 0x2a4f9a, { x, y: y + h - 0.75, z }, mSmooth);
          put(box(sz + 0.04, 0.12, sz + 0.04), 0xd9a21b, { x, y: y + h - 0.95, z }, mSmooth);
          put(box(sz + 0.4, 0.4, sz + 0.4), lime2, { x, y: y + h + 0.2, z }, mSmooth);
        }
      };
      // Osiride statue: a wrapped figure with crossed arms and a tall crown, facing south
      const osiris = parts([
        [box(1.5, 0.4, 1.3), 0xe2d2b2, { y: 0.2 }],
        [K.lathe([[0.001, 0.4], [0.55, 0.4], [0.6, 1.0], [0.55, 2.4], [0.72, 3.4], [0.66, 3.85], [0.36, 4.05], [0.001, 4.1]], 14), 0xe2cca2, {}],
        [cyl(0.73, 0.7, 0.3, 14), 0x1fa6a0, { y: 3.62 }],
        [box(1.1, 0.32, 0.36), 0xa8583a, { y: 3.15, z: 0.5 }],
        [cyl(0.06, 0.06, 1.1, 6), 0xd9a21b, { y: 3.2, z: 0.72, x: -0.25, rz: 0.5 }],
        [cyl(0.06, 0.06, 1.1, 6), 0x2a4f9a, { y: 3.2, z: 0.72, x: 0.25, rz: -0.5 }],
        [sph(0.36, 12, 8), 0xa8583a, { y: 4.42, z: 0.04 }],
        [K.lathe([[0.32, 0], [0.36, 0.35], [0.3, 0.9], [0.14, 1.2], [0.001, 1.28]], 12), 0xf6f0e2, { y: 4.58 }],
        [cyl(0.37, 0.37, 0.12, 12), 0xd9a21b, { y: 4.62 }],
        [cyl(0.08, 0.05, 0.42, 6), 0x2a2018, { y: 4.08, z: 0.3 }],
      ]);
      // T1 and T2 front porticos: pillars, a roof slab, Osiride statues in front of the lower one
      const portico = (t, zP, n, statues) => {
        for (const sd of [-1, 1]) {
          for (let k = 0; k < n; k++) {
            const x = sd * (12 + k * 5.6);
            pillar(x, zP, t.h, 5.2);
            if (statues) { putG(osiris, { x, y: t.h, z: zP + 2.0 }, mSmooth); AO(x, zP + 2.1, 0.9, 0.8, 0.4, 0, t.h + 0.07); }
          }
          const x0 = sd * 10.4, x1 = sd * (12 + (n - 1) * 5.6 + 1.6);
          put(box(Math.abs(x1 - x0), 0.75, 1.8), lime2, { x: (x0 + x1) / 2, y: t.h + 5.78, z: zP }, mStone);
          band(Math.abs(x1 - x0), 0.6, { x: (x0 + x1) / 2, y: t.h + 5.78, z: zP + 0.91 });
          // the back wall of the portico, with a dark doorway or two
          put(box(Math.abs(x1 - x0), 4.6, 0.8), 0xe6d6b8, { x: (x0 + x1) / 2, y: t.h + 2.3, z: zP - 5.2 }, mStone);
          for (const f of [0.3, 0.75]) put(box(1.6, 2.6, 0.2), 0x0b0806, { x: x0 + (x1 - x0) * f, y: t.h + 1.3, z: zP - 4.75 }, mDark, { cast: false });
        }
      };
      portico(TERR[0], TERR[0].z0 - 3.6, 7, true);
      portico(TERR[1], TERR[1].z0 - 3.6, 6, false);
      // the back colonnade on the top terrace, against the cliff
      for (let x = -46; x <= 47; x += 5.5) { pillar(x, BACK + 2.6, TOPH, 6.4, 1.4); K.box(x, BACK + 2.6, 0.75, 0.75, 0, TOPH + 6.6, { solid: true }); }
      put(box(96, 0.7, 2.6), lime2, { x: 0.5, y: TOPH + 7.15, z: BACK + 2.4 }, mStone);
      // the slalom: what is left of a portico's two staggered rows of pillars, standing on the top terrace road
      A.pillars = [];
      for (const [x, lat, h, broken] of [[-19, -1.6, 6.6, false], [-33, 1.6, 4.0, true], [-47, -1.6, 5.8, false]]) {
        const s = sAt(x, LEDGE.z), p = track.place(s, lat);
        pillar(p.x, p.z, TOPH, h, 2.0, broken);
        K.circle(p.x, p.z, 1.15, TOPH + h, { solid: true });
        AO(p.x + 0.8, p.z, 2.2, 1.6, 0.45, 0, TOPH + 0.09);
        A.pillars.push({ s, lat, tl: lat - Math.sign(lat) * 3.6, x: p.x, z: p.z, nx: p.nx, nz: p.nz });
      }
      // its fallen drums, off the road
      put(cyl(1.0, 1.0, 1.8, 10), lime, { x: 34, y: TOPH + 1.0, z: -108, rz: PI / 2, ry: 0.4 }, mStone);
      K.circle(34, -108, 1.4, TOPH + 2);
      put(box(2.0, 1.6, 2.0), lime, { x: 20, y: TOPH + 0.8, z: -99.2, ry: 0.5, rz: 0.2 }, mStone);
      put(box(2.0, 1.2, 2.0), lime, { x: 26, y: TOPH + 0.6, z: -100.5, ry: 1.1 }, mStone);
      K.box(20, -99.2, 1.4, 1.4, 0.5, TOPH + 1.6); K.box(26, -100.5, 1.4, 1.4, 1.1, TOPH + 1.2);
      // two seated colossi flanking the foot of the climb
      const colossus = parts([
        [box(5.2, 1.2, 7), 0xcaa676, { y: 0.6 }],
        [box(4.2, 5.0, 4.6), 0xd8b484, { y: 3.7, z: -0.8 }],
        [box(4.24, 0.5, 4.64), 0xd9a21b, { y: 5.4, z: -0.8 }],
        [box(4.24, 0.5, 4.64), 0x2a4f9a, { y: 4.7, z: -0.8 }],
        [box(1.0, 4.6, 1.0), 0xd2ae7e, { x: -0.75, y: 3.5, z: 2.0 }],
        [box(1.0, 4.6, 1.0), 0xd2ae7e, { x: 0.75, y: 3.5, z: 2.0 }],
        [box(2.6, 1.1, 3.0), 0xd2ae7e, { y: 6.6, z: 0.9 }],
        [rbox(3.0, 3.8, 1.9, 0.5), 0xd2ae7e, { y: 9.0, z: -0.6 }],
        [box(0.7, 0.7, 2.6), 0xc8a070, { x: -1.0, y: 7.4, z: 1.0 }],
        [box(0.7, 0.7, 2.6), 0xc8a070, { x: 1.0, y: 7.4, z: 1.0 }],
        [sph(1.0, 14, 10), 0xd2ae7e, { y: 11.6, z: -0.3, sy: 1.15 }],
        [box(2.6, 1.7, 1.1), 0xd9a21b, { y: 11.3, z: -1.0 }],
        [box(0.55, 1.9, 0.35), 0x2a4f9a, { x: -1.15, y: 10.5, z: 0.2 }],
        [box(0.55, 1.9, 0.35), 0x2a4f9a, { x: 1.15, y: 10.5, z: 0.2 }],
        [K.lathe([[0.9, 0], [0.95, 0.5], [0.6, 1.4], [0.35, 2.2], [0.001, 2.3]], 12), 0xf0e6d0, { y: 12.4, z: -0.3 }],
        [cyl(0.15, 0.1, 0.8, 6), 0x3a2a1a, { y: 10.4, z: 0.6 }],
      ]);
      for (const sd of [-1, 1]) {
        const x = sd * 17.5, z = -44.5;
        putG(colossus, { x, z }, mSmooth);
        AO(x, z, 3.6, 4.6, 0.5);
        K.box(x, z, 2.6, 3.5, 0, 14, { solid: true });
      }
    }

    // ============================================================ the cliffs: tomb doorways (the ledge, the camp, the west)
    {
      // where the face is at height y for cliff position x
      const faceZ = (x, y) => { const zf = zFoot(x); for (let t = -0.5; t < 10; t += 0.05) if (cliffH(x, zf - t) >= y) return zf - t; return zf - 10; };
      const doorway = (x, y0, w = 2.2, h = 3.2, wide = false) => {
        const zf = faceZ(x, y0 + 0.3) + 0.2;
        put(box(w, h, 4), 0x0b0806, { x, y: y0 + h / 2, z: zf - 2.1 }, mDark, { cast: false });
        for (const sd of [-1, 1]) put(box(0.55, h + 0.4, 0.8), 0xeadcbc, { x: x + sd * (w / 2 + 0.27), y: y0 + h / 2 + 0.1, z: zf - 0.1 }, mStone);
        put(box(w + 1.6, 0.7, 0.9), 0xe0cfaa, { x, y: y0 + h + 0.45, z: zf - 0.05 }, mStone);
        band(w + 1.4, 0.5, { x, y: y0 + h + 0.45, z: zf + 0.41 });
        if (wide) put(box(w + 3, 0.25, 2.2), 0xd8c49c, { x, y: y0 + 0.12, z: zf + 0.6 }, mStone);
        return zf;
      };
      // the sanctuary behind the top terrace, between the pillars of the back colonnade, a long frieze over it
      { const zf = doorway(17.25, TOPH, 3.0, 5.0); band(9, 0.6, { x: 17.25, y: TOPH + 6.6, z: zf + 0.05 }); }
      for (const x of [-60, -82]) { const s = sAt(x, LEDGE.z); doorway(x, roadY(s), 2.2, 3.2); }
      doorway(-148, 0, 2.4, 3.4, true);
      doorway(-30, cliffTop(-30) * 0.38 + 0.6, 2.0, 2.8);
      doorway(80, 0, 2.4, 3.4, true);
      doorway(112, 0, 2.6, 3.6, true);
      doorway(150, 0, 2.2, 3.2, true);
      doorway(132, cliffTop(132) * 0.38 + 0.6, 2.0, 2.8);
      doorway(-170, cliffTop(-170) * 0.38 + 0.6, 2.0, 2.6);
    }

    // ============================================================ the avenue of sphinxes
    {
      const sphinx = parts([
        [box(2.6, 0.7, 6.6), 0xd8c49c, { y: 0.35 }],
        [rbox(1.9, 1.4, 3.6, 0.5), 0xcfa676, { y: 1.35, z: -0.9 }],
        [rbox(1.7, 1.2, 1.4, 0.4), 0xcfa676, { y: 1.25, z: -2.4 }],
        [box(0.45, 0.42, 2.0), 0xcfa676, { x: -0.55, y: 0.9, z: 1.9 }],
        [box(0.45, 0.42, 2.0), 0xcfa676, { x: 0.55, y: 0.9, z: 1.9 }],
        [rbox(1.0, 1.4, 1.0, 0.25), 0xcfa676, { y: 2.45, z: 1.2 }],
        [box(1.5, 1.2, 0.9), 0xd9a21b, { y: 2.55, z: 0.75 }],
        [box(0.35, 1.0, 0.25), 0x2a4f9a, { x: -0.62, y: 2.0, z: 1.25 }],
        [box(0.35, 1.0, 0.25), 0x2a4f9a, { x: 0.62, y: 2.0, z: 1.25 }],
        [cyl(0.1, 0.06, 0.5, 6), 0x3a2a1a, { y: 1.75, z: 1.65 }],
      ]);
      const s0 = sAt(112, -31), s1 = sAt(34, -31);
      for (let s = s0; s <= s1 + 0.1; s += (s1 - s0) / 8) {
        for (const side of [-1, 1]) {
          const p = track.place(s, side * 11.6);
          // facing the road: local +z towards it
          const ry = side > 0 ? PI - p.angle : -p.angle;
          putG(sphinx, { x: p.x, z: p.z, ry }, mSmooth);
          AO(p.x, p.z, 3.6, 1.8, 0.45, p.angle + PI / 2);
          K.box(p.x, p.z, 3.3, 1.4, p.angle + PI / 2, 3.4, { solid: true });
        }
      }
    }

    // ============================================================ the work camp (north-east) and the west survey site
    const figure = (x, z, ry, shirt = 0xf2ece0, trous = 0xc8b48c, pose = 0) => {
      const skin = r.pick([0x9a6040, 0xb87a52, 0xd8a47c, 0x7a4a30]);
      const o = (dx, y, dz) => ({ x: x + dx * Math.cos(ry) + dz * Math.sin(ry), y, z: z - dx * Math.sin(ry) + dz * Math.cos(ry) });
      for (const sd of [-0.13, 0.13]) put(cyl(0.11, 0.1, 0.86, 6), trous, { ...o(0, 0.43, sd) }, mFabric);
      put(cyl(0.27, 0.22, 0.72, 8), shirt, { ...o(0, 1.2, 0) }, mFabric);
      for (const sd of [-0.33, 0.33]) put(cyl(0.07, 0.07, 0.66, 5), shirt, { ...o(pose ? 0.25 : 0, 1.2, sd), rz: pose ? -0.9 : 0, ry }, mFabric);
      put(sph(0.19, 8, 6), skin, { ...o(0, 1.76, 0) }, mSmooth);
      put(cyl(0.36, 0.36, 0.04, 10), 0xe8dcb8, { ...o(0, 1.9, 0) }, mFabric);
      put(sph(0.2, 8, 5), 0xe8dcb8, { ...o(0, 1.92, 0), sy: 0.6 }, mFabric);
      AO(x, z, 0.45, 0.45, 0.4);
    };
    const tent = (x, z, ry, len, wid, hgt, col) => {
      const sh = new T.Shape(); sh.moveTo(-wid / 2, 0); sh.lineTo(wid / 2, 0); sh.lineTo(0, hgt); sh.closePath();
      const g = new T.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false }); g.translate(0, 0, -len / 2);
      put(g, col, { x, z, ry: ry + PI / 2 }, mFabric);
      const d = new T.ShapeGeometry((() => { const s2 = new T.Shape(); s2.moveTo(-wid * 0.22, 0); s2.lineTo(wid * 0.22, 0); s2.lineTo(0, hgt * 0.62); s2.closePath(); return s2; })());
      d.translate(0, 0.01, len / 2 + 0.02);
      put(d, 0x3a2a1c, { x, z, ry: ry + PI / 2 }, mFabric, { cast: false });
      put(cyl(0.06, 0.06, hgt + 0.5, 5), 0x6a4a2a, { x: x + Math.cos(ry) * (len / 2 + 0.1), y: (hgt + 0.5) / 2, z: z - Math.sin(ry) * (len / 2 + 0.1) }, mWood);
      AO(x, z, len / 2 + 0.6, wid / 2 + 0.6, 0.42, -ry);
      K.box(x, z, len / 2, wid / 2, -ry, hgt);
    };
    const crate = (x, z, ry, s = 1, y = 0, col = 0xb08a58) => {
      put(box(s, s * 0.8, s * 0.8), col, { x, y: y + s * 0.4, z, ry }, mWood);
      put(box(s * 1.02, s * 0.1, s * 0.82), 0x7a5a36, { x, y: y + s * 0.4, z, ry }, mWood);
    };
    const jar = K.lathe([[0.001, 0], [0.18, 0.04], [0.42, 0.45], [0.46, 0.95], [0.3, 1.45], [0.16, 1.62], [0.2, 1.78], [0.16, 1.82], [0.001, 1.82]], 12);
    {
      // tents, a mess tent with a pyramid roof, the finds table under an awning
      tent(68, -60, 0.25, 5.5, 3.8, 3.0, 0xebdcbe);
      tent(82, -56, -0.1, 5.0, 3.6, 2.9, 0xcdb58a);
      tent(130, -64, 0.4, 5.5, 3.8, 3.0, 0xf2ece0);
      tent(142, -80, 1.45, 5.0, 3.6, 2.8, 0x9aa278);
      tent(60, -84, 1.2, 4.6, 3.4, 2.7, 0xe0cca4);
      {
        const x = 104, z = -86;
        put(box(7, 2.0, 5), 0xf2ece0, { x, y: 1.0, z }, mFabric);
        const roof = new T.ConeGeometry(1, 1, 4); roof.rotateY(PI / 4);
        put(roof, 0xe8dcc0, { x, y: 2.9, z, sx: 7.2 / Math.SQRT2 * 1.0, sy: 1.8, sz: 5.2 / Math.SQRT2 }, mFabric);
        put(box(7.1, 0.3, 5.1), 0xb83a2a, { x, y: 1.95, z }, mFabric);
        put(box(1.4, 1.6, 0.05), 0x3a2a1c, { x, y: 0.8, z: z + 2.53 }, mFabric, { cast: false });
        AO(x, z, 4.4, 3.4, 0.45);
        K.box(x, z, 3.6, 2.6, 0, 3.5);
        // a pennant pole
        put(cyl(0.08, 0.1, 7, 6), 0x6a4a2a, { x: x + 4.2, y: 3.5, z: z + 2.8 }, mWood);
        const fg = new T.Mesh(new T.PlaneGeometry(2.0, 1.1, 6, 1).translate(1.0, 0, 0), K.std({ color: 0xd9a21b, roughness: 0.8, side: T.DoubleSide }));
        fg.position.set(x + 4.2, 6.4, z + 2.8); fg.castShadow = true; K.group.add(fg);
        A.flags.push({ m: fg, x: x + 4.2, z: z + 2.8, ph: 0.4 });
        K.circle(x + 4.2, z + 2.8, 0.3, 7);
      }
      {
        // finds table under an awning
        const x = 94, z = -68;
        put(box(5, 0.15, 1.6), 0xa07a4c, { x, y: 1.1, z, ry: 0.1 }, mWood);
        for (const [dx, dz] of [[-2.3, -0.6], [2.3, -0.6], [-2.3, 0.6], [2.3, 0.6]]) put(cyl(0.07, 0.07, 1.1, 5), 0x6a4a2a, { x: x + dx, y: 0.55, z: z + dz }, mWood);
        for (let i = 0; i < 7; i++) put(jar, r.pick([0xb5532f, 0xa8603a, 0xc8865a, 0x8a4a2a]), { x: x - 2 + i * 0.66, y: 1.18, z: z + r.range(-0.3, 0.3), s: r.range(0.25, 0.4) }, mSmooth);
        for (const [dx, dz] of [[-3, -1.6], [3, -1.6], [-3, 1.6], [3, 1.6]]) put(cyl(0.06, 0.06, 3, 5), 0x6a4a2a, { x: x + dx, y: 1.5, z: z + dz }, mWood);
        put(box(6.4, 0.06, 3.6), 0xf0e6d2, { x, y: 3.0, z, rx: 0.05 }, mFabric);
        AO(x, z, 3.6, 2.2, 0.3);
      }
      // crates, sacks, water jars
      for (const [x, z, ry, s, y] of [[74, -66, 0.2, 1.1, 0], [75.2, -66.4, 0.1, 1.0, 0], [74.5, -66.2, 0.5, 0.9, 0.88], [118, -60, 0.6, 1.2, 0], [119.3, -60.8, 0.2, 1.0, 0], [136, -72, 1.0, 1.1, 0], [110, -96, 0.3, 1.0, 0], [111.2, -95, 0.8, 0.9, 0], [58, -76, 0.4, 1.0, 0]]) { crate(x, z, ry, s, y); AO(x, z, s * 0.9, s * 0.8, 0.35); }
      K.box(74.6, -66.2, 1.4, 0.9, 0.2, 2); K.box(118.6, -60.4, 1.4, 1, 0.5, 1.2); K.box(136, -72, 0.7, 0.6, 1, 1.1);
      for (let i = 0; i < 6; i++) { const x = 88 + (i % 3) * 0.9, z = -62 + Math.floor(i / 3) * 0.9; put(jar, 0xb8683e, { x, z, s: 0.55 }, mSmooth); AO(x, z, 0.4, 0.4, 0.35); }
      for (let i = 0; i < 5; i++) { const x = 123 + i * 0.7, z = -73 + (i % 2) * 0.5; put(sph(0.5, 8, 6), 0xd8c49a, { x, y: 0.32, z, sy: 0.65, sx: 1.2 }, mFabric); }
      // the mule cart
      {
        const x = 122, z = -50, ry = 0.15;
        const add = (geo, c, o, mat = mWood) => put(geo, c, { ...o, x: x + o.x * Math.cos(ry) + (o.z || 0) * Math.sin(ry), z: z - o.x * Math.sin(ry) + (o.z || 0) * Math.cos(ry), ry: (o.ry || 0) + ry }, mat);
        add(box(3.0, 0.22, 1.7), 0x8a6a42, { x: 0, y: 1.25 });
        add(box(3.0, 0.5, 0.1), 0x7a5a36, { x: 0, y: 1.6, z: 0.82 }); add(box(3.0, 0.5, 0.1), 0x7a5a36, { x: 0, y: 1.6, z: -0.82 });
        for (const sd of [-1, 1]) add(cyl(1.0, 1.0, 0.16, 14), 0x5a3a22, { x: -0.2, y: 1.0, z: sd * 1.0, rx: PI / 2 });
        for (const sd of [-1, 1]) add(box(2.8, 0.12, 0.12), 0x7a5a36, { x: -2.6, y: 1.3, z: sd * 0.5 });
        add(box(0.9, 0.7, 0.7), 0xb08a58, { x: 0.6, y: 1.72 }); add(sph(0.45, 8, 6), 0xd8c49a, { x: -0.5, y: 1.6, sy: 0.7, sx: 1.3 }, mFabric);
        // the mule
        add(rbox(2.0, 0.9, 0.8, 0.3), 0x7a6a5a, { x: -3.6, y: 1.5 }, mSmooth);
        for (const [dx, dz] of [[-0.75, -0.25], [-0.75, 0.25], [0.75, -0.25], [0.75, 0.25]]) add(cyl(0.11, 0.09, 1.1, 6), 0x5a4a3a, { x: -3.6 + dx, y: 0.55, z: dz }, mSmooth);
        add(box(0.9, 0.36, 0.32), 0x6a5a4a, { x: -4.85, y: 2.1, rz: 0.7 }, mSmooth);
        add(box(0.8, 0.36, 0.34), 0x7a6a5a, { x: -5.35, y: 2.35, rz: -0.25 }, mSmooth);
        for (const sd of [-0.1, 0.1]) add(box(0.1, 0.45, 0.08), 0x5a4a3a, { x: -5.0, y: 2.75, z: sd, rz: 0.3 }, mSmooth);
        AO(x - 1.6, z, 4.6, 1.4, 0.45, -ry);
        K.box(x - 1.6 * Math.cos(ry), z + 1.6 * Math.sin(ry), 4.4, 1.1, -ry, 2.2);
      }
      // the tripod hoist over the shaft by the tomb at x 112, a rope fence round the trench, a sieve and a wheelbarrow
      {
        const x = 112, z = -110.5, top = 6.2;
        for (let k = 0; k < 3; k++) {
          const a = k * TAU / 3 + 0.3, fx = x + Math.cos(a) * 2.4, fz = z + Math.sin(a) * 2.0;
          const len = Math.hypot(fx - x, top, fz - z), mid = new T.Vector3((fx + x) / 2, top / 2, (fz + z) / 2);
          const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(x - fx, top, z - fz).normalize());
          const e = new T.Euler().setFromQuaternion(q, 'YXZ');
          put(cyl(0.1, 0.12, len, 6), 0x7a5a36, { x: mid.x, y: mid.y, z: mid.z, rx: e.x, ry: e.y, rz: e.z }, mWood);
        }
        put(cyl(0.3, 0.3, 0.2, 10), 0x5a5a5a, { x, y: top - 0.3, z, rx: PI / 2 }, mWood);
        put(cyl(0.025, 0.025, top - 1.6, 4), 0xd8c49a, { x, y: (top + 1.0) / 2, z }, mFabric);
        put(cyl(0.3, 0.24, 0.5, 8), 0x8a6a42, { x, y: 0.9, z }, mWood);
      }
      {
        const x0 = 82, z0 = -100.5, w = 12, d = 7.5, posts = [];
        for (let i = 0; i <= 4; i++) posts.push([x0 + (w * i) / 4, z0], [x0 + (w * i) / 4, z0 + d]);
        for (let i = 1; i < 3; i++) posts.push([x0, z0 + (d * i) / 3], [x0 + w, z0 + (d * i) / 3]);
        for (const [x, z] of posts) put(cyl(0.06, 0.07, 1.0, 5), 0x7a5a36, { x, y: 0.5, z }, mWood);
        put(box(w, 0.04, 0.04), 0xe8dcb8, { x: x0 + w / 2, y: 0.85, z: z0 }, mFabric); put(box(w, 0.04, 0.04), 0xe8dcb8, { x: x0 + w / 2, y: 0.85, z: z0 + d }, mFabric);
        put(box(0.04, 0.04, d), 0xe8dcb8, { x: x0, y: 0.85, z: z0 + d / 2 }, mFabric); put(box(0.04, 0.04, d), 0xe8dcb8, { x: x0 + w, y: 0.85, z: z0 + d / 2 }, mFabric);
        // spoil heap
        put(sph(1.6, 10, 6), 0xc8a87a, { x: x0 + w + 3, y: 0, z: z0 + 2, sy: 0.6, sx: 1.4 }, mSmooth);
        put(box(1.6, 0.12, 1.0), 0x8a6a42, { x: 78, y: 0.9, z: -92, ry: 0.4 }, mWood);
        for (const [dx, dz] of [[-0.7, -0.4], [0.7, -0.4], [-0.7, 0.4], [0.7, 0.4]]) put(cyl(0.05, 0.05, 0.9, 4), 0x6a4a2a, { x: 78 + dx, y: 0.45, z: -92 + dz }, mWood);
        put(box(1.2, 0.4, 0.8), 0x5a6a7a, { x: 90, y: 0.6, z: -104, ry: 0.8 }, mWood);
        put(cyl(0.35, 0.35, 0.1, 10), 0x2a2a2a, { x: 90.6, y: 0.35, z: -104.6, rx: PI / 2, ry: 0.8 }, mWood);
      }
      // the archaeologists
      for (const [x, z, ry, sh, tr, pose] of [[92, -66, 0.3, 0xf2ece0, 0xc8b48c, 1], [96.5, -66.5, -0.4, 0x8aa0b8, 0xe0d4b8, 1], [86, -97, 1.2, 0xf2ece0, 0xb8a080, 1], [88.5, -102, -0.8, 0xc8b48c, 0x7a6a50, 0], [114, -106, 2.4, 0xf2ece0, 0xc8b48c, 1], [110.5, -107, 0.6, 0xa8b890, 0xc8b48c, 0], [124, -52, 2.0, 0xe8dcc8, 0x6a5a48, 1], [70, -63, 0.9, 0xd8c8a8, 0xb8a080, 0], [104, -80, 3.1, 0xf2ece0, 0xc8b48c, 0], [140, -86, -1.2, 0x8aa0b8, 0xc8b48c, 1]]) figure(x, z, ry, sh, tr, pose);
      // the survey site in the west: a theodolite under a parasol, a stairway found in the floor, a sledge with a block
      figure(-84, 24, 0.4, 0xf2ece0, 0xc8b48c, 1); figure(-90, 31, -0.9, 0xb8a888, 0x8a7a60, 0); figure(-74, 36, 2.2, 0xf2ece0, 0x7a6a50, 1);
      for (let k = 0; k < 3; k++) { const a = k * TAU / 3, fx = -78 + Math.cos(a) * 0.6, fz = 28 + Math.sin(a) * 0.6; put(cyl(0.04, 0.04, 1.6, 4), 0x7a5a36, { x: fx, y: 0.75, z: fz, rx: Math.sin(a) * 0.35, rz: -Math.cos(a) * 0.35 }, mWood); }
      put(box(0.3, 0.3, 0.45), 0xd9a21b, { x: -78, y: 1.6, z: 28 }, mSmooth);
      put(cyl(0.04, 0.04, 2.6, 4), 0x2a2a2a, { x: -80, y: 1.3, z: 26 }, mWood);
      put(new T.ConeGeometry(1.5, 0.6, 10, 1, true), 0xb83a2a, { x: -80, y: 2.6, z: 26 }, mFabric);
      {
        const x = -64, z = 14;
        put(box(3.2, 0.2, 4.6), 0x1a120c, { x, y: 0.02, z }, mDark, { cast: false });
        for (let i = 0; i < 4; i++) put(box(2.6, 0.12, 0.8), 0xe0cfaa, { x, y: -0.1 - i * 0.05 + 0.18, z: z + 1.8 - i * 0.9 }, mStone);
        for (const sd of [-1, 1]) put(box(0.5, 0.5, 4.8), 0xd8c49c, { x: x + sd * 1.85, y: 0.2, z }, mStone);
        K.box(x, z, 2.2, 2.6, 0, 0.8);
        put(box(3.4, 0.25, 1.2), 0x7a5a36, { x: -100, y: 0.12, z: 44, ry: 0.3 }, mWood);
        put(box(1.8, 1.2, 1.1), 0xd8c49c, { x: -100, y: 0.85, z: 44, ry: 0.3 }, mStone);
        AO(-100, 44, 2.2, 1.2, 0.4, -0.3);
        K.box(-100, 44, 1.8, 0.8, -0.3, 1.5);
      }
      // the expedition's dig house in the west: mud brick, a little dome, a walled yard
      {
        const x = -112, z = 50, mud = 0xb88c62, mud2 = 0xc89c70;
        put(box(9, 3.2, 6), mud, { x, y: 1.6, z }, mSmooth);
        put(box(9.3, 0.4, 6.3), mud2, { x, y: 3.3, z }, mSmooth);
        put(sph(2.2, 14, 8), mud2, { x: x + 2.4, y: 3.2, z, sy: 0.9 }, mSmooth);
        put(box(1.3, 2.0, 0.1), 0x2a1a10, { x: x - 1.5, y: 1.0, z: z + 3.02 }, mDark, { cast: false });
        for (const dx of [-3.5, 1, 3]) put(box(0.7, 0.7, 0.1), 0x2a1a10, { x: x + dx, y: 2.1, z: z + 3.02 }, mDark, { cast: false });
        for (const [a, b, c, d] of [[x - 4.5, z + 3, x - 4.5, z + 9], [x - 4.5, z + 9, x + 3, z + 9], [x + 4.5, z + 3, x + 4.5, z + 7]]) {
          const len = Math.hypot(c - a, d - b);
          put(box(len, 1.2, 0.5), mud, { x: (a + c) / 2, y: 0.6, z: (b + d) / 2, ry: -Math.atan2(d - b, c - a) }, mSmooth);
        }
        put(jar, 0xb8683e, { x: x + 3, z: z + 4.5, s: 0.6 }, mSmooth);
        AO(x, z, 5.6, 3.8, 0.5);
        K.box(x, z, 4.6, 3.1, 0, 4);
      }
      // camels couched by the camp, a few boundary stelae along the road
      for (const [x, z, ry] of [[128, -97, 0.4], [133, -99.5, -0.2], [124.5, -102, 1.2]]) {
        const camel = [
          [rbox(2.4, 1.0, 1.0, 0.4), 0xc49a68, { y: 0.55 }], [sph(0.62, 10, 6), 0xb88c5c, { y: 1.15, x: -0.1, sy: 0.9 }],
          [box(0.35, 1.3, 0.35), 0xc49a68, { x: 1.2, y: 1.1, rz: -0.45 }], [box(0.75, 0.32, 0.32), 0xb88c5c, { x: 1.6, y: 1.72 }],
          [box(0.1, 0.25, 0.1), 0x8a6a48, { x: -1.3, y: 0.7, rz: 0.5 }], [rbox(1.8, 0.1, 1.1, 0.05), 0x9a3a2a, { y: 1.05, x: -0.1 }],
        ];
        for (const [g0, c, o] of camel) put(g0, c, { ...o, x: x + (o.x || 0) * Math.cos(ry), z: z - (o.x || 0) * Math.sin(ry), ry }, mSmooth);
        AO(x, z, 1.6, 0.8, 0.45, -ry);
        K.box(x, z, 1.4, 0.7, -ry, 1.6);
      }
      {
        const stela = parts([[box(1.0, 1.4, 0.3), 0xe0cfaa, { y: 0.7 }], [cyl(0.5, 0.5, 0.3, 12, false), 0xe0cfaa, { y: 1.4, rx: PI / 2 }], [box(0.8, 0.25, 0.05), 0x2a4f9a, { y: 1.15, z: 0.16 }], [box(0.8, 0.12, 0.05), 0xd9a21b, { y: 0.92, z: 0.16 }]]);
        for (let s = 70; s < L - 30; s += 64) {
          if (s > S.A0 - 30 && s < S.D1 + 20) continue;
          if (s > sJ0 - 12 && s < sW + 16) continue;
          const side = (Math.round(s / 64) % 2) ? 1 : -1, p = track.place(s, side * (wAt(s) / 2 + 3.2));
          if (!K.offRoad(p.x, p.z, 2.5)) continue;
          putG(stela, { x: p.x, y: Math.max(0, H(p.x, p.z)) - 0.1, z: p.z, ry: -p.angle + PI / 2 }, mSmooth);
          AO(p.x, p.z, 0.8, 0.5, 0.4, p.angle);
          K.circle(p.x, p.z, 0.55, 1.8);
        }
      }
      // a fallen obelisk in two pieces, and a colossal head half sunk in the dunes
      {
        const ob = (len, w0, w1) => { const g = new T.BoxGeometry(len, 1, 1).toNonIndexed(); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const k = lerp(w0, w1, p.getX(i) / len + 0.5); p.setY(i, p.getY(i) * k); p.setZ(i, p.getZ(i) * k); } g.computeVertexNormals(); return g; };
        put(ob(9, 1.5, 1.25), 0xb87a6a, { x: -46, y: 0.7, z: 52, ry: 0.35 }, mSmooth);
        put(ob(6, 1.2, 0.9), 0xb87a6a, { x: -36.5, y: 0.55, z: 49, ry: 0.55, rx: 0.2 }, mSmooth);
        put(new T.ConeGeometry(0.64, 0.8, 4), 0xd9a21b, { x: -33.2, y: 0.5, z: 47.2, rz: -PI / 2, ry: 0.55 + PI / 4 }, mSmooth);
        AO(-42, 51, 8, 1.8, 0.4, -0.4);
        K.capsule(-50, 53.5, -34, 47.5, 1.0, 1.6);
        const hx = 76, hz = 30;
        put(sph(3.0, 18, 12), 0xd2ae7e, { x: hx, y: 0.6, z: hz, sy: 1.15 }, mSmooth);
        put(box(6.2, 3.4, 2.6), 0xd9a21b, { x: hx, y: 1.4, z: hz - 1.8, rx: -0.15 }, mSmooth);
        put(box(1.2, 3.2, 0.8), 0x2a4f9a, { x: hx - 2.7, y: 0.5, z: hz + 0.6 }, mSmooth);
        put(box(1.2, 3.2, 0.8), 0x2a4f9a, { x: hx + 2.7, y: 0.5, z: hz + 0.6 }, mSmooth);
        put(box(0.7, 1.0, 0.8), 0xc8a070, { x: hx, y: 1.6, z: hz + 3.0, rx: 0.3 }, mSmooth);
        AO(hx, hz, 5, 4, 0.5);
        K.circle(hx, hz, 3.6, 5);
      }
      // a new tomb being dug out in the middle of the valley: a stairway cut down into the rock, a tripod hoist over
      // it, a little spoil railway with tip wagons out to the sand heaps, wheelbarrows, baskets, tents and the diggers
      {
        const ex = DIG.x - 16, ez = DIG.z, pl = 8, pw = 3.6; // the stairway's mouth; it runs down towards the west
        const gy = (x, z) => H(x, z);
        let y0 = 0;
        for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) y0 = Math.max(y0, gy(ex + (dx * pl) / 2, ez + (dz * pw) / 2));
        const stairC = canvas(256, 128, (g, w, h) => {
          const q = g.createLinearGradient(w, 0, 0, 0);
          q.addColorStop(0, '#c9a676'); q.addColorStop(0.55, '#6a5036'); q.addColorStop(1, '#0b0806');
          g.fillStyle = q; g.fillRect(0, 0, w, h);
          for (let k = 0; k < 10; k++) {
            const x = w - 6 - k * 21;
            g.fillStyle = `rgba(255,236,200,${0.5 - k * 0.045})`; g.fillRect(x - 3, 12, 3, h - 24);
            g.fillStyle = `rgba(0,0,0,${0.22 + k * 0.05})`; g.fillRect(x - 21, 12, 18, h - 24);
          }
          g.fillStyle = 'rgba(40,28,16,0.9)'; g.fillRect(0, 0, w, 12); g.fillRect(0, h - 12, w, 12);
          g.fillStyle = '#050302'; g.fillRect(0, 30, 30, h - 60); // the doorway at the foot of the stairs
        });
        const pit = K.mesh(new T.PlaneGeometry(pl, pw).rotateX(-PI / 2), K.std({ map: tex(stairC, [1, 1], false), roughness: 1 }), ex, y0 + 0.08, ez, { cast: false });
        pit.renderOrder = 1;
        for (const sd of [-1, 1]) put(box(pl + 0.8, 0.5, 0.45), 0xc8b08c, { x: ex, y: y0 + 0.2, z: ez + sd * (pw / 2 + 0.22) }, mStone);
        put(box(0.45, 0.5, pw + 0.9), 0xc8b08c, { x: ex + pl / 2 + 0.22, y: y0 + 0.2, z: ez }, mStone);
        put(box(0.7, 1.3, pw + 0.9), 0xb89a74, { x: ex - pl / 2 - 0.35, y: y0 + 0.5, z: ez }, mStone); // the rock face over the door
        AO(ex, ez, pl / 2 + 1, pw / 2 + 1, 0.35);
        K.box(ex, ez, pl / 2 + 0.6, pw / 2 + 0.6, 0, 1.3);
        // a rod between two points (pre-rotated, then placed by put)
        const up = new T.Vector3(0, 1, 0), dir = new T.Vector3(), rq = new T.Quaternion();
        const rod = (ax, ay, az, bx, by, bz, rad, col, mat) => {
          dir.set(bx - ax, by - ay, bz - az); const len = dir.length(); dir.normalize();
          const g = cyl(rad, rad, len, 6); g.applyQuaternion(rq.setFromUnitVectors(up, dir));
          put(g, col, { x: (ax + bx) / 2, y: (ay + by) / 2, z: (az + bz) / 2 }, mat);
        };
        // the tripod hoist over the stairway, a rope and a basket on its way up
        const hx = ex - 1, top = y0 + 6.4;
        for (let k = 0; k < 3; k++) {
          const a = (k * TAU) / 3 + 0.5, fx = hx + Math.cos(a) * 3.3, fz = ez + Math.sin(a) * 3.3;
          rod(fx, gy(fx, fz), fz, hx, top, ez, 0.12, 0x7a5a36, mWood);
          K.circle(fx, fz, 0.3, 4);
        }
        put(cyl(0.3, 0.3, 0.22, 10), 0x4a3a2a, { x: hx, y: top - 0.25, z: ez, rx: PI / 2 }, mWood);
        rod(hx, top - 0.3, ez, hx, y0 + 2.2, ez, 0.03, 0xd8c8a0, mFabric);
        put(cyl(0.45, 0.32, 0.55, 10), 0x9a7a4a, { x: hx, y: y0 + 1.9, z: ez }, mFabric);
        // the spoil railway: two rails on sleepers from the stairway out to the heaps
        const r0 = ex + pl / 2 + 1.2, r1 = ex + 30;
        for (const sd of [-0.55, 0.55]) put(box(r1 - r0, 0.1, 0.1), 0x5a5048, { x: (r0 + r1) / 2, y: gy((r0 + r1) / 2, ez) + 0.2, z: ez + sd }, mSmooth);
        for (let x = r0 + 0.4; x < r1; x += 1.1) put(box(0.32, 0.08, 1.6), 0x6a4a2a, { x, y: gy(x, ez) + 0.12, z: ez }, mWood);
        // tip wagons: a square skip on a little chassis; the last one tipping onto the heap
        const wagon = (x, tip) => {
          const y = gy(x, ez) + 0.25;
          put(box(1.5, 0.22, 1.2), 0x3a3a38, { x, y: y + 0.32, z: ez }, mSmooth);
          for (const [dx, dz] of [[-0.5, -0.55], [0.5, -0.55], [-0.5, 0.55], [0.5, 0.55]]) put(cyl(0.24, 0.24, 0.1, 10), 0x2a2a28, { x: x + dx, y: y + 0.22, z: ez + dz, rx: PI / 2 }, mSmooth);
          put(cyl(0.95, 0.6, 0.85, 4), 0x8a5a36, { x, y: y + 0.9, z: ez, ry: PI / 4, rz: tip ? -0.75 : 0, order: 'XZY' }, mSmooth);
          if (!tip) put(cyl(0.8, 0.8, 0.12, 4), 0xd8bc8c, { x, y: y + 1.28, z: ez, ry: PI / 4 }, mSmooth);
          AO(x, ez, 1.0, 0.9, 0.35);
          K.circle(x, ez, 0.9, 1.8);
        };
        wagon(ex + 9, false); wagon(ex + 11.2, false); wagon(r1 - 0.8, true);
        // the spoil heaps, a little paler where fresh sand was tipped
        for (const [dx, dz, rr, hh, col] of [[34, -3.5, 6.5, 4.2, 0xdcb98a], [31.5, 8.5, 5.2, 3.4, 0xd0aa7a], [41, 5, 4.2, 2.6, 0xe4c49a], [42, -9, 3.6, 2.2, 0xd6b282]]) {
          const x = ex + dx, z = ez + dz;
          put(K.lathe([[rr, 0], [rr * 0.9, hh * 0.15], [rr * 0.6, hh * 0.6], [rr * 0.25, hh * 0.96], [0.001, hh]], 18), col, { x, y: gy(x, z) - 0.15, z, sz: 0.85, ry: dx }, mSmooth);
          AO(x, z, rr * 1.05, rr * 0.95, 0.3);
          K.circle(x, z, rr * 0.75, hh);
        }
        // wheelbarrows, baskets, a sieve on trestles, two tents, the diggers and their foreman
        const barrow = (x, z, ry) => {
          const y = gy(x, z);
          put(box(1.3, 0.45, 0.9), 0x5a6a6a, { x, y: y + 0.55, z, ry }, mSmooth);
          put(cyl(0.3, 0.3, 0.12, 10), 0x2a2a28, { x: x + Math.cos(ry) * 0.85, y: y + 0.3, z: z - Math.sin(ry) * 0.85, rx: PI / 2, ry }, mSmooth);
          for (const sd of [-0.32, 0.32]) put(box(1.3, 0.08, 0.08), 0x7a5a36, { x: x - Math.cos(ry) * 0.9 + Math.sin(ry) * sd, y: y + 0.55, z: z + Math.sin(ry) * 0.9 + Math.cos(ry) * sd, ry }, mWood);
          AO(x, z, 1.1, 0.7, 0.3, ry);
        };
        barrow(ex + 4, ez + 4, 0.4); barrow(ex + 14, ez - 4, -0.3);
        for (const [dx, dz] of [[2, -3.6], [2.6, -3.0], [1.4, -3.1], [-6.5, 3.6]]) { const x = ex + dx, z = ez + dz; put(cyl(0.42, 0.3, 0.42, 10), 0x9a7a4a, { x, y: gy(x, z) + 0.21, z }, mFabric); }
        {
          const sx = ex + 6, sz = ez + 7, y = gy(sx, sz);
          for (const sd of [-1, 1]) for (const k of [-1, 1]) put(cyl(0.06, 0.06, 1.1, 5), 0x6a4a2a, { x: sx + sd * 1.0, y: y + 0.55, z: sz + k * 0.6 }, mWood);
          put(box(2.4, 0.12, 1.5), 0x8a6a42, { x: sx, y: y + 1.1, z: sz }, mWood);
          put(box(2.0, 0.06, 1.2), 0xb09868, { x: sx, y: y + 1.18, z: sz }, mFabric);
          AO(sx, sz, 1.5, 1.0, 0.3);
        }
        tent(ex - 9, ez + 11, 0.3, 4.5, 3.2, 2.6, 0xebdcbe);
        tent(ex - 2, ez + 13, -0.2, 4.0, 3.0, 2.4, 0xd8c49c);
        figure(ex + 1.5, ez + 2.9, PI / 2); figure(ex - 2.2, ez - 2.9, -PI / 2, 0xe8e0d0, 0xc8b48c, 1);
        figure(ex + 7.5, ez + 1.4, PI, 0xd8cdb8); figure(ex + 12.8, ez - 1.3, 0.2, 0xf2ece0, 0xa89070, 1);
        figure(ex + 27, ez + 2.2, -PI / 2, 0xe8dcc8); figure(ex + 6.4, ez + 5.6, -0.4, 0xb8a070, 0x8a7a5a); // the foreman in khaki at the sieve
        figure(ex + 15, ez - 4.6, 1.2, 0xf2ece0, 0xc8b48c, 1);
      }
    }

    // ============================================================ the jump: a ramp of stone and timber over the wadi, marker posts
    {
      const p = track.at((sJ0 + sJ1) / 2);
      const g = new T.BoxGeometry(JUMP.len, 1, W + 2).toNonIndexed(), pp = g.attributes.position;
      for (let i = 0; i < pp.count; i++) { const x = pp.getX(i); pp.setY(i, pp.getY(i) > 0 ? JUMP.h * (x / JUMP.len + 0.5) : 0); }
      g.computeVertexNormals();
      put(g, 0xd8c49c, { x: p.x, z: p.z, ry: -p.angle }, mStone);
      const q = track.at(sJ1);
      put(box(0.6, 0.45, W + 2.2), 0x7a5a36, { x: q.x - Math.cos(q.angle) * 0.3, y: JUMP.h - 0.2, z: q.z - Math.sin(q.angle) * 0.3, ry: -q.angle }, mWood);
      for (let k = 0; k < 6; k++) { const qq = track.at(sJ0 + 1 + k * 1.4); put(box(0.12, 0.04, W + 1.6), 0x8a6a42, { x: qq.x, y: JUMP.h * (k * 1.4 + 1) / JUMP.len + 0.03, z: qq.z, ry: -qq.angle, rz: Math.atan2(JUMP.h, JUMP.len) }, mWood); }
      AO(p.x, p.z, JUMP.len / 2 + 0.5, W / 2 + 1.5, 0.35, p.angle);
      for (const [s, h] of [[sJ1, 3.4], [sW + hwAlong + 0.8, 2.6]]) {
        for (const side of [-1, 1]) {
          const m = track.place(s, side * (W / 2 + 1.8));
          for (let k = 0; k < 4; k++) put(cyl(0.16, 0.16, h / 4, 8), k % 2 ? 0xf2ece0 : 0xb83a2a, { x: m.x, y: (k + 0.5) * h / 4, z: m.z }, mWood);
          K.circle(m.x, m.z, 0.3, h);
          AO(m.x, m.z, 0.5, 0.5, 0.4);
        }
      }
    }

    // ============================================================ scatter: boulders, outcrops, stones, grass tufts, potsherds
    {
      const lime = [0xd8c09a, 0xcaa47a, 0xe2ceaa, 0xb89068, 0xc8b08c];
      const free = (x, z, m) => K.offRoad(x, z, m) && x > TX0 + 4 && x < TX1 - 4 && z < TZ1 - 4 && z > zFoot(x) + 1.5 && wadiD(x, z) > wadiHW(wadiA(x, z), x) + 1;
      // outcrops (blocky limestone boulders) in the infields, solid
      const outcrops = [[40, 50, 3], [118, 40, 2], [-120, 60, 3], [-40, -10, 2], [10, 20, 2], [-130, 20, 2], [60, -2, 2], [-20, 60, 2], [126, 8, 2], [-100, -60, 3], [-70, -66, 2], [-82, -24, 3], [100, 62, 2], [-30, 30, 2], [20, -10, 2], [-136, -60, 2], [-60, 72, 2], [96, 10, 2]];
      for (const [cx, cz, n] of outcrops) {
        for (let i = 0; i < n + 2; i++) {
          const x = cx + r.range(-4, 4), z = cz + r.range(-3, 3), s = r.range(1.0, 2.6) * (i < n ? 1 : 0.5);
          if (!free(x, z, s + 3)) continue;
          rocks.push({ x, y: Math.max(0, H(x, z)) + s * 0.35, z, ry: r() * TAU, rx: r.range(-0.3, 0.3), sx: s * r.range(1, 1.5), sy: s * r.range(0.7, 1.0), sz: s, color: r.pick(lime) });
          AO(x, z, s * 1.3, s * 1.1, 0.4);
          if (s > 1.4) K.circle(x, z, s * 0.9, s * 1.4);
        }
      }
      // boulders on the wadi floor and along its rim, scree at the cliff foot
      for (let a = 4; a < WF.len - 12; a += 3) {
        const q = WF.at(a), hw = wadiHW(a, q.x);
        if (q.x > -50 || q.x < -170) continue;
        if (r() < 0.6) { const off = r.range(-hw * 0.6, hw * 0.6), x = q.x - q.tz * off, z = q.z + q.tx * off, s = r.range(0.5, 1.4); rocks.push({ x, y: wadiFloor(a, q.x) + s * 0.3, z, ry: r() * TAU, s, color: r.pick([0x8a7058, 0x7a6450, 0x9a8064]) }); }
        for (const sd of [-1, 1]) {
          if (r() < 0.5) continue;
          const off = sd * (hw + r.range(0.8, 2.2)), x = q.x - q.tz * off, z = q.z + q.tx * off;
          if (!K.offRoad(x, z, 1.5) || z < -98) continue;
          const s = r.range(0.35, 0.8);
          rocks.push({ x, y: H(x, z) + s * 0.3, z, ry: r() * TAU, s, color: r.pick(lime) });
        }
      }
      for (let i = 0; i < 160; i++) {
        const x = r.range(TX0 + 4, TX1 - 4), z = zFoot(x) + r.range(1, 7);
        if (!K.offRoad(x, z, 1.5) || (x > -52 && x < 52) || (x > -125 && x < -46)) continue;
        const s = r.range(0.3, 1.3);
        rocks.push({ x, y: Math.max(0, H(x, z)) + s * 0.3, z, ry: r() * TAU, rx: r() * 2, s, color: r.pick(lime) });
      }
      // stones scattered over the valley floor
      const nSt = lowQ ? 260 : 520;
      for (let i = 0; i < nSt; i++) {
        const x = r.range(TX0 + 4, TX1 - 4), z = r.range(-96, TZ1 - 4);
        if (!free(x, z, 1.2)) continue;
        const s = r.range(0.15, 0.5);
        stones.push({ x, y: H(x, z) + s * 0.2, z, ry: r() * TAU, sx: s * 1.3, sy: s, sz: s, color: r.pick(lime) });
      }
      K.instances(rockGeo, rockMat, stones, { colors: true, cast: !lowQ });
      K.instances(boulderGeo, rockMat, rocks, { colors: true });
      // dry grass tufts on the flats and the wadi banks
      const tuftGeo = (() => {
        const pos = [];
        for (let k = 0; k < 7; k++) {
          const a = k * TAU / 7 + 0.3, lean = 0.35 + (k % 3) * 0.12, hgt = 0.7 + (k % 2) * 0.35;
          const bx = Math.cos(a) * 0.08, bz = Math.sin(a) * 0.08, tx = Math.cos(a) * lean, tz = Math.sin(a) * lean;
          pos.push(bx - Math.sin(a) * 0.05, 0, bz + Math.cos(a) * 0.05, bx + Math.sin(a) * 0.05, 0, bz - Math.cos(a) * 0.05, tx, hgt, tz);
        }
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
        return g;
      })();
      const tufts = [];
      const nTu = lowQ ? 140 : 300;
      for (let i = 0; i < nTu; i++) {
        let x, z;
        if (i % 3 === 0) { const q = WF.at(r.range(50, WF.len - 15)); const off = (r() < 0.5 ? -1 : 1) * (wadiHW(60, q.x) + r.range(0.8, 3)); x = q.x - q.tz * off; z = q.z + q.tx * off; }
        else { x = r.range(TX0 + 5, TX1 - 5); z = r.range(-90, TZ1 - 4); }
        if (!free(x, z, 1.4)) continue;
        tufts.push({ x, y: H(x, z) - 0.05, z, ry: r() * TAU, s: r.range(0.7, 1.4), color: r.pick([0xc8b070, 0xb8a060, 0xa89a5a, 0xd8c080]) });
      }
      K.instances(tuftGeo, K.std({ vertexColors: false, roughness: 0.9, side: T.DoubleSide }), tufts, { colors: true, cast: false });
      // potsherds round the camp and the site
      const sherds = [];
      for (let i = 0; i < (lowQ ? 40 : 80); i++) {
        const atCamp = i % 3 !== 0, cx = atCamp ? CAMP.x : SITE.x, cz = atCamp ? CAMP.z : SITE.z;
        const x = cx + r.gauss() * (atCamp ? 18 : 10), z = cz + r.gauss() * (atCamp ? 12 : 8);
        if (!free(x, z, 1)) continue;
        sherds.push({ x, y: H(x, z) + 0.05, z, ry: r() * TAU, rx: r.range(-0.3, 0.3), s: r.range(0.8, 1.6), color: r.pick([0x9a5a3a, 0x8a5a40, 0xa8784e, 0x7a4a32]) });
      }
      K.instances(new T.BoxGeometry(0.34, 0.05, 0.24), K.std({ roughness: 0.7 }), sherds, { colors: true, cast: false });
    }

    // ============================================================ the sand drifts (built up and blown away in animate)
    {
      const g = new T.SphereGeometry(1, 20, 10, 0, TAU, 0, PI / 2);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), y = p.getY(i); p.setY(i, y * (1 + 0.25 * Math.sin(x * 4 + z * 2)) * (1 - 0.35 * Math.max(0, x))); }
      g.computeVertexNormals();
      const dm = K.std({ color: 0xf0c888, roughness: 0.95, normalMap: ripple, normalScale: V2(0.7) });
      const im = new T.InstancedMesh(g, dm, A.drifts.length);
      im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; im.visible = false;
      A.drifts.forEach((d) => { d.sx = d.r * 1.08; d.sy = 0.6; d.sz = d.r * 0.72; d.q = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), -(d.ang + PI / 2) + 0.35); });
      K.group.add(im);
      A.driftIM = im;
    }

    // ============================================================ the diorama: frame, base, display table, gallery floor, backdrop, placard
    {
      const wood = TX.woodTextures({ size: 512, seed: 19, planks: 1, base: 0x6a3e22, dark: 0x3e2212, light: 0x8a5a34, ringFreq: 14, gap: 0, roughBase: 0.45, lacquer: 0.6 });
      for (const t of Object.values(wood)) { t.rotation = PI / 2; t.center.set(0.5, 0.5); }
      const frameMat = K.std({ map: wood.map, normalMap: wood.normalMap, roughnessMap: wood.roughnessMap, normalScale: V2(0.5) });
      const FB = -15, boards = [];
      const board = (w, h, d, x, y, z) => { const g = new T.BoxGeometry(w, h, d).toNonIndexed(); const uv = g.attributes.uv, len = Math.max(w, d) / 60; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * len); g.translate(x, y, z); boards.push(g); };
      const hgt = 0.3 - FB;
      board(TX1 - TX0 + 10, hgt, 5, 0, FB + hgt / 2, TZ1 + 2.5);
      board(5, hgt, TZ1 - TZ0 + 5, TX0 - 2.5, FB + hgt / 2, (TZ0 + TZ1) / 2 + 2.5);
      board(5, hgt, TZ1 - TZ0 + 5, TX1 + 2.5, FB + hgt / 2, (TZ0 + TZ1) / 2 + 2.5);
      board(TX1 - TX0 + 10, hgt + 48, 5, 0, FB + (hgt + 48) / 2, TZ0 - 2.5);
      K.mesh(BU.mergeGeometries(boards), frameMat, 0, 0, 0, { cast: false });
      const tableMat = K.std({ color: 0x1c1a1e, roughness: 0.55, metalness: 0.1 });
      const tp = [new T.BoxGeometry(TX1 - TX0 + 16, 3, TZ1 - TZ0 + 16).translate(0, FB - 1.5, (TZ0 + TZ1) / 2), new T.BoxGeometry(TX1 - TX0 + 8, 10, TZ1 - TZ0 + 8).translate(0, FB - 8, (TZ0 + TZ1) / 2)];
      for (const [lx, lz] of [[TX0, TZ1], [TX1, TZ1], [TX0, TZ0], [TX1, TZ0]]) tp.push(new T.BoxGeometry(7, 64, 7).translate(lx, -45, lz));
      K.mesh(BU.mergeGeometries(tp), tableMat, 0, 0, 0, { cast: false });
      // museum floor: dark stone tiles
      const fl = canvas(512, 512, (g) => { for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const k = 40 + ((x * 7 + y * 13) % 5) * 4; g.fillStyle = `rgb(${k + 8},${k},${k - 4})`; g.fillRect(x * 128, y * 128, 128, 128); g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 3; g.strokeRect(x * 128, y * 128, 128, 128); } });
      K.mesh(new T.PlaneGeometry(1800, 1800), K.phys({ map: tex(fl, [18, 18]), roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.25 }), 0, -76, 0, { rx: -PI / 2, cast: false });
      const shm = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5, alphaMap: TX.blobShadowTexture(), depthWrite: false }));
      shm.rotation.x = -PI / 2; shm.scale.set(470, 330, 1); shm.position.set(10, -75.9, -10); K.group.add(shm);
      // brass stanchions with a rope in front of the exhibit
      const brass = K.metal(0xc9a24a, 0.25);
      const ropeMat = K.std({ color: 0x7a0f18, roughness: 0.9 });
      const postG = K.lathe([[0.01, 0], [7, 0], [7.2, 0.8], [5, 1.6], [1.4, 2.4], [1.1, 30], [1.6, 31], [2.6, 33], [2.4, 34.6], [0.01, 35.2]], 20);
      const postL = [];
      for (let k = 0; k < 6; k++) postL.push(postG.clone().translate(-250 + k * 100, -76, 160));
      K.mesh(BU.mergeGeometries(postL), brass, 0, 0, 0, { cast: false });
      const ropes = [];
      for (let k = 0; k < 5; k++) { const a = new T.Vector3(-250 + k * 100, -44, 160), b = new T.Vector3(-150 + k * 100, -44, 160), mid = a.clone().lerp(b, 0.5); mid.y -= 9; ropes.push(new T.TubeGeometry(new T.QuadraticBezierCurve3(a, mid, b), 20, 1.1, 6)); }
      K.mesh(BU.mergeGeometries(ropes), ropeMat, 0, 0, 0, { cast: false });
      // the painted backdrop: a sunset sky over distant desert hills, sweeping up behind the cliffs
      const bc = TX.makeCanvas(1024, 512), g = bc.getContext('2d');
      const sky = g.createLinearGradient(0, 512, 0, 0);
      sky.addColorStop(0, '#f6b25a'); sky.addColorStop(0.16, '#f08a58'); sky.addColorStop(0.36, '#d8646a'); sky.addColorStop(0.6, '#7a3e6a'); sky.addColorStop(0.85, '#2e1e44'); sky.addColorStop(1, '#14101e');
      g.fillStyle = sky; g.fillRect(0, 0, 1024, 512);
      const sun = g.createRadialGradient(150, 360, 0, 150, 360, 160); sun.addColorStop(0, 'rgba(255,240,200,0.95)'); sun.addColorStop(0.12, 'rgba(255,214,150,0.8)'); sun.addColorStop(0.4, 'rgba(255,170,110,0.25)'); sun.addColorStop(1, 'rgba(255,150,100,0)');
      g.fillStyle = sun; g.fillRect(0, 150, 420, 362);
      const rr = K.rng(51);
      for (let i = 0; i < 16; i++) { const y = 140 + rr() * 200, x = rr() * 1024, w = 60 + rr() * 200; g.fillStyle = `rgba(255,${150 + rr() * 60},${120 + rr() * 40},${0.12 + rr() * 0.15})`; g.beginPath(); g.ellipse(x, y, w, 4 + rr() * 6, 0, 0, TAU); g.fill(); }
      for (let i = 0; i < 900; i++) { const y = rr() * 512; g.strokeStyle = `rgba(${rr() < 0.5 ? '255,220,190' : '60,30,40'},${0.025 + rr() * 0.035})`; g.lineWidth = 2 + rr() * 5; g.beginPath(); const x = rr() * 1024; g.moveTo(x, y); g.lineTo(x + 20 + rr() * 60, y + (rr() - 0.5) * 6); g.stroke(); }
      const ridge = (y0, amp, col, seed) => { const q = K.rng(seed); g.fillStyle = col; g.beginPath(); g.moveTo(0, 512); for (let x = 0; x <= 1024; x += 8) { let y = y0 - amp * (0.5 + 0.5 * Math.sin(x / 120 + seed)) - (q() - 0.5) * amp * 0.12; if (q() < 0.03) y -= amp * 0.4; g.lineTo(x, y); } g.lineTo(1024, 512); g.closePath(); g.fill(); };
      ridge(400, 40, 'rgba(150,80,90,0.75)', 3);
      ridge(424, 26, 'rgba(120,64,64,0.9)', 7);
      ridge(446, 16, '#7a4a3a', 11);
      const bt = TX.toTexture(bc, { wrap: false });
      const prof = [[TZ0 - 4, 30], [TZ0 - 6, 44], [TZ0 - 9, 58], [TZ0 - 12, 72], [TZ0 - 14, 90], [TZ0 - 15, 112]];
      let tot = 0; const acc = [0];
      for (let i = 1; i < prof.length; i++) { tot += Math.hypot(prof[i][0] - prof[i - 1][0], prof[i][1] - prof[i - 1][1]); acc.push(tot); }
      const segX = 40, pos = [], uv = [], idx = [];
      for (let j = 0; j < prof.length; j++) for (let i = 0; i <= segX; i++) { const x = TX0 - 4 + (TX1 - TX0 + 8) * i / segX; pos.push(x, prof[j][1], prof[j][0]); uv.push(i / segX, acc[j] / tot); }
      for (let j = 0; j < prof.length - 1; j++) for (let i = 0; i < segX; i++) { const a = j * (segX + 1) + i; idx.push(a, a + 1, a + segX + 1, a + 1, a + segX + 2, a + segX + 1); }
      const bg = new T.BufferGeometry(); bg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); bg.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); bg.setIndex(idx); bg.computeVertexNormals();
      const back = new T.Mesh(bg, new T.MeshBasicMaterial({ map: bt, color: 0xf0e4dc, side: T.DoubleSide, fog: false }));
      K.group.add(back);
      // placard on the front of the frame
      const pc = canvas(512, 224, (gg) => {
        gg.fillStyle = '#f4ecdc'; gg.fillRect(0, 0, 512, 224);
        gg.strokeStyle = '#2c2a28'; gg.lineWidth = 3; gg.strokeRect(10, 10, 492, 204);
        gg.fillStyle = '#d9a21b'; gg.beginPath(); gg.ellipse(70, 112, 30, 50, 0, 0, TAU); gg.fill();
        gg.strokeStyle = '#2a4f9a'; gg.lineWidth = 5; gg.beginPath(); gg.ellipse(70, 112, 30, 50, 0, 0, TAU); gg.stroke();
        gg.fillStyle = '#1f1d1b'; gg.font = '700 46px Georgia, serif'; gg.textAlign = 'left';
        gg.fillText('VALLEY OF THE', 122, 76); gg.fillText('ROYAL TOMBS', 122, 122);
        gg.font = 'italic 24px Georgia, serif'; gg.fillStyle = '#4a4440'; gg.fillText('the necropolis at sunset · diorama 1 : 100', 122, 162);
        gg.font = '20px Rubik, Arial, sans-serif'; gg.fillText('gallery of the ancient world', 122, 192);
      });
      const card = K.mesh(new T.PlaneGeometry(22, 9.6), K.std({ map: tex(pc, [1, 1], false), roughness: 0.6 }), 96, FB / 2 + 2, TZ1 + 5.06, { cast: false });
      card.rotation.y = 0;
    }

    // ============================================================ the sandstorm: a rolling wall of dust (billboards), sand streaming along the ground
    {
      const puffTex = (() => {
        const c = TX.makeCanvas(128, 128), g = c.getContext('2d'), rr = K.rng(7);
        for (let i = 0; i < 20; i++) {
          const a = rr() * TAU, d = rr() * 26, x = 64 + Math.cos(a) * d, y = 64 + Math.sin(a) * d * 0.8, rad = 16 + rr() * 22;
          const gr = g.createRadialGradient(x, y, 0, x, y, rad);
          gr.addColorStop(0, 'rgba(255,255,255,0.34)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.13)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
          g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
        }
        g.globalCompositeOperation = 'destination-in';
        const m = g.createRadialGradient(64, 64, 20, 64, 64, 63); m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = m; g.fillRect(0, 0, 128, 128);
        return TX.toTexture(c, { wrap: false });
      })();
      const pm = new T.MeshBasicMaterial({ map: puffTex, transparent: true, depthWrite: false });
      pm.onBeforeCompile = (sh) => {
        sh.vertexShader = 'varying float vOp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\nvOp = length(instanceMatrix[2].xyz);\n#else\nvOp = 1.0;\n#endif');
        sh.fragmentShader = 'varying float vOp;\n' + sh.fragmentShader.replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\ndiffuseColor.a *= vOp;');
      };
      const rows = lowQ ? 22 : 30, nBody = lowQ ? 60 : 100, n = rows * 3 + nBody;
      const im = new T.InstancedMesh(new T.PlaneGeometry(1, 1), pm, n);
      im.frustumCulled = false; im.renderOrder = 6; im.castShadow = false; im.receiveShadow = false;
      const P = [], col = new T.Color();
      const span = TZ1 - TZ0 + 16;
      for (let row = 0; row < 3; row++) {
        for (let k = 0; k < rows; k++) {
          const z = TZ0 - 8 + (k + 0.5) * span / rows + r.range(-2, 2);
          P.push({ z, dx: row * 5 + r.range(0, 3), y: [4, 11, 19][row] + r.range(-1.5, 1.5), s: [15, 19, 24][row] * r.range(0.85, 1.2), op: [0.95, 0.8, 0.6][row], ph: r() * TAU, spin: r.range(-0.5, 0.5) });
          col.set([0xb07a4c, 0xd09a62, 0xeab680][row]).multiplyScalar(r.range(0.92, 1.06));
          im.setColorAt(P.length - 1, col);
        }
      }
      for (let k = 0; k < nBody; k++) {
        const dx = 10 + r() * r() * 80;
        P.push({ z: r.range(TZ0 - 4, TZ1 + 4), dx, y: r.range(3, 15), s: r.range(16, 28), op: r.range(0.35, 0.6), ph: r() * TAU, spin: r.range(-0.4, 0.4) });
        col.set(0xc48c58).multiplyScalar(r.range(0.88, 1.08));
        im.setColorAt(P.length - 1, col);
      }
      im.instanceColor.needsUpdate = true;
      K.group.add(im);
      // sand streaming low over the ground: thin streamers ahead of the front, a dense sheet behind it
      const stc = TX.makeCanvas(256, 256), sg = stc.getContext('2d'), rr = K.rng(12);
      for (let i = 0; i < 180; i++) {
        const x = rr() * 256, y = rr() * 256, len = 30 + rr() * 90, th = 1 + rr() * 3;
        for (const [ox, oy] of [[0, 0], [256, 0], [-256, 0], [0, 256], [0, -256]]) {
          const gr = sg.createLinearGradient(x + ox, 0, x + ox + len, 0);
          gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, `rgba(255,255,255,${0.25 + rr() * 0.45})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
          sg.fillStyle = gr; sg.fillRect(x + ox, y + oy - th / 2, len, th);
        }
      }
      const streak = TX.toTexture(stc); streak.repeat.set(3, 5);
      const prc = TX.makeCanvas(256, 4), pg = prc.getContext('2d'), pgr = pg.createLinearGradient(0, 0, 256, 0);
      const f0 = STORM.ahead / (STORM.ahead + 110);
      pgr.addColorStop(0, '#000'); pgr.addColorStop(f0 * 0.9, '#484848'); pgr.addColorStop(f0 + 0.03, '#e8e8e8'); pgr.addColorStop((STORM.ahead + 50) / (STORM.ahead + 110), '#e0e0e0'); pgr.addColorStop(1, '#000');
      pg.fillStyle = pgr; pg.fillRect(0, 0, 256, 4);
      const prof = TX.toTexture(prc, { wrap: false, srgb: false });
      const sheetMat = new T.MeshBasicMaterial({ color: 0xe2ae72, map: streak, alphaMap: prof, transparent: true, opacity: 0.85, depthWrite: false });
      const sheet = new T.Mesh(new T.PlaneGeometry(STORM.ahead + 110, TZ1 - TZ0 + 20).rotateX(-PI / 2), sheetMat);
      sheet.position.set(0, 0.9, (TZ0 + TZ1) / 2); sheet.renderOrder = 5; sheet.frustumCulled = false; sheet.visible = false;
      K.group.add(sheet);
      const qFace = new T.Quaternion().setFromEuler(new T.Euler(-62 * DEG, 0, 0));
      A.sv = { im, P, n, sheet, streak, qFace, q: new T.Quaternion(), qr: new T.Quaternion(), M: new T.Matrix4(), p: new T.Vector3(), s: new T.Vector3(), zAx: new T.Vector3(0, 0, 1) };
      im.visible = false;
    }

    // ============================================================ contact shadows, merge everything static
    {
      const g = new T.PlaneGeometry(1, 1); g.rotateX(-PI / 2);
      const mat = new T.MeshBasicMaterial({ color: 0x1a0c04, transparent: true, alphaMap: TX.blobShadowTexture(), depthWrite: false });
      mat.onBeforeCompile = (sh) => {
        sh.vertexShader = 'varying float vOp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\nvOp = length(instanceMatrix[1].xyz);\n#else\nvOp = 1.0;\n#endif');
        sh.fragmentShader = 'varying float vOp;\n' + sh.fragmentShader.replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\ndiffuseColor.a *= vOp;');
      };
      const im = K.instances(g, mat, contacts, { cast: false, receive: false });
      im.renderOrder = 1;
    }
    flushBins();
    A.ready = true;
    if (typeof location !== 'undefined' && /[?&]test=1/.test(location.search)) window.__valley = A; // debug handle, test mode only
  },

  // fixed-rate: the storm clock, the wind on the cars, the drifts, CPU drivers leaning into the wind, wadi falls
  tick(dt, time, game) {
    if (!A || !A.ready) return;
    // a countdown starts the storm clock again (also a countdown restarted from the pause menu: countT jumps back up)
    const newCount = game.state === 'countdown' && (A.prevState !== 'countdown' || game.countT > (A.prevCountT ?? 0) + 0.01);
    if (newCount) { A.t0 = time + Math.max(0, game.countT); A.prevU = null; A.flashed = false; }
    A.prevState = game.state; A.prevCountT = game.countT;
    const u = stormU(time), pu = A.prevU;
    A.prevU = u;
    const crossed = (a) => u >= 0 && pu != null && pu >= 0 && (pu <= u ? pu < a && u >= a : pu < a || u >= a);
    if (crossed(STORM.horn)) game.sound.cue('whistle', { x: 170, z: -40, game });
    if (crossed(STORM.warn - 0.9) && !A.flashed && game.state === 'race' && game.hud && game.cars.some((e) => e.human)) { A.flashed = true; game.hud.flash('SANDSTORM!', '#f0a040'); }
    const xf = frontX(u);
    for (const d of A.drifts) { d.g = driftAmt(d.x, time); d.surf.kind = d.g > 0.45 ? 'slow' : 'normal'; }
    const L = game.track.length, held = game.state === 'countdown';
    for (const e of game.cars) {
      const c = e.car;
      if (e.out) continue;
      // a car that fell into the wadi lands on its floor; at the jump it comes back with a run-up
      if (c.state === 'falling' && c.fallKind === 'hole') {
        const fl = A.H(c.x, c.z) + 0.6;
        if (c.y < fl) { c.y = fl; c.vy = 0; c.fallVX *= 0.9; c.fallVZ *= 0.9; }
        const dJ = mod(A.sW - e.lastGoodS + L / 2, L) - L / 2;
        if (dJ > -8 && dJ < JUMP.runUp - 4) e.lastGoodS = mod(A.sW - JUMP.runUp, L);
        continue;
      }
      if (c.state !== 'drive' || held) continue;
      let want = 0;
      // the wind: a sideways push grip can't cancel (the car is carried), a little head- or tailwind, buffeting
      if (c.ghost <= 0) {
        const k = bandK(c.x, c.z, xf, time);
        if (k > 0.002) {
          const kk = k * exposure(c.x, c.z) * STORM.S * (0.85 + 0.15 * Math.sin(time * 4.7 + c.x * 0.13) + 0.08 * Math.sin(time * 11.3 + c.z * 0.21));
          const gz = STORM.dir[1] + 0.22 * Math.sin(c.x * 0.05 - time * 1.7 + c.z * 0.03);
          const wx = STORM.dir[0] * kk, wz = gz * kk;
          const ch = Math.cos(c.angle), sh = Math.sin(c.angle);
          const along = wx * ch + wz * sh, lat = -wx * sh + wz * ch;
          const air = c.airborne ? 0.6 : 1;
          c.x += (ch * along * STORM.along - sh * lat) * air * dt;
          c.z += (sh * along * STORM.along + ch * lat) * air * dt;
          if (!c.airborne) c.w += lat * 0.04 * Math.sin(time * 6.1 + c.index * 1.7) * dt;
          // CPU drivers aim upwind of their line by about the drift they will pick up
          if (e.ai && !c.airborne) {
            const sp = Math.max(c.fwdSpeed, 12), look = 6 + sp * 0.28;
            want = clamp(-lat * look / sp, -5, 5);
          }
        }
      }
      if (!e.ai) continue;
      // CPU drivers weave through the colonnade on a smooth path past each pillar's wide side, and take it steadily
      const PL = A.pillars, p0 = PL[0], p1 = PL[PL.length - 1];
      let rate = 5;
      if (e.trackS > p0.s - 26 && e.trackS < p1.s + 10) {
        const sp = Math.max(c.fwdSpeed, 8), sl = e.trackS + 6 + sp * 0.28, line = e.ai.lineOffset(sl);
        let tgt = line;
        if (sl < p0.s) tgt = lerp(line, p0.tl, ss(p0.s - 18, p0.s - 5, sl));
        else if (sl >= p1.s) tgt = lerp(p1.tl, line, ss(p1.s + 3, p1.s + 12, sl));
        else for (let i = 0; i < PL.length - 1; i++) if (sl < PL[i + 1].s) { tgt = lerp(PL[i].tl, PL[i + 1].tl, ss(PL[i].s + 1.5, PL[i + 1].s - 3.5, sl)); break; }
        want += tgt - line;
        rate = 12;
        // pressed against a pillar at a crawl: ease round it
        for (const q of PL) {
          const dx = c.x - q.x, dz = c.z - q.z, d = Math.hypot(dx, dz);
          if (d < 3.7 && d > 0.01 && c.speed < 6) { const sd = Math.sign(q.tl - q.lat); c.x += (dx / d * 2 + q.nx * sd * 3) * dt; c.z += (dz / d * 2 + q.nz * sd * 3) * dt; }
        }
        if (e.trackS > p0.s - 12 && e.trackS < p1.s + 3 && c.fwdSpeed > 26) { const k = 1 - Math.min(1, (c.fwdSpeed - 26) * 4 * dt / c.fwdSpeed); c.vx *= k; c.vz *= k; }
      }
      // CPU drivers steer round a sand drift on the road ahead
      for (const d of A.drifts) {
        if (d.g < 0.3) continue;
        const ds = mod(d.s - e.trackS, L);
        if (ds < 3 || ds > 34) continue;
        const line = e.ai.lineOffset(d.s) + want;
        if (Math.abs(line - d.lat) < d.r + 2.2) want += (d.lat > 0 ? -3.0 : 3.0) - line;
      }
      if (want !== 0) e.ai.avoid += (want - e.ai.avoid) * Math.min(1, dt * rate);
    }
  },

  animate(time, dt, game) {
    if (!A || !A.ready) return;
    const u = stormU(time), xf = frontX(u);
    const live = game.state === 'race' || game.state === 'countdown' || game.state === 'roundEnd';
    // ---- the dust wall and the streaming sand
    const SV = A.sv, vis = xf < BOUNDS.maxX + 80 && xf + STORM.c > BOUNDS.minX - 40;
    SV.im.visible = vis; SV.sheet.visible = vis;
    if (vis) {
      for (let i = 0; i < SV.n; i++) {
        const p = SV.P[i];
        const x = xf + bulge(p.z, time) + p.dx + Math.sin(time * 0.7 + p.ph) * 1.6;
        let fade = ss(BOUNDS.maxX + 40, BOUNDS.maxX, x) * ss(BOUNDS.minX - 40, BOUNDS.minX + 4, x);
        if (p.dx > 12) fade *= 1 - ss(STORM.b, STORM.c + 6, p.dx);
        const y = p.y + Math.sin(time * 1.1 + p.ph * 1.3) * 1.3;
        const sc = p.s * (1 + 0.1 * Math.sin(time * 0.9 + p.ph));
        SV.qr.setFromAxisAngle(SV.zAx, p.ph + time * p.spin);
        SV.q.multiplyQuaternions(SV.qFace, SV.qr);
        SV.p.set(x, y, p.z); SV.s.set(sc, sc, Math.max(0.0005, p.op * fade));
        SV.M.compose(SV.p, SV.q, SV.s);
        SV.im.setMatrixAt(i, SV.M);
      }
      SV.im.instanceMatrix.needsUpdate = true;
      SV.sheet.position.x = xf - STORM.ahead + (STORM.ahead + 110) / 2;
      SV.streak.offset.x = time * 1.6; SV.streak.offset.y = Math.sin(time * 0.37) * 0.04;
    }
    // ---- the view hazes over and the light goes while the storm is over the camera (it dims as the front approaches)
    const cx = game.camX, cz = game.camZ;
    const kc = u < 0 ? 0 : bandK(cx, cz, xf, time);
    const pre = u >= 0 && xf > cx ? ss(170, 15, xf - cx) * 0.35 : 0;
    const fk = Math.max(kc, pre);
    const R = game.R;
    if (R) {
      const fog = R.scene.fog;
      if (fog) { fog.near = lerp(LIGHT.fog.near, 6, fk); fog.far = lerp(LIGHT.fog.far, 245, fk); }
      R.sun.intensity = LIGHT.sunIntensity * (1 - 0.5 * fk);
      R.hemi.intensity = LIGHT.hemiIntensity * (1 - 0.12 * fk);
    }
    // ---- blowing sand in the view, a howl
    if (kc > 0.04 && dt > 0 && game.particles) {
      const P = game.particles, nn = Math.min(4, Math.floor(kc * 3 + Math.random()));
      for (let i = 0; i < nn; i++) P.emit(cx + (Math.random() - 0.25) * 110, 0.4 + Math.random() * 6, cz + (Math.random() - 0.5) * 70, { vx: -55 - Math.random() * 20, vz: 16, spread: 6, up: 0.6, grav: -0.3, color: 0xdcaa72, size: 0.6 + Math.random() * 1.0, life: 1.1, alpha: 0.6 * kc, grow: 1.3 });
      if (Math.random() < kc * 0.5) P.emit(cx + (Math.random() - 0.3) * 100, 2 + Math.random() * 5, cz + (Math.random() - 0.5) * 60, { vx: -40, vz: 12, spread: 4, up: 0.3, grav: 0, color: 0xc8925c, size: 6 + Math.random() * 5, life: 1.6, alpha: 0.16 * kc, grow: 1.6 });
      for (const e of game.cars) { const c = e.car; if (c.state === 'drive' && Math.random() < kc * 0.4) P.emit(c.x, 0.6, c.z, { vx: -30, vz: 10, spread: 5, up: 1.5, grav: 1, color: 0xd8a870, size: 1.2, life: 0.8, alpha: 0.45, grow: 2 }); }
    }
    if (live && game.sound && game.sound.ctx && dt > 0) {
      // overlapping gusts while the storm is over the view, louder the deeper in it
      A.windT -= dt;
      if (kc > 0.04 && A.windT <= 0) { A.windT = 2.6; game.sound.cue('gust', { dur: 3.4, vol: 0.45 + 0.55 * kc, pan: 0.2, game }); }
      if (A.lastKc < 0.25 && kc >= 0.25) game.sound.noiseBurst(1.5, { freq: 260, q: 0.5, type: 'bandpass', vol: 0.16 });
    }
    A.lastKc = kc;
    // ---- the sand drifts grow after the front has passed and blow away again
    {
      let any = false;
      A.drifts.forEach((d, i) => {
        const g = driftAmt(d.x, time);
        if (g > 0.01) any = true;
        SV.p.set(d.x, 0.02, d.z); SV.s.set(d.sx * (0.4 + 0.6 * g), d.sy * g + 0.0001, d.sz * (0.4 + 0.6 * g));
        SV.M.compose(SV.p, d.q, SV.s);
        A.driftIM.setMatrixAt(i, SV.M);
      });
      A.driftIM.visible = any;
      A.driftIM.instanceMatrix.needsUpdate = true;
    }
    // ---- flags: a light evening breeze from the north-west, streaming west in the storm
    for (const f of A.flags) {
      const k = u < 0 ? 0 : bandK(f.x, f.z, xf, time);
      const a = lerp(Math.atan2(0.7, 0.7), Math.atan2(STORM.dir[1], STORM.dir[0]), ss(0, 0.4, k));
      f.m.rotation.y = -a + Math.sin(time * (3 + 9 * k) + f.ph) * (0.12 + 0.25 * k);
      f.m.scale.x = 1 + 0.06 * Math.sin(time * (5 + 12 * k) + f.ph);
    }
  },
};

// World: Sushi Express (Mayhem Cup). The counter of a conveyor-belt sushi bar at real size: a honey-coloured
// wooden counter with a pale stone island, ringed by a slatted chain conveyor flush with the top. The road is a
// bamboo runner that rides the belt twice: WITH it all round the west end (a free boost, plates to overtake) and
// AGAINST it round the south-east corner (a headwind; the inside rail of the bend is where the slats run slowest).
// Between the two it climbs onto the chef's side, where a bullet-train express tray shoots out of the kitchen
// hatch across the road (chime + red lamps first), then drops back across the belt through the plate traffic.
// A soy puddle sits wide of the NE hairpin, wasabi on the inside of the last corner; the east edge is a drop.
import * as THREE from '../../vendor/three.bundle.js';
import { Track } from '../track.js';

const PI = Math.PI, TAU = PI * 2;
const C45 = 22 - 22 * 0.94 * Math.SQRT1_2; // corner mid points pulled in a little: the spline then rounds the corner evenly (R >= 22)
// the belt's centreline (closed, clockwise on screen: the north straight runs east). Rounded rectangle, corners R 22.
const BELT_PTS = [
  [-103, -44], [-67, -44], [-20, -44], [25, -44], [53, -44], [75 - C45, -44 + C45], [75, -22], [75, 22], [75 - C45, 44 - C45],
  [53, 44], [40, 44], [-25, 44], [-87, 44], [-103, 44], [-125 + C45, 44 - C45], [-125, 22], [-125, -22], [-125 + C45, -44 + C45],
];
const BP = (i) => [...BELT_PTS[i], 16]; // a little wider on the belt
// the road: the shared stretches use the belt's own control points, so the two splines coincide there
const TRACK = [
  [83, 86], [10, 86], [-36, 74], [-66, 51],
  BP(12), BP(13), BP(14), BP(15), BP(16), BP(17), BP(0), BP(1), // WITH: south straight west, round the west end, north straight east
  [-44, -53], [-30, -74], [-21, -90], [-6, -94.5], [9, -86], [14, -50], // up over the chef's side, across the express lane, down across the belt
  [18, 26],
  BP(10), BP(9), BP(8), BP(7), BP(6), // AGAINST: south straight east, round the SE corner, up the east straight
  [78, -52], [100, -76], [126, -70], [134, -40], [134, 34], [121, 76], // NE hairpin, the east edge, back to the line
];
const RW = 15; // road width
const BHW = 10; // belt half width (slats): a wide display conveyor
const RAIL = { off: 10.5, r: 0.55, h: 1.0 };
const BV = 11; // belt speed on its centreline (units/s)
const FLOOR = -88, STOOL_Y = -28;
const BOUNDS = { minX: -176, maxX: 148, minZ: -114, maxZ: 108 };
// plates: radius (visual / collider), height, sideways offset on the slats
const PL = { r: 6.6, cr: 6.1, h: 2.4, off: 5.0, offIn: 5.6 }; // off: own side at X1, offIn: the island side elsewhere
const PL_GAPS = [1.25, 0.8, 1.05, 0.7, 1.35, 0.9, 1.1, 0.75, 1.3, 0.85, 1.2, 0.8, 1.0];
const PL_SIDE = [1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, -1, -1];
const PL_COL = [0xd8342c, 0x2f6fd0, 0xf2c230, 0x2a2a2e, 0x8fc4ea, 0x3fa05a, 0xe66aa0, 0xd8342c, 0x2f6fd0, 0xf2c230, 0xf2ead8, 0xf08a24, 0x8a5ad0];
const PL_KIND = ['salmon', 'maki', 'tuna', 'gunkan', 'tamago', 'shrimp', 'inari', 'salmon', 'tuna', 'maki', 'shrimp', 'gunkan', 'tamago'];
const PL_DOME = [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0];
// the express tray: a lane across the top of the chef's loop, kitchen hatch (north) to the pick-up station
const EX = { x: -7, zk: -128, zs: -71, P: 9, W1: 1.5, D: 1.2, S: 2.9, ph: 2.2, hw: 7.2, hd: 2.7, h: 3.6 };

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const wrap = (v, L) => ((v % L) + L) % L;

// ---------------------------------------------------------------- belt geometry (built once, pure)
let BG = null;
function beltGeo() {
  if (BG) return BG;
  const b = new Track(BELT_PTS, { width: 16 });
  const N = b.N;
  const k = new Float32Array(N), cn = new Float32Array(N);
  for (let i = 0; i < N; i++) { let s = 0; for (let d = -4; d <= 4; d++) s += b.curv[(i + d + N) % N]; k[i] = s / 9; }
  for (let i = 0; i < N; i++) { let s = 0; for (let d = -30; d <= 30; d++) s += Math.abs(k[(i + d + N) % N]); cn[i] = ss(0.012, 0.03, s / 61); }
  BG = { b, N, L: b.length, ds: b.ds, x: b.x, z: b.z, tx: b.tx, tz: b.tz, k, cn };
  return BG;
}
// interpolated belt frame at arc length u (no allocation: fills o)
function beltAt(u, o) {
  const G = BG;
  let f = wrap(u, G.L) / G.ds;
  const i = Math.floor(f) % G.N, j = (i + 1) % G.N;
  f -= Math.floor(f);
  o.x = lerp(G.x[i], G.x[j], f); o.z = lerp(G.z[i], G.z[j], f);
  let tx = lerp(G.tx[i], G.tx[j], f), tz = lerp(G.tz[i], G.tz[j], f);
  const l = Math.hypot(tx, tz) || 1; o.tx = tx / l; o.tz = tz / l;
  o.k = lerp(G.k[i], G.k[j], f); o.cn = lerp(G.cn[i], G.cn[j], f); o.i = i;
  return o;
}
// nearest belt sample to (x, z) (windowed around hint, else coarse global): fills o.i, o.lat, o.d2
function beltNear(x, z, hint, o) {
  const G = BG, X = G.x, Z = G.z, N = G.N;
  let best = -1, bd = Infinity;
  if (hint >= 0) {
    for (let k = -30; k <= 30; k++) { const i = (hint + k + N) % N, dx = X[i] - x, dz = Z[i] - z, d = dx * dx + dz * dz; if (d < bd) { bd = d; best = i; } }
  }
  if (best < 0 || bd > 400) {
    bd = Infinity;
    for (let i = 0; i < N; i += 4) { const dx = X[i] - x, dz = Z[i] - z, d = dx * dx + dz * dz; if (d < bd) { bd = d; best = i; } }
    const c = best;
    for (let k = -4; k <= 4; k++) { const i = (c + k + N) % N, dx = X[i] - x, dz = Z[i] - z, d = dx * dx + dz * dz; if (d < bd) { bd = d; best = i; } }
  }
  o.i = best; o.d2 = bd;
  o.lat = (x - X[best]) * -G.tz[best] + (z - Z[best]) * G.tx[best];
  return o;
}

// ---------------------------------------------------------------- plates riding the belt (pure functions of time)
let PLATES = null;
function plates() {
  if (PLATES) return PLATES;
  const G = beltGeo();
  const sum = PL_GAPS.reduce((a, b) => a + b, 0);
  let u = 18;
  PLATES = PL_GAPS.map((g, i) => {
    const p = { i, u0: u, side: PL_SIDE[i], color: PL_COL[i], kind: PL_KIND[i], dome: !!PL_DOME[i], spin: (i * 2.399) % TAU };
    u += (g / sum) * G.L;
    return p;
  });
  return PLATES;
}
// lateral offset on the slats (+ = right of the belt's travel = the island side). Arc length u runs from the end of
// the NW bend (0) east along the north straight (X1 at ~117), round the NE bend, down the east straight, round the SE
// bend, west along the south straight and round the west end. The plates ride on the island side of the slats, so
// both exits (on the outside) stay open and you overtake them on the outside; on the bends the inside line (where
// the slats run slowest) is the gamble between plates. Only around the X1 crossing do they take their own side, so
// the traffic there comes in both lanes. They change lanes only where nobody rides the belt.
function plateLat(p, cn, u) {
  return lerp(PL.offIn, p.side * PL.off, ss(74, 90, u) * (1 - ss(124, 140, u)));
}
const _bf = { x: 0, z: 0, tx: 1, tz: 0, k: 0, cn: 0, i: 0 };
function platePose(p, t, o) {
  const u = p.u0 + BV * t;
  beltAt(u, _bf);
  const lat = plateLat(p, _bf.cn, wrap(u, BG.L));
  o.x = _bf.x - _bf.tz * lat; o.z = _bf.z + _bf.tx * lat;
  o.a = Math.atan2(_bf.tz, _bf.tx) + p.spin; o.u = wrap(u, BG.L); o.lat = lat;
  return o;
}

// ---------------------------------------------------------------- the express tray (pure function of time)
// cycle: warning (kitchen), run south, dwell at the station (warning near the end), run back north, rest
const exU = (t) => wrap(t + EX.ph, EX.P);
function exProf(x) { // eased trip 0..1 with a constant-speed middle
  const a = 0.22, vm = 1 / (1 - a);
  if (x <= 0) return 0; if (x >= 1) return 1;
  if (x < a) return 0.5 * vm * x * x / a;
  if (x < 1 - a) return vm * (x - a / 2);
  return 1 - 0.5 * vm * (1 - x) * (1 - x) / a;
}
const EXT = { goS: EX.W1, atS: EX.W1 + EX.D, goN: EX.W1 + EX.D + EX.S, atK: EX.W1 + 2 * EX.D + EX.S };
function exZ(t) {
  const u = exU(t);
  if (u < EXT.goS) return EX.zk;
  if (u < EXT.atS) return lerp(EX.zk, EX.zs, exProf((u - EXT.goS) / EX.D));
  if (u < EXT.goN) return EX.zs;
  if (u < EXT.atK) return lerp(EX.zs, EX.zk, exProf((u - EXT.goN) / EX.D));
  return EX.zk;
}
// warning lamps: from the chime before a run until the tray has passed the road
function exWarn(t) {
  const u = exU(t);
  return (u < EXT.atS) || (u > EXT.goN - 1.3 && u < EXT.atK);
}

let A = null; // runtime state for tick / animate

export default {
  id: 'sushi',
  name: 'Sushi Express',
  blurb: 'Ride the sushi belt: a boost one way, a headwind back, and the express tray!',
  vehicle: 'formula',
  seed: 61,
  track: { points: TRACK, width: RW, startS: 40 },
  bounds: BOUNDS,
  fallOffEdges: true,
  floorY: FLOOR,
  offCourse: 16,
  skidColor: 0x3a2412,
  clackOnBump: true,
  dust: {
    normal: null,
    slick: { color: 0x2a140a, size: 0.6, life: 0.45, up: 2.5, grav: 24, alpha: 0.85, grow: 1, rate: 1.6 },
    sticky: { color: 0x8fbf3a, size: 0.6, life: 0.4, up: 1, grav: 10, alpha: 0.9, grow: 1 },
  },
  lighting: {
    sunDir: [-0.34, 1, -0.4], sunColor: 0xffdcb0, sunIntensity: 2.05,
    hemiSky: 0xffdcb8, hemiGround: 0x4a2c1a, hemiIntensity: 0.5,
    envIntensity: 0.36, exposure: 1.0, background: 0x120a07, shadowRadius: 2.4,
  },

  async build(K) {
    const { THREE: T, TX, r, track } = K;
    const BU = K.BufferGeometryUtils;
    const lowQ = K.quality && K.quality.tilt === false;
    const V2 = (a, b = a) => new T.Vector2(a, b);
    const G = beltGeo();
    const PLS = plates();
    A = {
      carry: [], plateCols: [], pose: { x: 0, z: 0, a: 0, u: 0, lat: 0 }, bn: { i: -1, lat: 0, d2: 0 }, bf: { x: 0, z: 0, tx: 1, tz: 0, k: 0, cn: 0, i: 0 },
      tn: { i: 0, s: 0, lat: 0, d2: 0 }, lastExU: null,
    };

    // ============================================================ helpers (merged, vertex-coloured parts)
    const _q = new T.Quaternion(), _e = new T.Euler(), _v = new T.Vector3(), _s = new T.Vector3(), _c = new T.Color();
    const mtx = (o) => new T.Matrix4().compose(_v.set(o.x || 0, o.y || 0, o.z || 0), _q.setFromEuler(_e.set(o.rx || 0, o.ry || 0, o.rz || 0, o.order || 'YXZ')), _s.set(o.sx ?? o.s ?? 1, o.sy ?? o.s ?? 1, o.sz ?? o.s ?? 1));
    const prep = (geo, c, M) => {
      const g = geo.index ? geo.toNonIndexed() : geo.clone();
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      g.morphAttributes = {};
      if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.attributes.normal) g.computeVertexNormals();
      if (M) g.applyMatrix4(M);
      _c.set(c);
      const n = g.attributes.position.count, a = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; }
      g.setAttribute('color', new T.BufferAttribute(a, 3));
      g.clearGroups();
      return g;
    };
    const bins = new Map();
    const put = (geo, c, o, mat, cast = true) => {
      const g = prep(geo, c, o.isMatrix4 ? o : mtx(o));
      g.computeBoundingBox();
      const bx = (g.boundingBox.min.x + g.boundingBox.max.x) / 2, bz = (g.boundingBox.min.z + g.boundingBox.max.z) / 2;
      const key = mat.uuid + (cast ? 'c' : 'n') + Math.floor((bx + 400) / 170) + ':' + Math.floor((bz + 400) / 170);
      if (!bins.has(key)) bins.set(key, { mat, cast, parts: [] });
      bins.get(key).parts.push(g);
    };
    // a prop frame: parts placed relative to (x, y, z) rotated by ry
    const frame = (x, y, z, ry = 0, sc = 1) => {
      const F = new T.Matrix4().compose(_v.set(x, y, z), _q.setFromEuler(_e.set(0, ry, 0)), _s.set(sc, sc, sc));
      return (geo, c, o, mat, cast = true) => put(geo, c, F.clone().multiply(mtx(o)), mat, cast);
    };
    const flushBins = () => {
      for (const { mat, cast, parts } of bins.values()) {
        const g = BU.mergeGeometries(parts, false);
        g.computeBoundingSphere();
        const m = new T.Mesh(g, mat); m.castShadow = cast; m.receiveShadow = !mat.isMeshBasicMaterial;
        K.group.add(m);
      }
      bins.clear();
    };
    const canvas = (w, h, draw) => { const c = TX.makeCanvas(w, h); draw(c.getContext('2d'), w, h); return c; };
    const tex = (c, rep = [1, 1], wrapT = true, srgb = true) => TX.toTexture(c, { repeat: rep, wrap: wrapT, srgb });
    const box = (w, h, d) => new T.BoxGeometry(w, h, d);
    const rbox = (w, h, d, rad = 0.3, seg = 2) => new K.RoundedBoxGeometry(w, h, d, seg, Math.min(rad, w / 2.01, h / 2.01, d / 2.01));
    const cyl = (r1, r2, h, seg = 16, open = false) => new T.CylinderGeometry(r1, r2, h, seg, 1, open);
    const sph = (rad, ws = 16, hs = 12) => new T.SphereGeometry(rad, ws, hs);
    const lathe = (prof, seg = 32) => K.lathe(prof, seg);
    const hash = (a, b = 0) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
    const dRoad = (x, z) => { const n = track.distTo(x, z); return n.dist - track.w[n.i] / 2; };
    const onBelt = (x, z, m = 0) => { beltNear(x, z, -1, A.bn); return Math.sqrt(A.bn.d2) < BHW + m; };
    // contact shadows: one instanced mesh, opacity in the instance's y scale
    const contactMat = new T.MeshBasicMaterial({ color: 0x120804, transparent: true, alphaMap: TX.blobShadowTexture(), depthWrite: false });
    contactMat.onBeforeCompile = (sh) => {
      sh.vertexShader = 'varying float vOp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\nvOp = length(instanceMatrix[1].xyz);\n#endif');
      sh.fragmentShader = 'varying float vOp;\n' + sh.fragmentShader.replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\ndiffuseColor.a *= vOp;');
    };
    contactMat.customProgramCacheKey = () => 'sushi-contact';
    const contacts = [];
    const AO = (x, z, rx, rz = rx, op = 0.4, ang = 0, y = 0.07) => contacts.push({ x, y, z, ry: -ang, sx: rx * 2, sy: op, sz: rz * 2 });
    const pools = [];
    const POOL = (x, z, rx, rz, color, op = 1, ang = 0, y = 0.12) => pools.push({ x, y, z, ry: -ang, sx: rx * 2, sy: 1, sz: rz * 2, color: new T.Color(color).multiplyScalar(op) });
    const noise = TX.noiseField(256, { seed: 61, period: 8, oct: 4 });
    const nAt = (f, x, y) => f[(((y | 0) % 256 + 256) % 256) * 256 + (((x | 0) % 256 + 256) % 256)];

    // ============================================================ shared materials
    const M = {
      paint: K.phys({ vertexColors: true, roughness: 0.38, clearcoat: 0.4, clearcoatRoughness: 0.25 }),
      matte: K.std({ vertexColors: true, roughness: 0.85 }),
      ceramic: K.phys({ vertexColors: true, roughness: 0.22, clearcoat: 0.9, clearcoatRoughness: 0.1 }),
      metal: K.std({ vertexColors: true, metalness: 0.9, roughness: 0.28 }),
      glow: new T.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
      liquid: K.phys({ vertexColors: true, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02 }),
      food: K.phys({ vertexColors: true, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.35, sheen: 0.3, sheenColor: new T.Color(0xffffff) }),
    };
    const brushed = TX.brushedMetalTextures({ size: 256, seed: 61 });
    const steel = K.std({ color: 0xd9dde2, metalness: 1, roughness: 0.3, roughnessMap: brushed.roughnessMap, normalMap: brushed.normalMap, normalScale: V2(0.3) });

    // ============================================================ the room: floor far below, stools, the counter
    {
      const fl = canvas(512, 512, (g) => {
        g.fillStyle = '#2a2622'; g.fillRect(0, 0, 512, 512);
        for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
          const k = 34 + hash(i, j) * 16; g.fillStyle = `rgb(${k + 6},${k + 2},${k})`; g.fillRect(i * 128 + 3, j * 128 + 3, 122, 122);
          for (let n = 0; n < 60; n++) { const a = hash(i * 9 + n, j * 7); g.fillStyle = `rgba(${a > 0.5 ? 255 : 0},${a > 0.5 ? 245 : 0},${a > 0.5 ? 230 : 0},0.05)`; g.fillRect(i * 128 + hash(n, i + j) * 120, j * 128 + hash(j, n * 3) * 120, 6, 6); }
        }
      });
      K.mesh(new T.PlaneGeometry(1600, 1400), K.std({ map: tex(fl, [16, 14]), roughness: 0.55, metalness: 0.05 }), 0, FLOOR, 0, { rx: -PI / 2, cast: false });
      // the counter top: honey-coloured hinoki, lacquered
      const wd = TX.woodTextures({ size: 1024, seed: 9, planks: 5, base: 0xc8935a, dark: 0x8e5c30, light: 0xe2b47c, ringFreq: 16, gap: 0.0025, roughBase: 0.38, lacquer: 0.4 });
      const BW = BOUNDS.maxX - BOUNDS.minX, BD = BOUNDS.maxZ - BOUNDS.minZ;
      for (const t of Object.values(wd)) { t.repeat.set(BW / 110, BD / 160); t.rotation = PI / 2; t.center.set(0.5, 0.5); }
      A.woodTex = wd;
      const topMat = K.phys({ map: wd.map, normalMap: wd.normalMap, roughnessMap: wd.roughnessMap, normalScale: V2(0.35), clearcoat: 0.3, clearcoatRoughness: 0.32 });
      const CX = (BOUNDS.minX + BOUNDS.maxX) / 2, CZ = (BOUNDS.minZ + BOUNDS.maxZ) / 2;
      K.mesh(box(BW, 6, BD), topMat, CX, -3, CZ, { cast: false });
      // rounded front lips (south and east edges) and a dark cabinet below, set back for the knees
      const lip = K.phys({ color: 0xb07c46, roughness: 0.3, clearcoat: 0.6 });
      K.mesh(cyl(3, 3, BW, 20).rotateZ(PI / 2), lip, CX, -3, BOUNDS.maxZ, { cast: false });
      K.mesh(cyl(3, 3, BD, 20).rotateX(PI / 2), lip, BOUNDS.maxX, -3, CZ, { cast: false });
      K.mesh(cyl(3, 3, BD, 20).rotateX(PI / 2), lip, BOUNDS.minX, -3, CZ, { cast: false });
      const cab = K.std({ color: 0x2a1810, roughness: 0.55 });
      K.mesh(box(BW - 30, FLOOR + 6 > 0 ? 1 : -6 - FLOOR, BD - 30), cab, CX - 4, (FLOOR - 6) / 2, CZ - 10, { cast: false });
      // a brass foot rail along the cabinet
      K.mesh(cyl(1.4, 1.4, BW - 30, 14).rotateZ(PI / 2), K.metal(0xc9a050, 0.3), CX - 4, FLOOR + 22, BOUNDS.maxZ - 18, { cast: false });
      // stools along the south and east edges (their seats far below the counter's edge)
      const seat = K.phys({ color: 0x8a1e1a, roughness: 0.5, clearcoat: 0.5, clearcoatRoughness: 0.35 });
      const chrome = K.metal(0xe0e2e6, 0.15);
      const stools = [];
      for (let x = -150; x <= 130; x += 52) stools.push([x, BOUNDS.maxZ + 26]);
      for (let z = -70; z <= 80; z += 52) stools.push([BOUNDS.maxX + 26, z]);
      const seatG = BU.mergeGeometries([lathe([[0, 0], [15.5, 0], [17, 1.5], [17.2, 4], [16, 6.2], [0, 6.6]], 40)]);
      const ringG = new T.TorusGeometry(15.5, 1.1, 10, 40).rotateX(PI / 2);
      const poleG = cyl(2.2, 2.2, STOOL_Y - FLOOR, 14);
      const baseG = cyl(14, 15, 1.6, 36);
      K.instances(seatG, seat, stools.map(([x, z]) => ({ x, y: STOOL_Y - 6.6, z })), { cast: false });
      K.instances(ringG, chrome, stools.map(([x, z]) => ({ x, y: STOOL_Y - 6.2, z })), { cast: false });
      K.instances(poleG, chrome, stools.map(([x, z]) => ({ x, y: (STOOL_Y + FLOOR) / 2 - 3, z })), { cast: false });
      K.instances(baseG, chrome, stools.map(([x, z]) => ({ x, y: FLOOR + 0.8, z })), { cast: false });
    }

    // ============================================================ the island inside the belt: pale stone
    {
      const st = TX.mottledTextures({ size: 512, a: 0xeeeae2, b: 0xe0dacf, c: 0xf7f5f0, seed: 63, period: 5, speck: 0.12, bump: 0.5, pebbles: 260, pebbleColor: 0xcfc8bc, roughness: [0.22, 0.4] });
      const poly = [];
      for (let i = 0; i < G.N; i += 4) poly.push([G.x[i] - G.tz[i] * (BHW + 0.3), G.z[i] + G.tx[i] * (BHW + 0.3)]);
      const m = K.flatShape(poly, K.phys({ map: st.map, normalMap: st.normalMap, roughnessMap: st.roughnessMap, normalScale: V2(0.5), clearcoat: 0.5, clearcoatRoughness: 0.2 }), 0.04);
      for (const t of [m.material.map, m.material.normalMap, m.material.roughnessMap]) t.repeat.set(1 / 9, 1 / 9);
    }

    // ============================================================ the conveyor: slats, edge rails
    {
      // slat texture: crescent slats (one per tile along v), a dark seam at both edges
      const sc = canvas(128, 128, (g, w, h) => {
        g.fillStyle = '#aebdc8'; g.fillRect(0, 0, w, h);
        const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0.25)'); gr.addColorStop(0.7, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.12)');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
        // the crescent seam (repeats at v = 0 and 1)
        for (const oy of [0, h]) {
          g.strokeStyle = 'rgba(40,52,60,0.9)'; g.lineWidth = 5;
          g.beginPath();
          for (let i = 0; i <= 32; i++) { const u = i / 32, y = oy + 8 + 34 * (1 - (2 * u - 1) ** 2); if (i) g.lineTo(u * w, y); else g.moveTo(u * w, y); }
          g.stroke();
          g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2;
          g.beginPath();
          for (let i = 0; i <= 32; i++) { const u = i / 32, y = oy + 12 + 34 * (1 - (2 * u - 1) ** 2); if (i) g.lineTo(u * w, y); else g.moveTo(u * w, y); }
          g.stroke();
        }
        // hinge pins down the middle and the dark gap to the frame at both edges
        g.fillStyle = 'rgba(60,70,80,0.6)'; g.fillRect(w / 2 - 3, 70, 6, 14);
        g.fillStyle = '#2b3036'; g.fillRect(0, 0, 5, h); g.fillRect(w - 5, 0, 5, h);
        g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(5, 0, 2, h); g.fillRect(w - 7, 0, 2, h);
      });
      const nSl = Math.round(G.L / 3.9);
      A.slatPitch = G.L / nSl;
      const slatTex = tex(sc, [1, 1]);
      A.slatTex = slatTex;
      const beltMat = K.phys({ map: slatTex, roughness: 0.32, clearcoat: 0.55, clearcoatRoughness: 0.2 });
      // closed ribbon (exact wrap so the slats tile seamlessly)
      const rows = Math.ceil(G.N / 2);
      const pos = [], uv = [], idx = [];
      for (let rI = 0; rI <= rows; rI++) {
        const i = rI === rows ? 0 : (rI * 2) % G.N, s = rI === rows ? G.L : i * G.ds;
        for (let c = 0; c < 2; c++) {
          const off = (c - 0.5) * 2 * (BHW + 0.6);
          pos.push(G.x[i] - G.tz[i] * off, 0.16, G.z[i] + G.tx[i] * off); uv.push(c, s / A.slatPitch);
        }
        if (rI < rows) { const a = rI * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals();
      const nr = g.attributes.normal; for (let i = 0; i < nr.count; i++) nr.setXYZ(i, 0, 1, 0);
      const bm = new T.Mesh(g, beltMat); bm.receiveShadow = true; bm.renderOrder = -1; K.group.add(bm);

      // edge rails: present wherever the road doesn't pass through the belt's edge
      const railParts = [], caps = [];
      const prof = [[-0.62, 0], [-0.62, 0.45], [-0.5, 0.82], [-0.2, 1.0], [0.2, 1.0], [0.5, 0.82], [0.62, 0.45], [0.62, 0]];
      const sweep = (P) => { // P: [{x, z, nx, nz}] along an edge
        const posA = [], idxA = [];
        const m = prof.length;
        P.forEach((p, i) => { for (const [o, y] of prof) posA.push(p.x + p.nx * o, y, p.z + p.nz * o); if (i) for (let k = 0; k < m - 1; k++) { const a = (i - 1) * m + k, b = i * m + k; idxA.push(a, b, a + 1, a + 1, b, b + 1); } });
        const gg = new T.BufferGeometry(); gg.setAttribute('position', new T.Float32BufferAttribute(posA, 3)); gg.setIndex(idxA); gg.computeVertexNormals();
        return gg;
      };
      A.rails = [];
      for (const side of [-1, 1]) {
        const pts = [];
        for (let i = 0; i < G.N; i += 2) {
          const nx = -G.tz[i] * side, nz = G.tx[i] * side;
          const x = G.x[i] + nx * RAIL.off, z = G.z[i] + nz * RAIL.off;
          const open = dRoad(x, z) < 0.6;
          pts.push({ x, z, nx, nz, open, i });
        }
        // longer gaps downstream where the slats carry you sideways on the way off: the exit off the WITH
        // stretch (outer rail) and the far side of the X1 crossing (inner rail)
        {
          const n0 = pts.length, ext = new Uint8Array(n0);
          for (let k = 0; k < n0; k++) {
            if (!pts[k].open) continue;
            const q = pts[k];
            const len = side === -1 && q.z < -50 && q.x > -75 && q.x < -30 ? 16 : side === 1 && q.z > -40 && q.z < -30 && q.x > 0 && q.x < 30 ? 12 : 0;
            for (let d = 1; d <= len; d++) ext[(k + d) % n0] = 1;
          }
          for (let k = 0; k < n0; k++) if (ext[k]) pts[k].open = true;
        }
        // runs of rail (rotate so a run never starts mid-way through the array)
        let st0 = pts.findIndex((p) => p.open);
        if (st0 < 0) st0 = 0;
        const n = pts.length;
        let run = [];
        const flushRun = () => {
          if (run.length > 2) {
            railParts.push(sweep(run));
            caps.push(run[0], run[run.length - 1]);
            for (let k = 0; k + 1 < run.length; k += 3) {
              const a = run[k], b = run[Math.min(run.length - 1, k + 3)];
              A.rails.push(K.capsule(a.x, a.z, b.x, b.z, RAIL.r, RAIL.h));
            }
          }
          run = [];
        };
        for (let k = 0; k <= n; k++) {
          const p = pts[(st0 + k) % n];
          if (p.open || k === n) flushRun(); else run.push(p);
        }
      }
      const railG = BU.mergeGeometries(railParts.map((gg) => { gg.setAttribute('uv', new T.BufferAttribute(new Float32Array(gg.attributes.position.count * 2), 2)); return gg; }));
      const rm = new T.Mesh(railG, K.std({ color: 0xdfe3e8, metalness: 1, roughness: 0.26, roughnessMap: brushed.roughnessMap, side: T.DoubleSide })); rm.castShadow = true; rm.receiveShadow = true; K.group.add(rm);
      K.instances(sph(0.62, 12, 8), steel, caps.map((p) => ({ x: p.x, y: 0.45, z: p.z, sy: 0.9 })), { cast: false });
      // a dark seam where the belt frame meets the counter / stone
      const seamMat = K.std({ color: 0x8a929a, metalness: 0.8, roughness: 0.35, side: T.DoubleSide });
      for (const side of [-1, 1]) {
        const posA = [], idxA = [];
        for (let rI = 0; rI <= rows; rI++) {
          const i = rI === rows ? 0 : (rI * 2) % G.N;
          for (let c = 0; c < 2; c++) { const off = side * (BHW + 0.6 + c * 0.7); posA.push(G.x[i] - G.tz[i] * off, 0.1, G.z[i] + G.tx[i] * off); }
          if (rI < rows) { const a = rI * 2; idxA.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
        }
        const gg = new T.BufferGeometry(); gg.setAttribute('position', new T.Float32BufferAttribute(posA, 3)); gg.setIndex(idxA); gg.computeVertexNormals();
        const nn = gg.attributes.normal; for (let i = 0; i < nn.count; i++) nn.setXYZ(i, 0, 1, 0);
        const mm = new T.Mesh(gg, seamMat); mm.receiveShadow = true; K.group.add(mm);
      }
    }

    // ============================================================ the road: a bamboo runner with indigo binding
    {
      const rc = canvas(256, 256, (g, w, h) => {
        for (let y = 0; y < h; y += 8) {
          const k = hash(y, 3), base = 196 + k * 30;
          const gr = g.createLinearGradient(0, y, 0, y + 8);
          gr.addColorStop(0, `rgb(${base * 0.82 | 0},${base * 0.78 | 0},${base * 0.5 | 0})`);
          gr.addColorStop(0.35, `rgb(${base | 0},${base * 0.93 | 0},${base * 0.62 | 0})`);
          gr.addColorStop(1, `rgb(${base * 0.7 | 0},${base * 0.64 | 0},${base * 0.4 | 0})`);
          g.fillStyle = gr; g.fillRect(0, y, w, 8);
          // bamboo nodes on some slats
          if (k > 0.55) { g.fillStyle = 'rgba(110,80,40,0.35)'; g.fillRect((hash(y, 9) * 0.6 + 0.2) * w, y, 3, 8); }
        }
        // the weaving threads along the runner
        for (const u of [0.26, 0.5, 0.74]) { g.fillStyle = 'rgba(70,52,30,0.55)'; g.fillRect(u * w - 1.5, 0, 3, h); for (let y = 0; y < h; y += 8) { g.fillStyle = 'rgba(40,28,16,0.6)'; g.fillRect(u * w - 2.5, y + 2, 5, 3); } }
        // indigo cotton binding at both edges with white stitches
        for (const [x0, x1] of [[0, 18], [w - 18, w]]) {
          g.fillStyle = '#1d2c5a'; g.fillRect(x0, 0, x1 - x0, h);
          g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x0 + 3, 0, 2, h);
          for (let y = 0; y < h; y += 16) { g.fillStyle = 'rgba(235,235,225,0.85)'; g.fillRect(x0 + (x0 ? 4 : 10), y + 4, 2.5, 7); }
        }
      });
      const runnerMat = K.phys({ map: tex(rc, [1, 1]), roughness: 0.62, clearcoat: 0.15, clearcoatRoughness: 0.6 });
      K.ribbon({ mat: runnerMat, y: 0.06, vScale: 6 });
      // start / finish: a band of checkered (ichimatsu) cloth across the runner
      const p = track.at(40);
      const ck = canvas(256, 64, (g) => { for (let y = 0; y < 4; y++) for (let x = 0; x < 16; x++) { g.fillStyle = (x + y) % 2 ? '#1b1b20' : '#f3efe4'; g.fillRect(x * 16, y * 16, 16, 16); } });
      const sm = K.mesh(new T.PlaneGeometry(RW + 0.4, 3.4), K.std({ map: tex(ck, [1, 1], false), roughness: 0.8 }), p.x, 0.1, p.z, { cast: false });
      sm.rotation.order = 'YXZ'; sm.rotation.y = -p.angle + PI / 2; sm.rotation.x = -PI / 2;
    }

    // ============================================================ the north wall (the chef's pass) and the kitchen hatch
    {
      const wz = BOUNDS.minZ - 6, wh = 20;
      const pan = TX.woodTextures({ size: 512, seed: 13, planks: 6, base: 0xd8b07a, dark: 0xa77c48, light: 0xecc896, ringFreq: 22, gap: 0.004, roughBase: 0.5 });
      for (const t of Object.values(pan)) t.repeat.set(5, 1);
      const wallMat = K.std({ map: pan.map, normalMap: pan.normalMap, roughness: 0.6, normalScale: V2(0.4) });
      const W0 = BOUNDS.minX - 4, W1 = BOUNDS.maxX + 4;
      const hx0 = EX.x - 6.5, hx1 = EX.x + 6.5; // hatch opening
      K.mesh(box(hx0 - W0, wh, 12), wallMat, (W0 + hx0) / 2, wh / 2, wz);
      K.mesh(box(W1 - hx1, wh, 12), wallMat, (hx1 + W1) / 2, wh / 2, wz);
      K.mesh(box(hx1 - hx0, wh - 9, 12), wallMat, EX.x, 9 + (wh - 9) / 2, wz);
      K.mesh(box(hx1 - hx0, 9, 2), K.std({ color: 0x0c0806, roughness: 1 }), EX.x, 4.5, wz - 5, { cast: false });
      for (const s of [-1, 1]) K.mesh(box(1, 9, 12), K.std({ color: 0x1a120c, roughness: 1 }), EX.x + s * 6, 4.5, wz, { cast: false });
      K.mesh(box(W1 - W0, 1.6, 16), K.std({ color: 0x5a3520, roughness: 0.45 }), (W0 + W1) / 2, wh + 0.8, wz + 1);
      K.box((W0 + W1) / 2, wz + 1, (W1 - W0) / 2, 7, 0, 30);
      // noren over the hatch: indigo cloth panels with a white wave
      const nc = canvas(256, 192, (g, w, h) => {
        g.fillStyle = '#1e2f66'; g.fillRect(0, 0, w, h);
        g.strokeStyle = 'rgba(240,240,232,0.92)'; g.lineWidth = 7;
        for (let k = 0; k < 3; k++) { g.beginPath(); for (let x = -20; x <= w + 20; x += 4) { const y = 108 + k * 18 + Math.sin(x / 22) * 8; if (x === -20) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke(); }
        g.fillStyle = 'rgba(240,240,232,0.95)'; g.beginPath(); g.arc(w / 2, 52, 26, 0, TAU); g.fill();
        g.fillStyle = '#1e2f66'; g.beginPath(); g.arc(w / 2 + 9, 46, 21, 0, TAU); g.fill();
        g.fillStyle = 'rgba(0,0,0,0.35)'; for (const x of [w / 3, (2 * w) / 3]) g.fillRect(x - 1.5, 70, 3, h);
      });
      const noren = K.std({ map: tex(nc, [1, 1], false), roughness: 0.9, side: T.DoubleSide });
      const nm = K.mesh(new T.PlaneGeometry(14, 10, 3, 1), noren, EX.x, wh - 5.5, wz + 6.4, { cast: false });
      A.noren = nm;
      // menu plaques along the wall (made-up dishes and prices)
      const menu = ['SALMON 120', 'TUNA 160', 'EGG 100', 'EBI 140', 'ROLL 110', 'ROE 220', 'INARI 90', 'UNI 300', 'TEA FREE', 'MISO 150'];
      const mc = canvas(1024, 64, (g, w, h) => {
        g.fillStyle = '#efe2c4'; g.fillRect(0, 0, w, h);
        menu.forEach((s, i) => {
          const x0 = (i * w) / menu.length; g.fillStyle = i % 2 ? '#f6ecd6' : '#e8d8b6'; g.fillRect(x0 + 2, 2, w / menu.length - 4, h - 4);
          g.fillStyle = '#3a1e10'; g.font = '700 22px Rubik, sans-serif'; g.textAlign = 'center'; g.fillText(s, x0 + w / menu.length / 2, 40);
        });
      });
      const plaque = K.std({ map: tex(mc, [1, 1], false), roughness: 0.7 });
      for (const [x0, x1] of [[BOUNDS.minX + 8, hx0 - 10], [hx1 + 10, BOUNDS.maxX - 6]]) {
        K.mesh(new T.PlaneGeometry(x1 - x0, 4.2), plaque, (x0 + x1) / 2, 14.5, wz + 6.05, { cast: false });
      }
    }

    // ============================================================ hazards: soy puddle (NE hairpin, wide) and wasabi (inside of the last corner)
    {
      const soy = K.phys({ color: 0x2a1206, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, opacity: 0.94 });
      const sp = K.spill(110, -85.5, 6.4, soy, { lump: 0.35, stretch: 1.5, angle: 0.15, y: 0.1, thick: 0.22 });
      K.surface('slick', { poly: sp.poly });
      for (let i = 0; i < 5; i++) K.spill(120 + i * 2.6 + r.range(-0.6, 0.6), -90 - i * 1.4 + r.range(-0.6, 0.6), r.range(0.6, 1.2), soy, { y: 0.08, thick: 0.15, n: 18 });
      A.soyMat = soy;
      const wasabi = K.phys({ color: 0x8cbf3c, roughness: 0.55, clearcoat: 0.3, normalMap: TX.mottledTextures({ size: 128, a: 0xffffff, b: 0xdddddd, seed: 66, period: 16, bump: 4 }).normalMap, normalScale: V2(1.2) });
      let sA = 0, kA = 0;
      for (let s0 = 880; s0 < 940; s0 += 1) { const k = track.at(s0).curv; if (k > kA) { kA = k; sA = s0; } } // apex of the last corner
      const wp = track.place(sA - 3, RW / 2 + 1.2);
      const ws = K.spill(wp.x, wp.z, 5.4, wasabi, { lump: 0.45, stretch: 1.8, angle: wp.angle, y: 0.14, thick: 0.45 });
      K.surface('sticky', { poly: ws.poly });
      A.wasabiAt = [wp.x, wp.z];
      // the little leaf dish it slid off
      const lf = frame(wp.x + wp.nx * 9, 0, wp.z + wp.nz * 9, -wp.angle);
      lf(cyl(3.2, 2.8, 0.5, 6).scale(1.5, 1, 0.8), 0x4a7a3a, { y: 0.25 }, M.ceramic);
      AO(wp.x + wp.nx * 9, wp.z + wp.nz * 9, 5, 3, 0.35, wp.angle);
    }

    // ============================================================ plates riding the belt
    {
      for (const p of PLS) A.plateCols.push(K.circle(0, 0, PL.cr, PL.h, { bounce: 0.15 }));
      const plateG = lathe([[3.3, 0], [3.7, 0], [3.8, 0.45], [3.6, 0.7], [5.4, 0.95], [6.6, 1.55], [6.75, 1.85], [6.55, 2.0], [5.6, 1.5], [4.3, 1.18], [0.01, 1.12]].map(([a, b]) => [a * PL.r / 6.75, b]), 40);
      const wellG = new T.CircleGeometry(4.3, 32).rotateX(-PI / 2).translate(0, 1.15, 0);
      const plateMat = K.ceramic(0xffffff, { roughness: 0.18 });
      const wellMat = K.ceramic(0xf6f1e6, { roughness: 0.2 });
      // rice: grainy white, slightly translucent-looking
      const riceT = TX.mottledTextures({ size: 128, a: 0xffffff, b: 0xe8e4da, seed: 67, period: 32, bump: 6 });
      const riceMat = K.phys({ color: 0xfbfaf4, roughness: 0.55, normalMap: riceT.normalMap, normalScale: V2(1.6), sheen: 0.6, sheenColor: new T.Color(0xffffff) });
      const riceG = rbox(4.2, 1.7, 2.2, 0.75, 3);
      // fish topping: draped slice with lighter fat lines (tinted per instance)
      const fishC = canvas(128, 64, (g, w, h) => {
        g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
        g.strokeStyle = 'rgba(255,255,255,1)'; g.lineWidth = 3;
        for (let i = -4; i < 12; i++) { g.strokeStyle = 'rgba(205,195,190,0.0)'; }
        for (let i = -2; i < 10; i++) { g.fillStyle = 'rgba(150,150,150,0.18)'; g.beginPath(); g.moveTo(i * 16, 0); g.lineTo(i * 16 + 10, 0); g.lineTo(i * 16 + 26, h); g.lineTo(i * 16 + 16, h); g.fill(); }
      });
      const fishMat = K.phys({ map: tex(fishC, [1, 1]), roughness: 0.22, clearcoat: 0.9, clearcoatRoughness: 0.12 });
      const fishG = (() => {
        const g = rbox(5.0, 0.6, 2.6, 0.28, 2);
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, p.getY(i) - 0.35 * (x / 2.5) ** 2 - 0.12 * (z / 1.3) ** 2); }
        g.computeVertexNormals();
        return g;
      })();
      const noriMat = K.std({ color: 0x1b2418, roughness: 0.75 });
      const bandG = box(1.1, 0.12, 2.5);
      // maki rolls: nori side, rice caps; fillings tinted per instance
      const rollG = cyl(1.25, 1.25, 1.9, 18);
      const rollTopC = canvas(64, 64, (g) => { g.fillStyle = '#1b2418'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#fbfaf4'; g.beginPath(); g.arc(32, 32, 28, 0, TAU); g.fill(); for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(200,196,186,0.7)'; g.fillRect(4 + hash(i) * 56, 4 + hash(i, 2) * 56, 3, 2); } });
      const rollMats = [noriMat, K.std({ map: tex(rollTopC, [1, 1], false), roughness: 0.6 }), K.std({ map: tex(rollTopC, [1, 1], false), roughness: 0.6 })];
      const fillG = new T.CircleGeometry(0.55, 12).rotateX(-PI / 2);
      // gunkan: nori wall, roe on top
      const gunG = cyl(1.6, 1.6, 1.9, 20);
      const roeT = TX.mottledTextures({ size: 128, a: 0xff6a1a, b: 0xd63a0a, seed: 68, period: 12, bump: 9, pebbles: 120, pebbleColor: 0xff8a3a });
      const roeMat = K.phys({ map: roeT.map, normalMap: roeT.normalMap, normalScale: V2(2), roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05 });
      const roeG = sph(1.5, 18, 8).scale(1, 0.38, 1);
      const inariMat = K.phys({ color: 0xc8842e, roughness: 0.5, clearcoat: 0.4, normalMap: riceT.normalMap, normalScale: V2(0.7) });
      const inariG = rbox(4.0, 2.0, 2.4, 0.9, 3);
      const domeG = (() => { const g = sph(5.9, 28, 12, 0, TAU, 0, PI / 2); g.scale(1, 0.92, 1); return g; })();
      const domeMat = K.glass(0xffffff, 0.16, { side: T.FrontSide });
      const knobG = sph(0.8, 12, 8);
      // instance lists: local transforms per plate (relative to the plate's centre, y = top of the slats)
      const items = { plate: [], well: [], rice: [], fish: [], band: [], roll: [], fill: [], gun: [], roe: [], inari: [], dome: [], knob: [] };
      const FISH = { salmon: 0xff8a52, tuna: 0xc8222e, tamago: 0xf6cf3a, shrimp: 0xff9a7a };
      for (const p of PLS) {
        const L = (key, o, color) => items[key].push({ p, M: mtx(o), color });
        L('plate', {}, p.color); L('well', {});
        if (p.kind === 'maki') {
          for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; L('roll', { x: Math.cos(a) * 2.6, y: 1.12 + 0.95, z: Math.sin(a) * 2.6 }); L('fill', { x: Math.cos(a) * 2.6, y: 1.12 + 1.92, z: Math.sin(a) * 2.6 }, k % 2 ? 0x5aa83a : 0xe23a3a); }
        } else if (p.kind === 'gunkan') {
          for (const z of [-1.8, 1.8]) { L('gun', { y: 1.12 + 0.95, z }); L('roe', { y: 1.12 + 1.9, z }); }
        } else if (p.kind === 'inari') {
          for (const z of [-1.4, 1.4]) L('inari', { y: 1.12 + 1.0, z, ry: 0.1 * z });
        } else {
          for (const z of [-1.35, 1.35]) {
            L('rice', { y: 1.12 + 0.85, z, ry: 0.05 * z });
            L('fish', { y: 1.12 + 1.95, z, ry: 0.05 * z, rz: 0.04 * z }, FISH[p.kind]);
            if (p.kind === 'tamago') L('band', { y: 1.12 + 2.25, z });
          }
        }
        if (p.dome) { L('dome', { y: 1.1 }); L('knob', { y: 1.1 + 5.5 }); }
      }
      const mk = (key, geo, mat, colors = false, cast = true) => {
        const list = items[key];
        if (!list.length) return null;
        const im = new T.InstancedMesh(geo, mat, list.length);
        list.forEach((it, i) => { im.setMatrixAt(i, it.M); if (colors) im.setColorAt(i, _c.set(it.color ?? 0xffffff)); });
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
        im.castShadow = cast; im.receiveShadow = true; im.frustumCulled = false;
        K.group.add(im);
        return { im, list };
      };
      A.plateIM = [
        mk('plate', plateG, plateMat, true), mk('well', wellG, wellMat, false, false), mk('rice', riceG, riceMat), mk('fish', fishG, fishMat, true),
        mk('band', bandG, noriMat), mk('roll', rollG, rollMats), mk('fill', fillG, K.std({ roughness: 0.5 }), true, false), mk('gun', gunG, noriMat),
        mk('roe', roeG, roeMat, false, false), mk('inari', inariG, inariMat), mk('dome', domeG, domeMat, false, false), mk('knob', knobG, K.glass(0xffffff, 0.4), false, false),
      ].filter(Boolean);
      A.plateAO = K.instances(new T.PlaneGeometry(1, 1).rotateX(-PI / 2), contactMat, PLS.map(() => ({ x: 0, y: 0.2, z: 0, sx: 15, sy: 0.32, sz: 15 })), { cast: false, receive: false });
      A.plateAO.renderOrder = 1; A.plateAO.frustumCulled = false;
      A.m4 = new T.Matrix4(); A.m4b = new T.Matrix4(); A.q = new T.Quaternion(); A.vv = new T.Vector3(); A.sc = new T.Vector3(1, 1, 1); A.yAx = new T.Vector3(0, 1, 0); A.aoS = new T.Vector3(15, 0.32, 15);
    }

    // ============================================================ the express lane, station, crossing lamps and the bullet tray
    {
      const z0 = BOUNDS.minZ - 1, z1 = EX.zs + EX.hw + 2;
      const lane = K.std({ color: 0xc6ccd2, metalness: 0.85, roughness: 0.32, roughnessMap: brushed.roughnessMap });
      K.mesh(box(7.4, 0.12, z1 - z0), lane, EX.x, 0.08, (z0 + z1) / 2, { cast: false });
      for (const s of [-1, 1]) K.mesh(box(0.35, 0.13, z1 - z0), K.std({ color: 0x30363c, roughness: 0.5 }), EX.x + s * 1.6, 0.1, (z0 + z1) / 2, { cast: false });
      // LED studs along both sides of the lane (red chase while the tray runs)
      A.leds = [];
      for (let z = z0 + 1.5; z < z1; z += 3) for (const s of [-1, 1]) A.leds.push({ x: EX.x + s * 3.25, z });
      A.ledIM = new T.InstancedMesh(cyl(0.42, 0.42, 0.2, 10), new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), A.leds.length);
      A.leds.forEach((l, i) => { A.ledIM.setMatrixAt(i, new T.Matrix4().makeTranslation(l.x, 0.18, l.z)); A.ledIM.setColorAt(i, _c.set(0x220a08)); });
      A.ledIM.instanceColor.needsUpdate = true; K.group.add(A.ledIM);
      // the pick-up station: buffer stop, a ticket rail and a small roof
      const st = frame(EX.x, 0, EX.zs + EX.hw + 2.6, 0);
      st(rbox(8, 2.6, 1.8, 0.4), 0xd7dbe0, { y: 1.3 }, M.metal);
      st(rbox(5, 1.2, 0.8, 0.35), 0xd8342c, { y: 2.0, z: -1.2 }, M.paint);
      st(cyl(0.3, 0.3, 6, 8), 0xd7dbe0, { x: 5.2, y: 3, z: 0.2 }, M.metal);
      const sg = canvas(256, 96, (g, w, h) => { g.fillStyle = '#1f5fd0'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = '44px "Lilita One", sans-serif'; g.textAlign = 'center'; g.fillText('EXPRESS', w / 2, 62); g.fillStyle = '#ffd23a'; g.fillRect(0, h - 10, w, 10); });
      K.mesh(new T.PlaneGeometry(7, 2.6), K.std({ map: tex(sg, [1, 1], false), roughness: 0.5, side: T.DoubleSide }), EX.x + 5.2, 6.6, EX.zs + EX.hw + 2.8, { rx: -0.5, cast: true });
      AO(EX.x, EX.zs + EX.hw + 2.6, 5.5, 2.2, 0.4);
      K.box(EX.x, EX.zs + EX.hw + 2.6, 4.6, 1.2, 0, 10);
      // crossing lamps on short posts, either side of the road
      A.lampMat = K.phys({ color: 0x4a0806, emissive: 0xff2010, emissiveIntensity: 0, roughness: 0.2, clearcoat: 1 });
      const lamps = [[EX.x + 5.5, -109.5], [EX.x - 5.5, -80]];
      A.lampPos = lamps;
      for (const [x, z] of lamps) {
        const f = frame(x, 0, z, 0);
        f(cyl(0.45, 0.55, 7, 10), 0x2a2e33, { y: 3.5 }, M.metal);
        f(cyl(1.4, 1.5, 0.6, 18), 0x2a2e33, { y: 0.3 }, M.metal);
        f(cyl(1.25, 1.25, 1.4, 16).rotateX(PI / 2), 0x1a1c20, { y: 7.6 }, M.paint);
        f(cyl(1.5, 1.5, 0.9, 16, true).rotateX(PI / 2), 0x1a1c20, { y: 7.85, z: 0.9 }, M.paint);
        f(box(5.6, 1.2, 0.4), 0xf4f1ea, { y: 5.2, z: 0.3 }, M.paint);
        for (const sx of [-1, 1]) f(box(1.2, 1.2, 0.42), 0xd8342c, { x: sx * 1.4, y: 5.2, z: 0.31 }, M.paint);
        K.mesh(sph(1.0, 16, 10).scale(1, 1, 0.55), A.lampMat, x, 7.6, z + 0.65, { cast: false });
        AO(x, z, 1.8, 1.8, 0.45);
        K.circle(x, z, 1.4, 9);
      }
      // the bullet tray: white nose-cone body, blue stripe, dark windows, a small plate of sushi on its back
      const tray = new T.Group();
      const body = K.phys({ color: 0xf4f6f8, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.06 });
      const blue = K.phys({ color: 0x1f5fd0, roughness: 0.25, clearcoat: 1 });
      const dark = K.phys({ color: 0x14202c, roughness: 0.08, clearcoat: 1 });
      const bodyG = (() => {
        const prof = [];
        for (let i = 0; i <= 12; i++) { const t = i / 12; prof.push([Math.max(0.01, 1.35 * Math.sqrt(Math.sin(t * PI / 2))), t * 6]); }
        const nose = K.lathe(prof, 20); nose.rotateZ(-PI / 2); nose.scale(1, 1, 1.85); // points to +x
        nose.translate(EX.hw - 6, 1.6, 0);
        const mid = rbox(2 * EX.hw - 6, 2.7, 4.9, 1.1, 3); mid.translate(-3, 1.6, 0);
        return [mid, nose];
      })();
      for (const g of bodyG) { const m = new T.Mesh(g, body); m.castShadow = true; tray.add(m); }
      const stripe = new T.Mesh(box(2 * EX.hw - 4, 0.35, 5.0), blue); stripe.position.set(-2, 1.25, 0); tray.add(stripe);
      const win = new T.Mesh(box(2 * EX.hw - 7, 0.55, 5.02), dark); win.position.set(-3, 2.2, 0); tray.add(win);
      const wind = new T.Mesh(box(1.6, 0.9, 3.4), dark); wind.position.set(EX.hw - 5.6, 2.6, 0); wind.rotation.z = -0.5; tray.add(wind);
      const tp = new T.Mesh(cyl(2.6, 2.2, 0.5, 24), K.ceramic(0x3fa05a)); tp.position.set(-3, 3.2, 0); tray.add(tp);
      for (const zz of [-1.0, 1.0]) {
        const rc = new T.Mesh(rbox(3.0, 1.1, 1.5, 0.5), K.phys({ color: 0xfbfaf4, roughness: 0.6 })); rc.position.set(-3, 3.9, zz); tray.add(rc);
        const fc = new T.Mesh(rbox(3.4, 0.4, 1.7, 0.18), K.phys({ color: 0xff8a52, roughness: 0.25, clearcoat: 0.8 })); fc.position.set(-3, 4.55, zz); tray.add(fc);
      }
      const head = new T.Mesh(sph(0.45, 10, 8), new T.MeshBasicMaterial({ color: 0xfff4c0, toneMapped: false })); head.position.set(EX.hw - 0.4, 1.5, 0); tray.add(head);
      tray.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      K.group.add(tray);
      A.tray = tray;
      A.trayAO = K.contact(EX.x, EX.zk, 3.6, 8, 0.4);
      // (bounce 0: the tray shoves a car out of its way, it doesn't fire it across the counter)
      A.exMover = K.mover({ type: 'box', hw: EX.hw, hd: EX.hd, h: EX.h, bounce: 0 }, (t) => ({ x: EX.x, z: exZ(t), angle: PI / 2 }));
    }

    // ============================================================ precomputed track data for tick (ride stretches, crossings)
    {
      const N = track.N, ride = new Int8Array(N);
      for (let i = 0; i < N; i++) {
        beltNear(track.x[i], track.z[i], -1, A.bn);
        const j = A.bn.i, dot = track.tx[i] * G.tx[j] + track.tz[i] * G.tz[j];
        if (Math.abs(A.bn.lat) < 3 && Math.abs(dot) > 0.95) ride[i] = dot > 0 ? 1 : -1;
      }
      // "on or approaching a ride" (looking 30 units ahead)
      const near = new Int8Array(N);
      for (let i = 0; i < N; i++) { for (let d = 0; d <= 60; d += 4) { const k = ride[(i + d) % N]; if (k) { near[i] = k; break; } } }
      A.ride = ride; A.rideNear = near;
      // where the road leaves the WITH stretch (end of the ride before the chef's side)
      { let k = tr0(track, 300); while (k < N && ride[k] === 1) k++; while (k > 0 && ride[k] !== 1) k--; A.sWX = (k + 1) * track.ds; }
      // X1: where the road crosses the north straight heading south
      const sAt = (x, z) => track.distTo(x, z).s;
      { // the sample where the road crosses the belt's centreline
        let bi = -1, bl = 1e9;
        for (let i = tr0(track, 420); i < tr0(track, 540); i++) { beltNear(track.x[i], track.z[i], -1, A.bn); if (Math.abs(A.bn.lat) < bl) { bl = Math.abs(A.bn.lat); bi = i; } }
        A.sX1 = bi * track.ds;
        beltNear(track.x[bi], track.z[bi], -1, A.bn); A.uX1 = A.bn.i * G.ds;
      }
      { const q = track.at(A.sX1); A.x1Map = q.nx * G.tx[A.bn.i] + q.nz * G.tz[A.bn.i]; } // track lateral -> belt arc length
      { // the island road meets the AGAINST stretch: where it first reaches the slats
        // (either edge of the road: it meets the belt's edge at a slant)
        let k = tr0(track, A.sX1 + 30);
        const hit = (i) => { for (const o of [-RW / 2, 0, RW / 2]) { beltNear(track.x[i] - track.tz[i] * o, track.z[i] + track.tx[i] * o, -1, A.bn); if (Math.abs(A.bn.lat) < BHW + 1.5) return true; } return false; };
        for (; k < N; k++) if (hit(k)) break;
        A.sAM = k * track.ds; A.uAM = A.bn.i * G.ds;
        // where a car on each lateral lane of the road first reaches the slats
        A.amLanes = [-6, -3, 0, 3, 6].map((lat) => {
          let j = tr0(track, A.sX1 + 30);
          for (; j < N; j++) { beltNear(track.x[j] - track.tz[j] * lat, track.z[j] + track.tx[j] * lat, -1, A.bn); if (Math.abs(A.bn.lat) < BHW + 0.8) break; }
          return { lat, s: j * track.ds, u: A.bn.i * G.ds };
        });
      }
      A.sEX = sAt(EX.x, -95);
      { const q = track.at(A.sEX); A.exRoadZ = q.z; A.exHalf = (RW / 2) / Math.max(0.3, Math.abs(q.tx)); }
      // occupancy windows of the express tray on the road strip, as cycle phases [[a, b], ...]
      const occ = [], step = 0.01;
      let inW = false, a0 = 0;
      for (let u = 0; u <= EX.P + step; u += step) {
        const z = exZ(u - EX.ph);
        const o = Math.abs(z - A.exRoadZ) < A.exHalf + EX.hw + 1.2;
        if (o && !inW) { inW = true; a0 = u; } else if (!o && inW) { inW = false; occ.push([a0, u]); }
      }
      A.exOcc = occ;
    }

    // ============================================================ scenery
    // ---- tea cups (yunomi) with green tea
    const teacup = (x, z, sc = 1) => {
      const f = frame(x, 0, z, r() * TAU, sc);
      f(lathe([[3.0, 0], [3.3, 0.3], [3.5, 1.2], [3.7, 8.2], [3.45, 8.3], [3.25, 1.3], [0.01, 1.1]], 28), r.pick([0xe8dcc4, 0x4a5a6a, 0x8a6a4a, 0x2a3a3a]), {}, M.ceramic);
      f(cyl(3.28, 3.28, 0.1, 24), 0x9cae4a, { y: 6.9 }, M.liquid, false);
      f(cyl(3.72, 3.72, 1.6, 24, true), 0xf4efe2, { y: 5.5 }, M.ceramic, false);
      AO(x, z, 4.4 * sc, 4.4 * sc, 0.42);
      K.circle(x, z, 3.7 * sc, 9);
    };
    // ---- soy dish with soy and a dab of wasabi
    const soyDish = (x, z) => {
      const f = frame(x, 0, z, r() * TAU);
      f(lathe([[3.4, 0], [3.8, 0.2], [4.6, 0.9], [4.7, 1.2], [4.4, 1.15], [3.5, 0.55], [0.01, 0.5]], 32), r.pick([0xf2efe8, 0x2a3a66, 0xe8e0d0]), {}, M.ceramic);
      f(cyl(3.6, 3.6, 0.06, 24), 0x2a1206, { y: 0.72 }, M.liquid, false);
      f(sph(0.9, 12, 8).scale(1, 0.6, 1), 0x8cbf3c, { x: 1.6, y: 1.0 }, M.food, false);
      AO(x, z, 5, 5, 0.35);
      K.circle(x, z, 4.6, 1.3);
    };
    // ---- chopsticks on a rest
    const chopsticks = (x, z, ry) => {
      const f = frame(x, 0, z, ry);
      f(rbox(3.4, 1.0, 1.2, 0.45), r.pick([0x2a3a66, 0xd8342c, 0xe8dcc4]), { x: 6, y: 0.5 }, M.ceramic);
      for (const s of [-0.55, 0.55]) f(cyl(0.38, 0.22, 23, 8).rotateZ(PI / 2), 0xd9b27a, { x: 0, y: 1.3, z: s }, M.paint);
      AO(x, z, 12, 1.6, 0.3, ry);
    };
    // ---- a hot-water tap on the counter
    const tap = (x, z, ry) => {
      const f = frame(x, 0, z, ry);
      f(cyl(2.2, 2.6, 1.2, 20), 0xd9dde2, { y: 0.6 }, M.metal);
      f(cyl(1.3, 1.3, 7, 16), 0xd9dde2, { y: 4.1 }, M.metal);
      f(rbox(2.4, 1.6, 4.6, 0.6), 0xd9dde2, { y: 7.6, z: 1.6 }, M.metal);
      f(cyl(0.5, 0.5, 1.4, 10), 0xd9dde2, { y: 6.6, z: 3.4 }, M.metal);
      f(cyl(0.9, 0.9, 0.6, 14), 0xd8342c, { y: 8.6, z: 0.4 }, M.paint);
      AO(x, z, 3, 3, 0.45);
      K.circle(x, z, 2.6, 9);
    };
    // ---- plate stacks (a customer's tally)
    const stack = (x, z, n) => {
      const f = frame(x, 0, z, r() * TAU);
      for (let i = 0; i < n; i++) f(lathe([[3.4, 0], [3.8, 0.45], [5.4, 0.95], [6.6, 1.55], [6.75, 1.85], [6.55, 2.0], [5.6, 1.5], [0.01, 1.2]], 40), r.pick(PL_COL), { y: i * 1.55, ry: r() * 6 }, M.ceramic);
      AO(x, z, 7.5, 7.5, 0.45);
      K.circle(x, z, 6.8, n * 1.55 + 0.5);
    };
    // ---- ordering tablet on a stand, angled to the seat
    const tabletTex = (() => {
      const c = canvas(512, 340, (g, w, h) => {
        g.fillStyle = '#fff8ec'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#d8342c'; g.fillRect(0, 0, w, 46);
        g.fillStyle = '#fff'; g.font = '30px "Lilita One", sans-serif'; g.textAlign = 'left'; g.fillText('SUSHI EXPRESS', 16, 33);
        g.font = '700 16px Rubik, sans-serif'; g.textAlign = 'right'; g.fillText('TABLE 7', w - 16, 30);
        const tabs = ['NIGIRI', 'ROLLS', 'SIDES', 'DRINKS'];
        tabs.forEach((s, i) => { g.fillStyle = i === 0 ? '#2f6fd0' : '#e8dcc4'; g.fillRect(12 + i * 124, 56, 116, 30); g.fillStyle = i === 0 ? '#fff' : '#5a3a20'; g.font = '700 15px Rubik, sans-serif'; g.textAlign = 'center'; g.fillText(s, 70 + i * 124, 77); });
        const dishes = [['#ff8a52', 'Salmon', '120'], ['#c8222e', 'Tuna', '160'], ['#f6cf3a', 'Egg', '100'], ['#ff9a7a', 'Prawn', '140'], ['#ff6a1a', 'Roe', '220'], ['#c8842e', 'Inari', '90']];
        dishes.forEach(([col, name, price], i) => {
          const x0 = 14 + (i % 3) * 164, y0 = 98 + Math.floor(i / 3) * 112;
          g.fillStyle = '#fff'; g.fillRect(x0, y0, 152, 102); g.strokeStyle = '#e0d4bc'; g.lineWidth = 2; g.strokeRect(x0, y0, 152, 102);
          g.fillStyle = '#f2f2f2'; g.beginPath(); g.ellipse(x0 + 76, y0 + 44, 52, 24, 0, 0, TAU); g.fill();
          for (const dx of [-16, 16]) { g.fillStyle = '#fbfaf4'; g.fillRect(x0 + 76 + dx - 14, y0 + 38, 28, 14); g.fillStyle = col; g.fillRect(x0 + 76 + dx - 16, y0 + 30, 32, 10); }
          g.fillStyle = '#3a2412'; g.font = '700 15px Rubik, sans-serif'; g.textAlign = 'left'; g.fillText(name, x0 + 8, y0 + 92);
          g.fillStyle = '#d8342c'; g.textAlign = 'right'; g.fillText(price, x0 + 144, y0 + 92);
        });
        g.fillStyle = '#2fae5a'; g.fillRect(w - 150, h - 26, 138, 22); g.fillStyle = '#fff'; g.font = '700 14px Rubik, sans-serif'; g.textAlign = 'center'; g.fillText('ORDER  ▶', w - 81, h - 10);
      });
      return tex(c, [1, 1], false);
    })();
    const screenMat = K.std({ map: tabletTex, emissive: 0xffffff, emissiveMap: tabletTex, emissiveIntensity: 0.55, roughness: 0.25 });
    const tablet = (x, z, ry) => {
      const f = frame(x, 0, z, ry);
      f(rbox(7, 0.8, 6, 0.3), 0x2a2e33, { y: 0.4 }, M.metal);
      f(rbox(1.6, 7, 1.2, 0.4), 0x2a2e33, { y: 4, z: -1 }, M.metal);
      const tl = new T.Group();
      const shell = new T.Mesh(rbox(21, 14, 1.0, 0.6), K.phys({ color: 0x18191c, roughness: 0.3, clearcoat: 0.8 })); tl.add(shell);
      const scr = new T.Mesh(new T.PlaneGeometry(19.4, 12.6), screenMat); scr.position.z = 0.52; tl.add(scr);
      tl.position.set(x - Math.sin(ry) * 0.3, 10.2, z - Math.cos(ry) * 0.3); tl.rotation.order = 'YXZ'; tl.rotation.y = ry; tl.rotation.x = -0.45;
      K.add(tl);
      AO(x, z, 8, 5, 0.4, -ry);
      K.circle(x, z, 4.5, 14);
    };
    // ---- call button box
    const callButton = (x, z, ry) => {
      const f = frame(x, 0, z, ry);
      f(rbox(6, 2.4, 4.4, 0.6), 0xf4f1ea, { y: 1.2 }, M.paint);
      f(cyl(1.4, 1.5, 0.8, 20), 0xd8342c, { y: 2.6, x: -1 }, M.paint);
      f(cyl(0.6, 0.6, 0.6, 12), 0x2fae5a, { y: 2.5, x: 1.8 }, M.glow, false);
      AO(x, z, 4, 3, 0.4, -ry);
      K.circle(x, z, 3, 2.6);
    };
    // ---- condiment caddy: soy bottles, a gari box, a tea tin, chopstick box
    const caddy = (x, z, ry) => {
      const f = frame(x, 0, z, ry);
      f(rbox(18, 2, 8, 0.4), 0x6a3a1e, { y: 1 }, M.paint);
      for (const dx of [-6, -2]) {
        f(lathe([[2, 0], [2.1, 0.3], [2.1, 6], [1.7, 7.5], [0.9, 8.4], [0.9, 9.6], [0.01, 9.6]], 20), 0xeef2f6, { x: dx, y: 2 }, M.ceramic);
        f(cyl(1.0, 1.0, 1.4, 14), 0xd8342c, { x: dx, y: 2 + 10.2 }, M.paint);
        f(cyl(2.05, 2.05, 3.6, 18, true), 0x2a1206, { x: dx, y: 2 + 2.2 }, M.liquid, false);
      }
      f(rbox(5, 4.5, 5, 0.3), 0xb9884e, { x: 3, y: 2 + 2.25 }, M.paint);
      f(rbox(5.2, 0.6, 5.2, 0.25), 0x8a5a2e, { x: 3, y: 2 + 4.7 }, M.paint);
      f(cyl(2, 2, 6.5, 20), 0x3f6a3a, { x: 7.5, y: 2 + 3.25 }, M.metal);
      AO(x, z, 10.5, 5.5, 0.5, -ry);
      K.box(x, z, 9.4, 4.2, -ry, 12);
    };
    // ---- gari (pickled ginger) dish
    const gari = (x, z) => {
      const f = frame(x, 0, z, r() * TAU);
      f(lathe([[2.6, 0], [3.2, 0.6], [3.4, 1.4], [3.1, 1.4], [0.01, 0.5]], 24), 0xe8e0d0, {}, M.ceramic);
      for (let i = 0; i < 9; i++) f(cyl(1.0, 1.0, 0.12, 10).scale(1, 1, 0.7), 0xf5b8b0, { x: r.range(-1.6, 1.6), y: 0.9 + i * 0.12, z: r.range(-1.6, 1.6), rx: r.range(-0.4, 0.4), rz: r.range(-0.4, 0.4) }, M.food, false);
      AO(x, z, 3.8, 3.8, 0.35);
      K.circle(x, z, 3.3, 1.5);
    };

    // ---- the customer side (south): seats between the belt and the runner, and along the edge
    const placeOK = (x, z, rad) => dRoad(x, z) > rad + 2.5 && !onBelt(x, z, rad + 1.5) && x > BOUNDS.minX + rad + 2 && x < BOUNDS.maxX - rad - 2 && z < BOUNDS.maxZ - rad - 1;
    const tryPut = (fn, x, z, rad, ...a) => { if (placeOK(x, z, rad)) { fn(x, z, ...a); return true; } return false; };
    for (const x of [104, 62, 20, -22]) {
      tryPut(teacup, x - 6, 62, 4);
      tryPut(soyDish, x + 4, 66, 5);
      tryPut(chopsticks, x - 2, 73.5, 12, PI);
      tryPut(gari, x + 12, 60, 4);
    }
    tryPut(tablet, 38, 64, 8, 0);
    tryPut(callButton, -36, 63, 4, PI);
    for (const x of [96, 40, -16]) tryPut(tap, x, 101, 3, PI);
    for (const [x, n] of [[72, 4], [10, 6], [-50, 3]]) tryPut(stack, x, 100.5, 7, n);
    for (const x of [116, -30]) tryPut(chopsticks, x, 102.5, 12, 0);
    // the SW corner: a tall tally of a hungry customer, a tea cup, a soy dish, a tablet facing west
    tryPut(stack, -158, 92, 7, 11);
    tryPut(stack, -142, 99, 7, 7);
    tryPut(teacup, -160, 70, 4);
    tryPut(soyDish, -148, 76, 5);
    tryPut(tablet, -162, 30, 8, -PI / 2);
    tryPut(callButton, -160, 46, 4, -PI / 2);
    tryPut(tap, -168, 10, 3, -PI / 2);
    tryPut(teacup, -150, -2, 4); tryPut(soyDish, -152, -16, 5); tryPut(chopsticks, -158, -30, 12, PI / 2);
    // the east side: seats facing the east edge, a caddy in the hairpin
    tryPut(caddy, 104, 6, 11, PI / 2);
    for (const z of [44, -24]) { tryPut(teacup, 112, z, 4); tryPut(soyDish, 104, z + 9, 5); tryPut(chopsticks, 116, z - 8, 12, PI / 2); }
    tryPut(tablet, 112, 26, 8, PI / 2);
    tryPut(gari, 98, -44, 4);
    tryPut(callButton, 116, -52, 4, PI / 2);
    // a sake set on a lacquer tray and a rolled hot towel in its basket, inside the NE hairpin
    const sake = (x, z, ry) => {
      const f = frame(x, 0, z, ry);
      f(rbox(16, 1.0, 10, 0.4), 0x2a0e0a, { y: 0.5 }, M.paint);
      f(box(15.2, 0.12, 9.2), 0xb01818, { y: 1.02 }, M.paint, false);
      f(lathe([[2.6, 0], [3.2, 0.5], [3.6, 3], [3.4, 6], [1.6, 8.6], [1.0, 10.4], [1.4, 11], [1.2, 11.2], [0.01, 11.2]], 28), 0xe8e2d4, { x: -4, y: 1.0 }, M.ceramic);
      for (const dx of [2.5, 6]) { f(lathe([[1.0, 0], [1.3, 0.3], [1.9, 2.3], [1.7, 2.4], [0.01, 0.6]], 20), 0xe8e2d4, { x: dx, y: 1.0, z: dx > 4 ? 2 : -2 }, M.ceramic); f(cyl(1.6, 1.6, 0.05, 16), 0xf2ead0, { x: dx, y: 2.9, z: dx > 4 ? 2 : -2 }, M.liquid, false); }
      AO(x, z, 9, 6, 0.4, -ry);
      K.box(x, z, 8, 5, -ry, 11);
    };
    const towel = (x, z, ry) => {
      const f = frame(x, 0, z, ry);
      f(rbox(13, 1.4, 6, 0.6), 0x8a6a3a, { y: 0.7 }, M.matte);
      f(cyl(2.0, 2.0, 11, 18).rotateZ(PI / 2), 0xf6f4ee, { y: 3.1 }, M.matte);
      f(cyl(2.02, 2.02, 1.2, 18).rotateZ(PI / 2), 0x2a3a66, { y: 3.1, x: 3.5 }, M.matte);
      AO(x, z, 7.5, 4, 0.35, -ry);
      K.box(x, z, 6.5, 3, -ry, 5);
    };
    tryPut(sake, 108, -44, 10, 0.25);
    tryPut(towel, 106, -22, 8, -0.4);
    // the chef's side between the loop and the hairpin: a big sake bottle, a wooden cup, clean plates ready to go
    {
      const lab = canvas(256, 128, (g, w, h) => { g.fillStyle = '#f4ecd8'; g.fillRect(0, 0, w, h); g.strokeStyle = '#8a1a14'; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16); g.fillStyle = '#1a1410'; g.font = '34px "Lilita One", sans-serif'; g.textAlign = 'center'; g.fillText('KAWA', w / 2, 62); g.font = '700 16px Rubik, sans-serif'; g.fillText('RICE WINE · 1800', w / 2, 96); });
      const bx = 56, bz = -103;
      K.mesh(lathe([[5, 0], [5.4, 0.5], [5.4, 22], [4.6, 26], [2.2, 31], [1.8, 37], [2.0, 38.5], [0.01, 38.5]], 32), K.phys({ color: 0x3a1c0c, roughness: 0.06, clearcoat: 1, transparent: true, opacity: 0.92 }), bx, 0, bz);
      K.mesh(cyl(5.45, 5.45, 9, 32, true), K.std({ map: tex(lab, [1, 1], false), roughness: 0.7 }), bx, 12, bz, { ry: -0.5 });
      K.mesh(cyl(2.05, 2.05, 2, 16), K.std({ color: 0xd8b27a, roughness: 0.6 }), bx, 38.6, bz);
      AO(bx, bz, 6.5, 6.5, 0.5);
      K.circle(bx, bz, 5.5, 39);
      const mf = frame(70, 0, -100, 0.3);
      mf(box(7, 6.5, 7), 0xe2c99a, { y: 3.25 }, M.paint);
      mf(box(6, 0.2, 6), 0xf2ead0, { y: 5.6 }, M.liquid, false);
      AO(70, -100, 4.6, 4.6, 0.4, -0.3);
      K.box(70, -100, 3.5, 3.5, -0.3, 6.5);
      stack(36, -100, 6); stack(24, -104, 4);
      gari(84, -104);
    }
    tryPut(towel, -150, 54, 8, 0.2);
    tryPut(sake, -152, -36, 10, PI / 2 + 0.2);
    // paper chopstick sleeves (made-up print) lying by the seats
    {
      const sc = canvas(256, 32, (g, w, h) => { g.fillStyle = '#f6f1e4'; g.fillRect(0, 0, w, h); g.fillStyle = '#c8241c'; g.fillRect(0, 0, 40, h); g.fillStyle = '#fff'; g.font = '700 16px Rubik, sans-serif'; g.fillText('SE', 9, 22); g.fillStyle = '#1e2f66'; g.font = '700 15px Rubik, sans-serif'; g.fillText('SUSHI EXPRESS · THANK YOU', 50, 21); });
      const sm = K.std({ map: tex(sc, [1, 1], false), roughness: 0.9 });
      const sl = [];
      for (const [x, z, ry] of [[96, 71, 0.15], [54, 70, -0.1], [-12, 73, 0.3], [-158, 18, 1.4], [116, 34, 1.7], [117, -14, 1.5], [66, 103, 0.05], [-48, 104, -0.08]]) if (placeOK(x, z, 12)) sl.push({ x, y: 0.12, z, ry });
      if (sl.length) K.instances(new T.PlaneGeometry(21, 2.6).rotateX(-PI / 2), sm, sl, { cast: false });
    }

    // ---- the chef's side (north-west): cutting board, knife, fish, rice tub, rolling mat, geta, wasabi
    {
      const hn = TX.woodTextures({ size: 512, seed: 21, planks: 1, base: 0xe9d2a6, dark: 0xcfb07c, light: 0xf6e6c4, ringFreq: 26, gap: 0, roughBase: 0.6 });
      const bx = -118, bz = -92, bry = 0.06;
      K.mesh(rbox(46, 2.6, 27, 0.6), K.std({ map: hn.map, normalMap: hn.normalMap, normalScale: V2(0.3), roughness: 0.55 }), bx, 1.3, bz, { ry: bry });
      AO(bx, bz, 25, 15, 0.45, -bry);
      K.box(bx, bz, 23, 13.5, -bry, 2.6);
      const f = frame(bx, 2.6, bz, bry);
      // yanagiba: long single-bevel blade, magnolia handle with a dark ferrule
      const blade = new T.Shape(); blade.moveTo(0, 0); blade.lineTo(25, 0.0); blade.quadraticCurveTo(28, 0.4, 29.5, 2.4); blade.lineTo(0, 3.1); blade.closePath();
      const bg = new T.ExtrudeGeometry(blade, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.08, bevelSegments: 1 }); bg.rotateX(-PI / 2);
      f(bg, 0xe8ecf0, { x: -6, y: 0.2, z: 7, ry: 0.18 }, M.metal);
      f(cyl(1.05, 1.15, 13, 8).rotateZ(PI / 2), 0xe2c99a, { x: -13.5, y: 1.15, z: 6.4, ry: 0.18 }, M.paint);
      f(cyl(1.18, 1.18, 1.8, 8).rotateZ(PI / 2), 0x1a1410, { x: -6.6, y: 1.15, z: 7.6, ry: 0.18 }, M.paint);
      // a salmon block and a tuna block (saku)
      const salC = canvas(128, 64, (g, w, h) => { g.fillStyle = '#ff8a52'; g.fillRect(0, 0, w, h); for (let i = -2; i < 12; i++) { g.strokeStyle = 'rgba(255,240,225,0.75)'; g.lineWidth = 3; g.beginPath(); g.moveTo(i * 13, 0); g.quadraticCurveTo(i * 13 + 10, h / 2, i * 13 + 2, h); g.stroke(); } });
      const salMat = K.phys({ map: tex(salC, [1, 1]), roughness: 0.2, clearcoat: 0.9, clearcoatRoughness: 0.1 });
      K.mesh(rbox(13, 3.2, 5.5, 0.6), salMat, bx + 6, 4.2, bz - 4.5, { ry: bry - 0.1 });
      K.mesh(rbox(10, 3, 4.6, 0.5), K.phys({ color: 0xb01828, roughness: 0.2, clearcoat: 0.8 }), bx - 9, 4.1, bz - 5, { ry: bry + 0.15 });
      // a few nigiri ready on a geta board
      const gx = -150, gz = -98;
      const gf = frame(gx, 0, gz, -0.08);
      gf(rbox(28, 1.6, 13, 0.3), 0xd8b27a, { y: 3.0 }, M.paint);
      for (const s of [-9, 9]) gf(box(2, 2.2, 12), 0xb88e58, { x: s, y: 1.1 }, M.paint);
      ['salmon', 'tuna', 'tamago', 'shrimp'].forEach((k, i) => {
        const c = { salmon: 0xff8a52, tuna: 0xc8222e, tamago: 0xf6cf3a, shrimp: 0xff9a7a }[k];
        gf(rbox(4.2, 1.7, 2.2, 0.75, 3), 0xfbfaf4, { x: -9 + i * 6, y: 3.8 + 0.85, ry: PI / 2 }, M.food);
        gf(rbox(2.6, 0.6, 5.0, 0.28, 2), c, { x: -9 + i * 6, y: 3.8 + 1.95, ry: 0 }, M.food);
      });
      gf(sph(1.4, 12, 8).scale(1, 0.5, 1.3), 0x8cbf3c, { x: 11, y: 4.2, z: 3 }, M.food);
      for (let i = 0; i < 6; i++) gf(cyl(1.1, 1.1, 0.12, 10).scale(1, 1, 0.7), 0xf5b8b0, { x: 11 + r.range(-1, 1), y: 4 + i * 0.14, z: -3 + r.range(-1, 1), rx: r.range(-0.3, 0.3) }, M.food, false);
      AO(gx, gz, 15, 8, 0.45, 0.08);
      K.box(gx, gz, 14, 6.8, 0.08, 6);
      // the rice tub (hangiri) with copper bands and a paddle
      const tx = -157, tz = -62;
      const tf = frame(tx, 0, tz, 0.3);
      tf(lathe([[14, 0], [15, 0.3], [15.2, 8.5], [14.2, 8.6], [14, 1.2], [0.01, 1.0]], 48), 0xd9b27a, {}, M.paint);
      for (const y of [2, 6.6]) tf(new T.TorusGeometry(15.25, 0.35, 8, 48).rotateX(PI / 2), 0xc87a3a, { y }, M.metal);
      tf(lathe([[0.01, 7.4], [8, 7.2], [12, 6.6], [14, 6.2], [14, 5.6], [0.01, 5.6]], 40), 0xfbfaf4, {}, M.food);
      tf(rbox(4.5, 0.5, 8, 0.25), 0xe2c99a, { x: 4, y: 7.6, z: 4, ry: 0.6, rx: 0.1 }, M.paint);
      tf(cyl(0.6, 0.6, 12, 8).rotateX(PI / 2), 0xe2c99a, { x: 8.5, y: 9.2, z: 10, ry: 0.6, rx: -0.3 }, M.paint);
      AO(tx, tz, 17, 17, 0.5);
      K.circle(tx, tz, 15.3, 9);
      // bamboo rolling mat with a half-rolled maki
      const mc = canvas(128, 128, (g, w, h) => { for (let y = 0; y < h; y += 6) { const k = 190 + hash(y) * 30; g.fillStyle = `rgb(${k | 0},${k * 0.9 | 0},${k * 0.55 | 0})`; g.fillRect(0, y, w, 5); g.fillStyle = 'rgba(90,70,40,0.7)'; g.fillRect(0, y + 5, w, 1); } for (const x of [12, 40, 64, 88, 116]) { g.fillStyle = 'rgba(70,50,30,0.6)'; g.fillRect(x, 0, 2, h); } });
      K.mesh(box(22, 0.5, 22), K.std({ map: tex(mc, [1, 1], false), roughness: 0.75 }), -88, 0.25, -84, { ry: 0.25 });
      K.mesh(new T.PlaneGeometry(10, 16).rotateX(-PI / 2), K.std({ color: 0x1b2418, roughness: 0.7 }), -88, 0.52, -84, { ry: 0.25 });
      K.mesh(cyl(2.4, 2.4, 15, 20).rotateX(PI / 2), K.std({ color: 0x1b2418, roughness: 0.7 }), -92, 2.9, -86, { ry: 0.25 });
      AO(-88, -84, 12, 12, 0.3, 0.25);
      // wasabi root with a grater, a bowl of hand water, a folded towel
      const wf = frame(-72, 0, -103, 0.4);
      wf(rbox(4, 0.6, 12, 0.25), 0xd9dde2, { y: 0.4 }, M.metal);
      wf(cyl(1.4, 1.1, 9, 12).rotateZ(PI / 2), 0x7aa84a, { x: 5, y: 1.4, z: 3 }, M.food);
      wf(cyl(2.4, 2.4, 1.6, 12).rotateZ(PI / 2), 0x5a8a3a, { x: 10.5, y: 2.4, z: 3 }, M.food);
      AO(-70, -102, 8, 6, 0.35, 0.4);
      const bowl = frame(-100, 0, -104, 0);
      bowl(lathe([[3.5, 0], [4, 0.3], [5.6, 3.5], [5.3, 3.6], [3.8, 0.9], [0.01, 0.8]], 32), 0x2a3a66, {}, M.ceramic);
      bowl(cyl(5.2, 5.2, 0.08, 24), 0xcfe0e8, { y: 2.8 }, M.liquid, false);
      AO(-100, -104, 6, 6, 0.4);
      K.circle(-100, -104, 5.4, 3.6);
      // a lidded miso bowl and a board of rolled omelette, ready for the pass
      const mb = frame(-64, 0, -76, 0.3);
      mb(lathe([[2.4, 0], [3.0, 0.4], [4.6, 2.6], [5.0, 4.4], [4.7, 4.5], [0.01, 4.5]], 32), 0x5a0e0a, {}, M.paint);
      mb(lathe([[0.01, 4.4], [4.9, 4.4], [4.4, 6.0], [2.0, 6.9], [1.4, 7.0], [1.4, 7.6], [0.01, 7.6]], 32), 0x1a0a08, {}, M.paint);
      AO(-64, -76, 5.6, 5.6, 0.45);
      K.circle(-64, -76, 5, 7.5);
      const tb = frame(-80, 0, -64, -0.2);
      tb(rbox(16, 1.2, 8, 0.3), 0xd9b27a, { y: 0.6 }, M.paint);
      for (let i = 0; i < 4; i++) tb(rbox(3.2, 2.4, 5.2, 0.5), 0xf6cf3a, { x: -5.4 + i * 3.6, y: 2.4 }, M.food);
      tb(cyl(0.25, 0.25, 15, 6).rotateZ(PI / 2), 0xe2c99a, { y: 1.5, z: 3.2 }, M.paint);
      AO(-80, -64, 9, 5, 0.4, 0.2);
      K.box(-80, -64, 8, 4, 0.2, 4);
      const tw = frame(-166, 0, -102, 0.1);
      tw(rbox(14, 1.6, 9, 0.7), 0xf2efe8, { y: 0.8 }, M.matte);
      tw(box(14.1, 1.62, 1.2), 0x2a3a66, { y: 0.8, z: 2.5 }, M.matte);
      AO(-166, -102, 8, 5.5, 0.35, 0.1);
    }

    // ---- the island: bamboo in a stone pot, a stack of clean plates, sauce bottles, a menu card, a teapot
    {
      const bx = -78, bz = 4;
      const f = frame(bx, 0, bz, 0.3);
      f(rbox(13, 7, 13, 1.2), 0x6a6a66, { y: 3.5 }, M.matte);
      f(box(11.5, 0.4, 11.5), 0x3a2a1e, { y: 6.9 }, M.matte);
      for (let i = 0; i < 12; i++) f(sph(0.7, 8, 6), r.pick([0xe8e4dc, 0x8a8a84, 0x3a3a38]), { x: r.range(-4.6, 4.6), y: 7.2, z: r.range(-4.6, 4.6) }, M.matte, false);
      const stalks = [[-2, -1, 34], [2, 1.5, 28], [0.5, -3, 22]];
      const leafMat = K.std({ vertexColors: true, roughness: 0.6, side: T.DoubleSide });
      for (const [sx, sz, h] of stalks) {
        for (let y = 7; y < 7 + h; y += 6.5) {
          f(cyl(0.95, 1.0, 6.1, 10), 0x7aa84a, { x: sx, y: y + 3.1, z: sz }, M.paint);
          f(cyl(1.1, 1.1, 0.5, 10), 0x5a8a3a, { x: sx, y: y + 6.3, z: sz }, M.paint);
        }
        for (let k = 0; k < 3; k++) {
          const lf = new T.PlaneGeometry(9, 2.2); lf.translate(4.5, 0, 0);
          const p = lf.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setY(i, p.getY(i) * (1 - x / 10)); p.setZ(i, -0.04 * x * x); }
          lf.rotateX(-PI / 2 + 0.25); lf.computeVertexNormals();
          f(lf, 0x5f9a3a, { x: sx, y: 7 + h - k * 5, z: sz, ry: r() * TAU, rz: -0.35 }, leafMat);
        }
      }
      AO(bx, bz, 9, 9, 0.5, 0.3);
      K.box(bx, bz, 6.6, 6.6, 0.3, 40);
      stack(-104, -14, 8);
      stack(-108, 12, 5);
      // a big teapot (kyusu) with two cups
      const tp = frame(-36, 0, -4, 0.8);
      tp(lathe([[4.5, 0], [6.5, 0.5], [8.2, 3], [8.6, 5.5], [7.8, 8], [5.4, 9.4], [0.01, 9.6]], 36), 0x3a2a24, {}, M.ceramic);
      tp(cyl(4.2, 4.4, 1.2, 28), 0x3a2a24, { y: 9.8 }, M.ceramic);
      tp(sph(1.1, 12, 8), 0x3a2a24, { y: 10.9 }, M.ceramic);
      tp(cyl(0.9, 1.6, 7, 12).rotateZ(-1.0), 0x3a2a24, { x: 9.5, y: 6.5 }, M.ceramic);
      tp(cyl(1.4, 1.4, 10, 12).rotateZ(PI / 2), 0x3a2a24, { x: -11, y: 5.5, ry: 0 }, M.ceramic);
      AO(-36, -4, 9.5, 9.5, 0.5);
      K.circle(-36, -4, 8.6, 11);
      teacup(-50, 12, 0.8); teacup(-24, 14, 0.8);
      caddy(-62, -22, 0);
      // a folded menu card (A-frame)
      const mcv = canvas(256, 192, (g, w, h) => { g.fillStyle = '#f6ecd6'; g.fillRect(0, 0, w, h); g.fillStyle = '#d8342c'; g.fillRect(0, 0, w, 40); g.fillStyle = '#fff'; g.font = '26px "Lilita One", sans-serif'; g.textAlign = 'center'; g.fillText("TODAY'S FISH", w / 2, 30); g.fillStyle = '#3a2412'; g.font = '700 18px Rubik, sans-serif'; ['Salmon belly', 'Golden eye', 'Sweet prawn', 'Sea bream'].forEach((s, i) => g.fillText(s, w / 2, 76 + i * 30)); });
      const mm = K.std({ map: tex(mcv, [1, 1], false), roughness: 0.8, side: T.DoubleSide });
      for (const s of [-1, 1]) { const m = K.mesh(new T.PlaneGeometry(10, 7.5), mm, -14 , 3.6, 6 + s * 1.2, { cast: true }); m.rotation.order = 'YXZ'; m.rotation.y = s > 0 ? 0 : PI; m.rotation.x = -0.32 * s; }
      AO(-14, 6, 6, 3, 0.35);
      K.box(-14, 6, 5, 2, 0, 7.5);
      gari(42, -16); soyDish(54, -24); teacup(40, -2, 0.85);
      // a stack of clean plates on the inside of the island road's last bend (it also closes a cut across the stone)
      stack(34.5, 13, 9);
    }

    // ---- lanterns above the back wall and their warm glow
    {
      const lc = canvas(256, 256, (g, w, h) => {
        const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#7a0e08'); gr.addColorStop(0.5, '#e8301c'); gr.addColorStop(1, '#7a0e08');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
        for (let y = 0; y < h; y += 10) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, y, w, 2); }
        g.fillStyle = '#1a0c08'; g.fillRect(0, 0, w, 18); g.fillRect(0, h - 18, w, 18);
        g.fillStyle = 'rgba(255,240,220,0.9)'; g.beginPath(); g.arc(w / 2, h / 2, 38, 0, TAU); g.fill();
        g.fillStyle = '#e8301c'; g.beginPath(); g.arc(w / 2, h / 2, 22, 0, TAU); g.fill();
      });
      const lt = tex(lc, [1, 1], false);
      const lanternMat = K.std({ map: lt, emissive: 0xffb070, emissiveMap: lt, emissiveIntensity: 1.25, roughness: 0.8 });
      A.lanternMat = lanternMat;
      const lg = lathe([[0.01, -6.5], [3.2, -6.2], [5.6, -4.5], [6.6, -1.5], [6.6, 1.5], [5.6, 4.5], [3.2, 6.2], [0.01, 6.5]], 24);
      const cap = cyl(3.3, 3.3, 1.4, 16);
      A.lanterns = [];
      for (const [x, ph] of [[-150, 0.3], [-96, 1.7], [-44, 2.9], [36, 0.9], [96, 2.2]]) {
        const z = BOUNDS.minZ + 7, y = 25;
        const m = K.mesh(lg, lanternMat, x, y, z, { cast: false }); A.lanterns.push({ m, ph, y });
        K.mesh(cap, K.std({ color: 0x1a0c08, roughness: 0.6 }), x, y + 7, z, { cast: false });
        K.mesh(cap, K.std({ color: 0x1a0c08, roughness: 0.6 }), x, y - 7, z, { cast: false });
        K.mesh(cyl(0.15, 0.15, 30, 4), K.std({ color: 0x111111 }), x, y + 22, z, { cast: false });
        POOL(x, BOUNDS.minZ + 14, 34, 20, 0xff9040, 0.08);
        POOL(x, BOUNDS.minZ + 3, 14, 8, 0xffa050, 0.1);
      }
      const pl = new T.PointLight(0xff9a50, 520, 130, 1.5); pl.position.set(-96, 30, BOUNDS.minZ - 2); K.group.add(pl);
      const pl2 = new T.PointLight(0xff9a50, 420, 120, 1.5); pl2.position.set(60, 30, BOUNDS.minZ - 2); K.group.add(pl2);
      A.pls = [pl, pl2];
      // a soft warm wash over the middle of the counter (the ceiling lights)
      POOL(-20, 0, 150, 90, 0xffa060, 0.03);
    }

    // ---- fine scatter: rice grains round the chef's board and the tub, sesame by the seats
    {
      const grains = [];
      const spray = (cx, cz, sx, sz, n) => { for (let i = 0; i < n; i++) { const x = cx + r.gauss() * sx, z = cz + r.gauss() * sz; grains.push({ x, y: 0.25, z, ry: r() * TAU, rx: PI / 2 + r.range(-0.3, 0.3), s: r.range(0.85, 1.15) }); } };
      spray(-118, -92, 16, 9, 120); spray(-150, -66, 14, 12, 90); spray(-150, -98, 10, 6, 50); spray(-88, -84, 9, 9, 50); spray(20, 66, 40, 6, 60);
      const keep = grains.filter((g) => dRoad(g.x, g.z) > 0.5 && !onBelt(g.x, g.z, 1) && (!lowQ || hash(g.x, g.z) < 0.5));
      if (keep.length) K.instances(new T.CapsuleGeometry(0.17, 0.42, 2, 6), K.phys({ color: 0xfbfaf4, roughness: 0.5, sheen: 0.5 }), keep, { cast: false });
      const drips = [], crumbs = [];
      for (let i = 0; i < 70; i++) { const x = r.range(-170, 140), z = r.range(-108, 104); drips.push({ x, y: 0.1, z, ry: r() * TAU, s: r.range(0.5, 1.2), sy: 1 }); }
      for (let i = 0; i < 140; i++) { const x = r.range(-170, 140), z = r.range(-108, 104); crumbs.push({ x, y: 0.18, z, ry: r() * TAU, rx: r() * TAU, s: r.range(0.25, 0.6), color: r.pick([0xe2b46a, 0xc98a3a, 0x3a5a2a, 0x2a1a10, 0xf0e0b0]) }); }
      const dk = drips.filter((g) => dRoad(g.x, g.z) > 1 && !onBelt(g.x, g.z, 1) && (!lowQ || hash(g.x, g.z) < 0.5));
      if (dk.length) K.instances(new T.CircleGeometry(0.7, 12).rotateX(-PI / 2), K.phys({ color: 0x2a1206, roughness: 0.05, clearcoat: 1 }), dk, { cast: false });
      const ck = crumbs.filter((g) => dRoad(g.x, g.z) > 0.3 && !onBelt(g.x, g.z, 1) && (!lowQ || hash(g.z, g.x) < 0.5));
      if (ck.length) K.instances(new T.DodecahedronGeometry(0.8, 0), K.std({ roughness: 0.8 }), ck, { cast: false, colors: true });
      const ses = [];
      for (let i = 0; i < 160; i++) { const x = r.range(-150, 130), z = r.range(55, 106); ses.push({ x, y: 0.12, z, ry: r() * TAU, s: r.range(0.8, 1.2), color: r() < 0.7 ? 0xf0e2c0 : 0x2a2420 }); }
      const sk = ses.filter((g) => dRoad(g.x, g.z) > 0.5 && !onBelt(g.x, g.z, 1) && (!lowQ || hash(g.x, g.z) < 0.5));
      if (sk.length) K.instances(new T.SphereGeometry(0.22, 6, 4).scale(1, 0.4, 0.62), K.std({ roughness: 0.6 }), sk, { cast: false, colors: true });
    }

    flushBins();
    // contact shadows and light pools
    {
      const g = new T.PlaneGeometry(1, 1).rotateX(-PI / 2);
      const im = K.instances(g, contactMat, contacts, { cast: false, receive: false }); im.renderOrder = 1;
      const glowTex = tex(canvas(128, 128, (gg) => { const q = gg.createRadialGradient(64, 64, 0, 64, 64, 64); q.addColorStop(0, 'rgba(255,255,255,1)'); q.addColorStop(0.4, 'rgba(255,255,255,0.45)'); q.addColorStop(1, 'rgba(0,0,0,0)'); gg.fillStyle = q; gg.fillRect(0, 0, 128, 128); }), [1, 1], false);
      const pm = K.instances(g, new T.MeshBasicMaterial({ map: glowTex, transparent: true, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }), pools, { cast: false, receive: false, colors: true });
      pm.renderOrder = 2;
      // the halo round each crossing lamp
      A.halo = new T.MeshBasicMaterial({ map: glowTex, color: 0xff3018, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false });
      for (const [x, z] of A.lampPos) { const h = new T.Mesh(new T.PlaneGeometry(9, 9), A.halo); h.position.set(x, 7.7, z + 1.3); h.renderOrder = 3; K.group.add(h); }
      const hp = new T.Mesh(new T.PlaneGeometry(24, 18).rotateX(-PI / 2), A.halo); hp.position.set(EX.x, 0.25, -95); hp.renderOrder = 2; K.group.add(hp);
    }
    // initial poses (the first tick moves them to the race clock)
    this.tick(0, 0, null);
    this.animate(0, 0, null);
  },

  // fixed rate: plates move with the belt, the belt carries cars, CPU drivers read the plates and the express tray
  tick(dt, time, game) {
    if (!A || !A.plateCols.length) return;
    const P = A.pose;
    // ---- plates (colliders follow the belt; static colliders moved by hand so a car on the belt meets them
    // in the belt's own frame)
    for (let i = 0; i < PLATES.length; i++) {
      platePose(PLATES[i], time, P);
      const c = A.plateCols[i];
      c.x = P.x; c.z = P.z;
      c.bb[0] = P.x - c.r; c.bb[1] = P.z - c.r; c.bb[2] = P.x + c.r; c.bb[3] = P.z + c.r;
    }
    if (!game) return;
    const st = game.state, moving = st === 'race' || st === 'roundEnd' || st === 'attract';
    // ---- express chime as the tray is about to run
    const u = exU(time), pu = A.lastExU;
    A.lastExU = u;
    if (pu != null) {
      const crossed = (a) => (pu <= u ? pu < a && u >= a : pu < a || u >= a);
      if (crossed(0.02) || crossed(0.42) || crossed(EXT.goN - 1.3) || crossed(EXT.goN - 0.9)) game.sound.cue('bell', { x: EX.x, z: -100, game });
    }
    // ---- the belt carries everything on it: translation along the slats, turning with them round the bends;
    // crossing the edge keeps the ground speed continuous (the car's own velocity is relative to the slats)
    const G = BG, bn = A.bn;
    for (const e of game.cars) {
      const c = e.car;
      let cs = A.carry[c.index];
      if (!cs) cs = A.carry[c.index] = { f: 0, hint: -1, x: c.x, z: c.z };
      if (e.out || c.state !== 'drive' || c.airborne || !moving) { cs.f = 0; cs.x = c.x; cs.z = c.z; continue; }
      const jumped = Math.abs(c.x - cs.x) + Math.abs(c.z - cs.z) > 6;
      beltNear(c.x, c.z, jumped ? -1 : cs.hint, bn);
      cs.hint = bn.i;
      const lat = bn.lat, f = clamp((BHW + 0.6 - Math.abs(lat)) / 1.6, 0, 1);
      if (jumped) cs.f = f;
      if (f > 0 || cs.f > 0) {
        const i = bn.i, k = G.k[i];
        const sp = BV * (1 - k * lat);
        const bx = G.tx[i] * sp, bz = G.tz[i] * sp;
        const df = f - cs.f;
        c.vx -= df * bx; c.vz -= df * bz;
        c.x += f * bx * dt; c.z += f * bz * dt;
        const dth = f * k * BV * dt;
        if (dth !== 0) {
          const cc = Math.cos(dth), sn = Math.sin(dth), vx = c.vx * cc - c.vz * sn, vz = c.vx * sn + c.vz * cc;
          c.vx = vx; c.vz = vz; c.angle += dth;
        }
      }
      cs.f = f; cs.x = c.x; cs.z = c.z;
      // carried away along a part of the belt the road doesn't use: back onto the road after a moment
      if (st === 'race' && f > 0.5 && Math.abs(e.lateral) > RW / 2 + 5) cs.away = (cs.away || 0) + dt;
      else cs.away = Math.max(0, (cs.away || 0) - 2 * dt);
      if (cs.away > 1.0) {
        cs.away = 0;
        game.particles.emit(c.x, c.y + 1, c.z, { color: 0xffffff, n: 14, size: 2.2, life: 0.6, spread: 8, up: 4, grav: 0, grow: 2.5, alpha: 0.7 });
        game.respawn(e);
        cs.f = 0; cs.x = c.x; cs.z = c.z; cs.hint = -1;
      }
    }
    if (!moving && st !== 'countdown') return;
    // ---- CPU drivers
    const tr = game.track, Lr = tr.length;
    for (const e of game.cars) {
      const ai = e.ai || (e.finished ? e.cooldown : null); // (a finished human rolls on autopilot: same guards)
      const c = e.car;
      if (e.out || c.state !== 'drive' || c.airborne) continue;
      const cs = A.carry[c.index];
      // express crossing: hold back while the tray is due
      const dE = wrap(A.sEX - e.trackS, Lr);
      if (dE < 60) {
        const occ = exBlocked(time, dE, c);
        if (occ.wait) { e.holdT = 0.25; if (ai) guardStop(e, c, dE - EX.hd - 2.3 - 2.6); }
      }
      // X1: wait for a gap in the plates
      const dX = wrap(A.sX1 - e.trackS, Lr);
      if (dX < 60 && dX > BHW + 1) {
        const lane = A.uX1 + e.lateral * A.x1Map;
        const dEnter = dX - BHW - 2.4 - 2.6;
        const tEnter = timeTo(dEnter, Math.max(0, c.fwdSpeed));
        if ((!cs || cs.f < 0.05) && plateNear(lane, time + tEnter)) { e.holdT = 0.25; if (ai) guardStop(e, c, dEnter - 1.2); }
      }
      // the merge onto the AGAINST stretch: plates come round the corner head-on, wait for a gap
      let ln = A.amLanes[0];
      for (const q of A.amLanes) if (Math.abs(q.lat - e.lateral) < Math.abs(ln.lat - e.lateral)) ln = q;
      const dM = wrap(ln.s - e.trackS, Lr);
      if (dM < 50 && dM > 0.5) {
        const dEnter = dM - 2.6;
        const tEnter = timeTo(dEnter, Math.max(0, c.fwdSpeed));
        let busy = false; // one at a time: a car still merging just ahead
        for (const o of game.cars) {
          if (o === e || o.out || o.car.state !== 'drive') continue;
          const ahead = wrap(o.trackS - e.trackS, Lr), om = wrap(o.trackS - A.sAM + 20, Lr);
          if (ahead > 0 && ahead < 22 && om < 40) busy = true;
        }
        if ((!cs || cs.f < 0.05) && (busy || plateComing(ln.u, time + tEnter, 30, 9))) { e.holdT = 0.25; if (ai) guardStop(e, c, dEnter - 6); }
      }
      if (!ai) continue;
      // pinned nose-first against a plate (too slow to steer away while the slats carry both): turn off it
      if (cs && cs.f > 0.5 && Math.abs(c.fwdSpeed) < 6) {
        const hx = Math.cos(c.angle), hz = Math.sin(c.angle);
        for (let i = 0; i < PLATES.length; i++) {
          const col = A.plateCols[i], dx = col.x - c.x, dz = col.z - c.z, d = Math.hypot(dx, dz);
          if (d > PL.cr + c.spec.r + c.spec.axle + 0.6 || dx * hx + dz * hz < 0) continue;
          const side = -dx * hz + dz * hx; // plate to the right (+) or left (-) of the nose
          c.angle -= Math.sign(side || 1) * 1.6 * dt;
          c.x -= (dx / d) * 2.5 * dt; c.z -= (dz / d) * 2.5 * dt;
        }
      }
      // the exit off the WITH stretch (62 over the ground on the slats): brake for it, keep to the exit side and
      // don't overtake plates there (on the slats they stand still; the exit sweeps back along the belt to you)
      const dW = wrap(A.sWX - e.trackS + Lr / 2, Lr) - Lr / 2;
      if (cs && cs.f > 0.3 && dW > -8 && dW < 80) {
        const vmax = Math.sqrt(30 * 30 + 2 * 62 * Math.max(0, dW - 14));
        if (dW < 46) {
          const want = -3.6 - ai.lineOffset(e.trackS + 10);
          ai.avoid += (want - ai.avoid) * Math.min(1, dt * 9);
        }
        const sp = c.fwdSpeed;
        if (sp > vmax) { const kk = Math.max(vmax / Math.max(sp, 0.01), 1 - 3 * dt); c.vx *= kk; c.vz *= kk; }
        if (dW < 46) continue;
      }
      // plates ahead on (or merging onto) the belt: pass them on their open side
      const ri = tr.idx(e.trackS);
      if (!A.rideNear[ri] && !A.ride[ri]) continue;
      const dXs = wrap(A.sX1 - e.trackS + Lr / 2, Lr) - Lr / 2;
      if (dXs < 45 && dXs > -12) continue;
      const hx = Math.cos(c.angle), hz = Math.sin(c.angle);
      let best = null, bestD = 1e9;
      for (let i = 0; i < PLATES.length; i++) {
        const col = A.plateCols[i];
        const dx = col.x - c.x, dz = col.z - c.z;
        const ahead = dx * hx + dz * hz;
        if (ahead < -4 || ahead > 40 || Math.abs(-dx * hz + dz * hx) > 18) continue;
        const vc = Math.max(10, c.fwdSpeed);
        platePose(PLATES[i], time + Math.max(0, ahead - 5) / vc, P);
        nearTrack(tr, P.x, P.z, tr.idx(e.trackS + Math.max(0, ahead)), A.tn);
        const ds = wrap(A.tn.s - e.trackS + Lr / 2, Lr) - Lr / 2;
        if (ds < -5 || ds > 38) continue;
        if (ds < bestD) { bestD = ds; best = A.tn.lat; }
      }
      if (best !== null) {
        const half = RW / 2 - c.spec.r - 0.4, need = PL.cr + c.spec.r + 1.3;
        let target = best > 0 ? best - need : best + need;
        if (Math.abs(target) > half) target = best > 0 ? best + need : best - need;
        target = clamp(target, -half, half);
        const want = target - ai.lineOffset(e.trackS + 10);
        ai.avoid += (want - ai.avoid) * Math.min(1, dt * 9);
      }
    }
  },

  animate(time, dt, game) {
    if (!A || !A.plateIM) return;
    // slats slide along the belt
    A.slatTex.offset.y = -wrap(time * BV / A.slatPitch, 1);
    // plates and their sushi
    const P = A.pose, m4 = A.m4, mb = A.m4b;
    const poses = A.poses || (A.poses = PLATES.map(() => new THREE.Matrix4()));
    for (let i = 0; i < PLATES.length; i++) {
      platePose(PLATES[i], time, P);
      A.q.setFromAxisAngle(A.yAx, -P.a);
      A.vv.set(P.x, 0.17, P.z);
      poses[i].compose(A.vv, A.q, A.sc);
      A.vv.set(P.x, 0.22, P.z); mb.compose(A.vv, A.q, A.aoS);
      A.plateAO.setMatrixAt(i, mb);
    }
    A.plateAO.instanceMatrix.needsUpdate = true;
    for (const { im, list } of A.plateIM) {
      for (let k = 0; k < list.length; k++) { m4.multiplyMatrices(poses[list[k].p.i], list[k].M); im.setMatrixAt(k, m4); }
      im.instanceMatrix.needsUpdate = true;
    }
    // the express tray, its lamps and lane studs
    const z = exZ(time);
    A.tray.position.set(EX.x, 0.25, z);
    A.tray.rotation.y = -PI / 2;
    A.trayAO.position.set(EX.x, 0.07, z);
    A.trayAO.visible = z > BOUNDS.minZ - 2;
    const warn = exWarn(time), blink = warn && Math.floor(time * 5) % 2 === 0;
    A.lampMat.emissiveIntensity = blink ? 4 : warn ? 0.6 : 0;
    A.halo.opacity = blink ? 0.7 : 0;
    const u = exU(time), run = (u > EXT.goS - 0.2 && u < EXT.atS) || (u > EXT.goN - 0.2 && u < EXT.atK);
    const col = A.col || (A.col = new THREE.Color());
    for (let i = 0; i < A.leds.length; i++) {
      const l = A.leds[i];
      if (warn) {
        const ph = (((time * 3.2 - (u >= EXT.goN - 1.3 && u < EXT.atK ? -l.z : l.z) * 0.08) % 1) + 1) % 1;
        const on = ph < 0.4 ? 1 : 0.1;
        col.setRGB(1.8 * on + (run ? 0.3 : 0), 0.18 * on, 0.06 * on);
      } else col.setRGB(0.12, 0.03, 0.02);
      A.ledIM.setColorAt(i, col);
    }
    A.ledIM.instanceColor.needsUpdate = true;
    // lanterns sway a touch and flicker
    if (A.lanterns) for (const l of A.lanterns) { l.m.rotation.z = Math.sin(time * 0.7 + l.ph) * 0.04; l.m.position.y = l.y + Math.sin(time * 0.9 + l.ph) * 0.15; }
    if (A.lanternMat) A.lanternMat.emissiveIntensity = 1.2 + 0.08 * Math.sin(time * 7.3) * Math.sin(time * 2.1);
    if (A.noren) A.noren.rotation.x = Math.sin(time * 1.3) * 0.03 + (Math.abs(z - (BOUNDS.minZ - 6)) < 10 ? 0.3 : 0);
  },
};

// ---------------------------------------------------------------- tick helpers
const tr0 = (tr, s) => Math.floor(s / tr.ds);
// time to cover distance x from speed v (accelerating at a little under full throttle when slow)
function timeTo(x, v) {
  if (x <= 0) return 0;
  if (v > 18) return x / v;
  const a = 52;
  return (-v + Math.sqrt(v * v + 2 * a * x)) / a;
}
const NEAR_T = [-0.3, 0, 0.18], EX_K = [0, EX.P];
// is a plate's rim within reach of the car's lane (belt arc length) at time t (a little before and after)?
function plateNear(lane, t, extra = 0) {
  const L = BG.L, reach = PL.cr + 1.05 + 1.6 + extra;
  for (const p of PLATES) {
    for (const dt of NEAR_T) {
      const d = wrap(p.u0 + BV * (t + dt) - lane + L / 2, L) - L / 2;
      if (Math.abs(d) < reach) return true;
    }
  }
  return false;
}
// a plate up to `up` upstream (still coming) or `down` downstream (just past) of belt arc length `lane` at time t?
function plateComing(lane, t, up, down) {
  const L = BG.L;
  for (const p of PLATES) {
    const d = wrap(p.u0 + BV * t - lane + L / 2, L) - L / 2;
    if (d > -up && d < down) return true;
  }
  return false;
}
// the express tray: should a car dE from the crossing wait? (its passage overlaps the tray's next run)
const _exo = { wait: false };
function exBlocked(time, dE, c) {
  _exo.wait = false;
  const sp = Math.max(0, c.fwdSpeed);
  const near = dE - EX.hd - 2.3 - 1.2, far = dE + EX.hd + 2.3 + 1.2;
  if (near < -0.5) return _exo; // already on it: go
  const t0 = timeTo(near, sp) - 0.25, t1 = timeTo(far, sp) + 0.3;
  const u = exU(time);
  for (const [a, b] of A.exOcc) {
    for (const k of EX_K) {
      const ta = a + k - u, tb = b + k - u;
      if (tb > 0 && ta < t1 && tb > t0) _exo.wait = true;
    }
  }
  return _exo;
}
// brake a CPU car so it stops `stopD` before the hazard (railway style)
function guardStop(e, c, stopD) {
  if (stopD < -0.8) return;
  const sp = Math.max(0, c.fwdSpeed);
  const vmax = Math.sqrt(2 * 70 * Math.max(0, stopD));
  if (sp > vmax) { const k = vmax / Math.max(sp, 0.01); c.vx *= k; c.vz *= k; }
  const ai = e.ai || e.cooldown; if (ai) ai.stuckT = 0;
}
// nearest sample of a track to (x, z) around hint (no allocation): fills o.s, o.lat
function nearTrack(tr, x, z, hint, o) {
  const N = tr.N;
  let best = hint, bd = Infinity;
  for (let k = -70; k <= 70; k += 2) {
    const i = (hint + k + N) % N, dx = tr.x[i] - x, dz = tr.z[i] - z, d = dx * dx + dz * dz;
    if (d < bd) { bd = d; best = i; }
  }
  for (let k = -2; k <= 2; k++) { const i = (best + k + N) % N, dx = tr.x[i] - x, dz = tr.z[i] - z, d = dx * dx + dz * dz; if (d < bd) { bd = d; best = i; } }
  o.s = best * tr.ds;
  o.lat = (x - tr.x[best]) * -tr.tz[best] + (z - tr.z[best]) * tr.tx[best];
  return o;
}

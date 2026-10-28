// World: Opening Night (Mayhem Cup, table 3 of 4, expert). A set designer's scale model of a theatre stage (about
// 1:25), lovingly built on the drawing desk among pencils, scale rules and fabric swatches, and lit for the first
// night. The course is taped out in grey dance floor over the painted boards: along the apron past the footlights
// (the orchestra pit below is a real drop), up the east wing where painted flats fly in across the passage, along
// the front of the gilded proscenium over a trap room whose traps drop open in turn, round the west wing under a
// swinging sandbag, and twice across the revolve, which turns slowly with its cottage, staircase and street lamps
// (the walls sweep through the road, the gaps open and close, and the floor carries you round). Stage blood and
// spilt glitter lie off the line. Raced on rally cars with headlights; the leader drives in the follow spot.

const PI = Math.PI, TAU = PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const mod = (a, n) => ((a % n) + n) % n;

// ---- the circuit (driving order): start on the apron heading east
const TRACK = [
  [-100, 58], [-48, 58], [0, 65], [48, 58], [95, 58], [122, 55], [139, 40], [142, -12], [136, -62], [112, -74],
  [40, -74], [-30, -74], [-88, -74], [-116, -68], [-132, -48], [-124, -27], [-100, -20], [-50, -20], [20, -20], [60, -20],
  [72.7, -14.7], [78, -2], [72.7, 10.7], [60, 16], [10, 16], [-50, 16], [-100, 16], [-114.8, 22.2], [-121, 37], [-114.8, 51.8],
];
const W = 15;
const START_S = 40;

// ---- the model: stage floor at y = 0 on a baseboard on the desk
const ST = { x0: -156, x1: 164, z0: -102, z1: 94 };
const FRONT = 70; // downstage edge; the orchestra pit lies south of it
const PIT = { x0: -118, x1: 118, z1: 92 };
const APR = { rx: 38, rz: 11 }; // apron extension over the pit (half ellipse)
const BASE = -14; // pit floor = top of the model's baseboard
const DESK = -16; // desk top
const ROOM = -96; // studio floor far below
const ARCH = { z: -88, xi: 80, xo: 101, h: 62, open: 42 };
const APRON_PTS = (() => { const o = []; for (let i = 0; i <= 18; i++) { const a = (PI * i) / 18; o.push([APR.rx * Math.cos(a), FRONT + APR.rz * Math.sin(a)]); } return o; })();
const BOUNDS = {
  minX: ST.x0, maxX: ST.x1, minZ: ST.z0, maxZ: ST.z1,
  poly: [[ST.x0, ST.z0], [ST.x1, ST.z0], [ST.x1, ST.z1], [PIT.x1, ST.z1], [PIT.x1, FRONT], ...APRON_PTS, [PIT.x0, FRONT], [PIT.x0, ST.z1], [ST.x0, ST.z1]],
};

// ---- the revolve: a flush turntable crossed twice (north chord heading east, south chord heading west). It turns
// clockwise as seen from above, so on both chords it carries you along a little and turns your nose to the right.
const REV = { x: -20, z: -2, R: 36, P: 30, th0: 0.4 };
const revAngle = (t) => REV.th0 + (TAU * t) / REV.P;
const FOUNTAIN_R = 7;
// the set on it, in disc coordinates (+x: the cottage front with its door, -x: the staircase; lamps at +-z).
// Boxes stay axis-aligned in disc coordinates (the AI's look-ahead relies on it).
const SET = [
  { k: 'box', x: 17.75, z: 0, hw: 2.75, hd: 0.7, h: 14 },
  { k: 'box', x: 29.25, z: 0, hw: 2.25, hd: 0.7, h: 14 },
  { k: 'box', x: -20.5, z: 0, hw: 5.5, hd: 2.5, h: 10 },
  { k: 'circ', x: 0, z: 29, r: 0.9, h: 10 },
  { k: 'circ', x: 0, z: -29, r: 0.9, h: 10 },
];

// ---- the trap room: two rows of three traps across the road in front of the proscenium. In each row the traps
// open in turn (row B the other way round and later), one or two at a time; the cracks glow and creak before one
// drops. The schedule always leaves a way through at 30-46 units/s, straight or with one lane change between the
// rows (checked offline); about half the time you need that lane change.
const TRAP = { P: 4.8, slot: 1.6, open: 2.4, warn: 0.95, off: 2.8, lanes: [-5.3, 0, 5.3], hd: [2.7, 2.5, 2.7], hw: 3.5, depth: 11 };
const trapU = (T, t) => mod(t - T.t0, TRAP.P);
const trapOpenU = (u) => u > 0.05 && u < TRAP.open - 0.14;
const trapFrac = (u) => (u < TRAP.open ? Math.min(1, u / 0.16) * Math.min(1, (TRAP.open - u) / 0.32) : 0);
const trapWarn = (u) => (u > TRAP.P - TRAP.warn ? (u - (TRAP.P - TRAP.warn)) / TRAP.warn : 0);

// ---- flying flats: two painted flats over the east wing passage fly in alternately (west half, then east half)
const FLY = { P: 5.2, dn: 0.9, hold: 1.45, up: 0.75, top: 24, solid: 2.2, lat: [-4.2, 4.2], hw: 5.1, hgt: 13 };
function flatBottom(k, t) {
  const u = mod(t - k * FLY.P * 0.5, FLY.P);
  if (u < FLY.dn) { const q = 1 - u / FLY.dn; return 0.08 + (FLY.top - 0.08) * q * q; }
  if (u < FLY.dn + FLY.hold) return 0.08;
  if (u < FLY.dn + FLY.hold + FLY.up) { const q = (u - FLY.dn - FLY.hold) / FLY.up; return 0.08 + (FLY.top - 0.08) * q * q; }
  return FLY.top;
}

// ---- the sandbag swinging across the west wing passage on a long line from the fly gallery
const BAG = { P: 3.4, amp: 10, piv: 52, len: 50, ph: 0.5 };
const BAG_A = Math.asin(BAG.amp / BAG.len);
const bagAngle = (t) => BAG_A * Math.sin((TAU * t) / BAG.P + BAG.ph);

// lateral candidates for the CPU drivers' look-ahead through the moving scenery
const LATS_WIDE = [-8.5, -6.8, -5.1, -3.4, -1.7, 0, 1.7, 3.4, 5.1, 6.8, 8.5];
const LATS_ROAD = [-6, -4.5, -3, -1.5, 0, 1.5, 3, 4.5, 6];

let A = null; // runtime state shared by build / tick / animate

// ---- hazard tests at a future time t (no allocation): true if a car circle of radius rad at (x, z) would hit
function hitRevolve(x, z, t, rad) {
  const dx = x - REV.x, dz = z - REV.z;
  if (dx * dx + dz * dz > (REV.R + 3) * (REV.R + 3)) return false;
  const th = revAngle(t), c = Math.cos(th), s = Math.sin(th);
  const lx = dx * c + dz * s, lz = -dx * s + dz * c;
  if (lx * lx + lz * lz < (FOUNTAIN_R + rad) * (FOUNTAIN_R + rad)) return true;
  for (let i = 0; i < SET.length; i++) {
    const p = SET[i];
    if (p.k === 'box') {
      const qx = clamp(lx - p.x, -p.hw, p.hw), qz = clamp(lz - p.z, -p.hd, p.hd);
      const ex = lx - p.x - qx, ez = lz - p.z - qz;
      if (ex * ex + ez * ez < rad * rad) return true;
    } else if ((lx - p.x) * (lx - p.x) + (lz - p.z) * (lz - p.z) < (p.r + rad) * (p.r + rad)) return true;
  }
  return false;
}
function hitTraps(x, z, t) {
  for (let i = 0; i < A.traps.length; i++) {
    const T = A.traps[i];
    const dx = x - T.x, dz = z - T.z;
    const a = dx * T.c + dz * T.s, b = -dx * T.s + dz * T.c;
    if (Math.abs(a) > T.hw + 0.3 || Math.abs(b) > T.hd + 0.1) continue;
    // open now or within the margin around the moment the car is there
    for (let k = -1; k <= 1; k++) if (trapOpenU(trapU(T, t + k * 0.13))) return true;
  }
  return false;
}
// the lane a CPU heads for q units ahead of track position s: a number, or a lane pair through the trap room
// (the first lane over row A, the second from the end of row A on)
function planLane(Z, P, s, q, L) {
  if (typeof P === 'number') return P;
  const qa = mod(Z.rowA - s + L / 2, L) - L / 2;
  return q < qa + TRAP.hw + 1 ? P[0] : P[1];
}
function hitFlats(x, z, t, rad) {
  for (let i = 0; i < A.flats.length; i++) {
    const F = A.flats[i];
    if (Math.min(flatBottom(F.k, t - 0.15), flatBottom(F.k, t + 0.15)) > FLY.solid + 0.4) continue;
    const dx = x - F.x, dz = z - F.z;
    const a = dx * F.cs + dz * F.sn, b = -dx * F.sn + dz * F.cs;
    if (Math.abs(a) < FLY.hw + rad && Math.abs(b) < 0.45 + rad) return true;
  }
  return false;
}
function hitBag(x, z, t, rad) {
  const bx = A.bag.x + BAG.len * Math.sin(bagAngle(t));
  const dx = Math.max(0, Math.abs(x - bx) - 0.6), dz = z - A.bag.z;
  return dx * dx + dz * dz < (1.5 + rad) * (1.5 + rad);
}

export default {
  id: 'stage',
  name: 'Opening Night',
  blurb: 'First night on a model stage: a turning revolve, trapdoors and flying scenery.',
  vehicle: 'rally',
  seed: 71,
  headlights: { intensity: 56, distance: 50, angle: 0.62, color: 0xfff0d8 },
  track: { points: TRACK, width: W, startS: START_S },
  bounds: BOUNDS,
  fallOffEdges: true,
  floorY: BASE + 0.5,
  offCourse: 16,
  offroad: { kind: 'rough', margin: 1.5 },
  skidColor: 0x0e0c0c,
  dust: {
    normal: null,
    rough: { color: 0xb09a7c, size: 0.7, life: 0.45, up: 1.6, grav: 5, alpha: 0.28, grow: 2.2, rate: 0.6 },
    slick: { color: 0xff3a6a, size: 0.55, life: 0.45, up: 3, grav: 24, alpha: 0.95, grow: 1, rate: 1.8 },
  },
  lighting: {
    sunDir: [0.3, 1, 0.78], sunColor: 0xffe2c0, sunIntensity: 1.15,
    hemiSky: 0x56608e, hemiGround: 0x1c120a, hemiIntensity: 0.3,
    envIntensity: 0.22, exposure: 1.12, background: 0x080607, shadowRadius: 2.6,
    fog: { color: 0x090708, near: 320, far: 820 },
  },

  async build(K) {
    const { THREE: T, TX, r, track } = K;
    const BU = K.BufferGeometryUtils;
    const L = track.length;
    const lowQ = !!(K.quality && K.quality.tilt === false);
    const V2 = (a, b = a) => new T.Vector2(a, b);
    const sAt = (x, z) => track.distTo(x, z).s;
    const dRoad = (x, z) => { const n = track.distTo(x, z); return n.dist - track.w[n.i] / 2; };
    const inRev = (x, z, m = 0) => (x - REV.x) ** 2 + (z - REV.z) ** 2 < (REV.R + m) ** 2;
    A = {
      L, traps: [], flats: [], zones: [], waves: [],
      m1: new T.Matrix4(), m2: new T.Matrix4(), m3: new T.Matrix4(), q: new T.Quaternion(), v: new T.Vector3(), sc: new T.Vector3(), e: new T.Euler(), col: new T.Color(),
      zero: new T.Matrix4().makeScale(0, 0, 0), lastBag: 0, spot: { x: 0, z: 0, init: false },
    };

    // ============================================================ baking helpers: many parts -> few meshes
    const _q = new T.Quaternion(), _e = new T.Euler(), _v = new T.Vector3(), _s = new T.Vector3(), _c = new T.Color();
    const mtx = (o) => new T.Matrix4().compose(_v.set(o.x || 0, o.y || 0, o.z || 0), _q.setFromEuler(_e.set(o.rx || 0, o.ry || 0, o.rz || 0, o.order || 'YXZ')), _s.set(o.sx ?? o.s ?? 1, o.sy ?? o.s ?? 1, o.sz ?? o.s ?? 1));
    const rgb = (c) => (Array.isArray(c) ? c : (_c.set(c), [_c.r, _c.g, _c.b]));
    const prep = (geo, c, M4) => {
      const g = geo.index ? geo.toNonIndexed() : geo.clone();
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
      g.morphAttributes = {};
      if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.attributes.normal) g.computeVertexNormals();
      if (M4) g.applyMatrix4(M4);
      if (c !== null) {
        const [cr, cg, cb] = rgb(c), n = g.attributes.position.count, a = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { a[i * 3] = cr; a[i * 3 + 1] = cg; a[i * 3 + 2] = cb; }
        g.setAttribute('color', new T.BufferAttribute(a, 3));
      }
      g.clearGroups();
      return g;
    };
    const CELL = 170;
    const bins = new Map();
    const binPush = (mat, cast, x, z, g, map = bins, cellKey = null) => {
      if (mat.isMeshBasicMaterial) cast = false;
      const key = mat.uuid + (cast ? 'c' : 'n') + (cellKey ?? (Math.floor((x + 400) / CELL) + ':' + Math.floor((z + 400) / CELL)));
      if (!map.has(key)) map.set(key, { mat, cast, parts: [] });
      map.get(key).parts.push(g);
    };
    const put = (geo, c, o = {}, mat = M.paint, cast = true) => binPush(mat, cast, o.x ?? 0, o.z ?? 0, prep(geo, c, mtx(o)));
    // a local frame for a whole prop: f(geo, c, o, mat, cast); f.pt(lx, lz) -> world [x, z]; f.box/f.circ colliders
    const frame = (cx, cy, cz, ry = 0) => {
      const F = mtx({ x: cx, y: cy, z: cz, ry });
      const cs = Math.cos(ry), sn = Math.sin(ry);
      const f = (geo, c, o = {}, mat = M.paint, cast = true) => binPush(mat, cast, cx, cz, prep(geo, c, F.clone().multiply(mtx(o))));
      f.pt = (lx, lz) => [cx + lx * cs + lz * sn, cz - lx * sn + lz * cs];
      f.box = (lx, lz, hw, hd, h) => { const [x, z] = f.pt(lx, lz); return K.box(x, z, hw, hd, -ry, h); };
      f.circ = (lx, lz, rad, h) => { const [x, z] = f.pt(lx, lz); return K.circle(x, z, rad, h); };
      return f;
    };
    const flushBins = (map, parent = K.group) => {
      for (const { mat, cast, parts } of map.values()) {
        const g = BU.mergeGeometries(parts, false); g.computeBoundingSphere();
        const m = new T.Mesh(g, mat); m.castShadow = cast; m.receiveShadow = !mat.isMeshBasicMaterial; parent.add(m);
      }
      map.clear();
    };
    const box = (w, h, d) => new T.BoxGeometry(w, h, d);
    const rbox = (w, h, d, rad = 0.2, seg = 2) => new K.RoundedBoxGeometry(w, h, d, seg, Math.min(rad, w / 2.01, h / 2.01, d / 2.01));
    const cyl = (r1, r2, h, seg = 12, open = false) => new T.CylinderGeometry(r1, r2, h, seg, 1, open);
    const sph = (rad, ws = 12, hs = 8) => new T.SphereGeometry(rad, ws, hs);
    const flat = (w, d) => new T.PlaneGeometry(w, d).rotateX(-PI / 2);
    const UP = new T.Vector3(0, 1, 0);
    const rod = (a, b, rad, seg = 6) => {
      const va = new T.Vector3(...a), vb = new T.Vector3(...b), d = vb.clone().sub(va), len = d.length();
      const g = cyl(rad, rad, len, seg, true);
      g.applyQuaternion(new T.Quaternion().setFromUnitVectors(UP, d.normalize()));
      g.translate((va.x + vb.x) / 2, (va.y + vb.y) / 2, (va.z + vb.z) / 2);
      return g;
    };
    const canvas = (w, h, draw) => { const c = TX.makeCanvas(w, h); draw(c.getContext('2d'), w, h); return c; };
    const tex = (c, rep = [1, 1], wrap = true, srgb = true) => TX.toTexture(c, { repeat: rep, wrap, srgb });
    const meshOf = (g, mat, { cast = false, receive = true, order = 0, parent = K.group } = {}) => { const m = new T.Mesh(g, mat); m.castShadow = cast; m.receiveShadow = receive; m.renderOrder = order; parent.add(m); return m; };
    // a flat strip along the track between s0 and s1 at lateral offset `off`
    const strip = (s0, s1, off, wid, y = 0.03, step = 1, vScale = 10) => {
      const n = Math.max(2, Math.ceil((s1 - s0) / step));
      const pos = [], uv = [], idx = [];
      for (let i = 0; i <= n; i++) {
        const s = s0 + ((s1 - s0) * i) / n, p = track.at(s);
        for (let k = 0; k < 2; k++) { const o = off + (k - 0.5) * wid; pos.push(p.x + p.nx * o, y, p.z + p.nz * o); uv.push(k, s / vScale); }
        if (i < n) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals();
      const nr = g.attributes.normal; for (let i = 0; i < nr.count; i++) nr.setXYZ(i, 0, 1, 0);
      return g;
    };
    // contact shadows (opacity carried in the instance's y scale) and additive light pools
    const contactMat = new T.MeshBasicMaterial({ color: 0x020102, transparent: true, alphaMap: TX.blobShadowTexture(), depthWrite: false });
    contactMat.onBeforeCompile = (sh) => {
      sh.vertexShader = 'varying float vOp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\nvOp = length(instanceMatrix[1].xyz);\n#endif');
      sh.fragmentShader = 'varying float vOp;\n' + sh.fragmentShader.replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\ndiffuseColor.a *= vOp;');
    };
    contactMat.customProgramCacheKey = () => 'stage-contact';
    const contacts = [];
    const AO = (x, z, rx, rz = rx, op = 0.4, ang = 0, y = 0.06) => contacts.push({ x, y, z, ry: -ang, sx: rx * 2, sy: op, sz: rz * 2 });
    const pools = [];
    const POOL = (x, z, rx, rz, color, op = 1, ang = 0, y = 0.08) => pools.push({ x, y, z, ry: -ang, sx: rx * 2, sy: 1, sz: rz * 2, color: new T.Color(color).multiplyScalar(op) });
    const bulbs = [];
    const BULB = (x, y, z, color, s = 0.25, halo = 1) => bulbs.push({ x, y, z, c: color, s, halo });
    const glowTex = tex(canvas(128, 128, (g) => { const q = g.createRadialGradient(64, 64, 0, 64, 64, 64); q.addColorStop(0, 'rgba(255,255,255,1)'); q.addColorStop(0.35, 'rgba(255,255,255,0.45)'); q.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = q; g.fillRect(0, 0, 128, 128); }), [1, 1], false);
    const poolTex = tex(canvas(128, 128, (g) => { const q = g.createRadialGradient(64, 64, 0, 64, 64, 64); q.addColorStop(0, 'rgba(255,255,255,1)'); q.addColorStop(0.62, 'rgba(255,255,255,0.8)'); q.addColorStop(0.86, 'rgba(255,255,255,0.22)'); q.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = q; g.fillRect(0, 0, 128, 128); }), [1, 1], false);
    const addMat = (map, extra = {}) => new T.MeshBasicMaterial({ map, transparent: true, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false, ...extra });

    // ============================================================ materials
    const M = {
      paint: K.phys({ vertexColors: true, roughness: 0.55, clearcoat: 0.18, clearcoatRoughness: 0.5 }),
      matte: K.std({ vertexColors: true, roughness: 0.9 }),
      gold: K.std({ vertexColors: true, metalness: 1, roughness: 0.3 }),
      metal: K.std({ vertexColors: true, metalness: 0.78, roughness: 0.36 }),
      velvet: K.phys({ vertexColors: true, roughness: 0.82, sheen: 1, sheenRoughness: 0.35, sheenColor: new T.Color(0xff5a6a) }),
      glow: new T.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
      glass: K.phys({ vertexColors: true, roughness: 0.06, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04, transparent: true, opacity: 0.55 }),
      gloss: K.phys({ vertexColors: true, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 }),
    };
    const ptex = TX.woodTextures({ size: 256, seed: 12, planks: 2, base: 0xb08a5e, dark: 0x7a5a3a, light: 0xd0aa7a, ringFreq: 24, gap: 0, roughBase: 0.6 });
    M.wood = K.std({ vertexColors: true, map: ptex.map, roughness: 0.66 });

    // ============================================================ the studio: floor far below, the desk, the baseboard
    {
      K.mesh(new T.PlaneGeometry(2600, 2600), K.std({ color: 0x1a120c, roughness: 0.8 }), 0, ROOM, 0, { rx: -PI / 2, cast: false });
      const dk = TX.woodTextures({ size: 512, seed: 33, planks: 3, base: 0xc9a77a, dark: 0x9a7650, light: 0xe2c49a, ringFreq: 18, gap: 0.003, roughBase: 0.5 });
      for (const t of Object.values(dk)) t.repeat.set(3, 2);
      const deskMat = K.std({ map: dk.map, normalMap: dk.normalMap, roughnessMap: dk.roughnessMap, normalScale: V2(0.4) });
      K.mesh(box(620, 5, 420), deskMat, 0, DESK - 2.5, 0, { cast: false });
      const legs = [box(600, 10, 400).translate(0, DESK - 10, 0)];
      for (const [x, z] of [[-298, -198], [298, -198], [-298, 198], [298, 198]]) legs.push(box(12, DESK - ROOM, 12).translate(x, (ROOM + DESK) / 2, z));
      K.mesh(BU.mergeGeometries(legs, false), K.std({ color: 0x3a2a1c, roughness: 0.7 }), 0, 0, 0, { cast: false });
      // on the desk beside the model: a green cutting mat with a steel rule and a craft knife (east), a mug of tea,
      // the costume sketchbook and a sheet of cut-out figures (west)
      const mc = canvas(512, 512, (g) => {
        g.fillStyle = '#245e4a'; g.fillRect(0, 0, 512, 512);
        g.strokeStyle = 'rgba(220,240,230,0.32)'; g.lineWidth = 1;
        for (let i = 0; i <= 512; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke(); }
        g.strokeStyle = 'rgba(240,250,245,0.55)'; g.lineWidth = 2;
        for (let i = 0; i <= 512; i += 80) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke(); }
        g.beginPath(); g.moveTo(0, 0); g.lineTo(512, 512); g.stroke();
        g.fillStyle = 'rgba(240,250,245,0.6)'; g.font = '12px Rubik, sans-serif'; for (let i = 1; i < 32; i++) g.fillText(String(i), i * 16 - 6, 12);
      });
      K.mesh(new T.PlaneGeometry(90, 170), K.std({ map: TX.toTexture(mc, { wrap: false }), roughness: 0.8 }), 214, DESK + 0.06, 0, { rx: -PI / 2, cast: false });
      put(box(3.2, 0.25, 64), 0xc8ccd4, { x: 180, y: DESK + 0.2, z: 6, ry: 0.04 }, M.metal);
      for (let k = 0; k < 13; k++) put(box(1.1, 0.04, 0.12), 0x1a1a1a, { x: 179, y: DESK + 0.34, z: -24 + k * 5, ry: 0.04 }, M.matte, false);
      put(cyl(0.7, 0.7, 14, 10).rotateX(PI / 2), 0xd8302a, { x: 192, y: DESK + 0.7, z: -40, ry: 0.5 }, M.paint);
      put(box(1.0, 0.14, 3.2), 0xd8dce4, { x: 195.5, y: DESK + 0.7, z: -46.2, ry: 0.5 }, M.metal);
      for (let k = 0; k < 5; k++) put(box(9, 0.3, 6), [0xf4f0e4, 0xe8d8c0, 0xf0e8f0, 0xe8e4d8, 0xf6f2ea][k], { x: 190 + k * 1.5, y: DESK + 0.2 + k * 0.3, z: 50 + k * 0.8, ry: 0.2 + k * 0.18 }, M.matte);
      put(K.lathe([[0.01, 0], [4.2, 0], [4.6, 0.6], [4.8, 9.6], [4.4, 9.8], [4.3, 1.0], [0.01, 0.9]], 32), 0xe8e0d0, { x: -176, y: DESK, z: -40 }, M.paint);
      put(new T.TorusGeometry(2.2, 0.55, 8, 16), 0xe8e0d0, { x: -171, y: DESK + 5.4, z: -40, rx: 0 }, M.paint);
      put(cyl(4.25, 4.25, 0.1, 28), 0x7a4a24, { x: -176, y: DESK + 8.4, z: -40 }, M.gloss, false);
      {
        const sk = canvas(512, 256, (g) => {
          g.fillStyle = '#f6f0e0'; g.fillRect(0, 0, 512, 256); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(254, 0, 4, 256);
          g.strokeStyle = '#3a3030'; g.lineWidth = 2;
          for (const [x, c] of [[70, '#c03040'], [180, '#3a60b0'], [330, '#d0a030'], [440, '#2a8050']]) {
            g.beginPath(); g.arc(x, 50, 14, 0, TAU); g.stroke();
            g.fillStyle = c; g.globalAlpha = 0.55; g.beginPath(); g.moveTo(x - 10, 70); g.lineTo(x + 10, 70); g.lineTo(x + 30, 200); g.lineTo(x - 30, 200); g.fill(); g.globalAlpha = 1;
            g.beginPath(); g.moveTo(x - 10, 70); g.lineTo(x - 30, 200); g.moveTo(x + 10, 70); g.lineTo(x + 30, 200); g.stroke();
          }
          g.fillStyle = '#3a3030'; g.font = 'italic 18px Georgia, serif'; g.fillText('Act I - the inn', 20, 236); g.fillText('Act II - the court', 280, 236);
        });
        const m = meshOf(new T.PlaneGeometry(40, 20).rotateX(-PI / 2), K.std({ map: TX.toTexture(sk, { wrap: false }), roughness: 0.9 }));
        m.position.set(-190, DESK + 0.3, 24); m.rotation.y = 0.15;
        put(box(41, 0.5, 21), 0x2a2a3a, { x: -190, y: DESK + 0.05, z: 24, ry: 0.15 }, M.matte, false);
      }
      for (let k = 0; k < 3; k++) put(cyl(0.45, 0.45, 17, 6).rotateZ(PI / 2), [0x2a4ab0, 0xf2c020, 0x1a1a1a][k], { x: -184 + k * 1.2, y: DESK + 0.45, z: 52 + k * 1.6, ry: 0.3 + k * 0.4 }, M.paint);
      // the model's baseboard (black MDF)
      put(box(ST.x1 - ST.x0 + 8, BASE - DESK, ST.z1 - ST.z0 + 30), 0x161416, { x: (ST.x0 + ST.x1) / 2, y: (BASE + DESK) / 2, z: (ST.z0 + ST.z1) / 2 + 11 }, M.matte, false);
    }

    // ============================================================ the stage floor (painted boards) and the model box
    const boards = TX.woodTextures({ size: 1024, seed: 71, planks: 16, base: 0x5a3c27, dark: 0x352215, light: 0x7a5636, ringFreq: 30, gap: 0.009, gapColor: 0x120a06, varyPlanks: 0.2, roughBase: 0.62 });
    const floorMat = K.std({ map: boards.map, normalMap: boards.normalMap, roughnessMap: boards.roughnessMap, normalScale: V2(0.55) });
    {
      const sh = new T.Shape();
      BOUNDS.poly.forEach(([x, z], i) => (i ? sh.lineTo(x, -z) : sh.moveTo(x, -z)));
      const hole = new T.Path(); hole.absarc(REV.x, -REV.z, REV.R + 0.45, 0, TAU, true); sh.holes.push(hole);
      const g = new T.ShapeGeometry(sh, 64); g.rotateX(-PI / 2);
      const uv = g.attributes.uv, pos = g.attributes.position;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 24, pos.getZ(i) / 24);
      const m = meshOf(g, floorMat); m.receiveShadow = true;
      // the revolve's gap: a dark ring below the floor line
      meshOf(new T.RingGeometry(REV.R - 0.5, REV.R + 0.6, 128).rotateX(-PI / 2).translate(REV.x, -0.7, REV.z), new T.MeshBasicMaterial({ color: 0x050304 }), { receive: false });
    }
    // the model box: black edges, the pit (a real drop), the apron's curved front, the stalls' first rows
    {
      const ink = 0x141214;
      const midX = (ST.x0 + ST.x1) / 2, midZ = (ST.z0 + ST.z1) / 2;
      put(box(ST.x1 - ST.x0, -BASE, 1), ink, { x: midX, y: BASE / 2, z: ST.z0 - 0.5 }, M.matte, false);
      put(box(1, -BASE, ST.z1 - ST.z0), ink, { x: ST.x0 - 0.5, y: BASE / 2, z: midZ }, M.matte, false);
      put(box(1, -BASE, ST.z1 - ST.z0), ink, { x: ST.x1 + 0.5, y: BASE / 2, z: midZ }, M.matte, false);
      for (const [x0, x1] of [[ST.x0, PIT.x0], [PIT.x1, ST.x1]]) put(box(x1 - x0, -BASE, 1), ink, { x: (x0 + x1) / 2, y: BASE / 2, z: ST.z1 + 0.5 }, M.matte, false);
      // pit side walls and the stage front (fascia), with a painted gold line along the top
      for (const x of [PIT.x0, PIT.x1]) put(box(0.8, -BASE, ST.z1 - FRONT), 0x1c1a1c, { x: x + (x < 0 ? -0.4 : 0.4), y: BASE / 2, z: (FRONT + ST.z1) / 2 }, M.matte, false);
      for (const [x0, x1] of [[PIT.x0, -APR.rx], [APR.rx, PIT.x1]]) {
        put(box(x1 - x0, -BASE, 0.8), 0x1e1a1c, { x: (x0 + x1) / 2, y: BASE / 2, z: FRONT + 0.4 }, M.matte, false);
        put(box(x1 - x0, 0.35, 0.2), 0xc8a050, { x: (x0 + x1) / 2, y: -0.6, z: FRONT + 0.85 }, M.gold, false);
      }
      // the apron's curved front wall
      {
        const pos = [];
        for (let i = 0; i < APRON_PTS.length - 1; i++) {
          const [ax, az] = APRON_PTS[i], [bx, bz] = APRON_PTS[i + 1];
          pos.push(ax, 0, az, bx, 0, bz, ax, BASE, az, bx, 0, bz, bx, BASE, bz, ax, BASE, az);
        }
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
        binPush(M.matte, false, 0, 80, prep(g, 0x1e1a1c, null));
        for (let i = 0; i < APRON_PTS.length - 1; i++) {
          const [ax, az] = APRON_PTS[i], [bx, bz] = APRON_PTS[i + 1], l = Math.hypot(bx - ax, bz - az);
          put(box(l + 0.1, 0.35, 0.2), 0xc8a050, { x: (ax + bx) / 2, y: -0.6, z: (az + bz) / 2, ry: -Math.atan2(bz - az, bx - ax) }, M.gold, false);
        }
      }
      // pit floor, the stalls' front wall with the orchestra rail, the stalls floor
      put(box(PIT.x1 - PIT.x0, 0.6, ST.z1 - FRONT + 2), 0x1a1614, { x: 0, y: BASE - 0.3, z: (FRONT + ST.z1) / 2 }, M.matte, false);
      put(box(PIT.x1 - PIT.x0, -4.6 - BASE, 2), 0x2a1a1c, { x: 0, y: (BASE - 4.6) / 2, z: PIT.z1 + 1 }, M.matte, false);
      put(box(PIT.x1 - PIT.x0, 0.5, 0.6), 0xd8b060, { x: 0, y: -4.3, z: PIT.z1 + 0.4 }, M.gold);
      put(box(PIT.x1 - PIT.x0, 0.6, 30), 0x3a1418, { x: 0, y: -4.9, z: PIT.z1 + 17 }, M.matte, false);
    }

    // ============================================================ the road: grey dance floor taped over the boards
    const hz = {}; // hazard positions along the track
    {
      // where the track crosses the revolve
      const ins = [];
      let inside = false, s0 = 0;
      for (let s = 0; s <= L; s += 0.5) {
        const p = track.at(s), now = inRev(p.x, p.z, 0.6);
        if (now && !inside) s0 = s;
        if (!now && inside) ins.push([s0, s]);
        inside = now;
      }
      hz.rev = ins; // [[s0, s1] (north chord), [s0, s1] (south chord)]
      hz.trapA = sAt(46, -74); hz.trapB = sAt(22, -74);
      hz.fly = [sAt(142, 2), sAt(142, -12)];
      hz.bag = sAt(-132, -48);
    }
    const trapRoom = [hz.trapA - 6, hz.trapB + 6];
    {
      const marley = TX.mottledTextures({ size: 256, a: 0x4a4a50, b: 0x44444a, c: 0x4e4e54, seed: 72, period: 32, speck: 0.22, bump: 0.6 });
      const roadMat = K.phys({ map: marley.map, normalMap: marley.normalMap, normalScale: V2(0.35), roughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.4 });
      const tapeMat = K.std({ color: 0xece6d6, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      const seamMat = K.std({ color: 0x2e2e33, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
      // the dance floor stops at the revolve's rim (the light shows the way across it): discard inside the circle
      for (const m of [roadMat, tapeMat, seamMat]) {
        m.onBeforeCompile = (sh) => {
          sh.uniforms.uRev = { value: new T.Vector3(REV.x, REV.z, REV.R + 0.5) };
          sh.vertexShader = 'varying vec2 vRevW;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvRevW = (modelMatrix * vec4(transformed, 1.0)).xz;');
          sh.fragmentShader = 'varying vec2 vRevW;\nuniform vec3 uRev;\n' + sh.fragmentShader.replace('void main() {', 'void main() {\nif (distance(vRevW, uRev.xy) < uRev.z) discard;');
        };
        m.customProgramCacheKey = () => 'stage-revclip-' + m.type;
      }
      // the road is cut at the trap room (the traps are the floor there)
      const cuts = [trapRoom];
      const runs = []; let at = 0;
      for (const [a, b] of cuts) { if (a > at) runs.push([at, a]); at = b; }
      runs.push([at, L]);
      const rg = [], tg = [], sg = [];
      for (const [a, b] of runs) {
        rg.push(strip(a, b, 0, W, 0.03, 1, 12));
        for (const sd of [-1, 1]) tg.push(strip(a, b, sd * (W / 2 - 0.35), 0.5, 0.05, 1, 10));
        sg.push(strip(a, b, 0, 0.14, 0.045, 2, 10));
      }
      meshOf(BU.mergeGeometries(rg, false), roadMat);
      meshOf(BU.mergeGeometries(tg, false), tapeMat);
      meshOf(BU.mergeGeometries(sg, false), seamMat);
      // glow tape dashes just outside both edges (not on the revolve)
      const dashes = [];
      for (const sd of [-1, 1]) for (const p of track.edgePoints(sd, 6.5, 0.45)) {
        if (inRev(p.x, p.z, 1.5)) continue;
        dashes.push({ x: p.x, y: 0.05, z: p.z, ry: -p.angle, sx: 1.1, sy: 0.04, sz: 0.4 });
      }
      const dm = K.instances(box(1, 1, 1), new T.MeshBasicMaterial({ color: new T.Color(0xc8ffb8).multiplyScalar(1.15), toneMapped: false }), dashes, { cast: false, receive: false });
      dm.renderOrder = 1;
      // start/finish: chequered tape across the road, grid marks behind it
      {
        const c = canvas(256, 32, (g) => { for (let y = 0; y < 2; y++) for (let x = 0; x < 16; x++) { g.fillStyle = (x + y) % 2 ? '#141414' : '#f2eee4'; g.fillRect(x * 16, y * 16, 16, 16); } });
        const p = track.at(START_S);
        const m = meshOf(new T.PlaneGeometry(W, 1.9), K.std({ map: tex(c, [1, 1], false), roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), { order: 1 });
        m.position.set(p.x, 0.06, p.z); m.rotation.order = 'YXZ'; m.rotation.y = -p.angle + PI / 2; m.rotation.x = -PI / 2;
        for (let k = 0; k < 4; k++) {
          const q = track.place(START_S - 6 - Math.floor(k / 2) * 7 - (k % 2) * 3.5, k % 2 ? 3.5 : -3.5);
          put(box(0.3, 0.03, 2.2), 0xffd040, { x: q.x, y: 0.06, z: q.z, ry: -q.angle }, M.matte, false);
          const b = track.place(START_S - 6 - Math.floor(k / 2) * 7 - (k % 2) * 3.5 - 1.2, k % 2 ? 3.5 : -3.5);
          put(box(2.2, 0.03, 0.3), 0xffd040, { x: b.x, y: 0.06, z: b.z, ry: -q.angle }, M.matte, false);
        }
      }
    }

    // ============================================================ canvases: cardboard actors, painted flats, backdrop
    const ACT = { cols: 8, rows: 2, w: 128, h: 256 };
    const actorTex = (() => {
      const atlas = TX.makeCanvas(ACT.w * ACT.cols, ACT.h * ACT.rows);
      const ag = atlas.getContext('2d');
      const off = TX.makeCanvas(ACT.w, ACT.h), og = off.getContext('2d');
      const sil = TX.makeCanvas(ACT.w, ACT.h), sg = sil.getContext('2d');
      const E = (x, y, rx, ry, c, rot = 0) => { og.fillStyle = c; og.beginPath(); og.ellipse(x, y, rx, ry, rot, 0, TAU); og.fill(); };
      const R = (x, y, w, h, c) => { og.fillStyle = c; og.fillRect(x, y, w, h); };
      const Pg = (pts, c) => { og.fillStyle = c; og.beginPath(); pts.forEach(([x, y], i) => (i ? og.lineTo(x, y) : og.moveTo(x, y))); og.closePath(); og.fill(); };
      const Ln = (x0, y0, x1, y1, w, c) => { og.strokeStyle = c; og.lineWidth = w; og.lineCap = 'round'; og.beginPath(); og.moveTo(x0, y0); og.lineTo(x1, y1); og.stroke(); };
      const face = (x, y, skin, hair, eyes = '#2a1a12') => {
        E(x, y, 13, 15, skin);
        if (hair) { og.fillStyle = hair; og.beginPath(); og.ellipse(x, y - 5, 14, 11, 0, PI, TAU); og.fill(); }
        E(x - 5, y + 1, 1.8, 2.2, eyes); E(x + 5, y + 1, 1.8, 2.2, eyes);
        E(x - 8, y + 6, 3, 2, 'rgba(230,90,90,0.45)'); E(x + 8, y + 6, 3, 2, 'rgba(230,90,90,0.45)');
        og.strokeStyle = '#8a3020'; og.lineWidth = 1.6; og.beginPath(); og.arc(x, y + 6, 4.5, 0.25, PI - 0.25); og.stroke();
      };
      const skinA = '#f1c7a0', skinB = '#d9a072', skinC = '#8d5a3b';
      const figures = [
        () => { // knight
          R(50, 180, 11, 64, '#9aa2ac'); R(67, 180, 11, 64, '#8a929c'); R(46, 236, 16, 10, '#5a6068'); R(66, 236, 16, 10, '#5a6068');
          Pg([[40, 100], [88, 100], [92, 186], [36, 186]], '#b8c0ca'); Pg([[52, 108], [76, 108], [80, 186], [48, 186]], '#b01e28');
          R(61, 112, 6, 60, '#f0d060'); R(50, 132, 28, 6, '#f0d060');
          R(28, 104, 12, 60, '#a8b0ba'); R(88, 104, 12, 56, '#a8b0ba');
          Ln(98, 162, 112, 40, 6, '#d0d6de'); R(92, 150, 22, 6, '#c8a040'); E(104, 166, 4, 4, '#c8a040');
          E(30, 150, 18, 22, '#2a4ea0'); E(30, 150, 9, 11, '#e8c050');
          E(64, 76, 17, 20, '#a8b0ba'); R(50, 74, 28, 4, '#2a2e34'); E(64, 52, 6, 16, '#d0283a', 0.3);
        },
        () => { // princess
          Pg([[64, 120], [100, 246], [28, 246]], '#f080b8'); Pg([[64, 150], [92, 246], [36, 246]], '#f6a8d0');
          Pg([[48, 96], [80, 96], [74, 132], [54, 132]], '#e05898'); E(44, 102, 9, 8, '#f6a8d0'); E(84, 102, 9, 8, '#f6a8d0');
          R(38, 104, 7, 40, skinA); R(83, 104, 7, 40, skinA); R(58, 82, 12, 14, skinA);
          E(64, 66, 18, 22, '#f2c040'); face(64, 70, skinA, '#f2c040'); R(44, 66, 8, 40, '#f2c040'); R(76, 66, 8, 40, '#f2c040');
          Pg([[52, 52], [56, 38], [60, 50], [64, 34], [68, 50], [72, 38], [76, 52]], '#f8d850');
        },
        () => { // jester
          R(50, 176, 13, 66, '#d82a2a'); R(65, 176, 13, 66, '#f2c020'); Pg([[44, 236], [62, 236], [62, 246], [36, 246]], '#d82a2a'); Pg([[66, 236], [84, 236], [92, 246], [66, 246]], '#f2c020');
          Pg([[40, 100], [64, 100], [64, 186], [36, 186]], '#f2c020'); Pg([[64, 100], [88, 100], [92, 186], [64, 186]], '#d82a2a');
          Pg([[36, 186], [50, 200], [64, 186], [78, 200], [92, 186]], '#2a8a40');
          R(26, 104, 12, 52, '#d82a2a'); R(90, 104, 12, 52, '#f2c020');
          Pg([[40, 98], [52, 88], [64, 98], [76, 88], [88, 98]], '#f0f0f0');
          face(64, 72, skinA, null);
          Pg([[46, 62], [30, 36], [56, 54], [64, 22], [72, 54], [98, 36], [82, 62]], '#d82a2a'); E(30, 36, 5, 5, '#f2d040'); E(64, 22, 5, 5, '#f2d040'); E(98, 36, 5, 5, '#f2d040');
        },
        () => { // king
          Pg([[40, 100], [88, 100], [100, 246], [28, 246]], '#6a2a90'); Pg([[28, 236], [100, 236], [100, 246], [28, 246]], '#f4f0ea');
          R(56, 100, 16, 146, '#f4f0ea'); for (let i = 0; i < 8; i++) E(64, 112 + i * 16, 2, 3, '#1a1a1a');
          R(26, 104, 14, 60, '#6a2a90'); R(88, 104, 14, 60, '#6a2a90'); E(32, 166, 6, 6, skinB); E(96, 166, 6, 6, skinB);
          Ln(100, 170, 104, 70, 5, '#e0b040'); E(104, 66, 7, 7, '#e83050');
          face(64, 72, skinB, null); Pg([[48, 80], [80, 80], [74, 104], [64, 110], [54, 104]], '#f4f0ea');
          Pg([[46, 60], [48, 38], [56, 50], [64, 34], [72, 50], [80, 38], [82, 60]], '#f0c040'); E(64, 50, 3, 3, '#e83050');
        },
        () => { // ballerina
          R(54, 160, 8, 82, '#f6c8c8'); R(66, 160, 8, 82, '#f6c8c8'); E(58, 244, 6, 3, '#f0a0b0'); E(70, 244, 6, 3, '#f0a0b0');
          E(64, 160, 40, 12, '#fafaff'); E(64, 156, 34, 9, '#f0f0fa');
          Pg([[52, 104], [76, 104], [72, 156], [56, 156]], '#f4a6c0');
          Ln(52, 108, 30, 70, 7, skinA); Ln(76, 108, 98, 70, 7, skinA); Ln(30, 70, 50, 46, 6, skinA); Ln(98, 70, 78, 46, 6, skinA);
          R(59, 86, 10, 18, skinA); face(64, 74, skinA, '#5a3020'); E(64, 54, 8, 7, '#5a3020');
        },
        () => { // witch
          Pg([[46, 100], [82, 100], [98, 246], [30, 246]], '#2a2234'); Pg([[30, 236], [98, 236], [90, 246], [38, 246]], '#3a2e48');
          R(30, 104, 12, 56, '#2a2234'); R(86, 104, 12, 56, '#2a2234'); E(34, 162, 5, 5, '#8ac870'); E(92, 162, 5, 5, '#8ac870');
          Ln(30, 220, 108, 120, 4, '#7a5030'); Pg([[100, 112], [124, 96], [118, 132]], '#d8b060');
          face(64, 76, '#8ac870', null); E(64, 82, 3, 4, '#6aa850');
          R(30, 58, 68, 6, '#2a2234'); Pg([[46, 60], [82, 60], [70, 10]], '#2a2234'); R(48, 52, 32, 5, '#8a40c0');
          R(46, 64, 8, 30, '#c84020'); R(74, 64, 8, 30, '#c84020');
        },
        () => { // pirate
          R(50, 170, 13, 70, '#1e1e22'); R(65, 170, 13, 70, '#1e1e22'); R(46, 230, 17, 16, '#3a2414'); R(65, 230, 17, 16, '#3a2414');
          Pg([[42, 100], [86, 100], [88, 176], [40, 176]], '#f4f0ea'); for (let i = 0; i < 6; i++) R(41, 106 + i * 12, 47, 5, '#c82830');
          R(40, 160, 48, 10, '#d8a020'); R(28, 104, 12, 50, '#f4f0ea'); R(88, 104, 12, 50, '#f4f0ea');
          Ln(100, 150, 116, 110, 4, '#c8ccd4'); R(94, 148, 12, 5, '#c8a040');
          face(64, 76, skinB, '#2a1a12'); E(70, 76, 5, 4, '#111'); Ln(56, 66, 78, 82, 1.5, '#111');
          Pg([[34, 62], [94, 62], [86, 48], [64, 40], [42, 48]], '#1e1e22'); E(64, 54, 4, 3, '#f4f0ea');
          Pg([[52, 88], [76, 88], [70, 100], [58, 100]], '#3a2414');
        },
        () => { // ghost
          og.fillStyle = '#f4f6fa'; og.beginPath(); og.moveTo(28, 240); og.lineTo(30, 110); og.bezierCurveTo(30, 40, 98, 40, 98, 110); og.lineTo(100, 240);
          for (let i = 0; i < 6; i++) og.quadraticCurveTo(94 - i * 12, 226, 88 - i * 12, 240);
          og.closePath(); og.fill();
          E(52, 98, 7, 11, '#1a1a24'); E(76, 98, 7, 11, '#1a1a24'); E(64, 128, 9, 12, '#1a1a24');
          E(24, 140, 8, 16, '#f4f6fa', 0.6); E(104, 140, 8, 16, '#f4f6fa', -0.6);
        },
        () => { // violinist
          R(50, 170, 13, 72, '#18181c'); R(65, 170, 13, 72, '#18181c');
          Pg([[42, 100], [86, 100], [90, 184], [38, 184]], '#18181c'); Pg([[56, 100], [72, 100], [64, 150]], '#f4f4f4'); Pg([[60, 102], [68, 102], [64, 110]], '#c02030');
          R(28, 104, 12, 46, '#18181c'); Ln(92, 108, 98, 80, 10, '#18181c');
          Pg([[70, 78], [100, 96], [96, 112], [64, 92]], '#9a4a1a'); Ln(20, 96, 110, 70, 2, '#e8dcc0');
          face(58, 72, skinA, '#d8d8d8');
        },
        () => { // conductor
          R(50, 170, 13, 72, '#18181c'); R(65, 170, 13, 72, '#18181c'); Pg([[40, 176], [54, 176], [50, 214], [36, 214]], '#18181c'); Pg([[74, 176], [88, 176], [92, 214], [78, 214]], '#18181c');
          Pg([[42, 100], [86, 100], [88, 180], [40, 180]], '#18181c'); Pg([[56, 100], [72, 100], [64, 156]], '#f4f4f4');
          Ln(36, 106, 14, 60, 10, '#18181c'); Ln(92, 106, 112, 70, 10, '#18181c'); Ln(112, 70, 124, 30, 2, '#f8f8f8');
          face(64, 72, skinA, '#f0f0f0'); E(64, 58, 16, 8, '#f0f0f0');
        },
        () => { // flower seller
          Pg([[46, 100], [82, 100], [96, 246], [32, 246]], '#2a7a4a'); Pg([[50, 130], [78, 130], [84, 230], [44, 230]], '#f4f0e4');
          R(30, 104, 12, 50, '#2a7a4a'); R(86, 104, 12, 50, '#2a7a4a');
          E(30, 160, 18, 10, '#a8783a'); for (let i = 0; i < 7; i++) E(18 + i * 4, 150 - (i % 2) * 3, 3.5, 3.5, ['#e83a5a', '#f2c030', '#f080c0'][i % 3]);
          face(64, 74, skinC, '#1a1010'); E(64, 54, 20, 7, '#c88a30');
        },
      ];
      figures.forEach((draw, i) => {
        og.clearRect(0, 0, ACT.w, ACT.h);
        draw();
        sg.clearRect(0, 0, ACT.w, ACT.h);
        sg.globalCompositeOperation = 'source-over'; sg.drawImage(off, 0, 0);
        sg.globalCompositeOperation = 'source-in'; sg.fillStyle = '#efe6d2'; sg.fillRect(0, 0, ACT.w, ACT.h);
        sg.globalCompositeOperation = 'source-over';
        const ox = (i % ACT.cols) * ACT.w, oy = Math.floor(i / ACT.cols) * ACT.h;
        ag.save(); ag.beginPath(); ag.rect(ox, oy, ACT.w, ACT.h); ag.clip();
        for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; ag.drawImage(sil, ox + Math.cos(a) * 4, oy + Math.sin(a) * 4); }
        ag.drawImage(off, ox, oy);
        ag.restore();
      });
      const t = TX.toTexture(atlas, { wrap: false });
      return t;
    })();
    const actorMat = K.std({ map: actorTex, alphaTest: 0.5, side: T.DoubleSide, roughness: 0.8 });
    const actorParts = [], revActorParts = [];
    // a cardboard actor (kind = atlas slot) standing on a little stand; scale 1 = 7.2 tall
    const actor = (x, z, ry, kind, sc = 1, opts = {}) => {
      const g = new T.PlaneGeometry(3.6 * sc, 7.2 * sc);
      const u0 = (kind % ACT.cols) / ACT.cols, v0 = 1 - (Math.floor(kind / ACT.cols) + 1) / ACT.rows;
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) / ACT.cols, v0 + uv.getY(i) / ACT.rows);
      const y = opts.y ?? 0;
      const Mx = opts.lie ? mtx({ x, y: y + 0.12, z, ry, rx: -PI / 2 }) : mtx({ x, y: y + 3.6 * sc + 0.15, z, ry, rx: opts.tilt || 0 });
      g.applyMatrix4(Mx);
      (opts.rev ? revActorParts : actorParts).push(prep(g, 0xffffff, null));
      if (!opts.lie && !opts.noStand) {
        const f = opts.rev ? null : frame(x, y, z, ry);
        if (f) { f(box(2.4 * sc, 0.3, 1.4 * sc), 0x6a5034, { y: 0.15 }, M.wood); f(box(0.3, 3 * sc, 0.2), 0x8a6a44, { y: 1.5 * sc, z: -0.6 * sc, rx: 0.35 }, M.wood); }
        if (!opts.rev) AO(x, z, 1.6 * sc, 1.1 * sc, 0.35, -ry);
      }
    };

    // ============================================================ the proscenium arch, house curtain and backdrop
    {
      const Z = ARCH.z;
      const gold = 0xd8ac52, goldD = 0xa8802e, cream = 0xf0e4c8;
      // the inner stage behind the arch and its painted backdrop (moonlit hills and a castle)
      const bd = canvas(1024, 512, (g) => {
        const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#0c1238'); gr.addColorStop(0.55, '#24407a'); gr.addColorStop(1, '#5a6aa0');
        g.fillStyle = gr; g.fillRect(0, 0, 1024, 512);
        const sr = K.rng(7102);
        for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(255,250,230,${0.3 + sr() * 0.7})`; const s = sr() < 0.1 ? 2.4 : 1.2; g.fillRect(sr() * 1024, sr() * 330, s, s); }
        const mg = g.createRadialGradient(760, 120, 10, 760, 120, 140); mg.addColorStop(0, 'rgba(255,248,220,0.55)'); mg.addColorStop(1, 'rgba(255,248,220,0)');
        g.fillStyle = mg; g.fillRect(560, 0, 400, 300);
        g.fillStyle = '#fff6d8'; g.beginPath(); g.arc(760, 120, 46, 0, TAU); g.fill();
        g.fillStyle = '#d8ccaa'; for (const [x, y, rr] of [[748, 108, 8], [772, 132, 6], [756, 140, 4]]) { g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill(); }
        const hill = (y0, amp, col, seed) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, 512); for (let x = 0; x <= 1024; x += 16) g.lineTo(x, y0 - Math.sin(x * 0.006 + seed) * amp - Math.sin(x * 0.017 + seed * 2) * amp * 0.35); g.lineTo(1024, 512); g.fill(); };
        hill(380, 40, '#1c2a4a', 1);
        // castle on the far hill
        g.fillStyle = '#141c34';
        g.fillRect(250, 270, 150, 90); for (const [x, w, h] of [[240, 34, 140], [380, 30, 120], [306, 40, 170]]) { g.fillRect(x, 360 - h, w, h); for (let k = 0; k < 4; k++) g.fillRect(x + k * (w / 4), 352 - h, w / 8, 10); }
        g.beginPath(); g.moveTo(300, 190); g.lineTo(326, 150); g.lineTo(352, 190); g.fill();
        g.fillStyle = '#ffd880'; for (const [x, y] of [[256, 260], [318, 220], [330, 280], [390, 270], [280, 320], [356, 312]]) g.fillRect(x, y, 6, 10);
        hill(430, 30, '#121c30', 3); hill(470, 18, '#0c1222', 5);
      });
      const bdMat = new T.MeshBasicMaterial({ map: tex(bd, [1, 1], false), color: new T.Color(0.82, 0.82, 0.9) });
      meshOf(new T.PlaneGeometry(196, 70), bdMat, { receive: false }).position.set(0, 26, -101);
      put(box(200, 0.5, 14), 0x2a2018, { x: 0, y: -0.2, z: -95 }, M.matte, false);
      // pillars: plinth, fluted pilaster, capital; the header with mouldings and a cartouche
      for (const sd of [-1, 1]) {
        const xc = sd * (ARCH.xi + ARCH.xo) / 2, wd = ARCH.xo - ARCH.xi;
        put(box(wd + 4, 6, 9), goldD, { x: xc, y: 3, z: Z - 3 }, M.gold);
        put(box(wd + 2, 1, 8), gold, { x: xc, y: 6.5, z: Z - 3 }, M.gold);
        put(box(wd, ARCH.open - 10, 6), 0x7a1420, { x: xc, y: 7 + (ARCH.open - 10) / 2, z: Z - 3 }, M.velvet);
        for (let k = 0; k < 5; k++) put(box(1.4, ARCH.open - 12, 0.8), gold, { x: xc - wd / 2 + 2.5 + k * (wd - 5) / 4, y: 8 + (ARCH.open - 12) / 2, z: Z + 0.2 }, M.gold);
        put(box(wd + 3, 3, 8), gold, { x: xc, y: ARCH.open - 1.5, z: Z - 3 }, M.gold);
        for (let k = 0; k < 6; k++) put(sph(0.8, 10, 6), goldD, { x: xc - wd / 2 + 1.8 + k * (wd - 3.6) / 5, y: ARCH.open - 3.4, z: Z + 1.1 }, M.gold);
        // a tragedy / comedy mask on each pillar
        put(cyl(3.6, 3.6, 0.8, 24).rotateX(PI / 2), cream, { x: xc, y: 28, z: Z + 0.6, sy: 1.2 }, M.gold);
        put(sph(0.7, 8, 6), 0x2a1a10, { x: xc - 1.3, y: 29.5, z: Z + 1.1 }, M.matte);
        put(sph(0.7, 8, 6), 0x2a1a10, { x: xc + 1.3, y: 29.5, z: Z + 1.1 }, M.matte);
        put(new T.TorusGeometry(1.4, 0.3, 6, 14, PI), 0x2a1a10, { x: xc, y: sd > 0 ? 26.4 : 25.2, z: Z + 1.1, rz: sd > 0 ? PI : 0 }, M.matte);
      }
      put(box(2 * ARCH.xo + 6, ARCH.h - ARCH.open, 7), 0x7a1420, { x: 0, y: (ARCH.h + ARCH.open) / 2, z: Z - 3 }, M.velvet);
      put(box(2 * ARCH.xo + 8, 2.4, 9), gold, { x: 0, y: ARCH.open + 1.2, z: Z - 3 }, M.gold);
      put(box(2 * ARCH.xo + 8, 2.4, 9), gold, { x: 0, y: ARCH.h - 1.2, z: Z - 3 }, M.gold);
      for (let k = 0; k < 60; k++) put(sph(0.7, 8, 6), goldD, { x: -ARCH.xo + 1 + k * (2 * ARCH.xo - 2) / 59, y: ARCH.open + 3.2, z: Z + 1.0, sy: 1.4 }, M.gold);
      put(cyl(7, 7, 1, 32).rotateX(PI / 2), gold, { x: 0, y: ARCH.open + 9.5, z: Z + 0.6, sx: 1.5 }, M.gold);
      put(cyl(5.4, 5.4, 1, 32).rotateX(PI / 2), 0x7a1420, { x: 0, y: ARCH.open + 9.5, z: Z + 1.0, sx: 1.5 }, M.velvet);
      put(new T.TorusGeometry(5.8, 0.5, 8, 40), goldD, { x: 0, y: ARCH.open + 9.5, z: Z + 1.2, sx: 1.5 }, M.gold);
      // the house curtain, half open: two velvet drapes gathered to the sides with gold tiebacks
      const drape = (sd) => {
        const nu = 60, nv = 26, pos = [], idx = [];
        for (let j = 0; j <= nv; j++) {
          const v = j / nv, y = v * ARCH.open;
          // gathered at the tieback (y ~ 15), spreading below it and above it
          const gat = Math.exp(-((y - 15) ** 2) / 50);
          const inner = lerp(sd * 44, sd * 66, gat) + (v < 0.35 ? sd * (0.35 - v) * -12 : 0);
          for (let i = 0; i <= nu; i++) {
            const u = i / nu, x = lerp(inner, sd * ARCH.xi, u);
            const folds = Math.sin(u * 15 * TAU / 2 + (sd > 0 ? 0.8 : 0)) * (1.1 + gat * 1.4);
            pos.push(x, y, Z + 1.6 + folds);
          }
        }
        for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + nu + 1; if (sd < 0) idx.push(a, b, a + 1, b, b + 1, a + 1); else idx.push(a, a + 1, b, b, a + 1, b + 1); }
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
        binPush(M.velvet, true, 0, Z, prep(g, 0x8a0c18, null));
        put(new T.TorusGeometry(1.5, 0.3, 6, 16), gold, { x: sd * 64, y: 15, z: Z + 3.2, rx: PI / 2, sx: 1.4 }, M.gold);
        put(sph(0.7, 10, 8), gold, { x: sd * 60, y: 13.6, z: Z + 3.6 }, M.gold);
        put(cyl(0.45, 0.8, 2.6, 10), goldD, { x: sd * 60, y: 11.9, z: Z + 3.6 }, M.gold);
      };
      drape(-1); drape(1);
      // valance (swags) across the top of the opening with a gold fringe
      for (let k = 0; k < 8; k++) {
        const x = -ARCH.xi + 10 + k * 20;
        put(new T.TorusGeometry(10, 2.2, 8, 20, PI), 0x8a0c18, { x, y: ARCH.open - 1, z: Z + 2.4, rz: PI, sy: 0.45 }, M.velvet);
        put(new T.TorusGeometry(10.6, 0.35, 6, 20, PI), gold, { x, y: ARCH.open - 1.3, z: Z + 4.2, rz: PI, sy: 0.45 }, M.gold);
      }
      put(box(2 * ARCH.xi, 4, 3), 0x8a0c18, { x: 0, y: ARCH.open - 1.5, z: Z + 1.5 }, M.velvet);
      // the curtains and the pillars stop the cars (and keep them out of the inner stage)
      K.box(0, Z - 4, ARCH.xo + 4, 5, 0, 30);
      K.box(0, -96, ARCH.xi, 4, 0, 30);
      AO(0, Z + 3, ARCH.xo, 3.5, 0.5);
    }

    // ============================================================ the wings: fly rails, ropes, stacked scenery, booms
    {
      // the side walls of the model with the pin rail and the lines going up to the fly gallery
      for (const sd of [-1, 1]) {
        const x = sd > 0 ? ST.x1 - 1.5 : ST.x0 + 1.5;
        put(box(3, 7, ST.z1 - ST.z0 - 4), 0x18161a, { x, y: 3.5, z: (ST.z0 + ST.z1) / 2 - 2 }, M.matte);
        put(box(1.2, 1.2, ST.z1 - ST.z0 - 30), 0x8a6a44, { x: x - sd * 1.8, y: 6.2, z: (ST.z0 + ST.z1) / 2 - 10 }, M.wood);
        K.box(x, (ST.z0 + ST.z1) / 2 - 2, 1.6, (ST.z1 - ST.z0 - 4) / 2, 0, 8);
        const lines = [];
        for (let z = ST.z0 + 18; z < ST.z1 - 20; z += 3.4) {
          if (r() < 0.42) continue;
          lines.push(z);
          put(cyl(0.18, 0.18, 2.4, 6), 0xc8b088, { x: x - sd * 1.8, y: 6.6, z }, M.wood);
          put(rod([x - sd * 1.9, 6.8, z], [x - sd * (2.2 + r() * 1.2), 60, z + r.range(-1, 1)], 0.09, 4), 0xc8b890, {}, M.matte, false);
        }
        // sandbags tied off on some of the lines, and coiled rope on the rail
        for (const z of lines) {
          if (r() < 0.6) continue;
          const y = r.range(10, 26);
          put(K.lathe([[0.01, -1.5], [1.0, -1.3], [1.25, -0.4], [1.1, 0.8], [0.45, 1.5], [0.25, 1.9], [0.01, 2.0]], 10), 0xb89a70, { x: x - sd * 2.6, y, z }, M.matte);
        }
        for (let k = 0; k < 6; k++) { const z = r.range(ST.z0 + 20, ST.z1 - 25); put(new T.TorusGeometry(1.1, 0.35, 6, 14), 0xd0b890, { x: x - sd * 2.4, y: 4.5, z, ry: PI / 2 }, M.matte); }
      }
      // the scenery dock in the east wing: flats leaning against the wall (it also walls the flying-flat passage)
      {
        const cols = [0x6a8aa8, 0x8aa070, 0xc8a878, 0xa86a5a, 0x7a6a9a, 0xd0c0a0];
        for (let k = 0; k < 7; k++) {
          const z0 = -32 + k * 8.2, len = r.range(10, 14);
          put(box(0.5, len, 7.6), cols[k % 6], { x: 156.6 - k * 0.15, y: len / 2 - 0.4, z: z0, rz: -0.12 - r() * 0.05 }, M.matte);
          put(box(0.4, len, 0.4), 0x8a6a44, { x: 157.2, y: len / 2 - 0.4, z: z0 - 3.6, rz: -0.13 }, M.wood);
        }
        K.box(155.5, -4, 3.6, 30, 0, 12);
        AO(155, -4, 5, 32, 0.45);
      }
      // a painted wing flat along the west side of the east passage (the other wall of the flying-flat passage)
      {
        const wingC = canvas(512, 256, (g) => {
          const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#2a4a3a'); gr.addColorStop(1, '#16281e'); g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
          const fr = K.rng(7104);
          for (let i = 0; i < 9; i++) { const x = 20 + i * 58 + fr() * 20; g.fillStyle = '#3a2a1c'; g.fillRect(x, 120, 10 + fr() * 6, 136); }
          for (let i = 0; i < 70; i++) { g.fillStyle = ['#3e7a4a', '#2e6a3c', '#5a9a5a', '#26583a'][i % 4]; g.beginPath(); g.arc(fr() * 512, fr() * 150, 14 + fr() * 26, 0, TAU); g.fill(); }
          g.fillStyle = 'rgba(255,240,180,0.12)'; for (let i = 0; i < 30; i++) { g.beginPath(); g.arc(fr() * 512, fr() * 120, 4 + fr() * 6, 0, TAU); g.fill(); }
        });
        const wm = K.std({ map: tex(wingC, [1, 1], false), roughness: 0.85 });
        const g = new T.PlaneGeometry(30, 12); g.rotateY(PI / 2);
        meshOf(g, wm, { cast: true }).position.set(131.6, 6, -7);
        put(box(0.5, 12, 30), 0x6a5034, { x: 131.2, y: 6, z: -7 }, M.wood);
        K.box(131.3, -7, 0.6, 15, 0, 12);
        AO(131, -7, 2.5, 15, 0.45);
      }
      // lighting booms: a pipe with three lanterns, aimed at the stage
      const boom = (x, z, aim) => {
        const f = frame(x, 0, z, aim);
        f(cyl(1.6, 1.8, 0.6, 16), 0x202024, { y: 0.3 }, M.metal);
        f(cyl(0.22, 0.22, 20, 8), 0x2a2a2e, { y: 10 }, M.metal);
        for (let k = 0; k < 3; k++) {
          const y = 8 + k * 5;
          f(cyl(0.9, 1.1, 2.8, 12).rotateZ(PI / 2), 0x18181c, { x: 1.4, y, rz: -0.25 }, M.metal);
          f(cyl(0.85, 0.85, 0.12, 12).rotateZ(PI / 2), [1.8, 1.5, 1.1], { x: 2.85, y: y - 0.36, rz: -0.25 }, M.glow);
          f(box(0.2, 1.8, 2.4), 0x2a2a2e, { x: 1.4, y }, M.metal);
        }
        f.circ(0, 0, 1.8, 20);
        AO(x, z, 2.2, 2.2, 0.5);
      };
      boom(122, 32, PI); boom(120, -40, PI); boom(-142, 6, 0); boom(-146, -84, 0.3); boom(150, 66, PI * 0.8);
      // road cases, a ladder and the ghost light in the wings
      const roadCase = (x, z, ry, w = 6, h = 4, d = 4) => {
        const f = frame(x, 0, z, ry);
        f(rbox(w, h, d, 0.3), 0x1a1a1e, { y: h / 2 }, M.matte);
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) f(box(0.6, h + 0.05, 0.6), 0xb8bcc4, { x: sx * (w / 2 - 0.25), y: h / 2, z: sz * (d / 2 - 0.25) }, M.metal);
        f(box(w * 0.5, 0.3, 0.3), 0xb8bcc4, { y: h * 0.7, z: d / 2 + 0.1 }, M.metal);
        f.box(0, 0, w / 2, d / 2, h);
        AO(x, z, w * 0.6, d * 0.6, 0.45, -ry);
      };
      roadCase(152, 74, 0.2); roadCase(158, 84, -0.1, 5, 6, 4); roadCase(-148, 74, 0.4); roadCase(-150, -60, 1.4, 7, 3.5, 4);
      roadCase(-146, 26, 0.1, 5, 3, 4);
      {
        const f = frame(152, 0, -84, 0.4);
        for (const sd of [-1, 1]) f(box(0.4, 0.4, 22), 0xb8a070, { x: sd * 1.4, y: 0.4, z: 0 }, M.wood);
        for (let k = 0; k < 9; k++) f(box(2.8, 0.25, 0.3), 0xb8a070, { y: 0.4, z: -10 + k * 2.5 }, M.wood);
        AO(152, -84, 2.5, 11, 0.4, -0.4);
      }
    }

    // ============================================================ the revolve (the star): disc, set, the light across it
    const rev = new T.Group(); rev.position.set(REV.x, 0, REV.z); K.group.add(rev); A.rev = rev;
    const revBins = new Map();
    const rput = (geo, c, o = {}, mat = M.paint, cast = true) => binPush(mat, cast, 0, 0, prep(geo, c, mtx(o)), revBins, 'rev');
    {
      K.spinner(REV.x, REV.z, REV.R, revAngle, { h: 0, fling: 1, pull: 0.4 });
      K.circle(REV.x, REV.z, FOUNTAIN_R, 4.5); // the fountain at the pivot only turns in place
      for (const p of SET) {
        const o = { x: 0, z: 0, angle: 0 };
        if (p.k === 'box') {
          K.mover({ type: 'box', hw: p.hw, hd: p.hd, h: p.h }, (t) => { const th = revAngle(t), c = Math.cos(th), s = Math.sin(th); o.x = REV.x + p.x * c - p.z * s; o.z = REV.z + p.x * s + p.z * c; o.angle = th; return o; });
        } else {
          K.mover({ type: 'circle', r: p.r, h: p.h }, (t) => { const th = revAngle(t), c = Math.cos(th), s = Math.sin(th); o.x = REV.x + p.x * c - p.z * s; o.z = REV.z + p.x * s + p.z * c; return o; });
        }
      }
      // the disc: painted flagstones in rings, a compass rose, a border, spike marks
      const dc = canvas(1024, 1024, (g) => {
        g.fillStyle = '#4a3c30'; g.fillRect(0, 0, 1024, 1024);
        const C = 512, dr = K.rng(7103);
        for (let ring = 0; ring < 14; ring++) {
          const r0 = 70 + ring * 31, r1 = r0 + 29, n = Math.floor((TAU * (r0 + 15)) / 44);
          for (let i = 0; i < n; i++) {
            const a0 = (i / n) * TAU + ring * 0.37, a1 = ((i + 1) / n) * TAU + ring * 0.37 - 0.014;
            const k = 0.62 + dr() * 0.28, w = dr() < 0.12 ? 0.82 : 1;
            g.fillStyle = `rgb(${(128 * k * w) | 0},${(116 * k * w) | 0},${(102 * k) | 0})`;
            g.beginPath(); g.arc(C, C, r1, a0, a1); g.arc(C, C, r0 + 2, a1, a0, true); g.closePath(); g.fill();
          }
        }
        // border near the rim: dark band with a gold line and chevrons
        g.strokeStyle = '#2a1e18'; g.lineWidth = 26; g.beginPath(); g.arc(C, C, 496, 0, TAU); g.stroke();
        g.strokeStyle = '#d0a050'; g.lineWidth = 5; g.beginPath(); g.arc(C, C, 482, 0, TAU); g.stroke();
        g.fillStyle = '#d0a050';
        for (let i = 0; i < 72; i++) { const a = (i / 72) * TAU; g.save(); g.translate(C + Math.cos(a) * 497, C + Math.sin(a) * 497); g.rotate(a); g.beginPath(); g.moveTo(-6, -8); g.lineTo(6, 0); g.lineTo(-6, 8); g.fill(); g.restore(); }
        // compass rose under the fountain (shows round it)
        g.save(); g.translate(C, C);
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * TAU, len = i % 4 === 0 ? 170 : i % 2 === 0 ? 130 : 100;
          g.fillStyle = i % 2 ? '#c8b088' : '#9a2a28';
          g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a - 0.12) * 40, Math.sin(a - 0.12) * 40); g.lineTo(Math.cos(a) * len, Math.sin(a) * len); g.lineTo(Math.cos(a + 0.12) * 40, Math.sin(a + 0.12) * 40); g.fill();
        }
        g.restore();
        // a painted path from the cottage door, scuffs, spike marks
        for (let i = 0; i < 40; i++) { const a = dr() * TAU, rr = 120 + dr() * 360; g.fillStyle = `rgba(30,20,14,${0.05 + dr() * 0.1})`; g.beginPath(); g.ellipse(C + Math.cos(a) * rr, C + Math.sin(a) * rr, 20 + dr() * 30, 6 + dr() * 8, dr() * PI, 0, TAU); g.fill(); }
        for (let i = 0; i < 18; i++) { const a = dr() * TAU, rr = 150 + dr() * 320, x = C + Math.cos(a) * rr, y = C + Math.sin(a) * rr; g.fillStyle = ['#f2d030', '#e84a8a', '#4ac0f0', '#f4f4f4'][i % 4]; g.fillRect(x - 9, y - 2, 18, 4); g.fillRect(x - 2, y - 9, 4, 18); }
      });
      const discTop = K.std({ map: tex(dc, [1, 1], false), roughness: 0.7 });
      const disc = new T.Mesh(new T.CylinderGeometry(REV.R, REV.R, 1.2, 128, 1), [K.std({ color: 0x1a1410, roughness: 0.8 }), discTop, K.std({ color: 0x1a1410 })]);
      disc.position.y = -0.6; disc.receiveShadow = true; rev.add(disc);
      // brass rim
      rput(new T.TorusGeometry(REV.R - 0.15, 0.18, 6, 128), 0xc8a050, { y: 0.02, rx: PI / 2 }, M.gold, false);
      // the fountain at the pivot
      rput(K.lathe([[0.01, 0], [6.8, 0], [7.0, 1.9], [6.5, 2.1], [6.1, 1.1], [0.01, 1.1]], 40), 0xb8ad98, {}, M.paint);
      rput(cyl(6.1, 6.1, 0.12, 40), 0x3a6a8a, { y: 1.55 }, M.gloss, false);
      rput(cyl(0.9, 1.2, 3.6, 16), 0xb0a590, { y: 3.2 }, M.paint);
      rput(K.lathe([[0.01, 0], [2.6, 0.2], [2.8, 0.9], [2.4, 1.0], [0.01, 0.5]], 24), 0xb8ad98, { y: 4.8 }, M.paint);
      rput(cyl(2.3, 2.3, 0.1, 24), 0x4a7a9a, { y: 5.6 }, M.gloss, false);
      rput(sph(1.0, 14, 10), 0xc8b8a0, { y: 7.0 }, M.paint); rput(sph(0.7, 12, 8), 0xc8b8a0, { y: 8.3 }, M.paint);
      for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; rput(sph(0.55, 8, 6), [0xe83a5a, 0xf2c030, 0xf6f0f0][k % 3], { x: Math.cos(a) * 7.6, y: 0.5, z: Math.sin(a) * 7.6 }, M.paint); rput(cyl(0.45, 0.35, 0.7, 8), 0xa0603a, { x: Math.cos(a) * 7.6, y: 0.1, z: Math.sin(a) * 7.6 }, M.paint); }
      // the cottage front (+x): a timber-framed flat, painted both sides, with a real door you can drive through
      {
        const ext = 0xe9dcc0, beam = 0x4a3020, intC = 0xc88a8a, wain = 0x6a3a3a;
        for (const [a, b] of [[15, 20.5], [27, 31.5]]) {
          const c = (a + b) / 2, l = b - a;
          rput(box(l, 12, 1.0), 0x5a4636, { x: c, y: 6 }, M.matte);
          rput(box(l, 12, 0.14), ext, { x: c, y: 6, z: 0.55 }, M.paint);
          rput(box(l, 12, 0.14), intC, { x: c, y: 6, z: -0.55 }, M.paint);
          rput(box(l, 3.4, 0.16), wain, { x: c, y: 1.7, z: -0.62 }, M.paint);
          // windows (lit) with frames, mullions and a flower box
          const wx = c, wy = 6.6;
          rput(box(3.2, 3.4, 0.1), [1.6, 1.25, 0.6], { x: wx, y: wy, z: 0.63 }, M.glow);
          rput(box(3.6, 0.35, 0.25), 0xf2eee4, { x: wx, y: wy - 1.85, z: 0.68 }, M.paint); rput(box(3.6, 0.35, 0.25), 0xf2eee4, { x: wx, y: wy + 1.85, z: 0.68 }, M.paint);
          rput(box(0.3, 3.4, 0.25), 0xf2eee4, { x: wx, y: wy, z: 0.68 }, M.paint); rput(box(3.4, 0.25, 0.25), 0xf2eee4, { x: wx, y: wy, z: 0.68 }, M.paint);
          rput(box(3.8, 0.8, 0.8), 0x7a4a2a, { x: wx, y: wy - 2.4, z: 0.95 }, M.paint);
          for (let k = 0; k < 6; k++) rput(sph(0.35, 6, 5), [0xe83050, 0xf2c030, 0xf070b0][k % 3], { x: wx - 1.5 + k * 0.6, y: wy - 1.9, z: 1.05 }, M.paint);
          // the interior side: a picture in a gold frame
          rput(box(2.6, 2.0, 0.12), 0x3a5a7a, { x: wx, y: 7, z: -0.66 }, M.paint);
          rput(box(3.0, 2.4, 0.08), 0xd8ac52, { x: wx, y: 7, z: -0.63 }, M.gold);
          // timber frame on the outside
          rput(box(l, 0.45, 0.2), beam, { x: c, y: 0.25, z: 0.7 }, M.paint);
          rput(box(l, 0.45, 0.2), beam, { x: c, y: 11.8, z: 0.7 }, M.paint);
          rput(box(0.45, 12, 0.2), beam, { x: a + 0.25, y: 6, z: 0.7 }, M.paint); rput(box(0.45, 12, 0.2), beam, { x: b - 0.25, y: 6, z: 0.7 }, M.paint);
          rput(box(0.4, 5.2, 0.2), beam, { x: c - l * 0.25, y: 2.4, z: 0.7, rz: 0.5 }, M.paint);
        }
        // lintel above the door, door posts, a little inn sign, the gable and the chimney
        rput(box(6.5, 3.4, 1.0), 0x5a4636, { x: 23.75, y: 10.3 }, M.matte);
        rput(box(6.5, 3.4, 0.14), ext, { x: 23.75, y: 10.3, z: 0.55 }, M.paint); rput(box(6.5, 3.4, 0.14), intC, { x: 23.75, y: 10.3, z: -0.55 }, M.paint);
        rput(box(7.2, 0.6, 0.5), beam, { x: 23.75, y: 8.6, z: 0.6 }, M.paint);
        for (const x of [20.6, 26.9]) rput(box(0.6, 8.6, 1.4), beam, { x, y: 4.3 }, M.paint);
        rput(box(3.4, 1.6, 0.2), 0x2a4a7a, { x: 23.75, y: 10.6, z: 0.78 }, M.paint);
        rput(box(2.8, 0.3, 0.22), 0xe8c050, { x: 23.75, y: 10.6, z: 0.8 }, M.gold);
        const gs = new T.Shape(); gs.moveTo(15, 0); gs.lineTo(31.5, 0); gs.lineTo(23.25, 5.6); gs.closePath();
        const gg = new T.ExtrudeGeometry(gs, { depth: 1.0, bevelEnabled: false }); gg.translate(0, 12, -0.5);
        rput(gg, 0xe0d2b4, {}, M.paint);
        // the roof: two tiled slopes over the gable (they read from the flies)
        for (const sd of [-1, 1]) {
          const l = Math.hypot(8.25, 5.6) + 0.6;
          rput(box(l, 0.35, 2.4), 0xb44a34, { x: 23.25 + sd * 4.1, y: 14.9, rz: -sd * Math.atan2(5.6, 8.25) }, M.paint);
          for (let k = 1; k < 5; k++) rput(box(0.12, 0.4, 2.42), 0x8a3424, { x: 23.25 + sd * (k * 1.9 - 0.3), y: 12.3 + (8.25 - k * 1.9 + 0.3) * 5.6 / 8.25 + 0.15, rz: -sd * Math.atan2(5.6, 8.25) }, M.paint);
        }
        rput(box(17.6, 0.5, 1.6), 0x3a2a24, { x: 23.25, y: 12.1 }, M.paint);
        rput(box(1.6, 3.6, 1.6), 0x8a5a44, { x: 28.6, y: 15.8 }, M.paint);
      }
      // the grand staircase (-x): white steps with a red runner, banisters, a landing and a door to nowhere
      {
        for (let i = 0; i < 9; i++) {
          const x = -(15.5 + i), h = (i + 1) * 0.8;
          rput(box(1.02, h, 5), 0xece6da, { x, y: h / 2 }, M.paint);
          rput(box(1.04, 0.08, 2.6), 0xb01828, { x, y: h + 0.04 }, M.velvet);
          rput(box(0.08, 0.8, 2.6), 0xb01828, { x: x + 0.53, y: h - 0.4 }, M.velvet);
        }
        rput(box(2.4, 7.2, 5.4), 0xece6da, { x: -25.2, y: 3.6 }, M.paint);
        rput(box(2.4, 0.1, 2.6), 0xb01828, { x: -25.2, y: 7.25 }, M.velvet);
        for (const sd of [-1, 1]) {
          for (let i = 0; i < 10; i++) rput(cyl(0.12, 0.12, 2.6, 6), 0xf6f2ea, { x: -(15.5 + i), y: (i + 1) * 0.8 + 1.3, z: sd * 2.3 }, M.paint);
          rput(rod([-15, 3.4, sd * 2.3], [-24.4, 10.6, sd * 2.3], 0.24, 6), 0x5a3020, {}, M.paint);
          rput(cyl(0.45, 0.5, 4.2, 10), 0x5a3020, { x: -15.1, y: 2.1, z: sd * 2.3 }, M.paint);
          rput(sph(0.55, 10, 8), 0xd8ac52, { x: -15.1, y: 4.5, z: sd * 2.3 }, M.gold);
        }
        for (const z of [-1.6, 1.6]) rput(box(0.5, 8, 0.5), 0x6a4030, { x: -25.6, y: 11.2, z }, M.paint);
        rput(box(0.5, 0.6, 3.7), 0x6a4030, { x: -25.6, y: 15.4, z: 0 }, M.paint);
        rput(box(0.15, 7.6, 2.6), 0x2a6a5a, { x: -25.3, y: 11.2, z: 0.25, ry: 0.5 }, M.paint);
        rput(sph(0.2, 6, 5), 0xd8ac52, { x: -25.0, y: 11, z: 1.2 }, M.gold);
      }
      // street lamps at the sides (+-z): green iron posts, glowing lanterns, a warm pool under each
      for (const sd of [-1, 1]) {
        const z = sd * 29;
        rput(cyl(0.8, 0.9, 1, 12), 0x1e3a2a, { y: 0.5, z }, M.metal);
        rput(cyl(0.3, 0.36, 8.6, 10), 0x2e5a3e, { y: 5.3, z }, M.metal);
        rput(box(1.5, 1.9, 1.5), [1.9, 1.35, 0.6], { y: 10.4, z }, M.glow);
        rput(new T.ConeGeometry(0.9, 0.8, 4).rotateY(PI / 4), 0x2e5a3e, { y: 11.75, z }, M.metal);
        rput(box(1.8, 0.25, 1.8), 0x1e3a2a, { y: 9.4, z }, M.metal);
        rput(box(2.4, 0.2, 0.2), 0x1e3a2a, { y: 8.6, z }, M.metal);
      }
      flushBins(revBins, rev);
      {
        const pg = new T.BufferGeometry(); pg.setAttribute('position', new T.Float32BufferAttribute([0, 10.4, 29, 0, 10.4, -29, 0, 10.2, 0], 3));
        pg.setAttribute('color', new T.Float32BufferAttribute([0.9, 0.62, 0.3, 0.9, 0.62, 0.3, 0, 0, 0], 3));
        const pts = new T.Points(pg, new T.PointsMaterial({ size: 9, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending, sizeAttenuation: true, toneMapped: false }));
        pts.renderOrder = 4; rev.add(pts);
      }
      // lamp pools and soft contact shadows that turn with the disc
      const rp = [], ra = [];
      for (const sd of [-1, 1]) rp.push({ x: 0, y: 0.08, z: sd * 29, sx: 16, sy: 1, sz: 16, color: new T.Color(0xffb860).multiplyScalar(0.42) });
      rp.push({ x: 23.25, y: 0.08, z: 3, sx: 18, sy: 1, sz: 9, color: new T.Color(0xffc070).multiplyScalar(0.3) });
      for (const [x, z, sx, sz, op] of [[23.25, 0, 18, 3.6, 0.5], [-20.5, 0, 13, 7, 0.5], [0, 0, 17, 17, 0.45], [0, 29, 2.4, 2.4, 0.5], [0, -29, 2.4, 2.4, 0.5]]) ra.push({ x, y: 0.05, z, sx, sy: op, sz });
      const rpm = new T.InstancedMesh(flat(1, 1), addMat(glowTex), rp.length);
      rp.forEach((p, i) => { rpm.setMatrixAt(i, mtx(p)); rpm.setColorAt(i, p.color); });
      rpm.renderOrder = 2; rev.add(rpm);
      const ram = new T.InstancedMesh(flat(1, 1), contactMat, ra.length);
      ra.forEach((p, i) => ram.setMatrixAt(i, mtx(p)));
      ram.renderOrder = 1; rev.add(ram);
      // the light across the revolve: a projected lane with gobo dashes at its edges (it does not turn)
      const lc = canvas(512, 64, (g) => {
        const gr = g.createLinearGradient(0, 0, 0, 64);
        gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.16, 'rgba(255,255,255,0.32)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.42)'); gr.addColorStop(0.84, 'rgba(255,255,255,0.32)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 512, 64);
        g.fillStyle = 'rgba(255,255,255,1)';
        for (let x = 0; x < 512; x += 22) { g.fillRect(x, 10, 13, 3); g.fillRect(x, 51, 13, 3); }
        const fade = g.createLinearGradient(0, 0, 512, 0); fade.addColorStop(0, 'rgba(0,0,0,1)'); fade.addColorStop(0.06, 'rgba(0,0,0,0)'); fade.addColorStop(0.94, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,1)');
        g.globalCompositeOperation = 'destination-out'; g.fillStyle = fade; g.fillRect(0, 0, 512, 64);
      });
      const laneMat = addMat(tex(lc, [1, 1], false), { color: new T.Color(0xfff0d0).multiplyScalar(0.5) });
      const lg = [];
      for (const [a, b] of hz.rev) {
        const pa = track.at(a), pb = track.at(b), len = Math.hypot(pb.x - pa.x, pb.z - pa.z) + 4;
        const g = new T.PlaneGeometry(len, W * 64 / 44).rotateX(-PI / 2).rotateY(-Math.atan2(pb.z - pa.z, pb.x - pa.x)).translate((pa.x + pb.x) / 2, 0.09, (pa.z + pb.z) / 2);
        lg.push(g);
      }
      meshOf(BU.mergeGeometries(lg, false), laneMat, { receive: false, order: 2 });
      // cardboard actors riding the revolve: a lady on the landing, a flower seller by the fountain
      actor(-25.2, 0.2, -PI / 2, 1, 0.9, { rev: true, y: 7.2, noStand: true });
      actor(5.4, -5.4, PI * 0.75, 10, 0.85, { rev: true, noStand: true });
    }

    // ============================================================ the trap room in front of the proscenium
    {
      const rows = [hz.trapA, hz.trapB];
      rows.forEach((s0, row) => TRAP.lanes.forEach((lat, lane) => {
        const p = track.place(s0, lat), hd = TRAP.hd[lane], hw = TRAP.hw;
        const hole = K.trapdoor(p.x, p.z, hw, hd, p.angle, false);
        const k = row === 0 ? lane : 2 - lane;
        A.traps.push({ hole, x: p.x, z: p.z, ang: p.angle, c: Math.cos(p.angle), s: Math.sin(p.angle), hw, hd, row, lane, s0, lat, t0: k * TRAP.slot + row * TRAP.off, phase: -1 });
      }));
      A.trapRespawnS = mod(hz.trapA - 26, L);
      const n = A.traps.length, D = TRAP.depth;
      // the trap shafts (vertex-lit walls) and the lit understage at the bottom; drawn before the depth masks
      const wallPos = [], wallCol = [], botPos = [], botUv = [];
      const wpt = (Tq, a, b) => [Tq.x + a * Tq.c - b * Tq.s, Tq.z + a * Tq.s + b * Tq.c];
      const top = new T.Color(0x010000), deep = new T.Color(0x2e1206);
      for (const Tq of A.traps) {
        const cs = [[-Tq.hw, -Tq.hd], [Tq.hw, -Tq.hd], [Tq.hw, Tq.hd], [-Tq.hw, Tq.hd]];
        for (let i = 0; i < 4; i++) {
          const [a0, b0] = cs[i], [a1, b1] = cs[(i + 1) % 4];
          const [x0, z0] = wpt(Tq, a0, b0), [x1, z1] = wpt(Tq, a1, b1);
          wallPos.push(x0, 0, z0, x1, 0, z1, x0, -D, z0, x1, 0, z1, x1, -D, z1, x0, -D, z0);
          for (const yy of [0, 0, -D, 0, -D, -D]) { const k = yy < 0 ? 1 : 0; wallCol.push(lerp(top.r, deep.r, k), lerp(top.g, deep.g, k), lerp(top.b, deep.b, k)); }
        }
        const q = cs.map(([a, b]) => wpt(Tq, a, b));
        for (const i of [0, 1, 2, 0, 2, 3]) { botPos.push(q[i][0], -D, q[i][1]); botUv.push(i === 0 || i === 3 ? 0 : 1, i < 2 ? 0 : 1); }
      }
      const wg = new T.BufferGeometry(); wg.setAttribute('position', new T.Float32BufferAttribute(wallPos, 3)); wg.setAttribute('color', new T.Float32BufferAttribute(wallCol, 3));
      meshOf(wg, new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide }), { receive: false, order: -2 });
      const ub = canvas(128, 128, (g) => {
        const gr = g.createRadialGradient(64, 64, 4, 64, 64, 90); gr.addColorStop(0, '#b06a30'); gr.addColorStop(0.45, '#5a2a0e'); gr.addColorStop(1, '#0a0302');
        g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
        g.strokeStyle = 'rgba(40,20,8,0.7)'; g.lineWidth = 4; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(0, 10 + i * 22); g.lineTo(128, 10 + i * 22); g.stroke(); }
        g.fillStyle = 'rgba(20,10,4,0.8)'; g.fillRect(40, 30, 48, 68); g.fillStyle = '#c82a20'; g.beginPath(); g.arc(64, 50, 9, 0, TAU); g.fill();
        g.beginPath(); g.moveTo(56, 44); g.lineTo(52, 32); g.lineTo(60, 42); g.moveTo(72, 44); g.lineTo(76, 32); g.lineTo(68, 42); g.fill();
      });
      const bg = new T.BufferGeometry(); bg.setAttribute('position', new T.Float32BufferAttribute(botPos, 3)); bg.setAttribute('uv', new T.Float32BufferAttribute(botUv, 2));
      meshOf(bg, new T.MeshBasicMaterial({ map: tex(ub, [1, 1], false), side: T.DoubleSide }), { receive: false, order: -2 });
      // leaves (two per trap, hinged on the long sides), their iron straps, the glowing cracks, the depth masks
      const plank = canvas(128, 128, (g) => { g.fillStyle = '#6a4a30'; g.fillRect(0, 0, 128, 128); const pr = K.rng(7105); for (let i = 0; i < 4; i++) { g.fillStyle = `rgba(${90 + pr() * 30},${60 + pr() * 20},${36 + pr() * 14},1)`; g.fillRect(0, i * 32 + 2, 128, 28); } g.fillStyle = 'rgba(20,10,4,0.8)'; for (let i = 0; i < 4; i++) g.fillRect(0, i * 32, 128, 2); });
      const leafMat = K.std({ map: tex(plank, [1, 1], true), roughness: 0.75 });
      const leafGeo = box(2 * TRAP.hw - 0.3, 0.28, 1);
      const strapGeo = BU.mergeGeometries([box(0.5, 0.3, 0.92).translate(-2.2, 0.02, 0), box(0.5, 0.3, 0.92).translate(2.2, 0.02, 0), new T.TorusGeometry(0.32, 0.08, 5, 10).rotateX(PI / 2).translate(0, 0.17, 0.25).toNonIndexed()].map((g) => (g.index ? g.toNonIndexed() : g)), false);
      const mk = (geo, mat, count, order) => { const im = new T.InstancedMesh(geo, mat, count); im.frustumCulled = false; im.renderOrder = order; im.castShadow = false; im.receiveShadow = true; K.group.add(im); return im; };
      A.leaves = mk(leafGeo, leafMat, n * 2, -2);
      A.straps = mk(strapGeo, K.metal(0x2a2a2e, 0.5), n * 2, -2);
      A.cracks = mk(flat(1, 1), new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), n, -2);
      A.masks = mk(flat(1, 1), new T.MeshBasicMaterial({ colorWrite: false }), n, -1);
      const rimTex = tex(canvas(128, 128, (g) => {
        g.fillStyle = '#000'; g.fillRect(0, 0, 128, 128);
        g.shadowColor = '#fff'; g.shadowBlur = 18; g.strokeStyle = '#fff'; g.lineWidth = 7;
        for (let k = 0; k < 3; k++) g.strokeRect(29, 33, 70, 62);
        g.shadowBlur = 0; g.fillStyle = '#000'; g.fillRect(34, 38, 60, 52);
      }), [1, 1], false);
      A.trapGlow = mk(flat(1, 1), addMat(rimTex), n, 2); A.trapGlow.receiveShadow = false;
      for (let i = 0; i < n; i++) { A.cracks.setColorAt(i, A.col.setRGB(0.02, 0.01, 0.0)); A.trapGlow.setColorAt(i, A.col.setRGB(0, 0, 0)); }
      // iron frames round each trap, flush with the boards
      for (const Tq of A.traps) {
        const f = frame(Tq.x, 0, Tq.z, -Tq.ang);
        f(box(2 * Tq.hw + 0.8, 0.12, 0.4), 0x3a3a40, { y: 0.06, z: -Tq.hd - 0.2 }, M.metal, false);
        f(box(2 * Tq.hw + 0.8, 0.12, 0.4), 0x3a3a40, { y: 0.06, z: Tq.hd + 0.2 }, M.metal, false);
        f(box(0.4, 0.12, 2 * Tq.hd), 0x3a3a40, { y: 0.06, x: -Tq.hw - 0.2 }, M.metal, false);
        f(box(0.4, 0.12, 2 * Tq.hd), 0x3a3a40, { y: 0.06, x: Tq.hw + 0.2 }, M.metal, false);
      }
      // red velvet ropes on brass stanchions along both sides (they keep you over the traps)
      for (const sd of [-1, 1]) {
        const sA = hz.trapA - 12, sB = hz.trapB + 12, nP = 8, pts = [];
        for (let k = 0; k < nP; k++) { const q = track.place(lerp(sA, sB, k / (nP - 1)), sd * 8.9); pts.push(q); }
        for (const q of pts) {
          put(cyl(0.9, 1.0, 0.3, 14), 0xc8a050, { x: q.x, y: 0.15, z: q.z }, M.gold);
          put(cyl(0.22, 0.22, 3.4, 8), 0xd8b060, { x: q.x, y: 1.9, z: q.z }, M.gold);
          put(sph(0.42, 10, 8), 0xe0c070, { x: q.x, y: 3.7, z: q.z }, M.gold);
          AO(q.x, q.z, 1.2, 1.2, 0.45);
        }
        for (let k = 0; k < nP - 1; k++) {
          const a = pts[k], b = pts[k + 1], seg = 6;
          for (let j = 0; j < seg; j++) {
            const t0 = j / seg, t1 = (j + 1) / seg, y0 = 3.3 - Math.sin(PI * t0) * 1.2, y1 = 3.3 - Math.sin(PI * t1) * 1.2;
            put(rod([lerp(a.x, b.x, t0), y0, lerp(a.z, b.z, t0)], [lerp(a.x, b.x, t1), y1, lerp(a.z, b.z, t1)], 0.26, 6), 0xa80c1c, {}, M.velvet);
          }
        }
        K.capsule(pts[0].x, pts[0].z, pts[nP - 1].x, pts[nP - 1].z, 0.6, 3.6);
      }
      // the trap room sign
      {
        const sc = canvas(256, 128, (g) => { g.fillStyle = '#1a0a0c'; g.fillRect(0, 0, 256, 128); g.strokeStyle = '#d8ac52'; g.lineWidth = 6; g.strokeRect(6, 6, 244, 116); g.fillStyle = '#f2d890'; g.textAlign = 'center'; g.font = '700 40px Georgia, serif'; g.fillText('TRAP ROOM', 128, 58); g.font = 'italic 24px Georgia, serif'; g.fillText('mind your step', 128, 96); });
        const q = track.place(hz.trapA - 16, 11.5);
        const f = frame(q.x, 0, q.z, 0);
        f(cyl(0.2, 0.2, 7, 8), 0xc8a050, { y: 3.5 }, M.gold);
        f(box(6.4, 3.2, 0.3), 0x1a0a0c, { y: 7.6 }, M.matte);
        const sm = meshOf(new T.PlaneGeometry(6.2, 3.1), K.std({ map: tex(sc, [1, 1], false), roughness: 0.6 }));
        sm.position.set(q.x, 7.6, q.z + 0.17);
        AO(q.x, q.z, 1, 1, 0.4);
      }
    }

    // ============================================================ flying flats over the east wing passage
    {
      const fc = canvas(1024, 640, (g) => {
        // A: a painted oak on a green hill
        let gr = g.createLinearGradient(0, 0, 0, 640); gr.addColorStop(0, '#7ab0e0'); gr.addColorStop(1, '#d8ecf4'); g.fillStyle = gr; g.fillRect(0, 0, 512, 640);
        g.fillStyle = '#5a9a4a'; g.beginPath(); g.moveTo(0, 640); g.lineTo(0, 520); g.quadraticCurveTo(256, 450, 512, 530); g.lineTo(512, 640); g.fill();
        g.fillStyle = '#5a3a22'; g.beginPath(); g.moveTo(226, 560); g.lineTo(240, 300); g.lineTo(272, 300); g.lineTo(290, 560); g.fill();
        g.strokeStyle = '#5a3a22'; g.lineWidth = 16; for (const [x, y] of [[170, 220], [350, 210], [256, 150]]) { g.beginPath(); g.moveTo(256, 330); g.lineTo(x, y); g.stroke(); }
        const fr = K.rng(7106);
        for (let i = 0; i < 90; i++) { const a = fr() * TAU, d = Math.sqrt(fr()) * 180; g.fillStyle = ['#2e6a30', '#3e8a3a', '#56a04a', '#24582a'][i % 4]; g.beginPath(); g.arc(256 + Math.cos(a) * d * 1.2, 220 + Math.sin(a) * d * 0.8, 30 + fr() * 30, 0, TAU); g.fill(); }
        for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(220,240,160,0.35)'; g.beginPath(); g.arc(170 + fr() * 200, 120 + fr() * 140, 6 + fr() * 10, 0, TAU); g.fill(); }
        g.strokeStyle = '#3a2a1a'; g.lineWidth = 14; g.strokeRect(7, 7, 498, 626);
        // B: a castle turret at dusk
        gr = g.createLinearGradient(0, 0, 0, 640); gr.addColorStop(0, '#3a2a6a'); gr.addColorStop(0.6, '#c86a8a'); gr.addColorStop(1, '#f2b070'); g.fillStyle = gr; g.fillRect(512, 0, 512, 640);
        g.fillStyle = '#8a8a96'; g.fillRect(652, 170, 230, 470);
        g.strokeStyle = 'rgba(40,40,60,0.5)'; g.lineWidth = 3;
        for (let y = 180; y < 640; y += 28) { g.beginPath(); g.moveTo(652, y); g.lineTo(882, y); g.stroke(); for (let x = 652 + ((y / 28) % 2) * 24; x < 882; x += 48) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 28); g.stroke(); } }
        g.fillStyle = '#8a8a96'; for (let k = 0; k < 5; k++) g.fillRect(640 + k * 52, 130, 34, 46);
        g.fillStyle = '#2a3a8a'; g.beginPath(); g.moveTo(630, 132); g.lineTo(767, 10); g.lineTo(904, 132); g.fill();
        g.strokeStyle = '#3a2a1a'; g.lineWidth = 4; g.beginPath(); g.moveTo(767, 12); g.lineTo(767, -10); g.stroke();
        g.fillStyle = '#e8303a'; g.beginPath(); g.moveTo(769, 0); g.lineTo(820, 14); g.lineTo(769, 28); g.fill();
        g.fillStyle = '#1a1a2a'; g.beginPath(); g.moveTo(732, 420); g.lineTo(732, 300); g.arc(767, 300, 35, PI, 0); g.lineTo(802, 420); g.fill();
        g.fillStyle = '#ffd070'; g.beginPath(); g.moveTo(740, 410); g.lineTo(740, 304); g.arc(767, 304, 27, PI, 0); g.lineTo(794, 410); g.fill();
        g.fillStyle = '#3a7a3a'; for (let i = 0; i < 50; i++) { g.beginPath(); g.arc(652 + fr() * 80, 400 + fr() * 240, 8 + fr() * 12, 0, TAU); g.fill(); }
        g.strokeStyle = '#3a2a1a'; g.lineWidth = 14; g.strokeRect(519, 7, 498, 626);
      });
      const flatTex = tex(fc, [1, 1], false);
      const fm = K.std({ map: flatTex, roughness: 0.82 });
      const timber = K.std({ color: 0x8a6a44, roughness: 0.7, map: ptex.map });
      const pipe = K.metal(0x2a2a30, 0.4);
      const blobMat = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, alphaMap: TX.blobShadowTexture(), depthWrite: false });
      for (let k = 0; k < 2; k++) {
        const s = hz.fly[k], p = track.place(s, FLY.lat[k]), ang = p.angle + PI / 2;
        const F = { k, trackS: s, x: p.x, z: p.z, ang, cs: Math.cos(ang), sn: Math.sin(ang), o: { x: p.x, z: p.z, angle: ang, h: 0 }, bell: -1 };
        K.mover({ type: 'box', hw: FLY.hw, hd: 0.45, h: 0 }, (t) => { F.o.h = flatBottom(k, t) < FLY.solid ? 16 : 0; return F.o; });
        const g = new T.Group(); g.position.set(p.x, FLY.top, p.z); g.rotation.y = -ang; K.group.add(g);
        const face = new T.PlaneGeometry(2 * FLY.hw - 0.3, FLY.hgt - 0.3);
        const uv = face.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, k * 0.5 + uv.getX(i) * 0.5);
        const fmsh = new T.Mesh(face, fm); fmsh.position.set(0, FLY.hgt / 2, 0.26); fmsh.castShadow = true; fmsh.receiveShadow = true; g.add(fmsh);
        const fr = new T.Mesh(BU.mergeGeometries([box(2 * FLY.hw, 0.5, 0.5).translate(0, 0.25, 0), box(2 * FLY.hw, 0.5, 0.5).translate(0, FLY.hgt - 0.25, 0), box(0.5, FLY.hgt, 0.5).translate(-FLY.hw + 0.25, FLY.hgt / 2, 0), box(0.5, FLY.hgt, 0.5).translate(FLY.hw - 0.25, FLY.hgt / 2, 0), box(0.4, FLY.hgt, 0.3).translate(0, FLY.hgt / 2, -0.2), box(2 * FLY.hw, 0.4, 0.3).translate(0, FLY.hgt / 2, -0.2)], false), timber);
        fr.castShadow = true; g.add(fr);
        const bat = new T.Mesh(BU.mergeGeometries([cyl(0.35, 0.35, 2 * FLY.hw + 6, 10).rotateZ(PI / 2).translate(0, FLY.hgt + 2.2, 0), cyl(0.06, 0.06, 2.2, 4).translate(-FLY.hw + 1, FLY.hgt + 1.1, 0), cyl(0.06, 0.06, 2.2, 4).translate(FLY.hw - 1, FLY.hgt + 1.1, 0), cyl(0.07, 0.07, 70, 4).translate(-FLY.hw - 1.5, FLY.hgt + 37, 0), cyl(0.07, 0.07, 70, 4).translate(FLY.hw + 1.5, FLY.hgt + 37, 0)], false), pipe);
        bat.castShadow = true; g.add(bat);
        F.g = g;
        const blob = new T.Mesh(flat(1, 1), blobMat.clone()); blob.position.set(p.x, 0.07, p.z); blob.rotation.y = -ang; blob.scale.set(2 * FLY.hw + 3, 1, 5); blob.renderOrder = 1; K.group.add(blob);
        F.blob = blob;
        {
          const hc = canvas(256, 32, (g2) => { g2.fillStyle = '#f2c81e'; g2.fillRect(0, 0, 256, 32); g2.fillStyle = '#16120c'; for (let x = -32; x < 256; x += 32) { g2.beginPath(); g2.moveTo(x, 32); g2.lineTo(x + 16, 32); g2.lineTo(x + 32, 0); g2.lineTo(x + 16, 0); g2.fill(); } });
          if (!A.hazardMat) A.hazardMat = K.std({ map: tex(hc, [1, 1], true), roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
          for (const dz of [-1.0, 1.0]) {
            const hm = new T.Mesh(new T.PlaneGeometry(2 * FLY.hw, 0.7).rotateX(-PI / 2), A.hazardMat);
            hm.position.set(p.x - Math.sin(ang) * dz, 0.06, p.z + Math.cos(ang) * dz); hm.rotation.y = -ang; hm.receiveShadow = true; hm.renderOrder = 1; K.group.add(hm);
          }
        }
        // the cue light on the wing wall: red = standby, green = go
        const cx = 128.6, cz = p.z + (k ? -1.2 : 1.2);
        put(box(1.4, 2.6, 0.9), 0x1a1a1e, { x: cx, y: 5.6, z: cz }, M.metal);
        put(cyl(0.12, 0.12, 5, 6), 0x2a2a2e, { x: cx, y: 2.3, z: cz }, M.metal);
        const red = new T.Mesh(sph(0.5, 10, 8), new T.MeshBasicMaterial({ color: 0x300000, toneMapped: false })); red.position.set(cx, 7.1, cz); K.group.add(red);
        const grn = new T.Mesh(sph(0.5, 10, 8), new T.MeshBasicMaterial({ color: 0x003000, toneMapped: false })); grn.position.set(cx, 7.1, cz + (k ? -1.1 : 1.1)); K.group.add(grn);
        F.red = red.material; F.grn = grn.material;
        A.flats.push(F);
      }
    }

    // ============================================================ the sandbag in the west wing
    {
      const pB = track.at(hz.bag);
      A.bag = { x: pB.x, z: pB.z, o: { x1: pB.x - 0.6, z1: pB.z, x2: pB.x + 0.6, z2: pB.z } };
      K.mover({ type: 'capsule', r: 1.5, h: 6 }, (t) => { const bx = A.bag.x + BAG.len * Math.sin(bagAngle(t)); A.bag.o.x1 = bx - 0.6; A.bag.o.x2 = bx + 0.6; return A.bag.o; });
      const piv = new T.Group(); piv.position.set(pB.x, BAG.piv, pB.z); K.group.add(piv);
      const rope = new T.Mesh(cyl(0.16, 0.16, BAG.len - 1.4, 5), K.std({ color: 0xd8c8a0, roughness: 0.9 })); rope.position.y = -(BAG.len - 1.4) / 2; rope.castShadow = true; piv.add(rope);
      const sack = new T.Mesh(K.lathe([[0.01, -1.9], [1.1, -1.7], [1.55, -0.8], [1.5, 0.6], [1.0, 1.3], [0.45, 1.7], [0.6, 1.95], [0.01, 2.0]], 16), K.std({ color: 0xc8aa78, roughness: 0.95, map: ptex.map }));
      sack.position.y = -BAG.len; sack.castShadow = true; piv.add(sack);
      const knot = new T.Mesh(new T.TorusGeometry(0.4, 0.14, 5, 10), K.std({ color: 0xb89a70, roughness: 0.9 })); knot.position.y = -BAG.len + 1.85; knot.rotation.x = PI / 2; piv.add(knot);
      A.bagG = piv;
      const sh = new T.Mesh(flat(1, 1), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, alphaMap: TX.blobShadowTexture(), depthWrite: false, opacity: 0.5 }));
      sh.scale.set(4.4, 1, 3.6); sh.position.set(pB.x, 0.07, pB.z); sh.renderOrder = 1; K.group.add(sh); A.bagSh = sh;
      // the prop table on the inside of the bend (and the stage manager's lamp on it)
      const f = frame(-108, 0, -48, 0.3);
      f(box(12, 0.5, 6), 0x4a3424, { y: 4 }, M.wood);
      for (const [x, z] of [[-5.6, -2.6], [5.6, -2.6], [-5.6, 2.6], [5.6, 2.6]]) f(box(0.5, 4, 0.5), 0x3a2818, { x, y: 2, z }, M.wood);
      f(box(11, 0.1, 5), 0xf2eee0, { y: 4.3 }, M.matte, false);
      f(K.lathe([[0.01, 0], [1.0, 0], [0.7, 0.3], [0.4, 1.4], [1.0, 2.1], [0.9, 2.2], [0.01, 2.2]], 14), 0xd8ac52, { x: -3, y: 4.3, z: 0 }, M.gold); // goblet
      f(sph(1.1, 12, 8), 0xece4d4, { x: 0, y: 5.3, z: 0.8, sy: 1.1 }, M.paint); // a skull
      f(box(0.7, 0.5, 0.4), 0x1a1a1a, { x: -0.4, y: 5.4, z: 1.75 }, M.matte); f(box(0.7, 0.5, 0.4), 0x1a1a1a, { x: 0.45, y: 5.4, z: 1.75 }, M.matte);
      f(new T.CylinderGeometry(1.4, 1.4, 1.0, 5, 1, true), 0xe8c050, { x: 3, y: 4.9, z: -1 }, M.gold); // a crown
      f(box(0.3, 0.2, 7), 0xc8ccd4, { x: 2.5, y: 4.45, z: 1.6, ry: 1.2 }, M.metal); // a sword
      f.box(0, 0, 6.2, 3.2, 5);
      AO(-108, -48, 7.5, 4.5, 0.5, -0.3);
    }

    // ============================================================ stage blood and spilt glitter (slick, off the line)
    {
      const bloodMat = K.phys({ color: 0x6a0410, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03 });
      const bp = track.place(sAt(40, 16), -7.0);
      const bl = K.spill(bp.x, bp.z, 3.4, bloodMat, { lump: 0.42, stretch: 1.8, angle: bp.angle, y: 0.08, thick: 0.12 });
      K.surface('slick', { poly: bl.poly });
      for (let i = 0; i < 5; i++) { const q = track.place(sAt(40, 16) - 6 - i * 2.6, -6.5 + r.range(-1, 1)); K.spill(q.x, q.z, r.range(0.4, 0.9), bloodMat, { y: 0.07, thick: 0.08, n: 14 }); }
      // the victim: a cardboard king lying in the wings with a prop dagger
      actor(bp.x + 3, bp.z + 8, 0.4, 3, 1, { lie: true });
      put(box(3.2, 0.2, 0.5), 0xc8ccd4, { x: bp.x + 1, y: 0.25, z: bp.z + 5, ry: 0.8 }, M.metal);
      put(box(0.4, 0.3, 1.4), 0xd8ac52, { x: bp.x - 0.4, y: 0.3, z: bp.z + 6.3, ry: 0.8 }, M.gold);
      // glitter from a tipped confetti cannon near the proscenium (and sparkles in it)
      const gp = track.place(sAt(98, -74), 7.0);
      const glitMat = K.phys({ color: 0xff6ab8, roughness: 0.18, metalness: 0.5, clearcoat: 1, iridescence: 1, iridescenceIOR: 1.7, iridescenceThicknessRange: [200, 800] });
      const gl = K.spill(gp.x, gp.z, 3.3, glitMat, { lump: 0.5, stretch: 1.7, angle: gp.angle, y: 0.06, thick: 0.06 });
      K.surface('slick', { poly: gl.poly });
      const spk = [];
      for (let i = 0; i < 160; i++) { const a = r() * TAU, d = Math.sqrt(r()) * 5.2; spk.push({ x: gp.x + Math.cos(a) * d * 1.5, y: 0.1, z: gp.z + Math.sin(a) * d * 0.9, ry: r() * TAU, s: r.range(0.12, 0.26), color: r.pick([0xffd040, 0xff4ab0, 0x7ae0ff, 0xffffff, 0xb070ff]) }); }
      K.instances(box(1, 0.08, 1), K.std({ metalness: 1, roughness: 0.18 }), spk, { colors: true, cast: false });
      const f = frame(gp.x + 4, 0, gp.z - 6.5, 0.5);
      f(cyl(1.0, 1.4, 6, 14).rotateZ(PI / 2 - 0.15), 0xd8ac52, { y: 1.3 }, M.gold);
      f(cyl(1.5, 1.5, 0.5, 14).rotateZ(PI / 2 - 0.15), 0xb01828, { x: -3.0, y: 1.0 }, M.paint);
      f.circ(0, 0, 2.6, 2.6);
      AO(gp.x + 4, gp.z - 6.5, 3.8, 2.2, 0.4, -0.5);
    }

    // ============================================================ the infield: ground rows, set pieces, the designer's tools
    {
      // ground rows between the two revolve legs: painted waves (east; they rock) and a hedge (west)
      const waveC = canvas(512, 96, (g) => {
        g.clearRect(0, 0, 512, 96);
        for (let k = 0; k < 3; k++) {
          g.fillStyle = ['#2a6ab8', '#3a8ad8', '#6ab4f0'][k];
          g.beginPath(); g.moveTo(0, 96);
          for (let x = 0; x <= 512; x += 8) g.lineTo(x, 40 + k * 14 - Math.max(0, Math.sin(x * 0.04 + k * 1.7)) * 30);
          g.lineTo(512, 96); g.fill();
          g.fillStyle = 'rgba(240,250,255,0.9)';
          for (let x = 0; x < 512; x += 157) { g.beginPath(); g.arc(x + 40 + k * 20, 40 + k * 14 - 28, 7, 0, TAU); g.fill(); }
        }
      });
      const waveMat = K.std({ map: tex(waveC, [1, 1], false), alphaTest: 0.4, side: T.DoubleSide, roughness: 0.6 });
      for (let k = 0; k < 3; k++) {
        const m = new T.Mesh(new T.PlaneGeometry(27, 5), waveMat); m.position.set(32, 2.2, -2 + (k - 1) * 2.1); m.castShadow = true; K.group.add(m);
        A.waves.push({ m, ph: k * 1.9, z: -2 + (k - 1) * 2.1 });
      }
      put(box(28, 0.6, 7), 0x2a2a30, { x: 32, y: 0.3, z: -2 }, M.matte);
      K.box(32, -2, 14, 3.6, 0, 3.5);
      AO(32, -2, 15, 4.5, 0.4);
      const hedgeC = canvas(512, 96, (g) => {
        g.clearRect(0, 0, 512, 96);
        const hr = K.rng(7107);
        for (let i = 0; i < 110; i++) { g.fillStyle = ['#4a8a3a', '#5aa048', '#6ab452', '#3a7a34'][i % 4]; g.beginPath(); g.arc(hr() * 512, 50 + hr() * 46, 14 + hr() * 14, 0, TAU); g.fill(); }
        for (let i = 0; i < 40; i++) { g.fillStyle = ['#f4f0f0', '#f080a0', '#f2d040'][i % 3]; g.beginPath(); g.arc(hr() * 512, 48 + hr() * 40, 3, 0, TAU); g.fill(); }
      });
      const hm = new T.Mesh(new T.PlaneGeometry(40, 6), K.std({ map: tex(hedgeC, [1, 1], false), alphaTest: 0.4, side: T.DoubleSide, roughness: 0.85, emissive: 0x0c1a08 }));
      hm.position.set(-82, 2.6, -2); hm.castShadow = true; K.group.add(hm);
      put(box(40, 0.6, 4), 0x2a2a30, { x: -82, y: 0.3, z: -2 }, M.matte);
      put(box(40, 2.2, 0.4), 0x3a2a1c, { x: -82, y: 1.1, z: -1.4 }, M.wood);
      K.box(-82, -2, 20, 2.6, 0, 3.5);
      AO(-82, -2, 21, 3.5, 0.4);
      // the king's throne on a rostrum, upstage
      {
        const f = frame(58, 0, -46, 0);
        f(box(16, 2.2, 10), 0x3a2a24, { y: 1.1 }, M.wood);
        f(box(16.2, 0.2, 10.2), 0x8a0c18, { y: 2.25 }, M.velvet);
        f(box(1.6, 1.0, 10), 0x3a2a24, { x: -8.8, y: 0.5 }, M.wood);
        f(box(5, 1.4, 4.4), 0xd8ac52, { y: 3.4 }, M.gold);
        f(box(4.4, 0.6, 4), 0x8a0c18, { y: 4.4 }, M.velvet);
        f(box(5.2, 8, 0.8), 0xd8ac52, { y: 6.6, z: -2.2 }, M.gold);
        f(box(4.2, 6.4, 0.3), 0x8a0c18, { y: 6.8, z: -1.7 }, M.velvet);
        f(sph(0.8, 10, 8), 0xe8c060, { x: -2.4, y: 11, z: -2.2 }, M.gold); f(sph(0.8, 10, 8), 0xe8c060, { x: 2.4, y: 11, z: -2.2 }, M.gold);
        f(cyl(1.6, 1.6, 1.2, 5, 1, true), 0xe8c050, { y: 11.4, z: -2.2 }, M.gold);
        for (const sd of [-1, 1]) f(box(0.8, 3, 4), 0xd8ac52, { x: sd * 2.6, y: 4.6 }, M.gold);
        f.box(0, 0, 8.8, 5, 12);
        AO(58, -46, 10, 6.5, 0.5);
        actor(46, -44, 0.3, 0, 1);
        actor(70, -44, -0.3, 2, 1);
      }
      // the grand piano, upstage left, lid up
      {
        const f = frame(-62, 0, -46, 0.25);
        const ps = new T.Shape(); ps.moveTo(-6, -2.6); ps.lineTo(5, -2.6); ps.quadraticCurveTo(8.5, -2.4, 8.5, 0); ps.quadraticCurveTo(8.2, 2.6, 4, 2.6); ps.lineTo(-6, 2.6); ps.closePath();
        const pg = new T.ExtrudeGeometry(ps, { depth: 2.2, bevelEnabled: false }); pg.rotateX(-PI / 2);
        f(pg, 0x0c0c0e, { y: 3.6 }, M.gloss);
        f(box(1.4, 0.3, 5), 0xf4f0e8, { x: -6.6, y: 4.5 }, M.paint);
        for (let k = 0; k < 9; k++) f(box(0.25, 0.32, 0.32), 0x0a0a0a, { x: -6.6, y: 4.62, z: -2.2 + k * 0.55 }, M.matte);
        for (const [x, z] of [[-5.4, -2], [-5.4, 2], [6.5, 0]]) f(cyl(0.35, 0.3, 3.6, 8), 0x0c0c0e, { x, y: 1.8, z }, M.gloss);
        const lid = new T.ExtrudeGeometry(ps, { depth: 0.2, bevelEnabled: false }); lid.rotateX(-PI / 2);
        f(lid, 0x0c0c0e, { y: 5.9, z: -0.2, rx: -0.55, order: 'XYZ' }, M.gloss);
        f(box(3.6, 0.4, 1.6), 0x0c0c0e, { x: -8.6, y: 2.4 }, M.gloss);
        f.box(0.5, 0, 7.4, 3.0, 8);
        AO(-62, -46, 9, 4.5, 0.5, -0.25);
        actor(-74, -40, 0.6, 8, 1);
      }
      // the ghost light: a bare bulb in a cage on a stand, centre stage at the back
      {
        const x = 8, z = -48;
        put(cyl(1.1, 1.3, 0.5, 16), 0x6a6a70, { x, y: 0.25, z }, M.metal);
        put(cyl(0.18, 0.18, 9, 8), 0x2a2a2e, { x, y: 4.8, z }, M.metal);
        put(sph(0.8, 12, 10), [2.4, 2.1, 1.5], { x, y: 10.2, z }, M.glow);
        for (let k = 0; k < 6; k++) put(new T.TorusGeometry(1.15, 0.05, 4, 16), 0x3a3a40, { x, y: 10.2, z, ry: (k / 6) * PI, rx: PI / 2, order: 'YXZ' }, M.metal);
        BULB(x, 10.2, z, 0xffd8a0, 0.01, 7);
        K.circle(x, z, 2.2, 10);
        AO(x, z, 2.6, 2.6, 0.5);
        POOL(x, z + 2, 12, 10, 0xffc888, 0.35);
      }
      // a chaise longue, a costume rail and the opening-night easel in the downstage infield
      {
        const f = frame(62, 0, 37, -0.2);
        f(rbox(12, 2.2, 4.4, 0.6), 0x8a0c18, { y: 2.2 }, M.velvet);
        f(rbox(3, 5.2, 4.4, 0.8), 0x8a0c18, { x: -5.4, y: 3.4 }, M.velvet);
        f(rbox(8, 2.6, 1, 0.4), 0x8a0c18, { x: -1.2, y: 4.2, z: -2 }, M.velvet);
        for (const [x, z] of [[-5.4, -1.8], [5.4, -1.8], [-5.4, 1.8], [5.4, 1.8]]) f(cyl(0.3, 0.2, 1.4, 6), 0xd8ac52, { x, y: 0.7, z }, M.gold);
        f.box(0, 0, 6.6, 2.4, 6);
        AO(62, 37, 7.5, 3.2, 0.5, 0.2);
        actor(74, 34, -0.4, 4, 1);
      }
      {
        const f = frame(104, 0, 33, 0.1);
        for (const sd of [-1, 1]) { f(cyl(0.2, 0.2, 9, 8), 0xb8bcc4, { x: sd * 7, y: 4.5 }, M.metal); f(box(1.6, 0.3, 3.4), 0x2a2a2e, { x: sd * 7, y: 0.2 }, M.metal); }
        f(cyl(0.2, 0.2, 14.4, 8).rotateZ(PI / 2), 0xb8bcc4, { y: 9 }, M.metal);
        const cc = [0x8a0c18, 0x2a4a8a, 0xd8ac52, 0x2a6a3a, 0xf0e8f0, 0x5a2a6a, 0x1a1a1e];
        for (let k = 0; k < 7; k++) {
          const x = -5.4 + k * 1.8;
          f(new T.ConeGeometry(1.6, 6.4, 8, 1, true), cc[k], { x, y: 5.4, rz: 0.04 * (k - 3) }, M.velvet);
          f(new T.TorusGeometry(0.4, 0.06, 4, 10, PI), 0xb8bcc4, { x, y: 8.9, rz: 0 }, M.metal);
        }
        f.box(0, 0, 7.6, 2, 9);
        AO(104, 33, 8.2, 2.6, 0.45, -0.1);
      }
      {
        const pc = canvas(256, 384, (g) => {
          g.fillStyle = '#7a0a14'; g.fillRect(0, 0, 256, 384); g.strokeStyle = '#e0b860'; g.lineWidth = 8; g.strokeRect(10, 10, 236, 364); g.lineWidth = 2; g.strokeRect(20, 20, 216, 344);
          g.fillStyle = '#f6e0a0'; g.textAlign = 'center'; g.font = '30px "Lilita One", Georgia, serif'; g.fillText('OPENING', 128, 74); g.fillText('NIGHT', 128, 110);
          g.fillStyle = '#f4f0e6'; g.beginPath(); g.ellipse(100, 200, 32, 40, -0.2, 0, TAU); g.fill(); g.fillStyle = '#e0b860'; g.beginPath(); g.ellipse(156, 206, 32, 40, 0.2, 0, TAU); g.fill();
          g.fillStyle = '#2a0a0c'; for (const [x, y] of [[88, 190], [110, 186], [146, 196], [168, 196]]) { g.beginPath(); g.ellipse(x, y, 6, 8, 0, 0, TAU); g.fill(); }
          g.lineWidth = 4; g.strokeStyle = '#2a0a0c'; g.beginPath(); g.arc(100, 222, 12, PI + 0.4, -0.4); g.stroke(); g.beginPath(); g.arc(156, 216, 12, 0.4, PI - 0.4); g.stroke();
          g.fillStyle = '#f6e0a0'; g.font = 'italic 22px Georgia, serif'; g.fillText('a new comedy', 128, 290); g.font = '700 22px Georgia, serif'; g.fillText('TONIGHT 7.30', 128, 330);
        });
        const p = track.place(START_S + 4, -12.5);
        const f = frame(p.x, 0, p.z, 0);
        f(box(0.5, 9.5, 0.5), 0x6a4a30, { x: -2.4, y: 4.6, z: 0.6, rz: 0.08 }, M.wood);
        f(box(0.5, 9.5, 0.5), 0x6a4a30, { x: 2.4, y: 4.6, z: 0.6, rz: -0.08 }, M.wood);
        f(box(0.5, 9.5, 0.5), 0x6a4a30, { y: 4.4, z: -1.6, rx: -0.3 }, M.wood);
        f(box(6.4, 0.4, 0.8), 0x6a4a30, { y: 3.2, z: 0.9 }, M.wood);
        const pm = meshOf(new T.PlaneGeometry(5.6, 8.4), K.std({ map: tex(pc, [1, 1], false), roughness: 0.55 }), { cast: true });
        pm.position.set(p.x, 7.6, p.z + 0.8); pm.rotation.x = -0.12;
        f.circ(0, 0, 1.6, 9);
        AO(p.x, p.z, 3.2, 2, 0.4);
      }
      // the designer's real tools left lying on the model: a scale rule, pencils, a scalpel, fabric swatches
      {
        const rc = canvas(1024, 64, (g) => {
          g.fillStyle = '#d8dade'; g.fillRect(0, 0, 1024, 64); g.fillStyle = '#1a1a1a';
          for (let i = 0; i <= 300; i++) { const x = 12 + i * 3.33, h = i % 10 === 0 ? 26 : i % 5 === 0 ? 18 : 10; g.fillRect(x, 0, 1.4, h); }
          g.font = '700 16px Rubik, sans-serif'; for (let i = 0; i <= 30; i++) g.fillText(String(i), 8 + i * 33.3, 44);
          g.font = '700 18px Rubik, sans-serif'; g.fillText('1:25', 960, 58);
        });
        const rm = K.std({ map: tex(rc, [1, 1], false), metalness: 0.4, roughness: 0.35 });
        const side = K.std({ color: 0xb8bcc4, metalness: 0.6, roughness: 0.35 });
        const ruler = meshOf(box(32, 1.0, 3.2), [side, side, rm, side, side, side], { cast: true }); ruler.position.set(-26, 0.5, 43.5); ruler.rotation.y = 0.05;
        K.box(-26, 43.5, 16.2, 1.7, -0.05, 1.6);
        AO(-26, 43.5, 17, 2.2, 0.5, 0.05);
        const pencil = (x, z, ry, col, len = 17) => {
          const f = frame(x, 0.42, z, ry);
          f(cyl(0.42, 0.42, len - 2.4, 6).rotateZ(PI / 2), col, { x: 0.6 }, M.paint);
          f(new T.ConeGeometry(0.42, 2.0, 6).rotateZ(-PI / 2), 0xe8c9a0, { x: len / 2 + 0.4 }, M.wood);
          f(new T.ConeGeometry(0.14, 0.6, 6).rotateZ(-PI / 2), 0x2a2a2a, { x: len / 2 + 1.25 }, M.matte);
          f(cyl(0.45, 0.45, 1.0, 10).rotateZ(PI / 2), 0xc8ccd0, { x: -len / 2 + 1.0 }, M.metal);
          f(cyl(0.44, 0.44, 0.9, 10).rotateZ(PI / 2), 0xe89090, { x: -len / 2 + 0.1 }, M.paint);
          AO(x, z, len / 2, 0.9, 0.45, -ry);
          const [ax, az] = f.pt(-len / 2, 0), [bx, bz] = f.pt(len / 2, 0);
          K.capsule(ax, az, bx, bz, 0.5, 1.0);
        };
        pencil(98, -12, 0.5, 0xf2c020); pencil(-130, 66, -0.3, 0x2a8a4a); pencil(30, 42, 3.0, 0x2a4ab0);
        // the scalpel and a cut-off strip of card in the upstage corner
        put(box(7, 0.5, 0.8), 0x2a2a30, { x: 120, y: 0.25, z: -86, ry: 0.2 }, M.metal);
        put(box(2.6, 0.12, 0.7), 0xd8dce4, { x: 115.2, y: 0.25, z: -85, ry: 0.2 }, M.metal);
        put(box(14, 0.15, 2.2), 0xf0ece0, { x: -128, y: 0.08, z: -90, ry: 0.6 }, M.matte, false);
        // fabric swatches pinned to cards
        const swC = canvas(512, 128, (g) => {
          const sw = [['#8a0c18', 'curtain'], ['#d8ac52', 'pelmet'], ['#2a4a8a', 'act II sky'], ['#2a6a3a', 'hedge']];
          sw.forEach(([c, t], i) => {
            const x0 = i * 128; g.fillStyle = '#f4efe2'; g.fillRect(x0, 0, 128, 128);
            g.fillStyle = c; g.fillRect(x0 + 10, 8, 108, 86);
            g.fillStyle = 'rgba(255,255,255,0.18)'; for (let k = 0; k < 9; k++) g.fillRect(x0 + 10 + k * 12, 8, 4, 86);
            g.fillStyle = '#2a2a3a'; g.font = 'italic 18px Georgia, serif'; g.textAlign = 'center'; g.fillText(t, x0 + 64, 118);
          });
        });
        const swMat = K.std({ map: tex(swC, [1, 1], false), roughness: 0.9 });
        const sg = [];
        for (const [x, z, ry, i] of [[-140, 84, 0.3, 0], [-128, 88, -0.2, 1], [150, 54, 0.6, 2], [146, -92, -0.4, 3], [-88, 46, 0.2, 2]]) {
          const g = new T.PlaneGeometry(7, 7).rotateX(-PI / 2);
          const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setX(k, (i + uv.getX(k)) / 4);
          g.rotateY(ry).translate(x, 0.1 + sg.length * 0.01, z); sg.push(g);
        }
        meshOf(BU.mergeGeometries(sg, false), swMat, { order: 1 });
      }
    }

    // ============================================================ footlights and the orchestra pit
    {
      // footlight hood (a low curved trough) along the downstage edge and round the apron
      const fpts = [];
      for (let x = PIT.x0 + 1; x <= -APR.rx; x += 2.4) fpts.push([x, FRONT - 0.9, 0]);
      for (let i = 0; i <= 40; i++) { const a = PI - (PI * i) / 40; fpts.push([(APR.rx - 0.9) * Math.cos(a), FRONT + (APR.rz - 0.9) * Math.sin(a), -a + PI / 2]); }
      for (let x = APR.rx; x <= PIT.x1 - 1; x += 2.4) fpts.push([x, FRONT - 0.9, 0]);
      const fb = [];
      for (let i = 0; i < fpts.length - 1; i++) {
        const [ax, az] = fpts[i], [bx, bz] = fpts[i + 1], l = Math.hypot(bx - ax, bz - az), ang = Math.atan2(bz - az, bx - ax);
        put(box(l + 0.05, 0.7, 0.35), 0x18181c, { x: (ax + bx) / 2 - Math.sin(ang) * 0.35, y: 0.35, z: (az + bz) / 2 + Math.cos(ang) * 0.35, ry: -ang }, M.metal, false);
        fb.push({ x: (ax + bx) / 2, y: 0.32, z: (az + bz) / 2, s: 0.32 });
      }
      const fbm = K.instances(sph(1, 8, 6), new T.MeshBasicMaterial({ color: new T.Color(0xffc070).multiplyScalar(2.2), toneMapped: false }), fb, { cast: false, receive: false });
      fbm.renderOrder = 1;
      // a warm strip of light thrown up the stage by the footlights
      {
        const gc = canvas(16, 128, (g) => { const q = g.createLinearGradient(0, 0, 0, 128); q.addColorStop(0, 'rgba(255,255,255,0)'); q.addColorStop(0.55, 'rgba(255,255,255,0.35)'); q.addColorStop(0.9, 'rgba(255,255,255,1)'); q.addColorStop(1, 'rgba(255,255,255,0.6)'); g.fillStyle = q; g.fillRect(0, 0, 16, 128); });
        const pos = [], uv = [], idx = [];
        fpts.forEach(([x, z], i) => {
          const [bx, bz] = fpts[Math.min(i + 1, fpts.length - 1)], [ax, az] = fpts[Math.max(i - 1, 0)];
          const tx = bx - ax, tz = bz - az, l = Math.hypot(tx, tz) || 1, nx = -tz / l, nz = tx / l;
          pos.push(x - nx * 9, 0.07, z - nz * 9, x + nx * 0.2, 0.07, z + nz * 0.2); uv.push(0, 0, 0, 1);
          if (i < fpts.length - 1) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
        });
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
        meshOf(g, addMat(tex(gc, [1, 1], false), { color: new T.Color(0xffa850).multiplyScalar(0.5), side: T.DoubleSide }), { receive: false, order: 2 });
      }
      // the pit: chairs and music stands with little lamps, timpani, a harp, the podium and the musicians
      const chairs = [], stands = [];
      for (let row = 0; row < 3; row++) for (let k = 0; k < 14; k++) {
        const x = -104 + k * 16 + (row % 2) * 8 + r.range(-1.5, 1.5), z = 75.5 + row * 5.2 + r.range(-0.6, 0.6);
        if (Math.abs(x) < APR.rx + 4 && z < FRONT + APR.rz + 2) continue;
        chairs.push({ x, y: BASE, z, ry: PI + r.range(-0.3, 0.3) });
        stands.push({ x: x + r.range(-0.4, 0.4), y: BASE, z: z - 2.6, ry: PI + r.range(-0.2, 0.2) });
      }
      const chairG = BU.mergeGeometries([box(2, 0.3, 2).translate(0, 2.0, 0), box(2, 2.4, 0.25).translate(0, 3.3, 0.95), ...[[-0.85, -0.85], [0.85, -0.85], [-0.85, 0.85], [0.85, 0.85]].map(([x, z]) => box(0.2, 2, 0.2).translate(x, 1, z))], false);
      K.instances(chairG, K.std({ color: 0x2a2226, roughness: 0.7 }), chairs, { cast: true });
      const standG = BU.mergeGeometries([cyl(0.08, 0.08, 4.4, 5).translate(0, 2.2, 0), box(2.2, 1.6, 0.1).translate(0, 4.6, 0).rotateX(0.35), cyl(0.6, 0.6, 0.1, 8).translate(0, 0.05, 0)].map((g) => (g.index ? g.toNonIndexed() : g)), false);
      K.instances(standG, K.metal(0x1a1a1e, 0.5), stands, { cast: true });
      for (const s of stands) { BULB(s.x, BASE + 5.5, s.z - 0.3, 0xffd890, 0.12, 2.2); POOL(s.x, s.z + 1, 2.6, 2.6, 0xffc070, 0.45, 0, BASE + 0.1); }
      const t2 = [[-108, 84], [-100, 86]];
      for (const [x, z] of t2) { put(K.lathe([[0.01, 0], [1.2, 0.2], [2.4, 1.6], [2.6, 3.0], [0.01, 3.0]], 18), 0xc87a3a, { x, y: BASE + 1.4, z }, M.gold); put(cyl(2.7, 2.7, 0.1, 18), 0xf0e8d8, { x, y: BASE + 4.45, z }, M.paint); }
      {
        const f = frame(104, BASE, 84, -0.3);
        f(box(3, 1.2, 2.4), 0xb07a3a, { y: 0.6 }, M.wood);
        f(rod([-1.0, 1.2, 0], [-1.2, 12, 0], 0.35), 0xd8ac52, {}, M.gold);
        f(rod([-1.2, 12, 0], [2.6, 10.4, 0], 0.4), 0xd8ac52, {}, M.gold);
        f(rod([1.0, 1.2, 0], [2.6, 10.4, 0], 0.5), 0xb07a3a, {}, M.wood);
        for (let k = 0; k < 9; k++) f(rod([-1.05 + k * 0.05, 2 + k * 0.2, 0], [-1.1 + k * 0.42, 11.6 - k * 0.15, 0], 0.03, 3), 0xf0e8d0, {}, M.matte, false);
      }
      put(box(5, 1.6, 4), 0x3a2a24, { x: 0, y: BASE + 0.8, z: 87.5 }, M.wood);
      actor(0, 87.5, PI, 9, 1, { y: BASE + 1.6, noStand: true });
      for (const [x, k] of [[-70, 8], [-52, 8], [44, 8], [62, 8], [86, 8]]) actor(x, 80.5 + r.range(-1, 3), PI + r.range(-0.2, 0.2), k, 0.9, { y: BASE, noStand: true });
      put(box(PIT.x1 - PIT.x0 - 2, 0.1, ST.z1 - FRONT - 2), 0x2a1416, { x: 0, y: BASE + 0.05, z: (FRONT + ST.z1) / 2 }, M.matte, false);
      // the first rows of the stalls beyond the rail (red velvet seats)
      const seats = [];
      for (let row = 0; row < 3; row++) for (let k = 0; k < 44; k++) { const x = -106 + k * 4.9; if (Math.abs(x) < 4) continue; seats.push({ x, y: -4.6, z: 97 + row * 4.4 }); }
      const seatG = BU.mergeGeometries([rbox(3.8, 1.0, 2.6, 0.3).translate(0, 1.4, 0), rbox(3.8, 3.4, 0.6, 0.25).translate(0, 2.6, 1.3), box(0.4, 2.4, 2.8).translate(-2, 1.2, 0.2), box(0.4, 2.4, 2.8).translate(2, 1.2, 0.2)].map((g) => (g.index ? g.toNonIndexed() : g)), false);
      K.instances(seatG, K.phys({ color: 0x8a0c18, roughness: 0.8, sheen: 1, sheenColor: new T.Color(0xff6070) }), seats, { cast: true });
    }

    // ============================================================ the prompt box, a costume trunk, a cut-out moon, hat boxes, the stage manager's desk
    {
      // the prompter's hood at the tip of the apron (the prompter peeks out at the stage)
      const x = 0, z = FRONT + APR.rz - 2.6;
      put(new T.SphereGeometry(3.4, 24, 10, 0, PI, 0, PI / 2), 0x1a1214, { x, y: 0, z }, M.matte);
      put(new T.TorusGeometry(3.4, 0.35, 8, 24, PI).rotateX(PI / 2), 0xd8ac52, { x, y: 0.15, z }, M.gold);
      put(new T.TorusGeometry(3.35, 0.3, 8, 24, PI), 0xd8ac52, { x, y: 0, z }, M.gold);
      put(sph(0.5, 10, 8), 0xd8ac52, { x, y: 3.5, z: z + 0.6 }, M.gold);
      BULB(x - 1.6, 1.2, z - 1.6, 0xffd890, 0.01, 2.4);
      K.circle(x, z, 3.2, 4);
      AO(x, z - 0.4, 3.6, 2.2, 0.45);
    }
    {
      const f = frame(-76, 0, 39, 0.25);
      f(rbox(10, 4.2, 5.6, 0.4), 0x5a3020, { y: 2.1 }, M.wood);
      for (const xx of [-4.2, 4.2]) f(box(0.5, 4.4, 5.8), 0x2a2a2e, { x: xx, y: 2.1 }, M.metal);
      f(rbox(10, 0.8, 5.6, 0.3), 0x5a3020, { y: 4.6, z: -3.4, rx: -1.25, order: 'XYZ' }, M.wood);
      f(box(9.4, 0.2, 5), 0xd8ac52, { y: 4.15 }, M.gold);
      for (const [xx, zz, c] of [[-2, 2.6, 0x8a0c18], [1.5, 3.0, 0x2a4a8a], [3.2, 2.2, 0xd8ac52]]) f(rbox(3.2, 0.6, 4.4, 0.25), c, { x: xx, y: 2.0, z: zz, rx: 0.5 }, M.velvet);
      f(rbox(2.4, 0.3, 5.0, 0.12), 0xf0e8f0, { x: -0.5, y: 4.4, z: 1, rz: 0.3 }, M.velvet);
      f.box(0, 0, 5.2, 3.0, 5);
      AO(-76, 39, 6.5, 4, 0.5, -0.25);
    }
    {
      const mc = canvas(256, 256, (g) => {
        g.fillStyle = '#f2d878'; g.beginPath(); g.arc(128, 128, 120, 0, TAU); g.fill();
        g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(182, 100, 104, 0, TAU); g.fill(); g.globalCompositeOperation = 'source-over';
        g.fillStyle = 'rgba(200,150,60,0.6)'; for (const [x, y, rr] of [[60, 150, 12], [80, 200, 8], [44, 110, 7]]) { g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill(); }
        g.fillStyle = '#2a1a10'; g.beginPath(); g.arc(64, 132, 6, 0, TAU); g.fill();
        g.strokeStyle = '#8a4020'; g.lineWidth = 4; g.beginPath(); g.arc(70, 160, 14, 0.2, 1.6); g.stroke();
      });
      const mm = meshOf(new T.PlaneGeometry(11, 11), K.std({ map: tex(mc, [1, 1], false), alphaTest: 0.5, side: T.DoubleSide, roughness: 0.6, emissive: 0x302008 }), { cast: true });
      mm.position.set(98, 7.2, -50); mm.rotation.set(-0.15, 0.25, 0);
      const f = frame(98, 0, -50, -0.25);
      f(box(0.5, 8, 0.5), 0x6a4a30, { y: 4, z: -0.8, rx: 0.2 }, M.wood); f(box(5, 0.5, 3), 0x6a4a30, { y: 0.25, z: -0.6 }, M.wood);
      f.box(0, -0.6, 2.6, 1.6, 6);
      AO(98, -50.6, 3.4, 2, 0.45, 0.25);
      POOL(98, -48, 10, 8, 0x7a90ff, 0.28);
    }
    {
      const hb = [[40, 40, 3.0, 2.2, 0xe86a9a], [40.4, 40.2, 2.4, 1.8, 0x5ac0c8], [39.8, 39.9, 1.9, 1.6, 0xf2d040]];
      let y = 0;
      for (const [x, z, rr, h, c] of hb) { put(cyl(rr, rr, h, 24), c, { x, y: y + h / 2, z }, M.paint); put(cyl(rr + 0.12, rr + 0.12, 0.4, 24), 0xf4f0e4, { x, y: y + h - 0.2, z }, M.paint); y += h; }
      put(new T.TorusGeometry(1.0, 0.18, 6, 16), 0xb01828, { x: 39.8, y: y + 0.15, z: 39.9, rx: PI / 2 }, M.velvet);
      K.circle(40, 40, 3.1, 6);
      AO(40, 40, 3.6, 3.6, 0.5);
    }
    {
      const f = frame(-144, 0, 64, 0.4);
      f(box(8, 0.5, 4.6), 0x2a2a2e, { y: 4.4 }, M.metal);
      for (const [xx, zz] of [[-3.6, -2], [3.6, -2], [-3.6, 2], [3.6, 2]]) f(box(0.4, 4.4, 0.4), 0x1a1a1e, { x: xx, y: 2.2, z: zz }, M.metal);
      f(box(4.2, 0.25, 3), 0xf4f0e4, { x: -0.8, y: 4.75, z: 0.2, ry: 0.1 }, M.matte);
      f(cyl(0.12, 0.12, 2.4, 6), 0x2a2a2e, { x: 3, y: 5.8, z: -1.2, rz: 0.3 }, M.metal);
      f(box(1.2, 0.5, 0.9), [0.5, 0.7, 2.0], { x: 2.6, y: 6.9, z: -1.2, rz: 0.6 }, M.glow);
      f(new T.TorusGeometry(0.7, 0.14, 6, 14, PI), 0x1a1a1e, { x: 1.6, y: 5.2, z: 1.2 }, M.metal);
      f(box(1.4, 0.4, 0.9), [1.6, 0.2, 0.15], { x: -3.2, y: 4.9, z: -1.6 }, M.glow);
      f.box(0, 0, 4.2, 2.5, 6);
      AO(-144, 64, 5, 3, 0.5, -0.4);
      POOL(-142, 63, 8, 6, 0x5a80ff, 0.3);
    }

    // ============================================================ more cardboard actors waiting in the wings and on their marks
    {
      const spots = [[154, 20, -PI / 2, 5], [152, -46, -PI / 2, 6], [-146, -30, PI / 2, 7], [-147, 50, PI / 2, 0], [122, -86, 0.3, 4], [-114, -86, -0.2, 2], [100, 46, -0.2, 6], [-44, 38, 0.2, 1], [18, 40, -0.1, 5], [136, 72, -0.6, 3], [-120, 76, 0.5, 9]];
      for (const [x, z, ry, k] of spots) { actor(x, z, ry, k, 1); K.circle(x, z, 1.4, 7); }
    }

    // ============================================================ spike marks, cable runs, petals, sawdust
    {
      const marks = [];
      const tapeCols = [0xf2d030, 0xe84a8a, 0x4ac0f0, 0xf4f4f4, 0x6ad04a, 0xff8a30];
      for (let i = 0; i < 130; i++) {
        const x = r.range(ST.x0 + 6, ST.x1 - 6), z = r.range(ST.z0 + 14, FRONT - 2);
        if (inRev(x, z, 1)) continue;
        const ry = r() * PI, col = r.pick(tapeCols), kind = r();
        marks.push({ x, y: 0.04, z, ry, sx: 1.8, sy: 0.03, sz: 0.32, color: col });
        if (kind < 0.6) marks.push({ x, y: 0.045, z, ry: ry + PI / 2, sx: kind < 0.3 ? 1.8 : 1.0, sy: 0.03, sz: 0.32, color: col });
      }
      K.instances(box(1, 1, 1), K.std({ roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), marks, { colors: true, cast: false });
      // black cables taped down along the wings
      for (const [x0, z0, x1, z1] of [[154, 62, 154, -80], [-148, 64, -148, -80], [-140, -94, 130, -96]]) {
        put(rod([x0, 0.22, z0], [x1, 0.22, z1], 0.22, 5), 0x0e0e10, {}, M.matte, false);
        const n = Math.floor(Math.hypot(x1 - x0, z1 - z0) / 14);
        for (let k = 1; k < n; k++) { const t = k / n; put(box(1.6, 0.06, 1.0), 0x2a2a2e, { x: lerp(x0, x1, t), y: 0.42, z: lerp(z0, z1, t), ry: -Math.atan2(z1 - z0, x1 - x0) + PI / 2 }, M.matte, false); }
      }
      // rose petals thrown at the curtain call, sawdust, confetti, sequins
      const scat = [];
      for (let i = 0; i < 520; i++) {
        let x, z, kind = r();
        if (kind < 0.35) { x = r.range(-110, 110); z = r.range(60, FRONT + 6); } else { x = r.range(ST.x0 + 4, ST.x1 - 4); z = r.range(ST.z0 + 12, FRONT); }
        if (inRev(x, z, 0.5)) continue;
        const d = dRoad(x, z);
        if (d < -2 && r() < 0.75) continue;
        const col = kind < 0.35 ? r.pick([0xc0102a, 0xe02a4a, 0xa00820]) : kind < 0.7 ? r.pick([0xd8c4a0, 0xc8b088, 0xe8dcc0]) : r.pick([0xffd040, 0xff4ab0, 0x7ae0ff, 0xffffff]);
        scat.push({ x, y: 0.06, z, ry: r() * TAU, rx: r.range(-0.2, 0.2), sx: kind < 0.35 ? 0.7 : 0.35, sy: 0.05, sz: kind < 0.35 ? 0.5 : 0.25, color: col });
      }
      const keep = lowQ ? scat.filter((_, i) => i % 2 === 0) : scat;
      K.instances(new T.IcosahedronGeometry(1, 0), K.std({ roughness: 0.6 }), keep, { colors: true, cast: false });
      // a bouquet on the apron for the leading lady
      const f = frame(-20, 0, 76, 0.6);
      for (let k = 0; k < 7; k++) f(cyl(0.05, 0.05, 2.2, 4).rotateZ(PI / 2 + r.range(-0.15, 0.15)), 0x3a7a34, { x: -0.6, y: 0.2, z: (k - 3) * 0.08 }, M.matte, false);
      for (let k = 0; k < 7; k++) f(sph(0.3, 8, 6), r.pick([0xd0102a, 0xf03a5a, 0xf6f0f0]), { x: 0.8 + r.range(-0.2, 0.2), y: 0.32, z: (k - 3) * 0.24 }, M.paint);
      f(new T.ConeGeometry(0.7, 1.6, 8, 1, true).rotateZ(PI / 2), 0xf4ecd8, { x: 0.1, y: 0.4 }, M.matte);
    }

    // ============================================================ the lighting: pools from the rig, beams in the haze, the follow spot
    {
      // warm pools down the course, coloured washes over the set
      for (let s = 10; s < L; s += 52) {
        const p = track.place(s, Math.sin(s * 0.07) * 3);
        if (inRev(p.x, p.z, 8)) continue;
        POOL(p.x, p.z, 22, 18, 0xffe0b0, 0.11);
      }
      for (const [x, z, rx, rz, c, op] of [[58, -46, 16, 12, 0xff3aa0, 0.3], [32, -2, 18, 8, 0x3ad0ff, 0.3], [-82, -2, 24, 8, 0x60ff90, 0.16], [-62, -46, 14, 10, 0x6a7aff, 0.3], [62, 37, 12, 8, 0xff8a40, 0.3], [104, 33, 10, 6, 0xb070ff, 0.28], [140, -6, 14, 22, 0xffa050, 0.2], [-132, -48, 14, 14, 0xffd890, 0.2], [34, -74, 30, 12, 0xff4a40, 0.12]]) POOL(x, z, rx, rz, c, op);
      // beams: soft cones from the rig down to some of the pools
      const beamG = [];
      const cone = (x, z, rad, color, op) => {
        const g = new T.CylinderGeometry(1.2, rad, 70, 24, 6, true); g.translate(0, 35, 0);
        const n = g.attributes.position.count, cc = new Float32Array(n * 3), c = new T.Color(color);
        for (let i = 0; i < n; i++) { const k = Math.pow(1 - g.attributes.position.getY(i) / 70, 2.2) * op * 0.55; cc[i * 3] = c.r * k; cc[i * 3 + 1] = c.g * k; cc[i * 3 + 2] = c.b * k; }
        g.setAttribute('color', new T.BufferAttribute(cc, 3)); g.deleteAttribute('uv'); g.deleteAttribute('normal');
        g.translate(x, 0, z); beamG.push(g.toNonIndexed());
      };
      cone(58, -46, 12, 0xff4ab0, 0.07); cone(32, -2, 12, 0x4ad8ff, 0.06); cone(-62, -46, 11, 0x7a8aff, 0.06); cone(8, -48, 9, 0xffd8a0, 0.05);
      cone(0, 62, 13, 0xffe0b0, 0.05); cone(140, -8, 12, 0xffb060, 0.05); cone(-132, -48, 11, 0xffd890, 0.05); cone(34, -74, 13, 0xff6a50, 0.05);
      meshOf(BU.mergeGeometries(beamG, false), new T.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, toneMapped: false }), { receive: false, order: 3 });
      // the follow spot: a real spotlight from the back of the auditorium that follows the leader
      const spot = new T.SpotLight(0xfff2dc, 9, 0, 0.052, 0.5, 0);
      spot.position.set(0, 160, 170); spot.target.position.set(0, 0, 58); spot.castShadow = false;
      K.group.add(spot); K.group.add(spot.target);
      A.followSpot = spot;
    }

    // ============================================================ flush: actors, contacts, pools, bulbs, bins
    if (actorParts.length) meshOf(BU.mergeGeometries(actorParts, false), actorMat, { cast: true });
    if (revActorParts.length) { const m = meshOf(BU.mergeGeometries(revActorParts, false), actorMat, { cast: true, parent: rev }); m.position.set(0, 0, 0); }
    flushBins(bins);
    {
      const im = K.instances(flat(1, 1), contactMat, contacts, { cast: false, receive: false }); im.renderOrder = 1;
      const pm = K.instances(flat(1, 1), addMat(poolTex), pools, { cast: false, receive: false, colors: true }); pm.renderOrder = 2;
    }
    if (bulbs.length) {
      const pos = new Float32Array(bulbs.length * 3), cc = new Float32Array(bulbs.length * 3), col = new T.Color();
      bulbs.forEach((b, i) => { pos.set([b.x, b.y, b.z], i * 3); col.set(b.c).multiplyScalar(0.55 * b.halo / 2.2); cc.set([col.r, col.g, col.b], i * 3); });
      const pg = new T.BufferGeometry(); pg.setAttribute('position', new T.BufferAttribute(pos, 3)); pg.setAttribute('color', new T.BufferAttribute(cc, 3));
      const pts = new T.Points(pg, new T.PointsMaterial({ size: 4.2, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending, sizeAttenuation: true, toneMapped: false }));
      pts.renderOrder = 4; K.group.add(pts);
    }

    // ============================================================ CPU look-ahead zones (moving scenery, traps)
    for (const [a, b] of hz.rev) A.zones.push({ kind: 'rev', s0: a - 3, len: b - a + 6, look: 42, lats: LATS_WIDE });
    const pairs = [];
    for (const a of TRAP.lanes) for (const b of TRAP.lanes) pairs.push([a, b]);
    A.zones.push({ kind: 'trap', s0: hz.trapA - TRAP.hw - 2, len: hz.trapB - hz.trapA + 2 * TRAP.hw + 4, look: 46, lats: pairs, rowA: hz.trapA });
    A.zones.push({ kind: 'fly', s0: hz.fly[0] - 3, len: hz.fly[1] - hz.fly[0] + 6, look: 44, lats: LATS_ROAD });
    A.zones.push({ kind: 'bag', s0: hz.bag - 4, len: 8, look: 30, lats: LATS_ROAD });
    A.track = track; A.hz = hz;
    if (typeof window !== 'undefined') window.__stage = A;
  },

  // fixed rate: the traps open and close; CPU drivers read the moving scenery ahead; a car that dropped through a
  // trap comes back up with a run-up before the trap room
  tick(dt, time, game) {
    if (!A) return;
    for (const Tq of A.traps) Tq.hole.open = trapOpenU(trapU(Tq, time));
    const L = A.L, tr = A.track;
    A.step = (A.step || 0) + 1;
    for (let ci = 0; ci < game.cars.length; ci++) {
      const e = game.cars[ci], c = e.car;
      if (e.out) continue;
      if (c.state === 'falling') {
        if (c.fallKind === 'hole' && c.z < -60 && c.x > 0 && c.x < 60) e.lastGoodS = A.trapRespawnS;
        continue;
      }
      if (c.state !== 'drive' || !e.ai) { if (e.stagePlan) e.stagePlan.z = null; continue; }
      const s = e.trackS;
      let Z = null, d0 = 0;
      for (const z of A.zones) {
        const ahead = mod(z.s0 - s, L);
        if (ahead < z.look) { Z = z; d0 = ahead; break; }
        if (mod(s - z.s0, L) < z.len) { Z = z; d0 = -mod(s - z.s0, L); break; }
      }
      if (!Z) { if (e.stagePlan) e.stagePlan.z = null; continue; }
      // re-plan every few steps (staggered per car); steer to the planned lateral every step
      const sameZ = e.stagePlan && e.stagePlan.z === Z;
      if (!sameZ || (A.step + ci) % 3 === 0) {
        const v = Math.max(13, c.fwdSpeed), rad = 1.14 + (Z.kind === 'rev' ? 0.6 : 1.0);
        const q1 = d0 + Z.len + 1;
        let best = sameZ ? e.stagePlan.l : Z.lats[0], bestCost = Infinity, bestReach = -1, reachL = best;
        for (let li = 0; li < Z.lats.length; li++) {
          const cand = Z.lats[li];
          // drive the candidate path forward with the CPU's steering (about 0.24 units sideways per unit)
          let hitAt = -1, lat = e.lateral;
          for (let q = 0; q <= q1; q += 2.2) {
            lat += clamp(planLane(Z, cand, s, q + 5, L) - lat, -0.53, 0.53);
            if (q < d0 - 2) continue;
            const i = tr.idx(s + q), x = tr.x[i] - tr.tz[i] * lat, z = tr.z[i] + tr.tx[i] * lat, t = time + q / v;
            const hit = Z.kind === 'rev' ? hitRevolve(x, z, t, rad) : Z.kind === 'trap' ? hitTraps(x, z, t) : Z.kind === 'fly' ? hitFlats(x, z, t, rad) : hitBag(x, z, t, rad);
            if (hit) { hitAt = q; break; }
          }
          const pair = typeof cand !== 'number', c0 = pair ? cand[0] : cand, c1 = pair ? cand[1] : cand;
          if (hitAt < 0) {
            const keep = sameZ && (pair ? e.stagePlan.l[0] === c0 && e.stagePlan.l[1] === c1 : e.stagePlan.l === c0);
            let cost = Math.abs(c0 - e.lateral) * 0.12 + Math.abs(c1 - c0) * 0.15 + Math.abs(c0) * 0.04 + (keep ? -0.4 : 0);
            // a CPU running alongside already has that lane: take another one if there is a free one
            if (pair) for (const o of game.cars) {
              if (o === e || !o.stagePlan || o.stagePlan.z !== Z || o.car.state !== 'drive') continue;
              const ds = mod(o.trackS - s + L / 2, L) - L / 2;
              if (Math.abs(ds) < 9 && Math.abs(o.stagePlan.l[0] - c0) < 0.1) cost += 0.8;
            }
            if (cost < bestCost) { bestCost = cost; best = cand; }
          } else if (hitAt > bestReach) { bestReach = hitAt; reachL = cand; }
        }
        if (bestCost === Infinity) best = reachL;
        if (!e.stagePlan) e.stagePlan = { z: Z, l: best }; else { e.stagePlan.z = Z; e.stagePlan.l = best; }
      }
      const P = e.stagePlan.l, look = 6 + Math.max(0, c.fwdSpeed) * 0.28;
      const tl = planLane(Z, P, s, look * 0.5, L);
      // aim a little past the planned lateral while the car still lags behind it (the CPU steering is soft)
      const want = tl + clamp(tl - e.lateral, -3, 3) * 0.7 - e.ai.lineOffset(s + look);
      e.ai.mistakeT = 0;
      e.ai.avoid += (want - e.ai.avoid) * Math.min(1, dt * 16);
    }
  },

  animate(time, dt, game) {
    if (!A || !A.rev) return;
    const st = game.state, live = st === 'race' || st === 'countdown' || st === 'roundEnd';
    const snd = game.sound;
    // ---- the revolve turns
    A.rev.rotation.y = -revAngle(time);
    // ---- the traps: leaves swing down, cracks glow before, a puff of red smoke and a clank when one drops
    {
      const m1 = A.m1, m2 = A.m2, m3 = A.m3, col = A.col;
      for (let i = 0; i < A.traps.length; i++) {
        const Tq = A.traps[i], u = trapU(Tq, time), fr = trapFrac(u), wn = trapWarn(u);
        m1.makeRotationY(-Tq.ang); m1.setPosition(Tq.x, 0, Tq.z);
        for (let k = 0; k < 2; k++) {
          const sd = k ? 1 : -1, w = Tq.hd - 0.12;
          m2.makeTranslation(0, 0.27, sd * Tq.hd);
          m3.makeRotationX(-sd * fr * 1.65); m2.multiply(m3);
          m3.makeTranslation(0, 0, -sd * w / 2); m2.multiply(m3);
          m3.makeScale(1, 1, w); m2.multiply(m3);
          m2.premultiply(m1);
          A.leaves.setMatrixAt(i * 2 + k, m2); A.straps.setMatrixAt(i * 2 + k, m2);
        }
        if (fr > 0.001) { m2.copy(m1).multiply(m3.makeTranslation(0, 0.16, 0)); m2.multiply(m3.makeScale(2 * Tq.hw, 1, 2 * Tq.hd)); A.masks.setMatrixAt(i, m2); A.cracks.setMatrixAt(i, A.zero); }
        else { A.masks.setMatrixAt(i, A.zero); m2.copy(m1).multiply(m3.makeTranslation(0, 0.13, 0)); m2.multiply(m3.makeScale(2 * Tq.hw, 1, 2 * Tq.hd)); A.cracks.setMatrixAt(i, m2); }
        const flick = 0.75 + 0.25 * Math.sin(time * 37 + i * 2.1);
        const g = fr > 0 ? 0 : Math.pow(wn, 1.4) * flick;
        A.cracks.setColorAt(i, col.setRGB(0.03 + g * 2.4, 0.015 + g * 1.0, g * 0.25));
        m2.copy(m1).multiply(m3.makeTranslation(0, 0.3, 0)); m2.multiply(m3.makeScale((2 * Tq.hw) / 0.5, 1, (2 * Tq.hd) / 0.45));
        A.trapGlow.setMatrixAt(i, m2);
        if (fr > 0) A.trapGlow.setColorAt(i, col.setRGB(fr * 1.1, fr * 0.12, fr * 0.06)); else A.trapGlow.setColorAt(i, col.setRGB(g * 1.0, g * 0.45, g * 0.1));
        const phase = wn > 0 ? 1 : fr > 0 ? 2 : 0;
        if (phase !== Tq.phase) {
          if (live && game.onScreen(Tq.x, 0, Tq.z, 0.1)) {
            if (phase === 1 && snd.ctx) snd.tone(110 + Tq.lane * 18, 0.6, { type: 'sawtooth', vol: 0.03, slideTo: 200, attack: 0.1 });
            if (phase === 2) {
              if (snd.cue) snd.cue('clank', { x: Tq.x, z: Tq.z, game, vol: 0.7 });
              if (game.particles) game.particles.emit(Tq.x, 0.6, Tq.z, { color: 0xc8402a, n: 9, size: 2.2, life: 0.8, spread: 2.5, up: 7, grav: -1, grow: 2.4, alpha: 0.42 });
            }
          }
          Tq.phase = phase;
        }
      }
      A.leaves.instanceMatrix.needsUpdate = true; A.straps.instanceMatrix.needsUpdate = true;
      A.masks.instanceMatrix.needsUpdate = true; A.cracks.instanceMatrix.needsUpdate = true; A.cracks.instanceColor.needsUpdate = true;
      A.trapGlow.instanceMatrix.needsUpdate = true; A.trapGlow.instanceColor.needsUpdate = true;
    }
    // ---- flying flats: height, the growing shadow, cue lights, the bell as one flies in
    for (const F of A.flats) {
      const yb = flatBottom(F.k, time);
      F.g.position.y = yb;
      const near = 1 - clamp(yb / FLY.top, 0, 1);
      F.blob.material.opacity = 0.1 + near * 0.55;
      F.blob.scale.set(2 * FLY.hw + 3 + (1 - near) * 6, 1, 3 + (1 - near) * 5);
      const u = mod(time - F.k * FLY.P * 0.5, FLY.P);
      const standby = u > FLY.P - 0.9, go = u < FLY.dn;
      F.red.color.setRGB(standby ? 2.4 : 0.25, 0.02, 0.02);
      F.grn.color.setRGB(0.02, go ? 2.4 : 0.22, 0.04);
      const cyc = Math.floor((time - F.k * FLY.P * 0.5) / FLY.P);
      if (go && cyc !== F.bell) {
        F.bell = cyc;
        if (live && snd.cue && game.onScreen(F.x, 6, F.z, 0.35)) snd.cue('bell', { x: F.x, z: F.z, game });
      }
    }
    // ---- the sandbag swings; its shadow follows; a whoosh as it passes the middle
    {
      const a = bagAngle(time);
      A.bagG.rotation.z = a;
      const bx = A.bag.x + BAG.len * Math.sin(a);
      A.bagSh.position.x = bx;
      const side = Math.sign(a);
      if (side !== A.lastBag) {
        A.lastBag = side;
        if (live && snd.ctx && game.onScreen(bx, 3, A.bag.z, 0.1)) snd.noiseBurst(0.35, { freq: 700, vol: 0.05 });
      }
    }
    // ---- the painted waves rock
    for (const wv of A.waves) { wv.m.position.x = 32 + Math.sin(time * 1.3 + wv.ph) * 1.4; wv.m.position.y = 2.2 + Math.sin(time * 2.1 + wv.ph) * 0.3; }
    // ---- the follow spot finds the leader
    if (A.followSpot && game.cars.length) {
      let lead = null;
      for (const e of game.cars) if (!e.out && e.car.state === 'drive' && (!lead || e.progress > lead.progress)) lead = e;
      if (lead) {
        const S = A.spot, k = S.init ? 1 - Math.exp(-6 * Math.min(0.1, dt || 0.016)) : 1;
        S.x += (lead.car.x - S.x) * k; S.z += (lead.car.z - S.z) * k; S.init = true;
        A.followSpot.target.position.set(S.x, 0, S.z);
        A.followSpot.position.set(S.x * 0.6, 160, 170);
        A.followSpot.target.updateMatrixWorld();
      }
    }
  },
};

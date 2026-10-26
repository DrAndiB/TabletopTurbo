// World: Neon Rooftop (Drift Cup, table 4 of 4, expert). A model-maker's night diorama of a city block at the cars'
// scale (about 1:100), standing on a desk in a dark room. It has just rained. The course runs over the top deck of a
// multi-storey car park (painted bays, light masts, the ramp housing, parked cars behind jersey barriers), crosses a
// street on a narrow bridge onto a mall roof (gravel, skylights, a billboard, a water tower), crosses a second street
// onto an office roof (helipad deck, neon signs on rooftop frames) and jumps the alley back onto the car park from a
// plywood kicker. Two hairpins round the ramp housing and a chicane round a light-mast island make it technical; the
// wet asphalt mirrors the neon. Roofs without a parapet drop you into the street below.

const PI = Math.PI, TAU = PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const fract = (x) => x - Math.floor(x);
const hash = (n) => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);

// ---- the circuit: a closed polygon with a fillet radius at every corner (exact radii, smooth arcs), driving order
const POLY = [
  [-144, 80, 15], // hairpin 2 (second half) onto the start straight
  [22, 80, 32], [56, 38, 22], // over bridge 1, then the S on the mall roof
  [118, 51.3, 30], [140, 34.1, 22], // double-apex left onto the bridge-2 straight
  [140, -64, 30], [120, -84, 22], // tightening left on the office roof
  [62, -84, 24], [36, -59, 24], // S down to the kicker straight
  [-76, -59, 14], [-92, -79, 14], [-108, -59, 14], // chicane round the light-mast island
  [-126, -59, 26], [-144, -41, 20], // double-apex left down the car park's west side
  [-144, 8, 20], // left onto the ramp-housing leg
  [-72, 8, 15], [-72, 42, 15], // hairpin 1 round the end of the ramp housing
  [-144, 42, 15], // hairpin 2 (first half)
];
function filletLoop(V, stepDeg = 12, straightStep = 20) {
  const n = V.length, C = [];
  for (let i = 0; i < n; i++) {
    const p0 = V[(i - 1 + n) % n], p1 = V[i], p2 = V[(i + 1) % n];
    let dx1 = p1[0] - p0[0], dz1 = p1[1] - p0[1]; const l1 = Math.hypot(dx1, dz1); dx1 /= l1; dz1 /= l1;
    let dx2 = p2[0] - p1[0], dz2 = p2[1] - p1[1]; const l2 = Math.hypot(dx2, dz2); dx2 /= l2; dz2 /= l2;
    const phi = Math.atan2(dx1 * dz2 - dz1 * dx2, dx1 * dx2 + dz1 * dz2);
    const rad = p1[2], t = rad * Math.tan(Math.abs(phi) / 2), sg = phi > 0 ? 1 : -1;
    const A0 = [p1[0] - dx1 * t, p1[1] - dz1 * t], B0 = [p1[0] + dx2 * t, p1[1] + dz2 * t];
    C.push({ A: A0, B: B0, c: [A0[0] - dz1 * rad * sg, A0[1] + dx1 * rad * sg], rad, phi });
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const c = C[i], a0 = Math.atan2(c.A[1] - c.c[1], c.A[0] - c.c[0]);
    const k = Math.max(2, Math.ceil(Math.abs(c.phi) / (stepDeg * PI / 180)));
    for (let j = 0; j <= k; j++) { const a = a0 + c.phi * j / k; out.push([c.c[0] + Math.cos(a) * c.rad, c.c[1] + Math.sin(a) * c.rad]); }
    const nb = C[(i + 1) % n], L = Math.hypot(nb.A[0] - c.B[0], nb.A[1] - c.B[1]), m = Math.floor(L / straightStep);
    for (let j = 1; j <= m; j++) { const f = j / (m + 1); out.push([lerp(c.B[0], nb.A[0], f), lerp(c.B[1], nb.A[1], f)]); }
  }
  return out;
}
const W = 16;
const TRACK = filletLoop(POLY).map(([x, z]) => [Math.round(x * 100) / 100, Math.round(z * 100) / 100]);

// ---- the block: three roofs at y = 0, streets 26 below
const RA = { x0: -166, x1: -36, z0: -100, z1: 96 }; // multi-storey car park, top deck
const RB = { x0: -12, x1: 166, z0: -2, z1: 96 }; // mall roof (south-east)
const RC = { x0: -26, x1: 166, z0: -100, z1: -22 }; // office roof (north-east)
const BR1 = { z: 80, x0: RA.x1, x1: RB.x0, hw: 9.6 }; // bridge 1 over the side street (west -> east)
const BR2 = { x: 140, z0: RC.z1, z1: RB.z0, hw: 9.6 }; // bridge 2 over the cross street (south -> north)
const KICK = { x0: -14, x1: RC.x0, z: -59, h: 3.2, wid: 18.8 }; // plywood kicker on the office roof's west edge, rising west
const LAND = { z0: -76, z1: -42 }; // no parapet on the car park's east edge here: the landing
const HELI = { x0: 62, x1: 100, z0: -66, z1: -32, h: 2.4 }; // raised helipad deck on the office roof
// stretches of roof edge without a parapet (going wide there drops you into the street)
const OPEN = [{ side: 'Cn', a: 86, b: 112 }, { side: 'Bs', a: 26, b: 58 }];
const SY = -26; // street level
const DESK = -30; // desk top under the diorama board
const FLOOR = -105; // the room's floor
const BOARD = { x0: -196, x1: 196, z0: -182, z1: 128 };
const BOUNDS = {
  minX: -200, maxX: 200, minZ: -150, maxZ: 130,
  // the roofs and both bridges; the streets and the alley under the jump are outside
  poly: [
    [RA.x0, RA.z0], [RA.x1, RA.z0], [RA.x1, BR1.z - BR1.hw], [BR1.x1, BR1.z - BR1.hw], [RB.x0, RB.z0], [BR2.x - BR2.hw, RB.z0], [BR2.x - BR2.hw, RC.z1],
    [RC.x0, RC.z1], [RC.x0, RC.z0], [RC.x1, RC.z0], [RC.x1, RC.z1], [BR2.x + BR2.hw, RC.z1], [BR2.x + BR2.hw, RB.z0], [RB.x1, RB.z0], [RB.x1, RB.z1],
    [RB.x0, RB.z1], [RB.x0, BR1.z + BR1.hw], [RA.x1, BR1.z + BR1.hw], [RA.x1, RA.z1], [RA.x0, RA.z1],
  ],
};

let A = null; // runtime state shared by build / tick / animate

export default {
  id: 'rooftop',
  name: 'Neon Rooftop',
  blurb: 'Rain-wet rooftops at night: neon, car-park hairpins, narrow bridges and an alley jump.',
  vehicle: 'drifter',
  seed: 47,
  headlights: { intensity: 60, distance: 54, angle: 0.62, color: 0xfff1dc },
  track: { points: TRACK, width: W, startS: 52 },
  bounds: BOUNDS,
  fallOffEdges: true,
  floorY: SY + 0.5, // a car that drops off a roof lands in the street
  offCourse: 16,
  offroad: { kind: 'slow', margin: 1.2 },
  skidColor: 0x0d0d10,
  dustColor: 0xb8c2d0,
  dust: {
    normal: { color: 0xc8d2e0, size: 0.8, life: 0.4, up: 1.4, grav: 3, alpha: 0.16, grow: 2.4, rate: 0.5 }, // fine spray off the wet road
    slow: { color: 0x9c988f, size: 0.8, life: 0.45, up: 3.5, grav: 26, alpha: 0.75, grow: 1.2, rate: 1.4 }, // gravel
    water: { color: 0xe4ecf6, size: 1.0, life: 0.5, up: 6.5, grav: 30, alpha: 0.8, grow: 1.6, rate: 3.2 },
    slick: { color: 0x3a3442, size: 0.7, life: 0.5, up: 3, grav: 25, alpha: 0.8, grow: 1, rate: 2 },
  },
  lighting: {
    sunDir: [-0.38, 1, -0.5], sunColor: 0x8a9ce0, sunIntensity: 0.62,
    hemiSky: 0x2e3a6e, hemiGround: 0x140d16, hemiIntensity: 0.34,
    envIntensity: 0.14, exposure: 1.16, background: 0x04050a, shadowRadius: 3,
    fog: { color: 0x06070d, near: 340, far: 900 },
  },

  async build(K) {
    const { THREE: T, TX, r, track, physics } = K;
    const BU = K.BufferGeometryUtils;
    const L = track.length;
    const lowQ = !!(K.quality && K.quality.tilt === false);
    A = { steam: [], steamT: 0, uT: { value: 0 }, m4: new T.Matrix4(), q: new T.Quaternion(), v: new T.Vector3(), sc: new T.Vector3(), e: new T.Euler(), L };
    const V2 = (a, b = a) => new T.Vector2(a, b);
    const sAt = (x, z) => track.distTo(x, z).s;
    const dRoad = (x, z) => { const n = track.distTo(x, z); return n.dist - track.w[n.i] / 2; };
    const inR = (R, x, z, m = 0) => x > R.x0 + m && x < R.x1 - m && z > R.z0 + m && z < R.z1 - m;
    const roofOf = (x, z) => (inR(RA, x, z) ? 'A' : inR(RB, x, z) ? 'B' : inR(RC, x, z) ? 'C' : null);

    // ============================================================ physics first (ribbons follow the ground)
    K.ramp((KICK.x0 + KICK.x1) / 2, KICK.z, PI, KICK.x0 - KICK.x1, KICK.wid, KICK.h, 0);
    K.platform((HELI.x0 + HELI.x1) / 2, (HELI.z0 + HELI.z1) / 2, (HELI.x1 - HELI.x0) / 2, (HELI.z1 - HELI.z0) / 2, 0, HELI.h);
    const groundY = (x, z) => physics.groundAt(x, z).g;
    const S = {
      kick0: sAt(KICK.x0, KICK.z), kick1: sAt(KICK.x1, KICK.z), land: sAt(RA.x1, KICK.z),
      br1a: sAt(BR1.x0, BR1.z), br1b: sAt(BR1.x1, BR1.z), br2a: sAt(BR2.x, BR2.z1), br2b: sAt(BR2.x, BR2.z0),
    };
    A.S = S;
    A.jumpRespawnS = (S.kick0 - 40 + L) % L;

    // ============================================================ baking helpers: many parts -> few meshes
    const _q = new T.Quaternion(), _e = new T.Euler(), _v = new T.Vector3(), _s = new T.Vector3(), _c = new T.Color();
    const mtx = (o) => new T.Matrix4().compose(_v.set(o.x || 0, o.y || 0, o.z || 0), _q.setFromEuler(_e.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ')), _s.set(o.sx ?? o.s ?? 1, o.sy ?? o.s ?? 1, o.sz ?? o.s ?? 1));
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
    const CELL = 150;
    const bins = new Map();
    const binPush = (mat, cast, x, z, g) => {
      if (mat.isMeshBasicMaterial) cast = false;
      const key = mat.uuid + (cast ? 'c' : 'n') + Math.floor((x + 300) / CELL) + ':' + Math.floor((z + 300) / CELL);
      if (!bins.has(key)) bins.set(key, { mat, cast, parts: [] });
      bins.get(key).parts.push(g);
    };
    // put(geo, colour, {x,y,z,rx,ry,rz,s..}, material, castShadow): one part placed in world space
    const put = (geo, c, o = {}, mat = M.paint, cast = true) => binPush(mat, cast, o.x ?? 0, o.z ?? 0, prep(geo, c, mtx(o)));
    // a local frame for a whole prop: f(geo, c, o, mat, cast); f.pt(lx, lz) -> world [x, z]
    const frame = (cx, cy, cz, ry = 0) => {
      const F = mtx({ x: cx, y: cy, z: cz, ry });
      const cs = Math.cos(ry), sn = Math.sin(ry);
      const f = (geo, c, o = {}, mat = M.paint, cast = true) => binPush(mat, cast, cx, cz, prep(geo, c, F.clone().multiply(mtx(o))));
      f.pt = (lx, lz) => [cx + lx * cs + lz * sn, cz - lx * sn + lz * cs];
      f.box = (lx, lz, hw, hd, h) => { const [x, z] = f.pt(lx, lz); return K.box(x, z, hw, hd, -ry, h); };
      return f;
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
    // planar strip along the track between s0 and s1 at lateral offset `off` (follows ramps when asked)
    const strip = (s0, s1, off, wid, yOff = 0.05, step = 1, vScale = 10, follow = false, offFn = null) => {
      const n = Math.max(2, Math.ceil((s1 - s0) / step));
      const pos = [], uv = [], idx = [];
      for (let i = 0; i <= n; i++) {
        const s = s0 + ((s1 - s0) * i) / n, p = track.at(s), o0 = offFn ? offFn(s) : off;
        for (let k = 0; k < 2; k++) {
          const o = o0 + (k - 0.5) * wid, x = p.x + p.nx * o, z = p.z + p.nz * o;
          pos.push(x, (follow ? groundY(x, z) : 0) + yOff, z); uv.push(k, s / vScale);
        }
        if (i < n) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals();
      const nr = g.attributes.normal; for (let i = 0; i < nr.count; i++) nr.setXYZ(i, 0, 1, 0);
      return g;
    };
    const meshOf = (g, mat, { cast = false, receive = true, order = 0 } = {}) => { const m = new T.Mesh(g, mat); m.castShadow = cast; m.receiveShadow = receive; m.renderOrder = order; K.group.add(m); return m; };

    // contact shadows (opacity in the instance's y scale), light pools, bulbs and halos
    const contactMat = new T.MeshBasicMaterial({ color: 0x020205, transparent: true, alphaMap: TX.blobShadowTexture(), depthWrite: false });
    contactMat.onBeforeCompile = (sh) => {
      sh.vertexShader = 'varying float vOp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\nvOp = length(instanceMatrix[1].xyz);\n#endif');
      sh.fragmentShader = 'varying float vOp;\n' + sh.fragmentShader.replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\ndiffuseColor.a *= vOp;');
    };
    contactMat.customProgramCacheKey = () => 'rooftop-contact';
    const contacts = [];
    const AO = (x, z, rx, rz = rx, op = 0.4, ang = 0, y = 0.06) => contacts.push({ x, y, z, ry: -ang, sx: rx * 2, sy: op, sz: rz * 2 });
    const pools = [];
    const POOL = (x, z, rx, rz, color, op = 1, ang = 0, y = 0.1) => pools.push({ x, y, z, ry: -ang, sx: rx * 2, sy: 1, sz: rz * 2, color: new T.Color(color).multiplyScalar(op) });
    const bulbs = [], blinkers = [];
    const BULB = (x, y, z, color, s = 0.25, halo = 3) => bulbs.push({ x, y, z, c: color, s, halo });
    const BLINK = (x, y, z, ph = 0, color = 0xff2a1a) => blinkers.push({ x, y, z, c: color, ph });

    // ============================================================ materials
    const concrete = TX.mottledTextures({ size: 256, a: 0xc8c6c0, b: 0xa9a7a1, c: 0xd8d6cf, seed: 81, period: 6, speck: 0.45, bump: 1.6 });
    const M = {
      paint: K.phys({ vertexColors: true, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.3 }),
      matte: K.std({ vertexColors: true, roughness: 0.86, map: concrete.map, normalMap: concrete.normalMap, normalScale: V2(0.7) }),
      metal: K.std({ vertexColors: true, metalness: 0.72, roughness: 0.4 }),
      glow: new T.MeshBasicMaterial({ vertexColors: true }),
      line: K.std({ vertexColors: true, roughness: 0.38, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      glass: K.phys({ vertexColors: true, roughness: 0.08, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 }),
    };

    // ============================================================ the room: floor far below, the desk, a desk lamp
    {
      const fl = TX.woodTextures({ size: 512, seed: 21, planks: 6, base: 0x1c1610, dark: 0x0e0a07, light: 0x2a2017, ringFreq: 20, gap: 0.006, roughBase: 0.6 });
      for (const t of Object.values(fl)) t.repeat.set(9, 9);
      K.mesh(new T.PlaneGeometry(2200, 2200), K.std({ map: fl.map, normalMap: fl.normalMap, roughness: 0.75 }), 0, FLOOR, 0, { rx: -PI / 2, cast: false });
      const rugC = TX.paint(256, 256, (x, y, u, v, o) => {
        const d = Math.max(Math.abs(u - 0.5), Math.abs(v - 0.5)); const band = Math.floor(d * 18) % 3;
        const n = Math.random() * 6; o[0] = [24, 14, 30][band] + n; o[1] = [20, 18, 22][band] + n; o[2] = [34, 30, 26][band] + n;
      });
      K.mesh(new T.PlaneGeometry(520, 420), K.std({ map: tex(rugC, [1, 1], false), roughness: 1 }), 0, FLOOR + 0.2, 0, { rx: -PI / 2, cast: false });
      // walnut desk top with an apron and legs
      const wd = TX.woodTextures({ size: 1024, seed: 33, planks: 3, base: 0x3d271a, dark: 0x22140c, light: 0x5a3c26, ringFreq: 16, gap: 0.003, roughBase: 0.45 });
      for (const t of Object.values(wd)) t.repeat.set(3, 1.6);
      const deskMat = K.std({ map: wd.map, normalMap: wd.normalMap, roughnessMap: wd.roughnessMap, normalScale: V2(0.5) });
      const DW = 560, DD = 420, DZ = -24;
      K.mesh(box(DW, 5, DD), deskMat, 0, DESK - 2.5, DZ, { cast: false });
      const legMat = K.std({ color: 0x2a1a10, roughness: 0.6 });
      const legs = [box(DW - 20, 10, DD - 20).translate(0, DESK - 10, DZ)];
      for (const [x, z] of [[-DW / 2 + 12, -DD / 2 + 12], [DW / 2 - 12, -DD / 2 + 12], [-DW / 2 + 12, DD / 2 - 12], [DW / 2 - 12, DD / 2 - 12]]) legs.push(box(10, DESK - FLOOR, 10).translate(x, (FLOOR + DESK) / 2, z + DZ));
      K.mesh(BU.mergeGeometries(legs, false), legMat, 0, 0, 0, { cast: false });
      // green cutting mat peeking out under the board (south-west)
      const mc = canvas(512, 512, (g) => {
        g.fillStyle = '#1f5a46'; g.fillRect(0, 0, 512, 512);
        g.strokeStyle = 'rgba(220,240,230,0.35)'; g.lineWidth = 1;
        for (let i = 0; i <= 512; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke(); }
        g.strokeStyle = 'rgba(240,250,245,0.6)'; g.lineWidth = 2;
        for (let i = 0; i <= 512; i += 80) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke(); }
        g.strokeStyle = 'rgba(240,250,245,0.35)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(512, 512); g.stroke();
      });
      K.mesh(new T.PlaneGeometry(240, 170), K.std({ map: tex(mc, [1, 1], false), roughness: 0.8 }), -150, DESK + 0.06, 120, { rx: -PI / 2, ry: 0, cast: false });
      // tools on the desk: a scalpel, a glue bottle, a pot of brushes, two paint pots, a spare street lamp
      const tl = frame(150, DESK, 150, 0.4);
      tl(cyl(0.7, 0.7, 16, 12), 0xc9ccd2, { x: 0, y: 0.7, rz: PI / 2 }, M.metal);
      tl(box(3, 0.15, 1.1), 0xe8eaee, { x: -9.5, y: 0.7 }, M.metal);
      tl(cyl(2.4, 2.8, 9, 16), 0xf2efe6, { x: 18, y: 4.5, z: -6 }, M.paint);
      tl(cyl(1, 1.4, 3, 12), 0xd23a2a, { x: 18, y: 10.5, z: -6 }, M.paint);
      for (let i = 0; i < 2; i++) { tl(cyl(3, 3, 3.6, 18), 0xdedad2, { x: 6 + i * 8, y: 1.8, z: 10 }, M.paint); tl(cyl(2.6, 2.6, 0.2, 18), [0xc23a7a, 0x2a8ad2][i], { x: 6 + i * 8, y: 3.62, z: 10 }, M.paint); }
      const jar = frame(-210, DESK, 60, 0);
      jar(cyl(5, 5, 14, 20), 0x6a7a8a, { y: 7 }, M.glass);
      for (let i = 0; i < 6; i++) { const a = i * 1.05; jar(cyl(0.35, 0.35, 26, 6), [0xc8a060, 0x8a5a30, 0xd8b070][i % 3], { x: Math.cos(a) * 2.4, y: 13, z: Math.sin(a) * 2.4, rx: Math.sin(a) * 0.2, rz: Math.cos(a) * 0.2 }, M.paint); }
      // the desk lamp at the far north-east corner, its warm light across the corner of the board
      const lp = { x: 232, z: -214 };
      const lamp = frame(lp.x, DESK, lp.z, 0);
      lamp(cyl(11, 12, 2.5, 28), 0x1c1c20, { y: 1.25 }, M.metal);
      lamp(rod([0, 2, 0], [-14, 60, 22], 1.1, 8), 0x2a2a30, {}, M.metal);
      lamp(rod([-14, 60, 22], [-46, 72, 70], 1.1, 8), 0x2a2a30, {}, M.metal);
      lamp(sph(2.4, 12, 8), 0x2a2a30, { x: -14, y: 60, z: 22 }, M.metal);
      const head = new T.Mesh(cyl(4, 11, 13, 24, true), K.std({ color: 0x23252a, metalness: 0.6, roughness: 0.35, side: T.DoubleSide }));
      head.position.set(lp.x - 50, DESK + 70, lp.z + 76); head.lookAt(110, DESK + 10, -100); head.rotateX(-PI / 2);
      K.add(head);
      const bulb = new T.Mesh(sph(6, 16, 10), new T.MeshBasicMaterial({ color: new T.Color(0xffe2b0).multiplyScalar(2) }));
      bulb.position.copy(head.position).lerp(new T.Vector3(110, DESK + 10, -100), 0.03); K.group.add(bulb);
      const spot = new T.SpotLight(0xffc98a, 120, 0, 0.6, 0.8, 1);
      spot.position.copy(bulb.position); spot.target.position.set(150, -20, -120);
      spot.castShadow = false; K.group.add(spot); K.group.add(spot.target);
      POOL(175, -175, 120, 90, 0xffb060, 0.22, 0.6, DESK + 0.2);
    }

    // ============================================================ the diorama board: base, streets, pavements
    const asph = TX.mottledTextures({ size: 512, a: 0x2b2c31, b: 0x222328, c: 0x36373d, seed: 71, period: 24, speck: 0.55, bump: 2.2, pebbles: 600, pebbleColor: 0x4a4a50, roughness: [0.22, 0.72] });
    {
      const BW = BOARD.x1 - BOARD.x0, BD = BOARD.z1 - BOARD.z0, BX = (BOARD.x0 + BOARD.x1) / 2, BZ = (BOARD.z0 + BOARD.z1) / 2;
      // plywood base box with a black painted edge band and a little brass plaque
      const ply = TX.woodTextures({ size: 256, seed: 5, planks: 1, base: 0xc8a878, dark: 0xa88858, light: 0xe0c498, ringFreq: 30, gap: 0, roughBase: 0.6 });
      K.mesh(box(BW, SY - DESK, BD), K.std({ map: ply.map, roughness: 0.7 }), BX, (SY + DESK) / 2, BZ, { cast: false });
      K.mesh(box(BW + 0.3, 1.2, BD + 0.3), K.std({ color: 0x141418, roughness: 0.5 }), BX, SY - 0.6, BZ, { cast: false });
      const pc = canvas(512, 96, (g) => { g.fillStyle = '#b8924a'; g.fillRect(0, 0, 512, 96); g.strokeStyle = '#6a4e20'; g.lineWidth = 6; g.strokeRect(5, 5, 502, 86); g.fillStyle = '#2e2210'; g.font = '700 40px Georgia, serif'; g.textAlign = 'center'; g.fillText('Neon Rooftop · 1:100', 256, 62); });
      K.mesh(new T.PlaneGeometry(40, 7.5), K.std({ map: tex(pc, [1, 1], false), metalness: 0.6, roughness: 0.35 }), 60, (SY + DESK) / 2, BOARD.z1 + 0.2, { cast: false });
      // street asphalt over the whole board
      const st = { map: asph.map.clone(), normalMap: asph.normalMap.clone(), roughnessMap: asph.roughnessMap.clone() };
      for (const t of Object.values(st)) { t.repeat.set(BW / 22, BD / 22); t.needsUpdate = true; }
      K.mesh(new T.PlaneGeometry(BW, BD), K.std({ map: st.map, normalMap: st.normalMap, roughnessMap: st.roughnessMap, color: 0xb0b0b8, normalScale: V2(0.6) }), BX, SY + 0.02, BZ, { rx: -PI / 2, cast: false });
      // pavements round every block (and the tower row in the north)
      const pave = (x0, z0, x1, z1, w = 3) => {
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, bw = x1 - x0 + 2 * w, bd = z1 - z0 + 2 * w;
        put(box(bw, 0.3, bd), 0x8a8780, { x: cx, y: SY + 0.15, z: cz }, M.matte, false);
      };
      pave(RA.x0, RA.z0, RA.x1, RA.z1); pave(RB.x0, RB.z0, RB.x1, RB.z1); pave(RC.x0, RC.z0, RC.x1, RC.z1);
      pave(-190, -178, 190, -124, 3); pave(178, -98, 194, 120, 2); pave(-194, -98, -178, 120, 2);
      // lane markings: dashed centre lines, zebra crossings, stop lines
      const dash = (x0, z0, x1, z1) => {
        const len = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(len / 6), a = Math.atan2(z1 - z0, x1 - x0);
        for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; put(flat(3, 0.25), 0xd8d4c8, { x: lerp(x0, x1, t), y: SY + 0.05, z: lerp(z0, z1, t), ry: -a }, M.line, false); }
      };
      dash(-24, -118, -24, 124); dash(-30, -12, 172, -12); dash(-190, 112, 190, 112); dash(-190, -112, 190, -112); dash(172, -118, 172, 124); dash(-172, -118, -172, 124);
      const zebra = (cx, cz, along, len) => { for (let i = -3; i <= 3; i++) { const o = i * 1.6; put(flat(along ? 0.8 : len, along ? len : 0.8), 0xe4e0d4, { x: cx + (along ? o : 0), y: SY + 0.05, z: cz + (along ? 0 : o) }, M.line, false); } };
      zebra(-24, -27, true, 9); zebra(-24, 101, true, 9); zebra(-6, -12, false, 10); zebra(160, 101, true, 9); zebra(-160, -105, true, 9);
      A.streetY = SY;
    }

    // ============================================================ building facades (lit windows) and the north towers
    const facadeTex = (kind) => {
      const W0 = 1024, H0 = 416; // 64 x 26 units
      const col = TX.makeCanvas(W0, H0), emi = TX.makeCanvas(W0, H0);
      const g = col.getContext('2d'), e = emi.getContext('2d');
      e.fillStyle = '#000'; e.fillRect(0, 0, W0, H0);
      const rr = K.rng(kind === 'park' ? 91 : 93);
      if (kind === 'park') {
        // open car park levels: concrete spandrels, a dark interior with tube lights and parked cars
        g.fillStyle = '#7d7a74'; g.fillRect(0, 0, W0, H0);
        for (let lv = 0; lv < 8; lv++) {
          const y0 = lv * 52;
          g.fillStyle = '#0b0c0f'; g.fillRect(0, y0 + 18, W0, 34);
          const ig = g.createLinearGradient(0, y0 + 18, 0, y0 + 52); ig.addColorStop(0, '#2a3036'); ig.addColorStop(1, '#0a0b0d');
          g.fillStyle = ig; g.fillRect(0, y0 + 18, W0, 34);
          e.fillStyle = '#0e1418'; e.fillRect(0, y0 + 18, W0, 34);
          for (let x = 20; x < W0; x += 58) { g.fillStyle = '#eaf6ff'; g.fillRect(x, y0 + 21, 26, 3); e.fillStyle = '#cfe6ff'; e.fillRect(x, y0 + 21, 26, 3); }
          for (let x = 8; x < W0; x += 40) {
            if (rr() < 0.35) continue;
            const cc = ['#2a2c33', '#3a1c1c', '#1c2a3a', '#33332e', '#1e1e22'][Math.floor(rr() * 5)];
            g.fillStyle = cc; g.beginPath(); g.roundRect(x, y0 + 36, 32, 14, 4); g.fill();
            if (rr() < 0.25) { e.fillStyle = '#ff2a1a'; e.fillRect(x + 1, y0 + 42, 3, 3); e.fillRect(x + 28, y0 + 42, 3, 3); g.fillStyle = '#ff2a1a'; g.fillRect(x + 1, y0 + 42, 3, 3); g.fillRect(x + 28, y0 + 42, 3, 3); }
          }
          g.fillStyle = '#8f8c85'; g.fillRect(0, y0, W0, 18);
          g.fillStyle = 'rgba(40,36,30,0.35)'; for (let x = 0; x < W0; x += 3) g.fillRect(x, y0 + 15 + rr() * 3, 2, 3 + rr() * 6);
          g.fillStyle = '#6e6b65'; g.fillRect(0, y0 + 16, W0, 2);
        }
        for (let x = 0; x < W0; x += 128) { g.fillStyle = '#86837c'; g.fillRect(x, 0, 12, H0); }
      } else {
        // office cladding and glazing: 8 floors, a 2-unit window module, some lit windows
        g.fillStyle = '#272c36'; g.fillRect(0, 0, W0, H0);
        for (let fl = 0; fl < 8; fl++) {
          const y0 = fl * 52;
          g.fillStyle = '#3a404c'; g.fillRect(0, y0, W0, 10);
          for (let x = 0; x < W0; x += 32) {
            const lit = rr(), wx = x + 3, wy = y0 + 13, ww = 26, wh = 36;
            const gl = g.createLinearGradient(0, wy, 0, wy + wh); gl.addColorStop(0, '#16202c'); gl.addColorStop(1, '#0a0e14');
            g.fillStyle = gl; g.fillRect(wx, wy, ww, wh);
            if (lit < 0.3) {
              const c = lit < 0.16 ? '#ffd690' : lit < 0.26 ? '#dceeff' : '#86a8ff';
              const part = rr() < 0.3 ? 0.45 + rr() * 0.3 : 1; // blinds half down
              g.fillStyle = c; g.fillRect(wx, wy + wh * (1 - part), ww, wh * part);
              e.fillStyle = c; e.fillRect(wx, wy + wh * (1 - part), ww, wh * part);
              if (part < 1) { g.fillStyle = '#5a5040'; g.fillRect(wx, wy, ww, wh * (1 - part)); e.fillStyle = '#1a140c'; e.fillRect(wx, wy, ww, wh * (1 - part)); }
              if (rr() < 0.3) { g.fillStyle = 'rgba(30,24,20,0.7)'; g.fillRect(wx + 4 + rr() * 12, wy + wh - 14, 6, 14); } // someone at the window
            }
          }
          g.fillStyle = '#20252e'; for (let x = 0; x < W0; x += 32) g.fillRect(x, y0, 3, 52);
        }
      }
      return { map: tex(col), emissiveMap: tex(emi) };
    };
    const offT = facadeTex('office'), parkT = facadeTex('park');
    const facadeMat = K.std({ map: offT.map, emissiveMap: offT.emissiveMap, emissive: 0xffffff, emissiveIntensity: 1.25, roughness: 0.4, metalness: 0.25 });
    const parkMat = K.std({ map: parkT.map, emissiveMap: parkT.emissiveMap, emissive: 0xffffff, emissiveIntensity: 1.2, roughness: 0.8 });
    const facades = { office: [], park: [] };
    // a vertical wall of width w from y0 to y1, centred at (x, z), facing angle `face` (0 = +z / south)
    const wall = (kind, x, z, w, y0, y1, face, u0 = 0) => {
      const g = new T.PlaneGeometry(w, y1 - y0);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * w / 64, uv.getY(i) * (y1 - y0) / 26);
      g.rotateY(face); g.translate(x, (y0 + y1) / 2, z);
      facades[kind].push(g);
    };
    const block = (R, kind, y0, y1, u0) => {
      const w = R.x1 - R.x0, d = R.z1 - R.z0, cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2;
      wall(kind, cx, R.z1, w, y0, y1, 0, u0); wall(kind, cx, R.z0, w, y0, y1, PI, u0 + 0.3);
      wall(kind, R.x1, cz, d, y0, y1, PI / 2, u0 + 0.55); wall(kind, R.x0, cz, d, y0, y1, -PI / 2, u0 + 0.8);
    };
    block(RA, 'park', SY, -0.2, 0); block(RB, 'office', SY, -0.2, 0.17); block(RC, 'office', SY, -0.2, 0.61);
    // the towers along the north edge (and low blocks east and west)
    const TOWERS = [
      { x0: -186, x1: -128, z0: -174, z1: -130, h: 54 }, { x0: -116, x1: -66, z0: -168, z1: -128, h: 82, sign: 'hotel' },
      { x0: -54, x1: -4, z0: -176, z1: -132, h: 46 }, { x0: 8, x1: 62, z0: -166, z1: -128, h: 96, mast: true },
      { x0: 74, x1: 122, z0: -174, z1: -130, h: 64, sign: 'karaoke' }, { x0: 134, x1: 188, z0: -168, z1: -128, h: 50 },
    ];
    TOWERS.forEach((t, i) => {
      block(t, 'office', SY, SY + t.h, i * 0.37);
      const cx = (t.x0 + t.x1) / 2, cz = (t.z0 + t.z1) / 2, w = t.x1 - t.x0, d = t.z1 - t.z0, top = SY + t.h;
      put(box(w, 0.6, d), 0x1c1e24, { x: cx, y: top + 0.3, z: cz }, M.matte);
      put(box(w * 0.5, 4, d * 0.4), 0x2a2d34, { x: cx + w * 0.12, y: top + 2.6, z: cz - d * 0.15 }, M.matte);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) BLINK(cx + sx * (w / 2 - 1), top + 1, cz + sz * (d / 2 - 1), i * 0.4 + (sx + sz) * 0.1);
      if (t.mast) {
        put(cyl(0.5, 0.9, 24, 8), 0x8a8e96, { x: cx, y: top + 12, z: cz }, M.metal);
        BLINK(cx, top + 24.5, cz, 0.7); BLINK(cx, top + 16, cz + 0.6, 0.2);
      }
    });
    for (const [x0, x1] of [[178, 194], [-194, -178]]) for (let z = -96; z < 118; z += 34) {
      const h = 10 + hash(z + x0) * 9;
      block({ x0, x1, z0: z, z1: z + 30 }, 'office', SY, SY + h, hash(z) * 3);
      put(box(x1 - x0, 0.5, 30), 0x2a2c32, { x: (x0 + x1) / 2, y: SY + h + 0.25, z: z + 15 }, M.matte);
    }
    {
      const g1 = BU.mergeGeometries(facades.office, false), g2 = BU.mergeGeometries(facades.park, false);
      meshOf(g1, facadeMat, { cast: true }); meshOf(g2, parkMat, { cast: true });
    }

    // ============================================================ roof surfaces: car park deck, gravel roofs
    {
      const dk = TX.mottledTextures({ size: 512, a: 0x5a5d63, b: 0x4c4f55, c: 0x686b71, seed: 61, period: 10, speck: 0.4, bump: 1.6, pebbles: 300, pebbleColor: 0x6e7076, roughness: [0.18, 0.7] });
      for (const t of Object.values(dk)) t.repeat.set((RA.x1 - RA.x0) / 30, (RA.z1 - RA.z0) / 30);
      const deckMat = K.std({ map: dk.map, normalMap: dk.normalMap, roughnessMap: dk.roughnessMap, normalScale: V2(0.6), roughness: 1 });
      K.mesh(flat(RA.x1 - RA.x0, RA.z1 - RA.z0), deckMat, (RA.x0 + RA.x1) / 2, 0, (RA.z0 + RA.z1) / 2, { cast: false });
      const gv = TX.mottledTextures({ size: 512, a: 0x6a665e, b: 0x524f49, c: 0x7c776d, seed: 62, period: 5, speck: 0.3, bump: 3.2, pebbles: 1400, pebbleColor: 0x8a857b, roughness: [0.35, 0.95] });
      for (const t of Object.values(gv)) t.repeat.set(1 / 18, 1 / 18);
      const gravelMat = K.std({ map: gv.map, normalMap: gv.normalMap, roughnessMap: gv.roughnessMap, normalScale: V2(1.1), roughness: 1, color: 0xb4b0a8 });
      for (const R of [RB, RC]) {
        const g = flat(R.x1 - R.x0, R.z1 - R.z0);
        const uv = g.attributes.uv, pos = g.attributes.position;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) + (R.x0 + R.x1) / 2, -(pos.getZ(i) + (R.z0 + R.z1) / 2));
        g.translate((R.x0 + R.x1) / 2, 0, (R.z0 + R.z1) / 2);
        meshOf(g, gravelMat);
      }
      // the roof slabs' edges show as a thin concrete band above the facades
      for (const R of [RA, RB, RC]) {
        const cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2;
        put(box(R.x1 - R.x0 + 0.4, 0.55, R.z1 - R.z0 + 0.4), 0x8e8b84, { x: cx, y: -0.33, z: cz }, M.matte, false);
      }
    }

    // ============================================================ the course: road ribbon, edge lines, kerbs, tyre marks, start line
    const sG1 = S.land; // car park side of the alley
    {
      const ribbonMat = K.std({ map: asph.map, normalMap: asph.normalMap, roughnessMap: asph.roughnessMap, normalScale: V2(0.7), roughness: 1, color: 0xd8d8de });
      // asphalt everywhere except the kicker (plywood) and the alley
      const g = strip(sG1 - 0.5, L + S.kick0 + 0.3, 0, W + 0.6, 0.035, 1, 14, true);
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (W + 0.6) / 14, uv.getY(i));
      meshOf(g, ribbonMat);
      // white edge lines (dashed across the bridges' joints, none over the gap)
      const lines = [];
      for (const side of [-1, 1]) lines.push(strip(sG1 + 0.6, L + S.kick0 - 0.3, side * (W / 2 - 0.45), 0.35, 0.06, 1, 10, true));
      for (const lg of lines) binPush(M.line, false, 0, 0, prep(lg, 0xe6e4dc, null));
      // red-and-white kerbs on the car park's tight corners, concrete kerbs along the gravel roofs
      const kc = canvas(64, 128, (gg) => { for (let i = 0; i < 4; i++) { gg.fillStyle = i % 2 ? '#efece4' : '#c42a2e'; gg.fillRect(0, i * 32, 64, 32); } });
      const kerbs = [], ckerbs = [];
      for (let s = 0; s < L; s += 2) {
        const p = track.at(s + 1), c = Math.abs(p.curv), roof = roofOf(p.x, p.z);
        if (s + 2 > S.kick0 - 2 && s < S.land + 2) continue;
        if (s + 2 > S.br1a - 1 && s < S.br1b + 1) continue;
        if (s + 2 > S.br2a - 1 && s < S.br2b + 1) continue;
        if (roof === 'A' && c > 1 / 23) { const sd = Math.sign(p.curv); kerbs.push(strip(s, s + 2, sd * (W / 2 + 0.6), 1.3, 0.055, 1, 4)); }
        if (roof === 'B' || roof === 'C') for (const sd of [-1, 1]) ckerbs.push(strip(s, s + 2.02, sd * (W / 2 + 0.55), 1.1, 0.0, 1, 4));
      }
      if (kerbs.length) meshOf(BU.mergeGeometries(kerbs, false), K.std({ map: tex(kc, [1, 1], true), roughness: 0.45, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      if (ckerbs.length) {
        const kg = BU.mergeGeometries(ckerbs, false), ps = kg.attributes.position;
        for (let i = 0; i < ps.count; i++) ps.setY(i, 0.12);
        binPush(M.matte, false, 0, 0, prep(kg, 0x9a978f, null));
      }
      // rubber laid down by drifters on the corners
      const tc = canvas(128, 512, (gg) => {
        gg.clearRect(0, 0, 128, 512);
        for (let i = 0; i < 9; i++) {
          const x = 14 + hash(i * 3.1) * 100, w = 3 + hash(i * 7.7) * 6, a = 0.18 + hash(i * 1.3) * 0.3;
          gg.strokeStyle = `rgba(6,6,8,${a})`; gg.lineWidth = w; gg.beginPath(); gg.moveTo(x, 0);
          for (let y = 0; y <= 512; y += 32) gg.lineTo(x + Math.sin(y / 90 + i) * 9, y);
          gg.stroke();
        }
      });
      const tyre = [];
      for (let s = 0; s < L; s += 3) {
        const p = track.at(s + 1.5);
        if (Math.abs(p.curv) < 1 / 34) continue;
        if (s + 3 > S.kick0 - 2 && s < S.land + 2) continue;
        tyre.push(strip(s, s + 3.05, -Math.sign(p.curv) * 1.2, W - 3, 0.045, 1, 24));
      }
      if (tyre.length) meshOf(BU.mergeGeometries(tyre, false), new T.MeshBasicMaterial({ map: tex(tc, [1, 1], true), color: 0x000000, transparent: true, opacity: 0.85, depthWrite: false }), { order: 1 });
      // start / finish: a chequered band across the deck
      const cc = canvas(256, 64, (gg) => { for (let y = 0; y < 4; y++) for (let x = 0; x < 16; x++) { gg.fillStyle = (x + y) % 2 ? '#121214' : '#f0eee6'; gg.fillRect(x * 16, y * 16, 16, 16); } });
      const p = track.at(52);
      const sm = K.mesh(new T.PlaneGeometry(W, 3.4), K.std({ map: tex(cc, [1, 1], false), roughness: 0.5 }), p.x, 0.07, p.z, { cast: false });
      sm.rotation.order = 'YXZ'; sm.rotation.y = -p.angle + PI / 2; sm.rotation.x = -PI / 2;
    }

    // ============================================================ floor text and arrows (one atlas)
    const decals = [];
    {
      const ac = canvas(1024, 256, (g) => {
        g.clearRect(0, 0, 1024, 256);
        g.fillStyle = '#f2f0e8'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = '900 92px Rubik, Arial, sans-serif';
        g.fillText('SLOW', 128, 64); g.fillText('EXIT', 384, 64);
        g.fillStyle = '#f4c430'; g.fillText('L7', 640, 64);
        g.fillStyle = '#f2f0e8';
        // arrow
        g.beginPath(); g.moveTo(800, 100); g.lineTo(800, 44); g.lineTo(770, 44); g.lineTo(830, 0 + 6); g.lineTo(890, 44); g.lineTo(860, 44); g.lineTo(860, 100); g.closePath();
        g.translate(0, 10); g.fill(); g.translate(0, -10);
        // chevrons (yellow / black) for the kicker
        for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? '#141414' : '#f2c21a'; g.beginPath(); g.moveTo(k * 32, 128); g.lineTo(k * 32 + 32, 128); g.lineTo(k * 32 + 32 + 40, 256); g.lineTo(k * 32 + 40, 256); g.fill(); }
        // hatched box
        g.save(); g.beginPath(); g.rect(256, 136, 240, 112); g.clip();
        g.fillStyle = '#f4c430'; for (let k = -10; k < 20; k++) { g.beginPath(); g.moveTo(256 + k * 28, 136); g.lineTo(256 + k * 28 + 12, 136); g.lineTo(256 + k * 28 + 12 - 112, 248); g.lineTo(256 + k * 28 - 112, 248); g.fill(); }
        g.restore(); g.strokeStyle = '#f4c430'; g.lineWidth = 8; g.strokeRect(260, 140, 232, 104);
        // a big P
        g.fillStyle = '#f2f0e8'; g.font = '900 120px Rubik, Arial, sans-serif'; g.fillText('P', 640, 196);
        // landing cross
        g.strokeStyle = '#f2f0e8'; g.lineWidth = 14; g.beginPath(); g.moveTo(800, 140); g.lineTo(900, 240); g.moveTo(900, 140); g.lineTo(800, 240); g.stroke();
      });
      A.decalTex = tex(ac, [1, 1], false);
    }
    const CELLS = { slow: [0, 0, 256, 128], exit: [256, 0, 256, 128], l7: [512, 0, 256, 128], arrow: [768, 0, 128, 128], chev: [0, 128, 256, 128], hatch: [256, 128, 256, 128], p: [512, 128, 256, 128], cross: [768, 128, 160, 128] };
    const decal = (cell, x, z, w, d, ang, y = 0.07, op = 0.85) => {
      const [cx, cy, cw, ch] = CELLS[cell];
      const g = new T.PlaneGeometry(w, d); g.rotateX(-PI / 2);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (cx + uv.getX(i) * cw) / 1024, 1 - (cy + (1 - uv.getY(i)) * ch) / 256);
      g.rotateY(-ang); g.translate(x, y, z);
      const n = g.attributes.position.count, c = new Float32Array(n * 3).fill(op);
      g.setAttribute('color', new T.BufferAttribute(c, 3));
      decals.push(g.index ? g.toNonIndexed() : g);
    };
    // decal along the track: s, lateral offset; `up` = the top of the graphic points along the driving direction
    const tdecal = (cell, s, off, w, d, y = 0.07, op = 0.85) => { const p = track.place(s, off); decal(cell, p.x, p.z, w, d, p.angle + PI / 2, y, op); };

    // ============================================================ roof edges: parapets with colliders (gaps for bridges, kicker, landing, open edges)
    const PAR = { h: 1.3, t: 0.7 };
    const parRuns = [];
    const edge = (x0, z0, x1, z1, gaps = []) => {
      // split a straight roof edge into runs around the gaps [a, b] (along its main axis)
      const horiz = Math.abs(z1 - z0) < 1e-6, a0 = horiz ? Math.min(x0, x1) : Math.min(z0, z1), a1 = horiz ? Math.max(x0, x1) : Math.max(z0, z1);
      const gs = gaps.slice().sort((p, q) => p[0] - q[0]);
      let cur = a0;
      const runs = [];
      for (const [ga, gb] of gs) { if (ga > cur) runs.push([cur, ga]); cur = Math.max(cur, gb); }
      if (cur < a1) runs.push([cur, a1]);
      // the parapet sits just inside the roof edge
      for (const [a, b] of runs) parRuns.push({ horiz, a, b, c: horiz ? z0 : x0 });
      return runs;
    };
    // which side of the line the roof lies on: probe
    const parapet = (run) => {
      const { horiz, a, b, c } = run;
      const mid = (a + b) / 2;
      const probe = (dx) => (horiz ? roofOf(mid, c + dx) : roofOf(c + dx, mid));
      const sgn = probe(1) ? 1 : -1;
      const off = sgn * PAR.t / 2;
      const len = b - a;
      const cx = horiz ? mid : c + off, cz = horiz ? c + off : mid;
      const w = horiz ? len : PAR.t, d = horiz ? PAR.t : len;
      put(box(w, PAR.h, d), 0x9c9992, { x: cx, y: PAR.h / 2, z: cz }, M.matte);
      put(box(w + (horiz ? 0 : 0.2), 0.12, d + (horiz ? 0.2 : 0)), 0x6e737a, { x: cx, y: PAR.h + 0.06, z: cz }, M.metal);
      K.box(cx, cz, w / 2, d / 2, 0, PAR.h + 0.2);
      // stripes on the parapet ends next to openings
      for (const e of [a, b]) {
        const ex = horiz ? e : cx, ez = horiz ? cz : e;
        put(box(horiz ? 0.75 : PAR.t + 0.06, PAR.h + 0.05, horiz ? PAR.t + 0.06 : 0.75), 0xf2c21a, { x: ex, y: PAR.h / 2, z: ez }, M.paint);
      }
    };
    const openFor = (side) => OPEN.filter((o) => o.side === side).map((o) => [o.a, o.b]);
    edge(RA.x0, RA.z0, RA.x1, RA.z0); // car park north
    edge(RA.x0, RA.z1, RA.x1, RA.z1); // car park south
    edge(RA.x0, RA.z0, RA.x0, RA.z1); // car park west
    edge(RA.x1, RA.z0, RA.x1, RA.z1, [[LAND.z0, LAND.z1], [BR1.z - BR1.hw, BR1.z + BR1.hw]]); // car park east (landing, bridge 1)
    edge(RB.x0, RB.z0, RB.x0, RB.z1, [[BR1.z - BR1.hw, BR1.z + BR1.hw]]); // mall west
    edge(RB.x0, RB.z0, RB.x1, RB.z0, [[BR2.x - BR2.hw, BR2.x + BR2.hw]]); // mall north
    edge(RB.x0, RB.z1, RB.x1, RB.z1, openFor('Bs')); // mall south
    edge(RB.x1, RB.z0, RB.x1, RB.z1); // mall east
    edge(RC.x0, RC.z1, RC.x1, RC.z1, [[BR2.x - BR2.hw, BR2.x + BR2.hw]]); // office south
    edge(RC.x0, RC.z0, RC.x1, RC.z0, openFor('Cn')); // office north
    edge(RC.x0, RC.z0, RC.x0, RC.z1, [[KICK.z - KICK.wid / 2 - 0.3, KICK.z + KICK.wid / 2 + 0.3]]); // office west (kicker)
    edge(RC.x1, RC.z0, RC.x1, RC.z1); // office east
    for (const run of parRuns) parapet(run);
    // the open stretches: a broken edge, some cones and a strip of hazard tape between them
    const cones = [];
    const CONE = (x, z, s = 1) => cones.push({ x, y: 0, z, ry: r() * TAU, s });
    for (const o of OPEN) {
      const zc = o.side === 'Cn' ? RC.z0 : RB.z1, inward = o.side === 'Cn' ? 1 : -1;
      for (let x = o.a + 1.5; x < o.b; x += 6.5) CONE(x, zc + inward * 1.6, 1.1);
      put(box(o.b - o.a, 0.03, 0.12), 0xf2c21a, { x: (o.a + o.b) / 2, y: 0.95, z: zc + inward * 1.6 }, M.glow, false);
      // rubble where the parapet came down
      for (let i = 0; i < 9; i++) put(rbox(0.5 + r() * 0.7, 0.3 + r() * 0.4, 0.4 + r() * 0.6, 0.1), 0x9c9992, { x: lerp(o.a, o.b, r()), y: 0.2, z: zc + inward * (0.5 + r() * 2), ry: r() * 3 }, M.matte);
      // a little sign on a stand at both ends
      for (const x of [o.a - 1, o.b + 1]) {
        put(cyl(0.06, 0.06, 1.6, 5), 0x8a8e96, { x, y: 0.8, z: zc + inward * 1.2 }, M.metal);
        put(box(1.1, 0.75, 0.05), 0xd8231c, { x, y: 1.6, z: zc + inward * 1.2 }, M.paint);
        put(box(0.8, 0.12, 0.06), 0xffffff, { x, y: 1.6, z: zc + inward * 1.2 }, M.paint);
      }
      AO((o.a + o.b) / 2, zc + inward * 1, (o.b - o.a) / 2, 1.5, 0.25);
    }
    // cable trays and pipes along the gravel roofs' parapets (fine detail)
    for (const run of parRuns) {
      const { horiz, a, b, c } = run;
      const mid = (a + b) / 2;
      const roof = horiz ? roofOf(mid, c + 1) || roofOf(mid, c - 1) : roofOf(c + 1, mid) || roofOf(c - 1, mid);
      if (roof === 'A' || b - a < 12) continue;
      const sgn = (horiz ? roofOf(mid, c + 1) : roofOf(c + 1, mid)) ? 1 : -1;
      const o = c + sgn * 1.6;
      const len = b - a - 4, cx = horiz ? mid : o, cz = horiz ? o : mid;
      put(box(horiz ? len : 0.7, 0.25, horiz ? 0.7 : len), 0x8c9098, { x: cx, y: 0.35, z: cz }, M.metal);
      for (let t = a + 3; t < b - 2; t += 4) put(box(horiz ? 0.15 : 0.9, 0.22, horiz ? 0.9 : 0.15), 0x5a5e66, { x: horiz ? t : o, y: 0.11, z: horiz ? o : t }, M.metal, false);
    }

    // ============================================================ bridges: concrete decks, steel railings, lamps
    const bridge = (cx, cz, len, along) => {
      const f = frame(cx, 0, cz, along ? -PI / 2 : 0); // local +x across the street, +z across the deck
      const hw = BR1.hw;
      f(box(len + 1, 1.3, hw * 2), 0x8a8780, { y: -0.67 }, M.matte);
      f(box(len + 1, 0.4, 0.5), 0x6e6b65, { y: -1.5, z: hw - 0.3 }, M.matte);
      f(box(len + 1, 0.4, 0.5), 0x6e6b65, { y: -1.5, z: -hw + 0.3 }, M.matte);
      for (const sz of [-1, 1]) {
        // I-beams under the deck and diagonal braces
        f(box(len + 1, 1.6, 0.3), 0x3a3f48, { y: -2.2, z: sz * (hw - 2.5) }, M.metal);
        for (let x = -len / 2 + 2; x <= len / 2 - 2; x += 4) f(rod([x, -3, sz * (hw - 2.5)], [x + 4, -1.4, sz * (hw - 2.5)], 0.12, 5), 0x3a3f48, {}, M.metal);
        // railing: posts, two rails, a kick plate
        const zr = sz * (hw - 0.35);
        for (let x = -len / 2; x <= len / 2 + 0.01; x += 2) f(box(0.16, 1.25, 0.16), 0x9aa0a8, { x, y: 0.62, z: zr }, M.metal);
        f(box(len, 0.12, 0.12), 0xb8bec6, { y: 1.22, z: zr }, M.metal);
        f(box(len, 0.08, 0.08), 0xb8bec6, { y: 0.7, z: zr }, M.metal);
        f(box(len, 0.25, 0.08), 0x6a6e76, { y: 0.15, z: zr }, M.metal);
        // little lamp posts with warm pools on the deck
        for (const x of [-len / 2 + 3, len / 2 - 3]) {
          f(cyl(0.1, 0.12, 3.2, 6), 0x2e3138, { x, y: 1.6, z: zr }, M.metal);
          f(box(0.6, 0.25, 0.9), 0x2e3138, { x, y: 3.25, z: zr - sz * 0.35 }, M.metal);
          f(box(0.45, 0.04, 0.7), [2.2, 1.9, 1.4], { x, y: 3.1, z: zr - sz * 0.35 }, M.glow, false);
          const [wx, wz] = f.pt(x, zr - sz * 0.35);
          BULB(wx, 3.0, wz, 0xffe0a8, 0.15, 3.5);
          const [px, pz] = f.pt(x, zr - sz * 3.5);
          POOL(px, pz, 5.5, 5.5, 0xffc880, 0.42);
        }
      }
      // colliders: the railings
      const [ax, az] = f.pt(-len / 2 - 0.5, hw - 0.35), [bx, bz] = f.pt(len / 2 + 0.5, hw - 0.35);
      const [cx2, cz2] = f.pt(-len / 2 - 0.5, -hw + 0.35), [dx, dz] = f.pt(len / 2 + 0.5, -hw + 0.35);
      K.capsule(ax, az, bx, bz, 0.35, 1.6); K.capsule(cx2, cz2, dx, dz, 0.35, 1.6);
    };
    bridge((BR1.x0 + BR1.x1) / 2, BR1.z, BR1.x1 - BR1.x0, false);
    bridge(BR2.x, (BR2.z0 + BR2.z1) / 2, BR2.z1 - BR2.z0, true);

    // ============================================================ the kicker: plywood on scaffold tubes, and the alley under it
    {
      const len = KICK.x0 - KICK.x1, hw = KICK.wid / 2, h = KICK.h;
      const cxk = (KICK.x0 + KICK.x1) / 2;
      // sloped deck (local frame: +x = up the ramp = west)
      const f = frame(cxk, 0, KICK.z, PI);
      const ang = Math.atan2(h, len), sl = Math.hypot(len, h);
      const ply = TX.woodTextures({ size: 256, seed: 17, planks: 4, base: 0xb48a58, dark: 0x8a6438, light: 0xd2aa74, ringFreq: 24, gap: 0.01, roughBase: 0.6 });
      for (const t of Object.values(ply)) t.repeat.set(1.5, 1);
      const deck = new T.Mesh(box(sl, 0.25, KICK.wid), K.std({ map: ply.map, normalMap: ply.normalMap, roughness: 0.7, color: 0x8a7458 }));
      deck.position.set(cxk, h / 2 - 0.1, KICK.z); deck.rotation.order = 'YZX'; deck.rotation.y = PI; deck.rotation.z = ang;
      K.add(deck);
      // chevron strips along the deck edges and the steel lip
      for (const sz of [-1, 1]) f(box(sl, 0.06, 0.8), 0xf2c21a, { x: 0, y: h / 2 + 0.06, z: sz * (hw - 0.4), rz: ang }, M.paint, false);
      f(box(0.4, 0.3, KICK.wid), 0x9aa0a8, { x: len / 2 - 0.2, y: h - 0.05 }, M.metal);
      for (let k = -4; k <= 4; k++) { BULB(...f.pt(len / 2 - 0.2, k * 2.1).flatMap((v, i) => (i === 0 ? [v, h + 0.15] : [v])), 0xffa020, 0.12, 2.4); }
      // side panels (triangles) with hazard paint and the scaffold underneath
      for (const sz of [-1, 1]) {
        const sh = new T.Shape(); sh.moveTo(-len / 2, 0); sh.lineTo(len / 2, 0); sh.lineTo(len / 2, h); sh.closePath();
        const g = new T.ShapeGeometry(sh); g.translate(0, 0, sz * hw);
        f(g, 0x2a2a2e, {}, M.paint);
        for (let x = -len / 2 + 2; x <= len / 2; x += 2.5) {
          const yy = (x + len / 2) / len * h;
          f(cyl(0.1, 0.1, yy, 5), 0xa8aeb6, { x, y: yy / 2, z: sz * (hw - 0.3) }, M.metal);
          f(cyl(0.1, 0.1, yy, 5), 0xa8aeb6, { x, y: yy / 2, z: sz * (hw - 6) }, M.metal);
        }
        f(rod([-len / 2 + 1, 0.2, sz * (hw - 0.3)], [len / 2, h - 0.3, sz * (hw - 0.3)], 0.08, 5), 0xa8aeb6, {}, M.metal);
      }
      f(box(0.4, h, KICK.wid), 0x3a3a40, { x: len / 2 - 0.25, y: h / 2 }, M.metal);
      AO(cxk, KICK.z, len / 2 + 1, hw + 1, 0.5);
      // painted warnings on the approach and the landing
      for (let k = 0; k < 3; k++) tdecal('chev', S.kick0 - 6 - k * 5, 0, W - 2, 3.2, 0.072, 0.8);
      tdecal('cross', S.land + 16, -3, 6, 5, 0.072, 0.6); tdecal('cross', S.land + 16, 3.5, 6, 5, 0.072, 0.6);
      // the alley below: a back door with a lamp, bins, a vent, a cat's eyes
      const ax = (RA.x1 + RC.x0) / 2;
      put(box(1.6, 2.6, 0.2), 0x40342a, { x: RC.x0 + 0.1, y: SY + 1.3, z: KICK.z - 18, ry: PI / 2 }, M.paint);
      put(box(0.5, 0.3, 0.6), [2.2, 1.8, 1.2], { x: RC.x0 - 0.3, y: SY + 3.2, z: KICK.z - 18 }, M.glow, false);
      POOL(ax, KICK.z - 18, 5, 7, 0xffb868, 0.55, 0, SY + 0.12);
      for (let i = 0; i < 3; i++) put(rbox(2.2, 1.6, 1.4, 0.12), [0x2a5a3a, 0x2a3a5a, 0x5a3a2a][i], { x: RA.x1 + 1.2, y: SY + 0.8, z: KICK.z - 10 + i * 2.6 }, M.paint);
      put(cyl(0.6, 0.6, 26, 10), 0x5a5e66, { x: RA.x1 + 0.7, y: SY + 13, z: KICK.z + 14 }, M.metal);
      BULB(RC.x0 - 0.8, SY + 0.4, KICK.z + 6, 0x9cff6a, 0.06, 0.6); BULB(RC.x0 - 0.8, SY + 0.4, KICK.z + 6.3, 0x9cff6a, 0.06, 0.6);
    }

    // ============================================================ instanced kit: jersey barriers, cones, parked cars
    const jerseys = [];
    const JERSEY = (x, z, ang, col = 0xc8c6c0) => jerseys.push({ x, y: 0, z, ry: -ang, color: col });
    // a barrier chain between points [[x, z], ...]: blocks of ~3 units, a capsule collider per stretch
    const chain = (pts, col, collide = true) => {
      for (let i = 0; i + 1 < pts.length; i++) {
        const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
        const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 3)), a = Math.atan2(z1 - z0, x1 - x0);
        for (let k = 0; k < n; k++) {
          const t = (k + 0.5) / n;
          JERSEY(lerp(x0, x1, t), lerp(z0, z1, t), a, typeof col === 'function' ? col(k) : col);
        }
        if (collide) K.capsule(x0, z0, x1, z1, 0.45, 1.3);
        AO((x0 + x1) / 2, (z0 + z1) / 2, len / 2 + 0.6, 0.9, 0.35, a);
      }
    };
    const parked = [];
    const CAR = (x, z, ang, col, y = 0, collide = true) => {
      parked.push({ x, y, z, ry: -ang, color: col });
      if (collide) K.box(x, z, 2.15, 1.0, ang, 1.4);
      AO(x, z, 2.6, 1.4, 0.5, ang, y + 0.06);
    };
    const carCols = [0x9a1c22, 0x1c3a6a, 0xd8d8d2, 0x22252a, 0x6a6e76, 0x2a5a3a, 0xc8a030, 0x3a2a4a, 0xeceae2, 0x5a1a2a];
    const pickCol = () => r.pick(carCols);
    // a row of parking bays (painted lines) with some cars in them; bays face `face` (radians, nose direction)
    // is a circle of radius rad at (x, z) free of colliders?
    const free = (x, z, rad) => {
      for (const c of physics.colliders) {
        if (c.bb && (x + rad < c.bb[0] || x - rad > c.bb[2] || z + rad < c.bb[1] || z - rad > c.bb[3])) continue;
        if (physics.circleVsCollider(x, z, rad, c)) return false;
      }
      return true;
    };
    // a row of parking bays along x (painted lines) with some cars parked nose-first towards `face`
    const bayRow = (x0, x1, zc, face, fill = 0.7, depth = 5, lineCol = 0xe6e4dc) => {
      const n = Math.floor((x1 - x0) / 2.6), dz = Math.sin(face);
      for (let i = 0; i <= n; i++) {
        const x = x0 + i * 2.6;
        if (dRoad(x, zc) < 1.5) continue;
        put(flat(0.13, depth), lineCol, { x, y: 0.03, z: zc }, M.line, false);
        const cx = x + 1.3, cz = zc + dz * 0.5;
        if (i < n && dRoad(cx, zc) > 3.4 && hash(x * 1.7 + zc * 3.1) < fill && free(cx, cz - 1.2, 0.95) && free(cx, cz + 1.2, 0.95)) {
          CAR(cx, cz, face + (hash(x + zc) - 0.5) * 0.06, pickCol());
          put(box(1.6, 0.12, 0.25), 0x8a8780, { x: cx, y: 0.06, z: zc + dz * (depth / 2 - 0.4) }, M.matte, false);
        }
      }
    };

    // ============================================================ the car park: islands, ramp housing, masts, cars
    const MAST = (x, z, h = 11, heads = 2, ry = 0, poolK = 1) => {
      if (dRoad(x, z) < 2.2) return;
      put(cyl(0.22, 0.3, h, 8), 0x50555e, { x, y: h / 2, z }, M.metal);
      put(cyl(0.7, 0.8, 0.6, 10), 0x8a8780, { x, y: 0.3, z }, M.matte);
      for (let k = 0; k < heads; k++) {
        const a = ry + k * PI, hx = x + Math.cos(a) * 1.5, hz = z + Math.sin(a) * 1.5;
        put(box(3.2, 0.14, 0.14), 0x50555e, { x: (x + hx) / 2, y: h - 0.2, z: (z + hz) / 2, ry: -a }, M.metal);
        put(box(1.4, 0.35, 0.7), 0x2e3138, { x: hx, y: h - 0.1, z: hz, ry: -a }, M.metal);
        put(box(1.2, 0.04, 0.55), [2.4, 2.2, 1.9], { x: hx, y: h - 0.3, z: hz, ry: -a }, M.glow, false);
        BULB(hx, h - 0.4, hz, 0xfff0d8, 0.2, 5);
        POOL(x + Math.cos(a) * 4, z + Math.sin(a) * 4, 11 * poolK, 11 * poolK, 0xffe2b8, 0.42);
      }
      K.circle(x, z, 0.8, h);
      AO(x, z, 1.4, 1.4, 0.45);
    };
    const RED = (k) => (k % 2 ? 0xc8c6c0 : 0xc42a2e);
    const rh = { x0: -122, x1: -88, z0: 20.6, z1: 29.4 }; // the ramp housing on spine 1
    {
      // --- chicane island: a kerbed disc round a light mast, red/white barriers trailing south
      const ix = -92, iz = -56.4;
      put(cyl(3.0, 3.2, 0.3, 24), 0x8a8780, { x: ix, y: 0.15, z: iz }, M.matte);
      put(cyl(3.25, 3.25, 0.18, 24, true), 0xf2c21a, { x: ix, y: 0.2, z: iz }, M.paint);
      K.circle(ix, iz, 3.1, 1.3);
      MAST(ix, iz, 12, 2, 0);
      chain([[ix, iz + 3.4], [ix, iz + 15]], RED);
      decal('hatch', ix, iz + 9, 6, 9, 0, 0.035, 0.7);
      // --- W0: a barrier line across the north-west bays, from the west road to the east parapet
      chain([[-133.6, -27], [-36.6, -27]], 0xc8c6c0);
      for (const x of [-118, -88, -58]) MAST(x, -27, 11, 2, PI / 2);
      // --- spine 1: the ramp housing with barriers round it, on to the west parapet
      chain([[-165.2, 25], [rh.x0 - 0.6, 25]], 0xc8c6c0);
      chain([[rh.x0, 19.6], [rh.x1 + 1.5, 19.6]], RED);
      chain([[rh.x0, 30.4], [rh.x1 + 1.5, 30.4]], RED);
      chain([[rh.x1 + 1.5, 19.6], [rh.x1 + 3.6, 25], [rh.x1 + 1.5, 30.4]], 0xc42a2e);
      K.box((rh.x0 + rh.x1) / 2, 25, (rh.x1 - rh.x0) / 2, (rh.z1 - rh.z0) / 2, 0, 4);
      MAST(-140, 25, 11, 2, PI / 2);
      // --- spine 2: barrier line from the U-turn's tip to the east parapet
      chain([[-131.4, 57.2], [-133.6, 61], [-131.4, 64.8]], 0xc42a2e);
      chain([[-133.6, 61], [-36.6, 61]], (k) => (k % 4 === 0 ? 0xc42a2e : 0xc8c6c0));
      for (const x of [-120, -90, -60]) MAST(x, 61, 11, 2, PI / 2);
      // masts round the deck edges
      MAST(-104, 93.4, 10, 1, -PI / 2, 0.8); MAST(-62, 93.4, 10, 1, -PI / 2, 0.8); MAST(-150, -97, 11, 1, PI / 2); MAST(-75, -97, 11, 1, PI / 2);
      MAST(-161, -66, 11, 1, 0); MAST(-161, 0, 11, 1, 0); MAST(-40, 40, 11, 1, PI); MAST(-40, -10, 11, 1, PI);
      // the ramp housing: an opening, the ramp down into the lit level below, walls, columns, a translucent canopy
      {
        const cx = (rh.x0 + rh.x1) / 2, w = rh.x1 - rh.x0, d = rh.z1 - rh.z0;
        put(flat(w - 1, d - 1.6), 0x0a0b0d, { x: cx, y: 0.02, z: 25 }, M.glow, false);
        const dn = 4.2;
        const rg = new T.PlaneGeometry(w - 2, d - 2.4); rg.rotateX(-PI / 2); rg.rotateZ(Math.atan2(dn, w - 2));
        put(rg, 0x3a3d44, { x: cx, y: -dn / 2 + 0.02, z: 25 }, M.matte, false);
        for (let i = 0; i < 5; i++) put(box(1.6, 0.05, 0.15), [1.6, 1.8, 2.0], { x: rh.x0 + 3 + i * 6.5, y: -0.4 - i * 0.7, z: 25 + (i % 2 ? 2.5 : -2.5) }, M.glow, false);
        for (const sz of [-1, 1]) {
          put(box(w, 1.2, 0.5), 0xa8a59e, { x: cx, y: 0.6, z: 25 + sz * (d / 2 - 0.25) }, M.matte);
          for (let x = rh.x0 + 1; x <= rh.x1 - 1; x += 8) put(box(0.5, 3.6, 0.5), 0x9c9992, { x, y: 1.8, z: 25 + sz * (d / 2 - 0.25) }, M.matte);
        }
        put(box(0.5, 1.2, d), 0xa8a59e, { x: rh.x1 - 0.25, y: 0.6, z: 25 }, M.matte);
        const canopy = new T.Mesh(box(w + 1.4, 0.18, d + 1.6), K.phys({ color: 0x9ab8c8, roughness: 0.3, transparent: true, opacity: 0.45, depthWrite: false, clearcoat: 1 }));
        canopy.position.set(cx, 3.7, 25); canopy.castShadow = true; canopy.renderOrder = 2; K.group.add(canopy);
        for (let x = rh.x0; x <= rh.x1; x += 4) put(box(0.16, 0.22, d + 1.6), 0x50555e, { x, y: 3.85, z: 25 }, M.metal);
        AO(cx, 25, w / 2 + 2, d / 2 + 2, 0.45);
        A.rampSign = { x: rh.x1 + 0.2, z: 25 };
      }
      // stair and lift core with a lit glass door (north-east of the car park)
      {
        const f = frame(-52, 0, -91, 0);
        f(box(12, 6.5, 8), 0xa29f98, { y: 3.25 }, M.matte);
        f(box(12.4, 0.4, 8.4), 0x6e6b65, { y: 6.7 }, M.matte);
        f(box(3, 2.6, 0.1), [0.9, 1.4, 1.6], { x: -2, y: 1.3, z: 4.02 }, M.glow, false);
        f(box(3.4, 0.25, 0.4), 0x2e3138, { x: -2, y: 2.8, z: 4.15 }, M.metal);
        f(box(1.4, 3.6, 0.1), [1.3, 1.5, 1.4], { x: 3.2, y: 3.2, z: 4.02 }, M.glow, false);
        f(box(1.2, 1.4, 0.8), 0x3a3d44, { x: 4.5, y: 0.7, z: 5 }, M.paint); // ticket machine
        f(box(0.8, 0.5, 0.1), [0.6, 1.5, 1.2], { x: 4.5, y: 1.1, z: 5.42 }, M.glow, false);
        f.box(0, 0, 6, 4, 7); f.box(4.5, 5, 0.6, 0.4, 1.5);
        POOL(-54, -84, 7, 6, 0x9fd8ff, 0.5);
        AO(-52, -91, 7, 5, 0.5);
        A.coreSign = { x: -52, z: -86.9, y: 7.2 };
      }
      // column stubs with rusty rebar (a level that was never built)
      for (const [x, z] of [[-163, -84], [-163, 44], [-40, -84], [-40, 26], [-40, -40], [-50, 46], [-150, 86]]) {
        if (dRoad(x, z) < 3) continue;
        put(box(1.1, 1.0, 1.1), 0x9c9992, { x, y: 0.5, z }, M.matte);
        for (const [dx, dz] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) put(cyl(0.05, 0.05, 1.2, 4), 0x7a4a2a, { x: x + dx, y: 1.6, z: z + dz, rx: (hash(x + dx) - 0.5) * 0.3, rz: (hash(z + dz) - 0.5) * 0.3 }, M.metal, false);
        K.box(x, z, 0.6, 0.6, 0, 1.2);
        AO(x, z, 1, 1, 0.4);
      }
      // parking bays on both sides of every barrier line, along the north parapet and in the open deck
      bayRow(-130, -40, -30.5, PI / 2, 0.72); bayRow(-130, -40, -23.5, -PI / 2, 0.6);
      bayRow(-128, -40, -44.5, PI / 2, 0.5); bayRow(-128, -40, -8.5, -PI / 2, 0.45);
      bayRow(-162, -126, 21.5, PI / 2, 0.7); bayRow(-162, -126, 28.5, -PI / 2, 0.7);
      bayRow(-130, -40, 57.5, PI / 2, 0.66); bayRow(-130, -40, 64.5, -PI / 2, 0.66);
      bayRow(-160, -130, -95.6, -PI / 2, 0.6); bayRow(-94, -62, -95.6, -PI / 2, 0.6);
      for (let x = -150; x < -40; x += 2.6) if (dRoad(x, 92) > 1.5) put(flat(0.13, 4), 0xe6e4dc, { x, y: 0.03, z: 93.5 }, M.line, false);
      // painted words and arrows
      tdecal('slow', sAt(-104, 8), 0, 7, 3.5, 0.07, 0.75);
      tdecal('slow', sAt(-120, 42), 0, 7, 3.5, 0.07, 0.75);
      tdecal('arrow', sAt(-144, -20), 0, 3.4, 3.4, 0.07, 0.7);
      tdecal('arrow', sAt(-144, 61), 0, 3.4, 3.4, 0.07, 0.7);
      decal('exit', -80, 34, 6, 3, 0, 0.07, 0.6);
      decal('l7', -150, 14, 5, 2.5, 0, 0.07, 0.8);
      decal('p', -48, -50, 5, 5, 0, 0.07, 0.5);
      // cones on the open deck: past the landing and at the apexes of the car park's corners
      for (let s = S.land + 4; s < S.land + 22; s += 6) { const p = track.place(s, -(W / 2 + 2)); CONE(p.x, p.z); }
      for (let s = 0; s < L; s += 7) {
        const p = track.at(s);
        if (roofOf(p.x, p.z) !== 'A' || Math.abs(p.curv) < 1 / 26) continue;
        const q = track.place(s, Math.sign(p.curv) * (W / 2 + 1.8));
        if (dRoad(q.x, q.z) > 1.2 && roofOf(q.x, q.z) === 'A' && free(q.x, q.z, 0.6)) CONE(q.x, q.z, 0.95);
      }
    }

    // ============================================================ the mall roof: billboard, skylights, stair hut, AC units, water tower
    const acs = [];
    const AC = (x, z, ry = 0, big = false) => {
      if (dRoad(x, z) < (big ? 5 : 3.5) || !roofOf(x, z)) return;
      const f = frame(x, 0, z, ry);
      const w = big ? 4.4 : 2.6, d = big ? 2.4 : 1.5, h = big ? 2.0 : 1.4;
      f(rbox(w, h, d, 0.12, 1), 0xb8bcc2, { y: h / 2 }, M.paint);
      for (const sx of big ? [-1, 1] : [0]) {
        f(cyl(0.62, 0.62, 0.08, 16), 0x24262a, { x: sx * 1.05, y: h + 0.02 }, M.metal);
        f(cyl(0.15, 0.15, 0.1, 8), 0x8a8e96, { x: sx * 1.05, y: h + 0.06 }, M.metal);
      }
      f(box(w - 0.4, h - 0.5, 0.04), 0x3a3d44, { y: h / 2, z: d / 2 + 0.01 }, M.metal);
      f(box(0.9, 0.08, 0.9), 0x5a5e66, { x: -w / 2 - 0.3, y: 0.04 }, M.metal, false);
      f.box(0, 0, w / 2 + 0.1, d / 2 + 0.1, h);
      AO(x, z, w / 2 + 0.8, d / 2 + 0.8, 0.45, -ry);
      acs.push({ x, z });
    };
    {
      // billboard facing south over the S-bend
      const bx = 44, bz = 16, bw = 22, bh = 7.5, by = 7;
      const bc = canvas(1024, 352, (g) => {
        const gr = g.createLinearGradient(0, 0, 1024, 352); gr.addColorStop(0, '#1a1036'); gr.addColorStop(1, '#3a0e3e');
        g.fillStyle = gr; g.fillRect(0, 0, 1024, 352);
        g.fillStyle = '#ff5fd2'; g.font = '110px "Lilita One", Impact, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
        g.fillText('MIDNIGHT', 300, 110);
        g.fillStyle = '#ffd56a'; g.font = '128px "Lilita One", Impact, sans-serif'; g.fillText('NOODLES', 300, 225);
        g.fillStyle = '#e8e6f0'; g.font = '700 34px Rubik, Arial, sans-serif'; g.fillText('hot bowls till 4 am · rooftop terrace', 304, 312);
        // a steaming bowl
        g.fillStyle = '#f4ecdc'; g.beginPath(); g.ellipse(150, 200, 120, 30, 0, 0, TAU); g.fill();
        g.fillStyle = '#e8392a'; g.beginPath(); g.moveTo(30, 200); g.quadraticCurveTo(150, 360, 270, 200); g.fill();
        g.fillStyle = '#f2c46a'; g.beginPath(); g.ellipse(150, 196, 104, 22, 0, 0, TAU); g.fill();
        g.strokeStyle = '#2a1a0a'; g.lineWidth = 6; g.beginPath(); g.moveTo(180, 150); g.lineTo(290, 40); g.moveTo(200, 160); g.lineTo(300, 60); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 7; for (const x of [110, 150, 190]) { g.beginPath(); g.moveTo(x, 160); g.bezierCurveTo(x - 20, 130, x + 20, 110, x, 80); g.stroke(); }
      });
      const bm = new T.Mesh(new T.PlaneGeometry(bw, bh), K.std({ map: tex(bc, [1, 1], false), emissiveMap: tex(bc, [1, 1], false), emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.5 }));
      bm.position.set(bx, by, bz + 0.35); bm.receiveShadow = true; K.group.add(bm);
      const f = frame(bx, 0, bz, 0);
      f(box(bw + 0.6, bh + 0.6, 0.5), 0x2a2d34, { y: by }, M.metal);
      for (const sx of [-1, 1]) {
        f(box(0.6, by - bh / 2, 0.6), 0x3a3f48, { x: sx * bw * 0.32, y: (by - bh / 2) / 2 }, M.metal);
        f(rod([sx * bw * 0.32, 0.2, -3], [sx * bw * 0.32, by - bh / 2, -0.2], 0.15, 5), 0x3a3f48, {}, M.metal);
        f.box(sx * bw * 0.32, 0, 0.5, 0.5, by);
      }
      f(box(bw, 0.12, 1.2), 0x50555e, { y: by - bh / 2 - 0.2, z: 0.7 }, M.metal); // catwalk
      for (let k = -2; k <= 2; k++) { f(box(0.4, 0.4, 0.6), 0x2e3138, { x: k * 4.5, y: by - bh / 2 - 0.1, z: 1.5, rx: -0.6 }, M.metal); f(box(0.3, 0.05, 0.4), [2, 1.8, 1.5], { x: k * 4.5, y: by - bh / 2 - 0.02, z: 1.75, rx: -0.6 }, M.glow, false); }
      AO(bx, bz, bw / 2 + 1, 3, 0.4);
      POOL(bx, bz + 6, 14, 5, 0xff7ad8, 0.25);
      // the stair hut with a lit door and an antenna mast with a red light
      const sf = frame(100, 0, 13, 0);
      sf(box(7, 3.6, 4.6), 0xa29f98, { y: 1.8 }, M.matte);
      sf(box(7.6, 0.3, 5.2), 0x5a5e66, { y: 3.75 }, M.metal);
      sf(box(1.4, 2.3, 0.08), [2.1, 1.7, 1.15], { x: -1.4, y: 1.15, z: 2.31 }, M.glow, false);
      sf(box(0.5, 0.25, 0.4), 0x2e3138, { x: -1.4, y: 2.7, z: 2.5 }, M.metal);
      sf(cyl(0.12, 0.2, 14, 6), 0x9aa0a8, { x: 2.4, y: 3.9 + 7, z: -1 }, M.metal);
      for (let k = 0; k < 3; k++) sf(box(1.6 - k * 0.4, 0.06, 0.06), 0x9aa0a8, { x: 2.4, y: 9 + k * 2.4, z: -1 }, M.metal);
      BLINK(102.4, 18.1, 12, 0.3);
      sf.box(0, 0, 3.6, 2.4, 4);
      POOL(98.6, 18, 5, 4.5, 0xffc070, 0.6);
      AO(100, 13, 4.5, 3.2, 0.5);
      A.hutSign = { x: 101, z: 15.4, y: 3.2 };
      // glowing skylights over the mall's atrium
      for (const [x, z] of [[72, 80], [86, 80], [72, 90.5], [86, 90.5]]) {
        put(box(9, 0.5, 6.6), 0x8a8780, { x, y: 0.25, z }, M.matte);
        put(box(8.4, 0.08, 6), [1.25, 1.1, 0.8], { x, y: 0.52, z }, M.glow, false);
        for (let i = -3; i <= 3; i++) put(box(0.1, 0.5, 6), 0x5a5e66, { x: x + i * 1.2, y: 0.75, z }, M.metal, false);
        put(box(9, 0.12, 0.12), 0x5a5e66, { x, y: 1.0, z }, M.metal, false);
        K.box(x, z, 4.5, 3.3, 0, 1.0);
        POOL(x, z, 7, 6, 0xffd6a0, 0.22);
      }
      // the water tower on the mall roof's south-east, outside the double-apex left
      {
        const wx = 140, wz = 80;
        const f2 = frame(wx, 0, wz, 0.3);
        const leg = 6.2, R = 3.4;
        for (let i = 0; i < 4; i++) {
          const a = i * PI / 2 + PI / 4, lx = Math.cos(a) * R * 0.95, lz = Math.sin(a) * R * 0.95;
          f2(cyl(0.22, 0.26, leg, 6), 0x4a4038, { x: lx, y: leg / 2, z: lz }, M.metal);
          f2(rod([lx, 0.5, lz], [Math.cos(a + PI / 2) * R * 0.95, leg - 0.6, Math.sin(a + PI / 2) * R * 0.95], 0.07, 4), 0x4a4038, {}, M.metal);
        }
        f2(cyl(R + 0.4, R + 0.4, 0.3, 20), 0x3a3028, { y: leg + 0.15 }, M.metal);
        const stave = canvas(256, 64, (g) => { for (let x = 0; x < 256; x += 8) { const v = 90 + hash(x) * 40; g.fillStyle = `rgb(${v + 30},${v},${v - 30})`; g.fillRect(x, 0, 7, 64); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x + 7, 0, 1, 64); } });
        const tank = new T.Mesh(cyl(R, R, 6.2, 24), K.std({ map: tex(stave, [2, 1], true), roughness: 0.8, color: 0x8a7a68 }));
        tank.position.set(wx, leg + 3.4, wz); tank.castShadow = true; tank.receiveShadow = true; K.group.add(tank);
        f2(new T.ConeGeometry(R + 0.3, 2.2, 24), 0x3a3430, { y: leg + 7.6 }, M.metal);
        for (const y of [leg + 1.4, leg + 3.4, leg + 5.4]) f2(new T.TorusGeometry(R + 0.04, 0.07, 4, 28).rotateX(PI / 2), 0x2a2a2e, { y }, M.metal);
        f2(cyl(0.08, 0.08, leg + 8, 4), 0x6a6e76, { x: R + 0.2, y: (leg + 8) / 2 }, M.metal); // ladder rail
        BLINK(wx, leg + 8.9, wz, 0.55);
        K.circle(wx, wz, R + 0.3, leg + 7);
        AO(wx, wz, R + 2, R + 2, 0.5);
      }
      // a rooftop terrace by the billboard: timber deck, planters, parasols and festoon lights
      {
        const tx = 9, tz = 42, tw = 28, td = 22;
        put(box(tw, 0.3, td), 0x6a4a30, { x: tx, y: 0.15, z: tz }, M.matte);
        for (let i = 0; i < 12; i++) put(box(tw, 0.02, 0.06), 0x3a2818, { x: tx, y: 0.31, z: tz - td / 2 + 1 + i * 1.8 }, M.matte, false);
        // planters round the edge (also the colliders)
        const pl = [[tx, tz + td / 2 - 0.6, tw, 1.2], [tx, tz - td / 2 + 0.6, tw, 1.2], [tx + tw / 2 - 0.6, tz, 1.2, td - 2.4], [tx - tw / 2 + 0.6, tz + 3, 1.2, td - 8.4]];
        for (const [x, z, w, d] of pl) {
          put(box(w, 0.9, d), 0x8a8780, { x, y: 0.75, z }, M.matte);
          K.box(x, z, w / 2, d / 2, 0, 1.3);
          const n = Math.max(2, Math.round(Math.max(w, d) / 1.6));
          for (let k = 0; k < n; k++) {
            const t = (k + 0.5) / n, sx = w > d ? lerp(x - w / 2, x + w / 2, t) : x, sz = w > d ? z : lerp(z - d / 2, z + d / 2, t);
            put(new T.IcosahedronGeometry(0.75 + hash(sx + sz) * 0.35, 0), [0x1e3a24, 0x2a4a2a, 0x24402a][k % 3], { x: sx, y: 1.5, z: sz, ry: hash(sx) * 3 }, M.matte);
          }
        }
        // tables with parasols and stools
        for (const [x, z, c] of [[tx - 7, tz - 4, 0xc42a2e], [tx + 1, tz - 5, 0x2a9a9a], [tx - 3, tz + 4, 0xe8dcc0], [tx + 7, tz + 3, 0xc42a2e]]) {
          put(cyl(0.7, 0.7, 0.08, 12), 0xd8d2c4, { x, y: 1.0, z }, M.paint);
          put(cyl(0.06, 0.06, 2.6, 5), 0x8a8e96, { x, y: 1.6, z }, M.metal);
          put(new T.ConeGeometry(1.7, 0.6, 8), c, { x, y: 2.9, z }, M.paint);
          for (let k = 0; k < 3; k++) { const a = k * 2.1 + x; put(cyl(0.22, 0.22, 0.7, 6), 0x3a3d44, { x: x + Math.cos(a) * 1.2, y: 0.65, z: z + Math.sin(a) * 1.2 }, M.paint); }
          AO(x, z, 1.8, 1.8, 0.35, 0, 0.32);
        }
        // the bar counter with a glowing front
        put(box(7, 1.1, 1.2), 0x2a2018, { x: tx + 6, y: 0.85, z: tz - 8.4 }, M.paint);
        put(box(6.6, 0.12, 0.05), [2.0, 1.2, 0.6], { x: tx + 6, y: 0.9, z: tz - 7.78 }, M.glow, false);
        // festoon lights on four posts, zigzagging across
        const posts = [[tx - tw / 2 + 1.5, tz - td / 2 + 1.5], [tx + tw / 2 - 1.5, tz - td / 2 + 1.5], [tx + tw / 2 - 1.5, tz + td / 2 - 1.5], [tx - tw / 2 + 1.5, tz + td / 2 - 1.5]];
        for (const [x, z] of posts) put(cyl(0.08, 0.1, 4, 5), 0x3a3d44, { x, y: 2.15, z }, M.metal);
        const strings = [[posts[0], posts[2]], [posts[1], posts[3]], [posts[0], posts[1]], [posts[3], posts[2]]];
        for (const [[x0, z0], [x1, z1]] of strings) {
          const len = Math.hypot(x1 - x0, z1 - z0), n = Math.round(len / 1.4);
          for (let k = 1; k < n; k++) { const t = k / n; BULB(lerp(x0, x1, t), 4.1 - Math.sin(t * PI) * 1.1, lerp(z0, z1, t), k % 3 ? 0xffd68a : 0xff9a6a, 0.08, 1.4); }
        }
        POOL(tx, tz, tw / 2 + 2, td / 2 + 2, 0xffc078, 0.35, 0, 0.36);
        AO(tx, tz, tw / 2 + 1, td / 2 + 1, 0.35);
      }
      // galvanised ducts from the AC plant
      for (const [x0, z0, x1, z1] of [[30, 12, 64, 12], [64, 12, 64, 22], [86, 10, 112, 10]]) {
        const len = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(z1 - z0, x1 - x0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
        if (dRoad(cx, cz) < 4) continue;
        put(box(len + 1.1, 1.0, 1.1), 0xa8aeb6, { x: cx, y: 1.0, z: cz, ry: -a }, M.metal);
        for (let t = 2; t < len; t += 5) put(box(0.3, 0.5, 1.3), 0x6a6e76, { x: lerp(x0, x1, t / len), y: 0.25, z: lerp(z0, z1, t / len), ry: -a }, M.metal, false);
        K.box(cx, cz, len / 2 + 0.55, 0.55, a, 1.5);
        AO(cx, cz, len / 2 + 0.8, 1.0, 0.35, a);
      }
      // AC units and vents across the mall roof
      for (const [x, z, ry, big] of [[6, 8, 0, true], [14, 8, 0, true], [22, 8, 0, false], [6, 16, 0, false], [70, 6, 0, true], [78, 6, 0, true], [86, 6, 0, false],
        [118, 10, PI / 2, true], [124, 10, PI / 2, true], [120, 88, 0, true], [128, 88, 0, true], [100, 70, 0, false], [158, 30, PI / 2, false], [158, 50, PI / 2, true],
        [58, 92, 0, false], [100, 92, 0, true], [152, 60, PI / 2, false]]) AC(x, z, ry, big);
      // round exhaust vents with caps
      for (const [x, z] of [[30, 22], [34, 24], [62, 24], [110, 28], [96, 62], [150, 92]]) {
        if (dRoad(x, z) < 3) continue;
        if (x === 34 || x === 96) A.steam.push([x, 2.0, z]);
        put(cyl(0.45, 0.45, 1.6, 10), 0x9aa0a8, { x, y: 0.8, z }, M.metal); put(cyl(0.75, 0.75, 0.2, 10), 0x6a6e76, { x, y: 1.7, z }, M.metal);
        K.circle(x, z, 0.6, 1.8); AO(x, z, 0.9, 0.9, 0.4);
      }
    }

    // ============================================================ the office roof: helipad deck, neon frames, antenna, AC units
    {
      // raised helipad deck (cars can't climb it)
      const hx = (HELI.x0 + HELI.x1) / 2, hz = (HELI.z0 + HELI.z1) / 2, hw = (HELI.x1 - HELI.x0) / 2, hd = (HELI.z1 - HELI.z0) / 2;
      put(box(hw * 2, HELI.h, hd * 2), 0x6e6c66, { x: hx, y: HELI.h / 2, z: hz }, M.matte);
      const hc = canvas(512, 512, (g) => {
        g.fillStyle = '#2c3138'; g.fillRect(0, 0, 512, 512);
        for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${60 + Math.random() * 40},${60 + Math.random() * 40},${70 + Math.random() * 40},0.12)`; g.fillRect(Math.random() * 512, Math.random() * 512, 3, 3); }
        g.strokeStyle = '#e8e6de'; g.lineWidth = 14; g.beginPath(); g.arc(256, 256, 200, 0, TAU); g.stroke();
        g.strokeStyle = '#f2c21a'; g.lineWidth = 6; g.setLineDash([24, 14]); g.beginPath(); g.arc(256, 256, 228, 0, TAU); g.stroke(); g.setLineDash([]);
        g.fillStyle = '#e8e6de'; g.fillRect(176, 146, 40, 220); g.fillRect(296, 146, 40, 220); g.fillRect(176, 236, 160, 40);
        g.fillStyle = '#e8e6de'; g.font = '700 30px Rubik, Arial, sans-serif'; g.textAlign = 'center'; g.fillText('4.2', 256, 410);
      });
      const pad = new T.Mesh(flat(hd * 2 - 1, hd * 2 - 1), K.std({ map: tex(hc, [1, 1], false), roughness: 0.4, metalness: 0.1 }));
      pad.position.set(hx, HELI.h + 0.035, hz); pad.receiveShadow = true; K.group.add(pad);
      // deck around the pad: grating
      put(box(hw * 2 - 0.2, 0.04, hd * 2 - 0.2), 0x3a3e46, { x: hx, y: HELI.h - 0.01, z: hz }, M.metal, false);
      // railing round the edge, a stair down on the east side
      for (const sz of [-1, 1]) {
        put(box(hw * 2, 0.08, 0.08), 0xc8ccd2, { x: hx, y: HELI.h + 1.0, z: hz + sz * (hd - 0.1) }, M.metal);
        put(box(0.08, 0.08, hd * 2), 0xc8ccd2, { x: hx + sz * (hw - 0.1), y: HELI.h + 1.0, z: hz }, M.metal);
        for (let x = HELI.x0; x <= HELI.x1; x += 3) put(box(0.08, 1, 0.08), 0xc8ccd2, { x, y: HELI.h + 0.5, z: hz + sz * (hd - 0.1) }, M.metal, false);
        for (let z = HELI.z0; z <= HELI.z1; z += 3) put(box(0.08, 1, 0.08), 0xc8ccd2, { x: hx + sz * (hw - 0.1), y: HELI.h + 0.5, z }, M.metal, false);
      }
      for (let i = 0; i < 6; i++) put(box(2, 0.12, 0.6), 0x8a8e96, { x: HELI.x1 + 1.1, y: HELI.h - 0.2 - i * 0.4, z: hz + 6 + i * 0.6 }, M.metal);
      // green edge lights in a ring, white floodlights on the corners
      for (let i = 0; i < 20; i++) { const a = i / 20 * TAU; BULB(hx + Math.cos(a) * (hd - 2.2), HELI.h + 0.2, hz + Math.sin(a) * (hd - 2.2), 0x4aff7a, 0.14, 2.2); }
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const x = hx + sx * (hw - 0.6), z = hz + sz * (hd - 0.6);
        put(cyl(0.1, 0.1, 2.2, 6), 0x50555e, { x, y: HELI.h + 1.1, z }, M.metal);
        put(box(0.6, 0.4, 0.4), 0x2e3138, { x, y: HELI.h + 2.2, z }, M.metal);
        BULB(x - sx * 0.3, HELI.h + 2.1, z - sz * 0.3, 0xf4f8ff, 0.18, 3.5);
      }
      POOL(hx, hz, hw + 4, hd + 4, 0xbfe8d0, 0.18, 0, HELI.h + 0.08);
      // windsock
      put(cyl(0.08, 0.1, 6, 6), 0xd8d8d2, { x: HELI.x0 + 1, y: HELI.h + 3, z: HELI.z0 + 1 }, M.metal);
      const sock = new T.Mesh(cyl(0.45, 0.2, 2.6, 10, true).rotateZ(PI / 2).translate(1.3, 0, 0), K.std({ color: 0xf26a1a, roughness: 0.7, side: T.DoubleSide }));
      sock.position.set(HELI.x0 + 1, HELI.h + 5.7, HELI.z0 + 1); K.group.add(sock); A.sock = sock;
      AO(hx, hz, hw + 1.5, hd + 1.5, 0.5);
      // lattice antenna mast with red lights at the north-east corner
      {
        const ax = 158, az = -60, hh = 22;
        for (const [dx, dz] of [[-0.9, -0.9], [0.9, -0.9], [0, 0.9]]) put(cyl(0.09, 0.09, hh, 4), 0xc8ccd2, { x: ax + dx * (1 - 0.0), y: hh / 2, z: az + dz }, M.metal);
        for (let y = 1.5; y < hh; y += 2) put(new T.TorusGeometry(1.0, 0.05, 3, 3).rotateX(PI / 2), 0xc8ccd2, { x: ax, y, z: az }, M.metal, false);
        put(cyl(0.05, 0.05, 6, 4), 0xc8ccd2, { x: ax, y: hh + 3, z: az }, M.metal);
        BLINK(ax, hh + 6.2, az, 0.1); BLINK(ax + 0.8, hh * 0.55, az, 0.6);
        put(box(1.2, 1.6, 0.4), 0xe8e6de, { x: ax - 0.8, y: 12, z: az + 0.6 }, M.paint); // dish panel
        K.circle(ax, az, 1.4, hh);
        AO(ax, az, 2, 2, 0.4);
      }
      // AC units and vents on the office roof
      for (const [x, z, ry, big] of [[20, -40, 0, true], [28, -40, 0, true], [36, -40, 0, false], [0, -34, 0, false], [-8, -34, 0, true], [110, -30, 0, true], [118, -30, 0, true],
        [110, -40, 0, false], [44, -30, 0, true], [52, -30, 0, false], [154, -30, PI / 2, true], [156, -42, PI / 2, false], [10, -95, 0, true], [18, -95, 0, true], [-18, -95, 0, false], [125, -96, 0, true], [133, -96, 0, false]]) AC(x, z, ry, big);
      for (const [x, z] of [[4, -44], [60, -26], [104, -26], [124, -40]]) {
        if (dRoad(x, z) < 3) continue;
        if (x === 60 || x === 124) A.steam.push([x, 3.0, z]);
        put(cyl(0.45, 0.45, 2.4, 10), 0x9aa0a8, { x, y: 1.2, z }, M.metal); put(new T.ConeGeometry(0.9, 0.6, 10), 0x6a6e76, { x, y: 2.6, z }, M.metal);
        K.circle(x, z, 0.6, 2.6); AO(x, z, 0.9, 0.9, 0.4);
      }
    }

    // ============================================================ neon signs: atlas, frames, halos, wet reflections
    const NEON = {};
    {
      const rows = {
        skybar: { y: 0, h: 128, c: '#ff3fd2', c2: '#ffd0f4', text: 'SKY BAR', icon: 'glass' },
        ramen: { y: 128, h: 128, c: '#ffa42a', c2: '#fff0c8', text: 'RAMEN 24H', icon: 'bowl' },
        hotel: { y: 256, h: 128, c: '#36e8ff', c2: '#e6fdff', text: 'HOTEL' },
        karaoke: { y: 384, h: 128, c: '#ff4f9a', c2: '#ffe0ec', text: 'KARAOKE', icon: 'star' },
        exit: { y: 512, h: 128, c: '#36e8ff', c2: '#e6fdff', text: 'EXIT ↓' },
        open: { y: 640, h: 128, c: '#ff3a2a', c2: '#ffd8c8', text: 'OPEN' },
        cat: { x: 0, y: 768, w: 256, h: 256, c: '#36e8ff', c2: '#e6fdff', icon: 'cat' },
        park: { x: 256, y: 768, w: 256, h: 256, c: '#4aa8ff', c2: '#ffffff', icon: 'P' },
        arrow: { x: 512, y: 768, w: 512, h: 256, c: '#ffa42a', c2: '#fff0c8', icon: 'arrow' },
      };
      const tube = (g, c, c2, draw, w = 9) => {
        g.save();
        g.strokeStyle = c; g.shadowColor = c; g.shadowBlur = 26; g.lineWidth = w + 6; g.globalAlpha = 0.55; draw(true); g.globalAlpha = 1;
        g.shadowBlur = 14; g.lineWidth = w; draw(true);
        g.shadowBlur = 0; g.strokeStyle = c2; g.lineWidth = w * 0.38; draw(true);
        g.restore();
      };
      const text = (g, s, x, y, size, c, c2) => {
        g.font = `${size}px "Lilita One", Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.save(); g.shadowColor = c; g.shadowBlur = 30; g.fillStyle = c; g.globalAlpha = 0.6; g.fillText(s, x, y); g.globalAlpha = 1;
        g.shadowBlur = 12; g.fillText(s, x, y); g.shadowBlur = 0;
        g.lineWidth = 3; g.strokeStyle = c2; g.strokeText(s, x, y); g.restore();
      };
      const icon = (g, kind, cx, cy, s, c, c2) => {
        if (kind === 'glass') tube(g, c, c2, () => { g.beginPath(); g.moveTo(cx - s, cy - s * 0.8); g.lineTo(cx + s, cy - s * 0.8); g.lineTo(cx, cy + s * 0.2); g.closePath(); g.moveTo(cx, cy + s * 0.2); g.lineTo(cx, cy + s * 0.9); g.moveTo(cx - s * 0.5, cy + s * 0.9); g.lineTo(cx + s * 0.5, cy + s * 0.9); g.moveTo(cx + s * 0.3, cy - s * 0.8); g.lineTo(cx + s * 0.75, cy - s * 1.25); g.stroke(); g.beginPath(); g.arc(cx + s * 0.45, cy - s * 0.5, s * 0.16, 0, TAU); g.stroke(); });
        if (kind === 'bowl') tube(g, c, c2, () => { g.beginPath(); g.moveTo(cx - s, cy); g.quadraticCurveTo(cx, cy + s * 1.5, cx + s, cy); g.closePath(); g.stroke(); for (const k of [-0.4, 0, 0.4]) { g.beginPath(); g.moveTo(cx + k * s, cy - s * 0.2); g.bezierCurveTo(cx + k * s - s * 0.25, cy - s * 0.5, cx + k * s + s * 0.25, cy - s * 0.7, cx + k * s, cy - s * 1.0); g.stroke(); } });
        if (kind === 'star') tube(g, c, c2, () => { g.beginPath(); for (let i = 0; i <= 10; i++) { const a = -PI / 2 + i * PI / 5, rr = i % 2 ? s * 0.42 : s; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.stroke(); });
        if (kind === 'cat') tube(g, c, c2, () => {
          g.beginPath(); g.moveTo(cx - s, cy + s * 0.7); g.lineTo(cx - s, cy - s * 0.3); g.lineTo(cx - s * 0.75, cy - s); g.lineTo(cx - s * 0.35, cy - s * 0.55); g.lineTo(cx + s * 0.35, cy - s * 0.55); g.lineTo(cx + s * 0.75, cy - s); g.lineTo(cx + s, cy - s * 0.3); g.lineTo(cx + s, cy + s * 0.7); g.closePath(); g.stroke();
          g.beginPath(); g.ellipse(cx - s * 0.4, cy, s * 0.14, s * 0.22, 0, 0, TAU); g.stroke(); g.beginPath(); g.ellipse(cx + s * 0.4, cy, s * 0.14, s * 0.22, 0, 0, TAU); g.stroke();
          g.beginPath(); g.moveTo(cx - s * 0.15, cy + s * 0.32); g.lineTo(cx, cy + s * 0.45); g.lineTo(cx + s * 0.15, cy + s * 0.32); g.stroke();
        }, 8);
        if (kind === 'P') { tube(g, c, c2, () => { g.beginPath(); g.roundRect(cx - s, cy - s, s * 2, s * 2, s * 0.3); g.stroke(); }, 8); text(g, 'P', cx, cy + s * 0.08, s * 1.7, '#ffffff', '#ffffff'); }
        if (kind === 'arrow') tube(g, c, c2, () => { g.beginPath(); g.moveTo(cx - s * 1.9, cy - s * 0.25); g.lineTo(cx + s * 0.6, cy - s * 0.25); g.lineTo(cx + s * 0.6, cy - s * 0.7); g.lineTo(cx + s * 1.9, cy); g.lineTo(cx + s * 0.6, cy + s * 0.7); g.lineTo(cx + s * 0.6, cy + s * 0.25); g.lineTo(cx - s * 1.9, cy + s * 0.25); g.closePath(); g.stroke(); }, 10);
      };
      const atlas = canvas(1024, 1024, (g) => {
        g.clearRect(0, 0, 1024, 1024);
        for (const [k, R] of Object.entries(rows)) {
          const x0 = R.x ?? 0, w = R.w ?? 1024;
          g.save(); g.beginPath(); g.rect(x0, R.y, w, R.h); g.clip();
          if (R.text) {
            const hasIcon = !!R.icon;
            text(g, R.text, x0 + w / 2 + (hasIcon ? 70 : 0), R.y + R.h / 2 + 4, 92, R.c, R.c2);
            if (hasIcon) icon(g, R.icon, x0 + 110, R.y + R.h / 2 + 6, 40, R.c, R.c2);
          } else icon(g, R.icon, x0 + w / 2, R.y + R.h / 2, R.icon === 'arrow' ? 110 : 88, R.c, R.c2);
          g.restore();
          NEON[k] = { u0: x0 / 1024, u1: (x0 + w) / 1024, v0: 1 - (R.y + R.h) / 1024, v1: 1 - R.y / 1024, aspect: w / R.h };
        }
      });
      const blurred = canvas(1024, 1024, (g) => { g.filter = 'blur(10px)'; g.drawImage(atlas, 0, 0); g.filter = 'blur(3px)'; g.globalAlpha = 0.6; g.drawImage(atlas, 0, 0); });
      A.neonTex = tex(atlas, [1, 1], false); A.neonBlur = tex(blurred, [1, 1], false);
    }
    const neonParts = [], haloParts = [], reflParts = [], flickParts = [];
    // a sign facing `face` (0 = south), centred at (x, y, z), height h; reflection streak on the ground below if `refl`
    const SIGN = (key, x, y, z, h, face = 0, { refl = 0.55, flicker = false, gy0 = 0 } = {}) => {
      const N = NEON[key], w = h * N.aspect;
      const mk = (ww, hh, u0, u1, v0, v1) => {
        const g = new T.PlaneGeometry(ww, hh), uv = g.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, lerp(u0, u1, uv.getX(i)), lerp(v0, v1, uv.getY(i)));
        return g;
      };
      const g = mk(w, h, N.u0, N.u1, N.v0, N.v1); g.rotateY(face); g.translate(x, y, z);
      (flicker ? flickParts : neonParts).push(prep(g, [1.5, 1.5, 1.5], null));
      const hg = mk(w * 1.25, h * 1.6, N.u0, N.u1, N.v0, N.v1);
      hg.rotateY(face); hg.translate(x - Math.sin(face) * 0.3, y, z - Math.cos(face) * 0.3);
      haloParts.push(prep(hg, [0.85, 0.85, 0.85], null));
      if (refl > 0) {
        // a smeared, mirrored copy on the wet ground in front of the sign (towards the viewer)
        const len = h * 2.6;
        const rg = mk(w * 1.05, len, N.u0, N.u1, N.v1, N.v0);
        rg.rotateX(-PI / 2); rg.translate(0, 0, len / 2); rg.rotateY(face); rg.translate(x, gy0 + 0.09, z);
        const n = rg.attributes.position.count, c = new Float32Array(n * 3), pos = rg.attributes.position;
        for (let i = 0; i < n; i++) {
          const dz = (pos.getX(i) - x) * Math.sin(face) + (pos.getZ(i) - z) * Math.cos(face);
          const k = refl * (1 - clamp(dz / len, 0, 1)) ** 1.4;
          c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = k;
        }
        const rp = prep(rg, null, null); rp.setAttribute('color', new T.BufferAttribute(c, 3));
        reflParts.push(rp);
      }
      return w;
    };
    // a steel frame behind a sign standing on the roof
    const signFrame = (x, z, w, y0, y1, face = 0) => {
      const f = frame(x, 0, z, face);
      for (let lx = -w / 2; lx <= w / 2 + 0.01; lx += w / Math.max(1, Math.round(w / 4))) {
        f(box(0.22, y1, 0.22), 0x2a2d33, { x: lx, y: y1 / 2, z: -0.6 }, M.metal);
        f(rod([lx, 0.2, -2.6], [lx, y1 * 0.6, -0.6], 0.07, 4), 0x2a2d33, {}, M.metal);
        f.box(lx, -1, 0.4, 1.4, 1.4);
      }
      for (const y of [y0, (y0 + y1) / 2, y1]) f(box(w + 0.4, 0.16, 0.16), 0x2a2d33, { y, z: -0.6 }, M.metal);
      f(box(w, 0.1, 1.1), 0x3a3d44, { y: y0 - 0.35, z: -0.4 }, M.metal); // catwalk
      for (let lx = -w / 2 + 1; lx < w / 2; lx += 2.2) f(box(0.18, 0.18, 0.5), 0x50555e, { x: lx, y: y0 - 0.1, z: -0.35 }, M.metal, false); // transformer boxes
      AO(x, z - 0.8, w / 2 + 1, 1.8, 0.35, face);
    };
    {
      // office roof, north edge: SKY BAR with its glass
      let w = SIGN('skybar', 62, 6.4, -96.6, 4.2, 0, { refl: 0.62 });
      signFrame(62, -96.6, w * 0.9, 4.1, 8.6);
      POOL(62, -92, w * 0.6, 9, 0xff3fd2, 0.35);
      // office roof, north-west: the cat
      w = SIGN('cat', 34, 6.2, -96.4, 6.5, 0, { refl: 0.5, flicker: true });
      signFrame(34, -96.4, w, 3.0, 9.4);
      POOL(34, -90, 8, 8, 0x36e8ff, 0.3);
      // car park, north edge: RAMEN 24H
      w = SIGN('ramen', -112, 6.2, -96.6, 4.0, 0, { refl: 0.62 });
      signFrame(-112, -96.6, w * 0.9, 4.0, 8.4);
      POOL(-112, -92, w * 0.6, 9, 0xffa42a, 0.35);
      // mall roof, north edge: an arrow pointing the way to the bridge
      w = SIGN('arrow', 104, 5.4, 1.4, 3.6, 0, { refl: 0.55 });
      signFrame(104, 1.4, w * 0.9, 3.5, 7.3);
      POOL(104, 6, w * 0.6, 7, 0xffa42a, 0.3);
      // the car park's P on the stair core and EXIT over the ramp housing, OPEN on the stair hut
      SIGN('park', A.coreSign.x, A.coreSign.y + 1.7, A.coreSign.z - 1, 3.2, 0, { refl: 0.4 });
      SIGN('exit', A.rampSign.x + 0.12, 3.0, A.rampSign.z, 1.0, PI / 2, { refl: 0.45 });
      SIGN('open', A.hutSign.x + 0.6, 3.05, A.hutSign.z - 0.05, 0.75, 0, { refl: 0.3 });
      // towers: HOTEL and KARAOKE crowns on their south faces
      const t2 = TOWERS[1], t5 = TOWERS[4];
      SIGN('hotel', (t2.x0 + t2.x1) / 2, SY + t2.h - 4, t2.z1 + 0.3, 7, 0, { refl: 0 });
      SIGN('karaoke', (t5.x0 + t5.x1) / 2, SY + t5.h - 4, t5.z1 + 0.3, 6, 0, { refl: 0 });
      SIGN('cat', t5.x0 + 6, SY + 20, t5.z1 + 0.3, 6, 0, { refl: 0 });
      // coloured washes from the biggest signs
      const wash = (c, x, y, z, i, d) => { const pl = new T.PointLight(c, i, d, 1.6); pl.position.set(x, y, z); K.group.add(pl); return pl; };
      A.washes = [wash(0xff4fd8, 62, 8, -93, 260, 62), wash(0xffa040, -112, 8, -93, 240, 60), wash(0x5ad8ff, -50, 9, -84, 60, 40)];
    }
    {
      const mkNeon = (parts, map, k, order, flick = false) => {
        if (!parts.length) return null;
        const mat = new T.MeshBasicMaterial({ map, vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, color: new T.Color(k, k, k), toneMapped: false });
        const m = meshOf(BU.mergeGeometries(parts, false), mat, { order });
        m.castShadow = false; m.receiveShadow = false;
        if (flick) A.flickMat = mat;
        return mat;
      };
      mkNeon(neonParts, A.neonTex, 1.25, 5); mkNeon(flickParts, A.neonTex, 1.25, 5, true);
      mkNeon(haloParts, A.neonBlur, 0.9, 4); mkNeon(reflParts, A.neonBlur, 1.0, 3);
    }

    // ============================================================ hazards: puddles (water), an oil patch (slick); decorative puddles everywhere
    {
      const wetMat = K.phys({ color: 0x141c2c, roughness: 0.02, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 4, emissive: 0x111a30, transparent: true, opacity: 0.42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
      const puddles = [];
      const PUD = (x, z, rad, stretch = 1.4, ang = 0, kind = null) => {
        const poly = K.blobOutline(r, x, z, rad, 0.4, 28, stretch, ang);
        const sh = new T.Shape(); sh.moveTo(poly[0][0], -poly[0][1]); for (let i = 1; i < poly.length; i++) sh.lineTo(poly[i][0], -poly[i][1]);
        const g = new T.ShapeGeometry(sh, 2); g.rotateX(-PI / 2); g.translate(0, groundY(x, z) + 0.05, 0);
        puddles.push(g.index ? g.toNonIndexed() : g);
        if (kind) K.surface(kind, { poly });
        return poly;
      };
      // physics puddles: just off the line on the outside of two corner exits
      {
        const s1 = sAt(-110, 42), q1 = track.place(s1, 5.2); PUD(q1.x, q1.z, 2.4, 1.6, q1.angle, 'water');
        const s2 = sAt(90, -84), q2 = track.place(s2, -5.0); PUD(q2.x, q2.z, 2.6, 1.7, q2.angle, 'water');
        // an oil patch from a leaky parked car (iridescent), on the inside edge of the mall S
        const s3 = sAt(40, 60), q3 = track.place(s3, -6.4);
        const poly = K.blobOutline(r, q3.x, q3.z, 1.9, 0.45, 24, 1.4, q3.angle);
        const sh = new T.Shape(); sh.moveTo(poly[0][0], -poly[0][1]); for (let i = 1; i < poly.length; i++) sh.lineTo(poly[i][0], -poly[i][1]);
        const og = new T.ShapeGeometry(sh, 2); og.rotateX(-PI / 2); og.translate(0, 0.06, 0);
        meshOf(og, K.phys({ color: 0x0a0a10, roughness: 0.05, clearcoat: 1, iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [200, 700], polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
        K.surface('slick', { poly });
        A.hazards = [[q1.x, q1.z], [q2.x, q2.z], [q3.x, q3.z]];
      }
      // decorative puddles: deck low spots, roof edges, the streets
      for (let i = 0; i < 120; i++) {
        const x = lerp(-164, 164, r()), z = lerp(-98, 94, r());
        const rf = roofOf(x, z);
        if (!rf || (x > KICK.x1 - 2 && x < KICK.x0 + 2 && Math.abs(z - KICK.z) < 12)) continue;
        if (x > HELI.x0 - 1 && x < HELI.x1 + 1 && z > HELI.z0 - 1 && z < HELI.z1 + 1) continue;
        const d = dRoad(x, z);
        if (d < 1.5) continue; // the racing surface only gets the two real puddles
        PUD(x, z, r.range(0.8, 2.6), r.range(1, 2.2), r() * TAU);
      }
      for (let i = 0; i < 26; i++) { const x = lerp(-190, 190, r()), z = r() < 0.5 ? lerp(100, 124, r()) : lerp(-122, -102, r()); const sh = new T.Shape(); const rr = r.range(1, 3); sh.absellipse(0, 0, rr * 1.6, rr, 0, TAU); const g = new T.ShapeGeometry(sh, 10); g.rotateX(-PI / 2); g.rotateY(r() * TAU); g.translate(x, SY + 0.06, z); puddles.push(g.index ? g.toNonIndexed() : g); }
      meshOf(BU.mergeGeometries(puddles.map((g) => { for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); return g; }), false), wetMat, { order: 1 });
    }

    // ============================================================ the streets below: lamps, parked cars, trees, traffic
    {
      const lampPts = [];
      for (let z = -114; z < 124; z += 26) { lampPts.push([-37.6, z, 1]); lampPts.push([-10.4, z + 13, -1]); }
      for (let x = -170; x < 190; x += 30) { lampPts.push([x, 98.4, 2]); lampPts.push([x + 15, -101.6, 3]); lampPts.push([x + 8, -122.4, 2]); }
      for (let x = 0; x < 170; x += 28) lampPts.push([x, -0.4, 2]);
      for (const [x, z, d] of lampPts) {
        if (Math.abs(x - BR1.x0) < 1 && Math.abs(z - BR1.z) < 12) continue;
        const ox = d === 1 ? 1.2 : d === -1 ? -1.2 : 0, oz = d === 2 ? -1.2 : d === 3 ? 1.2 : 0;
        put(cyl(0.12, 0.16, 6, 6), 0x2a2d33, { x, y: SY + 3, z }, M.metal);
        put(box(Math.abs(ox) * 1.2 + 0.2, 0.12, Math.abs(oz) * 1.2 + 0.2), 0x2a2d33, { x: x + ox / 2, y: SY + 6, z: z + oz / 2 }, M.metal, false);
        put(box(0.7, 0.18, 0.5), [2.2, 1.8, 1.25], { x: x + ox, y: SY + 5.9, z: z + oz }, M.glow, false);
        BULB(x + ox, SY + 5.75, z + oz, 0xffcf8a, 0.12, 3);
        POOL(x + ox * 3, z + oz * 3, 7, 7, 0xffb868, 0.42, 0, SY + 0.1);
      }
      // trees on the south pavement
      for (let x = -160; x < 170; x += 22) {
        if (Math.abs(x + 24) < 12) continue;
        put(cyl(0.15, 0.22, 3, 6), 0x3a2a1e, { x, y: SY + 1.8, z: 98.2 }, M.matte);
        put(new T.IcosahedronGeometry(1.8, 1), 0x1e3a24, { x, y: SY + 4.3, z: 98.2, sy: 1.2 }, M.matte);
        AO(x, 98.2, 1.8, 1.8, 0.4, 0, SY + 0.35);
      }
      // parked cars along the kerbs (no colliders down here)
      for (let i = 0; i < 26; i++) {
        const side = r();
        if (side < 0.35) { const z = lerp(-110, 120, r()); if (Math.abs(z - 80) < 12 || Math.abs(z + 12) < 12) continue; CAR(-34.2, z, PI / 2, pickCol(), SY + 0.32, false); }
        else if (side < 0.7) { const x = lerp(-180, 180, r()); if (Math.abs(x + 24) < 12) continue; CAR(x, 100.6, 0, pickCol(), SY + 0.32, false); }
        else { const x = lerp(0, 170, r()); if (Math.abs(x - BR2.x) < 12) continue; CAR(x, -20.4, PI, pickCol(), SY + 0.32, false); }
      }
      // traffic: little cars with their lights on, looping along the streets (animated)
      const routes = [
        { ax: -27, az: 124, bx: -27, bz: -120, v: 10 }, { ax: -21, az: -120, bx: -21, bz: 124, v: 12 },
        { ax: -30, az: -15, bx: 194, bz: -15, v: 11 }, { ax: 194, az: -9, bx: -30, bz: -9, v: 9 },
        { ax: -194, az: 109, bx: 194, bz: 109, v: 13 }, { ax: 194, az: 115, bx: -194, bz: 115, v: 10 },
        { ax: -194, az: -109, bx: 194, bz: -109, v: 12 }, { ax: 194, az: -115, bx: -194, bz: -115, v: 11 },
      ];
      A.traffic = [];
      routes.forEach((rt, i) => {
        const len = Math.hypot(rt.bx - rt.ax, rt.bz - rt.az);
        const n = len > 300 ? 2 : 1;
        for (let k = 0; k < n; k++) A.traffic.push({ ...rt, len, ph: (k / n + hash(i * 3.3) * 0.5) * len, col: carCols[(i * 3 + k) % carCols.length] });
      });
    }

    // ============================================================ fine scatter: pigeons on the parapets, litter, gravel, leaves
    const pigeons = [], litter = [], pebbles = [];
    for (const run of parRuns) {
      const n = Math.floor((run.b - run.a) / 22);
      for (let i = 0; i < n; i++) {
        if (r() < 0.45) continue;
        const t = lerp(run.a + 2, run.b - 2, r());
        const x = run.horiz ? t : run.c, z = run.horiz ? run.c : t;
        for (let k = 0; k < 1 + Math.floor(r() * 3); k++) pigeons.push({ x: x + (run.horiz ? k * 0.5 : 0), y: PAR.h + 0.16, z: z + (run.horiz ? 0 : k * 0.5), ry: r() * TAU, s: r.range(0.9, 1.2), color: r.pick([0x7a7e88, 0x6a6e78, 0x8a8a90, 0x5a5a62]) });
      }
    }
    for (let i = 0; i < 260; i++) {
      const x = lerp(-164, 164, r()), z = lerp(-98, 94, r());
      if (!roofOf(x, z) || dRoad(x, z) < 1.2) continue;
      const kind = r();
      if (kind < 0.35) litter.push({ x, y: 0.12, z, rx: PI / 2, rz: r() * TAU, ry: r() * TAU, sx: 0.12, sy: 0.32, sz: 0.12, color: r.pick([0xd8231c, 0x2a7ad2, 0xc8ccd2, 0x2aa24a]) }); // cans
      else if (kind < 0.65) litter.push({ x, y: 0.15, z, ry: r() * TAU, rx: r(), rz: r(), s: r.range(0.18, 0.32), color: r.pick([0xe8e4d8, 0xd8d2c0, 0xf0ece0]) }); // paper
      else litter.push({ x, y: 0.05, z, ry: r() * TAU, sx: r.range(0.3, 0.6), sy: 0.04, sz: r.range(0.2, 0.4), color: r.pick([0x5a3a1e, 0x7a5a2a, 0x3a2a1a]) }); // wet leaves
    }
    for (let i = 0; i < (lowQ ? 260 : 700); i++) {
      // loose gravel kicked onto the edges of the roof road
      const s = r() * L, p = track.at(s);
      const rf = roofOf(p.x, p.z);
      if (rf !== 'B' && rf !== 'C') continue;
      const q = track.place(s, (r() < 0.5 ? -1 : 1) * (W / 2 + r.range(-1.4, 2.2)));
      pebbles.push({ x: q.x, y: 0.12, z: q.z, ry: r() * 6, rx: r() * 6, s: r.range(0.1, 0.24), color: r.pick([0x9a958b, 0x7c776d, 0xaaa59a, 0x6a665e]) });
    }

    // ============================================================ flush: instanced kit, baked bins, contacts, pools, bulbs
    {
      // jersey barrier: profile extruded along x (3 units long)
      const prof = new T.Shape();
      prof.moveTo(-0.32, 0); prof.lineTo(-0.32, 0.08); prof.lineTo(-0.24, 0.26); prof.lineTo(-0.11, 0.86); prof.lineTo(0.11, 0.86); prof.lineTo(0.24, 0.26); prof.lineTo(0.32, 0.08); prof.lineTo(0.32, 0); prof.closePath();
      const jg = new T.ExtrudeGeometry(prof, { depth: 2.9, bevelEnabled: false }); jg.translate(0, 0, -1.45); jg.rotateY(PI / 2);
      K.instances(jg, K.std({ roughness: 0.82, map: concrete.map, normalMap: concrete.normalMap }), jerseys, { colors: true });
      const cg = BU.mergeGeometries([new T.ConeGeometry(0.3, 0.75, 10).translate(0, 0.42, 0), new T.BoxGeometry(0.7, 0.06, 0.7).translate(0, 0.03, 0)], false);
      const cm = K.instances(cg, K.phys({ color: 0xff6a1a, roughness: 0.4, clearcoat: 0.6, emissive: 0x401000 }), cones, { colors: false });
      cm.castShadow = true;
      // parked cars: body, glass, wheels
      const body = BU.mergeGeometries([rbox(4.3, 0.7, 1.95, 0.25, 1).translate(0, 0.62, 0), rbox(2.3, 0.62, 1.72, 0.25, 1).translate(-0.25, 1.2, 0)], false);
      const glass = rbox(2.36, 0.46, 1.76, 0.18, 1).translate(-0.25, 1.24, 0);
      const wheels = BU.mergeGeometries([[-1.35, -0.86], [1.35, -0.86], [-1.35, 0.86], [1.35, 0.86]].map(([x, z]) => cyl(0.36, 0.36, 0.26, 8).rotateX(PI / 2).translate(x, 0.36, z)), false);
      K.instances(body, K.phys({ roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08, metalness: 0.3 }), parked, { colors: true });
      K.instances(glass, K.phys({ color: 0x0c1016, roughness: 0.05, clearcoat: 1, metalness: 0.4 }), parked);
      K.instances(wheels, K.std({ color: 0x141416, roughness: 0.7 }), parked, { cast: false });
      // traffic (animated): same shapes plus head- and tail-lights
      const tl = BU.mergeGeometries([box(0.1, 0.18, 0.4).translate(2.16, 0.68, -0.62), box(0.1, 0.18, 0.4).translate(2.16, 0.68, 0.62)], false);
      const rl = BU.mergeGeometries([box(0.1, 0.16, 0.44).translate(-2.16, 0.72, -0.6), box(0.1, 0.16, 0.44).translate(-2.16, 0.72, 0.6)], false);
      const n = A.traffic.length;
      const mk = (g, mat, colors) => { const im = new T.InstancedMesh(g, mat, n); im.castShadow = false; im.receiveShadow = true; im.frustumCulled = false; if (colors) A.traffic.forEach((c, i) => im.setColorAt(i, new T.Color(c.col))); K.group.add(im); return im; };
      A.tBody = mk(body, K.phys({ roughness: 0.3, clearcoat: 1, metalness: 0.3 }), true);
      A.tGlass = mk(glass, K.phys({ color: 0x0c1016, roughness: 0.05, clearcoat: 1 }), false);
      A.tHead = mk(tl, new T.MeshBasicMaterial({ color: new T.Color(0xfff2d0).multiplyScalar(2) }), false);
      A.tTail = mk(rl, new T.MeshBasicMaterial({ color: new T.Color(0xff2010).multiplyScalar(1.6) }), false);
      A.tBeams = [];
      // pigeons, litter, pebbles
      const pg = BU.mergeGeometries([new T.IcosahedronGeometry(0.12, 0).scale(1.5, 1, 1), new T.IcosahedronGeometry(0.07, 0).translate(0.17, 0.08, 0), new T.ConeGeometry(0.06, 0.18, 3).rotateZ(PI / 2).translate(-0.24, 0.02, 0).toNonIndexed()], false);
      K.instances(pg, K.std({ roughness: 0.8 }), pigeons, { colors: true, cast: false });
      K.instances(new T.IcosahedronGeometry(1, 0), K.std({ roughness: 0.6 }), litter, { colors: true, cast: false });
      K.instances(new T.IcosahedronGeometry(1, 0), K.std({ roughness: 0.85 }), pebbles, { colors: true, cast: false });
    }
    if (decals.length) meshOf(BU.mergeGeometries(decals, false), K.std({ map: A.decalTex, vertexColors: true, transparent: true, depthWrite: false, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), { order: 1 });
    for (const { mat, cast, parts } of bins.values()) {
      const g = BU.mergeGeometries(parts, false); g.computeBoundingSphere();
      const m = new T.Mesh(g, mat); m.castShadow = cast; m.receiveShadow = !mat.isMeshBasicMaterial; K.group.add(m);
    }
    bins.clear();
    {
      const g = flat(1, 1);
      const im = K.instances(g, contactMat, contacts, { cast: false, receive: false }); im.renderOrder = 1;
    }
    const glowTex = tex(canvas(128, 128, (g) => { const q = g.createRadialGradient(64, 64, 0, 64, 64, 64); q.addColorStop(0, 'rgba(255,255,255,1)'); q.addColorStop(0.3, 'rgba(255,255,255,0.42)'); q.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = q; g.fillRect(0, 0, 128, 128); }), [1, 1], false);
    {
      const im = K.instances(flat(1, 1), new T.MeshBasicMaterial({ map: glowTex, transparent: true, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }), pools, { cast: false, receive: false, colors: true });
      im.renderOrder = 2;
    }
    const makeBulbs = (list, blink = false) => {
      if (!list.length) return null;
      const im = new T.InstancedMesh(new T.IcosahedronGeometry(1, 0), new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), list.length);
      const m4 = new T.Matrix4(), col = new T.Color();
      list.forEach((b, i) => { m4.makeScale(b.s ?? 0.22, b.s ?? 0.22, b.s ?? 0.22); m4.setPosition(b.x, b.y, b.z); im.setMatrixAt(i, m4); im.setColorAt(i, col.set(b.c).multiplyScalar(1.8)); });
      im.castShadow = false; im.receiveShadow = false; im.computeBoundingSphere(); K.group.add(im);
      const pos = new Float32Array(list.length * 3), cc = new Float32Array(list.length * 3);
      list.forEach((b, i) => { pos.set([b.x, b.y, b.z], i * 3); col.set(b.c).multiplyScalar(0.6); cc.set([col.r, col.g, col.b], i * 3); });
      const pg = new T.BufferGeometry();
      pg.setAttribute('position', new T.BufferAttribute(pos, 3)); pg.setAttribute('color', new T.BufferAttribute(cc, 3));
      const pm = new T.PointsMaterial({ size: blink ? 6 : 4.2, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending, sizeAttenuation: true, toneMapped: false });
      const pts = new T.Points(pg, pm); pts.renderOrder = 4; K.group.add(pts);
      return { im, pm };
    };
    makeBulbs(bulbs);
    const bl = makeBulbs(blinkers.map((b) => ({ ...b, s: 0.3 })), true);
    if (bl) { A.blinkIm = bl.im; A.blinkPm = bl.pm; A.blinkMat = bl.im.material; }
  },

  // fixed rate: a car that drops into the alley under the kicker restarts on the approach with a run-up
  tick(dt, time, game) {
    if (!A || A.jumpRespawnS == null) return;
    for (const e of game.cars) {
      const c = e.car;
      if (c.state !== 'falling') continue;
      if (c.x > RA.x1 - 3 && c.x < RC.x0 + 3 && c.z > RC.z0 && c.z < RC.z1) e.lastGoodS = A.jumpRespawnS;
    }
  },

  animate(time, dt, game) {
    if (!A) return;
    A.uT.value = time;
    // steam drifting up from a few roof vents (only while they are on screen)
    if (game && game.particles && A.steam.length) {
      A.steamT += dt || 0;
      if (A.steamT > 0.14) {
        A.steamT = 0;
        for (const [x, y, z] of A.steam) if (game.onScreen(x, y, z, 0.1)) game.particles.emit(x, y, z, { color: 0xc4ccd8, n: 1, size: 1.4, life: 2.4, spread: 0.5, up: 2.4, grav: -0.5, grow: 3.4, alpha: 0.14 });
      }
    }
    // a neon tube that has seen better days
    if (A.flickMat) {
      const f = Math.sin(time * 37) * Math.sin(time * 13.3) > 0.55 || (time % 7.3) < 0.18 ? 0.25 : 1.25;
      A.flickMat.color.setScalar(f);
    }
    // aircraft warning lights pulse together
    if (A.blinkMat) {
      const k = 0.35 + 0.65 * Math.max(0, Math.sin(time * 2.6)) ** 3;
      A.blinkMat.color.setScalar(k); A.blinkPm.opacity = k;
    }
    if (A.sock) A.sock.rotation.y = 0.6 + Math.sin(time * 0.7) * 0.25 + Math.sin(time * 2.3) * 0.06;
    // traffic in the streets
    if (A.tBody) {
      const m4 = A.m4, q = A.q, v = A.v, sc = A.sc, e = A.e;
      sc.set(1, 1, 1);
      A.traffic.forEach((c, i) => {
        const d = ((time * c.v + c.ph) % c.len + c.len) % c.len, t = d / c.len;
        const x = lerp(c.ax, c.bx, t), z = lerp(c.az, c.bz, t), ang = Math.atan2(c.bz - c.az, c.bx - c.ax);
        q.setFromEuler(e.set(0, -ang, 0)); v.set(x, A.streetY + 0.03, z);
        m4.compose(v, q, sc);
        A.tBody.setMatrixAt(i, m4); A.tGlass.setMatrixAt(i, m4); A.tHead.setMatrixAt(i, m4); A.tTail.setMatrixAt(i, m4);
      });
      A.tBody.instanceMatrix.needsUpdate = true; A.tGlass.instanceMatrix.needsUpdate = true; A.tHead.instanceMatrix.needsUpdate = true; A.tTail.instanceMatrix.needsUpdate = true;
    }
  },
};

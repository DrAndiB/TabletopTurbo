// World: Fouer Frenzy. The Schueberfouer, Luxembourg City's big late-summer funfair, as a model fair on a hobby
// board at night. Fairground bumper cars race on asphalt lanes between gravel, straight through the bumper-car
// rink, round the octopus (whose arms swoop low over the inside of the south-east bend), up a steel coaster deck
// with a dip and a jump right past the big lit Ferris wheel, along the north straight above the wild mouse and
// down the midway past the carousel and the chair-o-plane. Stalls in the local spirit: Gromperekichelcher,
// Fouerfësch, candy floss, a shooting gallery and hook-a-duck (the ducks got loose on the road). Spilled candy
// floss is sticky, a spilled glass of Riesling is slick.

// ---- track: straights and arcs (south straight east, rink, octopus bend, coaster north, Ferris wheel straight,
// the midway south, the carousel pocket, the food court and back). Generated from straights + arcs.
const TRACK = [
  [-108, 68], [2, 68], [112, 68], [125, 64.5], [134.5, 55], [138, 42], [138, 32], [138, -30], [138, -40], [136.1, -47],
  [131, -52.1], [124, -54], [-4, -54], [-14, -51.3], [-21.3, -44], [-24, -34], [-24, 16], [-26.4, 25], [-33, 31.6],
  [-42, 34], [-66, 34], [-72, 32.4], [-76.4, 28], [-78, 22], [-78, -18], [-80.1, -26], [-86, -31.9], [-94, -34],
  [-116, -34], [-124, -31.9], [-129.9, -26], [-132, -18], [-132, 44], [-128.8, 56], [-120, 64.8],
];
const W = 14;
const BOUNDS = { minX: -158, maxX: 158, minZ: -100, maxZ: 100 };
const PI = Math.PI, TAU = PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const wrapA = (a) => { a = (a + PI) % TAU; if (a < 0) a += TAU; return a - PI; };

// landmarks
const RINK = { x: 32, z: 68, a: 32, b: 21, open: 9.6 }; // bumper-car rink: ellipse semi-axes a (x) and b (z)
// Ferris wheel: one turn per P seconds. The camera looks north from not very high up, so a 45-tall wheel only
// shows whole when it stands beside a north-south road: it is west of the coaster straight, and the cars jump
// off the coaster right past its hub. It leans "up" the screen, away from the lane, so it never covers it.
const WHEEL = { x: 108, z: -2, R: 19, hub: 25.5, P: 52, n: 16 };
// a little wild-mouse coaster in the infield south of the long north straight (visual; animated cars): its hills
// run along the straight, low enough to stay in view below the racers, and it passes through its station (st)
const MOUSE = {
  pts: [
    [50, 1.2, -19.5], [62, 1.2, -19.5], [69.5, 1.6, -21], [75.5, 3.4, -25.5], [78.3, 6.8, -31.5], [76.8, 9.5, -37.3],
    [71, 10, -40.2], [63, 9.6, -40.6], [56, 6.0, -39.8], [49.5, 3.0, -39.3], [43.5, 6.2, -38.2], [38.6, 4.0, -34],
    [37.4, 2.2, -28], [40.2, 1.6, -22.3], [44.5, 1.3, -19.6],
  ],
  st: [56, -20.5],
  n: 3,
};
const CARO = { x: -55, z: -9, R: 10.5, w: 0.5 }; // carousel
const SWING = { x: -104, z: 29, w: 1.15, tilt: 0.6 }; // chair-o-plane
// the octopus sits in the middle of the south-east bend; its arms swoop low over the inside of the bend
const OCTO = { x: 112, z: 42, n: 5, w: 0.62, hub: 8.6, lowAz: PI / 4, tubR: 2.2, ph: 0.4 };
// coaster: profile along the east straight from z0 (heading north): [d, height] breakpoints (ramp ends in a jump)
const COAST = { z0: 33, prof: [[0, 0], [9, 2.8], [12, 2.8], [18, 1.2], [24, 2.8], [27, 2.8], [33, 3.9]] };

let A = null; // runtime state for animate()

// octopus arm i at time t: azimuth, arm pitch, tip radius/height, tub bottom height
function octoArm(i, t) {
  const az = OCTO.ph + i * TAU / OCTO.n - OCTO.w * t;
  const d = Math.abs(wrapA(az - OCTO.lowAz));
  const low = 1 - ss(0.8, 1.55, d); // 1 over the bend, 0 on the far side
  const p = lerp(0.36, -0.245, low); // arm pitch (up = +)
  const Lb = A ? A.octoLb : 15;
  const rad = 1.0 + Lb * Math.cos(p), yTip = OCTO.hub + Lb * Math.sin(p);
  return { az, p, rad, yTip, bottom: yTip - 3.7, low };
}

// coaster deck height at distance d from the coaster start
function coastY(d) {
  const P = COAST.prof;
  if (d <= 0 || d > P[P.length - 1][0]) return 0;
  for (let i = 1; i < P.length; i++) if (d <= P[i][0]) return lerp(P[i - 1][1], P[i][1], (d - P[i - 1][0]) / (P[i][0] - P[i - 1][0]));
  return 0;
}

export default {
  id: 'fouer',
  name: 'Fouer Frenzy',
  blurb: 'The funfair at night: Ferris wheel, roller coaster and the bumper-car rink.',
  vehicle: 'bumper',
  seed: 22,
  headlights: { intensity: 58, distance: 52, angle: 0.62, color: 0xffe8c4 },
  track: { points: TRACK, width: W, startS: 40 },
  bounds: BOUNDS,
  fallOffEdges: true,
  floorY: -76,
  offCourse: 16,
  offroad: { kind: 'slow', margin: 1.4 },
  skidColor: 0x111014,
  clackOnBump: false,
  dust: {
    normal: null,
    slow: { color: 0x8c8172, size: 1.2, life: 0.7, up: 2.5, grav: 4, alpha: 0.45, grow: 2.2, rate: 1.2 },
    sticky: { color: 0xff9ad6, size: 0.8, life: 0.5, up: 1.5, grav: 6, alpha: 0.8, grow: 1.4, rate: 1.2 },
    slick: { color: 0xf3e9a0, size: 0.6, life: 0.45, up: 3, grav: 24, alpha: 0.85, grow: 1, rate: 1.8 },
  },
  lighting: {
    sunDir: [-0.42, 1, -0.5], sunColor: 0x8a9ee0, sunIntensity: 0.6,
    hemiSky: 0x2c3866, hemiGround: 0x140f0a, hemiIntensity: 0.26,
    envIntensity: 0.12, exposure: 1.12, background: 0x05070e, shadowRadius: 3,
    fog: { color: 0x080a14, near: 320, far: 820 },
  },

  async build(K) {
    const { THREE: T, TX, r, track, physics } = K;
    const BU = K.BufferGeometryUtils;
    const L = track.length;
    const lowQ = K.quality && K.quality.tilt === false;
    A = { uT: { value: 0 }, octoLb: 15, m4: new T.Matrix4(), m5: new T.Matrix4() };
    const V2 = (a, b = a) => new T.Vector2(a, b);

    // ============================================================ helpers: baking parts into few meshes
    const _q = new T.Quaternion(), _e = new T.Euler(), _v = new T.Vector3(), _s = new T.Vector3(), _c = new T.Color();
    const mtx = (o) => new T.Matrix4().compose(_v.set(o.x || 0, o.y || 0, o.z || 0), _q.setFromEuler(_e.set(o.rx || 0, o.ry || 0, o.rz || 0, o.order || 'YXZ')), _s.set(o.sx ?? o.s ?? 1, o.sy ?? o.s ?? 1, o.sz ?? o.s ?? 1));
    const rgb = (c) => (Array.isArray(c) ? c : (_c.set(c), [_c.r, _c.g, _c.b]));
    const prep = (geo, c, M) => {
      const g = geo.index ? geo.toNonIndexed() : geo.clone();
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      g.morphAttributes = {};
      if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.attributes.normal) g.computeVertexNormals();
      g.applyMatrix4(M);
      const [cr, cg, cb] = rgb(c), n = g.attributes.position.count, a = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { a[i * 3] = cr; a[i * 3 + 1] = cg; a[i * 3 + 2] = cb; }
      g.setAttribute('color', new T.BufferAttribute(a, 3));
      g.clearGroups();
      return g;
    };
    const CELL = 160;
    const bins = new Map();
    // glow parts and signs share one unlit material (the sign atlas has a white block for the glow parts)
    const resolve = (mat, g) => {
      if (mat === M.glow) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5, WHITE_V); return M.basic; }
      return mat === M.sign ? M.basic : mat;
    };
    const binPush = (mat0, cast, x, z, g) => {
      const mat = resolve(mat0, g);
      if (mat === M.basic) cast = false;
      const key = mat.uuid + (cast ? 'c' : 'n') + Math.floor((x + 240) / CELL) + ':' + Math.floor((z + 240) / CELL);
      if (!bins.has(key)) bins.set(key, { mat, cast, parts: [] });
      bins.get(key).parts.push(g);
    };
    // put(geo, colour, {x,y,z,rx,ry,rz,s..}, material, castShadow): one part in world space
    const put = (geo, c, o = {}, mat = M.paint, cast = true) => {
      const g = prep(geo, c, mtx(o)), pa = g.attributes.position;
      binPush(mat, cast, o.x ?? pa.getX(0), o.z ?? pa.getZ(0), g);
    };
    // frame(): a local frame for a whole prop. f(geo, c, o, mat, cast); f.pt(lx, lz) -> world [x, z]; f.ang(a) -> physics angle
    const frame = (cx, cy, cz, ry = 0, sc = 1) => {
      const F = new T.Matrix4().compose(new T.Vector3(cx, cy, cz), new T.Quaternion().setFromEuler(new T.Euler(0, ry, 0)), new T.Vector3(sc, sc, sc));
      const cs = Math.cos(ry), sn = Math.sin(ry);
      const f = (geo, c, o = {}, mat = M.paint, cast = true) => { binPush(mat, cast, cx, cz, prep(geo, c, F.clone().multiply(mtx(o)))); };
      f.pt = (lx, lz) => [cx + (lx * cs + lz * sn) * sc, cz + (-lx * sn + lz * cs) * sc];
      f.ang = (a = 0) => -ry + a;
      f.box = (lx, lz, hw, hd, h, extra) => { const [x, z] = f.pt(lx, lz); return K.box(x, z, hw * sc, hd * sc, -ry, h, extra); };
      f.circ = (lx, lz, rr, h) => { const [x, z] = f.pt(lx, lz); return K.circle(x, z, rr * sc, h); };
      f.cx = cx; f.cz = cz; f.ry = ry; f.sc = sc; f.y = cy;
      return f;
    };
    // assembly: parts merged per material into meshes under one (animated) parent
    const asm = () => {
      const b = new Map();
      const f = (geo, c, o = {}, mat0 = M.paint) => { const g = prep(geo, c, mtx(o)), mat = resolve(mat0, g); if (!b.has(mat)) b.set(mat, []); b.get(mat).push(g); };
      f.build = (parent, cast = true) => {
        for (const [mat, parts] of b) {
          const g = BU.mergeGeometries(parts, false); g.computeBoundingSphere();
          const m = new T.Mesh(g, mat); m.castShadow = cast && mat !== M.basic; m.receiveShadow = true; parent.add(m);
        }
      };
      return f;
    };
    // geometry shortcuts
    const box = (w, h, d) => new T.BoxGeometry(w, h, d);
    const rbox = (w, h, d, rad = 0.3, seg = 2) => new K.RoundedBoxGeometry(w, h, d, seg, Math.min(rad, w / 2.01, h / 2.01, d / 2.01));
    const cyl = (r1, r2, h, seg = 12, open = false) => new T.CylinderGeometry(r1, r2, h, seg, 1, open);
    const sph = (rad, ws = 12, hs = 8) => new T.SphereGeometry(rad, ws, hs);
    const cone = (rad, h, seg = 12) => new T.ConeGeometry(rad, h, seg);
    // a cylinder from point a to point b (local or world)
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

    // collected decals and lights; contact shadows encode their opacity in the instance's y scale
    const contactMat = new T.MeshBasicMaterial({ color: 0x030204, transparent: true, alphaMap: TX.blobShadowTexture(), depthWrite: false });
    contactMat.onBeforeCompile = (sh) => {
      sh.vertexShader = 'varying float vOp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\nvOp = length(instanceMatrix[1].xyz);\n#endif');
      sh.fragmentShader = 'varying float vOp;\n' + sh.fragmentShader.replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\ndiffuseColor.a *= vOp;');
    };
    const contacts = [];
    const AO = (x, z, rx, rz = rx, op = 0.4, ang = 0, y = 0.06) => contacts.push({ x, y, z, ry: -ang, sx: rx * 2, sy: op, sz: rz * 2 });
    const pools = [];
    const POOL = (x, z, rx, rz, color, op = 1, ang = 0, y = 0.12) => pools.push({ x, y, z, ry: -ang, sx: rx * 2, sy: 1, sz: rz * 2, color: new T.Color(color).multiplyScalar(op) });
    // bulbs: sets with their own chase pattern and parent; halos go with them
    const MODE = { steady: 0, twinkle: 1, chase: 2, wheel: 3 };
    const HALO = { steady: 1.5, twinkle: 0.8, chase: 1, wheel: 1.15 };
    const bulbsStatic = [];
    const BULB = (set, x, y, z, color, ph = 0, s = 1, halo = 1) => { bulbsStatic.push({ x, y, z, c: color, ph, s, halo: halo * HALO[set], mode: MODE[set] }); };
    const colliderHit = (x, z, rad) => { for (const c of physics.colliders) { if (c.bb && (x + rad < c.bb[0] || x - rad > c.bb[2] || z + rad < c.bb[1] || z - rad > c.bb[3])) continue; if (physics.circleVsCollider(x, z, rad, c)) return true; } return false; };
    const sAt = (x, z) => track.distTo(x, z).s;
    const dRoad = (x, z) => { const n = track.distTo(x, z); return n.dist - track.w[n.i] / 2; }; // distance beyond the road edge
    const groundY = (x, z) => physics.groundAt(x, z).g;
    // partial ribbon along the track between s0 and s1 at lateral offset `off`, following ramps if asked
    const strip = (s0, s1, off, wid, yOff = 0.05, step = 1, vScale = 10, follow = false) => {
      const n = Math.max(2, Math.ceil((s1 - s0) / step));
      const pos = [], uv = [], idx = [];
      for (let i = 0; i <= n; i++) {
        const s = s0 + ((s1 - s0) * i) / n, p = track.at(s);
        for (let k = 0; k < 2; k++) {
          const o = off + (k - 0.5) * wid, x = p.x + p.nx * o, z = p.z + p.nz * o;
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

    // ============================================================ materials
    const M = {
      paint: K.phys({ vertexColors: true, roughness: 0.48, clearcoat: 0.35, clearcoatRoughness: 0.35 }),
      matte: K.std({ vertexColors: true, roughness: 0.86 }),
      metal: K.std({ vertexColors: true, metalness: 0.78, roughness: 0.34 }),
      glow: { tag: 'glow' }, // resolved to M.basic with white UVs
      sign: { tag: 'sign' }, // resolved to M.basic
    };
    const WHITE_V = 1 - 2030 / 2048;
    // sign atlas: 16 rows of 1024 x 128, glowing letters
    const SIGN = {
      gromp: 0, fesch: 1, zocker: 2, scheiss: 3, inten: 4, scooter: 5, maus: 6, rad: 7, fouer: 8,
      mandel: 9, waffel: 10, tombola: 11, hierz: 12, krak: 13, kette: 14, karussell: 15,
    };
    {
      const rows = [
        ['GROMPEREKICHELCHER', '#3b0a0a', '#ffcf3a', '#ff7a1a'],
        ['FOUERFËSCH', '#0b2348', '#ffffff', '#7fd8ff'],
        ['ZOCKERWATT', '#3a0f3e', '#ff9ad8', '#ffffff'],
        ['SCHÉISSBUD', '#111111', '#ffd34a', '#e8352a'],
        ['INTE FËSCHEN', '#0d3b8c', '#ffe14a', '#ffffff'],
        ['AUTOSCOOTER', '#0a0a14', '#4af0ff', '#ff4ad2'],
        ['WËLL MAUS', '#2a0d0d', '#ff3b30', '#ffd43a'],
        ['RISERAD', '#13213f', '#ffffff', '#ffcf5a'],
        ['SCHUEBERFOUER', '#3a0b18', '#ffe7a8', '#ff4f6a'],
        ['MANDELEN', '#3b220f', '#ffd9a0', '#ff9c3a'],
        ['WAFFELEN', '#4a1d05', '#fff2c8', '#ffb43a'],
        ['TOMBOLA', '#0b3a1c', '#fff17a', '#ff5a3a'],
        ['HIERZER', '#4a0a14', '#ffb0c0', '#ffffff'],
        ['DE KRAK', '#22093a', '#c48aff', '#7affd4'],
        ['KETTEKARUSSELL', '#0b2a3a', '#ffe08a', '#7ae0ff'],
        ['KARUSSELL', '#3a0b0b', '#ffd36a', '#ffffff'],
      ];
      const c = canvas(1024, 2048, (g) => {
        g.fillStyle = '#ffffff'; g.fillRect(0, 1984, 1024, 64);
        rows.forEach(([txt, bg, fg, acc], i) => {
          const y0 = i * 124;
          g.save(); g.beginPath(); g.rect(0, y0, 1024, 124); g.clip(); g.translate(0, -2);
          g.fillStyle = bg; g.fillRect(0, y0, 1024, 128);
          g.strokeStyle = acc; g.lineWidth = 6; g.strokeRect(8, y0 + 8, 1008, 112);
          // bulb dots along the frame
          for (let k = 0; k < 42; k++) { const x = 18 + k * 24.2; for (const yy of [y0 + 15, y0 + 113]) { g.fillStyle = k % 2 ? '#fff6d0' : acc; g.beginPath(); g.arc(x, yy, 4.5, 0, TAU); g.fill(); } }
          g.font = '86px "Lilita One", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
          let sz = 86; while (g.measureText(txt).width > 930 && sz > 40) { sz -= 4; g.font = `${sz}px "Lilita One", Impact, sans-serif`; }
          g.lineWidth = 10; g.strokeStyle = 'rgba(0,0,0,0.65)'; g.strokeText(txt, 512, y0 + 68);
          g.shadowColor = fg; g.shadowBlur = 18; g.fillStyle = fg; g.fillText(txt, 512, y0 + 66); g.shadowBlur = 0;
          g.restore();
        });
      });
      const t = tex(c, [1, 1], false);
      M.basic = new T.MeshBasicMaterial({ map: t, vertexColors: true });
    }
    // a sign plane (local frame: facing +z) using atlas row `row`
    const signGeo = (w, h, row) => {
      const g = new T.PlaneGeometry(w, h);
      const uv = g.attributes.uv, v0 = 1 - ((row + 1) * 124) / 2048, v1 = 1 - (row * 124) / 2048;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), lerp(v0 + 0.002, v1 - 0.002, uv.getY(i)));
      return g;
    };

    // ============================================================ table, board, floor far below
    {
      const BW = BOUNDS.maxX - BOUNDS.minX, BD = BOUNDS.maxZ - BOUNDS.minZ;
      const wood = TX.woodTextures({ size: 512, seed: 9, planks: 3, base: 0x3a2618, dark: 0x22150c, light: 0x5a3c24, ringFreq: 14, gap: 0.004, roughBase: 0.55 });
      for (const t of Object.values(wood)) t.repeat.set(4, 1);
      const fascia = K.std({ map: wood.map, normalMap: wood.normalMap, roughnessMap: wood.roughnessMap, color: 0x8a6a50 });
      K.mesh(box(BW + 2, 5, BD + 2), fascia, 0, -2.55, 0, { cast: false });
      // brass trim along the top edge of the fascia
      const brass = K.metal(0xc9a25a, 0.3);
      const trims = [];
      for (const sz of [-1, 1]) { trims.push(box(BW + 2.4, 0.4, 0.5).translate(0, -0.25, sz * (BD / 2 + 1.05))); trims.push(box(0.5, 0.4, BD + 2.4).translate(sz * (BW / 2 + 1.05), -0.25, 0)); }
      K.mesh(BU.mergeGeometries(trims, false), brass, 0, 0, 0, { cast: false });
      // apron and legs of the hobby table
      const legMat = K.std({ color: 0x2c1e14, roughness: 0.7 });
      const legs = [box(BW - 14, 9, BD - 14).translate(0, -9.5, 0)];
      for (const [x, z] of [[-BW / 2 + 9, -BD / 2 + 9], [BW / 2 - 9, -BD / 2 + 9], [-BW / 2 + 9, BD / 2 - 9], [BW / 2 - 9, BD / 2 - 9]]) legs.push(box(9, 72, 9).translate(x, -40, z));
      K.mesh(BU.mergeGeometries(legs, false), legMat, 0, 0, 0, { cast: false });
      // little brass plaque on the front fascia
      const pc = canvas(256, 64, (g) => { g.fillStyle = '#b8924a'; g.fillRect(0, 0, 256, 64); g.strokeStyle = '#6a4e20'; g.lineWidth = 4; g.strokeRect(4, 4, 248, 56); g.fillStyle = '#3a2a10'; g.font = '700 26px Georgia, serif'; g.textAlign = 'center'; g.fillText('Schueberfouer · 1:45', 128, 42); });
      K.mesh(new T.PlaneGeometry(26, 6.5), K.std({ map: tex(pc, [1, 1], false), metalness: 0.6, roughness: 0.35 }), -20, -2.6, BD / 2 + 1.06, { cast: false });
      // dark floorboards and a rug far below
      const fl = TX.woodTextures({ size: 512, seed: 21, planks: 6, base: 0x241a12, dark: 0x140e09, light: 0x2e2218, ringFreq: 20, gap: 0.006, roughBase: 0.6 });
      for (const t of Object.values(fl)) t.repeat.set(10, 10);
      K.mesh(new T.PlaneGeometry(1800, 1800), K.std({ map: fl.map, normalMap: fl.normalMap, roughness: 0.7 }), 0, -76, 0, { rx: -PI / 2, cast: false });
      const rugC = TX.paint(256, 256, (x, y, u, v, o) => {
        const d = Math.max(Math.abs(u - 0.5), Math.abs(v - 0.5)); const band = Math.floor(d * 16) % 3;
        const n = Math.random() * 8; o[0] = [46, 18, 20][band] + n; o[1] = [16, 24, 22][band] + n; o[2] = [20, 38, 26][band] + n;
      });
      K.mesh(new T.PlaneGeometry(460, 330), K.std({ map: tex(rugC, [1, 1], false), roughness: 1 }), 0, -75.8, 0, { rx: -PI / 2, cast: false });
    }

    // ============================================================ ground: fine gravel, asphalt lanes, painted lines
    {
      const gv = TX.mottledTextures({ size: 512, a: 0x5a544b, b: 0x4a453e, c: 0x665f55, seed: 61, period: 6, speck: 0.1, bump: 1.4, pebbles: 260, pebbleColor: 0x6e675c });
      for (const t of [gv.map, gv.normalMap]) t.repeat.set(316 / 26, 200 / 26);
      K.mesh(new T.PlaneGeometry(BOUNDS.maxX - BOUNDS.minX, BOUNDS.maxZ - BOUNDS.minZ), K.std({ map: gv.map, normalMap: gv.normalMap, normalScale: V2(0.9), roughness: 0.95 }), 0, 0, 0, { rx: -PI / 2, cast: false });
    }
    // key positions along the route
    const sR0 = sAt(RINK.x - RINK.a, RINK.z), sR1 = sAt(RINK.x + RINK.a, RINK.z); // rink west/east ends
    const sC0 = sAt(138, COAST.z0), CL = COAST.prof[COAST.prof.length - 1][0]; // coaster start, deck length
    const sC1 = sC0 + CL;
    A.sC0 = sC0;
    const asphalt = TX.mottledTextures({ size: 512, a: 0x2b2b2e, b: 0x222225, c: 0x39383a, seed: 71, period: 24, speck: 0.5, bump: 2.5, pebbles: 500, pebbleColor: 0x4a4848, roughness: [0.55, 0.9] });
    for (const t of Object.values(asphalt)) t.repeat.set(1, 1);
    const roadMat = K.std({ map: asphalt.map, normalMap: asphalt.normalMap, roughnessMap: asphalt.roughnessMap, normalScale: V2(0.7), roughness: 1 });
    {
      // asphalt everywhere except the rink floor and the coaster deck (+ a little overlap)
      const parts = [strip(sR1 - 1, sC0 + 0.5, 0, W + 1.2, 0.04, 1, 14), strip(sC1 - 0.5, L + sR0 + 1, 0, W + 1.2, 0.04, 1, 14)];
      const g = BU.mergeGeometries(parts, false);
      // uv: u across (0..1) -> world-ish scale
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (W + 1.2) / 14, uv.getY(i));
      const m = new T.Mesh(g, roadMat); m.receiveShadow = true; K.group.add(m);
      // painted edge lines (white) and a dashed yellow kerb paint at the tight bends
      const lines = [];
      for (const side of [-1, 1]) {
        lines.push(strip(sR1 + 0.5, sC0 - 0.5, side * (W / 2 - 0.55), 0.5, 0.075, 1));
        lines.push(strip(sC1 + 0.5, L + sR0 - 0.5, side * (W / 2 - 0.55), 0.5, 0.075, 1));
      }
      const lm = new T.Mesh(BU.mergeGeometries(lines, false), K.std({ color: 0xf2efe6, roughness: 0.6 }));
      lm.receiveShadow = true; K.group.add(lm);
      // red/white painted kerbs on the outside and inside of the tighter bends
      const kc = canvas(64, 128, (g) => { for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#f4f1ea' : '#c8242a'; g.fillRect(0, i * 32, 64, 32); } });
      const kt = tex(kc, [1, 1], true);
      const kerbs = [];
      for (let s = 0; s < L; s += 2) {
        const c = Math.abs(track.at(s).curv);
        if (c > 1 / 20) { const sd = Math.sign(track.at(s).curv); kerbs.push(strip(s, s + 2, -sd * (W / 2 + 0.5), 1.4, 0.07, 1, 4)); kerbs.push(strip(s, s + 2, sd * (W / 2 + 0.5), 1.4, 0.07, 1, 4)); }
      }
      if (kerbs.length) { const km = new T.Mesh(BU.mergeGeometries(kerbs, false), K.std({ map: kt, roughness: 0.6 })); km.receiveShadow = true; K.group.add(km); }
      // start / finish: checkered band across the road
      const cc = canvas(256, 64, (g) => { for (let y = 0; y < 4; y++) for (let x = 0; x < 16; x++) { g.fillStyle = (x + y) % 2 ? '#141414' : '#f4f1ea'; g.fillRect(x * 16, y * 16, 16, 16); } });
      const p = track.at(40);
      const sm = K.mesh(new T.PlaneGeometry(W, 3.4), K.std({ map: tex(cc, [1, 1], false), roughness: 0.7 }), p.x, 0.085, p.z, { cast: false });
      sm.rotation.order = 'YXZ'; sm.rotation.y = -p.angle + PI / 2; sm.rotation.x = -PI / 2;
    }

    // ============================================================ the bumper-car rink
    {
      const { x: cx, z: cz, a, b } = RINK;
      const ell = (t, k = 1) => [cx + Math.cos(t) * a * k, cz + Math.sin(t) * b * k];
      // floor: steel plates with seams, scuffs and a painted border
      const fc = canvas(1024, 672, (g) => {
        g.fillStyle = '#4a4d52'; g.fillRect(0, 0, 1024, 672);
        for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(${20 + Math.random() * 60},${20 + Math.random() * 60},${30 + Math.random() * 60},${Math.random() * 0.12})`; g.fillRect(Math.random() * 1024, Math.random() * 672, 2 + Math.random() * 30, 1 + Math.random() * 3); }
        // tyre scuffs going round
        g.lineCap = 'round';
        for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(10,10,12,${0.05 + Math.random() * 0.1})`; g.lineWidth = 3 + Math.random() * 6; const rr = 0.3 + Math.random() * 0.6; g.beginPath(); g.ellipse(512, 336, 480 * rr, 300 * rr, 0, Math.random() * 6, Math.random() * 6 + 1.5); g.stroke(); }
        g.strokeStyle = 'rgba(15,15,18,0.85)'; g.lineWidth = 2;
        for (let x = 0; x <= 1024; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 672); g.stroke(); }
        for (let y = 0; y <= 672; y += 48) { g.beginPath(); g.moveTo(0, y); g.lineTo(1024, y); g.stroke(); }
        g.fillStyle = 'rgba(200,205,215,0.35)';
        for (let x = 0; x <= 1024; x += 64) for (let y = 0; y <= 672; y += 48) { g.beginPath(); g.arc(x + 4, y + 4, 2, 0, TAU); g.fill(); }
        // painted border band (yellow/black chevrons) inside the fence
        g.save(); g.beginPath(); g.ellipse(512, 336, 506, 330, 0, 0, TAU); g.ellipse(512, 336, 470, 300, 0, 0, TAU); g.clip('evenodd');
        for (let k = -60; k < 120; k++) { g.fillStyle = k % 2 ? '#1a1a1a' : '#e8b820'; g.beginPath(); g.moveTo(k * 22, 0); g.lineTo(k * 22 + 22, 0); g.lineTo(k * 22 - 300, 672); g.lineTo(k * 22 - 322, 672); g.fill(); }
        g.restore();
        // the racing line through it: faded white chevrons
        g.fillStyle = 'rgba(240,240,235,0.32)';
        for (let x = 140; x < 900; x += 90) { g.beginPath(); g.moveTo(x, 300); g.lineTo(x + 34, 336); g.lineTo(x, 372); g.lineTo(x + 16, 372); g.lineTo(x + 50, 336); g.lineTo(x + 16, 300); g.fill(); }
      });
      const ft = tex(fc, [1, 1], false);
      const floorMat = K.std({ map: ft, metalness: 0.55, roughness: 0.42, color: 0xd8dade });
      const sh = new T.Shape();
      for (let i = 0; i <= 96; i++) { const t = (i / 96) * TAU; const [x, z] = [Math.cos(t) * a, Math.sin(t) * b]; if (i) sh.lineTo(x, -z); else sh.moveTo(x, -z); }
      const fg = new T.ShapeGeometry(sh, 4); fg.rotateX(-PI / 2);
      const uv = fg.attributes.uv, pos = fg.attributes.position;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + a) / (2 * a), 1 - (pos.getZ(i) + b) / (2 * b));
      const floor = new T.Mesh(fg, floorMat); floor.position.set(cx, 0.1, cz); floor.receiveShadow = true; K.group.add(floor);
      // the floor is not gravel: normal grip everywhere inside
      const poly = []; for (let i = 0; i < 64; i++) { const t = (i / 64) * TAU; poly.push(ell(t, 0.995)); }
      K.surface('normal', { poly });
      // openings at both ends (where the track enters and leaves)
      const tOpen = Math.asin(RINK.open / b); // parameter half-angle of the opening around t=0 and t=PI
      const inOpening = (t) => { const u = wrapA(t); return Math.abs(u) < tOpen || Math.abs(wrapA(t - PI)) < tOpen; };
      // padded fence: skirting panels + a black rubber rail on posts, as segments along the ellipse
      const segs = 120;
      const pts = [];
      for (let i = 0; i <= segs; i++) { const t = (i / segs) * TAU; pts.push({ t, p: ell(t), open: inOpening(t) }); }
      const panelCols = [0xd22f2f, 0xf2c230, 0x2f6fd2, 0x2fa04a];
      for (let i = 0; i < segs; i++) {
        const A0 = pts[i], B0 = pts[i + 1];
        if (A0.open || B0.open) continue;
        const [x1, z1] = A0.p, [x2, z2] = B0.p, mx = (x1 + x2) / 2, mz = (z1 + z2) / 2, len = Math.hypot(x2 - x1, z2 - z1) + 0.06, ang = Math.atan2(z2 - z1, x2 - x1);
        put(box(len, 1.1, 0.35), panelCols[Math.floor(i / 5) % 4], { x: mx, y: 0.65, z: mz, ry: -ang });
        put(box(len, 0.16, 0.5), 0xe8e4da, { x: mx, y: 1.25, z: mz, ry: -ang });
        put(rod([x1, 1.62, z1], [x2, 1.62, z2], 0.42, 8), 0x1a1a1c, {}, M.matte);
        if (i % 3 === 0) put(cyl(0.16, 0.16, 1.7, 6), 0xc8ccd2, { x: x1, y: 0.85, z: z1 }, M.metal);
      }
      // colliders: the closed fence runs between the openings, two segments per capsule
      {
        let runStart = null, cnt = 0;
        for (let i = 0; i < segs; i++) {
          if (pts[i].open || pts[i + 1].open) { runStart = null; cnt = 0; continue; }
          if (runStart === null) runStart = pts[i].p;
          cnt++;
          const nextClosed = i + 1 < segs && !pts[i + 1].open && !pts[i + 2].open;
          if (cnt === 2 || !nextClosed) { K.capsule(runStart[0], runStart[1], pts[i + 1].p[0], pts[i + 1].p[1], 0.62, 2.4); runStart = pts[i + 1].p; cnt = 0; }
        }
      }
      // padded end posts at the openings
      for (const t of [tOpen, -tOpen, PI - tOpen, PI + tOpen]) {
        const [x, z] = ell(t);
        put(cyl(0.75, 0.85, 2.4, 14), 0x1a1a1c, { x, y: 1.2, z }, M.matte);
        put(sph(0.78, 12, 8), 0xf2c230, { x, y: 2.45, z });
        K.circle(x, z, 0.8, 2.6);
        AO(x, z, 1.4, 1.4, 0.4);
      }
      AO(cx, cz, a + 1, b + 1, 0.22);
      // ceiling: four poles and a frame high up, a few overhead wires (no solid ceiling)
      const PY = 12.5, px0 = cx - a + 4, px1 = cx + a - 4, pz0 = cz - b + 3, pz1 = cz + b - 3;
      const poles = [[px0, pz0], [px1, pz0], [px0, pz1], [px1, pz1]];
      for (const [x, z] of poles) {
        put(cyl(0.45, 0.6, PY, 10), 0xc9ced4, { x, y: PY / 2, z }, M.metal);
        put(cyl(1.1, 1.3, 0.6, 12), 0x3a3d42, { x, y: 0.3, z }, M.metal);
        K.circle(x, z, 0.8, PY);
        AO(x, z, 1.3, 1.3, 0.45);
      }
      const beam = (x1, z1, x2, z2, c = 0xe8e2d4, rad = 0.32) => put(rod([x1, PY, z1], [x2, PY, z2], rad, 8), c, {}, M.metal);
      beam(px0, pz0, px1, pz0); beam(px0, pz1, px1, pz1); beam(px0, pz0, px0, pz1); beam(px1, pz0, px1, pz1);
      // the wire grid (sparse): copper-coloured wires
      for (const z of [cz - 8, cz, cz + 8]) beam(px0, z, px1, z, 0xb06a3a, 0.07);
      for (const x of [cx - 14, cx, cx + 14]) beam(x, pz0, x, pz1, 0xb06a3a, 0.07);
      // bulbs along the frame (chasing)
      let k = 0;
      for (const [x1, z1, x2, z2] of [[px0, pz0, px1, pz0], [px1, pz0, px1, pz1], [px1, pz1, px0, pz1], [px0, pz1, px0, pz0]]) {
        const n = Math.round(Math.hypot(x2 - x1, z2 - z1) / 1.6);
        for (let i = 0; i < n; i++, k++) BULB('chase', lerp(x1, x2, i / n), PY - 0.45, lerp(z1, z2, i / n), [0xff4ad2, 0x4af0ff, 0xffe04a][k % 3], k / 18, 1.1);
      }
      // the sign on the north beam, facing the camera
      {
        const f = frame(cx, 0, pz0, 0);
        f(box(24, 3.0, 0.5), 0x101018, { y: PY + 1.9, z: -0.2 });
        f(signGeo(23.4, 2.7, SIGN.scooter), 0xffffff, { y: PY + 1.9, z: 0.06 }, M.sign);
        for (let i = 0; i <= 24; i++) BULB('chase', cx - 12 + i, PY + 3.55, pz0, i % 2 ? 0xffd04a : 0xff4ad2, i / 9, 1);
      }
      // cash booth outside the north-west edge
      {
        const f = frame(cx - a + 6, 0, cz - b - 4.5, 0);
        f(box(5, 4.6, 4), 0xd8c9a6, { y: 2.3 });
        f(box(5.8, 0.4, 4.8), 0xc0302a, { y: 4.8 });
        f(box(3.6, 1.6, 0.1), [1.1, 0.85, 0.5], { y: 3.0, z: 2.02 }, M.glow);
        f.box(0, 0, 2.6, 2.1, 5);
        AO(f.cx, f.cz, 4, 3.4, 0.45);
        POOL(f.cx, f.cz + 4, 5, 3.5, 0xffb060, 0.35);
      }
      // cool floodlight pools on the floor
      for (const [x, z] of [[cx - 16, cz], [cx + 16, cz], [cx, cz - 9], [cx, cz + 9]]) POOL(x, z, 15, 12, 0x9ab8ff, 0.16, 0, 0.13);
      A.rink = { cx, cz };
    }

    // ============================================================ the roller-coaster section (east straight)
    {
      const p0 = track.at(sC0), ang = p0.angle; // heading north
      const c = Math.cos(ang), s = Math.sin(ang);
      const at = (d, lat = 0) => [p0.x + c * d - s * lat, p0.z + s * d + c * lat];
      const P = COAST.prof;
      const DW = 15.4;
      for (let i = 1; i < P.length; i++) {
        const [d0, h0] = P[i - 1], [d1, h1] = P[i];
        const [mx, mz] = at((d0 + d1) / 2);
        if (Math.abs(h1 - h0) < 0.01) K.platform(mx, mz, (d1 - d0) / 2 + 0.05, DW / 2, ang, h0);
        else if (h1 > h0) K.ramp(mx, mz, ang, d1 - d0, DW, h1 - h0, h0);
        else K.ramp(mx, mz, ang + PI, d1 - d0, DW, h0 - h1, h1);
      }
      // the deck: riveted steel plate with yellow edge stripes, following the profile
      const dc = canvas(256, 256, (g) => {
        g.fillStyle = '#55585e'; g.fillRect(0, 0, 256, 256);
        for (let y = 0; y < 256; y += 16) for (let x = (y / 16) % 2 ? 8 : 0; x < 256; x += 16) { g.fillStyle = 'rgba(200,205,215,0.18)'; g.fillRect(x + 3, y + 6, 9, 3); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + 3, y + 9, 9, 1); }
        g.fillStyle = 'rgba(20,20,22,0.8)'; for (let y = 0; y < 256; y += 64) g.fillRect(0, y, 256, 2);
        for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#1a1a1a' : '#e8b820'; g.beginPath(); g.moveTo(0, i * 32); g.lineTo(18, i * 32 + 18); g.lineTo(18, i * 32 + 50); g.lineTo(0, i * 32 + 32); g.fill(); g.beginPath(); g.moveTo(256, i * 32); g.lineTo(238, i * 32 + 18); g.lineTo(238, i * 32 + 50); g.lineTo(256, i * 32 + 32); g.fill(); }
      });
      const deckMat = K.std({ map: tex(dc, [1, 1], true), metalness: 0.3, roughness: 0.5, color: 0xdadee6 });
      const N = 66;
      const posA = [], uvA = [], idx = [];
      const cols = [[-DW / 2, 0], [DW / 2, 1]];
      for (let i = 0; i <= N; i++) {
        const d = (i / N) * CL, y = coastY(d) + 0.06;
        for (const [lat, u] of cols) { const [x, z] = at(d, lat); posA.push(x, y, z); uvA.push(u, d / 10); }
        if (i < N) { const q = i * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
      }
      const dg = new T.BufferGeometry(); dg.setAttribute('position', new T.Float32BufferAttribute(posA, 3)); dg.setAttribute('uv', new T.Float32BufferAttribute(uvA, 2)); dg.setIndex(idx); dg.computeVertexNormals();
      const dn = dg.attributes.normal; for (let i = 0; i < dn.count; i++) if (dn.getY(i) < 0) dn.setXYZ(i, -dn.getX(i), -dn.getY(i), -dn.getZ(i));
      const dm = new T.Mesh(dg, deckMat); dm.receiveShadow = true; dm.castShadow = true; K.group.add(dm);
      // deck underside + side skirts (dark steel)
      {
        const sp = [], si = [];
        let base = 0;
        for (const side of [-1, 1]) {
          for (let i = 0; i <= N; i++) { const d = (i / N) * CL, y = coastY(d); const [x, z] = at(d, side * DW / 2); sp.push(x, Math.max(0, y - 0.7), z, x, y + 0.05, z); if (i < N) { const q = base + i * 2; si.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); } }
          base += (N + 1) * 2;
        }
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(sp, 3)); g.setIndex(si); g.computeVertexNormals();
        const m = new T.Mesh(g, K.std({ color: 0x3a3d44, metalness: 0.6, roughness: 0.5, side: T.DoubleSide })); m.castShadow = true; m.receiveShadow = true; K.group.add(m);
      }
      // rails: red tubes along both edges (and the colliders keeping cars on the deck)
      const RED = 0xd8282a;
      for (const side of [-1, 1]) {
        let prev = null;
        for (let d = -1.5; d <= CL + 0.01; d += 1.5) {
          const dd = Math.max(0, d), y = coastY(dd);
          const [x, z] = at(d, side * (DW / 2 + 0.25));
          const cur = [x, y + 1.15, z];
          if (d >= 0) BULB('chase', x, y + 1.62, z, [0xffe04a, 0xff4a6a, 0x4ad8ff][Math.round(d / 1.5) % 3], d / 14 + (side > 0 ? 0.5 : 0), 0.85, 0.9);
          if (prev) {
            put(rod(prev, cur, 0.36, 8), RED, {}, M.paint);
            put(rod([prev[0], prev[1] - 0.55, prev[2]], [cur[0], cur[1] - 0.55, cur[2]], 0.18, 6), 0xe8e2d4, {}, M.metal);
            K.capsule(prev[0], prev[2], cur[0], cur[2], 0.45, Math.max(prev[1], cur[1]) + 0.5);
          }
          prev = cur;
        }
        // flared rail ends at the entrance (a funnel)
        const [fx, fz] = at(-4.5, side * (DW / 2 + 1.6)), [gx, gz] = at(-1.5, side * (DW / 2 + 0.25));
        put(rod([fx, 0.9, fz], [gx, 1.15, gz], 0.36, 8), RED, {}, M.paint);
        K.capsule(fx, fz, gx, gz, 0.45, 1.6);
        put(sph(0.5, 10, 6), 0xffd43a, { x: fx, y: 0.9, z: fz });
        // the broken end at the jump: rails curl up
        const [ex, ez] = at(CL + 0.6, side * (DW / 2 + 0.25)), yE = coastY(CL - 0.01) + 1.15;
        put(rod([ex, yE, ez], [ex + c * 1.6, yE + 1.2, ez + s * 1.6], 0.36, 8), RED, {}, M.paint);
      }
      // supports: white lattice trestles every 3 units, cross-ties under the deck
      for (let d = 1.5; d < CL; d += 3) {
        const y = coastY(d);
        if (y < 0.6) continue;
        for (const side of [-1, 1]) {
          const [x, z] = at(d, side * (DW / 2 - 0.4));
          put(cyl(0.22, 0.22, y, 6), 0xe8e6e0, { x, y: y / 2, z }, M.metal);
          AO(x, z, 0.8, 0.8, 0.35);
        }
        const [x1, z1] = at(d, -DW / 2 + 0.4), [x2, z2] = at(d, DW / 2 - 0.4);
        put(rod([x1, y - 0.35, z1], [x2, y - 0.35, z2], 0.2, 6), 0x2a2a2e, {}, M.metal);
        if (y > 1.4) put(rod([x1, 0.2, z1], [x2, y - 0.5, z2], 0.12, 5), 0xe8e6e0, {}, M.metal);
      }
      AO(...at(CL / 2), DW / 2 + 2, CL / 2 + 2, 0.3, ang);
      // yellow chevrons painted on the deck before the lip of the jump
      {
        const cc = canvas(128, 128, (g) => { g.fillStyle = '#16161a'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#ffd43a'; for (let i = 0; i < 4; i++) { const x = 16 + i * 32; g.beginPath(); g.moveTo(x - 12, 100); g.lineTo(x, 28); g.lineTo(x + 12, 100); g.lineTo(x + 5, 100); g.lineTo(x, 62); g.lineTo(x - 5, 100); g.fill(); } });
        const g = strip(sC0 + CL - 2.6, sC0 + CL - 0.2, 0, W - 1, 0.1, 0.4, 2.4, true);
        const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, uv.getY(i));
        const m = new T.Mesh(g, K.std({ map: tex(cc, [1, 1], true), roughness: 0.6, emissive: 0x3a3008 })); m.receiveShadow = true; K.group.add(m);
      }
    }

    // ============================================================ the wild mouse (infield south of the north straight)
    {
      // station building with its sign; the loop below runs through it
      {
        const f = frame(MOUSE.st[0], 0, MOUSE.st[1], 0);
        f(box(12, 0.8, 9), 0x6a5a48, { y: 0.4 }, M.matte);
        for (const [x, z] of [[-5.6, -4], [5.6, -4], [-5.6, 4], [5.6, 4]]) f(cyl(0.25, 0.25, 7, 6), 0xd8282a, { x, y: 4.2, z });
        for (let i = 0; i < 9; i++) f(box(1.5, 0.5, 10.5), i % 2 ? 0xf0ebe0 : 0xd8282a, { x: -6 + i * 1.5, y: 7.8 + (i % 2) * 0.05 }, M.matte);
        f(box(13.6, 1.1, 0.3), 0xd8282a, { y: 7.2, z: 5.2 });
        f(box(12.4, 2.4, 0.4), 0x111111, { y: 9.3, z: 3.5 });
        f(signGeo(12, 2.1, SIGN.maus), 0xffffff, { y: 9.3, z: 3.72 }, M.sign);
        f(box(10, 3, 0.2), [0.9, 0.75, 0.5], { y: 3.0, z: -4.3 }, M.glow);
        // the operator's booth at the back of the platform
        f(box(2.6, 2.6, 2.2), 0xf0ebe0, { x: -3.6, y: 2.1, z: -2.9 }); f(box(2.0, 0.9, 0.08), [1.1, 0.9, 0.55], { x: -3.6, y: 2.5, z: -1.78 }, M.glow);
        f.box(0, 0, 6.3, 4.8, 8);
        AO(f.cx, f.cz, 8, 6, 0.4);
        POOL(f.cx, f.cz + 2, 8, 6, 0xffc070, 0.3);
        for (let i = 0; i <= 12; i++) BULB('chase', f.cx - 6 + i, 8.2, f.cz + 5.4, i % 2 ? 0xffd43a : 0xff3b30, i / 6, 0.9);
      }
      // the wild mouse itself: a loop of red rails on white posts beside the straight, through the station; three
      // mouse-faced cars crawl up the chain lift and rattle down the drops (visual only; the posts fence it off)
      {
        const curve = new T.CatmullRomCurve3(MOUSE.pts.map(([x, y, z]) => new T.Vector3(x, y, z)), true, 'centripetal');
        const N = 360, P = curve.getSpacedPoints(N), ML = curve.getLength(), ds = ML / N;
        const tan = [], side = [];
        for (let i = 0; i <= N; i++) {
          const a = P[(i + N - 1) % N], b = P[(i + 1) % N];
          const t = new T.Vector3().subVectors(b, a).normalize();
          tan.push(t); side.push(new T.Vector3(-t.z, 0, t.x).normalize());
        }
        const lift = new T.Vector3(0, 0.12, 0), down = new T.Vector3(0, -0.3, 0);
        for (const k of [-0.55, 0.55]) {
          const rp = []; for (let i = 0; i < N; i++) rp.push(P[i].clone().addScaledVector(side[i], k).add(lift));
          put(new T.TubeGeometry(new T.CatmullRomCurve3(rp, true), N, 0.13, 5, true), 0xd8282a, {}, M.paint);
        }
        put(new T.TubeGeometry(new T.CatmullRomCurve3(P.slice(0, N).map((p) => p.clone().add(down)), true), N, 0.24, 6, true), 0xe8e4dc, {}, M.metal);
        for (let i = 0; i < N; i += 2) put(box(0.3, 0.12, 1.45), 0x2a2a2e, { x: P[i].x, y: P[i].y - 0.04, z: P[i].z, ry: -Math.atan2(tan[i].z, tan[i].x) }, M.matte);
        // posts every ~2 units (close enough that no car squeezes between them), braces on the tall ones
        const inStation = (x, z) => Math.abs(x - MOUSE.st[0]) < 6.6 && Math.abs(z - MOUSE.st[1]) < 5.1;
        let lastS = -9, kb = 0;
        for (let i = 0; i < N; i++) {
          const p = P[i];
          if (inStation(p.x, p.z) || i * ds - lastS < 2.05) continue;
          lastS = i * ds;
          const hp = p.y - 0.5, ang = -Math.atan2(tan[i].z, tan[i].x);
          put(cyl(0.18, 0.24, hp, 6), 0xeceae4, { x: p.x, y: hp / 2, z: p.z }, M.metal);
          put(box(0.22, 0.22, 1.5), 0xeceae4, { x: p.x, y: hp, z: p.z, ry: ang }, M.metal);
          if (hp > 3.5 && kb++ % 2) put(rod([p.x + side[i].x * 1.1, 0.15, p.z + side[i].z * 1.1], [p.x, hp - 0.3, p.z], 0.09, 4), 0xeceae4, {}, M.metal);
          put(cyl(0.42, 0.48, 0.3, 8), 0x3a3d42, { x: p.x, y: 0.15, z: p.z }, M.metal);
          K.circle(p.x, p.z, 0.42, Math.min(hp, 6));
          AO(p.x, p.z, 0.8, 0.8, 0.35);
        }
        // a chasing string of bulbs along the outside rail
        for (let i = 0, k = 0; i < N; i += 5, k++) {
          const q = P[i].clone().addScaledVector(side[i], 0.8);
          BULB('chase', q.x, q.y + 0.3, q.z, [0xffe04a, 0xff4a6a, 0x4ad8ff][k % 3], k / 16, 0.8, 0.85);
        }
        POOL(58, -30, 24, 13, 0xffc070, 0.26);
        // timing: slow through the station, chain lift up the west side, gravity after the top, brakes at the end
        let iTop = 0, iSt = 0;
        for (let i = 0; i < N; i++) { if (P[i].y > P[iTop].y) iTop = i; if (inStation(P[i].x, P[i].z) && i < N / 2) iSt = i; }
        const yTop = P[iTop].y, tc = new Float32Array(N + 1);
        for (let i = 0; i < N; i++) {
          let v;
          if (i <= iSt) v = 2.4;
          else if (i <= iTop) v = 3.4;
          else v = Math.min(Math.sqrt(3.4 * 3.4 + 2 * 13 * Math.max(0, yTop - P[i].y)), 2.4 + (N - i) * ds * 2.2);
          tc[i + 1] = tc[i] + ds / v;
        }
        // cars: a yellow tub with a mouse face and two riders; local +x forward
        const bodyG = BU.mergeGeometries([prep(rbox(2.4, 0.85, 1.5, 0.3), 0xffffff, mtx({ y: 0.75 })), prep(sph(0.62, 12, 8), 0xffffff, mtx({ x: 1.15, y: 1.05, sx: 0.9, sy: 0.8 }))], false);
        const detG = BU.mergeGeometries([
          ...[-0.5, 0.5].map((z) => prep(cyl(0.42, 0.42, 0.1, 10), 0x5a5a60, mtx({ x: 1.05, y: 1.75, z, rz: PI / 2 }))),
          ...[-0.5, 0.5].map((z) => prep(cyl(0.28, 0.28, 0.12, 10), 0xff9ab8, mtx({ x: 1.08, y: 1.75, z, rz: PI / 2 }))),
          prep(sph(0.17, 8, 6), 0x111111, mtx({ x: 1.78, y: 1.0 })),
          ...[-0.25, 0.25].map((z) => prep(sph(0.11, 6, 4), 0x111111, mtx({ x: 1.6, y: 1.32, z }))),
          ...[-0.15, -0.95].map((x) => prep(sph(0.33, 10, 8), 0xf0c8a0, mtx({ x, y: 1.55 }))),
          ...[-0.15, -0.95].map((x) => prep(cyl(0.34, 0.4, 0.5, 8), 0x2f4a7a, mtx({ x, y: 1.1 }))),
          ...[-0.8, 0.8].flatMap((x) => [-0.62, 0.62].map((z) => prep(cyl(0.2, 0.2, 0.18, 8), 0x1a1a1a, mtx({ x, y: 0.28, z, rx: PI / 2 })))),
        ], false);
        const bodies = new T.InstancedMesh(bodyG, K.phys({ vertexColors: true, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2 }), MOUSE.n);
        const dets = new T.InstancedMesh(detG, M.paint, MOUSE.n);
        [0xffd43a, 0xf4f0e6, 0xff7a1a].forEach((c, i) => bodies.setColorAt(i, new T.Color(c)));
        for (const m of [bodies, dets]) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; K.group.add(m); }
        A.mouse = { P, tc, T: tc[N], N, bodies, dets, f: new T.Vector3(), u: new T.Vector3(), s: new T.Vector3(), p: new T.Vector3(), Y: new T.Vector3(0, 1, 0) };
      }
    }

    // ============================================================ the Ferris wheel (north edge), animated
    {
      const { x: wx, z: wz, R, hub: HY, n } = WHEEL;
      const WZ = 2.7; // half depth between the two rims
      // static: A-frame legs, axle, bracing, base platform, stairs, booth, sign
      const LEG = 0xe8e4dc;
      for (const sz of [-1, 1]) {
        for (const sx of [-1, 1]) {
          put(rod([wx + sx * 12.5, 0, wz + sz * 7.2], [wx, HY, wz + sz * 3.6], 0.55, 8), LEG, {}, M.metal);
          put(cyl(1.0, 1.2, 0.8, 10), 0x3a3d42, { x: wx + sx * 12.5, y: 1.9, z: wz + sz * 7.2 }, M.metal);
        }
        for (const y of [8, 16]) { const k = y / HY, dx = lerp(12.5, 0, k), dz = lerp(7.2, 3.6, k); put(rod([wx - dx, y, wz + sz * dz], [wx + dx, y, wz + sz * dz], 0.3, 6), LEG, {}, M.metal); }
        put(rod([wx - 12.5, 1.5, wz + sz * 7.2], [wx + 6.25, 12.8, wz + sz * 5.4], 0.2, 5), LEG, {}, M.metal);
        put(rod([wx + 12.5, 1.5, wz + sz * 7.2], [wx - 6.25, 12.8, wz + sz * 5.4], 0.2, 5), LEG, {}, M.metal);
      }
      put(rod([wx, HY, wz - 4.4], [wx, HY, wz + 4.4], 0.75, 12), 0x9a9ea6, {}, M.metal);
      // base platform with steps and a railing
      put(box(32, 1.5, 15), 0x2a2530, { x: wx, y: 0.75, z: wz }, M.matte);
      for (let i = 0; i < 22; i++) put(box(1.42, 0.2, 15.4), i % 2 ? 0x5a4232 : 0x4e3a2c, { x: wx - 15.75 + i * 1.5, y: 1.55, z: wz }, M.matte);
      put(box(32.6, 0.35, 0.5), 0xd8282a, { x: wx, y: 1.5, z: wz + 7.5 }, M.paint);
      // a queue of riders on the platform
      for (let i = 0; i < 7; i++) { const x = wx - 9 + i * 1.3 + (i % 2) * 0.3, z = wz + 4.6 - (i % 3) * 0.6; put(cyl(0.45, 0.58, 2.1, 8), [0x2f4a7a, 0x8a2a2a, 0xd8b85a, 0x2a6a4a, 0x5a3a7a][i % 5], { x, y: 2.75, z }); put(sph(0.4, 8, 6), 0xf0c8a0, { x, y: 4.1, z }); put(cyl(0.38, 0.3, 1.2, 6), 0x222228, { x, y: 1.95 + 0.0, z }); }
      for (let i = 0; i < 3; i++) put(box(6, 0.5, 1.2), 0xc9b48a, { x: wx, y: 0.25 + i * 0.5, z: wz + 7.5 + (2 - i) * 1.1 + 0.6 }, M.matte);
      for (const sx of [-1, 1]) for (let i = 0; i < 8; i++) put(cyl(0.08, 0.08, 1.4, 5), 0xd8d8d8, { x: wx + sx * (5 + i * 1.4), y: 2.3, z: wz + 7.4 }, M.metal);
      for (const sx of [-1, 1]) put(box(10.5, 0.12, 0.12), 0xd8d8d8, { x: wx + sx * 9.9, y: 3.0, z: wz + 7.4 }, M.metal);
      K.box(wx, wz, 16.2, 7.6, 0, 4);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.circle(wx + sx * 12.5, wz + sz * 7.2, 1.2, 20);
      AO(wx, wz, 19, 10, 0.5);
      // sign on a frame at the front of the platform
      put(box(16.5, 2.8, 0.4), 0x0e1424, { x: wx - 15, y: 4.6, z: wz + 8.4 });
      put(signGeo(16, 2.4, SIGN.rad), 0xffffff, { x: wx - 15, y: 4.6, z: wz + 8.62 }, M.sign);
      for (const sx of [-1, 1]) put(cyl(0.15, 0.15, 3.4, 6), 0x888888, { x: wx - 15 + sx * 7, y: 1.7, z: wz + 8.4 }, M.metal);
      // ticket booth
      { const f = frame(wx + 15, 1.6, wz + 4.5, 0); f(box(4, 4, 3.4), 0x2f6fd2, { y: 2 }); f(cone(3.2, 1.8, 4), 0xf0ebe0, { y: 4.9, ry: PI / 4 }); f(box(2.6, 1.4, 0.1), [1.1, 0.9, 0.55], { y: 2.6, z: 1.72 }, M.glow); }
      // warm pool under the wheel and a pink glow on the north straight behind it
      POOL(wx, wz + 6, 24, 11, 0xff9a6a, 0.28);
      POOL(wx, wz - 14, 22, 8, 0xff8ab0, 0.2);
      POOL(137, wz - 16, 11, 15, 0xff8ab0, 0.26);
      // rotating part
      const rot = new T.Group(); rot.position.set(wx, HY, wz); K.group.add(rot);
      const sp = asm();
      const WH = 0xf4f2ec;
      for (const sz of [-1, 1]) {
        sp(new T.TorusGeometry(R, 0.32, 6, 96), WH, { z: sz * WZ }, M.metal);
        sp(new T.TorusGeometry(R * 0.62, 0.24, 6, 64), WH, { z: sz * WZ }, M.metal);
        sp(new T.TorusGeometry(R + 0.9, 0.12, 4, 96), 0xd8282a, { z: sz * WZ }, M.paint);
        for (let i = 0; i < n; i++) {
          const t = (i / n) * TAU, t2 = ((i + 0.5) / n) * TAU;
          sp(rod([Math.cos(t) * 1.8, Math.sin(t) * 1.8, sz * 1.4], [Math.cos(t) * R, Math.sin(t) * R, sz * WZ], 0.16, 5), WH, {}, M.metal);
          // zig-zag truss between inner and outer ring
          sp(rod([Math.cos(t) * R * 0.62, Math.sin(t) * R * 0.62, sz * WZ], [Math.cos(t2) * R, Math.sin(t2) * R, sz * WZ], 0.12, 4), WH, {}, M.metal);
          sp(rod([Math.cos(t2) * R, Math.sin(t2) * R, sz * WZ], [Math.cos(t + TAU / n) * R * 0.62, Math.sin(t + TAU / n) * R * 0.62, sz * WZ], 0.12, 4), WH, {}, M.metal);
        }
      }
      for (let i = 0; i < n; i++) { const t = (i / n) * TAU; sp(rod([Math.cos(t) * R, Math.sin(t) * R, -WZ - 0.4], [Math.cos(t) * R, Math.sin(t) * R, WZ + 0.4], 0.2, 6), 0x9a9ea6, {}, M.metal); }
      sp(cyl(2.3, 2.3, 6.2, 18), 0xd8282a, { rx: PI / 2 }, M.paint);
      sp(cyl(2.6, 2.6, 0.4, 18), 0xffd43a, { rx: PI / 2, z: 3.2 }, M.paint);
      sp(cyl(2.6, 2.6, 0.4, 18), 0xffd43a, { rx: PI / 2, z: -3.2 }, M.paint);
      sp.build(rot, true);
      // bulbs on the rotating wheel (local to the hub): rims chase round, spokes pulse outward
      const wb = [];
      const nr = 72;
      for (let i = 0; i < nr; i++) { const t = (i / nr) * TAU; for (const sz of [-1, 1]) wb.push({ x: Math.cos(t) * (R + 0.9), y: Math.sin(t) * (R + 0.9), z: sz * (WZ + 0.1), c: [0xff4a6a, 0xffe04a, 0x4ad8ff, 0xffffff][i % 4], ph: (i / nr) * 6, s: 1.2, halo: 1 }); }
      for (let i = 0; i < n; i++) { const t = (i / n) * TAU; for (let k = 1; k <= 6; k++) { const q = 2.5 + (k / 6) * (R - 3); wb.push({ x: Math.cos(t) * q, y: Math.sin(t) * q, z: WZ + 0.2, c: i % 2 ? 0xffd04a : 0xff6ab0, ph: k / 6, s: 0.95, halo: 0.8 }); } }
      A.wheelBulbs = wb;
      A.wheel = { rot };
      // gondolas: instanced cabins hanging from the rim, kept upright in animate
      const body = [];
      {
        const g1 = prep(cyl(1.55, 1.55, 2.3, 6), 0xffffff, mtx({ y: -3.2 }));
        const g2 = prep(cone(1.95, 1.0, 6), 0xf6f2e8, mtx({ y: -1.55 }));
        const g3 = prep(cyl(1.7, 1.45, 0.35, 6), 0x555555, mtx({ y: -4.45 }));
        const g4 = prep(box(0.18, 1.6, 0.18), 0x9a9ea6, mtx({ y: -0.6 }));
        body.push(g1, g2, g3, g4);
      }
      const cabGeo = BU.mergeGeometries(body, false);
      const winGeo = prep(cyl(1.58, 1.58, 0.95, 6, true), 0xffffff, mtx({ y: -2.95 }));
      const cabCols = [0xd8282a, 0xffc12a, 0x2f6fd2, 0x2fa04a, 0xff7a1a, 0x8a4fd8, 0x1ab8b0, 0xff4a8a];
      const cabs = new T.InstancedMesh(cabGeo, K.phys({ vertexColors: true, roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.25 }), n);
      const wins = new T.InstancedMesh(winGeo, new T.MeshBasicMaterial({ vertexColors: true }), n);
      for (let i = 0; i < n; i++) { cabs.setColorAt(i, new T.Color(cabCols[i % cabCols.length])); wins.setColorAt(i, new T.Color(1.25, 0.95, 0.6)); }
      cabs.castShadow = true; cabs.receiveShadow = true; wins.castShadow = false;
      cabs.frustumCulled = false; wins.frustumCulled = false;
      K.group.add(cabs); K.group.add(wins);
      A.cabs = { cabs, wins, n, R };
      // real light: warm pink glow between the wheel and the north straight
      const pl = new T.PointLight(0xff9ab8, 460, 95, 1.7); pl.position.set(wx + 21, 15, wz - 6); K.group.add(pl); A.wheelLight = pl;
    }

    // ============================================================ the carousel (in the pocket west of the midway)
    {
      const { x: cx, z: cz, R } = CARO;
      // static base: round plinth with steps, the collider
      put(cyl(R + 0.8, R + 1.2, 1.0, 40), 0x5a3a52, { x: cx, y: 0.5, z: cz }, M.matte);
      put(new T.TorusGeometry(R + 1.0, 0.14, 4, 48), 0xffd43a, { x: cx, y: 1.0, z: cz, rx: PI / 2 }, M.metal);
      K.circle(cx, cz, R + 1.1, 4);
      AO(cx, cz, R + 3, R + 3, 0.5);
      // rotating platform, centre column, canopy (rotating group)
      const rot = new T.Group(); rot.position.set(cx, 0, cz); K.group.add(rot);
      const sp = asm();
      sp(cyl(R, R, 0.5, 40), 0xb0402a, { y: 1.25 }, M.paint);
      sp(cyl(R * 0.98, R * 0.98, 0.06, 40), 0xc9a86a, { y: 1.52 }, M.matte);
      sp(cyl(2.2, 2.4, 9.5, 16), 0x7a2a5a, { y: 6.0 }, M.paint);
      // mirror panels round the column (lit)
      for (let i = 0; i < 8; i++) { const t = (i / 8) * TAU; sp(box(1.4, 5.5, 0.1), [0.9, 0.75, 0.55], { x: Math.cos(t) * 2.42, y: 6.2, z: Math.sin(t) * 2.42, ry: -t + PI / 2 }, M.glow); }
      // canopy: scalloped rounding boards + striped cone roof
      sp(cyl(R + 1.0, R + 1.0, 2.4, 40, true), 0xd8282a, { y: 11.0 }, M.paint);
      sp(cyl(R + 0.9, R + 0.9, 2.2, 40, true), 0x7a2a5a, { y: 11.0 }, M.paint);
      sp(signGeo(10, 1.5, SIGN.karussell), 0xffffff, { y: 11.0, z: R + 1.06 }, M.sign);
      sp(signGeo(10, 1.5, SIGN.karussell), 0xffffff, { y: 11.0, z: -R - 1.06, ry: PI }, M.sign);
      const nStripe = 16;
      for (let i = 0; i < nStripe; i++) {
        const g = new T.ConeGeometry(R + 1.6, 4.4, 3, 1, false, (i / nStripe) * TAU, TAU / nStripe);
        sp(g, i % 2 ? 0xf4ecdc : 0xd8282a, { y: 14.4 }, M.paint);
      }
      sp(cone(0.5, 2.2, 8), 0xffd43a, { y: 17.6 }, M.metal);
      sp(sph(0.6, 10, 8), 0xffd43a, { y: 18.8 }, M.metal);
      // scallops under the rounding boards
      for (let i = 0; i < 32; i++) { const t = (i / 32) * TAU; sp(new T.CircleGeometry(0.85, 8, PI, PI), i % 2 ? 0xffd43a : 0xf4ecdc, { x: Math.cos(t) * (R + 1.02), y: 9.8, z: Math.sin(t) * (R + 1.02), ry: -t + PI / 2 }, M.paint); }
      // brass poles
      const HN = 16;
      const horses = [];
      for (let i = 0; i < HN; i++) {
        const ring = i % 2, t = (i / HN) * TAU, rr = ring ? R * 0.62 : R * 0.86;
        const x = Math.cos(t) * rr, z = Math.sin(t) * rr;
        sp(cyl(0.12, 0.12, 8.3, 6), 0xd8b25a, { x, y: 5.75, z }, M.metal);
        horses.push({ x, z, t, ph: i * 1.3 });
      }
      sp.build(rot, true);
      // bulbs on the canopy (chase) and roof ribs
      const cb = [];
      for (let i = 0; i < 48; i++) { const t = (i / 48) * TAU; cb.push({ x: Math.cos(t) * (R + 1.1), y: 12.3, z: Math.sin(t) * (R + 1.1), c: i % 2 ? 0xffe9a0 : 0xff6a4a, ph: i / 8, s: 1.1, halo: 1 }); cb.push({ x: Math.cos(t) * (R + 1.1), y: 9.75, z: Math.sin(t) * (R + 1.1), c: 0xffe9a0, ph: i / 8 + 0.5, s: 0.9, halo: 0.7 }); }
      for (let i = 0; i < 8; i++) { const t = (i / 8) * TAU; for (let k = 1; k <= 4; k++) { const q = (R + 1.4) * (1 - k / 5); cb.push({ x: Math.cos(t) * q, y: 12.2 + 4.4 * (k / 5) * 0.98, z: Math.sin(t) * q, c: 0xffd480, ph: k / 4, s: 0.9, halo: 0.8 }); } }
      A.caroBulbs = cb;
      // horses: instanced, bobbing on their poles
      const hp = [];
      const HC = 0xf4ece0, GOLD = 0xd8b25a;
      hp.push(prep(sph(1, 12, 8), HC, mtx({ sx: 1.35, sy: 0.62, sz: 0.55 })));
      hp.push(prep(cyl(0.32, 0.42, 1.5, 8), HC, mtx({ x: 1.15, y: 0.75, rz: -0.55 })));
      hp.push(prep(rbox(1.2, 0.5, 0.48, 0.2), HC, mtx({ x: 1.8, y: 1.25, rz: -0.5 })));
      hp.push(prep(box(0.75, 0.32, 0.12), 0x7a2a5a, mtx({ x: 1.4, y: 1.3, rz: 0.5 })));
      for (const [lx, a1] of [[0.85, -0.6], [0.6, -0.9], [-0.8, 0.7], [-1.0, 0.4]]) for (const lz of [-0.2, 0.2]) hp.push(prep(cyl(0.11, 0.08, 1.3, 5), HC, mtx({ x: lx, y: -0.75, z: lz, rz: a1 })));
      hp.push(prep(cone(0.28, 1.3, 6), 0xc9a86a, mtx({ x: -1.6, y: -0.1, rz: 2.3 })));
      hp.push(prep(box(0.9, 0.18, 1.15), 0xd8282a, mtx({ y: 0.6 })));
      hp.push(prep(box(0.95, 0.06, 1.2), GOLD, mtx({ y: 0.72 })));
      const hgeo = BU.mergeGeometries(hp, false);
      const him = new T.InstancedMesh(hgeo, K.phys({ vertexColors: true, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2 }), HN);
      him.castShadow = true; him.receiveShadow = true; him.frustumCulled = false;
      rot.add(him);
      A.caro = { rot, horses, him };
      // real light: warm, from the column
      const pl = new T.PointLight(0xffb070, 300, 70, 1.8); pl.position.set(cx, 8, cz + 6); K.group.add(pl); A.caroLight = pl;
      POOL(cx, cz, R + 7, R + 7, 0xffa860, 0.4);
    }

    // ============================================================ the octopus (centre of the south-east bend)
    {
      const { x: ox, z: oz } = OCTO;
      // tip reach: keep the swooping tubs just outside the inner edge of the bend
      let minD = Infinity;
      for (let s = 0; s < L; s += 1) { const p = track.at(s); const d = Math.hypot(p.x - ox, p.z - oz); if (d < minD) minD = d; }
      const reach = minD - W / 2 - 0.55; // outermost point of a tub
      A.octoLb = Math.max(8, reach - OCTO.tubR - 1.0);
      A.octoReach = reach;
      // base: plinth, fence ring, kiosk, column
      put(cyl(5.6, 6.0, 1.1, 24), 0x3a2a4a, { x: ox, y: 0.55, z: oz }, M.matte);
      put(cyl(1.3, 1.6, OCTO.hub, 12), 0x8a4fd8, { x: ox, y: OCTO.hub / 2, z: oz }, M.paint);
      K.circle(ox, oz, 6.0, 6);
      AO(ox, oz, 8, 8, 0.45);
      for (let i = 0; i < 20; i++) { const t = (i / 20) * TAU; put(cyl(0.08, 0.08, 1.2, 4), 0xd8d8d8, { x: ox + Math.cos(t) * 6.4, y: 1.7, z: oz + Math.sin(t) * 6.4 }, M.metal); }
      put(new T.TorusGeometry(6.4, 0.08, 4, 40), 0xd8d8d8, { x: ox, y: 2.3, z: oz, rx: PI / 2 }, M.metal);
      // sign on a little gantry facing the camera, behind the column (north side)
      put(box(9.5, 1.8, 0.3), 0x14081f, { x: ox - 3, y: 4.2, z: oz - 6.5 });
      put(signGeo(9.2, 1.5, SIGN.krak), 0xffffff, { x: ox - 3, y: 4.2, z: oz - 6.33 }, M.sign);
      for (const sx of [-1, 1]) put(cyl(0.12, 0.12, 3.4, 5), 0x888888, { x: ox - 3 + sx * 4.4, y: 1.7, z: oz - 6.5 }, M.metal);
      // rotating head: an octopus head with big eyes on the column
      const head = new T.Group(); head.position.set(ox, OCTO.hub, oz); K.group.add(head);
      const hs = asm();
      hs(sph(2.8, 20, 14), 0x9a4fe0, { y: 1.9, sy: 1.25 }, M.paint);
      hs(cyl(3.0, 2.4, 1.2, 20), 0x7a3ac0, { y: 0 }, M.paint);
      for (const a2 of [-0.45, 0.45]) { hs(sph(0.75, 12, 8), 0xffffff, { x: Math.cos(a2) * 2.55, y: 2.3, z: Math.sin(a2) * 2.55 }); hs(sph(0.36, 10, 6), 0x111111, { x: Math.cos(a2) * 3.05, y: 2.3, z: Math.sin(a2) * 3.05 }); }
      for (let i = 0; i < 10; i++) { const t = (i / 10) * TAU; hs(sph(0.35, 8, 6), 0xc48aff, { x: Math.cos(t) * 2.4, y: 3.6, z: Math.sin(t) * 2.4 }); }
      hs.build(head, true);
      A.octoHead = head;
      // arms (instanced lattice beams) and tubs (instanced), posed in animate
      const Lb = A.octoLb;
      const ap = [];
      ap.push(prep(box(Lb, 0.55, 0.7), 0x8a3fd0, mtx({ x: Lb / 2, y: 0.5 })));
      ap.push(prep(box(Lb, 0.4, 0.5), 0x8a3fd0, mtx({ x: Lb / 2, y: -0.55 })));
      for (let k = 0; k < Math.floor(Lb / 1.2); k++) ap.push(prep(box(0.16, 1.1, 0.16), 0xe8e4f0, mtx({ x: 0.6 + k * 1.2, rz: k % 2 ? 0.7 : -0.7 })));
      const armGeo = BU.mergeGeometries(ap, false);
      const arms = new T.InstancedMesh(armGeo, M.paint, OCTO.n);
      const tp = [];
      tp.push(prep(cyl(OCTO.tubR, OCTO.tubR * 0.85, 1.7, 16), 0xffffff, mtx({ y: 0.85 })));
      tp.push(prep(cyl(OCTO.tubR * 0.86, OCTO.tubR * 0.86, 0.15, 16), 0x2a2a2a, mtx({ y: 1.55 })));
      tp.push(prep(box(0.2, 2.2, 0.2), 0xd8d8d8, mtx({ y: 2.8 })));
      tp.push(prep(sph(0.5, 10, 6), 0xffd43a, mtx({ y: 3.85 })));
      for (const a2 of [0, 2.1, 4.2]) tp.push(prep(sph(0.42, 8, 6), 0xf0c8a0, mtx({ x: Math.cos(a2) * 1.1, y: 2.2, z: Math.sin(a2) * 1.1 })));
      const tubs = new T.InstancedMesh(BU.mergeGeometries(tp, false), K.phys({ vertexColors: true, roughness: 0.35, clearcoat: 0.6 }), OCTO.n);
      const tubCols = [0xff3b6a, 0x2fd0ff, 0xffd43a, 0x5ae05a, 0xff8a2a];
      for (let i = 0; i < OCTO.n; i++) { tubs.setColorAt(i, new T.Color(tubCols[i])); arms.setColorAt(i, new T.Color(0xffffff)); }
      const ring = new T.InstancedMesh(prep(new T.TorusGeometry(OCTO.tubR + 0.05, 0.13, 4, 24), 0xffffff, mtx({ rx: PI / 2, y: 1.72 })), new T.MeshBasicMaterial({ vertexColors: true }), OCTO.n);
      for (let i = 0; i < OCTO.n; i++) ring.setColorAt(i, new T.Color(tubCols[i]).multiplyScalar(1.6));
      for (const m of [arms, tubs]) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; K.group.add(m); }
      ring.frustumCulled = false; K.group.add(ring);
      const strip2 = new T.InstancedMesh(prep(box(Lb - 1, 0.12, 0.2), 0xffffff, mtx({ x: Lb / 2 + 0.3, y: 0.82 })), new T.MeshBasicMaterial({ vertexColors: true }), OCTO.n);
      for (let i = 0; i < OCTO.n; i++) strip2.setColorAt(i, new T.Color(tubCols[i]).multiplyScalar(1.4));
      strip2.frustumCulled = false; K.group.add(strip2);
      const sg = new T.PlaneGeometry(1, 1); sg.rotateX(-PI / 2);
      const shadows = new T.InstancedMesh(sg, contactMat, OCTO.n); shadows.renderOrder = 1; shadows.frustumCulled = false; K.group.add(shadows);
      A.octo = { arms, tubs, ring, shadows, strip2, cols: tubCols.map((c) => new T.Color(c).multiplyScalar(1.6)), warn: new T.Color(3.2, 0.25, 0.15), tmp: new T.Color() };
      // movers: a tub low over the inside of the bend shoves you; up high it passes over
      for (let i = 0; i < OCTO.n; i++) {
        K.mover({ type: 'circle', r: OCTO.tubR + 0.15, h: 0 }, (t) => {
          const q = octoArm(i, t);
          return { x: ox + Math.cos(q.az) * q.rad, z: oz + Math.sin(q.az) * q.rad, angle: 0, h: q.bottom < 2.0 ? q.bottom + 2.4 : 0 };
        });
      }
      // magenta glow under the ride
      POOL(ox, oz, 20, 20, 0xc04aff, 0.22);
      const pl = new T.PointLight(0xd890ff, 260, 60, 1.8); pl.position.set(ox, 12, oz + 4); K.group.add(pl);
    }

    // ============================================================ the chair-o-plane (west infield)
    {
      const { x: cx, z: cz } = SWING;
      put(cyl(3.2, 3.6, 1.0, 20), 0x2f4a6a, { x: cx, y: 0.5, z: cz }, M.matte);
      put(cyl(0.9, 1.2, 15, 12), 0xd8d2c4, { x: cx, y: 7.5, z: cz }, M.metal);
      K.circle(cx, cz, 3.6, 15);
      AO(cx, cz, 5, 5, 0.5);
      // fence ring
      const FR = 13;
      for (let i = 0; i < 28; i++) {
        const t = (i / 28) * TAU, t2 = ((i + 1) / 28) * TAU;
        const x1 = cx + Math.cos(t) * FR, z1 = cz + Math.sin(t) * FR, x2 = cx + Math.cos(t2) * FR, z2 = cz + Math.sin(t2) * FR;
        put(cyl(0.1, 0.1, 1.4, 4), 0xe8e4dc, { x: x1, y: 0.7, z: z1 }, M.metal);
        put(rod([x1, 1.35, z1], [x2, 1.35, z2], 0.07, 4), 0xe8e4dc, {}, M.metal);
        K.capsule(x1, z1, x2, z2, 0.25, 1.5);
      }
      const rot = new T.Group(); rot.position.set(cx, 15, cz); K.group.add(rot);
      const sp = asm();
      const nS = 14;
      for (let i = 0; i < nS; i++) { const g = new T.ConeGeometry(7.2, 3.2, 3, 1, false, (i / nS) * TAU, TAU / nS); sp(g, i % 2 ? 0xf4ecdc : 0x2f8ad8, { y: 2.2 }, M.paint); }
      sp(cyl(7.0, 7.0, 1.6, 36, true), 0x1a5a9a, { y: 0.4 }, M.paint);
      sp(signGeo(8, 1.0, SIGN.kette), 0xffffff, { y: 0.4, z: 7.06 }, M.sign);
      sp(signGeo(8, 1.0, SIGN.kette), 0xffffff, { y: 0.4, z: -7.06, ry: PI }, M.sign);
      sp(sph(0.7, 10, 8), 0xffd43a, { y: 4.1 }, M.metal);
      sp.build(rot, true);
      const sb = [];
      for (let i = 0; i < 40; i++) { const t = (i / 40) * TAU; sb.push({ x: Math.cos(t) * 7.1, y: -0.45, z: Math.sin(t) * 7.1, c: i % 2 ? 0xffe9a0 : 0x6ad8ff, ph: i / 10, s: 1, halo: 1 }); }
      A.swingBulbs = sb;
      // chairs on chains: instanced, posed in animate (swing out with the speed)
      const NC = 16, CHL = 6.8;
      const cp = [];
      cp.push(prep(box(1.3, 0.18, 1.1), 0xffffff, mtx({ y: -CHL })));
      cp.push(prep(box(1.3, 1.1, 0.14), 0xffffff, mtx({ y: -CHL + 0.55, z: -0.5 })));
      cp.push(prep(sph(0.42, 8, 6), 0xf0c8a0, mtx({ y: -CHL + 1.25, z: -0.1 })));
      cp.push(prep(box(0.9, 0.9, 0.5), 0x3a5a9a, mtx({ y: -CHL + 0.55, z: -0.05 })));
      for (const lx of [-0.6, 0.6]) cp.push(prep(box(0.05, CHL, 0.05), 0xb8bcc0, mtx({ x: lx, y: -CHL / 2 })));
      const chairs = new T.InstancedMesh(BU.mergeGeometries(cp, false), K.phys({ vertexColors: true, roughness: 0.4, clearcoat: 0.4 }), NC);
      const chCols = [0xff3b30, 0xffd43a, 0x2fd0ff, 0x5ae05a];
      for (let i = 0; i < NC; i++) chairs.setColorAt(i, new T.Color(chCols[i % 4]));
      chairs.castShadow = true; chairs.receiveShadow = true; chairs.frustumCulled = false; K.group.add(chairs);
      A.swing = { rot, chairs, NC, CHL };
      POOL(cx, cz, 15, 15, 0x7ac8ff, 0.2);
    }

    // ============================================================ stalls
    // stall(): local frame, front faces +z towards the road. o: {w, d, h, sign, col, stripes:[a,b], goods(f)}
    const stall = (cx, cz, ry, o) => {
      const w = o.w ?? 12, d = o.d ?? 6.5, h = o.h ?? 7.2;
      const f = frame(cx, 0, cz, ry);
      const col = o.col ?? 0xd8c9a6, dark = new T.Color(col).multiplyScalar(0.7).getHex();
      const [s1, s2] = o.stripes ?? [0xd8282a, 0xf4ecdc];
      f(box(w, 0.5, d), 0x4a3426, { y: 0.25 }, M.matte);
      f(box(w, h, 0.35), col, { y: h / 2, z: -d / 2 + 0.18 });
      for (const sx of [-1, 1]) f(box(0.35, h, d), dark, { x: sx * (w / 2 - 0.18), y: h / 2 });
      f(box(w - 1.2, h - 3.2, 0.06), [0.75, 0.58, 0.36], { y: 1.0 + (h - 3.2) / 2 + 1.0, z: -d / 2 + 0.4 }, M.glow);
      // counter with a striped front
      const ns = Math.max(4, Math.round((w - 0.8) / 1.1));
      for (let i = 0; i < ns; i++) f(box((w - 0.8) / ns + 0.01, 2.0, 0.25), i % 2 ? s1 : s2, { x: -(w - 0.8) / 2 + ((i + 0.5) * (w - 0.8)) / ns, y: 1.5, z: d / 2 - 0.15 });
      f(box(w - 0.8, 2.0, 0.9), dark, { y: 1.5, z: d / 2 - 0.75 });
      f(box(w - 0.4, 0.22, 1.5), 0xc9a06a, { y: 2.6, z: d / 2 - 0.55 }, M.matte);
      // pitched, striped canvas roof with gables, and the striped awning sloping out over the counter
      const aw = 2.8, drop = 1.3, aang = Math.atan2(drop, aw), alen = Math.hypot(aw, drop);
      const na = Math.max(6, Math.round(w / 1.2));
      const rz = -0.6, ry0 = h + 1.7, fe = d / 2 + 0.2, be = -d / 2 - 0.3;
      const fl = Math.hypot(fe - rz, ry0 - h), bl = Math.hypot(rz - be, ry0 - h), fa = Math.atan2(ry0 - h, fe - rz), ba = Math.atan2(ry0 - h, rz - be);
      for (let i = 0; i < na; i++) {
        const x = -w / 2 + (i + 0.5) * (w / na), c = i % 2 ? s1 : s2;
        f(box(w / na + 0.01, 0.14, fl + 0.1), c, { x, y: (ry0 + h) / 2, z: (fe + rz) / 2, rx: fa }, M.matte);
        f(box(w / na + 0.01, 0.14, bl + 0.1), c, { x, y: (ry0 + h) / 2, z: (be + rz) / 2, rx: -ba }, M.matte);
      }
      for (const sx of [-1, 1]) {
        const gs = new T.Shape(); gs.moveTo(be * sx, h); gs.lineTo(fe * sx, h); gs.lineTo(rz * sx, ry0); gs.closePath();
        f(new T.ExtrudeGeometry(gs, { depth: 0.12, bevelEnabled: false }), dark, { x: sx * (w / 2 + 0.07), ry: -sx * PI / 2 });
      }
      f(box(w + 0.4, 0.3, d + 0.5), dark, { y: h - 0.1, z: -0.05 });
      for (let i = 0; i < na; i++) f(box(w / na + 0.01, 0.1, alen), i % 2 ? s1 : s2, { x: -w / 2 + (i + 0.5) * (w / na), y: h - drop / 2 - 0.05, z: d / 2 + aw / 2, rx: aang });
      for (let i = 0; i < na; i++) f(new T.CircleGeometry(w / na / 2, 8, PI, PI), i % 2 ? s1 : s2, { x: -w / 2 + (i + 0.5) * (w / na), y: h - drop - 0.05, z: d / 2 + aw + 0.02 });
      // sign board above the front edge of the roof, leaning back so it reads from above
      // stalls facing east or west (along the midway) also get a name board on the south end of the roof, facing
      // the camera: their front sign reads sideways from above
      if (o.gable && o.sign != null) {
        const gz = cz + w / 2 - 0.3, gw = Math.min(d + 2.4, 9.4), gh = 1.3, gy = h + 2.75, lean = 0.32;
        put(box(gw + 0.45, gh + 0.45, 0.22), 0x15100c, { x: cx, y: gy, z: gz - 0.2, rx: -lean });
        put(signGeo(gw, gh, o.sign), 0xffffff, { x: cx, y: gy, z: gz, rx: -lean }, M.sign);
        for (const sx of [-1, 1]) put(box(0.18, 1.9, 0.18), 0x222222, { x: cx + sx * (gw / 2 - 0.7), y: h + 1.45, z: gz - 0.45 });
        for (let i = 0; i <= 8; i++) BULB('chase', cx - gw / 2 - 0.1 + (i * (gw + 0.2)) / 8, gy + gh / 2 + 0.4, gz - 0.35, i % 2 ? 0xfff0c0 : (o.bulb ?? 0xff6a4a), i / 5, 0.75, 0.8);
      }
      if (o.sign != null) {
        const sw = o.signW ?? (o.gable ? w - 4.2 : w - 1.2), lean = o.lean ?? 0.2, sy = h + 2.0, sz = d / 2 + 0.15;
        f(box(sw + 0.5, 2.3, 0.3), 0x15100c, { y: sy, z: sz, rx: -lean });
        f(signGeo(sw, 1.95, o.sign), 0xffffff, { y: sy + Math.sin(lean) * 0.17, z: sz + Math.cos(lean) * 0.17, rx: -lean }, M.sign);
        for (const sx of [-1, 1]) f(box(0.2, 1.6, 0.2), 0x222222, { x: sx * (sw / 2 - 0.5), y: h + 0.6, z: sz - 0.3 });
      }
      // bulbs along the awning edge
      const nb = Math.round(w / 1.15);
      for (let i = 0; i <= nb; i++) { const [x, z] = f.pt(-w / 2 + (i * w) / nb, d / 2 + aw + 0.1); BULB('twinkle', x, h - drop - 0.25, z, i % 2 ? 0xffe1a0 : (o.bulb ?? 0xff6a4a), i * 0.37, 0.85, 0.8); }
      if (o.goods) o.goods(f, w, d, h);
      f.box(0, 0.2, w / 2 + 0.2, d / 2 + 0.25, h + 2.5);
      AO(cx, cz, w / 2 + 1.5, d / 2 + 1.5, 0.5, f.ang());
      const [px, pz] = f.pt(0, d / 2 + 4.5);
      POOL(px, pz, w * 0.75, 6, 0xffb468, 0.42, f.ang());
      return f;
    };
    const ry4dir = { s: 0, n: PI, e: PI / 2, w: -PI / 2 }; // front faces south / north / east / west
    // --- Gromperekichelcher (midway, east side, facing west)
    const goldMat = 0xd8a040;
    stall(-12, -14, ry4dir.w, {
      w: 13, lean: 0.6, gable: true, sign: SIGN.gromp, col: 0x7a2a1a, stripes: [0xffc12a, 0x7a2a1a], bulb: 0xffc12a,
      goods: (f, w, d) => {
        f(box(4, 1.6, 2), 0xb8bcc4, { x: -2.5, y: 3.4, z: -0.6 }, M.metal);
        f(box(3.6, 0.1, 1.6), [1.0, 0.55, 0.15], { x: -2.5, y: 4.22, z: -0.6 }, M.glow);
        for (let i = 0; i < 16; i++) f(cyl(0.5, 0.5, 0.18, 8), goldMat, { x: 1.5 + (i % 4) * 0.9 + r.range(-0.1, 0.1), y: 2.85 + Math.floor(i / 8) * 0.18, z: d / 2 - 0.7 + Math.floor((i % 8) / 4) * 0.5 - 0.3, rx: r.range(-0.3, 0.3) });
        for (let i = 0; i < 5; i++) f(cone(0.45, 1.2, 8), 0xf4ecdc, { x: -4.6 + i * 0.7, y: 3.3, z: d / 2 - 0.5, rx: PI });
        for (let i = 0; i < 3; i++) f(cyl(0.4, 0.4, 0.9, 10), 0xe8d8a0, { x: 4.6 - i * 0.8, y: 3.2, z: d / 2 - 0.9 });
      },
    });
    // --- Zockerwatt (candy floss: midway, west side, facing east)
    stall(-36, -18, ry4dir.e, {
      w: 12, lean: 0.6, gable: true, sign: SIGN.zocker, col: 0xf4d8e8, stripes: [0xff7ac0, 0xffffff], bulb: 0xff7ac0,
      goods: (f, w, d) => {
        f(cyl(1.3, 0.9, 1.0, 16), 0xd8dade, { x: -2.2, y: 3.2, z: -0.4 }, M.metal);
        f(sph(1.1, 14, 10), 0xffb0e0, { x: -2.2, y: 3.9, z: -0.4, sy: 0.6 }, M.matte);
        for (let i = 0; i < 9; i++) { const x = 0.6 + (i % 5) * 1.0, z = d / 2 - 0.7 - Math.floor(i / 5) * 0.8; f(cyl(0.05, 0.05, 1.2, 4), 0xf4ecdc, { x, y: 3.3, z }); f(sph(0.62, 10, 8), i % 3 ? 0xff9ad6 : 0x9ad8ff, { x, y: 4.1, z }, M.matte); }
        for (let i = 0; i < 8; i++) f(rbox(0.9, 1.3, 0.5, 0.25), i % 2 ? 0xffb0e0 : 0xb0e0ff, { x: -w / 2 + 1 + i * 1.4, y: 5.6, z: d / 2 + 1.4 }, M.matte);
      },
    });
    // --- Tombola (midway west, facing east)
    stall(-36, 6, ry4dir.e, {
      w: 11, lean: 0.6, gable: true, sign: SIGN.tombola, col: 0x1a5a3a, stripes: [0x2fa04a, 0xfff17a], bulb: 0xfff17a,
      goods: (f, w, d) => {
        f(cyl(1.9, 1.9, 0.3, 24), 0xffd43a, { y: 4.2, z: -d / 2 + 0.7, rx: PI / 2 });
        for (let i = 0; i < 12; i++) { const g = new T.CircleGeometry(1.75, 2, (i / 12) * TAU, TAU / 12); f(g, [0xff3b30, 0x2f6fd2, 0xffffff][i % 3], { y: 4.2, z: -d / 2 + 0.87 }); }
        for (let i = 0; i < 10; i++) f(rbox(0.8, 0.8 + (i % 3) * 0.3, 0.7, 0.2), [0xff7a1a, 0x8a4fd8, 0x2fd0ff, 0xff3b6a][i % 4], { x: -w / 2 + 1.2 + i * 0.95, y: 2.9 + (i % 3) * 0.15, z: -d / 2 + 1.1 });
      },
    });
    // --- Mandelen (east side of the midway, facing west)
    stall(-12, 7, ry4dir.w, {
      w: 10, lean: 0.6, gable: true, sign: SIGN.mandel, col: 0x5a3a1a, stripes: [0xff9c3a, 0xf4ecdc], bulb: 0xff9c3a,
      goods: (f, w, d) => {
        f(K.lathe([[0, 0], [1.4, 0.1], [1.7, 0.9], [1.6, 1.3], [0, 1.2]], 18), 0xc87a3a, { x: -1.5, y: 2.7, z: -0.2 }, M.metal);
        for (let i = 0; i < 12; i++) f(box(0.5, 0.7, 0.3), 0xe8d8b0, { x: 0.8 + (i % 6) * 0.6, y: 3.05, z: d / 2 - 0.6 - Math.floor(i / 6) * 0.4 }, M.matte);
      },
    });
    // --- Inte Fëschen (hook-a-duck: north strip, facing south)
    const duckGeo = (() => {
      const p = [];
      p.push(prep(sph(0.7, 12, 8), 0xffd21a, mtx({ sx: 1.2, sy: 0.8 })));
      p.push(prep(sph(0.45, 10, 8), 0xffd21a, mtx({ x: 0.55, y: 0.65 })));
      p.push(prep(cone(0.18, 0.4, 6), 0xff7a1a, mtx({ x: 1.05, y: 0.6, rz: -PI / 2 })));
      p.push(prep(sph(0.08, 6, 4), 0x111111, mtx({ x: 0.85, y: 0.8, z: 0.22 })));
      p.push(prep(sph(0.08, 6, 4), 0x111111, mtx({ x: 0.85, y: 0.8, z: -0.22 })));
      p.push(prep(cone(0.25, 0.4, 6), 0xffd21a, mtx({ x: -0.85, y: 0.25, rz: 1.2 })));
      return BU.mergeGeometries(p, false);
    })();
    stall(8, -71, ry4dir.s, {
      w: 13, sign: SIGN.inten, col: 0x1a3a7a, stripes: [0x2f6fd2, 0xffffff], bulb: 0xffe14a,
      goods: (f, w, d) => {
        // the duck trough in front of the counter: an oval channel with water
        for (let i = 0; i < 12; i++) f(rbox(1.0, 0.5, 0.8, 0.2), [0xff3b6a, 0xffd43a, 0x2fd0ff, 0x5ae05a][i % 4], { x: -w / 2 + 1 + i * 1.0, y: 5.4, z: -d / 2 + 0.9 }, M.matte);
        f(box(w - 1, 0.9, 2.2), 0x2f6fd2, { y: 0.45, z: d / 2 + 1.4 });
        f(box(w - 1.6, 0.06, 1.7), [0.25, 0.55, 0.95], { y: 0.92, z: d / 2 + 1.4 }, M.glow);
        for (let i = 0; i < 8; i++) f(duckGeo, 0xffffff, { x: -w / 2 + 1.5 + i * 1.35, y: 0.95, z: d / 2 + 1.4 + (i % 2 ? 0.35 : -0.35), s: 0.55, ry: i % 2 ? PI : 0 });
        for (let i = 0; i < 4; i++) f(cyl(0.05, 0.05, 3.2, 4), 0xc9a06a, { x: -3 + i * 2, y: 3.5, z: d / 2 - 0.3, rx: 0.9 });
        f.box(0, d / 2 + 1.4, (w - 1) / 2, 1.2, 1.0);
      },
    });
    // --- Schéissbud (shooting gallery: north strip, facing south)
    stall(104, -71, ry4dir.s, {
      w: 14, sign: SIGN.scheiss, col: 0x2a1a1a, stripes: [0xe8352a, 0xffd34a], bulb: 0xffd34a,
      goods: (f, w, d) => {
        for (let row = 0; row < 3; row++) for (let i = 0; i < 9; i++) f(cyl(0.35, 0.35, 0.1, 12), row === 1 ? 0xffffff : 0xe8352a, { x: -4.4 + i * 1.1, y: 3.4 + row * 0.9, z: -d / 2 + 0.55, rx: PI / 2 });
        for (let i = 0; i < 6; i++) { const x = -5.5 + i * 2.2; f(sph(0.65, 10, 8), [0xc8865a, 0xf4ecdc, 0xff9ad6][i % 3], { x, y: 5.7, z: -0.5 }, M.matte); f(sph(0.42, 10, 8), [0xc8865a, 0xf4ecdc, 0xff9ad6][i % 3], { x, y: 6.4, z: -0.5 }, M.matte); }
        for (let i = 0; i < 3; i++) f(box(2.4, 0.14, 0.2), 0x3a2a1a, { x: -4 + i * 4, y: 2.8, z: d / 2 - 0.4, ry: 0.2 });
      },
    });
    // --- start straight row (north side, facing south): Waffelen, Hierzer, Mandelen-2 style
    stall(-46, 51, ry4dir.s, {
      w: 12, sign: SIGN.waffel, col: 0x6a3a12, stripes: [0xffb43a, 0xfff2c8], bulb: 0xffb43a,
      goods: (f, w, d) => { for (let i = 0; i < 8; i++) f(box(1.0, 0.14, 0.8), 0xd8a050, { x: -3 + i * 0.85, y: 2.8 + (i % 2) * 0.15, z: d / 2 - 0.6 }, M.matte); f(box(2.4, 0.9, 1.4), 0x3a3a3a, { x: 3.4, y: 3.1, z: -0.8 }, M.metal); },
    });
    stall(-23, 51, ry4dir.s, {
      w: 11, sign: SIGN.hierz, col: 0x7a1a2a, stripes: [0xff7a9a, 0xffffff], bulb: 0xff7a9a,
      goods: (f, w) => {
        for (let i = 0; i < 9; i++) {
          const hs = new T.Shape(); hs.moveTo(0, -0.6); hs.bezierCurveTo(-0.9, 0.0, -0.8, 0.7, 0, 0.35); hs.bezierCurveTo(0.8, 0.7, 0.9, 0.0, 0, -0.6);
          f(new T.ExtrudeGeometry(hs, { depth: 0.12, bevelEnabled: false }), [0xa0522a, 0xb8602a][i % 2], { x: -w / 2 + 1.2 + i * 1.08, y: 5.3, z: 4.4 });
        }
      },
    });
    // a second fritter stand by the gate (there is never just one at the Fouer), facing the start straight
    stall(-94, 51, ry4dir.s, {
      w: 13, sign: SIGN.gromp, col: 0x5a1a10, stripes: [0xffc12a, 0x5a1a10], bulb: 0xffc12a,
      goods: (f, w, d) => {
        f(box(4.4, 1.6, 2), 0xb8bcc4, { x: 3, y: 3.4, z: -0.6 }, M.metal);
        f(box(4.0, 0.1, 1.6), [1.0, 0.55, 0.15], { x: 3, y: 4.22, z: -0.6 }, M.glow);
        for (let i = 0; i < 20; i++) f(cyl(0.5, 0.5, 0.18, 8), goldMat, { x: -4.6 + (i % 5) * 0.9 + r.range(-0.1, 0.1), y: 2.85 + Math.floor(i / 10) * 0.18, z: d / 2 - 0.8 + Math.floor((i % 10) / 5) * 0.5 - 0.2, rx: r.range(-0.3, 0.3) });
        for (let i = 0; i < 4; i++) f(cone(0.45, 1.2, 8), 0xf4ecdc, { x: 0.2 + i * 0.75, y: 3.3, z: d / 2 - 0.5, rx: PI });
        f(cyl(0.6, 0.6, 1.1, 12), 0xd8dade, { x: -1.0, y: 3.2, z: -1.6 }, M.metal);
      },
    });
    // --- Fouerfësch (west infield, facing west towards the far west lane), tables and the wine bar
    stall(-104, -6, ry4dir.w, {
      w: 15, d: 7, lean: 0.6, gable: true, sign: SIGN.fesch, col: 0x123a6a, stripes: [0x2f6fd2, 0xffffff], bulb: 0x7fd8ff,
      goods: (f, w, d, h) => {
        // big fish on the roof
        const fs = new T.Shape(); fs.moveTo(-3, 0); fs.bezierCurveTo(-1.5, 1.6, 1.5, 1.6, 3, 0); fs.lineTo(4.2, 1.1); fs.lineTo(4.2, -1.1); fs.lineTo(3, 0); fs.bezierCurveTo(1.5, -1.6, -1.5, -1.6, -3, 0);
        f(new T.ExtrudeGeometry(fs, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 1 }), 0xb8c8d8, { y: h + 4.4, z: -0.8 }, M.metal);
        f(sph(0.3, 8, 6), 0x111111, { x: -1.9, y: h + 4.8, z: -0.4 });
        f(box(4.4, 1.4, 1.8), 0xb8bcc4, { x: -3.5, y: 3.3, z: -0.8 }, M.metal);
        f(box(4.0, 0.1, 1.4), [1.0, 0.6, 0.18], { x: -3.5, y: 4.05, z: -0.8 }, M.glow);
        for (let i = 0; i < 6; i++) { f(cyl(0.6, 0.6, 0.08, 14), 0xf4f2ec, { x: 0.5 + i * 1.0, y: 2.75, z: d / 2 - 0.6 }); for (let k = 0; k < 3; k++) f(box(0.7, 0.12, 0.2), 0xd8a050, { x: 0.5 + i * 1.0, y: 2.83, z: d / 2 - 0.8 + k * 0.2, ry: 0.4 }); }
      },
    });
    // food court tables with benches, wine glasses (west infield)
    const glassMat = K.glass(0xfff8e0, 0.35);
    const glasses = [];
    for (const [tx, tz] of [[-118.5, -9], [-118.5, 1], [-118.5, 11], [-91, -8]]) {
      const f = frame(tx, 0, tz, PI / 2);
      f(box(6, 0.3, 2.2), 0x8a6a4a, { y: 2.2 }, M.matte);
      for (const sx of [-1, 1]) { f(box(0.25, 2.1, 1.8), 0x5a4a3a, { x: sx * 2.4, y: 1.05 }, M.matte); f(box(6, 0.25, 0.9), 0x8a6a4a, { y: 1.3, z: sx * 1.9 }, M.matte); }
      f.box(0, 0, 3.1, 2.5, 2.4);
      AO(tx, tz, 3.4, 4, 0.4, f.ang());
      for (let i = 0; i < 3; i++) { const [gx, gz] = f.pt(-2 + i * 1.8, r.range(-0.5, 0.5)); glasses.push([gx, gz]); }
    }
    {
      const gg = K.lathe([[0.001, 0], [0.4, 0], [0.4, 0.06], [0.06, 0.12], [0.06, 0.75], [0.35, 0.95], [0.42, 1.5], [0.38, 1.6]], 12);
      K.instances(gg, glassMat, glasses.map(([x, z]) => ({ x, y: 2.35, z })), { cast: false });
      K.instances(cyl(0.33, 0.3, 0.32, 10), K.liquid(0xf4e08a, { transparent: true, opacity: 0.8 }), glasses.map(([x, z]) => ({ x, y: 2.35 + 1.13, z })), { cast: false });
    }
    // the wine bar ("Wäibar"): small counter and a lit umbrella
    {
      const f = frame(-92, 0, 4, ry4dir.w);
      f(box(7, 2.4, 2), 0xf4ecdc, { y: 1.2 }); f(box(7.4, 0.25, 2.4), 0x8a6a4a, { y: 2.5 }, M.matte);
      for (let i = 0; i < 6; i++) f(cyl(0.22, 0.22, 1.6, 8), 0x2a4a1a, { x: -2.5 + i * 0.9, y: 3.4, z: -0.4 }, M.paint);
      f(cyl(0.12, 0.12, 6, 6), 0xd8d8d8, { y: 3, z: 0 }, M.metal);
      const um = new T.ConeGeometry(4, 1.4, 8, 1, true); f(um, 0xd8282a, { y: 6.3 }, M.matte);
      f.box(0, 0, 3.7, 1.2, 2.7);
      AO(f.cx, f.cz, 4.5, 2.5, 0.4, f.ang());
      POOL(-95, 4, 8, 7, 0xffb468, 0.35);
    }

    // ============================================================ hazards
    // --- candy floss dropped on the midway (sticky)
    {
      const q = track.place(sAt(-24, -12), 3.2);
      const flossMat = K.phys({ color: 0xf08ac8, roughness: 1, sheen: 1, sheenColor: new T.Color(0xffd8f0), sheenRoughness: 0.8 });
      const sp = K.spill(q.x, q.z, 4.6, flossMat, { lump: 0.5, stretch: 1.5, angle: q.angle, y: 0.16, thick: 0.12 });
      K.surface('sticky', { poly: sp.poly });
      const tufts = [];
      const ca = Math.cos(q.angle), sa = Math.sin(q.angle);
      for (let i = 0; i < 44; i++) { const a = r() * TAU, dd = Math.sqrt(r()) * 3.6, u = Math.cos(a) * dd * 1.45, v = Math.sin(a) * dd; const s0 = r.range(0.5, 1.35) * (1 - dd / 6); tufts.push({ x: q.x + u * ca - v * sa, y: 0.2 + s0 * 0.25, z: q.z + u * sa + v * ca, sx: s0 * 1.3, sy: s0 * 0.55, sz: s0, ry: r() * TAU, color: r() < 0.22 ? 0xa8dcff : r() < 0.5 ? 0xffc0e6 : 0xff9ad6 }); }
      K.instances(new T.IcosahedronGeometry(1, 1), K.phys({ roughness: 1, color: 0xffffff, sheen: 1, sheenColor: new T.Color(0xffffff) }), tufts, { colors: true, cast: false });
      // the stick it came on
      put(cyl(0.08, 0.08, 3.2, 5), 0xf4ecdc, { x: q.x + 2.5, y: 0.3, z: q.z - 1, rz: PI / 2, ry: 0.4 });
    }
    // --- a toppled glass of Riesling on the far west lane (slick)
    {
      const s0 = sAt(-132, 10);
      const q = track.place(s0, -2.4);
      const wine = K.phys({ color: 0xb89a3a, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, opacity: 0.5, envMapIntensity: 0.45 });
      const sp = K.spill(q.x, q.z, 4.8, wine, { lump: 0.35, stretch: 1.8, angle: q.angle, y: 0.1, thick: 0.18 });
      K.surface('slick', { poly: sp.poly });
      // the glass lying on its side at the road edge
      const g = track.place(s0 - 2, -W / 2 - 1.8);
      const gl = K.lathe([[0.001, 0], [1.0, 0], [1.0, 0.12], [0.15, 0.3], [0.15, 1.9], [0.9, 2.4], [1.05, 3.8], [0.98, 4.0]], 20);
      const m = new T.Mesh(gl, K.glass(0xfff8e0, 0.3, { envMapIntensity: 0.5 })); m.position.set(g.x, 1.05, g.z); m.rotation.set(0, -g.angle + 0.5, PI / 2); K.group.add(m);
      K.circle(g.x, g.z, 1.2, 2);
      const drops = [sp.mesh];
      for (let i = 0; i < 4; i++) { const d = track.place(s0 + 8 + i * 3, r.range(-3, 3)); drops.push(K.spill(d.x, d.z, r.range(0.5, 1.0), wine, { y: 0.08, thick: 0.1, n: 16 }).mesh); }
      const dg = BU.mergeGeometries(drops.map((m) => { m.updateMatrix(); return m.geometry.clone().applyMatrix4(m.matrix); }), false);
      for (const m of drops) K.group.remove(m);
      const wm = new T.Mesh(dg, wine); wm.receiveShadow = true; K.group.add(wm);
    }
    // --- escaped plastic ducks on the north straight (pushable)
    {
      const dm = K.phys({ vertexColors: true, roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.2 });
      for (const [s, lat] of [[sAt(18, -54), -3], [sAt(12, -54), 2.5], [sAt(26, -54), 1], [sAt(-2, -54), -1.5], [sAt(34, -54), 4]]) {
        const p = track.place(s, lat);
        const m = new T.Mesh(duckGeo, dm); m.scale.setScalar(1.25); m.position.set(p.x, 0.75, p.z); m.rotation.y = r() * TAU; m.castShadow = true; K.group.add(m);
        K.physics.addDynamic({ x: p.x, z: p.z, r: 1.15, m: 0.45, h: 2.0, mesh: m, slide: true, friction: 14, baseY: 0.75, respawn: 4 });
      }
    }

    // ============================================================ the Schueberfouer gate beside the start line (faces the camera)
    {
      const p = track.at(40);
      const gx = p.x, gz = 50.5, hw = 9.4;
      const f = frame(gx, 0, gz, 0);
      for (const sx of [-1, 1]) {
        f(cyl(0.6, 0.7, 13.2, 10), 0xd8282a, { x: sx * hw, y: 6.6 });
        f(cyl(1.1, 1.2, 0.8, 10), 0x3a3d42, { x: sx * hw, y: 0.4 }, M.metal);
        f(sph(0.8, 12, 8), 0xffd43a, { x: sx * hw, y: 13.6 }, M.metal);
        f.circ(sx * hw, 0, 1.0, 13);
        AO(gx + sx * hw, gz, 1.6, 1.6, 0.45);
      }
      f(box(19.4, 3.0, 0.5), 0x2a0a12, { y: 11.6 });
      f(signGeo(18.8, 2.6, SIGN.fouer), 0xffffff, { y: 11.6, z: 0.27 }, M.sign);
      // an arch of bulbs over the sign
      for (let i = 0; i <= 26; i++) { const t = i / 26, x = gx - hw + t * 2 * hw, y = 13.4 + Math.sin(t * PI) * 2.6; BULB('chase', x, y, gz + 0.1, i % 2 ? 0xffe7a8 : 0xff4f6a, i / 9, 1.05); }
      for (let i = 0; i <= 22; i++) BULB('chase', gx - hw + (i / 22) * 2 * hw, 9.9, gz + 0.3, i % 2 ? 0xff4f6a : 0xffe7a8, i / 9 + 0.5, 0.9);
      // ticket windows either side
      for (const sx of [-1, 1]) { f(box(4, 4.4, 3.2), 0xf0e6cc, { x: sx * (hw + 3.2), y: 2.2, z: -0.6 }); f(box(4.6, 0.4, 3.8), 0xd8282a, { x: sx * (hw + 3.2), y: 4.6, z: -0.6 }); f(box(2.8, 1.4, 0.08), [1.1, 0.9, 0.55], { x: sx * (hw + 3.2), y: 2.9, z: 1.02 }, M.glow); f.box(sx * (hw + 3.2), -0.6, 2.2, 1.8, 5); }
      POOL(gx, 60, 16, 9, 0xffc890, 0.45);
    }

    // ============================================================ lamp masts with warm light pools
    const mast = (x, z, h = 16, poolOn = null) => {
      put(cyl(0.3, 0.42, h, 8), 0x3a3d42, { x, y: h / 2, z }, M.metal);
      put(cyl(0.9, 1.0, 0.5, 10), 0x2a2d32, { x, y: 0.25, z }, M.metal);
      put(box(5, 0.3, 0.3), 0x3a3d42, { x, y: h, z }, M.metal);
      for (const sx of [-1, 1]) { put(box(1.3, 0.8, 1.0), 0x2a2d32, { x: x + sx * 2, y: h - 0.3, z }, M.metal); put(box(1.1, 0.06, 0.8), [1.6, 1.4, 1.1], { x: x + sx * 2, y: h - 0.72, z }, M.glow); BULB('steady', x + sx * 2, h - 0.85, z, 0xfff0d0, 0, 0.01, 2.2); }
      K.circle(x, z, 0.6, h);
      AO(x, z, 1.2, 1.2, 0.45);
      const [qx, qz] = poolOn ?? [x, z];
      POOL(qx, qz, 16, 16, 0xffd8a0, 0.5);
    };
    for (const [x, z, toward] of [
      [30, -64.5, [30, -55]], [88, -64.5, [88, -55]], [-9, -65, [-14, -52]], [151, 14, [139, 14]], [151, -30, [139, -30]],
      [-92, 79, [-92, 68]], [-8, 79, [-8, 68]], [92, 79, [92, 68]], [-13, -29, [-24, -29]], [-46, 17, [-34, 24]],
      [-143, -2, [-132, -2]], [-90, 2, [-78, 2]], [-104, -46, [-104, -34]], [-143, 40, [-132, 40]], [70, 52, [70, 66]],
    ]) mast(x, z, 15 + r.range(-1, 1.5), toward);

    // ============================================================ crowd barriers on the tight bends (and to block cheap cuts)
    const barrierList = [];
    const barrierRun = (s0, s1, side, extra = 1.2) => {
      const n = Math.max(1, Math.round((s1 - s0) / 3.6));
      let prev = null;
      for (let i = 0; i <= n; i++) {
        const s = s0 + ((s1 - s0) * i) / n, p = track.place(s, side * (W / 2 + extra));
        if (prev) {
          const mx = (prev.x + p.x) / 2, mz = (prev.z + p.z) / 2, len = Math.hypot(p.x - prev.x, p.z - prev.z), ang = Math.atan2(p.z - prev.z, p.x - prev.x);
          barrierList.push({ x: mx, y: 0, z: mz, ry: -ang, sx: len / 3.4 });
          K.capsule(prev.x, prev.z, p.x, p.z, 0.4, 1.7);
        }
        prev = p;
      }
    };
    const curvRuns = (minCurv, side) => { // find bends tighter than 1/minCurv and put barriers on `side` (+1 outside, -1 inside)
      const out = [];
      let s0 = null;
      for (let s = 0; s <= L; s += 1) {
        const p = track.at(s), c = Math.abs(p.curv) > 1 / minCurv;
        if (c && s0 === null) s0 = s;
        if ((!c || s >= L) && s0 !== null) { const pm = track.at((s0 + s) / 2); out.push([s0 - 4, s + 4, Math.sign(pm.curv)]); s0 = null; }
      }
      return out;
    };
    const inRink = (s) => s > sR0 - 6 && s < sR1 + 6;
    const inCoast = (s) => s > sC0 - 6 && s < sC1 + 26;
    // wings from the rink's end posts along the lane edges: nobody slips round the outside of the rink fence
    for (const side of [-1, 1]) { barrierRun(sR0 - 12, sR0 + 3.4, side, 1.7); barrierRun(sR1 - 3.4, sR1 + 12, side, 1.7); }
    const bends = curvRuns(19, 1);
    for (const [s0, s1, sg] of bends) {
      if (inRink(s0) || inCoast(s0)) continue;
      // outside of the bend only: the insides stay open gravel (slow, so cutting them gains nothing), which leaves
      // no pocket behind a fence for a car to get trapped in
      barrierRun(s0, s1, sg > 0 ? -1 : 1, 1.3);
    }
    {
      const bp = [];
      bp.push(prep(box(3.4, 0.1, 0.1), 0xffffff, mtx({ y: 1.5 })));
      bp.push(prep(box(3.4, 0.1, 0.1), 0xffffff, mtx({ y: 0.35 })));
      for (const sx of [-1.65, 1.65]) { bp.push(prep(box(0.1, 1.55, 0.1), 0xffffff, mtx({ x: sx, y: 0.78 }))); bp.push(prep(box(0.12, 0.08, 1.2), 0xffffff, mtx({ x: sx, y: 0.04 }))); }
      for (let i = 1; i < 10; i++) bp.push(prep(box(0.05, 1.1, 0.05), 0xffffff, mtx({ x: -1.65 + i * 0.33, y: 0.93 })));
      bp.push(prep(box(3.2, 0.45, 0.04), 0xd8282a, mtx({ y: 1.15, z: 0.06 })));
      const bg = BU.mergeGeometries(bp, false);
      const im = K.instances(bg, K.std({ vertexColors: true, metalness: 0.7, roughness: 0.38, color: 0xd0d4d8 }), barrierList, { cast: true });
      im.receiveShadow = true;
    }

    // ============================================================ festoons of coloured bulbs along the lanes
    {
      const cable = [];
      const postGeo = BU.mergeGeometries([prep(cyl(0.16, 0.2, 4.6, 6), 0x1e3a2a, mtx({ y: 2.3 })), prep(sph(0.24, 8, 6), 0xf4ecdc, mtx({ y: 4.7 }))], false);
      const BC = [0xff4a4a, 0xffd04a, 0x4ad86a, 0x4aa8ff, 0xffffff, 0xff8a2a];
      let bk = 0;
      for (const side of [-1, 1]) {
        let prev = null;
        for (let s = 0; s < L; s += 9) {
          const p = track.place(s, side * (W / 2 + 2.6));
          const bad = inRink(s) || (s > sC0 - 8 && s < sC1 + 2) || colliderHit(p.x, p.z, 1.4) || dRoad(p.x, p.z) < 2.0 || Math.hypot(p.x - OCTO.x, p.z - OCTO.z) < A.octoReach + 1.2;
          if (bad) { prev = null; continue; }
          put(postGeo, 0xffffff, { x: p.x, z: p.z });
          K.circle(p.x, p.z, 0.35, 4.6);
          if (prev && Math.hypot(p.x - prev.x, p.z - prev.z) < 12) {
            const n = 8;
            let last = null;
            for (let i = 0; i <= n; i++) {
              const t = i / n, x = lerp(prev.x, p.x, t), z = lerp(prev.z, p.z, t), y = 4.55 - Math.sin(t * PI) * 1.05;
              if (last) cable.push(last[0], last[1], last[2], x, y, z);
              last = [x, y, z];
              if (i > 0 && i < n) BULB('twinkle', x, y - 0.18, z, BC[bk++ % BC.length], bk * 0.618, 0.85, 0.75);
            }
          }
          prev = p;
        }
      }
      // strings across the midway, high up between the stalls
      const across = cable;
      for (const z of [-26, -6, 14]) {
        const ax = -38, bx = -10, n = 16;
        for (let i = 0; i <= n; i++) {
          const t = i / n, x = lerp(ax, bx, t), y = 11.5 - Math.sin(t * PI) * 1.6;
          if (i) across.push(lerp(ax, bx, (i - 1) / n), 11.5 - Math.sin(((i - 1) / n) * PI) * 1.6, z, x, y, z);
          if (i > 0 && i < n) BULB('twinkle', x, y - 0.2, z, BC[i % BC.length], i * 0.37 + z, 1, 0.9);
        }
        for (const x of [ax, bx]) { put(cyl(0.18, 0.2, 11.6, 6), 0x1e3a2a, { x, y: 5.8, z }); K.circle(x, z, 0.4, 11); }
      }
      const cg = new T.BufferGeometry(); cg.setAttribute('position', new T.Float32BufferAttribute(cable, 3));
      K.group.add(new T.LineSegments(cg, new T.LineBasicMaterial({ color: 0x0c0c0c })));
    }

    // ============================================================ the beer tent (north edge), trees, a Hämmelsmarsch flock
    {
      // big white tent with a striped roof and open, glowing sides
      const f = frame(56, 0, -80, 0);
      const TW = 34, TD = 20, TH = 7;
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-0.5, -1], [0.5, -1], [-0.5, 1], [0.5, 1]]) f(cyl(0.25, 0.25, TH, 6), 0xe8e4dc, { x: x * TW / 2, y: TH / 2, z: z * TD / 2 }, M.metal);
      const nt = 12;
      for (let i = 0; i < nt; i++) {
        const x = -TW / 2 + (i + 0.5) * (TW / nt), c = i % 2 ? 0xf4f0e6 : 0x2f6fd2;
        const sl = Math.hypot(TD / 2, 5), ang = Math.atan2(5, TD / 2);
        f(box(TW / nt + 0.02, 0.2, sl + 0.3), c, { x, y: TH + 2.5, z: TD / 4, rx: ang }, M.matte);
        f(box(TW / nt + 0.02, 0.2, sl + 0.3), c, { x, y: TH + 2.5, z: -TD / 4, rx: -ang }, M.matte);
      }
      for (const sx of [-1, 1]) { const gs = new T.Shape(); gs.moveTo(-TD / 2, TH); gs.lineTo(TD / 2, TH); gs.lineTo(0, TH + 5); gs.closePath(); f(new T.ExtrudeGeometry(gs, { depth: 0.15, bevelEnabled: false }), 0xf4f0e6, { x: sx * (TW / 2 + 0.08), ry: -sx * PI / 2 }, M.matte); }
      for (const sz of [-1, 1]) for (let i = 0; i < 17; i++) f(new T.CircleGeometry(1.0, 8, PI, PI), i % 2 ? 0x2f6fd2 : 0xf4f0e6, { x: -TW / 2 + 1 + i * 2, y: TH, z: sz * (TD / 2 + 0.05), ry: sz > 0 ? 0 : PI }, M.matte);
      f(box(TW - 1, 0.2, TD - 1), 0x6a4a32, { y: 0.1 }, M.matte);
      for (let row = 0; row < 3; row++) { f(box(TW - 8, 0.3, 1.8), 0x9a7a5a, { y: 2.2, z: -6 + row * 6 }, M.matte); for (const sz of [-1.6, 1.6]) f(box(TW - 8, 0.25, 0.8), 0x7a5a3a, { y: 1.3, z: -6 + row * 6 + sz }, M.matte); }
      f(box(TW - 2, 0.12, TD - 2), [0.55, 0.42, 0.26], { y: TH - 0.2 }, M.glow);
      f.box(0, 0, TW / 2 + 0.4, TD / 2 + 0.4, TH + 5);
      AO(f.cx, f.cz, TW / 2 + 2, TD / 2 + 2, 0.45);
      POOL(f.cx, f.cz, TW / 2 + 4, TD / 2 + 5, 0xffc078, 0.4);
      for (let i = 0; i <= 34; i++) for (const sz of [-1, 1]) BULB('twinkle', f.cx - TW / 2 + i, TH - 0.3, f.cz + sz * (TD / 2 + 0.6), [0xffe0a0, 0xff6a4a, 0x6ad8ff][i % 3], i * 0.3, 0.85, 0.7);
    }
    {
      // model trees (chestnuts) where they hide no lanes
      const trees = [];
      for (const [x, z, s] of [[18, -14, 1.1], [30, 18, 0.95], [86, 22, 1.05], [92, -32, 0.95], [-150, -88, 1.1], [-110, -90, 1.0], [-80, -92, 0.9], [-2, -92, 1.0], [118, -90, 1.05], [146, -92, 0.95], [-150, 88, 0.9], [150, 88, 1.0], [8, 24, 0.9], [-58, -78, 0.9]]) {
        if (dRoad(x, z) < 6 * s + 2 || colliderHit(x, z, 4)) continue;
        trees.push([x, z, s]);
        put(cyl(0.7 * s, 1.0 * s, 7 * s, 8), 0x4a3424, { x, y: 3.5 * s, z }, M.matte);
        for (const [ox, oy, oz, rr] of [[0, 10, 0, 4.6], [2.6, 8.4, 1.2, 3.4], [-2.4, 8.8, -1.4, 3.6], [0.6, 12.6, -0.8, 3.2], [-1.2, 7.6, 2.4, 3.0]]) put(new T.IcosahedronGeometry(rr * s, 1), [0x1f3a22, 0x264a2a, 0x2c5230][(ox > 0) + (oz > 0)], { x: x + ox * s, y: oy * s, z: z + oz * s }, M.matte);
        K.circle(x, z, 1.2 * s, 8);
        AO(x, z, 5.5 * s, 5.5 * s, 0.4);
      }
    }
    {
      // the Hämmelsmarsch: a few sheep and two musicians in the south strip
      const sheep = (x, z, ry) => {
        const f = frame(x, 0, z, ry);
        f(rbox(2.6, 1.6, 1.6, 0.7, 3), 0xf0ebe0, { y: 1.9 }, M.matte);
        f(rbox(0.9, 0.9, 0.8, 0.3), 0x2a2420, { x: 1.55, y: 2.4 }, M.matte);
        for (const [lx, lz] of [[0.8, 0.5], [0.8, -0.5], [-0.8, 0.5], [-0.8, -0.5]]) f(cyl(0.14, 0.12, 1.2, 5), 0x2a2420, { x: lx, y: 0.6, z: lz });
        AO(x, z, 1.8, 1.4, 0.35, -ry);
      };
      for (const [x, z, ry] of [[-44, 86, 0.1], [-48, 89, -0.2], [-41, 90, 0.3], [-52, 85, 0.05], [-47, 93, 0.2]]) { sheep(x, z, ry); K.circle(x, z, 1.4, 3); }
      for (const [x, z, c] of [[-36, 87, 0x1a3a7a], [-36, 91, 0xd8282a]]) {
        put(cyl(0.5, 0.6, 2.2, 8), c, { x, y: 2.6, z }); put(cyl(0.38, 0.32, 1.5, 6), 0x1a1a1a, { x, y: 0.75, z }); put(sph(0.42, 10, 8), 0xf0c8a0, { x, y: 4.1, z }); put(cyl(0.45, 0.45, 0.3, 10), c, { x, y: 4.5, z });
        put(new T.TorusGeometry(0.6, 0.15, 6, 12), 0xd8b25a, { x: x + 0.6, y: 2.9, z, ry: PI / 2 }, M.metal);
        K.circle(x, z, 0.8, 4);
      }
    }

    // ============================================================ showmen's caravans and back-of-house (outside the lanes)
    const caravan = (cx, cz, ry, col = 0xf0ebe0) => {
      const f = frame(cx, 0, cz, ry);
      f(rbox(13, 5.4, 5, 0.6), col, { y: 3.4 });
      f(box(12.2, 0.2, 4.2), 0x8a8a84, { y: 6.12 }, M.matte);
      for (const lx of [-3.5, 2.5]) f(box(1.4, 0.5, 1.2), 0x6a6a66, { x: lx, y: 6.4 }, M.metal);
      f(box(13.1, 0.6, 5.1), 0x8a8e96, { y: 1.0 }, M.metal);
      for (const sx of [-3.5, 3.5]) f(cyl(0.9, 0.9, 0.6, 12), 0x1a1a1a, { x: sx, y: 0.9, z: 2.6, rx: PI / 2 });
      for (const lx of [-4.5, -1.5, 2.5]) f(box(1.8, 1.2, 0.08), [1.1, 0.85, 0.5], { x: lx, y: 4.0, z: 2.53 }, M.glow);
      f(box(13.2, 0.35, 5.2), 0xd8282a, { y: 2.2 });
      f.box(0, 0, 6.6, 2.7, 6);
      AO(cx, cz, 8, 4, 0.45, f.ang());
    };
    caravan(-62, 90, 0); caravan(-34, 91, 0.05, 0xe8e0c8); caravan(92, 90, -0.04, 0xf0ebe0);
    caravan(-30, -82, PI + 0.1, 0xe8e4d8); caravan(-60, -80, PI - 0.05); caravan(-126, -78, PI);
    caravan(150, -78, PI / 2 + 0.02, 0xe0dccc);
    // generator truck with cables
    {
      const f = frame(-94, 0, -72, PI);
      f(rbox(9, 4.6, 4.2, 0.4), 0x2f6f3a, { y: 3.1 }); f(rbox(3.4, 4.0, 4.2, 0.5), 0xe8e4d8, { x: 5.8, y: 2.8 });
      for (const sx of [-3, 3, 6]) f(cyl(0.9, 0.9, 4.4, 12), 0x1a1a1a, { x: sx, y: 0.9, rx: PI / 2 });
      f.box(1, 0, 6.4, 2.3, 5);
      AO(f.cx, f.cz, 8, 3.5, 0.45);
    }
    // ticket booths / blockers in the tight pocket bend and the midway entry
    const booth = (x, z, col) => {
      put(box(3.2, 4.2, 3.2), col, { x, y: 2.1, z });
      put(cone(2.7, 1.6, 4), 0xf4ecdc, { x, y: 5.0, z, ry: PI / 4 });
      put(sph(0.35, 8, 6), 0xffd43a, { x, y: 6.0, z });
      put(box(2.2, 1.2, 0.08), [1.1, 0.9, 0.55], { x, y: 2.8, z: z + 1.62 }, M.glow);
      K.box(x, z, 1.7, 1.7, 0, 5);
      AO(x, z, 2.6, 2.6, 0.45);
      POOL(x, z + 3, 4, 3, 0xffc070, 0.3);
    };
    booth(-66, 23, 0x2fa04a);
    booth(-2, -38, 0xd8282a);
    booth(-94, -19, 0x8a4fd8);
    booth(-116, -19, 0x2f6fd2);
    booth(-110, 48, 0xff7a1a);
    booth(125, -42, 0xffc12a);

    // ============================================================ people (model figures) in little groups
    {
      const ppl = [];
      const spots = [
        [-12, -24, 4], [-12, 0, 3], [-38, -28, 3], [-44, 2, 3], [-58, 44, 4], [-34, 44, 3], [-82, 44, 3], [8, -63, 4], [104, -63, 4],
        [56, -66, 4], [56, -12, 4], [86, -22, 3], [30, -30, 3], [94, 12, 4], [124, 9, 3], [-104, -16, 3], [-114, 9, 4], [-98, -45, 3], [-62, 10, 4], [-46, -22, 3], [-55, 4, 3], [26, 44, 4], [8, 44, 3], [48, 92, 3],
        [-10, 82, 4], [-60, 82, 3], [-110, 82, 3], [116, -20, 3], [128, 2, 2], [70, 46, 3], [-90, 22, 3], [-120, 22, 3],
      ];
      const skin = [0xf0c8a0, 0xd8a078, 0x9a6a48, 0x6a4a32, 0xf4d8b8];
      const cloth = [0x2f4a7a, 0x8a2a2a, 0x2a6a4a, 0xd8b85a, 0x5a3a7a, 0x1a1a1a, 0xe8e4d8, 0xd86a2a, 0x3a7ab8];
      for (const [cx, cz, n] of spots) {
        for (let i = 0; i < n; i++) {
          const x = cx + r.range(-2.4, 2.4), z = cz + r.range(-1.8, 1.8);
          if (dRoad(x, z) < 3 || colliderHit(x, z, 0.8)) continue;
          ppl.push({ x, z, h: r.range(0.88, 1.08), c: r.pick(cloth), k: r.pick(skin), ry: r() * TAU });
          K.circle(x, z, 0.75, 4);
        }
      }
      K.instances(prep(cyl(0.48, 0.62, 2.2, 8), 0xffffff, mtx({ y: 2.75 })), M.paint, ppl.map((p) => ({ x: p.x, y: 0, z: p.z, s: p.h, color: p.c })), { colors: true });
      const lh = BU.mergeGeometries([prep(cyl(0.42, 0.34, 1.7, 6), [0.06, 0.06, 0.08], mtx({ y: 0.85 })), prep(sph(0.42, 10, 8), 0xffffff, mtx({ y: 4.2 }))], false);
      K.instances(lh, M.paint, ppl.map((p) => ({ x: p.x, y: 0, z: p.z, s: p.h, color: p.k })), { colors: true });
      for (const p of ppl) AO(p.x, p.z, 0.9, 0.9, 0.35);
    }

    // ============================================================ fine scatter: confetti, cups, paper cones, popcorn, tickets
    {
      const conf = [], cups = [], cones = [], corn = [];
      const inRinkXZ = (x, z) => ((x - RINK.x) / (RINK.a + 1.5)) ** 2 + ((z - RINK.z) / (RINK.b + 1.5)) ** 2 < 1; // keep the arena floor clear
      const CC = [0xff3b6a, 0xffd43a, 0x2fd0ff, 0x5ae05a, 0xffffff, 0xff8a2a, 0xc48aff];
      let tries = 0;
      while (conf.length < (lowQ ? 420 : 800) && tries++ < 8000) {
        const x = r.range(BOUNDS.minX + 3, BOUNDS.maxX - 3), z = r.range(BOUNDS.minZ + 3, BOUNDS.maxZ - 3);
        if (dRoad(x, z) > 18) continue;
        conf.push({ x, y: 0.06 + r() * 0.02, z, ry: r() * TAU, s: r.range(0.16, 0.26), color: r.pick(CC) });
      }
      tries = 0;
      while (cups.length < 70 && tries++ < 4000) {
        const x = r.range(-150, 150), z = r.range(-95, 95);
        const dd = dRoad(x, z);
        if (dd < 1.5 || dd > 14 || inRinkXZ(x, z) || colliderHit(x, z, 0.8)) continue;
        if (r() < 0.5) cups.push({ x, y: 0.55, z, rz: PI / 2, ry: r() * TAU, color: r.pick([0xf4ecdc, 0xd8282a, 0x2f6fd2]) });
        else cones.push({ x, y: 0.35, z, rz: PI / 2, ry: r() * TAU, color: r.pick([0xf4ecdc, 0xe8d8b0]) });
      }
      for (const [cx, cz] of [[-12, -14], [-36, -18], [-56, 51], [-110, -9], [8, -66]]) for (let i = 0; i < 30; i++) corn.push({ x: cx + r.range(-6, 6), y: 0.15, z: cz + r.range(-5, 5), s: r.range(0.18, 0.28), rx: r() * 6, ry: r() * 6, color: r.pick([0xfff2c8, 0xf4e0a0, 0xe8c070]) });
      K.instances(new T.PlaneGeometry(1, 1).rotateX(-PI / 2), K.std({ roughness: 0.7, side: T.DoubleSide }), conf, { colors: true, cast: false });
      for (const c of cups) put(cyl(0.45, 0.35, 1.1, 8), c.color, c, M.matte);
      for (const c of cones) put(cone(0.4, 1.1, 8), c.color, c, M.matte);
      K.instances(new T.IcosahedronGeometry(1, 0), K.std({ roughness: 0.9 }), corn.filter((c) => dRoad(c.x, c.z) > 0.5), { colors: true, cast: false });
    }

    // ============================================================ flush: baked bins, contacts, pools, bulbs and halos
    for (const { mat, cast, parts } of bins.values()) {
      const g = BU.mergeGeometries(parts, false); g.computeBoundingSphere();
      const m = new T.Mesh(g, mat); m.castShadow = cast && mat !== M.basic; m.receiveShadow = true; K.group.add(m);
    }
    bins.clear();
    {
      const g = new T.PlaneGeometry(1, 1); g.rotateX(-PI / 2);
      const im = K.instances(g, contactMat, contacts, { cast: false, receive: false }); im.renderOrder = 1;
    }
    const glowTex = tex(canvas(128, 128, (g) => { const q = g.createRadialGradient(64, 64, 0, 64, 64, 64); q.addColorStop(0, 'rgba(255,255,255,1)'); q.addColorStop(0.3, 'rgba(255,255,255,0.42)'); q.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = q; g.fillRect(0, 0, 128, 128); }), [1, 1], false);
    {
      const gGeo = new T.PlaneGeometry(1, 1); gGeo.rotateX(-PI / 2);
      const im = K.instances(gGeo, new T.MeshBasicMaterial({ map: glowTex, transparent: true, blending: T.AdditiveBlending, depthWrite: false }), pools, { cast: false, receive: false, colors: true });
      im.renderOrder = 2;
    }
    // bulb materials with a chase/twinkle pattern computed on the GPU from a per-bulb phase and mode
    const PATTERN = `
      float k = 1.0;
      if (vPh.y > 2.5) { float q = fract(vPh.x - uT * 0.55); k = 0.32 + 0.68 * smoothstep(0.0, 0.1, q) * (1.0 - smoothstep(0.5, 0.62, q)); }
      else if (vPh.y > 1.5) { float q = fract(vPh.x - uT * 0.85); k = 0.3 + 0.7 * smoothstep(0.0, 0.08, q) * (1.0 - smoothstep(0.42, 0.52, q)); }
      else if (vPh.y > 0.5) { k = 0.78 + 0.22 * sin(uT * 2.1 + vPh.x * 6.283); }
      diffuseColor.rgb *= k;`;
    const bulbMat = (base, points = false) => {
      base.onBeforeCompile = (sh) => {
        sh.uniforms.uT = A.uT;
        let vs = 'attribute vec2 aPh;\nvarying vec2 vPh;\n' + (points ? 'attribute float aSz;\n' : '') + sh.vertexShader;
        vs = vs.replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvPh = aPh;');
        if (points) vs = vs.replace('gl_PointSize = size;', 'gl_PointSize = size * aSz;');
        sh.vertexShader = vs;
        sh.fragmentShader = 'uniform float uT;\nvarying vec2 vPh;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n' + PATTERN);
      };
      base.customProgramCacheKey = () => 'fouer-bulb' + (points ? '-p' : '-m');
      return base;
    };
    const bulbGeo = new T.IcosahedronGeometry(0.3, 0);
    const bulbMesh = bulbMat(new T.MeshBasicMaterial({ color: 0xffffff }));
    const haloMat = bulbMat(new T.PointsMaterial({ size: 6, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending, sizeAttenuation: true }), true);
    const makeBulbs = (list, parent, mode = null, haloK = 1) => {
      if (!list || !list.length) return;
      const g = bulbGeo.clone();
      const ph = new Float32Array(list.length * 2);
      list.forEach((b, i) => { ph[i * 2] = b.ph; ph[i * 2 + 1] = mode ?? b.mode; });
      g.setAttribute('aPh', new T.InstancedBufferAttribute(ph, 2));
      const im = new T.InstancedMesh(g, bulbMesh, list.length);
      const m4 = new T.Matrix4(), col = new T.Color();
      list.forEach((b, i) => { m4.makeScale(b.s || 1, b.s || 1, b.s || 1); m4.setPosition(b.x, b.y, b.z); im.setMatrixAt(i, m4); im.setColorAt(i, col.set(b.c).multiplyScalar(1.7)); });
      im.castShadow = false; im.receiveShadow = false;
      im.computeBoundingSphere();
      parent.add(im);
      const hl = list.filter((b) => b.halo > 0);
      if (!hl.length) return;
      const pos = new Float32Array(hl.length * 3), cc = new Float32Array(hl.length * 3), hp = new Float32Array(hl.length * 2), hs = new Float32Array(hl.length);
      hl.forEach((b, i) => { pos.set([b.x, b.y, b.z], i * 3); col.set(b.c).multiplyScalar(0.55); cc.set([col.r, col.g, col.b], i * 3); hp[i * 2] = b.ph; hp[i * 2 + 1] = mode ?? b.mode; hs[i] = b.halo * haloK; });
      const pg = new T.BufferGeometry();
      pg.setAttribute('position', new T.BufferAttribute(pos, 3)); pg.setAttribute('color', new T.BufferAttribute(cc, 3));
      pg.setAttribute('aPh', new T.BufferAttribute(hp, 2)); pg.setAttribute('aSz', new T.BufferAttribute(hs, 1));
      const pts = new T.Points(pg, haloMat); pts.renderOrder = 4;
      parent.add(pts);
    };
    makeBulbs(bulbsStatic, K.group);
    makeBulbs(A.wheelBulbs, A.wheel.rot, MODE.wheel, HALO.wheel);
    makeBulbs(A.caroBulbs, A.caro.rot, MODE.chase);
    makeBulbs(A.swingBulbs, A.swing.rot, MODE.chase);
    A.L = L;
  },

  // fixed rate: a car that ends up off the lane behind a prop and makes no progress gets put back on the road
  tick(dt, time, game) {
    if (!A || !['race', 'h2h', 'tt'].includes(game.mode) || (game.state !== 'race' && game.state !== 'attract')) return;
    const tr = game.track, S = A.stuck || (A.stuck = new WeakMap());
    for (const e of game.cars) {
      const c = e.car;
      if (e.out || c.state !== 'drive') { S.delete(e); continue; }
      let q = S.get(e);
      if (!q) S.set(e, (q = { p: e.progress, t: 0 }));
      if (Math.abs(e.lateral) < tr.w[e.trackI] / 2 + 1.5 || e.progress > q.p + 6) { q.p = e.progress; q.t = 0; continue; }
      q.t += dt;
      if (q.t > (e.human ? 3.5 : 2.5)) { q.t = 0; game.respawn(e); q.p = e.progress; }
    }
  },

  animate(time) {
    if (!A) return;
    A.uT.value = time;
    // Ferris wheel and its upright gondolas
    if (A.wheel) {
      const a = (time / WHEEL.P) * TAU;
      A.wheel.rot.rotation.z = a;
      const C = A.cabs, m4 = A.m4;
      for (let i = 0; i < C.n; i++) {
        const t = a + (i / C.n) * TAU, sw = Math.sin(time * 1.3 + i) * 0.05;
        m4.makeRotationZ(sw);
        m4.setPosition(WHEEL.x + Math.cos(t) * C.R, WHEEL.hub + Math.sin(t) * C.R, WHEEL.z);
        C.cabs.setMatrixAt(i, m4); C.wins.setMatrixAt(i, m4);
      }
      C.cabs.instanceMatrix.needsUpdate = true; C.wins.instanceMatrix.needsUpdate = true;
    }
    // carousel turning, horses bobbing
    if (A.caro) {
      const a = time * CARO.w;
      A.caro.rot.rotation.y = a;
      const m4 = A.m4;
      A.caro.horses.forEach((h, i) => {
        const y = 4.0 + Math.sin(time * 2.4 + h.ph) * 0.7;
        m4.makeRotationY(PI / 2 - h.t);
        m4.setPosition(h.x, y, h.z);
        A.caro.him.setMatrixAt(i, m4);
      });
      A.caro.him.instanceMatrix.needsUpdate = true;
    }
    // octopus arms and tubs
    if (A.octo) {
      const O = A.octo, m4 = A.m4, m5 = A.m5;
      A.octoHead.rotation.y = OCTO.w * time;
      for (let i = 0; i < OCTO.n; i++) {
        const q = octoArm(i, time);
        // arm: from the hub, pitched; local +x outward
        m4.makeRotationY(-q.az); m5.makeRotationZ(q.p); m4.multiply(m5); m4.setPosition(OCTO.x + Math.cos(q.az) * 1.0, OCTO.hub, OCTO.z + Math.sin(q.az) * 1.0);
        O.arms.setMatrixAt(i, m4); O.strip2.setMatrixAt(i, m4);
        const tx = OCTO.x + Math.cos(q.az) * q.rad, tz = OCTO.z + Math.sin(q.az) * q.rad;
        m4.makeRotationY(time * 2.2 + i);
        m4.setPosition(tx, q.bottom, tz);
        O.tubs.setMatrixAt(i, m4); O.ring.setMatrixAt(i, m4);
        // the rim lights blink red while a tub swoops low over the bend (telegraph)
        const blink = q.low > 0.35 && Math.sin(time * 18) > -0.2;
        O.ring.setColorAt(i, blink ? O.warn : O.cols[i]);
        const k = clamp(1 - (q.bottom - 1) / 8, 0.15, 1), sc = 5 * (2 - k);
        m4.makeScale(sc, 0.45 * k, sc); m4.setPosition(tx, 0.08, tz);
        O.shadows.setMatrixAt(i, m4);
      }
      O.shadows.instanceMatrix.needsUpdate = true; O.strip2.instanceMatrix.needsUpdate = true;
      if (O.ring.instanceColor) O.ring.instanceColor.needsUpdate = true;
      O.arms.instanceMatrix.needsUpdate = true; O.tubs.instanceMatrix.needsUpdate = true; O.ring.instanceMatrix.needsUpdate = true;
    }
    // wild mouse: three cars, evenly spaced in time along the precomputed timing table
    if (A.mouse) {
      const Mo = A.mouse, m4 = A.m4, n = MOUSE.n;
      for (let k = 0; k < n; k++) {
        const tt = (((time + (k * Mo.T) / n) % Mo.T) + Mo.T) % Mo.T;
        let lo = 0, hi = Mo.N;
        while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (Mo.tc[mid] <= tt) lo = mid; else hi = mid; }
        const fr = clamp((tt - Mo.tc[lo]) / (Mo.tc[lo + 1] - Mo.tc[lo] || 1), 0, 1);
        const a = Mo.P[lo], b = Mo.P[lo + 1];
        Mo.p.lerpVectors(a, b, fr);
        Mo.f.subVectors(b, a).normalize();
        Mo.s.crossVectors(Mo.f, Mo.Y).normalize();
        Mo.u.crossVectors(Mo.s, Mo.f);
        m4.makeBasis(Mo.f, Mo.u, Mo.s); m4.setPosition(Mo.p);
        Mo.bodies.setMatrixAt(k, m4); Mo.dets.setMatrixAt(k, m4);
      }
      Mo.bodies.instanceMatrix.needsUpdate = true; Mo.dets.instanceMatrix.needsUpdate = true;
    }
    // chair-o-plane: chairs swing out as it turns
    if (A.swing) {
      const S = A.swing, a = time * SWING.w;
      S.rot.rotation.y = a;
      const m4 = A.m4, m5 = A.m5;
      for (let i = 0; i < S.NC; i++) {
        const t = -a + (i / S.NC) * TAU;
        const sw = SWING.tilt + Math.sin(time * 0.9 + i * 0.7) * 0.05;
        // hang from the rim at radius 6.4, tilted outward by sw about the tangent
        m4.makeRotationY(-t); m5.makeRotationZ(sw); m4.multiply(m5);
        m4.setPosition(SWING.x + Math.cos(t) * 6.4, 14.2, SWING.z + Math.sin(t) * 6.4);
        S.chairs.setMatrixAt(i, m4);
      }
      S.chairs.instanceMatrix.needsUpdate = true;
    }
  },
};

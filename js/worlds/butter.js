// World: Butter Slide (Drift Cup, table 1 of 4, easy). A big butcher-block kitchen island on a baking afternoon,
// warm sun slanting in through a south-west window. The road is laid out with long sheets of baking parchment and
// edged with piped strawberry icing; it runs the full length of a rimmed sheet pan (wooden boards lead over the
// rims), sweeps round a mixing bowl, a stand mixer and a cooling rack of cookies, and jumps off a cookie sheet
// propped on the rolling pin. Run wide and you plough into flour drifts; a couple of melted-butter puddles and a
// honey drip lie just off the line. Cookie cutters and chocolate chunks are there to be knocked about.
import * as THREE from '../../vendor/three.bundle.js';
import { rng } from '../util.js';

const TRACK = [
  [-104.7, 65.6], [-44.2, 71], [1.1, 71], [59.8, 71], [113.3, 67.2], [131.2, 46.5], [133.8, 4.8], [128.9, -59.2],
  [108.1, -73.4], [73.1, -71.4], [59.8, -57], [55.7, -1.6], [38.4, 22.9], [7, 31], [-25, 16.1], [-34.9, -13.4],
  [-40.8, -61.9], [-56.3, -73.8], [-103, -68.9], [-116.4, -52.1], [-117.3, -35.6], [-107.4, -2.8], [-109.1, 10.2],
  [-117.2, 40.8],
];
const W = 18;
const BOUNDS = { minX: -160, maxX: 160, minZ: -98, maxZ: 98 };
// the rimmed sheet pan on the start straight (long axis along x); boards lead over its short rims
const TRAY = { x: 22, z: 71, hl: 28, hw: 20, rim: 2.5, fl: 0.25, crest: 2.9, ramp: 10, gap: 12 };
// the cookie sheet propped on the rolling pin (east straight, driving north = -z)
const JUMP = { x: 134, zLow: 28, zHigh: -6, wid: 32, h: 5.6, pinR: 2.8 };
const MIXER = { x: 11, z: -79 };
const PI = Math.PI, TAU = PI * 2;
let A = null; // runtime bits shared by build / animate

// bilinear sample of a tileable noise field
function bil(f, n, x, y) {
  x = ((x % n) + n) % n; y = ((y % n) + n) % n;
  const x0 = x | 0, y0 = y | 0, x1 = (x0 + 1) % n, y1 = (y0 + 1) % n, fx = x - x0, fy = y - y0;
  return (f[y0 * n + x0] * (1 - fx) + f[y0 * n + x1] * fx) * (1 - fy) + (f[y1 * n + x0] * (1 - fx) + f[y1 * n + x1] * fx) * fy;
}
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---- butcher-block worktop: 16 glued strips (maple / beech) per 64-unit tile, strips running along u
function butcherBlock(TX, S) {
  const G = TX.noiseField(256, { seed: 91, period: 4, oct: 4, sx: 0.5, sy: 22 });
  const P = TX.noiseField(256, { seed: 92, period: 16, oct: 2, sx: 1, sy: 6 });
  const B = TX.noiseField(256, { seed: 93, period: 3, oct: 4 });
  const R = rng(4242);
  const NS = 16, tint = [], off = [];
  for (let j = 0; j < NS; j++) {
    const k = R();
    tint.push(k < 0.2 ? [0.93, 0.83, 0.74] : k < 0.55 ? [1.0, 0.92, 0.84] : k < 0.9 ? [1.03, 0.99, 0.95] : [0.98, 0.9, 0.8]);
    off.push([R() * 256, R() * 256]);
  }
  const base = [222, 186, 142];
  const h = new Float32Array(S * S);
  const rough = TX.makeCanvas(S);
  const map = TX.paint(S, S, (x, y, u, v, o) => {
    const sv = v * NS, j = Math.min(NS - 1, Math.floor(sv)), fv = sv - j;
    const [ox, oy] = off[j];
    const g = bil(G, 256, u * 256 + ox, v * 256 + oy);
    const p = bil(P, 256, u * 256 * 4 + ox, v * 256 * 4 + oy);
    const b = bil(B, 256, u * 256, v * 256);
    const line = sstep(0.6, 0.74, g) * 0.16 + sstep(0.72, 0.8, g) * 0.08;
    const pore = sstep(0.7, 0.82, p) * 0.1;
    const edge = Math.min(fv, 1 - fv);
    const glue = edge < 0.012 ? 0.62 : edge < 0.035 ? 0.86 + (edge - 0.012) * 6 : 1;
    const k = (1 - line - pore + (b - 0.5) * 0.12) * glue;
    const t = tint[j];
    o[0] = Math.min(255, base[0] * t[0] * k); o[1] = Math.min(255, base[1] * t[1] * k); o[2] = Math.min(255, base[2] * t[2] * k);
    h[y * S + x] = 0.6 - line * 0.8 - pore * 0.6 - (edge < 0.03 ? 0.35 * (1 - edge / 0.03) : 0);
  });
  TX.paint(S, S, (x, y, u, v, o) => { const q = Math.min(255, Math.max(0, (0.5 + (0.6 - h[y * S + x]) * 0.5) * 255)); o[0] = o[1] = o[2] = q; }, rough);
  return {
    map: TX.toTexture(map),
    normalMap: TX.toTexture(TX.normalFromHeight(h, S, S, 2.2), { srgb: false }),
    roughnessMap: TX.toTexture(rough, { srgb: false }),
  };
}

// ---- baking parchment: warm off-white, fibres, soft crinkles, a few buttery translucent smears
function parchment(TX, S) {
  const F = TX.noiseField(256, { seed: 71, period: 32, oct: 3, sx: 1, sy: 0.25 });
  const N = TX.noiseField(256, { seed: 72, period: 6, oct: 4 });
  const R = rng(777);
  // crinkle height: soft creases painted with blurred lines
  const hc = TX.makeCanvas(S);
  const hg = hc.getContext('2d');
  hg.fillStyle = '#808080'; hg.fillRect(0, 0, S, S);
  hg.filter = `blur(${Math.max(1, S / 256)}px)`;
  for (let i = 0; i < 26; i++) {
    let x = R() * S, y = R() * S, a = R() * TAU;
    const n = 3 + Math.floor(R() * 4);
    hg.lineWidth = S / 300 + R() * S / 200;
    hg.strokeStyle = R() < 0.5 ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)';
    hg.beginPath(); hg.moveTo(x, y);
    for (let k = 0; k < n; k++) {
      a += (R() - 0.5) * 1.1; const l = S * (0.05 + R() * 0.12);
      x += Math.cos(a) * l; y += Math.sin(a) * l;
      hg.lineTo(x, y);
    }
    hg.stroke();
  }
  hg.filter = 'none';
  const hd = hg.getImageData(0, 0, S, S).data;
  const smears = [];
  for (let i = 0; i < 3; i++) smears.push([R(), R(), 0.05 + R() * 0.08, 0.5 + R() * 0.5, R() * PI]);
  const h = new Float32Array(S * S);
  const butterK = new Float32Array(S * S);
  const map = TX.paint(S, S, (x, y, u, v, o) => {
    const f = bil(F, 256, u * 256 * 4, v * 256 * 4);
    const n = bil(N, 256, u * 256, v * 256);
    let bk = 0;
    for (const [sx, sy, sr, ss, sa] of smears) {
      let dx = u - sx, dy = v - sy; dx -= Math.round(dx); dy -= Math.round(dy);
      const ca = Math.cos(sa), sn = Math.sin(sa);
      const lx = (dx * ca + dy * sn) / ss, ly = -dx * sn + dy * ca;
      const d = Math.hypot(lx, ly * 1.6) / sr;
      bk = Math.max(bk, sstep(1, 0.55, d + (n - 0.5) * 0.5));
    }
    butterK[y * S + x] = bk;
    const k = 0.94 + (f - 0.5) * 0.1 + (n - 0.5) * 0.06;
    o[0] = (243 * k) * (1 - bk * 0.08); o[1] = (233 * k) * (1 - bk * 0.12); o[2] = (210 * k) * (1 - bk * 0.32);
    h[y * S + x] = hd[(y * S + x) * 4] / 255 + (f - 0.5) * 0.05;
  });
  const rough = TX.paint(S, S, (x, y, u, v, o) => { const q = (0.78 - butterK[y * S + x] * 0.5) * 255; o[0] = o[1] = o[2] = q; });
  return {
    map: TX.toTexture(map),
    normalMap: TX.toTexture(TX.normalFromHeight(h, S, S, 3.0), { srgb: false }),
    roughnessMap: TX.toTexture(rough, { srgb: false }),
  };
}

// Piped icing along a path: a half arch with star-nozzle ridges that twist along the line.
function pipedGeometry(T, pts, { R = 0.6, H = 0.7, ridges = 7, twist = 2.2, seg = 10, closed = false } = {}) {
  const n = pts.length, rows = closed ? n + 1 : n;
  const pos = new Float32Array(rows * (seg + 1) * 3), nor = new Float32Array(rows * (seg + 1) * 3);
  const idx = [];
  let acc = 0;
  for (let i = 0; i < rows; i++) {
    const p = pts[i % n];
    const a = closed ? pts[(i - 1 + n) % n] : pts[Math.max(0, i - 1)], b = closed ? pts[(i + 1) % n] : pts[Math.min(n - 1, i + 1)];
    if (i > 0) { const q = pts[(i - 1) % n]; acc += Math.hypot(p.x - q.x, p.z - q.z); }
    let tx = b.x - a.x, tz = b.z - a.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    const nx = -tz, nz = tx;
    const wob = Math.sin(acc * 0.9) * 0.06;
    for (let k = 0; k <= seg; k++) {
      const th = (k / seg) * PI;
      const rad = 1 + 0.15 * Math.cos(ridges * th * 2 + acc * twist);
      const cx = Math.cos(th) * R * rad + wob, cy = Math.sin(th) * H * rad;
      const o = (i * (seg + 1) + k) * 3;
      pos[o] = p.x + nx * cx; pos[o + 1] = p.y + cy; pos[o + 2] = p.z + nz * cx;
      let ex = Math.cos(th) / R, ey = Math.sin(th) / H; const el = Math.hypot(ex, ey) || 1; ex /= el; ey /= el;
      nor[o] = nx * ex; nor[o + 1] = ey; nor[o + 2] = nz * ex;
    }
  }
  for (let i = 0; i < rows - 1; i++) {
    for (let k = 0; k < seg; k++) {
      const a = i * (seg + 1) + k, b = a + seg + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(pos, 3));
  g.setAttribute('normal', new T.BufferAttribute(nor, 3));
  g.setAttribute('uv', new T.BufferAttribute(new Float32Array(rows * (seg + 1) * 2), 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

export default {
  id: 'butter',
  name: 'Butter Slide',
  blurb: 'Drift round a floury baking worktop: sheet-pan run, icing kerbs, a rolling-pin jump.',
  vehicle: 'drifter',
  seed: 9,
  track: { points: TRACK, width: W, startS: 49.5 },
  bounds: BOUNDS,
  fallOffEdges: true,
  floorY: -92,
  offCourse: 16,
  skidColor: 0x5a4430,
  clackOnBump: true,
  dust: {
    normal: null,
    slow: { color: 0xfbf8f1, size: 1.3, life: 0.7, up: 3.5, grav: 5, alpha: 0.8, grow: 2.4, rate: 2.2 },
    slick: { color: 0xf3d36a, size: 0.6, life: 0.45, up: 3, grav: 25, alpha: 0.9, grow: 1, rate: 2 },
    sticky: { color: 0xd98e1c, size: 0.6, life: 0.45, up: 1.5, grav: 12, alpha: 0.9, grow: 1, rate: 1.4 },
  },
  lighting: {
    sunDir: [-0.62, 0.92, 0.5], sunColor: 0xffdcae, sunIntensity: 3.0,
    hemiSky: 0xe6ecf8, hemiGround: 0x9a7650, hemiIntensity: 0.58,
    envIntensity: 0.48, exposure: 1.0, background: 0x2e241b, shadowRadius: 2.6,
  },

  async build(K) {
    const { THREE: T, TX, r, track } = K;
    const BU = K.BufferGeometryUtils;
    const PH = K.physics;
    const L = track.length;
    const lowQ = K.quality && K.quality.tilt === false;
    A = { beater: null, timerDial: null };

    // ================================================================== helpers
    const V2 = (a, b = a) => new T.Vector2(a, b);
    const xf = (g, o = {}) => g.applyMatrix4(new T.Matrix4().compose(new T.Vector3(o.x || 0, o.y || 0, o.z || 0),
      new T.Quaternion().setFromEuler(new T.Euler(o.rx || 0, o.ry || 0, o.rz || 0, o.order || 'YXZ')), new T.Vector3(o.sx ?? o.s ?? 1, o.sy ?? o.s ?? 1, o.sz ?? o.s ?? 1)));
    const tidy = (g, c) => {
      g = g.index ? g.toNonIndexed() : g.clone();
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
      if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!g.attributes.color || g.attributes.color.itemSize !== 3) {
        const col = new T.Color(c), n = g.attributes.position.count, a = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; }
        g.setAttribute('color', new T.BufferAttribute(a, 3));
      }
      g.clearGroups();
      return g;
    };
    const bakeQ = new Map();
    // static meshes and groups are collected and merged by material at the end of the build (fewer draw calls)
    const pending = [];
    const bakeMesh = (m, cast) => {
      if (Array.isArray(m.material)) { const c = m.clone(); c.matrixAutoUpdate = false; c.matrix.copy(m.matrixWorld); c.castShadow = cast; c.receiveShadow = true; K.group.add(c); return; }
      const g = m.geometry; if (!g.boundingSphere) g.computeBoundingSphere();
      const c = g.boundingSphere.center.clone().applyMatrix4(m.matrixWorld);
      const cell = Math.floor((c.x + 160) / 80) + '_' + Math.floor((c.z + 98) / 66);
      const k = m.material.uuid + (cast ? 'c' : 'n') + cell;
      if (!bakeQ.has(k)) bakeQ.set(k, { mat: m.material, cast, parts: [] });
      bakeQ.get(k).parts.push(tidy(g.clone().applyMatrix4(m.matrixWorld), 0xffffff));
    };
    const M = (geo, mat, x = 0, y = 0, z = 0, o = {}) => {
      const m = new T.Mesh(geo, mat);
      m.position.set(x, y, z);
      if (o.ry) m.rotation.y = o.ry;
      if (o.rx) m.rotation.x = o.rx;
      if (o.rz) m.rotation.z = o.rz;
      if (o.scale) m.scale.setScalar(o.scale);
      m.userData.cast = o.cast ?? true;
      pending.push(m);
      return m;
    };
    const B = (grp, o = {}) => { grp.userData.cast = o.cast ?? true; pending.push(grp); return grp; };
    const SP = (...args) => { const sp = K.spill(...args); K.group.remove(sp.mesh); sp.mesh.userData.cast = false; pending.push(sp.mesh); return sp; };
    const flush = () => {
      for (const o of pending) {
        o.updateMatrixWorld(true);
        const cast = o.userData.cast ?? true;
        o.traverse((m) => { if (m.isMesh) bakeMesh(m, cast); });
      }
      pending.length = 0;
      const out = [];
      for (const { mat, cast, parts } of bakeQ.values()) {
        const g = BU.mergeGeometries(parts, false);
        g.computeBoundingSphere();
        const m = new T.Mesh(g, mat); m.castShadow = cast; m.receiveShadow = true;
        K.group.add(m); out.push(m);
      }
      bakeQ.clear();
      return out;
    };
    // batched contact shadows
    const aoLists = new Map();
    const AO = (x, z, rx, rz = rx, op = 0.4, ang = 0, y = 0.035) => {
      const k = op < 0.3 ? 0.22 : op < 0.47 ? 0.4 : 0.56;
      if (!aoLists.has(k)) aoLists.set(k, []);
      aoLists.get(k).push({ x, y, z, ry: -ang, sx: rx * 2, sy: 1, sz: rz * 2 });
    };
    const flushAO = () => {
      const g = new T.PlaneGeometry(1, 1); g.rotateX(-PI / 2);
      for (const [op, list] of aoLists) {
        const mat = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: op, alphaMap: TX.blobShadowTexture(), depthWrite: false });
        const im = K.instances(g, mat, list, { cast: false, receive: false });
        im.renderOrder = 1;
      }
    };
    const cv = (w, h, draw) => { const c = TX.makeCanvas(w, h); draw(c.getContext('2d'), w, h); return c; };
    const tex = (c, o = {}) => TX.toTexture(c, { wrap: false, ...o });
    const gAt = (x, z) => PH.groundAt(x, z).g;
    const sAt = (x, z) => track.distTo(x, z).s;
    const roadD = (x, z) => { const n = track.distTo(x, z); return n.dist - track.w[n.i] / 2; }; // < 0 on the road
    const sDist = (a, b) => { const d = (((b - a) % L) + L) % L; return d > L / 2 ? d - L : d; };
    const inS = (s, a, b) => { const d = (((s - a) % L) + L) % L; return d <= (((b - a) % L) + L) % L; };
    const onTable = (x, z, m = 1) => x > BOUNDS.minX + m && x < BOUNDS.maxX - m && z > BOUNDS.minZ + m && z < BOUNDS.maxZ - m;
    const roundRect = (w, d, rad) => {
      const s = new T.Shape(), x0 = -w / 2, y0 = -d / 2;
      s.moveTo(x0 + rad, y0); s.lineTo(x0 + w - rad, y0); s.absarc(x0 + w - rad, y0 + rad, rad, -PI / 2, 0);
      s.lineTo(x0 + w, y0 + d - rad); s.absarc(x0 + w - rad, y0 + d - rad, rad, 0, PI / 2);
      s.lineTo(x0 + rad, y0 + d); s.absarc(x0 + rad, y0 + d - rad, rad, PI / 2, PI);
      s.lineTo(x0, y0 + rad); s.absarc(x0 + rad, y0 + rad, rad, PI, PI * 1.5);
      return s;
    };
    // flat-lying slab from a 2D shape: extruded up from y = 0 (shape y = -z, as K.flatShape)
    const slab = (shape, h, bevel = 0, curve = 10) => {
      const g = new T.ExtrudeGeometry(shape, { depth: Math.max(0.01, h - bevel * 2), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: curve });
      g.rotateX(-PI / 2); g.translate(0, bevel, 0);
      return g;
    };

    // key places along the lap
    const S = {
      start: 49.5, trayIn: sAt(TRAY.x - TRAY.hl - TRAY.ramp, TRAY.z), trayOut: sAt(TRAY.x + TRAY.hl + TRAY.ramp, TRAY.z),
      jumpLow: sAt(JUMP.x, JUMP.zLow), jumpHigh: sAt(JUMP.x, JUMP.zHigh),
    };
    S.land = S.jumpHigh + 21;
    A.S = S;

    // ================================================================== physics: the sheet pan, the cookie-sheet jump
    {
      const { x: cx, z: cz, hl, hw, fl, crest, ramp, gap } = TRAY;
      K.platform(cx, cz, hl - 0.7, hw - 0.7, 0, fl);
      K.ramp(cx - hl - ramp / 2, cz, 0, ramp, gap * 2, crest, 0); // up the outer board to the west rim
      K.ramp(cx - hl + ramp / 2, cz, PI, ramp, gap * 2, crest - fl, fl); // down the inner board into the pan
      K.ramp(cx + hl - ramp / 2, cz, 0, ramp, gap * 2, crest - fl, fl); // up to the east rim
      K.ramp(cx + hl + ramp / 2, cz, PI, ramp, gap * 2, crest, 0); // down onto the worktop
      const rh = TRAY.rim + 0.1;
      K.box(cx, cz - hw + 0.4, hl, 0.5, 0, rh); K.box(cx, cz + hw - 0.4, hl, 0.5, 0, rh);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const z0 = cz + sz * gap, z1 = cz + sz * hw;
        K.box(cx + sx * (hl - 0.4), (z0 + z1) / 2, 0.5, Math.abs(z1 - z0) / 2, 0, rh);
      }
      // the cookie sheet propped on the rolling pin: a ramp rising to the north, cars fly off its high end
      K.ramp(JUMP.x, (JUMP.zLow + JUMP.zHigh) / 2, -PI / 2, JUMP.zLow - JUMP.zHigh, JUMP.wid, JUMP.h, 0);
      // rolling-pin handles sticking out beside the sheet
      const hx = JUMP.wid / 2;
      K.capsule(JUMP.x - hx - 7.5, JUMP.zHigh, JUMP.x - hx + 0.5, JUMP.zHigh, 1.5, 4.2);
      K.capsule(JUMP.x + hx - 0.5, JUMP.zHigh, JUMP.x + hx + 7.5, JUMP.zHigh, 1.5, 4.2);
    }

    // ================================================================== worktop, island, kitchen floor
    {
      const TS = lowQ ? 512 : 1024;
      const bb = butcherBlock(TX, TS);
      const topMat = K.std({ map: bb.map, normalMap: bb.normalMap, roughnessMap: bb.roughnessMap, normalScale: V2(0.55), roughness: 1 });
      for (const t of [bb.map, bb.normalMap, bb.roughnessMap]) t.repeat.set(320 / 64, 196 / 64);
      // top face, then the four edge faces in one mesh (uvs in world units, so one texture serves all)
      const topG = new T.PlaneGeometry(320, 196); topG.rotateX(-PI / 2);
      K.mesh(topG, topMat, 0, 0, 0, { cast: false });
      const sideTex = bb.map.clone(); sideTex.repeat.set(1, 1); sideTex.needsUpdate = true;
      const quad = (pts, uvs) => {
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.Float32BufferAttribute(pts.flat(), 3));
        g.setAttribute('uv', new T.Float32BufferAttribute(uvs.flat(), 2));
        g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals();
        return g;
      };
      const X = 160, Z = 98, Y0 = -6;
      const sides = [
        quad([[-X, Y0, Z], [X, Y0, Z], [X, 0, Z], [-X, 0, Z]], [[-X / 64, Y0 / 64], [X / 64, Y0 / 64], [X / 64, 0], [-X / 64, 0]]),
        quad([[X, Y0, -Z], [-X, Y0, -Z], [-X, 0, -Z], [X, 0, -Z]], [[X / 64, Y0 / 64], [-X / 64, Y0 / 64], [-X / 64, 0], [X / 64, 0]]),
        quad([[X, Y0, Z], [X, Y0, -Z], [X, 0, -Z], [X, 0, Z]], [[Z / 64, Y0 / 64], [-Z / 64, Y0 / 64], [-Z / 64, 0], [Z / 64, 0]]),
        quad([[-X, Y0, -Z], [-X, Y0, Z], [-X, 0, Z], [-X, 0, -Z]], [[-Z / 64, Y0 / 64], [Z / 64, Y0 / 64], [Z / 64, 0], [-Z / 64, 0]]),
      ];
      K.mesh(BU.mergeGeometries(sides, false), K.std({ map: sideTex, roughness: 0.6, color: 0xe6d8c8 }), 0, 0, 0, { cast: false });
      // island cabinet below: sage-green painted door panels, brass knobs
      const cabC = cv(512, 256, (g, w, h) => {
        g.fillStyle = '#93a88c'; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 4; i++) {
          const x0 = i * 128 + 8;
          g.fillStyle = 'rgba(40,60,40,0.28)'; g.fillRect(x0, 10, 112, h - 20);
          g.fillStyle = '#9db294'; g.fillRect(x0 + 6, 16, 100, h - 32);
          g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 2; g.strokeRect(x0 + 14, 24, 84, h - 48);
        }
      });
      const cabT = tex(cabC); cabT.wrapS = T.RepeatWrapping;
      const CX = 148, CZ = 86, CY0 = -90, CY1 = -6;
      const cab = [
        quad([[-CX, CY0, CZ], [CX, CY0, CZ], [CX, CY1, CZ], [-CX, CY1, CZ]], [[0, 0], [4, 0], [4, 1], [0, 1]]),
        quad([[CX, CY0, -CZ], [-CX, CY0, -CZ], [-CX, CY1, -CZ], [CX, CY1, -CZ]], [[0, 0], [4, 0], [4, 1], [0, 1]]),
        quad([[CX, CY0, CZ], [CX, CY0, -CZ], [CX, CY1, -CZ], [CX, CY1, CZ]], [[0, 0], [2.3, 0], [2.3, 1], [0, 1]]),
        quad([[-CX, CY0, -CZ], [-CX, CY0, CZ], [-CX, CY1, CZ], [-CX, CY1, -CZ]], [[0, 0], [2.3, 0], [2.3, 1], [0, 1]]),
      ];
      K.mesh(BU.mergeGeometries(cab, false), K.std({ map: cabT, roughness: 0.55 }), 0, 0, 0, { cast: false });
      const brass = K.metal(0xc9a45c, 0.3);
      const knobs = [];
      for (let i = 0; i < 4; i++) for (const sz of [-1, 1]) knobs.push({ x: -148 + i * 74 + 37, y: -16, z: sz * 87 });
      K.instances(new T.SphereGeometry(1.6, 12, 8), brass, knobs, { cast: false });
      K.mesh(new T.BoxGeometry(300, 4, 176), K.std({ color: 0x5e4a38, roughness: 0.8 }), 0, -90, 0, { cast: false });
      // terracotta tiles far below
      const fc = cv(512, 512, (g) => {
        const R = rng(31);
        for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
          const k = 0.88 + R() * 0.2;
          g.fillStyle = `rgb(${120 * k | 0},${72 * k | 0},${54 * k | 0})`; g.fillRect(x * 128, y * 128, 128, 128);
          g.fillStyle = 'rgba(255,230,200,0.06)'; for (let i = 0; i < 30; i++) g.fillRect(x * 128 + R() * 120, y * 128 + R() * 120, 6, 6);
        }
        g.strokeStyle = '#8f8576'; g.lineWidth = 6;
        for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, 512); g.stroke(); g.beginPath(); g.moveTo(0, i * 128); g.lineTo(512, i * 128); g.stroke(); }
      });
      K.mesh(new T.PlaneGeometry(1800, 1800), K.std({ map: TX.toTexture(fc, { repeat: [1800 / 120, 1800 / 120] }), roughness: 0.75 }), 0, -92, 0, { rx: -PI / 2, cast: false });
    }

    // ================================================================== materials shared by many props
    const PS = lowQ ? 256 : 512;
    const pp = parchment(TX, PS);
    for (const t of [pp.map, pp.normalMap, pp.roughnessMap]) { t.repeat.set(1, 1); }
    const paperMat = K.std({ map: pp.map, normalMap: pp.normalMap, roughnessMap: pp.roughnessMap, normalScale: V2(0.7), roughness: 1, side: T.DoubleSide });
    const wt = TX.woodTextures({ size: lowQ ? 256 : 512, seed: 6, planks: 3, base: 0xcf9f68, dark: 0x9a6a3c, light: 0xe8c48e, ringFreq: 16, gap: 0.003, roughBase: 0.5 });
    const woodMat = K.std({ map: wt.map, normalMap: wt.normalMap, roughnessMap: wt.roughnessMap, roughness: 1, normalScale: V2(0.5) });
    const fnT = TX.mottledTextures({ size: 128, a: 0xffffff, b: 0xeeeae2, seed: 61, period: 24, bump: 6 });
    const flourMound = K.std({ color: 0xfcfaf5, roughness: 0.97, normalMap: fnT.normalMap, normalScale: V2(0.8) });
    const heapG = [];
    // a soft heap of flour (polar grid, lumpy rim), merged with the corner drifts at the end
    const heap = (cx, cz, rx, rz, h, ang = 0) => {
      const NR = 6, NA = 26, k1 = r() * TAU, k2 = r() * TAU;
      const pos = [], uv = [], idx = [];
      const ca = Math.cos(ang), sa = Math.sin(ang);
      for (let i = 0; i <= NR; i++) {
        const rr = i / NR;
        for (let j = 0; j <= NA; j++) {
          const a = (j / NA) * TAU, lump = 1 + 0.16 * Math.sin(a * 3 + k1) + 0.1 * Math.sin(a * 5 + k2);
          const lx = Math.cos(a) * rr * rx * lump, lz = Math.sin(a) * rr * rz * lump;
          const x = cx + lx * ca - lz * sa, z = cz + lx * sa + lz * ca;
          pos.push(x, 0.03 + h * Math.pow(Math.max(0, 1 - rr * rr), 1.4) * (1 + 0.1 * Math.sin(a * 7 + k2 + rr * 4)), z);
          uv.push(x / 6, z / 6);
        }
      }
      for (let i = 0; i < NR; i++) for (let j = 0; j < NA; j++) { const q = i * (NA + 1) + j, q2 = q + NA + 1; idx.push(q, q2, q + 1, q + 1, q2, q2 + 1); }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals();
      heapG.push(g.toNonIndexed());
    };
    // batter surface: folds and ripples drawn as soft arcs
    const batterTex = (base, light, dark, seed) => cv(256, 256, (g) => {
      const R = rng(seed);
      g.fillStyle = base; g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 11; i++) {
        const cx = 128 + (R() - 0.5) * 70, cy = 128 + (R() - 0.5) * 70, rr = 30 + R() * 80, a0 = R() * TAU, al = 0.6 + R() * 1.6, lw = 2 + R() * 5;
        g.lineCap = 'round';
        g.strokeStyle = dark; g.lineWidth = lw; g.beginPath(); g.arc(cx + 2, cy + 3, rr, a0, a0 + al); g.stroke();
        g.strokeStyle = light; g.lineWidth = lw * 0.7; g.beginPath(); g.arc(cx, cy, rr, a0, a0 + al); g.stroke();
      }
    });
    const chocMat = K.phys({ color: 0x3a2214, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.4 });
    const butterMat = K.phys({ color: 0xf6e3a0, roughness: 0.32, clearcoat: 0.4, sheen: 0.4, sheenColor: new T.Color(0xfff6c8) });
    const meltMat = K.phys({ color: 0xf2d066, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03, transparent: true, opacity: 0.86 });
    const honeyMat = K.phys({ color: 0xd98a0b, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, opacity: 0.93 });
    const steel = K.metal(0xdfe2e6, 0.16, { side: T.DoubleSide }); // all the chrome and stainless bits
    const glassMat = K.glass(0xf6fbff, 0.22);

    // ================================================================== parchment sheets laid along the road
    {
      const sheets = [];
      const along = (s0, s1, wid, off = 0, jitter = 0) => {
        const n0 = track.place(s0, off), n1 = track.place(s1, off);
        const cx = (n0.x + n1.x) / 2, cz = (n0.z + n1.z) / 2;
        const ang = Math.atan2(n1.z - n0.z, n1.x - n0.x) + jitter;
        const len = Math.hypot(n1.x - n0.x, n1.z - n0.z) + 2;
        sheets.push({ cx, cz, ang, len, wid });
      };
      along(S.start - 34, S.trayIn - 2, 27, 0.4, -0.006);
      along(S.trayOut + 3, S.trayOut + 40, 26, -0.6, 0.01);
      along(S.land - 10, S.land + 22, 26, 0.3, 0.012);
      // U: down the east leg, fanned round the bottom, up the west leg
      const sU0 = sAt(57, -50), sU1 = sAt(-35, -48);
      along(sU0, sU0 + 44, 27, 0.2, -0.01);
      for (let k = 0; k < 4; k++) { const s = sU0 + 48 + k * 33; along(s, s + 36, 30, 0, (k % 2 ? 1 : -1) * 0.03); }
      along(sU1 - 44, sU1, 27, -0.3, 0.012);
      const sN = sAt(-80, -71); along(sN - 24, sN + 20, 26, 0.5, -0.015);
      const sW = sAt(-108, 0); along(sW - 30, sW + 8, 28, 0, 0.02); along(sW + 4, sW + 40, 28, 0.4, -0.03);
      const sE = sAt(124, 58); along(sE - 30, sE + 2, 28, 0.6, 0.03);
      const parts = [];
      sheets.forEach((sh, i) => {
        const nx = Math.max(4, Math.round(sh.len / 3)), nz = Math.max(3, Math.round(sh.wid / 3));
        const g = new T.PlaneGeometry(sh.len, sh.wid, nx, nz);
        g.rotateX(-PI / 2);
        const pos = g.attributes.position, uv = g.attributes.uv;
        const ca = Math.cos(sh.ang), sa = Math.sin(sh.ang);
        const ou = r() * 8, ov = r() * 8, base = 0.05 + i * 0.012;
        for (let k = 0; k < pos.count; k++) {
          const lx = pos.getX(k), lz = pos.getZ(k);
          const x = sh.cx + lx * ca - lz * sa, z = sh.cz + lx * sa + lz * ca;
          // corners curl up a little where no car drives over them
          const ex = Math.abs(lx) - sh.len / 2 + 3, ez = Math.abs(lz) - sh.wid / 2 + 3;
          let y = base + Math.sin(lx * 0.9 + i) * Math.sin(lz * 1.1) * 0.02;
          if (ex > 0 && ez > 0 && roadD(x, z) > 0.5) y += Math.min(ex, ez) * Math.min(ex, ez) * 0.07;
          pos.setXYZ(k, x, y, z);
          uv.setXY(k, (lx + ou * 32) / 34, (lz + ov * 32) / 34);
        }
        g.computeVertexNormals();
        parts.push(g);
      });
      // the pan's lining sheet
      {
        const g = new T.PlaneGeometry(TRAY.hl * 2 - 3, TRAY.hw * 2 - 3.5, 18, 12); g.rotateX(-PI / 2);
        const pos = g.attributes.position, uv = g.attributes.uv;
        for (let k = 0; k < pos.count; k++) {
          const lx = pos.getX(k), lz = pos.getZ(k);
          pos.setXYZ(k, TRAY.x + lx, TRAY.fl + 0.035 + Math.sin(lx * 0.7) * Math.sin(lz * 0.9) * 0.015, TRAY.z + lz);
          uv.setXY(k, (lx + 100) / 34, (lz + 60) / 34);
        }
        g.computeVertexNormals();
        parts.push(g);
      }
      const m = new T.Mesh(BU.mergeGeometries(parts, false), paperMat);
      m.receiveShadow = true; m.castShadow = false;
      K.group.add(m);
    }

    // ================================================================== road edges: piped strawberry icing, kerbs of sprinkles & chips
    const sugarN = TX.mottledTextures({ size: 128, a: 0xffffff, b: 0xe9e2da, seed: 41, period: 16, bump: 4 });
    const icingMat = K.phys({ color: 0xf2809f, roughness: 0.5, normalMap: sugarN.normalMap, normalScale: V2(0.35), clearcoat: 0.3, clearcoatRoughness: 0.45, sheen: 0.5, sheenColor: new T.Color(0xffe6ee) });
    const sprinkleCols = [0xf04a6a, 0xffd23a, 0x4aa8f0, 0x5ccb6a, 0xff8a2a, 0xffffff, 0xb07ae8];
    const sprinkleGeo = new T.CapsuleGeometry(0.17, 0.75, 1, 5); sprinkleGeo.rotateZ(PI / 2);
    const sprinkleMat = K.phys({ color: 0xffffff, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.25 });
    const chipGeo = K.lathe([[0.001, 0], [0.66, 0], [0.62, 0.3], [0.32, 0.75], [0.06, 1.05], [0.001, 1.08]], 7);
    const sprinkles = [], chips = [];
    {
      const skipIcing = (s) => inS(s, S.jumpLow + 33.2, S.land - 2);
      // both edges of a ~65-unit stretch share one mesh (culled as a piece)
      const runs = [];
      let cur = null;
      for (let s = 0; s <= L + 0.01; s += 0.6) {
        const ss = s % L;
        if (skipIcing(ss)) { cur = null; continue; }
        if (!cur || cur.l.length > 108) {
          const prev = cur;
          cur = { l: [], r: [] };
          runs.push(cur);
          if (prev) { cur.l.push(prev.l[prev.l.length - 1]); cur.r.push(prev.r[prev.r.length - 1]); }
        }
        const p = track.at(ss);
        for (const side of [-1, 1]) {
          const off = side * (p.w / 2 + 0.8);
          const x = p.x + p.nx * off, z = p.z + p.nz * off;
          (side < 0 ? cur.l : cur.r).push({ x, z, y: gAt(x, z) + 0.01 });
        }
      }
      for (const run of runs) {
        if (run.l.length < 3) continue;
        const g = BU.mergeGeometries([pipedGeometry(T, run.l, { R: 0.82, H: 0.95, seg: 8 }), pipedGeometry(T, run.r, { R: 0.82, H: 0.95, seg: 8 })], false);
        g.computeBoundingSphere();
        const m = new T.Mesh(g, icingMat);
        m.castShadow = false; m.receiveShadow = true; K.group.add(m);
      }
      for (const side of [-1, 1]) {
        // kerbs at corners: sprinkles on the inside, a row of chocolate chips on the outside
        for (let s = 0; s < L; s += 0.5) {
          if (skipIcing(s) || inS(s, S.trayIn - 4, S.trayOut + 4)) continue;
          const p = track.at(s);
          let k = 0; for (let d = -3; d <= 3; d += 1.5) k += track.curv[track.idx(s + d)];
          k /= 5;
          if (Math.abs(k) < 1 / 60) continue;
          const inside = Math.sign(k) === side;
          if (inside) {
            for (let j = 0; j < 2; j++) {
              const off = side * (p.w / 2 + 1.5 + r() * 1.8);
              sprinkles.push({ x: p.x + p.nx * off, y: 0.18, z: p.z + p.nz * off, ry: r() * TAU, rx: r.range(-0.2, 0.2), s: r.range(0.85, 1.15), color: r.pick(sprinkleCols), ck: 'k' + Math.floor(s / 150) });
            }
          } else if (Math.round(s * 2) % 3 === 0) {
            const off = side * (p.w / 2 + 1.85);
            chips.push({ x: p.x + p.nx * off + r.range(-0.15, 0.15), y: 0.02, z: p.z + p.nz * off + r.range(-0.15, 0.15), ry: r() * TAU, rx: r.range(-0.15, 0.15), s: r.range(0.9, 1.15), ck: 'k' + Math.floor(s / 150) });
          }
        }
      }
      // icing blobs where the line stops and starts again round the jump
      for (const s of [S.jumpLow + 33, S.land - 1.8]) for (const side of [-1, 1]) {
        const p = track.place(s, side * (W / 2 + 0.8));
        M(new T.SphereGeometry(1.05, 16, 10, 0, TAU, 0, PI / 2), icingMat, p.x, gAt(p.x, p.z), p.z, { cast: true });
      }
    }

    // ---- start / finish: a band of chocolate and vanilla icing squares piped across the road
    {
      const p = track.at(S.start);
      const cols = 10, rows = 2;
      const c = cv(640, 128, (g) => {
        for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
          const dark = (x + y) % 2 === 0;
          g.fillStyle = dark ? '#4a2a18' : '#fbf3e4'; g.fillRect(x * 64, y * 64, 64, 64);
          // piped zig-zag texture inside each square
          g.strokeStyle = dark ? 'rgba(255,220,180,0.16)' : 'rgba(120,80,40,0.16)'; g.lineWidth = 5;
          g.beginPath();
          for (let k = 0; k < 6; k++) { const yy = y * 64 + 8 + k * 9.5; g.moveTo(x * 64 + 6, yy); g.quadraticCurveTo(x * 64 + 32, yy + (k % 2 ? 6 : -6), x * 64 + 58, yy); }
          g.stroke();
        }
      });
      const h = TX.makeCanvas(640, 128);
      const hg = h.getContext('2d');
      hg.fillStyle = '#000'; hg.fillRect(0, 0, 640, 128);
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const gr = hg.createRadialGradient(x * 64 + 32, y * 64 + 32, 4, x * 64 + 32, y * 64 + 32, 38);
        gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#333');
        hg.fillStyle = gr; hg.fillRect(x * 64 + 2, y * 64 + 2, 60, 60);
      }
      const hf = TX.heightFromCanvasLuma(h);
      const nmap = TX.toTexture(TX.normalFromHeight(hf, 640, 128, 3), { srgb: false, wrap: false });
      const mat = K.phys({ map: tex(c), normalMap: nmap, roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.4 });
      const g = new K.RoundedBoxGeometry(W + 1.2, 0.4, 3.6, 2, 0.16);
      const m = M(g, mat, p.x, 0.12, p.z, { cast: true });
      m.rotation.y = -p.angle + PI / 2;
      // the box's top face uv runs 0..1 across x: matches the canvas
    }

    // ================================================================== the sheet pan (start straight)
    {
      const { x: cx, z: cz, hl, hw, fl, rim, crest, ramp, gap } = TRAY;
      const bm = TX.brushedMetalTextures({ size: 256, seed: 17 });
      const stainC = cv(512, 384, (g, w, h) => {
        g.fillStyle = '#d4d7db'; g.fillRect(0, 0, w, h);
        const R = rng(5);
        for (let i = 0; i < 14; i++) {
          const x = R() * w, y = R() * h, rr = 14 + R() * 40;
          const gr = g.createRadialGradient(x, y, rr * 0.4, x, y, rr);
          gr.addColorStop(0, 'rgba(176,132,70,0.18)'); gr.addColorStop(0.8, 'rgba(150,104,48,0.32)'); gr.addColorStop(1, 'rgba(150,104,48,0)');
          g.fillStyle = gr; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill();
        }
      });
      const panMat = K.std({ map: tex(stainC), color: 0xffffff, metalness: 0.9, roughness: 0.42, roughnessMap: bm.roughnessMap, normalMap: bm.normalMap, normalScale: V2(0.4) });
      const panG = [];
      panG.push(xf(new T.BoxGeometry(hl * 2, fl, hw * 2), { x: cx, y: fl / 2, z: cz }));
      for (const sz of [-1, 1]) panG.push(xf(new T.BoxGeometry(hl * 2, rim - 0.4, 0.3), { x: cx, y: (rim - 0.4) / 2, z: cz + sz * (hw - 0.15) }));
      for (const sx of [-1, 1]) panG.push(xf(new T.BoxGeometry(0.3, rim - 0.4, hw * 2), { x: cx + sx * (hl - 0.15), y: (rim - 0.4) / 2, z: cz }));
      // rolled bead round the top
      for (const sz of [-1, 1]) panG.push(xf(new T.CylinderGeometry(0.42, 0.42, hl * 2, 10), { x: cx, y: rim - 0.42, z: cz + sz * (hw - 0.15), rz: PI / 2 }));
      for (const sx of [-1, 1]) panG.push(xf(new T.CylinderGeometry(0.42, 0.42, hw * 2, 10), { x: cx + sx * (hl - 0.15), y: rim - 0.42, z: cz, rx: PI / 2 }));
      const pan = new T.Mesh(BU.mergeGeometries(panG.map((g) => g.index ? g.toNonIndexed() : g), false), panMat);
      B(pan);
      AO(cx, cz, hl + 2, hw + 2, 0.45);
      // wooden boards over the short rims (top faces = the physics ramps)
      const boardG = [];
      const board = (x0, y0, x1, y1) => {
        const len = Math.hypot(x1 - x0, y1 - y0) + 0.6, a = Math.atan2(y1 - y0, x1 - x0);
        const g = new K.RoundedBoxGeometry(len, 0.8, gap * 2 + 0.6, 2, 0.3);
        xf(g, { x: (x0 + x1) / 2 - Math.sin(a) * 0.4, y: (y0 + y1) / 2 - Math.cos(a) * 0.4, z: cz, rz: a });
        boardG.push(g);
      };
      board(cx - hl - ramp, 0, cx - hl, crest); board(cx - hl, crest, cx - hl + ramp, fl);
      board(cx + hl - ramp, fl, cx + hl, crest); board(cx + hl, crest, cx + hl + ramp, 0);
      const bmesh = new T.Mesh(BU.mergeGeometries(boardG, false), K.std({ map: wt.map, normalMap: wt.normalMap, roughnessMap: wt.roughnessMap, roughness: 1, color: 0xf6ead8 }));
      B(bmesh);
      AO(cx - hl - ramp * 0.6, cz, ramp * 0.6, gap + 1, 0.3); AO(cx + hl + ramp * 0.6, cz, ramp * 0.6, gap + 1, 0.3);
      // unbaked cookie-dough balls in rows beside the road on the pan
      const doughTex = TX.mottledTextures({ size: 128, a: 0xefd7a6, b: 0xe2c58e, seed: 12, period: 12, bump: 4 });
      const doughMat = K.phys({ map: doughTex.map, normalMap: doughTex.normalMap, roughness: 0.75, clearcoat: 0.1 });
      A.doughMat = doughMat;
      const dough = [], dchips = [];
      for (const sz of [-1, 1]) for (let i = 0; i < 6; i++) {
        const x = cx - hl + 7 + i * 8.4, z = cz + sz * (hw - 4.6);
        dough.push({ x, y: fl + 1.5, z, ry: r() * TAU, sx: 2.3, sy: 1.85, sz: 2.3 });
        K.circle(x, z, 2.2, fl + 2.6);
        for (let k = 0; k < 4; k++) { const a = r() * TAU, d = r() * 1.5; dchips.push({ x: x + Math.cos(a) * d, y: fl + 1.5 + 1.85 * Math.sqrt(Math.max(0, 1 - (d / 2.3) ** 2)) - 0.4, z: z + Math.sin(a) * d, ry: r() * TAU, rx: r.range(-0.6, 0.6), s: 0.8 }); }
        AO(x, z, 2.6, 2.6, 0.35, 0, fl + 0.06);
      }
      K.instances(new T.SphereGeometry(1, 18, 12), doughMat, dough);
      K.instances(chipGeo, chocMat, dchips);
    }

    // ================================================================== the jump: a cookie sheet propped on the rolling pin
    {
      const { x: jx, zLow, zHigh, wid, h, pinR } = JUMP;
      const len = Math.hypot(zLow - zHigh, h), a = Math.atan2(h, zLow - zHigh);
      const stainC = cv(256, 256, (g, w, hh) => {
        g.fillStyle = '#d9dce0'; g.fillRect(0, 0, w, hh);
        const R = rng(8);
        for (let i = 0; i < 12; i++) {
          const x = 30 + (i % 3) * 90 + R() * 10, y = 25 + Math.floor(i / 3) * 62 + R() * 8, rr = 18 + R() * 6;
          const gr = g.createRadialGradient(x, y, rr * 0.3, x, y, rr);
          gr.addColorStop(0, 'rgba(190,150,90,0.1)'); gr.addColorStop(0.85, 'rgba(160,110,50,0.28)'); gr.addColorStop(1, 'rgba(160,110,50,0)');
          g.fillStyle = gr; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill();
        }
      });
      const bm = TX.brushedMetalTextures({ size: 256, seed: 19 });
      const sheetMat = K.std({ map: tex(stainC), metalness: 0.55, roughness: 0.5, roughnessMap: bm.roughnessMap, normalMap: bm.normalMap, normalScale: V2(0.35) });
      const grp = new T.Group();
      const sh = new T.Mesh(new K.RoundedBoxGeometry(wid, 0.3, len + 0.6, 2, 0.12), sheetMat);
      sh.position.y = -0.15; grp.add(sh);
      // rolled edges on the long sides
      for (const sx of [-1, 1]) { const e = new T.Mesh(new T.CylinderGeometry(0.32, 0.32, len + 0.6, 8), sheetMat); e.rotation.x = PI / 2; e.position.set(sx * (wid / 2 - 0.1), 0.05, 0); grp.add(e); }
      // the raised lip at the high end that you grab it by (low, below the launch line)
      grp.position.set(jx, h / 2, (zLow + zHigh) / 2);
      grp.rotation.x = a;
      B(grp);
      AO(jx, (zLow + zHigh) / 2 + 4, wid / 2 + 2, (zLow - zHigh) / 2, 0.3);
      // rolling pin: barrel under the high end, handles out to the sides
      const prof = [[0.001, -7.5], [0.9, -7.5], [1.15, -6.8], [1.3, -4.5], [1.25, -2.0], [1.9, -1.6], [2.2, -1.1], [pinR * 0.93, -0.5], [pinR, 0]];
      const half = [...prof];
      const full = [];
      const bl = wid / 2 + 0.5; // barrel half length
      for (const [rr, yy] of half) full.push([rr, yy]);
      full.push([pinR, 0.2], [pinR, bl * 2 - 0.2]);
      for (let i = half.length - 1; i >= 0; i--) full.push([half[i][0], bl * 2 - half[i][1]]);
      const pinGeo = K.lathe(full.map(([rr, yy]) => [rr, yy]), 32);
      pinGeo.translate(0, -bl, 0); pinGeo.rotateZ(PI / 2);
      const pinTex = (() => {
        const c = TX.paint(256, 64, (x, y, u, v, o) => {
          const g = Math.sin(u * 60 + Math.sin(v * 7) * 1.6 + Math.sin(u * 13) * 2) * 0.5 + 0.5;
          const k = 0.88 + g * 0.12;
          o[0] = 222 * k; o[1] = 180 * k; o[2] = 128 * k;
        });
        return TX.toTexture(c);
      })();
      M(pinGeo, K.std({ map: pinTex, roughness: 0.55 }), jx, pinR, zHigh - 0.3);
      AO(jx, zHigh - 0.5, bl + 8, pinR + 1.5, 0.45);
      // a little flour where the pin has been rolling
      for (let i = 0; i < 4; i++) heap(jx + r.range(-24, 24), zHigh - 9 - r() * 5, r.range(2, 3.6), r.range(1.4, 2.4), 0.22, r() * 3);
    }

    // ================================================================== hazards
    // ---- flour drifts on the outside of the corners (slow run-off)
    {
      const corners = [];
      let inC = false, c0 = 0, sign = 0;
      const kAt = (s) => { let k = 0; for (let d = -4; d <= 4; d += 2) k += track.curv[track.idx(s + d)]; return k / 5; };
      const s0 = S.start + 5; // scan from a straight
      for (let i = 0; i <= L; i += 1) {
        const s = (s0 + i) % L, k = kAt(s);
        const c = Math.abs(k) > 1 / 58;
        if (c && !inC) { inC = true; c0 = s; sign = Math.sign(k); }
        else if ((!c || Math.sign(k) !== sign) && inC) { inC = false; corners.push({ a: c0, b: s, sign }); }
      }
      const flourG = [], puffs = [];
      const dustSpots = [];
      for (const cn of corners) {
        let len = sDist(cn.a, cn.b);
        if (len < 14) continue;
        if (inS(cn.a, S.jumpLow - 10, S.land + 5)) continue;
        const side = -cn.sign; // outside of the turn
        const a = cn.a + len * 0.25, b = cn.b + 14;
        len = sDist(a, b);
        const n = Math.ceil(len / 1.2), nu = 7;
        const wMax = 6.5 + r() * 1.5;
        const inner = [], outer = [];
        const pos = [], idx = [];
        for (let i = 0; i <= n; i++) {
          const t = i / n, s = a + len * t;
          const p = track.at(s);
          const env = Math.pow(Math.sin(PI * Math.min(1, t * 1.15)), 0.5);
          const wid = 1.5 + wMax * env * (0.8 + 0.12 * Math.sin(s * 0.31) + 0.1 * Math.sin(s * 1.37 + wMax));
          for (let j = 0; j <= nu; j++) {
            const u = j / nu;
            let off = side * (p.w / 2 + 1.35 + u * wid);
            let x = p.x + p.nx * off, z = p.z + p.nz * off;
            // stay on the worktop
            x = Math.min(BOUNDS.maxX - 1.5, Math.max(BOUNDS.minX + 1.5, x)); z = Math.min(BOUNDS.maxZ - 1.5, Math.max(BOUNDS.minZ + 1.5, z));
            const hgt = 0.62 * Math.pow(Math.sin(PI * u), 0.7) * (0.35 + 0.65 * env) * (0.85 + 0.3 * Math.sin(s * 0.7 + u * 5));
            pos.push(x, 0.02 + hgt, z);
            if (j === 0) inner.push([x, z]);
            if (j === nu) outer.push([x, z]);
          }
          if (i % 4 === 0 && env > 0.3) {
            const off = side * (p.w / 2 + 1.35 + r() * wid);
            puffs.push({ x: p.x + p.nx * off, y: 0.3, z: p.z + p.nz * off, s: r.range(0.2, 0.42), rx: r() * 3, ry: r() * TAU });
          }
          if (i % 9 === 4) dustSpots.push([p.x + p.nx * side * (p.w / 2 + 3 + wid * 0.6), p.z + p.nz * side * (p.w / 2 + 3 + wid * 0.6), wid + 4]);
        }
        for (let i = 0; i < n; i++) for (let j = 0; j < nu; j++) {
          const q = i * (nu + 1) + j, q2 = q + nu + 1;
          if (side > 0) idx.push(q, q + 1, q2, q + 1, q2 + 1, q2); else idx.push(q, q2, q + 1, q + 1, q2, q2 + 1);
        }
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
        g.setAttribute('uv', new T.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
        g.setIndex(idx); g.computeVertexNormals();
        flourG.push(g);
        K.surface('slow', { poly: inner.concat(outer.reverse()) });
      }
      // triplanar-ish: give the mound uvs from world xz
      for (const g of flourG) { const p = g.attributes.position, uv = g.attributes.uv; for (let k = 0; k < p.count; k++) uv.setXY(k, p.getX(k) / 6, p.getZ(k) / 6); }
      for (const g of flourG) heapG.push(g.toNonIndexed());
      K.instances(new T.DodecahedronGeometry(1, 0), flourMound, puffs, { cast: false });
      A.dustSpots = dustSpots;
    }

    // ---- melted butter puddles (slick), just off the ideal line
    {
      const spots = [[S.trayOut + 18, -6.3, 2.7, 0.2], [sAt(-82, -71), -6.0, 2.6, 2.5]];
      for (const [s, off, rad, ang] of spots) {
        const q = track.place(s, off);
        const sp = SP(q.x, q.z, rad, meltMat, { lump: 0.35, stretch: 1.5, angle: q.angle + ang * 0.1, y: 0.13, thick: 0.1 });
        K.surface('slick', { poly: sp.poly });
        // a softening pat of butter at the outer edge of the puddle
        const pt = track.place(s + 1.5, off + Math.sign(off) * 2.4);
        const pat = M(new K.RoundedBoxGeometry(2.8, 0.8, 2.2, 2, 0.35), butterMat, pt.x, 0.3, pt.z, { ry: r() * 3 });
        pat.scale.y = 0.75;
        for (let i = 0; i < 4; i++) SP(q.x + r.range(-6, 6), q.z + r.range(-6, 6), r.range(0.3, 0.7), meltMat, { y: 0.1, thick: 0.06, n: 14 });
      }
    }

    // ---- the honey drip (sticky) from a jar inside the U, onto the edge of the east leg
    {
      const jx = 37, jz = -31;
      const s = sAt(48, -26), q = track.place(s, 6.2);
      const sp = SP(q.x, q.z, 3.6, honeyMat, { lump: 0.4, stretch: 1.5, angle: q.angle, y: 0.14, thick: 0.18 });
      K.surface('sticky', { poly: sp.poly });
      for (let i = 1; i < 5; i++) SP(jx + (q.x - jx) * i / 5 + r.range(-0.6, 0.6), jz + (q.z - jz) * i / 5 + r.range(-0.6, 0.6), r.range(0.5, 1.0), honeyMat, { y: 0.1, thick: 0.12, n: 16 });
      // glass jar, two-thirds full
      const glass = glassMat;
      M(K.lathe([[3.6, 0], [4.2, 0.4], [4.3, 1.2], [4.3, 8.0], [3.7, 8.8], [3.6, 9.8], [3.9, 10.0], [3.9, 10.6], [3.4, 10.6], [3.3, 8.9], [3.9, 8.0], [3.95, 1.2], [3.6, 0.6], [0.001, 0.5]], 36), glass, jx, 0, jz, { cast: false });
      M(new T.CylinderGeometry(3.9, 3.9, 6.6, 32), honeyMat, jx, 3.85, jz);
      M(new T.TorusGeometry(3.65, 0.22, 8, 32), glassMat, jx, 10.4, jz, { rx: PI / 2, cast: false });
      const lc = cv(512, 96, (g, w, h) => {
        g.fillStyle = '#f6e7c2'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#7a4a10'; g.font = 'italic 700 40px Georgia, serif'; g.textAlign = 'center';
        for (let k = 0; k < 3; k++) g.fillText('Wild Honey', 85 + k * 171, 60);
      });
      M(new T.CylinderGeometry(4.36, 4.36, 3, 32, 1, true), K.std({ map: tex(lc), roughness: 0.75 }), jx, 4.4, jz, { ry: 0.3 });
      // lid off, lying beside; a dipper resting on the rim
      M(new T.CylinderGeometry(4.0, 4.0, 1.1, 24), K.metal(0xc89a3a, 0.3), jx - 7, 0.55, jz - 3);
      const dip = new T.Group();
      const stick = new T.Mesh(new T.CylinderGeometry(0.35, 0.35, 13, 10), woodMat); stick.position.y = 6.5; dip.add(stick);
      for (let i = 0; i < 4; i++) { const ring = new T.Mesh(new T.CylinderGeometry(1.1 - i * 0.12, 1.1 - i * 0.12, 0.5, 14), woodMat); ring.position.y = 0.6 + i * 0.75; dip.add(ring); }
      const glob = new T.Mesh(new T.SphereGeometry(1.3, 14, 10), honeyMat); glob.position.y = 1.4; glob.scale.set(1, 1.4, 1); dip.add(glob);
      dip.position.set(jx + 5.5, 1.6, jz + 2.5); dip.rotation.set(0.1, 0.5, 1.35);
      B(dip);
      AO(jx, jz, 5.2, 5.2, 0.45); AO(jx - 7, jz - 3, 4.4, 4.4, 0.35);
      K.circle(jx, jz, 4.4, 9.5); K.circle(jx - 7, jz - 3, 4, 1.2);
    }

    // ================================================================== landmarks
    // ---- stand mixer at the north edge (mint enamel, chrome bowl of batter, the beater turning)
    {
      const { x: mx, z: mz } = MIXER;
      const enamel = K.phys({ color: 0x9ad6c4, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08 });
      const chrome = steel;
      // base plate
      M(slab(roundRect(22, 32, 7), 4.2, 0.9, 16), enamel, mx, 0, mz);
      // column: side silhouette extruded across x
      const col = new T.Shape();
      col.moveTo(15, 3); col.lineTo(5.5, 3); col.bezierCurveTo(4.6, 10, 5.4, 20, 7.2, 29); col.lineTo(15.5, 31.5); col.bezierCurveTo(16.4, 22, 16.2, 10, 15, 3);
      const cg = new T.ExtrudeGeometry(col, { depth: 10, bevelEnabled: true, bevelThickness: 1.8, bevelSize: 1.6, bevelSegments: 4, curveSegments: 14 });
      cg.translate(0, 0, -5); cg.rotateY(PI / 2);
      M(cg, enamel, mx, 0, mz);
      // head: a rounded body along z
      const head = new T.Group();
      const hp = [[0.001, 0], [4.6, 0.3], [6.4, 2], [7.5, 6], [7.8, 14], [7.4, 22], [6.3, 27], [4.0, 29.5], [0.001, 30.3]];
      const hg = K.lathe(hp, 40); hg.rotateX(PI / 2);
      const hm = new T.Mesh(hg, enamel); hm.scale.set(0.84, 1, 1); head.add(hm);
      const band = new T.Mesh(new T.TorusGeometry(7.82, 0.32, 8, 40), chrome); band.scale.set(0.84, 1, 1); band.position.z = 12; head.add(band);
      const nose = new T.Mesh(new T.CylinderGeometry(2.4, 2.6, 1.2, 24), chrome); nose.rotation.x = PI / 2; nose.position.z = 30.2; head.add(nose);
      head.position.set(mx, 35.5, mz - 16.5);
      B(head);
      // speed lever
      M(new K.RoundedBoxGeometry(0.6, 0.6, 5, 2, 0.25), chrome, mx + 7.2, 31, mz - 9, { rx: 0.2 });
      // chrome bowl on the base
      const bowlZ = mz + 7;
      const bp = [[0.001, 0], [5.2, 0], [6, 0.4], [8.4, 3], [10.2, 7], [11, 11], [11.3, 14], [11.8, 14.4], [11.5, 14.8], [10.8, 14.3], [10.5, 11], [9.7, 7], [7.9, 3.4], [5.5, 1], [0.001, 1]];
      M(K.lathe(bp, 48), steel, mx, 4.2, bowlZ);
      M(new T.TorusGeometry(2.4, 0.45, 8, 20, PI), chrome, mx + 10.6, 13, bowlZ + 3.5, { ry: -0.9, rz: 0 });
      // batter with a swirl
      const swirl = batterTex('#f2dcab', 'rgba(255,246,222,0.5)', 'rgba(196,150,84,0.3)', 33);
      M(new T.CircleGeometry(10.3, 40), K.phys({ map: tex(swirl), roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.3 }), mx, 14.1, bowlZ, { rx: -PI / 2 });
      // flat beater on its shaft (turns in animate)
      const beater = new T.Group();
      const bsh = new T.Shape();
      bsh.moveTo(0, 0); bsh.bezierCurveTo(5.5, 0.5, 5.4, 6, 3, 9.5); bsh.lineTo(-3, 9.5); bsh.bezierCurveTo(-5.4, 6, -5.5, 0.5, 0, 0);
      const hole = new T.Path();
      hole.moveTo(0, 1.4); hole.bezierCurveTo(4, 1.8, 4, 5.6, 2.2, 8.2); hole.lineTo(0.5, 8.2); hole.lineTo(0.5, 3); hole.lineTo(-0.5, 3); hole.lineTo(-0.5, 8.2); hole.lineTo(-2.2, 8.2); hole.bezierCurveTo(-4, 5.6, -4, 1.8, 0, 1.4);
      bsh.holes.push(hole);
      const bgeo = new T.ExtrudeGeometry(bsh, { depth: 0.5, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.15, bevelSegments: 2, curveSegments: 10 });
      bgeo.translate(0, 0, -0.25);
      const bmesh = new T.Mesh(bgeo, K.phys({ color: 0xf4f3ee, roughness: 0.3, clearcoat: 0.6 })); bmesh.position.y = 6.5; beater.add(bmesh);
      const shaft = new T.Mesh(new T.CylinderGeometry(0.45, 0.45, 12, 10), chrome); shaft.position.y = 21; beater.add(shaft);
      beater.position.set(mx, 0, bowlZ);
      K.add(beater);
      A.beater = beater;
      // made-up badge on the base front
      const badge = cv(256, 64, (g, w, h) => {
        g.fillStyle = '#e6e8ec'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#3b6f66'; g.font = 'italic 700 40px Georgia, serif'; g.textAlign = 'center'; g.fillText('Fluffwerk', w / 2, 46);
      });
      M(new T.PlaneGeometry(8, 2), K.std({ map: tex(badge), roughness: 0.3, metalness: 0.4 }), mx, 2.3, mz + 16.25, { cast: false });
      AO(mx, mz, 13, 18, 0.56); AO(mx, mz - 10, 9, 8, 0.4);
      K.box(mx, mz, 11.5, 16.5, 0, 5); K.circle(mx, bowlZ, 11.8, 19); K.box(mx, mz - 10, 7.5, 6.5, 0, 44);
      // flour dusting and a spilled measuring of sugar round its feet
      for (let i = 0; i < 5; i++) heap(mx + r.range(-16, 16), mz + r.range(10, 22), r.range(1.6, 3), r.range(1.1, 2.2), 0.28, r() * 3);
    }

    // ---- mixing bowl of chocolate batter in the middle of the U, a spatula resting in it
    {
      const bx = 11, bz = -27;
      const BS = 1.0;
      const prof = [[0.001, 0.6], [6.5, 0.6], [7.4, 0], [8.6, 0], [9.2, 0.8], [12, 3.5], [14.2, 7.5], [15.2, 11.2], [15.4, 12.4], [15.0, 12.7], [14.5, 12.2], [13.6, 8.2], [11.4, 4.4], [7.5, 2.0], [0.001, 1.8]].map(([a, b]) => [a * BS, b * BS]);
      const g = K.lathe(prof, 64);
      const col = new Float32Array(g.attributes.position.count * 3);
      const pos = g.attributes.position;
      const c1 = new T.Color(0x9fc4e4), c2 = new T.Color(0xfbfaf6);
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i), rr = Math.hypot(pos.getX(i), pos.getZ(i));
        // outside pastel blue, inside and the rim white
        const inside = rr < 15.0 * BS - (12.4 - y) * 0.13 - 0.25 && y > 1.5;
        const c = inside || y > 12.0 * BS ? c2 : c1;
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
      g.setAttribute('color', new T.BufferAttribute(col, 3));
      M(g, K.ceramic(0xffffff, { vertexColors: true }), bx, 0, bz);
      const bat = batterTex('#5a321b', 'rgba(140,92,60,0.35)', 'rgba(30,14,6,0.3)', 34);
      M(new T.CircleGeometry(13.9, 48), K.phys({ map: tex(bat), roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.15 }), bx, 9.4, bz, { rx: -PI / 2 });
      // silicone spatula: red head in the batter, white handle over the rim
      const sp = new T.Group();
      const head = new T.Mesh(new K.RoundedBoxGeometry(5.2, 0.5, 4, 3, 0.24), K.phys({ color: 0xe3473a, roughness: 0.45, clearcoat: 0.3 })); sp.add(head);
      const hnd = new T.Mesh(new K.RoundedBoxGeometry(17, 0.9, 1.3, 2, 0.4), K.plastic(0xf6f4ef, 0.35)); hnd.position.x = 10.5; sp.add(hnd);
      const smear = new T.Mesh(new K.RoundedBoxGeometry(3.4, 0.3, 3.2, 2, 0.14), K.phys({ color: 0x5a321b, roughness: 0.2, clearcoat: 1 })); smear.position.set(-0.4, 0.32, 0); sp.add(smear);
      sp.position.set(bx + 4, 10.4, bz + 3); sp.rotation.set(0, -0.55, 0.42);
      B(sp);
      AO(bx, bz, 13, 13, 0.56);
      K.circle(bx, bz, 15.2, 13);
      // drips of batter on the worktop
      const batMat = K.phys({ color: 0x5a321b, roughness: 0.2, clearcoat: 1 });
      for (let i = 0; i < 5; i++) { const a = r.range(0.2, 1.4), d = r.range(16.5, 20); SP(bx + Math.cos(a) * d, bz + Math.sin(a) * d, r.range(0.5, 1.2), batMat, { y: 0.1, thick: 0.12, n: 16 }); }
    }

    // ---- balloon whisk lying between the bowl and the mixer (balloon on the worktop, handle end resting)
    {
      const wx = 13, wz = -51, wa = 0.18;
      const grp = new T.Group();
      const wire = steel;
      const wg = [];
      for (let i = 0; i < 6; i++) {
        const th = (i / 6) * PI;
        const pts = [];
        for (let k = 0; k < 32; k++) {
          const f = (k / 32) * TAU;
          const x = 13 * (1 - Math.cos(f)) / 2, lat = 3.5 * Math.sin(f) * Math.sqrt((1 - Math.cos(f)) / 2);
          pts.push(new T.Vector3(x, lat * Math.cos(th), lat * Math.sin(th)));
        }
        wg.push(new T.TubeGeometry(new T.CatmullRomCurve3(pts, true), 48, 0.15, 5, true));
      }
      const wm = new T.Mesh(BU.mergeGeometries(wg, false), wire); grp.add(wm);
      const handle = new T.Mesh(new T.CylinderGeometry(1.0, 1.25, 11, 16), steel); handle.rotation.z = PI / 2; handle.position.set(-5.5, 0, 0); grp.add(handle);
      const cap = new T.Mesh(new T.SphereGeometry(1.0, 14, 10), steel); cap.position.set(-11, 0, 0); grp.add(cap);
      const ring = new T.Mesh(new T.TorusGeometry(1.2, 0.25, 8, 16), steel); ring.rotation.y = PI / 2; ring.position.set(-11.9, 0, 0); grp.add(ring);
      grp.position.set(wx, 2.3, wz); grp.rotation.order = 'YXZ'; grp.rotation.y = -wa; grp.rotation.z = 0.115;
      B(grp);
      AO(wx + 1, wz, 13, 4, 0.3, wa);
      K.capsule(wx - 10 * Math.cos(wa), wz - 10 * Math.sin(wa), wx + 11 * Math.cos(wa), wz + 11 * Math.sin(wa), 3.0, 6.5);
    }

    // ---- butter block in its half-open wrapper (south infield, by the start)
    {
      const bx = -27, bz = 47, ba = -0.12;
      const wrapC = cv(512, 352, (g, w, h) => {
        g.fillStyle = '#f7f1df'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#e7c868'; g.fillRect(0, 0, w, 26); g.fillRect(0, h - 26, w, 26);
        g.strokeStyle = 'rgba(160,140,100,0.35)'; g.lineWidth = 2;
        for (const x of [120, 392]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
        for (const y of [96, 256]) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
        g.fillStyle = '#2f5aa0'; g.textAlign = 'center';
        g.font = '700 46px Georgia, serif'; g.fillText('Creamery', w / 2, 160);
        g.font = 'italic 30px Georgia, serif'; g.fillText('sweet cream butter', w / 2, 204);
        g.font = '700 22px Rubik, sans-serif'; g.fillText('250 g  ·  unsalted', w / 2, 238);
        g.strokeStyle = '#2f5aa0'; g.lineWidth = 4; g.strokeRect(140, 110, 232, 144);
      });
      const wrapMat = K.std({ map: tex(wrapC), roughness: 0.55, metalness: 0.15, side: T.DoubleSide });
      // the unfolded paper on the worktop
      const pg = new T.PlaneGeometry(30, 20, 10, 6); pg.rotateX(-PI / 2);
      const pp2 = pg.attributes.position;
      for (let k = 0; k < pp2.count; k++) { const x = pp2.getX(k), z = pp2.getZ(k); pp2.setY(k, 0.06 + Math.max(0, Math.abs(x) - 11) * 0.12 + Math.max(0, Math.abs(z) - 7) * 0.1); }
      pg.computeVertexNormals();
      M(pg, wrapMat, bx, 0, bz, { ry: ba, cast: false });
      // the block: wrapped end and bare end
      const blk = new T.Group();
      const bare = new T.Mesh(new K.RoundedBoxGeometry(10, 6.2, 8.4, 3, 0.5), butterMat); bare.position.set(3.2, 3.1, 0); blk.add(bare);
      const wrapped = new T.Mesh(new K.RoundedBoxGeometry(8.4, 6.6, 8.8, 2, 0.35), wrapMat); wrapped.position.set(-5.4, 3.3, 0); blk.add(wrapped);
      // knife marks: a few butter curls on top
      for (let i = 0; i < 3; i++) { const cu = new T.Mesh(new T.TorusGeometry(0.7, 0.32, 8, 14, PI * 1.4), butterMat); cu.position.set(4 + i * 1.6, 6.4, r.range(-2.5, 2.5)); cu.rotation.set(PI / 2, 0, r() * 3); blk.add(cu); }
      blk.position.set(bx, 0.06, bz); blk.rotation.y = ba;
      B(blk);
      // butter knife resting against it
      const knife = new T.Group();
      const blade = new T.Mesh(new K.RoundedBoxGeometry(9, 0.25, 1.7, 2, 0.1), steel); blade.position.x = 4.5; knife.add(blade);
      const kh = new T.Mesh(new K.RoundedBoxGeometry(8.5, 0.9, 1.3, 3, 0.4), woodMat); kh.position.x = -4; knife.add(kh);
      const smear = new T.Mesh(new K.RoundedBoxGeometry(3.5, 0.2, 1.3, 2, 0.1), butterMat); smear.position.set(6.5, 0.2, 0); knife.add(smear);
      knife.position.set(bx + 6, 0.5, bz + 9); knife.rotation.y = 0.5;
      B(knife);
      AO(bx, bz, 9.5, 6.5, 0.45, -ba);
      K.box(bx, bz, 9.6, 4.8, -ba, 6.5);
    }

    // ---- cooling rack of chocolate-chip cookies (west infield)
    const cookieTex = (() => {
      const c = TX.paint(256, 256, (x, y, u, v, o) => {
        const d = Math.hypot(u - 0.5, v - 0.5) * 2;
        const n = r();
        const k = (n < 0.05 ? 0.85 : 1) * (1 - Math.max(0, d - 0.75) * 0.9);
        o[0] = 214 * k; o[1] = 158 * k; o[2] = 88 * k;
      });
      const g = c.getContext('2d');
      g.strokeStyle = 'rgba(120,70,30,0.35)'; g.lineWidth = 3;
      for (let i = 0; i < 9; i++) { g.beginPath(); const a = r() * TAU, rr = 30 + r() * 60; g.moveTo(128 + Math.cos(a) * rr, 128 + Math.sin(a) * rr); g.lineTo(128 + Math.cos(a + 0.4) * (rr + 20), 128 + Math.sin(a + 0.4) * (rr + 20)); g.stroke(); }
      return tex(c);
    })();
    const cookieMat = K.std({ map: cookieTex, roughness: 0.8 });
    const cookieGeo = (() => {
      const g = K.lathe([[0.001, 0], [0.92, 0], [1.0, 0.12], [0.98, 0.26], [0.8, 0.34], [0.4, 0.38], [0.001, 0.39]], 24);
      // top-down uvs for the texture
      const p = g.attributes.position, uv = g.attributes.uv;
      for (let k = 0; k < p.count; k++) uv.setXY(k, 0.5 + p.getX(k) * 0.5, 0.5 + p.getZ(k) * 0.5);
      return g;
    })();
    const cookies = [], cchips = [];
    const addCookie = (x, y, z, rad = 3.6, tilt = 0) => {
      cookies.push({ x, y, z, ry: r() * TAU, rx: tilt, sx: rad, sy: rad * 0.8, sz: rad });
      for (let k = 0; k < 5; k++) { const a = r() * TAU, d = Math.sqrt(r()) * rad * 0.7; cchips.push({ x: x + Math.cos(a) * d, y: y + rad * 0.3, z: z + Math.sin(a) * d, ry: r() * TAU, rx: r.range(-0.4, 0.4), s: 0.75 }); }
    };
    {
      const rx0 = -72, rz0 = 6, hw = 13, hd = 22;
      const wire = steel;
      const wg = [];
      const ry = 1.6;
      for (let i = 0; i <= 12; i++) { const x = rx0 - hw + i * (hw * 2 / 12); wg.push(xf(new T.CylinderGeometry(0.16, 0.16, hd * 2, 5), { x, y: ry, z: rz0, rx: PI / 2 })); }
      for (let j = 0; j <= 5; j++) { const z = rz0 - hd + j * (hd * 2 / 5); wg.push(xf(new T.CylinderGeometry(0.2, 0.2, hw * 2, 5), { x: rx0, y: ry - 0.3, z, rz: PI / 2 })); }
      for (const sx of [-1, 1]) wg.push(xf(new T.CylinderGeometry(0.3, 0.3, hd * 2, 6), { x: rx0 + sx * hw, y: ry, z: rz0, rx: PI / 2 }));
      for (const sz of [-1, 1]) wg.push(xf(new T.CylinderGeometry(0.3, 0.3, hw * 2, 6), { x: rx0, y: ry, z: rz0 + sz * hd, rz: PI / 2 }));
      for (const sx of [-1, 1]) for (const sz of [-1, 0.33, -0.33, 1]) wg.push(xf(new T.CylinderGeometry(0.25, 0.25, ry, 5), { x: rx0 + sx * (hw - 1), y: ry / 2, z: rz0 + sz * (hd - 1) }));
      B(new T.Mesh(BU.mergeGeometries(wg.map((g) => g.toNonIndexed()), false), wire));
      for (let i = 0; i < 2; i++) for (let j = 0; j < 5; j++) addCookie(rx0 - 6 + i * 12 + r.range(-0.6, 0.6), ry + 0.2, rz0 - 17 + j * 8.6 + r.range(-0.6, 0.6));
      AO(rx0, rz0, hw + 1.5, hd + 1.5, 0.3);
      K.box(rx0, rz0, hw + 0.3, hd + 0.3, 0, 2.6);
      // crumbs and an oat or two round it
      A.crumbSpots = [[rx0 + 16, rz0 - 10], [rx0 - 15, rz0 + 14], [rx0 + 4, rz0 + 25]];
    }

    // ---- second sheet pan (dark non-stick) of dough balls in the east infield
    {
      const cx = 96, cz = 5, hl = 27, hw = 19.5, rim = 2.4;
      const dark = K.phys({ color: 0x3a3d42, roughness: 0.38, metalness: 0.35, clearcoat: 0.5, clearcoatRoughness: 0.3 });
      const g = [];
      g.push(xf(new T.BoxGeometry(hw * 2, 0.25, hl * 2), { x: cx, y: 0.125, z: cz }));
      for (const s of [-1, 1]) {
        g.push(xf(new T.BoxGeometry(hw * 2, rim - 0.4, 0.3), { x: cx, y: (rim - 0.4) / 2, z: cz + s * (hl - 0.15) }));
        g.push(xf(new T.BoxGeometry(0.3, rim - 0.4, hl * 2), { x: cx + s * (hw - 0.15), y: (rim - 0.4) / 2, z: cz }));
        g.push(xf(new T.CylinderGeometry(0.42, 0.42, hw * 2, 10), { x: cx, y: rim - 0.42, z: cz + s * (hl - 0.15), rz: PI / 2 }));
        g.push(xf(new T.CylinderGeometry(0.42, 0.42, hl * 2, 10), { x: cx + s * (hw - 0.15), y: rim - 0.42, z: cz, rx: PI / 2 }));
      }
      B(new T.Mesh(BU.mergeGeometries(g.map((q) => q.index ? q.toNonIndexed() : q), false), dark));
      // parchment lining
      const lg = new T.PlaneGeometry(hw * 2 - 3, hl * 2 - 3, 8, 10); lg.rotateX(-PI / 2);
      const uv = lg.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * 1.1 + 0.3, uv.getY(k) * 1.5);
      M(lg, paperMat, cx, 0.3, cz, { ry: 0.02, cast: false });
      const dough = [], dchips = [];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) {
        const x = cx - 11 + i * 11, z = cz - 18 + j * 12;
        dough.push({ x, y: 1.9, z, ry: r() * TAU, sx: 2.6, sy: 2.0, sz: 2.6 });
        for (let k = 0; k < 4; k++) { const a = r() * TAU, d = r() * 1.7; dchips.push({ x: x + Math.cos(a) * d, y: 1.9 + 2.0 * Math.sqrt(Math.max(0, 1 - (d / 2.6) ** 2)) - 0.4, z: z + Math.sin(a) * d, ry: r() * TAU, rx: r.range(-0.6, 0.6), s: 0.8 }); }
      }
      K.instances(new T.SphereGeometry(1, 18, 12), A.doughMat, dough);
      K.instances(chipGeo, chocMat, dchips);
      AO(cx, cz, hw + 2, hl + 2, 0.45);
      const rh = rim + 0.1;
      K.box(cx, cz - hl + 0.4, hw, 0.5, 0, rh); K.box(cx, cz + hl - 0.4, hw, 0.5, 0, rh);
      K.box(cx - hw + 0.4, cz, 0.5, hl, 0, rh); K.box(cx + hw - 0.4, cz, 0.5, hl, 0, rh);
      // a cookie that rolled off
      addCookie(cx + 3, 0.05, cz + hl + 6, 3.4);
    }

    // ---- egg box (east infield, north end), two eggs used, shells about
    {
      const ex = 96, ez = -44;
      const pulpT = TX.mottledTextures({ size: 128, a: 0xcfc6b8, b: 0xc2b9aa, seed: 23, period: 16, bump: 5, speck: 0.08 });
      const pulp = K.std({ color: 0xc9c0b1, normalMap: pulpT.normalMap, normalScale: V2(1.2), roughness: 0.95 });
      const grp = new T.Group();
      const base = new T.Mesh(new K.RoundedBoxGeometry(21, 4.6, 14, 3, 1.2), pulp); base.position.y = 2.3; grp.add(base);
      // the lid lying open behind it, inside up
      const lid = new T.Mesh(new K.RoundedBoxGeometry(21, 2.6, 13.4, 3, 1.1), pulp); lid.position.set(0, 1.3, -14.2); grp.add(lid);
      const lidIn = new T.Mesh(new T.PlaneGeometry(19, 11.4), K.std({ color: 0xa79e90, roughness: 1 })); lidIn.rotation.x = -PI / 2; lidIn.position.set(0, 2.62, -14.2); grp.add(lidIn);
      // cups: dark hollows, four eggs
      const eggs = [];
      const cupG = new T.CircleGeometry(2.6, 20); cupG.rotateX(-PI / 2);
      const hollow = K.std({ color: 0x8f877a, roughness: 1 });
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
        const x = -6.6 + i * 6.6, z = -3.3 + j * 6.6;
        const cm = new T.Mesh(cupG, hollow); cm.position.set(x, 4.62, z); grp.add(cm);
        if (!(i === 2 && j === 0) && !(i === 0 && j === 1)) eggs.push([x, z]);
      }
      const eggMat = K.phys({ color: 0xe2b98e, roughness: 0.55, clearcoat: 0.15 });
      for (const [x, z] of eggs) { const e = new T.Mesh(new T.SphereGeometry(2.55, 22, 16), eggMat); e.scale.set(1, 1.3, 1); e.position.set(x, 5.6, z); grp.add(e); }
      grp.position.set(ex, 0, ez); grp.rotation.y = 0.08;
      B(grp);
      AO(ex - 0.5, ez - 7, 12, 14, 0.4, -0.08);
      K.box(ex, ez, 10.6, 7.2, -0.08, 8); K.box(ex - 1.1, ez - 14.1, 10.6, 6.8, -0.08, 2.7);
      A.shellSpots = [[ex + 16, ez + 4], [ex - 15, ez + 8], [11 + 18, -27 + 10]];
    }

    // ---- flour bag spilling at the outside of the south-east corner
    {
      const fx = 141, fz = 83;
      const fa = Math.atan2(33 - fz, 96 - fx); // the open end points at the corner
      const kraft = cv(512, 256, (g, w, h) => {
        g.fillStyle = '#efe7d6'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#c23b2e'; g.fillRect(0, 0, w, 20); g.fillRect(0, h - 20, w, 20);
        g.fillStyle = '#c23b2e'; g.font = '110px "Lilita One", Impact, sans-serif'; g.textAlign = 'center'; g.fillText('FLOUR', w * 0.55, 150);
        g.fillStyle = '#7a5a2a'; g.font = '700 24px Rubik, sans-serif'; g.fillText('GOLDEN MILL  ·  TYPE 550  ·  1 kg', w * 0.5, 205);
        g.strokeStyle = '#b8902e'; g.lineWidth = 5;
        for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(28 + k * 8, 190); g.quadraticCurveTo(20 + k * 9, 120, 40 + k * 6, 50); g.stroke(); }
      });
      const bagMat = K.std({ map: tex(kraft), roughness: 0.9 });
      const plain = K.std({ color: 0xeee5d2, roughness: 0.92, side: T.DoubleSide });
      const bag = new T.Group();
      const body = new T.Mesh(new K.RoundedBoxGeometry(20, 14, 9, 4, 2.2), [plain, plain, plain, plain, bagMat, plain]);
      body.rotation.x = -PI / 2; // printed face up
      body.position.y = 4.5; bag.add(body);
      // crumpled open end
      for (let i = 0; i < 6; i++) {
        const f = new T.Mesh(new T.PlaneGeometry(4.2, 9 + r() * 3), plain);
        f.position.set(10.2 + r.range(0, 1.6), 4.5 + r.range(-1.5, 2.5), r.range(-4.5, 4.5));
        f.rotation.set(r.range(-0.5, 0.5), PI / 2 + r.range(-0.6, 0.6), r.range(-0.4, 0.4));
        bag.add(f);
      }
      bag.position.set(fx, 0, fz); bag.rotation.y = -fa;
      B(bag);
      AO(fx, fz, 11.5, 8.5, 0.5, fa);
      K.box(fx, fz, 10.5, 7.5, fa, 9);
      // flour pouring out towards the corner
      const dx = Math.cos(fa), dz = Math.sin(fa);
      for (let i = 0; i < 7; i++) {
        const d = 11 + i * 3.1;
        heap(fx + dx * d + r.range(-0.8, 0.8), fz + dz * d + r.range(-0.8, 0.8), 5.2 - i * 0.4, 3.8 - i * 0.3, 1.5 - i * 0.17, fa + r.range(-0.3, 0.3));
      }
      A.flourBag = [fx, fz];
    }

    // ---- kitchen timer at the outside of the north-east corner (dial turns down)
    {
      const tx = 148, tz = -86;
      const body = K.phys({ color: 0xd8463a, roughness: 0.25, clearcoat: 0.8 });
      M(K.lathe([[0.001, 0], [4.2, 0], [4.6, 0.6], [4.7, 3.4], [4.4, 4.2], [3.8, 4.6], [0.001, 4.7]], 40), body, tx, 0, tz);
      const dc = cv(256, 256, (g) => {
        g.fillStyle = '#fbf8f0'; g.beginPath(); g.arc(128, 128, 126, 0, TAU); g.fill();
        g.fillStyle = '#222'; g.textAlign = 'center'; g.font = '700 26px Rubik, sans-serif';
        for (let i = 0; i < 60; i++) {
          const a = (i / 60) * TAU - PI / 2, l = i % 5 ? 10 : 20;
          g.fillRect(0, 0, 0, 0);
          g.save(); g.translate(128, 128); g.rotate(a); g.fillRect(100 - l, -1.5, l, 3); g.restore();
          if (i % 10 === 0) g.fillText(String(i), 128 + Math.cos(a) * 72, 128 + Math.sin(a) * 72 + 9);
        }
      });
      const dial = new T.Group();
      const face = new T.Mesh(new T.CircleGeometry(3.7, 40), K.std({ map: tex(dc), roughness: 0.4 })); face.rotation.x = -PI / 2; dial.add(face);
      const knob = new T.Mesh(new K.RoundedBoxGeometry(5.6, 1.2, 1.1, 2, 0.4), K.plastic(0xf4f1ea, 0.3)); knob.position.y = 0.6; dial.add(knob);
      dial.position.set(tx, 4.72, tz);
      K.add(dial);
      A.timerDial = dial;
      M(new T.ConeGeometry(0.5, 1.2, 3), K.std({ color: 0x222222 }), tx, 4.8, tz + 4.3, { rx: PI / 2 });
      AO(tx, tz, 5.2, 5.2, 0.5);
      K.circle(tx, tz, 4.7, 5);
    }

    // ---- measuring cups (one tipped over, sugar spilling) and measuring spoons on a ring
    {
      const cupMat = steel;
      const cup = (x, z, rad, h, tip = 0, ry = 0) => {
        const grp = new T.Group();
        const c = new T.Mesh(K.lathe([[0.001, 0], [rad * 0.8, 0], [rad * 0.92, 0.2], [rad, h], [rad * 1.04, h], [rad * 0.96, h - 0.1], [rad * 0.88, 0.3], [0.001, 0.25]], 32), cupMat);
        grp.add(c);
        const hd = new T.Mesh(new K.RoundedBoxGeometry(rad * 1.6, 0.22, 1.5, 2, 0.1), cupMat); hd.position.set(rad + rad * 0.75, h - 0.1, 0); grp.add(hd);
        grp.position.set(x, tip ? rad * 0.98 : 0, z); grp.rotation.order = 'YXZ'; grp.rotation.y = ry; grp.rotation.z = tip;
        B(grp);
        AO(x, z, rad + 0.8, rad + 0.8, 0.4);
      };
      cup(-80, 44, 4.4, 3.6, 0, 0.3); cup(-68.5, 46, 3.5, 3, 0, 2.2); cup(-74, 34, 2.9, 2.6, PI / 2 - 0.15, -0.6);
      K.circle(-80, 44, 4.5, 4); K.circle(-68.5, 46, 3.6, 3.4); K.circle(-74, 34, 3.2, 5.8);
      // spoons on a ring, fanned out (flat: no collider)
      const sx = -64, sz = -46;
      M(new T.TorusGeometry(1.6, 0.18, 6, 20), steel, sx, 0.18, sz, { rx: PI / 2 });
      for (let i = 0; i < 4; i++) {
        const a = -0.6 + i * 0.42, rad = 1.2 + i * 0.25;
        const sg = new T.Group();
        const h = new T.Mesh(new K.RoundedBoxGeometry(8, 0.2, 1.0, 2, 0.08), steel); h.position.x = 4.5; sg.add(h);
        const b = new T.Mesh(new T.SphereGeometry(1, 16, 8, 0, TAU, PI / 2, PI / 2), steel); b.scale.set(rad, 0.55 * rad, rad); b.position.set(9 + rad, 0.55 * rad, 0); b.rotation.x = PI; sg.add(b);
        sg.position.set(sx, 0.1, sz); sg.rotation.y = a;
        B(sg);
      }
      AO(sx + 7, sz - 2, 8, 5, 0.25, -0.1);
    }

    // ---- glass bowl of sprinkles (north-west of the U)
    {
      const bx = -11, bz = -63;
      M(K.lathe([[0.001, 0.3], [3.4, 0.3], [3.6, 0], [4.2, 0], [5.6, 2.2], [6.1, 4.2], [5.8, 4.3], [5.3, 2.4], [3.6, 0.7], [0.001, 0.7]], 40), glassMat, bx, 0, bz, { cast: false });
      const list = [];
      for (let i = 0; i < (lowQ ? 120 : 220); i++) { const a = r() * TAU, d = Math.sqrt(r()) * 5.0; list.push({ x: bx + Math.cos(a) * d, y: 3.0 + r() * 0.8 - d * 0.1, z: bz + Math.sin(a) * d, ry: r() * TAU, rx: r() * 3, rz: r() * 3, s: r.range(0.9, 1.1), color: r.pick(sprinkleCols) }); }
      for (let i = 0; i < 40; i++) { const a = r() * TAU, d = 7 + r() * 9; list.push({ x: bx + Math.cos(a) * d, y: 0.18, z: bz + Math.sin(a) * d * 0.7, ry: r() * TAU, s: r.range(0.9, 1.1), color: r.pick(sprinkleCols) }); }
      sprinkles.push(...list);
      AO(bx, bz, 6, 6, 0.4);
      K.circle(bx, bz, 6, 4.3);
    }

    // ---- a rolled-up silicone baking mat and a wooden spoon (west infield, north)
    {
      const sx = -80, sz = -24;
      const spoon = new T.Group();
      const hnd = new T.Mesh(new T.CylinderGeometry(0.6, 0.75, 24, 12), woodMat); hnd.rotation.z = PI / 2; hnd.position.x = -12; spoon.add(hnd);
      const bowl = new T.Mesh(new T.SphereGeometry(1, 20, 12), woodMat); bowl.scale.set(3.8, 0.9, 2.8); bowl.position.x = 3; spoon.add(bowl);
      spoon.position.set(sx, 0.9, sz); spoon.rotation.y = 0.9;
      B(spoon);
      AO(sx - 6, sz + 7, 13, 3, 0.3, 0.9);
      // the box the parchment came from, lying in the infield with the roll poking out
      const ma = 1.42, mx = -64, mz = -14, dx = Math.cos(ma), dz = Math.sin(ma);
      const boxC = cv(512, 128, (g, w, h) => {
        g.fillStyle = '#f7f5ef'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#2f6fb0'; g.fillRect(0, 0, w, 18); g.fillRect(0, h - 18, w, 18);
        g.fillStyle = '#2f6fb0'; g.font = '700 46px Rubik, sans-serif'; g.textAlign = 'left'; g.fillText('BAKING PAPER', 120, 82);
        g.fillStyle = '#e8a43a'; g.beginPath(); g.arc(64, 64, 34, 0, TAU); g.fill();
        g.fillStyle = '#5a321b'; for (const [x, y] of [[54, 52], [74, 60], [60, 76], [78, 78], [48, 70]]) { g.beginPath(); g.arc(x, y, 4.5, 0, TAU); g.fill(); }
        g.fillStyle = '#7a8aa0'; g.font = '20px Rubik, sans-serif'; g.fillText('non-stick · 8 m × 38 cm', 122, 108);
      });
      const boxMat = K.std({ map: tex(boxC), roughness: 0.6 });
      const plainBox = K.std({ color: 0xf2efe7, roughness: 0.65 });
      const bx = new T.Mesh(new T.BoxGeometry(32, 5.4, 5.4), [plainBox, plainBox, boxMat, plainBox, plainBox, plainBox]);
      bx.position.set(mx, 2.7, mz); bx.rotation.y = -ma;
      B(bx);
      const roll = new T.Mesh(new T.CylinderGeometry(2.2, 2.2, 3, 24), paperMat); roll.rotation.z = PI / 2;
      const rg = new T.Group(); rg.add(roll); roll.position.x = 17; rg.position.set(mx, 2.6, mz); rg.rotation.y = -ma;
      B(rg);
      AO(mx, mz, 17.5, 3.6, 0.4, ma);
      K.capsule(mx - dx * 15.5, mz - dz * 15.5, mx + dx * 17, mz + dz * 17, 2.8, 5.4);
    }

    // ---- glass measuring jug of milk (east infield, south)
    {
      const jx = 103, jz = 50;
      M(K.lathe([[5.2, 0], [5.6, 0.3], [5.7, 1.0], [6.0, 13.5], [6.25, 14], [5.95, 14], [5.6, 1.2], [5.1, 0.7], [0.001, 0.6]], 40), glassMat, jx, 0, jz, { cast: false });
      M(new T.CylinderGeometry(5.65, 5.45, 8.6, 36), K.phys({ color: 0xfbfaf6, roughness: 0.22, clearcoat: 0.6, sheen: 1, sheenColor: new T.Color(0xffffff) }), jx, 5.0, jz);
      M(new T.TorusGeometry(3.4, 0.55, 10, 24, PI * 1.1), glassMat, jx + 6.4, 8, jz, { rx: 0, rz: -PI / 2 - 0.15, ry: 0, cast: false });
      const marks = cv(256, 128, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(200,40,40,0.9)'; g.font = '700 16px Rubik, sans-serif'; for (let i = 0; i < 5; i++) { g.fillRect(20, 20 + i * 20, i % 2 ? 14 : 26, 3); if (!(i % 2)) g.fillText(String(500 - i * 100), 52, 27 + i * 20); } });
      M(new T.CylinderGeometry(5.9, 5.9, 9, 36, 1, true, -0.6, 1.2), K.std({ map: tex(marks), transparent: true, depthWrite: false, roughness: 0.4 }), jx, 7.5, jz, { cast: false });
      AO(jx, jz, 6.6, 6.6, 0.45);
      K.circle(jx, jz, 6.2, 14);
    }

    // ---- paper cupcake cases, a pastry brush (south strip, east of the pan)
    {
      const caseG = K.lathe([[0.001, 0], [2.3, 0], [2.4, 0.1], [3.2, 2.6], [3.35, 2.7], [3.0, 2.6], [2.1, 0.3], [0.001, 0.25]], 28);
      // pleats: wobble the radius
      const pp3 = caseG.attributes.position;
      for (let k = 0; k < pp3.count; k++) { const x = pp3.getX(k), z = pp3.getZ(k), a = Math.atan2(z, x), w = 1 + 0.045 * Math.cos(a * 24); pp3.setX(k, x * w); pp3.setZ(k, z * w); }
      caseG.computeVertexNormals();
      const caseCols = [0xf6b8c8, 0xbfe3f2, 0xfbe39a, 0xc9eab8];
      const caseMat = K.std({ color: 0xffffff, roughness: 0.85, side: T.DoubleSide });
      const stack = [];
      for (let i = 0; i < 5; i++) stack.push({ x: 78, y: i * 0.35, z: 49, s: 1, ry: i, color: caseCols[1] });
      stack.push({ x: 88.5, y: 0, z: 54, s: 1, color: caseCols[0] }, { x: 84.5, y: 0, z: 44, s: 1, ry: 1, color: caseCols[2] }, { x: 71.5, y: 0, z: 55, s: 0.95, color: caseCols[3] });
      K.instances(caseG, caseMat, stack, { colors: true });
      for (const [x, z] of [[78, 49], [88.5, 54], [84.5, 44], [71.5, 55]]) { AO(x, z, 3.6, 3.6, 0.35); K.circle(x, z, 3.2, 3); }
      // pastry brush
      const br = new T.Group();
      const hnd = new T.Mesh(new T.CylinderGeometry(0.55, 0.7, 14, 12), woodMat); hnd.rotation.z = PI / 2; hnd.position.x = -7; br.add(hnd);
      const fer = new T.Mesh(new K.RoundedBoxGeometry(2.2, 1.4, 3.0, 2, 0.4), steel); fer.position.x = 1; br.add(fer);
      const bri = new T.Mesh(new K.RoundedBoxGeometry(3.6, 1.0, 3.2, 2, 0.35), K.std({ color: 0xf1e2b8, roughness: 0.95 })); bri.position.x = 3.8; br.add(bri);
      br.position.set(64, 0.75, 47); br.rotation.y = 0.35;
      B(br);
      AO(60, 48.5, 9, 2.4, 0.3, -0.35);
    }

    // ---- recipe card and a pencil on the north margin, a lemon on the west margin
    {
      const card = cv(512, 320, (g, w, h) => {
        g.fillStyle = '#fbf6e9'; g.fillRect(0, 0, w, h);
        g.strokeStyle = 'rgba(80,140,200,0.35)'; g.lineWidth = 2;
        for (let y = 70; y < h; y += 30) { g.beginPath(); g.moveTo(16, y); g.lineTo(w - 16, y); g.stroke(); }
        g.strokeStyle = 'rgba(220,70,70,0.45)'; g.beginPath(); g.moveTo(60, 0); g.lineTo(60, h); g.stroke();
        g.fillStyle = '#5a3a2a'; g.font = 'italic 700 38px Georgia, serif'; g.fillText('Butter Cookies', 76, 52);
        g.font = 'italic 24px Georgia, serif';
        ['250 g soft butter', '125 g sugar, 1 egg', '375 g flour, pinch salt', 'cream, mix, chill 1 h', 'bake 12 min at 180°'].forEach((t, i) => g.fillText(t, 76, 94 + i * 30));
      });
      M(new T.PlaneGeometry(21, 13), K.std({ map: tex(card), roughness: 0.9 }), -84, 0.08, -90.5, { rx: -PI / 2, rz: 0.08, cast: false });
      AO(-84, -90.5, 11.5, 7.5, 0.18, -0.08);
      const pen = new T.Group();
      const body = new T.Mesh(new T.CylinderGeometry(0.42, 0.42, 15, 6), K.std({ color: 0x2f6fb0, roughness: 0.5 })); body.rotation.z = PI / 2; pen.add(body);
      const tip = new T.Mesh(new T.ConeGeometry(0.42, 1.8, 6), K.std({ color: 0xe8c99a, roughness: 0.7 })); tip.rotation.z = -PI / 2; tip.position.x = 8.4; pen.add(tip);
      pen.position.set(-66, 0.42, -90); pen.rotation.y = -0.4;
      B(pen);
      // lemon and a lemon half
      const lemon = K.phys({ color: 0xf2d230, roughness: 0.42, clearcoat: 0.4, normalMap: sugarN.normalMap, normalScale: V2(0.6) });
      const lm = M(new T.SphereGeometry(3.4, 24, 16), lemon, -144, 2.6, -14, { ry: 0.6 }); lm.scale.set(1.3, 0.78, 0.86);
      M(new T.ConeGeometry(0.8, 1.2, 10), lemon, -144 + Math.cos(0.6) * 4.6, 2.6, -14 - Math.sin(0.6) * 4.6, { rz: -PI / 2, ry: 0.6 });
      M(new T.SphereGeometry(3.2, 24, 12, 0, TAU, 0, PI / 2), lemon, -141, 0, -2, { rx: PI });
      const cut = cv(256, 256, (g) => { g.fillStyle = '#f7f0b8'; g.beginPath(); g.arc(128, 128, 126, 0, TAU); g.fill(); g.fillStyle = '#f4dc5a'; for (let i = 0; i < 9; i++) { g.save(); g.translate(128, 128); g.rotate((i / 9) * TAU); g.beginPath(); g.moveTo(10, -4); g.lineTo(100, -26); g.quadraticCurveTo(112, 0, 100, 26); g.lineTo(10, 4); g.fill(); g.restore(); } });
      M(new T.CircleGeometry(3.15, 28), K.phys({ map: tex(cut), roughness: 0.3, clearcoat: 0.6 }), -141, 3.2, -2, { rx: -PI / 2 });
      AO(-144, -14, 5, 3.6, 0.4, -0.6); AO(-141, -2, 3.8, 3.8, 0.4);
      K.circle(-144, -14, 4, 5); K.circle(-141, -2, 3.4, 3.4);
    }

    // ---- striped linen tea towel draped over the south edge
    {
      const tw = cv(256, 512, (g, w, h) => {
        g.fillStyle = '#efe9dc'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#c94a3e'; for (const x of [18, 34, 214, 230]) g.fillRect(x, 0, x === 34 || x === 214 ? 6 : 10, h);
        g.fillStyle = 'rgba(120,100,80,0.08)'; for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
      });
      const g = new T.PlaneGeometry(22, 46, 4, 23);
      const pos = g.attributes.position;
      for (let k = 0; k < pos.count; k++) {
        const x = pos.getX(k), v = pos.getY(k) + 23; // v: 0 at the hanging end .. 46 on the top
        let y, z;
        if (v > 30) { y = 0.15 + Math.sin(x * 0.7) * 0.05; z = 98 - (v - 30); } else { const a = Math.min(1, (30 - v) / 2.2); y = 0.15 - (30 - v) * a; z = 98.3 + 0.4 * (1 - a) + 0.2 * (1 + Math.sin(x * 0.9 + v * 0.2)); }
        pos.setXYZ(k, x, y, z);
      }
      g.computeVertexNormals();
      M(g, K.std({ map: tex(tw), roughness: 0.95, side: T.DoubleSide }), -38, 0, 0, { cast: true });
      AO(-38, 90, 12, 8, 0.2);
    }

    // ================================================================== pushables: cookie cutters and chocolate chunks
    {
      const tin = K.metal(0xd3d7dc, 0.26, { side: T.DoubleSide });
      const shapes = {
        star: () => { const s = new T.Shape(); for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU - PI / 2, rr = i % 2 ? 1.25 : 2.9; if (!i) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } s.closePath(); return s; },
        heart: () => { const s = new T.Shape(); s.moveTo(0, -2.6); s.bezierCurveTo(1.2, -1.4, 2.9, -0.2, 2.6, 1.2); s.bezierCurveTo(2.3, 2.6, 0.6, 2.8, 0, 1.4); s.bezierCurveTo(-0.6, 2.8, -2.3, 2.6, -2.6, 1.2); s.bezierCurveTo(-2.9, -0.2, -1.2, -1.4, 0, -2.6); return s; },
        flower: () => { const s = new T.Shape(); for (let i = 0; i <= 64; i++) { const a = (i / 64) * TAU, rr = 2.4 + 0.35 * Math.cos(a * 8); if (!i) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } return s; },
        person: () => {
          const s = new T.Shape();
          const pts = [[0, 3], [0.9, 2.7], [1.1, 1.9], [0.7, 1.4], [2.4, 1.1], [2.6, 0.4], [1.0, 0.3], [1.3, -1.2], [2.0, -2.6], [1.1, -2.9], [0, -1.5], [-1.1, -2.9], [-2.0, -2.6], [-1.3, -1.2], [-1.0, 0.3], [-2.6, 0.4], [-2.4, 1.1], [-0.7, 1.4], [-1.1, 1.9], [-0.9, 2.7]];
          s.moveTo(pts[0][0], pts[0][1]); for (const [x, y] of pts.slice(1)) s.lineTo(x, y); s.closePath(); return s;
        },
      };
      const cutterGeo = (shape) => {
        // a thin tin wall: the outline extruded upwards, open top and bottom, with a rolled rim
        const pts = shape.getSpacedPoints(80);
        const pos = [], idx = [];
        const h = 2.0;
        for (let i = 0; i < pts.length; i++) { pos.push(pts[i].x, 0, -pts[i].y, pts[i].x, h, -pts[i].y); }
        for (let i = 0; i < pts.length - 1; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
        const rimPts = pts.map((p) => new T.Vector3(p.x, h, -p.y));
        const rim = new T.TubeGeometry(new T.CatmullRomCurve3(rimPts, true), 80, 0.14, 5, true);
        const both = BU.mergeGeometries([g.toNonIndexed(), rim.toNonIndexed()].map((q) => { for (const k of Object.keys(q.attributes)) if (k !== 'position' && k !== 'normal') q.deleteAttribute(k); return q; }), false);
        return both;
      };
      const cut = [
        ['star', S.trayOut + 22, 5.5], ['heart', sAt(11, 33), 6.5], ['person', sAt(-80, -71) + 14, 6.6],
        ['flower', sAt(-108, 0) + 6, -6.8], ['star', sAt(124, 58) - 4, -6.0], ['heart', sAt(-35, -40), -5.6],
      ];
      for (const [kind, s, off] of cut) {
        const q = track.place(s, off);
        const m = new T.Mesh(cutterGeo(shapes[kind]()), tin);
        m.position.set(q.x, 0.02, q.z); m.rotation.y = r() * TAU;
        K.add(m);
        K.physics.addDynamic({ x: q.x, z: q.z, r: 2.7, m: 0.45, h: 2.2, mesh: m, slide: true, friction: 22, baseY: 0.02 });
      }
      // chocolate chunks broken off a bar
      const chunkT = cv(128, 128, (g) => {
        g.fillStyle = '#3e2416'; g.fillRect(0, 0, 128, 128);
        g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 6; g.strokeRect(10, 10, 108, 108);
        g.strokeStyle = 'rgba(255,220,180,0.12)'; g.lineWidth = 3; g.strokeRect(16, 16, 96, 96);
      });
      const chunkMat = K.phys({ map: tex(chunkT), roughness: 0.38, clearcoat: 0.4, clearcoatRoughness: 0.35 });
      const chunkGeo = new K.RoundedBoxGeometry(3.4, 1.3, 3.4, 2, 0.3);
      const chunkSpots = [[sAt(66, -30), -6.4], [sAt(-118, 30), 6.6], [S.start + 4 + 140, 6.5], [sAt(104, -72), -6.2]];
      for (const [s, off] of chunkSpots) {
        const q = track.place(s, off);
        const m = K.mesh(chunkGeo, chunkMat, q.x, 0.65, q.z, { ry: r() * 6 });
        K.physics.addDynamic({ x: q.x, z: q.z, r: 2.0, m: 0.4, h: 1.3, mesh: m, slide: true, friction: 24, baseY: 0.65 });
      }
      // a broken bar lying in the west infield
      for (let i = 0; i < 3; i++) M(chunkGeo, chunkMat, -92 + i * 3.6, 0.65, 52 + (i % 2) * 0.4, { ry: 0.1 });
      AO(-88.4, 52, 6.5, 2.5, 0.35);
    }

    // ================================================================== fine scatter
    {
      // flour dust patches: soft alpha decals
      const dustC = cv(256, 256, (g) => {
        const R = rng(19);
        g.clearRect(0, 0, 256, 256);
        for (let i = 0; i < 260; i++) {
          const a = R() * TAU, d = Math.pow(R(), 0.8) * 100, x = 128 + Math.cos(a) * d, y = 128 + Math.sin(a) * d, rr = 3 + R() * 16;
          const gr = g.createRadialGradient(x, y, 0, x, y, rr);
          const al = 0.16 * (1 - d / 120);
          gr.addColorStop(0, `rgba(255,255,255,${al})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
          g.fillStyle = gr; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill();
        }
        for (let i = 0; i < 900; i++) { const a = R() * TAU, d = R() * 118; g.fillStyle = `rgba(255,255,255,${0.5 * R()})`; g.fillRect(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, 1.5, 1.5); }
      });
      const dustMat = K.std({ map: tex(dustC), transparent: true, depthWrite: false, roughness: 1, color: 0xffffff });
      const dg = [];
      const spots = [...(A.dustSpots || [])];
      spots.push([MIXER.x - 14, MIXER.z + 22, 16], [MIXER.x + 16, MIXER.z + 20, 14], [11, -6, 16], [-26, 36, 14], [A.flourBag[0] - 16, A.flourBag[1] - 12, 22], [134, -16, 18], [-70, 34, 14], [96, 38, 16], [-120, 70, 14], [60, 46, 12], [-60, -82, 14]);
      for (const [x, z, sz] of spots) {
        const g = new T.PlaneGeometry(sz * 1.6, sz * 1.6); g.rotateX(-PI / 2);
        xf(g, { x, y: 0.07 + r() * 0.03, z, ry: r() * TAU });
        dg.push(g);
      }
      const dm = new T.Mesh(BU.mergeGeometries(dg, false), dustMat); dm.renderOrder = 2; dm.receiveShadow = true; K.group.add(dm);

      // sugar crystals, oat flakes, eggshells, crumbs
      const sugar = [], oats = [], shells = [], crumbs = [];
      const scat = (cx, cz, rad, n, fn) => { for (let i = 0; i < n; i++) { const a = r() * TAU, d = Math.sqrt(r()) * rad; const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d; if (onTable(x, z, 2)) fn(x, z); } };
      scat(-74, 30, 8, 60, (x, z) => sugar.push({ x, y: 0.12, z, rx: r() * 3, ry: r() * 3, s: r.range(0.2, 0.32) }));
      scat(-11, -63, 14, 40, (x, z) => sugar.push({ x, y: 0.12, z, rx: r() * 3, ry: r() * 3, s: r.range(0.2, 0.3) }));
      for (let i = 0; i < 90; i++) { const x = r.range(-150, 150), z = r.range(-90, 90); if (roadD(x, z) > 1) sugar.push({ x, y: 0.12, z, rx: r() * 3, ry: r() * 3, s: r.range(0.18, 0.3) }); }
      for (const [cx, cz] of A.crumbSpots) scat(cx, cz, 8, 16, (x, z) => oats.push({ x, y: 0.12, z, ry: r() * TAU, rx: r.range(-0.2, 0.2), sx: r.range(0.9, 1.3), sy: 0.18, sz: r.range(0.6, 0.85), color: r.pick([0xd8c49a, 0xcdb487, 0xe2d2ae]) }));
      scat(-92, 48, 8, 14, (x, z) => oats.push({ x, y: 0.12, z, ry: r() * TAU, sx: r.range(0.9, 1.3), sy: 0.18, sz: r.range(0.6, 0.85), color: 0xd6c296 }));
      for (const [cx, cz] of A.crumbSpots) scat(cx, cz, 9, 26, (x, z) => crumbs.push({ x, y: 0.15, z, rx: r() * 6, ry: r() * 6, s: r.range(0.18, 0.5), color: r.pick([0xc98a45, 0xa8692e, 0xe0b071]) }));
      for (const [cx, cz] of A.shellSpots) scat(cx, cz, 4, 4, (x, z) => shells.push({ x, y: 0.4, z, rx: r.range(2.4, 3.0), ry: r() * TAU, rz: r.range(-0.3, 0.3), s: r.range(1.6, 2.4), color: r.pick([0xe2b98e, 0xf4efe6]) }));
      for (let i = 0; i < 70; i++) { const x = r.range(-150, 150), z = r.range(-90, 90); if (roadD(x, z) > 2 && onTable(x, z, 3)) sprinkles.push({ x, y: 0.18, z, ry: r() * TAU, s: r.range(0.9, 1.1), color: r.pick(sprinkleCols) }); }
      for (let i = 0; i < 50; i++) { const x = r.range(-150, 150), z = r.range(-90, 90); if (roadD(x, z) > 2 && onTable(x, z, 3)) chips.push({ x, y: 0.02, z, ry: r() * TAU, rx: r.range(-0.3, 0.3), s: r.range(0.9, 1.2) }); }
      K.instances(new T.BoxGeometry(1, 1, 1), K.phys({ color: 0xffffff, roughness: 0.15, transparent: true, opacity: 0.85, clearcoat: 1 }), sugar, { cast: false });
      K.instances(new T.CylinderGeometry(1, 1, 1, 10), K.std({ vertexColors: false, color: 0xffffff, roughness: 0.85 }), oats, { colors: true, cast: false });
      K.instances(new T.DodecahedronGeometry(1, 0), K.std({ color: 0xffffff, roughness: 0.9 }), crumbs, { colors: true, cast: false });
      K.instances(new T.SphereGeometry(1, 10, 6, 0, 1.3, 0, 1.0), K.std({ color: 0xffffff, roughness: 0.6, side: T.DoubleSide }), shells, { colors: true });
      // instanced in patches so that off-screen ones are culled
      const byKey = (list) => { const m = new Map(); for (const it of list) { const k = it.ck || ('q' + Math.floor((it.x + 160) / 107) + Math.floor((it.z + 98) / 98)); if (!m.has(k)) m.set(k, []); m.get(k).push(it); } return m.values(); };
      for (const l of byKey(sprinkles)) K.instances(sprinkleGeo, sprinkleMat, l, { colors: true, cast: false });
      for (const l of byKey(chips)) K.instances(chipGeo, chocMat, l, { cast: false });
      K.instances(cookieGeo, cookieMat, cookies);
      K.instances(chipGeo, chocMat, cchips, { cast: false });
    }

    {
      const hm = new T.Mesh(BU.mergeGeometries(heapG, false), flourMound);
      hm.castShadow = true; hm.receiveShadow = true; K.group.add(hm);
    }
    flush();
    flushAO();
  },

  animate(time, dt) {
    if (!A) return;
    if (A.beater) A.beater.rotation.y = time * 5.2;
    if (A.timerDial) A.timerDial.rotation.y = -((time * 0.02) % TAU);
  },
};

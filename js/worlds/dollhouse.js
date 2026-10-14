// World: Haunted Dollhouse. Halloween night in a dusty attic: an old Victorian dollhouse stands open, and the
// course runs in through its front door, along a carpet runner through the hall and dining room, round a stair
// hall hairpin, up the staircase to the upper floor (bedroom, nursery, study) and off the balcony back down onto
// the attic floorboards, past a giant jack-o'-lantern, under dangling spiders, over trapdoors that glow before
// they drop open, and through a drifting ghost. Moonlight through a round window, candles and tea lights.
// Raced on toy trucks with headlights.

const TRACK = [
  [-110, 18], [-60, 18], [-28, 12], [-13, -6], [-18, -28], [-44, -38], [-104, -38], [-131, -43], [-139, -58],
  [-129, -73], [-108, -76], [-70, -76], [-34, -79], [2, -73], [36, -76], [70, -76], [108, -66], [128, -34],
  [134, 30], [120, 68], [88, 82], [0, 82], [-92, 80], [-140, 71], [-149, 49], [-140, 27],
];
const W = 14;
const BOUNDS = { minX: -172, maxX: 172, minZ: -104, maxZ: 104 };
const H = 8; // upper floor height
// dollhouse plan: west/east walls, front wall, upper-floor front edge, back wall; partitions
const HS = { x0: -156, x1: 40, zf: -16, zm: -58, zb: -98, xp: -84, xh: -44, xk: 4, xu1: -44, xu2: -4, xb: 45 };
const RAMP = { x0: -108.4, x1: -83.6 };
const MOON = [0.4, 1, -0.66];
const WIN = { x: 100, y: 40, z: -103, r: 10 }; // round attic window
const PI = Math.PI, TAU = PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const fract = (x) => x - Math.floor(x);
const hash = (n) => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);

let A = null; // runtime state shared by build / tick / animate

// ---- trapdoors: warn (cracks glow, creak) -> drop open -> close. Pure function of time.
function trapState(T, t) {
  const u = (((t + T.ph) % T.P) + T.P) % T.P;
  let warn = 0, frac = 0, open = false;
  if (u < T.W) warn = u / T.W;
  else if (u < T.W + T.O) {
    const q = u - T.W;
    frac = Math.min(1, q / 0.28) * Math.min(1, (T.O - q) / 0.38);
    open = q > 0.06 && q < T.O - 0.16;
    warn = 1;
  }
  return { u, warn, frac, open };
}
// ---- spiders: drop on a thread, sit on the road, climb back up
const SP = { P: 6.4, D: 1.15, S: 1.7, C: 1.3, top: 46, low: 1.5 };
function spiderY(sp, t) {
  const u = (((t + sp.ph) % SP.P) + SP.P) % SP.P;
  if (u < SP.D) { const q = u / SP.D; return { y: lerp(SP.top, SP.low, 1 - (1 - q) * (1 - q) * (1 - q)), u }; }
  if (u < SP.D + SP.S) return { y: SP.low + Math.abs(Math.sin((u - SP.D) * 7)) * 0.25, u };
  if (u < SP.D + SP.S + SP.C) { const q = (u - SP.D - SP.S) / SP.C; return { y: lerp(SP.low, SP.top, q * q * (3 - 2 * q)), u }; }
  return { y: SP.top, u };
}
// ---- the creeping rocking chair (upper floor nursery): lateral offset from its parking spot
const CHAIR = { P: 5.6, ph: 1.3 };
function chairPose(t) {
  const u = (((t + CHAIR.ph) % CHAIR.P) + CHAIR.P) % CHAIR.P;
  const k = ss(0.4, 2.0, u) * (1 - ss(3.2, 4.9, u));
  return { k, rock: Math.sin(t * 4.2) * (0.12 + 0.12 * k) };
}
// ---- the drifting ghost on the south straight
const GHOST = { P: 9.5, ph: 2.0, ax: 9, az: 15, R: 7.5, push: 48 };
function ghostPos(t) {
  const a = ((t + GHOST.ph) / GHOST.P) * TAU;
  return { x: A.ghostC[0] + Math.sin(a * 0.5) * GHOST.ax, z: A.ghostC[1] + Math.sin(a) * GHOST.az, vz: Math.cos(a) * GHOST.az * TAU / GHOST.P, vx: Math.cos(a * 0.5) * 0.5 * GHOST.ax * TAU / GHOST.P };
}
// ---- lightning: every 9-15 s a double flash through the round window
function lightning(t) {
  const P = 12.5, k = Math.floor(t / P), u = t - k * P - hash(k) * 4.5;
  if (u < 0 || u > 1.2) return 0;
  return Math.max(0, 1 - Math.abs(u - 0.05) / 0.07) + 0.75 * Math.max(0, 1 - Math.abs(u - 0.32) / 0.12) + 0.25 * Math.max(0, 1 - (u - 0.45) / 0.7) * (u > 0.45 ? 1 : 0);
}

export default {
  id: 'dollhouse',
  name: 'Haunted Dollhouse',
  blurb: 'Halloween in the attic: trapdoors, dangling spiders and a ghost in the old dollhouse.',
  vehicle: 'truck',
  headlights: { intensity: 62, distance: 54, angle: 0.62, color: 0xffe7c0 },
  seed: 31,
  track: { points: TRACK, width: W, startS: 36 },
  bounds: BOUNDS,
  fallOffEdges: false,
  floorY: -40,
  offCourse: 16,
  offroad: { kind: 'slow', margin: 1.5 },
  skidColor: 0x15100b,
  clackOnBump: false,
  dust: {
    normal: { color: 0xb8ad9c, size: 0.8, life: 0.5, up: 1.2, grav: 3, alpha: 0.22, grow: 2.2, rate: 0.3 },
    slow: { color: 0xc9bfae, size: 1.3, life: 0.8, up: 3, grav: 4, alpha: 0.55, grow: 2.4, rate: 1.6 },
    sticky: { color: 0xe8e8f0, size: 0.7, life: 0.5, up: 2, grav: 12, alpha: 0.7, grow: 1.2, rate: 1.4 },
    slick: { color: 0x9cff6a, size: 0.6, life: 0.45, up: 3, grav: 22, alpha: 0.9, grow: 1, rate: 1.6 },
  },
  lighting: {
    sunDir: MOON, sunColor: 0x7c94e0, sunIntensity: 0.82,
    hemiSky: 0x283464, hemiGround: 0x1a1008, hemiIntensity: 0.22,
    envIntensity: 0.12, exposure: 1.12, background: 0x05060b, shadowRadius: 3,
    fog: { color: 0x07080f, near: 300, far: 760 },
  },

  async build(K) {
    const { THREE: T, TX, r, track, physics } = K;
    const BU = K.BufferGeometryUtils;
    const V2 = (a, b = a) => new T.Vector2(a, b);
    const L = track.length;
    A = { traps: [], spiders: [], flick: [], pools: [], eyes: [], ghostC: [0, 0] };
    const keep = [];

    // ================================================================== helpers
    const xf = (g, o = {}) => g.applyMatrix4(new T.Matrix4().compose(new T.Vector3(o.x || 0, o.y || 0, o.z || 0),
      new T.Quaternion().setFromEuler(new T.Euler(o.rx || 0, o.ry || 0, o.rz || 0, o.order || 'YXZ')), new T.Vector3(o.sx ?? o.s ?? 1, o.sy ?? o.s ?? 1, o.sz ?? o.s ?? 1)));
    const tidy = (g, c) => {
      g = g.index ? g.toNonIndexed() : g.clone();
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.attributes.normal) g.computeVertexNormals();
      const col = new T.Color(c), n = g.attributes.position.count, a = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; }
      g.setAttribute('color', new T.BufferAttribute(a, 3));
      return g;
    };
    const CELL = 170;
    const bakeQ = new Map();
    const bake = (g, mat, x, z, cast) => {
      const key = mat.uuid + (cast ? 'c' : 'n') + Math.floor((x + 400) / CELL) + ':' + Math.floor((z + 400) / CELL);
      if (!bakeQ.has(key)) bakeQ.set(key, { mat, cast, parts: [] });
      bakeQ.get(key).parts.push(g);
    };
    // P: one coloured part in world space; frame(): a local frame (cx, cy, cz, ry) for a whole prop
    const P = (geo, c, o, mat, cast = true) => { const g = tidy(xf(geo.clone(), o), c); bake(g, mat, o.x || 0, o.z || 0, cast); };
    const frame = (cx, cy, cz, ry = 0, s = 1) => {
      const M = new T.Matrix4().compose(new T.Vector3(cx, cy, cz), new T.Quaternion().setFromEuler(new T.Euler(0, ry, 0)), new T.Vector3(s, s, s));
      const f = (geo, c, o, mat, cast = true) => { const g = tidy(xf(geo.clone(), o), c); g.applyMatrix4(M); bake(g, mat, cx, cz, cast); };
      f.pt = (lx, lz) => { const c = Math.cos(ry), sn = Math.sin(ry); return [cx + (lx * c + lz * sn) * s, cz + (-lx * sn + lz * c) * s]; };
      return f;
    };
    const flush = () => {
      for (const { mat, cast, parts } of bakeQ.values()) {
        const g = BU.mergeGeometries(parts, false);
        g.computeBoundingSphere();
        const m = new T.Mesh(g, mat); m.castShadow = cast; m.receiveShadow = true;
        K.group.add(m); keep.push(m);
      }
      bakeQ.clear();
    };
    const contacts = [];
    const AO = (x, z, rx, rz = rx, op = 0.4, ang = 0, y = 0.07) => contacts.push({ x, y, z, ry: -ang, sx: rx * 2, sy: op, sz: rz * 2 });
    const pools = []; // additive light pools on the floor
    const POOL = (x, y, z, sx, sz, color, op = 1, flick = 0) => { pools.push({ x, y, z, sx, sy: 1, sz, color: new T.Color(color).multiplyScalar(op), flick }); };
    const halos = { s: [], b: [] }; // glow points: small (flames) and big (soft halos)
    const HALO = (x, y, z, color, op = 1, big = false, flick = 1) => halos[big ? 'b' : 's'].push({ x, y, z, c: new T.Color(color).multiplyScalar(op), flick, ph: r() * 10 });
    const sAt = (x, z) => track.distTo(x, z).s;
    const latAt = (x, z) => track.distTo(x, z).lateral;
    const box = (w, h, d) => new T.BoxGeometry(w, h, d);
    const rbox = (w, h, d, rad = 0.3, seg = 2) => new K.RoundedBoxGeometry(w, h, d, seg, Math.min(rad, w / 2.01, h / 2.01, d / 2.01));
    const cyl = (r1, r2, h, seg = 16, open = false) => new T.CylinderGeometry(r1, r2, h, seg, 1, open);
    const sph = (rad, ws = 16, hs = 12) => new T.SphereGeometry(rad, ws, hs);
    const lathe = (pts, seg = 24) => K.lathe(pts, seg);
    const canvas = (w, h, draw) => { const c = TX.makeCanvas(w, h); draw(c.getContext('2d'), w, h); return c; };
    const tex = (c, rep = [1, 1], wrap = true) => TX.toTexture(c, { repeat: rep, wrap });
    // all crossings of the centreline with x = v (axis 'x') or z = v (axis 'z')
    const crossings = (axis, v) => {
      const out = [];
      for (let i = 0; i < track.N; i++) {
        const j = (i + 1) % track.N;
        const a = (axis === 'x' ? track.x[i] : track.z[i]) - v, b = (axis === 'x' ? track.x[j] : track.z[j]) - v;
        if (a === 0 || a * b < 0) { const f = a / (a - b); out.push({ s: (i + f) * track.ds, x: lerp(track.x[i], track.x[j], f), z: lerp(track.z[i], track.z[j], f) }); }
      }
      return out;
    };
    const groundY = (x, z) => physics.groundAt(x, z).g;
    // ribbon along the track between s0 and s1, following the ground (ramps, platforms)
    const strip = (s0, s1, off, wid, yOff = 0.05, step = 1, vScale = 10, follow = true) => {
      const n = Math.max(2, Math.ceil((s1 - s0) / step));
      const pos = [], uv = [], idx = [];
      for (let i = 0; i <= n; i++) {
        const s = s0 + ((s1 - s0) * i) / n, p = track.at(s);
        for (let k = 0; k < 2; k++) {
          const o = off + (k - 0.5) * wid, x = p.x + p.nx * o, z = p.z + p.nz * o;
          pos.push(x, (follow ? groundY(x, z) : 0) + yOff, z); uv.push(k, (s - s0) / vScale);
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
    const inHouse = (x, z, m = 0) => x > HS.x0 - m && x < HS.xb + m && z > HS.zb - m && z < HS.zf + m;

    // ================================================================== key places along the course
    const sDoor = crossings('z', HS.zf).find((c) => c.x > -40 && c.x < 10);
    const sHallDoor = crossings('x', HS.xh).find((c) => c.z > -50 && c.z < -25);
    const sDinDoor = crossings('x', HS.xp).find((c) => c.z > -50 && c.z < -25);
    const sU1 = crossings('x', HS.xu1).find((c) => c.z < -60);
    const sU2 = crossings('x', HS.xu2).find((c) => c.z < -60);
    const sEast = crossings('x', HS.x1).find((c) => c.z < -60);
    const sEdge = crossings('x', HS.xb).find((c) => c.z < -60);
    const sRamp0 = crossings('x', RAMP.x0).find((c) => c.z < -60);
    let sApex = 0; { let mx = 1e9; for (let i = 0; i < track.N; i++) if (track.z[i] < -45 && track.z[i] > -70 && track.x[i] < mx) { mx = track.x[i]; sApex = i * track.ds; } }

    // ================================================================== physics: staircase, upper floor, walls
    const ZR = track.at((sRamp0.s + (sEdge.s - sRamp0.s) * 0.1)).z; // the stairs climb due east at the road's z
    const rampLen = RAMP.x1 - RAMP.x0;
    K.ramp((RAMP.x0 + RAMP.x1) / 2, ZR, 0, rampLen, 16, H * rampLen / (rampLen - 0.25), 0);
    const PX0 = HS.xp, PX1 = HS.xb;
    K.platform((PX0 + PX1) / 2, (HS.zm + HS.zb) / 2, (PX1 - PX0) / 2, (HS.zm - HS.zb) / 2, 0, H);
    // banisters along the stairs
    K.box((RAMP.x0 + RAMP.x1) / 2 + 0.5, ZR - 8.6, rampLen / 2 + 0.5, 0.6, 0, H + 3);
    K.box((RAMP.x0 + RAMP.x1) / 2 + 0.5, ZR + 8.6, rampLen / 2 + 0.5, 0.6, 0, H + 3);
    // balustrade along the upper floor's front edge
    K.box((PX0 + PX1) / 2, HS.zm - 0.6, (PX1 - PX0) / 2, 0.6, 0, H + 3);

    // ================================================================== materials
    const grainTex = (() => {
      const c = canvas(256, 256, (g) => {
        g.fillStyle = '#c8c0b4'; g.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 140; i++) { const y = r() * 256; g.strokeStyle = `rgba(${60 + r() * 40},${40 + r() * 20},20,${0.08 + r() * 0.18})`; g.lineWidth = 0.6 + r() * 2.2; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= 256; x += 32) g.lineTo(x, y + Math.sin(x * 0.03 + i) * 3); g.stroke(); }
      });
      return tex(c);
    })();
    const mPlain = K.std({ vertexColors: true, roughness: 0.85 });
    const mWood = K.std({ vertexColors: true, roughness: 0.55, map: grainTex });
    const mLacq = K.phys({ vertexColors: true, roughness: 0.32, map: grainTex, clearcoat: 0.85, clearcoatRoughness: 0.18 });
    const mGloss = K.phys({ vertexColors: true, roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.25 });
    const mMetal = K.std({ vertexColors: true, metalness: 0.55, roughness: 0.36 });
    const mCloth = K.phys({ vertexColors: true, roughness: 0.92, sheen: 1, sheenRoughness: 0.5, sheenColor: new T.Color(0xffffff) });
    const mGlow = new T.MeshBasicMaterial({ vertexColors: true });
    const mWax = mPlain;

    // ================================================================== attic floor (old pine boards) + dust
    {
      const pine = TX.woodTextures({ size: 1024, seed: 21, planks: 5, base: 0x6a4a32, dark: 0x3a2618, light: 0x8e6a48, ringFreq: 15, gap: 0.006, gapColor: 0x120a05, roughBase: 0.62, varyPlanks: 0.22 });
      const cv = pine.map.image, g = cv.getContext('2d');
      for (let p = 0; p < 5; p++) for (let k = 0; k < 2; k++) { // butt joints and nail heads
        const y = (p * 397 + k * 512 + 141) % 1024;
        g.fillStyle = 'rgba(15,8,3,0.95)'; g.fillRect(p * 1024 / 5 + 3, y, 1024 / 5 - 6, 4);
        g.fillStyle = 'rgba(40,40,44,0.9)';
        for (const yy of [y - 12, y + 16]) { g.beginPath(); g.arc(p * 1024 / 5 + 30, yy, 3, 0, TAU); g.arc(p * 1024 / 5 + 1024 / 5 - 30, yy, 3, 0, TAU); g.fill(); }
      }
      pine.map.needsUpdate = true;
      const geo = new T.PlaneGeometry(BOUNDS.maxX - BOUNDS.minX + 140, BOUNDS.maxZ - BOUNDS.minZ + 120); geo.rotateX(-PI / 2);
      const pos = geo.attributes.position, uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getZ(i) / 55, pos.getX(i) / 160); // boards run east-west, 11 wide
      const floor = new T.Mesh(geo, K.std({ map: pine.map, normalMap: pine.normalMap, roughnessMap: pine.roughnessMap, normalScale: V2(0.7) }));
      floor.position.set(0, 0, 10); floor.receiveShadow = true; K.group.add(floor); keep.push(floor);

      // dust: one big non-tiling layer; the racing line is swept clean, paw prints and drag marks
      const CW = 1024, CH = 620, sx = CW / (BOUNDS.maxX - BOUNDS.minX), sz = CH / (BOUNDS.maxZ - BOUNDS.minZ);
      const px = (x) => (x - BOUNDS.minX) * sx, pz = (z) => (z - BOUNDS.minZ) * sz;
      const dc = canvas(CW, CH, (d) => {
        d.fillStyle = 'rgba(150,143,132,0.55)'; d.fillRect(0, 0, CW, CH);
        for (let i = 0; i < 900; i++) {
          const x = r() * CW, y = r() * CH, rad = 6 + r() * 60, a = r() * 0.22;
          const gr = d.createRadialGradient(x, y, 0, x, y, rad);
          const light = r() < 0.6;
          gr.addColorStop(0, light ? `rgba(205,198,186,${a})` : `rgba(60,48,36,${a * 0.8})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
          d.fillStyle = gr; d.fillRect(x - rad, y - rad, rad * 2, rad * 2);
        }
        for (let i = 0; i < 2600; i++) { d.fillStyle = `rgba(230,225,215,${0.15 + r() * 0.35})`; d.fillRect(r() * CW, r() * CH, 1 + r() * 1.5, 1 + r() * 1.5); }
        // sweep the road clean (soft edge)
        d.globalCompositeOperation = 'destination-out';
        d.lineJoin = 'round'; d.lineCap = 'round';
        for (const [wid, a] of [[W + 9, 0.25], [W + 5, 0.35], [W + 1, 0.6], [W - 3, 0.9]]) {
          d.strokeStyle = `rgba(0,0,0,${a})`; d.lineWidth = wid * sx; d.beginPath();
          for (let i = 0; i <= track.N; i += 4) { const k = i % track.N; if (i === 0) d.moveTo(px(track.x[k]), pz(track.z[k])); else d.lineTo(px(track.x[k]), pz(track.z[k])); }
          d.closePath(); d.stroke();
        }
        // drag marks from the trunk and a cleared patch under the house
        d.fillStyle = 'rgba(0,0,0,0.85)'; d.fillRect(px(HS.x0 - 2), pz(HS.zb - 2), (HS.xb - HS.x0 + 4) * sx, (HS.zf - HS.zb + 4) * sz);
        d.strokeStyle = 'rgba(0,0,0,0.4)'; d.lineWidth = 3;
        for (const o of [-6, 6]) { d.beginPath(); d.moveTo(px(28 + o), pz(44)); d.bezierCurveTo(px(10 + o), pz(30), px(-20 + o), pz(40), px(-40 + o), pz(34)); d.stroke(); }
        // cat paw prints wandering across the dust
        d.fillStyle = 'rgba(0,0,0,0.55)';
        let cx = px(-150), cy = pz(98);
        for (let i = 0; i < 70; i++) {
          const a = -0.55 + Math.sin(i * 0.21) * 0.5;
          cx += Math.cos(a) * 14; cy += Math.sin(a) * 14 * 0.6 - 2;
          const side = i % 2 ? 4 : -4;
          const fx = cx - Math.sin(a) * side, fy = cy + Math.cos(a) * side;
          d.beginPath(); d.ellipse(fx, fy, 2.2, 1.8, a, 0, TAU); d.fill();
          for (let t = -1; t <= 1; t++) { d.beginPath(); d.arc(fx + Math.cos(a + t * 0.6) * 3.2, fy + Math.sin(a + t * 0.6) * 3.2, 0.9, 0, TAU); d.fill(); }
        }
      });
      const dg = new T.PlaneGeometry(BOUNDS.maxX - BOUNDS.minX, BOUNDS.maxZ - BOUNDS.minZ); dg.rotateX(-PI / 2);
      const dm = new T.Mesh(dg, K.std({ map: tex(dc, [1, 1], false), transparent: true, depthWrite: false, roughness: 1, color: 0xffffff }));
      dm.position.set((BOUNDS.minX + BOUNDS.maxX) / 2, 0.025, (BOUNDS.minZ + BOUNDS.maxZ) / 2); dm.receiveShadow = true; dm.renderOrder = 0;
      K.group.add(dm); keep.push(dm);
    }

    // ================================================================== attic walls: gable wall with the round window, knee walls
    {
      const plaster = canvas(256, 256, (g) => {
        g.fillStyle = '#5a5048'; g.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '30,24,20' : '120,110,96'},${r() * 0.12})`; g.beginPath(); g.arc(r() * 256, r() * 256, 2 + r() * 14, 0, TAU); g.fill(); }
        g.strokeStyle = 'rgba(20,15,10,0.35)'; g.lineWidth = 1; for (let i = 0; i < 6; i++) { g.beginPath(); let x = r() * 256, y = r() * 256; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 40; y += r() * 30; g.lineTo(x, y); } g.stroke(); }
      });
      const pm = K.std({ map: tex(plaster, [8, 2]), roughness: 0.95 });
      const north = new T.Mesh(box(420, 90, 3), pm); north.position.set(0, 45, BOUNDS.minZ - 1.5); north.receiveShadow = true; K.group.add(north); keep.push(north);
      for (const sx of [-1, 1]) { const w = new T.Mesh(box(3, 16, 260), pm); w.position.set(sx * (BOUNDS.maxX + 1.5), 8, 0); w.receiveShadow = true; K.group.add(w); keep.push(w); }
      // timber framing: posts and a tie beam on the gable wall, knee-wall posts, skirting
      const beam = 0x3a281a;
      for (let x = -150; x <= 160; x += 52) P(box(4, 90, 3), beam, { x, y: 45, z: BOUNDS.minZ + 0.5 }, mWood);
      P(box(420, 4, 4), beam, { x: 0, y: 64, z: BOUNDS.minZ + 1 }, mWood);
      for (const sx of [-1, 1]) {
        for (let z = -90; z <= 100; z += 38) P(box(3, 16, 3), beam, { x: sx * (BOUNDS.maxX - 0.2), y: 8, z }, mWood);
        P(box(3, 3, 260), beam, { x: sx * (BOUNDS.maxX - 0.4), y: 15.5, z: 0 }, mWood);
        P(box(1.2, 2, 260), 0x241810, { x: sx * (BOUNDS.maxX - 0.6), y: 1, z: 0 }, mWood);
      }
      P(box(420, 2, 1.2), 0x241810, { x: 0, y: 1, z: BOUNDS.minZ + 0.6 }, mWood);
      // brick chimney breast in the north-east
      const brick = canvas(256, 256, (g) => {
        g.fillStyle = '#2a1a14'; g.fillRect(0, 0, 256, 256);
        for (let row = 0; row < 16; row++) for (let k = -1; k < 5; k++) { const x = k * 64 + (row % 2) * 32, y = row * 16; g.fillStyle = `rgb(${90 + r() * 40 | 0},${42 + r() * 18 | 0},${30 + r() * 12 | 0})`; g.fillRect(x + 2, y + 2, 60, 12); }
      });
      const bm = K.std({ map: tex(brick, [1.5, 6]), roughness: 0.9 });
      const ch = new T.Mesh(box(24, 90, 10), bm); ch.position.set(146, 45, BOUNDS.minZ + 4); ch.castShadow = ch.receiveShadow = true; K.group.add(ch); keep.push(ch);
      K.box(146, BOUNDS.minZ + 4, 12, 5, 0, 90);
      // the round window: deep frame, cross mullions, moonlit glass
      const wf = frame(WIN.x, WIN.y, WIN.z + 1.6, 0);
      wf(new T.TorusGeometry(WIN.r, 1.3, 10, 40), 0x2e2118, {}, mWood);
      wf(box(WIN.r * 2, 1.0, 1.2), 0x2e2118, { z: 0.2 }, mWood);
      wf(box(1.0, WIN.r * 2, 1.2), 0x2e2118, { z: 0.2 }, mWood);
      const glassC = canvas(256, 256, (g) => {
        const gr = g.createRadialGradient(150, 100, 6, 128, 128, 140); gr.addColorStop(0, '#f2f6ff'); gr.addColorStop(0.18, '#a9bcf0'); gr.addColorStop(0.6, '#2c3d7a'); gr.addColorStop(1, '#0d1430');
        g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
        g.fillStyle = 'rgba(255,255,250,0.95)'; g.beginPath(); g.arc(160, 92, 22, 0, TAU); g.fill();
        g.fillStyle = 'rgba(20,24,50,0.85)'; g.beginPath(); g.arc(150, 84, 21, 0, TAU); g.fill(); // crescent moon
        g.fillStyle = 'rgba(8,10,20,0.9)'; // bare branches outside
        g.strokeStyle = 'rgba(8,10,20,0.9)'; g.lineCap = 'round';
        const branch = (x, y, a, len, w) => { if (len < 6) return; const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke(); branch(x2, y2, a - 0.45 + r() * 0.2, len * 0.7, w * 0.65); branch(x2, y2, a + 0.4 + r() * 0.2, len * 0.66, w * 0.6); };
        branch(10, 250, -1.0, 70, 9); branch(250, 240, -2.3, 50, 6);
      });
      A.winMat = new T.MeshBasicMaterial({ map: tex(glassC, [1, 1], false), color: 0x9aa4c8 });
      const wg = new T.Mesh(new T.CircleGeometry(WIN.r, 40), A.winMat); wg.position.set(WIN.x, WIN.y, WIN.z + 1.2); K.group.add(wg); keep.push(wg);
      HALO(WIN.x, WIN.y, WIN.z + 3, 0x5a70c0, 0.5, true, 0);
    }

    // ================================================================== moonbeam through the round window + dust motes
    {
      const d = new T.Vector3(...MOON).normalize();
      const t0 = WIN.y / d.y;
      const fx = WIN.x - d.x * t0, fz = WIN.z - d.z * t0;
      A.moonSpot = [fx, fz];
      // light pool on the floor: the window disc with its cross, stretched along the light
      const pc = canvas(256, 256, (g) => {
        const gr = g.createRadialGradient(128, 128, 30, 128, 128, 126); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.75, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 126, 0, TAU); g.fill();
        g.fillStyle = 'rgba(0,0,0,1)'; g.fillRect(122, 0, 12, 256); g.fillRect(0, 122, 256, 12);
      });
      const stretch = 1 / d.y;
      const pg = new T.PlaneGeometry(WIN.r * 2.1, WIN.r * 2.1 * stretch); pg.rotateX(-PI / 2);
      A.moonPool = new T.Mesh(pg, new T.MeshBasicMaterial({ map: tex(pc, [1, 1], false), color: 0x3e4f8a, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
      A.moonPool.position.set(fx, 0.3, fz); A.moonPool.rotation.y = -Math.atan2(d.x, -d.z) * 0; A.moonPool.renderOrder = 2;
      K.group.add(A.moonPool); keep.push(A.moonPool);
      // the shaft: an open tube from the window to the pool, faded with a vertical gradient
      const sg = new T.CylinderGeometry(WIN.r * 0.95, WIN.r * 1.05, t0, 24, 6, true);
      const cols = new Float32Array(sg.attributes.position.count * 3);
      for (let i = 0; i < sg.attributes.position.count; i++) { const y = sg.attributes.position.getY(i) / t0 + 0.5; const k = 0.08 + 0.92 * y; cols.set([k, k, k], i * 3); }
      sg.setAttribute('color', new T.BufferAttribute(cols, 3));
      A.shaftMat = new T.MeshBasicMaterial({ color: 0x18213e, vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
      const shaft = new T.Mesh(sg, A.shaftMat);
      shaft.position.set((WIN.x + fx) / 2, WIN.y / 2, (WIN.z + fz) / 2);
      shaft.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d);
      shaft.renderOrder = 3; K.group.add(shaft); keep.push(shaft);
      // dust motes drifting in the beam
      const n = 160, mp = new Float32Array(n * 3), base = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) base.set([r(), (r() - 0.5) * 2, (r() - 0.5) * 2, r() * 10], i * 4);
      const mg = new T.BufferGeometry(); mg.setAttribute('position', new T.BufferAttribute(mp, 3).setUsage(T.DynamicDrawUsage));
      mg.boundingSphere = new T.Sphere(new T.Vector3(fx, 20, fz), 80);
      const dotC = canvas(32, 32, (g) => { const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); });
      A.dotTex = tex(dotC, [1, 1], false);
      const pts = new T.Points(mg, new T.PointsMaterial({ size: 0.45, map: A.dotTex, color: 0xb8c8ff, transparent: true, opacity: 0.7, depthWrite: false, blending: T.AdditiveBlending }));
      pts.renderOrder = 4; K.group.add(pts); keep.push(pts);
      A.motes = { g: mg, base, n, d, t0 };
    }

    // ================================================================== dollhouse: wallpapers and floors
    const paper = (bg, draw, rep = 10) => {
      const c = canvas(256, 256, (g) => { g.fillStyle = bg; g.fillRect(0, 0, 256, 256); draw(g); });
      const m = K.std({ map: tex(c), roughness: 0.88 });
      m.userData.rep = rep;
      return m;
    };
    const damask = (g, col, s = 1) => {
      g.fillStyle = col;
      for (const [cx, cy] of [[64, 64], [192, 192], [192, 64], [64, 192]]) {
        const k = (cx + cy) % 256 === 0 ? 1 : 0.6;
        g.save(); g.translate(cx, cy); g.scale(k * s, k * s);
        g.beginPath(); g.moveTo(0, -46); g.bezierCurveTo(26, -30, 30, 0, 0, 44); g.bezierCurveTo(-30, 0, -26, -30, 0, -46); g.fill();
        g.beginPath(); g.arc(0, -52, 7, 0, TAU); g.fill();
        for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(sx * 26, 10, 14, 6, sx * 0.7, 0, TAU); g.fill(); }
        g.restore();
      }
    };
    const PAP = {
      hall: paper('#1f4a4a', (g) => damask(g, 'rgba(120,170,150,0.35)')),
      dining: paper('#5a1622', (g) => { for (let x = 0; x < 256; x += 32) { g.fillStyle = 'rgba(214,160,80,0.35)'; g.fillRect(x, 0, 4, 256); g.fillStyle = 'rgba(30,6,10,0.35)'; g.fillRect(x + 14, 0, 10, 256); } }),
      stair: paper('#3c4424', (g) => { g.fillStyle = 'rgba(200,180,110,0.32)'; for (let y = 0; y < 256; y += 64) for (let x = 0; x < 256; x += 64) { const ox = (y / 64) % 2 ? 32 : 0; g.save(); g.translate(x + ox + 16, y + 20); g.beginPath(); g.moveTo(0, -14); g.bezierCurveTo(7, -6, 6, 4, 0, 12); g.bezierCurveTo(-6, 4, -7, -6, 0, -14); g.fill(); g.fillRect(-9, 6, 18, 3); g.restore(); } }),
      kitchen: paper('#bfae86', (g) => { g.strokeStyle = 'rgba(70,60,40,0.4)'; g.lineWidth = 2; for (let x = 0; x <= 256; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); } for (let y = 0; y <= 256; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); } }),
      bed: paper('#6c4450', (g) => { for (let i = 0; i < 9; i++) { const x = (i * 83) % 256, y = (i * 59) % 256; g.fillStyle = 'rgba(220,150,160,0.38)'; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + Math.cos(k * 1.26) * 7, y + Math.sin(k * 1.26) * 7, 6, 0, TAU); g.fill(); } g.fillStyle = 'rgba(120,150,90,0.4)'; g.beginPath(); g.ellipse(x + 14, y + 12, 9, 3.5, 0.7, 0, TAU); g.fill(); } }),
      nursery: paper('#3e5470', (g) => { g.fillStyle = 'rgba(240,226,160,0.42)'; for (let i = 0; i < 10; i++) { const x = (i * 97) % 256, y = (i * 61 + 20) % 256; g.beginPath(); g.arc(x, y, 9, 0.5, 5.8); g.arc(x + 4, y - 2, 7, 5.6, 0.7, true); g.fill(); } g.fillStyle = 'rgba(20,24,40,0.45)'; for (let i = 0; i < 6; i++) { const x = (i * 131 + 40) % 256, y = (i * 47 + 120) % 256; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x - 8, y - 8, x - 16, y - 2); g.quadraticCurveTo(x - 10, y + 1, x - 6, y + 5); g.quadraticCurveTo(x - 2, y + 1, x, y + 4); g.quadraticCurveTo(x + 2, y + 1, x + 6, y + 5); g.quadraticCurveTo(x + 10, y + 1, x + 16, y - 2); g.quadraticCurveTo(x + 8, y - 8, x, y); g.fill(); } }),
      study: paper('#20382a', (g) => { damask(g, 'rgba(200,170,90,0.25)', 0.8); }),
      outside: paper('#2c2434', (g) => { for (let y = 0; y < 256; y += 32) { g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, y + 27, 256, 5); g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(0, y, 256, 3); } }, 9),
    };
    const papQ = new Map(); // paper material -> geometries
    const skin = (mat, g) => { if (!papQ.has(mat)) papQ.set(mat, []); papQ.get(mat).push(g); };
    // a wall segment from (x1,z1) to (x2,z2): core + cap + skirting + paper skins; left/right = papers seen walking 1 -> 2
    const capC = 0x2a1a10, coreC = 0x8a7a66;
    const wall = (x1, z1, x2, z2, h, y0, pl, pr, { th = 1.2, collide = true, cap = true, skirt = true } = {}) => {
      const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz);
      if (len < 0.5) return;
      const ang = Math.atan2(dz, dx), cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
      const f = frame(cx, y0, cz, -ang);
      f(box(len, h, th), coreC, { y: h / 2 }, mPlain);
      if (cap) f(box(len + 0.2, 0.5, th + 0.5), capC, { y: h + 0.2 }, mWood);
      for (const [side, pm] of [[-1, pl], [1, pr]]) {
        if (!pm) continue;
        if (skirt) f(box(len, 1.1, 0.3), 0x1e140c, { y: 0.55, z: side * (th / 2 + 0.15) }, mWood);
        const g = new T.PlaneGeometry(len, h);
        const rep = pm.userData.rep || 10, uv = g.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len / rep, uv.getY(i) * h / rep + y0 / rep);
        g.translate(0, h / 2, 0);
        if (side < 0) g.rotateY(PI);
        g.translate(0, 0, side * (th / 2 + 0.02));
        g.rotateY(-ang); g.translate(cx, y0, cz);
        skin(pm, g);
      }
      if (collide) K.box(cx, cz, len / 2, th / 2 + 0.1, ang, y0 + h);
    };
    // wall with a doorway gap at coordinate gc (along the wall's axis) of half-width gw
    const wallGap = (x1, z1, x2, z2, h, y0, pl, pr, gx, gz, gw, o = {}) => {
      const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len;
      const t = (gx - x1) * ux + (gz - z1) * uz;
      wall(x1, z1, x1 + ux * (t - gw), z1 + uz * (t - gw), h, y0, pl, pr, o);
      wall(x1 + ux * (t + gw), z1 + uz * (t + gw), x2, z2, h, y0, pl, pr, o);
      // door posts (architraves)
      for (const k of [t - gw, t + gw]) {
        const px = x1 + ux * k, pz = z1 + uz * k;
        P(box(1.6, h + 0.6, 2.0), 0x3a2414, { x: px, y: y0 + (h + 0.6) / 2, z: pz, ry: -Math.atan2(dz, dx) }, mWood);
      }
    };

    // floors: [x0, x1, z0, z1, y, canvas painter, tile size]
    const floorMat = (draw, size = 256) => K.std({ map: tex(canvas(size, size, draw)), roughness: 0.6 });
    const FL = {
      checker: floorMat((g) => { for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#1c1a1a' : '#d8d2c4'; g.fillRect(x * 32, y * 32, 32, 32); } g.strokeStyle = 'rgba(80,70,60,0.5)'; for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, 256); g.moveTo(0, i * 32); g.lineTo(256, i * 32); g.stroke(); } }),
      parquet: floorMat((g) => { for (let y = -1; y < 9; y++) for (let x = -1; x < 9; x++) { const k = (x + y) % 2; g.fillStyle = `rgb(${k ? 92 : 112},${k ? 56 : 70},${k ? 30 : 40})`; g.save(); g.translate(x * 32 + 16, y * 32 + 16); g.rotate(k ? PI / 4 : -PI / 4); g.fillRect(-20, -7, 40, 14); g.strokeStyle = 'rgba(20,10,4,0.6)'; g.strokeRect(-20, -7, 40, 14); g.restore(); } }),
      boards: floorMat((g) => { for (let y = 0; y < 8; y++) { g.fillStyle = `rgb(${70 + (y * 37) % 20},${46 + (y * 17) % 12},${30})`; g.fillRect(0, y * 32, 256, 31); g.fillStyle = 'rgba(10,5,2,0.8)'; g.fillRect(0, y * 32 + 31, 256, 1); g.fillRect((y * 97) % 256, y * 32, 2, 32); } }),
      painted: floorMat((g) => { for (let y = 0; y < 8; y++) { g.fillStyle = `rgb(${150 + (y * 13) % 14},${140 + (y * 7) % 10},${120})`; g.fillRect(0, y * 32, 256, 31); g.fillStyle = 'rgba(40,30,20,0.6)'; g.fillRect(0, y * 32 + 31, 256, 1); } for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(60,40,24,0.25)'; g.fillRect(r() * 256, r() * 256, 1 + r() * 8, 1); } }),
      terracotta: floorMat((g) => { for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = `rgb(${130 + r() * 25 | 0},${58 + r() * 14 | 0},${38})`; g.fillRect(x * 64 + 2, y * 64 + 2, 60, 60); } }),
      carpet: floorMat((g) => { g.fillStyle = '#4a2a34'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) { g.fillStyle = 'rgba(190,120,110,0.35)'; g.beginPath(); g.arc(i * 64 + 32, k * 64 + 32, 14, 0, TAU); g.fill(); g.strokeStyle = 'rgba(200,170,110,0.3)'; g.lineWidth = 3; g.strokeRect(i * 64 + 6, k * 64 + 6, 52, 52); } }),
    };
    const floorQ = new Map();
    const floor = (x0, x1, z0, z1, y, mat, tile = 12) => {
      const g = new T.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(-PI / 2); g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
      const pos = g.attributes.position, uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / tile, -pos.getZ(i) / tile);
      if (!floorQ.has(mat)) floorQ.set(mat, []);
      floorQ.get(mat).push(g);
    };
    const Y1 = 0.06, YU = H + 0.06;
    floor(HS.xh, HS.xk, HS.zm, HS.zf, Y1, FL.checker, 9);
    floor(HS.xp, HS.xh, HS.zm, HS.zf, Y1, FL.parquet, 8);
    floor(HS.x0, HS.xp, HS.zb, HS.zf, Y1, FL.boards, 14);
    floor(HS.xk, HS.x1, HS.zm, HS.zf, Y1, FL.terracotta, 10);
    floor(HS.xp, HS.xu1, HS.zb, HS.zm, YU, FL.carpet, 12);
    floor(HS.xu1, HS.xu2, HS.zb, HS.zm, YU, FL.painted, 14);
    floor(HS.xu2, HS.xb, HS.zb, HS.zm, YU, FL.parquet, 8);
    // house base: a moulded plinth all round (low, so it reads as the doll's house edge)
    P(box(HS.xb - HS.x0 + 2, 0.5, 1.4), 0x1a120c, { x: (HS.xb + HS.x0) / 2, y: 0.25, z: HS.zf + 0.7 }, mWood, false);

    // ---------------- walls (ground floor)
    const doorGap = W / 2 + 3.6;
    // front wall, low cut-away, with the open front door
    wall(HS.x0, HS.zf, HS.xp, HS.zf, 3.2, 0, PAP.stair, PAP.outside);
    wall(HS.xp, HS.zf, HS.xh, HS.zf, 3.2, 0, PAP.dining, PAP.outside);
    wallGap(HS.xh, HS.zf, HS.xk, HS.zf, 3.2, 0, PAP.hall, PAP.outside, sDoor.x, HS.zf, doorGap + 1);
    wall(HS.xk, HS.zf, HS.x1, HS.zf, 3.2, 0, PAP.kitchen, PAP.outside);
    // partitions
    wallGap(HS.xh, HS.zf, HS.xh, HS.zm, 6, 0, PAP.dining, PAP.hall, HS.xh, sHallDoor.z, doorGap);
    wallGap(HS.xp, HS.zf, HS.xp, HS.zm, 6, 0, PAP.stair, PAP.dining, HS.xp, sDinDoor.z, doorGap);
    wall(HS.xk, HS.zf, HS.xk, HS.zm, 6, 0, PAP.hall, PAP.kitchen);
    // outer side walls
    wall(HS.x0, HS.zf, HS.x0, HS.zb, 9, 0, PAP.outside, PAP.stair);
    wall(HS.x1, HS.zf, HS.x1, HS.zm, 6, 0, PAP.kitchen, PAP.outside);
    // the upper floor's front face = back wall of the ground floor rooms (platform blocks cars)
    wall(HS.xp, HS.zm + 0.6, HS.xh, HS.zm + 0.6, H, 0, null, PAP.dining, { collide: false, cap: false });
    wall(HS.xh, HS.zm + 0.6, HS.xk, HS.zm + 0.6, H, 0, null, PAP.hall, { collide: false, cap: false });
    wall(HS.xk, HS.zm + 0.6, HS.xb, HS.zm + 0.6, H, 0, null, PAP.kitchen, { collide: false, cap: false });
    // platform west face in the stair hall (both sides of the stairs)
    wall(HS.xp + 0.6, HS.zm, HS.xp + 0.6, ZR + 8, H, 0, PAP.stair, null, { collide: false, cap: false });
    wall(HS.xp + 0.6, ZR - 8, HS.xp + 0.6, HS.zb, H, 0, PAP.stair, null, { collide: false, cap: false });
    // tall back wall
    wall(HS.x1 + 5, HS.zb, HS.x0, HS.zb, 30, 0, null, null, { collide: true, cap: true });
    {
      // back wall papers (visible side faces south)
      const backSkin = (x0, x1, y0, pm) => {
        const len = x1 - x0, h = 30 - y0, g = new T.PlaneGeometry(len, h), uv = g.attributes.uv, rep = pm.userData.rep || 10;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len / rep, uv.getY(i) * h / rep);
        g.translate((x0 + x1) / 2, y0 + h / 2, HS.zb + 0.62); skin(pm, g);
      };
      backSkin(HS.x0, HS.xp, 0, PAP.stair); backSkin(HS.xp, HS.xu1, H, PAP.bed); backSkin(HS.xu1, HS.xu2, H, PAP.nursery); backSkin(HS.xu2, HS.xb, H, PAP.study);
    }
    // ---------------- walls (upper floor)
    const sU1z = sU1.z, sU2z = sU2.z;
    wallGap(HS.xu1, HS.zm, HS.xu1, HS.zb, 7, H, PAP.bed, PAP.nursery, HS.xu1, sU1z, doorGap);
    wallGap(HS.xu2, HS.zm, HS.xu2, HS.zb, 7, H, PAP.nursery, PAP.study, HS.xu2, sU2z, doorGap);
    wallGap(HS.xb, HS.zm, HS.xb, HS.zb, 8, H, PAP.study, PAP.outside, HS.xb, sEdge.z, doorGap + 1);
    wall(HS.xb, HS.zm + 0.6, HS.x1, HS.zm + 0.6, H, 0, PAP.outside, null, { collide: false, cap: false }); // under the balcony end
    wall(HS.xb, HS.zm, HS.xb, HS.zb, H, 0, null, PAP.outside, { collide: false, cap: false });
    // floor slab edges (white painted cornice, seen from the ground floor)
    P(box(PX1 - PX0, 0.8, 1.6), 0xe8dfcf, { x: (PX0 + PX1) / 2, y: H - 0.2, z: HS.zm + 0.4 }, mWood);
    P(box(1.6, 0.8, HS.zm - HS.zb), 0xe8dfcf, { x: PX0 + 0.4, y: H - 0.2, z: (HS.zm + HS.zb) / 2 }, mWood);
    // balustrade: turned balusters and a handrail
    {
      const bal = [];
      for (let x = PX0 + 1; x < PX1 - 0.5; x += 1.6) bal.push({ x, y: H, z: HS.zm - 0.6 });
      for (let x = RAMP.x0 + 1; x < RAMP.x1; x += 1.6) { const hh = H * (x - RAMP.x0) / (RAMP.x1 - RAMP.x0); for (const sz of [-1, 1]) bal.push({ x, y: hh, z: ZR + sz * 8.6 }); }
      const bg = lathe([[0.001, 0], [0.3, 0], [0.3, 0.2], [0.18, 0.5], [0.32, 1.1], [0.16, 1.9], [0.22, 2.4], [0.28, 2.6], [0.001, 2.62]], 8);
      K.instances(bg, K.std({ color: 0xe6dccb, roughness: 0.5 }), bal, { cast: true });
      P(box(PX1 - PX0, 0.5, 0.9), 0x2a160c, { x: (PX0 + PX1) / 2, y: H + 2.75, z: HS.zm - 0.6 }, mLacq);
      for (const sz of [-1, 1]) {
        const len = Math.hypot(RAMP.x1 - RAMP.x0, H);
        P(box(len, 0.5, 0.9), 0x2a160c, { x: (RAMP.x0 + RAMP.x1) / 2, y: H / 2 + 2.75, z: ZR + sz * 8.6, rz: Math.atan2(H, RAMP.x1 - RAMP.x0) }, mLacq);
        // newel post with a ball finial at the foot of the stairs
        P(box(1.6, 5, 1.6), 0x2a160c, { x: RAMP.x0, y: 2.5, z: ZR + sz * 8.6 }, mLacq);
        P(sph(1.1), 0x3a2014, { x: RAMP.x0, y: 5.6, z: ZR + sz * 8.6 }, mLacq);
      }
    }
    // ---------------- the staircase: treads, risers, stringers
    {
      const n = 12, len = RAMP.x1 - RAMP.x0, st = len / n;
      for (let i = 0; i < n; i++) {
        const x = RAMP.x0 + (i + 0.5) * st, top = (H * (i + 1)) / n;
        P(box(st + 0.1, top, 16), 0xe9e0d0, { x, y: top / 2, z: ZR }, mPlain);
        P(box(st + 0.4, 0.35, 16.4), 0x3a2214, { x: x + 0.15, y: top - 0.1, z: ZR }, mLacq);
      }
      // triangular stringers (panelled) on both sides
      for (const sz of [-1, 1]) {
        const sh = new T.Shape(); sh.moveTo(0, 0); sh.lineTo(len, 0); sh.lineTo(len, H + 0.6); sh.lineTo(0, 0.6); sh.closePath();
        const g = new T.ExtrudeGeometry(sh, { depth: 0.8, bevelEnabled: false });
        g.translate(RAMP.x0, 0, ZR + sz * 8.3 - 0.4);
        P(g, 0x2e1a0e, {}, mLacq);
      }
    }
    // ---------------- runner carpet: the road through the house (and up the stairs)
    {
      const c = canvas(256, 512, (g) => {
        g.fillStyle = '#6e1018'; g.fillRect(0, 0, 256, 512);
        g.fillStyle = '#1a0a0c'; g.fillRect(0, 0, 26, 512); g.fillRect(230, 0, 26, 512);
        g.fillStyle = '#c99a3c'; g.fillRect(26, 0, 6, 512); g.fillRect(224, 0, 6, 512);
        g.fillStyle = 'rgba(214,160,70,0.85)'; for (let y = 0; y < 512; y += 16) { g.fillRect(8, y + 4, 10, 8); g.fillRect(238, y + 4, 10, 8); }
        for (let y = 0; y < 512; y += 128) {
          g.save(); g.translate(128, y + 64);
          g.fillStyle = '#2a1a3a'; g.beginPath(); g.moveTo(0, -56); g.lineTo(70, 0); g.lineTo(0, 56); g.lineTo(-70, 0); g.closePath(); g.fill();
          g.strokeStyle = '#c99a3c'; g.lineWidth = 4; g.stroke();
          g.fillStyle = '#b8324a'; g.beginPath(); g.arc(0, 0, 20, 0, TAU); g.fill();
          g.fillStyle = '#e0c070'; for (let k = 0; k < 8; k++) { g.beginPath(); g.arc(Math.cos(k * PI / 4) * 34, Math.sin(k * PI / 4) * 24, 4, 0, TAU); g.fill(); }
          g.restore();
        }
        for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,220,200'},${r() * 0.08})`; g.fillRect(r() * 256, r() * 512, 2, 2); }
      });
      const t = tex(c); t.wrapS = T.ClampToEdgeWrapping;
      const m = new T.Mesh(strip(sDoor.s - 3, sEdge.s - 0.4, 0, W - 1.2, 0.1, 0.8, 26), K.std({ map: t, roughness: 0.95 }));
      m.receiveShadow = true; K.group.add(m); keep.push(m);
    }

    // ================================================================== road outside: glow-chalk edges, tea lights
    const outside = (s) => { const q = ((s % L) + L) % L; return !(q > sDoor.s - 4 && q < sEdge.s + 2); };
    {
      // glow-in-the-dark chalk lines (dashed, hand drawn) on both edges, outside the house
      const c = canvas(64, 512, (g) => {
        g.clearRect(0, 0, 64, 512);
        for (let y = 0; y < 512; y += 4) { const on = (y % 128) < 92; if (!on) continue; g.fillStyle = `rgba(255,255,255,${0.55 + r() * 0.45})`; g.fillRect(8 + r() * 6, y, 44 + r() * 6, 4); }
        for (let i = 0; i < 500; i++) { g.clearRect(r() * 64, r() * 512, 2 + r() * 4, 2); }
      });
      const t = tex(c);
      const mat = new T.MeshBasicMaterial({ map: t, color: 0x7dffb0, transparent: true, opacity: 0.7, depthWrite: false, blending: T.AdditiveBlending });
      const geos = [];
      // contiguous outside range: from the balcony landing round to the front door
      const s0 = sEdge.s + 16, s1 = sDoor.s - 6 + L;
      for (const side of [-1, 1]) geos.push(strip(s0, s1, side * (W / 2 - 0.55), 0.85, 0.06, 1, 18, false));
      const m = new T.Mesh(BU.mergeGeometries(geos, false), mat); m.renderOrder = 2; K.group.add(m); keep.push(m);
      A.chalkMat = mat;
      // start/finish: chequered chalk across the road
      const sc = canvas(256, 64, (g) => { for (let y = 0; y < 4; y++) for (let x = 0; x < 16; x++) { g.fillStyle = (x + y) % 2 ? 'rgba(0,0,0,0)' : `rgba(240,240,230,${0.75 + r() * 0.2})`; g.fillRect(x * 16, y * 16, 16, 16); } });
      const p = track.at(36);
      const sm = new T.Mesh(new T.PlaneGeometry(W, 3.5), K.std({ map: tex(sc, [1, 1], false), transparent: true, roughness: 0.9, emissive: 0x404038, emissiveMap: tex(sc, [1, 1], false) }));
      sm.rotation.order = 'YXZ'; sm.rotation.y = -p.angle + PI / 2; sm.rotation.x = -PI / 2; sm.position.set(p.x, 0.07, p.z); sm.receiveShadow = true;
      K.group.add(sm); keep.push(sm);
    }
    // tea lights: tin cups along the edges outside the house (two staggered rows), with flame + floor pool
    const teaSpots = [];
    {
      const skip = []; // filled later by props that need room
      for (const side of [-1, 1]) {
        for (let s = sEdge.s + 22 + (side > 0 ? 9 : 0); s < sDoor.s - 6 + L; s += 18) {
          const p = track.place(s, side * (W / 2 + 1.6));
          if (inHouse(p.x, p.z, 3)) continue;
          if (Math.abs(p.x) > BOUNDS.maxX - 4 || p.z > BOUNDS.maxZ - 4) continue;
          teaSpots.push({ x: p.x, z: p.z, s });
        }
      }
      A.teaSkip = skip;
    }

    // ================================================================== trapdoors
    const softTex = tex(canvas(128, 128, (g) => { const q = g.createRadialGradient(64, 64, 0, 64, 64, 64); q.addColorStop(0, 'rgba(255,255,255,1)'); q.addColorStop(0.4, 'rgba(255,255,255,0.5)'); q.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = q; g.fillRect(0, 0, 128, 128); }), [1, 1], false);
    const trapMats = {
      pitWall: new T.MeshBasicMaterial({ vertexColors: true }),
      leaf: K.std({ map: grainTex, color: 0x6a4a30, roughness: 0.7 }),
      strap: K.metal(0x2a2a2e, 0.5),
      mask: new T.MeshBasicMaterial({ colorWrite: false }),
    };
    const roomBelow = (warm, kind) => canvas(128, 128, (g) => {
      const gr = g.createRadialGradient(70, 60, 2, 64, 64, 80); gr.addColorStop(0, warm); gr.addColorStop(0.45, '#6a3a14'); gr.addColorStop(1, '#0a0503');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      if (kind === 'rug') { g.strokeStyle = 'rgba(120,30,30,0.6)'; g.lineWidth = 8; g.strokeRect(24, 24, 80, 80); g.fillStyle = 'rgba(60,20,60,0.5)'; g.fillRect(40, 40, 48, 48); }
      else { g.fillStyle = 'rgba(40,24,12,0.6)'; for (let i = 0; i < 8; i++) g.fillRect(0, i * 16, 128, 2); }
    });
    const makeTrap = (name, s, lat, hwAlong, hdAcross, sched, depth = 12, kind = 'boards') => {
      const p = track.place(s, lat), ang = p.angle;
      const hole = K.trapdoor(p.x, p.z, hwAlong, hdAcross, ang, false);
      const grp = new T.Group(); grp.position.set(p.x, 0, p.z); grp.rotation.y = -ang; K.group.add(grp); keep.push(grp);
      // pit: four walls lit from below + the lit room far below
      const pg = [];
      const wcol = (g, top, bot) => { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const y = g.attributes.position.getY(i); const k = ss(0, -depth, y); const c = new T.Color(top).lerp(new T.Color(bot), k); a.set([c.r, c.g, c.b], i * 3); } g.setAttribute('color', new T.BufferAttribute(a, 3)); return g; };
      for (const [w, d, x, z, ry] of [[hwAlong * 2, 0, 0, -hdAcross, 0], [hwAlong * 2, 0, 0, hdAcross, PI], [hdAcross * 2, 0, -hwAlong, 0, PI / 2], [hdAcross * 2, 0, hwAlong, 0, -PI / 2]]) {
        const g = new T.PlaneGeometry(w, depth, 1, 4); g.translate(0, -depth / 2, 0); g.rotateY(ry); g.translate(x, 0, z);
        pg.push(wcol(g, 0x050302, 0x5a3416));
      }
      const pitM = new T.Mesh(BU.mergeGeometries(pg, false), trapMats.pitWall); pitM.renderOrder = -2; grp.add(pitM);
      const bot = new T.Mesh(new T.PlaneGeometry(hwAlong * 2, hdAcross * 2), new T.MeshBasicMaterial({ map: tex(roomBelow(kind === 'hatch' ? '#ffd9a0' : '#e8a050', kind === 'hatch' ? 'rug' : 'boards'), [1, 1], false) }));
      bot.rotation.x = -PI / 2; bot.position.y = -depth; bot.renderOrder = -2; grp.add(bot);
      // ladder down the hatch
      if (kind === 'hatch') {
        const lad = [];
        for (const sz of [-1.6, 1.6]) lad.push(xf(box(0.4, depth * 1.1, 0.4), { x: -hwAlong + 2.2, y: -depth / 2, z: sz, rz: -0.22, order: 'XYZ' }).toNonIndexed());
        for (let k = 1; k < 8; k++) lad.push(xf(box(0.25, 0.25, 3.2), { x: -hwAlong + 2.2 + (k / 8 - 0.5) * depth * 1.1 * Math.sin(0.22), y: -depth + k * depth / 8 * 1.05, z: 0 }).toNonIndexed());
        const ladder = new T.Mesh(BU.mergeGeometries(lad, false), trapMats.leaf); ladder.renderOrder = -2; grp.add(ladder);
      }
      // two leaves hinged on the long (along-track) sides
      const leaves = [];
      for (const sd of [-1, 1]) {
        const hinge = new T.Group(); hinge.position.set(0, 0.12, sd * hdAcross); grp.add(hinge);
        const lg = new T.Group(); hinge.add(lg);
        const lw = hdAcross - 0.22;
        const leaf = new T.Mesh(box(hwAlong * 2 - 0.4, 0.3, lw), trapMats.leaf); leaf.position.set(0, 0, -sd * (lw / 2 + 0.05)); leaf.renderOrder = -2; lg.add(leaf);
        const hw = [];
        for (const k of [-0.55, 0.55]) hw.push(xf(box(0.45, 0.34, lw * 0.9), { x: k * hwAlong * 1.4, y: 0.02, z: -sd * (lw / 2) }));
        hw.push(xf(new T.TorusGeometry(0.45, 0.1, 6, 12), { rx: PI / 2, y: 0.2, z: -sd * (lw - 0.5) }));
        const hwm = new T.Mesh(BU.mergeGeometries(hw.map((q) => q.index ? q.toNonIndexed() : q), false), trapMats.strap); hwm.renderOrder = -2; lg.add(hwm);
        leaves.push({ hinge, sd });
      }
      // frame round the opening (on the floor)
      grp.add(new T.Mesh(BU.mergeGeometries([[hwAlong * 2 + 1.2, 0.6, 0, -hdAcross - 0.3], [hwAlong * 2 + 1.2, 0.6, 0, hdAcross + 0.3], [0.6, hdAcross * 2, -hwAlong - 0.3, 0], [0.6, hdAcross * 2, hwAlong + 0.3, 0]].map(([w, d, x, z]) => xf(box(w, 0.25, d), { x, y: 0.12, z }).toNonIndexed()), false), trapMats.strap));
      // light through the cracks (under the closed leaves)
      const crackMat = new T.MeshBasicMaterial({ color: 0x000000 });
      const crack = new T.Mesh(new T.PlaneGeometry(hwAlong * 2, hdAcross * 2), crackMat); crack.rotation.x = -PI / 2; crack.position.y = 0.13; grp.add(crack);
      // depth mask: hides the floor (and everything on it) over the opening while it is open
      const mask = new T.Mesh(new T.PlaneGeometry(hwAlong * 2, hdAcross * 2), trapMats.mask); mask.rotation.x = -PI / 2; mask.position.y = 0.16; mask.renderOrder = -1; mask.visible = false; grp.add(mask);
      // warm pool and a beam of light rising out of the hole
      const poolMat = new T.MeshBasicMaterial({ color: 0xffa04a, map: softTex, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false });
      const pool = new T.Mesh(new T.PlaneGeometry(hwAlong * 2 + 14, hdAcross * 2 + 14), poolMat); pool.rotation.x = -PI / 2; pool.position.y = 0.32; pool.renderOrder = 2; grp.add(pool);
      const bg = new T.BoxGeometry(hwAlong * 2, 22, hdAcross * 2, 1, 4, 1); bg.translate(0, 11, 0);
      const bc = new Float32Array(bg.attributes.position.count * 3); for (let i = 0; i < bg.attributes.position.count; i++) { const k = Math.pow(1 - bg.attributes.position.getY(i) / 22, 2); bc.set([k, k * 0.75, k * 0.45], i * 3); }
      bg.setAttribute('color', new T.BufferAttribute(bc, 3));
      const beamMat = new T.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
      const beam = new T.Mesh(bg, beamMat); beam.renderOrder = 3; grp.add(beam);
      const T0 = { name, hole, x: p.x, z: p.z, s, lat, ang, hw: hwAlong, hd: hdAcross, ...sched, leaves, crackMat, mask, poolMat, beamMat, crack, safe: lat > 0 ? lat - 7.2 : lat + 7.2, creaked: -1 };
      A.traps.push(T0);
      return T0;
    };
    // 1) the stair hall: a trapdoor on the inside of the hairpin, under the edge of the rug
    makeTrap('hall', sApex + 1, 4.3, 3.6, 3.0, { P: 5.4, ph: 0.4, W: 1.25, O: 1.9 }, 10, 'boards');
    // 2) the attic hatch on the east sweeper (inside half), with a ladder down to the lit landing
    const sHatch = 592;
    makeTrap('hatch', sHatch, 3.7, 5.6, 3.6, { P: 7.2, ph: 2.6, W: 1.5, O: 2.6 }, 18, 'hatch');
    // 3/4) loose floorboards on the south straight, alternating left and right
    const sBoards = 776;
    makeTrap('boardsL', sBoards, -3.6, 3.4, 2.9, { P: 6.0, ph: 0.0, W: 1.2, O: 2.0 }, 9, 'boards');
    makeTrap('boardsR', sBoards + 13, 3.6, 3.4, 2.9, { P: 6.0, ph: 3.0, W: 1.2, O: 2.0 }, 9, 'boards');
    // one shared real light for whichever trapdoor is open on screen
    A.trapLight = new T.PointLight(0xffb060, 0, 60, 2); A.trapLight.position.set(0, -50, 0); K.group.add(A.trapLight);

    // ================================================================== hazards: spiders on threads
    {
      const legMat = K.std({ color: 0x141016, roughness: 0.5 });
      const bodyMat = K.phys({ color: 0x1c1420, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.25, sheen: 0.6, sheenColor: new T.Color(0x6a4a8a) });
      const eyeMat = new T.MeshBasicMaterial({ color: 0xff3020 });
      const threadMat = new T.MeshBasicMaterial({ color: 0xd8dcf0, transparent: true, opacity: 0.55 });
      const shMat = new T.MeshBasicMaterial({ color: 0x000000, alphaMap: TX.blobShadowTexture(), transparent: true, opacity: 0.4, depthWrite: false });
      const spots = [[510, 3.2, 0], [552, -3.0, 3.2], [636, -2.8, 1.6]];
      for (const [s, lat, ph] of spots) {
        const p = track.place(s, lat);
        const g = new T.Group();
        const nI = (q) => (q.index ? q.toNonIndexed() : q);
        const bodyG = BU.mergeGeometries([nI(xf(sph(1.5, 20, 14), { y: 0.6, z: 0.9, sx: 1.15, sy: 0.9, sz: 1.25 })), nI(xf(sph(0.85, 16, 12), { y: 0.5, z: -0.9 }))], false);
        g.add(new T.Mesh(bodyG, bodyMat));
        g.add(new T.Mesh(BU.mergeGeometries([-0.3, 0.3].map((ex) => nI(xf(sph(0.22, 8, 6), { x: ex, y: 0.8, z: -1.62 }))), false), eyeMat));
        const lgs = [];
        for (const sd of [-1, 1]) for (let k = 0; k < 4; k++) {
          const M = new T.Matrix4().compose(new T.Vector3(sd * 0.7, 0.5, -0.6 + k * 0.55), new T.Quaternion().setFromEuler(new T.Euler(0, sd * (0.5 - k * 0.32) + (sd < 0 ? PI : 0), 0)), new T.Vector3(1, 1, 1));
          lgs.push(nI(xf(cyl(0.12, 0.1, 2.2, 6), { x: 0.9, y: 0.6, rz: -1.0 })).applyMatrix4(M));
          lgs.push(nI(xf(cyl(0.1, 0.05, 2.4, 6), { x: 2.35, y: 0.2, rz: 0.55 })).applyMatrix4(M));
        }
        const legM = new T.Mesh(BU.mergeGeometries(lgs, false), legMat); g.add(legM);
        const legs = [legM];
        g.position.set(p.x, SP.top, p.z); g.rotation.y = r() * TAU;
        K.add(g, { cast: true, receive: false });
        const thread = new T.Mesh(cyl(0.06, 0.06, 1, 4), threadMat); thread.position.set(p.x, 0, p.z); K.group.add(thread);
        const sh = new T.Mesh(new T.PlaneGeometry(1, 1), shMat.clone()); sh.rotation.x = -PI / 2; sh.position.set(p.x, 0.09, p.z); sh.renderOrder = 1; K.group.add(sh);
        const sp = { x: p.x, z: p.z, s, lat, ph, g, legs, thread, sh, safe: lat > 0 ? lat - 6.5 : lat + 6.5 };
        sp.mover = K.mover({ type: 'circle', r: 2.1, h: 0 }, (t) => { const q = spiderY(sp, t); return { x: sp.x, z: sp.z, angle: 0, h: q.y < 4 ? 3.4 : 0 }; });
        A.spiders.push(sp);
      }
    }

    // ================================================================== big props: the dollhouse furniture
    // ---- dining room: long table, chairs, candelabra (a real light), sideboard; candle wax on the road
    {
      const cx = (HS.xp + HS.xh) / 2, cz = HS.zm + 6.5;
      const f = frame(cx, 0, cz, 0);
      f(rbox(22, 0.7, 8, 0.25), 0x3a1c0e, { y: 4.4 }, mLacq);
      for (const [lx, lz] of [[-10, -3.2], [10, -3.2], [-10, 3.2], [10, 3.2]]) f(cyl(0.45, 0.3, 4.1, 10), 0x2a140a, { x: lx, y: 2.05, z: lz }, mLacq);
      f(box(18, 0.08, 4), 0xe8e0d0, { y: 4.8 }, mCloth); // table runner
      for (const sd of [-1, 1]) { // carver chairs at both ends
        const lx = sd * 13;
        f(box(3.2, 0.5, 3.4), 0x2e160c, { x: lx, y: 2.6 }, mLacq);
        f(box(0.5, 6.6, 3.4), 0x2e160c, { x: lx + sd * 1.6, y: 5.6 }, mLacq);
        f(box(0.3, 3.0, 2.6), 0x7a1a24, { x: lx + sd * 1.4, y: 6.4 }, mCloth);
        f(sph(0.45, 8, 6), 0x2e160c, { x: lx + sd * 1.6, y: 9.1, z: -1.4 }, mLacq); f(sph(0.45, 8, 6), 0x2e160c, { x: lx + sd * 1.6, y: 9.1, z: 1.4 }, mLacq);
        for (const [a, b] of [[-1.3, -1.4], [1.3, -1.4], [-1.3, 1.4], [1.3, 1.4]]) f(cyl(0.22, 0.2, 2.6, 6), 0x2e160c, { x: lx + a, y: 1.3, z: b }, mLacq);
        AO(cx + lx, cz, 2.4, 2.4, 0.35);
        K.box(cx + lx, cz, 1.8, 1.8, 0, 9);
      }
      // plates and goblets
      for (const lx of [-7, 0, 7]) { f(cyl(1.2, 1.0, 0.15, 16), 0xe8e4dc, { x: lx, y: 4.85, z: -2.2 }, mGloss); f(lathe([[0.5, 0], [0.12, 0.2], [0.1, 1.0], [0.55, 1.5], [0.6, 2.1]], 10), 0xb89a5a, { x: lx + 1.8, y: 4.8, z: -2.4 }, mMetal); }
      // candelabra: five arms
      f(lathe([[1.4, 0], [0.5, 0.4], [0.35, 3.5], [0.6, 3.8], [0.3, 4.2]], 14), 0xc9a24a, { y: 4.8 }, mMetal);
      for (let k = -2; k <= 2; k++) {
        const ax = k * 1.6, ay = 4.8 + 4.2 + (k === 0 ? 1.2 : 0);
        if (k !== 0) f(box(Math.abs(ax) + 0.3, 0.25, 0.25), 0xc9a24a, { x: ax / 2, y: 4.8 + 3.9, z: 0 }, mMetal);
        f(cyl(0.45, 0.35, 0.4, 10), 0xc9a24a, { x: ax, y: ay - 0.2, z: 0 }, mMetal);
        f(cyl(0.3, 0.32, 2.4, 10), 0xf0e6d0, { x: ax, y: ay + 1.2, z: 0 }, mWax);
        f(new T.ConeGeometry(0.28, 1.0, 8), 0xffc060, { x: ax, y: ay + 2.9, z: 0 }, mGlow, false);
        HALO(cx + ax, ay + 2.9, cz, 0xffa040, 1, false);
      }
      HALO(cx, 15, cz, 0xff9030, 0.5, true);
      POOL(cx, 0.3, cz + 2, 34, 24, 0xff8a30, 0.32, 1);
      A.candleLight = new T.PointLight(0xffa050, 150, 70, 2); A.candleLight.position.set(cx, 14, cz + 3); K.group.add(A.candleLight);
      AO(cx, cz, 13, 6, 0.45);
      K.box(cx, cz - 1, 11.5, 4.6, 0, 5.2);
      // wax drips from the table onto the road: slick
      const q = track.place(sAt(cx, -38) + 2, 3.2);
      const waxM = K.phys({ color: 0xe6dcc4, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08, emissive: 0x2a1c0a, sheen: 0.6, sheenColor: new T.Color(0xfff0d0) });
      const sp = K.spill(q.x, q.z, 2.7, waxM, { lump: 0.22, stretch: 1.25, angle: q.angle, y: 0.14, thick: 0.14 });
      K.surface('slick', { poly: sp.poly });
      for (let i = 0; i < 5; i++) K.spill(q.x + r.range(-5, 5), q.z - 3 - r() * 4, r.range(0.5, 1.0), waxM, { y: 0.13, thick: 0.1, n: 14 });
      // sideboard against the front wall with a candle and a skull
      const sb = frame(cx + 6, 0, HS.zf - 3.6, 0);
      sb(rbox(14, 3.4, 3.4, 0.2), 0x2a140a, { y: 1.9 }, mLacq);
      for (const lx of [-3.5, 3.5]) sb(box(6, 2.4, 0.1), 0x3a1c0e, { x: lx, y: 1.9, z: 1.75 }, mLacq);
      sb(sph(1.0, 14, 10), 0xe8e2d0, { x: -4, y: 4.4, z: 0, sy: 0.9 }, mGloss);
      sb(cyl(0.3, 0.3, 1.8, 8), 0xf0e6d0, { x: 4, y: 4.5, z: 0 }, mWax);
      sb(new T.ConeGeometry(0.25, 0.8, 8), 0xffc060, { x: 4, y: 5.8, z: 0 }, mGlow, false);
      HALO(cx + 10, 5.8, HS.zf - 3.6, 0xffa040, 0.9, false);
      AO(cx + 6, HS.zf - 3.6, 8, 2.6, 0.4);
      K.box(cx + 6, HS.zf - 3.6, 7, 1.8, 0, 4);
    }
    // ---- fireplace + portraits on the hall back wall; hall table, coat stand
    const portraits = [];
    const portrait = (x, y, z, ry, w, h, kind) => portraits.push({ x, y, z, ry, w, h, kind });
    {
      // fireplace in the hall (on the platform face)
      const fx = -22, fz = HS.zm + 1.2;
      const f = frame(fx, 0, fz, 0);
      f(box(12, 7.4, 2), 0x2a2622, { y: 3.7 }, mGloss);
      f(box(13.4, 0.6, 2.8), 0x1a1614, { y: 7.5 }, mGloss);
      f(box(6.4, 4.6, 0.6), 0x050302, { y: 2.3, z: 0.75 }, mPlain);
      f(box(4.6, 0.5, 1.2), 0x241008, { y: 0.6, z: 1.0 }, mWood);
      f(new T.ConeGeometry(0.7, 1.6, 6), 0xff7a20, { x: -0.8, y: 1.5, z: 1.1 }, mGlow, false);
      f(new T.ConeGeometry(0.55, 1.2, 6), 0xffb040, { x: 0.8, y: 1.3, z: 1.2 }, mGlow, false);
      HALO(fx, 1.8, fz + 1.8, 0xff6a20, 0.8, false);
      POOL(fx, 0.3, fz + 6, 16, 10, 0xff6a20, 0.35, 1);
      K.box(fx, fz, 6.7, 1.4, 0, 8);
      AO(fx, fz + 1, 7, 2.5, 0.4);
      portrait(-34, 4.4, HS.zm + 1.35, 0, 5, 6.2, 'lady');
      portrait(-76, 4.4, HS.zm + 1.35, 0, 5, 6.2, 'gent');
    }
    // ---- stair hall: grandfather clock, piano, round rug, a fern, portrait
    {
      // grandfather clock against the back wall
      const cx = -134, cz = HS.zb + 3;
      const f = frame(cx, 0, cz, 0);
      f(box(6, 3, 4.2), 0x2a120a, { y: 1.5 }, mLacq);
      f(box(4.6, 14, 3.4), 0x34160c, { y: 10 }, mLacq);
      f(box(6.2, 7, 4.4), 0x2a120a, { y: 20.5 }, mLacq);
      f(box(6.8, 1, 4.8), 0x1e0c06, { y: 24.5 }, mLacq);
      f(new T.ConeGeometry(1.2, 2, 4), 0x1e0c06, { y: 26, ry: PI / 4 }, mLacq);
      f(box(3.2, 11, 0.2), 0x1a1210, { y: 10, z: 1.75 }, mGloss); // glass door (dark)
      K.box(cx, cz, 3.2, 2.3, 0, 26);
      AO(cx, cz + 1, 4.5, 3, 0.5);
      const faceC = canvas(128, 128, (g) => { g.fillStyle = '#efe4c8'; g.beginPath(); g.arc(64, 64, 62, 0, TAU); g.fill(); g.strokeStyle = '#2a1a0a'; g.lineWidth = 3; g.stroke(); g.fillStyle = '#2a1a0a'; g.font = '700 15px Georgia'; g.textAlign = 'center'; g.textBaseline = 'middle'; const n = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI']; n.forEach((s, i) => { const a = i * PI / 6 - PI / 2; g.fillText(s, 64 + Math.cos(a) * 47, 64 + Math.sin(a) * 47); }); g.lineWidth = 4; g.beginPath(); g.moveTo(64, 64); g.lineTo(64, 26); g.moveTo(64, 64); g.lineTo(90, 70); g.stroke(); });
      const face = new T.Mesh(new T.CircleGeometry(2.4, 32), K.std({ map: tex(faceC, [1, 1], false), roughness: 0.5 })); face.position.set(cx, 21, cz + 2.25); K.group.add(face); keep.push(face);
      // pendulum (animated)
      const pend = new T.Group(); pend.position.set(cx, 16, cz + 1.4);
      const rod = new T.Mesh(cyl(0.12, 0.12, 9, 6), K.metal(0xc9a24a, 0.3)); rod.position.y = -4.5; pend.add(rod);
      const bob = new T.Mesh(cyl(1.2, 1.2, 0.25, 20), K.metal(0xd8b25a, 0.25)); bob.rotation.x = PI / 2; bob.position.y = -9; pend.add(bob);
      K.add(pend, { cast: false }); A.pend = pend; A.clockPos = [cx, cz];
      // upright piano against the front wall
      const px = -118, pz = HS.zf - 3.4;
      const pf = frame(px, 0, pz, PI);
      pf(box(13, 9, 4.4), 0x120808, { y: 4.5 }, mLacq);
      pf(box(13.4, 0.6, 5), 0x0a0404, { y: 9.2 }, mLacq);
      pf(box(12, 0.5, 2.6), 0xf0ece0, { y: 4.6, z: 3.4 }, mGloss);
      for (let k = 0; k < 14; k++) pf(box(0.3, 0.35, 1.4), 0x080808, { x: -5.6 + k * 0.85 + (k % 7 === 2 || k % 7 === 6 ? 99 : 0), y: 4.95, z: 3.0 }, mGloss);
      pf(box(12.6, 0.6, 3.2), 0x120808, { y: 4.1, z: 3.2 }, mLacq);
      pf(box(10, 3.6, 0.1), 0x2a1810, { y: 7, z: 2.25 }, mWood);
      for (const lx of [-5.6, 5.6]) pf(box(0.8, 4, 0.8), 0x120808, { x: lx, y: 2, z: 4.4 }, mLacq);
      pf(cyl(0.3, 0.3, 1.6, 8), 0xf0e6d0, { x: 4.5, y: 10.3, z: 0 }, mWax); pf(new T.ConeGeometry(0.22, 0.7, 8), 0xffc060, { x: 4.5, y: 11.4, z: 0 }, mGlow, false);
      HALO(px - 4.5, 11.4, pz, 0xffa040, 0.9, false);
      // sheet music
      pf(box(3, 2.2, 0.05), 0xe8e0c8, { x: -1.8, y: 6.6, z: 2.5, rx: -0.2 }, mPlain); pf(box(3, 2.2, 0.05), 0xe0d8c0, { x: 1.4, y: 6.6, z: 2.5, rx: -0.2 }, mPlain);
      K.box(px, pz, 6.6, 2.4, 0, 9.5);
      AO(px, pz, 8, 3.4, 0.5);
      // potted fern in the corner
      const ff = frame(HS.x0 + 6, 0, HS.zf - 6, 0);
      ff(lathe([[1.6, 0], [2.2, 3.4], [2.4, 3.6], [0.001, 3.6]], 14), 0x6a2a1a, {}, mGloss);
      for (let k = 0; k < 9; k++) { const a = k * TAU / 9; ff(new T.ConeGeometry(0.9, 6, 4), 0x1e3a1a, { x: Math.cos(a) * 1.6, y: 5.2, z: Math.sin(a) * 1.6, rz: Math.cos(a) * 0.7, rx: -Math.sin(a) * 0.7, sz: 0.3 }, mPlain); }
      K.circle(HS.x0 + 6, HS.zf - 6, 2.4, 6); AO(HS.x0 + 6, HS.zf - 6, 3, 3, 0.45);
      // round rug inside the hairpin with a raven on a marble pedestal
      const rc = canvas(256, 256, (g) => {
        g.fillStyle = 'rgba(0,0,0,0)'; g.clearRect(0, 0, 256, 256);
        const ring = (rad, col) => { g.fillStyle = col; g.beginPath(); g.arc(128, 128, rad, 0, TAU); g.fill(); };
        ring(126, '#2a1418'); ring(118, '#6a2a24'); ring(104, '#3a1a2a'); ring(80, '#8a5a2a'); ring(70, '#2a1a30'); ring(30, '#7a2a2a');
        g.strokeStyle = 'rgba(220,180,90,0.7)'; g.lineWidth = 3; for (let k = 0; k < 16; k++) { const a = k * TAU / 16; g.beginPath(); g.moveTo(128 + Math.cos(a) * 34, 128 + Math.sin(a) * 34); g.quadraticCurveTo(128 + Math.cos(a + 0.2) * 60, 128 + Math.sin(a + 0.2) * 60, 128 + Math.cos(a) * 68, 128 + Math.sin(a) * 68); g.stroke(); }
        for (let i = 0; i < 2500; i++) { const a = r() * TAU, d = Math.sqrt(r()) * 124; g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '200,190,170'},${r() * 0.18})`; g.fillRect(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, 2, 2); }
      });
      const rug = new T.Mesh(new T.CircleGeometry(9, 48), K.std({ map: tex(rc, [1, 1], false), transparent: true, roughness: 1 }));
      rug.rotation.x = -PI / 2; rug.position.set(-118, 0.09, -57); rug.receiveShadow = true; K.group.add(rug); keep.push(rug);
      const rv = frame(-118, 0, -57, 0.6);
      rv(lathe([[2.2, 0], [2.2, 0.8], [1.6, 1.2], [1.1, 1.6], [1.0, 5.6], [1.6, 6.0], [1.9, 6.6], [1.9, 7.2], [0.001, 7.2]], 20), 0xd8d2c8, {}, mGloss);
      rv(sph(1.3, 14, 10), 0x0a0a10, { y: 8.6, sx: 1.5, sz: 0.9 }, mGloss);
      rv(sph(0.8, 12, 8), 0x0a0a10, { x: 1.6, y: 9.8 }, mGloss);
      rv(new T.ConeGeometry(0.3, 1.2, 6), 0x2a2a2a, { x: 2.6, y: 9.7, rz: -PI / 2 }, mGloss);
      rv(box(2.6, 0.2, 1.4), 0x0a0a10, { x: -2, y: 8.3, rz: 0.4 }, mGloss);
      rv(sph(0.16, 6, 4), 0xffd040, { x: 2.0, y: 10.1, z: 0.55 }, mGlow, false);
      rv(sph(0.16, 6, 4), 0xffd040, { x: 2.0, y: 10.1, z: -0.55 }, mGlow, false);
      K.circle(-118, -57, 2.3, 10); AO(-118, -57, 3, 3, 0.5, 0, 0.12);
      portrait(-148, 15, HS.zb + 0.7, 0, 7, 9, 'gent');
      portrait(-102, 15, HS.zb + 0.7, 0, 7, 9, 'cat');
    }
    // ---- hall: coat stand, hall table, umbrella stand, doormat
    {
      const hx = -4, hz = HS.zm + 4;
      const f = frame(hx, 0, hz, 0);
      f(rbox(8, 0.5, 3.4, 0.15), 0x2a140a, { y: 4.2 }, mLacq);
      for (const [a, b] of [[-3.5, -1.3], [3.5, -1.3], [-3.5, 1.3], [3.5, 1.3]]) f(cyl(0.25, 0.2, 4, 6), 0x2a140a, { x: a, y: 2, z: b }, mLacq);
      f(lathe([[0.8, 0], [1.1, 1.0], [0.6, 2.2], [0.8, 2.6]], 12), 0x3a4a6a, { x: -2, y: 4.45 }, mGloss);
      for (let k = 0; k < 4; k++) f(cyl(0.05, 0.05, 2.4, 4), 0x3a2a1a, { x: -2 + (k - 1.5) * 0.3, y: 7.6, z: (k % 2) * 0.3, rz: (k - 1.5) * 0.25 }, mPlain);
      f(cyl(0.3, 0.3, 1.6, 8), 0xf0e6d0, { x: 2.5, y: 5.2 }, mWax); f(new T.ConeGeometry(0.22, 0.7, 8), 0xffc060, { x: 2.5, y: 6.4 }, mGlow, false);
      HALO(hx + 2.5, 6.4, hz, 0xffa040, 0.9, false);
      POOL(hx, 0.3, hz + 3, 14, 10, 0xff9a40, 0.22, 1);
      K.box(hx, hz, 4.2, 1.8, 0, 5); AO(hx, hz, 5, 2.5, 0.4);
      // coat stand in the corner (tall, but at the north side of the room)
      const cs = frame(-38, 0, HS.zm + 4, 0);
      cs(cyl(0.3, 0.35, 13, 8), 0x2a140a, { y: 6.5 }, mLacq);
      for (let k = 0; k < 3; k++) { const a = k * TAU / 3; cs(cyl(0.2, 0.2, 2.6, 6), 0x2a140a, { x: Math.cos(a) * 0.9, y: 0.6, z: Math.sin(a) * 0.9, rz: PI / 2 - 0.3, ry: -a }, mLacq); }
      cs(cyl(1.6, 1.0, 5, 10), 0x1a1a22, { y: 9, z: 0.5 }, mCloth); // a cloak
      cs(cyl(1.4, 1.4, 0.3, 14), 0x101014, { y: 13.3 }, mCloth); cs(cyl(0.8, 0.9, 1.6, 12), 0x101014, { y: 14.2 }, mCloth); // top hat
      K.circle(-38, HS.zm + 4, 1.6, 14); AO(-38, HS.zm + 4, 2.5, 2.5, 0.4);
      // doormat outside the front door
      const mc = canvas(256, 128, (g) => { g.fillStyle = '#5a3a1e'; g.fillRect(0, 0, 256, 128); for (let i = 0; i < 2000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '30,18,8' : '140,100,60'},0.35)`; g.fillRect(r() * 256, r() * 128, 1, 4); } g.strokeStyle = '#1a0e06'; g.lineWidth = 8; g.strokeRect(10, 10, 236, 108); g.fillStyle = '#1a0e06'; g.font = '700 46px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('BEWARE', 128, 66); });
      const dp = track.at(sDoor.s + 7);
      const dmm = new T.Mesh(new T.PlaneGeometry(13, 6.5), K.std({ map: tex(mc, [1, 1], false), roughness: 1 }));
      dmm.rotation.order = 'YXZ'; dmm.rotation.y = -dp.angle - PI / 2; dmm.rotation.x = -PI / 2; dmm.position.set(dp.x, 0.11, dp.z); dmm.receiveShadow = true; K.group.add(dmm); keep.push(dmm);
            // the open front door, swung back against the front wall
      const dg = frame(sDoor.x + doorGap + 1, 0, HS.zf + 0.3, 0);
      dg(box(0.5, 9, 8), 0x3a1020, { x: 0.3, y: 4.5, z: 4 }, mLacq);
      for (const [a, b] of [[2, 2], [6, 2], [2, 6.6], [6, 6.6]]) dg(box(0.2, 3, 2.6), 0x2a0a16, { x: 0.6, y: b, z: a }, mLacq);
      dg(sph(0.35, 8, 6), 0xc9a24a, { x: 0.7, y: 4.5, z: 7 }, mMetal);
      // porch lanterns on the front wall either side of the door, and a house number
      for (const sd of [-1, 1]) {
        const lx = sDoor.x + sd * (doorGap + 1 + (sd > 0 ? 3.2 : 0)), lz = HS.zf;
        const lf = frame(lx, 3.4, lz, 0);
        lf(box(1.8, 0.3, 1.8), 0x15151a, { y: 0.15 }, mMetal);
        lf(box(1.4, 2.0, 1.4), 0xffc060, { y: 1.3 }, mGlow, false);
        for (const [a, b] of [[-0.75, -0.75], [0.75, -0.75], [-0.75, 0.75], [0.75, 0.75]]) lf(box(0.2, 2.2, 0.2), 0x15151a, { x: a, y: 1.3, z: b }, mMetal);
        lf(new T.ConeGeometry(1.4, 1.2, 4), 0x15151a, { y: 2.9, ry: PI / 4 }, mMetal);
        HALO(lx, 4.8, lz, 0xffb050, 1, false); HALO(lx, 4.8, lz + 0.5, 0xff9a40, 0.5, true);
        POOL(lx, 0.3, lz + 4, 14, 10, 0xffa050, 0.3, 1);
      }
      const nc = canvas(64, 64, (g) => { g.fillStyle = '#1a1a20'; g.fillRect(0, 0, 64, 64); g.strokeStyle = '#c9a24a'; g.lineWidth = 4; g.strokeRect(4, 4, 56, 56); g.fillStyle = '#e0c060'; g.font = '700 34px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('13', 32, 34); });
      const num = new T.Mesh(new T.PlaneGeometry(1.8, 1.8), K.std({ map: tex(nc, [1, 1], false), roughness: 0.5, emissive: 0x302810 }));
      num.position.set(sDoor.x - doorGap - 4.5, 1.9, HS.zf + 0.64); K.group.add(num); keep.push(num);
      K.box(sDoor.x + doorGap + 1.3, HS.zf + 4.3, 0.35, 4, 0, 9);
    }
    // ---- kitchen: iron range, table with a pie, shelves with jars, a cauldron, a broom
    {
      const f = frame(20, 0, HS.zm + 4, 0);
      f(box(14, 6.4, 5), 0x1a1a1c, { y: 3.2 }, mMetal);
      f(box(14.6, 0.5, 5.6), 0x0e0e10, { y: 6.6 }, mMetal);
      f(box(4, 3, 0.2), 0x4a1a08, { x: -3.5, y: 3, z: 2.55 }, mGlow, false); // fire glow behind the grate
      f(cyl(0.8, 0.8, 14, 8), 0x1a1a1c, { x: 5, y: 13, z: -1.5 }, mMetal);
      f(lathe([[1.8, 0], [2.2, 1.6], [2.0, 2.6], [1.6, 2.8]], 14), 0x2a2a2e, { x: 2, y: 6.9 }, mMetal); // pot
      HALO(17, 3, HS.zm + 6.8, 0xff5a10, 0.7, false);
      POOL(17, 0.3, HS.zm + 10, 14, 10, 0xff6020, 0.3, 1);
      K.box(20, HS.zm + 4, 7.3, 2.8, 0, 7);
      AO(20, HS.zm + 4, 8, 3.4, 0.5);
      const t = frame(22, 0, -30, 0);
      t(rbox(14, 0.6, 8, 0.2), 0x6a4a2a, { y: 4.2 }, mWood);
      for (const [a, b] of [[-6, -3], [6, -3], [-6, 3], [6, 3]]) t(box(0.7, 4, 0.7), 0x5a3a20, { x: a, y: 2, z: b }, mWood);
      t(cyl(2.2, 1.9, 1.0, 20), 0xc88a3a, { x: -3, y: 5.0 }, mGloss); t(cyl(2.4, 2.4, 0.15, 20), 0xe8e4dc, { x: -3, y: 4.55 }, mGloss);
      t(lathe([[2.4, 0], [2.8, 1.6], [2.4, 3.2], [1.8, 3.5]], 16), 0x101012, { x: 3.5, y: 4.5 }, mMetal); // cauldron
      t(cyl(2.0, 2.0, 0.1, 16), 0x5aff6a, { x: 3.5, y: 7.6 }, mGlow, false);
      HALO(25.5, 8, -30, 0x6aff7a, 0.7, false);
      POOL(25.5, 0.3, -30, 12, 10, 0x40ff60, 0.18, 0);
      K.box(22, -30, 7, 4, 0, 5); AO(22, -30, 8, 5, 0.45);
      // shelves of jars against the hall partition
      const sh = frame(HS.xk + 1.6, 0, -36, PI / 2);
      for (const y of [3, 6.5, 10]) sh(box(12, 0.4, 2.4), 0x4a2e18, { y }, mWood);
      sh(box(12, 10.4, 0.3), 0x3a2414, { y: 5.2, z: -1.2 }, mWood);
      for (const y of [3, 6.5]) for (let k = 0; k < 5; k++) sh(cyl(0.7, 0.7, 2, 10), [0x7a3a8a, 0x3a7a4a, 0xc8a040, 0x8a2a2a, 0x40608a][(k + y | 0) % 5], { x: -4.5 + k * 2.2, y: y + 1.2 }, mGloss);
      K.box(HS.xk + 1.6, -36, 1.4, 6, 0, 10);
    }
    // ---- upper floor: bedroom with a four-poster bed and wardrobe
    {
      const bx = -66, bz = HS.zb + 6.4;
      const f = frame(bx, H, bz, 0);
      f(box(16, 2.6, 10.8), 0x2a140a, { y: 1.8 }, mLacq);
      f(rbox(15, 1.6, 10.4, 0.6), 0xd8d0c4, { y: 3.8 }, mCloth);
      f(rbox(15.4, 0.9, 7, 0.4), 0x5a1e34, { y: 4.7, z: 1.8 }, mCloth); // counterpane
      for (const lx of [-4, 4]) f(rbox(5, 1.1, 2.4, 0.5), 0xece6da, { x: lx, y: 4.9, z: -3.6 }, mCloth);
      for (const [a, b] of [[-7.6, -5], [7.6, -5], [-7.6, 5], [7.6, 5]]) f(cyl(0.45, 0.45, 15, 10), 0x2a140a, { x: a, y: 7.5, z: b }, mLacq);
      f(box(16.4, 0.8, 11), 0x2a140a, { y: 15.2 }, mLacq);
      f(box(16, 3.6, 0.15), 0x3a0e1a, { y: 13.2, z: 5.1 }, mCloth); // canopy valance
      for (const sx of [-1, 1]) f(box(0.2, 11, 3), 0x3a0e1a, { x: sx * 7.9, y: 9.4, z: 3.6, rz: sx * 0.03 }, mCloth); // curtains tied back
      f(box(16, 7, 0.8), 0x2a140a, { y: 7, z: -5.3 }, mLacq); // headboard
      K.box(bx, bz, 8.2, 5.6, 0, H + 15);
      AO(bx, bz, 9, 6.5, 0.5, 0, H + 0.08);
      // nightstand with candle
      const n = frame(bx + 11, H, HS.zb + 3, 0);
      n(box(4, 4, 3.4), 0x2a140a, { y: 2 }, mLacq);
      n(cyl(0.3, 0.3, 1.6, 8), 0xf0e6d0, { y: 4.8 }, mWax); n(new T.ConeGeometry(0.22, 0.7, 8), 0xffc060, { y: 6, z: 0 }, mGlow, false);
      HALO(bx + 11, H + 6, HS.zb + 3, 0xffa040, 0.9, false);
      POOL(bx + 8, H + 0.3, HS.zb + 8, 16, 12, 0xff9a40, 0.22, 1);
      K.box(bx + 11, HS.zb + 3, 2.2, 1.9, 0, H + 4.5);
      // blanket chest at the south side (low)
      const c = frame(-62, H, HS.zm - 4.6, 0);
      c(rbox(10, 3.2, 4.4, 0.4), 0x4a2a14, { y: 1.6 }, mLacq);
      for (const lx of [-4, 4]) c(box(0.5, 3.3, 4.5), 0x2a2a2e, { x: lx, y: 1.6 }, mMetal);
      K.box(-62, HS.zm - 4.6, 5, 2.3, 0, H + 3.4);
      AO(-62, HS.zm - 4.6, 6, 3, 0.45, 0, H + 0.08);
      portrait(-50, H + 12, HS.zb + 0.7, 0, 7, 9, 'lady');
      // dusty rug across part of the road: slow
      const rp = track.place(sAt(-76, -76), 3.0);
      const rugC = canvas(256, 160, (g) => { g.fillStyle = '#6a5a52'; g.fillRect(0, 0, 256, 160); g.strokeStyle = '#3a2a2a'; g.lineWidth = 10; g.strokeRect(12, 12, 232, 136); g.fillStyle = 'rgba(120,60,60,0.5)'; g.beginPath(); g.ellipse(128, 80, 70, 40, 0, 0, TAU); g.fill(); for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(200,195,185,${r() * 0.3})`; g.fillRect(r() * 256, r() * 160, 2, 2); } });
      const rug = new T.Mesh(new T.PlaneGeometry(12, 8), K.std({ map: tex(rugC, [1, 1], false), roughness: 1 }));
      rug.rotation.order = 'YXZ'; rug.rotation.y = -rp.angle; rug.rotation.x = -PI / 2; rug.position.set(rp.x, H + 0.15, rp.z); rug.receiveShadow = true; K.group.add(rug); keep.push(rug);
      const ca = Math.cos(rp.angle), sa = Math.sin(rp.angle);
      K.surface('slow', { poly: [[-6, -4], [6, -4], [6, 4], [-6, 4]].map(([a, b]) => [rp.x + a * ca - b * sa, rp.z + a * sa + b * ca]) });
    }
    // ---- nursery: the creeping rocking chair (mover), rocking horse, blocks, a cradle
    {
      const sC = sAt(-24, -77), pc = track.place(sC, -14.5), pin = track.place(sC, -6.0);
      A.chairA = [pc.x, pc.z]; A.chairB = [pin.x, pin.z]; A.chairAng = pc.angle;
      const g = new T.Group();
      const wd = K.std({ color: 0x8a5a34, roughness: 0.5, map: grainTex });
      const cg = [], nI = (q) => (q.index ? q.toNonIndexed() : q);
      for (const sd of [-1, 1]) {
        cg.push(nI(xf(new T.TorusGeometry(7, 0.3, 6, 24, 0.95), { rz: -PI / 2 - 0.475, y: 7.2, z: sd * 2.0, order: 'XYZ' })));
        for (const lx of [-1.5, 1.5]) cg.push(nI(xf(box(0.4, 2.6, 0.4), { x: lx, y: 1.6, z: sd * 2.0 })));
        cg.push(nI(xf(box(4.4, 0.35, 0.5), { x: 0.3, y: 4.6, z: sd * 2.0 })));
        cg.push(nI(xf(box(0.4, 1.7, 0.4), { x: 1.8, y: 3.8, z: sd * 2.0 })));
      }
      cg.push(nI(xf(box(4, 0.4, 4.4), { y: 2.9 })));
      cg.push(nI(xf(box(0.4, 6.4, 4.2), { x: -2.1, y: 6.2, rz: -0.15 })));
      for (let k = -1.4; k <= 1.41; k += 0.7) cg.push(nI(xf(cyl(0.12, 0.12, 5.6, 5), { x: -2.1, y: 6, z: k, rz: -0.15 })));
      g.add(new T.Mesh(BU.mergeGeometries(cg.map((q) => { for (const k of Object.keys(q.attributes)) if (!['position', 'normal', 'uv'].includes(k)) q.deleteAttribute(k); return q; }), false), wd));
      const shawl = new T.Mesh(rbox(3.6, 0.5, 4.6, 0.25), K.phys({ color: 0x5a6a7a, roughness: 0.9, sheen: 1, sheenColor: new T.Color(0xaabbcc) })); shawl.position.set(-1.7, 8.6, 0); shawl.rotation.z = 1.2; g.add(shawl);
      const holder = new T.Group(); holder.add(g); g.position.y = 0;
      holder.position.set(pc.x, H, pc.z); holder.rotation.y = -pc.angle - PI / 2;
      K.add(holder); A.chair = { holder, g };
      A.chairSh = K.contact(pc.x, pc.z, 3.6, 3.6, 0.45, 0, H + 0.08);
      K.mover({ type: 'box', hw: 2.6, hd: 2.9, h: H + 5 }, (t) => { const q = chairPose(t); return { x: lerp(A.chairA[0], A.chairB[0], q.k), z: lerp(A.chairA[1], A.chairB[1], q.k), angle: A.chairAng }; });
      // rocking horse at the south side
      const hf = frame(-28, H, HS.zm - 5, 0.25);
      for (const sd of [-1, 1]) hf(new T.TorusGeometry(8, 0.3, 6, 20, 0.9), 0x5a2a12, { y: 8.2, z: sd * 1.5, rz: -PI / 2 - 0.45 }, mLacq);
      hf(rbox(6, 2.6, 2.4, 1.0), 0xe8e0d0, { y: 4.4 }, mGloss);
      hf(rbox(1.6, 3.6, 1.8, 0.7), 0xe8e0d0, { x: 3, y: 6.2, rz: -0.4 }, mGloss);
      hf(rbox(3, 1.4, 1.4, 0.6), 0xe8e0d0, { x: 4.4, y: 7.6, rz: 0.4 }, mGloss);
      for (let k = 0; k < 6; k++) hf(box(0.4, 1.6, 0.5), 0x2a1a10, { x: 2.4 + k * 0.4, y: 7 + k * 0.35, rz: -0.6 }, mWood);
      hf(box(1.6, 0.4, 2.6), 0x9a1a1a, { y: 5.8 }, mCloth);
      for (const [a, b] of [[-2, -1], [2, -1], [-2, 1], [2, 1]]) hf(cyl(0.3, 0.25, 2.6, 6), 0xe8e0d0, { x: a, y: 2.4, z: b * 0.9, rz: a * 0.1 }, mGloss);
      K.box(-28, HS.zm - 5, 4.5, 2.2, 0.25, H + 8);
      AO(-28, HS.zm - 5, 5, 2.5, 0.4, -0.25, H + 0.08);
      // toy blocks
      const bl = [];
      for (let k = 0; k < 9; k++) { const x = -14 + r.range(-4, 4), z = HS.zm - 4 + r.range(-2.5, 2.5); bl.push({ x, y: H + 0.9 + (k > 6 ? 1.8 : 0), z, ry: r() * TAU, s: 1, color: [0xb83a2a, 0x2a6ab8, 0xd8b030, 0x3a9a4a][k % 4] }); }
      K.instances(rbox(1.8, 1.8, 1.8, 0.15), K.phys({ roughness: 0.5, clearcoat: 0.4 }), bl, { colors: true });
      K.circle(-14, HS.zm - 4, 3.5, H + 3);
      // cradle at the back
      const cf = frame(-12, H, HS.zb + 4.5, 0);
      cf(lathe([[0.001, 0], [3, 0.2], [3.6, 2.6], [3.8, 3]], 18), 0xe0d4c0, { y: 1.6, sz: 0.6 }, mWood);
      for (const sd of [-1, 1]) cf(new T.TorusGeometry(2.5, 0.25, 6, 14, PI * 0.6), 0xc8b8a0, { x: sd * 3, y: 0.4, rx: 0, ry: PI / 2, rz: PI * 0.2 }, mWood);
      cf(rbox(4.4, 1.4, 2.6, 0.6), 0xd8e0f0, { y: 3.4 }, mCloth);
      K.box(-12, HS.zb + 4.5, 3.8, 2.4, 0, H + 4);
      AO(-12, HS.zb + 4.5, 4.5, 3, 0.4, 0, H + 0.08);
      portrait(-28, H + 12, HS.zb + 0.7, 0, 7, 9, 'doll');
    }
    // ---- study: bookshelves, desk with candle, skull and quill, globe, armchair
    {
      for (const x0 of [8, 22]) {
        const f = frame(x0, H, HS.zb + 2.2, 0);
        f(box(12, 18, 3.6), 0x2a160c, { y: 9 }, mLacq);
        for (let y = 1; y < 18; y += 4.2) {
          f(box(11.4, 0.4, 3.4), 0x1e0e06, { y, z: 0.2 }, mWood);
          let x = -5.4;
          while (x < 5.2) { const w = 0.5 + r() * 0.6, h = 2.4 + r() * 1.2; f(box(w, h, 2.6), [0x5a1a1a, 0x1a3a2a, 0x2a2a4a, 0x6a4a1a, 0x3a1a3a][Math.floor(r() * 5)], { x: x + w / 2, y: y + 0.2 + h / 2, z: 0.6, rz: r() < 0.1 ? 0.2 : 0 }, mPlain); x += w + 0.06; }
        }
        K.box(x0, HS.zb + 2.2, 6, 1.8, 0, H + 18);
        AO(x0, HS.zb + 3, 7, 2.6, 0.5, 0, H + 0.08);
      }
      // desk at the south side
      const d = frame(14, H, HS.zm - 4.0, 0);
      d(rbox(12, 0.6, 5, 0.2), 0x3a1a0c, { y: 4.4 }, mLacq);
      for (const lx of [-4.5, 4.5]) d(box(3, 4.1, 4.6), 0x2a140a, { x: lx, y: 2.05 }, mLacq);
      d(sph(1.1, 14, 10), 0xe8e2d0, { x: -3.5, y: 5.8, sy: 0.9 }, mGloss); // skull
      for (const ex of [-0.4, 0.4]) d(sph(0.28, 8, 6), 0x0a0806, { x: -3.5 + ex, y: 5.9, z: 0.95 }, mPlain);
      d(box(3.6, 0.3, 2.6), 0xe8dcc0, { x: 0.5, y: 4.85, rz: 0.02 }, mPlain); // open book
      d(cyl(0.3, 0.3, 1.6, 8), 0xf0e6d0, { x: 3.5, y: 5.5 }, mWax); d(new T.ConeGeometry(0.22, 0.7, 8), 0xffc060, { x: 3.5, y: 6.7 }, mGlow, false);
      d(cyl(0.05, 0.05, 3.2, 4), 0xf0f0f0, { x: 1.5, y: 5.8, z: 0.5, rz: 0.6 }, mPlain);
      HALO(17.5, H + 6.7, HS.zm - 4.0, 0xffa040, 0.9, false);
      POOL(15, H + 0.3, HS.zm - 8, 18, 12, 0xff9a40, 0.24, 1);
      K.box(14, HS.zm - 4.0, 6.2, 2.6, 0, H + 6);
      AO(14, HS.zm - 4.0, 7, 3, 0.45, 0, H + 0.08);
      // globe
      const gf = frame(32, H, HS.zm - 5, 0);
      gf(lathe([[2, 0], [0.4, 0.6], [0.3, 4.2], [0.5, 4.6]], 12), 0x2a160c, {}, mLacq);
      gf(sph(2.4, 20, 14), 0x8a7a4a, { y: 7, rz: 0.4 }, mGloss);
      gf(new T.TorusGeometry(2.7, 0.12, 6, 28, PI * 1.2), 0xc9a24a, { y: 7, rz: 0.4, ry: PI / 2 }, mMetal);
      K.circle(32, HS.zm - 5, 2.6, H + 9.5); AO(32, HS.zm - 5, 3, 3, 0.4, 0, H + 0.08);
      portrait(38, H + 12, HS.zb + 0.7, 0, 6, 8, 'gent');
    }
    // ---- portraits with eyes that follow the cars
    {
      const paint = (kind) => canvas(128, 160, (g) => {
        const bg = g.createLinearGradient(0, 0, 0, 160); bg.addColorStop(0, '#2a2418'); bg.addColorStop(1, '#0e0c08'); g.fillStyle = bg; g.fillRect(0, 0, 128, 160);
        const skin = kind === 'cat' ? '#1a1a1e' : kind === 'doll' ? '#f0d8c8' : '#c8a888';
        if (kind === 'lady') { g.fillStyle = '#3a1028'; g.beginPath(); g.ellipse(64, 150, 52, 50, 0, PI, 0); g.fill(); g.fillStyle = '#1a120c'; g.beginPath(); g.ellipse(64, 56, 34, 40, 0, 0, TAU); g.fill(); g.beginPath(); g.arc(64, 20, 16, 0, TAU); g.fill(); }
        if (kind === 'gent') { g.fillStyle = '#121216'; g.beginPath(); g.ellipse(64, 152, 56, 54, 0, PI, 0); g.fill(); g.fillStyle = '#e8e0d0'; g.beginPath(); g.moveTo(52, 104); g.lineTo(64, 128); g.lineTo(76, 104); g.fill(); }
        if (kind === 'doll') { g.fillStyle = '#d8b04a'; g.beginPath(); g.ellipse(64, 60, 40, 44, 0, 0, TAU); g.fill(); g.fillStyle = '#6a8ab8'; g.beginPath(); g.ellipse(64, 152, 50, 48, 0, PI, 0); g.fill(); }
        if (kind === 'cat') { g.fillStyle = skin; g.beginPath(); g.moveTo(34, 50); g.lineTo(40, 18); g.lineTo(56, 40); g.lineTo(72, 40); g.lineTo(88, 18); g.lineTo(94, 50); g.fill(); g.beginPath(); g.ellipse(64, 150, 44, 50, 0, PI, 0); g.fill(); }
        g.fillStyle = skin; g.beginPath(); g.ellipse(64, 72, 26, 32, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(0,0,0,0.85)'; for (const ex of [52, 76]) { g.beginPath(); g.ellipse(ex, 66, 7, 5, 0, 0, TAU); g.fill(); } // eye holes (real eyes sit behind)
        if (kind === 'gent') { g.fillStyle = '#2a1a10'; g.beginPath(); g.moveTo(44, 88); g.quadraticCurveTo(64, 78, 84, 88); g.quadraticCurveTo(64, 84, 44, 88); g.fill(); g.fillRect(40, 36, 48, 8); }
        g.strokeStyle = kind === 'cat' ? '#3a3a40' : '#7a3a3a'; g.lineWidth = 2; g.beginPath(); g.moveTo(56, 94); g.quadraticCurveTo(64, 97, 72, 94); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 200; i++) { g.beginPath(); const x = r() * 128, y = r() * 160; g.moveTo(x, y); g.lineTo(x + 4, y + 1); g.stroke(); }
      });
      const mats = {};
      const pupils = [];
      for (const pt of portraits) {
        if (!mats[pt.kind]) mats[pt.kind] = K.std({ map: tex(paint(pt.kind), [1, 1], false), roughness: 0.55 });
        const f = frame(pt.x, pt.y, pt.z, pt.ry);
        // gilt frame
        f(box(pt.w + 1.2, 0.6, 0.6), 0xb8902a, { y: pt.h / 2 + 0.3, z: 0.3 }, mMetal); f(box(pt.w + 1.2, 0.6, 0.6), 0xb8902a, { y: -pt.h / 2 - 0.3, z: 0.3 }, mMetal);
        f(box(0.6, pt.h, 0.6), 0xb8902a, { x: -pt.w / 2 - 0.3, z: 0.3 }, mMetal); f(box(0.6, pt.h, 0.6), 0xb8902a, { x: pt.w / 2 + 0.3, z: 0.3 }, mMetal);
        const cv = new T.Mesh(new T.PlaneGeometry(pt.w, pt.h), mats[pt.kind]); cv.position.set(pt.x, pt.y, pt.z + 0.12); cv.rotation.y = pt.ry; K.group.add(cv); keep.push(cv);
        for (const ex of [52, 76]) {
          const lx = (ex / 128 - 0.5) * pt.w, ly = (0.5 - 66 / 160) * pt.h;
          const ew = 0.16 * pt.w / 5;
          f(sph(ew * 1.6, 10, 8), 0xf0ead8, { x: lx, y: ly, z: 0.16, sz: 0.4 }, mGloss);
          pupils.push({ x: pt.x + lx * Math.cos(pt.ry), y: pt.y + ly, z: pt.z + 0.26, s: ew * 0.85, r: ew * 0.8 });
        }
      }
      const im = K.instances(sph(1, 10, 8), new T.MeshBasicMaterial({ color: 0x0a0604 }), pupils.map((p) => ({ x: p.x, y: p.y, z: p.z, s: p.s })), { cast: false, receive: false });
      A.pupils = { im, list: pupils };
    }

    // ================================================================== the back wall: windows, roof line, turret
    {
      const winC = canvas(64, 128, (g) => { const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#2a3a7a'); gr.addColorStop(1, '#0a1030'); g.fillStyle = gr; g.fillRect(0, 0, 64, 128); g.fillStyle = 'rgba(200,210,255,0.8)'; for (let i = 0; i < 10; i++) g.fillRect(r() * 64, r() * 80, 1.5, 1.5); g.fillStyle = '#05060c'; g.fillRect(29, 0, 6, 128); g.fillRect(0, 60, 64, 6); });
      const wmat = new T.MeshBasicMaterial({ map: tex(winC, [1, 1], false), color: 0x8090c0 });
      const wins = [];
      for (const [x, y] of [[-144, 17], [-120, 17], [-74, H + 13], [-20, H + 13], [26, H + 13]]) {
        const g = new T.PlaneGeometry(5, 9); g.translate(x, y, HS.zb + 0.66); wins.push(g);
        const f = frame(x, y, HS.zb + 0.9, 0);
        f(box(6.4, 0.8, 1.2), 0xe8dfcf, { y: 4.9 }, mWood); f(box(6.4, 0.6, 1.6), 0xe8dfcf, { y: -4.8 }, mWood);
        f(box(0.6, 9.6, 1), 0xe8dfcf, { x: -2.9 }, mWood); f(box(0.6, 9.6, 1), 0xe8dfcf, { x: 2.9 }, mWood);
        for (const sx of [-1, 1]) f(box(1.6, 10.4, 0.4), 0x4a1020, { x: sx * 3.8, y: -0.3, z: 0.3 }, mCloth); // curtains
        HALO(x, y, HS.zb + 2, 0x4a5aa0, 0.35, true, 0);
      }
      const wm = new T.Mesh(BU.mergeGeometries(wins, false), wmat); K.group.add(wm); keep.push(wm);
      // cornice and the roof line: gables with fish-scale shingles, a turret at the west end
      const Z = HS.zb - 0.2;
      P(box(HS.xb - HS.x0 + 6, 1.4, 3), 0xe8dfcf, { x: (HS.xb + HS.x0) / 2, y: 30.6, z: Z }, mWood);
      const shingle = (() => { const c = canvas(128, 128, (g) => { g.fillStyle = '#1a1420'; g.fillRect(0, 0, 128, 128); for (let y = 0; y < 8; y++) for (let x = -1; x < 9; x++) { g.fillStyle = `rgb(${46 + r() * 16 | 0},${34 + r() * 10 | 0},${56 + r() * 18 | 0})`; g.beginPath(); g.arc(x * 16 + (y % 2) * 8 + 8, y * 16 + 8, 8, 0, PI); g.fill(); } }); return K.std({ map: tex(c, [8, 2]), roughness: 0.8 }); })();
      const roof = new T.Group();
      const gab = (x, w, h) => {
        const sh = new T.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(0, h); sh.closePath();
        const g = new T.ExtrudeGeometry(sh, { depth: 1.4, bevelEnabled: false }); g.translate(x, 31.3, Z - 0.7);
        const m = new T.Mesh(g, PAP.outside); roof.add(m);
        const s = Math.hypot(w / 2, h), a = Math.atan2(h, w / 2);
        for (const sd of [-1, 1]) { const b = new T.Mesh(box(s + 1.2, 0.9, 2.6), shingle); b.position.set(x + sd * w / 4, 31.3 + h / 2, Z); b.rotation.z = -sd * a; roof.add(b); }
        const fin = new T.Mesh(new T.ConeGeometry(0.5, 4, 6), K.metal(0x2a2a30, 0.5)); fin.position.set(x, 31.3 + h + 2, Z); roof.add(fin);
      };
      gab(-60, 46, 20); gab(10, 40, 16);
      const back = new T.Mesh(box(HS.xb - HS.x0, 8, 6), shingle); back.position.set((HS.xb + HS.x0) / 2, 33.5, Z - 3.6); back.rotation.x = -0.6; roof.add(back);
      // turret
      const tw = new T.Mesh(cyl(6.5, 6.5, 22, 20), PAP.outside); tw.position.set(-138, 41, Z - 3.5); roof.add(tw);
      const tr = new T.Mesh(new T.ConeGeometry(8, 18, 20), shingle); tr.position.set(-138, 61, Z - 3.5); roof.add(tr);
      const tf = new T.Mesh(new T.ConeGeometry(0.5, 5, 6), K.metal(0x2a2a30, 0.5)); tf.position.set(-138, 72, Z - 3.5); roof.add(tf);
      const tWin = new T.Mesh(new T.PlaneGeometry(3.6, 6.4), wmat); tWin.position.set(-138, 42, Z + 3.05); roof.add(tWin);
      // chimney with a crooked pot
      const chm = new T.Mesh(box(6, 16, 6), K.std({ color: 0x4a2a22, roughness: 0.9 })); chm.position.set(20, 44, Z - 4); roof.add(chm);
      K.add(roof);
    }

    // ================================================================== attic props
    // ---- the giant jack-o'-lantern (real flickering light)
    {
      const cx = 96, cz = 14, R = 13;
      const prof = [];
      for (let i = 0; i <= 24; i++) { const a = (i / 24) * PI; prof.push([Math.max(0.01, Math.sin(a) * R), (1 - Math.cos(a)) * R * 0.78]); }
      const g = K.lathe(prof, 64);
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) { // ribs
        const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i), a = Math.atan2(z, x), rr = Math.hypot(x, z);
        const k = 1 - 0.06 * Math.pow(Math.abs(Math.cos(a * 5)), 0.5);
        pos.setXYZ(i, x * k, y, z * k);
        if (rr < 0.01) continue;
      }
      g.computeVertexNormals();
      // face: carved holes painted as glowing shapes on a canvas map wrapped round the pumpkin
      const fc = canvas(1024, 512, (c) => {
        const gr = c.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#c45a10'); gr.addColorStop(0.5, '#e8761a'); gr.addColorStop(1, '#a8460c');
        c.fillStyle = gr; c.fillRect(0, 0, 1024, 512);
        for (let k = 0; k < 10; k++) { c.fillStyle = 'rgba(90,30,0,0.35)'; c.fillRect(k * 102.4 - 6, 0, 12, 512); }
        // the face looks south (+z): lathe u=0.25 faces +z
        const fx = 256, glow = (x, y, draw) => { c.save(); c.translate(x, y); c.fillStyle = '#ffe070'; c.shadowColor = '#ff9a20'; c.shadowBlur = 18; draw(); c.restore(); };
        glow(fx - 70, 150, () => { c.beginPath(); c.moveTo(-34, 30); c.lineTo(0, -34); c.lineTo(34, 30); c.closePath(); c.fill(); });
        glow(fx + 70, 150, () => { c.beginPath(); c.moveTo(-34, 30); c.lineTo(0, -34); c.lineTo(34, 30); c.closePath(); c.fill(); });
        glow(fx, 205, () => { c.beginPath(); c.moveTo(-14, 16); c.lineTo(0, -14); c.lineTo(14, 16); c.closePath(); c.fill(); });
        glow(fx, 262, () => { c.beginPath(); c.moveTo(-120, -14); c.quadraticCurveTo(0, 70, 120, -14); c.lineTo(96, -6); c.lineTo(80, -20); c.lineTo(60, 4); c.lineTo(36, -12); c.lineTo(12, 10); c.lineTo(-12, -12); c.lineTo(-36, 8); c.lineTo(-60, -14); c.lineTo(-80, 4); c.lineTo(-100, -10); c.closePath(); c.fill(); });
      });
      const ft = tex(fc, [1, 1], false);
      const emc = canvas(1024, 512, (c) => { c.fillStyle = '#000'; c.fillRect(0, 0, 1024, 512); });
      emc.getContext('2d').drawImage(fc, 0, 0);
      const ectx = emc.getContext('2d'); const id = ectx.getImageData(0, 0, 1024, 512), dd = id.data;
      for (let i = 0; i < dd.length; i += 4) { const lum = dd[i + 1]; const k = lum > 150 ? 1 : 0; dd[i] *= k; dd[i + 1] *= k; dd[i + 2] *= k; }
      ectx.putImageData(id, 0, 0);
      A.pumpkinMat = K.phys({ map: ft, roughness: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.4, emissive: 0xffffff, emissiveMap: tex(emc, [1, 1], false), emissiveIntensity: 1.4 });
      const pm = new T.Mesh(g, A.pumpkinMat); pm.position.set(cx, 0, cz); pm.rotation.y = -PI / 2; K.add(pm);
      // stem
      P(cyl(1.4, 2.2, 5, 8), 0x4a5a22, { x: cx + 0.5, y: R * 1.56 + 1.5, z: cz, rz: 0.25 }, mPlain);
      K.circle(cx, cz, R * 0.95, 20);
      AO(cx, cz, R + 2, R + 2, 0.6);
      A.pumpkinLight = new T.PointLight(0xff8a2a, 320, 120, 2); A.pumpkinLight.position.set(cx, 9, cz + 18); K.group.add(A.pumpkinLight);
      POOL(cx, 0.3, cz + 18, 44, 30, 0xff7a20, 0.45, 2);
      POOL(cx + 22, 0.3, cz, 24, 40, 0xff7a20, 0.25, 2);
      HALO(cx, 9, cz + R, 0xff9a30, 0.6, true, 2);
    }
    // ---- small carved pumpkins (glowing faces) as corner markers, gourds
    const minis = [];
    {
      const pg = (() => { const prof = []; for (let i = 0; i <= 12; i++) { const a = (i / 12) * PI; prof.push([Math.max(0.01, Math.sin(a)), (1 - Math.cos(a)) * 0.8]); } const g = K.lathe(prof, 20); const pos = g.attributes.position; for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i), a = Math.atan2(z, x), k = 1 - 0.07 * Math.abs(Math.cos(a * 4)); pos.setXYZ(i, x * k, pos.getY(i), z * k); } g.computeVertexNormals(); return g; })();
      const spots = [[-162, 92, 4], [-160, 4, 3.4], [150, 92, 4.2], [156, -70, 3.8], [60, -46, 3.4], [-30, -4, 3], [2, -2, 2.6], [-96, 2, 3], [148, 2, 3.2], [40, 96, 3], [-120, 98, 2.8], [76, 66, 3.6], [-156, -20, 3], [154, 40, 3]];
      for (const [x, z, s] of spots) {
        if (!K.offRoad(x, z, s + 1.5)) continue;
        minis.push({ x, y: 0, z, sx: s, sy: s, sz: s, ry: r() * TAU, color: r() < 0.8 ? 0xe0701a : 0xd8d0c0 });
        P(cyl(0.18 * s, 0.25 * s, 0.6 * s, 6), 0x3a4a1a, { x, y: s * 1.6 + 0.2, z, rz: 0.3 }, mPlain);
        // carved face glows towards the camera
        P(new T.CircleGeometry(0.22 * s, 3), 0xffd060, { x: x - 0.35 * s, y: s * 0.95, z: z + s * 0.97, rz: PI / 2 }, mGlow, false);
        P(new T.CircleGeometry(0.22 * s, 3), 0xffd060, { x: x + 0.35 * s, y: s * 0.95, z: z + s * 0.97, rz: PI / 2 }, mGlow, false);
        P(box(0.8 * s, 0.14 * s, 0.05), 0xffc040, { x, y: s * 0.55, z: z + s * 0.98 }, mGlow, false);
        HALO(x, s * 0.9, z + s * 1.1, 0xff9a30, 0.5, true, 2);
        POOL(x, 0.3, z + s * 1.5, s * 6, s * 4, 0xff7a20, 0.28, 2);
        AO(x, z, s * 1.2, s * 1.2, 0.5);
        K.circle(x, z, s * 0.95, s * 1.5);
      }
      K.instances(pg, K.phys({ roughness: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.4 }), minis, { colors: true });
    }
    // ---- dressmaker's dummy with a moth-eaten shawl, cobwebbed
    {
      const cx = 64, cz = -34;
      const f = frame(cx, 0, cz, 0.3, 0.82);
      for (let k = 0; k < 3; k++) { const a = k * TAU / 3; f(cyl(0.4, 0.4, 8, 6), 0x2a160c, { x: Math.cos(a) * 3, y: 1.6, z: Math.sin(a) * 3, rz: Math.cos(a) * 1.2, rx: -Math.sin(a) * 1.2 }, mWood); }
      f(cyl(0.5, 0.5, 22, 8), 0x2a160c, { y: 13 }, mWood);
      f(lathe([[3.2, 0], [5.2, 2], [5.4, 5], [4.2, 9], [4.8, 13], [5.6, 16], [5.0, 18], [2.4, 19.6], [1.2, 20.4], [1.2, 21.6], [0.001, 22]], 24), 0x8a7458, { y: 22, sx: 1, sz: 0.72 }, mCloth);
      f(cyl(1.5, 1.5, 1.2, 14), 0x2a160c, { y: 44.6 }, mWood);
      f(rbox(9, 4, 6.6, 1.8), 0x3a2240, { y: 37, z: 0.4, rz: 0.1 }, mCloth); // shawl
      for (let k = 0; k < 6; k++) f(box(0.25, 3, 0.1), 0x3a2240, { x: -3.6 + k * 1.4, y: 33.6, z: 3.8, rz: (r() - 0.5) * 0.3 }, mCloth);
      f(cyl(0.12, 0.12, 6, 4), 0xc9a24a, { x: 2, y: 30, z: 3, rz: 0.5 }, mMetal); // measuring tape
      K.circle(cx, cz, 4.5, 40); AO(cx, cz, 6, 6, 0.5);
    }
    // ---- steamer trunk, open, clothes and a feather boa spilling out
    {
      const cx = 30, cz = 46, ang = -0.12;
      const f = frame(cx, 0, cz, ang);
      f(rbox(30, 14, 16, 0.6), 0x3a2414, { y: 7 }, mLacq);
      for (const lx of [-13, -4.5, 4.5, 13]) f(box(1.4, 14.2, 16.3), 0x5a3a1c, { x: lx, y: 7 }, mWood);
      for (const [lx, lz] of [[-15, -8], [15, -8], [-15, 8], [15, 8]]) f(box(1.6, 14.4, 1.6), 0xb08a3a, { x: lx, y: 7, z: lz }, mMetal);
      f(box(29, 0.4, 15), 0x1a0e08, { y: 13.9 }, mPlain);
      f(rbox(30, 14, 3, 0.6), 0x3a2414, { y: 21, z: -9, rx: -0.12 }, mLacq); // lid standing open
      f(box(26, 11, 0.3), 0x7a2a3a, { y: 21, z: -7.4, rx: -0.12 }, mCloth); // lining
      f(rbox(10, 2.6, 8, 1.2), 0x6a1a2a, { x: -6, y: 14.8, z: 1 }, mCloth);
      f(rbox(8, 2.2, 7, 1), 0x2a3a5a, { x: 5, y: 14.6, z: 2, ry: 0.3 }, mCloth);
      const lbl = canvas(128, 80, (g) => { g.fillStyle = '#d8c89a'; g.fillRect(0, 0, 128, 80); g.strokeStyle = '#6a2a1a'; g.lineWidth = 4; g.strokeRect(4, 4, 120, 72); g.fillStyle = '#6a2a1a'; g.font = '700 18px Georgia'; g.textAlign = 'center'; g.fillText('TRANSYLVANIA', 64, 34); g.font = '14px Georgia'; g.fillText('via Lower Wobbling', 64, 58); });
      const lm = new T.Mesh(new T.PlaneGeometry(6, 3.8), K.std({ map: tex(lbl, [1, 1], false), roughness: 0.8 }));
      const [lx, lz] = f.pt(-8, 8.1); lm.position.set(lx, 6, lz); lm.rotation.y = ang; K.group.add(lm); keep.push(lm);
      // feather boa trailing out over the edge (bumpy tube)
      const curve = new T.CatmullRomCurve3([new T.Vector3(0, 14.2, 3), new T.Vector3(6, 14.5, 6), new T.Vector3(10, 10, 8.4), new T.Vector3(12, 3, 9.4), new T.Vector3(16, 0.8, 12), new T.Vector3(22, 0.8, 11)]);
      f(new T.TubeGeometry(curve, 40, 0.9, 7, false), 0x5a1a6a, {}, mCloth);
      const cs = Math.cos(ang), sn = Math.sin(ang);
      K.box(cx, cz, 15, 8, ang, 22); AO(cx, cz, 17, 10, 0.55, -ang);
    }
    // ---- sheet-covered armchair (a ghost of a chair)
    {
      const cx = -56, cz = 46;
      const g = new T.SphereGeometry(1, 28, 18);
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        let sx = 9, sy = 9, sz = 8;
        if (y > 0.2 && z < 0) sy = 15; // the back sticks up
        let X = x * sx, Y = (y + 1) * 0.5 * sy, Z = z * sz;
        if (Y < 3) { const k = 1 + (3 - Y) * 0.05; X *= k; Z *= k; }
        Y += Math.sin(x * 9 + z * 7) * 0.4;
        if (Math.abs(x) > 0.75 && y > -0.2 && y < 0.5) Y += 2.2; // arm rests
        pos.setXYZ(i, X, Math.max(0, Y), Z);
      }
      g.computeVertexNormals();
      P(g, 0x9a9aa4, { x: cx, y: 0, z: cz, ry: 0.4 }, mCloth);
      K.circle(cx, cz, 8.5, 14); AO(cx, cz, 11, 10, 0.55);
    }
    // ---- black cat statue on a stack of old books
    {
      const cx = -104, cz = 44;
      const f = frame(cx, 0, cz, 0.2);
      const bc = [0x5a1a1a, 0x1a2a4a, 0x3a3a1a, 0x4a2a3a];
      let y = 0;
      for (let k = 0; k < 4; k++) { const h = 1.6 + r() * 0.8; f(rbox(11 - k, h, 8 - k * 0.5, 0.3), bc[k], { y: y + h / 2, ry: (r() - 0.5) * 0.3 }, mPlain); f(box(10.6 - k, h * 0.8, 0.2), 0xe8dcc0, { y: y + h / 2, z: (8 - k * 0.5) / 2 }, mPlain); y += h; }
      const cat = K.phys({ color: 0x0c0a10, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 });
      const cf = frame(cx, y, cz, 0.2);
      cf(lathe([[2.6, 0], [3.2, 1.6], [2.8, 4], [2.0, 6.2], [1.4, 7.2], [0.001, 7.4]], 20), 0x0c0a10, {}, mGloss);
      cf(sph(2, 18, 14), 0x0c0a10, { y: 9, sz: 0.9 }, mGloss);
      for (const sx of [-1, 1]) cf(new T.ConeGeometry(0.8, 1.8, 4), 0x0c0a10, { x: sx * 1.2, y: 11, z: -0.2, rz: -sx * 0.25 }, mGloss);
      cf(new T.TorusGeometry(2.6, 0.4, 6, 16, PI), 0x0c0a10, { x: 0, y: 0.6, z: -1, rx: PI / 2, rz: PI }, mGloss);
      for (const sx of [-0.75, 0.75]) cf(sph(0.42, 10, 8), 0xffe040, { x: sx, y: 9.3, z: 1.7, sy: 0.7 }, mGlow, false);
      HALO(cx, y + 9.3, cz + 2, 0xffd040, 0.5, false, 0);
      K.box(cx, cz, 5.5, 4, 0.2, y + 11); AO(cx, cz, 7, 5.5, 0.55, -0.2);
    }
    // ---- old toys: teddy bear, jack-in-the-box, drum, wooden blocks; tipped pumpkin pail with candy
    {
      const tb = frame(-12, 0, 52, -0.3);
      const fur = K.phys({ color: 0x8a6a42, roughness: 0.95, sheen: 1, sheenColor: new T.Color(0xd8b890), sheenRoughness: 0.4 });
      tb(sph(4, 20, 14), 0x7a5a36, { y: 4, sy: 1.1 }, mCloth); tb(sph(3, 18, 12), 0x7a5a36, { y: 10 }, mCloth);
      for (const sx of [-1, 1]) { tb(sph(1.2, 12, 8), 0x7a5a36, { x: sx * 2.2, y: 12.6 }, mCloth); tb(sph(1.5, 12, 8), 0x7a5a36, { x: sx * 4, y: 5.5, sy: 1.6 }, mCloth); tb(sph(1.7, 12, 8), 0x7a5a36, { x: sx * 2.4, y: 1.4, z: 2.4, sz: 1.5 }, mCloth); tb(sph(0.4, 8, 6), 0x0a0806, { x: sx * 1.1, y: 10.6, z: 2.6 }, mGloss); }
      tb(sph(1.3, 12, 8), 0xa8885a, { y: 9.3, z: 2.4 }, mCloth); tb(sph(0.45, 8, 6), 0x1a1008, { y: 9.8, z: 3.5 }, mGloss);
      tb(box(5, 1.2, 1), 0x8a1a1a, { y: 7.4, z: 2.6, rz: 0.1 }, mCloth); // bow tie
      K.circle(-12, 52, 4.5, 13); AO(-12, 52, 6, 6, 0.5);
      // jack-in-the-box: sprung, a grinning clown head on a spring
      const jb = frame(-34, 0, 60, 0.4);
      jb(box(6, 6, 6), 0x2a5aa8, { y: 3 }, mGloss);
      jb(box(6.4, 0.5, 6.4), 0xd8a030, { y: 6.1 }, mGloss);
      jb(box(6, 0.3, 6), 0x2a5aa8, { y: 9, z: -3.4, rx: -1.3 }, mGloss);
      for (let k = 0; k < 8; k++) jb(new T.TorusGeometry(1, 0.18, 6, 14), 0xc0c0c8, { y: 6.6 + k * 0.6, rx: PI / 2 }, mMetal);
      jb(sph(2, 16, 12), 0xf0e0d0, { y: 13 }, mGloss); jb(sph(0.6, 10, 8), 0xd82020, { y: 13, z: 1.9 }, mGloss);
      jb(new T.ConeGeometry(1.8, 3, 12), 0x8a2a9a, { y: 15.8 }, mCloth);
      K.box(-34, 60, 3.2, 3.2, 0.4, 16); AO(-34, 60, 4.5, 4.5, 0.5);
      // toy drum
      const dr = frame(66, 0, 60, 0);
      dr(cyl(4, 4, 5, 24), 0xb82a2a, { y: 2.5 }, mGloss);
      dr(cyl(4.1, 4.1, 0.5, 24), 0xe8d8b0, { y: 5.1 }, mGloss); dr(cyl(4.2, 4.2, 0.6, 24), 0xd8b040, { y: 0.3 }, mMetal); dr(cyl(4.2, 4.2, 0.6, 24), 0xd8b040, { y: 4.8 }, mMetal);
      for (const sx of [-1, 1]) dr(cyl(0.25, 0.25, 7, 6), 0xe8d8b0, { x: sx * 2, y: 6, rz: sx * 1.2 }, mWood);
      K.circle(66, 60, 4.2, 5.5); AO(66, 60, 5, 5, 0.5);
      // tipped pumpkin pail with candy spilling
      const pp = frame(-82, 0, 58, 0.5);
      pp(lathe([[3, 0], [3.8, 2], [4, 4.4], [3.6, 6]], 18), 0xe8761a, { y: 3.4, rz: PI / 2 - 0.2, x: 0 }, mGloss);
      pp(new T.TorusGeometry(3.8, 0.2, 6, 20, PI), 0x1a1a1a, { x: 2, y: 4, rx: 0.4 }, mGloss);
      K.circle(-82, 58, 4, 7); AO(-82, 58, 6, 4.5, 0.5, -0.5);
    }
    // ---- candy: wrapped sweets and candy corn scattered in the infield and along the edges
    {
      const wrapG = (() => { const g1 = sph(0.7, 10, 8); g1.scale(1.3, 0.8, 0.8); const parts = [g1]; for (const sx of [-1, 1]) { const c = new T.ConeGeometry(0.55, 0.8, 6); c.rotateZ(sx * PI / 2); c.translate(sx * 1.3, 0, 0); parts.push(c); } return BU.mergeGeometries(parts.map((g) => { const q = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(q.attributes)) if (!['position', 'normal', 'uv'].includes(k)) q.deleteAttribute(k); return q; }), false); })();
      const cornG = (() => { const g = new T.ConeGeometry(0.6, 1.4, 3); const pos = g.attributes.position, a = new Float32Array(pos.count * 3); for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) + 0.7, c = new T.Color(y > 1.0 ? 0xfaf6ea : y > 0.45 ? 0xf59a1a : 0xf2c624); a.set([c.r, c.g, c.b], i * 3); } g.setAttribute('color', new T.BufferAttribute(a, 3)); return g; })();
      const wraps = [], corns = [];
      const cols = [0xd82a4a, 0x8a3ab8, 0x2ab86a, 0xf0a020, 0x2a7ad8, 0xe8e8e8];
      const near = [[-82, 58, 10, 40], [-12, 64, 30, 30], [40, 66, 40, 25], [-60, 64, 40, 20], [100, 44, 18, 30], [-120, 52, 16, 30], [110, -40, 20, 20], [-30, 98, 60, 6]];
      for (const [cx, cz, sx, n] of near) for (let i = 0; i < n; i++) {
        const x = cx + r.gauss() * sx * 0.5, z = cz + r.gauss() * sx * 0.35;
        if (!K.offRoad(x, z, 1) || inHouse(x, z, 2)) continue;
        if (r() < 0.6) wraps.push({ x, y: 0.55, z, ry: r() * TAU, color: r.pick(cols), s: r.range(0.8, 1.1) });
        else corns.push({ x, y: 0.5, z, rz: PI / 2, ry: r() * TAU, s: r.range(0.8, 1.1) });
      }
      K.instances(wrapG, K.phys({ roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05, metalness: 0.2 }), wraps, { colors: true, cast: false });
      K.instances(cornG, K.phys({ vertexColors: true, roughness: 0.35, clearcoat: 0.6 }), corns, { cast: false });
      // pushable candy on the road: wrapped sweets slide, mini gourds roll
      const pm = K.phys({ color: 0xffffff, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05, metalness: 0.15 });
      for (const [s, lat, c] of [[700, -3, 0xd82a4a], [712, 4, 0x8a3ab8], [850, 2, 0x2ab86a], [944, -2, 0xf0a020], [958, 3, 0xd82a4a], [470, 4, 0x2a7ad8]]) {
        const p = track.place(s, lat);
        const m = new T.Mesh(wrapG, pm.clone()); m.material.color.set(c); m.scale.setScalar(1.5); m.position.set(p.x, 0.8, p.z); m.rotation.y = r() * TAU; K.add(m);
        K.physics.addDynamic({ x: p.x, z: p.z, r: 1.6, m: 0.5, h: 1.6, mesh: m, slide: true, friction: 22, baseY: 0.8 });
      }
      for (const [s, lat] of [[742, 4.5], [620, -4]]) {
        const p = track.place(s, lat);
        const grp = new T.Group();
        const gm = new T.Mesh(sph(2.2, 18, 12), K.phys({ color: r() < 0.5 ? 0xe8b030 : 0x6a8a2a, roughness: 0.5, clearcoat: 0.4 })); gm.scale.set(1, 0.85, 1); grp.add(gm);
        const st = new T.Mesh(cyl(0.3, 0.4, 1.2, 6), K.std({ color: 0x4a3a1a })); st.position.y = 2.2; grp.add(st);
        grp.position.set(p.x, 2.0, p.z); K.add(grp);
        K.physics.addDynamic({ x: p.x, z: p.z, r: 2.2, m: 0.9, h: 4, mesh: grp, friction: 7, baseY: 1.9 });
      }
    }
    // ---- cobwebs: a big web across the inside of the NE bend (sticky), webs in corners
    const webTex = (() => {
      const c = canvas(256, 256, (g) => {
        g.clearRect(0, 0, 256, 256); g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 1.4;
        const n = 13;
        for (let k = 0; k < n; k++) { const a = k * TAU / n + (r() - 0.5) * 0.2; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.cos(a) * 126, 128 + Math.sin(a) * 126); g.stroke(); }
        for (let rr = 10; rr < 124; rr += 9 + r() * 4) { g.beginPath(); for (let k = 0; k <= n; k++) { const a = k * TAU / n, sag = rr * (0.92 + 0.08 * Math.sin(k * 2.3)); const x = 128 + Math.cos(a) * sag, y = 128 + Math.sin(a) * sag; if (k === 0) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke(); }
      });
      return tex(c, [1, 1], false);
    })();
    const webMat = new T.MeshBasicMaterial({ map: webTex, color: 0xb8c0d8, transparent: true, opacity: 0.55, depthWrite: false, side: T.DoubleSide });
    {
      const s = 526, p = track.place(s, 5.6);
      const g = new T.PlaneGeometry(13, 13); g.rotateX(-PI / 2);
      const m = new T.Mesh(g, webMat.clone()); m.material.opacity = 0.75; m.position.set(p.x, 0.35, p.z); m.rotation.y = r() * TAU; m.renderOrder = 2; K.group.add(m); keep.push(m);
      K.surface('sticky', { x: p.x, z: p.z, r: 4.4 });
      // anchor threads to a stack of books and a broken lamp inside the bend
      const lp = track.place(s, 18); const lf = frame(lp.x, 0, lp.z, 0.5);
      lf(cyl(3, 3.4, 1.2, 16), 0x2a2a2e, { y: 0.6 }, mMetal); lf(cyl(0.4, 0.4, 12, 8), 0x2a2a2e, { y: 6.6 }, mMetal);
      lf(lathe([[0.6, 0], [4.4, 3.4], [4.6, 4]], 16), 0x6a5a3a, { y: 11, rz: 0.5, x: 1 }, mCloth);
      K.circle(lp.x, lp.z, 3.4, 12); AO(lp.x, lp.z, 4.5, 4.5, 0.5);
      // corner webs (vertical) in the attic and in the dollhouse rooms
      for (const [x, y, z, ry, sz] of [[168, 14, -100, -PI / 4, 30], [-168, 14, 96, PI / 4, 24], [HS.x0 + 3, 6, HS.zb + 3, PI / 4, 8], [HS.xb - 3, H + 6, HS.zb + 3, -PI / 4, 8], [-41, 4, HS.zm + 3, -PI / 4, 6], [HS.x0 + 4, 3, HS.zf - 4, PI * 0.75, 7], [64, 30, -32, 0.3, 14]]) {
        const w = new T.Mesh(new T.PlaneGeometry(sz, sz), webMat); w.position.set(x, y, z); w.rotation.y = ry; w.renderOrder = 2; K.group.add(w); keep.push(w);
      }
    }
    // ---- spilled potion: a tipped bottle, glowing green and slick (east side)
    {
      const s = 652, p = track.place(s, -3.4);
      const potM = K.phys({ color: 0x3aff5a, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02, emissive: 0x18c03a, emissiveIntensity: 1.1, transparent: true, opacity: 0.88 });
      const sp = K.spill(p.x, p.z, 5.6, potM, { lump: 0.45, stretch: 1.5, angle: p.angle + 0.4, y: 0.12, thick: 0.16 });
      K.surface('slick', { poly: sp.poly });
      POOL(p.x, 0.32, p.z, 18, 16, 0x30ff50, 0.35, 0);
      const bp = track.place(s - 4, -W / 2 - 6);
      const bf = frame(bp.x, 0, bp.z, 0.9);
      bf(lathe([[0.001, 0], [2.4, 0.2], [2.6, 3.4], [1.0, 5.2], [0.8, 7], [1.0, 7.4]], 18), 0x2a6a3a, { y: 2.5, rz: PI / 2 - 0.1, x: 0 }, mGloss);
      bf(cyl(0.7, 0.8, 1.4, 10), 0x6a4a2a, { x: 8.4, y: 2.2, rz: PI / 2 }, mWood);
      const lab = canvas(128, 64, (g) => { g.fillStyle = '#e8dcb0'; g.fillRect(0, 0, 128, 64); g.fillStyle = '#2a1a0a'; g.font = '700 20px Georgia'; g.textAlign = 'center'; g.fillText('SLIME', 64, 28); g.font = '13px Georgia'; g.fillText('do not drink', 64, 50); });
      const lm = new T.Mesh(new T.PlaneGeometry(3.4, 1.7), K.std({ map: tex(lab, [1, 1], false), roughness: 0.8 })); lm.position.set(bp.x + 0.3, 2.6, bp.z + 2.7); lm.rotation.y = -0.9 + PI / 2 - PI / 2; K.group.add(lm); keep.push(lm);
      K.circle(bp.x, bp.z, 2.8, 5); AO(bp.x, bp.z, 5, 3, 0.45, 0.9);
      // drips leading to the spill
      for (let i = 1; i < 4; i++) K.spill(lerp(bp.x, p.x, i / 4) + r.range(-0.6, 0.6), lerp(bp.z, p.z, i / 4) + r.range(-0.6, 0.6), r.range(0.6, 1.1), potM, { y: 0.1, thick: 0.1, n: 16 });
      HALO(p.x, 0.8, p.z, 0x30ff50, 0.4, true, 0);
    }
    // ---- start/finish: two tall black candlesticks with a garland of paper bats strung between them
    {
      const p = track.at(36);
      const bats = [];
      const ends = [-1, 1].map((sd) => track.place(36, sd * (W / 2 + 2.6)));
      for (const e of ends) {
        const f = frame(e.x, 0, e.z, 0);
        f(lathe([[2.4, 0], [2.6, 0.6], [1.0, 1.4], [0.7, 6], [1.3, 6.6], [0.001, 6.8]], 16), 0x7a6e5a, {}, mMetal);
        f(cyl(0.8, 0.85, 5, 12), 0x1a1820, { y: 9.2 }, mWax);
        f(new T.ConeGeometry(0.4, 1.4, 8), 0xffc060, { y: 12.5 }, mGlow, false);
        for (let k = 0; k < 4; k++) f(sph(0.35, 6, 6), 0x1a1820, { x: Math.cos(k * 1.7) * 0.8, y: 11.4 - k * 0.9, z: Math.sin(k * 1.7) * 0.8, sy: 1.8 }, mWax);
        HALO(e.x, 12.5, e.z, 0xffa040, 1, false); HALO(e.x, 12, e.z, 0xff8a30, 0.45, true);
        POOL(e.x, 0.3, e.z, 18, 18, 0xff9a40, 0.3, 1);
        K.circle(e.x, e.z, 2.4, 12); AO(e.x, e.z, 3, 3, 0.5);
      }
      // garland: a sagging string with flat paper bats
      const a = new T.Vector3(ends[0].x, 11.6, ends[0].z), b = new T.Vector3(ends[1].x, 11.6, ends[1].z);
      const pts = [];
      for (let i = 0; i <= 20; i++) { const t = i / 20, v = a.clone().lerp(b, t); v.y -= Math.sin(t * PI) * 2.2; pts.push(v); }
      P(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 30, 0.07, 4, false), 0x2a2a2a, {}, mPlain);
      const batShape = new T.Shape();
      batShape.moveTo(0, 0.4); batShape.quadraticCurveTo(0.6, 0.9, 1.0, 0.3); batShape.quadraticCurveTo(1.6, 0.7, 2.4, 0.5); batShape.quadraticCurveTo(2.0, 0.1, 2.2, -0.4); batShape.quadraticCurveTo(1.6, -0.2, 1.3, -0.6); batShape.quadraticCurveTo(1.0, -0.3, 0.6, -0.7);
      batShape.quadraticCurveTo(0.3, -0.4, 0, -0.5); batShape.quadraticCurveTo(-0.3, -0.4, -0.6, -0.7); batShape.quadraticCurveTo(-1.0, -0.3, -1.3, -0.6); batShape.quadraticCurveTo(-1.6, -0.2, -2.2, -0.4); batShape.quadraticCurveTo(-2.0, 0.1, -2.4, 0.5); batShape.quadraticCurveTo(-1.6, 0.7, -1.0, 0.3); batShape.quadraticCurveTo(-0.6, 0.9, 0, 0.4);
      const bg = new T.ShapeGeometry(batShape, 6);
      for (let i = 1; i < 10; i++) { const v = pts[i * 2]; bats.push({ x: v.x, y: v.y - 1.0, z: v.z, ry: (r() - 0.5) * 0.5, rx: -0.75, rz: (r() - 0.5) * 0.3, s: 0.95 + r() * 0.2, color: i % 3 ? 0x141218 : 0xe8761a }); }
      K.instances(bg, K.std({ side: T.DoubleSide, roughness: 0.8 }), bats, { colors: true });
    }
    // ---- the ghost (visual; its push lives in tick)
    {
      const sG = 858, p = track.at(sG);
      A.ghostC = [p.x, p.z];
      const prof = [[4.8, 0], [4.4, 1], [4.0, 3], [3.8, 5], [3.7, 7], [3.5, 8.5], [3.0, 9.8], [2.0, 10.8], [0.8, 11.3], [0.01, 11.4]];
      const gg = K.lathe(prof, 32);
      const pos = gg.attributes.position;
      for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i); const a = Math.atan2(z, x); if (y < 1.5) pos.setY(i, y + Math.sin(a * 6) * 0.6 * (1.5 - y) / 1.5); }
      gg.computeVertexNormals();
      A.ghostMat = K.phys({ color: 0xe8f0ff, roughness: 0.6, transparent: true, opacity: 0.72, emissive: 0x6a7aa8, emissiveIntensity: 0.6, sheen: 1, sheenColor: new T.Color(0xffffff), side: T.DoubleSide, depthWrite: false });
      const gm = new T.Mesh(gg, A.ghostMat);
      const grp = new T.Group(); grp.add(gm);
      for (const sx of [-1.2, 1.2]) { const e = new T.Mesh(sph(0.75, 10, 8), new T.MeshBasicMaterial({ color: 0x05050a })); e.scale.set(1, 1.4, 0.5); e.position.set(sx, 8.4, 3.7); grp.add(e); }
      const mouth = new T.Mesh(sph(0.6, 10, 8), new T.MeshBasicMaterial({ color: 0x05050a })); mouth.scale.set(1, 1.3, 0.5); mouth.position.set(0, 6.6, 4.1); grp.add(mouth);
      grp.renderOrder = 3; gm.renderOrder = 3;
      K.group.add(grp); keep.push(grp);
      const sh = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ color: 0x9ab0ff, map: softTex, transparent: true, opacity: 0.4, blending: T.AdditiveBlending, depthWrite: false }));
      sh.rotation.x = -PI / 2; sh.scale.set(16, 16, 1); sh.renderOrder = 2; K.group.add(sh); keep.push(sh);
      A.ghost = { grp, sh };
    }
    // ---- pumpkin fairy lights strung along the outside of the south straight
    {
      const bulbs = [], wire = [];
      for (let s = 690; s < 905; s += 3.6) {
        const sag = Math.abs(Math.sin(((s - 690) / 18) * PI));
        const p = track.place(s, -(W / 2 + 4.2 + sag * 0.8));
        wire.push(new T.Vector3(p.x, 0.25, p.z));
        if (Math.round((s - 690) / 3.6) % 2 === 0) { const c = Math.round((s - 690) / 7.2) % 3 === 2 ? 0xb070ff : 0xff8a20; bulbs.push({ x: p.x, y: 0.75, z: p.z, s: 1, color: c }); HALO(p.x, 1.1, p.z, c, 0.75, false, 0); }
      }
      P(new T.TubeGeometry(new T.CatmullRomCurve3(wire), 120, 0.1, 4, false), 0x101410, {}, mPlain, false);
      const bg = sph(0.55, 10, 8); bg.scale(1, 0.85, 1);
      const im = K.instances(bg, new T.MeshBasicMaterial({ color: 0xffffff }), bulbs.map((b) => ({ ...b, color: new T.Color(b.color).multiplyScalar(1.6) })), { colors: true, cast: false, receive: false });
      for (const b of bulbs) POOL(b.x, 0.28, b.z, 5, 5, b.color, 0.35, 0);
    }
    // ---- witch's hat and a bubbling cauldron on the south side
    {
      const hf = frame(52, 0, 97, 0.4);
      hf(cyl(6.4, 6.6, 0.4, 28), 0x2a1a3a, { y: 0.3, rx: 0.06 }, mCloth);
      hf(new T.ConeGeometry(3.6, 11, 20), 0x2a1a3a, { y: 5.8, rz: 0.35, x: -1.4 }, mCloth);
      hf(cyl(3.5, 3.6, 0.9, 20), 0xd8a030, { y: 1.1, x: -0.15 }, mCloth);
      hf(box(1.6, 1.0, 0.4), 0xe8c050, { y: 1.1, z: 3.6, x: -0.2 }, mMetal);
      K.circle(52, 97, 6, 4); AO(52, 97, 7, 7, 0.45);
      const cf = frame(-118, 0, 96, 0);
      cf(lathe([[2.4, 0.4], [4.4, 1.4], [5.0, 3.6], [4.4, 6.0], [3.8, 6.6], [4.2, 7.0]], 22), 0x121214, {}, mMetal);
      for (let k = 0; k < 3; k++) { const a = k * TAU / 3; cf(cyl(0.45, 0.3, 1.6, 6), 0x121214, { x: Math.cos(a) * 3, y: 0.6, z: Math.sin(a) * 3 }, mMetal); }
      cf(cyl(3.9, 3.9, 0.15, 22), 0x50ff60, { y: 6.2 }, mGlow, false);
      for (let k = 0; k < 5; k++) cf(sph(0.5 + r() * 0.5, 8, 6), 0x9aff8a, { x: (r() - 0.5) * 5, y: 6.4, z: (r() - 0.5) * 5, sy: 0.6 }, mGlow, false);
      HALO(-118, 7.5, 96, 0x40ff60, 0.6, true, 0); POOL(-118, 0.3, 96, 26, 20, 0x30ff50, 0.3, 0);
      K.circle(-118, 96, 5, 7); AO(-118, 96, 6, 6, 0.5);
    }
    // ---- clutter along the attic walls: stacks of books, picture frames, a broom, hat boxes, a rolled rug
    {
      const books = (x, z, n, ry = 0) => {
        const f = frame(x, 0, z, ry); let y = 0;
        for (let k = 0; k < n; k++) { const h = 1.2 + r() * 1.2, w = 7 + r() * 3, d = 5 + r() * 2; f(rbox(w, h, d, 0.25), [0x5a1a1a, 0x1a2a4a, 0x3a3a1a, 0x4a2a3a, 0x2a4a3a][k % 5], { y: y + h / 2, ry: (r() - 0.5) * 0.4 }, mPlain); f(box(w - 0.4, h * 0.8, 0.2), 0xe0d4b8, { y: y + h / 2, z: d / 2 }, mPlain); y += h; }
        K.circle(x, z, 4.6, y); AO(x, z, 6, 5, 0.5); return y;
      };
      books(160, -30, 5, 0.3); books(158, 64, 3, -0.4); books(-164, 60, 4, 0.2); books(-40, 98, 3, 0.1); books(118, -90, 6, 0);
      // picture frames leaning on the gable wall (north-east)
      for (const [x, w, h, c] of [[70, 18, 24, 0xb08a3a], [92, 12, 15, 0x2a1a10], [126, 16, 12, 0x6a4a2a]]) {
        const f = frame(x, 0, BOUNDS.minZ + 3, 0);
        f(box(w, h, 1), c, { y: h / 2, rx: -0.18 }, mLacq);
        f(box(w - 3, h - 3, 0.3), 0x1a1612, { y: h / 2, z: 0.6, rx: -0.18 }, mPlain);
        K.box(x, BOUNDS.minZ + 3, w / 2, 2, 0, h);
      }
      // hat boxes (striped) stacked near the south-east
      const hb = frame(158, 0, 86, 0);
      hb(cyl(5, 5, 6, 24), 0xc8a0b8, { y: 3 }, mPlain); hb(cyl(5.3, 5.3, 1, 24), 0x6a2a4a, { y: 6.2 }, mPlain);
      hb(cyl(3.8, 3.8, 4.4, 20), 0x2a4a5a, { y: 8.9, x: 0.6 }, mPlain); hb(cyl(4.0, 4.0, 0.8, 20), 0xd8c8a0, { y: 11.3, x: 0.6 }, mPlain);
      K.circle(158, 86, 5.2, 12); AO(158, 86, 6.5, 6.5, 0.5);
      // broom leaning on the east knee wall
      P(cyl(0.35, 0.35, 26, 6), 0x7a5a32, { x: 167, y: 12, z: 10, rz: 0.25 }, mWood);
      P(new T.ConeGeometry(2.4, 7, 10), 0x9a7a3a, { x: 169.5, y: 2.6, z: 10, rz: 0.25 }, mPlain);
      // a rolled rug along the west wall
      P(cyl(2.2, 2.2, 40, 14), 0x6a2a2a, { x: -165, y: 2.2, z: -50, rx: PI / 2 }, mCloth);
      K.box(-165, -50, 2.2, 20, 0, 4.4); AO(-165, -50, 3, 21, 0.5);
      // an old oil lamp (lit) on a crate near the west U
      const cr = frame(-166, 0, 22, 0.1);
      cr(box(8, 6, 8), 0x6a4a2a, { y: 3 }, mWood);
      cr(lathe([[1.6, 0], [2.0, 1], [1.2, 2.2], [0.5, 2.6], [0.6, 3]], 14), 0x8a6a2a, { y: 6 }, mMetal);
      cr(lathe([[0.9, 0], [1.4, 1.6], [1.0, 3.4], [0.8, 4]], 14), 0xffe0a0, { y: 9 }, mGlow, false);
      HALO(-166, 10.5, 22, 0xffb060, 0.8, true); HALO(-166, 10.5, 22, 0xffc070, 1, false);
      POOL(-160, 0.3, 24, 34, 30, 0xffa050, 0.32, 1);
      K.box(-166, 22, 4, 4, 0.1, 13); AO(-166, 22, 5, 5, 0.5);
    }

    // ================================================================== bats flitting round the attic (animated)
    {
      const sh = new T.Shape();
      sh.moveTo(0, 0.5); sh.quadraticCurveTo(0.7, 1.0, 1.1, 0.35); sh.quadraticCurveTo(1.8, 0.8, 2.8, 0.55); sh.quadraticCurveTo(2.3, 0.1, 2.5, -0.45); sh.quadraticCurveTo(1.8, -0.2, 1.5, -0.65); sh.quadraticCurveTo(1.1, -0.3, 0.6, -0.75);
      sh.quadraticCurveTo(0.3, -0.4, 0, -0.55); sh.quadraticCurveTo(-0.3, -0.4, -0.6, -0.75); sh.quadraticCurveTo(-1.1, -0.3, -1.5, -0.65); sh.quadraticCurveTo(-1.8, -0.2, -2.5, -0.45); sh.quadraticCurveTo(-2.3, 0.1, -2.8, 0.55); sh.quadraticCurveTo(-1.8, 0.8, -1.1, 0.35); sh.quadraticCurveTo(-0.7, 1.0, 0, 0.5);
      const bg = new T.ShapeGeometry(sh, 5); bg.rotateX(-PI / 2);
      const n = 7, list = [];
      for (let i = 0; i < n; i++) list.push({ x: 0, y: 30, z: 0, s: 1 });
      A.bats = { im: K.instances(bg, new T.MeshBasicMaterial({ color: 0x07060a, side: T.DoubleSide }), list, { cast: true, receive: false }), n, p: Array.from({ length: n }, (_, i) => ({ cx: [100, -40, 60, -120, 20, 120, -80, 140, 0][i], cz: [-60, 50, 40, 0, -10, 30, 70, -20, 90][i], rx: 14 + r() * 16, rz: 10 + r() * 10, w: (0.5 + r() * 0.5) * (r() < 0.5 ? -1 : 1), y: 15 + r() * 9, ph: r() * TAU, s: 0.55 + r() * 0.3 })) };
      A.bats.im.frustumCulled = false;
    }

    // ================================================================== tea lights (instanced), now that props are placed
    {
      const ok = teaSpots.filter((t) => {
        for (const c of physics.colliders) { if (c.moverFn) continue; if (physics.circleVsCollider(t.x, t.z, 1.8, c)) return false; }
        for (const tr of A.traps) if (Math.hypot(t.x - tr.x, t.z - tr.z) < tr.hw + 3) return false;
        return true;
      });
      const cups = ok.map((t) => ({ x: t.x, y: 0, z: t.z, ry: r() * TAU }));
      const cupG = lathe([[1.15, 0], [1.25, 0.1], [1.25, 1.0], [1.1, 1.0], [1.1, 0.9], [0.001, 0.9]], 18);
      K.instances(cupG, K.metal(0x8a8e96, 0.4), cups, { cast: false });
      K.instances(cyl(1.08, 1.08, 0.2, 16), K.phys({ color: 0xbfb49a, roughness: 0.45, sheen: 0.5, emissive: 0x5a3008, emissiveIntensity: 0.55 }), cups.map((c) => ({ ...c, y: 0.82 })), { cast: false });
      const fl = new T.SphereGeometry(0.3, 8, 6); fl.scale(1, 2.6, 1); fl.translate(0, 0.62, 0);
      A.teaFlames = K.instances(fl, new T.MeshBasicMaterial({ color: new T.Color(0xffd890).multiplyScalar(1.6) }), cups.map((c) => ({ ...c, y: 1.05 })), { cast: false, receive: false });
      for (const t of ok) { HALO(t.x, 1.6, t.z, 0xffa040, 0.85, false); POOL(t.x, 0.28, t.z, 9, 9, 0xff9a40, 0.32, 1); AO(t.x, t.z, 1.4, 1.4, 0.4); }
      A.teaCount = ok.length;
    }

    // ================================================================== lights inside the house: sconces (fake), moonlit window halos
    for (const [x, y, z] of [[-150, 9, HS.zb + 1.2], [-110, 9, HS.zb + 1.2], [-60, 6, HS.zm + 1.2], [-6, 6, HS.zm + 1.2], [-96, H + 9, HS.zb + 1.2], [-36, H + 9, HS.zb + 1.2], [2, H + 9, HS.zb + 1.2]]) {
      P(box(1, 1.6, 0.8), 0xc9a24a, { x, y: y - 1.4, z }, mMetal);
      P(cyl(0.25, 0.25, 1.2, 8), 0xf0e6d0, { x, y: y - 0.2, z: z + 0.3 }, mWax);
      P(new T.ConeGeometry(0.2, 0.6, 6), 0xffc060, { x, y: y + 0.7, z: z + 0.3 }, mGlow, false);
      HALO(x, y + 0.7, z + 0.6, 0xffa040, 0.9, false);
      HALO(x, y + 0.5, z + 1, 0xff8a30, 0.3, true);
      const fy = y > H ? H : 0;
      POOL(x, fy + 0.3, z + 6, 16, 12, 0xff9a40, 0.22, 1);
    }

    // ================================================================== fine scatter: dust bunnies, dead leaves, mouse droppings... (kept cute: leaves and dust)
    {
      const leaves = [], fluff = [];
      for (let i = 0; i < 260; i++) {
        const x = r.range(BOUNDS.minX + 4, BOUNDS.maxX - 4), z = r.range(BOUNDS.minZ + 6, BOUNDS.maxZ - 3);
        if (!K.offRoad(x, z, 1) || inHouse(x, z, 1)) continue;
        if (r() < 0.55) leaves.push({ x, y: 0.12, z, ry: r() * TAU, rx: (r() - 0.5) * 0.3, s: r.range(0.7, 1.4), color: r.pick([0x8a4a1a, 0x6a3a12, 0xa8641e, 0x4a2a10]) });
        else if (r() < 0.6) fluff.push({ x, y: 0.2, z, ry: r() * TAU, s: r.range(0.5, 1.2), color: 0x6e685e });
      }
      for (let i = 0; i < 70; i++) { // a few dust bunnies under the furniture inside the house too
        const x = r.range(HS.x0 + 3, HS.x1 - 3), z = r.range(HS.zm + 2, HS.zf - 2);
        if (!K.offRoad(x, z, 0.5)) continue;
        fluff.push({ x, y: 0.25, z, ry: r() * TAU, s: r.range(0.4, 0.9), color: 0x666056 });
      }
      const lg = new T.CircleGeometry(1, 5); lg.rotateX(-PI / 2); lg.scale(1.4, 1, 0.7);
      K.instances(lg, K.std({ roughness: 0.9, side: T.DoubleSide }), leaves, { colors: true, cast: false });
      K.instances(new T.IcosahedronGeometry(0.9, 1).scale(1.3, 0.45, 1), K.phys({ roughness: 1, sheen: 1, sheenColor: new T.Color(0xb0a8a0) }), fluff, { colors: true, cast: false });
    }

    // ================================================================== flush: batches, papers, floors, contacts, pools, halos
    flush();
    for (const [mat, geos] of papQ) { const m = new T.Mesh(BU.mergeGeometries(geos, false), mat); m.receiveShadow = true; K.group.add(m); keep.push(m); }
    for (const [mat, geos] of floorQ) { const m = new T.Mesh(BU.mergeGeometries(geos, false), mat); m.receiveShadow = true; K.group.add(m); keep.push(m); }
    {
      const g = new T.PlaneGeometry(1, 1); g.rotateX(-PI / 2);
      const mat = new T.MeshBasicMaterial({ color: 0x050302, transparent: true, alphaMap: TX.blobShadowTexture(), depthWrite: false });
      mat.onBeforeCompile = (sh) => {
        sh.vertexShader = 'varying float vOp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\nvOp = length(instanceMatrix[1].xyz);\n#endif');
        sh.fragmentShader = 'varying float vOp;\n' + sh.fragmentShader.replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\ndiffuseColor.a *= vOp;');
      };
      const im = K.instances(g, mat, contacts, { cast: false, receive: false }); im.renderOrder = 1;
    }
    {
      const gc = canvas(128, 128, (g) => { const q = g.createRadialGradient(64, 64, 0, 64, 64, 64); q.addColorStop(0, 'rgba(255,255,255,1)'); q.addColorStop(0.35, 'rgba(255,255,255,0.45)'); q.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = q; g.fillRect(0, 0, 128, 128); });
      const gt = tex(gc, [1, 1], false);
      const gGeo = new T.PlaneGeometry(1, 1); gGeo.rotateX(-PI / 2);
      const im = K.instances(gGeo, new T.MeshBasicMaterial({ map: gt, transparent: true, blending: T.AdditiveBlending, depthWrite: false }), pools, { cast: false, receive: false, colors: true });
      im.renderOrder = 2;
      A.pools = { im, list: pools, base: pools.map((p) => p.color.clone()) };
      // halos: two point clouds (small hot cores, big soft glows) with flickering vertex colours
      for (const kind of ['s', 'b']) {
        const L0 = halos[kind]; if (!L0.length) continue;
        const pos = new Float32Array(L0.length * 3), col = new Float32Array(L0.length * 3);
        L0.forEach((h, i) => { pos.set([h.x, h.y, h.z], i * 3); col.set([h.c.r, h.c.g, h.c.b], i * 3); });
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3).setUsage(T.DynamicDrawUsage));
        const m = new T.Points(g, new T.PointsMaterial({ size: kind === 's' ? 2.6 : 11, map: gt, vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending, sizeAttenuation: true }));
        m.renderOrder = 4; K.group.add(m); keep.push(m);
        A['halo' + kind] = { g, list: L0 };
      }
    }
    A.L = L;
    A.lit = { sun: 0.82, hemi: 0.22 };
  },

  // fixed rate: CPU drivers read the trapdoor creaks and spider shadows; the ghost pushes; cars on the upper floor stay up
  tick(dt, time, game) {
    if (!A) return;
    for (const T of A.traps) T.hole.open = trapState(T, time).open;
    const L = game.track.length;
    for (const e of game.cars) {
      const c = e.car;
      if (e.out || c.state !== 'drive') continue;
      // respawned / placed inside a raised area at floor level: lift it onto the surface
      if (!c.airborne && c.speed < 4) { const g = game.physics.groundAt(c.x, c.z).g; if (g > c.y + 0.85) c.y = g; }
      // the ghost's chill: a soft push away from it
      if (A.ghost && !c.airborne) {
        const gp = ghostPos(time), dx = c.x - gp.x, dz = c.z - gp.z, d = Math.hypot(dx, dz);
        if (d < GHOST.R && d > 0.01) { const k = GHOST.push * (1 - d / GHOST.R); c.vx += (dx / d) * k * dt + gp.vx * 0.6 * dt; c.vz += (dz / d) * k * dt + gp.vz * 0.6 * dt; }
      }
      if (!e.ai) continue;
      const spd = Math.max(c.fwdSpeed, 10);
      let target = null;
      for (const T of A.traps) {
        const d = ((T.s - e.trackS) % L + L) % L;
        if (d > 36 || d < -2) continue;
        const ta = d / spd;
        let hit = false;
        for (const dtA of [-0.3, 0, 0.25, 0.5]) if (trapState(T, time + ta + dtA).frac > 0) hit = true;
        if (hit) target = T.safe;
      }
      for (const sp of A.spiders) {
        const d = ((sp.s - e.trackS) % L + L) % L;
        if (d > 32) continue;
        const ta = d / spd;
        let hit = false;
        for (const dtA of [-0.25, 0, 0.3]) if (spiderY(sp, time + ta + dtA).y < 6) hit = true;
        if (hit) target = sp.safe;
      }
      if (target !== null) {
        const want = target - e.ai.lineOffset(e.trackS + 10);
        e.ai.avoid += (want - e.ai.avoid) * Math.min(1, dt * 9);
      }
    }
  },

  animate(time, dt, game) {
    if (!A || !A.traps) return;
    const st = game.state, live = st === 'race' || st === 'countdown' || st === 'roundEnd';
    const snd = game.sound;
    // ---- trapdoors: crack light, creak, leaves swing, beam; one real light follows the busiest one on screen
    let best = null, bestK = 0;
    for (const T of A.traps) {
      const q = trapState(T, time);
      const glow = q.frac > 0 ? 0 : Math.pow(q.warn, 1.5) * (0.75 + 0.25 * Math.sin(time * 37 + T.x));
      T.crackMat.color.setRGB(glow * 2.2 + 0.05, glow * 1.4 + 0.03, glow * 0.6 + 0.01);
      T.crack.visible = q.frac === 0;
      T.mask.visible = q.frac > 0.001;
      for (const l of T.leaves) l.hinge.rotation.x = -l.sd * q.frac * 1.5;
      T.poolMat.opacity = Math.max(glow * 0.55, q.frac * 0.45);
      T.beamMat.opacity = q.frac * 0.16;
      const k = Math.max(q.frac, glow * 0.3);
      if (k > bestK && game.onScreen(T.x, 0, T.z, 0.1)) { bestK = k; best = T; }
      // creak at the start of the warning, thump when it drops open
      if (live && snd.ctx && game.onScreen(T.x, 0, T.z, 0.15)) {
        const phase = q.u < T.W ? 1 : q.u < T.W + T.O ? 2 : 0;
        if (phase !== T.creaked) {
          if (phase === 1) snd.tone(120, 0.55, { type: 'sawtooth', vol: 0.035, slideTo: 210, attack: 0.08 });
          if (phase === 2) { snd.tone(70, 0.25, { type: 'sine', vol: 0.12, slideTo: 40 }); snd.noiseBurst(0.2, { freq: 500, vol: 0.08 }); }
          if (phase === 0 && T.creaked === 2) snd.tone(90, 0.12, { type: 'square', vol: 0.04 });
          T.creaked = phase;
        }
      }
    }
    if (best) { A.trapLight.position.set(best.x, 2.5, best.z); A.trapLight.intensity = bestK * 260; } else A.trapLight.intensity = 0;
    // ---- spiders
    for (const sp of A.spiders) {
      const q = spiderY(sp, time);
      sp.g.position.y = q.y;
      sp.g.rotation.y += dt * (q.y < 3 ? 1.5 : 0.3);
      const wig = q.y < 3 ? 0.18 : 0.06;
      sp.legs[0].scale.set(1 + Math.sin(time * 13) * wig * 0.5, 1 + Math.sin(time * 9) * wig, 1 - Math.sin(time * 13) * wig * 0.5);
      const top = 60;
      sp.thread.scale.set(1, Math.max(0.01, top - q.y - 1.2), 1); sp.thread.position.y = (top + q.y + 1.2) / 2;
      const k = 1 - clamp((q.y - SP.low) / 30, 0, 1);
      sp.sh.scale.set(1 + k * 4.5, 1 + k * 4.5, 1); sp.sh.material.opacity = 0.12 + k * 0.45;
    }
    // ---- rocking chair
    if (A.chair) {
      const q = chairPose(time);
      const x = lerp(A.chairA[0], A.chairB[0], q.k), z = lerp(A.chairA[1], A.chairB[1], q.k);
      A.chair.holder.position.set(x, H, z);
      A.chair.g.rotation.z = q.rock;
      A.chairSh.position.set(x, H + 0.08, z);
      if (live && snd.ctx && Math.sign(Math.sin(time * 4.2)) !== A.rockSign && game.onScreen(x, H, z, 0.1)) { A.rockSign = Math.sign(Math.sin(time * 4.2)); snd.tone(160 + (A.rockSign > 0 ? 40 : 0), 0.18, { type: 'triangle', vol: 0.025, slideTo: 110 }); }
    }
    // ---- grandfather clock pendulum (tick-tock)
    if (A.pend) {
      const a = Math.sin(time * PI) * 0.22; A.pend.rotation.z = a;
      const side = Math.sign(Math.cos(time * PI));
      if (side !== A.tickSide) { A.tickSide = side; if (live && snd.ctx && game.onScreen(A.clockPos[0], 10, A.clockPos[1], 0.05)) snd.tone(side > 0 ? 2400 : 1800, 0.03, { type: 'square', vol: 0.02 }); }
    }
    // ---- the ghost
    if (A.ghost) {
      const gp = ghostPos(time);
      const bob = Math.sin(time * 2.1) * 0.8;
      A.ghost.grp.position.set(gp.x, 2.5 + bob, gp.z);
      A.ghost.grp.rotation.y = Math.atan2(gp.vx, gp.vz) * 0.4 + Math.sin(time * 0.8) * 0.3;
      A.ghost.grp.rotation.z = -gp.vx * 0.02;
      A.ghostMat.opacity = 0.62 + 0.12 * Math.sin(time * 3.1);
      A.ghost.sh.position.set(gp.x, 0.33, gp.z);
      if (live && snd.ctx && game.onScreen(gp.x, 4, gp.z, 0) && Math.floor(time / 4.75) !== A.wooT) { A.wooT = Math.floor(time / 4.75); snd.tone(330, 1.1, { type: 'sine', vol: 0.035, slideTo: 220, attack: 0.3 }); snd.tone(495, 1.1, { type: 'sine', vol: 0.015, slideTo: 330, attack: 0.3 }); }
    }
    // ---- candles and lanterns flicker
    const fl = (ph, k) => 1 + k * (0.13 * Math.sin(time * 13 + ph) + 0.08 * Math.sin(time * 31.7 + ph * 2.3) + 0.05 * Math.sin(time * 5.3 + ph * 0.7));
    for (const kind of ['s', 'b']) {
      const H0 = A['halo' + kind]; if (!H0) continue;
      const col = H0.g.attributes.color;
      H0.list.forEach((h, i) => { const k = h.flick ? fl(h.ph, h.flick === 2 ? 1.6 : 1) : 1; col.setXYZ(i, h.c.r * k, h.c.g * k, h.c.b * k); });
      col.needsUpdate = true;
    }
    if (A.pools && A.pools.im.instanceColor) {
      const c = new (A.pools.base[0].constructor)();
      A.pools.list.forEach((p, i) => { if (!p.flick) return; const k = fl(i * 1.7, p.flick === 2 ? 1.4 : 0.8); c.copy(A.pools.base[i]).multiplyScalar(k); A.pools.im.setColorAt(i, c); });
      A.pools.im.instanceColor.needsUpdate = true;
    }
    if (A.candleLight) A.candleLight.intensity = 150 * fl(1.1, 0.8);
    if (A.pumpkinLight) A.pumpkinLight.intensity = 320 * fl(2.7, 1.5);
    if (A.pumpkinMat) A.pumpkinMat.emissiveIntensity = 1.4 * fl(2.7, 1.2);
    // ---- portraits: pupils follow the leading car
    if (A.pupils && game.cars.length) {
      let lead = null; for (const e of game.cars) if (!e.out && (!lead || e.progress > lead.progress)) lead = e;
      if (lead) {
        const m4 = A._m4 || (A._m4 = new (A.pupils.im.matrix.constructor)());
        A.pupils.list.forEach((p, i) => {
          const dx = clamp((lead.car.x - p.x) / 40, -1, 1), dy = clamp((p.z - lead.car.z) / 60, -1, 0.2);
          m4.makeScale(p.s, p.s, p.s * 0.5); m4.setPosition(p.x + dx * p.r, p.y - 0.15 * p.r + dy * p.r * 0.5, p.z);
          A.pupils.im.setMatrixAt(i, m4);
        });
        A.pupils.im.instanceMatrix.needsUpdate = true;
      }
    }
    // ---- bats
    if (A.bats) {
      const B = A.bats, m4 = A._m4b || (A._m4b = new (B.im.matrix.constructor)()), q = A._qb || (A._qb = new (game.R.camera.quaternion.constructor)()), e = A._eb || (A._eb = new (game.R.camera.rotation.constructor)()), v = A._vb || (A._vb = new (game.R.camera.position.constructor)()), sc = A._sb || (A._sb = new (game.R.camera.position.constructor)());
      B.p.forEach((b, i) => {
        const a = b.ph + time * b.w;
        const x = b.cx + Math.cos(a) * b.rx + Math.sin(time * 1.3 + i) * 3, z = b.cz + Math.sin(a) * b.rz, y = b.y + Math.sin(time * 2.2 + i) * 2;
        const flap = Math.sin(time * 16 + i * 2);
        e.set(Math.sin(time * 3 + i) * 0.2, -(a + Math.sign(b.w) * PI / 2) + PI / 2, flap * 0.15, 'YXZ'); q.setFromEuler(e);
        sc.set(b.s * (0.55 + 0.45 * Math.abs(flap)), b.s, b.s);
        m4.compose(v.set(x, y, z), q, sc); B.im.setMatrixAt(i, m4);
      });
      B.im.instanceMatrix.needsUpdate = true;
    }
    // ---- moonbeam dust motes
    if (A.motes) {
      const M = A.motes, pos = M.g.attributes.position.array, d = M.d;
      for (let i = 0; i < M.n; i++) {
        const b = i * 4, t = fract(M.base[b] + time * 0.012 * (1 + M.base[b + 3] * 0.05));
        const along = t * M.t0, px = WIN.x - d.x * along, py = WIN.y - d.y * along, pz = WIN.z - d.z * along;
        pos[i * 3] = px + M.base[b + 1] * 8 + Math.sin(time * 0.4 + M.base[b + 3]) * 1.2;
        pos[i * 3 + 1] = py + Math.sin(time * 0.3 + i) * 0.8;
        pos[i * 3 + 2] = pz + M.base[b + 2] * 8;
      }
      M.g.attributes.position.needsUpdate = true;
    }
    // ---- lightning through the round window
    const f = game.reduceMotion ? 0 : lightning(time);
    if (game.R) {
      game.R.sun.intensity = A.lit.sun * (1 + f * 2.2);
      game.R.hemi.intensity = A.lit.hemi * (1 + f * 1.6);
    }
    if (A.winMat) A.winMat.color.setRGB(0.6 + f * 1.6, 0.64 + f * 1.6, 0.78 + f * 1.4);
    if (A.shaftMat) A.shaftMat.color.setRGB(0.094 * (1 + f * 3), 0.13 * (1 + f * 3), 0.24 * (1 + f * 2.5));
    if (A.moonPool) A.moonPool.material.color.setRGB(0.065 * (1 + f * 4), 0.09 * (1 + f * 4), 0.18 * (1 + f * 3));
    const k = Math.floor(time / 12.5);
    if (f > 0.5 && A.thunderK !== k) { A.thunderK = k; if (live && snd.ctx) { snd.noiseBurst(1.8, { freq: 160, vol: 0.22, when: 0.5 }); snd.noiseBurst(1.2, { freq: 90, vol: 0.25, when: 0.7 }); } }
  },
};

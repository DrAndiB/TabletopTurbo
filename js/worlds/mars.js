// World 6: a museum-grade Mars diorama on a table. Rust sand with wind ripples and dunes, pressed craters,
// a layered cliff band under a painted butterscotch sky. A rover road of compacted, tread-marked sand lined
// with pale stones and survey stakes; a crater-rim jump (low gravity!), frost in a crater's shadow, a dune
// drift, a lava-tube skylight, a lander, a parachute, an old rover, a helicopter drone and a habitat dome.

const TRACK = [
  [-95, 72], [-20, 75], [40, 73], [88, 66], [122, 50], [141, 24], [146, -6], [138, -34], [120, -55], [94, -66],
  [58, -68], [24, -67], [5, -57], [-4, -36], [-5, -8], [-12, 20], [-32, 35], [-55, 30], [-64, 6], [-60, -24],
  [-66, -50], [-90, -66], [-122, -63], [-143, -38], [-148, 0], [-136, 44],
];

const BOUNDS = { minX: -166, maxX: 164, minZ: -93, maxZ: 95 };
const SUN = [-0.86, 0.46, 0.24];
const TX0 = -161, TX1 = 159, TZ0 = -100, TZ1 = 90; // modelled terrain inside the frame
const JS0 = 379, JS1 = 390, JH = 3.2; // the crater-rim ramp (arc length start/crest, height)
const HOLE = [-37, 24, 5]; // lava-tube skylight

let A = null; // per-frame animation state

export default {
  id: 'mars',
  name: 'Mars Rover Run',
  blurb: 'A museum Mars diorama: leap a crater rim, skid on frost, dodge a lava-tube pit.',
  vehicle: 'rover',
  gravity: 0.6,
  seed: 5,
  track: { points: TRACK, width: 14, startS: 40 },
  bounds: BOUNDS,
  fallOffEdges: true,
  floorY: -76,
  offCourse: 16,
  offroad: { kind: 'slow', margin: 1.5 },
  skidColor: 0x3a1a0e,
  dustColor: 0xc4784a,
  smoke: false,
  dust: {
    normal: { color: 0xb8653a, size: 1.7, life: 1.7, up: 1.4, grav: 0.2, alpha: 0.3, grow: 2.6, rate: 0.9 },
    slow: { color: 0xcf8a52, size: 1.5, life: 1.5, up: 2.6, grav: 0.8, alpha: 0.42, grow: 2.4, rate: 1.7 },
    slick: { color: 0xeef6ff, size: 0.55, life: 0.55, up: 3, grav: 18, alpha: 0.9, grow: 1, rate: 2 },
  },
  lighting: {
    sunDir: SUN, sunColor: 0xffc58e, sunIntensity: 3.9,
    hemiSky: 0xffd4ae, hemiGround: 0x7a3a22, hemiIntensity: 0.72,
    envIntensity: 0.32, exposure: 1.0, background: 0x120c09, shadowRadius: 2.2,
    fog: { color: 0x3a2318, near: 125, far: 430 },
  },

  async build(K) {
    const { THREE: T, TX, r, track } = K;
    const PI = Math.PI, TAU = PI * 2, L = track.length;
    const V2 = (a, b = a) => new T.Vector2(a, b);
    A = { t: 0 };
    const keep = []; // objects that must not be merged (animated / dynamic)
    const warnRoad = (what, x, z, m = 0.5) => { if (!K.offRoad(x, z, m)) console.warn(`mars: ${what} on road at ${x.toFixed(1)},${z.toFixed(1)}`); };
    const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
    const lerp = (a, b, t) => a + (b - a) * t;
    const local = (cx, cz, a, along, side) => [cx + Math.cos(a) * along - Math.sin(a) * side, cz + Math.sin(a) * along + Math.cos(a) * side];
    const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };

    // ---------------------------------------------------------------- noise helpers (bilinear, tileable fields)
    const NF = TX.noiseField(256, { seed: 17, period: 8, oct: 4 });
    const NF2 = TX.noiseField(256, { seed: 29, period: 16, oct: 3 });
    const bil = (f, x, y) => {
      x = ((x % 256) + 256) % 256; y = ((y % 256) + 256) % 256;
      const x0 = x | 0, y0 = y | 0, x1 = (x0 + 1) & 255, y1 = (y0 + 1) & 255, fx = x - x0, fy = y - y0;
      return (f[y0 * 256 + x0] * (1 - fx) + f[y0 * 256 + x1] * fx) * (1 - fy) + (f[y1 * 256 + x0] * (1 - fx) + f[y1 * 256 + x1] * fx) * fy;
    };
    const n1 = (x, z, sc, o = 0) => bil(NF, x * sc + 37 + o, z * sc + 91 + o * 0.7);
    const n2 = (x, z, sc, o = 0) => bil(NF2, x * sc + 11 + o, z * sc + 53);

    // ---------------------------------------------------------------- road distance field (1-unit grid)
    const G0X = -178, G0Z = -114, GW = 356, GH = 228;
    const RD = new Float32Array(GW * GH).fill(60), RS = new Float32Array(GW * GH);
    for (let i = 0; i < track.N; i += 2) {
      const x = track.x[i], z = track.z[i], hw = track.w[i] / 2, R = hw + 26;
      const gx0 = Math.max(0, Math.floor(x - R - G0X)), gx1 = Math.min(GW - 1, Math.ceil(x + R - G0X));
      const gz0 = Math.max(0, Math.floor(z - R - G0Z)), gz1 = Math.min(GH - 1, Math.ceil(z + R - G0Z));
      for (let gz = gz0; gz <= gz1; gz++) {
        const dz = gz + G0Z - z;
        for (let gx = gx0; gx <= gx1; gx++) {
          const dx = gx + G0X - x, d = Math.sqrt(dx * dx + dz * dz) - hw, k = gz * GW + gx;
          if (d < RD[k]) { RD[k] = d; RS[k] = i * track.ds; }
        }
      }
    }
    const roadD = (x, z) => {
      const gx = x - G0X, gz = z - G0Z;
      if (gx < 0 || gz < 0 || gx >= GW - 1 || gz >= GH - 1) return 60;
      const x0 = gx | 0, z0 = gz | 0, fx = gx - x0, fz = gz - z0, k = z0 * GW + x0;
      return (RD[k] * (1 - fx) + RD[k + 1] * fx) * (1 - fz) + (RD[k + GW] * (1 - fx) + RD[k + GW + 1] * fx) * fz;
    };
    const roadS = (x, z) => {
      const gx = Math.round(x - G0X), gz = Math.round(z - G0Z);
      if (gx < 0 || gz < 0 || gx >= GW || gz >= GH) return -1;
      return RS[gz * GW + gx];
    };

    // ---------------------------------------------------------------- terrain height model
    const rampY = (s) => (s < JS0 ? 0 : s <= JS1 ? JH * (s - JS0) / (JS1 - JS0) : s < JS1 + 3.5 ? JH * (1 - (s - JS1) / 3.5) : 0);
    const rampSink = (s) => 0.4 * ss(JS0 - 2.5, JS0 - 0.5, s) * (1 - ss(JS1 + 4.2, JS1 + 6, s));
    const JB = track.at(JS1 + 18); // jump crater centre
    const RAMP = (() => { const p = track.at((JS0 + JS1) / 2); return { s: (JS0 + JS1) / 2, x: p.x, z: p.z, c: Math.cos(p.angle), sn: Math.sin(p.angle), angle: p.angle }; })();
    const CR = [
      { x: 0.5, z: -17, R: 16, rim: 3.4, depth: 2.0, asym: 0.35, wIn: 0.12, wOut: 0.32 }, // A: frost crater (road through its west half)
      { x: JB.x, z: JB.z, R: 18, rim: JH + 0.9, depth: 1.0, asym: 0, wIn: 0.12, wOut: 0.36 }, // B: jump crater
      { x: -100, z: -26, R: 13, rim: 2.4, depth: 2.6, asym: 0.2, wIn: 0.14, wOut: 0.3 }, // C: west infield
      { x: 100, z: -6, R: 7.5, rim: 1.2, depth: 1.5, asym: 0.2, wIn: 0.18, wOut: 0.32 },
      { x: 34, z: 54, R: 6, rim: 0.9, depth: 1.2, asym: 0, wIn: 0.2, wOut: 0.35 },
      { x: -88, z: 50, R: 5.5, rim: 0.8, depth: 1.1, asym: 0, wIn: 0.2, wOut: 0.35 },
      { x: -26, z: -2, R: 5, rim: 0.7, depth: 1.0, asym: 0, wIn: 0.2, wOut: 0.35 },
      { x: 128, z: 64, R: 5, rim: 0.7, depth: 1.0, asym: 0, wIn: 0.2, wOut: 0.35 },
      { x: -128, z: 72, R: 4.5, rim: 0.6, depth: 0.9, asym: 0, wIn: 0.2, wOut: 0.35 },
      { x: 112, z: 8, R: 3.5, rim: 0.5, depth: 0.8, asym: 0, wIn: 0.2, wOut: 0.35 },
      { x: 62, z: 40, R: 4, rim: 0.6, depth: 0.9, asym: 0, wIn: 0.2, wOut: 0.35 },
      { x: -52, z: -42, R: 4, rim: 0.6, depth: 0.9, asym: 0, wIn: 0.2, wOut: 0.35 },
      { x: -128, z: 30, R: 4.5, rim: 0.7, depth: 1.0, asym: 0, wIn: 0.2, wOut: 0.35 },
      { x: 2, z: 52, R: 3.5, rim: 0.5, depth: 0.8, asym: 0, wIn: 0.2, wOut: 0.35 },
    ];
    for (const c of CR) { c.bb2 = (c.R * 2.4) ** 2; c.ph = r() * TAU; }
    const craterH = (c, x, z) => {
      const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), q = d / c.R;
      const a = Math.atan2(dz, dx);
      const rimH = c.rim * (1 + c.asym * (-dx / (d || 1))) * (0.86 + 0.28 * n1(Math.cos(a) * 40, Math.sin(a) * 40, 0.5, c.ph * 10));
      const w = q < 1 ? c.wIn : c.wOut;
      return rimH * Math.exp(-(((q - 1) / w) ** 2)) + rimH * 0.12 * Math.exp(-(((q - 1) / 0.9) ** 2)) - c.depth * (1 - ss(0.3, 0.92, q));
    };
    const FLAT = [[68, 2, 13], [36, 34, 8], [82, -36, 14], [112, -22, 11], [-34, -34, 7], [104, 26, 12], [-80, 40, 5]];
    const DS = { shape: 0, amp: 0 }; // last dune sample (for colouring crests)
    // dune amplitude (fields, flattened under the big props) on a 1-unit grid
    const AG0X = -172, AG0Z = -112, AGW = 346, AGH = 226, AMPG = new Float32Array(AGW * AGH);
    for (let j = 0; j < AGH; j++) for (let i = 0; i < AGW; i++) {
      const x = AG0X + i, z = AG0Z + j;
      const west = ss(34, 8, Math.hypot((x + 108) / 1.25, (z - 18) / 1.6));
      const south = ss(30, 6, Math.hypot((x - 70) / 2.2, (z - 50) / 1.0));
      const amp = 0.25 + 2.3 * west + 0.9 * south + 0.5 * ss(0.55, 0.75, n1(x, z, 0.02, 500));
      let flat = 1;
      for (const [fx, fz, fr] of FLAT) { const d = Math.hypot(x - fx, z - fz); if (d < fr + 8) flat = Math.min(flat, ss(fr, fr + 8, d)); }
      AMPG[j * AGW + i] = amp * flat;
    }
    const ampAt = (x, z) => {
      const gx = clamp(x - AG0X, 0, AGW - 1.001), gz = clamp(z - AG0Z, 0, AGH - 1.001), x0 = gx | 0, z0 = gz | 0, fx = gx - x0, fz = gz - z0, k = z0 * AGW + x0;
      return (AMPG[k] * (1 - fx) + AMPG[k + 1] * fx) * (1 - fz) + (AMPG[k + AGW] * (1 - fx) + AMPG[k + AGW + 1] * fx) * fz;
    };
    const duneP = (x, z) => {
      // transverse dunes: crests run NNW-SSE, gentle windward (west) slopes and steep lee (east) faces
      const w = n1(x, z, 0.03);
      const u = x * 0.97 + z * 0.24 + (w - 0.5) * 34 + (n1(x, z, 0.08, 300) - 0.5) * 9;
      const f = ((u / 15) % 1 + 1) % 1;
      return [f, ampAt(x, z), 1];
    };
    const duneH = (x, z) => {
      const [f, amp, flat] = duneP(x, z);
      const shape = f < 0.74 ? (f / 0.74) ** 1.25 : (1 - (f - 0.74) / 0.26) ** 1.7;
      DS.shape = shape; DS.amp = amp * flat;
      return (shape * amp * (0.55 + 0.45 * n1(x, z, 0.05, 900)) + (n1(x, z, 0.045, 150) - 0.5) * 1.3) * flat;
    };
    const zFoot = (x) => -80.5 - 2.6 * Math.sin(x / 23 + 1) - 1.8 * Math.sin(x / 9.3 + 2) - 7 * Math.exp(-(((x - JB.x) / 24) ** 2)) + 1.2 * Math.exp(-(((x + 30) / 16) ** 2));
    const BUTTES = [{ x: -27, z: -86, r: 8, h: 23 }, { x: 131, z: -88, r: 7, h: 19 }, { x: -118, z: -92, r: 9, h: 17 }];
    const terrace = (y, Ls = 2.1) => { if (y < 1.2) return y; const q = y / Ls, f = q - Math.floor(q); return (Math.floor(q) + ss(0.22, 0.78, f)) * Ls * 0.9 + y * 0.1; };
    const cliffTop = (x) => (6 + 13 * ss(0.36, 0.64, n1(x, 0, 0.022, 700))) * ss(TX0 + 2, TX0 + 18, x) * ss(TX1 - 2, TX1 - 18, x);
    const cliffH = (x, z) => {
      if (z > -66) return 0;
      const t = zFoot(x) - z;
      let y = 0;
      if (t > -5) {
        const top = cliffTop(x);
        const talus = 2.4 * ss(-5, 1.8, t) ** 1.6 * Math.min(1, top / 6);
        const face = top * ss(0.8, 4.4 + top * 0.1, t);
        y = Math.max(talus, terrace(face)) + (n1(x, z, 0.16, 40) - 0.5) * 1.1 * ss(1, 6, t);
      }
      for (const b of BUTTES) {
        const d = Math.hypot((x - b.x) * 1.15, z - b.z) + (n1(x, z, 0.2, b.x) - 0.5) * 3;
        if (d > b.r + 9) continue;
        const by = Math.max(terrace(b.h * ss(b.r + 2.4, b.r - 0.5, d)), 3.2 * ss(b.r + 9, b.r + 1, d) ** 1.6);
        if (by > y) y = by;
      }
      return y;
    };
    const H = (x, z) => {
      let h = duneH(x, z);
      for (const c of CR) { const dx = x - c.x, dz = z - c.z; if (dx * dx + dz * dz < c.bb2) h += craterH(c, x, z); }
      // skylight: collapse rim
      { const d = Math.hypot(x - HOLE[0], z - HOLE[1]); if (d < 12) h = h * ss(6, 12, d) + 0.35 * Math.exp(-(((d - 6.3) / 1.2) ** 2)); }
      // flatten towards the frame
      h *= ss(0, 6, Math.min(x - TX0, TX1 - x, TZ1 - z));
      const d = roadD(x, z);
      if (d < 3.4) {
        let base = 0;
        if (x > 40 && x < 110 && z < -50) { const sp = RAMP.s + (x - RAMP.x) * RAMP.c + (z - RAMP.z) * RAMP.sn; base = rampY(sp) - rampSink(sp); }
        h = base + (h - base) * ss(0.4, 3.2, d);
      }
      const c = cliffH(x, z);
      return c > 0 && c > h ? c : h;
    };
    const gy = H;

    // ---------------------------------------------------------------- helpers: contact shadows, rocks, rods
    const contacts = [];
    const AO = (x, z, rx, rz = rx, op = 0.4, ang = 0, y = null) => contacts.push({ x, y: (y ?? gy(x, z)) + 0.06, z, ry: -ang, sx: rx * 2, sy: op, sz: rz * 2 });
    const flushAO = () => {
      const g = new T.PlaneGeometry(1, 1); g.rotateX(-PI / 2);
      const mat = new T.MeshBasicMaterial({ color: 0x1a0802, transparent: true, alphaMap: TX.blobShadowTexture(), depthWrite: false });
      mat.onBeforeCompile = (sh) => {
        sh.vertexShader = 'varying float vOp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\nvOp = length(instanceMatrix[1].xyz);\n#endif');
        sh.fragmentShader = 'varying float vOp;\n' + sh.fragmentShader.replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\ndiffuseColor.a *= vOp;');
      };
      const im = K.instances(g, mat, contacts, { cast: false, receive: false });
      im.renderOrder = 1;
    };
    // Baker: many small things sharing one material are merged per area into one mesh with vertex colours
    // (instance colour x geometry colour): one draw call per area instead of one per type.
    const bakeQ = new Map();
    const chunked = (geo, mat, list, opts = {}, cell = 160) => {
      const cast = opts.cast !== false;
      const key = mat.uuid + (cast ? 'c' : '') + ':' + cell;
      if (!bakeQ.has(key)) bakeQ.set(key, { mat, cast, cell, items: [] });
      const ng = geo.index ? geo.toNonIndexed() : geo;
      for (const it of list) bakeQ.get(key).items.push({ geo: ng, it });
    };
    const flushBake = () => {
      const m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), pv = new T.Vector3(), sv = new T.Vector3(), nm = new T.Matrix3(), c = new T.Color();
      for (const { mat, cast, cell, items } of bakeQ.values()) {
        const cells = new Map();
        for (const x of items) {
          const k = Math.floor((x.it.z + 200) / 95) + ':' + (cell > 200 ? Math.floor((x.it.x + 200) / cell) : 0);
          if (!cells.has(k)) cells.set(k, []);
          cells.get(k).push(x);
        }
        for (const list of cells.values()) {
          let nv = 0;
          for (const { geo } of list) nv += geo.attributes.position.count;
          const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), U = new Float32Array(nv * 2), C = new Float32Array(nv * 3);
          let o = 0;
          for (const { geo, it } of list) {
            e.set(it.rx || 0, it.ry || 0, it.rz || 0, 'YXZ'); q.setFromEuler(e);
            pv.set(it.x, it.y || 0, it.z); sv.set(it.sx ?? it.s ?? 1, it.sy ?? it.s ?? 1, it.sz ?? it.s ?? 1);
            m4.compose(pv, q, sv); nm.getNormalMatrix(m4);
            c.set(it.color ?? 0xffffff);
            const gp = geo.attributes.position, gn = geo.attributes.normal, gu = geo.attributes.uv, gc = geo.attributes.color;
            for (let i = 0; i < gp.count; i++, o++) {
              pv.fromBufferAttribute(gp, i).applyMatrix4(m4); P[o * 3] = pv.x; P[o * 3 + 1] = pv.y; P[o * 3 + 2] = pv.z;
              if (gn) { pv.fromBufferAttribute(gn, i).applyMatrix3(nm).normalize(); N[o * 3] = pv.x; N[o * 3 + 1] = pv.y; N[o * 3 + 2] = pv.z; }
              if (gu) { U[o * 2] = gu.getX(i); U[o * 2 + 1] = gu.getY(i); }
              const r0 = gc ? gc.getX(i) : 1, g0 = gc ? gc.getY(i) : 1, b0 = gc ? gc.getZ(i) : 1;
              C[o * 3] = c.r * r0; C[o * 3 + 1] = c.g * g0; C[o * 3 + 2] = c.b * b0;
            }
          }
          const g = new T.BufferGeometry();
          g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('normal', new T.BufferAttribute(N, 3));
          g.setAttribute('uv', new T.BufferAttribute(U, 2)); g.setAttribute('color', new T.BufferAttribute(C, 3));
          g.computeBoundingSphere();
          const m = new T.Mesh(g, mat); m.castShadow = cast; m.receiveShadow = true;
          keep.push(m); K.group.add(m);
        }
      }
    };
    const rod = (a, b, rad, mat, parent, seg = 8) => {
      const d = new T.Vector3().subVectors(b, a), len = d.length();
      const m = new T.Mesh(new T.CylinderGeometry(rad, rad, len, seg), mat);
      m.position.copy(a).addScaledVector(d, 0.5);
      m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
      parent.add(m);
      return m;
    };
    const P3 = (x, y, z) => new T.Vector3(x, y, z);
    // irregular rock: jittered icosahedron, dusty on top (vertex colours)
    const basaltCols = [[0x4a3a33, 0x8a4e30], [0x3e3330, 0x7e4a30], [0x5a463a, 0x9a5c38], [0x332b28, 0x76452c], [0x6a5040, 0xa8683e]];
    const rockGeo = (detail, amt, seed, flatY = 0.8, pal = 0) => {
      let g = new T.IcosahedronGeometry(1, detail);
      g.deleteAttribute('normal'); g.deleteAttribute('uv');
      g = K.BufferGeometryUtils.mergeVertices(g);
      const p = g.attributes.position, uv = new Float32Array(p.count * 2);
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const n = Math.sin(x * 5.1 + seed) * Math.sin(y * 4.3 + seed * 2) * Math.sin(z * 4.7 + seed * 3);
        const k = 1 + n * amt + Math.sin(x * 2.1 + z * 1.7 + seed) * amt * 0.6 + Math.sin(y * 3.3 + x * 1.1 + seed * 0.5) * amt * 0.4;
        p.setXYZ(i, x * k, (y < 0 ? y * 0.55 : y * flatY) * k, z * k);
        uv[i * 2] = (x + z * 0.6) * 0.35 + seed; uv[i * 2 + 1] = (y + z * 0.35) * 0.35;
      }
      // planar cleavage cuts: angular basalt facets
      const cr = K.rng(seed * 13 + 7), cuts = [];
      for (let k = 0; k < 6; k++) { const a = cr() * TAU, e = cr.range(-0.3, 1.1); cuts.push([Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e), cr.range(0.5, 0.78)]); }
      for (let i = 0; i < p.count; i++) {
        let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        for (const [nx, ny, nz, d] of cuts) { const dd = x * nx + y * ny + z * nz; if (dd > d) { const t = (dd - d) * 0.94; x -= nx * t; y -= ny * t; z -= nz * t; } }
        p.setXYZ(i, x, y, z);
      }
      g.setAttribute('uv', new T.BufferAttribute(uv, 2));
      g.computeVertexNormals();
      const nr = g.attributes.normal, col = new Float32Array(p.count * 3), c = new T.Color(), cb = new T.Color(basaltCols[pal][0]), cd = new T.Color(basaltCols[pal][1]);
      for (let i = 0; i < p.count; i++) { // box-projected uvs (no stretching on the cut faces)
        const ax = Math.abs(nr.getX(i)), ay = Math.abs(nr.getY(i)), az = Math.abs(nr.getZ(i)), x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        if (ay >= ax && ay >= az) uv[i * 2] = x * 0.8 + seed, uv[i * 2 + 1] = z * 0.8; else if (ax >= az) uv[i * 2] = z * 0.8 + seed, uv[i * 2 + 1] = y * 0.8; else uv[i * 2] = x * 0.8 + seed, uv[i * 2 + 1] = y * 0.8;
      }
      for (let i = 0; i < p.count; i++) {
        const t = ss(0.25, 0.85, nr.getY(i)) * 0.85 + (Math.sin(p.getX(i) * 9 + seed) * 0.5 + 0.5) * 0.1;
        c.copy(cb).lerp(cd, t);
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
      g.setAttribute('color', new T.BufferAttribute(col, 3));
      return g;
    };

    // ---------------------------------------------------------------- textures
    // macro colour map of the whole board (sand tones, basalt patches, ejecta, small craters, tracks)
    const MW = 1024, MH = 608;
    const mpx = (x) => (x - TX0) / (TX1 - TX0) * MW, mpy = (z) => (z - TZ0) / (TZ1 - TZ0) * MH;
    const macroLo = TX.paint(MW / 2, MH / 2, (px, py, u, v, o) => {
      const x = TX0 + u * (TX1 - TX0), z = TZ0 + v * (TZ1 - TZ0);
      const a = n1(x, z, 0.06), b = n1(x, z, 0.013, 400), c = n2(x, z, 0.09);
      let R = 190, G = 104, B = 60;
      const t = (a - 0.5) * 1.7 + (b - 0.5) * 1.4;
      R += t * 36; G += t * 28; B += t * 14;
      const bas = ss(0.57, 0.68, c) * 0.62;
      R = lerp(R, 96, bas); G = lerp(G, 70, bas); B = lerp(B, 58, bas);
      // dune crests: a crisp bright brink line, lighter windward slopes, darker lee faces
      { const amp0 = ampAt(x, z), an = Math.min(1, amp0 / 1.8);
        if (an > 0.3) { const f = duneP(x, z)[0]; const crest = Math.exp(-(((f - 0.722) / 0.034) ** 2)), lee = ss(0.74, 0.78, f) * (1 - ss(0.95, 1, f));
          const t2 = (crest * 40 + (f < 0.74 ? f / 0.74 : 0) * 12 - lee * 18) * an; R += t2; G += t2 * 0.8; B += t2 * 0.55; } }
      // dune fields: darker, redder basaltic sand
      const dun = Math.max(ss(34, 8, Math.hypot((x + 108) / 1.25, (z - 18) / 1.6)), 0.7 * ss(30, 6, Math.hypot((x - 70) / 2.2, (z - 50) / 1.0))) * 0.38;
      R = lerp(R, 134, dun); G = lerp(G, 74, dun); B = lerp(B, 52, dun);
      o[0] = R; o[1] = G; o[2] = B;
    });
    const macroC = TX.makeCanvas(MW, MH);
    {
      const g = macroC.getContext('2d');
      g.imageSmoothingEnabled = true; g.drawImage(macroLo, 0, 0, MW, MH);
      const rr = K.rng(77);
      const sx = MW / (TX1 - TX0), sz = MH / (TZ1 - TZ0);
      const ell = (x, z, rx, rz, rot = 0) => { g.beginPath(); g.ellipse(mpx(x), mpy(z), rx * sx, rz * sz, rot, 0, TAU); };
      // ejecta blankets and darker floors for the modelled craters
      for (const c of CR) {
        const gr = g.createRadialGradient(mpx(c.x), mpy(c.z), c.R * sx * 0.9, mpx(c.x), mpy(c.z), c.R * sx * 2.3);
        gr.addColorStop(0, 'rgba(232,170,118,0.32)'); gr.addColorStop(1, 'rgba(232,170,118,0)');
        g.fillStyle = gr; ell(c.x, c.z, c.R * 2.3, c.R * 2.3); g.fill();
        const fl = g.createRadialGradient(mpx(c.x), mpy(c.z), 0, mpx(c.x), mpy(c.z), c.R * sx * 0.95);
        fl.addColorStop(0, 'rgba(110,52,30,0.28)'); fl.addColorStop(0.8, 'rgba(110,52,30,0.18)'); fl.addColorStop(1, 'rgba(110,52,30,0)');
        g.fillStyle = fl; ell(c.x, c.z, c.R, c.R); g.fill();
        // bright wind streak downwind (east)
        const ws = g.createRadialGradient(mpx(c.x + c.R * 2.2), mpy(c.z), 0, mpx(c.x + c.R * 2.2), mpy(c.z), c.R * sx * 2.2);
        ws.addColorStop(0, 'rgba(236,182,130,0.22)'); ws.addColorStop(1, 'rgba(236,182,130,0)');
        g.fillStyle = ws; ell(c.x + c.R * 2.2, c.z, c.R * 2.4, c.R * 0.8, 0.12); g.fill();
        // soft rim highlight and a west-to-east shading gradient across the bowl (sun from the west)
        const X = mpx(c.x), Z = mpy(c.z), Rr = c.R * sx;
        const rg = g.createRadialGradient(X, Z, Rr * 0.86, X, Z, Rr * 1.22);
        rg.addColorStop(0, 'rgba(244,196,146,0)'); rg.addColorStop(0.4, 'rgba(244,196,146,0.2)'); rg.addColorStop(1, 'rgba(244,196,146,0)');
        g.fillStyle = rg; g.beginPath(); g.arc(X, Z, Rr * 1.22, 0, TAU); g.fill();
        const lg = g.createLinearGradient(X - Rr, Z, X + Rr, Z);
        lg.addColorStop(0, 'rgba(50,20,10,0.3)'); lg.addColorStop(0.45, 'rgba(50,20,10,0.06)'); lg.addColorStop(0.75, 'rgba(250,205,160,0.06)'); lg.addColorStop(1, 'rgba(250,205,160,0.2)');
        g.save(); g.beginPath(); g.arc(X, Z, Rr * 0.9, 0, TAU); g.clip(); g.fillStyle = lg; g.fillRect(X - Rr, Z - Rr, Rr * 2, Rr * 2); g.restore();
        // scattered ejecta blocks as specks
        for (let i = 0; i < c.R * 14; i++) {
          const a = rr() * TAU, d = Rr * (1.05 + rr() ** 2 * 1.4);
          g.fillStyle = rr() < 0.6 ? `rgba(70,40,30,${0.3 + rr() * 0.4})` : `rgba(240,200,160,${0.3 + rr() * 0.3})`;
          g.fillRect(X + Math.cos(a) * d, Z + Math.sin(a) * d, 1 + rr() * 1.5, 1 + rr() * 1.5);
        }
      }
      // dust devil tracks: dark curly trails
      g.lineCap = 'round';
      for (let i = 0; i < 9; i++) {
        let x = rr.range(-150, 150), z = rr.range(-60, 85), a = rr() * TAU, cv = rr.range(-0.05, 0.05);
        g.strokeStyle = `rgba(70,32,20,${0.16 + rr() * 0.12})`; g.lineWidth = 1.6 + rr() * 2.2;
        g.beginPath(); g.moveTo(mpx(x), mpy(z));
        for (let k = 0; k < 140; k++) {
          cv += rr.range(-0.012, 0.012); cv = clamp(cv, -0.09, 0.09); a += cv + Math.sin(k * 0.6) * 0.18;
          x += Math.cos(a) * 1.4; z += Math.sin(a) * 1.4;
          g.lineTo(mpx(x), mpy(z));
        }
        g.stroke();
      }
      // small pressed craters: shaded west inner wall, lit east inner wall, bright rim
      for (let i = 0; i < 170; i++) {
        const x = rr.range(TX0 + 4, TX1 - 4), z = rr.range(-74, TZ1 - 4), rad = 0.5 + rr() ** 2.2 * 3.2;
        if (roadD(x, z) < rad + 1.5) continue;
        const X = mpx(x), Z = mpy(z), R = rad * sx;
        const ej = g.createRadialGradient(X, Z, R, X, Z, R * 2.4);
        ej.addColorStop(0, 'rgba(238,180,128,0.35)'); ej.addColorStop(1, 'rgba(238,180,128,0)');
        g.fillStyle = ej; g.beginPath(); g.arc(X, Z, R * 2.4, 0, TAU); g.fill();
        g.fillStyle = 'rgba(105,48,26,0.45)'; g.beginPath(); g.arc(X, Z, R * 0.86, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(40,16,8,0.6)'; g.lineWidth = Math.max(1, R * 0.32);
        g.beginPath(); g.arc(X + R * 0.08, Z, R * 0.72, PI * 0.55, PI * 1.45); g.stroke();
        g.strokeStyle = 'rgba(250,200,150,0.55)'; g.lineWidth = Math.max(0.8, R * 0.22);
        g.beginPath(); g.arc(X - R * 0.05, Z, R * 0.8, -PI * 0.4, PI * 0.4); g.stroke();
        g.strokeStyle = 'rgba(245,195,145,0.4)'; g.lineWidth = Math.max(0.8, R * 0.25);
        g.beginPath(); g.arc(X, Z, R * 1.05, PI * 0.6, PI * 1.4); g.stroke();
      }
      // the old rover's wandering tracks (two wheel lines) ending at its parking spot
      {
        const pts = [];
        let x = 6, z = 46, a = -0.25;
        for (let k = 0; k < 60; k++) { a += Math.sin(k * 0.21) * 0.035 - 0.004; x += Math.cos(a) * 0.55; z += Math.sin(a) * 0.55; pts.push([x, z, a]); }
        for (const side of [-1.9, 1.9]) {
          g.strokeStyle = 'rgba(78,36,20,0.42)'; g.lineWidth = 1.8;
          g.beginPath();
          pts.forEach(([px2, pz, pa], k) => { const X = mpx(px2 - Math.sin(pa) * side), Z = mpy(pz + Math.cos(pa) * side); if (k) g.lineTo(X, Z); else g.moveTo(X, Z); });
          g.stroke();
        }
        A.oldTrackEnd = pts[pts.length - 1];
      }
      // darker basalt gravel strewn below the cliffs
      for (let i = 0; i < 900; i++) {
        const x = rr.range(TX0, TX1), z = zFoot(x) + rr.range(-6, 3);
        g.fillStyle = `rgba(${50 + rr() * 30},${34 + rr() * 20},${28 + rr() * 14},${0.3 + rr() * 0.4})`;
        g.fillRect(mpx(x), mpy(z), 1 + rr() * 1.6, 1 + rr() * 1.4);
      }
    }
    const macroTex = TX.toTexture(macroC, { wrap: false });
    // fine detail (grains, grit) multiplied in world space
    const detC = TX.paint(256, 256, (x, y, u, v, o) => {
      const hn = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453, nn = hn - Math.floor(hn);
      const lo = bil(NF2, u * 256, v * 256);
      const k = 128 + (nn - 0.5) * 22 + (lo - 0.5) * 40;
      o[0] = k; o[1] = k * 0.99; o[2] = k * 0.98;
    });
    {
      const g = detC.getContext('2d'), rr = K.rng(91);
      for (let i = 0; i < 240; i++) {
        const x = rr() * 256, y = rr() * 256, rad = 0.8 + rr() * rr() * 3.2, dark = rr() < 0.6;
        for (const [ox, oy] of [[0, 0], [256, 0], [-256, 0], [0, 256], [0, -256]]) {
          g.fillStyle = dark ? `rgba(40,30,26,${0.35 + rr() * 0.3})` : `rgba(230,200,170,${0.3 + rr() * 0.3})`;
          g.beginPath(); g.ellipse(x + ox, y + oy, rad, rad * 0.75, rr() * 3, 0, TAU); g.fill();
        }
      }
    }
    const detailTex = TX.toTexture(detC, { srgb: false });

    // wind ripples (normal map): asymmetric ripples, crests N-S, about 0.56 units apart
    const ripple = (() => {
      const S = 512, hf = new Float32Array(S * S);
      const warp = TX.noiseField(256, { seed: 41, period: 4, oct: 3 });
      const grain = TX.noiseField(512, { seed: 43, period: 64, oct: 2 });
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const u = x / S, v = y / S;
        const w = bil(warp, u * 256, v * 256);
        const ph = 16 * u + (w - 0.5) * 2.6 + Math.sin(v * TAU * 2) * 0.15;
        const f = ph - Math.floor(ph);
        const rip = f < 0.68 ? f / 0.68 : (1 - f) / 0.32;
        hf[y * S + x] = rip * 0.62 + grain[y * S + x] * 0.38;
      }
      return TX.toTexture(TX.normalFromHeight(hf, S, S, 1.8), { srgb: false });
    })();
    ripple.repeat.set((TX1 - TX0) / 9, (TZ1 - TZ0) / 9);

    // sedimentary strata for the cliffs and buttes, looked up by world height
    const strataTex = (() => {
      const rr = K.rng(404), layers = [];
      const pal = [[217, 168, 119], [184, 103, 63], [230, 196, 156], [142, 106, 96], [201, 141, 80], [122, 76, 56], [220, 180, 138], [164, 90, 58], [236, 214, 180], [110, 72, 60]];
      let y = 0;
      while (y < 512) { const t = 6 + rr() * rr() * 46; layers.push([y, y + t, pal[(rr() * pal.length) | 0], rr()]); y += t; }
      const c = TX.paint(64, 512, (x, yy, u, v, o) => {
        const py = 511 - yy; // canvas row 0 is the top (v = 1)
        let L0 = layers[0];
        for (const Ly of layers) if (py >= Ly[0] && py < Ly[1]) { L0 = Ly; break; }
        const lam = 0.94 + 0.06 * Math.sin(py * 2.1 + L0[3] * 10);
        const n = bil(NF, u * 256, v * 64 + L0[3] * 50);
        const edge = Math.min(py - L0[0], L0[1] - py) < 1.2 ? 0.82 : 1;
        const k = lam * edge * (0.86 + (n - 0.5) * 0.5);
        o[0] = L0[2][0] * k; o[1] = L0[2][1] * k; o[2] = L0[2][2] * k;
      });
      return TX.toTexture(c);
    })();
    const detailShader = (sh) => {
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
            float wob = sin(vWP.x * 0.07) * 0.7 + sin(vWP.x * 0.23 + vWP.z * 0.13) * 0.3;
            vec3 st = texture2D(tStrata, vec2(vWP.x / 37.0 + vWP.z / 83.0, (vWP.y + wob) / 30.0)).rgb;
            st *= mix(0.78, 1.0, fl) * d1 * 2.0;
            diffuseColor.rgb = mix(diffuseColor.rgb, st, vCliff);
          } }`).replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize(mix(normal, nonPerturbedNormal, clamp(vCliff * 1.5, 0.0, 1.0)));');
    };
    const sandMat = K.std({ map: macroTex, normalMap: ripple, normalScale: V2(0.85), vertexColors: true, roughness: 0.95 });
    sandMat.onBeforeCompile = detailShader;

    // ---------------------------------------------------------------- terrain mesh (one height grid, chunked)
    {
      const NX = 214, XS = [], ZS = [];
      for (let i = 0; i <= NX; i++) XS.push(TX0 + (TX1 - TX0) * i / NX);
      const ZM = -73;
      for (let k = 0; k < 36; k++) ZS.push(TZ0 + (ZM - TZ0) * k / 36);
      for (let k = 0; k <= 109; k++) ZS.push(ZM + (TZ1 - ZM) * k / 109);
      const nx = XS.length, nz = ZS.length;
      const HG = new Float32Array(nx * nz), CF = new Uint8Array(nx * nz);
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
        const x = XS[i], z = ZS[j], h = H(x, z);
        HG[j * nx + i] = h;
        const c = cliffH(x, z);
        CF[j * nx + i] = c > 0.6 && c >= h - 1e-4 ? 1 : 0;
      }
      // the skylight shaft: inside the hole the ground drops away
      const holeIn = (x, z) => Math.hypot(x - HOLE[0], z - HOLE[1]) < HOLE[2] + 0.3;
      const NRM = new Float32Array(nx * nz * 3), COL = new Float32Array(nx * nz * 3), CL = new Float32Array(nx * nz);
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        const i0 = Math.max(0, i - 1), i1 = Math.min(nx - 1, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(nz - 1, j + 1);
        const dhx = (HG[j * nx + i1] - HG[j * nx + i0]) / (XS[i1] - XS[i0]);
        const dhz = (HG[j1 * nx + i] - HG[j0 * nx + i]) / (ZS[j1] - ZS[j0]);
        const l = Math.hypot(dhx, 1, dhz);
        const ny = 1 / l;
        NRM[k * 3] = -dhx / l; NRM[k * 3 + 1] = ny; NRM[k * 3 + 2] = -dhz / l;
        const x = XS[i], z = ZS[j], h = HG[k];
        let cr = 1, cg = 1, cb = 1;
        if (CF[k]) {
          CL[k] = ss(0.5, 1.8, h);
          const sh = 0.8 + 0.2 * ss(0.2, 0.9, ny) + 0.06 * (n1(x, z, 0.4, 33) - 0.5);
          cr = cg = cb = sh;
        } else {
          duneH(x, z);
          const crest = (DS.shape - 0.55) * Math.min(1, DS.amp / 1.4);
          const kk = (1 + clamp(h * 0.06, -0.22, 0.14)) * (0.84 + 0.16 * ny) * (1 + crest * 0.22);
          cr = kk * (1.01 + crest * 0.04); cg = kk; cb = kk * (0.98 - crest * 0.04);
        }
        if (holeIn(x, z)) { cr = cg = cb = 0.05; }
        COL[k * 3] = cr; COL[k * 3 + 1] = cg; COL[k * 3 + 2] = cb;
      }
      const xsplit = [0, 54, 107, 161, NX], zsplit = [0, 36, 90, nz - 1];
      for (let a = 0; a < 4; a++) for (let b = 0; b < 3; b++) {
        const i0 = xsplit[a], i1 = xsplit[a + 1], j0 = zsplit[b], j1 = zsplit[b + 1];
        const w = i1 - i0 + 1, hgt = j1 - j0 + 1;
        const pos = new Float32Array(w * hgt * 3), nrm = new Float32Array(w * hgt * 3), col = new Float32Array(w * hgt * 3), uv = new Float32Array(w * hgt * 2), cl = new Float32Array(w * hgt);
        for (let j = 0; j < hgt; j++) for (let i = 0; i < w; i++) {
          const gi = i0 + i, gj = j0 + j, k = gj * nx + gi, o = j * w + i;
          pos[o * 3] = XS[gi]; pos[o * 3 + 1] = HG[k]; pos[o * 3 + 2] = ZS[gj];
          nrm.set([NRM[k * 3], NRM[k * 3 + 1], NRM[k * 3 + 2]], o * 3);
          col.set([COL[k * 3], COL[k * 3 + 1], COL[k * 3 + 2]], o * 3); cl[o] = CL[k];
          uv[o * 2] = (XS[gi] - TX0) / (TX1 - TX0); uv[o * 2 + 1] = 1 - (ZS[gj] - TZ0) / (TZ1 - TZ0);
        }
        const idx = [];
        for (let j = 0; j < hgt - 1; j++) for (let i = 0; i < w - 1; i++) {
          const p = j * w + i, q = p + 1, s2 = p + w, t2 = s2 + 1;
          const cx = (XS[i0 + i] + XS[i0 + i + 1]) / 2, cz = (ZS[j0 + j] + ZS[j0 + j + 1]) / 2;
          if (Math.hypot(cx - HOLE[0], cz - HOLE[1]) < HOLE[2] + 0.9) continue;
          idx.push(p, s2, q, q, s2, t2);
        }
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.BufferAttribute(pos, 3));
        g.setAttribute('normal', new T.BufferAttribute(nrm, 3));
        g.setAttribute('color', new T.BufferAttribute(col, 3));
        g.setAttribute('uv', new T.BufferAttribute(uv, 2));
        g.setAttribute('aCliff', new T.BufferAttribute(cl, 1));
        g.setIndex(idx);
        g.computeBoundingSphere();
        const m = new T.Mesh(g, sandMat);
        m.castShadow = b === 0; m.receiveShadow = true;
        keep.push(m);
        K.group.add(m);
      }
    }

    // ---------------------------------------------------------------- the road: compacted, tread-marked sand
    const RW = 19; // ribbon width (road + feathered verges)
    const vScale = L / Math.round(L / 30);
    {
      const W = 256, Hh = 1024, fe = 2.5 / RW;
      const c = TX.paint(W, Hh, (x, y, u, v, o) => {
        const e = Math.min(u, 1 - u);
        const en = (bil(NF, u < 0.5 ? 20 : 200, v * 256 * 1.5) - 0.5) * 0.09;
        const al = ss(0.004, fe * 1.25 + en, e);
        const n = bil(NF2, u * 48, v * 256), hn = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453, nn = hn - Math.floor(hn);
        const k = 0.9 + (n - 0.5) * 0.3 + (nn - 0.5) * 0.14;
        const verge = 1 - ss(fe * 0.6, fe * 1.7, e); // loose lighter sand at the verges
        const crown = Math.exp(-(((u - 0.5) / 0.05) ** 2)) * 0.12; // a little ridge of loose sand between the lanes
        o[0] = lerp(104, 172, verge * 0.7 + crown) * k; o[1] = lerp(74, 104, verge * 0.7 + crown) * k; o[2] = lerp(60, 66, verge * 0.7 + crown) * k;
        o[3] = al * 255;
      });
      const g = c.getContext('2d'), rr = K.rng(23);
      const uOf = (lat) => (lat / RW + 0.5) * W, ppu = Hh / vScale, pxu = W / RW;
      // wheel tracks: two lanes of six-wheeled rover tracks with chevron grousers, gently wandering (tileable)
      for (const [lane, ph, amp, str] of [[-3.1, 0.3, 0.12, 1], [3.0, 1.7, 0.16, 1], [0.2, 4.1, 0.55, 0.35]]) {
        for (const side of [-1.22, 1.22]) {
          const wob = (yy) => Math.sin(yy / Hh * TAU * 2 + ph) * amp + Math.sin(yy / Hh * TAU * 5 + ph * 2) * amp * 0.3;
          const hw = 0.3 * pxu;
          g.fillStyle = `rgba(40,24,18,${0.32 * str})`;
          for (let yy = 0; yy < Hh; yy += 2) g.fillRect(uOf(lane + side + wob(yy)) - hw, yy, hw * 2, 2);
          const step = 0.6 * ppu;
          for (let yy = 0; yy < Hh - 1; yy += step) {
            const cx = uOf(lane + side + wob(yy));
            g.strokeStyle = `rgba(28,16,12,${0.6 * str})`; g.lineWidth = 2.2;
            g.beginPath(); g.moveTo(cx - hw, yy); g.lineTo(cx, yy + step * 0.3); g.lineTo(cx + hw, yy); g.stroke();
            g.strokeStyle = `rgba(190,140,110,${0.45 * str})`; g.lineWidth = 1.4;
            g.beginPath(); g.moveTo(cx - hw, yy + 2.5); g.lineTo(cx, yy + step * 0.3 + 2.5); g.lineTo(cx + hw, yy + 2.5); g.stroke();
          }
          // pushed-up sand lips either side of the track
          g.fillStyle = `rgba(200,140,100,${0.18 * str})`;
          for (let yy = 0; yy < Hh; yy += 2) { const cx = uOf(lane + side + wob(yy)); g.fillRect(cx - hw - 2.2, yy, 1.6, 2); g.fillRect(cx + hw + 0.6, yy, 1.6, 2); }
        }
      }
      // little pebbles pressed into the road
      for (let i = 0; i < 320; i++) {
        const x = uOf(rr.range(-6.8, 6.8)), y = rr() * Hh, rad = 0.6 + rr() * 1.4;
        g.fillStyle = rr() < 0.55 ? `rgba(44,34,30,${0.4 + rr() * 0.3})` : `rgba(200,160,130,${0.3 + rr() * 0.3})`;
        g.beginPath(); g.ellipse(x, y, rad, rad * 0.7, rr() * 3, 0, TAU); g.fill();
      }
      const roadTex = TX.toTexture(c);
      // height for the normal map, computed directly (no canvas read-back): grit, wheel grooves and grousers
      const rh = new Float32Array(W * Hh);
      const lanes = [[-3.1, 0.3, 0.12, 1], [3.0, 1.7, 0.16, 1], [0.2, 4.1, 0.55, 0.35]];
      const stepPx = 0.6 * ppu;
      for (let yy = 0; yy < Hh; yy++) {
        const tracks = [];
        for (const [lane, ph, amp, str] of lanes) {
          const wob = Math.sin(yy / Hh * TAU * 2 + ph) * amp + Math.sin(yy / Hh * TAU * 5 + ph * 2) * amp * 0.3;
          for (const side of [-1.22, 1.22]) tracks.push([uOf(lane + side + wob), str]);
        }
        for (let xx = 0; xx < W; xx++) {
          const hn = Math.sin(xx * 12.9898 + yy * 78.233) * 43758.5453;
          let h = 0.5 + (hn - Math.floor(hn) - 0.5) * 0.25 + (bil(NF2, xx / W * 48, yy / Hh * 256) - 0.5) * 0.6;
          for (const [cx, str] of tracks) {
            const dx = Math.abs(xx - cx), hw = 0.3 * pxu;
            if (dx < hw + 3) {
              if (dx < hw) {
                const ph = ((yy - 0.3 * stepPx * (1 - dx / hw)) % stepPx + stepPx) % stepPx;
                h -= (0.55 - (ph < 2.5 ? 0.45 : 0)) * str;
              } else h += 0.25 * str * (1 - (dx - hw) / 3);
            }
          }
          rh[yy * W + xx] = h;
        }
      }
      const roadN = TX.toTexture(TX.normalFromHeight(rh, W, Hh, 2.2), { srgb: false });
      const roadMat = K.std({ map: roadTex, normalMap: roadN, normalScale: V2(0.9), roughness: 0.93, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      // ribbon that follows the ground height (it climbs the crater rim at the jump)
      const segU = 8, pos = [], uv = [], idx = [];
      const rows = [];
      for (let s = 0; s < L - 0.01;) { rows.push(s); s += s > JS0 - 4 && s < JS1 + 7 ? 0.35 : 1; }
      rows.push(L);
      rows.forEach((s, ri) => {
        const p = track.at(s);
        for (let j = 0; j <= segU; j++) {
          const u = j / segU, o = (u - 0.5) * RW;
          const x = p.x + p.nx * o, z = p.z + p.nz * o;
          pos.push(x, gy(x, z) + 0.05 + rampSink(s), z);
          uv.push(u, s / vScale);
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
      m.receiveShadow = true; m.castShadow = false;
      keep.push(m);
      K.group.add(m);
    }

    // ---------------------------------------------------------------- road edges: pale stones + survey stakes
    const stoneTex = TX.mottledTextures({ size: 128, a: 0xffffff, b: 0xd0c8bc, seed: 61, period: 16, bump: 4, speck: 0.3 });
    const paleStoneMat = K.std({ vertexColors: true, roughness: 0.78, normalMap: stoneTex.normalMap, normalScale: V2(0.8) });
    {
      const geos = [0, 1, 2].map((k) => {
        let g = new T.IcosahedronGeometry(1, 0);
        g.deleteAttribute('normal'); g.deleteAttribute('uv');
        g = K.BufferGeometryUtils.mergeVertices(g);
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
          const q = 1 + Math.sin(x * 4.1 + k * 2) * Math.sin(z * 3.7 + k) * 0.22 + Math.sin(y * 3 + x * 2 + k) * 0.12;
          p.setXYZ(i, x * q, y * q * (y < 0 ? 0.5 : 0.8), z * q);
        }
        g.computeVertexNormals();
        return g;
      });
      const pale = [0xe8dccb, 0xd9c9b2, 0xf2ebe0, 0xcdb79c, 0xe0d2c0, 0xbfae98];
      const lists = [[], [], []];
      for (const side of [-1, 1]) {
        for (const p of track.edgePoints(side, 1.15, 0.75)) {
          if (Math.hypot(p.x - HOLE[0], p.z - HOLE[1]) < HOLE[2] + 0.8) continue;
          const j = r.range(-0.3, 0.45) * side, x = p.x + Math.cos(p.angle + PI / 2) * j, z = p.z + Math.sin(p.angle + PI / 2) * j;
          const s = r.range(0.32, 0.58);
          lists[(r() * 3) | 0].push({ x, y: gy(x, z) + s * 0.25, z, ry: r() * TAU, sx: s * r.range(1, 1.4), sy: s, sz: s, color: r.pick(pale) });
          if (r() < 0.22) { // a smaller companion
            const x2 = x + r.range(-0.6, 0.6), z2 = z + r.range(-0.6, 0.6), s2 = s * 0.55;
            lists[(r() * 3) | 0].push({ x: x2, y: gy(x2, z2) + s2 * 0.2, z: z2, ry: r() * TAU, s: s2, color: r.pick(pale) });
          }
        }
      }
      chunked(geos[1], paleStoneMat, lists.flat(), { colors: true, cast: true }, 160);
      // survey stakes: pale wooden stick with an orange-painted tip and a tiny flag
      const parts = [];
      const add = (g, col) => { g = g.index ? g.toNonIndexed() : g; const n = g.attributes.position.count, c = new Float32Array(n * 3), cc = new T.Color(col); for (let i = 0; i < n; i++) c.set([cc.r, cc.g, cc.b], i * 3); g.setAttribute('color', new T.BufferAttribute(c, 3)); g.deleteAttribute('uv'); parts.push(g); };
      add(new T.CylinderGeometry(0.1, 0.13, 2.5, 6).translate(0, 1.25, 0), 0xd8c09a);
      add(new T.CylinderGeometry(0.115, 0.115, 0.55, 6).translate(0, 2.3, 0), 0xff5a14);
      add(new T.BoxGeometry(0.8, 0.5, 0.03).translate(0.42, 2.25, 0), 0xff6a1c);
      const stakeGeo = K.BufferGeometryUtils.mergeGeometries(parts);
      const stakeMat = K.std({ vertexColors: true, roughness: 0.6, side: T.DoubleSide });
      const stakes = [];
      for (const side of [-1, 1]) {
        for (const p of track.edgePoints(side, 15, 2.1, side < 0 ? 0 : 7.5)) {
          if (Math.abs(p.s - 40) < 6 || Math.hypot(p.x - HOLE[0], p.z - HOLE[1]) < HOLE[2] + 3) continue;
          if (p.s > JS0 - 2 && p.s < JS1 + 30) continue; // not inside the crater
          stakes.push({ x: p.x, y: gy(p.x, p.z) - 0.2, z: p.z, ry: -p.angle + r.range(-0.4, 0.4) + (side > 0 ? PI : 0), rx: r.range(-0.08, 0.08), rz: r.range(-0.08, 0.08) });
        }
      }
      chunked(stakeGeo, stakeMat, stakes, { cast: true }, 160);
    }

    // ---------------------------------------------------------------- shared materials
    const ENV = K.group.parent ? K.group.parent.environment : null;
    const shiny = (m, k) => { if (ENV) { m.envMap = ENV; m.envMapIntensity = k; } return m; };
    const white = K.plastic(0xeeeae2, 0.45);
    const offWhite = K.plastic(0xd9d2c4, 0.55);
    const alu = shiny(K.metal(0xc6cad0, 0.3), 0.9);
    const darkMetal = K.metal(0x3c3c40, 0.45);
    const blackMat = K.std({ color: 0x18181a, roughness: 0.55 });
    const foil = (() => {
      const c = TX.makeCanvas(256), g = c.getContext('2d'), rr = K.rng(5);
      g.fillStyle = '#c99a3a'; g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 520; i++) {
        const x = rr() * 256, y = rr() * 256, s = 6 + rr() * 22, a = rr() * TAU;
        const v = 150 + rr() * 105;
        g.fillStyle = `rgb(${v | 0},${(v * 0.76) | 0},${(v * 0.3) | 0})`;
        g.beginPath();
        for (let k = 0; k < 5; k++) { const aa = a + k * 1.26 + rr() * 0.5, rd = s * (0.5 + rr() * 0.6); g.lineTo(x + Math.cos(aa) * rd, y + Math.sin(aa) * rd); }
        g.closePath(); g.fill();
      }
      const cr1 = TX.noiseField(256, { seed: 71, period: 8, oct: 3 }), cr2 = TX.noiseField(256, { seed: 72, period: 16, oct: 2 });
      const fh = new Float32Array(256 * 256);
      for (let i = 0; i < fh.length; i++) fh[i] = Math.abs(cr1[i] - 0.5) * 1.4 + Math.abs(cr2[i] - 0.5) * 0.8; // creased foil
      return { map: TX.toTexture(c), normal: TX.toTexture(TX.normalFromHeight(fh, 256, 256, 3), { srgb: false }) };
    })();
    const goldFoil = shiny(K.std({ map: foil.map, normalMap: foil.normal, normalScale: V2(0.8), metalness: 1, roughness: 0.3, color: 0xffe2a8 }), 1.3);
    const cellTex = (() => {
      const c = TX.makeCanvas(256), g = c.getContext('2d');
      g.fillStyle = '#c8ccd2'; g.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const gr = g.createLinearGradient(x * 32, y * 32, x * 32 + 32, y * 32 + 32);
        gr.addColorStop(0, '#1d2c5a'); gr.addColorStop(0.5, '#2a3f7a'); gr.addColorStop(1, '#16224a');
        g.fillStyle = gr; g.fillRect(x * 32 + 1.5, y * 32 + 1.5, 29, 29);
        g.strokeStyle = 'rgba(190,200,220,0.35)'; g.lineWidth = 0.8;
        for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(x * 32 + 1.5, y * 32 + k * 8); g.lineTo(x * 32 + 30, y * 32 + k * 8); g.stroke(); }
      }
      return TX.toTexture(c);
    })();
    const cellsMat = shiny(K.std({ map: cellTex, metalness: 0.5, roughness: 0.2 }), 1.1);
    const dustyCells = shiny(K.std({ map: cellTex, metalness: 0.35, roughness: 0.45, color: 0xd9a888 }), 0.7);
    const rockNormal = TX.mottledTextures({ size: 256, a: 0x808080, b: 0x707070, seed: 31, period: 12, bump: 5, speck: 0.4, pebbles: 120, pebbleColor: 0x505050 }).normalMap;
    const rockMat = K.std({ vertexColors: true, roughness: 0.88, normalMap: rockNormal, normalScale: V2(1.1) });

    // ---------------------------------------------------------------- the jump: rover road climbs the rim of crater B
    {
      const sm = (JS0 + JS1) / 2, p = track.at(sm);
      K.ramp(p.x, p.z, p.angle, JS1 - JS0, 16, JH, 0);
      // rim colliders (low ridge) all round crater B except where the road crosses
      const c = CR[1];
      const ring = [];
      for (let k = 0; k <= 48; k++) { const a = (k / 48) * TAU; ring.push([c.x + Math.cos(a) * c.R, c.z + Math.sin(a) * c.R]); }
      for (let k = 0; k < 48; k++) {
        const [x1, z1] = ring[k], [x2, z2] = ring[k + 1];
        if (roadD(x1, z1) < 4 || roadD(x2, z2) < 4) continue;
        K.capsule(x1, z1, x2, z2, 1.3, 2.2);
      }
      // a few chunky blocks on the crest either side of the ramp lip
      for (const side of [-1, 1]) {
        for (let k = 0; k < 3; k++) {
          const q = track.place(JS1 - 1 + k * 1.2, side * (8.6 + k * 1.3));
          const s = r.range(0.7, 1.2);
          const m = K.mesh(rockGeo(1, 0.22, 3 + k + side, 0.8, 1), rockMat, q.x, gy(q.x, q.z) + s * 0.3, q.z, { ry: r() * 6, scale: s });
          AO(q.x, q.z, s * 1.3, s * 1.3, 0.35);
        }
      }
    }

    // ---------------------------------------------------------------- crater A: frost in the shadow of the west rim (slick)
    {
      const c = CR[0];
      for (let k = 0; k < 56; k++) {
        const a1 = (k / 56) * TAU, a2 = ((k + 1) / 56) * TAU;
        const x1 = c.x + Math.cos(a1) * c.R, z1 = c.z + Math.sin(a1) * c.R, x2 = c.x + Math.cos(a2) * c.R, z2 = c.z + Math.sin(a2) * c.R;
        if (roadD(x1, z1) < 3 || roadD(x2, z2) < 3) continue;
        K.capsule(x1, z1, x2, z2, 1.2, 2.0);
      }
      // frost patch: feathery rime on the road, mostly on the shaded (west) side
      const q = track.place(505, 2.2);
      const poly = K.blobOutline(r, q.x, q.z, 6.2, 0.38, 44, 1.75, q.angle);
      K.surface('slick', { poly });
      let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
      for (const [x, z] of poly) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }
      x0 -= 2; z0 -= 2; x1 += 2; z1 += 2;
      const S = 512, fc = TX.makeCanvas(S), g = fc.getContext('2d'), rr = K.rng(8);
      const P = (x, z) => [(x - x0) / (x1 - x0) * S, (z - z0) / (z1 - z0) * S];
      g.filter = 'blur(10px)';
      g.fillStyle = 'rgba(205,225,252,0.2)';
      g.beginPath(); poly.forEach(([x, z], i) => { const [X, Y] = P(x, z); if (i) g.lineTo(X, Y); else g.moveTo(X, Y); }); g.closePath(); g.fill();
      g.filter = 'blur(4px)';
      for (let i = 0; i < 90; i++) { // patchy rime
        const [px2, pz2] = poly[(rr() * poly.length) | 0], t = Math.sqrt(rr()) * 0.95;
        const [X, Y] = P(q.x + (px2 - q.x) * t, q.z + (pz2 - q.z) * t);
        g.fillStyle = `rgba(226,238,255,${0.08 + rr() * 0.18})`;
        g.beginPath(); g.ellipse(X, Y, 6 + rr() * 26, 4 + rr() * 14, rr() * 3, 0, TAU); g.fill();
      }
      g.filter = 'none';
      // frost crystals: little branching dendrites
      g.lineCap = 'round';
      for (let i = 0; i < 520; i++) {
        const [px2, pz2] = poly[(rr() * poly.length) | 0];
        const t = Math.sqrt(rr()) * 1.05;
        const [X, Y] = P(q.x + (px2 - q.x) * t, q.z + (pz2 - q.z) * t);
        const len = 3 + rr() * 9, a = rr() * TAU;
        g.strokeStyle = `rgba(250,253,255,${0.25 + rr() * 0.5})`; g.lineWidth = 0.6 + rr() * 0.9;
        g.beginPath(); g.moveTo(X, Y); g.lineTo(X + Math.cos(a) * len, Y + Math.sin(a) * len); g.stroke();
        for (let b = 1; b < 3; b++) {
          const bx = X + Math.cos(a) * len * b / 3, by = Y + Math.sin(a) * len * b / 3;
          for (const sgn of [-1, 1]) { g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + Math.cos(a + sgn * 0.8) * len * 0.3, by + Math.sin(a + sgn * 0.8) * len * 0.3); g.stroke(); }
        }
      }
      for (let i = 0; i < 420; i++) { g.fillStyle = `rgba(255,255,255,${0.5 + rr() * 0.5})`; const [X, Y] = P(q.x + rr.range(-9, 9), q.z + rr.range(-9, 9)); g.fillRect(X, Y, 1.2 + rr(), 1.2 + rr()); }
      // keep the crystals inside the patch
      g.globalCompositeOperation = 'destination-in';
      g.filter = 'blur(6px)'; g.fillStyle = '#fff';
      g.beginPath(); poly.forEach(([x, z], i) => { const [X, Y] = P(x * 1.0 + (x - q.x) * 0.1, z + (z - q.z) * 0.1); if (i) g.lineTo(X, Y); else g.moveTo(X, Y); }); g.closePath(); g.fill();
      g.filter = 'none'; g.globalCompositeOperation = 'source-over';
      const ft = TX.toTexture(fc, { wrap: false });
      const fn = TX.mottledTextures({ size: 128, a: 0x808080, b: 0x909090, seed: 12, period: 32, bump: 6, speck: 0.6 }).normalMap;
      const frostMat = K.phys({ map: ft, transparent: true, depthWrite: false, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15, normalMap: fn, normalScale: V2(0.6), sheen: 0.6, sheenColor: new T.Color(0xcfe6ff), polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
      const NXf = 28, NZf = 28, pos = [], uv = [], idx = [];
      for (let j = 0; j <= NZf; j++) for (let i = 0; i <= NXf; i++) {
        const x = x0 + (x1 - x0) * i / NXf, z = z0 + (z1 - z0) * j / NZf;
        pos.push(x, gy(x, z) + 0.08, z); uv.push(i / NXf, 1 - j / NZf);
      }
      for (let j = 0; j < NZf; j++) for (let i = 0; i < NXf; i++) { const a = j * (NXf + 1) + i; idx.push(a, a + NXf + 1, a + 1, a + 1, a + NXf + 1, a + NXf + 2); }
      const fg = new T.BufferGeometry();
      fg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); fg.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); fg.setIndex(idx); fg.computeVertexNormals();
      const fm = new T.Mesh(fg, frostMat); fm.receiveShadow = true; fm.renderOrder = 2;
      keep.push(fm); K.group.add(fm);
      // a few frosted pebbles in the shade
      for (let i = 0; i < 7; i++) {
        const x = q.x + r.range(-9, -3), z = q.z + r.range(-7, 7);
        if (!K.offRoad(x, z, 0.5)) continue;
        const s = r.range(0.5, 1.1);
        K.mesh(rockGeo(1, 0.25, 40 + i, 0.75, 3), rockMat, x, gy(x, z) + s * 0.25, z, { ry: r() * 6, scale: s });
      }
    }

    // ---------------------------------------------------------------- dune drift across the west straight (slow)
    {
      const q = track.place(824, 0.5);
      const poly = K.blobOutline(r, q.x, q.z, 8.5, 0.32, 48, 1.55, q.angle + 0.55);
      K.surface('slow', { poly });
      const n = poly.length, rings = 7, pos = [], uv = [], idx = [];
      pos.push(q.x, 0.62, q.z); uv.push((q.x - TX0) / (TX1 - TX0), 1 - (q.z - TZ0) / (TZ1 - TZ0));
      for (let k = 1; k <= rings; k++) {
        const t = k / rings;
        for (let i = 0; i < n; i++) {
          const [px2, pz2] = poly[i];
          const x = q.x + (px2 - q.x) * t, z = q.z + (pz2 - q.z) * t;
          // asymmetric dune: steeper on the east (lee) side
          const lee = Math.max(0, (x - q.x) / 8);
          const y = Math.max(gy(x, z) + 0.02, 0.62 * (1 - t * t) ** (1.6 + lee) + (gy(x, z) + 0.02) * t * t);
          pos.push(x, y, z); uv.push((x - TX0) / (TX1 - TX0), 1 - (z - TZ0) / (TZ1 - TZ0));
        }
      }
      for (let i = 0; i < n; i++) idx.push(0, 1 + ((i + 1) % n), 1 + i);
      for (let k = 1; k < rings; k++) for (let i = 0; i < n; i++) {
        const a = 1 + (k - 1) * n + i, b = 1 + (k - 1) * n + ((i + 1) % n), c = a + n, d = b + n;
        idx.push(a, b, c, b, d, c);
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals();
      const nr = g.attributes.normal; for (let i = 0; i < nr.count; i++) if (nr.getY(i) < 0) nr.setXYZ(i, -nr.getX(i), -nr.getY(i), -nr.getZ(i));
      const col = new Float32Array((pos.length / 3) * 4);
      for (let i = 0; i < pos.length / 3; i++) {
        const k = i === 0 ? 0 : Math.ceil(i / n) / rings; // ring parameter 0 (centre) .. 1 (edge)
        const a = 1 - ss(0.55, 1, k);
        col.set([1.3 + 0.1 * (1 - k), 1.24 + 0.1 * (1 - k), 1.12 + 0.06 * (1 - k), a], i * 4);
      }
      g.setAttribute('color', new T.BufferAttribute(col, 4));
      const driftMat = sandMat.clone();
      driftMat.transparent = true; driftMat.depthWrite = false; driftMat.onBeforeCompile = detailShader;
      driftMat.polygonOffset = true; driftMat.polygonOffsetFactor = -3; driftMat.polygonOffsetUnits = -3;
      const dm = new T.Mesh(g, driftMat); dm.receiveShadow = true; dm.castShadow = false; dm.renderOrder = 2;
      keep.push(dm); K.group.add(dm);
    }

    // ---------------------------------------------------------------- lava-tube skylight (hole)
    {
      const [hx, hz, hr] = HOLE;
      K.hole(hx, hz, hr);
      // layered basalt shaft
      const c = TX.paint(256, 256, (x, y, u, v, o) => {
        const band = Math.sin(v * 38 + Math.sin(u * 25) * 0.6) * 0.5 + 0.5, n = bil(NF, u * 256, v * 64);
        const k = (0.55 + band * 0.25 + (n - 0.5) * 0.5) * (1 - v * 0.85);
        o[0] = 120 * k; o[1] = 70 * k; o[2] = 52 * k;
      });
      const shaftMat = K.std({ map: TX.toTexture(c), roughness: 0.9, side: T.BackSide, normalMap: rockNormal, normalScale: V2(1.2) });
      const prof = [[hr - 0.4, -0.7], [hr - 0.75, -2.4], [hr - 0.2, -5], [hr + 0.8, -10], [hr + 1.6, -18], [hr + 2.0, -30]];
      const shaft = K.mesh(K.lathe(prof.map(([a, b]) => [a, b]), 40), shaftMat, hx, 0, hz, { cast: false });
      const bottom = K.mesh(new T.CircleGeometry(hr + 2.7, 32), K.std({ color: 0x050302, roughness: 1 }), hx, -29.5, hz, { rx: -PI / 2, cast: false });
      // inner darkness gradient (cheap fake AO down the shaft)
      const dc = TX.makeCanvas(128), dg = dc.getContext('2d');
      const gr = dg.createRadialGradient(64, 64, 10, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.85)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      dg.fillStyle = gr; dg.fillRect(0, 0, 128, 128);
      const dark = K.mesh(new T.CircleGeometry(hr * 1.3, 32), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, alphaMap: TX.toTexture(dc, { wrap: false }), depthWrite: false }), hx, -6, hz, { rx: -PI / 2, cast: false });
      dark.renderOrder = 2;
      // the collapse lip: sand rolling over the edge into the shaft (hides the cut in the terrain grid)
      {
        const rings = [[hr - 0.45, -0.75, 0.3], [hr - 0.15, -0.25, 0.45], [hr + 0.3, 0.12, 0.7], [hr + 1.0, 0.16, 0.9], [hr + 2.0, 0.1, 1], [hr + 3.2, 0.0, 1]];
        const seg = 56, pos = [], uv = [], col = [], idx = [];
        rings.forEach(([rad, dy, k], j) => {
          for (let i = 0; i <= seg; i++) {
            const a = (i / seg) * TAU, wob = 1 + 0.05 * Math.sin(a * 5 + 1) + 0.03 * Math.sin(a * 9);
            const x = hx + Math.cos(a) * rad * wob, z = hz + Math.sin(a) * rad * wob;
            const ref = j < 3 ? gy(hx + Math.cos(a) * (hr + 0.3) * wob, hz + Math.sin(a) * (hr + 0.3) * wob) : gy(x, z);
            pos.push(x, ref + dy - (j === rings.length - 1 ? 0.02 : 0), z);
            uv.push((x - TX0) / (TX1 - TX0), 1 - (z - TZ0) / (TZ1 - TZ0));
            col.push(k, k * 0.97, k * 0.95);
          }
        });
        for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < seg; i++) { const a = j * (seg + 1) + i, b = a + seg + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
        const lg = new T.BufferGeometry();
        lg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); lg.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); lg.setAttribute('color', new T.Float32BufferAttribute(col, 3));
        lg.setIndex(idx); lg.computeVertexNormals();
        const lip = new T.Mesh(lg, sandMat); lip.receiveShadow = true; lip.castShadow = false;
        keep.push(lip); K.group.add(lip);
      }
      // collapse rubble around the rim
      const rub = [];
      for (let i = 0; i < 46; i++) {
        const a = r() * TAU, d = hr + r.range(0.2, 3.2), x = hx + Math.cos(a) * d, z = hz + Math.sin(a) * d;
        if (roadD(x, z) < 0.3) continue;
        const s = r.range(0.25, 0.9) * (d < hr + 1.2 ? 1.2 : 0.8);
        rub.push({ x, y: gy(x, z) + s * 0.25, z, ry: r() * TAU, rx: r.range(-0.4, 0.4), s, sx: s * r.range(0.9, 1.4) });
      }
      chunked(rockGeo(1, 0.25, 77, 0.7, 3), rockMat, rub, { cast: true }, 160);
      for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU; AO(hx + Math.cos(a) * (hr + 0.6), hz + Math.sin(a) * (hr + 0.6), 1.8, 1.8, 0.45); }
      // warning cairn of stacked stones beside it (off the road)
      const cx = hx - 5.5, cz = hz - 5.5;
      [[1.0, 0.45], [0.8, 1.2], [0.6, 1.85], [0.42, 2.35]].forEach(([s, y], k) => K.mesh(rockGeo(1, 0.15, 90 + k, 0.55, 4), rockMat, cx + r.range(-0.1, 0.1), gy(cx, cz) + y, cz, { ry: r() * 6, scale: s }));
      AO(cx, cz, 1.5, 1.5, 0.4);
      K.circle(cx, cz, 1.1, 2.5);
    }

    // ---------------------------------------------------------------- the lander (generic design) + flag
    {
      const cx = 68, cz = 2, ry = 0.35;
      const grp = new T.Group();
      const y0 = 3.5;
      const body = new T.Mesh(new T.CylinderGeometry(3.5, 3.5, 1.9, 8), goldFoil); body.position.y = y0 + 0.95; grp.add(body);
      const deck = new T.Mesh(new T.CylinderGeometry(3.7, 3.7, 0.28, 8), white); deck.position.y = y0 + 2.0; grp.add(deck);
      const skirt = new T.Mesh(new T.CylinderGeometry(3.5, 2.5, 1.2, 8), goldFoil); skirt.position.y = y0 - 0.6; grp.add(skirt);
      const belly = new T.Mesh(new T.CylinderGeometry(2.5, 2.5, 0.2, 8), darkMetal); belly.position.y = y0 - 1.25; grp.add(belly);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU + 0.5;
        const nz = new T.Mesh(K.lathe([[0.22, 0], [0.3, -0.25], [0.55, -0.9], [0.6, -1.0]], 14), darkMetal);
        nz.position.set(Math.cos(a) * 1.3, y0 - 1.3, Math.sin(a) * 1.3); grp.add(nz);
      }
      for (let i = 0; i < 4; i++) {
        const a = ((i + 0.5) / 4) * TAU, ca = Math.cos(a), sa = Math.sin(a);
        const foot = P3(ca * 6.0, 0.45, sa * 6.0);
        rod(P3(ca * 3.3, y0 + 0.7, sa * 3.3), foot, 0.17, alu, grp);
        rod(P3(Math.cos(a - 0.38) * 2.6, y0 - 0.9, Math.sin(a - 0.38) * 2.6), foot, 0.11, alu, grp);
        rod(P3(Math.cos(a + 0.38) * 2.6, y0 - 0.9, Math.sin(a + 0.38) * 2.6), foot, 0.11, alu, grp);
        const pad = new T.Mesh(new T.CylinderGeometry(0.75, 0.95, 0.35, 16), alu); pad.position.copy(foot).setY(0.17); grp.add(pad);
        const shock = new T.Mesh(new T.CylinderGeometry(0.26, 0.26, 1.0, 10), goldFoil); shock.position.set(ca * 4.6, 2.0, sa * 4.6); shock.rotation.z = -ca * 0.5; shock.rotation.x = sa * 0.5; grp.add(shock);
      }
      // round solar fans
      const fanTop = shiny(K.std({ map: (() => {
        const c = TX.makeCanvas(256), g = c.getContext('2d');
        g.fillStyle = '#d6d8dc'; g.fillRect(0, 0, 256, 256);
        for (let k = 0; k < 10; k++) {
          const a0 = (k / 10) * TAU + 0.03, a1 = ((k + 1) / 10) * TAU - 0.03;
          for (let ring = 0; ring < 5; ring++) {
            const r0 = 18 + ring * 21, r1 = r0 + 19;
            const gr = g.createLinearGradient(128, 128 - r1, 128, 128 + r1); gr.addColorStop(0, '#2c3f7c'); gr.addColorStop(1, '#17234c');
            g.fillStyle = gr; g.beginPath(); g.arc(128, 128, r1, a0, a1); g.arc(128, 128, r0, a1, a0, true); g.closePath(); g.fill();
          }
        }
        return TX.toTexture(c, { wrap: false });
      })(), metalness: 0.5, roughness: 0.22 }), 1.1);
      for (const s of [-1, 1]) {
        const fan = new T.Mesh(new T.CylinderGeometry(4.1, 4.1, 0.16, 10), white);
        fan.position.set(s * 8.0, y0 + 2.1, 0); fan.rotation.z = s * 0.05;
        grp.add(fan);
        const ft = new T.Mesh(new T.CircleGeometry(4.05, 10), fanTop); ft.rotation.x = -PI / 2; ft.position.y = 0.085; fan.add(ft);
        rod(P3(s * 3.6, y0 + 2.0, 0), P3(s * 4.2, y0 + 2.1, 0), 0.2, alu, grp);
      }
      // deck instruments
      const dome = new T.Mesh(new T.SphereGeometry(1.15, 24, 12, 0, TAU, 0, PI / 2), shiny(K.metal(0xd8b070, 0.25), 1.2)); dome.position.set(-1.4, y0 + 2.14, 1.0); grp.add(dome);
      const box1 = new T.Mesh(new K.RoundedBoxGeometry(1.6, 0.9, 1.1, 2, 0.12), white); box1.position.set(1.3, y0 + 2.6, -1.2); grp.add(box1);
      const mast = rod(P3(0.6, y0 + 2.1, 1.8), P3(0.6, y0 + 5.4, 1.8), 0.13, white, grp);
      const head = new T.Mesh(new K.RoundedBoxGeometry(0.9, 0.55, 1.4, 2, 0.1), white); head.position.set(0.65, y0 + 5.65, 1.8); grp.add(head);
      for (const dz of [-0.35, 0.35]) { const lens = new T.Mesh(new T.CylinderGeometry(0.14, 0.14, 0.2, 12), blackMat); lens.rotation.z = PI / 2; lens.position.set(1.15, y0 + 5.68, 1.8 + dz); grp.add(lens); }
      const dish = new T.Mesh(K.lathe([[0.02, 0], [0.5, 0.06], [0.95, 0.22], [1.1, 0.32]], 24), shiny(K.metal(0xdedad2, 0.25, { side: T.DoubleSide }), 0.9));
      dish.position.set(-1.8, y0 + 3.4, -1.2); dish.rotation.set(0.6, 0, -0.7); grp.add(dish);
      rod(P3(-1.6, y0 + 2.1, -1.0), P3(-1.75, y0 + 3.3, -1.15), 0.08, alu, grp);
      // folded robotic arm with scoop
      rod(P3(2.6, y0 + 2.2, 0.9), P3(4.6, y0 + 3.0, 1.4), 0.14, white, grp);
      rod(P3(4.6, y0 + 3.0, 1.4), P3(3.0, y0 + 3.3, 2.4), 0.12, white, grp);
      const scoop = new T.Mesh(new K.RoundedBoxGeometry(0.6, 0.35, 0.45, 2, 0.08), alu); scoop.position.set(2.9, y0 + 3.2, 2.5); grp.add(scoop);
      // weather boom
      rod(P3(-2.6, y0 + 2.1, -0.4), P3(-2.9, y0 + 4.6, -0.6), 0.06, alu, grp);
      rod(P3(-2.9, y0 + 4.6, -0.6), P3(-2.2, y0 + 4.6, -0.6), 0.05, alu, grp);
      grp.position.set(cx, gy(cx, cz), cz); grp.rotation.y = ry;
      K.add(grp);
      AO(cx, cz, 7, 7, 0.4);
      for (let i = 0; i < 4; i++) { const a = ((i + 0.5) / 4) * TAU - ry; AO(cx + Math.cos(a) * 6, cz + Math.sin(a) * 6, 1.4, 1.4, 0.55); }
      K.circle(cx, cz, 6.6, 9);
      // flag on a slim pole
      const fx = 58, fz = 14;
      const fc = TX.makeCanvas(256, 160), g = fc.getContext('2d');
      g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, 256, 160);
      g.fillStyle = '#b5532c'; g.beginPath(); g.arc(128, 80, 42, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,220,180,0.35)'; g.beginPath(); g.arc(116, 68, 22, 0, TAU); g.fill();
      g.strokeStyle = '#26407e'; g.lineWidth = 7; g.beginPath(); g.ellipse(128, 80, 86, 26, -0.35, 0, TAU); g.stroke();
      g.fillStyle = '#26407e'; for (const [sx2, sy2] of [[40, 30], [214, 128], [222, 36]]) { g.beginPath(); for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU - PI / 2, rd = k % 2 ? 4 : 10; g.lineTo(sx2 + Math.cos(a) * rd, sy2 + Math.sin(a) * rd); } g.fill(); }
      const fgeo = new T.PlaneGeometry(3.2, 2.0, 10, 2);
      const fp = fgeo.attributes.position; for (let i = 0; i < fp.count; i++) { const x = fp.getX(i); fp.setZ(i, Math.sin((x + 1.6) * 2.2) * 0.18 * (x + 1.6) / 3.2); }
      fgeo.computeVertexNormals();
      const flag = K.mesh(fgeo, K.std({ map: TX.toTexture(fc, { wrap: false }), roughness: 0.75, side: T.DoubleSide }), fx + 1.65, gy(fx, fz) + 6.0, fz, { ry: 0.3 });
      flag.position.x = fx + Math.cos(0.3) * 1.65; flag.position.z = fz - Math.sin(0.3) * 1.65;
      K.mesh(new T.CylinderGeometry(0.08, 0.1, 7.2, 8), alu, fx, gy(fx, fz) + 3.6, fz);
      K.mesh(new T.SphereGeometry(0.18, 12, 8), shiny(K.metal(0xd9b25a, 0.2), 1.2), fx, gy(fx, fz) + 7.25, fz);
      AO(fx, fz, 0.5, 0.5, 0.5);
      K.circle(fx, fz, 0.5, 7);
    }

    // ---------------------------------------------------------------- parachute + backshell lying on the sand
    {
      const cx = 104, cz = 24, Rp = 9;
      const geo = new T.RingGeometry(0.7, Rp, 96, 10);
      geo.rotateX(-PI / 2);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i), d = Math.hypot(x, z), a = Math.atan2(z, x), q = d / Rp;
        const ridge = Math.abs(Math.sin(a * 8)) * 0.22 * q;
        const fold = 1.3 * Math.exp(-(((a - 0.9) / 0.35) ** 2)) * q * q + 0.7 * Math.exp(-(((a + 2.2) / 0.25) ** 2)) * q;
        const wx = cx + x, wz = cz + z;
        p.setY(i, gy(wx, wz) + 0.12 + ridge + fold + (1 - q) * 0.2);
      }
      geo.computeVertexNormals();
      const c = TX.makeCanvas(512), g = c.getContext('2d');
      for (let k = 0; k < 16; k++) {
        const a0 = (k / 16) * TAU, a1 = ((k + 1) / 16) * TAU;
        for (let ring = 0; ring < 4; ring++) {
          const r0 = [16, 120, 150, 228][ring], r1 = [120, 150, 228, 256][ring];
          const orange = ring === 1 ? false : ring === 3 ? k % 2 === 1 : (k + ring) % 2 === 0;
          g.fillStyle = orange ? '#e8692a' : '#f3efe6';
          g.beginPath(); g.arc(256, 256, r1, a0, a1); g.arc(256, 256, r0, a1, a0, true); g.closePath(); g.fill();
        }
        g.strokeStyle = 'rgba(120,90,70,0.6)'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(256, 256); g.lineTo(256 + Math.cos(a0) * 256, 256 + Math.sin(a0) * 256); g.stroke();
      }
      g.fillStyle = 'rgba(190,110,70,0.25)'; g.beginPath(); g.arc(256, 256, 256, 0, TAU); g.fill(); // a coat of dust
      const ct = TX.toTexture(c, { wrap: false });
      const canopy = K.mesh(geo, K.std({ map: ct, roughness: 0.85, side: T.DoubleSide }), cx, 0, cz, { ry: 0.4 });
      AO(cx, cz, Rp * 0.9, Rp * 0.9, 0.18);
      // backshell: cone lying on its side, half dug in, scorched rim
      const bx = cx - 15, bz = cz + 9;
      const bs = K.lathe([[3.0, 0], [3.05, 0.25], [2.2, 1.4], [1.3, 2.5], [1.1, 2.7], [0.02, 2.75]], 32);
      const bcol = new Float32Array(bs.attributes.position.count * 3);
      for (let i = 0; i < bs.attributes.position.count; i++) { const y = bs.attributes.position.getY(i), k = y < 0.4 ? 0.35 : 1; bcol.set([k, k * 0.97, k * 0.94], i * 3); }
      bs.setAttribute('color', new T.BufferAttribute(bcol, 3));
      const shell = K.mesh(bs, K.plastic(0xe6e0d4, 0.6, { vertexColors: true, side: T.DoubleSide }), bx, gy(bx, bz) + 1.6, bz, { rz: PI / 2 - 0.25, ry: 0.5 });
      AO(bx, bz, 3.6, 3.0, 0.45, 0.5);
      K.circle(bx, bz, 2.6, 3.5);
      // suspension lines from the canopy edge to the backshell
      const ax = bx + 2.2, az = bz - 1.0;
      const lp = [];
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * TAU + 0.4;
        const ex = cx + Math.cos(a) * Rp * 0.98, ez = cz + Math.sin(a) * Rp * 0.98;
        let px2 = ex, pz2 = ez, py = gy(ex, ez) + 0.25;
        for (let t = 1; t <= 10; t++) {
          const f = t / 10, sag = Math.sin(f * PI) * (k % 2 ? 1.2 : -1.2);
          const nx2 = lerp(ex, ax, f) + sag * 0.3, nz2 = lerp(ez, az, f) + sag * 0.2, ny = gy(nx2, nz2) + 0.12 + (t === 10 ? 0.9 : 0);
          lp.push(px2, py, pz2, nx2, ny, nz2);
          px2 = nx2; pz2 = nz2; py = ny;
        }
      }
      const lg = new T.BufferGeometry(); lg.setAttribute('position', new T.Float32BufferAttribute(lp, 3));
      const lines = new T.LineSegments(lg, new T.LineBasicMaterial({ color: 0xd8cfc0, transparent: true, opacity: 0.85 }));
      K.group.add(lines);
    }

    // ---------------------------------------------------------------- an older six-wheeled rover model, parked
    {
      const [ex, ez, ea] = A.oldTrackEnd;
      const cx = ex, cz = ez, ang = ea;
      const grp = new T.Group();
      const wheelMat = shiny(K.metal(0xb8bcc2, 0.4), 0.8);
      for (const wx of [2.3, 0.1, -2.1]) for (const wz of [-1.9, 1.9]) {
        const w = new T.Mesh(new T.CylinderGeometry(0.75, 0.75, 0.62, 18), wheelMat); w.rotation.x = PI / 2; w.position.set(wx, 0.75, wz); grp.add(w);
        const hub = new T.Mesh(new T.CylinderGeometry(0.3, 0.3, 0.66, 12), darkMetal); hub.rotation.x = PI / 2; hub.position.set(wx, 0.75, wz); grp.add(hub);
      }
      for (const s of [-1, 1]) {
        rod(P3(2.3, 0.75, s * 1.55), P3(0.9, 1.9, s * 1.55), 0.1, white, grp);
        rod(P3(0.9, 1.9, s * 1.55), P3(-0.8, 1.3, s * 1.55), 0.1, white, grp);
        rod(P3(-0.8, 1.3, s * 1.55), P3(0.1, 0.75, s * 1.55), 0.09, white, grp);
        rod(P3(-0.8, 1.3, s * 1.55), P3(-2.1, 0.75, s * 1.55), 0.09, white, grp);
      }
      const box = new T.Mesh(new K.RoundedBoxGeometry(3.6, 1.1, 2.4, 2, 0.12), goldFoil); box.position.set(0, 1.9, 0); grp.add(box);
      const top = new T.Mesh(new T.BoxGeometry(4.0, 0.12, 2.8), white); top.position.set(0, 2.5, 0); grp.add(top);
      // three solar panels (centre + two wings), dusty
      const panel = (w, d, x, z, rz, rx) => {
        const pm = new T.Mesh(new T.BoxGeometry(w, 0.1, d), offWhite);
        pm.position.set(x, 2.62, z); pm.rotation.set(rx, 0, rz); grp.add(pm);
        const pt = new T.Mesh(new T.PlaneGeometry(w - 0.1, d - 0.1), dustyCells); pt.rotation.x = -PI / 2; pt.position.y = 0.055; pm.add(pt);
      };
      panel(4.4, 2.8, -0.1, 0, 0, 0); panel(3.6, 1.8, -0.3, 2.3, 0, 0.1); panel(3.6, 1.8, -0.3, -2.3, 0, -0.1); panel(1.6, 3.2, -3.1, 0, -0.08, 0);
      rod(P3(1.5, 2.6, 0.8), P3(1.5, 4.7, 0.8), 0.1, white, grp);
      const head = new T.Mesh(new K.RoundedBoxGeometry(0.7, 0.45, 1.1, 2, 0.08), white); head.position.set(1.55, 4.9, 0.8); grp.add(head);
      for (const dz of [-0.28, 0.28]) { const lens = new T.Mesh(new T.CylinderGeometry(0.1, 0.1, 0.15, 10), blackMat); lens.rotation.z = PI / 2; lens.position.set(1.93, 4.92, 0.8 + dz); grp.add(lens); }
      const dish = new T.Mesh(K.lathe([[0.02, 0], [0.4, 0.05], [0.75, 0.18], [0.85, 0.25]], 20), shiny(K.metal(0xd8d4cc, 0.3, { side: T.DoubleSide }), 0.8));
      dish.position.set(-0.6, 3.3, -0.9); dish.rotation.set(-0.5, 0, 0.6); grp.add(dish);
      rod(P3(-0.6, 2.6, -0.9), P3(-0.6, 3.25, -0.9), 0.07, alu, grp);
      rod(P3(-1.3, 2.6, 1.0), P3(-1.3, 4.0, 1.0), 0.035, blackMat, grp);
      grp.position.set(cx, gy(cx, cz), cz); grp.rotation.y = -ang;
      K.add(grp);
      AO(cx, cz, 4.2, 3.0, 0.5, ang);
      K.box(cx, cz, 3.2, 2.6, ang, 5);
    }

    // ---------------------------------------------------------------- coaxial helicopter drone on its little airfield
    {
      const cx = -34, cz = -34;
      // airfield: a smoothed patch with a painted ring
      const pc = TX.makeCanvas(256), pg = pc.getContext('2d');
      const gr = pg.createRadialGradient(128, 128, 30, 128, 128, 128); gr.addColorStop(0, 'rgba(220,160,110,0.55)'); gr.addColorStop(1, 'rgba(220,160,110,0)');
      pg.fillStyle = gr; pg.fillRect(0, 0, 256, 256);
      pg.strokeStyle = 'rgba(245,240,230,0.85)'; pg.lineWidth = 7; pg.beginPath(); pg.arc(128, 128, 76, 0, TAU); pg.stroke();
      pg.fillStyle = 'rgba(245,240,230,0.85)'; for (let k = 0; k < 4; k++) { pg.save(); pg.translate(128, 128); pg.rotate(k * PI / 2); pg.fillRect(-4, -100, 8, 18); pg.restore(); }
      const pad = K.mesh(new T.PlaneGeometry(11, 11), K.std({ map: TX.toTexture(pc, { wrap: false }), transparent: true, depthWrite: false, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2 }), cx, gy(cx, cz) + 0.07, cz, { rx: -PI / 2, cast: false });
      pad.renderOrder = 1;
      const grp = new T.Group();
      const body = new T.Mesh(new K.RoundedBoxGeometry(1.3, 1.0, 1.3, 2, 0.12), goldFoil); body.position.y = 1.55; grp.add(body);
      const bodyTop = new T.Mesh(new T.BoxGeometry(1.36, 0.12, 1.36), white); bodyTop.position.y = 2.08; grp.add(bodyTop);
      for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        rod(P3(sx * 0.5, 1.3, sz * 0.5), P3(sx * 1.5, 0.05, sz * 1.5), 0.06, white, grp);
        const ft = new T.Mesh(new T.SphereGeometry(0.16, 10, 6), white); ft.position.set(sx * 1.5, 0.1, sz * 1.5); grp.add(ft);
      }
      rod(P3(0, 2.1, 0), P3(0, 4.0, 0), 0.07, alu, grp);
      const bladeMat = K.std({ color: 0x2a2a2e, roughness: 0.35 });
      for (const [yy, a] of [[2.75, 0.3], [3.25, 1.1]]) {
        for (const off of [0, PI]) {
          const bl = new T.Mesh(new T.BoxGeometry(2.9, 0.05, 0.36), bladeMat);
          bl.position.set(Math.cos(a + off) * 1.45, yy, Math.sin(a + off) * 1.45); bl.rotation.set(0.08, -(a + off), 0); grp.add(bl);
        }
        const hub = new T.Mesh(new T.CylinderGeometry(0.17, 0.17, 0.18, 10), darkMetal); hub.position.y = yy; grp.add(hub);
      }
      const sp = new T.Mesh(new T.BoxGeometry(1.5, 0.06, 1.0), alu); sp.position.y = 4.05; grp.add(sp);
      const spt = new T.Mesh(new T.PlaneGeometry(1.42, 0.92), cellsMat); spt.rotation.x = -PI / 2; spt.position.y = 0.035; sp.add(spt);
      grp.position.set(cx, gy(cx, cz), cz); grp.rotation.y = 0.5;
      K.add(grp);
      AO(cx, cz, 2.2, 2.2, 0.45);
      K.circle(cx, cz, 1.7, 4.2);
    }

    // ---------------------------------------------------------------- habitat dome + module + solar array
    {
      const cx = 82, cz = -36, R = 7.5;
      const base = K.mesh(new T.CylinderGeometry(R + 0.3, R + 0.6, 0.8, 40), offWhite, cx, gy(cx, cz) + 0.4, cz);
      // geodesic dome: upper half of a subdivided icosahedron
      let ico = new T.IcosahedronGeometry(R, 2);
      const ip = ico.attributes.position, keepTri = [];
      for (let i = 0; i < ip.count; i += 3) { const yc = (ip.getY(i) + ip.getY(i + 1) + ip.getY(i + 2)) / 3; if (yc > 0.2) keepTri.push(i); }
      const dp = new Float32Array(keepTri.length * 9);
      keepTri.forEach((i, k) => { for (let v = 0; v < 3; v++) { dp[k * 9 + v * 3] = ip.getX(i + v); dp[k * 9 + v * 3 + 1] = Math.max(0, ip.getY(i + v)) * 0.82; dp[k * 9 + v * 3 + 2] = ip.getZ(i + v); } });
      const dg = new T.BufferGeometry(); dg.setAttribute('position', new T.BufferAttribute(dp, 3)); dg.computeVertexNormals();
      const glassMat = K.glass(0xffe8d0, 0.2, { side: T.DoubleSide, roughness: 0.08 });
      const dome = K.mesh(dg, glassMat, cx, gy(cx, cz) + 0.8, cz, { cast: false });
      const edges = new T.LineSegments(new T.EdgesGeometry(dg, 1), new T.LineBasicMaterial({ color: 0xf2efe8 }));
      edges.position.set(cx, gy(cx, cz) + 0.8, cz); K.group.add(edges);
      // greenhouse inside: beds of tiny plants and a warm lamp
      const plants = [];
      for (let i = 0; i < 70; i++) {
        const a = r() * TAU, d = Math.sqrt(r()) * (R - 1.5);
        const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
        if (Math.abs((z - cz) % 2.2) < 0.6) continue;
        plants.push({ x, y: gy(cx, cz) + 1.2, z, s: r.range(0.35, 0.6), sy: r.range(0.3, 0.55), color: r.pick([0x4f9a3a, 0x6cb24a, 0x3d7d2c, 0x8ac255]) });
      }
      K.instances(new T.IcosahedronGeometry(1, 1), K.std({ roughness: 0.6 }), plants, { colors: true, cast: false });
      for (let k = -2; k <= 2; k++) K.mesh(new T.BoxGeometry(R * 1.5 - Math.abs(k) * 2.2, 0.5, 1.2), K.std({ color: 0x6a5a4a, roughness: 0.8 }), cx, gy(cx, cz) + 1.0, cz + k * 2.2 + 1.1, { cast: false });
      const lamp = K.mesh(new T.SphereGeometry(0.5, 16, 8), K.std({ color: 0xffe9c8, emissive: 0xffc070, emissiveIntensity: 1.6 }), cx, gy(cx, cz) + 5.4, cz, { cast: false });
      K.contact(cx, cz, R * 1.15, R * 1.15, 0.35);
      K.circle(cx, cz, R + 0.4, 7);
      // module: ribbed cylinder east of the dome, linked by a tunnel
      const mx = cx + 13.5, mz = cz + 1, my = gy(mx, mz) + 2.6;
      const mod = K.mesh(new T.CylinderGeometry(2.4, 2.4, 9, 28), white, mx, my, mz, { rz: PI / 2 });
      for (const s of [-1, 1]) { const cap = K.mesh(new T.SphereGeometry(2.4, 24, 12, 0, TAU, 0, PI / 2), white, mx + s * 4.5, my, mz, { rz: -s * PI / 2 }); }
      for (let k = -3; k <= 3; k++) K.mesh(new T.TorusGeometry(2.42, 0.12, 6, 28), offWhite, mx + k * 1.3, my, mz, { ry: PI / 2 });
      for (const s of [-1, 1]) K.mesh(new T.BoxGeometry(0.6, 1.4, 4.2), alu, mx + s * 3, gy(mx, mz) + 0.6, mz);
      K.mesh(new T.CylinderGeometry(1.0, 1.0, 4.5, 16), offWhite, cx + R + 1.6, gy(cx, cz) + 1.5, cz + 0.5, { rz: PI / 2 });
      for (let k = 0; k < 4; k++) { const win = K.mesh(new T.CircleGeometry(0.4, 16), K.std({ color: 0x1a2030, emissive: 0xffb060, emissiveIntensity: 0.7, roughness: 0.2 }), mx - 3 + k * 2, my + 0.6, mz + 2.39, { cast: false }); }
      AO(mx, mz, 6, 3.4, 0.45);
      K.capsule(mx - 4.5, mz, mx + 4.5, mz, 2.6, 6);
      // solar array: three rows of panels tilted to the low western sun
      const sx0 = 112, sz0 = -22;
      const panelTop = new T.PlaneGeometry(4.0, 2.3); panelTop.rotateX(-PI / 2);
      for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
        const x = sx0 + col * 4.6 - 4.6, z = sz0 + row * 4.2 - 4.2, y = gy(x, z) + 1.5;
        const grpP = new T.Group();
        const top = new T.Mesh(panelTop, cellsMat); top.position.y = 0.07; grpP.add(top);
        const fr = new T.Mesh(new T.BoxGeometry(4.1, 0.12, 2.4), alu); grpP.add(fr);
        grpP.position.set(x, y, z); grpP.rotation.set(0, 0, 0.42);
        K.add(grpP);
        for (const dx of [-1.5, 1.5]) rod(P3(x + dx * 0.3, gy(x, z), z + dx * 0.5), P3(x, y - 0.05, z + dx * 0.5), 0.07, alu, K.group);
        AO(x + 0.6, z, 2.4, 1.6, 0.3);
      }
      K.box(sx0, sz0, 7.2, 6.4, 0, 2.6);
      // cable from the array to the habitat
      const cab = new T.CatmullRomCurve3([P3(sx0 - 8, 0.15, sz0 - 2), P3(105, 0.15, -30), P3(98, 0.15, -33.5), P3(mx + 4.6, 0.15, mz + 0.8)].map((v) => v.setY(gy(v.x, v.z) + 0.15)));
      K.mesh(new T.TubeGeometry(cab, 40, 0.12, 6), K.std({ color: 0x2a2624, roughness: 0.6 }), 0, 0, 0, { cast: false });
    }

    // ---------------------------------------------------------------- meteorite (iron) in the west infield
    {
      const x = -82, z = 38;
      const g = rockGeo(3, 0.12, 12, 0.7, 3);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const v = new T.Vector3(p.getX(i), p.getY(i), p.getZ(i)); const dent = Math.max(0, Math.sin(v.x * 7) * Math.sin(v.y * 6 + 1) * Math.sin(v.z * 7 + 2)) * 0.12; v.multiplyScalar(1 - dent); p.setXYZ(i, v.x, v.y, v.z); }
      g.computeVertexNormals();
      K.mesh(g, shiny(K.metal(0x4a4440, 0.55, { normalMap: rockNormal, normalScale: V2(0.6) }), 0.7), x, gy(x, z) + 0.9, z, { scale: 2.2, ry: 0.7 });
      AO(x, z, 2.8, 2.4, 0.5);
      K.circle(x, z, 2.2, 3);
    }

    // ---------------------------------------------------------------- boulders, rocks, pebbles
    {
      const variants = [];
      for (let k = 0; k < 3; k++) variants.push(rockGeo(k < 1 ? 1 : 2, 0.2 + k * 0.05, 11 + k * 7, 0.62 + (k % 2) * 0.22, [0, 2, 1][k]));
      const lists = variants.map(() => []);
      const blockers = [[68, 2, 9], [104, 24, 11], [82, -36, 10], [96, -35, 7], [112, -22, 9], [-34, -34, 4], [36, 34, 5], [HOLE[0], HOLE[1], 9], [58, 14, 2]];
      const free = (x, z, rad) => { for (const [bx, bz, br] of blockers) if (Math.hypot(x - bx, z - bz) < br + rad) return false; return true; };
      const place = (x, z, s, collide = true) => {
        if (x < TX0 + 3 || x > TX1 - 3 || z > TZ1 - 3 || z < -95) return;
        const d = roadD(x, z);
        if (d < s * 1.1 + 0.8 || !free(x, z, s)) return;
        const k = s > 1.1 ? 1 + ((r() * 2) | 0) : 0;
        lists[k].push({ x, y: gy(x, z) + s * 0.18, z, ry: r() * TAU, rx: r.range(-0.2, 0.2), s, sx: s * r.range(0.9, 1.35), sz: s * r.range(0.8, 1.2), color: r.pick([0xffffff, 0xf2e4dc, 0xe0d6d2, 0xfff0e0, 0xd4c8c4]) });
        if (s > 0.6) AO(x, z, s * 1.5, s * 1.3, 0.38);
        if (collide && s > 1.3 && d < 16) K.circle(x, z, s * 0.9, s * 1.2);
        blockers.push([x, z, s]);
      };
      // big boulder clusters
      const clusters = [[-120, 2, 7], [-70, -12, 5], [24, -48, 6], [130, -10, 4], [-112, 56, 5], [70, 32, 4], [-48, -62, 5], [100, 52, 4], [-150, -60, 4], [150, 60, 3], [-15, 40, 4], [125, 30, 3], [40, -30, 4], [-90, 20, 3]];
      for (const [x, z, n] of clusters) {
        place(x, z, r.range(2.2, 3.6));
        for (let i = 0; i < n * 3; i++) place(x + r.gauss() * 6, z + r.gauss() * 6, r.range(0.4, 1.6) * (r() < 0.25 ? 1.6 : 1));
      }
      // talus blocks fallen from the cliffs
      for (let i = 0; i < 90; i++) { const x = r.range(TX0 + 8, TX1 - 8), z = zFoot(x) + r.range(-6, 2); place(x, z, r.range(0.4, 1.8), false); }
      // random field rocks
      for (let i = 0; i < 260; i++) place(r.range(TX0 + 3, TX1 - 3), r.range(-74, TZ1 - 3), 0.3 + r() ** 3 * 1.8);
      variants.forEach((g, k) => chunked(g, rockMat, lists[k], { cast: true, colors: true }, 160));
      // pebbles and grit everywhere (no shadows)
      const pl = [];
      for (let i = 0; i < 2600; i++) {
        const x = r.range(TX0 + 2, TX1 - 2), z = r.range(-76, TZ1 - 2), d = roadD(x, z);
        if (d < -1 || (d < 0.6 && r() < 0.7)) continue;
        const s = 0.1 + r() ** 2 * 0.32;
        pl.push({ x, y: gy(x, z) + s * 0.2, z, ry: r() * TAU, s, sx: s * r.range(0.9, 1.5), color: r.pick([0x5a463c, 0x3e3430, 0x8a6048, 0x6e5446, 0xb08060, 0x2e2826]) });
      }
      const pg = new T.IcosahedronGeometry(1, 0); pg.scale(1, 0.6, 1);
      chunked(pg, K.std({ vertexColors: true, roughness: 0.85 }), pl, { colors: true, cast: false }, 160);
    }

    // ---------------------------------------------------------------- pushable rocks (round ones roll, slabs slide)
    {
      const spots = [[118, 4.5, 1.6, false], [126, -4.8, 1.5, false], [470, 5.2, 1.6, true], [612, -4.5, 1.7, true], [690, 3.8, 1.5, false], [866, -5, 1.7, true], [12, 5.6, 1.4, false], [300, 4.6, 1.5, true]];
      spots.forEach(([s, off, rad, slide], k) => {
        const q = track.place(s, off);
        const g = slide ? rockGeo(1, 0.2, 200 + k, 0.62, 2) : rockGeo(2, 0.09, 300 + k, 0.92, 0);
        const m = K.mesh(g, rockMat, q.x, rad * 0.85, q.z, { ry: r() * 6, scale: rad * 0.95 });
        keep.push(m);
        K.physics.addDynamic({ x: q.x, z: q.z, r: rad, m: slide ? 3.2 : 2.2, h: rad * 1.7, mesh: m, friction: slide ? 24 : 7, baseY: rad * (slide ? 0.55 : 0.85), slide });
      });
    }

    // ---------------------------------------------------------------- the cliff band's foot blocks cars
    for (let x = TX0 + 10; x < TX1 - 10; x += 8) {
      const z1 = zFoot(x) - 1.5, z2 = zFoot(x + 8) - 1.5;
      if (cliffTop(x) < 3) continue;
      K.capsule(x, z1, x + 8, z2, 2.2, 20);
    }
    for (const b of BUTTES) K.circle(b.x, b.z, b.r + 1, 25);

    // ---------------------------------------------------------------- start / finish: painted landing-zone stripe + beacons
    {
      const s0 = 40, p = track.at(s0);
      const c = TX.makeCanvas(512, 96), g = c.getContext('2d');
      for (let y = 0; y < 3; y++) for (let x = 0; x < 16; x++) { g.fillStyle = (x + y) % 2 ? '#2a1a14' : '#f3ede2'; g.fillRect(x * 32, y * 32, 32, 32); }
      const rr = K.rng(3); g.fillStyle = 'rgba(170,90,50,0.35)'; for (let i = 0; i < 300; i++) g.fillRect(rr() * 512, rr() * 96, 2 + rr() * 4, 1 + rr() * 3);
      const mat = K.std({ map: TX.toTexture(c, { wrap: false }), roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -3 });
      const m = K.mesh(new T.PlaneGeometry(14.6, 2.8), mat, p.x, 0.07, p.z, { cast: false });
      m.rotation.order = 'YXZ'; m.rotation.y = -p.angle + PI / 2; m.rotation.x = -PI / 2;
      m.renderOrder = 1;
      const beaconCap = K.std({ color: 0xff3a1a, emissive: 0xff2a10, emissiveIntensity: 1.5, roughness: 0.3 });
      A.beacon = beaconCap;
      const caps = [];
      for (const side of [-1, 1]) {
        for (let k = 0; k < 2; k++) {
          const q = track.place(s0 + (k ? 3 : -0.2), side * (8.6 + k * 0.4));
          K.mesh(new T.CylinderGeometry(0.32, 0.4, 1.7, 12), white, q.x, gy(q.x, q.z) + 0.85, q.z);
          K.mesh(new T.CylinderGeometry(0.42, 0.42, 0.3, 12), K.plastic(0xff6a1c, 0.4), q.x, gy(q.x, q.z) + 1.1, q.z);
          caps.push(new T.SphereGeometry(0.3, 12, 8).translate(q.x, gy(q.x, q.z) + 1.85, q.z));
          AO(q.x, q.z, 0.7, 0.7, 0.5);
          K.circle(q.x, q.z, 0.45, 2);
        }
      }
      const capMesh = K.mesh(K.BufferGeometryUtils.mergeGeometries(caps), beaconCap, 0, 0, 0, { cast: false });
      keep.push(capMesh);
    }

    // ---------------------------------------------------------------- the diorama: wooden frame, base, table, room
    {
      const wood = TX.woodTextures({ size: 512, seed: 19, planks: 1, base: 0x7a4a2a, dark: 0x4a2a16, light: 0xa06a3e, ringFreq: 14, gap: 0, roughBase: 0.45, lacquer: 0.6 });
      for (const t of Object.values(wood)) { t.rotation = PI / 2; t.center.set(0.5, 0.5); }
      const frameMat = K.std({ map: wood.map, normalMap: wood.normalMap, roughnessMap: wood.roughnessMap, normalScale: V2(0.5) });
      const FY = 0.25, FB = -8; // frame top, base bottom
      const hgt = FY - FB;
      const boards = [];
      const board = (w, h, d, x, y, z) => {
        const g = new T.BoxGeometry(w, h, d).toNonIndexed();
        const uvA = g.attributes.uv, len = Math.max(w, d) / 60;
        for (let i = 0; i < uvA.count; i++) uvA.setX(i, uvA.getX(i) * len);
        g.translate(x, y, z); boards.push(g);
      };
      // south, north (behind the backdrop), west, east boards and the backdrop's side walls
      board(330, hgt, 5, -1, FB + hgt / 2, 92.5);
      board(330, hgt + 14, 5, -1, FB + (hgt + 14) / 2, -114.5);
      board(5, hgt, 212, -163.5, FB + hgt / 2, -11);
      board(5, hgt, 212, 161.5, FB + hgt / 2, -11);
      for (const sx of [-163.5, 161.5]) board(5, 84, 14, sx, 34, -96);
      K.mesh(K.BufferGeometryUtils.mergeGeometries(boards), frameMat, 0, 0, 0, { cast: false });
      // dark table / plinth underneath
      const tableMat = K.std({ color: 0x1e1d20, roughness: 0.55, metalness: 0.1 });
      const tparts = [new T.BoxGeometry(346, 3, 236).translate(-1, FB - 1.5, -10), new T.BoxGeometry(338, 10, 228).translate(-1, FB - 8, -10)];
      for (const [lx, lz] of [[-165, 100], [163, 100], [-165, -120], [163, -120]]) tparts.push(new T.BoxGeometry(7, 64, 7).translate(lx, -44, lz));
      K.mesh(K.BufferGeometryUtils.mergeGeometries(tparts), tableMat, 0, 0, 0, { cast: false });
      // museum floor: dark polished planks
      const fw = TX.woodTextures({ size: 512, seed: 7, planks: 6, base: 0x3a2618, dark: 0x22150c, light: 0x5a3c26, ringFreq: 20, gap: 0.005, roughBase: 0.4, lacquer: 0.7 });
      for (const t of Object.values(fw)) t.repeat.set(1800 / 120, 1800 / 120);
      K.mesh(new T.PlaneGeometry(1800, 1800), K.std({ map: fw.map, normalMap: fw.normalMap, roughnessMap: fw.roughnessMap, normalScale: V2(0.4) }), 0, -76, 0, { rx: -PI / 2, cast: false });
      const shm = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5, alphaMap: TX.blobShadowTexture(), depthWrite: false }));
      shm.rotation.x = -PI / 2; shm.scale.set(460, 330, 1); shm.position.set(10, -75.9, 0); K.group.add(shm);
      // brass stanchions with a velvet rope in front of the exhibit
      const brass = shiny(K.metal(0xc9a24a, 0.25), 1.2);
      const posts = [];
      for (let k = 0; k < 6; k++) posts.push([-250 + k * 100, 150]);
      posts.push([-250, 40], [-250, -70], [250, 40], [250, -70]);
      for (const [px2, pz] of posts) {
        K.mesh(K.lathe([[0.01, 0], [7, 0], [7.2, 0.8], [5, 1.6], [1.4, 2.4], [1.1, 30], [1.6, 31], [2.6, 33], [2.4, 34.6], [0.01, 35.2]], 24), brass, px2, -76, pz, { cast: false });
      }
      const rope = K.std({ color: 0x7a0f18, roughness: 0.9 });
      for (let k = 0; k < 5; k++) {
        const a = P3(-250 + k * 100, -44, 150), b = P3(-150 + k * 100, -44, 150);
        const mid = a.clone().lerp(b, 0.5); mid.y -= 9;
        K.mesh(new T.TubeGeometry(new T.QuadraticBezierCurve3(a, mid, b), 24, 1.1, 8), rope, 0, 0, 0, { cast: false });
      }
      for (const sx of [-250, 250]) for (const [z1, z2] of [[150, 40], [40, -70]]) {
        const a = P3(sx, -44, z1), b = P3(sx, -44, z2), mid = a.clone().lerp(b, 0.5); mid.y -= 9;
        K.mesh(new T.TubeGeometry(new T.QuadraticBezierCurve3(a, mid, b), 24, 1.1, 8), rope, 0, 0, 0, { cast: false });
      }

      // painted backdrop: a cyclorama sweeping up behind the cliffs
      const bc = TX.makeCanvas(1024, 512), g = bc.getContext('2d');
      const sky = g.createLinearGradient(0, 512, 0, 0);
      sky.addColorStop(0, '#e8b47a'); sky.addColorStop(0.18, '#d99a62'); sky.addColorStop(0.42, '#a8704c'); sky.addColorStop(0.7, '#5c3a2c'); sky.addColorStop(1, '#22161a');
      g.fillStyle = sky; g.fillRect(0, 0, 1024, 512);
      const rr = K.rng(51);
      // brush strokes
      for (let i = 0; i < 900; i++) { const y = rr() * 512; g.strokeStyle = `rgba(${rr() < 0.5 ? '255,220,180' : '60,30,20'},${0.03 + rr() * 0.04})`; g.lineWidth = 2 + rr() * 6; g.beginPath(); const x = rr() * 1024; g.moveTo(x, y); g.lineTo(x + 20 + rr() * 60, y + (rr() - 0.5) * 6); g.stroke(); }
      // Earth: a tiny blue evening star, and a faint moon speck
      const ex = 640, ey = 150;
      const halo = g.createRadialGradient(ex, ey, 0, ex, ey, 14); halo.addColorStop(0, 'rgba(160,200,255,0.9)'); halo.addColorStop(0.3, 'rgba(120,170,255,0.35)'); halo.addColorStop(1, 'rgba(120,170,255,0)');
      g.fillStyle = halo; g.beginPath(); g.arc(ex, ey, 14, 0, TAU); g.fill();
      g.fillStyle = '#9cc8ff'; g.beginPath(); g.arc(ex, ey, 2.6, 0, TAU); g.fill();
      g.fillStyle = 'rgba(230,230,230,0.8)'; g.beginPath(); g.arc(ex + 7, ey - 3, 0.9, 0, TAU); g.fill();
      for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,240,220,${0.15 + rr() * 0.4})`; g.fillRect(rr() * 1024, rr() * 140, 1.2, 1.2); }
      // distant painted crater rim and mesas
      const ridge = (y0, amp, col, seed) => {
        const q = K.rng(seed);
        g.fillStyle = col; g.beginPath(); g.moveTo(0, 512);
        let y = y0;
        for (let x = 0; x <= 1024; x += 8) { y = y0 - amp * (0.5 + 0.5 * Math.sin(x / 140 + seed)) - (q() - 0.5) * amp * 0.15; if (q() < 0.04) y -= amp * 0.6; g.lineTo(x, y); }
        g.lineTo(1024, 512); g.closePath(); g.fill();
      };
      ridge(330, 30, 'rgba(184,122,86,0.8)', 3);
      ridge(352, 20, 'rgba(158,92,60,0.9)', 7);
      ridge(372, 14, '#94522f', 11);
      const pl = g.createLinearGradient(0, 380, 0, 512); pl.addColorStop(0, '#8a4a2c'); pl.addColorStop(1, '#a85a32');
      g.fillStyle = pl; g.fillRect(0, 380, 1024, 132);
      const bt = TX.toTexture(bc, { wrap: false });
      const prof = [[-89.5, -4], [-91.5, 6], [-94, 15], [-96.5, 25], [-98.5, 37], [-100, 53], [-101, 80]];
      let tot = 0; const acc = [0];
      for (let i = 1; i < prof.length; i++) { tot += Math.hypot(prof[i][0] - prof[i - 1][0], prof[i][1] - prof[i - 1][1]); acc.push(tot); }
      const segX = 40, pos = [], uv = [], idx = [];
      for (let j = 0; j < prof.length; j++) for (let i = 0; i <= segX; i++) {
        const x = -162 + 324 * i / segX;
        pos.push(x, prof[j][1], prof[j][0] - 1.2 * Math.cos((x / 162) * PI * 0.5) * 0); uv.push(i / segX, acc[j] / tot);
      }
      for (let j = 0; j < prof.length - 1; j++) for (let i = 0; i < segX; i++) { const a = j * (segX + 1) + i; idx.push(a, a + 1, a + segX + 1, a + 1, a + segX + 2, a + segX + 1); }
      const bg = new T.BufferGeometry(); bg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); bg.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); bg.setIndex(idx); bg.computeVertexNormals();
      const back = new T.Mesh(bg, new T.MeshBasicMaterial({ map: bt, color: 0xe8e0d8, side: T.DoubleSide }));
      keep.push(back); K.group.add(back);
    }

    // ---------------------------------------------------------------- model-maker touches on the frame: placard, brush, glue, paint pot
    {
      const FY = 0.25;
      // placard card on a small acrylic stand
      const c = TX.makeCanvas(512, 224), g = c.getContext('2d');
      g.fillStyle = '#f4efe4'; g.fillRect(0, 0, 512, 224);
      g.strokeStyle = '#2c2a28'; g.lineWidth = 3; g.strokeRect(10, 10, 492, 204);
      g.fillStyle = '#a5401f'; g.beginPath(); g.arc(70, 112, 44, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,210,170,0.3)'; g.beginPath(); g.arc(58, 98, 22, 0, TAU); g.fill();
      g.fillStyle = '#1f1d1b'; g.font = '700 64px Georgia, serif'; g.textAlign = 'left';
      g.fillText('MARS', 132, 86);
      g.font = 'italic 30px Georgia, serif'; g.fillText('Jezero Crater · 18.4° N', 134, 128);
      g.font = '22px Rubik, Arial, sans-serif'; g.fillStyle = '#4a4440';
      g.fillText('diorama · scale 1 : 400', 134, 164);
      g.fillText('built by the Red Dust Model Club', 134, 194);
      const card = new T.Mesh(new T.BoxGeometry(11.4, 5, 0.12), white);
      const stand = new T.Group();
      card.position.set(0, 2.3, 0); card.rotation.x = -0.55; stand.add(card);
      const face = new T.Mesh(new T.PlaneGeometry(11.3, 4.95), K.std({ map: TX.toTexture(c, { wrap: false }), roughness: 0.6 })); face.position.z = 0.065; card.add(face);
      const acr = new T.Mesh(new T.BoxGeometry(11.8, 0.25, 3.2), K.glass(0xffffff, 0.35, { side: T.FrontSide })); acr.position.y = 0.12; stand.add(acr);
      const brace = new T.Mesh(new T.BoxGeometry(11.8, 3.6, 0.2), K.glass(0xffffff, 0.25, { side: T.FrontSide })); brace.position.set(0, 1.9, -1.2); brace.rotation.x = 0.5; stand.add(brace);
      stand.position.set(104, FY, 92.4);
      K.add(stand);
      AO(104, 92.4, 6.5, 2.2, 0.35, 0, FY);
      K.box(104, 92.4, 6, 1.8, 0, 4);
      // paintbrush lying on the frame (rust paint on the tip)
      const br = new T.Group();
      const handle = new T.Mesh(K.lathe([[0.01, 0], [0.32, 0.3], [0.42, 4], [0.36, 9], [0.22, 12.5], [0.01, 12.8]], 16), K.plastic(0x1e3a6e, 0.25));
      handle.rotation.z = -PI / 2; br.add(handle);
      const ferrule = new T.Mesh(new T.CylinderGeometry(0.34, 0.3, 2.2, 16), shiny(K.metal(0xcfcfd4, 0.2), 1)); ferrule.rotation.z = PI / 2; ferrule.position.x = -1.1; br.add(ferrule);
      const bristle = new T.Mesh(K.lathe([[0.3, 0], [0.42, 0.8], [0.3, 1.8], [0.01, 2.6]], 14), K.std({ color: 0x9a4a24, roughness: 0.6 })); bristle.rotation.z = PI / 2; bristle.position.x = -2.2; br.add(bristle);
      br.position.set(-40, FY + 0.42, 92.6); br.rotation.y = 0.06;
      K.add(br);
      AO(-44, 92.6, 8, 0.8, 0.35, -0.06, FY);
      // tube of model glue
      const tube = new T.Group();
      const tb = new T.Mesh(K.lathe([[0.01, 0], [0.9, 0.1], [0.95, 5.5], [0.25, 7.0], [0.01, 7.0]], 20), K.std({ map: (() => { const cc = TX.makeCanvas(256, 64), gg = cc.getContext('2d'); gg.fillStyle = '#e9e4da'; gg.fillRect(0, 0, 256, 64); gg.fillStyle = '#d22f26'; gg.fillRect(0, 16, 256, 30); gg.fillStyle = '#fff'; gg.font = '700 22px Rubik, Arial'; gg.fillText('MODEL CEMENT', 20, 39); return TX.toTexture(cc, { wrap: false }); })(), metalness: 0.4, roughness: 0.35 }));
      tb.rotation.z = -PI / 2; tube.add(tb);
      const flat = new T.Mesh(new T.BoxGeometry(0.3, 0.2, 2.0), K.std({ color: 0xd8d4cc, metalness: 0.6, roughness: 0.4 })); flat.position.x = 0.1; tube.add(flat);
      const capT = new T.Mesh(new T.CylinderGeometry(0.4, 0.45, 1.4, 14), K.plastic(0xd22f26, 0.3)); capT.rotation.z = PI / 2; capT.position.x = 7.6; tube.add(capT);
      tube.position.set(-128, FY + 0.95, 92.2); tube.rotation.y = -0.2;
      K.add(tube);
      AO(-124.5, 92.5, 4.5, 1.1, 0.35, 0.2, FY);
      // open paint pot (rust oxide) on the south-east corner
      const ppx = 150, ppz = 92.5;
      K.mesh(K.lathe([[0.01, 0], [1.6, 0], [1.7, 0.2], [1.7, 2.2], [1.5, 2.3], [1.45, 0.5], [0.01, 0.4]], 28), K.glass(0xffffff, 0.4, { side: T.DoubleSide }), ppx, FY, ppz, { cast: false });
      K.mesh(new T.CylinderGeometry(1.45, 1.45, 1.6, 28), K.liquid(0x9c3e1c, { roughness: 0.2 }), ppx, FY + 1.2, ppz);
      K.mesh(new T.CylinderGeometry(1.75, 1.75, 0.5, 28), K.plastic(0x2a2a2a, 0.4), ppx + 3.4, FY + 0.25, ppz - 0.3);
      AO(ppx, ppz, 2.2, 2.2, 0.4, 0, FY); AO(ppx + 3.4, ppz - 0.3, 2.1, 2.1, 0.35, 0, FY);
      K.circle(ppx, ppz, 1.7, 3); K.circle(ppx + 3.4, ppz - 0.3, 1.75, 1);
    }

    // ---------------------------------------------------------------- dust devil drifting through the west infield
    {
      const c = TX.makeCanvas(128, 256), g = c.getContext('2d'), rr = K.rng(66);
      for (let i = 0; i < 160; i++) {
        const x = rr() * 128, y = rr() * 256, len = 20 + rr() * 60;
        g.strokeStyle = `rgba(255,255,255,${0.08 + rr() * 0.2})`; g.lineWidth = 2 + rr() * 6;
        for (const ox of [-128, 0, 128]) { g.beginPath(); g.moveTo(x + ox, y); g.lineTo(x + ox + len, y - len * 0.35); g.stroke(); }
      }
      // fade at the top and bottom
      g.globalCompositeOperation = 'destination-in';
      const fg = g.createLinearGradient(0, 0, 0, 256); fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(0.25, 'rgba(0,0,0,1)'); fg.addColorStop(0.85, 'rgba(0,0,0,1)'); fg.addColorStop(1, 'rgba(0,0,0,0.2)');
      g.fillStyle = fg; g.fillRect(0, 0, 128, 256);
      const tex = TX.toTexture(c);
      tex.repeat.set(2, 1);
      const mat = new T.MeshBasicMaterial({ color: 0xd49a6a, alphaMap: tex, transparent: true, opacity: 0.55, depthWrite: false, side: T.DoubleSide });
      const prof = [[0.6, 0], [1.0, 1.5], [1.6, 4], [2.6, 8], [3.8, 12], [5.2, 16]];
      const dd = new T.Group();
      const outer = new T.Mesh(K.lathe(prof, 24), mat); dd.add(outer);
      const inner = new T.Mesh(K.lathe(prof.map(([a, b]) => [a * 0.6, b * 0.92]), 20), mat); dd.add(inner);
      const skirtC = TX.makeCanvas(128), sg = skirtC.getContext('2d');
      const sgr = sg.createRadialGradient(64, 64, 8, 64, 64, 64); sgr.addColorStop(0, 'rgba(255,255,255,0.7)'); sgr.addColorStop(1, 'rgba(255,255,255,0)');
      sg.fillStyle = sgr; sg.fillRect(0, 0, 128, 128);
      const skirt = new T.Mesh(new T.PlaneGeometry(9, 9), new T.MeshBasicMaterial({ color: 0xc88c5c, alphaMap: TX.toTexture(skirtC, { wrap: false }), transparent: true, opacity: 0.6, depthWrite: false }));
      skirt.rotation.x = -PI / 2; skirt.position.y = 0.4; dd.add(skirt);
      dd.renderOrder = 4;
      dd.traverse((o) => { o.castShadow = false; o.receiveShadow = false; o.renderOrder = 4; });
      K.group.add(dd); keep.push(dd);
      A.devil = { dd, outer, inner, tex, gy };
    }

    // ---------------------------------------------------------------- airborne dust motes in the low sun
    {
      const n = K.quality && K.quality.tilt === false ? 160 : 300;
      const pos = new Float32Array(n * 3), base = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        const x = r.range(TX0, TX1), z = r.range(-80, TZ1), y = r.range(2, 30);
        base.set([x, y, z, r() * 100], i * 4); pos.set([x, y, z], i * 3);
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(pos, 3).setUsage(T.DynamicDrawUsage));
      g.boundingSphere = new T.Sphere(new T.Vector3(0, 15, 0), 400);
      const sc = TX.makeCanvas(64), sg = sc.getContext('2d');
      const gr = sg.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,230,200,0.5)'); gr.addColorStop(1, 'rgba(255,220,180,0)');
      sg.fillStyle = gr; sg.fillRect(0, 0, 64, 64);
      const mat = new T.PointsMaterial({ size: 0.6, map: TX.toTexture(sc, { wrap: false }), color: 0xffcf9a, transparent: true, opacity: 0.6, depthWrite: false, blending: T.AdditiveBlending, sizeAttenuation: true });
      const pts = new T.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 3;
      K.group.add(pts);
      A.motes = { g, base, n };
    }

    flushBake();
    flushAO();

    // ---------------------------------------------------------------- merge static meshes (fewer draw calls)
    {
      const BU = K.BufferGeometryUtils;
      K.group.updateMatrixWorld(true);
      const isKept = (o) => { for (let p = o; p; p = p.parent) if (keep.includes(p)) return true; return false; };
      const classMats = {
        metalS: shiny(K.std({ vertexColors: true, metalness: 1, roughness: 0.15 }), 1.1),
        metalR: shiny(K.std({ vertexColors: true, metalness: 1, roughness: 0.38 }), 0.9),
        gloss: shiny(K.phys({ vertexColors: true, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.08 }), 0.8),
        plastic: K.phys({ vertexColors: true, roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.3 }),
        satin: K.std({ vertexColors: true, roughness: 0.45 }),
        matte: K.std({ vertexColors: true, roughness: 0.85 }),
      };
      const plain = (m) => !m.map && !m.normalMap && !m.roughnessMap && !m.alphaMap && !m.bumpMap && !m.metalnessMap && !m.transparent && !m.emissiveMap && (m.emissive ? m.emissive.getHex() === 0 : true) && m.side !== T.BackSide && m.isMeshStandardMaterial && !m.onBeforeCompile.toString().includes('tDetail');
      const classOf = (m) => {
        if (m.metalness >= 0.5) return m.roughness < 0.26 ? 'metalS' : 'metalR';
        if (m.isMeshPhysicalMaterial && m.clearcoat >= 0.6) return 'gloss';
        if (m.isMeshPhysicalMaterial && m.clearcoat > 0) return 'plastic';
        return m.roughness < 0.6 ? 'satin' : 'matte';
      };
      const buckets = new Map();
      const col = new T.Color();
      const c0y = (o) => { if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); return o.geometry.boundingSphere.center.clone().applyMatrix4(o.matrixWorld).y; };
      K.group.traverse((o) => {
        if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || isKept(o)) return;
        const m = o.material;
        if (m.transparent || o.renderOrder) return;
        if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
        if (o.geometry.boundingSphere.radius * o.matrixWorld.getMaxScaleOnAxis() > (c0y(o) < -20 ? 400 : 70)) return;
        const c = o.geometry.boundingSphere.center.clone().applyMatrix4(o.matrixWorld);
        const cell = c.y < -20 ? 'f' : Math.floor((c.z + 200) / 95) + ':b';
        const cls = plain(m) ? classOf(m) + (m.side === T.DoubleSide ? 'D' : '') : null;
        const key = (cls || m.uuid) + cell + (o.castShadow ? 'c' : '') + (o.receiveShadow ? 'r' : '');
        if (!buckets.has(key)) buckets.set(key, { cls, list: [] });
        buckets.get(key).list.push(o);
      });
      for (const { cls, list } of buckets.values()) {
        if (list.length < 2 && !cls) continue;
        const geos = [];
        for (const o of list) {
          let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
          g.applyMatrix4(o.matrixWorld);
          if (!g.attributes.normal) g.computeVertexNormals();
          if (cls) {
            col.copy(o.material.color);
            const n = g.attributes.position.count, ca = new Float32Array(n * 3), src = o.material.vertexColors ? g.attributes.color : null;
            for (let i = 0; i < n; i++) { ca[i * 3] = col.r * (src ? src.getX(i) : 1); ca[i * 3 + 1] = col.g * (src ? src.getY(i) : 1); ca[i * 3 + 2] = col.b * (src ? src.getZ(i) : 1); }
            for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k);
            g.setAttribute('color', new T.BufferAttribute(ca, 3));
          } else {
            for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
            if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
          }
          geos.push(g);
        }
        if (!cls) {
          const hasCol = geos.some((g) => g.attributes.color);
          if (hasCol !== geos.every((g) => g.attributes.color)) continue;
        }
        const merged = BU.mergeGeometries(geos, false);
        if (!merged) continue;
        let mat = list[0].material;
        if (cls) {
          const base = cls.replace('D', '');
          mat = classMats[cls] || (classMats[cls] = classMats[base].clone());
          if (cls.endsWith('D')) mat.side = T.DoubleSide;
        }
        const m = new T.Mesh(merged, mat);
        m.castShadow = list[0].castShadow; m.receiveShadow = list[0].receiveShadow;
        for (const o of list) o.parent.remove(o);
        K.group.add(m);
      }
    }
  },

  animate(time, dt) {
    if (!A) return;
    if (A.beacon) A.beacon.emissiveIntensity = Math.floor(time * 1.6) % 2 ? 0.25 : 2.2;
    if (A.devil) {
      const d = A.devil;
      const x = -106 + Math.sin(time * 0.045) * 26 + Math.sin(time * 0.11 + 1) * 6;
      const z = 16 + Math.sin(time * 0.033 + 2) * 30 + Math.cos(time * 0.09) * 5;
      d.dd.position.set(x, d.gy(x, z), z);
      d.outer.rotation.y = -time * 2.4; d.inner.rotation.y = -time * 3.6;
      d.dd.rotation.z = Math.sin(time * 0.7) * 0.06; d.dd.rotation.x = Math.cos(time * 0.5) * 0.05;
      d.tex.offset.y = -time * 0.18; d.tex.offset.x = time * 0.05;
    }
    if (A.motes) {
      const { g, base, n } = A.motes;
      const p = g.attributes.position.array;
      for (let i = 0; i < n; i++) {
        const ph = base[i * 4 + 3];
        p[i * 3] = base[i * 4] + Math.sin(time * 0.11 + ph) * 3 + Math.sin(time * 0.04 + ph * 0.3) * 5;
        p[i * 3 + 1] = base[i * 4 + 1] + Math.sin(time * 0.19 + ph * 1.7) * 1.8;
        p[i * 3 + 2] = base[i * 4 + 2] + Math.cos(time * 0.15 + ph * 0.6) * 2.5;
      }
      g.attributes.position.needsUpdate = true;
    }
  },
};

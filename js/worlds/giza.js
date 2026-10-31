// World: Giza Sandpit (Pharaoh Cup, table 1 of 4). A child's wooden sandpit on a sunny garden patio, sculpted into a
// toy Giza plateau: three bucket-moulded sand pyramids and a sand sphinx with a fork-pressed head-cloth, a road the
// kids pressed flat with a toy roller and lined with a raked ridge of shells and pebbles, and the "Nile": a trench dug
// from the north board down to a little lake and filled from the watering can, with paper palms and papyrus on its
// banks. The north straight leaps the Nile off a packed-sand ramp (the spade still lies beside it), the middle straight
// hops a dune hump under the sphinx's nose, and a toy camel caravan is dragged slowly round a cotton-reel pulley loop
// across the west-bound straight (a bell rings before the camels step onto the road). The tipped watering can left a
// patch of sticky mud by the north straight; plastic sand moulds and a little bucket can be shoved about.

const TRACK = [
  [-61.25, 104], [48.75, 103], [84.75, 98], [106.75, 82], [113.75, 58], [113.75, 26], [112.75, -6], [110.75, -36],
  [100.75, -60], [78.75, -74], [48.75, -79], [-31.25, -78], [-67.25, -74], [-95.25, -62], [-109.25, -40],
  [-105.25, -17], [-85.25, -5], [-53.25, -3], [-23.25, -3], [-1.25, 3], [12.75, 19], [11.75, 37], [-3.25, 51],
  [-27.25, 56], [-59.25, 56], [-85.25, 57], [-104.25, 64], [-112.25, 80], [-105.25, 97], [-87.25, 104],
];
const W = 16;
const PI = Math.PI, TAU = PI * 2;
// the sandpit: inner faces of the boards, board thickness, top of the boards and the patio below
const FR = { x0: -132, x1: 132, z0: -140, z1: 124, t: 2.5, top: 4, bot: -11 };
const START = 40;
// the Nile jump: ramp start (arc length), length, height, flat gap before the water, water half-width, ramp width
const JUMP = { s0: 371, len: 10, h: 3, gap: 2.2, hw: 3.65, wid: 24 };
const S_NILE = JUMP.s0 + JUMP.len + JUMP.gap + JUMP.hw; // where the Nile crosses the road
// the dune hump on the middle straight: start, windward length, lee face, height
const HUMP = { s0: 641, len: 7, lee: 1.6, h: 1.25 };
const LAKE = { x: 62, z: 6, r: 11.5 };
// camel caravan: a string loop round two cotton reels (north and south), the camels walk round it at radius r
const CAR = { x: -50, zN: 22, zS: 86, r: 4.3, v: 3.4, n: 3, gap: 13.5, ph: 9, reel: 2.1, roadZ: 56, sc: 1.25 };
const PYR = [
  { x: -18, z: -51, b: 15, h: 22, n: 11, ry: 0.04 },
  { x: -52, z: -46, b: 12, h: 17, n: 9, ry: -0.05 },
  { x: -80, z: -40, b: 8.5, h: 12, n: 7, ry: 0.08 },
];
const SPH = { x: -48, z: -23 };
const MUD = { s: 437, lat: 8.6, r: 4.6 };
const CAN = { x: -10, z: -100 };

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mod = (a, n) => ((a % n) + n) % n;

// ---- the caravan loop: pure functions of the path parameter u (0 = north end of the west leg, walking south)
const CV = (() => { const Ls = CAR.zS - CAR.zN, Lc = PI * CAR.r; return { Ls, Lc, L: 2 * Ls + 2 * Lc }; })();
function cvPos(u, o) {
  const { Ls, Lc } = CV, rr = CAR.r;
  u = mod(u, CV.L);
  if (u < Ls) { o.x = CAR.x - rr; o.z = CAR.zN + u; o.a = PI / 2; }
  else if (u < Ls + Lc) { const th = PI - (u - Ls) / rr; o.x = CAR.x + rr * Math.cos(th); o.z = CAR.zS + rr * Math.sin(th); o.a = th - PI / 2; }
  else if (u < 2 * Ls + Lc) { o.x = CAR.x + rr; o.z = CAR.zS - (u - Ls - Lc); o.a = -PI / 2; }
  else { const th = -(u - 2 * Ls - Lc) / rr; o.x = CAR.x + rr * Math.cos(th); o.z = CAR.zN + rr * Math.sin(th); o.a = th - PI / 2; }
  return o;
}
const camelU = (k, t) => CAR.v * t + CAR.ph - k * CAR.gap;
// path parameters at which the lead camel's nose is about to reach the road: west leg (south-bound), east leg
const ROAD_IN = (() => { const band = W / 2 + 3.4 + 0.6; return [CAR.roadZ - band - CAR.zN, CV.Ls + CV.Lc + (CAR.zS - (CAR.roadZ + band))]; })();
const BELL_U = ROAD_IN.flatMap((u) => [u - 1.7 * CAR.v, u - 1.3 * CAR.v]);

let A = null; // runtime state for tick / animate

export default {
  id: 'giza',
  name: 'Giza Sandpit',
  blurb: 'A sandpit Giza: leap the Nile off a sand ramp, dodge the camel caravan, mind the mud.',
  vehicle: 'buggy',
  seed: 83,
  track: { points: TRACK, width: W, startS: START },
  bounds: { minX: FR.x0, maxX: FR.x1, minZ: FR.z0, maxZ: FR.z1 },
  fallOffEdges: false,
  floorY: FR.bot,
  offCourse: 16,
  offroad: { kind: 'slow', margin: 1 },
  skidColor: 0x8a6844,
  dustColor: 0xe2c995,
  smoke: false,
  dust: {
    normal: { color: 0xd8bd8a, size: 1.1, life: 0.5, up: 1.4, grav: 3, alpha: 0.26, grow: 2, rate: 0.45 },
    slow: { color: 0xe6cc98, size: 1.35, life: 0.65, up: 3, grav: 7, alpha: 0.55, grow: 2.1, rate: 1.6 },
    sticky: { color: 0x4e3620, size: 0.7, life: 0.45, up: 4, grav: 40, alpha: 0.95, grow: 1, rate: 2 },
  },
  lighting: {
    sunDir: [-0.55, 1.45, 0.3], sunColor: 0xfff1d8, sunIntensity: 3.0,
    hemiSky: 0xbcd9ff, hemiGround: 0xc9a46e, hemiIntensity: 0.62,
    envIntensity: 0.45, exposure: 1.0, background: 0x9cc8ea, shadowRadius: 1.4,
  },

  async build(K) {
    const { THREE: T, TX, r, track } = K;
    const BU = K.BufferGeometryUtils;
    const L = track.length;
    const low = !!(K.quality && K.quality.tilt === false);
    const V2 = (a, b = a) => new T.Vector2(a, b);
    A = { L, sJ0: JUMP.s0, sT: S_NILE, fell: new Set(), prevT: null, cvO: { x: 0, z: 0, a: 0 } };
    const warnRoad = (what, x, z, m = 1) => { if (!K.offRoad(x, z, m)) console.warn(`giza: ${what} on the road at ${x.toFixed(1)},${z.toFixed(1)}`); };

    // ============================================================ helpers: merging, AO, noise
    const _q = new T.Quaternion(), _e = new T.Euler(), _v = new T.Vector3(), _s = new T.Vector3(), _c = new T.Color();
    const mtx = (o = {}) => new T.Matrix4().compose(_v.set(o.x || 0, o.y || 0, o.z || 0), _q.setFromEuler(_e.set(o.rx || 0, o.ry || 0, o.rz || 0, o.order || 'YXZ')), _s.set(o.sx ?? o.s ?? 1, o.sy ?? o.s ?? 1, o.sz ?? o.s ?? 1));
    const tint = (g, c) => {
      _c.set(c);
      const n = g.attributes.position.count, a = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; }
      g.setAttribute('color', new T.BufferAttribute(a, 3));
      return g;
    };
    const prep = (geo, c, M) => {
      const g = geo.index ? geo.toNonIndexed() : geo.clone();
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
      g.morphAttributes = {};
      if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.attributes.normal) g.computeVertexNormals();
      if (M) g.applyMatrix4(M);
      if (!g.attributes.color || c != null) tint(g, c ?? 0xffffff);
      g.clearGroups();
      return g;
    };
    // static parts merged per material and per 140-unit cell
    const bins = new Map();
    const putM = (geo, c, M, mat, cast = true) => {
      const g = prep(geo, c, M);
      const e = M.elements, x = e[12], z = e[14];
      const key = mat.uuid + (cast ? 'c' : 'n') + Math.floor((x + 420) / 140) + ':' + Math.floor((z + 420) / 140);
      if (!bins.has(key)) bins.set(key, { mat, cast, parts: [] });
      bins.get(key).parts.push(g);
    };
    const put = (geo, c, o, mat, cast = true) => putM(geo, c, mtx(o), mat, cast);
    // a group of parts under one placement: parts = [[geo, colour, local placement], ...]
    const putGroup = (parts, o, mat, cast = true) => { const P = mtx(o); for (const [g, c, lo] of parts) putM(g, c, P.clone().multiply(mtx(lo)), mat, cast); };
    const flushBins = () => {
      for (const { mat, cast, parts } of bins.values()) {
        const g = BU.mergeGeometries(parts, false);
        g.computeBoundingSphere();
        const m = new T.Mesh(g, mat); m.castShadow = cast; m.receiveShadow = true;
        K.group.add(m);
      }
      bins.clear();
    };
    // contact shadows: one instanced mesh, opacity carried in the instance's y scale
    const contactMat = new T.MeshBasicMaterial({ color: 0x2a1a08, transparent: true, alphaMap: TX.blobShadowTexture(), depthWrite: false });
    contactMat.onBeforeCompile = (sh) => {
      sh.vertexShader = 'varying float vOp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\nvOp = length(instanceMatrix[1].xyz);\n#endif');
      sh.fragmentShader = 'varying float vOp;\n' + sh.fragmentShader.replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\ndiffuseColor.a *= vOp;');
    };
    const contacts = [];
    const AO = (x, z, rx, rz = rx, op = 0.4, ang = 0, y = null) => contacts.push({ x, y: (y ?? Hs(x, z)) + 0.07, z, ry: -ang, sx: rx * 2, sy: op * 0.75, sz: rz * 2 });
    const NF = TX.noiseField(256, { seed: 83, period: 8, oct: 4 });
    const NF2 = TX.noiseField(256, { seed: 89, period: 16, oct: 3 });
    const bil = (f, x, y) => {
      x = ((x % 256) + 256) % 256; y = ((y % 256) + 256) % 256;
      const x0 = x | 0, y0 = y | 0, x1 = (x0 + 1) & 255, y1 = (y0 + 1) & 255, fx = x - x0, fy = y - y0;
      return (f[y0 * 256 + x0] * (1 - fx) + f[y0 * 256 + x1] * fx) * (1 - fy) + (f[y1 * 256 + x0] * (1 - fx) + f[y1 * 256 + x1] * fx) * fy;
    };
    const n1 = (x, z, sc, o = 0) => bil(NF, x * sc + 37 + o, z * sc + 91 + o * 0.7);
    const n2 = (x, z, sc, o = 0) => bil(NF2, x * sc + 11 + o, z * sc + 53);
    const canvas = (w, h, draw) => { const c = TX.makeCanvas(w, h); draw(c.getContext('2d'), w, h); return c; };
    const rbox = (w, h, d, rad = 0.3, seg = 2) => new K.RoundedBoxGeometry(w, h, d, seg, Math.min(rad, w / 2.01, h / 2.01, d / 2.01));
    const cyl = (r1, r2, h, seg = 16, hs = 1, open = false) => new T.CylinderGeometry(r1, r2, h, seg, hs, open);
    const sph = (rad, ws = 16, hs = 12) => new T.SphereGeometry(rad, ws, hs);

    // ============================================================ distance fields: road, Nile
    const G0X = FR.x0 - 8, G0Z = FR.z0 - 8, GW = FR.x1 - FR.x0 + 17, GH = FR.z1 - FR.z0 + 17;
    const RD = new Float32Array(GW * GH).fill(40);
    for (let i = 0; i < track.N; i += 2) {
      const x = track.x[i], z = track.z[i], hw = track.w[i] / 2, R = hw + 16;
      const gx0 = Math.max(0, Math.floor(x - R - G0X)), gx1 = Math.min(GW - 1, Math.ceil(x + R - G0X));
      const gz0 = Math.max(0, Math.floor(z - R - G0Z)), gz1 = Math.min(GH - 1, Math.ceil(z + R - G0Z));
      for (let gz = gz0; gz <= gz1; gz++) {
        const dz = gz + G0Z - z;
        for (let gx = gx0; gx <= gx1; gx++) {
          const dx = gx + G0X - x, d = Math.sqrt(dx * dx + dz * dz) - hw, k = gz * GW + gx;
          if (d < RD[k]) RD[k] = d;
        }
      }
    }
    const field = (F, x, z) => {
      const gx = x - G0X, gz = z - G0Z;
      if (gx < 0 || gz < 0 || gx >= GW - 1 || gz >= GH - 1) return 40;
      const x0 = gx | 0, z0 = gz | 0, fx = gx - x0, fz = gz - z0, k = z0 * GW + x0;
      return (F[k] * (1 - fx) + F[k + 1] * fx) * (1 - fz) + (F[k + GW] * (1 - fx) + F[k + GW + 1] * fx) * fz;
    };
    const roadD = (x, z) => field(RD, x, z);

    // the Nile: from beyond the north board, dead straight across the road at the jump, then winding south to the lake
    const PT = track.at(S_NILE);
    const sg = PT.nz < 0 ? 1 : -1, nNx = PT.nx * sg, nNz = PT.nz * sg; // unit vector pointing north across the road
    const ctrl = [
      [PT.x - 3, FR.z0 - 10], [PT.x - 4, -122], [PT.x + nNx * 22, PT.z + nNz * 22], [PT.x + nNx * 11, PT.z + nNz * 11], [PT.x, PT.z],
      [PT.x - nNx * 11, PT.z - nNz * 11], [PT.x - nNx * 22, PT.z - nNz * 22], [PT.x + 5, -43], [PT.x + 12, -27], [LAKE.x - 6, LAKE.z - 11], [LAKE.x, LAKE.z],
    ];
    const tCurve = new T.CatmullRomCurve3(ctrl.map(([x, z]) => new T.Vector3(x, 0, z)), false, 'centripetal');
    const tPts = tCurve.getSpacedPoints(Math.ceil(tCurve.getLength() / 0.6)).map((v) => [v.x, v.z]);
    const NILE = [];
    {
      let acc = 0;
      for (let i = 0; i < tPts.length; i++) {
        const a = tPts[Math.max(0, i - 1)], b = tPts[Math.min(tPts.length - 1, i + 1)];
        const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
        if (i) acc += Math.hypot(tPts[i][0] - tPts[i - 1][0], tPts[i][1] - tPts[i - 1][1]);
        NILE.push({ x: tPts[i][0], z: tPts[i][1], tx: dx / l, tz: dz / l, nx: -dz / l, nz: dx / l, s: acc });
      }
    }
    const TD = new Float32Array(GW * GH).fill(40);
    for (const f of NILE) {
      const R = 12;
      const gx0 = Math.max(0, Math.floor(f.x - R - G0X)), gx1 = Math.min(GW - 1, Math.ceil(f.x + R - G0X));
      const gz0 = Math.max(0, Math.floor(f.z - R - G0Z)), gz1 = Math.min(GH - 1, Math.ceil(f.z + R - G0Z));
      for (let gz = gz0; gz <= gz1; gz++) for (let gx = gx0; gx <= gx1; gx++) {
        const d = Math.hypot(gx + G0X - f.x, gz + G0Z - f.z), k = gz * GW + gx;
        if (d < TD[k]) TD[k] = d;
      }
    }
    const nileD = (x, z) => field(TD, x, z);
    const lakeR = (th) => LAKE.r * (1 + 0.08 * Math.sin(3 * th + 1) + 0.05 * Math.sin(5 * th + 2));
    const lakeF = (x, z) => Math.hypot(x - LAKE.x, z - LAKE.z) / lakeR(Math.atan2(z - LAKE.z, x - LAKE.x)); // < 1 inside the water

    // ============================================================ the sand surface
    // kid's footprints pressed into the sand: [x, z, heading, left/right]
    const FOOT = [];
    {
      let x = 26, z = 92, a = -0.95;
      for (let i = 0; i < 5; i++) { FOOT.push([x + Math.cos(a + PI / 2) * 5 * (i % 2 ? 1 : -1), z + Math.sin(a + PI / 2) * 5 * (i % 2 ? 1 : -1), a, i % 2]); x += Math.cos(a) * 15; z += Math.sin(a) * 15; a += 0.08; }
      x = -118; z = -128; a = 0.12;
      for (let i = 0; i < 4; i++) { FOOT.push([x + Math.cos(a + PI / 2) * 5 * (i % 2 ? 1 : -1), z + Math.sin(a + PI / 2) * 5 * (i % 2 ? 1 : -1), a, i % 2]); x += Math.cos(a) * 15; z += Math.sin(a) * 15; }
    }
    const footIn = (x, z) => {
      let d = 0;
      for (const [fx, fz, fa] of FOOT) {
        const dx = x - fx, dz = z - fz;
        if (dx * dx + dz * dz > 160) continue;
        const a = dx * Math.cos(fa) + dz * Math.sin(fa), b = -dx * Math.sin(fa) + dz * Math.cos(fa);
        const fore = ((a - 3) / 6) ** 2 + (b / 4.2) ** 2, heel = ((a + 5.5) / 3.6) ** 2 + (b / 3.2) ** 2;
        d = Math.max(d, 1 - ss(0.55, 1, Math.min(fore, heel)));
      }
      return d;
    };
    // flat spots under the big moulded things: [x, z, radius]
    const FLAT = [...PYR.map((p) => [p.x, p.z, p.b * 1.25]), [SPH.x, SPH.z, 15], [-4, 27, 9], [88, 62, 11], [CAN.x, CAN.z, 11], [-88, 80, 7], [CAR.x, CAR.zN, 5], [CAR.x, CAR.zS, 5]];
    const Hs = (x, z) => {
      let h = (n1(x, z, 0.035) - 0.5) * 1.5 + (n2(x, z, 0.1) - 0.5) * 0.45;
      const dw = Math.min(x - FR.x0, FR.x1 - x, z - FR.z0, FR.z1 - z);
      h += 1.2 * (1 - ss(0, 7, dw)); // sand banked up against the boards
      h *= ss(1.5, 8, roadD(x, z));
      for (const [fx, fz, fr] of FLAT) { const d = Math.hypot(x - fx, z - fz); if (d < fr + 6) h *= ss(fr, fr + 6, d); }
      const td = nileD(x, z);
      if (td < 7.2) h = h * ss(6.4, 7.2, td) - 0.4 * (1 - ss(6.0, 6.8, td));
      const lf = lakeF(x, z);
      if (lf < 1.45) h = h * ss(1.32, 1.45, lf) - 0.4 * (1 - ss(1.26, 1.33, lf));
      h -= 0.38 * footIn(x, z);
      return h;
    };

    // ---- big colour map of the sandpit (macro), painted at half size, details drawn on top
    const MW = 1024, SZ = FR.x1 - FR.x0; // the sand is square: 264 x 264
    const mpx = (x) => (x - FR.x0) / SZ * MW, mpy = (z) => (z - FR.z0) / SZ * MW;
    const macroLo = TX.paint(512, 512, (px, py, u, v, o) => {
      const x = FR.x0 + u * SZ, z = FR.z0 + v * SZ;
      const a = n1(x, z, 0.05), b = n1(x, z, 0.012, 300), c = n2(x, z, 0.16);
      const t = (a - 0.5) * 1.5 + (b - 0.5) * 1.2 + (c - 0.5) * 0.5;
      let R = 229 + t * 24, G = 199 + t * 22, B = 143 + t * 20;
      const wet = Math.max(1 - ss(4.5, 13, nileD(x, z)), 1 - ss(1.1, 1.75, lakeF(x, z))) * 0.8;
      R = lerp(R, 168, wet); G = lerp(G, 134, wet); B = lerp(B, 92, wet);
      const dw = Math.min(x - FR.x0, FR.x1 - x, z - FR.z0, FR.z1 - z);
      const edge = (1 - ss(0, 5, dw)) * 0.12;
      o[0] = R * (1 - edge); o[1] = G * (1 - edge); o[2] = B * (1 - edge);
    });
    const macroC = TX.makeCanvas(MW, MW);
    {
      const g = macroC.getContext('2d'), rr = K.rng(91), sc = MW / SZ;
      g.imageSmoothingEnabled = true; g.drawImage(macroLo, 0, 0, MW, MW);
      const blob = (x, z, rad, col0, col1) => {
        const gr = g.createRadialGradient(mpx(x), mpy(z), 0, mpx(x), mpy(z), rad * sc);
        gr.addColorStop(0, col0); gr.addColorStop(1, col1);
        g.fillStyle = gr; g.beginPath(); g.arc(mpx(x), mpy(z), rad * sc, 0, TAU); g.fill();
      };
      // damp, darker sand round the bases of the moulded things (the kids wetted it to make it hold)
      for (const p of PYR) blob(p.x, p.z, p.b * 1.55, 'rgba(120,88,50,0.42)', 'rgba(120,88,50,0)');
      blob(SPH.x, SPH.z, 17, 'rgba(120,88,50,0.32)', 'rgba(120,88,50,0)');
      blob(-4, 27, 11, 'rgba(120,88,50,0.32)', 'rgba(120,88,50,0)');
      blob(CAN.x, CAN.z + 6, 14, 'rgba(96,66,36,0.45)', 'rgba(96,66,36,0)');
      // rake marks: sets of parallel grooves dragged in gentle curves
      const rake = (x, z, a, len, bend) => {
        for (let k = 0; k < 7; k++) {
          const off = (k - 3) * 1.25;
          g.strokeStyle = 'rgba(150,112,66,0.38)'; g.lineWidth = 0.45 * sc;
          g.beginPath();
          for (let i = 0; i <= 30; i++) {
            const t = i / 30, aa = a + bend * (t - 0.5);
            const px = x + Math.cos(a) * (t - 0.5) * len - Math.sin(aa) * off, pz = z + Math.sin(a) * (t - 0.5) * len + Math.cos(aa) * off;
            if (i) g.lineTo(mpx(px), mpy(pz)); else g.moveTo(mpx(px), mpy(pz));
          }
          g.stroke();
          g.strokeStyle = 'rgba(255,240,205,0.32)'; g.lineWidth = 0.3 * sc;
          g.save(); g.translate(-0.35 * sc, -0.35 * sc); g.stroke(); g.restore();
        }
      };
      rake(-58, 76, 0.1, 44, 0.5); rake(-30, 82, -0.2, 30, -0.4); rake(-75, -118, 0.05, 60, 0.3); rake(-100, -100, 1.3, 28, 0.2);
      rake(78, -112, -0.3, 40, 0.5); rake(42, 46, 0.9, 34, -0.3); rake(-70, 28, 0.15, 30, 0.4); rake(80, -38, -1.1, 26, 0.3);
      // footprints: darker pressed soles, a lighter rim of pushed-up sand
      for (const [fx, fz, fa, side] of FOOT) {
        g.save(); g.translate(mpx(fx), mpy(fz)); g.rotate(fa); g.scale(sc, sc);
        g.fillStyle = 'rgba(255,236,196,0.35)';
        g.beginPath(); g.ellipse(3.2, 0, 6.6, 4.8, 0, 0, TAU); g.ellipse(-5.5, 0, 4.1, 3.7, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(140,104,62,0.45)';
        g.beginPath(); g.ellipse(3, 0.3, 5.8, 4, 0, 0, TAU); g.ellipse(-5.5, 0.2, 3.4, 3, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(120,88,52,0.5)';
        for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(9.2 - Math.abs(k - (side ? 1 : 3)) * 0.5, (k - 2) * 1.7, 0.9, 0.75, 0, 0, TAU); g.fill(); }
        g.restore();
      }
      // a toy truck's wheel tracks wandering through the open sand
      g.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        let x = [60, -110, 80, -40][i], z = [70, -98, -20, 74][i], a = [-2.2, 0.2, 1.8, 0.6][i], cv = 0;
        const pts = [];
        for (let k = 0; k < 70; k++) { cv += rr.range(-0.02, 0.02); cv = clamp(cv, -0.06, 0.06); a += cv; x += Math.cos(a) * 0.8; z += Math.sin(a) * 0.8; pts.push([x, z, a]); }
        for (const sd of [-1.1, 1.1]) {
          g.strokeStyle = 'rgba(150,114,70,0.35)'; g.lineWidth = 0.7 * sc;
          g.beginPath();
          pts.forEach(([px, pz, pa], k) => { if (roadD(px, pz) < 2 || nileD(px, pz) < 6) { g.moveTo(mpx(px - Math.sin(pa) * sd), mpy(pz + Math.cos(pa) * sd)); return; } const X = mpx(px - Math.sin(pa) * sd), Z = mpy(pz + Math.cos(pa) * sd); if (k) g.lineTo(X, Z); else g.moveTo(X, Z); });
          g.stroke();
        }
      }
      // grains and tiny grit
      for (let i = 0; i < 9000; i++) {
        const X = rr() * MW, Y = rr() * MW, k = rr();
        g.fillStyle = k < 0.5 ? `rgba(150,112,70,${0.18 + rr() * 0.2})` : k < 0.85 ? `rgba(255,246,220,${0.2 + rr() * 0.25})` : `rgba(110,100,90,${0.25 + rr() * 0.25})`;
        g.fillRect(X, Y, 1 + rr() * 1.4, 1 + rr() * 1.4);
      }
    }
    const macroTex = TX.toTexture(macroC, { wrap: false });
    const grain = TX.mottledTextures({ size: 256, a: 0x808080, b: 0x767676, seed: 7, period: 32, bump: 2.4, speck: 0.35 });
    const sandN = grain.normalMap; sandN.repeat.set(SZ / 7, SZ / 7);
    const terrainMat = K.std({ map: macroTex, normalMap: sandN, normalScale: V2(0.75), vertexColors: true, roughness: 0.96 });
    // tiled sand for the moulded and dug shapes (pyramids, sphinx, ramp, ridges, the Nile's banks): vertex colours tint it
    const st = TX.mottledTextures({ size: 256, a: 0xe8d1a2, b: 0xdcc394, seed: 13, period: 32, bump: 2.0, speck: 0.16 });
    const sandMat = K.std({ map: st.map, normalMap: st.normalMap, normalScale: V2(0.85), vertexColors: true, roughness: 0.95 });

    // ---- terrain mesh: one height grid, cut out where the Nile and the lake are dug, chunked for culling
    {
      const RES = 1.5, NX = Math.round(SZ / RES), NZ = Math.round((FR.z1 - FR.z0) / RES);
      const nx = NX + 1, nz = NZ + 1;
      const HG = new Float32Array(nx * nz), CUT = new Uint8Array(nx * nz);
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
        const x = FR.x0 + i * RES, z = FR.z0 + j * RES;
        HG[j * nx + i] = Hs(x, z);
        CUT[j * nx + i] = nileD(x, z) < 5.4 || lakeF(x, z) < 1.18 ? 1 : 0;
      }
      const CH = 4;
      for (let a = 0; a < CH; a++) for (let b = 0; b < CH; b++) {
        const i0 = Math.round(NX * a / CH), i1 = Math.round(NX * (a + 1) / CH), j0 = Math.round(NZ * b / CH), j1 = Math.round(NZ * (b + 1) / CH);
        const w = i1 - i0 + 1, hgt = j1 - j0 + 1;
        const pos = new Float32Array(w * hgt * 3), nrm = new Float32Array(w * hgt * 3), col = new Float32Array(w * hgt * 3), uv = new Float32Array(w * hgt * 2);
        for (let j = 0; j < hgt; j++) for (let i = 0; i < w; i++) {
          const gi = i0 + i, gj = j0 + j, k = gj * nx + gi, o = j * w + i;
          const x = FR.x0 + gi * RES, z = FR.z0 + gj * RES, h = HG[k];
          pos[o * 3] = x; pos[o * 3 + 1] = h; pos[o * 3 + 2] = z;
          const il = Math.max(0, gi - 1), ir = Math.min(nx - 1, gi + 1), jd = Math.max(0, gj - 1), ju = Math.min(nz - 1, gj + 1);
          const dhx = (HG[gj * nx + ir] - HG[gj * nx + il]) / ((ir - il) * RES), dhz = (HG[ju * nx + gi] - HG[jd * nx + gi]) / ((ju - jd) * RES);
          const l = Math.hypot(dhx, 1, dhz);
          nrm[o * 3] = -dhx / l; nrm[o * 3 + 1] = 1 / l; nrm[o * 3 + 2] = -dhz / l;
          const k2 = clamp(1 + h * 0.07, 0.86, 1.08);
          col[o * 3] = k2; col[o * 3 + 1] = k2 * 0.995; col[o * 3 + 2] = k2 * 0.985;
          uv[o * 2] = (x - FR.x0) / SZ; uv[o * 2 + 1] = 1 - (z - FR.z0) / SZ;
        }
        const idx = [];
        for (let j = 0; j < hgt - 1; j++) for (let i = 0; i < w - 1; i++) {
          const p = j * w + i, q = p + 1, s2 = p + w, t2 = s2 + 1;
          const k = (j0 + j) * nx + i0 + i;
          if (CUT[k] && CUT[k + 1] && CUT[k + nx] && CUT[k + nx + 1]) continue;
          idx.push(p, s2, q, q, s2, t2);
        }
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('normal', new T.BufferAttribute(nrm, 3));
        g.setAttribute('color', new T.BufferAttribute(col, 3)); g.setAttribute('uv', new T.BufferAttribute(uv, 2));
        g.setIndex(idx); g.computeBoundingSphere();
        const m = new T.Mesh(g, terrainMat); m.castShadow = false; m.receiveShadow = true;
        K.group.add(m);
      }
    }

    // ============================================================ strips along the road and the Nile
    const WHITE = [1, 1, 1];
    // one row per frame {x, z, nx, nz, s}; columns at lateral offsets `cols` (ascending, + = right of travel)
    const strip = (frames, cols, yFn, colFn = null, uvFn = null) => {
      const C = cols.length, R = frames.length;
      const pos = new Float32Array(R * C * 3), uv = new Float32Array(R * C * 2), col = new Float32Array(R * C * 3), idx = [];
      for (let j = 0; j < R; j++) {
        const f = frames[j];
        for (let c = 0; c < C; c++) {
          const lat = cols[c], k = j * C + c;
          pos[k * 3] = f.x + f.nx * lat; pos[k * 3 + 1] = yFn(f, lat, c); pos[k * 3 + 2] = f.z + f.nz * lat;
          if (uvFn) { const q = uvFn(f, lat, c); uv[k * 2] = q[0]; uv[k * 2 + 1] = q[1]; } else { uv[k * 2] = lat / 8; uv[k * 2 + 1] = f.s / 8; }
          const cc = colFn ? colFn(f, lat, c) : WHITE;
          col[k * 3] = cc[0]; col[k * 3 + 1] = cc[1]; col[k * 3 + 2] = cc[2];
        }
      }
      for (let j = 0; j < R - 1; j++) for (let c = 0; c < C - 1; c++) { const a = j * C + c, b = a + 1, d = a + C, e = d + 1; idx.push(a, b, d, b, e, d); }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('uv', new T.BufferAttribute(uv, 2)); g.setAttribute('color', new T.BufferAttribute(col, 3));
      g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
      return g;
    };
    const humpRel = (s) => mod(s - HUMP.s0 + 60, L) - 60;
    const humpY = (s) => {
      const q = humpRel(s);
      if (q <= 0 || q >= HUMP.len + HUMP.lee) return 0;
      if (q <= HUMP.len) return HUMP.h * q / HUMP.len;
      return HUMP.h * (1 + Math.cos(PI * (q - HUMP.len) / HUMP.lee)) / 2;
    };
    const gY = (s, lat) => { const h = humpY(s); return h ? h * (1 - ss(9.5, 13.5, Math.abs(lat))) : 0; };
    // frames along the track from s0 to s1, denser over the hump's lee face
    const trackFrames = (s0, s1, step = 1) => {
      const out = [];
      for (let s = s0; ; ) {
        const p = track.at(s);
        out.push({ x: p.x, z: p.z, nx: p.nx, nz: p.nz, s });
        if (s >= s1) break;
        const q = humpRel(s);
        s = Math.min(s1, s + (q > HUMP.len - 0.6 && q < HUMP.len + HUMP.lee + 0.4 ? 0.2 : q > -1 && q < HUMP.len ? 0.5 : step));
      }
      return out;
    };

    // ---- the road: sand pressed smooth with a toy roller, darker and firmer than the loose sand around it
    const RWID = W + 1.2;
    const vS = L / Math.round(L / 24);
    {
      const RW = 256, RH = 512, hgt = new Float32Array(RW * RH);
      const c = TX.paint(RW, RH, (px, py, u, v, o) => {
        const lat = (u - 0.5) * RWID, sA = (1 - v) * vS, e = RWID / 2 - Math.abs(lat);
        const g0 = bil(NF2, u * 40, v * 256), hn = Math.sin(px * 12.9898 + py * 78.233) * 43758.5453, nn = hn - Math.floor(hn);
        let k = 0.93 + (g0 - 0.5) * 0.22 + (nn - 0.5) * 0.1, h = 0.5 + (nn - 0.5) * 0.3 + (g0 - 0.5) * 0.4;
        // the roller's seam every 6 units and the lap between its two passes
        const seam = Math.exp(-(((mod(sA, 6) - 3) / 0.18) ** 2)) * 0.5;
        const lap = Math.exp(-(((lat + 0.4) / 0.35) ** 2));
        k -= seam * 0.06; h -= seam * 0.4; k += lap * 0.05; h += lap * 0.4;
        // two lanes of buggy tread: dark bands with chevrons
        for (const l0 of [-4.2, -2.0, 2.4, 4.6]) {
          const dl = Math.abs(lat - l0 - Math.sin(sA / vS * TAU * 2 + l0) * 0.25);
          if (dl < 0.5) { const ch = mod(sA * 2.2 + dl * 1.6, 1) < 0.45 ? 1 : 0; k -= 0.03 + ch * 0.03; h -= 0.2 + ch * 0.2; }
        }
        o[0] = 205 * k; o[1] = 166 * k; o[2] = 112 * k;
        o[3] = 255 * ss(0, 0.9, e);
        hgt[py * RW + px] = h;
      });
      const roadTex = TX.toTexture(c), roadN = TX.toTexture(TX.normalFromHeight(hgt, RW, RH, 2.0), { srgb: false });
      const roadMat = K.std({ map: roadTex, normalMap: roadN, normalScale: V2(0.6), roughness: 0.92, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      const cols = []; for (let k = 0; k <= 4; k++) cols.push((k / 4 - 0.5) * RWID);
      // (two runs: the dune band covers the road over the hump)
      const h0 = HUMP.s0 - 0.3 + (HUMP.s0 < S_NILE ? L : 0), h1 = HUMP.s0 + HUMP.len + HUMP.lee + 0.1 + (HUMP.s0 < S_NILE ? L : 0);
      for (const [a, b] of [[S_NILE + 6.4, h0], [h1, S_NILE - 6.4 + L]]) {
        const g = strip(trackFrames(a, b), cols, () => 0.05, null, (f, lat) => [lat / RWID + 0.5, f.s / vS]);
        const m = new T.Mesh(g, roadMat); m.receiveShadow = true; m.renderOrder = 1;
        K.group.add(m);
      }
    }

    // ---- the raked ridge along both road edges (shells and pebbles on its crest, below)
    const BE = [-0.4, 0.3, 0.9, 1.5, 2.1, 2.8, 3.5], BY = [0.0, 0.13, 0.34, 0.44, 0.31, 0.1, -0.03];
    const bermY = (e) => { if (e <= BE[0]) return BY[0]; for (let i = 1; i < BE.length; i++) if (e <= BE[i]) return lerp(BY[i - 1], BY[i], (e - BE[i - 1]) / (BE[i] - BE[i - 1])); return BY[BY.length - 1]; };
    const SKIP = [[JUMP.s0 - 0.8, S_NILE + 6.6]]; // no ridge or shells on the ramp and across the Nile
    {
      const fr = trackFrames(S_NILE + 6.6, JUMP.s0 - 0.8 + L);
      const dry = [1.04, 1.02, 0.98], mid = [0.95, 0.92, 0.87];
      for (const side of [-1, 1]) {
        const es = side > 0 ? BE : [...BE].reverse(), cols = es.map((e) => side * (W / 2 + e));
        const g = strip(fr, cols, (f, lat) => bermY(Math.abs(lat) - W / 2) + gY(f.s, lat), (f, lat) => (Math.abs(Math.abs(lat) - W / 2 - 1.5) < 0.7 ? dry : mid));
        put(g, null, {}, sandMat, false);
      }
    }
    // ---- the dune hump's flanks outside the road
    {
      const fr = trackFrames(HUMP.s0 - 1, HUMP.s0 + HUMP.len + HUMP.lee + 0.6, 0.5);
      for (const side of [-1, 1]) {
        const ls = [7.6, 8.4, 9.5, 10.5, 11.5, 12.5, 13.5, 14.2], cols = (side > 0 ? ls : [...ls].reverse()).map((l) => side * l);
        put(strip(fr, cols, (f, lat) => gY(f.s, lat) * (Math.abs(lat) > 13.9 ? 0 : 1) - 0.02, () => [1.02, 0.99, 0.93]), null, {}, sandMat, true);
      }
      const fr2 = trackFrames(HUMP.s0 - 0.6, HUMP.s0 + HUMP.len + HUMP.lee + 0.3, 0.5);
      const cols = []; for (let k = 0; k <= 8; k++) cols.push(-8.3 + k * (16.6 / 8));
      put(strip(fr2, cols, (f, lat) => gY(f.s, lat) + 0.08 + (n1(f.x * 4, f.z * 4, 0.5) - 0.5) * 0.06, (f) => {
        const q = humpRel(f.s), k = q < 0 ? 0.88 : q < HUMP.len ? 0.94 + 0.1 * (q / HUMP.len) : 0.8;
        return [k, k * 0.95, k * 0.86];
      }), null, {}, sandMat, false);
      const p = track.at(HUMP.s0 + HUMP.len / 2);
      K.ramp(p.x, p.z, p.angle, HUMP.len, 26, HUMP.h, 0);
    }

    const shells = [], pebbles = [];
    const plasticV = K.phys({ vertexColors: true, roughness: 0.38, clearcoat: 0.45, clearcoatRoughness: 0.3 });
    // ---- start / finish: a strip of chequered paper held down with pebbles, two lolly-stick flags
    const lollyMat = K.std({ vertexColors: true, roughness: 0.78 });
    const atlas = canvas(512, 256, (g) => {
      // [0,0]-[256,128] chequered flag; [256,0]-[512,128] the NILE sign; [0,128]-[256,256] gold pennant; [256,128]-[512,256] SPHINX sign
      for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#1c1c1c' : '#f6f2e6'; g.fillRect(x * 32, y * 32, 32, 32); }
      for (const [x0, y0, word, col] of [[256, 0, 'NILE', '#1d4fa8'], [256, 128, 'SPHINX', '#a8341d']]) {
        g.fillStyle = '#f4ecd8'; g.fillRect(x0 + 4, y0 + 8, 248, 112);
        g.strokeStyle = 'rgba(120,100,70,0.5)'; g.lineWidth = 3; g.strokeRect(x0 + 6, y0 + 10, 244, 108);
        g.fillStyle = col; g.font = '700 64px "Lilita One", "Comic Sans MS", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.save(); g.translate(x0 + 128, y0 + 66); g.rotate(-0.06); g.fillText(word, 0, 0); g.restore();
        if (word === 'NILE') { g.strokeStyle = col; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0 + 30, y0 + 104); g.quadraticCurveTo(x0 + 80, y0 + 92, x0 + 130, y0 + 104); g.quadraticCurveTo(x0 + 180, y0 + 116, x0 + 226, y0 + 102); g.stroke(); }
      }
      g.fillStyle = '#e2b02c'; g.beginPath(); g.moveTo(0, 136); g.lineTo(250, 192); g.lineTo(0, 248); g.closePath(); g.fill();
      g.fillStyle = '#1d4fa8'; g.beginPath(); g.moveTo(0, 168); g.lineTo(110, 192); g.lineTo(0, 216); g.closePath(); g.fill();
    });
    const paperMat = K.std({ map: TX.toTexture(atlas, { wrap: false }), roughness: 0.85, side: T.DoubleSide, alphaTest: 0.5 });
    const paperParts = [];
    const paper = (w, h, reg, M) => {
      const g = new T.PlaneGeometry(w, h, 4, 1);
      const uv = g.attributes.uv, [u0, v0, u1, v1] = reg;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, lerp(u0, u1, uv.getX(i)), lerp(v0, v1, uv.getY(i)));
      const p = g.attributes.position; // a slight wave in the paper
      for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getX(i) / w + 0.5) * PI * 1.5) * 0.12 * w);
      g.computeVertexNormals();
      paperParts.push(prep(g, 0xffffff, M));
    };
    const REG = { cheq: [0, 0.5, 0.5, 1], nile: [0.5, 0.5, 1, 1], pennant: [0, 0, 0.5, 0.5], sphinx: [0.5, 0, 1, 0.5] };
    // a lolly stick standing in the sand with a paper flag or sign at its top
    const lollyGeo = rbox(1.0, 11, 0.24, 0.12, 2);
    const flagPost = (x, z, ang, reg, fw, fh, hgt = 9, lean = 0.06) => {
      const y0 = Hs(x, z) - 2;
      const M = mtx({ x, y: y0, z, ry: ang, rz: lean });
      putM(lollyGeo, 0xdcbf8a, M.clone().multiply(mtx({ y: hgt / 2 + 0.5, sy: (hgt + 1) / 11 })), lollyMat);
      if (reg === REG.nile || reg === REG.sphinx) paper(fw, fh, reg, M.clone().multiply(mtx({ y: hgt - fh / 2, z: 0.16 })));
      else paper(fw, fh, reg, M.clone().multiply(mtx({ x: fw / 2 + 0.5, y: hgt - fh / 2 + 0.2 })));
      AO(x, z, 1.2, 1.2, 0.3);
    };
    {
      const p = track.at(START);
      const M = new T.Matrix4().compose(_v.set(p.x, 0.09, p.z), _q.setFromEuler(_e.set(-PI / 2, -p.angle + PI / 2, 0, 'YXZ')), _s.set(1, 1, 1));
      const cq = canvas(256, 32, (cg) => { for (let y = 0; y < 2; y++) for (let x = 0; x < 16; x++) { cg.fillStyle = (x + y) % 2 ? '#1c1c1c' : '#f6f2e6'; cg.fillRect(x * 16, y * 16, 16, 16); } });
      const lineMat = K.std({ map: TX.toTexture(cq, { wrap: false }), roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
      const g2 = new T.PlaneGeometry(W + 0.6, 2.4, 8, 1);
      const pp = g2.attributes.position; for (let i = 0; i < pp.count; i++) pp.setZ(i, Math.sin(pp.getX(i) * 0.9) * 0.03);
      const line = new T.Mesh(g2, lineMat); line.applyMatrix4(M); line.receiveShadow = true; K.group.add(line);
      for (const sd of [-1, 1]) {
        const q = track.place(START, sd * (W / 2 + 0.5));
        pebbles.push({ x: q.x, y: 0.3, z: q.z, s: 0.8, ry: r() * 6, color: 0x8a8580 });
        const f = track.place(START, sd * (W / 2 + 3.6));
        flagPost(f.x, f.z, -p.angle + (sd > 0 ? 0.3 : -0.3), REG.cheq, 5.5, 3.6, 8.5, sd * 0.05);
      }
    }

    // ============================================================ shells and pebbles: the road edges and fine scatter
    const shellCols = [0xf6efe2, 0xf2d4c4, 0xeadcc2, 0xfbf7ef, 0xe8c7b0, 0xf4e6cf];
    const pebCols = [0x8a8580, 0x6e6a66, 0xb2aa9a, 0xd8d2c6, 0x9a7a5e, 0xc6b49a];
    const skipS = (s) => SKIP.some(([a, b]) => mod(s - a, L) < b - a);
    for (const side of [-1, 1]) {
      for (const p of track.edgePoints(side, 2.15, 1.5)) {
        if (skipS(p.s)) continue;
        const j = r.range(-0.35, 0.35), x = p.x - Math.sin(p.angle) * j * side, z = p.z + Math.cos(p.angle) * j * side;
        const y = bermY(1.5 + j) + gY(p.s, W / 2 + 1.5) + 0.12;
        if (r() < 0.55) shells.push({ x, y, z, ry: r() * TAU, rx: r.range(-0.2, 0.2), rz: r.range(-0.2, 0.2), s: r.range(0.75, 1.15), color: r.pick(shellCols) });
        else pebbles.push({ x, y: y + 0.05, z, ry: r() * TAU, rx: r() * 3, s: r.range(0.55, 0.95), color: r.pick(pebCols) });
      }
    }
    // loose shells, pebbles and dry sand crumbs in the open sand
    const crumbs = [];
    {
      const nS = low ? 90 : 190;
      for (let i = 0; i < nS * 3 && shells.length + pebbles.length < 900 + nS; i++) {
        const x = r.range(FR.x0 + 4, FR.x1 - 4), z = r.range(FR.z0 + 4, FR.z1 - 4);
        if (roadD(x, z) < 4 || nileD(x, z) < 7 || lakeF(x, z) < 1.4) continue;
        const y = Hs(x, z);
        if (r() < 0.45) shells.push({ x, y: y + 0.1, z, ry: r() * TAU, rx: r.range(-0.3, 0.3), s: r.range(0.6, 1.4), color: r.pick(shellCols) });
        else pebbles.push({ x, y: y + 0.12, z, ry: r() * TAU, rx: r() * 3, s: r.range(0.4, 1.2), color: r.pick(pebCols) });
      }
      const centres = [...PYR.map((p) => [p.x, p.z, p.b * 1.15]), [SPH.x, SPH.z, 14], [-4, 27, 8], [88, 62, 10], [-88, 80, 6]];
      for (const [cx, cz, rad] of centres) {
        for (let i = 0; i < (low ? 14 : 30); i++) {
          const a = r() * TAU, d = rad * r.range(0.85, 1.35), x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
          if (roadD(x, z) < 2) continue;
          crumbs.push({ x, y: Hs(x, z) + 0.15, z, s: r.range(0.25, 0.75), ry: r() * 6, rx: r() * 6, color: r.pick([0xf0dcb4, 0xe0c69a, 0xfaecd0, 0xcfb084]) });
        }
      }
    }

    // ============================================================ the Nile: trench, water, lake, holes
    const waterN = TX.mottledTextures({ size: 256, a: 0x808080, b: 0x707070, seed: 31, period: 8, bump: 1.4 }).normalMap;
    waterN.repeat.set(0.12, 0.12);
    const waterMat = K.phys({ color: 0x2f98bd, roughness: 0.05, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity: 0.86, normalMap: waterN, normalScale: V2(0.3), envMapIntensity: 1.3 });
    A.waterN = waterN;
    const WL = -1.0; // water level
    {
      const TE = [-6.8, -5.4, -4.5, -3.95, -3.5, -2.6, -1.2, 0, 1.2, 2.6, 3.5, 3.95, 4.5, 5.4, 6.8];
      const TY = [-0.05, 0.26, 0.22, -0.45, -1.35, -2.05, -2.4, -2.5, -2.4, -2.05, -1.35, -0.45, 0.22, 0.26, -0.05];
      const inFrame = (f) => f.z > FR.z0 - 3;
      const bankFr = NILE.filter((f) => inFrame(f) && lakeF(f.x, f.z) > 0.55);
      const wetC = (f, lat) => { const a = Math.abs(lat); const k = a < 3.6 ? 0.55 : a < 4.6 ? 0.74 : 0.9; return [k, k * 0.93, k * 0.84]; };
      put(strip(bankFr, TE, (f, lat, c) => TY[c] + (c > 0 && c < TE.length - 1 ? (n1(f.x, f.z, 0.6, c * 7) - 0.5) * 0.18 : 0), wetC), null, {}, sandMat, false);
      const waterFr = NILE.filter((f) => inFrame(f) && lakeF(f.x, f.z) > 0.97);
      const wg = strip(waterFr, [-3.9, 0, 3.9], () => WL, null, (f, lat) => [(f.x + f.nx * lat) / 10, -(f.z + f.nz * lat) / 10]);
      const wm = new T.Mesh(wg, waterMat); wm.receiveShadow = true; K.group.add(wm);
      // the lake: banks as a ring, a water disc
      const RF = [0, 0.45, 0.8, 0.93, 1.0, 1.08, 1.2, 1.3], RYk = [-2.6, -2.5, -2.2, -1.5, -0.8, 0.0, 0.22, -0.05];
      const NA = 72, pos = [], col = [], uv = [], idx = [];
      for (let i = 0; i <= NA; i++) {
        const th = (i / NA) * TAU, R = lakeR(th);
        RF.forEach((f, j) => {
          const x = LAKE.x + Math.cos(th) * R * f, z = LAKE.z + Math.sin(th) * R * f;
          pos.push(x, RYk[j] + (j > 2 && j < 7 ? (n1(x, z, 0.6) - 0.5) * 0.15 : 0), z);
          const k = f < 1.02 ? 0.55 : f < 1.15 ? 0.76 : 0.9; col.push(k, k * 0.93, k * 0.84); uv.push(x / 8, z / 8);
        });
      }
      const C = RF.length;
      for (let i = 0; i < NA; i++) for (let j = 0; j < C - 1; j++) { const a = i * C + j, b = a + 1, c = a + C, d = c + 1; idx.push(a, c, b, b, c, d); }
      const lg = new T.BufferGeometry();
      lg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); lg.setAttribute('color', new T.Float32BufferAttribute(col, 3)); lg.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      lg.setIndex(idx); lg.computeVertexNormals();
      put(lg, null, {}, sandMat, false);
      const sh = new T.Shape();
      for (let i = 0; i <= 64; i++) { const th = (i / 64) * TAU, R = lakeR(th) * 0.985, x = LAKE.x + Math.cos(th) * R, z = LAKE.z + Math.sin(th) * R; if (i) sh.lineTo(x, -z); else sh.moveTo(x, -z); }
      const dg = new T.ShapeGeometry(sh, 16); dg.rotateX(-PI / 2);
      const duv = dg.attributes.uv, dp = dg.attributes.position; for (let i = 0; i < duv.count; i++) duv.setXY(i, dp.getX(i) / 10, -dp.getZ(i) / 10);
      const dm = new T.Mesh(dg, waterMat); dm.position.y = WL; dm.receiveShadow = true; K.group.add(dm);
      // holes: rectangles along the trench (to the lake), the lake itself
      const hf = NILE.filter((f) => f.z > FR.z0 + 1 && lakeF(f.x, f.z) > 0.9);
      for (let i = 0; i + 1 < hf.length; i += 6) {
        const a = hf[i], b = hf[Math.min(hf.length - 1, i + 6)];
        const len = Math.hypot(b.x - a.x, b.z - a.z);
        K.trapdoor((a.x + b.x) / 2, (a.z + b.z) / 2, len / 2 + 0.4, JUMP.hw, Math.atan2(b.z - a.z, b.x - a.x), true);
      }
      let rmin = Infinity; for (let i = 0; i < 64; i++) rmin = Math.min(rmin, lakeR((i / 64) * TAU));
      K.hole(LAKE.x, LAKE.z, rmin * 0.97);
    }

    flagPost(PT.x - 9, PT.z + nNz * 23, 0.1, REG.nile, 6.4, 3.2, 8.5, 0.03);

    // ============================================================ the jump: a ramp of packed sand, the spade beside it
    {
      const pc = track.at(JUMP.s0 + JUMP.len / 2), ca = Math.cos(pc.angle), sa = Math.sin(pc.angle);
      K.ramp(pc.x, pc.z, pc.angle, JUMP.len, JUMP.wid, JUMP.h, 0);
      const fr = [];
      for (let a = -JUMP.len / 2 - 0.4; a <= JUMP.len / 2 + 1.61; a += 0.4) fr.push({ x: pc.x + ca * a, z: pc.z + sa * a, nx: -sa, nz: ca, s: a });
      const cols = [-14, -13, -12.2, -11.4, -10.6, -8, -5, -2, 0, 2, 5, 8, 10.6, 11.4, 12.2, 13, 14];
      const top = (a) => (a < -JUMP.len / 2 ? 0.0 : a <= JUMP.len / 2 ? JUMP.h * (a + JUMP.len / 2) / JUMP.len + 0.05 : (JUMP.h + 0.05) * (1 - ss(0, 1.6, a - JUMP.len / 2)));
      const side = (lat) => 1 - ss(10.8, 14, Math.abs(lat));
      const g = strip(fr, cols, (f, lat) => {
        const y = top(f.s) * side(lat);
        return y > 0.02 ? y + (n1(f.x * 3, f.z * 3, 0.5) - 0.5) * 0.08 : y - 0.02;
      }, (f, lat) => { const k = 0.6 + 0.26 * clamp((f.s + JUMP.len / 2) / JUMP.len, 0, 1) + (n2(f.x * 4, f.z * 4, 0.4) - 0.5) * 0.1 + (Math.abs(lat) > 11 ? 0.1 : 0) + (f.s > JUMP.len / 2 - 0.5 ? 0.1 : 0); return [k, k * 0.86, k * 0.7]; });
      put(g, null, {}, sandMat, true);
      AO(pc.x + ca * 2, pc.z + sa * 2, 9, 13, 0.25, pc.angle);
      // three chevrons drawn into the ramp with a finger: this way, and up
      const cc = canvas(256, 256, (cg) => {
        cg.lineCap = 'round'; cg.lineJoin = 'round';
        for (let k = 0; k < 3; k++) {
          const x0 = 50 + k * 62;
          for (const [col, w, o] of [['rgba(255,240,205,0.55)', 13, -3], ['rgba(96,64,34,0.6)', 10, 2]]) {
            cg.strokeStyle = col; cg.lineWidth = w; cg.beginPath(); cg.moveTo(x0 + o, 40 + o); cg.lineTo(x0 + 52 + o, 128 + o); cg.lineTo(x0 + o, 216 + o); cg.stroke();
          }
        }
      });
      const chev = new T.PlaneGeometry(JUMP.len * 0.82, 10, 1, 1); chev.rotateX(-PI / 2);
      const cm = new T.Mesh(chev, K.std({ map: TX.toTexture(cc, { wrap: false }), transparent: true, depthWrite: false, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
      cm.position.set(pc.x, JUMP.h / 2 + 0.1, pc.z); cm.rotation.order = 'YZX'; cm.rotation.y = -pc.angle; cm.rotation.z = Math.atan2(JUMP.h, JUMP.len);
      cm.receiveShadow = true; K.group.add(cm);
      // the plastic spade that shaped it, lying on the north side
      const sp = track.place(JUMP.s0 - 11.5, sg * 18);
      const spadeParts = [];
      const blade = new T.Shape();
      blade.moveTo(-4.2, -0.2); blade.lineTo(4.2, -0.2); blade.lineTo(4.4, 6.4); blade.quadraticCurveTo(0, 10.2, -4.4, 6.4); blade.closePath();
      const bg = new T.ExtrudeGeometry(blade, { depth: 0.35, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.15, bevelSegments: 2, curveSegments: 10 });
      bg.rotateX(-PI / 2); bg.rotateY(-PI / 2);
      spadeParts.push([bg, 0xd8352a, { x: 9.6, y: 0.35 }]);
      spadeParts.push([cyl(0.7, 0.7, 19, 12), 0x2a62c4, { x: 0, y: 0.75, rz: PI / 2 }]);
      spadeParts.push([rbox(1.6, 1.3, 5.6, 0.5), 0x2a62c4, { x: -9.8, y: 0.75 }]);
      spadeParts.push([cyl(1.0, 0.75, 2.4, 12), 0xd8352a, { x: 9.6, y: 0.75, rz: PI / 2 }]);
      const sa2 = pc.angle - 0.06 * sg;
      putGroup(spadeParts, { x: sp.x, y: 0.05, z: sp.z, ry: -sa2 }, plasticV);
      K.capsule(sp.x - Math.cos(sa2) * 10, sp.z - Math.sin(sa2) * 10, sp.x + Math.cos(sa2) * 19, sp.z + Math.sin(sa2) * 19, 1.4, 1.6);
      AO(sp.x + Math.cos(sa2) * 5, sp.z + Math.sin(sa2) * 5, 16, 4, 0.3, sa2);
    }

    // ============================================================ moulded sand: pyramids, sphinx, castles
    const crumble = (x, y, z) => Math.sin(x * 1.7 + y * 0.9) * Math.sin(z * 1.3 - y * 1.1) + Math.sin(x * 0.53 + z * 0.71 + y * 2.3) * 0.5;
    const pyramidGeo = (B, H, N, dent) => {
      const prof = [];
      for (let i = 0; i < N; i++) {
        const s0 = B * (1 - i / N), s1 = B * (1 - (i + 1) / N), y0 = H * i / N, y1 = H * (i + 1) / N;
        prof.push([s0, y0], [s0 - (s0 - s1) * 0.45, y0 + (y1 - y0) * 0.86]);
      }
      prof.push([0, H]);
      const M = 10, pos = [], col = [], uv = [], idx = [];
      for (let f = 0; f < 4; f++) {
        const a = f * PI / 2, ox = Math.cos(a), oz = Math.sin(a), tx = -oz, tz = ox, base = pos.length / 3;
        for (let j = 0; j < prof.length; j++) {
          const [hs, y] = prof[j];
          for (let i = 0; i <= M; i++) {
            const t = -1 + 2 * i / M;
            let x = ox * hs + tx * t * hs, z = oz * hs + tz * t * hs;
            const edge = Math.abs(t) ** 4, cr = crumble(x, y, z);
            let k = 1 - (0.012 + 0.05 * edge + 0.02 * (y / H)) * (0.6 + 0.4 * cr);
            if (dent) k -= 0.2 * Math.exp(-((x - dent[0]) ** 2 + (y - dent[1]) ** 2 + (z - dent[2]) ** 2) / 7);
            x *= k; z *= k;
            pos.push(x, y, z);
            const damp = 1 - ss(0.3, 2.6, y), ledge = j % 2 === 1 ? 0.06 : 0;
            const kk = (0.94 + ledge + cr * 0.025) * (1 - damp * 0.26);
            col.push(kk * 0.98, kk * 0.9, kk * 0.78);
            uv.push((t * hs) / 6 + f * 0.37, y / 6);
          }
        }
        const C = M + 1;
        for (let j = 0; j < prof.length - 1; j++) for (let i = 0; i < M; i++) { const a0 = base + j * C + i, b0 = a0 + 1, c0 = a0 + C, d0 = c0 + 1; idx.push(a0, c0, b0, b0, c0, d0); }
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      return g; // (flat-shaded: prep() computes the normals after un-indexing)
    };
    for (const [i, p] of PYR.entries()) {
      const dent = i === 0 ? [p.b * 0.55, 5.5, p.b * 0.5] : i === 1 ? [-p.b * 0.5, 3, p.b * 0.6] : null;
      put(pyramidGeo(p.b, p.h, p.n, dent), null, { x: p.x, z: p.z, ry: p.ry }, sandMat, true);
      K.box(p.x, p.z, p.b * 0.9, p.b * 0.9, -p.ry, p.h);
      AO(p.x, p.z, p.b * 1.25, p.b * 1.25, 0.45, -p.ry, 0);
      warnRoad('pyramid', p.x, p.z + p.b, 2);
    }
    // a gold paper pennant on the big pyramid
    {
      const p = PYR[0];
      putM(lollyGeo, 0xdcbf8a, mtx({ x: p.x, y: p.h + 2.5, z: p.z, sy: 0.75, rz: 0.04 }), lollyMat);
      paper(4.4, 3.4, REG.pennant, mtx({ x: p.x + 2.7, y: p.h + 5.0, z: p.z, ry: 0.4 }));
    }

    // ---- the sphinx: a lion lying down, facing east, head-cloth stripes pressed in with a fork, pebble eyes
    {
      const parts = [];
      const sandC = (g, k = 0.93, stripes = 0) => {
        const p = g.attributes.position, n = p.count, a = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
          const y = p.getY(i), cr = crumble(p.getX(i) * 2, y * 2, p.getZ(i) * 2) * 0.02;
          const band = stripes ? (Math.floor(y * stripes) % 2 ? 0.84 : 1.04) : 1, damp = 1 - ss(-0.5, 1.6, y) * 1;
          const kk = (k + cr) * band * (1 - damp * 0.16);
          a[i * 3] = kk * 0.98; a[i * 3 + 1] = kk * 0.9; a[i * 3 + 2] = kk * 0.77;
        }
        g.setAttribute('color', new T.BufferAttribute(a, 3));
        const nr = g.attributes.normal, uvA = new Float32Array(n * 2);
        for (let i = 0; i < n; i++) {
          const x = p.getX(i), y = p.getY(i), z = p.getZ(i), ax = Math.abs(nr.getX(i)), ay = Math.abs(nr.getY(i)), az = Math.abs(nr.getZ(i));
          if (ay > ax && ay > az) { uvA[i * 2] = x / 5; uvA[i * 2 + 1] = z / 5; } else if (ax > az) { uvA[i * 2] = z / 5; uvA[i * 2 + 1] = y / 5; } else { uvA[i * 2] = x / 5; uvA[i * 2 + 1] = y / 5; }
        }
        g.setAttribute('uv', new T.BufferAttribute(uvA, 2));
        return g;
      };
      const P = (g, o, k, stripes) => { g.applyMatrix4(mtx(o)); sandC(g, k, stripes); parts.push(g); };
      P(sph(1, 28, 16), { x: -2, y: 2.4, sx: 10, sy: 4.6, sz: 4.7 }, 0.94);
      for (const sd of [-1, 1]) {
        P(sph(1, 18, 12), { x: -9, y: 2.5, z: sd * 2.4, sx: 4.6, sy: 3.9, sz: 2.8 }, 0.94);
        P(rbox(5.2, 1.7, 2.1, 0.8, 3), { x: -6.6, y: 0.7, z: sd * 4.6, ry: sd * 0.1 }, 0.95);
        P(rbox(10.5, 2.2, 2.5, 1.0, 3), { x: 9.4, y: 0.9, z: sd * 2.5 }, 0.95);
        for (let k = 0; k < 3; k++) P(sph(0.55, 10, 8), { x: 14.6, y: 0.6, z: sd * 2.5 + (k - 1) * 0.75 }, 0.88);
        // the head-cloth's lappets falling onto the chest
        P(rbox(1.4, 5.4, 1.8, 0.5, 2), { x: 6.9, y: 6.6, z: sd * 2.85, rz: -0.12 }, 0.95, 1.4);
      }
      P(sph(1, 22, 14), { x: 4.6, y: 3.8, sx: 3.8, sy: 5.4, sz: 4.3 }, 0.95);
      P(cyl(2.3, 2.9, 4.4, 18), { x: 5.4, y: 7.2 }, 0.95);
      P(sph(1, 22, 16), { x: 6.4, y: 10.0, sx: 2.5, sy: 2.9, sz: 2.35 }, 0.97);
      // head-cloth: a flared hood behind the face, ridged where the fork pressed it
      {
        const g = cyl(2.25, 3.9, 5.6, 28, 14);
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const y = p.getY(i), groove = Math.floor((y + 2.8) * 1.45) % 2 ? 0.96 : 1;
          p.setX(i, p.getX(i) * groove); p.setZ(i, p.getZ(i) * groove);
        }
        g.computeVertexNormals();
        P(g, { x: 5.2, y: 9.7, rz: 0.12 }, 0.97, 1.45);
        P(sph(1, 18, 10), { x: 5.0, y: 12.3, sx: 2.6, sy: 1.2, sz: 2.5 }, 0.97, 1.45);
      }
      P(sph(0.62, 10, 8), { x: 8.85, y: 9.5, sx: 0.9, sy: 1.1 }, 0.92); // nose
      P(cyl(0.45, 0.6, 2.2, 10), { x: 8.2, y: 7.3, rz: 0.18 }, 0.93); // beard
      P(cyl(0.3, 0.42, 1.6, 8), { x: 8.0, y: 12.4, rz: -0.35 }, 0.93); // the cobra on the brow
      P(new T.TorusGeometry(2.4, 0.38, 6, 14, PI * 0.8), { x: -9.5, y: 0.35, z: 4.2, rx: PI / 2, rz: 0.4 }, 0.92); // the tail
      const g = BU.mergeGeometries(parts.map((q) => { const t = q.index ? q.toNonIndexed() : q; for (const k of Object.keys(t.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) t.deleteAttribute(k); return t; }), false);
      put(g, null, { x: SPH.x, y: 0, z: SPH.z }, sandMat, true);
      for (const sd of [-1, 1]) pebbles.push({ x: SPH.x + 8.55, y: 10.55, z: SPH.z + sd * 1.0, s: 0.48, sy: 0.4, ry: 0, color: 0x2e2a28 });
      K.capsule(SPH.x - 11, SPH.z, SPH.x + 12.5, SPH.z, 5, 9);
      AO(SPH.x, SPH.z, 17, 8, 0.45, 0, 0);
      flagPost(SPH.x - 14, SPH.z + 6, 0.15, REG.sphinx, 6, 3, 8.5, -0.04);
      warnRoad('sphinx', SPH.x + 14, SPH.z + 5, 2);
    }

    // ---- sand castles: bucket-moulded turrets with crenellations
    const turret = (parts, x, z, rad, h, M0) => {
      const g = cyl(rad * 0.86, rad, h, 18, 4);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const y = p.getY(i), ring = 1 + 0.04 * Math.cos((y / h) * PI * 6); p.setX(i, p.getX(i) * ring); p.setZ(i, p.getZ(i) * ring); }
      g.computeVertexNormals();
      parts.push([g, 0xf2dfc0, { x, y: h / 2, z }]);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU;
        parts.push([rbox(1.0, 1.0, 1.3, 0.2), 0xf8ead2, { x: x + Math.cos(a) * rad * 0.72, y: h + 0.45, z: z + Math.sin(a) * rad * 0.72, ry: -a }]);
      }
    };
    const castle = (cx, cz, sc, plan) => {
      const parts = [];
      for (const [x, z, rad, h] of plan) turret(parts, x, z, rad, h);
      for (let i = 0; i < plan.length - 1; i++) {
        const [x1, z1] = plan[i], [x2, z2] = plan[i + 1], len = Math.hypot(x2 - x1, z2 - z1);
        if (len > 9) continue;
        parts.push([rbox(len, 2.6, 1.6, 0.4), 0xeed8b4, { x: (x1 + x2) / 2, y: 1.3, z: (z1 + z2) / 2, ry: -Math.atan2(z2 - z1, x2 - x1) }]);
      }
      putGroup(parts, { x: cx, y: -0.3, z: cz, s: sc }, sandMat);
      let R = 0; for (const [x, z, rad] of plan) R = Math.max(R, Math.hypot(x, z) + rad);
      AO(cx, cz, R * sc * 1.15, R * sc * 1.15, 0.42, 0, 0);
      return R * sc;
    };
    // the big one inside the S-bend (it also keeps buggies from cutting across the bend)
    { const R = castle(-4, 27, 1.0, [[0, 0, 3.4, 8], [-4.6, -3.6, 2.2, 5.5], [4.4, -3.4, 2.2, 5.2], [4.2, 3.8, 2.1, 5.0], [-4.4, 3.6, 2.2, 5.6]]); K.circle(-4, 27, R - 0.6, 7); }
    { const R = castle(-88, 80, 0.9, [[0, 0, 2.6, 6], [3.6, 2.0, 1.8, 4.2], [-3.4, 2.2, 1.9, 4.6]]); K.circle(-88, 80, R - 0.4, 5); }
    castle(-104, -112, 0.95, [[0, 0, 2.5, 5.5], [4, -1, 1.8, 4], [-3, 3, 1.6, 3.6]]);
    castle(28, 62, 0.85, [[0, 0, 2.4, 5], [3.4, 2.4, 1.7, 3.8]]);
    castle(104, -108, 0.9, [[0, 0, 2.2, 4.8], [-3.6, 1.6, 1.6, 3.4], [2.4, 3.6, 1.5, 3.2]]);

    // ============================================================ plastic toys
    // watering can (turquoise) beside the north straight, its rose dripping into the mud
    {
      const parts = [];
      const body = cyl(5.0, 5.6, 10, 30, 1); body.scale(1.3, 1, 1);
      parts.push([body, 0x1f9e98, { y: 5 }]);
      const capG = new T.SphereGeometry(5.0, 30, 8, 0, TAU, 0, PI / 2); capG.scale(1.3, 0.35, 1);
      parts.push([capG, 0x1f9e98, { y: 10 }]);
      parts.push([cyl(1.8, 1.8, 1.2, 18, 1, true), 0xf0c22e, { x: -3.6, y: 11.6 }]);
      parts.push([new T.TorusGeometry(4.6, 0.75, 8, 22, PI), 0x1f9e98, { x: -0.6, y: 10.6, sx: 1.2 }]);
      parts.push([cyl(0.75, 1.15, 14, 12), 0x1f9e98, { x: 9.5, y: 7.2, rz: -0.95 }]);
      parts.push([cyl(2.1, 1.1, 1.5, 18), 0xf0c22e, { x: 15.4, y: 11.4, rz: -0.95 }]);
      parts.push([cyl(2.15, 2.15, 0.2, 18), 0xd8a820, { x: 16.0, y: 11.85, rz: -0.95 }]);
      const ang = Math.atan2((track.place(MUD.s, MUD.lat).z - CAN.z), (track.place(MUD.s, MUD.lat).x - CAN.x));
      putGroup(parts, { x: CAN.x, y: -0.2, z: CAN.z, ry: -ang }, plasticV);
      K.circle(CAN.x, CAN.z, 7.2, 12);
      AO(CAN.x, CAN.z, 9, 7.5, 0.5, ang, 0);
      A.rose = [CAN.x + Math.cos(ang) * 16, 11, CAN.z + Math.sin(ang) * 16];
      warnRoad('watering can', CAN.x + Math.cos(ang) * 7, CAN.z + Math.sin(ang) * 7, 1);
    }
    // the mud patch where the can was filled and spilt: sticky, on the north half of the road
    {
      const mudT = TX.mottledTextures({ size: 256, a: 0x7e5a36, b: 0x5e4226, c: 0x93704a, seed: 121, period: 6, bump: 1.6, speck: 0.15 });
      mudT.map.repeat.set(0.5, 0.5); mudT.normalMap.repeat.set(0.5, 0.5);
      const mudMat = K.phys({ map: mudT.map, normalMap: mudT.normalMap, normalScale: V2(0.7), roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.25 });
      const q = track.place(MUD.s, MUD.lat);
      const spill = K.spill(q.x, q.z, MUD.r, mudMat, { lump: 0.34, stretch: 1.8, angle: q.angle, y: 0.13, thick: 0.1 });
      K.surface('sticky', { poly: spill.poly });
      const wetMat = K.phys({ color: 0x8a6440, roughness: 0.3, clearcoat: 0.6, transparent: true, opacity: 0.55 });
      const q2 = track.place(MUD.s + 3, MUD.lat + 5);
      K.spill(q2.x, q2.z, 5, wetMat, { lump: 0.4, stretch: 1.4, angle: q.angle + 0.8, y: 0.09, thick: 0.05 });
      for (let i = 1; i < 5; i++) K.spill(lerp(q.x, CAN.x, i / 5) + r.range(-1, 1), lerp(q.z, CAN.z, i / 5) + r.range(-1, 1), r.range(0.6, 1.2), mudMat, { y: Hs(lerp(q.x, CAN.x, i / 5), lerp(q.z, CAN.z, i / 5)) + 0.08, thick: 0.08, n: 16 });
      A.mud = [q.x, q.z];
    }
    // big bucket (lapis blue, a gold band of glyph-like doodles), full of sand, in the east infield
    {
      const bc = canvas(512, 128, (g) => {
        g.fillStyle = '#2251a6'; g.fillRect(0, 0, 512, 128);
        g.fillStyle = '#e4b43a'; g.fillRect(0, 34, 512, 60);
        g.fillStyle = '#2251a6'; g.strokeStyle = '#2251a6'; g.lineWidth = 4; g.lineCap = 'round';
        for (let i = 0; i < 8; i++) {
          const x = 32 + i * 64, y = 64;
          g.save(); g.translate(x, y);
          const kind = i % 4;
          if (kind === 0) { g.beginPath(); g.ellipse(0, 0, 16, 8, 0, 0, TAU); g.stroke(); g.beginPath(); g.arc(0, 0, 4.5, 0, TAU); g.fill(); g.beginPath(); g.moveTo(-4, 8); g.lineTo(-6, 20); g.stroke(); }
          else if (kind === 1) { g.beginPath(); g.ellipse(0, -12, 6, 8, 0, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(0, -4); g.lineTo(0, 22); g.moveTo(-11, 2); g.lineTo(11, 2); g.stroke(); }
          else if (kind === 2) { g.beginPath(); g.ellipse(0, 2, 9, 13, 0, 0, TAU); g.fill(); g.beginPath(); g.moveTo(-9, -6); g.lineTo(-20, -14); g.moveTo(9, -6); g.lineTo(20, -14); g.moveTo(-9, 8); g.lineTo(-20, 16); g.moveTo(9, 8); g.lineTo(20, 16); g.stroke(); g.fillStyle = '#e4b43a'; g.fillRect(-0.8, -10, 1.6, 24); g.fillStyle = '#2251a6'; }
          else { g.beginPath(); g.moveTo(-14, 18); g.lineTo(0, -18); g.lineTo(14, 18); g.closePath(); g.stroke(); g.beginPath(); g.moveTo(-7, 0); g.lineTo(7, 0); g.stroke(); }
          g.restore();
        }
        g.fillStyle = '#e4b43a'; for (let x = 0; x < 512; x += 16) { g.fillRect(x, 12, 8, 6); g.fillRect(x + 8, 110, 8, 6); }
      });
      const bt = TX.toTexture(bc); bt.repeat.set(2, 1);
      const bucketMat = K.phys({ map: bt, roughness: 0.32, clearcoat: 0.5, clearcoatRoughness: 0.25, side: T.DoubleSide });
      const bx = 88, bz = 62;
      const prof = [[6.4, 0], [6.6, 0.4], [7.1, 4], [7.6, 7.5], [8.1, 11], [8.6, 14.2], [9.2, 14.4], [9.2, 15.0], [8.6, 15.0], [8.0, 14.6], [6.1, 0.8], [0, 0.8]];
      const lg = K.lathe(prof, 48), luv = lg.attributes.uv, lp = lg.attributes.position;
      for (let i = 0; i < luv.count; i++) { const j = i % prof.length; luv.setY(i, j <= 5 ? clamp(lp.getY(i) / 14.6, 0.02, 0.96) : 0.99); }
      const bm = K.mesh(lg, bucketMat, bx, -0.2, bz, { ry: 0.6 });
      bm.castShadow = true;
      const sandTop = new T.CircleGeometry(8.2, 40); sandTop.rotateX(-PI / 2);
      const stp = sandTop.attributes.position; for (let i = 0; i < stp.count; i++) { const d = Math.hypot(stp.getX(i), stp.getZ(i)); stp.setY(i, 1.6 * (1 - (d / 8.2) ** 2) + (n1(stp.getX(i) * 3, stp.getZ(i) * 3, 0.5) - 0.5) * 0.4); }
      sandTop.computeVertexNormals();
      put(tint(sandTop, 0xf4e4c8), null, { x: bx, y: 13.6, z: bz }, sandMat, false);
      put(new T.TorusGeometry(9.4, 0.38, 8, 30, PI), 0x2251a6, { x: bx, y: 14.6, z: bz, rx: -1.2, ry: 0.6 }, plasticV);
      K.circle(bx, bz, 9.2, 15);
      AO(bx, bz, 10.5, 10.5, 0.5, 0, 0);
    }
    // the pyramid mould (an orange plastic square cone), tipped over in the north strip
    {
      const prof = [[1.0, 12.4], [11.6, 0], [12.2, 0], [12.2, 0.5], [11.4, 0.5], [0.8, 11.9]];
      const g = K.lathe(prof, 4); g.deleteAttribute('normal');
      put(g, 0xf07a22, { x: -66, y: 5.5, z: -112, rx: 1.15, ry: 0.5, order: 'YXZ' }, plasticV);
      K.circle(-66, -112, 10, 8);
      AO(-66, -112, 12, 10, 0.4, 0.5, 0);
      const pile = sph(1, 16, 8); pile.scale(7, 1.6, 5);
      put(tint(pile, 0xf2e0c0), null, { x: -60, y: -0.4, z: -104, ry: 0.4 }, sandMat, false);
    }
    // a yellow sieve, a toy roller and two plastic star moulds (static) in the open sand
    const sieveMat = (() => {
      const c = canvas(256, 256, (g) => {
        g.fillStyle = '#f2c230'; g.beginPath(); g.arc(128, 128, 126, 0, TAU); g.fill();
        g.globalCompositeOperation = 'destination-out';
        for (let y = 10; y < 256; y += 14) for (let x = 10; x < 256; x += 14) if (Math.hypot(x - 128, y - 128) < 112) { g.beginPath(); g.arc(x, y, 4.5, 0, TAU); g.fill(); }
      });
      return K.phys({ map: TX.toTexture(c, { wrap: false }), alphaTest: 0.5, roughness: 0.35, clearcoat: 0.4, side: T.DoubleSide });
    })();
    {
      const sx = 46, sz = 80;
      const disc = new T.CircleGeometry(7.4, 40); disc.rotateX(-PI / 2);
      const dm = new T.Mesh(disc, sieveMat); dm.position.set(sx, 0.9, sz); dm.rotation.z = 0.05; dm.castShadow = true; dm.receiveShadow = true; K.group.add(dm);
      put(new T.TorusGeometry(7.6, 0.55, 8, 40), 0xf2c230, { x: sx, y: 0.95, z: sz, rx: PI / 2 }, plasticV);
      put(cyl(7.6, 7.9, 1.6, 40, 1, true), 0xf2c230, { x: sx, y: 0.4, z: sz }, plasticV);
      put(rbox(7, 0.6, 2, 0.28), 0xf2c230, { x: sx + 11, y: 0.7, z: sz - 1.5, ry: 0.2 }, plasticV);
      const pile = sph(1, 16, 8); pile.scale(3.2, 0.9, 2.6);
      put(tint(pile, 0xf8ecd4), null, { x: sx - 1.5, y: 1.0, z: sz + 1, ry: 0.3 }, sandMat, false);
      AO(sx, sz, 9, 9, 0.3, 0, 0);
    }
    {
      // wooden toy roller (it pressed the road), parked in the south pocket
      const rx = -14, rz = 80, ra = 0.35, parts = [];
      parts.push([cyl(2.2, 2.2, 8, 24), 0xc89a62, { y: 2.2, rx: PI / 2 }]);
      for (const sd of [-1, 1]) parts.push([cyl(2.35, 2.35, 0.4, 24), 0xa8784a, { y: 2.2, z: sd * 4.1, rx: PI / 2 }]);
      for (const sd of [-1, 1]) parts.push([rbox(9, 0.5, 0.9, 0.2), 0xdcbf8a, { x: 4.6, y: 3.6, z: sd * 4.4, rz: 0.32 }]);
      parts.push([cyl(0.45, 0.45, 9.4, 10), 0xdcbf8a, { x: 8.8, y: 5.0, rx: PI / 2 }]);
      putGroup(parts, { x: rx, z: rz, ry: -ra }, lollyMat);
      K.capsule(rx - Math.sin(ra) * 4.2, rz - Math.cos(ra) * 4.2, rx + Math.sin(ra) * 4.2, rz + Math.cos(ra) * 4.2, 2.4, 4.4);
      AO(rx + 2, rz, 7, 5.5, 0.4, ra, 0);
    }
    // shapes for the sand moulds (also used by the pushable ones)
    const starShape = (R1, R2, n = 5) => { const s = new T.Shape(); for (let i = 0; i <= n * 2; i++) { const a = (i / (n * 2)) * TAU - PI / 2, rad = i % 2 ? R2 : R1; if (i) s.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); else s.moveTo(Math.cos(a) * rad, Math.sin(a) * rad); } return s; };
    const shellShape = (R) => { const s = new T.Shape(); s.moveTo(0, -R * 0.95); for (let i = 0; i <= 12; i++) { const a = PI * 0.15 + (i / 12) * PI * 0.7, rad = R * (1 + 0.07 * Math.cos(i * PI)); s.lineTo(Math.cos(a) * rad * 1.05, Math.sin(a) * rad - R * 0.1); } s.lineTo(R * 0.25, -R * 0.75); s.closePath(); return s; };
    const fishShape = (R) => { const s = new T.Shape(); s.moveTo(R, 0); s.quadraticCurveTo(R * 0.2, R * 0.75, -R * 0.5, 0.05); s.lineTo(-R, R * 0.55); s.lineTo(-R * 0.82, 0); s.lineTo(-R, -R * 0.55); s.lineTo(-R * 0.5, -0.05); s.quadraticCurveTo(R * 0.2, -R * 0.75, R, 0); return s; };
    const mouldGeo = (shape, h = 1.5) => { const g = new T.ExtrudeGeometry(shape, { depth: h, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.3, bevelSegments: 2, curveSegments: 8 }); g.rotateX(-PI / 2); g.translate(0, 0.3, 0); return g; };
    put(mouldGeo(starShape(3.4, 1.6)), 0xd84a8c, { x: 64, y: 0, z: 88, ry: 0.4 }, plasticV);
    put(mouldGeo(shellShape(3)), 0x2fb8a8, { x: -112, y: 0.4, z: -86, ry: 1.2 }, plasticV);
    AO(64, 88, 4, 4, 0.35, 0, 0); AO(-112, -86, 3.6, 3.6, 0.35, 0, 0);
    // pushable: three moulds on the road edges and a small yellow bucket
    {
      const push = [
        [mouldGeo(starShape(2.6, 1.25)), 0x2a62c4, 102, 6.6, 2.3],
        [mouldGeo(shellShape(2.4)), 0xe8508a, 118, -6.8, 2.2],
        [mouldGeo(fishShape(2.8)), 0xf2c230, 466, -6.4, 2.3],
      ];
      for (const [g, c, s, lat, rad] of push) {
        const q = track.place(s, lat);
        const m = new T.Mesh(g, K.phys({ color: c, roughness: 0.32, clearcoat: 0.5, clearcoatRoughness: 0.25 }));
        m.position.set(q.x, 0.02, q.z); m.rotation.y = r() * TAU;
        K.add(m);
        K.physics.addDynamic({ x: q.x, z: q.z, r: rad, m: 0.55, h: 2.0, mesh: m, slide: true, friction: 22, baseY: 0.02 });
      }
      const q = track.place(246, 6.8);
      const bg = new T.Group();
      const bmm = K.phys({ color: 0xf2c230, roughness: 0.32, clearcoat: 0.5, side: T.DoubleSide });
      bg.add(new T.Mesh(K.lathe([[2.0, 0], [2.1, 0.3], [2.7, 4.2], [2.95, 4.3], [2.95, 4.7], [2.6, 4.7], [2.45, 4.4], [1.9, 0.5], [0, 0.5]], 28), bmm));
      const bsand = new T.Mesh(new T.CircleGeometry(2.45, 20), sandMat.clone()); bsand.material.vertexColors = false; bsand.material.color.set(0xf4e4c8);
      bsand.rotation.x = -PI / 2; bsand.position.y = 3.6; bg.add(bsand);
      const hd = new T.Mesh(new T.TorusGeometry(2.8, 0.14, 6, 18, PI), K.phys({ color: 0xd8352a, roughness: 0.35 })); hd.position.y = 4.4; hd.rotation.x = -0.4; bg.add(hd);
      bg.position.set(q.x, 0, q.z);
      K.add(bg);
      K.physics.addDynamic({ x: q.x, z: q.z, r: 2.8, m: 0.8, h: 4.7, mesh: bg, slide: true, friction: 18, baseY: 0 });
    }

    // ============================================================ paper palms, papyrus, lily pads, the felucca
    const leafMat = K.phys({ vertexColors: true, roughness: 0.6, side: T.DoubleSide, clearcoat: 0.15 });
    const palmGeo = (() => {
      const parts = [], H = 15, bend = 2.2, segs = 7;
      for (let i = 0; i < segs; i++) {
        const t0 = i / segs, t1 = (i + 1) / segs, y0 = H * t0, y1 = H * t1, x0 = bend * t0 * t0, x1 = bend * t1 * t1;
        const r0 = 0.78 - 0.32 * t0, r1 = 0.78 - 0.32 * t1;
        const g = cyl(r1 * 1.18, r0 * 0.9, Math.hypot(y1 - y0, x1 - x0) * 1.03, 9, 1);
        g.rotateZ(-Math.atan2(x1 - x0, y1 - y0)); g.translate((x0 + x1) / 2, (y0 + y1) / 2, 0);
        parts.push(prep(g, i % 2 ? 0x8a6238 : 0x74502c));
      }
      for (let k = 0; k < 3; k++) { const g = sph(0.62, 10, 8); g.translate(bend + Math.cos(k * 2.1) * 0.7, H - 0.6, Math.sin(k * 2.1) * 0.7); parts.push(prep(g, 0x5a3a1c)); }
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * TAU + (k % 2) * 0.25, ca = Math.cos(a), sa = Math.sin(a), Lf = 7.4 + (k % 3) * 0.6, lift = 2.4 - (k % 2) * 0.9;
        const pos = [], col = [], idx = [], N = 12;
        for (let i = 0; i <= N; i++) {
          const t = i / N, d = Lf * t, y = H + 0.3 + lift * t - (lift + 3.6) * t * t;
          const w = 1.5 * Math.sin(PI * Math.min(1, t * 1.12 + 0.04)) * (1 - 0.25 * t) * (i % 2 ? 0.8 : 1.05);
          const cx = bend + ca * d, cz = sa * d;
          for (const [lw, dy, cc] of [[-w, -0.35 * w, 0x367a2a], [0, 0.08, 0x74a844], [w, -0.35 * w, 0x438a34]]) {
            pos.push(cx - sa * lw, y + dy, cz + ca * lw);
            _c.set(cc); const tip = t > 0.8 ? 0.85 : 1; col.push(_c.r * tip, _c.g, _c.b * tip);
          }
        }
        for (let i = 0; i < N; i++) for (let j = 0; j < 2; j++) { const a0 = i * 3 + j, b0 = a0 + 1, c0 = a0 + 3, d0 = c0 + 1; idx.push(a0, c0, b0, b0, c0, d0); }
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
        g.setIndex(idx); g.computeVertexNormals();
        parts.push(prep(g, null));
      }
      return BU.mergeGeometries(parts, false);
    })();
    const PALMS = [
      [PT.x - 12, -108], [PT.x + 12, -113], [PT.x - 10, -129], [PT.x + 11, -131],
      [PT.x - 9, -50], [PT.x + 15, -47], [PT.x - 3, -31], [PT.x + 24, -32],
      [LAKE.x - 18, LAKE.z - 7], [LAKE.x + 18, LAKE.z - 9], [LAKE.x - 15, LAKE.z + 15], [LAKE.x + 13, LAKE.z + 17], [LAKE.x + 25, LAKE.z + 4],
      [CAR.x - 14, 36], [CAR.x + 13, 33], [CAR.x - 13, 84], [CAR.x + 14, 81], [CAR.x + 22, 88],
    ];
    {
      const list = [];
      for (const [x, z] of PALMS) {
        const s = r.range(0.85, 1.12), h = 15 * s;
        if (roadD(x, z) < 5) { console.warn(`giza: palm near road ${x},${z}`); continue; }
        // a palm hides the ground just north of it: keep the road clear of that
        for (const [dx, dz] of [[0, 0], [6, 0], [-6, 0], [0, 6], [0, -6]]) if (roadD(x + dx * s, z - h * 0.53 + dz * s) < 0) console.warn(`giza: palm at ${x},${z} hides the road`);
        list.push({ x, y: Hs(x, z) - 0.2, z, ry: r() * TAU, s, color: r.pick([0xffffff, 0xf0ffe8, 0xfff4e0]) });
        K.circle(x, z, 0.95, 14);
        AO(x + 1, z, 3.2, 3.2, 0.35);
      }
      K.instances(palmGeo, leafMat, list, { colors: true });
    }
    // papyrus clumps on the Nile's banks: thin stems, starburst heads
    const papyrusGeo = (() => {
      const parts = [];
      for (let k = 0; k < 5; k++) {
        const a = k * 1.3, d = k ? 0.8 : 0, h = 4.2 + (k % 3) * 0.9, lean = 0.12 * (k % 2 ? 1 : -1);
        const x = Math.cos(a) * d, z = Math.sin(a) * d;
        const st = cyl(0.09, 0.13, h, 5); st.translate(0, h / 2, 0); st.rotateZ(lean); st.translate(x, 0, z);
        parts.push(prep(st, 0x5e8a34));
        const um = new T.ShapeGeometry(starShape(1.3, 0.35, 9)); um.rotateX(-PI / 2 + 0.25 * (k % 2 ? 1 : -1)); um.translate(x - Math.sin(lean) * h, h + 0.1, z);
        parts.push(prep(um, 0x7aa63e));
      }
      return BU.mergeGeometries(parts, false);
    })();
    {
      const list = [];
      for (let i = 0; i < NILE.length; i += 9) {
        const f = NILE[i];
        if (f.z < FR.z0 + 4 || lakeF(f.x, f.z) < 1.2) continue;
        for (const sd of [-1, 1]) {
          if (r() < 0.35) continue;
          const lat = sd * r.range(6.6, 8.2), x = f.x + f.nx * lat, z = f.z + f.nz * lat;
          if (roadD(x, z) < 4 || nileD(x, z) < 6.4) continue;
          if (roadD(x, z - 4) < 1) continue;
          list.push({ x, y: Hs(x, z), z, ry: r() * TAU, s: r.range(0.8, 1.15), color: 0xffffff });
        }
      }
      for (let i = 0; i < 10; i++) { const th = (i / 10) * TAU + 0.3, R = lakeR(th) * 1.32; list.push({ x: LAKE.x + Math.cos(th) * R, y: 0, z: LAKE.z + Math.sin(th) * R, ry: r() * TAU, s: r.range(0.8, 1.1), color: 0xffffff }); }
      K.instances(papyrusGeo, leafMat, list, { colors: true });
    }
    // lily pads and two lotus flowers on the lake, a paper felucca
    {
      const pad = new T.CircleGeometry(1.5, 14, 0.25, TAU - 0.5); pad.rotateX(-PI / 2);
      const pads = [];
      for (let i = 0; i < 7; i++) { const a = r() * TAU, d = r.range(2, LAKE.r * 0.78); pads.push({ x: LAKE.x + Math.cos(a) * d, y: WL + 0.05, z: LAKE.z + Math.sin(a) * d, ry: r() * TAU, s: r.range(0.8, 1.3), color: r.pick([0x4f9a3c, 0x5fa848, 0x3f8a32]) }); }
      K.instances(prep(pad, 0xffffff), leafMat, pads, { colors: true, cast: false });
      const lotus = BU.mergeGeometries([prep(new T.ConeGeometry(0.75, 1.1, 7, 1, true).rotateX(PI).translate(0, 0.55, 0), 0xf4a6c8), prep(sph(0.3, 8, 6).translate(0, 0.35, 0), 0xf2d040)], false);
      K.instances(lotus, leafMat, [0, 3].map((i) => ({ x: pads[i].x + 0.4, y: WL + 0.1, z: pads[i].z, s: 1, color: 0xffffff })), { colors: true, cast: false });
      // felucca: a folded paper boat with a triangular sail on a toothpick
      const boat = new T.Group();
      const hull = new T.Shape(); hull.moveTo(-2.6, 0); hull.lineTo(2.6, 0); hull.lineTo(1.8, -1.0); hull.lineTo(-1.8, -1.0); hull.closePath();
      const hg = new T.ExtrudeGeometry(hull, { depth: 1.8, bevelEnabled: false }); hg.translate(0, 1.0, -0.9);
      const paperW = K.std({ color: 0xf6f2e8, roughness: 0.85, side: T.DoubleSide });
      boat.add(new T.Mesh(hg, paperW));
      const mast = new T.Mesh(cyl(0.08, 0.08, 5, 5), K.std({ color: 0xdcbf8a })); mast.position.y = 3; boat.add(mast);
      const sail = new T.Shape(); sail.moveTo(0, 0.8); sail.lineTo(0, 5.3); sail.lineTo(-3.2, 0.9); sail.closePath();
      const sm = new T.Mesh(new T.ShapeGeometry(sail), K.std({ color: 0xffffff, roughness: 0.8, side: T.DoubleSide })); sm.position.y = 0.2; boat.add(sm);
      const stripe = new T.Mesh(new T.PlaneGeometry(4.6, 0.25), K.std({ color: 0x2a62c4, side: T.DoubleSide })); stripe.position.set(0, 0.62, 0.92); boat.add(stripe);
      boat.position.set(LAKE.x + 3, WL, LAKE.z - 2);
      K.add(boat);
      A.boat = boat;
    }

    // ============================================================ the camel caravan
    {
      const camelGeo = (() => {
        const parts = [];
        const add = (g, c, o) => parts.push(prep(g, c, mtx(o)));
        const tan = 0xc8955a, dark = 0x8e6436;
        add(sph(1, 18, 12), tan, { y: 3.4, sx: 2.5, sy: 1.35, sz: 1.15 });
        add(sph(1, 14, 10), tan, { x: -0.2, y: 4.6, sx: 1.3, sy: 1.15, sz: 0.95 });
        add(cyl(0.42, 0.55, 2.6, 10), tan, { x: 2.6, y: 4.6, rz: -0.75 });
        add(sph(1, 12, 8), tan, { x: 3.55, y: 5.55, sx: 0.95, sy: 0.5, sz: 0.48, rz: -0.2 });
        add(sph(0.22, 6, 4), 0x3a2814, { x: 3.6, y: 5.85, z: 0.38 }); add(sph(0.22, 6, 4), 0x3a2814, { x: 3.6, y: 5.85, z: -0.38 });
        for (const [lx, lz] of [[1.5, 0.55], [1.5, -0.55], [-1.5, 0.55], [-1.5, -0.55]]) { add(cyl(0.26, 0.32, 2.6, 7), tan, { x: lx, y: 1.3, z: lz }); add(cyl(0.36, 0.36, 0.2, 7), dark, { x: lx, y: 0.1, z: lz }); }
        add(cyl(0.12, 0.08, 1.6, 5), dark, { x: -2.6, y: 2.9, rz: 0.4 });
        // saddle blanket: red with a gold trim, and a little brass bell
        add(rbox(1.9, 0.3, 2.6, 0.12), 0xc0352a, { x: 0.9, y: 4.6, rz: 0.25 });
        add(rbox(2.0, 0.12, 2.7, 0.05), 0xe2b03a, { x: 0.9, y: 4.42, rz: 0.25 });
        add(sph(0.3, 8, 6), 0xe2b03a, { x: 2.75, y: 3.85 });
        const g = BU.mergeGeometries(parts, false); g.scale(CAR.sc, CAR.sc, CAR.sc); return g;
      })();
      const list = []; for (let k = 0; k < CAR.n; k++) list.push({ x: 0, y: 0, z: 0, color: [0xffffff, 0xf2e4d0, 0xe2cdb0][k % 3] });
      const im = K.instances(camelGeo, plasticV, list, { colors: true });
      im.frustumCulled = false;
      A.camels = im;
      A.camelM = new T.Matrix4(); A.camelQ = new T.Quaternion(); A.camelE = new T.Euler(); A.camelP = new T.Vector3(); A.camelS = new T.Vector3(1, 1, 1);
      for (let k = 0; k < CAR.n; k++) {
        const o = { x: 0, z: 0, a: 0 };
        K.mover({ type: 'box', hw: 3.4, hd: 1.35, h: 7 }, (t) => { cvPos(camelU(k, t), o); return { x: o.x, z: o.z, angle: o.a }; });
      }
      // the string loop round the two cotton reels, lying on the sand (its texture runs with the camels)
      const sc = canvas(64, 16, (g) => { g.fillStyle = '#e8dcc0'; g.fillRect(0, 0, 64, 16); g.strokeStyle = '#b8a27a'; g.lineWidth = 3; for (let x = -16; x < 80; x += 8) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 8, 16); g.stroke(); } });
      const stT = TX.toTexture(sc); const R2 = CAR.reel + 0.05;
      const pts = [];
      for (let i = 0; i <= 120; i++) {
        const u = (i / 120) * (2 * (CAR.zS - CAR.zN) + 2 * PI * R2);
        const Ls = CAR.zS - CAR.zN, Lc = PI * R2;
        let x, z;
        if (u < Ls) { x = CAR.x - R2; z = CAR.zN + u; } else if (u < Ls + Lc) { const th = PI - (u - Ls) / R2; x = CAR.x + R2 * Math.cos(th); z = CAR.zS + R2 * Math.sin(th); } else if (u < 2 * Ls + Lc) { x = CAR.x + R2; z = CAR.zS - (u - Ls - Lc); } else { const th = -(u - 2 * Ls - Lc) / R2; x = CAR.x + R2 * Math.cos(th); z = CAR.zN + R2 * Math.sin(th); }
        const onRoad = Math.abs(z - CAR.roadZ) < W / 2 + 0.5;
        pts.push(new T.Vector3(x, onRoad ? 0.2 : Math.max(0.2, Hs(x, z) + 0.15), z));
      }
      const loopLen = 2 * (CAR.zS - CAR.zN) + 2 * PI * R2;
      stT.repeat.set(loopLen / 1.2, 1);
      const sm = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts, true), 240, 0.13, 4, true), K.std({ map: stT, roughness: 0.9 }));
      sm.castShadow = true; sm.receiveShadow = true; K.group.add(sm);
      A.stringT = stT; A.stringLen = loopLen;
      // camel leads: a short cord from each camel to the string is implied by the camels hugging it
      // the cotton reels on their pegs; the north one has a crank
      const reel = () => { const g = new T.Group(); const w = new T.Mesh(cyl(CAR.reel, CAR.reel, 2.2, 20), K.std({ color: 0xd8b07a, roughness: 0.7 })); w.position.y = 1.5; g.add(w); for (const y of [0.3, 2.7]) { const f = new T.Mesh(cyl(2.7, 2.7, 0.4, 24), K.std({ color: 0xb8864e, roughness: 0.65 })); f.position.y = y; g.add(f); } const thread = new T.Mesh(cyl(CAR.reel + 0.06, CAR.reel + 0.06, 1.5, 20, 1, true), K.std({ color: 0xe8dcc0, roughness: 0.9 })); thread.position.y = 1.5; g.add(thread); return g; };
      const rN = reel(), rS = reel();
      rN.position.set(CAR.x, Hs(CAR.x, CAR.zN), CAR.zN); rS.position.set(CAR.x, Hs(CAR.x, CAR.zS), CAR.zS);
      const crank = new T.Group();
      const arm = new T.Mesh(rbox(5.5, 0.25, 1.0, 0.1), K.std({ color: 0xdcbf8a, roughness: 0.75 })); arm.position.set(2.2, 3.1, 0); crank.add(arm);
      const knob = new T.Mesh(cyl(0.45, 0.45, 2.2, 10), K.phys({ color: 0xd8352a, roughness: 0.3, clearcoat: 0.5 })); knob.position.set(4.4, 4.2, 0); crank.add(knob);
      rN.add(crank);
      K.add(rN); K.add(rS);
      A.reels = [rN, rS];
      for (const z of [CAR.zN, CAR.zS]) { K.circle(CAR.x, z, 2.8, 4); AO(CAR.x, z, 3.6, 3.6, 0.45); }
      A.camelShadow = null;
    }

    // ============================================================ fallen leaves
    {
      const leaf = new T.Shape(); leaf.moveTo(0, -2); leaf.quadraticCurveTo(1.3, -0.6, 0, 2.2); leaf.quadraticCurveTo(-1.3, -0.6, 0, -2);
      const lg = new T.ShapeGeometry(leaf, 6); lg.rotateX(-PI / 2);
      const p = lg.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, Math.abs(p.getX(i)) * 0.25);
      lg.computeVertexNormals();
      const list = [];
      for (let i = 0; i < (low ? 16 : 30); i++) {
        const x = r.range(FR.x0 + 3, FR.x1 - 3), z = r.range(FR.z0 + 3, FR.z1 - 3);
        if (nileD(x, z) < 6 || lakeF(x, z) < 1.3) continue;
        const onRoad = roadD(x, z) < 0.5;
        if (onRoad && r() < 0.7) continue;
        list.push({ x, y: (onRoad ? 0.06 : Hs(x, z)) + 0.08, z, ry: r() * TAU, s: r.range(0.9, 1.5), color: r.pick([0x7aa83c, 0xb8b040, 0xc89038, 0x9a6a2e, 0x6a9a34]) });
      }
      K.instances(prep(lg, 0xffffff), leafMat, list, { colors: true, cast: false });
    }

    // ============================================================ the sandpit frame, the patio, the lawn, a flower pot
    {
      const wood = TX.woodTextures({ size: 512, seed: 18, planks: 1, base: 0xb4a088, dark: 0x847260, light: 0xcfbea2, ringFreq: 9, gap: 0, roughBase: 0.8 });
      const wc = wood.map.image, wg = wc.getContext('2d');
      const paint = TX.paint(512, 512, (x, y, u, v, o) => {
        const n = bil(NF, u * 64, v * 256) * 0.7 + bil(NF2, u * 200, v * 40) * 0.3, cov = ss(0.42, 0.5, n);
        const k = 0.9 + bil(NF2, u * 90, v * 90) * 0.2;
        o[0] = 72 * k; o[1] = 172 * k; o[2] = 164 * k; o[3] = 255 * cov * 0.94;
      });
      wg.drawImage(paint, 0, 0);
      wood.map.needsUpdate = true;
      for (const t of [wood.map, wood.normalMap, wood.roughnessMap]) { t.rotation = PI / 2; t.center.set(0.5, 0.5); t.repeat.set(1, 4.5); }
      const frameMat = K.std({ map: wood.map, normalMap: wood.normalMap, roughnessMap: wood.roughnessMap, normalScale: V2(0.7) });
      const H = FR.top - FR.bot, yc = (FR.top + FR.bot) / 2, t = FR.t, X = FR.x1 + t, Z0 = FR.z0 - t, Z1 = FR.z1 + t;
      const boards = [
        [0, Z0 + t / 2, 2 * X, t], [0, Z1 - t / 2, 2 * X, t], [FR.x0 - t / 2, (FR.z0 + FR.z1) / 2, t, FR.z1 - FR.z0], [FR.x1 + t / 2, (FR.z0 + FR.z1) / 2, t, FR.z1 - FR.z0],
      ];
      for (const [x, z, w, d] of boards) for (const [y0, y1] of [[FR.bot, yc - 0.15], [yc + 0.15, FR.top]]) { const m = K.mesh(rbox(w, y1 - y0, d, 0.55, 2), frameMat, x, (y0 + y1) / 2, z); m.receiveShadow = true; }
      K.box(0, FR.z0 - 1, FR.x1 + 2, 1, 0, 50); K.box(0, FR.z1 + 1, FR.x1 + 2, 1, 0, 50);
      K.box(FR.x0 - 1, (FR.z0 + FR.z1) / 2, 1, (FR.z1 - FR.z0) / 2 + 2, 0, 50); K.box(FR.x1 + 1, (FR.z0 + FR.z1) / 2, 1, (FR.z1 - FR.z0) / 2 + 2, 0, 50);
      // corner seats (triangular boards on top of the frame), with a plank under the inner edge
      for (const [cx, cz, sx, sz] of [[FR.x0, FR.z0, 1, 1], [FR.x1, FR.z0, -1, 1], [FR.x0, FR.z1, 1, -1], [FR.x1, FR.z1, -1, -1]]) {
        const a = 20, sh = new T.Shape();
        sh.moveTo(-t * sx, t * sz); sh.lineTo((a + 1) * sx, t * sz); sh.lineTo(-t * sx, -(a + 1) * sz); sh.closePath();
        const g = new T.ExtrudeGeometry(sh, { depth: 1.3, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.2, bevelSegments: 2 });
        g.rotateX(-PI / 2);
        const m = K.mesh(g, frameMat, cx, FR.top, cz); m.receiveShadow = true;
        const mx = cx + sx * a / 2, mz = cz + sz * a / 2;
        const ang = Math.atan2(-sz * a, sx * a);
        K.mesh(rbox(a * 1.414, FR.top - 0.2, 1.4, 0.3), frameMat, mx, FR.top / 2 - 0.4, mz, { ry: -ang });
        K.capsule(cx + sx * a, cz, cx, cz + sz * a, 1.0, 50);
      }
      // patio flagstones far and wide, a lawn beyond the west side
      const pc = TX.makeCanvas(512, 512), pg = pc.getContext('2d'), pr = K.rng(5);
      pg.fillStyle = '#6a645a'; pg.fillRect(0, 0, 512, 512);
      const rows = [0, 136, 256, 392, 512];
      for (let i = 0; i < 4; i++) {
        let x = -pr() * 120;
        while (x < 512) {
          const w = 100 + pr() * 90, y0 = rows[i], y1 = rows[i + 1];
          const k = 0.86 + pr() * 0.22, base = pr() < 0.5 ? [206, 196, 176] : [188, 182, 168];
          const gr = pg.createLinearGradient(x, y0, x + w, y1);
          gr.addColorStop(0, `rgb(${base[0] * k | 0},${base[1] * k | 0},${base[2] * k | 0})`); gr.addColorStop(1, `rgb(${base[0] * k * 0.94 | 0},${base[1] * k * 0.94 | 0},${base[2] * k * 0.92 | 0})`);
          pg.fillStyle = gr;
          pg.fillRect(x + 3, y0 + 3, w - 6, y1 - y0 - 6);
          if (x + w > 512) pg.fillRect(x + 3 - 512, y0 + 3, w - 6, y1 - y0 - 6);
          if (x < 0) pg.fillRect(x + 3 + 512, y0 + 3, w - 6, y1 - y0 - 6);
          x += w;
        }
      }
      for (let i = 0; i < 2600; i++) { pg.fillStyle = pr() < 0.6 ? `rgba(60,55,48,${0.08 + pr() * 0.12})` : `rgba(255,250,240,${0.08 + pr() * 0.12})`; pg.fillRect(pr() * 512, pr() * 512, 1 + pr() * 3, 1 + pr() * 3); }
      for (let i = 0; i < 160; i++) { pg.fillStyle = `rgba(80,110,50,${0.25 + pr() * 0.3})`; const ry = rows[1 + Math.floor(pr() * 3)]; pg.fillRect(pr() * 512, ry - 3 + pr() * 4, 2 + pr() * 4, 2); }
      const patT = TX.toTexture(pc); patT.repeat.set(560 / 130, 560 / 130);
      const patio = K.mesh(new T.PlaneGeometry(560, 560), K.std({ map: patT, roughness: 0.88 }), 40, FR.bot, 0, { rx: -PI / 2, cast: false });
      patio.receiveShadow = true;
      const lc = TX.paint(256, 256, (x, y, u, v, o) => { const n = bil(NF, u * 256, v * 256), hn = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453, nn = hn - Math.floor(hn); const k = 0.75 + n * 0.35 + (nn - 0.5) * 0.3; o[0] = 70 * k; o[1] = 128 * k; o[2] = 46 * k; });
      const lawnT = TX.toTexture(lc); lawnT.repeat.set(30, 60);
      K.mesh(new T.PlaneGeometry(300, 600), K.std({ map: lawnT, roughness: 0.95 }), FR.x0 - 30 - 150, FR.bot + 0.4, 0, { rx: -PI / 2, cast: false });
      // grass tufts along the lawn edge
      const tuft = new T.ConeGeometry(0.5, 3, 4, 1, true);
      const tl = []; for (let i = 0; i < 90; i++) tl.push({ x: FR.x0 - 30 - r.range(0, 4), y: FR.bot + 1.6, z: r.range(-200, 200), rz: r.range(-0.4, 0.4), rx: r.range(-0.4, 0.4), s: r.range(0.7, 1.4), color: r.pick([0x4a8a2e, 0x5f9a38, 0x3e7a28]) });
      K.instances(prep(tuft, 0xffffff), leafMat, tl, { colors: true, cast: false });
      // terracotta pot with a geranium on the east patio
      const tc = TX.mottledTextures({ size: 128, a: 0xc4683e, b: 0xa65232, seed: 131, period: 8, bump: 2, speck: 0.3 });
      const potMat = K.std({ map: tc.map, normalMap: tc.normalMap, roughness: 0.85 });
      const px = 156, pz = 40;
      K.mesh(K.lathe([[7, 0], [7.4, 0.4], [9.6, 13], [10.8, 13.2], [10.8, 15.4], [10, 15.6], [9.4, 14.6], [0, 14.6]], 40), potMat, px, FR.bot, pz);
      const leafG = new T.CircleGeometry(2.4, 10); leafG.rotateX(-PI / 2 + 0.3);
      const leaves = []; for (let i = 0; i < 16; i++) { const a = r() * TAU, d = r.range(1, 7.5); leaves.push({ x: px + Math.cos(a) * d, y: FR.bot + 15 + r.range(0, 4), z: pz + Math.sin(a) * d, ry: -a, s: r.range(0.9, 1.4), color: r.pick([0x3f7a2e, 0x4f8a36]) }); }
      K.instances(prep(leafG, 0xffffff), leafMat, leaves, { colors: true });
      const fl = []; for (let i = 0; i < 26; i++) { const a = r() * TAU, d = r.range(0, 4), c0 = r() < 0.5 ? 0 : 1; fl.push({ x: px + [-2, 2][c0] + Math.cos(a) * d * 0.6, y: FR.bot + 23 + r.range(-0.8, 0.8), z: pz + [1.5, -2][c0] + Math.sin(a) * d * 0.6, s: r.range(0.5, 0.75), color: r.pick([0xe0242e, 0xf03a44, 0xc81c26]) }); }
      K.instances(prep(sph(1, 8, 6), 0xffffff), leafMat, fl, { colors: true });
      for (let i = 0; i < 2; i++) K.mesh(cyl(0.18, 0.2, 8, 5), K.std({ color: 0x4f8a36 }), px + [-2, 2][i], FR.bot + 19, pz + [1.5, -2][i], { rz: 0.1 * (i ? 1 : -1) });
    }

    // ============================================================ flush instanced scatter and merged bins
    {
      const shellGeo = (() => {
        const g = new T.SphereGeometry(1, 8, 3, 0, TAU, 0, PI / 2);
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 + 0.08 * Math.cos(a * 10); p.setX(i, x * k * 1.1); p.setZ(i, z * k * 0.95); p.setY(i, p.getY(i) * 0.42); }
        g.computeVertexNormals();
        return g;
      })();
      const pebGeo = new T.IcosahedronGeometry(1, 0); pebGeo.scale(1, 0.55, 0.8);
      const shellMat = K.phys({ roughness: 0.45, clearcoat: 0.35, clearcoatRoughness: 0.4, sheen: 0.3 });
      K.instances(shellGeo, shellMat, shells, { colors: true, cast: !low });
      K.instances(pebGeo, K.phys({ roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.5 }), pebbles, { colors: true, cast: !low });
      K.instances(new T.DodecahedronGeometry(1, 0), K.std({ roughness: 0.95 }), crumbs, { colors: true, cast: false });
      if (paperParts.length) { const m = new T.Mesh(BU.mergeGeometries(paperParts, false), paperMat); m.castShadow = true; m.receiveShadow = true; K.group.add(m); }
      const g = new T.PlaneGeometry(1, 1); g.rotateX(-PI / 2);
      const im = K.instances(g, contactMat, contacts, { cast: false, receive: false });
      im.renderOrder = 1;
    }
    flushBins();
  },

  // fixed-rate: Nile falls restart with a run-up (and splash), the caravan's bell before it steps onto the road
  tick(dt, time, game) {
    if (!A) return;
    const L = game.track.length;
    for (const e of game.cars) {
      const c = e.car, k = c.index;
      if (c.state === 'falling' && c.fallKind === 'hole') {
        if (!A.fell.has(k)) {
          A.fell.add(k);
          if (game.sound && (game.state === 'race' || game.state === 'roundEnd')) game.sound.splash(30, game.panOf(c.x, c.z));
          if (game.particles) {
            game.particles.emit(c.x, -0.8, c.z, { color: 0xd6eef4, n: 18, size: 1.1, life: 0.6, spread: 14, up: 16, grav: 42, alpha: 0.9, grow: 1 });
            game.particles.emit(c.x, -0.8, c.z, { color: 0x6fc0d8, n: 8, size: 1.6, life: 0.5, spread: 8, up: 9, grav: 30, alpha: 0.7, grow: 1.4 });
          }
        }
        const rel = mod(e.lastGoodS - A.sJ0 + 60, L) - 60;
        if (rel > -10 && rel < A.sT - A.sJ0 + 10) e.lastGoodS = mod(A.sJ0 - 30, L);
      } else A.fell.delete(k);
    }
    const pt = A.prevT;
    A.prevT = time;
    if (pt == null || time <= pt || time - pt > 0.5) return;
    const u1 = camelU(0, time), u0 = camelU(0, pt);
    for (const ub of BELL_U) {
      if (Math.floor((u1 - ub) / CV.L) > Math.floor((u0 - ub) / CV.L)) game.sound.cue('bell', { x: CAR.x, z: CAR.roadZ, game, tin: true });
    }
  },

  animate(time, dt, game) {
    if (!A || !A.camels) return;
    const o = A.cvO, M = A.camelM;
    for (let k = 0; k < CAR.n; k++) {
      const u = camelU(k, time);
      cvPos(u, o);
      const step = u * 1.6 + k;
      A.camelP.set(o.x, Math.abs(Math.sin(step)) * 0.18, o.z);
      A.camelE.set(0, -o.a, Math.sin(step * 2) * 0.035, 'YXZ');
      A.camelQ.setFromEuler(A.camelE);
      M.compose(A.camelP, A.camelQ, A.camelS);
      A.camels.setMatrixAt(k, M);
      if (game && game.particles && dt > 0 && Math.sin(step * 2) > 0.97 && Math.abs(o.z - CAR.roadZ) > W / 2 && game.onScreen && game.onScreen(o.x, 1, o.z, 0.05)) {
        game.particles.emit(o.x, 0.3, o.z, { color: 0xe6cc98, n: 1, size: 0.9, life: 0.5, spread: 2, up: 1, grav: 2, alpha: 0.4, grow: 1.6 });
      }
    }
    A.camels.instanceMatrix.needsUpdate = true;
    const turn = (CAR.v * time) / (CAR.reel + 0.05);
    A.reels[0].rotation.y = -turn; A.reels[1].rotation.y = -turn;
    A.stringT.offset.x = -(CAR.v * time) / 1.2;
    A.waterN.offset.set(time * 0.004, -time * 0.012);
    if (A.boat) {
      A.boat.position.y = -1.0 + Math.sin(time * 1.7) * 0.06;
      A.boat.rotation.set(Math.sin(time * 1.3) * 0.05, 0.6 + Math.sin(time * 0.2) * 0.3, Math.sin(time * 1.1 + 1) * 0.04);
    }
  },
};

// World: Pharaoh's Tomb (Pharaoh Cup, table 3 of 4, hard). A museum's open-top cutaway model of the passages and
// chambers inside a great pyramid, on a dark display plinth in a dimmed gallery: the shell is cut away so you look
// down into the corridors, lit by little flickering torches and the jeeps' headlights. From the entrance passage the
// course runs up the east passage, climbs the long Grand Gallery (corbelled walls stepping in) onto the upper level,
// through the antechamber's portcullis into the granite King's Chamber round the sarcophagus, down the descending
// passage, round the treasury (gold chests, a chariot, guardian statues, urns you can shove) and back west through
// the rough-cut subterranean chamber. Three stone doors grind down in a learnable green wave (dust, a warning glow
// and a clank 1.5 s before they drop; a closed door makes you wait); two cracked ceiling blocks pour sand onto
// marked spots on the north side of a passage (a trickle first, then a heavy pour that bogs you down).

const PI = Math.PI, TAU = PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mod = (a, n) => ((a % n) + n) % n;

// ---- the circuit (driving order): the entrance passage heading east, the east passage north, the Grand Gallery
// west (climbing), the King's Chamber (a hairpin on the upper level), the descending passage east, the treasury (a
// hairpin), the subterranean chamber west and the west hairpin back into the entrance passage
const TRACK = [
  [-96, 62], [-20, 62], [60, 62], [100, 62], [112.73, 56.73], [118, 44], [118, -48], [112.73, -60.73],
  [100, -66, 15], [40, -66, 16], [-30, -66, 16], [-82, -66, 20], [-100, -66, 22], [-115.56, -59.56, 22], [-122, -44, 22],
  [-115.56, -28.44, 22], [-100, -22, 20], [-60, -22], [20, -22], [62, -22, 20], [76.85, -15.85, 22], [83, -1, 22],
  [76.85, 13.85, 22], [62, 20, 18], [10, 20, 16], [-60, 20, 18], [-96, 20, 16], [-110.85, 26.15], [-117, 41], [-110.85, 55.85],
];
const W = 14;
const START_S = 40;
const H = 6; // the upper level (top of the Grand Gallery, the King's Chamber)
const FP = { x0: -140, x1: 132, z0: -84, z1: 75 }; // where the cut plane meets the pyramid's outer faces
const PL = -10; // top of the display plinth
const GROUND = -90; // gallery floor
const cutP = (z) => { const x = -z - 10; return 5.5 + 0.09 * (x < -12 ? 0 : x < 12 ? ((x + 12) * (x + 12)) / 48 : x); }; // the cut plane: a little higher towards the back
const KING = { x: -100, z: -44, r: 12.5 }; // the King's Chamber dais (inside the upper hairpin)
const TREAS = { x: 62, z: -1, r: 12.5 }; // the treasury dais (inside the east hairpin)

// ---- the stone doors: a closed spell, the rise, open (the last Wn s of it with the warning), the drop. Phased as a
// green wave at DOOR.wave units/s from the start line (a car at that pace meets every door just after it opened).
const DOOR = { P: 8, C: 2.6, R: 0.8, Wn: 1.5, D: 0.45, top: 6.6, solid: 1.8, sh: 4.6, th: 1.8, wave: 36 };
const DOOR_AT = [[60, 62], [-48, -66], [0, 20]];
// ---- the sand falls: idle, a trickle, the pour, the heap, then it drains away through the floor joints
const SAND = { P: 9, idle: 2.0, trick: 1.4, pour: 2.8, pile: 1.6, R: 4.8, edge: 3.6 };
const SAND_AT = [{ x: 30, z: -22, ph: 0 }, { x: -62, z: 20, ph: 4.4 }];

let A = null; // runtime state shared by build / tick / animate

// ---- the clocks: pure functions of the time since GO (A.t0 is set when a countdown starts); frozen before GO
const raceT = (t) => Math.max(0, t - (A ? A.t0 : 0));
const doorU = (D, t) => mod(raceT(t) + D.ph, DOOR.P);
function doorB(u) { // height of the slab's bottom above the floor
  if (u < DOOR.C) return 0;
  if (u < DOOR.C + DOOR.R) return DOOR.top * ss(0, 1, (u - DOOR.C) / DOOR.R);
  if (u < DOOR.P - DOOR.D) return DOOR.top;
  const q = (u - (DOOR.P - DOOR.D)) / DOOR.D;
  return DOOR.top * (1 - q * q);
}
const doorWarn = (u) => { const a = DOOR.P - DOOR.D - DOOR.Wn; return u >= a && u < DOOR.P - DOOR.D ? (u - a) / DOOR.Wn : 0; };
const sandU = (S, t) => mod(raceT(t) + S.ph, SAND.P);
function sandState(u, o) {
  const a = SAND.idle, b = a + SAND.trick, c = b + SAND.pour, d = c + SAND.pile;
  o.trickle = u >= a && u < b ? (u - a) / SAND.trick : 0;
  o.pour = u >= b && u < c ? 1 : 0;
  o.flow = o.pour ? 1 - ss(c - 0.4, c, u) : o.trickle * 0.25;
  o.pile = u < b ? 0 : u < c ? 0.15 + 0.85 * ss(b, c, u) : u < d ? 1 : 1 - ss(d, SAND.P, u);
  o.slow = u >= b + 0.25 && u < d + 0.5;
  return o;
}
const SST = { trickle: 0, pour: 0, flow: 0, pile: 0, slow: false };

export default {
  id: 'tomb',
  name: "Pharaoh's Tomb",
  blurb: 'A cutaway pyramid: stone doors slam in a rhythm, sand pours from cracked ceilings.',
  vehicle: 'truck',
  seed: 97,
  headlights: { intensity: 52, distance: 48, angle: 0.62, color: 0xfff0d4 },
  track: { points: TRACK, width: W, startS: START_S },
  bounds: { minX: FP.x0 - 8, maxX: FP.x1 + 8, minZ: FP.z0 - 8, maxZ: FP.z1 + 8 },
  fallOffEdges: false,
  floorY: GROUND + 1,
  offCourse: 16,
  skidColor: 0x1c140c,
  clackOnBump: true,
  dust: {
    normal: null,
    slow: { color: 0xd9b77a, size: 0.9, life: 0.6, up: 2.4, grav: 10, alpha: 0.6, grow: 1.6, rate: 1.5 },
  },
  lighting: {
    sunDir: [0.3, 1, 0.66], sunColor: 0xffd2a4, sunIntensity: 0.8,
    hemiSky: 0x5a5e80, hemiGround: 0x22160c, hemiIntensity: 0.22,
    envIntensity: 0.18, exposure: 1.0, background: 0x0a0706, shadowRadius: 2.4,
    fog: { color: 0x0a0706, near: 320, far: 900 },
  },

  async build(K) {
    const { THREE: T, TX, r, track } = K;
    const BU = K.BufferGeometryUtils;
    const L = track.length;
    const lowQ = !!(K.quality && K.quality.tilt === false);
    const V2 = (a, b = a) => new T.Vector2(a, b);
    const sAt = (x, z) => track.distTo(x, z).s;
    const sRel = (s, a) => mod(s - a, L);
    const inZ = (s, a, b) => sRel(s, a) <= sRel(b, a);
    A = { L, t0: 0, prevState: null, prevCountT: 0, doors: [], sands: [], step: 0 };

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
    const CELL = 320;
    const bins = new Map();
    const binPush = (mat, cast, x, z, g) => {
      if (mat.isMeshBasicMaterial) cast = false;
      const key = mat.uuid + (cast ? 'c' : 'n') + Math.floor((x + 400) / CELL) + ':' + Math.floor((z + 400) / CELL);
      if (!bins.has(key)) bins.set(key, { mat, cast, parts: [] });
      bins.get(key).parts.push(g);
    };
    const put = (geo, c, o = {}, mat = M.paint, cast = true) => binPush(mat, cast, o.x ?? 0, o.z ?? 0, prep(geo, c, mtx(o)));
    // a local frame for a whole prop: f(geo, c, o, mat, cast)
    const frame = (cx, cy, cz, ry = 0) => {
      const F = mtx({ x: cx, y: cy, z: cz, ry });
      return (geo, c, o = {}, mat = M.paint, cast = true) => binPush(mat, cast, cx, cz, prep(geo, c, F.clone().multiply(mtx(o))));
    };
    const flushBins = () => {
      for (const { mat, cast, parts } of bins.values()) {
        const g = BU.mergeGeometries(parts, false); g.computeBoundingSphere();
        const m = new T.Mesh(g, mat); m.castShadow = cast; m.receiveShadow = !mat.isMeshBasicMaterial; K.group.add(m);
      }
      bins.clear();
    };
    const box = (w, h, d) => new T.BoxGeometry(w, h, d);
    const rbox = (w, h, d, rad = 0.2, seg = 2) => new K.RoundedBoxGeometry(w, h, d, seg, Math.min(rad, w / 2.01, h / 2.01, d / 2.01));
    const cyl = (r1, r2, h, seg = 12, open = false) => new T.CylinderGeometry(r1, r2, h, seg, 1, open);
    const sph = (rad, ws = 12, hs = 8) => new T.SphereGeometry(rad, ws, hs);
    const flat = (w, d) => new T.PlaneGeometry(w, d).rotateX(-PI / 2);
    const canvas = (w, h, draw) => { const c = TX.makeCanvas(w, h); draw(c.getContext('2d'), w, h); return c; };
    const tex = (c, rep = [1, 1], wrap = true, srgb = true) => TX.toTexture(c, { repeat: rep, wrap, srgb });
    const meshOf = (g, mat, { cast = false, receive = true, order = 0 } = {}) => { const m = new T.Mesh(g, mat); m.castShadow = cast; m.receiveShadow = receive; m.renderOrder = order; K.group.add(m); return m; };
    // geometry that follows the track: rows of vertices added in order, quads between consecutive rows of a key
    const along = (count, wind) => {
      const G = new Map();
      return {
        add(key, i, verts) {
          let g = G.get(key);
          if (!g) G.set(key, (g = { pos: [], uv: [], col: [], idx: [], last: -9, base: 0 }));
          const b = g.pos.length / 3;
          for (const v of verts) { g.pos.push(v[0], v[1], v[2]); g.uv.push(v[3], v[4]); g.col.push(v[5] ?? 1, v[6] ?? 1, v[7] ?? 1); }
          if (g.last === i - 1) {
            for (let k = 0; k < count - 1; k++) {
              const a0 = g.base + k, a1 = a0 + 1, b0 = b + k, b1 = b0 + 1;
              if (wind) g.idx.push(a0, b0, a1, a1, b0, b1); else g.idx.push(a0, a1, b0, a1, b1, b0);
            }
          }
          g.last = i; g.base = b;
        },
        geo(key, up = false) {
          const g = G.get(key);
          if (!g || !g.idx.length) return null;
          const bg = new T.BufferGeometry();
          bg.setAttribute('position', new T.Float32BufferAttribute(g.pos, 3));
          bg.setAttribute('uv', new T.Float32BufferAttribute(g.uv, 2));
          bg.setAttribute('color', new T.Float32BufferAttribute(g.col, 3));
          bg.setIndex(g.idx); bg.computeVertexNormals();
          if (up) { const n = bg.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0); }
          return bg;
        },
        keys() { return [...G.keys()]; },
      };
    };
    // contact shadows (opacity carried in the instance's y scale) and additive light pools
    const contactMat = new T.MeshBasicMaterial({ color: 0x020101, transparent: true, alphaMap: TX.blobShadowTexture(), depthWrite: false });
    contactMat.onBeforeCompile = (sh) => {
      sh.vertexShader = 'varying float vOp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\nvOp = length(instanceMatrix[1].xyz);\n#endif');
      sh.fragmentShader = 'varying float vOp;\n' + sh.fragmentShader.replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\ndiffuseColor.a *= vOp;');
    };
    contactMat.customProgramCacheKey = () => 'tomb-contact';
    const contacts = [];
    const AO = (x, y, z, rx, rz = rx, op = 0.4, ang = 0) => contacts.push({ x, y: y + 0.06, z, ry: -ang, sx: rx * 2, sy: op, sz: rz * 2 });
    const pools = [];
    const POOL = (x, y, z, rx, rz, color, op = 1, ang = 0) => pools.push({ x, y: y + 0.09, z, ry: -ang, sx: rx * 2, sy: 1, sz: rz * 2, color: new T.Color(color).multiplyScalar(op) });
    const glowTex = tex(canvas(128, 128, (g) => { const q = g.createRadialGradient(64, 64, 0, 64, 64, 64); q.addColorStop(0, 'rgba(255,255,255,1)'); q.addColorStop(0.3, 'rgba(255,255,255,0.45)'); q.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = q; g.fillRect(0, 0, 128, 128); }), [1, 1], false);
    const poolTex = tex(canvas(128, 128, (g) => { const q = g.createRadialGradient(64, 64, 0, 64, 64, 64); q.addColorStop(0, 'rgba(255,255,255,1)'); q.addColorStop(0.5, 'rgba(255,255,255,0.6)'); q.addColorStop(0.85, 'rgba(255,255,255,0.15)'); q.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = q; g.fillRect(0, 0, 128, 128); }), [1, 1], false);
    const addMat = (map, extra = {}) => new T.MeshBasicMaterial({ map, transparent: true, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false, ...extra });

    // ============================================================ noise
    const NF = TX.noiseField(256, { seed: 97, period: 8, oct: 4 });
    const NF2 = TX.noiseField(256, { seed: 31, period: 32, oct: 3 });
    const bil = (f, x, y) => {
      x = ((x % 256) + 256) % 256; y = ((y % 256) + 256) % 256;
      const x0 = x | 0, y0 = y | 0, x1 = (x0 + 1) & 255, y1 = (y0 + 1) & 255, fx = x - x0, fy = y - y0;
      return (f[y0 * 256 + x0] * (1 - fx) + f[y0 * 256 + x1] * fx) * (1 - fy) + (f[y1 * 256 + x0] * (1 - fx) + f[y1 * 256 + x1] * fx) * fy;
    };
    // add per-pixel grain to a canvas and return a height field (luma) for its normal map
    const grain = (c, amt, seed = 1, scale = 1) => {
      const g = c.getContext('2d'), w = c.width, h = c.height, img = g.getImageData(0, 0, w, h), d = img.data, hf = new Float32Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x, n = (bil(NF, x * 0.5 * scale + seed * 17, y * 0.5 * scale) - 0.5) * amt + (bil(NF2, x * 2.1 * scale, y * 2.1 * scale + seed * 5) - 0.5) * amt * 0.6;
        d[i * 4] = clamp(d[i * 4] * (1 + n), 0, 255); d[i * 4 + 1] = clamp(d[i * 4 + 1] * (1 + n), 0, 255); d[i * 4 + 2] = clamp(d[i * 4 + 2] * (1 + n), 0, 255);
        hf[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) / 255;
      }
      g.putImageData(img, 0, 0);
      return hf;
    };
    const normalTex = (hf, w, h, k) => tex(TX.normalFromHeight(hf, w, h, k), [1, 1], true, false);
    const fr = K.rng(9701); // drawing RNG (deterministic)

    // ============================================================ textures
    // sandstone courses for the cut tops (world-mapped, 16 units per tile)
    const masC = canvas(512, 512, (g) => {
      g.fillStyle = '#6a5c4a'; g.fillRect(0, 0, 512, 512);
      for (let y = 0; y < 512; y += 64) {
        let x = -fr() * 120;
        while (x < 512) {
          const len = 64 + fr() * 70, t = fr(), k = 0.88 + fr() * 0.2;
          g.fillStyle = `rgb(${(lerp(176, 200, t) * k) | 0},${(lerp(160, 180, t) * k) | 0},${(lerp(128, 146, t) * k) | 0})`;
          for (const ox of [0, -512, 512]) g.fillRect(x + ox + 2, y + 2, len - 4, 60);
          if (fr() < 0.25) { g.strokeStyle = 'rgba(80,58,36,0.45)'; g.lineWidth = 1.5; g.beginPath(); const cx = x + fr() * len; g.moveTo(cx, y + 3); g.lineTo(cx + fr() * 20 - 10, y + 30); g.lineTo(cx + fr() * 30 - 15, y + 60); g.stroke(); }
          x += len;
        }
      }
    });
    const masH = grain(masC, 0.22, 3);
    const masTex = tex(masC, [1, 1]), masN = normalTex(masH, 512, 512, 2.2);
    // limestone courses for the gallery and the passages (u along the wall, v up; 10 units per tile)
    const limeC = canvas(256, 256, (g) => {
      g.fillStyle = '#9a8a70'; g.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 256; y += 36) {
        let x = -fr() * 60;
        while (x < 256) {
          const len = 50 + fr() * 70, t = fr();
          g.fillStyle = `rgb(${lerp(222, 240, t) | 0},${lerp(206, 226, t) | 0},${lerp(172, 196, t) | 0})`;
          for (const ox of [0, -256, 256]) g.fillRect(x + ox + 1.5, y + 1.5, len - 3, 33);
          x += len;
        }
      }
    });
    const limeH = grain(limeC, 0.14, 5);
    const limeTex = tex(limeC, [1, 1]), limeN = normalTex(limeH, 256, 256, 2);
    // granite: speckled red-grey
    const graC = canvas(256, 256, (g) => {
      g.fillStyle = '#6e5652'; g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 2600; i++) { const c = fr.pick(['#8a6a62', '#4a3a38', '#b49488', '#2e2624', '#9c7c70']); g.fillStyle = c; const s = 1 + fr() * 3; g.fillRect(fr() * 256, fr() * 256, s, s * (0.6 + fr())); }
    });
    const graH = grain(graC, 0.1, 7, 2);
    const graTex = tex(graC, [1, 1]), graN = normalTex(graH, 256, 256, 1);
    // rough-cut rock (the subterranean chamber)
    const rockC = canvas(256, 256, (g) => {
      g.fillStyle = '#8c7458'; g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(${fr() < 0.5 ? '60,44,30' : '190,160,120'},${0.15 + fr() * 0.25})`; g.beginPath(); g.ellipse(fr() * 256, fr() * 256, 6 + fr() * 26, 4 + fr() * 14, fr() * 3, 0, TAU); g.fill(); }
      g.strokeStyle = 'rgba(50,36,24,0.5)'; g.lineWidth = 1.2;
      for (let i = 0; i < 26; i++) { g.beginPath(); let x = fr() * 256, y = fr() * 256; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += fr() * 30 - 15; y += fr() * 30 - 15; g.lineTo(x, y); } g.stroke(); }
    });
    const rockH = grain(rockC, 0.45, 11);
    const rockTex = tex(rockC, [1, 1]), rockN = normalTex(rockH, 256, 256, 3.5);
    // the painted walls: dado, block borders, figures in profile and cartouches, a glyph band, a frieze of reed
    // bundles and plain stone above (v = 1 at 6 units; the texture clamps vertically, so taller walls are plain above)
    const GLYPH = (g, x, y, s, k, col) => {
      g.strokeStyle = col; g.fillStyle = col; g.lineWidth = Math.max(1.5, s * 0.12);
      switch (k % 12) {
        case 0: g.beginPath(); g.arc(x, y, s * 0.32, 0, TAU); g.fill(); break; // sun disc
        case 1: g.beginPath(); g.ellipse(x, y - s * 0.26, s * 0.16, s * 0.2, 0, 0, TAU); g.stroke(); g.fillRect(x - s * 0.3, y - s * 0.06, s * 0.6, s * 0.1); g.fillRect(x - s * 0.05, y - s * 0.06, s * 0.1, s * 0.5); break; // ankh-like
        case 2: g.beginPath(); g.ellipse(x, y, s * 0.4, s * 0.18, 0, 0, TAU); g.stroke(); g.beginPath(); g.arc(x, y, s * 0.1, 0, TAU); g.fill(); g.beginPath(); g.moveTo(x - s * 0.1, y + s * 0.18); g.lineTo(x - s * 0.18, y + s * 0.42); g.stroke(); break; // eye
        case 3: for (let j = 0; j < 3; j++) { g.beginPath(); for (let q = 0; q <= 8; q++) g.lineTo(x - s * 0.4 + q * s * 0.1, y - s * 0.25 + j * s * 0.22 + (q % 2 ? -s * 0.06 : s * 0.06)); g.stroke(); } break; // water
        case 4: g.fillRect(x - s * 0.04, y - s * 0.45, s * 0.08, s * 0.9); g.beginPath(); g.ellipse(x + s * 0.12, y - s * 0.3, s * 0.12, s * 0.06, -0.6, 0, TAU); g.fill(); break; // reed
        case 5: g.beginPath(); g.ellipse(x, y, s * 0.28, s * 0.16, -0.2, 0, TAU); g.fill(); g.beginPath(); g.arc(x + s * 0.28, y - s * 0.2, s * 0.1, 0, TAU); g.fill(); g.beginPath(); g.moveTo(x - s * 0.2, y + s * 0.05); g.lineTo(x - s * 0.45, y + s * 0.15); g.lineTo(x - s * 0.3, y - s * 0.05); g.fill(); g.fillRect(x - s * 0.04, y + s * 0.1, s * 0.06, s * 0.32); g.fillRect(x + s * 0.06, y + s * 0.1, s * 0.06, s * 0.32); break; // bird
        case 6: g.beginPath(); g.ellipse(x, y, s * 0.2, s * 0.3, 0, 0, TAU); g.fill(); for (const sd of [-1, 1]) for (let q = 0; q < 3; q++) { g.beginPath(); g.moveTo(x + sd * s * 0.15, y - s * 0.15 + q * s * 0.15); g.lineTo(x + sd * s * 0.38, y - s * 0.22 + q * s * 0.18); g.stroke(); } break; // beetle
        case 7: g.beginPath(); g.arc(x, y + s * 0.2, s * 0.35, PI, 0); g.fill(); break; // loaf
        case 8: g.strokeRect(x - s * 0.3, y - s * 0.3, s * 0.6, s * 0.6); g.fillRect(x - s * 0.06, y + s * 0.1, s * 0.12, s * 0.2); break; // house
        case 9: g.beginPath(); g.moveTo(x - s * 0.4, y + s * 0.3); for (let q = 0; q < 4; q++) { g.lineTo(x - s * 0.3 + q * s * 0.2, y - s * 0.3); g.lineTo(x - s * 0.2 + q * s * 0.2, y + s * 0.3); } g.stroke(); break; // zigzag
        case 10: g.beginPath(); g.moveTo(x - s * 0.35, y + s * 0.35); g.quadraticCurveTo(x - s * 0.3, y - s * 0.4, x + s * 0.1, y - s * 0.2); g.lineTo(x + s * 0.3, y - s * 0.4); g.stroke(); break; // crook
        default: g.beginPath(); g.moveTo(x, y + s * 0.4); g.lineTo(x, y - s * 0.1); g.stroke(); for (const sd of [-1, 0, 1]) { g.beginPath(); g.ellipse(x + sd * s * 0.18, y - s * 0.25 - Math.abs(sd) * -s * 0.05, s * 0.09, s * 0.2, sd * 0.5, 0, TAU); g.fill(); } // lotus
      }
    };
    const blockBorder = (g, y, h, w) => { const cs = ['#2a5aa8', '#c0392b', '#2f8a5a', '#e8c040']; for (let x = 0, i = 0; x < w; x += 18, i++) { g.fillStyle = cs[i % 4]; g.fillRect(x + 2, y + 1, 14, h - 2); } };
    const figure = (g, x, base, kind, k) => {
      const skin = kind === 1 ? '#d8a060' : '#a4532e';
      g.lineCap = 'round';
      if (kind === 2) { // seated figure on a block throne
        g.fillStyle = '#2a5aa8'; g.fillRect(x - 14, base - 30, 18, 30); g.fillStyle = '#f2ead8'; g.fillRect(x - 6, base - 34, 22, 10);
        g.fillStyle = skin; g.fillRect(x + 10, base - 26, 6, 26); g.beginPath(); g.moveTo(x - 4, base - 34); g.lineTo(x + 10, base - 34); g.lineTo(x + 8, base - 64); g.lineTo(x - 2, base - 64); g.fill();
        g.beginPath(); g.arc(x + 4, base - 72, 8, 0, TAU); g.fill(); g.fillStyle = '#16120e'; g.beginPath(); g.moveTo(x - 6, base - 80); g.lineTo(x + 8, base - 82); g.lineTo(x + 6, base - 62); g.lineTo(x - 6, base - 60); g.fill();
        g.strokeStyle = '#d8b040'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 10, base - 52); g.lineTo(x + 22, base - 56); g.lineTo(x + 26, base - 90); g.stroke();
        return;
      }
      g.strokeStyle = skin; g.lineWidth = 5;
      g.beginPath(); g.moveTo(x, base - 38); g.lineTo(x - 7, base - 2); g.moveTo(x + 2, base - 38); g.lineTo(x + 10, base - 2); g.stroke();
      g.fillStyle = kind === 1 ? '#f4eedc' : '#f2ead8';
      g.beginPath(); if (kind === 1) { g.moveTo(x - 5, base - 64); g.lineTo(x + 7, base - 64); g.lineTo(x + 10, base - 6); g.lineTo(x - 8, base - 6); } else { g.moveTo(x - 6, base - 46); g.lineTo(x + 8, base - 46); g.lineTo(x + 12, base - 30); g.lineTo(x - 6, base - 30); } g.fill();
      g.fillStyle = skin; g.beginPath(); g.moveTo(x - 6, base - 46); g.lineTo(x + 7, base - 46); g.lineTo(x + 9, base - 66); g.lineTo(x - 7, base - 66); g.fill();
      g.beginPath(); g.arc(x + 2, base - 74, 7.5, 0, TAU); g.fill();
      g.fillStyle = '#16120e'; g.beginPath(); g.moveTo(x - 8, base - 82); g.lineTo(x + 7, base - 83); g.lineTo(x + 5, base - 74); g.lineTo(x - 7, base - 60); g.fill();
      g.fillStyle = '#e8c040'; g.fillRect(x - 6, base - 66, 14, 3); // collar
      g.strokeStyle = skin; g.lineWidth = 4; g.beginPath(); g.moveTo(x + 5, base - 62); g.lineTo(x + 18, base - 52 - (k % 3) * 6); g.stroke();
      if (k % 2 === 0) { g.strokeStyle = '#6a4a2a'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x + 18, base - 92); g.lineTo(x + 18, base - 2); g.stroke(); }
      else { g.fillStyle = '#2f8a5a'; GLYPH(g, x + 20, base - 60, 18, 11, '#2f8a5a'); }
    };
    const cartouche = (g, x, y, k) => {
      g.strokeStyle = '#16120e'; g.lineWidth = 3; g.fillStyle = '#f6edcf';
      g.beginPath(); g.roundRect(x - 13, y - 40, 26, 74, 12); g.fill(); g.stroke(); g.fillStyle = '#16120e'; g.fillRect(x - 15, y + 34, 30, 4);
      for (let q = 0; q < 3; q++) GLYPH(g, x, y - 24 + q * 22, 16, k + q * 5, q % 2 ? '#c0392b' : '#1a3a80');
    };
    const friezeC = canvas(1024, 256, (g) => {
      g.fillStyle = '#e4cf9f'; g.fillRect(0, 0, 1024, 256);
      g.fillStyle = '#d8cbb0'; g.fillRect(0, 0, 1024, 40); g.fillStyle = 'rgba(90,70,50,0.35)'; g.fillRect(0, 19, 1024, 2);
      for (let x = fr() * 40; x < 1024; x += 60 + fr() * 50) g.fillRect(x, 0, 2, 19);
      g.fillStyle = '#5a2418'; g.fillRect(0, 236, 1024, 20); g.fillStyle = '#16120e'; g.fillRect(0, 233, 1024, 3);
      blockBorder(g, 220, 13, 1024); blockBorder(g, 108, 12, 1024); blockBorder(g, 62, 11, 1024);
      for (let x = 0; x < 1024; x += 16) { const c = ['#c0392b', '#2f8a5a', '#2a5aa8'][(x / 16) % 3]; g.fillStyle = c; g.beginPath(); g.moveTo(x + 2, 62); g.lineTo(x + 2, 48); g.quadraticCurveTo(x + 8, 38, x + 14, 48); g.lineTo(x + 14, 62); g.fill(); g.fillStyle = '#16120e'; g.fillRect(x + 6, 52, 4, 8); }
      // glyph band: columns
      for (let x = 0, k = 0; x < 1024; x += 26, k++) { g.fillStyle = '#2a5aa8'; g.fillRect(x, 74, 2, 34); GLYPH(g, x + 13, 91, 22, (k * 7 + 3) % 12, k % 3 === 0 ? '#c0392b' : '#16120e'); }
      // main register: a procession, seated figures, cartouches and lotus bundles
      let x = 30, k = 0;
      while (x < 1000) {
        const pick = k % 7;
        if (pick === 3) { cartouche(g, x, 168, k); cartouche(g, x + 32, 168, k + 4); x += 80; }
        else if (pick === 6) { for (let q = 0; q < 3; q++) GLYPH(g, x + q * 12, 186, 34, 11, '#2f8a5a'); g.fillStyle = '#5a3a1a'; g.fillRect(x - 10, 206, 40, 6); x += 66; }
        else { figure(g, x, 218, pick === 1 || pick === 4 ? 1 : pick === 5 ? 2 : 0, k); for (let q = 0; q < 2; q++) GLYPH(g, x + 30, 132 + q * 22, 16, k * 3 + q, '#16120e'); x += 64; }
        k++;
      }
      // age: fading and cracks
      for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(220,200,160,${0.1 + fr() * 0.25})`; g.beginPath(); g.ellipse(fr() * 1024, 40 + fr() * 196, 8 + fr() * 40, 4 + fr() * 16, 0, 0, TAU); g.fill(); }
      g.strokeStyle = 'rgba(60,40,24,0.4)'; g.lineWidth = 1;
      for (let i = 0; i < 14; i++) { g.beginPath(); let cx = fr() * 1024, cy = 40 + fr() * 60; g.moveTo(cx, cy); for (let q = 0; q < 6; q++) { cx += fr() * 16 - 8; cy += 10 + fr() * 14; g.lineTo(cx, cy); } g.stroke(); }
    });
    grain(friezeC, 0.1, 13);
    const friezeTex = tex(friezeC, [1, 1]);
    friezeTex.wrapT = T.ClampToEdgeWrapping;
    // floors: worn flagstones with a light kerb and a worn red-ochre line near each edge (u across, v along)
    const floorCanvas = (kind) => {
      const c = canvas(256, 512, (g) => {
        const base = kind === 'granite' ? [112, 88, 84] : kind === 'rock' ? [140, 114, 84] : [196, 176, 140];
        g.fillStyle = kind === 'granite' ? '#3a2e2c' : '#7a6448'; g.fillRect(0, 0, 256, 512);
        if (kind === 'rock') {
          g.fillStyle = `rgb(${base})`; g.fillRect(0, 0, 256, 512);
          for (let i = 0; i < 140; i++) { g.fillStyle = `rgba(${fr() < 0.5 ? '70,52,34' : '200,170,130'},${0.1 + fr() * 0.2})`; g.beginPath(); g.ellipse(fr() * 256, fr() * 512, 6 + fr() * 24, 4 + fr() * 18, fr() * 3, 0, TAU); g.fill(); }
        } else {
          let y = 0;
          while (y < 512) {
            const hh = Math.min(512 - y, 44 + fr() * 64);
            let x = 0; const n = fr() < 0.5 ? 2 : 3;
            for (let i = 0; i < n; i++) {
              const ww = i === n - 1 ? 256 - x : (256 / n) * (0.75 + fr() * 0.5), t = fr(), k = 0.9 + fr() * 0.18;
              g.fillStyle = `rgb(${(base[0] * k + t * 10) | 0},${(base[1] * k + t * 8) | 0},${(base[2] * k + t * 6) | 0})`;
              g.fillRect(x + 1.5, y + 1.5, ww - 3, hh - 3);
              x += ww;
            }
            y += hh;
          }
          if (kind === 'granite') for (let i = 0; i < 2400; i++) { g.fillStyle = fr.pick(['rgba(40,30,30,0.6)', 'rgba(190,160,150,0.5)', 'rgba(20,16,16,0.5)']); g.fillRect(fr() * 256, fr() * 512, 1.5, 1.5); }
        }
        // the polished path down the middle, dust at the edges
        const gr = g.createLinearGradient(0, 0, 256, 0);
        gr.addColorStop(0, 'rgba(120,96,60,0.45)'); gr.addColorStop(0.18, 'rgba(255,240,210,0.0)'); gr.addColorStop(0.5, 'rgba(255,245,225,0.12)'); gr.addColorStop(0.82, 'rgba(255,240,210,0.0)'); gr.addColorStop(1, 'rgba(120,96,60,0.45)');
        g.fillStyle = gr; g.fillRect(0, 0, 256, 512);
        // kerbs and the worn ochre lines
        g.fillStyle = kind === 'granite' ? '#9a7e74' : '#efe3c4'; g.fillRect(0, 0, 8, 512); g.fillRect(248, 0, 8, 512);
        g.fillStyle = 'rgba(60,40,24,0.6)'; g.fillRect(8, 0, 2, 512); g.fillRect(246, 0, 2, 512);
        for (const x0 of [16, 236]) for (let y = 0; y < 512; y += 6) { if (bil(NF, x0 * 3, y * 0.4) < 0.4) continue; g.fillStyle = `rgba(190,70,32,${0.55 + fr() * 0.35})`; g.fillRect(x0 + fr() * 1.5, y, 4.5, 6); }
      });
      const hf = grain(c, kind === 'rock' ? 0.35 : 0.16, kind === 'rock' ? 21 : 17);
      return { map: tex(c, [1, 1]), normalMap: normalTex(hf, 256, 512, kind === 'rock' ? 3 : 1.6) };
    };
    const flFlags = floorCanvas('flags'), flGran = floorCanvas('granite'), flRock = floorCanvas('rock');
    // sand (piles, the pour)
    const sandC = canvas(128, 128, (g) => { g.fillStyle = '#d6b47a'; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 900; i++) { g.fillStyle = fr.pick(['#b8925a', '#ecd29c', '#c8a468', '#f4e2b4']); g.fillRect(fr() * 128, fr() * 128, 1.2, 1.2); } });
    const sandH = grain(sandC, 0.12, 23, 2);
    const sandTex = tex(sandC, [2, 2]), sandN = normalTex(sandH, 128, 128, 1.4);
    const streakC = canvas(64, 256, (g) => {
      g.clearRect(0, 0, 64, 256);
      for (let i = 0; i < 70; i++) { const x = fr() * 64, w = 1 + fr() * 4; const y0 = fr() * 256, len = 30 + fr() * 120; const q = g.createLinearGradient(0, y0, 0, y0 + len); q.addColorStop(0, 'rgba(240,214,160,0)'); q.addColorStop(0.5, `rgba(240,214,160,${0.5 + fr() * 0.5})`); q.addColorStop(1, 'rgba(240,214,160,0)'); g.fillStyle = q; g.fillRect(x, y0, w, len); g.fillRect(x, y0 - 256, w, len); }
    });
    const streakTex = tex(streakC, [3, 1]);
    // cobwebs
    const webTex = tex(canvas(128, 128, (g) => {
      g.strokeStyle = 'rgba(235,235,240,0.7)'; g.lineWidth = 1;
      for (let k = 0; k < 9; k++) { const a = (k / 8) * PI * 0.5; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 128, Math.sin(a) * 128); g.stroke(); }
      for (let rr = 14; rr < 128; rr += 13) { g.beginPath(); for (let k = 0; k <= 8; k++) { const a = (k / 8) * PI * 0.5, sag = 1 - 0.12 * Math.sin((k % 1 + 0.5) * PI); g[k ? 'lineTo' : 'moveTo'](Math.cos(a) * rr * sag, Math.sin(a) * rr * sag); } g.stroke(); }
    }), [1, 1], false);

    // ============================================================ materials
    const M = {
      paint: K.phys({ vertexColors: true, roughness: 0.55, clearcoat: 0.2, clearcoatRoughness: 0.5 }),
      matte: K.std({ vertexColors: true, roughness: 0.9 }),
      stone: K.std({ vertexColors: true, map: limeTex, normalMap: limeN, normalScale: V2(0.6), roughness: 0.82 }),
      sand: K.std({ vertexColors: true, map: masTex, normalMap: masN, normalScale: V2(0.7), roughness: 0.88 }),
      gran: K.phys({ vertexColors: true, map: graTex, normalMap: graN, normalScale: V2(0.4), roughness: 0.32, clearcoat: 0.35, clearcoatRoughness: 0.3 }),
      gold: K.std({ vertexColors: true, metalness: 1, roughness: 0.26 }),
      metal: K.std({ vertexColors: true, metalness: 0.8, roughness: 0.4 }),
      glow: new T.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
      glaze: K.phys({ vertexColors: true, roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.15 }),
      pile: K.std({ map: sandTex, normalMap: sandN, roughness: 0.95, color: 0xffffff }),
    };
    // (instanced meshes take their colours per instance: materials without vertex colours)
    const IM = {
      matte: K.std({ roughness: 0.9 }),
      glaze: K.phys({ roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.15 }),
      gold: K.std({ metalness: 1, roughness: 0.26 }),
      dust: K.std({ roughness: 1 }),
    };
    const WALL = {
      frieze: K.std({ map: friezeTex, roughness: 0.84 }),
      lime: K.std({ map: limeTex, normalMap: limeN, roughness: 0.8 }),
      granite: K.phys({ map: graTex, normalMap: graN, normalScale: V2(0.4), roughness: 0.3, clearcoat: 0.4, clearcoatRoughness: 0.25 }),
      rock: K.std({ map: rockTex, normalMap: rockN, normalScale: V2(1.2), roughness: 0.95 }),
    };
    const WALL_UV = { frieze: [36, 6], lime: [10, 10], granite: [12, 12], rock: [14, 14] };
    const FLOOR = {
      flags: K.std({ map: flFlags.map, normalMap: flFlags.normalMap, normalScale: V2(0.7), roughness: 0.78 }),
      granite: K.phys({ map: flGran.map, normalMap: flGran.normalMap, normalScale: V2(0.5), roughness: 0.32, clearcoat: 0.5, clearcoatRoughness: 0.25 }),
      rock: K.std({ map: flRock.map, normalMap: flRock.normalMap, normalScale: V2(1.1), roughness: 0.95 }),
    };
    const topMat = K.std({ vertexColors: true, map: masTex, normalMap: masN, normalScale: V2(0.8), roughness: 0.9 });
    const copeMat = K.std({ vertexColors: true, map: masTex, normalMap: masN, normalScale: V2(0.6), roughness: 0.84, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });

    // ============================================================ levels: the Grand Gallery climbs, the descending passage drops
    const sG0 = sAt(86, -66), sG1 = sAt(4, -66), sD0 = sAt(-60, -22), sD1 = sAt(-12, -22);
    const gLen = sRel(sG1, sG0), dA = sRel(sD0, sG0), dB = sRel(sD1, sG0);
    const roadY = (s) => {
      const u = sRel(s, sG0);
      if (u < gLen) return (H * u) / gLen;
      if (u < dA) return H;
      if (u < dB) return H * (1 - (u - dA) / (dB - dA));
      return 0;
    };
    A.roadY = roadY;
    {
      // the climb and the descent as chains of short ramps, the upper level as a chain of platforms
      const chain = (sa, sb) => {
        const len = sRel(sb, sa), n = Math.ceil(len / 4), sl = len / n;
        for (let i = 0; i < n; i++) {
          const s0 = sa + i * sl, s1 = s0 + sl, p0 = track.at(s0), p1 = track.at(s1);
          const y0 = roadY(s0 + 0.001), y1 = roadY(s1 - 0.001), wid = Math.max(p0.w, p1.w) + 3.4;
          const mx = (p0.x + p1.x) / 2, mz = (p0.z + p1.z) / 2, ln = Math.hypot(p1.x - p0.x, p1.z - p0.z) + 0.35;
          if (y1 >= y0) K.ramp(mx, mz, Math.atan2(p1.z - p0.z, p1.x - p0.x), ln, wid, y1 - y0, y0);
          else K.ramp(mx, mz, Math.atan2(p0.z - p1.z, p0.x - p1.x), ln, wid, y0 - y1, y1);
        }
      };
      chain(sG0, sG1); chain(sD0, sD1);
      const up = sRel(sD0, sG1), m = Math.ceil(up / 5), pl = up / m;
      for (let i = 0; i < m; i++) {
        const s0 = sG1 + i * pl - 0.4, s1 = sG1 + (i + 1) * pl + 0.4, p0 = track.at(s0), p1 = track.at(s1);
        K.platform((p0.x + p1.x) / 2, (p0.z + p1.z) / 2, Math.hypot(p1.x - p0.x, p1.z - p0.z) / 2, Math.max(p0.w, p1.w) / 2 + 2.6, Math.atan2(p1.z - p0.z, p1.x - p0.x), H);
      }
    }

    // ============================================================ the masonry: cut tops (a height field), walls, copings
    const topAt = (x, z, n = track.distTo(x, z)) => {
      if (x < KING.x + 0.5 && Math.hypot(x - KING.x, z - KING.z) < KING.r) return H + 1.3;
      if (x > TREAS.x - 0.5 && Math.hypot(x - TREAS.x, z - TREAS.z) < TREAS.r) return 0.7;
      return Math.max(cutP(z), roadY(n.s) + 4.5);
    };
    const stoneTint = (x, z, y) => {
      const n = bil(NF, x * 0.9 + 40, z * 0.9 + 70), n2 = bil(NF2, x * 0.25, z * 0.25);
      const k = 0.44 + n * 0.12 + (n2 - 0.5) * 0.08 + (y - 6) * 0.004;
      return [k * 1.0, k * 0.95, k * 0.9];
    };
    {
      const nx = Math.round((FP.x1 - FP.x0) / 2), nz = Math.round((FP.z1 - FP.z0) / 2);
      const dx = (FP.x1 - FP.x0) / nx, dz = (FP.z1 - FP.z0) / nz;
      const pos = new Float32Array((nx + 1) * (nz + 1) * 3), uv = new Float32Array((nx + 1) * (nz + 1) * 2), col = new Float32Array((nx + 1) * (nz + 1) * 3);
      const on = new Uint8Array((nx + 1) * (nz + 1));
      const edgeTop = []; // the boundary heights (the outer faces start there)
      for (let iz = 0; iz <= nz; iz++) for (let ix = 0; ix <= nx; ix++) {
        const x = FP.x0 + ix * dx, z = FP.z0 + iz * dz, n = track.distTo(x, z), k = iz * (nx + 1) + ix;
        on[k] = n.dist < track.w[n.i] / 2 + 0.15 ? 1 : 0;
        const y = topAt(x, z, n);
        pos.set([x, y, z], k * 3); uv.set([x / 24, -z / 24], k * 2);
        col.set(stoneTint(x, z, y), k * 3);
      }
      const idx = [];
      for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
        const a = iz * (nx + 1) + ix, b = a + 1, c = a + nx + 1, d = c + 1;
        if (on[a] || on[b] || on[c] || on[d]) continue;
        idx.push(a, c, b, b, c, d);
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('uv', new T.BufferAttribute(uv, 2)); g.setAttribute('color', new T.BufferAttribute(col, 3));
      g.setIndex(idx); g.computeVertexNormals();
      meshOf(g, topMat, { cast: false });
      // the pyramid's outer casing: from the cut edge down to the plinth at the slope of a pyramid face
      const per = [];
      for (let ix = 0; ix <= nx; ix++) per.push([ix, nz, 0, 1]); // south edge, west -> east
      for (let iz = nz - 1; iz >= 0; iz--) per.push([nx, iz, 1, 0]); // east edge, south -> north
      for (let ix = nx - 1; ix >= 0; ix--) per.push([ix, 0, 0, -1]); // north edge, east -> west
      for (let iz = 1; iz <= nz; iz++) per.push([0, iz, -1, 0]); // west edge, north -> south
      const cp = [], cu = [], ci = [];
      const slope = 1 / Math.tan((52 * PI) / 180);
      per.forEach(([ix, iz, ox, oz], i) => {
        const k = iz * (nx + 1) + ix, x = pos[k * 3], y = pos[k * 3 + 1], z = pos[k * 3 + 2];
        let mx = ox, mz = oz;
        if ((ix === 0 || ix === nx) && (iz === 0 || iz === nz)) { mx = ix === 0 ? -1 : 1; mz = iz === 0 ? -1 : 1; }
        const run = (y - PL) * slope;
        cp.push(x, y, z, x + mx * run, PL, z + mz * run);
        cu.push(i / 6, (y - PL) / 8, i / 6, 0);
        edgeTop.push(y);
        if (i > 0) { const a = (i - 1) * 2, b = i * 2; ci.push(a, b, a + 1, a + 1, b, b + 1); }
      });
      const cg = new T.BufferGeometry();
      cg.setAttribute('position', new T.Float32BufferAttribute(cp, 3)); cg.setAttribute('uv', new T.Float32BufferAttribute(cu, 2));
      cg.setIndex(ci); cg.computeVertexNormals();
      const casC = canvas(256, 256, (g2) => {
        g2.fillStyle = '#d8ccb2'; g2.fillRect(0, 0, 256, 256);
        g2.fillStyle = 'rgba(90,74,54,0.28)';
        for (let yy = 0; yy < 256; yy += 64) { g2.fillRect(0, yy, 256, 2); for (let xx = (yy / 64) % 2 ? 40 : 100; xx < 256; xx += 150) g2.fillRect(xx, yy, 2, 64); }
      });
      grain(casC, 0.08, 29);
      const casingMat = K.std({ map: tex(casC, [1, 1]), roughness: 0.62, color: 0xb4a68e, side: T.DoubleSide });
      meshOf(cg, casingMat, { cast: false });
    }
    // walls along both road edges (painted plaster, limestone, granite, rough rock) and the copings on top
    const sK0 = sAt(-86, -66), sK1 = sAt(-86, -22), sLo0 = sAt(-26, 20), sLo1 = sAt(-98, 20), sGx = sAt(-40, -66);
    const wallKey = (s) => (inZ(s, sK0, sK1) ? 'granite' : inZ(s, sLo0, sLo1) ? 'rock' : inZ(s, sG0 - 8, sGx) || inZ(s, sD0 - 6, sD1 + 12) ? 'lime' : 'frieze');
    const floorKey = (s) => (inZ(s, sK0, sK1) ? 'granite' : inZ(s, sLo0, sLo1) ? 'rock' : 'flags');
    const wallTop = []; // per side, per row: [s, top]
    {
      const faceL = along(2, true), faceR = along(2, false), copeL = along(3, true), copeR = along(3, false), floor = along(2, false);
      const N = Math.ceil(L / 1.0), ds = L / N;
      for (const side of [-1, 1]) wallTop.push([]);
      for (let i = 0; i <= N; i++) {
        const s = i * ds, p = track.at(s), y0 = roadY(s), w = p.w;
        const fk = floorKey(s);
        const fv = (k) => [p.x + p.nx * (k - 0.5) * (w + 0.6), y0 + 0.02, p.z + p.nz * (k - 0.5) * (w + 0.6), k, s / 24];
        floor.add(fk, i, [fv(0), fv(1)]);
        if (i > 0 && floorKey(s - ds) !== fk) floor.add(floorKey(s - ds), i, [fv(0), fv(1)]);
        for (const side of [-1, 1]) {
          const ex = p.x + p.nx * side * (w / 2), ez = p.z + p.nz * side * (w / 2);
          const ox = p.nx * side, oz = p.nz * side;
          const yt = topAt(ex + ox * 1.2, ez + oz * 1.2);
          wallTop[side < 0 ? 0 : 1].push([s, yt]);
          const faceVerts = (key) => { const [us, vs] = WALL_UV[key], fz = key === 'frieze'; return [[ex, y0, ez, s / us, fz ? 0 : y0 / vs], [ex, yt, ez, s / us, fz ? (yt - y0) / vs : yt / vs]]; };
          const key = wallKey(s), pk = wallKey(s - ds), F = side < 0 ? faceL : faceR;
          F.add(key, i, faceVerts(key));
          if (i > 0 && pk !== key) F.add(pk, i, faceVerts(pk));
          // coping: a band of slightly paler capstones, then out to where the cut top takes over
          const x1 = ex + ox * 1.6, z1 = ez + oz * 1.6, x2 = ex + ox * 3.4, z2 = ez + oz * 3.4;
          const y1 = topAt(x1, z1) + 0.1, y2 = topAt(x2, z2) + 0.06;
          const c0 = stoneTint(ex, ez, yt).map((v) => v * 1.45), c2 = stoneTint(x2, z2, y2);
          const C = side < 0 ? copeL : copeR;
          C.add('c', i, [[ex, yt + 0.1, ez, ex / 24, -ez / 24, ...c0], [x1, Math.max(y1, yt + 0.1), z1, x1 / 24, -z1 / 24, ...c0], [x2, y2, z2, x2 / 24, -z2 / 24, ...c2]]);
        }
      }
      for (const k of new Set([...faceL.keys(), ...faceR.keys()])) {
        const gs = [faceL.geo(k), faceR.geo(k)].filter(Boolean);
        for (const g of gs) g.deleteAttribute('color');
        meshOf(BU.mergeGeometries(gs, false), WALL[k], { cast: true });
      }
      meshOf(BU.mergeGeometries([copeL.geo('c'), copeR.geo('c')], false), copeMat, { cast: false });
      for (const k of floor.keys()) { const g = floor.geo(k, true); if (g) { g.deleteAttribute('color'); meshOf(g, FLOOR[k]); } }
    }
    // physics: the walls are capsule chains along both edges (long ones on the straights)
    for (const side of [-1, 1]) {
      const pts = track.edgePoints(side, 2, 0.7);
      let a = pts[0];
      for (let i = 1; i <= pts.length; i++) {
        const b = pts[i % pts.length], nxt = pts[(i + 1) % pts.length];
        const da = Math.atan2(b.z - a.z, b.x - a.x), db = Math.atan2(nxt.z - b.z, nxt.x - b.x);
        const bend = Math.abs(mod(db - da + PI, TAU) - PI);
        if (i === pts.length || bend > 0.012 || Math.hypot(b.x - a.x, b.z - a.z) > 36) { K.capsule(a.x, a.z, b.x, b.z, 0.7, 50); a = b; }
      }
    }
    const wallTopAt = (side, s) => { const arr = wallTop[side < 0 ? 0 : 1], i = clamp(Math.round((mod(s, L) / L) * (arr.length - 1)), 0, arr.length - 1); return arr[i][1]; };

    // ============================================================ the Grand Gallery's corbelled north wall
    {
      const sA = sG0 - 4, sB = sGx, n = Math.ceil(sRel(sB, sA) / 1.5);
      const side = 1; // heading west, the right-hand side is north
      const risers = along(2, false), tops = along(2, false);
      for (let i = 0; i <= n; i++) {
        const s = sA + (sRel(sB, sA) * i) / n, p = track.at(s), base = wallTopAt(side, s) + 0.1;
        for (let k = 0; k < 6; k++) {
          const o = p.w / 2 - k * 0.32 + 0.02, y0 = base + k * 1.75, y1 = y0 + 1.75, back = p.w / 2 + 4.6;
          const ix = p.x + p.nx * side * o, iz = p.z + p.nz * side * o, bx = p.x + p.nx * side * back, bz = p.z + p.nz * side * back;
          const ck = 0.92 + 0.05 * (k % 2);
          risers.add('r' + k, i, [[ix, y0, iz, s / 10, y0 / 10, ck, ck, ck], [ix, y1, iz, s / 10, y1 / 10, ck, ck, ck]]);
          tops.add('t' + k, i, [[ix, y1, iz, ix / 10, iz / 10, ck, ck, ck], [bx, y1, bz, bx / 10, bz / 10, ck, ck, ck]]);
        }
      }
      const parts = [];
      for (const A2 of [risers, tops]) for (const k of A2.keys()) { const g = A2.geo(k); if (g) parts.push(g); }
      meshOf(BU.mergeGeometries(parts, false), M.stone, { cast: true });
    }
    // the back of the shell: a few stepped courses along the north edge
    {
      for (let k = 0; k < 4; k++) {
        const x0 = FP.x0 + 6 + k * 14, x1 = FP.x1 - 6 - k * 14, d = 6 - k * 1.2, y0 = cutP(FP.z0) + k * 2.6;
        put(box(x1 - x0, 2.6, d), 0xe0d2b6, { x: (x0 + x1) / 2, y: y0 + 1.3, z: FP.z0 + d / 2 }, M.stone, true);
      }
    }

    // ============================================================ the plinth, the gallery floor, the label card
    {
      const run = (5.5 - PL) / Math.tan((52 * PI) / 180);
      const px0 = FP.x0 - 30, px1 = FP.x1 + 30, pz0 = FP.z0 - 30, pz1 = FP.z1 + run + 22;
      const lac = K.phys({ color: 0x17110d, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2 });
      K.mesh(box(px1 - px0, PL - GROUND, pz1 - pz0), lac, (px0 + px1) / 2, (PL + GROUND) / 2, (pz0 + pz1) / 2, { cast: false });
      for (const [w, d, x, z] of [[px1 - px0 + 0.6, 0.8, (px0 + px1) / 2, pz1], [px1 - px0 + 0.6, 0.8, (px0 + px1) / 2, pz0], [0.8, pz1 - pz0, px0, (pz0 + pz1) / 2], [0.8, pz1 - pz0, px1, (pz0 + pz1) / 2]]) put(box(w, 0.8, d), 0xb08a48, { x, y: PL - 0.4, z }, M.metal, false);
      // dark felt on the plinth top
      K.mesh(flat(px1 - px0 - 1, pz1 - pz0 - 1), K.std({ color: 0x241a14, roughness: 0.95 }), (px0 + px1) / 2, PL + 0.02, (pz0 + pz1) / 2, { cast: false });
      const fl = TX.woodTextures({ size: 512, seed: 41, planks: 4, base: 0x3a2a1e, dark: 0x22180f, light: 0x5a4430, ringFreq: 18, gap: 0.004, roughBase: 0.4 });
      for (const t of Object.values(fl)) t.repeat.set(10, 10);
      K.mesh(flat(1800, 1800), K.std({ map: fl.map, normalMap: fl.normalMap, roughness: 0.45 }), 0, GROUND, 0, { cast: false });
      // the museum label, leaning on a little brass stand in front of the model
      const lc = canvas(640, 360, (g) => {
        g.fillStyle = '#f2ead6'; g.fillRect(0, 0, 640, 360);
        g.strokeStyle = '#8a6a2a'; g.lineWidth = 4; g.strokeRect(14, 14, 612, 332); g.lineWidth = 1.5; g.strokeRect(22, 22, 596, 316);
        g.fillStyle = '#2a1e12'; g.textAlign = 'left';
        g.font = '700 40px Georgia, serif'; g.fillText('The Pyramid Interior', 44, 78);
        g.font = 'italic 22px Georgia, serif'; g.fillText('Cutaway model, scale about 1:150', 46, 112);
        g.fillStyle = '#8a6a2a'; g.fillRect(44, 130, 552, 2);
        g.fillStyle = '#2a1e12'; g.font = '19px Georgia, serif';
        const lines = ['Entrance passage  ·  Grand Gallery  ·  Antechamber', 'Burial chamber with granite sarcophagus', 'Treasury  ·  Subterranean chamber', 'Limestone, granite, pigment and gold leaf.', 'Workshop of the museum model makers.'];
        lines.forEach((t, i) => g.fillText(t, 46, 168 + i * 30));
        g.fillStyle = '#c0392b'; g.beginPath(); g.moveTo(560, 310); g.lineTo(590, 260); g.lineTo(620, 310); g.fill();
        g.fillStyle = '#2a5aa8'; g.fillRect(520, 296, 30, 14);
      });
      const card = new T.Mesh(new T.PlaneGeometry(26, 14.6), K.std({ map: tex(lc, [1, 1], false), roughness: 0.75 }));
      card.position.set(-32, PL + 6.4, FP.z1 + run + 7); card.rotation.x = -0.9; card.castShadow = true; card.receiveShadow = true; K.group.add(card);
      put(box(26.6, 0.5, 1.2), 0xb08a48, { x: -32, y: PL + 0.9, z: FP.z1 + run + 11.6 }, M.metal);
      put(box(0.5, 8, 0.5), 0xb08a48, { x: -32, y: PL + 4, z: FP.z1 + run + 9.4, rx: 0.6 }, M.metal);
      AO(-32, PL, FP.z1 + run + 9, 15, 4, 0.5);
      // brass stanchions with a red rope along the front of the plinth (on the floor below)
      for (let i = 0; i < 7; i++) { const x = -150 + i * 50; put(cyl(1.2, 1.6, 26, 10), 0xb08a48, { x, y: GROUND + 13, z: pz1 + 24 }, M.metal); put(sph(1.6, 10, 8), 0xd0aa58, { x, y: GROUND + 26.5, z: pz1 + 24 }, M.metal); }
    }

    // ============================================================ start line: a band of lapis and gold squares
    {
      const p = track.at(START_S);
      const c = canvas(256, 32, (g) => { for (let y = 0; y < 2; y++) for (let x = 0; x < 16; x++) { g.fillStyle = (x + y) % 2 ? '#1d3f8a' : '#e8c454'; g.fillRect(x * 16, y * 16, 16, 16); } });
      const m = K.mesh(new T.PlaneGeometry(p.w, 2.6), K.std({ map: tex(c, [1, 1], false), roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), p.x, 0.05, p.z, { cast: false });
      m.rotation.order = 'YXZ'; m.rotation.y = -p.angle + PI / 2; m.rotation.x = -PI / 2;
    }

    // ============================================================ the stone doors
    {
      const slabMat = K.phys({ map: graTex, normalMap: graN, normalScale: V2(0.5), roughness: 0.3, clearcoat: 0.4, clearcoatRoughness: 0.25, color: 0x8a7a76 });
      const goldMat = K.metal(0xd8a838, 0.28);
      const discC = canvas(64, 256, (g) => {
        g.translate(64, 0); g.rotate(PI / 2); // drawn across the slab's top
        g.fillStyle = '#e6d2a4'; g.fillRect(0, 0, 256, 64);
        g.fillStyle = '#c0392b'; g.beginPath(); g.arc(128, 32, 15, 0, TAU); g.fill();
        for (const sd of [-1, 1]) for (let k = 0; k < 4; k++) { g.fillStyle = ['#2a5aa8', '#2f8a5a', '#c0392b', '#2a5aa8'][k]; g.beginPath(); g.moveTo(128 + sd * 18, 22 + k * 5); g.quadraticCurveTo(128 + sd * 70, 12 + k * 6, 128 + sd * (118 - k * 14), 18 + k * 7); g.lineTo(128 + sd * (116 - k * 14), 24 + k * 7); g.quadraticCurveTo(128 + sd * 70, 20 + k * 6, 128 + sd * 18, 28 + k * 5); g.fill(); }
        g.fillStyle = '#e8c040'; g.beginPath(); g.arc(128, 32, 6, 0, TAU); g.fill();
      });
      const discMat = K.std({ map: tex(discC, [1, 1], false), roughness: 0.7 });
      const gemsL = [], strips = [];
      DOOR_AT.forEach(([dx, dz], k) => {
        const s = sAt(dx, dz), p = track.at(s), y = roadY(s), w = p.w;
        const ph = mod(DOOR.C + DOOR.R + 0.5 - sRel(s, START_S) / DOOR.wave, DOOR.P);
        const col = K.box(p.x, p.z, DOOR.th / 2, w / 2 + 0.8, p.angle, 0);
        const D = { k, s, x: p.x, z: p.z, y, w, c: Math.cos(p.angle), sn: Math.sin(p.angle), ph, col, hold: false, phase: -1, last: null };
        // jambs and the lintel (local x along the road, local z across, +z = the driver's right)
        const f = frame(p.x, y, p.z, -p.angle);
        const jh = DOOR.top + DOOR.sh + 1.4;
        for (const sd of [-1, 1]) {
          const jz = sd * (w / 2 + 1.25);
          f(rbox(2.6, jh, 2.5, 0.12), 0xd8c8a8, { y: jh / 2, z: jz }, M.stone);
          f(box(2.9, 0.6, 2.8), 0xc9a86a, { y: jh + 0.3, z: jz }, M.sand);
          f(box(2.7, 0.4, 0.5), 0x2a5aa8, { y: jh - 1.6, z: jz - sd * 1.05 }, M.paint, false);
          f(box(2.7, 0.4, 0.5), 0xc0392b, { y: jh - 2.2, z: jz - sd * 1.05 }, M.paint, false);
          f(box(0.6, jh, 0.4), 0x2a2420, { x: 0, y: jh / 2, z: sd * (w / 2 + 0.05) }, M.matte, false); // the slot
          gemsL.push({ x: p.x + p.nx * jz, y: y + jh + 0.95, z: p.z + p.nz * jz, k });
          AO(p.x + p.nx * jz, y, p.z + p.nz * jz, 2.4, 2.4, 0.5, p.angle);
        }
        // the groove in the floor
        f(box(DOOR.th + 0.3, 0.06, w), 0x1a1410, { y: 0.03 }, M.matte, false);
        for (const sd of [-1, 1]) strips.push({ x: p.x + Math.cos(p.angle) * sd * 2.4, y: y + 0.08, z: p.z + Math.sin(p.angle) * sd * 2.4, ry: -p.angle, sx: 0.9, sy: 1, sz: w - 0.4, color: 0x000000, k });
        // the slab (moves): granite with gilded edges and a carved winged disc on top
        const g = new T.Group(); g.position.set(p.x, y + DOOR.top + DOOR.sh / 2, p.z); g.rotation.y = -p.angle; K.group.add(g);
        const slab = new T.Mesh(box(DOOR.th, DOOR.sh, w + 1.1), [slabMat, slabMat, discMat, slabMat, slabMat, slabMat]); slab.castShadow = true; slab.receiveShadow = true; g.add(slab);
        const gb = BU.mergeGeometries([box(0.14, 0.34, w + 1.2).translate(DOOR.th / 2, DOOR.sh / 2 - 0.12, 0), box(0.14, 0.34, w + 1.2).translate(-DOOR.th / 2, DOOR.sh / 2 - 0.12, 0), box(DOOR.th + 0.1, 0.3, w + 1.2).translate(0, -DOOR.sh / 2 + 0.15, 0), box(DOOR.th + 0.12, 1.6, 1.6).translate(0, 0.2, 0)], false);
        const gm = new T.Mesh(gb, goldMat); g.add(gm);
        D.g = g;
        A.doors.push(D);
      });
      // lamps on the jambs (turquoise open, amber flashing in the warning, red closed) and glow strips on the floor
      A.gems = K.instances(sph(0.55, 12, 8), new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), gemsL.map((q) => ({ ...q, color: 0x30d0c0 })), { colors: true, cast: false, receive: false });
      A.gemK = gemsL.map((q) => q.k);
      {
        const pos = new Float32Array(gemsL.length * 3), cc = new Float32Array(gemsL.length * 3);
        gemsL.forEach((q, i) => pos.set([q.x, q.y + 0.2, q.z], i * 3));
        const pg = new T.BufferGeometry(); pg.setAttribute('position', new T.BufferAttribute(pos, 3)); pg.setAttribute('color', new T.BufferAttribute(cc, 3));
        A.gemHalo = new T.Points(pg, new T.PointsMaterial({ size: 6, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false }));
        A.gemHalo.renderOrder = 4; K.group.add(A.gemHalo);
      }
      A.strips = K.instances(flat(1, 1), addMat(poolTex), strips, { colors: true, cast: false, receive: false });
      A.strips.renderOrder = 2;
      A.stripK = strips.map((q) => q.k);
    }

    // ============================================================ the sand falls: a cracked ceiling block juts from the north wall
    {
      const pourMat = new T.MeshStandardMaterial({ map: streakTex, alphaMap: streakTex, color: 0xf0d8a0, transparent: true, depthWrite: false, roughness: 1, side: T.DoubleSide });
      const markC = canvas(128, 128, (g) => {
        g.strokeStyle = 'rgba(180,70,32,0.75)'; g.lineWidth = 5; g.setLineDash([12, 8]); g.beginPath(); g.arc(64, 64, 56, 0, TAU); g.stroke();
        g.setLineDash([]); const q = g.createRadialGradient(64, 64, 0, 64, 64, 50); q.addColorStop(0, 'rgba(214,180,120,0.75)'); q.addColorStop(1, 'rgba(214,180,120,0)'); g.fillStyle = q; g.fillRect(0, 0, 128, 128);
      });
      const markMat = K.std({ map: tex(markC, [1, 1], false), transparent: true, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
      const pileGeo = K.lathe([[0.001, 1], [0.2, 0.97], [0.5, 0.72], [0.8, 0.32], [1, 0.04], [1.04, 0]], 28);
      for (const S0 of SAND_AT) {
        const s = sAt(S0.x, S0.z), p = track.at(s), y = roadY(s);
        const side = p.nz < 0 ? 1 : -1; // the north side
        const lat = side * (p.w / 2 - SAND.edge), q = track.place(s, lat);
        const S = { s, x: q.x, z: q.z, y, lat, w: p.w, ph: S0.ph, st: { trickle: 0, pour: 0, flow: 0, pile: 0, slow: false }, phase: -1 };
        S.surf = K.surface('normal', { x: q.x, z: q.z, r: 1.2 });
        S.free = -side * Math.min(p.w / 2 - 2.6, SAND.R - SAND.edge + 3.4); // the lane on the far side
        // the ceiling block over the spot, resting on the north wall and broken off over the road
        const top = wallTopAt(side, s), ex = p.x + p.nx * side * (p.w / 2), ez = p.z + p.nz * side * (p.w / 2);
        const reach = SAND.edge + 1.0, f = frame(ex, top, ez, -p.angle);
        // (local +z is the driver's right; the block juts towards the road centre)
        const inward = -side;
        f(rbox(4.2, 1.3, reach + 4, 0.2), 0xd2c09c, { y: 0.75, z: inward * (reach / 2 - 2) }, M.stone);
        f(rbox(1.6, 0.9, 1.6, 0.2), 0xb8a07a, { x: 1.4, y: 1.8, z: inward * (reach - 2.2), ry: 0.4 }, M.stone);
        f(rbox(1.1, 0.7, 1.2, 0.2), 0xc8b088, { x: -1.5, y: 1.6, z: inward * (reach - 3.4), ry: 0.9 }, M.stone);
        f(cyl(0.95, 0.7, 1.4, 12), 0x2a2018, { y: 0.75, z: inward * (reach - 0.4) }, M.matte, false);
        AO(q.x, y, q.z, 3.5, 3.5, 0.2);
        // the mark on the floor
        const mk = new T.Mesh(flat(SAND.R * 2.2, SAND.R * 2.2), markMat); mk.position.set(q.x, y + 0.07, q.z); mk.receiveShadow = true; mk.renderOrder = 1; K.group.add(mk);
        // the pour and the heap (animated)
        const colH = top - y + 0.6;
        const pour = new T.Mesh(cyl(0.95, 1.45, colH, 16, true), pourMat.clone()); pour.position.set(q.x, y + colH / 2, q.z); pour.renderOrder = 3; K.group.add(pour);
        const core = new T.Mesh(cyl(0.36, 0.6, colH, 10, true), M.pile); core.position.y = 0; core.scale.set(1, 1, 1); pour.add(core);
        const pile = new T.Mesh(pileGeo, M.pile); pile.position.set(q.x, y + 0.02, q.z); pile.castShadow = true; pile.receiveShadow = true; pile.scale.set(0.001, 0.001, 0.001); K.group.add(pile);
        S.pour = pour; S.pile = pile; S.colH = colH; S.top = top;
        A.sands.push(S);
      }
    }

    // ============================================================ torches on the walls that face the camera
    const torches = [];
    {
      const busy = A.doors.map((D) => D.s).concat(A.sands.map((S) => S.s), [START_S]);
      for (let s = 12; s < L; s += 38) {
        const p = track.at(s);
        if (Math.abs(p.tz) > 0.3) continue;
        if (busy.some((b) => Math.abs(mod(s - b + L / 2, L) - L / 2) < 10)) continue;
        const side = p.nz < 0 ? 1 : -1, y = roadY(s);
        torches.push({ s, side, p, y });
      }
      // a pair in the King's Chamber and in the treasury, on their back walls
      for (const [x, z] of [[-120, -50], [-120, -38], [80, -8], [80, 6]]) { const s = sAt(x, z), p = track.at(s); torches.push({ s, side: 1, p, y: roadY(s), out: true }); }
      const flames = [], halos = [], glows = [], tpools = [];
      for (const t of torches) {
        const { p, side } = t;
        let fx, fz, wx, wz, nx2, nz2;
        if (t.out) { // on the outer wall of a hairpin: the outward normal from the hairpin centre
          const ctr = p.x < 0 ? KING : TREAS, dd = Math.hypot(p.x - ctr.x, p.z - ctr.z) || 1, ux = (p.x - ctr.x) / dd, uz = (p.z - ctr.z) / dd;
          const off = dd + p.w / 2;
          wx = ctr.x + ux * off; wz = ctr.z + uz * off; nx2 = -ux; nz2 = -uz;
        } else { wx = p.x + p.nx * side * (p.w / 2); wz = p.z + p.nz * side * (p.w / 2); nx2 = -p.nx * side; nz2 = -p.nz * side; }
        fx = wx + nx2 * 0.9; fz = wz + nz2 * 0.9;
        const y = t.y, ry = Math.atan2(nx2, nz2);
        const f = frame(wx, y, wz, ry);
        f(box(0.8, 0.5, 0.9), 0x3a2a1a, { y: 3.4, z: 0.45 }, M.metal);
        f(cyl(0.38, 0.16, 1.3, 8), 0x6a4a2a, { y: 3.9, z: 0.9 }, M.metal);
        f(cyl(0.42, 0.42, 0.25, 8), 0xc8a050, { y: 4.55, z: 0.9 }, M.gold);
        t.fx = fx; t.fz = fz; t.fy = y + 5.1; t.ph = r() * 10;
        flames.push([fx, y + 5.0, fz]); halos.push([fx, y + 5.2, fz]);
        glows.push({ x: wx + nx2 * 0.08, y: y + 3.2, z: wz + nz2 * 0.08, ry, sx: 9, sy: 5.2, sz: 1, color: 0x000000 });
        tpools.push({ x: fx + nx2 * 3.5, y: y + 0.1, z: fz + nz2 * 3.5, ry: -Math.atan2(nz2, nx2), sx: 12, sy: 1, sz: 18, color: 0x000000 });
        AO(wx + nx2 * 0.4, y, wz + nz2 * 0.4, 1.4, 1.4, 0.3);
      }
      const ptsOf = (list, size, order) => {
        const pos = new Float32Array(list.length * 3), cc = new Float32Array(list.length * 3);
        list.forEach((q, i) => pos.set(q, i * 3));
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(cc, 3));
        const m = new T.Points(g, new T.PointsMaterial({ size, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false }));
        m.renderOrder = 5; K.group.add(m); return m;
      };
      A.torch = {
        list: torches,
        flames: ptsOf(flames, 2.6, 5), halos: ptsOf(halos, 9, 5),
        glows: K.instances(new T.PlaneGeometry(1, 1), addMat(poolTex), glows, { colors: true, cast: false, receive: false }),
        pools: K.instances(flat(1, 1), addMat(poolTex), tpools, { colors: true, cast: false, receive: false }),
      };
      A.torch.glows.renderOrder = 2; A.torch.pools.renderOrder = 2;
    }

    // ============================================================ the King's Chamber: granite dais, sarcophagus and lid, jars, guardians
    {
      const y = H + 1.3, cx = KING.x - 5.5, cz = KING.z;
      // the dais top in granite
      const dg = new T.CircleGeometry(10.8, 40, PI / 2, PI).rotateX(-PI / 2);
      const dm = new T.Mesh(dg, FLOOR.granite); dm.position.set(KING.x + 0.4, y + 0.05, KING.z); dm.receiveShadow = true; K.group.add(dm);
      const f = frame(cx, y, cz, 0);
      f(rbox(3.6, 2.6, 8.2, 0.25), 0xb09890, { y: 1.3 }, M.gran);
      f(box(3.0, 0.3, 7.6), 0x1a1210, { y: 2.62 }, M.matte, false);
      f(rbox(3.8, 0.8, 8.4, 0.3), 0xb8a098, { x: 0.9, y: 3.1, z: 1.4, ry: 0.22, rz: -0.08 }, M.gran);
      f(box(0.2, 0.06, 6), 0xd8a838, { x: 0.9, y: 3.52, z: 1.4, ry: 0.22 }, M.gold);
      AO(cx, y, cz, 4, 6, 0.55);
      // canopic jars and a gilded shrine
      for (let i = 0; i < 4; i++) {
        const jx = cx + 4.4, jz = cz - 3 + i * 2;
        put(K.lathe([[0.001, 0], [0.55, 0], [0.7, 0.6], [0.65, 1.4], [0.45, 1.65], [0.5, 1.8], [0.001, 1.85]], 12), 0xe2d8c0, { x: jx, y, z: jz }, M.glaze);
        put(sph(0.42, 10, 8), [0xd8a838, 0x2a2420, 0xd8a838, 0x6a4a2a][i], { x: jx, y: y + 2.05, z: jz }, i % 2 ? M.paint : M.gold);
        AO(jx, y, jz, 0.9, 0.9, 0.4);
      }
      put(rbox(2.4, 2.4, 2.4, 0.1), 0xd8a838, { x: cx - 1.0, y: y + 1.2, z: cz + 6.6 }, M.gold);
      put(new T.ConeGeometry(1.9, 1.3, 4), 0xd8a838, { x: cx - 1.0, y: y + 3.05, z: cz + 6.6, ry: PI / 4 }, M.gold);
      put(box(2.5, 0.5, 2.5), 0x2a5aa8, { x: cx - 1.0, y: y + 1.6, z: cz + 6.6 }, M.paint);
      // two guardians at the chamber door, on the north side
      const guardian = (x, z, ry, yb) => {
        const g = frame(x, yb, z, ry);
        g(box(1.6, 0.8, 2.4), 0xc9b48a, { y: 0.4 }, M.stone);
        g(K.lathe([[0.001, 0], [0.5, 0], [0.55, 1.6], [0.7, 1.9], [0.62, 2.9], [0.4, 3.1], [0.001, 3.1]], 12), 0x1e1a18, { y: 0.8 }, M.paint);
        g(box(1.0, 0.7, 0.9), 0xd8a838, { y: 2.2 }, M.gold);
        g(sph(0.42, 10, 8), 0x1e1a18, { y: 4.25 }, M.paint);
        g(box(1.0, 0.9, 0.5), 0xd8a838, { y: 4.3, z: -0.2 }, M.gold);
        g(cyl(0.06, 0.06, 3.6, 5), 0xd8a838, { x: 0.5, y: 2.6, z: 0.3 }, M.gold);
        AO(x, yb, z, 1.4, 1.6, 0.5);
      };
      for (const s0 of [sK0 - 2]) {
        const p = track.at(s0), side = p.nz < 0 ? 1 : -1, o = side * (p.w / 2 + 1.8);
        guardian(p.x + p.nx * o, p.z + p.nz * o, -p.angle + PI, wallTopAt(side, s0) + 0.1);
      }
      for (const s0 of [sK1 + 2]) {
        const p = track.at(s0), side = p.nz < 0 ? 1 : -1, o = side * (p.w / 2 + 1.8);
        guardian(p.x + p.nx * o, p.z + p.nz * o, -p.angle, wallTopAt(side, s0) + 0.1);
      }
    }

    // ============================================================ the treasury: chests, a chariot, statues, urns, coins
    {
      const y = 0.7, gmat = M.gold;
      const tg = new T.CircleGeometry(9.8, 40, -PI / 2, PI).rotateX(-PI / 2);
      const tm = new T.Mesh(tg, K.std({ map: flFlags.map, color: 0xe8c890, roughness: 0.7 })); tm.position.set(TREAS.x - 0.4, y + 0.05, TREAS.z); tm.receiveShadow = true; K.group.add(tm);
      const chest = (x, z, ry, sc = 1) => {
        const f = frame(x, y, z, ry);
        f(rbox(3.4 * sc, 1.8 * sc, 2.2 * sc, 0.12), 0x7a3a1c, { y: 0.9 * sc }, M.paint);
        f(cyl(1.1 * sc, 1.1 * sc, 3.4 * sc, 12, false).rotateZ(PI / 2), 0x8a4420, { y: 1.8 * sc, sy: 0.5 }, M.paint);
        for (const bx of [-1.2, 0, 1.2]) f(box(0.3 * sc, 2.5 * sc, 2.3 * sc), 0xd8a838, { x: bx * sc, y: 1.2 * sc }, gmat);
        f(box(0.6 * sc, 0.6 * sc, 0.12), 0xd8a838, { y: 1.3 * sc, z: 1.12 * sc }, gmat);
        AO(x, y, z, 2.2 * sc, 1.6 * sc, 0.5, -ry);
      };
      // laid out round the dais (angle from east, radius), turned along the curve
      const at = (deg, rad) => [TREAS.x + Math.cos((deg * PI) / 180) * rad, TREAS.z + Math.sin((deg * PI) / 180) * rad, -((deg + 90) * PI) / 180];
      { const [x, z, ry] = at(-58, 7.1); chest(x, z, ry); }
      { const [x, z, ry] = at(-12, 7.4); chest(x, z, ry, 0.8); }
      { const [x, z, ry] = at(62, 7.4); chest(x, z, ry, 0.9); }
      POOL(TREAS.x + 4, y, TREAS.z, 9, 10, 0xffb040, 0.16);
      POOL(KING.x - 5, H + 1.3, KING.z, 7, 9, 0xff9050, 0.12);
      // the chariot
      {
        const f = frame(TREAS.x + 2.8, y, TREAS.z - 1.5, -PI / 2);
        for (const sd of [-1, 1]) {
          f(new T.TorusGeometry(1.35, 0.12, 6, 20), 0xd8a838, { y: 1.45, z: sd * 1.7 }, gmat);
          for (let k = 0; k < 3; k++) f(box(2.6, 0.12, 0.12), 0xd8a838, { y: 1.45, z: sd * 1.7, rz: (k * PI) / 3 }, gmat);
        }
        f(cyl(0.12, 0.12, 3.6, 6).rotateX(PI / 2), 0x6a4a2a, { y: 1.45 }, M.paint);
        f(rbox(1.8, 1.4, 2.6, 0.3), 0xc8962e, { x: -0.3, y: 2.2 }, gmat);
        f(box(0.12, 1.0, 2.4), 0x2a5aa8, { x: 0.62, y: 2.3 }, M.paint);
        f(cyl(0.1, 0.1, 3.4, 6).rotateZ(PI / 2 - 0.12), 0x6a4a2a, { x: 2.3, y: 1.6 }, M.paint);
        AO(TREAS.x + 2.8, y, TREAS.z, 2.6, 3.2, 0.5);
      }
      // a seated cat and a recumbent dog in black with gold
      {
        const [cx0, cz0] = at(-86, 7.6), f = frame(cx0, y, cz0, PI);
        f(box(1.4, 0.6, 2.6), 0xd8a838, { y: 0.3 }, gmat);
        f(K.lathe([[0.001, 0], [0.7, 0], [0.8, 0.8], [0.5, 2.0], [0.35, 2.4], [0.001, 2.45]], 12), 0x1a1614, { y: 0.6, sz: 0.8 }, M.paint);
        f(sph(0.42, 10, 8), 0x1a1614, { y: 3.2 }, M.paint);
        for (const sd of [-1, 1]) f(new T.ConeGeometry(0.16, 0.5, 4), 0x1a1614, { x: sd * 0.2, y: 3.6 }, M.paint);
        f(new T.TorusGeometry(0.42, 0.06, 4, 12), 0xd8a838, { y: 2.55, rx: PI / 2 }, gmat);
        AO(cx0, y, cz0, 1.2, 1.6, 0.5);
        const [dx0, dz0, dry] = at(26, 7.6), d = frame(dx0, y, dz0, dry);
        d(box(3.6, 0.9, 1.4), 0x2a1e16, { y: 0.45 }, M.paint);
        d(rbox(3.0, 1.0, 1.0, 0.4), 0x141210, { y: 1.4 }, M.paint);
        d(sph(0.6, 10, 8), 0x141210, { x: 1.5, y: 2.3 }, M.paint);
        for (const sd of [-1, 1]) d(new T.ConeGeometry(0.2, 0.9, 4), 0x141210, { x: 1.4, y: 3.0, z: sd * 0.25 }, M.paint);
        d(box(1.2, 0.2, 1.2), 0xd8a838, { x: 1.2, y: 1.95 }, gmat);
        AO(dx0, y, dz0, 2.4, 1.2, 0.5, -dry);
      }
      // urns and jars on the dais
      for (const [x, z, sc, c] of [[...at(-34, 7.6), 0.9, 0xb85a2a], [...at(86, 7.4), 0.8, 0x2f8a8a], [...at(44, 4.2), 0.7, 0xc8a050]].map((q) => [q[0], q[1], q[3], q[4]])) {
        put(K.lathe([[0.001, 0], [0.6, 0], [1.1, 0.7], [1.2, 1.5], [0.7, 2.4], [0.55, 2.7], [0.75, 2.9], [0.001, 2.9]].map(([a, b]) => [a * sc, b * sc]), 16), c, { x, y, z }, M.glaze);
        AO(x, y, z, 1.4 * sc, 1.4 * sc, 0.5);
      }
      // gold coin heaps on the dais
      const coins = [];
      for (let i = 0; i < (lowQ ? 120 : 240); i++) {
        const a = r.range(-PI / 2, PI / 2), d = Math.sqrt(r()) * (TREAS.r - 2.5);
        const x = TREAS.x + Math.cos(a) * d, z = TREAS.z + Math.sin(a) * d;
        coins.push({ x, y: y + 0.08 + r() * 0.12, z, rx: r.range(-0.4, 0.4), rz: r.range(-0.4, 0.4), ry: r() * 6, s: r.range(0.85, 1.2), color: r.pick([0xe8b840, 0xd8a030, 0xf0c858]) });
      }
      for (const [hx, hz] of [at(-30, 3.8), at(14, 4.6)]) {
        for (let i = 0; i < 40; i++) { const a = r() * TAU, d = r() * 1.6; coins.push({ x: hx + Math.cos(a) * d, y: y + 0.1 + (1.6 - d) * 0.5 * r(), z: hz + Math.sin(a) * d, rx: r.range(-0.8, 0.8), rz: r.range(-0.8, 0.8), ry: r() * 6, s: 1, color: r.pick([0xe8b840, 0xd8a030, 0xf0c858]) }); }
      }
      A.coinGeo = cyl(0.32, 0.32, 0.08, 10);
      K.instances(A.coinGeo, IM.gold, coins, { colors: true, cast: false });
      // pushable urns and coin heaps on the outside of the bend (they roll and slide when you hit them)
      const sT = sAt(83, -1);
      const urnGeo = K.lathe([[0.001, 0], [0.55, 0], [1.05, 0.7], [1.15, 1.5], [0.7, 2.3], [0.5, 2.6], [0.7, 2.8], [0.001, 2.8]], 18);
      const urnMat = K.phys({ color: 0xb8622e, roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.25 });
      const bandMat = K.metal(0xd8a838, 0.3);
      for (const [ds, lat, kind] of [[-18, -8.2, 'urn'], [-9, -9.2, 'coins'], [2, -9.3, 'urn'], [12, -9, 'coins'], [21, -8.2, 'urn']]) {
        const q = track.place(sT + ds, lat), yy = roadY(sT + ds);
        if (kind === 'urn') {
          const g = new T.Group(); const u = new T.Mesh(urnGeo, urnMat); u.position.y = -1.4; u.castShadow = true; g.add(u);
          const b = new T.Mesh(new T.TorusGeometry(1.12, 0.08, 6, 20).rotateX(PI / 2), bandMat); b.position.y = 0.1; g.add(b);
          g.position.set(q.x, yy + 1.4, q.z); K.add(g); b.castShadow = false;
          K.physics.addDynamic({ x: q.x, z: q.z, r: 1.15, m: 1.3, h: 2.8, mesh: g, friction: 8, baseY: yy + 1.4 });
        } else {
          const g = new T.Group();
          const heap = new T.Mesh(K.lathe([[0.001, 0.8], [0.8, 0.6], [1.4, 0.2], [1.5, 0]], 16), M.gold); heap.castShadow = true; g.add(heap);
          heap.geometry = heap.geometry.clone(); const cc = new Float32Array(heap.geometry.attributes.position.count * 3).fill(1); cc.forEach((_, i) => { cc[i] = [0.95, 0.75, 0.3][i % 3]; }); heap.geometry.setAttribute('color', new T.BufferAttribute(cc, 3));
          g.position.set(q.x, yy, q.z); K.add(g);
          K.physics.addDynamic({ x: q.x, z: q.z, r: 1.5, m: 0.8, h: 1.0, mesh: g, friction: 24, slide: true, baseY: yy });
        }
      }
    }

    // ============================================================ the shaft down to a lower chamber (in the masonry)
    {
      const x = -38, z = 41, yt = topAt(x, z);
      const sc = canvas(128, 128, (g) => { const q = g.createLinearGradient(0, 0, 0, 128); q.addColorStop(0, '#2a1e14'); q.addColorStop(1, '#050302'); g.fillStyle = '#050302'; g.fillRect(0, 0, 128, 128); g.fillStyle = q; g.fillRect(0, 0, 128, 22); g.fillStyle = '#1e140c'; g.fillRect(0, 0, 18, 128); g.fillRect(110, 0, 18, 128); g.strokeStyle = '#6a4a2a'; g.lineWidth = 3; for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(52, 20 + k * 18); g.lineTo(76, 20 + k * 18); g.stroke(); } g.beginPath(); g.moveTo(52, 10); g.lineTo(52, 128); g.moveTo(76, 10); g.lineTo(76, 128); g.stroke(); });
      const m = K.mesh(flat(6, 6), K.std({ map: tex(sc, [1, 1], false), roughness: 1 }), x, yt + 0.08, z, { cast: false });
      m.renderOrder = 1;
      for (const [w, d, ox, oz] of [[8, 1, 0, -3.5], [8, 1, 0, 3.5], [1, 6, -3.5, 0], [1, 6, 3.5, 0]]) put(box(w, 0.5, d), 0xd8c8a8, { x: x + ox, y: yt + 0.25, z: z + oz }, M.stone);
      put(box(0.3, 2.6, 0.3), 0x6a4a2a, { x: x - 0.7, y: yt + 1.3, z: z - 3.2 }, M.paint); put(box(0.3, 2.6, 0.3), 0x6a4a2a, { x: x + 0.7, y: yt + 1.3, z: z - 3.2 }, M.paint);
      put(box(1.8, 0.25, 0.25), 0x6a4a2a, { x, y: yt + 2.5, z: z - 3.2 }, M.paint);
    }

    // ============================================================ fine scatter: rubble, shards, coins, beads, dust drifts, figurines
    {
      const n = (k) => (lowQ ? Math.round(k * 0.5) : k);
      const nearWall = (cb, count) => {
        for (let i = 0; i < count; i++) {
          const s = r() * L, p = track.at(s), side = r.sign(), lat = side * (p.w / 2 - r.range(0.25, 1.4));
          const q = track.place(s, lat);
          cb(q.x, roadY(s), q.z, p, side, s);
        }
      };
      const rubble = [], shards = [], drifts = [], beads = [], loose = [];
      nearWall((x, y, z) => rubble.push({ x, y: y + 0.12, z, rx: r() * 6, ry: r() * 6, rz: r() * 6, s: r.range(0.18, 0.55), color: r.pick([0xc8a878, 0xb09068, 0xd8c098, 0x9a8060]) }), n(260));
      nearWall((x, y, z) => shards.push({ x, y: y + 0.08, z, rx: r.range(-0.2, 0.2), ry: r() * 6, rz: r.range(-0.2, 0.2), sx: r.range(0.5, 1.1), sy: 1, sz: r.range(0.35, 0.8), color: r.pick([0xb85a2a, 0xa04a22, 0xc87040, 0x2f8a8a]) }), n(90));
      nearWall((x, y, z, p, side) => drifts.push({ x: x + p.nx * side * 0.6, y: y + 0.02, z: z + p.nz * side * 0.6, ry: -p.angle, sx: r.range(2.5, 6), sy: r.range(0.18, 0.4), sz: r.range(0.9, 1.6), color: r.pick([0xd8bc88, 0xc8a878, 0xe0c898]) }), n(110));
      nearWall((x, y, z) => beads.push({ x, y: y + 0.18, z, s: r.range(0.8, 1.2), color: r.pick([0x1d3f8a, 0x30b8b0, 0xb83a20, 0xe8c040]) }), n(70));
      nearWall((x, y, z) => loose.push({ x, y: y + 0.06, z, rx: r.range(-0.3, 0.3), rz: r.range(-0.3, 0.3), ry: r() * 6, s: 1, color: r.pick([0xe8b840, 0xd8a030]) }), n(50));
      // rubble and drifts on the cut tops too
      for (let i = 0; i < n(200); i++) {
        const x = r.range(FP.x0 + 2, FP.x1 - 2), z = r.range(FP.z0 + 2, FP.z1 - 2), nn = track.distTo(x, z);
        if (nn.dist < track.w[nn.i] / 2 + 3.6) continue;
        const y = topAt(x, z, nn);
        rubble.push({ x, y: y + 0.15, z, rx: r() * 6, ry: r() * 6, rz: r() * 6, s: r.range(0.25, 0.8), color: r.pick([0x8a7a62, 0x9a8a70, 0x7a6a56]) });
      }
      K.instances(new T.DodecahedronGeometry(1, 0), IM.matte, rubble, { colors: true, cast: false });
      K.instances(new T.CylinderGeometry(1, 0.9, 0.12, 5), IM.glaze, shards, { colors: true, cast: false });
      K.instances(new T.SphereGeometry(1, 10, 6, 0, TAU, 0, PI / 2), IM.dust, drifts, { colors: true, cast: false });
      K.instances(sph(0.18, 6, 4), IM.glaze, beads, { colors: true, cast: false });
      K.instances(A.coinGeo, IM.gold, loose, { colors: true, cast: false });
      // little figurines along the copings
      const figs = [];
      for (let i = 0; i < n(36); i++) {
        const s = r() * L, p = track.at(s), side = r.sign(), o = side * (p.w / 2 + r.range(1.0, 2.8)), x = p.x + p.nx * o, z = p.z + p.nz * o;
        figs.push({ x, y: wallTopAt(side, s) + 0.1, z, ry: r() * 6, s: r.range(0.8, 1.1), color: r.pick([0x30b8b0, 0x2a8aa0, 0xe8c040, 0x1e1a18]) });
      }
      K.instances(K.lathe([[0.001, 0], [0.32, 0], [0.34, 0.3], [0.26, 1.0], [0.3, 1.25], [0.22, 1.55], [0.001, 1.6]], 8), IM.glaze, figs, { colors: true, cast: false });
      // cobwebs in the top corners by the door jambs and in the chambers
      const webs = [];
      for (const D of A.doors) for (const sd of [-1, 1]) for (const fwd of [-1, 1]) {
        const o = sd * (D.w / 2 - 0.06), yt = wallTopAt(sd, D.s) - 0.05;
        webs.push({ x: D.x + D.c * fwd * 1.32 - D.sn * o, y: yt, z: D.z + D.sn * fwd * 1.32 + D.c * o, ry: -Math.atan2(D.sn, D.c) + (fwd < 0 ? PI : 0), s: 2.4 });
      }
      K.instances(new T.PlaneGeometry(1, 1).translate(0.5, -0.5, 0), new T.MeshBasicMaterial({ map: webTex, transparent: true, depthWrite: false, side: T.DoubleSide, opacity: 0.55, color: 0xd8d8e0 }), webs, { cast: false, receive: false });
    }

    // ============================================================ flush
    flushBins();
    {
      const im = K.instances(flat(1, 1), contactMat, contacts, { cast: false, receive: false }); im.renderOrder = 1;
      if (pools.length) { const pm = K.instances(flat(1, 1), addMat(poolTex), pools, { cast: false, receive: false, colors: true }); pm.renderOrder = 2; }
    }
    A.tmp = { col: new T.Color(), M: new T.Matrix4() };
    if (typeof location !== 'undefined' && /[?&]test=1/.test(location.search)) window.__tomb = A; // debug handle, test mode only
  },

  // fixed rate: the door and sand clocks, solid doors, the sand's drag, holds at closed doors, CPU drivers timing doors
  tick(dt, time, game) {
    if (!A || !A.doors.length) return;
    // a countdown starts the clocks again (also a countdown restarted from the pause menu)
    const newCount = game.state === 'countdown' && (A.prevState !== 'countdown' || game.countT > (A.prevCountT ?? 0) + 0.01);
    if (newCount) { A.t0 = time + Math.max(0, game.countT); for (const D of A.doors) { D.col.h = 0; D.hold = false; } }
    A.prevState = game.state; A.prevCountT = game.countT;
    const L = A.L, cars = game.cars;
    // doors: solid while down; a slab closing onto a car waits on its roof until the car is through
    for (const D of A.doors) {
      const u = doorU(D, time), b = doorB(u);
      D.u = u;
      const want = b < DOOR.solid;
      if (!want) { D.col.h = 0; D.hold = false; continue; }
      if (D.col.h === 0) {
        let under = false;
        for (const e of cars) {
          const c = e.car;
          if (e.out || c.state !== 'drive') continue;
          const dx = c.x - D.x, dz = c.z - D.z, a = dx * D.c + dz * D.sn, q = -dx * D.sn + dz * D.c;
          if (Math.abs(a) < DOOR.th / 2 + 2.5 && Math.abs(q) < D.w / 2 + 1 && Math.abs(c.y - D.y) < 3) { under = true; break; }
        }
        D.hold = under;
        if (under) continue;
      }
      D.col.h = D.y + 12;
    }
    // sand: the heap is loose sand while it lies there; the pour itself drags you down
    for (const S of A.sands) {
      const st = sandState(sandU(S, time), S.st);
      const rr = 1.3 + (SAND.R - 1.3) * st.pile;
      S.surf.kind = st.slow ? 'slow' : 'normal';
      S.surf.r = rr; S.surf.bb[0] = S.x - rr; S.surf.bb[1] = S.z - rr; S.surf.bb[2] = S.x + rr; S.surf.bb[3] = S.z + rr;
      if (st.flow > 0.2) {
        const k = Math.exp(-(st.pour ? 3.4 : 1.2) * dt);
        for (const e of cars) {
          const c = e.car;
          if (e.out || c.state !== 'drive' || c.airborne) continue;
          if ((c.x - S.x) ** 2 + (c.z - S.z) ** 2 < 2.4 * 2.4) { c.vx *= k; c.vz *= k; }
        }
      }
    }
    // cars waiting at a door are waiting, not stuck; CPU drivers time the doors and dodge the sand
    A.step++;
    for (const e of cars) {
      const c = e.car;
      if (e.out || c.state !== 'drive') continue;
      for (const D of A.doors) {
        const d = mod(D.s - e.trackS, L);
        if (d < 34 && (D.col.h > 0 || doorB(D.u) < DOOR.top - 0.3 || doorWarn(D.u) > 0)) e.holdT = 0.25;
      }
      if (!e.ai || c.airborne) continue;
      const v = Math.max(c.fwdSpeed, 9);
      let vmax = Infinity;
      for (const D of A.doors) {
        const d = mod(D.s - e.trackS, L);
        if (d > 80 || d < 1.2) continue;
        const stopD = d - 4.8;
        if (stopD < -1.5 && D.col.h === 0) continue; // committed: a closing slab waits on its roof
        // when does the slab come down next, and when is it up again after that?
        const down = (q) => doorB(doorU(D, time + q)) < DOOR.solid + 0.7;
        let tDown = -1, tUp = -1;
        for (let q = 0; q <= 7; q += 0.08) if (down(q)) { tDown = q; break; }
        if (tDown < 0) continue;
        for (let q = tDown; q <= tDown + 6; q += 0.08) if (!down(q)) { tUp = q; break; }
        // through before it comes down, flat out? (time for the tail to clear the slab)
        const v0 = Math.max(0, c.fwdSpeed), vt = 40, ta = Math.max(0, (vt - v0) / 45), da = ((v0 + vt) / 2) * ta, dd = d + 3.8;
        const tClear = dd <= da ? (Math.sqrt(v0 * v0 + 90 * dd) - v0) / 45 : ta + (dd - da) / vt;
        if (tDown > 0 && tClear + 0.15 < tDown) continue;
        // ...or up again by the time it gets there at this pace?
        if (tUp >= 0 && (d - 3.8) / Math.max(v0, 0.5) > tUp + 0.1) continue;
        vmax = Math.min(vmax, Math.sqrt(2 * 55 * Math.max(0, stopD)));
        e.ai.stuckT = 0; e.ai.reverseT = 0;
      }
      if (vmax < Infinity && c.fwdSpeed > vmax) { const k = Math.max(0, vmax) / Math.max(c.fwdSpeed, 0.01); c.vx *= k; c.vz *= k; }
      for (const S of A.sands) {
        const d = mod(S.s - e.trackS, L);
        if (d > 42 || d > L - 8) continue;
        const st = sandState(sandU(S, time + d / v), SST);
        if (!(st.slow || st.trickle > 0.35 || st.flow > 0.2)) continue;
        const shift = S.free - e.ai.lineOffset(e.trackS + 10);
        e.ai.avoid += (shift - e.ai.avoid) * Math.min(1, dt * 8);
        e.ai.mistakeT = 0;
      }
    }
  },

  animate(time, dt, game) {
    if (!A || !A.doors.length) return;
    const st = game.state, live = st === 'race' || st === 'countdown' || st === 'roundEnd';
    const snd = game.sound, col = A.tmp.col;
    // ---- doors: the slab, its lamps and floor strips, dust, the clank, the grinding and the thud
    {
      const hp = A.gemHalo.geometry.attributes.color;
      for (const D of A.doors) {
        const u = doorU(D, time);
        let b = doorB(u);
        if (D.hold) b = Math.max(b, 2.2);
        D.g.position.y = D.y + b + DOOR.sh / 2;
        const wn = doorWarn(u), closed = b < DOOR.solid + 0.2, rising = u >= DOOR.C && u < DOOR.C + DOOR.R;
        const flash = Math.floor(time * 7) % 2 === 0;
        if (closed || rising) col.setRGB(2.4, 0.16, 0.06);
        else if (wn > 0) col.setRGB(flash ? 2.6 : 0.6, flash ? 1.3 : 0.3, 0.05);
        else col.setRGB(0.2, 1.7, 1.45);
        D.lr = col.r; D.lg = col.g; D.lb = col.b;
        const phase = closed ? 3 : wn > 0 ? 1 : rising ? 2 : 0;
        if (phase !== D.phase) {
          if (live && D.phase !== -1 && game.onScreen(D.x, D.y + 3, D.z, 0.25)) {
            if (phase === 1) { snd.cue('clank', { x: D.x, z: D.z, game }); snd.cue('grind', { x: D.x, z: D.z, game, dur: DOOR.Wn + DOOR.D }); }
            if (phase === 3 && snd.ctx) { snd.tone(58, 0.5, { type: 'sine', vol: 0.32, slideTo: 32, pan: game.panOf(D.x, D.z) }); snd.noiseBurst(0.5, { freq: 420, vol: 0.2, pan: game.panOf(D.x, D.z) }); }
            if (phase === 2) snd.cue('grind', { x: D.x, z: D.z, game, dur: DOOR.R, vol: 0.8 });
          }
          if (phase === 3 && D.phase !== -1 && game.particles && game.onScreen(D.x, D.y, D.z, 0.25)) {
            for (const sd of [-1, 1]) game.particles.emit(D.x + D.c * sd * 1.6, D.y + 0.5, D.z + D.sn * sd * 1.6, { color: 0xd8c098, n: 10, size: 2.2, life: 0.9, spread: 8, up: 3, grav: -0.5, grow: 2.2, alpha: 0.45 });
            if (game.addShake && st === 'race') game.addShake(0.12);
          }
          D.phase = phase;
        }
        // dust trickles from under the slab in the warning
        if (wn > 0 && game.particles && dt > 0 && game.onScreen(D.x, D.y + 6, D.z, 0.2) && Math.random() < dt * 22) {
          const q = (Math.random() - 0.5) * D.w;
          game.particles.emit(D.x - D.sn * q, D.y + b - 0.1, D.z + D.c * q, { color: 0xd8c098, n: 1, size: 0.7, life: 1.0, spread: 0.6, up: -3, grav: 9, grow: 1.4, alpha: 0.7 });
        }
      }
      // gems, halos, strips
      for (let i = 0; i < A.gemK.length; i++) {
        const D = A.doors[A.gemK[i]];
        col.setRGB(D.lr, D.lg, D.lb); A.gems.setColorAt(i, col);
        hp.setXYZ(i, D.lr * 0.45, D.lg * 0.45, D.lb * 0.45);
      }
      A.gems.instanceColor.needsUpdate = true; hp.needsUpdate = true;
      for (let i = 0; i < A.stripK.length; i++) { const D = A.doors[A.stripK[i]]; col.setRGB(D.lr * 0.35, D.lg * 0.35, D.lb * 0.35); A.strips.setColorAt(i, col); }
      A.strips.instanceColor.needsUpdate = true;
    }
    // ---- sand: the trickle, the pour, the heap
    for (const S of A.sands) {
      const s0 = sandState(sandU(S, time), S.st);
      const w = s0.pour ? 1 : s0.trickle > 0 ? 0.22 + 0.2 * s0.trickle : 0;
      const on = w > 0.01;
      S.pour.visible = on;
      if (on) {
        const k = s0.pour ? s0.flow : 1;
        S.pour.scale.set(Math.max(0.05, w * k), 1, Math.max(0.05, w * k));
        S.pour.material.map.offset.y = -time * 2.6; S.pour.material.opacity = s0.pour ? 0.95 : 0.7;
      }
      const ps = s0.pile;
      S.pile.scale.set(Math.max(0.001, SAND.R * ps), Math.max(0.001, 1.7 * ps), Math.max(0.001, SAND.R * ps));
      const phase = s0.pour ? 2 : s0.trickle > 0 ? 1 : 0;
      if (phase !== S.phase) {
        if (live && phase === 1 && snd.ctx && game.onScreen(S.x, S.y, S.z, 0.2)) snd.noiseBurst(1.2, { freq: 3200, q: 0.8, type: 'bandpass', vol: 0.05, pan: game.panOf(S.x, S.z) });
        if (live && phase === 2 && snd.ctx && game.onScreen(S.x, S.y, S.z, 0.2)) snd.noiseBurst(2.4, { freq: 1400, q: 0.6, type: 'bandpass', vol: 0.12, pan: game.panOf(S.x, S.z) });
        S.phase = phase;
      }
      if (game.particles && dt > 0 && on && game.onScreen(S.x, S.y, S.z, 0.2) && Math.random() < dt * (s0.pour ? 30 : 6)) {
        game.particles.emit(S.x, S.y + 0.4 + ps, S.z, { color: 0xe0c48e, n: s0.pour ? 2 : 1, size: s0.pour ? 1.4 : 0.7, life: 0.7, spread: s0.pour ? 7 : 2, up: 2.2, grav: 6, grow: 1.8, alpha: 0.55 });
      }
    }
    // ---- torches flicker
    {
      const T0 = A.torch, fc = T0.flames.geometry.attributes.color, hc = T0.halos.geometry.attributes.color;
      for (let i = 0; i < T0.list.length; i++) {
        const t = T0.list[i], f = 0.78 + 0.14 * Math.sin(time * 11.3 + t.ph) * Math.sin(time * 7.1 + t.ph * 1.7) + 0.08 * Math.sin(time * 23 + t.ph * 3);
        fc.setXYZ(i, 1.6 * f, 1.05 * f, 0.4 * f); hc.setXYZ(i, 0.55 * f, 0.26 * f, 0.07 * f);
        col.setRGB(0.46 * f, 0.24 * f, 0.08 * f); T0.glows.setColorAt(i, col);
        col.setRGB(0.42 * f, 0.22 * f, 0.07 * f); T0.pools.setColorAt(i, col);
      }
      fc.needsUpdate = true; hc.needsUpdate = true; T0.glows.instanceColor.needsUpdate = true; T0.pools.instanceColor.needsUpdate = true;
    }
  },
};

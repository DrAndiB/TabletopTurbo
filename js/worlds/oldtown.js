// World: Old Town Jigsaw. A half-finished jigsaw puzzle of Luxembourg City's Ville Haute, assembled in two sections on
// a pair of coffee tables pulled slightly apart: the gap between them is the Pétrusse valley. The printed street circuit
// runs over the Passerelle viaduct, along the Chemin de la Corniche at the very edge of the table, round the Bock,
// past the Grand Ducal Palace, the cathedral, the Knuedler market and the Gëlle Fra, and jumps the valley on the
// Adolphe Bridge. Pop-up paper landmarks, missing pieces you can drop into, loose pieces to shove about, a cup of
// coffee and a pair of reading glasses.

const PI = Math.PI, TAU = PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const fract = (x) => x - Math.floor(x);
const hash = (n) => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);
const hash2 = (i, j, k = 0) => hash(i * 17.31 + j * 131.7 + k * 7.77);

// ---- furniture: two coffee tables with the valley gap between them
const TN = { x0: -150, x1: 150, z0: -95, z1: 23 }; // north table (Ville Haute)
const TS = { x0: -138, x1: 138, z0: 33, z1: 95 }; // south table (Gare side)
const TOP = -0.22; // table top; the puzzle print lies on it with its face at PY
const PY = 0.02;
const FLOOR = -45;
const PT = PY - TOP; // puzzle thickness
// ---- puzzle grids (piece size P, cut pattern repeats every Q pieces)
const P = 7, Q = 5;
const GN = { x0: -130, z0: -94, nx: 40, nz: 16 }; // north section x -130..150, z -94..18
const GS = { x0: -123, z0: 35.5, nx: 32, nz: 8 }; // south section x -123..101, z 35.5..91.5

// ---- the circuit: a closed polygon with a fillet radius at every corner (exact radii, smooth arcs)
const POLY = [
  [-106, 78, 16], // landing -> Avenue de la Liberté
  [-8, 78, 11], [4, 62, 11], [20, 62, 11], [32, 78, 11], // Gare chicane round the Place de Paris flower beds
  [88, 78, 16], // onto the Passerelle
  [88, 5, 12], // Boulevard Roosevelt
  [-52, 5, 15], [-52, -25, 15], // Rue Chimay hairpin
  [140.5, -25, 16], // onto the Corniche
  [140.5, -80, 13], [113, -80, 13], // round the Bock
  [113, -53, 13], // Marché-aux-Herbes
  [50, -53, 11], [38, -69, 11], [8, -69, 11], [-4, -53, 11], // Rue de l'Eau chicane round the Krautmaart planters
  [-106, -53, 16], // Grand-Rue, then Boulevard Royal straight down to the Adolphe Bridge
];
// kerbed islands inside both chicanes (they jog north) and the Rue Chimay hairpin, so nobody drives straight through:
// track points where the island's ring starts and ends (ext = how far beyond them it runs), its side of the road
// (+1 right, -1 left), the line that closes it (ax 1: z <= v, ax 0: x <= v) and what stands in it
const KERB = 1.6; // island kerb line, this far off the road edge
const ISL = [
  { a: [-8, 78], b: [32, 78], ext: 9, side: 1, ax: 1, v: 78 + 6.25 + KERB, kind: 'fountain', mx: 12, mz: 77.5, mr: 4.2 },
  { a: [50, -53], b: [-4, -53], ext: 9, side: -1, ax: 1, v: -53 + 6.25 + KERB, kind: 'statue', mx: 23, mz: -53.5, mr: 2.8 },
  { a: [-23, 5], b: [-23, -25], ext: 0, side: 1, ax: 0, v: -23, kind: 'houses', mx: -32.5, mz: -10, mr: 99 },
];
function filletLoop(V, stepDeg = 12, straightStep = 20) {
  const n = V.length, C = [];
  for (let i = 0; i < n; i++) {
    const p0 = V[(i - 1 + n) % n], p1 = V[i], p2 = V[(i + 1) % n];
    let dx1 = p1[0] - p0[0], dz1 = p1[1] - p0[1]; const l1 = Math.hypot(dx1, dz1); dx1 /= l1; dz1 /= l1;
    let dx2 = p2[0] - p1[0], dz2 = p2[1] - p1[1]; const l2 = Math.hypot(dx2, dz2); dx2 /= l2; dz2 /= l2;
    const phi = Math.atan2(dx1 * dz2 - dz1 * dx2, dx1 * dx2 + dz1 * dz2);
    const rad = p1[2], t = rad * Math.tan(Math.abs(phi) / 2), sg = phi > 0 ? 1 : -1;
    const A = [p1[0] - dx1 * t, p1[1] - dz1 * t], B = [p1[0] + dx2 * t, p1[1] + dz2 * t];
    C.push({ A, B, c: [A[0] - dz1 * rad * sg, A[1] + dx1 * rad * sg], rad, phi });
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
const W0 = 12.5;
const widthAt = (x, z) => {
  if (Math.abs(x + 106) < 4 && z > -22 && z < 64) return 13; // Adolphe Bridge approach, jump and landing
  if (x > 132 && z < -36 && z > -72) return 12; // the Corniche: narrow, along the edge
  return W0;
};
const TRACK = filletLoop(POLY).map(([x, z]) => [Math.round(x * 100) / 100, Math.round(z * 100) / 100, widthAt(x, z)]);

// ---- special places
const JUMP = { x: -106, z0: 8, z1: 23, h: 3.4, wid: 13.6 }; // take-off: the north half of the Adolphe Bridge
const LAND = { z0: 33, z1: 43, h: 1.3, wid: 17.6 }; // landing: the south half, wider than the road so a crooked jump still lands
const PASS = { x: 88, z0: 18.5, z1: 37.5, hw: 6.9 }; // the Passerelle deck spanning the gap
const BOUNDS = { minX: -150, maxX: 150, minZ: -95, maxZ: 95, poly: [[-150, -95], [150, -95], [150, 23], [138, 23], [138, 95], [-138, 95], [-138, 23], [-150, 23]] };

let A = null; // runtime state shared by build / tick / animate

export default {
  id: 'oldtown',
  name: 'Old Town Jigsaw',
  blurb: 'A half-finished jigsaw of the Old Town: the Corniche, missing pieces and a bridge jump.',
  vehicle: 'formula',
  seed: 24,
  track: { points: TRACK, width: W0, startS: 62 },
  bounds: BOUNDS,
  fallOffEdges: true,
  floorY: FLOOR,
  offCourse: 14,
  offroad: { kind: 'slow', margin: 1.6 },
  skidColor: 0x2a2622,
  clackOnBump: true,
  dust: {
    normal: null,
    slow: { color: 0xd9ccb0, size: 0.7, life: 0.45, up: 2, grav: 12, alpha: 0.6, grow: 1.4, rate: 1 },
    rough: { color: 0xcbb994, size: 0.6, life: 0.4, up: 3, grav: 18, alpha: 0.7, grow: 1.2, rate: 1.4 },
    slick: { color: 0x4a2a14, size: 0.7, life: 0.5, up: 3, grav: 25, alpha: 0.9, grow: 1, rate: 2 },
  },
  lighting: {
    sunDir: [-0.52, 1, -0.4], sunColor: 0xfff0dc, sunIntensity: 2.6,
    hemiSky: 0xe4ecff, hemiGround: 0x7a5c44, hemiIntensity: 0.55,
    envIntensity: 0.5, exposure: 1.0, background: 0x2a221c,
  },

  async build(K) {
    const { THREE: T, TX, r, track } = K;
    const BU = K.BufferGeometryUtils;
    const lowQ = K.quality && K.quality.tilt === false;
    A = { steam: [], flags: [], jumpRespawnS: 0, gapZ: [TN.z1, TS.z0] };

    // ================================================================== helpers
    const V2 = (a, b = a) => new T.Vector2(a, b);
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
      g.clearGroups();
      return g;
    };
    // merge everything that shares a material into one mesh (vertex-coloured parts)
    const bakeQ = new Map();
    const part = (geo, mat, o = {}, c = 0xffffff, cast = true) => {
      const key = mat.uuid + (cast ? 'c' : 'n');
      if (!bakeQ.has(key)) bakeQ.set(key, { mat, cast, parts: [] });
      bakeQ.get(key).parts.push(tidy(xf(geo.clone(), o), c));
    };
    const flush = () => {
      for (const { mat, cast, parts } of bakeQ.values()) {
        const g = BU.mergeGeometries(parts, false);
        g.computeBoundingSphere();
        const m = new T.Mesh(g, mat); m.castShadow = cast; m.receiveShadow = true;
        K.group.add(m);
      }
      bakeQ.clear();
    };
    // batched contact shadows (one draw call per opacity class)
    const aoLists = new Map();
    const AO = (x, z, rx, rz = rx, op = 0.4, ang = 0, y = PY + 0.03) => {
      const k = op < 0.3 ? 0.22 : op < 0.47 ? 0.4 : 0.58;
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
    const C2 = (c) => c.getContext('2d', { willReadFrequently: true }); // CPU canvases: far faster for lots of small vector shapes
    const cv = (w, h, draw) => { const c = TX.makeCanvas(w, h); draw(C2(c), w, h); return c; };
    const tex = (c, o = {}) => TX.toTexture(c, { wrap: false, ...o });
    const vc = (p = {}) => K.std({ vertexColors: true, roughness: 0.85, ...p });
    const box = (w, h, d) => new T.BoxGeometry(w, h, d);
    const cyl = (r1, r2, h, seg = 16, open = false) => new T.CylinderGeometry(r1, r2, h, seg, 1, open);
    const onN = (x, z) => x >= TN.x0 && x <= TN.x1 && z >= TN.z0 && z <= TN.z1;
    const onS = (x, z) => x >= TS.x0 && x <= TS.x1 && z >= TS.z0 && z <= TS.z1;
    const roadD = (x, z) => { const n = track.distTo(x, z); return n.dist - track.w[n.i] / 2; }; // < 0 on the road

    // ================================================================== room: parquet floor, rug, the two coffee tables
    {
      const S = 512;
      const pc = cv(S, S, (g) => {
        // herringbone parquet: 8 x 2 boards
        g.fillStyle = '#6b4a2e'; g.fillRect(0, 0, S, S);
        const bw = 32, bl = 128;
        const R = K.rng(77);
        for (let k = -6; k < 12; k++) for (let m = -2; m < 8; m++) {
          for (const flip of [0, 1]) {
            g.save();
            g.translate(k * bl / 2 + m * 0 + (flip ? bw : 0), m * bl - k * bl / 2 + (flip ? 0 : 0));
            g.rotate(flip ? -PI / 4 : PI / 4);
            const t = 0.75 + R() * 0.4;
            g.fillStyle = `rgb(${150 * t | 0},${104 * t | 0},${64 * t | 0})`;
            g.fillRect(0, 0, bl * 0.72, bw * 0.72);
            g.strokeStyle = 'rgba(40,24,12,0.6)'; g.lineWidth = 1.5; g.strokeRect(0, 0, bl * 0.72, bw * 0.72);
            g.restore();
          }
        }
      });
      const pt = TX.toTexture(pc, { repeat: [14, 14] });
      K.mesh(new T.PlaneGeometry(1400, 1400), K.std({ map: pt, roughness: 0.55, color: 0xd8c8b8 }), 0, FLOOR, 0, { rx: -PI / 2, cast: false });
      // wool rug under the tables: cream field, charcoal lozenges, fringed border
      const rc = cv(512, 352, (g, w, h) => {
        g.fillStyle = '#e4dccb'; g.fillRect(0, 0, w, h);
        const R = K.rng(5);
        for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '255,250,240' : '120,105,90'},0.12)`; g.fillRect(R() * w, R() * h, 2, 2); }
        g.strokeStyle = '#3c3530'; g.lineWidth = 5;
        for (let x = -h; x < w + h; x += 46) { g.beginPath(); g.moveTo(x, 20); g.lineTo(x + (h - 40) * 0.6, h - 20); g.stroke(); g.beginPath(); g.moveTo(x, h - 20); g.lineTo(x + (h - 40) * 0.6, 20); g.stroke(); }
        g.strokeStyle = '#3c3530'; g.lineWidth = 10; g.strokeRect(12, 12, w - 24, h - 24);
        g.strokeStyle = '#8c4a32'; g.lineWidth = 4; g.strokeRect(24, 24, w - 48, h - 48);
      });
      K.mesh(new T.PlaneGeometry(560, 380), K.std({ map: tex(rc), roughness: 1 }), 0, FLOOR + 0.1, 0, { rx: -PI / 2, cast: false });
      const sh = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55, alphaMap: TX.blobShadowTexture(), depthWrite: false }));
      sh.rotation.x = -PI / 2; sh.scale.set(420, 300, 1); sh.position.set(25, FLOOR + 0.2, 20); K.group.add(sh);

      // walnut tables: top, apron, tapered legs
      const wal = TX.woodTextures({ size: 1024, seed: 9, planks: 5, base: 0x6a4126, dark: 0x3a2112, light: 0x93623b, ringFreq: 14, gap: 0.0016, gapColor: 0x1e120a, roughBase: 0.4, lacquer: 0.35 });
      const mk = (tb, rot) => {
        const w = tb.x1 - tb.x0, d = tb.z1 - tb.z0, cx = (tb.x0 + tb.x1) / 2, cz = (tb.z0 + tb.z1) / 2;
        const ts = {};
        for (const [k, t] of Object.entries(wal)) { const c = t.clone(); c.repeat.set(w / 70, d / 70); c.rotation = rot; c.center.set(0.5, 0.5); c.needsUpdate = true; ts[k] = c; }
        const topMat = K.std({ map: ts.map, normalMap: ts.normalMap, roughnessMap: ts.roughnessMap, normalScale: V2(0.5), envMapIntensity: 0.9 });
        K.mesh(new K.RoundedBoxGeometry(w, 4, d, 2, 0.6), topMat, cx, TOP - 2, cz, { cast: false });
        part(new T.BoxGeometry(w - 8, 6, d - 8), legMat, { x: cx, y: TOP - 7, z: cz }, 0xffffff, false);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) part(cyl(2.4, 1.6, -FLOOR + TOP - 4, 12), legMat, { x: cx + sx * (w / 2 - 5), y: (FLOOR + TOP - 4) / 2, z: cz + sz * (d / 2 - 5) }, 0xffffff, false);
      };
      const legMat = K.std({ color: 0x3e2414, roughness: 0.5, map: wal.map });
      mk(TN, PI / 2);
      mk(TS, PI / 2);
    }

    // ================================================================== the puzzle: cut pattern, sections, special pieces
    // tab template (u along the edge, v across, in edge lengths): neck, round head, neck
    const tabPts = (c, k) => [
      [[c - 0.07 * k, 0.0], [c - 0.05 * k, 0.04 * k], [c - 0.075 * k, 0.09 * k]],
      [[c - 0.115 * k, 0.16 * k], [c - 0.08 * k, 0.25 * k], [c, 0.25 * k]],
      [[c + 0.08 * k, 0.25 * k], [c + 0.115 * k, 0.16 * k], [c + 0.075 * k, 0.09 * k]],
      [[c + 0.05 * k, 0.04 * k], [c + 0.07 * k, 0.0], [c + 0.12 * k, 0]],
    ];
    const bez = (a, b, c, d, t) => { const u = 1 - t; return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d; };
    // one cut edge (a -> b, world units) as a polyline. sgn: +1 bumps to the right of a->b, -1 left, 0 straight
    const edgeLine = (ax, az, bx, bz, sgn, jc, jk, seg = 5) => {
      const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, nx = -uz * sgn, nz = ux * sgn;
      const at = (u, v) => [ax + ux * u * L + nx * v * L, az + uz * u * L + nz * v * L];
      if (!sgn) return [[ax, az], [bx, bz]];
      const c = 0.5 + (jc - 0.5) * 0.12, k = 0.92 + jk * 0.16;
      const out = [at(0, 0), at(c - 0.12 * k, 0)];
      let p0 = [c - 0.12 * k, 0];
      for (const [c1, c2, e] of tabPts(c, k)) {
        for (let i = 1; i <= seg; i++) { const t = i / seg; out.push(at(bez(p0[0], c1[0], c2[0], e[0], t), bez(p0[1], c1[1], c2[1], e[1], t))); }
        p0 = e;
      }
      out.push(at(1, 0));
      return out;
    };
    // the cut pattern is periodic (Q x Q pieces) so the groove normal map can tile
    const hEdge = (G, i, j, seg) => { // horizontal edge on row line j, column i (a -> b along +x)
      const x = G.x0 + i * P, z = G.z0 + j * P, ii = ((i % Q) + Q) % Q, jj = ((j % Q) + Q) % Q;
      const flat = G.flatN && j === 0 || G.flatS && j === G.nz;
      return edgeLine(x, z, x + P, z, flat ? 0 : (hash2(ii, jj, 1) < 0.5 ? 1 : -1), hash2(ii, jj, 2), hash2(ii, jj, 3), seg);
    };
    const vEdge = (G, i, j, seg) => { // vertical edge on column line i, row j (a -> b along +z)
      const x = G.x0 + i * P, z = G.z0 + j * P, ii = ((i % Q) + Q) % Q, jj = ((j % Q) + Q) % Q;
      const flat = G.flatW && i === 0 || G.flatE && i === G.nx;
      return edgeLine(x, z, x, z + P, flat ? 0 : (hash2(ii, jj, 4) < 0.5 ? 1 : -1), hash2(ii, jj, 5), hash2(ii, jj, 6), seg);
    };
    // closed outline of piece (i, j), clockwise on screen
    const pieceOutline = (G, i, j, seg = 5) => {
      const top = hEdge(G, i, j, seg), right = vEdge(G, i + 1, j, seg), bottom = hEdge(G, i, j + 1, seg).reverse(), left = vEdge(G, i, j, seg).reverse();
      return [...top, ...right.slice(1), ...bottom.slice(1), ...left.slice(1, -1)];
    };
    const cellC = (G, i, j) => [G.x0 + (i + 0.5) * P, G.z0 + (j + 0.5) * P];
    const cellOf = (G, x, z) => [Math.floor((x - G.x0) / P), Math.floor((z - G.z0) / P)];
    GN.flatN = true; GN.flatE = true; GN.flatW = true; GS.flatS = true;
    // how far is a whole cell (with its knobs) from the road?
    const cellRoad = (G, i, j) => { const [cx, cz] = cellC(G, i, j); let d = 1e9; for (const [ox, oz] of [[0, 0], [-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) d = Math.min(d, roadD(cx + ox * P * 0.62, cz + oz * P * 0.62)); return d; };

    // which cells are placed; holes (missing pieces on the road), nudged pieces, popped-up pieces
    const keyOf = (i, j) => i + ',' + j;
    const sections = [
      { G: GN, name: 'n' }, { G: GS, name: 's' },
    ];
    for (const sec of sections) { sec.placed = new Set(); sec.holes = []; sec.nudged = []; sec.popped = []; }
    const [secN, secS] = sections;
    {
      const G = GN;
      for (let j = 0; j < G.nz; j++) for (let i = 0; i < G.nx; i++) {
        const [x, z] = cellC(G, i, j), h = hash2(i, j, 11), h2 = hash2(i, j, 12);
        const nearRoad = cellRoad(G, i, j) < 2.5;
        let on = true;
        if (x < -110 + h * 9 && z < -61 + h2 * 9) on = false; // NW: the box and the loose pieces
        if (x > 129 + h * 6 && z > -15 + h2 * 5) on = false; // SE: room for the coffee cup
        if (j === G.nz - 1 && h < 0.34) on = false; // ragged edge above the valley
        if (!nearRoad && h2 < 0.012) on = false; // one or two strays missing in the city
        if (nearRoad) on = true;
        if (on) secN.placed.add(keyOf(i, j));
      }
    }
    {
      const G = GS;
      for (let j = 0; j < G.nz; j++) for (let i = 0; i < G.nx; i++) {
        const [x, z] = cellC(G, i, j), h = hash2(i, j, 21), h2 = hash2(i, j, 22);
        const nearRoad = cellRoad(G, i, j) < 2.5 || (Math.abs(x - JUMP.x) < 11 && z < 48) || (Math.abs(x - PASS.x) < 11 && z < 44);
        let on = true;
        if (j === 0 && h < 0.4) on = false; // ragged valley edge
        if (j === 1 && h < 0.12 && hash2(i, 0, 21) < 0.4) on = false;
        if (x > 93 + h * 7) on = false; // east end not done yet: the lid lies there
        if (x < -116 + h2 * 6 && z < 60) on = false;
        if (nearRoad) on = true;
        if (on) secS.placed.add(keyOf(i, j));
      }
    }
    // missing pieces in the road: [section, s along the track, wanted lateral offset]
    const holeSpots = [[secN, 0, 0], [secN, 0, 0], [secN, 0, 0]];
    {
      // pick the cell nearest to a road point, off the ideal line
      const pick = (sec, x, z) => { const [i, j] = cellOf(sec.G, x, z); return { i, j }; };
      const want = [
        // all at the road edge in the middle of straights, on the side away from the line into the next corner
        [secN, 27.5, 0.5], // Boulevard Roosevelt, right-hand side (the line into the hairpin is on the left)
        [secN, -56.5, -48.5], // Grand-Rue, left-hand side (the line into Boulevard Royal is on the right)
        [secS, -77.5, 74], // start straight before the grid, left-hand side (the exit line of the corner is on the right)
      ];
      want.forEach(([sec, x, z], k) => { const c = pick(sec, x, z); holeSpots[k] = [sec, c.i, c.j]; });
    }
    A.holes = [];
    for (const [sec, i, j] of holeSpots) {
      sec.holes.push([i, j]);
      sec.placed.delete(keyOf(i, j));
      const [x, z] = cellC(sec.G, i, j);
      A.holes.push({ x, z, sec, i, j });
    }
    // nudged pieces (decoration) and popped-up pieces (a rough patch on the road)
    for (const [x, z] of [[-18, -82], [72, -84], [-122, -40], [112, -2], [36, 15], [60, -10]]) secN.nudged.push(cellOf(GN, x, z));
    for (const [x, z] of [[-52, 87], [28, 45], [-80, 46]]) secS.nudged.push(cellOf(GS, x, z));
    {
      const [i0, j0] = cellOf(GS, -38, 81); // pieces bulging up on the start straight: a rough patch on the right-hand side
      secS.popped.push([i0, j0], [i0 + 1, j0], [i0 + 2, j0]);
    }
    for (const sec of sections) for (const [i, j] of [...sec.nudged, ...sec.popped]) sec.placed.delete(keyOf(i, j));
    // nudged ones must not touch the road
    for (const sec of sections) sec.nudged = sec.nudged.filter(([i, j]) => { const ok = cellRoad(sec.G, i, j) > 3; if (!ok) sec.placed.add(keyOf(i, j)); return ok; });

    // ================================================================== the print: an illustrated bird's-eye map, drawn in world units
    const PPU = 8, MARG = 2.2;
    const PAL = {
      ground: '#d3c6a8', street: '#eadfc4', streetEdge: '#b7a684', road: '#8b8781', roadDark: '#7c7872', line: '#f7f3ea', pave: '#e8ddc4',
      kerbR: '#c8382c', kerbW: '#f4efe4', green: '#86a65c', green2: '#6f9149', tree: '#4f7d3c', tree2: '#3e6830', treeHi: '#9cc06a',
      slate: ['#56636f', '#5f6c79', '#4c5865', '#68768a', '#5a6470'], tile: ['#a65a3c', '#b4683f', '#9a4f36'], copper: '#5f9a88',
      facade: ['#efe2c4', '#ead2a5', '#f1d8b4', '#ddd0b3', '#e8c8a6', '#d9d3c4', '#e6d59d', '#cfdcd6'], ink: '#3b3127', wall: '#c9b48a', water: '#6f9fb8',
    };
    // track edge polylines (left / right, at an offset from the edge)
    const edgeLoop = (side, extra = 0) => { const out = []; for (let i = 0; i < track.N; i += 2) { const off = side * (track.w[i] / 2 + extra); out.push([track.x[i] - track.tz[i] * off, track.z[i] + track.tx[i] * off]); } return out; };
    const pathLoop = (g, pts) => { g.moveTo(pts[0][0], pts[0][1]); for (let k = 1; k < pts.length; k++) g.lineTo(pts[k][0], pts[k][1]); g.closePath(); };
    const pathPoly = (g, pts) => { g.moveTo(pts[0][0], pts[0][1]); for (let k = 1; k < pts.length; k++) g.lineTo(pts[k][0], pts[k][1]); g.closePath(); };

    // squares, valley bands, landmark footprints (no city blocks there)
    const SQ = {
      knuedler: [-96, -46, -63, -15], // x0, z0, x1, z1
      armes: [-60, -88, -34, -69],
      constitution: [-97, -3, -62, 12.5],
      clairefontaine: [68, -47, 90, -34],
      esprit: [96, -15, 128, 8],
    };
    const inRect = (x, z, q, m = 0) => x > q[0] - m && x < q[2] + m && z > q[1] - m && z < q[3] + m;
    const FOOT = { // pop-up landmark footprints [x0, z0, x1, z1]
      palace: [24, -47, 66, -35.5], cathedral: [-8, -17.2, 36, -4.8], bock: [116, -76, 136, -58], corniche: [119, -60, 133, -38],
    };
    const SIDE = [ // side streets: [width, [x, z]...] (printed only; the race uses the grey road)
      [5, [[-100, -78], [-60, -78], [-20, -79], [30, -79], [80, -78], [120, -79]]],
      [4, [[-75, -61], [-75, -92]]], [4, [[-25, -61], [-25, -92]]], [4.5, [[60, -61], [60, -92]]], [4, [[100, -61], [100, -92]]],
      [4, [[-96, -8], [-62, -8]]],
      [4, [[-30, -34], [10, -34]]], [3.5, [[-12, -34], [-12, -45]]], [4, [[90, -34], [104, -34]]],
      [3.5, [[50, -12], [62, -12], [62, -4]]],
      [4.5, [[-118, 56], [-60, 58], [0, 58], [60, 57], [96, 57]]], [3.5, [[-40, 58], [-40, 72]]], [3.5, [[70, 57], [70, 72]]],
      [3.5, [[-30, 84.5], [-30, 92]]], [3.5, [[55, 84.5], [55, 92]]],
    ];

    const drawSection = (sec) => {
      const G = sec.G;
      const wx0 = G.x0 - MARG, wz0 = G.z0 - MARG, ww = G.nx * P + 2 * MARG, wh = G.nz * P + 2 * MARG;
      const Wp = Math.round(ww * PPU), Hp = Math.round(wh * PPU);
      const c = TX.makeCanvas(Wp, Hp), g = C2(c);
      g.setTransform(PPU, 0, 0, PPU, -wx0 * PPU, -wz0 * PPU);
      const R = K.rng(sec.name === 'n' ? 101 : 202);
      const inSec = (x, z, m = 0) => x > wx0 - m && x < wx0 + ww + m && z > wz0 - m && z < wz0 + wh + m;
      // ---- occupancy mask at 2 px / unit: where no building may go
      const OS = 2, oc = TX.makeCanvas(Math.ceil(ww * OS), Math.ceil(wh * OS)), og = C2(oc);
      og.setTransform(OS, 0, 0, OS, -wx0 * OS, -wz0 * OS);
      og.fillStyle = '#fff'; og.strokeStyle = '#fff'; og.lineCap = 'round'; og.lineJoin = 'round';
      og.beginPath(); pathLoop(og, edgeLoop(-1, 1.9)); pathLoop(og, edgeLoop(1, 1.9)); og.fill('evenodd');
      for (const [w, pts] of SIDE) { og.lineWidth = w + 1.2; og.beginPath(); og.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) og.lineTo(p[0], p[1]); og.stroke(); }
      for (const q of [...Object.values(SQ), ...Object.values(FOOT)]) og.fillRect(q[0], q[1], q[2] - q[0], q[3] - q[1]);
      if (sec.name === 'n') og.fillRect(-140, 12.5, 300, 20); else og.fillRect(-140, 20, 300, 31);
      const occD = og.getImageData(0, 0, oc.width, oc.height).data;
      const occ = (x, z) => { const px = Math.floor((x - wx0) * OS), py = Math.floor((z - wz0) * OS); if (px < 0 || py < 0 || px >= oc.width || py >= oc.height) return true; return occD[(py * oc.width + px) * 4] > 128; };
      const BS = 4, bw = Math.ceil(ww * BS), bh = Math.ceil(wh * BS), built = new Uint8Array(bw * bh);
      const bAt = (x, z) => { const i = Math.floor((x - wx0) * BS), j = Math.floor((z - wz0) * BS); return i < 0 || j < 0 || i >= bw || j >= bh ? 1 : built[j * bw + i]; };
      const bMark = (x, z) => { const i = Math.floor((x - wx0) * BS), j = Math.floor((z - wz0) * BS); if (i >= 0 && j >= 0 && i < bw && j < bh) built[j * bw + i] = 1; };

      // ---- ground with paper grain
      g.fillStyle = PAL.ground; g.fillRect(wx0, wz0, ww, wh);
      for (let k = 0; k < ww * wh * 0.5; k++) { g.fillStyle = R() < 0.5 ? 'rgba(255,250,235,0.18)' : 'rgba(110,90,60,0.10)'; g.fillRect(wx0 + R() * ww, wz0 + R() * wh, 0.25, 0.25); }

      // ---- the Pétrusse valley: green slopes, the stream, footpaths, the old fortifications on the rim
      const valley = (z0, z1, rimZ, streamZ) => {
        const gr = g.createLinearGradient(0, z0, 0, z1);
        gr.addColorStop(0, sec.name === 'n' ? '#9db66a' : '#6f9149'); gr.addColorStop(1, sec.name === 'n' ? '#6f9149' : '#a3bb70');
        g.fillStyle = gr; g.fillRect(-140, z0, 300, z1 - z0);
        g.strokeStyle = 'rgba(60,90,40,0.25)'; g.lineWidth = 0.12;
        for (let x = -140; x < 160; x += 1.4) { g.beginPath(); g.moveTo(x, z0 + 0.5); g.lineTo(x + 0.6, z1 - 0.5); g.stroke(); }
        if (streamZ != null) {
          g.strokeStyle = PAL.water; g.lineWidth = 1.3; g.lineCap = 'round'; g.beginPath();
          for (let x = -140; x <= 160; x += 2) { const zz = streamZ + Math.sin(x * 0.07) * 1.2 + Math.sin(x * 0.19) * 0.5; if (x === -140) g.moveTo(x, zz); else g.lineTo(x, zz); }
          g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 0.25; g.stroke();
        }
        // zigzag footpaths
        g.strokeStyle = 'rgba(240,226,190,0.9)'; g.lineWidth = 0.5;
        for (let x = -120; x < 150; x += 38 + R() * 20) { g.beginPath(); g.moveTo(x, z0 + 1); for (let k = 1; k < 5; k++) g.lineTo(x + (k % 2 ? 6 : 0), lerp(z0 + 1, z1 - 1, k / 4)); g.stroke(); }
        if (rimZ != null) {
          // stone rampart with arrow-head bastions along the rim
          g.fillStyle = PAL.wall; g.strokeStyle = PAL.ink; g.lineWidth = 0.12;
          g.beginPath(); g.moveTo(-140, rimZ - 0.6);
          for (let x = -140; x < 160; x += 22) { g.lineTo(x + 8, rimZ - 0.6); g.lineTo(x + 11, rimZ + (sec.name === 'n' ? 3.5 : -3.5)); g.lineTo(x + 14, rimZ - 0.6); }
          g.lineTo(160, rimZ - 0.6); g.lineTo(160, rimZ + 0.6); g.lineTo(-140, rimZ + 0.6); g.closePath(); g.fill(); g.stroke();
        }
      };
      if (sec.name === 'n') valley(12.5, 22.5, 12.8, 19.2);
      else valley(33, 51, 50.5, 37.3);

      // ---- squares
      const paving = (q, base, pat = 'grid') => {
        g.fillStyle = base; g.fillRect(q[0], q[1], q[2] - q[0], q[3] - q[1]);
        g.strokeStyle = 'rgba(120,100,70,0.22)'; g.lineWidth = 0.1;
        if (pat === 'grid') { for (let x = q[0]; x < q[2]; x += 1.6) { g.beginPath(); g.moveTo(x, q[1]); g.lineTo(x, q[3]); g.stroke(); } for (let z = q[1]; z < q[3]; z += 1.6) { g.beginPath(); g.moveTo(q[0], z); g.lineTo(q[2], z); g.stroke(); } }
        if (pat === 'diag') { for (let x = q[0] - 40; x < q[2]; x += 2.2) { g.beginPath(); g.moveTo(x, q[1]); g.lineTo(x + (q[3] - q[1]), q[3]); g.stroke(); g.beginPath(); g.moveTo(x, q[3]); g.lineTo(x + (q[3] - q[1]), q[1]); g.stroke(); } }
        g.strokeStyle = 'rgba(90,72,50,0.5)'; g.lineWidth = 0.25; g.strokeRect(q[0] + 0.4, q[1] + 0.4, q[2] - q[0] - 0.8, q[3] - q[1] - 0.8);
      };
      g.save(); g.beginPath(); g.rect(wx0, wz0, ww, wh); g.clip();
      paving(SQ.knuedler, '#eadcbc', 'diag');
      paving(SQ.armes, '#e8d9a8', 'none');
      paving(SQ.constitution, '#e6d8b8', 'grid');
      paving(SQ.clairefontaine, '#e6dabd', 'grid');
      paving(SQ.esprit, '#a9c07a', 'none');

      // ---- side streets
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (const [w, pts] of SIDE) {
        g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) g.lineTo(p[0], p[1]);
        g.strokeStyle = PAL.streetEdge; g.lineWidth = w + 0.5; g.stroke();
        g.strokeStyle = PAL.street; g.lineWidth = w; g.stroke();
      }
      // pavement band along the race road
      g.beginPath(); pathLoop(g, edgeLoop(-1, 0)); g.strokeStyle = PAL.pave; g.lineWidth = 3.4; g.stroke();
      g.beginPath(); pathLoop(g, edgeLoop(1, 0)); g.stroke();

      // ---- buildings lining every street: roof + a strip of south facade, like an old bird's-eye map
      const building = (cx, cz, ux, uz, a, b, seed) => {
        // rectangle: centre, along-axis (ux, uz), half-length a, half-depth b
        const nx = -uz, nz = ux;
        const pts = [[cx - ux * a - nx * b, cz - uz * a - nz * b], [cx + ux * a - nx * b, cz + uz * a - nz * b], [cx + ux * a + nx * b, cz + uz * a + nz * b], [cx - ux * a + nx * b, cz - uz * a + nz * b]];
        const h1 = hash(seed), h2 = hash(seed + 1.7), h3 = hash(seed + 3.1);
        const fh = 0.9 + h2 * 0.9;
        const fcol = PAL.facade[Math.floor(h1 * PAL.facade.length)];
        g.fillStyle = fcol; g.strokeStyle = PAL.ink; g.lineWidth = 0.1;
        g.beginPath(); pathPoly(g, pts.map(([x, z]) => [x, z + fh])); g.fill();
        for (let k = 1; k < 4; k++) { g.beginPath(); pathPoly(g, pts.map(([x, z]) => [x, z + fh * k / 4])); g.fill(); }
        // windows on the visible (southern) side
        let lo = 0; for (let k = 1; k < 4; k++) if (pts[k][1] + pts[(k + 1) % 4][1] > pts[lo][1] + pts[(lo + 1) % 4][1]) lo = k;
        const pA = pts[lo], pB = pts[(lo + 1) % 4], el = Math.hypot(pB[0] - pA[0], pB[1] - pA[1]);
        if (Math.abs(pB[1] - pA[1]) < el * 0.6) {
          g.fillStyle = 'rgba(70,58,46,0.75)';
          const nW = Math.floor(el / 1.3);
          for (let k = 0; k < nW; k++) { const t = (k + 0.5) / nW; g.fillRect(lerp(pA[0], pB[0], t) - 0.22, lerp(pA[1], pB[1], t) + fh * 0.3, 0.44, Math.min(0.55, fh * 0.45)); }
        }
        g.beginPath(); pathPoly(g, pts.map(([x, z]) => [x, z + fh])); g.stroke();
        // roof: slate mostly, a few red tiles, two shaded halves either side of the ridge
        const roof = h3 < 0.8 ? PAL.slate[Math.floor(h1 * 7) % PAL.slate.length] : h3 < 0.96 ? PAL.tile[Math.floor(h2 * 3)] : PAL.copper;
        const long = a >= b; // ridge along the longer side
        const rx = long ? ux : nx, rz = long ? uz : nz, ra = long ? a : b, rb = long ? b : a, sx = long ? nx : ux, sz = long ? nz : uz;
        const half = (sgn) => [[cx - rx * ra, cz - rz * ra], [cx + rx * ra, cz + rz * ra], [cx + rx * ra + sx * rb * sgn, cz + rz * ra + sz * rb * sgn], [cx - rx * ra + sx * rb * sgn, cz - rz * ra + sz * rb * sgn]];
        const lit = (sx * -0.6 + sz * -0.8) > 0 ? 1 : -1; // half facing the sun (north-west) is lighter
        g.fillStyle = roof; g.beginPath(); pathPoly(g, half(-lit)); g.fill();
        g.fillStyle = shade(roof, 1.22); g.beginPath(); pathPoly(g, half(lit)); g.fill();
        g.strokeStyle = 'rgba(30,26,22,0.55)'; g.lineWidth = 0.12; g.beginPath(); pathPoly(g, pts); g.stroke();
        g.strokeStyle = shade(roof, 0.7); g.lineWidth = 0.14; g.beginPath(); g.moveTo(cx - rx * ra, cz - rz * ra); g.lineTo(cx + rx * ra, cz + rz * ra); g.stroke();
        // dormers and a chimney
        if (ra > 2.2) {
          const nd = Math.floor(ra / 1.6);
          g.fillStyle = '#efe6d2'; g.strokeStyle = PAL.ink; g.lineWidth = 0.06;
          for (let k = 0; k < nd; k++) { const t = (k + 0.5) / nd * 2 - 1, px = cx + rx * ra * t * 0.8 - sx * rb * lit * 0.55, pz = cz + rz * ra * t * 0.8 - sz * rb * lit * 0.55; if (hash(seed + k) < 0.6) { g.fillRect(px - 0.25, pz - 0.22, 0.5, 0.44); g.strokeRect(px - 0.25, pz - 0.22, 0.5, 0.44); } }
        }
        if (h2 < 0.7) { const t = h3 * 1.4 - 0.7, px = cx + rx * ra * t + sx * rb * 0.3, pz = cz + rz * ra * t + sz * rb * 0.3; g.fillStyle = '#7a5a48'; g.fillRect(px - 0.3, pz - 0.3, 0.6, 0.6); g.fillStyle = '#3a2c24'; g.fillRect(px - 0.2, pz - 0.2, 0.4, 0.25); }
      };
      const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const f = (v) => clamp(Math.round(v * k), 0, 255); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };
      const tryLot = (px, pz, ux, uz, nx, nz, off, wl, d, seed) => {
        const cx = px + nx * (off + d / 2), cz = pz + nz * (off + d / 2);
        for (const [a, b] of [[0, 0], [-0.4, -0.4], [0.4, -0.4], [0.4, 0.4], [-0.4, 0.4], [0, 0.42], [0, -0.42], [0.4, 0], [-0.4, 0]]) {
          const x = cx + ux * wl * a + nx * d * b, z = cz + uz * wl * a + nz * d * b;
          if (!inSec(x, z) || occ(x, z) || bAt(x, z)) return false;
        }
        const na = Math.ceil(wl * BS) + 1, nb = Math.ceil(d * BS) + 1;
        for (let ia = 0; ia <= na; ia++) for (let ib = 0; ib <= nb; ib++) { const a = ia / na - 0.5, b = ib / nb - 0.5; bMark(cx + ux * wl * a + nx * d * b, cz + uz * wl * a + nz * d * b); }
        building(cx, cz, ux, uz, wl / 2 - 0.05, d / 2 - 0.05, seed);
        return true;
      };
      const lineLots = (pts, halfW, pav) => {
        for (const side of [-1, 1]) {
          let acc = 0, k = 0;
          for (let i = 0; i + 1 < pts.length; i++) {
            const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L;
            let t = acc;
            while (t < L) {
              const wl = 3.2 + R() * 3.4, d = 4.5 + R() * 4;
              const px = ax + ux * (t + wl / 2), pz = az + uz * (t + wl / 2);
              tryLot(px, pz, ux, uz, -uz * side, ux * side, halfW + pav, wl, d, (sec.name === 'n' ? 1 : 2) * 1000 + k * 3.7 + side);
              t += wl + 0.15; k++;
            }
            acc = t - L;
          }
        }
      };
      // along the race road
      {
        const pts = []; for (let i = 0; i < track.N; i += 6) pts.push([track.x[i], track.z[i]]);
        pts.push(pts[0]);
        for (const side of [-1, 1]) {
          let k = 0;
          for (let s = 0; s < track.length; ) {
            const p = track.at(s), wl = 3.2 + R() * 3.2, d = 4.5 + R() * 4.2;
            const q = track.at(s + wl / 2);
            if (inSec(q.x, q.z, 10)) tryLot(q.x, q.z, q.tx, q.tz, q.nx * side, q.nz * side, q.w / 2 + 1.75, wl, d, (sec.name === 'n' ? 5 : 6) * 1000 + k * 1.37 + side * 0.5);
            s += wl + 0.15; k++;
            if (p.curv && Math.abs(p.curv) > 0.04) s += 0.6;
          }
        }
      }
      for (const [w, pts] of SIDE) lineLots(pts, w / 2, 0.6);
      // fill the rest of the blocks with back-yard buildings and gardens
      for (let k = 0; k < ww * wh * 0.12; k++) {
        const x = wx0 + R() * ww, z = wz0 + R() * wh;
        if (occ(x, z) || bAt(x, z)) continue;
        if (R() < 0.6) { const a = (R() - 0.5) * 0.25; tryLot(x, z, Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), -2, 2.8 + R() * 3.4, 3.2 + R() * 3.4, 9000 + k); }
      }
      // gardens and trees in the courtyards
      const treeAt = (x, z, rad) => {
        g.fillStyle = 'rgba(40,40,20,0.28)'; g.beginPath(); g.ellipse(x + rad * 0.35, z + rad * 0.45, rad, rad * 0.85, 0, 0, TAU); g.fill();
        g.fillStyle = R() < 0.5 ? PAL.tree : PAL.tree2; g.beginPath(); g.arc(x, z, rad, 0, TAU); g.fill();
        g.fillStyle = PAL.treeHi; g.globalAlpha = 0.55; g.beginPath(); g.arc(x - rad * 0.3, z - rad * 0.3, rad * 0.5, 0, TAU); g.fill(); g.globalAlpha = 1;
        g.strokeStyle = 'rgba(30,50,20,0.6)'; g.lineWidth = 0.1; g.beginPath(); g.arc(x, z, rad, 0, TAU); g.stroke();
      };
      for (let k = 0; k < ww * wh * 0.012; k++) {
        const x = wx0 + R() * ww, z = wz0 + R() * wh;
        if (occ(x, z) || bAt(x, z) || bAt(x + 1, z) || bAt(x - 1, z)) continue;
        treeAt(x, z, 0.8 + R() * 0.8);
      }
      // trees in the valley and on the squares
      for (let k = 0; k < 160; k++) {
        const x = -138 + R() * 290, z = sec.name === 'n' ? 13.5 + R() * 7 : 35 + R() * 14;
        if (roadD(x, z) < 2.5) continue;
        treeAt(x, z, 1 + R() * 1.1);
      }
      for (let x = SQ.armes[0] + 2.5; x < SQ.armes[2] - 1; x += 4) for (const z of [SQ.armes[1] + 2.5, SQ.armes[3] - 2.5]) treeAt(x, z, 1.5);
      for (let z = SQ.knuedler[1] + 3; z < SQ.knuedler[3] - 2; z += 4.5) treeAt(SQ.knuedler[0] + 2, z, 1.3);
      for (let x = SQ.esprit[0] + 3; x < SQ.esprit[2]; x += 5) treeAt(x, SQ.esprit[1] + 3, 1.6);
      g.restore();

      // ---- the race road: asphalt, kerbs at the corners, white edge lines, start grid
      g.save(); g.beginPath(); g.rect(wx0, wz0, ww, wh); g.clip();
      g.fillStyle = PAL.road; g.beginPath(); pathLoop(g, edgeLoop(-1, 0)); pathLoop(g, edgeLoop(1, 0)); g.fill('evenodd');
      for (let k = 0; k < 2200; k++) { const s = R() * track.length, p = track.place(s, (R() - 0.5) * track.w[track.idx(s)]); if (!inSec(p.x, p.z)) continue; g.fillStyle = R() < 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(40,36,32,0.12)'; g.fillRect(p.x, p.z, 0.3, 0.3); }
      // kerbs: red / white blocks on the edges wherever the road bends
      g.lineWidth = 1.15; g.lineCap = 'butt';
      for (const side of [-1, 1]) {
        let on = false, n = 0;
        for (let s = 0; s < track.length; s += 1.25) {
          const p = track.at(s), q = track.at(s + 1.25);
          let k = 0; for (let d = -6; d <= 6; d += 3) k = Math.max(k, Math.abs(track.at(s + d).curv));
          on = k > 1 / 32;
          n++;
          if (!on) continue;
          const o1 = side * (p.w / 2 + 0.45), o2 = side * (q.w / 2 + 0.45);
          g.strokeStyle = n % 2 ? PAL.kerbR : PAL.kerbW;
          g.beginPath(); g.moveTo(p.x + p.nx * o1, p.z + p.nz * o1); g.lineTo(q.x + q.nx * o2, q.z + q.nz * o2); g.stroke();
        }
      }
      g.lineCap = 'round';
      g.strokeStyle = PAL.line; g.lineWidth = 0.38;
      g.beginPath(); pathLoop(g, edgeLoop(-1, -0.45)); g.stroke();
      g.beginPath(); pathLoop(g, edgeLoop(1, -0.45)); g.stroke();
      // start / finish: chequered band and grid slots
      {
        const s0 = 62, p = track.at(s0), w = p.w;
        g.save(); g.translate(p.x, p.z); g.rotate(p.angle);
        for (let a = 0; a < 3; a++) for (let b = 0; b < Math.round(w / 0.9); b++) { g.fillStyle = (a + b) % 2 ? '#1c1a18' : '#f6f2e8'; g.fillRect(-1.35 + a * 0.9, -w / 2 + b * (w / Math.round(w / 0.9)), 0.9, w / Math.round(w / 0.9)); }
        g.restore();
        g.strokeStyle = PAL.line; g.lineWidth = 0.3;
        for (let k = 0; k < 4; k++) {
          const q = track.place(s0 - 6 - Math.floor(k / 2) * 7 - (k % 2) * 2.5, (k % 2 ? 1 : -1) * w * 0.22);
          g.save(); g.translate(q.x, q.z); g.rotate(q.angle);
          g.beginPath(); g.moveTo(1.6, -1.6); g.lineTo(2.2, -1.6); g.lineTo(2.2, 1.6); g.lineTo(1.6, 1.6); g.stroke();
          g.restore();
        }
      }
      // street names printed in the road
      const roadName = (s, text, size = 1.7) => {
        const p = track.at(s); if (!inSec(p.x, p.z)) return;
        g.save(); g.translate(p.x, p.z); let a = p.angle; if (Math.cos(a) < -0.2) a += PI; g.rotate(a);
        g.font = `italic 700 ${size}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = 'rgba(240,234,220,0.32)'; g.fillText(text, 0, 0); g.restore();
      };
      const nameAt = (x, z, text) => roadName(track.distTo(x, z).s, text);
      nameAt(-106, 53, 'Avenue de la Liberté'); nameAt(56, 78, 'Avenue de la Gare');
      nameAt(48, 5, 'Boulevard Roosevelt'); nameAt(20, -25, 'Rue de la Reine'); nameAt(94, -53, 'Marché-aux-Herbes'); nameAt(22, -69, "Rue de l'Eau");
      nameAt(-32, -53, 'Grand-Rue'); nameAt(140.5, -58, 'Chemin de la Corniche'); nameAt(-106, -22, 'Boulevard Royal');
      g.restore();

      // ---- labels
      const label = (x, z, text, size = 1.9, rot = 0, col = '#3b2a1c', it = true) => {
        if (!inSec(x, z, 10)) return;
        g.save(); g.translate(x, z); g.rotate(rot);
        g.font = `${it ? 'italic ' : ''}700 ${size}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineWidth = size * 0.28; g.strokeStyle = 'rgba(250,244,228,0.85)'; g.lineJoin = 'round'; g.strokeText(text, 0, 0);
        g.fillStyle = col; g.fillText(text, 0, 0); g.restore();
      };
      label(-79.5, -44.2, 'Place Guillaume II', 1.7); label(-79.5, -17.6, '« Knuedler »', 1.4);
      label(-47, -79, "Place d'Armes", 1.6);
      label(-79.5, 10.8, 'Place de la Constitution', 1.45);
      label(45, -33.2, 'Palais Grand-Ducal', 1.4); label(79, -45.2, 'Clairefontaine', 1.2);
      label(14, -3.4, 'Cathédrale Notre-Dame', 1.35);
      label(112, 4, 'Plateau du Saint-Esprit', 1.3);
      label(126, -84, 'Le Bock', 1.5);
      label(-20, 47, 'Vallée de la Pétrusse', 2.2, 0, '#2f4a22');
      label(-106, 49.5, 'Pont Adolphe', 1.6); label(PASS.x + 14, 46, 'Passerelle', 1.5);
      label(40, 16, 'Vallée de la Pétrusse', 1.6, 0, '#2f4a22');
      label(-40, 88.5, 'Quartier de la Gare', 1.5);
      if (sec.name === 's') {
        // title cartouche and compass rose in the south-west corner
        const cx = -100, cz = 88.6;
        g.fillStyle = 'rgba(245,236,214,0.94)'; g.strokeStyle = '#6b4a2c'; g.lineWidth = 0.3;
        g.fillRect(cx - 17, cz - 2.6, 34, 4.4); g.strokeRect(cx - 17, cz - 2.6, 34, 4.4); g.strokeRect(cx - 16.4, cz - 2.1, 32.8, 3.4);
        g.fillStyle = '#5a2a1c'; g.font = '700 2.2px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('LUXEMBOURG · VILLE HAUTE', cx, cz - 0.4);
      }
      if (sec.name === 'n') {
        const cx = 140, cz = -86;
        g.save(); g.translate(cx, cz);
        g.fillStyle = 'rgba(245,236,214,0.9)'; g.beginPath(); g.arc(0, 0, 3.6, 0, TAU); g.fill();
        g.strokeStyle = '#6b4a2c'; g.lineWidth = 0.18; g.stroke();
        for (let k = 0; k < 8; k++) {
          g.rotate(PI / 4); g.fillStyle = k % 2 ? '#c9b48a' : '#6b4a2c';
          g.beginPath(); g.moveTo(0, -(k % 2 ? 2.2 : 3.2)); g.lineTo(0.55, 0); g.lineTo(-0.55, 0); g.closePath(); g.fill();
        }
        g.fillStyle = '#5a2a1c'; g.font = '700 1.3px Georgia, serif'; g.textAlign = 'center'; g.fillText('N', 0, -3.7);
        g.restore();
      }
      sec.canvas = c; sec.wx0 = wx0; sec.wz0 = wz0; sec.ww = ww; sec.wh = wh; sec.g = g;
    };
    drawSection(secN);
    drawSection(secS);
    // the picture on the box lid: the whole map, scaled down (copied before the cut lines go in)
    const lidPic = cv(1024, 720, (g, w, h) => {
      g.fillStyle = '#18324f'; g.fillRect(0, 0, w, h);
      const sx = 3.0, sz = 3.0, ox = 62 + 150 * sx, oz = 122 + 95 * sz;
      g.fillStyle = '#d3c6a8'; g.fillRect(62, 122, 900, 570);
      g.fillStyle = '#7f9e55'; g.fillRect(62, oz + 12 * sz, 900, 26 * sz);
      for (const sec of sections) g.drawImage(sec.canvas, ox + sec.wx0 * sx, oz + sec.wz0 * sz, sec.ww * sx, sec.wh * sz);
      g.strokeStyle = '#f4ead2'; g.lineWidth = 6; g.strokeRect(62, 122, 900, 570);
      g.fillStyle = '#f4ead2'; g.font = '700 64px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('LUXEMBOURG', w / 2, 52);
      g.font = 'italic 30px Georgia, serif'; g.fillText('Ville Haute · vue à vol d’oiseau', w / 2, 94);
      g.fillStyle = '#e8b33c'; g.beginPath(); g.arc(w - 80, 62, 44, 0, TAU); g.fill();
      g.fillStyle = '#18324f'; g.font = '700 28px Rubik, sans-serif'; g.fillText('2000', w - 80, 52); g.font = '700 16px Rubik, sans-serif'; g.fillText('PIÈCES', w - 80, 78);
      g.fillStyle = '#f4ead2'; g.font = 'italic 700 24px Georgia, serif'; g.textAlign = 'left'; g.fillText('Atelier Puzzle', 30, 40);
      g.fillStyle = '#2c5a87'; g.fillRect(0, h - 12, w, 12); // side colour strip
    });

    // ---- atlas of loose pieces: copies of the print before the cut lines, plus back and edge colours
    const SLOT = 12, SPX = SLOT * PPU; // 12 x 12 units per slot
    const atlasCells = [];
    for (const sec of sections) {
      for (const [i, j] of sec.holes) atlasCells.push({ sec, i, j, kind: 'hole' });
      for (const [i, j] of sec.nudged) atlasCells.push({ sec, i, j, kind: 'nudge' });
      for (const [i, j] of sec.popped) atlasCells.push({ sec, i, j, kind: 'pop' });
    }
    for (let k = 0; k < 9; k++) { const sec = k % 3 === 2 ? secS : secN, G = sec.G; atlasCells.push({ sec, i: 2 + Math.floor(hash(k * 3.3) * (G.nx - 4)), j: 1 + Math.floor(hash(k * 5.1) * (G.nz - 2)), kind: 'loose' }); }
    const ACOLS = 6, AROWS = Math.ceil((atlasCells.length + 1) / ACOLS);
    const atlas = TX.makeCanvas(ACOLS * SPX, AROWS * SPX), ag = C2(atlas);
    atlasCells.forEach((a, k) => {
      const [cx, cz] = cellC(a.sec.G, a.i, a.j);
      a.slot = k; a.ax = (k % ACOLS) * SPX; a.ay = Math.floor(k / ACOLS) * SPX; a.cx = cx; a.cz = cz;
      ag.drawImage(a.sec.canvas, (cx - SLOT / 2 - a.sec.wx0) * PPU, (cz - SLOT / 2 - a.sec.wz0) * PPU, SPX, SPX, a.ax, a.ay, SPX, SPX);
    });
    { // back of a piece (blue-grey card) and the cut edge (pressed grey board)
      const k = atlasCells.length, ax = (k % ACOLS) * SPX, ay = Math.floor(k / ACOLS) * SPX;
      ag.fillStyle = '#9aa3a8'; ag.fillRect(ax, ay, SPX / 2, SPX);
      for (let n = 0; n < 400; n++) { ag.fillStyle = `rgba(${hash(n) < 0.5 ? '255,255,255' : '60,70,80'},0.15)`; ag.fillRect(ax + hash(n * 1.3) * SPX / 2, ay + hash(n * 2.9) * SPX, 1.5, 1.5); }
      ag.fillStyle = '#b9ab92'; ag.fillRect(ax + SPX / 2, ay, SPX / 2, SPX);
      A.backUV = [(ax + SPX * 0.25) / atlas.width, 1 - (ay + SPX * 0.5) / atlas.height];
      A.edgeUV = [(ax + SPX * 0.75) / atlas.width, 1 - (ay + SPX * 0.5) / atlas.height];
    }

    // ---- cut lines, holes, mask
    for (const sec of sections) {
      const G = sec.G, g = sec.g;
      g.lineCap = 'round'; g.lineJoin = 'round';
      const strokeEdge = (pts) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) g.lineTo(p[0], p[1]); g.stroke(); };
      g.save(); g.translate(0.07, 0.07); g.strokeStyle = 'rgba(255,250,235,0.3)'; g.lineWidth = 0.08;
      for (let j = 1; j < G.nz; j++) for (let i = 0; i < G.nx; i++) strokeEdge(hEdge(G, i, j));
      for (let i = 1; i < G.nx; i++) for (let j = 0; j < G.nz; j++) strokeEdge(vEdge(G, i, j));
      g.restore();
      g.strokeStyle = 'rgba(42,30,18,0.5)'; g.lineWidth = 0.1;
      for (let j = 1; j < G.nz; j++) for (let i = 0; i < G.nx; i++) strokeEdge(hEdge(G, i, j));
      for (let i = 1; i < G.nx; i++) for (let j = 0; j < G.nz; j++) strokeEdge(vEdge(G, i, j));
      // missing pieces: a dark pit with the cut card edge catching the light on the far side
      for (const [i, j] of sec.holes) {
        const o = pieceOutline(G, i, j), [, cz] = cellC(G, i, j);
        g.save(); g.beginPath(); pathPoly(g, o); g.clip();
        const gr = g.createLinearGradient(0, cz - P * 0.75, 0, cz + P * 0.75);
        gr.addColorStop(0, '#8a7558'); gr.addColorStop(0.1, '#4a3a2a'); gr.addColorStop(0.32, '#1a120c'); gr.addColorStop(1, '#070504');
        g.fillStyle = gr; g.fillRect(cellC(G, i, j)[0] - P, cz - P, P * 2, P * 2);
        g.restore();
        g.strokeStyle = '#d8c7a6'; g.lineWidth = 0.16; g.beginPath(); pathPoly(g, o); g.stroke();
      }
      // cut the print to the placed pieces (holes stay: they are painted)
      g.save();
      g.globalCompositeOperation = 'destination-in';
      g.fillStyle = '#fff'; g.beginPath();
      for (let j = 0; j < G.nz; j++) for (let i = 0; i < G.nx; i++) if (sec.placed.has(keyOf(i, j))) pathPoly(g, pieceOutline(G, i, j, 4));
      for (const [i, j] of sec.holes) pathPoly(g, pieceOutline(G, i, j, 4));
      g.fill('nonzero');
      g.restore();
    }

    // ---- groove normal map: the cut lines pressed into the card, plus a fine linen weave (tiles every Q pieces)
    const grooveTex = (() => {
      const S = lowQ ? 512 : 1024, U = Q * P, k = S / U;
      const c = TX.makeCanvas(S, S), g = C2(c);
      g.fillStyle = '#fff'; g.fillRect(0, 0, S, S);
      g.setTransform(k, 0, 0, k, 0, 0);
      const G0 = { x0: 0, z0: 0, nx: 99, nz: 99 };
      g.strokeStyle = '#000'; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 0.13;
      try { g.filter = `blur(${(0.035 * k).toFixed(2)}px)`; } catch (e) { /* no canvas filters */ }
      for (let j = -1; j <= Q + 1; j++) for (let i = -1; i <= Q; i++) for (const e of [hEdge(G0, i, j), vEdge(G0, j, i)]) { g.beginPath(); g.moveTo(e[0][0], e[0][1]); for (const p of e.slice(1)) g.lineTo(p[0], p[1]); g.stroke(); }
      g.filter = 'none';
      const d = g.getImageData(0, 0, S, S).data, h = new Float32Array(S * S);
      // linen: a fine woven texture from two cheap periodic tables
      const wx = new Float32Array(S), wy = new Float32Array(S);
      for (let i = 0; i < S; i++) { wx[i] = Math.sin(i * 2.2) * 0.5 + 0.5; wy[i] = Math.sin(i * 2.2 + 1.3) * 0.5 + 0.5; }
      for (let i = 0; i < S * S; i++) { const x = i % S, y = (i / S) | 0; h[i] = d[i * 4] / 255 * 0.9 + ((x + y) & 1 ? wx[x] : wy[y]) * 0.03; }
      const nt = TX.toTexture(TX.normalFromHeight(h, S, S, lowQ ? 3 : 5), { srgb: false });
      return nt;
    })();

    // ---- puzzle tiles: each section split into textures no wider than 1024 px
    const puzzleMats = [];
    for (const sec of sections) {
      const c = sec.canvas, nT = Math.ceil(c.width / 1024), tw = Math.ceil(c.width / nT);
      for (let t = 0; t < nT; t++) {
        const px0 = t * tw, pw = Math.min(tw, c.width - px0);
        const tc = cv(pw, c.height, (g) => g.drawImage(c, px0, 0, pw, c.height, 0, 0, pw, c.height));
        const map = tex(tc);
        const tx0 = sec.wx0 + px0 / PPU, tW = pw / PPU, tH = c.height / PPU, tz1 = sec.wz0 + tH, U = Q * P;
        const nm = grooveTex.clone(); nm.wrapS = nm.wrapT = T.RepeatWrapping;
        nm.repeat.set(tW / U, tH / U); nm.offset.set(fract((tx0 - sec.G.x0) / U), fract(1 - (tz1 - sec.G.z0) / U)); nm.needsUpdate = true;
        const mat = K.std({ map, normalMap: nm, normalScale: V2(0.55, -0.55), roughness: 0.6, alphaTest: 0.5, envMapIntensity: 0.6 });
        puzzleMats.push(mat);
        const m = K.mesh(new T.PlaneGeometry(tW, tH), mat, tx0 + tW / 2, PY, sec.wz0 + tH / 2, { rx: -PI / 2, cast: false });
        m.receiveShadow = true;
      }
    }

    // ================================================================== shared materials for the pop-ups
    const slateTex = TX.toTexture(cv(256, 256, (g, w, h) => {
      g.fillStyle = '#4a545e'; g.fillRect(0, 0, w, h);
      for (let row = 0; row < 16; row++) for (let k = 0; k < 9; k++) {
        const x = k * 32 + (row % 2) * 16 - 16, y = row * 16, t = 0.85 + hash(row * 9 + k) * 0.3;
        g.fillStyle = `rgb(${92 * t | 0},${103 * t | 0},${116 * t | 0})`;
        g.beginPath(); g.moveTo(x + 1, y); g.lineTo(x + 31, y); g.lineTo(x + 31, y + 12); g.quadraticCurveTo(x + 16, y + 17, x + 1, y + 12); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(28,32,38,0.55)'; g.lineWidth = 1.2; g.stroke();
      }
    }));
    const stoneTex = TX.toTexture(cv(256, 256, (g, w, h) => {
      g.fillStyle = '#b9a47c'; g.fillRect(0, 0, w, h);
      for (let row = 0; row < 8; row++) for (let k = 0; k < 6; k++) {
        const bw = 64, x = k * bw + (row % 2) * 32 - 32, y = row * 32, t = 0.86 + hash(row * 7.1 + k) * 0.22;
        g.fillStyle = `rgb(${226 * t | 0},${208 * t | 0},${170 * t | 0})`; g.fillRect(x + 2, y + 2, bw - 4, 28);
        g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(x + 2, y + 2, bw - 4, 4);
      }
      for (let n = 0; n < 1500; n++) { g.fillStyle = `rgba(${hash(n) < 0.5 ? '255,250,235' : '90,70,40'},0.12)`; g.fillRect(hash(n * 1.7) * w, hash(n * 2.3) * h, 2, 2); }
    }));
    const slateMat = K.std({ map: slateTex, vertexColors: true, roughness: 0.6, metalness: 0.05 });
    const stoneMat = K.std({ map: stoneTex, vertexColors: true, roughness: 0.92 });
    const paperMat = vc({ roughness: 0.88 });
    const bronzeMat = vc({ metalness: 0.6, roughness: 0.42 });
    const goldMat = K.std({ color: 0xf4c14a, metalness: 1, roughness: 0.2, envMapIntensity: 1.6 });
    const ironMat = vc({ metalness: 0.7, roughness: 0.35 });
    const glowMat = K.std({ color: 0xffe6b0, emissive: 0xffc860, emissiveIntensity: 0.8, roughness: 0.4 });
    // world-space UVs (for tiling stone and slate on merged parts)
    const wuv = (g, sc) => {
      g = g.index ? g.toNonIndexed() : g;
      g.computeVertexNormals();
      const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
      for (let i = 0; i < p.count; i++) {
        const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
        let u, v;
        if (ay > ax && ay > az) { u = p.getX(i); v = p.getZ(i); } else if (ax >= az) { u = p.getZ(i); v = p.getY(i); } else { u = p.getX(i); v = p.getY(i); }
        uv[i * 2] = u / sc; uv[i * 2 + 1] = v / sc;
      }
      g.setAttribute('uv', new T.BufferAttribute(uv, 2));
      return g;
    };
    const partW = (geo, mat, o, c = 0xffffff, sc = 5, cast = true) => {
      const key = mat.uuid + (cast ? 'c' : 'n');
      if (!bakeQ.has(key)) bakeQ.set(key, { mat, cast, parts: [] });
      bakeQ.get(key).parts.push(tidy(wuv(xf(geo.clone(), o), sc), c));
    };

    // ================================================================== the pop-up atlas: every printed face of the paper landmarks
    const FA = TX.makeCanvas(1024, 1024), fg = C2(FA);
    const REG = {};
    const region = (name, x, y, w, h, draw) => { REG[name] = [x, y, w, h]; fg.save(); fg.beginPath(); fg.rect(x, y, w, h); fg.clip(); fg.translate(x, y); draw(fg, w, h); fg.restore(); };
    const ruv = (name, u, v) => { const [x, y, w, h] = REG[name]; return [(x + clamp(u, 0, 1) * w) / 1024, 1 - (y + (1 - clamp(v, 0, 1)) * h) / 1024]; };
    const solid = (name, x, y, col) => region(name, x, y, 24, 24, (g) => { g.fillStyle = col; g.fillRect(0, 0, 24, 24); });
    solid('paper', 1000, 1000, '#f3ead8'); solid('stoneP', 976, 1000, '#ddcca6'); solid('dark', 952, 1000, '#2e2824');
    solid('wallP', 928, 1000, '#efe1c4'); solid('slateP', 904, 1000, '#5d6874'); solid('wood', 880, 1000, '#8a5a34');
    const ink = '#3b3127';
    const winRect = (g, x, y, w, h, frame = '#efe2c8', glass = '#3d4a58') => {
      g.fillStyle = frame; g.fillRect(x - 2, y - 2, w + 4, h + 4);
      g.fillStyle = glass; g.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(205,225,240,0.35)'; g.fillRect(x + 1, y + 1, w * 0.35, h * 0.4);
      g.strokeStyle = frame; g.lineWidth = Math.max(1, w * 0.1); g.beginPath(); g.moveTo(x + w / 2, y); g.lineTo(x + w / 2, y + h); g.moveTo(x, y + h * 0.42); g.lineTo(x + w, y + h * 0.42); g.stroke();
    };
    const gothic = (g, x, y, w, h, glass = '#3a4656') => {
      const arch = (o) => { g.beginPath(); g.moveTo(x - o, y + h); g.lineTo(x - o, y + w * 0.55); g.quadraticCurveTo(x - o, y - o * 1.5, x + w / 2, y - o * 2 - w * 0.2); g.quadraticCurveTo(x + w + o, y - o * 1.5, x + w + o, y + w * 0.55); g.lineTo(x + w + o, y + h); g.closePath(); };
      g.fillStyle = '#efe0bd'; arch(2.5); g.fill();
      g.fillStyle = glass; arch(0); g.fill();
      g.strokeStyle = 'rgba(235,222,195,0.85)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x + w / 2, y - w * 0.15); g.lineTo(x + w / 2, y + h); g.moveTo(x, y + h * 0.5); g.lineTo(x + w, y + h * 0.5); g.stroke();
      g.fillStyle = 'rgba(190,60,60,0.35)'; g.fillRect(x + 1, y + h * 0.5 + 2, w / 2 - 2, h * 0.2);
      g.fillStyle = 'rgba(70,110,190,0.35)'; g.fillRect(x + w / 2 + 1, y + h * 0.2, w / 2 - 2, h * 0.25);
    };
    region('palace', 0, 0, 1024, 256, (g, w, h) => {
      g.fillStyle = '#e4d0a6'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(150,108,62,0.32)'; g.lineWidth = 1.2;
      for (let x = -200; x < w + 200; x += 16) { g.beginPath(); g.moveTo(x, 34); g.lineTo(x + 140, 174); g.stroke(); g.beginPath(); g.moveTo(x + 140, 34); g.lineTo(x, 174); g.stroke(); }
      g.fillStyle = '#b89a6a'; g.fillRect(0, 20, w, 12); g.fillRect(0, 104, w, 6); g.fillRect(0, 172, w, 9);
      g.fillStyle = '#7f6648'; g.fillRect(0, 30, w, 3); g.fillRect(0, 179, w, 3);
      g.fillStyle = '#d5bd90'; g.fillRect(0, 182, w, 74);
      g.strokeStyle = 'rgba(120,90,55,0.45)'; g.lineWidth = 1.5; for (let y = 194; y < h; y += 12) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      const cols = 13;
      for (let c = 0; c < cols; c++) {
        const x = 34 + c * ((w - 68) / (cols - 1)) - 14;
        if (c === 6) continue;
        for (const [y, hh] of [[46, 48], [120, 44]]) {
          winRect(g, x, y, 28, hh, '#cdb487');
          g.fillStyle = '#b89a6a'; g.beginPath(); g.moveTo(x - 6, y - 4); g.lineTo(x + 14, y - 15); g.lineTo(x + 34, y - 4); g.closePath(); g.fill();
        }
        g.fillStyle = '#3e4a56'; g.beginPath(); g.moveTo(x + 2, 250); g.lineTo(x + 2, 210); g.arc(x + 14, 210, 12, PI, 0); g.lineTo(x + 26, 250); g.closePath(); g.fill();
        g.strokeStyle = '#b89a6a'; g.lineWidth = 3; g.stroke();
      }
      const cx = w / 2;
      g.fillStyle = '#5a3a24'; g.beginPath(); g.moveTo(cx - 24, h); g.lineTo(cx - 24, 212); g.arc(cx, 212, 24, PI, 0); g.lineTo(cx + 24, h); g.closePath(); g.fill();
      g.strokeStyle = '#a98a5a'; g.lineWidth = 6; g.stroke();
      winRect(g, cx - 18, 118, 36, 50, '#cdb487');
      g.fillStyle = '#efe4cc'; g.fillRect(cx - 40, 164, 80, 6); for (let k = 0; k < 10; k++) g.fillRect(cx - 38 + k * 8.4, 170, 3, 11);
      g.save(); g.translate(cx, 66); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(-17, -18); g.lineTo(17, -18); g.lineTo(17, 4); g.quadraticCurveTo(17, 22, 0, 28); g.quadraticCurveTo(-17, 22, -17, 4); g.closePath(); g.fill();
      g.save(); g.clip(); g.fillStyle = '#5b9bd5'; for (let k = 0; k < 6; k++) g.fillRect(-17, -18 + k * 8, 34, 4); g.fillStyle = '#d0312d'; g.beginPath(); g.ellipse(0, 4, 7, 11, 0.25, 0, TAU); g.fill(); g.beginPath(); g.arc(3, -6, 4.5, 0, TAU); g.fill(); g.restore();
      g.strokeStyle = '#7a5a2a'; g.lineWidth = 2.5; g.stroke(); g.restore();
      g.strokeStyle = ink; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4);
    });
    region('gable', 0, 256, 96, 96, (g, w, h) => {
      g.fillStyle = '#e4d0a6'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(150,108,62,0.32)'; g.lineWidth = 1; for (let x = -96; x < 200; x += 12) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 96, 96); g.stroke(); }
      winRect(g, 36, 40, 24, 34, '#cdb487');
      g.fillStyle = '#b89a6a'; g.fillRect(0, 86, w, 10);
      g.fillStyle = '#3e4a56'; g.beginPath(); g.arc(48, 22, 7, 0, TAU); g.fill(); g.strokeStyle = '#cdb487'; g.lineWidth = 3; g.stroke();
    });
    region('oriel', 96, 256, 64, 128, (g, w, h) => {
      g.fillStyle = '#ddc79a'; g.fillRect(0, 0, w, h);
      for (let k = 0; k < 4; k++) winRect(g, 4 + k * 15, 26, 9, 34, '#cdb487');
      for (let k = 0; k < 4; k++) winRect(g, 4 + k * 15, 78, 9, 30, '#cdb487');
      g.fillStyle = '#b89a6a'; g.fillRect(0, 0, w, 8); g.fillRect(0, 66, w, 5); g.fillRect(0, 118, w, 10);
    });
    region('nave', 160, 256, 512, 128, (g, w, h) => {
      g.fillStyle = '#d9c39a'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#c4ab80'; g.fillRect(0, h - 14, w, 14); g.fillRect(0, 0, w, 7);
      for (let k = 0; k < 9; k++) {
        const x = 12 + k * 56;
        g.fillStyle = '#c9b085'; g.fillRect(x - 10, 6, 8, h - 6); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x - 10, 6, 3, h - 6);
        if (k < 8) gothic(g, x + 12, 30, 22, 74);
      }
      g.strokeStyle = ink; g.lineWidth = 3; g.strokeRect(1.5, 1.5, w - 3, h - 3);
    });
    region('towerW', 672, 256, 128, 256, (g, w, h) => {
      g.fillStyle = '#dcc69c'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(120,95,60,0.4)'; g.lineWidth = 1.2; for (let y = 10; y < h; y += 14) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      g.fillStyle = '#c6ad80'; g.fillRect(0, 0, w, 10); g.fillRect(0, 96, w, 6); g.fillRect(0, 168, w, 6);
      for (const x of [26, 70]) { g.fillStyle = '#3a3330'; g.beginPath(); g.moveTo(x, 84); g.lineTo(x, 34); g.quadraticCurveTo(x + 16, 14, x + 32, 34); g.lineTo(x + 32, 84); g.closePath(); g.fill(); g.strokeStyle = '#8f7a5a'; g.lineWidth = 2; for (let y = 40; y < 84; y += 7) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 32, y); g.stroke(); } }
      g.fillStyle = '#f6efe0'; g.beginPath(); g.arc(64, 136, 22, 0, TAU); g.fill(); g.strokeStyle = '#3a3330'; g.lineWidth = 3; g.stroke();
      g.lineWidth = 3; g.beginPath(); g.moveTo(64, 136); g.lineTo(64, 120); g.moveTo(64, 136); g.lineTo(76, 140); g.stroke();
      gothic(g, 50, 196, 28, 46);
      g.strokeStyle = ink; g.lineWidth = 3; g.strokeRect(1.5, 1.5, w - 3, h - 3);
    });
    region('towerE', 800, 256, 64, 256, (g, w, h) => {
      g.fillStyle = '#dcc69c'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(120,95,60,0.4)'; g.lineWidth = 1; for (let y = 10; y < h; y += 14) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      g.fillStyle = '#3a3330'; g.beginPath(); g.moveTo(18, 90); g.lineTo(18, 40); g.quadraticCurveTo(32, 18, 46, 40); g.lineTo(46, 90); g.closePath(); g.fill();
      gothic(g, 22, 150, 20, 60);
      g.strokeStyle = ink; g.lineWidth = 3; g.strokeRect(1.5, 1.5, w - 3, h - 3);
    });
    const houseCols = ['#f0dcb4', '#e9c7a1', '#d9e2d0', '#efe2a6', '#e6cfc6', '#f2e8d4'];
    for (let k = 0; k < 6; k++) region('house' + k, (k % 4) * 128, 384 + Math.floor(k / 4) * 128, 128, 128, (g, w, h) => {
      g.fillStyle = houseCols[k]; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, 0, w, h * 0.3);
      for (const y of [70, 100]) for (const x of [18, 54, 90]) {
        winRect(g, x, y - 18, 18, 22, '#f8f2e6');
        g.fillStyle = k % 2 ? '#4f6f58' : '#6a4a38'; g.fillRect(x - 7, y - 19, 5, 24); g.fillRect(x + 20, y - 19, 5, 24);
      }
      g.fillStyle = '#5a3a24'; g.fillRect(56, 106, 16, 22);
      g.fillStyle = '#3e4a56'; g.beginPath(); g.arc(64, 30, 7, 0, TAU); g.fill(); g.strokeStyle = '#f8f2e6'; g.lineWidth = 3; g.stroke();
      g.fillStyle = 'rgba(80,60,40,0.25)'; g.fillRect(0, 118, w, 10);
    });
    const awnCols = [['#d23c32', '#f6efe2'], ['#2f7d4a', '#f6efe2'], ['#2d5f9e', '#f6efe2'], ['#e0a52a', '#f6efe2']];
    awnCols.forEach(([a, b], k) => region('awn' + k, 512 + k * 64, 512, 64, 128, (g, w, h) => {
      for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(i * 8, 0, 8, h); }
      g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, h - 10, w, 10);
    }));
    region('sentry', 768, 512, 128, 128, (g, w, h) => {
      g.fillStyle = '#f4efe4'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#c8302c';
      for (let k = -4; k < 8; k++) { g.beginPath(); g.moveTo(0, k * 24); g.lineTo(64, k * 24 + 30); g.lineTo(128, k * 24); g.lineTo(128, k * 24 + 12); g.lineTo(64, k * 24 + 42); g.lineTo(0, k * 24 + 12); g.closePath(); g.fill(); }
      g.strokeStyle = ink; g.lineWidth = 3; g.strokeRect(1.5, 1.5, w - 3, h - 3);
      g.fillStyle = '#2b2622'; g.fillRect(36, 30, 56, 98);
    });
    region('flag', 896, 512, 128, 84, (g, w, h) => {
      g.fillStyle = '#ed2939'; g.fillRect(0, 0, w, h / 3); g.fillStyle = '#ffffff'; g.fillRect(0, h / 3, w, h / 3); g.fillStyle = '#00a1de'; g.fillRect(0, 2 * h / 3, w, h / 3 + 1);
    });
    region('bock', 0, 640, 256, 128, (g, w, h) => {
      g.fillStyle = '#a99c84'; g.fillRect(0, 0, w, h);
      for (let n = 0; n < 60; n++) { g.fillStyle = `rgba(${hash(n) < 0.5 ? '70,60,48' : '220,210,190'},0.25)`; g.beginPath(); g.moveTo(hash(n * 3) * w, hash(n * 5) * h); g.lineTo(hash(n * 3) * w + 20, hash(n * 5) * h + 6); g.lineTo(hash(n * 3) * w + 6, hash(n * 5) * h + 18); g.closePath(); g.fill(); }
      for (const [x, y] of [[40, 60], [104, 74], [168, 58], [212, 82]]) { g.fillStyle = '#1e1a16'; g.beginPath(); g.moveTo(x, y + 30); g.lineTo(x, y + 10); g.arc(x + 12, y + 10, 12, PI, 0); g.lineTo(x + 24, y + 30); g.closePath(); g.fill(); }
    });
    region('archPanel', 256, 640, 256, 128, (g, w, h) => {
      g.fillStyle = '#cdb88f'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(110,85,50,0.45)'; g.lineWidth = 1.5;
      for (let y = 0; y < h; y += 14) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); for (let x = (y / 14) % 2 * 20; x < w; x += 40) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 14); g.stroke(); } }
      // voussoirs of the great arch springing from below the deck
      g.fillStyle = '#e3d4b0'; g.beginPath(); g.arc(w / 2, h + 40, 120, PI, TAU); g.arc(w / 2, h + 40, 92, TAU, PI, true); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(110,85,50,0.6)'; for (let a = PI; a < TAU; a += PI / 18) { g.beginPath(); g.moveTo(w / 2 + Math.cos(a) * 92, h + 40 + Math.sin(a) * 92); g.lineTo(w / 2 + Math.cos(a) * 120, h + 40 + Math.sin(a) * 120); g.stroke(); }
      g.fillStyle = '#1c1814'; g.beginPath(); g.arc(w / 2, h + 40, 92, PI, TAU); g.closePath(); g.fill();
    });
    region('note', 512, 640, 128, 128, (g, w, h) => {
      g.fillStyle = '#ffe56a'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(0, 0, w, 18);
      g.fillStyle = '#2a3a8c'; g.font = 'italic 700 19px Georgia, serif'; g.textAlign = 'center';
      g.fillText('Et feelen', 64, 48); g.fillText('3 Stécker!', 64, 74);
      g.strokeStyle = '#2a3a8c'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(30, 88); g.quadraticCurveTo(64, 100, 98, 86); g.stroke();
      g.beginPath(); g.arc(98, 108, 9, 0, TAU); g.stroke(); g.font = '700 14px Georgia, serif'; g.fillText('?', 98, 113);
    });
    region('boxSide', 640, 640, 384, 64, (g, w, h) => {
      g.fillStyle = '#18324f'; g.fillRect(0, 0, w, h);
      g.drawImage(lidPic, 62, 300, 900, 120, 0, 18, w, 30);
      g.fillStyle = '#e8b33c'; g.fillRect(0, 0, w, 6); g.fillRect(0, h - 6, w, 6);
      g.fillStyle = '#f4ead2'; g.font = '700 13px Georgia, serif'; g.textAlign = 'left'; g.fillText('LUXEMBOURG · VILLE HAUTE · 2000', 8, 15);
    });
    solid('boxIn', 856, 1000, '#bdb3a2');
    const faTex = TX.toTexture(FA, { wrap: false });
    const popMat = K.std({ map: faTex, vertexColors: true, roughness: 0.8 });
    const flagMat = popMat.clone(); flagMat.side = T.DoubleSide;

    // geometry helpers mapped into the atlas
    const fBox = (w, h, d, faces = {}, plain = 'paper') => {
      const g = new T.BoxGeometry(w, h, d), uv = g.attributes.uv, names = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
      for (let f = 0; f < 6; f++) {
        const nm = faces[names[f]];
        for (let k = 0; k < 4; k++) { const vi = f * 4 + k, [U, V] = nm ? ruv(nm, uv.getX(vi), uv.getY(vi)) : ruv(plain, 0.5, 0.5); uv.setXY(vi, U, V); }
      }
      return g;
    };
    const remap = (g, name) => { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) { const [U, V] = ruv(name, uv.getX(i), uv.getY(i)); uv.setXY(i, U, V); } return g; };
    const flatUV = (g, name) => { const uv = g.attributes.uv; const [U, V] = ruv(name, 0.5, 0.5); for (let i = 0; i < uv.count; i++) uv.setXY(i, U, V); return g; };
    const roofPrism = (len, dep, rh, over = 0.5) => {
      const s = new T.Shape([V2(-dep / 2 - over, -0.1), V2(dep / 2 + over, -0.1), V2(0, rh)]);
      const g = new T.ExtrudeGeometry(s, { depth: len + over * 2, bevelEnabled: false });
      g.translate(0, 0, -(len + over * 2) / 2); g.rotateY(PI / 2);
      return g;
    };
    const capPrism = (shapePts, d, front, plain = 'wallP') => { // shape extruded along z, front cap textured by its bounding box
      const s = new T.Shape(shapePts.map(([x, y]) => V2(x, y)));
      const g = new T.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
      g.translate(0, 0, -d / 2);
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const [x, y] of shapePts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      const pos = g.attributes.position, uv = g.attributes.uv, side = g.groups.find((q) => q.materialIndex === 1);
      for (let v = 0; v < pos.count; v++) {
        const isSide = side && v >= side.start && v < side.start + side.count;
        const [U, V] = !isSide && pos.getZ(v) > 0 && front ? ruv(front, (pos.getX(v) - x0) / (x1 - x0), (pos.getY(v) - y0) / (y1 - y0)) : ruv(plain, 0.5, 0.5);
        uv.setXY(v, U, V);
      }
      g.clearGroups();
      return g;
    };
    // pop-up base card: a thin white card glued to the print, with its fold line
    const card = (x, z, w, d) => {
      part(box(w, 0.07, d), paperMat, { x, y: PY + 0.035, z }, 0xf7f1e4, false);
      part(box(w - 0.6, 0.02, 0.08), paperMat, { x, y: PY + 0.075, z: z + d / 2 - 0.5 }, 0xc9bfa8, false);
    };
    const lamp = (x, y, z, hgt = 3.6) => {
      part(cyl(0.12, 0.16, hgt, 6), ironMat, { x, y: y + hgt / 2, z }, 0x2a2826);
      part(cyl(0.34, 0.2, 0.2, 6), ironMat, { x, y: y + hgt + 0.05, z }, 0x2a2826);
      part(cyl(0.3, 0.22, 0.7, 6), glowMat, { x, y: y + hgt + 0.5, z });
      part(new T.ConeGeometry(0.42, 0.5, 6), ironMat, { x, y: y + hgt + 1.1, z }, 0x2a2826);
    };

    // ================================================================== Grand Ducal Palace with the striped sentry box
    {
      const x0 = 27, x1 = 63, zf = -36.6, d = 8.4, h = 9.5, cx = (x0 + x1) / 2, cz = zf - d / 2;
      part(fBox(x1 - x0, h, d, { pz: 'palace' }, 'stoneP'), popMat, { x: cx, y: PY + h / 2, z: cz });
      partW(roofPrism(x1 - x0, d, 4.4), slateMat, { x: cx, y: PY + h, z: cz }, 0xffffff, 4);
      // stepped Renaissance gables on the front of the roof
      const step = [[-3, 0], [3, 0], [3, 1.5], [2.25, 1.5], [2.25, 2.8], [1.4, 2.8], [1.4, 3.9], [0.55, 3.9], [0.55, 4.8], [-0.55, 4.8], [-0.55, 3.9], [-1.4, 3.9], [-1.4, 2.8], [-2.25, 2.8], [-2.25, 1.5], [-3, 1.5]];
      for (const gx of [33.5, 45, 56.5]) part(capPrism(step, 0.35, 'gable', 'stoneP'), popMat, { x: gx, y: PY + h - 0.05, z: zf - 0.6 });
      // the two corner oriels with pointed caps
      for (const ox of [x0 + 1.6, x1 - 1.6]) {
        part(remap(cyl(1.45, 1.45, 6.4, 10, true), 'oriel'), popMat, { x: ox, y: PY + 3.2 + 3.2, z: zf + 0.6 });
        part(flatUV(cyl(1.45, 0.6, 1.2, 10), 'stoneP'), popMat, { x: ox, y: PY + 2.6, z: zf + 0.6 });
        partW(cyl(0, 1.75, 4.2, 10), slateMat, { x: ox, y: PY + 9.6 + 2.1, z: zf + 0.6 }, 0xffffff, 3);
        part(cyl(0.05, 0.05, 1.4, 4), ironMat, { x: ox, y: PY + 14.3, z: zf + 0.6 }, 0xc9a640);
        K.circle(ox, zf + 0.6, 1.5, 14);
      }
      K.box(cx, cz, (x1 - x0) / 2, d / 2, 0, 15);
      card(cx, cz + 1.0, x1 - x0 + 4.2, d + 1.2); // the pop-up's glued base card
      AO(cx, cz + 0.5, (x1 - x0) / 2 + 1.5, d / 2 + 1.5, 0.5);
      // flag on the roof
      part(cyl(0.08, 0.1, 6, 6), ironMat, { x: 45, y: PY + h + 4.4 + 2, z: cz }, 0xd8d0c0);
      const fl = new T.Mesh(remap(new T.PlaneGeometry(3, 2, 6, 1).translate(1.5, 0, 0), 'flag'), flagMat);
      fl.geometry.setAttribute('color', new T.BufferAttribute(new Float32Array(fl.geometry.attributes.position.count * 3).fill(1), 3));
      fl.position.set(45.1, PY + h + 4.4 + 4.0, cz); fl.castShadow = true;
      K.group.add(fl); A.flags.push({ m: fl, base: fl.geometry.attributes.position.array.slice(), ph: 0 });
      // sentry box and the guard
      const sx = 30.6, sz = -34.1;
      part(fBox(1.9, 3.3, 1.9, { pz: 'sentry', px: 'sentry', nx: 'sentry' }, 'paper'), popMat, { x: sx, y: PY + 1.65, z: sz });
      part(new T.ConeGeometry(1.6, 1.2, 4), paperMat, { x: sx, y: PY + 3.9, z: sz, ry: PI / 4 }, 0xb52a26);
      part(cyl(0.06, 0.06, 0.8, 4), ironMat, { x: sx, y: PY + 4.7, z: sz }, 0xc9a640);
      K.circle(sx, sz, 1.2, 4.6);
      AO(sx, sz, 1.6, 1.6, 0.5);
      const gx = 33.2, gz = -34.2;
      for (const s of [-1, 1]) part(cyl(0.14, 0.13, 1.0, 6), paperMat, { x: gx + s * 0.16, y: PY + 0.5, z: gz }, 0x1e2430);
      part(cyl(0.3, 0.26, 1.0, 8), paperMat, { x: gx, y: PY + 1.45, z: gz }, 0x283246);
      part(box(0.62, 0.1, 0.5), paperMat, { x: gx, y: PY + 1.1, z: gz }, 0xf4f0e6);
      part(new T.SphereGeometry(0.22, 10, 8), paperMat, { x: gx, y: PY + 2.15, z: gz }, 0xe6b894);
      part(cyl(0.24, 0.26, 0.3, 10), paperMat, { x: gx, y: PY + 2.38, z: gz }, 0x1e2430);
      part(cyl(0.04, 0.04, 1.4, 4), ironMat, { x: gx + 0.34, y: PY + 1.7, z: gz + 0.12, rz: 0.1 }, 0x3a3430);
      K.circle(gx, gz, 0.5, 2.6);
    }

    // ================================================================== Cathédrale Notre-Dame with its three slender spires
    {
      const zc = -11, x0 = 0, x1 = 29, wN = 9, hN = 8.5;
      part(fBox(x1 - x0, hN, wN, { pz: 'nave' }, 'stoneP'), popMat, { x: (x0 + x1) / 2, y: PY + hN / 2, z: zc });
      partW(roofPrism(x1 - x0, wN, 5.6, 0.4), slateMat, { x: (x0 + x1) / 2, y: PY + hN, z: zc }, 0xffffff, 4);
      part(flatUV(new T.CylinderGeometry(4.4, 4.4, hN, 8, 1, false, 0, PI), 'stoneP'), popMat, { x: x1, y: PY + hN / 2, z: zc });
      partW(new T.ConeGeometry(4.8, 4.6, 8, 1, false, 0, PI), slateMat, { x: x1, y: PY + hN + 2.3, z: zc }, 0xffffff, 4);
      // west tower and its spire with corner pinnacles
      const wx = -3;
      part(fBox(5.6, 17, 5.6, { pz: 'towerW' }, 'stoneP'), popMat, { x: wx, y: PY + 8.5, z: zc });
      partW(box(6.2, 0.6, 6.2), stoneMat, { x: wx, y: PY + 17.1, z: zc }, 0xe0cfa8, 3);
      partW(cyl(0, 2.7, 12.5, 8), slateMat, { x: wx, y: PY + 17.4 + 6.25, z: zc, ry: PI / 8 }, 0x9aa8a6, 3);
      for (const [px, pz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) partW(cyl(0, 0.45, 2.6, 6), slateMat, { x: wx + px * 2.6, y: PY + 17.4 + 1.3, z: zc + pz * 2.6 }, 0x9aa8a6, 3);
      part(cyl(0.05, 0.05, 1.6, 4), ironMat, { x: wx, y: PY + 30.6, z: zc }, 0xd8b850);
      part(box(0.9, 0.08, 0.08), ironMat, { x: wx, y: PY + 30.9, z: zc }, 0xd8b850);
      // two east towers flanking the choir
      for (const tz of [zc - 4.3, zc + 4.3]) {
        part(fBox(3.1, 13.6, 3.1, { pz: 'towerE' }, 'stoneP'), popMat, { x: x1 + 0.4, y: PY + 6.8, z: tz });
        partW(cyl(0, 1.6, 10.5, 8), slateMat, { x: x1 + 0.4, y: PY + 13.6 + 5.25, z: tz, ry: PI / 8 }, 0x9aa8a6, 3);
        part(cyl(0.04, 0.04, 1.2, 4), ironMat, { x: x1 + 0.4, y: PY + 24.6, z: tz }, 0xd8b850);
        K.circle(x1 + 0.4, tz, 2.1, 24);
      }
      K.box((x0 + x1) / 2, zc, (x1 - x0) / 2, wN / 2, 0, 15); K.box(wx, zc, 2.8, 2.8, 0, 30); K.circle(x1, zc, 4.4, 10);
      card(13.5, zc, 41.5, 12.4);
      AO((x0 + x1) / 2 - 1, zc + 0.6, (x1 - x0) / 2 + 5, wN / 2 + 2, 0.5);
    }

    // ================================================================== Gëlle Fra: the golden lady on her obelisk, Place de la Constitution
    {
      const gx = -79.5, gz = 3;
      partW(box(7, 0.8, 7), stoneMat, { x: gx, y: PY + 0.4, z: gz }, 0xf0e8da, 3);
      partW(box(5.4, 0.8, 5.4), stoneMat, { x: gx, y: PY + 1.2, z: gz }, 0xe8e0d0, 3);
      partW(box(3.4, 2.6, 3.4), stoneMat, { x: gx, y: PY + 2.9, z: gz }, 0xe0d8c8, 3);
      partW(box(3.8, 0.35, 3.8), stoneMat, { x: gx, y: PY + 4.3, z: gz }, 0xece4d6, 3);
      partW(cyl(1.0, 1.45, 14.6, 4), stoneMat, { x: gx, y: PY + 4.45 + 7.3, z: gz, ry: PI / 4 }, 0xe6e0d6, 3);
      partW(cyl(0, 1.0, 0.9, 4), stoneMat, { x: gx, y: PY + 19.05 + 0.45, z: gz, ry: PI / 4 }, 0xe6e0d6, 3);
      const y = PY + 19.6;
      part(box(1.2, 0.25, 1.2), goldMat, { x: gx, y: y + 0.12, z: gz });
      part(cyl(0.34, 0.72, 2.5, 12), goldMat, { x: gx, y: y + 1.5, z: gz });
      part(cyl(0.32, 0.36, 1.0, 12), goldMat, { x: gx, y: y + 3.2, z: gz });
      part(new T.SphereGeometry(0.3, 14, 10), goldMat, { x: gx, y: y + 3.95, z: gz });
      part(new T.SphereGeometry(0.26, 10, 8), goldMat, { x: gx - 0.05, y: y + 4.1, z: gz - 0.12, sx: 1, sy: 0.7, sz: 0.9 });
      for (const s of [-1, 1]) part(cyl(0.09, 0.11, 1.6, 6), goldMat, { x: gx + s * 0.42, y: y + 4.1, z: gz, rz: -s * 0.32 });
      part(new T.TorusGeometry(0.46, 0.11, 6, 18), goldMat, { x: gx, y: y + 4.95, z: gz, rx: PI / 2 });
      // bronze soldiers at the foot: one keeping watch, one fallen
      part(cyl(0.3, 0.38, 1.1, 8), bronzeMat, { x: gx - 0.6, y: PY + 2.15, z: gz + 2.4 }, 0x4a5c4c);
      part(new T.SphereGeometry(0.25, 10, 8), bronzeMat, { x: gx - 0.6, y: PY + 2.9, z: gz + 2.4 }, 0x4a5c4c);
      part(box(1.9, 0.38, 0.6), bronzeMat, { x: gx + 0.6, y: PY + 1.8, z: gz + 2.55, ry: 0.2 }, 0x4a5c4c);
      K.box(gx, gz, 3.5, 3.5, 0, 26);
      AO(gx, gz, 5, 5, 0.5);
    }

    // ================================================================== Place Guillaume II: William II on horseback and the Saturday market
    {
      const kx = -79.5, kz = -30.5;
      partW(box(6.4, 0.6, 4.6), stoneMat, { x: kx, y: PY + 0.3, z: kz }, 0xeee6d8, 3);
      partW(box(5.2, 2.9, 3.4), stoneMat, { x: kx, y: PY + 2.05, z: kz }, 0xe2d8c8, 3);
      partW(box(5.9, 0.4, 4.0), stoneMat, { x: kx, y: PY + 3.7, z: kz }, 0xeee6d8, 3);
      const hy = PY + 3.9, B = 0x4f6c5c;
      part(new T.SphereGeometry(1, 16, 10), bronzeMat, { x: kx, y: hy + 2.55, z: kz, sx: 2.0, sy: 0.95, sz: 0.82 }, B);
      part(cyl(0.42, 0.66, 2.1, 10), bronzeMat, { x: kx + 1.85, y: hy + 3.45, z: kz, rz: -0.75 }, B);
      part(box(1.5, 0.55, 0.55), bronzeMat, { x: kx + 2.75, y: hy + 3.95, z: kz, rz: -0.55 }, B);
      for (const [lx, lz, a] of [[1.25, -0.42, -0.35], [1.25, 0.42, 0.25], [-1.3, -0.42, 0.15], [-1.3, 0.42, -0.1]]) part(cyl(0.2, 0.15, 2.3, 6), bronzeMat, { x: kx + lx, y: hy + 1.1, z: kz + lz, rz: a }, B);
      part(cyl(0.12, 0.32, 1.7, 6), bronzeMat, { x: kx - 2.2, y: hy + 1.9, z: kz, rz: 0.55 }, B);
      part(cyl(0.36, 0.46, 1.5, 8), bronzeMat, { x: kx + 0.2, y: hy + 4.0, z: kz, rz: -0.08 }, B);
      part(new T.SphereGeometry(0.32, 10, 8), bronzeMat, { x: kx + 0.25, y: hy + 5.05, z: kz }, B);
      part(box(1.2, 0.3, 0.42), bronzeMat, { x: kx + 0.25, y: hy + 5.42, z: kz }, B);
      for (const s of [-1, 1]) part(cyl(0.16, 0.14, 1.5, 6), bronzeMat, { x: kx + 0.35, y: hy + 2.9, z: kz + s * 0.78, rz: 0.4 }, B);
      part(cyl(0.1, 0.1, 1.3, 6), bronzeMat, { x: kx + 0.9, y: hy + 4.3, z: kz - 0.4, rz: -0.9 }, B);
      K.box(kx, kz, 3.2, 2.3, 0, 10);
      AO(kx, kz, 4.2, 3.2, 0.5);
      // market stalls round the statue
      const stalls = [[-90.5, -41.2, 0], [-79.5, -41.2, 1], [-68.5, -41.2, 2], [-90.5, -19.6, 3], [-79.5, -19.6, 0], [-68.5, -19.6, 1], [-91.2, -30.5, 2]];
      const produce = [];
      for (const [sx, sz, k] of stalls) {
        const rot = sx < -90 && Math.abs(sz + 30.5) < 1 ? PI / 2 : 0;
        const pl = (lx, lz) => [sx + lx * Math.cos(rot) + lz * Math.sin(rot), sz - lx * Math.sin(rot) + lz * Math.cos(rot)];
        part(box(6, 1.3, 2.2), paperMat, { x: sx, y: PY + 0.65, z: sz, ry: rot }, 0x9a6a3e);
        part(box(6.2, 0.15, 2.4), paperMat, { x: sx, y: PY + 1.37, z: sz, ry: rot }, 0xe9dcc0);
        for (const [lx, lz] of [[-2.9, -1.5], [2.9, -1.5], [-2.9, 1.5], [2.9, 1.5]]) { const [px, pz] = pl(lx, lz); part(cyl(0.08, 0.08, 3.6, 5), paperMat, { x: px, y: PY + 1.8, z: pz }, 0x6a4a30); }
        part(fBox(6.8, 0.12, 4.0, { py: 'awn' + k, pz: 'awn' + k }, 'paper'), popMat, { x: sx, y: PY + 3.55, z: sz, ry: rot, rx: rot ? 0 : 0.2, rz: rot ? -0.2 : 0 });
        const cols = [[0xf08a1c, 0xe2501c], [0xc8241c, 0x9a1810], [0x7ab03c, 0x4e8a2c], [0xf2d23a, 0xe0a82a], [0x8a3c8a, 0x5a2a6a]][k % 5];
        for (let n = 0; n < 14; n++) { const [px, pz] = pl(-2.5 + (n % 7) * 0.8 + hash(n + sx) * 0.2, -0.5 + Math.floor(n / 7) * 0.9); produce.push({ x: px, y: PY + 1.62, z: pz, s: 0.6 + hash(n * 3 + sz) * 0.3, color: cols[n % 2] }); }
        const [cx, cz] = pl(0, 0);
        K.box(cx, cz, rot ? 1.9 : 3.15, rot ? 3.15 : 1.9, 0, 3.8);
        AO(cx, cz, rot ? 2.4 : 3.6, rot ? 3.6 : 2.4, 0.4);
      }
      K.instances(new T.SphereGeometry(0.42, 8, 6), K.std({ roughness: 0.5 }), produce, { colors: true, cast: false });
    }

    // ================================================================== Chemin de la Corniche: ramparts at the very edge, the Spanish turret, houses
    {
      const wx = 148.55;
      for (const [za, zb] of [[-38.5, -30.5], [-57, -46.5], [-78, -68.5]]) {
        const len = zb - za, zm = (za + zb) / 2;
        partW(box(1.5, 2.1, len), stoneMat, { x: wx, y: PY + 1.05, z: zm }, 0xeee2c8, 3);
        for (let z = za + 0.45; z < zb - 0.2; z += 1.45) partW(box(1.5, 0.7, 0.75), stoneMat, { x: wx, y: PY + 2.45, z }, 0xeee2c8, 3);
        K.box(wx, zm, 0.75, len / 2, 0, 3.2);
        AO(wx, zm, 1.6, len / 2 + 0.4, 0.45);
      }
      const tx = 149.1, tz = -51.8;
      partW(cyl(1.6, 1.8, 6.2, 14), stoneMat, { x: tx, y: PY + 3.1, z: tz }, 0xf2e8d2, 3);
      partW(cyl(0, 2.2, 4.4, 14), slateMat, { x: tx, y: PY + 6.2 + 2.2, z: tz }, 0xffffff, 3);
      part(box(0.5, 0.9, 0.12), paperMat, { x: tx - 1.1, y: PY + 3.6, z: tz + 1.25, ry: -0.6 }, 0x2e2824);
      K.circle(tx, tz, 1.8, 10);
      AO(tx, tz, 2.3, 2.3, 0.5);
      // a row of tall narrow houses between the Corniche and the Bock hairpin
      const hz = [-57, -52.2, -47.4, -42.6];
      hz.forEach((z, k) => {
        const h1 = 5.6 + hash(k * 3.3) * 1.6, h2 = h1 + 3.6;
        part(capPrism([[-4.5, 0], [4.5, 0], [4.5, h1], [0, h2], [-4.5, h1]], 4.5, 'house' + (k % 6)), popMat, { x: 126, y: PY, z });
        const sl = Math.hypot(4.5, h2 - h1), a = Math.atan2(h2 - h1, 4.5);
        for (const s of [-1, 1]) partW(box(sl + 0.5, 0.25, 4.9), slateMat, { x: 126 + s * 2.25, y: PY + (h1 + h2) / 2 + 0.12, z, rz: -s * a }, 0xffffff, 3);
        part(box(0.6, 1.4, 0.6), paperMat, { x: 126 + 1.4, y: PY + h2 - 0.4, z: z - 0.8 }, 0x8a5a44);
      });
      K.box(126, -49.8, 4.7, 9.7, 0, 12);
      card(126, -49.6, 10.8, 20.6);
      // a stretch of the old wall closes the gap between the houses and the Bock (nobody gets wedged in there)
      partW(box(2.2, 2.6, 3.6), stoneMat, { x: 126, y: PY + 1.3, z: -61.2 }, 0xe2d6bc, 3);
      for (let k = 0; k < 2; k++) partW(box(0.7, 0.6, 0.7), stoneMat, { x: 126 + (k - 0.5) * 1.2, y: PY + 2.9, z: -61.2 }, 0xe2d6bc, 3);
      K.box(126, -61.2, 1.1, 1.8, 0, 4);
      AO(126, -49.8, 5.8, 10.5, 0.5);
    }

    // ================================================================== Le Bock: the rock with its casemates and the ruined castle wall
    {
      const bx = 126, bz = -66.6;
      const rock = [];
      for (let k = 0; k < 11; k++) { const a = k / 11 * TAU, rr = 4.6 + hash(k * 2.1) * 0.9; rock.push([Math.cos(a) * rr, Math.sin(a) * rr * 0.85]); }
      const rs = new T.Shape(rock.map(([x, y]) => V2(x, y)));
      const rg = new T.ExtrudeGeometry(rs, { depth: 2.8, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.5, bevelSegments: 1 });
      rg.rotateX(-PI / 2);
      partW(rg, stoneMat, { x: bx, y: PY, z: bz }, 0xa49680, 2.5);
      part(fBox(7, 2.6, 0.3, { pz: 'bock' }, 'stoneP'), popMat, { x: bx, y: PY + 1.4, z: bz + 4.15 });
      partW(box(5.5, 2.4, 0.9), stoneMat, { x: bx - 0.8, y: PY + 3.3 + 1.2, z: bz - 0.6 }, 0xd8ccb0, 3);
      for (let k = 0; k < 4; k++) partW(box(0.7, 0.6, 0.9), stoneMat, { x: bx - 3.1 + k * 1.5, y: PY + 5.0, z: bz - 0.6 }, 0xd8ccb0, 3);
      partW(cyl(1.15, 1.25, 4.6, 12), stoneMat, { x: bx + 2.6, y: PY + 3.3 + 2.3, z: bz + 0.4 }, 0xe0d4b8, 3);
      for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; partW(box(0.5, 0.6, 0.5), stoneMat, { x: bx + 2.6 + Math.cos(a) * 1.0, y: PY + 8.2, z: bz + 0.4 + Math.sin(a) * 1.0 }, 0xe0d4b8, 3); }
      part(cyl(0.06, 0.06, 4, 5), ironMat, { x: bx + 2.6, y: PY + 9.9, z: bz + 0.4 }, 0xd8d0c0);
      const fl = new T.Mesh(remap(new T.PlaneGeometry(2.4, 1.6, 6, 1).translate(1.2, 0, 0), 'flag'), flagMat);
      fl.geometry.setAttribute('color', new T.BufferAttribute(new Float32Array(fl.geometry.attributes.position.count * 3).fill(1), 3));
      fl.position.set(bx + 2.65, PY + 11.1, bz + 0.4); fl.castShadow = true; K.group.add(fl);
      A.flags.push({ m: fl, base: fl.geometry.attributes.position.array.slice(), ph: 1.7 });
      K.circle(bx, bz, 5.4, 9);
      AO(bx, bz, 6.5, 6, 0.5);
    }

    // ================================================================== the bridges: Adolphe Bridge (take-off and landing halves) and the Passerelle
    const deckTex = TX.toTexture(cv(128, 128, (g, w, h) => {
      g.fillStyle = PAL.road; g.fillRect(0, 0, w, h);
      for (let n = 0; n < 900; n++) { g.fillStyle = hash(n) < 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(40,36,32,0.12)'; g.fillRect(hash(n * 1.3) * w, hash(n * 2.7) * h, 2, 2); }
      g.fillStyle = PAL.line; g.fillRect(4, 0, 4, h); g.fillRect(w - 8, 0, 4, h);
    }), { repeat: [1, 1] });
    const deckMat = K.std({ map: deckTex, roughness: 0.8 });
    const deckQuad = (x, hw, z0, z1, y0, y1) => {
      const g = new T.BufferGeometry(), L = Math.hypot(z1 - z0, y1 - y0) / 13;
      const a = [x - hw, y0, z0], b = [x + hw, y0, z0], c = [x + hw, y1, z1], d = [x - hw, y1, z1];
      const up = z1 > z0; // keep the faces pointing up
      const tri = up ? [a, c, b, a, d, c] : [a, b, c, a, c, d];
      const uvOf = (p) => [(p[0] - (x - hw)) / (2 * hw), p === a || p === b ? 0 : L];
      g.setAttribute('position', new T.Float32BufferAttribute(tri.flat(), 3));
      g.setAttribute('uv', new T.Float32BufferAttribute(tri.map(uvOf).flat(), 2));
      g.computeVertexNormals();
      return g;
    };
    const wedge = (z0, z1, h0, h1, wid, base = TOP) => {
      const g = box(wid, 1, Math.abs(z1 - z0)), p = g.attributes.position, zm = (z0 + z1) / 2;
      for (let v = 0; v < p.count; v++) { const z = p.getZ(v) + zm, top = p.getY(v) > 0; p.setXYZ(v, p.getX(v), top ? PY + lerp(h0, h1, (z - z0) / (z1 - z0)) : base, z); }
      g.computeVertexNormals();
      return g;
    };
    const balustrade = (x, z0, z1, h0, h1) => {
      const L = Math.abs(z1 - z0), n = Math.floor(L / 1.1);
      for (let k = 0; k <= n; k++) { const t = k / n, z = lerp(z0, z1, t), y = PY + lerp(h0, h1, t); partW(cyl(0.16, 0.2, 1.1, 6), stoneMat, { x, y: y + 0.55, z }, 0xf0e6d0, 2); }
      const a = Math.atan2(h1 - h0, z1 - z0);
      partW(box(0.55, 0.3, Math.hypot(L, h1 - h0) + 0.4), stoneMat, { x, y: PY + (h0 + h1) / 2 + 1.25, z: (z0 + z1) / 2, rx: -a }, 0xf4ead6, 2);
      partW(box(0.6, 0.35, Math.hypot(L, h1 - h0) + 0.4), stoneMat, { x, y: PY + (h0 + h1) / 2 + 0.1, z: (z0 + z1) / 2, rx: -a }, 0xe8dcc2, 2);
    };
    const decks = [];
    {
      const x = JUMP.x, hw = JUMP.wid / 2, ph = 0.75;
      // take-off half: rises to the table edge
      partW(wedge(JUMP.z0, JUMP.z1, 0, JUMP.h, JUMP.wid + 2), stoneMat, { x }, 0xeadfc6, 4);
      decks.push(deckQuad(x, hw, JUMP.z0, JUMP.z1, PY + 0.04, PY + JUMP.h + 0.04));
      K.ramp(x, (JUMP.z0 + JUMP.z1) / 2, PI / 2, JUMP.z1 - JUMP.z0, JUMP.wid, JUMP.h, 0);
      for (const s of [-1, 1]) {
        balustrade(x + s * (hw + ph), JUMP.z0 - 0.5, JUMP.z1, 0, JUMP.h);
        K.capsule(x + s * (hw + ph), JUMP.z0 - 0.5, x + s * (hw + ph), JUMP.z1, 0.55, JUMP.h + 1.7);
        lamp(x + s * (hw + ph), PY + JUMP.h + 1.3, JUMP.z1 - 0.4, 2.6);
        lamp(x + s * (hw + ph), PY + 1.3, JUMP.z0 - 0.5, 3);
      }
      // the arch below the end of the deck, hanging into the valley
      part(fBox(JUMP.wid + 2, 9, 0.6, { pz: 'archPanel' }, 'stoneP'), popMat, { x, y: TOP - 4.5, z: TN.z1 + 0.35 });
      AO(x, (JUMP.z0 + JUMP.z1) / 2, hw + 2.5, (JUMP.z1 - JUMP.z0) / 2 + 1, 0.4);
      // landing half: rises from the far side of the valley
      const lw = LAND.wid / 2;
      partW(wedge(LAND.z1, LAND.z0, 0, LAND.h, LAND.wid + 2), stoneMat, { x }, 0xeadfc6, 4);
      decks.push(deckQuad(x, lw, LAND.z1, LAND.z0, PY + 0.04, PY + LAND.h + 0.04));
      K.ramp(x, (LAND.z0 + LAND.z1) / 2, -PI / 2, LAND.z1 - LAND.z0, LAND.wid, LAND.h, 0);
      for (const s of [-1, 1]) {
        balustrade(x + s * (lw + ph), LAND.z1 + 0.5, LAND.z0, 0, LAND.h);
        K.capsule(x + s * (lw + ph), LAND.z0, x + s * (lw + ph), LAND.z1 + 0.5, 0.55, LAND.h + 1.7);
        lamp(x + s * (lw + ph), PY + 1.3, LAND.z1 + 0.5, 3);
      }
      AO(x, (LAND.z0 + LAND.z1) / 2, lw + 2.5, (LAND.z1 - LAND.z0) / 2 + 1, 0.4, 0, TOP + 0.04);
      A.jumpRespawnS = track.distTo(x, JUMP.z0 - 28).s;
    }
    {
      const x = PASS.x, hw = PASS.hw, z0 = PASS.z0, z1 = PASS.z1;
      partW(box(hw * 2 + 0.4, 1.7, z1 - z0), stoneMat, { x, y: PY - 0.83, z: (z0 + z1) / 2 }, 0xe6dac0, 4);
      decks.push(deckQuad(x, hw, z1, z0, PY + 0.05, PY + 0.05).translate(0, 0, 0));
      for (const s of [-1, 1]) {
        const px = x + s * (hw + 0.5);
        partW(box(0.95, 1.5, 16.5), stoneMat, { x: px, y: PY + 0.75, z: 28 }, 0xeee2c8, 3);
        partW(box(1.15, 0.2, 16.9), stoneMat, { x: px, y: PY + 1.55, z: 28 }, 0xf6ecd8, 3);
        K.box(px, 28, 0.5, 8.25, 0, 1.7);
        lamp(px, PY + 1.65, 20.3, 2.4); lamp(px, PY + 1.65, 35.7, 2.4);
        // splayed wing walls at the south end guide a car that comes out of the corner wide onto the deck
        const wl = Math.hypot(2.8, 5.5), wa = Math.atan2(2.8, 5.5) * s;
        partW(box(0.95, 1.5, wl + 0.5), stoneMat, { x: px + s * 1.4, y: PY + 0.75, z: 38.75, ry: wa }, 0xeee2c8, 3);
        partW(box(1.15, 0.2, wl + 0.7), stoneMat, { x: px + s * 1.4, y: PY + 1.55, z: 38.75, ry: wa }, 0xf6ecd8, 3);
        K.capsule(px, 36.0, px + s * 2.8, 41.5, 0.5, 1.7);
        AO(px + s * 1.4, 38.75, 1.2, 3.6, 0.35, wa);
      }
      // arcade below the deck, seen down in the valley
      for (const pz of [TS.z0 - 0.5, TN.z1 + 0.5]) {
        const sh = new T.Shape([V2(-hw - 1, 0), V2(hw + 1, 0), V2(hw + 1, -15), V2(-hw - 1, -15)]);
        for (const ax of [-3.6, 3.6]) { const hole = new T.Path(); hole.moveTo(ax - 2.6, -15.1); hole.lineTo(ax - 2.6, -6); hole.absarc(ax, -6, 2.6, PI, 0, true); hole.lineTo(ax + 2.6, -15.1); hole.closePath(); sh.holes.push(hole); }
        partW(new T.ExtrudeGeometry(sh, { depth: 0.8, bevelEnabled: false, curveSegments: 8 }), stoneMat, { x, y: PY - 1.7, z: pz - 0.4 }, 0xd8caa8, 3);
      }
    }
    {
      const g = BU.mergeGeometries(decks.map((d) => d.index ? d.toNonIndexed() : d), false);
      const m = new T.Mesh(g, deckMat); m.receiveShadow = true; K.group.add(m);
    }

    // ================================================================== chicane islands: raised flower beds filling the inside of both chicanes
    // (the kerb is a chain of capsules, so nobody drives straight through; the Gare one is closed to the table edge by a pencil)
    const pip = (x, z, poly) => { let inside = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside; } return inside; };
    {
      const leafC = cv(256, 256, (g, w, h) => {
        g.fillStyle = '#4a7a34'; g.fillRect(0, 0, w, h);
        const R = K.rng(61);
        for (let n = 0; n < 1600; n++) { const t = R(); g.fillStyle = t < 0.4 ? 'rgba(34,70,26,0.55)' : t < 0.8 ? 'rgba(110,160,72,0.5)' : 'rgba(165,200,105,0.55)'; g.beginPath(); g.ellipse(R() * w, R() * h, 2 + R() * 4, 1.2 + R() * 2, R() * PI, 0, TAU); g.fill(); }
      });
      const lawnC = cv(256, 256, (g, w, h) => {
        g.fillStyle = '#7fa654'; g.fillRect(0, 0, w, h);
        const R = K.rng(62);
        for (let n = 0; n < 3000; n++) { g.fillStyle = R() < 0.5 ? 'rgba(60,100,40,0.35)' : 'rgba(170,205,120,0.35)'; g.fillRect(R() * w, R() * h, 1.5, 3); }
      });
      const hedgeMat = K.std({ map: TX.toTexture(leafC, { repeat: [1, 1] }), roughness: 0.92 });
      const lawnMat = K.std({ map: TX.toTexture(lawnC, { repeat: [1, 1] }), roughness: 0.95 });
      const kerbMat = K.std({ map: stoneTex, roughness: 0.88, color: 0xfff8ec });
      // clip a closed polygon to the half-plane p[ax] <= v
      const clip = (poly, ax, v) => {
        const out = [], inn = (p) => p[ax] <= v;
        for (let i = 0; i < poly.length; i++) {
          const a = poly[i], b = poly[(i + 1) % poly.length];
          if (inn(a)) out.push(a);
          if (inn(a) !== inn(b)) { const t = (v - a[ax]) / (b[ax] - a[ax]), q = [lerp(a[0], b[0], t), lerp(a[1], b[1], t)]; q[ax] = v; out.push(q); }
        }
        return out;
      };
      // a flat slab (optionally with a hole), world-space UVs
      const slab = (outerP, holeP, y, depth, mat) => {
        const sh = new T.Shape(outerP.map(([x, z]) => V2(x, -z)));
        if (holeP) sh.holes.push(new T.Path(holeP.map(([x, z]) => V2(x, -z))));
        const g = new T.ExtrudeGeometry(sh, { depth, bevelEnabled: false });
        g.rotateX(-PI / 2);
        const uv = g.attributes.uv, pos = g.attributes.position;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + pos.getY(i)) / 8, (pos.getZ(i) + pos.getY(i)) / 8);
        const m = new T.Mesh(g, mat); m.position.y = y; m.castShadow = true; m.receiveShadow = true; K.group.add(m);
        return m;
      };
      const flowers = [], hedges = [];
      for (const ch of ISL) {
        const sA = track.distTo(ch.a[0], ch.a[1]).s - ch.ext, sB = track.distTo(ch.b[0], ch.b[1]).s + ch.ext;
        const L = ((sB - sA) % track.length + track.length) % track.length;
        const ring = (off) => { const out = []; const n = Math.ceil(L / 1.5); for (let k = 0; k <= n; k++) { const s = sA + L * k / n, p = track.at(s), q = track.place(s, ch.side * (p.w / 2 + off)); out.push([q.x, q.z]); } return out; };
        const band = (off) => clip(ring(off), ch.ax, ch.v - (off - KERB)); // the closing line moves in with the ring
        const outer = band(KERB), lawn = band(KERB + 0.6), rim = band(KERB + 1.25), bed = band(KERB + 2.4);
        slab(outer, lawn, PY, 0.7, kerbMat);
        slab(lawn, null, PY, 0.55, lawnMat);
        // collider ring: capsules (r 0.75) whose surface follows the kerb line
        const coll = band(KERB + 0.75);
        for (let i = 0; i < coll.length; i += 2) { const a = coll[i], b = coll[(i + 2) % coll.length]; K.capsule(a[0], a[1], b[0], b[1], 0.75, 2.1); }
        // clipped hedge all round the rim
        for (let i = 0; i < rim.length; i++) {
          const a = rim[i], b = rim[(i + 1) % rim.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (len < 0.2) continue;
          hedges.push({ x: (a[0] + b[0]) / 2, y: PY + 1.25, z: (a[1] + b[1]) / 2, ry: -Math.atan2(b[1] - a[1], b[0] - a[0]), sx: len + 0.45, sy: 1.4, sz: 1.3 });
        }
        // flower beds inside
        let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [x, z] of bed) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
        const R = K.rng(71 + ch.ax * 3 + ch.side), cols = [0xe23a3a, 0xf6d23c, 0xffffff, 0xd25aa0, 0xf08a2a, 0x7a5ad8];
        for (let n = 0, tries = 0; n < (ch.kind === 'houses' ? 26 : 90) && tries < 900; tries++) {
          const x = lerp(x0, x1, R()), z = lerp(z0, z1, R());
          if (!pip(x, z, bed) || (ch.kind === 'houses' ? Math.abs(x - ch.mx) < 7.6 && Math.abs(z - ch.mz) < 3.6 : Math.hypot(x - ch.mx, z - ch.mz) < ch.mr)) continue;
          const c = cols[Math.floor(R() * cols.length)];
          for (let m = 0; m < 4; m++) flowers.push({ x: x + R.gauss() * 0.4, y: PY + 0.62, z: z + R.gauss() * 0.4, s: 0.2 + R() * 0.12, color: c });
          n++;
        }
      }
      K.instances(new T.DodecahedronGeometry(1, 0), K.std({ roughness: 0.6, flatShading: true }), flowers, { colors: true, cast: false });
      K.instances(new K.RoundedBoxGeometry(1, 1, 1, 1, 0.3), hedgeMat, hedges);
      // Gare island: a round fountain; the pencil lying from the flower bed over the table edge closes the way round it
      {
        const [fx, fz] = [ISL[0].mx, ISL[0].mz], y = PY + 0.55;
        part(K.lathe([[0, 0], [3.3, 0], [3.4, 0.9], [3.05, 0.95], [2.95, 0.35], [0, 0.35]], 32), stoneMat, { x: fx, y, z: fz }, 0xf2ead8);
        part(K.lathe([[0.55, 0], [0.4, 0.8], [0.3, 1.5], [0.95, 1.7], [1.0, 1.85], [0.2, 1.9], [0.15, 2.6], [0.4, 2.8], [0, 3.0]], 16), stoneMat, { x: fx, y: y + 0.35, z: fz }, 0xeee4d0);
        K.mesh(new T.CircleGeometry(2.97, 32), K.liquid(0x6fa6c8, { roughness: 0.05, transparent: true, opacity: 0.85 }), fx, y + 0.75, fz, { rx: -PI / 2, cast: false });
        A.fountain = K.mesh(new T.CylinderGeometry(0.06, 1.0, 1.9, 12, 1, true), K.std({ color: 0xe4f2ff, transparent: true, opacity: 0.4, roughness: 0.1, depthWrite: false, side: T.DoubleSide }), fx, y + 4.2, fz, { cast: false });
        AO(fx, fz, 4, 4, 0.4, 0, y + 0.02);
        const pen = { x: 12.6, y: PY + 0.42, z: 93.7, ry: -PI / 2 - 0.04 };
        const pfr = (g, o) => xf(xf(g, o), pen);
        part(pfr(cyl(0.42, 0.42, 14, 6), { rz: PI / 2 }), paperMat, {}, 0xf2b81c);
        part(pfr(new T.ConeGeometry(0.42, 1.6, 6), { rz: -PI / 2, x: 7.8 }), paperMat, {}, 0xe0c08a);
        part(pfr(new T.ConeGeometry(0.13, 0.4, 6), { rz: -PI / 2, x: 8.45 }), paperMat, {}, 0x3a3a3a);
        part(pfr(cyl(0.44, 0.44, 1.2, 10), { rz: PI / 2, x: -7.6 }), paperMat, {}, 0xe88a8a);
        part(pfr(cyl(0.45, 0.45, 0.6, 10), { rz: PI / 2, x: -6.8 }), ironMat, {}, 0xc8c8c0);
        K.capsule(12.6, 84.6, 12.6, 96, 0.5, 1.1);
        AO(12.6, 89.5, 1.1, 5, 0.35);
      }
      // Krautmaart island: a bronze grand duchess on a low plinth
      {
        const [sx, sz] = [ISL[1].mx, ISL[1].mz], y0 = PY + 0.55;
        partW(box(3.4, 0.9, 3.4), stoneMat, { x: sx, y: y0 + 0.45, z: sz }, 0xf0e8da, 3);
        partW(box(2.2, 1.7, 2.2), stoneMat, { x: sx, y: y0 + 0.9 + 0.85, z: sz }, 0xe6ded0, 3);
        partW(box(2.5, 0.3, 2.5), stoneMat, { x: sx, y: y0 + 2.75, z: sz }, 0xf0e8da, 3);
        const Bz = 0x50685a, y = y0 + 2.9;
        part(cyl(0.38, 0.8, 2.0, 10), bronzeMat, { x: sx, y: y + 1.0, z: sz }, Bz);
        part(cyl(0.28, 0.38, 0.85, 10), bronzeMat, { x: sx, y: y + 2.4, z: sz }, Bz);
        part(new T.SphereGeometry(0.27, 10, 8), bronzeMat, { x: sx, y: y + 3.05, z: sz }, Bz);
        part(cyl(0.08, 0.1, 1.0, 6), bronzeMat, { x: sx + 0.35, y: y + 2.5, z: sz + 0.2, rz: -0.5, rx: 0.4 }, Bz);
        part(cyl(0.3, 0.32, 0.12, 10), bronzeMat, { x: sx, y: y + 3.3, z: sz }, Bz);
        AO(sx, sz, 2.6, 2.6, 0.4, 0, y0 + 0.02);
      }
      // Rue Chimay island, inside the hairpin: a terrace of three narrow town houses behind the hedge (low, so they hide no road)
      {
        const I = ISL[2], y0 = PY + 0.55;
        [-37.2, -32.6, -28.0].forEach((hx, k) => {
          const h1 = 3.5 + hash(k * 5.7) * 0.8, h2 = h1 + 2.3, dz = 6.2;
          part(capPrism([[-2.2, 0], [2.2, 0], [2.2, h1], [0, h2], [-2.2, h1]], dz, 'house' + ((k + 3) % 6)), popMat, { x: hx, y: y0, z: I.mz });
          const sl = Math.hypot(2.2, h2 - h1), a = Math.atan2(h2 - h1, 2.2);
          for (const sd of [-1, 1]) partW(box(sl + 0.4, 0.22, dz + 0.5), slateMat, { x: hx + sd * 1.1, y: y0 + (h1 + h2) / 2 + 0.1, z: I.mz, rz: -sd * a }, 0xffffff, 3);
          part(box(0.5, 1.1, 0.5), paperMat, { x: hx + 0.9, y: y0 + h2 - 0.2, z: I.mz - 1.5 }, 0x8a5a44);
        });
        AO(-32.6, I.mz + 0.5, 8.5, 4.2, 0.45, 0, y0 + 0.02);
      }
    }

    // ================================================================== pop-up paper trees
    {
      // folded paper trees: a faceted crown on a little trunk
      const tg = BU.mergeGeometries([
        tidy(xf(new T.IcosahedronGeometry(1, 0), { y: 4.3, sx: 2.0, sy: 2.25, sz: 2.0, ry: 0.4 }), 0x6a9e4a),
        tidy(xf(new T.IcosahedronGeometry(1, 0), { x: 0.7, y: 5.6, z: 0.3, s: 1.15, rx: 0.7 }), 0x7eb258),
        tidy(xf(cyl(0.2, 0.3, 2.8, 6), { y: 1.4 }), 0x7a5536),
      ], false);
      const spots = [
        [-93, -1], [-66, -1], [-93, 10], [-66, 10], [-56, -84], [-47, -84], [-38, -84], [-56, -73], [-38, -73],
        [-94, -30.5], [103, -9], [116, -11], [104, 3], [121, 1],
      ];
      for (let x = -134; x < 140; x += 11) if (Math.abs(x - JUMP.x) > 13 && Math.abs(x - PASS.x) > 12) { spots.push([x + hash(x) * 4, 15.2 + hash(x * 1.7) * 2.4]); }
      for (let x = -112; x < 98; x += 12) if (Math.abs(x - JUMP.x) > 13 && Math.abs(x - PASS.x) > 12) { spots.push([x + hash(x * 2.3) * 5, 39.5 + hash(x * 3.1) * 8]); }
      const list = [];
      for (const [x, z] of spots) {
        if (roadD(x, z) < 3) continue;
        const s = 0.75 + hash(x * 7 + z) * 0.5, onTable = onN(x, z) || onS(x, z);
        if (!onTable) continue;
        list.push({ x, y: PY, z, ry: hash(x + z * 3) * PI, s, color: [0xffffff, 0xd8f0c0, 0xc8e0a8, 0xf0f0d0][Math.floor(hash(x * 5.3 + z) * 4)] });
        K.circle(x, z, 0.45 * s, 6 * s);
        AO(x, z, 1.8 * s, 1.5 * s, 0.35);
      }
      K.instances(tg, K.std({ vertexColors: true, roughness: 0.85, flatShading: true }), list, { colors: true });
    }

    // ================================================================== loose pieces: the ones that fell out, the pile in the box, the pushable strays
    const atlasTex = tex(atlas);
    const pieceMat = K.std({ map: atlasTex, roughness: 0.6 });
    const pieceGeo = (a, faceDown = false) => {
      const G = a.sec.G, [cx, cz] = cellC(G, a.i, a.j);
      const o = pieceOutline(G, a.i, a.j, 4).map(([x, z]) => V2(x - cx, -(z - cz)));
      const g = new T.ExtrudeGeometry(new T.Shape(o), { depth: PT, bevelEnabled: false });
      g.rotateX(-PI / 2);
      const pos = g.attributes.position, uv = g.attributes.uv, side = g.groups.find((q) => q.materialIndex === 1);
      for (let v = 0; v < pos.count; v++) {
        const isSide = side && v >= side.start && v < side.start + side.count;
        let U, V;
        if (isSide) [U, V] = A.edgeUV;
        else if (pos.getY(v) > PT / 2 && !faceDown) { U = (a.ax + (pos.getX(v) + SLOT / 2) * PPU) / atlas.width; V = 1 - (a.ay + (pos.getZ(v) + SLOT / 2) * PPU) / atlas.height; }
        else [U, V] = A.backUV;
        uv.setXY(v, U, V);
      }
      g.clearGroups();
      return g;
    };
    {
      const staticParts = [];
      const put = (a, x, y, z, o = {}) => staticParts.push(xf(pieceGeo(a, o.down), { x, y, z, ry: o.ry || 0, rx: o.rx || 0, rz: o.rz || 0 }));
      // nudged pieces sit a little askew in their places; popped ones are tented up
      for (const a of atlasCells.filter((q) => q.kind === 'nudge')) put(a, a.cx + (hash(a.slot) - 0.5) * 0.8, TOP + 0.04, a.cz + (hash(a.slot + 3) - 0.5) * 0.8, { ry: (hash(a.slot + 7) - 0.5) * 0.14 });
      // the popped ones were never pressed in: they lie loose on top of their gaps, a little turned and shifted
      atlasCells.filter((q) => q.kind === 'pop').forEach((a, k) => {
        put(a, a.cx + [0.5, -0.4, 0.35][k], PY + 0.06, a.cz + [-0.45, 0.4, 0.55][k], { rx: [0.012, -0.01, 0.014][k], rz: [-0.01, 0.012, 0.008][k], ry: [0.11, -0.09, 0.14][k] });
        AO(a.cx, a.cz, 4.2, 4.2, 0.22, 0, PY + 0.04);
      });
      const loose = atlasCells.filter((q) => q.kind === 'loose' || q.kind === 'hole');
      const R = K.rng(404);
      const scatter = (x0, z0, x1, z1, n, y = TOP, pile = false) => {
        for (let k = 0; k < n; k++) {
          const a = loose[Math.floor(R() * loose.length)];
          const x = lerp(x0, x1, R()), z = lerp(z0, z1, R());
          const yy = pile ? y + R() * 1.6 * (1 - Math.hypot((x - (x0 + x1) / 2) / (x1 - x0), (z - (z0 + z1) / 2) / (z1 - z0)) * 1.6) : y + (R() < 0.2 ? PT : 0);
          put(a, x, Math.max(y, yy), z, { ry: R() * TAU, down: R() < 0.35, rx: pile ? (R() - 0.5) * 0.5 : 0, rz: pile ? (R() - 0.5) * 0.5 : 0 });
        }
      };
      scatter(-148, -93, -112, -64, lowQ ? 6 : 12);
      scatter(-104, -93, -96, -86, 3);
      scatter(98, 84, 136, 93, lowQ ? 5 : 9);
      scatter(130, 3, 148, 18, 4);
      scatter(-137, 44, -126, 60, 4);
      A.boxPile = { x0: -143, z0: -89, x1: -113, z1: -71 };
      scatter(-141, -88, -115, -72, lowQ ? 24 : 48, TOP + 0.8, true);
      const g = BU.mergeGeometries(staticParts.map((q) => q.index ? q.toNonIndexed() : q), false);
      const m = new T.Mesh(g, pieceMat); m.castShadow = true; m.receiveShadow = true; K.group.add(m);
      // rough patch where the pieces have popped up
      const pc = atlasCells.filter((q) => q.kind === 'pop');
      if (pc.length) {
        let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const a of pc) { x0 = Math.min(x0, a.cx - P / 2); x1 = Math.max(x1, a.cx + P / 2); z0 = Math.min(z0, a.cz - P / 2); z1 = Math.max(z1, a.cz + P / 2); }
        K.surface('rough', { poly: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]] });
      }
    }
    // pushable strays on the streets (the missing pieces lie next to their holes)
    {
      const holes = atlasCells.filter((q) => q.kind === 'hole');
      const spots = [];
      for (const [k, h] of A.holes.entries()) {
        const n = track.distTo(h.x, h.z), p = track.place(n.s + 9, Math.sign(n.lateral) * 4.6);
        spots.push([p.x, p.z, holes[k]]);
      }
      for (const [x, z, off] of [[-106, -30, 3.8], [60, 5, -4], [40, -25, -4.2], [140.5, -52, -3.5], [-28, -53, 4]]) { const s = track.distTo(x, z).s, p = track.place(s, off); spots.push([p.x, p.z, atlasCells.filter((q) => q.kind === 'loose')[Math.floor(hash(s) * 9)]]); }
      for (const [x, z, a] of spots) {
        const m = new T.Mesh(pieceGeo(a, false), pieceMat); m.castShadow = true; m.receiveShadow = true;
        m.rotation.y = hash(x + z) * TAU; m.position.set(x, PY, z); K.group.add(m);
        K.physics.addDynamic({ x, z, r: 3.0, m: 0.45, h: 0.5, mesh: m, slide: true, friction: 22, baseY: PY });
      }
    }

    // ================================================================== the coffee: cup and saucer, crema, a spill on the Corniche corner
    {
      const cx = 140.5, cz = -5, y0 = TOP;
      const porcelainV = K.ceramic(0xffffff, { vertexColors: true });
      part(K.lathe([[0, 0], [4.2, 0], [4.6, 0.25], [6.4, 0.55], [6.9, 0.85], [6.7, 0.98], [6.1, 0.72], [4.2, 0.46], [2.8, 0.44], [0, 0.44]], 48), porcelainV, { x: cx, y: y0, z: cz }, 0xfbf8f2);
      part(K.lathe([[0, 0.44], [2.3, 0.44], [2.5, 0.62], [3.3, 2.0], [3.85, 4.2], [4.0, 5.6], [3.8, 5.66], [3.62, 4.2], [3.1, 2.0], [2.3, 0.95], [0, 0.85]], 48), porcelainV, { x: cx, y: y0, z: cz }, 0xfbf8f2);
      part(new T.TorusGeometry(3.98, 0.07, 6, 48), porcelainV, { x: cx, y: y0 + 5.15, z: cz, rx: PI / 2 }, 0x1f4f9a);
      part(new T.TorusGeometry(6.55, 0.06, 6, 48), porcelainV, { x: cx, y: y0 + 0.86, z: cz, rx: PI / 2 }, 0x1f4f9a);
      part(new T.TorusGeometry(1.25, 0.34, 10, 20, PI * 1.25), porcelainV, { x: cx + 4.5, y: y0 + 3.3, z: cz, rz: -PI * 0.62 }, 0xfbf8f2);
      const crema = TX.toTexture(cv(256, 256, (g, w) => {
        const gr = g.createRadialGradient(128, 128, 10, 128, 128, 128); gr.addColorStop(0, '#5a3218'); gr.addColorStop(0.6, '#7a4622'); gr.addColorStop(0.85, '#b07a44'); gr.addColorStop(1, '#8a5a30');
        g.fillStyle = gr; g.fillRect(0, 0, w, w);
        g.strokeStyle = 'rgba(230,200,150,0.55)'; g.lineWidth = 6; g.beginPath(); for (let a = 0; a < 9; a += 0.1) { const rr = 10 + a * 9; g.lineTo(128 + Math.cos(a * 1.4) * rr, 128 + Math.sin(a * 1.4) * rr * 0.9); } g.stroke();
      }), { wrap: false });
      K.mesh(new T.CircleGeometry(3.66, 40), K.liquid(0xffffff, { map: crema, roughness: 0.15 }), cx, y0 + 4.85, cz, { rx: -PI / 2 });
      // teaspoon on the saucer
      const steel = K.metal(0xdde0e4, 0.15);
      const spoon = BU.mergeGeometries([tidy(xf(new T.SphereGeometry(1, 16, 8, 0, TAU, PI / 2, PI / 2), { y: 0.3, sx: 0.9, sy: 0.3, sz: 0.6 }), 0xffffff), tidy(xf(box(4.6, 0.12, 0.36), { x: 2.9, y: 0.36 }), 0xffffff)], false);
      K.mesh(spoon, steel, cx - 2.2, y0 + 0.75, cz + 4.9, { ry: 0.35, rz: 0.06 });
      K.circle(cx, cz, 6.9, 1.0); K.circle(cx, cz, 4.05, 6.2); K.circle(cx + 5.2, cz, 1.3, 4.6);
      AO(cx, cz, 8, 8, 0.5, 0, TOP + 0.03);
      // the spill: on the outside of the corner onto the Corniche, run wide and you skate off the table
      const coffee = K.phys({ color: 0x3a1c0c, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03, transparent: true, opacity: 0.9 });
      const n = track.distTo(134.3, -29.7), q = track.place(n.s + 6, track.w[n.i] / 2 + 1.4);
      const sp1 = K.spill(q.x, q.z, 4.3, coffee, { lump: 0.35, stretch: 1.5, angle: q.angle, y: PY + 0.12, thick: 0.1 });
      K.surface('slick', { poly: sp1.poly });
      const drips = [];
      for (let k = 1; k < 6; k++) { const t = k / 6, dm = K.spill(lerp(q.x, cx, t) + (hash(k) - 0.5), lerp(q.z, cz - 7, t), 0.45 + hash(k * 3) * 0.5, coffee, { y: (t > 0.6 ? TOP : PY) + 0.1, thick: 0.08, n: 16 }).mesh; dm.updateMatrix(); drips.push(dm.geometry.clone().applyMatrix4(dm.matrix)); K.group.remove(dm); dm.geometry.dispose(); }
      { const m = new T.Mesh(BU.mergeGeometries(drips, false), coffee); m.receiveShadow = true; K.group.add(m); }
      // coffee ring stains
      const ringC = cv(128, 128, (g) => { g.strokeStyle = 'rgba(100,55,20,0.5)'; g.lineWidth = 5; g.beginPath(); g.arc(64, 64, 56, 0.4, 5.8); g.stroke(); g.strokeStyle = 'rgba(100,55,20,0.22)'; g.lineWidth = 11; g.beginPath(); g.arc(64, 64, 50, 0.1, 2.6); g.stroke(); });
      const ringMat = K.std({ map: tex(ringC), transparent: true, depthWrite: false, roughness: 0.9 });
      K.mesh(BU.mergeGeometries([xf(new T.PlaneGeometry(8.2, 8.2), { rx: -PI / 2, x: 118, z: 10 }), xf(new T.PlaneGeometry(8.2, 8.2), { rx: -PI / 2, x: -122, z: -52, ry: 1.3 })], false), ringMat, 0, PY + 0.02, 0, { cast: false });
      A.steam = { x: cx, y: y0 + 5.4, z: cz };
    }

    // ================================================================== the open box, its lid with the picture, reading glasses, a note
    {
      const bx = -128, bz = -80, ry = 0.1, L = 33, D = 21, H = 5.2, t = 0.45;
      const boxMat = K.std({ map: faTex, roughness: 0.55, vertexColors: true });
      const grp = [];
      const cs = Math.cos(ry), sn = Math.sin(ry), at = (lx, lz) => [bx + lx * cs + lz * sn, bz - lx * sn + lz * cs];
      for (const [lx, lz, w, d, face] of [[0, D / 2 - t / 2, L, t, 'pz'], [0, -D / 2 + t / 2, L, t, 'nz'], [L / 2 - t / 2, 0, t, D - 2 * t, 'px'], [-L / 2 + t / 2, 0, t, D - 2 * t, 'nx']]) {
        const [x, z] = at(lx, lz);
        part(xf(fBox(w, H, d, { [face]: 'boxSide' }, 'boxIn'), { ry }), boxMat, { x, y: TOP + H / 2, z });
        grp.push([x, z]);
      }
      part(fBox(L, 0.3, D, {}, 'boxIn'), boxMat, { x: bx, y: TOP + 0.15, z: bz, ry });
      K.box(bx, bz, L / 2, D / 2, -ry, H + 0.4);
      AO(bx, bz, L / 2 + 2, D / 2 + 2, 0.5, -ry, TOP + 0.03);
      // the lid, picture up, on the south table
      const lx = 119, lz = 71, lr = -0.07, LW = 34, LD = 23.2, LH = 3.0;
      const lidTex = tex(lidPic);
      const lg = new T.BoxGeometry(LW, LH, LD), uv = lg.attributes.uv;
      for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const vi = f * 4 + k; if (f === 2) continue; uv.setXY(vi, 0.5, 4 / 720); }
      K.mesh(lg, K.phys({ map: lidTex, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.3 }), lx, TOP + LH / 2, lz, { ry: lr });
      K.box(lx, lz, LW / 2, LD / 2, -lr, LH + 0.3);
      AO(lx, lz, LW / 2 + 2, LD / 2 + 2, 0.5, -lr, TOP + 0.03);
      // reading glasses resting on the lid
      const tort = TX.toTexture(cv(128, 64, (g, w, h) => { g.fillStyle = '#6a3a1c'; g.fillRect(0, 0, w, h); for (let n = 0; n < 60; n++) { g.fillStyle = `rgba(${hash(n) < 0.5 ? '30,14,6' : '200,130,60'},0.5)`; g.beginPath(); g.ellipse(hash(n * 1.3) * w, hash(n * 2.1) * h, 3 + hash(n * 4) * 6, 2 + hash(n * 5) * 3, hash(n) * 3, 0, TAU); g.fill(); } }));
      const frame = K.phys({ map: tort, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 });
      const fr = [], ln = [];
      for (const s of [-1, 1]) {
        fr.push(tidy(xf(new T.TorusGeometry(2.05, 0.2, 8, 32), { rx: PI / 2, sx: 1.12, x: s * 2.55, y: 0.22 }), 0xffffff));
        ln.push(tidy(xf(new T.CircleGeometry(2.0, 32), { rx: -PI / 2, sx: 1.12, x: s * 2.55, y: 0.24 }), 0xffffff));
        fr.push(tidy(xf(box(0.22, 0.2, 9.2), { x: s * 2.1, y: 0.62, z: -3.6, ry: -s * 1.32, rz: s * 0.06 }), 0xffffff));
      }
      fr.push(tidy(xf(new T.TorusGeometry(0.42, 0.13, 6, 12, PI), { y: 0.32, z: -0.3 }), 0xffffff));
      K.mesh(BU.mergeGeometries(fr, false), frame, lx - 6, TOP + LH, lz + 1.5, { ry: 0.35 });
      K.mesh(BU.mergeGeometries(ln, false), K.glass(0xeaf2ff, 0.2), lx - 6, TOP + LH, lz + 1.5, { ry: 0.35, cast: false });
      // sticky note on the south table's west end (the pencil lies by the Gare chicane)
      K.mesh(remap(new T.PlaneGeometry(7.4, 7.4), 'note'), popMat, -130.5, TOP + 0.04, 70, { rx: -PI / 2, cast: false }).geometry.setAttribute('color', new T.BufferAttribute(new Float32Array(12).fill(1), 3));
    }

    // ================================================================== life: paper people on the squares and pavements, café parasols, fine scatter
    {
      const R = K.rng(808);
      const blocked = (x, z, m) => {
        for (const c of K.physics.colliders) { if (c.bb && (x < c.bb[0] - m || x > c.bb[2] + m || z < c.bb[1] - m || z > c.bb[3] + m)) continue; if (K.physics.circleVsCollider(x, z, m, c)) return true; }
        return false;
      };
      const people = [], heads = [], pts = [];
      const add = (x, z, solid = true) => {
        if (roadD(x, z) < 0.9 || !(onN(x, z) || onS(x, z)) || blocked(x, z, 0.9) || pts.some(([a, b]) => Math.hypot(a - x, b - z) < 1.2) || A.holes.some((h) => Math.hypot(h.x - x, h.z - z) < 5.5)) return false;
        const s = 0.85 + R() * 0.3;
        pts.push([x, z]);
        people.push({ x, y: PY, z, s, ry: R() * TAU, color: [0xc83c34, 0x2f5f9e, 0x3a8a4a, 0xe0b23a, 0x6a4a8a, 0x2a2a2a, 0xe8e2d4, 0xd87a3a][Math.floor(R() * 8)] });
        heads.push({ x, y: PY + 1.62 * s, z, s, color: [0xe8b894, 0xc89070, 0x8a5a3c, 0xf0c8a8][Math.floor(R() * 4)] });
        if (solid) K.circle(x, z, 0.4 * s, 2.1 * s); // people on the pavements don't snag a car that runs wide
        return true;
      };
      const fill = (q, n) => { for (let k = 0, tries = 0; k < n && tries < n * 20; tries++) if (add(lerp(q[0] + 1.2, q[2] - 1.2, R()), lerp(q[1] + 1.2, q[3] - 1.2, R()))) k++; };
      fill(SQ.knuedler, lowQ ? 10 : 18); fill(SQ.constitution, 8); fill(SQ.armes, 8); fill(SQ.clairefontaine, 5); fill(SQ.esprit, 5);
      for (let k = 0, tries = 0; k < (lowQ ? 18 : 30) && tries < 400; tries++) {
        const s = R() * track.length, p = track.at(s), side = R() < 0.5 ? -1 : 1, q = track.place(s, side * (p.w / 2 + 1.8 + R() * 0.7));
        if (add(q.x, q.z, false)) k++;
      }
      const bodyGeo = new T.CapsuleGeometry(0.3, 0.75, 3, 8).translate(0, 0.68, 0);
      K.instances(bodyGeo, K.std({ roughness: 0.8 }), people, { colors: true });
      K.instances(new T.SphereGeometry(0.25, 8, 6), K.std({ roughness: 0.7 }), heads, { colors: true });
      // café terrace on the Constitution and in the Place d'Armes
      const tops = [], poles = [];
      const cols = [0xf4efe4, 0xc8382c, 0x2f7d4a, 0xf4efe4, 0x2d5f9e];
      const parasol = (x, z, k) => { if (blocked(x, z, 1.7) || roadD(x, z) < 2) return; tops.push({ x, y: PY + 2.7, z, ry: k, color: cols[k % cols.length] }); poles.push({ x, y: PY + 1.35, z }); K.circle(x, z, 0.3, 2.6); AO(x, z, 1.4, 1.4, 0.25); };
      [[-93, -0.5], [-88, 0.4], [-71, -0.5], [-66, 0.4], [-59, -76], [-52, -80], [-42, -77], [-36, -81], [83, -40], [78, -44]].forEach(([x, z], k) => parasol(x, z, k));
      K.instances(new T.ConeGeometry(1.55, 0.6, 8), K.std({ roughness: 0.75 }), tops, { colors: true });
      K.instances(cyl(0.06, 0.06, 2.7, 5), K.std({ color: 0x3a3430, roughness: 0.5, metalness: 0.5 }), poles);
      // fine scatter: cardboard flecks and puzzle dust near the unfinished edges, biscuit crumbs by the cup
      const flecks = [];
      const spray = (cx, cz, sx, sz, n, y, cols2) => { for (let k = 0; k < n; k++) flecks.push({ x: cx + R.gauss() * sx, y, z: cz + R.gauss() * sz, ry: R() * TAU, rx: R() * 0.3, s: 0.12 + R() * 0.25, color: cols2[Math.floor(R() * cols2.length)] }); };
      spray(-122, -72, 14, 9, 60, TOP + 0.04, [0x9aa3a8, 0xb9ab92, 0xd8ccb0]);
      spray(112, 86, 12, 4, 30, TOP + 0.04, [0x9aa3a8, 0xb9ab92]);
      spray(134, 8, 5, 5, 26, TOP + 0.05, [0xc98a45, 0xe0b071, 0xa8692e]);
      spray(-20, 21.6, 70, 0.6, lowQ ? 20 : 40, TOP + 0.04, [0x9aa3a8, 0xb9ab92, 0x7f9e55]); spray(-20, 34.4, 70, 0.6, lowQ ? 20 : 40, TOP + 0.04, [0x9aa3a8, 0xb9ab92, 0x7f9e55]);
      K.instances(new T.DodecahedronGeometry(1, 0), K.std({ roughness: 0.9 }), flecks.filter((f) => onN(f.x, f.z) || onS(f.x, f.z)), { colors: true, cast: false });
    }

    // ================================================================== hazards: missing pieces (holes), the valley gap
    // the drop zone sits a little towards the kerb and inside the painted pit: a car only falls in once its middle is over the hole
    for (const h of A.holes) { const n = track.distTo(h.x, h.z), q = track.place(n.s, n.lateral + Math.sign(n.lateral) * 0.5); K.hole(q.x, q.z, 2.6); h.s = n.s; }
    A.L = track.length;
    {
      // the gap between the tables: a row of open trapdoors, except under the Passerelle deck
      const z = (TN.z1 + TS.z0) / 2, hd = (TS.z0 - TN.z1) / 2;
      const spans = [[TS.x0, PASS.x - PASS.hw - 0.6], [PASS.x + PASS.hw + 0.6, TS.x1]];
      for (const [a, b] of spans) { const n = Math.ceil((b - a) / 12); for (let k = 0; k < n; k++) { const x0 = a + (b - a) * k / n, x1 = a + (b - a) * (k + 1) / n; K.trapdoor((x0 + x1) / 2, z, (x1 - x0) / 2, hd, 0, true); } }
    }

    flush();
    flushAO();
  },

  tick(dt, time, game) {
    // a car that drops into the valley under the Adolphe Bridge restarts with a run-up, not on the ramp lip;
    // one that drops into a missing piece restarts well before it (never beside the hole, where it would drop again)
    if (!A || !A.jumpRespawnS) return;
    for (const e of game.cars) {
      const c = e.car;
      if (c.state !== 'falling' || c.fallKind !== 'hole') continue;
      if (c.z > A.gapZ[0] - 1 && c.z < A.gapZ[1] + 1 && Math.abs(c.x - JUMP.x) < 16) { e.lastGoodS = A.jumpRespawnS; continue; }
      for (const h of A.holes) if (Math.abs(c.x - h.x) < 6 && Math.abs(c.z - h.z) < 6) e.lastGoodS = (h.s - 13 + A.L) % A.L;
    }
  },

  animate(time) {
    if (!A) return;
    if (A.fountain) { A.fountain.scale.set(1 + Math.sin(time * 7) * 0.04, 1 + Math.sin(time * 9.3) * 0.07, 1 + Math.cos(time * 7) * 0.04); A.fountain.rotation.y = time * 0.8; }
    for (const f of A.flags) {
      const p = f.m.geometry.attributes.position, b = f.base;
      for (let i = 0; i < p.count; i++) { const x = b[i * 3]; p.setZ(i, Math.sin(x * 1.7 - time * 6 + f.ph) * 0.16 * x); }
      p.needsUpdate = true;
    }
  },
};

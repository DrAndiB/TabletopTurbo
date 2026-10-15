// Crémant Curves: the first table of the Grand Duchy Cup. A Moselle wine tasting laid out on a long oak garden
// table late on a sunny afternoon. Toy 4x4 trucks follow a printed vineyard path along "the Moselle" (a blue satin
// runner with a little excursion boat cruising up and down under a stone bridge), through a white wine village with
// slate roofs and a church, up two stacked serving boards dressed as vineyard terraces (small jump off the top),
// past crémant flutes, an ice bucket, a decanter and an aroma wheel, a Riesling pie, a cheese board with a dripping
// honey pot and a knocked-over glass of red. The infields of the two tight turns are blocked (a seagrass mat that
// drags in the loop, a fenced vine plot in the hairpin), so no corner is worth cutting.

import * as THREE from '../../vendor/three.bundle.js';

const TRACK = [
  [-105, 46], [-25, 48], [50, 45], [94, 38], [124, 18], [139, -12], [133, -40], [112, -57], [75, -61], [40, -61],
  [6, -60], [-16, -57], [-39, -34], [-42, -16], [-47.3, 0.5], [-61.3, 10.6], [-78.7, 10.6], [-92.7, 0.5], [-98, -16],
  [-98, -42], [-105.9, -61.1], [-125, -69], [-144.1, -61.1], [-152, -42], [-150, 4], [-132, 36],
];
const W = 15;
const START_S = 40;
const TB = { x0: -170, x1: 170, z0: -94, z1: 96 }; // table top
const RW = 21; // runner (river) width
const riverZ = (x) => 72 + 2.4 * Math.sin(x / 26 + 0.8) + 1.6 * Math.sin(x / 53 - 0.4);
const riverDZ = (x) => (2.4 / 26) * Math.cos(x / 26 + 0.8) + (1.6 / 53) * Math.cos(x / 53 - 0.4);
const BOAT = { x0: -134, x1: 134, v: 5.5, turn: 8, lane: -0.8, off: 9 };
const BRIDGE_X = 42;
const TERR = { x: 88, z: -61 }; // foot of the terrace climb (heading west)
const LOOP_MAT = { x: -70, z: -19, r: 16.5, t: 0.22 }; // round seagrass mat filling the loop (slow: no cutting across)

let A = null; // runtime state for animate

// The excursion boat cruises the river: along the lane, a slow pivot turn at each end, back again. Pure function of t.
function boatPose(t) {
  const span = BOAT.x1 - BOAT.x0, T1 = span / BOAT.v, T2 = BOAT.turn, P = 2 * (T1 + T2);
  const u = (((t + BOAT.off) % P) + P) % P;
  const a = 0.07;
  const prof = (f) => (f < a ? (f * f) / (2 * a * (1 - a)) : f > 1 - a ? 1 - ((1 - f) * (1 - f)) / (2 * a * (1 - a)) : (f - a / 2) / (1 - a));
  const ease = (f) => f * f * (3 - 2 * f);
  let x, dir, spin = 0, turn = -1;
  if (u < T1) { x = BOAT.x0 + span * prof(u / T1); dir = 1; }
  else if (u < T1 + T2) { x = BOAT.x1; dir = 1; spin = ease((u - T1) / T2); turn = 0; }
  else if (u < 2 * T1 + T2) { x = BOAT.x1 - span * prof((u - T1 - T2) / T1); dir = -1; }
  else { x = BOAT.x0; dir = -1; spin = ease((u - 2 * T1 - T2) / T2); turn = 1; }
  const dz = riverDZ(x);
  const head = dir > 0 ? Math.atan2(dz, 1) : Math.atan2(-dz, -1);
  const drift = Math.sin(spin * Math.PI) * 1.4;
  return { x, z: riverZ(x) + BOAT.lane + drift, angle: head + spin * Math.PI, turn };
}

export default {
  id: 'moselle',
  name: 'Crémant Curves',
  blurb: 'A Moselle wine tasting: vineyard terraces, a satin river with a riverboat and crémant.',
  vehicle: 'truck',
  seed: 21,
  track: { points: TRACK, width: W, startS: START_S },
  bounds: { minX: TB.x0, maxX: TB.x1, minZ: TB.z0, maxZ: TB.z1 },
  fallOffEdges: true,
  floorY: -76,
  offCourse: 16,
  skidColor: 0x3a2a1c,
  dustColor: 0xe6dcc6,
  dust: {
    normal: null,
    slick: { color: 0x7a0c22, size: 0.6, life: 0.45, up: 2.5, grav: 25, alpha: 0.9, grow: 1, rate: 2 },
    sticky: { color: 0xd48a12, size: 0.7, life: 0.45, up: 1, grav: 10, alpha: 0.9, grow: 1 },
    slow: { color: 0xa9c6f2, size: 0.5, life: 0.4, up: 1.2, grav: 6, alpha: 0.35, grow: 1.4, rate: 0.6 },
  },
  lighting: {
    sunDir: [-0.74, 0.52, -0.3], sunColor: 0xffcb8e, sunIntensity: 3.0,
    hemiSky: 0xc6dbf6, hemiGround: 0x8a6442, hemiIntensity: 0.58,
    envIntensity: 0.45, exposure: 1.0, background: 0xcdb791, shadowRadius: 2.4,
    fog: { color: 0xd8c39d, near: 230, far: 700 },
  },

  async build(K) {
    const { THREE: T, TX, r, track } = K;
    const PI = Math.PI, TAU = PI * 2;
    const V2 = (a, b = a) => new T.Vector2(a, b);
    const t0 = performance.now();
    A = { keep: [], bubbles: null, boat: null, lastTurn: -1 };
    const keep = A.keep;
    const warnRoad = (what, x, z, m = 0.5) => { if (!K.offRoad(x, z, m)) console.warn(`moselle: ${what} on road at ${x.toFixed(1)},${z.toFixed(1)}`); };
    const canvas = (w, h, fn) => { const c = TX.makeCanvas(w, h); fn(c.getContext('2d'), w, h); return c; };
    const tex = (c, o = {}) => TX.toTexture(c, { wrap: false, ...o });
    const gY = (x, z) => K.physics.groundAt(x, z).g;
    const sAt = (x, z) => track.distTo(x, z).s;
    const local = (cx, cz, a, along, side) => [cx + Math.cos(a) * along - Math.sin(a) * side, cz + Math.sin(a) * along + Math.cos(a) * side];
    const part = (grp, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); grp.add(m); return m; };
    const cellOf = (x, z) => Math.min(3, Math.max(0, Math.floor((x - TB.x0) / 85))) + (z < 0 ? 0 : 4);
    // instanced meshes split into table cells so off-screen parts are culled
    const inst = (geo, mat, list, opts = {}) => {
      if (list.length < 200) return [K.instances(geo, mat, list, opts)];
      const groups = new Map();
      for (const it of list) { const k = cellOf(it.x, it.z); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(it); }
      const out = [];
      for (const l of groups.values()) out.push(K.instances(geo, mat, l, opts));
      return out;
    };
    // bake many small transformed copies into one static mesh per table cell (vertex colours carry the variety)
    const bakeGeo = (geo, list, defColor = 0xffffff) => {
      const src = geo.index ? geo.toNonIndexed() : geo;
      const P = src.attributes.position.array, Nn = src.attributes.normal.array, U = src.attributes.uv ? src.attributes.uv.array : null, n = src.attributes.position.count;
      const tot = n * list.length, pos = new Float32Array(tot * 3), nor = new Float32Array(tot * 3), uv = new Float32Array(tot * 2), col = new Float32Array(tot * 3);
      const m4 = new T.Matrix4(), nm = new T.Matrix3(), q = new T.Quaternion(), e = new T.Euler(), pv = new T.Vector3(), sv = new T.Vector3(), c = new T.Color(), me = m4.elements, ne = nm.elements;
      list.forEach((t, k) => {
        e.set(t.rx || 0, t.ry || 0, t.rz || 0, 'YXZ'); q.setFromEuler(e); pv.set(t.x, t.y || 0, t.z); sv.set(t.sx ?? t.s ?? 1, t.sy ?? t.s ?? 1, t.sz ?? t.s ?? 1);
        m4.compose(pv, q, sv); nm.getNormalMatrix(m4); c.set(t.color ?? defColor);
        for (let i = 0; i < n; i++) {
          const o = k * n + i, x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
          pos[o * 3] = me[0] * x + me[4] * y + me[8] * z + me[12]; pos[o * 3 + 1] = me[1] * x + me[5] * y + me[9] * z + me[13]; pos[o * 3 + 2] = me[2] * x + me[6] * y + me[10] * z + me[14];
          const a = Nn[i * 3], b = Nn[i * 3 + 1], d = Nn[i * 3 + 2];
          let nx = ne[0] * a + ne[3] * b + ne[6] * d, ny = ne[1] * a + ne[4] * b + ne[7] * d, nz = ne[2] * a + ne[5] * b + ne[8] * d;
          const l = Math.hypot(nx, ny, nz) || 1; nor[o * 3] = nx / l; nor[o * 3 + 1] = ny / l; nor[o * 3 + 2] = nz / l;
          if (U) { uv[o * 2] = U[i * 2]; uv[o * 2 + 1] = U[i * 2 + 1]; }
          col[o * 3] = c.r; col[o * 3 + 1] = c.g; col[o * 3 + 2] = c.b;
        }
      });
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('normal', new T.BufferAttribute(nor, 3));
      g.setAttribute('uv', new T.BufferAttribute(uv, 2)); g.setAttribute('color', new T.BufferAttribute(col, 3));
      return g;
    };
    // static shadow casters are folded into one invisible proxy per cell (the shadow pass costs one draw per cell)
    const shadowGeos = new Map();
    const toShadow = (g, cell) => {
      const src = g.index ? g.toNonIndexed() : g, sg = new T.BufferGeometry();
      sg.setAttribute('position', new T.BufferAttribute(src.attributes.position.array.slice(), 3));
      if (!shadowGeos.has(cell)) shadowGeos.set(cell, []);
      shadowGeos.get(cell).push(sg);
    };
    const flushShadows = () => {
      const mat = new T.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: T.DoubleSide });
      for (const geos of shadowGeos.values()) {
        const g = geos.length > 1 ? K.BufferGeometryUtils.mergeGeometries(geos, false) : geos[0];
        g.computeBoundingSphere();
        const m = new T.Mesh(g, mat); m.castShadow = true; m.receiveShadow = false; K.group.add(m); keep.push(m);
      }
    };
    const bakeCells = (parts, mat, { cast = true } = {}) => {
      const cells = new Map();
      for (const [geo, list, defColor] of parts) {
        const by = new Map();
        for (const it of list) { const k = cellOf(it.x, it.z); if (!by.has(k)) by.set(k, []); by.get(k).push(it); }
        for (const [k, l] of by) { if (!cells.has(k)) cells.set(k, []); cells.get(k).push(bakeGeo(geo, l, defColor)); }
      }
      for (const [cell, geos] of cells) {
        const g = geos.length > 1 ? K.BufferGeometryUtils.mergeGeometries(geos, false) : geos[0];
        g.computeBoundingSphere();
        const m = new T.Mesh(g, mat); m.castShadow = false; m.receiveShadow = true; K.group.add(m); keep.push(m);
        if (cast) toShadow(g, cell);
      }
    };
    // rows of rectangles that tile horizontally (flagstones, ashlar)
    const rowsTile = (g, w, h, rowH, minW, maxW, rr, fill, gap = 2) => {
      for (let y = 0; y < h; y += rowH) {
        const x0 = -rr() * maxW;
        let x = x0;
        while (x < x0 + w - 1) {
          let bw = minW + rr() * (maxW - minW);
          if (x + bw > x0 + w - minW * 0.6) bw = x0 + w - x;
          g.fillStyle = fill(rr);
          for (const ox of [0, w]) g.fillRect(x + ox + gap / 2, y + gap / 2, bw - gap, rowH - gap);
          x += bw;
        }
      }
    };
    const speckle = (g, w, h, rr, n, a0 = 0.03, a1 = 0.06, sz = 4) => {
      for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${rr() < 0.5 ? '0,0,0' : '255,255,255'},${a0 + rr() * a1})`; g.fillRect(rr() * w, rr() * h, 1 + rr() * sz, 1 + rr() * sz); }
    };

    // ============================================================================ batched contact shadows
    const contacts = [];
    const AO = (x, z, rx, rz = rx, op = 0.4, ang = 0, y = null) => contacts.push({ x, y: (y ?? gY(x, z)) + 0.05, z, ry: -ang, sx: rx * 2, sy: op, sz: rz * 2 });
    const flushAO = () => {
      const g = new T.PlaneGeometry(1, 1); g.rotateX(-PI / 2);
      const mat = new T.MeshBasicMaterial({ color: 0x0c0703, transparent: true, alphaMap: TX.blobShadowTexture(), depthWrite: false });
      mat.onBeforeCompile = (sh) => {
        sh.vertexShader = 'varying float vOp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\nvOp = length(instanceMatrix[1].xyz);\n#endif');
        sh.fragmentShader = 'varying float vOp;\n' + sh.fragmentShader.replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\ndiffuseColor.a *= vOp;');
      };
      const im = K.instances(g, mat, contacts, { cast: false, receive: false });
      im.renderOrder = 1;
    };

    // ============================================================================ table, floor
    {
      const oak = TX.woodTextures({ size: 1024, seed: 21, planks: 4, base: 0xbd9265, dark: 0x7a5434, light: 0xe0bb8c, ringFreq: 15, gap: 0.0045, roughBase: 0.62 });
      for (const t of Object.values(oak)) { t.repeat.set(340 / 64, 190 / 64); t.rotation = PI / 2; t.center.set(0.5, 0.5); }
      const tableMat = K.std({ map: oak.map, normalMap: oak.normalMap, roughnessMap: oak.roughnessMap, normalScale: V2(0.7) });
      K.mesh(new T.BoxGeometry(340, 4, 190), tableMat, 0, -2, 1, { cast: false });
      const legMat = K.std({ map: oak.map, color: 0xc89868, roughness: 0.62 });
      K.mesh(new T.BoxGeometry(326, 8, 176), legMat, 0, -8, 1, { cast: false });
      for (const [x, z] of [[-156, -82], [156, -82], [-156, 84], [156, 84]]) K.mesh(new T.BoxGeometry(9, 72, 9), legMat, x, -40, z, { cast: false });
      // sandstone terrace flags far below
      const floorC = canvas(512, 512, (g, w, h) => {
        const rr = K.rng(5);
        g.fillStyle = '#5e5245'; g.fillRect(0, 0, w, h);
        rowsTile(g, w, h, 64, 60, 130, rr, (q) => { const k = 0.82 + q() * 0.3; return `rgb(${(198 * k) | 0},${(178 * k) | 0},${(146 * k) | 0})`; }, 4);
        speckle(g, w, h, rr, 2500, 0.04, 0.07, 3);
      });
      K.mesh(new T.PlaneGeometry(1600, 1600), K.std({ map: TX.toTexture(floorC, { repeat: [14, 14] }), roughness: 0.9 }), 0, -76, 0, { rx: -PI / 2, cast: false });
    }

    // ============================================================================ shared materials
    const ivory = K.ceramic(0xf6f2e8);
    const steel = K.metal(0xd6d9de, 0.22);
    const gold = K.metal(0xd8b25e, 0.28);
    const darkWood = K.std({ color: 0x5a3b24, roughness: 0.7 });
    const postWood = K.std({ color: 0x6d5a47, roughness: 0.85 });
    const glassMat = K.glass(0xffffff, 0.1, { side: T.FrontSide, envMapIntensity: 1.1 });
    const stoneT = TX.mottledTextures({ size: 128, a: 0xf3eee4, b: 0xcfc6b5, seed: 17, period: 16, bump: 4 });
    const stoneMat = K.std({ map: stoneT.map, normalMap: stoneT.normalMap, roughness: 0.86, vertexColors: true });
    const stoneGeo = new T.IcosahedronGeometry(1, 0);
    const allStones = [];
    const corkT = TX.mottledTextures({ size: 256, a: 0xcf9f66, b: 0xab7741, c: 0x734b26, seed: 61, period: 22, speck: 0.4, bump: 7 });
    const corkMat = K.std({ map: corkT.map, normalMap: corkT.normalMap, normalScale: V2(1.2), roughness: 0.92 });
    const wineMat = K.phys({ color: 0x5c0918, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, opacity: 0.93 });
    const honeyMat = K.phys({ color: 0xd9900f, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, opacity: 0.92 });

    // ============================================================================ terraces: stacked serving boards (physics first: the path follows them)
    const TR = (() => {
      const s0 = sAt(TERR.x, TERR.z);
      const p0 = track.at(s0), p1 = track.at(s0 + 66);
      const a = Math.atan2(p1.z - p0.z, p1.x - p0.x);
      return { s0, a, at: (d, side = 0) => local(p0.x, p0.z, a, d, side) };
    })();
    {
      const { a, at } = TR;
      let [x, z] = at(5); K.ramp(x, z, a, 10, 22.6, 1.6, 0);
      [x, z] = at(38); K.platform(x, z, 28, 22, a, 1.6);
      [x, z] = at(37); K.ramp(x, z, a, 10, 22.6, 1.6, 1.6);
      [x, z] = at(54); K.platform(x, z, 12, 14, a, 3.2);
      [x, z] = at(63); K.ramp(x, z, a, 6, 22.6, 0.9, 3.2);
      // the vine rows beside the path double as rails that keep trucks on the terraces
      for (const sd of [-1, 1]) { const [x1, z1] = at(11, sd * 11.5), [x2, z2] = at(64, sd * 11.5); K.capsule(x1, z1, x2, z2, 0.75, 6.6); }
      for (let d = 0; d <= 66; d += 6) { const [px, pz] = at(d); const n = track.nearest(px, pz); if (n.dist > 1.5) console.warn('moselle: terrace off the path line', d, n.dist.toFixed(2)); }
    }

    // ============================================================================ the printed vineyard path (follows boards and ramps)
    {
      const roadC = canvas(256, 512, (g, w, h) => {
        const rr = K.rng(9);
        g.fillStyle = '#f0e8d6'; g.fillRect(0, 0, w, h); // paper margin
        g.fillStyle = '#d8c7a4'; g.fillRect(9, 0, w - 18, h); // gravel
        for (let i = 0; i < 320; i++) {
          const x = 9 + rr() * (w - 18), y = rr() * h, l = 10 + rr() * 40;
          g.fillStyle = `rgba(${rr() < 0.5 ? '120,95,60' : '250,240,220'},${0.07 + rr() * 0.09})`;
          for (const oy of [0, -h]) g.fillRect(x, y + oy, 1 + rr() * 1.5, l);
        }
        for (const cx of [0.32, 0.68]) {
          const gr = g.createLinearGradient((cx - 0.08) * w, 0, (cx + 0.08) * w, 0);
          gr.addColorStop(0, 'rgba(140,110,72,0)'); gr.addColorStop(0.5, 'rgba(140,110,72,0.2)'); gr.addColorStop(1, 'rgba(140,110,72,0)');
          g.fillStyle = gr; g.fillRect((cx - 0.08) * w, 0, 0.16 * w, h);
        }
        for (let i = 0; i < 1100; i++) {
          const x = 12 + rr() * (w - 24), y = rr() * h, rad = 0.8 + rr() * rr() * 3.4, k = rr();
          const col = k < 0.45 ? '238,230,212' : k < 0.75 ? '178,158,126' : k < 0.9 ? '142,130,120' : '206,170,118';
          g.fillStyle = `rgb(${col})`;
          const ry = 0.6 + rr() * 0.4, rot = rr() * 3;
          for (const oy of [0, -h, h]) { g.beginPath(); g.ellipse(x, y + oy, rad, rad * ry, rot, 0, TAU); g.fill(); }
        }
        for (const [a0, b0] of [[9, 21], [w - 21, w - 9]]) {
          g.fillStyle = 'rgba(108,134,64,0.9)'; g.fillRect(a0, 0, b0 - a0, h);
          for (let i = 0; i < 260; i++) { const x = a0 + rr() * (b0 - a0), y = rr() * h, l = 3 + rr() * 5; g.fillStyle = rr() < 0.5 ? '#56732f' : '#9cb25f'; for (const oy of [0, -h]) g.fillRect(x, y + oy, 1.5, l); }
        }
        g.fillStyle = '#6f5236'; g.fillRect(7, 0, 2, h); g.fillRect(w - 9, 0, 2, h);
      });
      const roadN = TX.toTexture(TX.normalFromHeight(TX.heightFromCanvasLuma(roadC), 256, 512, 1.6), { srgb: false });
      const roadMat = K.std({ map: TX.toTexture(roadC), normalMap: roadN, normalScale: V2(0.55), roughness: 0.86 });
      // ribbon like track.ribbonGeometry, but its height follows the ground and it breaks where the ground drops away
      const N = track.N, step = 2, rows = Math.ceil(N / step), vScale = 24;
      const pos = [], uv = [], idx = [];
      let prev = -1, prevY = 0, prevRamp = false;
      for (let rI = 0; rI <= rows; rI++) {
        const i = (rI * step) % N, s = rI * step * track.ds, w = track.w[i];
        const nx = -track.tz[i], nz = track.tx[i];
        const start = pos.length / 3;
        let ys = 0;
        for (let c = 0; c <= 1; c++) {
          const off = (c - 0.5) * w, x = track.x[i] + nx * off, z = track.z[i] + nz * off, y = gY(x, z) + 0.04;
          pos.push(x, y, z); uv.push(c, s / vScale); ys += y / 2;
        }
        const onRamp = !!K.physics.groundAt(track.x[i], track.z[i]).ramp;
        if (prev >= 0 && !onRamp && !prevRamp && Math.abs(ys - prevY) < 0.7) idx.push(prev, prev + 1, start, prev + 1, start + 1, start);
        prevRamp = onRamp;
        prev = start; prevY = ys;
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals();
      const nrm = g.attributes.normal;
      for (let i = 0; i < nrm.count; i++) if (nrm.getY(i) < 0) nrm.setXYZ(i, -nrm.getX(i), -nrm.getY(i), -nrm.getZ(i));
      const m = new T.Mesh(g, roadMat); m.receiveShadow = true; K.group.add(m);
      keep.push(m);

      // limestone pebbles along both edges
      const stones = [];
      const cols = [0xffffff, 0xf4efe6, 0xe9e2d4, 0xd8d2c8, 0xc9c3bc, 0xe6d3b2, 0xb9bec4];
      for (const side of [-1, 1]) for (const p of track.edgePoints(side, 2.2, 0.85)) {
        const j = r.range(-0.3, 0.3) * side, x = p.x - Math.sin(p.angle) * j, z = p.z + Math.cos(p.angle) * j, s = r.range(0.75, 1.05);
        stones.push({ x, y: gY(x, z) + 0.28 * s, z, rx: r() * 6, ry: r() * 6, rz: r() * 6, sx: 0.85 * s, sy: 0.55 * s, sz: 0.75 * s, color: r.pick(cols) });
      }
      allStones.push(...stones);

      // start / finish: a chequered band printed across the path
      const chk = canvas(256, 64, (gg) => { for (let y = 0; y < 4; y++) for (let x = 0; x < 16; x++) { gg.fillStyle = (x + y) % 2 ? '#1d1a17' : '#f6f1e4'; gg.fillRect(x * 16, y * 16, 16, 16); } });
      const p = track.at(START_S);
      const sm = K.mesh(new T.PlaneGeometry(15, 3.4), K.std({ map: tex(chk), roughness: 0.8 }), p.x, 0.07, p.z, { cast: false });
      sm.rotation.order = 'YXZ'; sm.rotation.y = -p.angle + PI / 2; sm.rotation.x = -PI / 2;
    }

    // ============================================================================ vine rows (model vineyard: trunks, trellis posts, wires, foliage, grapes)
    const VL = { trunks: [], posts: [], leaves: [], bunches: [], wires: [], litter: [] };
    const leafCols = [0x5d8a2e, 0x6a9632, 0x77a03a, 0x58822c, 0x86a43c, 0x9aa840, 0xb8a83e, 0xc08a3a];
    const vineRow = (pts, { red = false, wires = true, step = 1.35, collide = false } = {}) => {
      const seg = []; let tot = 0;
      for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); tot += l; }
      if (tot < 2) return;
      if (collide) for (let i = 1; i < pts.length; i++) K.capsule(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], 0.6, gY(pts[i][0], pts[i][1]) + 3.3);
      const pAt = (d) => { let i = 0; while (i < seg.length - 1 && d > seg[i]) { d -= seg[i]; i++; } const f = Math.min(1, d / (seg[i] || 1)); const a = pts[i], b = pts[i + 1]; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, Math.atan2(b[1] - a[1], b[0] - a[0])]; };
      const n = Math.max(2, Math.round(tot / step));
      const postEvery = 4;
      let lastPost = null;
      for (let k = 0; k <= n; k++) {
        const [x, z, ang] = pAt((k / n) * tot), y0 = gY(x, z);
        const ca = Math.cos(ang), sa = Math.sin(ang);
        if (k % postEvery === 0 || k === n) {
          const end = k === 0 || k === n;
          VL.posts.push({ x, y: y0 + 1.6, z, ry: -ang, rz: end ? (k === 0 ? -0.12 : 0.12) : r.range(-0.03, 0.03), sy: end ? 1.05 : 1, sx: end ? 1.3 : 1, sz: end ? 1.3 : 1 });
          if (lastPost && wires) {
            const [lx, ly, lz] = lastPost, len = Math.hypot(x - lx, z - lz);
            for (const hh of [1.75, 2.75]) VL.wires.push({ x: (x + lx) / 2, y: (y0 + ly) / 2 + hh, z: (z + lz) / 2, ry: -Math.atan2(z - lz, x - lx), sx: len });
          }
          lastPost = [x, y0, z];
        }
        if (k === 0 || k === n) continue;
        const jx = r.range(-0.15, 0.15);
        VL.trunks.push({ x: x + jx * ca, y: y0 + 0.62, z: z + jx * sa, rx: r.range(-0.12, 0.12), rz: r.range(-0.12, 0.12), s: r.range(0.85, 1.1) });
        for (const hh of [1.5, 2.35, 3.0]) {
          if (hh > 2.9 && r() < 0.6) continue;
          const al = r.range(-0.45, 0.45), sd = r.range(-0.22, 0.22);
          const s = r.range(0.8, 1.12) * (hh > 2.9 ? 0.75 : 1);
          VL.leaves.push({ x: x + ca * al - sa * sd, y: y0 + hh + r.range(-0.12, 0.12), z: z + sa * al + ca * sd, ry: -ang + r.range(-0.5, 0.5), rx: r.range(-0.3, 0.3), sx: 1.15 * s, sy: 0.82 * s, sz: 0.7 * s, color: r.pick(leafCols) });
        }
        for (const sd of [-1, 1]) {
          if (r() < 0.35) continue;
          VL.bunches.push({ x: x - sa * sd * 0.42 + ca * r.range(-0.4, 0.4), y: y0 + 1.0 + r.range(-0.1, 0.1), z: z + ca * sd * 0.42 + sa * r.range(-0.4, 0.4), ry: r() * 6, rx: r.range(-0.2, 0.2), s: r.range(0.8, 1.2), color: red ? r.pick([0x3c1a46, 0x4a2052, 0x2f1638]) : r.pick([0xc9c25a, 0xbdb24c, 0xd6c96a, 0xa9b04a]) });
        }
        if (r() < 0.5) {
          const lx = x + r.range(-1.5, 1.5), lz = z + r.range(-1.5, 1.5);
          VL.litter.push({ x: lx, y: gY(lx, lz) + 0.05, z: lz, ry: r() * 6, s: r.range(0.7, 1.2), color: r.pick([0x8aa040, 0xc8b048, 0xd09038, 0xa86a30, 0x6f8f34]) });
        }
      }
    };
    const offsetRow = (s0, s1, off, sp = 2) => { const pts = []; for (let s = s0; s <= s1; s += sp) { const q = track.place(s, off); pts.push([q.x, q.z]); } return pts; };

    // terrace rows (on the boards)
    {
      const { at } = TR;
      const line = (d0, d1, side) => { const pts = []; for (let d = d0; d <= d1 + 0.01; d += 3) pts.push(at(d, side)); return pts; };
      for (const sd of [-1, 1]) {
        vineRow(line(11, 41.5, sd * 11.5));
        vineRow(line(42.5, 64, sd * 11.5), { red: sd > 0 });
        vineRow(line(11, 65, sd * 15.6), { red: sd > 0 });
        vineRow(line(11, 65, sd * 19.5));
      }
    }
    // table-level vineyards
    {
      const sx = (x, z) => sAt(x, z);
      // hill above the village
      for (const [z, x0, x1, red] of [[-1, -28, 70, false], [3, -30, 74, false], [7, -24, 2, true], [7, 28, 76, true], [11, -24, -2, false], [11, 30, 72, false]]) {
        const pts = []; for (let x = x0; x <= x1; x += 4) pts.push([x, z + Math.sin(x / 19) * 1.2]); vineRow(pts, { red });
      }
      // outside of the south-east sweeper (between path and river), the east strip and the north-east corner
      const sSE0 = sx(80, 46), sSE1 = sx(134, 2), sNE1 = sx(104, -60);
      for (const off of [11, 14.6, 18.2]) vineRow(offsetRow(sSE0 + 6, sSE1, off), { red: off > 14 && off < 15, collide: off < 12 });
      for (const off of [11, 14.6, 18.2, 21.8]) vineRow(offsetRow(sSE1 + 2, sNE1 - 4, off), { collide: off < 12 });
      // north of the terraces and behind the north-west hairpin
      for (const z of [-87.5, -91]) { const pts = []; for (let x = 20; x <= 92; x += 4) pts.push([x, z]); vineRow(pts, { red: z < -90 }); }
      const sHP0 = sx(-106, -61), sHP1 = sx(-150, -48);
      for (const off of [11, 14.6]) vineRow(offsetRow(sHP0 - 6, sHP1 + 4, off), { collide: off < 12 });
      vineRow(offsetRow(sx(-152, -30), sx(-148, 12), 11), { collide: true });
      // a little vineyard inside the hairpin, down both legs to the bread board: its first row is a fence, so the
      // hairpin can't be cut across
      const sE0 = sx(-97, -8), sW1 = sx(-151, -8);
      vineRow(offsetRow(sE0, sW1, -11.5), { collide: true, red: true });
      vineRow(offsetRow(sx(-98, -26), sHP0 - 6, -15.2)); vineRow(offsetRow(sHP0 + 10, sHP1 - 12, -15.2)); vineRow(offsetRow(sHP1 + 4, sx(-152, -27), -15.2));
      vineRow(offsetRow(sx(-98, -28), sx(-99, -50), -18.9), { red: true }); vineRow(offsetRow(sx(-151, -50), sx(-152, -29), -18.9));
      // the far bank of the river ("the other side")
      for (const [x0, x1] of [[-150, 18], [64, 152]]) { const pts = []; for (let x = x0; x <= x1; x += 4) pts.push([x, Math.max(riverZ(x) + RW / 2 + 2.6, 88) + 1.2]); vineRow(pts, { red: x0 > 0, wires: false, step: 1.5 }); }
    }

    // ============================================================================ the Moselle: a blue satin runner, hanging off both table ends
    {
      const satC = canvas(512, 512, (g, w, h) => {
        const gr = g.createLinearGradient(0, 0, w, 0);
        gr.addColorStop(0, '#24498e'); gr.addColorStop(0.07, '#2f5fae'); gr.addColorStop(0.5, '#3669ba'); gr.addColorStop(0.93, '#2f5fae'); gr.addColorStop(1, '#24498e');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
        const rr = K.rng(12);
        // woven sheen streaks along the length and faint printed ripples
        for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(${rr() < 0.5 ? '180,210,255' : '10,30,80'},${0.03 + rr() * 0.05})`; const x = rr() * w; for (const oy of [0, -h]) g.fillRect(x, rr() * h + oy, 1, 30 + rr() * 90); }
        g.strokeStyle = 'rgba(205,228,255,0.13)'; g.lineWidth = 2;
        for (let k = 0; k < 7; k++) {
          const y0 = (k / 7) * h + rr() * 30, x0 = 50 + rr() * 300, len = 90 + rr() * 110;
          g.beginPath(); for (let t = 0; t <= 1.001; t += 0.05) { const y = y0 + t * len, x = x0 + Math.sin(t * PI * 3) * 5; if (t === 0) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke();
        }
        // hem with stitching
        g.fillStyle = 'rgba(15,35,80,0.55)'; g.fillRect(0, 0, 14, h); g.fillRect(w - 14, 0, 14, h);
        g.fillStyle = 'rgba(210,225,255,0.55)'; for (let y = 0; y < h; y += 12) { g.fillRect(17, y, 2, 7); g.fillRect(w - 19, y, 2, 7); }
      });
      const satH = new Float32Array(256 * 256), nf = TX.noiseField(256, { seed: 13, period: 6, oct: 3 });
      for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) satH[y * 256 + x] = 0.5 + 0.18 * Math.sin(x * 1.6 + y * 0.05) + nf[y * 256 + x] * 0.6;
      const satN = TX.toTexture(TX.normalFromHeight(satH, 256, 256, 1.2), { srgb: false });
      const satin = K.phys({ map: TX.toTexture(satC), normalMap: satN, normalScale: V2(0.3), roughness: 0.34, sheen: 1, sheenColor: new T.Color(0x9fc4ff), sheenRoughness: 0.32, anisotropy: 0.6, clearcoat: 0.15, clearcoatRoughness: 0.4, side: T.DoubleSide });
      // grid along the river: lambda = distance along x (the ends drape down over the table edges)
      const X1 = TB.x1, DROP = 24, cols = 12;
      const lam = []; for (let l = -X1 - DROP; l <= X1 + DROP + 0.01; l += 2) lam.push(l);
      const pos = [], uv = [], idx = [];
      for (let i = 0; i < lam.length; i++) {
        const l = lam[i], over = Math.max(0, Math.abs(l) - X1), sg = Math.sign(l) || 1;
        const xc = over > 0 ? sg * (X1 + 0.9 * (1 - Math.exp(-over / 1.2))) : l;
        const xr = Math.max(-X1, Math.min(X1, l));
        const zc = riverZ(xr), dz = over > 0 ? 0 : riverDZ(xr), ln = Math.hypot(1, dz);
        for (let c = 0; c <= cols; c++) {
          const u = c / cols, off = (u - 0.5) * RW;
          let x = xc - (dz / ln) * off, z = zc + off / ln;
          let y;
          if (over > 0) y = -over + 0.12 + 0.35 * Math.exp(-over / 1.5) + Math.sin(off * 0.9 + over * 0.3) * 0.18 * Math.min(1, over / 6);
          else {
            const edge = Math.abs(u - 0.5) > 0.47 ? 0.06 : 0;
            y = 0.1 + edge + 0.16 * Math.max(0, Math.sin(l * 0.23 + off * 0.75) * Math.sin(l * 0.051 + 1.3)) + 0.05 * Math.sin(l * 0.9 + off * 2.1);
          }
          if (over > 0) x += sg * 0.25 * Math.sin(off * 0.6) * Math.min(1, over / 8);
          pos.push(x, y, z); uv.push(u, l / 21);
        }
        if (i > 0) for (let c = 0; c < cols; c++) { const a0 = (i - 1) * (cols + 1) + c, b0 = a0 + 1, d0 = i * (cols + 1) + c, e0 = d0 + 1; idx.push(a0, b0, d0, b0, e0, d0); }
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals();
      const m = new T.Mesh(g, satin); m.receiveShadow = true; m.castShadow = true; K.group.add(m); keep.push(m);
      // fabric drags the wheels (soft and slow), on the table part
      const north = [], south = [];
      for (let x = -X1; x <= X1 + 0.01; x += 6) { const zc = riverZ(x); north.push([x, zc - RW / 2 + 0.3]); south.push([x, zc + RW / 2 - 0.3]); }
      K.surface('slow', { poly: north.concat(south.reverse()) });
      // tassels at the hanging ends
      const tas = [];
      for (const sg of [-1, 1]) { const zc = riverZ(sg * X1); for (let k = 0; k <= 9; k++) { const z = zc - RW / 2 + 1 + (k / 9) * (RW - 2); tas.push({ x: sg * (X1 + 0.95), y: -DROP - 1.2, z, s: 1 }); } }
      K.instances(new T.CylinderGeometry(0.25, 0.4, 2.6, 6), K.std({ color: 0x2a52a0, roughness: 0.8 }), tas);
      // pebbles along both banks
      const bank = [];
      for (const sd of [-1, 1]) for (let x = -X1 + 2; x < X1 - 2; x += r.range(1.4, 2.4)) {
        if (sd < 0 && Math.abs(x - BRIDGE_X) < 6) continue;
        const z = riverZ(x) + sd * (RW / 2 + 0.7 + r.range(0, 0.8)), s = r.range(0.5, 0.95);
        if (sd < 0 && !K.offRoad(x, z, 0.6)) continue;
        bank.push({ x, y: 0.22 * s, z, rx: r() * 6, ry: r() * 6, sx: 0.9 * s, sy: 0.5 * s, sz: 0.8 * s, color: r.pick([0xd9d3c8, 0xb8b2aa, 0x9a9690, 0xc9b79a, 0x8a8f96]) });
      }
      allStones.push(...bank);
      // check the path keeps clear of the runner
      for (let x = -130; x <= 90; x += 5) { const zc = riverZ(x) - RW / 2; if (!K.offRoad(x, zc, 1.5)) console.warn('moselle: runner touches the path at x', x); }
    }

    // ============================================================================ the village: white houses, slate roofs, a church, a stone bridge
    const slateRoofC = canvas(256, 256, (g, w, h) => {
      const rr = K.rng(71);
      g.fillStyle = '#3a4048'; g.fillRect(0, 0, w, h);
      for (let row = 0; row < 16; row++) {
        const y = row * 16;
        for (let i = -1; i < 17; i++) {
          const x = i * 16 + (row % 2) * 8, k = 0.75 + rr() * 0.4;
          g.fillStyle = `rgb(${(80 * k) | 0},${(90 * k) | 0},${(102 * k) | 0})`;
          g.beginPath(); g.roundRect(x + 1, y + 1, 14, 15, [0, 0, 6, 6]); g.fill();
        }
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, y + 15, w, 1.5);
      }
    });
    const slateMat = K.std({ map: TX.toTexture(slateRoofC), roughness: 0.55, metalness: 0.05 });
    const wallTex = (wall, shut, seed, flowers = null) => canvas(128, 128, (g, w, h) => {
      const rr = K.rng(seed);
      g.fillStyle = wall; g.fillRect(0, 0, w, h);
      speckle(g, w, h, rr, 500, 0.02, 0.04, 6);
      const wx = 44, wy = 26, ww = 40, wh = 56;
      g.fillStyle = shut; g.fillRect(wx - 18, wy, 15, wh); g.fillRect(wx + ww + 3, wy, 15, wh);
      g.fillStyle = 'rgba(0,0,0,0.22)'; for (let k = 0; k < 7; k++) { g.fillRect(wx - 18, wy + 4 + k * 8, 15, 1.5); g.fillRect(wx + ww + 3, wy + 4 + k * 8, 15, 1.5); }
      g.fillStyle = '#d8ccb1'; g.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
      const gr = g.createLinearGradient(wx, wy, wx + ww, wy + wh); gr.addColorStop(0, '#3a4b5c'); gr.addColorStop(0.45, '#6d8396'); gr.addColorStop(1, '#27323e');
      g.fillStyle = gr; g.fillRect(wx, wy, ww, wh);
      g.fillStyle = '#f6f3ea'; g.fillRect(wx + ww / 2 - 2, wy, 4, wh); g.fillRect(wx, wy + wh * 0.38, ww, 3);
      g.strokeStyle = '#f6f3ea'; g.lineWidth = 3; g.strokeRect(wx + 1.5, wy + 1.5, ww - 3, wh - 3);
      g.fillStyle = '#c4b597'; g.fillRect(wx - 6, wy + wh + 3, ww + 12, 5);
      if (flowers) {
        g.fillStyle = '#6b4a2a'; g.fillRect(wx - 2, wy + wh - 6, ww + 4, 9);
        for (let i = 0; i < 26; i++) { g.fillStyle = rr() < 0.3 ? '#3f6e2a' : flowers; g.beginPath(); g.arc(wx + rr() * ww, wy + wh - 6 - rr() * 7, 2.2 + rr() * 1.8, 0, TAU); g.fill(); }
      }
      // base course at the bottom of each floor tile
      g.fillStyle = 'rgba(120,110,95,0.18)'; g.fillRect(0, h - 4, w, 4);
    });
    const wallMats = [['#f5f1e8', '#4f7a52', 3, '#e0324a'], ['#efe2c4', '#58789a', 4, null], ['#f3ead8', '#8a3a32', 5, '#f06aa0'], ['#efe0b2', '#5f6b46', 6, null]].map(([w, s, sd, f]) => K.std({ map: TX.toTexture(wallTex(w, s, sd, f)), roughness: 0.82 }));
    const plaster = K.std({ map: TX.toTexture(canvas(64, 64, (g, w, h) => { g.fillStyle = '#f4f0e6'; g.fillRect(0, 0, w, h); speckle(g, w, h, K.rng(8), 200, 0.02, 0.04, 5); })), roughness: 0.85 });
    // box with UVs in whole window bays (3.2 wide) and floors (3 tall)
    const boxUV = (w, h, d, su = 3.2, sv = 3) => {
      const g = new T.BoxGeometry(w, h, d), uv = g.attributes.uv;
      const ext = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
      for (let f = 0; f < 6; f++) {
        const nu = Math.max(1, Math.round(ext[f][0] / su)), nv = Math.max(1, Math.round(ext[f][1] / sv));
        for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * nu, uv.getY(i) * nv); }
      }
      return g;
    };
    const doorMat = K.std({ color: 0x5b3a26, roughness: 0.6 });
    const house = (cx, cz, ang, { w, d, h, rh, v = 0, chim = false, sign = null, front = 1 }) => {
      const grp = new T.Group();
      const wm = wallMats[v % wallMats.length];
      part(grp, boxUV(w, h, d), wm, 0, h / 2, 0);
      // gable prism under the roof (wall material, attic window)
      const sh = new T.Shape(); sh.moveTo(-d / 2, 0); sh.lineTo(d / 2, 0); sh.lineTo(0, rh); sh.closePath();
      const gg = new T.ExtrudeGeometry(sh, { depth: w, bevelEnabled: false });
      const guv = gg.attributes.uv; for (let i = 0; i < guv.count; i++) guv.setXY(i, guv.getX(i) / 3.2 + 0.5, guv.getY(i) / 3 + 0.08);
      gg.rotateY(PI / 2); gg.translate(-w / 2, h, 0);
      part(grp, gg, wm);
      // slate roof slabs
      const over = 0.7, th = Math.atan2(rh, d / 2), slabL = (d / 2 + over) / Math.cos(th);
      for (const sd of [-1, 1]) {
        const sl = part(grp, boxUV(w + over * 2, 0.35, slabL, 4, 4), slateMat, 0, h + rh / 2 - (over * Math.tan(th)) / 2 + 0.15, sd * ((d / 2 + over) / 2 - 0.05), 0, 0, 0);
        sl.rotation.x = sd * th;
      }
      // ridge
      part(grp, new T.BoxGeometry(w + over * 2 + 0.1, 0.4, 0.5), K.std({ color: 0x2c3036, roughness: 0.5 }), 0, h + rh + 0.12, 0);
      if (chim) part(grp, boxUV(1.2, 3, 1.2), plaster, w * 0.28, h + rh * 0.7 + 0.5, -d * 0.12);
      // front door facing the street
      part(grp, new T.BoxGeometry(1.4, 2.3, 0.2), doorMat, w * (v % 2 ? 0.22 : -0.22), 1.15, front * (d / 2 + 0.05));
      part(grp, new T.BoxGeometry(2.0, 0.25, 0.6), plaster, w * (v % 2 ? 0.22 : -0.22), 2.45, front * (d / 2 + 0.3));
      if (sign) {
        const sc = canvas(512, 128, (g, cw, chh) => {
          g.fillStyle = '#1f3b2a'; g.fillRect(0, 0, cw, chh); g.strokeStyle = '#d8b25e'; g.lineWidth = 6; g.strokeRect(8, 8, cw - 16, chh - 16);
          g.fillStyle = '#e9cf8a'; g.font = '700 46px Georgia, serif'; g.textAlign = 'center'; g.fillText(sign[0], cw / 2, 62);
          g.font = 'italic 28px Georgia, serif'; g.fillText(sign[1], cw / 2, 100);
        });
        part(grp, new T.PlaneGeometry(w * 0.7, w * 0.175), K.std({ map: tex(sc), roughness: 0.6 }), 0, h - 1.2, front * (d / 2 + 0.06), 0, front > 0 ? 0 : PI, 0);
      }
      grp.position.set(cx, 0, cz); grp.rotation.y = -ang;
      K.add(grp);
      K.box(cx, cz, w / 2, d / 2, ang, h + rh);
      AO(cx, cz, w / 2 + 1.6, d / 2 + 1.6, 0.42, ang, 0);
      warnRoad('house', cx, cz, d / 2 + 1);
      return grp;
    };
    {
      // street front along the south straight (north side), then a second row and the church behind
      const front = [
        { x: -37, w: 9, d: 7, h: 6.2, rh: 4.2, v: 0 },
        { x: -26.5, w: 8, d: 7.5, h: 7.2, rh: 4.4, v: 1, chim: true },
        { x: -15.5, w: 9.5, d: 7, h: 6, rh: 4.2, v: 2 },
        { x: -4, w: 8.5, d: 7.5, h: 7.4, rh: 4.6, v: 3, chim: true },
        { x: 24, w: 9, d: 7, h: 6.4, rh: 4.2, v: 1 },
        { x: 35, w: 8, d: 7, h: 7, rh: 4.4, v: 2, chim: true },
        { x: 56, w: 13, d: 8.5, h: 6.6, rh: 4.8, v: 0, sign: ['DOMAINE VROUMBIERG', 'Caves · Dégustation'] },
        { x: 70, w: 8, d: 7, h: 6.2, rh: 4.2, v: 3 },
      ];
      for (const hs of front) {
        const s = sAt(hs.x, 46), p = track.at(s);
        const [cx, cz] = local(p.x, p.z, p.angle, 0, -(W / 2 + 3.2 + hs.d / 2));
        house(cx, cz, p.angle, hs);
      }
      for (const [x, z, w, d, h, rh, v] of [[-32, 23.5, 8, 6.5, 6.4, 4.2, 2], [-21, 22.5, 7, 6, 5.6, 4, 0], [30, 23, 8.5, 6.5, 6, 4.2, 3], [44, 24.5, 7, 6, 6.6, 4, 0], [63, 24, 8, 6.5, 5.8, 4, 1]]) {
        house(x, z, -0.02 + (x % 3) * 0.02, { w, d, h, rh, v });
      }
      // church: nave, apse, west tower with an octagonal slate spire
      {
        const cx = 10, cz = 21, grp = new T.Group();
        const chC = canvas(128, 256, (g, w, h) => {
          g.fillStyle = '#f6f2ea'; g.fillRect(0, 0, w, h); speckle(g, w, h, K.rng(31), 300, 0.02, 0.04, 6);
          g.fillStyle = '#d6cab0'; g.beginPath(); g.moveTo(36, 200); g.lineTo(36, 92); g.arc(64, 92, 28, PI, 0); g.lineTo(92, 200); g.closePath(); g.fill();
          const gr = g.createLinearGradient(0, 70, 0, 200); gr.addColorStop(0, '#4a5f78'); gr.addColorStop(1, '#2a3446');
          g.fillStyle = gr; g.beginPath(); g.moveTo(41, 196); g.lineTo(41, 92); g.arc(64, 92, 23, PI, 0); g.lineTo(87, 196); g.closePath(); g.fill();
          g.strokeStyle = 'rgba(200,190,160,0.6)'; g.lineWidth = 2; for (let y = 100; y < 196; y += 16) { g.beginPath(); g.moveTo(41, y); g.lineTo(87, y); g.stroke(); } g.beginPath(); g.moveTo(64, 70); g.lineTo(64, 196); g.stroke();
          g.fillStyle = 'rgba(120,110,95,0.2)'; g.fillRect(0, h - 10, w, 10);
        });
        const churchMat = K.std({ map: TX.toTexture(chC), roughness: 0.82 });
        const nave = { w: 16, d: 9, h: 8, rh: 5.5 };
        part(grp, boxUV(nave.w, nave.h, nave.d, 4, 8), churchMat, 2, nave.h / 2, 0);
        const sh = new T.Shape(); sh.moveTo(-nave.d / 2, 0); sh.lineTo(nave.d / 2, 0); sh.lineTo(0, nave.rh); sh.closePath();
        const gg = new T.ExtrudeGeometry(sh, { depth: nave.w, bevelEnabled: false }); gg.rotateY(PI / 2); gg.translate(-nave.w / 2 + 2, nave.h, 0);
        part(grp, gg, plaster);
        const over = 0.6, th = Math.atan2(nave.rh, nave.d / 2), slabL = (nave.d / 2 + over) / Math.cos(th);
        for (const sd of [-1, 1]) { const sl = part(grp, boxUV(nave.w + 1, 0.35, slabL, 4, 4), slateMat, 2.5, nave.h + nave.rh / 2 - (over * Math.tan(th)) / 2 + 0.15, sd * ((nave.d / 2 + over) / 2 - 0.05)); sl.rotation.x = sd * th; }
        // apse at the east end
        part(grp, new T.CylinderGeometry(4.2, 4.2, 7, 18, 1, false, 0, PI), plaster, 10, 3.5, 0, 0, 0, 0);
        part(grp, new T.ConeGeometry(4.7, 4.2, 18, 1, false, 0, PI), slateMat, 10, 9.1, 0);
        // tower
        const tw = 5.6, tH = 14;
        part(grp, boxUV(tw, tH, tw, 5.6, 14), plaster, -7.6, tH / 2, 0);
        part(grp, new T.BoxGeometry(tw + 0.4, 0.5, tw + 0.4), K.std({ color: 0xcfc3a6, roughness: 0.8 }), -7.6, tH, 0);
        part(grp, new T.ConeGeometry(3.95, 12, 8), slateMat, -7.6, tH + 6, 0, 0, PI / 8, 0);
        part(grp, new T.SphereGeometry(0.35, 10, 8), gold, -7.6, tH + 12.3, 0);
        part(grp, new T.BoxGeometry(0.16, 1.9, 0.16), gold, -7.6, tH + 13.3, 0);
        part(grp, new T.BoxGeometry(0.16, 0.16, 1.1), gold, -7.6, tH + 13.6, 0);
        // clock faces and louvred belfry openings
        const clockC = canvas(128, 128, (g) => {
          g.fillStyle = '#1f2a3a'; g.beginPath(); g.arc(64, 64, 62, 0, TAU); g.fill();
          g.fillStyle = '#f2ead6'; g.beginPath(); g.arc(64, 64, 52, 0, TAU); g.fill();
          g.fillStyle = '#1f2a3a'; for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; g.fillRect(64 + Math.cos(a) * 42 - 3, 64 + Math.sin(a) * 42 - 3, 6, 6); }
          g.strokeStyle = '#1f2a3a'; g.lineWidth = 6; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + 24, 64 + 14); g.stroke(); g.lineWidth = 4; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 - 8, 64 - 38); g.stroke();
        });
        const clockMat = K.std({ map: tex(clockC), roughness: 0.5, metalness: 0.1 });
        const louvre = K.std({ color: 0x3a3430, roughness: 0.7 });
        for (const [nx, nz, ry] of [[0, 1, 0], [0, -1, PI], [-1, 0, -PI / 2]]) {
          part(grp, new T.CircleGeometry(1.25, 24), clockMat, -7.6 + nx * (tw / 2 + 0.03), tH - 3.2, nz * (tw / 2 + 0.03), 0, ry, 0);
          part(grp, new T.BoxGeometry(1.0, 2.4, 0.1), louvre, -7.6 + nx * (tw / 2 + 0.02) + (nz ? -0.8 : 0), tH - 6.6, nz * (tw / 2 + 0.02) + (nx ? -0.8 : 0), 0, ry, 0);
          part(grp, new T.BoxGeometry(1.0, 2.4, 0.1), louvre, -7.6 + nx * (tw / 2 + 0.02) + (nz ? 0.8 : 0), tH - 6.6, nz * (tw / 2 + 0.02) + (nx ? 0.8 : 0), 0, ry, 0);
        }
        part(grp, new T.BoxGeometry(1.6, 3, 0.2), doorMat, -7.6, 1.5, tw / 2 + 0.05);
        grp.position.set(cx, 0, cz);
        K.add(grp);
        K.box(cx + 2, cz, 8, 4.5, 0, 13); K.circle(cx + 10, cz, 4.2, 9); K.box(cx - 7.6, cz, 2.8, 2.8, 0, 26);
        AO(cx + 1, cz, 15, 7, 0.45, 0, 0);
      }
      // cobbled pavements: in front of the houses and the riverside promenade
      const settC = canvas(128, 128, (g, w, h) => {
        const rr = K.rng(57);
        g.fillStyle = '#7d766c'; g.fillRect(0, 0, w, h);
        rowsTile(g, w, h, 16, 14, 26, rr, (q) => { const k = 0.78 + q() * 0.35, t = q(); const b = t < 0.7 ? [186, 180, 170] : [176, 160, 138]; return `rgb(${(b[0] * k) | 0},${(b[1] * k) | 0},${(b[2] * k) | 0})`; }, 3);
      });
      const settN = TX.toTexture(TX.normalFromHeight(TX.heightFromCanvasLuma(settC), 128, 128, 2), { srgb: false });
      const settMat = K.std({ map: TX.toTexture(settC), normalMap: settN, normalScale: V2(0.7), roughness: 0.85 });
      const strip = (s0, s1, o0, o1, mat, y = 0.05, vs = 4) => {
        const pos = [], uv = [], idx = [], n = Math.ceil(s1 - s0);
        for (let k = 0; k <= n; k++) {
          const sS = s0 + ((s1 - s0) * k) / n, p = track.at(sS);
          pos.push(p.x + p.nx * o0, y, p.z + p.nz * o0, p.x + p.nx * o1, y, p.z + p.nz * o1);
          uv.push(0, sS / vs, (o1 - o0) / vs, sS / vs);
          if (k > 0) { const a = (k - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
        }
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
        g.setIndex(idx); g.computeVertexNormals();
        const nr = g.attributes.normal; for (let i = 0; i < nr.count; i++) nr.setXYZ(i, 0, 1, 0);
        const m = new T.Mesh(g, mat); m.receiveShadow = true; K.group.add(m);
        return m;
      };
      const sV0 = sAt(-44, 46), sV1 = sAt(76, 44);
      strip(sV0, sV1, -(W / 2 + 3.3), -(W / 2 + 1.1), settMat);
      strip(sV0 - 4, sV1 + 4, W / 2 + 1.1, W / 2 + 4.2, settMat);
      // oak barrels outside the winery
      const barrel = K.lathe([[0.01, 0], [1.05, 0], [1.25, 0.6], [1.35, 1.25], [1.25, 1.9], [1.05, 2.5], [0.01, 2.5]], 18);
      const barrelMat = K.std({ map: TX.toTexture(canvas(64, 64, (g, w, h) => { g.fillStyle = '#8a5a32'; g.fillRect(0, 0, w, h); for (let i = 0; i < w; i += 8) { g.fillStyle = 'rgba(40,20,10,0.4)'; g.fillRect(i, 0, 1.5, h); } g.fillStyle = '#3a3a3a'; g.fillRect(0, 10, w, 4); g.fillRect(0, h - 14, w, 4); })), roughness: 0.7 });
      {
        const p = track.at(sAt(56, 46));
        for (const [al, sd] of [[-7.6, -10.2], [-5.2, -10.4], [7.6, -10.3]]) {
          const [bx2, bz2] = local(p.x, p.z, p.angle, al, sd);
          K.mesh(barrel, barrelMat, bx2, 0, bz2, { ry: r() * 6 });
          K.circle(bx2, bz2, 1.35, 2.5);
        }
      }
      // little village square: fountain, trees, a bench, barrels outside the winery
      {
        const fx = 10, fz = 32.5;
        K.mesh(K.lathe([[0.01, 0], [2.6, 0], [2.7, 0.8], [2.4, 0.9], [2.3, 0.4], [0.01, 0.4]], 28), K.std({ color: 0xcfc2a6, roughness: 0.8 }), fx, 0, fz);
        K.mesh(new T.CircleGeometry(2.3, 24), K.liquid(0x7aa6c8, { roughness: 0.05 }), fx, 0.7, fz, { rx: -PI / 2, cast: false });
        K.mesh(new T.CylinderGeometry(0.35, 0.5, 2.6, 10), K.std({ color: 0xcfc2a6, roughness: 0.8 }), fx, 1.3, fz);
        K.mesh(new T.SphereGeometry(0.55, 12, 8), K.std({ color: 0xcfc2a6, roughness: 0.8 }), fx, 2.8, fz);
        K.circle(fx, fz, 2.7, 1.5);
        AO(fx, fz, 3.2, 3.2, 0.35, 0, 0);
        warnRoad('fountain', fx, fz, 3);
      }
    }
    // trees (village and riverside promenade)
    {
      const canopies = [], trunks = [];
      const tree = (x, z, s = 1) => {
        trunks.push({ x, y: 1.1 * s, z, s, sy: s * 1.1 });
        canopies.push({ x, y: (2.9 + r.range(-0.2, 0.2)) * s, z, ry: r() * 6, sx: s * r.range(0.95, 1.15), sy: s * r.range(1.05, 1.3), sz: s * r.range(0.95, 1.15), color: r.pick([0x5f8a3a, 0x6b9440, 0x58803a, 0x76994a]) });
        AO(x, z, 2.2 * s, 2.2 * s, 0.38, 0, 0);
        K.circle(x, z, 0.5 * s, 4 * s);
        warnRoad('tree', x, z, 1.5);
      };
      for (const [x, z, s] of [[2, 30, 0.9], [18, 31, 0.85], [-44, 25, 1], [48, 30, 0.8], [-9, 21, 0.9], [78, 26, 1], [24, 12, 0.9], [-2, 13, 0.8]]) tree(x, z, s);
      // plane trees along the riverside promenade (low, so they don't hide the road)
      for (const x of [-46, -20, 6, 66, 82]) { const s = sAt(x, 46), p = track.place(s, W / 2 + 3); tree(p.x, p.z + 0.6, 0.72); }
      const canG = new T.IcosahedronGeometry(1.6, 1);
      const canT = TX.mottledTextures({ size: 128, a: 0xb8d48a, b: 0x5e7e3a, seed: 23, period: 10, bump: 5 });
      inst(canG, K.std({ map: canT.map, normalMap: canT.normalMap, roughness: 0.85 }), canopies, { colors: true });
      inst(new T.CylinderGeometry(0.18, 0.3, 2.2, 6), K.std({ color: 0x6a5240, roughness: 0.9 }), trunks);
    }
    // stone bridge across the Moselle (the boat passes under the middle arch)
    {
      const bx = BRIDGE_X, zr = riverZ(bx), lane = zr + BOAT.lane;
      const pB = track.at(sAt(bx, 46));
      const zN = pB.z + W / 2 + 1.2, zS = 93;
      const arches = [[lane - 12.8, lane - 7.3, 3.4], [lane - 6, lane + 6, 6.2], [lane + 7.3, lane + 12.8, 3.4]];
      const half = Math.max(lane - zN, zS - lane);
      const topY = (z) => 1.0 + 6.6 * Math.pow(Math.max(0, 1 - ((z - lane) / half) ** 2), 0.7);
      const sh = new T.Shape();
      sh.moveTo(zN, 0);
      for (let k = 0; k <= 30; k++) { const z = zN + ((zS - zN) * k) / 30; sh.lineTo(z, topY(z)); }
      sh.lineTo(zS, 0);
      for (let a = arches.length - 1; a >= 0; a--) {
        const [z0, z1, c] = arches[a], mid = (z0 + z1) / 2, hw = (z1 - z0) / 2;
        sh.lineTo(z1, 0);
        for (let k = 1; k < 16; k++) { const ph = (k / 16) * PI; sh.lineTo(mid + hw * Math.cos(ph), c * Math.sin(ph)); }
        sh.lineTo(z0, 0);
      }
      sh.closePath();
      const stoneC = canvas(256, 256, (g, w, h) => {
        const rr = K.rng(81);
        g.fillStyle = '#8b8172'; g.fillRect(0, 0, w, h);
        rowsTile(g, w, h, 32, 32, 70, rr, (q) => { const k = 0.8 + q() * 0.32, t = q(); const b = t < 0.6 ? [200, 186, 160] : t < 0.85 ? [180, 172, 162] : [196, 164, 132]; return `rgb(${(b[0] * k) | 0},${(b[1] * k) | 0},${(b[2] * k) | 0})`; }, 3);
        speckle(g, w, h, rr, 1600, 0.03, 0.06, 3);
      });
      const stoneN = TX.toTexture(TX.normalFromHeight(TX.heightFromCanvasLuma(stoneC), 256, 256, 2.5), { srgb: false });
      const bridgeMat = K.std({ map: TX.toTexture(stoneC), normalMap: stoneN, normalScale: V2(0.8), roughness: 0.88 });
      const scaleUV = (g, k) => { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * k, uv.getY(i) * k); };
      const bg = new T.ExtrudeGeometry(sh, { depth: 7, bevelEnabled: false, curveSegments: 1 });
      scaleUV(bg, 1 / 7); bg.rotateY(-PI / 2); bg.translate(bx + 3.5, 0, 0);
      K.mesh(bg, bridgeMat, 0, 0, 0);
      // parapets
      const ps = new T.Shape();
      for (let k = 0; k <= 30; k++) { const z = zN + ((zS - zN) * k) / 30; if (k === 0) ps.moveTo(z, topY(z) - 0.2); else ps.lineTo(z, topY(z) - 0.2); }
      for (let k = 30; k >= 0; k--) { const z = zN + ((zS - zN) * k) / 30; ps.lineTo(z, topY(z) + 1.1); }
      ps.closePath();
      for (const sd of [-1, 1]) {
        const pg = new T.ExtrudeGeometry(ps, { depth: 0.6, bevelEnabled: false, curveSegments: 1 });
        scaleUV(pg, 1 / 7); pg.rotateY(-PI / 2); pg.translate(bx + sd * 3.2 + 0.3, 0, 0);
        K.mesh(pg, bridgeMat, 0, 0, 0);
      }
      // lanterns at both ends
      const lampPost = K.std({ color: 0x1d1d1d, roughness: 0.5 }), lampGlass = K.std({ color: 0xfff2c8, emissive: 0xffc870, emissiveIntensity: 0.6, roughness: 0.4 });
      for (const z of [zN + 1, zS - 1.2]) for (const sd of [-1, 1]) {
        const y0 = topY(z) + 1.1;
        K.mesh(new T.CylinderGeometry(0.12, 0.12, 2.2, 6), lampPost, bx + sd * 3.2, y0 + 1.1, z);
        K.mesh(new T.BoxGeometry(0.55, 0.7, 0.55), lampGlass, bx + sd * 3.2, y0 + 2.4, z);
      }
      // colliders: abutments and piers
      const nEnd = arches[0][0];
      K.box(bx, (zN + nEnd) / 2, 3.6, (nEnd - zN) / 2, 0, 3.5);
      K.box(bx, (arches[2][1] + zS) / 2, 3.6, (zS - arches[2][1]) / 2, 0, 3.5);
      for (const z of [lane - 6.65, lane + 6.65]) K.box(bx, z, 3.6, 0.65, 0, 7);
      // pointed cutwaters on the river piers, up- and downstream
      {
        const cs = new T.Shape(); cs.moveTo(0, -1.0); cs.lineTo(2.2, 0); cs.lineTo(0, 1.0); cs.closePath();
        const cg = new T.ExtrudeGeometry(cs, { depth: 4.4, bevelEnabled: false }); scaleUV(cg, 1 / 5); cg.rotateX(-PI / 2);
        const capS = new T.Shape(); capS.moveTo(0, -1.15); capS.lineTo(2.5, 0); capS.lineTo(0, 1.15); capS.closePath();
        const capG = new T.ExtrudeGeometry(capS, { depth: 0.35, bevelEnabled: false }); scaleUV(capG, 1 / 5); capG.rotateX(-PI / 2); capG.translate(0, 4.4, 0);
        for (const z of [lane - 6.65, lane + 6.65]) for (const sd of [-1, 1]) {
          K.mesh(cg, bridgeMat, bx + sd * 3.45, 0, z, { ry: sd > 0 ? 0 : PI });
          K.mesh(capG, K.std({ color: 0xcfc3a6, roughness: 0.8 }), bx + sd * 3.45, 0, z, { ry: sd > 0 ? 0 : PI });
        }
      }
      for (const z of [lane - 13.4, lane + 13.4]) K.box(bx, z, 3.6, 0.6, 0, 6);
      AO(bx, (zN + zS) / 2, 4.8, (zS - zN) / 2 + 1, 0.4, 0, 0.12);
      warnRoad('bridge', bx, zN + 1, 0.3);
      // two cottages and a quay wall on the far bank
      house(bx - 13, 91.5, 0.04, { w: 7, d: 5.4, h: 4.6, rh: 3.4, v: 1, front: -1 });
      house(bx + 14, 91.8, -0.03, { w: 6.5, d: 5, h: 4.2, rh: 3.2, v: 3, front: -1 });
    }

    // ============================================================================ the excursion boat
    {
      const grp = new T.Group(), body = new T.Group(); grp.add(body);
      const hs = new T.Shape();
      hs.moveTo(-7.9, -2.0); hs.lineTo(4.4, -2.4); hs.quadraticCurveTo(7.3, -2.3, 8.4, 0); hs.quadraticCurveTo(7.3, 2.3, 4.4, 2.4); hs.lineTo(-7.9, 2.0); hs.quadraticCurveTo(-8.6, 0, -7.9, -2.0);
      const hull = new T.ExtrudeGeometry(hs, { depth: 1.6, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 2, curveSegments: 10 });
      hull.rotateX(-PI / 2);
      { // white topsides, a blue band and an oxblood waterline by height
        const p = hull.attributes.position, col = new Float32Array(p.count * 3), c = new T.Color();
        for (let i = 0; i < p.count; i++) { const y = p.getY(i); c.set(y < 0.35 ? 0x7a1f22 : y > 1.05 && y < 1.4 ? 0x2a5aa8 : 0xf7f6f2); col.set([c.r, c.g, c.b], i * 3); }
        hull.setAttribute('color', new T.BufferAttribute(col, 3));
      }
      part(body, hull, K.phys({ vertexColors: true, roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.2 }), 0, 0.05, 0);
      part(body, new T.BoxGeometry(14.4, 0.12, 3.9), K.std({ color: 0xb68a5c, roughness: 0.7 }), 0.2, 1.74, 0);
      const winC = canvas(512, 64, (g, w, h) => {
        g.fillStyle = '#f7f6f2'; g.fillRect(0, 0, w, h);
        for (let k = 0; k < 9; k++) { g.fillStyle = '#22344e'; g.beginPath(); g.roundRect(14 + k * 55, 14, 44, 32, 7); g.fill(); g.fillStyle = 'rgba(160,200,240,0.4)'; g.fillRect(18 + k * 55, 17, 14, 8); }
        g.fillStyle = '#2a5aa8'; g.fillRect(0, h - 6, w, 6);
      });
      const winMat = K.std({ map: tex(winC), roughness: 0.35 });
      const white = K.phys({ color: 0xf7f6f2, roughness: 0.35, clearcoat: 0.5 });
      part(body, new T.BoxGeometry(10, 1.7, 3.7), [winMat, winMat, white, white, winMat, winMat], -0.8, 2.65, 0);
      part(body, new T.BoxGeometry(10.6, 0.14, 4.1), white, -0.8, 3.55, 0);
      // sun deck railing and benches
      const railM = K.std({ color: 0xf2f2ee, roughness: 0.4 });
      for (const sd of [-1, 1]) part(body, new T.BoxGeometry(10.4, 0.1, 0.1), railM, -0.8, 4.2, sd * 1.95);
      part(body, new T.BoxGeometry(0.1, 0.1, 3.9), railM, -6, 4.2, 0);
      for (let k = 0; k <= 8; k++) for (const sd of [-1, 1]) part(body, new T.BoxGeometry(0.08, 0.62, 0.08), railM, -6 + k * 1.3, 3.9, sd * 1.95);
      for (const sd of [-1, 1]) part(body, new T.BoxGeometry(6, 0.35, 0.6), K.std({ color: 0x2a5aa8, roughness: 0.5 }), -2.2, 3.8, sd * 1.1);
      // wheelhouse, funnel, mast with flag, life rings
      part(body, new T.BoxGeometry(2.4, 1.3, 3.0), [winMat, winMat, white, white, winMat, winMat], 3.0, 4.25, 0);
      part(body, new T.BoxGeometry(2.7, 0.14, 3.3), K.std({ color: 0x2a5aa8, roughness: 0.4 }), 3.0, 4.95, 0);
      part(body, new T.CylinderGeometry(0.45, 0.5, 1.1, 14), K.std({ color: 0x2a5aa8, roughness: 0.4 }), -3.6, 4.1, 0);
      part(body, new T.CylinderGeometry(0.06, 0.06, 2.0, 6), railM, -7.2, 2.7, 0);
      const flagC = canvas(96, 64, (g) => { g.fillStyle = '#e8242f'; g.fillRect(0, 0, 96, 22); g.fillStyle = '#ffffff'; g.fillRect(0, 21, 96, 22); g.fillStyle = '#28a4e0'; g.fillRect(0, 42, 96, 22); });
      const flag = part(body, new T.PlaneGeometry(1.5, 1.0), K.std({ map: tex(flagC), roughness: 0.7, side: T.DoubleSide }), -7.95, 3.2, 0);
      for (const sd of [-1, 1]) part(body, new T.TorusGeometry(0.42, 0.13, 6, 14), K.std({ color: 0xf06a1e, roughness: 0.5 }), 2.0, 2.6, sd * 1.9, 0, 0, 0);
      const nameC = canvas(512, 64, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#1d3f7a'; g.font = '700 40px Rubik, Arial'; g.textAlign = 'center'; g.fillText('MS PETITE MUSEL', w / 2, 46); });
      const nameMat = K.std({ map: tex(nameC), transparent: true, roughness: 0.4 });
      for (const sd of [-1, 1]) part(body, new T.PlaneGeometry(6, 0.75), nameMat, 1.5, 0.75, sd * 2.5, 0, sd > 0 ? 0 : PI, 0);
      // collapse the boat's parts into one mesh per material (it is animated, so it stays out of the static merge)
      {
        body.updateMatrixWorld(true);
        const inv = new T.Matrix4().copy(body.matrixWorld).invert();
        const buckets = new Map();
        body.traverse((o) => { if (o.isMesh && o !== flag && !Array.isArray(o.material)) { const k = o.material.uuid; if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(o); } });
        for (const list of buckets.values()) {
          const geos = list.map((o) => { const gg = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); gg.applyMatrix4(new T.Matrix4().multiplyMatrices(inv, o.matrixWorld)); for (const k of Object.keys(gg.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) gg.deleteAttribute(k); if (!gg.attributes.uv) gg.setAttribute('uv', new T.BufferAttribute(new Float32Array(gg.attributes.position.count * 2), 2)); return gg; });
          const hasCol = geos.some((gg) => gg.attributes.color);
          if (hasCol) for (const gg of geos) if (!gg.attributes.color) gg.setAttribute('color', new T.BufferAttribute(new Float32Array(gg.attributes.position.count * 3).fill(1), 3));
          const merged = geos.length > 1 ? K.BufferGeometryUtils.mergeGeometries(geos, false) : geos[0];
          if (!merged) continue;
          for (const o of list) o.parent.remove(o);
          const mm = new T.Mesh(merged, list[0].material); mm.castShadow = true; mm.receiveShadow = true; body.add(mm);
        }
        flag.castShadow = false;
      }
      K.group.add(grp); keep.push(grp);
      const shadow = K.contact(0, 0, 9, 3.2, 0.5, 0, 0.16);
      keep.push(shadow);
      K.mover({ type: 'box', hw: 8.2, hd: 2.5, h: 4.4 }, (t) => { const q = boatPose(t); return { x: q.x, z: q.z, angle: q.angle }; });
      A.boat = { grp, body, flag, shadow };
    }

    // ============================================================================ terrace visuals: olive-wood board, slate board, crate-lid and board ramps, cork kicker
    {
      const { a, at } = TR;
      const rrShape = (w, d, rad) => {
        const s = new T.Shape(), x0 = -w / 2, x1 = w / 2, y0 = -d / 2, y1 = d / 2;
        s.moveTo(x0 + rad, y0); s.lineTo(x1 - rad, y0); s.quadraticCurveTo(x1, y0, x1, y0 + rad); s.lineTo(x1, y1 - rad); s.quadraticCurveTo(x1, y1, x1 - rad, y1);
        s.lineTo(x0 + rad, y1); s.quadraticCurveTo(x0, y1, x0, y1 - rad); s.lineTo(x0, y0 + rad); s.quadraticCurveTo(x0, y0, x0 + rad, y0);
        return s;
      };
      const slab = (w, d, h, rad, bevel = 0.22) => {
        const g = new T.ExtrudeGeometry(rrShape(w - 2 * bevel, d - 2 * bevel, rad), { depth: h - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 6 });
        g.rotateX(-PI / 2); g.translate(0, bevel, 0);
        const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / w + 0.5, uv.getY(i) / d + 0.5);
        return g;
      };
      const olive = TX.woodTextures({ size: 512, seed: 33, planks: 1, base: 0x8e6238, dark: 0x4a2c16, light: 0xc0905a, ringFreq: 34, figure: 2.2, gap: 0, varyPlanks: 0, roughBase: 0.45 });
      for (const t of Object.values(olive)) { t.rotation = PI / 2; t.center.set(0.5, 0.5); t.wrapS = t.wrapT = T.ClampToEdgeWrapping; }
      const oliveMat = K.std({ map: olive.map, normalMap: olive.normalMap, roughnessMap: olive.roughnessMap, normalScale: V2(0.6) });
      let [x, z] = at(38);
      K.mesh(slab(56, 44, 1.6, 4), oliveMat, x, 0, z, { ry: -a });
      AO(x, z, 30, 24, 0.5, a, 0);
      // slate board with chalk notes
      const slC = canvas(512, 600, (g, w, h) => {
        const rr = K.rng(44);
        g.fillStyle = '#2e3236'; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${rr() < 0.5 ? '0,0,0' : '170,180,186'},${0.04 + rr() * 0.06})`; g.fillRect(rr() * w - 40, rr() * h, 40 + rr() * 200, 1 + rr() * 2); }
        g.fillStyle = 'rgba(244,242,232,0.85)'; g.textAlign = 'center';
        g.save(); g.translate(w / 2, h / 2); g.rotate(PI);
        g.font = 'italic 40px Georgia, serif'; g.fillText('Riesling', -40, -205); g.fillText('Pinot Gris', 20, 232);
        g.font = '24px Georgia, serif'; g.fillText('Kéierbierg · 412 m', 120, -172);
        g.strokeStyle = 'rgba(244,242,232,0.7)'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(-200, 200); g.lineTo(-120, 200); g.lineTo(-135, 190); g.moveTo(-120, 200); g.lineTo(-135, 210); g.stroke();
        g.font = '22px Georgia, serif'; g.fillText('→ Crémant', -150, 238);
        g.restore();
      });
      const slateBoard = K.std({ map: tex(slC), roughness: 0.62, metalness: 0.02 });
      const slateEdge = K.std({ color: 0x2b2f33, roughness: 0.7 });
      [x, z] = at(54);
      const sb = new T.Mesh(slab(24, 28, 1.6, 1.2, 0.15), [slateBoard, slateEdge]); sb.position.set(x, 1.6, z); sb.rotation.y = -a; K.add(sb);
      AO(x, z, 13.5, 15.5, 0.45, a, 1.6);
      // ramp 1: the slatted lid of a wine crate leaning on the olive board
      const lidC = canvas(256, 512, (g, w, h) => {
        const rr = K.rng(91);
        g.fillStyle = '#3a2a1a'; g.fillRect(0, 0, w, h);
        for (let k = 0; k < 4; k++) {
          const x0 = k * 64 + 2, gr = g.createLinearGradient(x0, 0, x0 + 60, 0); gr.addColorStop(0, '#c99c68'); gr.addColorStop(0.5, '#d9b07c'); gr.addColorStop(1, '#bb8d5a');
          g.fillStyle = gr; g.fillRect(x0, 0, 60, h);
          for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(110,70,35,${0.08 + rr() * 0.12})`; g.fillRect(x0 + rr() * 60, 0, 1, h); }
          g.fillStyle = '#6b6b6b'; for (const y of [30, h - 30]) { g.beginPath(); g.arc(x0 + 30, y, 3, 0, TAU); g.fill(); }
        }
        g.save(); g.translate(w / 2, h / 2); g.rotate(-PI / 2);
        g.fillStyle = 'rgba(60,25,20,0.78)'; g.font = '700 58px Georgia, serif'; g.textAlign = 'center'; g.fillText('VROUMBIERG', 0, -14);
        g.font = 'italic 34px Georgia, serif'; g.fillText('Crémant · Moselle', 0, 34);
        g.restore();
      });
      const lidTop = K.std({ map: tex(lidC), roughness: 0.75 });
      const lidSide = K.std({ color: 0xb68a58, roughness: 0.8 });
      const leanRamp = (d, len, hgt, base, mats, th = 0.6) => {
        const [rx, rz] = at(d);
        const grp = new T.Group();
        const m = new T.Mesh(new T.BoxGeometry(Math.hypot(len, hgt) + 0.3, th, 23.2), mats);
        m.position.y = -th / 2; grp.add(m);
        grp.position.set(rx, base + hgt / 2, rz); grp.rotation.order = 'YZX'; grp.rotation.y = -a; grp.rotation.z = Math.atan2(hgt, len);
        K.add(grp);
        AO(rx, rz, len / 2 + 1, 12.5, 0.35, a, base);
      };
      leanRamp(5, 10, 1.6, 0, [lidSide, lidSide, lidTop, lidSide, lidSide, lidSide]);
      // ramp 2: a small oak cutting board leaning on the slate
      const oakS = TX.woodTextures({ size: 256, seed: 5, planks: 2, base: 0xa0703f, dark: 0x5e3b1d, light: 0xc79a62, ringFreq: 20, gap: 0.004, roughBase: 0.55 });
      const cutTop = K.std({ map: oakS.map, normalMap: oakS.normalMap, roughness: 0.6 });
      leanRamp(37, 10, 1.6, 1.6, [lidSide, lidSide, cutTop, lidSide, lidSide, lidSide], 0.5);
      // kicker: a cork wedge at the top edge
      {
        const sh = new T.Shape(); sh.moveTo(-3, 0); sh.lineTo(3, 0); sh.lineTo(3, 0.9); sh.lineTo(2.6, 0.95); sh.closePath();
        const g = new T.ExtrudeGeometry(sh, { depth: 23, bevelEnabled: false }); g.translate(0, 0, -11.5);
        const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 8, uv.getY(i) / 8);
        [x, z] = at(63);
        K.mesh(g, corkMat, x, 3.2, z, { ry: -a });
      }
      // toothpick flags naming the varieties, stuck in the rows
      const pick = (d, side, name, col) => {
        const [px, pz] = at(d, side), y0 = gY(px, pz);
        const fc = canvas(256, 128, (g, w, h) => { g.fillStyle = '#fbf7ee'; g.fillRect(0, 0, w, h); g.fillStyle = col; g.fillRect(0, 0, w, 16); g.fillStyle = '#2b2b2b'; g.font = 'italic 700 44px Georgia, serif'; g.textAlign = 'center'; g.fillText(name, w / 2, 82); });
        K.mesh(new T.CylinderGeometry(0.1, 0.1, 6.2, 6), K.std({ color: 0xe2c79a, roughness: 0.8 }), px, y0 + 3.1, pz);
        K.mesh(new T.PlaneGeometry(3, 1.5), K.std({ map: tex(fc), roughness: 0.8, side: T.DoubleSide }), px + 1.5, y0 + 5.3, pz + 0.05, { cast: true });
      };
      pick(14, -19.5, 'Elbling', '#8aa040'); pick(30, 19.5, 'Auxerrois', '#d0a040'); pick(62, -15.6, 'Rivaner', '#6f8f34'); pick(50, 19.5, 'Pinot Noir', '#7a1f3a');
    }

    // ============================================================================ tasting props
    const labelTex = (draw) => tex(canvas(512, 256, (g, w, h) => draw(g, w, h)));
    const labels = {
      cremant: labelTex((g, w, h) => {
        g.fillStyle = '#1c2948'; g.fillRect(0, 0, w, h);
        g.strokeStyle = '#d9b45a'; g.lineWidth = 5; g.strokeRect(150, 14, 212, h - 28); g.lineWidth = 2; g.strokeRect(158, 22, 196, h - 44);
        g.fillStyle = '#d9b45a'; g.textAlign = 'center'; g.font = '18px Georgia, serif'; g.fillText('DOMAINE', 256, 56);
        g.font = '700 30px Georgia, serif'; g.fillText('VROUMBIERG', 256, 92);
        g.fillStyle = '#f4ead2'; g.font = 'italic 44px Georgia, serif'; g.fillText('Crémant', 256, 150);
        g.fillStyle = '#d9b45a'; g.font = '700 20px Georgia, serif'; g.fillText('BRUT · MOSELLE', 256, 190); g.font = '14px Georgia, serif'; g.fillText('75 cl · 12,5 % vol', 256, 220);
      }),
      riesling: labelTex((g, w, h) => {
        g.fillStyle = '#f4eedc'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#2f5a32'; g.fillRect(150, 18, 212, 6); g.fillRect(150, h - 24, 212, 6);
        g.textAlign = 'center'; g.font = '700 24px Georgia, serif'; g.fillText('Caves Kéierbierg', 256, 66);
        g.font = 'italic 46px Georgia, serif'; g.fillText('Riesling', 256, 130);
        g.fillStyle = '#7a9a3a'; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(240 + (i % 3) * 12 + Math.floor(i / 3) * 6, 156 + Math.floor(i / 3) * 11, 6, 0, TAU); g.fill(); }
        g.fillStyle = '#2f5a32'; g.font = '700 22px Georgia, serif'; g.fillText('2024', 256, 214);
      }),
      pinot: labelTex((g, w, h) => {
        g.fillStyle = '#efe0b8'; g.fillRect(0, 0, w, h);
        g.strokeStyle = '#6e1a2a'; g.lineWidth = 4; g.strokeRect(156, 16, 200, h - 32);
        g.fillStyle = '#6e1a2a'; g.textAlign = 'center'; g.font = '700 22px Georgia, serif'; g.fillText('MAISON KURVENHAFF', 256, 62);
        g.font = 'italic 44px Georgia, serif'; g.fillText('Pinot Gris', 256, 128); g.font = '20px Georgia, serif'; g.fillText('Réserve · 2023', 256, 190);
      }),
      noir: labelTex((g, w, h) => {
        g.fillStyle = '#f6f2ea'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#8a1424'; g.fillRect(150, 150, 212, 60);
        g.textAlign = 'center'; g.font = '700 22px Georgia, serif'; g.fillText('CLOS DU PETIT PNEU', 256, 64);
        g.font = 'italic 42px Georgia, serif'; g.fillStyle = '#2a1a1a'; g.fillText('Pinot Noir', 256, 122);
        g.fillStyle = '#f6f2ea'; g.font = '700 26px Georgia, serif'; g.fillText('2023', 256, 190);
      }),
    };
    const SHAPES = {
      cremant: { prof: [[0.01, 0], [4.1, 0], [4.45, 0.5], [4.5, 1.5], [4.5, 18.5], [4.3, 20.5], [3.6, 22.6], [2.4, 24.6], [1.6, 26], [1.5, 28.5], [1.7, 29], [1.7, 30.2], [1.45, 30.5], [0.01, 30.5]], r: 4.5, lab: [6, 15.5] },
      riesling: { prof: [[0.01, 0], [3.5, 0], [3.8, 0.5], [3.85, 1.5], [3.85, 16], [3.6, 19], [2.8, 22.5], [1.9, 25.5], [1.4, 28], [1.35, 32], [1.55, 32.4], [1.55, 33.4], [0.01, 33.4]], r: 3.85, lab: [5, 13] },
      noir: { prof: [[0.01, 0], [3.9, 0], [4.2, 0.5], [4.25, 1.5], [4.25, 15], [4.0, 17.5], [3.1, 21], [2.0, 24], [1.45, 26], [1.4, 29.5], [1.6, 29.9], [1.6, 30.8], [0.01, 30.8]], r: 4.25, lab: [5, 13] },
    };
    const bottleGlass = { cremant: K.phys({ color: 0x1b3220, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.4 }), riesling: K.phys({ color: 0x34552a, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.4 }), noir: K.phys({ color: 0x1f2418, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.4 }) };
    const bottle = (x, z, shape, label, { ry = 0, open = false, cap = 'foil', capMat = gold } = {}) => {
      const S = SHAPES[shape], grp = new T.Group();
      part(grp, K.lathe(S.prof, 36), bottleGlass[shape]);
      const [l0, l1] = S.lab;
      part(grp, new T.CylinderGeometry(S.r + 0.05, S.r + 0.05, l1 - l0, 40, 1, true, -PI * 0.6, PI * 1.2), K.std({ map: labels[label], roughness: 0.65 }), 0, (l0 + l1) / 2, 0);
      if (cap === 'foil') {
        const top = S.prof[S.prof.length - 2][1];
        const fp = open ? [[2.75, 23.4], [2.0, 24.6], [1.68, 26], [1.62, 27.2], [0.01, 27.2]] : [[2.75, 23.4], [2.0, 24.6], [1.68, 26], [1.58, 28.5], [1.78, 29], [1.78, top - 0.2], [1.5, top + 0.2], [0.01, top + 0.3]];
        part(grp, K.lathe(fp, 28), capMat);
      } else if (cap === 'screw') {
        const top = S.prof[S.prof.length - 1][1];
        part(grp, new T.CylinderGeometry(1.62, 1.62, 4.6, 20), K.metal(0xc9ccd0, 0.3), 0, top - 2.2, 0);
      } else if (cap === 'capsule') {
        const top = S.prof[S.prof.length - 1][1];
        part(grp, new T.CylinderGeometry(1.66, 1.66, 4.2, 20), K.phys({ color: 0x7a1424, roughness: 0.3, clearcoat: 0.8 }), 0, top - 2.0, 0);
      }
      grp.position.set(x, gY(x, z), z); grp.rotation.y = ry;
      K.add(grp);
      K.circle(x, z, S.r, 32);
      AO(x, z, S.r + 1.5, S.r + 1.5, 0.5);
      warnRoad('bottle', x, z, S.r + 2);
      return grp;
    };
    // flutes with rising bubbles
    const bubbleList = [];
    const fluteGlass = K.glass(0xffffff, 0.1, { side: T.FrontSide, envMapIntensity: 1.2 });
    fluteGlass.depthWrite = false;
    const cremantMat = K.phys({ color: 0xf0d77c, roughness: 0.06, clearcoat: 1, transparent: true, opacity: 0.6, depthWrite: false });
    const foamMat = K.phys({ color: 0xffffff, roughness: 0.4, transparent: true, opacity: 0.7, depthWrite: false });
    const flute = (x, z, fill = 19.6) => {
      const y0 = gY(x, z);
      const g = K.mesh(K.lathe([[0.01, 0], [3.3, 0], [3.4, 0.12], [3.2, 0.3], [0.55, 0.45], [0.32, 1.2], [0.3, 8.5], [0.45, 9.3], [1.2, 10.3], [2.1, 12.6], [2.55, 16], [2.6, 20], [2.55, 23], [2.43, 23], [2.48, 20], [2.43, 16], [1.98, 12.7], [1.05, 10.5], [0.2, 10.1], [0.01, 10.1]], 40), fluteGlass, x, y0, z, { cast: false });
      g.renderOrder = 3;
      const liq = K.mesh(K.lathe([[0.01, 10.15], [1.0, 10.55], [1.93, 12.75], [2.38, 16], [2.42, fill], [0.01, fill]], 32), cremantMat, x, y0, z, { cast: false });
      liq.renderOrder = 2;
      const fm = K.mesh(new T.TorusGeometry(2.25, 0.14, 6, 28), foamMat, x, y0 + fill, z, { rx: PI / 2, cast: false });
      fm.renderOrder = 2;
      for (let k = 0; k < 22; k++) {
        const stream = k < 14;
        const a = r() * TAU, rad = stream ? 0.15 : r.range(0.3, 1.6);
        const bx = stream ? (k < 7 ? 0.25 : -0.4) : Math.cos(a) * rad, bz = stream ? (k < 7 ? 0.1 : 0.3) : Math.sin(a) * rad;
        bubbleList.push({ x: x + bx, z: z + bz, y0: y0 + 10.9, y1: y0 + fill - 0.15, ph: r() * 9, sp: r.range(2.2, 3.6), s: r.range(0.07, 0.13), w: r() * 6 });
      }
      K.circle(x, z, 3.3, 24);
      AO(x, z, 4.2, 4.2, 0.4);
      // a soft golden caustic through the wine
      K.contact(x + 3.4, z + 2.6, 4.2, 2.8, 0.1, 0.6, y0 + 0.05).material.color.set(0xffb030);
      warnRoad('flute', x, z, 4);
    };
    // stemmed glass for red
    const redGlassProf = [[0.01, 0], [3.3, 0], [3.4, 0.12], [3.1, 0.3], [0.5, 0.5], [0.3, 1.3], [0.3, 7.6], [0.5, 8.3], [2.4, 9.2], [3.8, 10.8], [4.35, 13.5], [4.15, 16.5], [3.6, 19], [3.48, 19], [4.03, 16.5], [4.23, 13.5], [3.68, 10.9], [2.3, 9.4], [0.3, 8.9], [0.01, 8.9]];
    const redWine = K.phys({ color: 0x4a0612, roughness: 0.04, clearcoat: 1, transparent: true, opacity: 0.9, depthWrite: false });

    // ---------- centre of the infield: an opened crémant bottle and two poured flutes
    {
      flute(46, -16); flute(54.5, -10.5, 18.8);
      bottle(33, -21, 'cremant', 'cremant', { ry: 0.4, open: true });
      // its crémant cork with the wire cage, lying on its side
      const mush = K.lathe([[0.01, 0], [1.0, 0], [1.05, 0.3], [0.95, 2.3], [1.45, 2.4], [1.55, 3.0], [1.35, 3.6], [0.8, 3.85], [0.01, 3.9]], 24);
      const c = K.mesh(mush, corkMat, 38, 1.5, -10, { rz: PI / 2 - 0.15, ry: 0.6 });
      c.position.y = 1.45;
      K.mesh(new T.TorusGeometry(1.25, 0.08, 6, 20), steel, 41, 0.3, -6, { rx: PI / 2 });
      AO(38, -10, 3, 2.2, 0.3);
    }

    // ---------- U interior: ice bucket with crémant, a bottle of red with the corkscrew, a glass knocked over
    {
      // hammered steel ice bucket
      const hx = -70, hz = -73;
      const ham = TX.mottledTextures({ size: 256, a: 0xe8eaee, b: 0xc8ccd2, seed: 52, period: 18, bump: 9, speck: 0.1 });
      for (const t of [ham.map, ham.normalMap]) t.repeat.set(5, 2);
      const bucketMat = K.std({ map: ham.map, normalMap: ham.normalMap, normalScale: V2(0.9), metalness: 1, roughness: 0.22 });
      K.mesh(K.lathe([[0.01, 0], [8.4, 0], [8.8, 0.6], [9.6, 19.5], [10.2, 20], [10.2, 20.6], [9.7, 20.6], [9.1, 19.6], [8.3, 1.0], [0.01, 1.0]], 56), bucketMat, hx, 0, hz);
      for (const sd of [-1, 1]) K.mesh(new T.TorusGeometry(1.7, 0.28, 8, 20), steel, hx + sd * 10.1, 16.5, hz, { ry: PI / 2 });
      const iceMat = K.phys({ color: 0xe8f4fb, roughness: 0.05, transparent: true, opacity: 0.55, clearcoat: 1, depthWrite: false });
      for (let k = 0; k < 16; k++) {
        const a = r() * TAU, d = Math.sqrt(r()) * 7;
        const ic = K.mesh(new K.RoundedBoxGeometry(2.6, 2.4, 2.6, 2, 0.5), iceMat, hx + Math.cos(a) * d, 18.4 + r() * 1.6, hz + Math.sin(a) * d, { rx: r() * 3, ry: r() * 3, cast: false });
        ic.renderOrder = 2;
      }
      const bt = bottle(hx + 1.5, hz + 1, 'cremant', 'cremant', { ry: 0.3 });
      bt.position.y = 3; bt.rotation.set(0.12, 0.3, -0.18);
      K.circle(hx, hz, 10.2, 21);
      AO(hx, hz, 12, 12, 0.5);
      // droplets of condensation
      const drops = [];
      for (let k = 0; k < 70; k++) { const a = -PI * 0.15 + r() * PI * 1.1, y = 2 + r() * 16, rad = 8.85 + (y / 19.5) * 0.8; drops.push({ x: hx + Math.sin(a) * rad, y, z: hz + Math.cos(a) * rad, s: r.range(0.1, 0.22) }); }
      K.instances(new T.SphereGeometry(1, 8, 6), K.phys({ color: 0xffffff, roughness: 0.02, transparent: true, opacity: 0.45, clearcoat: 1 }), drops, { cast: false });

      // the red: bottle, pulled cork on the corkscrew, a full glass
      bottle(-80, -50, 'noir', 'noir', { ry: -0.3, cap: 'none' });
      {
        const gx = -60, gz = -42;
        const gl = K.mesh(K.lathe(redGlassProf, 40), glassMat, gx, 0, gz, { cast: false }); gl.renderOrder = 3;
        const lq = K.mesh(K.lathe([[0.01, 8.95], [2.3, 9.45], [3.66, 10.95], [4.05, 12.6], [0.01, 12.6]], 32), redWine, gx, 0, gz, { cast: false }); lq.renderOrder = 2;
        K.circle(gx, gz, 4.3, 19);
        AO(gx, gz, 4.6, 4.6, 0.4);
        K.contact(gx + 4, gz + 3.5, 5, 3.4, 0.14, 0.6).material.color.set(0x9a0a20);
      }
      // waiter's corkscrew with the cork still on its worm
      {
        const cx = -67, cz = -55, grp = new T.Group();
        part(grp, new K.RoundedBoxGeometry(11, 0.9, 1.5, 2, 0.4), K.phys({ color: 0x4a2a1a, roughness: 0.35, clearcoat: 0.8 }), 0, 0.45, 0);
        part(grp, new T.BoxGeometry(11.4, 0.5, 0.9), steel, 0, 0.5, 0);
        part(grp, new T.BoxGeometry(3.4, 0.35, 0.9), steel, 5.2, 0.55, 1.0, 0, -0.5, 0);
        const helix = []; for (let k = 0; k <= 60; k++) { const t = k / 60; helix.push(new T.Vector3(t * 5.5, 0.32 * Math.cos(t * TAU * 5), 0.32 * Math.sin(t * TAU * 5))); }
        part(grp, new T.TubeGeometry(new T.CatmullRomCurve3(helix), 120, 0.11, 6, false), steel, 0.5, 0.9, -1.1, 0, -0.95, 0.2);
        const ck = part(grp, new T.CylinderGeometry(1.2, 1.2, 4.4, 20), corkMat, 3.6, 1.25, -3.8, 0, -0.95, PI / 2 - 0.2);
        ck.rotation.order = 'YXZ';
        grp.position.set(cx, 0, cz); grp.rotation.y = 0.5;
        K.add(grp);
        K.capsule(cx - 5, cz + 2.7, cx + 5, cz - 2.7, 0.9, 1.6);
        AO(cx, cz, 7, 2.6, 0.3, -0.5);
      }
      // a round seagrass mat in the loop, under the coaster and the knocked-over glass. It drags like the runner,
      // so cutting across the loop never pays.
      {
        const { x: mx, z: mz, r: MR, t: MT } = LOOP_MAT;
        const matC = canvas(512, 512, (g, w, h) => {
          const rr = K.rng(77), cx = w / 2, cy = h / 2;
          g.fillStyle = '#8a6e3e'; g.fillRect(0, 0, w, h);
          // a coil of twisted grass: rings of slanted twists, light and dark strands
          for (let rad = 7, ring = 0; rad < w / 2 - 2; rad += 9.4, ring++) {
            const k = 0.9 + rr() * 0.18, n = Math.max(6, Math.floor((rad * TAU) / 5.2));
            g.lineWidth = 8.6; g.strokeStyle = `rgb(${(176 * k) | 0},${(146 * k) | 0},${(92 * k) | 0})`;
            g.beginPath(); g.arc(cx, cy, rad, 0, TAU); g.stroke();
            for (let i = 0; i < n; i++) {
              const a = (i / n) * TAU + ring * 0.37, ca = Math.cos(a), sa = Math.sin(a);
              const lit = 0.75 + rr() * 0.45;
              g.strokeStyle = `rgba(${(214 * lit) | 0},${(184 * lit) | 0},${(124 * lit) | 0},0.85)`; g.lineWidth = 2.2;
              g.beginPath(); g.moveTo(cx + ca * (rad - 3.6) - sa * 1.6, cy + sa * (rad - 3.6) + ca * 1.6); g.lineTo(cx + ca * (rad + 3.6) + sa * 1.6, cy + sa * (rad + 3.6) - ca * 1.6); g.stroke();
              g.strokeStyle = 'rgba(70,50,22,0.45)'; g.lineWidth = 1;
              g.beginPath(); g.moveTo(cx + ca * (rad - 3.6) - sa * 3.2, cy + sa * (rad - 3.6) + ca * 3.2); g.lineTo(cx + ca * (rad + 3.6) - sa * 0.2, cy + sa * (rad + 3.6) + ca * 0.2); g.stroke();
            }
          }
          // a darker binding stitch every few rings, a dyed blue band near the rim
          g.strokeStyle = 'rgba(42,82,160,0.55)'; g.lineWidth = 7; g.beginPath(); g.arc(cx, cy, w / 2 - 30, 0, TAU); g.stroke();
          for (let s = 0; s < 24; s++) {
            const a = (s / 24) * TAU; g.strokeStyle = 'rgba(80,55,25,0.5)'; g.lineWidth = 1.6;
            g.beginPath(); g.moveTo(cx + Math.cos(a) * 12, cy + Math.sin(a) * 12); g.lineTo(cx + Math.cos(a) * (w / 2 - 4), cy + Math.sin(a) * (w / 2 - 4)); g.stroke();
          }
        });
        const matN = TX.toTexture(TX.normalFromHeight(TX.heightFromCanvasLuma(matC), 512, 512, 2.2), { srgb: false });
        const matTop = K.std({ map: tex(matC), normalMap: matN, normalScale: V2(0.9), roughness: 0.92 });
        const matSide = K.std({ color: 0xa88654, roughness: 0.95 });
        const mm = K.mesh(new T.CylinderGeometry(MR, MR, MT, 72), [matSide, matTop, matSide], mx, MT / 2, mz, { ry: PI / 2 + 0.3, cast: false });
        mm.receiveShadow = true;
        AO(mx, mz, MR + 1.4, MR + 1.4, 0.3, 0, 0);
        K.surface('slow', { x: mx, z: mz, r: MR - 0.4 });
        warnRoad('loop mat', mx, mz, MR + 2.5);
      }
      // knocked-over glass, its wine running across the path (slick!)
      {
        const fx = -69, fz = -26, len = 19;
        const grp = new T.Group();
        const gl = part(grp, K.lathe(redGlassProf, 40), glassMat); gl.renderOrder = 3; gl.castShadow = false;
        const lq = part(grp, K.lathe([[0.01, 13], [4.0, 13], [4.1, 15.5], [0.01, 15.5]], 24), redWine, 0, 0, 0); lq.scale.set(0.45, 1, 1); lq.position.x = -2.0; lq.renderOrder = 2;
        grp.position.set(fx, 3.45 + LOOP_MAT.t, fz); grp.rotation.order = 'YZX'; grp.rotation.z = PI / 2 - 0.07; grp.rotation.y = 0.05;
        K.add(grp);
        K.capsule(fx - 1, fz, fx - len + 2, fz, 4.1, 8.5);
        AO(fx - 9, fz, 11, 4.6, 0.32, 0, LOOP_MAT.t);
        // the wine that stayed in the glass has soaked a dark stain into the mat
        K.spill(fx - 11, fz + 0.6, 3.2, K.std({ color: 0x4a1418, roughness: 0.9, transparent: true, opacity: 0.55, depthWrite: false }), { y: LOOP_MAT.t + 0.03, thick: 0.02, stretch: 1.6, n: 24 });
        const sp = track.place(sAt(-98, -27), 6.5);
        const spill = K.spill(sp.x, sp.z, 6.5, wineMat, { lump: 0.38, stretch: 1.25, angle: 0.1, y: 0.1, thick: 0.22 });
        K.surface('slick', { poly: spill.poly });
        // a trail from the glass rim to the pool
        for (let k = 1; k < 3; k++) K.spill(fx - len + 1 - k * 1.6 + r.range(-0.4, 0.4), fz + r.range(-1.2, 1.2), r.range(0.9, 1.6), wineMat, { y: 0.08, thick: 0.15, n: 18 });
        for (let k = 0; k < 8; k++) K.spill(sp.x + r.range(-10, 6), sp.z + r.range(-9, 9), r.range(0.25, 0.55), wineMat, { y: 0.06, thick: 0.1, n: 12 });
      }
      // a crémant flute in the U, standing guard
      flute(-57, -61, 18.2);
    }

    // ---------- the cheese board (east side) with a honey pot dripping onto the path
    {
      const cx = 106, cz = -4, R = 19;
      const olive2 = TX.woodTextures({ size: 512, seed: 34, planks: 1, base: 0xc59f69, dark: 0x6a482a, light: 0xe6cc98, ringFreq: 30, figure: 2, gap: 0, varyPlanks: 0, roughBase: 0.5 });
      const boardTop = K.std({ map: olive2.map, normalMap: olive2.normalMap, normalScale: V2(0.6), roughness: 0.5 });
      const boardSide = K.std({ color: 0x9a6e40, roughness: 0.6 });
      K.mesh(new T.CylinderGeometry(R, R - 0.3, 1.6, 72), [boardSide, boardTop, boardSide], cx, 0.8, cz);
      K.circle(cx, cz, R, 6);
      AO(cx, cz, R + 2, R + 2, 0.5);
      const Y = 1.6;
      // brie wheel with a wedge cut out, the wedge beside it
      const brieRind = TX.mottledTextures({ size: 128, a: 0xfbf8ef, b: 0xe6dcc3, seed: 3, period: 12, bump: 5, speck: 0.2 });
      const rind = K.std({ map: brieRind.map, normalMap: brieRind.normalMap, roughness: 0.9 });
      const paste = K.phys({ color: 0xf3e2a8, roughness: 0.35, clearcoat: 0.3 });
      const bx = cx - 6, bz = cz - 5, gap = 0.75;
      K.mesh(new T.CylinderGeometry(6.4, 6.4, 3.2, 44, 1, false, gap / 2, TAU - gap), rind, bx, Y + 1.6, bz);
      const pasteD = K.phys({ color: 0xf3e2a8, roughness: 0.35, clearcoat: 0.3, side: T.DoubleSide });
      for (const th of [gap / 2, -gap / 2]) K.mesh(new T.PlaneGeometry(6.4, 3.2), pasteD, bx + Math.sin(th) * 3.2, Y + 1.6, bz + Math.cos(th) * 3.2, { ry: th - PI / 2 });
      const wsh = new T.Shape(); wsh.moveTo(0, 0); wsh.lineTo(6.2, -2.0); wsh.lineTo(6.2, 2.0); wsh.closePath();
      const wg = new T.ExtrudeGeometry(wsh, { depth: 3.1, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.15, bevelSegments: 1 }); wg.rotateX(-PI / 2);
      K.mesh(wg, [rind, paste], bx + 2, Y, bz + 9.5, { ry: 2.2 });
      // aged hard cheese wedge with holes
      const holeC = canvas(256, 256, (g, w, h) => { g.fillStyle = '#efc95a'; g.fillRect(0, 0, w, h); const rr = K.rng(14); for (let i = 0; i < 26; i++) { const x = rr() * w, y = rr() * h, rad = 4 + rr() * 12; g.fillStyle = '#c99a2c'; g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill(); g.fillStyle = '#d9ad3f'; g.beginPath(); g.arc(x - rad * 0.2, y - rad * 0.2, rad * 0.7, 0, TAU); g.fill(); } });
      const hard = K.phys({ map: TX.toTexture(holeC), roughness: 0.5, clearcoat: 0.2 });
      const hsh = new T.Shape(); hsh.moveTo(0, -0.4); hsh.lineTo(11, -3.4); hsh.lineTo(11, 3.4); hsh.lineTo(0, 0.4); hsh.closePath();
      const hg = new T.ExtrudeGeometry(hsh, { depth: 5, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 1 }); hg.rotateX(-PI / 2);
      const huv = hg.attributes.uv; for (let i = 0; i < huv.count; i++) huv.setXY(i, huv.getX(i) / 12, huv.getY(i) / 12);
      K.mesh(hg, [hard, hard], cx + 1, Y, cz + 4, { ry: -0.5 });
      K.mesh(new T.BoxGeometry(0.5, 5.1, 7), K.std({ color: 0x9a6a2a, roughness: 0.7 }), cx + 1 + Math.cos(-0.5) * 11.2, Y + 2.55, cz + 4 - Math.sin(-0.5) * 11.2, { ry: -0.5 });
      // blue cheese
      const blueC = canvas(128, 128, (g, w, h) => { g.fillStyle = '#efe9d6'; g.fillRect(0, 0, w, h); const rr = K.rng(15); for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(${40 + rr() * 30},${70 + rr() * 30},${90 + rr() * 30},0.8)`; g.beginPath(); g.ellipse(rr() * w, rr() * h, 2 + rr() * 6, 1 + rr() * 3, rr() * 3, 0, TAU); g.fill(); } });
      const blue = K.phys({ map: TX.toTexture(blueC), roughness: 0.6 });
      const bg2 = new T.ExtrudeGeometry(wsh, { depth: 3.6, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.15, bevelSegments: 1 }); bg2.rotateX(-PI / 2);
      const buv = bg2.attributes.uv; for (let i = 0; i < buv.count; i++) buv.setXY(i, buv.getX(i) / 7, buv.getY(i) / 7);
      K.mesh(bg2, [blue, blue], cx - 12, Y, cz + 5, { ry: 0.6, scale: 1.2 });
      // crackers fanned out
      const crC = canvas(128, 128, (g, w, h) => { const gr = g.createRadialGradient(64, 64, 10, 64, 64, 64); gr.addColorStop(0, '#e8c47c'); gr.addColorStop(1, '#c8984a'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#9a6a2a'; for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) { g.beginPath(); g.arc(24 + i * 20, 24 + j * 20, 2.5, 0, TAU); g.fill(); } });
      const crackers = [];
      for (let k = 0; k < 7; k++) crackers.push({ x: cx + 4 + k * 1.1, y: Y + 0.3 + k * 0.32, z: cz - 11 + k * 0.6, rx: 0.25, rz: 0.1, ry: k * 0.1 });
      K.instances(new T.CylinderGeometry(2.3, 2.3, 0.35, 24), K.std({ map: tex(crC), roughness: 0.8 }), crackers);
      // a bunch of white grapes
      const grapeMat = K.phys({ color: 0xc9cf6a, roughness: 0.35, clearcoat: 0.4, sheen: 0.6, sheenColor: new T.Color(0xf4f8d0), transmission: 0 });
      const gl = [];
      for (let k = 0; k < 26; k++) { const t = k / 26, rad = 3.2 * (1 - t) + 0.6; const a = k * 2.4; gl.push({ x: cx + 10 + t * 9 + Math.cos(a) * rad * 0.6, y: Y + 1 + Math.sin(a) * 0.4 + (1 - t) * 0.6, z: cz + 9 + Math.sin(a) * rad, s: r.range(0.9, 1.05) }); }
      K.instances(new T.SphereGeometry(1, 14, 10), grapeMat, gl);
      K.mesh(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(cx + 8, Y + 1.6, cz + 9), new T.Vector3(cx + 14, Y + 2.0, cz + 9.4), new T.Vector3(cx + 19.5, Y + 1.6, cz + 10)]), 16, 0.18, 6), K.std({ color: 0x7a6a3a, roughness: 0.8 }), 0, 0, 0);
      // walnuts
      const nutT = TX.mottledTextures({ size: 128, a: 0xb88a52, b: 0x7a5228, seed: 19, period: 6, bump: 10 });
      const nuts = []; for (let k = 0; k < 6; k++) nuts.push({ x: cx - 4 + r.range(-2.5, 2.5), y: Y + 1.3, z: cz + 13 + r.range(-2, 2), s: r.range(1.1, 1.3), ry: r() * 6 });
      K.instances(new T.IcosahedronGeometry(1, 2), K.std({ map: nutT.map, normalMap: nutT.normalMap, normalScale: V2(1.5), roughness: 0.75 }), nuts);
      // honey pot with dipper on the east rim, honey running to the path
      const px = cx + 12.5, pz = cz - 6;
      K.mesh(K.lathe([[0.01, 0], [3.2, 0], [4.2, 0.6], [5.0, 3], [5.0, 6], [3.8, 7.6], [3.5, 8.2], [3.9, 8.7], [3.4, 8.9], [3.1, 8.3], [3.1, 1.0], [0.01, 0.9]], 36), K.ceramic(0xe2b04a, { roughness: 0.3 }), px, Y, pz);
      K.mesh(new T.CircleGeometry(3.1, 28), honeyMat, px, Y + 7.9, pz, { rx: -PI / 2 });
      const dip = new T.Group();
      part(dip, new T.CylinderGeometry(0.32, 0.32, 12, 8), K.std({ color: 0xb48a58, roughness: 0.7 }), 0, 6, 0);
      for (let k = 0; k < 4; k++) part(dip, new T.CylinderGeometry(1.0 - k * 0.1, 1.0 - k * 0.1, 0.45, 14), K.std({ color: 0xa47a48, roughness: 0.65 }), 0, 0.6 + k * 0.7, 0);
      dip.position.set(px + 0.5, Y + 4.5, pz - 0.5); dip.rotation.set(0.1, 0, -0.5); K.add(dip);
      K.circle(px, pz, 5.0, 10);
      // runs down the pot, over the board edge and onto the path
      K.spill(px + 4.8, pz - 0.5, 1.4, honeyMat, { y: Y + 0.08, thick: 0.15, n: 18, stretch: 1.6, angle: 0.1 });
      const hs = sAt(139, -16), q = track.place(hs, -6.3);
      const hon = K.spill(q.x, q.z, 4.1, honeyMat, { lump: 0.3, stretch: 1.9, angle: q.angle, y: 0.1, thick: 0.24 });
      K.surface('sticky', { poly: hon.poly });
      for (let k = 1; k < 5; k++) { const f = k / 5; K.spill(px + 5.5 + (q.x - px - 5.5) * f + r.range(-0.6, 0.6), pz + (q.z - pz) * f + r.range(-0.6, 0.6), r.range(0.6, 1.1), honeyMat, { y: 0.08, thick: 0.15, n: 16 }); }
      // cheese knife
      const kn = new T.Group();
      part(kn, new T.BoxGeometry(6.5, 0.2, 1.6), steel, 3.25, 0, 0);
      part(kn, new K.RoundedBoxGeometry(5, 0.8, 1.1, 2, 0.35), K.phys({ color: 0x2c1c14, roughness: 0.4, clearcoat: 0.6 }), -2.5, 0.2, 0);
      kn.position.set(cx - 2, Y + 0.25, cz - 13); kn.rotation.y = 0.3; K.add(kn);
      warnRoad('cheese board', cx, cz, R + 1);
    }

    // ---------- small plate of black grapes inside the north-east corner
    {
      const cx = 96, cz = -38;
      K.mesh(K.lathe([[0.01, 0], [4.5, 0], [4.8, 0.3], [5.4, 0.4], [8.2, 1.1], [8.4, 1.35], [8.1, 1.4], [5.2, 0.85], [0.01, 0.8]], 48), ivory, cx, 0, cz);
      K.circle(cx, cz, 8.3, 1.8);
      AO(cx, cz, 9, 9, 0.4);
      const gl = [];
      for (let k = 0; k < 22; k++) { const t = k / 22, rad = 2.8 * (1 - t) + 0.5, a = k * 2.4; gl.push({ x: cx - 3 + t * 8 + Math.cos(a) * rad * 0.5, y: 1.9 + Math.sin(a) * 0.4 + (1 - t) * 0.5, z: cz + Math.sin(a) * rad, s: r.range(0.88, 1.0) }); }
      K.instances(new T.SphereGeometry(1, 14, 10), K.phys({ color: 0x3a1a3e, roughness: 0.45, sheen: 0.8, sheenColor: new T.Color(0x9a8ab8), clearcoat: 0.3 }), gl);
    }

    // ---------- bread board in the west pocket: a country loaf, slices, a knife, crumbs
    {
      const cx = -126, cz = -6;
      const oakB = TX.woodTextures({ size: 256, seed: 7, planks: 3, base: 0xb68650, dark: 0x6e4826, light: 0xd8ad78, ringFreq: 18, gap: 0.005, roughBase: 0.6 });
      for (const t of Object.values(oakB)) t.repeat.set(1, 1.4);
      const bb = K.mesh(new K.RoundedBoxGeometry(23, 1.5, 34, 2, 0.5), K.std({ map: oakB.map, normalMap: oakB.normalMap, roughness: 0.65 }), cx, 0.75, cz, { ry: 0.08 });
      bb.receiveShadow = true;
      K.box(cx, cz, 11.5, 17, -0.08, 1.5);
      AO(cx, cz, 13.5, 19, 0.45, -0.08);
      const crustC = canvas(256, 256, (g, w, h) => {
        const rr = K.rng(26);
        const gr = g.createRadialGradient(128, 128, 20, 128, 128, 160); gr.addColorStop(0, '#c8873e'); gr.addColorStop(1, '#8a5222');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
        speckle(g, w, h, rr, 900, 0.04, 0.1, 4);
        g.strokeStyle = '#e8c992'; g.lineWidth = 9; g.beginPath(); g.moveTo(60, 70); g.quadraticCurveTo(128, 120, 196, 70); g.stroke(); g.beginPath(); g.moveTo(60, 186); g.quadraticCurveTo(128, 136, 196, 186); g.stroke();
        for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(250,245,235,${0.15 + rr() * 0.3})`; g.fillRect(rr() * w, rr() * h, 2, 2); }
      });
      const crust = K.phys({ map: TX.toTexture(crustC), roughness: 0.7, clearcoat: 0.15 });
      const loaf = K.mesh(new T.SphereGeometry(1, 40, 24, 0, TAU, 0, PI * 0.62), crust, cx - 1, 1.5, cz - 7);
      loaf.scale.set(10.5, 7.2, 10.5);
      K.circle(cx - 1, cz - 7, 10, 9);
      const crumbC = canvas(128, 128, (g, w, h) => { g.fillStyle = '#f1e2c2'; g.fillRect(0, 0, w, h); const rr = K.rng(27); for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(160,120,70,${0.2 + rr() * 0.3})`; g.beginPath(); g.ellipse(rr() * w, rr() * h, 1 + rr() * 3, 1 + rr() * 2, rr() * 3, 0, TAU); g.fill(); } g.strokeStyle = '#8a5222'; g.lineWidth = 10; g.beginPath(); g.arc(64, 64, 59, 0, TAU); g.stroke(); });
      const crumbMat = K.std({ map: tex(crumbC), roughness: 0.9 });
      for (let k = 0; k < 3; k++) {
        const s = K.mesh(new T.CylinderGeometry(1, 1, 1, 30), [crust, crumbMat, crumbMat], cx + 2 + k * 1.5, 1.5 + 0.6 + k * 0.9, cz + 7 + k * 2.2, { rx: 0.08, rz: -0.12, ry: 0.2 });
        s.scale.set(8.5, 1.0, 6.2);
      }
      // serrated bread knife
      const kn = new T.Group();
      part(kn, new T.BoxGeometry(17, 0.22, 2.3), steel, 8.5, 0, 0);
      part(kn, new K.RoundedBoxGeometry(9, 1.1, 1.6, 2, 0.5), K.phys({ color: 0x3a2418, roughness: 0.4, clearcoat: 0.6 }), -4.5, 0.25, 0);
      kn.position.set(cx + 8, 1.75, cz + 9); kn.rotation.y = 1.75; K.add(kn);
      const crumbs = [];
      for (let k = 0; k < 70; k++) { const x = cx + r.gauss() * 9, z = cz + 6 + r.gauss() * 10; crumbs.push({ x, y: gY(x, z) + (Math.abs(x - cx) < 11 && Math.abs(z - cz) < 16 ? 1.65 : 0.15), z, s: r.range(0.15, 0.45), rx: r() * 6, ry: r() * 6, color: r.pick([0xe8d2a6, 0xc8873e, 0xf1e2c2, 0xa86a2a]) }); }
      K.instances(new T.DodecahedronGeometry(1, 0), K.std({ color: 0xffffff, roughness: 0.9 }), crumbs, { colors: true, cast: false });
      warnRoad('bread board', cx, cz, 12);
    }

    // ---------- tasting card, pencil and a striped linen napkin between the U and the start straight
    {
      const cardC = canvas(640, 448, (g, w, h) => {
        g.fillStyle = '#fbf8f0'; g.fillRect(0, 0, w, h);
        g.strokeStyle = '#8a6a3a'; g.lineWidth = 3; g.strokeRect(14, 14, w - 28, h - 28);
        g.fillStyle = '#2a2a2a'; g.textAlign = 'center'; g.font = 'italic 700 40px Georgia, serif'; g.fillText('Dégustation', w / 2, 66);
        g.font = '20px Georgia, serif'; g.fillStyle = '#7a5a2a'; g.fillText('GRAND DUCHY CUP · CRÉMANT CURVES', w / 2, 98);
        g.textAlign = 'left'; g.font = '24px Georgia, serif'; g.fillStyle = '#2a2a2a';
        const rowsT = [['Crémant Brut — Vroumbierg', '★★★'], ['Riesling — Kéierbierg', '★★☆'], ['Pinot Gris — Kurvenhaff', '★★★'], ['Elbling — Petit Pneu', '★☆☆'], ['Auxerrois — Kéierbierg', '★★☆']];
        rowsT.forEach(([n, st], i) => { const y = 150 + i * 52; g.fillText(n, 40, y); g.fillStyle = '#b8862a'; g.fillText(st, 520, y); g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(40, y + 14, w - 80, 1.5); g.fillStyle = '#2a2a2a'; });
        g.strokeStyle = '#3a4a8a'; g.lineWidth = 3; g.beginPath(); g.moveTo(480, 140); g.quadraticCurveTo(500, 128, 510, 150); g.stroke();
        g.beginPath(); g.ellipse(560, 300, 30, 18, -0.2, 0, TAU); g.stroke();
      });
      const card = K.mesh(new T.PlaneGeometry(21, 14.7), K.std({ map: tex(cardC), roughness: 0.85 }), -70, 0.06, 28.5, { rx: -PI / 2, cast: false });
      card.rotation.z = 0.06;
      // pencil
      const pg = new T.Group();
      part(pg, new T.CylinderGeometry(0.42, 0.42, 13, 6), K.phys({ color: 0x2f6b3a, roughness: 0.4, clearcoat: 0.6 }), 0, 0, 0, 0, 0, PI / 2);
      part(pg, new T.ConeGeometry(0.42, 1.6, 6), K.std({ color: 0xe0c08a, roughness: 0.8 }), -7.3, 0, 0, 0, 0, PI / 2);
      part(pg, new T.ConeGeometry(0.14, 0.55, 6), K.std({ color: 0x2a2a2a, roughness: 0.5 }), -8.25, 0, 0, 0, 0, PI / 2);
      part(pg, new T.CylinderGeometry(0.44, 0.44, 0.9, 10), gold, 6.9, 0, 0, 0, 0, PI / 2);
      part(pg, new T.CylinderGeometry(0.42, 0.42, 0.9, 10), K.std({ color: 0xe88a8a, roughness: 0.8 }), 7.7, 0, 0, 0, 0, PI / 2);
      pg.position.set(-52, 0.45, 24); pg.rotation.y = 0.5; K.add(pg);
      K.capsule(-52 - 7 * Math.cos(0.5), 24 + 7 * Math.sin(0.5), -52 + 7 * Math.cos(0.5), 24 - 7 * Math.sin(0.5), 0.5, 0.9);
      AO(-70, 28.5, 12, 8.5, 0.15, -0.06);
      // linen napkin
      const napC = canvas(256, 256, (g, w, h) => { g.fillStyle = '#f2ede2'; g.fillRect(0, 0, w, h); for (let i = 0; i < w; i += 3) { g.fillStyle = 'rgba(0,0,0,0.04)'; g.fillRect(i, 0, 1, h); g.fillRect(0, i, w, 1); } g.fillStyle = '#2f5fae'; g.fillRect(0, 22, w, 8); g.fillRect(0, h - 30, w, 8); g.fillRect(22, 0, 8, h); g.fillRect(w - 30, 0, 8, h); });
      K.mesh(new K.RoundedBoxGeometry(15, 0.9, 15, 2, 0.4), K.std({ map: tex(napC), roughness: 0.95 }), -110, 0.45, 18, { ry: 0.3 });
      AO(-110, 18, 9, 9, 0.3, 0.3);
      K.box(-110, 18, 7.5, 7.5, -0.3, 0.9);
    }

    // ---------- crémant bottle, Riesling and Pinot Gris at the north edge; a wine crate
    {
      bottle(-92, -84, 'riesling', 'riesling', { ry: 0.2, cap: 'screw' });
      bottle(-46, -84, 'riesling', 'pinot', { ry: -0.25, cap: 'capsule' });
      bottle(124, -83, 'cremant', 'cremant', { ry: 0.6 });
      // wooden wine crate with bottles bedded in wood wool, north of the U entry
      const cx = -12, cz = -82, ang = 0.04;
      const crC = canvas(512, 160, (g, w, h) => {
        g.fillStyle = '#c99c68'; g.fillRect(0, 0, w, h);
        const rr = K.rng(93); for (let i = 0; i < 80; i++) { g.fillStyle = `rgba(110,70,35,${0.08 + rr() * 0.12})`; g.fillRect(0, rr() * h, w, 1); }
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 52, w, 3); g.fillRect(0, 106, w, 3);
        g.fillStyle = 'rgba(60,25,20,0.8)'; g.textAlign = 'center'; g.font = '700 54px Georgia, serif'; g.fillText('VROUMBIERG', w / 2, 92);
        g.font = 'italic 26px Georgia, serif'; g.fillText('Crémant · Moselle', w / 2, 138);
      });
      const crSide = K.std({ map: tex(crC), roughness: 0.8 });
      const crPlain = K.std({ color: 0xc19462, roughness: 0.8 });
      const grp = new T.Group();
      const Wc = 32, Dc = 15, Hc = 9, th = 0.9;
      part(grp, new T.BoxGeometry(Wc, 0.8, Dc), crPlain, 0, 0.4, 0);
      part(grp, new T.BoxGeometry(Wc, Hc, th), [crPlain, crPlain, crPlain, crPlain, crSide, crPlain], 0, Hc / 2, Dc / 2 - th / 2);
      part(grp, new T.BoxGeometry(Wc, Hc, th), crPlain, 0, Hc / 2, -Dc / 2 + th / 2);
      for (const sd of [-1, 1]) part(grp, new T.BoxGeometry(th, Hc, Dc), crPlain, sd * (Wc / 2 - th / 2), Hc / 2, 0);
      const wool = TX.mottledTextures({ size: 128, a: 0xe2c690, b: 0xb8945a, seed: 29, period: 32, bump: 8, speck: 0.4 });
      part(grp, new T.BoxGeometry(Wc - 2 * th, 0.6, Dc - 2 * th), K.std({ map: wool.map, normalMap: wool.normalMap, roughness: 0.95 }), 0, 5.6, 0);
      for (let k = 0; k < 3; k++) {
        const b = new T.Group();
        part(b, K.lathe(SHAPES.cremant.prof, 28), bottleGlass.cremant);
        part(b, K.lathe([[2.75, 23.4], [2.0, 24.6], [1.68, 26], [1.58, 28.5], [1.78, 29], [1.78, 30.3], [1.5, 30.7], [0.01, 30.8]], 20), gold);
        b.rotation.z = k % 2 ? PI / 2 : -PI / 2; b.position.set(k % 2 ? 14 : -14, 4.9, -4.5 + k * 4.5); b.scale.setScalar(0.92);
        grp.add(b);
      }
      grp.position.set(cx, 0, cz); grp.rotation.y = -ang; K.add(grp);
      K.box(cx, cz, Wc / 2, Dc / 2, ang, Hc + 2);
      AO(cx, cz, Wc / 2 + 2, Dc / 2 + 2, 0.45, ang);
      warnRoad('crate', cx, cz + Dc / 2, 1);
    }

    // ---------- real vine leaves laid on the table as decoration
    {
      const leafC = (base, vein) => canvas(256, 256, (g, w, h) => {
        g.clearRect(0, 0, w, h);
        g.save(); g.translate(128, 150);
        g.fillStyle = base; g.beginPath();
        const lobes = [[0, -128, 42], [-92, -70, 38], [92, -70, 38], [-104, 26, 30], [104, 26, 30]];
        for (const [x, y, rad] of lobes) { g.moveTo(0, 0); g.ellipse(x * 0.75, y * 0.75, rad * 1.25, rad * 1.5, Math.atan2(y, x) + PI / 2, 0, TAU); }
        g.fill();
        g.beginPath(); g.arc(0, -28, 74, 0, TAU); g.fill();
        g.strokeStyle = vein; g.lineWidth = 3;
        for (const [x, y] of lobes) { g.beginPath(); g.moveTo(0, 8); g.lineTo(x * 0.85, y * 0.85); g.stroke(); }
        g.lineWidth = 5; g.beginPath(); g.moveTo(0, 8); g.lineTo(0, 60); g.stroke();
        g.restore();
      });
      const leafMats = [['#6f9a36', '#a8c66a'], ['#c9a63a', '#e8d080'], ['#b0502a', '#e09060']].map(([b, v]) => K.std({ map: tex(leafC(b, v)), alphaTest: 0.5, side: T.DoubleSide, roughness: 0.6 }));
      for (const [x, z, s, m, ry] of [[85, 4, 15, 0, 0.6], [100, 14, 12, 2, 2.1], [-58, -80, 14, 1, -0.4], [-125, -38, 12, 0, 1.2], [24, -30, 12, 2, 2.6], [-44, -70, 11, 0, 0.3]]) {
        const lf = K.mesh(new T.PlaneGeometry(s, s), leafMats[m], x, 0.08 + r() * 0.04, z, { rx: -PI / 2, cast: false });
        lf.rotation.z = ry;
        warnRoad('leaf', x, z, s / 2);
      }
      // a bunch of black grapes resting on a leaf, a few berries rolled away
      {
        const gx = -25, gz = -10, ga = 0.12, ca = Math.cos(ga), sa = Math.sin(ga), rr = K.rng(88);
        const lf = K.mesh(new T.PlaneGeometry(18, 18), leafMats[0], gx + 4, 0.09, gz + 0.5, { rx: -PI / 2, cast: false });
        lf.rotation.z = 1.9;
        const berries = [];
        for (let u = 0.6; u < 13; u += 1.5) {
          const R = 3.8 * Math.pow(1 - u / 13, 0.7) + 0.7, n = Math.max(1, Math.round((PI * R) / 1.7));
          for (let k = 0; k <= n; k++) {
            const a = (k / n) * PI + (rr() - 0.5) * 0.3, lx = u + (rr() - 0.5) * 0.5, lw = R * Math.cos(a);
            berries.push({ x: gx + ca * lx - sa * lw, y: 1.05 + R * Math.sin(a) * 0.8, z: gz + sa * lx + ca * lw, s: 0.9 + rr() * 0.2, ry: rr() * 6 });
          }
        }
        for (const [ox, oz] of [[15.5, 4.5], [17.2, -2.5], [9.5, 5.8]]) berries.push({ x: gx + ox, y: 1.0, z: gz + oz, s: 0.98 });
        K.instances(new T.SphereGeometry(1, 14, 10), K.phys({ color: 0x3a1a3e, roughness: 0.42, sheen: 0.8, sheenColor: new T.Color(0x9a8ab8), clearcoat: 0.35 }), berries);
        // the woody stalk, sticking up out of the wide end
        const stalk = new T.CatmullRomCurve3([new T.Vector3(gx + 1.5, 3.4, gz), new T.Vector3(gx - 0.6, 4.6, gz + 0.3), new T.Vector3(gx - 2.4, 5.0, gz + 1.0), new T.Vector3(gx - 3.6, 4.4, gz + 1.8)]);
        K.mesh(new T.TubeGeometry(stalk, 12, 0.28, 6), K.std({ color: 0x6a5232, roughness: 0.8 }), 0, 0, 0);
        K.circle(gx + ca * 5, gz + sa * 5, 5.2, 5);
        AO(gx + ca * 5.5, gz + sa * 5.5, 8, 5.2, 0.4, ga);
        warnRoad('grape bunch', gx + ca * 5, gz + sa * 5, 7);
      }
    }

    // ---------- a glass of Riesling inside the south-east sweeper, a coaster with a crémant cork inside the U
    {
      const coasterC = canvas(128, 128, (g, w, h) => {
        const rr = K.rng(64); g.fillStyle = '#c99c68'; g.fillRect(0, 0, w, h); speckle(g, w, h, rr, 700, 0.06, 0.12, 2);
        g.strokeStyle = 'rgba(90,10,25,0.45)'; g.lineWidth = 7; g.beginPath(); g.arc(70, 60, 34, 0.4, 5.6); g.stroke();
      });
      const coasterMat = K.std({ map: tex(coasterC), normalMap: corkT.normalMap, roughness: 0.92 });
      const coaster = (x, z) => { K.mesh(new T.CylinderGeometry(5, 5, 0.5, 40), [corkMat, coasterMat, corkMat], x, 0.25, z); AO(x, z, 5.6, 5.6, 0.3); };
      coaster(86, 18);
      const gx = 86, gz = 18, rieslingWine = K.phys({ color: 0xf2df8a, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.55, depthWrite: false });
      const gl = K.mesh(K.lathe(redGlassProf, 40), glassMat, gx, 0.5, gz, { cast: false }); gl.renderOrder = 3;
      const lq = K.mesh(K.lathe([[0.01, 8.95], [2.3, 9.45], [3.66, 10.95], [4.12, 13.2], [0.01, 13.2]], 32), rieslingWine, gx, 0.5, gz, { cast: false }); lq.renderOrder = 2;
      K.circle(gx, gz, 4.4, 19.5);
      K.contact(gx + 4.2, gz + 3.4, 5, 3.4, 0.12, 0.6).material.color.set(0xffc040);
      warnRoad('riesling glass', gx, gz, 5);
      // on the seagrass mat in the loop
      const cy0 = LOOP_MAT.t;
      K.mesh(new T.CylinderGeometry(5, 5, 0.5, 40), [corkMat, coasterMat, corkMat], -72, cy0 + 0.25, -9);
      AO(-72, -9, 5.6, 5.6, 0.3, 0, cy0);
      const mush = K.lathe([[0.01, 0], [1.0, 0], [1.05, 0.3], [0.95, 2.3], [1.45, 2.4], [1.55, 3.0], [1.35, 3.6], [0.8, 3.85], [0.01, 3.9]], 24);
      K.mesh(mush, corkMat, -72, cy0 + 0.5, -9);
      K.mesh(new T.CylinderGeometry(0.95, 0.95, 0.12, 20), gold, -72, cy0 + 4.42, -9);
      K.mesh(new T.TorusGeometry(1.25, 0.08, 6, 20), steel, -66.5, cy0 + 0.1, -13, { rx: PI / 2 });
      K.circle(-72, -9, 5, 1.2);
      warnRoad('coaster', -72, -9, 5.5);
    }

    // ---------- the S-bend infield: a decanter of red with its stopper, a printed aroma wheel
    {
      const dx = -12, dz = -25;
      const prof = [[0.01, 0], [8.0, 0], [8.6, 0.35], [8.75, 1.5], [8.4, 3.6], [7.1, 5.6], [4.8, 8.0], [2.8, 11], [1.8, 15], [1.6, 21], [1.7, 23.2], [2.25, 24.7], [2.3, 25.1], [2.1, 25.1], [1.55, 23.3], [1.45, 21], [1.65, 15], [2.62, 11], [4.6, 8.0], [6.9, 5.5], [8.15, 3.5], [8.5, 1.5], [8.4, 0.7], [0.01, 0.6]];
      const decGlass = K.glass(0xeef4f0, 0.12, { side: T.FrontSide, envMapIntensity: 0.7, clearcoat: 0.8 });
      const dg = K.mesh(K.lathe(prof, 56), decGlass, dx, 0, dz, { cast: false }); dg.renderOrder = 3;
      K.mesh(K.lathe([[0.01, 0.62], [8.38, 0.62], [8.45, 1.5], [8.1, 3.5], [6.85, 5.5], [4.55, 8.0], [4.0, 8.6], [0.01, 8.6]], 48), K.phys({ color: 0x3c0410, roughness: 0.12, clearcoat: 0.7, clearcoatRoughness: 0.08 }), dx, 0, dz, { cast: false });
      K.circle(dx, dz, 8.75, 25);
      AO(dx, dz, 10.2, 10.2, 0.45);
      K.contact(dx + 7.5, dz + 5.5, 9.5, 6, 0.16, 0.6).material.color.set(0x9a0a20);
      warnRoad('decanter', dx, dz, 10);
      // the glass stopper, lying on its side
      const st = new T.Group();
      part(st, new T.SphereGeometry(1.9, 20, 14), glassMat).renderOrder = 3;
      part(st, new T.CylinderGeometry(0.9, 1.15, 3.2, 16), glassMat, 0, -2.6, 0).renderOrder = 3;
      st.position.set(dx + 11, 1.9, dz + 3); st.rotation.set(0, 0.7, PI / 2 + 0.1); K.add(st, { cast: false });
      AO(dx + 11.8, dz + 2.5, 3.4, 2.2, 0.3, -0.7);
      K.circle(dx + 11, dz + 3, 2, 3.8);
      // a few drops of red beside it
      for (const [ox, oz, rad] of [[-9.8, 4, 0.7], [-11.4, 6.3, 0.4], [-7, 8.9, 0.5]]) K.spill(dx + ox, dz + oz, rad, wineMat, { y: 0.06, thick: 0.08, n: 14 });

      // a paper aroma wheel ("roue des arômes"), printed in families of colour
      const mix = (hex, t) => { const c = new T.Color(hex).lerp(new T.Color(0xffffff), t); return `rgb(${(c.r * 255) | 0},${(c.g * 255) | 0},${(c.b * 255) | 0})`; };
      const awC = canvas(1024, 1024, (g, w, h) => {
        const cx = w / 2, cy = h / 2;
        g.fillStyle = '#f7f2e6'; g.fillRect(0, 0, w, h);
        const fam = [['FRUITÉ', 0xb8203a, ['Pomme', 'Poire', 'Pêche', 'Coing']], ['AGRUMES', 0xd9a414, ['Citron', 'Pamplemousse', 'Orange']], ['FLORAL', 0xc8508e, ['Acacia', 'Tilleul', 'Rose']], ['VÉGÉTAL', 0x4e8c34, ['Herbe', 'Foin', 'Menthe']], ['ÉPICÉ', 0xc85e1e, ['Poivre', 'Cannelle', 'Vanille']], ['GRILLÉ', 0x744424, ['Brioche', 'Noisette', 'Toast']], ['MINÉRAL', 0x4f6f8c, ['Silex', 'Ardoise', 'Craie']]];
        const R0 = 96, R1 = 250, R2 = 400, R3 = 498, n = fam.length;
        const ring = (r0, r1, a0, a1, fill) => { g.fillStyle = fill; g.beginPath(); g.arc(cx, cy, r1, a0, a1); g.arc(cx, cy, r0, a1, a0, true); g.closePath(); g.fill(); g.strokeStyle = '#f7f2e6'; g.lineWidth = 3; g.stroke(); };
        const label = (txt, r, a, size, col, bold = false) => {
          g.save(); g.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
          const flip = Math.cos(a) < -0.01; g.rotate(flip ? a + PI : a);
          g.fillStyle = col; g.font = `${bold ? '700 ' : ''}${size}px Rubik, Arial`; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText(txt, 0, 0); g.restore();
        };
        fam.forEach(([name, col, subs], i) => {
          const a0 = (i / n) * TAU - PI / 2, a1 = ((i + 1) / n) * TAU - PI / 2;
          ring(R0, R1, a0, a1, mix(col, 0));
          subs.forEach((s, j) => {
            const b0 = a0 + ((a1 - a0) * j) / subs.length, b1 = a0 + ((a1 - a0) * (j + 1)) / subs.length;
            ring(R1, R2, b0, b1, mix(col, 0.3 + 0.12 * j));
            for (let q = 0; q < 2; q++) ring(R2, R3, b0 + ((b1 - b0) * q) / 2, b0 + ((b1 - b0) * (q + 1)) / 2, mix(col, 0.55 + 0.15 * q));
            label(s, (R1 + R2) / 2, (b0 + b1) / 2, s.length > 9 ? 22 : 28, '#2a2018');
          });
          label(name, (R0 + R1) / 2, (a0 + a1) / 2, 34, '#ffffff', true);
        });
        g.fillStyle = '#2a2a2a'; g.beginPath(); g.arc(cx, cy, R0 - 4, 0, TAU); g.fill();
        g.fillStyle = '#e2c27a'; g.font = '700 30px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ARÔMES', cx, cy - 12);
        g.font = 'italic 20px Georgia, serif'; g.fillText('de la Moselle', cx, cy + 20);
      });
      const awTop = K.std({ map: tex(awC), roughness: 0.82 });
      const awx = 9, awz = -34;
      K.mesh(new T.CylinderGeometry(10.5, 10.5, 0.14, 72), [K.std({ color: 0xece4d2, roughness: 0.85 }), awTop, awTop], awx, 0.07, awz, { ry: PI / 2 - 0.22, cast: false });
      AO(awx, awz, 11.2, 11.2, 0.16);
      warnRoad('aroma wheel', awx, awz, 11);
    }

    // ---------- east infield: a Riesling pie (pastry with a golden jelly) on a plate, one slice served
    {
      const prof = [[0.01, 0], [7.2, 0], [7.6, 0.4], [7.8, 2.4], [7.4, 3.6], [6.5, 4.1], [4.6, 4.45], [3, 4.6], [1.6, 4.65], [1.3, 4.4], [0.01, 4.3]];
      const pastryC = canvas(512, 256, (g, w, h) => {
        const rr = K.rng(101), vy = (v) => (1 - v) * h;
        const gr = g.createLinearGradient(0, h, 0, 0);
        gr.addColorStop(0, '#e2b56c'); gr.addColorStop(0.28, '#d9a456'); gr.addColorStop(0.36, '#b4682c'); gr.addColorStop(0.5, '#c17a34'); gr.addColorStop(0.8, '#cc8a3e'); gr.addColorStop(0.84, '#4a2a14'); gr.addColorStop(1, '#5a3418');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
        // crimped rim
        for (let i = 0; i < 64; i++) { const x = (i / 64) * w; g.fillStyle = 'rgba(90,45,15,0.35)'; g.fillRect(x, vy(0.5), 2.5, vy(0.3) - vy(0.5)); g.fillStyle = 'rgba(255,225,160,0.25)'; g.fillRect(x + 3, vy(0.48), 2, vy(0.32) - vy(0.48)); }
        // scored rays and a leaf pattern on the lid
        for (let i = 0; i < 16; i++) { const x = (i / 16) * w + 8; g.strokeStyle = 'rgba(110,55,20,0.45)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, vy(0.52)); g.lineTo(x + 6, vy(0.79)); g.stroke(); }
        for (let i = 0; i < 8; i++) { const x = (i / 8) * w + 20; g.fillStyle = 'rgba(232,180,100,0.7)'; g.beginPath(); g.ellipse(x, vy(0.66), 14, 7, 0.3, 0, TAU); g.fill(); g.strokeStyle = 'rgba(120,60,20,0.5)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - 12, vy(0.66) + 3); g.lineTo(x + 12, vy(0.66) - 3); g.stroke(); }
        speckle(g, w, h, rr, 900, 0.04, 0.08, 3);
      });
      const pastry = K.phys({ map: tex(pastryC), roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.45 });
      const P8 = (r0, h0) => [(r0 / 8) * 256, (1 - h0 / 5) * 160];
      const cutC = canvas(256, 160, (g) => {
        const rr = K.rng(102);
        g.fillStyle = '#d9a456'; g.beginPath(); prof.forEach(([r0, h0], i) => { const [x, y] = P8(r0, h0); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.lineTo(...P8(0, 0)); g.fill();
        const fill = [[0, 0.5], [7.05, 0.5], [7.2, 2.3], [6.85, 3.15], [6.1, 3.55], [4.4, 3.85], [1.6, 3.95], [0, 3.8]];
        g.fillStyle = '#b97a5c'; g.beginPath(); fill.forEach(([r0, h0], i) => { const [x, y] = P8(r0, h0); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.fill();
        for (let i = 0; i < 160; i++) { const r0 = rr() * 6.8, h0 = 0.7 + rr() * 2.4; const [x, y] = P8(r0, h0); g.fillStyle = rr() < 0.5 ? 'rgba(240,210,190,0.6)' : 'rgba(130,70,45,0.5)'; g.beginPath(); g.ellipse(x, y, 1 + rr() * 3, 1 + rr() * 2, rr() * 3, 0, TAU); g.fill(); }
        // golden Riesling jelly under the lid
        g.strokeStyle = 'rgba(236,196,92,0.95)'; g.lineWidth = 9; g.beginPath();
        [[0, 3.55], [1.6, 3.7], [4.4, 3.6], [6.0, 3.3], [6.8, 2.95]].forEach(([r0, h0], i) => { const [x, y] = P8(r0, h0); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.stroke();
      });
      const cutMat = K.std({ map: tex(cutC), roughness: 0.6, side: T.DoubleSide });
      const cutFace = () => {
        const s = new T.Shape(); prof.forEach(([r0, h0], i) => (i ? s.lineTo(r0, h0) : s.moveTo(r0, h0)));
        const g = new T.ShapeGeometry(s), uv = g.attributes.uv, p = g.attributes.position;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 8, p.getY(i) / 5);
        return g;
      };
      const pieOf = (phi0, phiL) => {
        const grp = new T.Group();
        part(grp, new T.LatheGeometry(prof.map(([r0, h0]) => V2(r0, h0)), 48, phi0, phiL), pastry);
        for (const ph of [phi0, phi0 + phiL]) part(grp, cutFace(), cutMat, 0, 0, 0, 0, ph - PI / 2, 0);
        return grp;
      };
      const plateProf = [[0.01, 0], [6.5, 0], [6.8, 0.3], [7.4, 0.42], [10.2, 1.25], [10.45, 1.5], [10.15, 1.55], [7.2, 0.95], [0.01, 0.9]];
      const px = 79, pz = -19;
      K.mesh(K.lathe(plateProf, 56), ivory, px, 0, pz);
      const pie = pieOf(0.42, TAU - 0.84); pie.position.set(px, 0.9, pz); pie.rotation.y = 0.35; K.add(pie);
      K.circle(px, pz, 10.45, 6);
      AO(px, pz, 11.6, 11.6, 0.42);
      warnRoad('pie', px, pz, 11.5);
      // the served slice on a small plate with a pastry fork
      const sx = 62, sz = -29;
      K.mesh(K.lathe(plateProf.map(([r0, h0]) => [r0 * 0.62, h0 * 0.8]), 48), ivory, sx, 0, sz);
      const sl = pieOf(-0.4, 0.8), sa = PI / 2 + 0.25; sl.position.set(sx - Math.sin(sa) * 4.4, 0.75, sz - Math.cos(sa) * 4.4); sl.rotation.y = sa; K.add(sl);
      const fork = new T.Group();
      part(fork, new T.BoxGeometry(5.2, 0.16, 0.55), steel, -2.4, 0, 0);
      part(fork, new T.BoxGeometry(1.4, 0.16, 1.1), steel, 0.6, 0, 0);
      for (const o of [-0.4, 0, 0.4]) part(fork, new T.BoxGeometry(1.8, 0.14, 0.18), steel, 2.2, 0, o);
      fork.position.set(sx + 0.5, 0.98, sz + 4.6); fork.rotation.set(0, -0.08, 0.03); K.add(fork);
      K.circle(sx, sz, 6.5, 4.5);
      AO(sx, sz, 7.4, 7.4, 0.4);
      warnRoad('slice plate', sx, sz, 7);
      // pastry flakes around the plates
      const flakes = [];
      for (let k = 0; k < 40; k++) {
        const near = k < 26, a = r() * TAU, d = near ? r.range(10.8, 15) : r.range(6.7, 10);
        const x = (near ? px : sx) + Math.cos(a) * d, z = (near ? pz : sz) + Math.sin(a) * d * 0.8;
        flakes.push({ x, y: 0.12, z, s: r.range(0.14, 0.38), rx: r() * 6, ry: r() * 6, color: r.pick([0xe2b56c, 0xc17a34, 0xd9a456, 0xf0d29a]) });
      }
      K.instances(new T.DodecahedronGeometry(1, 0), K.std({ color: 0xffffff, roughness: 0.85 }), flakes, { colors: true, cast: false });
    }

    // ---------- pushable corks and grapes
    {
      const corkGeo = new T.CylinderGeometry(1.2, 1.2, 4.4, 22); corkGeo.rotateZ(PI / 2);
      const stain = K.std({ color: 0x5a1020, roughness: 0.7 });
      const mush = K.lathe([[0.01, 0], [1.0, 0], [1.05, 0.3], [0.95, 2.3], [1.45, 2.4], [1.55, 3.0], [1.35, 3.6], [0.8, 3.85], [0.01, 3.9]], 24);
      const lyingCork = (x, z, ry) => {
        const g = new T.Group();
        const c = new T.Mesh(corkGeo, corkMat); g.add(c);
        const st = new T.Mesh(new T.CircleGeometry(1.16, 22), stain); st.rotation.y = PI / 2; st.position.x = 2.21; g.add(st);
        g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        g.position.set(x, 1.2, z); g.rotation.y = ry;
        K.group.add(g); keep.push(g);
        K.physics.addDynamic({ x, z, r: 1.6, m: 0.5, h: 2.4, mesh: g, slide: true, friction: 20, baseY: 1.2 });
      };
      const mushCork = (x, z) => {
        const g = new T.Group();
        const c = new T.Mesh(mush, corkMat); g.add(c);
        const cage = new T.Mesh(new T.TorusGeometry(1.08, 0.07, 5, 18), steel); cage.rotation.x = PI / 2; cage.position.y = 1.7; g.add(cage);
        for (let k = 0; k < 4; k++) { const w = new T.Mesh(new T.BoxGeometry(0.1, 2.3, 0.1), steel); const a = (k / 4) * TAU; w.position.set(Math.cos(a) * 1.25, 2.8, Math.sin(a) * 1.25); w.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35); g.add(w); }
        const plq = new T.Mesh(new T.CylinderGeometry(0.95, 0.95, 0.12, 20), gold); plq.position.y = 3.92; g.add(plq);
        g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        g.position.set(x, 0, z);
        K.group.add(g); keep.push(g);
        K.physics.addDynamic({ x, z, r: 1.6, m: 0.55, h: 3.9, mesh: g, slide: true, friction: 18, baseY: 0 });
      };
      const grapeMatW = K.phys({ color: 0xc8cf66, roughness: 0.38, clearcoat: 0.4, sheen: 0.6, sheenColor: new T.Color(0xf4f8d0) });
      const grapeMatR = K.phys({ color: 0x3a1a3e, roughness: 0.45, sheen: 0.8, sheenColor: new T.Color(0x9a8ab8), clearcoat: 0.3 });
      const grape = (x, z, red) => {
        const m = new T.Mesh(new T.SphereGeometry(1.05, 20, 14), red ? grapeMatR : grapeMatW);
        m.castShadow = true; m.receiveShadow = true; m.position.set(x, 1.05, z);
        K.group.add(m); keep.push(m);
        K.physics.addDynamic({ x, z, r: 1.05, m: 0.35, h: 2.1, mesh: m, friction: 7, baseY: 1.05 });
      };
      for (const [s, off, ry] of [[96, 3.2, 0.4], [128, -3.8, 2.2], [588, 2.6, 1.0], [165, -3.5, 0.2]]) { const p = track.place(s, off); lyingCork(p.x, p.z, ry); }
      for (const [s, off] of [[700, -2.5], [770, 3.5]]) { const p = track.place(s, off); mushCork(p.x, p.z); }
      for (const [s, off, red] of [[250, -4, false], [290, 3, false], [546, 3, true]]) { const p = track.place(s, off); grape(p.x, p.z, red); }
    }

    // ---------- start: a wine-festival bunting across the path
    {
      const p = track.at(START_S - 3), ang = p.angle;
      const ends = [-1, 1].map((sd) => local(p.x, p.z, ang, 0, sd * (W / 2 + 2.2)));
      for (const [x, z] of ends) { K.mesh(new T.CylinderGeometry(0.22, 0.28, 8.2, 8), postWood, x, 4.1, z); AO(x, z, 1, 1, 0.4); K.circle(x, z, 0.5, 8); }
      const [a, b] = ends, pts = [];
      for (let k = 0; k <= 20; k++) { const t = k / 20; pts.push(new T.Vector3(a[0] + (b[0] - a[0]) * t, 8.0 - Math.sin(t * PI) * 1.4, a[1] + (b[1] - a[1]) * t)); }
      const curve = new T.CatmullRomCurve3(pts);
      K.mesh(new T.TubeGeometry(curve, 30, 0.09, 4), K.std({ color: 0xf2efe6, roughness: 0.8 }), 0, 0, 0, { cast: false });
      const fg = new T.BufferGeometry();
      fg.setAttribute('position', new T.Float32BufferAttribute([-0.8, 0, 0, 0.8, 0, 0, 0, -1.7, 0], 3)); fg.computeVertexNormals();
      const flags = [];
      const fc = [0xe8242f, 0xffffff, 0x28a4e0];
      for (let k = 1; k < 13; k++) { const q = curve.getPointAt(k / 13); flags.push({ x: q.x, y: q.y - 0.05, z: q.z, ry: -ang + r.range(-0.35, 0.35), rx: r.range(-0.25, 0.1), color: fc[k % 3] }); }
      K.instances(fg, K.std({ color: 0xffffff, roughness: 0.75, side: T.DoubleSide }), flags, { colors: true });
    }

    // ============================================================================ flush vineyard instances, scatter
    {
      const leafT = TX.mottledTextures({ size: 128, a: 0xd8e8a8, b: 0x88a858, seed: 37, period: 8, bump: 6, speck: 0.3 });
      const leafMat = K.std({ map: leafT.map, normalMap: leafT.normalMap, normalScale: V2(1.2), roughness: 0.75, flatShading: true, vertexColors: true });
      bakeCells([[new T.IcosahedronGeometry(0.62, 0), VL.leaves]], leafMat);
      const wg = new T.CylinderGeometry(0.035, 0.035, 1, 3, 1, true); wg.rotateZ(PI / 2);
      const bg = new T.ConeGeometry(0.3, 0.75, 5, 1, true); bg.rotateX(PI);
      const vineWood = K.std({ vertexColors: true, roughness: 0.7, side: T.DoubleSide });
      bakeCells([[new T.BoxGeometry(0.28, 3.2, 0.28), VL.posts, 0x6d5a47]], vineWood);
      bakeCells([[new T.CylinderGeometry(0.11, 0.17, 1.25, 4, 1, true), VL.trunks, 0x5a4433], [wg, VL.wires, 0x9a9ea2], [bg, VL.bunches]], vineWood, { cast: false });
      const lg = new T.PlaneGeometry(0.55, 0.45); lg.rotateX(-PI / 2);
      bakeCells([[lg, VL.litter]], K.std({ vertexColors: true, roughness: 0.8, side: T.DoubleSide }), { cast: false });
      bakeCells([[stoneGeo, allStones]], stoneMat, { cast: false });
      // flute bubbles (animated)
      const bm = K.phys({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.75, clearcoat: 1, depthWrite: false });
      const bub = K.instances(new T.SphereGeometry(1, 6, 4), bm, bubbleList.map((b) => ({ x: b.x, y: b.y0, z: b.z, s: b.s })), { cast: false, receive: false });
      bub.renderOrder = 4;
      bub.frustumCulled = false;
      A.bubbles = { im: bub, list: bubbleList, m: new T.Matrix4() };
      // cork crumbs and wine drops around the corkscrew and the bottle of red
      const cc = [];
      for (let k = 0; k < 24; k++) { const x = -66 + r.gauss() * 4, z = -53 + r.gauss() * 4; cc.push({ x, y: 0.12, z, s: r.range(0.12, 0.3), rx: r() * 6, ry: r() * 6, color: r.pick([0xcf9f66, 0xab7741, 0x734b26]) }); }
      K.instances(new T.DodecahedronGeometry(1, 0), K.std({ color: 0xffffff, roughness: 0.9 }), cc, { colors: true, cast: false });
    }

    flushAO();

    // ============================================================================ merge static meshes (fewer draw calls)
    {
      const BU = K.BufferGeometryUtils;
      K.group.updateMatrixWorld(true);
      const isKept = (o) => { for (let p = o; p; p = p.parent) if (keep.includes(p)) return true; return false; };
      const classMats = {
        metalS: K.std({ vertexColors: true, metalness: 1, roughness: 0.16 }),
        metalR: K.std({ vertexColors: true, metalness: 1, roughness: 0.34 }),
        gloss: K.phys({ vertexColors: true, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.06 }),
        plastic: K.phys({ vertexColors: true, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.3 }),
        satin: K.std({ vertexColors: true, roughness: 0.45 }),
        matte: K.std({ vertexColors: true, roughness: 0.85 }),
      };
      const plain = (m) => !m.map && !m.normalMap && !m.roughnessMap && !m.alphaMap && !m.emissiveMap && !m.transparent && (m.emissive ? m.emissive.getHex() === 0 : true) && m.side !== T.BackSide && m.isMeshStandardMaterial && !m.sheen && !m.flatShading;
      const classOf = (m) => {
        if (m.metalness >= 0.5) return m.roughness < 0.26 ? 'metalS' : 'metalR';
        if (m.isMeshPhysicalMaterial && m.clearcoat >= 0.6) return 'gloss';
        if (m.isMeshPhysicalMaterial && m.clearcoat > 0) return 'plastic';
        return m.roughness < 0.6 ? 'satin' : 'matte';
      };
      const items = [], owners = [];
      const slice = (g, start, count) => {
        const out = new T.BufferGeometry();
        for (const k of Object.keys(g.attributes)) { const at = g.attributes[k], n = at.itemSize; out.setAttribute(k, new T.BufferAttribute(at.array.slice(start * n, (start + count) * n), n)); }
        return out;
      };
      K.group.traverse((o) => {
        if (!o.isMesh || o.isInstancedMesh || isKept(o)) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        if (o.renderOrder || mats.some((m) => m.isMeshBasicMaterial || (m.transparent && m !== wineMat && m !== honeyMat))) return;
        if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
        const c = o.geometry.boundingSphere.center.clone().applyMatrix4(o.matrixWorld);
        if (o.geometry.boundingSphere.radius * o.matrixWorld.getMaxScaleOnAxis() > 60 || c.y < -20) return;
        const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
        g.applyMatrix4(o.matrixWorld);
        if (!g.attributes.normal) g.computeVertexNormals();
        for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
        if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
        const cell = cellOf(c.x, c.z);
        if (Array.isArray(o.material)) {
          const groups = g.groups.length ? g.groups : [{ start: 0, count: g.attributes.position.count, materialIndex: 0 }];
          for (const gr of groups) {
            const cnt = Math.min(gr.count, g.attributes.position.count - gr.start);
            if (cnt > 0) items.push({ g: slice(g, gr.start, cnt), mat: o.material[gr.materialIndex], cast: o.castShadow, rec: o.receiveShadow, cell });
          }
        } else items.push({ g, mat: o.material, cast: o.castShadow, rec: o.receiveShadow, cell });
        owners.push(o);
      });
      for (const o of owners) o.parent.remove(o);
      const buckets = new Map();
      for (const it of items) {
        const m = it.mat;
        const cls = plain(m) ? classOf(m) + (m.side === T.DoubleSide ? 'D' : '') : null;
        const key = (cls || m.uuid) + '|' + it.cell + (it.cast ? 'c' : '') + (it.rec ? 'r' : '');
        if (!buckets.has(key)) buckets.set(key, { cls, list: [] });
        buckets.get(key).list.push(it);
      }
      const col = new T.Color();
      for (const [key, { cls, list }] of buckets) {
        const geos = list.map((it) => {
          const g = it.g;
          if (cls) {
            col.copy(it.mat.color);
            const n = g.attributes.position.count, ca = new Float32Array(n * 3), src = it.mat.vertexColors ? g.attributes.color : null;
            for (let i = 0; i < n; i++) { ca[i * 3] = col.r * (src ? src.getX(i) : 1); ca[i * 3 + 1] = col.g * (src ? src.getY(i) : 1); ca[i * 3 + 2] = col.b * (src ? src.getZ(i) : 1); }
            for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k);
            g.setAttribute('color', new T.BufferAttribute(ca, 3));
          } else if (g.attributes.color && !it.mat.vertexColors) g.deleteAttribute('color');
          return g;
        });
        const merged = geos.length > 1 ? BU.mergeGeometries(geos, false) : geos[0];
        if (!merged) { console.warn('moselle: merge failed', list[0].mat.type); continue; }
        let mat = list[0].mat;
        if (cls) {
          const base = cls.replace('D', '');
          mat = classMats[cls] || (classMats[cls] = classMats[base].clone());
          if (cls.endsWith('D')) mat.side = T.DoubleSide;
        }
        const m = new T.Mesh(merged, mat);
        m.castShadow = false; m.receiveShadow = list[0].rec;
        K.group.add(m);
        if (list[0].cast) toShadow(merged, list[0].cell);
      }
      flushShadows();
    }
    A.buildMs = performance.now() - t0;
  },

  animate(time, dt, game) {
    if (!A) return;
    // excursion boat
    if (A.boat) {
      const q = boatPose(time), B = A.boat;
      B.grp.position.set(q.x, 0.06 + Math.sin(time * 1.7) * 0.05, q.z);
      B.grp.rotation.y = -q.angle;
      B.body.rotation.x = Math.sin(time * 1.3) * 0.015;
      B.flag.rotation.y = Math.sin(time * 3.1) * 0.25;
      B.shadow.position.set(q.x, 0.16, q.z);
      B.shadow.rotation.z = -q.angle;
      if (q.turn !== A.lastTurn) {
        if (q.turn >= 0 && game && game.sound && game.sound.ctx && (game.state === 'race' || game.state === 'countdown') && game.onScreen(q.x, 2, q.z)) {
          game.sound.tone(196, 0.55, { type: 'sine', vol: 0.06 });
          game.sound.tone(147, 0.8, { type: 'sine', vol: 0.06, when: 0.65 });
        }
        A.lastTurn = q.turn;
      }
    }
    // bubbles rising in the flutes
    if (A.bubbles) {
      const { im, list, m } = A.bubbles;
      for (let i = 0; i < list.length; i++) {
        const b = list[i], H = b.y1 - b.y0;
        const y = b.y0 + ((b.ph + time * b.sp) % H);
        const k = 0.6 + 0.4 * ((y - b.y0) / H);
        m.makeScale(b.s * k, b.s * k, b.s * k);
        m.setPosition(b.x + Math.sin(time * 6 + b.w) * 0.05, y, b.z);
        im.setMatrixAt(i, m);
      }
      im.instanceMatrix.needsUpdate = true;
    }
  },
};

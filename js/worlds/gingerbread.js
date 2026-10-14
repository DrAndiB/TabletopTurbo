// World: Gingerbread Village. Christmas Eve at dusk on the dining table: a sugar-snow gingerbread village with
// glowing candy windows, an icing-sugar road lined with candy-cane kerbs and gumdrops, a wind-up toy train that
// circles the village over two level crossings, a frozen-syrup skating pond, a toppled mug of hot chocolate, an
// advent wreath with flickering candles and a jump onto a big gift box. Raced on toy snowmobiles.
import * as THREE from '../../vendor/three.bundle.js';
import { Track } from '../track.js';

const TRACK = [
  [74, 86], [46, 79], [34, 58], [32, 28], [22, 4], [0, -6], [-22, 4], [-32, 28], [-36, 52], [-48, 70], [-80, 78],
  [-120, 74], [-146, 50], [-152, 14], [-148, -22], [-126, -45], [-92, -50], [-62, -49], [0, -47], [62, -47], [96, -48],
  [126, -40], [142, -16], [138, 12], [120, 36], [114, 60], [104, 80],
];
const BOUNDS = { minX: -170, maxX: 170, minZ: -98, maxZ: 106 };
const RC = { cx: 0, cz: -47, D: 34, R: 28 }; // the toy railway: a stadium loop round the village (semicircle centres cx +- D)
const RAIL_PTS = (() => {
  const p = [], { cx, cz, D, R } = RC;
  for (let x = -D; x <= D; x += 17) p.push([cx + x, cz + R]);
  for (let k = 1; k < 8; k++) { const a = Math.PI / 2 - (k * Math.PI) / 8; p.push([cx + D + R * Math.cos(a), cz + R * Math.sin(a)]); }
  for (let x = D; x >= -D; x -= 17) p.push([cx + x, cz - R]);
  for (let k = 1; k < 8; k++) { const a = -Math.PI / 2 - (k * Math.PI) / 8; p.push([cx - D + R * Math.cos(a), cz + R * Math.sin(a)]); }
  return p;
})();
// wind-up Christmas train: loco, tender, gift wagon, tree wagon, caboose (lengths); constant speed round the loop
const TRAIN = { V: 19, lens: [11.4, 6.6, 8.6, 8.6, 7.6], gap: 0.8, r: 1.75, h: 5.2, m: 6.5 };
const GIFT = { s0: 337, rl: 15, rh: 4.7, bl: 27, bw: 23, bh: 4.0 }; // jump: gingerbread slab onto a big gift box
const PI = Math.PI, TAU = PI * 2;
let A = null; // runtime state for tick / animate

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function cyc(t) { const P = A.P; return ((((t - A.t0) % P) + P) % P); }
function headS(t) { return cyc(t) * TRAIN.V; }
// time until the train reaches a crossing (negative while it is on it) and the occupancy duration
function crossingTimes(lc, t) {
  const P = A.P, u = cyc(t);
  let tA = (((lc.ua - u) % P) + P) % P;
  if (tA > P - lc.occ) tA -= P;
  return [tA, tA + lc.occ];
}

export default {
  id: 'gingerbread',
  name: 'Gingerbread Village',
  blurb: 'Christmas Eve on the table: snowmobiles, icing roads, a toy train and gumdrop kerbs.',
  vehicle: 'snowmobile',
  seed: 24,
  track: { points: TRACK, width: 14, startS: 14 },
  bounds: BOUNDS,
  fallOffEdges: true,
  floorY: -76,
  offCourse: 16,
  offroad: { kind: 'slow', margin: 1.5 },
  skidColor: 0x8ea2c0,
  clackOnBump: false,
  dust: {
    normal: { color: 0xffffff, size: 0.7, life: 0.45, up: 1.6, grav: 4, alpha: 0.35, grow: 2.2, rate: 0.35 },
    slow: { color: 0xffffff, size: 1.15, life: 0.7, up: 5.5, grav: 14, alpha: 0.8, grow: 1.8, rate: 2.4 },
    sticky: { color: 0x4a2414, size: 0.7, life: 0.5, up: 4, grav: 40, alpha: 0.95, grow: 1, rate: 2 },
    slick: { color: 0xdcecff, size: 0.6, life: 0.5, up: 3, grav: 20, alpha: 0.8, grow: 1.2, rate: 1.6 },
  },
  lighting: {
    sunDir: [-0.38, 1, -0.62], sunColor: 0x86a2e8, sunIntensity: 0.52,
    hemiSky: 0x30458a, hemiGround: 0x2a140e, hemiIntensity: 0.27,
    envIntensity: 0.13, exposure: 1.0, background: 0x070b18, shadowRadius: 2.4,
    fog: { color: 0x0c1226, near: 220, far: 640 },
  },

  async build(K) {
    const { THREE: T, TX, r, track } = K;
    const BU = K.BufferGeometryUtils;
    const V2 = (a, b = a) => new T.Vector2(a, b);
    A = { t0: 0, synced: false, bell: [0, 0], flick: [] };
    const keep = [];
    const L = track.length;

    // ---------------------------------------------------------------- noise
    const NF = TX.noiseField(256, { seed: 71, period: 8, oct: 4 });
    const NF2 = TX.noiseField(256, { seed: 83, period: 32, oct: 3 });
    const bil = (f, x, y) => {
      x = ((x % 256) + 256) % 256; y = ((y % 256) + 256) % 256;
      const x0 = x | 0, y0 = y | 0, x1 = (x0 + 1) & 255, y1 = (y0 + 1) & 255, fx = x - x0, fy = y - y0;
      return (f[y0 * 256 + x0] * (1 - fx) + f[y0 * 256 + x1] * fx) * (1 - fy) + (f[y1 * 256 + x0] * (1 - fx) + f[y1 * 256 + x1] * fx) * fy;
    };
    const n1 = (x, z, sc) => bil(NF, x * sc + 37, z * sc + 91);
    const n2 = (x, z, sc) => bil(NF2, x * sc + 11, z * sc + 53);

    // ---------------------------------------------------------------- railway geometry + timetable
    const rail = new Track(RAIL_PTS, { width: 4, spacing: 0.5 });
    A.rail = rail;
    const RL = rail.length;
    A.P = RL / TRAIN.V;
    const TL = TRAIN.lens.reduce((a, b) => a + b, 0) + TRAIN.gap * (TRAIN.lens.length - 1);
    A.off = []; { let o = 0; for (const l of TRAIN.lens) { A.off.push(o); o += l + TRAIN.gap; } }
    A.lc = [];
    for (const sx of [-1, 1]) {
      const x = RC.cx + sx * (RC.D + RC.R), z = RC.cz;
      const rs = rail.distTo(x, z).s, rd = track.distTo(x, z);
      const p = track.at(rd.s);
      const ua = ((((rs - TRAIN.m) % RL) + RL) % RL) / TRAIN.V;
      A.lc.push({ x: p.x, z: p.z, roadS: rd.s, railS: rs, angle: p.angle, ua, occ: (TL + 2 * TRAIN.m) / TRAIN.V });
    }
    A.lc.sort((a, b) => a.roadS - b.roadS);

    // ---------------------------------------------------------------- distance fields (1-unit grid): road edge, rail
    const G0X = -172, G0Z = -100, GW = 345, GH = 208;
    const RD = new Float32Array(GW * GH).fill(60), RR = new Float32Array(GW * GH).fill(60);
    const stamp = (F, xs, zs, Rad) => {
      for (let i = 0; i < xs.length; i++) {
        const x = xs[i], z = zs[i];
        const gx0 = Math.max(0, Math.floor(x - Rad - G0X)), gx1 = Math.min(GW - 1, Math.ceil(x + Rad - G0X));
        const gz0 = Math.max(0, Math.floor(z - Rad - G0Z)), gz1 = Math.min(GH - 1, Math.ceil(z + Rad - G0Z));
        for (let gz = gz0; gz <= gz1; gz++) {
          const dz = gz + G0Z - z;
          for (let gx = gx0; gx <= gx1; gx++) {
            const dx = gx + G0X - x, d = Math.sqrt(dx * dx + dz * dz), k = gz * GW + gx;
            if (d < F[k]) F[k] = d;
          }
        }
      }
    };
    {
      const xs = [], zs = []; for (let i = 0; i < track.N; i += 2) { xs.push(track.x[i]); zs.push(track.z[i]); }
      stamp(RD, xs, zs, 30);
      const rx = [], rz = []; for (let i = 0; i < rail.N; i += 2) { rx.push(rail.x[i]); rz.push(rail.z[i]); }
      stamp(RR, rx, rz, 14);
    }
    const field = (F, x, z) => {
      const gx = clamp(x - G0X, 0, GW - 1.001), gz = clamp(z - G0Z, 0, GH - 1.001);
      const x0 = gx | 0, z0 = gz | 0, fx = gx - x0, fz = gz - z0, k = z0 * GW + x0;
      return (F[k] * (1 - fx) + F[k + 1] * fx) * (1 - fz) + (F[k + GW] * (1 - fx) + F[k + GW + 1] * fx) * fz;
    };
    const roadEdge = (x, z) => field(RD, x, z) - 7; // < 0 on the road
    const railD = (x, z) => field(RR, x, z);

    // ---------------------------------------------------------------- helpers: geometry, baking, contact shadows
    const xf = (g, o = {}) => {
      const m = new T.Matrix4().compose(new T.Vector3(o.x || 0, o.y || 0, o.z || 0), new T.Quaternion().setFromEuler(new T.Euler(o.rx || 0, o.ry || 0, o.rz || 0, o.order || 'YXZ')), new T.Vector3(o.sx ?? o.s ?? 1, o.sy ?? o.s ?? 1, o.sz ?? o.s ?? 1));
      return g.applyMatrix4(m);
    };
    const colorize = (g, c, k = 1) => {
      g = g.index ? g.toNonIndexed() : g;
      const col = new T.Color(c), n = g.attributes.position.count, a = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { a[i * 3] = col.r * k; a[i * 3 + 1] = col.g * k; a[i * 3 + 2] = col.b * k; }
      g.setAttribute('color', new T.BufferAttribute(a, 3));
      return g;
    };
    const tidy = (g) => {
      if (g.index) g = g.toNonIndexed();
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color', 'uv'].includes(k)) g.deleteAttribute(k);
      if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!g.attributes.color) colorize(g, 0xffffff);
      return g;
    };
    const merge = (parts) => BU.mergeGeometries(parts.map(tidy), false);
    const bakeQ = new Map();
    const CELL = 110;
    const bake = (geo, mat, x = 0, z = 0, cast = true) => {
      if (mat !== mIcing && mat !== mGlow) cast = true; // only icing details skip the shadow pass (fewer buckets)
      const key = mat.uuid + (cast ? 'c' : '') + Math.floor((x + 320) / CELL) + ':' + Math.floor((z + 320) / CELL);
      if (!bakeQ.has(key)) bakeQ.set(key, { mat, cast, parts: [] });
      bakeQ.get(key).parts.push(geo);
    };
    const flushBake = () => {
      for (const { mat, cast, parts } of bakeQ.values()) {
        const g = merge(parts);
        g.computeBoundingSphere();
        const m = new T.Mesh(g, mat); m.castShadow = cast; m.receiveShadow = true;
        keep.push(m); K.group.add(m);
      }
      bakeQ.clear();
    };
    // chunked instancing (frustum culling skips the chunks off screen)
    const chunked = (geo, mat, list, opts = {}, cell = 140) => {
      const b = new Map();
      for (const it of list) { const k = Math.floor((it.x + 240) / cell) + ',' + Math.floor((it.z + 240) / cell); if (!b.has(k)) b.set(k, []); b.get(k).push(it); }
      for (const l of b.values()) { const im = K.instances(geo, mat, l, opts); keep.push(im); }
    };
    // a part: geometry placed by o (x,y,z,rx,ry,rz,s...), tinted by vertex colour, baked into mat's batch
    const P = (geo, col, o, mat, cast = true, k = 1) => { const g = colorize(xf(geo, o), col, k); bake(g, mat, o.x || 0, o.z || 0, cast); return g; };
    // a group of parts in a local frame (cx, cz, ry) so a house or a prop can be built in its own coordinates
    const frame = (cx, cy, cz, ry, s = 1) => {
      const M = new T.Matrix4().compose(new T.Vector3(cx, cy, cz), new T.Quaternion().setFromEuler(new T.Euler(0, ry, 0)), new T.Vector3(s, s, s));
      return (geo, col, o, mat, cast = true, k = 1) => { const g = colorize(xf(geo, o), col, k); g.applyMatrix4(M); bake(g, mat, cx, cz, cast); return g; };
    };
    const contacts = [];
    const AO = (x, z, rx, rz = rx, op = 0.4, ang = 0, y = null) => contacts.push({ x, y: (y ?? snowY(x, z)) + 0.07, z, ry: -ang, sx: rx * 2, sy: op, sz: rz * 2 });
    const glows = [];
    const GLOW = (x, y, z, s, color, op = 1) => glows.push({ x, y, z, s, color: new T.Color(color).multiplyScalar(op) });
    const local = (cx, cz, a, along, side) => [cx + Math.cos(a) * along - Math.sin(a) * side, cz + Math.sin(a) * along + Math.cos(a) * side];
    const blocked = [];
    const block = (x, z, rad) => blocked.push([x, z, rad]);
    const isBlocked = (x, z, m = 0) => { for (const [bx, bz, br] of blocked) if ((x - bx) ** 2 + (z - bz) ** 2 < (br + m) ** 2) return true; return false; };
    const warnRoad = (what, x, z, m = 0.5) => { if (!K.offRoad(x, z, m)) console.warn(`gingerbread: ${what} on road at ${x.toFixed(1)},${z.toFixed(1)}`); };

    // ---------------------------------------------------------------- materials
    const gingerTex = (() => {
      const S = 256, h = new Float32Array(S * S);
      const nA = TX.noiseField(256, { seed: 5, period: 16, oct: 4 }), nB = TX.noiseField(256, { seed: 6, period: 64, oct: 2 });
      const rr = K.rng(9);
      const c = TX.paint(S, S, (x, y, u, v, o) => {
        const a = nA[y * S + x], b = nB[y * S + x];
        const t = 0.85 + (a - 0.5) * 0.35 + (b - 0.5) * 0.2;
        o[0] = 178 * t; o[1] = 104 * t; o[2] = 52 * t;
        h[y * S + x] = a * 0.7 + b * 0.3;
      });
      const g = c.getContext('2d');
      for (let i = 0; i < 900; i++) { // spice flecks and air pockets
        const x = rr() * S, y = rr() * S, s = rr() < 0.7 ? 0.8 : 1.6;
        g.fillStyle = rr() < 0.6 ? 'rgba(70,34,14,0.75)' : 'rgba(230,170,110,0.5)';
        g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill();
        const k = (Math.floor(y) % S) * S + (Math.floor(x) % S); h[k] -= 0.25;
      }
      return { map: TX.toTexture(c), normalMap: TX.toTexture(TX.normalFromHeight(h, S, S, 3.5), { srgb: false }) };
    })();
    const mGinger = K.std({ map: gingerTex.map, normalMap: gingerTex.normalMap, normalScale: V2(0.9), roughness: 0.72, vertexColors: true });
    const sugarN = (() => { const S = 128, h = new Float32Array(S * S); const rr = K.rng(13); for (let i = 0; i < h.length; i++) h[i] = rr(); return TX.toTexture(TX.normalFromHeight(h, S, S, 1.6), { srgb: false }); })();
    const mIcing = K.phys({ vertexColors: true, roughness: 0.5, sheen: 0.6, sheenColor: new T.Color(0xffffff), normalMap: sugarN, normalScale: V2(0.25) });
    const mCandy = K.phys({ vertexColors: true, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 });
    const mSugared = K.phys({ vertexColors: true, roughness: 0.6, normalMap: sugarN, normalScale: V2(0.9), sheen: 0.25, sheenColor: new T.Color(0xffffff), clearcoat: 0.2, clearcoatRoughness: 0.5 });
    const mGlow = new T.MeshBasicMaterial({ vertexColors: true });
    const mMetal = K.std({ vertexColors: true, metalness: 1, roughness: 0.22 });
    const mChoc = mCandy, mMatte = mSugared, mPine = mSugared; // few materials = few draw calls

    // ---------------------------------------------------------------- table, cloth, drape, floor
    const TW = BOUNDS.maxX - BOUNDS.minX, TD = BOUNDS.maxZ - BOUNDS.minZ, TCX = (BOUNDS.maxX + BOUNDS.minX) / 2, TCZ = (BOUNDS.maxZ + BOUNDS.minZ) / 2;
    const RUN = { z: 30, w: 46 }; // festive runner along the table
    {
      // printed cloth: deep red damask with a green velvet runner (one non-tiling map), fine weave as a tiled normal map
      const CW = 1024, CH = Math.round(1024 * TD / TW);
      const c = TX.makeCanvas(CW, CH), g = c.getContext('2d');
      const px = (x) => ((x - BOUNDS.minX) / TW) * CW, pz = (z) => ((z - BOUNDS.minZ) / TD) * CH;
      g.fillStyle = '#8c1820'; g.fillRect(0, 0, CW, CH);
      // damask: rows of stars and snowflakes woven a shade darker
      const motif = (x, y, s, kind) => {
        g.save(); g.translate(x, y);
        if (kind) { g.strokeStyle = 'rgba(70,6,12,0.55)'; g.lineWidth = 1.6; for (let k = 0; k < 6; k++) { g.rotate(PI / 3); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -s); g.moveTo(0, -s * 0.55); g.lineTo(-s * 0.25, -s * 0.78); g.moveTo(0, -s * 0.55); g.lineTo(s * 0.25, -s * 0.78); g.stroke(); } }
        else { g.fillStyle = 'rgba(176,40,46,0.45)'; g.beginPath(); for (let k = 0; k < 10; k++) { const a = -PI / 2 + k * PI / 5, q = k % 2 ? s * 0.42 : s; g.lineTo(Math.cos(a) * q, Math.sin(a) * q); } g.closePath(); g.fill(); }
        g.restore();
      };
      for (let row = 0; row < 40; row++) for (let col = 0; col < 64; col++) motif(col * 17 + (row % 2) * 8.5, row * 17, row % 2 ? 4.5 : 3.6, row % 2);
      // large soft folds / sheen variation
      const nn = TX.noiseField(256, { seed: 3, period: 4, oct: 3 });
      const img = g.getImageData(0, 0, CW, CH), d = img.data;
      for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
        const t = 0.86 + nn[((y >> 2) & 255) * 256 + ((x >> 2) & 255)] * 0.28, i = (y * CW + x) * 4;
        d[i] *= t; d[i + 1] *= t; d[i + 2] *= t;
      }
      g.putImageData(img, 0, 0);
      // runner: green velvet, gold braid, embroidered holly sprigs
      const ry0 = pz(RUN.z - RUN.w / 2), ry1 = pz(RUN.z + RUN.w / 2);
      const vg = g.createLinearGradient(0, ry0, 0, ry1); vg.addColorStop(0, '#173d26'); vg.addColorStop(0.5, '#1f4f31'); vg.addColorStop(1, '#173d26');
      g.fillStyle = vg; g.fillRect(0, ry0, CW, ry1 - ry0);
      g.fillStyle = '#c99a3a'; g.fillRect(0, ry0 + 5, CW, 4); g.fillRect(0, ry1 - 9, CW, 4);
      g.fillStyle = '#e4bf5c'; for (let x = 0; x < CW; x += 6) { g.fillRect(x, ry0 + 12, 3, 2); g.fillRect(x, ry1 - 14, 3, 2); }
      for (let x = 20; x < CW; x += 46) {
        const y = (ry0 + ry1) / 2;
        g.fillStyle = '#2f7a40'; for (const a of [-0.6, 0.6, PI - 0.6, PI + 0.6]) { g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.ellipse(9, 0, 9, 4, 0, 0, TAU); g.fill(); g.restore(); }
        g.fillStyle = '#c4202a'; for (const [dx, dy] of [[0, -3], [3, 2], [-3, 2]]) { g.beginPath(); g.arc(x + dx, y + dy, 2.6, 0, TAU); g.fill(); }
      }
      const clothMap = TX.toTexture(c, { wrap: false });
      // weave normal (tiled)
      const S = 256, h = new Float32Array(S * S);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const u = x / S * 32, v = y / S * 32, iu = Math.floor(u), iv = Math.floor(v);
        const over = (iu + iv) % 2 === 0, fu = u - iu, fv = v - iv;
        h[y * S + x] = (over ? Math.sin(fv * PI) : Math.sin(fu * PI)) * 0.8 + (over ? 0.2 : 0);
      }
      const weave = TX.toTexture(TX.normalFromHeight(h, S, S, 1.4), { srgb: false, repeat: [TW / 9, TD / 9] });
      const clothMat = K.std({ map: clothMap, normalMap: weave, normalScale: V2(0.55), roughness: 0.92 });
      const top = new T.PlaneGeometry(TW, TD); top.rotateX(-PI / 2);
      K.mesh(top, clothMat, TCX, 0, TCZ, { cast: false });
      // the cloth drapes over the table edges in soft folds, with a gold hem
      const drapeG = (() => {
        const pts = [], hw = TW / 2 + 0.6, hd = TD / 2 + 0.6, Hh = 30;
        const per = 2 * (2 * hw + 2 * hd), n = 300;
        for (let i = 0; i <= n; i++) {
          let s = (i / n) * per, x, z, nx, nz;
          if (s < 2 * hw) { x = -hw + s; z = hd; nx = 0; nz = 1; }
          else if ((s -= 2 * hw) < 2 * hd) { x = hw; z = hd - s; nx = 1; nz = 0; }
          else if ((s -= 2 * hd) < 2 * hw) { x = hw - s; z = -hd; nx = 0; nz = -1; }
          else { s -= 2 * hw; x = -hw; z = -hd + s; nx = -1; nz = 0; }
          pts.push([x, z, nx, nz, (i / n) * per]);
        }
        const pos = [], uv = [], idx = [], rows = 8;
        for (let i = 0; i < pts.length; i++) {
          const [x, z, nx, nz, s] = pts[i];
          for (let j = 0; j <= rows; j++) {
            const t = j / rows, f = Math.sin(s * 0.55) * 1.3 * t * t + Math.sin(s * 0.23 + 1) * 0.8 * t;
            pos.push(x + nx * (0.3 + f + t * 2), -t * Hh + (j === 0 ? 0 : 0), z + nz * (0.3 + f + t * 2));
            uv.push(s / TW, 1 - t * Hh / TD);
          }
        }
        for (let i = 0; i < pts.length - 1; i++) for (let j = 0; j < rows; j++) { const a = i * (rows + 1) + j, b = a + rows + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
        g.setIndex(idx); g.computeVertexNormals();
        return g;
      })();
      K.mesh(drapeG, K.std({ map: TX.toTexture(c), roughness: 0.92, side: T.DoubleSide, color: 0xd8d0d0 }), TCX, 0, TCZ, { cast: false });
    }
    {
      // table legs (turned walnut) and the floorboards, a rug and presents far below
      const walnut = K.std({ color: 0x4a2c18, roughness: 0.45 });
      const leg = K.lathe([[3.2, 0], [3.6, 6], [2.4, 12], [3.0, 22], [2.0, 34], [2.6, 40], [3.8, 44], [3.8, 46]], 24);
      for (const [x, z] of [[-150, -84], [150, -84], [-150, 92], [150, 92]]) K.mesh(leg, walnut, x, -76, z, { cast: false });
      const floor = TX.woodTextures({ size: 512, seed: 41, planks: 5, base: 0x8a5a34, dark: 0x4e2f18, light: 0xb07e4e, ringFreq: 14, gap: 0.006, roughBase: 0.5 });
      for (const t of Object.values(floor)) { t.repeat.set(10, 10); }
      K.mesh(new T.PlaneGeometry(1400, 1400), K.std({ map: floor.map, normalMap: floor.normalMap, roughnessMap: floor.roughnessMap, color: 0x9a8a80 }), 0, -76, 0, { rx: -PI / 2, cast: false });
      const rugC = TX.paint(256, 256, (x, y, u, v, o) => {
        const d = Math.max(Math.abs(u - 0.5), Math.abs(v - 0.5));
        const band = Math.floor(d * 16) % 3;
        const n = Math.random() * 14;
        const cols = [[120, 24, 30], [28, 70, 44], [214, 196, 160]];
        const c = cols[band]; o[0] = c[0] + n; o[1] = c[1] + n; o[2] = c[2] + n;
      });
      K.mesh(new T.PlaneGeometry(460, 330), K.std({ map: TX.toTexture(rugC, { wrap: false }), roughness: 1 }), 0, -75.8, 10, { rx: -PI / 2, cast: false });
      const giftCols = [0xc42a2a, 0x2a6a3a, 0xe8d9b0, 0x2a4f9a];
      for (let i = 0; i < 7; i++) {
        const x = r.range(-260, 260), z = r.range(-60, 220), s = r.range(20, 40);
        if (Math.abs(x) < 190 && z < 130) continue;
        K.mesh(new T.BoxGeometry(s, s * 0.7, s * 0.9), K.std({ color: giftCols[i % 4], roughness: 0.6 }), x, -76 + s * 0.35, z, { ry: r() * 3, cast: false });
      }
    }

    // ---------------------------------------------------------------- snow: powdered sugar drifts over the cloth (one height field)
    // coverage: snow banks along the road, a snow blanket over the village (north half), patches elsewhere
    const coverage = (x, z) => {
      const e = roadEdge(x, z);
      let c = ss(0.6, 0.72, n2(x, z, 0.9) * 0.75 + n1(x, z, 2.4) * 0.25);
      c = Math.max(c, 1 - ss(-22, -6, z + n1(x, z, 3) * 16)); // the village half is under snow
      c = Math.max(c, e > 0 ? 1 - ss(2.5 + n1(x, z, 4) * 4, 6 + n1(x, z, 4) * 5, e) : 0); // banks along the road
      const edge = Math.min(x - BOUNDS.minX, BOUNDS.maxX - x, z - BOUNDS.minZ, BOUNDS.maxZ - z);
      c *= ss(0.5, 5 + n1(x, z, 5) * 6, edge);
      return c;
    };
    const snowH = (x, z) => {
      const e = roadEdge(x, z);
      if (e < 0.2) return 0;
      const c = coverage(x, z);
      const bank = ss(0.2, 1.6, e) * (0.42 + 0.25 * Math.exp(-((e - 3) ** 2) / 6));
      const drift = 0.18 + 0.75 * ss(0.35, 0.8, n2(x, z, 1.7)) + 0.12 * n1(x, z, 9);
      let h = Math.min(bank + 0.1, 0.25) + (e > 1.5 ? drift * ss(1.5, 9, e) : 0);
      h = Math.max(h * c, bank * Math.min(1, c * 2));
      const rd = railD(x, z);
      h *= ss(2.8, 5, rd) * 0.85 + 0.15;
      return h;
    };
    const SG = 2; // snow grid spacing
    const SNX = Math.round(TW / SG) + 1, SNZ = Math.round(TD / SG) + 1;
    const snowHeights = new Float32Array(SNX * SNZ);
    const snowY = (x, z) => {
      const gx = clamp((x - BOUNDS.minX) / SG, 0, SNX - 1.001), gz = clamp((z - BOUNDS.minZ) / SG, 0, SNZ - 1.001);
      const x0 = gx | 0, z0 = gz | 0, fx = gx - x0, fz = gz - z0, k = z0 * SNX + x0;
      return (snowHeights[k] * (1 - fx) + snowHeights[k + 1] * fx) * (1 - fz) + (snowHeights[k + SNX] * (1 - fx) + snowHeights[k + SNX + 1] * fx) * fz;
    };
    A.snowY = snowY;
    {
      const pos = new Float32Array(SNX * SNZ * 3), col = new Float32Array(SNX * SNZ * 4);
      for (let j = 0; j < SNZ; j++) for (let i = 0; i < SNX; i++) {
        const x = BOUNDS.minX + i * SG, z = BOUNDS.minZ + j * SG, k = j * SNX + i;
        const c = coverage(x, z), h = snowH(x, z);
        snowHeights[k] = h;
        pos[k * 3] = x; pos[k * 3 + 1] = h + 0.03; pos[k * 3 + 2] = z;
        const sh = 0.9 + 0.1 * clamp(h / 0.8, 0, 1);
        col[k * 4] = 0.8 * sh; col[k * 4 + 1] = 0.86 * sh; col[k * 4 + 2] = 0.97 * sh; col[k * 4 + 3] = roadEdge(x, z) > -2.5 ? Math.max(ss(0.08, 0.5, c), roadEdge(x, z) < 4 ? 1 : 0) : 0;
      }
      const uv = new Float32Array(SNX * SNZ * 2); for (let k = 0; k < SNX * SNZ; k++) { uv[k * 2] = pos[k * 3] / 6; uv[k * 2 + 1] = pos[k * 3 + 2] / 6; }
      // normals over the whole field, then chunks (so frustum culling skips what is off screen)
      const full = new T.BufferGeometry(); full.setAttribute('position', new T.BufferAttribute(pos, 3));
      { const idx = []; for (let j = 0; j < SNZ - 1; j++) for (let i = 0; i < SNX - 1; i++) { const a = j * SNX + i; idx.push(a, a + SNX, a + 1, a + 1, a + SNX, a + SNX + 1); } full.setIndex(idx); full.computeVertexNormals(); }
      const nrm = full.attributes.normal.array;
      const snowMat = K.std({ vertexColors: true, roughness: 0.82, normalMap: sugarN, normalScale: V2(0.7), alphaHash: true, envMapIntensity: 0.8 });
      const CI = 3, CJ = 2;
      for (let cj = 0; cj < CJ; cj++) for (let ci = 0; ci < CI; ci++) {
        const i0 = Math.floor(ci * (SNX - 1) / CI), i1 = Math.floor((ci + 1) * (SNX - 1) / CI), j0 = Math.floor(cj * (SNZ - 1) / CJ), j1 = Math.floor((cj + 1) * (SNZ - 1) / CJ);
        const nx = i1 - i0 + 1, nz = j1 - j0 + 1;
        const P3 = new Float32Array(nx * nz * 3), N3 = new Float32Array(nx * nz * 3), C4 = new Float32Array(nx * nz * 4), U2 = new Float32Array(nx * nz * 2);
        for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
          const k = (j + j0) * SNX + (i + i0), q = j * nx + i;
          P3.set(pos.subarray(k * 3, k * 3 + 3), q * 3); N3.set(nrm.subarray(k * 3, k * 3 + 3), q * 3); C4.set(col.subarray(k * 4, k * 4 + 4), q * 4); U2.set(uv.subarray(k * 2, k * 2 + 2), q * 2);
        }
        const idx = [];
        for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
          const a = j * nx + i, b = a + 1, d = a + nx, e = d + 1;
          if (C4[a * 4 + 3] + C4[b * 4 + 3] + C4[d * 4 + 3] + C4[e * 4 + 3] < 0.01) continue;
          idx.push(a, d, b, b, d, e);
        }
        if (!idx.length) continue;
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.BufferAttribute(P3, 3)); g.setAttribute('normal', new T.BufferAttribute(N3, 3));
        g.setAttribute('color', new T.BufferAttribute(C4, 4)); g.setAttribute('uv', new T.BufferAttribute(U2, 2));
        g.setIndex(idx); g.computeBoundingSphere();
        const sm = new T.Mesh(g, snowMat); sm.receiveShadow = true; sm.castShadow = false;
        K.group.add(sm); keep.push(sm);
      }
      // sugar sparkle: tiny glints scattered over the snow (two sets twinkle out of phase)
      const sc = TX.makeCanvas(32), sg = sc.getContext('2d');
      const gr = sg.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(220,235,255,0.7)'); gr.addColorStop(1, 'rgba(200,220,255,0)');
      sg.fillStyle = gr; sg.fillRect(0, 0, 32, 32);
      const spTex = TX.toTexture(sc, { wrap: false });
      A.sparkles = [];
      for (let set = 0; set < 1; set++) {
        const pts = [];
        let tries = 0;
        while (pts.length < 4200 * 3 && tries++ < 60000) {
          const x = r.range(BOUNDS.minX + 2, BOUNDS.maxX - 2), z = r.range(BOUNDS.minZ + 2, BOUNDS.maxZ - 2);
          if (coverage(x, z) < 0.55 || roadEdge(x, z) < 0.5) continue;
          pts.push(x, snowY(x, z) + 0.12, z);
        }
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
        const m = new T.PointsMaterial({ size: 0.42, map: spTex, color: 0xeaf2ff, transparent: true, opacity: 0.8, depthWrite: false, blending: T.AdditiveBlending, sizeAttenuation: true });
        const pp = new T.Points(g, m); pp.renderOrder = 2; K.group.add(pp); keep.push(pp);
        A.sparkles.push(m);
      }
    }

    // ---------------------------------------------------------------- the road: smooth glazed icing, candy-cane kerbs, gumdrops and dragees
    {
      const W = 128, H = 512, hh = new Float32Array(W * H);
      const nA = TX.noiseField(256, { seed: 61, period: 16, oct: 3 });
      const c = TX.paint(W, H, (x, y, u, v, o) => {
        const a = nA[((y >> 1) & 255) * 256 + ((x * 2) & 255)];
        const ripple = Math.sin(v * 64 + a * 5) * 0.5 + 0.5; // spreading strokes of the palette knife
        const t = 0.93 + (a - 0.5) * 0.08 + ripple * 0.03;
        o[0] = 246 * t; o[1] = 247 * t; o[2] = 252 * t;
        hh[y * W + x] = a * 0.6 + ripple * 0.4;
      });
      const map = TX.toTexture(c), nm = TX.toTexture(TX.normalFromHeight(hh, W, H, 1.2), { srgb: false });
      const roadMat = K.phys({ map, normalMap: nm, normalScale: V2(0.5), roughness: 0.32, clearcoat: 0.55, clearcoatRoughness: 0.22, sheen: 0.4, sheenColor: new T.Color(0xeef4ff) });
      K.ribbon({ mat: roadMat, y: 0.1, vScale: 28, step: 1 });
      // candy-cane kerbs (diagonal stripes) on both edges
      const kc = TX.labelTexture(64, 256, (g) => {
        g.fillStyle = '#fbf7f2'; g.fillRect(0, 0, 64, 256);
        g.fillStyle = '#d2172a';
        for (let i = -4; i < 12; i++) { g.beginPath(); g.moveTo(0, i * 32); g.lineTo(64, i * 32 + 22); g.lineTo(64, i * 32 + 38); g.lineTo(0, i * 32 + 16); g.closePath(); g.fill(); }
      }, { wrap: true });
      kc.wrapS = kc.wrapT = T.RepeatWrapping;
      const kerbMat = K.phys({ map: kc, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.06 });
      { const kg = BU.mergeGeometries([-1, 1].map((sd) => track.ribbonGeometry({ width: 1.05, offset: sd * 6.5, y: 0.14, vScale: 4.4, step: 1 })), false); const km = new T.Mesh(kg, kerbMat); km.receiveShadow = true; K.group.add(km); keep.push(km); }
      // gumdrops (sugar-coated) just outside the kerbs, silver dragees between them
      const gumG0 = K.lathe([[0.001, 1.05], [0.5, 0.96], [0.76, 0.62], [0.82, 0.12], [0.7, 0]], 7);
      const gumCols = [0xd8101e, 0x109a2a, 0xf2b60a, 0xf25a0a, 0x8a20c0, 0x1a6ad8];
      const gums = [], drag = [];
      for (const side of [-1, 1]) {
        let k = side > 0 ? 2 : 0;
        for (const p of track.edgePoints(side, 4.4, 1.35)) {
          const y = snowY(p.x, p.z);
          gums.push({ x: p.x, y: y - 0.05, z: p.z, ry: r() * 6, s: r.range(1.15, 1.3), color: gumCols[k++ % gumCols.length] });
          for (const f of [1.47, 2.93]) {
            const q = track.place(p.s + f, side * (7 + 1.3 + r.range(-0.15, 0.15)));
            drag.push({ x: q.x, y: snowY(q.x, q.z) + 0.3, z: q.z, s: 0.36 });
          }
        }
      }
      chunked(gumG0, K.phys({ color: 0xffffff, roughness: 0.5, normalMap: sugarN, normalScale: V2(1.2), sheen: 0.25, sheenColor: new T.Color(0xffffff), clearcoat: 0.5, clearcoatRoughness: 0.35 }), gums, { colors: true });
      chunked(new T.IcosahedronGeometry(1, 1), K.phys({ color: 0xf4f0ff, roughness: 0.2, clearcoat: 1, sheen: 1, sheenColor: new T.Color(0xd8e8ff), envMapIntensity: 1.6 }), drag, { cast: false });
    }

    // ---------------------------------------------------------------- start / finish: a dark-and-white chocolate chequer + a candy banner
    {
      const s0 = 14;
      const c = TX.makeCanvas(512, 128), g = c.getContext('2d');
      for (let y = 0; y < 3; y++) for (let x = 0; x < 12; x++) {
        const dark = (x + y) % 2 === 0;
        const X = x * 42.66, Y = y * 42.66;
        g.fillStyle = dark ? '#3a1d10' : '#f3e6cf'; g.fillRect(X, Y, 42.66, 42.66);
        g.fillStyle = dark ? 'rgba(255,220,180,0.12)' : 'rgba(255,255,255,0.5)'; g.fillRect(X + 3, Y + 3, 36, 5); g.fillRect(X + 3, Y + 3, 5, 36);
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(X + 34, Y + 8, 6, 34); g.fillRect(X + 8, Y + 34, 34, 6);
      }
      const p = track.at(s0);
      const m = K.mesh(new T.PlaneGeometry(14.6, 3.6), K.phys({ map: TX.toTexture(c, { wrap: false }), roughness: 0.35, clearcoat: 0.4 }), p.x, 0.17, p.z, { cast: false });
      m.rotation.order = 'YXZ'; m.rotation.y = -p.angle + PI / 2; m.rotation.x = -PI / 2;
      // banner on two big candy canes
      const bc = TX.labelTexture(512, 96, (g2) => {
        g2.fillStyle = '#b8141f'; g2.fillRect(0, 0, 512, 96);
        g2.fillStyle = '#f2d36b'; g2.fillRect(0, 6, 512, 5); g2.fillRect(0, 85, 512, 5);
        g2.font = '58px "Lilita One", Impact, sans-serif'; g2.textAlign = 'center'; g2.fillStyle = '#fff6e0';
        g2.fillText('★ SLEIGH GRAND PRIX ★', 256, 68);
      });
      const bannerMat = K.std({ map: bc, roughness: 0.75, side: T.DoubleSide });
      const pole = (x, z) => {
        const f = frame(x, 0, z, 0);
        // striped pole: alternating red / white segments
        for (let i = 0; i < 12; i++) f(new T.CylinderGeometry(0.55, 0.55, 1.0, 12), i % 2 ? 0xd2172a : 0xfbf7f2, { y: 0.5 + i }, mCandy);
        f(new T.SphereGeometry(0.9, 14, 10), 0xf2c21a, { y: 12.6 }, mMetal);
        AO(x, z, 1.4, 1.4, 0.5);
        K.circle(x, z, 0.8, 14);
      };
      const [ax, az] = local(p.x, p.z, p.angle, 0, -9.2), [bx, bz] = local(p.x, p.z, p.angle, 0, 9.2);
      pole(ax, az); pole(bx, bz);
      const ban = K.mesh(new T.PlaneGeometry(17.6, 3.0), bannerMat, p.x, 10.2, p.z, { cast: true });
      ban.rotation.y = -p.angle + PI / 2;
    }

    // ---------------------------------------------------------------- railway: cookie-crumb bed, pretzel sleepers, silver rails
    {
      const bedC = TX.paint(64, 256, (x, y, u, v, o) => { const n = Math.random(); const t = 0.75 + n * 0.4; o[0] = 150 * t; o[1] = 96 * t; o[2] = 56 * t; o[3] = 255 * Math.min(1, (0.5 - Math.abs(u - 0.5)) * 7); });
      const bedT = TX.toTexture(bedC); bedT.wrapS = bedT.wrapT = T.RepeatWrapping;
      const bedG = rail.ribbonGeometry({ width: 5.6, y: 0.06, vScale: 8 });
      const bed = new T.Mesh(bedG, K.std({ map: bedT, roughness: 0.95, transparent: true, depthWrite: false }));
      bed.receiveShadow = true; bed.renderOrder = 0; K.group.add(bed); keep.push(bed);
      const sl = [];
      for (let s = 0; s < RL; s += 1.45) {
        const p = rail.at(s);
        const rd = roadEdge(p.x, p.z);
        if (rd < 1.5) continue; // panels at the crossings
        sl.push({ x: p.x, y: 0.3, z: p.z, ry: -p.angle + PI / 2, s: 1, color: 0x8a4a1e });
      }
      const pretzel = new T.CylinderGeometry(0.3, 0.3, 4.4, 6, 1); pretzel.rotateZ(PI / 2);
      chunked(pretzel, K.phys({ vertexColors: false, color: 0xffffff, roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.3, map: gingerTex.map }), sl, { colors: true });
      // rails: two extruded silver strips
      const parts = [];
      for (const sd of [-1.25, 1.25]) {
        const pos = [], idx = [];
        const N = Math.ceil(RL / 0.75);
        for (let i = 0; i <= N; i++) {
          const p = rail.at((i / N) * RL);
          const nx = -Math.sin(p.angle), nz = Math.cos(p.angle);
          const rd = roadEdge(p.x, p.z);
          const top = rd < 1.2 ? 0.16 : 0.62;
          for (const [o, y] of [[-0.16, 0.4], [-0.16, top], [0.16, top], [0.16, 0.4]]) pos.push(p.x + nx * (sd + o), y, p.z + nz * (sd + o));
        }
        for (let i = 0; i < N; i++) for (let k = 0; k < 3; k++) { const a = i * 4 + k, b = a + 4; idx.push(a, b, a + 1, a + 1, b, b + 1); }
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
        parts.push(g);
      }
      const rm = new T.Mesh(merge(parts), K.std({ vertexColors: true, metalness: 0.9, roughness: 0.25, side: T.DoubleSide }));
      rm.receiveShadow = true; rm.castShadow = false; K.group.add(rm); keep.push(rm);
    }

    // ---------------------------------------------------------------- level crossings: white-chocolate panels, candy-cane posts, lamps, booms
    {
      const crossTex = TX.labelTexture(256, 256, (g) => {
        g.translate(128, 128); g.rotate(PI / 4);
        for (const rot of [0, PI / 2]) { g.save(); g.rotate(rot); g.fillStyle = '#c41a24'; g.fillRect(-124, -20, 248, 40); g.fillStyle = '#fbf6ea'; g.fillRect(-118, -13, 236, 26); g.restore(); }
      });
      const crossMat = K.std({ map: crossTex, alphaTest: 0.5, side: T.DoubleSide, roughness: 0.5 });
      const boomTex = TX.labelTexture(256, 16, (g) => { for (let i = 0; i < 10; i++) { g.fillStyle = i % 2 ? '#fbf7f2' : '#d2172a'; g.fillRect(i * 25.6, 0, 25.6, 16); } });
      const boomMat = K.phys({ map: boomTex, roughness: 0.2, clearcoat: 1 });
      const panelMat = K.phys({ color: 0xf3ead8, roughness: 0.4, clearcoat: 0.3 });
      A.lcVis = [];
      const haloTex = TX.blobShadowTexture();
      for (const c of A.lc) {
        const ra = rail.at(c.railS).angle;
        for (const o of [-2.3, 0, 2.3]) {
          const [px, pz] = local(c.x, c.z, ra + PI / 2, o, 0);
          K.mesh(new K.RoundedBoxGeometry(16.4, 0.24, o === 0 ? 1.9 : 2.0, 2, 0.1), panelMat, px, 0.06, pz, { ry: -ra + PI / 2, cast: false });
        }
        const lm = K.std({ color: 0x3a0806, emissive: 0xff2010, emissiveIntensity: 0, roughness: 0.3 }), lm2 = lm.clone();
        const halo = new T.MeshBasicMaterial({ color: 0xff3a1a, alphaMap: haloTex, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending }), halo2 = halo.clone();
        const vis = { booms: [], mats: [lm, lm2], halos: [halo, halo2] };
        const lights = [[], []], halos = [[], []];
        // equipment on both sides of the road, before the rails (traffic runs one way)
        for (const sd of [-1, 1]) {
          const ha = c.angle; // road heading
          const [bx, bz] = local(c.x, c.z, ha, -5.2, sd * 9.0);
          warnRoad('crossing post', bx, bz, 0.5);
          const M = new T.Matrix4().compose(new T.Vector3(bx, 0, bz), new T.Quaternion().setFromEuler(new T.Euler(0, -ha, 0)), new T.Vector3(1, 1, 1));
          const Q = (g, col, o, mat = mCandy) => { const gg = colorize(xf(g, o), col); gg.applyMatrix4(M); bake(gg, mat, bx, bz); };
          for (let i = 0; i < 7; i++) Q(new T.CylinderGeometry(0.2, 0.2, 0.9, 10), i % 2 ? 0xd2172a : 0xfbf7f2, { y: 0.45 + i * 0.9 });
          Q(new T.PlaneGeometry(3.4, 3.4), 0xffffff, { x: -0.25, y: 6.6, ry: -PI / 2 }, crossMat);
          Q(new K.RoundedBoxGeometry(0.34, 1.0, 2.1, 2, 0.12), 0x1a1210, { x: -0.25, y: 4.7 }, mChoc);
          Q(new K.RoundedBoxGeometry(1.0, 1.5, 1.0, 2, 0.2), 0xf3ead8, { x: 0.2, y: 0.8, z: -sd * 1.3 }, mIcing);
          for (const [k, zz] of [[0, -0.55], [1, 0.55]]) {
            lights[k].push(tidy(xf(new T.SphereGeometry(0.24, 12, 8), { x: -0.45, y: 4.7, z: zz }).applyMatrix4(M)));
            halos[k].push(tidy(xf(new T.PlaneGeometry(2.2, 2.2), { x: -0.8, y: 4.7, z: zz, ry: -PI / 2 }).applyMatrix4(M)));
          }
          // candy-cane boom over half the road, pivoting beside the road
          const pivot = new T.Group();
          pivot.position.copy(new T.Vector3(0.2, 1.3, -sd * 1.3).applyMatrix4(M));
          pivot.rotation.order = 'YXZ'; pivot.rotation.y = -ha + (sd > 0 ? PI : 0);
          const boom = new T.Mesh(new T.CylinderGeometry(0.32, 0.32, 7.4, 8).rotateX(PI / 2).translate(0, 0, 3.8), boomMat); boom.castShadow = true; pivot.add(boom);
          const tipL = new T.Mesh(new T.SphereGeometry(0.18, 8, 6).translate(0, 0.25, 7.2), lm); pivot.add(tipL);
          K.group.add(pivot); keep.push(pivot);
          vis.booms.push(pivot);
          AO(bx, bz, 1.6, 1.6, 0.45);
          K.circle(bx, bz, 0.9, 8);
        }
        for (const k of [0, 1]) {
          const m = new T.Mesh(merge(lights[k]), k ? lm2 : lm); K.group.add(m); keep.push(m);
          const hm = new T.Mesh(merge(halos[k]), k ? halo2 : halo); hm.renderOrder = 3; K.group.add(hm); keep.push(hm);
        }
        A.lcVis.push(vis);
      }
    }

    // ---------------------------------------------------------------- the toy train (merged, vertex coloured tinplate)
    {
      const box = (Pp, c, w, h, d, x, y, z, o = {}) => Pp.push(colorize(xf(new T.BoxGeometry(w, h, d), { x, y, z, ...o }), c));
      const rbox = (Pp, c, w, h, d, x, y, z, rad = 0.15, o = {}) => Pp.push(colorize(xf(new K.RoundedBoxGeometry(w, h, d, 2, rad), { x, y, z, ...o }), c));
      const cyl = (Pp, c, r1, r2, h, x, y, z, o = {}, seg = 16) => Pp.push(colorize(xf(new T.CylinderGeometry(r1, r2, h, seg), { x, y, z, ...o }), c));
      const sph = (Pp, c, rad, x, y, z, o = {}) => Pp.push(colorize(xf(new T.SphereGeometry(rad, 12, 8), { x, y, z, ...o }), c));
      const wheels = (Pp, xs, rad, col = 0xc41a24) => { for (const wx of xs) for (const sz of [-1.32, 1.32]) { cyl(Pp, col, rad, rad, 0.3, wx, rad, sz, { rx: PI / 2 }, 16); cyl(Pp, 0xe8c55a, rad * 0.32, rad * 0.32, 0.36, wx, rad, sz, { rx: PI / 2 }, 8); } };
      const RED = 0xc41a24, GRN = 0x1f6a3a, GOLD = 0xe8b84a, BLK = 0x1a1414, CRM = 0xf3ead8;
      const veh = [];
      veh.push((() => { // loco
        const Pp = [], len = TRAIN.lens[0];
        box(Pp, BLK, len - 0.4, 0.5, 2.9, 0, 1.15, 0);
        wheels(Pp, [3.0, 0.6, -1.8], 0.95);
        for (const sz of [-1.32, 1.32]) box(Pp, GOLD, 5.2, 0.16, 0.1, 0.6, 0.95, sz * 1.04);
        cyl(Pp, RED, 1.25, 1.25, 6.2, 1.9, 2.75, 0, { rz: PI / 2 }, 20);
        for (const bx of [0.2, 1.9, 3.6]) cyl(Pp, GOLD, 1.3, 1.3, 0.22, bx, 2.75, 0, { rz: PI / 2 }, 20);
        cyl(Pp, BLK, 1.3, 1.3, 0.9, 5.2, 2.75, 0, { rz: PI / 2 }, 20);
        cyl(Pp, GOLD, 0.62, 0.62, 0.12, 5.7, 2.75, 0, { rz: PI / 2 }, 16);
        cyl(Pp, BLK, 0.42, 0.62, 1.6, 4.6, 4.6, 0, {}, 14);
        cyl(Pp, BLK, 0.75, 0.5, 0.4, 4.6, 5.55, 0, {}, 14);
        cyl(Pp, GOLD, 0.55, 0.62, 0.55, 2.4, 4.15, 0, {}, 14); sph(Pp, GOLD, 0.55, 2.4, 4.4, 0);
        Pp.push(colorize(xf(new T.ConeGeometry(1.3, 1.6, 4, 1), { x: 6.0, y: 1.0, ry: PI / 4, rz: PI / 2, sx: 1, sz: 1.4 }), GOLD));
        rbox(Pp, RED, 3.4, 3.4, 3.2, -2.9, 3.15, 0, 0.2);
        rbox(Pp, BLK, 4.0, 0.35, 3.6, -2.9, 5.0, 0, 0.15);
        for (const sz of [-1.62, 1.62]) { box(Pp, 0xffd27a, 1.3, 1.1, 0.06, -2.6, 3.8, sz); box(Pp, GOLD, 3.0, 0.14, 0.06, -2.9, 2.2, sz); }
        sph(Pp, 0xfff2b0, 0.38, 6.3, 3.9, 0); // headlamp
        return merge(Pp);
      })());
      veh.push((() => { // tender with coal and a sack of gifts
        const Pp = [], len = TRAIN.lens[1];
        box(Pp, BLK, len - 0.4, 0.5, 2.9, 0, 1.1, 0);
        wheels(Pp, [1.7, -1.7], 0.75);
        rbox(Pp, GRN, len - 0.6, 2.2, 3.1, 0, 2.45, 0, 0.18);
        for (const sz of [-1.57, 1.57]) box(Pp, GOLD, len - 1.0, 0.16, 0.06, 0, 3.2, sz);
        Pp.push(colorize(xf(new T.DodecahedronGeometry(1, 1), { y: 3.6, sx: 2.6, sy: 0.6, sz: 1.35 }), 0x221a18));
        return merge(Pp);
      })());
      veh.push((() => { // open wagon heaped with presents
        const Pp = [], len = TRAIN.lens[2];
        box(Pp, BLK, len - 0.4, 0.45, 2.9, 0, 1.1, 0);
        wheels(Pp, [2.4, -2.4], 0.75);
        rbox(Pp, RED, len - 0.5, 1.7, 3.1, 0, 2.15, 0, 0.12);
        for (const sz of [-1.57, 1.57]) box(Pp, GOLD, len - 0.9, 0.14, 0.06, 0, 2.7, sz);
        const gc = [0x2a6ad0, 0xf2c21a, 0x23a33a, 0xf3ead8, 0x9a3ac0, 0xe8202e];
        [[-2.2, 0, 1.8, 1.6, 2.2], [0.2, -0.5, 1.6, 2.0, 1.6], [2.3, 0.3, 1.9, 1.5, 2.0], [-0.6, 0.8, 1.2, 1.2, 1.2], [1.4, -0.4, 1.0, 1.0, 1.0]].forEach(([x, z, w, h, d], i) => {
          box(Pp, gc[i], w, h, d, x, 3.0 + h / 2 - (i > 2 ? -1.3 : 0), z, { ry: i * 0.4 });
          box(Pp, i % 2 ? 0xe8202e : 0xf2d36b, w + 0.04, h + 0.04, 0.22, x, 3.0 + h / 2 - (i > 2 ? -1.3 : 0), z, { ry: i * 0.4 });
        });
        return merge(Pp);
      })());
      veh.push((() => { // flat wagon carrying a little fir tree
        const Pp = [], len = TRAIN.lens[3];
        box(Pp, BLK, len - 0.4, 0.45, 2.9, 0, 1.1, 0);
        wheels(Pp, [2.4, -2.4], 0.75);
        rbox(Pp, GRN, len - 0.5, 0.7, 3.1, 0, 1.65, 0, 0.12);
        for (const [x, z] of [[-3.4, -1.3], [3.4, -1.3], [-3.4, 1.3], [3.4, 1.3]]) cyl(Pp, GOLD, 0.12, 0.12, 1.4, x, 2.6, z, {}, 6);
        cyl(Pp, 0x7a4a24, 0.9, 1.0, 1.1, 0, 2.5, 0, {}, 12);
        for (let k = 0; k < 3; k++) Pp.push(colorize(xf(new T.ConeGeometry(1.9 - k * 0.45, 2.2, 9), { y: 4.0 + k * 1.25 }), 0x2a6e3c));
        for (let k = 0; k < 7; k++) { const a = k * 2.4; sph(Pp, [0xe8202e, 0xf2c21a, 0x2a6ad0][k % 3], 0.22, Math.cos(a) * (1.4 - k * 0.15), 3.6 + k * 0.42, Math.sin(a) * (1.4 - k * 0.15)); }
        Pp.push(colorize(xf(new T.OctahedronGeometry(0.45, 0), { y: 7.9 }), 0xfff2a0));
        return merge(Pp);
      })());
      veh.push((() => { // caboose with a cupola
        const Pp = [], len = TRAIN.lens[4];
        box(Pp, BLK, len - 0.4, 0.45, 2.9, 0, 1.1, 0);
        wheels(Pp, [2.1, -2.1], 0.75);
        rbox(Pp, RED, len - 1.6, 2.8, 3.0, 0, 2.8, 0, 0.15);
        rbox(Pp, BLK, len - 1.0, 0.3, 3.4, 0, 4.35, 0, 0.12);
        rbox(Pp, RED, 2.0, 1.2, 2.2, 0, 5.0, 0, 0.12); rbox(Pp, BLK, 2.4, 0.22, 2.6, 0, 5.7, 0, 0.1);
        for (const sz of [-1.52, 1.52]) for (const x of [-1.6, 0, 1.6]) box(Pp, 0xffd27a, 0.9, 0.9, 0.06, x, 3.2, sz);
        for (const e of [-1, 1]) box(Pp, GOLD, 0.7, 0.12, 3.0, e * (len / 2 - 0.4), 1.55, 0);
        return merge(Pp);
      })());
      const trainMat = K.phys({ vertexColors: true, roughness: 0.3, metalness: 0.25, clearcoat: 0.7, clearcoatRoughness: 0.18 });
      A.trainMeshes = veh.map((g) => { const m = new T.Mesh(g, trainMat); m.castShadow = true; m.receiveShadow = true; K.group.add(m); keep.push(m); return m; });
      A.trainShadow = TRAIN.lens.map((l) => { const m = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.45, alphaMap: TX.blobShadowTexture(), depthWrite: false })); m.rotation.x = -PI / 2; m.scale.set(l + 1.4, 4.6, 1); m.renderOrder = 1; K.group.add(m); keep.push(m); return m; });
      A.lamp = (() => { const m = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ color: 0xffd890, transparent: true, opacity: 0.35, alphaMap: TX.blobShadowTexture(), depthWrite: false, blending: T.AdditiveBlending })); m.rotation.x = -PI / 2; m.scale.set(12, 7, 1); m.renderOrder = 2; K.group.add(m); keep.push(m); return m; })();
      TRAIN.lens.forEach((len, i) => {
        K.mover({ type: 'capsule', r: TRAIN.r, h: TRAIN.h }, (t) => {
          const hs = headS(t) - A.off[i];
          const p = rail.at(hs - 1.0), q = rail.at(hs - len + 1.0);
          return { x1: p.x, z1: p.z, x2: q.x, z2: q.z };
        });
      });
    }

    // ---------------------------------------------------------------- shared little geometries and textures
    const gumG = K.lathe([[0.001, 1.05], [0.42, 1.0], [0.68, 0.78], [0.8, 0.42], [0.82, 0.08], [0.7, 0]], 10);
    const GUMC = [0xe8202e, 0x23a33a, 0xf2c21a, 0xf26a1a, 0x9a3ac0, 0xf6f0e6, 0x2a7ad8];
    const WARM = [1.75, 0.9, 0.26]; // window glow (over-bright vertex colour = bloom-ish)
    const warmC = (k = 1) => new T.Color(WARM[0] * k, WARM[1] * k, WARM[2] * k);
    // per-triangle colouring from the triangle centroid (crisp candy stripes without textures)
    const triColor = (g, fn) => {
      g = g.index ? g.toNonIndexed() : g;
      const p = g.attributes.position, n = p.count, a = new Float32Array(n * 3), c = new T.Color();
      for (let i = 0; i < n; i += 3) {
        const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3, z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
        c.set(fn(x, y, z));
        for (let k = 0; k < 3; k++) { a[(i + k) * 3] = c.r; a[(i + k) * 3 + 1] = c.g; a[(i + k) * 3 + 2] = c.b; }
      }
      g.setAttribute('color', new T.BufferAttribute(a, 3));
      return g;
    };
    const CR = 0xd2172a, CW = 0xfbf7f2;
    const caneShaft = (len, rad) => triColor(new T.CylinderGeometry(rad, rad, len, 7, Math.max(2, Math.round(len / (rad * 2.2))), true), (x, y, z) => ((((Math.atan2(z, x) / TAU) + y / (rad * 5)) % 1 + 1) % 1 < 0.42 ? CR : CW));
    const caneHook = (rad) => triColor(new T.TorusGeometry(rad * 3.2, rad, 6, 10, PI), (x, y, z) => { const a = Math.atan2(y, x); const b = Math.atan2(z, Math.hypot(x, y) - rad * 3.2); return ((((a * rad * 3.2) / (rad * 5) + b / TAU) % 1 + 1) % 1 < 0.42 ? CR : CW); });
    const pepCyl = () => triColor(new T.CylinderGeometry(0.62, 0.62, 0.16, 16), (x, y, z) => (Math.abs(y) < 0.07 ? CW : (Math.floor(((Math.atan2(z, x) + TAU) % TAU) / (TAU / 8)) % 2 ? CR : CW)));
    const pepGeo = (rad) => triColor(new T.CircleGeometry(rad, 16), (x, y) => (Math.floor(((Math.atan2(y, x) + TAU) % TAU) / (TAU / 8)) % 2 ? CR : CW));
    // placed parts that already carry their own vertex colours
    const fp = (f, g, o, mat, cast = true) => { const gg = xf(g, o); const c = gg.attributes.color; const out = f(gg, 0xffffff, {}, mat, cast); out.setAttribute('color', c); return out; };
    // candy cane: shaft along +y, hook at the top bending towards +x
    const cane = (f, x, y, z, ry, len, rad, o = {}) => {
      fp(f, caneShaft(len, rad), { x, y: y + len / 2, z, ry, ...o }, mCandy);
      fp(f, caneHook(rad), { x: x + Math.cos(-ry) * rad * 3.2, y: y + len, z: z + Math.sin(-ry) * rad * 3.2, ry, ...o }, mCandy);
    };

    // ---------------------------------------------------------------- gingerbread houses (front + gable face +z in local space)
    const houses = [];
    const house = (cx, cz, ry, o = {}) => {
      const w = o.w ?? 10, d = o.d ?? 9, h = o.h ?? 6, pitch = o.pitch ?? 0.72, tint = o.tint ?? 0xffffff;
      const f = frame(cx, 0, cz, ry);
      const rise = (w / 2) * Math.tan(pitch), ov = 0.9, oz = 0.8;
      f(new T.BoxGeometry(w, h, d), tint, { y: h / 2 }, mGinger);
      const tri = new T.Shape(); tri.moveTo(-w / 2, 0); tri.lineTo(w / 2, 0); tri.lineTo(0, rise); tri.closePath();
      const prism = new T.ExtrudeGeometry(tri, { depth: d, bevelEnabled: false }); prism.translate(0, 0, -d / 2);
      f(prism, tint, { y: h }, mGinger);
      // roof slabs: gingerbread under a thick layer of icing snow with drips and icicles
      const Ls = (w / 2 + ov) / Math.cos(pitch), roofCol = o.roof ?? 0xffffff;
      for (const sd of [-1, 1]) {
        const mx = sd * (w / 2 + ov) / 2, my = h + rise - ((w / 2 + ov) / 2) * Math.tan(pitch);
        const nx = sd * Math.sin(pitch), ny = Math.cos(pitch);
        f(new T.BoxGeometry(Ls, 0.55, d + oz * 2), tint, { x: mx + nx * 0.28, y: my + ny * 0.28, rz: -sd * pitch }, mGinger);
        if (o.shingles) {
          for (let row = 0; row < 5; row++) for (let k = 0; k < Math.floor((d + oz * 2) / 1.5); k++) {
            const a = (row / 5 - 0.42) * Ls * 0.95, zz = -(d + oz * 2) / 2 + 0.75 + k * 1.5 + (row % 2) * 0.5;
            if (zz > (d + oz * 2) / 2 - 0.5) continue;
            f(new T.CylinderGeometry(0.72, 0.72, 0.2, 7, 1), o.shingles[(row + k) % o.shingles.length], { x: mx + nx * 0.65 + Math.cos(pitch) * a * sd, y: my + ny * 0.65 - Math.sin(pitch) * a, z: zz, rz: -sd * pitch - sd * 0.12 }, mCandy);
          }
        } else {
          f(new K.RoundedBoxGeometry(Ls - 0.2, 0.55, d + oz * 2 - 0.1, 1, 0.24), roofCol, { x: mx + nx * 0.78, y: my + ny * 0.78, rz: -sd * pitch }, mIcing);
          // a few candies pressed into the icing: peppermints and sprinkles
          const cs = Math.cos(pitch), sn = Math.sin(pitch);
          for (let k = 0; k < 2; k++) {
            const a = r.range(-0.25, 0.25) * Ls, zz = (k ? 1 : -1) * (d * 0.22 + r.range(-0.5, 0.5));
            fp(f, pepCyl(), { x: mx + nx * 1.1 + sd * cs * a, y: my + ny * 1.1 - sn * a, z: zz, rz: -sd * pitch }, mCandy, false);
          }
          for (let k = 0; k < 9; k++) {
            const a = r.range(-0.4, 0.4) * Ls, zz = r.range(-0.45, 0.45) * d;
            f(new T.CylinderGeometry(0.1, 0.1, 0.55, 4), r.pick([0xe8202e, 0x23a33a, 0xf2c21a, 0x2a7ad8, 0xf26a1a]), { x: mx + nx * 1.08 + sd * cs * a, y: my + ny * 1.08 - sn * a, z: zz, rx: PI / 2, ry: r() * 3, rz: -sd * pitch }, mCandy, false);
          }
        }
        // icicles hanging from the eave
        const ex = sd * (w / 2 + ov) * 0.985, ey = h + rise - (w / 2 + ov) * Math.tan(pitch) + 0.15;
        for (let zz = -d / 2 - oz + 0.4; zz < d / 2 + oz - 0.2; zz += 0.75) {
          const l = 0.35 + r() * 0.9;
          f(new T.ConeGeometry(0.17, l, 5, 1, true), 0xf4f8ff, { x: ex, y: ey - l / 2, z: zz, rx: PI }, mIcing, false);
        }
      }
      // piped icing along the front and back gable edges
      for (const ez of [d / 2 + oz, -d / 2 - oz]) for (const sd of [-1, 1]) {
        const len = Ls + 0.1;
        f(new T.CylinderGeometry(0.24, 0.24, len, 6), 0xffffff, { x: sd * (w / 2 + ov) / 2 + sd * 0.4, y: h + rise - ((w / 2 + ov) / 2) * Math.tan(pitch) + 0.95, z: ez, rz: PI / 2 - sd * pitch }, mIcing);
        for (let k = 0; k < 4; k++) { const t = (k + 0.5) / 4; f(new T.IcosahedronGeometry(0.24, 0), 0xffffff, { x: sd * (w / 2 + ov) * t + sd * 0.2, y: h + rise - (w / 2 + ov) * t * Math.tan(pitch) + 0.5, z: ez + Math.sign(ez) * 0.12 }, mIcing, false); }
      }
      // gumdrops along the ridge
      for (let k = 0; k < 5; k++) { const zz = -d / 2 - oz + 0.6 + k * (d + oz * 2 - 1.2) / 4; f(gumG.clone(), r.pick(GUMC), { y: h + rise + 0.95, z: zz, s: 0.62 }, mSugared); }
      // chimney
      if (o.chimney !== false) {
        const sd = r.sign(), cxl = sd * w * 0.22, cy = h + rise - Math.abs(cxl) * Math.tan(pitch);
        f(new T.BoxGeometry(1.5, 3.2, 1.5), tint, { x: cxl, y: cy + 1.2, z: -d * 0.18 }, mGinger);
        f(new K.RoundedBoxGeometry(1.9, 0.5, 1.9, 1, 0.2), 0xffffff, { x: cxl, y: cy + 2.95, z: -d * 0.18 }, mIcing);
        A.chimneys = A.chimneys || [];
        const [wx, wz] = [cx + Math.cos(-ry) * cxl - Math.sin(-ry) * (-d * 0.18), cz + Math.sin(-ry) * cxl + Math.cos(-ry) * (-d * 0.18)];
        A.chimneys.push([wx, cy + 3.4, wz]);
      }
      // base piping
      for (const [bx, bz, bl, rot] of [[0, d / 2, w, 0], [0, -d / 2, w, 0], [w / 2, 0, d, PI / 2], [-w / 2, 0, d, PI / 2]]) f(new T.CylinderGeometry(0.32, 0.32, bl + 0.5, 6), 0xffffff, { x: bx, y: 0.25, z: bz, rz: PI / 2, ry: rot }, mIcing, false);
      // windows (glowing candy glass in icing frames) and the door
      const win = (lx, ly, lz, rot, ww = 1.7, wh = 1.9) => {
        const fo = { ry: rot };
        const off = (dd) => [lx + Math.sin(rot) * dd, lz + Math.cos(rot) * dd];
        let [x1, z1] = off(0.06); f(new T.BoxGeometry(ww + 0.6, wh + 0.6, 0.14), 0xffffff, { x: x1, y: ly, z: z1, ...fo }, mIcing, false);
        [x1, z1] = off(0.16); f(new T.PlaneGeometry(ww, wh), 0xffffff, { x: x1, y: ly, z: z1, ...fo }, mGlow, false, 1).attributes.color.array.forEach((v, i, a) => { a[i] = WARM[i % 3] * (0.85 + (o.glow ?? 0) ); });
        [x1, z1] = off(0.24); f(new T.BoxGeometry(0.16, wh, 0.1), 0xffffff, { x: x1, y: ly, z: z1, ...fo }, mIcing, false); f(new T.BoxGeometry(ww, 0.16, 0.1), 0xffffff, { x: x1, y: ly, z: z1, ...fo }, mIcing, false);
        // sill with a dab of snow
        [x1, z1] = off(0.3); f(new T.BoxGeometry(ww + 0.9, 0.3, 0.6), 0xffffff, { x: x1, y: ly - wh / 2 - 0.35, z: z1, ...fo }, mIcing, false);
        // light pool on the snow in front
        const [gx, gz] = off(3.2), wpt = new T.Vector3(gx, 0, gz).applyMatrix4(new T.Matrix4().makeRotationY(ry)).add(new T.Vector3(cx, 0, cz));
        GLOW(wpt.x, snowY(wpt.x, wpt.z) + 0.12, wpt.z, 6.5, 0xff9a40, 0.32);
      };
      const wy = h * 0.55;
      if (o.door !== false) {
        f(new K.RoundedBoxGeometry(2.3, 3.5, 0.4, 1, 0.15), 0x5a2e16, { y: 1.75, z: d / 2 + 0.1 }, mChoc);
        f(new T.TorusGeometry(1.25, 0.18, 6, 14, PI), 0xffffff, { y: 3.0, z: d / 2 + 0.32 }, mIcing, false);
        for (const sd of [-1, 1]) f(new T.CylinderGeometry(0.18, 0.18, 2.9, 6), 0xffffff, { x: sd * 1.25, y: 1.5, z: d / 2 + 0.32 }, mIcing, false);
        f(new T.SphereGeometry(0.2, 8, 6), 0xf2c21a, { x: 0.7, y: 1.7, z: d / 2 + 0.36 }, mMetal, false);
        win(-w * 0.3, wy, d / 2, 0, 1.5, 1.6); win(w * 0.3, wy, d / 2, 0, 1.5, 1.6);
        fp(f, pepGeo(0.75), { y: h + rise * 0.42, z: d / 2 + 0.06 }, mCandy, false);
        for (const sd of [-1, 1]) cane(f, sd * 1.9, 0, d / 2 + 0.8, sd > 0 ? PI : 0, 2.6, 0.17);
        // warm spill of light out of the door
        const dp = new T.Vector3(0, 0, d / 2 + 3).applyMatrix4(new T.Matrix4().makeRotationY(ry)).add(new T.Vector3(cx, 0, cz));
        GLOW(dp.x, snowY(dp.x, dp.z) + 0.12, dp.z, 5, 0xffb060, 0.22);
      } else { win(-w * 0.25, wy, d / 2, 0); win(w * 0.25, wy, d / 2, 0); }
      win(-w * 0.25, wy, -d / 2, PI); win(w * 0.25, wy, -d / 2, PI);
      for (const sd of [-1, 1]) for (const k of (d > 8 ? [-0.24, 0.24] : [0])) win(sd * w / 2, wy, k * d, sd * PI / 2, 1.5, 1.7);
      // round attic window in the front gable
      if (o.attic !== false && (o.door === false || rise > 3.2)) {
        f(new T.TorusGeometry(0.7, 0.2, 6, 16), 0xffffff, { y: h + rise * 0.4, z: d / 2 + 0.15 }, mIcing, false);
        const c = f(new T.CircleGeometry(0.62, 14), 0xffffff, { y: h + rise * 0.4, z: d / 2 + 0.08 }, mGlow, false);
        c.attributes.color.array.forEach((v, i, a) => { a[i] = WARM[i % 3] * 0.8; });
      }
      // icing dots up the corners
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (let k = 0; k < 5; k++) f(new T.IcosahedronGeometry(0.22, 0), 0xffffff, { x: sx * (w / 2 + 0.05), y: 0.9 + k * (h - 1.2) / 4, z: sz * (d / 2 + 0.05) }, mIcing, false);
      const R = Math.hypot(w, d) / 2;
      AO(cx, cz, w / 2 + 2.2, d / 2 + 2.2, 0.5, -ry);
      K.box(cx, cz, w / 2 + 0.3, d / 2 + 0.3, -ry, h + rise);
      warnRoad('house', cx, cz, R - 1);
      block(cx, cz, R + 1);
      houses.push({ x: cx, z: cz, w, d, ry });
    };

    // sugar-cone fir trees: green royal icing with snowy tips
    const tree = (x, z, s = 1, col = 0x2c7a43) => {
      const f = frame(x, snowY(x, z) - 0.2, z, r() * TAU, s);
      f(new T.CylinderGeometry(0.4, 0.5, 1.2, 6), 0x6a3a1c, { y: 0.6 }, mGinger, false);
      for (let k = 0; k < 3; k++) {
        const rr = 2.4 - k * 0.62, y0 = 1.2 + k * 1.55;
        f(new T.ConeGeometry(rr, 2.5, 9), col, { y: y0 + 1.25, ry: k }, mSugared);
        f(new T.ConeGeometry(rr * 0.62, 1.15, 9), 0xffffff, { y: y0 + 2.0, ry: k + 0.3 }, mIcing, false);
      }
      for (let k = 0; k < 4; k++) { const a = k * 1.7 + r() * 2, hh = 1.6 + r() * 3.4, rr = 2.2 - (hh - 1.2) * 0.38; f(new T.SphereGeometry(0.2, 6, 4), r.pick([0xe8202e, 0xf2c21a, 0xf6f0e6, 0x2a7ad8]), { x: Math.cos(a) * rr, y: hh, z: Math.sin(a) * rr }, mCandy, false); }
      AO(x, z, 2.8 * s, 2.8 * s, 0.45);
      K.circle(x, z, 1.6 * s, 8 * s);
      warnRoad('tree', x, z, 2 * s);
      block(x, z, 3 * s);
    };
    // marzipan snowman
    const snowman = (x, z, ry, s = 1) => {
      const f = frame(x, snowY(x, z), z, ry, s);
      for (const [y, rr] of [[1.25, 1.35], [3.1, 1.0], [4.55, 0.72]]) f(new T.SphereGeometry(rr, 10, 7), 0xfbf8f0, { y }, mIcing);
      f(new T.ConeGeometry(0.16, 0.9, 6), 0xf06a14, { x: 0.95, y: 4.55, rz: -PI / 2 }, mCandy, false);
      for (const sz of [-0.25, 0.25]) f(new T.SphereGeometry(0.1, 5, 4), 0x111111, { x: 0.62, y: 4.8, z: sz }, mChoc, false);
      f(new T.TorusGeometry(0.78, 0.2, 6, 14), 0xc41a24, { y: 3.8, rx: PI / 2 }, mMatte, false);
      f(new T.CylinderGeometry(0.62, 0.62, 0.9, 10), 0x1a1414, { y: 5.6 }, mChoc);
      f(new T.CylinderGeometry(0.95, 0.95, 0.12, 12), 0x1a1414, { y: 5.18 }, mChoc);
      for (let k = 0; k < 3; k++) f(new T.SphereGeometry(0.1, 5, 4), 0x111111, { x: 0.98 - k * 0.03, y: 2.7 + k * 0.42 }, mChoc, false);
      AO(x, z, 1.8 * s, 1.8 * s, 0.4);
      K.circle(x, z, 1.3 * s, 6 * s);
      warnRoad('snowman', x, z, 1.5);
    };
    // gingerbread man (standing figure or lying cookie)
    const gmShape = (() => {
      const s = new T.Shape();
      s.absarc(0, 3.0, 0.95, -PI / 2 + 0.6, PI * 1.5 - 0.6, false);
      s.lineTo(-0.5, 1.9); s.lineTo(-1.9, 2.0); s.quadraticCurveTo(-2.3, 1.6, -1.8, 1.2); s.lineTo(-0.75, 1.0);
      s.lineTo(-0.85, -0.3); s.lineTo(-1.5, -2.0); s.quadraticCurveTo(-1.2, -2.5, -0.8, -2.2); s.lineTo(0, -0.9);
      s.lineTo(0.8, -2.2); s.quadraticCurveTo(1.2, -2.5, 1.5, -2.0); s.lineTo(0.85, -0.3); s.lineTo(0.75, 1.0);
      s.lineTo(1.8, 1.2); s.quadraticCurveTo(2.3, 1.6, 1.9, 2.0); s.lineTo(0.5, 1.9); s.closePath();
      return s;
    })();
    const gmGeo = () => { const g = new T.ExtrudeGeometry(gmShape, { depth: 0.55, bevelEnabled: true, bevelThickness: 0.18, bevelSize: 0.16, bevelSegments: 2, curveSegments: 6 }); g.translate(0, 0, -0.28); return g; };
    const gmIcing = (add) => { // eyes, smile, buttons, squiggles at wrists and ankles
      for (const ex of [-0.33, 0.33]) add(new T.SphereGeometry(0.14, 6, 4), 0xffffff, { x: ex, y: 3.2, z: 0.5 });
      for (let k = 0; k < 3; k++) add(new T.SphereGeometry(0.2, 6, 4), [0xe8202e, 0x23a33a, 0xf2c21a][k], { x: 0, y: 1.4 - k * 0.6, z: 0.5 });
      for (const sx of [-1, 1]) { add(new T.BoxGeometry(0.12, 0.7, 0.1), 0xffffff, { x: sx * 1.55, y: 1.6, z: 0.48, rz: 0.4 * sx }); add(new T.BoxGeometry(0.7, 0.12, 0.1), 0xffffff, { x: sx * 1.1, y: -1.75, z: 0.48, rz: -0.9 * sx }); }
      add(new T.TorusGeometry(0.35, 0.06, 4, 10, PI), 0xffffff, { x: 0, y: 2.9, z: 0.5, rz: PI });
    };
    const gingerMan = (x, z, ry, s = 1) => {
      const f = frame(x, snowY(x, z), z, ry, s);
      f(gmGeo(), 0xe0a070, { y: 2.45 }, mGinger);
      gmIcing((g, c, o) => f(g, c, { ...o, y: o.y + 2.45 }, c === 0xffffff ? mIcing : mCandy, false));
      AO(x, z, 2.2 * s, 1 * s, 0.35, -ry);
      K.capsule(x - Math.cos(-ry) * 1.6 * s, z - Math.sin(-ry) * 1.6 * s, x + Math.cos(-ry) * 1.6 * s, z + Math.sin(-ry) * 1.6 * s, 0.6 * s, 5 * s);
      warnRoad('ginger man', x, z, 2);
    };
    // candy-cane lamp post with a lantern on the hook
    const lamp = (x, z, ry) => {
      const f = frame(x, 0, z, ry);
      cane(f, 0, 0, 0, 0, 8.6, 0.32);
      f(new T.CylinderGeometry(0.05, 0.05, 0.8, 4), 0x222222, { x: 2.05, y: 8.3 }, mMetal, false);
      f(new T.CylinderGeometry(0.7, 0.55, 0.22, 6), 0xd8a838, { x: 2.05, y: 6.55 }, mMetal);
      f(new T.ConeGeometry(0.62, 0.5, 6), 0xd8a838, { x: 2.05, y: 8.1 }, mMetal);
      const gl = f(new T.SphereGeometry(0.78, 10, 8), 0xffffff, { x: 2.05, y: 7.3, sy: 1.15 }, mGlow, false);
      gl.attributes.color.array.forEach((v, i, a) => { a[i] = [1.9, 1.15, 0.4][i % 3]; });
      const [lx, lz] = [x + Math.cos(-ry) * 2.05, z + Math.sin(-ry) * 2.05];
      GLOW(lx, snowY(lx, lz) + 0.12, lz, 11, 0xffb060, 0.38);
      GLOW(lx, 7.3, lz, 3.4, 0xffc880, 0.5);
      AO(x, z, 0.9, 0.9, 0.45);
      K.circle(x, z, 0.5, 9);
      warnRoad('lamp', x, z, 0.8);
    };
    // candy-cane picket fence along a line
    const fence = (x1, z1, x2, z2) => {
      const len = Math.hypot(x2 - x1, z2 - z1), a = Math.atan2(z2 - z1, x2 - x1), n = Math.max(2, Math.round(len / 1.5));
      const f = frame(x1, 0, z1, -a);
      for (let k = 0; k <= n; k++) { const lx = (k / n) * len; f(new T.CylinderGeometry(0.16, 0.16, 2.4, 6), k % 2 ? 0xd2172a : 0xfbf7f2, { x: lx, y: snowY(x1 + Math.cos(a) * lx, z1 + Math.sin(a) * lx) + 1.1 }, mCandy); f(new T.SphereGeometry(0.22, 6, 4), 0xfbf7f2, { x: lx, y: snowY(x1 + Math.cos(a) * lx, z1 + Math.sin(a) * lx) + 2.35 }, mCandy, false); }
      for (const y of [0.8, 1.7]) f(new T.BoxGeometry(len, 0.22, 0.18), 0xf3ead8, { x: len / 2, y: y + 0.2 }, mIcing);
    };

    // ---------------------------------------------------------------- the village: main street through the railway loop
    {
      const shingles = [[0xf6c6d8, 0xc8e6f6, 0xf6f0c0, 0xd2f0d0], [0x7a3a1e, 0x5a2a12, 0x8a4a26]];
      // north side (fronts face the street and the camera)
      house(-44, -64, 0, { w: 9.5, d: 8.5, h: 6, tint: 0xfff0e0 });
      house(-27, -64.5, 0, { w: 11, d: 9, h: 6.5, shingles: shingles[0] });
      house(22, -64.5, 0, { w: 10.5, d: 9, h: 6, tint: 0xf0d8c0 });
      house(38.5, -63.5, 0, { w: 9, d: 8, h: 5.5, shingles: shingles[1], tint: 0xfff4e8 });
      // south side (backs to the hairpin, lower so they never hide the road)
      house(-42, -30, PI, { w: 10, d: 8, h: 5, pitch: 0.62, tint: 0xf4dcc4 });
      house(-24, -30.5, PI, { w: 9.5, d: 8, h: 5, pitch: 0.62, shingles: shingles[0] });
      house(-6, -30, PI, { w: 10.5, d: 8, h: 5.2, pitch: 0.6 });
      house(13, -30.5, PI, { w: 9.5, d: 8, h: 5, pitch: 0.62, tint: 0xffeedd, shingles: shingles[1] });
      house(31, -30, PI, { w: 10, d: 8, h: 5, pitch: 0.62, tint: 0xf0d8c0 });
      for (const x of [-52, -35.5, -15, 12, 30, 47]) lamp(x, -57.2, x > 0 ? PI : 0);
      for (const x of [-51, -34, -15, 4, 23, 40]) lamp(x, -37.4, x > 0 ? PI : 0);
      // the church: nave with stained glass, a bell tower and spire with a golden star
      {
        const cx = -3, cz = -64.5, w = 13, d = 11, h = 8.5;
        house(cx, cz, 0, { w, d, h, pitch: 0.82, chimney: false, attic: false, tint: 0xf2d6b8 });
        const f = frame(cx + 10, 0, cz + 0.5, 0);
        f(new T.BoxGeometry(6.2, 17, 6.2), 0xf2d6b8, { y: 8.5 }, mGinger);
        f(new K.RoundedBoxGeometry(6.9, 0.7, 6.9, 2, 0.25), 0xffffff, { y: 17.2 }, mIcing);
        f(new T.ConeGeometry(4.6, 13, 4), 0xffffff, { y: 24.1, ry: PI / 4 }, mIcing);
        f(new T.ConeGeometry(4.75, 2.4, 4), 0xf2d6b8, { y: 18.6, ry: PI / 4 }, mGinger);
        const st = f(new T.OctahedronGeometry(0.9, 0), 0xffffff, { y: 31.4, sy: 1.3 }, mGlow, false); st.attributes.color.array.forEach((v, i, a) => { a[i] = [2.8, 2.2, 1.0][i % 3]; });
        // belfry openings and a clock face
        for (const [rx, rz, rot] of [[0, 3.15, 0], [3.15, 0, PI / 2], [-3.15, 0, -PI / 2]]) {
          const g = f(new T.PlaneGeometry(1.6, 2.6), 0xffffff, { x: rx, y: 14.2, z: rz, ry: rot }, mGlow, false); g.attributes.color.array.forEach((v, i, a) => { a[i] = WARM[i % 3] * 1.1; });
          f(new T.TorusGeometry(0.85, 0.16, 5, 12, PI), 0xffffff, { x: rx * 1.02, y: 15.5, z: rz * 1.02, ry: rot }, mIcing, false);
        }
        f(new T.CircleGeometry(1.5, 20), 0xfbf6ea, { y: 10.2, z: 3.16 }, mIcing, false);
        f(new T.BoxGeometry(0.16, 1.1, 0.06), 0x1a1414, { y: 10.6, z: 3.22 }, mChoc, false); f(new T.BoxGeometry(0.8, 0.16, 0.06), 0x1a1414, { x: 0.35, y: 10.2, z: 3.22 }, mChoc, false);
        f(new T.TorusGeometry(1.5, 0.15, 5, 20), 0xf2c21a, { y: 10.2, z: 3.17 }, mMetal, false);
        // rose window (coloured sugar glass)
        const rose = [[2.6, 0.5, 0.6], [0.6, 1.2, 2.6], [2.4, 2.0, 0.5], [0.6, 2.0, 0.8]];
        for (let k = 0; k < 8; k++) { const a = k * PI / 4; const g = f(new T.CircleGeometry(0.42, 8), 0xffffff, { x: Math.cos(a) * 0.95 - 10, y: h + 3.1 + Math.sin(a) * 0.95, z: d / 2 - 0.4 }, mGlow, false); g.attributes.color.array.forEach((v, i, arr) => { arr[i] = rose[k % 4][i % 3]; }); }
        AO(cx + 10, cz + 0.5, 4.6, 4.6, 0.5);
        K.box(cx + 10, cz + 0.5, 3.2, 3.2, 0, 32);
        GLOW(cx, snowY(cx, cz + 9) + 0.12, cz + 9.5, 14, 0xff9a40, 0.3);
      }
      // trees and figures in the gaps
      for (const [x, z, s] of [[-58, -60, 1.1], [-56, -34, 0.9], [-11, -71, 0.8], [52, -61, 1.0], [53, -34, 1.1], [44, -27, 0.75], [-51, -25, 0.8], [5, -24, 0.7], [-16, -26, 0.7], [-35, -71, 0.8], [30, -71, 0.8]]) tree(x, z, s);
      snowman(-37.5, -61.8, 0.4, 0.9); snowman(30.6, -61.5, -0.3, 0.85);
      gingerMan(-19.5, -59.5, 0.25, 0.8); gingerMan(-30.5, -34.6, 2.9, 0.75); gingerMan(19.5, -34.6, 3.3, 0.75);
    }

    // ---------------------------------------------------------------- snow mounds (drifts on the road), built like the snow field
    const snowMat2 = K.std({ vertexColors: true, roughness: 0.82, normalMap: sugarN, normalScale: V2(0.7), alphaHash: true, envMapIntensity: 0.8 });
    const mound = (cx, cz, rx, rz, ang, hgt) => {
      const n = 22, pos = [], col = [], idx = [];
      const ca = Math.cos(ang), sa = Math.sin(ang);
      for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
        const u = (i / n) * 2 - 1, v = (j / n) * 2 - 1, d = Math.hypot(u, v);
        const wob = 1 + (n1(cx + u * 9, cz + v * 9, 6) - 0.5) * 0.5;
        const t = clamp(1 - d / wob, 0, 1);
        const lx = u * rx, lz = v * rz, x = cx + lx * ca - lz * sa, z = cz + lx * sa + lz * ca;
        pos.push(x, Math.max(snowY(x, z), 0.08) + hgt * Math.pow(t, 0.8) * (0.75 + 0.5 * n1(x, z, 11)), z);
        const k = 0.94 + 0.06 * t;
        col.push(0.93 * k, 0.96 * k, 1.0 * k, ss(0.0, 0.3, t));
      }
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, e = c + 1; idx.push(a, c, b, b, c, e); }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 4));
      const uv = []; for (let k = 0; k < pos.length; k += 3) uv.push(pos[k] / 6, pos[k + 2] / 6); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals();
      const m = new T.Mesh(g, snowMat2); m.receiveShadow = true; m.castShadow = true; K.group.add(m); keep.push(m);
      const poly = []; for (let k = 0; k < 24; k++) { const a = (k / 24) * TAU, lx = Math.cos(a) * rx * 0.8, lz = Math.sin(a) * rz * 0.8; poly.push([cx + lx * ca - lz * sa, cz + lx * sa + lz * ca]); }
      return poly;
    };
    // deep sugar-snow drifts blown across the outside of two corners
    for (const [s, off, rx, rz] of [[300, -4.2, 9, 5.5], [722, -4.4, 9, 5]]) {
      const p = track.place(s, off);
      K.surface('slow', { poly: mound(p.x, p.z, rx, rz, p.angle, 0.9) });
    }

    // ---------------------------------------------------------------- the skating pond: a disc of frozen syrup in the hairpin pocket
    const iceMat = K.phys({ color: 0xa8d0ff, roughness: 0.05, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, opacity: 0.62, envMapIntensity: 1.8 });
    {
      const cx = 0, cz = 50, R = 13.5;
      K.mesh(new T.CircleGeometry(R, 48), K.std({ color: 0x163a6e, roughness: 0.3 }), cx, 0.08, cz, { rx: -PI / 2, cast: false });
      K.mesh(new T.CylinderGeometry(R, R, 0.3, 48, 1, true), iceMat, cx, 0.25, cz, { cast: false });
      K.mesh(new T.CircleGeometry(R, 48), iceMat, cx, 0.4, cz, { rx: -PI / 2, cast: false });
      // a rim of piped icing and sugar-snow banks
      K.mesh(colorize(new T.TorusGeometry(R + 0.3, 0.75, 8, 64), 0xf6f8ff), mIcing, cx, 0.35, cz, { rx: PI / 2 });
      // skating scratches on the ice
      const sc = TX.labelTexture(256, 256, (g) => { g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1.2; for (let k = 0; k < 26; k++) { g.beginPath(); const rr = 30 + Math.random() * 90, a0 = Math.random() * TAU; g.arc(128 + (Math.random() - 0.5) * 30, 128 + (Math.random() - 0.5) * 30, rr, a0, a0 + 1 + Math.random() * 2.5); g.stroke(); } });
      K.mesh(new T.CircleGeometry(R - 0.2, 48), K.std({ map: sc, transparent: true, depthWrite: false, roughness: 0.3 }), cx, 0.42, cz, { rx: -PI / 2, cast: false });
      // marzipan skaters (circle the pond in animate)
      A.skaters = [];
      const skCol = [[0xc41a24, 0xf6f0e6], [0x2a6ad0, 0xf2c21a], [0x23a33a, 0xc41a24]];
      for (let k = 0; k < 3; k++) {
        const [c1, c2] = skCol[k];
        const parts = [
          colorize(xf(K.lathe([[0.001, 0], [1.0, 0.1], [0.9, 1.6], [0.6, 2.6], [0.001, 2.8]], 12), { y: 0.5 }), c1),
          colorize(xf(new T.SphereGeometry(0.62, 12, 10), { y: 3.65 }), 0xf6d2b0),
          colorize(xf(new T.ConeGeometry(0.6, 1.2, 10), { y: 4.4 }), c2),
          colorize(xf(new T.SphereGeometry(0.25, 8, 6), { y: 5.0 }), 0xffffff),
          colorize(xf(new T.TorusGeometry(0.55, 0.18, 6, 12), { y: 3.15, rx: PI / 2 }), c2),
          colorize(xf(new T.BoxGeometry(1.4, 0.12, 0.12), { x: 0.1, y: 0.42, z: -0.35 }), 0xdde2ea),
          colorize(xf(new T.BoxGeometry(1.4, 0.12, 0.12), { x: 0.1, y: 0.42, z: 0.35 }), 0xdde2ea),
        ];
        const g = new T.Mesh(merge(parts), mCandy);
        K.add(g); keep.push(g);
        A.skaters.push({ g, r: 5 + k * 2.6, w: (k % 2 ? -1 : 1) * (0.45 + k * 0.1), ph: k * 2.1, cx, cz });
      }
      AO(cx, cz, R + 2.5, R + 2.5, 0.25);
      block(cx, cz, R + 3);
      // the pond has overflowed: a frozen rivulet runs out across the road on the north leg
      const p = track.place(80, -3.4);
      const spill = K.spill(p.x, p.z, 6.2, iceMat, { lump: 0.3, stretch: 1.8, angle: p.angle, y: 0.16, thick: 0.1 });
      K.surface('slick', { poly: spill.poly });
      for (let k = 1; k < 3; k++) { const t = k / 3; K.spill(lerp(cx + R * 0.8, p.x - 3, t), lerp(cz - 6, p.z, t), 2.2 - t * 0.6, iceMat, { lump: 0.2, stretch: 2, angle: Math.atan2(p.z - cz, p.x - cx), y: 0.14, thick: 0.08, n: 18 }); }
      for (const [x, z] of [[-17, 40], [17, 62], [-15, 64]]) lamp(x, z, x > 0 ? PI : 0);
      fence(-12, 66.5, 12, 66.5);
      // a bench of chocolate wafers beside the pond
      {
        const f = frame(-14, 0, 52, PI / 2);
        f(new K.RoundedBoxGeometry(6, 0.5, 2, 2, 0.2), 0x6a3a1c, { y: 1.6 }, mChoc);
        f(new K.RoundedBoxGeometry(6, 1.6, 0.4, 2, 0.15), 0x6a3a1c, { y: 2.6, z: -0.9 }, mChoc);
        for (const sx of [-2.4, 2.4]) f(new T.BoxGeometry(0.5, 1.4, 1.6), 0x4a2410, { x: sx, y: 0.7 }, mChoc);
        AO(-14, 52, 3.4, 1.8, 0.4, PI / 2);
      }
      snowman(15, 40, -2.5, 1.0);
      tree(-18, 28, 1.0); tree(18, 25, 0.85); tree(-6, 76, 0.9); tree(9, 80, 1.15); tree(-22, 86, 0.8);
    }

    // ---------------------------------------------------------------- the toppled mug of hot chocolate (sticky) on the south leg
    {
      const sp = 205;
      const p = track.place(sp, 3.6);
      const mx = -52, mz = 40, ang = Math.atan2(p.z - mz, p.x - mx);
      const mugMat = K.ceramic(0xc41a24, { roughness: 0.18 });
      const mug = new T.Group();
      const prof = [[3.4, 0], [4.2, 0.3], [4.6, 1.4], [4.7, 9.4], [4.4, 9.7], [4.15, 9.4], [4.1, 1.4], [0, 1.2]];
      const body = new T.Mesh(K.lathe(prof, 40), mugMat); body.castShadow = true; mug.add(body);
      const band = new T.Mesh(new T.CylinderGeometry(4.73, 4.73, 1.4, 40, 1, true), K.ceramic(0xf6f0e6)); band.position.y = 6.5; mug.add(band);
      const band2 = new T.Mesh(new T.CylinderGeometry(4.73, 4.73, 0.5, 40, 1, true), K.ceramic(0x23a33a)); band2.position.y = 5.3; mug.add(band2);
      const handle = new T.Mesh(new T.TorusGeometry(2.3, 0.6, 10, 20, PI * 1.2), mugMat); handle.position.set(-4.7, 5, 0); handle.rotation.z = PI * 0.4; mug.add(handle);
      // lying on its side, the opening towards the road
      mug.rotation.order = 'YXZ'; mug.rotation.y = -ang; mug.rotation.z = -PI / 2;
      mug.position.set(mx, 4.7, mz);
      mug.rotateY(PI / 2);
      K.add(mug);
      K.capsule(mx - Math.cos(ang) * 4, mz - Math.sin(ang) * 4, mx + Math.cos(ang) * 4, mz + Math.sin(ang) * 4, 4.7, 9.4);
      AO(mx, mz, 7, 5.5, 0.5, ang);
      block(mx, mz, 8);
      const cocoa = K.phys({ color: 0x4a2414, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 });
      const spill = K.spill(p.x, p.z, 6.8, cocoa, { lump: 0.42, stretch: 1.4, angle: p.angle + 0.4, y: 0.17, thick: 0.18 });
      K.surface('sticky', { poly: spill.poly });
      // the stream from the mouth of the mug to the road
      const [ox, oz] = [mx + Math.cos(ang) * 5.5, mz + Math.sin(ang) * 5.5];
      for (let k = 0; k < 4; k++) { const t = k / 3; K.spill(lerp(ox, p.x, t * 0.8), lerp(oz, p.z, t * 0.8), 3.2 - t, cocoa, { y: 0.15, thick: 0.14, n: 24 }); }
      // marshmallows floating out with it
      for (let k = 0; k < 6; k++) {
        const t = r(), x = lerp(ox, p.x, t) + r.range(-2, 2), z = lerp(oz, p.z, t) + r.range(-2, 2);
        P(new K.RoundedBoxGeometry(1.2, 0.9, 1.2, 2, 0.35), 0xfaf4ee, { x, y: 0.55, z, ry: r() * 3, rx: r.range(-0.3, 0.3) }, mIcing);
      }
    }

    // ---------------------------------------------------------------- the jump: a gingerbread slab up onto a big gift box, ride across its top
    {
      const pc = track.at(377), ang = pc.angle;
      const { rl, rh, bl, bw, bh } = GIFT;
      const [bx, bz] = local(pc.x, pc.z, ang, 0, -0.5);
      const [rx, rz] = local(bx, bz, ang, -(bl / 2 + rl / 2 - 0.9), 0);
      K.platform(bx, bz, bl / 2, bw / 2, ang, bh);
      K.ramp(rx, rz, ang, rl, 17.5, rh, 0);
      // wrapping paper: forest green with gold stars and fine stripes
      const wp = TX.labelTexture(512, 512, (g) => {
        g.fillStyle = '#1d5a34'; g.fillRect(0, 0, 512, 512);
        g.strokeStyle = 'rgba(255,255,255,0.06)'; g.lineWidth = 6; for (let i = -512; i < 512; i += 24) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 512, 512); g.stroke(); }
        g.fillStyle = '#e8c45a';
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
          const cx = x * 64 + (y % 2) * 32 + 16, cy = y * 64 + 24, s = 11;
          g.beginPath(); for (let k = 0; k < 10; k++) { const a = -PI / 2 + k * PI / 5, q = k % 2 ? s * 0.42 : s; g.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q); } g.closePath(); g.fill();
        }
      }, { wrap: true });
      wp.wrapS = wp.wrapT = T.RepeatWrapping; wp.repeat.set(3, 3);
      const paper = K.phys({ map: wp, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3 });
      const gift = K.mesh(new K.RoundedBoxGeometry(bl, bh, bw, 2, 0.35), paper, bx, bh / 2, bz, { ry: -ang });
      const ribbon = K.phys({ color: 0xc41a24, roughness: 0.25, clearcoat: 0.8, sheen: 1, sheenColor: new T.Color(0xff8080) });
      const grp = new T.Group(); grp.position.set(bx, 0, bz); grp.rotation.y = -ang;
      const band1 = new T.Mesh(new T.BoxGeometry(bl + 0.12, bh + 0.12, 2.6), ribbon); band1.position.set(0, bh / 2, 4.2); grp.add(band1);
      const band2 = new T.Mesh(new T.BoxGeometry(2.6, bh + 0.12, bw + 0.12), ribbon); band2.position.set(4, bh / 2, 0); grp.add(band2);
      // the bow sits beyond the road on the box's left side
      const bow = new T.Group(); bow.position.set(4, bh + 0.2, -bw / 2 + 2.6); grp.add(bow);
      for (const sd of [-1, 1]) { const loop = new T.Mesh(new T.TorusGeometry(1.9, 0.6, 8, 20), ribbon); loop.scale.set(1, 0.7, 1); loop.position.set(sd * 1.8, 1.3, 0); loop.rotation.set(0, 0, sd * 0.5); bow.add(loop); }
      const knot = new T.Mesh(new T.SphereGeometry(0.9, 12, 8), ribbon); knot.position.y = 0.8; bow.add(knot);
      for (const sd of [-1, 1]) { const tail = new T.Mesh(new T.BoxGeometry(0.9, 0.1, 4), ribbon); tail.position.set(sd * 1.2, 0.1, 2.2); tail.rotation.y = sd * 0.4; bow.add(tail); }
      K.add(grp);
      const [kx, kz] = local(bx, bz, ang, 4, -bw / 2 + 2.6);
      K.circle(kx, kz, 2.6, bh + 3.2);
      // the gingerbread slab ramp with an icing border and sugar pearls
      const slope = Math.atan2(rh, rl), Lb = Math.hypot(rl, rh) + 0.6;
      const rg = new T.Group(); rg.position.set(rx, rh / 2, rz); rg.rotation.order = 'YZX'; rg.rotation.y = -ang; rg.rotation.z = slope;
      const slab = new T.Mesh(new T.BoxGeometry(Lb, 1.0, 18), mGinger); slab.position.y = -0.5; rg.add(slab);
      slab.geometry = tidy(slab.geometry);
      for (const sd of [-1, 1]) { const ed = new T.Mesh(colorize(new T.CylinderGeometry(0.32, 0.32, Lb, 6), 0xffffff), mIcing); ed.rotation.z = PI / 2; ed.position.set(0, 0.05, sd * 8.6); rg.add(ed); }
      // arrows piped in icing
      for (const k of [-0.25, 0.15]) for (const sd of [-1, 1]) { const ar = new T.Mesh(colorize(new T.BoxGeometry(2.4, 0.08, 0.3), 0xffffff), mIcing); ar.position.set(k * Lb, 0.03, sd * 0.8); ar.rotation.y = sd * 0.7; rg.add(ar); }
      K.add(rg);
      AO(bx, bz, bl / 2 + 2, bw / 2 + 2, 0.55, ang);
      AO(rx, rz, rl / 2 + 1, 10, 0.3, ang);
      block(bx, bz, 18);
    }

    // ---------------------------------------------------------------- advent wreath with four candles (east lobe)
    A.flames = [];
    {
      const cx = 78, cz = 56, R = 10.5;
      // fir ring: many needle tufts (cones) round a torus core, pine cones, berries, ribbon bows
      const f = frame(cx, 0, cz, 0);
      f(new T.TorusGeometry(R, 2.2, 8, 40), 0x0f2a16, { y: 1.5, rx: PI / 2, sy: 1, sz: 0.6 }, mPine);
      for (let k = 0; k < 440; k++) {
        const a = r() * TAU, rr = R + r.range(-3.6, 3.6), y = 1.0 + r() * 2.8;
        const g = new T.ConeGeometry(0.46, 3.3, 3);
        f(g, r.pick([0x2f7a3e, 0x3a8a46, 0x24683a, 0x4a9a52, 0x1f5c30]), { x: Math.cos(a) * rr, y, z: Math.sin(a) * rr, rx: r.range(-1.4, 1.4), rz: r.range(-1.4, 1.4), ry: r() * 3 }, mPine);
      }
      for (let k = 0; k < 7; k++) { const a = k * TAU / 7 + 0.3; f(new T.ConeGeometry(0.9, 2.2, 8), 0x6a4022, { x: Math.cos(a) * (R + 1.8), y: 2.4, z: Math.sin(a) * (R + 1.8), rz: PI / 2 + 0.3, ry: -a }, mChoc); }
      for (let k = 0; k < 24; k++) { const a = r() * TAU, rr = R + r.range(-2.5, 2.5); f(new T.IcosahedronGeometry(0.45, 1), 0xc41a24, { x: Math.cos(a) * rr, y: 3.4 + r() * 0.6, z: Math.sin(a) * rr }, mCandy, false); }
      for (let k = 0; k < 4; k++) { const a = k * PI / 2 + PI / 4; for (const sd of [-1, 1]) f(new T.TorusGeometry(1.0, 0.32, 6, 14), 0xb8141f, { x: Math.cos(a) * (R + 2.8) + sd * 0.9 * Math.sin(a), y: 2.6, z: Math.sin(a) * (R + 2.8) - sd * 0.9 * Math.cos(a), ry: -a, rx: 0.3, sy: 0.7 }, mCandy); }
      const mWax = mSugared;
      const lit = [true, true, true, false];
      for (let k = 0; k < 4; k++) {
        const a = k * PI / 2, x = Math.cos(a) * R, z = Math.sin(a) * R, hh = 11 - k * 1.3;
        f(new T.CylinderGeometry(1.45, 1.5, hh, 20), 0xd8202e, { x, y: 2.2 + hh / 2, z }, mWax);
        f(new T.CylinderGeometry(1.65, 1.65, 0.6, 20), 0xe8c45a, { x, y: 2.2, z }, mMetal);
        for (let dd = 0; dd < 3; dd++) { const da = r() * TAU; f(new T.CapsuleGeometry(0.22, 1.2 + r() * 1.6, 3, 6), 0xe8303a, { x: x + Math.cos(da) * 1.45, y: 2.2 + hh - 1.2, z: z + Math.sin(da) * 1.45 }, mCandy, false); }
        f(new T.CylinderGeometry(0.06, 0.06, 0.8, 4), 0x222222, { x, y: 2.2 + hh + 0.3, z }, mChoc, false);
        if (lit[k]) {
          const fl = new T.Mesh(K.lathe([[0.001, 0], [0.32, 0.25], [0.38, 0.6], [0.22, 1.2], [0.001, 1.9]], 10), new T.MeshBasicMaterial({ color: new T.Color(2.6, 1.6, 0.5) }));
          fl.position.set(cx + x, 2.2 + hh + 0.55, cz + z); K.group.add(fl); keep.push(fl);
          A.flames.push({ m: fl, ph: r() * 10 });
          GLOW(cx + x, 2.2 + hh + 1.4, cz + z, 5.5, 0xffb050, 0.55);
          GLOW(cx + x, 2.25 + hh, cz + z, 4.2, 0xff9030, 0.35);
        }
        K.circle(cx + x, cz + z, 1.6, 2.2 + hh);
      }
      AO(cx, cz, R + 4.5, R + 4.5, 0.55);
      GLOW(cx, 4.4, cz, 60, 0xff8a30, 0.12);
      K.circle(cx, cz, R + 3.2, 4.2);
      block(cx, cz, R + 5);
      const pl = new T.PointLight(0xffa050, 260, 110, 2); pl.position.set(cx, 16, cz); K.group.add(pl); A.wreathLight = pl;
    }

    // ---------------------------------------------------------------- a little decorated Christmas tree (west lobe)
    {
      const cx = -92, cz = 12;
      const f = frame(cx, 0, cz, 0.3);
      // a tree skirt of red felt with white trim
      f(new T.CylinderGeometry(13, 13, 0.4, 40), 0xa8141c, { y: 0.2 }, mMatte, false);
      f(new T.TorusGeometry(13, 0.5, 6, 48), 0xf6f0e6, { y: 0.4, rx: PI / 2 }, mIcing, false);
      f(new T.CylinderGeometry(1.4, 1.6, 4, 10), 0x5a3218, { y: 2 }, mGinger);
      const tiers = 6;
      for (let k = 0; k < tiers; k++) {
        const rr = 11 - k * 1.65, y0 = 3 + k * 5;
        const cg = new T.ConeGeometry(rr, 8.5, 27, 2); const cp = cg.attributes.position;
        for (let i = 0; i < cp.count; i++) { const x = cp.getX(i), z = cp.getZ(i), a = Math.atan2(z, x), q = 1 + 0.16 * Math.sin(a * 9 + k) * (cp.getY(i) < 0 ? 1 : 0.4); cp.setX(i, x * q); cp.setZ(i, z * q); if (cp.getY(i) < -4) cp.setY(i, cp.getY(i) - 0.6 * Math.max(0, Math.sin(a * 9 + k))); }
        cg.computeVertexNormals();
        f(cg, r.pick([0x1d5a30, 0x235f36]), { y: y0 + 4.25, ry: k * 0.7 }, mPine);
        for (let q = 0; q < 7; q++) { const a = r() * TAU, rq = rr * r.range(0.45, 0.85); f(new T.SphereGeometry(r.range(0.5, 0.9), 7, 5), 0xf4f8ff, { x: Math.cos(a) * rq, y: y0 + 8.5 * (1 - rq / rr) + 0.3, z: Math.sin(a) * rq, sy: 0.45 }, mIcing, false); } // snow clumps
      }
      // baubles
      for (let k = 0; k < 34; k++) {
        const t = r(), y = 4 + t * 27, rr = (11 - (y - 3) / 5 * 1.65) * 0.86 - 0.6, a = r() * TAU;
        f(new T.SphereGeometry(0.75, 8, 6), r.pick([0xc41a24, 0xe8c45a, 0x2a6ad0, 0xd8dce4, 0x9a3ac0]), { x: Math.cos(a) * rr, y: y - 2.2, z: Math.sin(a) * rr }, mMetal);
      }
      // tinsel garland spiralling down
      const pts = [];
      for (let k = 0; k <= 120; k++) { const t = k / 120, y = 30 - t * 26, rr = (11 - (y - 3) / 5 * 1.65) * 0.92 + 0.2, a = t * TAU * 3.5; pts.push(new T.Vector3(Math.cos(a) * rr, y - 3.4, Math.sin(a) * rr)); }
      f(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 160, 0.32, 5), 0xe8c45a, {}, mMetal, false);
      // fairy lights
      const lightCols = [[2.6, 1.6, 0.5], [2.6, 0.5, 0.5], [0.6, 2.2, 0.8], [0.6, 1.0, 2.8], [2.6, 2.2, 0.8]];
      for (let k = 0; k < 60; k++) {
        const t = k / 60, y = 31 - t * 27, rr = (11 - (y - 3) / 5 * 1.65) * 0.95, a = t * TAU * 4.2 + 1.3;
        const g = f(new T.SphereGeometry(0.3, 6, 4), 0xffffff, { x: Math.cos(a) * rr, y: y - 3.0, z: Math.sin(a) * rr }, mGlow, false);
        const lc = lightCols[k % 5]; g.attributes.color.array.forEach((v, i, arr) => { arr[i] = lc[i % 3]; });
      }
      const star = f(new T.OctahedronGeometry(1.6, 0), 0xffffff, { y: 34.6, sy: 1.25 }, mGlow, false); star.attributes.color.array.forEach((v, i, a) => { a[i] = [3, 2.4, 0.9][i % 3]; });
      AO(cx, cz, 14, 14, 0.5);
      GLOW(cx, 0.6, cz, 40, 0xffa050, 0.2);
      K.circle(cx, cz, 9.5, 36);
      block(cx, cz, 15);
      const pl = new T.PointLight(0xffb468, 240, 110, 2); pl.position.set(cx + 2, 16, cz + 12); K.group.add(pl); A.treeLight = pl;
      // presents under the tree
      const giftCols = [[0xc41a24, 0xf2c21a], [0x2a6ad0, 0xf6f0e6], [0xf6f0e6, 0xc41a24], [0x9a3ac0, 0xf2c21a], [0x23a33a, 0xc41a24]];
      [[9, 6, 5, 4, 5, 0.3], [4, 12, 4, 6, 4, 0.9], [-9, 8, 6, 3.5, 5, -0.4], [-4, -12.5, 5, 5, 5, 0.2], [11, -5, 4.5, 3, 6, 1.1]].forEach(([x, z, w, h, d, ry], i) => {
        const [a, b] = giftCols[i % giftCols.length];
        const ff = frame(cx + x, 0, cz + z, ry);
        ff(new K.RoundedBoxGeometry(w, h, d, 2, 0.2), a, { y: h / 2 + 0.4 }, mCandy);
        ff(new T.BoxGeometry(w + 0.1, h + 0.1, 0.8), b, { y: h / 2 + 0.4 }, mCandy); ff(new T.BoxGeometry(0.8, h + 0.1, d + 0.1), b, { y: h / 2 + 0.4 }, mCandy);
        for (const sd of [-1, 1]) ff(new T.TorusGeometry(0.8, 0.28, 6, 12), b, { x: sd * 0.7, y: h + 0.9, rz: sd * 0.6 }, mCandy);
      });
    }

    // ---------------------------------------------------------------- Christmas cake on a cake board (east lobe)
    {
      const cx = 76, cz = 12, R = 9;
      const f = frame(cx, 0, cz, 0);
      f(new T.CylinderGeometry(R + 2.6, R + 2.6, 0.25, 24), 0xf6f2ea, { y: 0.13 }, mIcing, false);
      for (let k = 0; k < 24; k++) { const a = k * TAU / 24; f(new T.CylinderGeometry(1.1, 1.1, 0.25, 8), 0xf6f2ea, { x: Math.cos(a) * (R + 2.6), y: 0.13, z: Math.sin(a) * (R + 2.6) }, mIcing, false); }
      f(new T.CylinderGeometry(R, R, 7, 40), 0x7a3a1e, { y: 3.75 }, mGinger);
      // thick white icing poured over the top, dripping down the sides
      f(new T.CylinderGeometry(R + 0.3, R + 0.3, 1.0, 40), 0xffffff, { y: 7.6 }, mIcing);
      for (let k = 0; k < 22; k++) { const a = k * TAU / 22 + r() * 0.1, l = 0.4 + r() * 1.6; f(new T.CapsuleGeometry(0.62, l, 2, 6), 0xffffff, { x: Math.cos(a) * (R + 0.2), y: 7.3 - l / 2, z: Math.sin(a) * (R + 0.2) }, mIcing, false); }
      // a ribbon round the middle, holly and berries on top, a marzipan robin
      f(new T.CylinderGeometry(R + 0.12, R + 0.12, 1.8, 40, 1, true), 0xb8141f, { y: 3.4 }, mCandy);
      for (let k = 0; k < 5; k++) { const a = k * TAU / 5; f(new T.SphereGeometry(1, 10, 6), 0x1d5a30, { x: Math.cos(a) * 1.8, y: 8.3, z: Math.sin(a) * 1.8, sx: 1.8, sy: 0.25, sz: 0.8, ry: -a }, mCandy); }
      for (let k = 0; k < 3; k++) f(new T.SphereGeometry(0.55, 10, 8), 0xd8202e, { x: Math.cos(k * 2.1) * 0.5, y: 8.8, z: Math.sin(k * 2.1) * 0.5 }, mCandy);
      for (let k = 0; k < 16; k++) { const a = k * TAU / 16; f(new T.SphereGeometry(0.5, 8, 6), 0xffffff, { x: Math.cos(a) * (R - 1), y: 8.3, z: Math.sin(a) * (R - 1) }, mIcing, false); }
      AO(cx, cz, R + 4, R + 4, 0.5);
      K.circle(cx, cz, R + 0.5, 9);
      block(cx, cz, R + 4);
      // a slice cut out, lying on a plate beside it
      const ff = frame(cx + 15.5, 0, cz - 9, 0.6);
      ff(new T.CylinderGeometry(4.5, 4.2, 0.5, 28), 0xf6f0e6, { y: 0.25 }, K.ceramic(0xffffff, { vertexColors: true }));
      ff(new T.CylinderGeometry(3.6, 3.6, 4, 3, 1, false, 0, 0.9), 0x7a3a1e, { y: 2.5, rx: PI / 2, rz: 0 }, mGinger);
      AO(cx + 15.5, cz - 9, 5, 5, 0.4);
    }

    // ---------------------------------------------------------------- nutcracker standing guard by the south-west bend
    {
      const cx = -98, cz = 50;
      const f = frame(cx, 0, cz, -0.5);
      f(new T.CylinderGeometry(3.6, 4, 1.4, 24), 0x1d4a2a, { y: 0.7 }, mChoc);
      for (const sz of [-1, 1]) { f(new T.CylinderGeometry(0.9, 0.95, 6, 14), 0x1a1414, { y: 4.2, z: sz * 1.1 }, mCandy); f(new T.CylinderGeometry(0.95, 0.95, 2.2, 14), 0xf6f0e6, { y: 8.2, z: sz * 1.1 }, mCandy); }
      f(new T.CylinderGeometry(2.4, 2.6, 7, 20), 0xc41a24, { y: 12.4 }, mCandy);
      f(new T.CylinderGeometry(2.65, 2.65, 0.8, 20), 0x1a1414, { y: 9.4 }, mCandy);
      f(new T.BoxGeometry(0.6, 0.9, 0.3), 0xe8c45a, { x: 2.6, y: 9.4 }, mMetal);
      for (let k = 0; k < 4; k++) f(new T.SphereGeometry(0.22, 6, 4), 0xe8c45a, { x: 2.45, y: 11 + k * 1.2 }, mMetal, false);
      for (const sz of [-1, 1]) { f(new T.CylinderGeometry(0.75, 0.7, 6, 12), 0xc41a24, { y: 12.6, z: sz * 3.0, rx: sz * 0.12 }, mCandy); f(new T.SphereGeometry(0.85, 10, 8), 0xf6d2b0, { y: 9.4, z: sz * 3.2 }, mCandy); f(new T.SphereGeometry(0.9, 10, 8), 0xe8c45a, { y: 15.4, z: sz * 2.9, sy: 0.6 }, mMetal); }
      f(new T.CylinderGeometry(2.0, 2.1, 3.4, 20), 0xf6d2b0, { y: 17.6 }, mCandy);
      f(new T.BoxGeometry(1.4, 1.8, 3.2), 0xf6f0e6, { x: 1.6, y: 16.4 }, mIcing); // beard
      f(new T.SphereGeometry(0.42, 8, 6), 0xd8846a, { x: 2.1, y: 17.8 }, mCandy, false);
      for (const sz of [-0.6, 0.6]) { f(new T.SphereGeometry(0.28, 6, 4), 0x111111, { x: 1.95, y: 18.6, z: sz }, mChoc, false); f(new T.BoxGeometry(0.2, 0.25, 0.9), 0x111111, { x: 1.95, y: 19.2, z: sz }, mChoc, false); }
      f(new T.BoxGeometry(1.4, 0.4, 3.0), 0xf6f0e6, { x: 1.7, y: 17.4 }, mIcing);
      f(new T.CylinderGeometry(2.3, 2.1, 5.2, 20), 0x1a1414, { y: 21.9 }, mCandy);
      f(new T.TorusGeometry(2.25, 0.25, 6, 24), 0xe8c45a, { y: 19.6, rx: PI / 2 }, mMetal);
      f(new T.SphereGeometry(0.7, 10, 8), 0xe8c45a, { x: 2.2, y: 22.4 }, mMetal);
      f(new T.ConeGeometry(0.6, 2.4, 8), 0xf6f0e6, { y: 25.6 }, mIcing);
      AO(cx, cz, 5, 5, 0.55);
      K.circle(cx, cz, 4, 25);
      block(cx, cz, 6);
    }

    // ---------------------------------------------------------------- stollen on a board, cookies and a plate of stars
    {
      const cx = -120, cz = 30;
      const f = frame(cx, 0, cz, 1.35);
      f(new K.RoundedBoxGeometry(30, 1.2, 13, 2, 0.4), 0xb07a45, { y: 0.6 }, mGinger);
      const loaf = new T.CapsuleGeometry(4.2, 12, 6, 16); loaf.rotateZ(PI / 2);
      const pa = loaf.attributes.position;
      for (let i = 0; i < pa.count; i++) { const y = pa.getY(i), z = pa.getZ(i); pa.setY(i, (y < 0 ? y * 0.35 : y * 0.78) + Math.abs(z) * (y > 0 ? -0.08 : 0)); pa.setZ(i, z * 1.05 + (y > 0 ? Math.sin(pa.getX(i) * 0.5) * 0.15 : 0)); }
      loaf.computeVertexNormals();
      f(loaf, 0xc89058, { x: -3, y: 2.6 }, mGinger);
      const sug = new T.CapsuleGeometry(4.25, 11.6, 6, 16); sug.rotateZ(PI / 2);
      const pb = sug.attributes.position;
      for (let i = 0; i < pb.count; i++) { const y = pb.getY(i); pb.setY(i, y < 0.6 ? 0.6 * 0.78 - 0.4 : y * 0.8 + 0.12 + (Math.sin(pb.getX(i) * 1.7) + Math.cos(pb.getZ(i) * 2.3)) * 0.06); }
      sug.computeVertexNormals();
      f(sug, 0xffffff, { x: -3, y: 2.6 }, mIcing); // powdered sugar
      // a cut slice showing the marzipan centre
      f(new T.CylinderGeometry(3.6, 3.6, 1.6, 20), 0xe8c088, { x: 10, y: 4.6, rx: PI / 2, rz: 0.2, sy: 1 }, mGinger);
      f(new T.CylinderGeometry(1.1, 1.1, 1.65, 12), 0xf6e6b0, { x: 10, y: 4.6, rx: PI / 2, rz: 0.2 }, mIcing);
      for (let k = 0; k < 10; k++) f(new T.SphereGeometry(0.3, 5, 4), r.pick([0x8a2a1a, 0x3a7a2a, 0xe8a030]), { x: 10 + r.range(-2.6, 2.6), y: 4.6 + r.range(-2.6, 2.6), z: 0.82 }, mCandy, false);
      AO(cx, cz, 9, 17, 0.45, 1.35);
      K.box(cx, cz, 15, 6.5, -1.35 + PI, 7);
      block(cx, cz, 16);
    }
    const starCookie = (x, z, ry, s = 1) => {
      const sh = new T.Shape();
      for (let k = 0; k < 10; k++) { const a = -PI / 2 + k * PI / 5, q = k % 2 ? 1.2 : 2.6; k ? sh.lineTo(Math.cos(a) * q, Math.sin(a) * q) : sh.moveTo(Math.cos(a) * q, Math.sin(a) * q); }
      sh.closePath();
      const g = new T.ExtrudeGeometry(sh, { depth: 0.6, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.2, bevelSegments: 1 }); g.rotateX(-PI / 2);
      const f = frame(x, snowY(x, z), z, ry, s);
      f(g, 0xe0a070, { y: 0 }, mGinger);
      const ic = new T.ExtrudeGeometry(sh, { depth: 0.2, bevelEnabled: false }); ic.rotateX(-PI / 2); ic.scale(0.82, 1, 0.82);
      f(ic, 0xffffff, { y: 0.85 }, mIcing, false);
      AO(x, z, 2.8 * s, 2.8 * s, 0.35);
    };

    // ---------------------------------------------------------------- more houses, trees and figures round the lobes and edges
    house(-70, -20, 0.15, { w: 10, d: 8.5, h: 6, tint: 0xf4e0c8 });
    house(-112, -18, -0.1, { w: 11, d: 9, h: 6.5, shingles: [[0x7a3a1e, 0x5a2a12, 0x8a4a26]][0] });
    house(60, -20, -0.12, { w: 10, d: 8.5, h: 6, shingles: [0xf6c6d8, 0xc8e6f6, 0xf6f0c0, 0xd2f0d0] });
    house(103, -19, 0.1, { w: 10.5, d: 9, h: 6.2, tint: 0xffeedd });
    house(-68, 56, -0.2, { w: 9, d: 8, h: 5.5, tint: 0xf0d8c0 });
    house(100, 22, 0.25, { w: 9, d: 8, h: 5.5, shingles: [0xf6c6d8, 0xd2f0d0, 0xf6f0c0] });
    for (const [x, z, s] of [[-128, -4, 1.2], [-130, 6, 0.9], [-60, -6, 1.0], [-80, -34, 0.9], [-118, 52, 1.1], [-130, 50, 0.8], [-72, 30, 0.9], [-45, 6, 0.9],
      [50, -4, 1.0], [90, -4, 0.85], [118, -24, 1.0], [52, 36, 0.9], [96, 40, 1.0], [108, 2, 0.9], [56, 64, 0.8],
      [-90, -80, 1.3], [-60, -84, 1.1], [-30, -86, 1.2], [10, -85, 1.3], [40, -84, 1.1], [75, -82, 1.2], [110, -80, 1.3], [140, -70, 1.1], [-140, -66, 1.2], [-158, -50, 1.0],
      [158, 30, 1.0], [-162, 70, 0.9], [-30, 96, 0.9], [-128, 94, 0.9], [26, 97, 0.8]]) {
      if (!isBlocked(x, z, 2) && K.offRoad(x, z, 3.5)) tree(x, z, s);
    }
    house(-112, -80, 0, { w: 10, d: 8, h: 5.5 }); house(-45, -84, 0, { w: 9, d: 8, h: 5.5, tint: 0xf4dcc4 }); house(58, -84, 0, { w: 10, d: 8, h: 6 }); house(128, -82, 0, { w: 9, d: 8, h: 5.5, tint: 0xfff0e0 });
    // the north-west end of the village: a toy shop, a sleigh loaded with presents and a snowman family
    house(-90, -67, 0, { w: 11, d: 8.5, h: 6, tint: 0xf8e4cc, shingles: [0xd2172a, 0xfbf7f2] });
    {
      const cx = -108, cz = -64, f = frame(cx, 0, cz, 0.35);
      for (const sz of [-1.6, 1.6]) { f(new T.BoxGeometry(9, 0.35, 0.35), 0xe8c45a, { y: 0.2, z: sz }, mMetal); f(new T.TorusGeometry(1.1, 0.18, 6, 12, PI), 0xe8c45a, { x: 4.5, y: 1.3, z: sz, rz: -PI / 2 }, mMetal); for (const x of [-2.8, 0, 2.8]) f(new T.CylinderGeometry(0.15, 0.15, 1.1, 5), 0xe8c45a, { x, y: 0.75, z: sz }, mMetal); }
      f(new K.RoundedBoxGeometry(8, 2.2, 4, 1, 0.5), 0xc41a24, { y: 2.3 }, mCandy);
      f(new K.RoundedBoxGeometry(2.2, 3.6, 4, 1, 0.5), 0xc41a24, { x: -3.3, y: 3.6 }, mCandy);
      f(new T.BoxGeometry(8.1, 0.3, 4.1), 0xe8c45a, { y: 3.3 }, mMetal);
      const gc = [[0x2a6ad0, 0xf2c21a], [0xf6f0e6, 0xc41a24], [0x23a33a, 0xf6f0e6], [0x9a3ac0, 0xf2c21a]];
      [[0.4, -0.8, 2.2], [2.4, 0.6, 1.8], [0.8, 1.1, 1.6], [2.2, -1.0, 1.4]].forEach(([x, z, w], i) => { f(new T.BoxGeometry(w, w, w), gc[i][0], { x, y: 3.4 + w / 2 + (i > 2 ? 0.6 : 0), z, ry: i }, mCandy); f(new T.BoxGeometry(w + 0.05, w + 0.05, 0.35), gc[i][1], { x, y: 3.4 + w / 2 + (i > 2 ? 0.6 : 0), z, ry: i }, mCandy); });
      AO(cx, cz, 5.5, 3, 0.45, 0.35); K.box(cx, cz, 4.8, 2.4, -0.35, 6); block(cx, cz, 6);
    }
    snowman(-96, -34, 0.8, 1.05); snowman(-91, -31.5, 0.3, 0.75); snowman(-99.5, -30.5, -0.2, 0.6);
    gingerMan(-78, -61.5, 0.2, 0.75); tree(-118, -72, 1.1); tree(-76, -74, 0.9);
    snowman(-80, 26, 0.5, 1.1); snowman(64, 34, -0.6, 1.0); snowman(128, 58, 0.2, 0.9); snowman(-121, -30, 0.3, 0.9);
    gingerMan(-62, -12, 0.4, 0.8); gingerMan(88, -10, -0.3, 0.8); gingerMan(-104, 30, 0.7, 0.75);
    starCookie(-80, 96, 0.4); starCookie(-72, 99, 1.6, 0.8); starCookie(84, 99, 0.9, 0.9); starCookie(-20, 18, 0.2, 0.8);

    // ---------------------------------------------------------------- fine scatter: sugar sprinkles and pine needles strewn over the table
    {
      const spr = [], ndl = [];
      const sprC = [0xe8202e, 0x23a33a, 0xf2c21a, 0x2a7ad8, 0xf26a1a, 0xf6f0e6, 0xe86aa8];
      for (let c = 0; c < 46; c++) {
        const cx = r.range(BOUNDS.minX + 8, BOUNDS.maxX - 8), cz = r.range(BOUNDS.minZ + 8, BOUNDS.maxZ - 8);
        if (!K.offRoad(cx, cz, 2)) continue;
        for (let i = 0; i < 16; i++) {
          const x = cx + r.gauss() * 4, z = cz + r.gauss() * 4;
          if (!K.offRoad(x, z, 1.2) || isBlocked(x, z)) continue;
          spr.push({ x, y: snowY(x, z) + 0.1, z, ry: r() * 6, rz: PI / 2 + r.range(-0.2, 0.2), s: r.range(0.8, 1.2), color: r.pick(sprC) });
        }
      }
      chunked(new T.CylinderGeometry(0.09, 0.09, 0.6, 4), K.phys({ color: 0xffffff, roughness: 0.3, clearcoat: 0.8 }), spr, { colors: true, cast: false });
      for (const [cx, cz, n] of [[78, 56, 90], [-92, 12, 90], [-120, 30, 30], [100, 22, 20]]) for (let i = 0; i < n; i++) {
        const a = r() * TAU, d = 9 + r() * 16, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
        if (!K.offRoad(x, z, 1)) continue;
        ndl.push({ x, y: snowY(x, z) + 0.06, z, ry: r() * 6, rz: PI / 2, s: r.range(0.8, 1.3), color: r.pick([0x2a6e3c, 0x3a7a44, 0x5a6a2a]) });
      }
      chunked(new T.CylinderGeometry(0.06, 0.06, 1.6, 3), K.std({ color: 0xffffff, roughness: 0.7 }), ndl, { colors: true, cast: false });
    }

    // ---------------------------------------------------------------- pushables: glass baubles roll, chocolate coins and cookies slide
    {
      const baubleMat = K.phys({ vertexColors: true, metalness: 0.85, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.5 });
      const bcols = [0xc41a24, 0xe8c45a, 0x2a6ad0, 0x23a33a, 0xd8dce4, 0x9a3ac0];
      const spots = [[22, -5.2], [268, 4.6], [560, 5], [588, -5.4], [790, 5.2], [866, 4.4]];
      spots.forEach(([s, off], i) => {
        const p = track.place(s, off);
        const grp = new T.Mesh(merge([
          colorize(new T.SphereGeometry(2.1, 18, 12), bcols[i % bcols.length]),
          colorize(xf(new T.CylinderGeometry(0.55, 0.6, 0.7, 12), { y: 2.2 }), 0xe8c45a),
          colorize(xf(new T.TorusGeometry(0.35, 0.09, 6, 12), { y: 2.75 }), 0xe8c45a),
          colorize(xf(new T.TorusGeometry(2.08, 0.16, 6, 32), { rx: PI / 2 }), 0xf4f4f4),
        ]), baubleMat);
        grp.position.set(p.x, 2.15, p.z);
        K.add(grp);
        K.physics.addDynamic({ x: p.x, z: p.z, r: 2.1, m: 0.7, h: 4.3, mesh: grp, friction: 5, baseY: 2.15 });
      });
      // chocolate coins in gold foil
      const coinTex = TX.labelTexture(128, 128, (g) => {
        const gr = g.createRadialGradient(64, 64, 10, 64, 64, 64); gr.addColorStop(0, '#f6d77a'); gr.addColorStop(0.8, '#d9a838'); gr.addColorStop(1, '#a87a20');
        g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
        g.strokeStyle = '#9a6e1a'; g.lineWidth = 4; g.beginPath(); g.arc(64, 64, 54, 0, TAU); g.stroke();
        g.fillStyle = '#a87a20'; g.font = '700 54px Georgia, serif'; g.textAlign = 'center'; g.fillText('★', 64, 82);
      });
      const coinFace = K.std({ map: coinTex, metalness: 1, roughness: 0.28 });
      const coinG = new T.CylinderGeometry(1.5, 1.5, 0.36, 24);
      const cspots = [[506, -3], [520, 2.5], [534, -1], [612, 3], [626, -2.5], [40, 3.5], [258, -2], [455, 3]];
      for (const [s, off] of cspots) {
        const p = track.place(s, off);
        const m = new T.Mesh(coinG, coinFace);
        m.position.set(p.x, 0.32, p.z); m.rotation.y = r() * 6;
        K.add(m, { cast: false });
        K.physics.addDynamic({ x: p.x, z: p.z, r: 1.5, m: 0.25, h: 0.5, mesh: m, slide: true, friction: 18, baseY: 0.32 });
      }
      // gingerbread men lying on the road edges
      const gmMesh = (() => {
        const parts = [colorize(gmGeo(), 0xe0a070)];
        const ic = [];
        gmIcing((g, c, o) => ic.push(colorize(xf(g, o), c)));
        const gg = merge(parts); gg.rotateX(-PI / 2); gg.translate(0, 0.38, 0);
        const ii = merge(ic); ii.rotateX(-PI / 2); ii.translate(0, 0.38, 0);
        return [gg, ii];
      })();
      for (const [s, off] of [[282, 4.6], [292, -4.2], [745, -4.6]]) {
        const p = track.place(s, off);
        const g = new T.Group();
        g.add(new T.Mesh(gmMesh[0], mGinger), new T.Mesh(gmMesh[1], mIcing));
        g.position.set(p.x, 0.2, p.z); g.rotation.y = r() * 6;
        K.add(g);
        K.physics.addDynamic({ x: p.x, z: p.z, r: 2.2, m: 0.45, h: 1.0, mesh: g, slide: true, friction: 14, baseY: 0.2 });
      }
    }

    // ---------------------------------------------------------------- lights: lamp-lit main street, the pond; falling snow
    {
      const v = new T.PointLight(0xffa860, 200, 110, 2); v.position.set(0, 15, -47); K.group.add(v); A.villageLight = v;
      const p = new T.PointLight(0xffb070, 150, 90, 2); p.position.set(0, 12, 50); K.group.add(p); A.pondLight = p;
      // snowfall: flakes drifting down round the camera target (wrapped into a box that follows the view)
      const n = K.quality && K.quality.tilt === false ? 380 : 650;
      const base = new Float32Array(n * 4), pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) base.set([r() * 140, r() * 46, r() * 110, r() * 100], i * 4);
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3).setUsage(T.DynamicDrawUsage));
      g.boundingSphere = new T.Sphere(new T.Vector3(0, 20, 0), 1000);
      const fc = TX.makeCanvas(32), fg = fc.getContext('2d');
      const fgr = fg.createRadialGradient(16, 16, 0, 16, 16, 16); fgr.addColorStop(0, 'rgba(255,255,255,1)'); fgr.addColorStop(0.5, 'rgba(255,255,255,0.6)'); fgr.addColorStop(1, 'rgba(255,255,255,0)');
      fg.fillStyle = fgr; fg.fillRect(0, 0, 32, 32);
      const mat = new T.PointsMaterial({ size: 0.75, map: TX.toTexture(fc, { wrap: false }), color: 0xf4f8ff, transparent: true, opacity: 0.85, depthWrite: false, sizeAttenuation: true });
      const pts = new T.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 4; K.group.add(pts); keep.push(pts);
      A.snow = { g, base, n };
    }

    // ---------------------------------------------------------------- contact shadows (one instanced draw), light pools, final merge
    flushBake();
    {
      const g = new T.PlaneGeometry(1, 1); g.rotateX(-PI / 2);
      const mat = new T.MeshBasicMaterial({ color: 0x0a0804, transparent: true, alphaMap: TX.blobShadowTexture(), depthWrite: false });
      mat.onBeforeCompile = (sh) => {
        sh.vertexShader = 'varying float vOp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\nvOp = length(instanceMatrix[1].xyz);\n#endif');
        sh.fragmentShader = 'varying float vOp;\n' + sh.fragmentShader.replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\ndiffuseColor.a *= vOp;');
      };
      if (contacts.length) { const im = K.instances(g, mat, contacts, { cast: false, receive: false }); im.renderOrder = 1; keep.push(im); }
    }
    if (glows.length) {
      const gc = TX.makeCanvas(128, 128), gg = gc.getContext('2d');
      const q = gg.createRadialGradient(64, 64, 0, 64, 64, 64); q.addColorStop(0, 'rgba(255,255,255,1)'); q.addColorStop(0.3, 'rgba(255,255,255,0.5)'); q.addColorStop(1, 'rgba(0,0,0,0)');
      gg.fillStyle = q; gg.fillRect(0, 0, 128, 128);
      const gGeo = new T.PlaneGeometry(1, 1); gGeo.rotateX(-PI / 2);
      const gMat = new T.MeshBasicMaterial({ map: TX.toTexture(gc, { wrap: false }), transparent: true, blending: T.AdditiveBlending, depthWrite: false });
      const im = K.instances(gGeo, gMat, glows, { cast: false, receive: false, colors: true });
      im.renderOrder = 2; keep.push(im);
    }
    {
      K.group.updateMatrixWorld(true);
      const isKept = (o) => { for (let p = o; p; p = p.parent) if (keep.includes(p)) return true; return false; };
      const buckets = new Map();
      K.group.traverse((o) => {
        if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || isKept(o)) return;
        if (o.material.transparent || o.renderOrder) return;
        if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
        const c = o.geometry.boundingSphere.center.clone().applyMatrix4(o.matrixWorld);
        if (o.geometry.boundingSphere.radius * o.matrixWorld.getMaxScaleOnAxis() > 70) return;
        const cell = Math.floor((c.x + 320) / CELL) + ':' + Math.floor((c.z + 320) / CELL);
        const key = o.material.uuid + cell + (o.castShadow ? 'c' : '') + (o.receiveShadow ? 'r' : '');
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(o);
      });
      for (const list of buckets.values()) {
        if (list.length < 2) continue;
        const geos = [];
        for (const o of list) {
          let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
          g.applyMatrix4(o.matrixWorld);
          for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
          if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
          if (!g.attributes.normal) g.computeVertexNormals();
          geos.push(g);
        }
        const hasCol = geos.some((g) => g.attributes.color);
        if (hasCol !== geos.every((g) => g.attributes.color)) continue;
        const merged = BU.mergeGeometries(geos, false);
        if (!merged) continue;
        const m = new T.Mesh(merged, list[0].material);
        m.castShadow = list[0].castShadow; m.receiveShadow = list[0].receiveShadow;
        for (const o of list) o.parent.remove(o);
        K.group.add(m);
      }
    }
  },

  // fixed-rate: sync the train at the start; CPU drivers wait at a closed level crossing
  tick(dt, time, game) {
    if (!A || !A.lc) return;
    if (game.state === 'countdown' && game.countFull && game.countT > 2.9 && !A.synced) {
      // GO is ~3.2 s away: the train crosses the first crossing ~5 s after GO, well before the pack arrives
      const lc = A.lc[0];
      A.t0 = time + 3.2 + 5 - lc.ua;
      A.synced = true;
    }
    if (game.state !== 'countdown') A.synced = false;
    // a new round's grid can land on the gift-box jump: a car standing inside the ramp or box footprint at
    // table level would be stuck against it, so lift it onto the surface (engine places cars at y = 0)
    for (const e of game.cars) {
      const c = e.car;
      if (e.out || c.state !== 'drive' || c.airborne || c.speed > 4) continue;
      const g = game.physics.groundAt(c.x, c.z).g;
      if (g > c.y + 0.85) c.y = g;
    }
    const Lr = game.track.length;
    for (const e of game.cars) {
      if (!e.ai || e.out) continue;
      const c = e.car;
      if (c.state !== 'drive' || c.airborne) continue;
      for (const lc of A.lc) {
        const d = ((((lc.roadS - e.trackS) % Lr) + Lr) % Lr);
        if (d > 70) continue;
        const [tArr, tClr] = crossingTimes(lc, time);
        if (tArr > 9 || tClr < -0.1) continue;
        const sp = Math.max(0, c.fwdSpeed);
        if (tArr > (d + 7) / Math.max(sp, 8) + 0.8) continue; // can clear it before the train arrives
        const stopD = d - 7.4;
        if (stopD < -1.2) continue; // committed
        const vmax = Math.sqrt(2 * 75 * Math.max(0, stopD));
        if (sp > vmax) { const k = vmax / Math.max(sp, 0.01); c.vx *= k; c.vz *= k; }
        e.ai.stuckT = 0;
      }
    }
  },

  animate(time, dt, game) {
    if (!A || !A.trainMeshes) return;
    // ---- candle flames and the lights flicker
    for (const f of A.flames) { const k = 1 + 0.12 * Math.sin(time * 13 + f.ph) + 0.07 * Math.sin(time * 29 + f.ph * 2); f.m.scale.set(1, k, 1); f.m.rotation.z = 0.06 * Math.sin(time * 7 + f.ph); }
    if (A.wreathLight) A.wreathLight.intensity = 260 * (0.9 + 0.06 * Math.sin(time * 11) + 0.04 * Math.sin(time * 27.3));
    if (A.sparkles) A.sparkles[0].opacity = 0.6 + 0.25 * Math.sin(time * 1.7);
    // ---- skaters glide round the pond
    if (A.skaters) for (const s of A.skaters) {
      const a = s.ph + time * s.w, x = s.cx + Math.cos(a) * s.r, z = s.cz + Math.sin(a) * s.r * 0.9;
      s.g.position.set(x, 0.4, z); s.g.rotation.set(0, -(a + Math.sign(s.w) * PI / 2), Math.sign(s.w) * 0.12);
    }
    // ---- falling snow round the view
    if (A.snow && game) {
      const S = A.snow, pos = S.g.attributes.position.array, cx = game.camX ?? 0, cz = game.camZ ?? 0;
      for (let i = 0; i < S.n; i++) {
        const b = i * 4, ph = S.base[b + 3];
        const y = ((S.base[b + 1] - time * (3.2 + (ph % 1.7))) % 46 + 46) % 46;
        const x = ((S.base[b] + Math.sin(time * 0.7 + ph) * 2.2 + time * 1.2 - cx + 70) % 140 + 140) % 140 + cx - 70;
        const z = ((S.base[b + 2] + Math.cos(time * 0.5 + ph) * 1.6 - cz + 70) % 110 + 110) % 110 + cz - 70;
        pos[i * 3] = x; pos[i * 3 + 1] = y + 0.3; pos[i * 3 + 2] = z;
      }
      S.g.attributes.position.needsUpdate = true;
    }
    const rail = A.rail;
    // ---- train
    const head = headS(time);
    for (let i = 0; i < A.trainMeshes.length; i++) {
      const len = TRAIN.lens[i], sf = head - A.off[i];
      const pa = rail.at(sf - len * 0.2), pb = rail.at(sf - len * 0.8);
      const m = A.trainMeshes[i];
      const mx = (pa.x + pb.x) / 2, mz = (pa.z + pb.z) / 2, ang = Math.atan2(pa.z - pb.z, pa.x - pb.x);
      m.position.set(mx, 0.42, mz);
      m.rotation.set(0, -ang, 0);
      const sh = A.trainShadow[i]; sh.position.set(mx, 0.12, mz); sh.rotation.z = -ang;
      if (i === 0) { const c = Math.cos(ang), s = Math.sin(ang); A.lamp.position.set(mx + c * 11, 0.15, mz + s * 11); A.lamp.rotation.z = -ang; }
    }
    // smoke puffs from the loco chimney
    if (game && game.particles && dt > 0) {
      const loco = A.trainMeshes[0];
      const c = Math.cos(loco.rotation.y), s = Math.sin(loco.rotation.y);
      const wx = loco.position.x + c * 4.6, wz = loco.position.z - s * 4.6, wy = 6.4;
      const pdt = Math.min(0.12, Math.max(dt, time - (A.lastPuffT ?? time))); A.lastPuffT = time;
      if (game.onScreen(wx, wy, wz, 0.2)) {
        A.puff = (A.puff || 0) + pdt * 6;
        while (A.puff > 1) {
          A.puff -= 1;
          game.particles.emit(wx, wy, wz, { vx: -c * 3, vz: s * 3, vy: 3.5, spread: 1, up: 1.5, grav: -1.2, color: 0xf4f4f8, size: 0.9, life: 1.4, alpha: 0.5, grow: 2.2 });
        }
      }
    }
    // ---- level crossings: lamps, booms, bell
    A.lc.forEach((lc, i) => {
      const [tA, tC] = crossingTimes(lc, time);
      const warn = tA < 3.2 && tC > -1.2;
      const down = ss(3.0, 1.6, tA) * (1 - ss(-0.2, -1.4, tC));
      const vis = A.lcVis[i];
      for (const b of vis.booms) b.rotation.x = -(1 - down) * (PI / 2 - 0.05);
      const ph = Math.floor(time * 2.6) % 2;
      for (let k = 0; k < 2; k++) { const on = warn && k === ph; vis.mats[k].emissiveIntensity = on ? 3.4 : 0; vis.halos[k].opacity = on ? 0.8 : 0; }
      if (warn && game && game.sound && game.sound.ctx && (game.state === 'race' || game.state === 'roundEnd' || game.state === 'countdown') && game.onScreen(lc.x, 2, lc.z, 0.25)) {
        A.bell[i] -= dt;
        if (A.bell[i] <= 0) { A.bell[i] = 0.36; game.sound.tone(2093, 0.18, { type: 'sine', vol: 0.03 }); game.sound.tone(3136, 0.12, { type: 'sine', vol: 0.014 }); }
      }
    });
  },
};

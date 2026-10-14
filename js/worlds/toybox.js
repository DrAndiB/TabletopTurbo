// World: Toy Box Mayhem. A child's bedroom floor at night: monster trucks race over a printed city playmat
// and out across the floorboards, lit by a warm night light and a cool shaft of moonlight through the curtains.
// Big wheels crunch over crayons, train track and micro cars; picture books make a jump over the printed river;
// a sleeping cat swats the road with its tail and a battery wooden train trundles across the west straight.

const TRACK = [
  [-70, 60], [48, 59], [82, 63], [106, 79], [136, 74], [151, 40], [143, -28], [124, -51], [90, -56], [56, -50],
  [43, -41], [38, -26], [37, -4], [28, 12], [10, 15], [-36, 15], [-54, 8], [-61, -8], [-64, -30], [-80, -44],
  [-106, -44], [-128, -32], [-140, -4], [-140, 30], [-127, 55], [-102, 64],
];
const BOUNDS = { minX: -165, maxX: 165, minZ: -98, maxZ: 98 };
const RUG = { x0: -100, x1: 80, z0: -60, z1: 78, y: 0.16 };
const W = 15;
const S = { start: 30, crayon: [128, 404, 688], marbles: 452, rampA: 506, rampB: 521, landA: 530, landB: 542, topple: 578, crush: 644, slime: 357, vent: 786 };
const CAT = { x: 116, z: 6, R: 16.5 };
const TAIL = { bx: 131.5, bz: 13, L: 27.5, r: 2.0, rest: Math.PI / 2 + 0.12, out: -0.06, P: 11.5, ph: 3.0 };
const TL = { cx: -141, cz: 10, ax: 21, az: 17 }; // wooden train loop (squircle)
const TRAIN = { lens: [9.6, 8.2, 8.2], gap: 0.9, V: 19, acc: 12, dwell: 5.5, r: 1.9, h: 6.5 };
const MOON = [0.36, 1, -0.78];

let A = null; // runtime state for tick / animate
const PI = Math.PI;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const onRug = (x, z, m = 0) => x > RUG.x0 + m && x < RUG.x1 - m && z > RUG.z0 + m && z < RUG.z1 - m;

// cat tail angle (radians, 0 = pointing east across the road) and twitch amount at time t
function tailPose(t) {
  const P = TAIL.P, u = (((t + TAIL.ph) % P) + P) % P;
  let a = TAIL.rest + Math.sin(t * 0.9) * 0.05, tw = 0.15 + 0.1 * Math.sin(t * 1.7);
  const T0 = 6.4, T1 = 7.9, T2 = 9.0, T3 = 9.45, T4 = 10.6;
  if (u >= T0 && u < T1) { tw = 1; a += Math.sin((u - T0) * 15) * 0.07 * ss(T0, T0 + 0.3, u); }
  else if (u >= T1 && u < T2) { a = lerp(TAIL.rest, TAIL.out, ss(T1, T2, u)); tw = 0.6; }
  else if (u >= T2 && u < T3) { a = TAIL.out + Math.sin((u - T2) * 12) * 0.05; tw = 0.9; }
  else if (u >= T3 && u < T4) { a = lerp(TAIL.out, TAIL.rest, ss(T3, T4, u)); tw = 0.4; }
  return { a, tw, u };
}

// wooden train: dwell at the station, then one lap with a gentle start and stop
function trainHead(t) {
  const S0 = A.tsched, { V, acc, dwell } = TRAIN;
  const P = S0.P, u = (((t - A.t0) % P) + P) % P;
  if (u < dwell) return 0;
  const q = u - dwell;
  if (q < S0.ta) return 0.5 * acc * q * q;
  if (q < S0.tr - S0.ta) return S0.da + V * (q - S0.ta);
  const w = Math.max(0, S0.tr - q);
  return S0.D - 0.5 * acc * w * w;
}

export default {
  id: 'toybox',
  name: 'Toy Box Mayhem',
  blurb: 'Monster trucks after bedtime: a playmat city, a book jump, crayons to crunch and a cat.',
  vehicle: 'monster',
  seed: 23,
  track: { points: TRACK, width: W, startS: S.start },
  bounds: BOUNDS,
  fallOffEdges: false,
  floorY: -60,
  offCourse: 18,
  skidColor: 0x1b1611,
  clackOnBump: true,
  dust: {
    normal: null,
    slow: { color: 0xf4f1ff, size: 1.0, life: 0.55, up: 2.5, grav: 4, alpha: 0.55, grow: 1.8, rate: 1.2 },
    slick: { color: 0xbfe6ff, size: 0.6, life: 0.4, up: 3, grav: 20, alpha: 0.9, grow: 1, rate: 1.5 },
    sticky: { color: 0x7dff4a, size: 0.8, life: 0.45, up: 2, grav: 22, alpha: 0.9, grow: 1, rate: 2 },
  },
  lighting: {
    sunDir: MOON, sunColor: 0x7491ec, sunIntensity: 0.78,
    hemiSky: 0x1a2752, hemiGround: 0x160e08, hemiIntensity: 0.17,
    envIntensity: 0.14, exposure: 1.1, background: 0x04060b, shadowRadius: 3.2,
  },

  async build(K) {
    const { THREE: T, TX, r, track } = K;
    const L = track.length;
    const V2 = (a, b = a) => new T.Vector2(a, b);
    A = { t0: 0, crunch: [], keep: new Set() };
    const keep = A.keep;
    const lowQ = K.quality && K.quality.tilt === false;

    // ------------------------------------------------------------------ small helpers
    const matCache = new Map();
    const plas = (c, rough = 0.38, cc = 0.35) => { const k = 'p' + c + ':' + rough + ':' + cc; if (!matCache.has(k)) matCache.set(k, K.phys({ color: c, roughness: rough, clearcoat: cc, clearcoatRoughness: 0.3 })); return matCache.get(k); };
    const matte = (c, rough = 0.8) => { const k = 'm' + c + ':' + rough; if (!matCache.has(k)) matCache.set(k, K.std({ color: c, roughness: rough })); return matCache.get(k); };
    const contacts = [];
    const ao = (x, z, rx, rz = rx, op = 0.35, ang = 0, y = 0.04) => contacts.push({ x, y, z, ry: -ang, sx: rx * 2, sy: op, sz: rz * 2 });
    const gy = (x, z) => (onRug(x, z) ? RUG.y : 0);
    const place = (obj, x, y, z, rotY = 0) => { obj.position.set(x, y, z); obj.rotation.y = rotY; return K.add(obj); };
    const M = (geo, mat, x, y, z, o = {}) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz; if (o.s) m.scale.set(...(Array.isArray(o.s) ? o.s : [o.s, o.s, o.s])); return m; };
    const sph = (rad, ws = 24, hs = 16) => new T.SphereGeometry(rad, ws, hs);
    const cyl = (r1, r2, h, seg = 24, open = false) => new T.CylinderGeometry(r1, r2, h, seg, 1, open);
    const rbox = (w, h, d, rad = 0.3, seg = 2) => new K.RoundedBoxGeometry(w, h, d, seg, Math.min(rad, w / 2.01, h / 2.01, d / 2.01));
    const furN = TX.mottledTextures({ size: 256, a: 0xffffff, b: 0xdddddd, seed: 61, period: 64, bump: 5, speck: 0.4 });
    K._furN = furN.normalMap;
    const fur = (c, sheen = 0xffffff) => { const k = 'f' + c; if (!matCache.has(k)) { const m = K.phys({ color: c, roughness: 0.92, sheen: 1, sheenColor: new T.Color(sheen), sheenRoughness: 0.45, normalMap: furN.normalMap, normalScale: V2(0.9) }); m.userData.fur = true; matCache.set(k, m); } return matCache.get(k); };
    const label = (w, h, draw) => { const c = TX.makeCanvas(w, h); draw(c.getContext('2d'), w, h); return c; };
    const gable = (w, h, d) => { const sh = new T.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(0, h); sh.closePath(); const g = new T.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false }); g.translate(0, 0, -d / 2); return g; };
    // bake a group of plain-coloured meshes into one vertex-coloured mesh (one draw call)
    const bake = (group, mat) => {
      group.updateMatrixWorld(true);
      const inv = new T.Matrix4().copy(group.matrixWorld).invert(), m4 = new T.Matrix4(), col = new T.Color();
      const geos = [];
      group.traverse((o) => {
        if (!o.isMesh) return;
        const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
        g.applyMatrix4(m4.multiplyMatrices(inv, o.matrixWorld));
        col.copy(o.material.color || new T.Color(1, 1, 1));
        const n = g.attributes.position.count, ca = new Float32Array(n * 3), src = o.material.vertexColors ? g.attributes.color : null;
        for (let i = 0; i < n; i++) ca.set([col.r * (src ? src.getX(i) : 1), col.g * (src ? src.getY(i) : 1), col.b * (src ? src.getZ(i) : 1)], i * 3);
        for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
        g.setAttribute('color', new T.BufferAttribute(ca, 3));
        geos.push(g);
      });
      const m = new T.Mesh(K.BufferGeometryUtils.mergeGeometries(geos), mat);
      m.castShadow = true; m.receiveShadow = true;
      return m;
    };
    const glows = [];
    function glowDecal(x, z, w, d, color, opacity, own = false) {
      if (!own) { const c = new T.Color(color).multiplyScalar(opacity); glows.push({ x, y: gy(x, z) + 0.3, z, sx: w, sy: 1, sz: d, color: c.getHex() }); return null; }
      const g = new T.PlaneGeometry(w, d); g.rotateX(-PI / 2);
      const m = new T.Mesh(g, new T.MeshBasicMaterial({ color, alphaMap: TX.blobShadowTexture(), transparent: true, opacity, blending: T.AdditiveBlending, depthWrite: false }));
      m.position.set(x, gy(x, z) + 0.3, z); m.renderOrder = 2;
      K.group.add(m); keep.add(m);
      return m;
    }
    const outsideSign = (s) => { let k = 0; for (let d = -10; d <= 10; d += 2) k += track.curv[track.idx(s + d)]; return k > 0 ? -1 : 1; };

    // ================================================================== FLOORBOARDS, WALLS
    {
      const oak = TX.woodTextures({ size: 1024, seed: 9, planks: 6, base: 0xb07a46, dark: 0x6a4123, light: 0xd8a66c, ringFreq: 13, gap: 0.0035, gapColor: 0x1e120a, roughBase: 0.42, lacquer: 0.35, varyPlanks: 0.16 });
      // butt joints across the boards
      const cv = oak.map.image, g = cv.getContext('2d');
      for (let p = 0; p < 6; p++) for (let k = 0; k < 2; k++) {
        const y = ((p * 389 + k * 512 + 97) % 1024);
        g.fillStyle = 'rgba(25,14,6,0.9)'; g.fillRect(p * 1024 / 6 + 2, y, 1024 / 6 - 4, 3);
        g.fillStyle = 'rgba(255,220,170,0.12)'; g.fillRect(p * 1024 / 6 + 2, y + 3, 1024 / 6 - 4, 2);
      }
      oak.map.needsUpdate = true;
      const geo = new T.PlaneGeometry(560, 420); geo.rotateX(-PI / 2);
      const pos = geo.attributes.position, uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getZ(i) / 66, pos.getX(i) / 66); // boards run east-west
      const floor = new T.Mesh(geo, K.std({ map: oak.map, normalMap: oak.normalMap, roughnessMap: oak.roughnessMap, normalScale: V2(0.55), envMapIntensity: 0.7 }));
      floor.position.set(0, 0, 40); floor.receiveShadow = true; K.group.add(floor); keep.add(floor);

      // walls: night-blue wallpaper with little moons and stars, white skirting boards
      const wc = label(256, 256, (g2, w, h) => {
        g2.fillStyle = '#26345e'; g2.fillRect(0, 0, w, h);
        for (let i = 0; i < 18; i++) { g2.fillStyle = i % 3 ? 'rgba(255,240,190,0.55)' : 'rgba(190,210,255,0.4)'; const x = (i * 71) % 256, y = (i * 113 + (i % 2) * 64) % 256; star2d(g2, x, y, 5 + (i % 3) * 2); }
        g2.fillStyle = 'rgba(255,236,170,0.5)'; g2.beginPath(); g2.arc(60, 190, 10, 0, PI * 2); g2.fill(); g2.fillStyle = '#26345e'; g2.beginPath(); g2.arc(66, 186, 9, 0, PI * 2); g2.fill();
      });
      const wallT = TX.toTexture(wc, { repeat: [10, 4] });
      const wallMat = K.std({ map: wallT, roughness: 0.9 });
      const skirt = K.std({ color: 0xe9e4da, roughness: 0.5 });
      const north = M(new T.BoxGeometry(400, 120, 4), wallMat, 0, 60, BOUNDS.minZ - 4);
      const west = M(new T.BoxGeometry(4, 120, 300), wallMat, BOUNDS.minX - 4, 60, 40);
      const east = M(new T.BoxGeometry(4, 120, 300), wallMat, BOUNDS.maxX + 4, 60, 40);
      for (const m of [north, west, east]) { m.receiveShadow = true; K.group.add(m); keep.add(m); }
      K.add(M(rbox(400, 9, 1.6, 0.4), skirt, 0, 4.5, BOUNDS.minZ - 1.4), { cast: false });
      K.add(M(rbox(1.6, 9, 300, 0.4), skirt, BOUNDS.minX - 1.4, 4.5, 40), { cast: false });
      K.add(M(rbox(1.6, 9, 300, 0.4), skirt, BOUNDS.maxX + 1.4, 4.5, 40), { cast: false });
      // invisible-wall hint along the south: nothing (the room continues towards the viewer)
    }

    // ================================================================== THE PLAYMAT RUG
    const RW = RUG.x1 - RUG.x0, RD = RUG.z1 - RUG.z0;
    const CW = 1024, CH = Math.round(1024 * RD / RW), PPU = CW / RW;
    const cx = (x) => (x - RUG.x0) * PPU, cz = (z) => (z - RUG.z0) * PPU;
    // which stretches of the course lie on the rug
    const rugRanges = [];
    {
      let s0 = 0; while (onRug(track.at(s0).x, track.at(s0).z, -2)) s0 += 1;
      let inR = false, a = 0;
      for (let k = 0; k <= L; k += 1) {
        const p = track.at(s0 + k), on = onRug(p.x, p.z, -2);
        if (on && !inR) { inR = true; a = s0 + k; }
        if (!on && inR) { inR = false; rugRanges.push([a - 9, s0 + k + 9]); }
      }
      if (inR) rugRanges.push([a - 9, s0 + L + 9]);
    }
    const RIVER = [[-20, -62], [-14, -40], [-4, -18], [-4.5, 4], [-5, 16], [-2, 36], [6, 52], [8, 66], [12, 80]];
    {
      const c = TX.makeCanvas(CW, CH), g = c.getContext('2d');
      // printed grass
      g.fillStyle = '#7dbb52'; g.fillRect(0, 0, CW, CH);
      for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '60,130,50' : '150,205,90'},0.18)`; g.beginPath(); g.ellipse(r() * CW, r() * CH, 6 + r() * 26, 4 + r() * 16, r() * 3, 0, PI * 2); g.fill(); }
      const line = (pts, w, col, cap = 'round') => { g.strokeStyle = col; g.lineWidth = w * PPU; g.lineJoin = 'round'; g.lineCap = cap; g.beginPath(); pts.forEach(([x, z], i) => (i ? g.lineTo(cx(x), cz(z)) : g.moveTo(cx(x), cz(z)))); g.stroke(); };
      const smooth = (pts) => { const o = []; for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < 6; k++) { const t = k / 6; o.push([lerp(pts[i][0], pts[i + 1][0], t), lerp(pts[i][1], pts[i + 1][1], t)]); } o.push(pts[pts.length - 1]); return o; };
      // river with sandy banks and a printed pond
      line(RIVER, 15, '#e4d49a'); line(RIVER, 11, '#3d8fd8'); line(RIVER, 5, 'rgba(140,200,250,0.6)');
      for (let i = 0; i < 40; i++) { const p = RIVER[1 + (i % 7)]; g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1.2; g.beginPath(); const x = cx(p[0] + r.range(-3, 3)), y = cz(p[1] + r.range(-8, 8)); g.moveTo(x - 6, y); g.quadraticCurveTo(x, y - 3, x + 6, y); g.stroke(); }
      g.fillStyle = '#e4d49a'; g.beginPath(); g.ellipse(cx(-34), cz(-44), 15 * PPU, 9 * PPU, 0.3, 0, PI * 2); g.fill();
      g.fillStyle = '#3d8fd8'; g.beginPath(); g.ellipse(cx(-34), cz(-44), 12.5 * PPU, 7 * PPU, 0.3, 0, PI * 2); g.fill();
      // side streets (printed, narrower, not part of the course)
      const side = [[[-20, 15], [-20, 60]], [[37, -20], [82, -20]], [[-86, -44], [-86, 60]], [[37, 35], [37, 60]], [[-62, 8], [-100, 8]]];
      for (const sd of side) line(sd, 14, '#d2cab6', 'butt');
      // course streets: pavement band, then asphalt
      const course = [];
      for (const [a, b] of rugRanges) { const pts = []; for (let s = a; s <= b; s += 2) { const p = track.at(s); pts.push([p.x, p.z]); } course.push(pts); }
      for (const pts of course) line(pts, W + 9, '#d2cab6');
      for (const sd of side) line(sd, 9, '#5d6169', 'butt');
      for (const pts of course) line(pts, W, '#5d6169');
      for (const sd of side) { g.setLineDash([3 * PPU, 3 * PPU]); line(sd, 0.45, '#f4f1e6', 'butt'); g.setLineDash([]); }
      // zebra crossings on the side streets near junctions
      const zebra = (x, z, ang, len = 8) => { g.save(); g.translate(cx(x), cz(z)); g.rotate(ang); g.fillStyle = '#f2efe6'; for (let k = -3; k <= 3; k++) g.fillRect(k * 1.3 * PPU - 0.4 * PPU, -len / 2 * PPU + 0.6 * PPU, 0.8 * PPU, (len - 1.2) * PPU); g.restore(); };
      zebra(-20, 32, PI / 2); zebra(55, -20, 0); zebra(-86, 20, PI / 2); zebra(-80, 8, 0);
      // buildings seen from above: roofs with ridge lines and shadows
      const roof = (x, z, w, d, col, ang = 0, kind = 0) => {
        g.save(); g.translate(cx(x), cz(z)); g.rotate(ang);
        g.fillStyle = 'rgba(30,40,30,0.35)'; g.fillRect(-w / 2 * PPU + 4, -d / 2 * PPU + 5, w * PPU, d * PPU);
        g.fillStyle = col; g.fillRect(-w / 2 * PPU, -d / 2 * PPU, w * PPU, d * PPU);
        g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2; g.strokeRect(-w / 2 * PPU, -d / 2 * PPU, w * PPU, d * PPU);
        if (kind === 0) { g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(-w / 2 * PPU, 0, w * PPU, d / 2 * PPU); g.strokeStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(-w / 2 * PPU, 0); g.lineTo(w / 2 * PPU, 0); g.stroke(); }
        if (kind === 1) { g.fillStyle = '#fff'; g.fillRect(-1.2 * PPU, -3.5 * PPU, 2.4 * PPU, 7 * PPU); g.fillRect(-3.5 * PPU, -1.2 * PPU, 7 * PPU, 2.4 * PPU); }
        if (kind === 2) { g.fillStyle = '#f5f1e8'; g.font = `bold ${Math.round(5 * PPU)}px Rubik, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('P', 0, 0); }
        g.restore();
      };
      const tree = (x, z, rad = 2.6) => { g.fillStyle = 'rgba(20,50,20,0.35)'; g.beginPath(); g.arc(cx(x) + 3, cz(z) + 4, rad * PPU, 0, PI * 2); g.fill(); g.fillStyle = '#3f8f3a'; g.beginPath(); g.arc(cx(x), cz(z), rad * PPU, 0, PI * 2); g.fill(); g.fillStyle = '#5fb04e'; g.beginPath(); g.arc(cx(x) - rad * 0.3 * PPU, cz(z) - rad * 0.3 * PPU, rad * 0.55 * PPU, 0, PI * 2); g.fill(); };
      // infield city between the dent street and Main Street
      roof(-40, 37, 14, 10, '#d9553b'); roof(-6, 36, 12, 12, '#3f74c4', 0, 0); roof(14, 33, 10, 9, '#f2b33a');
      roof(-6, 47, 9, 6, '#e8e4dc', 0, 1); roof(24, 45, 12, 6, '#8a5bc4');
      // east block: car park + fire station + houses
      roof(64, -2, 22, 26, '#6c7078', 0, 2);
      { g.strokeStyle = '#f2efe6'; g.lineWidth = 1.5; for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(cx(54 + k * 4), cz(-14)); g.lineTo(cx(54 + k * 4), cz(-8)); g.stroke(); g.beginPath(); g.moveTo(cx(54 + k * 4), cz(4)); g.lineTo(cx(54 + k * 4), cz(10)); g.stroke(); } }
      roof(62, 28, 16, 12, '#c8352c'); roof(64, -36, 14, 12, '#f2b33a', 0.0); roof(64, 44, 10, 8, '#3f74c4');
      // west block: farm fields and houses
      g.save(); g.beginPath(); g.rect(cx(-99), cz(16), 11 * PPU, 36 * PPU); g.clip(); for (let k = 0; k < 20; k++) { g.fillStyle = k % 2 ? '#c8a457' : '#b18e45'; g.fillRect(cx(-99), cz(16 + k * 1.8), 11 * PPU, 1.8 * PPU); } g.restore();
      roof(-75, 26, 10, 9, '#d9553b'); roof(-74, 44, 9, 8, '#f2b33a'); roof(-75, -18, 10, 12, '#3f74c4'); roof(-93, -16, 9, 9, '#e8e4dc', 0, 1);
      // football pitch in the north park
      { const x0 = cx(-6), z0 = cz(-52); g.fillStyle = '#5fa845'; g.fillRect(x0, z0, 24 * PPU, 15 * PPU); g.strokeStyle = '#f4f2ea'; g.lineWidth = 1.6; g.strokeRect(x0 + 3, z0 + 3, 24 * PPU - 6, 15 * PPU - 6); g.beginPath(); g.moveTo(x0 + 12 * PPU, z0 + 3); g.lineTo(x0 + 12 * PPU, z0 + 15 * PPU - 3); g.stroke(); g.beginPath(); g.arc(x0 + 12 * PPU, z0 + 7.5 * PPU, 2.5 * PPU, 0, PI * 2); g.stroke(); }
      for (let i = 0; i < 46; i++) {
        const x = r.range(RUG.x0 + 3, RUG.x1 - 3), z = r.range(RUG.z0 + 3, RUG.z1 - 3);
        const n = track.distTo(x, z);
        if (n.dist < W / 2 + 7) continue;
        let ok = true; for (const sd of side) { const [[ax, az], [bx, bz]] = sd; const t = clamp(((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2), 0, 1); if (Math.hypot(x - ax - (bx - ax) * t, z - az - (bz - az) * t) < 9) ok = false; }
        if (Math.abs(x - (-5)) < 10 && z > -60 && z < 80) ok = false;
        if (ok) tree(x, z, r.range(1.8, 3.2));
      }
      // printed border
      g.strokeStyle = '#25407a'; g.lineWidth = 2.4 * PPU; g.strokeRect(1.2 * PPU, 1.2 * PPU, CW - 2.4 * PPU, CH - 2.4 * PPU);
      g.setLineDash([2 * PPU, 1.5 * PPU]); g.strokeStyle = '#f0e8d0'; g.lineWidth = 0.35 * PPU; g.strokeRect(1.2 * PPU, 1.2 * PPU, CW - 2.4 * PPU, CH - 2.4 * PPU); g.setLineDash([]);
      // fabric weave normal (fine, tiled) + soft wear
      const weave = TX.paint(128, 128, (x, y, u, v, o) => { const a = Math.sin(x * PI / 2) * Math.sin(y * PI / 2); o[0] = 128 + a * 60; o[1] = 128 - a * 60; o[2] = 255; });
      const wn = TX.toTexture(weave, { srgb: false, repeat: [RW / 1.4, RD / 1.4] });
      const mat = K.std({ map: TX.toTexture(c, { wrap: false }), normalMap: wn, normalScale: V2(0.35), roughness: 0.95 });
      const geo = new T.PlaneGeometry(RW, RD); geo.rotateX(-PI / 2);
      const rug = new T.Mesh(geo, mat); rug.position.set((RUG.x0 + RUG.x1) / 2, RUG.y, (RUG.z0 + RUG.z1) / 2); rug.receiveShadow = true;
      K.group.add(rug); keep.add(rug);
      // rubber backing edge + bound hem
      const hem = K.std({ color: 0x1e2f5a, roughness: 0.85 });
      for (const [x, z, w, d] of [[(RUG.x0 + RUG.x1) / 2, RUG.z0, RW + 1, 1], [(RUG.x0 + RUG.x1) / 2, RUG.z1, RW + 1, 1], [RUG.x0, (RUG.z0 + RUG.z1) / 2, 1, RD + 1], [RUG.x1, (RUG.z0 + RUG.z1) / 2, 1, RD + 1]]) K.add(M(rbox(w, 0.36, d, 0.16), hem, x, 0.15, z), { cast: false });
      ao((RUG.x0 + RUG.x1) / 2, (RUG.z0 + RUG.z1) / 2, RW * 0.52, RD * 0.53, 0.18);
    }

    // ------------------------------------------------------------------ road ribbons on the rug (sharp print)
    const ribbon = (s0, s1, off, width, y, mat, vScale, clampRug = true, step = 1) => {
      const pos = [], uv = [], idx = [];
      let n = 0;
      for (let s = s0; s <= s1 + 0.001; s += step) {
        const p = track.at(s);
        for (const sd of [-1, 1]) {
          const o = off + sd * width / 2;
          let x = p.x + p.nx * o, z = p.z + p.nz * o;
          if (clampRug) { x = clamp(x, RUG.x0 + 0.6, RUG.x1 - 0.6); z = clamp(z, RUG.z0 + 0.6, RUG.z1 - 0.6); }
          pos.push(x, y, z); uv.push((sd + 1) / 2, s / vScale);
        }
        if (n > 0) { const a = (n - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
        n++;
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
      g.computeVertexNormals(); const nr = g.attributes.normal; for (let i = 0; i < nr.count; i++) nr.setXYZ(i, 0, 1, 0);
      if (!ribbonQ.has(mat)) ribbonQ.set(mat, []);
      ribbonQ.get(mat).push(g);
      return g;
    };
    const ribbonQ = new Map();
    const flushRibbons = () => {
      for (const [mat, list] of ribbonQ) {
        const m = new T.Mesh(list.length > 1 ? K.BufferGeometryUtils.mergeGeometries(list) : list[0], mat);
        m.receiveShadow = true; K.group.add(m); keep.add(m);
      }
      ribbonQ.clear();
    };
    {
      const rc = label(256, 512, (g) => {
        g.fillStyle = '#5b5f68'; g.fillRect(0, 0, 256, 512);
        const d = g.getImageData(0, 0, 256, 512);
        for (let i = 0; i < d.data.length; i += 4) { const px = (i / 4) % 256, py = Math.floor(i / 4 / 256); const w = ((px >> 1) + (py >> 1)) % 2 ? 6 : -6; const n = (r() - 0.5) * 16 + w; d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n; }
        g.putImageData(d, 0, 0);
        g.fillStyle = '#f3f0e6'; for (let k = 0; k < 4; k++) g.fillRect(124, k * 128 + 16, 8, 72);
        g.fillStyle = 'rgba(243,240,230,0.85)'; g.fillRect(9, 0, 4, 512); g.fillRect(243, 0, 4, 512);
      });
      const roadMat = K.std({ map: TX.toTexture(rc), roughness: 0.93 });
      const kc = label(64, 128, (g) => { g.fillStyle = '#d8332c'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#f4f1e8'; g.fillRect(0, 64, 64, 64); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 0, 6, 128); });
      const kerbMat = K.std({ map: TX.toTexture(kc), roughness: 0.9 });
      for (const [a, b] of rugRanges) {
        ribbon(a, b, 0, W, RUG.y + 0.03, roadMat, 32);
        ribbon(a, b, -(W / 2 + 0.7), 1.4, RUG.y + 0.045, kerbMat, 4.4);
        ribbon(a, b, W / 2 + 0.7, 1.4, RUG.y + 0.045, kerbMat, 4.4);
      }
      // off the rug: a masking-tape road stuck to the floorboards (edge strips + taped centre dashes)
      const tapeC = label(64, 256, (g) => {
        g.fillStyle = '#e9dcb4'; g.fillRect(0, 0, 64, 256);
        for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '255,250,230' : '170,150,110'},0.18)`; g.fillRect(r() * 64, r() * 256, 1 + r() * 3, 2 + r() * 20); }
        g.fillStyle = 'rgba(120,100,60,0.35)'; g.fillRect(0, 0, 64, 2); g.fillRect(0, 62, 64, 2); g.fillRect(0, 140, 64, 1);
        g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(0, 0, 3, 256); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(61, 0, 3, 256);
      });
      const tapeMat = K.std({ map: TX.toTexture(tapeC), roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
      ribbon(0, L, -(W / 2 - 1.0), 2.0, 0.03, tapeMat, 26, false, 1.5);
      ribbon(0, L, W / 2 - 1.0, 2.0, 0.03, tapeMat, 26, false, 1.5);
      const dashC = label(64, 256, (g) => { g.clearRect(0, 0, 64, 256); g.fillStyle = '#f2f0ea'; g.fillRect(0, 20, 64, 120); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 20, 64, 3); g.fillRect(0, 137, 64, 3); });
      const dashMat = K.std({ map: TX.toTexture(dashC), roughness: 0.5, alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
      ribbon(0, L, 0, 1.3, 0.035, dashMat, 9, false, 1.5);
      flushRibbons();
      // start / finish: printed chequer across the road + a grid box
      const fc = label(256, 64, (g) => { for (let y = 0; y < 4; y++) for (let x = 0; x < 16; x++) { g.fillStyle = (x + y) % 2 ? '#141414' : '#f6f3ea'; g.fillRect(x * 16, y * 16, 16, 16); } });
      const p = track.at(S.start);
      const fm = new T.Mesh(new T.PlaneGeometry(W, 3.4), K.std({ map: TX.toTexture(fc, { wrap: false }), roughness: 0.85 }));
      fm.rotation.order = 'YXZ'; fm.rotation.y = -p.angle + PI / 2; fm.rotation.x = -PI / 2; fm.position.set(p.x, RUG.y + 0.065, p.z);
      fm.receiveShadow = true; K.group.add(fm);
      // grid slots
      const slotMat = K.std({ color: 0xf3f0e6, roughness: 0.85 });
      const slots = [];
      for (let k = 0; k < 4; k++) {
        const back = Math.floor(k / 2) * 7.5 + (k % 2) * 2.5 + 3.2, lat = (k % 2 ? 1 : -1) * Math.min(3.2, W / 2 - 2.2);
        const q = track.place(S.start - back, lat);
        const sg = new T.PlaneGeometry(0.35, 3.6); sg.rotateX(-PI / 2); sg.rotateY(-q.angle + PI / 2); sg.translate(q.x, RUG.y + 0.06, q.z); slots.push(sg);
      }
      const slm = new T.Mesh(K.BufferGeometryUtils.mergeGeometries(slots), slotMat); slm.receiveShadow = true; K.group.add(slm); keep.add(slm);
    }

    // ================================================================== SHARED TOY MATERIALS & GEOMETRY
    // alphabet blocks: one atlas, per-block face cells
    const atlas = (() => {
      const cols = ['#d63c33', '#2f6fc4', '#f2b52c', '#3d9a4a', '#e9d3a8', '#e7742a', '#8a4fc0', '#e9d3a8'];
      const c = label(512, 512, (g) => {
        for (let i = 0; i < 16; i++) {
          const x = (i % 4) * 128, y = Math.floor(i / 4) * 128;
          const col = cols[i % 8];
          g.fillStyle = '#e8cfa0'; g.fillRect(x, y, 128, 128);
          for (let k = 0; k < 9; k++) { g.strokeStyle = `rgba(150,100,50,${0.08 + r() * 0.1})`; g.lineWidth = 1 + r() * 2; g.beginPath(); g.moveTo(x, y + r() * 128); g.bezierCurveTo(x + 40, y + r() * 128, x + 90, y + r() * 128, x + 128, y + r() * 128); g.stroke(); }
          g.strokeStyle = col; g.lineWidth = 10; g.strokeRect(x + 12, y + 12, 104, 104);
          g.fillStyle = col === '#e9d3a8' ? '#c8352c' : col; g.font = '84px "Lilita One", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText('ABCDEFGHKLMNPRST'[i], x + 64, y + 70);
        }
      });
      return TX.toTexture(c, { wrap: false });
    })();
    const blockMat = K.phys({ map: atlas, roughness: 0.55, clearcoat: 0.45, clearcoatRoughness: 0.4 });
    const blockGeo = (size, cells, seg = 2) => {
      const g = rbox(size, size, size, size * 0.09, seg);
      const uv = g.attributes.uv, idx = g.index;
      const done = new Set();
      g.groups.forEach((gr, f) => {
        const cell = cells[f % cells.length];
        const u0 = (cell % 4) / 4, v0 = 1 - (Math.floor(cell / 4) + 1) / 4;
        for (let k = gr.start; k < gr.start + gr.count; k++) {
          const vi = idx ? idx.getX(k) : k; if (done.has(vi)) continue; done.add(vi);
          uv.setXY(vi, u0 + (0.02 + uv.getX(vi) * 0.96) / 4, v0 + (0.02 + uv.getY(vi) * 0.96) / 4);
        }
      });
      g.clearGroups();
      return g;
    };
    const blockGeos = [];
    for (let k = 0; k < 8; k++) blockGeos.push(blockGeo(4.4, [k, (k + 5) % 16, (k + 9) % 16, (k + 3) % 16, (k + 12) % 16, (k + 7) % 16]));
    const bigBlockGeos = [0, 1, 2].map((k) => blockGeo(5.4, [k * 3, k * 3 + 1, k * 3 + 2, k * 3 + 6, k * 3 + 4, 15 - k]));
    // static block stack (tower): merged into the static batch later
    const tower = (x, z, n, rot = 0, size = 4.4, lean = 0.06) => {
      for (let i = 0; i < n; i++) {
        const m = new T.Mesh(blockGeos[(i * 3 + Math.round(x)) & 7], blockMat);
        m.position.set(x + r.range(-lean, lean) * size, gy(x, z) + size / 2 + i * size, z + r.range(-lean, lean) * size);
        m.rotation.y = rot + r.range(-0.18, 0.18);
        K.add(m);
      }
      ao(x, z, size * 0.85, size * 0.85, 0.45);
      K.box(x, z, size * 0.55, size * 0.55, -rot, n * size, { solid: true });
    };

    // ================================================================== OFF-RUG ROAD EDGES: rows of little alphabet cubes + cones
    const nearTrain = (x, z) => { const qx = (x - TL.cx) / TL.ax, qz = (z - TL.cz) / TL.az; const d = Math.pow(qx * qx * qx * qx + qz * qz * qz * qz, 0.25); return Math.abs(d - 1) < 0.18; };
    {
      const small = [0, 1, 2, 3].map((k) => blockGeo(2.0, [k * 4, k * 4 + 1, k * 4 + 2, k * 4 + 3, (k * 4 + 5) % 16, (k * 4 + 6) % 16], 1));
      const lists = [[], [], [], []];
      for (const sd of [-1, 1]) {
        let k = 0;
        for (const p of track.edgePoints(sd, 2.9, 1.3)) {
          if (onRug(p.x, p.z, -1.5)) continue;
          if (nearTrain(p.x, p.z)) continue;
          if (Math.hypot(p.x - 114, p.z - 76) < 17) continue; // the fluffy rug has its own fringe
          if (p.x < BOUNDS.minX + 2 || p.x > BOUNDS.maxX - 2 || p.z > BOUNDS.maxZ - 2) continue;
          const j = (k++) % 4;
          lists[j].push({ x: p.x, y: 1.0, z: p.z, ry: -p.angle + r.range(-0.25, 0.25) });
        }
      }
      lists.forEach((l, i) => K.instances(small[i], blockMat, l));
      for (const l of lists) for (const it of l) ao(it.x, it.z, 1.6, 1.6, 0.3);
      // toy traffic cones at the floorboard corners
      const coneGeo = (() => {
        const parts = [];
        const c1 = K.lathe([[0, 3.0], [0.35, 2.95], [1.0, 0.45], [1.0, 0.3], [0, 0.3]], 20);
        parts.push(c1);
        const base = new T.BoxGeometry(2.4, 0.3, 2.4); base.translate(0, 0.15, 0); parts.push(base.toNonIndexed());
        return K.BufferGeometryUtils.mergeGeometries([c1.toNonIndexed(), base.toNonIndexed()]);
      })();
      const cc = label(32, 64, (g) => { g.fillStyle = '#ff6a1a'; g.fillRect(0, 0, 32, 64); g.fillStyle = '#f6f4ee'; g.fillRect(0, 20, 32, 9); g.fillRect(0, 36, 32, 6); });
      const coneMat = K.phys({ map: TX.toTexture(cc, { wrap: false }), roughness: 0.4, clearcoat: 0.4 });
      const cones = [];
      for (const s of [158, 176, 196, 228, 312, 330, 708, 770, 800]) {
        const sd = outsideSign(s);
        const q = track.place(s, sd * (W / 2 + 3.6));
        if (onRug(q.x, q.z, -2) || nearTrain(q.x, q.z)) continue;
        cones.push({ x: q.x, y: 0, z: q.z, ry: r() * 6 });
        ao(q.x, q.z, 1.6, 1.6, 0.35);
      }
      K.instances(coneGeo, coneMat, cones);
    }

    // ================================================================== NORTH EDGE: BED, NIGHT LIGHT, TOY CHEST, DOLL'S HOUSE, MARBLE RUN
    // ---- the bed (north-west): duvet hanging over the side, dark gap underneath
    {
      const dc = label(512, 512, (g) => {
        g.fillStyle = '#1f2f63'; g.fillRect(0, 0, 512, 512);
        for (let i = 0; i < 60; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,230,140,0.85)' : 'rgba(255,255,255,0.7)'; star2d(g, r() * 512, r() * 512, 3 + r() * 6); }
        const planet = (x, y, rad, col, ring) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, rad, 0, PI * 2); g.fill(); if (ring) { g.strokeStyle = '#f2d27a'; g.lineWidth = 5; g.beginPath(); g.ellipse(x, y, rad * 1.7, rad * 0.45, -0.3, 0, PI * 2); g.stroke(); } };
        planet(110, 120, 34, '#e9743a', true); planet(380, 300, 26, '#58b7d8', false); planet(260, 90, 16, '#d9553b', false);
        const rocket = (x, y, a) => { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = '#f4f1ea'; g.beginPath(); g.ellipse(0, 0, 14, 36, 0, 0, PI * 2); g.fill(); g.fillStyle = '#d9333a'; g.beginPath(); g.moveTo(-14, 18); g.lineTo(-24, 40); g.lineTo(-6, 30); g.fill(); g.beginPath(); g.moveTo(14, 18); g.lineTo(24, 40); g.lineTo(6, 30); g.fill(); g.fillStyle = '#58b7d8'; g.beginPath(); g.arc(0, -6, 6, 0, PI * 2); g.fill(); g.fillStyle = '#ffb02e'; g.beginPath(); g.moveTo(-8, 34); g.lineTo(0, 58); g.lineTo(8, 34); g.fill(); g.restore(); };
        rocket(300, 420, 0.5); rocket(120, 330, -0.4); rocket(440, 120, 0.9);
      });
      const dT = TX.toTexture(dc, { repeat: [2.2, 1] });
      const duvet = K.phys({ map: dT, roughness: 0.95, sheen: 0.6, sheenColor: new T.Color(0x8899cc), normalMap: furN.normalMap, normalScale: V2(0.4) });
      const x0 = BOUNDS.minX - 2, x1 = -52, zf = -69;
      const frame = matte(0xd9cbb3, 0.6);
      K.add(M(new T.BoxGeometry(x1 - x0, 30, 30), frame, (x0 + x1) / 2, 15, zf - 15));
      // duvet: top slab + a wavy drape hanging down the side to just above the floor
      const top = M(rbox(x1 - x0 + 4, 9, 32, 3.5, 3), duvet, (x0 + x1) / 2, 43, zf - 13);
      K.add(top);
      const dg = new T.PlaneGeometry(x1 - x0 + 4, 36, 60, 6);
      const dp = dg.attributes.position;
      for (let i = 0; i < dp.count; i++) { const x = dp.getX(i), y = dp.getY(i); const k = (18 - y) / 36; dp.setZ(i, Math.sin(x * 0.42) * 1.1 * (0.3 + k) + k * 1.8); }
      dg.computeVertexNormals();
      const drape = M(dg, duvet, (x0 + x1) / 2, 26, zf + 2.6);
      K.add(drape);
      // dark under-bed gap
      ao((x0 + x1) / 2, zf + 1, (x1 - x0) / 2 + 4, 6, 0.75);
      ao((x0 + x1) / 2, zf + 5, (x1 - x0) / 2 + 4, 6, 0.35);
      K.box((x0 + x1) / 2, zf - 15, (x1 - x0) / 2, 16, 0, 60, { solid: true });
      // bed leg peeking out and a lost sock
      K.add(M(cyl(1.6, 1.4, 8, 16), frame, x1 - 3, 4, zf - 1.5));
      K.add(M(rbox(9, 1.6, 3.6, 0.8), fur(0xd84f6a), -70, 0.8, zf + 5, { ry: 0.5 }));
    }
    // ---- the night light: a little lamp with a fabric shade, warm glow (point light)
    const NL = { x: -40, z: -78 };
    {
      const wood = matte(0xc79a62, 0.55);
      K.add(M(K.lathe([[0, 0], [5.5, 0], [5.8, 0.8], [5.2, 1.8], [1.2, 2.4], [1.0, 9], [0, 9]], 32), wood, NL.x, 0, NL.z));
      const shadeC = label(256, 128, (g) => { g.fillStyle = '#f6e3b8'; g.fillRect(0, 0, 256, 128); for (let i = 0; i < 22; i++) { g.fillStyle = 'rgba(255,190,90,0.9)'; star2d(g, (i * 47) % 256, 20 + ((i * 29) % 90), 6); } });
      const shade = K.std({ map: TX.toTexture(shadeC), color: 0xffffff, emissive: 0xffaa55, emissiveMap: TX.toTexture(shadeC), emissiveIntensity: 1.6, roughness: 0.9, side: T.DoubleSide });
      const sh = M(cyl(5.2, 7.8, 8.5, 32, true), shade, NL.x, 12.5, NL.z);
      K.add(sh, { cast: false }); keep.add(sh);
      const bulb = M(sph(1.8, 16, 12), K.std({ color: 0xfff1d0, emissive: 0xffd28a, emissiveIntensity: 3 }), NL.x, 11.5, NL.z);
      K.add(bulb, { cast: false }); keep.add(bulb);
      const pl = new T.PointLight(0xffa050, 1500, 0, 2); pl.position.set(NL.x, 13, NL.z + 3); K.group.add(pl);
      A.nightLight = pl;
      ao(NL.x, NL.z, 7, 7, 0.4);
      K.circle(NL.x, NL.z, 6, 20, { solid: true });
      // warm pool on the floor (a soft additive decal so it reads even on low quality)
      glowDecal(NL.x, NL.z + 6, 70, 46, 0xff9a40, 0.22);
    }
    // ---- toy chest (north-east), lid open, toys peeking out
    {
      const x0 = 62, x1 = 122, z0 = BOUNDS.minZ, z1 = -73, h = 34;
      const tc = label(512, 256, (g) => {
        g.fillStyle = '#7fb7d6'; g.fillRect(0, 0, 512, 256);
        for (let i = 0; i < 40; i++) { g.strokeStyle = 'rgba(40,80,110,0.12)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, r() * 256); g.lineTo(512, r() * 256); g.stroke(); }
        g.strokeStyle = '#f4efe2'; g.lineWidth = 14; g.strokeRect(14, 14, 484, 228);
        g.fillStyle = '#f4efe2'; g.font = '92px "Lilita One", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('TOYS', 256, 134);
        for (const [x, y] of [[70, 70], [440, 70], [70, 190], [440, 190]]) { g.fillStyle = '#ffd34a'; star2d(g, x, y, 22); }
      });
      const front = K.std({ map: TX.toTexture(tc, { wrap: false }), roughness: 0.6 });
      const paint = matte(0x7fb7d6, 0.6);
      const chest = new T.Mesh(new T.BoxGeometry(x1 - x0, h, z1 - z0), [paint, paint, paint, paint, front, paint]);
      chest.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2); K.add(chest); keep.add(chest);
      const trim = matte(0xf4efe2, 0.5);
      K.add(M(rbox(x1 - x0 + 1.5, 2.2, 1.6, 0.6), trim, (x0 + x1) / 2, 1.1, z1 + 0.3));
      K.add(M(rbox(x1 - x0 + 1.5, 2.2, z1 - z0 + 1.5, 0.6), trim, (x0 + x1) / 2, h, (z0 + z1) / 2));
      ao((x0 + x1) / 2, z1, (x1 - x0) / 2 + 4, 5, 0.6);
      K.box((x0 + x1) / 2, (z0 + z1) / 2, (x1 - x0) / 2, (z1 - z0) / 2, 0, h, { solid: true });
      // toys sticking out of the top
      const ball = M(sph(7, 28, 18), plas(0xe8443a, 0.35, 0.6), 76, h + 2, (z0 + z1) / 2 + 2); K.add(ball);
      const rab = new T.Group();
      rab.add(M(sph(5, 20, 14), fur(0xf0e6da), 0, 0, 0, { s: [1, 1.1, 1] }));
      for (const sd of [-1, 1]) rab.add(M(new T.CapsuleGeometry(1.4, 8, 6, 12), fur(0xf0e6da), sd * 2.2, 8, -1, { rz: sd * -0.25 }));
      for (const sd of [-1, 1]) rab.add(M(sph(0.7, 10, 8), plas(0x111111, 0.2, 1), sd * 2, 1, 4.4));
      place(rab, 104, h + 4, (z0 + z1) / 2 + 3, -0.2);
      K.add(M(cyl(0.6, 0.6, 22, 10), matte(0xb8864f, 0.6), 92, h + 6, (z0 + z1) / 2, { rz: 0.5, rx: 0.2 }));
    }
    // ---- doll's house against the east wall, lit windows
    {
      const x0 = 132, x1 = BOUNDS.maxX + 2, z1 = -70, z0 = BOUNDS.minZ, h = 46;
      const fc = label(512, 512, (g) => {
        g.fillStyle = '#f2d9c4'; g.fillRect(0, 0, 512, 512);
        for (let y = 0; y < 512; y += 24) { g.fillStyle = 'rgba(160,110,90,0.12)'; g.fillRect(0, y, 512, 2); }
        const win = (x, y, w, hh) => { g.fillStyle = '#ffd27a'; g.fillRect(x, y, w, hh); g.fillStyle = '#f7f2ea'; g.fillRect(x - 6, y - 6, w + 12, 6); g.fillRect(x - 6, y + hh, w + 12, 8); g.fillRect(x + w / 2 - 3, y, 6, hh); g.fillRect(x, y + hh / 2 - 3, w, 6); g.fillStyle = '#e46a7c'; g.fillRect(x - 10, y + hh + 8, w + 20, 10); };
        win(60, 80, 110, 120); win(320, 80, 110, 120); win(60, 300, 110, 120);
        g.fillStyle = '#6a3f8a'; g.fillRect(320, 300, 110, 212); g.fillStyle = '#ffd34a'; g.beginPath(); g.arc(410, 410, 7, 0, PI * 2); g.fill();
      });
      const ec = label(512, 512, (g) => { g.fillStyle = '#000'; g.fillRect(0, 0, 512, 512); g.fillStyle = '#ffb860'; for (const [x, y] of [[60, 80], [320, 80], [60, 300]]) { g.fillRect(x, y, 110, 120); } });
      const facade = K.std({ map: TX.toTexture(fc, { wrap: false }), emissive: 0xffffff, emissiveMap: TX.toTexture(ec, { wrap: false }), emissiveIntensity: 0.9, roughness: 0.7 });
      const wallP = matte(0xf2d9c4, 0.7);
      const house = new T.Mesh(new T.BoxGeometry(x1 - x0, h, z1 - z0), [wallP, wallP, wallP, wallP, facade, wallP]);
      house.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2); K.add(house); keep.add(house);
      K.add(M(gable(x1 - x0 + 4, 16, z1 - z0 + 3), matte(0xc8433a, 0.6), (x0 + x1) / 2, h, (z0 + z1) / 2));
      ao((x0 + x1) / 2, z1, (x1 - x0) / 2 + 3, 5, 0.6);
      K.box((x0 + x1) / 2, (z0 + z1) / 2, (x1 - x0) / 2, (z1 - z0) / 2, 0, h, { solid: true });
      glowDecal((x0 + x1) / 2, z1 + 8, 40, 16, 0xffb860, 0.16);
    }
    // ---- marble run (north centre): posts, zig-zag chutes, a funnel, and the run-out chute
    const MR = { x: 6, z: -84, exitX: 20, exitZ: -52 };
    {
      const post = plas(0xf2efe6, 0.3, 0.5);
      const chuteMats = [plas(0xe8443a), plas(0x2f86d6), plas(0xf2b52c), plas(0x3daa52)];
      const tube = K.glass(0xcfe8ff, 0.28);
      const cxm = MR.x, czm = MR.z;
      for (const [dx, dz] of [[-9, -5], [9, -5], [-9, 5], [9, 5]]) K.add(M(cyl(0.9, 0.9, 40, 12), post, cxm + dx, 20, czm + dz));
      const chutes = new T.Group();
      for (let k = 0; k < 5; k++) {
        const y = 34 - k * 6.5, dir = k % 2 ? 1 : -1;
        const g = new T.CylinderGeometry(1.6, 1.6, 20, 16, 1, true, 0, PI); g.rotateZ(PI / 2);
        chutes.add(M(g, chuteMats[k % 4], cxm, y, czm + (k % 2 ? 3.5 : -3.5), { rz: dir * 0.18 }));
      }
      K.add(M(K.lathe([[1.2, 0], [1.4, 0.2], [7, 5], [7.4, 5.4]], 24), K.glass(0xffd0e0, 0.35), cxm, 38, czm), { cast: false });
      // run-out chute down to the floor towards the road
      const dx = MR.exitX - cxm, dz = MR.exitZ - czm, len = Math.hypot(dx, dz), ang = Math.atan2(dz, dx);
      const g = new T.CylinderGeometry(1.7, 1.7, len, 16, 1, true, 0, PI); g.rotateZ(PI / 2);
      const ch = new T.Mesh(g, chuteMats[1]);
      ch.position.set(cxm + dx / 2, 4.2, czm + dz / 2); ch.rotation.order = 'YZX'; ch.rotation.y = -ang; ch.rotation.z = -Math.atan2(7, len);
      chutes.add(ch);
      const cm = bake(chutes, K.phys({ vertexColors: true, roughness: 0.3, clearcoat: 0.6, side: T.DoubleSide }));
      K.group.add(cm); keep.add(cm);
      K.add(M(cyl(0.7, 0.7, 7, 10), post, cxm + dx * 0.25, 3.5, czm + dz * 0.25));
      ao(cxm, czm, 13, 9, 0.5); ao(cxm + dx / 2, czm + dz / 2, len / 2, 3, 0.25, ang);
      K.box(cxm, czm, 10.5, 6.5, 0, 40, { solid: true });
      // marbles sitting in the chutes
      const mb = [];
      for (let i = 0; i < 9; i++) mb.push({ x: cxm + r.range(-8, 8), y: 34 - (i % 5) * 6.5 + 0.9, z: czm + (i % 2 ? 3.5 : -3.5), s: 0.85, color: r.pick([0xff5a7a, 0x4ab8ff, 0xffd34a, 0x5ae08a, 0xffffff]) });
      A.marbleGeo = sph(1, 14, 10);
      A.marbleMat = K.phys({ color: 0xffffff, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02, transmission: 0, envMapIntensity: 1.6 });
      K.instances(A.marbleGeo, A.marbleMat, mb, { colors: true });
    }

    // ================================================================== MOONLIGHT: curtains, shaft, floor patch, dust
    const WIN = { x0: 4, x1: 48, y0: 70, y1: 132 };
    {
      // curtains hanging to the floor either side of the window
      const cc = label(256, 256, (g) => { g.fillStyle = '#2c3f78'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(255,236,170,0.75)'; star2d(g, (i * 67) % 256, (i * 41) % 256, 6); } });
      const cmat = K.std({ map: TX.toTexture(cc, { repeat: [2, 4] }), roughness: 0.95, side: T.DoubleSide });
      for (const [xa, xb] of [[WIN.x0 - 18, WIN.x0 + 4], [WIN.x1 - 4, WIN.x1 + 18]]) {
        const g = new T.PlaneGeometry(xb - xa, 150, 40, 4);
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, Math.sin(x * 1.1) * 1.4 + 1.6); }
        g.computeVertexNormals();
        const m = M(g, cmat, (xa + xb) / 2, 75, BOUNDS.minZ - 1.5); K.add(m, { cast: false }); keep.add(m);
        ao((xa + xb) / 2, BOUNDS.minZ + 1.5, (xb - xa) / 2 + 2, 3, 0.4);
      }
      // the patch of moonlight on the floor: window projected along the moon direction
      const d = new T.Vector3(...MOON).normalize();
      const proj = (x, y) => [x - (d.x / d.y) * y, BOUNDS.minZ - (d.z / d.y) * y];
      const P = [proj(WIN.x0, WIN.y0), proj(WIN.x1, WIN.y0), proj(WIN.x1, WIN.y1), proj(WIN.x0, WIN.y1)];
      A.moonPatch = P;
      const pc = label(256, 256, (g) => {
        const gr = g.createRadialGradient(128, 128, 20, 128, 128, 150); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256);
        g.filter = 'blur(6px)'; g.fillStyle = '#fff'; g.fillRect(14, 14, 228, 228); g.fillStyle = '#000'; g.fillRect(122, 10, 12, 236); g.fillRect(10, 122, 236, 10); g.filter = 'none';
      });
      const pg = new T.BufferGeometry();
      const y = 0.4;
      pg.setAttribute('position', new T.Float32BufferAttribute([P[0][0], y, P[0][1], P[1][0], y, P[1][1], P[2][0], y, P[2][1], P[3][0], y, P[3][1]], 3));
      pg.setAttribute('uv', new T.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
      pg.setIndex([0, 2, 1, 0, 3, 2]);
      const pm = new T.Mesh(pg, new T.MeshBasicMaterial({ color: 0x5f7fc0, map: TX.toTexture(pc, { wrap: false }), transparent: true, opacity: 0.4, blending: T.AdditiveBlending, depthWrite: false }));
      pm.renderOrder = 2; K.group.add(pm); keep.add(pm);
      // the shaft itself: four faint sides of the light prism from the window down to the patch
      const sc = label(16, 128, (g) => { const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(255,255,255,0.0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,1)'); g.fillStyle = gr; g.fillRect(0, 0, 16, 128); });
      const smat = new T.MeshBasicMaterial({ color: 0x3a5590, map: TX.toTexture(sc, { wrap: false }), transparent: true, opacity: 0.16, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
      const top = [[WIN.x0, WIN.y0, BOUNDS.minZ], [WIN.x1, WIN.y0, BOUNDS.minZ], [WIN.x1, WIN.y1, BOUNDS.minZ], [WIN.x0, WIN.y1, BOUNDS.minZ]];
      const bot = P.map(([x, z]) => [x, 0.3, z]);
      const pos = [], uv = [], idx = [];
      for (let k = 0; k < 4; k++) {
        const a = top[k], b = top[(k + 1) % 4], c2 = bot[(k + 1) % 4], e = bot[k];
        const o = pos.length / 3;
        pos.push(...a, ...b, ...c2, ...e); uv.push(0, 1, 1, 1, 1, 0, 0, 0); idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
      }
      const shg = new T.BufferGeometry(); shg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); shg.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); shg.setIndex(idx);
      // uv.v runs from the window (0) to the floor (1): flip so the gradient brightens towards the floor
      const shaft = new T.Mesh(shg, smat); shaft.renderOrder = 3; K.group.add(shaft); keep.add(shaft);
      // dust motes drifting in the beam
      const n = lowQ ? 90 : 220;
      const mpos = new Float32Array(n * 3), base = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        const t = r(), u = r(), hy = r.range(1, 45);
        const wx = lerp(WIN.x0, WIN.x1, u), wy = lerp(WIN.y0, WIN.y1, t);
        const x = wx - (d.x / d.y) * (wy - hy), z = BOUNDS.minZ - (d.z / d.y) * (wy - hy);
        base.set([x, hy, z, r() * 100], i * 4); mpos.set([x, hy, z], i * 3);
      }
      const mg = new T.BufferGeometry(); mg.setAttribute('position', new T.BufferAttribute(mpos, 3).setUsage(T.DynamicDrawUsage));
      mg.boundingSphere = new T.Sphere(new T.Vector3(0, 20, -40), 200);
      const dc = label(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(220,230,255,0.45)'); gr.addColorStop(1, 'rgba(200,220,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
      const motes = new T.Points(mg, new T.PointsMaterial({ size: 0.55, map: TX.toTexture(dc, { wrap: false }), color: 0xcfe0ff, transparent: true, opacity: 0.75, depthWrite: false, blending: T.AdditiveBlending }));
      motes.frustumCulled = false; motes.renderOrder = 4; K.group.add(motes); keep.add(motes);
      A.motes = { g: mg, base, n, d };
    }
    // moonbeam bounce: a broad cool light over the patch on the rug
    {
      const ml = new T.PointLight(0x9db8ff, 60, 0, 1.15); ml.position.set(10, 50, -25); K.group.add(ml);
      const dl = new T.PointLight(0xffb070, 70, 0, 1.15); dl.position.set(140, 40, -40); K.group.add(dl);
    }
    // warm light spilling from the hallway door (south-west, off screen): lifts the start area
    {
      const sp = new T.SpotLight(0xffa860, 0.45, 0, 0.42, 0.9, 0);
      sp.position.set(-230, 90, 190); sp.target.position.set(-50, 0, 40); sp.castShadow = false;
      K.group.add(sp, sp.target);
    }

    // ================================================================== GLOW-IN-THE-DARK STARS
    const starGeo = (() => { const s = new T.Shape(); for (let i = 0; i < 10; i++) { const a = PI / 2 + (i / 10) * PI * 2, rr = i % 2 ? 0.45 : 1; const x = Math.cos(a) * rr, y = Math.sin(a) * rr; if (i) s.lineTo(x, y); else s.moveTo(x, y); } s.closePath(); const g = new T.ExtrudeGeometry(s, { depth: 0.18, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 1 }); g.rotateX(-PI / 2); return g; })();
    const glowMat = K.std({ color: 0xe9ffc8, emissive: 0xb8ff7a, emissiveIntensity: 1.25, roughness: 0.6 });
    A.glowMat = glowMat;
    {
      const list = [];
      for (let i = 0; i < 26; i++) {
        let x, z, k = 0;
        do { x = r.range(-150, 150); z = r.range(-64, 94); k++; } while (k < 30 && (!K.offRoad(x, z, 4) || Math.hypot(x - CAT.x, z - CAT.z) < CAT.R + 6 || Math.hypot(x + 26, z + 34) < 14));
        list.push({ x, y: 0.25, z, ry: r() * 6, s: r.range(1.6, 2.6) });
      }
      // stars stuck on the toy chest and the duvet drape
      for (const [x, y, z] of [[70, 12, -72.4], [114, 24, -72.4], [-60, 14, -64.8], [-100, 18, -64.4], [-132, 10, -64.6]]) list.push({ x, y, z, rx: PI / 2, ry: 0, s: 2.2, order: 'XYZ' });
      const im = K.instances(starGeo, glowMat, list, { cast: false });
      keep.add(im);
      for (const it of list) if (it.y < 1) glowDecal(it.x, it.z, it.s * 3.5, it.s * 3.5, 0x9cff6a, 0.16);
    }

    // ================================================================== THE PICTURE-BOOK JUMP OVER THE PRINTED RIVER
    {
      const pa = track.at((S.rampA + S.rampB) / 2), ang = pa.angle;
      const len = S.rampB - S.rampA, hgt = 3.8, base = 0.9, bw = 19;
      K.ramp(pa.x, pa.z, ang, len, 17, hgt, base);
      // the flat first half of the open book (rideable, a little bump)
      const pf = track.at(S.rampA - len / 2);
      K.box(pf.x, pf.z, len / 2, bw / 2, ang, base);
      const pagesC = label(1024, 512, (g) => {
        g.fillStyle = '#fbf6ea'; g.fillRect(0, 0, 1024, 512);
        // left page: night sky with moon over hills; right page: big monster truck leaping
        const sky = g.createLinearGradient(0, 0, 0, 380); sky.addColorStop(0, '#1d2f6b'); sky.addColorStop(1, '#5a7fc9');
        g.fillStyle = sky; g.fillRect(40, 40, 432, 330);
        g.fillStyle = '#fff3c2'; g.beginPath(); g.arc(360, 120, 46, 0, PI * 2); g.fill();
        g.fillStyle = '#2f7d3f'; g.beginPath(); g.moveTo(40, 370); g.quadraticCurveTo(160, 230, 300, 330); g.quadraticCurveTo(400, 260, 472, 300); g.lineTo(472, 370); g.fill();
        for (let i = 0; i < 20; i++) { g.fillStyle = '#fff'; star2d(g, 60 + (i * 53) % 400, 60 + (i * 37) % 160, 4); }
        g.fillStyle = '#2a2a2a'; g.font = '34px Georgia, serif'; g.fillText('Goodnight, little trucks...', 52, 430);
        g.fillStyle = '#ffd34a'; g.fillRect(552, 40, 432, 330);
        g.fillStyle = '#e8443a'; g.beginPath(); g.moveTo(600, 300); g.lineTo(940, 120); g.lineTo(960, 160); g.lineTo(620, 330); g.fill();
        g.fillStyle = '#2a7fd0'; g.fillRect(700, 140, 150, 60); g.fillStyle = '#1b1b1b'; for (const x of [710, 840]) { g.beginPath(); g.arc(x, 220, 34, 0, PI * 2); g.fill(); }
        g.fillStyle = '#2a2a2a'; g.font = 'bold 44px "Lilita One", sans-serif'; g.fillText('JUMP!', 700, 440);
        g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(500, 0, 24, 512);
      });
      const pagesT = TX.toTexture(pagesC, { wrap: false });
      const coverMat = plas(0xc8352c, 0.5, 0.4);
      const paper = matte(0xf4efe0, 0.85);
      const half = (u0, u1) => { const m = K.std({ map: pagesT, roughness: 0.75 }); m.map = pagesT.clone(); m.map.repeat.set(u1 - u0, 1); m.map.offset.set(u0, 0); m.map.needsUpdate = true; return m; };
      // left half lies flat
      const g1 = new T.Group();
      g1.add(M(new T.BoxGeometry(len, 0.3, bw + 0.6), coverMat, 0, 0.15, 0));
      g1.add(M(new T.BoxGeometry(len - 0.4, 0.55, bw - 0.4), paper, 0, 0.55, 0));
      const pg1 = new T.PlaneGeometry(len - 0.4, bw - 0.4); pg1.rotateX(-PI / 2);
      g1.add(M(pg1, half(0, 0.5), 0, 0.84, 0, { ry: PI / 2 + PI / 2 }));
      g1.position.set(pf.x, 0.02 + RUG.y, pf.z); g1.rotation.y = -ang; K.add(g1);
      // right half tilted up on a stack of blocks
      const g2 = new T.Group();
      const inner = new T.Group(); g2.add(inner);
      inner.add(M(new T.BoxGeometry(len, 0.3, bw + 0.6), coverMat, len / 2, -0.75, 0));
      inner.add(M(new T.BoxGeometry(len - 0.4, 0.55, bw - 0.4), paper, len / 2, -0.32, 0));
      const pg2 = new T.PlaneGeometry(len - 0.4, bw - 0.4); pg2.rotateX(-PI / 2);
      inner.add(M(pg2, half(0.5, 1), len / 2, -0.03, 0, { ry: PI }));
      inner.rotation.z = Math.atan2(hgt, len);
      const ps = track.at(S.rampA);
      g2.position.set(ps.x, base + RUG.y, ps.z); g2.rotation.y = -ang; K.add(g2);
      // spine
      K.add(M(cyl(0.7, 0.7, bw + 0.6, 12), coverMat, ps.x, base * 0.7, ps.z, { rx: PI / 2, ry: -ang }));
      // blocks propping the high end
      const pe = track.at(S.rampB - 1.6);
      for (const lat of [-5.5, 0, 5.5]) {
        const q = track.place(S.rampB - 2.2, lat);
        const m = new T.Mesh(blockGeos[(lat + 6) & 7], blockMat); m.position.set(q.x, RUG.y + 2.2, q.z); m.rotation.y = -ang + r.range(-0.1, 0.1); K.add(m);
      }
      ao(pa.x, pa.z, len / 2 + 2, bw / 2 + 1, 0.45, ang);
      // landing: a thick closed board book beyond the river
      const pl = track.at((S.landA + S.landB) / 2);
      const llen = S.landB - S.landA;
      K.box(pl.x, pl.z, llen / 2, 9, pl.angle, 1.1);
      const lb = new T.Group();
      const lc = label(512, 512, (g) => { g.fillStyle = '#3d9a4a'; g.fillRect(0, 0, 512, 512); g.fillStyle = '#ffd34a'; g.beginPath(); g.arc(256, 230, 120, 0, PI * 2); g.fill(); g.fillStyle = '#1d1d1d'; g.font = '70px "Lilita One", sans-serif'; g.textAlign = 'center'; g.fillText('ABC', 256, 250); g.font = '40px Rubik, sans-serif'; g.fillStyle = '#fff'; g.fillText('my first book', 256, 440); });
      const lcm = K.phys({ map: TX.toTexture(lc, { wrap: false }), roughness: 0.4, clearcoat: 0.5 });
      lb.add(M(rbox(llen + 1, 1.1, 18.5, 0.4), paper, 0, 0.55, 0));
      const top = new T.PlaneGeometry(llen + 0.6, 18); top.rotateX(-PI / 2);
      lb.add(M(top, lcm, 0, 1.12, 0, { ry: PI }));
      lb.add(M(new T.BoxGeometry(1.2, 1.15, 18.6), plas(0x2d7a38, 0.4, 0.4), -llen / 2, 0.57, 0));
      lb.position.set(pl.x, RUG.y, pl.z); lb.rotation.y = -pl.angle; K.add(lb);
      ao(pl.x, pl.z, llen / 2 + 1.5, 10.5, 0.4, pl.angle);
    }

    // ================================================================== CRAYONS (crunch!) AND DRAWINGS
    const crayonCols = [0xe8443a, 0x2f86d6, 0xf2c12c, 0x3daa52, 0x8a4fc0, 0xff7a1a, 0x1d1d1d, 0xff6fa8];
    const crayons = [];
    const addCrayon = (x, z, ang, col, collide) => {
      crayons.push({ x, z, ang, col });
      if (collide) { const c = Math.cos(ang) * 4.2, s = Math.sin(ang) * 4.2; K.capsule(x - c, z - s, x + c, z + s, 0.45, 0.9); }
    };
    {
      for (const s0 of S.crayon) {
        const p = track.at(s0);
        for (let k = 0; k < 3; k++) {
          const q = track.place(s0 + k * 4.5 + r.range(-0.6, 0.6), r.range(-3.5, 3.5));
          addCrayon(q.x, q.z, p.angle + PI / 2 + r.range(-0.5, 0.5), crayonCols[(k + s0) % 8], true);
        }
      }
      // a spilled crayon box with a drawing south of Main Street
      const drawing = (x, z, ang, kind) => {
        const c = label(256, 360, (g) => {
          g.fillStyle = '#fbf8f0'; g.fillRect(0, 0, 256, 360);
          const scrib = (col, pts, w = 6) => { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); pts.forEach(([a, b], i) => (i ? g.lineTo(a + r.range(-2, 2), b + r.range(-2, 2)) : g.moveTo(a, b))); g.stroke(); };
          if (kind === 0) { // house, sun and family
            scrib('#e8443a', [[50, 220], [50, 140], [128, 80], [206, 140], [206, 220], [50, 220]]);
            scrib('#2f86d6', [[110, 220], [110, 175], [145, 175], [145, 220]]);
            scrib('#f2c12c', [[200, 50], [230, 50], [230, 75], [200, 75], [200, 50]], 10);
            for (let i = 0; i < 8; i++) { const a = i * PI / 4; scrib('#f2c12c', [[215 + Math.cos(a) * 22, 62 + Math.sin(a) * 22], [215 + Math.cos(a) * 34, 62 + Math.sin(a) * 34]], 4); }
            scrib('#3daa52', [[0, 300], [60, 290], [130, 305], [256, 295]], 10);
            scrib('#1d1d1d', [[60, 330], [60, 280]], 4); scrib('#1d1d1d', [[180, 330], [180, 270]], 4);
          } else if (kind === 1) { // monster truck
            scrib('#e8443a', [[40, 170], [210, 170], [210, 120], [150, 120], [130, 90], [70, 90], [60, 120], [40, 120], [40, 170]], 8);
            g.fillStyle = '#1d1d1d'; for (const x of [75, 180]) { g.beginPath(); g.arc(x, 210, 38, 0, PI * 2); g.fill(); }
            scrib('#f2c12c', [[30, 300], [230, 260]], 8);
            g.fillStyle = '#2f86d6'; g.font = 'bold 40px "Lilita One", sans-serif'; g.fillText('VROOM', 40, 340);
          } else { // the cat
            scrib('#ff7a1a', [[60, 250], [80, 150], [100, 110], [128, 100], [160, 110], [190, 150], [200, 250], [60, 250]], 8);
            scrib('#ff7a1a', [[95, 115], [90, 70], [115, 100]], 6); scrib('#ff7a1a', [[160, 100], [175, 70], [180, 115]], 6);
            scrib('#1d1d1d', [[110, 140], [120, 140]], 6); scrib('#1d1d1d', [[150, 140], [160, 140]], 6);
            scrib('#ff7a1a', [[200, 240], [240, 200], [230, 150]], 7);
            g.fillStyle = '#8a4fc0'; g.font = 'bold 34px "Lilita One", sans-serif'; g.fillText('MITTENS', 50, 320);
          }
        });
        const pg = new T.PlaneGeometry(21, 29.7); pg.rotateX(-PI / 2);
        const m = M(pg, K.std({ map: TX.toTexture(c, { wrap: false }), roughness: 0.9 }), x, 0.06 + gy(x, z) + (kind * 0.01), z, { ry: ang });
        K.add(m, { cast: false }); keep.add(m);
      };
      drawing(-58, 87, 1.35, 1); drawing(-28, 88, 1.75, 0); drawing(28, 90, 1.55, 2);
      for (let i = 0; i < 12; i++) { const x = r.range(-70, 40), z = r.range(76, 96); addCrayon(x, z, r() * 6, crayonCols[i % 8], false); }
      for (let i = 0; i < 10; i++) { let x, z; do { x = r.range(-150, 150); z = r.range(-60, 90); } while (!K.offRoad(x, z, 3)); addCrayon(x, z, r() * 6, crayonCols[(i * 3) % 8], false); }
      // crayon box
      const bc = label(256, 128, (g) => { g.fillStyle = '#f2c12c'; g.fillRect(0, 0, 256, 128); g.fillStyle = '#2f6fc4'; g.fillRect(0, 70, 256, 58); g.fillStyle = '#fff'; g.font = '38px "Lilita One", sans-serif'; g.textAlign = 'center'; g.fillText('CRAYONS', 128, 112); g.fillStyle = '#e8443a'; g.font = '30px "Lilita One", sans-serif'; g.fillText('24 colours', 128, 50); });
      const boxM = K.std({ map: TX.toTexture(bc, { wrap: false }), roughness: 0.7 });
      K.add(M(new T.BoxGeometry(11, 2.6, 7), [boxM, boxM, boxM, boxM, boxM, boxM], -8, 1.3, 84, { ry: 0.3 }));
      ao(-8, 84, 6.5, 4.5, 0.4, -0.3);
      // build the crayon instances: wax body (hex), wrapper, tip
      const body = cyl(0.42, 0.42, 7.2, 6); body.rotateZ(PI / 2);
      const tip = cyl(0.12, 0.42, 1.3, 6); tip.rotateZ(-PI / 2); tip.translate(4.25, 0, 0);
      const wrapG = cyl(0.45, 0.45, 5.2, 6, true); wrapG.rotateZ(PI / 2); wrapG.translate(-0.6, 0, 0);
      const wc = label(64, 64, (g) => { g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#222'; g.fillRect(0, 26, 64, 2); g.fillRect(0, 38, 64, 2); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, 0, 64, 6); g.fillRect(0, 58, 64, 6); });
      const waxM = K.phys({ color: 0xffffff, roughness: 0.55, clearcoat: 0.2 });
      const wrapM = K.std({ map: TX.toTexture(wc), roughness: 0.8, color: 0xffffff });
      const lst = crayons.map((c) => ({ x: c.x, y: gy(c.x, c.z) + 0.42, z: c.z, ry: -c.ang, rx: r() * 3, order: 'YXZ', color: c.col }));
      K.instances(body, waxM, lst, { colors: true, cast: false });
      K.instances(tip, waxM, lst, { colors: true, cast: false });
      K.instances(wrapG, wrapM, lst.map((l) => ({ ...l, color: new T.Color(l.color).lerp(new T.Color(0xffffff), 0.35).getHex() })), { colors: true, cast: false });
      for (const c of crayons) ao(c.x, c.z, 4.6, 0.9, 0.3, c.ang);
    }

    // ================================================================== MICRO CARS TO CRUSH (car park across the road)
    {
      const parts = [];
      const add = (g, col, x, y, z) => { const ng = g.toNonIndexed(); ng.translate(x, y, z); const n = ng.attributes.position.count, ca = new Float32Array(n * 3); const c = new T.Color(col); for (let i = 0; i < n; i++) ca.set([c.r, c.g, c.b], i * 3); ng.setAttribute('color', new T.BufferAttribute(ca, 3)); ng.deleteAttribute('uv'); parts.push(ng); };
      add(rbox(3.2, 0.7, 1.6, 0.25), 0xffffff, 0, 0.6, 0);
      add(rbox(1.7, 0.6, 1.4, 0.25), 0x22282f, -0.2, 1.15, 0);
      for (const [x, z] of [[-1.05, -0.75], [1.05, -0.75], [-1.05, 0.75], [1.05, 0.75]]) { const w = cyl(0.42, 0.42, 0.34, 12); w.rotateX(PI / 2); add(w, 0x151515, x, 0.42, z); }
      const g = K.BufferGeometryUtils.mergeGeometries(parts);
      const mat = K.phys({ vertexColors: true, roughness: 0.25, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 });
      const cols = [0xd8332c, 0x2f86d6, 0xf2c12c, 0x3daa52, 0xffffff, 0x8a4fc0, 0xff7a1a];
      const list = [];
      const p = track.at(S.crush);
      for (let k = 0; k < 6; k++) {
        const lat = -6 + k * 2.4;
        const q = track.place(S.crush + (k % 2) * 1.2, lat);
        list.push({ x: q.x, y: RUG.y, z: q.z, ry: -p.angle + PI / 2 + r.range(-0.15, 0.15), color: cols[k % cols.length] });
      }
      const im = K.instances(g, mat, list, { colors: true });
      keep.add(im);
      A.micro = { im, list: list.map((l) => ({ ...l, crushed: false, col: K.capsule(l.x - Math.cos(p.angle) * 0.1, l.z, l.x, l.z, 1.1, 1.0) })), dirty: false };
      for (const l of list) ao(l.x, l.z, 2, 1.2, 0.3, p.angle + PI / 2);
    }

    // ================================================================== HAZARDS: marbles (slick), slime (sticky), fluffy rug (slow), floor vent (hole)
    {
      // spilled marbles across the x=37 street
      const p = track.at(S.marbles);
      const sp = K.spill(p.x + 1, p.z, 7.5, new T.MeshBasicMaterial({ visible: false }), { lump: 0.3, stretch: 1.6, angle: p.angle + 0.3, y: -1, thick: 0.01 });
      sp.mesh.visible = false;
      K.surface('slick', { poly: sp.poly });
      const mb = [];
      for (let i = 0; i < 70; i++) {
        const a = r() * PI * 2, d = Math.sqrt(r());
        const x = p.x + 1 + Math.cos(a) * d * 8, z = p.z + Math.sin(a) * d * 11;
        mb.push({ x, y: gy(x, z) + 0.8, z, s: 0.8, ry: r() * 6, rx: r() * 6, color: r.pick([0xff5a7a, 0x4ab8ff, 0xffd34a, 0x5ae08a, 0xffffff, 0xb07aff]) });
      }
      K.instances(A.marbleGeo, A.marbleMat, mb, { colors: true });
      for (const m of mb) if (r() < 0.3) ao(m.x, m.z, 1.1, 1.1, 0.3);
      // rolling marbles that come out of the run every now and then (pushable)
      A.marbles = [];
      const mmats = [0xff5a7a, 0x4ab8ff, 0xffd34a, 0x5ae08a].map((c) => K.phys({ color: c, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.5 }));
      for (let i = 0; i < 3; i++) {
        const m = new T.Mesh(A.marbleGeo, mmats[i]); m.scale.setScalar(1.0); m.castShadow = true; K.group.add(m); keep.add(m);
        const hx = MR.exitX + 1 + i * 0.4, hz = MR.exitZ + 1.5 + i * 0.3;
        const d = K.physics.addDynamic({ x: hx, z: hz, r: 1.0, m: 0.25, h: 2, mesh: m, friction: 2.6, baseY: 1.0 + gy(hx, hz) });
        A.marbles.push({ d, next: 2 + i * 3.1 });
      }
    }
    {
      // slime: a tub knocked over, green goo across the north-east corner exit
      const p = track.at(S.slime);
      const slime = K.phys({ color: 0x5fe03a, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity: 0.86, sheen: 0.5, sheenColor: new T.Color(0xc8ff9a) });
      const sl = K.spill(p.x, p.z, 7.8, slime, { lump: 0.45, stretch: 1.4, angle: p.angle + 0.5, y: 0.22, thick: 0.3 });
      K.surface('sticky', { poly: sl.poly });
      const sd = outsideSign(S.slime);
      const q = track.place(S.slime - 5, sd * (W / 2 + 6));
      const tub = new T.Group();
      tub.add(M(K.lathe([[0, 0], [4.2, 0], [4.6, 0.4], [4.8, 6], [4.4, 6], [4.2, 0.8], [0, 0.8]], 32), plas(0x9a4fd0, 0.3, 0.6), 0, 0, 0));
      tub.add(M(K.lathe([[0, 0], [3.4, 0], [3.9, 3]], 24), slime, 0, 0.8, 0));
      tub.rotation.z = PI / 2; tub.position.set(q.x, 4.8, q.z);
      const holder = new T.Group(); holder.add(tub); holder.rotation.y = -Math.atan2(p.z - q.z, p.x - q.x); holder.position.set(0, 0, 0);
      tub.position.set(0, 4.8, 0); holder.position.set(q.x, 0, q.z); K.add(holder);
      K.add(M(K.lathe([[0, 0], [5.0, 0], [5.0, 1.0], [0, 1.0]], 32), plas(0x9a4fd0, 0.3, 0.6), q.x + 7, 0.5, q.z - 6, { rz: 0.15 }));
      K.circle(q.x, q.z, 5, 9, { solid: true });
      ao(q.x, q.z, 6, 5, 0.4);
      K.spill(q.x + (p.x - q.x) * 0.4, q.z + (p.z - q.z) * 0.4, 3, slime, { lump: 0.4, y: 0.2, thick: 0.25 });
    }
    {
      // fluffy round rug (sheepskin-like) under the south-east hump
      const fx = 114, fz = 76, fr = 17;
      const fc = TX.mottledTextures({ size: 256, a: 0xf6f2ea, b: 0xd9d1c4, seed: 71, period: 96, bump: 9, speck: 0.5 });
      const fm = K.phys({ map: fc.map, normalMap: fc.normalMap, normalScale: V2(2.2), roughness: 1, sheen: 1, sheenColor: new T.Color(0xffffff), sheenRoughness: 0.6 });
      fc.map.repeat.set(3, 3); fc.normalMap.repeat.set(3, 3);
      const sh = new T.Shape(); for (let i = 0; i <= 48; i++) { const a = (i / 48) * PI * 2, rr = fr * (1 + 0.06 * Math.sin(a * 5) + 0.04 * Math.sin(a * 9 + 1)); const x = Math.cos(a) * rr, y = Math.sin(a) * rr; if (i) sh.lineTo(x, y); else sh.moveTo(x, y); }
      const g = new T.ExtrudeGeometry(sh, { depth: 0.5, bevelEnabled: true, bevelThickness: 0.4, bevelSize: 1.2, bevelSegments: 3, curveSegments: 6 });
      g.rotateX(-PI / 2);
      const uvA = g.attributes.uv; for (let i = 0; i < uvA.count; i++) uvA.setXY(i, uvA.getX(i) / 20, uvA.getY(i) / 20);
      const m = M(g, fm, fx, 0.05, fz); K.add(m, { cast: false }); keep.add(m);
      // shaggy tufts around the edge
      const tg = new T.ConeGeometry(0.9, 2.2, 6); tg.translate(0, 1.1, 0);
      const tufts = [];
      for (let i = 0; i < 130; i++) { const a = r() * PI * 2, d = fr * (0.92 + r() * 0.2) * Math.sqrt(i < 80 ? 1 : r()); tufts.push({ x: fx + Math.cos(a) * d, y: 0.2, z: fz + Math.sin(a) * d, rx: r.range(-0.6, 0.6), rz: r.range(-0.6, 0.6), ry: r() * 6, s: r.range(0.7, 1.3) }); }
      K.instances(tg, fur(0xf3eee6), tufts, { cast: false });
      K.surface('slow', { x: fx, z: fz, r: fr });
    }
    {
      // open floor vent (cover lying beside it): a hole just off the outside of the west curve
      const sd = outsideSign(S.vent);
      const q = track.place(S.vent, sd * (W / 2 + 6.2));
      const ang = q.angle;
      const metal = K.metal(0xcfd3d8, 0.35);
      const fr = new T.Group();
      for (const [x, z, w, d] of [[0, -4.6, 12, 1], [0, 4.6, 12, 1], [-5.6, 0, 1, 10.2], [5.6, 0, 1, 10.2]]) fr.add(M(rbox(w, 0.5, d, 0.2), metal, x, 0.25, z));
      const dark = new T.PlaneGeometry(11, 8.6); dark.rotateX(-PI / 2);
      fr.add(M(dark, K.std({ color: 0x050505, roughness: 1 }), 0, 0.03, 0));
      const duct = M(new T.BoxGeometry(10.6, 6, 8.2), K.std({ color: 0x1a1c20, roughness: 0.6, metalness: 0.6, side: T.BackSide }), 0, -3, 0);
      fr.add(duct);
      fr.position.set(q.x, 0, q.z); fr.rotation.y = -ang; K.add(fr, { cast: false });
      const cover = new T.Group();
      cover.add(M(rbox(12, 0.4, 9.6, 0.2), metal, 0, 0.2, 0));
      for (let k = -3; k <= 3; k++) cover.add(M(new T.BoxGeometry(10, 0.5, 0.35), K.metal(0x8a8f96, 0.4), 0, 0.42, k * 1.2, { rx: 0.5 }));
      const c2 = track.place(S.vent + 12, sd * (W / 2 + 9));
      cover.position.set(c2.x, 0, c2.z); cover.rotation.y = -ang + 0.4; K.add(cover);
      K.hole(q.x, q.z, 4.4);
      ao(c2.x, c2.z, 7, 5.5, 0.3, ang - 0.4);
    }

    // ================================================================== PUSHABLES: big blocks, a rubber ball, the toppling tower
    {
      const spots = [[180, 1], [252, -1], [372, 1], [612, 1], [742, 1]];
      for (const [s0, sd] of spots) {
        const q = track.place(s0, sd * (W / 2 - 2.5));
        const m = new T.Mesh(bigBlockGeos[(s0 >> 3) % 3], blockMat); m.castShadow = true; m.receiveShadow = true; m.rotation.y = r() * 6;
        K.group.add(m); keep.add(m);
        K.physics.addDynamic({ x: q.x, z: q.z, r: 3.0, m: 1.1, h: 5.4, mesh: m, slide: true, friction: 20, baseY: 2.7 + gy(q.x, q.z) });
      }
      // a big star-print rubber ball in the east loop
      const bc = label(256, 128, (g) => { g.fillStyle = '#2f86d6'; g.fillRect(0, 0, 256, 128); g.fillStyle = '#ffd34a'; g.fillRect(0, 54, 256, 20); for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#e8443a' : '#fff'; star2d(g, 16 + i * 32, 26 + (i % 2) * 76, 11); } });
      const ballM = K.phys({ map: TX.toTexture(bc), roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.25 });
      for (const [x, z] of [[132, 40], [-90, 20]]) {
        const m = new T.Mesh(sph(4.6, 32, 20), ballM); m.castShadow = true; m.receiveShadow = true; K.group.add(m); keep.add(m);
        K.physics.addDynamic({ x, z, r: 4.6, m: 1.0, h: 9.2, mesh: m, friction: 4.5, baseY: 4.6 + gy(x, z) });
      }
      // the toppling tower: the bottom block is pushable, the four above it fall when it moves
      const sd = outsideSign(S.topple);
      const q = track.place(S.topple, sd * (W / 2 + 2.8));
      const size = 4.4;
      A.tower = { x: q.x, z: q.z, blocks: [], fallen: false, t: 0, dir: [0, 0], y0: gy(q.x, q.z) };
      for (let i = 0; i < 5; i++) {
        const m = new T.Mesh(blockGeos[(i * 5 + 1) & 7], blockMat); m.castShadow = true; m.receiveShadow = true;
        const rot = r.range(-0.2, 0.2);
        m.rotation.y = rot; K.group.add(m); keep.add(m);
        const d = K.physics.addDynamic({ x: q.x, z: q.z, r: 2.5, m: i === 0 ? 1.0 : 0.6, h: size, mesh: m, slide: true, friction: 16, baseY: A.tower.y0 + size / 2 + i * size });
        if (i > 0) d.state = 'held';
        A.tower.blocks.push({ d, m, rot, homeY: A.tower.y0 + size / 2 + i * size });
      }
      ao(q.x, q.z, 3.6, 3.6, 0.45);
    }

    // ================================================================== STATIC BLOCK TOWERS, WOODEN TOWN, LANDMARK TOYS
    tower(14, -30, 3, 0.2); tower(19, -26, 1, 0.9); tower(52, -26, 2, 0.6);
    tower(84, -30, 4, 0.1); tower(90, -26, 2, 0.5); tower(-118, -12, 3, 0.3); tower(-48, 46, 1, 0.4);
    tower(146, 88, 2, 0.2); tower(-152, -60, 3, 0.4); tower(60, 86, 1, 0.7);
    // little wooden town houses on the printed blocks
    {
      const wallC = [0xf2e3c6, 0xe8c79a, 0xf4efe2, 0xd9b48a];
      const roofC = [0xc8433a, 0x2f6fc4, 0x3d9a4a, 0xe7742a];
      const prism = gable(6.6, 3.4, 8.2); prism.rotateY(PI / 2);
      for (const [x, z, a] of [[-40, 37, 0.1], [14, 33, -0.2], [62, 28, 0.05], [64, -36, 0.3], [-75, 26, -0.1], [-74, 44, 0.2], [-75, -18, 0]]) {
        const k = Math.abs(Math.round(x + z)) % 4;
        const h = new T.Group();
        h.add(M(rbox(7, 6, 6, 0.3), matte(wallC[k], 0.7), 0, 3, 0));
        h.add(M(prism, matte(roofC[k], 0.55), 0, 6, 0));
        h.add(M(new T.BoxGeometry(1.6, 2.6, 0.2), matte(0x6a3f2a, 0.6), 0, 1.3, 3.05));
        for (const sx of [-2.2, 2.2]) h.add(M(new T.BoxGeometry(1.4, 1.4, 0.2), K.std({ color: 0xffe2a0, emissive: 0xffb860, emissiveIntensity: 0.7 }), sx, 3.6, 3.05));
        place(h, x, RUG.y, z, a);
        ao(x, z, 5, 4.5, 0.4, -a);
        K.box(x, z, 3.6, 3.2, -a, 8, { solid: true });
      }
      // printed-town trees as little wooden trees
      const tg = K.BufferGeometryUtils.mergeGeometries([(() => { const g = cyl(0.35, 0.45, 2.4, 8).toNonIndexed(); g.translate(0, 1.2, 0); const c = new Float32Array(g.attributes.position.count * 3).fill(0); for (let i = 0; i < c.length; i += 3) c.set([0.45, 0.28, 0.14], i); g.setAttribute('color', new T.BufferAttribute(c, 3)); g.deleteAttribute('uv'); return g; })(), (() => { const g = sph(2.2, 12, 8).toNonIndexed(); g.scale(1, 1.25, 1); g.translate(0, 4.4, 0); const c = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < c.length; i += 3) c.set([1, 1, 1], i); g.setAttribute('color', new T.BufferAttribute(c, 3)); g.deleteAttribute('uv'); return g; })()]);
      const trees = [];
      for (const [x, z] of [[-30, 34], [24, 36], [-66, 34], [70, 12], [72, -16], [-90, 46], [-128, 10], [-155, 38], [-10, -10], [-46, -14]]) { if (K.offRoad(x, z, 3.5)) trees.push({ x, y: gy(x, z), z, s: r.range(0.9, 1.25), ry: r() * 6, color: r.pick([0x4f9a3e, 0x6fb54a, 0x3d8a3a]) }); }
      K.instances(tg, K.phys({ vertexColors: true, roughness: 0.55, clearcoat: 0.3 }), trees, { colors: true });
      for (const t of trees) { ao(t.x, t.z, 2.6, 2.6, 0.4); K.circle(t.x, t.z, 1.6, 6, { solid: true }); }
    }

    // ---- teddy bear sitting in the north park, watching the race
    {
      const tx = -26, tz = -34;
      const g = new T.Group();
      const brown = fur(0x9a6438, 0xffd6a8), light = fur(0xd9b58a, 0xfff0d8);
      g.add(M(sph(9, 28, 20), brown, 0, 10, 0, { s: [1, 1.12, 0.92] }));
      g.add(M(sph(6, 24, 16), light, 0, 9, 4.6, { s: [1, 1.15, 0.6] }));
      g.add(M(sph(7.6, 28, 20), brown, 0, 25, 0.5));
      g.add(M(sph(3.3, 20, 14), light, 0, 23.4, 6.6, { s: [1.05, 0.85, 0.85] }));
      g.add(M(sph(1.2, 14, 10), plas(0x2a1a12, 0.2, 1), 0, 24.6, 9.2, { s: [1.2, 0.85, 0.8] }));
      for (const sd of [-1, 1]) {
        g.add(M(sph(0.95, 14, 10), plas(0x0c0c0c, 0.1, 1), sd * 2.7, 27, 6.6));
        g.add(M(sph(3, 18, 12), brown, sd * 5.8, 31.2, -0.5, { s: [1, 1, 0.6] }));
        g.add(M(sph(1.9, 14, 10), light, sd * 5.8, 31.2, 0.9, { s: [1, 1, 0.4] }));
        const arm = M(new T.CapsuleGeometry(2.8, 7, 8, 14), brown, sd * 8.6, 13, 3, { rz: sd * 0.5, rx: -0.6 }); g.add(arm);
        const leg = M(new T.CapsuleGeometry(3.4, 6, 8, 14), brown, sd * 5, 3.4, 6.5, { rx: PI / 2 - 0.15 }); g.add(leg);
        g.add(M(cyl(2.6, 2.6, 0.5, 20), light, sd * 5, 3.6, 11.5, { rx: PI / 2 }));
      }
      // ribbon bow
      const bow = plas(0xd8332c, 0.45, 0.3);
      g.add(M(new T.TorusGeometry(6.9, 0.9, 8, 32), bow, 0, 18.5, 0.3, { rx: PI / 2 }));
      for (const sd of [-1, 1]) g.add(M(new T.ConeGeometry(1.8, 3.6, 12), bow, sd * 2.2, 18.6, 7.4, { rz: sd * PI / 2 }));
      place(g, tx, RUG.y, tz, 0.15);
      ao(tx, tz + 2, 13, 12, 0.5);
      K.circle(tx, tz, 11, 34, { solid: true });
    }
    // ---- the sleeping cat (east, on the floorboards), tail sweeps across the road
    {
      const g = new T.Group();
      const ginger = new T.Color(0xe39042), dark = new T.Color(0x9e4d1a), cream = new T.Color(0xf7e6cc), c = new T.Color();
      const catMat = K.phys({ vertexColors: true, roughness: 0.95, sheen: 1, sheenColor: new T.Color(0xffd0a0), sheenRoughness: 0.5, normalMap: furN.normalMap, normalScale: V2(0.8) });
      // curled body: a fat furry tube coiled from the haunch (east) round through north and west to the chest (south)
      const Rc = 8.4, a0 = 0.35, a1 = 0.35 - PI * 1.62;
      const rad = (t) => 5.9 + 2.0 * Math.sin(PI * Math.min(1, t * 1.25 + 0.15)) - (t > 0.85 ? (t - 0.85) * 6 : 0);
      const NS = 72, NR = 22, pos = [], col = [], idx = [];
      const furCol = (t, ox, oy) => {
        const st = Math.sin(t * PI * 2 * 9 + ox * 0.8) * 0.5 + 0.5;
        c.copy(ginger).lerp(dark, ss(0.55, 0.88, st) * (0.25 + 0.75 * ss(-0.3, 0.7, oy)));
        if (oy < -0.35) c.lerp(cream, 0.6 * ss(-0.35, -0.8, oy));
        return c;
      };
      for (let i = 0; i <= NS; i++) {
        const t = i / NS, a = lerp(a0, a1, t), ca = Math.cos(a), sa = Math.sin(a), rr = rad(t);
        for (let j = 0; j <= NR; j++) {
          const b = (j / NR) * PI * 2, ox = Math.cos(b), oy = Math.sin(b);
          pos.push(ca * (Rc + ox * rr), Math.max(0.05, rr * 0.82 * (1 + oy)), sa * (Rc + ox * rr));
          const cc = furCol(t, ox, oy); col.push(cc.r, cc.g, cc.b);
        }
        if (i < NS) for (let j = 0; j < NR; j++) { const p0 = i * (NR + 1) + j, p1 = p0 + NR + 1; idx.push(p0, p1, p0 + 1, p0 + 1, p1, p1 + 1); }
      }
      const bg = new T.BufferGeometry();
      bg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); bg.setAttribute('color', new T.Float32BufferAttribute(col, 3)); bg.setIndex(idx); bg.computeVertexNormals();
      const body = new T.Mesh(bg, catMat);
      A.catBody = body;
      // haunch cap, the middle of the curl, and the chest
      const cap = (t, sc = 1) => { const a = lerp(a0, a1, t), rr = rad(t) * sc; const sg = sph(rr, 20, 14); const sp = sg.attributes.position, sc2 = new Float32Array(sp.count * 3); for (let i = 0; i < sp.count; i++) { const cc = furCol(t + sp.getX(i) * 0.004, 0, sp.getY(i) / rr); sc2.set([cc.r, cc.g, cc.b], i * 3); } sg.setAttribute('color', new T.BufferAttribute(sc2, 3)); return M(sg, catMat, Math.cos(a) * Rc, rr * 0.82, Math.sin(a) * Rc, { s: [1, 0.82, 1] }); };
      g.add(cap(0, 1.02)); g.add(cap(1, 1.05));
      g.add(M(sph(5.5, 18, 12), fur(0xc97a34, 0xffd0a0), 0, 3.6, 0, { s: [1, 0.75, 1] }));
      // head resting on the curl, facing the room
      const head = new T.Group(); head.position.set(5.6, 8.0, 11.2); head.rotation.set(-0.3, -0.3, 0.12); g.add(head);
      const hg = sph(5.3, 28, 20); { const hp = hg.attributes.position, hc = new Float32Array(hp.count * 3); for (let i = 0; i < hp.count; i++) { const x = hp.getX(i), y = hp.getY(i), z = hp.getZ(i); c.copy(ginger); if (y > 1.2 && z < 3.8 && Math.sin(x * 2.4) > 0.25) c.lerp(dark, 0.75); if (z > 2.5 && y < 0.6) c.lerp(cream, 0.85); hc.set([c.r, c.g, c.b], i * 3); } hg.setAttribute('color', new T.BufferAttribute(hc, 3)); }
      head.add(M(hg, catMat, 0, 0, 0, { s: [1.18, 0.9, 1] }));
      for (const sd of [-1, 1]) {
        head.add(M(sph(2.0, 16, 12), fur(0xf7e6cc), sd * 1.35, -1.5, 4.0, { s: [1, 0.8, 0.9] }));
        const ear = new T.Group(); ear.position.set(sd * 3.4, 3.4, -0.6); ear.rotation.set(-0.15, 0, -sd * 0.42); head.add(ear);
        ear.add(M(new T.ConeGeometry(2.1, 3.8, 4), fur(0xe39042, 0xffd0a0), 0, 1.6, 0, { ry: PI / 4, s: [1, 1, 0.55] }));
        ear.add(M(new T.ConeGeometry(1.35, 2.7, 4), fur(0xf2a8a2), 0, 1.35, 0.42, { ry: PI / 4, s: [1, 1, 0.4] }));
        head.add(M(new T.TorusGeometry(0.95, 0.17, 6, 14, PI * 0.9), plas(0x2a1a10, 0.4, 0.2), sd * 2.15, 0.85, 4.55, { rz: PI + 0.15 }));
        // front paws tucked under the chin
        g.add(M(sph(1.7, 14, 10), fur(0xf7e6cc), 4.6 + sd * 2.6, 1.1, 15.6, { s: [1, 0.65, 1.35] }));
      }
      head.add(M(sph(0.6, 10, 8), plas(0xd8707a, 0.3, 0.6), 0, -0.6, 5.45, { s: [1.2, 0.8, 1] }));
      place(g, CAT.x, 0, CAT.z, 0);
      body.position.set(CAT.x, 0, CAT.z); K.add(body); keep.add(body);
      ao(CAT.x + 1, CAT.z + 2, CAT.R + 3, CAT.R + 2, 0.55);
      K.circle(CAT.x, CAT.z, CAT.R - 1, 13, { solid: true });
      // the tail: base segment + tip segment, both lathed tubes along +x, striped
      const tailGeo = (len, r0, r1, phase) => {
        const pr = [];
        for (let i = 0; i <= 14; i++) { const t = i / 14; let rr = lerp(r0, r1, t); if (t > 0.86 && r1 < 1.6) rr *= Math.sqrt(Math.max(0.02, (1 - t) / 0.14)); pr.push([Math.max(0.02, rr), t * len]); }
        const lg = K.lathe(pr, 14);
        lg.rotateZ(-PI / 2);
        const lp = lg.attributes.position, lc = new Float32Array(lp.count * 3);
        for (let i = 0; i < lp.count; i++) { const st = Math.sin((lp.getX(i) + phase) * 1.15) > 0.35; const cc = st ? dark : ginger; lc.set([cc.r, cc.g, cc.b], i * 3); }
        lg.setAttribute('color', new T.BufferAttribute(lc, 3));
        return lg;
      };
      const tail = new T.Group(); tail.position.set(TAIL.bx, TAIL.r, TAIL.bz);
      const t1 = M(tailGeo(17.5, 2.3, 1.9, 0), catMat, 0, 0, 0); tail.add(t1);
      const tipPivot = new T.Group(); tipPivot.position.set(17.5, 0, 0); tail.add(tipPivot);
      tipPivot.add(M(tailGeo(10.5, 1.9, 1.5, 17.5), catMat, 0, 0, 0));
      K.add(tail); keep.add(tail);
      const tshadow = K.contact(TAIL.bx, TAIL.bz, 15, 2.6, 0.4); keep.add(tshadow);
      A.tail = { g: tail, tip: tipPivot, shadow: tshadow };
      K.mover({ type: 'capsule', r: TAIL.r, h: 4.2 }, (t) => {
        const q = tailPose(t), c2 = Math.cos(q.a), s2 = Math.sin(q.a);
        return { x1: TAIL.bx + c2 * 1.5, z1: TAIL.bz + s2 * 1.5, x2: TAIL.bx + c2 * (TAIL.L - 1.2), z2: TAIL.bz + s2 * (TAIL.L - 1.2) };
      });
      // where the tail crosses the road (for the CPU drivers)
      A.tailS = track.distTo(TAIL.bx + TAIL.L * 0.7, TAIL.bz).s;
    }
    // ---- toy dinosaurs: a long-neck in the east loop, a T-rex in the west infield
    {
      const dino = (x, z, rot, col, kind) => {
        const g = new T.Group(), m = plas(col, 0.32, 0.55), belly = plas(new T.Color(col).lerp(new T.Color(0xfff2c0), 0.4).getHex(), 0.35, 0.5);
        const tubeAlong = (pts, r0, r1, mat) => {
          const curve = new T.CatmullRomCurve3(pts.map((p) => new T.Vector3(...p)));
          const tg = new T.TubeGeometry(curve, 24, 1, 12, false);
          const p = tg.attributes.position, nn = tg.attributes.normal;
          for (let i = 0; i < p.count; i++) { const seg = Math.floor(i / 13) / 24; const rr = lerp(r0, r1, seg); const cp = curve.getPointAt(seg); p.setXYZ(i, cp.x + (p.getX(i) - cp.x) * rr, cp.y + (p.getY(i) - cp.y) * rr, cp.z + (p.getZ(i) - cp.z) * rr); }
          tg.computeVertexNormals();
          return new T.Mesh(tg, mat);
        };
        if (kind === 0) { // long-neck
          g.add(M(sph(1, 28, 18), m, 0, 9, 0, { s: [9, 6, 5.4] }));
          g.add(M(sph(1, 20, 12), belly, 0, 7.4, 0, { s: [7.5, 4.2, 4.6] }));
          g.add(tubeAlong([[6, 10, 0], [10, 15, 0], [12, 22, 0], [14.5, 27, 0]], 3.0, 1.5, m));
          g.add(M(sph(1, 18, 12), m, 15.8, 27.4, 0, { s: [2.8, 1.8, 1.8] }));
          g.add(tubeAlong([[-7, 9, 0], [-13, 7, 0], [-19, 3.5, 2], [-24, 1.2, 5]], 3.0, 0.4, m));
          for (const [lx, lz] of [[5, 3], [5, -3], [-4.5, 3], [-4.5, -3]]) g.add(M(cyl(1.9, 2.1, 7, 14), m, lx, 3.5, lz));
          for (const sd of [-1, 1]) g.add(M(sph(0.45, 10, 8), plas(0x111111, 0.2, 1), 17.3, 28.1, sd * 1.2));
          for (let k = 0; k < 6; k++) g.add(M(new T.ConeGeometry(0.9, 1.8, 6), plas(0xf2b52c, 0.35, 0.5), -6 + k * 2.6, 15.2 - Math.abs(k - 2) * 0.4, 0));
        } else { // T-rex
          g.add(M(sph(1, 28, 18), m, 0, 11, 0, { s: [7.5, 5.5, 4.6], rz: 0.25 }));
          g.add(tubeAlong([[-5, 10, 0], [-11, 8, 0], [-17, 5, 1], [-22, 2.5, 3]], 3.6, 0.5, m));
          g.add(M(rbox(8, 5, 5.2, 1.8), m, 7.5, 17.5, 0, { rz: -0.15 }));
          g.add(M(rbox(6, 1.6, 4.6, 0.7), belly, 8.5, 14.6, 0, { rz: -0.35 }));
          for (let k = 0; k < 6; k++) g.add(M(new T.ConeGeometry(0.28, 0.8, 5), matte(0xfff8e8, 0.4), 6.5 + k * 1.0, 15.6, 2.0, { rx: PI }));
          for (const sd of [-1, 1]) {
            g.add(M(sph(0.6, 10, 8), plas(0x111111, 0.2, 1), 9.0, 19.0, sd * 2.4));
            g.add(M(sph(1, 18, 12), m, -0.5, 7.5, sd * 3.2, { s: [3.4, 4.2, 2.2] }));
            g.add(M(cyl(1.1, 1.3, 6, 10), m, 0.5, 3, sd * 3.2, { rz: -0.2 }));
            g.add(M(rbox(4.2, 1.2, 2.6, 0.5), m, 1.8, 0.6, sd * 3.2));
            g.add(M(new T.CapsuleGeometry(0.5, 2.4, 4, 8), m, 5.5, 12, sd * 2.6, { rz: 1.0 }));
          }
          for (let k = 0; k < 5; k++) g.add(M(new T.ConeGeometry(0.7, 1.5, 5), belly, -6 + k * 2.4, 15.2 - k * 0.6, 0));
        }
        place(g, x, gy(x, z), z, rot);
        ao(x, z, kind === 0 ? 16 : 13, 8, 0.45, -rot);
        K.circle(x, z, 7.5, 20, { solid: true });
        if (kind === 0) K.circle(x + Math.cos(-rot) * -15, z + Math.sin(-rot) * -15, 3, 4, { solid: true });
      };
      dino(84, 34, 2.7, 0x58a84a, 0);
      dino(-98, 4, -0.5, 0xe0612e, 1);
    }
    // ---- spinning top (animated) in the east loop
    {
      const prof = [[0.01, 0], [0.8, 0.5], [3.5, 2.8], [6.2, 4.6], [6.6, 5.2], [6.0, 6.0], [2.4, 7.0], [0.9, 7.4], [0.9, 10.5], [1.2, 11], [0.01, 11.2]];
      const g = K.lathe(prof, 48);
      const p = g.attributes.position, col = new Float32Array(p.count * 3), cs = [new T.Color(0xe8443a), new T.Color(0xf2c12c), new T.Color(0x2f86d6), new T.Color(0xf4f1e8)];
      for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)); const y = p.getY(i); const c = y > 7 ? cs[3] : cs[Math.floor(((a + PI) / (PI * 2)) * 8) % 4]; col.set([c.r, c.g, c.b], i * 3); }
      g.setAttribute('color', new T.BufferAttribute(col, 3));
      const top = new T.Mesh(g, K.phys({ vertexColors: true, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08, metalness: 0.1 }));
      const holder = new T.Group(); holder.add(top); holder.position.set(66, 0, -18);
      K.add(holder); keep.add(holder);
      A.top = { holder, top, x: 66, z: -18 };
      A.topShadow = K.contact(66, -18, 5.5, 5.5, 0.45); keep.add(A.topShadow);
      K.circle(66, -18, 5.5, 8, { solid: true });
    }
    // ---- bunny slippers south of Main Street
    {
      const slipper = (x, z, rot) => {
        const g = new T.Group();
        const pink = fur(0xf2a6c0, 0xffe4ee), white = fur(0xf8f2f0);
        g.add(M(sph(1, 24, 16), pink, 0, 3.4, 0, { s: [12, 4.2, 5.2] }));
        g.add(M(sph(1, 18, 12), K.std({ color: 0x3a1a2a, roughness: 1 }), -4.5, 6.6, 0, { s: [5.5, 0.9, 3.6] }));
        g.add(M(sph(1, 18, 12), white, 8.4, 4.4, 0, { s: [3.6, 3.2, 3.8] }));
        for (const sd of [-1, 1]) {
          g.add(M(new T.CapsuleGeometry(1.3, 6, 6, 10), pink, 7.6, 9, sd * 1.8, { rz: 0.5, rx: sd * 0.4 }));
          g.add(M(sph(0.5, 10, 8), plas(0x111111, 0.2, 1), 11.3, 5.6, sd * 1.4));
        }
        g.add(M(sph(0.6, 10, 8), plas(0xff6f9a, 0.3, 0.5), 12, 4.6, 0));
        place(g, x, 0, z, rot);
        ao(x, z, 13, 6.5, 0.45, -rot);
      };
      slipper(-84, 86, 0.25); slipper(-104, 84, -0.1);
    }

    // ================================================================== THE WOODEN TRAIN SET (west straight)
    {
      // squircle loop, arc-length resampled
      const raw = [];
      for (let i = 0; i < 400; i++) { const t = PI + (i / 400) * PI * 2, c = Math.cos(t), s = Math.sin(t); raw.push([TL.cx + TL.ax * Math.sign(c) * Math.sqrt(Math.abs(c)), TL.cz + TL.az * Math.sign(s) * Math.sqrt(Math.abs(s))]); }
      const cum = [0]; for (let i = 1; i <= raw.length; i++) cum.push(cum[i - 1] + Math.hypot(raw[i % raw.length][0] - raw[i - 1][0], raw[i % raw.length][1] - raw[i - 1][1]));
      const LP = cum[raw.length];
      const at = (d) => { d = ((d % LP) + LP) % LP; let k = 0; while (cum[k + 1] < d) k++; const f = (d - cum[k]) / (cum[k + 1] - cum[k]); const a = raw[k], b = raw[(k + 1) % raw.length]; return { x: lerp(a[0], b[0], f), z: lerp(a[1], b[1], f), angle: Math.atan2(b[1] - a[1], b[0] - a[0]) }; };
      A.loop = { at, LP };
      const totalLen = TRAIN.lens.reduce((a, b) => a + b, 0) + TRAIN.gap * (TRAIN.lens.length - 1);
      const D = LP, { V, acc } = TRAIN, ta = V / acc, da = 0.5 * acc * ta * ta;
      A.tsched = { D, ta, da, tr: 2 * ta + (D - 2 * da) / V };
      A.tsched.P = TRAIN.dwell + A.tsched.tr;
      A.trainLen = totalLen;
      // track: beech strip with two grooves and puzzle joints
      const tc = label(64, 256, (g) => {
        g.fillStyle = '#e2bf8a'; g.fillRect(0, 0, 64, 256);
        for (let i = 0; i < 14; i++) { g.strokeStyle = `rgba(160,110,60,${0.12 + r() * 0.1})`; g.lineWidth = 1 + r() * 2; g.beginPath(); const x = r() * 64; g.moveTo(x, 0); g.lineTo(x + r.range(-4, 4), 256); g.stroke(); }
        g.fillStyle = '#8f6a3e'; g.fillRect(14, 0, 7, 256); g.fillRect(43, 0, 7, 256);
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(14, 0, 2, 256); g.fillRect(43, 0, 2, 256);
        g.fillStyle = '#5e4326'; g.fillRect(0, 252, 64, 4); g.beginPath(); g.arc(32, 246, 7, 0, PI * 2); g.fill();
      });
      const trackMat = K.std({ map: TX.toTexture(tc), roughness: 0.6 });
      const pos = [], uv = [], idx = [];
      const N = 240, hw = 2.1, ht = 0.8;
      for (let i = 0; i <= N; i++) {
        const d = (i / N) * LP, p = at(d), nx = -Math.sin(p.angle), nz = Math.cos(p.angle);
        for (const [o, y, u] of [[-hw - 0.05, 0, 0], [-hw, ht, 0.02], [hw, ht, 0.98], [hw + 0.05, 0, 1]]) { pos.push(p.x + nx * o, y, p.z + nz * o); uv.push(u, d / 10); }
        if (i < N) { const a = i * 4; for (let k = 0; k < 3; k++) idx.push(a + k, a + k + 1, a + k + 4, a + k + 1, a + k + 5, a + k + 4); }
      }
      const tg = new T.BufferGeometry(); tg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); tg.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); tg.setIndex(idx); tg.computeVertexNormals();
      const tm = new T.Mesh(tg, trackMat); tm.receiveShadow = true; tm.castShadow = true; K.group.add(tm); keep.add(tm);
      // crossings with the road: crunchy rails + signals
      A.cross = [];
      let prevIn = false;
      for (let i = 0; i <= 400; i++) {
        const d = (i / 400) * LP, p = at(d), n = track.nearest(p.x, p.z);
        const inRoad = Math.abs(n.lateral) < W / 2 + 0.5 && n.dist < W;
        if (inRoad && !prevIn) {
          // refine to the centreline crossing
          let best = d, bd = 1e9; for (let k = -40; k <= 40; k++) { const q = at(d + k * 0.25), nn = track.nearest(q.x, q.z); if (Math.abs(nn.lateral) < bd) { bd = Math.abs(nn.lateral); best = d + k * 0.25; } }
          const q = at(best), nn = track.nearest(q.x, q.z);
          A.cross.push({ d: best, s: nn.s, x: q.x, z: q.z, angle: q.angle });
        }
        prevIn = inRoad;
      }
      for (const c of A.cross) {
        const a = at(c.d - 9), b = at(c.d + 9);
        K.capsule(a.x, a.z, b.x, b.z, 2.1, 0.8);
      }
      // signal posts (crossbuck + red lamp) on both approaches, outside the road
      const postM = matte(0xf4f1e8, 0.5), redLamp = K.std({ color: 0x400808, emissive: 0xff2a1a, emissiveIntensity: 0 });
      A.lampMat = redLamp;
      for (const c of A.cross) {
        const tp = track.at(c.s);
        for (const sd of [-1, 1]) {
          const q = track.place(c.s - sd * 5.5, sd * (W / 2 + 3.2));
          const g = new T.Group();
          g.add(M(cyl(0.35, 0.4, 9, 10), postM, 0, 4.5, 0));
          for (const rz of [0.7, -0.7]) g.add(M(new T.BoxGeometry(5, 0.7, 0.2), matte(0xd8332c, 0.5), 0, 7.6, 0.3, { rz }));
          g.add(M(new T.BoxGeometry(2.4, 1.1, 0.8), matte(0x1d1d1d, 0.5), 0, 5.4, 0.3));
          for (const lx of [-0.65, 0.65]) g.add(M(sph(0.45, 10, 8), redLamp, lx, 5.4, 0.8));
          place(g, q.x, 0, q.z, -tp.angle + PI / 2 * sd);
          ao(q.x, q.z, 1.4, 1.4, 0.4);
          K.circle(q.x, q.z, 0.6, 9, { solid: true });
        }
      }
      A.crossGlow = A.cross.map((c) => { const m = glowDecal(c.x, c.z, 12, 12, 0xff3020, 0, true); keep.add(m); return m; });
      // station platform at the west end
      const st = at(0);
      K.add(M(rbox(6, 2.4, 22, 0.4), matte(0xd9b48a, 0.6), st.x + 5.6, 1.2, st.z));
      K.add(M(new T.BoxGeometry(6, 0.4, 22), matte(0xc8433a, 0.6), st.x + 5.6, 2.6, st.z));
      const shed = new T.Group();
      shed.add(M(rbox(5, 7, 9, 0.3), matte(0x2f6fc4, 0.55), 0, 3.5, 0));
      shed.add(M(gable(6.4, 3, 10.4), matte(0xd8332c, 0.55), 0, 7, 0));
      place(shed, st.x + 6, 2.8, st.z - 4, 0);
      ao(st.x + 5.6, st.z, 5, 12, 0.45);
      K.box(st.x + 5.6, st.z, 3.2, 11.2, 0, 10, { solid: true });
      // the train: engine + two wagons, painted wood
      const wheelM = plas(0xd8332c, 0.4, 0.4), black = plas(0x1d1d1d, 0.35, 0.4);
      const vehicles = [];
      const trainMat = K.phys({ vertexColors: true, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.35 });
      const mkVehicle = (len, kind) => {
        const g = new T.Group();
        const bodyC = [0x3d9a4a, 0xf2b52c, 0x2f86d6][kind];
        g.add(M(rbox(len - 0.4, 1.6, 3.4, 0.4), matte(0xe8cfa0, 0.55), 0, 1.6, 0));
        for (const wx of [-len * 0.3, len * 0.3]) for (const sd of [-1, 1]) g.add(M(cyl(1.0, 1.0, 0.5, 16), wheelM, wx, 1.1, sd * 1.85, { rx: PI / 2 }));
        if (kind === 0) {
          g.add(M(cyl(1.6, 1.6, len * 0.55, 20), plas(bodyC, 0.4, 0.4), len * 0.12, 3.9, 0, { rz: PI / 2 }));
          g.add(M(rbox(len * 0.36, 4.6, 3.4, 0.4), plas(bodyC, 0.4, 0.4), -len * 0.3, 4.6, 0));
          g.add(M(rbox(len * 0.42, 0.5, 3.8, 0.2), black, -len * 0.3, 7.1, 0));
          g.add(M(cyl(0.8, 0.6, 2.4, 14), black, len * 0.3, 6.2, 0));
          g.add(M(sph(0.7, 12, 8), matte(0xfff6d0, 0.3), len * 0.42, 3.9, 0));
        } else if (kind === 1) {
          for (let k = 0; k < 3; k++) g.add(M(cyl(0.9, 0.9, len - 1.4, 12), matte([0xa0703f, 0x8a5e33, 0xb88450][k], 0.7), 0, 3.4 + (k === 2 ? 1.4 : 0), k === 2 ? 0 : (k ? 0.95 : -0.95), { rz: PI / 2 }));
          for (const sd of [-1, 1]) g.add(M(cyl(0.25, 0.25, 3.6, 8), plas(bodyC, 0.4, 0.4), sd * (len / 2 - 1), 4.2, 0, { rx: PI / 2 }));
        } else {
          g.add(M(rbox(len - 0.8, 3.6, 3.3, 0.5), plas(bodyC, 0.4, 0.4), 0, 4.2, 0));
          g.add(M(rbox(len - 0.4, 0.5, 3.8, 0.2), plas(0xf4f1e8, 0.4, 0.4), 0, 6.2, 0));
          for (const wx of [-2, 0.4, 2.8]) for (const sd of [-1, 1]) g.add(M(new T.BoxGeometry(1.4, 1.3, 0.1), matte(0xfff0b0, 0.3), wx - 0.4, 4.6, sd * 1.67));
        }
        for (const sd of [-1, 1]) g.add(M(cyl(0.45, 0.45, 0.6, 10), black, sd * (len / 2), 1.6, 0, { rz: PI / 2 }));
        const bm = bake(g, trainMat); K.group.add(bm); keep.add(bm);
        return bm;
      };
      TRAIN.lens.forEach((len, i) => vehicles.push(mkVehicle(len, i)));
      A.trainVeh = vehicles;
      A.trainShadows = TRAIN.lens.map((l) => { const s = K.contact(0, 0, l / 2 + 1, 2.8, 0.45); keep.add(s); return s; });
      A.offs = []; { let o = 0; for (const l of TRAIN.lens) { A.offs.push(o); o += l + TRAIN.gap; } }
      TRAIN.lens.forEach((len, i) => {
        K.mover({ type: 'capsule', r: TRAIN.r, h: TRAIN.h }, (t) => {
          const hd = trainHead(t) - A.offs[i];
          const p = at(hd - 1.0), q = at(hd - len + 1.0);
          return { x1: p.x, z1: p.z, x2: q.x, z2: q.z };
        });
      });
      // occupancy table for each crossing over one period (CPU braking)
      const P = A.tsched.P, step = 0.05, n = Math.ceil(P / step);
      for (const c of A.cross) {
        c.occ = new Uint8Array(n);
        for (let k = 0; k < n; k++) {
          const hd = trainHead(A.t0 + k * step);
          const rel = (((c.d - hd + totalLen + 9) % LP) + LP) % LP; // >=0 when the crossing is ahead of the tail
          c.occ[k] = rel <= totalLen + 18 ? 1 : 0;
        }
      }
      A.occStep = step;
      // a few wooden trees by the line
    }

    // ================================================================== SCATTER: small blocks, puzzle pieces, glitter dots, buttons
    {
      const bits = [], pz = [];
      for (let i = 0; i < 120; i++) {
        let x, z, k = 0;
        do { x = r.range(-160, 160); z = r.range(-66, 96); k++; } while (k < 20 && !K.offRoad(x, z, 2.5));
        if (k >= 20) continue;
        if (Math.hypot(x - CAT.x, z - CAT.z) < CAT.R + 2) continue;
        if (i % 3 === 0) pz.push({ x, y: gy(x, z) + 0.25, z, ry: r() * 6, color: r.pick([0xe8443a, 0x2f86d6, 0xf2c12c, 0x3daa52, 0x8a4fc0]) });
        else bits.push({ x, y: gy(x, z) + 0.3, z, ry: r() * 6, rx: r.range(-0.2, 0.2), s: r.range(0.5, 1.1), color: r.pick([0xe8443a, 0x2f86d6, 0xf2c12c, 0x3daa52, 0xf4f1e8, 0xff7a1a]) });
      }
      const brick = (() => { const parts = [rbox(2.4, 0.9, 1.2, 0.12, 1).toNonIndexed()]; for (const sx of [-0.6, 0.6]) { const s = cyl(0.32, 0.32, 0.3, 10).toNonIndexed(); s.translate(sx, 0.6, 0); parts.push(s); } return K.BufferGeometryUtils.mergeGeometries(parts.map((g) => { g.deleteAttribute('uv'); return g; })); })();
      K.instances(brick, plas(0xffffff, 0.3, 0.6), bits, { colors: true, cast: false });
      const puz = (() => { const s = new T.Shape(); s.moveTo(-1.5, -1.5); s.lineTo(-0.4, -1.5); s.absarc(0, -1.5, 0.45, PI, 0, true); s.lineTo(1.5, -1.5); s.lineTo(1.5, -0.4); s.absarc(1.5, 0, 0.45, -PI / 2, PI / 2, false); s.lineTo(1.5, 1.5); s.lineTo(-1.5, 1.5); s.lineTo(-1.5, 0.4); s.absarc(-1.5, 0, 0.45, PI / 2, -PI / 2, true); s.closePath(); const g = new T.ExtrudeGeometry(s, { depth: 0.35, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 1 }); g.rotateX(-PI / 2); return g; })();
      K.instances(puz, plas(0xffffff, 0.5, 0.2), pz, { colors: true, cast: false });
      for (const b of bits) if (r() < 0.4) ao(b.x, b.z, 1.4, 1.0, 0.25);
      // glitter dust near the slime corner and the start (sparkly flecks)
      const gl = [];
      for (let i = 0; i < 160; i++) { const p = track.place(S.slime + r.range(-30, 30), r.range(-W, W)); gl.push({ x: p.x, y: 0.12, z: p.z, ry: r() * 6, s: r.range(0.18, 0.35), color: r.pick([0xff7ad8, 0x9af0ff, 0xfff27a]) }); }
      const gm = K.std({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.35, metalness: 0.9, roughness: 0.2 });
      const gim = K.instances(new T.PlaneGeometry(1, 1).rotateX(-PI / 2), gm, gl, { colors: true, cast: false });
      keep.add(gim);
    }

    // ================================================================== contact-shadow batch, glow batch, merge static meshes
    if (glows.length) {
      const g = new T.PlaneGeometry(1, 1); g.rotateX(-PI / 2);
      const im = K.instances(g, new T.MeshBasicMaterial({ color: 0xffffff, alphaMap: TX.blobShadowTexture(), transparent: true, blending: T.AdditiveBlending, depthWrite: false }), glows, { colors: true, cast: false, receive: false });
      im.renderOrder = 2; keep.add(im);
    }
    {
      const g = new T.PlaneGeometry(1, 1); g.rotateX(-PI / 2);
      const mat = new T.MeshBasicMaterial({ color: 0x07060a, transparent: true, alphaMap: TX.blobShadowTexture(), depthWrite: false });
      mat.onBeforeCompile = (sh) => {
        sh.vertexShader = 'varying float vOp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\nvOp = length(instanceMatrix[1].xyz);\n#endif');
        sh.fragmentShader = 'varying float vOp;\n' + sh.fragmentShader.replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\ndiffuseColor.a *= vOp;');
      };
      for (const c of contacts) c.y = c.y + gy(c.x, c.z);
      const im = K.instances(g, mat, contacts, { cast: false, receive: false });
      im.renderOrder = 1; keep.add(im);
    }
    mergeStatic(K, keep);

  },

  // ------------------------------------------------------------------ fixed-rate gameplay
  tick(dt, time, game) {
    if (!A) return;
    const P = game.physics, cars = game.cars;
    // a new race: the train waits at the station and leaves a moment after GO; toys go back where they were
    if (game.state === 'countdown') {
      if (!A.synced && A.tsched) { A.t0 = time - (TRAIN.dwell - 4.5) + 3.2; A.synced = true; }
      resetToys(cars);
    } else A.synced = false;

    // big wheels: a little hop when a truck rides up onto something it can crunch over
    for (const e of cars) {
      const c = e.car;
      if (c.state !== 'drive') { c._py = undefined; continue; }
      if (c._py !== undefined && !c.airborne && c.y - c._py > 0.45 && c.y < 2) {
        const sp = Math.min(1, c.speed / 40);
        c.airborne = true; c.vy = 6 + 8 * sp;
        if (A.crunch.length < 12) A.crunch.push({ x: c.x, z: c.z, k: sp });
      }
      c._py = c.y;
    }

    // micro cars get flattened by monster wheels
    if (A.micro) for (const m of A.micro.list) {
      if (m.crushed) continue;
      for (const e of cars) {
        const c = e.car;
        if (c.state !== 'drive') continue;
        if ((c.x - m.x) ** 2 + (c.z - m.z) ** 2 < 2.6 * 2.6) { m.crushed = true; m.col.h = 0.4; A.micro.dirty = true; A.crunch.push({ x: m.x, z: m.z, k: 1, car: true }); break; }
      }
    }

    // the toppling tower: when the bottom block is shoved, the four above it come down
    const TW = A.tower;
    if (TW && !TW.fallen) {
      const b = TW.blocks[0].d;
      const mv = Math.hypot(b.x - TW.x, b.z - TW.z);
      if (mv > 0.5) {
        TW.fallen = true; TW.t = time;
        let dx = b.vx, dz = b.vz; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
        TW.dir = [dx, dz];
        TW.blocks.forEach((bl, i) => {
          if (i === 0) return;
          const d = bl.d;
          const reach = 2.2 + i * 3.6;
          d.x = TW.x + dx * reach + (i % 2 ? -1 : 1) * 1.2; d.z = TW.z + dz * reach + (i % 2 ? 1 : -1) * 1.2;
          d.vx = dx * (6 + i * 2.5) + (i % 2 ? -2 : 2); d.vz = dz * (6 + i * 2.5);
          d.state = 'live'; d.baseY = TW.y0 + 2.2;
          bl.fall = { t0: time, sx: TW.x, sz: TW.z, y0: bl.homeY, dur: 0.35 + i * 0.08 };
        });
        A.crunch.push({ x: TW.x, z: TW.z, k: 1, tower: true });
      }
    }

    // marbles roll out of the run now and then
    if (A.marbles) for (const mb of A.marbles) {
      const d = mb.d;
      if (time > mb.next && d.state === 'live') {
        const home = d.home, far = Math.hypot(d.x - home[0], d.z - home[1]);
        const sp = Math.hypot(d.vx, d.vz);
        if (far < 3 && sp < 0.5) {
          const a = Math.atan2(-25 - home[1], 38 - home[0]) + (Math.random() - 0.5) * 0.5; // towards the 37th-street corner
          const v = 13 + Math.random() * 6;
          d.vx = Math.cos(a) * v; d.vz = Math.sin(a) * v;
          mb.next = time + 7 + Math.random() * 5;
        } else if (far > 20 && sp < 0.3 && !game.onScreen(d.x, 1, d.z, 0.1)) {
          d.x = home[0]; d.z = home[1]; d.vx = d.vz = 0; d.pop = 1; mb.next = time + 2 + Math.random() * 3;
        } else mb.next = time + 1;
      }
    }

    // CPU drivers: wait for the train at the crossings and for the cat's tail
    const Lr = game.track.length;
    if (A.cross && A.tsched) {
      const Pp = A.tsched.P, u = (((time - A.t0) % Pp) + Pp) % Pp, n = A.cross[0] ? A.cross[0].occ.length : 0;
      const occ = (c, a, b) => { for (let t = a; t <= b; t += A.occStep) { const k = Math.floor((((u + t) % Pp) + Pp) % Pp / A.occStep) % n; if (c.occ[k]) return true; } return false; };
      for (const e of cars) {
        if (!e.ai || e.out) continue;
        const c = e.car; if (c.state !== 'drive' || c.airborne) continue;
        for (const cr of A.cross) {
          const d = (((cr.s - e.trackS) % Lr) + Lr) % Lr;
          if (d > 60) continue;
          const sp = Math.max(0, c.fwdSpeed);
          const eta = d / Math.max(sp, 8);
          if (!occ(cr, Math.max(0, eta - 0.7), eta + 0.9)) continue;
          const stopD = d - 8.5;
          if (stopD < -1) continue;
          const vmax = Math.sqrt(2 * 80 * Math.max(0, stopD));
          if (sp > vmax) { const k = vmax / Math.max(sp, 0.01); c.vx *= k; c.vz *= k; }
          e.ai.stuckT = 0;
        }
      }
    }
    if (A.tailS != null) {
      for (const e of cars) {
        if (!e.ai || e.out) continue;
        const c = e.car; if (c.state !== 'drive' || c.airborne) continue;
        const d = (((A.tailS - e.trackS) % Lr) + Lr) % Lr;
        if (d > 45 || d < 2) continue;
        const sp = Math.max(0, c.fwdSpeed), eta = d / Math.max(sp, 8);
        let hit = false;
        for (let t = Math.max(0, eta - 0.6); t <= eta + 0.6; t += 0.1) if (tailPose(time + t).a < 0.9) { hit = true; break; }
        if (!hit) continue;
        const vmax = Math.sqrt(2 * 80 * Math.max(0, d - 12));
        if (sp > vmax) { const k = vmax / Math.max(sp, 0.01); c.vx *= k; c.vz *= k; }
        e.ai.stuckT = 0;
      }
    }
  },

  // ------------------------------------------------------------------ per-frame visuals
  animate(time, dt, game) {
    if (!A) return;
    // cat tail + breathing + ear flicks
    if (A.tail) {
      const q = tailPose(time);
      A.tail.g.rotation.y = -q.a;
      A.tail.tip.rotation.y = -Math.sin(time * (q.tw > 0.8 ? 16 : 2.2)) * (0.12 + 0.4 * q.tw);
      A.tail.g.position.y = TAIL.r + (q.tw > 0.8 ? Math.abs(Math.sin(time * 9)) * 0.6 : 0);
      const c2 = Math.cos(q.a), s2 = Math.sin(q.a);
      A.tail.shadow.position.set(TAIL.bx + c2 * TAIL.L * 0.5, 0.04, TAIL.bz + s2 * TAIL.L * 0.5);
      A.tail.shadow.rotation.z = -q.a;
      A.catBody.scale.y = 1 + Math.sin(time * 1.6) * 0.02;
    }
    // train
    if (A.trainVeh) {
      const hd = trainHead(time);
      let near = false;
      A.trainVeh.forEach((g, i) => {
        const len = TRAIN.lens[i];
        const p = A.loop.at(hd - A.offs[i] - len / 2), a = A.loop.at(hd - A.offs[i] - 0.5), b = A.loop.at(hd - A.offs[i] - len + 0.5);
        g.position.set(p.x, 0.8, p.z); g.rotation.y = -Math.atan2(a.z - b.z, a.x - b.x);
        A.trainShadows[i].position.set(p.x, 0.86, p.z); A.trainShadows[i].rotation.z = -Math.atan2(a.z - b.z, a.x - b.x);
      });
      // crossing lamps flash while the train is close
      const Pp = A.tsched.P, u = (((time - A.t0) % Pp) + Pp) % Pp;
      for (const c of A.cross) {
        let on = false;
        for (let t = 0; t < 1.6 && !on; t += 0.2) { const k = Math.floor(((u + t) % Pp) / A.occStep) % c.occ.length; if (c.occ[k]) on = true; }
        if (on) near = true;
      }
      const blink = near && Math.floor(time * 3.2) % 2 === 0;
      A.lampMat.emissiveIntensity = blink ? 3.2 : 0;
      for (const m of A.crossGlow) m.material.opacity = blink ? 0.22 : 0;
      if (near && game.sound && game.sound.ctx && Math.floor(time * 3.2) !== A.lastDing && (game.state === 'race' || game.state === 'countdown')) {
        A.lastDing = Math.floor(time * 3.2);
        const c = A.cross[0];
        if (game.onScreen(c.x, 1, c.z, 0.1)) game.sound.tone(1250, 0.07, { type: 'triangle', vol: 0.05 });
      }
    }
    // spinning top
    if (A.top) {
      A.top.top.rotation.y = time * 22;
      A.top.holder.rotation.x = Math.sin(time * 1.3) * 0.08; A.top.holder.rotation.z = Math.cos(time * 1.3) * 0.08;
    }
    // glow stars breathe a little
    if (A.glowMat) A.glowMat.emissiveIntensity = 1.15 + Math.sin(time * 0.8) * 0.12;
    if (A.nightLight) A.nightLight.intensity = 1500 * (1 + Math.sin(time * 2.3) * 0.015);
    // dust motes drifting in the moonbeam
    if (A.motes) {
      const { g, base, n } = A.motes, p = g.attributes.position.array;
      for (let i = 0; i < n; i++) {
        const ph = base[i * 4 + 3];
        p[i * 3] = base[i * 4] + Math.sin(time * 0.21 + ph) * 2.2;
        p[i * 3 + 1] = base[i * 4 + 1] + Math.sin(time * 0.17 + ph * 1.7) * 1.6;
        p[i * 3 + 2] = base[i * 4 + 2] + Math.cos(time * 0.19 + ph) * 2.2;
      }
      g.attributes.position.needsUpdate = true;
    }
    // crushed micro cars
    if (A.micro && A.micro.dirty) {
      A.micro.dirty = false;
      const im = A.micro.im, m4 = new A.THREE.Matrix4(), q = new A.THREE.Quaternion(), e = new A.THREE.Euler(), p = new A.THREE.Vector3(), s = new A.THREE.Vector3();
      A.micro.list.forEach((l, i) => {
        e.set(l.crushed ? 0.12 : 0, l.ry, l.crushed ? -0.1 : 0, 'YXZ'); q.setFromEuler(e);
        p.set(l.x, l.y, l.z); s.set(l.crushed ? 1.18 : 1, l.crushed ? 0.38 : 1, l.crushed ? 1.25 : 1);
        im.setMatrixAt(i, m4.compose(p, q, s));
      });
      im.instanceMatrix.needsUpdate = true;
    }
    // toppling tower: blend the falling blocks from the stack to where the physics put them
    if (A.tower) for (const bl of A.tower.blocks) {
      if (!bl.fall) continue;
      const f = clamp((time - bl.fall.t0) / bl.fall.dur, 0, 1);
      if (f >= 1) { bl.m.rotation.x = A.tower.dir[1] * PI / 2; bl.m.rotation.z = -A.tower.dir[0] * PI / 2; bl.fall = null; continue; }
      const e2 = f * f;
      const d = bl.d;
      bl.m.position.set(lerp(bl.fall.sx, d.x, f), lerp(bl.fall.y0, d.baseY, e2), lerp(bl.fall.sz, d.z, f));
      bl.m.rotation.x = A.tower.dir[1] * PI / 2 * f; bl.m.rotation.z = -A.tower.dir[0] * PI / 2 * f;
    }
    // crunch effects
    while (A.crunch.length) {
      const c = A.crunch.pop();
      if (!game.particles) continue;
      game.particles.emit(c.x, 0.6, c.z, { color: c.car ? 0xd8d8e0 : 0xf2c86a, n: c.tower ? 10 : 5, size: 0.7, life: 0.45, spread: 7, up: 7, grav: 40, grow: 1, alpha: 0.95 });
      if (game.sound && game.sound.ctx && game.onScreen(c.x, 1, c.z, 0.1) && game.state !== 'attract') {
        const pan = game.panOf ? game.panOf(c.x, c.z) : 0;
        if (game.sound.crunch) game.sound.crunch(c.tower ? 30 : 14 + c.k * 10, pan); else game.sound.clack(16, pan);
      }
    }
  },
};

// ---------------------------------------------------------------------- module helpers
function star2d(g, x, y, rad) {
  g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i / 10) * Math.PI * 2, rr = i % 2 ? rad * 0.45 : rad; const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; if (i) g.lineTo(px, py); else g.moveTo(px, py); }
  g.closePath(); g.fill();
}

function resetToys(cars) {
  // put the toppled tower and the squashed cars back during the countdown (if nobody is parked on them)
  const TW = A.tower;
  const near = (x, z, rr) => cars.some((e) => (e.car.x - x) ** 2 + (e.car.z - z) ** 2 < rr * rr);
  if (TW && TW.fallen && !near(TW.x, TW.z, 22)) {
    TW.fallen = false;
    TW.blocks.forEach((bl, i) => {
      const d = bl.d; d.x = TW.x; d.z = TW.z; d.vx = d.vz = 0; d.baseY = bl.homeY; d.state = i ? 'held' : 'live'; d.y = 0;
      bl.fall = null; bl.m.rotation.set(0, bl.rot, 0);
    });
  }
  if (A.micro && A.micro.list.some((m) => m.crushed) && !near(A.micro.list[2].x, A.micro.list[2].z, 20)) {
    for (const m of A.micro.list) { m.crushed = false; m.col.h = 1.0; }
    A.micro.dirty = true;
  }
}

// Merge static meshes that share a material class into a few big batches (vertex colours carry the colour).
function mergeStatic(K, keep) {
  const T = K.THREE;
  A.THREE = T;
  K.group.updateMatrixWorld(true);
  const isKept = (o) => { for (let p = o; p; p = p.parent) if (keep.has(p)) return true; return false; };
  const cls = {
    metal: K.std({ vertexColors: true, metalness: 1, roughness: 0.3 }),
    plastic: K.phys({ vertexColors: true, roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.2 }),
    matte: K.std({ vertexColors: true, roughness: 0.7 }),
    fur: K.phys({ vertexColors: true, roughness: 0.92, sheen: 1, sheenColor: new T.Color(0xffe8d0), sheenRoughness: 0.45, normalMap: K._furN, normalScale: new T.Vector2(0.9, 0.9) }),
  };
  const plain = (m) => m.isMeshStandardMaterial && !m.map && !m.normalMap && !m.roughnessMap && !m.alphaMap && !m.transparent && !m.emissiveMap && (!m.emissive || m.emissive.getHex() === 0) && !(m.sheen > 0) && m.side === T.FrontSide;
  const classOf = (m) => (m.userData.fur ? 'fur' : m.metalness >= 0.5 ? 'metal' : m.isMeshPhysicalMaterial && m.clearcoat > 0 ? 'plastic' : 'matte');
  const buckets = new Map();
  const v = new T.Vector3();
  K.group.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || isKept(o) || o.renderOrder) return;
    const m = o.material;
    if (m.transparent) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    v.copy(o.geometry.boundingSphere.center).applyMatrix4(o.matrixWorld);
    const cell = Math.floor((v.x + 200) / 135) + ':' + Math.floor((v.z + 120) / 130);
    const c = plain(m) || m.userData.fur ? classOf(m) : null;
    const key = (c || m.uuid) + cell + (o.castShadow ? 'c' : '') + (o.receiveShadow ? 'r' : '');
    if (!buckets.has(key)) buckets.set(key, { c, mat: m, list: [], cast: o.castShadow, receive: o.receiveShadow });
    buckets.get(key).list.push(o);
  });
  const col = new T.Color();
  for (const { c, mat, list, cast, receive } of buckets.values()) {
    if (list.length < 2) continue;
    const geos = [];
    for (const o of list) {
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      if (!g.attributes.normal) g.computeVertexNormals();
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
      if (c) {
        col.copy(o.material.color);
        const n = g.attributes.position.count, ca = new Float32Array(n * 3), src = o.material.vertexColors ? g.attributes.color : null;
        for (let i = 0; i < n; i++) ca.set([col.r * (src ? src.getX(i) : 1), col.g * (src ? src.getY(i) : 1), col.b * (src ? src.getZ(i) : 1)], i * 3);
        if (c === 'fur') { if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(n * 2), 2)); } else if (g.attributes.uv) g.deleteAttribute('uv');
        g.setAttribute('color', new T.BufferAttribute(ca, 3));
      } else {
        if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
        if (g.attributes.color && !mat.vertexColors) g.deleteAttribute('color');
      }
      g.morphAttributes = {};
      geos.push(g);
    }
    const merged = K.BufferGeometryUtils.mergeGeometries(geos, false);
    if (!merged) continue;
    const mesh = new T.Mesh(merged, c ? cls[c] : mat);
    mesh.castShadow = cast; mesh.receiveShadow = receive;
    K.group.add(mesh);
    for (const o of list) o.parent.remove(o);
  }
}

// Shared builders for the Time Machine Cup worlds (dino, castle, pirate, robot): painted toys merged into one
// vertex-coloured mesh each, the table and floor, the road ribbon, edge markers, the start line, blasts.
const PI = Math.PI, TAU = PI * 2;
export const mod = (a, n) => ((a % n) + n) % n;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export function tmTools(K) {
  const T = K.THREE, BU = K.BufferGeometryUtils, TX = K.TX, track = K.track;
  const col = new T.Color(), m4 = new T.Matrix4(), q = new T.Quaternion(), eu = new T.Euler(), v = new T.Vector3(), sc = new T.Vector3();

  // primitive geometries (unit conventions as three.js)
  const G = {
    box: (w, h, d) => new T.BoxGeometry(w, h, d),
    rbox: (w, h, d, r = 0.3) => new K.RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.01, h / 2.01, d / 2.01)),
    cyl: (r1, r2, h, n = 16) => new T.CylinderGeometry(r1, r2, h, n),
    cone: (r, h, n = 12) => new T.ConeGeometry(r, h, n),
    sph: (r, n = 14) => new T.SphereGeometry(r, n, Math.max(6, Math.round(n * 0.6))),
    tor: (R, r, arc = TAU, n = 20) => new T.TorusGeometry(R, r, 7, n, arc),
    cap: (r, len, n = 10) => new T.CapsuleGeometry(r, len, 4, n),
    ico: (r) => new T.DodecahedronGeometry(r, 0),
  };

  // one part of a toy: geometry g, colour, position, {rx, ry, rz, s | sx, sy, sz}
  function P(g, color, x = 0, y = 0, z = 0, o = {}) {
    const geo = g.index ? g.toNonIndexed() : g.clone();
    eu.set(o.rx || 0, o.ry || 0, o.rz || 0, o.order || 'YXZ'); q.setFromEuler(eu);
    v.set(x, y, z); sc.set(o.sx ?? o.s ?? 1, o.sy ?? o.s ?? 1, o.sz ?? o.s ?? 1);
    geo.applyMatrix4(m4.compose(v, q, sc));
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
    const n = geo.attributes.position.count, a = new Float32Array(n * 3);
    col.set(color);
    for (let i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; }
    geo.setAttribute('color', new T.BufferAttribute(a, 3));
    return geo;
  }
  const geoOf = (parts) => BU.mergeGeometries(parts);
  // a toy: its parts merged into one mesh at (x, y, z), turned to heading `angle` (local +x points along it)
  function toy(parts, mat, x = 0, y = 0, z = 0, angle = 0, opts = {}) {
    const m = new T.Mesh(geoOf(parts), mat);
    m.position.set(x, y, z); m.rotation.y = -angle;
    if (opts.scale) m.scale.setScalar(opts.scale);
    return K.add(m, opts);
  }
  // a ramp-shaped wedge: rises to h over len (local +x), drops over lee, wid across
  function wedge(len, h, lee, wid) {
    const s = new T.Shape();
    s.moveTo(-len / 2, 0); s.lineTo(len / 2, h); s.lineTo(len / 2 + lee, 0); s.closePath();
    const g = new T.ExtrudeGeometry(s, { depth: wid, bevelEnabled: false });
    g.translate(0, 0, -wid / 2);
    return g;
  }

  // the table with its floor far below; returns the wood material
  function table({ w, d, wood = [0xb07a45, 0x6e4524, 0xd7a46b], floorA = '#c9b79c', floorB = '#8f5f45', floorY = -76, legs = true, top = -0.02 }) {
    const oak = TX.woodTextures({ size: 512, seed: 4, planks: 4, base: wood[0], dark: wood[1], light: wood[2], ringFreq: 18, gap: 0.004, roughBase: 0.5 });
    for (const t of Object.values(oak)) { t.repeat.set(w / 64, d / 64); t.rotation = PI / 2; t.center.set(0.5, 0.5); }
    const mat = K.std({ map: oak.map, normalMap: oak.normalMap, roughnessMap: oak.roughnessMap, normalScale: new T.Vector2(0.6, 0.6) });
    K.mesh(new T.BoxGeometry(w, 4, d), mat, 0, top - 2, 0, { cast: false });
    const legMat = K.std({ color: wood[1], roughness: 0.6 });
    K.mesh(new T.BoxGeometry(w - 14, 8, d - 14), legMat, 0, top - 8, 0, { cast: false });
    if (legs) for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.mesh(new T.BoxGeometry(8, -floorY - 4, 8), legMat, sx * (w / 2 - 12), (floorY - 4) / 2, sz * (d / 2 - 12), { cast: false });
    const c = TX.makeCanvas(256), g = c.getContext('2d');
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      g.fillStyle = (x + y) % 2 ? floorA : floorB; g.fillRect(x * 64, y * 64, 64, 64);
      g.strokeStyle = 'rgba(40,30,25,0.45)'; g.lineWidth = 2; g.strokeRect(x * 64, y * 64, 64, 64);
    }
    K.mesh(new T.PlaneGeometry(1800, 1800), K.std({ map: TX.toTexture(c, { repeat: [24, 24] }), roughness: 0.7 }), 0, floorY, 0, { rx: -PI / 2, cast: false });
    return mat;
  }

  // road ribbon with a mottled surface; returns the material
  function road({ a, b, seed = 3, y = 0.05, rough = 0.9, period = 10, extra = {}, width = null, bump = 2, cut = null }) {
    const t = TX.mottledTextures({ size: 256, a, b, seed, period, bump });
    for (const x of Object.values(t)) if (x && x.isTexture) { x.wrapS = x.wrapT = T.RepeatWrapping; x.repeat.set(1.5, 1); }
    const mat = K.std({ map: t.map, normalMap: t.normalMap, roughness: rough, normalScale: new T.Vector2(0.5, 0.5), ...extra });
    const mesh = K.ribbon({ mat, y, vScale: 12, width });
    if (cut) cutRibbon(mesh, cut);
    return mat;
  }
  // drop the triangles of a ribbon whose centre lies where cut(x, z) says (a gap the road jumps, or all but a stretch)
  function cutRibbon(mesh, cut) {
    const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry, pos = g.attributes.position, keep = [];
    for (let i = 0; i < pos.count; i += 3) if (!cut((pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3, (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3)) keep.push(i, i + 1, i + 2);
    g.setIndex(keep); mesh.geometry = g;
    return mesh;
  }
  // chequered strip across the road at arc length s
  function startLine(s, y = 0.07, dark = '#1b1b1b', light = '#f7f4ec') {
    const c = TX.makeCanvas(256, 64), g = c.getContext('2d');
    for (let j = 0; j < 4; j++) for (let i = 0; i < 16; i++) { g.fillStyle = (i + j) % 2 ? dark : light; g.fillRect(i * 16, j * 16, 16, 16); }
    const p = track.at(s);
    const m = K.mesh(new T.PlaneGeometry(p.w + 0.5, 3.6), K.std({ map: TX.toTexture(c, { wrap: false }), roughness: 0.8 }), p.x, y, p.z, { cast: false });
    m.rotation.order = 'YXZ'; m.rotation.y = -p.angle + PI / 2; m.rotation.x = -PI / 2;
    return m;
  }
  // instanced markers along both road edges; fn(p, side, i) -> instance or null
  function edges(geo, mat, spacing, extra, fn, opts = {}) {
    const list = [];
    for (const side of [-1, 1]) track.edgePoints(side, spacing, extra).forEach((p, i) => { const t = fn(p, side, i); if (t) list.push(t); });
    return K.instances(geo, mat, list, { colors: true, ...opts });
  }
  // scatter n instances off the road inside a rectangle; fn(x, z) -> instance or null
  function scatter(geo, mat, n, [x0, x1, z0, z1], margin, fn, opts = {}) {
    const list = [];
    for (let i = 0, tries = 0; i < n && tries < n * 12; tries++) {
      const x = K.r.range(x0, x1), z = K.r.range(z0, z1);
      if (!K.offRoad(x, z, margin)) continue;
      const t = fn(x, z);
      if (t) { list.push(t); i++; }
    }
    return list.length ? K.instances(geo, mat, list, { colors: true, ...opts }) : null;
  }
  const sAt = (x, z) => track.nearest(x, z).s;
  return { T, G, P, geoOf, toy, wedge, table, road, cutRibbon, startLine, edges, scatter, sAt, PI, TAU };
}

// shove every car within R of (x, z) outwards and spin it (a stomp, a cannonball, a punch)
export function blast(game, x, z, R, power = 14, { shake = 0.3, stun = 0.3, y = 0, clack = 24 } = {}) {
  for (const e of game.cars) {
    const c = e.car;
    if (e.out || c.state !== 'drive') continue;
    const dx = c.x - x, dz = c.z - z, d = Math.hypot(dx, dz);
    if (d > R || Math.abs(c.y - y) > 3) continue;
    const nx = d > 0.3 ? dx / d : -Math.sin(c.angle), nz = d > 0.3 ? dz / d : Math.cos(c.angle), k = 1 - d / R;
    c.vx += nx * power * (0.5 + 0.5 * k); c.vz += nz * power * (0.5 + 0.5 * k);
    c.w += (c.index % 2 ? 1 : -1) * (1 + 1.6 * k);
    c.stun = Math.max(c.stun, stun);
  }
  if (game.state !== 'attract') {
    if (clack) game.physics.events.push({ type: 'clack', strength: clack, x, z });
    if (shake && game.addShake && game.onScreen(x, y, z, 0.1)) game.addShake(shake);
  }
}
// did the periodic event (period, phase) fire between the previous tick and this one?
export const fired = (prev, time, period, phase) => prev != null && time > prev && time - prev < 0.5 && Math.floor((time - phase) / period) > Math.floor((prev - phase) / period);
export const cueOK = (game) => game.sound && game.state !== 'attract';

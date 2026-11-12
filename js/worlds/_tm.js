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
  // ---------------- painted ground ----------------
  // A canvas covering the rectangle R = { x0, z0, w, d } of the table (north at the top), ppu pixels per unit.
  // paint(g, C) draws on it; C maps world to canvas, strokes soft bands along the track, scatters blobs and text.
  function groundCanvas(R, paint, ppu = 4) {
    const c = TX.makeCanvas(Math.round(R.w * ppu), Math.round(R.d * ppu)), g = c.getContext('2d'), rr = K.rng(R.seed || 31);
    const C = {
      ppu, rr, X: (x) => (x - R.x0) * ppu, Z: (z) => (z - R.z0) * ppu,
      trackPath(off = 0) {
        g.beginPath();
        for (let s = 0; s <= track.length; s += 2) { const q = off ? track.place(s, off) : track.at(s); if (s) g.lineTo(C.X(q.x), C.Z(q.z)); else g.moveTo(C.X(q.x), C.Z(q.z)); }
        g.closePath();
      },
      // a band along the track: `width` units at full strength, fading out over `soft` more on each side
      band(width, soft, color, alpha = 1, steps = 6, off = 0) {
        g.save(); g.lineJoin = g.lineCap = 'round'; g.strokeStyle = color; g.globalAlpha = 1 - Math.pow(1 - alpha, 1 / steps);
        for (let k = 0; k < steps; k++) { g.lineWidth = (width + 2 * soft * (1 - k / Math.max(1, steps - 1))) * ppu; C.trackPath(off); g.stroke(); }
        g.restore();
      },
      // an irregular blob
      blob(x, z, rad, color, alpha = 1, lump = 0.3, stretch = 1, ang = 0) {
        g.save(); g.translate(C.X(x), C.Z(z)); g.rotate(ang); g.scale(stretch, 1); g.globalAlpha = alpha; g.fillStyle = color; g.beginPath();
        const n = 26, ph = rr() * 6.28;
        for (let i = 0; i <= n; i++) { const a = (i / n) * 6.283, q = rad * ppu * (1 + lump * 0.5 * (Math.sin(a * 2 + ph) + Math.sin(a * 3 + ph * 2.3))); if (i) g.lineTo(Math.cos(a) * q, Math.sin(a) * q); else g.moveTo(Math.cos(a) * q, Math.sin(a) * q); }
        g.closePath(); g.fill(); g.restore();
      },
      // n blobs spread over the whole rectangle
      mottle(n, colors, r0, r1, alpha) { for (let i = 0; i < n; i++) C.blob(R.x0 + rr() * R.w, R.z0 + rr() * R.d, r0 + rr() * (r1 - r0), colors[Math.floor(rr() * colors.length)], alpha, 0.4, 1 + rr() * 0.6, rr() * 3.14); },
      // small dots (flowers, pebbles), anywhere or inside a circle
      dots(n, colors, r0, r1, alpha = 1, cx = null, cz = 0, rad = 0) {
        g.save(); g.globalAlpha = alpha;
        for (let i = 0; i < n; i++) {
          let x, z;
          if (cx == null) { x = R.x0 + rr() * R.w; z = R.z0 + rr() * R.d; } else { const a = rr() * 6.28, q = Math.sqrt(rr()) * rad; x = cx + Math.cos(a) * q; z = cz + Math.sin(a) * q; }
          g.fillStyle = colors[Math.floor(rr() * colors.length)]; g.beginPath(); g.arc(C.X(x), C.Z(z), (r0 + rr() * (r1 - r0)) * ppu, 0, 7); g.fill();
        }
        g.restore();
      },
      // a printed label, `size` units high
      text(str, x, z, size, color, { alpha = 0.8, ang = 0, font = '"Lilita One", "Rubik", sans-serif', spacing = 0, weight = '' } = {}) {
        g.save(); g.translate(C.X(x), C.Z(z)); g.rotate(ang); g.globalAlpha = alpha; g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = `${weight} ${Math.round(size * ppu)}px ${font}`; if (spacing && 'letterSpacing' in g) g.letterSpacing = `${spacing * ppu}px`;
        g.fillText(str, 0, 0); g.restore();
      },
      // a line through world points
      line(pts, width, color, alpha = 1, dash = null) {
        g.save(); g.globalAlpha = alpha; g.strokeStyle = color; g.lineWidth = width * ppu; g.lineCap = g.lineJoin = 'round'; if (dash) g.setLineDash(dash.map((v) => v * ppu));
        g.beginPath(); pts.forEach(([x, z], i) => (i ? g.lineTo(C.X(x), C.Z(z)) : g.moveTo(C.X(x), C.Z(z)))); g.stroke(); g.restore();
      },
      rect(x, z, w, d, color, alpha = 1, ang = 0) { g.save(); g.translate(C.X(x), C.Z(z)); g.rotate(ang); g.globalAlpha = alpha; g.fillStyle = color; g.fillRect(-w * ppu / 2, -d * ppu / 2, w * ppu, d * ppu); g.restore(); },
      // a border band just inside the edge, with stitches or chequers
      border(inset, width, color, stitch = null, cheq = null) {
        g.save(); g.strokeStyle = color; g.lineWidth = width * ppu; const o = (inset + width / 2) * ppu;
        g.strokeRect(o, o, c.width - 2 * o, c.height - 2 * o);
        if (stitch) { g.strokeStyle = stitch; g.lineWidth = Math.max(1, 0.35 * ppu); g.setLineDash([1.6 * ppu, 1.4 * ppu]); g.strokeRect(o, o, c.width - 2 * o, c.height - 2 * o); }
        if (cheq) {
          g.fillStyle = cheq; const q = width * ppu, x1 = c.width - inset * ppu - q, z1 = c.height - inset * ppu - q, i0 = inset * ppu;
          for (let x = i0, k = 0; x < x1 + 1; x += q, k++) if (k % 2) { g.fillRect(x, i0, q, q); g.fillRect(x, z1, q, q); }
          for (let z = i0, k = 0; z < z1 + 1; z += q, k++) if (k % 2) { g.fillRect(i0, z, q, q); g.fillRect(x1, z, q, q); }
        }
        g.restore();
      },
    };
    paint(g, C);
    return { canvas: c, g, C, texture: (opts = {}) => TX.toTexture(c, { wrap: false, ...opts }) };
  }
  // texture coordinates from the position on that rectangle, for a mesh lying on it at (cx, cz)
  function groundUV(geo, cx, cz, R) {
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + cx - R.x0) / R.w, 1 - (pos.getZ(i) + cz - R.z0) / R.d);
    return geo;
  }

  // ---------------- signs, bunting, flat decals ----------------
  // a board on two posts, standing at (x, z), facing south and leaning back so the camera reads it
  function signBoard(x, z, text, { w = 24, h = 5, y = 5.5, bg = '#7a5230', fg = '#fff3d6', edge = '#4f3520', post = 0x5e3c22, font = '"Lilita One", sans-serif', glow = 0, sub = '' } = {}) {
    const c = TX.makeCanvas(512, Math.round(512 * h / w)), g = c.getContext('2d'), H = c.height;
    g.fillStyle = bg; g.fillRect(0, 0, 512, H); g.strokeStyle = edge; g.lineWidth = 10; g.strokeRect(5, 5, 502, H - 10);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    let px = Math.round(H * (sub ? 0.5 : 0.62)); g.font = `${px}px ${font}`;
    while (g.measureText(text).width > 460 && px > 10) { px -= 2; g.font = `${px}px ${font}`; }
    g.fillText(text, 256, H * (sub ? 0.4 : 0.54));
    if (sub) { g.font = `${Math.round(H * 0.2)}px ${font}`; g.fillText(sub, 256, H * 0.8); }
    const tx = TX.toTexture(c, { wrap: false });
    const mat = K.std(glow ? { map: tx, emissiveMap: tx, emissive: 0xffffff, emissiveIntensity: glow, roughness: 0.5 } : { map: tx, roughness: 0.8 });
    const m = K.mesh(new T.BoxGeometry(w, h, 0.4), [K.std({ color: post }), K.std({ color: post }), K.std({ color: post }), K.std({ color: post }), mat, K.std({ color: post })], x, y, z, { rx: -0.42 });
    const pm = K.std({ color: post, roughness: 0.8 });
    for (const dx of [-w * 0.36, w * 0.36]) K.mesh(new T.CylinderGeometry(0.4, 0.5, y, 6), pm, x + dx, y / 2, z - 1.2);
    K.box(x, z - 1, w * 0.4, 0.8, 0, y + 2); K.contact(x, z - 0.5, w * 0.5, 1.6, 0.35);
    return m;
  }
  // a line of pennants across the road at arc length s, on two posts
  function bunting(s, colors, { h = 8.5, post = 0xe9dfc6, mat = null, n = 11, lat = null } = {}) {
    const p = track.at(s), half = lat ?? (p.w / 2 + 1.8), parts = [];
    const a = track.place(s, -half), b = track.place(s, half);
    for (const q of [a, b]) { parts.push(P(G.cyl(0.35, 0.5, h + 0.6, 8), post, q.x, (h + 0.6) / 2, q.z), P(G.sph(0.6, 8), colors[0], q.x, h + 0.9, q.z)); K.circle(q.x, q.z, 0.7, h); }
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n, x = a.x + (b.x - a.x) * k, z = a.z + (b.z - a.z) * k, sag = 1.6 * 4 * k * (1 - k);
      parts.push(P(G.cone(0.75, 1.7, 3), colors[i % colors.length], x, h - sag - 0.85, z, { rz: PI, sz: 0.12 })); // pennants face the camera, whichever way the line runs
    }
    parts.push(P(G.cyl(0.07, 0.07, Math.hypot(b.x - a.x, b.z - a.z), 4), 0x3a3a3a, (a.x + b.x) / 2, h - 0.8, (a.z + b.z) / 2, { rz: PI / 2, ry: -p.angle + PI / 2 }));
    return toy(parts, mat || K.plastic(0xffffff, 0.5, { vertexColors: true }));
  }
  // a flat picture lying on the road or the ground: draw(g, w, h) on a canvas, laid along the track at s
  function decal(s, lat, len, wid, draw, { y = 0.1, px = 128, glow = 0, alpha = true, opacity = 1 } = {}) {
    const c = TX.makeCanvas(px, Math.max(16, Math.round(px * len / wid))), g = c.getContext('2d');
    draw(g, c.width, c.height);
    const tx = TX.toTexture(c, { wrap: false }), q = track.place(s, lat);
    const mat = K.std({ map: tx, transparent: alpha, opacity, roughness: 0.8, depthWrite: false, ...(glow ? { emissiveMap: tx, emissive: 0xffffff, emissiveIntensity: glow } : {}) });
    const m = K.mesh(new T.PlaneGeometry(wid, len), mat, q.x, y, q.z, { cast: false });
    m.rotation.order = 'YXZ'; m.rotation.y = -q.angle - PI / 2; m.rotation.x = -PI / 2;
    return m;
  }
  // a flat picture lying at (x, z), w by d units, turned by ang; draw(g, W, H) paints it
  function flat(x, z, w, d, draw, { y = 0.05, ang = 0, px = 256, thick = 0, edge = 0xffffff, glow = 0, rough = 0.8 } = {}) {
    const c = TX.makeCanvas(px, Math.max(16, Math.round(px * d / w))), g = c.getContext('2d');
    draw(g, c.width, c.height);
    const tx = TX.toTexture(c, { wrap: false });
    const top = K.std({ map: tx, roughness: rough, ...(glow ? { emissiveMap: tx, emissive: 0xffffff, emissiveIntensity: glow } : {}) });
    if (thick) { const e = K.std({ color: edge, roughness: 0.8 }); return K.mesh(new T.BoxGeometry(w, thick, d), [e, e, top, e, e, e], x, y + thick / 2, z, { ry: -ang }); }
    return K.mesh(new T.PlaneGeometry(w, d), top, x, y, z, { rx: -PI / 2, rz: -ang, cast: false });
  }
  const sAt = (x, z) => track.nearest(x, z).s;
  return { T, G, P, geoOf, toy, wedge, table, road, cutRibbon, groundCanvas, groundUV, signBoard, bunting, decal, flat, startLine, edges, scatter, sAt, PI, TAU };
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

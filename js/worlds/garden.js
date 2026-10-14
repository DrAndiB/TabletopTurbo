// World 4: the back-garden lawn. A dirt path through mown grass, a plank jump over a puddle,
// a hose bump, a sandpit S-bend, a tulip-bed hairpin and a watering can that spilt into mud.

const TRACK = [
  [-100, 80], [60, 78], [110, 66], [138, 38], [145, 0], [138, -40], [118, -66], [86, -80], [56, -78],
  [38, -58], [30, -20], [24, 8], [12, 26, 15], [-6, 30, 15], [-20, 18, 15], [-25, -10], [-32, -42], [-52, -70],
  [-90, -82], [-128, -74], [-146, -48], [-142, -20], [-122, 2, 15], [-120, 28], [-134, 54], [-124, 76],
];

let A = null; // per-frame animation state (set by build)

export default {
  id: 'garden',
  name: 'Garden Grand Prix',
  blurb: 'Mown lawn, a plank jump over a puddle, a hose bump and a tulip-bed hairpin.',
  vehicle: 'truck',
  seed: 23,
  track: { points: TRACK, width: 14, startS: 40 },
  bounds: { minX: -162, maxX: 160, minZ: -97, maxZ: 97 },
  fallOffEdges: false,
  floorY: -76,
  offCourse: 18,
  offroad: { kind: 'slow', margin: 1 },
  skidColor: 0x3b2a1a,
  dust: {
    normal: { color: 0xcfb084, size: 1.4, life: 0.6, up: 2, grav: 2, alpha: 0.32, grow: 2, rate: 0.6 },
    slow: { color: 0x86a64c, size: 0.45, life: 0.45, up: 5, grav: 35, alpha: 0.95, grow: 1, rate: 1.1 },
    water: { color: 0xe8f4ff, size: 0.9, life: 0.45, up: 7, grav: 45, alpha: 0.85, grow: 1.4, rate: 3 },
    sticky: { color: 0x3a2614, size: 0.75, life: 0.5, up: 5, grav: 45, alpha: 0.95, grow: 1, rate: 2 },
  },
  lighting: {
    sunDir: [-0.6, 1.25, -0.32], sunColor: 0xfff3dc, sunIntensity: 3.1,
    hemiSky: 0xa8d4ff, hemiGround: 0x587a34, hemiIntensity: 0.8,
    envIntensity: 0.45, exposure: 1.0, background: 0x9cc8ea, shadowRadius: 1.5,
  },

  async build(K) {
    const { THREE: T, TX, r, track } = K;
    const Q = (K.quality && K.quality.grass) || 0.7;
    const V2 = (a, b = a) => new T.Vector2(a, b);
    A = { t: 0 };

    // ---------------- helpers ----------------
    // InstancedMeshes bucketed into grid cells so frustum culling skips what is off screen.
    const chunked = (geo, mat, list, opts = {}, cell = 40) => {
      const b = new Map();
      for (const it of list) {
        const k = Math.floor(it.x / cell) + ',' + Math.floor(it.z / cell);
        if (!b.has(k)) b.set(k, []);
        b.get(k).push(it);
      }
      const out = [];
      for (const l of b.values()) out.push(K.instances(geo, mat, l, opts));
      return out;
    };
    // Baker: many small props sharing one material are merged per area into a single mesh with
    // vertex colours (instance colour x geometry colour). One draw call per area instead of one per type.
    const bakeQ = new Map();
    const bake = (geo, mat, list, { cast = true, cell = 90 } = {}) => {
      const key = mat.uuid + (cast ? 'c' : '');
      if (!bakeQ.has(key)) bakeQ.set(key, { mat, cast, cell, items: [] });
      const ng = geo.index ? geo.toNonIndexed() : geo;
      for (const it of list) bakeQ.get(key).items.push({ geo: ng, it });
    };
    const flushBake = () => {
      const m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), pv = new T.Vector3(), sv = new T.Vector3(), nm = new T.Matrix3(), c = new T.Color();
      for (const { mat, cast, cell, items } of bakeQ.values()) {
        const cells = new Map();
        for (const x of items) {
          const k = Math.floor((x.it.x + 200) / cell) + ':' + Math.floor((x.it.z + 200) / cell);
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
              const k = gc ? [gc.getX(i), gc.getY(i), gc.getZ(i)] : [1, 1, 1];
              C[o * 3] = c.r * k[0]; C[o * 3 + 1] = c.g * k[1]; C[o * 3 + 2] = c.b * k[2];
            }
          }
          const g = new T.BufferGeometry();
          g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('normal', new T.BufferAttribute(N, 3));
          g.setAttribute('uv', new T.BufferAttribute(U, 2)); g.setAttribute('color', new T.BufferAttribute(C, 3));
          g.computeBoundingSphere();
          const m = new T.Mesh(g, mat); m.castShadow = cast; m.receiveShadow = true;
          K.group.add(m);
        }
      }
    };
    const vcMat = K.std({ vertexColors: true, roughness: 0.6, side: T.DoubleSide });
    const vcGloss = K.phys({ vertexColors: true, roughness: 0.4, clearcoat: 0.35, clearcoatRoughness: 0.35, side: T.DoubleSide });
    // Distance from the road edge on a 1-unit grid (negative = on the road).
    const G0X = -200, G0Z = -130, GW = 400, GH = 260;
    const roadD = new Float32Array(GW * GH).fill(30);
    for (let i = 0; i < track.N; i += 2) {
      const x = track.x[i], z = track.z[i], hw = track.w[i] / 2, R = hw + 14;
      const x0 = Math.max(0, Math.floor(x - R - G0X)), x1 = Math.min(GW - 1, Math.ceil(x + R - G0X));
      const z0 = Math.max(0, Math.floor(z - R - G0Z)), z1 = Math.min(GH - 1, Math.ceil(z + R - G0Z));
      for (let gz = z0; gz <= z1; gz++) for (let gx = x0; gx <= x1; gx++) {
        const d = Math.hypot(gx + G0X - x, gz + G0Z - z) - hw;
        const k = gz * GW + gx;
        if (d < roadD[k]) roadD[k] = d;
      }
    }
    const edgeDist = (x, z) => {
      const gx = Math.round(x - G0X), gz = Math.round(z - G0Z);
      if (gx < 0 || gz < 0 || gx >= GW || gz >= GH) return 30;
      return roadD[gz * GW + gx];
    };
    // Areas where no lawn grass grows (beds, sandpit, puddles, stones ...): circles and polygons.
    const bare = [];
    const bareCircle = (x, z, rad) => bare.push({ x, z, r: rad, bb: [x - rad, z - rad, x + rad, z + rad] });
    const barePoly = (poly, grow = 0) => {
      let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
      for (const [x, z] of poly) { a = Math.min(a, x); b = Math.min(b, z); c = Math.max(c, x); d = Math.max(d, z); }
      bare.push({ poly, grow, bb: [a - grow, b - grow, c + grow, d + grow] });
    };
    const inPoly = (x, z, poly) => {
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
        if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
      }
      return inside;
    };
    const isBare = (x, z) => {
      for (const b of bare) {
        if (x < b.bb[0] || x > b.bb[2] || z < b.bb[1] || z > b.bb[3]) continue;
        if (b.poly ? inPoly(x, z, b.poly) : (x - b.x) ** 2 + (z - b.z) ** 2 < b.r * b.r) return true;
      }
      return false;
    };
    // Contact shadows: collected and drawn as ONE instanced mesh (opacity rides in the unused y scale).
    const contacts = [];
    const contact = (x, z, rx, rz = rx, opacity = 0.35, angle = 0, y = 0.035) => contacts.push({ x, y: y + 0.01, z, ry: -angle, sx: rx * 2, sy: opacity, sz: rz * 2 });
    const keep = []; // objects that must not be merged (animated)
    // Irregular rounded stone geometry (indexed so the jitter keeps it watertight).
    const rockGeo = (detail, amt, seed, freq = 1) => {
      let g = new T.IcosahedronGeometry(1, detail);
      g.deleteAttribute('normal'); g.deleteAttribute('uv');
      g = K.BufferGeometryUtils.mergeVertices(g);
      const p = g.attributes.position, uv = new Float32Array(p.count * 2);
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const n = Math.sin(x * 5.1 * freq + seed) * Math.sin(y * 4.3 * freq + seed * 2) * Math.sin(z * 4.7 * freq + seed * 3);
        const k = 1 + n * amt + Math.sin(x * 2.1 + z * 1.7 + seed) * amt * 0.5;
        p.setXYZ(i, x * k, y * k, z * k);
        uv[i * 2] = (x + z * 0.6) * 0.22 + seed; uv[i * 2 + 1] = (y + z * 0.35) * 0.22;
      }
      g.setAttribute('uv', new T.BufferAttribute(uv, 2));
      g.computeVertexNormals();
      return g;
    };

    // ---------------- lawn ground ----------------
    {
      const S = 512;
      const nA = TX.noiseField(256, { seed: 3, period: 6, oct: 4 });
      const c = TX.paint(S, S, (x, y, u, v, o) => {
        const t = TX.sampleField(nA, 256, u * 256, v * 256);
        o[0] = 58 + t * 40; o[1] = 92 + t * 52; o[2] = 30 + t * 18;
      });
      const g = c.getContext('2d');
      const cols = ['#4f8a2c', '#6aa33a', '#3d7022', '#86b84a', '#2f5e1c', '#9ec25a', '#5c9632'];
      const rr = K.rng(5);
      g.lineCap = 'round';
      for (let i = 0; i < 5200; i++) {
        const x = rr() * S, y = rr() * S, a = rr() * 6.283, l = 3 + rr() * 8;
        g.strokeStyle = cols[(rr() * cols.length) | 0]; g.globalAlpha = 0.35 + rr() * 0.5;
        g.lineWidth = 0.8 + rr() * 1.3;
        for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
          g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l); g.stroke();
        }
      }
      g.globalAlpha = 1;
      const nrm = TX.normalFromHeight(TX.heightFromCanvasLuma(c), S, S, 3);
      const lawnT = TX.toTexture(c), lawnN = TX.toTexture(nrm, { srgb: false });
      const W = 720, D = 560;
      lawnT.repeat.set(W / 21, D / 21); lawnN.repeat.set(W / 21, D / 21);
      const geo = new T.PlaneGeometry(W, D, 144, 112);
      geo.rotateX(-Math.PI / 2);
      const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
      const nB = TX.noiseField(128, { seed: 9, period: 4, oct: 3 });
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        const n = TX.sampleField(nB, 128, x * 0.35 + 64, z * 0.35 + 64);
        const stripe = 0.5 + 0.5 * Math.cos((z + 6) / 26 * Math.PI);
        let k = 0.86 + n * 0.22 + stripe * 0.1;
        let rC = k * (0.95 + (n - 0.5) * 0.25), gC = k, bC = k * 0.92;
        const ed = edgeDist(x, z);
        if (ed < 4) { const w = 1 - Math.max(0, ed) / 4; rC *= 1 + w * 0.12; bC *= 1 - w * 0.08; gC *= 1 - w * 0.06; }
        col.set([rC, gC, bC], i * 3);
      }
      geo.setAttribute('color', new T.BufferAttribute(col, 3));
      K.mesh(geo, K.std({ map: lawnT, normalMap: lawnN, normalScale: V2(0.9), vertexColors: true, roughness: 0.93 }), 0, 0, 0, { cast: false });
      A.stripe = (z) => 0.5 + 0.5 * Math.cos((z + 6) / 26 * Math.PI);
    }

    // ---------------- dirt path ----------------
    {
      const S = 512, RW = 19.5; // ribbon width ~ road + feather
      const n1 = TX.noiseField(256, { seed: 21, period: 5, oct: 5 });
      const n2 = TX.noiseField(S, { seed: 22, period: 96, oct: 2 });
      const h = new Float32Array(S * S);
      const c = TX.paint(S, S, (x, y, u, v, o) => {
        const a = TX.sampleField(n1, 256, u * 256, v * 256), b = n2[y * S + x];
        const rut = Math.exp(-(((u - 0.37) / 0.045) ** 2)) + Math.exp(-(((u - 0.63) / 0.045) ** 2));
        const e = Math.min(u, 1 - u);
        const feather = 0.1 + (TX.sampleField(n1, 256, (u < 0.5 ? 40 : 160) + v * 0, v * 256) - 0.5) * 0.12;
        const al = Math.max(0, Math.min(1, (e - 0.015) / Math.max(0.02, feather)));
        const k = 0.86 + (a - 0.5) * 0.5 + (b - 0.5) * 0.18 - rut * 0.1;
        let R = 178 * k, Gc = 142 * k, B = 98 * k;
        const grassy = 1 - Math.min(1, e / 0.2);
        R = R * (1 - grassy * 0.35); Gc = Gc * (1 - grassy * 0.12); B = B * (1 - grassy * 0.45);
        o[0] = R; o[1] = Gc; o[2] = B; o[3] = al * al * (3 - 2 * al) * 255;
        h[y * S + x] = a * 0.55 + b * 0.35 - rut * 0.15;
      });
      const g = c.getContext('2d');
      const rr = K.rng(8);
      for (let i = 0; i < 650; i++) {
        const u = 0.16 + rr() * 0.68, y = 8 + rr() * (S - 16), x = u * S;
        const rad = 0.8 + rr() * rr() * 4.2;
        const base = [[150, 140, 128], [190, 176, 150], [120, 104, 88], [210, 204, 192], [160, 120, 90]][(rr() * 5) | 0];
        const gr = g.createRadialGradient(x - rad * 0.35, y - rad * 0.35, 0, x, y, rad);
        gr.addColorStop(0, `rgb(${base[0] * 1.2 | 0},${base[1] * 1.2 | 0},${base[2] * 1.2 | 0})`);
        gr.addColorStop(0.75, `rgb(${base[0]},${base[1]},${base[2]})`);
        gr.addColorStop(1, 'rgba(70,52,36,0.6)');
        g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, rad, rad * (0.7 + rr() * 0.3), rr() * 3, 0, 6.283); g.fill();
        const ir = Math.ceil(rad);
        for (let yy = -ir; yy <= ir; yy++) for (let xx = -ir; xx <= ir; xx++) {
          const d = Math.hypot(xx, yy) / rad;
          if (d < 1) { const k = ((y + yy) | 0) * S + ((x + xx) | 0); if (k >= 0 && k < h.length) h[k] = Math.max(h[k], 0.7 + 0.5 * Math.sqrt(1 - d * d)); }
        }
      }
      const dirtT = TX.toTexture(c), dirtN = TX.toTexture(TX.normalFromHeight(h, S, S, 3.2), { srgb: false });
      const dirtMat = K.std({ map: dirtT, normalMap: dirtN, normalScale: V2(1.1), roughness: 0.96, transparent: true, depthWrite: false });
      K.ribbon({ mat: dirtMat, y: 0.04, vScale: RW, widthFn: (w) => w + 5.5 });
      A.dirtMat = dirtMat;
    }

    // ---------------- pebbles along the edges + grit on the path ----------------
    const stoneMottle = TX.mottledTextures({ size: 128, a: 0xffffff, b: 0xd2d0cc, seed: 61, period: 16, bump: 4, speck: 0.3 });
    const stoneMat = K.std({ color: 0xffffff, roughness: 0.72, normalMap: stoneMottle.normalMap, normalScale: V2(0.8) });
    const pebbleGeo = (() => {
      // 6x4 segment ellipsoid with jittered vertices: ~40 triangles, reads as a pebble at this scale
      let g = new T.SphereGeometry(1, 7, 4);
      g.deleteAttribute('uv'); g.deleteAttribute('normal');
      g = K.BufferGeometryUtils.mergeVertices(g);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const k = 1 + Math.sin(x * 4.1 + 1.3) * Math.sin(z * 3.7 + 0.4) * 0.12 + Math.sin(y * 3 + x * 2) * 0.06;
        p.setXYZ(i, x * k, y * k * (y < 0 ? 0.6 : 1), z * k);
      }
      g.computeVertexNormals();
      return g;
    })();
    const gritGeo = new T.IcosahedronGeometry(1, 0);
    const pebbleCols = [0x9c958b, 0xb5ab9c, 0xd9d3c7, 0x8a8178, 0xc4b49c, 0x7d756d, 0xe8e4dc, 0xa58f78];
    const skipEdge = []; // [s0, s1, side] ranges without edge stones

    const B = { minX: -162, maxX: 160, minZ: -97, maxZ: 97 };

    // ---------------- south: brick mowing strip + sandstone patio ----------------
    {
      const bt = TX.mottledTextures({ size: 256, a: 0xb05238, b: 0x9a4430, c: 0xc0704e, seed: 71, period: 5, bump: 1.6, speck: 0.12, roughness: [0.75, 0.95], pebbles: 60, pebbleColor: 0x7a3424 });
      const brickMat = K.std({ map: bt.map, normalMap: bt.normalMap, roughnessMap: bt.roughnessMap, normalScale: V2(1) });
      A.brickMat = brickMat;
      const list = [];
      // south edge: bricks on edge, end to end
      for (let x = -200; x < B.maxX + 4; x += 22) list.push({ x: x + r.range(-0.1, 0.1), y: 0.1, z: B.maxZ + 3.6, ry: r.range(-0.015, 0.015), color: r.pick([0xffffff, 0xf0d8cc, 0xe8c2b0, 0xffeee0]), geo: 1 });
      contact(0, B.maxZ + 0.6, 200, 2.4, 0.4);
      // east edge: bricks on edge, end to end
      const eGeo = new K.RoundedBoxGeometry(21.5, 10.2, 6.5, 1, 0.35);
      for (let z = B.minZ - 6; z < B.maxZ + 1; z += 22) list.push({ x: B.maxX + 3.6, y: 0.1, z, ry: Math.PI / 2 + r.range(-0.015, 0.015), sx: 1, sy: 1, sz: 1, color: r.pick([0xffffff, 0xf0d8cc, 0xe8c2b0]), geo: 1 });
      K.instances(eGeo, brickMat, list.filter((b) => b.geo), { colors: true });
      contact(B.maxX + 0.6, 0, 2.4, 110, 0.4);
      // sandstone patio slabs beyond the bricks
      const st = TX.mottledTextures({ size: 256, a: 0xd9c7a4, b: 0xbfa781, c: 0xe8dcc4, seed: 73, period: 6, bump: 2.5, speck: 0.25 });
      const slabMat = K.std({ map: st.map, normalMap: st.normalMap, roughness: 0.9 });
      const slabs = [];
      for (let row = 0; row < 3; row++) {
        let x = -200 + row * 23;
        while (x < 200) {
          const w = r.pick([30, 45, 60]) - 1;
          slabs.push({ x: x + w / 2, y: 0.55, z: B.maxZ + 11 + row * 30 + 14.5, sx: w / 10, sy: 1, sz: 2.9, color: r.pick([0xffffff, 0xf2eadc, 0xe6dccb, 0xfff6e6]) });
          x += w + 1;
        }
      }
      K.instances(new K.RoundedBoxGeometry(10, 1.1, 10, 1, 0.12), slabMat, slabs, { colors: true, cast: false });
      K.mesh(new T.PlaneGeometry(420, 100), K.std({ color: 0x6d6250, roughness: 1 }), 0, 0.02, B.maxZ + 55, { rx: -Math.PI / 2, cast: false });
    }

    // ---------------- north: white picket edging, bushes behind ----------------
    {
      const sh = new T.Shape();
      sh.moveTo(-0.85, 0); sh.lineTo(0.85, 0); sh.lineTo(0.85, 12); sh.lineTo(0, 13.6); sh.lineTo(-0.85, 12); sh.closePath();
      const pg = new T.ExtrudeGeometry(sh, { depth: 0.6, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 1 });
      pg.translate(0, 0, -0.3);
      const wt = TX.woodTextures({ size: 256, seed: 12, planks: 1, base: 0xece6da, dark: 0xc9c0ae, light: 0xf8f4ec, ringFreq: 30, gap: 0.0, roughBase: 0.7 });
      const paint = K.std({ map: wt.map, normalMap: wt.normalMap, normalScale: V2(0.5), roughness: 0.75 });
      const pickets = [];
      const zf = B.minZ - 2.5;
      for (let x = B.minX - 20; x < B.maxX + 20; x += 3.1) pickets.push({ x, y: -0.6, z: zf, rz: r.range(-0.03, 0.03), ry: r.range(-0.04, 0.04), color: r.pick([0xffffff, 0xf4f0e8, 0xe8e2d6]) });
      K.instances(pg, paint, pickets, { colors: true });
      const railGeo = new K.RoundedBoxGeometry(B.maxX - B.minX + 40, 1.4, 0.7, 1, 0.2);
      K.mesh(railGeo, paint, (B.minX + B.maxX) / 2, 3.6, zf - 0.75);
      K.mesh(railGeo, paint, (B.minX + B.maxX) / 2, 9.6, zf - 0.75);
      // soil border + shrubs behind the fence
      const soil = TX.mottledTextures({ size: 256, a: 0x4a3524, b: 0x2e2016, c: 0x5c4532, seed: 81, period: 10, bump: 4, speck: 0.4 });
      A.soil = soil;
      const soilMat = K.std({ map: soil.map, normalMap: soil.normalMap, roughness: 1 });
      A.soilMat = soilMat;
      K.mesh(new T.PlaneGeometry(420, 60), soilMat, 0, 0.03, B.minZ - 33, { rx: -Math.PI / 2, cast: false });
      soil.map.repeat.set(16, 2.4); soil.normalMap.repeat.set(16, 2.4);
    }

    // ---------------- west: a clipped box hedge; east: gravel strip ----------------
    {
      const lt = TX.mottledTextures({ size: 256, a: 0x2f5e22, b: 0x1d3f16, c: 0x5d8a34, seed: 91, period: 32, bump: 6, speck: 0.6 });
      lt.map.repeat.set(1, 1); lt.normalMap.repeat.set(1, 1);
      const leafy = K.std({ map: lt.map, normalMap: lt.normalMap, normalScale: V2(1.6), roughness: 0.85 });
      A.leafy = leafy;
      const hedge = new K.RoundedBoxGeometry(18, 24, 260, 6, 4);
      const p = hedge.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const n = Math.sin(z * 0.9) * Math.sin(y * 1.1 + x) * 0.35 + Math.sin(z * 0.23 + y * 0.31) * 0.6;
        p.setXYZ(i, x + (x > 0 ? n : -n) * 0.6, y + (y > 0 ? n * 0.5 : 0), z);
      }
      hedge.computeVertexNormals();
      const huv = hedge.attributes.uv;
      for (let i = 0; i < p.count; i++) huv.setXY(i, p.getZ(i) / 10, (p.getX(i) + p.getY(i)) / 10);
      K.mesh(hedge, leafy, B.minX - 10, 11, 0);
      contact(B.minX - 1, 0, 3, 130, 0.5);
      const gr = TX.mottledTextures({ size: 256, a: 0xbab2a4, b: 0xa69e90, c: 0xcac2b4, seed: 93, period: 8, bump: 3, speck: 0.15, pebbles: 260, pebbleColor: 0xb0a898 });
      gr.map.repeat.set(4, 20); gr.normalMap.repeat.set(4, 20);
      K.mesh(new T.PlaneGeometry(50, 260), K.std({ map: gr.map, normalMap: gr.normalMap, roughness: 0.95 }), B.maxX + 35, 0.05, 0, { rx: -Math.PI / 2, cast: false });
    }

    // ---------------- start line: white pebbles across the path + little flags ----------------
    {
      const s0 = 40;
      const line = [];
      for (let o = -7.6; o <= 7.6; o += 0.95) {
        const p = track.place(s0 + r.range(-0.2, 0.2), o);
        const s = r.range(0.45, 0.62);
        line.push({ x: p.x, y: s * 0.32, z: p.z, ry: r() * 6.3, sx: s * 1.15, sy: s * 0.7, sz: s, color: r.pick([0xffffff, 0xf6f3ec, 0xeeeae2]) });
      }
      K.instances(pebbleGeo, K.std({ color: 0xffffff, roughness: 0.5, normalMap: stoneMottle.normalMap }), line, { colors: true });
      const flagT = TX.labelTexture(64, 64, (g) => { for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? '#1c1c1c' : '#fafafa'; g.fillRect(x * 16, y * 16, 16, 16); } });
      const flagMat = K.std({ map: flagT, roughness: 0.8, side: T.DoubleSide });
      const twig = K.std({ color: 0x7a5a3a, roughness: 0.9 });
      for (const side of [-1, 1]) {
        const p = track.place(s0, side * 9.6);
        K.mesh(new T.CylinderGeometry(0.16, 0.22, 9, 6), twig, p.x, 4.5, p.z);
        const f = K.mesh(new T.PlaneGeometry(3.6, 2.4, 6, 1), flagMat, p.x + 1.8, 7.6, p.z, { ry: 0.25 * side });
        const fp = f.geometry.attributes.position;
        for (let i = 0; i < fp.count; i++) fp.setZ(i, Math.sin((fp.getX(i) + 1.8) * 1.4) * 0.35);
        f.geometry.computeVertexNormals();
        contact(p.x, p.z, 1, 1, 0.4);
      }
    }

    // ---------------- stepping stones from the patio across the path ----------------
    const stepMat = (() => {
      const t = TX.mottledTextures({ size: 256, a: 0xc4bcae, b: 0xa69c8c, c: 0xd8d0c0, seed: 101, period: 4, bump: 2, speck: 0.18 });
      return K.std({ map: t.map, normalMap: t.normalMap, normalScale: V2(1.2), roughness: 0.88 });
    })();
    {
      const pts = [[-17, 103], [-19, 90], [-21, 77], [-28, 65], [-37, 55], [-48, 47], [-60, 41], [-72, 37]];
      for (const [x, z] of pts) {
        const rad = r.range(4.2, 5.2);
        const onRoad = !K.offRoad(x, z, 1.5);
        const st = K.spill(x, z, rad, stepMat, { lump: 0.22, y: onRoad ? 0.32 : 0.55, thick: onRoad ? 0.3 : 0.55, n: 26 });
        st.mesh.castShadow = !onRoad;
        bareCircle(x, z, rad + 0.6);
      }
    }

    // ---------------- shared materials ----------------
    const waterN = (() => {
      const S = 256, f = TX.noiseField(S, { seed: 111, period: 8, oct: 3 });
      const t = TX.toTexture(TX.normalFromHeight(f, S, S, 2.2), { srgb: false });
      return t;
    })();
    const skyEnv = (() => {
      const c = TX.makeCanvas(512, 256), g = c.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 0, 128);
      gr.addColorStop(0, '#3f86d8'); gr.addColorStop(0.7, '#8cc0ee'); gr.addColorStop(1, '#d6ecfa');
      g.fillStyle = gr; g.fillRect(0, 0, 512, 128);
      const rr = K.rng(3);
      for (let i = 0; i < 26; i++) {
        const x = rr() * 512, y = 20 + rr() * 90, w = 20 + rr() * 50;
        for (let k = 0; k < 6; k++) { g.fillStyle = `rgba(255,255,255,${0.25 + rr() * 0.35})`; g.beginPath(); g.ellipse(x + rr() * w, y + rr() * 8, w * 0.4, w * 0.16, 0, 0, 6.3); g.fill(); }
      }
      g.fillStyle = '#4c7a34'; g.fillRect(0, 128, 512, 128);
      g.fillStyle = '#2f5a24'; for (let x = 0; x < 512; x += 6) g.fillRect(x, 112 + Math.sin(x * 0.05) * 6 + rr() * 6, 7, 30);
      const t = TX.toTexture(c, { wrap: false });
      t.mapping = T.EquirectangularReflectionMapping;
      return t;
    })();
    const waterMat = K.phys({ color: 0x9fb4bc, roughness: 0.03, metalness: 0.75, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, opacity: 0.9, normalMap: waterN, normalScale: V2(0.12), envMap: skyEnv, envMapIntensity: 1.25 });
    waterN.repeat.set(0.25, 0.25);
    A.waterN = waterN;
    const wetMud = (() => {
      const t = TX.mottledTextures({ size: 256, a: 0x553c26, b: 0x3a2818, c: 0x6a5034, seed: 121, period: 5, bump: 1.6, speck: 0.12 });
      t.map.repeat.set(0.6, 0.6); t.normalMap.repeat.set(0.6, 0.6);
      return K.phys({ map: t.map, normalMap: t.normalMap, normalScale: V2(0.6), roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2 });
    })();
    const terracotta = (() => {
      const t = TX.mottledTextures({ size: 256, a: 0xc4683e, b: 0xa65232, c: 0xd99a72, seed: 131, period: 10, bump: 2, speck: 0.3 });
      return K.std({ map: t.map, normalMap: t.normalMap, normalScale: V2(0.7), roughness: 0.88 });
    })();
    const brass = K.metal(0xc9a24a, 0.3);
    const hoseMat = K.phys({ color: 0x2f9a3a, roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.3 });
    const plankWood = TX.woodTextures({ size: 512, seed: 141, planks: 1, base: 0x9a8264, dark: 0x6a5640, light: 0xb8a284, ringFreq: 12, gap: 0, roughBase: 0.75, grainContrast: 1.4 });

    // ---------------- the jump: plank on a brick over a puddle ----------------
    {
      const sR = 117, len = 13, hgt = 4.0, off = -2.6, wid = 9;
      const p = track.place(sR, off);
      const ang = p.angle;
      K.ramp(p.x, p.z, ang, len, wid, hgt, 0);
      const grp = new T.Group();
      for (const t of Object.values(plankWood)) { t.rotation = Math.PI / 2; t.center.set(0.5, 0.5); t.repeat.set(1, 0.6); }
      const plankMat = K.std({ map: plankWood.map, normalMap: plankWood.normalMap, roughnessMap: plankWood.roughnessMap });
      const L = Math.hypot(len, hgt) + 1.2;
      const plank = new T.Mesh(new K.RoundedBoxGeometry(L, 0.8, wid + 0.4, 2, 0.2), plankMat);
      plank.position.y = -0.4;
      grp.add(plank);
      // a couple of nails and a dark knot
      for (const [a, b] of [[L / 2 - 1.2, -3.2], [L / 2 - 1.2, 3.2], [-L / 2 + 1, -3], [-L / 2 + 1, 3.1]]) {
        const n = new T.Mesh(new T.CylinderGeometry(0.22, 0.22, 0.1, 8), K.metal(0x6a6560, 0.5));
        n.position.set(a, 0.02, b); grp.add(n);
      }
      grp.position.set(p.x, hgt / 2, p.z);
      grp.rotation.order = 'YZX';
      grp.rotation.y = -ang;
      grp.rotation.z = Math.atan2(hgt, len);
      K.add(grp);
      // the brick holding up the far end
      const bx = p.x + Math.cos(ang) * (len / 2 - 2.6), bz = p.z + Math.sin(ang) * (len / 2 - 2.6);
      K.mesh(new K.RoundedBoxGeometry(6.4, hgt - 0.6, 10.5, 2, 0.3), A.brickMat, bx, (hgt - 0.6) / 2, bz, { ry: -ang + 0.06 });
      contact(p.x, p.z, 8, 6, 0.35, ang);
      contact(bx, bz, 4.5, 6.5, 0.45, ang);
      // puddle beyond, across the whole path (the jump clears it, the bypass gets wet)
      const mp = track.place(sR + 16, 0);
      const rim = K.spill(mp.x, mp.z, 8.6, wetMud, { lump: 0.25, stretch: 1.3, angle: mp.angle + Math.PI / 2, y: 0.07, thick: 0.08 });
      const pud = K.spill(mp.x, mp.z, 7.2, waterMat, { lump: 0.28, stretch: 1.3, angle: mp.angle + Math.PI / 2, y: 0.12, thick: 0.06 });
      K.surface('water', { poly: pud.poly });
      barePoly(rim.poly);
      skipEdge.push([sR + 6, sR + 27, 0]);
      A.splash = { x: mp.x, z: mp.z };
    }

    // ---------------- second puddle on the outside of the NW corner ----------------
    {
      const mp = track.place(690, 3.5);
      const rim = K.spill(mp.x, mp.z, 7.4, wetMud, { lump: 0.35, stretch: 1.3, angle: mp.angle + 0.2, y: 0.07, thick: 0.08 });
      const pud = K.spill(mp.x, mp.z, 6.0, waterMat, { lump: 0.38, stretch: 1.3, angle: mp.angle + 0.2, y: 0.12, thick: 0.06 });
      K.surface('water', { poly: pud.poly });
      barePoly(rim.poly);
      skipEdge.push([680, 702, 1]);
    }

    // ---------------- garden hose: tap -> across the path (a bump) -> coil -> brass nozzle ----------------
    {
      const sH = 297.5;
      const hp = track.place(sH, 0);
      K.ramp(track.place(sH - 2.1, 0).x, track.place(sH - 2.1, 0).z, hp.angle, 4.2, 22, 0.6, 0);
      skipEdge.push([sH - 2.5, sH + 2.5, 0]);
      // coil: flat spiral of hose lying on the lawn
      const cx = 106, cz = -6;
      const pts = [];
      const turns = 4.3, r0 = 3.6, r1 = 11.2;
      for (let i = 0; i <= 240; i++) {
        const t = i / 240, a = t * turns * Math.PI * 2;
        const rad = r0 + (r1 - r0) * t + Math.sin(a * 3) * 0.25;
        pts.push(new T.Vector3(cx + Math.cos(a) * rad, 0.72 + Math.sin(a * 2 + 1) * 0.12 + (t < 0.15 ? 0.6 * (1 - t / 0.15) : 0), cz + Math.sin(a) * rad));
      }
      // hand-laid run from the coil to the road crossing and on to the tap
      const last = pts[pts.length - 1];
      const run = [[last.x + 3, 0.7, last.z + 2.5], [126, 0.7, 3], [136, 0.7, -1.5], [hp.x - 1, 0.7, hp.z + 0.2], [hp.x + 9, 0.7, hp.z - 0.6],
        [158, 1.2, -6], [160.5, 6.8, -6], [164, 7.3, -5.8], [168.5, 6.8, -5.4], [171.5, 2.5, -4.5], [174, 1.6, -1.5], [175, 4, 1.6], [175, 9.6, 1.6]];
      for (const [x, y, z] of run) pts.push(new T.Vector3(x, y, z));
      const curve = new T.CatmullRomCurve3(pts, false, 'centripetal');
      const tube = new T.TubeGeometry(curve, 620, 0.72, 8, false);
      // squash the hose where it crosses the path (tyres flattened it)
      const tp = tube.attributes.position;
      for (let i = 0; i < tp.count; i++) {
        const x = tp.getX(i), z = tp.getZ(i);
        const d = Math.hypot(x - hp.x, z - hp.z);
        if (d < 11) { const k = 1 - 0.35 * (1 - d / 11); tp.setY(i, tp.getY(i) * k); }
      }
      tube.computeVertexNormals();
      K.mesh(tube, hoseMat, 0, 0, 0);
      // inner end: brass trigger nozzle
      const p0 = pts[0], p1 = pts[3];
      const dir = Math.atan2(p0.z - p1.z, p0.x - p1.x);
      const noz = new T.Group();
      const n1 = new T.Mesh(new T.CylinderGeometry(0.95, 0.85, 2.2, 16), K.plastic(0x2a2a2a, 0.5)); n1.rotation.z = Math.PI / 2; n1.position.x = 0.9; noz.add(n1);
      const n2 = new T.Mesh(new T.CylinderGeometry(0.62, 0.9, 3.6, 18), brass); n2.rotation.z = Math.PI / 2; n2.position.x = 3.7; noz.add(n2);
      const n3 = new T.Mesh(new T.CylinderGeometry(0.45, 0.6, 1.0, 16), brass); n3.rotation.z = Math.PI / 2; n3.position.x = 5.9; noz.add(n3);
      const ring = new T.Mesh(new T.TorusGeometry(0.85, 0.14, 8, 18), brass); ring.rotation.y = Math.PI / 2; ring.position.x = 2.2; noz.add(ring);
      noz.position.set(p0.x, 1.0, p0.z); noz.rotation.y = -dir; noz.rotation.z = -0.25;
      K.add(noz);
      contact(cx, cz, 13, 13, 0.3);
      K.circle(cx, cz, 11.6, 1.6);
      // drip puddle from the nozzle
      const np = { x: p0.x + Math.cos(dir) * 7, z: p0.z + Math.sin(dir) * 7 };
      K.spill(np.x, np.z, 1.8, waterMat, { lump: 0.4, y: 0.1, thick: 0.05, n: 20 });
      bareCircle(cx, cz, 12);
      // tap on a little standpipe beyond the bricks
      const tx = 175, tz = -3;
      K.mesh(new T.BoxGeometry(5, 24, 5), K.std({ color: 0x8a7e70, roughness: 0.9, map: stepMat.map }), tx, 12, tz - 2);
      const tapG = new T.Group();
      const pipe = new T.Mesh(new T.CylinderGeometry(0.9, 0.9, 5, 14), brass); pipe.rotation.x = Math.PI / 2; pipe.position.set(0, 0, 2.5); tapG.add(pipe);
      const spout = new T.Mesh(new T.CylinderGeometry(0.8, 0.8, 3, 14), brass); spout.position.set(0, -1.8, 4.6); tapG.add(spout);
      const handle = new T.Mesh(new T.TorusGeometry(1.4, 0.3, 8, 6), K.plastic(0xc0302a, 0.4)); handle.rotation.x = Math.PI / 2; handle.position.set(0, 1.6, 2.8); tapG.add(handle);
      tapG.position.set(tx, 14, tz); K.add(tapG);
      contact(tx, tz - 2, 5, 5, 0.5);
    }

    // ---------------- watering can tipped over, spilling into mud on the path ----------------
    {
      const cx = 74, cz = -34, R = 7.2, H = 15;
      const gz = TX.mottledTextures({ size: 256, a: 0xc2c8c9, b: 0xaeb6b8, c: 0xd2d7d7, seed: 191, period: 6, bump: 0.6, speck: 0.04 });
      gz.map.repeat.set(1.5, 1.5); gz.normalMap.repeat.set(1.5, 1.5);
      const zinc = K.std({ map: gz.map, normalMap: gz.normalMap, normalScale: V2(0.4), metalness: 0.55, roughness: 0.58, envMapIntensity: 0.8 });
      const zincDark = K.std({ color: 0x8b9497, metalness: 0.6, roughness: 0.55 });
      const can = new T.Group();
      const body = new T.Mesh(K.lathe([[0, 0], [R - 0.4, 0], [R, 0.4], [R, H - 0.5], [R - 0.3, H], [R - 2.5, H + 0.6], [R - 2.5, H + 0.3], [0, H + 0.6]], 40), zinc); can.add(body);
      for (const y of [1.2, H * 0.55]) { const b = new T.Mesh(new T.TorusGeometry(R + 0.05, 0.18, 6, 40), zincDark); b.rotation.x = Math.PI / 2; b.position.y = y; can.add(b); }
      const hnd = new T.Mesh(new T.TorusGeometry(R * 0.8, 0.45, 8, 24, Math.PI), zincDark); hnd.position.set(-0.5, H + 0.2, 0); can.add(hnd);
      const back = new T.Mesh(new T.TorusGeometry(4, 0.45, 8, 16, Math.PI * 0.9), zincDark); back.position.set(-R - 0.2, H * 0.62, 0); back.rotation.z = Math.PI / 2 + 0.2; can.add(back);
      // spout: tapered tube from the lower side up and out
      const sp = new T.Mesh(new T.CylinderGeometry(0.75, 1.5, 19, 16, 1, true), zinc);
      sp.position.set(R + 5.5, H * 0.55, 0); sp.rotation.z = -0.95; can.add(sp);
      const rose = new T.Mesh(new T.CylinderGeometry(2.4, 1.0, 1.6, 20), brass);
      const rTip = new T.Vector3(R + 5.5 + Math.sin(0.95) * 9.5, H * 0.55 + Math.cos(0.95) * 9.5, 0);
      rose.position.copy(rTip); rose.rotation.z = -0.95; can.add(rose);
      const roseFace = new T.Mesh(new T.CircleGeometry(2.35, 20), K.std({ color: 0x8a6a2a, metalness: 0.9, roughness: 0.5, map: TX.labelTexture(64, 64, (g) => { g.fillStyle = '#d8b060'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#3a2a10'; for (let i = 0; i < 40; i++) { const a = i * 2.4, rr = Math.sqrt(i / 40) * 26; g.beginPath(); g.arc(32 + Math.cos(a) * rr, 32 + Math.sin(a) * rr, 1.6, 0, 6.3); g.fill(); } }) }));
      roseFace.position.copy(rTip).add(new T.Vector3(Math.sin(0.95) * 0.82, Math.cos(0.95) * 0.82, 0)); roseFace.rotation.set(0, 0, -0.95); roseFace.rotateX(-Math.PI / 2);
      can.add(roseFace);
      can.rotation.y = -0.28; // roll so the rose rests on the lawn
      const tilt = new T.Group(); tilt.add(can); tilt.rotation.x = Math.PI / 2;
      const outer = new T.Group(); outer.add(tilt);
      outer.position.set(cx, R, cz); outer.rotation.y = -Math.PI + 0.2;
      K.add(outer);
      outer.updateMatrixWorld(true);
      const top = body.localToWorld(new T.Vector3(0, H, 0)), base = body.localToWorld(new T.Vector3(0, 0, 0));
      const roseW = rose.getWorldPosition(new T.Vector3());
      contact((top.x + base.x) / 2, (top.z + base.z) / 2, 8.5, 11, 0.5, Math.atan2(top.z - base.z, top.x - base.x) + Math.PI / 2);
      K.capsule(base.x, base.z, top.x, top.z, R, 2 * R);
      K.circle(roseW.x, roseW.z, 2.4, 3);
      contact(roseW.x, roseW.z, 3, 3, 0.35);
      // water running from the rose to the path -> mud
      const mp = track.place(484, 1.5);
      const mud = K.spill(mp.x, mp.z, 7.0, wetMud, { lump: 0.42, stretch: 1.35, angle: mp.angle + 0.4, y: 0.1, thick: 0.08 });
      K.surface('sticky', { poly: mud.poly });
      barePoly(mud.poly, 1);
      for (let i = 0; i < 4; i++) {
        const t = (i + 0.6) / 4.4;
        const x = roseW.x - 2 + (mp.x - roseW.x + 2) * t, z = roseW.z + (mp.z - roseW.z) * t;
        const s = K.spill(x + r.range(-1, 1), z + r.range(-1, 1), r.range(1.6, 2.6), i % 2 ? waterMat : wetMud, { lump: 0.4, stretch: 1.6, angle: 0.1, y: 0.1 + i * 0.005, thick: 0.06, n: 24 });
        barePoly(s.poly, 0.5);
      }
      skipEdge.push([474, 494, 1]);
    }

    // ---------------- flowers: shared instanced geometry ----------------
    const tulipHead = (() => {
      const prof = [[0.05, 0]];
      for (let i = 1; i <= 7; i++) { const t = i / 7; prof.push([0.08 + Math.sin(Math.min(1, t) * Math.PI * 0.8) * 1.15 * (1 - 0.15 * t), t * 3.1]); }
      const g = K.lathe(prof, 12);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), t = y / 3.1;
        const lobe = Math.pow(Math.abs(Math.cos(a * 1.5)), 1.5);
        p.setY(i, y + lobe * 0.5 * t * t * t);
        const k = 1 + 0.08 * lobe * t;
        p.setX(i, x * k); p.setZ(i, z * k);
      }
      g.computeVertexNormals();
      // darker at the base, lighter at the petal tips
      const c = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) { const t = Math.min(1, p.getY(i) / 3.4); const k = 0.62 + 0.38 * t; c.set([k, k, k], i * 3); }
      g.setAttribute('color', new T.BufferAttribute(c, 3));
      return g;
    })();
    const tulipMat = K.phys({ color: 0xffffff, roughness: 0.42, sheen: 0.6, sheenColor: new T.Color(0xffd0d0), side: T.DoubleSide });
    const stemGeo1 = new T.CylinderGeometry(0.22, 0.3, 1, 5, 1, true); stemGeo1.translate(0, 0.5, 0);
    const leafGeo = (() => {
      // long strap leaf, curved outward, double sided
      const g = new T.PlaneGeometry(1, 1, 1, 6);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const u = p.getX(i), v = p.getY(i) + 0.5; // v 0..1 along leaf
        const w = Math.sin(Math.min(1, v * 1.1) * Math.PI) * (1 - v * 0.3);
        p.setXYZ(i, u * w, v * Math.cos(v * 0.9) , Math.sin(v * 0.9) * v * 0.55 + Math.abs(u) * 0.12);
      }
      g.computeVertexNormals();
      return g;
    })();
    const plantLeafMat = K.std({ color: 0xffffff, roughness: 0.55, side: T.DoubleSide });
    const daisyHeadGeo = (() => {
      const S = TX.labelTexture(128, 128, (g) => {
        g.translate(64, 64);
        for (let i = 0; i < 22; i++) { g.rotate(Math.PI * 2 / 22); g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(0, 36, 6, 25, 0, 0, Math.PI * 2); g.fill(); }
        const cg = g.createRadialGradient(-4, -4, 2, 0, 0, 20); cg.addColorStop(0, '#ffe65a'); cg.addColorStop(1, '#d99a12');
        g.fillStyle = cg; g.beginPath(); g.arc(0, 0, 19, 0, Math.PI * 2); g.fill();
      });
      const geo = new T.CircleGeometry(1, 12); geo.rotateX(-Math.PI / 2);
      // cup the petals slightly
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { const d = Math.hypot(p.getX(i), p.getZ(i)); p.setY(i, d * d * 0.18 + (d < 0.35 ? 0.08 : 0)); }
      geo.computeVertexNormals();
      return { geo, mat: K.std({ map: S, alphaTest: 0.5, side: T.DoubleSide, roughness: 0.6 }) };
    })();
    const tulipCols = [0xe0242c, 0xf3c623, 0xf06aa0, 0xfaf2e6, 0xe85a1c, 0x9b2a8a, 0xd8182a];
    const leafCols = [0x5f9a48, 0x4f8a3e, 0x6aa557, 0x56904a];
    const flowerList = { heads: [], stems: [], leaves: [], daisies: [], daisyStems: [] };
    const tulip = (x, z, h, color) => {
      const lean = r.range(-0.1, 0.1), lean2 = r.range(-0.1, 0.1);
      flowerList.stems.push({ x, y: 0, z, sx: 1, sz: 1, sy: h, rx: lean, rz: lean2, color: 0x5d8e3c });
      // head at the top of the (YXZ-rotated) stem
      const hx = x - h * Math.sin(lean2), hy = h * Math.cos(lean2) * Math.cos(lean), hz = z + h * Math.cos(lean2) * Math.sin(lean);
      flowerList.heads.push({ x: hx, y: hy - 0.5, z: hz, ry: r() * 6.28, rx: lean, rz: lean2, s: r.range(1.35, 1.65), color });
      for (let k = 0; k < 2; k++) {
        const a = r() * 6.28, L = h * r.range(0.45, 0.65);
        flowerList.leaves.push({ x, y: 0.2, z, ry: a, sx: r.range(1.6, 2.2), sy: L, sz: L, color: r.pick(leafCols) });
      }
    };
    const daisy = (x, z, y0 = 0) => {
      const h = r.range(2.2, 4.5);
      flowerList.daisyStems.push({ x, y: y0, z, sx: 0.35, sz: 0.35, sy: h, rx: r.range(-0.15, 0.15), color: 0x6a9a40 });
      flowerList.daisies.push({ x, y: y0 + h, z, ry: r() * 6.28, rx: r.range(-0.3, 0.3), rz: r.range(-0.3, 0.3), s: r.range(1.3, 1.9) });
    };

    // timber-edged raised bed
    const boardT = TX.woodTextures({ size: 256, seed: 151, planks: 1, base: 0x8a6a48, dark: 0x5a4430, light: 0xa88a64, ringFreq: 16, gap: 0, roughBase: 0.8 });
    const boardMat = K.std({ map: boardT.map, normalMap: boardT.normalMap, roughness: 0.85 });
    const soilBed = (() => {
      const t = TX.mottledTextures({ size: 256, a: 0x4a3524, b: 0x2c1f14, c: 0x6a5038, seed: 161, period: 16, bump: 5, speck: 0.6, pebbles: 120, pebbleColor: 0x6a5a48 });
      t.map.repeat.set(0.45, 0.45); t.normalMap.repeat.set(0.45, 0.45);
      return K.std({ map: t.map, normalMap: t.normalMap, normalScale: V2(1.3), roughness: 1 });
    })();
    const raisedBed = (poly, h = 2.6) => {
      // soil
      const m = K.flatShape(poly, soilBed, h - 0.6, { extrude: 0.01 });
      m.receiveShadow = true;
      // edging boards between polygon corners
      const n = poly.length;
      for (let i = 0; i < n; i++) {
        const [x1, z1] = poly[i], [x2, z2] = poly[(i + 1) % n];
        const L = Math.hypot(x2 - x1, z2 - z1), a = Math.atan2(z2 - z1, x2 - x1);
        K.mesh(new K.RoundedBoxGeometry(L + 0.9, h, 0.9, 1, 0.15), boardMat, (x1 + x2) / 2, h / 2, (z1 + z2) / 2, { ry: -a });
        K.capsule(x1, z1, x2, z2, 0.5, h);
        contact((x1 + x2) / 2, (z1 + z2) / 2, L / 2 + 1, 1.6, 0.4, a);
      }
      // soil block sides so you cannot see under it
      barePoly(poly, 1.2);
    };

    // ---------------- tulip bed in the hairpin ----------------
    {
      const poly = [[-9, -56], [10, -56], [12, -20], [12, 2], [9, 9], [2, 12], [-6, 9], [-10, 2], [-10, -20]];
      raisedBed(poly);
      // rows of tulips in colour blocks, daisies along the edge
      const bands = [[-52, -40, 0], [-40, -28, 1], [-28, -16, 2], [-16, -4, 4], [-4, 8, 0]];
      for (const [z0, z1, ci] of bands) {
        for (let z = z0 + 2; z < z1; z += 3.4) for (let x = -7; x <= 8; x += 3.6) {
          const px = x + r.range(-0.9, 0.9), pz = z + r.range(-0.9, 0.9);
          if (!inPoly(px, pz, poly) || !inPoly(px * 1.25, pz, poly)) continue;
          tulip(px, pz, r.range(15, 22), tulipCols[(ci + (r() < 0.12 ? 1 : 0)) % tulipCols.length]);
        }
      }
      for (let i = 0; i < poly.length; i++) {
        const [x1, z1] = poly[i], [x2, z2] = poly[(i + 1) % poly.length];
        const L = Math.hypot(x2 - x1, z2 - z1);
        for (let t = 0.1; t < 1; t += 2.4 / L) {
          const x = x1 + (x2 - x1) * t, z = z1 + (z2 - z1) * t;
          const cx = x * 0.86, cz = (z + 23) * 0.94 - 23; // nudge inward
          daisy(cx, cz, 2.0);
        }
      }
      A.tulipBedCentre = [1, -22];
    }

    // ---------------- kidney bed in the west infield with the gnome ----------------
    {
      const poly = [];
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        const rad = 15 + Math.sin(a * 2 + 0.6) * 3.5 + Math.cos(a) * 1.5;
        poly.push([-84 + Math.cos(a) * rad * 1.45, -30 + Math.sin(a) * rad * 0.8]);
      }
      // soft soil bed without edging, edged with half-buried stones
      const m = K.flatShape(poly, soilBed, 0.06);
      barePoly(poly, 1.5);
      const edge = [];
      for (let i = 0; i < poly.length; i++) {
        const [x1, z1] = poly[i], [x2, z2] = poly[(i + 1) % poly.length];
        const L = Math.hypot(x2 - x1, z2 - z1);
        for (let t = 0; t < 1; t += 2.6 / L) {
          const s = r.range(1.0, 1.6);
          edge.push({ x: x1 + (x2 - x1) * t, y: s * 0.15, z: z1 + (z2 - z1) * t, ry: r() * 6, sx: s * 1.3, sy: s * 0.6, sz: s, color: r.pick([0xa8a092, 0x948c80, 0xbab2a4, 0x867e74]) });
        }
      }
      K.instances(pebbleGeo, stoneMat, edge, { colors: true });
      for (let i = 0; i < 46; i++) {
        const x = -84 + r.range(-20, 20), z = -30 + r.range(-11, 11);
        if (!inPoly(x, z, poly) || Math.hypot(x + 78, z + 34) < 6) continue;
        if (r() < 0.55) tulip(x, z, r.range(14, 20), r.pick([0xe0242c, 0xfaf2e6, 0xf3c623]));
        else for (let k = 0; k < 3; k++) daisy(x + r.range(-1.5, 1.5), z + r.range(-1.5, 1.5));
      }
      K.circle(-84, -30, 13, 30);
      K.capsule(-102, -30, -66, -30, 9, 30);
    }

    // instanced flower parts
    bake(stemGeo1, vcMat, flowerList.stems);
    bake(stemGeo1, vcMat, flowerList.daisyStems);
    bake(tulipHead, vcGloss, flowerList.heads);
    bake(leafGeo, vcMat, flowerList.leaves);
    bake(daisyHeadGeo.geo, daisyHeadGeo.mat, flowerList.daisies);

    // ---------------- sandpit in the west bay: timber frame, castle, spade and bucket ----------------
    {
      const x0 = -162, x1 = -138, z0 = 2, z1 = 35, h = 2.2;
      const st = TX.mottledTextures({ size: 256, a: 0xe2c58e, b: 0xd2b47c, c: 0xecd6a6, seed: 171, period: 5, bump: 2.2, speck: 0.35 });
      st.map.repeat.set(0.8, 0.8); st.normalMap.repeat.set(0.8, 0.8);
      const sandMat = K.std({ map: st.map, normalMap: st.normalMap, normalScale: V2(1.4), roughness: 1 });
      // sand surface with a gentle hump and tyre-rutted dip
      const sg = new T.PlaneGeometry(x1 - x0, z1 - z0, 24, 33); sg.rotateX(-Math.PI / 2);
      const sp = sg.attributes.position;
      for (let i = 0; i < sp.count; i++) {
        const x = sp.getX(i), z = sp.getZ(i);
        const e = Math.min((x1 - x0) / 2 - Math.abs(x), (z1 - z0) / 2 - Math.abs(z));
        sp.setY(i, h - 0.5 + Math.min(1, e / 3) * (0.35 + 0.3 * Math.sin(x * 0.4) * Math.cos(z * 0.33)));
      }
      sg.computeVertexNormals();
      const uvA = sg.attributes.uv;
      for (let i = 0; i < uvA.count; i++) uvA.setXY(i, sp.getX(i) / 10, sp.getZ(i) / 10);
      K.mesh(sg, sandMat, (x0 + x1) / 2, 0, (z0 + z1) / 2, { cast: false });
      const sides = [[x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]];
      for (const [ax, az, bx, bz] of sides) {
        const L = Math.hypot(bx - ax, bz - az), a = Math.atan2(bz - az, bx - ax);
        K.mesh(new K.RoundedBoxGeometry(L + 1.6, h, 1.6, 1, 0.25), boardMat, (ax + bx) / 2, h / 2, (az + bz) / 2, { ry: -a });
        K.capsule(ax, az, bx, bz, 0.8, h);
        contact((ax + bx) / 2, (az + bz) / 2, L / 2 + 1.4, 2, 0.45, a);
      }
      // corner seats
      for (const [cx, cz] of [[x1, z0], [x1, z1]]) K.mesh(new K.RoundedBoxGeometry(5, 0.8, 5, 1, 0.2), boardMat, cx - 1.7, h + 0.4, cz + (cz === z0 ? 1.7 : -1.7), { ry: Math.PI / 4 });
      barePoly([[x0 - 1, z0 - 1], [x1 + 1, z0 - 1], [x1 + 1, z1 + 1], [x0 - 1, z1 + 1]]);
      K.surface('slow', { poly: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]] });
      // spilled sand trail onto the lawn by the path
      for (let i = 0; i < 4; i++) {
        const s = K.spill(x1 + 2 + i * 2.2, z1 - 6 - i * 3 + r.range(-1, 1), r.range(1.5, 2.8), sandMat, { lump: 0.5, y: 0.1, thick: 0.1, n: 22 });
        barePoly(s.poly, 0.6);
      }
      // bucket-shaped sand castle with a twig flag
      const castle = (cx, cz, s) => {
        const g = K.lathe([[2.6, 0], [2.3, 3.6], [2.4, 3.6], [2.4, 4.2], [0, 4.2]].map(([a, b]) => [a * s, b * s]), 20);
        K.mesh(g, sandMat, cx, h - 0.2, cz);
        for (let k = 0; k < 6; k++) {
          const a = k / 6 * Math.PI * 2;
          K.mesh(new T.BoxGeometry(0.7 * s, 0.7 * s, 0.7 * s), sandMat, cx + Math.cos(a) * 2.0 * s, h - 0.2 + 4.5 * s, cz + Math.sin(a) * 2.0 * s, { ry: -a });
        }
        contact(cx, cz, 3.2 * s, 3.2 * s, 0.35, 0, h - 0.4);
      };
      castle(-153, 11, 1.1); castle(-146, 9, 0.75);
      K.mesh(new T.CylinderGeometry(0.1, 0.1, 5, 5), K.std({ color: 0x6a4a2a }), -153, h + 6, 11);
      K.mesh(new T.PlaneGeometry(2.2, 1.4), K.std({ color: 0xffd23a, side: T.DoubleSide, roughness: 0.7 }), -152, h + 7.6, 11);
      // toy bucket (bright plastic) lying on its side
      const bucketMat = K.plastic(0x2a7de0, 0.35);
      const bucket = new T.Group();
      const bg = K.lathe([[2.4, 0], [3.4, 6], [3.55, 6.1], [3.5, 6.3], [3.3, 6.2], [2.25, 0.25], [0, 0.25]], 28);
      const bm = new T.Mesh(bg, K.plastic(0x2a7de0, 0.35, { side: T.DoubleSide })); bucket.add(bm);
      const bh = new T.Mesh(new T.TorusGeometry(3.4, 0.17, 6, 20, Math.PI), K.plastic(0xffd23a, 0.4)); bh.position.y = 5.6; bh.rotation.y = 0.4; bucket.add(bh);
      bucket.rotation.set(0, 0, Math.PI / 2 - 0.12); bucket.position.set(-150, h + 2.9, 27);
      const bucketHolder = new T.Group(); bucketHolder.add(bucket); bucketHolder.rotation.y = 0;
      K.add(bucket);
      contact(-153, 27, 5, 3.6, 0.4, 0, h - 0.4);
      // sand that poured out of the bucket
      K.spill(-145.5, 27, 2.6, sandMat, { lump: 0.4, stretch: 1.5, y: h + 0.1, thick: 0.4, n: 22 });
      // toy spade stuck in the sand at an angle
      const spade = new T.Group();
      const blade = new T.Mesh(new K.RoundedBoxGeometry(3.6, 4.4, 0.35, 2, 0.15), K.plastic(0xe8392a, 0.35)); blade.position.y = 2.2; spade.add(blade);
      const shaft = new T.Mesh(new T.CylinderGeometry(0.35, 0.35, 10, 10), K.plastic(0xe8392a, 0.35)); shaft.position.y = 9; spade.add(shaft);
      const grip = new T.Mesh(new T.TorusGeometry(1.0, 0.3, 8, 16), K.plastic(0xe8392a, 0.35)); grip.position.y = 14.6; spade.add(grip);
      spade.position.set(-143.5, h - 1.6, 18); spade.rotation.set(0.15, 0.6, 0.38);
      K.add(spade);
      contact(-141, 18, 3, 2, 0.3, 0, h - 0.4);
      // a little rake lying on the sand
      const rake = new T.Group();
      const rs = new T.Mesh(new T.CylinderGeometry(0.28, 0.28, 11, 8), K.plastic(0x31b25a, 0.35)); rs.rotation.z = Math.PI / 2; rake.add(rs);
      const rh = new T.Mesh(new K.RoundedBoxGeometry(0.8, 0.6, 5, 1, 0.2), K.plastic(0x31b25a, 0.35)); rh.position.x = 5.6; rake.add(rh);
      for (let k = -2; k <= 2; k++) { const t = new T.Mesh(new T.BoxGeometry(1.2, 0.3, 0.3), K.plastic(0x31b25a, 0.35)); t.position.set(6.3, -0.15, k); rake.add(t); }
      rake.position.set(-152, h + 0.3, 20); rake.rotation.y = 0.5;
      K.add(rake);
    }

    // ---------------- terracotta pots with plants ----------------
    const potProf = (s) => [[3.7, 0], [4.1, 0.2], [5.0, 8.6], [5.0, 8.7], [5.7, 8.8], [5.8, 10.8], [5.5, 11.0], [5.2, 10.9], [4.9, 9.2], [0, 9.2]].map(([a, b]) => [a * s, b * s]);
    const potGeo = K.lathe(potProf(1), 32);
    const pot = (x, z, s, plant) => {
      K.mesh(potGeo, terracotta, x, 0, z, { scale: s });
      K.mesh(new T.CircleGeometry(4.95 * s, 24), soilBed, x, 9.25 * s, z, { rx: -Math.PI / 2, cast: false });
      contact(x, z, 6.4 * s, 6.4 * s, 0.5);
      K.circle(x, z, 5.6 * s, 11 * s);
      bareCircle(x, z, 6.2 * s);
      const top = 9.3 * s;
      if (plant === 'geranium') {
        const lv = [], fl = [];
        for (let i = 0; i < 26; i++) {
          const a = r() * 6.28, d = Math.sqrt(r()) * 5 * s;
          lv.push({ x: x + Math.cos(a) * d, y: top + r.range(0.5, 3) * s, z: z + Math.sin(a) * d, ry: r() * 6, rx: r.range(-0.6, 0.2), s: r.range(1.4, 2.2) * s, color: r.pick([0x4f8a32, 0x5e9a3c, 0x3f7a2a]) });
        }
        for (let i = 0; i < 7; i++) {
          const a = r() * 6.28, d = Math.sqrt(r()) * 3.8 * s;
          for (let k = 0; k < 7; k++) fl.push({ x: x + Math.cos(a) * d + r.range(-0.9, 0.9), y: top + r.range(5, 7) * s + r.range(-0.5, 0.5), z: z + Math.sin(a) * d + r.range(-0.9, 0.9), s: r.range(0.55, 0.75), color: r.pick([0xe0262e, 0xf0343a, 0xc81a24]) });
        }
        geraniumLeaves.push(...lv); geraniumFlowers.push(...fl);
      } else if (plant === 'grass') {
        for (let i = 0; i < 26; i++) {
          const a = r() * 6.28;
          strapLeaves.push({ x: x + Math.cos(a) * 1.2, y: top - 0.3, z: z + Math.sin(a) * 1.2, ry: a + Math.PI / 2, rx: 0, sx: r.range(0.5, 0.8), sy: r.range(9, 15) * s, sz: r.range(9, 15) * s, color: r.pick([0x6a9a3a, 0x86b048, 0x9cba5a, 0x5a8a34]) });
        }
      } else if (plant === 'box') {
        const ball = K.mesh(rockGeo(2, 0.08, 4), A.leafy, x, top + 4.8 * s, z, { scale: 5.6 * s });
        ball.scale.y *= 0.92;
      }
    };
    const geraniumLeaves = [], geraniumFlowers = [], strapLeaves = [];
    pot(-96, 50, 1.0, 'geranium'); pot(-84, 60, 0.8, 'box'); pot(-106, 62, 0.75, 'grass');
    pot(106, -42, 0.95, 'geranium'); pot(118, -32, 0.75, 'grass');
    // an empty pot lying on its side with a crack
    {
      const g = new T.Group();
      const m = new T.Mesh(K.lathe(potProf(0.7).slice(0, 8).concat([[3.4, 7.4], [2.6, 0.5], [0, 0.5]]), 28), K.std({ map: terracotta.map, normalMap: terracotta.normalMap, roughness: 0.88, side: T.DoubleSide }));
      g.add(m);
      g.position.set(96, 3.9, -30); g.rotation.set(0, 0.7, Math.PI / 2 - 0.04);
      K.add(g);
      contact(94, -30, 6, 4.5, 0.4, -0.7);
      K.capsule(91, -27, 99, -33, 3.6, 7.5);
      bareCircle(95, -30, 5);
      // a spill of potting soil out of its mouth
      const s = K.spill(90, -24, 3.2, soilBed, { lump: 0.45, stretch: 1.3, angle: 0.8, y: 0.25, thick: 0.25, n: 24 });
      barePoly(s.poly, 0.5);
    }
    {
      const roundLeaf = new T.CircleGeometry(1, 8); roundLeaf.rotateX(-Math.PI / 2);
      bake(roundLeaf, vcMat, geraniumLeaves);
      bake(new T.IcosahedronGeometry(1, 0), vcMat, geraniumFlowers);
      bake(leafGeo, vcMat, strapLeaves);
    }

    // ---------------- garden gnome (original design: a round-bellied fellow with a lantern) ----------------
    {
      const gx = -76, gz = -34;
      const g = new T.Group();
      const glaze = (c, rough = 0.32) => K.phys({ color: c, roughness: rough, clearcoat: 0.7, clearcoatRoughness: 0.25 });
      const skin = glaze(0xf2c4a0), coat = glaze(0x2f6fb8), hat = glaze(0xd8342c), beard = glaze(0xf6f2ea, 0.5), boots = glaze(0x4a2e1c), belt = glaze(0x2a2018);
      const add = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, 0, rz); g.add(m); return m; };
      const sph = new T.SphereGeometry(1, 24, 16);
      add(new T.CylinderGeometry(3.4, 3.8, 1.2, 24), K.std({ color: 0x7a7a72, roughness: 0.9, map: stepMat.map }), 0, 0.6, 0); // plinth
      add(sph, boots, -1.2, 1.9, 0.8, 1.0, 0.7, 1.5); add(sph, boots, 1.2, 1.9, 0.8, 1.0, 0.7, 1.5);
      add(new T.CylinderGeometry(2.0, 2.7, 4.6, 24), coat, 0, 4.4, 0);
      add(sph, coat, 0, 6.2, 0.2, 2.5, 2.2, 2.3);
      add(new T.TorusGeometry(2.45, 0.3, 8, 28), belt, 0, 5.6, 0.15, 1, 1, 1, Math.PI / 2);
      add(new T.BoxGeometry(0.9, 0.8, 0.3), brass, 0, 5.6, 2.6);
      add(sph, skin, 0, 9.2, 0.3, 1.65, 1.6, 1.6); // head
      add(sph, skin, 0, 9.0, 1.9, 0.5, 0.45, 0.45); // nose
      add(sph, glaze(0x1a1a1a, 0.2), -0.6, 9.6, 1.55, 0.16, 0.2, 0.12); add(sph, glaze(0x1a1a1a, 0.2), 0.6, 9.6, 1.55, 0.16, 0.2, 0.12);
      // beard: a cone pointing down in front
      add(new T.ConeGeometry(1.75, 4.2, 20), beard, 0, 6.7, 1.15, 1, 1, 0.7, Math.PI + 0.25);
      add(sph, beard, 0, 8.3, 1.25, 1.5, 0.8, 0.8);
      // tall floppy hat
      const hatG = new T.ConeGeometry(1.85, 6.5, 24, 6);
      const hp = hatG.attributes.position;
      for (let i = 0; i < hp.count; i++) { const y = hp.getY(i) + 3.25; hp.setZ(i, hp.getZ(i) - y * y * 0.06); }
      hatG.computeVertexNormals();
      add(hatG, hat, 0, 13.3, 0.1);
      add(new T.TorusGeometry(1.7, 0.35, 8, 24), hat, 0, 10.4, 0.25, 1, 1, 1, Math.PI / 2 - 0.1);
      // arms holding a lantern
      add(sph, coat, -2.4, 6.6, 0.8, 0.8, 1.9, 0.8, 0.4, -0.5); add(sph, coat, 2.4, 6.6, 0.8, 0.8, 1.9, 0.8, 0.4, 0.5);
      add(sph, skin, 2.9, 5.2, 1.8, 0.6, 0.6, 0.6);
      const lantern = new T.Group(); lantern.position.set(3.2, 3.7, 2.1); g.add(lantern);
      const lf = new T.Mesh(new T.CylinderGeometry(0.85, 0.85, 1.9, 6), K.std({ color: 0xffe6a0, emissive: 0xffc860, emissiveIntensity: 0.6, roughness: 0.3 })); lantern.add(lf);
      const lc = new T.Mesh(new T.ConeGeometry(1.1, 0.9, 6), K.metal(0x2a2a2a, 0.5)); lc.position.y = 1.4; lantern.add(lc);
      const lb = new T.Mesh(new T.CylinderGeometry(1.0, 1.0, 0.3, 6), K.metal(0x2a2a2a, 0.5)); lb.position.y = -1.0; lantern.add(lb);
      g.position.set(gx, 0.3, gz); g.rotation.y = 0.35; g.scale.setScalar(1.55);
      K.add(g);
      contact(gx, gz, 6.5, 6.5, 0.55);
      A.gnome = g;
    }

    // ---------------- rockery in the north-east infield ----------------
    const rockMat = (() => {
      const t = TX.mottledTextures({ size: 256, a: 0xb4ab9a, b: 0x8f877a, c: 0xcfc6b4, seed: 181, period: 3, bump: 1.4, speck: 0.12 });
      return K.std({ map: t.map, normalMap: t.normalMap, normalScale: V2(0.5), roughness: 0.82 });
    })();
    {
      // weathered limestone: low-frequency lumps, flattened, partly sunk into the lawn
      const rocks = [[84, 34, 7.0, 3.6, 0.2, 0xffffff], [94, 44, 4.6, 2.6, 1.1, 0xe8e2d6], [75, 44, 4.0, 2.4, 2.1, 0xd8d0c2], [89, 25, 3.4, 2.0, 0.6, 0xf2ece2], [101, 33, 3.6, 1.8, 2.6, 0xe0d8ca]];
      const rg = rockGeo(3, 0.1, 2.3, 0.3), rg2 = rockGeo(3, 0.12, 5.1, 0.35);
      rocks.forEach(([x, z, rad, hh, ry, col], i) => {
        const m = K.mesh(i % 2 ? rg2 : rg, rockMat.clone(), x, hh * 0.25, z, { ry });
        m.material.color.set(col);
        m.scale.set(rad, hh, rad * 0.8);
        contact(x, z, rad * 1.25, rad * 1.1, 0.55);
        K.circle(x, z, rad * 0.85, hh * 1.2);
        bareCircle(x, z, rad * 0.9);
      });
      // alpine cushion plants: low mounds studded with tiny flowers
      const mounds = [], fl = [];
      for (const [x, z, s, c] of [[79, 36, 2.6, 0xd070c0], [96, 36, 2.2, 0xffffff], [86, 47, 2.4, 0x9a7ad8], [72, 38, 1.8, 0xf0a6d0], [102, 41, 1.9, 0xffe060], [92, 28, 1.6, 0xd070c0]]) {
        mounds.push({ x, y: 0, z, sx: s * 1.2, sy: s * 0.55, sz: s, color: r.pick([0x5f8f38, 0x6f9a40, 0x4f7f30]) });
        for (let k = 0; k < 26; k++) {
          const a = r() * 6.28, d = Math.sqrt(r()) * s;
          fl.push({ x: x + Math.cos(a) * d * 1.15, y: s * 0.55 * Math.sqrt(Math.max(0, 1 - (d / s) ** 2)) + 0.1, z: z + Math.sin(a) * d * 0.95, s: r.range(0.22, 0.34), color: c });
        }
      }
      bake(new T.SphereGeometry(1, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2), vcMat, mounds);
      bake(new T.IcosahedronGeometry(1, 0), vcMat, fl, { cast: false });
    }

    // ---------------- stone birdbath in the north-west infield ----------------
    {
      const bx = -114, bz = -46;
      const bath = K.lathe([[5.2, 0], [5.4, 0.8], [3.0, 1.6], [2.0, 2.4], [1.7, 7], [1.9, 9.6], [2.6, 10.6], [7.2, 11.6], [8.6, 12.6], [8.8, 13.6], [8.2, 13.8], [7.6, 12.9], [0, 12.4]], 40);
      K.mesh(bath, stepMat, bx, 0, bz);
      K.mesh(new T.CircleGeometry(7.7, 36), waterMat, bx, 13.1, bz, { rx: -Math.PI / 2, cast: false });
      contact(bx, bz, 7.5, 7.5, 0.5);
      K.circle(bx, bz, 5.4, 14);
      bareCircle(bx, bz, 6);
      // a few petals floating on the water
      const pet = [];
      for (let i = 0; i < 7; i++) { const a = r() * 6.28, d = r() * 6; pet.push({ x: bx + Math.cos(a) * d, y: 13.15, z: bz + Math.sin(a) * d, ry: r() * 6.28, sx: 0.9, sy: 1, sz: 0.5, color: r.pick([0xf06aa0, 0xfaf2e6, 0xe0242c]) }); }
      bake(new T.CircleGeometry(1, 8).rotateX(-Math.PI / 2), vcMat, pet, { cast: false });
    }

    // ---------------- mushrooms, fallen leaves, scattered stones ----------------
    {
      const capG = new T.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      const stalkG = new T.CylinderGeometry(0.32, 0.42, 1, 10); stalkG.translate(0, 0.5, 0);
      const caps = [], stalks = [];
      const shroom = (x, z, s, color) => {
        const h = r.range(1.6, 2.6) * s;
        stalks.push({ x, y: 0, z, sx: s, sz: s, sy: h, color: 0xf2ece0 });
        caps.push({ x, y: h - 0.1, z, sx: s * 1.4, sy: s * 0.9, sz: s * 1.4, rx: r.range(-0.15, 0.15), rz: r.range(-0.15, 0.15), color });
      };
      const clusters = [[70, 56, 4], [-146, -84, 5], [52, -20, 3], [-104, -6, 4], [124, 72, 3], [-60, 60, 3], [-40, -66, 3]];
      for (const [cx, cz, n] of clusters) for (let i = 0; i < n; i++) shroom(cx + r.range(-2.5, 2.5), cz + r.range(-2.5, 2.5), r.range(0.8, 1.5), r.pick([0xb8865a, 0xa06a40, 0xd8b890, 0xc8402a]));
      bake(stalkG, vcMat, stalks);
      bake(capG, vcGloss, caps);
      for (const c of caps) if (c.color === 0xc8402a) { /* white dots on red caps */ }
      const dots = caps.filter((c) => c.color === 0xc8402a).flatMap((c) => Array.from({ length: 6 }, (_, k) => {
        const a = k / 6 * 6.28 + r(), d = c.sx * 0.55;
        return { x: c.x + Math.cos(a) * d, y: c.y + c.sy * 0.75, z: c.z + Math.sin(a) * d, s: 0.18 * c.sx, color: 0xffffff };
      }));
      bake(new T.IcosahedronGeometry(1, 0), vcMat, dots, { cast: false });
      for (const [cx, cz] of clusters) contact(cx, cz, 4, 4, 0.25);

      // fallen leaves (curled shapes) mostly near the hedge and fence, a few on the lawn and path
      const lg = (() => {
        const sh = new T.Shape();
        sh.moveTo(0, -1); sh.bezierCurveTo(0.7, -0.6, 0.75, 0.4, 0, 1.1); sh.bezierCurveTo(-0.75, 0.4, -0.7, -0.6, 0, -1);
        const g = new T.ShapeGeometry(sh, 6); g.rotateX(-Math.PI / 2);
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) p.setY(i, Math.abs(p.getX(i)) * 0.35 + p.getZ(i) * p.getZ(i) * 0.08);
        g.computeVertexNormals();
        return g;
      })();
      const leaves = [];
      const leafC = [0xc8862a, 0xb0521e, 0xd8a83a, 0x8a5a2a, 0x9a8a3a, 0xa83a1a];
      const drop = (x, z) => leaves.push({ x, y: r.range(0.12, 0.4), z, ry: r() * 6.28, rx: r.range(-0.25, 0.25), rz: r.range(-0.25, 0.25), s: r.range(1.6, 2.6), color: r.pick(leafC) });
      for (let i = 0; i < 70; i++) drop(r.range(-162, -150), r.range(-95, 95));
      for (let i = 0; i < 70; i++) drop(r.range(-160, 158), r.range(-96, -88));
      for (let i = 0; i < 70; i++) { const x = r.range(-150, 150), z = r.range(-85, 90); if (!isBare(x, z)) drop(x, z); }
      for (let i = 0; i < 18; i++) { const p = track.place(r() * track.length, r.range(-6, 6)); drop(p.x, p.z); }
      bake(lg, vcMat, leaves, { cast: false, cell: 120 });

      // scattered rocks and pebbles on the lawn
      const rocks = [];
      for (let i = 0; i < 90; i++) {
        const x = r.range(-158, 156), z = r.range(-94, 94);
        if (edgeDist(x, z) < 3 || isBare(x, z)) continue;
        const s = r.range(0.6, 2.2);
        rocks.push({ x, y: s * 0.2, z, ry: r() * 6, s, sy: s * 0.6, color: r.pick(pebbleCols) });
      }
      chunked(pebbleGeo, stoneMat, rocks, { colors: true }, 110);
      for (const k of rocks) if (k.s > 1.6) K.circle(k.x, k.z, k.s * 0.8, k.s);
    }

    // ---------------- snail and ladybird (they move) ----------------
    {
      A.anim = [];
      // snail: shell spiral + soft body, gliding along a slime trail
      const snail = new T.Group();
      const shellG = (() => {
        const pts = [];
        for (let i = 0; i <= 60; i++) { const t = i / 60, a = t * Math.PI * 5.2, rr = 0.25 + t * 1.6; pts.push(new T.Vector3(Math.cos(a) * rr, Math.sin(a) * rr, (1 - t) * 0.9)); }
        const c = new T.CatmullRomCurve3(pts);
        const g = new T.TubeGeometry(c, 90, 1, 10, false);
        // radius grows along the spiral
        const p = g.attributes.position, n = 90 + 1, seg = 11;
        for (let i = 0; i < n; i++) {
          const t = i / (n - 1), rad = 0.18 + t * 0.95, cen = c.getPointAt(t);
          for (let j = 0; j < seg; j++) {
            const k = i * seg + j;
            p.setXYZ(k, cen.x + (p.getX(k) - cen.x) * rad, cen.y + (p.getY(k) - cen.y) * rad, cen.z + (p.getZ(k) - cen.z) * rad);
          }
        }
        g.computeVertexNormals();
        return g;
      })();
      const shellTex = TX.paint(64, 256, (x, y, u, v, o) => { const b = Math.sin(v * 60) * 0.5 + 0.5; o[0] = 150 + b * 60; o[1] = 100 + b * 40; o[2] = 50 + b * 25; });
      const shell = new T.Mesh(shellG, K.phys({ map: TX.toTexture(shellTex), roughness: 0.3, clearcoat: 0.8 }));
      shell.position.set(-0.3, 2.3, 0); shell.scale.setScalar(0.95);
      snail.add(shell);
      const bodyMat = K.phys({ color: 0xb8a68a, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.15 });
      const foot = new T.Mesh(new T.CapsuleGeometry(0.75, 4.6, 6, 12), bodyMat);
      foot.rotation.z = Math.PI / 2; foot.scale.set(1, 1, 0.9); foot.position.set(0.3, 0.6, 0); snail.add(foot);
      const neck = new T.Mesh(new T.CapsuleGeometry(0.55, 1.6, 6, 10), bodyMat); neck.position.set(2.6, 1.4, 0); neck.rotation.z = -0.6; snail.add(neck);
      for (const sz of [-0.35, 0.35]) {
        const st = new T.Mesh(new T.CylinderGeometry(0.08, 0.12, 1.8, 6), bodyMat); st.position.set(3.2, 2.7, sz); st.rotation.set(sz * 0.6, 0, -0.35); snail.add(st);
        const eye = new T.Mesh(new T.SphereGeometry(0.17, 8, 6), K.std({ color: 0x2a2018 })); eye.position.set(3.5, 3.55, sz * 1.5); snail.add(eye);
      }
      snail.scale.setScalar(1.3);
      K.add(snail); keep.push(snail);
      // slime trail decal behind it (static path), snail inches along it and back
      const path = new T.CatmullRomCurve3([[112, 22], [118, 18], [124, 22], [128, 30], [126, 38], [120, 42]].map(([x, z]) => new T.Vector3(x, 0, z)));
      const slime = new T.TubeGeometry(path, 60, 0.5, 4, false);
      slime.scale(1, 0.08, 1);
      K.mesh(slime, K.phys({ color: 0xdfe8ee, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.4 }), 0, 0.12, 0, { cast: false });
      const sp = new T.Vector3(), tg = new T.Vector3();
      A.anim.push((t) => {
        const u = 0.15 + 0.8 * (0.5 - 0.5 * Math.cos(t * 0.025));
        path.getPointAt(u, sp); path.getTangentAt(u, tg);
        const dir = Math.sin(t * 0.025) >= 0 ? 1 : -1;
        snail.position.set(sp.x, 0, sp.z);
        snail.rotation.y = -Math.atan2(tg.z * dir, tg.x * dir);
        const pulse = 1 + Math.sin(t * 3) * 0.04;
        foot.scale.set(1, pulse, 0.9);
      });
      A.snail = snail;
      // ladybird: red domed wings with black dots, wandering on a big leaf near the rockery
      const lb = new T.Group();
      const domeT = TX.labelTexture(128, 64, (g) => {
        g.fillStyle = '#d4161c'; g.fillRect(0, 0, 128, 64);
        g.fillStyle = '#161210';
        for (const [x, y, rr] of [[20, 22, 8], [52, 34, 9], [84, 22, 8], [108, 40, 7], [36, 52, 6], [70, 54, 6], [5, 46, 5], [122, 14, 5]]) { g.beginPath(); g.arc(x, y, rr, 0, 6.3); g.fill(); }
        g.fillRect(62, 0, 4, 64);
      });
      const dome = new T.Mesh(new T.SphereGeometry(1.25, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), K.phys({ map: domeT, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 }));
      dome.scale.set(1.1, 0.85, 1); lb.add(dome);
      const head = new T.Mesh(new T.SphereGeometry(0.55, 14, 10), K.std({ color: 0x141210, roughness: 0.4 })); head.position.set(1.3, 0.25, 0); lb.add(head);
      for (const sz of [-0.3, 0.3]) { const w = new T.Mesh(new T.SphereGeometry(0.16, 8, 6), K.std({ color: 0xffffff })); w.position.set(1.55, 0.45, sz); lb.add(w); }
      lb.position.y = 0.6;
      K.add(lb); keep.push(lb);
      // the big leaf it walks on
      const bigLeaf = (() => {
        const sh = new T.Shape();
        sh.moveTo(-8, 0); sh.bezierCurveTo(-4, 6, 4, 6, 8, 0); sh.bezierCurveTo(4, -6, -4, -6, -8, 0);
        const g = new T.ShapeGeometry(sh, 16); g.rotateX(-Math.PI / 2);
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) p.setY(i, 0.15 + Math.abs(p.getZ(i)) * 0.12 + Math.sin(p.getX(i) * 0.5) * 0.12);
        g.computeVertexNormals();
        const tex = TX.labelTexture(256, 256, (c) => {
          c.fillStyle = '#4f8a2a'; c.fillRect(0, 0, 256, 256);
          c.strokeStyle = '#9cc860'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 128); c.lineTo(256, 128); c.stroke();
          c.lineWidth = 1.5; for (let k = 0; k < 9; k++) { const x = 20 + k * 26; c.beginPath(); c.moveTo(x, 128); c.lineTo(x + 30, 40); c.moveTo(x, 128); c.lineTo(x + 30, 216); c.stroke(); }
        });
        const uv = g.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + 8) / 16, (p.getZ(i) + 6) / 12);
        return new T.Mesh(g, K.std({ map: tex, roughness: 0.5, side: T.DoubleSide }));
      })();
      bigLeaf.position.set(58, 0.1, 50); bigLeaf.rotation.y = 0.5;
      K.add(bigLeaf);
      bareCircle(58, 50, 7);
      contact(58, 50, 9, 6, 0.25, -0.5);
      A.anim.push((t) => {
        const a = t * 0.18;
        const x = Math.cos(a) * 4.2, z = Math.sin(a * 1.7) * 1.8;
        const dx = -Math.sin(a) * 4.2, dz = Math.cos(a * 1.7) * 1.8 * 1.7;
        const c = Math.cos(-0.5), s = Math.sin(-0.5);
        lb.position.set(58 + x * c - z * s, 0.55, 50 + x * s + z * c);
        lb.rotation.y = -(Math.atan2(dz, dx) - 0.5);
      });
      A.ladybird = lb;
    }

    // ---------------- shrubs and a hydrangea behind the fence ----------------
    {
      const shrubs = [];
      for (let x = -170; x < 170; x += r.range(14, 22)) shrubs.push({ x, y: r.range(4, 8), z: -112 + r.range(-6, 4), ry: r() * 6, sx: r.range(10, 15), sy: r.range(10, 16), sz: r.range(8, 12), color: r.pick([0xffffff, 0xd8e8c8, 0xc8d8b8, 0xe8f0d8]) });
      K.instances(rockGeo(2, 0.15, 7.7), A.leafy, shrubs, { colors: true });
      const blooms = [];
      for (const sh of shrubs) {
        if (r() < 0.45) continue;
        const col = r.pick([0x8aa8e8, 0xc8a0e0, 0xf0b0c8, 0xffffff]);
        for (let i = 0; i < 6; i++) blooms.push({ x: sh.x + r.range(-8, 8), y: sh.y + sh.sy * r.range(0.4, 0.85), z: sh.z + r.range(2, sh.sz * 0.95), s: r.range(1.8, 2.6), color: col });
      }
      bake(new T.IcosahedronGeometry(1, 1), vcMat, blooms, { cell: 400 });
    }


    // ---------------- pebbles lining both edges + grit on the path ----------------
    {
      const list = [];
      for (const side of [-1, 1]) {
        for (const p of track.edgePoints(side, 1.75, 0.55)) {
          if (isBare(p.x, p.z)) continue;
          if (skipEdge.some(([a, b, sd]) => p.s > a && p.s < b && (sd === 0 || sd === side))) continue;
          const j = r.range(-0.45, 0.6);
          const x = p.x + Math.cos(p.angle + Math.PI / 2) * j * side, z = p.z + Math.sin(p.angle + Math.PI / 2) * j * side;
          const s = r.range(0.55, 1.2);
          list.push({ x, y: s * 0.25, z, ry: r() * 6.28, rx: r.range(-0.2, 0.2), sx: s * r.range(0.9, 1.3), sy: s * r.range(0.5, 0.75), sz: s, color: r.pick(pebbleCols) });
          if (r() < 0.28) {
            const s2 = r.range(0.3, 0.6), o = r.range(0.8, 2.2) * side;
            list.push({ x: x + Math.cos(p.angle + Math.PI / 2) * o, y: s2 * 0.2, z: z + Math.sin(p.angle + Math.PI / 2) * o, ry: r() * 6.28, s: s2, sy: s2 * 0.6, color: r.pick(pebbleCols) });
          }
        }
      }
      chunked(pebbleGeo, stoneMat, list, { colors: true }, 70);
      // grit and small stones on the path itself
      const grit = [];
      for (let i = 0; i < 1100; i++) {
        const p = track.place(r() * track.length, r.range(-1, 1) * (r() < 0.6 ? 7.2 : 4));
        const s = r.range(0.12, 0.38);
        grit.push({ x: p.x, y: 0.05, z: p.z, ry: r() * 6.28, s, sy: s * 0.6, color: r.pick(pebbleCols) });
      }
      chunked(gritGeo, stoneMat, grit, { colors: true, cast: false }, 110);
    }

    // ---------------- lawn grass: instanced tufts with wind sway, trucks flatten them ----------------
    {
      // one tuft = 5 tapered, curved blades (3 triangles each)
      const pos = [], nrm = [], col = [], idx = [];
      const tr = K.rng(77);
      for (let b = 0; b < 5; b++) {
        const a = tr() * Math.PI * 2, rad = tr() * 0.35;
        const ox = Math.cos(a) * rad, oz = Math.sin(a) * rad;
        const h = 0.75 + tr() * 0.5, w = 0.2 + tr() * 0.1, rot = tr() * Math.PI * 2;
        const lean = 0.15 + tr() * 0.35, la = a + tr.range(-0.6, 0.6);
        const cr = Math.cos(rot), sr = Math.sin(rot);
        const rows = [[0, w / 2], [0.5, w * 0.36], [1, 0]];
        const base = pos.length / 3;
        for (const [t, hw] of rows) {
          const y = t * h, bend = lean * t * t;
          for (const sgn of t < 1 ? [-1, 1] : [0]) {
            const lx = sgn * hw;
            pos.push(ox + lx * cr + Math.cos(la) * bend, y, oz + lx * sr + Math.sin(la) * bend);
            const nx = -sr * 0.35, nz = cr * 0.35, l = Math.hypot(nx, 1, nz);
            nrm.push(nx / l, 1 / l, nz / l);
            const k = 0.42 + 0.58 * Math.pow(t, 0.8);
            col.push(k * 0.92, k, k * 0.85);
          }
        }
        idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2, base + 2, base + 3, base + 4);
      }
      const tuft = new T.BufferGeometry();
      tuft.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      tuft.setAttribute('normal', new T.Float32BufferAttribute(nrm, 3));
      tuft.setAttribute('color', new T.Float32BufferAttribute(col, 3));
      tuft.setIndex(idx);
      A.wind = { value: 0 };
      A.carsU = { value: [new T.Vector4(), new T.Vector4(), new T.Vector4(), new T.Vector4()] };
      const grassMat = K.std({ vertexColors: true, side: T.DoubleSide, roughness: 0.78 });
      grassMat.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = A.wind; sh.uniforms.uCars = A.carsU;
        sh.vertexShader = 'uniform float uTime;\nuniform vec4 uCars[4];\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
        {
          mat3 im = mat3(instanceMatrix);
          vec2 ip = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
          float h = max(position.y, 0.0);
          float gust = 0.55 + 0.45 * sin(uTime * 0.7 + ip.x * 0.025 - ip.y * 0.018);
          float ph = uTime * 2.3 + ip.x * 0.13 + ip.y * 0.07;
          float sw = (sin(ph) * 0.55 + sin(ph * 2.7 + ip.y * 0.5) * 0.2 + 0.45) * gust * h * h * 0.55;
          float squash = 1.0; vec2 push = vec2(0.0);
          for (int i = 0; i < 4; i++) {
            vec2 d = ip - uCars[i].xy;
            float dl = length(d);
            float k = (1.0 - smoothstep(1.4, 3.2, dl)) * uCars[i].z;
            squash = min(squash, 1.0 - 0.75 * k);
            push += k * d / max(dl, 0.05);
          }
          vec3 wv = vec3(0.85 * sw + push.x * h * 0.9, 0.0, 0.4 * sw + push.y * h * 0.9);
          float s2 = max(dot(im[0], im[0]), 1e-4);
          transformed += (transpose(im) * wv) / s2;
          transformed.y *= squash;
        }
        #endif`);
      };
      const tufts = [], tall = [];
      const cols = [0x6fae3c, 0x5c9c32, 0x7dbb46, 0x4f8c2a, 0x8cc552, 0x67a538, 0x93b844, 0x5a9a3a];
      const cell = 1 / Math.sqrt(1.5 * Q);
      for (let z = -100; z < 97.5; z += cell) {
        for (let x = -163; x < 160; x += cell) {
          const px = x + tr() * cell, pz = z + tr() * cell;
          const ed = edgeDist(px, pz);
          if (ed < 0.4) continue;
          if (ed < 2.2 && tr() > (ed - 0.4) / 1.8) continue;
          if (isBare(px, pz)) continue;
          const nearEdge = ed < 6 ? 1 - ed / 6 : 0;
          const wild = px < -152 || pz < -91 || px > 154 ? 1 : 0; // uncut grass along the borders
          const st = A.stripe(pz);
          const s = tr.range(0.95, 1.35) * (1 + nearEdge * 0.35 + wild * 0.7) * (0.95 + st * 0.1);
          const c = new T.Color(cols[(tr() * cols.length) | 0]).multiplyScalar(0.9 + st * 0.16 + tr() * 0.1);
          (wild ? tall : tufts).push({ x: px, y: 0, z: pz, ry: tr() * 6.283, s, sy: s * tr.range(0.8, 1.6) * (1 + nearEdge * 0.5 + wild), color: c.getHex() });
        }
      }
      for (const m of chunked(tuft, grassMat, tufts.concat(tall), { colors: true, cast: false }, 44)) m.receiveShadow = true;
      A.grassCount = tufts.length + tall.length;

      // lawn daisies, clover and the odd dandelion as tiny flat flowers
      const daisyT = TX.labelTexture(128, 128, (g) => {
        g.translate(64, 64);
        for (let i = 0; i < 18; i++) {
          g.rotate(Math.PI * 2 / 18);
          g.fillStyle = i % 3 ? '#fbfaf4' : '#f3e6ee';
          g.beginPath(); g.ellipse(0, 34, 7, 26, 0, 0, Math.PI * 2); g.fill();
        }
        const cg = g.createRadialGradient(-4, -4, 2, 0, 0, 18);
        cg.addColorStop(0, '#ffe25a'); cg.addColorStop(1, '#e0a010');
        g.fillStyle = cg; g.beginPath(); g.arc(0, 0, 17, 0, Math.PI * 2); g.fill();
      });
      const dandT = TX.labelTexture(128, 128, (g) => {
        g.translate(64, 64);
        for (let ring = 0; ring < 3; ring++) for (let i = 0; i < 26; i++) {
          g.rotate(Math.PI * 2 / 26 + ring * 0.07);
          g.fillStyle = ring === 2 ? '#f5a800' : ring ? '#ffc81a' : '#ffd93a';
          g.beginPath(); g.ellipse(0, 36 - ring * 11, 5, 22 - ring * 5, 0, 0, Math.PI * 2); g.fill();
        }
      });
      const cloverT = TX.labelTexture(128, 128, (g) => {
        g.translate(64, 64);
        for (let i = 0; i < 3; i++) {
          g.rotate(Math.PI * 2 / 3);
          g.fillStyle = '#4f8f2e'; g.beginPath(); g.arc(-13, 26, 20, 0, Math.PI * 2); g.arc(13, 26, 20, 0, Math.PI * 2); g.fill();
          g.strokeStyle = 'rgba(220,240,200,0.6)'; g.lineWidth = 4; g.beginPath(); g.arc(0, 26, 14, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
        }
      });
      const flatGeo = new T.PlaneGeometry(1, 1); flatGeo.rotateX(-Math.PI / 2);
      const daisies = [], dands = [], clovers = [];
      for (let i = 0; i < 70; i++) {
        // daisies grow in loose patches
        const cx = tr.range(-158, 156), cz = tr.range(-94, 94);
        const n = 3 + ((tr() * 9) | 0);
        for (let j = 0; j < n; j++) {
          const x = cx + tr.gauss() * 4, z = cz + tr.gauss() * 4;
          if (edgeDist(x, z) < 1.5 || isBare(x, z)) continue;
          const s = tr.range(1.0, 1.6);
          daisies.push({ x, y: tr.range(0.9, 1.6), z, ry: tr() * 6.28, rx: tr.range(-0.3, 0.3), s, color: 0xffffff });
        }
      }
      for (let i = 0; i < 90; i++) {
        const x = tr.range(-158, 156), z = tr.range(-94, 94);
        if (edgeDist(x, z) < 1.5 || isBare(x, z)) continue;
        dands.push({ x, y: tr.range(1.4, 2.4), z, ry: tr() * 6.28, rx: tr.range(-0.25, 0.25), s: tr.range(1.5, 2.1), color: 0xffffff });
      }
      for (let i = 0; i < 40; i++) {
        const cx = tr.range(-158, 156), cz = tr.range(-94, 94);
        for (let j = 0; j < 14; j++) {
          const x = cx + tr.gauss() * 3, z = cz + tr.gauss() * 3;
          if (edgeDist(x, z) < 1 || isBare(x, z)) continue;
          clovers.push({ x, y: tr.range(0.5, 1.1), z, ry: tr() * 6.28, rx: tr.range(-0.3, 0.3), rz: tr.range(-0.3, 0.3), s: tr.range(1.3, 1.9), color: 0xffffff });
        }
      }
      const fm = (map) => K.std({ map, alphaTest: 0.5, side: T.DoubleSide, roughness: 0.7 });
      bake(flatGeo, fm(daisyT), daisies, { cast: false, cell: 120 });
      bake(flatGeo, fm(dandT), dands, { cast: false, cell: 120 });
      bake(flatGeo, fm(cloverT), clovers, { cast: false, cell: 120 });
      // daisy and dandelion stems
      const stemGeo = new T.CylinderGeometry(0.05, 0.07, 1, 4, 1, true); stemGeo.translate(0, 0.5, 0);
      const stems = daisies.concat(dands).map((d) => ({ x: d.x, y: 0, z: d.z, sx: 1, sz: 1, sy: d.y, color: 0x5d8f34 }));
      bake(stemGeo, vcMat, stems, { cast: false, cell: 120 });
    }
    flushBake();

    // ---------------- contact shadows: one instanced draw ----------------
    {
      const g = new T.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2);
      const mat = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, alphaMap: TX.blobShadowTexture(), depthWrite: false });
      mat.onBeforeCompile = (sh) => {
        sh.vertexShader = 'varying float vOp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\nvOp = length(instanceMatrix[1].xyz);\n#endif');
        sh.fragmentShader = 'varying float vOp;\n' + sh.fragmentShader.replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\ndiffuseColor.a *= vOp;');
      };
      const im = K.instances(g, mat, contacts, { cast: false, receive: false });
      im.renderOrder = 1;
    }

    // ---------------- merge static meshes per material (fewer draw calls) ----------------
    {
      const BU = K.BufferGeometryUtils;
      K.group.updateMatrixWorld(true);
      const isKept = (o) => { for (let p = o; p; p = p.parent) if (keep.includes(p)) return true; return false; };
      const buckets = new Map();
      K.group.traverse((o) => {
        if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || isKept(o)) return;
        if (o.material.transparent || o.renderOrder) return;
        if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
        const c = o.geometry.boundingSphere.center.clone().applyMatrix4(o.matrixWorld);
        if (o.geometry.boundingSphere.radius * o.matrixWorld.getMaxScaleOnAxis() > 60) return; // big things stay alone
        const cell = Math.floor((c.x + 200) / 90) + ':' + Math.floor((c.z + 200) / 90);
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

  animate(time, dt, game) {
    if (!A) return;
    if (A.wind) A.wind.value = time;
    if (A.carsU && game) {
      const v = A.carsU.value;
      for (let i = 0; i < 4; i++) {
        const e = game.cars[i], c = e && e.car;
        if (c && !e.out && c.state === 'drive' && c.y < 1.5) v[i].set(c.x, c.z, 1, 0); else v[i].set(1e4, 1e4, 0, 0);
      }
    }
    if (A.anim) for (const f of A.anim) f(time, dt);
  },
};

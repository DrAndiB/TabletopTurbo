// World 1: the breakfast table. Oak table, gingham cloth, cereal-lined track, toast ramp over spilt milk.
import * as THREE from '../../vendor/three.bundle.js';

const TRACK = [
  [-60, 66], [0, 68], [50, 63], [92, 52], [117, 25], [121, -10], [108, -45], [80, -64], [45, -66],
  [22, -50], [8, -22], [-8, -8], [-26, -18], [-38, -48], [-60, -66], [-100, -66], [-122, -45],
  [-126, -5], [-118, 35], [-95, 60],
];

export default {
  id: 'breakfast',
  name: 'Breakfast Rush',
  blurb: 'Oak table, gingham cloth, a toast ramp over spilt milk and a jam hairpin.',
  vehicle: 'sports',
  seed: 11,
  track: { points: TRACK, width: 14, startS: 40 },
  bounds: { minX: -150, maxX: 150, minZ: -95, maxZ: 95 },
  fallOffEdges: true,
  floorY: -76,
  offCourse: 16,
  skidColor: 0x2a1c12,
  dust: { normal: null, sticky: { color: 0xa0131c, size: 0.7, life: 0.4, up: 1, grav: 10, alpha: 0.9, grow: 1 }, slick: { color: 0xffffff, size: 0.8, life: 0.5, up: 3, grav: 25, alpha: 0.9, grow: 1, rate: 2 } },
  lighting: {
    sunDir: [-0.55, 1, -0.42], sunColor: 0xfff0da, sunIntensity: 2.7,
    hemiSky: 0xe3ecff, hemiGround: 0x8a6a4a, hemiIntensity: 0.55,
    envIntensity: 0.5, exposure: 1.0, background: 0x2b221c,
  },

  async build(K) {
    const { THREE: T, TX, r, track } = K;

    // ---------------- table, cloth, floor ----------------
    const oak = TX.woodTextures({ size: 1024, seed: 4, planks: 4, base: 0xb07a45, dark: 0x6e4524, light: 0xd7a46b, ringFreq: 18, gap: 0.004, roughBase: 0.5 });
    for (const t of Object.values(oak)) { t.repeat.set(300 / 64, 190 / 64); t.rotation = Math.PI / 2; t.center.set(0.5, 0.5); }
    const tableMat = K.std({ map: oak.map, normalMap: oak.normalMap, roughnessMap: oak.roughnessMap, normalScale: new T.Vector2(0.6, 0.6) });
    const top = K.mesh(new T.BoxGeometry(300, 4, 190), [tableMat, tableMat, tableMat, tableMat, tableMat, tableMat], 0, -2, 0, { cast: false });
    // apron and legs
    const legMat = K.std({ map: oak.map, color: 0xc89060, roughness: 0.55 });
    K.mesh(new T.BoxGeometry(286, 8, 176), legMat, 0, -8, 0, { cast: false });
    for (const [x, z] of [[-138, -84], [138, -84], [-138, 84], [138, 84]]) K.mesh(new T.BoxGeometry(8, 72, 8), legMat, x, -40, z, { cast: false });
    // kitchen floor far below
    const floorC = TX.makeCanvas(512);
    const fg = floorC.getContext('2d');
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      fg.fillStyle = (x + y) % 2 ? '#c9b79c' : '#8f5f45';
      fg.fillRect(x * 64, y * 64, 64, 64);
      fg.strokeStyle = 'rgba(60,45,35,0.5)'; fg.lineWidth = 2; fg.strokeRect(x * 64, y * 64, 64, 64);
    }
    const floorT = TX.toTexture(floorC, { repeat: [12, 12] });
    const floor = K.mesh(new T.PlaneGeometry(1600, 1600), K.std({ map: floorT, roughness: 0.6 }), 0, -76, 0, { rx: -Math.PI / 2, cast: false });
    // a rug under the table
    const rugC = TX.paint(256, 256, (x, y, u, v, o) => {
      const d = Math.max(Math.abs(u - 0.5), Math.abs(v - 0.5));
      const band = Math.floor(d * 14) % 2;
      const n = Math.random() * 18;
      o[0] = (band ? 54 : 132) + n; o[1] = (band ? 74 : 46) + n; o[2] = (band ? 110 : 52) + n;
    });
    K.mesh(new T.PlaneGeometry(420, 300), K.std({ map: TX.toTexture(rugC, { wrap: false }), roughness: 1 }), 0, -75.8, 0, { rx: -Math.PI / 2, cast: false });

    // gingham tablecloth
    const ging = TX.ginghamTextures({ size: 1024, checks: 8, color: 0xc0393b, base: 0xfaf5ea });
    for (const t of Object.values(ging)) t.repeat.set(220 / 26, 150 / 26);
    const clothMat = K.std({ map: ging.map, normalMap: ging.normalMap, roughness: 0.92, normalScale: new T.Vector2(0.8, 0.8) });
    const cloth = K.mesh(new T.BoxGeometry(220, 0.18, 150), clothMat, 0, 0.09, 0, { ry: 0.035, cast: false });
    // hem around the cloth
    const hemMat = K.std({ color: 0xb8302f, roughness: 0.9 });
    const hemGeo = new T.BoxGeometry(221, 0.3, 1.2);
    for (const s of [-1, 1]) {
      const h = new T.Mesh(hemGeo, hemMat); h.position.set(0, 0.1, s * 74.6); cloth.add(h);
      const v = new T.Mesh(new T.BoxGeometry(1.2, 0.3, 150), hemMat); v.position.set(s * 109.6, 0.1, 0); cloth.add(v);
    }

    const Y0 = 0.2; // top of the cloth; props sit at ~0.2 on the cloth, 0 on the wood
    const onCloth = (x, z) => {
      const c = Math.cos(-0.035), s = Math.sin(-0.035);
      const lx = x * c - z * s, lz = x * s + z * c;
      return Math.abs(lx) < 110 && Math.abs(lz) < 75;
    };
    const gy = (x, z) => (onCloth(x, z) ? Y0 : 0);

    // ---------------- track markings: cereal loops along both edges ----------------
    const loopGeo = new T.TorusGeometry(0.62, 0.27, 6, 14);
    loopGeo.rotateX(Math.PI / 2);
    const sugar = TX.mottledTextures({ size: 128, a: 0xffffff, b: 0xd8d0c0, seed: 31, period: 32, bump: 3 });
    const loopMat = K.phys({ color: 0xffffff, roughness: 0.62, normalMap: sugar.normalMap, normalScale: new T.Vector2(0.6, 0.6), clearcoat: 0.25, clearcoatRoughness: 0.5 });
    const loopColors = [0xe8443a, 0xf59a23, 0xf5d331, 0x6fc04b, 0x9a5cc7, 0xf27aa8];
    const loops = [];
    for (const side of [-1, 1]) {
      for (const p of track.edgePoints(side, 2.15, 0.9)) {
        const jitter = r.range(-0.25, 0.25);
        const x = p.x + Math.cos(p.angle + Math.PI / 2) * jitter, z = p.z + Math.sin(p.angle + Math.PI / 2) * jitter;
        loops.push({ x, y: gy(x, z) + 0.27, z, ry: r() * 6.28, rx: r.range(-0.12, 0.12), rz: r.range(-0.12, 0.12), s: r.range(0.88, 1.1), color: r.pick(loopColors) });
      }
    }
    K.instances(loopGeo, loopMat, loops, { colors: true });

    // start / finish: a strip of checkered paper napkin across the road
    {
      const s0 = 40;
      const c = TX.makeCanvas(256, 64);
      const g = c.getContext('2d');
      for (let y = 0; y < 4; y++) for (let x = 0; x < 16; x++) { g.fillStyle = (x + y) % 2 ? '#1b1b1b' : '#f7f4ec'; g.fillRect(x * 16, y * 16, 16, 16); }
      const mat = K.std({ map: TX.toTexture(c, { wrap: false }), roughness: 0.8 });
      const p = track.at(s0);
      const m = K.mesh(new T.PlaneGeometry(14.5, 3.6), mat, p.x, gy(p.x, p.z) + 0.05, p.z, { rx: -Math.PI / 2, cast: false });
      m.rotation.order = 'YXZ'; m.rotation.y = -p.angle + Math.PI / 2; m.rotation.x = -Math.PI / 2;
    }

    // ---------------- shared materials ----------------
    const white = K.ceramic(0xf8f6f0);
    const metal = K.metal(0xe4e6ea, 0.16);

    // ---------------- cereal bowl ----------------
    const bowl = (cx, cz, sc = 0.72) => {
      const prof0 = [[0, 0.4], [8.5, 0.4], [9.5, 0], [11, 0], [11.6, 0.9], [15.5, 3.4], [18.8, 7], [20.6, 10.4], [21.2, 11.9], [20.9, 12.3], [20.4, 12.1], [19.9, 11.2], [18.1, 7.4], [14.5, 3.9], [9.5, 2.3], [0, 2.0]];
      const prof = prof0.map(([a, b]) => [a * sc, b * sc]);
      const g = K.lathe(prof, 72);
      // blue band just under the rim on the outside
      const col = new Float32Array(g.attributes.position.count * 3);
      const pos = g.attributes.position;
      const c1 = new T.Color(0xf8f6f0), c2 = new T.Color(0x2b5ea8);
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i), rr = Math.hypot(pos.getX(i), pos.getZ(i));
        const band = y > 8.6 * sc && y < 10.6 * sc && rr > 19.2 * sc;
        const c = band ? c2 : c1;
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
      g.setAttribute('color', new T.BufferAttribute(col, 3));
      const mat = K.ceramic(0xffffff, { vertexColors: true });
      const b = K.mesh(g, mat, cx, Y0, cz);
      // milk + floating cereal
      const milkMat = K.liquid(0xfbf7ee, { roughness: 0.18, sheen: 1, sheenColor: new T.Color(0xffffff) });
      K.mesh(new T.CircleGeometry(19.2 * sc, 64), milkMat, cx, Y0 + 9.0 * sc, cz, { rx: -Math.PI / 2 });
      const floating = [];
      for (let i = 0; i < 44; i++) {
        const a = r() * 6.28, d = Math.sqrt(r()) * 17.5 * sc;
        floating.push({ x: cx + Math.cos(a) * d, y: Y0 + 9.0 * sc + 0.2, z: cz + Math.sin(a) * d, ry: r() * 6.28, rx: r.range(-0.4, 0.4), rz: r.range(-0.4, 0.4), s: r.range(0.9, 1.15), color: r.pick(loopColors) });
      }
      K.instances(loopGeo, loopMat, floating, { colors: true });
      K.contact(cx, cz, 15 * sc, 15 * sc, 0.5);
      K.circle(cx, cz, 21.2 * sc, 12.5 * sc);
      // spoon resting in the bowl
      const sp = spoon(1.1);
      sp.position.set(cx + 7, Y0 + 7.0, cz - 4.5);
      sp.rotation.set(0, 0.6, 0.42);
      K.add(sp);
    };

    const spoon = (scale = 1) => {
      const g = new T.Group();
      const hs = new T.Shape();
      hs.moveTo(0, -0.35);
      hs.bezierCurveTo(4, -0.42, 8, -0.75, 11.5, -0.85);
      hs.bezierCurveTo(13, -0.9, 13.2, 0.9, 11.5, 0.85);
      hs.bezierCurveTo(8, 0.75, 4, 0.42, 0, 0.35);
      hs.closePath();
      const hg = new T.ExtrudeGeometry(hs, { depth: 0.18, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2 });
      hg.rotateX(-Math.PI / 2);
      const h = new T.Mesh(hg, metal); h.position.set(0.5, 0.2, 0); g.add(h);
      const bg = new T.SphereGeometry(1, 28, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
      const bm = new T.Mesh(bg, K.metal(0xe4e6ea, 0.12, { side: T.DoubleSide }));
      bm.scale.set(3.4, 1.0, 2.3); bm.position.set(-2.4, 1.1, 0);
      g.add(bm);
      g.scale.setScalar(scale);
      return g;
    };

    // ---------------- toast ----------------
    const toastTex = (() => {
      const c = TX.paint(256, 256, (x, y, u, v, o) => {
        const dx = u - 0.5, dy = v - 0.5;
        const d = Math.max(Math.abs(dx) * 1.0, Math.abs(dy) * 1.0);
        const n = Math.random();
        const pore = n < 0.06 ? 0.55 : n < 0.2 ? 0.85 : 1;
        const brown = 0.55 + d * 0.55;
        o[0] = Math.min(255, 240 * (1.05 - brown * 0.45) * pore);
        o[1] = Math.min(255, 190 * (1.02 - brown * 0.55) * pore);
        o[2] = Math.min(255, 110 * (1.0 - brown * 0.7) * pore);
      });
      const t = TX.toTexture(c, { wrap: false });
      t.repeat.set(1 / 13, 1 / 13); t.offset.set(0.5, 0.42);
      return t;
    })();
    const toastFace = K.std({ map: toastTex, roughness: 0.9 });
    const crust = K.std({ color: 0x7a4419, roughness: 0.85 });
    const toastGeo = (() => {
      const s = new T.Shape();
      s.moveTo(-5, -5); s.lineTo(5, -5); s.lineTo(5, 2.8);
      s.bezierCurveTo(6.6, 4.4, 5.6, 6.6, 3.2, 6.4);
      s.bezierCurveTo(2, 7.2, -2, 7.2, -3.2, 6.4);
      s.bezierCurveTo(-5.6, 6.6, -6.6, 4.4, -5, 2.8);
      s.closePath();
      const g = new T.ExtrudeGeometry(s, { depth: 0.9, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.35, bevelSegments: 3, curveSegments: 10 });
      g.translate(0, -0.7, -0.45);
      return g;
    })();
    const toast = (x, y, z, ry, tilt = 0) => {
      const m = new T.Mesh(toastGeo, [toastFace, crust]);
      const grp = new T.Group();
      m.rotation.x = -Math.PI / 2;
      grp.add(m);
      grp.position.set(x, y, z); grp.rotation.order = 'YXZ'; grp.rotation.y = ry; grp.rotation.x = tilt;
      return K.add(grp);
    };

    // butter
    const butterMat = K.phys({ color: 0xf6e3a0, roughness: 0.32, clearcoat: 0.4, sheen: 0.4, sheenColor: new T.Color(0xfff6c8) });

    // ---------------- ramp: toast leaning on a butter block, over spilt milk ----------------
    {
      const s = 98; // along the bottom straight
      const p = track.place(s, -3.2);
      const len = 11, hgt = 3.3;
      const ang = p.angle;
      K.ramp(p.x, p.z, ang, len, 9.2, hgt, Y0);
      // toast slab follows the ramp
      const grp = new T.Group();
      const m = new T.Mesh(toastGeo, [toastFace, crust]);
      m.rotation.x = -Math.PI / 2; m.rotation.z = -Math.PI / 2; // long axis along local x
      m.position.y = -0.35;
      grp.add(m);
      grp.position.set(p.x, Y0 + hgt / 2, p.z);
      grp.rotation.order = 'YZX';
      grp.rotation.y = -ang;
      grp.rotation.z = Math.atan2(hgt, len);
      grp.scale.set(len / 12.3, 1, 9.4 / 10.8);
      K.add(grp);
      // butter block holding the top end up
      const bx = p.x + Math.cos(ang) * (len / 2 - 1.2), bz = p.z + Math.sin(ang) * (len / 2 - 1.2);
      K.mesh(new K.RoundedBoxGeometry(3.2, 3.1, 6.4, 3, 0.35), butterMat, bx, Y0 + 1.55, bz, { ry: -ang });
      // no collider for the butter: it sits under the toast, and the ramp's raised end already blocks cars from behind
      K.contact(p.x, p.z, 7, 5.5, 0.3, ang);
      // spilt milk just past the ramp, across the whole road
      const mp = track.place(s + 22, 0.5);
      const milkMat = K.phys({ color: 0xf3f6fa, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.0, transparent: true, opacity: 0.9, sheen: 0.6, sheenColor: new T.Color(0xdde8ff), envMapIntensity: 1.4 });
      const milk = K.spill(mp.x, mp.z, 9.5, milkMat, { lump: 0.3, stretch: 1.5, angle: mp.angle, y: Y0 + 0.08, thick: 0.25 });
      K.surface('slick', { poly: milk.poly });
      // drip trail of milk
      for (let i = 0; i < 5; i++) {
        const q = track.place(s + 36 + i * 3.2, r.range(-4, 5));
        K.spill(q.x, q.z, r.range(0.8, 1.6), milkMat, { y: Y0 + 0.06, thick: 0.18, n: 20 });
      }
    }

    // ---------------- plate with fried egg & toast (left infield) ----------------
    {
      const cx = -70, cz = 14;
      const PS = 0.66;
      const prof = [[0, 0.3], [14, 0.3], [15, 0], [16.5, 0], [17, 0.6], [22.5, 1.4], [24.4, 2.2], [24.6, 2.5], [24.2, 2.55], [22, 1.9], [16.6, 1.1], [0, 1.0]].map(([a, b]) => [a * PS, b]);
      const g = K.lathe(prof, 80);
      const col = new Float32Array(g.attributes.position.count * 3);
      const pos = g.attributes.position;
      const a = new T.Color(0xf8f6f0), b = new T.Color(0x24508f);
      for (let i = 0; i < pos.count; i++) {
        const rr = Math.hypot(pos.getX(i), pos.getZ(i));
        const c = rr > 23.0 * PS && rr < 23.9 * PS ? b : a;
        col.set([c.r, c.g, c.b], i * 3);
      }
      g.setAttribute('color', new T.BufferAttribute(col, 3));
      // rattan placemat under it
      const matC = TX.paint(512, 512, (x, y, u, v, o) => {
        const dx = u - 0.5, dy = v - 0.5;
        const rr = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
        const ring = Math.sin(rr * 260) * 0.5 + 0.5;
        const weave = Math.sin(ang * 90 + Math.floor(rr * 40) * 1.3) * 0.5 + 0.5;
        const t = 0.6 + 0.25 * ring + 0.15 * weave;
        o[0] = 190 * t; o[1] = 150 * t; o[2] = 96 * t;
        o[3] = rr < 0.5 ? 255 : 0;
      });
      K.mesh(new T.CylinderGeometry(22, 22, 0.3, 72), K.std({ color: 0x9b7444, roughness: 0.95 }), cx, Y0 + 0.0, cz, { cast: false });
      K.mesh(new T.CircleGeometry(22, 72), K.std({ map: TX.toTexture(matC, { wrap: false }), roughness: 0.95 }), cx, Y0 + 0.17, cz, { rx: -Math.PI / 2, cast: false });
      K.mesh(g, K.ceramic(0xffffff, { vertexColors: true }), cx, Y0 + 0.3, cz);
      K.contact(cx, cz, 18, 18, 0.4);
      K.circle(cx, cz, 16.5, 2.9);
      // fried egg
      const eggWhite = K.phys({ color: 0xfffdf6, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1, sheen: 0.5 });
      K.spill(cx - 3.5, cz + 3, 5.4, eggWhite, { lump: 0.42, y: Y0 + 1.6, thick: 0.35 });
      const yolk = K.mesh(new T.SphereGeometry(2.1, 32, 20), K.phys({ color: 0xffa312, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05 }), cx - 4, Y0 + 1.8, cz + 2.4);
      yolk.scale.set(1, 0.5, 1);
      // toast on the plate
      toast(cx + 6.5, Y0 + 1.75, cz - 4, 0.5, 0);
      // pepper flecks on the egg
      const fl = [];
      for (let i = 0; i < 24; i++) fl.push({ x: cx - 3.5 + r.range(-4, 4), y: Y0 + 2.0, z: cz + 3 + r.range(-4, 4), s: r.range(0.08, 0.16) });
      K.instances(new T.IcosahedronGeometry(1, 0), K.std({ color: 0x1a1612, roughness: 0.9 }), fl, { cast: false });
    }

    // ---------------- bowl (right infield) ----------------
    bowl(58, 4);

    // ---------------- jam jar in the hairpin + sticky spill ----------------
    const jamMat = K.phys({ color: 0x7c0814, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.03 });
    {
      const cx = -7, cz = -38;
      const J = 0.72;
      const glassProf0 = [[6.6, 0], [7.2, 0.4], [7.4, 1.2], [7.4, 10.5], [6.6, 11.6], [6.0, 12.2], [6.0, 13.6], [5.6, 13.6], [5.6, 12.4], [6.8, 11.4], [7.0, 10.4], [7.0, 1.2], [6.6, 0.7], [0, 0.6]];
      const glassProf = glassProf0.map(([a, b]) => [a * J, b * J]);
      K.mesh(K.lathe(glassProf, 48), K.glass(0xfff4f0, 0.12), cx, Y0, cz, { cast: false });
      K.mesh(new T.CylinderGeometry(6.8 * J, 6.8 * J, 8.8 * J, 40), jamMat, cx, Y0 + 5.0 * J, cz);
      // label
      const lc = TX.makeCanvas(512, 128);
      const lg = lc.getContext('2d');
      lg.fillStyle = '#f4ead2'; lg.fillRect(0, 0, 512, 128);
      lg.strokeStyle = '#8f0d1a'; lg.lineWidth = 6; lg.strokeRect(6, 6, 500, 116);
      lg.fillStyle = '#7a0b16'; lg.font = 'italic 700 46px Georgia, serif'; lg.textAlign = 'center';
      lg.fillText('Strawberry', 128, 62); lg.fillText('Strawberry', 384, 62);
      lg.font = '22px Georgia, serif'; lg.fillText('homemade jam', 128, 98); lg.fillText('homemade jam', 384, 98);
      const lt = TX.toTexture(lc, { wrap: true });
      const label = K.mesh(new T.CylinderGeometry(7.45 * J, 7.45 * J, 5 * J, 48, 1, true), K.std({ map: lt, roughness: 0.7 }), cx, Y0 + 5.2 * J, cz);
      // lid lying beside, gingham fabric top
      const lidC = TX.paint(128, 128, (x, y, u, v, o) => { const a = Math.floor(u * 8) % 2, b = Math.floor(v * 8) % 2; const t = (a + b) / 2; o[0] = 250 - t * 60; o[1] = 245 - t * 200; o[2] = 235 - t * 190; });
      K.mesh(new T.CylinderGeometry(4.7, 4.7, 1.3, 40), K.metal(0xd8c9a0, 0.3), cx + 8.5, Y0 + 0.65, cz - 3);
      K.mesh(new T.CircleGeometry(4.8, 40), K.std({ map: TX.toTexture(lidC), roughness: 0.9 }), cx + 8.5, Y0 + 1.32, cz - 3, { rx: -Math.PI / 2 });
      K.contact(cx, cz, 6.4, 6.4, 0.5); K.contact(cx + 8.5, cz - 3, 5.2, 5.2, 0.4);
      K.circle(cx, cz, 5.4, 11); K.circle(cx + 8.5, cz - 3, 4.8, 1.4);
      // the sticky spill in the hairpin
      const sp = track.place(track.length ? 0 : 0, 0);
      const hp = nearestS(track, -8, -8);
      const q = track.place(hp, -1);
      const spill = K.spill(q.x, q.z, 8, jamMat, { lump: 0.45, stretch: 1.3, angle: q.angle + 0.6, y: Y0 + 0.1, thick: 0.25 });
      K.surface('sticky', { poly: spill.poly });
      // a few strawberry chunks in it
      for (let i = 0; i < 4; i++) {
        const m = K.mesh(new T.DodecahedronGeometry(0.9, 0), jamMat, q.x + r.range(-4, 4), Y0 + 0.4, q.z + r.range(-4, 4), { ry: r() * 6 });
        m.scale.y = 0.6;
      }
      // butter knife lying across
      const knife = new T.Group();
      const blade = new T.Mesh(new K.RoundedBoxGeometry(9, 0.25, 1.6, 2, 0.1), metal); blade.position.x = 4.5; knife.add(blade);
      const handle = new T.Mesh(new K.RoundedBoxGeometry(8.5, 0.9, 1.3, 3, 0.4), K.plastic(0x3a2a20, 0.4)); handle.position.x = -4; knife.add(handle);
      const jamOnBlade = new T.Mesh(new K.RoundedBoxGeometry(4, 0.2, 1.3, 2, 0.1), jamMat); jamOnBlade.position.set(6.5, 0.18, 0); knife.add(jamOnBlade);
      knife.position.set(cx - 9, Y0 + 0.5, cz + 2); knife.rotation.y = 1.2;
      K.add(knife);
    }

    // ---------------- juice glass (top right, inside the corner) ----------------
    {
      const cx = 86, cz = -36;
      const G = 0.7;
      const prof = [[5.6, 0], [6.4, 0.2], [6.6, 0.8], [7.3, 15.5], [7.4, 16], [7.0, 16], [6.2, 1.4], [0, 1.2]].map(([a, b]) => [a * G, b * 0.85]);
      K.mesh(K.lathe(prof, 48), K.glass(0xffffff, 0.2), cx, Y0, cz, { cast: false });
      const juice = K.phys({ color: 0xff9512, roughness: 0.12, transparent: true, opacity: 0.92, clearcoat: 1 });
      const jg = new T.CylinderGeometry(6.85 * G, 6.25 * G, 9, 40);
      K.mesh(jg, juice, cx, Y0 + 1.1 + 4.5, cz);
      K.mesh(new T.CircleGeometry(6.85 * G, 40), K.phys({ color: 0xffb03e, roughness: 0.3 }), cx, Y0 + 10.15, cz, { rx: -Math.PI / 2 });
      // striped straw
      const sc = TX.paint(64, 256, (x, y, u, v, o) => { const st = Math.floor(v * 16 + u * 2) % 2; o[0] = st ? 235 : 250; o[1] = st ? 60 : 250; o[2] = st ? 70 : 250; });
      const straw = K.mesh(new T.CylinderGeometry(0.4, 0.4, 19, 14), K.plastic(0xffffff, 0.3, { map: TX.toTexture(sc) }), cx + 1.8, Y0 + 10.5, cz - 0.8, { rz: -0.3, rx: 0.12 });
      K.contact(cx, cz, 6, 6, 0.45);
      K.circle(cx, cz, 5.3, 14);
      // orange light through the glass onto the table
      K.contact(cx + 4, cz + 4, 6, 4.5, 0.14, 0.7).material.color.set(0xff8a00);
    }

    // ---------------- coffee mug + ring stains (left top corner inside) ----------------
    {
      const cx = -96, cz = -30;
      const M = 0.74;
      const prof = [[5.6, 0], [6.6, 0.3], [7.4, 1.5], [7.5, 10], [7.6, 10.6], [7.0, 10.7], [6.8, 10], [6.8, 1.6], [0, 1.4]].map(([a, b]) => [a * M, b * M]);
      const mugMat = K.ceramic(0x2f7f86, { roughness: 0.2 });
      K.mesh(K.lathe(prof, 56), mugMat, cx, Y0, cz);
      K.mesh(new T.TorusGeometry(3.2 * M, 0.9 * M, 14, 28, Math.PI * 1.2), mugMat, cx + 7.6 * M, Y0 + 5.5 * M, cz, { rz: -Math.PI * 0.6 });
      K.mesh(new T.CircleGeometry(6.8 * M, 48), K.liquid(0x3a1f10, { roughness: 0.05 }), cx, Y0 + 8.8 * M, cz, { rx: -Math.PI / 2 });
      K.mesh(new T.RingGeometry(5.5 * M, 6.8 * M, 48), K.liquid(0x8a5a33, { roughness: 0.2 }), cx, Y0 + 8.8 * M + 0.02, cz, { rx: -Math.PI / 2 });
      K.contact(cx, cz, 7, 7, 0.45);
      K.circle(cx, cz, 5.7, 8.5); K.circle(cx + 7, cz, 1.8, 7);
      // coffee rings on the cloth
      const ringC = TX.makeCanvas(256);
      const rg = ringC.getContext('2d');
      rg.strokeStyle = 'rgba(110,60,25,0.55)'; rg.lineWidth = 10;
      rg.beginPath(); rg.arc(128, 128, 110, 0.3, 5.9); rg.stroke();
      rg.strokeStyle = 'rgba(110,60,25,0.25)'; rg.lineWidth = 22; rg.beginPath(); rg.arc(128, 128, 100, 0.2, 2.6); rg.stroke();
      const ringMat = K.std({ map: TX.toTexture(ringC, { wrap: false }), transparent: true, depthWrite: false, roughness: 0.9 });
      K.mesh(new T.PlaneGeometry(12, 12), ringMat, cx + 14, Y0 + 0.03, cz + 13, { rx: -Math.PI / 2, cast: false });
      K.mesh(new T.PlaneGeometry(12, 12), ringMat, cx - 4, Y0 + 0.03, cz + 22, { rx: -Math.PI / 2, cast: false });
    }

    // ---------------- croissant ----------------
    const croissant = (cx, cz, ry, sc = 1) => {
      const g = new T.Group();
      const c1 = K.phys({ color: 0xc9802f, roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.35 });
      const c2 = K.phys({ color: 0xa65f1c, roughness: 0.5, clearcoat: 0.6, clearcoatRoughness: 0.35 });
      const n = 7;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const a = -1.15 + t * 2.3;
        const rad = 7;
        const size = 1.4 + Math.sin(t * Math.PI) * 2.0;
        const m = new T.Mesh(new T.SphereGeometry(1, 24, 16), i % 2 ? c1 : c2);
        m.position.set(Math.sin(a) * rad, size * 0.75, -Math.cos(a) * rad + rad * 0.6);
        m.scale.set(size * 0.75, size * 0.8, size * 1.05);
        m.rotation.y = -a;
        g.add(m);
      }
      g.position.set(cx, Y0, cz); g.rotation.y = ry; g.scale.setScalar(sc);
      K.add(g);
      K.contact(cx, cz, 9 * sc, 6 * sc, 0.35, ry);
      return g;
    };
    croissant(-34, 36, 0.4, 1.0);
    K.circle(-34, 36, 6.5, 4);

    // ---------------- strawberries ----------------
    const berryMat = (() => {
      const c = TX.paint(256, 256, (x, y, u, v, o) => { o[0] = 205; o[1] = 22; o[2] = 38; });
      const g = c.getContext('2d');
      for (let i = 0; i < 160; i++) {
        const x = (i % 16) * 16 + ((Math.floor(i / 16) % 2) * 8), y = Math.floor(i / 16) * 26 + 6;
        g.fillStyle = '#f6d26a'; g.beginPath(); g.ellipse(x, y, 2.2, 3.4, 0, 0, 6.28); g.fill();
        g.fillStyle = 'rgba(80,0,10,0.5)'; g.beginPath(); g.ellipse(x, y + 1, 3.5, 4.5, 0, 0, 6.28); g.globalCompositeOperation = 'destination-over'; g.fill(); g.globalCompositeOperation = 'source-over';
      }
      return K.phys({ map: TX.toTexture(c), roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.15 });
    })();
    const leafMat = K.std({ color: 0x3f8a2e, roughness: 0.6, side: T.DoubleSide });
    const strawberry = (x, z, ry, sc = 1, lying = true) => {
      const g = new T.Group();
      const prof = [];
      for (let i = 0; i <= 14; i++) {
        const t = i / 14;
        const rr = Math.sin(t * Math.PI * 0.92) * (0.55 + 0.45 * t) * 2.2;
        prof.push([Math.max(0.001, rr), t * 4.2]);
      }
      prof.push([0.001, 4.2]);
      const body = new T.Mesh(K.lathe(prof, 32), berryMat);
      g.add(body);
      const star = new T.Shape();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2, rr = i % 2 ? 0.7 : 2.0;
        if (i === 0) star.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else star.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      const leaf = new T.Mesh(new T.ShapeGeometry(star), leafMat);
      leaf.rotation.x = -Math.PI / 2; leaf.position.y = 4.15; g.add(leaf);
      const stem = new T.Mesh(new T.CylinderGeometry(0.18, 0.25, 1.2, 8), leafMat); stem.position.y = 4.7; g.add(stem);
      g.scale.setScalar(sc);
      if (lying) g.rotation.set(0, 0, Math.PI / 2 - 0.15);
      const holder = new T.Group();
      holder.add(g);
      if (lying) g.position.y = 1.9 * sc;
      holder.position.set(x, Y0, z); holder.rotation.y = ry;
      K.add(holder);
      K.contact(x, z, 2.6 * sc, 2.2 * sc, 0.35);
      return g;
    };
    strawberry(38, 84, 0.3); strawberry(44, 87, 2.1, 0.9); strawberry(30, 88, 4.2, 1.05);
    strawberry(131, 40, 1.3); strawberry(-12, 18, 0.9, 0.95);
    K.circle(-12, 18, 2.4, 4.2);

    // ---------------- sugar cubes (pushable!) ----------------
    {
      const st = TX.mottledTextures({ size: 128, a: 0xffffff, b: 0xe9e4da, seed: 41, period: 24, bump: 5 });
      const cubeMat = K.phys({ color: 0xffffff, roughness: 0.55, normalMap: st.normalMap, normalScale: new T.Vector2(1.2, 1.2), sheen: 0.6, sheenColor: new T.Color(0xffffff) });
      const geo = new K.RoundedBoxGeometry(2.6, 2.6, 2.6, 2, 0.28);
      const spots = [
        [track.place(150, 2.5)], [track.place(158, -3.5)], [track.place(330, 2)], [track.place(520, -2)], [track.place(700, 3)],
      ];
      // a little sugar bowl's worth near the top straight
      const extra = [[60, -82], [66, -84], [63, -79], [-60, 82], [-118, 70]];
      const all = spots.map((s) => [s[0].x, s[0].z]).concat(extra);
      for (const [x, z] of all) {
        const m = K.mesh(geo, cubeMat, x, Y0 + 1.3, z, { ry: r() * 6 });
        K.physics.addDynamic({ x, z, r: 1.55, m: 0.7, h: 2.6, mesh: m, slide: true, friction: 26, baseY: gy(x, z) + 1.3 });
      }
    }

    // ---------------- salt & pepper ----------------
    const shaker = (x, z, color, holes) => {
      const prof = [[2.4, 0], [2.6, 0.3], [2.6, 5.5], [2.2, 6.6], [2.1, 7.2]];
      const body = K.mesh(K.lathe(prof, 32), K.ceramic(color), x, Y0, z);
      const cap = K.mesh(new T.SphereGeometry(2.15, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), metal, x, Y0 + 7.1, z);
      cap.scale.y = 0.6;
      K.contact(x, z, 3.2, 3.2, 0.45);
      K.circle(x, z, 2.7, 9);
    };
    shaker(136, -8, 0xfbfbf8); shaker(140, 0, 0x2a2a2a);

    // ---------------- egg cup ----------------
    {
      const x = 22, z = 30;
      K.mesh(K.lathe([[3.2, 0], [3.4, 0.5], [1.4, 2.0], [1.4, 3.4], [3.2, 4.6], [3.9, 7.0], [3.6, 7.1], [2.9, 5.2], [0, 4.8]], 36), K.ceramic(0xf2d64b), x, Y0, z);
      const egg = K.mesh(new T.SphereGeometry(2.7, 28, 20), K.phys({ color: 0xe9c9a2, roughness: 0.5, clearcoat: 0.2 }), x, Y0 + 8.5, z);
      egg.scale.set(1, 1.3, 1);
      K.contact(x, z, 4.5, 4.5, 0.45);
      K.circle(x, z, 3.9, 12);
    }

    // ---------------- folded napkin + knife (bottom left, outside the track) ----------------
    {
      const nc = TX.paint(256, 256, (x, y, u, v, o) => { const w = (Math.sin(x * 1.6) + Math.sin(y * 1.6)) * 4; o[0] = 236 + w; o[1] = 233 + w; o[2] = 222 + w; });
      const nap = K.mesh(new K.RoundedBoxGeometry(22, 1.0, 13, 3, 0.45), K.std({ map: TX.toTexture(nc), roughness: 0.95, color: 0xfafaf5 }), -100, Y0 + 0.5, 84, { ry: -0.15 });
      const knife = new T.Group();
      const blade = new T.Mesh(new K.RoundedBoxGeometry(10, 0.25, 1.6, 2, 0.1), metal); blade.position.x = 5; knife.add(blade);
      const handle = new T.Mesh(new K.RoundedBoxGeometry(9, 0.8, 1.2, 3, 0.35), metal); handle.position.x = -4.5; knife.add(handle);
      knife.position.set(-100, Y0 + 1.4, 84); knife.rotation.y = -0.1;
      K.add(knife);
      K.contact(-100, 84, 12, 8, 0.3, -0.15);
    }

    // ---------------- newspaper under the top straight ----------------
    {
      const c = TX.makeCanvas(1024, 768);
      const g = c.getContext('2d');
      g.fillStyle = '#ece6d6'; g.fillRect(0, 0, 1024, 768);
      g.fillStyle = '#1d1d1d'; g.font = '700 74px Georgia, serif'; g.textAlign = 'center';
      g.fillText('The Morning Crumb', 512, 92);
      g.fillRect(40, 112, 944, 4); g.fillRect(40, 122, 944, 1.5);
      g.font = '700 46px Georgia, serif'; g.textAlign = 'left';
      g.fillText('Tiny cars spotted on kitchen table', 48, 186);
      g.fillStyle = '#9c9488'; g.fillRect(48, 214, 420, 260);
      const rr = (a, b) => a + Math.random() * (b - a);
      g.fillStyle = '#3a3a3a';
      for (let col = 0; col < 4; col++) {
        const x0 = col < 2 ? 500 + col * 250 : 48 + (col - 2) * 250, y0 = col < 2 ? 214 : 500;
        for (let ln = 0; ln < (col < 2 ? 22 : 11); ln++) g.fillRect(x0, y0 + ln * 22, ln % 7 === 6 ? rr(60, 150) : rr(200, 228), 6);
      }
      const t = TX.toTexture(c, { wrap: false });
      const paper = K.std({ map: t, roughness: 0.92, side: T.DoubleSide });
      const m = K.mesh(new T.PlaneGeometry(46, 34.5, 1, 1), paper, -60, Y0 + 0.06, -76, { rx: -Math.PI / 2, cast: false });
      m.rotation.z = 0.12;
    }

    // ---------------- cereal box & milk bottle at the back edge ----------------
    {
      const c = TX.makeCanvas(512, 720);
      const g = c.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 0, 720); gr.addColorStop(0, '#ffcf3a'); gr.addColorStop(1, '#ff8a1e');
      g.fillStyle = gr; g.fillRect(0, 0, 512, 720);
      g.save(); g.translate(256, 470);
      for (let i = 0; i < 24; i++) { g.rotate(Math.PI / 12); g.fillStyle = i % 2 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(600, -80); g.lineTo(600, 80); g.fill(); }
      g.restore();
      g.fillStyle = '#c3162a'; g.font = '110px "Lilita One", Impact, sans-serif'; g.textAlign = 'center';
      g.lineWidth = 14; g.strokeStyle = '#fff'; g.strokeText('CRUNCHY', 256, 150); g.fillText('CRUNCHY', 256, 150);
      g.font = '150px "Lilita One", Impact, sans-serif'; g.strokeText("O's", 256, 290); g.fillText("O's", 256, 290);
      g.fillStyle = '#2b5ea8'; g.beginPath(); g.ellipse(256, 560, 190, 70, 0, 0, Math.PI); g.fill();
      g.fillStyle = '#fffdf3'; g.beginPath(); g.ellipse(256, 560, 190, 40, 0, 0, Math.PI * 2); g.fill();
      const lc = ['#e8443a', '#f59a23', '#f5d331', '#6fc04b', '#9a5cc7'];
      for (let i = 0; i < 26; i++) { g.strokeStyle = lc[i % 5]; g.lineWidth = 12; g.beginPath(); g.arc(120 + Math.random() * 270, 520 + Math.random() * 50, 16, 0, 6.28); g.stroke(); }
      g.fillStyle = '#7a1010'; g.font = '700 30px Rubik, sans-serif'; g.fillText('NOW WITH MORE CRUNCH', 256, 380);
      const front = K.std({ map: TX.toTexture(c, { wrap: false }), roughness: 0.6 });
      const side = K.std({ color: 0xffa42a, roughness: 0.6 });
      const topm = K.std({ color: 0xffc23a, roughness: 0.6 });
      const box = K.mesh(new T.BoxGeometry(28, 40, 9), [side, side, topm, side, front, side], -128, 20, -86, { ry: 0.12 });
      K.contact(-128, -86, 16, 6, 0.5, 0.12);
      // milk bottle
      const prof = [[5.5, 0], [6, 0.5], [6, 15], [5.2, 18], [3.3, 21], [3.0, 25], [3.2, 25.6], [2.6, 25.8]];
      K.mesh(K.lathe(prof, 40), K.glass(0xffffff, 0.3), 122, Y0, -82, { cast: false });
      K.mesh(new T.CylinderGeometry(5.7, 5.7, 14, 36), K.phys({ color: 0xfbf8f0, roughness: 0.25, clearcoat: 0.5, sheen: 1 }), 122, Y0 + 7.3, -82);
      K.mesh(new T.CylinderGeometry(3.3, 3.3, 1.2, 28), K.metal(0x3d6fd1, 0.35), 122, Y0 + 25.6, -82);
      K.contact(122, -82, 7.5, 7.5, 0.5);
    }


    // ---------------- fruit: banana, oranges (they roll!), apple ----------------
    {
      // banana: five-sided tube along a gentle arc, tapering, with brown tips
      const banana = (cx, cz, ry) => {
        const pts = [];
        for (let i = 0; i <= 10; i++) { const t = i / 10, a = -0.75 + t * 1.5; pts.push(new T.Vector3(Math.sin(a) * 14, 0, -Math.cos(a) * 14 + 14)); }
        const curve = new T.CatmullRomCurve3(pts);
        const segs = 48, rad = 10;
        const pos = [], col = [], idx = [];
        const yellow = new T.Color(0xf6d23a), green = new T.Color(0xb9c84a), brown = new T.Color(0x5a3a18), c = new T.Color();
        for (let i = 0; i <= segs; i++) {
          const t = i / segs;
          const p = curve.getPointAt(t), tan = curve.getTangentAt(t);
          const nrm = new T.Vector3(-tan.z, 0, tan.x).normalize(), up = new T.Vector3(0, 1, 0);
          const R = 2.1 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.04 + t * 0.94)), 0.55) + 0.25;
          for (let j = 0; j <= rad; j++) {
            const a = (j / rad) * Math.PI * 2;
            const ridge = 1 + 0.06 * Math.cos(a * 5);
            const off = nrm.clone().multiplyScalar(Math.cos(a) * R * ridge).add(up.clone().multiplyScalar(Math.sin(a) * R * ridge * 0.92));
            pos.push(p.x + off.x, p.y + off.y + R, p.z + off.z);
            const tip = Math.min(t, 1 - t);
            c.copy(yellow).lerp(green, Math.max(0, 0.25 - t) * 2).lerp(brown, tip < 0.05 ? 1 - tip / 0.05 : (Math.random() < 0.015 ? 0.6 : 0));
            col.push(c.r, c.g, c.b);
          }
        }
        for (let i = 0; i < segs; i++) for (let j = 0; j < rad; j++) {
          const a = i * (rad + 1) + j, b2 = a + rad + 1;
          idx.push(a, b2, a + 1, b2, b2 + 1, a + 1);
        }
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
        g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
        g.setIndex(idx); g.computeVertexNormals();
        const m = K.mesh(g, K.phys({ vertexColors: true, roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.4 }), cx, Y0, cz, { ry });
        // colliders along the arc
        for (let i = 1; i < 10; i += 2) {
          const q = curve.getPointAt(i / 10).applyAxisAngle(new T.Vector3(0, 1, 0), ry);
          K.circle(cx + q.x, cz + q.z, 2.3, 4.4);
        }
        K.contact(cx + Math.sin(ry) * 0, cz, 14, 5, 0.3, -ry);
        return m;
      };
      banana(60, 40, 0.3);
      // oranges: pushable, they roll away when you hit them
      const peel = TX.mottledTextures({ size: 256, a: 0xf58b10, b: 0xe2730a, seed: 77, period: 48, bump: 6, speck: 0.08 });
      const orangeMat = K.phys({ map: peel.map, normalMap: peel.normalMap, normalScale: new T.Vector2(1.2, 1.2), roughness: 0.48, clearcoat: 0.5, clearcoatRoughness: 0.35 });
      for (const [x, z] of [[78, 22], [40, -22]]) {
        const grp = new T.Group();
        const o = new T.Mesh(new T.SphereGeometry(3.7, 36, 24), orangeMat); grp.add(o);
        const navel = new T.Mesh(new T.SphereGeometry(0.5, 10, 8), K.std({ color: 0x6f6a2a, roughness: 0.8 })); navel.position.y = 3.55; grp.add(navel);
        grp.position.set(x, Y0 + 3.7, z);
        K.add(grp);
        K.physics.addDynamic({ x, z, r: 3.7, m: 2.2, h: 7.4, mesh: grp, friction: 5, baseY: Y0 + 3.7 });
      }
      // apple
      {
        const prof = [];
        for (let i = 0; i <= 20; i++) {
          const t = i / 20, a = t * Math.PI;
          prof.push([Math.max(0.01, Math.sin(a) * 3.9 * (1 - 0.18 * Math.pow(Math.cos(a), 2))), 3.7 - Math.cos(a) * 3.5 + (t > 0.92 ? -0.6 : 0)]);
        }
        const g = K.lathe(prof, 40);
        const col = []; const pos = g.attributes.position; const cc = new T.Color();
        for (let i = 0; i < pos.count; i++) {
          const ang = Math.atan2(pos.getZ(i), pos.getX(i));
          const k = 0.5 + 0.5 * Math.sin(ang * 1.0 + 0.6) + (Math.random() - 0.5) * 0.08;
          cc.set(0xb5121b).lerp(new T.Color(0x9cc63b), Math.max(0, k - 0.45));
          col.push(cc.r, cc.g, cc.b);
        }
        g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
        K.mesh(g, K.phys({ vertexColors: true, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2 }), -40, Y0, -6);
        K.mesh(new T.CylinderGeometry(0.15, 0.22, 2.2, 6), K.std({ color: 0x5a3a1a, roughness: 0.8 }), -40, Y0 + 7.6, -6, { rz: 0.3 });
        K.contact(-40, -6, 4.6, 4.6, 0.45);
        K.circle(-40, -6, 3.9, 7.5);
      }
    }

    // ---------------- honey pot + sticky honey at the bottom-left corner ----------------
    {
      const cx = -98, cz = 36;
      const honey = K.phys({ color: 0xd98a0b, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, opacity: 0.93 });
      const prof = [[3.5, 0], [4.6, 0.6], [5.6, 3], [5.6, 6.5], [4.2, 8.2], [3.9, 8.8], [4.3, 9.3], [3.8, 9.5], [3.4, 8.9], [3.4, 1.0], [0, 0.9]];
      K.mesh(K.lathe(prof, 40), K.ceramic(0xe9b44a, { roughness: 0.3 }), cx, Y0, cz);
      K.mesh(new T.CircleGeometry(3.45, 32), honey, cx, Y0 + 8.4, cz, { rx: -Math.PI / 2 });
      // wooden dipper
      const dip = new T.Group();
      const stick = new T.Mesh(new T.CylinderGeometry(0.35, 0.35, 13, 10), K.std({ color: 0xb48a58, roughness: 0.7 }));
      stick.position.y = 6.5; dip.add(stick);
      for (let i = 0; i < 4; i++) { const ring = new T.Mesh(new T.CylinderGeometry(1.1 - i * 0.12, 1.1 - i * 0.12, 0.5, 14), K.std({ color: 0xa47a48, roughness: 0.65 })); ring.position.y = 0.6 + i * 0.75; dip.add(ring); }
      dip.position.set(cx + 0.5, Y0 + 5, cz - 0.5); dip.rotation.set(0.15, 0, -0.45);
      K.add(dip);
      K.contact(cx, cz, 6.5, 6.5, 0.45);
      K.circle(cx, cz, 5.6, 9.5);
      const hs = track.distTo(-112, 48).s;
      const q = track.place(hs, 1.5);
      const spill = K.spill(q.x, q.z, 7.5, honey, { lump: 0.4, stretch: 1.6, angle: q.angle, y: (onCloth(q.x, q.z) ? Y0 : 0) + 0.1, thick: 0.25 });
      K.surface('sticky', { poly: spill.poly });
      // honey drips leading to it from the pot
      for (let i = 1; i < 4; i++) K.spill(cx + (q.x - cx) * i / 4 + r.range(-1, 1), cz + (q.z - cz) * i / 4 + r.range(-1, 1), r.range(0.7, 1.3), honey, { y: Y0 + 0.08, thick: 0.15, n: 18 });
    }

    // ---------------- crumbs scattered around ----------------
    {
      const list = [];
      const centres = [[-62, 6, 30, 60], [-20, 60, 25, 25], [70, 70, 30, 30], [-115, 10, 30, 25], [10, -75, 40, 14]];
      for (const [cx, cz, sx, sz, n] of centres.map((c) => [...c, 0])) {
        for (let i = 0; i < 45; i++) {
          const x = cx + r.gauss() * sx * 0.4, z = cz + r.gauss() * sz * 0.4;
          list.push({ x, y: gy(x, z) + 0.2, z, s: r.range(0.18, 0.5), ry: r() * 6, rx: r() * 6, color: r.pick([0xc98a45, 0xa8692e, 0xe0b071, 0x8a5222]) });
        }
      }
      K.instances(new T.DodecahedronGeometry(1, 0), K.std({ color: 0xffffff, roughness: 0.9 }), list, { colors: true, cast: false });
    }
  },
};

function nearestS(track, x, z) {
  return track.distTo(x, z).s;
}

// World 2: a student's study desk in the evening. Dark walnut, a graph-paper road with highlighter
// edges, a ruler ramp over spilt ink, a glue puddle, pencil shavings and a mug full of pens.
import { mergeByMaterial } from '../cars.js';
import { wrapAngle, clamp } from '../util.js';

const TRACK = [
  [-112, 78], [-30, 79], [44, 76], [86, 65], [118, 42], [135, 8], [132, -28], [112, -60], [84, -80],
  [50, -86], [16, -82], [-2, -62], [-6, -32], [-8, -2], [-16, 17], [-32, 26], [-47, 17], [-52, -8],
  [-53, -36], [-64, -60], [-96, -73], [-128, -65], [-146, -40], [-149, 0], [-142, 42], [-130, 66],
];

const BOUNDS = { minX: -165, maxX: 165, minZ: -106, maxZ: 100 };

export default {
  id: 'desk',
  name: 'Homework Hustle',
  blurb: 'Graph-paper road on a walnut desk: ruler jump over spilt ink, glue and shavings.',
  vehicle: 'formula',
  seed: 5,
  track: { points: TRACK, width: 14, startS: 50 },
  bounds: BOUNDS,
  fallOffEdges: true,
  floorY: -76,
  offCourse: 16,
  skidColor: 0x2b2b33,
  dust: {
    normal: null,
    slick: { color: 0x0d1d55, size: 0.6, life: 0.45, up: 3, grav: 25, alpha: 0.95, grow: 1, rate: 2 },
    sticky: { color: 0xf6f3ea, size: 0.75, life: 0.45, up: 1.5, grav: 10, alpha: 0.95, grow: 1 },
    slow: { color: 0xe2c592, size: 0.8, life: 0.6, up: 4, grav: 18, alpha: 0.95, grow: 1, rate: 2 },
  },
  lighting: {
    sunDir: [-0.66, 0.62, -0.52], sunColor: 0xffc58a, sunIntensity: 2.7,
    hemiSky: 0x9fb2e0, hemiGround: 0x2a1a10, hemiIntensity: 0.42,
    envIntensity: 0.3, exposure: 1.0, background: 0x0b0c10, shadowRadius: 5,
  },

  async build(K) {
    const { THREE: T, TX, r, track } = K;
    const L = track.length;
    const PI = Math.PI;
    const warnRoad = (what, x, z, m = 0.5) => { if (!K.offRoad(x, z, m)) console.warn(`desk: ${what} on road at ${x.toFixed(1)},${z.toFixed(1)}`); };

    // ---------- batched contact shadows (one draw call per opacity class) ----------
    const aoLists = new Map();
    const AO = (x, z, rx, rz = rx, op = 0.4, ang = 0, y = 0.07) => {
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

    // ======================= the lamp's pool of light (no shadow pass: the sun does the shadows) =======================
    {
      const spot = new T.SpotLight(0xffb870, 1.5, 0, 0.62, 1, 0);
      spot.position.set(-55, 150, -150);
      spot.target.position.set(-15, 0, -5);
      spot.castShadow = false;
      K.group.add(spot, spot.target);
    }

    // ======================= desk, room =======================
    const wal = TX.woodTextures({ size: 1024, seed: 21, planks: 5, base: 0x4d2e1c, dark: 0x22130a, light: 0x76492c, ringFreq: 12, gap: 0.0013, gapColor: 0x160c06, roughBase: 0.34, lacquer: 0.45, varyPlanks: 0.1 });
    for (const t of Object.values(wal)) { t.repeat.set(330 / 72, 206 / 72); t.rotation = PI / 2; t.center.set(0.5, 0.5); }
    const deskMat = K.std({ map: wal.map, normalMap: wal.normalMap, roughnessMap: wal.roughnessMap, normalScale: new T.Vector2(0.45, 0.45), envMapIntensity: 0.8 });
    const dw = BOUNDS.maxX - BOUNDS.minX, dd = BOUNDS.maxZ - BOUNDS.minZ, dcx = (BOUNDS.maxX + BOUNDS.minX) / 2, dcz = (BOUNDS.maxZ + BOUNDS.minZ) / 2;
    K.mesh(new K.RoundedBoxGeometry(dw, 4, dd, 2, 0.7), deskMat, dcx, -2, dcz, { cast: false });
    const darkWood = K.std({ color: 0x2c1a10, roughness: 0.6, map: wal.map });
    K.mesh(new T.BoxGeometry(dw - 10, 6, dd - 10), darkWood, dcx, -7, dcz, { cast: false });
    for (const z of [BOUNDS.minZ + 7, BOUNDS.maxZ - 7]) K.mesh(new T.BoxGeometry(5, 70, 5), darkWood, BOUNDS.minX + 8, -41, z, { cast: false });
    // drawer pedestal on the right
    {
      const px = BOUNDS.maxX - 26;
      K.mesh(new T.BoxGeometry(44, 70, dd - 8), darkWood, px, -41, dcz, { cast: false });
      const handle = K.metal(0xb8a27a, 0.3);
      for (let i = 0; i < 3; i++) {
        const y = -14 - i * 21;
        K.mesh(new T.BoxGeometry(42, 19.5, 1), deskMat, px, y, BOUNDS.maxZ - 3.5, { cast: false });
        K.mesh(new T.BoxGeometry(12, 1, 1.2), handle, px, y + 5, BOUNDS.maxZ - 2.4, { cast: false });
      }
    }
    // carpet far below + the desk's shadow on it
    {
      const cp = TX.mottledTextures({ size: 256, a: 0x36404f, b: 0x262d38, c: 0x47505e, seed: 61, period: 64, speck: 0.5, bump: 3 });
      for (const t of Object.values(cp)) t.repeat.set(40, 40);
      K.mesh(new T.PlaneGeometry(1600, 1600), K.std({ map: cp.map, normalMap: cp.normalMap, roughness: 1, color: 0x8a8f99 }), 0, -76, 0, { rx: -PI / 2, cast: false });
      const sh = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6, alphaMap: TX.blobShadowTexture(), depthWrite: false }));
      sh.rotation.x = -PI / 2; sh.scale.set(dw * 1.5, dd * 1.5, 1); sh.position.set(dcx + 40, -75.9, dcz + 30);
      K.group.add(sh);
    }

    // ======================= the graph-paper road =======================
    {
      const S = 512; // 8 x 8 units
      const c = TX.makeCanvas(S);
      const g = c.getContext('2d');
      g.fillStyle = '#f6f3ea'; g.fillRect(0, 0, S, S);
      // paper fibres
      for (let i = 0; i < 1200; i++) {
        const x = r() * S, y = r() * S, l = r.range(2, 9), a = r() * PI;
        g.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(170,160,140,0.10)';
        g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
      }
      for (let i = 0; i <= 16; i++) {
        const p = i * 32 + 0.5;
        const major = i % 2 === 0;
        g.strokeStyle = major ? 'rgba(52,112,196,0.7)' : 'rgba(95,155,220,0.5)';
        g.lineWidth = major ? 4.2 : 2.4;
        g.beginPath(); g.moveTo(p, 0); g.lineTo(p, S); g.stroke();
        g.beginPath(); g.moveTo(0, p); g.lineTo(S, p); g.stroke();
      }
      const t = TX.toTexture(c, { repeat: [15 / 8, 1] });
      const paperMat = K.std({ map: t, roughness: 0.86 });
      const vScale = L / Math.round(L / 8);
      K.ribbon({ mat: paperMat, width: 15, y: 0.045, vScale });
      // soft shadow along the paper edges (the strip is a little lifted)
      const ec = TX.makeCanvas(128, 4);
      const eg = ec.getContext('2d');
      const gr = eg.createLinearGradient(0, 0, 128, 0);
      gr.addColorStop(0, '#000'); gr.addColorStop(0.037, '#bbb'); gr.addColorStop(0.07, '#000');
      gr.addColorStop(0.93, '#000'); gr.addColorStop(0.963, '#bbb'); gr.addColorStop(1, '#000');
      eg.fillStyle = gr; eg.fillRect(0, 0, 128, 4);
      K.ribbon({ mat: new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55, alphaMap: TX.toTexture(ec, { srgb: false }), depthWrite: false }), width: 16.2, y: 0.02 });

      // highlighter strokes along both edges, a thin ballpoint rule along the paper's outer edge
      const H = 2048, Wd = 64;
      const cols = [[255, 50, 150], [255, 205, 0], [60, 215, 60], [255, 120, 20], [30, 160, 255]];
      const hlTex = (side) => {
        const hc = TX.makeCanvas(Wd, H);
        const hg = hc.getContext('2d');
        let y0 = -40, ci = side > 0 ? 2 : 0;
        while (y0 < H) {
          const len = r.range(260, 560);
          const [cr, cg, cb] = cols[ci++ % cols.length];
          const x0 = (side < 0 ? 12 : 3) + r.range(-2, 2), x1 = (side < 0 ? Wd - 3 : Wd - 12) + r.range(-2, 2);
          for (const off of [0, H, -H]) {
            const yy = y0 + off;
            hg.fillStyle = `rgba(${cr},${cg},${cb},0.86)`;
            hg.fillRect(x0, yy, x1 - x0, len);
            for (let k = 0; k < 14; k++) {
              const sx = x0 + r() * (x1 - x0);
              hg.fillStyle = `rgba(${cr * 0.8 | 0},${cg * 0.8 | 0},${cb * 0.8 | 0},${r.range(0.05, 0.18)})`;
              hg.fillRect(sx, yy, r.range(1, 3), len);
            }
            hg.fillStyle = `rgba(${cr * 0.75 | 0},${cg * 0.7 | 0},${cb * 0.75 | 0},0.35)`;
            hg.fillRect(x0, yy, x1 - x0, 7); hg.fillRect(x0, yy + len - 7, x1 - x0, 7);
          }
          y0 += len - r.range(10, 40);
        }
        // ballpoint rule with slight wobble
        hg.fillStyle = 'rgba(24,40,140,0.95)';
        for (let y = 0; y < H; y += 8) hg.fillRect((side < 0 ? 3.5 : Wd - 7.5) + Math.sin(y * 0.013) * 0.8, y, 3.2, 8);
        return TX.toTexture(hc);
      };
      const tiles = Math.max(1, Math.round(L / 150));
      const hlMat = K.std({ map: hlTex(-1), transparent: true, depthWrite: false, roughness: 0.55 });
      const hlMat2 = K.std({ map: hlTex(1), transparent: true, depthWrite: false, roughness: 0.55 });
      K.ribbon({ mat: hlMat, width: 3.0, offset: -5.95, y: 0.06, vScale: L / tiles });
      K.ribbon({ mat: hlMat2, width: 3.0, offset: 5.95, y: 0.06, vScale: L / tiles });

      // start / finish: a checker band drawn in black marker, and "FINISH" lettered across the paper
      const s0 = 50;
      const sc = TX.makeCanvas(512, 128);
      const sg = sc.getContext('2d');
      for (let y = 0; y < 2; y++) for (let x = 0; x < 12; x++) {
        if ((x + y) % 2) continue;
        const px = 20 + x * 39.3, py = 14 + y * 50;
        for (let k = 0; k < 9; k++) {
          sg.strokeStyle = `rgba(18,18,24,${r.range(0.55, 0.85)})`; sg.lineWidth = 9; sg.lineCap = 'round';
          sg.beginPath(); sg.moveTo(px + 3 + r.range(-2, 2), py + 4 + k * 5.4); sg.lineTo(px + 36 + r.range(-2, 2), py + 4 + k * 5.4 + r.range(-1, 1)); sg.stroke();
        }
      }
      sg.strokeStyle = 'rgba(18,18,24,0.85)'; sg.lineWidth = 5;
      sg.beginPath(); sg.moveTo(18, 12); sg.lineTo(494, 13); sg.stroke();
      sg.beginPath(); sg.moveTo(18, 115); sg.lineTo(494, 114); sg.stroke();
      const sm = K.std({ map: TX.toTexture(sc, { wrap: false }), transparent: true, depthWrite: false, roughness: 0.6 });
      const p = track.at(s0);
      const m = K.mesh(new T.PlaneGeometry(14.6, 3.6), sm, p.x, 0.07, p.z, { cast: false });
      m.rotation.order = 'YXZ'; m.rotation.y = -p.angle + PI / 2; m.rotation.x = -PI / 2;
      // lettering
      const lc = TX.makeCanvas(512, 128);
      const lg = lc.getContext('2d');
      lg.font = '96px "Lilita One", Impact, sans-serif'; lg.textAlign = 'center'; lg.textBaseline = 'middle';
      lg.lineJoin = 'round'; lg.strokeStyle = 'rgba(20,20,26,0.9)'; lg.lineWidth = 7;
      lg.strokeText('FINISH', 256, 66);
      const lm = K.std({ map: TX.toTexture(lc, { wrap: false }), transparent: true, depthWrite: false, roughness: 0.6 });
      const q = track.at(s0 - 6);
      const lt = K.mesh(new T.PlaneGeometry(13, 3.25), lm, q.x, 0.07, q.z, { cast: false });
      lt.rotation.order = 'YXZ'; lt.rotation.y = -q.angle; lt.rotation.x = -PI / 2;
      // chevrons drawn before the hairpin
      const cc = TX.makeCanvas(256, 128);
      const cg2 = cc.getContext('2d');
      cg2.strokeStyle = 'rgba(30,60,170,0.85)'; cg2.lineWidth = 12; cg2.lineCap = 'round'; cg2.lineJoin = 'round';
      for (let i = 0; i < 3; i++) { cg2.beginPath(); cg2.moveTo(30 + i * 70, 20); cg2.lineTo(80 + i * 70, 64); cg2.lineTo(30 + i * 70, 108); cg2.stroke(); }
      const chev = K.std({ map: TX.toTexture(cc, { wrap: false }), transparent: true, depthWrite: false, roughness: 0.6 });
      for (const s of [548, 450]) {
        const a = track.at(s);
        const cm = K.mesh(new T.PlaneGeometry(7, 3.5), chev, a.x, 0.07, a.z, { cast: false });
        cm.rotation.order = 'YXZ'; cm.rotation.y = -a.angle; cm.rotation.x = -PI / 2;
      }
      // little pieces of clear tape holding the strip down
      const tc = TX.makeCanvas(64, 64);
      const tg = tc.getContext('2d');
      tg.fillStyle = 'rgba(255,250,225,0.32)'; tg.fillRect(0, 0, 64, 64);
      tg.fillStyle = 'rgba(255,255,255,0.35)'; tg.fillRect(0, 0, 64, 3); tg.fillRect(0, 61, 64, 3);
      const tapeMat = K.phys({ map: TX.toTexture(tc, { wrap: false }), transparent: true, depthWrite: false, roughness: 0.15, clearcoat: 1 });
      const tapes = [];
      for (let s = 20; s < L; s += 115) for (const side of [-1, 1]) {
        const a = track.at(s + side * 9);
        const x = a.x + a.nx * side * 7.5, z = a.z + a.nz * side * 7.5;
        tapes.push({ x, y: 0.08, z, ry: -a.angle + r.range(-0.15, 0.15), sx: 3.2, sy: 1, sz: 2.2 });
      }
      const tgeo = new T.PlaneGeometry(1, 1); tgeo.rotateX(-PI / 2);
      K.instances(tgeo, tapeMat, tapes, { cast: false });
    }

    // dark soft rim around a puddle so a glossy white blob reads against white paper
    const rim = (poly, grow, op = 0.32, color = 0x2a2010, y = 0.075) => {
      let mx = 0, mz = 0;
      for (const [x, z] of poly) { mx += x; mz += z; }
      mx /= poly.length; mz /= poly.length;
      const big = poly.map(([x, z]) => { const dx = x - mx, dz = z - mz, l = Math.hypot(dx, dz) || 1; return [x + dx / l * grow, z + dz / l * grow]; });
      const m = K.flatShape(big, new T.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false }), y);
      m.renderOrder = 1;
      return m;
    };

    // Merge several decal meshes (same material) into one draw call.
    const mergeMeshes = (meshes) => {
      if (meshes.length < 2) return;
      const geos = meshes.map((m) => { m.updateMatrix(); const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); g.applyMatrix4(m.matrix); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); return g; });
      const merged = K.BufferGeometryUtils.mergeGeometries(geos, false);
      if (!merged) return;
      const mm = new T.Mesh(merged, meshes[0].material);
      mm.receiveShadow = true; mm.castShadow = meshes[0].castShadow; mm.renderOrder = meshes[0].renderOrder;
      for (const m of meshes) { K.group.remove(m); m.geometry.dispose(); }
      K.group.add(mm);
    };

    // ======================= shared materials =======================
    const steel = K.metal(0xd6d9de, 0.22);
    const darkSteel = K.metal(0x8d9198, 0.35);

    // lined paper texture (balls, notebook)
    const linedTex = (() => {
      const c = TX.makeCanvas(256);
      const g = c.getContext('2d');
      g.fillStyle = '#f5f3ec'; g.fillRect(0, 0, 256, 256);
      g.strokeStyle = 'rgba(90,140,210,0.7)'; g.lineWidth = 2;
      for (let y = 12; y < 256; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
      g.strokeStyle = 'rgba(220,70,80,0.7)'; g.beginPath(); g.moveTo(40, 0); g.lineTo(40, 256); g.stroke();
      g.fillStyle = 'rgba(40,60,140,0.6)'; g.font = 'italic 18px Georgia, serif';
      g.fillText('x² + 2x = 8', 60, 58); g.fillText('2(x−1) = 6', 70, 122); g.fillText('?!', 180, 200);
      return TX.toTexture(c, { repeat: [2, 2] });
    })();

    // ======================= pencils (instanced parts) =======================
    // local pencil space: axis along +x, centred, lying on a flat face (centre height 0.372)
    const PR = 0.43;
    const pencils = { graphite: [], colour: [] };
    const addPencil = (kind, x, y, z, ry, opts = {}) => {
      (kind === 'graphite' ? pencils.graphite : pencils.colour).push({ x, y, z, ry, rx: opts.rx || 0, rz: opts.rz || 0, s: opts.s || 1, color: opts.color, lead: opts.lead });
    };
    const flushPencils = () => {
      const toX = (g) => { g.rotateZ(-PI / 2); return g; };
      const hexAt = (x0, x1) => { const g = toX(new T.CylinderGeometry(PR, PR, x1 - x0, 6, 1)); g.rotateX(PI / 6); g.translate((x0 + x1) / 2, 0, 0); return g; };
      const lathe = (prof, segs, x0) => { const g = toX(K.lathe(prof, segs)); g.translate(x0, 0, 0); return g; };
      const lacquer = K.phys({ color: 0xffffff, roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.25 });
      const woodMat = K.std({ color: 0xe0bd8c, roughness: 0.75 });
      const leadMat = K.std({ color: 0xffffff, roughness: 0.45, metalness: 0.15 });
      const all = [...pencils.graphite, ...pencils.colour];
      // bodies
      K.instances(hexAt(-6.75, 6.6), lacquer, pencils.graphite.map((p) => ({ ...p, color: p.color ?? 0xf3c21c })), { colors: true });
      if (pencils.colour.length) K.instances(hexAt(-8.75, 6.6), lacquer, pencils.colour, { colors: true });
      // sharpened wood cone + lead
      K.instances(lathe([[0.001, 0], [0.4, 0.001], [0.42, 0.12], [0.13, 1.9], [0.001, 1.9]], 14, 6.6), woodMat, all);
      K.instances(lathe([[0.13, 0], [0.02, 0.42], [0.001, 0.43]], 10, 8.48), leadMat, all.map((p) => ({ ...p, color: p.lead ?? 0x2a2a2e })), { colors: true });
      // ferrule + eraser (graphite pencils only)
      if (pencils.graphite.length) {
        const fer = K.metal(0xc9c3b0, 0.28);
        const fp = [[0.405, 0], [0.43, 0.08], [0.43, 0.25], [0.405, 0.3], [0.43, 0.38], [0.43, 0.82], [0.405, 0.9], [0.43, 0.98], [0.43, 1.12], [0.4, 1.2]];
        K.instances(lathe(fp, 18, -7.95), fer, pencils.graphite);
        K.instances(lathe([[0.001, 0], [0.3, 0.02], [0.37, 0.12], [0.37, 0.95]], 16, -8.85), K.std({ color: 0xf08c9c, roughness: 0.8 }), pencils.graphite);
      }
    };
    const LY = 0.372; // resting height

    // ======================= the ramp: a wooden ruler on a jumbo eraser =======================
    const rulerTex = (len, wid, opts = {}) => {
      const pxPerCm = 32;
      const W = Math.ceil(len * pxPerCm), Hh = Math.ceil(wid * pxPerCm);
      const c = TX.makeCanvas(W, Hh);
      const g = c.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 0, Hh);
      gr.addColorStop(0, opts.base || '#e8cf9e'); gr.addColorStop(1, opts.base2 || '#dcbd86');
      g.fillStyle = gr; g.fillRect(0, 0, W, Hh);
      // wood grain
      for (let i = 0; i < 60; i++) {
        g.strokeStyle = `rgba(140,95,45,${r.range(0.04, 0.12)})`; g.lineWidth = r.range(1, 3);
        const y = r() * Hh; g.beginPath(); g.moveTo(0, y);
        for (let x = 0; x <= W; x += 40) g.lineTo(x, y + Math.sin(x * 0.01 + i) * 4);
        g.stroke();
      }
      g.fillStyle = '#1d1a16';
      const zero = (len - 30) / 2;
      for (let mm = 0; mm <= 300; mm++) {
        const x = (zero + mm / 10) * pxPerCm;
        const h = mm % 10 === 0 ? 0.32 : mm % 5 === 0 ? 0.22 : 0.13;
        g.fillRect(x - 0.8, 0, 1.6, Hh * h);
      }
      g.font = `600 ${pxPerCm * 0.5 | 0}px Rubik, sans-serif`; g.textAlign = 'center';
      for (let cm = 0; cm <= 30; cm++) g.fillText(String(cm), (zero + cm) * pxPerCm, Hh * 0.52);
      g.font = `500 ${pxPerCm * 0.36 | 0}px Rubik, sans-serif`; g.textAlign = 'left';
      g.fillStyle = 'rgba(30,25,20,0.7)'; g.fillText('cm', (zero + 0.3) * pxPerCm, Hh * 0.85);
      g.fillText('SCHOOL RULER  30', (zero + 18) * pxPerCm, Hh * 0.85);
      // metal edge strip
      g.fillStyle = '#9ea3a8'; g.fillRect(0, 0, W, 3);
      return TX.toTexture(c, { wrap: false });
    };
    const rulerMat = K.std({ map: rulerTex(31, 4.4), roughness: 0.5 });
    const makeRuler = () => new T.Mesh(new T.BoxGeometry(31, 0.3, 4.4), rulerMat);
    {
      const sMid = 127, off = 3.4;
      const p = track.place(sMid, off);
      const ang = p.angle, len = 30, H = 4.6;
      K.ramp(p.x, p.z, ang, len, 5, H, 0);
      const slope = Math.atan2(H, len);
      const grp = new T.Group();
      const ru = makeRuler();
      ru.scale.x = (len + 1) / 31 / Math.cos(slope) * 0.995;
      ru.position.y = -0.15;
      grp.add(ru);
      grp.position.set(p.x, H / 2, p.z);
      grp.rotation.order = 'YZX'; grp.rotation.y = -ang; grp.rotation.z = slope;
      K.add(grp);
      // jumbo eraser standing on its edge under the ruler
      const ea = 24.8 - len / 2; // along-track position relative to the ramp centre
      const ex = p.x + Math.cos(ang) * ea, ez = p.z + Math.sin(ang) * ea;
      const eh = (H - 0.3) * (ea + len / 2) / len - 0.05;
      const ec = TX.makeCanvas(256, 128);
      const eg = ec.getContext('2d');
      eg.fillStyle = '#f4a3b4'; eg.fillRect(0, 0, 256, 128);
      eg.fillStyle = '#2f5fae'; eg.fillRect(0, 34, 256, 60);
      eg.fillStyle = '#fff'; eg.font = '30px "Lilita One", sans-serif'; eg.textAlign = 'center'; eg.textBaseline = 'middle';
      eg.fillText('ERASER', 128, 65);
      const eMat = K.std({ map: TX.toTexture(ec, { wrap: false }), roughness: 0.8 });
      K.mesh(new K.RoundedBoxGeometry(2.6, eh, 5.8, 2, 0.35), eMat, ex, eh / 2, ez, { ry: -ang });
      // no collider: the eraser sits inside the ramp footprint, whose sides already block cars
      AO(ex, ez, 2.6, 4.6, 0.5, ang);
      AO(p.x, p.z, 15, 3.4, 0.25, ang);
      // The ruler's long edges act as low guard rails for cars beside it, so a car alongside slides past
      // instead of being bounced backwards by the ramp's side (cars on the ruler are higher and pass over).
      for (const sd of [-1, 1]) {
        const a0 = -len / 2 + 5.5, a1 = len / 2 + 0.4, b = sd * 2.75;
        const mx = p.x + Math.cos(ang) * (a0 + a1) / 2 - Math.sin(ang) * b, mz = p.z + Math.sin(ang) * (a0 + a1) / 2 + Math.cos(ang) * b;
        K.box(mx, mz, (a1 - a0) / 2, 0.25, ang, 1.1);
      }
      // Workaround for two engine limits (see report), wrapping only this world's physics instance:
      //  1. CPU drivers don't know a ramp's side is a wall: beside the ruler they hold a parallel line.
      //  2. A car put down by the grid/respawn inside the ramp footprint at floor level is lifted onto it.
      const P = K.physics, step0 = P.stepCar.bind(P);
      const RX = p.x, RZ = p.z, RC = Math.cos(ang), RS = Math.sin(ang), RW = 2.5;
      P.stepCar = (car, dt, ctx) => {
        if (car.state === 'drive' && !car.airborne) {
          const dx = car.x - RX, dz = car.z - RZ;
          const a = dx * RC + dz * RS, b = -dx * RS + dz * RC;
          if (a > -len / 2 - 1 && a < len / 2 + 1) {
            if (Math.abs(b) <= RW) {
              const gr = P.groundAt(car.x, car.z);
              if (gr.ramp && gr.g > car.y + 0.85) { car.y = gr.g; car.lastRamp = gr.ramp; car.groundSlope = gr.slope; }
            } else if (car.ent?.ai && car.y < 0.5 && a > -len / 2 + 3 && Math.abs(b) < RW + 4.5) {
              // may steer away from the ruler, never into it
              const hold = clamp(-wrapAngle(car.angle - ang) * 3, -1, 1);
              car.steer = b < 0 ? Math.min(car.steer, hold - 0.05) : Math.max(car.steer, hold + 0.05);
            }
          }
        }
        return step0(car, dt, ctx);
      };
    }

    // ======================= ink bottle + spilt ink (slick) =======================
    const inkMat = K.phys({ color: 0x0a1645, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.3 });
    {
      const bp = track.place(150, -20);
      const ang = bp.angle + PI / 2 - 0.35; // lying on its side, mouth towards the road
      const g = new T.Group();
      const prof = [[0.001, 0], [2.9, 0], [3.2, 0.3], [3.2, 4.2], [2.6, 5.0], [1.3, 5.3], [1.3, 6.4], [1.1, 6.4], [1.1, 5.5], [2.5, 4.9], [2.95, 4.1], [2.95, 0.4], [0.001, 0.3]];
      const glass = new T.Mesh(K.lathe(prof, 36), K.glass(0xbcc8ff, 0.28));
      g.add(glass);
      const inside = new T.Mesh(new T.CylinderGeometry(2.85, 2.85, 3.8, 28, 1, false, 0, PI), inkMat);
      inside.position.y = 2.2; g.add(inside);
      const lc = TX.makeCanvas(512, 64);
      const lg = lc.getContext('2d');
      lg.fillStyle = '#efe4c8'; lg.fillRect(0, 0, 512, 64); lg.fillStyle = '#1a2a6a'; lg.font = 'italic 30px Georgia, serif'; lg.textAlign = 'center';
      lg.fillText('Royal Blue Ink', 128, 42); lg.fillText('Royal Blue Ink', 384, 42);
      const label = new T.Mesh(new T.CylinderGeometry(3.23, 3.23, 2.2, 32, 1, true), K.std({ map: TX.toTexture(lc, { wrap: false }), roughness: 0.7 }));
      label.position.y = 2.2; g.add(label);
      g.rotation.z = -PI / 2; g.position.y = 3.2;
      const holder = new T.Group(); holder.add(g);
      holder.position.set(bp.x, 0, bp.z); holder.rotation.y = -ang;
      K.add(holder);
      glass.castShadow = false;
      K.capsule(bp.x, bp.z, bp.x + Math.cos(ang) * 4.6, bp.z + Math.sin(ang) * 4.6, 3.2, 6.4);
      AO(bp.x + Math.cos(ang) * 2.5, bp.z + Math.sin(ang) * 2.5, 4.5, 3.4, 0.5, ang);
      warnRoad('ink bottle', bp.x + Math.cos(ang) * 6.5, bp.z + Math.sin(ang) * 6.5, 1);
      // cap rolled away
      K.mesh(new T.CylinderGeometry(1.5, 1.5, 1.6, 20), K.plastic(0x16161a, 0.4), bp.x - 5, 0.8, bp.z - 3);
      AO(bp.x - 5, bp.z - 3, 1.8, 1.8, 0.45);
      // the spill
      const sp = track.place(148.5, 2.6);
      const spill = K.spill(sp.x, sp.z, 3.9, inkMat, { lump: 0.25, stretch: 1.4, angle: sp.angle + PI / 2 + 0.12, y: 0.17, thick: 0.12 });
      K.surface('slick', { poly: spill.poly });
      rim(spill.poly, 0.7, 0.45, 0x2a4fc0, 0.065); // ink bleeding into the paper fibres
      // trail from the bottle mouth
      const mx = bp.x + Math.cos(ang) * 6.5, mz = bp.z + Math.sin(ang) * 6.5;
      const drops = [];
      for (let i = 0; i <= 4; i++) {
        const t = i / 4;
        drops.push(K.spill(mx + (sp.x - mx) * t * 0.7 + r.range(-0.6, 0.6), mz + (sp.z - mz) * t * 0.7 + r.range(-0.6, 0.6), r.range(1.6, 2.4), inkMat, { y: 0.15, thick: 0.1, n: 24 }).mesh);
      }
      // a few splatters
      for (let i = 0; i < 7; i++) {
        const q = track.place(r.range(156, 178), r.range(-2, 7));
        drops.push(K.spill(q.x, q.z, r.range(0.25, 0.7), inkMat, { y: 0.12, thick: 0.08, n: 14 }).mesh);
      }
      mergeMeshes(drops);
    }

    // ======================= glue bottle knocked over + glue puddle (sticky) =======================
    {
      const glueMat = K.phys({ color: 0xf1eee4, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.01, transparent: true, opacity: 0.84, envMapIntensity: 2.4, sheen: 0.6, sheenColor: new T.Color(0xd8e4ff) });
      const bp = track.place(803, -26);
      const ang = bp.angle + PI / 2 + 0.25; // nozzle pointing west, towards the road
      const g = new T.Group();
      const body = new T.Mesh(K.lathe([[0.001, 0], [2.4, 0], [2.7, 0.4], [2.7, 8.6], [2.3, 9.8], [1.2, 10.4], [0.001, 10.4]], 32), K.plastic(0xf7f7f2, 0.35));
      g.add(body);
      const lc = TX.makeCanvas(512, 128);
      const lg = lc.getContext('2d');
      lg.fillStyle = '#f7f7f2'; lg.fillRect(0, 0, 512, 128);
      lg.fillStyle = '#e3672b'; lg.fillRect(0, 10, 512, 26); lg.fillRect(0, 96, 512, 22);
      lg.fillStyle = '#204a9a'; lg.font = '44px "Lilita One", sans-serif'; lg.textAlign = 'center'; lg.fillText('WHITE GLUE', 256, 80);
      const label = new T.Mesh(new T.CylinderGeometry(2.72, 2.72, 5.5, 32, 1, true), K.std({ map: TX.toTexture(lc, { wrap: false }), roughness: 0.5 }));
      label.position.y = 4.6; g.add(label);
      const cap = new T.Mesh(K.lathe([[1.5, 0], [1.5, 1.6], [0.9, 2.8], [0.35, 3.8], [0.2, 4.2], [0.001, 4.2]], 24), K.plastic(0xe86a24, 0.3));
      cap.position.y = 10.2; g.add(cap);
      g.rotation.z = -PI / 2; g.position.y = 2.7;
      const holder = new T.Group(); holder.add(g);
      holder.position.set(bp.x, 0, bp.z); holder.rotation.y = -ang;
      K.add(holder);
      const tipX = bp.x + Math.cos(ang) * 14.4, tipZ = bp.z + Math.sin(ang) * 14.4;
      warnRoad('glue tip', tipX, tipZ, 1);
      K.capsule(bp.x, bp.z, bp.x + Math.cos(ang) * 10, bp.z + Math.sin(ang) * 10, 2.7, 5.4);
      AO(bp.x + Math.cos(ang) * 5, bp.z + Math.sin(ang) * 5, 7, 3.2, 0.5, ang);
      const sp = track.place(818, -3.3);
      const spill = K.spill(sp.x, sp.z, 4.6, glueMat, { lump: 0.28, stretch: 1.7, angle: sp.angle, y: 0.5, thick: 0.45 });
      K.surface('sticky', { poly: spill.poly });
      spill.mesh.castShadow = true;
      rim(spill.poly, 0.55, 0.5, 0x3a3020);
      // glossy highlights on the wet surface
      const hlm = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false });
      for (const [o, d, rr] of [[-2, -2.4, 1.3], [2.8, -1.8, 0.8], [-5, 0.6, 0.55], [1, 2.4, 0.5]]) { const q = track.place(818 + o, -3.3 + d * 0.7); const hm = K.mesh(new T.CircleGeometry(rr, 16), hlm, q.x, 0.93, q.z, { cast: false }); hm.rotation.order = 'YXZ'; hm.rotation.y = -q.angle + 0.5; hm.rotation.x = -PI / 2; hm.scale.set(2.2, 0.45, 1); }
      // thicker centre of the puddle and a few trapped bubbles
      K.spill(sp.x, sp.z, 2.9, glueMat, { lump: 0.3, stretch: 1.3, angle: sp.angle, y: 0.62, thick: 0.2 });
      const bub = [];
      for (let i = 0; i < 9; i++) { const q = track.place(818 + r.range(-5, 5), -3.3 + r.range(-2.5, 2.5)); bub.push({ x: q.x, y: 0.5, z: q.z, s: r.range(0.12, 0.3) }); }
      K.instances(new T.SphereGeometry(1, 10, 6, 0, PI * 2, 0, PI / 2), K.glass(0xffffff, 0.5), bub, { cast: false });
      const drops = [], rims = [];
      for (let i = 0; i <= 5; i++) {
        const t = i / 5;
        const d = K.spill(tipX + (sp.x - tipX) * t, tipZ + (sp.z - tipZ) * t, 1.2 + t * 1.2, glueMat, { y: 0.2, thick: 0.16, n: 24 });
        drops.push(d.mesh);
        rims.push(rim(d.poly, 0.25, 0.2));
      }
      mergeMeshes(drops);
      for (const m of rims.slice(1)) m.material = rims[0].material;
      mergeMeshes(rims);
    }

    // ======================= pencil sharpener + shavings (slow) =======================
    const shavingGeo = (rim) => {
      const segA = 22, segR = 4;
      const pos = [], col = [], idx = [];
      const span = PI * 1.55;
      const cWood = new T.Color(0xead2a6), cGraph = new T.Color(0x45454a), cRim = new T.Color(rim), cEdge = new T.Color(0x7a5530);
      for (let i = 0; i <= segA; i++) {
        const a = (i / segA) * span;
        for (let j = 0; j <= segR; j++) {
          const t = j / segR;
          const rad = 0.1 + a * 0.03 + t * (0.7 + 0.16 * Math.abs(Math.sin(a * 3)) * t);
          const y = t * 0.38 + a * 0.06 + Math.sin(a * 9) * 0.05 * t;
          pos.push(Math.cos(a) * rad, y, Math.sin(a) * rad);
          const c = t > 0.78 ? cRim : t > 0.7 ? cEdge : t < 0.12 ? cGraph : cWood;
          col.push(c.r, c.g, c.b);
        }
      }
      for (let i = 0; i < segA; i++) for (let j = 0; j < segR; j++) {
        const a = i * (segR + 1) + j, b = a + segR + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
      g.setIndex(idx); g.computeVertexNormals();
      return g;
    };
    {
      const sp = track.place(401, 13.2);
      const ang = sp.angle + 0.4;
      // classic metal wedge sharpener
      const grp = new T.Group();
      const prof = new T.Shape();
      prof.moveTo(-1.4, 0); prof.lineTo(1.4, 0); prof.lineTo(1.4, 1.1); prof.lineTo(0.9, 1.7); prof.lineTo(-1.4, 1.7); prof.closePath();
      const bg = new T.ExtrudeGeometry(prof, { depth: 1.5, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2 });
      bg.translate(0, 0, -0.75);
      const metal = K.metal(0xb9bec4, 0.32);
      grp.add(new T.Mesh(bg, metal));
      const blade = new T.Mesh(new T.BoxGeometry(2.2, 0.08, 1.3), K.metal(0xe9ecef, 0.12));
      blade.position.set(-0.2, 1.75, 0); grp.add(blade);
      const screw = new T.Mesh(new T.CylinderGeometry(0.22, 0.22, 0.14, 12), K.metal(0x9a8f78, 0.3));
      screw.position.set(-0.6, 1.83, 0); grp.add(screw);
      const hole = new T.Mesh(new T.CircleGeometry(0.5, 16), K.std({ color: 0x111111, roughness: 1 }));
      hole.position.set(1.45, 0.85, 0); hole.rotation.y = PI / 2; grp.add(hole);
      // grip ridges
      for (let i = 0; i < 5; i++) for (const s of [-1, 1]) {
        const rib = new T.Mesh(new T.BoxGeometry(0.12, 1.2, 0.1), metal);
        rib.position.set(-1 + i * 0.35, 0.8, s * 0.82); grp.add(rib);
      }
      grp.scale.setScalar(1.25);
      grp.position.set(sp.x, 0, sp.z); grp.rotation.y = -ang;
      K.add(grp);
      K.circle(sp.x, sp.z, 1.9, 2.2);
      AO(sp.x, sp.z, 2.4, 1.6, 0.5, ang);
      // the pencil that was being sharpened
      const pp = track.place(392, 15.5);
      addPencil('graphite', pp.x, LY, pp.z, -(sp.angle + 2.9));
      // shavings: a patch on the road (slow) and a pile by the sharpener
      const patch = track.place(408, 2.5);
      K.surface('slow', { x: patch.x, z: patch.z, r: 5.5 });
      const list = [], list2 = [];
      const put = (x, z) => {
        const item = { x, y: 0.12, z, ry: r() * 6.28, rx: r.range(-0.5, 0.5), rz: r.range(-0.5, 0.5), s: r.range(0.75, 1.35) };
        (r() < 0.12 ? list2 : list).push(item);
      };
      for (let i = 0; i < 64; i++) { const a = r() * 6.28, d = Math.sqrt(r()) * 5.4; put(patch.x + Math.cos(a) * d * 1.2, patch.z + Math.sin(a) * d * 0.85); }
      for (let i = 0; i < 22; i++) { const a = r() * 6.28, d = 1.5 + r() * 4.5; put(sp.x + Math.cos(a) * d, sp.z + Math.sin(a) * d * 0.7); }
      for (let i = 0; i < 12; i++) { const q = track.place(r.range(395, 430), r.range(-6, 9)); put(q.x, q.z); }
      const shMat = K.std({ vertexColors: true, roughness: 0.8, side: T.DoubleSide });
      K.instances(shavingGeo(0xf3c21c), shMat, list);
      K.instances(shavingGeo(0x2f7fd0), shMat, list2);
      // wood dust and graphite smudge under the pile
      const dc = TX.makeCanvas(256);
      const dg = dc.getContext('2d');
      for (let i = 0; i < 1400; i++) {
        const a = r() * 6.28, d = Math.pow(r(), 0.7) * 118;
        dg.fillStyle = r() < 0.25 ? `rgba(60,60,66,${r.range(0.2, 0.6)})` : `rgba(205,160,100,${r.range(0.3, 0.8)})`;
        dg.beginPath(); dg.arc(128 + Math.cos(a) * d, 128 + Math.sin(a) * d * 0.8, r.range(0.6, 2.2), 0, 6.28); dg.fill();
      }
      const dm = K.std({ map: TX.toTexture(dc, { wrap: false }), transparent: true, depthWrite: false, roughness: 0.9 });
      const dpl = K.mesh(new T.PlaneGeometry(14, 14), dm, patch.x, 0.09, patch.z, { rx: -PI / 2, cast: false });
      dpl.rotation.z = -patch.angle;
    }

    // ======================= mug full of pens (inside the hairpin) =======================
    {
      const cx = -30, cz = -5, M = 1;
      const prof = [[0.001, 0], [3.6, 0], [4.1, 0.25], [4.35, 0.9], [4.35, 9.4], [4.2, 9.75], [3.95, 9.75], [3.85, 9.4], [3.85, 1.2], [0.001, 1.1]];
      const g = K.lathe(prof, 48);
      const col = new Float32Array(g.attributes.position.count * 3);
      const pos = g.attributes.position;
      const outC = new T.Color(0x1f3a5c), inC = new T.Color(0xf0e8d8);
      for (let i = 0; i < pos.count; i++) {
        const rr = Math.hypot(pos.getX(i), pos.getZ(i)), y = pos.getY(i);
        const c = (rr < 4.0 && y > 1.0) || y > 9.6 ? inC : outC;
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
      g.setAttribute('color', new T.BufferAttribute(col, 3));
      // speckled glaze
      const sc = TX.makeCanvas(256);
      const sg = sc.getContext('2d');
      sg.fillStyle = '#fff'; sg.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 900; i++) { sg.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '20,20,20'},${r.range(0.15, 0.5)})`; sg.beginPath(); sg.arc(r() * 256, r() * 256, r.range(0.6, 1.8), 0, 6.28); sg.fill(); }
      const mugMat = K.ceramic(0xffffff, { vertexColors: true, map: TX.toTexture(sc, { repeat: [3, 1] }), roughness: 0.3 });
      K.mesh(g, mugMat, cx, 0, cz);
      K.mesh(new T.TorusGeometry(2.4, 0.55, 12, 24, PI * 1.25), mugMat, cx + 4.6, 5.2, cz - 0.6, { rz: -PI * 0.62, ry: 0.15 });
      K.circle(cx, cz, 4.5, 10); K.circle(cx + 6, cz - 0.7, 1.4, 8);
      AO(cx, cz, 5.4, 5.4, 0.55);
      // pens and pencils standing in it, leaning on the rim
      const penBody = new T.CylinderGeometry(0.42, 0.42, 14, 14); penBody.translate(0, 7, 0);
      const capG = new T.CylinderGeometry(0.5, 0.48, 4.4, 14); capG.translate(0, 14.6, 0);
      const markerB = new T.CylinderGeometry(0.75, 0.75, 13, 16); markerB.translate(0, 6.5, 0);
      const markerC = new T.CylinderGeometry(0.8, 0.78, 4.8, 16); markerC.translate(0, 14, 0);
      const items = [];
      const lean = (i, n) => { const a = (i / n) * 6.28 + 0.3; return { a, tilt: 0.16 + (i % 3) * 0.05 }; };
      const pens = [[0x1c4fb8, 'pen'], [0x111111, 'pen'], [0xd23a2a, 'pen'], [0xff4fa0, 'marker'], [0x2a2a2a, 'marker'], [0x7bea3e, 'marker']];
      const penMat = K.plastic(0xffffff, 0.3);
      const bodiesP = [], capsP = [], bodiesM = [], capsM = [];
      pens.forEach(([c, kind], i) => {
        const { a, tilt } = lean(i, pens.length + 3);
        const x = cx + Math.cos(a) * 1.6, z = cz + Math.sin(a) * 1.6;
        const item = { x, y: 1.2, z, ry: -a, rz: -tilt, color: c };
        if (kind === 'pen') { bodiesP.push({ ...item, color: 0xe8ecef }); capsP.push(item); } else { bodiesM.push({ ...item, color: 0xf2f2f2 }); capsM.push(item); }
      });
      // rotate around the local z leans the +y axis towards +x; yaw by -a points it outward
      K.instances(penBody, penMat, bodiesP, { colors: true });
      K.instances(capG, penMat, capsP, { colors: true });
      K.instances(markerB, penMat, bodiesM, { colors: true });
      K.instances(markerC, penMat, capsM, { colors: true });
      for (let i = 0; i < 3; i++) {
        const { a, tilt } = lean(i + pens.length, pens.length + 3);
        const x = cx + Math.cos(a) * 1.4, z = cz + Math.sin(a) * 1.4;
        // pencil local +x is the tip; stand it up with the tip pointing up
        addPencil(i === 1 ? 'colour' : 'graphite', x, 9.3, z, -a, { rz: PI / 2 - tilt, color: i === 1 ? 0x3a9a4a : undefined, lead: i === 1 ? 0x2f8a3c : undefined });
      }
    }

    // ======================= desk lamp base (north edge) =======================
    {
      const cx = -31, cz = -92;
      const prof = [[0.001, 0], [9.6, 0], [9.9, 0.3], [9.9, 1.7], [9.4, 2.4], [6.5, 3.1], [2.4, 3.6], [2.0, 4.2], [0.001, 4.2]];
      const baseMat = K.std({ color: 0x23262a, roughness: 0.42, metalness: 0.65 });
      K.mesh(K.lathe(prof, 56), baseMat, cx, 0, cz);
      const brass = K.metal(0xc8a25c, 0.25);
      K.mesh(new T.CylinderGeometry(1.6, 1.9, 2.2, 24), brass, cx, 5.0, cz);
      // switch
      K.mesh(new K.RoundedBoxGeometry(2.2, 0.8, 1.4, 2, 0.3), K.plastic(0x111214, 0.4), cx + 5.6, 2.9, cz + 3.6, { ry: -0.6, rx: 0.12 });
      // arm rising up and away out of view (it does not shadow its own light)
      const arm = K.metal(0x2c2f33, 0.35);
      const a1 = K.mesh(new T.CylinderGeometry(0.75, 0.75, 90, 16), arm, cx - 4, 49, cz - 8, { rx: -0.18, rz: 0.1 });
      a1.castShadow = false;
      const a2 = K.mesh(new T.CylinderGeometry(0.4, 0.4, 88, 10), arm, cx + 0.4, 48, cz - 6.5, { rx: -0.16, rz: 0.08 });
      a2.castShadow = false;
      const spring = K.mesh(new T.CylinderGeometry(0.55, 0.55, 14, 10), K.metal(0xb0b4b8, 0.3), cx - 0.6, 12, cz - 3.4, { rx: -0.17, rz: 0.09 });
      spring.castShadow = false;
      // power cable over the back edge
      const curve = new T.CatmullRomCurve3([new T.Vector3(cx - 8, 0.35, cz - 3), new T.Vector3(cx - 14, 0.35, cz - 7), new T.Vector3(cx - 17, 0.35, BOUNDS.minZ + 0.3), new T.Vector3(cx - 18, -2, BOUNDS.minZ - 0.6), new T.Vector3(cx - 18, -40, BOUNDS.minZ - 1)]);
      K.mesh(new T.TubeGeometry(curve, 48, 0.32, 8), K.plastic(0x141416, 0.5), 0, 0, 0);
      K.circle(cx, cz, 9.9, 4.5);
      AO(cx, cz, 11, 11, 0.55);
    }

    // ======================= stack of hardcover books =======================
    let bookTop = null;
    const pageEdgeTex = (() => {
      const c = TX.makeCanvas(256, 64);
      const g = c.getContext('2d');
      g.fillStyle = '#efe6cf'; g.fillRect(0, 0, 256, 64);
      for (let y = 0; y < 64; y += 1.5) { g.fillStyle = `rgba(150,130,95,${r.range(0.05, 0.25)})`; g.fillRect(0, y, 256, 0.7); }
      return TX.toTexture(c);
    })();
    const pagesMat = K.std({ map: pageEdgeTex, roughness: 0.9 });
    const clothTex = (() => {
      const S = 128, h = new Float32Array(S * S);
      const c = TX.paint(S, S, (x, y, u, v, o) => {
        const wv = 0.5 + 0.5 * Math.sin(x * PI / 2) * Math.sin(y * PI / 2 + (x % 4 < 2 ? 0 : PI));
        const n = r() * 0.08;
        const k = 0.9 + wv * 0.08 + n;
        o[0] = o[1] = o[2] = 255 * Math.min(1, k);
        h[y * S + x] = wv * 0.7 + n;
      });
      const map = TX.toTexture(c, { repeat: [6, 6] });
      const normalMap = TX.toTexture(TX.normalFromHeight(h, S, S, 1.2), { srgb: false, repeat: [6, 6] });
      return { map, normalMap };
    })();
    const makeBook = (w, t, d, color, title, subtitle) => {
      // w along x, d along z, spine on the +z side
      const g = new T.Group();
      const cloth = K.phys({ color, roughness: 0.72, map: clothTex.map, normalMap: clothTex.normalMap, normalScale: new T.Vector2(0.6, 0.6), sheen: 0.5, sheenColor: new T.Color(0xffeedd), sheenRoughness: 0.6 });
      const bt = 0.22;
      for (const y of [bt / 2, t - bt / 2]) { const b = new T.Mesh(new K.RoundedBoxGeometry(w, bt, d, 2, 0.08), cloth); b.position.y = y; g.add(b); }
      const pg = new T.Mesh(new T.BoxGeometry(w - 0.7, t - bt * 2 + 0.02, d - 0.7), pagesMat); pg.position.set(-0.1, t / 2, -0.25); g.add(pg);
      // spine
      const sc = TX.makeCanvas(64, 512);
      const sg = sc.getContext('2d');
      sg.translate(64, 0); sg.rotate(PI / 2);
      const cc = new T.Color(color);
      sg.fillStyle = `#${cc.getHexString()}`; sg.fillRect(0, 0, 512, 64);
      sg.fillStyle = 'rgba(0,0,0,0.25)'; sg.fillRect(0, 0, 512, 6); sg.fillRect(0, 58, 512, 6);
      sg.fillStyle = '#e6c56a'; sg.fillRect(30, 8, 6, 48); sg.fillRect(476, 8, 6, 48); sg.fillRect(44, 8, 2, 48); sg.fillRect(466, 8, 2, 48);
      sg.font = '700 30px Georgia, serif'; sg.textAlign = 'center'; sg.textBaseline = 'middle'; sg.fillText(title, 230, 33);
      sg.font = '20px Georgia, serif'; sg.fillText(subtitle, 400, 34);
      const spineMat = K.phys({ map: TX.toTexture(sc, { wrap: false }), roughness: 0.7, sheen: 0.3 });
      const sp = new T.Mesh(new T.CylinderGeometry(t / 2, t / 2, w, 20, 1, true, -PI / 2, PI), spineMat);
      sp.rotation.z = PI / 2; sp.position.set(0, t / 2, d / 2 - 0.05);
      sp.scale.set(1, 1, 0.5);
      g.add(sp);
      return g;
    };
    {
      const cx = 80, cz = -36;
      const specs = [
        [26, 3.4, 19, 0x7a1e24, 'ATLAS OF THE WORLD', 'Vol. II', 0.05],
        [24, 2.8, 17, 0x1f3f6b, 'Algebra & Geometry', '9th ed.', -0.12],
        [22, 3.1, 16, 0x2f5a3a, 'A History of Ideas', '', 0.2],
        [19, 2.2, 14, 0xc79a2a, 'POEMS', 'collected', -0.05],
      ];
      let y = 0;
      specs.forEach(([w, t, d, col, title, sub, rot], i) => {
        const b = makeBook(w, t, d, col, title, sub);
        b.position.set(cx + r.range(-1, 1), y, cz + r.range(-0.8, 0.8));
        b.rotation.y = rot;
        mergeByMaterial(b);
        if (i === specs.length - 1) {
          const c = TX.makeCanvas(256, 192);
          const g = c.getContext('2d');
          g.strokeStyle = 'rgba(120,70,10,0.8)'; g.lineWidth = 3; g.strokeRect(14, 14, 228, 164); g.lineWidth = 1.2; g.strokeRect(22, 22, 212, 148);
          g.fillStyle = 'rgba(110,62,8,0.85)'; g.font = '700 34px Georgia, serif'; g.textAlign = 'center'; g.fillText('POEMS', 128, 84);
          g.font = 'italic 17px Georgia, serif'; g.fillText('of the evening lamp', 128, 116);
          g.beginPath(); g.arc(128, 145, 6, 0, 6.28); g.stroke();
          const art = new T.Mesh(new T.PlaneGeometry(w - 1, d - 1), K.std({ map: TX.toTexture(c, { wrap: false }), transparent: true, depthWrite: false, roughness: 0.4, metalness: 0.3 }));
          art.rotation.x = -PI / 2; art.position.set(0, t + 0.012, 0);
          b.add(art);
          // ribbon bookmark hanging out of the pages
          const rb = new T.Mesh(new T.BoxGeometry(0.6, 0.04, 4), K.std({ color: 0x8a1420, roughness: 0.6 }));
          rb.position.set(w / 2 - 4, t * 0.55, d / 2 + 1.6); rb.rotation.x = 0.25; b.add(rb);
        }
        K.add(b);
        y += t;
      });
      K.box(cx, cz, 13, 9.5, 0, y);
      AO(cx, cz, 14.5, 10.5, 0.45);
      AO(cx, cz, 12, 8, 0.58);
      warnRoad('books', cx, cz, 14);
      bookTop = { x: cx, y, z: cz };
    }

    // ======================= open spiral notebook (left infield) =======================
    const hand = (g, text, x, y, size, color, jitter = 0.06) => {
      g.save(); g.fillStyle = color; g.font = `italic ${size}px Georgia, "Times New Roman", serif`; g.textBaseline = 'alphabetic';
      let cx = x;
      for (const ch of text) {
        const w = g.measureText(ch).width;
        g.save(); g.translate(cx, y + r.range(-1, 1) * size * 0.05); g.rotate(r.range(-jitter, jitter)); g.fillText(ch, 0, 0); g.restore();
        cx += w * r.range(0.95, 1.05);
      }
      g.restore();
      return cx;
    };
    {
      const cx = -96, cz = 8, ang = -0.1;
      const PW = 22, PH = 30; // one page
      const c = TX.makeCanvas(1024, 698);
      const g = c.getContext('2d');
      const px = 1024 / (PW * 2);
      g.fillStyle = '#f7f5ef'; g.fillRect(0, 0, 1024, 698);
      // gutter shading
      const gs = g.createLinearGradient(440, 0, 584, 0);
      gs.addColorStop(0, 'rgba(0,0,0,0)'); gs.addColorStop(0.5, 'rgba(60,50,40,0.22)'); gs.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gs; g.fillRect(440, 0, 144, 698);
      // ruled lines and margins
      for (let y = 70; y < 690; y += 19) {
        g.strokeStyle = 'rgba(100,150,215,0.55)'; g.lineWidth = 1.4;
        g.beginPath(); g.moveTo(10, y); g.lineTo(480, y); g.moveTo(544, y); g.lineTo(1014, y); g.stroke();
      }
      g.strokeStyle = 'rgba(225,80,90,0.6)'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(70, 0); g.lineTo(70, 698); g.moveTo(604, 0); g.lineTo(604, 698); g.stroke();
      // punched holes along the binding
      g.fillStyle = 'rgba(40,30,20,0.55)';
      for (let y = 14; y < 698; y += 19.6) { g.beginPath(); g.arc(496, y, 4, 0, 6.28); g.arc(528, y, 4, 0, 6.28); g.fill(); }
      const blue = 'rgba(28,52,150,0.9)', pencil = 'rgba(70,72,80,0.85)';
      // left page: maths
      hand(g, 'Mon 14. Oct', 330, 58, 22, blue);
      hand(g, 'Quadratics', 84, 108, 30, blue);
      g.strokeStyle = blue; g.lineWidth = 2; g.beginPath(); g.moveTo(84, 114); g.lineTo(240, 116); g.stroke();
      hand(g, 'x² − 5x + 6 = 0', 90, 165, 24, blue);
      hand(g, '(x − 2)(x − 3) = 0', 90, 203, 24, blue);
      hand(g, '⇒ x₁ = 2 ,  x₂ = 3', 90, 241, 24, blue);
      hand(g, 'b² − 4ac = 25 − 24 = 1', 90, 298, 22, pencil);
      hand(g, 'a² + b² = c²', 90, 355, 24, blue);
      // sketch: parabola with axes
      g.strokeStyle = pencil; g.lineWidth = 2;
      g.beginPath(); g.moveTo(250, 640); g.lineTo(460, 640); g.moveTo(300, 660); g.lineTo(300, 420); g.stroke();
      g.strokeStyle = blue; g.lineWidth = 2.5; g.beginPath();
      for (let i = 0; i <= 40; i++) { const t = i / 40, xx = 250 + t * 200, yy = 640 - 210 * Math.pow((t - 0.55) * 2, 2) + 10; if (i) g.lineTo(xx, Math.min(650, yy)); else g.moveTo(xx, yy); }
      g.stroke();
      hand(g, 'y = x² − 5x + 6', 120, 470, 20, pencil);
      // triangle
      g.strokeStyle = blue; g.beginPath(); g.moveTo(100, 640); g.lineTo(220, 640); g.lineTo(100, 540); g.closePath(); g.stroke();
      hand(g, 'c', 168, 585, 20, blue); hand(g, 'a', 80, 595, 20, blue); hand(g, 'b', 155, 662, 20, blue);
      // right page: homework list + a race car doodle in the margin
      hand(g, 'Homework', 620, 108, 30, blue);
      g.strokeStyle = blue; g.beginPath(); g.moveTo(620, 114); g.lineTo(760, 113); g.stroke();
      hand(g, '1)  p. 84  no. 3 – 12', 625, 165, 22, blue);
      hand(g, '2)  learn vocab list 7', 625, 203, 22, blue);
      hand(g, '3)  sin 30° = ½ ,  cos 60° = ½', 625, 241, 22, blue);
      hand(g, '4)  ∑ = 1 + 2 + … + n = n(n+1)/2', 625, 279, 20, pencil);
      hand(g, 'TEST ON FRIDAY !!', 640, 355, 26, 'rgba(200,40,60,0.9)');
      g.strokeStyle = 'rgba(200,40,60,0.8)'; g.lineWidth = 2.5; g.beginPath(); g.ellipse(770, 345, 150, 28, -0.03, 0, 6.28); g.stroke();
      // race car doodle
      g.save(); g.translate(760, 560); g.strokeStyle = pencil; g.lineWidth = 3;
      g.beginPath(); g.moveTo(-120, 20); g.lineTo(-100, -10); g.lineTo(-30, -14); g.lineTo(-10, -40); g.lineTo(40, -40); g.lineTo(60, -12); g.lineTo(120, -8); g.lineTo(125, 20); g.closePath(); g.stroke();
      for (const wx of [-70, 80]) { g.beginPath(); g.arc(wx, 22, 22, 0, 6.28); g.stroke(); g.beginPath(); g.arc(wx, 22, 8, 0, 6.28); g.stroke(); }
      for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-150 - i * 12, -5 + i * 12); g.lineTo(-190 - i * 12, -5 + i * 12); g.stroke(); }
      hand(g, 'VROOM', -40, 90, 26, pencil);
      g.restore();
      const pageMat = K.std({ map: TX.toTexture(c, { wrap: false }), roughness: 0.88 });
      const grp = new T.Group();
      const coverMat = K.std({ color: 0xb8352e, roughness: 0.65, map: clothTex.map });
      const cover = new T.Mesh(new T.BoxGeometry(PW * 2 + 1.6, 0.3, PH + 1.0), coverMat); cover.position.y = 0.15; grp.add(cover);
      const stackL = new T.Mesh(new T.BoxGeometry(PW, 0.45, PH), pagesMat); stackL.position.set(-PW / 2 - 0.35, 0.52, 0); grp.add(stackL);
      const stackR = new T.Mesh(new T.BoxGeometry(PW, 0.75, PH), pagesMat); stackR.position.set(PW / 2 + 0.35, 0.67, 0); grp.add(stackR);
      // the two visible pages as one textured sheet (slight rise towards the gutter is faked by shading)
      const sheet = new T.Mesh(new T.PlaneGeometry(PW * 2 + 0.7, PH), pageMat); sheet.rotation.x = -PI / 2; sheet.position.y = 1.07; grp.add(sheet);
      grp.position.set(cx, 0, cz); grp.rotation.y = ang;
      mergeByMaterial(grp, (o) => o === sheet);
      K.add(grp);
      // wire coils
      const coilGeo = new T.TorusGeometry(0.62, 0.075, 6, 18);
      const coils = [];
      for (let i = 0; i < 36; i++) {
        const lz = -PH / 2 + 0.6 + i * ((PH - 1.2) / 35);
        coils.push({ x: cx + lz * Math.sin(ang), z: cz + lz * Math.cos(ang), y: 0.95, ry: ang, rx: 0.22 });
      }
      K.instances(coilGeo, K.metal(0xcfd3d8, 0.2), coils);
      AO(cx, cz, PW + 3, PH / 2 + 3, 0.4, ang);
      warnRoad('notebook', cx, cz, 26);
      // a pencil resting on the right page
      addPencil('graphite', cx + 10, 1.07 + LY, cz + 6, 0.6);
    }

    // ======================= calculator =======================
    {
      const cx = 52, cz = 34, ang = -0.42;
      const W = 8.6, D = 16, Hc = 1.5;
      const grp = new T.Group();
      const bodyMat = K.plastic(0x2c3036, 0.55);
      grp.add(new T.Mesh(new K.RoundedBoxGeometry(W, Hc, D, 3, 0.5), bodyMat));
      // face plate
      const fc = TX.makeCanvas(256, 480);
      const fg = fc.getContext('2d');
      fg.fillStyle = '#3a3f46'; fg.fillRect(0, 0, 256, 480);
      fg.fillStyle = '#5a3a2a'; fg.fillRect(150, 16, 90, 22); // solar cell
      fg.strokeStyle = '#2a1a12'; for (let i = 1; i < 4; i++) { fg.beginPath(); fg.moveTo(150 + i * 22.5, 16); fg.lineTo(150 + i * 22.5, 38); fg.stroke(); }
      fg.fillStyle = '#c9ccd2'; fg.font = '600 15px Rubik, sans-serif'; fg.fillText('MATH-2  scientific', 18, 32);
      fg.fillStyle = '#111'; fg.fillRect(14, 50, 228, 96);
      fg.fillStyle = '#a9b59a'; fg.fillRect(22, 58, 212, 80);
      fg.fillStyle = '#1e2418'; fg.font = '40px "Courier New", monospace'; fg.textAlign = 'right'; fg.fillText('3.14159265', 228, 120);
      fg.font = '14px monospace'; fg.textAlign = 'left'; fg.fillText('DEG', 28, 74);
      const fm = K.std({ map: TX.toTexture(fc, { wrap: false }), roughness: 0.4 });
      const face = new T.Mesh(new T.PlaneGeometry(W - 0.8, D - 0.8), fm); face.rotation.x = -PI / 2; face.position.y = Hc / 2 + 0.01; grp.add(face);
      grp.position.set(cx, Hc / 2, cz); grp.rotation.y = ang;
      K.add(grp);
      // keys
      const keyGeo = new K.RoundedBoxGeometry(1.15, 0.36, 0.78, 2, 0.14);
      const keys = [];
      const labels = [
        ['SHIFT', 'MODE', '←', '→', 'ON'], ['x²', '√', 'sin', 'cos', 'tan'], ['(', ')', 'log', 'ln', 'π'],
        ['7', '8', '9', 'DEL', 'AC'], ['4', '5', '6', '×', '÷'], ['1', '2', '3', '+', '−'], ['0', '.', 'EXP', 'Ans', '='],
      ];
      const kc = TX.makeCanvas(256, 320);
      const kg = kc.getContext('2d');
      kg.textAlign = 'center'; kg.textBaseline = 'middle';
      labels.forEach((row, ri) => row.forEach((lab, ci) => {
        const lx = -2.95 + ci * 1.48, lz = -1.6 + ri * 1.42;
        const num = /^[0-9.]$/.test(lab);
        const col = lab === 'AC' || lab === 'DEL' ? 0xd8642a : lab === '=' ? 0x3d7fd1 : num ? 0xdfe2e6 : ri < 3 ? 0x1b1d21 : 0x8e949c;
        keys.push({ x: 0, z: 0, y: Hc + 0.12, ry: ang, color: col, lx, lz });
        kg.fillStyle = num ? '#22252a' : '#f2f2f2';
        kg.font = `${lab.length > 2 ? 600 : 700} ${lab.length > 3 ? 11 : lab.length > 1 ? 14 : 20}px Rubik, sans-serif`;
        kg.fillText(lab, 128 + lx * 256 / W, (lz + 2.8) * 320 / 10.2);
      }));
      // rotate key positions into world space (local x right, local z down the calculator)
      for (const k of keys) { const c2 = Math.cos(ang), s2 = Math.sin(ang); k.x = cx + k.lx * c2 + k.lz * s2; k.z = cz - k.lx * s2 + k.lz * c2; k.ry = ang; }
      K.instances(keyGeo, K.plastic(0xffffff, 0.45), keys, { colors: true });
      const lm = K.std({ map: TX.toTexture(kc, { wrap: false }), transparent: true, depthWrite: false, roughness: 0.5 });
      const lp = new T.Mesh(new T.PlaneGeometry(W, 10.2), lm);
      lp.rotation.order = 'YXZ'; lp.rotation.y = ang; lp.rotation.x = -PI / 2;
      const c2 = Math.cos(ang), s2 = Math.sin(ang), lzc = 2.3;
      lp.position.set(cx + lzc * s2, Hc + 0.31, cz + lzc * c2);
      K.add(lp, { cast: false });
      K.box(cx, cz, W / 2, D / 2, -ang, 1.9);
      AO(cx, cz, W / 2 + 1.2, D / 2 + 1.2, 0.5, -ang);
      warnRoad('calculator', cx, cz, 10);
    }

    // ======================= smartphone (dark screen) =======================
    {
      const cx = 74, cz = 4, ang = 0.5;
      const grp = new T.Group();
      grp.add(new T.Mesh(new K.RoundedBoxGeometry(7.3, 0.8, 15, 3, 0.4), K.metal(0x6c6f75, 0.3)));
      const sc = TX.makeCanvas(128, 256);
      const sg = sc.getContext('2d');
      const gr = sg.createLinearGradient(0, 0, 128, 256);
      gr.addColorStop(0, '#15171c'); gr.addColorStop(0.45, '#08090b'); gr.addColorStop(1, '#0c0d10');
      sg.fillStyle = gr; sg.fillRect(0, 0, 128, 256);
      sg.fillStyle = '#000'; sg.beginPath(); sg.arc(64, 12, 3.5, 0, 6.28); sg.fill();
      const screen = new T.Mesh(new T.PlaneGeometry(6.9, 14.6), K.phys({ map: TX.toTexture(sc, { wrap: false }), roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6 }));
      screen.rotation.x = -PI / 2; screen.position.y = 0.41; grp.add(screen);
      grp.position.set(cx, 0.4, cz); grp.rotation.y = ang;
      K.add(grp);
      K.box(cx, cz, 3.65, 7.5, -ang, 0.8);
      AO(cx, cz, 4.6, 8.4, 0.5, -ang);
      warnRoad('phone', cx, cz, 9);
    }

    // ======================= crumpled paper balls (pushable) =======================
    {
      const crumple = (rad, seed) => {
        const rr = K.rng(seed);
        const g = new T.IcosahedronGeometry(rad, 3);
        const pos = g.attributes.position;
        const dirs = [];
        for (let i = 0; i < 14; i++) { const v = new T.Vector3(rr() - 0.5, rr() - 0.5, rr() - 0.5).normalize(); dirs.push([v, rr.range(3, 9), rr() * 6.28, rr.range(0.04, 0.11)]); }
        const v = new T.Vector3();
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i);
          const n = v.clone().normalize();
          let k = 1;
          for (const [d, f, ph, a] of dirs) k += a * (1 - Math.abs(Math.sin(n.dot(d) * f + ph))) * 1.4;
          v.copy(n).multiplyScalar(rad * k * 0.92);
          pos.setXYZ(i, v.x, v.y * 0.9, v.z);
        }
        g.computeVertexNormals();
        return g;
      };
      const mat = K.std({ map: linedTex, roughness: 0.9, flatShading: true, color: 0xf2efe6 });
      const spots = [track.place(238, -3.2), track.place(526, 2.4), track.place(657, -2.6), track.place(866, 3.2), { x: -22, z: 34 }, { x: 140, z: -78 }, { x: 18, z: -4 }];
      spots.forEach((p, i) => {
        const rad = 2.6 + (i % 3) * 0.25;
        const m = K.mesh(crumple(rad, 100 + i), mat, p.x, rad * 0.9, p.z, { ry: r() * 6 });
        K.physics.addDynamic({ x: p.x, z: p.z, r: rad, m: 0.35, h: rad * 2, mesh: m, friction: 7, baseY: rad * 0.9 });
      });
    }

    // ======================= pencil case with coloured pencils =======================
    {
      const cx = -10, cz = 54, ang = 0.12;
      const fab = TX.mottledTextures({ size: 128, a: 0x2a6574, b: 0x23545f, seed: 33, period: 32, bump: 4, speck: 0.5 });
      fab.map.repeat.set(8, 3); fab.normalMap.repeat.set(8, 3);
      const caseMat = K.std({ map: fab.map, normalMap: fab.normalMap, roughness: 0.95 });
      const body = new T.CapsuleGeometry(2.6, 15, 8, 16);
      body.rotateZ(PI / 2); body.scale(1, 0.85, 1.25);
      const m = K.mesh(body, caseMat, cx, 2.2, cz, { ry: -ang });
      // zip along the top
      const zip = K.mesh(new T.BoxGeometry(17, 0.25, 0.5), K.std({ color: 0x1b1c1f, roughness: 0.6 }), cx, 4.45, cz, { ry: -ang });
      const pull = K.mesh(new K.RoundedBoxGeometry(0.8, 0.25, 1.8, 2, 0.1), K.metal(0xc0c4ca, 0.3), cx + 6 * Math.cos(ang), 4.6, cz + 6 * Math.sin(ang), { ry: -ang + 0.5 });
      K.capsule(cx - 8.5 * Math.cos(ang), cz - 8.5 * Math.sin(ang), cx + 8.5 * Math.cos(ang), cz + 8.5 * Math.sin(ang), 3.2, 4.4);
      AO(cx, cz, 12.5, 4.5, 0.55, ang);
      // coloured pencils spilling out of the open end
      const cols = [[0xd7262e, 0xc01d26], [0x1f58c9, 0x1a4cb0], [0x2b9b47, 0x23853b], [0xf08a1c, 0xe0780e], [0x8b3fc2, 0x7731ad], [0xf5d22a, 0xe6c010], [0x6b3b1f, 0x5a3018]];
      cols.forEach(([c, l], i) => {
        const a = ang + (i - 3) * 0.11 + r.range(-0.04, 0.04);
        const ex = cx + 8.5 * Math.cos(ang), ez = cz + 8.5 * Math.sin(ang);
        const ox = ex + Math.cos(a) * (7 + (i % 2) * 2) - Math.sin(ang) * (i - 3) * 1.05, oz = ez + Math.sin(a) * (7 + (i % 2) * 2) + Math.cos(ang) * (i - 3) * 1.05;
        addPencil('colour', ox, LY, oz, -a, { color: c, lead: l, rx: (i % 3) * PI / 3 });
        AO(ox, oz, 9, 0.8, 0.3, a);
        warnRoad('colour pencil', ox + Math.cos(a) * 9, oz + Math.sin(a) * 9, 0);
      });
      warnRoad('pencil case', cx, cz, 10);
    }

    // ======================= protractor (transparent) =======================
    {
      const cx = -38, cz = 50, ang = 0.35, R = 7.6;
      const s = new T.Shape();
      s.moveTo(-R, -0.9); s.lineTo(R, -0.9); s.lineTo(R, 0); s.absarc(0, 0, R, 0, PI, false); s.lineTo(-R, -0.9);
      const hole = new T.Path(); hole.moveTo(3.6, 0.5); hole.absarc(0, 0.5, 3.6, 0, PI, false); hole.lineTo(3.6, 0.5); s.holes.push(hole);
      const g = new T.ExtrudeGeometry(s, { depth: 0.18, bevelEnabled: false, curveSegments: 48 });
      const uv = g.attributes.uv, pos = g.attributes.position;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + R) / (2 * R), (pos.getY(i) + 1) / (R + 1));
      g.rotateX(-PI / 2);
      const c = TX.makeCanvas(512, 280);
      const cg = c.getContext('2d');
      cg.fillStyle = 'rgba(210,235,255,0.35)'; cg.fillRect(0, 0, 512, 280);
      const ox = 256, oy = 280 - 280 / (R + 1) * 1, sc = 256 / R;
      cg.strokeStyle = 'rgba(15,25,45,0.9)'; cg.fillStyle = 'rgba(15,25,45,0.9)';
      for (let d = 0; d <= 180; d++) {
        const a = d * PI / 180, l = d % 10 === 0 ? 0.9 : d % 5 === 0 ? 0.6 : 0.35;
        cg.lineWidth = d % 10 === 0 ? 1.6 : 1;
        cg.beginPath(); cg.moveTo(ox + Math.cos(a) * (R - 0.15) * sc, oy - Math.sin(a) * (R - 0.15) * sc); cg.lineTo(ox + Math.cos(a) * (R - 0.15 - l) * sc, oy - Math.sin(a) * (R - 0.15 - l) * sc); cg.stroke();
      }
      cg.font = '600 13px Rubik, sans-serif'; cg.textAlign = 'center'; cg.textBaseline = 'middle';
      for (let d = 0; d <= 180; d += 10) { const a = d * PI / 180; cg.fillText(String(d), ox + Math.cos(a) * (R - 1.6) * sc, oy - Math.sin(a) * (R - 1.6) * sc); }
      cg.fillRect(ox - 1, oy - 18, 2, 18); cg.fillRect(40, oy - 1, 432, 2);
      const mat = K.phys({ map: TX.toTexture(c, { wrap: false }), transparent: true, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05, depthWrite: false, side: T.DoubleSide, envMapIntensity: 1.4 });
      const m = K.mesh(g, mat, cx, 0.02, cz, { ry: -ang, cast: false });
      AO(cx, cz, 7, 4, 0.15, ang);
      warnRoad('protractor', cx, cz, 8);
    }

    // ======================= scissors =======================
    {
      const cx = 26, cz = -18, ang = -0.6;
      const grp = new T.Group();
      const blade = new T.Shape();
      blade.moveTo(0, -0.35); blade.lineTo(7.5, -0.12); blade.quadraticCurveTo(8.4, 0.05, 7.6, 0.32); blade.lineTo(0, 0.7); blade.lineTo(-1.2, 0.5); blade.lineTo(-1.2, -0.3); blade.closePath();
      const bg = new T.ExtrudeGeometry(blade, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.05, bevelSegments: 1 });
      bg.rotateX(-PI / 2);
      const bMat = K.metal(0xdfe3e8, 0.18);
      for (const s of [-1, 1]) {
        const b = new T.Mesh(bg, bMat); b.rotation.y = s * 0.09; b.position.y = s > 0 ? 0.42 : 0.24; if (s < 0) b.scale.z = -1; grp.add(b);
        const ring = new T.Shape(); ring.absellipse(0, 0, 2.3, 1.5, 0, PI * 2, false, 0);
        const hl = new T.Path(); hl.absellipse(0, 0, 1.6, 0.95, 0, PI * 2, true, 0); ring.holes.push(hl);
        const rg = new T.ExtrudeGeometry(ring, { depth: 0.55, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 2, curveSegments: 20 });
        rg.rotateX(-PI / 2);
        const rm = new T.Mesh(rg, K.plastic(0xff6a1c, 0.35));
        rm.position.set(-3.3, 0.12, s * 1.55); rm.rotation.y = s * 0.15; grp.add(rm);
        const neck = new T.Mesh(new T.BoxGeometry(1.6, 0.5, 0.7), rm.material); neck.position.set(-1.4, 0.35, s * 0.6); neck.rotation.y = -s * 0.5; grp.add(neck);
      }
      const pivot = new T.Mesh(new T.CylinderGeometry(0.3, 0.3, 0.7, 12), darkSteel); pivot.position.set(0, 0.35, 0.15); grp.add(pivot);
      grp.position.set(cx, 0, cz); grp.rotation.y = -ang;
      K.add(grp);
      K.box(cx, cz, 6, 2.5, ang, 0.8);
      AO(cx, cz, 7.5, 3, 0.35, ang);
      warnRoad('scissors', cx, cz, 8);
    }

    // ======================= glue stick (in the U, near the lamp) =======================
    {
      const cx = -40, cz = -50, ang = 1.2;
      const lc = TX.makeCanvas(256, 128);
      const lg = lc.getContext('2d');
      lg.fillStyle = '#ffffff'; lg.fillRect(0, 0, 256, 128);
      lg.fillStyle = '#7b3fbf'; lg.fillRect(0, 0, 256, 34); lg.fillRect(0, 100, 256, 28);
      lg.fillStyle = '#7b3fbf'; lg.font = '30px "Lilita One", sans-serif'; lg.textAlign = 'center'; lg.fillText('GLUE STICK', 128, 78);
      const body = new T.CylinderGeometry(1.4, 1.4, 8.5, 24); body.rotateZ(PI / 2);
      const grp = new T.Group();
      grp.add(new T.Mesh(body, K.plastic(0xffffff, 0.35, { map: TX.toTexture(lc, { wrap: false }) })));
      const twist = new T.Mesh(new T.CylinderGeometry(1.3, 1.3, 1.4, 24).rotateZ(PI / 2), K.plastic(0x7b3fbf, 0.35)); twist.position.x = -4.9; grp.add(twist);
      const glue = new T.Mesh(new T.CylinderGeometry(1.05, 1.05, 1.2, 20).rotateZ(PI / 2), K.std({ color: 0xf4f1e6, roughness: 0.4 })); glue.position.x = 4.7; grp.add(glue);
      grp.position.set(cx, 1.4, cz); grp.rotation.y = -ang;
      mergeByMaterial(grp); K.add(grp);
      const capG = new T.CylinderGeometry(1.55, 1.55, 3.2, 24); capG.rotateZ(PI / 2);
      K.mesh(capG, K.plastic(0x7b3fbf, 0.3), cx + 8, 1.55, cz + 3, { ry: -ang - 0.7 });
      K.capsule(cx - 4.8 * Math.cos(ang), cz - 4.8 * Math.sin(ang), cx + 5.3 * Math.cos(ang), cz + 5.3 * Math.sin(ang), 1.45, 2.8);
      AO(cx, cz, 5.8, 1.9, 0.45, ang);
      AO(cx + 8, cz + 3, 2.2, 1.8, 0.45, ang + 0.7);
    }

    // ======================= pink eraser + crumbs =======================
    {
      const cx = -62, cz = 42, ang = 0.4;
      K.mesh(new K.RoundedBoxGeometry(6, 1.3, 2.3, 2, 0.32), K.std({ color: 0xf29aac, roughness: 0.8 }), cx, 0.65, cz, { ry: -ang });
      K.box(cx, cz, 3, 1.15, ang, 1.3);
      AO(cx, cz, 3.8, 1.8, 0.45, ang);
      const crumbs = [];
      for (let i = 0; i < 26; i++) crumbs.push({ x: cx + r.gauss() * 4, y: 0.12, z: cz + 3 + r.gauss() * 2.5, ry: r() * 6, s: r.range(0.12, 0.3), sx: r.range(0.3, 0.8), color: r() < 0.6 ? 0xc8a2a8 : 0x8a8488 });
      K.instances(new T.CapsuleGeometry(0.4, 1, 3, 6).rotateZ(PI / 2), K.std({ color: 0xffffff, roughness: 0.9 }), crumbs, { colors: true, cast: false });
      warnRoad('eraser', cx, cz, 5);
    }

    // ======================= highlighters & a marker beside the road =======================
    {
      const hl = (x, z, ang, col) => {
        const grp = new T.Group();
        const b = new T.CylinderGeometry(1.0, 1.0, 9, 6); b.rotateZ(PI / 2); b.scale(1, 0.8, 1.3);
        grp.add(new T.Mesh(b, K.plastic(col, 0.3)));
        const tip = new T.Mesh(new T.BoxGeometry(1.4, 0.5, 0.9), K.std({ color: col, roughness: 0.6, emissive: col, emissiveIntensity: 0.15 })); tip.position.x = 5.1; grp.add(tip);
        const cap = new T.CylinderGeometry(1.08, 1.08, 3.6, 6); cap.rotateZ(PI / 2); cap.scale(1, 0.8, 1.3);
        const cm = new T.Mesh(cap, K.plastic(col, 0.25)); cm.position.set(-6.5, 0, 0); grp.add(cm);
        const clip = new T.Mesh(new K.RoundedBoxGeometry(3, 0.35, 0.6, 2, 0.15), K.plastic(col, 0.25)); clip.position.set(-6.2, 0.95, 0); grp.add(clip);
        const lc = TX.makeCanvas(256, 64);
        const lg = lc.getContext('2d');
        lg.fillStyle = '#fafafa'; lg.fillRect(0, 0, 256, 64);
        lg.fillStyle = '#' + new T.Color(col).getHexString(); lg.fillRect(0, 0, 256, 10); lg.fillRect(0, 54, 256, 10);
        lg.fillStyle = '#222'; lg.font = '700 26px Rubik, sans-serif'; lg.textAlign = 'center'; lg.textBaseline = 'middle'; lg.fillText('TEXT MARKER', 128, 33);
        const lb = new T.CylinderGeometry(1.03, 1.03, 4.6, 6, 1, true); lb.rotateZ(PI / 2); lb.scale(1, 0.8, 1.3);
        const lm = new T.Mesh(lb, K.std({ map: TX.toTexture(lc, { wrap: false }), roughness: 0.5 })); lm.position.x = -0.6; grp.add(lm);
        grp.position.set(x, 1.0, z); grp.rotation.y = -ang;
        mergeByMaterial(grp);
        K.add(grp);
        K.capsule(x - Math.cos(ang) * 7, z - Math.sin(ang) * 7, x + Math.cos(ang) * 5, z + Math.sin(ang) * 5, 1.2, 2);
        AO(x, z, 8, 1.6, 0.45, ang);
        warnRoad('highlighter', x, z, 3);
      };
      const a = track.place(78, 12.5); hl(a.x, a.z, a.angle + 0.15, 0xff4fa0);
      const b = track.place(300, 13.5); hl(b.x, b.z, b.angle - 0.2, 0xf6ea2a);
      // black marker near the start line
      const m = track.place(38, -13);
      const grp = new T.Group();
      const body = new T.CylinderGeometry(0.85, 0.85, 11, 16); body.rotateZ(PI / 2);
      grp.add(new T.Mesh(body, K.plastic(0x1a1a1d, 0.35)));
      const cap = new T.CylinderGeometry(0.92, 0.92, 4, 16); cap.rotateZ(PI / 2);
      const cm = new T.Mesh(cap, K.plastic(0x0e0e10, 0.3)); cm.position.x = 7; grp.add(cm);
      const band = new T.Mesh(new T.CylinderGeometry(0.87, 0.87, 2.4, 16).rotateZ(PI / 2), K.std({ color: 0xe7e7e7, roughness: 0.5 })); band.position.x = -2; grp.add(band);
      grp.position.set(m.x, 0.85, m.z); grp.rotation.y = -(m.angle - 0.3);
      K.add(grp);
      AO(m.x, m.z, 7, 1.3, 0.45, m.angle - 0.3);
    }

    // ======================= sticky notes =======================
    {
      const doodles = [
        (g) => { hand(g, 'TEST', 40, 100, 52, '#22314f'); hand(g, 'Fri!', 70, 170, 52, '#c0283c'); },
        (g) => { g.strokeStyle = '#1d2b6a'; g.lineWidth = 6; g.beginPath(); g.arc(128, 128, 70, 0, 6.28); g.stroke(); g.beginPath(); g.arc(128, 135, 42, 0.2, PI - 0.2); g.stroke(); g.fillStyle = '#1d2b6a'; g.beginPath(); g.arc(102, 105, 8, 0, 6.28); g.arc(154, 105, 8, 0, 6.28); g.fill(); },
        (g) => { hand(g, 'π = 3.14159…', 22, 110, 34, '#1d2b6a'); hand(g, 'e = 2.718', 30, 170, 34, '#1d2b6a'); },
        (g) => { g.strokeStyle = '#a31d3a'; g.lineWidth = 6; g.beginPath(); for (let i = 0; i < 5; i++) { const a = -PI / 2 + i * 4 * PI / 5; const fn = i ? 'lineTo' : 'moveTo'; g[fn](128 + Math.cos(a) * 80, 128 + Math.sin(a) * 80); } g.closePath(); g.stroke(); },
        (g) => { hand(g, 'call Gran', 30, 90, 36, '#1d2b6a'); hand(g, '♥ 7pm', 60, 160, 40, '#c0283c'); },
        (g) => { hand(g, 'p. 84', 50, 100, 44, '#1d2b6a'); hand(g, '#3–12', 50, 170, 44, '#1d2b6a'); },
      ];
      const colors = ['#fbe86b', '#ff9ec4', '#a5ef8e', '#8fd3ff', '#ffc078', '#fbe86b'];
      const mk = (i, x, y, z, ang, curl = 1) => {
        const c = TX.makeCanvas(256);
        const g = c.getContext('2d');
        g.fillStyle = colors[i]; g.fillRect(0, 0, 256, 256);
        const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(0,0,0,0.06)'); gr.addColorStop(0.2, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(255,255,255,0.08)');
        g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
        doodles[i](g);
        const geo = new T.PlaneGeometry(7.6, 7.6, 6, 6);
        geo.rotateX(-PI / 2);
        const p = geo.attributes.position;
        for (let k = 0; k < p.count; k++) { const lz = p.getZ(k) / 7.6 + 0.5; p.setY(k, curl * Math.pow(Math.max(0, lz - 0.55), 2) * 2.6); }
        geo.computeVertexNormals();
        const m = K.mesh(geo, K.std({ map: TX.toTexture(c, { wrap: false }), roughness: 0.85, side: T.DoubleSide }), x, y, z, { ry: -ang, cast: false });
        AO(x, z, 4.4, 4.4, 0.22, ang, y + 0.02);
        return m;
      };
      const bt = bookTop;
      mk(0, bt.x + 9, bt.y + 0.02, bt.z - 9.5, 0.45);
      mk(1, 148, 0.05, 30, -0.3);
      mk(2, 40, 0.05, -50, 0.5);
      mk(3, -116, 0.05, 50, 0.2);
      mk(4, -12, 0.05, -78, -0.35);
      mk(5, 152, 0.05, -40, 0.6);
      // a fresh pad of notes: a stack of square sheets
      const pc = TX.makeCanvas(64, 64);
      const pg = pc.getContext('2d');
      pg.fillStyle = '#ffd84a'; pg.fillRect(0, 0, 64, 64);
      for (let y = 0; y < 64; y += 2) { pg.fillStyle = `rgba(150,110,0,${r.range(0.1, 0.3)})`; pg.fillRect(0, y, 64, 0.8); }
      const side = K.std({ map: TX.toTexture(pc), roughness: 0.85 });
      const topm = K.std({ color: 0xffe066, roughness: 0.8 });
      const pad = K.mesh(new T.BoxGeometry(7.6, 1.6, 7.6), [side, side, topm, topm, side, side], 64, 0.8, 91, { ry: 0.3 });
      AO(64, 91, 4.6, 4.6, 0.5, -0.3);
      warnRoad('note pad', 64, 91, 5);
    }

    // ======================= drawing compass + set square (south-east corner) =======================
    {
      const cx = 132, cz = 78, ang = 0.5;
      const grp = new T.Group();
      const chrome = K.metal(0xe2e5ea, 0.12);
      const legA = new T.CylinderGeometry(0.28, 0.22, 11, 10); legA.rotateZ(PI / 2);
      const l1 = new T.Mesh(legA, chrome); l1.position.set(5.5, 0.55, -0.9); l1.rotation.y = 0.09; grp.add(l1);
      const l2 = new T.Mesh(legA, chrome); l2.position.set(5.5, 0.55, 0.9); l2.rotation.y = -0.09; grp.add(l2);
      const head = new T.Mesh(new K.RoundedBoxGeometry(1.6, 1.2, 2.6, 2, 0.35), K.metal(0x9aa1aa, 0.3)); head.position.set(-0.2, 0.75, 0); grp.add(head);
      const grip = new T.Mesh(new T.CylinderGeometry(0.4, 0.4, 2.4, 12).rotateZ(PI / 2), K.plastic(0x1d1f24, 0.5)); grip.position.set(-2, 0.75, 0); grp.add(grip);
      const needle = new T.Mesh(new T.ConeGeometry(0.1, 1.4, 6).rotateZ(-PI / 2), steel); needle.position.set(11.6, 0.4, -1.9); grp.add(needle);
      const lead = new T.Mesh(new T.CylinderGeometry(0.16, 0.05, 1.2, 6).rotateZ(-PI / 2), K.std({ color: 0x2a2a2e, roughness: 0.5 })); lead.position.set(11.5, 0.4, 1.9); grp.add(lead);
      grp.position.set(cx, 0, cz); grp.rotation.y = -ang;
      K.add(grp);
      AO(cx + 5 * Math.cos(ang), cz + 5 * Math.sin(ang), 7.5, 2.4, 0.4, ang);
      // transparent 45° set square
      const sq = new T.Shape(); sq.moveTo(0, 0); sq.lineTo(16, 0); sq.lineTo(0, 16); sq.closePath();
      const hl = new T.Path(); hl.moveTo(3, 3); hl.lineTo(3, 9.4); hl.lineTo(9.4, 3); hl.closePath(); sq.holes.push(hl);
      const sg = new T.ExtrudeGeometry(sq, { depth: 0.2, bevelEnabled: false });
      const uv = sg.attributes.uv, ps = sg.attributes.position;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, ps.getX(i) / 16, ps.getY(i) / 16);
      sg.rotateX(-PI / 2);
      const c = TX.makeCanvas(256);
      const g = c.getContext('2d');
      g.fillStyle = 'rgba(255,190,120,0.35)'; g.fillRect(0, 0, 256, 256);
      g.fillStyle = 'rgba(30,20,10,0.9)';
      for (let mm = 0; mm <= 150; mm++) { const x = mm * 16 / 10 * 1.0; const l = mm % 10 === 0 ? 14 : mm % 5 === 0 ? 9 : 5; g.fillRect(x, 256 - l, 1, l); g.fillRect(0, 256 - x, l, 1); }
      g.font = '600 11px Rubik, sans-serif';
      for (let cm = 1; cm < 15; cm++) { g.fillText(String(cm), cm * 16 - 3, 256 - 17); }
      const sm = K.phys({ map: TX.toTexture(c, { wrap: false }), transparent: true, roughness: 0.06, clearcoat: 1, depthWrite: false, side: T.DoubleSide, envMapIntensity: 1.4 });
      K.mesh(sg, sm, 104, 0.02, 84, { ry: 2.9, cast: false });
      AO(97.5, 88, 5, 5, 0.12);
      warnRoad('set square', 97.5, 88, 4);
    }

    // ======================= printed worksheet (left infield) + exercise book (right infield) =======================
    {
      const c = TX.makeCanvas(512, 724);
      const g = c.getContext('2d');
      g.fillStyle = '#f8f7f2'; g.fillRect(0, 0, 512, 724);
      g.fillStyle = '#222'; g.font = '700 30px Rubik, sans-serif'; g.fillText('Worksheet 7 — Fractions', 40, 70);
      g.font = '16px Rubik, sans-serif'; g.fillText('Name: ____________________   Class: ______', 40, 104);
      g.fillRect(40, 118, 432, 2);
      const qs = ['3/4 + 1/8 =', '5/6 − 1/3 =', '2/3 × 9/10 =', '7/8 ÷ 1/4 =', '1 1/2 + 2 3/4 =', 'Simplify 18/24 =', '0.375 as a fraction =', '4/5 of 35 ='];
      g.font = '20px Rubik, sans-serif';
      qs.forEach((q, i) => { g.fillStyle = '#222'; g.fillText(`${i + 1})  ${q}`, 48, 170 + i * 62); });
      const ans = ['7/8', '1/2', '3/5', '3 1/2', '4 1/4', '3/4', '3/8', '28'];
      ans.forEach((a, i) => { if (i < 6) hand(g, a, 300, 170 + i * 62, 30, 'rgba(28,52,150,0.9)'); });
      g.strokeStyle = 'rgba(200,30,40,0.85)'; g.lineWidth = 4;
      for (let i = 0; i < 6; i++) { const y = 160 + i * 62; g.beginPath(); g.moveTo(420, y); g.lineTo(432, y + 12); g.lineTo(456, y - 16); g.stroke(); }
      hand(g, '6/8 ✓', 380, 690, 30, 'rgba(200,30,40,0.9)');
      // fold shadow
      const gr = g.createLinearGradient(0, 360, 0, 380); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.07)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 350, 512, 40);
      const ws = K.mesh(new T.PlaneGeometry(21, 29.7), K.std({ map: TX.toTexture(c, { wrap: false }), roughness: 0.9 }), -100, 0.04, -36, { rx: -PI / 2, cast: false });
      ws.rotation.order = 'YXZ'; ws.rotation.y = 0.22; ws.rotation.x = -PI / 2;
      AO(-100, -36, 11.5, 16, 0.16, -0.22);
      warnRoad('worksheet', -100, -36, 13);
      // exercise book (closed) with a handwritten label sticker
      const ec = TX.makeCanvas(256, 362);
      const eg = ec.getContext('2d');
      eg.fillStyle = '#3f7fbf'; eg.fillRect(0, 0, 256, 362);
      for (let i = 0; i < 600; i++) { eg.fillStyle = `rgba(255,255,255,${r.range(0.02, 0.07)})`; eg.fillRect(r() * 256, r() * 362, 2, 2); }
      eg.fillStyle = '#f6f2e6'; eg.fillRect(48, 70, 160, 92);
      eg.strokeStyle = '#2b4f80'; eg.lineWidth = 2; eg.strokeRect(54, 76, 148, 80);
      eg.fillStyle = '#2b4f80'; eg.font = '600 13px Rubik, sans-serif'; eg.fillText('EXERCISE BOOK', 76, 96);
      hand(eg, 'Maths', 82, 126, 24, 'rgba(20,30,60,0.95)');
      hand(eg, 'class 8b', 92, 148, 15, 'rgba(20,30,60,0.95)');
      const em = K.std({ map: TX.toTexture(ec, { wrap: false }), roughness: 0.7 });
      const book = new T.Mesh(new K.RoundedBoxGeometry(17, 0.55, 24, 2, 0.12), [pagesMat, pagesMat, em, em, pagesMat, pagesMat]);
      book.position.set(86, 0.28, 26); book.rotation.y = -0.28;
      K.add(book);
      AO(86, 26, 9.5, 13, 0.4, 0.28);
      warnRoad('exercise book', 86, 26, 14);
    }

    // ======================= loose pencils =======================
    {
      const lie = (s, off, dAng, kind = 'graphite', col, lead) => {
        const p = track.place(s, off);
        addPencil(kind, p.x, LY, p.z, -(p.angle + dAng), { color: col, lead, rx: r.pick([0, PI / 3, 2 * PI / 3]) });
        AO(p.x, p.z, 9, 0.8, 0.32, p.angle + dAng);
        warnRoad('pencil', p.x, p.z, 0);
      };
      lie(110, 14, 0.06);
      lie(250, -24, 1.2, 'colour', 0x1f58c9, 0x1a4cb0);
      lie(470, 16, -0.3);
      lie(700, 15, 0.1, 'colour', 0xd7262e, 0xc01d26);
      lie(760, 12.8, -0.1);
      addPencil('colour', -96, LY, 44, -0.5, { color: 0x2b9b47, lead: 0x23853b }); AO(-96, 44, 9, 0.8, 0.32, 0.5);
      addPencil('graphite', -98, LY + 0.05, -26, 2.75); AO(-98, -26, 9, 0.8, 0.32, -2.75);
    }

    // ======================= coins, paper clips, thumbtacks (fine scatter) =======================
    {
      // coins
      const nc = TX.makeCanvas(128);
      const ng = nc.getContext('2d');
      ng.fillStyle = '#808080'; ng.fillRect(0, 0, 128, 128);
      ng.strokeStyle = '#d0d0d0'; ng.lineWidth = 6; ng.beginPath(); ng.arc(64, 64, 58, 0, 6.28); ng.stroke();
      ng.strokeStyle = '#a0a0a0'; ng.lineWidth = 2; ng.beginPath(); ng.arc(64, 64, 48, 0, 6.28); ng.stroke();
      ng.fillStyle = '#d8d8d8'; ng.font = '700 46px Rubik, sans-serif'; ng.textAlign = 'center'; ng.textBaseline = 'middle'; ng.fillText('20', 64, 66);
      for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28; ng.beginPath(); ng.arc(64 + Math.cos(a) * 40, 64 + Math.sin(a) * 40, 2.5, 0, 6.28); ng.fill(); }
      const coinMat = K.std({ color: 0xffffff, metalness: 1, roughness: 0.32, bumpMap: TX.toTexture(nc, { srgb: false, wrap: false }), bumpScale: 1.5 });
      const coins = [];
      const coinCols = [0xd9b45a, 0xd9b45a, 0xc8ccd2, 0xb87348];
      const pile = (x, z, n, spread) => { for (let i = 0; i < n; i++) { const q = { x: x + r.gauss() * spread, z: z + r.gauss() * spread }; coins.push({ ...q, y: 0.11 + (i % 3 === 2 ? 0.2 : 0), ry: r() * 6, rx: r.range(-0.03, 0.03), color: r.pick(coinCols), s: r.range(0.9, 1.15) }); } };
      pile(104, 6, 5, 2.2); pile(-24, -62, 4, 2); pile(10, 94, 3, 1.5); pile(-140, -88, 3, 2); pile(150, 70, 4, 2.5); pile(-70, 34, 3, 2);
      K.instances(new T.CylinderGeometry(1.15, 1.15, 0.2, 32), coinMat, coins, { colors: true });
      // paper clips
      const pts = [];
      const arc = (cx, cz, rad, a0, a1, n = 10) => { for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push(new T.Vector3(cx + Math.cos(a) * rad, 0, cz + Math.sin(a) * rad)); } };
      pts.push(new T.Vector3(0.9, 0, 0)); arc(2.6, 0.18, 0.18, -PI / 2, PI / 2); arc(0.4, 0.06, 0.30, PI / 2, 1.5 * PI); arc(3.0, 0.1, 0.34, -PI / 2, PI / 2); pts.push(new T.Vector3(1.3, 0, 0.44));
      const clipGeo = new T.TubeGeometry(new T.CatmullRomCurve3(pts, false, 'catmullrom', 0.1), 90, 0.05, 5, false);
      clipGeo.translate(-1.7, 0.05, -0.1);
      const clips = [];
      const scatter = (x, z, n, spread) => { for (let i = 0; i < n; i++) clips.push({ x: x + r.gauss() * spread, y: 0, z: z + r.gauss() * spread, ry: r() * 6.28, s: 1.05, color: r() < 0.5 ? 0xdfe3e8 : r.pick([0xe0443a, 0x3a7ad8, 0x41b85a, 0xf2c230]) }); };
      scatter(-70, 30, 3, 3); scatter(66, 10, 3, 4); scatter(140, -95, 3, 3); scatter(-150, 60, 2, 2); scatter(-5, 95, 3, 4); scatter(150, 50, 2, 3); scatter(-60, -88, 3, 4);
      K.instances(clipGeo, K.std({ color: 0xffffff, metalness: 0.85, roughness: 0.25 }), clips, { colors: true });
      // thumbtacks: flat coloured heads, pin up
      const heads = [], pins = [];
      const tack = (x, z) => { const c = r.pick([0xd93a32, 0x2d6fd6, 0xf1c232, 0x3aa856, 0xc9a45a]); heads.push({ x, y: 0.05, z, color: c }); pins.push({ x, y: 0.1, z, rx: r.range(-0.12, 0.12), rz: r.range(-0.12, 0.12) }); };
      for (const [x, z] of [[146, 24], [155, 36], [142, 40], [-10, -90], [-18, -98], [60, -62], [-118, -82], [-132, 78], [108, -82]]) tack(x, z);
      K.instances(new T.CylinderGeometry(0.55, 0.55, 0.09, 20), K.phys({ color: 0xffffff, roughness: 0.25, clearcoat: 0.8, metalness: 0.2 }), heads, { colors: true });
      const pinG = new T.ConeGeometry(0.06, 0.95, 6); pinG.translate(0, 0.47, 0);
      K.instances(pinG, steel, pins);
    }

    // ======================= dust on the dark walnut (macro realism) =======================
    {
      const list = [];
      for (let i = 0; i < 160; i++) {
        const x = r.range(BOUNDS.minX + 2, BOUNDS.maxX - 2), z = r.range(BOUNDS.minZ + 2, BOUNDS.maxZ - 2);
        if (!K.offRoad(x, z, 1)) continue;
        const sz = r.range(0.04, 0.1); list.push({ x, y: 0.03, z, ry: r() * 6, s: sz, sx: sz * r.range(1, 4) });
      }
      K.instances(new T.IcosahedronGeometry(1, 0), K.std({ color: 0xcfc6b8, roughness: 1 }), list, { cast: false });
    }

    flushPencils();
    flushAO();
  },
};

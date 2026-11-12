"""Audit the lettering of every object of a world, without screenshots.

A hook records which canvases had text drawn on them. For every mesh wearing such a canvas the script works out,
from the geometry itself, how the lettering reaches the player's eye (the camera looks from the south, 62 degrees up):
  mirror   share of the visible lettering that is laid on back to front
  away     share of the lettering that faces away from the camera (1 = never seen)
  back     share seen from behind (a two-sided sheet turned the wrong way round)
  hidden   share of the camera-facing surface that something solid stands in front of
  angle    how the text runs on screen: 0 upright, +-90 sideways, 180 upside down
Only the triangles the text is printed on are counted. Lines worth a look are marked MIRROR, AWAY, BACKSIDE,
HIDDEN, UPSIDE, CUT (text drawn past the edge of its canvas) or sideways (TT_ALL=1 lists every surface).
'squeezed' lines list the text the game itself narrowed to keep it on its label (textures.js, fitText).

usage:  python lettercheck.py <worldId> [<worldId>...]
env:    TT_BASE  game URL (default http://localhost:8123/)
        TT_OUT   output folder (default ./out): letters_<world>.json
"""
import asyncio, sys, json, os
from playwright.async_api import async_playwright

BASE = os.environ.get('TT_BASE', 'http://localhost:8123/')
OUT = os.environ.get('TT_OUT', 'out')

HOOK = """
(() => {
  // remember where on its canvas every piece of text was drawn (as a box in texture coordinates)
  const P = CanvasRenderingContext2D.prototype;
  for (const fn of ['fillText', 'strokeText']) {
    const o = P[fn];
    P[fn] = function (s, x, y, ...a) {
      const c = this.canvas; s = String(s);
      try {
        const m = this.getTransform(), full = this.measureText(s).width, w = a[0] !== undefined && a[0] < full ? a[0] : full, px = parseFloat((this.font.match(/([\\d.]+)px/) || [0, 10])[1]);
        const al = this.textAlign, x0 = al === 'center' ? x - w / 2 : al === 'right' || al === 'end' ? x - w : x;
        const bl = this.textBaseline, y0 = bl === 'middle' ? y - px / 2 : bl === 'top' || bl === 'hanging' ? y : y - px * 0.8;
        let u0 = 9, u1 = -9, v0 = 9, v1 = -9;
        for (const [qx, qy] of [[x0, y0], [x0 + w, y0], [x0, y0 + px], [x0 + w, y0 + px]]) {
          const u = (m.a * qx + m.c * qy + m.e) / c.width, v = 1 - (m.b * qx + m.d * qy + m.f) / c.height;
          u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
        }
        if (s.trim().length) {
          (c.__box = c.__box || []).push([u0, u1, v0, v1, Math.atan2(m.b, m.a)]);
          // text that runs over the edge of its canvas is cut off there
          const ex = Math.max(-u0, u1 - 1, 0) * c.width, ey = Math.max(-v0 - 0.02, v1 - 1.02, 0) * c.height;
          if (ex > 3 || ey > 3) (c.__cut = c.__cut || []).push(s + ' (' + Math.round(Math.max(ex, ey)) + 'px over)');
        }
      } catch (e) { /* keep drawing */ }
      (c.__txt = c.__txt || []).push(s);
      return o.call(this, s, x, y, ...a);
    };
  }
})();
"""

AUDIT = """
(async () => {
  const T = await import('/vendor/three.bundle.js');
  const g = __tt.game, scene = g.R.scene, out = [];
  scene.updateMatrixWorld(true);
  const toCam = new T.Vector3(0, Math.sin(62 * Math.PI / 180), Math.cos(62 * Math.PI / 180));
  const sUp = new T.Vector3(0, toCam.z, -toCam.y), sRight = new T.Vector3(1, 0, 0);
  const solid = [];
  scene.traverse((m) => {
    if (!m.isMesh || !m.visible) return;
    let v = true; for (let p = m; p; p = p.parent) if (!p.visible) v = false;
    if (!v) return;
    const mat = Array.isArray(m.material) ? m.material[0] : m.material;
    if (!mat || (mat.transparent && mat.opacity < 0.9) || mat.colorWrite === false || mat.depthWrite === false) return;
    solid.push(m);
  });
  const rc = new T.Raycaster(); rc.far = 400;
  // leave out meshes the ray test cannot handle (a material slot left empty)
  for (let i = solid.length - 1; i >= 0; i--) {
    const m = solid[i], bb = new T.Box3().setFromObject(m), p = bb.getCenter(new T.Vector3());
    rc.set(p.clone().addScaledVector(new T.Vector3(0, 1, 0), 300), new T.Vector3(0, -1, 0));
    try { rc.intersectObject(m, false); } catch (e) { solid.splice(i, 1); }
  }
  const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3(), e1 = new T.Vector3(), e2 = new T.Vector3(), n = new T.Vector3(), tan = new T.Vector3(), bit = new T.Vector3(), cen = new T.Vector3();
  const ua = new T.Vector2(), ub = new T.Vector2(), uc = new T.Vector2(), mw = new T.Matrix4(), im = new T.Matrix4();
  const frac = (v) => v - Math.floor(v);
  scene.traverse((m) => {
    if (!m.isMesh || !m.geometry) return;
    let shown = true; for (let p = m; p; p = p.parent) if (!p.visible) shown = false;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const geo = m.geometry, pos = geo.attributes.position, uv = geo.attributes.uv, idx = geo.index;
    if (!pos || !uv) return;
    const nIdx = idx ? idx.count : pos.count;
    const groups = Array.isArray(m.material) && geo.groups.length ? geo.groups : [{ start: 0, count: nIdx, materialIndex: 0 }];
    const copies = m.isInstancedMesh ? Math.min(m.count, 12) : 1;
    for (let inst = 0; inst < copies; inst++) {
      mw.copy(m.matrixWorld); if (m.isInstancedMesh) { m.getMatrixAt(inst, im); mw.multiply(im); }
      const det = mw.determinant() < 0 ? -1 : 1;
      // the faces of one object that wear the same canvas are judged together (a box printed on all six sides)
      const byCanvas = new Map();
      for (const gr of groups) {
        const mat = mats[gr.materialIndex]; if (!mat) continue;
        const tex = mat.map && mat.map.image && mat.map.image.__txt ? mat.map : mat.emissiveMap && mat.emissiveMap.image && mat.emissiveMap.image.__txt ? mat.emissiveMap : null;
        if (!tex) continue;
        const cv = tex.image; if (cv.__txt.join('').trim().length < 2 || !cv.__box) continue;
        if (!byCanvas.has(cv)) byCanvas.set(cv, []);
        byCanvas.get(cv).push([gr, mat, tex]);
      }
      for (const [cv, parts] of byCanvas) {
        let area = 0, mir = 0, away = 0, back = 0, vis = 0, ax = 0, ay = 0; const samples = [], backPts = [], bb = new T.Box3();
        for (const [gr, mat, tex] of parts) {
        tex.updateMatrix();
        const wrap = tex.wrapS === T.RepeatWrapping || tex.wrapT === T.RepeatWrapping;
        const end = Math.min(gr.start + gr.count, nIdx);
        for (let i = gr.start; i + 2 < end; i += 3) {
          const i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + 1) : i + 1, i2 = idx ? idx.getX(i + 2) : i + 2;
          ua.fromBufferAttribute(uv, i0).applyMatrix3(tex.matrix); ub.fromBufferAttribute(uv, i1).applyMatrix3(tex.matrix); uc.fromBufferAttribute(uv, i2).applyMatrix3(tex.matrix);
          // only the triangles the text is actually printed on
          let tu0 = Math.min(ua.x, ub.x, uc.x), tu1 = Math.max(ua.x, ub.x, uc.x), tv0 = Math.min(ua.y, ub.y, uc.y), tv1 = Math.max(ua.y, ub.y, uc.y);
          if (wrap) { const ou = Math.floor((tu0 + tu1) / 2), ov = Math.floor((tv0 + tv1) / 2); tu0 -= ou; tu1 -= ou; tv0 -= ov; tv1 -= ov; }
          let on = false, rot = 0; for (const [u0, u1, v0, v1, ro] of cv.__box) if (tu1 > u0 && tu0 < u1 && tv1 > v0 && tv0 < v1) { on = true; rot = ro; break; }
          if (!on) continue;
          a.fromBufferAttribute(pos, i0).applyMatrix4(mw); b.fromBufferAttribute(pos, i1).applyMatrix4(mw); c.fromBufferAttribute(pos, i2).applyMatrix4(mw);
          e1.subVectors(b, a); e2.subVectors(c, a); n.crossVectors(e1, e2); const ar = n.length() / 2; if (ar < 1e-9) continue;
          n.normalize().multiplyScalar(det);
          const du1 = ub.x - ua.x, dv1 = ub.y - ua.y, du2 = uc.x - ua.x, dv2 = uc.y - ua.y, d = du1 * dv2 - du2 * dv1;
          if (Math.abs(d) < 1e-12) continue;
          tan.copy(e1).multiplyScalar(dv2).addScaledVector(e2, -dv1).multiplyScalar(1 / d);
          bit.copy(e2).multiplyScalar(du1).addScaledVector(e1, -du2).multiplyScalar(1 / d);
          if (tex.flipY === false) bit.negate();
          let facing = n.dot(toCam), mirrored = e1.crossVectors(tan, bit).dot(n) < 0;
          if (mat.side === T.BackSide) { facing = -facing; mirrored = !mirrored; }
          area += ar; bb.expandByPoint(a); bb.expandByPoint(b); bb.expandByPoint(c);
          if (facing <= 0.05) { if (mat.side === T.DoubleSide && facing < -0.05) { back += ar; backPts.push(cen.copy(a).add(b).add(c).multiplyScalar(1 / 3).clone()); } else away += ar; continue; }
          if (mirrored) mir += ar * facing;
          const w = ar * facing; vis += w;
          // the way the text runs: along u, turned by however the text itself was turned on its canvas
          tan.normalize(); bit.normalize(); tan.multiplyScalar(Math.cos(rot)).addScaledVector(bit, -Math.sin(rot));
          ax += tan.dot(sRight) * w; ay += tan.dot(sUp) * w;
          cen.copy(a).add(b).add(c).multiplyScalar(1 / 3); samples.push([cen.clone(), w]);
        }
        }
        if (!area) continue;
        // is something solid in the way?
        samples.sort((p, q) => q[1] - p[1]);
        let hid = 0, tot = 0; const blockers = {};
        const step = Math.max(1, Math.floor(samples.length / 24));
        for (let i = 0; i < samples.length; i += step) {
          const [p, w] = samples[i]; tot += w;
          rc.set(p.clone().addScaledVector(toCam, 0.06), toCam);
          const hits = rc.intersectObjects(solid, false).filter((h) => h.object !== m && h.distance > 0.02);
          if (hits.length) { hid += w; const k = hits[0].object.geometry.type.replace('Geometry', '') + '@' + hits[0].point.toArray().map((v) => v.toFixed(0)).join(','); blockers[k] = (blockers[k] || 0) + 1; }
        }
        // a sheet seen from behind only counts if nothing stands in front of it (the far panel of a tent card does not)
        if (backPts.length) {
          let seen = 0, n = 0; const st = Math.max(1, Math.floor(backPts.length / 12));
          for (let i = 0; i < backPts.length; i += st) { n++; rc.set(backPts[i].clone().addScaledVector(toCam, 0.06), toCam); if (!rc.intersectObjects(solid, false).some((h) => h.object !== m && h.distance > 0.02)) seen++; }
          back *= seen / n;
        }
        out.push({ txt: cv.__txt.filter((t) => t.trim()).slice(0, 5).join(' | ').slice(0, 70), x: +((bb.min.x + bb.max.x) / 2).toFixed(1), y: +bb.max.y.toFixed(1), z: +((bb.min.z + bb.max.z) / 2).toFixed(1),
          size: +Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z, bb.max.y - bb.min.y).toFixed(1), shown, cut: (cv.__cut || []).slice(0, 3).join('; '),
          mirror: vis ? +(mir / vis).toFixed(2) : 0, away: +(away / area).toFixed(2), back: +(back / area).toFixed(2), hidden: tot ? +(hid / tot).toFixed(2) : 0,
          angle: vis ? Math.round(Math.atan2(ay, ax) * 180 / Math.PI) : null, by: Object.entries(blockers).sort((p, q) => q[1] - p[1]).slice(0, 2).map((e) => e[0]).join(' ') });
      }
    }
  });
  return out;
})()
"""

async def world(pg, wid):
    await pg.goto(f'{BASE}?test=1&autostart=1&world={wid}&p=cpu,cpu,cpu,cpu&quality=medium&mode=race')
    await pg.wait_for_function('window.__tt && window.__tt.ready', timeout=240000)
    await pg.evaluate('__tt.step(0.2)')
    res = await pg.evaluate(AUDIT)
    fits = await pg.evaluate("import('/js/textures.js').then((m) => m.fitted.splice(0))")
    os.makedirs(OUT, exist_ok=True)
    json.dump(res, open(os.path.join(OUT, f'letters_{wid}.json'), 'w'))
    print(f'== {wid}: {len(res)} lettered surfaces', flush=True)
    for f in fits: print(f"  squeezed       {f['text'][:44]:44s} {f['over']} px of {f['width']}", flush=True)
    seen = set()
    for r in res:
        fl = []
        if not r['shown']: continue
        if r['mirror'] > 0.5: fl.append('MIRROR')
        if r['away'] > 0.9: fl.append('AWAY')
        elif r['back'] > 0.9: fl.append('BACKSIDE')
        elif r['hidden'] > 0.6: fl.append('HIDDEN')
        if r['angle'] is not None and abs(r['angle']) > 135: fl.append('UPSIDE')
        if r['cut']: fl.append('CUT')
        side = r['angle'] is not None and 45 < abs(r['angle']) <= 135
        key = (r['txt'], tuple(fl), side)
        if key in seen: continue
        seen.add(key)
        if fl or side or os.environ.get('TT_ALL'):
            print(f"  {','.join(fl) or ('sideways' if side else 'ok'):14s} {r['txt'][:44]:44s} at {r['x']},{r['y']},{r['z']} size {r['size']} mirror {r['mirror']} away {r['away']} back {r['back']} hidden {r['hidden']} angle {r['angle']} {r['by'] if 'HIDDEN' in fl else ''} {('cut: ' + r['cut']) if r['cut'] else ''}", flush=True)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width': 640, 'height': 360})
        pg.set_default_timeout(240000)
        await pg.add_init_script(HOOK)
        pg.on('pageerror', lambda e: print('PAGEERROR', e))
        for wid in sys.argv[1:]:
            try: await world(pg, wid)
            except Exception as e: print(wid, 'FAILED', str(e)[:300], flush=True)
        await b.close()

asyncio.run(main())

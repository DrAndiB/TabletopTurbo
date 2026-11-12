"""Close-ups of every lettered or drawn-on object of a world, as one contact sheet per world.

A hook records which canvases had text drawn on them; after the world is built, every mesh that wears such a canvas
as its texture is found, and the camera (the game's own angle, just closer) is put on each in turn.

usage:  python assetshots.py <worldId> [<worldId>...]
env:    TT_BASE  game URL (default http://localhost:8123/)
        TT_SKIP  leave out the first n objects (they are taken largest first)
        TT_OUT   output folder (default ./out): assets_<world>.jpg and assets_<world>.json
"""
import asyncio, sys, json, os, io
from playwright.async_api import async_playwright
from PIL import Image, ImageDraw

BASE = os.environ.get('TT_BASE', 'http://localhost:8123/')
OUT = os.environ.get('TT_OUT', 'out')
PER = 24                                   # shots per sheet; further sheets are assets_<world>_2.jpg, ...
SKIP = int(os.environ.get('TT_SKIP', '0'))  # leave out the first (largest) n objects

HOOK = """
(() => {
  const P = CanvasRenderingContext2D.prototype;
  for (const fn of ['fillText', 'strokeText']) {
    const o = P[fn];
    P[fn] = function (s, ...a) { const c = this.canvas; (c.__txt = c.__txt || []).push(String(s)); return o.call(this, s, ...a); };
  }
})();
"""

FIND = """
(() => {
  const g = __tt.game, out = [], seen = new Map();
  g.R.scene.updateMatrixWorld(true);
  g.R.scene.traverse((m) => {
    if (!m.isMesh || !m.geometry) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      if (!mat) continue;
      for (const k of ['map', 'emissiveMap']) {
        const t = mat[k], c = t && t.image;
        if (!c || !c.__txt || !c.__txt.length) continue;
        if (c.__txt.join('').length < 2) continue; // a lone digit: the start grid's numbers
        const n = seen.get(c) || 0; if (n >= 2) continue; seen.set(c, n + 1);
        if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
        const b = m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld);
        out.push({ x: (b.min.x + b.max.x) / 2, y: b.max.y, z: (b.min.z + b.max.z) / 2, sx: b.max.x - b.min.x, sy: b.max.y - b.min.y, sz: b.max.z - b.min.z, txt: c.__txt.slice(0, 4).join(' | ').slice(0, 60) });
        return;
      }
    }
  });
  return out;
})()
"""

async def world(pg, wid):
    await pg.goto(f'{BASE}?test=1&autostart=1&world={wid}&p=cpu,cpu,cpu,cpu&quality=medium&mode=race')
    await pg.wait_for_function('window.__tt && window.__tt.ready', timeout=240000)
    await pg.evaluate("document.getElementById('hud').style.display='none'; var c=document.getElementById('corner'); if (c) c.style.display='none'; 1")
    await pg.evaluate('__tt.step(0.2)')
    targets = await pg.evaluate(FIND)
    # one shot per place: drop targets that sit on top of one already taken
    keep = []
    for t in sorted(targets, key=lambda t: -max(t['sx'], t['sz'])):
        if any(abs(t['x'] - k['x']) < 3 and abs(t['z'] - k['z']) < 3 and abs(max(t['sx'], t['sz']) - max(k['sx'], k['sz'])) < 6 for k in keep): continue
        keep.append(t)
    keep = keep[SKIP:]
    tiles = []
    for i, t in enumerate(keep):
        # aim at the middle of the object's height (a point at height h shows h * 0.53 further up the screen),
        # wide enough for its footprint and for its height
        size = max(t['sx'], t['sz'], t['y'] * 1.3)  # t['y'] is the top: a label on a tall bottle needs the whole bottle in view
        w = min(150, max(22, size * 1.7))
        ymid = t['y'] - t['sy'] / 2
        await pg.evaluate(f"__tt.game.camOverride={{x:{t['x']},z:{t['z'] - ymid * 0.53},w:{w}}}; __tt.step(0.4); __tt.step(0.4)")
        png = await pg.screenshot()
        im = Image.open(io.BytesIO(png)).convert('RGB').resize((448, 256), Image.LANCZOS)
        d = ImageDraw.Draw(im); d.rectangle([0, 0, 448, 15], fill=(0, 0, 0)); d.text((3, 2), f"{i + 1 + SKIP}  {t['txt']}"[:74], fill=(255, 255, 255))
        tiles.append(im)
    os.makedirs(OUT, exist_ok=True)
    json.dump(keep, open(os.path.join(OUT, f'assets_{wid}.json'), 'w'))
    for n in range(0, len(tiles), PER):
        part = tiles[n:n + PER]
        cols = 4; rows = (len(part) + cols - 1) // cols
        sheet = Image.new('RGB', (448 * cols, 256 * rows), (30, 30, 30))
        for i, im in enumerate(part): sheet.paste(im, ((i % cols) * 448, (i // cols) * 256))
        sheet.save(os.path.join(OUT, f"assets_{wid}{'_' + str(n // PER + 1 + SKIP // PER) if n or SKIP else ''}.jpg"), quality=82)
    print(wid, len(targets), 'lettered meshes,', len(keep), 'shots', flush=True)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width': 896, 'height': 512})
        pg.set_default_timeout(240000)
        await pg.add_init_script(HOOK)
        pg.on('pageerror', lambda e: print('PAGEERROR', e))
        for wid in sys.argv[1:]:
            try: await world(pg, wid)
            except Exception as e: print(wid, 'FAILED', str(e)[:200], flush=True)
        await b.close()

asyncio.run(main())

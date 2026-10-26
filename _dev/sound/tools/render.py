"""Render the game's audio offline in headless Edge (Playwright) and save WAVs; print loudness.

usage: python -E -P render.py OUTDIR spec.json
spec.json: [{"name": "old-engine", "game": "", "world": "breakfast", "parts": ["engine"], "dur": 8}, ...]
Serves the repository root (or TT_ROOT) on http://127.0.0.1:8765 for the duration.
"""
import base64, json, os, sys, threading, functools, http.server, numpy as np, soundfile as sf, pyloudnorm as pyln
from playwright.sync_api import sync_playwright

# web root to serve: the repository root (this file is _dev/sound/tools/), or TT_ROOT
ROOT = os.environ.get('TT_ROOT') or os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 8765), functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT))
srv.RequestHandlerClass.log_message = lambda *a: None
threading.Thread(target=srv.serve_forever, daemon=True).start()

out, specs = sys.argv[1], json.load(open(sys.argv[2]))
os.makedirs(out, exist_ok=True)
meter = pyln.Meter(44100)
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', headless=True, args=['--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page()
    errs = []
    pg.on('console', lambda m: errs.append(m.text) if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8765/' + os.path.relpath(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ROOT).replace(os.sep, '/') + '/harness.html')
    pg.wait_for_function('window.harnessReady')
    for s in specs:
        b64 = pg.evaluate('(o) => window.render(o)', s)
        x = np.frombuffer(base64.b64decode(b64), np.int16).reshape(-1, 2).astype(np.float32) / 32767
        sf.write(os.path.join(out, s['name'] + '.wav'), x, 44100, subtype='PCM_16')
        skip = int(44100 * s.get('skip', 1.5))  # fades in at the start
        y = x[skip:]
        lufs = meter.integrated_loudness(y) if np.abs(y).max() > 1e-5 else float('-inf')
        print(f"{s['name']:24} {lufs:7.1f} LUFS  peak {20*np.log10(np.abs(y).max()+1e-9):6.1f} dBFS")
    for e in errs: print('console:', e)
    b.close()
srv.shutdown()

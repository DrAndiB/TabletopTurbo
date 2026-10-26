"""Play the real game headless: title -> lobby -> race on a world; report audio files fetched, buffer sources
started (by buffer length, so recordings are recognisable), console errors, and a screenshot.

usage: python -E -P test_game.py GAME_URL_PATH world_id OUT.png [seconds]
"""
import functools, http.server, json, os, sys, threading, time
from playwright.sync_api import sync_playwright

# web root to serve: the repository root (this file is _dev/sound/tools/), or TT_ROOT
ROOT = os.environ.get('TT_ROOT') or os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 8766), functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT))
http.server.SimpleHTTPRequestHandler.log_message = lambda *a: None
threading.Thread(target=srv.serve_forever, daemon=True).start()
path, world, shot = sys.argv[1], sys.argv[2], sys.argv[3]
secs = float(sys.argv[4]) if len(sys.argv) > 4 else 12

HOOK = """
window.__audio = { starts: {}, osc: 0 };
const st = AudioBufferSourceNode.prototype.start;
AudioBufferSourceNode.prototype.start = function (...a) {
  const d = this.buffer ? this.buffer.duration.toFixed(2) : '?'; window.__audio.starts[d] = (window.__audio.starts[d] || 0) + 1;
  return st.apply(this, a);
};
const os = OscillatorNode.prototype.start;
OscillatorNode.prototype.start = function (...a) { window.__audio.osc++; return os.apply(this, a); };
"""
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', headless=True, args=['--autoplay-policy=no-user-gesture-required', '--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': 1280, 'height': 720})
    pg.add_init_script(HOOK)
    log, files = [], []
    pg.on('console', lambda m: log.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: log.append(f'pageerror: {e}'))
    pg.on('response', lambda r: files.append((r.status, r.url.split('/audio/')[1])) if '/audio/' in r.url else log.append(f'{r.status} {r.url}') if r.status >= 400 else None)
    pg.goto(f'http://127.0.0.1:8766{path}/index.html?world={world}')
    pg.wait_for_selector('#screen-title.active', timeout=60000)
    pg.click('#btn-play'); pg.wait_for_selector('#screen-lobby.active')
    # pick the world in the lobby list if it's there
    btn = pg.query_selector(f'#world-list .world-card:has(.thumb[style*="img/{world}.jpg"])')
    print('world tile found:', bool(btn))
    if btn: btn.click()
    pg.click('#btn-start')
    t0 = time.time()
    pg.wait_for_function("document.body.dataset.screen === 'none'", timeout=60000)
    time.sleep(secs / 2)
    pg.keyboard.press('Escape'); time.sleep(1.5); pg.click('#btn-resume')  # pause and resume mid-race
    time.sleep(secs / 2)
    pg.screenshot(path=shot)
    fps = pg.evaluate('new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(n / 2); }; requestAnimationFrame(f); })')
    print('fps:', fps)
    a = pg.evaluate('window.__audio')
    print('files:', sorted(set(files)))
    print('buffer starts by length (s):', dict(sorted(a['starts'].items(), key=lambda kv: -kv[1])))
    print('oscillator starts:', a['osc'])
    for l in log: print(l)
    b.close()
srv.shutdown()

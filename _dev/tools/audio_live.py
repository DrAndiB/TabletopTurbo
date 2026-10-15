"""Run a real race with sound in headless Chromium and watch the Web Audio graph.

usage:  python audio_live.py [world] [seconds]      (default: watchmaker 75)
Counts every node the page creates (by type), the sources playing at any moment, nodes created inside the
per-frame engine update (must stay 0) and page errors; checks the final-lap layer, pause, mute (context
suspended) and the way back to the menu. The game clock is paced to real time so the audio clock and the
game agree. Needs the game served at TT_BASE (default http://localhost:8123/).
"""
import asyncio, json, os, sys, time
from playwright.async_api import async_playwright

BASE = os.environ.get('TT_BASE', 'http://localhost:8123/')
WORLD = sys.argv[1] if len(sys.argv) > 1 else 'watchmaker'
SECS = float(sys.argv[2]) if len(sys.argv) > 2 else 75

INIT = r"""
window.__aud = { created: {}, started: 0, inEngine: 0, engineCreated: 0 };
const A = window.__aud;
for (const k of Object.getOwnPropertyNames(BaseAudioContext.prototype)) {
  if (!k.startsWith('create')) continue;
  const d = Object.getOwnPropertyDescriptor(BaseAudioContext.prototype, k);
  if (!d || typeof d.value !== 'function') continue;
  const f = d.value;
  BaseAudioContext.prototype[k] = function (...a) { A.created[k] = (A.created[k] || 0) + 1; if (A.inEngine) A.engineCreated++; return f.apply(this, a); };
}
// the sources playing right now (AudioBufferSourceNode has its own start(): wrap both)
A.live = new Set();
Object.defineProperty(A, 'active', { get: () => A.live.size });
for (const P of [AudioScheduledSourceNode.prototype, AudioBufferSourceNode.prototype]) {
  const st = P.start;
  P.start = function (...a) {
    if (!A.live.has(this)) { A.started++; A.live.add(this); this.addEventListener('ended', () => A.live.delete(this)); }
    return st.apply(this, a);
  };
}
"""

SNAP = r"""
() => {
  const T = window.__tt, S = T.sound, g = T.game, A = window.__aud;
  const lead = g.cars.length ? Math.max(...g.cars.map((e) => e.lap)) : 0;
  return { t: +g.time.toFixed(1), state: g.state, lap: lead, ctx: S.ctx ? S.ctx.state : null, at: S.ctx ? +S.ctx.currentTime.toFixed(1) : 0,
    created: Object.values(A.created).reduce((a, b) => a + b, 0), active: A.active, engineCreated: A.engineCreated,
    music: !!(S.race && S.race.player), amb: !!(S.race && S.race.amb), final: !!(S.race && S.race.player && S.race.player.final),
    menu: !!S.menu, engines: S.engines.length, duck: +S.duckV.toFixed(2), off: S.gameOff == null ? null : +S.gameOff.toFixed(3) };
}
"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width': 640, 'height': 360})
        pg.set_default_timeout(180000)
        errors, logs = [], []
        pg.on('console', lambda m: (errors if m.type == 'error' else logs).append(f'{m.type}: {m.text}'))
        pg.on('pageerror', lambda e: errors.append(f'PAGEERROR: {e}'))
        await pg.add_init_script(INIT)
        await pg.goto(f'{BASE}?test=1&quality=low&world={WORLD}')
        await pg.wait_for_function('window.__tt && window.__tt.ready', timeout=180000)
        await pg.mouse.click(320, 180)  # the first click unlocks audio (menu theme starts)
        await asyncio.sleep(1.0)
        print('title', json.dumps(await pg.evaluate(SNAP)))
        # wrap the per-frame engine update: it must never create nodes
        await pg.evaluate("""() => { const S = __tt.sound, f = S.updateEngine.bind(S); S.updateEngine = (...a) => { __aud.inEngine++; try { return f(...a); } finally { __aud.inEngine--; } };
            __aud.cues = {}; const c = S.cue.bind(S); S.cue = (n, o) => { if (o && o.game && ['race', 'countdown', 'roundEnd'].includes(o.game.state)) __aud.cues[n] = (__aud.cues[n] || 0) + 1; return c(n, o); }; }""")
        await pg.evaluate(f"""async () => {{ const s = __tt.settings(); s.mode = 'race'; s.laps = 3; s.world = '{WORLD}';
            s.slots = [{{ type: 'cpu' }}, {{ type: 'cpu' }}, {{ type: 'cpu' }}, {{ type: 'cpu' }}]; await __tt.start(); }}""")
        # drive the game in real time from inside the page, without rendering (the audio path is the real one:
        # physics events, updateAudio, the world's animate with its cues)
        await pg.evaluate("""() => { let last = performance.now(); window.__loop = setInterval(() => {
            const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
            const g = __tt.game; if (g.state === 'paused') return;
            g.simulate(dt); g.updateAudio(); if (g.world && g.world.animate) g.world.animate(g.time, dt, g); }, 33); }""")
        rows, t0 = [], time.time()
        while time.time() - t0 < SECS:
            await asyncio.sleep(5)
            s = await pg.evaluate(SNAP); rows.append(s); print(json.dumps(s), flush=True)
            if not any(r.get('final') for r in rows) and time.time() - t0 > SECS * 0.6:
                await pg.evaluate('__tt.sound.finalLapReached()'); rows.append({'final_set': True})
        act = [r['active'] for r in rows if 'active' in r and r['state'] == 'race']
        if act: print(f'sources playing during the race: min {min(act)} max {max(act)}')
        cr = [r['created'] for r in rows if 'created' in r]
        if len(cr) > 2: print('nodes created per 5 s:', [b - a for a, b in zip(cr, cr[1:])])
        await pg.evaluate('clearInterval(window.__loop)')
        # pause / resume, mute / unmute, back to the menu
        await pg.evaluate('__tt.game.pause(true)'); await asyncio.sleep(0.6)
        print('paused', json.dumps(await pg.evaluate(SNAP)))
        await pg.evaluate('__tt.game.pause(false)'); await asyncio.sleep(0.6)
        await pg.evaluate('__tt.sound.setMuted(true)'); await asyncio.sleep(0.8)
        print('muted', json.dumps(await pg.evaluate(SNAP)))
        await pg.evaluate('__tt.sound.setMuted(false)'); await asyncio.sleep(0.8)
        print('unmuted', json.dumps(await pg.evaluate(SNAP)))
        await pg.evaluate('() => { __tt.sound.stopEngines(); __tt.game.startAttract(); __tt.lobby(); }'); await asyncio.sleep(2.5)
        print('menu', json.dumps(await pg.evaluate(SNAP)))
        print('created by type', json.dumps(await pg.evaluate('__aud.created')))
        print('cues played', json.dumps(await pg.evaluate('__aud.cues')))
        print('errors:', len(errors))
        for e in errors[:20]: print('  ', e)
        for l in logs[:10]: print('  ', l)
        await b.close()

asyncio.run(main())

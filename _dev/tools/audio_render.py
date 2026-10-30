"""Render Tabletop Turbo's synthesised audio offline (OfflineAudioContext in headless Chromium) and check it.

usage:  python audio_render.py [engines] [worlds] [menu] [--only id,id] [--sec 20] [--no-png]
        (default: everything)
  engines  each vehicle type through an acceleration sweep, a lift-off, a slide, braking, then a landing and
           bumps: _dev/tools/out/audio/engine_<type>.wav and engines.png (spectrograms side by side)
  worlds   20 s of each world's music + ambience (the final-lap layer and tempo switch on at 10 s), plus
           music alone and ambience alone for the levels: world_<id>.wav and worlds.png
  menu     the menu theme
Prints peak / RMS (dBFS) per render and flags clipping, NaN and silence. Needs the game served at TT_BASE
(default http://localhost:8123/) and Playwright; numpy and matplotlib for the spectrograms.
"""
import asyncio, base64, json, os, sys, wave, struct
from playwright.async_api import async_playwright

BASE = os.environ.get('TT_BASE', 'http://localhost:8123/')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'audio')
SR = 44100
VEHICLES = ['sports', 'formula', 'rally', 'truck', 'monster', 'suv', 'rover', 'boat', 'hover', 'snowmobile', 'bumper', 'drifter', 'buggy']
WORLDS = ['breakfast', 'garden', 'gingerbread', 'toybox', 'desk', 'bathroom', 'pool', 'watertable', 'workshop', 'boardroom',
          'mars', 'railway', 'pinball', 'chemlab', 'dollhouse', 'watchmaker', 'moselle', 'fouer', 'grund', 'oldtown', 'butter', 'pass', 'bowling', 'rooftop', 'sushi', 'vinyl', 'stage', 'volcano', 'giza', 'nile', 'tomb', 'valley']

JS = r"""
async ({ kind, id, sec, sr, music, fx }) => {
  const { Sound } = await import('/js/audio.js?' + (window.__v || ''));
  const ctx = new OfflineAudioContext(2, Math.round(sr * sec), sr);
  const s = new Sound();
  s.musicOn = music; s.fxOn = fx;
  s.attach(ctx);
  const at = (t, fn) => ctx.suspend(t).then(() => { fn(); ctx.resume(); });
  if (kind === 'engine') {
    s.createEngines(1, id);
    // 0-0.6 idle, 0.6-4.6 full throttle, 4.6-5.6 lift off, 5.6-7.2 throttle + slide, 7.2-9 brake; one-shots after 7.4
    const prof = (t) => {
      if (t < 0.6) return [0, 0, 0];
      if (t < 4.6) return [1 - Math.exp(-(t - 0.6) / 1.6), 1, 0];
      const v46 = 1 - Math.exp(-4 / 1.6);
      if (t < 5.6) return [v46 - (t - 4.6) * 0.1, 0, 0];
      if (t < 7.2) return [0.8, 1, 32];
      return [Math.max(0.15, 0.8 - (t - 7.2) * 0.45), 0, t < 8 ? 14 : 0];
    };
    // one-shots after the sweep: a landing, a car-to-car bump, a crash
    const shots = [[7.45, () => s.land(60, 0)], [7.85, () => s.bump(25, 0.3, 'car')], [8.25, () => s.crunch(35, -0.3)]];
    for (let k = 1; k / 30 < sec - 0.1; k++) {
      const t = Math.round(k / 30 * sr / 128) * 128 / sr;
      at(t, () => {
        const [sp, thr, slip] = prof(t); s.updateEngine(0, sp, thr, slip, 0, 1);
        while (shots.length && shots[0][0] <= t) shots.shift()[1]();
      });
    }
  } else {
    s.prepareRace(id);
    const game = { time: 0, state: 'race', camX: 0, camZ: 0, camW: 90, panOf: () => 0 };
    if (kind === 'menu') { s.startMusic(); s.menu.pump(sec); }
    else {
      s.raceGo(game);
      const R = s.race;
      if (R.player) R.player.pump(10); if (R.amb) R.amb.pump(10);
      if (R.player) R.player.setFinal(true);
      if (R.player) R.player.pump(sec); if (R.amb) R.amb.pump(sec);
    }
  }
  const t0 = performance.now();
  const buf = await ctx.startRendering();
  const ms = performance.now() - t0;
  if (s.race) s.raceStop(0); if (s.menu) s.stopMusic();
  const res = { ms: Math.round(ms), ch: [] };
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let peak = 0, sum = 0, nan = 0;
    const i16 = new Int16Array(d.length);
    for (let i = 0; i < d.length; i++) {
      const v = d[i];
      if (!Number.isFinite(v)) { nan++; continue; }
      const a = Math.abs(v); if (a > peak) peak = a; sum += v * v;
      i16[i] = Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
    }
    let bin = ''; const u8 = new Uint8Array(i16.buffer);
    for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    res.ch.push({ peak, rms: Math.sqrt(sum / d.length), nan, data: btoa(bin) });
  }
  return res;
}
"""

def db(x):
    import math
    return -120.0 if x <= 1e-9 else 20 * math.log10(x)

def write_wav(path, ch):
    l = base64.b64decode(ch[0]['data']); r = base64.b64decode(ch[1]['data'])
    import array
    a = array.array('h'); a.frombytes(l); b = array.array('h'); b.frombytes(r)
    inter = array.array('h', [0]) * (len(a) * 2)
    inter[0::2] = a; inter[1::2] = b
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(inter.tobytes())
    return a, b

def window_rms(a, t0, t1):
    import math
    s = a[int(t0 * SR):int(t1 * SR)]
    return math.sqrt(sum(x * x for x in s) / max(1, len(s))) / 32768

async def render(pg, **kw):
    return await pg.evaluate(JS, kw)

def report(name, r, extra=''):
    pk = max(c['peak'] for c in r['ch']); rms = max(c['rms'] for c in r['ch']); nan = sum(c['nan'] for c in r['ch'])
    flags = []
    if pk >= 0.999: flags.append('CLIP')
    if nan: flags.append(f'NaN x{nan}')
    if rms < 1e-4: flags.append('SILENT')
    print(f'{name:24s} peak {db(pk):6.1f} dBFS  rms {db(rms):6.1f} dBFS  {extra}{" ".join(flags)}  ({r["ms"]} ms)', flush=True)
    return pk, rms

async def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    only = None; sec = 20; png = '--no-png' not in sys.argv
    for i, a in enumerate(sys.argv):
        if a == '--only': only = set(sys.argv[i + 1].split(','))
        if a == '--sec': sec = float(sys.argv[i + 1])
    args = [a for a in args if a in ('engines', 'worlds', 'menu')] or ['engines', 'worlds', 'menu']
    os.makedirs(OUT, exist_ok=True)
    table = {'engines': {}, 'worlds': {}}
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page()
        pg.set_default_timeout(600000)
        logs = []
        pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}'))
        pg.on('pageerror', lambda e: logs.append(f'PAGEERROR: {e}'))
        await pg.goto(BASE + '_dev/tools/')
        await pg.evaluate('window.__v = Date.now()')
        specs = []
        if 'engines' in args:
            for v in VEHICLES:
                if only and v not in only: continue
                r = await render(pg, kind='engine', id=v, sec=9, sr=SR, music=False, fx=True)
                a, bb = write_wav(os.path.join(OUT, f'engine_{v}.wav'), r['ch'])
                full = window_rms(a, 3.0, 4.5); idle = window_rms(a, 0.1, 0.5); slide = window_rms(a, 5.8, 7.1)
                pk, rms = report('engine ' + v, r, f'full-throttle {db(full):6.1f}  idle {db(idle):6.1f}  slide {db(slide):6.1f}  ')
                table['engines'][v] = dict(peak=db(pk), rms=db(rms), full=db(full), idle=db(idle), slide=db(slide))
                specs.append(('engine', v, a))
        if 'worlds' in args:
            for wid in WORLDS:
                if only and wid not in only: continue
                rm = await render(pg, kind='world', id=wid, sec=sec, sr=SR, music=True, fx=False)
                ra = await render(pg, kind='world', id=wid, sec=sec, sr=SR, music=False, fx=True)
                rc = await render(pg, kind='world', id=wid, sec=sec, sr=SR, music=True, fx=True)
                a, bb = write_wav(os.path.join(OUT, f'world_{wid}.wav'), rc['ch'])
                write_wav(os.path.join(OUT, f'music_{wid}.wav'), rm['ch'])
                _, mr = report('music ' + wid, rm)
                _, ar = report('  ambience ' + wid, ra)
                pk, cr = report('  music+ambience ' + wid, rc)
                table['worlds'][wid] = dict(music=db(mr), ambience=db(ar), combined=db(cr), peak=db(pk), ms=rm['ms'])
                specs.append(('world', wid, a))
        if 'menu' in args:
            r = await render(pg, kind='menu', id='menu', sec=20, sr=SR, music=True, fx=False)
            write_wav(os.path.join(OUT, 'menu.wav'), r['ch'])
            pk, rms = report('menu theme', r)
            table['menu'] = dict(peak=db(pk), rms=db(rms))
        for l in logs[:40]: print(l)
        await b.close()
    with open(os.path.join(OUT, 'levels.json'), 'w') as f: json.dump(table, f, indent=1)
    if table['worlds']:
        ms = [v['music'] for v in table['worlds'].values()]
        mean = sum(ms) / len(ms)
        print(f'music RMS: mean {mean:.1f} dBFS, spread {min(ms) - mean:+.1f} .. {max(ms) - mean:+.1f} dB')
    if table['engines']:
        fs = [v['full'] for v in table['engines'].values()]
        print(f'engine full-throttle RMS: {min(fs):.1f} .. {max(fs):.1f} dBFS')
    if png and specs:
        try:
            import numpy as np
            import matplotlib
            matplotlib.use('Agg')
            import matplotlib.pyplot as plt
        except ImportError:
            print('numpy/matplotlib missing: no spectrograms'); return
        for kind, cols in (('engine', 4), ('world', 4)):
            items = [s for s in specs if s[0] == kind]
            if not items: continue
            rows = (len(items) + cols - 1) // cols
            fig, axs = plt.subplots(rows, cols, figsize=(cols * 4.2, rows * 2.6), squeeze=False)
            for ax in axs.flat: ax.axis('off')
            for ax, (_, name, a) in zip(axs.flat, items):
                ax.axis('on')
                x = np.frombuffer(a.tobytes(), dtype=np.int16).astype(np.float32) / 32768
                ax.specgram(x, NFFT=2048, Fs=SR, noverlap=1024, cmap='magma', vmin=-130, vmax=-20)
                ax.set_ylim(0, 8000 if kind == 'engine' else 6000)
                ax.set_title(name, fontsize=10); ax.tick_params(labelsize=7)
            fig.tight_layout()
            path = os.path.join(OUT, ('engines' if kind == 'engine' else 'worlds') + '.png')
            fig.savefig(path, dpi=80); plt.close(fig)
            print('wrote', path)

asyncio.run(main())

"""Build world backgrounds (beds + one-shot sprite) from raw/amb into <game>/audio/amb, print samples.js entries.

usage: python -E -P amb.py GAME_DIR world [world ...]      (worlds: keys of W below; 'all' for every one)

A bed is the calmest stretch of a recording (lowest peak above its loudness, little level swing), loop + xf
seconds long; the game crossfades copies over xf. One-shots are cut at onsets (or at given times) and packed in
one mono sprite with silence between; the printed `cuts` are [start, dur] in it.
Levels as Breakfast (which the user approved): beds -30 LUFS each, one-shots per group (lufs), played at `ev` levels.
"""
import json, os, subprocess, sys, numpy as np, soundfile as sf, pyloudnorm as pyln
from scipy.signal import butter, sosfiltfilt

FF = os.environ.get('FFMPEG', 'ffmpeg')
LAB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 44100
meter = pyln.Meter(SR)

def load(i, ch=2):
    p = os.path.join(LAB, 'raw', 'amb', f'{i}.mp3')
    if not os.path.exists(p): p = next(os.path.join(LAB, 'raw', d, f'{i}.mp3') for d in os.listdir(os.path.join(LAB, 'raw')) if os.path.exists(os.path.join(LAB, 'raw', d, f'{i}.mp3')))
    raw = subprocess.run([FF, '-v', 'error', '-i', p, '-ac', str(ch), '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, ch).astype(np.float64)

def filt(x, hp=0, lp=0):
    if hp: x = sosfiltfilt(butter(2, hp, 'highpass', fs=SR, output='sos'), x, axis=0)
    if lp: x = sosfiltfilt(butter(2, lp, 'lowpass', fs=SR, output='sos'), x, axis=0)
    return x

def lufs(x):
    if x.shape[0] < SR: x = np.tile(x, (int(SR / max(1, x.shape[0])) + 2, 1))
    return meter.integrated_loudness(x)

def norm(x, target):
    y = x * 10 ** ((target - lufs(x)) / 20); pk = np.abs(y).max()
    return y * (0.97 / pk) if pk > 0.97 else y

def fades(x, fi, fo):
    x = x.copy(); a, b = int(fi * SR), int(fo * SR)
    if a: x[:a] *= np.linspace(0, 1, a)[:, None]
    if b: x[-b:] *= np.linspace(1, 0, b)[:, None]
    return x

def mp3(x, out, kbps):
    os.makedirs(os.path.dirname(out), exist_ok=True)
    tmp = out + '.tmp.wav'; sf.write(tmp, x.astype(np.float32), SR, subtype='FLOAT')
    subprocess.run([FF, '-v', 'error', '-y', '-i', tmp, '-c:a', 'libmp3lame', '-b:a', f'{kbps}k', '-ac', str(x.shape[1]), out], check=True)
    os.remove(tmp)
    return os.path.getsize(out)

def calm_start(x, n, at=None):
    """start of the n-sample window with the smallest (peak over loudness + level swing)"""
    if at is not None: return int(at * SR)
    m = x.mean(1); hop = int(0.5 * SR); w = int(0.4 * SR)
    c = np.concatenate([[0], np.cumsum(m ** 2)]); idx = np.arange(0, len(m) - w, hop)
    env = 10 * np.log10((c[idx + w] - c[idx]) / w + 1e-12)
    pk = np.array([np.abs(m[i:i + w]).max() for i in idx]); pkd = 20 * np.log10(pk + 1e-9)
    k = n // hop; best = (1e9, 0)
    for s in range(0, max(1, len(idx) - k)):
        e = env[s:s + k]
        if len(e) == 0: continue
        score = (pkd[s:s + k] - e).max() * 0.5 + e.std() + 0.02 * (env.max() - e.mean())  # spikes, swell, not the quiet tail
        best = min(best, (score, s * hop))
    return best[1]

def onsets(x, thr_db=-30, gap=0.25):
    m = np.abs(x.mean(1)); w = int(0.005 * SR)
    env = np.convolve(m, np.ones(w) / w, 'same'); d = 20 * np.log10(env + 1e-9); d -= d.max()
    out, last = [], -1e9
    for i in np.flatnonzero((d[1:] > thr_db) & (d[:-1] <= thr_db)):
        if (i - last) / SR > gap: out.append(i); last = i
    return out

def hits(src, n, dur, thr=-30, gap=0.25, hp=150, lp=0, skip=(), fo=None):
    x = filt(load(src), hp, lp); cuts = []
    for k, i in enumerate(onsets(x, thr, gap)):
        if k in skip: continue
        a = max(0, i - int(0.01 * SR)); c = x[a:a + int(dur * SR)]
        if len(c) < dur * SR * 0.9: continue
        cuts.append(fades(c, 0.004, fo if fo else dur * 0.5))
        if len(cuts) == n: break
    return cuts

def spans(src, items, hp=150, lp=0, fi=0.05, fo=0.4):
    """explicit cuts: [(start, dur), ...]"""
    x = filt(load(src), hp, lp)
    return [fades(x[int(a * SR):int((a + d) * SR)], fi, fo) for a, d in items]

def loud(src, n, dur, hp=150, lp=0, fi=0.05, fo=0.4):
    """the n loudest non-overlapping stretches of dur seconds (where the event actually is)"""
    x = filt(load(src), hp, lp); m = x.mean(1) ** 2; w = int(dur * SR)
    if len(m) <= w: return [fades(x, fi, fo)]
    c = np.concatenate([[0], np.cumsum(m)]); hop = int(0.1 * SR); idx = np.arange(0, len(m) - w, hop)
    e = c[idx + w] - c[idx]; out = []
    for k in np.argsort(-e):
        a = idx[k]
        if all(abs(a - b) >= w for b in out): out.append(a)
        if len(out) == n: break
    return [fades(x[a:a + w], fi, fo) for a in sorted(out)]

# ---------------------------------------------------------------- worlds
# beds: (source id, loop s, xf s, hp, lp, pan, g)   fx: name -> (lufs, [cuts])   ev: [name, min gap, max gap, first, level]
def W():
    return {
    'garden': dict(note='a summer garden: birds, a breeze in the leaves; bees and a mower far off',
        beds=[(157778, 44, 2, 60, 0, 0, 0.24)],
        fx={'bee': (-26, loud(528935, 2, 4.5, fi=0.8, fo=1.2) + loud(717861, 1, 5, fi=0.8, fo=1.5)),
            'mower': (-30, loud(496734, 1, 16, fi=3, fo=4))},
        ev=[['bee', 8, 18, 4, 0.16], ['mower', 40, 70, 15, 0.13]]),
    'gingerbread': dict(note='a cosy room with a crackling fire',
        beds=[(484338, 40, 2, 80, 0, -0.2, 0.24)],
        fx={'pop': (-24, hits(370938, 8, 0.5, thr=-14, gap=0.6, hp=400))},
        ev=[['pop', 3, 9, 2, 0.15]]),
    'toybox': dict(note="a quiet child's room; wind-up toys and squeaks",
        beds=[(196267, 30, 2, 60, 0, 0, 0.24)],
        fx={'windup': (-24, loud(118816, 1, 4.5, fi=0.05, fo=0.8) + loud(376195, 1, 3, fi=0.05, fo=0.6)),
            'squeak': (-26, hits(468444, 2, 0.6, thr=-20) + hits(483921, 2, 0.6, thr=-20))},
        ev=[['windup', 9, 20, 3, 0.15], ['squeak', 12, 28, 7, 0.12]]),
    'desk': dict(note='a study: a clock ticking, pencil scratches',
        beds=[(211192, 40, 2, 60, 0, 0.2, 0.24)],
        fx={'scratch': (-26, loud(376705, 3, 2.5, fi=0.1, fo=0.6))},
        ev=[['scratch', 5, 12, 2, 0.16]]),
    'bathroom': dict(note='a bathroom: drips, the drain gurgles, bubbles',
        beds=[(641338, 22, 2, 80, 0, 0, 0.24)],
        fx={'gurgle': (-25, loud(543465, 1, 5, fi=0.2, fo=1.5)),
            'bubbles': (-26, hits(539823, 3, 1.2, thr=-20, gap=1.0))},
        ev=[['gurgle', 12, 25, 6, 0.15], ['bubbles', 6, 14, 3, 0.15]]),
    'pool': dict(note='a pub with a pool table',
        beds=[(376456, 50, 2, 80, 0, 0, 0.22)],
        fx={'clacks': (-24, hits(350918, 6, 1.4, thr=-16, gap=1.0))},
        ev=[['clacks', 6, 14, 2, 0.17]]),
    'watertable': dict(note='water lapping; gulls',
        beds=[(318064, 50, 2, 60, 0, 0, 0.24)],
        fx={'gulls': (-28, loud(510917, 3, 4, fi=0.3, fo=1.0))},
        ev=[['gulls', 10, 24, 5, 0.13]]),
    'workshop': dict(note='a wooden workshop; a radio being tuned, a drill',
        beds=[(451176, 50, 2, 60, 0, 0, 0.24)],
        fx={'radio': (-28, loud(259706, 2, 4, fi=0.3, fo=1.0)),
            'drill': (-27, loud(505054, 2, 3, fi=0.1, fo=0.6))},
        ev=[['radio', 10, 22, 4, 0.13], ['drill', 18, 35, 9, 0.13]]),
    'boardroom': dict(note='an office: air conditioning, people at work; keyboards',
        beds=[(541117, 50, 2, 80, 0, 0, 0.22)],
        fx={'typing': (-27, loud(334990, 3, 3, fi=0.1, fo=0.6))},
        ev=[['typing', 5, 12, 1.5, 0.15]]),
    'mars': dict(note='thin wind over a desert; radio blips',
        beds=[(697217, 38, 2, 40, 0, 0, 0.26)],
        fx={'beeps': (-28, loud(418963, 2, 2.6, fo=0.6) + loud(204968, 2, 3, fo=0.6))},
        ev=[['beeps', 9, 20, 3, 0.12]]),
    'railway': dict(note='open country, birds; a train passing far off',
        beds=[(458113, 50, 2, 60, 0, 0, 0.24)],
        fx={'train': (-30, loud(475501, 1, 18, hp=60, fi=4, fo=5))},
        ev=[['train', 45, 80, 20, 0.12]]),
    'pinball': dict(note='an amusement arcade; pinball bells and flippers',
        beds=[(343150, 50, 2, 80, 0, 0, 0.2)],
        fx={'ding': (-26, hits(438241, 5, 1.2, thr=-14, gap=0.8)),
            'flip': (-26, hits(450270, 4, 0.6, thr=-14, gap=0.4))},
        ev=[['ding', 4, 10, 1, 0.14], ['flip', 3, 8, 2, 0.13]]),
    'chemlab': dict(note='a lab: equipment hum, bubbling flasks',
        beds=[(688249, 50, 2, 60, 0, 0, 0.22), (95052, 18, 2, 100, 0, 0.3, 0.16)],
        fx={'boil': (-27, loud(42811, 1, 5, fi=0.5, fo=1.5))},
        ev=[['boil', 12, 24, 6, 0.13]]),
    'dollhouse': dict(note='wind howling round an old house; creaks; distant thunder',
        beds=[(815100, 50, 2, 40, 0, 0, 0.24)],
        fx={'creak': (-26, hits(428133, 6, 1.6, thr=-18, gap=1.2)),
            'thunder': (-24, loud(347562, 1, 14, hp=30, fi=0.3, fo=4))},
        ev=[['creak', 6, 14, 3, 0.15], ['thunder', 24, 45, 12, 0.18]]),
    'watchmaker': dict(note="a quiet workshop with clocks; winding",
        beds=[(520467, 50, 2, 60, 0, 0, 0.22)],
        fx={'wind': (-26, loud(171233, 1, 5, fi=0.1, fo=1.0) + loud(125320, 1, 3.5, fi=0.05, fo=0.6))},
        ev=[['wind', 14, 28, 6, 0.13]]),
    'moselle': dict(note='the Moselle valley from the Moselhöhenweg; glasses clink',
        beds=[(844067, 50, 2, 60, 0, 0, 0.24)],
        fx={'glasses': (-26, hits(235726, 5, 1.2, thr=-16, gap=0.8) + hits(458408, 1, 2.0, thr=-16))},
        ev=[['glasses', 8, 18, 3, 0.15]]),
    'fouer': dict(note='a funfair: the dodgem rink and the crowd; cheers',
        beds=[(524697, 50, 2, 60, 0, 0, 0.22), (702222, 40, 2, 80, 0, 0.3, 0.16)],
        fx={'cheer': (-26, loud(264377, 2, 5, fi=0.3, fo=1.5))},
        ev=[['cheer', 16, 32, 8, 0.13]]),
    'grund': dict(note='a stream by the old quarter; church bells now and then',
        beds=[(734931, 30, 2, 60, 0, 0, 0.22)],
        fx={'bells': (-28, loud(266525, 1, 20, hp=100, fi=1, fo=5))},
        ev=[['bells', 45, 75, 15, 0.13]]),
    'oldtown': dict(note='a town square; pigeons',
        beds=[(119934, 50, 2, 80, 0, 0, 0.22)],
        fx={'coo': (-27, loud(154865, 3, 3.5, fi=0.2, fo=0.8))},
        ev=[['coo', 6, 14, 2, 0.14]]),
    }

def build(game, wid, c):
    aud = os.path.join(game, 'audio', 'amb'); beds = []
    for k, (src, loop, xf, hp, lp, pan, g) in enumerate(c['beds']):
        x = filt(load(src), hp, lp); dur = x.shape[0] / SR
        if dur < loop + xf + 0.5: loop = round(dur - xf - 0.5, 1)
        n = int((loop + xf) * SR); a = calm_start(x, n)
        seg = norm(x[a:a + n], -30)
        name = f'{wid}-bed{k + 1}.mp3'
        kb = mp3(seg, os.path.join(aud, name), 80) // 1024
        e = {'src': f'amb/{name}', 'loop': loop, 'xf': xf, 'g': g}
        if pan: e['pan'] = pan
        beds.append(e); print(f'  {name}: from {src} @{a / SR:.1f}s, {loop}+{xf}s, {kb} KB')
    cuts = {}
    if c.get('fx'):
        pad = int(0.3 * SR); parts = [np.zeros((pad, 1))]; pos = pad
        for nm, (lv, cs) in c['fx'].items():
            cuts[nm] = []
            for cl in cs:
                cl = norm(cl.mean(1, keepdims=True), lv)
                cuts[nm].append([round((pos - int(0.02 * SR)) / SR, 3), round(cl.shape[0] / SR + 0.04, 3)])
                parts += [cl, np.zeros((pad, 1))]; pos += cl.shape[0] + pad
            if not cuts[nm]: print('  WARNING: no cuts for', nm)
        kb = mp3(np.concatenate(parts), os.path.join(aud, f'{wid}-fx.mp3'), 96) // 1024
        print(f'  {wid}-fx.mp3: {sum(map(len, cuts.values()))} cuts, {kb} KB')
    return {'note': c['note'], 'beds': beds, 'fx': {'src': f'amb/{wid}-fx.mp3', 'cuts': cuts} if cuts else None, 'ev': c['ev']}

if __name__ == '__main__':
    game, ids = sys.argv[1], sys.argv[2:]
    cfg = W(); ids = list(cfg) if ids == ['all'] else ids
    out = {}
    for w in ids:
        print(w); out[w] = build(game, w, cfg[w])
    p = os.path.join(LAB, 'work', 'amb.json'); old = json.load(open(p)) if os.path.exists(p) else {}
    old.update(out); json.dump(old, open(p, 'w'), indent=1)
    print('wrote', p)

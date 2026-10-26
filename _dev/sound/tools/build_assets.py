"""Build the game's recorded-sound files from raw/ (CC0 Freesound previews) into <game>/audio/.

usage: python -E -P build_assets.py GAME_DIR [steps...]     steps: engine beds fx (default: all)
Prints the numbers samples.js needs (loop lengths, cut positions).
"""
import json, os, subprocess, sys, numpy as np, soundfile as sf, pyloudnorm as pyln
from scipy.signal import butter, sosfiltfilt

FF = os.environ.get('FFMPEG', 'ffmpeg')
LAB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GAME = sys.argv[1]; STEPS = set(sys.argv[2:]) or {'engine', 'beds', 'fx'}
SR = 44100
AUD = os.path.join(GAME, 'audio')
meter = pyln.Meter(SR)

def load(path, ch=2):
    raw = subprocess.run([FF, '-v', 'error', '-i', path, '-ac', str(ch), '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, ch).astype(np.float64)

def raw(name): return os.path.join(LAB, 'raw', name)

def norm(x, lufs):
    l = meter.integrated_loudness(x if x.shape[0] > SR // 2 else np.tile(x, (int(SR // x.shape[0]) + 1, 1)))
    y = x * 10 ** ((lufs - l) / 20)
    pk = np.abs(y).max()
    return y * (0.97 / pk) if pk > 0.97 else y

def hp(x, f): return sosfiltfilt(butter(2, f, 'highpass', fs=SR, output='sos'), x, axis=0)

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
    print(f'  {os.path.relpath(out, GAME)}  {os.path.getsize(out) / 1024:.0f} KB  {x.shape[0] / SR:.2f}s')

info = {}

if 'engine' in STEPS:
    # loop cut by make_loop.py (seamless, doubled): just level it and encode
    for t, f in [('sports', 'sports_mid')] + [(t, t) for t in ('formula', 'rally', 'truck', 'monster', 'suv', 'boat', 'hover', 'snowmobile', 'rover', 'bumper')]:
        x, sr = sf.read(os.path.join(LAB, f'work/loops/{f}.wav'), always_2d=True)
        mp3(norm(x, -16), os.path.join(AUD, f'eng/{t}.mp3'), 96)

if 'beds' in STEPS:
    # bed = loop + xf seconds: the player crossfades the tail of one copy into the head of the next
    def bed(src, start, loop, xf, out, lufs, hpf=60):
        x = hp(load(raw(src)), hpf)
        seg = x[int(start * SR):int((start + loop + xf) * SR)]
        mp3(norm(seg, lufs), os.path.join(AUD, out), 80)
        return {'loop': loop, 'xf': xf}
    info['room'] = bed('breakfast/413852.mp3', 22, 40, 2, 'amb/breakfast-room.mp3', -30)
    info['window'] = bed('breakfast/608154.mp3', 6.5, 31, 2, 'amb/breakfast-window.mp3', -30, hpf=200)

if 'fx' in STEPS:
    # one-shots cut at their onsets, in one sprite file (mono) with silence between; cuts = [start, dur]
    def onsets(x, thr_db=-30, gap=0.25):
        m = np.abs(x.mean(1)); w = int(0.005 * SR)
        env = np.convolve(m, np.ones(w) / w, 'same'); db = 20 * np.log10(env + 1e-9)
        db -= db.max(); out, last = [], -1e9
        for i in np.flatnonzero((db[1:] > thr_db) & (db[:-1] <= thr_db)):
            if (i - last) / SR > gap: out.append(i); last = i
        return out
    def hits(src, n, dur, thr=-30, gap=0.25, skip=()):
        x = hp(load(raw(src)), 150); cuts = []
        for k, i in enumerate(onsets(x, thr, gap)):
            if k in skip: continue
            a = max(0, i - int(0.008 * SR)); c = x[a:a + int(dur * SR)]
            cuts.append(fades(c, 0.004, dur * 0.5))
            if len(cuts) == n: break
        return cuts
    groups = {
        'clink': hits('breakfast/565723.mp3', 8, 0.9, thr=-28, gap=0.18),
        'cups': [fades(hp(load(raw('breakfast/848942.mp3')), 150)[int(a * SR):int((a + d) * SR)], 0.02, 0.3) for a, d in [(1.85, 1.3), (3.3, 1.1), (6.2, 1.5)]],
        'stir': [fades(hp(load(raw('breakfast/665189.mp3')), 150)[int(a * SR):int((a + 2.6) * SR)], 0.15, 0.6) for a in (1.0, 5.2)],
        'kettle': [fades(hp(load(raw('breakfast/181718.mp3')), 200)[int(1.6 * SR):int(12.9 * SR)], 1.2, 0.5)],
    }
    LEVEL = {'clink': -22, 'cups': -22, 'stir': -24, 'kettle': -24}
    pad = int(0.3 * SR); parts = [np.zeros((pad, 1))]; pos = pad; cuts = {}
    for name, cs in groups.items():
        cuts[name] = []
        for c in cs:
            c = norm(c.mean(1, keepdims=True), LEVEL[name])
            cuts[name].append([round((pos - int(0.02 * SR)) / SR, 3), round(c.shape[0] / SR + 0.04, 3)])
            parts += [c, np.zeros((pad, 1))]; pos += c.shape[0] + pad
    mp3(np.concatenate(parts), os.path.join(AUD, 'amb/breakfast-fx.mp3'), 96)
    info['cuts'] = cuts

print(json.dumps(info))

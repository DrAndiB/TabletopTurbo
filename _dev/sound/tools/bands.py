"""Tonal balance of mixes: level per octave band relative to the whole, and the loudest sustained 3-8 kHz moments.
usage: python -E -P bands.py ref.wav other.wav ...   (first file is the reference; differences printed against it)"""
import sys, numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt
EDGES = [(40, 120), (120, 300), (300, 700), (700, 1500), (1500, 3000), (3000, 6000), (6000, 12000)]
def bands(p):
    x, sr = sf.read(p, always_2d=True); m = x.mean(1)
    tot = 10 * np.log10(np.mean(m ** 2) + 1e-12)
    out = []
    for a, b in EDGES:
        y = sosfilt(butter(4, [a, b], 'bandpass', fs=sr, output='sos'), m)
        out.append(10 * np.log10(np.mean(y ** 2) + 1e-12) - tot)
    y = sosfilt(butter(4, [3000, 8000], 'bandpass', fs=sr, output='sos'), m)
    w = int(0.4 * sr); c = np.concatenate([[0], np.cumsum(y ** 2)]); e = 10 * np.log10((c[w::w // 2] - c[:-w:w // 2][:len(c[w::w // 2])]) / w + 1e-12) - tot
    return np.array(out), np.percentile(e, 98)
ref, rp = bands(sys.argv[1])
print(f"{'file':42}" + ''.join(f'{a}-{b}'.rjust(10) for a, b in EDGES) + '   hi98')
print(f'{sys.argv[1][-42:]:42}' + ''.join(f'{v:10.1f}' for v in ref) + f'{rp:8.1f}')
for p in sys.argv[2:]:
    b, hp = bands(p)
    print(f'{p[-42:]:42}' + ''.join(f'{v - r:+10.1f}' for v, r in zip(b, ref)) + f'{hp - rp:+8.1f}')

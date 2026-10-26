"""Cut a seamless loop out of a steady recording.

usage: python -E -P make_loop.py IN OUT.wav --from S --to S --len S [--f0lo HZ --f0hi HZ] [--sr 44100] [--mono]
Searches [from, to] for the loop start/end pair whose surroundings match best (waveform correlation), crossfades
the seam, and writes the loop TWICE back to back (L L): any window of length L inside the file is then seamless, so
the game can set loopStart/loopEnd a little way in and not care about an mp3 decoder's start offset.
Prints JSON: {"loop": L seconds, "f0": reference pitch (strongest line between f0lo and f0hi) or null}.
"""
import argparse, json, os, subprocess, numpy as np, soundfile as sf

FF = os.environ.get('FFMPEG', 'ffmpeg')
ap = argparse.ArgumentParser()
ap.add_argument('inp'); ap.add_argument('out')
ap.add_argument('--from', dest='a', type=float, required=True); ap.add_argument('--to', dest='b', type=float, required=True)
ap.add_argument('--len', type=float, required=True)
ap.add_argument('--f0lo', type=float); ap.add_argument('--f0hi', type=float)
ap.add_argument('--sr', type=int, default=44100); ap.add_argument('--mono', action='store_true')
ap.add_argument('--xfade', type=float, default=0.08)
ap.add_argument('--hp', type=float, default=0, help='high-pass Hz (rumble / handling noise)')
ap.add_argument('--flat', type=float, default=0, help='even out level swells slower than this many seconds (around the loop)')
o = ap.parse_args()

ch = 1 if o.mono else 2
raw = subprocess.run([FF, '-v', 'error', '-i', o.inp, '-ac', str(ch), '-ar', str(o.sr), '-f', 'f32le', '-'], capture_output=True).stdout
x = np.frombuffer(raw, np.float32).reshape(-1, ch).astype(np.float64)
if o.hp:
    from scipy.signal import butter, sosfiltfilt
    x = sosfiltfilt(butter(2, o.hp, 'highpass', fs=o.sr, output='sos'), x, axis=0)
sr = o.sr; m = x.mean(1)
A, B, N = int(o.a * sr), int(o.b * sr), int(o.len * sr)
w = int(0.03 * sr)  # match window either side of the seam

def env_ok(i): return A + w <= i and i + N + w <= B

# coarse-to-fine search: start candidates every 10 ms, end within ±35 ms of start + len (sample steps)
best = (-2, None, None)
for i in range(A + w, B - N - w, int(0.01 * sr)):
    ref = m[i - w:i + w]; ref = ref - ref.mean(); nr = np.linalg.norm(ref) + 1e-12
    for j in range(i + N - int(0.035 * sr), i + N + int(0.035 * sr)):
        if j + w > B: break
        c = m[j - w:j + w]; c = c - c.mean()
        r = float(ref @ c) / (nr * (np.linalg.norm(c) + 1e-12))
        if r > best[0]: best = (r, i, j)
r, i, j = best
L = j - i
seg = x[i:j].copy()
# crossfade: the material just before i, faded out, blends into the loop's end so end -> start is continuous
xf = int(o.xfade * sr)
t = np.linspace(0, np.pi / 2, xf)[:, None]
seg[-xf:] = seg[-xf:] * np.cos(t) ** 2 + x[i - xf:i] * np.sin(t) ** 2  # x[i-xf:i] flows into x[i] = seg[0]
if o.flat:
    # a held-revs recording still swells; looped and sped up that becomes a throb, so ride the gain flat
    # (envelope measured around the loop, so the seam stays continuous)
    k = int(o.flat * sr); p2 = seg.mean(1) ** 2
    ring = np.concatenate([p2[-k:], p2, p2[:k]])
    env = np.sqrt(np.convolve(ring, np.hanning(k) / np.hanning(k).sum(), 'same')[k:-k])
    seg *= np.clip(np.sqrt(np.mean(p2)) / (env + 1e-9), 0.4, 2.5)[:, None]
seg *= 0.89 / (np.abs(seg).max() + 1e-12)
sf.write(o.out, np.concatenate([seg, seg]), sr, subtype='PCM_16')

f0 = None
if o.f0lo:
    s = np.abs(np.fft.rfft(seg.mean(1) * np.hanning(L)))
    fr = np.fft.rfftfreq(L, 1 / sr); k = (fr >= o.f0lo) & (fr <= o.f0hi)
    f0 = round(float(fr[k][np.argmax(s[k])]), 2)
print(json.dumps({'loop': round(L / sr, 6), 'samples': L, 'match': round(r, 4), 'start': round(i / sr, 3), 'f0': f0}))

"""Find the steadiest stretches of engine recordings (for loops): even level and a steady firing pitch.
usage: python -E -P steady.py LEN_S file1 [file2 ...] [--lo HZ --hi HZ]
Per file: duration, level, then the best 3 windows: start, level std (dB, 0.1 s RMS), pitch median and spread
(dominant line between lo and hi Hz over 0.25 s frames), relative level (dB vs the file's loudest second)."""
import argparse, os, subprocess, numpy as np
FF = os.environ.get('FFMPEG', 'ffmpeg')
ap = argparse.ArgumentParser(); ap.add_argument('len', type=float); ap.add_argument('files', nargs='+')
ap.add_argument('--lo', type=float, default=40); ap.add_argument('--hi', type=float, default=400)
o = ap.parse_args()
SR = 22050
for p in o.files:
    raw = subprocess.run([FF, '-v', 'error', '-i', p, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
    x = np.frombuffer(raw, np.float32).astype(float)
    if len(x) < SR * o.len: print(os.path.basename(p), 'too short'); continue
    hop = int(0.05 * SR); w = int(0.1 * SR)
    c = np.concatenate([[0], np.cumsum(x ** 2)])
    idx = np.arange(0, len(x) - w, hop)
    env = 10 * np.log10((c[idx + w] - c[idx]) / w + 1e-12)
    # pitch per 0.25 s frame (strongest spectral line in lo..hi), every hop
    F = int(0.25 * SR); fr = np.fft.rfftfreq(F, 1 / SR); band = (fr >= o.lo) & (fr <= o.hi); win = np.hanning(F)
    pit = np.array([fr[band][np.argmax(np.abs(np.fft.rfft(x[i:i + F] * win))[band])] if i + F <= len(x) else np.nan for i in idx])
    n = int(o.len / 0.05); loud = np.max(np.convolve(env, np.ones(20) / 20, 'valid'))
    rows = []
    for k in range(0, len(env) - n, 2):
        e = env[k:k + n]; pp = pit[k:k + n]; pp = pp[~np.isnan(pp)]
        med = np.median(pp); spread = np.median(np.abs(pp - med)) / med * 100  # % median abs dev (robust to octave jumps)
        rows.append((e.std() + spread * 0.5 - 0.05 * (e.mean() - loud), k * 0.05, e.std(), med, spread, e.mean() - loud))
    rows.sort()
    best, used = [], []
    for r in rows:
        if all(abs(r[1] - u) > o.len for u in used): best.append(r); used.append(r[1])
        if len(best) == 3: break
    print(f'{os.path.basename(p)[:40]:40} {len(x) / SR:6.1f}s')
    for _, t, sd, med, sp, rel in best:
        print(f'    @{t:6.2f}s  level std {sd:4.2f} dB  pitch {med:6.1f} Hz ±{sp:4.1f}%  rel {rel:+5.1f} dB')

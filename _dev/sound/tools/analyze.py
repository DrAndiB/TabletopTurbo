"""Measure audio files: duration, level steadiness, engine firing pitch over time; write a spectrogram PNG per file.
usage: python -I analyze.py OUTDIR file1 file2 ...   (needs ffmpeg on PATH or FFMPEG env)"""
import sys, os, subprocess, numpy as np
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
FF = os.environ.get('FFMPEG', 'ffmpeg')
def load(p, sr=22050):
    raw = subprocess.run([FF, '-v', 'error', '-i', p, '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.float32), sr
def pitch(x, sr, lo=25, hi=400):
    x = x - x.mean(); a = np.correlate(x, x, 'full')[len(x)-1:]; a /= a[0] + 1e-9
    l0, l1 = int(sr/hi), int(sr/lo); k = l0 + np.argmax(a[l0:l1]); return sr / k, a[k]
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
for p in sys.argv[2:]:
    x, sr = load(p); n = int(0.25 * sr); name = os.path.splitext(os.path.basename(p))[0]
    fr = [x[i:i+n] for i in range(0, len(x) - n, n)]
    rms = np.array([np.sqrt((f**2).mean()) for f in fr]) + 1e-9
    ps = [pitch(f[::2], sr//2) for f in fr]
    f0 = np.array([q[0] for q in ps]); cl = np.array([q[1] for q in ps])
    db = 20*np.log10(rms)
    print(f"{name:>8} {len(x)/sr:6.1f}s level {db.mean():6.1f}dB ±{db.std():4.1f}  f0 med {np.median(f0):6.1f}Hz spread {np.std(f0)/np.median(f0)*100:5.1f}%  clarity {np.median(cl):.2f}")
    fig, ax = plt.subplots(2, 1, figsize=(9, 4.5), gridspec_kw={'height_ratios': [3, 1]})
    ax[0].specgram(x, NFFT=2048, Fs=sr, noverlap=1536, cmap='magma', vmin=-110); ax[0].set_ylim(0, 4000); ax[0].set_title(name)
    ax[1].plot(np.arange(len(f0))*0.25, f0, '.'); ax[1].set_ylabel('f0 Hz')
    fig.tight_layout(); fig.savefig(os.path.join(out, name + '.png'), dpi=70); plt.close(fig)

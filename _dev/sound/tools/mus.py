"""Tiny composition kit: write parts as text, render each part through FluidSynth as a stem, mix the stems.

Notes: "A4:0.5 D5:0.5 r:1 F#5+A5:1" = pitch(es):beats, r = rest, + = several notes at once. Beats are quarter notes.
"""
import os, random, subprocess, numpy as np, soundfile as sf, mido

FS = os.environ.get('FLUIDSYNTH', os.path.expanduser(r'~\tools\fluidsynth\fluidsynth-v2.6.1-win10-x64-cpp11\bin\fluidsynth.exe'))
SF2 = os.environ.get('SF2', os.path.expanduser(r'~\tools\soundfonts\GeneralUser-GS.sf2'))
SR = 44100
PC = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}

def midi(n):
    p = PC[n[0]]; i = 1
    while i < len(n) and n[i] in '#b': p += 1 if n[i] == '#' else -1; i += 1
    return p + 12 * (int(n[i:]) + 1)

QUAL = {'': (0, 4, 7), 'm': (0, 3, 7), '7': (0, 4, 7, 10), 'm7': (0, 3, 7, 10), 'maj7': (0, 4, 7, 11), 'sus4': (0, 5, 7), 'sus2': (0, 2, 7), '6': (0, 4, 7, 9), 'add9': (0, 4, 7, 14)}
def chord(sym):
    """'F#m7' -> (root pc, [intervals]); slash bass ignored here (see bass parts)."""
    sym = sym.split('/')[0]
    r = sym[0]; i = 1
    if i < len(sym) and sym[i] in '#b': r += sym[i]; i += 1
    return midi(r + '0') % 12, QUAL[sym[i:]]

def voicing(sym, center, n=4):
    """close voicing of the chord's tones nearest `center` (midi), n notes"""
    root, iv = chord(sym)
    pcs = [(root + x) % 12 for x in iv]
    cand = sorted(m for m in range(center - 12, center + 13) if m % 12 in pcs)
    cand.sort(key=lambda m: abs(m - center))
    return sorted(cand[:n])

class Part:
    def __init__(self, name, program, ch, vol=100, pan=64, rev=40, cho=0, bank=0):
        self.name, self.program, self.ch, self.vol, self.pan, self.rev, self.cho, self.bank = name, program, ch, vol, pan, rev, cho, bank
        self.notes = []  # (beat, dur, midi, vel)
    def add(self, beat, dur, m, vel):
        self.notes.append((beat, dur, m, max(1, min(127, int(vel)))))
    def seq(self, beat, text, vel=90, legato=0.92, hum=0.0, accent=None):
        """text notes from `beat`; returns the beat after the last one. accent(beat_in_bar) -> velocity offset"""
        for tok in text.split():
            p, d = tok.split(':'); d = float(d)
            if p != 'r':
                for q in p.split('+'):
                    v = vel + (accent(beat % 4) if accent else 0) + random.uniform(-hum, hum) * 10
                    self.add(beat + random.uniform(-hum, hum) * 0.02, d * legato, midi(q), v)
            beat += d
        return beat

def write(parts, bpm, path, end_beat):
    """one MIDI file with these parts; ends at end_beat (so the tail rings to there)"""
    mf = mido.MidiFile(ticks_per_beat=960); tpb = 960
    t0 = mido.MidiTrack(); mf.tracks.append(t0)
    t0.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(bpm), time=0))
    for P in parts:
        tr = mido.MidiTrack(); mf.tracks.append(tr)
        ev = [(0, mido.Message('control_change', channel=P.ch, control=0, value=P.bank)),
              (0, mido.Message('program_change', channel=P.ch, program=P.program)),
              (0, mido.Message('control_change', channel=P.ch, control=7, value=P.vol)),
              (0, mido.Message('control_change', channel=P.ch, control=10, value=P.pan)),
              (0, mido.Message('control_change', channel=P.ch, control=91, value=P.rev)),
              (0, mido.Message('control_change', channel=P.ch, control=93, value=P.cho))]
        for b, d, m, v in P.notes:
            a = max(0, round(b * tpb)); e = max(a + 1, round((b + d) * tpb))
            ev.append((a, mido.Message('note_on', channel=P.ch, note=m, velocity=v)))
            ev.append((e, mido.Message('note_off', channel=P.ch, note=m, velocity=0)))
        ev.append((round(end_beat * tpb), mido.Message('control_change', channel=P.ch, control=121, value=0)))
        ev.sort(key=lambda x: (x[0], 0 if x[1].type == 'note_off' else 1))
        now = 0
        for a, msg in ev: tr.append(msg.copy(time=a - now)); now = a
    t0.append(mido.MetaMessage('end_of_track', time=round(end_beat * tpb)))
    mf.save(path)

def render(mid, wav, gain=0.6):
    subprocess.run([FS, '-ni', '-q', '-g', str(gain), '-r', str(SR), '-R', '1', '-C', '0', '-F', wav, SF2, mid], check=True, capture_output=True)
    x, sr = sf.read(wav, always_2d=True); assert sr == SR
    return x

def stems(parts, bpm, end_beat, workdir, n_samples):
    """render each part alone -> {name: stereo array of n_samples}"""
    os.makedirs(workdir, exist_ok=True); out = {}
    for P in parts:
        if not P.notes: continue
        mid = os.path.join(workdir, P.name + '.mid'); wav = os.path.join(workdir, P.name + '.wav')
        write([P], bpm, mid, end_beat)
        x = render(mid, wav)
        y = np.zeros((n_samples, 2)); k = min(n_samples, len(x)); y[:k] = x[:k]
        out[P.name] = y
    return out

# ---------------------------------------------------------------- mixing helpers
def db(x): return 10 ** (x / 20)

def comp(x, thr=-18, ratio=3, att=0.005, rel=0.12, makeup=0):
    """feed-forward RMS-ish compressor on a stereo signal (linked)"""
    from scipy.signal import lfilter
    lvl = np.abs(x).max(1)
    a_a, a_r = np.exp(-1 / (att * SR)), np.exp(-1 / (rel * SR))
    env = np.empty_like(lvl); e = 0.0
    # simple attack/release follower (python loop on a decimated signal, then upsampled)
    step = 32; l2 = lvl[: len(lvl) // step * step].reshape(-1, step).max(1)
    a_a2, a_r2 = a_a ** step, a_r ** step; env2 = np.empty_like(l2)
    for i, v in enumerate(l2):
        e = a_a2 * e + (1 - a_a2) * v if v > e else a_r2 * e + (1 - a_r2) * v
        env2[i] = e
    env = np.repeat(env2, step); env = np.concatenate([env, np.full(len(lvl) - len(env), env[-1] if len(env) else 0)])
    edb = 20 * np.log10(env + 1e-9)
    gdb = np.where(edb > thr, (thr - edb) * (1 - 1 / ratio), 0) + makeup
    return x * db(gdb)[:, None]

def eq(x, kind, f, q=0.7, gain_db=0):
    from scipy.signal import butter, sosfilt
    if kind in ('highpass', 'lowpass'):
        return sosfilt(butter(2, f, kind, fs=SR, output='sos'), x, axis=0)
    # peaking / shelf (RBJ biquads)
    from scipy.signal import lfilter
    A = 10 ** (gain_db / 40); w = 2 * np.pi * f / SR; al = np.sin(w) / (2 * q); c = np.cos(w)
    if kind == 'peak':
        b = [1 + al * A, -2 * c, 1 - al * A]; a = [1 + al / A, -2 * c, 1 - al / A]
    elif kind == 'highshelf':
        sA = np.sqrt(A); b = [A * ((A + 1) + (A - 1) * c + 2 * sA * al), -2 * A * ((A - 1) + (A + 1) * c), A * ((A + 1) + (A - 1) * c - 2 * sA * al)]
        a = [(A + 1) - (A - 1) * c + 2 * sA * al, 2 * ((A - 1) - (A + 1) * c), (A + 1) - (A - 1) * c - 2 * sA * al]
    elif kind == 'lowshelf':
        sA = np.sqrt(A); b = [A * ((A + 1) - (A - 1) * c + 2 * sA * al), 2 * A * ((A - 1) - (A + 1) * c), A * ((A + 1) - (A - 1) * c - 2 * sA * al)]
        a = [(A + 1) + (A - 1) * c + 2 * sA * al, -2 * ((A - 1) + (A + 1) * c), (A + 1) + (A - 1) * c - 2 * sA * al]
    return lfilter(np.array(b) / a[0], np.array(a) / a[0], x, axis=0)

def loudness(x):
    import pyloudnorm as pyln
    return pyln.Meter(SR).integrated_loudness(x)

def wrap(x, n_loop):
    """fold the tail (past one loop) onto the head: what a seamless loop of the piece sounds like, for checking"""
    y = x[:n_loop].copy(); t = x[n_loop:]; y[:len(t)] += t[:n_loop]; return y

"""Fouer Frenzy (the Luxembourg funfair): band-organ march in F, 128 bpm, 32 bars = 60 s.
A (F) | B (C, dominant) | A' (glockenspiel joins, organ thirds) | Trio (Bb, quieter: reed organ alone over a soft pad,
then piccolo and a snare build on C7 back into the top). Piccolo + reed-organ lead, oom-pah tuba, drawbar organ on the
off-beats, bass drum + cymbal + snare. Final layer: snare 16th roll pattern + a glockenspiel doubling of the tune."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'tools'))
from song import *

S = Song('fouer', 128, 32, seed=9)
A_CH = ['F', 'C7', 'F', 'Bb', 'F', 'C7', 'F C7', 'F']
B_CH = ['C', 'G7', 'C', 'F', 'Dm', 'G7', 'C', 'C7']
T_CH = ['Bb', 'F7', 'Bb', 'Eb', 'Bb', 'F7', 'Bb', 'C7']
S.set_chart(A_CH + B_CH + A_CH + T_CH)
SEC = lambda b: 'A' if b < 8 else 'B' if b < 16 else 'A2' if b < 24 else 'T' if b < 30 else 'TB'
F_MAJ = {5, 7, 9, 10, 0, 2, 4}
S.scale = F_MAJ

kit = S.part('kit', 0, 9, vol=108, rev=25)
tuba = S.part('tuba', 58, 0, vol=104, rev=20)
org = S.part('org', 16, 1, vol=80, pan=44, rev=35)
picc = S.part('picc', 72, 2, vol=96, pan=66, rev=40)
reed = S.part('reed', 20, 3, vol=96, pan=60, rev=40)
glock = S.part('glock', 9, 4, vol=86, pan=84, rev=50)
reed2 = S.part('reed2', 20, 5, vol=88, pan=40, rev=40)
pad = S.part('pad', 19, 6, vol=70, pan=64, rev=60)       # church organ, soft, under the trio
fkit = S.part('fkit', 0, 9, final=True, vol=100, rev=20)
fglock = S.part('fglock', 9, 7, final=True, vol=84, pan=30, rev=50)

A = ['C5:0.5 F5:0.5 A5:0.75 G5:0.25 F5:0.5 A5:0.5 C6:1', 'Bb5:0.75 A5:0.25 G5:0.5 E5:0.5 C5:1 r:0.5 C5:0.5',
     'A5:0.5 C6:0.5 F6:0.75 E6:0.25 D6:0.5 C6:0.5 A5:1', 'Bb5:1 D6:0.75 C6:0.25 Bb5:0.5 F5:0.5 D5:1',
     'C5:0.5 F5:0.5 A5:0.75 G5:0.25 F5:0.5 A5:0.5 C6:1', 'E6:0.75 D6:0.25 C6:0.5 Bb5:0.5 G5:1 E5:1',
     'F5:0.5 A5:0.5 C6:0.5 A5:0.5 G5:0.5 Bb5:0.5 E5:0.5 G5:0.5', 'F5:1.5 C5:0.5 F5:1 r:1']
B = ['E5:0.5 G5:0.5 C6:1 C6:0.75 D6:0.25 E6:1', 'D6:0.75 C6:0.25 B5:0.5 G5:0.5 F5:1 D5:1',
     'E5:0.5 G5:0.5 C6:0.5 E6:0.5 G6:1.5 E6:0.5', 'F6:0.75 E6:0.25 D6:0.5 C6:0.5 A5:1 F5:1',
     'D5:0.5 F5:0.5 A5:0.5 D6:0.5 F6:1 E6:0.5 D6:0.5', 'B5:1 D6:0.75 C6:0.25 B5:0.5 G5:0.5 F5:1',
     'E5:0.5 G5:0.5 C6:0.75 D6:0.25 E6:1 C6:1', 'Bb5:0.75 A5:0.25 G5:0.5 E5:0.5 C5:1 r:1']
A2 = A[:7] + ['F5:1 A5:0.5 C6:0.5 F5:1 D5:1']
T = ['D6:1.5 C6:0.5 Bb5:1 F5:1', 'Eb6:1.5 D6:0.5 C6:1 A5:1', 'Bb5:1 D6:1 F6:1.5 D6:0.5', 'Eb6:1.5 G5:0.5 Bb5:1 Eb6:1',
     'D6:1.5 F6:0.5 D6:1 Bb5:1', 'C6:1 A5:0.5 Bb5:0.5 C6:1 Eb6:1',
     'D6:0.5 C6:0.5 Bb5:0.5 A5:0.5 Bb5:0.5 D6:0.5 F6:1', 'G6:1 E6:0.5 C6:0.5 Bb5:0.5 G5:0.5 E5:0.5 G5:0.5']
TUNE = A + B + A2 + T
acc = lambda b: 8 if b in (0, 2) else 0
S.melody(picc, 0, A + B + A2, 88, legato=0.8, accent=acc)
S.melody(picc, 30, T[6:], 86, legato=0.8, accent=acc)
oct_down = lambda bars: [' '.join(t if t[0] == 'r' else '+'.join(n[:-1] + str(int(n[-1]) - 1) for n in t.split(':')[0].split('+')) + ':' + t.split(':')[1]
                                  for t in bar.split()) for bar in bars]
S.melody(reed, 0, oct_down(A + B + A2), 84, legato=0.85, accent=acc)
S.melody(reed, 24, T, 84, legato=0.95, accent=acc)            # the trio: the reed organ sings it alone, at pitch
S.melody(glock, 16, A2, 80, legato=1.0)
S.melody(fglock, 0, A + B, 74, legato=1.0)
S.melody(fglock, 30, T[6:], 74, legato=1.0)

def thirds(src, dst, scale, vel=-12, bars=None):
    """a third below each note, preferring a chord tone 3-5 semitones down, else the diatonic third"""
    sc = sorted(scale); pcs = [o * 12 + p for o in range(11) for p in sc]
    for b, d, m, v in src.notes:
        if bars and int(b // S.meter) not in bars: continue
        root, iv = chord(S.chord_at(b % S.end).split('/')[0]); ct = {(root + x) % 12 for x in iv}
        c = [m - k for k in (3, 4, 5) if (m - k) % 12 in ct]
        if c: dst.add(b, d, c[0], v + vel)
        elif m in pcs: dst.add(b, d, pcs[pcs.index(m) - 2], v + vel)
thirds(picc, reed2, F_MAJ, -14, bars=range(16, 24))

# organ "pah" on 2 and 4 (light 8th-note off-beat chops in B), soft pad in the trio
S.block(org, [1, 3], midi('A4'), 3, 74, length=0.4, only=lambda b: SEC(b) in ('A', 'A2'))
S.block(org, [0.5, 1.5, 2.5, 3.5], midi('A4'), 3, 66, length=0.22, only=lambda b: SEC(b) == 'B')
S.block(org, [1, 3], midi('A4'), 3, 70, length=0.4, only=lambda b: SEC(b) == 'TB')
S.pad(pad, midi('F4'), 3, 56, only=lambda b: SEC(b) == 'T')

# tuba: oom-pah, long roots in the quiet trio, marching quarters in the build
S.bassline(tuba, midi('F1'), 'oompah', 98, only=lambda b: SEC(b) in ('A', 'B', 'A2'))
S.bassline(tuba, midi('F1'), 'root2', 88, only=lambda b: SEC(b) == 'T')
for b in (30, 31):
    r = S.bass_root(S.chart[b], midi('F1'))
    for i, m in enumerate([r, r + 7, r + 12, r + 7]): tuba.add(b * 4 + i, 0.8, m, 92 + i * 2)

# drums: bass drum + cymbal on 1 and 3, snare on 2 and 4 with a march flam figure; trio: soft bass drum only
for b in range(32):
    s, t = SEC(b), b * 4
    if s in ('A', 'B', 'A2'):
        S.pattern(kit, b, 'x.......x.......', KICK, 96)
        S.pattern(kit, b, 'x.......x.......', CRASH2 if b % 2 == 0 else RIDE, 46)
        S.pattern(kit, b, '....x.......x.o.' if b % 4 != 3 else '....x.......xoxx', SNARE, 78)
    elif s == 'T':
        S.pattern(kit, b, 'x.......x.......', KICK, 74)
        S.pattern(kit, b, '....x.......x...', STICK, 52)
    else:
        S.pattern(kit, b, 'x...x...x...x...', KICK, 84 + (b - 30) * 8)
        for j in range(16): S.hit(kit, t + j * 0.25, SNARE, 44 + (b - 30) * 16 + j * 2)
    if b in (0, 8, 16): S.hit(kit, t, CRASH, 80)

# final layer: a soft snare roll texture (16ths with accents) through A/B/A', off in the trio
for b in range(32):
    if SEC(b) in ('T', 'TB'): continue
    S.pattern(fkit, b, 'xooo' * 4, SNARE, 50, acc=4)

def limiter(x, over=13.5, look=0.004, rel=0.08):
    """transparent peak limiter: holds peaks to `over` dB above the signal's own loudness (look-ahead, smooth release)"""
    from scipy.ndimage import minimum_filter1d, uniform_filter1d
    L = loudness(x)
    if not np.isfinite(L): return x
    a = np.abs(x).max(1); g = np.minimum(1.0, db(L + over) / np.maximum(a, 1e-9))
    n = int(look * SR); g = minimum_filter1d(g, 2 * n + 1)
    step = 64; gd = g[: len(g) // step * step].reshape(-1, step).min(1); r = np.exp(-step / (rel * SR)); y = np.empty_like(gd); e = 1.0
    for i, v in enumerate(gd): e = v if v < e else r * e + (1 - r) * v; y[i] = e
    g = np.minimum(g, np.concatenate([np.repeat(y, step), np.ones(len(g) - len(y) * step)]))
    return x * uniform_filter1d(g, n)[:, None]

for P in (picc, reed, glock, fglock, reed2):   # humanised starts never run ahead of the bar line
    P.notes = [(b + 0.006, d, m, v) for b, d, m, v in P.notes]
S.check_key(F_MAJ)
GAIN = {'kit': -19.5, 'tuba': -19, 'org': -24.5, 'picc': -19, 'reed': -21, 'glock': -25, 'reed2': -24, 'pad': -27,
        'fkit': -25, 'fglock': -25}
bus = lambda x: limiter(eq(eq(eq(comp(eq(x, 'highpass', 35), thr=-20, ratio=2.5, att=0.01, rel=0.15), 'peak', 1000, 0.8, -2.5),
                              'peak', 3500, 1.0, -1.5), 'highshelf', 5000, 0.7, -1.5), over=12.5)
print('loop', S.finish(GAIN, bus=bus))

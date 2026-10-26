"""Old Town Jigsaw: chamber / baroque-pop in A, 138 bpm, 32 bars = 55.7 s.
A (oboe over harpsichord 8th arpeggios + pizzicato) | B (strings pad joins) | A' (clarinet thirds, harpsichord 16ths) |
C (quiet bridge: flute over pizzicato and strings, then oboe and 16ths build on Bm7 / E7 back into the top).
Light percussion: soft kick, rim / snare, tambourine. Final layer: glockenspiel doubling the tune + soft shaker."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'tools'))
from song import *

S = Song('oldtown', 138, 32, seed=17)
A_CH = ['A', 'E/G#', 'F#m', 'C#m/E', 'D', 'A/C#', 'Bm7 E', 'A']
B_CH = ['D', 'E', 'C#m', 'F#m', 'Bm', 'E', 'A', 'E7']
C_CH = ['F#m', 'D', 'A', 'E', 'D', 'C#m', 'Bm7', 'E7']
S.set_chart(A_CH + B_CH + A_CH + C_CH)
SEC = lambda b: 'A' if b < 8 else 'B' if b < 16 else 'A2' if b < 24 else 'C' if b < 30 else 'CB'
A_MAJ = {9, 11, 1, 2, 4, 6, 8}
S.scale = A_MAJ

kit = S.part('kit', 0, 9, vol=100, rev=30)
pizz = S.part('pizz', 45, 0, vol=110, rev=30)
cb = S.part('cb', 32, 8, vol=90, rev=20)              # acoustic bass under the pizzicato for weight
hpsi = S.part('hpsi', 6, 1, vol=84, pan=40, rev=40)
strs = S.part('str', 48, 2, vol=80, rev=65)
oboe = S.part('oboe', 68, 3, vol=100, pan=68, rev=50)
clar = S.part('clar', 71, 4, vol=92, pan=86, rev=50)
flute = S.part('flute', 73, 5, vol=100, pan=60, rev=60)
fglock = S.part('fglock', 9, 6, final=True, vol=84, pan=80, rev=55)
fkit = S.part('fkit', 0, 9, final=True, vol=96, rev=25)

A = ['E5:1 A5:0.5 B5:0.5 C#6:1 B5:0.5 A5:0.5', 'B5:1.5 G#5:0.5 E5:1 B4:1',
     'C#5:0.5 F#5:0.5 A5:0.5 C#6:0.5 B5:1 A5:1', 'G#5:1.5 E5:0.5 C#5:1 E5:1',
     'F#5:1 A5:0.5 B5:0.5 D6:1 C#6:0.5 B5:0.5', 'C#6:1.5 B5:0.5 A5:1 E5:1',
     'D5:0.5 F#5:0.5 A5:0.5 F#5:0.5 G#5:0.5 B5:0.5 E6:0.5 D6:0.5', 'C#6:2 r:1 E5:0.5 G#5:0.5']
B = ['A5:1.5 F#5:0.5 D5:1 F#5:0.5 A5:0.5', 'B5:1.5 G#5:0.5 E5:1 G#5:0.5 B5:0.5',
     'C#6:1 B5:0.5 C#6:0.5 E6:1 C#6:1', 'A5:1.5 G#5:0.5 F#5:2',
     'D6:1 C#6:0.5 B5:0.5 F#5:1 B5:1', 'G#5:1 B5:0.5 C#6:0.5 D6:1 B5:1',
     'C#6:0.5 B5:0.5 A5:0.5 C#6:0.5 E6:1.5 C#6:0.5', 'D6:1 B5:0.5 G#5:0.5 E5:0.5 G#5:0.5 B5:1']
A2 = A[:7] + ['A5:2 r:2']
C = ['C#6:2 A5:1 F#5:1', 'F#5:1.5 A5:0.5 D6:2', 'C#6:1.5 B5:0.5 A5:1 E5:1', 'G#5:3 B5:1',
     'A5:1.5 F#5:0.5 D5:1 A5:1', 'G#5:1.5 E5:0.5 C#6:2']
BUILD = ['D6:0.5 C#6:0.5 B5:0.5 A5:0.5 F#5:0.5 A5:0.5 B5:0.5 D6:0.5', 'E6:1 D6:0.5 B5:0.5 G#5:0.5 B5:0.5 D6:0.5 B5:0.5']
acc = lambda b: 8 if b in (0, 2) else 0
S.melody(oboe, 0, A + B + A2, 88, legato=0.9, accent=acc)
S.melody(flute, 24, C, 80, legato=0.95)
S.melody(oboe, 30, BUILD, 86, legato=0.9, accent=acc)
S.melody(fglock, 0, A + B + A2 + C + BUILD, 74, legato=1.0)

def thirds(src, dst, scale, vel=-12, bars=None):
    """a third below each note, preferring a chord tone 3-5 semitones down, else the diatonic third"""
    sc = sorted(scale); pcs = [o * 12 + p for o in range(11) for p in sc]
    for b, d, m, v in src.notes:
        if bars and int(b // S.meter) not in bars: continue
        root, iv = chord(S.chord_at(b % S.end).split('/')[0]); ct = {(root + x) % 12 for x in iv}
        c = [m - k for k in (3, 4, 5) if (m - k) % 12 in ct]
        if c: dst.add(b, d, c[0], v + vel)
        elif m in pcs: dst.add(b, d, pcs[pcs.index(m) - 2], v + vel)
thirds(oboe, clar, A_MAJ, -12, bars=range(16, 24))

# harpsichord: 8th arpeggios (A, B), 16th alberti (A', build), sparse quarter broken chords in the quiet bridge
S.arp(hpsi, midi('C#4'), 0.5, 'updown', 4, 64, length=0.45, only=lambda b: SEC(b) in ('A', 'B'))
S.arp(hpsi, midi('C#4'), 0.25, 'alberti', 3, 62, length=0.22, only=lambda b: SEC(b) in ('A2', 'CB'))
S.arp(hpsi, midi('C#4'), 1, 'up', 3, 54, length=0.9, only=lambda b: SEC(b) == 'C')
S.pad(strs, midi('A4'), 3, 54, only=lambda b: SEC(b) in ('B', 'C', 'CB'))
S.pad(strs, midi('E4'), 2, 46, only=lambda b: SEC(b) == 'A2')

# bass: pizzicato walking quarters, acoustic bass roots in halves underneath; the bridge in halves only
S.bassline(pizz, midi('E2'), 'walk', 90, only=lambda b: SEC(b) != 'C')
S.bassline(pizz, midi('E2'), 'root2', 80, only=lambda b: SEC(b) == 'C')
S.bassline(cb, midi('E1'), 'root2', 84, only=lambda b: SEC(b) != 'C')

# light percussion
for b in range(32):
    s, t = SEC(b), b * 4
    if s in ('A', 'B', 'A2'):
        S.pattern(kit, b, 'x.......x.x.....', KICK, 76)
        S.pattern(kit, b, '....x.......x...', STICK if s == 'A' else SNARE, 70 if s == 'A' else 64)
        S.pattern(kit, b, '....x.......x...', TAMB, 56)
        if s != 'A': S.pattern(kit, b, 'x.o.x.o.x.o.x.o.', PHAT, 44)
    elif s == 'C':
        if b % 2 == 0: S.hit(kit, t, KICK, 62)
        S.hit(kit, t + 3, TRI_M, 46)
    else:
        S.pattern(kit, b, 'x...x...x...x...', KICK, 70 + (b - 30) * 6)
        S.pattern(kit, b, '....x.......x...', SNARE, 66)
        if b == 31:
            for j in range(8): S.hit(kit, t + 2 + j * 0.25, SNARE, 36 + j * 4)
    if b in (0, 8, 16): S.hit(kit, t, CRASH, 62)

for b in range(32):
    if SEC(b) == 'C': continue
    S.pattern(fkit, b, 'xooo' * 4, SHAKER, 54)

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

for P in (oboe, clar, flute, fglock):   # humanised starts never run ahead of the bar line
    P.notes = [(b + 0.006, d, m, v) for b, d, m, v in P.notes]
S.check_key(A_MAJ)
GAIN = {'kit': -21, 'pizz': -20.5, 'cb': -24, 'hpsi': -24, 'str': -26, 'oboe': -18.5, 'clar': -24, 'flute': -19,
        'fglock': -24.5, 'fkit': -27}
bus = lambda x: limiter(eq(eq(eq(eq(comp(eq(x, 'highpass', 35), thr=-20, ratio=2.5, att=0.01, rel=0.15), 'peak', 1200, 0.8, -2),
                                 'peak', 2300, 0.9, -3.5), 'peak', 3500, 1.0, -2.5), 'highshelf', 5000, 0.7, -3))
print('loop', S.finish(GAIN, bus=bus))

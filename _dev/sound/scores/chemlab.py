"""Chemistry-lab table, "Reaction Rally": funk in E dorian, 104 bpm, 28 bars (A, B, A', breakdown), loops seamlessly.
A: alto sax tune over clavinet off-beat comping, syncopated slap bass and a funk kit with ghost notes.
B: the sax goes lyrical, the brass section answers with stabs in its gaps, ride-ish 8ths on the hats.
A': the tune again with muted-guitar 16ths and Rhodes chords added. Breakdown: four quieter bars (bass, clav, rim, sax
fills) that build on the last bar (brass swell, snare fill) into the top.
Final lap: bubbly bongo/conga 16ths and a trumpet line (answering riffs in A, a harmony under the sax in B)."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'tools'))
import mus
mus.QUAL.setdefault('m7b5', (0, 3, 6, 10))  # runtime only (mus.py itself is untouched)
from song import *

S = Song('chemlab', 104, 28, seed=31)
A_CH = ['Em7', 'A7', 'Em7', 'A7', 'Em7', 'A7', 'Cmaj7', 'B7']
B_CH = ['Am7', 'D7', 'Gmaj7', 'Cmaj7', 'Am7', 'D7', 'F#m7b5', 'B7']
D_CH = ['Am7', 'D7', 'Cmaj7', 'B7']
S.set_chart(A_CH + B_CH + A_CH + D_CH)
SEC = lambda b: 'A1' if b < 8 else 'B' if b < 16 else 'A2' if b < 24 else 'D'
E_DOR = {4, 6, 7, 9, 11, 1, 2}
S.scale = E_DOR


def mel(part, start_bar, bars, vel=88, legato=0.92, accent=None, meter=4):
    """like S.melody, but the timing slop only ever lands late, so no note starts before its chord"""
    for i, txt in enumerate(bars):
        beat = (start_bar + i) * meter
        for tok in txt.split():
            p, d = tok.split(':'); d = float(d)
            if p != 'r':
                for q in p.split('+'):
                    part.add(beat + random.uniform(0, 0.012), d * legato, midi(q), vel + (accent(beat % meter) if accent else 0) + random.uniform(-3, 3))
            beat += d
        assert abs(beat - (start_bar + i + 1) * meter) < 1e-9, (part.name, start_bar + i, txt)


def limit(x, over=12.0):
    """lookahead peak limiter: peaks held to `over` dB above the signal's own integrated loudness"""
    from scipy.ndimage import maximum_filter1d, minimum_filter1d, uniform_filter1d
    L = loudness(x)
    if not np.isfinite(L): return x
    c = db(L + over); w = int(0.004 * SR)
    pk = maximum_filter1d(np.abs(x).max(1), 2 * w + 1)
    g = np.minimum(1.0, c / np.maximum(pk, 1e-9))
    g = uniform_filter1d(minimum_filter1d(g, int(0.04 * SR)), int(0.03 * SR))
    return x * g[:, None]


def tones(sym):
    root, iv = chord(sym); return {(root + x) % 12 for x in iv}


def harm(src, dst, vel=-10, bars=None):
    """a harmony under src: the nearest chord tone 3-5 semitones below, else a third below in the key"""
    for b, d, m, v in src.notes:
        if bars and int(b // 4) not in bars: continue
        pcs = tones(S.chord_at(b % S.end))
        h = next((m - k for k in (3, 4, 5) if (m - k) % 12 in pcs), None)
        if h is None: h = next(m - k for k in (3, 4) if (m - k) % 12 in E_DOR)
        dst.add(b, d, h, v + vel)


kit = S.part('kit', 0, 9, vol=108, rev=18)
bass = S.part('bass', 36, 0, vol=104, rev=8)                 # slap bass 1
clav = S.part('clav', 7, 1, vol=86, pan=40, rev=25)
sax = S.part('sax', 65, 2, vol=100, pan=64, rev=40)          # alto sax lead
brass = S.part('brass', 61, 3, vol=92, pan=80, rev=40)       # brass section stabs
gtr = S.part('gtr', 28, 4, vol=80, pan=92, rev=20)           # muted guitar 16ths in A'
rhodes = S.part('rhodes', 4, 5, vol=80, pan=30, rev=50, cho=30)
fperc = S.part('fperc', 0, 9, final=True, vol=100, rev=25)
ftpt = S.part('ftpt', 56, 6, final=True, vol=88, pan=50, rev=45)

A_TUNE = [
    'r:0.5 E5:0.25 G5:0.25 r:0.25 A5:0.5 B5:0.75 r:0.5 D6:0.25 B5:0.75',
    'C#6:0.5 B5:0.25 A5:0.25 G5:0.5 E5:0.5 r:1 F#5:0.25 G5:0.25 E5:0.5',
    'r:0.5 E5:0.25 G5:0.25 r:0.25 A5:0.5 B5:0.75 r:0.5 E6:0.25 D6:0.75',
    'C#6:0.75 A5:0.25 r:0.5 E5:0.5 G5:1.5 r:0.5',
    'B5:0.25 B5:0.25 r:0.25 D6:0.25 r:0.5 B5:0.5 A5:0.25 G5:0.25 E5:0.5 r:1',
    'r:0.5 G5:0.25 A5:0.25 C#6:0.5 E6:0.5 D6:0.25 C#6:0.25 A5:0.5 r:1',
    'E6:0.75 D6:0.25 B5:0.5 G5:0.5 C6:1 B5:0.5 G5:0.5',
    'A5:0.5 F#5:0.5 D#5:0.5 B4:0.5 r:1 D#5:0.25 E5:0.25 F#5:0.5',
]
A2_TUNE = A_TUNE[:4] + [
    'B5:0.25 B5:0.25 r:0.25 D6:0.25 r:0.5 E6:0.5 D6:0.25 B5:0.25 A5:0.5 r:1',
    A_TUNE[5],
    'E6:0.75 D6:0.25 B5:0.5 G5:0.5 C6:1 E6:0.5 D6:0.5',
    'D#6:0.5 B5:0.5 A5:0.5 F#5:0.5 r:2',
]
B_TUNE = [
    'E5:1 G5:0.5 A5:1 C6:0.5 r:1',
    'B5:0.5 A5:0.5 F#5:0.5 D5:0.5 r:2',
    'D5:1 F#5:0.5 B5:1 A5:0.5 r:1',
    'G5:0.75 E5:0.25 B5:1 r:2',
    'E5:1 G5:0.5 A5:1 C6:0.5 r:1',
    'D6:0.5 C6:0.5 A5:0.5 F#5:0.5 r:2',
    'r:0.5 A5:0.5 C6:0.5 E6:1.5 r:1',
    'D#6:1 C#6:0.5 B5:0.5 A5:0.5 F#5:0.5 D#5:1',
]
D_FILLS = ['r:2.5 E5:0.25 G5:0.25 A5:0.5 C6:0.5', 'r:2 A5:0.5 F#5:0.25 D5:0.25 r:1', 'r:2.5 G5:0.25 B5:0.25 E6:0.5 D6:0.5', 'D#6:2 r:2']
acc = lambda b: 8 if b in (0, 2) else 4 if b % 1 == 0.75 else 0
mel(sax, 0, A_TUNE, 88, legato=0.85, accent=acc)
mel(sax, 8, B_TUNE, 86, legato=0.92, accent=acc)
mel(sax, 16, A2_TUNE, 90, legato=0.85, accent=acc)
mel(sax, 24, D_FILLS, 78, legato=0.85)

# brass stabs in B's gaps (and a swell into the top at the end of the breakdown)
for b in range(8, 16):
    sym = S.chart[b]; t = b * 4
    offs = (2.5, 3.25) if b % 2 else (3.5,)
    for o in offs:
        for m in voicing(sym, midi('D5'), 3): brass.add(t + o + random.uniform(0, 0.006), 0.22, m, 92 + random.uniform(-4, 4))
for i, o in enumerate((0, 1, 2, 3)):
    for m in voicing('B7', midi('D5'), 3): brass.add(27 * 4 + o, 0.9 if o < 3 else 0.6, m, 60 + i * 10)

# clavinet: off-beat 16th comping, sparser in B and the breakdown
CLAV_A = '..x...x.x.x...x.'
CLAV_B = '..x.......x...x.'
for b in range(28):
    pat = CLAV_A if SEC(b) in ('A1', 'A2') else CLAV_B
    for t, d, sym in S.chords:
        if int(t // 4) != b: continue
        notes = voicing(sym, midi('G4'), 3)
        for i, c in enumerate(pat):
            if c == 'x':
                for m in notes: clav.add(t + i / 4 + random.uniform(0, 0.006), 0.14, m, 76 + (6 if i % 4 == 2 else 0) + random.uniform(-4, 4))
# muted guitar 16ths and Rhodes chords in A'
for b in range(16, 24):
    sym = S.chart[b]; v = voicing(sym, midi('B4'), 2)
    for i in range(16): gtr.add(b * 4 + i / 4, 0.12, v[i % 2], (72 if i % 4 == 0 else 52 if i % 2 == 0 else 40) + random.uniform(-4, 4))
S.block(rhodes, [0, 2.5], midi('E4'), 4, 58, length=1.4, only=lambda b: SEC(b) == 'A2')
S.pad(rhodes, midi('E4'), 4, 50, only=lambda b: SEC(b) == 'D')

# slap bass: root, octave pop, 5th, 7th, and a chord tone pointing at the next root
FUNK = [(0, 'R', 0.35, 100), (0.75, 'O', 0.15, 86), (1.5, 'R', 0.25, 88), (2, '5', 0.25, 84), (2.5, 'O', 0.15, 84),
        (2.75, '7', 0.2, 76), (3.25, 'R', 0.2, 82), (3.5, 'A', 0.3, 88)]
FUNK_D = [(0, 'R', 1.4, 96), (1.5, 'R', 0.25, 80), (3, '5', 0.4, 80), (3.5, 'A', 0.3, 84)]
for k, (t, d, sym) in enumerate(S.chords):
    b = int(t // 4); r = S.bass_root(sym, midi('E1')); root, iv = chord(sym)
    nx = S.bass_root(S.chords[(k + 1) % len(S.chords)][2], midi('E1'))
    ct = [r + x for x in iv] + [r + x - 12 for x in iv] + [r + x + 12 for x in iv]
    app = min((m for m in ct if m != nx and m >= midi('E1')), key=lambda m: abs(m - nx))
    pat = FUNK_D if SEC(b) == 'D' and b < 27 else FUNK
    for o, kind, L, v in pat:
        m = {'R': r, 'O': r + 12, '5': r + iv[2], '7': r + iv[3] if len(iv) > 3 else r + 12, 'A': app}[kind]
        bass.add(t + o, L, m, v + random.uniform(-5, 5))

# drums: funk kit with ghost notes
for b in range(28):
    s, t = SEC(b), b * 4
    if s == 'D' and b < 27:
        S.pattern(kit, b, 'x.........x.....', KICK, 84)
        S.pattern(kit, b, '....x.......x...', STICK, 70)
        S.pattern(kit, b, 'x.x.x.x.x.x.x.x.', HAT, 46)
        continue
    S.pattern(kit, b, 'x.....x...x..x..' if s != 'B' else 'x.....x.x.....x.', KICK, 100)
    S.pattern(kit, b, '..o.x..o.o..x.o.', SNARE, 96)
    S.pattern(kit, b, 'xoxoxoxoxoxoxoxo' if s != 'B' else 'x.x.x.x.x.x.x.o.', HAT, 64)
    if s == 'B': S.pattern(kit, b, '..............x.', OHAT, 60)
    if b in (7, 15, 23, 27): S.pattern(kit, b, '............xoxx' if b != 27 else '........x.xoxxxx', SNARE, 86)
    if b in (0, 8, 16): S.hit(kit, t, CRASH, 84)

# final layer: bubbly hand percussion and a trumpet line
for b in range(28):
    quiet = SEC(b) == 'D' and b < 27
    S.pattern(fperc, b, 'x.ox.o.xx.ox.oxo' if not quiet else 'x..x....x..x....', BONGO_H, 62)
    S.pattern(fperc, b, '..x....x..x...x.' if not quiet else '......x.......x.', BONGO_L, 64)
    if not quiet: S.pattern(fperc, b, 'x.....x...x.....', CONGA_L, 60); S.pattern(fperc, b, 'x.x.x.x.x.x.x.x.', CABASA, 40)
T_RIFFS = {1: 'r:2 E5:0.25 G5:0.25 A5:0.5 r:1', 3: 'r:3.5 A5:0.5', 4: 'r:3 D5:0.25 E5:0.25 G5:0.5', 5: 'r:3 E5:0.25 G5:0.25 A5:0.5'}
for b0 in (0, 16):
    for k, txt in T_RIFFS.items(): mel(ftpt, b0 + k, [txt], 80, legato=0.8)
harm(sax, ftpt, -12, bars=range(8, 16))

S.check_key(E_DOR)
GAIN = {'kit': -19, 'bass': -20, 'clav': -24, 'sax': -18.5, 'brass': -21, 'gtr': -27, 'rhodes': -26,
        'fperc': -25, 'ftpt': -24.5}
bus = lambda x: limit(eq(eq(eq(comp(eq(x, 'highpass', 35), thr=-20, ratio=2.5, att=0.01, rel=0.15), 'peak', 2000, 0.9, -2.5), 'peak', 3500, 1.0, -2.5), 'highshelf', 5000, 0.7, -3))
print('loop', S.finish(GAIN, bus=bus))

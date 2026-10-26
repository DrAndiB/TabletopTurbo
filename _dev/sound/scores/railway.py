"""Railway table, "Branch Line Bash": a ragtime two-step in C, 100 bpm, 24 bars (A, B, A'), loops seamlessly.
A: piano right hand carries a syncopated tune over a stride left hand (bass on 1 and 3, chord on 2 and 4), brushes.
B: quieter strain, a clarinet sings over a lighter stride, a little build in its last two bars.
A': the tune returns on piano with a clarinet counter-line; the last bar turns round on G7 into bar 1.
Final lap: woodblock "clickety-clank" rail rhythm + a banjo (tune doubling in A, off-beat chops in B)."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'tools'))
import mus
mus.QUAL.setdefault('dim7', (0, 3, 6, 9))  # runtime only (mus.py itself is untouched)
from song import *

S = Song('railway', 100, 24, seed=11)
A_CH = ['C', 'A7', 'D7', 'G7', 'C', 'E7', 'F G7', 'C']
B_CH = ['F', 'F#dim7', 'C/G', 'A7', 'D7', 'G7', 'C', 'G7']
S.set_chart(A_CH + B_CH + A_CH[:7] + ['C G7'])
SEC = lambda b: 'A1' if b < 8 else 'B' if b < 16 else 'A2'
C_MAJ = {0, 2, 4, 5, 7, 9, 11}
S.scale = C_MAJ


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

kit = S.part('kit', 40, 9, vol=100, rev=30)              # brush kit
bass = S.part('bass', 32, 0, vol=100, rev=15)            # upright bass doubling the stride's low notes
stride = S.part('stride', 0, 1, vol=92, pan=56, rev=35)  # piano left hand
pno = S.part('pno', 0, 2, vol=100, pan=70, rev=35)       # piano right hand: the tune
clar = S.part('clar', 71, 3, vol=96, pan=48, rev=45)     # clarinet: B melody
clar2 = S.part('clar2', 71, 4, vol=84, pan=40, rev=45)   # clarinet counter-line in A'
fkit = S.part('fkit', 0, 9, final=True, vol=100, rev=20)
banjo = S.part('banjo', 105, 5, final=True, vol=90, pan=88, rev=30)

A_TUNE = [
    'E5:0.25 G5:0.5 E5:0.25 C6:0.5 G5:0.5 A5:0.25 G5:0.5 E5:0.25 C5:1',
    'C#5:0.25 E5:0.5 G5:0.25 A5:0.5 G5:0.5 E5:0.25 C#5:0.5 E5:0.25 A4:1',
    'r:0.25 F#5:0.5 A5:0.25 D6:0.75 C6:0.25 A5:0.5 F#5:0.5 A5:0.5 D5:0.5',
    'G5:0.5 F5:0.25 D5:0.5 B4:0.25 G4:0.5 B4:0.25 D5:0.5 F5:0.25 E5:0.5 D5:0.5',
    'E5:0.25 G5:0.5 E5:0.25 C6:0.5 G5:0.5 E6:0.75 D6:0.25 C6:1',
    'B5:0.25 G#5:0.5 E5:0.25 D6:0.5 B5:0.5 G#5:0.5 A5:0.5 B5:1',
    'C6:0.25 A5:0.5 F5:0.25 A5:0.5 C6:0.5 B5:0.25 D6:0.5 B5:0.25 G5:1',
    'C6:0.5 G5:0.25 E5:0.5 C5:0.75 r:2',
]
A2_TUNE = A_TUNE[:4] + [
    'E5:0.25 G5:0.5 E5:0.25 C6:0.5 G5:0.5 A5:0.25 C6:0.5 D6:0.25 E6:1',
    A_TUNE[5], A_TUNE[6],
    'C6:0.5 G5:0.25 E5:0.5 C5:0.75 r:0.5 G4:0.25 B4:0.5 D5:0.25 F5:0.5',
]
B_TUNE = [
    'A4:1 C5:0.5 F5:1.5 A5:1',
    'A5:0.75 F#5:0.25 Eb5:1 C5:1 A4:1',
    'G4:0.5 C5:0.5 E5:1 G5:1.5 E5:0.5',
    'G5:0.75 E5:0.25 C#5:1 A4:1 C#5:0.5 E5:0.5',
    'F#5:1 A5:0.5 D6:1.5 C6:1',
    'B5:0.75 A5:0.25 G5:1 F5:1 D5:1',
    'E5:1.5 G5:0.5 C6:2',
    'B5:1 A5:0.5 G5:0.5 F5:0.5 D5:0.5 B4:0.5 D5:0.5',
]
COUNTER = [
    'E4:1.5 G4:0.5 C5:2', 'C#5:1.5 E5:0.5 G4:2', 'F#4:1.5 A4:0.5 C5:2', 'B4:1.5 D5:0.5 F4:2',
    'E4:1.5 G4:0.5 C5:2', 'D5:1.5 B4:0.5 G#4:2', 'A4:2 B4:2', 'C5:2 B4:2',
]
rag = lambda b: 10 if b in (0, 2) else 4 if b % 1 == 0.25 else 0  # push the syncopations a little
mel(pno, 0, A_TUNE, 90, legato=0.8, accent=rag)
mel(pno, 16, A2_TUNE, 92, legato=0.8, accent=rag)
mel(clar, 8, B_TUNE, 86, legato=0.95)
mel(clar2, 16, COUNTER, 70, legato=0.95)

# stride left hand: low note on 1 and 3 (root, then fifth / the slash bass), close chord on 2 and 4
for t, d, sym in S.chords:
    bar = int(t // 4); s = SEC(bar)
    r = S.bass_root(sym, midi('E2')); root, iv = chord(sym)
    alt = r + 7 if r + 7 <= midi('D#3') else r - 5
    if '/' in sym: alt = midi('C3')  # C/G: G then C
    if sym == 'F#dim7': alt = midi('A2')
    vch = 66 if s == 'B' else 74
    for i, b in enumerate(np.arange(0, d, 2)):
        lo = r if i == 0 else alt
        stride.add(t + b, 0.9, lo, 88 if i == 0 else 80)
        stride.add(t + b, 0.9, lo - 12, 60)  # octave below, as a stride pianist would
        bass.add(t + b, 0.95, lo - 12, 92 if i == 0 else 84)
        for m in voicing(sym, midi('C4'), 3): stride.add(t + b + 1 + random.uniform(0, 0.008), 0.42, m, vch + random.uniform(-4, 4))
# last bar of B: a walking climb on the bass into A'
bass.notes = [n for n in bass.notes if not (15 * 4 <= n[0] < 16 * 4)]
for i, m in enumerate(['G1', 'A1', 'B1', 'D2']): bass.add(15 * 4 + i, 0.9, midi(m), 86 + i * 3)

# drums: brushes; quieter in B, building in its last two bars
for b in range(24):
    s, t = SEC(b), b * 4
    if s == 'B' and b < 14:
        S.pattern(kit, b, 'x.......x.......', KICK, 62)
        S.pattern(kit, b, '....x.......x...', SNARE, 58)
        S.pattern(kit, b, 'x.....x.x.....x.', ESNARE, 36)  # brush swirl
        continue
    S.pattern(kit, b, 'x.......x.......', KICK, 74)
    S.pattern(kit, b, '....x.......x..o', SNARE, 74)
    S.pattern(kit, b, 'x..ox..ox..ox..o', ESNARE, 42)
    S.pattern(kit, b, '....x.......x...', PHAT, 56)
    if b in (14, 15): S.pattern(kit, b, '..o...o...o.o.oo' if b == 14 else 'o.o.o.o.xoxoxxxx', SNARE, 66 + (b - 14) * 8)
    if b in (0, 16): S.hit(kit, t, CRASH, 62)

# final layer: woodblock rail rhythm (clickety-clack ... clank) and a banjo
for b in range(24):
    if SEC(b) == 'B' and b < 14:
        S.pattern(fkit, b, 'x.....x.x.....x.', WOOD_L, 66)
    else:
        S.pattern(fkit, b, 'x.o.x.oox.o.x.oo', WOOD_H, 70)
        S.pattern(fkit, b, '......x.......x.', WOOD_L, 70)
    S.pattern(fkit, b, 'x...x...x...x...', CABASA, 44)
mel(banjo, 0, A_TUNE, 76, legato=0.6, accent=rag)
mel(banjo, 16, A2_TUNE, 78, legato=0.6, accent=rag)
S.block(banjo, [0.5, 1.5, 2.5, 3.5], midi('G4'), 3, 64, length=0.2, only=lambda b: SEC(b) == 'B')

S.check_key(C_MAJ)
GAIN = {'kit': -21, 'bass': -22, 'stride': -23, 'pno': -18.5, 'clar': -19, 'clar2': -24.5, 'fkit': -26, 'banjo': -24.5}
# piano + clarinet sit in the low mids: a touch less there, a lighter top cut than the default, transients held in
bus = lambda x: limit(eq(eq(eq(comp(eq(x, 'highpass', 35), thr=-20, ratio=2.5, att=0.01, rel=0.15), 'peak', 1000, 0.8, -2), 'peak', 3500, 1.0, -1.5), 'highshelf', 5000, 0.7, -2))
print('loop', S.finish(GAIN, bus=bus))

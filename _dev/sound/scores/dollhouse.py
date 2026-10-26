"""Dollhouse table, "Haunted Dollhouse": a spooky-but-playful waltz in D minor, 3/4, 138 bpm, 48 bars
(A, B, A', C, B', A''), loops seamlessly.
A: ocarina tune (legato, theremin-ish) over church organ on beats 2 and 3, pizzicato + upright bass on 1, celesta
answers in the gaps, a tick-tock woodblock. B: the tune moves to the choir, celesta chimes the chords, timpani on 1.
A': ocarina again with a bassoon counter-line. C: the quiet bridge, celesta tune over a soft choir pad and a held bowed
bass, the clock ticking, then a timpani roll and organ swell build into B' (choir + violin an octave below) and A'' (violin shadowing the ocarina; ends on A7 -> bar 1).
Final lap: a music box doubling the tune an octave up all the way through."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'tools'))
from song import *

S = Song('dollhouse', 138, 48, meter=3, seed=41)
R1 = ['Dm', 'Gm', 'A7', 'Dm', 'Bb', 'Gm', 'E7', 'A7']
R2 = ['F', 'C', 'Dm', 'A', 'Bb', 'Gm', 'A7', 'Dm']
R3 = ['Gm', 'Dm', 'E7', 'A', 'Dm', 'Bb', 'A7', 'Dm']
S.set_chart(R1 + R2 + R1 + R3 + R2 + R1)
SEC = lambda b: ['A1', 'B1', 'A2', 'C', 'B2', 'A3'][b // 8]
D_MIN = {2, 4, 5, 7, 9, 10, 0, 1}  # D natural minor + the raised 7th (C#) of the A chords
S.scale = D_MIN


def mel(part, start_bar, bars, vel=88, legato=0.92, accent=None, meter=3, shift=0):
    """like S.melody, but the timing slop only ever lands late, so no note starts before its chord"""
    for i, txt in enumerate(bars):
        beat = (start_bar + i) * meter
        for tok in txt.split():
            p, d = tok.split(':'); d = float(d)
            if p != 'r':
                for q in p.split('+'):
                    part.add(beat + random.uniform(0, 0.012), d * legato, midi(q) + shift, vel + (accent(beat % meter) if accent else 0) + random.uniform(-3, 3))
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


kit = S.part('kit', 0, 9, vol=90, rev=45)
pizz = S.part('pizz', 45, 0, vol=100, pan=56, rev=40)      # pizzicato bass on 1
ubass = S.part('ubass', 32, 1, vol=96, rev=20)             # upright doubling it for weight
organ = S.part('organ', 19, 2, vol=80, pan=72, rev=60)     # church organ on 2 and 3
lead = S.part('lead', 79, 3, vol=100, pan=60, rev=70)      # ocarina: the eerie, theremin-ish lead
vln = S.part('vln', 40, 11, vol=90, pan=48, rev=75)        # violin shadowing it in A'' and B'
choir = S.part('choir', 52, 4, vol=96, pan=64, rev=75)     # choir aahs: B tune / bridge pad
cel = S.part('cel', 8, 5, vol=92, pan=88, rev=65)          # celesta
bsn = S.part('bsn', 70, 6, vol=90, pan=40, rev=45)         # bassoon counter-line
timp = S.part('timp', 47, 7, vol=96, pan=50, rev=55)
cb = S.part('cb', 43, 8, vol=90, rev=60)                   # bowed contrabass in the bridge
mbox = S.part('mbox', 10, 10, final=True, vol=96, pan=76, rev=60)

A_TUNE = [
    'A4:1 D5:0.5 E5:0.5 F5:1', 'Bb5:1.5 A5:0.5 G5:1', 'A5:0.5 G5:0.5 E5:1 C#5:1', 'D5:2 r:1',
    'F5:1 Bb5:0.5 C6:0.5 D6:1', 'D6:1.5 C6:0.5 Bb5:1', 'B5:0.5 G#5:0.5 E5:1 D6:1', 'C#6:2 A5:1',
]
B_TUNE = [
    'C6:2 A5:1', 'G5:2 E5:1', 'F5:1 A5:1 D6:1', 'C#6:3',
    'D6:2 Bb5:1', 'G5:1 Bb5:1 D6:1', 'E6:1.5 D6:0.5 C#6:1', 'D6:2 r:1',
]
C_TUNE = [
    'D5:1 G5:1 Bb5:1', 'A5:2 F5:1', 'G#5:1 B5:1 D5:1', 'C#5:2 E5:1',
    'F5:1 A5:1 D6:1', 'D6:1 C6:1 Bb5:1', 'A5:1 G5:1 E5:1', 'D5:1 E5:1 F5:1',
]
COUNTER = [  # bassoon, in A' and A''
    'F3:2 E3:1', 'D3:2 Bb2:1', 'C#3:1 E3:1 G3:1', 'F3:1 E3:1 D3:1',
    'D3:2 F3:1', 'G3:2 Bb3:1', 'B3:1 G#3:1 E3:1', 'C#3:1 E3:1 G3:1',
]
CEL_FILLS = {3: 'r:1 F6:0.5 E6:0.5 D6:0.5 A5:0.5', 7: 'r:2 E6:0.5 G6:0.5'}
lilt = lambda b: 10 if b < 0.01 else 0  # lean on the downbeat
for b0 in (0, 16, 40):
    mel(lead, b0, A_TUNE, 86, legato=0.98, accent=lilt)
    if b0 == 40: mel(vln, b0, A_TUNE, 70, legato=0.98, accent=lilt, shift=-12)
    for k, txt in CEL_FILLS.items(): mel(cel, b0 + k, [txt], 72, legato=1.0)
for b0 in (16, 40): mel(bsn, b0, COUNTER, 72, legato=0.9, accent=lilt)
mel(choir, 8, B_TUNE, 88, legato=0.98, accent=lilt)
mel(choir, 32, B_TUNE, 92, legato=0.98, accent=lilt)
mel(vln, 32, B_TUNE, 70, legato=0.98, accent=lilt, shift=-12)
mel(cel, 24, C_TUNE, 84, legato=1.0, accent=lilt)
S.arp(cel, midi('A5'), 1.0, 'up', 3, 58, length=0.9, only=lambda b: SEC(b) in ('B1', 'B2'))
# final layer: the music box doubles whatever carries the tune, an octave up
for b0, tune in ((0, A_TUNE), (8, B_TUNE), (16, A_TUNE), (24, C_TUNE), (32, B_TUNE), (40, A_TUNE)):
    mel(mbox, b0, tune, 80, legato=1.0, accent=lilt, shift=12)

# organ: chords on 2 and 3 (softer in the bridge, where the choir holds the harmony instead), swelling at the end of it
for t, d, sym in S.chords:
    b = int(t // 3); s = SEC(b)
    notes = voicing(sym, midi('D4'), 3)
    if s == 'C' and b < 30:
        continue
    if s == 'C':  # bars 30-31: a held, growing chord
        for m in notes + [voicing(sym, midi('D3'), 1)[0]]: organ.add(t, 2.95, m, 56 + (b - 30) * 14)
        continue
    v = 68 if s in ('A1', 'A2', 'A3') else 62
    for o in (1, 2):
        for m in notes: organ.add(t + o + random.uniform(0, 0.008), 0.62, m, v + random.uniform(-4, 4))
S.pad(choir, midi('F4'), 3, 50, only=lambda b: SEC(b) == 'C')
S.pad(cb, midi('D2'), 1, 76, only=lambda b: SEC(b) == 'C')

# bass on 1 (pizzicato + upright), with a pickup on 3 at the ends of phrases; held bowed bass in the bridge
for k, (t, d, sym) in enumerate(S.chords):
    b = int(t // 3)
    if SEC(b) == 'C' and b < 30: continue
    r = S.bass_root(sym, midi('A1'))
    pizz.add(t, 0.9, r, 92); ubass.add(t, 1.2, r, 90)
    if b % 4 == 3:  # a fifth on 3, pointing at the next bar
        f = r + 7 if r + 7 <= midi('E3') else r - 5
        pizz.add(t + 2, 0.8, f, 78); ubass.add(t + 2, 0.9, f, 76)

# percussion, very light: tick-tock woodblock, a triangle now and then, timpani in B and the build
for b in range(48):
    s, t = SEC(b), b * 3
    if s == 'C' and b < 30:
        S.pattern(kit, b, '..x.x.', CLAVES, 44, sub=2)
        continue
    S.pattern(kit, b, '..x.x.', WOOD_H if b % 2 == 0 else WOOD_L, 50, sub=2)
    if b % 4 == 0: S.hit(kit, t, TRI_O, 52)
    if s in ('B1', 'B2'): timp.add(t, 1.0, S.bass_root(S.chart[b], midi('F2')), 74)
    if b in (30, 31):
        for i in range(12): timp.add(t + i * 0.25, 0.25, midi('A2'), 48 + (b - 30) * 24 + i * 2)
    if b in (0, 32): S.hit(kit, t, CRASH, 40)

S.check_key(D_MIN)
GAIN = {'kit': -25, 'pizz': -22.5, 'ubass': -23, 'organ': -25, 'lead': -18.5, 'vln': -24, 'choir': -19.5, 'cel': -21.5, 'bsn': -23,
        'timp': -24, 'cb': -25, 'mbox': -24}
# the ocarina / music box sit in the upper mids: take some of that out and give the low mids a little back
bus = lambda x: limit(eq(eq(eq(eq(eq(comp(eq(x, 'highpass', 35), thr=-20, ratio=2.5, att=0.01, rel=0.15), 'lowshelf', 220, 0.7, 1.5),
                                   'peak', 1100, 0.9, -1.5), 'peak', 2100, 0.8, -3.5), 'peak', 3500, 1.0, -1.5), 'highshelf', 5000, 0.7, -2))
print('loop', S.finish(GAIN, bus=bus))

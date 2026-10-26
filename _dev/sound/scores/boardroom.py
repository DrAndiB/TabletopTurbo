"""Boardroom, "Quarterly Review": bossa nova lounge in F, 126 bpm, 32 bars.
Form: A (flute) | B (flute) | A' (electric piano takes the tune) | B' quiet bridge (new low flute line, sparse) with a
build back to the top. Nylon guitar bossa comping, soft upright bass, brush kit rim/shaker. Final layer: vibes
doubling the tune an octave under the flute (unison with the tune in A')."""
import os, sys, random
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'tools'))
from song import *
import mus
mus.QUAL.setdefault('m6', (0, 3, 7, 9)); mus.QUAL.setdefault('9', (0, 4, 7, 10, 14))

S = Song('boardroom', 126, 32, seed=21)
A_CH = ['Fmaj7', 'Dm7', 'Gm7', 'C7', 'Am7', 'D7', 'Gm7 C7', 'Fmaj7']
B_CH = ['Bbmaj7', 'Bbm6', 'Am7', 'Dm7', 'Gm7', 'C9', 'Fmaj7', 'Gm7 C7']
S.set_chart(A_CH + B_CH + A_CH + B_CH)
SEC = lambda b: 'A' if b < 8 else 'B' if b < 16 else 'E' if b < 24 else 'Q'
FMAJ = {5, 7, 9, 10, 0, 2, 4}
S.scale = FMAJ

kit = S.part('kit', 40, 9, vol=108, rev=30)
bass = S.part('bass', 32, 0, vol=104, rev=15)
gtr = S.part('gtr', 24, 1, vol=92, pan=46, rev=40)
flute = S.part('flute', 73, 2, vol=100, pan=66, rev=55)
ep = S.part('ep', 4, 3, vol=96, pan=74, rev=45, cho=40)
fvib = S.part('fvib', 11, 4, final=True, vol=96, pan=84, rev=60)

A_MEL = [
    'A5:1.5 G5:0.5 E5:2',
    'r:0.5 F5:0.5 A5:0.5 C6:1 A5:1.5',
    'Bb5:1.5 A5:0.5 F5:1 D5:1',
    'E5:2.5 r:0.5 G5:0.5 Bb5:0.5',
    'C6:1.5 A5:0.5 G5:2',
    'r:0.5 F#5:0.5 A5:0.5 C6:1 A5:0.5 F#5:1',
    'D5:1 F5:1 E5:1 G5:1',
    'F5:2.5 r:0.5 C5:0.5 D5:0.5',
]
B_MEL = [
    'F5:1.5 D5:0.5 A5:2',
    'G5:1.5 F5:0.5 Db5:2',
    'C5:0.5 E5:0.5 G5:1.5 A5:0.5 C6:1',
    'A5:2 r:0.5 F5:0.5 A5:0.5 C6:0.5',
    'Bb5:1.5 A5:0.5 G5:1 F5:1',
    'D6:2 C6:1 Bb5:1',
    'A5:1.5 G5:0.5 E5:1 C5:1',
    'D5:1 Bb4:1 E5:1 G5:1',
]
BRIDGE = ['D5:2 F5:2', 'Db5:2 F5:2', 'E5:3 C5:1', 'F5:2 A5:2', 'Bb5:2 G5:1 D5:1', 'E5:2 Bb5:2', 'A5:2 G5:1 E5:1', 'D5:1 F5:1 E5:1 G5:1']
down = lambda bars: [' '.join(t if t[0] == 'r' else f'{t.split(":")[0][:-1]}{int(t.split(":")[0][-1]) - 1}:{t.split(":")[1]}' for t in b.split()) for b in bars]
S.melody(flute, 0, A_MEL, 90, legato=0.95)
S.melody(flute, 8, B_MEL, 92, legato=0.95)
S.melody(ep, 16, down(A_MEL), 86, legato=0.9)
S.melody(flute, 24, down(BRIDGE[:6]) + BRIDGE[6:], 78, legato=0.97)
# final layer: vibes under the flute (an octave down), unison with the electric piano
S.melody(fvib, 0, down(A_MEL) + down(B_MEL) + down(A_MEL), 80, legato=1.0)
S.melody(fvib, 24, down(BRIDGE[:6]) + down(BRIDGE[6:]), 72, legato=1.0)

# nylon guitar: bossa comping (3+3+2 bar, then a pushed bar); thumb on the root / fifth
PAT = ['x..x..x.', '..x..x.x']
for b in range(32):
    s, t0 = SEC(b), b * 4
    quiet = s == 'Q' and b < 30
    pat = 'x.......' if quiet else PAT[b % 2]
    for i, c in enumerate(pat):
        if c != 'x': continue
        t = t0 + i * 0.5; sym = S.chord_at(t)
        nxt = pat[i + 1:].find('x'); L = (nxt + 1) * 0.5 * 0.85 if nxt >= 0 else (8 - i) * 0.5 * 0.9
        for j, m in enumerate(voicing(sym, midi('Bb3'), 4)):
            gtr.add(t + j * 0.008 + random.uniform(0, 0.006), 3.6 if quiet else L, m, (60 if quiet else 66) + random.uniform(-4, 4))
    if not quiet:
        for bt in (0, 2):
            sym = S.chord_at(t0 + bt); r = S.bass_root(sym, midi('E2'))
            gtr.add(t0 + bt, 0.9, r if bt == 0 or ' ' in S.chart[b] else r + 7 if r + 7 < midi('D3') else r - 5, 64)

# soft bass: root (dotted) + pickup, fifth on 3, a step into the next chord on the &4
ch = S.chords
for k, (t, d, sym) in enumerate(ch):
    bar = int(t // 4); s = SEC(bar)
    r = S.bass_root(sym, midi('E1')); nx = S.bass_root(ch[(k + 1) % len(ch)][2], midi('E1'))
    rr, iv = chord(sym); ct = {(rr + x) % 12 for x in iv}
    fifth = r + 7
    app = next((a for a in (nx - 1, nx + 1, nx - 2, nx + 2) if a % 12 in FMAJ or a % 12 in ct), nx)
    if s == 'Q' and bar < 30:
        bass.add(t, d * 0.95, r, 88); continue
    if d >= 4:
        for b_, m, L, v in [(0, r, 1.4, 96), (1.5, r, 0.45, 76), (2, fifth, 1.4, 88), (3.5, app, 0.45, 76)]:
            bass.add(t + b_, L, m, v + random.uniform(-4, 4))
    else:
        bass.add(t, 1.4, r, 94); bass.add(t + 1.5, 0.45, fifth if k % 2 == 0 else app, 76)

# drums (brush kit): kick 1 & 3 with pickups, cross-stick bossa clave, shaker 16ths, brush swirl in B
for b in range(32):
    s, t = SEC(b), b * 4
    quiet = s == 'Q' and b < 30
    S.pattern(kit, b, 'x.....x.' if not quiet else 'x.......', KICK, 70, sub=2)
    if not quiet: S.pattern(kit, b, ['x..x..x.', '..x..x..'][b % 2], STICK, 76, sub=2)
    S.pattern(kit, b, 'xooxxooxxooxxoox' if not quiet else 'x.o.x.o.x.o.x.o.', SHAKER, 56 if not quiet else 44)
    if s in ('B', 'E'):
        for j in (1, 3): S.hit(kit, t + j, 38, 54)
    if s == 'Q' and b >= 30:
        for j in range(4): kit.add(t + j, 0.9, 40, 56 + (b - 30) * 16 + j * 4)
        if b == 31: S.pattern(kit, b, '........x.x.xxxx', 38, 60)
    if b in (0, 16): S.hit(kit, t, CRASH, 56)

# humanised starts that fell a hair before a bar line belong to the next chord: mirror them just after it
def snap(P):
    P.notes = [((g + (g - b)) if 0 < g - b < 0.02 else b, d, m, v) for b, d, m, v in P.notes for g in [round(b)]]
for P in (flute, ep, fvib): snap(P)

S.check_key(FMAJ)
GAIN = {'kit': -20, 'bass': -20, 'gtr': -23, 'flute': -18.5, 'ep': -19, 'fvib': -24}
# nylon/flute/brushes are dark already: no top cut on this bus, a little lift for air instead
bus = lambda x: comp(eq(eq(comp(eq(x, 'highpass', 35), thr=-20, ratio=2.5, att=0.01, rel=0.15), 'peak', 400, 0.8, -1.5), 'highshelf', 4000, 0.7, 2), thr=-10, ratio=6, att=0.0005, rel=0.06)
print('loop', S.finish(GAIN, bus=bus))

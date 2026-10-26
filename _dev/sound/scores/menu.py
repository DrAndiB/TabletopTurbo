"""Menu theme: bright racing pop-rock in A, 132 bpm, 32 bars (hook, verse, hook, bridge). Brass hook, a square-wave
lead in the verse as a nod to the old chiptune theme, clean guitars, bass, kit. No final layer (menus only)."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'tools'))
from song import *

S = Song('menu', 132, 32, seed=3)
HOOK_CH = ['A', 'E/G#', 'F#m', 'D', 'Bm7', 'E', 'A D', 'E']
VERSE_CH = ['D', 'A/C#', 'Bm7', 'E', 'D', 'A/C#', 'Bm7', 'E']
BRIDGE_CH = ['F#m', 'D', 'A', 'E', 'F#m', 'D', 'B', 'E']
S.set_chart(HOOK_CH + VERSE_CH + HOOK_CH[:7] + ['A'] + BRIDGE_CH)
SEC = lambda b: 'H1' if b < 8 else 'V' if b < 16 else 'H2' if b < 24 else 'C'
A_MAJ = {9, 11, 1, 2, 4, 6, 8}
S.scale = A_MAJ

kit = S.part('kit', 0, 9, vol=112, rev=22)
bass = S.part('bass', 33, 0, vol=108, rev=8)
gtr = S.part('gtr', 27, 1, vol=86, pan=40, rev=35, cho=40)
gtr2 = S.part('gtr2', 28, 2, vol=80, pan=88, rev=25)
brass = S.part('brass', 61, 3, vol=100, pan=60, rev=45)
brass2 = S.part('brass2', 61, 4, vol=90, pan=72, rev=45)
lead = S.part('lead', 80, 5, vol=84, pan=64, rev=50, cho=20)
glock = S.part('glock', 9, 6, vol=84, pan=80, rev=55)
strs = S.part('str', 48, 7, vol=80, rev=65)
pno = S.part('pno', 0, 8, vol=80, pan=50, rev=40)

HOOK = [
    'E5:0.5 A5:0.5 r:0.5 A5:0.5 B5:0.5 C#6:1 A5:0.5',
    'B5:1.5 G#5:0.5 E5:1 r:1',
    'r:0.5 C#5:0.5 F#5:0.5 A5:0.5 G#5:0.5 F#5:0.5 E5:1',
    'F#5:2 r:0.5 D5:0.5 E5:0.5 F#5:0.5',
    'D5:0.5 F#5:0.5 r:0.5 A5:0.5 B5:0.5 A5:1 F#5:0.5',
    'G#5:1.5 E5:0.5 B4:1 E5:1',
    'C#6:1 B5:0.5 A5:0.5 F#5:1 A5:1',
    'B5:2 r:1 E5:0.5 G#5:0.5',
]
HOOK2 = HOOK[:7] + ['A5:2.5 r:1.5']
VERSE = [
    'F#5:0.5 F#5:0.5 E5:0.5 F#5:0.5 A5:1 F#5:1',
    'E5:0.5 E5:0.5 C#5:0.5 E5:0.5 A5:1 E5:1',
    'D5:0.5 D5:0.5 B4:0.5 D5:0.5 F#5:1 A5:0.5 G#5:0.5',
    'G#5:1.5 E5:0.5 B4:2',
    'F#5:0.5 F#5:0.5 E5:0.5 F#5:0.5 A5:1 B5:1',
    'C#6:0.5 B5:0.5 A5:0.5 E5:0.5 A5:1 C#6:1',
    'B5:0.5 A5:0.5 F#5:0.5 D5:0.5 A5:1 B5:0.5 A5:0.5',
    'G#5:2 B5:1 E5:0.5 G#5:0.5',
]
BRIDGE = [
    'C#6:2 A5:2', 'F#5:2 A5:1 D6:1', 'C#6:2 E6:2', 'B5:3 G#5:1',
    'A5:2 C#6:2', 'D6:2 F#6:1 E6:1', 'D#6:2 F#6:2', 'E6:1 D6:1 B5:1 G#5:1',
]
acc = lambda b: 8 if b in (0, 2) else 0
S.melody(brass, 0, HOOK, 96, legato=0.85, accent=acc)
S.melody(brass, 16, HOOK2, 100, legato=0.85, accent=acc)
S.harmonize(brass, brass2, A_MAJ, -2, vel=-14)
S.melody(lead, 8, VERSE, 84, legato=0.8, accent=acc)
S.melody(glock, 16, [' '.join(f"{n[:-1] if n[0] != 'r' else 'r'}{'' if n[0] == 'r' else int(n[-1]) + 1}:{d}" for n, d in (t.split(':') for t in bar.split())) for bar in HOOK2], 80, legato=1.0)
S.melody(strs, 24, BRIDGE, 78, legato=1.0)
S.pad(strs, midi('A4'), 3, 52, only=lambda b: SEC(b) == 'V')

# guitars: strums in the hooks, off-beat chops in the verse, sustained in the bridge
S.strum(gtr, [(0, 'D', 1.0), (1, 'D', 0.75), (1.5, 'U', 0.6), (2.5, 'U', 0.65), (3, 'D', 0.8), (3.5, 'U', 0.6)], midi('E4'), 4, 70,
        bass=midi('A3'), only=lambda b: SEC(b) in ('H1', 'H2'))
S.block(gtr, [0.5, 1.5, 2.5, 3.5], midi('C#5'), 3, 74, length=0.18, only=lambda b: SEC(b) == 'V')
S.strum(gtr, [(0, 'D', 0.8)], midi('E4'), 4, 66, length=3.8, bass=midi('A3'), only=lambda b: SEC(b) == 'C')
S.arp(gtr2, midi('A4'), 0.25, 'updown', 3, 62, length=0.2, only=lambda b: SEC(b) in ('V', 'C'))
S.block(pno, [0, 1.5, 3], midi('A4'), 3, 72, length=0.35, only=lambda b: SEC(b) == 'H2')

# bass
S.bassline(bass, midi('E1') + 0, 'root8', 98, only=lambda b: SEC(b) in ('H1', 'H2', 'V'))
S.bassline(bass, midi('E1'), 'root2', 94, only=lambda b: SEC(b) == 'C' and b < 30)
for b in (30, 31):
    for i in range(8): bass.add(b * 4 + i * 0.5, 0.42, S.bass_root(S.chart[b], midi('E1')), 92 + i)

# drums
for b in range(32):
    s, t = SEC(b), b * 4
    if s in ('H1', 'H2'):
        S.pattern(kit, b, 'x.....x.x.......', KICK, 104)
        S.pattern(kit, b, '....x.......x...', SNARE, 100)
        S.pattern(kit, b, 'x.x.x.x.x.x.x.xo', HAT if b % 4 != 3 else OHAT, 64)
        if s == 'H2': S.pattern(kit, b, '....x.......x...', CLAP, 70)
    elif s == 'V':
        S.pattern(kit, b, 'x.....x...x.....', KICK, 98)
        S.pattern(kit, b, '....x.......x..o', SNARE, 88)
        S.pattern(kit, b, 'xoxoxoxoxoxoxoxo', HAT, 54)
    else:
        if b < 28:
            S.pattern(kit, b, 'x.......x.......', KICK, 94); S.pattern(kit, b, 'x...x...x...x...', RIDE, 62)
            S.pattern(kit, b, '....x.......x...', STICK, 70)
        elif b < 31:
            S.pattern(kit, b, 'x...x...x...x...', KICK, 92 + (b - 28) * 4); S.pattern(kit, b, 'x.x.x.x.x.x.x.x.', HAT, 58 + (b - 28) * 6)
            S.pattern(kit, b, '....x.......x...', SNARE, 92)
        else:
            for j in range(8): S.hit(kit, t + j * 0.5, [HTOM, HTOM, MTOM, MTOM, LTOM, LTOM, LFTOM, LFTOM][j], 86 + j * 3)
            S.pattern(kit, b, 'x...x...x...x...', KICK, 100)
    if b in (0, 8, 16, 24): S.hit(kit, t, CRASH, 100)
    if b in (7, 15, 23) : S.pattern(kit, b, '............xxxx', SNARE, 84)

S.check_key(A_MAJ)
GAIN = {'kit': -18.5, 'bass': -19.5, 'gtr': -24, 'gtr2': -28, 'brass': -18.5, 'brass2': -25, 'lead': -21, 'glock': -26,
        'str': -22, 'pno': -26}
# brass + square lead sit forward around 2 kHz: a little less there than the default bus
bus = lambda x: eq(eq(eq(comp(eq(x, 'highpass', 35), thr=-20, ratio=2.5, att=0.01, rel=0.15), 'peak', 2200, 0.9, -2.5), 'peak', 3500, 1.0, -2), 'highshelf', 5000, 0.7, -2)
print('loop', S.finish(GAIN, bus=bus))

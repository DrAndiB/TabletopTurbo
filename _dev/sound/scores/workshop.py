"""Workshop, "Workbench Rally": twangy rock in E mixolydian, 140 bpm, 36 bars.
Form: A hook (clean twang lead) | B (answer phrase) | A' guitar solo (light overdrive) | B' breakdown (quiet, long
notes, build) | 4-bar unison riff tag back into the top. Palm-muted rhythm chug, clean chord guitar, rock bass 8ths,
rock kit. Final layer: tambourine 8ths + a harmony guitar a third under the tune."""
import os, sys, random
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'tools'))
from song import *

S = Song('workshop', 140, 36, seed=9)
A_CH = ['E', 'E', 'A', 'E', 'B', 'A', 'E', 'B7']
B_CH = ['A', 'A', 'E', 'E', 'C', 'D', 'E', 'E']
TAG = ['E', 'E', 'D A', 'B7']
S.set_chart(A_CH + B_CH + A_CH + B_CH + TAG)
SEC = lambda b: 'A' if b < 8 else 'B' if b < 16 else 'S' if b < 24 else 'Q' if b < 32 else 'T'
EMIX = {4, 6, 8, 9, 11, 1, 2}
S.scale = EMIX

kit = S.part('kit', 0, 9, vol=112, rev=20)
bass = S.part('bass', 34, 0, vol=106, rev=8)
rhy = S.part('rhy', 28, 1, vol=88, pan=30, rev=20)
gtr2 = S.part('gtr2', 27, 2, vol=82, pan=96, rev=45, cho=30)
lead = S.part('lead', 27, 3, vol=100, pan=60, rev=45, cho=20)
solo = S.part('solo', 29, 4, vol=86, pan=68, rev=45)
ftamb = S.part('ftamb', 0, 9, final=True, vol=100, rev=20)
fharm = S.part('fharm', 27, 5, final=True, vol=92, pan=88, rev=45, cho=20)

A_MEL = [
    'E5:0.5 E5:0.5 G#5:0.5 B5:1 G#5:0.5 A5:0.5 G#5:0.5',
    'E5:1.5 D5:0.5 B4:1 r:1',
    'A4:0.5 C#5:0.5 E5:0.5 A5:1 E5:0.5 F#5:0.5 E5:0.5',
    'D5:0.5 E5:1 B4:0.5 G#4:1 r:1',
    'F#5:0.5 F#5:0.5 D#5:0.5 F#5:1 B4:0.5 C#5:0.5 D#5:0.5',
    'E5:1.5 C#5:0.5 A4:1 r:1',
    'E5:0.5 E5:0.5 G#5:0.5 B5:1 D6:0.5 C#6:0.5 B5:0.5',
    'A5:1 F#5:1 D#5:1 B4:1',
]
B_MEL = [
    'C#5:1 E5:0.5 A5:1.5 G#5:0.5 F#5:0.5',
    'E5:2 C#5:1 r:1',
    'B4:1 E5:0.5 G#5:1.5 F#5:0.5 E5:0.5',
    'D5:2 B4:1 r:1',
    'C5:0.5 E5:0.5 G5:1 E5:0.5 C5:0.5 G5:1',
    'F#5:0.5 A5:0.5 D6:1 A5:0.5 F#5:0.5 D5:1',
    'E5:0.5 G#5:0.5 B5:1 E6:2',
    'D6:0.5 B5:0.5 G#5:0.5 E5:0.5 D5:0.5 B4:0.5 G#4:0.5 B4:0.5',
]
SOLO = [
    'r:0.5 B4:0.25 C#5:0.25 D5:0.5 E5:0.5 G#5:1 E5:1',
    'B5:1.5 A5:0.5 G#5:0.5 F#5:0.5 E5:1',
    'C#6:1 B5:0.5 A5:0.5 E5:1 C#5:1',
    'D5:0.5 E5:0.5 G#5:0.5 B5:0.5 E6:2',
    'D#6:1 C#6:0.5 B5:0.5 F#5:1 D#5:1',
    'E5:0.5 F#5:0.5 A5:0.5 C#6:0.5 E6:1 C#6:1',
    'B5:0.5 G#5:0.5 E5:0.5 D5:0.5 E5:0.5 G#5:0.5 B5:1',
    'A5:0.5 F#5:0.5 D#5:0.5 B4:0.5 A4:0.5 B4:0.5 D#5:1',
]
BREAK = ['C#5:4', 'E5:4', 'B4:4', 'G#4:2 B4:2', 'C5:2 E5:2', 'D5:2 F#5:2', 'E5:4', 'r:4']
RIFF = [
    'E4:0.5 E4:0.5 G#4:0.5 A4:0.5 B4:1 D5:0.5 B4:0.5',
    'E5:0.5 D5:0.5 B4:0.5 A4:0.5 G#4:1 E4:1',
    'D4:0.5 F#4:0.5 A4:1 A4:0.5 C#5:0.5 E5:1',
    'D#5:0.5 F#5:0.5 A5:1 B5:0.5 A5:0.5 F#5:0.5 D#5:0.5',
]
acc = lambda b: 8 if b in (0, 2) else 0
S.melody(lead, 0, A_MEL, 94, legato=0.85, accent=acc)
S.melody(lead, 8, B_MEL, 92, legato=0.85, accent=acc)
S.melody(solo, 16, SOLO, 88, legato=0.9, accent=acc)
S.melody(lead, 24, BREAK, 78, legato=0.95)
S.melody(lead, 32, RIFF, 96, legato=0.8, accent=acc)

# final-lap harmony guitar: a third (or nearest chord tone 3-5 semitones) under the tune
def harm(src, dst, bars, vel=-12):
    for b, d, m, v in src.notes:
        if not any(a * 4 <= b < z * 4 for a, z in bars): continue
        sym = S.chord_at(b); r, iv = chord(sym); ct = {(r + x) % 12 for x in iv}
        opts = [m - 3, m - 4, m - 5]
        h = next((o for o in opts if o % 12 in ct), None) or next((o for o in opts if o % 12 in EMIX), m - 3)
        dst.add(b, d, h, v + vel)
harm(lead, fharm, [(0, 16), (32, 36)])
harm(solo, fharm, [(16, 24)], vel=-16)

# rhythm: palm-muted power-chord chug in A / solo / tag, open chords in B; clean chord guitar on the off-beats in B
def power(sym, lo=midi('E2')):
    r = S.bass_root(sym, lo); return [r, r + 7, r + 12]
for t, d, sym in S.chords:
    bar = int(t // 4); s = SEC(bar)
    pc = power(sym)
    if s == 'Q':
        if bar >= 30:
            for j in range(int(d * 2)):
                for m in pc: rhy.add(t + j * 0.5, 0.3, m, 64 + j * 3 + (bar - 30) * 10)
        continue
    for j in range(int(d * 2)):
        accent = j in (0, 3, 6) if s != 'B' else j % 2 == 0
        notes = pc if accent else pc[:2]
        for m in notes: rhy.add(t + j * 0.5 + random.uniform(0, 0.006), 0.3, m, (84 if accent else 66) + random.uniform(-4, 4))
S.block(gtr2, [0.5, 1.5, 2.5, 3.5], midi('E4'), 3, 66, length=0.25, only=lambda b: SEC(b) == 'B')
S.strum(gtr2, [(0, 'D', 0.9), (2, 'D', 0.6)], midi('E4'), 4, 70, spread=0.03, only=lambda b: SEC(b) == 'Q')

# bass: rock 8ths; long notes in the breakdown, then driving 8ths into the tag
S.bassline(bass, midi('E1'), 'root8', 98, only=lambda b: SEC(b) in ('A', 'B', 'S'))
for t, d, sym in S.chords:
    bar = int(t // 4); s = SEC(bar); r = S.bass_root(sym, midi('E1'))
    if s == 'Q' and bar < 30: bass.add(t, 3.8, r, 92)
    elif s == 'Q' or s == 'T':
        for j in range(int(d * 2)): bass.add(t + j * 0.5, 0.42, r + (12 if s == 'T' and j % 4 == 2 else 0), 90 + (8 if j % 2 == 0 else 0))

# drums
for b in range(36):
    s, t = SEC(b), b * 4
    if s == 'Q' and b < 30:
        S.pattern(kit, b, 'x.......x.......', KICK, 88)
        S.pattern(kit, b, '........x.......', STICK, 76)
        S.pattern(kit, b, 'x...x...x...x...', HAT, 56)
        if b == 24: S.hit(kit, t, CRASH, 80)
        continue
    if s == 'Q':
        S.pattern(kit, b, 'x...x...x...x...', KICK, 92 + (b - 30) * 4)
        S.pattern(kit, b, 'x.x.x.x.x.x.x.x.' if b == 30 else 'xxxxxxxxxxxxxxxx', SNARE, 60 + (b - 30) * 14, acc=4)
        continue
    S.pattern(kit, b, 'x.....x.x.....x.' if s != 'T' else 'x.x...x.x.x...x.', KICK, 104)
    S.pattern(kit, b, '....x.......x...', SNARE, 102)
    if s == 'B': S.pattern(kit, b, 'x.x.x.x.x.x.x.x.', RIDE, 70)
    else: S.pattern(kit, b, 'x.x.x.x.x.x.x.x.', HAT if b % 4 != 3 else OHAT, 66)
    if b in (7, 15, 23): S.pattern(kit, b, '............xxxx', SNARE, 88)
    if b == 35:
        for j in range(4): S.hit(kit, t + 3 + j * 0.25, [HTOM, MTOM, LTOM, LFTOM][j], 92)
    if b in (0, 8, 16, 32): S.hit(kit, t, CRASH, 94)

# final layer: tambourine 8ths (quarters in the quiet part of the breakdown)
for b in range(36):
    S.pattern(ftamb, b, 'x...x...x...x...' if SEC(b) == 'Q' and b < 30 else 'x.o.x.o.x.o.x.o.', TAMB, 70)

# humanised starts that fell a hair before a bar line belong to the next chord: mirror them just after it
def snap(P):
    P.notes = [((g + (g - b)) if 0 < g - b < 0.02 else b, d, m, v) for b, d, m, v in P.notes for g in [round(b)]]
for P in (lead, solo, fharm): snap(P)

S.check_key(EMIX)
GAIN = {'kit': -19, 'bass': -20, 'rhy': -23.5, 'gtr2': -25.5, 'lead': -18.5, 'solo': -19.5, 'ftamb': -26, 'fharm': -25}
# guitars + tambourine: a touch less at 2 kHz and on top than the default bus
bus = lambda x: comp(eq(eq(eq(comp(eq(x, 'highpass', 35), thr=-20, ratio=2.5, att=0.01, rel=0.15), 'peak', 2200, 0.9, -2.5), 'peak', 3500, 1.0, -2.5), 'highshelf', 5000, 0.7, -4.5), thr=-10, ratio=6, att=0.0005, rel=0.06)
print('loop', S.finish(GAIN, bus=bus))

"""Pool table, "Corner Pocket": small-group swing in Bb, 118 bpm, 32 bars, swung 8ths (off-beats at 2/3 of the beat).
Form: A head (vibes) | B head (vibes) | A' piano solo | B' quiet bridge in 2 (soft vibes), walking build back to the top.
Walking upright bass, piano shell comping, brush kit with ride. Final layer: hi-hat/brush push + muted trumpet answers
and a guide-tone background under the piano solo."""
import os, sys, random
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'tools'))
from song import *

S = Song('pool', 118, 32, seed=11)
A_CH = ['Bbmaj7', 'G7', 'Cm7', 'F7', 'Dm7', 'G7', 'Cm7 F7', 'Bbmaj7']
B_CH = ['Ebmaj7', 'Ab7', 'Dm7', 'G7', 'Cm7', 'F7', 'Dm7 G7', 'Cm7 F7']
S.set_chart(A_CH + B_CH + A_CH + B_CH)
SEC = lambda b: 'A' if b < 8 else 'B' if b < 16 else 'S' if b < 24 else 'Q'
BB = {10, 0, 2, 3, 5, 7, 9}
S.scale = BB

kit = S.part('kit', 40, 9, vol=110, rev=30)           # GS brush kit
bass = S.part('bass', 32, 0, vol=110, rev=18)
pno = S.part('pno', 0, 1, vol=84, pan=44, rev=40)
solo = S.part('solo', 0, 2, vol=96, pan=56, rev=40)
vib = S.part('vib', 11, 3, vol=100, pan=72, rev=55)
fkit = S.part('fkit', 40, 9, final=True, vol=100, rev=25)
tpt = S.part('tpt', 59, 4, final=True, vol=96, pan=40, rev=50)


# ------------------------------------------------------------ swing helpers
def sw(p):
    """position in straight 8ths -> swung beat (off-beat at 2/3)"""
    return (p // 2) + (2 / 3 if p % 2 else 0)

def swing_seq(part, bar, text, vel=88, legato=0.92, hum=0.3, offacc=4):
    p = 0
    for tok in text.split():
        n, d = tok.split(':'); d = int(d)
        if n != 'r':
            t0, t1 = sw(p), sw(p + d)
            for q in n.split('+'):
                v = vel + (offacc if p % 2 else 0) + random.uniform(-hum, hum) * 10 + (6 if p % 8 == 0 else 0)
                part.add(bar * 4 + t0 + random.uniform(0, hum) * 0.02, (t1 - t0) * legato, midi(q), v)
        p += d
    assert p == 8 or p == 16, (bar, text, p)


# ------------------------------------------------------------ melodies (durations in 8ths)
A_MEL = [
    'r:1 D5:1 F5:1 A5:2 G5:1 r:1 F5:1',
    'D5:2 B4:1 G4:2 r:3',
    'r:1 Eb5:1 G5:1 Bb5:2 A5:1 r:1 G5:1',
    'Eb5:2 C5:1 A4:2 r:3',
    'r:1 A4:1 D5:1 F5:1 A5:1 C6:2 A5:1',
    'B5:3 G5:1 F5:1 D5:1 B4:2',
    'C5:1 Eb5:1 G5:1 Bb5:1 A5:2 F5:1 Eb5:1',
    'D5:4 r:2 C5:1 D5:1',
]
B_MEL = [
    'Eb5:2 G5:1 Bb5:3 D6:2',
    'C6:3 Gb5:1 Ab5:2 r:2',
    'r:1 A5:1 F5:1 D5:1 C5:2 D5:1 F5:1',
    'G5:3 F5:1 D5:1 B4:3',
    'r:1 C5:1 Eb5:1 G5:1 Bb5:3 G5:1',
    'A5:3 F5:1 Eb5:1 C5:3',
    'D5:1 F5:1 A5:1 C6:1 B5:2 G5:1 F5:1',
    'Eb5:3 C5:1 A4:2 r:1 C5:1',
]
SOLO = [
    'r:2 F5:1 G5:1 A5:1 Bb5:1 D6:1 C6:1',
    'B5:1 G5:1 F5:1 D5:1 B4:2 r:2',
    'r:1 G5:1 Bb5:1 G5:1 Eb5:1 D5:1 C5:1 Bb4:1',
    'A4:2 C5:1 Eb5:1 F5:1 A5:1 C6:2',
    'D6:3 C6:1 A5:1 F5:1 D5:2',
    'r:1 B4:1 D5:1 F5:1 A5:2 G5:2',
    'Eb5:1 C5:1 Bb4:1 G4:1 A4:1 C5:1 Eb5:1 F5:1',
    'D5:3 Bb4:1 r:2 C5:1 D5:1',
]
for i in range(8):
    swing_seq(vib, i, A_MEL[i], 90)
    swing_seq(vib, 8 + i, B_MEL[i], 92)
    swing_seq(solo, 16 + i, SOLO[i], 86, legato=0.85)
    swing_seq(vib, 24 + i, B_MEL[i], 74 if i < 6 else 82)

# final layer: muted trumpet answers in the melody's gaps, and a soft guide-tone line under the piano solo
ANS = {1: 'r:5 B4:1 D5:1 F5:1', 3: 'r:5 A4:1 C5:1 Eb5:1', 7: 'r:1 F5:1 D5:1 Bb4:2 r:3',
       9: 'r:6 Eb5:1 C5:1', 11: 'r:5 D5:1 F5:1 G5:1', 13: 'r:5 A4:1 C5:1 F5:1'}
for b, txt in ANS.items():
    for off in ((0,) if b < 8 else (0, 16)):
        swing_seq(tpt, b + off, txt, 80, legato=0.8)
GUIDE = ['D5:8', 'D5:8', 'Eb5:8', 'Eb5:8', 'F5:8', 'F5:8', 'Eb5:4 Eb5:4', 'D5:8']
for i, g in enumerate(GUIDE):
    swing_seq(tpt, 16 + i, g, 62, legato=0.97, hum=0.1, offacc=0)


# ------------------------------------------------------------ walking bass (quarters, chord tones + scale steps)
LO, HI = midi('E1'), midi('D3')
def allowed(sym):
    r, iv = chord(sym); pcs = BB | {(r + x) % 12 for x in iv}
    return [m for m in range(LO - 2, HI + 1) if m % 12 in pcs]

def nearest_root(sym, ref):
    r = chord(sym)[0]
    c = [m for m in range(LO, HI - 4) if m % 12 == r]
    return min(c, key=lambda m: abs(m - ref))

prev = midi('Bb1')
two_feel = lambda b: SEC(b) == 'Q' and b < 30
for k, (t, d, sym) in enumerate(S.chords):
    bar = int(t // 4)
    nsym = S.chords[(k + 1) % len(S.chords)][2]
    r = nearest_root(sym, prev)
    T = nearest_root(nsym, r)
    al = allowed(sym)
    apps = [a for a in (T - 1, T + 1, T - 2, T + 2) if a in al and a != r]
    app = random.choice(apps[:2]) if apps else T
    ri, ivs = chord(sym)
    if two_feel(bar):
        fifth = r + 7 if r + 7 <= HI else r - 5
        bass.add(t, 1.9, r, 96)
        if d >= 4: bass.add(t + 2, 1.9, fifth if random.random() < 0.6 else app, 86)
        prev = r; continue
    if d < 4:
        line = [r, app]
    else:
        # candidate lines; the smoothest one (small leaps, no repeated notes, ends a step from the next root) wins
        third, fifth, sev = r + ivs[1], r + ivs[2], r + ivs[3]
        cands = [[r, third, fifth], [r, fifth, third], [r, fifth - 12, third - 12], [r, sev - 12, fifth - 12], [r, third, sev - 12 + 12]]
        i = al.index(r)
        for dirn in (1, -1):
            if 0 <= i + 2 * dirn < len(al): cands.append([r, al[i + dirn], al[i + 2 * dirn]])
        best = None
        for c in cands:
            if min(c) < LO - 2 or max(c) > HI: continue
            for a in apps or [T]:
                line = c + [a]
                cost = sum(abs(x - y) for x, y in zip(line, line[1:] + [T])) + 6 * sum(x == y for x, y in zip(line, line[1:])) + random.uniform(0, 4)
                if best is None or cost < best[0]: best = (cost, line)
        line = best[1]
    for j, m in enumerate(line):
        bass.add(t + j, 0.92, m, (100 if j == 0 else 88) + random.uniform(-5, 5))
    prev = line[-1]


# ------------------------------------------------------------ piano comping: shell voicings (3rd, 7th, + 5th)
def shell(sym, center=midi('F4')):
    r, iv = chord(sym)
    pcs = [(r + iv[1]) % 12, (r + iv[3 if len(iv) > 3 else 2]) % 12, (r + iv[2]) % 12]
    out = []
    for pc in pcs:
        out.append(min((m for m in range(center - 7, center + 7) if m % 12 == pc), key=lambda m: abs(m - center)))
    return sorted(set(out))

P8 = [[0, 3], [2, 6], [0, 5], [1, 4], [3, 6], [0, 3, 6]]
P4 = [[0], [1], [0, 3]]
for t, d, sym in S.chords:
    bar = int(t // 4); s = SEC(bar)
    v = shell(sym)
    if s == 'Q' and bar < 30:
        for m in v: pno.add(t, d * 0.9, m, 56)
        continue
    if s == 'S':  # under the solo: left-hand shells, lighter
        pats = [[0], [2], [0, 5]] if d >= 4 else [[0]]
        vel = 58
    else:
        pats = P8 if d >= 4 else P4; vel = 66 if s == 'A' else 70
    pat = random.choice(pats)
    base = int(round(t * 2))
    for q in pat:
        p = base + q
        t0 = sw(p); L = (sw(p + (2 if random.random() < 0.4 else 1)) - t0) * 0.8
        for m in v: pno.add(t0 + random.uniform(0, 0.008), L, m, vel + random.uniform(-5, 5) + (4 if q % 2 else 0))


# ------------------------------------------------------------ drums (brush kit: 38 tap, 40 swirl, 51 ride, 44 pedal hat)
SWIRL, TAP = 40, 38
for b in range(32):
    s, t = SEC(b), b * 4
    quiet = s == 'Q' and b < 30
    for j in range(4): S.hit(kit, t + j, KICK, 40)  # feathered kick
    S.hit(kit, t + 1, PHAT, 66); S.hit(kit, t + 3, PHAT, 66)
    if quiet:
        for j in (0, 2): kit.add(t + j, 1.9, SWIRL, 70 + random.uniform(-4, 4))
        for j in (1, 3): S.hit(kit, t + j, TAP, 62)
        continue
    rv = 74 if s != 'Q' else 70 + (b - 30) * 8
    for p in (0, 2, 3, 4, 6, 7):
        S.hit(kit, t + sw(p), RIDE, rv + (6 if p in (2, 6) else 0) - (10 if p % 2 else 0))
    for j in (1, 3): S.hit(kit, t + j, TAP, 64)
    # snare/brush comping ghosts
    for _ in range(2 if s in ('A', 'B') else 1):
        S.hit(kit, t + sw(random.choice([3, 5, 7])), TAP, 46)
    if s == 'Q':  # build back to the top
        if b == 30: S.hit(kit, t + sw(7), TAP, 78)
        if b == 31:
            for p in (1, 3, 5, 6, 7): S.hit(kit, t + sw(p), TAP, 54 + p * 4)
            S.hit(kit, t + sw(7), KICK, 56)
    if b in (7, 15, 23) and s != 'Q': S.hit(kit, t + sw(7), TAP, 70); S.hit(kit, t + sw(7), KICK, 50)
    if b in (0, 8, 16): S.hit(kit, t, CRASH, 62 if b else 68)

# final layer kit: hi-hat chick on 2 & 4, swung brush taps pushing the off-beats (not in the quiet bridge's start)
for b in range(32):
    t = b * 4
    if SEC(b) == 'Q' and b < 28:
        S.hit(fkit, t + 1, HAT, 60); S.hit(fkit, t + 3, HAT, 60); continue
    for j in (1, 3): S.hit(fkit, t + j, HAT, 64)
    for p in range(8):
        S.hit(fkit, t + sw(p), TAP, 58 if p % 2 else 40)

S.check_key(BB)
GAIN = {'kit': -19, 'bass': -20, 'pno': -25, 'solo': -19.5, 'vib': -18.5, 'fkit': -25, 'tpt': -24}
# default bus plus a fast peak catcher (brush taps are very transient)
bus = lambda x: comp(eq(eq(comp(eq(x, 'highpass', 35), thr=-20, ratio=2.5, att=0.01, rel=0.15), 'peak', 3500, 1.0, -2.5), 'highshelf', 5000, 0.7, -3), thr=-10, ratio=6, att=0.0005, rel=0.06)
print('loop', S.finish(GAIN, bus=bus))

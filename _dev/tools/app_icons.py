"""Draws the Android launcher icons, splash images and the 512 px store icon for the app.

The design is the game's favicon (index.html): a red toy car on a yellow tile, with a cabin and hubcaps.
usage (from the repository root):  python _dev/tools/app_icons.py
"""
import os, glob
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
RES = os.path.join(ROOT, 'app', 'android', 'app', 'src', 'main', 'res')
YELLOW, RED, RED_DK, INK, CREAM = (255, 201, 60), (226, 59, 46), (186, 42, 34), (31, 26, 23), (255, 244, 220)
SS = 4  # supersampling


def car(d, s, ox, oy):
    """Car in a 64-unit design space, scaled by s and offset by (ox, oy) pixels."""
    def box(x0, y0, x1, y1):
        return [ox + x0 * s, oy + y0 * s, ox + x1 * s, oy + y1 * s]
    d.rounded_rectangle(box(19, 16, 43, 31), radius=6 * s, fill=RED_DK)      # cabin
    d.rounded_rectangle(box(23, 19.5, 39, 28), radius=3 * s, fill=CREAM)     # window
    d.rounded_rectangle(box(9, 26, 55, 42), radius=7 * s, fill=RED)          # body
    d.rounded_rectangle(box(12, 30, 52, 32.5), radius=1.2 * s, fill=CREAM)   # stripe
    for cx in (20, 44):                                                        # wheels
        d.ellipse(box(cx - 7.5, 34.5, cx + 7.5, 49.5), fill=INK)
        d.ellipse(box(cx - 2.8, 39.2, cx + 2.8, 44.8), fill=CREAM)


def tile(px, shape):
    """Yellow tile with the car. shape: 'square' (rounded), 'round' or 'full' (store icon, no rounding)."""
    n = px * SS
    im = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if shape == 'round':
        d.ellipse([0, 0, n - 1, n - 1], fill=YELLOW)
        s = n / 64 * 0.82
    else:
        if shape == 'square':
            d.rounded_rectangle([0, 0, n - 1, n - 1], radius=n * 14 / 64, fill=YELLOW)
        else:
            d.rectangle([0, 0, n, n], fill=YELLOW)
        s = n / 64 * 0.95
    # the car spans y 16..49.5 of its design space: centre that vertically
    ox, oy = (n - 64 * s) / 2, n / 2 - 32.75 * s
    car(d, s, ox, oy)
    return im.resize((px, px), Image.LANCZOS)


def foreground(px):
    """Adaptive-icon foreground: 108 units, the car inside the 66-unit safe zone, transparent around it."""
    n = px * SS
    im = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    u = n / 108
    s = 60 / 46 * u                      # car body is ~46 units wide in its design space
    ox = n / 2 - 32 * s
    oy = n / 2 - 32.75 * s
    car(d, s, ox, oy)
    return im.resize((px, px), Image.LANCZOS)


DENS = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
for name, k in DENS.items():
    folder = os.path.join(RES, f'mipmap-{name}')
    os.makedirs(folder, exist_ok=True)
    tile(round(48 * k), 'square').save(os.path.join(folder, 'ic_launcher.png'))
    tile(round(48 * k), 'round').save(os.path.join(folder, 'ic_launcher_round.png'))
    foreground(round(108 * k)).save(os.path.join(folder, 'ic_launcher_foreground.png'))

# splash images (Android 11 and older): dark background, icon in the middle, at each existing size
for path in glob.glob(os.path.join(RES, 'drawable*', 'splash.png')):
    w, h = Image.open(path).size
    im = Image.new('RGB', (w, h), INK)
    ic = tile(max(48, round(min(w, h) * 0.28)), 'square')
    im.paste(ic, ((w - ic.width) // 2, (h - ic.height) // 2), ic)
    im.save(path)

store = os.path.join(ROOT, 'app', 'store')
os.makedirs(store, exist_ok=True)
tile(512, 'full').convert('RGB').save(os.path.join(store, 'icon-512.png'))
print('icons, splash images and app/store/icon-512.png written')

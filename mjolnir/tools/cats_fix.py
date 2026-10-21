"""Fix the colours of the generated cat sheet (assets/raw/cats.png) so each row is one cat.

The generator mixed coats up: the calico's startled leap came out orange, the orange cat's grooming pose
came out calico, and the tuxedo's tail had calico rings. This turns the leap's back into calico patches,
the grooming cat's black patches into orange tabby stripes and the tuxedo's orange into black.
Writes assets/raw/cat_calico.png, cat_orange.png and cat_tuxedo.png (one row of three poses each);
then run tools/prepare_sprite.py catN assets/raw/cat_X.png --height 160 for each.
"""
import pathlib

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

RAW = pathlib.Path(__file__).resolve().parent.parent / 'assets' / 'raw'
im = np.asarray(Image.open(RAW / 'cats.png').convert('RGB')).astype(float)
ROWS = [(0, 560), (560, 1105), (1105, 1664)]


def hsv(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx, mn = a.max(-1), a.min(-1)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
    lum = .3 * r + .59 * g + .11 * b
    return r, g, b, sat, lum


def orange_mask(a):
    r, g, b, sat, lum = hsv(a)
    return (r > g) & (g > b) & (b < g * .72) & (sat > .3) & (r - b > 60)


def row(i):
    y0, y1 = ROWS[i]
    return im[y0:y1].copy()


# calico: grooming and running from row 1, the leap from row 2 with black patches painted on its back
calico = row(0)
leap = row(1)[:, 820:1520].copy()
h, w = leap.shape[:2]
def patches(spots, soft):
    m = Image.new('L', (w, h), 0); d = ImageDraw.Draw(m)
    for (cx, cy, rx, ry, rot) in spots:
        e = Image.new('L', (w, h), 0); ImageDraw.Draw(e).ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=255)
        m.paste(255, (0, 0), e.rotate(rot, center=(cx, cy)))
    return np.asarray(m.filter(ImageFilter.GaussianBlur(soft))) / 255


r, g, b, sat, lum = hsv(leap)
fur = orange_mask(leap)
# black patches on the back, shoulder and cap, white on the flank and hind leg
black = patches([(330, 150, 120, 58, -14), (225, 245, 75, 58, 25), (470, 190, 55, 48, 0), (585, 85, 42, 30, -10), (80, 215, 30, 55, 20), (110, 280, 34, 26, 40)], 3.5) * fur
white = patches([(390, 300, 110, 48, -10), (240, 390, 55, 75, 20), (520, 300, 45, 60, 30)], 4) * fur * (1 - black)
dark = np.stack([lum * .26 + 12, lum * .24 + 10, lum * .25 + 11], -1)
light = np.stack([lum * .35 + 168, lum * .35 + 162, lum * .35 + 155], -1)
leap = leap * (1 - black[..., None] - white[..., None]) + dark * black[..., None] + light * white[..., None]
calico[:, 820:1520] = 255
calico[:h, 820:1520] = leap

# orange: the grooming cat's black patches become darker orange tabby stripes
orange = row(1)
g0 = orange[:, :800]
r, g, b, sat, lum = hsv(g0)
bg = (g0.min(-1) > 225)
blackish = (lum < 120) & ~bg & ~((r > g + 40) & (b > g))  # not the pink tongue/ears
stripe = np.stack([lum * 1.25 + 70, lum * .72 + 30, lum * .28 + 8], -1)
g0[blackish] = stripe[blackish]
orange[:, :800] = g0

# tuxedo: the orange in its tail and elbow turns black
tux = row(2)
m = orange_mask(tux)
_, _, _, _, lum = hsv(tux)
tux[m] = np.stack([lum * .3 + 14, lum * .29 + 13, lum * .3 + 15], -1)[m]

for name, a in [('cat_calico', calico), ('cat_orange', orange), ('cat_tuxedo', tux)]:
    Image.fromarray(np.clip(a, 0, 255).astype('uint8')).save(RAW / f'{name}.png')
print('ok')

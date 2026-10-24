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
import sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from prepare_sprite import key_white  # noqa: E402
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
# the generated ginger tom is fully orange in the second sheet: give the first three poses the same coat,
# turning the white chest, belly and paws ginger (only fur, never the white background around the cat)
inside = np.asarray(key_white(Image.fromarray(orange.astype('uint8')), False).getchannel('A')) > 128
r, g, b, sat, lum = hsv(orange)
whitefur = inside & (orange.min(-1) > 140) & (sat < .22)
ginger = np.stack([np.minimum(255, lum * .98 + 18), lum * .66 + 8, lum * .36], -1)
orange[whitefur] = ginger[whitefur]

# tuxedo: the orange in its tail and elbow turns black
tux = row(2)
r, g, b, sat, lum = hsv(tux)
m = orange_mask(tux) | ((r > g + 22) & (g > b) & (r > b + 35) & (tux.min(-1) < 225))  # orange and brown rings, not the pink nose
_, _, _, _, lum = hsv(tux)
tux[m] = np.stack([lum * .3 + 14, lum * .29 + 13, lum * .3 + 15], -1)[m]

for name, a in [('cat_calico', calico), ('cat_orange', orange), ('cat_tuxedo', tux)]:
    Image.fromarray(np.clip(a, 0, 255).astype('uint8')).save(RAW / f'{name}.png')
print('ok')

# second sheet (assets/raw/cats2.png): grooming with a hind leg up and knocked out with spiral eyes.
# Appended to each cat's row so the frames are: paw lick, leap, run, leg-up lick, knocked out
two = np.asarray(Image.open(RAW / 'cats2.png').convert('RGB')).astype(float)
ROWS2 = [(0, 541), (541, 1102), (1102, 1664)]
for name, (y0, y1) in zip(['cat_calico', 'cat_orange', 'cat_tuxedo'], ROWS2):
    base = np.asarray(Image.open(RAW / f'{name}.png').convert('RGB')).astype(float)
    extra = two[y0:y1].copy()
    h = max(base.shape[0], extra.shape[0])
    row = np.full((h, base.shape[1] + 80 + extra.shape[1], 3), 255.0)
    row[:base.shape[0], :base.shape[1]] = base
    row[:extra.shape[0], base.shape[1] + 80:] = extra
    if name == 'cat_orange':
        # same all-ginger coat in the extra poses (the leg-up pose shows a white belly)
        inside = np.asarray(key_white(Image.fromarray(row.astype('uint8')), False).getchannel('A')) > 128
        r, g, b, sat, lum = hsv(row)
        whitefur = inside & (row.min(-1) > 140) & (sat < .22)
        whitefur[:, :base.shape[1]] = False
        row[whitefur] = np.stack([np.minimum(255, lum * .98 + 18), lum * .66 + 8, lum * .36], -1)[whitefur]
    Image.fromarray(row.astype('uint8')).save(RAW / f'{name}.png')
print('poses added')

# full painted sheets (assets/raw/cat_<coat>_sheet.png: paw lick, grooming with the face at the tail, startled
# arch, running, knocked out) replace a cat entirely. The poses overlap a little in x, so each pose is cut out
# along its own outline (connected parts of the keyed image) and they are laid out in the game's order
from collections import deque


def sheet_row(path):
    img = Image.open(path).convert('RGB')
    a = np.asarray(img).astype(float)
    alpha = np.asarray(key_white(img, False).getchannel('A')) > 60
    k = 3
    small = alpha[::k, ::k]
    h, w = small.shape
    lab = np.zeros((h, w), int)
    comps = []
    for y in range(h):
        for x in range(w):
            if small[y, x] and not lab[y, x]:
                n = len(comps) + 1; lab[y, x] = n; q = deque([(y, x)]); pts = []
                while q:
                    cy, cx = q.popleft(); pts.append((cy, cx))
                    for ny in range(cy - 1, cy + 2):
                        for nx in range(cx - 1, cx + 2):
                            if 0 <= ny < h and 0 <= nx < w and small[ny, nx] and not lab[ny, nx]:
                                lab[ny, nx] = n; q.append((ny, nx))
                ys, xs = zip(*pts)
                comps.append((len(pts), min(xs), max(xs), sum(xs) / len(xs), sum(ys) / len(ys)))
    big = sorted(range(len(comps)), key=lambda i: -comps[i][0])[:5]
    big.sort(key=lambda i: comps[i][3])
    owner = {}
    for i, c in enumerate(comps):
        owner[i + 1] = min(big, key=lambda j: abs(comps[j][3] - c[3]) + abs(comps[j][4] - c[4])) + 1
    full = np.repeat(np.repeat(lab, k, 0), k, 1)[:a.shape[0], :a.shape[1]]
    full = np.pad(full, ((0, a.shape[0] - full.shape[0]), (0, a.shape[1] - full.shape[1])))
    poses = []
    for j in big:
        m = np.isin(full, [i for i, o in owner.items() if o == j + 1])
        m = np.asarray(Image.fromarray((m * 255).astype('uint8')).filter(ImageFilter.MaxFilter(7))) > 0
        ys, xs = np.where(m)
        c = np.where(m[..., None], a, 255.0)[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        poses.append(c)
    lick, groom, leap, run, ko = poses
    parts = [lick, leap, run, groom, ko]
    H = max(p_.shape[0] for p_ in parts)
    row = np.full((H, sum(p_.shape[1] for p_ in parts) + 80 * len(parts), 3), 255.0)
    x = 0
    for p_ in parts:
        row[H - p_.shape[0]:, x:x + p_.shape[1]] = p_
        x += p_.shape[1] + 80
    return row


for coat in ['calico', 'orange', 'tuxedo']:
    sheet = RAW / f'cat_{coat}_sheet.png'
    if sheet.exists():
        Image.fromarray(sheet_row(sheet).astype('uint8')).save(RAW / f'cat_{coat}.png')
        print(coat, 'sheet used')

# the ginger tom must read as orange only: his dark brown stripes are lifted to a deep orange and the whole
# coat warmed and brightened; only the true black ink outlines (and eyes, nose) stay dark
o = np.asarray(Image.open(RAW / 'cat_orange.png').convert('RGB')).astype(float) / 255
import colorsys
mx, mn = o.max(-1), o.min(-1); lum = (mx + mn) / 2
fur = (mn < .93) & (lum > .13) & (o[..., 0] >= o[..., 2])
outv = o.copy()
for yy, xx in zip(*np.where(fur)):
    h_, l_, s_ = colorsys.rgb_to_hls(*o[yy, xx])
    if h_ > .2 and h_ < .9: continue  # eyes, nose and tongue keep their colours
    l2 = .26 + l_ * .72 if l_ < .45 else min(.88, l_ * 1.08)
    outv[yy, xx] = colorsys.hls_to_rgb(.072, l2, min(1, max(s_, .78)))
Image.fromarray((outv * 255).round().astype('uint8')).save(RAW / 'cat_orange.png')
print('ginger coat brightened')

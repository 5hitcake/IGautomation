"""Build the compact goat-chariot atlas for Járnviðr: Thor's chariot drawn by Tanngrisnir and Tanngnjóstr.

Input: assets/raw/chariot_gallop0..2.png, one painting (Z-Image Turbo) and two FLUX.1 Kontext edits of it with the
goats' legs in other phases of the gallop. Each is keyed off its white background (the grey floor shadow first),
small white holes walled in by the dark goat's fur are cleared, and the picture is cut in two: the cart (with the
stub of its shafts) and the team. To keep the whole rig short, the game draws the team pulled right up to the
cart's front, over the shafts. All pieces share one vertical box so cart and goats stand on the same ground line.
Atlas: frame 0 the cart, frames 1-3 the team in its three gallop phases. sprites.json 'pts' hold where Thor stands
in the cart, his floor height and where the team's left edge sits relative to the cart (all in atlas px).
Usage: python3 mjolnir/tools/build_chariot.py
"""
import json
import pathlib
import sys
from collections import deque

import numpy as np
from PIL import Image

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from prepare_sprite import key_white  # noqa: E402

ASSETS = pathlib.Path(__file__).resolve().parent.parent / 'assets'
SCALE = .5                 # atlas px per source px
CART = (70, 482)           # source x range of the cart and the stub of its shafts
TEAM = (540, 1210)         # source x range of the two goats
TUCK = 170                 # the team is pulled this far (source px) back towards the cart
STAND, FLOOR = 304, 400    # source x where Thor stands in the cart, source y of the cart floor
def hsv(rgb):
    mx, mn = rgb.max(-1), rgb.min(-1); d = mx - mn; r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    nz = d > 1e-6; dd = np.where(nz, d, 1)
    h = np.where(mx == r, ((g - b) / dd) % 6, np.where(mx == g, (b - r) / dd + 2, (r - g) / dd + 4))
    return np.where(nz, h / 6, 0), np.where(mx > 1e-6, d / np.where(mx > 1e-6, mx, 1), 0), mx


def tint(h, s, v):
    i = np.floor(h * 6) % 6; f = h * 6 - np.floor(h * 6)
    p, q, t = v * (1 - s), v * (1 - f * s), v * (1 - (1 - f) * s)
    out = np.zeros(v.shape + (3,))
    for n, (R, G, B) in enumerate([(v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q)]):
        m = i == n; out[m] = np.stack([R[m], G[m], B[m]], -1)
    return out


def ellipse(shape, cx, cy, rx, ry):
    yy, xx = np.mgrid[:shape[0], :shape[1]]
    return np.clip(1.25 - np.sqrt(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2), 0, 1).clip(0, 1)


def find_eye(rgb, h, s, v, box):
    """The amber iris inside a head box (source px): its centre, or the box centre if none is found."""
    x0, y0, x1, y1 = box
    m = np.zeros(v.shape, bool); m[y0:y1, x0:x1] = True
    m &= (h > .05) & (h < .14) & (s > .55) & (v > .6)
    if m.sum() < 4: return (x0 + x1) / 2, (y0 + y1) / 2
    ys, xs = np.where(m); return xs.mean(), ys.mean()


def black_metal(k):
    """The team in the colours of the old paintings of Tanngrisnir and Tanngnjóstr: both goats shaggy white, with a white
    blaze down the face and a black patch around each eye that runs back towards the ear (like corpse paint, or a
    border collie), dark lower legs, red inner ears, brown ridged horns (a different brown for each goat), worn brown
    leather harness with blackened iron fittings instead of gold. The eyes are found in each frame, the rest are
    source px boxes (the Kontext frames sit within a few px)."""
    a = k.astype(float); rgb = a[..., :3] / 255; on = a[..., 3] > 0
    H_, W_ = on.shape; yy, xx = np.mgrid[:H_, :W_]
    h, s, v = hsv(rgb); team = on & (xx >= TEAM[0] - 10)
    out = rgb.copy()
    ew = find_eye(rgb, h, s, v, (945, 225, 1010, 275)); eb = find_eye(rgb, h, s, v, (1105, 218, 1170, 268))
    iris = np.zeros(v.shape, bool)
    for ex, ey in (ew, eb): iris |= ((xx - ex) ** 2 + (yy - ey) ** 2 < 49) & (h > .04) & (h < .15) & (s > .45) & (v > .45)
    # the wooden shafts run diagonally under the goats: leave them wood
    shaft = (np.abs((yy - 388) + (xx - 540) * (58 / 330)) < 9) & (xx < 860) & (h < .1)
    gold = team & (h > .06) & (h < .2) & (s > .25) & (v > .25) & ~shaft & ~iris
    horn_w = gold & (xx >= 805) & (xx < 992) & (yy >= 125) & (yy < 238)
    horn_b = gold & (xx >= 992) & (xx < 1175) & (yy >= 125) & (yy < 232)
    iron = gold & ~horn_w & ~horn_b
    out[horn_w] = tint(np.full(v.shape, .065), np.full(v.shape, .55), v * .62)[horn_w]
    out[horn_b] = tint(np.full(v.shape, .075), np.full(v.shape, .42), v * .78)[horn_b]
    out[iron] = tint(np.full(v.shape, .6), np.full(v.shape, .08), v * .42)[iron]
    cloth = team & (xx > 680) & (xx < 820) & (yy > 260) & (yy < 380) & (s > .3) & ((h < .04) | (h > .9) | ((h > .52) & (h < .75)))
    out[cloth] = tint(np.full(v.shape, .06), np.full(v.shape, .6), v * .5 + .05)[cloth]
    strap = team & (s > .4) & ((h < .075) | (h > .95)) & (v < .75) & ~cloth & ~shaft
    out[strap] = tint(np.full(v.shape, .055), s * .85, v * .8)[strap]
    # both coats white: the front goat stays white, the dark goat's coat turns white too (its ink lines stay black)
    grey = np.stack([v, v, v], -1) * np.array([.95, .95, .97])
    wfur = team & (s < .3) & (v > .45)
    out[wfur] = grey[wfur]
    # the dark goat: one big dark blob (not the small shadows on the white goat); its shading is kept, lifted to white
    dk = (team & (s < .35) & (v < .5)).astype(float)
    for _ in range(3):   # a cheap 7 px box blur
        dk = (dk + np.roll(dk, 3, 0) + np.roll(dk, -3, 0) + np.roll(dk, 3, 1) + np.roll(dk, -3, 1)) / 5
    bfur = team & (s < .35) & (v < .5) & (v > .05) & (dk > .7) & (xx > 840) & ~iris
    lift = (np.stack([v, v, v], -1) * 1.0 + .5).clip(0, .95) * np.array([.95, .95, .97])
    out[bfur] = lift[bfur]
    # the black eye patches: around each eye and back towards the ear; the blaze and muzzle stay white
    patch = np.zeros(v.shape)
    for ex, ey in (ew, eb):
        # a crisp mask over the eye, reaching back and up towards the ear (the blaze in front of the eye stays white)
        d = np.sqrt(((xx - (ex - 8)) / 22) ** 2 + ((yy - (ey - 3)) / 13) ** 2)
        patch = np.maximum(patch, np.clip((1 - d) * 5, 0, 1))
    patch = patch * team
    legs = np.clip((yy - 440) / 45, 0, 1) * .8 * team
    shade = np.maximum(patch * .95, legs)
    out = out * (1 - shade[..., None]) + np.array([.04, .04, .05]) * shade[..., None]
    # the eyes painted back on top of the mask: an amber iris with a black pupil and a glint
    for ex, ey in (ew, eb):
        d = np.sqrt((xx - ex) ** 2 + (yy - ey) ** 2)
        out[d < 5.5] = [.86, .52, .12]; out[d < 2.6] = [.03, .02, .02]
        out[(np.abs(xx - ex - 1.5) < 1.2) & (np.abs(yy - ey + 2) < 1.2)] = [1, .95, .8]
    a[..., :3] = out * 255
    return a.round().clip(0, 255).astype(np.uint8)


keyed = []
for i in range(3):
    a = np.asarray(Image.open(ASSETS / 'raw' / f'chariot_gallop{i}.png').convert('RGB')).astype(int)
    ch, lum = a.max(-1) - a.min(-1), a.mean(-1)
    low = np.zeros(lum.shape, bool); low[460:] = True
    a[low & (ch < 20) & (lum > 110)] = 255   # the soft grey floor shadow
    k = np.asarray(key_white(Image.fromarray(a.astype(np.uint8)), True)).copy()
    # pale specks enclosed by dark fur (between the black goat's legs): background showing through
    rgb = k[..., :3].astype(int); pale = (k[..., 3] > 0) & (rgb.min(-1) > 175) & ((rgb.max(-1) - rgb.min(-1)) < 40)
    seen = np.zeros(pale.shape, bool); hh, ww = pale.shape
    for sy, sx in zip(*np.where(pale)):
        if seen[sy, sx]: continue
        comp, q = [], deque([(sy, sx)]); seen[sy, sx] = True
        while q:
            y, x = q.popleft(); comp.append((y, x))
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= ny < hh and 0 <= nx < ww and pale[ny, nx] and not seen[ny, nx]: seen[ny, nx] = True; q.append((ny, nx))
        if len(comp) > 400: continue
        ys, xs = np.array(comp).T
        y0, y1, x0, x1 = max(0, ys.min() - 3), min(hh, ys.max() + 4), max(0, xs.min() - 3), min(ww, xs.max() + 4)
        ring = k[y0:y1, x0:x1]; m = ~pale[y0:y1, x0:x1] & (ring[..., 3] > 0)
        if m.any() and ring[..., :3][m].mean() < 95: k[ys, xs, 3] = 0
    keyed.append(Image.fromarray(black_metal(k)))
# one shared vertical box: from the highest horn or cart top to the lowest hoof or wheel
top = min(f.getbbox()[1] for f in keyed); bot = max(f.getbbox()[3] for f in keyed)
H = round((bot - top) * SCALE)
pieces = [keyed[0].crop((CART[0], top, CART[1], bot))] + [f.crop((TEAM[0], top, TEAM[1], bot)) for f in keyed]
pieces = [p.resize((round(p.width * SCALE), H), Image.LANCZOS) for p in pieces]
W = sum(p.width for p in pieces) + 4 * len(pieces)
atlas = Image.new('RGBA', (W, H), (0, 0, 0, 0)); frames, x = [], 0
for p in pieces:
    atlas.paste(p, (x, 0)); frames.append([x, 0, p.width, H, round(p.width / 2, 1)]); x += p.width + 4
atlas.save(ASSETS / 'chariot.webp', 'WEBP', quality=90, method=6)
meta = json.loads((ASSETS / 'sprites.json').read_text())
meta['chariot'] = {'frames': frames, 'h': H, 'pts': {
    'stand': round((STAND - CART[0]) * SCALE, 1), 'floor': round((bot - FLOOR) * SCALE, 1),
    'team': round((TEAM[0] - TUCK - CART[0]) * SCALE, 1)}}
(ASSETS / 'sprites.json').write_text(json.dumps(meta))
print('chariot:', meta['chariot'])

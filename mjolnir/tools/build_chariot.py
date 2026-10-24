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
TUCK = 125                 # the team is pulled this far (source px) back towards the cart
STAND, FLOOR = 304, 400    # source x where Thor stands in the cart, source y of the cart floor
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
    keyed.append(Image.fromarray(k))
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

"""Build the goat-chariot atlas for Járnviðr: Thor's chariot drawn by Tanngrisnir and Tanngnjóstr.

Input: assets/raw/chariot_gallop0..2.png, one painting (Z-Image Turbo) and two FLUX.1 Kontext edits of it with the
goats' legs in other phases of the gallop. Each is keyed off its white background (the grey floor shadow first),
small white holes walled in by the dark goat's fur are cleared too, and all three are cut with ONE shared box so
cart and goats stay put from frame to frame; the game draws the cart from frame 0 and cycles the team through 0-2.
Writes assets/chariot.webp and the 'chariot' entry of assets/sprites.json.
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
H = 200
frames = []
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
    frames.append(Image.fromarray(k))
box = None
for f in frames:
    b = f.getbbox(); box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
s = H / (box[3] - box[1]); W = round((box[2] - box[0]) * s)
atlas = Image.new('RGBA', (W * 3 + 8, H), (0, 0, 0, 0))
for i, f in enumerate(frames): atlas.paste(f.crop(box).resize((W, H), Image.LANCZOS), (i * (W + 4), 0))
atlas.save(ASSETS / 'chariot.webp', 'WEBP', quality=90, method=6)
meta = json.loads((ASSETS / 'sprites.json').read_text())
meta['chariot'] = {'frames': [[i * (W + 4), 0, W, H, round(W / 2, 1)] for i in range(3)], 'h': H}
(ASSETS / 'sprites.json').write_text(json.dumps(meta))
print(f'chariot: 3 frames {W}x{H}')

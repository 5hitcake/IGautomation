"""Give Thor bright green eyes instead of blue in his sprite atlases (assets/thor.webp, assets/thorpose.webp).

In each frame's head region (top 45 %) the saturated blue pixels are the eyes (the chain mail below is a dull
blue-grey and stays). Their hue is turned to a vivid, glowing green, keeping the painted shading and highlights.
Usage: python3 mjolnir/tools/thor_green_eyes.py
"""
import colorsys
import json
import pathlib

import numpy as np
from PIL import Image

ASSETS = pathlib.Path(__file__).resolve().parent.parent / 'assets'
meta = json.loads((ASSETS / 'sprites.json').read_text())
for name in ('thor', 'thorpose'):
    path = ASSETS / f'{name}.webp'
    im = Image.open(path).convert('RGBA'); a = np.asarray(im).astype(float) / 255
    rgb = a[..., :3]; mx = rgb.max(-1); mn = rgb.min(-1); sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    blue = (b > r + .08) & (b >= g * .95) & (sat > .22) & (a[..., 3] > .5)
    head = np.zeros(blue.shape, bool)
    for f in meta[name]['frames']:
        x, y, w, h = f[:4]; head[y:y + int(h * .45), x:x + w] = True
    m = blue & head
    # keep only blobs that touch the bright white of an eye (the sclera or the catch-light); a blue glint on a
    # bracer or the helmet has no white next to it
    white = (mn > .78) & (a[..., 3] > .5)
    from collections import deque
    seen = np.zeros(m.shape, bool); keep = np.zeros(m.shape, bool); H_, W_ = m.shape
    for sy, sx in zip(*np.where(m)):
        if seen[sy, sx]: continue
        comp, q, touch = [], deque([(sy, sx)]), False; seen[sy, sx] = True
        while q:
            y_, x_ = q.popleft(); comp.append((y_, x_))
            for ny in range(y_ - 2, y_ + 3):
                for nx in range(x_ - 2, x_ + 3):
                    if 0 <= ny < H_ and 0 <= nx < W_:
                        touch |= white[ny, nx]
                        if m[ny, nx] and not seen[ny, nx] and abs(ny - y_) <= 1 and abs(nx - x_) <= 1: seen[ny, nx] = True; q.append((ny, nx))
        if touch:
            for y_, x_ in comp: keep[y_, x_] = True
        else:
            print('  skipped blob at', comp[0], 'size', len(comp))
    m = keep
    out = a.copy()
    for yy, xx in zip(*np.where(m)):
        h_, l_, s_ = colorsys.rgb_to_hls(*rgb[yy, xx])
        # intense, glowing emerald green: full saturation and lifted brightness, the painted shading kept
        out[yy, xx, :3] = colorsys.hls_to_rgb(.34, min(.82, l_ * 1.25 + .12), 1.0)
    Image.fromarray((out * 255).round().astype('uint8')).save(path, 'WEBP', quality=90, method=6)
    print(name, 'eye pixels recoloured:', int(m.sum()))

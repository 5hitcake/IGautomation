"""Clean the pale halo off the glowing mushroom in assets/props.webp (run after prepare_sprite props ...).

The painted glowshroom came with a whitish-cyan glow ring around its caps and stems, and pale patches between the
stems; the game draws its own glow, so those pale, washed-out pixels that touch the transparent background are cut
away, peeled a few passes deep, and so are the larger pale pockets walled in between the stems under the big cap.
The white spots and highlights on the caps and stems stay. Usage: python3 mjolnir/tools/props_fix.py
"""
import json
import pathlib

from collections import deque

import numpy as np
from PIL import Image

ASSETS = pathlib.Path(__file__).resolve().parent.parent / 'assets'
x0, y0, w, h = json.loads((ASSETS / 'sprites.json').read_text())['props']['frames'][1][:4]   # the glowshroom
im = Image.open(ASSETS / 'props.webp').convert('RGBA')
a = np.asarray(im).copy()
f = a[y0:y0 + h, x0:x0 + w]
rgb = f[..., :3].astype(int)
pale = (rgb.min(-1) > 150) & (rgb.max(-1) - rgb.min(-1) < 110)
for _ in range(12):
    clear = f[..., 3] < 100
    nb = np.zeros_like(clear); nb[1:] |= clear[:-1]; nb[:-1] |= clear[1:]; nb[:, 1:] |= clear[:, :-1]; nb[:, :-1] |= clear[:, 1:]
    eat = nb & pale & ~clear
    if not eat.any(): break
    f[eat, 3] = 0
# the pale pockets walled in between the stems, under the big cap (cap and stem highlights are smaller, or higher up)
seen = np.zeros(pale.shape, bool)
for sy, sx in zip(*np.where(pale & (f[..., 3] > 0))):
    if seen[sy, sx]: continue
    comp, q = [], deque([(sy, sx)]); seen[sy, sx] = True
    while q:
        y, x = q.popleft(); comp.append((y, x))
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and pale[ny, nx] and f[ny, nx, 3] > 0 and not seen[ny, nx]: seen[ny, nx] = True; q.append((ny, nx))
    ys, xs = np.array(comp).T
    whitest = rgb[ys, xs].min(-1).mean() > 185   # near-white glow, not a teal stem highlight
    if ys.mean() > h * .45 and ((len(comp) > 40 and np.ptp(xs) >= 6) or (len(comp) >= 10 and whitest)): f[ys, xs, 3] = 0
a[y0:y0 + h, x0:x0 + w] = f
Image.fromarray(a).save(ASSETS / 'props.webp', 'WEBP', lossless=True)
print('glowshroom cleaned')

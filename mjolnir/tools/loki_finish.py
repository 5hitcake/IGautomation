"""Finish Loki's blue-and-black atlas (after prepare_sprite on assets/raw/loki_blue.png).

The repainted frames (FLUX.2 edits of the old green outfit; the throw pose drawn from the standing frame) leave a few
paper-white flecks on the outer edge of his wild hair: opaque, colourless pale pixels that touch the transparent
background are cleared, a few passes deep, so the eye whites inside the face stay. Then the irises are made a dark
blue in every frame (the standing frame came back amber) with the darkest centre kept black.
Usage: python3 mjolnir/tools/loki_finish.py
"""
import json
import pathlib

import numpy as np
from PIL import Image

ASSETS = pathlib.Path(__file__).resolve().parent.parent / 'assets'
meta = json.loads((ASSETS / 'sprites.json').read_text())['loki']
a = np.asarray(Image.open(ASSETS / 'loki.webp').convert('RGBA')).astype(float)
rgb = a[..., :3]
pale = (rgb.min(-1) > 140) & (rgb.max(-1) - rgb.min(-1) < 50)
for _ in range(10):
    clear = a[..., 3] < 128
    nb = np.zeros_like(clear); nb[1:] |= clear[:-1]; nb[:-1] |= clear[1:]; nb[:, 1:] |= clear[:, :-1]; nb[:, :-1] |= clear[:, 1:]
    a[nb & pale & ~clear, 3] = 0
# irises: inside each frame's face box, blue or amber iris pixels -> dark blue, the darkest -> black pupil
EYES = [(72, 58, 98, 82), (273, 66, 307, 94), (418, 46, 462, 74), (638, 78, 667, 106)]
mx, mn = rgb.max(-1), rgb.min(-1); sat = (mx - mn) / np.maximum(mx, 1)
r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
iris = ((b > r + 25) | ((r > b + 40) & (g > b + 20) & (r < 235))) & (sat > .3)
box = np.zeros(iris.shape, bool)
for x0, y0, x1, y1 in EYES: box[y0:y1, x0:x1] = True
skin = (r > 200) & (g > 150) & (b > 110) & (r > b)
m = iris & box & ~skin & (a[..., 3] > 128)
lum = rgb.mean(-1)
dark = np.stack([lum * .32 + 6, lum * .42 + 14, lum * .75 + 40], -1).clip(0, 255)
rgb[m] = dark[m]
rgb[m & (lum < 70)] = [8, 10, 22]
a[..., :3] = rgb
Image.fromarray(a.round().astype(np.uint8)).save(ASSETS / 'loki.webp', 'WEBP', lossless=True)
print('loki: eyes', int(m.sum()), 'px')

"""Finish Loki's blue-and-black atlas (after prepare_sprite on assets/raw/loki_blue.png).

The repainted frames (FLUX.2 edits of the old green outfit; the throw pose drawn from the standing frame) leave a few
paper-white flecks on the outer edge of his wild hair: opaque, colourless pale pixels that touch the transparent
background are cleared, a few passes deep, so the eye whites inside the face stay. Then the irises are made a dark
blue in every frame (the standing frame came back amber) with the darkest centre kept black, and the bright royal blue
of his clothes is toned down to a deeper blue.
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
pale = (rgb.min(-1) > 200) & (rgb.max(-1) - rgb.min(-1) < 20)   # paper-white only: pale skin at the chin stays
for _ in range(10):
    clear = a[..., 3] < 128
    nb = np.zeros_like(clear); nb[1:] |= clear[:-1]; nb[:-1] |= clear[1:]; nb[:, 1:] |= clear[:, :-1]; nb[:, :-1] |= clear[:, 1:]
    a[nb & pale & ~clear, 3] = 0
# the royal-blue cloak and tunic toned down to a deeper, less glaring blue (the bright seiðr flame is left alone)
mx0, mn0 = rgb.max(-1), rgb.min(-1)
cloth = (rgb[..., 2] > rgb[..., 0] + 30) & ((mx0 - mn0) / np.maximum(mx0, 1) > .35) & (mx0 < 215)
grey = rgb[cloth].mean(-1, keepdims=True)
rgb[cloth] = (grey + (rgb[cloth] - grey) * .72) * .8
# irises: tight boxes around each eye; the iris (not skin, not the eye white, not the black lashes) -> dark blue
EYES = [(70, 64, 81, 76), (282, 76, 306, 101), (420, 52, 458, 72), (648, 80, 664, 105)]
r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
lum = rgb.mean(-1); chroma = rgb.max(-1) - rgb.min(-1)
box = np.zeros(lum.shape, bool)
for x0, y0, x1, y1 in EYES: box[y0:y1, x0:x1] = True
skin = (r > 170) & (r > b + 35) & (lum > 140)
white = (rgb.min(-1) > 175) & (chroma < 45)
first = np.zeros(lum.shape, bool); first[:, :120] = True   # the standing frame's eye came back amber: take its whole iris
m = box & ~skin & ~white & (a[..., 3] > 128) & np.where(first, (lum > 30) & (lum < 170) & (chroma > 8), (b > r + 40) & (lum > 70))
dark = np.stack([lum * .3 + 4, lum * .4 + 10, lum * .7 + 38], -1).clip(0, 255)
rgb[m] = dark[m]
rgb[m & (lum < 75)] = [8, 10, 22]
a[..., :3] = rgb
Image.fromarray(a.round().astype(np.uint8)).save(ASSETS / 'loki.webp', 'WEBP', lossless=True)
print('loki: eyes', int(m.sum()), 'px')

"""Recolour a character's eyes in its sprite atlas: Thor bright green (was blue), Loki dark blue (was amber).

In each frame's head region the iris pixels are picked by their original hue, kept only where they touch the
white of an eye (so a glint on armour or a gold headband stays), and given the new hue with the painted shading;
the darkest iris pixels become a black pupil, so the eyes keep their normal dark centre.
Usage: python3 mjolnir/tools/eye_colour.py   (works from assets/raw/<name>_orig_eyes.webp, the atlases straight from prepare_sprite)
"""
import colorsys
import json
import pathlib
import shutil
from collections import deque

import numpy as np
from PIL import Image

ASSETS = pathlib.Path(__file__).resolve().parent.parent / 'assets'
meta = json.loads((ASSETS / 'sprites.json').read_text())
# name: (iris selector on r, g, b, hue, sat, light, new hue, new saturation, lightness lift)
JOBS = {
    'thor': (lambda r, g, b, h, s, l: (b > r + .08) & (b >= g * .95) & (s > .22), .34, 1.0, (1.25, .12)),
    'thorpose': (lambda r, g, b, h, s, l: (b > r + .08) & (b >= g * .95) & (s > .22), .34, 1.0, (1.25, .12)),
    # Loki's eyes are set in tools/loki_finish.py since his blue-and-black repaint
}
EYE_BOXES = {'loki': [(74, 60, 87, 74), (263, 72, 280, 87), (383, 52, 400, 66), (505, 82, 521, 92)]}
for name, (pick, hue, sat, (lmul, ladd)) in JOBS.items():
    orig = ASSETS / 'raw' / f'{name}_orig_eyes.webp'
    if not orig.exists(): shutil.copy(ASSETS / f'{name}.webp', orig)
    a = np.asarray(Image.open(orig).convert('RGBA')).astype(float) / 255
    rgb = a[..., :3]; r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx = rgb.max(-1); mn = rgb.min(-1); l = (mx + mn) / 2
    s = np.where((mx - mn) > 1e-6, (mx - mn) / np.maximum(1e-6, 1 - np.abs(2 * l - 1)), 0)
    h = np.vectorize(lambda R, G, B: colorsys.rgb_to_hsv(R, G, B)[0])(r, g, b)
    m = pick(r, g, b, h, s, l) & (a[..., 3] > .5)
    head = np.zeros(m.shape, bool)
    for f in meta[name]['frames']:
        x, y, w, hh = f[:4]; head[y:y + int(hh * .45), x:x + w] = True
    m &= head
    if name in EYE_BOXES:
        # small painted eyes: pick the iris inside a hand-set box per frame (not white, not skin, not lash-black)
        box = np.zeros(m.shape, bool)
        for x0, y0, x1, y1 in EYE_BOXES[name]: box[y0:y1, x0:x1] = True
        skin = (r > .8) & (b > r * .55)
        m = box & (mn < .72) & ~skin & (l > .16) & ((b < r * .58) | (g >= r * .9)) & (a[..., 3] > .5)
    white = (mn > .75) & (a[..., 3] > .5)
    seen = np.zeros(m.shape, bool); keep = m.copy() if name in EYE_BOXES else np.zeros(m.shape, bool); H_, W_ = m.shape
    if name in EYE_BOXES: seen[:] = True
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
        if touch and len(comp) <= 160:
            for y_, x_ in comp: keep[y_, x_] = True
    out = a.copy()
    for yy, xx in zip(*np.where(keep)):
        h_, l_, s_ = colorsys.rgb_to_hls(*rgb[yy, xx])
        out[yy, xx, :3] = colorsys.hls_to_rgb(hue, min(.8, l_ * lmul + ladd), sat)
    # the pupil: iris pixels that were the darkest in the painting turn (near) black again
    dark = keep & (l < .3)
    out[dark, :3] = np.array([.04, .05, .06])
    Image.fromarray((out * 255).round().astype('uint8')).save(ASSETS / f'{name}.webp', 'WEBP', quality=92, method=6)
    print(name, 'iris px', int(keep.sum()), 'pupil px', int(dark.sum()))

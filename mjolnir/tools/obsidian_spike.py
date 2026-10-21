"""Turn the amethyst spike cluster (assets/raw/crystalspike.png) into glossy obsidian for Muspelheim.

The violet crystals become black volcanic glass that keeps the painted facets and white glints, with a red
heat glow rising from the base; the granite base becomes dark basalt split by glowing lava cracks.
Writes assets/raw/obsidianspike.png; then run tools/prepare_sprite.py obsidianspike assets/raw/obsidianspike.png --height 160.
"""
import pathlib
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

RAW = pathlib.Path(__file__).resolve().parent.parent / 'assets' / 'raw'
random.seed(5)
a = np.asarray(Image.open(RAW / 'crystalspike.png').convert('RGB')).astype(float)
r, g, b = a[..., 0], a[..., 1], a[..., 2]
H, W = r.shape
yy, xx = np.mgrid[0:H, 0:W]
lum = .3 * r + .59 * g + .11 * b
bg = a.min(-1) > 232
crystal = (b > g + 18) & (r > g + 8) & ~bg
rock = ~bg & ~crystal & (yy > 600)

out = a.copy()
# black glass: mid tones sink to near black, the brightest glints stay as cold white reflections
t = (lum / 255) ** 2.7
glass = np.stack([t * 235 + 10, t * 238 + 9, t * 250 + 14], -1)
heat = np.clip((yy - 380) / 300, 0, 1)[..., None] * np.array([150, 38, 6]) * (1 - t[..., None]) * .9
out[crystal] = np.clip(glass + heat, 0, 255)[crystal]
# basalt base
basalt = np.stack([lum * .33 + 10, lum * .3 + 8, lum * .3 + 9], -1)
out[rock] = basalt[rock]
img = Image.fromarray(np.clip(out, 0, 255).astype('uint8')).convert('RGBA')

# lava cracks across the top of the basalt, with a glow
cr = Image.new('L', (W, H), 0); d = ImageDraw.Draw(cr)
rows = np.where(rock.any(1))[0]
for k in range(5):
    x = random.randint(120, 880); y = random.randint(700, 800); pts = [(x, y)]
    for _ in range(7):
        x += random.randint(-40, 40); y += random.randint(8, 22); pts.append((x, y))
    d.line(pts, fill=255, width=5)
rockm = Image.fromarray((rock * 255).astype('uint8')).filter(ImageFilter.MinFilter(9))
cr = Image.fromarray((np.asarray(cr) * (np.asarray(rockm) > 0)).astype('uint8'))
glow = cr.filter(ImageFilter.GaussianBlur(10)).point(lambda v: min(255, v * 2))
glow = Image.fromarray((np.asarray(glow) * (np.asarray(rockm.filter(ImageFilter.MaxFilter(9))) > 0)).astype('uint8'))
img.alpha_composite(Image.merge('RGBA', [Image.new('L', (W, H), 255), Image.new('L', (W, H), 90), Image.new('L', (W, H), 10), glow.point(lambda v: v * 6 // 10)]))
img.alpha_composite(Image.merge('RGBA', [Image.new('L', (W, H), 255), Image.new('L', (W, H), 190), Image.new('L', (W, H), 70), cr.filter(ImageFilter.GaussianBlur(1))]))
img.convert('RGB').save(RAW / 'obsidianspike.png')
print('ok')

"""Recolour the generated checkpoint banner black and orange and paint a real golden lightning bolt on it.

Reads assets/raw/checkflag.png (furled banner left, open banner right, white background), turns the red
cloth to black, the gold trim and tassels to orange, paints out the flat bolt symbol and draws a jagged,
branching bolt of polished gold with a bright core and a glow. Writes assets/raw/checkflag_bolt.png;
then run tools/prepare_sprite.py checkflag assets/raw/checkflag_bolt.png --height 300.
"""
import math
import pathlib
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

RAW = pathlib.Path(__file__).resolve().parent.parent / 'assets' / 'raw'
random.seed(7)
im = Image.open(RAW / 'checkflag.png').convert('RGB')
a = np.asarray(im).astype(float)
r, g, b = a[..., 0], a[..., 1], a[..., 2]
H, W = r.shape
yy, xx = np.mgrid[0:H, 0:W]
banner = (xx > 745) & (xx < 935) & (yy > 160) & (yy < 600)
furled = (xx > 440) & (xx < 550) & (yy > 110) & (yy < 430)
cloth = banner | furled

red = (r > 45) & (g < r * .62) & (b < r * .66) & (r - g > 22) & cloth
gold = (r > 130) & (g > r * .5) & (b < r * .45) & (r + g > 250) & cloth & ~red
gold &= (r - b) > 105  # not the wooden pole or the rope

lum = .3 * r + .59 * g + .11 * b
v = np.clip((lum - 35) * .85 + 22, 8, 110)
out = a.copy()
out[red] = np.stack([v * 1.05, v * .98, v * .95], -1)[red]
out[gold] = np.stack([np.minimum(255, r * 1.06), g * .58, b * .3], -1)[gold]

# paint the flat symbol out of the cloth (diffusion from the black around it)
sym = (xx > 795) & (xx < 892) & (yy > 280) & (yy < 445)
hole = np.asarray(Image.fromarray(((gold & sym) * 255).astype('uint8')).filter(ImageFilter.MaxFilter(7))) > 0
hole &= sym
fill = out.copy(); known = ~hole
fill[hole] = np.median(out[sym & ~hole & red], axis=0)
for _ in range(500):
    p = np.pad(fill, ((1, 1), (1, 1), (0, 0)), mode='edge')
    fill[hole] = ((p[:-2, 1:-1] + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]) / 4)[hole]
rng = np.random.default_rng(3)
fill[hole] += rng.normal(0, 3, fill[hole].shape)
out = fill
img = Image.fromarray(np.clip(out, 0, 255).astype('uint8')).convert('RGBA')


def bolt_path(p0, p1, rough, depth):
    if depth == 0:
        return [p0, p1]
    mx, my = (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2
    ln = math.hypot(p1[0] - p0[0], p1[1] - p0[1])
    nx, ny = -(p1[1] - p0[1]) / ln, (p1[0] - p0[0]) / ln
    off = random.uniform(-1, 1) * rough * ln
    mid = (mx + nx * off, my + ny * off)
    return bolt_path(p0, mid, rough, depth - 1)[:-1] + bolt_path(mid, p1, rough, depth - 1)


S = 4  # supersampling
main = bolt_path((812, 232), (868, 505), .32, 6)
branches = []
for k, (i, ang, ln) in enumerate([(14, .9, 70), (27, -.8, 60), (40, .7, 50), (50, -.6, 38)]):
    p = main[i]
    end = (p[0] + math.sin(ang) * ln, p[1] + math.cos(ang) * ln * .9)
    branches.append(bolt_path(p, end, .35, 4))


def stroke(draw, pts, w0, w1, col):
    n = len(pts) - 1
    for i in range(n):
        w = w0 + (w1 - w0) * i / n
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        draw.line([(x0 * S, y0 * S), (x1 * S, y1 * S)], fill=col, width=max(1, int(w * S)))
        draw.ellipse([x0 * S - w * S / 2, y0 * S - w * S / 2, x0 * S + w * S / 2, y0 * S + w * S / 2], fill=col)


big = (W * S, H * S)
glow = Image.new('L', big, 0); gd = ImageDraw.Draw(glow)
edge = Image.new('L', big, 0); ed = ImageDraw.Draw(edge)
body = Image.new('L', big, 0); bd = ImageDraw.Draw(body)
core = Image.new('L', big, 0); cd = ImageDraw.Draw(core)
for pts, w in [(main, 1)] + [(br, .5) for br in branches]:
    stroke(gd, pts, 30 * w, 16 * w, 255)
    stroke(ed, pts, 17 * w, 5 * w, 255)
    stroke(bd, pts, 13 * w, 3.5 * w, 255)
    stroke(cd, pts, 4 * w, 1 * w, 255)
from PIL import ImageChops
inner = np.asarray(Image.fromarray(((red | hole) & banner).astype('uint8') * 255).filter(ImageFilter.MinFilter(5))) > 0
clothmask = Image.fromarray((inner * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(1.5))
sm = lambda L, rad: ImageChops.multiply((L.resize((W, H), Image.LANCZOS).filter(ImageFilter.GaussianBlur(rad)) if rad else L.resize((W, H), Image.LANCZOS)), clothmask)
gl = sm(glow, 9).point(lambda x: int(x * .7))
img.alpha_composite(Image.merge('RGBA', [Image.new('L', (W, H), 255), Image.new('L', (W, H), 170), Image.new('L', (W, H), 40), gl]))
# polished gold: dark rim, gold body shaded along its length, white-hot core
img.alpha_composite(Image.merge('RGBA', [Image.new('L', (W, H), 110), Image.new('L', (W, H), 62), Image.new('L', (W, H), 6), sm(edge, 0)]))
grad = Image.linear_gradient('L').resize((W, H))
gold_r = Image.new('L', (W, H), 255)
gold_g = grad.point(lambda t: int(212 - t * .3))
gold_b = grad.point(lambda t: int(70 - t * .2))
img.alpha_composite(Image.merge('RGBA', [gold_r, gold_g, gold_b, sm(body, 0)]))
img.alpha_composite(Image.merge('RGBA', [Image.new('L', (W, H), 255), Image.new('L', (W, H), 246), Image.new('L', (W, H), 190), sm(core, .6)]))
img.convert('RGB').save(RAW / 'checkflag_bolt.png')
print('ok')

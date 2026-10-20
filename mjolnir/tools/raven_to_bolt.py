"""Swap the raven on the checkpoint banner for a golden embroidered lightning bolt.

The raven is painted out of assets/raw/items.jpg (diffusion fill from the red cloth) and the bolt
is cut from the generated banner in assets/raw/checkflag.png. Writes assets/raw/items_bolt.png;
then run tools/prepare_sprite.py items assets/raw/items_bolt.png --height 200.
"""
import pathlib
from PIL import Image, ImageFilter, ImageChops
import numpy as np
RAW = pathlib.Path(__file__).resolve().parent.parent / 'assets' / 'raw'
im = Image.open(str(RAW / 'items.jpg')).convert('RGB')
a = np.asarray(im).astype(float)
x0, y0, x1, y1 = 1195, 175, 1385, 302
box = a[y0:y1, x0:x1]
dark = (box[..., 0] < 115) | ((box[..., 0] - box[..., 1] < 70) & (box[..., 0] < 175))
m = Image.fromarray((dark * 255).astype('uint8')).filter(ImageFilter.MaxFilter(7))
mask = np.asarray(m) > 0
fill = box.copy()
red = (box[..., 0] > 150) & (box[..., 1] < 110) & (box[..., 2] < 110)
mask &= ~((box.min(axis=2) > 200) | ((box[..., 1] > 130) & (box[..., 0] > 180)))
yy, xx = np.mgrid[y0:y1, x0:x1]
left = xx < 1336 + (yy - 190) * .37
mask = np.asarray(Image.fromarray((mask * 255).astype('uint8')).filter(ImageFilter.MaxFilter(13)).filter(ImageFilter.MinFilter(13))) > 0
mask &= left
mask &= ~((box.min(axis=2) > 200) & (xx > 1320))
other = ~red & ~mask
fill[mask | other] = np.median(box[red], axis=0)
for it in range(600):
    p = np.pad(fill, ((1, 1), (1, 1), (0, 0)), mode='edge')
    avg = (p[:-2, 1:-1] + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]) / 4
    fill[mask] = avg[mask]
fill[other] = box[other]
rng = np.random.default_rng(1)
fill[mask] += rng.normal(0, 2.5, fill[mask].shape)
a[y0:y1, x0:x1] = fill
# the tail tip that crossed onto the folded half
box = a[y0:y1, x0:x1]
m2 = ~left & (yy > 225) & (yy < 300) & ((box[..., 0] < 115) | ((box[..., 0] - box[..., 1] < 70) & (box[..., 0] < 175))) & ~((box.min(axis=2) > 200))
m2 = np.asarray(Image.fromarray((m2 * 255).astype('uint8')).filter(ImageFilter.MaxFilter(5))) > 0
m2 &= ~left & (box.min(axis=2) < 200)
f2 = box.copy(); red2 = red & ~left; oth2 = ~red2 & ~m2; f2[m2 | oth2] = np.median(box[red2], axis=0)
for it in range(300):
    p = np.pad(f2, ((1, 1), (1, 1), (0, 0)), mode='edge')
    f2[m2] = ((p[:-2, 1:-1] + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]) / 4)[m2]
f2[oth2] = box[oth2]; a[y0:y1, x0:x1] = f2
out = Image.fromarray(np.clip(a, 0, 255).astype('uint8'))
from PIL import ImageDraw
sl = Image.new('L', out.size, 0); ImageDraw.Draw(sl).line([(1337, 194), (1352, 245), (1368, 302)], fill=200, width=4); sl = sl.filter(ImageFilter.GaussianBlur(2))
out = Image.composite(Image.new('RGB', out.size, (92, 14, 16)), out, sl)
print('mask px', mask.sum())
# golden embroidered bolt from the generated banner
src = Image.open(str(RAW / 'checkflag.png')).convert('RGB')
bx0, by0, bx1, by1 = 790, 270, 900, 445
c = np.asarray(src.crop((bx0, by0, bx1, by1))).astype(float)
r, g, b = c[..., 0], c[..., 1], c[..., 2]
gold = (g > 95) & (r > 150) & (g > b + 20)
al = Image.fromarray((gold * 255).astype('uint8')).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(.8))
bolt = Image.fromarray(c.astype('uint8')).convert('RGBA'); bolt.putalpha(al)
bolt = bolt.crop(bolt.getbbox())
print('bolt', bolt.size)
H = 112; bolt = bolt.resize((int(bolt.width * H / bolt.height), H), Image.LANCZOS).rotate(-8, expand=True, resample=Image.BICUBIC)
# dark stitch shadow under the bolt
sh = Image.new('RGBA', bolt.size, (60, 10, 10, 0)); sh.putalpha(bolt.getchannel('A').point(lambda v: v * .55))
o = out.convert('RGBA'); cx, cy = 1283, 240
o.alpha_composite(sh, (cx - bolt.width // 2 + 2, cy - bolt.height // 2 + 3))
o.alpha_composite(bolt, (cx - bolt.width // 2, cy - bolt.height // 2))
o.convert('RGB').save(RAW / 'items_bolt.png')

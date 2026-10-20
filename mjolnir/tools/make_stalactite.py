"""Build the falling stalactite of Svartalfheim: a dripstone cut from the granite base
of assets/raw/crystalspike.png with that image's middle amethyst hung point down at its tip.

Usage: python3 mjolnir/tools/make_stalactite.py OUT.png, then tools/prepare_sprite.py stalactite OUT.png --height 200
"""
import pathlib, sys
from PIL import Image, ImageDraw, ImageFilter
import math, random
random.seed(4)
SRC = pathlib.Path(__file__).resolve().parent.parent / 'assets' / 'raw' / 'crystalspike.png'
raw = Image.open(SRC).convert('RGB')
W, H = 130, 340
tex = raw.crop((180, 720, 860, 800)).rotate(90, expand=True).resize((W, int(680 * W / 80))).crop((0, 0, W, H))
shade = Image.new('L', (W, H)); sd = shade.load()
for x in range(W):
    u = (x - W * .4) / (W * .52); v = max(0.0, 1 - u * u)
    for y in range(H): sd[x, y] = int(255 * min(1, .2 + .9 * v ** .7))
rock = Image.composite(tex, Image.new('RGB', (W, H), (16, 12, 22)), shade)
rock = Image.blend(rock, Image.new('RGB', (W, H), (70, 52, 96)), .2)
mask = Image.new('L', (W, H), 0); md = ImageDraw.Draw(mask)
endY, endHalf = 200, 17
L, R = [], []
for i in range(51):
    t = i / 50; y = t * endY
    half = endHalf + (W / 2 - 3 - endHalf) * (1 - t) ** 1.25
    bump = math.sin(t * 13 + 1) * 3 * (1 - t * .6) + random.uniform(-1.2, 1.2)
    L.append((W / 2 - half - bump, y)); R.append((W / 2 + half + bump * .6, y))
md.polygon(L + [(W / 2 - endHalf * .6, endY + 8), (W / 2 + endHalf * .6, endY + 8)] + R[::-1], fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(.9))
rockA = Image.new('RGBA', (W, H), (0, 0, 0, 0)); rockA.paste(rock, (0, 0), mask)
hl = Image.new('L', (W, H), 0); hd = ImageDraw.Draw(hl)
hd.line([(W * .36, 10), (W * .45, endY - 10)], fill=60, width=4); hl = hl.filter(ImageFilter.GaussianBlur(3))
hl = Image.composite(hl, Image.new('L', (W, H), 0), mask)
rockA = Image.alpha_composite(rockA, Image.merge('RGBA', [Image.new('L', (W, H), 230)] * 3 + [hl]))
crys = Image.open(SRC).convert('RGBA'); cpx = crys.load()
for y in range(crys.height):
    for x in range(crys.width):
        r, g, b, a = cpx[x, y]
        if min(r, g, b) > 232: cpx[x, y] = (255, 255, 255, 0)
mid = crys.crop((420, 120, 600, 420)).transpose(Image.FLIP_TOP_BOTTOM)
cw = 60; ch = int(mid.height * cw / mid.width); mid = mid.resize((cw, ch))
out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
out.alpha_composite(mid, (W // 2 - cw // 2 + 1, endY - 22))
out = Image.alpha_composite(out, rockA)
out = out.crop(out.getbbox()); out.save(sys.argv[1]); print(out.size)

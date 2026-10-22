"""Build the Trophy Hall cups: assets/raw/trophies/cup_<id>.jpg (painted with FLUX.2 Klein on Cloudflare Workers AI)
are keyed off their white background, trimmed and packed into assets/trophies.webp in TROPHIES order.
assets/raw/trophies/plaques.json holds where each cup's blank plaque sits (x, y, radius as fractions of the
1024 px painting); the game draws the trophy's rune there. Then run tools/embed_assets.py.
"""
import json
import pathlib
import re
import sys

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
from prepare_sprite import key_white  # noqa: E402

RAW = ROOT / 'assets' / 'raw' / 'trophies'
ids = re.findall(r"^  \{ id: '(\w+)'", (ROOT / 'index.html').read_text(), re.M)
plaques = json.loads((RAW / 'plaques.json').read_text())
H = 160
parts, pts = [], {}
for i, k in enumerate(ids):
    src = Image.open(RAW / f'cup_{k}.jpg').convert('RGB')
    im = key_white(src)  # also clears the white enclosed by handles
    # ...but never on the cup's bright plaque (silver and white cups shine almost white there)
    import numpy as np
    keep = np.asarray(key_white(src, False).getchannel('A'))
    yy, xx = np.mgrid[0:src.height, 0:src.width]; px0, py0, pr0 = plaques[k]
    disc = (xx - px0 * src.width) ** 2 + (yy - py0 * src.height) ** 2 < (pr0 * src.width * 1.6) ** 2
    a0 = np.asarray(im).copy(); a0[..., 3] = np.where(disc, keep, a0[..., 3]); im = Image.fromarray(a0)
    # the soft grey floor shadow under each painted cup: eat away pale, colourless pixels next to the background
    import numpy as np
    a = np.asarray(im).copy(); rgb = a[..., :3].astype(int)
    pale = (rgb.min(-1) > 150) & (rgb.max(-1) - rgb.min(-1) < 26)
    ys = np.where((a[..., 3] > 0).any(1))[0]; low = np.zeros(pale.shape, bool); low[int(ys[-1] - (ys[-1] - ys[0]) * .2):] = True
    pale &= low  # only the floor around the foot, never the silver cups themselves
    for _ in range(160):
        clear = a[..., 3] < 250
        nb = np.zeros_like(clear); nb[1:] |= clear[:-1]; nb[:-1] |= clear[1:]; nb[:, 1:] |= clear[:, :-1]; nb[:, :-1] |= clear[:, 1:]
        eat = nb & pale & ~clear
        if not eat.any(): break
        a[eat, 3] = 0
    # drop the thin leftover outline of the shadow: an alpha opening removes 1-3 px lines, keeps the cup
    from PIL import ImageFilter
    al = Image.fromarray(a[..., 3]); op = al.filter(ImageFilter.MinFilter(7)).filter(ImageFilter.MaxFilter(9))
    a[..., 3] = np.minimum(a[..., 3], np.asarray(op))
    im = Image.fromarray(a)
    bb = im.getbbox(); im = im.crop(bb)
    s = H / im.height; im = im.resize((max(1, round(im.width * s)), H), Image.LANCZOS)
    px, py, pr = plaques[k]
    pts[str(i)] = {'plaque': [round((px * src.width - bb[0]) * s / im.width, 4), round((py * src.height - bb[1]) * s / H, 4), round(pr * src.width * s / H, 4)]}
    parts.append(im)
W = sum(p.width for p in parts) + 4 * len(parts)
atlas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
x, frames = 0, []
for p in parts:
    atlas.paste(p, (x, 0)); frames.append([x, 0, p.width, H, round(p.width / 2, 1)]); x += p.width + 4
atlas.save(ROOT / 'assets' / 'trophies.webp', 'WEBP', quality=86, method=6)
meta_path = ROOT / 'assets' / 'sprites.json'
meta = json.loads(meta_path.read_text())
meta['trophies'] = {'frames': frames, 'h': H, 'pts': pts, 'ids': ids}
meta_path.write_text(json.dumps(meta))
print(f'trophies: {len(frames)} cups, atlas {W}x{H}')

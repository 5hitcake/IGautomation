"""Turn a generated sprite sheet into a game atlas.

Usage:
  python3 mjolnir/tools/prepare_sprite.py NAME RAW_IMAGE [--height 220]
  python3 mjolnir/tools/prepare_sprite.py --backdrop NAME RAW_IMAGE

Sprite sheets: poses in one horizontal row on a transparent OR plain white
background. White backgrounds are keyed out by flood-filling from the image
border, so white inside the character (eyes, highlights) is kept. Frames are
split at empty columns, trimmed, scaled to a common height and packed into
assets/NAME.webp; frame boxes and foot anchors go into assets/sprites.json.
Then run tools/embed_assets.py.
"""
import argparse
import json
import pathlib
from collections import deque

from PIL import Image, ImageDraw, ImageFilter

ASSETS = pathlib.Path(__file__).resolve().parent.parent / "assets"


def key_white(im):
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()

    def whiteish(x, y):
        r, g, b, a = px[x, y]
        return a < 20 or (min(r, g, b) > 228 and max(r, g, b) - min(r, g, b) < 22)

    bg = bytearray(w * h)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            q.append((x, y))
    while q:
        x, y = q.popleft()
        i = y * w + x
        if bg[i] or not whiteish(x, y):
            continue
        bg[i] = 1
        if x > 0: q.append((x - 1, y))
        if x < w - 1: q.append((x + 1, y))
        if y > 0: q.append((x, y - 1))
        if y < h - 1: q.append((x, y + 1))
    # enclosed white holes (e.g. between legs): large, near-pure white islands are background too
    def island(x, y):
        r, g, b, a = px[x, y]
        return min(r, g, b) > 200 and max(r, g, b) - min(r, g, b) < 26

    seen = bytearray(w * h)
    for sy in range(h):
        for sx in range(w):
            i0 = sy * w + sx
            if bg[i0] or seen[i0] or not island(sx, sy):
                continue
            comp, q2 = [], deque([(sx, sy)])
            seen[i0] = 1
            while q2:
                x, y = q2.popleft()
                comp.append(y * w + x)
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if 0 <= nx < w and 0 <= ny < h:
                        j = ny * w + nx
                        if not seen[j] and not bg[j] and island(nx, ny):
                            seen[j] = 1
                            q2.append((nx, ny))
            if len(comp) >= 60 and sum(min(px[i % w, i // w][:3]) for i in comp) / len(comp) > 238:
                for i in comp:
                    bg[i] = 1
    # grow the background into thin, almost-white fringes left over from JPEG edges
    for _ in range(3):
        grow = []
        for y in range(1, h - 1):
            for x in range(1, w - 1):
                i = y * w + x
                if not bg[i] and (bg[i - 1] or bg[i + 1] or bg[i - w] or bg[i + w]):
                    r, g, b2, _a = px[x, y]
                    if min(r, g, b2) > 215 and max(r, g, b2) - min(r, g, b2) < 30:
                        grow.append(i)
        for i in grow:
            bg[i] = 1
    mask = Image.frombytes("L", (w, h), bytes(0 if v else 255 for v in bg))
    mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(.8))
    # pull the white fringe out of the soft edge
    out = Image.new("RGBA", (w, h))
    op, mp = out.load(), mask.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            m = mp[x, y]
            if 0 < m < 255:
                k = m / 255
                r, g, b = (max(0, min(255, int((c - 255 * (1 - k)) / k))) for c in (r, g, b))
            op[x, y] = (r, g, b, min(a, m))
    return out


def frames_of(im, count=None):
    a = im.getchannel("A").load()
    w, h = im.size
    if count:
        # poses touch each other: cut at the thinnest column near each expected boundary
        cover = [sum(1 for y in range(0, h, 2) if a[x, y] > 60) for x in range(w)]
        cuts = [0]
        for k in range(1, count):
            c, span = k * w // count, w // (2 * count)
            cuts.append(min(range(c - span, c + span), key=lambda x: cover[x]))
        cuts.append(w)
        out = []
        for x0, x1 in zip(cuts, cuts[1:]):
            crop = im.crop((x0, 0, x1, h))
            out.append(crop.crop(crop.getchannel("A").point(lambda v: 255 if v > 40 else 0).getbbox()))
        return out
    cols = [any(a[x, y] > 60 for y in range(0, h, 2)) for x in range(w)]
    segs, x = [], 0
    while x < w:
        if cols[x]:
            s = x
            while x < w and cols[x]:
                x += 1
            if x - s > 30:
                segs.append([s, x])
        else:
            x += 1
    merged = []
    for s in segs:
        if merged and s[0] - merged[-1][1] < 6:
            merged[-1][1] = s[1]
        else:
            merged.append(s)
    out = []
    for x0, x1 in merged:
        crop = im.crop((x0, 0, x1, h))
        crop = crop.crop(crop.getchannel("A").point(lambda v: 255 if v > 40 else 0).getbbox())
        out.append(crop)
    return out


def apply_edits(frames, edits_path):
    """Erase rectangles (or only their light pixels, clear_light), patch spots over with nearby pixels, per frame and turn named points into 0..1 coords of the trimmed frame."""
    pts = {}
    if not edits_path.exists():
        return frames, pts
    edits = json.loads(edits_path.read_text())
    out = []
    for i, f in enumerate(frames):
        e = edits.get(str(i))
        if not e:
            out.append(f)
            continue
        f = f.copy()
        clear = Image.new("RGBA", f.size, (0, 0, 0, 0))
        for x0, y0, x1, y1 in e.get("erase", []):
            f.paste(clear.crop((0, 0, x1 - x0, y1 - y0)), (x0, y0))
        for sx0, sy0, sx1, sy1, dx, dy in e.get("patch", []):
            # cover a spot with a nearby piece of the same frame, feathered at the top and left edges
            p = f.crop((sx0, sy0, sx1, sy1))
            m = Image.new("L", p.size, 0)
            ImageDraw.Draw(m).rectangle([5, 5, p.size[0], p.size[1]], fill=255)
            m = m.filter(ImageFilter.GaussianBlur(3))
            f.paste(Image.composite(p, f.crop((dx, dy, dx + p.size[0], dy + p.size[1])), m), (dx, dy))
        fp = f.load()
        for x0, y0, x1, y1 in e.get("clear_light", []):
            for y in range(max(0, y0), min(f.size[1], y1)):
                for x in range(max(0, x0), min(f.size[0], x1)):
                    if min(fp[x, y][:3]) > 140:
                        fp[x, y] = (0, 0, 0, 0)
        bb = f.getchannel("A").point(lambda v: 255 if v > 40 else 0).getbbox()
        f = f.crop(bb)
        if e.get("points"):
            pts[str(i)] = {k: [round((x - bb[0]) / f.size[0], 4), round((y - bb[1]) / f.size[1], 4)] for k, (x, y) in e["points"].items()}
        out.append(f)
    return out, pts


def build(name, raw, target_h, count=None):
    im = Image.open(raw)
    if im.mode != "RGBA" or im.getchannel("A").getextrema()[0] > 10:
        im = key_white(im)
    frames, pts = apply_edits(frames_of(im, count), pathlib.Path(raw).with_suffix(".edits.json"))
    sc = target_h / max(f.size[1] for f in frames)
    parts = []
    for f in frames:
        f2 = f.resize((max(1, round(f.size[0] * sc)), max(1, round(f.size[1] * sc))), Image.LANCZOS)
        aa = f2.getchannel("A").load()
        w, h = f2.size
        sx = n = 0
        for y in range(int(h * .65), h):
            for x in range(w):
                if aa[x, y] > 100:
                    sx += x
                    n += 1
        parts.append((f2, sx / n if n else w / 2))
    aw = sum(p[0].size[0] for p in parts) + 4 * len(parts)
    ah = max(p[0].size[1] for p in parts)
    atlas = Image.new("RGBA", (aw, ah), (0, 0, 0, 0))
    x, fr = 0, []
    for f2, ax in parts:
        w, h = f2.size
        atlas.paste(f2, (x, ah - h))
        fr.append([x, ah - h, w, h, round(ax, 1)])
        x += w + 4
    atlas.save(ASSETS / f"{name}.webp", "WEBP", quality=88, method=6)
    meta_path = ASSETS / "sprites.json"
    meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
    meta[name] = {"frames": fr, "h": ah}
    if pts:
        meta[name]["pts"] = pts
    meta_path.write_text(json.dumps(meta))
    print(f"{name}: {len(fr)} frames, atlas {aw}x{ah}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("name")
    ap.add_argument("raw")
    ap.add_argument("--height", type=int, default=220)
    ap.add_argument("--backdrop", action="store_true")
    ap.add_argument("--frames", type=int, help="number of poses, when they touch each other")
    a = ap.parse_args()
    if a.backdrop:
        Image.open(a.raw).convert("RGB").save(ASSETS / f"{a.name}.webp", "WEBP", quality=86, method=6)
        print(f"{a.name}: backdrop saved")
    else:
        build(a.name, a.raw, a.height, a.frames)

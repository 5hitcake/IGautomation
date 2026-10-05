"""Give Sleipnir his eight legs: every leg of the painted (four-legged) horse gets a darker twin just behind it.

Usage: python3 mjolnir/tools/eight_legs.py RAW_SHEET OUT_PNG
The sheet has 3 poses (standing, 2 gallop frames with Thor). Per pose: the belly line, the leftmost column that is
leg rather than tail, and how far the far legs are shifted. The light-blue wind swirls are removed first.
"""
import sys
from PIL import Image, ImageChops, ImageFilter
from prepare_sprite import key_white, frames_of

# per pose: belly y, leg x range, twin offset (dx, dy), swirls below this y are removed
POSES = [dict(belly=715, x0=345, x1=1110, dx=-78, dy=-14, swirl=640),
         dict(belly=690, x0=95, x1=930, dx=-66, dy=-14, swirl=640),
         dict(belly=690, x0=190, x1=900, dx=-66, dy=-14, swirl=640)]


def no_swirls(f, y0):
    """Remove the light-blue wind swirls: where they cross a leg the gap is painted over from the leg around it,
    and the loose bits that are left floating are dropped."""
    from collections import deque
    from PIL import ImageFilter
    w, h = f.size
    px = f.load()
    swirl = set()
    for y in range(y0, h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a and ((g - r > 12 and b - r > 15) or min(r, g, b) > 235):
                swirl.add((x, y))
                px[x, y] = (0, 0, 0, 0)
    # a swirl crossing a leg leaves a band with leg above and below it: paint it by blending down the column
    def known(x, y):
        return (x, y) not in swirl and px[x, y][3] > 200
    for (x, y) in sorted(swirl):
        ya = next((y - k for k in range(1, 40) if y - k >= 0 and known(x, y - k)), None)
        yb = next((y + k for k in range(1, 40) if y + k < h and known(x, y + k)), None)
        if ya is None or yb is None:
            continue
        ca, cb, t = px[x, ya], px[x, yb], (y - ya) / (yb - ya)
        px[x, y] = tuple(int(ca[i] + (cb[i] - ca[i]) * t) for i in range(3)) + (255,)
    # keep only the big connected shapes (horse, rider, tail)
    seen = bytearray(w * h)
    comps = []
    for sy in range(h):
        for sx in range(w):
            i = sy * w + sx
            if seen[i] or px[sx, sy][3] <= 40:
                continue
            q = deque([(sx, sy)]); seen[i] = 1; pts = []
            while q:
                x, y = q.popleft(); pts.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and px[nx, ny][3] > 40:
                        seen[ny * w + nx] = 1; q.append((nx, ny))
            comps.append(pts)
    big = max(len(c) for c in comps)
    for c in comps:
        if len(c) < big * .02:
            for x, y in c:
                px[x, y] = (0, 0, 0, 0)
    # faint halo pixels around removed bits
    for y in range(y0, h):
        for x in range(w):
            if 0 < px[x, y][3] <= 40:
                px[x, y] = (0, 0, 0, 0)
    return f


def twin_legs(f, p):
    w, h = f.size
    legs = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    legs.paste(f.crop((p["x0"], p["belly"], p["x1"], h)), (p["x0"], p["belly"]))
    # fade the copy in below the belly so its top edge never shows
    ramp = Image.new("L", (w, h), 0)
    rp = ramp.load()
    for y in range(p["belly"], h):
        v = min(255, (y - p["belly"]) * 255 // 70)
        for x in range(p["x0"], p["x1"]):
            rp[x, y] = v
    a = ImageChops.multiply(legs.getchannel("A"), ramp)
    dark = Image.eval(legs.convert("RGB"), lambda v: int(v * .66))
    far = Image.merge("RGBA", (*dark.split(), a))
    out = Image.new("RGBA", (w + abs(p["dx"]), h), (0, 0, 0, 0))
    ox = abs(p["dx"]) if p["dx"] < 0 else 0
    out.alpha_composite(far, (ox + p["dx"], p["dy"]) if p["dy"] >= 0 else (ox + p["dx"], 0), (0, -p["dy"]) if p["dy"] < 0 else (0, 0))
    out.alpha_composite(f, (ox, 0))
    return out


def main(raw, dst):
    im = key_white(Image.open(raw))
    frames = [twin_legs(no_swirls(f, p["swirl"]), p) for f, p in zip(frames_of(im, 3), POSES)]
    gap = 80
    W = sum(f.size[0] for f in frames) + gap * (len(frames) + 1)
    H = max(f.size[1] for f in frames) + 2 * gap
    sheet = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    x = gap
    for f in frames:
        sheet.alpha_composite(f, (x, H - gap - f.size[1]))
        x += f.size[0] + gap
    sheet.save(dst)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])

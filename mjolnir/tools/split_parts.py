"""Re-lay a generated sheet whose parts overlap in columns (e.g. an item drawn under a pose) into one clean row.

Usage: python3 mjolnir/tools/split_parts.py RAW OUT N
Keys out the white background, finds the N biggest connected shapes (small bits such as dizzy stars join the nearest
one), orders them left to right (ties: top first) and writes them side by side with gaps for prepare_sprite.py.
"""
import sys
from collections import deque
from PIL import Image
from prepare_sprite import key_white


def parts(im, n):
    w, h = im.size
    a = im.getchannel("A").load()
    seen = bytearray(w * h)
    comps = []
    for sy in range(0, h):
        for sx in range(0, w):
            i = sy * w + sx
            if seen[i] or a[sx, sy] <= 40:
                continue
            q = deque([(sx, sy)]); seen[i] = 1; x0 = x1 = sx; y0 = y1 = sy; cnt = 0
            while q:
                x, y = q.popleft(); cnt += 1
                x0, x1, y0, y1 = min(x0, x), max(x1, x), min(y0, y), max(y1, y)
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and a[nx, ny] > 40:
                        seen[ny * w + nx] = 1; q.append((nx, ny))
            comps.append([cnt, x0, y0, x1 + 1, y1 + 1])
    comps.sort(reverse=True)
    big, small = comps[:n], comps[n:]
    for c in small:
        if c[0] < 30:
            continue
        cx, cy = (c[1] + c[3]) / 2, (c[2] + c[4]) / 2
        b = min(big, key=lambda b: max(0, b[1] - cx, cx - b[3]) + max(0, b[2] - cy, cy - b[4]))
        if max(0, b[1] - cx, cx - b[3]) + max(0, b[2] - cy, cy - b[4]) < 120:
            b[1], b[2], b[3], b[4] = min(b[1], c[1]), min(b[2], c[2]), max(b[3], c[3]), max(b[4], c[4])
    big.sort(key=lambda b: (round(b[1] / 200), b[2]))
    return [b[1:] for b in big]


def main(raw, out, n):
    im = key_white(Image.open(raw))
    boxes = parts(im, n)
    crops = []
    for x0, y0, x1, y1 in boxes:
        # keep only this part's pixels inside its box (an overlapping neighbour is cut away)
        crops.append(im.crop((x0, y0, x1, y1)))
    gap = 60
    W = sum(c.width for c in crops) + gap * (len(crops) + 1); H = max(c.height for c in crops) + 2 * gap
    sheet = Image.new("RGBA", (W, H), (0, 0, 0, 0)); x = gap
    for c in crops:
        sheet.alpha_composite(c, (x, H - gap - c.height)); x += c.width + gap
    sheet.save(out)
    print(boxes)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]))

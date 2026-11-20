import sys, numpy as np
from PIL import Image
from scipy import ndimage

src, out_prefix = sys.argv[1], sys.argv[2]
names = ["1_idle", "2_jump", "3_hit", "4_eliminated", "5_victory"]
img = np.array(Image.open(src).convert("RGB")).astype(int)
h, w, _ = img.shape

# background = near-white regions connected to the border (keeps white highlights inside)
white = (img.min(axis=2) > 225) & (img.max(axis=2) - img.min(axis=2) < 25)
lab, _ = ndimage.label(white)
border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
bg = np.isin(lab, border[border > 0])
fg = ~bg
fg = ndimage.binary_opening(fg, iterations=1)

# group foreground blobs into poses by x-center clustering on the big blobs
lab2, n = ndimage.label(ndimage.binary_dilation(fg, iterations=6))
objs = ndimage.find_objects(lab2)
sizes = ndimage.sum(fg, lab2, range(1, n + 1))
big = sorted([i for i in range(n) if sizes[i] > 0.02 * fg.sum()], key=lambda i: objs[i][1].start)
print("big blobs:", len(big))
centers = [(objs[i][1].start + objs[i][1].stop) / 2 for i in big]

assign = np.zeros_like(lab2)
for i in range(n):
    sl = objs[i]
    cx = (sl[1].start + sl[1].stop) / 2
    k = int(np.argmin([abs(cx - c) for c in centers])) + 1
    assign[lab2 == i + 1] = k

alpha = np.where(fg, 255, 0).astype(np.uint8)
alpha = np.array(Image.fromarray(alpha).filter(__import__("PIL.ImageFilter").ImageFilter.GaussianBlur(0.8)))
rgba = np.dstack([img.astype(np.uint8), alpha])

crops = []
for k in range(1, len(big) + 1):
    m = (assign == k) & fg
    ys, xs = np.where(m)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    part = rgba[y0:y1, x0:x1].copy()
    part[..., 3] = np.where((assign[y0:y1, x0:x1] == k), part[..., 3], 0)
    crops.append(part)

S = max(max(c.shape[0], c.shape[1]) for c in crops) + 20
for name, c in zip(names, crops):
    canvas = np.zeros((S, S, 4), np.uint8)
    ch, cw = c.shape[:2]
    oy, ox = S - ch - 10, (S - cw) // 2  # bottom-aligned, so all poses share a ground line
    canvas[oy:oy + ch, ox:ox + cw] = c
    Image.fromarray(canvas).save(f"{out_prefix}_{name}.png")
    print(name, c.shape[:2], "->", S)

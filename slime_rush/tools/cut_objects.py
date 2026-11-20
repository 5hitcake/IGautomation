import sys, numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
src, outdir, names = sys.argv[1], sys.argv[2], sys.argv[3].split(",")
img = np.array(Image.open(src).convert("RGB")).astype(int)
white = (img.min(axis=2) > 222) & (img.max(axis=2) - img.min(axis=2) < 28)
lab, _ = ndimage.label(white)
border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
fg = ~np.isin(lab, border[border > 0])
fg = ndimage.binary_opening(fg, iterations=1)
lab2, n = ndimage.label(ndimage.binary_dilation(fg, iterations=12))
objs = ndimage.find_objects(lab2)
sizes = ndimage.sum(fg, lab2, range(1, n + 1))
big = [i for i in range(n) if sizes[i] > 0.01 * fg.sum()]
# reading order: rows by y-center (bucket), then x
big.sort(key=lambda i: ((objs[i][0].start+objs[i][0].stop)/2 > img.shape[0]/2, objs[i][1].start))
print(len(big), "objects")
alpha = np.array(Image.fromarray(np.where(fg,255,0).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8)))
rgba = np.dstack([img.astype(np.uint8), alpha])
for name, i in zip(names, big):
    sl = objs[i]
    part = rgba[sl].copy()
    part[..., 3] = np.where(lab2[sl] == i + 1, part[..., 3], 0)
    Image.fromarray(part).save(f"{outdir}/{name}.png")
    print(name, part.shape[1], "x", part.shape[0])

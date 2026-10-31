"""Generate a Pumpkaboo cookie cutter / clay cutter as printable STL files.

The outline and the detail lines are traced from the official Pumpkaboo artwork
(Pokédex #710, downloaded from the PokeAPI sprite repository at build time):
  - outline         = the silhouette (alpha channel)
  - detail ribs     = the inked lines inside the silhouette (cloak folds, mouth,
                      pumpkin ridges, the rings around the pumpkin's lantern holes)
  - filled pads     = small closed shapes (eyes, fangs) that press in as wells

Outputs (in this folder):
  pumpkaboo_cutter_outline.stl  - outline-only cutter (easiest release from clay)
  pumpkaboo_cutter_stamp.stl    - outline cutter + detail ribs that imprint the details
  preview.png                   - reference artwork vs. traced design

All units are millimetres. Both models print flange-down on the bed, no supports.
The shapes are mirrored in the model so the imprint reads the right way round once
the cutter is flipped blade-down onto the clay.

Requirements: pip install shapely manifold3d trimesh numpy matplotlib opencv-python-headless scikit-image
"""
import tempfile
import urllib.request
from pathlib import Path

import cv2
import manifold3d as m3d
import numpy as np
import shapely.affinity as aff
import trimesh
from shapely.geometry import LineString, Polygon
from shapely.ops import nearest_points, unary_union
from skimage.morphology import skeletonize

# ---------------- parameters ----------------
TARGET_H = 100.0       # height of the cut shape in mm (width follows, ~83 mm). Clay shrinks ~10-15%.
HEIGHT = 25.0          # total height from flange to blade tip
WALL = 1.6             # main wall thickness
EDGE = 0.9             # thinner cutting edge thickness
EDGE_H = 6.0           # height of the thin cutting edge at the tip
FLANGE_W = 5.0         # flange width (outward) for comfortable pressing
FLANGE_T = 2.4         # flange thickness
RIB_W = 1.3            # detail rib width
SLAB = 6.0             # clay slab thickness you usually roll (mm)
IMPRINT = 2.0          # how deep the details press into the slab
BAR_W = 4.0            # bridge bars that hold the detail ribs
BAR_T = 3.0

ART_URL = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/710.png"
OUT = Path(__file__).resolve().parent


# ---------------- trace the artwork ----------------
def load_art():
    path = Path(tempfile.gettempdir()) / "pumpkaboo_710.png"
    if not path.exists():
        urllib.request.urlretrieve(ART_URL, path)
    return cv2.imread(str(path), cv2.IMREAD_UNCHANGED)


def mask_to_geom(mask, min_area=0.0):
    """Raster mask -> shapely (Multi)Polygon in pixel coordinates, y pointing up."""
    contours, hier = cv2.findContours(mask.astype(np.uint8), cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    polys = []
    for i, c in enumerate(contours):
        if hier[0][i][3] != -1 or len(c) < 3:
            continue
        holes = []
        j = hier[0][i][2]
        while j != -1:
            if len(contours[j]) >= 3:
                holes.append(contours[j][:, 0, :])
            j = hier[0][j][0]
        p = Polygon(c[:, 0, :], holes).buffer(0)
        if p.area >= min_area:
            polys.append(p)
    return aff.scale(unary_union(polys), 1, -1, origin=(0, 0))


img = load_art()
alpha = cv2.GaussianBlur(img[:, :, 3], (0, 0), 2.5) > 128     # blur first -> smooth, non-wobbly edge
hsv = cv2.cvtColor(img[:, :, :3], cv2.COLOR_BGR2HSV)
ink = alpha & (hsv[..., 2] < 70)
ink = cv2.morphologyEx(ink.astype(np.uint8), cv2.MORPH_CLOSE,         # bridge tiny gaps in the pen lines
                       cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))).astype(bool)

ys, xs = np.nonzero(alpha)
PX = TARGET_H / (ys.max() - ys.min() + 1)          # mm per pixel
rib_px = max(1, round(RIB_W / PX / 2))

# keep only the lines inside the silhouette (drop the outer contour line)
inner = cv2.erode((img[:, :, 3] > 128).astype(np.uint8), np.ones((11, 11), np.uint8)).astype(bool)
inner_ink = ink & inner
skel = skeletonize(inner_ink)
lines = cv2.dilate(skel.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * rib_px + 1,) * 2))

# small closed loops in the ink (eyes, fangs) become solid pads
closed = cv2.morphologyEx(ink.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
n, lab, stats, _ = cv2.connectedComponentsWithStats((1 - closed) * inner.astype(np.uint8), connectivity=4)
pads = np.isin(lab, [k for k in range(1, n) if stats[k, cv2.CC_STAT_AREA] < 600])
pads = cv2.dilate(pads.astype(np.uint8), np.ones((3, 3), np.uint8))

to_mm = lambda g: aff.scale(aff.translate(g, -xs.mean(), ys.min()), PX, PX, origin=(0, 0))


def smooth(g, concave=1.0, convex=1.0):
    g = g.buffer(concave, quad_segs=32).buffer(-concave, quad_segs=32)   # round inner notches
    return g.buffer(-convex, quad_segs=32).buffer(convex, quad_segs=32)  # round outer points


outline = to_mm(mask_to_geom(alpha, min_area=1000)).simplify(0.05)
outline = smooth(max(getattr(outline, "geoms", [outline]), key=lambda p: p.area))
details = to_mm(mask_to_geom(lines | pads, min_area=10)).simplify(0.05)
details = details.intersection(outline.buffer(-0.8))
details = unary_union([d for d in getattr(details, "geoms", [details]) if d.area > 1.0])


# ---------------- bridge bars ----------------
def px_pt(x, y):
    return ((x - xs.mean()) * PX, (ys.min() - y) * PX)


minx, miny, maxx, maxy = outline.bounds
bar_lines = [
    LineString([px_pt(208, 0), px_pt(208, 475)]),        # centre line, between the eyes
    LineString([(minx - 5, px_pt(0, 205)[1]), (maxx + 5, px_pt(0, 205)[1])]),  # through the eyes
    LineString([(minx - 5, px_pt(0, 358)[1]), (maxx + 5, px_pt(0, 358)[1])]),  # through the lantern holes
]
reach = outline.buffer(WALL / 2)
bars = unary_union([b.buffer(BAR_W / 2, cap_style="flat") for b in bar_lines]).intersection(reach)

# connect any detail piece that doesn't touch a bar with a short extra bar
anchor = unary_union([bars, outline.exterior])   # bars + the cutter wall
for piece in getattr(details, "geoms", [details]):
    if not piece.intersects(bars):
        a, b = nearest_points(piece, anchor)
        a = piece.representative_point() if piece.area < 4 else a
        extra = LineString([a, b]).buffer(BAR_W / 2.5, cap_style="round")
        bars = unary_union([bars, extra.intersection(reach)])
        anchor = unary_union([anchor, extra])


def mirror(g):
    return aff.scale(g, xfact=-1, yfact=1, origin=(0, 0))


outline_m, details_m, bars_m = mirror(outline), mirror(details), mirror(bars)


# ---------------- 3D ----------------
def to_cs(g):
    contours = []
    for p in getattr(g, "geoms", [g]):
        if p.is_empty or p.geom_type != "Polygon":
            continue
        contours.append(np.asarray(p.exterior.coords)[:-1])
        contours.extend(np.asarray(r.coords)[:-1] for r in p.interiors)
    return m3d.CrossSection(contours, m3d.FillRule.EvenOdd)


def slab(g, z0, z1):
    return to_cs(g).extrude(z1 - z0).translate((0, 0, z0))


def body(o):
    wall = o.buffer(WALL, quad_segs=32).difference(o)
    edge = o.buffer(EDGE, quad_segs=32).difference(o)
    flange = o.buffer(WALL + FLANGE_W, quad_segs=32).difference(o)
    return (slab(flange, 0, FLANGE_T)
            + slab(wall, 0, HEIGHT - EDGE_H)
            + slab(edge, HEIGHT - EDGE_H - 0.01, HEIGHT))


def save(man, name):
    assert len(man.decompose()) == 1, f"{name} is not one connected piece"
    mesh = man.to_mesh()
    tm = trimesh.Trimesh(vertices=mesh.vert_properties[:, :3], faces=mesh.tri_verts, process=False)
    assert tm.is_watertight, name
    tm.export(OUT / name)
    ext = tm.bounds[1] - tm.bounds[0]
    print(f"{name}: {ext[0]:.1f} x {ext[1]:.1f} x {ext[2]:.1f} mm, watertight={tm.is_watertight}")


cutter = body(outline_m)
rib_top = HEIGHT - (SLAB - IMPRINT)   # rib tips stop short of the blade tip
stamp = cutter + slab(bars_m, 0, BAR_T) + slab(details_m, 0, rib_top)


# ---------------- preview ----------------
def draw(ax, g, **kw):
    from matplotlib.patches import PathPatch
    from matplotlib.path import Path as MPath
    for p in getattr(g, "geoms", [g]):
        rings = [np.asarray(p.exterior.coords)] + [np.asarray(r.coords) for r in p.interiors]
        path = MPath.make_compound_path(*[MPath(r, closed=True) for r in rings])
        ax.add_patch(PathPatch(path, lw=0, **kw))
    ax.autoscale_view()


if __name__ == "__main__":
    save(cutter, "pumpkaboo_cutter_outline.stl")
    save(stamp, "pumpkaboo_cutter_stamp.stl")
    print(f"cut shape: {outline.bounds[2] - outline.bounds[0]:.1f} x {outline.bounds[3] - outline.bounds[1]:.1f} mm")

    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    fig, axes = plt.subplots(1, 3, figsize=(15, 5.5))
    axes[0].imshow(cv2.cvtColor(img, cv2.COLOR_BGRA2RGBA))
    cut_px = aff.translate(aff.scale(outline, 1 / PX, -1 / PX, origin=(0, 0)), xs.mean(), ys.min())
    axes[0].plot(*cut_px.exterior.xy, color="red", lw=1.2)
    axes[0].set_title("Official artwork + cut line (red)")
    draw(axes[1], outline, color="#c9875f")
    draw(axes[1], details, color="#3b2a1e")
    axes[1].set_title("Imprint on the clay")
    draw(axes[2], outline.buffer(WALL + FLANGE_W).difference(outline), color="#999")
    draw(axes[2], bars, color="#5577aa", alpha=0.6)
    draw(axes[2], details, color="#222")
    axes[2].set_title("Stamp cutter seen from above (in use)")
    for ax in axes:
        ax.set_aspect("equal")
        ax.axis("off")
    fig.tight_layout()
    fig.savefig(OUT / "preview.png", dpi=150)

"""Generate a Pumpkaboo-inspired cookie cutter / clay cutter as printable STL files.

Outputs (in this folder):
  pumpkaboo_cutter_outline.stl  - outline-only cutter (easiest release from clay)
  pumpkaboo_cutter_stamp.stl    - outline cutter + detail ribs that imprint the face/ridges
  preview.png                   - 2D drawing of the outline and detail lines

All units are millimetres. Both models print flange-down on the bed, no supports.
The shapes are mirrored in the model so the imprint reads the right way round once
the cutter is flipped blade-down onto the clay.

Requirements: pip install shapely manifold3d trimesh numpy matplotlib
"""
import math
from pathlib import Path

import manifold3d as m3d
import numpy as np
import shapely.affinity as aff
import trimesh
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import unary_union

# ---------------- parameters ----------------
SCALE = 1.0            # 1.0 -> about 84 mm wide x 98 mm tall. Remember clay shrinks ~10-15%.
HEIGHT = 25.0          # total height from flange to blade tip
WALL = 1.6             # main wall thickness
EDGE = 0.9             # thinner cutting edge thickness
EDGE_H = 6.0           # height of the thin cutting edge at the tip
FLANGE_W = 5.0         # flange width (outward) for comfortable pressing
FLANGE_T = 2.4         # flange thickness
RIB_W = 1.4            # detail rib width
SLAB = 6.0             # clay slab thickness you usually roll (mm)
IMPRINT = 2.0          # how deep the details press into the slab
BAR_W = 5.0            # bridge bars that hold the detail ribs
BAR_T = 3.0

OUT = Path(__file__).resolve().parent


def ellipse(cx, cy, w, h):
    return aff.translate(aff.scale(Point(0, 0).buffer(1, quad_segs=64), w / 2, h / 2), cx, cy)


def bezier(p0, p1, p2, p3, n=60):
    t = np.linspace(0, 1, n)[:, None]
    p0, p1, p2, p3 = map(np.array, (p0, p1, p2, p3))
    return (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3


def tapered_stroke(pts, r0, r1):
    """Union of circles along a path with radius tapering r0 -> r1 (rounded ends)."""
    n = len(pts)
    return unary_union([Point(p).buffer(r0 + (r1 - r0) * i / (n - 1), quad_segs=24)
                        for i, p in enumerate(pts)])


def smooth(g, concave=3.0, convex=1.5):
    g = g.buffer(concave, quad_segs=32).buffer(-concave, quad_segs=32)   # round inner notches
    return g.buffer(-convex, quad_segs=32).buffer(convex, quad_segs=32)  # round outer points


# ---------------- 2D design ----------------
# Pumpkin body: three overlapping lobes
pumpkin_center = ellipse(0, 0, 54, 52)
lobe_l = ellipse(-21, -1, 42, 47)
lobe_r = ellipse(21, -1, 42, 47)
pumpkin = unary_union([pumpkin_center, lobe_l, lobe_r])

# Ghost head peeking out of the top of the pumpkin
head = ellipse(0, 33, 46, 40)

# Curly hair tuft on top of the head, sweeping up and curling to the right
tuft_path = np.vstack([
    bezier((-3, 47), (-6, 58), (-2, 68), (8, 70)),
    bezier((8, 70), (15, 71), (18, 65), (14, 61))[1:],
])
tuft = tapered_stroke(tuft_path, 6.0, 3.6)

outline = smooth(unary_union([pumpkin, head, tuft]))

# Detail lines (become imprint ribs)
details = []
# rim of the pumpkin where the head comes out (top arc of the centre lobe, inside the head)
rim = LineString([(27 * math.cos(a), 26 * math.sin(a))
                  for a in np.linspace(math.radians(40), math.radians(140), 50)])
details.append(rim.buffer(RIB_W / 2, quad_segs=12))
# pumpkin ridges following the lobe seams
for s in (-1, 1):
    ridge = LineString(bezier((s * 7, 24), (s * 1, 10), (s * 1, -10), (s * 7, -22)))
    details.append(ridge.buffer(RIB_W / 2, quad_segs=12))
    outer = LineString(bezier((s * 23, 13), (s * 17, 4), (s * 17, -10), (s * 23, -20)))
    details.append(outer.buffer(RIB_W / 2, quad_segs=12))
# big round eyes with pupils
EYE_Y = 39
for s in (-1, 1):
    ring = Point(s * 9, EYE_Y).buffer(5.5, quad_segs=32)
    details.append(ring.difference(ring.buffer(-RIB_W)))
    details.append(Point(s * 9.6, EYE_Y - 0.5).buffer(2.0, quad_segs=24))  # pupil (solid dot)
# small smile
smile = LineString([(4 * math.cos(a), 31.5 + 2.2 * math.sin(a))
                    for a in np.linspace(math.radians(200), math.radians(340), 30)])
details.append(smile.buffer(RIB_W / 2, quad_segs=12))
details = unary_union(details).intersection(outline.buffer(-1.5))

# Bridge bars (sit at flange level, hold the ribs, give a flat surface to push on)
bars = unary_union([
    LineString([(0, -40), (0, 80)]).buffer(BAR_W / 2, cap_style="flat"),
    LineString([(-40, EYE_Y), (40, EYE_Y)]).buffer(BAR_W / 2, cap_style="flat"),
    LineString([(-60, 2), (60, 2)]).buffer(BAR_W / 2, cap_style="flat"),
]).intersection(outline.buffer(WALL / 2))


def mirror(g):
    return aff.scale(g, xfact=-SCALE, yfact=SCALE, origin=(0, 0))


outline_m, details_m, bars_m = mirror(outline), mirror(details), mirror(bars)


# ---------------- 3D ----------------
def to_cs(g):
    contours = []
    geoms = getattr(g, "geoms", [g])
    for p in geoms:
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
    mesh = man.to_mesh()
    tm = trimesh.Trimesh(vertices=mesh.vert_properties[:, :3], faces=mesh.tri_verts, process=False)
    assert tm.is_watertight, name
    tm.export(OUT / name)
    ext = tm.bounds[1] - tm.bounds[0]
    print(f"{name}: {ext[0]:.1f} x {ext[1]:.1f} x {ext[2]:.1f} mm, watertight={tm.is_watertight}")


cutter = body(outline_m)
save(cutter, "pumpkaboo_cutter_outline.stl")

rib_top = HEIGHT - (SLAB - IMPRINT)   # rib tips stop short of the blade tip
stamp = cutter + slab(bars_m, 0, BAR_T) + slab(details_m, 0, rib_top)
save(stamp, "pumpkaboo_cutter_stamp.stl")


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
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    fig, axes = plt.subplots(1, 2, figsize=(10, 6))
    a = axes[0]
    draw(a, outline, color="#e8a35a")
    draw(a, details, color="#3b2a1e")
    a.set_title("Imprint on the clay")
    b = axes[1]
    draw(b, outline.buffer(WALL + FLANGE_W).difference(outline), color="#999")
    draw(b, bars, color="#5577aa", alpha=0.6)
    draw(b, details, color="#222")
    b.set_title("Cutter seen from above (in use)")
    for ax in axes:
        ax.set_aspect("equal")
        ax.axis("off")
    fig.tight_layout()
    fig.savefig(OUT / "preview.png", dpi=110)

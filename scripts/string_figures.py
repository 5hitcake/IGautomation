"""3D-Figuren und optische Taeuschungen fuer string_art.py.

Jede Figur liefert dasselbe Format wie die anderen Stile: Naegel (Bildschirm-Koordinaten),
Einschlag-Reihenfolge, Faeden (Nagel a, Nagel b, Farbindex) und Farben.

  cube      Isometrischer Wuerfel: drei Flaechen mit parallelen Faeden, unterschiedlich dicht
            und in drei Toenen -> raeumlicher Eindruck.
  penrose   Unmoegliches Dreieck (Penrose): drei Balken, deren Enden sich "unmoeglich" verbinden.
  tunnel    Spiral-Tunnel: ineinander gedrehte, kleiner werdende Quadrate -> Sog in die Tiefe.

Flaechen werden "schraffiert": parallele Faeden, deren Enden auf dem Flaechenrand liegen - dort
sitzen die Naegel (wie bei echten Fadenbildern). Verdeckung (Painter-Algorithmus) mit shapely.
"""

import math

import numpy as np

# Bildbereich wie in string_art.py
ART = 900
ART_X, ART_Y = 90, 440

# Isometrische Projektion: (1,1,1) faellt auf einen Punkt -> Grundlage des Penrose-Tricks.
C30, S30 = math.cos(math.pi / 6), 0.5


def iso(p):
    x, y, z = p
    return ((x - y) * C30, (x + y) * S30 - z)


def box_faces(x0, x1, y0, y1, z0, z1):
    """Sichtbare Flaechen eines Quaders (Blick aus +x,+y,+z): oben (+z), +x, +y."""
    top = [(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    fx = [(x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)]
    fy = [(x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)]
    return [("top", top), ("x", fx), ("y", fy)]


class Builder:
    """Sammelt Naegel (mit Zusammenfassen naher Punkte) und Faeden."""

    def __init__(self, merge=5.0):
        self.nails, self.segs, self.merge = [], [], merge

    def nail(self, p):
        for i, q in enumerate(self.nails):
            if (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 < self.merge ** 2:
                return i
        self.nails.append((float(p[0]), float(p[1])))
        return len(self.nails) - 1

    def line(self, p, q, color):
        a, b = self.nail(p), self.nail(q)
        if a != b:
            self.segs.append((a, b, color))


def fit_to_art(polys, pad=0.06):
    """Skaliert/verschiebt 2D-Polygone (Liste von Punktlisten) in den Bildbereich."""
    pts = np.array([p for poly in polys for p in poly])
    lo, hi = pts.min(0), pts.max(0)
    s = (1 - 2 * pad) * ART / max(hi - lo)
    off = np.array([ART_X, ART_Y]) + (ART - (hi - lo) * s) / 2

    def f(p):
        return tuple((np.array(p) - lo) * s + off)

    return f


def hatch(builder, region, angle, spacing, color):
    """Region (shapely) mit parallelen Faeden fuellen; Enden auf dem Rand = Naegel."""
    from shapely.geometry import LineString

    if region.is_empty:
        return
    minx, miny, maxx, maxy = region.bounds
    cx, cy = (minx + maxx) / 2, (miny + maxy) / 2
    r = math.hypot(maxx - minx, maxy - miny)
    d = np.array([math.cos(angle), math.sin(angle)])
    nrm = np.array([-d[1], d[0]])
    k = -r
    lines = []
    while k <= r:
        c = np.array([cx, cy]) + nrm * k
        seg = LineString([tuple(c - d * r), tuple(c + d * r)]).intersection(region)
        parts = getattr(seg, "geoms", [seg])
        for part in parts:
            if part.geom_type == "LineString" and part.length > spacing * 0.8:
                (x0, y0), (x1, y1) = part.coords[0], part.coords[-1]
                lines.append(((x0, y0), (x1, y1)))
        k += spacing
    # Durchgehender Faden wie beim echten Spannen: hin, schraeg zum naechsten Nagel zurueck, hin ...
    # (die Schraegen verdoppeln die Dichte, ohne zusaetzliche Naegel)
    for n, (p, q) in enumerate(lines):
        if n % 2:
            p, q = q, p
        builder.line(p, q, color)
        if n + 1 < len(lines):
            p2, q2 = lines[n + 1]
            nxt = q2 if n % 2 == 0 else p2
            if math.dist(q, nxt) < spacing * 3 and region.buffer(1.5).contains(LineString([q, nxt])):
                builder.line(q, nxt, color)


def outline(builder, region, color):
    polys = getattr(region, "geoms", [region])
    for poly in polys:
        if poly.is_empty:
            continue
        cs = list(poly.exterior.coords)
        for p, q in zip(cs, cs[1:]):
            builder.line(p, q, color)


def _render_faces(faces, shades, colors, spacing):
    """faces: Liste (Name, 2D-Polygon) in Zeichenreihenfolge (spaeter = davor)."""
    from shapely.geometry import Polygon
    from shapely.ops import unary_union

    polys = [Polygon(p).buffer(0) for _, p in faces]
    b = Builder()
    for i, (name, _) in enumerate(faces):
        front = unary_union(polys[i + 1:]) if i + 1 < len(polys) else None
        vis = polys[i].difference(front) if front is not None else polys[i]
        if vis.area < 50:
            continue
        ang, dens = shades[name]
        hatch(b, vis, ang, spacing / dens, colors[name])
    for i, (name, _) in enumerate(faces):  # Kanten zum Schluss, fuer klare Konturen
        front = unary_union(polys[i + 1:]) if i + 1 < len(polys) else None
        vis = polys[i].difference(front) if front is not None else polys[i]
        if vis.area >= 50:
            outline(b, vis, colors["edge"])
    return b


PALETTE = {"top": 1, "x": 2, "y": 3, "edge": 0}


def figure_cube(colors=None):
    faces3 = box_faces(0, 1, 0, 1, 0, 1)
    proj = [(n, [iso(p) for p in poly]) for n, poly in faces3]
    f = fit_to_art([p for _, p in proj], pad=0.12)
    faces = [(n, [f(p) for p in poly]) for n, poly in proj]
    shades = {"top": (0.0, 0.8), "x": (math.radians(90), 1.35), "y": (math.radians(-30), 2.0)}
    b = _render_faces(faces, shades, PALETTE, spacing=16)
    return b, colors or [(20, 20, 25), (130, 150, 175), (40, 90, 150), (15, 30, 60)]


def figure_penrose(L=5.0, colors=None):
    """Unmoegliches Dreieck aus drei Balken entlang x, y, z. Weil (1,1,1) isometrisch auf einen
    Punkt faellt, scheint das obere Ende des z-Balkens am Anfang des x-Balkens anzusetzen.
    Zeichenreihenfolge so, dass jeder Balken den naechsten an seiner Ecke verdeckt."""
    a = box_faces(0, L, 0, 1, 0, 1)            # x-Balken
    bb = box_faces(L - 1, L, 0, L, 0, 1)       # y-Balken
    c = box_faces(L - 1, L, L - 1, L, 0, L)    # z-Balken (steigt auf)
    # Reihenfolge: z-Balken hinten, dann y, dann x vorn (verdeckt das obere z-Ende)
    order = [("z", c), ("y", bb), ("x", a)]
    proj = []
    for _, faces in order:
        for n, poly in faces:
            proj.append((n, [iso(p) for p in poly]))
    proj = [(n, [(y, -x) for x, y in poly]) for n, poly in proj]  # Spitze nach oben drehen
    f = fit_to_art([p for _, p in proj], pad=0.10)
    faces = [(n, [f(p) for p in poly]) for n, poly in proj]
    shades = {"top": (math.radians(90), 0.8), "x": (0.0, 1.35), "y": (math.radians(60), 2.0)}
    b = _render_faces(faces, shades, PALETTE, spacing=16)
    return b, colors or [(20, 20, 25), (235, 165, 30), (200, 55, 40), (85, 25, 30)]


def figure_tunnel(n_squares=60, t=0.065, colors=None):
    """Ineinander gedrehte Quadrate: die Ecken jedes Quadrats liegen auf den Kanten des
    vorherigen (Anteil t) - es entsteht eine Spirale, die in die Tiefe zieht."""
    s = ART * 0.47
    cx, cy = ART_X + ART / 2, ART_Y + ART / 2
    sq = [(cx - s, cy - s), (cx + s, cy - s), (cx + s, cy + s), (cx - s, cy + s)]
    b = Builder(merge=2.0)
    pal = colors or [(25, 25, 30), (40, 110, 180), (190, 60, 45)]
    for k in range(n_squares):
        col = (k // 4) % 3 if k < n_squares - 8 else 0
        for i in range(4):
            b.line(sq[i], sq[(i + 1) % 4], col)
        sq = [(sq[i][0] + (sq[(i + 1) % 4][0] - sq[i][0]) * t, sq[i][1] + (sq[(i + 1) % 4][1] - sq[i][1]) * t)
              for i in range(4)]
    return b, pal


FIGURES = {"cube": figure_cube, "penrose": figure_penrose, "tunnel": figure_tunnel}


def style_figure(name):
    b, colors = FIGURES[name]()
    nails = b.nails
    # Einschlag-Reihenfolge: grob von oben nach unten
    order = sorted(range(len(nails)), key=lambda i: (round(nails[i][1] / 40), nails[i][0]))
    return {"nails": nails, "order": order, "segs": b.segs, "colors": colors,
            "alpha": 0.9, "width": 2.0, "shape": "square"}

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


# =========================================================================== Im Nagelkreis
# Alles nur mit Naegeln auf einem Kreis: jede Flaeche der Figur ist eine eigene Fadenfarbe, ihre
# Sehnen sucht derselbe Greedy-Algorithmus wie bei den Portraets (string_art._solve). Weil die
# Kanten der Figuren gerade sind, liegen viele Sehnen genau auf den Kanten -> klare Formen.


def _visible_faces(faces):
    from shapely.geometry import Polygon
    from shapely.ops import unary_union

    polys = [Polygon(p).buffer(0) for _, p in faces]
    out = []
    for i, (name, _) in enumerate(faces):
        front = unary_union(polys[i + 1:]) if i + 1 < len(polys) else None
        vis = polys[i].difference(front) if front is not None else polys[i]
        if vis.area > 50:
            out.append((name, vis))
    return out


def _faces_for(name):
    if name == "cube":
        proj = [(n, [iso(p) for p in poly]) for n, poly in box_faces(0, 1, 0, 1, 0, 1)]
    else:  # penrose
        L = 5.0
        order = [box_faces(L - 1, L, L - 1, L, 0, L), box_faces(L - 1, L, 0, L, 0, 1),
                 box_faces(0, L, 0, 1, 0, 1)]
        proj = [(n, [iso(p) for p in poly]) for faces in order for n, poly in faces]
        proj = [(n, [(y, -x) for x, y in poly]) for n, poly in proj]
    pad = 0.24 if name == "cube" else 0.20  # Figur muss in den Kreis passen
    f = fit_to_art([p for _, p in proj], pad=pad)
    return _visible_faces([(n, [f(p) for p in poly]) for n, poly in proj])


def _raster(region, work):
    """shapely-Region (Bildschirm) -> Maske in Arbeitskoordinaten."""
    from PIL import Image, ImageDraw

    m = Image.new("L", (work, work), 0)
    d = ImageDraw.Draw(m)
    for poly in getattr(region, "geoms", [region]):
        pts = [((x - ART_X) / ART * work, (y - ART_Y) / ART * work) for x, y in poly.exterior.coords]
        d.polygon(pts, fill=255)
    return np.asarray(m, np.float32) / 255.0


FACE_SHADE = {"top": 0.42, "x": 0.72, "y": 1.0}  # Dunkelheit je Flaeche (Licht von oben)


def circle_figure(name, n_nails=360, max_lines=9000, line_dark=0.05):
    """Figur als schattiertes Graustufen-Ziel; derselbe Algorithmus wie bei den Portraets baut sie
    aus Tausenden feinen Sehnen nach (eine Fadenfarbe)."""
    import cv2
    import string_art as sa

    work = sa.WORK
    faces = _faces_for(name)
    target = np.zeros((work, work), np.float32)
    for fname, region in faces:
        target = np.maximum(target, _raster(region, work) * FACE_SHADE[fname])
    edges = np.zeros_like(target)
    for _, region in faces:
        e = cv2.Canny((_raster(region, work) * 255).astype(np.uint8), 50, 150).astype(np.float32) / 255.0
        edges = np.maximum(edges, e)
    edges = cv2.GaussianBlur(cv2.dilate(edges, np.ones((2, 2), np.uint8)), (3, 3), 0)
    fig = np.clip(target + 0.6 * edges, 0, 1)
    inside = cv2.dilate((target > 0).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    # Hintergrund negativ: Sehnen, die viel Leere kreuzen, lohnen sich nicht -> weniger Schleier
    target = np.where(inside, fig, -0.22) * sa.shape_mask("circle")
    pts, side = sa.frame_nails("circle", n_nails)
    seq = sa._solve(target, pts, side, max_lines=max_lines, line_dark=line_dark)
    cover = 1 / (sa.ART * sa.SS / work)
    return {"nails": sa.to_screen(pts), "order": list(range(n_nails)), "segs": [(a, b, 0) for a, b in seq],
            "colors": [None], "alpha": min(0.9, line_dark / cover), "width": 0.5, "shape": "circle"}


def circle_wormhole(n_nails=240, layers=None):
    """Wurmloch: Sehnen, die jeweils einen inneren Kreis beruehren. Wandert dieser Kreis von Lage
    zu Lage zur Seite und wird kleiner, entsteht eine gebogene Roehre in die Tiefe."""
    import string_art as sa

    work = sa.WORK
    pts, _ = sa.frame_nails("circle", n_nails)
    R = work / 2 * 0.985
    cx = cy = work / 2
    layers = layers or [
        # (Mittelpunkt-Versatz x, y als Anteil von R, Radius-Anteil, Farbe)
        (0.00, 0.00, 0.62, (20, 20, 25)),
        (0.08, -0.05, 0.48, (40, 110, 180)),
        (0.17, -0.10, 0.35, (20, 20, 25)),
        (0.26, -0.15, 0.23, (200, 60, 45)),
        (0.33, -0.19, 0.12, (20, 20, 25)),
    ]
    segs, colors = [], []
    for k, (ox, oy, rr, col) in enumerate(layers):
        mx, my, r = cx + ox * R, cy + oy * R, rr * R
        colors.append(col)
        for i in range(n_nails):
            px, py = pts[i]
            dx, dy = mx - px, my - py
            dist = math.hypot(dx, dy)
            if dist <= r:
                continue
            # Tangente von P an den inneren Kreis (eine Seite), dann zweiter Schnitt mit dem Aussenkreis
            a = math.atan2(dy, dx) + math.asin(r / dist)
            ux, uy = math.cos(a), math.sin(a)
            # P + t*u auf dem Aussenkreis: |P - C + t u|^2 = R^2
            qx, qy = px - cx, py - cy
            t = -2 * (qx * ux + qy * uy)
            ex, ey = px + t * ux, py + t * uy
            ang = math.atan2(ey - cy, ex - cx)
            j = int(round(((ang + math.pi / 2) % (2 * math.pi)) / (2 * math.pi) * n_nails)) % n_nails
            if j != i:
                segs.append((i, j, k))
    return {"nails": sa.to_screen(pts), "order": list(range(n_nails)), "segs": segs,
            "colors": colors, "alpha": 0.75, "width": 1.0, "shape": "circle"}


def circle_vortex(n_nails=240, steps=11):
    """Strudel: der innere Beruehrungskreis wandert auf einer Spirale nach innen und wird kleiner."""
    layers = []
    for k in range(steps):
        t = k / (steps - 1)
        ang = t * 2.4 * math.pi
        off = 0.30 * t
        col = (20, 20, 25) if k % 2 == 0 else (int(40 + 160 * t), int(110 - 50 * t), int(180 - 135 * t))
        layers.append((off * math.cos(ang), off * math.sin(ang), 0.70 * (1 - t) + 0.06, col))
    return circle_wormhole(n_nails, layers)


def circle_sphere(n_nails=240, steps=9):
    """Kugel: Beruehrungskreise schrumpfen und wandern nach oben links (Lichtpunkt) -> Woelbung."""
    layers = []
    for k in range(steps):
        t = k / (steps - 1)
        col = (20, 20, 25) if k < steps - 3 else (200, 60, 45)
        layers.append((-0.28 * t, -0.30 * t, 0.80 * (1 - t) + 0.05, col))
    return circle_wormhole(n_nails, layers)


CIRCLE_FIGURES = {"cube": lambda: circle_figure("cube"), "penrose": lambda: circle_figure("penrose"),
                  "wormhole": circle_wormhole, "vortex": circle_vortex, "sphere": circle_sphere}

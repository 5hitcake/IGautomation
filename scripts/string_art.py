"""Fadenbild-Videos ("String Art": Naegel + Faden), komplett per Code animiert.

Stile:
  circle   Portraet: Naegel im Kreis, Tausende Sehnen (klassischer Greedy-Algorithmus).
           Auf dunklem Brett mit hellem Faden (--invert), auf hellem Brett mit dunklem Faden.
  lowpoly  Geometrisch wie die bekannten Loewen-Bilder: Naegel an Eckpunkten, der Faden laeuft
           die Kanten eines Dreiecksnetzes entlang, das den Linien des Motivs folgt.
  fill     Silhouette: Naegel entlang des Umrisses, Faden kreuz und quer im Inneren (Farbe aus
           dem Motiv), zum Schluss einmal rundherum.
  pattern  Mathematische Muster ohne Vorlage (Kardioide, Nephroide, Mandala in mehreren Farben).

Hintergrund ist ein echtes (KI-)Foto eines Bretts in Draufsicht (assets/string_art/boards).
Naegel stecken schlagartig im Brett (jeder Schlag: kurzer Ruck), danach wird der Faden gespannt -
anfangs einzeln, dann immer schneller. Am Ende bleibt das Bild mit langsamem Zoom stehen.

Nutzung:
  python scripts/string_art.py --style circle  --image assets/string_art/motifs/real_face_woman.jpg
  python scripts/string_art.py --style circle  --image .../anime_girl.png --board dark_walnut --invert
  python scripts/string_art.py --style lowpoly --image .../brandenburg_gate.png
  python scripts/string_art.py --style fill    --image .../comic_cat_red.png
  python scripts/string_art.py --style pattern --pattern mandala --board dark_walnut
"""

import argparse
import json
import math
import os
import subprocess
import time

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BOARDS = os.path.join(ROOT, "assets", "string_art", "boards")

W, H = 1080, 1920
FPS = 30
ART = 920  # Kantenlaenge des Bildbereichs (Quadrat)
ART_X, ART_Y = (W - ART) // 2, 420
SS = 2  # Supersampling der Fadenebene
WORK = 420  # Arbeitsaufloesung fuer den Kreis-Algorithmus


# =========================================================================== Motive / Stile


def _square(img, center=(0.5, 0.5), scale=1.0, size=WORK):
    side = int(min(img.size) * scale)
    cx, cy = int(img.width * center[0]), int(img.height * center[1])
    x0 = max(0, min(img.width - side, cx - side // 2))
    y0 = max(0, min(img.height - side, cy - side // 2))
    return img.crop((x0, y0, x0 + side, y0 + side)).resize((size, size), Image.LANCZOS)


def style_circle(path, invert=False, center=(0.5, 0.45), scale=0.9, n_nails=280, max_lines=4500):
    img = _square(Image.open(path).convert("L"), center, scale)
    img = ImageOps.equalize(ImageOps.autocontrast(img, cutoff=1))
    val = np.asarray(img, np.float32) / 255.0
    dark = val if invert else 1.0 - val  # wo Faden hin soll
    edges = np.asarray(img.filter(ImageFilter.FIND_EDGES).filter(ImageFilter.GaussianBlur(1)),
                       np.float32) / 255.0
    t = np.clip((dark - 0.24) * 1.4, 0, 1) ** 1.3 + 0.6 * edges
    yy, xx = np.mgrid[0:WORK, 0:WORK].astype(np.float32)
    r = np.sqrt((xx - WORK / 2) ** 2 + (yy - WORK / 2) ** 2) / (WORK / 2)
    target = np.clip(t, 0, 1) * (r < 0.97)

    ang = np.linspace(-math.pi / 2, 1.5 * math.pi, n_nails, endpoint=False)
    rad = WORK / 2 * 0.985
    nails_w = np.stack([WORK / 2 + rad * np.cos(ang), WORK / 2 + rad * np.sin(ang)], 1)
    seq = _solve_circle(target, nails_w, max_lines=max_lines)
    nails = [(ART_X + x / WORK * ART, ART_Y + y / WORK * ART) for x, y in nails_w]
    return {
        "nails": nails, "order": list(range(n_nails)), "segs": [(a, b, 0) for a, b in seq],
        "colors": [None], "alpha": 0.45, "width": 1.0,
    }


def _solve_circle(target, nails, max_lines=4500, min_skip=18, line_dark=0.13):
    """Klassischer Greedy-Fadenalgorithmus: vom aktuellen Nagel immer zur Sehne mit dem groessten
    mittleren Rest-Dunkel; die Linie wird danach vom Rest abgezogen."""
    n = len(nails)
    per_nail = []
    for i in range(n):
        idx, offs, lens, js = [], [], [], []
        pos = 0
        for j in range(n):
            if min((i - j) % n, (j - i) % n) < min_skip:
                continue
            (x0, y0), (x1, y1) = nails[i], nails[j]
            steps = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
            xs = np.clip(np.round(np.linspace(x0, x1, steps)).astype(np.int32), 0, WORK - 1)
            ys = np.clip(np.round(np.linspace(y0, y1, steps)).astype(np.int32), 0, WORK - 1)
            line = ys * WORK + xs
            idx.append(line)
            offs.append(pos)
            lens.append(len(line))
            js.append(j)
            pos += len(line)
        per_nail.append((np.concatenate(idx), np.array(offs), np.array(lens, np.float32), np.array(js)))
    resid = target.ravel().astype(np.float32).copy()
    seq, cur, last = [], 0, -1
    for _ in range(max_lines):
        cat, offs, lens, js = per_nail[cur]
        score = np.add.reduceat(resid[cat], offs) / lens
        score[js == last] = -1
        k = int(np.argmax(score))
        if score[k] < 0.005:
            break
        j = int(js[k])
        line = cat[offs[k]:offs[k] + int(lens[k])]
        resid[line] -= line_dark
        seq.append((cur, j))
        last, cur = cur, j
    return seq


def _walk_edges(edges, pts):
    """Kanten in eine Faden-Reihenfolge bringen: vom aktuellen Nagel immer zu einer noch nicht
    gespannten Kante; gibt es keine, zum naechsten Nagel mit offenen Kanten springen."""
    adj = {}
    for a, b in edges:
        adj.setdefault(a, set()).add(b)
        adj.setdefault(b, set()).add(a)
    remaining = {tuple(sorted(e)) for e in edges}
    cur = min(adj, key=lambda i: (pts[i][1], pts[i][0]))
    seq = []
    while remaining:
        nxt = [b for b in adj.get(cur, ()) if tuple(sorted((cur, b))) in remaining]
        if not nxt:
            open_nodes = {a for e in remaining for a in e}
            cx, cy = pts[cur]
            cur = min(open_nodes, key=lambda i: (pts[i][0] - cx) ** 2 + (pts[i][1] - cy) ** 2)
            continue
        b = min(nxt, key=lambda j: pts[j][1])
        remaining.discard(tuple(sorted((cur, b))))
        seq.append((cur, b))
        cur = b
    return seq


def style_lowpoly(path, n_points=260, keep=0.55):
    """Geometrisches Linienbild: Punkte auf den Kanten des Motivs, Delaunay-Dreiecksnetz; behalten
    werden nur Netzkanten, die einer Bildkante folgen."""
    import cv2
    from scipy.spatial import Delaunay

    size = 600
    img = _square(Image.open(path).convert("L"), (0.5, 0.5), 1.0, size=size)
    g = cv2.GaussianBlur(np.asarray(img, np.uint8), (5, 5), 0)
    edges = cv2.Canny(g, 60, 150)
    edges_d = cv2.dilate(edges, np.ones((5, 5), np.uint8))
    rng = np.random.default_rng(4)
    ys, xs = np.nonzero(edges)
    pts = []
    min_d2 = (size * 0.03) ** 2
    for k in rng.permutation(len(xs)):
        p = (float(xs[k]), float(ys[k]))
        if all((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 >= min_d2 for q in pts):
            pts.append(p)
            if len(pts) >= n_points:
                break
    pts = np.array(pts)
    tri = Delaunay(pts)
    cand = set()
    for s in tri.simplices:
        for a, b in ((s[0], s[1]), (s[1], s[2]), (s[0], s[2])):
            cand.add((min(a, b), max(a, b)))
    kept = []
    max_len = size * 0.22
    for a, b in cand:
        (x0, y0), (x1, y1) = pts[a], pts[b]
        if math.hypot(x1 - x0, y1 - y0) > max_len:
            continue
        t = np.linspace(0, 1, 24)
        xs_ = np.clip((x0 + (x1 - x0) * t).astype(int), 0, size - 1)
        ys_ = np.clip((y0 + (y1 - y0) * t).astype(int), 0, size - 1)
        if (edges_d[ys_, xs_] > 0).mean() >= keep:
            kept.append((int(a), int(b)))
    used = sorted({i for e in kept for i in e})
    remap = {old: new for new, old in enumerate(used)}
    kept = [(remap[a], remap[b]) for a, b in kept]
    nails = [(ART_X + x / size * ART, ART_Y + y / size * ART) for x, y in pts[used]]
    seq = _walk_edges(kept, nails)
    order = sorted(range(len(nails)), key=lambda i: (nails[i][1] // 60, nails[i][0]))
    return {"nails": nails, "order": order, "segs": [(a, b, 0) for a, b in seq],
            "colors": [None], "alpha": 0.85, "width": 1.6}


def style_fill(path, n_chords=1400, spacing=15):
    """Silhouette fuellen: Naegel am Umriss, Faden kreuz und quer innen, Farbe aus dem Motiv."""
    import cv2

    size = 600
    rgb = np.asarray(_square(Image.open(path).convert("RGB"), (0.5, 0.5), 1.0, size=size), np.float32)
    bg = np.median(np.concatenate([rgb[:8].reshape(-1, 3), rgb[-8:].reshape(-1, 3)]), axis=0)
    mask = (np.abs(rgb - bg).sum(-1) > 90).astype(np.uint8) * 255
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))  # Schnurrhaare o.ae. weg
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    cnt = max(cnts, key=cv2.contourArea)[:, 0, :].astype(np.float32)
    color = tuple(int(c) for c in np.median(rgb[mask > 0], axis=0))
    d = np.sqrt(((np.roll(cnt, -1, 0) - cnt) ** 2).sum(1))
    cum = np.concatenate([[0], np.cumsum(d)])
    n = max(24, int(cum[-1] / spacing))
    pos = np.linspace(0, cum[-1], n, endpoint=False)
    pts = np.stack([np.interp(pos, cum, np.concatenate([cnt[:, 0], cnt[:1, 0]])),
                    np.interp(pos, cum, np.concatenate([cnt[:, 1], cnt[:1, 1]]))], 1)
    inside = cv2.dilate(mask, np.ones((5, 5), np.uint8)) > 0

    def ok(a, b):
        (x0, y0), (x1, y1) = pts[a], pts[b]
        t = np.linspace(0.04, 0.96, 40)
        xs = np.clip((x0 + (x1 - x0) * t).astype(int), 0, size - 1)
        ys = np.clip((y0 + (y1 - y0) * t).astype(int), 0, size - 1)
        return inside[ys, xs].mean() > 0.97

    rng = np.random.default_rng(8)
    valid = {i: [j for j in range(n) if 3 < abs(i - j) < n - 3 and ok(i, j)] for i in range(n)}
    seq, cur, used = [], 0, {}
    for _ in range(n_chords):
        opts = valid[cur]
        if not opts:
            cur = int(rng.integers(n))
            continue
        w = np.array([1.0 / (1 + used.get((min(cur, j), max(cur, j)), 0) * 3) for j in opts])
        j = int(rng.choice(opts, p=w / w.sum()))
        key = (min(cur, j), max(cur, j))
        used[key] = used.get(key, 0) + 1
        seq.append((cur, j, 0))
        cur = j
    seq += [(i, (i + 1) % n, 0) for i in range(n)]  # zum Schluss einmal rundherum
    nails = [(ART_X + x / size * ART, ART_Y + y / size * ART) for x, y in pts]
    return {"nails": nails, "order": list(range(n)), "segs": seq, "colors": [color],
            "alpha": 0.55, "width": 1.3}


PATTERNS = {
    # ("mul", k, Farbe): Faden von Nagel i zu Nagel (k*i mod n)  -> Kardioide, Nephroide ...
    # ("step", d, Farbe): Faden von Nagel i zu Nagel (i+d)        -> Sternpolygon / Ring
    "cardioid": [("mul", 2, (235, 70, 60))],
    "nephroid": [("mul", 3, (40, 120, 220))],
    "mandala": [("step", 90, (245, 240, 230)), ("step", 70, (235, 180, 60)),
                ("step", 50, (225, 85, 70)), ("step", 30, (80, 170, 230))],
    "sunset": [("mul", 2, (250, 200, 70)), ("mul", 2, (235, 90, 60))],
}


def style_pattern(name="mandala", n=200):
    ang = np.linspace(-math.pi / 2, 1.5 * math.pi, n, endpoint=False)
    rad = ART / 2 * 0.96
    nails = [(ART_X + ART / 2 + rad * math.cos(a), ART_Y + ART / 2 + rad * math.sin(a)) for a in ang]
    layers = PATTERNS[name]
    segs = []
    for c, (kind, k, _) in enumerate(layers):
        if kind == "mul":
            off = c * n // (2 * len(layers))  # weitere Lagen leicht gedreht
            segs += [((i + off) % n, (k * i + off) % n, c) for i in range(n) if (k * i) % n != i]
        else:
            segs += [(i, (i + k) % n, c) for i in range(n)]
    return {"nails": nails, "order": list(range(n)), "segs": segs,
            "colors": [col for _, _, col in layers], "alpha": 0.75, "width": 1.3}


# =========================================================================== Zeichnen


def load_board(name):
    path = name if os.path.exists(name) else os.path.join(BOARDS, f"{name}.jpg")
    img = Image.open(path).convert("RGB")
    s = max(W / img.width, H / img.height)
    img = img.resize((math.ceil(img.width * s), math.ceil(img.height * s)), Image.LANCZOS)
    x, y = (img.width - W) // 2, (img.height - H) // 2
    img = img.crop((x, y, x + W, y + H))
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    r = np.sqrt(((xx - W / 2) / W) ** 2 + ((yy - H / 2) / H) ** 2)
    light = (1.04 - 0.10 * xx / W - 0.06 * yy / H) * (1 - 0.35 * r ** 2)  # Licht oben links + Vignette
    return Image.fromarray((np.asarray(img, np.float32) * light[..., None]).clip(0, 255).astype(np.uint8))


def nail_sprite(r=3.3):
    """Nagelkopf in Draufsicht + Schatten des Schafts (Licht von oben links): ein kurzer, weicher,
    nach aussen auslaufender Schatten nach rechts unten - das macht den Nagel raeumlich."""
    s = 6
    size = int((r * 2 + 20) * s)
    c = size // 2 - int(4 * s)
    sh = np.zeros((size, size), np.float32)
    steps = 40
    for k in range(steps):  # Schatten: vom Kopf weg duenner und heller
        t = k / (steps - 1)
        x, y = c + 6.5 * s * t, c + 8.0 * s * t
        rr = (r * (1 - 0.55 * t)) * s
        yy, xx = np.ogrid[:size, :size]
        sh = np.maximum(sh, ((xx - x) ** 2 + (yy - y) ** 2 <= rr ** 2) * (0.55 * (1 - 0.6 * t)))
    sh_img = Image.fromarray((sh * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.6 * s))
    spr = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    spr.putalpha(sh_img)
    head = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    hd = ImageDraw.Draw(head)
    R = r * s
    for k in range(int(R), 0, -1):  # gewoelbter Metallkopf, Glanzpunkt oben links
        t = k / R
        g = int(205 - 105 * t ** 1.3)
        off = (1 - t) * -0.4 * R
        hd.ellipse((c - k + off, c - k + off, c + k + off, c + k + off), fill=(g, g, g - 3, 255))
    m = Image.new("L", (size, size), 0)
    ImageDraw.Draw(m).ellipse((c - R, c - R, c + R, c + R), fill=255)
    m = m.filter(ImageFilter.GaussianBlur(0.4 * s))
    spr.paste(head, (0, 0), m)
    return spr.resize((size // s, size // s), Image.LANCZOS), (c // s, c // s)


class ThreadCanvas:
    """Faeden decken wie echte Faeden uebereinander ab ("over"-Mischung je Farbe), darunter ein
    weicher Schatten. Gerechnet im Supersampling, ausgegeben in ART x ART."""

    def __init__(self, colors, alpha, width, default_rgb):
        n = ART * SS
        self.C = np.zeros((n, n, 3), np.float32)  # vormultiplizierte Farbe
        self.A = np.zeros((n, n), np.float32)
        self.S = np.zeros((n, n), np.float32)  # Schatten
        self.colors = [np.array(c if c else default_rgb, np.float32) for c in colors]
        self.alpha, self.width = alpha, max(1, round(width * SS))

    def add(self, segs):
        if not segs:
            return
        n = ART * SS
        by_color = {}
        for p0, p1, c in segs:
            by_color.setdefault(c, []).append((p0, p1))
        ms = Image.new("L", (n, n), 0)
        ds = ImageDraw.Draw(ms)
        for c, lines in by_color.items():
            m = Image.new("L", (n, n), 0)
            d = ImageDraw.Draw(m)
            for p0, p1 in lines:
                d.line((p0, p1), fill=255, width=self.width)
                ds.line((p0[0] + 6, p0[1] + 8, p1[0] + 6, p1[1] + 8), fill=255, width=self.width * 2 + 1)
            a = self.alpha * np.asarray(m, np.float32) / 255.0
            self.C = self.C * (1 - a[..., None]) + self.colors[c][None, None, :] * a[..., None]
            self.A = self.A * (1 - a) + a
        self.S = 1 - (1 - self.S) * (1 - 0.10 * np.asarray(ms, np.float32) / 255.0)

    def layer(self, extra=None):
        C, A = self.C, self.A
        if extra is not None:
            (p0, p1), c = extra
            m = Image.new("L", A.shape[::-1], 0)
            ImageDraw.Draw(m).line((p0, p1), fill=255, width=self.width + 1)
            a = 0.95 * np.asarray(m, np.float32) / 255.0
            C = C * (1 - a[..., None]) + self.colors[c][None, None, :] * a[..., None]
            A = A * (1 - a) + a
        sh = self.S * (1 - A)  # Schatten nur, wo kein Faden liegt
        a_tot = A + sh
        rgb = C / np.maximum(a_tot, 1e-6)[..., None]  # Schatten = schwarz
        out = np.dstack([rgb.clip(0, 255), (a_tot * 255).clip(0, 255)]).astype(np.uint8)
        return Image.fromarray(out, "RGBA").resize((ART, ART), Image.LANCZOS)


def ease_in(t, p=2.2):
    return t ** p


def render(spec, board_name, out, name, seconds_nails=5.5, seconds_thread=18.0, seconds_hold=5.0,
           thread_rgb=(24, 22, 22)):
    os.makedirs(out, exist_ok=True)
    t0 = time.time()
    board = load_board(board_name).convert("RGBA")
    sprite, (scx, scy) = nail_sprite()
    nails, order, segs = spec["nails"], spec["order"], spec["segs"]
    canvas = ThreadCanvas(spec["colors"], spec["alpha"], spec["width"], thread_rgb)

    def to_art(i):
        x, y = nails[i]
        return ((x - ART_X) * SS, (y - ART_Y) * SS)

    video = os.path.join(out, f"{name}.mp4")
    ff = subprocess.Popen(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
         "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "19",
         "-movflags", "+faststart", video],
        stdin=subprocess.PIPE,
    )
    shake_left = [0]

    def emit(img):
        if shake_left[0] > 0:  # Hammerschlag: Bild ruckt kurz um 1-2 px
            shake_left[0] -= 1
            dy = 2 if shake_left[0] % 2 else -1
            img = img.transform(img.size, Image.AFFINE, (1, 0, 0, 0, 1, dy), resample=Image.BILINEAR)
        ff.stdin.write(img.convert("RGB").tobytes())

    # 1) Naegel: stecken schlagartig im Brett; anfangs einzeln (mit Ruck), dann schneller
    nail_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    n_frames = int(seconds_nails * FPS)
    shown = 0
    for f in range(n_frames):
        upto = max(1, int(len(order) * ease_in((f + 1) / n_frames, 1.8)))
        for i in order[shown:upto]:
            x, y = nails[i]
            nail_layer.alpha_composite(sprite, (int(round(x - scx)), int(round(y - scy))))
        if 0 < upto - shown <= 2:
            shake_left[0] = 2
        shown = upto
        frame = board.copy()
        frame.alpha_composite(nail_layer)
        emit(frame)

    def compose(extra=None):
        frame = board.copy()
        frame.alpha_composite(canvas.layer(extra), (ART_X, ART_Y))
        frame.alpha_composite(nail_layer)
        return frame

    # 2) Faden: erste Faeden sichtbar gespannt, dann immer schneller
    intro = min(12, len(segs))
    for a, b, c in segs[:intro]:
        p0, p1 = to_art(a), to_art(b)
        for g in range(1, 6):
            t = g / 5
            emit(compose(((p0, (p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t)), c)))
        canvas.add([(p0, p1, c)])
    rest = segs[intro:]
    n_frames = int((seconds_thread - intro * 5 / FPS) * FPS)
    done = 0
    frame = compose()
    for f in range(n_frames):
        upto = int(len(rest) * ease_in((f + 1) / n_frames))
        canvas.add([(to_art(a), to_art(b), c) for a, b, c in rest[done:upto]])
        done = upto
        frame = compose()
        emit(frame)
    final = frame

    # 3) Fertiges Bild halten, langsam heranzoomen
    n_frames = int(seconds_hold * FPS)
    cx, cy = ART_X + ART / 2, ART_Y + ART / 2
    for f in range(n_frames):
        s = 1 + 0.10 * (f / max(1, n_frames - 1)) ** 0.8
        big = final.resize((int(W * s), int(H * s)), Image.LANCZOS)
        x = max(0, min(big.width - W, int(cx * s - W / 2)))
        y = max(0, min(big.height - H, int(cy * s - H / 2)))
        emit(big.crop((x, y, x + W, y + H)))
    ff.stdin.close()
    ff.wait()
    final.convert("RGB").save(os.path.join(out, f"{name}.jpg"), quality=92)
    info = {"name": name, "board": board_name, "nails": len(nails), "threads": len(segs),
            "seconds": seconds_nails + seconds_thread + seconds_hold}
    with open(os.path.join(out, f"{name}.json"), "w") as f:
        json.dump(info, f, indent=1)
    print(f"{name}: {len(nails)} Naegel, {len(segs)} Faeden, {time.time() - t0:.0f} s -> {video}", flush=True)
    return video


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--style", choices=["circle", "lowpoly", "fill", "pattern"], required=True)
    ap.add_argument("--image")
    ap.add_argument("--pattern", default="mandala", choices=sorted(PATTERNS))
    ap.add_argument("--board", default="birch_plywood")
    ap.add_argument("--invert", action="store_true", help="heller Faden auf dunklem Brett")
    ap.add_argument("--thread", default=None, help="Fadenfarbe r,g,b (Standard: dunkel bzw. hell bei --invert)")
    ap.add_argument("--out", default="experiments/string_art")
    ap.add_argument("--name", default=None)
    args = ap.parse_args()

    if args.style == "circle":
        spec = style_circle(args.image, invert=args.invert)
    elif args.style == "lowpoly":
        spec = style_lowpoly(args.image)
    elif args.style == "fill":
        spec = style_fill(args.image)
    else:
        spec = style_pattern(args.pattern)
    thread = (tuple(int(v) for v in args.thread.split(",")) if args.thread
              else (240, 236, 228) if args.invert else (24, 22, 22))
    base = os.path.splitext(os.path.basename(args.image))[0] if args.image else args.pattern
    render(spec, args.board, args.out, args.name or f"{args.style}_{base}", thread_rgb=thread)


if __name__ == "__main__":
    main()

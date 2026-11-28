"""Fadenbild-Videos ("String Art": Naegel + Faden), komplett per Code animiert.

Szene (Draufsicht): Ein Holztisch ist der Hintergrund. Zuerst sieht man nur den Tisch, dann wird
eine helle Arbeitsplatte (weiss lackiert oder naturfarben, rund oder quadratisch) hingelegt. Danach
stecken die Naegel schlagartig in der Platte (bei den ersten Schlaegen ruckt das Bild kurz) und der
Faden wird gespannt - anfangs einzeln, dann immer schneller. Am Ende langsamer Zoom aufs Ergebnis.

Stile:
  portrait  Naegel am Rand (Kreis oder Quadrat), Tausende Sehnen; ein Greedy-Algorithmus waehlt
            immer die Sehne, die das Motiv am meisten verbessert. Braucht kontrastreiche Vorlagen
            (dramatisches Licht, heller Hintergrund).
  pattern   Mathematische Muster ohne Vorlage (Kreis: Mandala, Kardioide ...; Quadrat: Kurvensterne).
  figure    3D-Figuren / optische Taeuschungen (string_figures.py): Wuerfel, unmoegliches Dreieck,
            Spiral-Tunnel.

Nutzung:
  python scripts/string_art.py --style portrait --shape circle \
      --image assets/string_art/motifs/old_man_beard.png
  python scripts/string_art.py --style portrait --image ... --shape square --panel panel_natural
  python scripts/string_art.py --style pattern --pattern mandala --shape circle
  python scripts/string_art.py --style pattern --pattern curves --shape square
  python scripts/string_art.py --style figure --figure penrose     (cube, penrose, tunnel)
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
ART = 900  # Kantenlaenge des Faden-Bereichs (Quadrat)
ART_X, ART_Y = (W - ART) // 2, 440
MARGIN = 48  # Rand der Arbeitsplatte um den Faden-Bereich
SS = 2  # Supersampling der Fadenebene
WORK = 560  # Arbeitsaufloesung fuer den Algorithmus


# =========================================================================== Naegel-Rahmen


def frame_nails(shape, n):
    """Naegel in Arbeitskoordinaten (0..WORK) + Seiten-Nummer je Nagel (Quadrat; Kreis: -1)."""
    if shape == "circle":
        ang = np.linspace(-math.pi / 2, 1.5 * math.pi, n, endpoint=False)
        rad = WORK / 2 * 0.985
        pts = np.stack([WORK / 2 + rad * np.cos(ang), WORK / 2 + rad * np.sin(ang)], 1)
        return pts, np.full(n, -1)
    per = n // 4
    lo, hi = WORK * 0.01, WORK * 0.99
    t = np.linspace(lo, hi, per, endpoint=False)
    sides = [np.stack([t, np.full(per, lo)], 1),               # oben, links -> rechts
             np.stack([np.full(per, hi), t], 1),               # rechts, oben -> unten
             np.stack([hi - (t - lo), np.full(per, hi)], 1),   # unten, rechts -> links
             np.stack([np.full(per, lo), hi - (t - lo)], 1)]   # links, unten -> oben
    return np.concatenate(sides), np.repeat(np.arange(4), per)


def to_screen(pts):
    return [(ART_X + x / WORK * ART, ART_Y + y / WORK * ART) for x, y in pts]


# =========================================================================== Stile


def _square_crop(img, center=(0.5, 0.45), scale=0.92, size=None):
    size = size or WORK
    side = int(min(img.size) * scale)
    cx, cy = int(img.width * center[0]), int(img.height * center[1])
    x0 = max(0, min(img.width - side, cx - side // 2))
    y0 = max(0, min(img.height - side, cy - side // 2))
    return img.crop((x0, y0, x0 + side, y0 + side)).resize((size, size), Image.LANCZOS)


PORTRAIT_PRESETS = {
    # pre: Bildvorbereitung, lo/gain/gamma/edge: Zielbild, dark: Dunkel pro Faden im Algorithmus,
    # alpha/width: Darstellung des Fadens
    "bold":   dict(pre="equalize", lo=0.24, gain=1.4, gamma=1.3, edge=0.6, dark=0.13, alpha=0.45,
                   width=1.0, nails=280, lines=4500),
    "detail": dict(pre="equalize", lo=0.20, gain=1.35, gamma=1.2, edge=0.7, dark=0.085, alpha=0.30,
                   width=1.0, nails=320, lines=6000),
    "sharp":  dict(pre="sharpen", lo=0.20, gain=1.4, gamma=1.2, edge=0.9, dark=0.085, alpha=0.30,
                   width=1.0, nails=320, lines=6000),
    "ultra":  dict(pre="sharpen", lo=0.16, gain=1.25, gamma=1.1, edge=0.5, dark=0.05, alpha=0.20,
                   width=0.5, nails=360, lines=11000, calibrate=True),
    "fine":   dict(pre="sharpen", lo=0.20, gain=1.4, gamma=1.2, edge=0.8, dark=0.07, alpha=0.24,
                   width=0.5, nails=340, lines=8000, calibrate=True),
    "dense":  dict(pre="sharpen", lo=0.18, gain=1.35, gamma=1.15, edge=0.8, dark=0.06, alpha=0.24,
                   width=1.0, nails=360, lines=8000),
}


def portrait_target(path, shape="circle", center=(0.5, 0.45), scale=0.92, invert=False, preset="detail"):
    cfg = PORTRAIT_PRESETS[preset]
    img = _square_crop(Image.open(path).convert("L"), center, scale)
    if cfg["pre"] == "sharpen":
        img = img.filter(ImageFilter.UnsharpMask(radius=3, percent=160, threshold=2))
    img = ImageOps.equalize(ImageOps.autocontrast(img, cutoff=1))
    val = np.asarray(img, np.float32) / 255.0
    dark = val if invert else 1.0 - val
    edges = np.asarray(img.filter(ImageFilter.FIND_EDGES).filter(ImageFilter.GaussianBlur(1)),
                       np.float32) / 255.0
    t = np.clip((dark - cfg["lo"]) * cfg["gain"], 0, 1) ** cfg["gamma"] + cfg["edge"] * edges
    return np.clip(t, 0, 1) * shape_mask(shape)


def shape_mask(shape):
    yy, xx = np.mgrid[0:WORK, 0:WORK].astype(np.float32)
    if shape == "circle":
        return (np.sqrt((xx - WORK / 2) ** 2 + (yy - WORK / 2) ** 2) / (WORK / 2) < 0.97).astype(np.float32)
    lo, hi = WORK * 0.02, WORK * 0.98
    return ((xx > lo) & (xx < hi) & (yy > lo) & (yy < hi)).astype(np.float32)


def style_portrait(path, shape="circle", invert=False, center=(0.5, 0.45), scale=0.92, preset="ultra",
                   bg_penalty=0.0, weight=None):
    cfg = PORTRAIT_PRESETS[preset]
    target = portrait_target(path, shape, center, scale, invert, preset)
    if weight is not None:  # Gewichtung (Gesicht wichtiger, Kleidung unwichtiger), Groesse wie Bild
        w = Image.fromarray((np.clip(weight, 0, 2) * 127).astype(np.uint8))
        w = np.asarray(_square_crop(w, center, scale), np.float32) / 127.0
        target = np.clip(target * w, 0, 1)
    if bg_penalty:
        # Freigestellter (rein weisser) Hintergrund: Faeden dorthin lohnen sich nicht -> weniger Schleier
        src = np.asarray(_square_crop(Image.open(path).convert("L"), center, scale), np.float32)
        white = Image.fromarray((src > 245).astype(np.uint8) * 255).filter(ImageFilter.MinFilter(9))
        white = np.asarray(white)
        target = np.where(white > 0, -bg_penalty, target) * shape_mask(shape)
    n = cfg["nails"] if shape == "circle" else (cfg["nails"] // 4) * 4
    pts, side = frame_nails(shape, n)
    seq = _solve(target, pts, side, max_lines=cfg["lines"], line_dark=cfg["dark"])
    # Darstellung passend zur Rechnung: ein Faden deckt ein Arbeitspixel zu Anteil (Fadenbreite /
    # Pixelbreite) ab - so dunkel, wie der Algorithmus es angenommen hat.
    width = cfg.get("width", 0.5)
    cover = max(1, round(width * SS)) / (ART * SS / WORK)
    alpha = min(0.9, cfg["dark"] / cover) if cfg.get("calibrate") else cfg["alpha"]
    return {"nails": to_screen(pts), "order": list(range(n)), "segs": [(a, b, 0) for a, b in seq],
            "colors": [None], "alpha": alpha, "width": width}


def _solve(target, nails, side, max_lines=6500, min_skip=18, line_dark=0.13):
    """Greedy-Fadenalgorithmus: vom aktuellen Nagel immer zur Sehne mit dem groessten mittleren
    Rest-Dunkel; die Linie wird danach vom Rest abgezogen. Beim Quadrat keine Sehnen entlang
    derselben Seite (die laegen auf dem Rand)."""
    n = len(nails)
    per_nail = []
    for i in range(n):
        idx, offs, lens, js = [], [], [], []
        pos = 0
        for j in range(n):
            if min((i - j) % n, (j - i) % n) < min_skip:
                continue
            if side[i] >= 0 and side[i] == side[j]:
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


PATTERNS = {
    # Kreis.  ("mul", k): Nagel i -> k*i (Kardioide usw.);  ("step", d): Nagel i -> i+d (Ringe)
    "cardioid": ("circle", [("mul", 2, (200, 40, 40))]),
    "nephroid": ("circle", [("mul", 3, (30, 80, 170))]),
    "mandala": ("circle", [("step", 90, (40, 40, 45)), ("step", 70, (215, 150, 30)),
                           ("step", 50, (200, 55, 45)), ("step", 30, (40, 120, 190))]),
    "sunset": ("circle", [("mul", 2, (230, 160, 40)), ("mul", 2, (200, 60, 50))]),
    # Quadrat.  ("corner", c): an Ecke c Nagel i der einen Seite -> Nagel (per-i) der Nachbarseite
    #           (klassische "Fadenkurven"); ("step", d): Nagel i -> i+d
    "curves": ("square", [("corner", 0, (200, 55, 45)), ("corner", 1, (40, 120, 190)),
                          ("corner", 2, (215, 150, 30)), ("corner", 3, (40, 150, 90))]),
    "star": ("square", [("step", 150, (40, 40, 45)), ("step", 110, (200, 55, 45)),
                        ("step", 75, (40, 120, 190))]),
}


def style_pattern(name="mandala"):
    shape, layers = PATTERNS[name]
    n = 200 if shape == "circle" else 240
    pts, _ = frame_nails(shape, n)
    per = n // 4
    segs = []
    for c, (kind, k, _) in enumerate(layers):
        if kind == "mul":
            off = c * n // (2 * len(layers))
            segs += [((i + off) % n, (k * i + off) % n, c) for i in range(n) if (k * i) % n != i]
        elif kind == "step":
            segs += [(i, (i + k) % n, c) for i in range(n)]
        else:  # corner: Seite k und k+1 treffen sich an einer Ecke
            a0, b0 = k * per, ((k + 1) % 4) * per
            segs += [(a0 + i, b0 + i, c) for i in range(per)]
    return {"nails": to_screen(pts), "order": list(range(n)), "segs": segs, "shape": shape,
            "colors": [col for _, _, col in layers], "alpha": 0.75, "width": 1.3}


# =========================================================================== Szene


def _cover(img, w, h):
    s = max(w / img.width, h / img.height)
    img = img.resize((math.ceil(img.width * s), math.ceil(img.height * s)), Image.LANCZOS)
    x, y = (img.width - w) // 2, (img.height - h) // 2
    return img.crop((x, y, x + w, y + h))


def load_table(name):
    path = name if os.path.exists(name) else os.path.join(BOARDS, f"{name}.jpg")
    img = _cover(Image.open(path).convert("RGB"), W, H)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    r = np.sqrt(((xx - W / 2) / W) ** 2 + ((yy - H / 2) / H) ** 2)
    light = (1.04 - 0.10 * xx / W - 0.06 * yy / H) * (1 - 0.45 * r ** 2)  # Licht oben links + Vignette
    return Image.fromarray((np.asarray(img, np.float32) * light[..., None]).clip(0, 255).astype(np.uint8))


def make_panel(name, shape):
    """Arbeitsplatte als RGBA-Sprite (Groesse ART + 2*MARGIN) mit leicht dunklerer Kante."""
    size = ART + 2 * MARGIN
    path = name if os.path.exists(name) else os.path.join(BOARDS, f"{name}.jpg")
    tex = np.asarray(_cover(Image.open(path).convert("RGB"), size, size), np.float32)
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    tex = tex * (1.03 - 0.06 * (xx + yy) / (2 * size))[..., None]
    mask = Image.new("L", (size * 4, size * 4), 0)
    d = ImageDraw.Draw(mask)
    if shape == "circle":
        d.ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
    else:
        d.rounded_rectangle((0, 0, size * 4 - 1, size * 4 - 1), radius=24, fill=255)
    mask = mask.resize((size, size), Image.LANCZOS)
    # Kante: aussen 3 px etwas dunkler (Plattenrand), Licht kommt von oben links
    m = np.asarray(mask, np.float32) / 255.0
    inner = np.asarray(mask.filter(ImageFilter.MinFilter(7)), np.float32) / 255.0
    rim = np.clip(m - inner, 0, 1)
    shade = 1 - rim * (0.10 + 0.12 * (xx + yy) / (2 * size))
    tex = tex * shade[..., None]
    return Image.fromarray(np.dstack([tex.clip(0, 255), m * 255]).astype(np.uint8), "RGBA")


def panel_shadow(panel, lift):
    """Weicher Schlagschatten; je hoeher die Platte (lift 0..1), desto weiter und weicher."""
    a = panel.getchannel("A")
    pad = 80
    sh = Image.new("L", (a.width + 2 * pad, a.height + 2 * pad), 0)
    sh.paste(a, (pad, pad))
    sh = sh.filter(ImageFilter.GaussianBlur(10 + 22 * lift))
    sh = sh.point(lambda v: int(v * (0.55 - 0.25 * lift)))
    out = Image.new("RGBA", sh.size, (12, 8, 5, 0))
    out.putalpha(sh)
    return out, (pad - int(8 + 26 * lift), pad - int(12 + 34 * lift))


def scene(table, panel, lift=0.0, alpha=1.0):
    """Tisch + Platte; lift > 0 = Platte schwebt noch (groesser, Schatten weiter weg)."""
    frame = table.copy().convert("RGBA")
    s = 1 + 0.05 * lift
    p = panel.resize((int(panel.width * s), int(panel.height * s)), Image.LANCZOS) if lift else panel
    if alpha < 1:
        p = p.copy()
        p.putalpha(p.getchannel("A").point(lambda v: int(v * alpha)))
    cx, cy = ART_X + ART / 2, ART_Y + ART / 2 - 60 * lift
    sh, (ox, oy) = panel_shadow(p, lift)
    if alpha < 1:
        sh.putalpha(sh.getchannel("A").point(lambda v: int(v * alpha)))
    frame.alpha_composite(sh, (int(cx - p.width / 2 - ox), int(cy - p.height / 2 - oy)))
    frame.alpha_composite(p, (int(cx - p.width / 2), int(cy - p.height / 2)))
    return frame


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

    def _count(self, lines, width, off=(0.0, 0.0)):
        """Wie oft jedes Pixel von den Linien getroffen wird (Kreuzungen zaehlen mehrfach)."""
        n = ART * SS
        cnt = np.zeros(n * n, np.float32)
        idx_all = []
        for p0, p1 in lines:
            x0, y0 = p0[0] + off[0], p0[1] + off[1]
            x1, y1 = p1[0] + off[0], p1[1] + off[1]
            length = math.hypot(x1 - x0, y1 - y0)
            k = max(2, int(length * 1.5))
            t = np.linspace(0, 1, k, dtype=np.float32)
            xs, ys = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            nx, ny = (-(y1 - y0) / max(length, 1e-6), (x1 - x0) / max(length, 1e-6))
            pix = []
            for w in np.arange(width) - (width - 1) / 2:
                xi = np.clip(np.round(xs + nx * w).astype(np.int32), 0, n - 1)
                yi = np.clip(np.round(ys + ny * w).astype(np.int32), 0, n - 1)
                pix.append(yi * n + xi)
            idx_all.append(np.unique(np.concatenate(pix)))  # je Linie jedes Pixel nur einmal
        if idx_all:
            np.add.at(cnt, np.concatenate(idx_all), 1)
        return cnt.reshape(n, n)

    def add(self, segs):
        if not segs:
            return
        by_color = {}
        for p0, p1, c in segs:
            by_color.setdefault(c, []).append((p0, p1))
        all_lines = []
        for c, lines in by_color.items():
            cnt = self._count(lines, self.width)
            a = 1 - (1 - self.alpha) ** cnt
            self.C = self.C * (1 - a[..., None]) + self.colors[c][None, None, :] * a[..., None]
            self.A = self.A * (1 - a) + a
            all_lines += lines
        cs = self._count(all_lines, self.width * 2 + 1, off=(6, 8))
        self.S = 1 - (1 - self.S) * (1 - 0.10) ** cs

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


def ease_out(t, p=3.0):
    return 1 - (1 - t) ** p


def render(spec, table_name, panel_name, shape, out, name, seconds_nails=5.5, seconds_thread=18.0,
           seconds_hold=5.0, thread_rgb=(22, 20, 20), audio=True):
    os.makedirs(out, exist_ok=True)
    t0 = time.time()
    table = load_table(table_name)
    panel = make_panel(panel_name, shape)
    sprite, (scx, scy) = nail_sprite()
    nails, order, segs = spec["nails"], spec["order"], spec["segs"]
    canvas = ThreadCanvas(spec["colors"], spec["alpha"], spec["width"], thread_rgb)

    def to_art(i):
        x, y = nails[i]
        return ((x - ART_X) * SS, (y - ART_Y) * SS)

    video = os.path.join(out, f"{name}.mp4")
    silent = os.path.join(out, f".{name}_silent.mp4") if audio else video
    ff = subprocess.Popen(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
         "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "19",
         "-movflags", "+faststart", silent],
        stdin=subprocess.PIPE,
    )
    shake_left = [0]
    frame_no = [0]
    events = []  # (Zeit in s, Art, Staerke) fuer die Tonspur

    def now():
        return frame_no[0] / FPS

    def emit(img):
        frame_no[0] += 1
        if shake_left[0] > 0:  # Hammerschlag: Bild ruckt kurz um 1-2 px
            shake_left[0] -= 1
            dy = 2 if shake_left[0] % 2 else -1
            img = img.transform(img.size, Image.AFFINE, (1, 0, 0, 0, 1, dy), resample=Image.BILINEAR)
        ff.stdin.write(img.convert("RGB").tobytes())

    # 0) nur der Tisch, dann wird die Arbeitsplatte hingelegt
    for _ in range(int(0.9 * FPS)):
        emit(table)
    n = int(0.8 * FPS)
    for f in range(n):
        t = ease_out((f + 1) / n)
        emit(scene(table, panel, lift=1 - t, alpha=min(1.0, 0.25 + 1.5 * t)))
    events.append((now(), "nail", 1.4))  # Platte setzt auf
    base = scene(table, panel)
    for _ in range(int(0.4 * FPS)):
        emit(base)

    # 1) Naegel: stecken schlagartig in der Platte; anfangs einzeln (mit Ruck), dann schneller
    nail_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    n_frames = int(seconds_nails * FPS)
    shown = 0
    for f in range(n_frames):
        upto = max(1, int(len(order) * ease_in((f + 1) / n_frames, 1.8)))
        for i in order[shown:upto]:
            x, y = nails[i]
            nail_layer.alpha_composite(sprite, (int(round(x - scx)), int(round(y - scy))))
        new = upto - shown
        if 0 < new <= 2:
            shake_left[0] = 2
            for k in range(new):
                events.append((now() + k * 0.5 / FPS, "nail", 1.0))
        elif new > 2:  # schnell: ein leiserer Schlag pro Bild
            events.append((now(), "nail", 0.45))
        shown = upto
        frame = base.copy()
        frame.alpha_composite(nail_layer)
        emit(frame)

    def compose(extra=None):
        frame = base.copy()
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
        events.append((now(), "pluck", 1.0))
    rest = segs[intro:]
    n_frames = int((seconds_thread - intro * 5 / FPS) * FPS)
    done = 0
    frame = compose()
    for f in range(n_frames):
        upto = int(len(rest) * ease_in((f + 1) / n_frames))
        canvas.add([(to_art(a), to_art(b), c) for a, b, c in rest[done:upto]])
        if upto > done and f % 2 == 0:
            events.append((now(), "fast", min(1.0, 0.15 + (upto - done) / 40)))
        done = upto
        frame = compose()
        emit(frame)
    final = frame

    # 3) Fertiges Bild halten, langsam heranzoomen
    events.append((now(), "reveal", 1.0))
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
    if audio:
        from string_audio import build_audio

        wav = os.path.join(out, f".{name}.wav")
        build_audio(events, now(), wav)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", silent, "-i", wav, "-c:v", "copy",
                        "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", video],
                       check=True)
        os.remove(silent)
        os.remove(wav)
    final.convert("RGB").save(os.path.join(out, f"{name}.jpg"), quality=92)
    info = {"name": name, "table": table_name, "panel": panel_name, "shape": shape,
            "nails": len(nails), "threads": len(segs), "seconds": round(now(), 1)}
    with open(os.path.join(out, f"{name}.json"), "w") as f:
        json.dump(info, f, indent=1)
    print(f"{name}: {len(nails)} Naegel, {len(segs)} Faeden, {time.time() - t0:.0f} s -> {video}", flush=True)
    return video


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--style", choices=["portrait", "pattern", "figure"], required=True)
    ap.add_argument("--figure", default="wormhole",
                    choices=["wormhole", "sphere", "vortex", "cube", "penrose", "tunnel"])
    ap.add_argument("--image")
    ap.add_argument("--shape", choices=["circle", "square"], default="circle")
    ap.add_argument("--pattern", default="mandala", choices=sorted(PATTERNS))
    ap.add_argument("--table", default="dark_walnut")
    ap.add_argument("--panel", default="panel_white")
    ap.add_argument("--out", default="experiments/string_art")
    ap.add_argument("--name", default=None)
    ap.add_argument("--preset", default="ultra", choices=sorted(PORTRAIT_PRESETS))
    ap.add_argument("--crop", default="0.5,0.45,0.92", help="Bildausschnitt: Mitte x,y und Groesse (Anteile)")
    args = ap.parse_args()
    cx, cy, sc = (float(v) for v in args.crop.split(","))

    if args.style == "portrait":
        spec = style_portrait(args.image, shape=args.shape, center=(cx, cy), scale=sc, preset=args.preset)
        shape = args.shape
    elif args.style == "figure":
        from string_figures import CIRCLE_FIGURES, style_figure

        if args.figure in ("wormhole", "sphere", "vortex"):  # im Nagelkreis
            spec = CIRCLE_FIGURES[args.figure]()
            shape = "circle"
        else:  # vorgenagelte Flaechen-Figuren (Quadrat)
            spec = style_figure(args.figure)
            shape = "square"
    else:
        spec = style_pattern(args.pattern)
        shape = spec["shape"]
    base = (os.path.splitext(os.path.basename(args.image))[0] if args.image
            else args.figure if args.style == "figure" else args.pattern)
    render(spec, args.table, args.panel, shape, args.out, args.name or f"{args.style}_{shape}_{base}")


if __name__ == "__main__":
    main()

"""Prototyp: Fadenbild-Video ("String Art", Naegel + Faden), komplett per Code animiert.

Ablauf im Video (Draufsicht auf ein Holzbrett):
  1. Naegel werden nach und nach eingeschlagen (dichter in dunklen Bildbereichen).
  2. Der Faden wird von Nagel zu Nagel gespannt - erst langsam einzeln, dann immer schneller.
     Welche Verbindung als naechstes kommt, berechnet ein Greedy-Algorithmus: immer die Linie
     zum Nachbarnagel, die das Zielbild am meisten verbessert.
  3. Das fertige Bild bleibt mit langsamem Zoom stehen.

Kein KI-Aufruf noetig: Vorlage ist ein beliebiges Bild (z.B. ein vorhandenes KI-Portraet),
Brett und Naegel werden prozedural gezeichnet.

Nutzung:
  python scripts/string_art.py --image assets/people_generated/xyz.jpg --out experiments/string_art
"""

import argparse
import json
import math
import os
import subprocess
import time

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps

W, H = 1080, 1920
FPS = 30
WORK = 420  # Arbeitsaufloesung fuer den Algorithmus (Quadrat)
ART = 900  # Kantenlaenge des Bildbereichs im Video
ART_X, ART_Y = (W - ART) // 2, 430
SS = 2  # Supersampling fuer die Fadenebene

THREAD_RGB = (22, 20, 20)
THREAD_ALPHA = 120
LINE_DARK = 0.16  # wie viel "Dunkelheit" eine Fadenlinie im Arbeitsbild beitraegt


# --------------------------------------------------------------------------- Vorlage


def load_target(path, center=(0.5, 0.42), scale=0.92):
    """Graustufen-Ziel (0 = hell/kein Faden, 1 = dunkel/viel Faden) mit weicher Ellipsen-Maske."""
    img = Image.open(path).convert("L")
    side = int(min(img.size) * scale)
    cx, cy = int(img.width * center[0]), int(img.height * center[1])
    x0 = max(0, min(img.width - side, cx - side // 2))
    y0 = max(0, min(img.height - side, cy - side // 2))
    img = img.crop((x0, y0, x0 + side, y0 + side)).resize((WORK, WORK), Image.LANCZOS)
    img = ImageOps.autocontrast(img, cutoff=1)
    img = ImageEnhance.Contrast(img).enhance(1.35)
    dark = 1.0 - np.asarray(img, dtype=np.float32) / 255.0
    yy, xx = np.mgrid[0:WORK, 0:WORK].astype(np.float32)
    r = np.sqrt(((xx - WORK / 2) / (WORK * 0.40)) ** 2 + ((yy - WORK / 2) / (WORK * 0.47)) ** 2)
    mask = np.clip((1.12 - r) / 0.18, 0, 1)
    return np.clip(dark ** 1.15 * mask, 0, 1)


# --------------------------------------------------------------------------- Naegel + Faden


def place_nails(target, n=520, seed=3):
    """Naegel mit Mindestabstand, Dichte ~ Dunkelheit + Kanten (wie bei echten Portraet-Fadenbildern)."""
    rng = np.random.default_rng(seed)
    gy, gx = np.gradient(target)
    edge = np.sqrt(gx ** 2 + gy ** 2)
    weight = 0.08 + target ** 1.3 + 2.5 * edge / (edge.max() + 1e-6)
    weight[target < 0.02] *= 0.15
    p = (weight / weight.sum()).ravel()
    min_d = WORK * 0.022
    pts = []
    for idx in rng.choice(p.size, size=n * 25, p=p):
        y, x = divmod(int(idx), WORK)
        if all((x - a) ** 2 + (y - b) ** 2 >= min_d ** 2 for a, b in pts[-400:]):
            if not any((x - a) ** 2 + (y - b) ** 2 < min_d ** 2 for a, b in pts):
                pts.append((x, y))
                if len(pts) >= n:
                    break
    return np.array(pts, dtype=np.float32)


def neighbour_edges(nails, k=14):
    d = np.sqrt(((nails[:, None, :] - nails[None, :, :]) ** 2).sum(-1))
    np.fill_diagonal(d, np.inf)
    nb = np.argsort(d, axis=1)[:, :k]
    lines = {}
    for i in range(len(nails)):
        for j in nb[i]:
            a, b = (i, int(j)) if i < j else (int(j), i)
            if (a, b) in lines:
                continue
            (x0, y0), (x1, y1) = nails[a], nails[b]
            steps = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
            xs = np.clip(np.round(np.linspace(x0, x1, steps)).astype(int), 0, WORK - 1)
            ys = np.clip(np.round(np.linspace(y0, y1, steps)).astype(int), 0, WORK - 1)
            lines[(a, b)] = ys * WORK + xs
    adj = {i: [] for i in range(len(nails))}
    for a, b in lines:
        adj[a].append(b)
        adj[b].append(a)
    return lines, adj


def solve_threads(target, nails, max_lines=3200, seed=5):
    """Greedy: vom aktuellen Nagel zur Linie mit dem groessten Rest-Dunkel. Ist nichts Lohnendes
    mehr in der Naehe, springt der Faden zum Nagel mit dem meisten Rest-Dunkel."""
    rng = np.random.default_rng(seed)
    lines, adj = neighbour_edges(nails)
    resid = target.ravel().copy()
    used = {}
    seq = []
    cur = int(np.argmax([resid[int(y) * WORK + int(x)] for x, y in nails]))
    for _ in range(max_lines):
        best, best_s = None, 0.0
        for j in adj[cur]:
            key = (cur, j) if cur < j else (j, cur)
            s = resid[lines[key]].mean() - 0.06 * used.get(key, 0)
            if s > best_s:
                best, best_s = j, s
        if best is None or best_s < 0.05:
            # neu ansetzen: Nagel, dessen Nachbarlinien noch am meisten Dunkel brauchen
            cand = rng.choice(len(nails), size=min(120, len(nails)), replace=False)
            scores = [max((resid[lines[(c, j) if c < j else (j, c)]].mean() for j in adj[c]), default=0)
                      for c in cand]
            k = int(np.argmax(scores))
            if scores[k] < 0.05:
                break
            cur = int(cand[k])
            seq.append(None)  # Faden neu angesetzt
            continue
        key = (cur, best) if cur < best else (best, cur)
        resid[lines[key]] = np.maximum(resid[lines[key]] - LINE_DARK, -0.2)
        used[key] = used.get(key, 0) + 1
        seq.append((cur, best))
        cur = best
    return [s for s in seq if s is not None], resid.reshape(WORK, WORK)


# --------------------------------------------------------------------------- Kreis-Stil


def circle_target(path, center=(0.5, 0.40), scale=0.80):
    """Ziel fuer den Kreis-Stil: starker Kontrast + betonte Kanten, runde Maske."""
    img = Image.open(path).convert("L")
    side = int(min(img.size) * scale)
    cx, cy = int(img.width * center[0]), int(img.height * center[1])
    x0 = max(0, min(img.width - side, cx - side // 2))
    y0 = max(0, min(img.height - side, cy - side // 2))
    img = img.crop((x0, y0, x0 + side, y0 + side)).resize((WORK, WORK), Image.LANCZOS)
    img = ImageOps.equalize(ImageOps.autocontrast(img, cutoff=1))
    dark = 1.0 - np.asarray(img, dtype=np.float32) / 255.0
    edges = np.asarray(img.filter(ImageFilter.FIND_EDGES).filter(ImageFilter.GaussianBlur(1)),
                       dtype=np.float32) / 255.0
    t = np.clip((dark - 0.24) * 1.4, 0, 1) ** 1.3 + 0.6 * edges
    yy, xx = np.mgrid[0:WORK, 0:WORK].astype(np.float32)
    r = np.sqrt((xx - WORK / 2) ** 2 + (yy - WORK / 2) ** 2) / (WORK / 2)
    return np.clip(t, 0, 1) * (r < 0.97)


def circle_nails(n=260):
    ang = np.linspace(-math.pi / 2, 1.5 * math.pi, n, endpoint=False)
    rad = WORK / 2 * 0.985
    return np.stack([WORK / 2 + rad * np.cos(ang), WORK / 2 + rad * np.sin(ang)], 1).astype(np.float32)


def solve_circle(target, nails, max_lines=4500, min_skip=18, line_dark=0.13):
    """Klassischer Greedy-Fadenalgorithmus: vom aktuellen Nagel immer zur Sehne mit dem groessten
    mittleren Rest-Dunkel; die Linie wird danach vom Rest abgezogen."""
    n = len(nails)
    per_nail = []
    for i in range(n):
        idx, offs, lens, js = [], [], [], []
        pos = 0
        for j in range(n):
            d = min((i - j) % n, (j - i) % n)
            if d < min_skip:
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


# --------------------------------------------------------------------------- Zeichnen


def _fbm(h, w, rng, octaves=5, sx=1.0, sy=1.0):
    out = np.zeros((h, w), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        gh = max(2, int(h / (180 / 2 ** o) * sy))
        gw = max(2, int(w / (180 / 2 ** o) * sx))
        g = Image.fromarray((rng.random((gh, gw)) * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
        out += amp * (np.asarray(g, np.float32) / 255.0 - 0.5)
        tot += amp
        amp *= 0.55
    return out / tot


def wood_texture(w, h, base, seed, grain=0.10, stretch=9.0):
    """Holz: Maserlinien entlang x (gestreckte fbm), leicht verzerrt, plus feine Poren."""
    rng = np.random.default_rng(seed)
    warp = _fbm(h, w, rng, sx=0.15, sy=1.0)
    yy = np.arange(h, dtype=np.float32)[:, None] / h
    rings = np.sin((yy * stretch * 6.28) + warp * 9.0)
    rings = np.sign(rings) * np.abs(rings) ** 0.6
    pores = _fbm(h, w, rng, octaves=3, sx=0.05, sy=4.0)
    shade = 1 + grain * rings + 0.10 * pores + 0.05 * _fbm(h, w, rng, octaves=2)
    arr = np.array(base, dtype=np.float32)[None, None, :] * shade[..., None]
    return Image.fromarray(arr.clip(0, 255).astype(np.uint8))


def make_board():
    table = wood_texture(W, H, (92, 62, 40), seed=1, grain=0.16, stretch=14)
    bx0, by0, bx1, by1 = ART_X - 50, ART_Y - 60, ART_X + ART + 50, ART_Y + ART + 60
    shadow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(shadow).rectangle((bx0 + 10, by0 + 16, bx1 + 10, by1 + 16), fill=150)
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    table = Image.composite(Image.new("RGB", (W, H), (25, 15, 8)), table, shadow)
    board = wood_texture(bx1 - bx0, by1 - by0, (236, 226, 208), seed=2, grain=0.035, stretch=6)
    table.paste(board, (bx0, by0))
    d = ImageDraw.Draw(table)
    d.line((bx0, by1, bx1, by1), fill=(170, 150, 125), width=3)
    d.line((bx1, by0, bx1, by1), fill=(180, 160, 135), width=3)
    # leichtes Fensterlicht von links oben
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    light = 1.06 - 0.16 * (xx / W) - 0.10 * (yy / H)
    arr = np.asarray(table, dtype=np.float32) * light[..., None]
    return Image.fromarray(arr.clip(0, 255).astype(np.uint8))


def nail_sprite(r=3):
    s = 4
    size = (r * 2 + 12) * s
    spr = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sh = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    c = size // 2
    ImageDraw.Draw(sh).ellipse((c - r * s + 5 * s, c - r * s + 6 * s, c + r * s + 5 * s, c + r * s + 6 * s),
                               fill=(0, 0, 0, 110))
    sh = sh.filter(ImageFilter.GaussianBlur(2.5 * s))
    spr.alpha_composite(sh)
    head = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    hd = ImageDraw.Draw(head)
    hd.ellipse((c - r * s, c - r * s, c + r * s, c + r * s), fill=(120, 118, 115, 255))
    for k in range(r * s, 0, -1):  # Verlauf: hell oben links
        t = k / (r * s)
        g = int(250 - 120 * t)
        off = int((1 - t) * -1.6 * s)
        hd.ellipse((c - k + off, c - k + off, c + k + off, c + k + off), fill=(g, g, g - 4, 255))
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((c - r * s, c - r * s, c + r * s, c + r * s), fill=255)
    spr.paste(head, (0, 0), mask)
    ImageDraw.Draw(spr).ellipse((c - r * s, c - r * s, c + r * s, c + r * s), outline=(70, 68, 66, 255),
                                width=s)
    return spr.resize((size // s, size // s), Image.LANCZOS)


class ThreadCanvas:
    """Faeden decken wie echte Faeden uebereinander ab (Transmission wird multipliziert),
    darunter ein weicher Schatten. Gerechnet im Supersampling, ausgegeben in ART x ART."""

    def __init__(self, alpha=0.45, shadow_alpha=0.08, shadow_off=(5, 7)):
        n = ART * SS
        self.t = np.ones((n, n), np.float32)  # Durchlaessigkeit Faden
        self.ts = np.ones((n, n), np.float32)  # Durchlaessigkeit Schatten
        self.alpha, self.shadow_alpha, self.off = alpha, shadow_alpha, shadow_off

    def add(self, segs):
        if not segs:
            return
        n = ART * SS
        m = Image.new("L", (n, n), 0)
        ms = Image.new("L", (n, n), 0)
        d, ds = ImageDraw.Draw(m), ImageDraw.Draw(ms)
        ox, oy = self.off
        for p0, p1 in segs:
            d.line((p0, p1), fill=255, width=SS)
            ds.line((p0[0] + ox, p0[1] + oy, p1[0] + ox, p1[1] + oy), fill=255, width=3 * SS)
        self.t *= 1 - self.alpha * np.asarray(m, np.float32) / 255.0
        self.ts *= 1 - self.shadow_alpha * np.asarray(ms, np.float32) / 255.0

    def layer(self, extra=None):
        t = self.t
        if extra is not None:  # gerade gespannter Faden: kraeftiger
            m = Image.new("L", t.shape[::-1], 0)
            ImageDraw.Draw(m).line(extra, fill=255, width=SS + 1)
            t = t * (1 - 0.9 * np.asarray(m, np.float32) / 255.0)
        n = t.shape[0]
        rgba = np.zeros((n, n, 4), np.uint8)
        a_thr = 1 - t
        a_sh = (1 - self.ts) * t  # Schatten nur, wo kein Faden ist
        a = a_thr + a_sh
        col = np.array(THREAD_RGB, np.float32)
        rgba[..., :3] = (col[None, None, :] * (a_thr / np.maximum(a, 1e-6))[..., None]).astype(np.uint8)
        rgba[..., 3] = (np.clip(a, 0, 1) * 255).astype(np.uint8)
        return Image.fromarray(rgba, "RGBA").resize((ART, ART), Image.LANCZOS)


def to_art(p):
    """Arbeitskoordinate -> Pixel in der (supersampleten) Fadenebene."""
    return (p[0] / WORK * ART * SS, p[1] / WORK * ART * SS)


def ease_in(t, power=2.2):
    return t ** power


def render(target_path, out, style="circle", seconds_nails=5.0, seconds_thread=18.0, seconds_hold=5.0):
    os.makedirs(out, exist_ok=True)
    t0 = time.time()
    if style == "circle":
        target = circle_target(target_path)
        nails = circle_nails()
        seq = solve_circle(target, nails)
    else:
        target = load_target(target_path)
        nails = place_nails(target)
        seq, _ = solve_threads(target, nails)
    print(f"{len(nails)} Naegel, {len(seq)} Fadenlinien ({time.time() - t0:.1f} s)", flush=True)
    Image.fromarray(((1 - target) * 255).astype(np.uint8)).save(os.path.join(out, "target.png"))

    board = make_board()
    sprite = nail_sprite()
    sw, sh = sprite.size
    canvas = ThreadCanvas()
    nail_px = [(ART_X + x / WORK * ART, ART_Y + y / WORK * ART) for x, y in nails]
    # Einschlag-Reihenfolge: grob von oben nach unten, mit etwas Zufall (wie von Hand)
    rng = np.random.default_rng(11)
    if style == "circle":
        order = np.arange(len(nails))  # reihum im Kreis
    else:
        order = np.argsort(nails[:, 1] + rng.normal(0, WORK * 0.06, len(nails)))

    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
           "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p",
           "-crf", "19", "-movflags", "+faststart", os.path.join(out, "string_art.mp4")]
    ff = subprocess.Popen(cmd, stdin=subprocess.PIPE)

    def emit(img):
        ff.stdin.write(img.convert("RGB").tobytes())

    def nails_layer(count, pop_idx=None):
        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        for n, i in enumerate(order[:count]):
            x, y = nail_px[i]
            spr = sprite
            if pop_idx is not None and n >= pop_idx:  # frisch eingeschlagen: kurz groesser
                spr = sprite.resize((int(sw * 1.35), int(sh * 1.35)))
            layer.alpha_composite(spr, (int(x - spr.width / 2), int(y - spr.height / 2)))
        return layer

    # 1) Naegel
    n_frames = int(seconds_nails * FPS)
    for f in range(n_frames):
        count = int(len(order) * ease_in((f + 1) / n_frames, 1.3))
        frame = board.copy().convert("RGBA")
        frame.alpha_composite(nails_layer(count, pop_idx=max(0, count - 6)))
        emit(frame)
    all_nails = nails_layer(len(order))

    # 2) Faden: anfangs einzelne Linien, dann immer schneller
    def compose(extra=None):
        frame = board.copy().convert("RGBA")
        frame.alpha_composite(canvas.layer(extra), (ART_X, ART_Y))
        frame.alpha_composite(all_nails)
        return frame

    # die ersten Faeden einzeln: man sieht, wie der Faden gespannt wird
    intro = min(14, len(seq))
    for a, b in seq[:intro]:
        p0, p1 = to_art(nails[a]), to_art(nails[b])
        for g in range(1, 7):
            t = g / 6
            emit(compose((p0, (p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t))))
        canvas.add([(p0, p1)])
    rest = seq[intro:]
    n_frames = int((seconds_thread - intro * 6 / FPS) * FPS)
    done = 0
    for f in range(n_frames):
        upto = int(len(rest) * ease_in((f + 1) / n_frames))
        canvas.add([(to_art(nails[a]), to_art(nails[b])) for a, b in rest[done:upto]])
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
        x = int(cx * s - W / 2)
        y = int(cy * s - H / 2)
        x, y = max(0, min(big.width - W, x)), max(0, min(big.height - H, y))
        emit(big.crop((x, y, x + W, y + H)))

    ff.stdin.close()
    ff.wait()
    final.convert("RGB").save(os.path.join(out, "final.jpg"), quality=92)
    with open(os.path.join(out, "info.json"), "w") as f:
        json.dump({"image": target_path, "nails": len(nails), "lines": len(seq),
                   "seconds": seconds_nails + seconds_thread + seconds_hold}, f, indent=1)
    print(f"fertig in {time.time() - t0:.0f} s -> {out}", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--image", required=True)
    ap.add_argument("--out", default="experiments/string_art")
    ap.add_argument("--style", choices=["circle", "mesh"], default="circle")
    args = ap.parse_args()
    render(args.image, args.out, style=args.style)


if __name__ == "__main__":
    main()

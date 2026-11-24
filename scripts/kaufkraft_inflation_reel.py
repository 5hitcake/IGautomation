"""Sonntags-Reel fuer @kaufkraft.check (Inflation der Woche), 1080x1920, 30 fps, 14 s.

Gleicher Aufbau wie das Produkt-Reel (scripts/kaufkraft_reel.py):
  0.0-2.6 s  Frage als Aufhaenger
  2.6-3.0 s  Aufhaenger wird zur Ueberschrift
  3.0-6.5 s  Diagramm baut sich auf (Balken wachsen nacheinander, Werte zaehlen hoch)
  6.8 s      grosse Kennzahl springt herein
  9.6-14 s   Schluss: Frage an die Zuschauer + Folgen-Aufruf

Je Art eigenes Diagramm:
  rate              24 Monats-Saeulen, die letzte rot
  purchasing_power  100 EUR heute vs. Wert von 100 EUR aus 2020 / 2010 / 2001
  movers            die sechs groessten Preistreiber
  europe            Inflationsraten im Laendervergleich, Deutschland hervorgehoben
"""
import os
import subprocess
import tempfile

import kaufkraft_reel as kreel
import kaufkraft_render as kr
from kaufkraft_reel import (
    CREAM,
    DURATION,
    FPS,
    GOLD,
    INK,
    MUTED,
    NAVY,
    RED,
    WHITE,
    H,
    W,
    clamp,
    ease,
    fade,
    paste_center,
    text_layer,
)
from PIL import Image, ImageDraw

MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"]
HOOK_END, TITLE_AT = 2.6, 2.9
CHART_START, CHART_END = 3.0, 6.4
BIG_AT, CTA_AT = 6.8, 9.6
BAR_BG = kreel.BAR_BG
CX = (kreel.MARGIN_L + W - kreel.MARGIN_R) / 2


def month_short(period):
    return f"{MONTHS[int(period[5:7]) - 1]} {period[2:4]}"


def build_spec(kind, data, fmt_eur, fmt_pct, period_label):
    """Texte und Diagrammdaten je Art. rows: (Beschriftung, Wert, Anzeige, hervorgehoben)."""
    stand = period_label(data["period"])
    if kind == "rate":
        return {
            "hook": ["Wie hoch ist die", "Inflation", "gerade?"],
            "title": "Inflationsrate Deutschland",
            "chart": "columns",
            "rows": [(month_short(p), v, fmt_pct(v, signed=False), i == len(data["history"]) - 1)
                     for i, (p, v) in enumerate(data["history"])],
            "big": fmt_pct(data["rate"], signed=False),
            "big_sub": f"im {stand}",
            "cta": ["Merkst du das beim Einkaufen?", "Schreib's in die Kommentare"],
        }
    if kind == "purchasing_power":
        rows = [("Heute", 100.0, fmt_eur(100), False)]
        rows += [(f"aus {y}", v, fmt_eur(v), y == "2001") for y, v in reversed(data["rows"])]
        r01 = dict(data["rows"])["2001"]
        return {
            "hook": ["Was sind 100 €", "aus 2001", "heute noch wert?"],
            "title": "Kaufkraft von 100 € heute",
            "chart": "bars",
            "rows": rows,
            "big": fmt_eur(r01),
            "big_sub": "sind 100 € aus 2001 heute noch wert",
            "cta": ["Was hast du 2001 für 100 € bekommen?", "Schreib's in die Kommentare"],
        }
    if kind == "movers":
        items = data["items"]
        return {
            "hook": ["Was ist in einem Jahr", "am meisten", "teurer geworden?"],
            "title": f"Preistreiber · {stand}",
            "chart": "bars",
            "rows": [(n, v, fmt_pct(v), i == 0) for i, (n, v) in enumerate(items)],
            "big": fmt_pct(items[0][1]),
            "big_sub": f"{items[0][0]} in einem Jahr",
            "cta": ["Was ist bei dir am teuersten geworden?", "Schreib's in die Kommentare"],
        }
    if kind == "europe":
        de = dict(data["items"]).get("Deutschland")
        return {
            "hook": ["Wo ist die Inflation", "in Europa", "am höchsten?"],
            "title": f"Inflation in Europa · {stand}",
            "chart": "bars",
            "rows": [(n, v, fmt_pct(v, signed=False), n == "Deutschland") for n, v in data["items"]],
            "big": fmt_pct(de, signed=False),
            "big_sub": "Deutschland",
            "cta": ["Hättest du das gedacht?", "Schreib's in die Kommentare"],
        }
    raise ValueError(kind)


class InflationScene:
    def __init__(self, spec):
        self.spec = spec
        d = ImageDraw.Draw(Image.new("RGB", (10, 10)))
        maxw = W - kreel.MARGIN_L - kreel.MARGIN_R
        h = spec["hook"]
        self.hook = [text_layer(h[0], kr.fit_font(d, h[0], "semi", 72, maxw), INK),
                     text_layer(h[1], kr.fit_font(d, h[1], "bold", 120, maxw), NAVY),
                     text_layer(h[2], kr.fit_font(d, h[2], "semi", 72, maxw), INK)]
        self.title = text_layer(spec["title"], kr.fit_font(d, spec["title"], "bold", 56, maxw), INK)
        self.big = text_layer(spec["big"], kr.font("bold", 150), RED)
        self.big_sub = text_layer(spec["big_sub"], kr.fit_font(d, spec["big_sub"], "semi", 46, maxw), INK)
        cta = spec["cta"]
        self.cta = [(text_layer(cta[0], kr.fit_font(d, cta[0], "bold", 60, maxw), WHITE), 30),
                    (text_layer(cta[1], kr.font("regular", 44), (200, 207, 220)), 90),
                    (text_layer("Folge @kaufkraft.check", kr.font("bold", 50), GOLD), 0)]
        self.max_val = max(abs(r[1]) for r in spec["rows"]) or 1

    def brand(self, base):
        d = ImageDraw.Draw(base)
        f = kr.font("bold", 44)
        left = d.textlength("KAUFKRAFT ", font=f)
        x = CX - (left + d.textlength("CHECK", font=f)) / 2
        d.text((x, 200), "KAUFKRAFT ", font=f, fill=NAVY)
        d.text((x + left, 200), "CHECK", font=f, fill=GOLD)

    def row_progress(self, t, i, n):
        step = (CHART_END - CHART_START) / max(n, 1)
        start = CHART_START + i * step
        return ease((t - start) / max(step * 1.6, 0.25))

    def bars(self, base, t, top, bottom):
        d = ImageDraw.Draw(base)
        rows = self.spec["rows"]
        n = len(rows)
        row_h = min(170, (bottom - top) / n)
        bar_h = min(110, row_h * 0.72)
        label_w = 290
        x0 = kreel.MARGIN_L + label_w
        max_w = W - kreel.MARGIN_R - x0
        lf = kr.font("bold", 46 if n <= 4 else 40 if n <= 6 else 36)
        for i, (label, value, shown, hi) in enumerate(rows):
            g = self.row_progress(t, i, n)
            if g <= 0:
                continue
            y = top + i * row_h
            col = RED if hi else NAVY
            d.text((kreel.MARGIN_L, y + bar_h / 2), label, font=lf, fill=RED if hi else MUTED, anchor="lm")
            d.rounded_rectangle((x0, y, x0 + max_w, y + bar_h), 22, fill=BAR_BG)
            w = max(40, max_w * abs(value) / self.max_val * g)
            d.rounded_rectangle((x0, y, x0 + w, y + bar_h), 22, fill=col)
            txt = shown
            vf = kr.font("bold", 50 if n <= 4 else 42)
            tw = d.textlength(txt, font=vf)
            inside = w > tw + 40
            tx = x0 + w - tw - 18 if inside else x0 + w + 14
            if g > 0.6:  # Wert erscheint, wenn der Balken fast steht
                d.text((tx, y + bar_h / 2), txt, font=vf, fill=WHITE if inside else INK, anchor="lm")

    def columns(self, base, t, top, bottom):
        d = ImageDraw.Draw(base)
        rows = self.spec["rows"]
        n = len(rows)
        left, right = kreel.MARGIN_L, W - kreel.MARGIN_R
        gap = 8
        col_w = (right - left - gap * (n - 1)) / n
        lo = min(0, min(r[1] for r in rows))
        span = (max(r[1] for r in rows) - lo) or 1
        base_y = bottom - 50
        usable = base_y - top - 60
        for i, (label, value, shown, hi) in enumerate(rows):
            g = self.row_progress(t, i, n)
            if g <= 0:
                continue
            x = left + i * (col_w + gap)
            hgt = max(6, usable * (value - lo) / span * g)
            d.rounded_rectangle((x, base_y - hgt, x + col_w, base_y), 8, fill=RED if hi else NAVY)
            if hi and g > 0.6:  # Wert oben rechts ueber dem Diagramm, nicht ueber Nachbarsaeulen
                d.text((right, top - 10), shown, font=kr.font("bold", 48), fill=RED, anchor="ra")
        lf = kr.font("semi", 32)
        if self.row_progress(t, 0, n) > 0:
            d.text((left, base_y + 14), rows[0][0], font=lf, fill=MUTED)
        if self.row_progress(t, n - 1, n) > 0:
            d.text((right, base_y + 14), rows[-1][0], font=lf, fill=RED, anchor="ra")

    def frame(self, t):
        base = Image.new("RGBA", (W, H), CREAM + (255,))
        self.brand(base)
        if t < HOOK_END + 0.3:
            out = 1 - fade(t, HOOK_END - 0.2, 0.3)
            y = 640
            for i, layer in enumerate(self.hook):
                show = 1.0 if i == 0 else fade(t, i * 0.18, 0.25)
                paste_center(base, layer, CX, y, show * out, dy=(1 - show) * 30)
                y += layer.height + 14
        if TITLE_AT - 0.3 <= t < CTA_AT + 0.4:
            paste_center(base, self.title, CX, 300, fade(t, TITLE_AT - 0.3, 0.3))
            if self.spec["chart"] == "columns":
                self.columns(base, t, 440, 1180)
                big_y = 1200
            else:
                n = len(self.spec["rows"])
                self.bars(base, t, 440, 1180)
                big_y = 440 + n * min(170, 740 / n) + 60
            p = (t - BIG_AT) / 0.45
            if p > 0:
                paste_center(base, self.big, CX, big_y, clamp(p * 2), kreel.back_out(p))
                paste_center(base, self.big_sub, CX, big_y + self.big.height - 6, fade(t, BIG_AT + 0.3))
        c = ease((t - CTA_AT) / 0.5)
        if c > 0:
            top = round(H - H * c)
            ImageDraw.Draw(base).rectangle((0, top, W, H), fill=NAVY)
            paste_center(base, self.big, CX, top + 460, fade(t, CTA_AT + 0.3))
            y = top + 760
            for i, (layer, gap) in enumerate(self.cta):
                a = fade(t, CTA_AT + 0.4 + i * 0.25)
                paste_center(base, layer, CX, y, a, dy=(1 - a) * 24)
                y += layer.height + gap
        return base.convert("RGB")


def render_inflation_reel(kind, data, out_path, fmt_eur, fmt_pct, period_label, music=None):
    scene = InflationScene(build_spec(kind, data, fmt_eur, fmt_pct, period_label))
    with tempfile.TemporaryDirectory() as tmp:
        audio = music
        if not audio:
            audio = os.path.join(tmp, "ton.wav")
            kreel.write_wav(audio, kreel.synth_audio(scene.spec["rows"][:3], True))
        cmd = ["ffmpeg", "-y", "-loglevel", "error",
               "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
               "-i", audio, "-map", "0:v", "-map", "1:a",
               "-af", f"afade=t=in:d=0.3,afade=t=out:st={DURATION - 1}:d=1",
               "-c:a", "aac", "-b:a", "192k", "-ac", "2", "-ar", "48000",
               "-t", str(DURATION)] + kreel.VIDEO_ENCODE + [out_path]
        proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        for i in range(int(DURATION * FPS)):
            proc.stdin.write(scene.frame(i / FPS).tobytes())
        proc.stdin.close()
        if proc.wait() != 0:
            raise RuntimeError("ffmpeg fehlgeschlagen")
    return out_path


def render_still(kind, data, out_path, fmt_eur, fmt_pct, period_label, t):
    InflationScene(build_spec(kind, data, fmt_eur, fmt_pct, period_label)).frame(t).save(out_path, "JPEG",
                                                                                         quality=90)
    return out_path

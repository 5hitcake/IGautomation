"""Reel fuer @kaufkraft.check (1080x1920, 30 fps, ~12 s, H.264/AAC).

Ablauf:
  0.0-2.6 s  Aufhaenger "Rate mal: <Produkt> - Was kostete das 2001?" + Bild (langsamer Zoom)
  2.6-3.2 s  Bild rutscht nach oben
  3.0-6.4 s  Balken 2001 / 2010 / HEUTE wachsen nacheinander, Preise zaehlen hoch
  6.6-9.6 s  "+129,5 %" springt herein
  9.6-12  s  Schluss: Merksatz mit 10 Euro, Aufruf zum Kommentieren + Folgen

Alle Texte liegen zwischen y=200 und y=1500: oben blendet Instagram "Reels" ein,
unten Caption und Buttons, rechts die Icons (deshalb rechts mehr Rand).

Ton: eigener Song aus assets/kaufkraft_music/theme.* falls vorhanden, sonst ein
erzeugter Klangteppich mit Ticks beim Hochzaehlen und einem "Ding" beim Prozentwert
(kein Lizenzproblem, alles synthetisch).

Das Video liegt nicht in main (Repo-Groesse), sondern auf dem Branch "kaufkraft-media".
"""
import glob
import os
import subprocess
import tempfile
import wave

import kaufkraft_render as kr
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = kr.ROOT
MUSIC_DIR = os.path.join(ROOT, "assets", "kaufkraft_music")
MEDIA_BRANCH = "kaufkraft-media"

W, H = 1080, 1920
FPS = 30
DURATION = 12.0
THUMB_OFFSET_MS = 8800  # Titelbild: Bild + alle Preise + Prozentwert
MARGIN_L, MARGIN_R = 80, 130

HOOK_END = 2.6
MOVE_END = 3.2
ROW_STARTS = (3.0, 4.1, 5.2)
ROW_GROW = 0.8
PCT_START = 6.6
CTA_START = 9.6

NAVY, CREAM, INK, MUTED = kr.NAVY, kr.CREAM, kr.INK, kr.MUTED
RED, GOLD, WHITE, GREEN = kr.RED, kr.GOLD, kr.WHITE, kr.GREEN
BAR_BG = (230, 223, 210)
QUESTION = "Was kostete das 2001?"


def clamp(x, lo=0.0, hi=1.0):
    return max(lo, min(hi, x))


def ease(t):
    t = clamp(t)
    return 1 - (1 - t) ** 3


def back_out(t):
    """Ueberschwingen fuer Pop-Effekte."""
    t = clamp(t)
    c = 1.9
    return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2


def lerp(a, b, t):
    return a + (b - a) * t


def lerp_box(a, b, t):
    return tuple(lerp(x, y, t) for x, y in zip(a, b))


def fade(t, start, dur=0.35):
    return ease((t - start) / dur)


def text_layer(text, fnt, fill):
    """Text als eigenes RGBA-Bild (fuer Skalieren und Transparenz)."""
    box = fnt.getbbox(text)
    img = Image.new("RGBA", (box[2] - box[0] + 8, box[3] + 12), (0, 0, 0, 0))
    ImageDraw.Draw(img).text((4 - box[0], 4), text, font=fnt, fill=fill)
    return img


def paste_center(base, layer, cx, y, alpha=1.0, scale=1.0, dy=0.0):
    if alpha <= 0.01 or scale <= 0.01:
        return
    if scale != 1.0:
        layer = layer.resize((max(1, round(layer.width * scale)), max(1, round(layer.height * scale))),
                             Image.BILINEAR)
    if alpha < 1.0:
        layer = layer.copy()
        layer.putalpha(layer.getchannel("A").point(lambda v: round(v * alpha)))
    base.alpha_composite(layer, (round(cx - layer.width / 2), round(y + dy)))


class Scene:
    """Alles, was sich nicht pro Frame aendert, wird einmal vorbereitet."""

    def __init__(self, product, prices, photo_path, fmt_eur, fmt_pct):
        self.product, self.prices = product, prices
        self.fmt_eur, self.fmt_pct = fmt_eur, fmt_pct
        photo = Image.open(photo_path).convert("RGB") if photo_path and os.path.exists(photo_path) else None
        self.photo = photo or kr.placeholder_photo(product["name"])
        self.photo_hi = kr.cover(self.photo, (1200, 900))
        self.cx = (MARGIN_L + W - MARGIN_R) / 2

        d = ImageDraw.Draw(Image.new("RGB", (10, 10)))
        maxw = W - MARGIN_L - MARGIN_R
        self.hook = [
            text_layer("Rate mal:", kr.font("semi", 70), MUTED),
            text_layer(product["name"], kr.fit_font(d, product["name"], "bold", 132, maxw), NAVY),
            text_layer(QUESTION, kr.fit_font(d, QUESTION, "semi", 72, maxw), INK),
        ]
        self.name_small = text_layer(product["name"], kr.fit_font(d, product["name"], "bold", 64, maxw), INK)
        self.amount = text_layer(product["amount"], kr.font("regular", 34), MUTED)

        self.rows = [(label, value) for label, value in
                     (("2001", prices.get("2001")), ("2010", prices.get("2010")), ("HEUTE", prices["today"]))
                     if value]
        self.max_price = max(v for _, v in self.rows)

        p01 = prices.get("pct_2001")
        self.pct = p01
        if p01 is not None:
            col = RED if p01 >= 0 else GREEN
            self.pct_layer = text_layer(fmt_pct(p01), kr.font("bold", 160), col)
            self.pct_sub = text_layer("teurer als 2001" if p01 >= 0 else "billiger als 2001",
                                      kr.font("semi", 50), INK)
        self.cta = []
        if prices.get("2001"):
            now10 = 10.0 * prices["today"] / prices["2001"]
            self.cta += [(text_layer("Für 10 € von 2001", kr.font("regular", 50), (200, 207, 220)), 8),
                         (text_layer(f"zahlst du heute {fmt_eur(now10)}", kr.font("bold", 66), WHITE), 110)]
        self.cta += [(text_layer("Hättest du das gedacht?", kr.font("semi", 54), GOLD), 14),
                     (text_layer("Schreib's in die Kommentare", kr.font("regular", 44), (200, 207, 220)), 70),
                     (text_layer("Folge @kaufkraft.check", kr.font("bold", 50), WHITE), 0)]

    # --- Bausteine -------------------------------------------------------
    def brand(self, base):
        d = ImageDraw.Draw(base)
        f = kr.font("bold", 44)
        left = d.textlength("KAUFKRAFT ", font=f)
        total = left + d.textlength("CHECK", font=f)
        x = self.cx - total / 2
        d.text((x, 200), "KAUFKRAFT ", font=f, fill=NAVY)
        d.text((x + left, 200), "CHECK", font=f, fill=GOLD)

    def photo_at(self, base, box, zoom):
        x0, y0, x1, y1 = (round(v) for v in box)
        w, h = x1 - x0, y1 - y0
        src = self.photo_hi
        # Ken-Burns: Ausschnitt aus dem grossen Bild
        cw, ch = src.width / zoom, src.height / zoom
        ratio = w / h
        if cw / ch > ratio:
            cw = ch * ratio
        else:
            ch = cw / ratio
        left, top = (src.width - cw) / 2, (src.height - ch) / 2
        img = src.resize((w, h), Image.BILINEAR, box=(left, top, left + cw, top + ch))
        mask = Image.new("L", (w, h), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, w, h), 36, fill=255)
        shadow = Image.new("RGBA", (w + 80, h + 80), (0, 0, 0, 0))
        ImageDraw.Draw(shadow).rounded_rectangle((40, 54, w + 40, h + 54), 36, fill=(0, 0, 0, 60))
        base.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(16)), (x0 - 40, y0 - 40))
        base.paste(img, (x0, y0), mask)

    def bars(self, base, t, top):
        d = ImageDraw.Draw(base)
        row_h = 140
        label_w = 200
        x_bar = MARGIN_L + label_w
        max_bar = W - MARGIN_R - x_bar
        for i, (label, value) in enumerate(self.rows):
            start = ROW_STARTS[i]
            a = fade(t, start, 0.25)
            if a <= 0:
                continue
            y = top + i * row_h
            today = label == "HEUTE"
            d.text((MARGIN_L, y + 26), label, font=kr.font("bold", 44), fill=RED if today else MUTED)
            grow = ease((t - start) / ROW_GROW)
            full = max_bar * value / self.max_price
            d.rounded_rectangle((x_bar, y + 10, x_bar + max_bar, y + 112), 26, fill=BAR_BG)
            w = max(44, full * grow)
            d.rounded_rectangle((x_bar, y + 10, x_bar + w, y + 112), 26, fill=RED if today else NAVY)
            txt = self.fmt_eur(value * grow)
            f = kr.font("bold", 50)
            tw = d.textlength(txt, font=f)
            inside = w > tw + 50
            tx = x_bar + w - tw - 24 if inside else x_bar + w + 18
            d.text((tx, y + 26), txt, font=f, fill=WHITE if inside else INK)

    # --- Frame -------------------------------------------------------------
    def frame(self, t):
        base = Image.new("RGBA", (W, H), CREAM + (255,))
        self.brand(base)

        # Bild: gross in der Mitte -> klein oben
        big = (MARGIN_L, 760, W - MARGIN_R, 1420)
        small = (MARGIN_L + 110, 290, W - MARGIN_R - 110, 660)
        m = ease((t - HOOK_END) / (MOVE_END - HOOK_END))
        box = lerp_box(big, small, m)
        zoom = 1.0 + 0.10 * clamp(t / DURATION)
        if t < CTA_START + 0.4:
            self.photo_at(base, box, zoom)

        # Aufhaenger
        if t < HOOK_END:
            out = 1 - fade(t, HOOK_END - 0.3, 0.3)
            y = 300
            for i, layer in enumerate(self.hook):
                show = 1.0 if i == 0 else fade(t, i * 0.18, 0.25)
                paste_center(base, layer, self.cx, y, show * out, dy=(1 - show) * 30)
                y += layer.height + 10

        # Name + Balken
        if t >= MOVE_END - 0.3 and t < CTA_START + 0.4:
            a = fade(t, MOVE_END - 0.3, 0.3)
            paste_center(base, self.name_small, self.cx, 680, a)
            paste_center(base, self.amount, self.cx, 680 + self.name_small.height, a)
            self.bars(base, t, 830)

            if self.pct is not None:
                p = (t - PCT_START) / 0.45
                if p > 0:
                    paste_center(base, self.pct_layer, self.cx, 1250, clamp(p * 2), back_out(p))
                    paste_center(base, self.pct_sub, self.cx, 1250 + self.pct_layer.height - 10,
                                 fade(t, PCT_START + 0.3))

        # Aufruf am Ende: Navy-Flaeche faehrt von unten herein
        c = ease((t - CTA_START) / 0.5)
        if c > 0:
            top = round(H - H * c)
            d = ImageDraw.Draw(base)
            d.rectangle((0, top, W, H), fill=NAVY)
            y = top + 760
            for i, (layer, gap) in enumerate(self.cta):
                a = fade(t, CTA_START + 0.4 + i * 0.25)
                paste_center(base, layer, self.cx, y, a, dy=(1 - a) * 24)
                y += layer.height + gap
            self.photo_at_cta(base, t, top)
        return base.convert("RGB")

    def photo_at_cta(self, base, t, top):
        a = fade(t, CTA_START + 0.3, 0.4)
        if a <= 0:
            return
        size = 340
        img = kr.cover(self.photo, (size, size)).convert("RGBA")
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, size, size), fill=round(255 * a))
        img.putalpha(mask)
        base.alpha_composite(img, (round(self.cx - size / 2), top + 330))


# --- Ton ------------------------------------------------------------------
RATE = 44100


def _tone(freq, dur, vol, decay):
    t = np.arange(int(dur * RATE)) / RATE
    return vol * np.sin(2 * np.pi * freq * t) * np.exp(-t * decay)


def synth_audio(rows, pct_present):
    n = int(DURATION * RATE)
    out = np.zeros(n)
    t = np.arange(n) / RATE

    # Klangteppich: weicher Dur-Akkord mit leichtem Wabern, ein Akkordwechsel zur Mitte
    def pad(freqs, start, end):
        i0, i1 = int(start * RATE), int(end * RATE)
        seg = t[i0:i1] - start
        env = np.minimum(1, seg / 0.8) * np.minimum(1, (end - start - seg) / 0.8)
        wob = 1 + 0.15 * np.sin(2 * np.pi * 0.5 * seg)
        sig = sum(np.sin(2 * np.pi * f * seg) + 0.3 * np.sin(2 * np.pi * 2 * f * seg) for f in freqs)
        out[i0:i1] += 0.035 * env * wob * sig

    pad([130.81, 164.81, 196.0], 0, 6.8)       # C-Dur
    pad([110.0, 130.81, 164.81], 6.4, 9.9)     # a-Moll
    pad([87.31, 130.81, 174.61], 9.5, DURATION)  # F-Dur

    def add(sig, at):
        i = int(at * RATE)
        sig = sig[: max(0, n - i)]
        out[i:i + len(sig)] += sig

    # sanfter Puls (Kick) als Rhythmus
    k = np.arange(int(0.25 * RATE)) / RATE
    kick = 0.25 * np.sin(2 * np.pi * (55 + 60 * np.exp(-k * 30)) * k) * np.exp(-k * 14)
    beat = 60 / 100
    b = 0.0
    while b < DURATION - 0.3:
        add(kick, b)
        b += beat

    # Ticks beim Hochzaehlen
    for i in range(len(rows)):
        start = ROW_STARTS[i]
        for j in range(10):
            add(_tone(1800 + 120 * j + 200 * i, 0.03, 0.10, 120), start + j * ROW_GROW / 10)
    # "Ding" beim Prozentwert
    if pct_present:
        add(_tone(1046.5, 1.4, 0.22, 3.5) + _tone(1568.0, 1.4, 0.12, 4.0), PCT_START)
    # Wusch beim Aufruf
    noise = np.random.default_rng(1).standard_normal(int(0.5 * RATE))
    env = np.sin(np.linspace(0, np.pi, len(noise))) ** 2
    add(0.06 * noise * env, CTA_START - 0.05)

    out *= np.minimum(1, (n - np.arange(n)) / (0.8 * RATE))  # ausblenden
    peak = np.max(np.abs(out)) or 1
    return (out / peak * 0.8 * 32767).astype(np.int16)


def write_wav(path, samples):
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(samples.tobytes())


def find_theme():
    files = sorted(glob.glob(os.path.join(MUSIC_DIR, "theme.*")))
    return files[0] if files else None


def render_reel(product, prices, photo_path, out_path, fmt_eur, fmt_pct, music=None):
    scene = Scene(product, prices, photo_path, fmt_eur, fmt_pct)
    with tempfile.TemporaryDirectory() as tmp:
        audio = music
        if not audio:
            audio = os.path.join(tmp, "ton.wav")
            write_wav(audio, synth_audio(scene.rows, scene.pct is not None))
        cmd = ["ffmpeg", "-y", "-loglevel", "error",
               "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
               "-i", audio, "-map", "0:v", "-map", "1:a",
               "-af", f"afade=t=in:d=0.3,afade=t=out:st={DURATION - 1}:d=1", "-c:a", "aac", "-b:a", "160k",
               "-t", str(DURATION), "-c:v", "libx264", "-preset", "medium", "-crf", "21",
               "-pix_fmt", "yuv420p", "-movflags", "+faststart", out_path]
        proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        for i in range(int(DURATION * FPS)):
            proc.stdin.write(scene.frame(i / FPS).tobytes())
        proc.stdin.close()
        if proc.wait() != 0:
            raise RuntimeError("ffmpeg fehlgeschlagen")
    return out_path


def render_still(product, prices, photo_path, out_path, fmt_eur, fmt_pct, t):
    """Einzelbild zum Pruefen (Tests, Vorschau)."""
    Scene(product, prices, photo_path, fmt_eur, fmt_pct).frame(t).save(out_path, "JPEG", quality=90)
    return out_path

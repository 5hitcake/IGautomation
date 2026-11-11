"""Baut das Profilbild fuer @kaufkraft.check (1080x1080, Instagram schneidet rund zu).

Motiv: goldene Euro-Muenze mit roter Plakette und Pfeil nach unten (Kaufkraftverlust).
Bewusst ohne Text - bleibt auch winzig erkennbar.

  python assets/kaufkraft_profile/make_pfp.py
"""
import os

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.join(HERE, "..", "fonts", "Poppins-Bold.ttf")
S = 1080
SS = 2  # Supersampling fuer glatte Kanten

NAVY = (16, 27, 45)
GOLD = (222, 170, 60)
GOLD_DARK = (176, 128, 32)
RED = (214, 64, 44)
CREAM = (246, 241, 232)


def build(bg, coin, coin_edge, euro_color, arrow):
    n = S * SS
    img = Image.new("RGB", (n, n), bg)
    d = ImageDraw.Draw(img)
    # Muenze (leicht nach links oben versetzt, Platz fuer die Plakette)
    cx, cy, r = n * 0.46, n * 0.46, n * 0.29
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=coin_edge)
    r2 = r * 0.86
    d.ellipse((cx - r2, cy - r2, cx + r2, cy + r2), fill=coin)
    f = ImageFont.truetype(FONT, int(r * 1.35))
    d.text((cx, cy), "€", font=f, fill=euro_color, anchor="mm")
    # Rote Plakette mit Pfeil nach unten (Kaufkraftverlust)
    bx, by, br = cx + r * 0.80, cy + r * 0.80, r * 0.46
    d.ellipse((bx - br - n * 0.018, by - br - n * 0.018, bx + br + n * 0.018, by + br + n * 0.018), fill=bg)
    d.ellipse((bx - br, by - br, bx + br, by + br), fill=arrow)
    sw, head_w, top, tip = br * 0.24, br * 0.62, by - br * 0.55, by + br * 0.58
    neck = tip - head_w * 0.85
    d.rectangle((bx - sw / 2, top, bx + sw / 2, neck + 2), fill=(255, 255, 255))
    d.polygon([(bx - head_w, neck), (bx + head_w, neck), (bx, tip)], fill=(255, 255, 255))
    return img.resize((S, S), Image.LANCZOS)


def main():
    variants = {
        "profilbild_navy.png": build(NAVY, GOLD, GOLD_DARK, NAVY, RED),
        "profilbild_hell.png": build(CREAM, GOLD, GOLD_DARK, NAVY, RED),
    }
    for name, img in variants.items():
        img.save(os.path.join(HERE, name))
        print("gespeichert:", name)


if __name__ == "__main__":
    main()

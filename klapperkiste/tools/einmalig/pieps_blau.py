"""Einmalige Bearbeitung: Pieps (Moos' blauer Vogel) für die Karte aus dem Spatzen färben.

Pieps sitzt in Moos' Bart und ist blau mit hellem Bauch. Statt ein neues Bild zu erzeugen,
werden die beiden Spatzen-Posen (vogel_1/2) umgefärbt: braune Federn werden blau, der helle
Bauch und die schwarzen Linien bleiben. Ergebnis: assets/karte/tiere/pieps_1.png und _2.png.

Aufruf (aus dem Repo-Wurzelordner):
  python klapperkiste/tools/einmalig/pieps_blau.py
"""

from __future__ import annotations

import colorsys
import os
import sys

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
TIERE = os.path.join(ROOT, "assets", "karte", "tiere")
BLAU = 0.60          # Farbton (0…1), etwa wie Pieps im Bart
SAETTIGUNG = 0.75


def main() -> int:
    for i in (1, 2):
        bild = Image.open(os.path.join(TIERE, f"vogel_{i}.png")).convert("RGBA")
        px = bild.load()
        for y in range(bild.height):
            for x in range(bild.width):
                r, g, b, a = px[x, y]
                if not a:
                    continue
                h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
                if s < 0.12 or v < 0.18:
                    continue  # Bauch, Linien
                s2 = min(1.0, max(s, 0.35) * SAETTIGUNG / 0.45)
                v2 = min(1.0, v * 1.12)
                r2, g2, b2 = colorsys.hsv_to_rgb(BLAU, s2, v2)
                px[x, y] = (round(r2 * 255), round(g2 * 255), round(b2 * 255), a)
        bild.save(os.path.join(TIERE, f"pieps_{i}.png"))
        print(f"pieps_{i}.png")
    return 0


if __name__ == "__main__":
    sys.exit(main())

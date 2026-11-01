"""Einmalige Bearbeitung: Förster Moos, schwarzer Bodenschatten und Armlücke.

1. Der Schatten unter den Stiefeln ist bei allen vier Gesten hell (weißgraue
   Schraffur). Helle, fast farblose Pixel im unteren Bereich werden dunkel
   gefärbt; die Schraffur bleibt als Helligkeitsunterschied erhalten. Die
   braunen Stiefel sind farbig und bleiben unverändert.
2. Bei „auftrag“ (Hand in der Hüfte) bleibt zwischen Arm und Jacke ein weißer
   Fleck. Er wird von einem Punkt aus gefüllt und durchsichtig gemacht.

Aufruf:
  python klapperkiste/tools/einmalig/moos_schatten.py
"""

from __future__ import annotations

import os
import sys

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MOOS = os.path.join(ROOT, "assets", "charaktere", "moos")
GESTEN = ["hallo", "nachdenken", "auftrag", "juhu"]
SCHATTEN_AB = 0.86          # Schatten liegt unterhalb dieses Höhenanteils
ARMLUECKE = ("auftrag", (408, 300))


def hell_und_grau(r: int, g: int, b: int) -> bool:
    return min(r, g, b) > 110 and max(r, g, b) - min(r, g, b) < 40


def schatten_schwarz(bild: Image.Image) -> int:
    px = bild.load()
    n = 0
    for y in range(round(bild.height * SCHATTEN_AB), bild.height):
        for x in range(bild.width):
            r, g, b, a = px[x, y]
            if a and hell_und_grau(r, g, b):
                hell = (r + g + b) / 3
                v = round((255 - hell) * 0.35)   # helle Schraffur wird fast schwarz
                px[x, y] = (v, v, v, a)
                n += 1
    return n


def luecke_frei(bild: Image.Image, start: tuple[int, int]) -> int:
    px = bild.load()
    if not hell_und_grau(*px[start][:3]):
        raise SystemExit(f"Startpunkt {start} ist nicht weiß: {px[start]}")
    stapel, gesehen, n = [start], {start}, 0
    while stapel:
        x, y = stapel.pop()
        r, g, b, a = px[x, y]
        if not (a and min(r, g, b) > 170 and max(r, g, b) - min(r, g, b) < 40):
            continue
        px[x, y] = (r, g, b, 0)
        n += 1
        for nb in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nb[0] < bild.width and 0 <= nb[1] < bild.height and nb not in gesehen:
                gesehen.add(nb)
                stapel.append(nb)
    return n


def main() -> int:
    for geste in GESTEN:
        pfad = os.path.join(MOOS, f"{geste}.png")
        bild = Image.open(pfad).convert("RGBA")
        info = f"Schatten {schatten_schwarz(bild)} px"
        if geste == ARMLUECKE[0]:
            info += f", Armlücke {luecke_frei(bild, ARMLUECKE[1])} px"
        bild.save(pfad)
        print(f"{geste}: {info}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

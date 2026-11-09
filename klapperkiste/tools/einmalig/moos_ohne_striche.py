"""Einmalige Bearbeitung: Moos ohne Pieps, feine weiße Striche zwischen den Stiefeln entfernen
und die weiße Lücke zwischen erhobenem Arm und Kopf bei „nachdenken“ freistellen.

Über dem Bodenschatten bleiben vom Ausschneiden helle, fast farblose Striche stehen. Im unteren
Drittel werden helle graue Pixel durchsichtig, wenn sie (über andere solche Pixel) an einen
durchsichtigen Pixel grenzen. Stiefel, Schnürsenkel und Hose sind farbig oder eingeschlossen.

Aufruf:
  python klapperkiste/tools/einmalig/moos_ohne_striche.py
"""

from __future__ import annotations

import os
import sys

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ORDNER = os.path.join(ROOT, "assets", "charaktere", "moos_ohne")


def hell(p: tuple[int, int, int, int]) -> bool:
    r, g, b, a = p
    return a > 0 and min(r, g, b) > 150 and max(r, g, b) - min(r, g, b) < 35


ARMLUECKE = (300, 150)  # weißer Fleck zwischen erhobenem Arm und Kopf (Pixel in nachdenken.png)


def luecke_frei(bild: Image.Image, start: tuple[int, int]) -> int:
    """Weiße Fläche ab start durchsichtig machen (Füllung über helle, fast farblose Pixel)."""
    px, w, h = bild.load(), bild.width, bild.height
    weiss = lambda p: p[3] > 0 and min(p[:3]) > 185 and max(p[:3]) - min(p[:3]) < 35  # noqa: E731
    if not weiss(px[start]):
        return 0
    stapel, n = [start], 0
    while stapel:
        x, y = stapel.pop()
        if not (0 <= x < w and 0 <= y < h) or not weiss(px[x, y]):
            continue
        r, g, b, _ = px[x, y]
        px[x, y] = (r, g, b, 0)
        n += 1
        stapel += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    return n


def main() -> int:
    for datei in sorted(os.listdir(ORDNER)):
        bild = Image.open(os.path.join(ORDNER, datei)).convert("RGBA")
        px, w, h = bild.load(), bild.width, bild.height
        y0 = round(h * 0.6)
        stapel = [(x, y) for y in range(y0, h) for x in range(w)
                  if hell(px[x, y]) and any(0 <= x + dx < w and 0 <= y + dy < h and px[x + dx, y + dy][3] == 0
                                            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
        n = 0
        while stapel:
            x, y = stapel.pop()
            if not hell(px[x, y]):
                continue
            r, g, b, _ = px[x, y]
            px[x, y] = (r, g, b, 0)
            n += 1
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < w and y0 <= ny < h and hell(px[nx, ny]):
                    stapel.append((nx, ny))
        if datei == "nachdenken.png":
            n += luecke_frei(bild, ARMLUECKE)
        bild.save(os.path.join(ORDNER, datei))
        print(f"{datei}: {n} px")
    return 0


if __name__ == "__main__":
    sys.exit(main())

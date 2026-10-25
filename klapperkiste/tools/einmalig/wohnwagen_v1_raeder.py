"""Einmalige Bearbeitung: Mini-Wohnwagen ohne Räder und Bodenschatten.

Das gelieferte Bild hat Räder und einen Schatten mitgezeichnet. Räder kommen im
Spiel aus der Werkstatt, deshalb werden sie entfernt: in der Seitenansicht alle
grauen und schwarzen Pixel in den Radkreisen und alles unter der Unterkante, in
der Draufsicht die grauen Reifen, die oben und unten über die Karosserie ragen.

Aufruf:
  python klapperkiste/tools/einmalig/wohnwagen_raeder.py
"""

from __future__ import annotations

import os
import sys

from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import teilwerk  # noqa: E402

ROH = os.path.join(teilwerk.TEILE_DIR, "wohnwagen-roh")
WEISS = (255, 255, 255)

# Maße im Originalbild (1024 x 768), vermessen
RAEDER = [(322, 297, 50), (777, 300, 50)]   # Seitenansicht: Mittelpunkt und Radius
UNTERKANTE = 314                            # Seitenansicht: darunter nur Rad und Schatten
SEITE_BIS = 400                             # Seitenansicht endet über dieser Zeile
OBEN_REIFEN = [(690, 440, 800, 466), (705, 703, 800, 745), (215, 707, 320, 745)]  # Draufsicht: Reifen außen


def _grau(p: tuple[int, int, int], spanne: int = 40) -> bool:
    return max(p) - min(p) < spanne


def bearbeiten(original: Image.Image) -> Image.Image:
    bild = original.convert("RGB").copy()
    px = bild.load()
    for y in range(UNTERKANTE, SEITE_BIS):
        for x in range(bild.width):
            px[x, y] = WEISS
    for cx, cy, r in RAEDER:
        for y in range(cy - r, min(cy + r, UNTERKANTE)):
            for x in range(cx - r, cx + r):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r * r and _grau(px[x, y]):
                    px[x, y] = WEISS
    for x0, y0, x1, y1 in OBEN_REIFEN:
        for y in range(y0, y1):
            for x in range(x0, x1):
                if _grau(px[x, y], 30) and sum(px[x, y]) < 600:
                    px[x, y] = WEISS
    return bild


def main() -> int:
    original = Image.open(os.path.join(ROH, "wohnwagen_blatt_v1_original.png"))
    ziel = os.path.join(ROH, "wohnwagen_blatt_v1.png")
    bearbeiten(original).save(ziel)
    print(f"{os.path.relpath(ziel)}: Räder und Schatten entfernt")
    return 0


if __name__ == "__main__":
    sys.exit(main())

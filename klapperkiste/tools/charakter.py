"""Figurenbogen (2 × 2 Gesten) in einzelne, freigestellte Gesten schneiden.

Die Trennlinien werden an den hellsten Zeilen und Spalten nahe der Bildmitte
gesucht, danach wird jede Geste freigestellt und auf die Figur zugeschnitten.

Reihenfolge der Gesten: 1 hallo (oben links), 2 nachdenken (oben rechts),
3 auftrag (unten links), 4 juhu (unten rechts).

Aufruf:
  python klapperkiste/tools/charakter.py EINGABE NAME
Ergebnis: assets/charaktere/NAME/hallo.png, nachdenken.png, auftrag.png, juhu.png
"""

from __future__ import annotations

import os
import sys

from PIL import Image, ImageDraw, ImageStat

sys.path.insert(0, os.path.dirname(__file__))
import teilwerk  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ZIEL_DIR = os.path.join(ROOT, "assets", "charaktere")
GESTEN = ["hallo", "nachdenken", "auftrag", "juhu"]


def _trenner(bild: Image.Image, achse: str) -> int:
    """Hellste Zeile/Spalte im mittleren Drittel."""
    grau = bild.convert("L")
    n = grau.width if achse == "x" else grau.height
    beste = (-1.0, n // 2)
    for i in range(n // 3, 2 * n // 3):
        box = (i, 0, i + 1, grau.height) if achse == "x" else (0, i, grau.width, i + 1)
        streifen = grau.crop(box)
        hell = ImageStat.Stat(streifen).mean[0]
        beste = max(beste, (hell, i))
    return beste[1]


def beine_frei(teil: Image.Image, ab: float = 0.5) -> Image.Image:
    """Eingeschlossenes Papierweiß zwischen den Beinen entfernen.

    Gesucht wird nur in der unteren Hälfte, und entfernt werden nur weiße Flächen,
    die hoch und schmal sind und bis zu den Füßen reichen (Lücke zwischen den Beinen). Augen, Brillengläser
    und breite weiße Flächen wie eine Schürze bleiben erhalten."""
    px = teil.load()
    y0 = round(teil.height * ab)
    kand = Image.new("L", teil.size, 0)
    kp = kand.load()
    for y in range(y0, teil.height):
        for x in range(teil.width):
            r, g, b, a = px[x, y]
            if a > 200 and min(r, g, b) > 215 and max(r, g, b) - min(r, g, b) < 25:
                kp[x, y] = 255
    alpha = teil.getchannel("A")
    while True:
        box = kand.getbbox()
        if not box:
            break
        # erstes Pixel des Kandidaten suchen und seine Fläche füllen
        x0, yy = next((x, box[1]) for x in range(box[0], box[2]) if kp[x, box[1]] == 255)
        ImageDraw.floodfill(kand, (x0, yy), 128)
        flaeche = kand.point(lambda v: 255 if v == 128 else 0)
        fx0, fy0, fx1, fy1 = flaeche.getbbox()
        b, h = fx1 - fx0, fy1 - fy0
        schmal_hoch = h >= 1.2 * b and b < teil.width * 0.3
        if flaeche.histogram()[255] >= 120 and schmal_hoch and fy1 > teil.height * 0.75:
            alpha.paste(0, (0, 0), flaeche)
        kand.paste(0, (0, 0), flaeche)
    teil.putalpha(alpha)
    return teil


def schneiden(eingabe: str, name: str) -> list[str]:
    bild = Image.open(eingabe).convert("RGB")
    tx, ty = _trenner(bild, "x"), _trenner(bild, "y")
    b, h = bild.size
    felder = [(0, 0, tx, ty), (tx, 0, b, ty), (0, ty, tx, h), (tx, ty, b, h)]
    ziel = os.path.join(ZIEL_DIR, name)
    os.makedirs(ziel, exist_ok=True)
    pfade = []
    for geste, feld in zip(GESTEN, felder):
        teil = teilwerk.freistellen(bild.crop(feld), toleranz=30, inseln=False)
        # Papierkrümel am Rand (fast weiß, kaum Farbe) entfernen
        px = teil.load()
        for y in range(teil.height):
            for x in range(teil.width):
                r, g, b, a = px[x, y]
                if a and min(r, g, b) > 205 and max(r, g, b) - min(r, g, b) < 18:
                    nachbar_leer = any(0 <= x + dx < teil.width and 0 <= y + dy < teil.height
                                       and px[x + dx, y + dy][3] == 0
                                       for dx, dy in ((-2, 0), (2, 0), (0, -2), (0, 2)))
                    if nachbar_leer:
                        px[x, y] = (r, g, b, 0)
        teil = teil.crop(teil.getchannel("A").point(lambda a: 255 if a > 16 else 0).getbbox())
        teil = beine_frei(teil)
        pfad = os.path.join(ziel, f"{geste}.png")
        teil.save(pfad)
        pfade.append(pfad)
        print(f"{os.path.relpath(pfad)}: {teil.width}×{teil.height} px")
    return pfade


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    schneiden(sys.argv[1], sys.argv[2])

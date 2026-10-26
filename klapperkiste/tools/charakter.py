"""Figurenbogen (2 × 2 Gesten) in einzelne, freigestellte Gesten schneiden.

Die Trennlinien werden an den hellsten Zeilen und Spalten nahe der Bildmitte
gesucht, danach wird jede Geste freigestellt und auf die Figur zugeschnitten.

Reihenfolge der Gesten: 1 hallo (oben links), 2 nachdenken (oben rechts),
3 auftrag (unten links), 4 juhu (unten rechts).

Aufruf:
  python klapperkiste/tools/charakter.py EINGABE NAME [--arme]
  --arme: auch weiße Lücken zwischen Arm und Körper entfernen (nicht bei weißer Kleidung)
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


def beine_frei(teil: Image.Image, ab: float = 0.5, arme: bool = False) -> Image.Image:
    """Eingeschlossenes Papierweiß zwischen den Beinen entfernen.

    Gesucht wird nur in der unteren Hälfte, und entfernt werden nur weiße Flächen,
    die hoch und schmal sind und bis zu den Füßen reichen (Lücke zwischen den
    Beinen). Augen, Brillengläser und breite weiße Flächen wie eine Schürze
    bleiben erhalten.

    Mit arme=True werden auch Lücken zwischen Arm und Körper entfernt: ab einem
    Viertel der Höhe jede eingeschlossene weiße Fläche, darüber nur seitlich
    neben dem Kopf. Nur bei Figuren mit kleinem Kopf oben und ohne weiße
    Kleidung verwenden (z. B. Brösel), sonst gehen Augen oder Zähne verloren."""
    if arme:
        ab = 0.1
    px = teil.load()
    y0 = round(teil.height * ab)
    kand = Image.new("L", teil.size, 0)
    kp = kand.load()
    for y in range(y0, teil.height):
        for x in range(teil.width):
            r, g, b, a = px[x, y]
            hell, grau = (198, 32) if arme else (215, 25)
            if a > 200 and min(r, g, b) > hell and max(r, g, b) - min(r, g, b) < grau:
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
        mitte_x = (fx0 + fx1) / 2 / teil.width
        seitlich = mitte_x < 0.33 or mitte_x > 0.66  # neben dem Kopf, nicht Augen oder Zähne
        arm_luecke = arme and (fy0 >= teil.height * 0.25 or seitlich)
        if flaeche.histogram()[255] >= 60 and (arm_luecke or schmal_hoch and fy1 > teil.height * 0.75):
            alpha.paste(0, (0, 0), flaeche)
        kand.paste(0, (0, 0), flaeche)
    teil.putalpha(alpha)
    return teil


def schneiden(eingabe: str, name: str, arme: bool = False) -> list[str]:
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
        teil = beine_frei(teil, arme=arme)
        pfad = os.path.join(ziel, f"{geste}.png")
        teil.save(pfad)
        pfade.append(pfad)
        print(f"{os.path.relpath(pfad)}: {teil.width}×{teil.height} px")
    return pfade


if __name__ == "__main__":
    argumente = [a for a in sys.argv[1:] if a != "--arme"]
    if len(argumente) != 2:
        print(__doc__)
        sys.exit(1)
    schneiden(argumente[0], argumente[1], arme="--arme" in sys.argv)

"""Einmalige Bearbeitung: Marktplatz mit mehr Platz um den Brunnen und weichen Straßenenden.

1. Der Brotstand unten rechts versperrt die Durchfahrt um den Brunnen. Er wird mit Pflaster aus
   einer freien Stelle des Platzes übermalt (weich überblendet).
2. Danach wird der Platz mit objekt.py auf 36 m eingepasst (vorher 30 m).
3. Die Pflasterstraßen links und rechts laufen über 2,2 m weich in den Erdweg aus (Alpha-Rampe),
   statt mit einer harten Kante aufzuhören.

Aufruf (aus dem Repo-Wurzelordner):
  python klapperkiste/tools/einmalig/marktplatz_platz.py
"""

from __future__ import annotations

import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ROH = os.path.join(ROOT, "assets", "karte", "objekte", "roh")
ZIEL = os.path.join(ROOT, "assets", "karte", "objekte", "marktplatz.png")
STAND = (785, 478, 1042, 714)      # Brotstand mit Schatten (Pixel im Rohbild), innerhalb der Platzkante
QUELLE = (740, 318, 1030, 478)     # freie Pflasterfläche rechts vom Brunnen
METER = 36
RAMPE_M = 2.2                      # weicher Auslauf der Straßen
STRASSE = (0.43, 0.67)             # Höhe der Pflasterstraßen im Bild (Anteil)


def stand_weg(bild: Image.Image) -> Image.Image:
    x0, y0, x1, y1 = STAND
    w, h = x1 - x0, y1 - y0
    flicken = Image.new("RGB", (w, h))
    q = bild.crop(QUELLE)
    for yy in range(0, h, q.height - 30):
        flicken.paste(q.crop((0, 0, min(q.width, w), min(q.height, h - yy))), (0, yy))
        if q.width < w:
            flicken.paste(q.crop((0, 0, w - q.width, min(q.height, h - yy))), (q.width, yy))
    # der Bereich liegt ganz innerhalb der Platzkante: alles ersetzen, Rand weich überblenden
    maske = Image.new("L", (w, h), 0)
    ImageDraw.Draw(maske).rectangle((10, 10, w - 10, h - 10), fill=255)
    maske = maske.filter(ImageFilter.GaussianBlur(6))
    alt = bild.crop(STAND)
    alt.paste(flicken, (0, 0), maske)
    bild.paste(alt, (x0, y0))
    return bild


def strassen_weich(pfad: str) -> None:
    bild = Image.open(pfad).convert("RGBA")
    px, w, h = bild.load(), bild.width, bild.height
    rampe = round(RAMPE_M * 32)
    y0, y1 = round(h * STRASSE[0]), round(h * STRASSE[1])
    for y in range(y0, y1):
        for i in range(rampe):
            f = (i + 0.5) / rampe
            f = f * f * (3 - 2 * f)
            for x in (i, w - 1 - i):
                r, g, b, a = px[x, y]
                px[x, y] = (r, g, b, round(a * f))
    bild.save(pfad)


def main() -> int:
    bild = stand_weg(Image.open(os.path.join(ROH, "marktplatz.jpg")).convert("RGB"))
    bearbeitet = os.path.join(ROH, "marktplatz_ohne_brotstand.png")
    bild.save(bearbeitet)
    werk = os.path.join(ROOT, "tools", "objekt.py")
    subprocess.run([sys.executable, werk, "einpassen", bearbeitet, "marktplatz", "--meter", str(METER)], check=True)
    strassen_weich(ZIEL)
    return 0


if __name__ == "__main__":
    sys.exit(main())

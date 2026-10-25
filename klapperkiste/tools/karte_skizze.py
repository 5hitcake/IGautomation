"""Übersichtsskizze der ganzen Karte (Endausbau 32 × 32 Abschnitte à 64 m).

Zeichnet Regionen, Seen, Hauptstraßen und Orte grob ins Raster. Dient nur der
Planung (Schritt K1), die echte Karte entsteht Abschnitt für Abschnitt.

Aufruf:
  python klapperkiste/tools/karte_skizze.py [ausgabe.png]
"""

from __future__ import annotations

import os
import sys

from PIL import Image, ImageDraw, ImageFont

N = 32          # Abschnitte pro Seite
Z = 32          # Pixel pro Abschnitt in der Skizze
RAND = 40
RECHTS = 120     # Platz für Beschriftungen am rechten Rand

# Regionen als Rechtecke in Abschnitten (x0, y0, x1, y1), Norden oben
REGIONEN = [
    ("Berge", (0, 0, 32, 8), (176, 168, 156)),
    ("Frostpass", (20, 0, 32, 5), (232, 240, 246)),
    ("Wald", (0, 8, 12, 20), (92, 140, 84)),
    ("Weite Ebene", (22, 8, 32, 18), (222, 200, 140)),
    ("Felder", (12, 8, 22, 18), (176, 204, 110)),
    ("Kirmesplatz", (22, 18, 32, 24), (214, 170, 210)),
    ("Dorf", (12, 18, 22, 26), (226, 196, 160)),
    ("Start", (12, 26, 22, 32), (200, 190, 176)),
    ("Ufer", (0, 20, 12, 32), (150, 196, 140)),
    ("Ufer Ost", (22, 24, 32, 32), (150, 196, 140)),
]
SEEN = [((1, 22, 10, 31), [(4, 26)]), ((23, 25, 31, 31), [(27, 28)])]
FLUSS = [(9, 20), (11, 17), (14, 15), (18, 14), (21, 12), (24, 9)]
STRASSEN = [
    [(17, 31), (17, 27), (16, 22), (17, 17), (17, 12), (19, 8), (24, 4), (28, 2)],   # Nord-Süd
    [(4, 14), (9, 15), (13, 16), (17, 17)],                                         # in den Wald
    [(17, 21), (22, 20), (27, 21)],                                                 # zur Kirmes
    [(17, 13), (22, 13), (30, 12)],                                                 # weite Ebene
    [(16, 24), (11, 25), (10, 27)],                                                 # zum Hafen West
    [(19, 25), (23, 25)],                                                           # zum Strand Ost
]
ORTE = [
    ("Opas Schuppen", (17, 30), "Start"), ("Schrottplatz", (19, 28), ""),
    ("Werkstatt", (16, 23), ""), ("Eisdiele", (18, 21), ""), ("Bank", (14, 21), ""),
    ("Feuerwache", (20, 24), ""), ("Bauernhof", (14, 12), "Schafe"), ("Mühle", (20, 10), ""),
    ("Gärtnerei", (19, 16), ""), ("Försterhütte", (5, 12), "dunkel"), ("Campingplatz", (3, 17), ""),
    ("Kieswerk", (8, 18), ""), ("Brücke kaputt", (17, 14), "Beton"), ("Furt", (21, 12), "Wasser"),
    ("Zirkus", (26, 21), ""), ("Fußballplatz", (29, 22), ""), ("Hafen", (10, 26), ""),
    ("Strand", (24, 25), ""), ("Insel", (4, 26), "Boot"), ("Insel", (27, 28), "Boot"),
    ("Tankstelle", (30, 12), "weit"), ("Steinbruch", (6, 4), "Steigung"), ("Bergwerk", (12, 2), ""),
    ("Schloss", (17, 5), ""), ("Frostpass", (27, 2), "Schnee"),
]


def _schrift(groesse: int) -> ImageFont.ImageFont:
    for pfad in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "DejaVuSans-Bold.ttf"):
        try:
            return ImageFont.truetype(pfad, groesse)
        except OSError:
            continue
    return ImageFont.load_default()


def zeichnen() -> Image.Image:
    groesse = N * Z + 2 * RAND
    bild = Image.new("RGB", (groesse + RECHTS, groesse), (250, 247, 240))
    d = ImageDraw.Draw(bild)
    p = lambda x, y: (RAND + x * Z, RAND + y * Z)  # noqa: E731
    for name, (x0, y0, x1, y1), farbe in REGIONEN:
        d.rectangle((*p(x0, y0), *p(x1, y1)), fill=farbe)
    for (x0, y0, x1, y1), _ in SEEN:
        d.ellipse((*p(x0, y0), *p(x1, y1)), fill=(96, 160, 214), outline=(40, 70, 110), width=4)
    for _, inseln in SEEN:
        for ix, iy in inseln:
            d.ellipse((*p(ix - 1, iy - 1), *p(ix + 1, iy + 1)), fill=(214, 200, 150),
                      outline=(40, 40, 40), width=3)
    d.line([p(x, y) for x, y in FLUSS], fill=(96, 160, 214), width=14, joint="curve")
    for weg in STRASSEN:
        d.line([p(x, y) for x, y in weg], fill=(60, 50, 40), width=9, joint="curve")
        d.line([p(x, y) for x, y in weg], fill=(240, 220, 170), width=4, joint="curve")
    # Raster
    for i in range(N + 1):
        farbe = (120, 110, 100) if i % 8 == 0 else (200, 192, 180)
        d.line((*p(i, 0), *p(i, N)), fill=farbe, width=1)
        d.line((*p(0, i), *p(N, i)), fill=farbe, width=1)
    klein, mittel, gross = _schrift(14), _schrift(17), _schrift(22)
    for name, (x0, y0, x1, y1), _ in REGIONEN:
        if name.startswith("Ufer"):
            continue
        d.text((p(x0, y0)[0] + 8, p(x0, y0)[1] + 6), name.upper(), fill=(60, 50, 40), font=gross)
    for name, (x, y), hinweis in ORTE:
        cx, cy = p(x + 0.5, y + 0.5)
        d.ellipse((cx - 9, cy - 9, cx + 9, cy + 9), fill=(242, 182, 50), outline=(30, 30, 30), width=3)
        d.text((cx + 12, cy - 11), name, fill=(20, 20, 20), font=mittel, stroke_width=3,
               stroke_fill=(255, 255, 255))
        if hinweis:
            d.text((cx + 12, cy + 7), hinweis, fill=(170, 40, 30), font=klein, stroke_width=2,
                   stroke_fill=(255, 255, 255))
    titel = "Klapperkiste · Übersicht Endausbau · 32 × 32 Abschnitte à 64 m = 2 × 2 km · Norden oben"
    d.text((RAND, 8), titel, fill=(40, 40, 40), font=mittel)
    for i, buchstabe in enumerate("ABCD"):
        spalte = f"{buchstabe} ({i * 8}–{i * 8 + 7})"
        d.text((RAND + i * 8 * Z + 4, groesse - RAND + 8), spalte, fill=(90, 80, 70), font=klein)
    return bild


def main(argv: list[str] | None = None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    ziel = argv[0] if argv else os.path.join(os.path.dirname(__file__), "..", "design", "karte_skizze.png")
    zeichnen().save(ziel)
    print(os.path.relpath(ziel))
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""Einmalige Bearbeitung: Bodenschatten aller Figuren schwarz statt weißgrau.

Unter den Füßen liegt bei allen Figuren eine helle, weißgraue Schraffur. Im untersten
Streifen werden helle, fast farblose Pixel dunkel gefärbt, wenn sie von außen
(von durchsichtigen Pixeln her) erreichbar sind oder kleine Inseln in der
Schraffur bilden. Helle Schuhe (Opas graue Schuhe, Zylindas weiße Gamaschen)
sind von ihrer dunklen Umrisslinie eingeschlossen und bleiben hell.
Förster Moos ist schon mit moos_schatten.py bearbeitet und wird übersprungen.
Neue Figuren bekommen den schwarzen Schatten schon beim Ausschneiden (charakter.py).

Aufruf:
  python klapperkiste/tools/einmalig/schatten_schwarz.py [--probe DATEI]
  --probe: nichts speichern, nur Füße aller Figuren nebeneinander in DATEI
"""

from __future__ import annotations

import os
import sys

from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from charakter import schatten_schwarz  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CH = os.path.join(ROOT, "assets", "charaktere")
AUSLASSEN = {"roh", "hintergrund", "moos"}


def main() -> int:
    probe = sys.argv[sys.argv.index("--probe") + 1] if "--probe" in sys.argv else None
    reihen = []
    for name in sorted(os.listdir(CH)):
        ordner = os.path.join(CH, name)
        if name in AUSLASSEN or not os.path.isdir(ordner):
            continue
        teile = []
        for datei in sorted(os.listdir(ordner)):
            if not datei.endswith(".png"):
                continue
            pfad = os.path.join(ordner, datei)
            bild = Image.open(pfad).convert("RGBA")
            n = schatten_schwarz(bild)
            print(f"{name}/{datei}: {n} px")
            if probe:
                k = bild.resize((round(bild.width * 640 / bild.height), 640))
                c = Image.new("RGB", k.size, (90, 120, 70))
                c.paste(k, (0, 0), k)
                teile.append(c.crop((0, 500, k.width, 640)))
            else:
                bild.save(pfad)
        if probe:
            reihe = Image.new("RGB", (sum(t.width for t in teile), 140))
            x = 0
            for t in teile:
                reihe.paste(t, (x, 0))
                x += t.width
            reihen.append(reihe)
    if probe:
        bogen = Image.new("RGB", (max(r.width for r in reihen), 140 * len(reihen)), "white")
        for i, r in enumerate(reihen):
            bogen.paste(r, (0, 140 * i))
        bogen.save(probe)
    return 0


if __name__ == "__main__":
    sys.exit(main())

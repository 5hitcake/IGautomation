"""Einmalige Bearbeitung: Opas Schuppen (Ort, 14 m breit) für die Karte.

Freistellen, auf das Bild zuschneiden, auf 14 m (448 px) bringen und die
weißen Reste am auslaufenden Weg unten entfernen. Die Maße für Haus, Hofzaun
und Tor in design/kartenprobe.html sind aus diesem Bild vermessen.

Aufruf:
  python klapperkiste/tools/einmalig/schuppen_einpassen.py
"""

from __future__ import annotations

import os
import sys

from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import objekt  # noqa: E402
import teilwerk  # noqa: E402


def main() -> int:
    f = teilwerk.freistellen(Image.open(os.path.join(objekt.OBJEKT_DIR, "roh", "schuppen.jpg")), inseln=False)
    f = f.crop((34, 16, 758, 1159))
    f = f.resize((14 * 32, round(f.height * 14 * 32 / f.width)), Image.LANCZOS)
    px = f.load()
    for y in range(f.height * 3 // 4, f.height):
        for x in range(f.width):
            r, g, b, a = px[x, y]
            if a and min(r, g, b) > 175 and max(r, g, b) - min(r, g, b) < 40:
                px[x, y] = (r, g, b, 0)
    ziel = os.path.join(objekt.OBJEKT_DIR, "schuppen.png")
    f.save(ziel)
    print(os.path.relpath(ziel), f.size)
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""Einmalige Bearbeitung: Seitenansicht des Donnerkeil-Lenkrads umdrehen.

Im generierten Blatt zeigt das Lenkrad nach vorne (Säule unten hinten, Kranz oben vorne).
Die Seitenansicht wird gespiegelt, damit der Kranz zum Fahrer zeigt und die Säule
nach vorne unten läuft, und um 25° aufgerichtet, damit sie nicht so schräg steht.

Aufruf (aus dem Repo-Wurzelordner):
  python klapperkiste/tools/einmalig/lenkrad_drehen.py
"""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile

from PIL import Image, ImageOps

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ORDNER = os.path.join(ROOT, "assets", "teile", "donnerkeillenkrad")
OBEN_HAELFTE = (450, 0, 900, 385)   # Seitenansicht im Rohblatt
WINKEL = 25


def main() -> int:
    roh = Image.open(os.path.join(ORDNER, "blatt_roh.jpg")).convert("RGB")
    seite = ImageOps.mirror(roh.crop(OBEN_HAELFTE))
    seite = seite.rotate(-WINKEL, expand=True, fillcolor=(255, 255, 255), resample=Image.BICUBIC)
    with tempfile.TemporaryDirectory() as tmp:
        pfad = os.path.join(tmp, "seite_roh.png")
        seite.save(pfad)
        werk = os.path.join(ROOT, "tools", "teilwerk.py")
        subprocess.run([sys.executable, werk, "einpassen", pfad, "lenkung", "seite",
                        os.path.join(ORDNER, "seite.png")], check=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())

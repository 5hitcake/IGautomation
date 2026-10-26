"""Einmalige Bearbeitung: Bauernhof von oben freistellen.

Zwischen Zaun, Gebäuden und Gemüsegarten liegen weiße Flächen, die vom Bildrand
aus nicht erreichbar sind, und ein grauer Schlagschatten der Scheune. Große
weiße Flächen (keine Glanzlichter, keine Hühner) und der von dort erreichbare
graue Schatten werden durchsichtig, dort scheint im Spiel das Gras durch.

Aufruf:
  python klapperkiste/tools/einmalig/bauernhof_einpassen.py
"""

from __future__ import annotations

import os
import sys

from PIL import Image, ImageChops, ImageDraw

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import objekt  # noqa: E402
import teilwerk  # noqa: E402

ROH = os.path.join(objekt.OBJEKT_DIR, "roh", "bauernhof.jpg")
METER = 32
MIN_FLAECHE = 1500  # kleinere weiße Flächen sind Hühner und Glanzlichter


def grosse_weisse_flaechen_weg(bild: Image.Image) -> Image.Image:
    weiss = bild.convert("RGB").point(lambda v: 255 if v > 225 else 0).convert("L")
    weiss = ImageChops.darker(ImageChops.darker(*[bild.getchannel(k).point(lambda v: 255 if v > 225 else 0)
                                                  for k in "RG"]), bild.getchannel("B").point(lambda v: 255 if v > 225 else 0))
    weiss = ImageChops.multiply(weiss, bild.getchannel("A").point(lambda v: 255 if v > 128 else 0))
    weg = Image.new("L", bild.size, 0)
    arbeit = weiss.copy()
    while True:
        box = arbeit.getbbox()
        if not box:
            break
        x0, y0, x1, y1 = box
        start = next(((x, y0) for x in range(x0, x1) if arbeit.getpixel((x, y0)) == 255), None)
        if start is None:
            break
        ImageDraw.floodfill(arbeit, start, 128, thresh=0)
        flaeche = arbeit.point(lambda v: 255 if v == 128 else 0)
        if flaeche.histogram()[255] >= MIN_FLAECHE:
            weg = ImageChops.lighter(weg, flaeche)
        arbeit = ImageChops.subtract(arbeit, arbeit.point(lambda v: 128 if v == 128 else 0))
    bild.putalpha(ImageChops.subtract(bild.getchannel("A"), weg))
    return bild


def schatten_weg(bild: Image.Image) -> Image.Image:
    """Grauen Schatten entfernen, der an irgendeine durchsichtige Fläche grenzt (auch
    an die inneren, vom Zaun umschlossenen), ohne eine schwarze Kontur zu kreuzen."""
    hsv = bild.convert("RGB").convert("HSV")
    grau = ImageChops.multiply(hsv.getchannel("S").point(lambda v: 255 if v < 40 else 0),
                               hsv.getchannel("V").point(lambda v: 255 if v > 120 else 0))
    durch = bild.getchannel("A").point(lambda v: 255 if v < 128 else 0)
    arbeit = ImageChops.lighter(grau, durch)
    while True:
        offen = ImageChops.multiply(arbeit.point(lambda v: 255 if v == 255 else 0), durch)
        box = offen.getbbox()
        if not box:
            break
        x0, y0, x1, y1 = box
        start = next((x, y0) for x in range(x0, x1) if offen.getpixel((x, y0)) == 255)
        ImageDraw.floodfill(arbeit, start, 128, thresh=0)
    weg = arbeit.point(lambda v: 255 if v == 128 else 0)
    bild.putalpha(ImageChops.subtract(bild.getchannel("A"), weg))
    return bild


def main() -> int:
    bild = teilwerk.freistellen(Image.open(ROH), inseln=False)
    bild = schatten_weg(grosse_weisse_flaechen_weg(bild))
    bild = bild.crop(bild.getchannel("A").point(lambda a: 255 if a > 16 else 0).getbbox())
    breite = METER * objekt.PX
    bild = bild.resize((breite, round(bild.height * breite / bild.width)), Image.LANCZOS)
    ziel = os.path.join(objekt.OBJEKT_DIR, "bauernhof.png")
    bild.save(ziel)
    print(f"{os.path.relpath(ziel)}: {bild.width}×{bild.height} px = {METER} m breit")
    return 0


if __name__ == "__main__":
    sys.exit(main())

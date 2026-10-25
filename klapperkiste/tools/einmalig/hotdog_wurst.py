"""Einmalige Bearbeitung: Hot-Dog-Kastenwagen mit möglichst großer Dach-Wurst.

Die Wurst wird in Seite und Draufsicht ausgeschnitten und vergrößert. Damit sie
in die 5 Zellen hohe Karosserie-Box passt, wird der Kasten darunter in der
Seitenansicht etwas gestaucht. Danach wird die Karosserie wie jede andere mit
`teilwerk.karosserie_schneiden` in hinten, Mitte und vorne geteilt.

Aufruf:
  python klapperkiste/tools/einmalig/hotdog_wurst.py
"""

from __future__ import annotations

import os
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import teilwerk  # noqa: E402

ROH = os.path.join(teilwerk.TEILE_DIR, "hotdog-roh")
WEISS = (255, 255, 255)
CREME = (240, 232, 205)  # Dachfarbe in der Draufsicht

# Maße im Originalbild (1024 x 1536), vermessen
DACH_Y = 265                    # Dachkante der Seitenansicht
SEITE_UNTEN = 640               # unter der Karosserie (Seite)
WURST_SEITE = (230, 120, 720)   # x0, y0, x1 der Dach-Wurst (bis DACH_Y)
WURST_OBEN = (205, 958, 700, 1196)  # Rahmen der Wurst in der Draufsicht
FUGE_X = range(292, 302)        # Blechfuge im Dach, läuft unter der Wurst durch
STAUCHEN = 0.8                  # Kasten in der Seitenansicht auf 80 % Höhe


def _aus_weiss(teil: Image.Image) -> Image.Image:
    """Weißer Hintergrund -> transparent (nur von den Rändern her)."""
    return teilwerk.freistellen(teil, toleranz=40, inseln=False)


def _wurst_oben(original: Image.Image) -> tuple[Image.Image, tuple[int, int]]:
    """Wurst aus der Draufsicht: alles, was sich deutlich von der Dachfarbe abhebt,
    ohne die Blechfuge außerhalb der Wurst."""
    x0, y0, x1, y1 = WURST_OBEN
    feld = original.crop(WURST_OBEN).convert("RGB")
    abstand = ImageChops.difference(feld, Image.new("RGB", feld.size, CREME)).convert("L")
    maske = abstand.point(lambda v: 255 if v > 70 else 0)
    px = maske.load()
    for x in FUGE_X:
        for y in list(range(0, 1020 - y0)) + list(range(1160 - y0, y1 - y0)):
            if 0 <= x - x0 < feld.width and 0 <= y < feld.height:
                px[x - x0, y] = 0
    # Löcher (helle Brötchenstellen) schließen: alles, was nicht von außen erreichbar ist, gehört dazu
    rand = Image.new("L", (feld.width + 2, feld.height + 2), 0)
    rand.paste(maske.filter(ImageFilter.MaxFilter(11)), (1, 1))  # Lücken im Umriss schließen
    ImageDraw.floodfill(rand, (0, 0), 128, thresh=0)
    maske = rand.crop((1, 1, feld.width + 1, feld.height + 1)).point(lambda v: 0 if v == 128 else 255)
    maske = maske.filter(ImageFilter.MinFilter(11))
    wurst = feld.convert("RGBA")
    wurst.putalpha(maske)
    return wurst.crop(maske.getbbox()), (x0 + maske.getbbox()[0], y0 + maske.getbbox()[1])


def bearbeiten(original: Image.Image) -> tuple[Image.Image, float]:
    original = original.convert("RGB")
    breite = original.width
    raster = teilwerk.lade_raster()
    z = raster["zelle_px"]
    box_hoehe = raster["karosserie"]["unterkante_y"] * z

    # --- Seite ---------------------------------------------------------------
    wx0, wy0, wx1 = WURST_SEITE
    wurst = _aus_weiss(original.crop((wx0, wy0, wx1, DACH_Y)))
    wurst = wurst.crop(wurst.getchannel("A").getbbox())
    wurst_mitte_x = wx0 + (wurst.width / 2)

    kasten = original.crop((0, DACH_Y - 20, breite, SEITE_UNTEN)).copy()
    # Klammern der Wurst über dem Dach entfernen, Begrenzungsleuchten der Kabine bleiben
    kasten.paste(WEISS, (0, 0, 820, 20))
    kasten = kasten.resize((breite, round(kasten.height * STAUCHEN)), Image.LANCZOS)

    # Maßstab, den der Schneider später anwendet: Karosserie-Länge -> 10 Zellen
    a = _aus_weiss(kasten).getchannel("A").point(lambda v: 255 if v > 16 else 0)
    lx0, _, lx1, _ = a.getbbox()
    massstab = raster["seite"]["breite"] * z / (lx1 - lx0)
    # Wurst so groß, dass Kasten + Wurst die Box genau füllen (2 px Luft)
    platz = (box_hoehe - 2) / massstab - (kasten.height - 20 * STAUCHEN)
    faktor = platz / wurst.height
    gross = wurst.resize((round(wurst.width * faktor), round(wurst.height * faktor)), Image.LANCZOS)

    seite = Image.new("RGB", (breite, gross.height + kasten.height + 40), WEISS)
    seite.paste(kasten, (0, seite.height - kasten.height - 20))
    dach = seite.height - kasten.height - 20 + round(20 * STAUCHEN)
    seite.paste(gross, (round(wurst_mitte_x - gross.width / 2), dach - gross.height + 4), gross)

    # --- Draufsicht ----------------------------------------------------------
    oben = original.crop((0, 700, breite, original.height)).copy()
    w_oben, (ox, oy) = _wurst_oben(original)
    # alte Wurst samt Klammern und Schatten übermalen, die Blechfuge bleibt
    x0, y0, x1, y1 = WURST_OBEN
    oben.paste(CREME, (x0, y0 - 700, x1, y1 - 700))
    fuge = (FUGE_X.start, y0, FUGE_X.stop, y1)
    oben.paste(original.crop(fuge), (fuge[0], y0 - 700))
    mitte = (ox + w_oben.width / 2, oy - 700 + w_oben.height / 2)
    g_oben = w_oben.resize((round(w_oben.width * faktor), round(w_oben.height * faktor)), Image.LANCZOS)
    oben.paste(g_oben, (round(mitte[0] - g_oben.width / 2), round(mitte[1] - g_oben.height / 2)), g_oben)

    blatt = Image.new("RGB", (breite, seite.height + 160 + oben.height), WEISS)
    blatt.paste(seite, (0, 0))
    blatt.paste(oben, (0, seite.height + 160))
    return blatt, faktor


def main() -> int:
    original = Image.open(os.path.join(ROH, "hotdog_blatt_original.png"))
    blatt, faktor = bearbeiten(original)
    ziel = os.path.join(ROH, "hotdog_blatt.png")
    blatt.save(ziel)
    print(f"{os.path.relpath(ziel)}: Wurst {faktor:.2f}-fach, Kasten auf {STAUCHEN:.0%} Höhe")
    return 0


if __name__ == "__main__":
    sys.exit(main())

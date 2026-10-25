"""Einmalige Bearbeitung: Weinfass-Karosserie, Heckfass liegt auf der Ladefläche.

Im gelieferten Bild steht das hintere Fass neben dem Holzbalken und ragt über
das Heck hinaus. Der Balken wird bis ans Heck verlängert und das Fass auf ihn
gehoben. Der vom Balken verdeckte Teil des Fasses wird aus der gespiegelten
oberen Hälfte ergänzt. In der Draufsicht liegt das Heckfass schon auf der ganzen
Breite. Dort war die Kabine aber ein eckiger Kasten, obwohl sie in der
Seitenansicht ein stehendes Fass ist: Sie wird als runder Fassdeckel von oben
neu gezeichnet (Bretter, Eisenreifen außen).

Aufruf (danach kabine_mitte.py für die Kabine):
  python klapperkiste/tools/einmalig/weinfass_ladeflaeche.py
"""

from __future__ import annotations

import os
import sys

from PIL import Image, ImageChops, ImageDraw

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import teilwerk  # noqa: E402

ROH = os.path.join(teilwerk.TEILE_DIR, "weinfass-roh")
WEISS, SCHWARZ = (255, 255, 255), (25, 18, 12)

# Maße im Originalbild (1408 x 768), vermessen
FASS = (50, 140, 425, 366)        # Heckfass samt Zapfhahn (und vorderem Balkenende)
BALKEN_VORNE = [(226, 366), (228, 318), (246, 286), (276, 262), (318, 246), (360, 240),
                (398, 236), (398, 140), (425, 140), (425, 366)]  # Balkenende vor dem Fass und rechts daneben
FASS_RECHTS = 398                 # rechte Kante des Fasses
FASS_MITTE_Y = 256                # waagerechte Mittellinie des Fasses
BALKEN_MUSTER = (480, 232, 552, 366)  # sauberes Balkenstück vor der Kabine
BALKEN_START, BALKEN_ENDE = 96, 472   # neuer Balken von hier bis zum Eisenband
BALKEN_OBEN = 247                 # Oberkante des Balkens
KABINE_OBEN = (537, 452, 937, 721)    # Draufsicht: Kasten der Kabine -> Fassdeckel
PLANKEN = (945, 452, 1075, 722)       # Draufsicht: Planken rechts neben der Kabine
EISEN = (96, 92, 88)
HOLZ, HOLZ_DUNKEL, HOLZ_HELL = (214, 150, 62), (190, 125, 48), (245, 200, 120)


def _maske_fass(feld: Image.Image) -> Image.Image:
    """Alles Nicht-Weiße im Fassrahmen, ohne das vordere Balkenende."""
    grau = ImageChops.difference(feld, Image.new("RGB", feld.size, WEISS)).convert("L")
    maske = grau.point(lambda v: 255 if v > 30 else 0)
    x0, y0 = FASS[:2]
    ImageDraw.Draw(maske).polygon([(x - x0, y - y0) for x, y in BALKEN_VORNE], fill=0)
    return maske


def bearbeiten(original: Image.Image) -> Image.Image:
    bild = original.convert("RGB").copy()
    x0, y0, x1, y1 = FASS
    feld = bild.crop(FASS)
    maske = _maske_fass(feld)

    # Verdeckten Teil unten rechts aus der oberen Hälfte spiegeln
    fpx, mpx = feld.load(), maske.load()
    alt_f, alt_m = feld.copy().load(), maske.copy().load()
    balken = Image.new("L", feld.size, 0)
    ImageDraw.Draw(balken).polygon([(x - x0, y - y0) for x, y in BALKEN_VORNE], fill=255)
    bpx = balken.load()
    mitte = FASS_MITTE_Y - y0
    for y in range(1, feld.height):
        sy = 2 * mitte - y
        for x in range(min(feld.width, FASS_RECHTS - x0)):
            if not bpx[x, y] or sy < 0:
                continue
            if y >= mitte and not bpx[x, sy]:
                if alt_m[x, sy]:
                    mpx[x, y] = 255
                    fpx[x, y] = alt_f[x, sy]
            elif mpx[x, y - 1]:
                mpx[x, y] = 255           # Spiegelbild auch verdeckt: von oben fortsetzen
                fpx[x, y] = fpx[x, y - 1]

    # Platz machen, Balken bis ans Heck kacheln
    d = ImageDraw.Draw(bild)
    d.rectangle((x0, y0, BALKEN_ENDE - 1, y1), fill=WEISS)
    muster = bild.crop(BALKEN_MUSTER)
    x = BALKEN_ENDE - muster.width
    while x > BALKEN_START - muster.width:
        bild.paste(muster, (x, BALKEN_MUSTER[1]))
        x -= muster.width
    d.rectangle((0, BALKEN_MUSTER[1], BALKEN_START - 1, y1), fill=WEISS)
    d.line([(BALKEN_START + 2, BALKEN_OBEN), (BALKEN_START + 2, 362)], fill=SCHWARZ, width=5)

    # Fass auf den Balken heben: Unterkante des Fasses auf die Balkenoberkante
    hoch = y1 - 6 - BALKEN_OBEN
    bild.paste(feld, (x0, y0 - hoch), maske)
    _deckel_oben(bild)
    return bild


def _deckel_oben(bild: Image.Image) -> None:
    """Draufsicht: Fasskabine als runder Deckel aus Brettern mit Eisenreifen."""
    k0, k1, k2, k3 = KABINE_OBEN
    flaeche = (k0 - 6, PLANKEN[1], k2 + 6, PLANKEN[3])
    bild.paste(bild.crop(PLANKEN).resize((flaeche[2] - flaeche[0], flaeche[3] - flaeche[1]), Image.LANCZOS),
               flaeche[:2])
    d = ImageDraw.Draw(bild)
    d.ellipse(KABINE_OBEN, fill=EISEN, outline=SCHWARZ, width=5)
    innen = (k0 + 18, k1 + 18, k2 - 18, k3 - 18)
    deckel = Image.new("RGB", (innen[2] - innen[0], innen[3] - innen[1]), HOLZ)
    dd = ImageDraw.Draw(deckel)
    for i, y in enumerate(range(0, deckel.height, 36)):
        if i % 2:
            dd.rectangle((0, y, deckel.width, y + 35), fill=HOLZ_DUNKEL)
        dd.line([(0, y), (deckel.width, y)], fill=SCHWARZ, width=3)
        for j in range(5):  # Maserung
            gx = (i * 97 + j * 71) % (deckel.width - 60)
            gy = y + 10 + (i * 7 + j * 11) % 18
            dd.line([(gx, gy), (gx + 30 + (j * 13) % 30, gy + 1)], fill=(150, 95, 40), width=2)
    rund = Image.new("L", deckel.size, 0)
    ImageDraw.Draw(rund).ellipse((0, 0, deckel.width - 1, deckel.height - 1), fill=255)
    bild.paste(deckel, innen[:2], rund)
    d.ellipse(innen, outline=SCHWARZ, width=4)
    flecken = Image.new("L", deckel.size, 0)  # Weinflecken wie an den anderen Fässern
    fleck = (deckel.width // 2, deckel.height * 2 // 3, deckel.width, deckel.height + 40)
    ImageDraw.Draw(flecken).ellipse(fleck, fill=90)
    bild.paste((140, 50, 60), innen[:2], ImageChops.multiply(flecken, rund))
    d.arc((innen[0] + 20, innen[1] + 14, innen[2] - 20, innen[3] - 14), 200, 260, fill=HOLZ_HELL, width=6)
    d.arc((k0 + 6, k1 + 6, k2 - 6, k3 - 6), 200, 250, fill=(170, 165, 160), width=4)  # Glanz auf dem Reifen


def main() -> int:
    original = Image.open(os.path.join(ROH, "weinfass_blatt_original.jpg"))
    ziel = os.path.join(ROH, "weinfass_blatt_fass.png")
    bearbeiten(original).save(ziel)
    print(f"{os.path.relpath(ziel)}: Heckfass liegt auf der Ladefläche, Fassdeckel in der Draufsicht")
    return 0


if __name__ == "__main__":
    sys.exit(main())

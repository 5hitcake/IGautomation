"""Werkzeug für Klapperkiste-Teile.

Drei Befehle:

  vorlagen   Raster-Vorlagen für jede Teile-Kategorie (Seite + Draufsicht) und
             den Gesamtplan des Autos erzeugen.
  einpassen  Ein generiertes oder gemaltes Bild freistellen, zuschneiden und
             exakt auf die Rastergröße seiner Kategorie bringen.
  bauen      Fertige Teile probeweise zu einem Auto zusammensetzen, um zu
             prüfen, ob alles zusammenpasst.
  blatt      Doppelbild mit Seitenansicht (oben) und Draufsicht (unten)
             trennen und beide Ansichten einpassen.
  karosserie Ganze Karosserie (Doppelbild) auf Norm bringen und an den
             Nähten in hinten, Mitte und vorne schneiden.
  geliefert  Lieferstand (alle Teile unter assets/teile/) für die
             Prompt-Liste in design/geliefert.js schreiben.

Beispiele:
  python klapperkiste/tools/teilwerk.py vorlagen
  python klapperkiste/tools/teilwerk.py einpassen roh.png motor seite motor_seite.png
  python klapperkiste/tools/teilwerk.py blatt roh_blatt.png maeher motor
  python klapperkiste/tools/teilwerk.py bauen seite auto.png rahmen=a.png motor=b.png radH=c.png
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import os
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFont

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
RASTER_PATH = os.path.join(ROOT, "assets", "raster.json")
VORLAGEN_DIR = os.path.join(ROOT, "assets", "vorlagen")

INK = (29, 39, 48, 255)
GRID = (201, 211, 214, 255)
KANTE = (224, 75, 58, 255)
PAPIER = (255, 255, 255, 255)

# Farben für Platzhalter im Gesamtplan
FARBEN = {
    "rahmen": (201, 138, 75), "rad": (38, 43, 48), "motor": (224, 75, 58),
    "energie": (47, 111, 176), "sitz": (47, 143, 136), "lenkung": (111, 143, 166),
    "vorderbau": (242, 182, 50), "vorne": (159, 215, 232), "heck": (140, 153, 163),
    "achse": (93, 78, 66), "licht": (255, 236, 150),
    "karosserie_hinten": (127, 207, 174), "karosserie_mitte": (127, 207, 174),
    "karosserie_vorne": (127, 207, 174),
}


def lade_raster(pfad: str = RASTER_PATH) -> dict:
    with open(pfad, encoding="utf-8") as f:
        return json.load(f)


def box_px(raster: dict, kategorie: str, ansicht: str) -> tuple[int, int]:
    """Größe einer Kategorie in Pixeln für 'seite' oder 'oben'."""
    b, h = raster["kategorien"][kategorie][ansicht]
    z = raster["zelle_px"]
    return b * z, h * z


SCHRIFTEN = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/Library/Fonts/Arial Unicode.ttf",
    "C:/Windows/Fonts/arial.ttf",
]


def _schrift(groesse: int) -> ImageFont.ImageFont:
    """Schrift mit Umlauten, Pfeil und Malzeichen; sonst die eingebaute."""
    for pfad in SCHRIFTEN:
        if os.path.exists(pfad):
            return ImageFont.truetype(pfad, groesse)
    return ImageFont.load_default(size=groesse)


# --- Freistellen und Einpassen ------------------------------------------------

def _farbmaske(rgb: Image.Image, farbe: tuple[int, int, int]) -> Image.Image:
    """L-Maske: 255, wo das Bild exakt diese Farbe hat."""
    kanaele = [k.point(lambda v, m=m: 255 if v == m else 0) for k, m in zip(rgb.split(), farbe)]
    return ImageChops.multiply(ImageChops.multiply(kanaele[0], kanaele[1]), kanaele[2])


def _erstes_pixel(maske: Image.Image) -> tuple[int, int] | None:
    rahmen = maske.getbbox()
    if not rahmen:
        return None
    x0, y0, x1, _ = rahmen
    zeile = maske.crop((x0, y0, x1, y0 + 1)).tobytes()
    return x0 + next(i for i, v in enumerate(zeile) if v), y0


def freistellen(bild: Image.Image, toleranz: int = 40, inseln: bool = True) -> Image.Image:
    """Macht den Hintergrund transparent.

    Hat das Bild schon Transparenz, bleibt es unverändert. Sonst wird von den
    vier Ecken aus die Hintergrundfarbe weggefüllt. Mit inseln=True werden
    zusätzlich eingeschlossene Hintergrund-Flächen mittlerer Größe entfernt
    (z. B. das Innere einer Seilschlaufe). Winzige Flächen (Glanzlichter) und
    sehr große (weiße Bauteile) bleiben erhalten.
    """
    bild = bild.convert("RGBA")
    if bild.getchannel("A").getextrema()[0] < 250:
        return bild
    rgb = bild.convert("RGB")
    markierung = (1, 254, 3)
    b, h = rgb.size
    grundfarbe = rgb.getpixel((0, 0))
    for ecke in [(0, 0), (b - 1, 0), (0, h - 1), (b - 1, h - 1)]:
        if rgb.getpixel(ecke) != markierung:
            ImageDraw.floodfill(rgb, ecke, markierung, thresh=toleranz)

    if inseln:
        pruefen, behalten = (254, 1, 252), (2, 3, 251)
        nah = ImageChops.difference(bild.convert("RGB"), Image.new("RGB", (b, h), grundfarbe))
        nah = nah.convert("L").point(lambda v: 255 if v <= toleranz // 2 else 0)
        kandidat = ImageChops.subtract(nah, _farbmaske(rgb, markierung))
        flaeche_min, flaeche_max = max(150, b * h // 2000), b * h // 25
        for _ in range(3000):
            start = _erstes_pixel(kandidat)
            if not start:
                break
            ImageDraw.floodfill(rgb, start, pruefen, thresh=toleranz)
            gebiet = _farbmaske(rgb, pruefen)
            kandidat = ImageChops.subtract(kandidat, gebiet)
            weg = flaeche_min <= gebiet.histogram()[255] <= flaeche_max
            ImageDraw.floodfill(rgb, start, markierung if weg else behalten, thresh=0)

    bild.putalpha(ImageChops.invert(_farbmaske(rgb, markierung)))
    return bild


def drehen(bild: Image.Image, grad: int) -> Image.Image:
    """Dreht gegen den Uhrzeigersinn um 0, 90, 180 oder 270 Grad (verlustfrei)."""
    schritte = {0: None, 90: Image.Transpose.ROTATE_90, 180: Image.Transpose.ROTATE_180,
                270: Image.Transpose.ROTATE_270}
    return bild.transpose(schritte[grad]) if schritte[grad] is not None else bild


def rot_entsaettigen(bild: Image.Image, abstand: int = 22) -> Image.Image:
    """Färbt deutlich rote Stellen grau (gleiche Helligkeit), z. B. einen Felgenrest
    in der Draufsicht eines Rads. Andere Farben bleiben unverändert."""
    bild = bild.convert("RGBA")
    r, g, b, a = bild.split()
    rot = ImageChops.subtract(r, ImageChops.lighter(g, b)).point(lambda v: 255 if v > abstand else 0)
    grau = bild.convert("L").convert("RGBA")
    grau.putalpha(a)
    return Image.composite(grau, bild, rot)


def _nabe_mittig(teil: Image.Image, ziel_b: int, ziel_h: int, anteil: float) -> Image.Image:
    """Setzt die Nabe (breiteste Stelle des Teils) genau in die Box-Mitte.

    Die Nabe wird auf `anteil` der Box-Breite skaliert, damit sie zur Radnabe
    passt. Was über die Box hinausragt, wird abgeschnitten.
    """
    alpha = teil.getchannel("A").point(lambda a: 255 if a > 16 else 0)
    breiten = []
    for y in range(teil.height):
        zeile = alpha.crop((0, y, teil.width, y + 1)).getbbox()
        breiten.append((zeile[2] - zeile[0]) if zeile else 0)
    breiteste = max(breiten)
    nabe = [y for y, b in enumerate(breiten) if b >= breiteste * 0.85]
    oben, unten = nabe[0], nabe[-1] + 1
    band = alpha.crop((0, oben, teil.width, unten)).getbbox()
    mitte_x, mitte_y = (band[0] + band[2]) / 2, (oben + unten) / 2
    massstab = ziel_b * anteil / breiteste
    groesse = (max(1, round(teil.width * massstab)), max(1, round(teil.height * massstab)))
    neu = teil.resize(groesse, Image.LANCZOS)
    fertig = Image.new("RGBA", (ziel_b, ziel_h), (0, 0, 0, 0))
    # paste statt alpha_composite: erlaubt negative Positionen (Überstand wird abgeschnitten)
    fertig.paste(neu, (round(ziel_b / 2 - mitte_x * massstab), round(ziel_h / 2 - mitte_y * massstab)), neu)
    return fertig


def einpassen(bild: Image.Image, raster: dict, kategorie: str, ansicht: str,
              toleranz: int = 40, inseln: bool = True,
              freigestellt: bool = False) -> tuple[Image.Image, list[str]]:
    """Stellt frei, schneidet zu und setzt das Teil exakt in seine Rasterbox.

    Gibt das fertige Bild und eine Liste von Hinweisen zurück (z. B. wenn das
    Seitenverhältnis stark von der Box abweicht).
    """
    kat = raster["kategorien"][kategorie]
    ziel_b, ziel_h = box_px(raster, kategorie, ansicht)
    anker_x, anker_y = kat["anker_seite" if ansicht == "seite" else "anker_oben"]

    teil = bild.convert("RGBA") if freigestellt else freistellen(bild, toleranz, inseln)
    rahmen = teil.getchannel("A").point(lambda a: 255 if a > 16 else 0).getbbox()
    if not rahmen:
        raise ValueError("Im Bild wurde kein Teil gefunden (alles transparent).")
    teil = teil.crop(rahmen)

    hinweise = []
    verh_teil = teil.width / teil.height
    verh_box = ziel_b / ziel_h
    abweichung = max(verh_teil, verh_box) / min(verh_teil, verh_box)
    if kat.get("nabe_mittig", {}).get(ansicht):
        return _nabe_mittig(teil, ziel_b, ziel_h, kat["nabe_mittig"][ansicht]), hinweise
    strecken = kat.get("strecken", {}).get(ansicht)
    if strecken == "breite":
        # Volle Länge ist Pflicht (z. B. Raddurchmesser), die Dicke bleibt wie gezeichnet
        neu_h = min(ziel_h, max(1, round(teil.height * ziel_b / teil.width)))
        fertig = Image.new("RGBA", (ziel_b, ziel_h), (0, 0, 0, 0))
        fertig.alpha_composite(teil.resize((ziel_b, neu_h), Image.LANCZOS), (0, (ziel_h - neu_h) // 2))
        return fertig, hinweise
    if strecken == "hoehe":
        # Volle Höhe ist Pflicht (z. B. Achse von Rad zu Rad), die Dicke bleibt wie gezeichnet
        neu_b = min(ziel_b, max(1, round(teil.width * ziel_h / teil.height)))
        fertig = Image.new("RGBA", (ziel_b, ziel_h), (0, 0, 0, 0))
        fertig.alpha_composite(teil.resize((neu_b, ziel_h), Image.LANCZOS), ((ziel_b - neu_b) // 2, 0))
        return fertig, hinweise
    if strecken == "voll":
        # Rahmen und Räder müssen ihre Box exakt füllen, sonst passen die Anschlüsse nicht
        if abweichung > 2.5:
            hinweise.append(
                f"Seitenverhältnis {verh_teil:.2f} muss stark auf {verh_box:.2f} gestreckt werden. "
                "Das Teil wirkt dadurch verzerrt."
            )
        return teil.resize((ziel_b, ziel_h), Image.LANCZOS), hinweise
    if abweichung > 1.35:
        hinweise.append(
            f"Seitenverhältnis {verh_teil:.2f} weicht stark von der Box ({verh_box:.2f}) ab. "
            "Das Teil füllt seine Box nicht ganz. Besser im passenden Format neu erzeugen."
        )

    massstab = min(ziel_b / teil.width, ziel_h / teil.height)
    neu = (max(1, round(teil.width * massstab)), max(1, round(teil.height * massstab)))
    teil = teil.resize(neu, Image.LANCZOS)

    x = {"links": 0, "mitte": (ziel_b - neu[0]) // 2, "rechts": ziel_b - neu[0]}[anker_x]
    y = {"oben": 0, "mitte": (ziel_h - neu[1]) // 2, "unten": ziel_h - neu[1]}[anker_y]
    fertig = Image.new("RGBA", (ziel_b, ziel_h), (0, 0, 0, 0))
    fertig.alpha_composite(teil, (x, y))
    return fertig, hinweise


def blatt_teilen(bild: Image.Image, toleranz: int = 40,
                 inseln: bool = True) -> tuple[Image.Image, Image.Image]:
    """Trennt ein Doppelbild: Seitenansicht oben, Draufsicht unten.

    Gesucht wird die breiteste leere Zeilenlücke zwischen den beiden Ansichten.
    Gibt (seite, oben) als freigestellte Bilder zurück.
    """
    teil = freistellen(bild, toleranz, inseln)
    alpha = teil.getchannel("A").point(lambda a: 255 if a > 16 else 0)
    zeilen = alpha.resize((1, alpha.height), Image.BOX).tobytes()
    belegt = [v > 0 for v in zeilen]
    if not any(belegt):
        raise ValueError("Im Bild wurde kein Teil gefunden (alles transparent).")
    erste = belegt.index(True)
    letzte = len(belegt) - 1 - belegt[::-1].index(True)
    beste, start = (0, 0), None
    for y in range(erste, letzte + 1):
        if not belegt[y] and start is None:
            start = y
        elif belegt[y] and start is not None:
            if y - start > beste[1] - beste[0]:
                beste = (start, y)
            start = None
    if beste[1] - beste[0] < 4:
        raise ValueError(
            "Keine Lücke zwischen den beiden Ansichten gefunden. Die Ansichten müssen "
            "übereinander stehen, mit etwas Weiß dazwischen."
        )
    mitte = (beste[0] + beste[1]) // 2
    return teil.crop((0, 0, teil.width, mitte)), teil.crop((0, mitte, teil.width, teil.height))


def kappen(teil: Image.Image, kante: str, prozent: float) -> Image.Image:
    """Schneidet vom freigestellten Teil an einer Kante einen Anteil ab, z. B.
    ungewollte Rollen unter einem Rahmen ('unten', 27). Prozent beziehen sich
    auf das zugeschnittene Teil, nicht auf das ganze Bild."""
    rahmen = teil.getchannel("A").point(lambda a: 255 if a > 16 else 0).getbbox()
    teil = teil.crop(rahmen) if rahmen else teil
    b, h = teil.size
    weg_x, weg_y = round(b * prozent / 100), round(h * prozent / 100)
    box = {"oben": (0, weg_y, b, h), "unten": (0, 0, b, h - weg_y),
           "links": (weg_x, 0, b, h), "rechts": (0, 0, b - weg_x, h)}[kante]
    return teil.crop(box)


def blatt_einpassen(bild: Image.Image, raster: dict, kategorie: str, toleranz: int = 40,
                    inseln: bool = True,
                    schnitte: list[tuple[str, str, float]] = ()) -> dict[str, tuple[Image.Image, list[str]]]:
    """Doppelbild teilen und beide Ansichten auf ihre Rastergröße bringen.

    schnitte: (ansicht, kante, prozent), z. B. ("seite", "unten", 27).
    """
    ansichten = dict(zip(("seite", "oben"), blatt_teilen(bild, toleranz, inseln)))
    for ansicht, kante, prozent in schnitte:
        ansichten[ansicht] = kappen(ansichten[ansicht], kante, prozent)
    return {a: einpassen(t, raster, kategorie, a, freigestellt=True) for a, t in ansichten.items()}


# --- Karosserie ----------------------------------------------------------------

KAROSSERIE_TEILE = ("hinten", "mitte", "vorne")


def _ausdehnung(alpha: Image.Image, x: int, halb: int = 4) -> tuple[int, int] | None:
    """Oberste und unterste deckende Zeile in einem schmalen Spaltenstreifen um x."""
    streifen = alpha.crop((max(0, x - halb), 0, min(alpha.width, x + halb + 1), alpha.height))
    rahmen = streifen.getbbox()
    return (rahmen[1], rahmen[3]) if rahmen else None


def _normieren(teil: Image.Image, laenge: int, ziel_hoehe: int, nahtstellen: list[int],
               soll: float) -> tuple[Image.Image, list[float]]:
    """Skaliert auf volle Länge und dann senkrecht so, dass die mittlere
    Ausdehnung an den Nähten `soll` Pixel beträgt. Gibt das Bild und die
    gemessenen Ausdehnungen an den Nähten (nach dem Skalieren) zurück."""
    alpha = teil.getchannel("A").point(lambda a: 255 if a > 16 else 0)
    teil = teil.crop(alpha.getbbox())
    erst = teil.resize((laenge, max(1, round(teil.height * laenge / teil.width))), Image.LANCZOS)
    a1 = erst.getchannel("A").point(lambda a: 255 if a > 16 else 0)
    masse = [e[1] - e[0] for e in (_ausdehnung(a1, x) for x in nahtstellen) if e]
    faktor = soll / (sum(masse) / len(masse)) if masse else 1.0
    neu = erst.resize((laenge, max(1, round(erst.height * faktor))), Image.LANCZOS)
    a2 = neu.getchannel("A").point(lambda a: 255 if a > 16 else 0)
    gemessen = [(e[1] - e[0]) if e else 0 for e in (_ausdehnung(a2, x) for x in nahtstellen)]
    return neu, gemessen


def karosserie_schneiden(bild: Image.Image, raster: dict, toleranz: int = 40,
                         inseln: bool = True) -> tuple[dict, list[str]]:
    """Ganze Karosserie (Doppelbild: Seite oben, Draufsicht unten) normieren
    und an den Nähten in hinten, Mitte und vorne schneiden.

    Gibt {teil: {"seite": bild, "oben": bild}} und Hinweise zurück.
    """
    k, z = raster["karosserie"], raster["zelle_px"]
    laenge = raster["seite"]["breite"] * z
    hoehe = k["unterkante_y"] * z
    naehte = [x * z for x in k["naehte_x"]]
    grenzen = [0, *naehte, laenge]
    seite, oben = blatt_teilen(bild, toleranz, inseln)
    hinweise = []

    # Seite: Gürtellinie auf Norm, Unterkante auf die Rahmenoberkante
    soll_seite = (k["unterkante_y"] - k["guertel_y"]) * z
    s_bild, s_mass = _normieren(seite, laenge, hoehe, naehte, soll_seite)
    if s_bild.height > hoehe:
        hinweise.append("Seitenansicht ist höher als 4 Zellen und wurde oben abgeschnitten.")
        s_bild = s_bild.crop((0, s_bild.height - hoehe, laenge, s_bild.height))
    s_fertig = Image.new("RGBA", (laenge, hoehe), (0, 0, 0, 0))
    s_fertig.alpha_composite(s_bild, (0, hoehe - s_bild.height))

    # Draufsicht: Breite an den Nähten auf Norm, mittig
    soll_oben = (k["breite_oben"][1] - k["breite_oben"][0]) * z
    o_bild, o_mass = _normieren(oben, laenge, hoehe, naehte, soll_oben)
    if o_bild.height > hoehe:
        rand = (o_bild.height - hoehe) // 2
        o_bild = o_bild.crop((0, rand, laenge, rand + hoehe))
        hinweise.append("Draufsicht ist breiter als das Auto und wurde oben und unten gekürzt.")
    o_fertig = Image.new("RGBA", (laenge, hoehe), (0, 0, 0, 0))
    o_fertig.alpha_composite(o_bild, (0, (hoehe - o_bild.height) // 2))

    for name, mass, soll in (("Seite", s_mass, soll_seite), ("Draufsicht", o_mass, soll_oben)):
        for x, m in zip(k["naehte_x"], mass):
            if abs(m - soll) > soll * 0.08:
                hinweise.append(
                    f"{name}: an der Naht bei x={x} ist die Karosserie {m / z:.2f} statt "
                    f"{soll / z:.2f} Zellen. Die Teile passen dort nicht ganz bündig zu anderen Modellen."
                )
    # Hinten und vorne sollen nicht höher als y=1 werden (nur die Mitte darf hoch hinaus)
    a = s_fertig.getchannel("A").point(lambda v: 255 if v > 16 else 0)
    for teil, (x0, x1) in zip(("hinten", "vorne"), ((grenzen[0], grenzen[1]), (grenzen[2], grenzen[3]))):
        oben_px = (a.crop((x0, 0, x1, hoehe)).getbbox() or (0, hoehe, 0, 0))[1]
        if oben_px < z:
            hinweise.append(f"Karosserie {teil} ragt über y=1 hinaus. Nur die Mitte darf so hoch sein.")

    teile = {}
    for teil, x0, x1 in zip(KAROSSERIE_TEILE, grenzen[:-1], grenzen[1:]):
        teile[teil] = {"seite": s_fertig.crop((x0, 0, x1, hoehe)), "oben": o_fertig.crop((x0, 0, x1, hoehe))}
    return teile, hinweise


def karosserie_platzhalter(raster: dict, modell: str) -> Image.Image:
    """Gezeichnete Platzhalter-Karosserie als Doppelbild (wie von einer KI),
    absichtlich in anderer Größe als die Norm, damit der Schneider arbeiten muss.
    modell: "A" (Pick-up, rot) oder "B" (Kugel, blau)."""
    u = 70  # Pixel pro Zelle im "Rohbild"
    b, h = 10 * u + 120, 4 * u * 2 + 260
    bild = Image.new("RGB", (b, h), PAPIER[:3])
    d = ImageDraw.Draw(bild)
    farbe, dunkel = ((214, 69, 52), (150, 45, 35)) if modell == "A" else ((58, 123, 213), (35, 80, 150))
    glas = (159, 215, 232)
    ox, oy = 60, 60  # Seite: Zelle (x, y) -> Pixel
    P = lambda x, y, o=(ox, oy): (o[0] + x * u, o[1] + y * u)  # noqa: E731
    lw = 5
    rand = {"outline": INK[:3], "width": lw}
    if modell == "A":
        d.polygon([P(0.1, 2), P(3, 2), P(3, 4), P(0.1, 4)], fill=farbe, outline=PAPIER[:3])
        d.polygon([P(3, 2), P(3.4, 0.6), P(5.6, 0.6), P(6, 2), P(6, 4), P(3, 4)], fill=farbe)
        d.polygon([P(6, 2), P(9.2, 2.2), P(9.9, 2.8), P(9.9, 4), P(6, 4)], fill=farbe)
        d.line([P(0.1, 4), P(0.1, 2), P(3, 2), P(3.4, 0.6), P(5.6, 0.6), P(6, 2), P(9.2, 2.2), P(9.9, 2.8),
                P(9.9, 4), P(0.1, 4)], fill=INK[:3], width=lw)
        d.polygon([P(3.6, 0.9), P(5.4, 0.9), P(5.7, 1.9), P(3.4, 1.9)], fill=glas, outline=INK[:3], width=3)
        d.line([P(0.4, 2.3), P(2.8, 2.3)], fill=dunkel, width=6)
    else:
        d.rounded_rectangle([P(0.2, 2), P(9.6, 4)], radius=int(0.8 * u), fill=farbe, **rand)
        d.chord([P(3, 0.3), P(6, 3.7)], 180, 360, fill=glas, outline=INK[:3], width=lw)
        d.line([P(3.2, 2), P(5.8, 2)], fill=INK[:3], width=lw)
        d.ellipse([P(8.6, 2.5), P(9.2, 3.1)], fill=(255, 244, 207), outline=INK[:3], width=3)
    # Draufsicht darunter (Länge gleich, Breite 3 Zellen an den Nähten)
    o2 = (ox, oy + 4 * u + 140)
    Q = lambda x, y: P(x, y, o2)  # noqa: E731
    if modell == "A":
        d.rounded_rectangle([Q(0.1, 0.5), Q(9.9, 3.5)], radius=int(0.4 * u), fill=farbe, **rand)
        d.rectangle([Q(0.4, 0.8), Q(2.8, 3.2)], fill=dunkel, outline=INK[:3], width=3)
        d.rectangle([Q(3.3, 0.7), Q(5.7, 3.3)], fill=dunkel, outline=INK[:3], width=3)
        d.line([Q(7, 1.2), Q(9.4, 1.2)], fill=dunkel, width=5)
        d.line([Q(7, 2.8), Q(9.4, 2.8)], fill=dunkel, width=5)
    else:
        d.rounded_rectangle([Q(0.2, 0.5), Q(9.6, 3.5)], radius=int(1.2 * u), fill=farbe, **rand)
        d.ellipse([Q(3.1, 0.8), Q(5.9, 3.2)], fill=glas, outline=INK[:3], width=lw)
    for x in (1.5, 4.5, 8):
        d.text(P(x, 3.2), modell, font=_schrift(int(0.5 * u)), fill=PAPIER[:3], anchor="mm")
    return bild


# --- Vorlagen -----------------------------------------------------------------

def _raster_linien(zeichnen: ImageDraw.ImageDraw, b: int, h: int, z: int) -> None:
    for x in range(0, b + 1, z):
        zeichnen.line([(x, 0), (x, h)], fill=GRID, width=2)
    for y in range(0, h + 1, z):
        zeichnen.line([(0, y), (b, y)], fill=GRID, width=2)


def _gestrichelt(d: ImageDraw.ImageDraw, a: tuple[float, float], b: tuple[float, float],
                 farbe, breite: int) -> None:
    laenge = max(abs(b[0] - a[0]), abs(b[1] - a[1]))
    schritte = max(1, int(laenge // 20))
    for i in range(0, schritte, 2):
        t0, t1 = i / schritte, min(1, (i + 1) / schritte)
        d.line([(a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0),
                (a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1)], fill=farbe, width=breite)


def _karosserie_marken(d: ImageDraw.ImageDraw, raster: dict, teil: str, ansicht: str,
                       ox: int, oy: int, b: int, h: int) -> None:
    """Zeichnet Gürtellinie (gestrichelt) und Nähte (rot) eines Karosserieteils.

    ox/oy: obere linke Ecke der Box in Pixeln (für Vorlage 0/0, im Gesamtplan die Platzposition).
    """
    k, z = raster["karosserie"], raster["zelle_px"]
    kanten = {"hinten": ["rechts"], "mitte": ["links", "rechts"], "vorne": ["links"]}[teil]
    if ansicht == "seite":
        y0, y1 = oy + k["guertel_y"] * z, oy + k["unterkante_y"] * z
        _gestrichelt(d, (ox, y0), (ox + b, y0), KANTE, 3)
    else:
        y0, y1 = oy + k["breite_oben"][0] * z, oy + k["breite_oben"][1] * z
    for kante in kanten:
        x = ox + 5 if kante == "links" else ox + b - 5
        d.line([(x, y0), (x, y1)], fill=KANTE, width=10)


def vorlage(raster: dict, kategorie: str, ansicht: str, platzhalter: bool = False) -> Image.Image:
    """Vorlage einer Kategorie: Raster, Kontaktkanten (rot) und Beschriftung.

    platzhalter=True liefert eine farbige, halbtransparente Fassung für den
    Gesamtplan.
    """
    kat = raster["kategorien"][kategorie]
    z = raster["zelle_px"]
    b, h = box_px(raster, kategorie, ansicht)
    if platzhalter:
        farbe = FARBEN[kategorie]
        bild = Image.new("RGBA", (b, h), (*farbe, 150))
    else:
        bild = Image.new("RGBA", (b, h), PAPIER)
    d = ImageDraw.Draw(bild)
    if not platzhalter:
        _raster_linien(d, b, h, z)

    anker_x, anker_y = kat["anker_seite" if ansicht == "seite" else "anker_oben"]
    w = 10
    if kategorie == "rad" and ansicht == "seite":
        d.ellipse([w // 2, w // 2, b - w // 2, h - w // 2], outline=KANTE, width=w)
        d.line([(b // 2 - 20, h // 2), (b // 2 + 20, h // 2)], fill=KANTE, width=4)
        d.line([(b // 2, h // 2 - 20), (b // 2, h // 2 + 20)], fill=KANTE, width=4)
    else:
        if anker_y == "unten":
            d.line([(0, h - w // 2), (b, h - w // 2)], fill=KANTE, width=w)
        if anker_x == "links":
            d.line([(w // 2, 0), (w // 2, h)], fill=KANTE, width=w)
        if anker_x == "rechts":
            d.line([(b - w // 2, 0), (b - w // 2, h)], fill=KANTE, width=w)
    if kat.get("karosserie"):
        _karosserie_marken(d, raster, kat["karosserie"], ansicht, 0, 0, b, h)
    d.rectangle([0, 0, b - 1, h - 1], outline=INK, width=4)
    if platzhalter:
        return bild

    gb, gh = kat[ansicht]
    zeilen = [
        (kat["name"], 26 if b >= 256 else 20),
        ("Seite" if ansicht == "seite" else "Draufsicht", 17),
        (f"{gb}×{gh} Zellen", 17),
        (f"{b}×{h} px", 17),
    ]
    y = 10
    for text, groesse in zeilen:
        d.text((14, y), text, font=_schrift(groesse), fill=INK)
        y += groesse + 8
    d.text((b - 14, h - 14 - (w if anker_y == "unten" else 0)), "vorne →", font=_schrift(17),
           fill=INK, anchor="rs")
    return bild


def bauen(raster: dict, ansicht: str, teile: dict[str, Image.Image]) -> Image.Image:
    """Setzt fertige Teile (Slot -> Bild) auf ihre Rasterplätze."""
    z = raster["zelle_px"]
    ges = raster[ansicht]
    leinwand = Image.new("RGBA", (ges["breite"] * z, ges["hoehe"] * z), (0, 0, 0, 0))
    for slot in raster["reihenfolge_" + ansicht]:
        if slot not in teile:
            continue
        info = raster["slots"][slot]
        bild = teile[slot]
        soll = box_px(raster, info["kategorie"], ansicht)
        if bild.size != soll:
            raise ValueError(
                f"{slot}: Bild ist {bild.size[0]}×{bild.size[1]} px, erwartet {soll[0]}×{soll[1]} px. "
                "Erst mit 'einpassen' auf Rastergröße bringen."
            )
        positionen = [info["seite"]] if ansicht == "seite" else info["oben"]
        for i, (x, y) in enumerate(positionen):
            stueck = bild
            # In der Draufsicht ist das rechte Rad (untere Reihe) gespiegelt
            if ansicht == "oben" and info["kategorie"] == "rad" and i == 1:
                stueck = bild.transpose(Image.FLIP_TOP_BOTTOM)
            leinwand.alpha_composite(stueck, (x * z, y * z))
    return leinwand


def gesamtplan(raster: dict, ansicht: str) -> Image.Image:
    """Gesamtplan: alle Slots als farbige Platzhalter auf dem Raster."""
    z = raster["zelle_px"]
    ges = raster[ansicht]
    b, h = ges["breite"] * z, ges["hoehe"] * z
    plan = Image.new("RGBA", (b, h), PAPIER)
    _raster_linien(ImageDraw.Draw(plan), b, h, z)
    # Karosserie würde alles verdecken: nur als Umriss mit Gürtellinie und Nähten
    karo = [sl for sl, info in raster["slots"].items()
            if raster["kategorien"][info["kategorie"]].get("karosserie")]
    teile = {slot: vorlage(raster, info["kategorie"], ansicht, platzhalter=True)
             for slot, info in raster["slots"].items() if slot not in karo}
    plan.alpha_composite(bauen(raster, ansicht, teile))
    d = ImageDraw.Draw(plan)
    schrift = _schrift(26)
    for slot in karo:
        kat = raster["kategorien"][raster["slots"][slot]["kategorie"]]
        x, y = raster["slots"][slot]["seite"] if ansicht == "seite" else raster["slots"][slot]["oben"][0]
        gb, gh = kat[ansicht]
        ox, oy, bb, hh = x * z, y * z, gb * z, gh * z
        for a, e in [((ox, oy), (ox + bb, oy)), ((ox, oy + hh), (ox + bb, oy + hh)),
                     ((ox, oy), (ox, oy + hh)), ((ox + bb, oy), (ox + bb, oy + hh))]:
            _gestrichelt(d, a, e, INK, 4)
        _karosserie_marken(d, raster, kat["karosserie"], ansicht, ox, oy, bb, hh)
        if ansicht == "seite":
            d.text((ox + bb / 2, oy + 40), "karosserie " + kat["karosserie"], font=schrift, fill=INK,
                   anchor="mm", stroke_width=4, stroke_fill=PAPIER)
    for slot, info in raster["slots"].items():
        if slot in karo or slot.startswith("achse") or (slot == "rahmen" and ansicht == "oben"):
            continue
        gb, gh = raster["kategorien"][info["kategorie"]][ansicht]
        positionen = [info["seite"]] if ansicht == "seite" else info["oben"][:1]
        for x, y in positionen:
            cx, cy = (x + gb / 2) * z, (y + gh / 2) * z
            d.text((cx, cy), slot, font=schrift, fill=INK, anchor="mm", stroke_width=4,
                   stroke_fill=PAPIER)
    if ansicht == "seite":
        text = "rot: Karosserie-Nähte · gestrichelt rot: Gürtellinie · achsen hinter den rädern"
    else:
        text = "unter allem: rahmen und achsen · karosserie gestrichelt, liegt oben drauf"
    hoehe_text = int(1.55 * z) if ansicht == "seite" else int(3.5 * z)
    d.text((b // 2, hoehe_text), text, font=schrift, fill=INK, anchor="mm",
           stroke_width=4, stroke_fill=PAPIER)
    if ansicht == "seite":
        d.line([(0, ges["boden"] * z - 3), (b, ges["boden"] * z - 3)], fill=INK, width=6)
    d.text((b - 20, 20), "vorne →", font=schrift, fill=INK, anchor="ra")
    return plan


def alle_vorlagen(raster: dict, ziel: str = VORLAGEN_DIR) -> list[str]:
    os.makedirs(ziel, exist_ok=True)
    pfade = []
    for kategorie in raster["kategorien"]:
        for ansicht in ("seite", "oben"):
            pfad = os.path.join(ziel, f"vorlage_{kategorie}_{ansicht}.png")
            vorlage(raster, kategorie, ansicht).save(pfad)
            pfade.append(pfad)
    for ansicht in ("seite", "oben"):
        pfad = os.path.join(ziel, f"gesamtplan_{ansicht}.png")
        gesamtplan(raster, ansicht).save(pfad)
        pfade.append(pfad)
    return pfade


# --- Lieferstand für die Prompt-Liste -------------------------------------------

TEILE_DIR = os.path.join(ROOT, "assets", "teile")
GELIEFERT_JS = os.path.join(ROOT, "design", "geliefert.js")
TEILE_JS = os.path.join(ROOT, "design", "teile.js")


def lieferstand(raster: dict, teile_dir: str = TEILE_DIR) -> dict:
    """Alle eingepassten Teile: Schlüssel <id>_<ansicht> -> Vorschau und Notiz.

    Die Kategorie wird aus der Bildgröße erkannt; das Teil liegt unter
    assets/teile/<id>/<ansicht>.png.
    """
    stand = {}
    if not os.path.isdir(teile_dir):
        return stand
    for teil_id in sorted(os.listdir(teile_dir)):
        for ansicht in ("seite", "oben"):
            pfad = os.path.join(teile_dir, teil_id, f"{ansicht}.png")
            if not os.path.exists(pfad):
                continue
            bild = Image.open(pfad).convert("RGBA")
            li, ob, re, un = bild.getchannel("A").getbbox() or (0, 0, 0, 0)
            breite = round((re - li) / bild.width * 100)
            hoehe = round((un - ob) / bild.height * 100)
            gb, gh = bild.width // raster["zelle_px"], bild.height // raster["zelle_px"]
            notiz = f"Eingepasst in die {gb}×{gh}-Box: füllt {breite} % der Breite und {hoehe} % der Höhe."
            vorschau = bild.copy()
            vorschau.thumbnail((240, 240))
            puffer = io.BytesIO()
            vorschau.save(puffer, "PNG", optimize=True)
            stand[f"{teil_id}_{ansicht}"] = {
                "bild": "data:image/png;base64," + base64.b64encode(puffer.getvalue()).decode("ascii"),
                "notiz": notiz,
            }
    return stand


def _data_uri(pfad: str) -> str:
    with open(pfad, "rb") as f:
        return "data:image/png;base64," + base64.b64encode(f.read()).decode("ascii")


def schreibe_lieferstand(raster: dict, ziel: str = GELIEFERT_JS, teile_ziel: str = TEILE_JS) -> int:
    """Schreibt geliefert.js (Vorschau + Notiz für die Prompt-Liste),
    teile.js (alle Teile in voller Auflösung für Fahrprobe und Spiel) und
    raster.js (raster.json für den Browser)."""
    stand = lieferstand(raster)
    kopf = "// Automatisch erzeugt von tools/teilwerk.py geliefert. Nicht von Hand ändern.\n"
    with open(ziel, "w", encoding="utf-8") as f:
        f.write(kopf + "window.GELIEFERT = " + json.dumps(stand, ensure_ascii=False, indent=1) + ";\n")
    voll = {}
    for schluessel in stand:
        teil_id, ansicht = schluessel.rsplit("_", 1)
        voll[schluessel] = _data_uri(os.path.join(TEILE_DIR, teil_id, f"{ansicht}.png"))
    with open(teile_ziel, "w", encoding="utf-8") as f:
        f.write(kopf + "window.TEILE = " + json.dumps(voll, indent=1) + ";\n")
    # Raster für die Seiten im Browser (Werkstatt-Probe), gleiche Quelle wie das Werkzeug
    with open(os.path.join(os.path.dirname(ziel), "raster.js"), "w", encoding="utf-8") as f:
        f.write(kopf + "window.RASTER = " + json.dumps(raster, ensure_ascii=False) + ";\n")
    return len(stand)


# --- Kommandozeile ------------------------------------------------------------

def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="befehl", required=True)
    sub.add_parser("vorlagen", help="Vorlagen und Gesamtplan erzeugen")
    sub.add_parser("geliefert", help="Lieferstand für die Prompt-Liste schreiben (design/geliefert.js)")
    e = sub.add_parser("einpassen", help="Bild freistellen und auf Rastergröße bringen")
    e.add_argument("eingabe")
    e.add_argument("kategorie")
    e.add_argument("ansicht", choices=["seite", "oben"])
    e.add_argument("ausgabe")
    e.add_argument("--toleranz", type=int, default=40, help="Farbabstand für den Hintergrund (Standard 40)")
    e.add_argument("--keine-inseln", action="store_true",
                   help="Eingeschlossene weiße Flächen nicht entfernen (für Teile mit reinweißen Flächen)")
    e.add_argument("--drehen", type=int, default=0, choices=[0, 90, 180, 270],
                   help="Bild vorher gegen den Uhrzeigersinn drehen, z. B. wenn vorne nicht rechts ist")
    bl = sub.add_parser("blatt", help="Doppelbild (Seite oben, Draufsicht unten) teilen und einpassen")
    bl.add_argument("eingabe")
    bl.add_argument("teil_id", help="z. B. maeher; Ausgabe nach assets/teile/<teil_id>/")
    bl.add_argument("kategorie")
    bl.add_argument("--toleranz", type=int, default=40)
    bl.add_argument("--keine-inseln", action="store_true")
    bl.add_argument("--kappen", nargs=3, action="append", default=[], metavar=("ANSICHT", "KANTE", "PROZENT"),
                    help="Rand abschneiden, z. B. --kappen seite unten 27 (wiederholbar)")
    bl.add_argument("--rot-grau", choices=["seite", "oben"],
                    help="Rote Stellen in dieser Ansicht grau färben (z. B. Felgenrest in der Draufsicht)")
    ka = sub.add_parser("karosserie", help="Ganze Karosserie (Doppelbild) normieren und in 3 Teile schneiden")
    ka.add_argument("eingabe")
    ka.add_argument("modell", help="z. B. kaefer; Ausgabe nach assets/teile/<modell>_hinten|_mitte|_vorne/")
    ka.add_argument("--keine-inseln", action="store_true")
    kp = sub.add_parser("karosserie-platzhalter",
                        help="Zwei gezeichnete Platzhalter-Karosserien (A, B) erzeugen")
    kp.add_argument("--roh", help="Ordner für die Rohbilder (Standard: assets/teile/platzhalter-roh)")
    bb = sub.add_parser("bauen", help="Teile zu einem Auto zusammensetzen")
    bb.add_argument("ansicht", choices=["seite", "oben"])
    bb.add_argument("ausgabe")
    bb.add_argument("teile", nargs="+", help="slot=bild.png, z. B. motor=motor_seite.png")
    args = p.parse_args(argv)
    raster = lade_raster()

    if args.befehl == "geliefert":
        print(f"{schreibe_lieferstand(raster)} Bilder eingetragen in {os.path.relpath(GELIEFERT_JS)}")
    elif args.befehl == "vorlagen":
        for pfad in alle_vorlagen(raster):
            print(os.path.relpath(pfad))
    elif args.befehl == "einpassen":
        roh = drehen(Image.open(args.eingabe), args.drehen)
        fertig, hinweise = einpassen(roh, raster, args.kategorie, args.ansicht,
                                     args.toleranz, not args.keine_inseln)
        fertig.save(args.ausgabe)
        print(f"{args.ausgabe}: {fertig.width}×{fertig.height} px")
        for h in hinweise:
            print("Hinweis:", h)
    elif args.befehl == "blatt":
        ziel = os.path.join(TEILE_DIR, args.teil_id)
        os.makedirs(ziel, exist_ok=True)
        schnitte = [(a, k, float(p)) for a, k, p in args.kappen]
        ergebnis = blatt_einpassen(Image.open(args.eingabe), raster, args.kategorie, args.toleranz,
                                   not args.keine_inseln, schnitte)
        for ansicht, (fertig, hinweise) in ergebnis.items():
            if args.rot_grau == ansicht:
                fertig = rot_entsaettigen(fertig)
            pfad = os.path.join(ziel, f"{ansicht}.png")
            fertig.save(pfad)
            print(f"{os.path.relpath(pfad)}: {fertig.width}×{fertig.height} px")
            for h in hinweise:
                print(f"Hinweis ({ansicht}):", h)
    elif args.befehl in ("karosserie", "karosserie-platzhalter"):
        if args.befehl == "karosserie":
            auftraege = [(args.modell, Image.open(args.eingabe), not args.keine_inseln)]
        else:
            roh_dir = args.roh or os.path.join(TEILE_DIR, "platzhalter-roh")
            os.makedirs(roh_dir, exist_ok=True)
            auftraege = []
            for m in ("A", "B"):
                roh = karosserie_platzhalter(raster, m)
                roh.save(os.path.join(roh_dir, f"platzhalter-{m.lower()}_blatt.png"))
                auftraege.append((f"platzhalter-{m.lower()}", roh, True))
        for modell, roh, inseln in auftraege:
            teile, hinweise = karosserie_schneiden(roh, raster, inseln=inseln)
            for teil, ansichten in teile.items():
                ziel = os.path.join(TEILE_DIR, f"{modell}_{teil}")
                os.makedirs(ziel, exist_ok=True)
                for ansicht, fertig in ansichten.items():
                    fertig.save(os.path.join(ziel, f"{ansicht}.png"))
                print(f"{os.path.relpath(ziel)}: seite + oben")
            for h in hinweise:
                print("Hinweis:", h)
    elif args.befehl == "bauen":
        teile = {}
        for eintrag in args.teile:
            slot, pfad = eintrag.split("=", 1)
            teile[slot] = Image.open(pfad).convert("RGBA")
        bauen(raster, args.ansicht, teile).save(args.ausgabe)
        print(args.ausgabe)
    return 0


if __name__ == "__main__":
    sys.exit(main())

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
    "aufbau": (127, 207, 174), "achse": (93, 78, 66),
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


# --- Vorlagen -----------------------------------------------------------------

def _raster_linien(zeichnen: ImageDraw.ImageDraw, b: int, h: int, z: int) -> None:
    for x in range(0, b + 1, z):
        zeichnen.line([(x, 0), (x, h)], fill=GRID, width=2)
    for y in range(0, h + 1, z):
        zeichnen.line([(0, y), (b, y)], fill=GRID, width=2)


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
    teile = {slot: vorlage(raster, info["kategorie"], ansicht, platzhalter=True)
             for slot, info in raster["slots"].items()}
    d = ImageDraw.Draw(plan)
    if ansicht == "oben":
        # Das Dach würde von oben alles verdecken: nur als gestrichelten Umriss zeigen
        del teile["aufbau"]
        x, y = raster["slots"]["aufbau"]["oben"][0]
        gb, gh = raster["kategorien"]["aufbau"]["oben"]
        for i in range(x * z, (x + gb) * z, 24):
            d.line([(i, y * z + 3), (i + 12, y * z + 3)], fill=INK, width=4)
            d.line([(i, (y + gh) * z - 3), (i + 12, (y + gh) * z - 3)], fill=INK, width=4)
    plan.alpha_composite(bauen(raster, ansicht, teile))
    d = ImageDraw.Draw(plan)
    schrift = _schrift(26)
    for slot, info in raster["slots"].items():
        if slot == "aufbau" or slot.startswith("achse") or (slot == "rahmen" and ansicht == "oben"):
            continue
        gb, gh = raster["kategorien"][info["kategorie"]][ansicht]
        positionen = [info["seite"]] if ansicht == "seite" else info["oben"][:1]
        for x, y in positionen:
            cx, cy = (x + gb / 2) * z, (y + gh / 2) * z
            d.text((cx, cy), slot, font=schrift, fill=INK, anchor="mm", stroke_width=4,
                   stroke_fill=PAPIER)
    text = ("aufbau hinter allem · achsen hinter den rädern" if ansicht == "seite"
            else "unter allem: rahmen und achsen (quer) · aufbau gestrichelt als Dach")
    d.text((b // 2, 64 if ansicht == "seite" else int(3.5 * z)), text, font=schrift, fill=INK, anchor="mm",
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
    """Schreibt geliefert.js (Vorschau + Notiz für die Prompt-Liste) und
    teile.js (alle Teile in voller Auflösung für Fahrprobe und Spiel)."""
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

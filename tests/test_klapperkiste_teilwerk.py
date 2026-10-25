import os
import sys

import pytest
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "klapperkiste", "tools"))
import teilwerk  # noqa: E402


@pytest.fixture(scope="module")
def raster():
    return teilwerk.lade_raster()


def _ki_bild(groesse, kreis, farbe=(200, 40, 40)):
    """Simuliert ein generiertes Bild: rundes Teil auf weißem Hintergrund."""
    bild = Image.new("RGB", groesse, (255, 255, 255))
    ImageDraw.Draw(bild).ellipse(kreis, fill=farbe)
    return bild


def test_alle_slots_passen_ins_gesamtraster(raster):
    z = raster["zelle_px"]
    for ansicht in ("seite", "oben"):
        ges = raster[ansicht]
        for slot, info in raster["slots"].items():
            b, h = raster["kategorien"][info["kategorie"]][ansicht]
            positionen = [info["seite"]] if ansicht == "seite" else info["oben"]
            for x, y in positionen:
                assert 0 <= x and x + b <= ges["breite"], (slot, ansicht)
                assert 0 <= y and y + h <= ges["hoehe"], (slot, ansicht)
        assert teilwerk.gesamtplan(raster, ansicht).size == (ges["breite"] * z, ges["hoehe"] * z)


def test_raeder_stehen_auf_dem_boden(raster):
    boden = raster["seite"]["boden"]
    for slot in ("radH", "radV"):
        _, y = raster["slots"][slot]["seite"]
        assert y + raster["kategorien"]["rad"]["seite"][1] == boden


def test_einpassen_rad_fuellt_box_und_ist_freigestellt(raster):
    roh = _ki_bild((900, 700), (200, 100, 700, 600))
    fertig, hinweise = teilwerk.einpassen(roh, raster, "rad", "seite")
    assert fertig.size == teilwerk.box_px(raster, "rad", "seite")
    assert hinweise == []
    assert fertig.getpixel((0, 0))[3] == 0
    mitte = fertig.getpixel((fertig.width // 2, fertig.height // 2))
    assert mitte[3] == 255 and mitte[0] > 150
    # Kreis berührt alle vier Kanten
    bbox = fertig.getchannel("A").getbbox()
    assert bbox == (0, 0, fertig.width, fertig.height)


def test_einpassen_motor_steht_unten(raster):
    roh = Image.new("RGB", (800, 800), (240, 240, 240))
    ImageDraw.Draw(roh).rectangle((200, 300, 600, 500), fill=(30, 30, 30))
    fertig, hinweise = teilwerk.einpassen(roh, raster, "motor", "seite")
    links, oben, rechts, unten = fertig.getchannel("A").getbbox()
    assert unten == fertig.height
    assert oben > 0
    assert hinweise  # 2:1-Block in 1:1-Box -> Hinweis auf Seitenverhältnis


def test_einpassen_behaelt_getoente_flaechen_und_entfernt_loecher(raster):
    roh = Image.new("RGB", (600, 600), (255, 255, 255))
    d = ImageDraw.Draw(roh)
    d.ellipse((50, 50, 550, 550), fill=(20, 20, 20))
    d.ellipse((250, 250, 350, 350), fill=(222, 226, 228))  # hellgraue Nabe = Teil des Rads
    d.ellipse((120, 270, 180, 330), fill=(255, 255, 255))  # reines Weiß = Loch
    fertig, _ = teilwerk.einpassen(roh, raster, "rad", "seite")

    def punkt(x, y):  # Originalkoordinate -> Koordinate im eingepassten Rad (Kreis 50..551)
        k = fertig.width / 501
        return int((x - 50) * k), int((y - 50) * k)

    assert fertig.getpixel(punkt(300, 300))[3] == 255
    assert fertig.getpixel(punkt(150, 300))[3] == 0
    ohne, _ = teilwerk.einpassen(roh, raster, "rad", "seite", inseln=False)
    assert ohne.getpixel(punkt(150, 300))[3] == 255


def test_bauen_prueft_groesse(raster):
    with pytest.raises(ValueError, match="einpassen"):
        teilwerk.bauen(raster, "seite", {"motor": Image.new("RGBA", (100, 100))})


def test_einpassen_rahmen_wird_auf_volle_breite_gestreckt(raster):
    roh = Image.new("RGB", (2100, 900), (255, 255, 255))
    ImageDraw.Draw(roh).rectangle((100, 350, 2000, 550), fill=(120, 80, 40))
    fertig, _ = teilwerk.einpassen(roh, raster, "rahmen", "seite")
    assert fertig.getchannel("A").getbbox() == (0, 0, fertig.width, fertig.height)


def test_blatt_wird_in_seite_und_draufsicht_geteilt(raster):
    roh = Image.new("RGB", (600, 1100), (255, 255, 255))
    d = ImageDraw.Draw(roh)
    d.rectangle((100, 150, 500, 450), fill=(200, 40, 40))  # Seitenansicht
    d.ellipse((100, 650, 500, 950), fill=(40, 40, 200))  # Draufsicht
    ergebnis = teilwerk.blatt_einpassen(roh, raster, "motor")
    seite, _ = ergebnis["seite"]
    oben, _ = ergebnis["oben"]
    assert seite.size == teilwerk.box_px(raster, "motor", "seite")
    assert oben.size == teilwerk.box_px(raster, "motor", "oben")
    assert seite.getpixel((seite.width // 2, seite.height - 5))[:3] == (200, 40, 40)
    assert oben.getpixel((oben.width // 2, oben.height // 2))[:3] == (40, 40, 200)


def test_blatt_ohne_luecke_gibt_verstaendlichen_fehler(raster):
    roh = Image.new("RGB", (400, 800), (255, 255, 255))
    ImageDraw.Draw(roh).rectangle((50, 50, 350, 750), fill=(0, 0, 0))
    with pytest.raises(ValueError, match="Lücke"):
        teilwerk.blatt_teilen(roh)


def test_drehen_legt_hochkant_teil_quer(raster):
    roh = Image.new("RGB", (300, 600), (255, 255, 255))
    ImageDraw.Draw(roh).rectangle((100, 50, 200, 120), fill=(200, 40, 40))  # Merkmal oben
    gedreht = teilwerk.drehen(roh, 90)
    assert gedreht.size == (600, 300)
    assert gedreht.getpixel((80, 150))[:3] == (200, 40, 40)  # jetzt links


def test_rad_draufsicht_behaelt_reifenbreite(raster):
    roh = Image.new("RGB", (800, 400), (255, 255, 255))
    ImageDraw.Draw(roh).rectangle((100, 170, 700, 230), fill=(60, 60, 60))  # schmale Lauffläche 10:1
    fertig, _ = teilwerk.einpassen(roh, raster, "rad", "oben")
    links, oben, rechts, unten = fertig.getchannel("A").getbbox()
    assert (links, rechts) == (0, fertig.width)
    assert unten - oben < fertig.height // 2
    assert abs((oben + unten) / 2 - fertig.height / 2) <= 1


def test_rot_entsaettigen_faerbt_nur_rot(raster):
    bild = Image.new("RGBA", (2, 1))
    bild.putpixel((0, 0), (220, 40, 40, 255))
    bild.putpixel((1, 0), (60, 60, 60, 255))
    neu = teilwerk.rot_entsaettigen(bild)
    r, g, b, a = neu.getpixel((0, 0))
    assert r == g == b and a == 255
    assert neu.getpixel((1, 0)) == (60, 60, 60, 255)


def test_kappen_schneidet_rollen_unter_dem_rahmen_ab(raster):
    roh = Image.new("RGB", (1000, 900), (255, 255, 255))
    d = ImageDraw.Draw(roh)
    d.rectangle((100, 100, 900, 200), fill=(90, 120, 80))  # Balken (Seite)
    d.ellipse((120, 200, 180, 260), fill=(30, 30, 30))  # Rolle darunter
    d.rectangle((100, 500, 900, 700), fill=(90, 120, 80))  # Draufsicht
    ergebnis = teilwerk.blatt_einpassen(roh, raster, "rahmen", schnitte=[("seite", "unten", 38)])
    seite, _ = ergebnis["seite"]
    # Nach dem Abschneiden ist die ganze Box Balkenfarbe, keine schwarze Rolle mehr
    r, g, b, a = seite.getpixel((10, seite.height - 3))
    assert a == 255 and g > r


def test_achse_draufsicht_reicht_von_rad_zu_rad(raster):
    roh = Image.new("RGB", (300, 900), (255, 255, 255))
    ImageDraw.Draw(roh).rectangle((130, 50, 170, 850), fill=(110, 70, 40))  # senkrechte Stange
    fertig, _ = teilwerk.einpassen(roh, raster, "achse", "oben")
    links, oben, rechts, unten = fertig.getchannel("A").getbbox()
    assert (oben, unten) == (0, fertig.height)
    assert rechts - links < fertig.width // 2


def test_achse_liegt_unter_den_raedern(raster):
    for ansicht in ("seite", "oben"):
        folge = raster["reihenfolge_" + ansicht]
        assert folge.index("achseH") < folge.index("radH")
        assert folge.index("achseV") < folge.index("radV")


def test_achse_seite_setzt_nabe_in_die_mitte(raster):
    roh = Image.new("RGB", (400, 600), (255, 255, 255))
    d = ImageDraw.Draw(roh)
    d.rectangle((180, 60, 220, 300), fill=(90, 90, 90))  # Halterung oben, schmal
    d.ellipse((100, 300, 300, 500), fill=(160, 80, 40))  # Nabe, breiteste Stelle
    fertig, _ = teilwerk.einpassen(roh, raster, "achse", "seite")
    mitte = fertig.getpixel((fertig.width // 2, fertig.height // 2))
    assert mitte[3] == 255 and mitte[0] > 120
    links, _, rechts, unten = fertig.getchannel("A").getbbox()
    assert abs((rechts - links) - fertig.width * 0.45) <= 3
    assert abs(unten - (fertig.height / 2 + fertig.width * 0.45 / 2)) <= 3


def test_karosserie_naehte_schliessen_lueckenlos_an(raster):
    k, slots, kats = raster["karosserie"], raster["slots"], raster["kategorien"]
    folge = [("karoH", "karoM"), ("karoM", "karoV")]
    for links, rechts in folge:
        x_links = slots[links]["seite"][0] + kats[slots[links]["kategorie"]]["seite"][0]
        assert x_links == slots[rechts]["seite"][0]
    assert [slots[s]["seite"][0] for s in ("karoM", "karoV")] == k["naehte_x"]
    ende = slots["karoV"]["seite"][0] + kats["karosserie_vorne"]["seite"][0]
    assert ende == raster["seite"]["breite"]
    for s in ("karoH", "karoM", "karoV"):
        assert slots[s]["seite"][1] + kats[slots[s]["kategorie"]]["seite"][1] == k["unterkante_y"]


def _naht_hoehe(bild, x):
    alpha = bild.getchannel("A").point(lambda a: 255 if a > 16 else 0)
    oben, unten = teilwerk._ausdehnung(alpha, x)
    return unten - oben


def test_karosserie_modelle_lassen_sich_mischen(raster):
    z = raster["zelle_px"]
    soll = (raster["karosserie"]["unterkante_y"] - raster["karosserie"]["guertel_y"]) * z
    teile = {}
    for m in ("A", "B"):
        teile[m], hinweise = teilwerk.karosserie_schneiden(teilwerk.karosserie_platzhalter(raster, m), raster)
        assert hinweise == [], hinweise
        assert teile[m]["vorne"]["seite"].size == teilwerk.box_px(raster, "karosserie_vorne", "seite")
    # Naht hinten|Mitte: rechter Rand von A-hinten gleich hoch wie linker Rand von B-mitte
    a_hinten = _naht_hoehe(teile["A"]["hinten"]["seite"], 3 * z - 3)
    b_mitte = _naht_hoehe(teile["B"]["mitte"]["seite"], 2)
    assert abs(a_hinten - soll) <= soll * 0.08
    assert abs(b_mitte - soll) <= soll * 0.08 or b_mitte > soll  # Mitte darf nach oben (Kuppel)


def test_karosserie_warnt_bei_falscher_guertellinie(raster):
    roh = Image.new("RGB", (1000, 900), (255, 255, 255))
    d = ImageDraw.Draw(roh)
    d.polygon([(50, 300), (500, 100), (950, 300), (950, 380), (50, 380)], fill=(200, 60, 60))  # Seite: Keil
    d.rectangle((50, 550, 950, 800), fill=(200, 60, 60))  # Draufsicht
    _, hinweise = teilwerk.karosserie_schneiden(roh, raster)
    assert any("Naht" in h for h in hinweise)

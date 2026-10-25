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

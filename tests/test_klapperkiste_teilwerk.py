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


def test_einpassen_behaelt_innere_flaechen_in_hintergrundfarbe(raster):
    roh = Image.new("RGB", (600, 600), (255, 255, 255))
    d = ImageDraw.Draw(roh)
    d.ellipse((50, 50, 550, 550), fill=(20, 20, 20))
    d.ellipse((250, 250, 350, 350), fill=(255, 255, 255))  # weiße Nabe
    fertig, _ = teilwerk.einpassen(roh, raster, "rad", "seite")
    assert fertig.getpixel((fertig.width // 2, fertig.height // 2))[3] == 255


def test_bauen_prueft_groesse(raster):
    with pytest.raises(ValueError, match="einpassen"):
        teilwerk.bauen(raster, "seite", {"motor": Image.new("RGBA", (100, 100))})


def test_einpassen_rahmen_wird_auf_volle_breite_gestreckt(raster):
    roh = Image.new("RGB", (2100, 900), (255, 255, 255))
    ImageDraw.Draw(roh).rectangle((100, 350, 2000, 550), fill=(120, 80, 40))
    fertig, _ = teilwerk.einpassen(roh, raster, "rahmen", "seite")
    assert fertig.getchannel("A").getbbox() == (0, 0, fertig.width, fertig.height)

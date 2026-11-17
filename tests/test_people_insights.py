import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

import people_insights as pi  # noqa: E402


def test_features_from_prompt():
    f = pi.features_from_prompt(
        "Close-up headshot photo of a handsome 24-year-old young Italian man with short hair, "
        "a warm genuine smile, looking directly into the camera")
    assert f == {"Ausschnitt": "Nahaufnahme", "Alter": "20er", "Geschlecht": "Mann",
                 "Attraktiv betont": "ja", "Laecheln": "ja"}
    g = pi.features_from_prompt(
        "Waist-up portrait photo of a 52-year-old Korean woman, a calm neutral expression")
    assert g["Ausschnitt"] == "Huefte aufwaerts" and g["Geschlecht"] == "Frau"
    assert g["Attraktiv betont"] == "nein" and g["Laecheln"] == "nein"


def test_report_ranks_and_groups():
    def post(n, views, framing):
        return {"id": str(n), "number": n, "caption": "Look closely.\n\nx", "type": "Reel", "views": views,
                "reach": views, "likes": 2, "comments": 0, "shares": 1, "saved": 0,
                "features": {"Ausschnitt": framing, "Alter": "20er", "Geschlecht": "Frau",
                             "Attraktiv betont": "nein", "Laecheln": "nein"}}
    posts = [post(i, v, f) for i, (v, f) in enumerate(
        [(1900, "Nahaufnahme"), (1600, "Nahaufnahme"), (240, "Halbkoerper"), (230, "Halbkoerper"),
         (250, "Nahaufnahme"), (220, "Halbkoerper")], start=1)]
    text = pi.build_report(posts, 7)
    assert text.index("No. 0001") < text.index("No. 0002")
    assert "Ausschnitt: Nahaufnahme 1.250 (3) | Halbkoerper 230 (3)" in text
    assert "Schwaechste 3" in text


def test_report_empty():
    assert "Keine auswertbaren Posts" in pi.build_report([], 7)

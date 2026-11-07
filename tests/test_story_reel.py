import random

import pytest
import story_reel as sr
from PIL import Image, ImageDraw


@pytest.mark.parametrize("account", sr.ACCOUNTS)
def test_content_is_valid(account):
    cfg, stories = sr.load_account(account)
    assert cfg["handle"].startswith("@")
    assert len(cfg["accent"]) == 3
    assert len(stories) >= 15
    for s in stories:
        assert s["hook"] and 2 <= len(s["slides"]) <= 6, s["id"]
        assert 1 <= len(s.get("images", [])) <= 4, s["id"]
        for text in [s["hook"], *s["slides"]]:
            assert text.count("*") % 2 == 0, f"unpaarige Sternchen in {s['id']}"
            assert len(sr.strip_marks(text).split()) <= 32, f"Folie zu lang in {s['id']}"


def test_pick_story_order_and_cycle():
    stories = [{"id": "a"}, {"id": "b"}, {"id": "c"}]
    assert sr.pick_story(stories, {"posted": []})["id"] == "a"
    assert sr.pick_story(stories, {"posted": ["a"]})["id"] == "b"
    # Alle durch -> die am laengsten nicht gepostete kommt wieder
    assert sr.pick_story(stories, {"posted": ["b", "a", "c"]})["id"] == "b"
    assert sr.pick_story(stories, {"posted": []}, story_id="c")["id"] == "c"
    with pytest.raises(SystemExit):
        sr.pick_story(stories, {}, story_id="x")


def test_parse_marked():
    assert sr.parse_marked("ein *ganz neues* Wort") == [
        ("ein", False), ("ganz", True), ("neues", True), ("Wort", False)]


def test_fit_text_never_overflows_long_words():
    d = ImageDraw.Draw(Image.new("RGB", (10, 10)))
    font, lines = sr.fit_text("HUNDERTSIEBENUNDZWANZIGSTADIENUNTERSUCHUNGEN sind lang", "Bold", 82, 900, 6, d)
    assert max(w for _, w in lines) <= 900


def test_segments_and_caption():
    cfg, stories = sr.load_account("horror")
    story = stories[0]
    segs = sr.build_segments(cfg, story, random.Random(1))
    assert segs[0]["kind"] == "hook" and segs[-1]["kind"] == "cta"
    assert len(segs) == len(story["slides"]) + 2
    assert all(0 <= s["image"] < len(story["images"]) for s in segs)
    assert all(3.0 <= s["duration"] <= 8.5 for s in segs)
    total = sr.timeline(segs)
    assert 15 < total < 60  # Reels: kurz und knackig
    caption = sr.build_caption(cfg, story, random.Random(1))
    assert "*" not in caption and cfg["handle"] in caption
    assert caption.count("#") <= 15


def test_text_card_and_frame():
    cfg, stories = sr.load_account("mysteries")
    segs = sr.build_segments(cfg, stories[0], random.Random(2))
    sr.timeline(segs)
    card = sr.render_text_card(segs[0], cfg["accent"])
    assert card.size == (sr.W, sr.H) and card.getbbox() is not None
    base = sr.prepare_base(sr.fallback_background(cfg["accent"], 1), "warm")
    spans = sr.image_spans(segs)
    frame = sr.frame_at(1.0, spans, [base] * 3, Image.new("RGB", (sr.W, sr.H)))
    assert frame.size == (sr.W, sr.H)

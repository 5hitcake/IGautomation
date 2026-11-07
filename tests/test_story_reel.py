import asyncio
import random

import pytest
import story_reel as sr
from PIL import Image, ImageDraw


@pytest.mark.parametrize("account", sr.ACCOUNTS)
def test_content_is_valid(account):
    cfg, stories = sr.load_account(account)
    assert cfg["handle"].startswith("@")
    assert len(cfg["accent"]) == 3
    assert cfg.get("voiceover") is True and cfg["cta_voice"]
    assert len(stories) >= 15
    for s in stories:
        assert s["hook"]["text"] and s["hook"]["image"], s["id"]
        assert 6 <= len(s["scenes"]) <= 10, s["id"]
        for scene in s["scenes"]:
            assert scene["image"], s["id"]
        texts = [s["hook"]["text"]] + [x["text"] for x in s["scenes"]]
        for text in texts:
            assert text.count("*") % 2 == 0, f"unpaarige Sternchen in {s['id']}"
            assert len(sr.strip_marks(text).split()) <= 34, f"Szene zu lang in {s['id']}: {text}"
        words = sum(len(sr.strip_marks(t).split()) for t in texts)
        assert 85 <= words <= 170, f"{s['id']}: {words} Woerter (Ziel ~1 Minute)"


def test_pick_story_order_and_cycle():
    stories = [{"id": "a"}, {"id": "b"}, {"id": "c"}]
    assert sr.pick_story(stories, {"posted": []})["id"] == "a"
    assert sr.pick_story(stories, {"posted": ["a"]})["id"] == "b"
    assert sr.pick_story(stories, {"posted": ["b", "a", "c"]})["id"] == "b"
    assert sr.pick_story(stories, {"posted": []}, story_id="c")["id"] == "c"
    with pytest.raises(SystemExit):
        sr.pick_story(stories, {}, story_id="x")


def test_parse_marked():
    assert sr.parse_marked("ein *ganz neues* Wort") == [
        ("ein", False),
        ("ganz", True),
        ("neues", True),
        ("Wort", False),
    ]


def test_fit_text_never_overflows_long_words():
    d = ImageDraw.Draw(Image.new("RGB", (10, 10)))
    font, lines = sr.fit_text("HUNDERTSIEBENUNDZWANZIGSTADIENUNTERSUCHUNGEN sind lang", "Bold", 82, 900, 6, d)
    assert max(w for _, w in lines) <= 900


def test_segments_one_image_per_scene_and_caption():
    cfg, stories = sr.load_account("horror")
    story = stories[0]
    segs = sr.build_segments(cfg, story, random.Random(1))
    assert segs[0]["kind"] == "hook" and segs[-1]["kind"] == "cta"
    assert len(segs) == len(story["scenes"]) + 2
    assert [s["image"] for s in segs[:-1]] == list(range(len(story["scenes"]) + 1))
    assert segs[-1]["image"] == 0  # Loop zurueck zum Titelbild
    assert len(sr.image_prompts(story)) == len(story["scenes"]) + 1
    caption = sr.build_caption(cfg, story, random.Random(1))
    assert "*" not in caption and cfg["handle"] in caption
    assert caption.count("#") <= 15


def test_map_word_times():
    b = [0.0, 0.5, 1.0, 1.5, 2.0, 2.5]
    assert sr.map_word_times(b, 2, 4) == [1.0, 1.5, 2.0, 2.5]
    assert sr.map_word_times(b, 0, 3) == [0.0, 1.0, 2.0]
    assert sr.map_word_times([], 0, 3) == []


def test_voiceover_sets_durations_and_word_times(tmp_path):
    import subprocess

    async def fake_tts(text, voice, path):
        n = len(text.split())
        subprocess.run(
            [
                "ffmpeg",
                "-loglevel",
                "error",
                "-y",
                "-f",
                "lavfi",
                "-i",
                f"sine=f=200:d={n / 2.5:.2f}:sample_rate=24000",
                path,
            ],
            check=True,
        )
        return [i / 2.5 for i in range(n)]

    cfg, stories = sr.load_account("mysteries")
    segs = sr.build_segments(cfg, stories[0], random.Random(3))
    for s in segs:
        s["speech"] = s.get("speech") or ""
    segs[-1]["speech"] = cfg["cta_voice"]
    track = sr.make_voiceover(segs, "x", str(tmp_path), tts=fake_tts)
    total = sr.timeline(segs)
    assert abs(sr.ffprobe_duration(track) - total) < 0.2
    for s in segs[:-1]:
        assert len(s["word_times"]) == sr.count_words(s)
        assert s["word_times"] == sorted(s["word_times"])
    assert sr.revealed_words(segs[1]["start"] + 0.01, segs[1]) <= 1
    assert sr.revealed_words(segs[1]["end"] - 0.01, segs[1]) == sr.count_words(segs[1])
    assert asyncio.iscoroutinefunction(sr._tts)


def test_text_card_and_frame():
    cfg, stories = sr.load_account("mysteries")
    segs = sr.build_segments(cfg, stories[0], random.Random(2))
    sr.timeline(segs)
    full = sr.render_text_card(segs[1], cfg["accent"])
    partial = sr.render_text_card(segs[1], cfg["accent"], revealed=2)
    assert full.size == (sr.W, sr.H) and full.getbbox() is not None
    assert full.tobytes() != partial.tobytes()
    base = sr.prepare_base(sr.fallback_background(cfg["accent"], 1), "warm")
    spans = sr.image_spans(segs)
    frame = sr.frame_at(
        1.0, spans, [base] * len(sr.image_prompts(stories[0])), Image.new("RGB", (sr.W, sr.H))
    )
    assert frame.size == (sr.W, sr.H)


def test_image_maker_dry_run_and_fallback(monkeypatch):
    assert sr.ImageMaker(dry_run=True).make("x", 1) == (None, "fallback")
    monkeypatch.delenv("CLOUDFLARE_ACCOUNT_ID", raising=False)
    monkeypatch.delenv("POLLINATIONS_API_KEY", raising=False)
    assert sr.ImageMaker().make("x", 1) == (None, "fallback")

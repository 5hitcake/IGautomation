import json
import os

import common
import pytest


def write_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f)


@pytest.fixture
def quotes_file(tmp_path, monkeypatch):
    path = tmp_path / "quotes_de.json"
    write_json(
        path,
        {
            "quotes": [
                {"id": 1, "category": "Disziplin", "text": "Zitat eins."},
                {"id": 2, "category": "Erfolg", "text": "Zitat zwei."},
            ]
        },
    )
    monkeypatch.setattr(common, "QUOTES_PATH", str(path))
    return path


@pytest.fixture
def hashtags_file(tmp_path, monkeypatch):
    path = tmp_path / "hashtags.json"
    write_json(
        path,
        {
            "general": ["#a", "#b", "#c", "#d", "#e"],
            "by_category": {"Disziplin": ["#x", "#y", "#z"]},
        },
    )
    monkeypatch.setattr(common, "HASHTAGS_PATH", str(path))
    return path


@pytest.fixture
def backgrounds_dir(tmp_path, monkeypatch):
    path = tmp_path / "backgrounds"
    path.mkdir()
    for name in ("bg1.png", "bg2.png", "bg3.png"):
        (path / name).write_bytes(b"")
    monkeypatch.setattr(common, "BACKGROUNDS_DIR", str(path))
    return path


@pytest.fixture
def music_dir(tmp_path, monkeypatch):
    path = tmp_path / "music"
    path.mkdir()
    monkeypatch.setattr(common, "MUSIC_DIR", str(path))
    return path


@pytest.fixture
def reels_file(tmp_path, monkeypatch):
    path = tmp_path / "reels.json"
    write_json(
        path,
        {
            "bg_videos": ["v1.mp4", "v2.mp4"],
            "reels": [
                {"id": 1, "quote_id": 1, "category": "Disziplin", "text": "Reel eins."},
                {"id": 2, "quote_id": 2, "category": "Erfolg", "text": "Reel zwei."},
            ],
        },
    )
    monkeypatch.setattr(common, "REELS_PATH", str(path))
    return path


def empty_state():
    return {
        "posted_quote_ids": [],
        "posted_reel_ids": [],
        "recent_backgrounds": [],
        "recent_bg_videos": [],
    }


def test_pick_next_quote_cycles_before_repeating(quotes_file):
    state = empty_state()
    seen = {common.pick_next_quote(state)["id"] for _ in range(2)}
    assert seen == {1, 2}
    # Alle zitate wurden gezeigt -> naechster Aufruf resettet den Zyklus statt zu crashen
    third = common.pick_next_quote(state)
    assert third["id"] in {1, 2}


def test_pick_background_avoids_immediate_repeats(backgrounds_dir):
    state = empty_state()
    picks = [os.path.basename(common.pick_background(state)) for _ in range(3)]
    # Bei 3 Dateien und leerem Verlauf muessen die ersten 3 Picks alle unterschiedlich sein
    assert len(set(picks)) == 3


def test_pick_next_reel_cycles_before_repeating(reels_file):
    state = empty_state()
    seen_ids = {common.pick_next_reel(state)[0]["id"] for _ in range(2)}
    assert seen_ids == {1, 2}


def test_pick_next_reel_returns_valid_bg_video_path(reels_file):
    state = empty_state()
    _, bg_path = common.pick_next_reel(state)
    assert os.path.basename(bg_path) in {"v1.mp4", "v2.mp4"}


def test_pick_music_returns_none_when_empty(music_dir):
    assert common.pick_music() is None


def test_pick_music_returns_file_when_present(music_dir):
    (music_dir / "track.mp3").write_bytes(b"")
    result = common.pick_music()
    assert result is not None
    assert result.endswith("track.mp3")


def test_build_caption_includes_quote_text_and_hashtags(hashtags_file):
    caption = common.build_caption("Mein Zitat.", "Disziplin")
    assert caption.startswith("Mein Zitat.")
    # 3 Kategorie- + 4 allgemeine Hashtags wie in build_caption vorgesehen
    hashtag_count = caption.count("#")
    assert hashtag_count == 7


def test_build_caption_falls_back_when_category_unknown(hashtags_file):
    # Unbekannte Kategorie darf nicht crashen, nur weniger Hashtags liefern
    caption = common.build_caption("Zitat.", "UnbekannteKategorie")
    assert caption.startswith("Zitat.")
    assert caption.count("#") == 4

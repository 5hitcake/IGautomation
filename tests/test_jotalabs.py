import json

import jotalabs_pick_story as jl
import pytest


def test_pick_starts_with_first_story():
    state = {"last_story": None, "history": []}
    assert jl.pick_next_story(state, ["story_01.jpg", "story_02.jpg"]) == "story_01.jpg"
    assert state["last_story"] == "story_01.jpg"


def test_pick_goes_in_order_and_wraps_around():
    stories = ["story_01.jpg", "story_02.jpg", "story_03.jpg"]
    state = {"last_story": None, "history": []}
    picks = [jl.pick_next_story(state, stories) for _ in range(4)]
    assert picks == ["story_01.jpg", "story_02.jpg", "story_03.jpg", "story_01.jpg"]


def test_pick_continues_after_removed_story():
    state = {"last_story": "story_02.jpg", "history": []}
    assert jl.pick_next_story(state, ["story_01.jpg", "story_03.jpg"]) == "story_03.jpg"


def test_pick_without_stories_fails():
    with pytest.raises(RuntimeError):
        jl.pick_next_story({}, [])


def test_history_is_capped():
    state = {"last_story": None, "history": [f"x{i}" for i in range(30)]}
    jl.pick_next_story(state, ["story_01.jpg"])
    assert len(state["history"]) == 30 and state["history"][-1] == "story_01.jpg"


def test_main_writes_story_post(tmp_path, monkeypatch):
    stories = tmp_path / "stories"
    stories.mkdir()
    for name in ("story_01.jpg", "story_02.jpg", "notes.txt"):
        (stories / name).write_bytes(b"")
    monkeypatch.setattr(jl, "STORIES_DIR", str(stories))
    monkeypatch.setattr(jl, "GENERATED_DIR", str(tmp_path / "gen"))
    monkeypatch.setattr(jl, "STATE_PATH", str(tmp_path / "log.json"))

    jl.main()
    jl.main()

    post = json.loads((tmp_path / "gen" / "next_post.json").read_text())
    assert post == {"type": "story", "file": "assets/jotalabs_stories/story_02.jpg", "caption": ""}
    assert json.loads((tmp_path / "log.json").read_text())["last_story"] == "story_02.jpg"

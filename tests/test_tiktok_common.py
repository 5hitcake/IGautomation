import json

import pytest
import tiktok_common as tc


def write_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f)


@pytest.fixture
def topics_file(tmp_path, monkeypatch):
    path = tmp_path / "tiktok_topics.json"
    write_json(
        path,
        {
            "topics": [
                {
                    "id": 1,
                    "hook": "Hook eins?",
                    "location": "Ort eins",
                    "year": "Jahr eins",
                    "search": "Suche eins.",
                    "search_visual": "eine Testsuchszene mit besonderen Merkmalen",
                    "discovery": "Fund eins.",
                    "reaction": "Reaktion eins.",
                    "suppression_1": "Vertuschung eins.",
                    "suppression_2": "Vertuschung zwei.",
                    "payoff": "Aufloesung eins.",
                    "artifact": "ein Testartefakt mit besonderen Merkmalen",
                    "location_detail": "eine Testlandschaft mit besonderen Merkmalen",
                    "real_person": None,
                    "category": "Test",
                    "hashtags": ["#eins"],
                },
                {
                    "id": 2,
                    "hook": "Hook zwei?",
                    "location": "Ort zwei",
                    "year": "Jahr zwei",
                    "search": "Suche zwei.",
                    "search_visual": "eine zweite Testsuchszene",
                    "discovery": "Fund zwei.",
                    "reaction": "Reaktion zwei.",
                    "suppression_1": "Vertuschung eins.",
                    "suppression_2": "Vertuschung zwei.",
                    "payoff": "Aufloesung zwei.",
                    "artifact": "ein zweites Testartefakt",
                    "location_detail": "eine zweite Testlandschaft",
                    "real_person": {"name": "Reale Person", "description": "eine Testbeschreibung"},
                    "category": "Test",
                    "hashtags": ["#zwei"],
                },
            ]
        },
    )
    monkeypatch.setattr(tc, "TIKTOK_TOPICS_PATH", str(path))
    return path


def empty_state():
    return {"posted_topic_ids": []}


def test_pick_next_topic_cycles_before_repeating(topics_file):
    state = empty_state()
    seen = {tc.pick_next_topic(state)["id"] for _ in range(2)}
    assert seen == {1, 2}
    # Alle Themen wurden gezeigt -> naechster Aufruf resettet den Zyklus statt zu crashen
    third = tc.pick_next_topic(state)
    assert third["id"] in {1, 2}


def test_build_beats_has_nine_beats_with_text_and_prompt(topics_file):
    topics = json.load(open(topics_file, encoding="utf-8"))["topics"]
    beats = tc.build_beats(topics[0])
    assert len(beats) == 9
    for beat in beats:
        assert beat["text"]
        assert beat["image_prompt"]
        assert tc.STYLE_PREFIX in beat["image_prompt"]


def test_build_beats_uses_real_person_description_consistently(topics_file):
    topics = json.load(open(topics_file, encoding="utf-8"))["topics"]
    real_person_topic = topics[1]
    beats = tc.build_beats(real_person_topic)
    description = real_person_topic["real_person"]["description"]
    # Beats mit sichtbarer Person (Hook, Fund, Reaktion, Aufloesung) muessen
    # dieselbe reale Personenbeschreibung nutzen statt eine zufaellige.
    for i in (0, 3, 4, 7):
        assert description in beats[i]["image_prompt"]


def test_build_beats_randomizes_fictional_characters_across_calls(topics_file):
    topics = json.load(open(topics_file, encoding="utf-8"))["topics"]
    fictional_topic = topics[0]
    prompts = {tc.build_beats(fictional_topic)[0]["image_prompt"] for _ in range(20)}
    # Bei einem fiktiven Thema sollten sich die zufaelligen Charaktere ueber
    # mehrere Aufrufe hinweg unterscheiden (nicht garantiert bei jedem einzelnen
    # Lauf, aber bei 20 Versuchen so gut wie sicher).
    assert len(prompts) > 1


def test_build_caption_includes_hook_and_hashtags(topics_file):
    topics = json.load(open(topics_file, encoding="utf-8"))["topics"]
    caption = tc.build_caption(topics[0])
    assert topics[0]["hook"] in caption
    assert "#eins" in caption
    assert tc.HANDLE in caption


def test_build_beats_includes_topic_artifact_in_visual_beats(topics_file):
    topics = json.load(open(topics_file, encoding="utf-8"))["topics"]
    beats = tc.build_beats(topics[0])
    artifact = topics[0]["artifact"]
    # Hook, Fund, Reaktion und Aufloesung muessen das konkrete Artefakt zeigen,
    # nicht nur ein generisches "ancient artifact" (Regressionstest fuer den
    # Bug, dass z.B. der "Astronaut von Palenque" nie im Bild zu sehen war).
    for i in (0, 3, 4, 7):
        assert artifact in beats[i]["image_prompt"]


def test_random_character_description_is_nonempty_string():
    desc = tc.random_character_description()
    assert isinstance(desc, str)
    assert len(desc) > 10


def test_build_beats_marks_exactly_the_artifact_holding_beats_as_critical(topics_file):
    topics = json.load(open(topics_file, encoding="utf-8"))["topics"]
    beats = tc.build_beats(topics[0])
    critical_indices = {i for i, b in enumerate(beats) if b["critical"]}
    # Nur Hook, Fund, Reaktion, Aufloesung zeigen eine Person mit dem Artefakt
    # in der Hand - das braucht Higgsfield. Alle anderen sind reine
    # Umgebungs-/Symbolbilder und laufen kostenlos.
    assert critical_indices == {0, 3, 4, 7}


def test_build_beats_non_critical_beats_have_short_free_prompt(topics_file):
    topics = json.load(open(topics_file, encoding="utf-8"))["topics"]
    beats = tc.build_beats(topics[0])
    for i, beat in enumerate(beats):
        if beat["critical"]:
            continue
        assert "free_image_prompt" in beat
        assert beat["free_image_prompt"].startswith(tc.FREE_STYLE_PREFIX)
        # Das selbst gehostete Modell schneidet nach ca. 77 Tokens hart ab -
        # der freie Prompt muss deutlich kuerzer sein als der volle Higgsfield-Prompt.
        assert len(beat["free_image_prompt"].split()) < 40

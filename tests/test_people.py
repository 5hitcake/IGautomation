import io
import json
import random

import people_generate as pg
from PIL import Image


def test_persona_is_always_adult_and_complete():
    rng = random.Random(1)
    state = {"recent": []}
    for _ in range(300):
        p = pg.roll_persona(state, rng)
        assert 20 <= p["age"] <= 85
        assert p["gender"] in pg.GENDERS
        assert p["name"]
        state["recent"].append({k: p[k] for k in ("gender", "age_range", "heritage", "setting")})


def test_consecutive_personas_differ():
    rng = random.Random(7)
    state = {"recent": []}
    people = []
    for _ in range(200):
        p = pg.roll_persona(state, rng)
        people.append(p)
        state["recent"].append({k: p[k] for k in ("gender", "age_range", "heritage", "setting")})
    for a, b in zip(people, people[1:]):
        assert a["heritage"] != b["heritage"]
        assert a["setting"] != b["setting"]
    for a, b, c in zip(people, people[1:], people[2:]):
        assert not (a["gender"] == b["gender"] == c["gender"])


def test_mix_covers_many_heritages_and_both_genders():
    rng = random.Random(3)
    state = {"recent": []}
    seen, genders = set(), set()
    for _ in range(150):
        p = pg.roll_persona(state, rng)
        seen.add(p["heritage"][0])
        genders.add(p["gender"])
        state["recent"].append({k: p[k] for k in ("gender", "age_range", "heritage", "setting")})
    assert len(seen) >= len(pg.HERITAGES) - 3
    assert genders == {"woman", "man"}


def test_every_heritage_has_names():
    for _, group in pg.HERITAGES:
        women, men = pg.FIRST_NAMES[group]
        assert women and men


def test_prompt_and_caption():
    p = pg.roll_persona({"recent": []}, random.Random(5))
    prompt = pg.build_prompt(p)
    assert f"{p['age']}-year-old" in prompt and "photorealistic" in prompt
    caption = pg.build_caption(p, 42, random.Random(5))
    assert "Person No. 0042" in caption
    assert pg.DISCLOSURE in caption
    assert "#thispersondoesnotexist" in caption
    assert len(caption) < 2200  # Instagram-Limit
    assert caption.count("#") <= 30


def test_instagram_jpeg_is_4_by_5():
    for size in [(896, 1152), (1024, 1024), (1088, 1360)]:
        buf = io.BytesIO()
        Image.new("RGB", size, (10, 20, 30)).save(buf, format="PNG")
        out = Image.open(io.BytesIO(pg.to_instagram_jpeg(buf.getvalue())))
        assert out.size == pg.OUTPUT_SIZE and out.format == "JPEG"


def test_model_fallback(monkeypatch):
    calls = []

    def fake(model, prompt, account_id, api_token):
        calls.append(model)
        if len(calls) == 1:
            raise RuntimeError("quota")
        return b"img"

    monkeypatch.setattr(pg, "generate_cloudflare", fake)
    img, model = pg.generate_image("x", "a", "t")
    assert img == b"img" and calls == pg.MODEL_CHAIN[:2] and model == pg.MODEL_CHAIN[1]


def test_quota_exhausted_stops_early(monkeypatch):
    calls = []

    def fake(model, prompt, account_id, api_token):
        calls.append(model)
        raise RuntimeError("HTTP 429: you have used up your daily free allocation of 10,000 neurons")

    monkeypatch.setattr(pg, "generate_cloudflare", fake)
    try:
        pg.generate_image("x", "a", "t")
    except RuntimeError:
        pass
    assert len(calls) == 1


def test_main_dry_run_writes_post(tmp_path, monkeypatch):
    monkeypatch.setattr(pg, "STATE_PATH", str(tmp_path / "log.json"))
    monkeypatch.setattr(pg, "GENERATED_DIR", str(tmp_path / "gen"))
    monkeypatch.setattr("sys.argv", ["people_generate.py", "--dry-run"])
    for _ in range(pg.KEEP_IMAGES + 2):
        pg.main()
    post = json.loads((tmp_path / "gen" / "next_post.json").read_text())
    assert post["type"] == "image" and post["file"].startswith("assets/people_generated/person_")
    assert len(list((tmp_path / "gen").glob("person_*.jpg"))) <= pg.KEEP_IMAGES
    state = json.loads((tmp_path / "log.json").read_text())
    assert state["count"] == pg.KEEP_IMAGES + 2


def test_indoor_settings_get_indoor_light():
    assert pg.INDOOR_SETTINGS <= set(pg.SETTINGS)
    rng = random.Random(11)
    for _ in range(300):
        p = pg.roll_persona({"recent": []}, rng)
        pool = pg.INDOOR_LIGHTING if p["setting"] in pg.INDOOR_SETTINGS else pg.OUTDOOR_LIGHTING
        assert p["lighting"] in pool

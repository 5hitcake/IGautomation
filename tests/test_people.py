import io
import json
import random

import people_generate as pg
import pytest
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
    assert len(seen) >= len(pg.HERITAGES) - 6
    assert genders == {"woman", "man"}


def test_regions_rotate_and_western_faces_appear():
    rng = random.Random(11)
    state = {"recent": []}
    regions = []
    for _ in range(400):
        p = pg.roll_persona(state, rng)
        regions.append(pg.REGION_OF[p["heritage"][0]])
        state["recent"].append({k: p[k] for k in ("gender", "age_range", "heritage", "setting")})
    for a, b, c in zip(regions, regions[1:], regions[2:]):
        if c != pg.FREQUENT_REGION:
            assert c not in (a, b)  # andere Regionen erst nach 2 anderen Personen wieder
        else:
            assert not (a == b == c)  # Europa/westlich hoechstens 2x am Stueck
    share = regions.count("europe_west") / len(regions)
    assert 0.38 <= share <= 0.52
    assert set(regions) == set(pg.REGIONS)
    western = [i for i, r in enumerate(regions) if r == "europe_west"]
    assert max(b - a for a, b in zip(western, western[1:])) <= 10  # nie lange ohne westliche Person


def test_every_region_heritage_is_unique():
    names = [h[0] for h in pg.HERITAGES]
    assert len(names) == len(set(names))


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
    img, model = pg.generate_image("x", "a", "t", polli_token="")
    cf = [m for m in pg.MODEL_CHAIN if not m.startswith(pg.POLLI_PREFIX)]
    assert img == b"img" and calls == cf[:2] and model == cf[1]


def test_quota_exhausted_stops_early(monkeypatch):
    calls = []

    def fake(model, prompt, account_id, api_token):
        calls.append(model)
        raise RuntimeError("HTTP 429: you have used up your daily free allocation of 10,000 neurons")

    monkeypatch.setattr(pg, "generate_cloudflare", fake)
    try:
        pg.generate_image("x", "a", "t", polli_token="")
    except RuntimeError:
        pass
    assert len(calls) == 1


def test_pollinations_first_then_cloudflare(monkeypatch):
    calls = []

    def fake_polli(model, prompt, token):
        calls.append("polli:" + model)
        raise RuntimeError("HTTP 402: insufficient pollen")

    def fake_cf(model, prompt, account_id, api_token):
        calls.append(model)
        return b"img"

    monkeypatch.setattr(pg, "generate_pollinations", fake_polli)
    monkeypatch.setattr(pg, "generate_cloudflare", fake_cf)
    img, model = pg.generate_image("x", "a", "t", polli_token="tok")
    assert calls == ["@cf/black-forest-labs/flux-2-klein-9b"]  # Cloudflare zuerst
    assert model == "@cf/black-forest-labs/flux-2-klein-9b"


def test_pollinations_used_when_cloudflare_quota_empty(monkeypatch):
    calls = []

    def fake_polli(model, prompt, token):
        calls.append("polli:" + model)
        if "z-image" in model:
            raise RuntimeError("HTTP 500: upstream")
        return b"maiimg"

    def fake_cf(model, prompt, account_id, api_token):
        calls.append(model)
        raise RuntimeError("HTTP 429: daily free allocation used up")

    monkeypatch.setattr(pg, "generate_pollinations", fake_polli)
    monkeypatch.setattr(pg, "generate_cloudflare", fake_cf)
    img, model = pg.generate_image("x", "a", "t", polli_token="tok")
    assert img == b"maiimg" and model == "pollinations:microsoft/mai-image-2.6"
    assert calls == ["@cf/black-forest-labs/flux-2-klein-9b", "polli:tongyi-mai/z-image-turbo",
                     "polli:microsoft/mai-image-2.6"]


def test_age_hint():
    p = "photo of a 25-year-old man, shot on iPhone, photorealistic, real photograph"
    out = pg.with_age_hint(p)
    assert "looks exactly 25 years old" in out and out.index("looks exactly") < out.index("photorealistic")
    assert pg.with_age_hint("no age here") == "no age here"


def test_main_dry_run_writes_post(tmp_path, monkeypatch):
    monkeypatch.setattr(pg, "STATE_PATH", str(tmp_path / "log.json"))
    monkeypatch.setattr(pg, "GENERATED_DIR", str(tmp_path / "gen"))
    monkeypatch.setattr("sys.argv", ["people_generate.py", "--dry-run"])
    for _ in range(pg.KEEP_IMAGES + 2):
        pg.main()
    post = json.loads((tmp_path / "gen" / "next_post.json").read_text())
    assert post["type"] == "image" and post["file"].startswith("assets/people_generated/person_")
    assert post["number"] == pg.KEEP_IMAGES + 2 and post["name"] and post["age"]
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


def test_traits_mostly_everyday_and_bold_only_sometimes():
    rng = random.Random(21)
    n = 2000
    plain = bold = 0
    for _ in range(n):
        p = pg.roll_persona({"recent": []}, rng)
        prompt = pg.build_prompt(p)
        assert "with wearing" not in prompt
        bold_items = [t for t in p["traits"] if any(t in v for v in pg.BOLD_TRAITS.values())]
        bold_hair = any(c in p["hair"] for c in pg.BOLD_HAIR_COLORS)
        assert len(bold_items) + bold_hair <= 1  # nie zwei auffaellige Merkmale
        assert p["bold"] == bool(bold_items or bold_hair)
        if p.get("headwear"):
            gender, groups = pg.HEADWEAR[p["hair"]]
            assert gender == p["gender"] and p["heritage"][1] in groups
            assert "dyed" not in p["hair"]
        if not p["traits"] and "dyed" not in p["hair"] and not p.get("headwear"):
            plain += 1
        bold += p["bold"]
    assert 0.38 < plain / n < 0.58  # rund die Haelfte ganz alltaeglich
    assert 0.10 < bold / n < 0.18  # auffaellig nur ab und zu


def test_men_get_no_womenswear():
    rng = random.Random(4)
    for _ in range(400):
        p = pg.roll_persona({"recent": []}, rng)
        if p["gender"] == "man":
            assert "blouse" not in p["clothing"] and "dress" not in p["clothing"]


def test_no_double_glasses_or_piercings():
    rng = random.Random(8)
    for _ in range(1000):
        prompt = pg.build_prompt(pg.roll_persona({"recent": []}, rng))
        assert prompt.count("glasses") <= 1


def test_reserve_used_when_generation_fails(tmp_path, monkeypatch):
    monkeypatch.setenv("CLOUDFLARE_ACCOUNT_ID", "a")
    monkeypatch.setenv("CLOUDFLARE_API_TOKEN", "t")

    def quota_empty(prompt, account_id, api_token):
        raise RuntimeError("daily free allocation used up")

    monkeypatch.setattr(pg, "generate_image", quota_empty)
    monkeypatch.setattr(pg, "STATE_PATH", str(tmp_path / "log.json"))
    monkeypatch.setattr(pg, "GENERATED_DIR", str(tmp_path / "gen"))
    state = {"count": 9, "recent": []}
    cand = pg.create_candidate(state)
    assert cand["reserve"] == "reserve_01" and cand["model"] == "reserve"
    assert "Person No. 0010" in cand["caption"] and '"Nia", 73' in cand["caption"]
    # Beim Neu-Wuerfeln (🔄) wird das gerade gezeigte Reservebild uebersprungen
    assert pg.create_candidate(state, skip_reserve={"reserve_01"})["reserve"] == "reserve_02"
    pg.finalize(state, cand)
    assert state["reserve_used"] == ["reserve_01"] and state["count"] == 10
    assert pg.create_candidate(state)["reserve"] == "reserve_02"


def test_no_reserve_left_raises(monkeypatch):
    monkeypatch.setenv("CLOUDFLARE_ACCOUNT_ID", "a")
    monkeypatch.setenv("CLOUDFLARE_API_TOKEN", "t")
    monkeypatch.setattr(pg, "generate_image", lambda *a: (_ for _ in ()).throw(RuntimeError("quota")))
    used = [f"reserve_0{i}" for i in range(1, 6)]
    with pytest.raises(RuntimeError, match="Keine Reservebilder"):
        pg.create_candidate({"recent": [], "reserve_used": used})


def test_reserve_images_are_instagram_ready():
    data = json.loads(open(f"{pg.RESERVE_DIR}/reserve.json", encoding="utf-8").read())
    assert len(data["images"]) >= 5
    for entry in data["images"]:
        img = Image.open(f"{pg.RESERVE_DIR}/{entry['file']}")
        assert img.size == pg.OUTPUT_SIZE
        assert 20 <= entry["age"] <= 85


def test_ages_lean_young_but_stay_mixed():
    rng = random.Random(4)
    state = {"recent": []}
    ages = []
    for _ in range(600):
        p = pg.roll_persona(state, rng)
        ages.append(p["age"])
        state["recent"].append({k: p[k] for k in ("gender", "age_range", "heritage", "setting")})
    assert 29 <= sum(ages) / len(ages) <= 38
    assert sum(a < 30 for a in ages) / len(ages) >= 0.4
    assert any(a >= 60 for a in ages)  # aeltere Gesichter weiter dabei


def test_no_aging_features_for_young_people():
    rng = random.Random(8)
    for _ in range(400):
        p = pg.roll_persona({"recent": []}, rng)
        prompt = pg.build_prompt(p)
        assert f"looks exactly {p['age']} years old" in prompt
        if p["age"] < pg.AGING_MIN_AGE:
            assert not any(w in prompt for w in pg.AGING_WORDS), prompt
            assert "grey hair" not in prompt
        if p["age"] < 30:
            assert f"{p['age']}-year-old young " in prompt


def test_no_injury_wording_in_traits():
    import re

    pools = [pg.DETAILS]
    pools += list(pg.SUBTLE_TRAITS.values()) + list(pg.BOLD_TRAITS.values())
    bad = re.compile(
        r"\b(scar|scars|cut|wound|blood|bruise|stitches|scratch|mole|beauty mark|birthmark|blemish\w*)\b",
        re.I,
    )
    for pool in pools:
        for item in pool:
            assert not bad.search(item), item
    assert "no wounds" in pg.PROMPT_TAIL

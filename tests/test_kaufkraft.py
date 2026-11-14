import json
import os

import kaufkraft_data as kd
import kaufkraft_photos as kph
import kaufkraft_post as kp
import pytest


def monthly(year_values):
    """{'2001': 50, ...} -> konstante Monatswerte fuer jedes Jahr."""
    return {f"{y}-{m:02d}": v for y, v in year_values.items() for m in range(1, 13)}


def test_parse_jsonstat_maps_flat_index():
    data = {
        "id": ["coicop18", "time"],
        "size": [2, 2],
        "dimension": {
            "coicop18": {"category": {"index": {"A": 0, "B": 1}}},
            "time": {"category": {"index": {"2001-01": 0, "2001-02": 1}}},
        },
        "value": {"0": 1.0, "1": 2.0, "3": 4.0},
    }
    out = kd.parse_jsonstat(data, ["coicop18"])
    assert out[("A",)] == {"2001-01": 1.0, "2001-02": 2.0}
    assert out[("B",)] == {"2001-02": 4.0}


def test_chain_extends_series_with_parent():
    parent = monthly({"2001": 50, "2015": 100, "2025": 150})
    own = monthly({"2015": 200, "2025": 260})
    chained = kd.chain(own, parent)
    assert chained["2001-06"] == pytest.approx(100)  # 50 * 200/100
    assert chained["2025-06"] == 260  # eigene Werte bleiben


def test_product_prices_from_index():
    indices = {
        "CP01152": monthly({"2015": 100, "2025": 200}),
        "CP0115": monthly({"2001": 50, "2010": 75, "2015": 100, "2025": 200}),
    }
    product = {"id": "butter", "coicop": "CP01152", "price": 2.00, "price_period": "2025"}
    r = kd.product_prices(product, indices)
    assert r["2001"] == 0.50
    assert r["2010"] == 0.75
    assert r["today"] == 2.00
    assert r["pct_2001"] == pytest.approx(300)


def test_known_prices_override_index():
    indices = {"CP07411": monthly({"2001": 10, "2010": 10, "2015": 100, "2025": 100})}
    product = {"id": "briefmarke", "coicop": "CP07411", "price": 0.95, "price_period": "2025",
               "known_prices": {"2001": 0.56, "2010": 0.55, "source": "x"}}
    r = kd.product_prices(product, indices)
    assert (r["2001"], r["2010"], r["method"]) == (0.56, 0.55, "known")


def test_incomplete_year_gives_no_average():
    assert kd.annual_average({"2026-01": 1.0}, "2026") is None


def test_formatting_is_german():
    assert kd.fmt_eur(1234.5) == "1.234,50 €"
    assert kd.fmt_pct(103.94) == "+103,9 %"
    assert kd.fmt_pct(-2.5) == "−2,5 %"
    assert kd.period_label("2026-09") == "September 2026"


def test_product_list_is_valid():
    products = kd.load_products()
    ids = [p["id"] for p in products]
    assert len(ids) == len(set(ids))
    for p in products:
        assert p["coicop"].startswith("CP") and p["price"] > 0 and p["prompt"]


def test_pick_product_cycles_without_repeats():
    products = [{"id": "a"}, {"id": "b"}]
    state = {"posted_products": ["a"]}
    assert kp.pick_product(products, state)["id"] == "b"
    state = {"posted_products": ["a", "b"]}
    kp.pick_product(products, state)
    assert state["posted_products"] == []


def test_product_post_renders_offline(tmp_path, monkeypatch):
    series = monthly({"2001": 50, "2010": 75, "2015": 100, "2025": 200})
    monkeypatch.setattr(kd, "fetch_indices", lambda codes, **kw: {c: series for c in codes})
    monkeypatch.delenv("CLOUDFLARE_ACCOUNT_ID", raising=False)
    monkeypatch.setattr(kp, "PHOTOS_DIR", str(tmp_path / "photos"))
    products = kd.load_products()
    state = {}
    path, caption, pid, reel = kp.make_product_post(products, state, "butter", str(tmp_path))
    assert reel is None
    assert os.path.exists(path) and pid == "butter"
    assert "2001: 0,52 €" in caption and "Keine Anlageberatung" in caption
    assert state["posted_products"] == ["butter"]


@pytest.mark.parametrize("kind", kp.INFLATION_KINDS)
def test_inflation_posts_render_offline(tmp_path, monkeypatch, kind):
    series = monthly({"2001": 50, "2010": 75, "2020": 90, "2025": 100, "2026": 104})
    monkeypatch.setattr(kd, "fetch_indices", lambda codes, **kw: {c: series for c in codes})
    rates = {f"2026-{m:02d}": 2.0 + m / 10 for m in range(1, 10)}
    monkeypatch.setattr(kd, "fetch_annual_rates",
                        lambda codes, geos, since=None, **kw: {(c, g): rates for c in codes for g in geos})
    path, caption, _ = kp.make_inflation_post(kd.load_products(), {}, kind, str(tmp_path))
    assert os.path.exists(path)
    assert "Eurostat" in caption


def test_write_post_points_to_repo_relative_file(tmp_path, monkeypatch):
    monkeypatch.setattr(kp, "GENERATED_DIR", str(tmp_path))
    img = os.path.join(kp.ROOT, "assets", "kaufkraft_generated", "x.jpg")
    kp.write_post(img, "hallo")
    with open(tmp_path / "next_post.json", encoding="utf-8") as f:
        post = json.load(f)
    assert post == {"type": "image", "file": "assets/kaufkraft_generated/x.jpg", "caption": "hallo"}


def jpeg_bytes():
    import io

    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (1200, 800), (200, 100, 50)).save(buf, "JPEG")
    return buf.getvalue()


def fake_generator(product):
    from PIL import Image

    return Image.new("RGB", (1536, 864), (240, 220, 180)), "test-model"


def test_generated_image_is_saved_and_labelled(tmp_path):
    prod = {"id": "butter", "name": "Butter", "prompt": "a block of butter"}
    path = kph.fetch_photo(prod, str(tmp_path), generator=fake_generator)
    assert os.path.exists(path)
    credit = kph.load_credits(str(tmp_path))["butter"]
    assert credit["model"] == "test-model"
    assert kph.credit_line(credit) == "Symbolbild (KI-generiert)"
    assert "a block of butter" in kph.prompt_for(prod)


def test_existing_own_photo_has_priority(tmp_path):
    own = tmp_path / "a.jpg"
    own.write_bytes(jpeg_bytes())

    def boom(product):
        raise AssertionError("darf nicht erzeugt werden")

    assert kph.fetch_photo({"id": "a", "name": "A"}, str(tmp_path), generator=boom) == str(own)
    assert kph.credit_line(kph.load_credits(str(tmp_path)).get("a")) is None  # eigenes Foto: kein KI-Hinweis


def test_failed_generation_falls_back_to_placeholder(tmp_path):
    def boom(product):
        raise RuntimeError("Kontingent leer")

    assert kph.fetch_photo({"id": "a", "name": "A"}, str(tmp_path), generator=boom) is None


def test_overview_sheet(tmp_path):
    (tmp_path / "a.jpg").write_bytes(jpeg_bytes())
    out = kph.make_overview([{"id": "a"}, {"id": "b"}], str(tmp_path))
    assert os.path.exists(out)


def test_pick_product_prefers_products_with_photo(tmp_path, monkeypatch):
    monkeypatch.setattr(kp, "PHOTOS_DIR", str(tmp_path))
    (tmp_path / "b.jpg").write_bytes(jpeg_bytes())
    for _ in range(5):
        assert kp.pick_product([{"id": "a"}, {"id": "b"}], {})["id"] == "b"


def test_story_is_9_16_jpeg_and_points_to_post(tmp_path, monkeypatch):
    import kaufkraft_story as ks
    from PIL import Image

    gen = tmp_path / "assets" / "kaufkraft_generated"
    gen.mkdir(parents=True)
    Image.new("RGB", (1080, 1350), (240, 230, 210)).save(gen / "produkt_20261112_butter.jpg")
    (gen / "next_post.json").write_text(json.dumps(
        {"type": "image", "file": "assets/kaufkraft_generated/produkt_20261112_butter.jpg", "caption": "x"}))
    monkeypatch.setattr(ks, "ROOT", str(tmp_path))
    monkeypatch.setattr(ks, "GENERATED_DIR", str(gen))
    ks.main()
    story = json.loads((gen / "next_story.json").read_text())
    assert story == {"type": "story", "file": "assets/kaufkraft_generated/story_produkt_20261112_butter.jpg"}
    img = Image.open(tmp_path / story["file"])
    assert img.size == (1080, 1920) and img.format == "JPEG"


def test_reserved_product_is_picked_next_and_cleared(tmp_path, monkeypatch):
    series = monthly({"2001": 50, "2010": 75, "2015": 100, "2025": 200})
    monkeypatch.setattr(kd, "fetch_indices", lambda codes, **kw: {c: series for c in codes})
    monkeypatch.delenv("CLOUDFLARE_ACCOUNT_ID", raising=False)
    monkeypatch.setattr(kp, "PHOTOS_DIR", str(tmp_path / "photos"))
    state = {"next_product": "kino"}
    assert kp.pick_product(kd.load_products(), state)["id"] == "kino"
    _, _, pid, _ = kp.make_product_post(kd.load_products(), state, out_dir=str(tmp_path))
    assert pid == "kino" and "next_product" not in state


def test_reel_post_json_points_to_media_branch(tmp_path, monkeypatch):
    import kaufkraft_reel as kreel

    monkeypatch.setattr(kp, "GENERATED_DIR", str(tmp_path))
    card = os.path.join(kp.ROOT, "assets", "kaufkraft_generated", "produkt_x.jpg")
    kp.write_post(card, "hallo", reel=str(tmp_path / "reel_x.mp4"))
    post = json.loads((tmp_path / "next_post.json").read_text())
    assert post["type"] == "reel" and post["file"] == "reel_x.mp4"
    assert post["branch"] == kreel.MEDIA_BRANCH and post["card"] == "assets/kaufkraft_generated/produkt_x.jpg"


@pytest.mark.parametrize("t", [0.0, 2.9, 5.0, 8.8, 11.5])
def test_reel_frames_render(tmp_path, t):
    import kaufkraft_reel as kreel
    from PIL import Image

    prices = {"today": 7.32, "2001": 3.62, "2010": 4.21, "pct_2001": 102.2, "pct_2010": 73.9,
              "latest_period": "2026-09"}
    out = kreel.render_still({"id": "doener", "name": "Döner", "amount": "1 Stück"}, prices, None,
                             str(tmp_path / "f.jpg"), kd.fmt_eur, kd.fmt_pct, t)
    assert Image.open(out).size == (1080, 1920)


def test_reel_audio_has_full_length():
    import kaufkraft_reel as kreel

    audio = kreel.synth_audio([("2001", 1), ("2010", 2), ("HEUTE", 3)], True)
    assert len(audio) == int(kreel.DURATION * kreel.RATE) and abs(int(audio.max())) > 1000


def test_tiktok_caption_is_short_and_lands_in_reel_post(tmp_path, monkeypatch):
    prices = {"today": 7.32, "2001": 3.62, "pct_2001": 102.2}
    text = kp.tiktok_caption({"id": "doener", "name": "Döner", "amount": "1 Stück"}, prices)
    assert "2001 3,62 € → heute 7,32 € (+102,2 %)" in text and len(text) < 300
    monkeypatch.setattr(kp, "GENERATED_DIR", str(tmp_path))
    kp.write_post(os.path.join(kp.ROOT, "x.jpg"), "lang", reel=str(tmp_path / "r.mp4"), tiktok=text)
    assert json.loads((tmp_path / "next_post.json").read_text())["tiktok_caption"] == text

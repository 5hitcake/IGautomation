import json
import os

import kaufkraft_data as kd
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
    path, caption, pid = kp.make_product_post(products, state, "butter", str(tmp_path))
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

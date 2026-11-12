"""Erzeugt den naechsten Post fuer @kaufkraft.check und schreibt
assets/kaufkraft_generated/next_post.json fuer publish.py.

  Mo-Sa: Produkt-Vergleich (Foto + Preis 2001 / 2010 / heute + %)
  So:    Inflation der Woche (rotiert: aktuelle Rate, Kaufkraft von 100 EUR,
         Preistreiber, Europa-Vergleich)

Produktfotos (echte Fotos) liegen in assets/kaufkraft_products/<id>.jpg. Fehlt
eins, holt scripts/kaufkraft_photos.py es von Pexels (PEXELS_API_KEY) bzw.
Openverse und nennt den Fotografen auf Grafik und in der Caption.

Nutzung:
  python kaufkraft_post.py                    (automatisch nach Wochentag)
  python kaufkraft_post.py --kind product     (Produkt erzwingen)
  python kaufkraft_post.py --kind inflation   (Wochen-Post erzwingen)
  python kaufkraft_post.py --product butter   (bestimmtes Produkt)
  python kaufkraft_post.py --preview          (alle Formate in einen Ordner rendern)
"""
import argparse
import json
import os
import random
from datetime import datetime, timezone

import kaufkraft_data as kd
import kaufkraft_photos as kph
import kaufkraft_render as kr

ROOT = kd.ROOT
GENERATED_DIR = os.path.join(ROOT, "assets", "kaufkraft_generated")
PHOTOS_DIR = os.path.join(ROOT, "assets", "kaufkraft_products")
STATE_PATH = os.path.join(ROOT, "kaufkraft_posted_log.json")
INFLATION_KINDS = ["rate", "purchasing_power", "movers", "europe"]
KEEP_IMAGES = 6

HASHTAGS = {
    "core": ["#kaufkraft", "#inflation", "#preise", "#euro", "#teuer"],
    "extra": ["#früherwaralles", "#preisvergleich", "#lebenshaltungskosten", "#sparen",
              "#geld", "#finanzen", "#deutschland", "#wirtschaft", "#verbraucher",
              "#supermarkt", "#einkaufen", "#preiserhöhung", "#2001", "#nostalgie"],
}
DISCLAIMER = ("Preise 2001/2010 und heute berechnet aus dem offiziellen Verbraucherpreisindex "
              "(Eurostat HVPI, Deutschland). Einzelpreise im Laden können abweichen. "
              "Keine Anlageberatung.")


def load_state():
    if os.path.exists(STATE_PATH):
        with open(STATE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"posted_products": [], "inflation_index": 0, "history": []}


def save_state(state):
    with open(STATE_PATH, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)
        f.write("\n")


def has_photo(product):
    return os.path.exists(os.path.join(PHOTOS_DIR, f"{product['id']}.jpg"))


def pick_product(products, state, rng=random):
    """Zufaelliges, noch nicht gepostetes Produkt. Produkte mit (geprueftem) Foto
    im Repo kommen zuerst dran; ohne Foto wird es beim Posten automatisch geholt."""
    posted = set(state.get("posted_products", []))
    unused = [p for p in products if p["id"] not in posted]
    if not unused:
        state["posted_products"] = []
        unused = products
    with_photo = [p for p in unused if has_photo(p)]
    return rng.choice(with_photo or unused)


def hashtags(rng=random, extra=()):
    tags = list(HASHTAGS["core"]) + rng.sample(HASHTAGS["extra"], 6) + list(extra)
    return " ".join(dict.fromkeys(tags))


def ensure_photo(product):
    """Pfad zum echten Produktfoto oder None (dann zeichnet die Karte einen Platzhalter)."""
    return kph.fetch_photo(product, PHOTOS_DIR)


def photo_credit(product):
    return kph.credit_line(kph.load_credits(PHOTOS_DIR).get(product["id"]))


def product_caption(product, prices, rng=random, credit=None):
    name = f"{product['name']} ({product['amount']})"
    stand = kd.period_label(prices["latest_period"])
    lines = [f"{name}: Was hat das früher gekostet? 💶", ""]
    if prices.get("2001"):
        lines.append(f"2001: {kd.fmt_eur(prices['2001'])}")
    if prices.get("2010"):
        lines.append(f"2010: {kd.fmt_eur(prices['2010'])}")
    lines.append(f"Heute ({stand}): {kd.fmt_eur(prices['today'])}")
    lines.append("")
    if prices.get("pct_2001") is not None:
        lines.append(f"📈 {kd.fmt_pct(prices['pct_2001'])} seit 2001")
    if prices.get("pct_2010") is not None:
        lines.append(f"📈 {kd.fmt_pct(prices['pct_2010'])} seit 2010")
    lines += ["", "Hättest du gedacht, dass es so viel ist? Schreib's in die Kommentare 👇", "",
              "Folge @kaufkraft.check für täglich einen Preis-Check.", "",
              f"ℹ️ {DISCLAIMER}" if prices.get("method") != "known"
              else f"ℹ️ Quelle 2001/2010: {product['known_prices']['source']}. Heute: Eurostat HVPI.",
              ]
    if credit:
        lines.append(f"📷 {credit}")
    lines += ["", hashtags(rng, [f"#{product['id'].replace('_', '')}"])]
    return "\n".join(lines)


def inflation_data(kind, products):
    """Holt die Daten fuer den Wochen-Post der gegebenen Art."""
    if kind == "rate":
        since = f"{datetime.now(timezone.utc).year - 3}-01"
        rates = kd.fetch_annual_rates(("TOTAL",), ("DE",), since=since)[("TOTAL", "DE")]
        periods = sorted(p for p, v in rates.items() if v is not None)
        hist = [(p, rates[p]) for p in periods[-24:]]
        return {"period": periods[-1], "rate": rates[periods[-1]], "history": hist}
    if kind == "purchasing_power":
        total = kd.fetch_indices(["TOTAL"])["TOTAL"]
        latest = kd.latest_period(total)
        rows = [(y, 100 * kd.annual_average(total, y) / total[latest]) for y in ("2001", "2010", "2020")]
        return {"period": latest, "rows": rows}
    if kind == "movers":
        indices = kd.fetch_indices(kd.needed_codes(products))
        items = []
        for p in products:
            s = indices.get(p["coicop"]) or {}
            if not s:
                continue
            latest = kd.latest_period(s)
            prev = f"{int(latest[:4]) - 1}{latest[4:]}"
            if s.get(prev):
                items.append((p["name"], kd.pct(s[latest], s[prev]), latest))
        items.sort(key=lambda t: t[1], reverse=True)
        top = items[:6]
        return {"period": top[0][2], "items": [(n, v) for n, v, _ in top]}
    if kind == "europe":
        latest = None
        rates = kd.fetch_annual_rates(("TOTAL",), kd.EU_COMPARE,
                                      since=f"{datetime.now(timezone.utc).year - 1}-01")
        # gemeinsamer neuester Monat, fuer den alle Laender Werte haben
        common = None
        for geo in kd.EU_COMPARE:
            ps = {p for p, v in rates.get(("TOTAL", geo), {}).items() if v is not None}
            common = ps if common is None else common & ps
        latest = max(common)
        items = [(kd.GEO_NAMES[g], rates[("TOTAL", g)][latest]) for g in kd.EU_COMPARE]
        items.sort(key=lambda t: t[1], reverse=True)
        return {"period": latest, "items": items}
    raise ValueError(kind)


def inflation_caption(kind, data, rng=random):
    stand = kd.period_label(data["period"])
    if kind == "rate":
        head = f"Inflation in Deutschland: {kd.fmt_pct(data['rate'], signed=False)} 📊"
        body = (f"So stark sind die Verbraucherpreise im {stand} im Vergleich zum Vorjahresmonat "
                "gestiegen. Die Grafik zeigt die Entwicklung der letzten 24 Monate.")
    elif kind == "purchasing_power":
        r01 = data["rows"][0][1]
        head = f"100 € aus 2001 sind heute nur noch {kd.fmt_eur(r01)} wert 💸"
        body = ("So viel Kaufkraft hat Geld verloren, das einfach nur liegt. "
                + " ".join(f"100 € aus {y}: heute {kd.fmt_eur(v)}." for y, v in data["rows"]))
    elif kind == "movers":
        head = "Die größten Preistreiber im Jahresvergleich 🔥"
        body = " · ".join(f"{n} {kd.fmt_pct(v)}" for n, v in data["items"])
    else:
        de = dict(data["items"]).get("Deutschland")
        head = f"Inflation in Europa: Deutschland liegt bei {kd.fmt_pct(de, signed=False)} 🇪🇺"
        body = " · ".join(f"{n} {kd.fmt_pct(v, signed=False)}" for n, v in data["items"])
    return "\n".join([head, "", body, "", f"Stand: {stand}. Quelle: Eurostat (HVPI).",
                      "Wie spürst du die Inflation im Alltag? 👇", "",
                      "Folge @kaufkraft.check für täglich einen Preis-Check.", "",
                      hashtags(rng, ["#inflationsrate", "#verbraucherpreise"])])


def prune(directory, keep=KEEP_IMAGES):
    files = sorted((f for f in os.listdir(directory) if f.endswith(".jpg")),
                   key=lambda f: os.path.getmtime(os.path.join(directory, f)))
    for old in files[:-keep]:
        os.remove(os.path.join(directory, old))


def write_post(path, caption):
    rel = os.path.relpath(path, ROOT).replace("\\", "/")
    with open(os.path.join(GENERATED_DIR, "next_post.json"), "w", encoding="utf-8") as f:
        json.dump({"type": "image", "file": rel, "caption": caption}, f, ensure_ascii=False, indent=2)


def make_product_post(products, state, product_id=None, out_dir=GENERATED_DIR):
    if product_id:
        product = next(p for p in products if p["id"] == product_id)
    else:
        product = pick_product(products, state)
    indices = kd.fetch_indices(kd.needed_codes([product]))
    prices = kd.product_prices(product, indices)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    out = os.path.join(out_dir, f"produkt_{stamp}_{product['id']}.jpg")
    photo = ensure_photo(product)
    credit = photo_credit(product) if photo else None
    kr.render_product_card(product, prices, photo, out, kd.fmt_eur, kd.fmt_pct, kd.period_label, credit)
    if product["id"] not in state.setdefault("posted_products", []):
        state["posted_products"].append(product["id"])
    return out, product_caption(product, prices, credit=credit), product["id"]


def make_inflation_post(products, state, kind=None, out_dir=GENERATED_DIR):
    if kind is None:
        kind = INFLATION_KINDS[state.get("inflation_index", 0) % len(INFLATION_KINDS)]
        state["inflation_index"] = state.get("inflation_index", 0) + 1
    data = inflation_data(kind, products)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    out = os.path.join(out_dir, f"inflation_{stamp}_{kind}.jpg")
    kr.render_inflation_card(kind, data, out, kd.fmt_eur, kd.fmt_pct, kd.period_label)
    return out, inflation_caption(kind, data), kind


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--kind", choices=["auto", "product", "inflation"], default="auto")
    parser.add_argument("--product", help="Produkt-ID aus content/kaufkraft_products.json")
    parser.add_argument("--inflation-kind", choices=INFLATION_KINDS)
    parser.add_argument("--preview", metavar="ORDNER",
                        help="Alle 4 Wochen-Formate + einige Produkte in ORDNER rendern (ohne Log)")
    args = parser.parse_args()

    products = kd.load_products()

    if args.preview:
        os.makedirs(args.preview, exist_ok=True)
        dummy = {}
        for pid in (args.product.split(",") if args.product else ["butter", "benzin", "doener"]):
            path, caption, _ = make_product_post(products, dummy, pid, args.preview)
            with open(path.replace(".jpg", ".txt"), "w", encoding="utf-8") as f:
                f.write(caption)
        for kind in INFLATION_KINDS:
            path, caption, _ = make_inflation_post(products, dummy, kind, args.preview)
            with open(path.replace(".jpg", ".txt"), "w", encoding="utf-8") as f:
                f.write(caption)
        print(f"Vorschau unter {args.preview}")
        return

    os.makedirs(GENERATED_DIR, exist_ok=True)
    state = load_state()
    kind = args.kind
    if kind == "auto":
        berlin_weekday = datetime.now(timezone.utc).astimezone().weekday()
        try:
            from zoneinfo import ZoneInfo
            berlin_weekday = datetime.now(ZoneInfo("Europe/Berlin")).weekday()
        except Exception:  # noqa: BLE001
            pass
        kind = "inflation" if berlin_weekday == 6 else "product"

    if kind == "inflation" or args.inflation_kind:
        path, caption, what = make_inflation_post(products, state, args.inflation_kind)
    else:
        path, caption, what = make_product_post(products, state, args.product)

    write_post(path, caption)
    state.setdefault("history", []).append(
        {"date": datetime.now(timezone.utc).strftime("%Y-%m-%d"), "kind": kind, "what": what})
    state["history"] = state["history"][-100:]
    save_state(state)
    prune(GENERATED_DIR)
    print(f"Erstellt: {path}\n\n{caption}")


if __name__ == "__main__":
    main()

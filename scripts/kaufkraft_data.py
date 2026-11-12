"""Preisdaten fuer @kaufkraft.check aus dem offiziellen Verbraucherpreisindex.

Quelle: Eurostat, Harmonisierter Verbraucherpreisindex (HVPI), Datensatz
prc_hicp_minr (ECOICOP ver.2, monatlich, ab 1996). Frei nutzbar mit
Quellenangabe, kein API-Schluessel noetig.

Rechenweg fuer einen Produktpreis:
  Preis(Zeitraum) = Richtpreis * Index(Zeitraum) / Index(Monat des Richtpreises)
2001 und 2010 sind Jahresdurchschnitte, "heute" ist der neueste Monat.
"""
import json
import os
from functools import reduce

import requests

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
PRODUCTS_PATH = os.path.join(ROOT, "content", "kaufkraft_products.json")

API = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hicp_minr"
SOURCE_LABEL = "Eurostat HVPI (prc_hicp_minr)"
YEARS = ("2001", "2010")
EU_COMPARE = ["DE", "AT", "FR", "IT", "ES", "NL", "PL", "EA"]
GEO_NAMES = {
    "DE": "Deutschland", "AT": "Österreich", "FR": "Frankreich", "IT": "Italien",
    "ES": "Spanien", "NL": "Niederlande", "PL": "Polen", "EA": "Euroraum",
}
MONTHS_DE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli",
             "August", "September", "Oktober", "November", "Dezember"]


def load_products():
    with open(PRODUCTS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)["products"]


def parse_jsonstat(data, key_dims):
    """JSON-stat 2.0 -> {(wert_dim1, wert_dim2, ...): {zeitraum: wert}}.
    key_dims: Dimensionen, die den Schluessel bilden (z.B. ["coicop18"])."""
    dims = data["id"]
    sizes = data["size"]
    labels = {}
    for d in dims:
        index = data["dimension"][d]["category"]["index"]
        if isinstance(index, list):
            index = {k: i for i, k in enumerate(index)}
        labels[d] = {pos: code for code, pos in index.items()}
    strides = [reduce(lambda a, b: a * b, sizes[i + 1:], 1) for i in range(len(dims))]
    out = {}
    for flat, value in data.get("value", {}).items():
        flat = int(flat)
        coords = {d: labels[d][(flat // strides[i]) % sizes[i]] for i, d in enumerate(dims)}
        key = tuple(coords[d] for d in key_dims)
        out.setdefault(key, {})[coords["time"]] = value
    return out


def fetch(params, key_dims, session=None):
    session = session or requests
    resp = session.get(API, params=list(params) + [("format", "JSON"), ("lang", "EN")], timeout=60)
    resp.raise_for_status()
    return parse_jsonstat(resp.json(), key_dims)


def fetch_indices(codes, geo="DE", unit="I15", session=None):
    """{coicop: {"2001-01": 70.1, ...}} fuer die angegebenen Warengruppen."""
    params = [("geo", geo), ("unit", unit), ("freq", "M")] + [("coicop18", c) for c in codes]
    raw = fetch(params, ["coicop18"], session)
    return {k[0]: v for k, v in raw.items()}


def fetch_annual_rates(codes=("TOTAL",), geos=("DE",), since="2024-01", session=None):
    """Inflationsrate ggue. Vorjahresmonat: {(coicop, geo): {zeitraum: prozent}}."""
    params = [("unit", "RCH_A"), ("freq", "M"), ("sinceTimePeriod", since)]
    params += [("coicop18", c) for c in codes] + [("geo", g) for g in geos]
    return fetch(params, ["coicop18", "geo"], session)


def latest_period(series):
    return max(series)


def parent_code(code):
    """Uebergeordnete 4-Steller-Gruppe: 'CP01152' -> 'CP0115'."""
    return code[:6]


def needed_codes(products):
    codes = set()
    for p in products:
        codes.add(p["coicop"])
        codes.add(parent_code(p["coicop"]))
    return sorted(codes)


def chain(series, parent):
    """Verlaengert eine erst ab 2015 verfuegbare Produktreihe mit der Entwicklung
    der uebergeordneten Warengruppe nach hinten. Verknuepft wird ueber den
    Jahresdurchschnitt 2015 (Basisjahr beider Reihen)."""
    if not parent or parent is series:
        return dict(series)
    own = annual_average(series, "2015")
    par = annual_average(parent, "2015")
    if not own or not par:
        return dict(series)
    ratio = own / par
    start = min(series)
    out = {p: v * ratio for p, v in parent.items() if p < start and v is not None}
    out.update(series)
    return out


def annual_average(series, year):
    vals = [v for p, v in series.items() if p.startswith(f"{year}-") and v is not None]
    if len(vals) < 12:
        return None  # Jahr unvollstaendig -> lieber nichts zeigen als etwas Falsches
    return sum(vals) / len(vals)


def pct(new, old):
    return (new / old - 1) * 100


def product_series(product, indices):
    code = product["coicop"]
    own = indices.get(code)
    if not own:
        raise ValueError(f"{product['id']}: keine Eurostat-Daten fuer {code}")
    return chain(own, indices.get(parent_code(code)) if parent_code(code) != code else None)


def product_prices(product, indices):
    """Preise fuer 2001, 2010 und den neuesten Monat.
    Rueckgabe u.a.: today, '2001', '2010', pct_2001, pct_2010, latest_period, method."""
    series = product_series(product, indices)
    latest = latest_period(series)
    anchor_period = product["price_period"]
    if len(anchor_period) == 4:
        anchor_idx = annual_average(series, anchor_period)  # Jahresdurchschnitt
    else:
        if anchor_period > latest:
            anchor_period = latest  # Richtpreis neuer als die Daten -> gilt als "heute"
        anchor_idx = series.get(anchor_period)
    if not anchor_idx:
        raise ValueError(f"{product['id']}: kein Indexwert fuer {anchor_period}")
    factor = product["price"] / anchor_idx
    result = {"latest_period": latest, "today": round(series[latest] * factor, 2),
              "method": "index"}
    known = product.get("known_prices") or {}
    for year in YEARS:
        if year in known:
            result[year] = known[year]
            result["method"] = "known"
        else:
            avg = annual_average(series, year)
            result[year] = round(avg * factor, 2) if avg else None
    for year in YEARS:
        if result[year]:
            result[f"pct_{year}"] = pct(result["today"], result[year])
    result["chained"] = min(indices[product["coicop"]]) > f"{YEARS[0]}-01"
    return result


def period_label(period):
    """'2026-10' -> 'Oktober 2026'."""
    year, month = period.split("-")
    return f"{MONTHS_DE[int(month) - 1]} {year}"


def fmt_eur(value):
    """1234.5 -> '1.234,50 €' (deutsche Schreibweise)."""
    s = f"{value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"{s} €"


def fmt_pct(value, signed=True):
    s = f"{value:+.1f}" if signed else f"{value:.1f}"
    return s.replace(".", ",").replace("-", "−") + " %"


def purchasing_power(total_series, year="2001"):
    """Was 100 EUR aus dem Jahr X heute noch kaufen: 100 * Index(X) / Index(heute)."""
    latest = latest_period(total_series)
    base = annual_average(total_series, year)
    return 100 * base / total_series[latest], latest

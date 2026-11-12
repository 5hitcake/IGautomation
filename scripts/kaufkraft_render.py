"""Grafiken fuer @kaufkraft.check (1080x1350, Instagram-Hochformat).

- render_product_card: Produktfoto + Preise 2001 / 2010 / heute + Prozent
- render_inflation_card: Wochen-Post (aktuelle Rate, 100-Euro-Kaufkraft,
  Preistreiber, Europa-Vergleich)
"""
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
FONTS_DIR = os.path.join(ROOT, "assets", "fonts")

W, H = 1080, 1350
HANDLE = "@kaufkraft.check"

# Markenfarben
NAVY = (16, 27, 45)
NAVY_2 = (30, 45, 70)
CREAM = (246, 241, 232)
INK = (22, 26, 33)
MUTED = (110, 112, 118)
RED = (214, 64, 44)
RED_SOFT = (250, 226, 220)
GREEN = (36, 140, 90)
GOLD = (222, 170, 60)
WHITE = (255, 255, 255)


def font(weight, size):
    name = {"bold": "Poppins-Bold.ttf", "semi": "Poppins-SemiBold.ttf"}.get(weight, "Poppins-Regular.ttf")
    return ImageFont.truetype(os.path.join(FONTS_DIR, name), size)


def text_center(draw, x_center, y, text, fnt, fill):
    w = draw.textlength(text, font=fnt)
    draw.text((x_center - w / 2, y), text, font=fnt, fill=fill)


def fit_font(draw, text, weight, max_size, max_width, min_size=28):
    size = max_size
    while size > min_size and draw.textlength(text, font=font(weight, size)) > max_width:
        size -= 2
    return font(weight, size)


def cover(img, size):
    sw, sh = img.size
    tw, th = size
    scale = max(tw / sw, th / sh)
    img = img.resize((round(sw * scale), round(sh * scale)), Image.LANCZOS)
    left = (img.width - tw) // 2
    top = (img.height - th) // 2
    return img.crop((left, top, left + tw, top + th))


def rounded_paste(base, img, box, radius):
    x0, y0, x1, y1 = box
    img = cover(img, (x1 - x0, y1 - y0))
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, img.width, img.height), radius, fill=255)
    # weicher Schatten
    shadow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((x0 + 6, y0 + 14, x1 + 6, y1 + 14), radius, fill=(0, 0, 0, 70))
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    base.alpha_composite(shadow)
    base.paste(img, (x0, y0), mask)


def pill(draw, x_center, y, text, fnt, fg, bg, pad_x=34, pad_y=14):
    w = draw.textlength(text, font=fnt)
    asc, desc = fnt.getmetrics()
    h = asc + desc
    box = (x_center - w / 2 - pad_x, y, x_center + w / 2 + pad_x, y + h + 2 * pad_y)
    draw.rounded_rectangle(box, radius=(h + 2 * pad_y) / 2, fill=bg)
    draw.text((x_center - w / 2, y + pad_y - 2), text, font=fnt, fill=fg)
    return box


def header(draw, kicker):
    draw.rectangle((0, 0, W, 150), fill=NAVY)
    draw.text((60, 38), "KAUFKRAFT", font=font("bold", 40), fill=WHITE)
    kw = draw.textlength("KAUFKRAFT", font=font("bold", 40))
    draw.text((60 + kw + 10, 38), "CHECK", font=font("bold", 40), fill=GOLD)
    draw.text((60, 92), kicker, font=font("regular", 26), fill=(190, 198, 212))
    # Euro-Zeichen mit Pfeil nach unten als kleines Logo rechts
    draw.ellipse((W - 150, 30, W - 60, 120), fill=GOLD)
    draw.text((W - 105, 75), "€", font=font("bold", 56), fill=NAVY, anchor="mm")


def footer(draw, source_lines):
    y = H - 40 - 30 * len(source_lines)
    for line in source_lines:
        draw.text((60, y), line, font=font("regular", 22), fill=MUTED)
        y += 30
    hw = draw.textlength(HANDLE, font=font("semi", 26))
    draw.text((W - 60 - hw, H - 70), HANDLE, font=font("semi", 26), fill=NAVY)


def placeholder_photo(name):
    img = Image.new("RGB", (900, 600), NAVY_2)
    d = ImageDraw.Draw(img)
    f = fit_font(d, name, "bold", 120, 780)
    text_center(d, 450, 230, name, f, WHITE)
    return img


def render_product_card(product, prices, photo_path, output_path, fmt_eur, fmt_pct, period_label,
                        photo_credit=None):
    base = Image.new("RGBA", (W, H), CREAM + (255,))
    draw = ImageDraw.Draw(base)
    header(draw, "Was kostet das eigentlich?")

    # Produktname + Menge
    name_font = fit_font(draw, product["name"], "bold", 76, W - 120)
    draw.text((60, 178), product["name"], font=name_font, fill=INK)
    draw.text((62, 270), product["amount"], font=font("regular", 34), fill=MUTED)

    # Produktfoto
    photo = None
    if photo_path and os.path.exists(photo_path):
        photo = Image.open(photo_path).convert("RGB")
    photo = photo or placeholder_photo(product["name"])
    rounded_paste(base, photo, (60, 330, W - 60, 760), 36)
    draw = ImageDraw.Draw(base)

    # Prozent-Plakette ueber dem Foto
    p01 = prices.get("pct_2001")
    if p01 is not None:
        badge = f"{fmt_pct(p01)} seit 2001"
        pill(draw, W - 60 - draw.textlength(badge, font=font("bold", 40)) / 2 - 34 - 24, 690,
             badge, font("bold", 40), WHITE, RED if p01 >= 0 else GREEN)

    # Drei Spalten 2001 | 2010 | heute
    cols = [("2001", prices.get("2001")), ("2010", prices.get("2010")), ("HEUTE", prices["today"])]
    col_w = (W - 120) / 3
    top = 800
    for i, (label, value) in enumerate(cols):
        x0 = 60 + i * col_w
        cx = x0 + col_w / 2
        is_today = label == "HEUTE"
        box = (x0 + 8, top, x0 + col_w - 8, top + 230)
        draw.rounded_rectangle(box, 28, fill=NAVY if is_today else WHITE)
        text_center(draw, cx, top + 26, label, font("semi", 30), GOLD if is_today else MUTED)
        price_txt = fmt_eur(value) if value else "–"
        pf = fit_font(draw, price_txt, "bold", 64, col_w - 40)
        text_center(draw, cx, top + 80, price_txt, pf, WHITE if is_today else INK)
        if is_today:
            sub = period_label(prices["latest_period"])
        else:
            key = f"pct_{label}"
            sub = f"heute {fmt_pct(prices[key])}" if prices.get(key) is not None else ""
        if sub:
            sub_fill = (190, 198, 212) if is_today else (RED if prices.get(f"pct_{label}", 0) >= 0 else GREEN)
            text_center(draw, cx, top + 170, sub, font("semi", 26), sub_fill)

    # Merksatz
    if prices.get("2001"):
        then_price = 10.0
        now_price = 10.0 * prices["today"] / prices["2001"]
        line = f"Was 2001 {fmt_eur(then_price)} kostete, kostet heute {fmt_eur(now_price)}."
        lf = fit_font(draw, line, "semi", 34, W - 120)
        text_center(draw, W / 2, 1065, line, lf, INK)

    if prices.get("method") == "known":
        src = [f"Quelle: {product['known_prices']['source']}",
               f"Heute: Eurostat HVPI, Stand {period_label(prices['latest_period'])}"]
    else:
        src = ["Quelle: Eurostat HVPI (Preisindex der Warengruppe, Deutschland)",
               f"Preise aus dem Index berechnet · Stand {period_label(prices['latest_period'])}"]
    if photo_credit:
        src.append(photo_credit)
    footer(draw, src)
    base.convert("RGB").save(output_path, "JPEG", quality=92)


def _bars(draw, items, box, fmt_value, highlight=None):
    """Horizontale Balken: items = [(label, value), ...]."""
    x0, y0, x1, y1 = box
    n = len(items)
    row_h = (y1 - y0) / n
    max_v = max(abs(v) for _, v in items) or 1
    label_w = 300
    bar_x0 = x0 + label_w
    bar_max = x1 - bar_x0 - 170
    for i, (label, value) in enumerate(items):
        y = y0 + i * row_h
        lf = fit_font(draw, label, "semi", 34, label_w - 20, min_size=22)
        draw.text((x0, y + row_h / 2 - 24), label, font=lf, fill=INK)
        length = max(8, bar_max * abs(value) / max_v)
        color = RED if value >= 0 else GREEN
        if highlight and label == highlight:
            color = NAVY
        mid = y + row_h / 2
        draw.rounded_rectangle((bar_x0, mid - 26, bar_x0 + length, mid + 26), 14, fill=color)
        draw.text((bar_x0 + length + 18, mid - 24), fmt_value(value), font=font("bold", 36), fill=INK)


def title(draw, headline, subline):
    draw.text((60, 190), headline, font=font("bold", 58), fill=INK)
    draw.text((62, 266), subline, font=fit_font(draw, subline, "regular", 32, W - 124), fill=MUTED)


def render_inflation_card(kind, data, output_path, fmt_eur, fmt_pct, period_label):
    base = Image.new("RGBA", (W, H), CREAM + (255,))
    draw = ImageDraw.Draw(base)
    header(draw, "Inflation der Woche")
    stand = period_label(data["period"])

    if kind == "rate":
        title(draw, "Inflation in Deutschland", f"Preise im {stand} ggü. Vorjahresmonat")
        rate_color = RED if data["rate"] >= 0 else GREEN
        text_center(draw, W / 2, 340, fmt_pct(data["rate"]), font("bold", 190), rate_color)
        # Verlauf der letzten Monate als Saeulen
        hist = data["history"]
        x0, x1, y_base, h_max = 80, W - 80, 1060, 380
        n = len(hist)
        bw = (x1 - x0) / n
        max_v = max(max(abs(v) for _, v in hist), 0.5)
        for i, (p, v) in enumerate(hist):
            hgt = h_max * abs(v) / max_v
            bx = x0 + i * bw
            col = NAVY if i == n - 1 else (RED if v >= 0 else GREEN)
            if v >= 0:
                draw.rounded_rectangle((bx + 6, y_base - hgt, bx + bw - 6, y_base), 8, fill=col)
            else:
                draw.rounded_rectangle((bx + 6, y_base, bx + bw - 6, y_base + hgt), 8, fill=col)
            if (n - 1 - i) % 3 == 0:
                m = p.split("-")
                text_center(draw, bx + bw / 2, y_base + 14, f"{m[1]}/{m[0][2:]}", font("regular", 22), MUTED)
        draw.line((x0, y_base, x1, y_base), fill=MUTED, width=2)
        text_center(draw, W / 2, 1110, "Inflationsrate der letzten 24 Monate", font("semi", 30), INK)
        src = ["Quelle: Eurostat, Harmonisierter Verbraucherpreisindex (HVPI)", f"Stand: {stand}"]

    elif kind == "purchasing_power":
        title(draw, "Was sind 100 € noch wert?", "Kaufkraft von 100 Euro, gemessen an den Verbraucherpreisen")
        rows = data["rows"]  # [(jahr, wert_heute)]
        top = 360
        for i, (year, value) in enumerate(rows):
            y = top + i * 230
            draw.text((60, y), f"100 € aus {year}", font=font("semi", 40), fill=INK)
            full = W - 120
            draw.rounded_rectangle((60, y + 70, 60 + full, y + 150), 20, fill=WHITE)
            draw.rounded_rectangle((60, y + 70, 60 + full * value / 100, y + 150), 20, fill=NAVY)
            draw.text((84, y + 82), f"heute {fmt_eur(value)}", font=font("bold", 44), fill=WHITE)
            text_center(draw, W - 150, y + 86, fmt_pct(value - 100), font("bold", 40), RED)
        line = f"Seit 2001 hat der Euro {fmt_pct(100 - rows[0][1], signed=False)} Kaufkraft verloren."
        text_center(draw, W / 2, 1080, line, fit_font(draw, line, "semi", 34, W - 120), INK)
        src = ["Quelle: Eurostat HVPI Deutschland, Jahresdurchschnitt vs. neuester Monat", f"Stand: {stand}"]

    elif kind == "movers":
        title(draw, "Preistreiber des Jahres", f"Stärkste Preisänderung ggü. Vorjahr ({stand})")
        _bars(draw, data["items"], (60, 360, W - 60, 1080), fmt_pct)
        src = ["Quelle: Eurostat HVPI Deutschland, Warengruppen", f"Stand: {stand}"]

    elif kind == "europe":
        title(draw, "Inflation in Europa", f"Rate ggü. Vorjahresmonat ({stand})")
        _bars(draw, data["items"], (60, 360, W - 60, 1080), fmt_pct, highlight="Deutschland")
        src = ["Quelle: Eurostat, Harmonisierter Verbraucherpreisindex (HVPI)", f"Stand: {stand}"]
    else:
        raise ValueError(f"Unbekannte Art: {kind}")

    footer(draw, src)
    base.convert("RGB").save(output_path, "JPEG", quality=92)

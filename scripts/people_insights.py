"""Wochen-Auswertung fuer @people.that.dont.exist per Telegram.

Holt die Posts der letzten Tage samt Statistik (Aufrufe, Reichweite, Likes,
Kommentare, Shares, Saves) ueber die Instagram-API und ordnet jedem Post die
Merkmale der Person zu (Bildausschnitt, Alter, Geschlecht, attraktiv ja/nein,
Laecheln, Post-Typ, Aufhaenger). Die Merkmale stammen aus dem Prompt in der
Git-Historie von assets/people_generated/next_post.json - dafuer braucht der
Workflow die volle Historie (fetch-depth: 0).

Am Ende steht, welche Merkmale im Schnitt die meisten Aufrufe bringen.

Umgebung: IG_ACCESS_TOKEN (PTNE_API_TOKEN), TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID.
Der Token braucht die Berechtigung instagram_business_manage_insights.
"""
import argparse
import json
import os
import re
import subprocess
import sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone

import requests

sys.path.insert(0, os.path.dirname(__file__))
import people_generate as pg  # noqa: E402

GRAPH = "https://graph.instagram.com/v21.0"
POST_FILE = "assets/people_generated/next_post.json"
METRICS = ["views", "reach", "likes", "comments", "shares", "saved"]
MIN_AGE_HOURS = 24  # ganz frische Posts verzerren den Schnitt
NUMBER_RE = re.compile(r"Person No\. (\d+)")


class InsightsPermissionError(RuntimeError):
    pass


def graph_get(path, token, **params):
    resp = requests.get(f"{GRAPH}/{path}", params=params,
                        headers={"Authorization": f"Bearer {token}"}, timeout=30)
    data = resp.json()
    if "error" in data:
        err = data["error"]
        if err.get("code") in (10, 200) or "permission" in str(err.get("message", "")).lower():
            raise InsightsPermissionError(err.get("message"))
        raise RuntimeError(f"Graph-API-Fehler: {err.get('message')} (code {err.get('code')})")
    return data


def fetch_media(token, since):
    media, path, params = [], "me/media", {
        "fields": "id,caption,timestamp,media_type,media_product_type,like_count,comments_count",
        "limit": 50,
    }
    while path:
        data = graph_get(path, token, **params)
        for m in data.get("data", []):
            ts = datetime.strptime(m["timestamp"], "%Y-%m-%dT%H:%M:%S%z")
            if ts < since:
                return media
            m["ts"] = ts
            media.append(m)
        nxt = data.get("paging", {}).get("next")
        if not nxt:
            break
        path, params = nxt.replace(f"{GRAPH}/", ""), {}
    return media


def fetch_insights(token, media_id):
    """Alle Metriken auf einmal; schlaegt das fehl, einzeln (nicht jede gibt es fuer jeden Typ)."""
    def parse(data):
        return {d["name"]: (d.get("values") or [{}])[0].get("value", d.get("total_value", {}).get("value"))
                for d in data.get("data", [])}
    try:
        return parse(graph_get(f"{media_id}/insights", token, metric=",".join(METRICS)))
    except InsightsPermissionError:
        raise
    except RuntimeError:
        values = {}
        for metric in METRICS:
            try:
                values.update(parse(graph_get(f"{media_id}/insights", token, metric=metric)))
            except InsightsPermissionError:
                raise
            except RuntimeError:
                pass
        return values


def prompts_by_number(max_commits=400):
    """Nummer -> Prompt aus allen frueheren Staenden von next_post.json."""
    try:
        shas = subprocess.run(
            ["git", "log", f"-{max_commits}", "--format=%H", "--", POST_FILE],
            capture_output=True, text=True, check=True, cwd=pg.ROOT,
        ).stdout.split()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return {}
    found = {}
    for sha in shas:
        try:
            raw = subprocess.run(["git", "show", f"{sha}:{POST_FILE}"], capture_output=True,
                                 text=True, check=True, cwd=pg.ROOT).stdout
            post = json.loads(raw)
        except (subprocess.CalledProcessError, ValueError):
            continue
        if "number" in post and "prompt" in post:
            found.setdefault(int(post["number"]), post["prompt"])
    return found


def features_from_prompt(prompt):
    low = prompt.lower()
    framing = next((f for f in pg.FRAMING if low.startswith(f)), "unbekannt")
    age = re.search(r"(\d+)-year-old", low)
    age = int(age.group(1)) if age else None
    gender = "Frau" if " woman" in low else "Mann" if " man" in low else "?"
    words = {w for ws in pg.ATTRACTIVE.values() for w in ws}
    attractive = any(f" {w} " in low for w in words)
    smile = any(w in low for w in ("smile", "laughing", "smirk"))
    return {
        "Ausschnitt": {"close-up headshot": "Nahaufnahme", "head and shoulders portrait": "Kopf+Schultern",
                       "waist-up portrait": "Huefte aufwaerts", "candid half-body shot": "Halbkoerper"
                       }.get(framing, framing),
        "Alter": f"{age // 10 * 10}er" if age else "?",
        "Geschlecht": gender,
        "Attraktiv betont": "ja" if attractive else "nein",
        "Laecheln": "ja" if smile else "nein",
    }


def build_report(posts, days):
    lines = [f"📊 Auswertung @people.that.dont.exist - letzte {days} Tage ({len(posts)} Posts)"]
    if not posts:
        return lines[0] + "\n\nKeine auswertbaren Posts im Zeitraum."
    posts = sorted(posts, key=lambda p: p["views"], reverse=True)
    total = sum(p["views"] for p in posts)
    likes = sum(p["likes"] for p in posts)
    lines.append(f"Aufrufe gesamt: {total:,} · Schnitt: {total // len(posts):,} · "
                 f"Likes je 1000 Aufrufe: {likes * 1000 / max(total, 1):.1f}".replace(",", "."))

    def row(p):
        who = f"No. {p['number']:04d}" if p.get("number") else p["id"][-6:]
        f = p.get("features") or {}
        tag = ", ".join(v for k, v in f.items() if k in ("Ausschnitt", "Alter", "Geschlecht"))
        extra = " ✨" if f.get("Attraktiv betont") == "ja" else ""
        return (f"{who} ({p['type']}): {p['views']:,} Aufrufe, ❤️ {p['likes']} 💬 {p['comments']} "
                f"↗️ {p['shares']} 🔖 {p['saved']} - {tag}{extra}").replace(",", ".")

    lines.append("\n🏆 Top 5")
    lines += [row(p) for p in posts[:5]]
    if len(posts) > 5:
        lines.append("\n🔻 Schwaechste 3")
        lines += [row(p) for p in posts[-3:]]

    lines.append("\n🔍 Was zieht? (Schnitt Aufrufe, Anzahl Posts)")
    groups = defaultdict(lambda: defaultdict(list))
    for p in posts:
        groups["Typ"][p["type"]].append(p["views"])
        for k, v in (p.get("features") or {}).items():
            groups[k][v].append(p["views"])
        hook = (p.get("caption") or "").split("\n", 1)[0][:28]
        if hook:
            groups["Aufhaenger"][hook].append(p["views"])
    for key, values in groups.items():
        if len(values) < 2:
            continue
        parts = sorted(((sum(v) // len(v), name, len(v)) for name, v in values.items()), reverse=True)
        lines.append(f"• {key}: " + " | ".join(f"{name} {avg:,} ({n})".replace(",", ".")
                                               for avg, name, n in parts))
    lines.append("\nWenige Posts je Gruppe = noch Zufall moeglich. Belastbar wird es nach 3-4 Wochen.")
    return "\n".join(lines)


def collect(token, days, now=None):
    now = now or datetime.now(timezone.utc)
    media = fetch_media(token, now - timedelta(days=days))
    prompts = prompts_by_number()
    posts = []
    for m in media:
        if now - m["ts"] < timedelta(hours=MIN_AGE_HOURS):
            continue
        if m.get("media_product_type") == "STORY":
            continue
        ins = fetch_insights(token, m["id"])
        number = NUMBER_RE.search(m.get("caption") or "")
        number = int(number.group(1)) if number else None
        prompt = prompts.get(number) if number else None
        posts.append({
            "id": m["id"],
            "number": number,
            "caption": m.get("caption", ""),
            "type": "Reel" if m.get("media_product_type") == "REELS" else "Bild",
            "views": int(ins.get("views") or 0),
            "reach": int(ins.get("reach") or 0),
            "likes": int(ins.get("likes") if ins.get("likes") is not None else m.get("like_count", 0)),
            "comments": int(ins.get("comments") if ins.get("comments") is not None
                            else m.get("comments_count", 0)),
            "shares": int(ins.get("shares") or 0),
            "saved": int(ins.get("saved") or 0),
            "features": features_from_prompt(prompt) if prompt else None,
        })
    return posts


def send_telegram(text):
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    chat = os.environ.get("TELEGRAM_CHAT_ID", "").strip()
    if not token or not chat:
        return
    for i in range(0, len(text), 4000):
        requests.post(f"https://api.telegram.org/bot{token}/sendMessage",
                      data={"chat_id": chat, "text": text[i:i + 4000]}, timeout=30)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=7)
    args = parser.parse_args()
    token = os.environ["IG_ACCESS_TOKEN"].strip()
    try:
        report = build_report(collect(token, args.days), args.days)
    except InsightsPermissionError as exc:
        report = ("⚠️ Auswertung nicht moeglich: Dem Instagram-Token fehlt die Statistik-Berechtigung "
                  f"(instagram_business_manage_insights).\nDetails: {exc}")
        print(report)
        send_telegram(report)
        sys.exit(1)
    print(report)
    send_telegram(report)


if __name__ == "__main__":
    main()

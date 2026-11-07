"""Schreibt automatisch neue Geschichten fuer die Story-Reels - damit nie eine Geschichte
wiederholt werden muss.

Quelle der Fakten ist immer ein deutscher Wikipedia-Artikel; eine KI auf Cloudflare Workers AI
(kostenloses Kontingent) schreibt daraus das Reel-Skript im Format von
content/story_reels/<account>.json (Hook + 8 Szenen mit Bildbeschreibung).

Themenquellen pro Account (in der Account-Datei):
  "wiki_seeds":   kuratierte Liste echter Faelle/Raetsel (Artikel-Titel), wird zuerst abgearbeitet
  "wiki_queries": Suchbegriffe, ueber die danach endlos neue Artikel gefunden werden
Jeder Artikel wird nur einmal verwendet (story_reels_posted_log.json -> "wiki_used").
Die KI lehnt ungeeignete Artikel selbst ab (zu duenn, keine wahre Begebenheit, Kinder als Opfer,
sexuelle Gewalt, aktuelle Faelle mit Privatpersonen, menschenverachtende Verschwoerungsmythen).

Nutzung:
  python scripts/story_writer.py --account horror --ensure 4   (sorgt fuer >= 4 ungenutzte Geschichten)
  python scripts/story_writer.py --account horror --count 1    (genau eine neue Geschichte)
Benoetigt CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN.
"""

import argparse
import json
import os
import random
import re
import sys
import time
from datetime import datetime, timezone

import requests
import story_reel as sr

WIKI_API = "https://{lang}.wikipedia.org/w/api.php"
LANGS = ("de", "en")
USER_AGENT = "IGautomation-StoryBot/1.0 (https://github.com/5hitcake/igautomation)"
LLM_MODELS = [
    "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    "@cf/zai-org/glm-4.7-flash",
    "@cf/google/gemma-4-26b-a4b-it",
]
MAX_ARTICLE_CHARS = 9000
MIN_ARTICLE_CHARS = 1500
MAX_CANDIDATES_PER_RUN = 8
HTTP = requests.Session()
HTTP.headers["User-Agent"] = USER_AGENT


# --------------------------------------------------------------------------- Wikipedia


def split_lang(key):
    """'en:Zodiac Killer' -> ('en', 'Zodiac Killer'); ohne Praefix ist es Deutsch."""
    lang, sep, title = key.partition(":")
    return (lang, title) if sep and lang in LANGS else ("de", key)


def wiki_get(params, lang="de", retries=5):
    params = {"format": "json", "formatversion": 2, **params}
    for attempt in range(retries):
        resp = HTTP.get(WIKI_API.format(lang=lang), params=params, timeout=30)
        if resp.status_code == 429 or resp.status_code >= 500:
            time.sleep(min(60, int(resp.headers.get("Retry-After", "0") or 0) or 5 * (attempt + 1)))
            continue
        resp.raise_for_status()
        return resp.json()
    raise RuntimeError("Wikipedia nicht erreichbar (zu viele Anfragen)")


def wiki_search(query, offset=0, limit=20, lang="de"):
    data = wiki_get(
        {
            "action": "query",
            "list": "search",
            "srsearch": query,
            "srnamespace": 0,
            "sroffset": offset,
            "srlimit": limit,
        },
        lang,
    )
    prefix = "" if lang == "de" else f"{lang}:"
    return [prefix + hit["title"] for hit in data.get("query", {}).get("search", [])]


def wiki_article(key):
    """(Schluessel, Titel, Klartext, URL, Schluessel in den anderen Sprachen) oder None, wenn es den
    Artikel nicht gibt oder er eine Begriffsklaerung ist."""
    lang, title = split_lang(key)
    data = wiki_get(
        {
            "action": "query",
            "prop": "extracts|pageprops|info|langlinks",
            "explaintext": 1,
            "redirects": 1,
            "titles": title,
            "inprop": "url",
            "ppprop": "disambiguation",
            "lllimit": 50,
        },
        lang,
    )
    pages = data.get("query", {}).get("pages", [])
    if not pages or pages[0].get("missing") or "disambiguation" in pages[0].get("pageprops", {}):
        return None
    page = pages[0]
    text = re.sub(r"\n{3,}", "\n\n", page.get("extract", "")).strip()
    # Literatur/Weblinks/Einzelnachweise am Ende abschneiden
    text = re.split(
        r"\n== (Literatur|Weblinks|Einzelnachweise|Rezeption|Filme?|Dokumentation|References|External links|"
        r"Further reading|See also|In popular culture|Notes)",
        text,
    )[0]
    prefix = "" if lang == "de" else f"{lang}:"
    others = {
        (f"{ll['lang']}:" if ll["lang"] != "de" else "") + ll["title"]
        for ll in page.get("langlinks", [])
        if ll.get("lang") in LANGS
    }
    return prefix + page["title"], page["title"], text[:MAX_ARTICLE_CHARS], page.get("fullurl", ""), others


def is_listish(key):
    title = split_lang(key)[1]
    return (
        title.startswith(("Liste ", "List of ", "Portal:", "Kategorie:", "Category:"))
        or "(Begriffsklärung)" in title
    )


def candidates(account_cfg, account_state, rng):
    """Erst die kuratierten Seeds (deutsch und englisch gemischt), dann endlos ueber Suchbegriffe
    in der deutschen und englischen Wikipedia."""
    used = set(account_state.get("wiki_used", []))
    seeds = list(account_cfg.get("wiki_seeds", []))
    en_seeds = [k for k in account_cfg.get("wiki_seeds_en", [])]
    # abwechselnd deutsch/englisch, damit beide Quellen frueh dran kommen
    mixed = (
        [k for pair in zip(seeds, en_seeds) for k in pair] + seeds[len(en_seeds) :] + en_seeds[len(seeds) :]
    )
    for key in mixed:
        if key not in used:
            yield key
    searches = [(q, "de") for q in account_cfg.get("wiki_queries", [])]
    searches += [(q, "en") for q in account_cfg.get("wiki_queries_en", [])]
    for _ in range(12):
        if not searches:
            return
        query, lang = rng.choice(searches)
        for key in wiki_search(query, offset=rng.choice([0, 0, 20, 40, 60]), lang=lang):
            if key not in used and not is_listish(key):
                yield key


# --------------------------------------------------------------------------- KI


def cf_chat(messages, account_id, api_token, model):
    url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/{model}"
    resp = HTTP.post(
        url,
        headers={"Authorization": f"Bearer {api_token}"},
        timeout=180,
        json={"messages": messages, "max_tokens": 2500, "temperature": 0.6},
    )
    if not resp.ok:
        raise RuntimeError(f"{model}: HTTP {resp.status_code} {resp.text[:200]}")
    result = resp.json().get("result", {})
    out = result.get("response")
    if out is None and result.get("choices"):
        out = result["choices"][0]["message"]["content"]
    if isinstance(out, (dict, list)):
        return json.dumps(out, ensure_ascii=False)
    return out or ""


def extract_json(text):
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.M).strip()
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end < 0:
        raise ValueError("keine JSON-Antwort")
    return json.loads(text[start : end + 1])


SYSTEM = """Du schreibst Skripte fuer ~60-sekuendige Instagram-Reels auf Deutsch. Ein Sprecher liest
den Text vor, der Text steht auch im Bild. Zu jeder Szene wird ein KI-Bild erzeugt.

Thema des Accounts: {theme}

WICHTIGSTE REGEL: Verwende AUSSCHLIESSLICH Fakten aus dem Wikipedia-Artikel unten. Erfinde keine
Namen, Zahlen, Daten, Zitate oder Details. Ist etwas ungeklaert oder umstritten, sag das klar.
Trenne bei Theorien deutlich zwischen Belegtem und Spekulation.

Lehne den Artikel ab ("suitable": false), wenn:
- er keine wahre, gut belegte Begebenheit beschreibt oder zu wenig Stoff fuer 8 Szenen hat,
- Kinder die Opfer von Gewalt sind oder sexuelle Gewalt im Mittelpunkt steht,
- es ein Fall nach 2010 mit lebenden Privatpersonen (Opfer, Taeter, Angehoerige) ist,
- er Terror verherrlichen koennte oder menschenverachtende Verschwoerungsmythen behandelt
  (z.B. antisemitische), oder
- er nicht zum Thema des Accounts passt.
Schon behandelte Themen (ebenfalls ablehnen, wenn es dasselbe ist): {covered}

Format (nur JSON, nichts anderes):
{{"suitable": true, "reason": "kurz", "id": "kurzer_slug_in_kleinbuchstaben",
 "hook": {{"text": "...", "image": "..."}},
 "scenes": [{{"text": "...", "image": "..."}}, ... genau 8 Szenen ...],
 "tags": ["#hashtag1", "#hashtag2"]}}

Regeln fuer den Text:
- Hook: 1 packender Satz, max. 16 Woerter, der sofort schockiert oder neugierig macht - KEINE
  Zusammenfassung ("Ein Serienmoerder terrorisiert...") sondern die verstoerendste Tatsache des Falls.
- 8 Szenen, je 12-22 Woerter, zusammen mit dem Hook 100-150 Woerter. Spannender Bogen:
  Ort/Zeit -> Ereignis -> unheimliche Details -> Ermittlungen/Theorien -> offenes Ende oder Twist.
- Kurze, klare Saetze zum Vorlesen. Zahlen als Ziffern. Keine Emojis.
- Pro Szene hoechstens 1-2 besonders wichtige Woerter in *Sternchen* (werden farbig hervorgehoben),
  nicht in jeder Szene. Jeder Satz endet mit Punkt, Fragezeichen oder Ausrufezeichen.
- Respektvoll gegenueber Opfern, keine blutigen Details.
- "image": Bildbeschreibung AUF ENGLISCH (10-25 Woerter, keine Sternchen): Ort, Stimmung, Licht, Objekte.
  Keine erkennbaren realen Personen (lieber Silhouetten, Orte, Gegenstaende), kein Text, kein Blut.
- "tags": 2-3 passende deutsche Hashtags zum konkreten Fall.
- "id": 3-40 Zeichen, nur a-z, 0-9 und Unterstrich."""


def style_example(account_cfg):
    """Eine handgeschriebene Geschichte desselben Accounts als Stilvorbild."""
    example_id = account_cfg.get("writer_example")
    path = os.path.join(sr.CONTENT_DIR, f"{account_cfg.get('key', '')}.json")
    if not example_id or not os.path.exists(path):
        return ""
    with open(path, "r", encoding="utf-8") as f:
        stories = json.load(f)["stories"]
    ex = next((s for s in stories if s["id"] == example_id), None)
    if not ex:
        return ""
    ex = {k: ex[k] for k in ("id", "hook", "scenes", "tags")}
    return (
        "\n\nSO SOLL ES KLINGEN (Beispiel einer fertigen Geschichte, anderer Fall - nur Stil und Aufbau "
        "uebernehmen, NICHT den Inhalt). Achte auf den packenden Hook, kurze Saetze mit Punkt, "
        "max. 1-2 *Hervorhebungen* pro Szene und englische Bildbeschreibungen:\n"
        + json.dumps({"suitable": True, "reason": "Beispiel", **ex}, ensure_ascii=False)
    )


def article_prompt(title, text):
    if re.search(r"\b(the|and|was|were|which)\b", text[:2000]) and not re.search(
        r"\b(und|der|die|das)\b", text[:2000]
    ):
        return (
            f'Englischer Wikipedia-Artikel "{title}". Schreibe das Reel trotzdem auf DEUTSCH '
            f"(Bildbeschreibungen auf Englisch). Uebersetze Fakten genau, erfinde nichts dazu:\n\n{text}"
        )
    return f'Wikipedia-Artikel "{title}":\n\n{text}'


def write_story(account_cfg, title, text, covered, creds, models=None):
    theme = account_cfg.get("writer_theme", account_cfg["name"])
    messages = [
        {
            "role": "system",
            "content": SYSTEM.format(theme=theme, covered=covered) + style_example(account_cfg),
        },
        {"role": "user", "content": article_prompt(title, text)},
    ]
    errors = []
    for model in models or LLM_MODELS:
        for attempt in range(2):
            try:
                story = extract_json(cf_chat(messages, *creds, model))
            except Exception as exc:  # noqa: BLE001
                errors.append(f"{model}: {exc}")
                if "HTTP 4" in str(exc) and "429" not in str(exc):
                    break  # Modell nicht verfuegbar -> naechstes
                continue
            if not story.get("suitable", True):
                return None, f"abgelehnt: {story.get('reason', '')}"
            story = sr.tidy_story({k: story[k] for k in ("id", "hook", "scenes", "tags") if k in story})
            problems = sr.validate_story(story)
            if not problems:
                return story, model
            errors.append(f"{model}: {'; '.join(problems[:3])}")
            messages = messages[:2] + [
                {"role": "assistant", "content": json.dumps(story, ensure_ascii=False)},
                {"role": "user", "content": "Bitte korrigieren: " + "; ".join(problems) + ". Nur JSON."},
            ]
    raise RuntimeError(" | ".join(errors[-4:]))


# --------------------------------------------------------------------------- Ablauf


def generate(account, count, dry_run=False, rng=None):
    rng = rng or random.Random()
    path = os.path.join(sr.CONTENT_DIR, f"{account}.json")
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    account_cfg, stories = data["account"], data["stories"]
    account_cfg["key"] = account
    state = sr.load_state()
    acc_state = state.setdefault(account, {"posted": [], "recent_music": []})
    creds = (
        os.environ.get("CLOUDFLARE_ACCOUNT_ID", "").strip(),
        os.environ.get("CLOUDFLARE_API_TOKEN", "").strip(),
    )
    if not dry_run and not all(creds):
        sys.exit("CLOUDFLARE_ACCOUNT_ID und CLOUDFLARE_API_TOKEN muessen gesetzt sein.")
    ids = {s["id"] for s in stories}
    covered = ", ".join(sorted(ids))
    made, tried = 0, 0
    for title in candidates(account_cfg, acc_state, rng):
        if made >= count or tried >= MAX_CANDIDATES_PER_RUN:
            break
        tried += 1
        used = acc_state.setdefault("wiki_used", [])
        seen_before = set(used)
        used.append(title)
        article = wiki_article(title)
        if not article or len(article[2]) < MIN_ARTICLE_CHARS:
            print(f"- {title}: uebersprungen (kein/zu kurzer Artikel)")
            continue
        key, real_title, text, url, others = article
        if key != title:
            used.append(key)
        if others & seen_before:
            print(f"- {title}: uebersprungen (in anderer Sprache schon verwendet)")
            continue
        used.extend(sorted(others - set(used)))
        if dry_run:
            print(f"- {real_title}: wuerde Geschichte schreiben ({len(text)} Zeichen)")
            made += 1
            continue
        try:
            story, info = write_story(account_cfg, real_title, text, covered, creds)
        except Exception as exc:  # noqa: BLE001
            print(f"- {real_title}: fehlgeschlagen ({exc})")
            continue
        if not story:
            print(f"- {real_title}: {info}")
            continue
        base, n = story["id"], 2
        while story["id"] in ids:
            story["id"] = f"{base}_{n}"
            n += 1
        story["source"] = url
        story["generated"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        stories.append(story)
        ids.add(story["id"])
        made += 1
        print(f"+ {real_title}: neue Geschichte '{story['id']}' ({info})")
    if not dry_run:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        sr.save_state(state)
    return made


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--account", required=True, choices=sr.ACCOUNTS)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--ensure", type=int, help="so viele ungenutzte Geschichten sicherstellen")
    group.add_argument("--count", type=int, help="so viele neue Geschichten schreiben")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if args.ensure is not None:
        _, stories = sr.load_account(args.account)
        acc_state = sr.load_state().get(args.account, {})
        missing = max(0, args.ensure - sr.unused_count(stories, acc_state))
        print(f"{sr.unused_count(stories, acc_state)} ungenutzte Geschichten, schreibe {missing} neue.")
        count = min(missing, 2)  # pro Lauf hoechstens 2 (Kontingent schonen)
    else:
        count = args.count
    if count:
        made = generate(args.account, count, args.dry_run)
        print(f"{made} neue Geschichte(n).")
        if made < count:
            print(f"::warning::Nur {made} von {count} Geschichten geschrieben.")


if __name__ == "__main__":
    main()

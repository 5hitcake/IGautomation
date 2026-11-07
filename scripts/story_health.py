"""Taegliche Wartungspruefung fuer die Story-Reels - meldet sich per Telegram nur, wenn etwas
ansteht (und montags mit einer kurzen Wochen-Uebersicht).

Prueft:
  - Instagram-Tokens: gueltig? Versucht sie automatisch zu verlaengern (60 Tage ab heute).
    Klappt das nicht, Warnung ab 10 Tage vor Ablauf - mit Anleitung.
  - TikTok-Zugang (falls eingerichtet): gueltig? Refresh-Token laeuft in < 30 Tagen ab?
  - Geschichten-Vorrat: genug ungenutzte Geschichten (sonst klemmt der Geschichten-Schreiber)?
  - Letzter Post: kam in den letzten 26 Stunden ein Reel (fuer aktive Accounts)?

Merkt sich pro Token nur einen kurzen Fingerabdruck (nicht den Token) in story_health_state.json.

Umgebungsvariablen:
  HORROR_IG_ACCESS_TOKEN, MYSTERY_IG_ACCESS_TOKEN, STORY_ENABLED_ACCOUNTS,
  TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, HORROR_TIKTOK_REFRESH_TOKEN, MYSTERY_TIKTOK_REFRESH_TOKEN,
  STORY_TELEGRAM_BOT_TOKEN oder TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

Nutzung:
  python scripts/story_health.py            (pruefen + ggf. benachrichtigen)
  python scripts/story_health.py --test     (zusaetzlich Testnachricht schicken)
"""

import argparse
import hashlib
import json
import os
import subprocess
from datetime import date, datetime, timezone

import requests
import story_reel as sr
import story_review

STATE_PATH = os.path.join(sr.ROOT, "story_health_state.json")
IG_TOKEN_DAYS = 60
IG_WARN_DAYS = 10
TIKTOK_WARN_DAYS = 30
MIN_UNUSED = 2
MAX_HOURS_WITHOUT_POST = 26
NAMES = {"horror": "Grusel", "mysteries": "Rätsel"}
SECRET_PREFIX = {"horror": "HORROR", "mysteries": "MYSTERY"}


def fingerprint(token):
    return hashlib.sha256(token.encode()).hexdigest()[:12]


def load_state():
    if os.path.exists(STATE_PATH):
        with open(STATE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_state(state):
    with open(STATE_PATH, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)
        f.write("\n")


def check_instagram(account, token, state, today, http=requests):
    """Gibt (Problemtext oder None, verbleibende Tage) zurueck."""
    name = NAMES[account]
    try:
        me = http.get(
            "https://graph.instagram.com/v21.0/me",
            params={"fields": "username", "access_token": token},
            timeout=30,
        )
        if not me.ok:
            return (
                f"🔴 Instagram-Token {name} ist ungültig oder abgelaufen - es wird nicht gepostet!\n"
                f"→ Neuen Token im Meta-Dashboard erzeugen und als Secret "
                f"{SECRET_PREFIX[account]}_IG_ACCESS_TOKEN eintragen."
            ), 0
    except requests.RequestException:
        return None, None  # Netzwerkproblem - morgen erneut
    fp = fingerprint(token)
    entry = state.setdefault("instagram", {}).get(account)
    if not entry or entry.get("fp") != fp:
        entry = {"fp": fp, "since": today.isoformat()}  # neuer Token -> 60 Tage ab heute
    try:
        ref = http.get(
            "https://graph.instagram.com/refresh_access_token",
            params={"grant_type": "ig_refresh_token", "access_token": token},
            timeout=30,
        )
        if ref.ok and ref.json().get("access_token") == token:
            entry["since"] = today.isoformat()  # automatisch verlaengert
            entry["auto_refresh"] = True
        elif ref.ok:
            entry["auto_refresh"] = False  # Meta hat einen neuen Token ausgegeben, alter laeuft ab
    except requests.RequestException:
        pass
    state["instagram"][account] = entry
    days_left = IG_TOKEN_DAYS - (today - date.fromisoformat(entry["since"])).days
    if days_left <= IG_WARN_DAYS:
        return (
            f"🟠 Instagram-Token {name} läuft in ca. {max(days_left, 0)} Tagen ab.\n"
            f"→ Im Meta-Dashboard (App → Instagram → API setup with Instagram login) neu erzeugen "
            f"und das Secret {SECRET_PREFIX[account]}_IG_ACCESS_TOKEN ersetzen."
        ), days_left
    return None, days_left


def check_tiktok(account, refresh_token, http=requests):
    key, secret = os.environ.get("TIKTOK_CLIENT_KEY", ""), os.environ.get("TIKTOK_CLIENT_SECRET", "")
    if not (key and secret and refresh_token):
        return None
    try:
        resp = http.post(
            "https://open.tiktokapis.com/v2/oauth/token/",
            timeout=30,
            data={
                "client_key": key,
                "client_secret": secret,
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
            },
        )
        data = resp.json()
    except (requests.RequestException, ValueError):
        return None
    if "access_token" not in data:
        return (
            f"🔴 TikTok-Zugang {NAMES[account]} funktioniert nicht mehr.\n"
            f"→ Am PC `python scripts/tiktok_auth.py` ausführen und "
            f"{SECRET_PREFIX[account]}_TIKTOK_REFRESH_TOKEN ersetzen."
        )
    days = int(data.get("refresh_expires_in", 10**9)) // 86400
    if days < TIKTOK_WARN_DAYS:
        return (
            f"🟠 TikTok-Zugang {NAMES[account]} läuft in {days} Tagen ab.\n"
            f"→ Am PC `python scripts/tiktok_auth.py` ausführen und "
            f"{SECRET_PREFIX[account]}_TIKTOK_REFRESH_TOKEN ersetzen."
        )
    return None


def last_post_hours(account, now_ts=None):
    out = subprocess.run(
        ["git", "log", "-1", f"--grep=Story-Reel ({account})", "--format=%ct"],
        capture_output=True,
        text=True,
        cwd=sr.ROOT,
    ).stdout.strip()
    if not out:
        return None
    now_ts = now_ts or datetime.now(timezone.utc).timestamp()
    return (now_ts - int(out)) / 3600


def posts_last_days(account, days=7):
    out = subprocess.run(
        ["git", "log", f"--since={days} days ago", f"--grep=Story-Reel ({account})", "--format=%h"],
        capture_output=True,
        text=True,
        cwd=sr.ROOT,
    ).stdout.split()
    return len(out)


def run(today=None, http=requests, weekly=None):
    today = today or datetime.now(timezone.utc).date()
    enabled = os.environ.get("STORY_ENABLED_ACCOUNTS", "horror").split()
    state = load_state()
    problems, summary = [], []
    for account in sr.ACCOUNTS:
        prefix = SECRET_PREFIX[account]
        token = os.environ.get(f"{prefix}_IG_ACCESS_TOKEN", "").strip()
        days_left = None
        if token:
            msg, days_left = check_instagram(account, token, state, today, http)
            if msg:
                problems.append(msg)
        msg = check_tiktok(account, os.environ.get(f"{prefix}_TIKTOK_REFRESH_TOKEN", "").strip(), http)
        if msg:
            problems.append(msg)
        if account in enabled:
            _, stories = sr.load_account(account)
            unused = sr.unused_count(stories, sr.load_state().get(account, {}))
            if unused < MIN_UNUSED:
                problems.append(
                    f"🟠 Nur noch {unused} neue Geschichte(n) für {NAMES[account]} - der Geschichten-"
                    f"Schreiber kommt nicht hinterher (Cloudflare-Kontingent? Logs prüfen)."
                )
            hours = last_post_hours(account)
            if hours is not None and hours > MAX_HOURS_WITHOUT_POST:
                problems.append(
                    f"🟠 Seit {hours:.0f} Stunden kein Reel auf {NAMES[account]} - bitte unter "
                    f"GitHub → Actions → Story Reels nachsehen."
                )
            token_info = f", Token noch ~{days_left} Tage" if days_left is not None else ""
            auto = state.get("instagram", {}).get(account, {}).get("auto_refresh")
            token_info += " (verlängert sich automatisch)" if auto else ""
            summary.append(
                f"• {NAMES[account]}: {posts_last_days(account)} Reels in 7 Tagen, "
                f"{unused} Geschichten auf Vorrat{token_info}"
            )
        else:
            summary.append(f"• {NAMES[account]}: pausiert")
    save_state(state)
    weekly = today.weekday() == 0 if weekly is None else weekly
    return problems, summary, weekly


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--test", action="store_true", help="Testnachricht schicken")
    args = parser.parse_args()
    problems, summary, weekly = run()
    tg = story_review.telegram_from_env()
    messages = []
    if problems:
        messages.append("🛠 Story-Reels: Es steht etwas an\n\n" + "\n\n".join(problems))
    if weekly or args.test:
        head = "🧪 Testnachricht - Benachrichtigungen funktionieren!\n\n" if args.test else ""
        messages.append(head + "📊 Wochenübersicht Story-Reels\n" + "\n".join(summary))
    for text in messages:
        print(text + "\n")
        if tg:
            tg.send_text(text)
    if not messages:
        print("Alles in Ordnung - keine Nachricht nötig.\n" + "\n".join(summary))
    if not tg:
        print("::warning::Kein Telegram-Zugang - Benachrichtigungen werden nur im Log angezeigt.")


if __name__ == "__main__":
    main()

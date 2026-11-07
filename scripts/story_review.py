"""Vorschau + Freigabe der Story-Reels per Telegram, bevor sie gepostet werden.

Ablauf (laeuft ca. 75 Minuten vor dem Posting-Termin):
  1. Reel rendern (story_reel.make_reel) und als Video in deinen Telegram-Chat schicken,
     mit Knoepfen: ✅ Jetzt posten · 🔄 Andere Geschichte · ❌ Diesmal auslassen
  2. Auf einen Klick warten:
     ✅  -> sofort posten
     🔄  -> Geschichte verwerfen, naechste rendern und erneut fragen (max. MAX_REROLLS Mal)
     ❌  -> Geschichte verwerfen, dieser Termin faellt aus
     keine Reaktion bis zum Termin -> wird automatisch gepostet
  3. "publish=true/false" nach $GITHUB_OUTPUT schreiben.

Verworfene Geschichten kommen nie wieder ("skipped" im Log). Ohne Telegram-Zugang wird ohne
Rueckfrage direkt freigegeben.

Telegram-Zugang: STORY_TELEGRAM_BOT_TOKEN (eigener Bot, empfohlen) oder TELEGRAM_BOT_TOKEN,
dazu TELEGRAM_CHAT_ID.

Nutzung:
  python scripts/story_review.py --account horror --target 19:07     (Termin in UTC)
  python scripts/story_review.py --account horror --wait-minutes 10
  python scripts/story_review.py --notify "Text"                     (nur Nachricht schicken)
"""

import argparse
import json
import os
import secrets
import time
from datetime import datetime, timedelta, timezone

import people_review as pr
import story_reel as sr

MAX_REROLLS = 2
ANSWERS = {
    pr.APPROVE: "Wird gepostet ✅",
    pr.REROLL: "Andere Geschichte kommt 🔄",
    pr.REJECT: "Ausgelassen ❌",
}


class StoryTelegram(pr.Telegram):
    # people_review beschriftet die Klick-Bestaetigung fuer Personen - hier passende Texte.
    PEOPLE_LABELS = {"Wird gepostet": pr.APPROVE, "Neue Person": pr.REROLL, "Verworfen": pr.REJECT}

    def call(self, method, files=None, http_timeout=60, **params):
        if method == "answerCallbackQuery":
            for prefix, decision in self.PEOPLE_LABELS.items():
                if str(params.get("text", "")).startswith(prefix):
                    params["text"] = ANSWERS[decision]
        return super().call(method, files=files, http_timeout=http_timeout, **params)

    def send_video(self, path, caption, token):
        keyboard = {
            "inline_keyboard": [
                [{"text": "✅ Jetzt posten", "callback_data": f"{pr.APPROVE}:{token}"}],
                [
                    {"text": "🔄 Andere Geschichte", "callback_data": f"{pr.REROLL}:{token}"},
                    {"text": "❌ Auslassen", "callback_data": f"{pr.REJECT}:{token}"},
                ],
            ]
        }
        with open(path, "rb") as f:
            msg = self.call(
                "sendVideo",
                files={"video": (os.path.basename(path), f, "video/mp4")},
                http_timeout=300,
                chat_id=self.chat_id,
                caption=caption[:1024],
                supports_streaming="true",
                reply_markup=json.dumps(keyboard),
            )
        return msg["message_id"]


def telegram_from_env():
    token = (
        os.environ.get("STORY_TELEGRAM_BOT_TOKEN", "").strip()
        or os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    )
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "").strip()
    return StoryTelegram(token, chat_id) if token and chat_id else None


def retry(func, what, attempts=3, fallback=None, sleep=None):
    """Telegram ist manchmal kurz nicht erreichbar - ein paar Mal versuchen, dann aufgeben."""
    for i in range(attempts):
        try:
            return func()
        except Exception as exc:  # noqa: BLE001
            print(f"Telegram ({what}) fehlgeschlagen, Versuch {i + 1}/{attempts}: {exc}")
            if i < attempts - 1:
                (sleep or time.sleep)(10 * (i + 1))
    return fallback


def mark_skipped(account, story_id):
    state = sr.load_state()
    acc = state.setdefault(account, {})
    acc["posted"] = [s for s in acc.get("posted", []) if s != story_id]
    acc.setdefault("skipped", [])
    if story_id not in acc["skipped"]:
        acc["skipped"].append(story_id)
    sr.save_state(state)


def review(account, deadline, tg, dry_run=False, make=None, now=None, test=False):
    """Gibt (publish: bool, story_id) zurueck."""
    make = make or sr.make_reel
    now = now or (lambda: datetime.now(timezone.utc))
    cfg, _ = sr.load_account(account)
    if tg:
        retry(tg.skip_old_updates, "alte Klicks verwerfen", fallback=None)
    for attempt in range(MAX_REROLLS + 1):
        path, post = make(account, dry_run=dry_run)
        if not tg:
            return True, post["story_id"]
        token = secrets.token_hex(4)
        header = ("🧪 TEST - es wird nichts gepostet, Knöpfe nur zum Ausprobieren.\n" if test else "") + (
            f"🎬 Vorschau {cfg['handle']} ({post.get('duration', '?')} s)\n"
            f"🕒 Wird um {pr.local_time(deadline)} Uhr gepostet - ohne Antwort automatisch.\n\n"
        )
        msg_id = retry(lambda: tg.send_video(path, header + post["caption"], token), "Vorschau senden")
        if msg_id is None:
            print("::warning::Telegram nicht erreichbar - es wird ohne Vorschau gepostet.")
            return True, post["story_id"]
        decision = tg.wait_for_decision(token, deadline, now=now)
        if decision in (None, pr.APPROVE):
            label = "✅ Freigegeben" if decision else "⏰ Keine Antwort - wird gepostet"
            tg.set_status(msg_id, f"{label}\n\n{post['caption']}")
            return True, post["story_id"]
        mark_skipped(account, post["story_id"])
        if decision == pr.REJECT:
            tg.set_status(msg_id, "❌ Ausgelassen - diese Geschichte kommt nicht wieder.")
            return False, post["story_id"]
        if attempt == MAX_REROLLS:
            tg.set_status(msg_id, "🔄 Verworfen - keine weiteren Versuche, dieser Termin faellt aus.")
            return False, post["story_id"]
        tg.set_status(msg_id, "🔄 Verworfen - andere Geschichte wird erstellt …")
        if deadline - now() < timedelta(minutes=12):
            deadline = now() + timedelta(minutes=12)  # genug Zeit fuer die naechste Vorschau
    return False, None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--account", choices=sr.ACCOUNTS)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--target", help="Posting-Termin HH:MM in UTC")
    group.add_argument("--wait-minutes", type=float)
    group.add_argument("--notify", help="nur diese Nachricht per Telegram schicken")
    group.add_argument(
        "--notify-tiktok", metavar="POST_FILE", help="TikTok-Beschreibung zum Kopieren schicken"
    )
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--test", action="store_true", help="Testlauf: Vorschau schicken, nie posten")
    args = parser.parse_args()
    tg = telegram_from_env()
    if args.notify_tiktok:
        with open(args.notify_tiktok, "r", encoding="utf-8") as f:
            post = json.load(f)
        text = post.get("tiktok_caption") or post["caption"]
        msg = "📋 Text für TikTok - lange drücken, kopieren, beim Posten einfügen:"
        if tg:
            tg.send_text(msg)
            tg.send_text(text)
        else:
            print(f"(kein Telegram) {msg}\n{text}")
        return
    if args.notify is not None:
        if tg:
            tg.send_text(args.notify)
        else:
            print(f"(kein Telegram) {args.notify}")
        return
    if not args.account:
        parser.error("--account fehlt")
    if args.target:
        deadline = pr.next_target(args.target)
    else:
        deadline = datetime.now(timezone.utc) + timedelta(minutes=args.wait_minutes)
    try:
        publish, story_id = review(args.account, deadline, tg, args.dry_run, test=args.test)
        publish = publish and not args.test
    except Exception as exc:
        if tg:
            tg.send_text(f"⚠️ Reel fuer {args.account} konnte nicht erstellt werden:\n{str(exc)[:500]}")
        raise
    if publish and tg and datetime.now(timezone.utc) < deadline:
        print("Freigegeben - wird sofort gepostet.")
    pr.write_output(publish=str(publish).lower(), story=story_id or "")


if __name__ == "__main__":
    main()

"""Freigabe per Telegram fuer den "These people do not exist"-Account.

Ablauf (laeuft ca. 3 Stunden vor dem Posting-Termin):
  1. Person erzeugen (people_generate.create_candidate) und als Foto mit
     Caption und Knoepfen an den eigenen Telegram-Chat schicken:
     ✅ Posten · 🔄 Neue Person · ❌ Verwerfen
  2. Auf einen Klick warten:
     ✅  -> wird zum Termin gepostet
     🔄  -> neue Person erzeugen und erneut fragen (max. MAX_REROLLS Mal,
            wegen des Cloudflare-Gratis-Kontingents)
     ❌  -> dieser Post faellt aus
     keine Reaktion bis zum Termin -> wird automatisch gepostet
  3. Bei Freigabe: Bild + next_post.json + Log speichern (people_generate.finalize)
     und "publish=true" nach $GITHUB_OUTPUT schreiben.

Nur Klicks aus TELEGRAM_CHAT_ID zaehlen - fremde Nutzer koennen den Bot nicht steuern.

Ohne TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID wird ohne Rueckfrage direkt freigegeben.

Nutzung:
  python people_review.py --target 11:13      (Termin in UTC, heute oder morgen)
  python people_review.py --wait-minutes 10   (z.B. fuer manuelle Laeufe)
  python people_review.py --notify "Text"     (nur eine Nachricht schicken)
"""
import argparse
import json
import os
import time
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import people_generate as pg
import requests

API = "https://api.telegram.org/bot{token}/{method}"
LOCAL_TZ = ZoneInfo("Europe/Berlin")
MAX_REROLLS = 1
POLL_TIMEOUT = 50  # Long-Polling, Sekunden

APPROVE, REROLL, REJECT = "approve", "reroll", "reject"


class Telegram:
    def __init__(self, token, chat_id, session=None):
        self.token = token
        self.chat_id = str(chat_id).strip()
        self.http = session or requests.Session()
        self.offset = None

    def call(self, method, files=None, http_timeout=60, **params):
        resp = self.http.post(API.format(token=self.token, method=method), data=params, files=files,
                              timeout=http_timeout)
        data = resp.json()
        if not data.get("ok"):
            raise RuntimeError(f"Telegram {method} fehlgeschlagen: {data.get('description')}")
        return data["result"]

    def send_text(self, text):
        return self.call("sendMessage", chat_id=self.chat_id, text=text)

    def send_candidate(self, jpeg, caption, token):
        keyboard = {"inline_keyboard": [[
            {"text": "✅ Posten", "callback_data": f"{APPROVE}:{token}"},
            {"text": "🔄 Neue Person", "callback_data": f"{REROLL}:{token}"},
            {"text": "❌ Verwerfen", "callback_data": f"{REJECT}:{token}"},
        ]]}
        msg = self.call("sendPhoto", files={"photo": ("person.jpg", jpeg, "image/jpeg")},
                        chat_id=self.chat_id, caption=caption[:1024], reply_markup=json.dumps(keyboard))
        return msg["message_id"]

    def set_status(self, message_id, caption):
        """Knoepfe entfernen und Status unter das Foto schreiben."""
        try:
            self.call("editMessageCaption", chat_id=self.chat_id, message_id=message_id,
                      caption=caption[:1024], reply_markup=json.dumps({"inline_keyboard": []}))
        except RuntimeError as exc:
            print(f"Status konnte nicht gesetzt werden: {exc}")

    def skip_old_updates(self):
        """Alte, noch nicht abgeholte Klicks verwerfen (z.B. von frueheren Laeufen)."""
        updates = self.call("getUpdates", offset=-1, timeout=0)
        if updates:
            self.offset = updates[-1]["update_id"] + 1

    def wait_for_decision(self, token, deadline, now=None):
        """Wartet auf einen Klick fuer genau diesen Kandidaten. Gibt APPROVE,
        REROLL, REJECT oder None (Zeit abgelaufen) zurueck."""
        now = now or (lambda: datetime.now(timezone.utc))
        while True:
            remaining = (deadline - now()).total_seconds()
            if remaining <= 0:
                return None
            params = {"timeout": int(min(POLL_TIMEOUT, max(1, remaining))),
                      "allowed_updates": json.dumps(["callback_query"])}
            if self.offset is not None:
                params["offset"] = self.offset
            try:
                updates = self.call("getUpdates", http_timeout=POLL_TIMEOUT + 15, **params)
            except (requests.RequestException, RuntimeError) as exc:
                print(f"getUpdates-Fehler, versuche erneut: {exc}")
                time.sleep(10)
                continue
            for update in updates:
                self.offset = update["update_id"] + 1
                decision = parse_callback(update, self.chat_id, token)
                if decision:
                    try:
                        self.call("answerCallbackQuery", callback_query_id=update["callback_query"]["id"],
                                  text={APPROVE: "Wird gepostet ✅", REROLL: "Neue Person kommt 🔄",
                                        REJECT: "Verworfen ❌"}[decision])
                    except RuntimeError:
                        pass
                    return decision


def parse_callback(update, chat_id, token):
    """Liefert die Entscheidung, wenn der Klick aus dem eigenen Chat kommt und
    zum aktuellen Kandidaten gehoert - sonst None."""
    cq = update.get("callback_query")
    if not cq:
        return None
    if str(cq.get("message", {}).get("chat", {}).get("id")) != str(chat_id):
        return None
    if str(cq.get("from", {}).get("id")) != str(chat_id):
        return None
    action, _, cand_token = (cq.get("data") or "").partition(":")
    if cand_token != token or action not in (APPROVE, REROLL, REJECT):
        return None
    return action


def next_target(hhmm, now=None):
    """Naechster Zeitpunkt HH:MM (UTC) ab jetzt."""
    now = now or datetime.now(timezone.utc)
    hour, minute = (int(x) for x in hhmm.split(":"))
    target = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if target <= now:
        target += timedelta(days=1)
    return target


def local_time(dt):
    return dt.astimezone(LOCAL_TZ).strftime("%H:%M")


def write_output(**values):
    path = os.environ.get("GITHUB_OUTPUT")
    lines = "".join(f"{k}={v}\n" for k, v in values.items())
    if path:
        with open(path, "a", encoding="utf-8") as f:
            f.write(lines)
    print(lines.strip())


def review(tg, state, deadline, dry_run=False, sleep=time.sleep, now=None):
    """Kompletter Freigabe-Ablauf. Gibt den freigegebenen Kandidaten oder None zurueck."""
    now = now or (lambda: datetime.now(timezone.utc))
    tg.skip_old_updates()
    rerolls = 0
    while True:
        try:
            cand = pg.create_candidate(state, dry_run=dry_run)
        except Exception as exc:  # noqa: BLE001
            tg.send_text(f"⚠️ Kein Bild erzeugt - dieser Post faellt aus.\n\n{str(exc)[:500]}")
            raise
        token = f"{cand['number']}-{rerolls}-{int(time.time())}"
        header = (f"🕒 Post um {local_time(deadline)} Uhr - ohne Antwort wird automatisch gepostet.\n"
                  f"Modell: {cand['model'].split('/')[-1]}\n\n")
        msg_id = tg.send_candidate(cand["jpeg"], header + cand["caption"], token)
        decision = tg.wait_for_decision(token, deadline, now=now)
        if decision == REROLL and rerolls >= MAX_REROLLS:
            tg.send_text("Keine weitere neue Person moeglich (Gratis-Kontingent). Diese wird gepostet, "
                         "ausser du klickst ❌.")
            decision = tg.wait_for_decision(token, deadline, now=now)
            decision = REJECT if decision == REJECT else APPROVE
        if decision == REROLL:
            tg.set_status(msg_id, "🔄 Ersetzt durch eine neue Person.")
            rerolls += 1
            continue
        if decision == REJECT:
            tg.set_status(msg_id, "❌ Verworfen - dieser Post faellt aus.")
            return None
        label = "✅ Freigegeben" if decision == APPROVE else "⏰ Keine Antwort - wird automatisch gepostet"
        tg.set_status(msg_id, f"{label} (um {local_time(deadline)} Uhr).\n\n{cand['caption']}")
        wait = (deadline - now()).total_seconds()
        if wait > 0:
            print(f"Freigegeben - warte {int(wait)}s bis zum Termin.")
            sleep(wait)
        return cand


def main():
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--target", help="Posting-Termin HH:MM in UTC")
    group.add_argument("--wait-minutes", type=int, help="Minuten bis zum Posten")
    group.add_argument("--notify", help="Nur diesen Text per Telegram schicken")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "").strip()
    tg = Telegram(token, chat_id) if token and chat_id else None

    if args.notify is not None:
        if tg:
            tg.send_text(args.notify)
        return

    state = pg.load_state()
    if not tg:
        print("Kein Telegram konfiguriert - ohne Rueckfrage freigegeben.")
        pg.finalize(state, pg.create_candidate(state, dry_run=args.dry_run))
        return write_output(publish="true")

    if args.target:
        deadline = next_target(args.target)
    else:
        deadline = datetime.now(timezone.utc) + timedelta(minutes=args.wait_minutes or 0)
    cand = review(tg, state, deadline, dry_run=args.dry_run)
    if cand is None:
        return write_output(publish="false")
    pg.finalize(state, cand)
    write_output(publish="true")


if __name__ == "__main__":
    main()

"""Freigabe per Telegram fuer den "These people do not exist"-Account.

Ablauf (laeuft ca. 3 Stunden vor dem Posting-Termin):
  1. Person erzeugen (people_generate.create_candidate) und als Foto mit
     Caption und Knoepfen an den eigenen Telegram-Chat schicken:
     ✅ Posten · 🔄 Neue Person · ❌ Verwerfen
  2. Auf einen Klick warten:
     ✅  -> wird zum Termin gepostet
     🔄  -> neue Person erzeugen und erneut fragen (max. MAX_REROLLS Mal pro Termin;
            leeres Kontingent faengt die Modell-Kette bzw. das Reservebild ab)
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
  python people_review.py --queue 11:13,17:13 (mehrere Personen auf einmal freigeben, die
                                               freigegebenen landen in assets/people_queue/)
  python people_review.py --from-queue 11:13  (freigegebene Person fuer diesen Termin posten)
"""
import argparse
import copy
import json
import os
import re
import time
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import people_generate as pg
import requests

API = "https://api.telegram.org/bot{token}/{method}"
LOCAL_TZ = ZoneInfo("America/Argentina/Buenos_Aires")  # Zeitzone des Nutzers
QUEUE_DIR = os.path.join(pg.ROOT, "assets", "people_queue")
MAX_REROLLS = 3
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
        hit = self.wait_for_any([token], deadline, now=now)
        return hit[1] if hit else None

    def wait_for_any(self, tokens, deadline, now=None):
        """Wartet auf einen Klick fuer einen der Kandidaten. Gibt (token, Entscheidung)
        oder None (Zeit abgelaufen) zurueck."""
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
                decision = token = None
                for candidate_token in tokens:
                    decision = parse_callback(update, self.chat_id, candidate_token)
                    if decision:
                        token = candidate_token
                        break
                if decision:
                    try:
                        self.call("answerCallbackQuery", callback_query_id=update["callback_query"]["id"],
                                  text={APPROVE: "Wird gepostet ✅", REROLL: "Neue Person kommt 🔄",
                                        REJECT: "Verworfen ❌"}[decision])
                    except RuntimeError:
                        pass
                    return token, decision


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


LATE_GRACE = timedelta(hours=8)
LATE_REVIEW = timedelta(minutes=20)


def next_target(hhmm, now=None):
    """Zeitpunkt HH:MM (UTC) fuer den aktuellen Lauf.

    GitHub startet geplante Laeufe manchmal Stunden zu spaet. Liegt der Termin
    hoechstens LATE_GRACE in der Vergangenheit, gilt der Lauf als verspaetet:
    dann bleiben LATE_REVIEW Minuten Bedenkzeit, statt bis morgen zu warten."""
    now = now or datetime.now(timezone.utc)
    hour, minute = (int(x) for x in hhmm.split(":"))
    today = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    for passed in (today, today - timedelta(days=1)):  # auch "gestern 23:43, jetzt 00:55"
        if passed <= now and now - passed <= LATE_GRACE:
            return now + LATE_REVIEW
    return today if today > now else today + timedelta(days=1)


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
    offered_reserve = set()
    while True:
        try:
            cand = pg.create_candidate(state, dry_run=dry_run, skip_reserve=offered_reserve)
        except Exception as exc:  # noqa: BLE001
            tg.send_text(f"⚠️ Kein Bild erzeugt - dieser Post faellt aus.\n\n{str(exc)[:500]}")
            raise
        if cand.get("reserve"):
            offered_reserve.add(cand["reserve"])
            source = "♻️ Reservebild (alle Bildquellen leer)"
        else:
            source = f"Modell: {cand['model'].split('/')[-1]}"
        token = f"{cand['number']}-{rerolls}-{int(time.time())}"
        header = (f"🕒 Post um {local_time(deadline)} Uhr - ohne Antwort wird automatisch gepostet.\n"
                  f"{source}\n\n")
        msg_id = tg.send_candidate(cand["jpeg"], header + cand["caption"], token)
        decision = tg.wait_for_decision(token, deadline, now=now)
        if decision == REROLL and rerolls >= MAX_REROLLS:
            tg.send_text(f"Keine weitere neue Person moeglich ({MAX_REROLLS} Versuche erreicht). "
                         "Diese wird gepostet, ausser du klickst ❌.")
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


def _source(cand):
    if cand.get("reserve"):
        return "♻️ Reservebild (alle Bildquellen leer)"
    return f"Modell: {cand['model'].split('/')[-1]}"


def review_batch(tg, state, slots, deadline, dry_run=False, now=None):
    """Schickt fuer jeden Termin in slots (UTC-datetimes) eine Person und sammelt die
    Entscheidungen bis deadline. Ohne Antwort gilt eine Person als freigegeben.
    Gibt {Index: Kandidat oder None (verworfen)} zurueck."""
    now = now or (lambda: datetime.now(timezone.utc))
    tg.skip_old_updates()
    temp = copy.deepcopy(state)  # damit die Personen untereinander verschieden sind
    offered_reserve = set()
    active, rerolls, results = {}, {}, {}

    def offer(i):
        try:
            cand = pg.create_candidate(temp, dry_run=dry_run, skip_reserve=offered_reserve)
        except Exception as exc:  # noqa: BLE001
            tg.send_text(f"⚠️ Kein Bild fuer {local_time(slots[i])} Uhr erzeugt - dieser Post faellt aus."
                         f"\n\n{str(exc)[:400]}")
            results[i] = None
            return
        if cand.get("reserve"):
            offered_reserve.add(cand["reserve"])
        temp["count"] = temp.get("count", 0) + 1
        temp.setdefault("recent", []).append(
            {k: cand["persona"][k] for k in ("gender", "age_range", "heritage", "setting")})
        token = f"q{i}-{rerolls.get(i, 0)}-{int(time.time())}"
        header = (f"🕒 Post um {local_time(slots[i])} Uhr - ohne Antwort bis {local_time(deadline)} Uhr "
                  f"wird automatisch gepostet.\n{_source(cand)}\n\n")
        msg_id = tg.send_candidate(cand["jpeg"], header + cand["caption"], token)
        active[token] = (i, msg_id, cand)

    for i in range(len(slots)):
        offer(i)
    while active:
        hit = tg.wait_for_any(list(active), deadline, now=now)
        if hit is None:
            for i, msg_id, cand in active.values():
                tg.set_status(msg_id, f"⏰ Keine Antwort - wird um {local_time(slots[i])} Uhr gepostet."
                                      f"\n\n{cand['caption']}")
                results[i] = cand
            break
        token, decision = hit
        i, msg_id, cand = active.pop(token)
        if decision == REROLL and rerolls.get(i, 0) < MAX_REROLLS:
            tg.set_status(msg_id, "🔄 Ersetzt durch eine neue Person.")
            rerolls[i] = rerolls.get(i, 0) + 1
            offer(i)
        elif decision == REROLL:
            tg.send_text(f"Keine weitere neue Person fuer {local_time(slots[i])} Uhr moeglich "
                         f"({MAX_REROLLS} Versuche erreicht). Diese wird gepostet, ausser du klickst ❌.")
            active[token] = (i, msg_id, cand)
        elif decision == REJECT:
            tg.set_status(msg_id, f"❌ Verworfen - der Post um {local_time(slots[i])} Uhr faellt aus.")
            results[i] = None
        else:
            tg.set_status(msg_id, f"✅ Freigegeben (um {local_time(slots[i])} Uhr).\n\n{cand['caption']}")
            results[i] = cand
    return results


def slot_key(hhmm):
    return hhmm.replace(":", "")


def save_to_queue(hhmm, cand):
    os.makedirs(QUEUE_DIR, exist_ok=True)
    key = slot_key(hhmm)
    meta = {"slot": hhmm, "rejected": cand is None}
    if cand is not None:
        with open(os.path.join(QUEUE_DIR, f"{key}.jpg"), "wb") as f:
            f.write(cand["jpeg"])
        meta.update({k: cand.get(k) for k in ("persona", "prompt", "model", "reserve", "caption")})
    with open(os.path.join(QUEUE_DIR, f"{key}.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)


def load_from_queue(hhmm, state):
    """Gibt (Kandidat, Status) zurueck; Status: "ok", "rejected" oder "missing".
    Die Nummer wird erst jetzt vergeben, damit verworfene Posts keine Luecke reissen."""
    key = slot_key(hhmm)
    meta_path = os.path.join(QUEUE_DIR, f"{key}.json")
    if not os.path.exists(meta_path):
        return None, "missing"
    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)
    jpg_path = os.path.join(QUEUE_DIR, f"{key}.jpg")
    cand = None
    if not meta.get("rejected"):
        number = state.get("count", 0) + 1
        with open(jpg_path, "rb") as f:
            jpeg = f.read()
        cand = {
            "persona": meta["persona"], "prompt": meta["prompt"], "model": meta["model"],
            "reserve": meta.get("reserve"), "number": number, "jpeg": jpeg,
            "caption": re.sub(r"Person No\. \d+", f"Person No. {number:04d}", meta["caption"]),
        }
    for path in (meta_path, jpg_path):
        if os.path.exists(path):
            os.remove(path)
    return cand, ("rejected" if cand is None else "ok")


def main():
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--target", help="Posting-Termin HH:MM in UTC")
    group.add_argument("--wait-minutes", type=int, help="Minuten bis zum Posten")
    group.add_argument("--notify", help="Nur diesen Text per Telegram schicken")
    group.add_argument("--queue", help="Mehrere Termine HH:MM (UTC), kommagetrennt, auf einmal freigeben")
    group.add_argument("--from-queue", help="Freigegebene Person fuer diesen Termin HH:MM (UTC) posten")
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
    if args.from_queue:
        cand, status = load_from_queue(args.from_queue, state)
        if status != "ok":
            print(f"Nichts zu posten fuer {args.from_queue}: {status}")
            if tg and status == "missing":
                tg.send_text(f"⚠️ Fuer {local_time(next_target(args.from_queue))} Uhr lag keine "
                             "freigegebene Person bereit - dieser Post faellt aus.")
            return write_output(publish="false")
        pg.finalize(state, cand)
        return write_output(publish="true")

    if args.queue:
        hhmms = [x.strip() for x in args.queue.split(",") if x.strip()]
        slots = [next_target(x) for x in hhmms]
        if tg:
            results = review_batch(tg, state, slots, min(slots), dry_run=args.dry_run)
        else:
            results = {i: pg.create_candidate(state, dry_run=args.dry_run) for i in range(len(slots))}
        for i, hhmm in enumerate(hhmms):
            save_to_queue(hhmm, results.get(i))
        return write_output(queued="true")

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

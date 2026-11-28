"""Telegram-Teil des Selfie-Bots: Foto abholen, Ergebnisse zurueckschicken.

  python scripts/selfie_telegram.py fetch   --file-id ID --to foto.jpg
  python scripts/selfie_telegram.py deliver --dir OUT --reply-to MSG_ID
  python scripts/selfie_telegram.py error   --text "..." --reply-to MSG_ID

Braucht SELFIE_TELEGRAM_BOT_TOKEN und TELEGRAM_CHAT_ID.
"""

import argparse
import json
import os
import sys

import requests

API = "https://api.telegram.org/bot{token}/{method}"
FILE = "https://api.telegram.org/file/bot{token}/{path}"


def call(method, files=None, timeout=120, **data):
    token = os.environ["SELFIE_TELEGRAM_BOT_TOKEN"]
    r = requests.post(API.format(token=token, method=method), data=data, files=files, timeout=timeout)
    body = r.json()
    if not body.get("ok"):
        raise RuntimeError(f"Telegram {method}: {body.get('description')}")
    return body["result"]


def fetch(file_id, to):
    token = os.environ["SELFIE_TELEGRAM_BOT_TOKEN"]
    info = call("getFile", file_id=file_id)
    r = requests.get(FILE.format(token=token, path=info["file_path"]), timeout=120)
    r.raise_for_status()
    with open(to, "wb") as f:
        f.write(r.content)


def deliver(out, reply_to):
    chat = os.environ["TELEGRAM_CHAT_ID"]
    with open(os.path.join(out, "ergebnis.json")) as f:
        res = json.load(f)
    reply = {"reply_to_message_id": reply_to} if reply_to else {}
    note = "" if res.get("face_found") else "\n⚠️ Kein Gesicht erkannt – Bildmitte verwendet."
    with open(res["video"], "rb") as f:
        call("sendVideo", files={"video": ("fadenbild.mp4", f, "video/mp4")}, timeout=300, chat_id=chat,
             supports_streaming="true",
             caption=f"🧵 Fertig! {res['nails']} Nägel · {res['threads']} Fäden{note}", **reply)
    files = (("tisch", "Bild mit Tisch", "image/jpeg"),
             ("platte", "Nur die Platte (PNG, transparent)", "image/png"))
    for key, label, mime in files:
        path = res[key]
        with open(path, "rb") as f:
            call("sendDocument", files={"document": (os.path.basename(path), f, mime)}, timeout=300,
                 chat_id=chat, caption=label)


def error(text, reply_to):
    reply = {"reply_to_message_id": reply_to} if reply_to else {}
    call("sendMessage", chat_id=os.environ["TELEGRAM_CHAT_ID"], text=text, **reply)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["fetch", "deliver", "error"])
    ap.add_argument("--file-id")
    ap.add_argument("--to")
    ap.add_argument("--dir")
    ap.add_argument("--text", default="")
    ap.add_argument("--reply-to", default="")
    a = ap.parse_args()
    if a.cmd == "fetch":
        fetch(a.file_id, a.to)
    elif a.cmd == "deliver":
        deliver(a.dir, a.reply_to)
    else:
        error(a.text, a.reply_to)


if __name__ == "__main__":
    sys.exit(main())

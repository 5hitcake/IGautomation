"""Studio-Webseite (docs/studio) und Bestell-Annahme im Selfie-Bot-Worker."""
import json
import os
import re
import shutil
import subprocess

import pytest

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
STUDIO = os.path.join(ROOT, "docs", "studio")
node = pytest.mark.skipif(shutil.which("node") is None, reason="node fehlt")


def _read(name):
    with open(os.path.join(STUDIO, name), encoding="utf-8") as f:
        return f.read()


@node
def test_all_languages_have_all_texts():
    js = "globalThis.window={};" + _read("i18n.js") + ";console.log(JSON.stringify(window.I18N))"
    data = json.loads(subprocess.run(["node", "-e", js], capture_output=True, text=True, check=True).stdout)
    assert set(data) == {"en", "de", "es", "fr"}
    for lang, texts in data.items():
        assert set(texts) == set(data["en"]), f"{lang}: fehlende/zusaetzliche Texte"


def test_every_i18n_key_used_in_html_exists():
    keys = set(re.findall(r'data-i18n="([a-z0-9_]+)"', _read("index.html")))
    en = _read("i18n.js").split("de: {", 1)[0]
    missing = [k for k in keys if not re.search(rf"\b{k}:", en)]
    assert not missing, missing


def test_orders_stay_closed_until_legal_pages_are_complete():
    cfg = _read("config.js")
    open_ = re.search(r"ordersOpen:\s*(true|false)", cfg).group(1) == "true"
    legal = re.sub(r"<!--.*?-->", "", _read("privacy.html") + _read("imprint.html"), flags=re.S)
    placeholders = re.findall(r"\[[^\]<]{3,}\]", legal)
    if open_:
        assert not placeholders, f"Impressum/Datenschutz noch unvollstaendig: {placeholders[:3]}"


@node
def test_worker_order_endpoint():
    script = r"""
import * as m from "./cloudflare/selfie_bot/src/index.js";
const sent = [];
globalThis.fetch = async (url, opt) => { sent.push(opt.body.get("caption")); return new Response("{}"); };
const env = { SELFIE_TELEGRAM_BOT_TOKEN: "x", TELEGRAM_CHAT_ID: "42" };
const photo = new File([new Uint8Array(10)], "p.jpg", { type: "image/jpeg" });
async function post(extra) {
  const f = new FormData();
  const base = { photo, email: "a@b.de", shape: "circle", panel: "white", lang: "de", ...extra };
  for (const [k, v] of Object.entries(base)) f.append(k, v);
  const r = await m.default.fetch(new Request("https://w.dev/order", { method: "POST", body: f }), env);
  return r.status;
}
const out = {
  ok: await post({}), bad_mail: await post({ email: "x" }), bad_shape: await post({ shape: "star" }),
  spam: await post({ website: "x" }), sent: sent.length, caption: sent[0],
};
console.log(JSON.stringify(out));
"""
    res = subprocess.run(["node", "--input-type=module", "-e", script], cwd=ROOT,
                         capture_output=True, text=True, check=True)
    out = json.loads(res.stdout)
    assert out["ok"] == 200 and out["bad_mail"] == 400 and out["bad_shape"] == 400
    assert out["spam"] == 200 and out["sent"] == 1  # Spam wird still verworfen
    assert out["caption"].startswith("circle white")  # Weiterleiten an den Bot -> Optionen erkannt

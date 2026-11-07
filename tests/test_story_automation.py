import json
from datetime import date, datetime, timedelta, timezone

import people_review as pr
import pytest
import story_health as sh
import story_reel as sr
import story_review as rv
import story_writer as sw


@pytest.fixture
def tmp_state(tmp_path, monkeypatch):
    path = tmp_path / "log.json"
    monkeypatch.setattr(sr, "STATE_PATH", str(path))
    monkeypatch.setattr(sh, "STATE_PATH", str(tmp_path / "health.json"))
    return path


# --------------------------------------------------------------------------- Vorschau / Freigabe


class FakeTG:
    def __init__(self, decisions):
        self.decisions = list(decisions)
        self.sent, self.status = [], []

    def skip_old_updates(self):
        pass

    def send_video(self, path, caption, token):
        self.sent.append(caption)
        return len(self.sent)

    def wait_for_decision(self, token, deadline, now=None):
        return self.decisions.pop(0)

    def set_status(self, msg_id, caption):
        self.status.append(caption)


def fake_make(ids):
    ids = list(ids)

    def make(account, dry_run=False):
        sid = ids.pop(0)
        state = sr.load_state()
        state.setdefault(account, {}).setdefault("posted", []).append(sid)
        sr.save_state(state)
        return f"/tmp/{sid}.mp4", {"story_id": sid, "caption": f"Caption {sid}", "duration": 60}

    return make


def deadline():
    return datetime.now(timezone.utc) + timedelta(hours=1)


@pytest.mark.parametrize("decision", [None, pr.APPROVE])
def test_review_publishes_on_approve_or_timeout(tmp_state, decision):
    tg = FakeTG([decision])
    assert rv.review("horror", deadline(), tg, make=fake_make(["a"])) == (True, "a")
    assert "Wird um" in tg.sent[0] and "Caption a" in tg.sent[0]


def test_review_reject_skips_story_forever(tmp_state):
    tg = FakeTG([pr.REJECT])
    assert rv.review("horror", deadline(), tg, make=fake_make(["a"])) == (False, "a")
    state = sr.load_state()["horror"]
    assert "a" in state["skipped"] and "a" not in state["posted"]


def test_review_reroll_then_approve(tmp_state):
    tg = FakeTG([pr.REROLL, pr.APPROVE])
    assert rv.review("horror", deadline(), tg, make=fake_make(["a", "b"])) == (True, "b")
    assert sr.load_state()["horror"]["skipped"] == ["a"]


def test_review_without_telegram_publishes_directly(tmp_state):
    assert rv.review("horror", deadline(), None, make=fake_make(["a"])) == (True, "a")


def test_story_telegram_relabels_answers(monkeypatch):
    seen = {}
    monkeypatch.setattr(
        pr.Telegram, "call", lambda self, method, files=None, http_timeout=60, **p: seen.update(p)
    )
    rv.StoryTelegram("t", "1").call("answerCallbackQuery", callback_query_id="x", text="Neue Person kommt 🔄")
    assert seen["text"] == rv.ANSWERS[pr.REROLL]


# --------------------------------------------------------------------------- Wartung


class Resp:
    def __init__(self, data, ok=True):
        self._d, self.ok = data, ok

    def json(self):
        return self._d


class FakeHTTP:
    def __init__(self, me_ok=True, refreshed=None, tiktok=None):
        self.me_ok, self.refreshed, self.tiktok = me_ok, refreshed, tiktok

    def get(self, url, params=None, timeout=None):
        if url.endswith("/me"):
            return Resp({"username": "x"}, self.me_ok)
        return Resp({"access_token": self.refreshed or params["access_token"], "expires_in": 5184000})

    def post(self, url, data=None, timeout=None):
        return Resp(self.tiktok or {})


def test_instagram_token_auto_extended(tmp_state):
    state = {}
    msg, days = sh.check_instagram("horror", "TOKEN", state, date(2027, 1, 1), FakeHTTP())
    assert msg is None and days == 60 and state["instagram"]["horror"]["auto_refresh"]
    assert "TOKEN" not in json.dumps(state)  # nur Fingerabdruck


def test_instagram_token_warns_before_expiry(tmp_state):
    state = {"instagram": {"horror": {"fp": sh.fingerprint("TOKEN"), "since": "2027-01-01"}}}
    http = FakeHTTP(refreshed="ANDERER")
    msg, days = sh.check_instagram("horror", "TOKEN", state, date(2027, 2, 22), http)
    assert days == 8 and "läuft in ca. 8 Tagen ab" in msg


def test_instagram_invalid_token_alerts(tmp_state):
    msg, days = sh.check_instagram("horror", "TOKEN", {}, date(2027, 1, 1), FakeHTTP(me_ok=False))
    assert days == 0 and "ungültig" in msg


def test_tiktok_expiry_warning(monkeypatch):
    monkeypatch.setenv("TIKTOK_CLIENT_KEY", "k")
    monkeypatch.setenv("TIKTOK_CLIENT_SECRET", "s")
    assert "10 Tagen" in sh.check_tiktok(
        "horror", "r", FakeHTTP(tiktok={"access_token": "a", "refresh_expires_in": 10 * 86400})
    )
    assert (
        sh.check_tiktok(
            "horror", "r", FakeHTTP(tiktok={"access_token": "a", "refresh_expires_in": 300 * 86400})
        )
        is None
    )
    assert "funktioniert nicht" in sh.check_tiktok("horror", "r", FakeHTTP(tiktok={"error": "x"}))


def test_health_run_reports_low_story_pool(tmp_state, monkeypatch):
    monkeypatch.setenv("STORY_ENABLED_ACCOUNTS", "horror")
    for k in ("HORROR_IG_ACCESS_TOKEN", "MYSTERY_IG_ACCESS_TOKEN", "TIKTOK_CLIENT_KEY"):
        monkeypatch.delenv(k, raising=False)
    _, stories = sr.load_account("horror")
    sr.save_state({"horror": {"posted": [s["id"] for s in stories]}})
    monkeypatch.setattr(sh, "last_post_hours", lambda a: 3)
    monkeypatch.setattr(sh, "posts_last_days", lambda a: 14)
    problems, summary, weekly = sh.run(today=date(2027, 1, 4), http=FakeHTTP())
    assert any("Geschichte" in p for p in problems)
    assert weekly and "14 Reels" in summary[0] and "pausiert" in summary[1]


# --------------------------------------------------------------------------- Geschichten-Schreiber


def make_story_json(n_scenes=8):
    return {
        "suitable": True,
        "reason": "ok",
        "id": "neuer_fall",
        "hook": {
            "text": "Ein *unheimlicher* Fall, den bis heute niemand erklären kann.",
            "image": "dark house",
        },
        "scenes": [
            {
                "text": "Das ist eine Szene mit genau vierzehn Wörtern damit die Länge gut passt hier.",
                "image": "foggy forest",
            }
            for _ in range(n_scenes)
        ],
        "tags": ["#grusel", "#wahregeschichte"],
    }


def test_extract_json_from_codeblock():
    assert sw.extract_json('Hier:\n```json\n{"a": 1}\n```') == {"a": 1}


def test_write_story_valid_and_retry(monkeypatch):
    answers = [json.dumps(make_story_json(3)), json.dumps(make_story_json(8))]
    monkeypatch.setattr(sw, "cf_chat", lambda msgs, a, t, m: answers.pop(0))
    cfg, _ = sr.load_account("horror")
    story, model = sw.write_story(cfg, "Titel", "Text", "dyatlov", ("a", "t"), models=["m1"])
    assert story["id"] == "neuer_fall" and len(story["scenes"]) == 8 and model == "m1"


def test_write_story_rejected(monkeypatch):
    monkeypatch.setattr(
        sw, "cf_chat", lambda *a: json.dumps({"suitable": False, "reason": "Kinder als Opfer"})
    )
    cfg, _ = sr.load_account("horror")
    story, info = sw.write_story(cfg, "T", "X", "", ("a", "t"), models=["m1"])
    assert story is None and "Kinder" in info


def test_generate_appends_story_and_marks_article(tmp_state, tmp_path, monkeypatch):
    content = tmp_path / "content"
    content.mkdir()
    data = json.load(open(f"{sr.CONTENT_DIR}/horror.json", encoding="utf-8"))
    data["account"]["wiki_seeds"] = ["Fall A", "Fall B"]
    (content / "horror.json").write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    monkeypatch.setattr(sr, "CONTENT_DIR", str(content))
    monkeypatch.setenv("CLOUDFLARE_ACCOUNT_ID", "a")
    monkeypatch.setenv("CLOUDFLARE_API_TOKEN", "t")
    monkeypatch.setattr(
        sw,
        "wiki_article",
        lambda t: None if t == "Fall A" else (t, "x" * 3000, "https://de.wikipedia.org/wiki/B"),
    )
    monkeypatch.setattr(sw, "write_story", lambda *a, **k: (dict(make_story_json()), "m1"))
    assert sw.generate("horror", 1) == 1
    new = json.load(open(content / "horror.json", encoding="utf-8"))["stories"][-1]
    assert new["id"] == "neuer_fall" and new["source"].endswith("/B")
    assert sr.load_state()["horror"]["wiki_used"] == ["Fall A", "Fall B"]
    assert sr.validate_story({k: new[k] for k in ("id", "hook", "scenes", "tags")}) == []


def test_review_without_working_telegram_still_posts(tmp_state, monkeypatch):
    monkeypatch.setattr(rv.time, "sleep", lambda s: None)

    class Broken(FakeTG):
        def send_video(self, *a):
            raise TimeoutError("telegram down")

    assert rv.review("horror", deadline(), Broken([]), make=fake_make(["a"])) == (True, "a")


def test_tidy_and_validate_ai_formatting():
    story = make_story_json()
    story["scenes"][0]["text"] = "Ohne Punkt am Ende  hier"
    story["scenes"][1]["image"] = "*dark* forest"
    story["tags"] = ["grusel", "#a", "#b", "#c"]
    sr.tidy_story(story)
    assert story["scenes"][0]["text"].endswith("hier.") and "*" not in story["scenes"][1]["image"]
    assert story["tags"] == ["#grusel", "#a", "#b"]
    story["scenes"][2]["text"] = "*eins* *zwei* *drei* und noch mehr Woerter fuer die Szene hier."
    for sc in story["scenes"]:
        sc["image"] = "Eine dunkle Zelle mit einem alten Mann und der Tür"
    problems = " ".join(sr.validate_story({k: story[k] for k in ("id", "hook", "scenes", "tags")}))
    assert "Englisch" in problems and "Hervorhebungen" in problems

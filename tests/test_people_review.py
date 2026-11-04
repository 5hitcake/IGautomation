from datetime import datetime, timedelta, timezone

import people_review as pr
import pytest

CHAT = "12345"


def cb(action, token, chat=CHAT, sender=CHAT, update_id=1):
    return {
        "update_id": update_id,
        "callback_query": {
            "id": f"q{update_id}",
            "from": {"id": int(sender)},
            "message": {"chat": {"id": int(chat)}},
            "data": f"{action}:{token}",
        },
    }


def test_parse_callback_accepts_only_own_chat_and_current_candidate():
    assert pr.parse_callback(cb("approve", "t1"), CHAT, "t1") == "approve"
    assert pr.parse_callback(cb("approve", "t1", chat="999"), CHAT, "t1") is None
    assert pr.parse_callback(cb("approve", "t1", sender="999"), CHAT, "t1") is None
    assert pr.parse_callback(cb("approve", "old"), CHAT, "t1") is None
    assert pr.parse_callback(cb("hack", "t1"), CHAT, "t1") is None
    assert pr.parse_callback({"update_id": 5, "message": {"text": "hi"}}, CHAT, "t1") is None


def test_next_target_today_late_or_tomorrow():
    now = datetime(2026, 11, 4, 12, 0, tzinfo=timezone.utc)
    assert pr.next_target("17:13", now) == datetime(2026, 11, 4, 17, 13, tzinfo=timezone.utc)
    # Verspaeteter Lauf (Termin vor 47 Min.): kurze Bedenkzeit statt bis morgen warten
    assert pr.next_target("11:13", now) == now + pr.LATE_REVIEW
    # Gestern 23:43, Lauf erst 00:55 gestartet -> ebenfalls verspaetet, nicht +1 Tag
    late = datetime(2026, 11, 4, 0, 55, tzinfo=timezone.utc)
    assert pr.next_target("23:43", late) == late + pr.LATE_REVIEW
    # Termin weit in der Vergangenheit -> naechster Tag
    assert pr.next_target("02:00", now) == datetime(2026, 11, 5, 2, 0, tzinfo=timezone.utc)


class FakeTelegram(pr.Telegram):
    """Simuliert die Telegram-API: Klicks werden aus `script` abgespielt."""

    def __init__(self, script):
        super().__init__("token", CHAT, session=object())
        self.script = list(script)  # Entscheidungen fuer jeden gesendeten Kandidaten (None = keine Antwort)
        self.sent, self.statuses, self.texts = [], [], []
        self.pending = []
        self.uid = 100

    def call(self, method, files=None, http_timeout=60, **params):
        if method == "sendPhoto":
            self.sent.append(params["caption"])
            token = params["reply_markup"].split('"callback_data": "approve:')[1].split('"')[0]
            action = self.script.pop(0)
            if action:
                self.uid += 1
                self.pending.append(cb(action, token, update_id=self.uid))
            return {"message_id": len(self.sent)}
        if method == "getUpdates":
            if params.get("offset") == -1:
                return [cb("approve", "stale", update_id=1)]
            out, self.pending = self.pending, []
            if not out:
                self.clock[0] += timedelta(hours=4)  # niemand antwortet -> Zeit laeuft ab
            return out
        if method == "editMessageCaption":
            self.statuses.append(params["caption"])
            return {}
        if method == "sendMessage":
            self.texts.append(params["text"])
            return {}
        return {}


@pytest.fixture
def setup(monkeypatch):
    def run(script):
        tg = FakeTelegram(script)
        clock = [datetime(2026, 11, 4, 8, 13, tzinfo=timezone.utc)]
        tg.clock = clock
        counter = {"n": 0}

        def fake_candidate(state, dry_run=False, skip_reserve=()):
            counter["n"] += 1
            return {"number": 7, "model": "@cf/x/flux-2-klein-9b", "caption": f"cap{counter['n']}",
                    "jpeg": b"jpg", "persona": {}, "prompt": "p"}

        monkeypatch.setattr(pr.pg, "create_candidate", fake_candidate)
        deadline = clock[0] + timedelta(hours=3)
        slept = []
        result = pr.review(tg, {}, deadline, sleep=slept.append, now=lambda: clock[0])
        return tg, result, slept
    return run


def test_approve_waits_until_deadline(setup):
    tg, result, slept = setup(["approve"])
    assert result["caption"] == "cap1"
    assert slept and slept[0] == pytest.approx(3 * 3600)
    assert tg.statuses[0].startswith("✅ Freigegeben")


def test_stale_clicks_from_old_runs_are_ignored(setup):
    tg, result, _ = setup([None])  # nur der alte "approve:stale"-Klick existiert
    assert tg.offset is not None
    assert tg.statuses[0].startswith("⏰ Keine Antwort")
    assert result is not None


def test_reject_skips_post(setup):
    tg, result, _ = setup(["reject"])
    assert result is None and tg.statuses[0].startswith("❌")


def test_reroll_creates_new_person_once(setup):
    tg, result, _ = setup(["reroll", "approve"])
    assert len(tg.sent) == 2 and result["caption"] == "cap2"
    assert tg.statuses[0].startswith("🔄")


def test_reroll_limit_then_auto_post(setup):
    tg, result, _ = setup(["reroll", "reroll"])
    assert len(tg.sent) == 2 and result["caption"] == "cap2"
    assert any("Keine weitere" in t for t in tg.texts)


def test_generation_failure_is_reported(monkeypatch):
    tg = FakeTelegram([])

    def boom(state, dry_run=False, skip_reserve=()):
        raise RuntimeError("daily free allocation used up")

    monkeypatch.setattr(pr.pg, "create_candidate", boom)
    with pytest.raises(RuntimeError):
        pr.review(tg, {}, datetime.now(timezone.utc) + timedelta(hours=1), sleep=lambda s: None)
    assert "Kein Bild" in tg.texts[0]


class FakeBatchTelegram(FakeTelegram):
    """Wie FakeTelegram, aber Klicks kommen erst, wenn getUpdates abgefragt wird,
    in der Reihenfolge von `clicks` (Index der gesendeten Nachricht, Aktion)."""

    def __init__(self, clicks):
        super().__init__([])
        self.clicks = list(clicks)
        self.tokens = []

    def call(self, method, files=None, http_timeout=60, **params):
        if method == "sendPhoto":
            self.sent.append(params["caption"])
            self.tokens.append(params["reply_markup"].split('"callback_data": "approve:')[1].split('"')[0])
            return {"message_id": len(self.sent)}
        if method == "getUpdates" and params.get("offset") != -1:
            if self.clicks:
                idx, action = self.clicks.pop(0)
                self.uid += 1
                return [cb(action, self.tokens[idx], update_id=self.uid)]
            self.clock[0] += timedelta(hours=4)
            return []
        return super().call(method, files=files, http_timeout=http_timeout, **params)


@pytest.fixture
def batch(monkeypatch):
    def run(clicks):
        tg = FakeBatchTelegram(clicks)
        clock = [datetime(2026, 11, 4, 7, 30, tzinfo=timezone.utc)]
        tg.clock = clock
        n = {"i": 0}

        def fake_candidate(state, dry_run=False, skip_reserve=()):
            n["i"] += 1
            persona = {"gender": "woman", "age_range": [20, 29], "heritage": ["X", "x"], "setting": "s",
                       "name": f"P{n['i']}", "age": 25}
            return {"number": state.get("count", 0) + 1, "model": "@cf/x/m", "persona": persona,
                    "caption": f"Person No. {state.get('count', 0) + 1:04d} cap{n['i']}",
                    "jpeg": b"jpg", "prompt": "p"}

        monkeypatch.setattr(pr.pg, "create_candidate", fake_candidate)
        slots = [datetime(2026, 11, 4, 11, 13, tzinfo=timezone.utc),
                 datetime(2026, 11, 4, 17, 13, tzinfo=timezone.utc)]
        state = {"count": 4, "recent": []}
        res = pr.review_batch(tg, state, slots, slots[0], now=lambda: clock[0])
        return tg, res, state
    return run


def test_batch_sends_both_and_handles_each_answer(batch):
    tg, res, state = batch([(1, "reject"), (0, "approve")])
    assert len(tg.sent) == 2
    assert "08:13" in tg.sent[0] and "14:13" in tg.sent[1]  # argentinische Zeit
    assert res[0]["caption"].endswith("cap1") and res[1] is None
    assert state == {"count": 4, "recent": []}  # echtes Log bleibt unveraendert


def test_batch_timeout_approves_rest_and_reroll_replaces(batch):
    tg, res, _ = batch([(0, "reroll")])
    assert len(tg.sent) == 3  # 2 + 1 neue Person fuer den ersten Termin
    assert res[0]["caption"].endswith("cap3") and res[1]["caption"].endswith("cap2")
    assert sum(s.startswith("⏰") for s in tg.statuses) == 2


def test_queue_roundtrip_renumbers(tmp_path, monkeypatch):
    monkeypatch.setattr(pr, "QUEUE_DIR", str(tmp_path))
    cand = {"persona": {"name": "A"}, "prompt": "p", "model": "m", "reserve": None,
            "caption": "Hook\n\nPerson No. 0005 · \"A\", 30", "jpeg": b"jpg"}
    pr.save_to_queue("11:13", cand)
    pr.save_to_queue("17:13", None)
    got, status = pr.load_from_queue("11:13", {"count": 7})
    assert status == "ok" and got["number"] == 8 and "Person No. 0008" in got["caption"]
    assert pr.load_from_queue("17:13", {"count": 8}) == (None, "rejected")
    assert pr.load_from_queue("11:13", {"count": 8}) == (None, "missing")
    assert list(tmp_path.iterdir()) == []

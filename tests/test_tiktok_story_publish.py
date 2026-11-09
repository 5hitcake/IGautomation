import json

import pytest
import tiktok_story_publish as tt


class FakeResp:
    def __init__(self, data, status=200):
        self._data, self.status_code, self.text = data, status, json.dumps(data)

    @property
    def ok(self):
        return self.status_code < 400

    def json(self):
        return self._data


def test_payload_inbox_has_no_post_info():
    p = tt.build_payload("inbox", 20_000_000, "Hallo")
    assert "post_info" not in p
    assert p["source_info"] == {
        "source": "FILE_UPLOAD",
        "video_size": 20_000_000,
        "chunk_size": 20_000_000,
        "total_chunk_count": 1,
    }


def test_payload_direct_and_large_video_chunks():
    p = tt.build_payload("direct", 150_000_000, "x" * 3000, "PUBLIC_TO_EVERYONE")
    assert len(p["post_info"]["title"]) == tt.MAX_TITLE
    assert p["post_info"]["privacy_level"] == "PUBLIC_TO_EVERYONE"
    assert p["source_info"]["chunk_size"] == tt.CHUNK_MAX
    assert p["source_info"]["total_chunk_count"] == 2  # letzter Teil nimmt den Rest


def test_refresh_token_flow(monkeypatch, capsys):
    calls = {}

    def fake_post(url, data=None, headers=None, timeout=None):
        calls["data"] = data
        return FakeResp(
            {"access_token": "act", "refresh_token": "GEHEIM_XYZ", "refresh_expires_in": 20 * 86400}
        )

    monkeypatch.setattr(tt.SESSION, "post", fake_post)
    assert tt.refresh_access_token("k", "s", "alt") == "act"
    assert calls["data"]["grant_type"] == "refresh_token"
    out = capsys.readouterr().out
    assert "GEHEIM_XYZ" not in out  # neuer Token wird nie ausgegeben
    assert "20 Tagen" in out


def test_api_error_is_raised(monkeypatch):
    monkeypatch.setattr(
        tt.SESSION, "post", lambda *a, **k: FakeResp({"error": {"code": "access_token_invalid"}}, 401)
    )
    with pytest.raises(RuntimeError):
        tt.refresh_access_token("k", "s", "r")


def test_choose_privacy(monkeypatch):
    monkeypatch.setattr(
        tt.SESSION,
        "post",
        lambda *a, **k: FakeResp(
            {"data": {"privacy_level_options": ["SELF_ONLY", "PUBLIC_TO_EVERYONE"]}, "error": {"code": "ok"}}
        ),
    )
    monkeypatch.delenv("TIKTOK_PRIVACY_LEVEL", raising=False)
    assert tt.choose_privacy("t") == "PUBLIC_TO_EVERYONE"
    monkeypatch.setattr(
        tt.SESSION,
        "post",
        lambda *a, **k: FakeResp({"data": {"privacy_level_options": ["SELF_ONLY"]}, "error": {"code": "ok"}}),
    )
    assert tt.choose_privacy("t") == "SELF_ONLY"


def test_check_account(monkeypatch):
    def fake_get(url, params=None, headers=None, timeout=None):
        return FakeResp({"data": {"user": {"display_name": "Gruselgeschichten"}}, "error": {"code": "ok"}})

    monkeypatch.setattr(tt.SESSION, "get", fake_get)
    tt.check_account("t", "gruselgeschichten")  # Gross/klein egal
    with pytest.raises(RuntimeError, match="NICHT hochgeladen"):
        tt.check_account("t", "MYSTERY=HISTORY")


def test_publish_retries_once_when_tiktok_hangs(monkeypatch):
    calls = []

    def fake_once(token, video_path, payload, mode):
        calls.append(1)
        if len(calls) == 1:
            raise TimeoutError("haengt")
        return "SEND_TO_USER_INBOX"

    monkeypatch.setattr(tt, "publish_once", fake_once)
    assert tt.publish_with_retry("t", "v.mp4", {}, "inbox") == "SEND_TO_USER_INBOX"
    assert len(calls) == 2

    calls.clear()

    def always_hangs(*args):
        calls.append(1)
        raise TimeoutError("haengt")

    monkeypatch.setattr(tt, "publish_once", always_hangs)
    with pytest.raises(TimeoutError):
        tt.publish_with_retry("t", "v.mp4", {}, "inbox")
    assert len(calls) == 2

import publish
import pytest


class Resp:
    def __init__(self, data):
        self._d = data

    def json(self):
        return self._d

    def raise_for_status(self):
        pass


def test_instagram_account_check(monkeypatch):
    monkeypatch.setattr(publish.SESSION, "get", lambda *a, **k: Resp({"username": "wahre_gruselgeschichten"}))
    publish.check_account("t", "@wahre_gruselgeschichten")
    with pytest.raises(SystemExit, match="NICHT gepostet"):
        publish.check_account("t", "imysteryhistoryi")


@pytest.mark.parametrize("acc", ["horror", "mysteries"])
def test_accounts_have_expected_names(acc):
    import story_reel as sr

    cfg, _ = sr.load_account(acc)
    assert cfg["instagram_username"] and cfg["tiktok_name"]
    assert cfg["handle"].lstrip("@") == cfg["instagram_username"]


class ApiResp:
    def __init__(self, status, data):
        self.status_code, self._d, self.ok = status, data, status < 400

    def json(self):
        return self._d

    def raise_for_status(self):
        if not self.ok:
            import requests

            raise requests.HTTPError(f"{self.status_code}")


NOT_FOUND = {"error": {"code": 24, "error_subcode": 2207006, "message": "Media Not Found"}}


def test_publish_retries_media_not_found(monkeypatch):
    answers = [ApiResp(400, NOT_FOUND), ApiResp(200, {"id": "123"})]
    monkeypatch.setattr(publish.SESSION, "post", lambda *a, **k: answers.pop(0))
    publish.publish_media("acc", "tok", "c1", False, wait=0)
    assert answers == []


def test_publish_does_not_retry_other_errors(monkeypatch):
    calls = []

    def post(*a, **k):
        calls.append(1)
        return ApiResp(400, {"error": {"code": 190, "message": "Token ungueltig"}})

    monkeypatch.setattr(publish.SESSION, "post", post)
    with pytest.raises(RuntimeError, match="Token ungueltig"):
        publish.publish_media("acc", "tok", "c1", False, wait=0)
    assert len(calls) == 1


def test_lost_container_is_recreated_once(monkeypatch):
    created, published = [], []
    monkeypatch.setattr(publish, "create_media_container", lambda *a: created.append(1) or f"c{len(created)}")
    monkeypatch.setattr(publish, "wait_for_media_ready", lambda *a: None)

    def fake_publish(acc, tok, cid, dry):
        published.append(cid)
        if cid == "c1":
            raise RuntimeError("Graph-API-Fehler (400): {'error_subcode': 2207006}")

    monkeypatch.setattr(publish, "publish_media", fake_publish)
    publish.create_and_publish("acc", "tok", {"type": "story"}, False)
    assert published == ["c1", "c2"]

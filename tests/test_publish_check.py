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

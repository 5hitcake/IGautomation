import refresh_tokens as rt


class Resp:
    def __init__(self, status, payload):
        self.status_code, self._payload, self.ok = status, payload, status < 400

    def json(self):
        return self._payload


class Http:
    def __init__(self, ig=None, tiktok=None):
        self.ig, self.tiktok, self.calls = ig or {}, tiktok, []

    def get(self, url, params=None, timeout=None):
        self.calls.append(("ig", params["access_token"]))
        return self.ig.get(params["access_token"], Resp(400, {"error": {"message": "Invalid token"}}))

    def post(self, url, data=None, headers=None, timeout=None, json=None):
        self.calls.append(("tiktok", data["refresh_token"]))
        return self.tiktok


def recorder():
    saved = {}

    def saver(name, value, dry_run=False):
        saved[name] = value
        return True, "neuer Token gespeichert"

    return saved, saver


def test_same_token_is_only_extended():
    http = Http(ig={"tok-a": Resp(200, {"access_token": "tok-a", "expires_in": 5184000})})
    saved, saver = recorder()
    results = rt.run_all({"IG_ACCESS_TOKEN": "tok-a"}, http=http, saver=saver)
    assert results == [(True, "@mindset_und.motivation", "verlängert, gültig noch 60 Tage")]
    assert saved == {}


def test_new_instagram_token_is_saved_to_secret():
    http = Http(ig={"old": Resp(200, {"access_token": "new", "expires_in": 5184000})})
    saved, saver = recorder()
    results = rt.run_all({"WOE_ACCOUNT_TOKEN": "old"}, http=http, saver=saver)
    assert saved == {"WOE_ACCOUNT_TOKEN": "new"}
    assert results[0][0] is True and "gespeichert" in results[0][2]


def test_invalid_token_is_reported_without_leaking_it():
    http = Http()
    saved, saver = recorder()
    results = rt.run_all({"PTNE_API_TOKEN": "geheim123"}, http=http, saver=saver)
    ok, label, text = results[0]
    assert not ok and label == "These people do not exist"
    assert "geheim123" not in text and "geheim123" not in rt.report(results)


def test_unset_secrets_are_skipped():
    assert rt.run_all({}, http=Http()) == []


def test_rotated_tiktok_refresh_token_is_saved():
    tiktok = Resp(200, {"access_token": "acc", "refresh_token": "r2", "refresh_expires_in": 31536000})
    saved, saver = recorder()
    env = {"TIKTOK_CLIENT_KEY": "k", "TIKTOK_CLIENT_SECRET": "s", "HORROR_TIKTOK_REFRESH_TOKEN": "r1"}
    results = rt.run_all(env, http=Http(tiktok=tiktok), saver=saver)
    assert saved == {"HORROR_TIKTOK_REFRESH_TOKEN": "r2"}
    assert results[0][0] is True


def test_save_secret_needs_write_token(monkeypatch):
    monkeypatch.delenv("GH_TOKEN", raising=False)
    ok, text = rt.save_secret("X", "v")
    assert not ok and "SECRETS_WRITE_TOKEN" in text


def test_save_secret_passes_value_via_stdin_only(monkeypatch):
    monkeypatch.setenv("GH_TOKEN", "t")
    monkeypatch.setenv("GITHUB_REPOSITORY", "o/r")
    seen = {}

    class Done:
        returncode, stderr = 0, ""

    def runner(cmd, input=None, text=None, capture_output=None):
        seen["cmd"], seen["input"] = cmd, input
        return Done()

    assert rt.save_secret("WOE_ACCOUNT_TOKEN", "wert", runner=runner) == (True, "neuer Token gespeichert")
    assert seen["cmd"] == ["gh", "secret", "set", "WOE_ACCOUNT_TOKEN", "--repo", "o/r"]
    assert seen["input"] == "wert" and "wert" not in seen["cmd"]


def test_workflow_passes_every_secret():
    import os

    root = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
    with open(os.path.join(root, ".github", "workflows", "token_refresh.yml"), encoding="utf-8") as f:
        wf = f.read()
    for name in [*rt.INSTAGRAM_SECRETS, *rt.TIKTOK_SECRETS]:
        assert f"{name}: ${{{{ secrets.{name} }}}}" in wf

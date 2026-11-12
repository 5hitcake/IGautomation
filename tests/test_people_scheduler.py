"""Der Cloudflare-Zeitgeber muss zu den Modi von people_post.yml passen."""
import os
import re

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
WORKER = os.path.join(ROOT, "cloudflare", "people_scheduler")


def _worker_schedule():
    with open(os.path.join(WORKER, "src", "index.js"), encoding="utf-8") as f:
        js = f.read()
    block = js.split("export const SCHEDULE = {", 1)[1].split("};", 1)[0]
    return dict(re.findall(r'"([^"]+)":\s*"([^"]+)"', block))


def _worker_js():
    with open(os.path.join(WORKER, "src", "index.js"), encoding="utf-8") as f:
        return f.read()


def _story_cron():
    return re.search(r'STORY_CRON = "([^"]+)"', _worker_js()).group(1)


def _story_slots():
    block = _worker_js().split("export const STORY_SLOTS = {", 1)[1].split("};", 1)[0]
    return re.findall(r'"(\d\d):(\d\d)": \{ slot: "([^"]+)", account: "(\w+)" \}', block)


def test_story_slots_match_cron_and_workflow():
    minutes, hours = _story_cron().split()[:2]
    with open(os.path.join(ROOT, ".github", "workflows", "story_reels.yml"), encoding="utf-8") as f:
        wf = f.read()
    slots = _story_slots()
    assert len(slots) == 4
    for hh, mm, slot, account in slots:
        assert hh in hours.split(",") and mm in minutes.split(",")
        assert slot == f"{int(mm)} {int(hh)} * * *"
        assert f'"{slot}") acc={account};' in wf


def test_crons_match_schedule():
    with open(os.path.join(WORKER, "wrangler.toml"), encoding="utf-8") as f:
        toml = f.read()
    crons = re.findall(r'^\s*"([0-9*/ ,-]+)",', toml, re.M)
    assert sorted(crons) == sorted([*_worker_schedule(), _story_cron()])
    assert len(crons) <= 5  # Gratis-Tarif: max. 5 Cron-Trigger pro Konto


def test_modes_exist_in_workflow():
    with open(os.path.join(ROOT, ".github", "workflows", "people_post.yml"), encoding="utf-8") as f:
        wf = f.read()
    options = re.findall(r'^\s+- "([^"]+)"$', wf.split("options:", 1)[1].split("wait_minutes:", 1)[0], re.M)
    assert "Einzelner Post" in options
    for mode in _worker_schedule().values():
        assert mode in options
        # Der Modus muss im Schritt "Posting-Termin bestimmen" auch einen Fall haben.
        cases = re.findall(r'^\s+("?[^)\n]+"?\*?)\)', wf, re.M)
        assert any(mode.startswith(c.rstrip("*").strip('"')) for c in cases)


def test_kaufkraft_slots_reachable_by_cron_in_summer_and_winter():
    """Mo-Fr 18:52 / Sa+So 10:52 deutscher Zeit = 16:52/17:52 bzw. 08:52/09:52 UTC."""
    minutes, hours = _story_cron().split()[:2]
    js = _worker_js()
    assert 'weekday: "18:52"' in js and 'weekend: "10:52"' in js
    assert "52" in minutes.split(",")
    for h in ("8", "9", "16", "17"):
        assert h in hours.split(",")


def test_kaufkraft_workflow_accepts_worker_inputs():
    with open(os.path.join(ROOT, ".github", "workflows", "kaufkraft_post.yml"), encoding="utf-8") as f:
        wf = f.read()
    assert 'KAUFKRAFT_WORKFLOW = "kaufkraft_post.yml"' in _worker_js()
    for name in ("kind:", "product:", "planned:"):
        assert name in wf.split("workflow_dispatch:", 1)[1].split("permissions:", 1)[0]

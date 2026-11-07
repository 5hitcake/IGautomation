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


def test_crons_match_schedule():
    with open(os.path.join(WORKER, "wrangler.toml"), encoding="utf-8") as f:
        toml = f.read()
    crons = re.findall(r'^\s*"([0-9*/ ,-]+)",', toml, re.M)
    assert sorted(crons) == sorted(_worker_schedule())
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

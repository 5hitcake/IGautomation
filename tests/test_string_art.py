"""Fadenbild-Reels: Motivwahl, Texte, Zeitgeber-Termine und Workflow passen zusammen."""
import json
import os
import random
import re
from datetime import datetime, timedelta, timezone

import string_post as sp

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))


def _cfg():
    with open(sp.CONFIG, encoding="utf-8") as f:
        return json.load(f)


def test_motifs_have_unique_ids_and_known_kinds():
    cfg = _cfg()
    ids = [m["id"] for m in cfg["motifs"]]
    assert len(ids) == len(set(ids))
    for m in cfg["motifs"]:
        assert m["kind"] in cfg["weights"], m
        assert m.get("subject") or m.get("figure"), m


def test_pick_motif_avoids_recent_posts():
    cfg = _cfg()
    now = datetime.now(timezone.utc).isoformat()
    supers = [m["id"] for m in cfg["motifs"] if m["kind"] == "superhero"]
    log = {"posts": [{"id": i, "date": now} for i in supers[:-1]], "skipped": []}
    m = sp.pick_motif(cfg, log, random.Random(1), kind="superhero")
    assert m["id"] == supers[-1]


def test_old_posts_may_repeat():
    old = (datetime.now(timezone.utc) - timedelta(days=sp.NO_REPEAT_DAYS + 5)).isoformat()
    assert sp.recent_ids({"posts": [{"id": "batman", "date": old}]}) == set()


def test_prompts_ask_for_contrast_and_white_background():
    for m in _cfg()["motifs"]:
        if m["kind"] == "illusion":
            continue
        p = sp.prompt_for(m)
        assert "black and white" in p and "white" in p.split("black and white", 1)[1]


def test_caption_has_hook_counts_and_hashtags():
    m = {"id": "batman", "kind": "superhero", "title": "Batman", "tags": ["batman", "dc"]}
    spec = {"nails": [0] * 360, "segs": [0] * 5000}
    cap = sp.caption_for(m, spec)
    assert "360 Nägel" in cap and "5000" in cap
    assert "#stringart" in cap and "#batman" in cap
    assert len(cap) < 2200


def test_worker_string_slots_match_workflow_and_cron():
    with open(os.path.join(ROOT, "cloudflare", "people_scheduler", "src", "index.js"), encoding="utf-8") as f:
        js = f.read()
    cron = re.search(r'STORY_CRON = "([^"]+)"', js).group(1)
    minutes, hours = cron.split()[0].split(","), cron.split()[1].split(",")
    block = js.split("export const STRING_SLOTS = {", 1)[1].split("};", 1)[0]
    slots = dict(re.findall(r'"(\d\d:\d\d)":\s*"([^"]+)"', block))
    assert len(slots) == 2
    with open(os.path.join(ROOT, ".github", "workflows", "string_art.yml"), encoding="utf-8") as f:
        wf = f.read()
    for hhmm, slot in slots.items():
        h, mnt = hhmm.split(":")
        assert str(int(h)) in hours and mnt in minutes, hhmm
        assert f'"{slot}")' in wf, slot  # Workflow kennt den Termin

"""Power of Christ – Einstieg für .github/workflows/poc_post.yml.

    python poc/src/run.py build verse     # Vers-Reel bauen  -> poc/out/verse/next_post.json + reel_*.mp4
    python poc/src/run.py build story     # Story-Reel bauen -> poc/out/story/...
    python poc/src/run.py done verse      # nach erfolgreichem Posten: Verlauf fortschreiben

Gepostet wird mit scripts/publish.py (wie bei den anderen Accounts): das Video liegt dafür
auf dem Branch poc-media-<art>, Instagram holt es über raw.githubusercontent.com ab.
"""
import argparse
import json
import re
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

from common import BERLIN, ROOT, load_state, log, save_state

OUT_ROOT = ROOT / "out"


def build(kind):
    from make_story import make as make_story
    from make_verse import make as make_verse

    res = make_verse() if kind == "verse" else make_story()
    out = OUT_ROOT / kind
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    ident = res["id"].lower().translate(str.maketrans({"ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss"}))
    slug = re.sub(r"[^a-z0-9]+", "_", ident).strip("_")[:40]
    name = f"reel_{datetime.now(BERLIN):%Y%m%d}_{slug}.mp4"
    shutil.copy(res["video"], out / name)
    post = {
        "type": "reel",
        "file": name,
        "branch": f"poc-media-{kind}",
        "thumb_offset": res["thumb_ms"],
        "caption": res["caption"],
        "account": "powerofchrist",
        "kind": kind,
        "item_id": res["id"],
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    (out / "next_post.json").write_text(json.dumps(post, ensure_ascii=False, indent=2), encoding="utf-8")
    if kind == "verse":
        # Dasselbe Bild (mit Vers) zusätzlich als Instagram-Story – JPEG, 1080×1920
        story_name = name.replace("reel_", "story_").replace(".mp4", ".jpg")
        shutil.copy(Path(res["dir"]) / "cover.jpg", out / story_name)
        story = {"type": "story", "file": story_name, "branch": f"poc-media-{kind}", "caption": "",
                 "account": "powerofchrist", "kind": "ig-story", "item_id": res["id"]}
        (out / "story_post.json").write_text(json.dumps(story, ensure_ascii=False, indent=2), encoding="utf-8")
    log("bereit:", out / name)
    return post


def done(kind):
    post = json.loads((OUT_ROOT / kind / "next_post.json").read_text(encoding="utf-8"))
    st = load_state()
    st["verses" if kind == "verse" else "stories"].append(post["item_id"])
    if kind == "story":
        st["story_count"] = st.get("story_count", 0) + 1
    st["posts"] = (st.get("posts", []) + [{"time": datetime.now(BERLIN).isoformat(timespec="minutes"),
                                            "kind": kind, "id": post["item_id"]}])[-200:]
    save_state(st)
    log("Verlauf aktualisiert:", post["item_id"])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("action", choices=["build", "done"])
    ap.add_argument("kind", choices=["verse", "story"])
    a = ap.parse_args()
    build(a.kind) if a.action == "build" else done(a.kind)
    return 0


if __name__ == "__main__":
    sys.exit(main())

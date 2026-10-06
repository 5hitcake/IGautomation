"""Waehlt die naechste Jota-Labs-Story (@jota_labsweb) aus assets/jotalabs_stories/
und schreibt assets/jotalabs_generated/next_post.json fuer publish.py.

Die Stories sind fertig gerenderte JPEGs (Vorlage: content/jotalabs/stories.html).
Sie werden der Reihe nach gepostet (story_01, story_02, ...), damit sich Demos,
Preise, Tipps und Aufrufe abwechseln; nach der letzten beginnt es wieder vorne.
"""
import json
import os

from common import ROOT

STORIES_DIR = os.path.join(ROOT, "assets", "jotalabs_stories")
GENERATED_DIR = os.path.join(ROOT, "assets", "jotalabs_generated")
STATE_PATH = os.path.join(ROOT, "jotalabs_posted_log.json")


def list_stories(stories_dir=None):
    stories_dir = stories_dir or STORIES_DIR
    return sorted(f for f in os.listdir(stories_dir) if f.lower().endswith((".jpg", ".jpeg")))


def load_state(path=None):
    path = path or STATE_PATH
    if not os.path.exists(path):
        return {"last_story": None, "history": []}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def pick_next_story(state, stories):
    """Gibt die Datei nach state["last_story"] zurueck (zyklisch). Ist die zuletzt
    gepostete Datei nicht mehr vorhanden, geht es mit der naechsten nach Namen weiter."""
    if not stories:
        raise RuntimeError("Keine Stories in assets/jotalabs_stories/ gefunden.")
    last = state.get("last_story")
    following = [s for s in stories if last is None or s > last]
    choice = following[0] if following else stories[0]
    state["last_story"] = choice
    state["history"] = (state.get("history", []) + [choice])[-30:]
    return choice


def main():
    stories = list_stories()
    state = load_state()
    choice = pick_next_story(state, stories)

    os.makedirs(GENERATED_DIR, exist_ok=True)
    post = {"type": "story", "file": f"assets/jotalabs_stories/{choice}", "caption": ""}
    with open(os.path.join(GENERATED_DIR, "next_post.json"), "w", encoding="utf-8") as f:
        json.dump(post, f, ensure_ascii=False, indent=2)
    with open(STATE_PATH, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)
    print(f"Naechste Story: {choice}")


if __name__ == "__main__":
    main()

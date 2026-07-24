import json
import os
import random

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
STATE_PATH = os.path.join(ROOT, "posted_log.json")
QUOTES_PATH = os.path.join(ROOT, "content", "quotes_de.json")
HASHTAGS_PATH = os.path.join(ROOT, "content", "hashtags.json")
REELS_PATH = os.path.join(ROOT, "content", "reels.json")
BACKGROUNDS_DIR = os.path.join(ROOT, "assets", "backgrounds")
BG_VIDEOS_DIR = os.path.join(ROOT, "assets", "bg_videos")
MUSIC_DIR = os.path.join(ROOT, "assets", "music")
GENERATED_DIR = os.path.join(ROOT, "assets", "generated")
FONTS_DIR = os.path.join(ROOT, "assets", "fonts")

RECENT_BACKGROUND_WINDOW = 5


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_state():
    if not os.path.exists(STATE_PATH):
        return {
            "posted_quote_ids": [],
            "posted_reel_ids": [],
            "recent_backgrounds": [],
            "recent_bg_videos": [],
        }
    return load_json(STATE_PATH)


def save_state(state):
    with open(STATE_PATH, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)


def pick_next_quote(state):
    quotes = load_json(QUOTES_PATH)["quotes"]
    posted = set(state.get("posted_quote_ids", []))
    unused = [q for q in quotes if q["id"] not in posted]
    if not unused:
        # Alle Zitate durch - Zyklus neu starten
        state["posted_quote_ids"] = []
        unused = quotes
    quote = random.choice(unused)
    state.setdefault("posted_quote_ids", []).append(quote["id"])
    return quote


def pick_background(state):
    files = sorted(os.listdir(BACKGROUNDS_DIR))
    recent = state.get("recent_backgrounds", [])
    candidates = [f for f in files if f not in recent] or files
    choice = random.choice(candidates)
    recent = (recent + [choice])[-RECENT_BACKGROUND_WINDOW:]
    state["recent_backgrounds"] = recent
    return os.path.join(BACKGROUNDS_DIR, choice)


def pick_next_reel(state):
    reels = load_json(REELS_PATH)
    entries = reels["reels"]
    posted = set(state.get("posted_reel_ids", []))
    unused = [r for r in entries if r["id"] not in posted]
    if not unused:
        state["posted_reel_ids"] = []
        unused = entries
    reel = random.choice(unused)
    state.setdefault("posted_reel_ids", []).append(reel["id"])

    bg_videos = reels["bg_videos"]
    recent = state.get("recent_bg_videos", [])
    candidates = [v for v in bg_videos if v not in recent] or bg_videos
    bg_choice = random.choice(candidates)
    recent = (recent + [bg_choice])[-RECENT_BACKGROUND_WINDOW:]
    state["recent_bg_videos"] = recent

    return reel, os.path.join(BG_VIDEOS_DIR, bg_choice)


def pick_music():
    """Gibt einen zufaelligen Musiktrack aus assets/music zurueck, oder None
    wenn der Ordner (noch) leer ist - dann wird das Reel stumm erstellt."""
    if not os.path.isdir(MUSIC_DIR):
        return None
    supported = (".mp3", ".wav", ".m4a", ".aac")
    files = [f for f in os.listdir(MUSIC_DIR) if f.lower().endswith(supported)]
    if not files:
        return None
    return os.path.join(MUSIC_DIR, random.choice(files))


def build_caption(quote_text, category):
    hashtag_data = load_json(HASHTAGS_PATH)
    category_tags = hashtag_data["by_category"].get(category, [])
    general_tags = hashtag_data["general"]

    chosen_category = random.sample(category_tags, min(3, len(category_tags)))
    chosen_general = random.sample(general_tags, min(4, len(general_tags)))
    tags = chosen_category + chosen_general
    random.shuffle(tags)

    return f"{quote_text}\n\n•\n\n{' '.join(tags)}"

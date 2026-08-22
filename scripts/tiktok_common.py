import json
import os
import random
import time

import requests

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
TIKTOK_TOPICS_PATH = os.path.join(ROOT, "content", "tiktok_topics.json")
TIKTOK_STATE_PATH = os.path.join(ROOT, "tiktok_posted_log.json")
TIKTOK_GENERATED_DIR = os.path.join(ROOT, "assets", "tiktok_generated")

HF_API_BASE = "https://router.huggingface.co/hf-inference/models"
HF_DEFAULT_MODEL = "stabilityai/stable-diffusion-3-medium-diffusers"

STYLE_PREFIX = (
    "Studio Ghibli anime style illustration, hand-painted cel animation look, "
    "soft painterly background, Hayao Miyazaki art style, clean lineart, "
    "highly detailed, vertical portrait composition, cinematic lighting, "
)

HANDLE = "@weirdworld.ai"

# Zufaellige Charaktere fuer fiktive/nicht-reale Personen - JEDES Video bekommt
# eine neu ausgewuerfelte Kombination, damit nie dieselbe Figur wiederkehrt.
_GENDERS = ["female", "male"]
_AGES = ["20-something", "30-something", "45-year-old"]
_ETHNICITIES = [
    "fair-skinned European",
    "East Asian",
    "South Asian",
    "Black African",
    "Latin American",
    "Middle Eastern",
]
_HAIR = [
    "short dark hair",
    "long brown hair tied back",
    "curly black hair",
    "silver-grey hair",
    "red hair in a braid",
    "shaved head",
]
_OUTFITS = [
    "a tan safari shirt with rolled-up sleeves and a leather satchel",
    "a rumpled field jacket with many pockets and dusty boots",
    "a lab coat over a turtleneck sweater, glasses pushed up on the forehead",
    "an explorer's vest with a wide-brimmed hat and a worn journal in hand",
    "a weathered trench coat and fingerless gloves",
]


def random_character_description():
    gender = random.choice(_GENDERS)
    role = random.choice(["archaeologist", "geologist", "historian", "engineer", "researcher"])
    return (
        f"a {random.choice(_AGES)} {random.choice(_ETHNICITIES)} {gender} {role}, "
        f"{random.choice(_HAIR)}, wearing {random.choice(_OUTFITS)}"
    )


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_state():
    if not os.path.exists(TIKTOK_STATE_PATH):
        return {"posted_topic_ids": []}
    return load_json(TIKTOK_STATE_PATH)


def save_state(state):
    with open(TIKTOK_STATE_PATH, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)


def pick_next_topic(state):
    topics = load_json(TIKTOK_TOPICS_PATH)["topics"]
    posted = set(state.get("posted_topic_ids", []))
    unused = [t for t in topics if t["id"] not in posted]
    if not unused:
        # Alle Themen durch - Zyklus neu starten, damit die Automation nie ausgeht.
        state["posted_topic_ids"] = []
        unused = topics
    topic = random.choice(unused)
    state.setdefault("posted_topic_ids", []).append(topic["id"])
    return topic


def build_beats(topic):
    """Baut die Erzaehl-Beats nach der Formel: Hook -> Ort/Jahr -> Fund ->
    Experten-Reaktion -> Vertuschung x2 -> Aufloesung -> Follow-CTA.
    Jeder Beat bekommt einen gesprochenen Text und einen Bild-Prompt.
    real_person (falls gesetzt) wird fuer JEDE Szene dieses Videos verwendet,
    in der eine Person zu sehen ist - alle anderen Themen wuerfeln pro Video
    eine komplett neue, zufaellige Figur aus."""
    if topic.get("real_person"):
        subject = topic["real_person"]["description"]
    else:
        subject = random_character_description()

    beats = [
        {
            "text": topic["hook"],
            "image_prompt": (
                f"{STYLE_PREFIX}{subject}, close-up shot, discovering a mysterious "
                f"glowing artifact, dramatic reveal moment"
            ),
        },
        {
            "text": f"{topic['location']}. {topic['year']}.",
            "image_prompt": (
                f"{STYLE_PREFIX}wide establishing shot of {topic['location']}, "
                f"atmospheric, golden hour lighting, no visible modern text or logos"
            ),
        },
        {
            "text": topic["discovery"],
            "image_prompt": (
                f"{STYLE_PREFIX}{subject}, kneeling and examining an ancient artifact "
                f"in detail, warm lantern light, dramatic shadows"
            ),
        },
        {
            "text": topic["reaction"],
            "image_prompt": (
                f"{STYLE_PREFIX}{subject}, shocked and amazed expression, looking "
                f"directly at the artifact, dramatic close-up"
            ),
        },
        {
            "text": topic["suppression_1"],
            "image_prompt": (
                f"{STYLE_PREFIX}a locked gate or barrier with an official warning sign, "
                f"empty and desolate, harsh shadows, symbolic of restricted access"
            ),
        },
        {
            "text": topic["suppression_2"],
            "image_prompt": (
                f"{STYLE_PREFIX}an old library or archive with stacked documents and "
                f"dim lighting, a sense of forgotten knowledge"
            ),
        },
        {
            "text": topic["payoff"],
            "image_prompt": (
                f"{STYLE_PREFIX}{subject}, standing triumphant beside the fully "
                f"revealed artifact, cinematic wide shot, dramatic lighting"
            ),
        },
        {
            "text": f"Folge {HANDLE} fuer mehr verschwiegene Geschichte.",
            "image_prompt": (
                f"{STYLE_PREFIX}a smartphone screen showing a glowing follow button, "
                f"clean simple background"
            ),
        },
    ]
    return beats


def build_caption(topic):
    tags = list(topic.get("hashtags", []))
    return f"{topic['hook']}\n\n{HANDLE}\n\n{' '.join(tags)}"


def generate_hf_image(prompt, hf_token, model=None, max_retries=4):
    """Ruft die kostenlose Hugging Face Inference API auf und gibt die
    Bild-Bytes zurueck. Retried automatisch, wenn das Modell noch laedt
    (503) oder ein temporaerer Fehler auftritt."""
    model = model or os.environ.get("HF_IMAGE_MODEL", HF_DEFAULT_MODEL)
    url = f"{HF_API_BASE}/{model}"
    headers = {"Authorization": f"Bearer {hf_token}", "Content-Type": "application/json"}
    payload = {"inputs": prompt, "options": {"wait_for_model": True}}

    last_error = None
    for attempt in range(max_retries):
        resp = requests.post(url, headers=headers, json=payload, timeout=120)
        if resp.status_code == 200 and resp.headers.get("content-type", "").startswith("image/"):
            return resp.content
        last_error = f"HTTP {resp.status_code}: {resp.text[:300]}"
        if resp.status_code in (503, 429):
            time.sleep(10 * (attempt + 1))
            continue
        break
    raise RuntimeError(f"HF-Bildgenerierung fehlgeschlagen fuer Modell {model}: {last_error}")

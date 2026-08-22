import json
import os
import random
import time

import requests

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
TIKTOK_TOPICS_PATH = os.path.join(ROOT, "content", "tiktok_topics.json")
TIKTOK_STATE_PATH = os.path.join(ROOT, "tiktok_posted_log.json")
TIKTOK_GENERATED_DIR = os.path.join(ROOT, "assets", "tiktok_generated")

# Higgsfield-API (kostenpflichtig, ~4 Bilder/Video) fuer die Beats, in denen ein
# Charakter ein bestimmtes Artefakt korrekt in der Hand halten muss - das kleine
# kostenlose Modell scheitert zuverlaessig an "Person haelt spezifisches Objekt".
HIGGSFIELD_BASE_URL = "https://platform.higgsfield.ai"
HIGGSFIELD_MODEL_PATH = "higgsfield-ai/soul/standard"

# Reichhaltiger Stil-Prefix fuer Higgsfield (grosses Modell, vertraegt lange Prompts).
STYLE_PREFIX = (
    "Studio Ghibli anime style illustration, hand-painted 2D cel animation look, "
    "soft painterly watercolor background, warm natural color palette, "
    "Hayao Miyazaki art style, clean confident lineart, richly detailed textures, "
    "the entire background fully painted and detailed edge to edge, no blank, "
    "empty or blurred background space, vertical portrait composition, "
    "cinematic lighting, sharp focus, "
)

# Kurzer Stil-Prefix fuer das kostenlose, selbst gehostete SD1.5-Modell
# (Ghibli-Diffusion): das Modell schneidet Prompts nach ca. 77 Tokens hart ab,
# ein zu langer Prompt fuehrt zu unscharfen/verzerrten Ergebnissen.
FREE_STYLE_PREFIX = "ghibli style anime illustration, "

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

    Jeder Beat traegt zwei Bild-Prompts:
    - image_prompt: reichhaltig, fuer Higgsfield (kostenpflichtig, praezise).
    - free_image_prompt: kurz, fuer das kostenlose selbst gehostete Modell.
    "critical"=True markiert Beats, in denen ein Charakter das Artefakt exakt
    in der Hand haelt - dort scheitert das kostenlose Modell zuverlaessig,
    deshalb laufen NUR diese vier Beats ueber Higgsfield; alle anderen (Ort,
    Vertuschung, CTA) sind reine Umgebungs-/Symbolbilder und laufen kostenlos.

    real_person (falls gesetzt) wird fuer JEDE Szene dieses Videos verwendet,
    in der eine Person zu sehen ist - alle anderen Themen wuerfeln pro Video
    eine komplett neue, zufaellige Figur aus."""
    if topic.get("real_person"):
        subject = topic["real_person"]["description"]
    else:
        subject = random_character_description()

    # Konkrete visuelle Beschreibung des Fundstuecks dieses Themas - ohne das
    # wuerde jedes Video nur ein generisches "antikes Artefakt" zeigen, das nie
    # zur eigentlichen Story passt (z.B. nie den tatsaechlichen Sarkophag,
    # nie die tatsaechliche Bronzemaske).
    artifact = topic["artifact"]

    beats = [
        {
            "text": topic["hook"],
            "critical": True,
            "image_prompt": (
                f"{STYLE_PREFIX}{subject}, close-up shot, discovering {artifact}, "
                f"dramatic reveal moment"
            ),
        },
        {
            "text": f"{topic['location']}. {topic['year']}.",
            "critical": False,
            "image_prompt": (
                f"{STYLE_PREFIX}wide establishing shot of {topic['location_detail']}, "
                f"atmospheric, golden hour lighting"
            ),
            "free_image_prompt": (
                f"{FREE_STYLE_PREFIX}wide shot, {topic['location_detail']}"
            ),
        },
        {
            "text": topic["discovery"],
            "critical": True,
            "image_prompt": (
                f"{STYLE_PREFIX}{subject}, kneeling and examining {artifact} in close "
                f"detail, warm lantern light, dramatic shadows"
            ),
        },
        {
            "text": topic["reaction"],
            "critical": True,
            "image_prompt": (
                f"{STYLE_PREFIX}{subject}, shocked and amazed expression, looking "
                f"directly at {artifact}, dramatic close-up"
            ),
        },
        {
            "text": topic["suppression_1"],
            "critical": False,
            "image_prompt": (
                f"{STYLE_PREFIX}a locked gate or barrier with an official warning sign, "
                f"empty and desolate, harsh shadows, symbolic of restricted access"
            ),
            "free_image_prompt": (
                f"{FREE_STYLE_PREFIX}a locked gate with a warning sign, empty desolate "
                f"scene, dramatic shadows"
            ),
        },
        {
            "text": topic["suppression_2"],
            "critical": False,
            "image_prompt": (
                f"{STYLE_PREFIX}an old library or archive with stacked documents and "
                f"dim lighting, a sense of forgotten knowledge"
            ),
            "free_image_prompt": (
                f"{FREE_STYLE_PREFIX}an old library archive with stacked documents, "
                f"dim lighting"
            ),
        },
        {
            "text": topic["payoff"],
            "critical": True,
            "image_prompt": (
                f"{STYLE_PREFIX}{subject}, standing triumphant beside {artifact}, "
                f"fully revealed, cinematic wide shot, dramatic lighting"
            ),
        },
        {
            "text": "Folge für mehr.",
            "critical": False,
            "image_prompt": (
                f"{STYLE_PREFIX}a smartphone screen showing a glowing follow button, "
                f"clean simple background"
            ),
            "free_image_prompt": (
                f"{FREE_STYLE_PREFIX}a smartphone screen showing a glowing follow "
                f"button, clean simple background"
            ),
        },
    ]
    return beats


def build_caption(topic):
    tags = list(topic.get("hashtags", []))
    return f"{topic['hook']}\n\n{HANDLE}\n\n{' '.join(tags)}"


def generate_higgsfield_image(
    prompt, api_key_id, api_key_secret, aspect_ratio="9:16", max_wait_seconds=180
):
    """Generiert ein Bild ueber die Higgsfield-API (kostenpflichtig) und gibt
    die Bild-Bytes zurueck. Reicht den Job ein, pollt bis zu einem
    Endzustand und laedt das Ergebnis herunter."""
    headers = {
        "Authorization": f"Key {api_key_id}:{api_key_secret}",
        "Content-Type": "application/json",
    }
    submit = requests.post(
        f"{HIGGSFIELD_BASE_URL}/{HIGGSFIELD_MODEL_PATH}",
        headers=headers,
        json={"prompt": prompt, "aspect_ratio": aspect_ratio, "resolution": "2K"},
        timeout=60,
    )
    submit.raise_for_status()
    data = submit.json()
    status_url = data["status_url"]

    waited = 0
    poll_interval = 5
    while waited < max_wait_seconds:
        time.sleep(poll_interval)
        waited += poll_interval
        resp = requests.get(status_url, headers=headers, timeout=30)
        resp.raise_for_status()
        result = resp.json()
        status = result["status"]
        if status == "completed":
            image_url = result["images"][0]["url"]
            image_resp = requests.get(image_url, timeout=60)
            image_resp.raise_for_status()
            return image_resp.content
        if status in ("failed", "nsfw", "canceled"):
            raise RuntimeError(f"Higgsfield-Generierung fehlgeschlagen: {result}")
    raise TimeoutError(f"Higgsfield-Generierung nicht abgeschlossen nach {max_wait_seconds}s")

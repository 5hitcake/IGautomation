import json
import os
import random
import time

import requests

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
TIKTOK_TOPICS_PATH = os.path.join(ROOT, "content", "tiktok_topics.json")
TIKTOK_STATE_PATH = os.path.join(ROOT, "tiktok_posted_log.json")
TIKTOK_GENERATED_DIR = os.path.join(ROOT, "assets", "tiktok_generated")
TIKTOK_MUSIC_DIR = os.path.join(ROOT, "assets", "tiktok_music")

# Groesseres Modell ueber die kostenlose Hugging-Face-Inference-API fuer die
# Beats, in denen ein Charakter ein bestimmtes Artefakt korrekt in der Hand
# halten muss. Das kleine selbst gehostete SD1.5-Modell scheitert
# zuverlaessig an "Person haelt spezifisches Objekt". FLUX.1-schnell waere
# architektonisch staerker gewesen, wurde aber vom kostenlosen hf-inference-
# Provider bereits abgekuendigt (410 im Live-Test) - SD3-medium ist laut
# aktueller HF-Doku das einzige noch unterstuetzte Text-zu-Bild-Modell auf
# diesem kostenlosen Provider.
HF_CRITICAL_MODEL_ID = "stabilityai/stable-diffusion-3-medium-diffusers"
# Die alte Domain api-inference.huggingface.co wurde abgeschaltet (DNS-Fehler
# im ersten Live-Test) - HF hat auf einen zentralen "Inference Providers"
# Router umgestellt, ueber den auch der kostenlose hf-inference-Provider laeuft.
HF_INFERENCE_URL = f"https://router.huggingface.co/hf-inference/models/{HF_CRITICAL_MODEL_ID}"

# Reichhaltiger Stil-Prefix fuer FLUX (grosses Modell, vertraegt lange Prompts).
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
    """Baut die Erzaehl-Beats nach der Formel: Hook -> Ort/Jahr -> Suche ->
    Fund -> Experten-Reaktion -> Vertuschung x2 -> Aufloesung -> Follow-CTA.

    Der Suche-Beat (topic["search"]/topic["search_visual"]) baut zusaetzlichen
    Spannungsbogen vor dem eigentlichen Fund auf und sorgt fuer mehr visuelle
    Abwechslung (z.B. Taucher am Schiffswrack statt nur Landschaft+Artefakt).

    Jeder Beat traegt zwei Bild-Prompts:
    - image_prompt: reichhaltig, fuer FLUX.1-schnell (kostenlose HF Inference API).
    - free_image_prompt: kurz, fuer das kostenlose selbst gehostete SD1.5-Modell.
    "critical"=True markiert Beats, in denen ein Charakter das Artefakt exakt
    in der Hand haelt - dort scheitert das kleine selbst gehostete Modell
    zuverlaessig, deshalb laufen NUR diese vier Beats ueber FLUX; alle anderen
    (Ort, Suche, Vertuschung, CTA) sind reine Umgebungs-/Handlungsbilder und
    laufen ueber das selbst gehostete Modell.

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
            "text": topic["search"],
            "critical": False,
            "image_prompt": f"{STYLE_PREFIX}{topic['search_visual']}",
            "free_image_prompt": f"{FREE_STYLE_PREFIX}{topic['search_visual']}",
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


def pick_tiktok_music():
    """Gibt einen zufaelligen Musiktrack aus assets/tiktok_music zurueck, oder
    None wenn der Ordner (noch) leer ist - dann wird das Video ohne
    Hintergrundmusik (nur Erzaehlerstimme) erstellt."""
    if not os.path.isdir(TIKTOK_MUSIC_DIR):
        return None
    supported = (".mp3", ".wav", ".m4a", ".aac")
    files = [f for f in os.listdir(TIKTOK_MUSIC_DIR) if f.lower().endswith(supported)]
    if not files:
        return None
    return os.path.join(TIKTOK_MUSIC_DIR, random.choice(files))


def build_caption(topic):
    tags = list(topic.get("hashtags", []))
    return f"{topic['hook']}\n\n{HANDLE}\n\n{' '.join(tags)}"


def generate_hf_critical_image(prompt, hf_token, width=832, height=1472, max_wait_seconds=300):
    """Generiert ein Bild ueber das aktuell auf dem kostenlosen hf-inference-
    Provider verfuegbare Modell (siehe HF_CRITICAL_MODEL_ID) und gibt die
    Bild-Bytes zurueck. Ist das Modell gerade "am Aufwaermen" (503 mit
    estimated_time), wird automatisch erneut versucht, bis max_wait_seconds
    erreicht ist."""
    headers = {"Authorization": f"Bearer {hf_token}"}
    payload = {
        "inputs": prompt,
        "parameters": {"width": width, "height": height, "num_inference_steps": 28},
    }
    waited = 0
    poll_interval = 10
    while True:
        resp = requests.post(HF_INFERENCE_URL, headers=headers, json=payload, timeout=120)
        if resp.ok and resp.headers.get("content-type", "").startswith("image/"):
            return resp.content
        if resp.status_code == 503 and waited < max_wait_seconds:
            time.sleep(poll_interval)
            waited += poll_interval
            continue
        raise RuntimeError(f"FLUX-Anfrage fehlgeschlagen ({resp.status_code}): {resp.text}")

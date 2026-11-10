"""Generiert ein fotorealistisches Portrait einer Person, die es nicht gibt, fuer
den "These people do not exist"-Instagram-Account und schreibt
assets/people_generated/next_post.json fuer publish.py.

Jede Person wird zufaellig neu zusammengewuerfelt (Herkunft, Alter, Geschlecht,
Aussehen, Ort, Licht, Kamera). Ein kleines Gedaechtnis in people_posted_log.json
verhindert, dass direkt hintereinander aehnliche Personen kommen.

Bilder kommen kostenlos von Pollinations (POLLI_TOKEN) und Cloudflare Workers AI.
Faellt ein Modell aus (z.B. Kontingent leer), wird automatisch das naechste in
MODEL_CHAIN probiert; erst danach ein Reservebild.

Benoetigte Umgebungsvariablen (ausser mit --dry-run):
  CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, optional POLLI_TOKEN

Nutzung:
  python people_generate.py            (echtes Bild ueber Cloudflare)
  python people_generate.py --dry-run  (Platzhalterbild, kein API-Call - fuer CI)
"""
import argparse
import base64
import io
import json
import os
import random
import re
import time
from datetime import datetime, timezone

import requests
from PIL import Image

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
STATE_PATH = os.path.join(ROOT, "people_posted_log.json")
GENERATED_DIR = os.path.join(ROOT, "assets", "people_generated")
GENERATED_REL = "assets/people_generated"
RESERVE_DIR = os.path.join(ROOT, "assets", "people_reserve")

# Instagram-Feed-Hochformat 4:5.
OUTPUT_SIZE = (1080, 1350)
# Generierungsgroesse: Vielfache von 16, gleiches Seitenverhaeltnis wie OUTPUT_SIZE.
GEN_WIDTH, GEN_HEIGHT = 1088, 1360

# Reihenfolge laut Vergleichstests. "@cf/..." laeuft ueber Cloudflare (10.000
# Neurons/Tag gratis, Reset 00:00 UTC), "pollinations:..." ueber gen.pollinations.ai
# (Gratis-Guthaben in "Pollen", reicht nur fuer wenige Bilder -> nur als Ersatz):
#   FLUX-2 Klein 9B  ~1.450 Neurons/Bild, trifft das Alter gut
#   FLUX-2 Klein 4B  ~  250 Neurons/Bild
#   Z-Image Turbo    ~0,004 Pollen/Bild, sehr natuerlich, Alter passt
#   MAI Image 2.6    ~0,034 Pollen/Bild, echteste Details, macht Personen aber aelter
#                    (daher mit AGE_HINT)
#   Lucid Origin     ~4.000+ Neurons/Bild (nur letzte Reserve)
POLLI_PREFIX = "pollinations:"
MODEL_CHAIN = [
    "@cf/black-forest-labs/flux-2-klein-9b",
    "@cf/black-forest-labs/flux-2-klein-4b",
    "pollinations:tongyi-mai/z-image-turbo",
    "pollinations:microsoft/mai-image-2.6",
    "@cf/leonardo/lucid-origin",
]
# Modelle, die Gesichter zu alt darstellen, bekommen den Zusatz vor "photorealistic".
AGE_HINT_MODELS = {"microsoft/mai-image-2.6"}
AGE_HINT = "looks exactly {age} years old, age-accurate face, "
# Pollinations will Seiten als Vielfache von 32 (FLUX) bzw. 16 (MAI).
POLLI_WIDTH, POLLI_HEIGHT = 1088, 1344

# Wie viele der letzten Personen beim Wuerfeln vermieden werden.
AVOID_RECENT = 3
STATE_HISTORY_LIMIT = 60
# Wie viele Bilder im Repo-Arbeitsverzeichnis bleiben (aeltere sind schon
# veroeffentlicht und werden nicht mehr gebraucht).
KEEP_IMAGES = 12

GENDERS = ["woman", "man"]

# Nur Erwachsene - niemals Minderjaehrige.
AGE_RANGES = [(20, 29), (30, 39), (40, 49), (50, 59), (60, 69), (70, 85)]
# Wuerfel-Gewichte: Schwerpunkt auf dem Alter typischer Instagram-Nutzer,
# aeltere Gesichter weiter dabei, aber seltener.
AGE_WEIGHTS = {
    (20, 29): 0.55, (30, 39): 0.28, (40, 49): 0.09, (50, 59): 0.04, (60, 69): 0.025, (70, 85): 0.015,
}

# Weltregionen mit Wuerfel-Gewicht und ihren Herkuenften
# (Beschreibung fuer den Prompt, Namensgruppe). Erst wird die Region gewuerfelt,
# dann die Herkunft darin - sonst dominieren Regionen mit vielen Untergruppen.
# Real (simuliert): Europa/westlich ~45 %, Lateinamerika ~14 %, Afrika ~11 %,
# Ostasien ~10 %, Nahost ~8 %, Suedasien ~7 %, gemischt ~4 %, Indigene ~2 %.
REGIONS = {
    "europe_west": (0.45, [
        ("Northern European", "northern_european"),
        ("Southern European", "southern_european"),
        ("Eastern European", "eastern_european"),
        ("Irish", "irish"),
        ("British", "british"),
        ("German", "german"),
        ("French", "french"),
        ("Dutch", "dutch"),
        ("white American", "white_american"),
        ("white Australian", "white_australian"),
        ("Sámi", "sami"),
    ]),
    "africa": (0.10, [
        ("West African", "west_african"),
        ("East African", "east_african"),
        ("Afro-Caribbean", "caribbean"),
        ("African American", "african_american"),
        ("Malagasy", "malagasy"),
    ]),
    "latin_america": (0.15, [
        ("Latin American", "latin_american"),
        ("Brazilian", "brazilian"),
        ("Mexican", "mexican"),
        ("Indigenous Andean", "andean"),
    ]),
    "east_asia": (0.10, [
        ("East Asian", "east_asian"),
        ("Korean", "korean"),
        ("Japanese", "japanese"),
        ("Southeast Asian", "southeast_asian"),
        ("Filipino", "filipino"),
        ("Mongolian", "mongolian"),
    ]),
    "mena": (0.08, [
        ("Middle Eastern", "middle_eastern"),
        ("North African", "north_african"),
        ("Turkish", "turkish"),
        ("Persian", "persian"),
    ]),
    "south_central_asia": (0.06, [
        ("South Asian", "south_asian"),
        ("Nepali", "nepali"),
        ("Central Asian", "central_asian"),
    ]),
    "indigenous_pacific": (0.02, [
        ("Native American", "native_american"),
        ("Pacific Islander", "pacific_islander"),
        ("Aboriginal Australian", "aboriginal_australian"),
        ("Inuit", "inuit"),
    ]),
    "mixed": (0.04, [
        ("mixed-race", "mixed"),
    ]),
}
HERITAGES = [h for _, hs in REGIONS.values() for h in hs]
REGION_OF = {h[0]: region for region, (_, hs) in REGIONS.items() for h in hs}
AVOID_RECENT_REGIONS = 2  # dieselbe Weltregion fruehestens nach 2 anderen Personen wieder ...
FREQUENT_REGION = "europe_west"  # ... ausser Europa/westlich: darf direkt wieder, max. 2x am Stueck
# Merkmale, die Gesichter aelter wirken lassen - erst ab diesem Alter.
AGING_MIN_AGE = 40
AGING_WORDS = ("laugh lines", "crow's feet", "thinning hair", "sun-weathered", "silver")

FIRST_NAMES = {
    "west_african": (
        ["Ama", "Chiamaka", "Adwoa", "Fatou", "Zainab"],
        ["Kwame", "Chidi", "Kofi", "Babatunde", "Moussa"],
    ),
    "east_african": (
        ["Amani", "Wanjiru", "Selam", "Neema", "Hawi"],
        ["Juma", "Tesfaye", "Baraka", "Kamau", "Dawit"],
    ),
    "caribbean": (
        ["Shanice", "Kezia", "Marisol", "Tamika", "Renée"],
        ["Andre", "Marlon", "Desmond", "Jerome", "Lennox"],
    ),
    "african_american": (
        ["Imani", "Tiana", "Keisha", "Jasmine", "Nia"],
        ["Marcus", "Darnell", "Isaiah", "Terrence", "Malik"],
    ),
    "northern_european": (
        ["Freja", "Astrid", "Ingrid", "Saga", "Hanna"],
        ["Lars", "Erik", "Mikkel", "Johan", "Nils"],
    ),
    "southern_european": (
        ["Giulia", "Lucía", "Inês", "Eleni", "Chiara"],
        ["Marco", "Javier", "Tiago", "Nikos", "Matteo"],
    ),
    "eastern_european": (
        ["Anya", "Katarzyna", "Ilona", "Milena", "Daria"],
        ["Dmitri", "Tomasz", "Bogdan", "Pavel", "Luka"],
    ),
    "irish": (
        ["Aoife", "Niamh", "Siobhan", "Ciara", "Maeve"],
        ["Cian", "Declan", "Oisín", "Ronan", "Eoin"],
    ),
    "east_asian": (
        ["Mei", "Xiu", "Lan", "Ying", "Hui"],
        ["Wei", "Jun", "Hao", "Ming", "Chen"],
    ),
    "korean": (
        ["Ji-woo", "Seo-yeon", "Min-ji", "Ha-eun", "Soo-ah"],
        ["Min-jun", "Ji-ho", "Seung-woo", "Hyun", "Dong-hae"],
    ),
    "japanese": (
        ["Yuki", "Haruka", "Aiko", "Sakura", "Emi"],
        ["Haruto", "Kenji", "Takumi", "Ren", "Daichi"],
    ),
    "southeast_asian": (
        ["Linh", "Siti", "Mai", "Ayu", "Ploy"],
        ["Minh", "Arif", "Somchai", "Budi", "Thanh"],
    ),
    "filipino": (
        ["Maricel", "Joy", "Liza", "Angelica", "Rhea"],
        ["Paolo", "Jomar", "Rafael", "Marlon", "Nico"],
    ),
    "south_asian": (
        ["Priya", "Ananya", "Aisha", "Kavya", "Nisha"],
        ["Arjun", "Rahul", "Imran", "Vikram", "Sanjay"],
    ),
    "middle_eastern": (
        ["Layla", "Noor", "Yasmin", "Rania", "Mariam"],
        ["Omar", "Karim", "Youssef", "Tariq", "Sami"],
    ),
    "north_african": (
        ["Amira", "Salma", "Ines", "Nadia", "Leila"],
        ["Mehdi", "Yassine", "Rachid", "Amine", "Hamza"],
    ),
    "turkish": (
        ["Elif", "Zeynep", "Ayla", "Defne", "Selin"],
        ["Emre", "Burak", "Kerem", "Mehmet", "Can"],
    ),
    "persian": (
        ["Shirin", "Parisa", "Nasrin", "Darya", "Roya"],
        ["Dariush", "Kian", "Arash", "Babak", "Reza"],
    ),
    "central_asian": (
        ["Aigerim", "Madina", "Dilnoza", "Zarina", "Aruzhan"],
        ["Timur", "Nurlan", "Rustam", "Bakhyt", "Azamat"],
    ),
    "latin_american": (
        ["Valentina", "Camila", "Lucía", "Daniela", "Paula"],
        ["Mateo", "Santiago", "Diego", "Andrés", "Tomás"],
    ),
    "brazilian": (
        ["Ana Clara", "Beatriz", "Larissa", "Juliana", "Thaís"],
        ["João", "Rafael", "Thiago", "Gustavo", "Caio"],
    ),
    "mexican": (
        ["Ximena", "Guadalupe", "Itzel", "Fernanda", "Rosa"],
        ["Alejandro", "Emiliano", "Joaquín", "Rodrigo", "Luis"],
    ),
    "andean": (
        ["Killa", "Rosa", "Nayra", "Sisa", "Pacha"],
        ["Inti", "Mayta", "Wayra", "Rumi", "Amaru"],
    ),
    "native_american": (
        ["Winona", "Aiyana", "Tala", "Nizhoni", "Kaya"],
        ["Takoda", "Ahanu", "Koda", "Nashoba", "Elan"],
    ),
    "pacific_islander": (
        ["Leilani", "Moana", "Sina", "Malia", "Kalani"],
        ["Keanu", "Tama", "Sione", "Manu", "Koa"],
    ),
    "aboriginal_australian": (
        ["Kirra", "Alinta", "Marlee", "Lowanna", "Tanami"],
        ["Jirra", "Jarrah", "Kalan", "Yarran", "Mundara"],
    ),
    "mongolian": (
        ["Altantsetseg", "Saruul", "Oyuna", "Enkhjin", "Nomin"],
        ["Bat-Erdene", "Temuulen", "Ganbold", "Bilguun", "Munkh"],
    ),
    "nepali": (
        ["Sita", "Pooja", "Anjali", "Sarita", "Kabita"],
        ["Pemba", "Bikash", "Rajan", "Suman", "Ang Dorje"],
    ),
    "inuit": (
        ["Aputi", "Nuka", "Siqiniq", "Kunik", "Ivalu"],
        ["Aputsiaq", "Inuk", "Malik", "Nanook", "Kunuk"],
    ),
    "british": (
        ["Charlotte", "Emily", "Sophie", "Harriet", "Lucy"],
        ["Oliver", "James", "Harry", "Callum", "George"],
    ),
    "german": (
        ["Lena", "Johanna", "Katrin", "Mareike", "Greta"],
        ["Jonas", "Felix", "Tobias", "Florian", "Matthias"],
    ),
    "french": (
        ["Camille", "Manon", "Élodie", "Chloé", "Margaux"],
        ["Julien", "Théo", "Antoine", "Bastien", "Mathis"],
    ),
    "dutch": (
        ["Sanne", "Femke", "Lotte", "Anouk", "Eva"],
        ["Daan", "Bram", "Joost", "Sem", "Ruben"],
    ),
    "white_american": (
        ["Ashley", "Megan", "Hannah", "Brooke", "Kayla"],
        ["Tyler", "Cody", "Ryan", "Brandon", "Jake"],
    ),
    "white_australian": (
        ["Chloe", "Jess", "Tahlia", "Georgia", "Bec"],
        ["Liam", "Mitch", "Jack", "Brodie", "Lachlan"],
    ),
    "sami": (
        ["Áile", "Sárá", "Elle", "Biret", "Máret"],
        ["Ánte", "Niillas", "Mikkel", "Joret", "Áslak"],
    ),
    "malagasy": (
        ["Hasina", "Voahangy", "Fara", "Tiana", "Miora"],
        ["Rivo", "Haja", "Tojo", "Fidy", "Andry"],
    ),
    "mixed": (
        ["Maya", "Zoe", "Aria", "Naomi", "Luna"],
        ["Kai", "Noah", "Ezra", "Leo", "Jaden"],
    ),
}

HAIR = {
    "woman": [
        "long straight hair", "shoulder-length wavy hair", "tight natural curls", "a short pixie cut",
        "a messy bun", "box braids", "a sleek bob", "long hair in a loose braid", "a buzz cut",
        "a voluminous afro", "hair tucked under a beanie", "bangs and a ponytail",
    ],
    "man": [
        "short cropped hair", "a shaved head", "messy medium-length hair", "tight curls",
        "long hair tied back", "short dreadlocks", "a neat side part", "thinning hair",
        "a high fade", "shoulder-length wavy hair", "hair under a baseball cap", "a man bun",
    ],
}

FACIAL_HAIR = [
    "clean-shaven", "light stubble", "a full beard", "a trimmed moustache", "a short boxed beard",
    "a handlebar moustache", "a long braided beard", "mutton chops", "a goatee",
]

DETAILS = [
    "light freckles", "a slightly crooked nose", "laugh lines",
    "a slightly uneven skin tone", "thick eyebrows",
    "a gap between the front teeth", "rosy cheeks", "slightly sunburned nose", "small hoop earrings",
    "a slightly crooked smile", "dimples", "crow's feet around the eyes",
]

CLOTHING = [
    "a chunky knit sweater", "a denim jacket", "a plain white t-shirt", "a flannel shirt",
    "a rain jacket", "a linen shirt", "a hoodie", "a leather jacket", "a turtleneck",
    "a work uniform", "a wool coat and scarf", "a floral summer dress", "a tank top",
    "a cardigan over a t-shirt", "a puffer jacket", "a simple blouse", "denim overalls over a t-shirt",
    "a studded punk leather jacket", "all-black goth clothing with a lace collar",
    "oversized streetwear and a gold chain",
    "a sharp tailored business suit", "a colorful vintage 70s shirt", "hiking gear", "a chef's white jacket",
    "nurse scrubs", "a high-visibility work vest", "a paint-stained artist's shirt", "a sequined party top",
    "a football jersey", "a bright patterned shirt",
]

WOMENSWEAR = {"dress", "blouse"}
MENSWEAR = [c for c in CLOTHING if not WOMENSWEAR & set(c.split())]

# --- Auffaellige Merkmale ---------------------------------------------------
# Werden unabhaengig von der Herkunft vergeben (keine Klischees). Ein Teil der
# Personen bleibt bewusst unauffaellig, der Rest bekommt 1-2 Merkmale.
# Die meisten Personen wirken alltaeglich. Dezente Merkmale kommen oefter,
# auffaellige nur ab und zu (keine "Freakshow") - und nie zwei auf einmal.
SUBTLE_COUNT_WEIGHTS = {0: 0.55, 1: 0.35, 2: 0.10}
BOLD_CHANCE = 0.15  # ca. jede 7. Person, bei 3 Posts/Tag etwa alle 2 Tage

SUBTLE_HAIR_COLORS = [
    "platinum blonde", "copper red", "bleached blonde with dark roots", "silver", "honey blonde highlights",
]
BOLD_HAIR_COLORS = [
    "bright pink", "electric blue", "pastel lavender", "emerald green", "teal-to-purple ombre",
]

SUBTLE_TRAITS = {
    "tattoo": [
        "a small tattoo on the side of the neck", "a fine-line tattoo behind the ear",
        "a small script tattoo on the collarbone",
    ],
    "piercing": ["several small ear piercings", "a small nose stud"],
    "skin": [
        "very heavy freckles", "striking light-colored eyes", "a strong prominent nose",
        "deep sun-weathered skin",
    ],
    "makeup": ["classic winged eyeliner", "dark red lipstick"],
    "body": ["a plus-size body", "a very slim build", "a muscular build", "a stocky build"],
    "eyewear": ["thick black-rimmed glasses", "round tinted sunglasses", "bright red cat-eye glasses"],
}

BOLD_TRAITS = {
    "tattoo": [
        "colorful sleeve tattoos on both arms", "tattooed knuckles and hands",
        "a tiny star tattoo below one eye", "a large floral tattoo covering the neck",
    ],
    "piercing": ["a septum piercing", "an eyebrow piercing", "a lip ring", "stretched earlobes with plugs"],
    "skin": ["vitiligo patches on the face", "heterochromia, one blue and one brown eye"],
    "makeup": ["glitter makeup on the cheekbones", "bold colorful eyeshadow"],
}

# Kopfbedeckungen mit kulturellem Bezug nur bei passender Herkunft.
HEADWEAR = {
    "a hijab": ("woman", {"middle_eastern", "north_african", "turkish", "persian", "south_asian",
                        "southeast_asian", "west_african", "east_african", "central_asian", "malagasy",
                        "mixed"}),
    "a colorful patterned headwrap": ("woman", {"west_african", "east_african", "caribbean",
                                                "african_american", "malagasy"}),
    "a Sikh turban": ("man", {"south_asian"}),
    "a kufi cap": ("man", {"west_african", "east_african", "north_african", "african_american"}),
}

SETTINGS = [
    "on a busy city street", "in a small neighborhood café", "in a park in autumn", "at a beach at dusk",
    "on a mountain trail", "on a subway platform", "in a home kitchen", "at an outdoor market",
    "on a rainy sidewalk", "in front of a brick wall", "in a library", "at a bus stop",
    "in a sunflower field", "on a rooftop", "at a train station", "in a cozy living room",
    "at a harbor with boats", "in a snowy street", "in a bustling night market", "in a workshop",
]

INDOOR_SETTINGS = {
    "in a small neighborhood café", "on a subway platform", "in a home kitchen", "in a library",
    "in a cozy living room", "in a workshop",
}

OUTDOOR_LIGHTING = [
    "soft golden hour light", "overcast diffused daylight", "warm evening light",
    "neon city lights at night", "bright midday sun with hard shadows", "light rain and moody sky",
    "blue hour twilight",
]

INDOOR_LIGHTING = [
    "soft window light", "warm indoor lamp light", "dim moody ambient light",
    "afternoon sunlight through a window", "cool fluorescent light",
]

CAMERAS = [
    "shot on Fujifilm X-T4, 56mm f/1.2", "shot on Canon EOS R5, 85mm f/1.4",
    "shot on Sony A7 III, 50mm f/1.8", "shot on Kodak Portra 400 film, 35mm",
    "shot on iPhone, candid snapshot", "shot on Leica M6, 35mm, Ilford HP5 black and white film",
]

FRAMING = ["close-up headshot", "head and shoulders portrait", "waist-up portrait", "candid half-body shot"]

EXPRESSIONS = [
    "a warm genuine smile", "a calm neutral expression", "laughing naturally", "a thoughtful look",
    "a slight smirk", "a tired but friendly look", "looking slightly away from the camera",
    "a confident gaze into the camera",
]

PROMPT_TAIL = (
    "photorealistic, real photograph, natural skin texture with visible pores, unretouched, "
    "authentic everyday person, subtle film grain, sharp focus on the eyes, shallow depth of field, "
    "no wounds, no cuts, no scars, no blood, no injuries, no text, no watermark"
)

HOOKS = [
    "This person does not exist.",
    "Say hi to someone who was never born.",
    "Nobody has ever met this person. Nobody ever will.",
    "This face belongs to no one.",
    "Look closely. This person isn't real.",
    "Not a real person. Not a real moment.",
    "Every detail is made up. Every single one.",
]

CTAS = [
    "Know someone who looks just like them? Tag their real-life doppelgänger 👇",
    "Do they look like someone you know? Tag them below 👇",
    "Is this your doppelgänger? Drop a comment 👇",
    "Find their real-life twin. Tag them in the comments 👇",
    "Does this face remind you of someone? Tell us who 👇",
]

DISCLOSURE = "100% AI-generated. Any resemblance to real people is purely coincidental."

HASHTAGS_CORE = ["#thispersondoesnotexist", "#aiportrait", "#aigenerated", "#doppelganger"]
HASHTAGS_POOL = [
    "#aiart", "#portraitphotography", "#aiphotography", "#notreal", "#fakeface", "#generativeai",
    "#portrait", "#lookalike", "#twinstranger", "#digitalhuman", "#faces", "#peopleofinstagram",
    "#streetportrait", "#fluxai", "#artificialintelligence",
]


def load_state(path=None):
    path = path or STATE_PATH
    if not os.path.exists(path):
        return {"count": 0, "recent": []}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_state(state, path=None):
    path = path or STATE_PATH
    with open(path, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)
        f.write("\n")


def _pick_avoiding(rng, options, recent_values):
    candidates = [o for o in options if o not in recent_values] or list(options)
    return rng.choice(candidates)


def roll_persona(state, rng=random):
    """Wuerfelt eine neue Person. Herkunft, Geschlecht+Altersgruppe und Ort der
    letzten AVOID_RECENT Personen werden vermieden; dieselbe Weltregion kommt fruehestens
    nach AVOID_RECENT_REGIONS anderen Personen wieder (Gewichte siehe REGIONS)."""
    recent = state.get("recent", [])[-AVOID_RECENT:]
    last = [REGION_OF.get(r["heritage"][0]) for r in recent[-AVOID_RECENT_REGIONS:]]
    blocked = {r for r in last if r != FREQUENT_REGION}
    if len(last) == AVOID_RECENT_REGIONS and all(r == FREQUENT_REGION for r in last):
        blocked.add(FREQUENT_REGION)
    regions = [r for r in REGIONS if r not in blocked] or list(REGIONS)
    region = rng.choices(regions, [REGIONS[r][0] for r in regions])[0]
    heritage, name_group = _pick_avoiding(rng, REGIONS[region][1], [tuple(r["heritage"]) for r in recent])

    combos = [(g, a) for g in GENDERS for a in AGE_RANGES]
    recent_combos = [(r["gender"], tuple(r["age_range"])) for r in recent[-1:]]
    combos = [c for c in combos if c not in recent_combos] or combos
    gender, age_range = rng.choices(combos, [AGE_WEIGHTS[a] for _, a in combos])[0]
    # Nicht dreimal hintereinander dasselbe Geschlecht.
    if len(recent) >= 2 and all(r["gender"] == gender for r in recent[-2:]):
        gender = "man" if gender == "woman" else "woman"
    age = rng.randint(*age_range)

    setting = _pick_avoiding(rng, SETTINGS, [r["setting"] for r in recent])
    women, men = FIRST_NAMES[name_group]
    persona = {
        "gender": gender,
        "age": age,
        "age_range": list(age_range),
        "heritage": [heritage, name_group],
        "name": rng.choice(women if gender == "woman" else men),
        "hair": rng.choice(_age_ok(HAIR[gender], age)),
        "facial_hair": rng.choice(FACIAL_HAIR) if gender == "man" else None,
        "detail": rng.choice(_age_ok(DETAILS, age)),
        "clothing": rng.choice(CLOTHING if gender == "woman" else MENSWEAR),
        "setting": setting,
        "lighting": rng.choice(INDOOR_LIGHTING if setting in INDOOR_SETTINGS else OUTDOOR_LIGHTING),
        "camera": rng.choice(CAMERAS),
        "framing": rng.choice(FRAMING),
        "expression": rng.choice(EXPRESSIONS),
    }
    if persona["age"] >= 55 and "hair" in persona["hair"] and rng.random() < 0.6:
        persona["hair"] = persona["hair"].replace("hair", "grey hair", 1)
    add_traits(persona, rng)
    return persona


def _age_ok(options, age):
    """Unter AGING_MIN_AGE keine Merkmale, die das Gesicht aelter machen."""
    if age >= AGING_MIN_AGE:
        return list(options)
    return [o for o in options if not any(w in o for w in AGING_WORDS)] or list(options)


def _dye_hair(persona, colors, rng):
    hair = persona["hair"]
    if persona.get("headwear") or "shaved" in hair or "under a" in hair:
        return False
    colors = _age_ok(colors, persona["age"])
    persona["hair"] = f"{hair} dyed {rng.choice(colors)}".replace("grey hair", "hair")
    return True


def add_traits(persona, rng=random):
    """Dezente Merkmale (0-2) und selten ein einzelnes auffaelliges Merkmal."""
    persona["traits"] = []
    persona["bold"] = False
    used = set()

    group = persona["heritage"][1]
    headwear = [h for h, (g, groups) in HEADWEAR.items() if g == persona["gender"] and group in groups]
    counts, weights = zip(*SUBTLE_COUNT_WEIGHTS.items())
    pool = list(SUBTLE_TRAITS) + ["hair_color"] + (["headwear"] if headwear else [])
    for kind in rng.sample(pool, rng.choices(counts, weights)[0]):
        if kind == "headwear":
            persona["hair"] = rng.choice(headwear)
            persona["headwear"] = True
        elif kind == "hair_color":
            if not _dye_hair(persona, SUBTLE_HAIR_COLORS, rng):
                continue
        else:
            persona["traits"].append(rng.choice(_age_ok(SUBTLE_TRAITS[kind], persona["age"])))
        used.add(kind)

    if rng.random() < BOLD_CHANCE:
        options = [k for k in list(BOLD_TRAITS) + ["hair_color"] if k not in used]
        if persona["gender"] == "man" and persona["age"] > 60 and "makeup" in options:
            options.remove("makeup")
        kind = rng.choice(options)
        if kind == "hair_color":
            persona["bold"] = _dye_hair(persona, BOLD_HAIR_COLORS, rng)
        else:
            persona["traits"].append(rng.choice(BOLD_TRAITS[kind]))
            persona["bold"] = True
    return persona


def build_prompt(p):
    looks = p["hair"]
    if p["facial_hair"]:
        looks += f", {p['facial_hair']}"
    for trait in p.get("traits", []):
        looks += f", {trait}"
    article = "an" if str(p["age"]).startswith("8") else "a"
    young = "young " if p["age"] < 30 else ""
    return (
        f"{p['framing'].capitalize()} photo of {article} {p['age']}-year-old "
        f"{young}{p['heritage'][0]} {p['gender']} "
        f"with {looks} and {p['detail']}, wearing {p['clothing']}, {p['expression']}, "
        f"{p['setting']}, {p['lighting']}, {p['camera']}, "
        f"{AGE_HINT.format(age=p['age'])}{PROMPT_TAIL}"
    )


def build_caption(p, number, rng=random):
    tags = HASHTAGS_CORE + rng.sample(HASHTAGS_POOL, 6)
    return (
        f"{rng.choice(HOOKS)}\n\n"
        f"Person No. {number:04d} · \"{p['name']}\", {p['age']}\n\n"
        f"{rng.choice(CTAS)}\n\n"
        f"{DISCLOSURE}\n\n"
        f"{' '.join(tags)}"
    )


def _decode_image(resp):
    if resp.headers.get("content-type", "").startswith("image/"):
        return resp.content
    data = resp.json()
    img = (data.get("result") or {}).get("image")
    if not img:
        raise RuntimeError(f"Cloudflare-Antwort ohne Bild: {str(data)[:300]}")
    return base64.b64decode(img)


def generate_cloudflare(model, prompt, account_id, api_token, retries=3):
    url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/{model}"
    headers = {"Authorization": f"Bearer {api_token}"}
    for attempt in range(retries):
        if "flux-2" in model:
            # FLUX-2 erwartet multipart/form-data statt JSON.
            form = {"prompt": prompt, "width": str(GEN_WIDTH), "height": str(GEN_HEIGHT)}
            files = {k: (None, v) for k, v in form.items()}
            resp = requests.post(url, headers=headers, files=files, timeout=180)
        else:
            payload = {"prompt": prompt, "width": GEN_WIDTH, "height": GEN_HEIGHT}
            resp = requests.post(url, headers=headers, json=payload, timeout=180)
        if resp.ok:
            return _decode_image(resp)
        if resp.status_code in (429, 500, 502, 503, 504) and attempt < retries - 1:
            time.sleep(10 * (attempt + 1))
            continue
        raise RuntimeError(f"HTTP {resp.status_code}: {resp.text[:300]}")
    raise RuntimeError("unerreichbar")


def with_age_hint(prompt):
    """'...a 25-year-old...photorealistic...' -> Alterszusatz vor 'photorealistic'."""
    m = re.search(r"(\d+)-year-old", prompt)
    if not m or "photorealistic" not in prompt or "looks exactly" in prompt:
        return prompt
    return prompt.replace("photorealistic", AGE_HINT.format(age=m.group(1)) + "photorealistic", 1)


def generate_pollinations(model, prompt, token, retries=2):
    if model in AGE_HINT_MODELS:
        prompt = with_age_hint(prompt)
    url = f"https://gen.pollinations.ai/image/{requests.utils.quote(prompt, safe='')}"
    params = {"model": model, "width": POLLI_WIDTH, "height": POLLI_HEIGHT,
              "seed": random.randint(1, 2**31 - 1), "nologo": "true"}
    headers = {"Authorization": f"Bearer {token}"}
    for attempt in range(retries):
        resp = requests.get(url, params=params, headers=headers, timeout=180)
        if resp.ok and resp.headers.get("Content-Type", "").startswith("image/"):
            return resp.content
        if resp.status_code in (429, 500, 502, 503, 504) and attempt < retries - 1:
            time.sleep(15)
            continue
        raise RuntimeError(f"HTTP {resp.status_code}: {resp.text[:300]}")
    raise RuntimeError("unerreichbar")


def generate_image(prompt, account_id, api_token, polli_token=None):
    if polli_token is None:
        polli_token = os.environ.get("POLLI_TOKEN", "").strip()
    errors = []
    cf_exhausted = polli_exhausted = False
    for model in MODEL_CHAIN:
        is_polli = model.startswith(POLLI_PREFIX)
        if (is_polli and (not polli_token or polli_exhausted)) or (not is_polli and cf_exhausted):
            continue
        try:
            if is_polli:
                img = generate_pollinations(model[len(POLLI_PREFIX):], prompt, polli_token)
            else:
                img = generate_cloudflare(model, prompt, account_id, api_token)
            print(f"Bild erzeugt mit {model}")
            return img, model
        except Exception as exc:  # noqa: BLE001 - naechstes Modell probieren
            print(f"{model} fehlgeschlagen: {exc}")
            errors.append(f"{model}: {exc}")
            if "daily free allocation" in str(exc):
                cf_exhausted = True  # Kontingent gilt fuers ganze Cloudflare-Konto
            if is_polli and ("HTTP 401" in str(exc) or "HTTP 402" in str(exc) or "HTTP 403" in str(exc)):
                polli_exhausted = True  # Token ungueltig oder Guthaben leer
    raise RuntimeError("Alle Bildmodelle fehlgeschlagen:\n" + "\n".join(errors))


def placeholder_image():
    img = Image.new("RGB", (GEN_WIDTH, GEN_HEIGHT), (128, 128, 128))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def to_instagram_jpeg(raw_bytes):
    """Auf exakt 4:5 (1080x1350) zuschneiden/skalieren und als JPEG speichern
    (die Graph API nimmt nur JPEG)."""
    img = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
    target_ratio = OUTPUT_SIZE[0] / OUTPUT_SIZE[1]
    w, h = img.size
    if w / h > target_ratio:
        new_w = round(h * target_ratio)
        left = (w - new_w) // 2
        img = img.crop((left, 0, left + new_w, h))
    elif w / h < target_ratio:
        new_h = round(w / target_ratio)
        top = (h - new_h) // 2
        img = img.crop((0, top, w, top + new_h))
    img = img.resize(OUTPUT_SIZE, Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=88, optimize=True, progressive=True)
    return buf.getvalue()


def prune_old_images(directory, keep=None):
    keep = KEEP_IMAGES if keep is None else keep
    for prefix in ("person_", "story_"):
        files = sorted(f for f in os.listdir(directory) if f.startswith(prefix) and f.endswith(".jpg"))
        for old in files[:-keep] if keep else files:
            os.remove(os.path.join(directory, old))


def _credentials():
    account_id = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "").strip()
    api_token = os.environ.get("CLOUDFLARE_API_TOKEN", "").strip()
    if not account_id or not api_token:
        raise SystemExit("CLOUDFLARE_ACCOUNT_ID und CLOUDFLARE_API_TOKEN muessen gesetzt sein.")
    return account_id, api_token


def make_samples(count, dry_run=False):
    out_dir = os.path.join(ROOT, "assets", "people_samples")
    os.makedirs(out_dir, exist_ok=True)
    state = {"recent": []}
    lines = []
    for i in range(1, count + 1):
        persona = roll_persona(state)
        state["recent"].append({k: persona[k] for k in ("gender", "age_range", "heritage", "setting")})
        prompt = build_prompt(persona)
        if dry_run:
            raw, model = placeholder_image(), "dry-run"
        else:
            raw, model = generate_image(prompt, *_credentials())
        name = f"sample_{i:02d}.jpg"
        with open(os.path.join(out_dir, name), "wb") as f:
            f.write(to_instagram_jpeg(raw))
        lines.append(f"## {name} ({model})\n\nPrompt: {prompt}\n\nCaption:\n\n{build_caption(persona, i)}\n")
        print(f"{name}: {model}")
    with open(os.path.join(out_dir, "captions.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


def next_reserve(state, skip=()):
    """Naechstes noch nicht gepostetes Reservebild (oder None)."""
    path = os.path.join(RESERVE_DIR, "reserve.json")
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        images = json.load(f)["images"]
    used = set(state.get("reserve_used", [])) | set(skip)
    for entry in images:
        if entry["id"] not in used and os.path.exists(os.path.join(RESERVE_DIR, entry["file"])):
            return entry
    return None


def create_candidate(state, dry_run=False, skip_reserve=()):
    """Wuerfelt eine Person und erzeugt ihr Bild. Ist das Cloudflare-Kontingent
    leer (oder fallen alle Modelle aus), wird ein Reservebild genommen.
    Aendert noch nichts auf der Platte - erst finalize() speichert alles."""
    persona = roll_persona(state)
    prompt = build_prompt(persona)
    print(f"Prompt: {prompt}")
    number = state.get("count", 0) + 1
    if dry_run:
        raw, model = placeholder_image(), "dry-run"
    else:
        try:
            raw, model = generate_image(prompt, *_credentials())
        except RuntimeError as exc:
            reserve = next_reserve(state, skip_reserve)
            if reserve is None:
                raise RuntimeError(f"{exc}\n\nKeine Reservebilder mehr uebrig.") from exc
            print(f"Generierung fehlgeschlagen - nehme Reservebild {reserve['id']}")
            with open(os.path.join(RESERVE_DIR, reserve["file"]), "rb") as f:
                raw = f.read()
            persona = {k: reserve[k] for k in ("name", "age", "gender", "age_range", "heritage", "setting")}
            return {
                "persona": persona,
                "prompt": f"reserve:{reserve['id']}",
                "model": "reserve",
                "reserve": reserve["id"],
                "number": number,
                "jpeg": to_instagram_jpeg(raw),
                "caption": build_caption(persona, number),
            }
    return {
        "persona": persona,
        "prompt": prompt,
        "model": model,
        "number": number,
        "jpeg": to_instagram_jpeg(raw),
        "caption": build_caption(persona, number),
    }


def finalize(state, candidate):
    """Speichert den freigegebenen Kandidaten als naechsten Post."""
    number = candidate["number"]
    os.makedirs(GENERATED_DIR, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M")
    filename = f"person_{stamp}_{number:04d}.jpg"
    with open(os.path.join(GENERATED_DIR, filename), "wb") as f:
        f.write(candidate["jpeg"])
    prune_old_images(GENERATED_DIR)

    post = {
        "type": "image",
        "file": f"{GENERATED_REL}/{filename}",
        "caption": candidate["caption"],
        "model": candidate["model"],
        "prompt": candidate["prompt"],
        "number": number,
        "name": candidate["persona"]["name"],
        "age": candidate["persona"]["age"],
    }
    with open(os.path.join(GENERATED_DIR, "next_post.json"), "w", encoding="utf-8") as f:
        json.dump(post, f, ensure_ascii=False, indent=2)

    state["count"] = number
    if candidate.get("reserve"):
        state.setdefault("reserve_used", []).append(candidate["reserve"])
    persona = candidate["persona"]
    memory = {k: persona[k] for k in ("gender", "age_range", "heritage", "setting")}
    state.setdefault("recent", []).append(memory)
    state["recent"] = state["recent"][-STATE_HISTORY_LIMIT:]
    save_state(state)
    print(f"Gespeichert: {post['file']}\n\n{post['caption']}")
    return post


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Platzhalterbild statt Cloudflare-Aufruf")
    parser.add_argument(
        "--samples", type=int, default=0,
        help="N Beispielbilder nach assets/people_samples/ erzeugen (aendert weder Zaehler noch Log)",
    )
    args = parser.parse_args()
    if args.samples:
        return make_samples(args.samples, args.dry_run)

    state = load_state()
    candidate = create_candidate(state, dry_run=args.dry_run)
    finalize(state, candidate)


if __name__ == "__main__":
    main()

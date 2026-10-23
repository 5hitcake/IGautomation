"""Engrave each trophy's rune into its painted cup (FLUX.2 Klein image edit on Cloudflare Workers AI).

Input: assets/raw/trophies/cup_<id>_plain.jpg (the blank-plaque cup) and a black rune drawing rendered from the
game's RUNES table (runes/rune_<id>.png); the cursed cup gets a sculpted skull instead (skull.jpg). Needs
CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN. Makes two takes per cup; the better one is copied to cup_<id>.jpg.
"""
import json, base64, subprocess, sys, os
from concurrent.futures import ThreadPoolExecutor
env = {'A': os.environ['CLOUDFLARE_ACCOUNT_ID'], 'T': os.environ['CLOUDFLARE_API_TOKEN']}
R = '/home/user/IGautomation/mjolnir/assets/raw/trophies/'
P = ("Edit image 1: on the smooth round plaque on the front of the trophy cup, engrave the rune symbol shown in image 2 "
     "(exactly this shape, same strokes and proportions, upright, centred on the plaque, filling about half of the plaque). "
     "The rune is deeply chiselled into the metal like a real engraving: V-shaped carved grooves with dark shadowed insides, "
     "bright polished edges catching the light, subtle {inlay} inlay in the grooves, matching the cup's metal, perspective and lighting. "
     "Keep everything else of the cup exactly the same: shape, handles, decorations, colours, white background. No text, no other symbols.")
INLAY = {'ravenbane': 'silver', 'angel': 'dark red', 'stormwalker': 'gold', 'narwhalbane': 'silver', 'wolfbane': 'dark', 'sleipnir': 'dark', 'gemhunter': 'blue', 'wispbane': 'dark'}
SKULL = ("Edit image 1: on the front of the black trophy cup, replace the round plaque with a realistic sculpted human skull relief exactly like image 2, "
         "cast in aged ivory bone and fixed onto the cup, with deep dark eye sockets glowing faint red, real teeth, cracks, strong shading and highlights so it looks three-dimensional and part of the cup. "
         "Keep everything else of the cup exactly the same: shape, chains, decorations, colours, white background. No text.")
def run(job):
    k, v = job
    out = f'carved/{k}_{v}.jpg'
    if os.path.exists(out): return k, v, 'exists'
    r = subprocess.run(['curl', '-sS', f"https://api.cloudflare.com/client/v4/accounts/{env['A']}/ai/run/@cf/black-forest-labs/flux-2-klein-4b",
        '-H', f"Authorization: Bearer {env['T']}", '-F', 'prompt=' + (SKULL if k == 'angel' else P.format(inlay=INLAY.get(k, 'gold')).replace('engrave the rune symbol shown in image 2', 'engrave the rune symbol shown in image 2' + (' (the rune Isa: ONE single straight vertical line, nothing else)' if k == 'draugrbane' else ''))),
        '-F', f'input_image_0=@{R}cup_{k}_plain.jpg', '-F', f'input_image_1=@' + ('skull_2.jpg' if k == 'angel' else f'runes/rune_{k}.png'),
        '-F', 'width=1024', '-F', 'height=1024', '-F', f'seed={(900 + v * 53) if k == "draugrbane" else (500 + v * 37)}'], capture_output=True)
    try:
        d = json.loads(r.stdout); open(out, 'wb').write(base64.b64decode(d['result']['image'])); return k, v, 'ok'
    except Exception:
        return k, v, 'FAIL ' + r.stdout[:200].decode(errors='ignore')
keys = sys.argv[1:]
with ThreadPoolExecutor(4) as ex:
    for r in ex.map(run, [(k, v) for k in keys for v in (1, 2)]): print(*r)

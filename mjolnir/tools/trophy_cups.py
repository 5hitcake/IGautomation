"""Paint the 25 Trophy Hall cups (the animal trophies were later redone as plain lidded cups with one big,
simple animal figure on the lid, so they stay readable at icon size) with FLUX.2 Klein on Cloudflare Workers AI (free daily allowance).

Needs CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (Workers AI) in the environment. Writes
assets/raw/trophies/cup_<id>.jpg (skips existing ones; pass ids to redo only those), then run
tools/build_trophies.py and tools/embed_assets.py.
"""
import json, base64, subprocess, sys, os, pathlib
from concurrent.futures import ThreadPoolExecutor
env = {'A': os.environ['CLOUDFLARE_ACCOUNT_ID'], 'T': os.environ['CLOUDFLARE_API_TOKEN']}
OUT = pathlib.Path(__file__).resolve().parent.parent / 'assets' / 'raw' / 'trophies'
BASE = ("Game UI icon: one single ornate Viking trophy cup centered on a pure plain white background, front view, the whole cup visible. "
        "A hand-painted {metal} chalice on a short stem and round foot, painterly semi-realistic digital painting like a cozy Norse fantasy platformer, "
        "warm soft top-left light, slightly worn metal with knotwork engraving. {theme} "
        "On the front of the cup a large smooth empty round plaque, completely blank. No text, no letters, no symbols on the plaque.")
CUPS = {
 'worthy': ('gold and bronze', 'The two handles are shaped like small Thor hammers Mjolnir with tiny lightning sparks.'),
 'hoarder': ('gold', 'The cup overflows with shiny gold coins spilling over the rim, a small coin pile on the foot.'),
 'gemhunter': ('silver and gold', 'One large wise glowing blue eye gem set above the plaque, small blue gems around the rim.'),
 'untouched': ('pale gold and white', 'A radiant sun halo behind the cup and sprigs of green mistletoe wound around the handles.'),
 'deathless': ('bronze', 'Small round red Viking shields as handles, two crossed axes on the foot.'),
 'sleipnir': ('silver', 'The handles are shaped like galloping grey horses with flowing manes, speed lines.'),
 'stormwalker': ('dark silver', 'A small dark storm cloud above the rim with bright lightning bolts as the handles.'),
 'flawless': ('gold', 'A red squirrel sits on the rim, the handles are carved like branches of the world tree with leaves.'),
 'mead': ('wooden and bronze, shaped like a drinking horn cup', 'Foamy golden ale overflowing the rim.'),
 'bifrost': ('gold', 'A small rainbow bridge arches over the cup like a handle, glowing rainbow colours.'),
 'wolfbane': ('silver and iron', 'The handles are shaped like snarling grey wolf heads, wolf fur trim around the rim.'),
 'draugrbane': ('pale bronze, ghostly', 'The handles are bony skeletal arms, a horned rusty helmet on the rim, faint green mist.'),
 'ravenbane': ('black iron and silver', 'The handles are spread black raven wings, a black raven perched on the rim.'),
 'shepherd': ('bronze', 'The handles are curled ram and goat horns, a tuft of white wool on the foot.'),
 'fafnir': ('gold', 'A small golden dragon coils around the cup, its head on the rim.'),
 'boarbane': ('copper', 'The handles are the heads of wild boars (pigs with long snouts, big curved white tusks and bristly manes), small flames on the rim.'),
 'serpentbane': ('dark bronze', 'A fiery red sea serpent coils around the cup as both handles.'),
 'dwarfbane': ('iron and gold', 'The handles are crossed blacksmith hammers, a small anvil on the foot, a red gnome cap on the rim.'),
 'stagbane': ('gold and wood', 'Large stag antlers grow from the sides as handles, ivy leaves.'),
 'wispbane': ('silver and gold', 'The handles are large spread eagle wings with brown feathers.'),
 'narwhalbane': ('sea-blue silver', 'A narwhal tusk as each handle, waves and sea foam around the foot.'),
 'brisingamen': ('rose gold', 'A precious amber and gold necklace draped around the cup, sparkling gems.'),
 'valhalla': ('gold', 'Two drinking horns as handles, a feast of bread and meat on the foot, a golden shield behind.'),
 'angel': ('black iron', 'Cursed, dark and gloomy: a grinning skull on the rim, cracked metal, dark purple glow, chains.'),
 'allfather': ('radiant gold and silver', 'Two ravens perched on the handles, a glowing aura, Odin\'s spear behind the cup, the most magnificent cup of all.'),
}
def run(item):
    k, (metal, theme) = item
    out = OUT / f'cup_{k}.jpg'
    if os.path.exists(out): return k, 'exists'
    p = BASE.format(metal=metal, theme=theme)
    r = subprocess.run(['curl', '-sS', f"https://api.cloudflare.com/client/v4/accounts/{env['A']}/ai/run/@cf/black-forest-labs/flux-2-klein-4b",
                        '-H', f"Authorization: Bearer {env['T']}", '-F', f'prompt={p}', '-F', 'width=1024', '-F', 'height=1024'], capture_output=True)
    try:
        d = json.loads(r.stdout); open(out, 'wb').write(base64.b64decode(d['result']['image'])); return k, 'ok'
    except Exception as e:
        return k, 'FAIL ' + r.stdout[:200].decode(errors='ignore')
keys = sys.argv[1:] or list(CUPS)
with ThreadPoolExecutor(4) as ex:
    for k, s in ex.map(run, [(k, CUPS[k]) for k in keys]): print(k, s)

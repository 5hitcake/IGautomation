"""Baut reel/assets.js neu aus assets/ und sprites/ (nach neuen/geänderten Bildern ausführen).
Aufruf: python3 tools/make_assets_js.py"""
import base64, io, json, os
from PIL import Image
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = {}
def uri(img, fmt, **kw):
    b = io.BytesIO(); img.save(b, fmt, **kw)
    return f"data:image/{fmt.lower()};base64," + base64.b64encode(b.getvalue()).decode()
for f in sorted(os.listdir(os.path.join(root, 'assets'))):
    name, ext = os.path.splitext(f); p = os.path.join(root, 'assets', f)
    if ext == '.jpg':
        out['bg' if name == 'bg_dschungel' else name] = uri(Image.open(p).convert('RGB'), 'JPEG', quality=82)
    elif ext == '.png':
        im = Image.open(p).convert('RGBA'); im.thumbnail((260, 260)); out[name] = uri(im, 'PNG', optimize=True)
for c in ['rot', 'gruen', 'lila', 'blau']:
    for f in sorted(os.listdir(os.path.join(root, 'sprites', c))):
        pose = os.path.splitext(f)[0].split('_', 3)[-1]
        out[f'{c}_{pose}'] = uri(Image.open(os.path.join(root, 'sprites', c, f)).convert('RGBA'), 'PNG', optimize=True)
open(os.path.join(root, 'reel', 'assets.js'), 'w').write('const ASSETS=' + json.dumps(out) + ';\n')
print(len(out), 'assets ->', 'reel/assets.js')

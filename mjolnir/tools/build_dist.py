"""Build the downloadable / installable versions of the game into mjolnir/dist/.

Usage: python3 mjolnir/tools/build_dist.py

dist/web/                     upload this folder to a web server: the game installs as an app (PWA) on phones and PCs
                              and keeps working offline (index.html, manifest, service worker, icons)
dist/mjolnir-lost.html        one file to download and open by double-click, works offline in any browser
dist/mjolnir-lost-web.zip     the web/ folder zipped, for uploading to a homepage
The Google fonts are embedded, so nothing is loaded from the internet.
"""
import base64
import hashlib
import json
import pathlib
import re
import zipfile

from PIL import Image, ImageDraw, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parent.parent
ASSETS, DIST = ROOT / "assets", ROOT / "dist"
WEB = DIST / "web"


def fonts_inline():
    css = (ASSETS / "fonts" / "fonts.css").read_text()
    def emb(m):
        data = base64.b64encode((ASSETS / "fonts" / m.group(1)).read_bytes()).decode()
        return f"url(data:font/woff2;base64,{data})"
    return re.sub(r"url\(([\w.-]+\.woff2)\)", emb, css)


def icon(size, maskable=False):
    # full-bleed: a dark iron square edge to edge (no transparent corners that launchers fill with white),
    # a blue glow, a gold ring and Mjölnir; the maskable one keeps everything inside the safe zone
    s = size * 4
    im = Image.new("RGBA", (s, s), (13, 16, 22, 255))
    bg = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    ImageDraw.Draw(bg).ellipse([-s * .2, -s * .2, s * 1.2, s * 1.2], fill=(28, 36, 52, 255))
    im.alpha_composite(bg.filter(ImageFilter.GaussianBlur(s * .18)))
    glow = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([s * .2, s * .16, s * .8, s * .76], fill=(110, 170, 255, 120))
    im.alpha_composite(glow.filter(ImageFilter.GaussianBlur(s * .08)))
    d = ImageDraw.Draw(im)
    inset = s * (.12 if maskable else .06)
    d.ellipse([inset, inset, s - inset, s - inset], outline=(224, 169, 59, 255), width=int(s * .035))
    atlas = Image.open(ASSETS / "items.webp").convert("RGBA")
    fx, fy, fw, fh, _ = json.loads((ASSETS / "sprites.json").read_text())["items"]["frames"][0]
    ham = atlas.crop((fx, fy, fx + fw, fy + fh))
    target = s * (.5 if maskable else .6)
    k = target / max(fw, fh)
    ham = ham.resize((int(fw * k), int(fh * k)), Image.LANCZOS).rotate(-18, expand=True, resample=Image.BICUBIC)
    im.alpha_composite(ham, ((s - ham.width) // 2, (s - ham.height) // 2))
    return im.resize((size, size), Image.LANCZOS).convert("RGB")


SW = """// offline support: online the game always loads fresh from the server (so installed apps update by themselves),
// offline it starts from the copy saved on the device
const CACHE = 'mjolnir-%s';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const page = e.request.mode === 'navigate' || /\\/(index\\.html)?$/.test(new URL(e.request.url).pathname);
  if (page) {
    // network first: the newest game when online, the saved one when offline
    e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); }
      return r;
    }).catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request)));
});
"""


def main():
    html = (ROOT / "index.html").read_text()
    fonts = re.search(r'<link rel="preconnect" href="https://fonts.googleapis.com">.*?display=swap">\n', html, re.S)
    assert fonts, "font links not found"
    offline = html.replace(fonts.group(0), "<style>\n" + fonts_inline() + "</style>\n")
    WEB.mkdir(parents=True, exist_ok=True)
    (DIST / "mjolnir-lost.html").write_text(offline)
    head = ('<link rel="manifest" href="manifest.webmanifest">\n<link rel="icon" href="icon-192.png">\n'
            '<link rel="apple-touch-icon" href="apple-touch-icon.png">\n<meta name="apple-mobile-web-app-capable" content="yes">\n'
            '<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n'
            '<meta name="apple-mobile-web-app-title" content="Mjölnir Lost">\n')
    reg = ("<script>if ('serviceWorker' in navigator && location.protocol.startsWith('http')) "
           "addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));</script>\n")
    web = offline.replace("<title>Mjölnir Lost</title>\n", "<title>Mjölnir Lost</title>\n" + head, 1).replace("</body>", reg + "</body>", 1)
    (WEB / "index.html").write_text(web)
    (WEB / "manifest.webmanifest").write_text(json.dumps({
        "name": "Mjölnir Lost", "short_name": "Mjölnir", "description": "A Viking platformer: chase Loki through eleven Norse realms and take Thor's hammer back.",
        "start_url": "./", "scope": "./", "display": "fullscreen", "orientation": "landscape",
        "background_color": "#0d1016", "theme_color": "#0d1016",
        "icons": [{"src": "icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
                  {"src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
                  {"src": "icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}]}, ensure_ascii=False, indent=1))
    icon(192).save(WEB / "icon-192.png")
    icon(512).save(WEB / "icon-512.png")
    icon(512, True).save(WEB / "icon-maskable-512.png")
    icon(180).save(WEB / "apple-touch-icon.png")
    # the cache name changes whenever any file of the app changes, so installed apps pick up new icons too
    h = hashlib.sha1()
    for f in sorted(WEB.iterdir()):
        if f.name != "sw.js":
            h.update(f.read_bytes())
    (WEB / "sw.js").write_text(SW % h.hexdigest()[:10])
    with zipfile.ZipFile(DIST / "mjolnir-lost-web.zip", "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(WEB.iterdir()):
            z.write(f, f"mjolnir-lost/{f.name}")
    for f in sorted(DIST.rglob("*")):
        if f.is_file():
            print(f.relative_to(DIST), f.stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()

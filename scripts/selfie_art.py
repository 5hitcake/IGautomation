"""Personalisiertes Fadenbild aus einem Selfie.

  1. Foto laden (Handy-Drehung beachten), Gesicht finden (OpenCV), quadratischen Ausschnitt um
     Kopf + Bart/Haare legen.
  2. Hintergrund entfernen (rembg, lokal - das Gesicht selbst wird NICHT von einer KI veraendert),
     auf weissen Grund setzen, lokalen Kontrast anheben.
  3. Fadenbild rechnen (string_art.style_portrait, Preset "ultra") und ausgeben:
       <name>.mp4            Reel mit Ton (Tisch, Platte, Naegel, Faden)
       <name>_tisch.jpg      fertiges Bild auf dem Holztisch (quadratisch)
       <name>_platte.png     nur die Holzplatte (rund oder eckig), transparenter Hintergrund

Datenschutz: Eingangsfoto und Ergebnisse werden nur im angegebenen Ordner abgelegt; der Workflow
loescht sie nach dem Versand und speichert nichts im Repo.

Nutzung:
  python scripts/selfie_art.py --photo selfie.jpg --out /tmp/auftrag --shape circle --panel panel_white
"""

import argparse
import json
import os
import sys

import numpy as np
from PIL import Image, ImageOps

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import string_art as sa  # noqa: E402

PANELS = {"weiss": "panel_white", "white": "panel_white",
          "natur": "panel_natural", "natural": "panel_natural"}
SHAPES = {"kreis": "circle", "rund": "circle", "circle": "circle", "quadrat": "square", "eckig": "square",
          "viereck": "square", "square": "square"}


def parse_options(text):
    """'kreis weiss' / 'quadrat natur' -> (shape, panel). Unbekanntes wird ignoriert."""
    shape, panel = "circle", "panel_white"
    for word in (text or "").lower().replace(",", " ").split():
        shape = SHAPES.get(word, shape)
        panel = PANELS.get(word, panel)
    return shape, panel


def find_face(img):
    """Groesstes Gesicht (x, y, w, h) im Bild oder None."""
    import cv2

    g = np.asarray(img.convert("L"))
    scale = 800 / max(g.shape)
    small = cv2.resize(g, None, fx=scale, fy=scale) if scale < 1 else g
    scale = min(scale, 1.0)
    det = cv2.CascadeClassifier(os.path.join(cv2.data.haarcascades, "haarcascade_frontalface_default.xml"))
    faces = det.detectMultiScale(cv2.equalizeHist(small), scaleFactor=1.1, minNeighbors=6, minSize=(60, 60))
    if len(faces) == 0:
        return None
    x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
    return x / scale, y / scale, w / scale, h / scale


CROP_FACTOR = 2.25


def face_weight(size, face_box):
    """Gewichtung im Ausschnitt: Gesicht (Augen, Nase, Mund) wichtiger, Kleidung unten unwichtiger."""
    n = size
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    w = np.ones((n, n), np.float32)
    if face_box is None:
        return w
    fx, fy, fw, fh = face_box
    cx, cy = fx + fw / 2, fy + fh * 0.5
    g = np.exp(-(((xx - cx) / (fw * 0.55)) ** 2 + ((yy - cy) / (fh * 0.6)) ** 2))
    w += 0.45 * g
    chin = fy + fh * 1.35  # unterhalb von Kinn/Bartansatz langsam ausblenden
    fade = np.clip(1 - (yy - chin) / (n * 0.35), 0.35, 1)
    return w * np.where(yy > chin, fade, 1)


def crop_square(img, face):
    W, H = img.size
    if face is None:  # kein Gesicht gefunden: mittiges Quadrat, etwas oberhalb der Mitte
        side = min(W, H)
        cx, cy = W / 2, H * 0.45
    else:
        x, y, w, h = face
        side = min(max(W, H), h * CROP_FACTOR)  # Kopf, Haare und Bart; wenig Kleidung
        cx, cy = x + w / 2, y + h * 0.58
    side = min(side, W, H)
    x0 = int(max(0, min(W - side, cx - side / 2)))
    y0 = int(max(0, min(H - side, cy - side / 2)))
    out = img.crop((x0, y0, x0 + int(side), y0 + int(side)))
    out.info["offset"] = (x0, y0)
    return out


def remove_background(img):
    """Person freistellen und auf Weiss setzen (rembg, laeuft lokal)."""
    from rembg import new_session, remove

    session = new_session("u2net_human_seg")
    cut = remove(img.convert("RGB"), session=session)
    white = Image.new("RGBA", cut.size, (255, 255, 255, 255))
    white.alpha_composite(cut)
    return white.convert("RGB")


def prepare(photo_path, out_path):
    import cv2

    img = ImageOps.exif_transpose(Image.open(photo_path)).convert("RGB")
    face = find_face(img)
    crop = crop_square(img, face)
    box = None
    if face is not None:  # Gesicht in Koordinaten des (auf 1024 skalierten) Ausschnitts
        x0, y0 = crop.info.get("offset", (0, 0))
        k = 1024 / crop.width
        box = ((face[0] - x0) * k, (face[1] - y0) * k, face[2] * k, face[3] * k)
    crop = crop.resize((1024, 1024), Image.LANCZOS)
    try:
        crop = remove_background(crop)
    except Exception as e:  # noqa: BLE001 - ohne Freistellen geht es trotzdem weiter
        print(f"Hintergrund nicht entfernt: {e}")
    g = cv2.cvtColor(np.asarray(crop), cv2.COLOR_RGB2GRAY)
    g = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(g)
    Image.fromarray(g).save(out_path)
    np.save(os.path.splitext(out_path)[0] + "_gewicht.npy", face_weight(1024, box))
    return face is not None


def board_png(spec, panel_name, shape, path):
    """Nur die Holzplatte mit Naegeln und Faden, transparenter Hintergrund."""
    panel = sa.make_panel(panel_name, shape)
    s = panel.width
    out = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    out.alpha_composite(panel)
    off_x, off_y = sa.ART_X - sa.MARGIN, sa.ART_Y - sa.MARGIN
    canvas = sa.ThreadCanvas(spec["colors"], spec["alpha"], spec["width"], (22, 20, 20))

    def to_art(i):
        x, y = spec["nails"][i]
        return ((x - sa.ART_X) * sa.SS, (y - sa.ART_Y) * sa.SS)

    canvas.add([(to_art(a), to_art(b), c) for a, b, c in spec["segs"]])
    out.alpha_composite(canvas.layer(), (sa.MARGIN, sa.MARGIN))
    sprite, (scx, scy) = sa.nail_sprite()
    nails = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    for x, y in spec["nails"]:
        nails.alpha_composite(sprite, (int(round(x - off_x - scx)), int(round(y - off_y - scy))))
    nails.putalpha(Image.fromarray(np.minimum(np.asarray(nails.getchannel("A")),
                                              np.asarray(panel.getchannel("A")))))
    out.alpha_composite(nails)
    out.save(path)


def table_jpg(final_jpg, path):
    img = Image.open(final_jpg)
    s = sa.ART + 2 * sa.MARGIN + 60
    x0, y0 = sa.ART_X + sa.ART // 2 - s // 2, sa.ART_Y + sa.ART // 2 - s // 2
    img.crop((x0, y0, x0 + s, y0 + s)).resize((2048, 2048), Image.LANCZOS).save(path, quality=95)


def make(photo, out, shape="circle", panel="panel_white", name="fadenbild"):
    os.makedirs(out, exist_ok=True)
    template = os.path.join(out, "vorlage.png")
    face_found = prepare(photo, template)
    weight = np.load(os.path.splitext(template)[0] + "_gewicht.npy")
    spec = sa.style_portrait(template, shape=shape, center=(0.5, 0.5), scale=1.0, preset="ultra",
                             bg_penalty=0.08, weight=weight)
    video = sa.render(spec, "dark_walnut", panel, shape, out, name)
    table_jpg(os.path.join(out, f"{name}.jpg"), os.path.join(out, f"{name}_tisch.jpg"))
    board_png(spec, panel, shape, os.path.join(out, f"{name}_platte.png"))
    return {"video": video, "tisch": os.path.join(out, f"{name}_tisch.jpg"),
            "platte": os.path.join(out, f"{name}_platte.png"), "face_found": face_found,
            "nails": len(spec["nails"]), "threads": len(spec["segs"])}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--photo", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--options", default="", help="z.B. 'kreis weiss' oder 'quadrat natur'")
    ap.add_argument("--name", default="fadenbild")
    args = ap.parse_args()
    shape, panel = parse_options(args.options)
    res = make(args.photo, args.out, shape, panel, args.name)
    with open(os.path.join(args.out, "ergebnis.json"), "w") as f:
        json.dump(res, f)
    print({k: v for k, v in res.items() if k in ("face_found", "nails", "threads")})


if __name__ == "__main__":
    main()

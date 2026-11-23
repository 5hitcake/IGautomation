"""Erzeugt das morgendliche Vers-Reel."""
import json

from common import CFG, DATA, claude_json, generate_image, hashtags, load_state, log, out_dir, pick_unused
from render import cover_frame, verse_overlay, verse_video

SYSTEM = """Du gestaltest Inhalte für die deutschsprachige christliche Instagram-Seite "Power of Christ".
Ton: warm, fürsorglich, ermutigend, ehrfürchtig – nie belehrend von oben herab, nie reißerisch.
Antworte ausschließlich mit gültigem JSON."""

PROMPT = """Bibelvers ({ref}, Thema: {theme}{henoch}):
"{text}"

Liefere JSON mit:
- "scene": englische Bildbeschreibung (max. 60 Wörter) einer passenden biblischen Szene oder Allegorie zu diesem Vers,
  konkret mit Figuren, Ort, Licht und Stimmung. Ehrfürchtig, keine Gewalt, kein Text im Bild.
- "caption": deutsche Instagram-Bildunterschrift, 3–5 kurze Zeilen: ein Satz Impuls, was der Vers heute für uns bedeutet,
  ein fürsorglicher Zuspruch, dann eine sanfte Frage oder Einladung zum Kommentieren (z. B. "Schreib ein 🙏, wenn ...").
  Den Vers NICHT erneut zitieren. Höchstens 2 Emojis.
- "hashtags": 5 passende deutsche Hashtags zum Thema (mit #)."""


def make():
    state = load_state()
    verses = json.loads((DATA / "verses.json").read_text(encoding="utf-8"))
    v = pick_unused(verses, state["verses"])
    log("Vers:", v["ref"])
    d = out_dir("vers")
    henoch = ", aus dem äthiopischen Buch Henoch" if v["testament"] == "Henoch" else ""
    try:
        meta = claude_json(SYSTEM, PROMPT.format(ref=v["ref"], theme=v["theme"], text=v["text"], henoch=henoch),
                           check=lambda m: [k for k in ("scene", "caption") if not str(m.get(k, "")).strip()])
    except Exception as e:  # noqa: BLE001
        log("Text-KI nicht verfügbar, nutze Standardtext:", e)
        meta = {"scene": f"a serene biblical landscape at dawn with a lone figure in prayer, theme of {v['theme']}",
                "caption": "Ein Wort für deinen Tag. 🙏\nGott sieht dich und geht mit dir.\nSchreib ein Amen, wenn du das heute brauchst.",
                "hashtags": []}
    bg = generate_image(meta["scene"], d / "hintergrund.jpg", (CFG["images"]["verse_prefix"], CFG["images"]["verse_style"]))
    ov = verse_overlay(v["text"], v["ref"], d / "overlay.png")
    video = verse_video(bg, ov, d / "vers_reel.mp4", CFG["verse_reel"]["seconds"])
    cover_frame(video, 4, d / "cover.jpg")

    src_note = ("\n\n📜 Aus dem Buch Henoch (Teil der äthiopischen Bibel), freie Übertragung."
                if v["testament"] == "Henoch" else "\n\n📖 Übersetzung: Menge-Bibel")
    extra = meta.get("hashtags", []) + (CFG["hashtags"]["henoch"] if v["testament"] == "Henoch" else [])
    caption = f"„{v['text']}“\n– {v['ref']}\n\n{meta['caption'].strip()}{src_note}\n\n{hashtags(extra)}"
    (d / "caption.txt").write_text(caption, encoding="utf-8")
    log("fertig:", video)
    return {"kind": "verse", "id": v["id"], "video": str(video), "caption": caption, "thumb_ms": 4000, "dir": str(d)}


if __name__ == "__main__":
    print(make())

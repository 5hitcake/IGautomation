"""Erzeugt das ~60-Sekunden-Story-Reel am Nachmittag."""
import json
import random

from common import CFG, DATA, claude_json, duration, generate_image, hashtags, load_state, log, out_dir, sh
from render import chunk_cues, cover_frame, ken_burns_clip, story_video, title_overlay, write_ass

SYSTEM = """Du bist Erzähler der deutschsprachigen christlichen Instagram-Seite "Power of Christ".
Du erzählst biblische Geschichten (Altes Testament, Neues Testament und das äthiopische Buch Henoch)
lebendig, bildhaft und ehrfürchtig nach – in eigenen Worten, nah am Text, ohne Dinge zu erfinden,
die der Geschichte widersprechen. Kurze, gut sprechbare Sätze. Antworte ausschließlich mit gültigem JSON."""

PROMPT = """Erzähle die Geschichte "{title}" ({ref}){henoch} als Skript für ein Reel von ca. {secs} Sekunden.
{source}

Regeln:
- Genau {n} Szenen mit je 17–21 Wörtern. Gesamt 140–165 Wörter Erzähltext (= ca. {secs} Sekunden gesprochen).
  Lieber kürzer als länger – wähle nur die wichtigsten Momente.
- Szene 1 ist ein starker Einstieg (Frage oder dramatischer Moment), der zum Weiterschauen fesselt.
- Die letzte Szene endet mit der Botschaft/Lehre der Geschichte für unser Leben heute, warm und ermutigend,
  und nennt am Ende die Stelle zum Nachlesen ("Nachzulesen in {ref_spoken}.").
- Zahlen und Bibelstellen so schreiben, wie man sie spricht (z. B. "Kapitel sechs").
{henoch_rule}
Liefere JSON:
{{
 "scenes": [{{"narration": "deutscher Erzähltext", "image": "englische Bildbeschreibung der Szene, max. 45 Wörter, konkrete Figuren, Ort, Licht, Kleidung der biblischen Zeit, kein Text im Bild"}}],
 "caption": "deutsche Bildunterschrift, 3–5 kurze Zeilen mit Kernaussage und einer Frage an die Community, max. 2 Emojis",
 "hashtags": ["5 passende deutsche Hashtags"]
}}"""

HENOCH_RULE = ("- Diese Geschichte stammt aus dem Buch Henoch. Erwähne in Szene 1 kurz, dass es aus dem alten "
               "Buch Henoch stammt, das in der äthiopischen Kirche zur Bibel gehört. Engel ehrfürchtig, "
               "nicht als Horror darstellen.")


def spoken_ref(ref):
    return ref.replace(",", ", Vers ").replace("-", " bis ").replace(";", " und")


def choose_story(state):
    stories = json.loads((DATA / "stories.json").read_text(encoding="utf-8"))
    rot = CFG["story_reel"]["rotation"]
    want = rot[state.get("story_count", 0) % len(rot)]
    pool = [s for s in stories if s["testament"] == want]
    free = [s for s in pool if s["id"] not in state["stories"]]
    if not free:  # Quelle durch: älteste Hälfte dieser Quelle wieder freigeben
        used_here = [i for i in state["stories"] if i in {s["id"] for s in pool}]
        oldest = set(used_here[: max(1, len(used_here) // 2)])
        free = [s for s in pool if s["id"] in oldest] or pool
    return random.choice(free)


def check_script(sc):
    problems = []
    scenes = sc.get("scenes") or []
    if not 5 <= len(scenes) <= 9:
        problems.append(f"{len(scenes)} Szenen")
    if any(not str(s.get("narration", "")).strip() or not str(s.get("image", "")).strip() for s in scenes):
        problems.append("Szene ohne Text/Bild")
    words = sum(len(str(s.get("narration", "")).split()) for s in scenes)
    if words > 178:
        problems.append(f"zu lang: {words} Wörter statt höchstens 165")
    elif words < 128:
        problems.append(f"zu kurz: {words} Wörter statt ca. 150")
    if not str(sc.get("caption", "")).strip():
        problems.append("keine Caption")
    return problems


def make():
    state = load_state()
    s = choose_story(state)
    log("Geschichte:", s["title"], s["ref"])
    d = out_dir("story")
    is_hen = s["testament"] == "Henoch"
    rc = CFG["story_reel"]
    script = claude_json(SYSTEM, PROMPT.format(
        title=s["title"], ref=s["ref"], secs=rc["target_seconds"], n=rc["scenes"],
        ref_spoken=spoken_ref(s["ref"]),
        henoch=" aus dem äthiopischen Buch Henoch" if is_hen else "",
        henoch_rule=HENOCH_RULE if is_hen else "",
        source=(f"\nBIBELTEXT (Menge 1939) – halte dich bei Personen, Reihenfolge und Ausgang GENAU daran, "
                f"erfinde nichts dazu:\n<<<\n{s['source']}\n>>>\n") if s.get("source") else ""),
        check=check_script)
    scenes = script["scenes"]
    (d / "skript.json").write_text(json.dumps(script, ensure_ascii=False, indent=1), encoding="utf-8")

    # 1) Stimme je Szene, Länge messen
    from common import tts
    seed = random.randint(1, 9_000_000)
    clips, audio_parts, cues, t = [], [], [], 0.0
    pause = 0.35
    for i, sc in enumerate(scenes, 1):
        mp3 = tts(sc["narration"], d / f"sprache_{i}.mp3")
        wav = d / f"sprache_{i}.wav"
        sh(["ffmpeg", "-y", "-loglevel", "error", "-i", str(mp3), "-af", f"apad=pad_dur={pause}",
            "-ar", "44100", "-ac", "2", str(wav)])
        dur = duration(wav)
        cues += chunk_cues(sc["narration"], t, t + dur - pause)
        audio_parts.append(wav)
        # 2) Bild + Kamerafahrt in exakt dieser Länge
        img = generate_image(sc["image"], d / f"bild_{i}.jpg", (CFG["images"]["story_prefix"], CFG["images"]["story_style"]), seed=seed + i)
        clips.append(ken_burns_clip(img, dur, d / f"clip_{i}.mp4", "in" if i % 2 else "out"))
        t += dur
        log(f"Szene {i}/{len(scenes)}: {dur:.1f}s")

    narration = d / "sprache.wav"
    lst = d / "audio.txt"
    lst.write_text("".join(f"file '{p.resolve()}'\n" for p in audio_parts))
    sh(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(lst),
        "-c", "pcm_s16le", str(narration)])
    log(f"Gesamtlänge: {duration(narration):.1f}s")

    title_png = title_overlay(s["title"], s["ref"], d / "titel.png")
    ass = write_ass(cues, d / "untertitel.ass")
    video = story_video(clips, narration, title_png, ass, d / "story_reel.mp4", rc["music_volume"])
    cover_frame(video, 1.0, d / "cover.jpg")
    for p in list(d.glob("clip_*.mp4")) + list(d.glob("sprache_*.*")) + [lst]:
        p.unlink(missing_ok=True)

    note = ("\n\n📜 Aus dem Buch Henoch – in der äthiopisch-orthodoxen Kirche Teil der Bibel."
            if is_hen else "")
    extra = script.get("hashtags", []) + CFG["hashtags"]["story"] + CFG["hashtags"].get(
        "henoch" if is_hen else s["testament"], [])
    caption = (f"{s['title']}\n📖 {s['ref']}\n\n{script['caption'].strip()}{note}\n\n{hashtags(extra)}")
    (d / "caption.txt").write_text(caption, encoding="utf-8")
    log("fertig:", video)
    return {"kind": "story", "id": s["id"], "video": str(video), "caption": caption, "thumb_ms": 1000, "dir": str(d)}


if __name__ == "__main__":
    print(make())

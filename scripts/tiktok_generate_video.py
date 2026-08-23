"""Generiert ein TikTok-Video (1080x1920) im Ghibli/Anime-Stil aus einem Thema
aus content/tiktok_topics.json, im Hybrid-Verfahren:
  1. Fuer die 4 Beats, in denen ein Charakter ein bestimmtes Artefakt in der
     Hand haelt (Hook, Fund, Reaktion, Aufloesung), wird ueber ein groesseres
     Modell auf der kostenlosen Hugging-Face-Inference-API generiert (siehe
     tiktok_common.generate_hf_critical_image) - das kleine selbst gehostete
     Modell scheitert zuverlaessig an "Person haelt spezifisches Objekt".
  2. Fuer die restlichen 5 Beats (Ort, Suche, Vertuschung x2, Follow-CTA -
     reine Umgebungs-/Handlungsbilder ohne kritische Objekt-Interaktion) wird
     ein selbst gehostetes, kostenloses Ghibli-Diffusion-Modell lokal
     ausgefuehrt (laeuft auch ohne GPU, nur langsamer - kein Zeitdruck bei
     dieser Automation).
  3. Pro Beat wird die Sprachzeile ueber edge-tts (kostenlos, kein Key) vertont,
     inklusive Wort-fuer-Wort-Zeitstempeln (WordBoundary-Events).
  4. ffmpeg legt einen sanften Zoom (Ken-Burns-Effekt) auf jedes Standbild und
     blendet die Untertitel Wort fuer Wort synchron zur Sprachausgabe ein.
  5. Alle Segmente werden zu einem Video zusammengefuegt und
     assets/tiktok_generated/next_post.json fuer tiktok_publish.py geschrieben.

Benoetigt ffmpeg und die Python-Pakete edge-tts, torch, diffusers, transformers,
accelerate (siehe requirements.txt). Umgebungsvariable HF_API_TOKEN muss
gesetzt sein (siehe README Setup) - komplett kostenlos, kein Kreditkarten-Zwang.
"""
import asyncio
import io
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile

import edge_tts
import torch
from diffusers import DPMSolverMultistepScheduler, StableDiffusionPipeline
from tiktok_common import (
    ROOT,
    TIKTOK_GENERATED_DIR,
    build_beats,
    build_caption,
    generate_hf_critical_image,
    load_state,
    pick_next_topic,
    pick_tiktok_music,
    save_state,
)

CANVAS_SIZE = (1080, 1920)
ZOOM_SOURCE = (2160, 3840)  # 2x, damit der Zoom nicht pixelig wird
FPS = 30
# Killian, tiefer und langsamer fuer einen dunkleren/mysterioeseren Erzaehlton
# (im Chat gegen Conrad und Florian verglichen und ausgewaehlt).
VOICE = os.environ.get("TIKTOK_TTS_VOICE", "de-DE-KillianNeural")
VOICE_PITCH = os.environ.get("TIKTOK_TTS_PITCH", "-15Hz")
VOICE_RATE = os.environ.get("TIKTOK_TTS_RATE", "-8%")
FONT_PATH = os.path.join(ROOT, "assets", "fonts", "Poppins-Bold.ttf")

# Selbst gehostetes Modell fuer die nicht-kritischen Beats (kostenlos). Diese
# Einstellungen wurden im Chat gegen mehrere Alternativen getestet: DPM-Solver
# statt Standard-Sampler, expliziter Negativ-Prompt und guidance_scale 7.5
# lieferten deutlich sauberere Ergebnisse als die Ausgangswerte.
FREE_MODEL_ID = "nitrosocke/Ghibli-Diffusion"
FREE_MODEL_STEPS = 35
FREE_MODEL_GUIDANCE = 7.5
FREE_MODEL_NEGATIVE_PROMPT = (
    "blurry, deformed, disfigured, bad anatomy, extra limbs, poorly drawn face, "
    "dark, low contrast, watermark, text"
)

# Deutlich gedaempft, damit die Erzaehlerstimme jederzeit klar im Vordergrund
# bleibt - die Musik ist nur ein leises atmosphaerisches Bett darunter, kein
# gleichwertiger zweiter Ton (anders als bei generate_reel.py, wo es keine
# konkurrierende Sprachspur gibt).
MUSIC_VOLUME = 0.15


def check_ffmpeg():
    for binary in ("ffmpeg", "ffprobe"):
        if not shutil.which(binary):
            raise SystemExit(
                f"{binary} wurde nicht gefunden. Auf GitHub Actions wird es im "
                "tiktok_daily.yml Workflow automatisch installiert."
            )


def escape_ffmpeg_path(path):
    # ffmpeg-Filterausdruecke erwarten escapte Doppelpunkte/Backslashes in Pfaden.
    return path.replace("\\", "/").replace(":", "\\:")


def load_free_pipeline():
    pipe = StableDiffusionPipeline.from_pretrained(
        FREE_MODEL_ID, dtype=torch.float32, safety_checker=None
    )
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)
    return pipe.to("cpu")


def generate_free_image(pipe, prompt):
    image = pipe(
        prompt,
        negative_prompt=FREE_MODEL_NEGATIVE_PROMPT,
        num_inference_steps=FREE_MODEL_STEPS,
        guidance_scale=FREE_MODEL_GUIDANCE,
        height=512,
        width=512,
    ).images[0]
    buf = io.BytesIO()
    image.save(buf, format="JPEG")
    return buf.getvalue()


async def synth_speech_with_words(text, output_path):
    """Vertont eine Zeile per edge-tts und gibt zusaetzlich die exakten
    Wort-Zeitstempel zurueck (WordBoundary-Events), fuer Wort-fuer-Wort-Untertitel."""
    communicate = edge_tts.Communicate(
        text, VOICE, pitch=VOICE_PITCH, rate=VOICE_RATE, boundary="WordBoundary"
    )
    words = []
    with open(output_path, "wb") as f:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                start = chunk["offset"] / 10_000_000
                duration = chunk["duration"] / 10_000_000
                words.append({"word": chunk["text"], "start": start, "end": start + duration})
    return words


def ffprobe_duration(path):
    result = subprocess.run(
        [
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", path,
        ],
        check=True, capture_output=True, text=True,
    )
    return float(result.stdout.strip())


def build_word_overlay_filter(words, work_dir, beat_index):
    """Baut eine Kette von drawtext-Filtern, die jeweils genau ein Wort fuer die
    Dauer seines gesprochenen Zeitfensters einblenden (Wort-fuer-Wort-Untertitel)."""
    escaped_font = escape_ffmpeg_path(FONT_PATH)
    label = "vz"
    parts = []
    for i, w in enumerate(words):
        word_path = os.path.join(work_dir, f"beat{beat_index:02d}_word{i:03d}.txt")
        with open(word_path, "w", encoding="utf-8") as f:
            f.write(w["word"])
        escaped_word_path = escape_ffmpeg_path(word_path)
        next_label = f"v{beat_index}_{i}"
        parts.append(
            f"[{label}]drawtext=fontfile='{escaped_font}':textfile='{escaped_word_path}':"
            f"fontcolor=white:fontsize=80:box=1:boxcolor=black@0.55:boxborderw=26:"
            f"x=(w-text_w)/2:y=h-420:enable='between(t,{w['start']:.3f},{w['end']:.3f})'"
            f"[{next_label}]"
        )
        label = next_label
    return ";".join(parts), label


def build_segment(image_path, audio_path, words, output_path, work_dir, beat_index):
    duration = ffprobe_duration(audio_path)
    w, h = CANVAS_SIZE
    zw, zh = ZOOM_SOURCE
    frames = max(1, math.ceil(duration * FPS))

    zoom_filter = (
        f"[0:v]scale={zw}:{zh}:force_original_aspect_ratio=increase,"
        f"crop={zw}:{zh},"
        f"zoompan=z='min(zoom+0.0015,1.15)':d={frames}:s={w}x{h}:fps={FPS}[vz]"
    )

    if words:
        word_filter, final_label = build_word_overlay_filter(words, work_dir, beat_index)
        filter_complex = f"{zoom_filter};{word_filter}"
    else:
        filter_complex = zoom_filter
        final_label = "vz"

    cmd = [
        "ffmpeg", "-y",
        "-loop", "1", "-i", image_path,
        "-i", audio_path,
        "-filter_complex", filter_complex,
        "-map", f"[{final_label}]", "-map", "1:a",
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-t", str(duration),
        "-c:a", "aac",
        "-shortest",
        output_path,
    ]
    subprocess.run(cmd, check=True)


def concat_segments(segment_paths, output_path, work_dir):
    list_path = os.path.join(work_dir, "concat_list.txt")
    with open(list_path, "w", encoding="utf-8") as f:
        for path in segment_paths:
            f.write(f"file '{os.path.abspath(path)}'\n")
    cmd = [
        "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", list_path,
        "-c", "copy", output_path,
    ]
    subprocess.run(cmd, check=True)


def mix_background_music(video_path, music_path, output_path, volume=MUSIC_VOLUME):
    """Mischt einen (in einer Schleife laufenden) Musiktrack leise unter die
    vorhandene Erzaehlerstimme des Videos. normalize=0 verhindert, dass amix
    automatisch beide Spuren gleich laut absenkt - die Lautstaerke-Balance
    wird stattdessen komplett ueber `volume` auf der Musikspur gesteuert, die
    Erzaehlerstimme bleibt unangetastet. duration=first schneidet die
    Musikschleife exakt auf die Laenge der Erzaehlung zu."""
    cmd = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-stream_loop", "-1", "-i", music_path,
        "-filter_complex",
        f"[1:a]volume={volume}[music];"
        f"[0:a][music]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[a]",
        "-map", "0:v", "-map", "[a]",
        "-c:v", "copy", "-c:a", "aac",
        "-shortest",
        output_path,
    ]
    subprocess.run(cmd, check=True)


def main():
    check_ffmpeg()
    hf_token = os.environ.get("HF_API_TOKEN")
    if not hf_token:
        print("HF_API_TOKEN ist nicht gesetzt (siehe README Setup).")
        sys.exit(1)

    os.makedirs(TIKTOK_GENERATED_DIR, exist_ok=True)
    state = load_state()
    topic = pick_next_topic(state)
    beats = build_beats(topic)

    print("Lade selbst gehostetes Modell fuer die nicht-kritischen Beats...")
    free_pipe = load_free_pipeline()

    with tempfile.TemporaryDirectory() as work_dir:
        segment_paths = []
        for i, beat in enumerate(beats):
            print(f"Beat {i + 1}/{len(beats)} ({'HF-kritisch' if beat['critical'] else 'kostenlos'}): "
                  f"{beat['text'][:60]}...")

            image_path = os.path.join(work_dir, f"beat_{i:02d}.jpg")
            if beat["critical"]:
                image_bytes = generate_hf_critical_image(beat["image_prompt"], hf_token)
            else:
                image_bytes = generate_free_image(free_pipe, beat["free_image_prompt"])
            with open(image_path, "wb") as f:
                f.write(image_bytes)

            audio_path = os.path.join(work_dir, f"beat_{i:02d}.mp3")
            words = asyncio.run(synth_speech_with_words(beat["text"], audio_path))

            segment_path = os.path.join(work_dir, f"segment_{i:02d}.mp4")
            build_segment(image_path, audio_path, words, segment_path, work_dir, i)
            segment_paths.append(segment_path)

        concat_path = os.path.join(work_dir, "concat.mp4")
        concat_segments(segment_paths, concat_path, work_dir)

        filename = f"tiktok_{topic['id']:04d}.mp4"
        output_path = os.path.join(TIKTOK_GENERATED_DIR, filename)
        music_path = pick_tiktok_music()
        if music_path:
            print(f"Mische Hintergrundmusik ein: {os.path.basename(music_path)}")
            mix_background_music(concat_path, music_path, output_path)
        else:
            shutil.copy(concat_path, output_path)

    caption = build_caption(topic)
    next_post = {
        # "reel" (nicht "video") ist bewusst gewaehlt: scripts/publish.py
        # (Instagram) erwartet genau diesen Wert fuer media_type=REELS, wenn
        # dasselbe next_post.json auch auf einen zweiten Instagram-Account
        # gepostet wird. tiktok_publish.py selbst liest "type" gar nicht.
        "type": "reel",
        "file": os.path.relpath(output_path, ROOT).replace("\\", "/"),
        "caption": caption,
    }
    with open(os.path.join(TIKTOK_GENERATED_DIR, "next_post.json"), "w", encoding="utf-8") as f:
        json.dump(next_post, f, ensure_ascii=False, indent=2)

    save_state(state)
    print(f"Erstellt: {output_path}")
    print(caption)


if __name__ == "__main__":
    main()

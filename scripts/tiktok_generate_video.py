"""Generiert ein TikTok-Video (1080x1920) im Ghibli/Anime-Stil aus einem Thema
aus content/tiktok_topics.json:
  1. Pro Erzaehl-Beat wird ueber die kostenlose Hugging Face Inference API ein
     Standbild generiert (siehe tiktok_common.generate_hf_image).
  2. Pro Beat wird die Sprachzeile ueber edge-tts (kostenlos, kein Key) vertont,
     inklusive Wort-fuer-Wort-Zeitstempeln (WordBoundary-Events).
  3. ffmpeg legt einen sanften Zoom (Ken-Burns-Effekt) auf jedes Standbild und
     blendet die Untertitel Wort fuer Wort synchron zur Sprachausgabe ein.
  4. Alle Segmente werden zu einem Video zusammengefuegt und
     assets/tiktok_generated/next_post.json fuer tiktok_publish.py geschrieben.

Benoetigt ffmpeg und den Python-Paket edge-tts (siehe requirements.txt).
Umgebungsvariable HF_API_TOKEN muss gesetzt sein (kostenloser Hugging-Face-Account,
siehe README).
"""
import asyncio
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile

import edge_tts
from tiktok_common import (
    ROOT,
    TIKTOK_GENERATED_DIR,
    build_beats,
    build_caption,
    generate_hf_image,
    load_state,
    pick_next_topic,
    save_state,
)

CANVAS_SIZE = (1080, 1920)
ZOOM_SOURCE = (2160, 3840)  # 2x, damit der Zoom nicht pixelig wird
FPS = 30
VOICE = os.environ.get("TIKTOK_TTS_VOICE", "de-DE-ConradNeural")
FONT_PATH = os.path.join(ROOT, "assets", "fonts", "Poppins-Bold.ttf")


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


async def synth_speech_with_words(text, output_path):
    """Vertont eine Zeile per edge-tts und gibt zusaetzlich die exakten
    Wort-Zeitstempel zurueck (WordBoundary-Events), fuer Wort-fuer-Wort-Untertitel."""
    communicate = edge_tts.Communicate(text, VOICE, boundary="WordBoundary")
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

    with tempfile.TemporaryDirectory() as work_dir:
        segment_paths = []
        for i, beat in enumerate(beats):
            print(f"Beat {i + 1}/{len(beats)}: {beat['text'][:60]}...")

            image_path = os.path.join(work_dir, f"beat_{i:02d}.jpg")
            image_bytes = generate_hf_image(beat["image_prompt"], hf_token)
            with open(image_path, "wb") as f:
                f.write(image_bytes)

            audio_path = os.path.join(work_dir, f"beat_{i:02d}.mp3")
            words = asyncio.run(synth_speech_with_words(beat["text"], audio_path))

            segment_path = os.path.join(work_dir, f"segment_{i:02d}.mp4")
            build_segment(image_path, audio_path, words, segment_path, work_dir, i)
            segment_paths.append(segment_path)

        filename = f"tiktok_{topic['id']:04d}.mp4"
        output_path = os.path.join(TIKTOK_GENERATED_DIR, filename)
        concat_segments(segment_paths, output_path, work_dir)

    caption = build_caption(topic)
    next_post = {
        "type": "video",
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

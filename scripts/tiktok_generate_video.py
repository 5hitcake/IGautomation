"""Generiert ein TikTok-Video (1080x1920) im Ghibli/Anime-Stil aus einem Thema
aus content/tiktok_topics.json:
  1. Pro Erzaehl-Beat wird ueber die kostenlose Hugging Face Inference API ein
     Standbild generiert (siehe tiktok_common.generate_hf_image).
  2. Pro Beat wird die Sprachzeile ueber edge-tts (kostenlos, kein Key) vertont.
  3. ffmpeg legt einen sanften Zoom/Pan (Ken-Burns-Effekt) auf jedes Standbild,
     synchron zur jeweiligen Sprachzeile, und brennt den Text als Untertitel ein.
  4. Alle Segmente werden zu einem Video zusammengefuegt und
     assets/tiktok_generated/next_post.json fuer tiktok_publish.py geschrieben.

Benoetigt ffmpeg und den Python-Paket edge-tts (siehe requirements.txt).
Umgebungsvariable HF_API_TOKEN muss gesetzt sein (kostenloser Hugging-Face-Account,
siehe README).
"""
import asyncio
import json
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


def wrap_text(text, max_chars_per_line=28):
    words = text.split()
    lines, current = [], ""
    for word in words:
        trial = f"{current} {word}".strip()
        if len(trial) <= max_chars_per_line:
            current = trial
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return "\n".join(lines)


async def synth_speech(text, output_path):
    communicate = edge_tts.Communicate(text, VOICE)
    await communicate.save(output_path)


def ffprobe_duration(path):
    result = subprocess.run(
        [
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", path,
        ],
        check=True, capture_output=True, text=True,
    )
    return float(result.stdout.strip())


def build_segment(image_path, audio_path, text, output_path):
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".txt", delete=False, encoding="utf-8"
    ) as tf:
        tf.write(wrap_text(text))
        caption_path = tf.name

    try:
        duration = ffprobe_duration(audio_path)
        w, h = CANVAS_SIZE
        zw, zh = ZOOM_SOURCE
        # ffmpeg drawtext erwartet in Filterausdruecken escapte Doppelpunkte/Backslashes
        escaped_caption_path = caption_path.replace("\\", "/").replace(":", "\\:")
        escaped_font_path = FONT_PATH.replace("\\", "/").replace(":", "\\:")
        filter_complex = (
            f"[0:v]scale={zw}:{zh}:force_original_aspect_ratio=increase,"
            f"crop={zw}:{zh},"
            f"zoompan=z='min(zoom+0.0015,1.15)':d=1:s={w}x{h}:fps={FPS},"
            f"drawtext=fontfile='{escaped_font_path}':textfile='{escaped_caption_path}':"
            f"fontcolor=white:fontsize=58:line_spacing=12:box=1:boxcolor=black@0.55:"
            f"boxborderw=24:x=(w-text_w)/2:y=h-420[v]"
        )
        cmd = [
            "ffmpeg", "-y",
            "-loop", "1", "-i", image_path,
            "-i", audio_path,
            "-filter_complex", filter_complex,
            "-map", "[v]", "-map", "1:a",
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            "-t", str(duration),
            "-c:a", "aac",
            "-shortest",
            output_path,
        ]
        subprocess.run(cmd, check=True)
    finally:
        os.unlink(caption_path)


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
            asyncio.run(synth_speech(beat["text"], audio_path))

            segment_path = os.path.join(work_dir, f"segment_{i:02d}.mp4")
            build_segment(image_path, audio_path, beat["text"], segment_path)
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

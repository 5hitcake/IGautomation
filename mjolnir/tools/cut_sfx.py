"""Cut the animal calls (assets/raw/sfx/, public-domain / CC field recordings from Wikimedia Commons) into short clips.

Each clip: a stretch of the recording, fades at both ends, normalised, mono 64 kbit/s -> assets/sounds/<name>.mp3,
which tools/embed_assets.py embeds next to the cat sounds. Sources and licences are listed in the README.
Usage: python3 mjolnir/tools/cut_sfx.py
"""
import pathlib
import subprocess

import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / 'assets' / 'raw' / 'sfx'
OUT = ROOT / 'assets' / 'sounds'
SR = 44100
# name: (source, start s, end s, fade in s, fade out s, peak)
CLIPS = {
    'sheep_baa': ('Sheep_bleating.ogg', 5.30, 6.35, .02, .25, .9),   # short: the game plays it pitched up like a lamb
    'wolf_howl': ('Wolf_howls.ogg', 0.0, 2.6, .25, .9, .8),
    'raven_caw': ('Yellowstone_sound_library_-_Common_Raven_-_001.mp3', 7.33, 8.20, .01, .08, .9),
}


def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()


for name, (src, t0, t1, fi, fo, peak) in CLIPS.items():
    if not (RAW / src).exists():
        print(f'{name}: {src} missing, skipped'); continue
    a = load(RAW / src)[int(t0 * SR):int(t1 * SR)]
    a -= a.mean()
    n_in, n_out = max(1, int(fi * SR)), max(1, int(fo * SR))
    a[:n_in] *= np.linspace(0, 1, n_in); a[-n_out:] *= np.linspace(1, 0, n_out) ** 1.5
    a *= peak / max(1e-6, np.abs(a).max())
    dst = OUT / f'{name}.mp3'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-b:a', '64k', str(dst)],
                   input=a.astype(np.float32).tobytes(), check=True)
    print(f'{name}: {len(a) / SR:.2f}s, {dst.stat().st_size // 1024} KB')

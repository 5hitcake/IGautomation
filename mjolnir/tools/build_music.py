"""Cut the recorded soundtrack (assets/raw/music/*.mp3) into seamless loops for the game.

Each track takes a stretch of whole bars from its full-energy middle (after any intro, before the fade-out),
and its last LOOP_XF seconds are crossfaded (equal power) into its first, so the loop runs without a seam.
Writes assets/sounds/music_<name>.mp3 (stereo, 80 kbit/s) and assets/sounds/music.json with each loop's
length in seconds; tools/embed_assets.py then embeds both into index.html.
Usage: python3 mjolnir/tools/build_music.py
"""
import json
import pathlib
import subprocess

import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / 'assets' / 'raw' / 'music'
OUT = ROOT / 'assets' / 'sounds'
SR = 44100
LOOP_XF = 1.5
# name: (source, start s, bpm, bars, beats per bar)
TRACKS = {
    'hero': ('heldenthema_b.mp3', 4.0, 103, 28, 4),
    'adventure': ('abenteuer.mp3', 60.0, 144, 42, 4),
    'cold': ('kaelte_und_tod.mp3', 6.5, 99, 25, 4),
    'fire': ('feuer_und_sturm.mp3', 2.0, 112, 30, 4),
    'rainbow': ('regenbogen_bier.mp3', 13.0, 152, 7, 4),
}


def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).copy()


meta = {}
for name, (src, start, bpm, bars, bpb) in TRACKS.items():
    a = load(RAW / src)
    L = int(round(bars * bpb * 60 / bpm * SR))
    xf = int((LOOP_XF if name != 'rainbow' else .5) * SR)
    s0 = int(start * SR)
    seg = a[s0:s0 + L + xf]
    assert len(seg) == L + xf, f'{name}: source too short'
    out = seg[:L].copy()
    t = np.linspace(0, np.pi / 2, xf)[:, None]
    out[:xf] = seg[:xf] * np.sin(t) + seg[L:L + xf] * np.cos(t)
    out *= .92 / max(1e-6, np.abs(out).max())
    dst = OUT / f'music_{name}.mp3'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-',
                    '-b:a', '80k', '-ar', str(SR), str(dst)], input=out.astype(np.float32).tobytes(), check=True)
    meta[name] = round(L / SR, 5)
    print(f'{name}: {L / SR:.1f}s loop, {dst.stat().st_size // 1024} KB')
(OUT / 'music.json').write_text(json.dumps(meta))

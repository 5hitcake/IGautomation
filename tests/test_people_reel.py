import json
import random
import shutil

import people_generate as pg
import people_reel as pr
import pytest
from PIL import Image


def test_frames_have_reel_size_at_every_phase():
    base = pr.cover_base(Image.new("RGB", pg.OUTPUT_SIZE, (120, 90, 70)))
    rng = random.Random(1)
    for t in (0.0, 1.0, 2.5, 4.05, 5.0, 6.3, 8.5):
        frame = pr.render_frame(base, t, 12, "Salma", 27, rng)
        assert frame.size == (pr.W, pr.H) and frame.mode == "RGB"


@pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg fehlt")
def test_main_renders_reel_and_switches_post(tmp_path, monkeypatch):
    gen = tmp_path / "assets" / "people_generated"
    gen.mkdir(parents=True)
    Image.new("RGB", pg.OUTPUT_SIZE).save(gen / "person_20261104_1113_0012.jpg")
    post_file = gen / "next_post.json"
    post_file.write_text(
        json.dumps(
            {
                "type": "image",
                "file": "assets/people_generated/person_20261104_1113_0012.jpg",
                "caption": "x",
                "number": 12,
                "name": "Salma",
                "age": 27,
            }
        )
    )
    monkeypatch.setattr(pr, "ROOT", str(tmp_path))
    monkeypatch.setattr(pr, "GENERATED_DIR", str(gen))
    monkeypatch.setattr(pr, "MUSIC_DIR", str(tmp_path / "no_music"))
    monkeypatch.setattr(pr, "DURATION", 0.5)
    monkeypatch.setattr("sys.argv", ["people_reel.py", "--post-file", str(post_file)])
    pr.main()
    post = json.loads(post_file.read_text())
    assert post["type"] == "reel" and post["branch"] == pr.MEDIA_BRANCH
    assert post["file"] == "reel_20261104_1113_0012.mp4"
    assert post["image"] == "assets/people_generated/person_20261104_1113_0012.jpg"
    assert (gen / post["file"]).stat().st_size > 1000

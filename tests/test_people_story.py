import json

import people_generate as pg
import people_story as ps
from PIL import Image


def test_story_format():
    img = ps.build_story(Image.new("RGB", pg.OUTPUT_SIZE, (90, 60, 40)), 12, "Salma", 27)
    assert img.size == (1080, 1920) and img.mode == "RGB"


def test_main_writes_story_post(tmp_path, monkeypatch):
    gen = tmp_path / "assets" / "people_generated"
    gen.mkdir(parents=True)
    Image.new("RGB", pg.OUTPUT_SIZE).save(gen / "person_20261104_1113_0012.jpg")
    (gen / "next_post.json").write_text(
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
    monkeypatch.setattr(ps, "ROOT", str(tmp_path))
    monkeypatch.setattr(ps, "GENERATED_DIR", str(gen))
    ps.main()
    story = json.loads((gen / "next_story.json").read_text())
    assert story == {"type": "story", "file": "assets/people_generated/story_20261104_1113_0012.jpg"}
    out = Image.open(gen / "story_20261104_1113_0012.jpg")
    assert out.size == (1080, 1920) and out.format == "JPEG"

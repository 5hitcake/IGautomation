"""Selfie-Fadenbild: Optionen, Bildausschnitt und Webhook-Geheimnis (Worker <-> Workflow)."""
import hashlib
import os
import re
import shutil
import subprocess

import pytest
import selfie_art as sa
from PIL import Image

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))


@pytest.mark.parametrize("text,expected", [
    ("", ("circle", "panel_white")),
    ("Quadrat Natur", ("square", "panel_natural")),
    ("kreis, natur", ("circle", "panel_natural")),
    ("eckig weiss bitte", ("square", "panel_white")),
])
def test_parse_options(text, expected):
    assert sa.parse_options(text) == expected


def test_crop_square_keeps_face_and_beard_inside():
    img = Image.new("RGB", (2000, 3000))
    face = (700, 800, 600, 600)
    crop = sa.crop_square(img, face)
    assert crop.width == crop.height
    assert crop.width >= 600 * 2.5 or crop.width == 2000


def test_crop_square_without_face_is_centered_square():
    crop = sa.crop_square(Image.new("RGB", (1200, 1600)), None)
    assert crop.size == (1200, 1200)


def test_worker_secret_matches_deploy_workflow():
    """Worker (JS) und setWebhook (Shell) muessen dasselbe Geheimnis ableiten."""
    with open(os.path.join(ROOT, ".github", "workflows", "selfie_bot_deploy.yml"), encoding="utf-8") as f:
        assert "printf 'selfie-bot:%s'" in f.read()
    with open(os.path.join(ROOT, "cloudflare", "selfie_bot", "src", "index.js"), encoding="utf-8") as f:
        js = f.read()
    assert "`selfie-bot:${token}`" in js and ".slice(0, 48)" in js
    if not shutil.which("node"):
        pytest.skip("node fehlt")
    out = subprocess.run(
        ["node", "--input-type=module", "-e",
         "import('./cloudflare/selfie_bot/src/index.js')"
         ".then(async m => console.log(await m.webhookSecret('abc')))"],
        cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
    assert out == hashlib.sha256(b"selfie-bot:abc").hexdigest()[:48]


def test_workflow_never_uploads_or_commits_photos():
    with open(os.path.join(ROOT, ".github", "workflows", "selfie_art.yml"), encoding="utf-8") as f:
        wf = f.read()
    assert "upload-artifact" not in wf and "git push" not in wf and "git commit" not in wf
    assert re.search(r"if: always\(\)\s+run: rm -rf", wf)

"""Schutz vor kaputten Workflow-Dateien: GitHub startet eine ungültige Datei gar nicht erst."""

import glob
import os

import pytest
import yaml

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
ALLOWED = {"name", "on", True, "permissions", "env", "concurrency", "defaults", "jobs", "run-name"}


@pytest.mark.parametrize("path", sorted(glob.glob(os.path.join(ROOT, ".github", "workflows", "*.yml"))))
def test_workflow_has_only_valid_top_level_keys(path):
    with open(path, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    unknown = set(data) - ALLOWED  # PyYAML liest "on:" als True
    assert not unknown, f"{os.path.basename(path)}: unerwartete Schlüssel (Einrückung kaputt?): {unknown}"
    assert "jobs" in data

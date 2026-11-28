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


@pytest.mark.parametrize("path", sorted(glob.glob(os.path.join(ROOT, ".github", "workflows", "*.yml"))))
def test_no_runner_or_step_context_in_workflow_or_job_env(path):
    """Im env auf Workflow- oder Job-Ebene gibt es die Kontexte runner/steps/job noch nicht -
    GitHub haelt die Datei dann fuer ungueltig und lehnt jeden Start ab (HTTP 422)."""
    import re

    with open(path, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    jobs = (data.get("jobs") or {}).values()
    envs = [data.get("env") or {}] + [(job or {}).get("env") or {} for job in jobs]
    for env in envs:
        for key, value in env.items():
            bad = re.search(r"\$\{\{[^}]*\b(runner|steps|job)\.", str(value))
            assert not bad, f"{os.path.basename(path)}: env {key} nutzt einen hier nicht erlaubten Kontext"

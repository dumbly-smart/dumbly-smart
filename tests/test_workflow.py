from pathlib import Path


WORKFLOW = Path(".github/workflows/render-profile.yml")


def test_profile_workflow_matches_daily_refresh_contract():
    workflow = WORKFLOW.read_text(encoding="utf-8")

    assert "workflow_dispatch:" in workflow
    assert 'cron: "17 6 * * *"' in workflow
    assert "actions/checkout@v4" in workflow
    assert "actions/setup-python@v5" in workflow
    assert 'python-version: "3.11"' in workflow
    assert "python -m pip install -r scripts/requirements.txt" in workflow
    assert "python -m scripts.render_profile" in workflow
    assert "permissions:\n  contents: write" in workflow
    assert "[skip ci]" in workflow
    assert "git add generated/info-card.svg README.md" in workflow
    assert "contributions.json" not in workflow
    assert "render-thirukural.mjs" not in workflow
    assert "setup-node" not in workflow

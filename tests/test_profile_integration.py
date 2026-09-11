import json
from datetime import date
from pathlib import Path

from scripts.config import KURALS_PATH
from scripts.profile_data import select_daily_kural
from scripts.render_profile import generate_profile


FIXTURE_DIR = Path("tests/fixtures")


def test_generate_profile_replaces_profile_outputs_from_fixtures(tmp_path):
    generate_profile(
        date_override=date(2026, 9, 11),
        fetch_network=True,
        output_dir=tmp_path,
        avatar_source=FIXTURE_DIR / "avatar.ppm",
        contributions_source=FIXTURE_DIR / "contributions.html",
    )

    generated = tmp_path / "generated"
    data = tmp_path / "data" / "contributions.json"
    readme = (tmp_path / "README.md").read_text(encoding="utf-8")
    expected_kural = select_daily_kural(date(2026, 9, 11), KURALS_PATH)

    for filename in ("ascii.svg", "info-card.svg", "contrib-heatmap.svg"):
        content = (generated / filename).read_text(encoding="utf-8")
        assert "dumbly-smart" in content

    assert data.exists()
    assert json.loads(data.read_text(encoding="utf-8"))["total"] == 10
    assert str(expected_kural["number"]) in (generated / "info-card.svg").read_text(
        encoding="utf-8"
    )
    assert "thirukural-light.svg" not in readme
    assert "thirukural-dark.svg" not in readme
    assert "avi@github" not in readme
    assert "dumbly-smart@github" in readme
    assert "https://github.com/dumbly-smart" in readme

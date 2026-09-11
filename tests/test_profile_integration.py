from datetime import date
from pathlib import Path

import scripts.render_profile as render_profile
from scripts.config import KURALS_PATH
from scripts.profile_data import select_daily_kural
from scripts.render_profile import generate_profile, render_info_card


def test_generate_profile_replaces_profile_outputs_from_fixtures(tmp_path):
    generate_profile(
        date_override=date(2026, 9, 11),
        output_dir=tmp_path,
    )

    generated = tmp_path / "generated"
    readme = (tmp_path / "README.md").read_text(encoding="utf-8")
    expected_kural = select_daily_kural(date(2026, 9, 11), KURALS_PATH)

    for filename in ("info-card.svg",):
        content = (generated / filename).read_text(encoding="utf-8")
        assert content

    assert expected_kural["tamil"][0] in (generated / "info-card.svg").read_text(
        encoding="utf-8"
    )
    assert "thirukural-light.svg" not in readme
    assert "thirukural-dark.svg" not in readme
    assert "avi@github" not in readme
    assert "dumbly-smart@github" in readme
    assert "generated/ascii.svg" not in readme
    assert "contrib-heatmap.svg" not in readme


def test_profile_has_no_contribution_panel(tmp_path):
    generate_profile(
        date_override="2026-09-12",
        output_dir=tmp_path,
    )

    readme = (tmp_path / "README.md").read_text(encoding="utf-8")
    assert "contrib-heatmap.svg" not in readme
    assert not (tmp_path / "generated" / "contrib-heatmap.svg").exists()
    assert "This profile is generated from public GitHub activity" not in readme
    assert "See the source and public work on" not in readme


def test_profile_has_no_avatar_panel(tmp_path):
    generate_profile(
        date_override="2026-09-11",
        output_dir=tmp_path,
    )

    readme = (tmp_path / "README.md").read_text(encoding="utf-8")
    assert "generated/ascii.svg" not in readme
    assert "ASCII portrait" not in readme


def test_offline_date_generation_uses_local_sources(tmp_path):
    # Exercise the same offline/date behavior through the public function so
    # the test remains isolated from the checkout.
    generate_profile(
        date_override="2026-09-11",
        output_dir=tmp_path,
    )
    info = (tmp_path / "generated" / "info-card.svg").read_text(encoding="utf-8")
    assert "Daily Thirukkural" in info


def test_checked_in_info_card_matches_current_renderer():
    expected = render_info_card(
        select_daily_kural(date(2026, 9, 12), KURALS_PATH),
        "dumbly-smart",
    )

    assert Path("generated/info-card.svg").read_text(encoding="utf-8") == expected


def test_generation_restores_outputs_when_later_replacement_fails(tmp_path, monkeypatch):
    generated = tmp_path / "generated"
    generated.mkdir()
    destinations = [
        generated / "info-card.svg",
        tmp_path / "README.md",
    ]
    for destination in destinations:
        destination.write_text(f"old:{destination.name}", encoding="utf-8")

    real_replace = render_profile.os.replace
    calls = 0

    def fail_once(source, target):
        nonlocal calls
        calls += 1
        if calls == 4:
            raise OSError("simulated later replacement failure")
        return real_replace(source, target)

    monkeypatch.setattr(render_profile.os, "replace", fail_once)

    try:
        generate_profile(
            date_override=date(2026, 9, 11),
            output_dir=tmp_path,
        )
    except OSError as error:
        assert "simulated later replacement failure" in str(error)
    else:
        raise AssertionError("expected promotion failure")

    for destination in destinations:
        assert destination.read_text(encoding="utf-8") == f"old:{destination.name}"

import json
from datetime import date, timedelta
from pathlib import Path
from xml.etree import ElementTree

import scripts.contributions as contributions
from scripts.contributions import (
    _day_positions,
    fetch_contributions,
    parse_contribution_html,
    render_heatmap_svg,
    validate_year_calendar,
)


FIXTURE = Path("tests/fixtures/contributions.html")


def _cells(*dates):
    return "".join(
        f'<rect data-date="{day}" data-level="1" aria-label="1 contribution"/>'
        for day in dates
    )


def _full_year_fixture():
    start = date(2025, 9, 7)
    return "<main>" + _cells(
        *(start + timedelta(days=index) for index in range(365))
    ) + "</main>"


def test_parse_contribution_fixture_and_derive_stats():
    html = FIXTURE.read_text(encoding="utf-8")
    result = parse_contribution_html(html)

    assert result["days"][0] == {"date": "2026-09-01", "count": 0, "level": 0}
    assert result["days"][3] == {"date": "2026-09-04", "count": 4, "level": 4}
    assert result["days"][-1]["date"] == "2026-09-10"
    assert result["total"] == 10
    assert result["longest_streak"] == 3
    assert result["current_streak"] == 2
    assert result["best_day"] == {"date": "2026-09-04", "count": 4, "level": 4}
    assert result["monthly_totals"] == {"2026-09": 10}


def test_parse_contribution_fixture_is_stable_json():
    result = parse_contribution_html(FIXTURE.read_text(encoding="utf-8"))

    serialized = json.dumps(result, ensure_ascii=False, sort_keys=True)
    assert json.loads(serialized) == result
    assert serialized.index('"days"') < serialized.index('"total"')


def test_parse_contribution_rejects_duplicate_dates():
    html = f"<main>{_cells('2026-09-01', '2026-09-01')}</main>"

    try:
        parse_contribution_html(html)
    except ValueError as error:
        assert "duplicate contribution date" in str(error)
    else:
        raise AssertionError("expected duplicate-date validation")


def test_parse_contribution_rejects_sparse_dates():
    html = f"<main>{_cells('2026-09-01', '2026-09-03')}</main>"

    try:
        parse_contribution_html(html)
    except ValueError as error:
        assert "non-contiguous contribution dates" in str(error)
    else:
        raise AssertionError("expected contiguous-date validation")


def test_day_positions_use_sunday_based_rows():
    days = [
        {"date": "2026-09-06"},
        {"date": "2026-09-07"},
        {"date": "2026-09-12"},
        {"date": "2026-09-13"},
    ]

    assert _day_positions(days) == {
        "2026-09-06": (0, 0),
        "2026-09-07": (0, 1),
        "2026-09-12": (0, 6),
        "2026-09-13": (1, 0),
    }


def test_fetch_contributions_parses_before_writing(tmp_path, monkeypatch):
    destination = tmp_path / "contributions.json"
    fixture_html = _full_year_fixture()

    class Response:
        text = fixture_html

        def raise_for_status(self):
            return None

    def get(url, timeout):
        assert url == "https://github.com/users/dumbly-smart/contributions"
        assert timeout == 20
        return Response()

    monkeypatch.setattr(contributions.requests, "get", get)
    result = fetch_contributions("dumbly-smart", destination)

    assert json.loads(destination.read_text(encoding="utf-8")) == result
    assert len(result["days"]) == 365


def test_fetch_contributions_does_not_write_when_parse_fails(tmp_path, monkeypatch):
    destination = tmp_path / "contributions.json"
    destination.write_text("previous", encoding="utf-8")

    class Response:
        text = "<html></html>"

        def raise_for_status(self):
            return None

    monkeypatch.setattr(contributions.requests, "get", lambda url, timeout: Response())

    try:
        fetch_contributions("dumbly-smart", destination)
    except ValueError:
        pass
    else:
        raise AssertionError("expected parse failure")
    assert destination.read_text(encoding="utf-8") == "previous"


def test_validate_year_calendar_requires_a_full_rolling_year():
    days = [
        {"date": f"2026-01-{index:02d}", "count": 0, "level": 0}
        for index in range(1, 11)
    ]

    try:
        validate_year_calendar({"days": days})
    except ValueError as error:
        assert "365" in str(error) or "366" in str(error)
    else:
        raise AssertionError("expected full-year validation")


def test_fetch_contributions_keeps_existing_file_when_atomic_replace_fails(
    tmp_path, monkeypatch
):
    destination = tmp_path / "contributions.json"
    destination.write_text("previous", encoding="utf-8")
    fixture_html = _full_year_fixture()

    class Response:
        text = fixture_html

        def raise_for_status(self):
            return None

    monkeypatch.setattr(contributions.requests, "get", lambda url, timeout: Response())

    def fail_replace(source, target):
        assert Path(source).parent == destination.parent
        assert Path(target) == destination
        raise OSError("simulated replacement failure")

    monkeypatch.setattr(contributions.os, "replace", fail_replace)

    try:
        fetch_contributions("dumbly-smart", destination)
    except OSError as error:
        assert "simulated replacement failure" in str(error)
    else:
        raise AssertionError("expected atomic replacement failure")
    assert destination.read_text(encoding="utf-8") == "previous"
    assert not list(destination.parent.glob(f".{destination.name}.*"))


def test_heatmap_svg_has_grid_metadata_legend_footer_and_animation():
    data = parse_contribution_html(FIXTURE.read_text(encoding="utf-8"))
    svg = render_heatmap_svg(data, "dumbly-smart<&")

    assert 'role="img"' in svg
    assert "Contribution heatmap for dumbly-smart&lt;&amp;" in svg
    assert "Less" in svg and "More" in svg
    assert "10 contributions" in svg
    assert "current streak: 2" in svg
    assert "longest streak: 3" in svg
    assert "animation" in svg
    assert svg.count("class=\"day\"") == 53 * 7
    ElementTree.fromstring(svg)


def test_checked_in_heatmap_matches_current_renderer():
    data = json.loads(Path("data/contributions.json").read_text(encoding="utf-8"))
    expected = render_heatmap_svg(data, "dumbly-smart")

    assert Path("generated/contrib-heatmap.svg").read_text(encoding="utf-8") == expected

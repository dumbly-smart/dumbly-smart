import json
from pathlib import Path
from xml.etree import ElementTree

import scripts.contributions as contributions
from scripts.contributions import (
    fetch_contributions,
    parse_contribution_html,
    render_heatmap_svg,
)


FIXTURE = Path("tests/fixtures/contributions.html")


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


def test_fetch_contributions_parses_before_writing(tmp_path, monkeypatch):
    destination = tmp_path / "contributions.json"
    fixture_html = FIXTURE.read_text(encoding="utf-8")

    class Response:
        text = fixture_html

        def raise_for_status(self):
            return None

    def get(url, timeout):
        assert url.endswith("/dumbly-smart")
        assert timeout == 20
        return Response()

    monkeypatch.setattr(contributions.requests, "get", get)
    result = fetch_contributions("dumbly-smart", destination)

    assert json.loads(destination.read_text(encoding="utf-8")) == result


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

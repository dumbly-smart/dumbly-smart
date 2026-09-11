from datetime import date
import json

from scripts.profile_data import select_daily_kural


def test_select_daily_kural_is_deterministic_and_uses_all_dataset_entries(tmp_path):
    kurals = [
        {"number": n, "tamil": [f"tamil {n}"], "english": f"english {n}"}
        for n in range(1, 1331)
    ]
    path = tmp_path / "kurals.json"
    path.write_text(json.dumps(kurals), encoding="utf-8")

    first = select_daily_kural(date(2026, 9, 11), path)
    second = select_daily_kural(date(2026, 9, 11), path)

    assert first == second
    assert first["number"] == second["number"]
    assert select_daily_kural(date(2026, 9, 12), path)["number"] != first["number"]


def test_select_daily_kural_rejects_wrong_dataset_size(tmp_path):
    path = tmp_path / "kurals.json"
    path.write_text(json.dumps([]), encoding="utf-8")

    try:
        select_daily_kural(date(2026, 9, 11), path)
    except ValueError as error:
        assert "1330" in str(error)
    else:
        raise AssertionError("expected dataset-size validation")

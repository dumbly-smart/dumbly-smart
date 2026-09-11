from datetime import date

from scripts.render_profile import render_info_card


def test_info_card_contains_username_and_kural_but_not_old_name_prompt():
    svg = render_info_card(
        {"number": 42, "tamil": ["ஒரு குறள்"], "english": "A Kural"},
        username="dumbly-smart",
    )

    assert "dumbly-smart@github" in svg
    assert "42" in svg
    assert "A Kural" in svg
    assert "avi@github" not in svg


def test_info_card_omits_focus_row_and_uses_large_kural_type():
    svg = render_info_card(
        {"number": 42, "tamil": ["ஒரு குறள்"], "english": "A Kural"},
        username="dumbly-smart",
    )

    assert ">focus<" not in svg
    assert ".kural{fill:#79c0ff;font:22px" in svg
    assert ".english{fill:#c9d1d9;font:16px" in svg


def test_info_card_accepts_explicit_day():
    svg = render_info_card(
        {"number": 42, "tamil": ["ஒரு குறள்"], "english": "A Kural"},
        username="dumbly-smart",
        day=date(2024, 1, 2),
    )

    assert "2024-01-02" in svg


def test_info_card_types_the_kural_lines_like_a_cli():
    svg = render_info_card(
        {"number": 42, "tamil": ["ஒரு குறள்"], "english": "A Kural"},
        username="dumbly-smart",
        day=date(2024, 1, 2),
    )

    assert 'clipPath id="kural-' in svg
    assert 'attributeName="width"' in svg
    assert 'fill="freeze"' in svg


def test_xml_text_is_escaped():
    svg = render_info_card(
        {"number": 1, "tamil": ["<&"], "english": '"quoted"'},
        username="dumbly-smart",
    )

    assert "&lt;&amp;" in svg
    assert "&quot;quoted&quot;" in svg

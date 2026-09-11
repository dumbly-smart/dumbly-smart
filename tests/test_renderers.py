from datetime import date
from pathlib import Path

from PIL import Image

from scripts.render_profile import (
    avatar_to_grid,
    download_avatar,
    render_ascii_svg,
    render_info_card,
)


def test_ascii_svg_contains_accessible_metadata_and_one_time_animation():
    svg = render_ascii_svg([[0, 255], [255, 0]], username="dumbly-smart")

    assert 'role="img"' in svg
    assert "dumbly-smart" in svg
    assert "animation" in svg or "<animate" in svg


def test_info_card_contains_username_and_kural_but_not_old_name_prompt():
    svg = render_info_card(
        {"number": 42, "tamil": ["ஒரு குறள்"], "english": "A Kural"},
        username="dumbly-smart",
    )

    assert "dumbly-smart@github" in svg
    assert "42" in svg
    assert "A Kural" in svg
    assert "avi@github" not in svg


def test_info_card_accepts_explicit_day():
    svg = render_info_card(
        {"number": 42, "tamil": ["ஒரு குறள்"], "english": "A Kural"},
        username="dumbly-smart",
        day=date(2024, 1, 2),
    )

    assert "2024-01-02" in svg


def test_xml_text_is_escaped():
    svg = render_info_card(
        {"number": 1, "tamil": ["<&"], "english": '"quoted"'},
        username="dumbly-smart",
    )

    assert "&lt;&amp;" in svg
    assert "&quot;quoted&quot;" in svg


def test_avatar_to_grid_uses_requested_dimensions(tmp_path):
    image_path = tmp_path / "avatar.png"
    Image.new("RGB", (4, 2), color=(128, 128, 128)).save(image_path)

    grid = avatar_to_grid(image_path, columns=4, rows=3)

    assert len(grid) == 3
    assert all(len(row) == 4 for row in grid)
    assert all(0 <= value <= 255 for row in grid for value in row)


def test_avatar_to_grid_crops_rectangular_images_without_stretching(tmp_path):
    image_path = tmp_path / "wide-avatar.png"
    image = Image.new("L", (8, 2), color=255)
    image.putpixel((0, 0), 0)
    image.putpixel((0, 1), 0)
    image.putpixel((7, 0), 0)
    image.putpixel((7, 1), 0)
    image.save(image_path)

    grid = avatar_to_grid(image_path, columns=4, rows=2)

    assert min(value for row in grid for value in row) > 100


def test_download_avatar_replaces_destination_atomically(tmp_path):
    destination = tmp_path / "avatar.png"

    class Response:
        content = b"avatar bytes"

        def raise_for_status(self):
            return None

    class Session:
        def get(self, url, timeout):
            assert url.endswith("dumbly-smart.png?size=512")
            assert timeout > 0
            return Response()

    download_avatar(destination, session=Session())

    assert destination.read_bytes() == b"avatar bytes"
    assert not list(Path(tmp_path).glob(".avatar.png.*"))

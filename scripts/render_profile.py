"""Pure SVG renderers and local avatar preparation for the profile README."""

from __future__ import annotations

import os
import tempfile
from datetime import date
from pathlib import Path
from typing import Iterable

import requests
from PIL import Image, ImageOps

from .config import AVATAR_URL, xml_escape


TIMEOUT_SECONDS = 20
DENSITY = " .:-=+*#%@"


def download_avatar(destination, session=requests):
    """Download the public avatar, replacing *destination* atomically."""
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    response = session.get(AVATAR_URL, timeout=TIMEOUT_SECONDS)
    response.raise_for_status()

    temporary_name = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="wb", dir=destination.parent, prefix=f".{destination.name}.", delete=False
        ) as temporary:
            temporary_name = temporary.name
            if hasattr(response, "iter_content"):
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        temporary.write(chunk)
            else:
                temporary.write(response.content)
            temporary.flush()
            os.fsync(temporary.fileno())
        os.replace(temporary_name, destination)
    finally:
        if temporary_name and os.path.exists(temporary_name):
            os.unlink(temporary_name)
    return destination


def avatar_to_grid(path, columns=92, rows=48):
    """Convert an avatar into a rows-by-columns grayscale brightness grid."""
    if columns <= 0 or rows <= 0:
        raise ValueError("columns and rows must be positive")

    with Image.open(path) as source:
        image = ImageOps.exif_transpose(source).convert("L")
        # Terminal glyphs are roughly twice as tall as they are wide. Resize at
        # twice the output height, then average each pair of character cells.
        image = image.resize((columns, rows * 2), Image.Resampling.LANCZOS)
        pixels = image.load()
        return [
            [round((pixels[column, row * 2] + pixels[column, row * 2 + 1]) / 2)
             for column in range(columns)]
            for row in range(rows)
        ]


def _brightness_character(value):
    value = max(0, min(255, int(value)))
    return DENSITY[(255 - value) * (len(DENSITY) - 1) // 255]


def _svg_text(text, x, y, *, class_name="text", anchor=None):
    anchor_attribute = f' text-anchor="{anchor}"' if anchor else ""
    return f'<text class="{class_name}" x="{x}" y="{y}"{anchor_attribute}>{xml_escape(text)}</text>'


def render_ascii_svg(grid, username):
    """Render a dark terminal avatar with a one-time reveal for each row."""
    rows = [list(row) for row in grid]
    height = max(1, len(rows)) * 16 + 34
    width = max(1, max((len(row) for row in rows), default=1)) * 9 + 24
    escaped_user = xml_escape(username)
    output = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" '
        f'role="img" aria-label="ASCII avatar for {escaped_user}">',
        "<title>Animated terminal avatar for " + escaped_user + "</title>",
        "<style>.bg{fill:#0d1117}.text{fill:#c9d1d9;font:12px monospace;white-space:pre}.prompt{fill:#58a6ff}.reveal{animation:reveal .9s ease-out both}.cursor{fill:#58a6ff}@keyframes reveal{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}</style>",
        f'<rect class="bg" width="{width}" height="{height}" rx="8"/>',
        _svg_text(f"{username}@github:~$ avatar", 12, 18, class_name="text prompt"),
    ]
    for index, row in enumerate(rows):
        content = "".join(_brightness_character(value) for value in row)
        y = 34 + index * 16
        output.append(
            f'<clipPath id="row-{index}"><rect x="0" y="{y - 12}" width="{width}" height="16"/></clipPath>'
        )
        output.append(
            f'<g class="reveal" style="animation-delay:{index * 35}ms" clip-path="url(#row-{index})">'
            + _svg_text(content, 12, y)
            + "</g>"
        )
    output.append("</svg>")
    return "".join(output)


def _as_lines(value) -> list[str]:
    if isinstance(value, str):
        return [value]
    return [str(line) for line in value]


def render_info_card(kural, username, highlights=None):
    """Render the user/date/Kural terminal card with escaped content."""
    highlights = list(highlights or [])
    tamil_lines = _as_lines(kural.get("tamil", []))
    english = str(kural.get("english", ""))
    number = kural.get("number", "")
    height = 220 + max(0, len(tamil_lines) - 2) * 22
    output = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 {height}" role="img" aria-label="Profile information and Kural {xml_escape(number)}">',
        f'<title>{xml_escape(username)}@github daily Thirukkural</title>',
        "<style>.bg{fill:#0d1117}.bar{fill:#161b22}.label{fill:#8b949e;font:13px monospace}.value{fill:#c9d1d9;font:14px monospace}.kural{fill:#79c0ff;font:16px sans-serif}.english{fill:#c9d1d9;font:13px sans-serif}.dot{fill:#3fb950}.line{animation:rise .7s ease-out both}@keyframes rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}</style>",
        f'<rect class="bg" width="760" height="{height}" rx="9"/>',
        '<rect class="bar" width="760" height="30" rx="9"/>',
        '<circle class="dot" cx="18" cy="15" r="5"/><circle fill="#d29922" cx="36" cy="15" r="5"/><circle fill="#f85149" cx="54" cy="15" r="5"/>',
        _svg_text("daily-profile", 72, 20, class_name="label"),
        '<g class="line" style="animation-delay:80ms">' + _svg_text("user", 24, 58, class_name="label") + _svg_text(f"{username}@github", 150, 58, class_name="value") + "</g>",
        '<g class="line" style="animation-delay:140ms">' + _svg_text("date", 24, 82, class_name="label") + _svg_text(date.today().isoformat(), 150, 82, class_name="value") + "</g>",
        '<g class="line" style="animation-delay:200ms">' + _svg_text("kural", 24, 106, class_name="label") + _svg_text(str(number), 150, 106, class_name="value") + "</g>",
        '<g class="line" style="animation-delay:260ms">' + _svg_text("focus", 24, 130, class_name="label") + _svg_text(", ".join(highlights) if highlights else "clarity · consistency · curiosity", 150, 130, class_name="value") + "</g>",
    ]
    y = 160
    for index, line in enumerate(tamil_lines):
        output.append(f'<g class="line" style="animation-delay:{320 + index * 60}ms">' + _svg_text(line, 24, y, class_name="kural") + "</g>")
        y += 22
    output.append(f'<g class="line" style="animation-delay:{320 + len(tamil_lines) * 60}ms">' + _svg_text(english, 24, y + 8, class_name="english") + "</g>")
    output.append("</svg>")
    return "".join(output)

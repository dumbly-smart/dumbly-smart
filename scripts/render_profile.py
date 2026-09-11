"""SVG renderers and profile generation for the GitHub README."""

from __future__ import annotations

import os
import tempfile
from argparse import ArgumentParser
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from .config import (
    KURALS_PATH,
    TIMEZONE,
    USERNAME,
    xml_escape,
)
from .profile_data import select_daily_kural


def _svg_text(text, x, y, *, class_name="text", anchor=None):
    anchor_attribute = f' text-anchor="{anchor}"' if anchor else ""
    return f'<text class="{class_name}" x="{x}" y="{y}"{anchor_attribute}>{xml_escape(text)}</text>'


def _as_lines(value) -> list[str]:
    if isinstance(value, str):
        return [value]
    return [str(line) for line in value]


def _resolve_day(day):
    if day is None:
        return datetime.now(ZoneInfo(TIMEZONE)).date()
    if isinstance(day, datetime):
        if day.tzinfo is not None:
            return day.astimezone(ZoneInfo(TIMEZONE)).date()
        return day.date()
    if isinstance(day, date):
        return day
    if isinstance(day, str):
        return date.fromisoformat(day)
    raise TypeError("day must be a date, datetime, or None")


def render_info_card(kural, username):
    """Render the user/date/Kural terminal card with escaped content."""
    tamil_lines = _as_lines(kural.get("tamil", []))
    english = str(kural.get("english", ""))
    height = 110 + max(0, len(tamil_lines) - 2) * 30
    output = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 {height}" role="img" aria-label="Daily Thirukkural">',
        "<title>Daily Thirukkural</title>",
        "<style>.kural{fill:#79c0ff;font:22px sans-serif}.english{fill:#c9d1d9;font:16px sans-serif}.line{animation:rise .7s ease-out both}@keyframes rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}</style>",
    ]
    y = 36
    for index, line in enumerate(tamil_lines):
        delay = 80 + index * 60
        duration = max(1.2, len(line) * 0.045)
        clip_id = f"kural-tamil-{index}"
        output.append(
            f'<clipPath id="{clip_id}"><rect x="0" y="{y - 18}" width="0" height="28">'
            f'<animate attributeName="width" from="0" to="720" dur="{duration:.2f}s" '
            f'begin="{delay}ms" fill="freeze"/></rect></clipPath>'
            f'<g class="line" style="animation-delay:{delay}ms" clip-path="url(#{clip_id})">'
            + _svg_text(line, 24, y, class_name="kural")
            + "</g>"
        )
        y += 30
    english_delay = 80 + len(tamil_lines) * 60
    english_clip_id = "kural-english"
    english_duration = max(1.2, len(english) * 0.025)
    output.append(
        f'<clipPath id="{english_clip_id}"><rect x="0" y="{y - 10}" width="0" height="28">'
        f'<animate attributeName="width" from="0" to="720" dur="{english_duration:.2f}s" '
        f'begin="{english_delay}ms" fill="freeze"/></rect></clipPath>'
        f'<g class="line" style="animation-delay:{english_delay}ms" clip-path="url(#{english_clip_id})">'
        + _svg_text(english, 24, y + 8, class_name="english")
        + "</g>"
    )
    output.append("</svg>")
    return "".join(output)


README_TEMPLATE = """<div align="center">
<h3><code>{username}@github ~ $ ./kural --today</code></h3>
<img src="./generated/info-card.svg" width="760" alt="Daily Thirukkural terminal card" />
</div>
"""


def _promote_outputs(staged_outputs):
    """Replace outputs together, restoring prior files if promotion fails."""
    promoted = []
    try:
        for staged, destination in staged_outputs.items():
            backup = None
            if destination.exists():
                with tempfile.NamedTemporaryFile(
                    dir=destination.parent,
                    prefix=f".{destination.name}.backup-",
                    delete=False,
                ) as temporary:
                    backup = Path(temporary.name)
                backup.unlink()
                os.replace(destination, backup)
            promoted.append((destination, backup))
            os.replace(staged, destination)
    except Exception:
        for destination, backup in reversed(promoted):
            if destination.exists():
                destination.unlink()
            if backup is not None and backup.exists():
                os.replace(backup, destination)
        raise
    else:
        for _, backup in promoted:
            if backup is not None and backup.exists():
                backup.unlink()


def generate_profile(
    date_override=None,
    output_dir=None,
):
    """Generate the complete animated profile into the repository outputs."""
    root = Path(output_dir) if output_dir is not None else Path(__file__).resolve().parent.parent
    root.mkdir(parents=True, exist_ok=True)
    generated_dir = root / "generated"
    readme_path = root / "README.md"
    day = _resolve_day(date_override)
    kural = select_daily_kural(day, KURALS_PATH)

    with tempfile.TemporaryDirectory(dir=root, prefix=".profile-build-") as temporary:
        stage = Path(temporary)
        stage_generated = stage / "generated"
        stage_generated.mkdir()

        info_svg = render_info_card(kural, USERNAME)
        readme = README_TEMPLATE.format(username=USERNAME)

        staged_outputs = {
            stage_generated / "info-card.svg": generated_dir / "info-card.svg",
            stage / "README.md": readme_path,
        }
        (stage_generated / "info-card.svg").write_text(info_svg, encoding="utf-8")
        (stage / "README.md").write_text(readme, encoding="utf-8")

        for _, destination in staged_outputs.items():
            destination.parent.mkdir(parents=True, exist_ok=True)
        _promote_outputs(staged_outputs)

    return {
        "info": generated_dir / "info-card.svg",
        "readme": readme_path,
    }


def main(argv=None):
    parser = ArgumentParser(description="Render the animated GitHub profile")
    parser.add_argument("--date", help="override the profile date (YYYY-MM-DD)")
    args = parser.parse_args(argv)
    generate_profile(date_override=args.date)


if __name__ == "__main__":
    main()

"""GitHub contribution calendar parsing, statistics, and SVG rendering."""

from __future__ import annotations

import json
import os
import re
import tempfile
from collections import defaultdict
from datetime import date, timedelta
from html import escape
from pathlib import Path

import requests
from bs4 import BeautifulSoup

from .config import xml_escape


TIMEOUT_SECONDS = 20
PALETTE = ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353", "#56d364"]
COUNT_RE = re.compile(r"(\d[\d,]*)")


def _count_from_cell(cell) -> int:
    label = cell.get("aria-label", "")
    match = COUNT_RE.search(label)
    if not match:
        return 0
    return int(match.group(1).replace(",", ""))


def _streaks(days: list[dict]) -> tuple[int, int]:
    longest = 0
    run = 0
    for day in days:
        if day["count"] > 0:
            run += 1
            longest = max(longest, run)
        else:
            run = 0

    current = 0
    for day in reversed(days):
        if day["count"] <= 0:
            break
        current += 1
    return current, longest


def parse_contribution_html(html: str) -> dict:
    """Parse contribution cells from HTML without performing network I/O."""
    soup = BeautifulSoup(html, "html.parser")
    days = []
    for cell in soup.select("[data-date][data-level]"):
        try:
            parsed_date = date.fromisoformat(cell["data-date"])
            level = int(cell["data-level"])
        except (KeyError, TypeError, ValueError) as error:
            raise ValueError("invalid contribution cell") from error
        days.append(
            {
                "date": parsed_date.isoformat(),
                "count": _count_from_cell(cell),
                "level": max(0, min(5, level)),
            }
        )

    days.sort(key=lambda item: item["date"])
    if not days:
        raise ValueError("no contribution cells found")
    dates = [date.fromisoformat(day["date"]) for day in days]
    if len(set(dates)) != len(dates):
        raise ValueError("duplicate contribution date")
    for previous, current in zip(dates, dates[1:]):
        if current != previous + timedelta(days=1):
            raise ValueError("non-contiguous contribution dates")

    current_streak, longest_streak = _streaks(days)
    monthly_totals = defaultdict(int)
    for day in days:
        monthly_totals[day["date"][:7]] += day["count"]
    best_day = max(days, key=lambda item: (item["count"], item["date"]))
    return {
        "days": days,
        "total": sum(day["count"] for day in days),
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "best_day": best_day,
        "monthly_totals": dict(sorted(monthly_totals.items())),
    }


def fetch_contributions(username: str, destination) -> dict:
    """Fetch, parse, and then persist a public GitHub contribution page."""
    response = requests.get(
        f"https://github.com/users/{username}/contributions",
        timeout=TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    data = parse_contribution_html(response.text)

    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary_name = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=destination.parent,
            prefix=f".{destination.name}.",
            delete=False,
        ) as temporary:
            temporary_name = temporary.name
            json.dump(data, temporary, ensure_ascii=False, indent=2)
            temporary.write("\n")
            temporary.flush()
            os.fsync(temporary.fileno())
        os.replace(temporary_name, destination)
    finally:
        if temporary_name and os.path.exists(temporary_name):
            os.unlink(temporary_name)
    return data


def _day_positions(days: list[dict]) -> dict[str, tuple[int, int]]:
    first = date.fromisoformat(days[0]["date"])
    start = first.toordinal() - (first.weekday() + 1) % 7
    positions = {}
    for day in days:
        current = date.fromisoformat(day["date"])
        offset = current.toordinal() - start
        positions[day["date"]] = (offset // 7, offset % 7)
    return positions


def render_heatmap_svg(data: dict, username: str) -> str:
    """Render a self-contained, accessible 53-week contribution heatmap."""
    width, height = 860, 185
    left, top, cell, gap = 24, 24, 12, 3
    positions = _day_positions(data["days"])
    by_date = {day["date"]: day for day in data["days"]}
    escaped_user = xml_escape(username)
    title = f"Contribution heatmap for {escaped_user}"
    output = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" role="img" aria-label="{title}">',
        f"<title>{title}</title>",
        f"<desc>{xml_escape(data['total'])} contributions; current streak: {xml_escape(data['current_streak'])}; longest streak: {xml_escape(data['longest_streak'])}.</desc>",
        "<style>.bg{fill:#0d1117}.label{fill:#8b949e;font:11px sans-serif}.day{stroke:#0d1117;stroke-width:1;animation:reveal .65s ease-out both}@keyframes reveal{from{opacity:0;transform:translate(-5px,-5px)}to{opacity:1;transform:translate(0,0)}}</style>",
        f'<rect class="bg" width="{width}" height="{height}" rx="9"/>',
    ]
    for column in range(53):
        for row in range(7):
            x = left + column * (cell + gap)
            y = top + row * (cell + gap)
            level = 0
            for day, (day_column, day_row) in positions.items():
                if day_column == column and day_row == row:
                    level = by_date[day]["level"]
                    break
            delay = (column + row) * 18
            output.append(
                f'<rect class="day" x="{x}" y="{y}" width="{cell}" height="{cell}" rx="2" fill="{PALETTE[level]}" style="animation-delay:{delay}ms"/>'
            )

    legend_x = 680
    output.extend(
        [
            '<text class="label" x="24" y="143">Less</text>',
            '<text class="label" x="746" y="143">More</text>',
        ]
    )
    for index, color in enumerate(PALETTE[:5]):
        output.append(
            f'<rect x="{legend_x + index * 14}" y="134" width="11" height="11" rx="2" fill="{color}"/>'
        )
    footer = (
        f"{data['total']} contributions · current streak: {data['current_streak']} · "
        f"longest streak: {data['longest_streak']}"
    )
    output.append(f'<text class="label" x="24" y="171">{xml_escape(footer)}</text>')
    output.append("</svg>")
    return "".join(output)

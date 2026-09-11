import json
from datetime import date
from pathlib import Path


DATASET_SIZE = 1330
EPOCH = date(2024, 1, 1)


def select_daily_kural(day: date, path: str | Path) -> dict:
    with Path(path).open(encoding="utf-8") as file:
        kurals = json.load(file)

    if len(kurals) != DATASET_SIZE:
        raise ValueError(
            f"Expected exactly {DATASET_SIZE} Kurals, found {len(kurals)}"
        )

    index = (day - EPOCH).days % DATASET_SIZE
    return kurals[index]

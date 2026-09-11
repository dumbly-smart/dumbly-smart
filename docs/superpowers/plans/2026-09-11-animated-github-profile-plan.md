# Animated GitHub Profile README Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current Thirukkural-only profile repository with a terminal-style animated GitHub profile for `dumbly-smart`, including the GitHub avatar, contribution heatmap, and one deterministic daily Thirukkural.

**Architecture:** Use focused Python scripts with shared configuration and pure rendering helpers. A local command fetches the public avatar/contribution calendar, selects the India-date Kural, renders three self-contained SVGs, and the README embeds those SVGs. GitHub Actions runs the refresh daily and manually, preserving committed outputs if a network fetch fails.

**Tech Stack:** Python 3.11, Pillow, Requests, BeautifulSoup 4, pytest, GitHub Actions, SVG/Markdown.

---

## File map

- Create `scripts/config.py`: username, timezone, URLs, palette, paths, and reusable XML escaping/date helpers.
- Create `scripts/profile_data.py`: deterministic Kural selection and derived contribution statistics.
- Create `scripts/render_profile.py`: avatar download/preparation, ASCII portrait rendering, info-card rendering, and the top-level generation command.
- Create `scripts/contributions.py`: contribution HTML parsing, JSON serialization, and contribution SVG rendering.
- Create `scripts/requirements.txt`: pinned runtime/test dependencies.
- Create `tests/fixtures/contributions.html`: deterministic GitHub calendar fixture.
- Create `tests/test_profile_data.py`, `tests/test_contributions.py`, and `tests/test_renderers.py`.
- Create `.github/workflows/update-profile.yml`: daily/manual generation and committed output refresh.
- Replace `README.md` with the terminal-style profile composition.
- Replace `scripts/render-thirukural.mjs` with the Python generation path and delete the old generated Thirukkural-only SVGs.
- Keep `data/kurals.json`; replace the old generated output with `data/contributions.json` and the three new generated SVGs.

### Task 1: Establish Python tooling and pure profile-data tests

**Files:**
- Create: `scripts/requirements.txt`
- Create: `scripts/config.py`
- Create: `scripts/profile_data.py`
- Create: `tests/test_profile_data.py`

- [ ] **Step 1: Add the failing date/Kural tests.**

```python
from datetime import date
import json

from scripts.profile_data import select_daily_kural


def test_select_daily_kural_is_deterministic_and_uses_all_dataset_entries(tmp_path):
    kurals = [{"number": n, "tamil": [f"tamil {n}"], "english": f"english {n}"}
             for n in range(1, 1331)]
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
```

- [ ] **Step 2: Run the focused test and verify the expected import failure.**

Run: `python -m pytest tests/test_profile_data.py -q`

Expected: collection fails because `scripts.profile_data` does not yet exist.

- [ ] **Step 3: Implement configuration and deterministic selection.**

`scripts/config.py` must define `USERNAME = "dumbly-smart"`, `TIMEZONE = "Asia/Kolkata"`, `KURALS_PATH`, `CONTRIBUTIONS_PATH`, `GENERATED_DIR`, and `AVATAR_URL = f"https://github.com/{USERNAME}.png?size=512"`. `scripts/profile_data.py` must load JSON, require exactly 1,330 entries, calculate `days_since_epoch % 1330`, and return the selected dictionary. Add `xml_escape(value)` in `config.py` using `html.escape(..., quote=True)`.

- [ ] **Step 4: Add pinned dependencies and package markers.**

Create `scripts/requirements.txt` with:

```text
beautifulsoup4==4.12.3
Pillow==10.4.0
pytest==8.3.3
requests==2.32.3
```

Create empty `scripts/__init__.py` and `tests/__init__.py` so imports work consistently from the repository root.

- [ ] **Step 5: Run the focused tests and commit.**

Run: `python -m pytest tests/test_profile_data.py -q`

Expected: `2 passed`.

Commit: `git add scripts tests && git commit -m "feat: add profile data primitives"`

### Task 2: Build the avatar and info-card SVG renderers with TDD

**Files:**
- Modify: `scripts/render_profile.py`
- Create: `tests/test_renderers.py`
- Create: `generated/ascii.svg`
- Create: `generated/info-card.svg`

- [ ] **Step 1: Write renderer contract tests.**

```python
from scripts.render_profile import render_ascii_svg, render_info_card


def test_ascii_svg_contains_accessible_metadata_and_one_time_animation():
    svg = render_ascii_svg([[0, 255], [255, 0]], username="dumbly-smart")
    assert 'role="img"' in svg
    assert "dumbly-smart" in svg
    assert "animation" in svg or "<animate" in svg


def test_info_card_contains_username_and_kural_but_not_old_name_prompt():
    svg = render_info_card({"number": 42, "tamil": ["ஒரு குறள்"], "english": "A Kural"},
                           username="dumbly-smart")
    assert "dumbly-smart@github" in svg
    assert "42" in svg
    assert "A Kural" in svg
    assert "avi@github" not in svg


def test_xml_text_is_escaped():
    svg = render_info_card({"number": 1, "tamil": ["<&"], "english": '"quoted"'},
                           username="dumbly-smart")
    assert "&lt;&amp;" in svg
    assert "&quot;quoted&quot;" in svg
```

- [ ] **Step 2: Run the renderer tests and confirm they fail.**

Run: `python -m pytest tests/test_renderers.py -q`

Expected: import or missing-function failures.

- [ ] **Step 3: Implement the avatar pipeline.**

Add `download_avatar(destination, session=requests)` with a timeout and atomic temporary-file replacement. Add `avatar_to_grid(path, columns=92, rows=48)` using Pillow grayscale conversion, aspect correction, resize, and brightness-to-density mapping. `render_ascii_svg(grid, username)` must emit a dark terminal SVG with escaped metadata and row-level `<clipPath>`/`<animate>` reveals that run once and freeze.

- [ ] **Step 4: Implement the info card.**

Add `render_info_card(kural, username, highlights=None)` with a terminal title bar, `user`, `date`, `kural`, and `focus` rows. Put the Tamil couplet and English translation in escaped text. Use a staggered one-time opacity/translate animation and do not add invented role/location/company fields.

- [ ] **Step 5: Run tests and commit the renderer implementation.**

Run: `python -m pytest tests/test_renderers.py -q`

Expected: `3 passed`.

Commit: `git add scripts/render_profile.py tests/test_renderers.py && git commit -m "feat: render animated avatar and Kural card"`

### Task 3: Parse and render the public contribution calendar

**Files:**
- Create: `scripts/contributions.py`
- Create: `tests/fixtures/contributions.html`
- Create: `tests/test_contributions.py`
- Create: `data/contributions.json`
- Create: `generated/contrib-heatmap.svg`

- [ ] **Step 1: Add a fixture and failing parser/statistics tests.**

The fixture must include representative GitHub contribution cells with `data-date` and `data-level` attributes, including an empty day and levels 1–4. Tests must assert parsed date/count/level values, total count, current streak, longest streak, and stable JSON serialization.

```python
from pathlib import Path

from scripts.contributions import parse_contribution_html


def test_parse_contribution_fixture_and_derive_stats():
    html = Path("tests/fixtures/contributions.html").read_text(encoding="utf-8")
    result = parse_contribution_html(html)
    assert result["days"][0] == {"date": "2026-09-01", "count": 0, "level": 0}
    assert result["total"] == 10
    assert result["longest_streak"] == 3
    assert result["current_streak"] == 2
```

- [ ] **Step 2: Run parser tests and verify they fail.**

Run: `python -m pytest tests/test_contributions.py -q`

Expected: missing-module or missing-function failures.

- [ ] **Step 3: Implement robust HTML parsing and statistics.**

Use BeautifulSoup to select `[data-date][data-level]`, parse the count from
`aria-label` when present, map level to `0..5`, sort by date, and derive total,
current streak, longest streak, best day, and monthly totals. Expose
`fetch_contributions(username, destination)` using `requests.get(...,
timeout=20)` and write JSON only after successful parsing. Keep parsing pure so
the fixture covers it without network access.

- [ ] **Step 4: Implement the heatmap SVG.**

Add `render_heatmap_svg(data, username)` for a 53-week by 7-day grid using the
GitHub green palette, a Less/More legend, total/streak footer, accessible title
and description, and a diagonal one-time reveal animation. Use XML escaping for
all dynamic text.

- [ ] **Step 5: Run parser/renderer tests and commit.**

Run: `python -m pytest tests/test_contributions.py tests/test_renderers.py -q`

Expected: all contribution and renderer tests pass.

Commit: `git add scripts/contributions.py tests data/contributions.json generated/contrib-heatmap.svg && git commit -m "feat: add animated contribution heatmap"`

### Task 4: Compose the complete replacement and generation command

**Files:**
- Modify: `scripts/render_profile.py`
- Replace: `README.md`
- Delete: `scripts/render-thirukural.mjs`, `generated/thirukural-light.svg`, `generated/thirukural-dark.svg`
- Create: `generated/ascii.svg`, `generated/info-card.svg`

- [ ] **Step 1: Add an integration test for the replacement output.**

Test the top-level `generate_profile(date_override=None, fetch_network=True)` with a temporary output directory, a fixture avatar, and the contribution fixture. Assert the three SVGs and JSON exist, all contain `dumbly-smart`, the info card contains the selected Kural, and the README template contains no `thirukural-light.svg`, `thirukural-dark.svg`, or `avi@github`.

- [ ] **Step 2: Implement the top-level command.**

The command must select the Kural for `Asia/Kolkata`, download/process the public avatar, fetch contributions, render the three SVGs, and write the README. Support `--offline` to use committed contribution JSON and a local avatar fixture, and `--date YYYY-MM-DD` for deterministic local verification. Write outputs through temporary files and replace them only after every renderer succeeds.

- [ ] **Step 3: Replace the README.**

Use a centered terminal composition:

```html
<div align="center">
<h3><code>dumbly-smart@github ~ $ ./contributions.sh</code></h3>
<img src="./generated/contrib-heatmap.svg" width="860" alt="GitHub contribution heatmap" />
<br><br>
<h3><code>dumbly-smart@github ~ $ ./whoami</code></h3>
<table><tr>
<td valign="top"><img src="./generated/ascii.svg" width="370" alt="ASCII portrait" /></td>
<td valign="top"><img src="./generated/info-card.svg" width="490" alt="Profile information card" /></td>
</tr></table>
</div>
```

Add a short Markdown fallback explaining the profile and linking to
`https://github.com/dumbly-smart`.

- [ ] **Step 4: Run the offline integration path and commit the replacement.**

Run: `python -m scripts.render_profile --offline --date 2026-09-11`

Expected: the command exits 0 and writes all three generated SVGs and the
README. Verify with `rg -n 'thirukural-light|thirukural-dark|avi@github|dumbly-smart' README.md generated scripts`.

Commit: `git add -A && git commit -m "feat: replace repo with animated GitHub profile"`

### Task 5: Add daily GitHub Actions refresh and full verification

**Files:**
- Create: `.github/workflows/update-profile.yml`
- Modify: `README.md` only if generated cache-busting/query strings are needed

- [ ] **Step 1: Write the workflow.**

Use `schedule` at `17 6 * * *`, `workflow_dispatch`, `actions/checkout@v4`,
`actions/setup-python@v5` with Python 3.11, `pip install -r scripts/requirements.txt`,
`python -m scripts.render_profile`, and `stefanzweifel/git-auto-commit-action@v5`.
Set `permissions: contents: write`; commit only `data/contributions.json`,
`generated/*.svg`, and `README.md`; use `[skip ci]` in the commit message.

- [ ] **Step 2: Add workflow/documentation assertions.**

Test that the workflow text contains the schedule, manual trigger, Python setup,
write permission, generator command, and restricted file pattern. Test that the
README references only existing generated assets.

- [ ] **Step 3: Run the complete verification suite.**

Run:

```bash
python -m pytest -q
python -m scripts.render_profile --offline --date 2026-09-11
python - <<'PY'
from pathlib import Path
import xml.etree.ElementTree as ET
for path in Path("generated").glob("*.svg"):
    ET.parse(path)
    print(path, "valid XML")
PY
git diff --check
git status --short
```

Expected: every test passes, generation exits 0, all generated SVGs parse as
XML, `git diff --check` is clean, and only intended replacement files are
modified.

- [ ] **Step 4: Commit the workflow and verification tests.**

Commit: `git add .github tests README.md && git commit -m "ci: refresh animated profile daily"`

## Self-review checklist

- The spec's complete replacement requirement is covered by Task 4, including
  deletion of the old renderer and generated assets.
- Daily India-date Kural selection is covered by Tasks 1 and 4.
- Avatar use and animated ASCII output are covered by Task 2.
- Public contribution parsing and animated heatmap are covered by Task 3.
- GitHub-safe README composition and no-JavaScript animation are covered by
  Task 4.
- Failure handling, atomic output replacement, and offline fixture testing are
  covered by Tasks 3–5.
- The plan contains no unresolved TODO/TBD placeholders.

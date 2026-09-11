# Animated GitHub Profile README — Design Specification

## Goal

Replace the current Thirukkural-only profile README implementation with an
article-inspired, terminal-style animated GitHub profile for `dumbly-smart`.
The profile will use the account's GitHub avatar and username, show a live
contribution heatmap, and make the terminal output feature a different
Thirukkural each India-calendar day instead of a personal name.

## Scope

The repository will contain only the new profile implementation and the data
needed to generate it. The current README composition and current SVG renderer
will be removed/replaced. The existing 1,330-couplet dataset remains because
it is the source for the daily Kural behavior.

The generated profile consists of:

- `generated/ascii.svg`: a monochrome, self-typing ASCII portrait generated
  from `https://github.com/dumbly-smart.png`.
- `generated/info-card.svg`: a neofetch-style animated card using the
  username, avatar/profile identity, the daily Kural, and project-derived
  highlights.
- `generated/contrib-heatmap.svg`: a self-contained animated 53-week GitHub
  contribution graph with legend and derived statistics.
- `README.md`: a GitHub-safe terminal layout embedding the three SVGs with a
  text fallback and links to the profile/repository.

## Architecture and data flow

1. A profile configuration identifies `dumbly-smart` and the GitHub avatar
   endpoint. It is centralized so the username is not duplicated across
   scripts.
2. A daily Kural selector uses the current date in `Asia/Kolkata`, maps it
   deterministically across all 1,330 entries, and emits the selected couplet
   and date into the info card. It must not depend on random state.
3. An avatar preparation step downloads the public GitHub avatar and produces
   a high-contrast grayscale source. A renderer converts it to a character grid
   and writes an SVG whose rows reveal left-to-right once and then freeze.
4. A contribution fetcher reads the public GitHub contribution calendar HTML,
   parses day counts and dates without a token, and writes normalized JSON.
   Fetch failures must leave the previous contribution data available and
   return a non-zero status so automation exposes the failure.
5. A heatmap renderer converts normalized contribution data into the GitHub
   green palette, adds streak/monthly summary data when available, and writes
   an SVG with a one-time reveal animation.
6. The info-card renderer writes terminal-style key/value rows. It may include
   facts available from the repository and public profile context, but must
   omit unknown personal facts rather than inventing them.
7. A GitHub Actions workflow runs the refresh command daily and manually,
   commits only generated/data changes, and uses `contents: write`.

## Visual and interaction requirements

- The README must work with GitHub's HTML sanitization: no JavaScript or
  external CSS; all animation is embedded in SVG using SMIL/CSS keyframes.
- The heatmap is placed above the identity row.
- The ASCII portrait and info card are side by side in a table so GitHub keeps
  the layout aligned.
- Animation plays once on image load and then remains still; no perpetual
  flashing or glow loops.
- Dark, monochrome terminal styling is the default. SVGs include accessible
  `role`, `title`, and `desc` text where practical.
- The terminal prompt uses `dumbly-smart@github` and the daily Kural output,
  never the old personal-name placeholder.

## File layout

```text
README.md
data/kurals.json
data/contributions.json
generated/ascii.svg
generated/info-card.svg
generated/contrib-heatmap.svg
scripts/config.(json|mjs)
scripts/fetch-avatar.(mjs|py)
scripts/render-ascii.(mjs|py)
scripts/fetch-contributions.(mjs|py)
scripts/render-heatmap.(mjs|py)
scripts/render-profile.(mjs|py)
.github/workflows/update-profile.yml
```

The implementation may choose one language for all scripts; the final layout
should retain these responsibilities even if filenames differ.

## Error handling

- Validate that the Kural dataset contains exactly 1,330 entries before
  rendering.
- Escape XML text and attributes so Kural text or profile content cannot break
  generated SVG.
- Fail clearly when GitHub returns a non-success response or the contribution
  markup cannot be parsed.
- Keep the last committed contribution JSON/SVG usable if a fetch fails locally;
  the workflow should fail before committing a partial replacement.
- Use a fixed fallback text path in the README so the profile remains useful
  if an SVG is unavailable.

## Verification

- Run the generator from a clean checkout and confirm all three SVGs and the
  normalized contribution data are produced.
- Validate that generated SVGs parse as XML and contain the expected username,
  Kural text, accessible metadata, and animation elements.
- Run the generator on two consecutive India dates (using an injectable date
  or test clock) and confirm the selected Kural changes deterministically.
- Run the contribution parser against a saved fixture so tests do not depend
  on GitHub availability.
- Check the README references only files that exist and contains no old
  Thirukural-only layout or personal-name prompt.
- Validate the workflow YAML and run a static/local generation path before
  considering the replacement complete.

## Out of scope

- GitHub API authentication or private contribution data.
- Hosted third-party stats cards.
- JavaScript in the README.
- Unrelated application code or a web frontend.

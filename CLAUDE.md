# Kiln: agent notes

Kiln is an 8x8 block puzzle for phones (vanilla HTML, CSS and ES modules, no build step,
no dependencies), installable as a PWA and deployed to GitHub Pages.

Read before changing behaviour:
- `docs/game-design.md`: design goals and game rules (level types, scoring, gems, pieces).
- `CONTRIBUTING.md`: code, copy and commit conventions. Follow them.

## Commands

- Run: serve the folder (`python3 -m http.server`); `file://` does not work (ES modules).
  The service worker caches files, so after an edit reload twice, or bypass it in DevTools.
- Test: `node --test` (not `node --test tests/`, which fails on Node 26).
- Balance: `node tools/sim.mjs [levels] [runs] [types]`, e.g. `node tools/sim.mjs 3,25,50 3 gems`.

## Files

- `index.html`: markup and PWA meta. `style.css`: all styles.
- `src/core.js`: all game rules, pure (no DOM, no storage). Tested in `tests/core.test.mjs`.
- `src/ui.js`: language, state, saving, rendering, drag input, animations, sheets.
- `lang/`: all visible text. `languages.json` maps codes to own-language names;
  `<code>.json` holds flat `"key": "text"` pairs with `{placeholders}`. `tests/lang.test.mjs`
  checks every file against `en.json` and that `src/ui.js` uses exactly the `en.json` keys.
- `tools/sim.mjs`: greedy bot over the core API.
- `fonts/`: Bricolage Grotesque variable woff2 subsets (latin, latin-ext, vietnamese) with
  its SIL OFL license (`fonts/OFL.txt`, must ship with the files). `@font-face` rules are at
  the top of `style.css`. No third-party requests anywhere.
- `manifest.webmanifest`, `sw.js`, `icons/`: PWA. `icons/icon.svg` is the source; the PNGs
  are renders of it (192, 512, maskable 512 at 80% scale, 180 for Apple).
- `.github/workflows/pages.yml`: runs `node --test` on pull requests and pushes; on push to
  `master` it then deploys the site files to https://thomaslazar.github.io/kiln/. New site
  files must be added to its copy step and, if needed offline, to `SHELL` in `sw.js`.
- `.github/pull_request_template.md`: checklist, including one for translations.
- `docs/superpowers/`: the original spec and plan for level types, gems and score.

## Core (`src/core.js`)

Sections are marked `/* ---------- name ---------- */`.

- **random**: `mulberry32` PRNG and integer `hash`; everything derives from them.
- **shapes**: `BASE` piece families, `variants()` rotations and mirrors into `SHAPES`.
  `CAT` per family: `s`/`m`/`l` size, `x` filler (single, diagonals). `share` spreads a
  family's weight over its variants.
- **board helpers**: board is `color[64]` (`0` empty, `1..5` glaze) plus `gem[64]` (`0`
  none, `1..5` ruby, sapphire, emerald, amber, amethyst). Solvers use `occOf` occupancy:
  `fits`, `placeOcc`, `fullLines`, `anyFit`, `canClear`, and `solvable(occ, pieces,
  budget)` (DFS over orders and positions with clears; over budget counts as solvable).
- **difficulty & levels**: `difficulty(level, fails)` gives `d` in 0..1 (ramp plus a
  5-level sawtooth, eased by 0.18 per fail from the 4th). `levelType(level)` is cached and
  depends on the level only. `startsEmpty(level)`. `makeLevel(level, fails, salt, type)`
  places starting blocks (count from `difficulty(level, 0)`, exact fill) and builds the
  goal: `{type:'score', need}` or `{type:'gems'|'rush', targets:[{g, need}]}`.
- **fair dealing**: `weightFor` (size by fill and `d`, filler only above 45% fill, 3x3
  doubled), `activeGems(S)`, `deal(S)` (three pieces `{s, c, g}`, `g[j]` = gem per cell;
  always passes `solvable`; fallbacks to small pieces, then three singles; gem levels
  never deal a tray without gems while a colour is open). `startState(level, fails, salt,
  type)` builds a fresh level state with its first tray.
- **moves**: `linePoints(n)`, `resolveMove(S, i, r, c)` places, finds lines, updates
  score, combo, idle and `got`, and returns `{placed, cleared, freed, lines, points,
  fullClear}` without emptying cells; `clearCells(S, cells)` empties them; `won(S)`.
- **saves**: `fromV1(old)` keeps `level, best, lines`; `validSave(s)` checks a v2 save.

## UI (`src/ui.js`)

- Language: top-level `await` loads `lang/languages.json`, then `setLang(code)` merges
  `en.json` with the chosen file into `T`. Choice: saved `localStorage['kiln-lang']`, else
  the first `navigator.languages` match, else English. `t('key', {n})` fills placeholders.
  Never put visible text in code; add a key to every `lang/*.json` instead.
- `S` is saved whole to `localStorage['kiln-v2']` after every move. `load()` falls back to
  `fromV1` for broken v2 saves and for old `kiln-v1` saves.
- Rendering by class names on 64 `.cell` > `.t` elements (`f`, `gem` + `data-gem`,
  `ghost`, `hint`, `land`, `pop`). Goal row: score bar, or gem chips from `renderChips()`.
- Drag: pointer capture on tray slots; the piece floats above the finger; position is the
  rounded cell under its top-left.
- `placePiece`: `resolveMove`, freed gems fly to their chips (`flyGems`, at most 8, chip
  counts lag via `flying[]`), clears animate 300 ms, then `clearCells`, new tray when
  empty, `afterMove` checks win and loss. Bonus toasts only in score levels.
- Reduced motion: no flights, toasts show statically.

## Working rules

- Always ask before committing. Never add `Co-Authored-By:` or "Generated with" lines to
  commits or PR bodies.
- Rerun `node --test` and the sim after rule or balance changes.

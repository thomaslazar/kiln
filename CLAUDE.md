# Kiln: agent notes

Kiln is an 8x8 block puzzle for phones (vanilla HTML, CSS and ES modules, no build step,
no dependencies), installable as a PWA and deployed to GitHub Pages.

Read before changing behaviour:
- `docs/game-design.md`: design goals and game rules (level types, scoring, gems, pieces).
- `CONTRIBUTING.md`: code, copy and commit conventions. Follow them.

## Commands

- Run: serve the folder (`python3 -m http.server`); `file://` does not work (ES modules).
  The service worker is network first (revalidates past the HTTP cache, 3 s timeout, cache
  only as offline fallback), so an edit or a deploy shows on the next load. If `sw.js`
  changes how it caches, rename `CACHE` so `activate` drops the old cache.
- Test: `node --test` (not `node --test tests/`, which fails on Node 26).
- Balance: `node tools/sim.mjs [levels] [runs] [types]`, e.g. `node tools/sim.mjs 3,25,50 3 gems`.

## Files

- `index.html`: markup and PWA meta. `style.css`: all styles.
- `src/core.js`: all game rules, pure (no DOM, no storage). Tested in `tests/core.test.mjs`.
- `src/theme.js`: pure chapter looks (no DOM). Tested in `tests/theme.test.mjs`; chapters and
  looks in `tests/chapters.test.mjs`.
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
  goal: `{type:'score', need}` or `{type:'gems'|'rush', targets:[{g, need}]}`. Targets come
  from `difficulty(level, 0)` times `ease` (-10% per fail from the 4th, floor 60%); the
  eased `d` only drives piece weights in `deal`.
- **chapters**: `chapterOf(level)` gives `{n, start, length}` (chapter 1 = 1-40, later
  `30 + hash(k) % 11`, cached). `difficulty` is chapter aware: later chapters start at the
  base of level `10 + hash(k) % 6` and ramp to 0.75 over 70% of the chapter; the 5-level
  wave stays global. `levelLook(level)` gives `{mode: normal|mono|pattern, pattern}` from
  the level only (raw split 62/19/19, about 72/14/14 after the no-two-specials rule).
- **fair dealing**: `weightFor` (size by fill and `d`, filler only above 45% fill, 3x3
  doubled), `activeGems(S)`, `deal(S)` (three pieces `{s, c, g}`, `g[j]` = gem per cell;
  always passes `solvable`; fallbacks to small pieces, then three singles; gem levels
  never deal a tray without gems while a colour is open). `startState(level, fails, salt,
  type)` builds a fresh level state with its first tray.
- **moves**: `linePoints(n)`, `resolveMove(S, i, r, c)` places, finds lines, updates
  score, combo, idle and `got`, and returns `{placed, cleared, freed, lines, points,
  fullClear}` without emptying cells; `clearCells(S, cells)` empties them; `won(S)`.
- **continues**: `rescueTray(S)` beam-searches three pieces that clear the most lines
  (2+ on stuck boards) and adds gems via `gemTray`, the same helper `deal` uses.
  `comboContinue(S, m)`, `levelContinue(level, best)`, `freeContinue(S)` are the earn and
  offer rules. `S.continues` (bank, kept across levels) and `S.freeLevel` (level whose free
  continue was used) are optional in saves.
- **saves**: `fromV1(old)` keeps `level, best, lines`; `validSave(s)` checks a v2 save.

## UI (`src/ui.js`)

- Language: top-level `await` loads `lang/languages.json`, then `setLang(code)` merges
  `en.json` with the chosen file into `T`. Choice: saved `localStorage['kiln-lang']`, else
  the first `navigator.languages` match, else English. `t('key', {n})` fills placeholders.
  Never put visible text in code; add a key to every `lang/*.json` instead.
- Theme: `applyTheme()` sets CSS variables per chapter and colour scheme (live switching).
  `gemHTML(g)` draws SVG gems (60% of a tile, chips 15px; colours via style attributes for
  Safari). `tileColour(v, gem, r, c, where)` picks normal, mono or pattern colour, applies
  `safeTile`, and uses neutral pieces in pattern levels. Header `#chap` always shows the
  chapter; the win sheet adds `chapterBegins` on a chapter's last level.
- `src/theme.js`: `chapterTheme(n)` (chapter 1 is the classic look; `theme.neutral` is
  `{light, dark}`), `SYMBOLS` (13 paths), `symbolSVG`, `hueGap`, `safeTile`, `monoTile`,
  `patternPos`, `patternColour`. Draw order in `chapterTheme` is fixed: changing it
  changes every chapter's look.
- `S` is saved whole to `localStorage['kiln-v2']` after every move. `load()` falls back to
  `fromV1` for broken v2 saves and for old `kiln-v1` saves.
- Rendering by class names on 64 `.cell` > `.t` elements (`f`, `gem` + `data-gem`,
  `ghost`, `hint`, `land`, `pop`). Goal row: score bar, or gem chips from `renderChips()`.
- Drag: pointer capture on tray slots; the piece floats above the finger; position is the
  rounded cell under its top-left.
- `placePiece`: `resolveMove`, freed gems fly to their chips (`flyGems`, at most 8, chip
  counts lag via `flying[]`), clears animate 300 ms, then `clearCells`, new tray when
  empty, `afterMove` checks win and loss. Bonus toasts only in score levels.
- Sheets: `showSheet(title, text, buttons, extra, dismiss)`; `dismiss` sheets (menu, Info,
  start-over question, share fallback) close on a tap outside or Escape, win and loss
  sheets never do. Menu: keep playing, new layout, start over, Info. `openInfo()` holds
  "Share Kiln", the GitHub link, the language dropdown and Back.
- "Share Kiln": `share()` uses `navigator.share` (title, `shareText`, page URL without
  query), else copies the URL (`linkCopied` toast), else shows it as selectable sheet text.
- Continues: every reward calls `earnContinue()`. On a loss with a free or banked
  continue, `afterMove` previews `rescueTray(S)` in `#sheetExtra` (via `showSheet`'s 4th
  argument) next to "Try again".
- Reduced motion: no flights, toasts show statically.
- No zoom: viewport `maximum-scale=1, user-scalable=no`, `touch-action:none` on `body`
  (no double-tap zoom), and Safari `gesturestart`/`gesturechange` are cancelled (iOS ignores
  `user-scalable`). Phones held sideways (`orientation:landscape` and height ≤ 500px) see
  `#turn` ("turnPhone") instead of the game; the manifest locks portrait where supported.

## Working rules

- Always ask before committing. Never add `Co-Authored-By:` or "Generated with" lines to
  commits or PR bodies.
- Rerun `node --test` and the sim after rule or balance changes.

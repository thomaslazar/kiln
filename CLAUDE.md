# Kiln: handover notes

Kiln is an ad-free 8x8 block puzzle for phones (Block Blast style: drag pieces onto the
board, full rows and columns clear). It is a personal hobby project, built for fun, with
endless generated levels that never strand the player through bad luck.

Vanilla HTML, CSS and JS, no build step, no dependencies. It was first built in a
Claude.ai chat and published as an artifact; this repo is where it continues.

- `index.html`: markup only.
- `style.css`: all styles.
- `src/core.js`: pure game logic (ES module, no DOM, no storage).
- `src/ui.js`: state, rendering, input, sheets. Imports from `core.js`.
- `tools/sim.mjs`: balance bot, imports `src/core.js` directly.

## Running it

- Serve the folder with any static server (`npx serve .` or `python3 -m http.server`).
  Opening `index.html` from `file://` does not work, because browsers block ES modules
  there.
- Test touch input on a real phone or with device emulation in DevTools.
- `node --test` runs the unit tests in `tests/` (not `node --test tests/`, which fails on Node 26).
- `node tools/sim.mjs [levels] [runs] [types]` runs the balance bot for every level type (see Balancing below).

## Design goals (keep these)

1. No ads, no accounts, no network calls apart from the Google Font.
2. Endless levels, one after another, each with a small goal.
3. Fairness: losing should come from the player's moves, never from the piece dice.
4. Failing a level makes the retry easier from the 4th fail on (lower targets), so nobody is stuck on one level.
5. Short, plain UI copy in sentence case.

## How the code is organised

Sections are marked with `/* ---------- name ---------- */` comments. `src/core.js` holds
random, shapes, board helpers, difficulty & levels and fair dealing; `src/ui.js` holds
the rest:

- **random**: `mulberry32` seeded PRNG and an integer `hash`. Everything random is seeded,
  so a level is reproducible from `(level, fails, salt)`.
- **shapes**: `BASE` lists piece families; `variants()` generates all unique rotations and
  mirrors. `CAT` tags each family as small, medium or large (`s`/`m`/`l`) for weighting,
  or filler (`x`: single and diagonal pair), which is only dealt once the board is more
  than 45% full (or by the fallbacks).
  `share` spreads a family's weight across its variants so families with many rotations
  are not overrepresented.
- **board helpers**: the board is a flat array of 64 numbers. `0` empty, `1..5` glaze
  colours of placed pieces (there are no stone blocks). Gems are a separate `gem[64]`
  array: `0` none, `1..5` ruby, sapphire, emerald, amber, amethyst. Gems ride on tiles and
  are freed when their row or column clears; pieces can carry gems too (`g[j]` per cell). Solver functions work on a `Uint8Array` occupancy copy (`occOf`).
  - `fits`, `placeOcc` (places and clears lines), `fullLines`, `anyFit`, `canClear`.
  - `solvable(occ, pieces, budget)`: depth-first search over piece orders and positions,
    including line clears between placements. If it exceeds the node budget it returns
    `true` (a board with that many options is almost certainly fine).
- **difficulty & levels**:
  - `difficulty(level, fails)` returns `d` in 0..1. Slow ramp capped at 0.75 by level 50,
    plus a 5-level sawtooth where every 5th level dips. Fails 1 to 3 retry at the same difficulty; each fail from the 4th subtracts 0.18.
  - `levelType(level)`: levels 1-2 are always `score`; later a seeded pick of `score`,
    `gems` or `rush` (from level 6), never three of the same in a row.
  - `makeLevel` puts glazed blocks on the board up to a density of `0.04 + 0.2*d` (some
    levels start empty), never completing a line. Goals:
    - `score`: reach `round10(100 + 2900*d^2)` points.
    - `gems`: 1 to 5 colours, picked per level from a hash of the level number (stable on
      retry). A budget of `10 + 18d` gems is split evenly across them, at least 2 each
      (early: 1x10 or 5x2, late: 1x27 or 5x6). Gems sit on
      about a quarter of the blocks, and dealt pieces carry a gem with 1/2 chance. A tray
      always has at least one gem while a colour is still open.
    - `rush`: free up to `min(400, round10(40 + 380d))` gems of one colour; every piece
      cell is dealt carrying that colour.
  - Scoring (`resolveMove`): 1 point per cell placed, `10*n*(n+1)/2` for `n` lines times a
    combo multiplier, +300 for a full board clear. The combo grows with each clearing move
    and resets after 3 moves without a clear. The Double, Triple, Combo
    and Board clear toasts only show in score levels, since they announce bonus points.
- **fair dealing**: `deal(S)` draws three weighted pieces (it reads `S.seed`, `S.d`,
  `S.color` and advances `S.deals`). Large pieces get rarer as the
  board fills, small ones more common. It rejects any set that `solvable` says cannot all
  be placed, and when the board is above 40% full it usually requires one piece that can
  complete a line. Fallbacks: small fitting pieces, then three singles (which always fit).
- **state**: one object `S`, saved to `localStorage` under `kiln-v2` after every move.
  Fields: `level, fails, salt, best, lines` plus `startState`: `seed, d, type, color, gem, goal,
  got, score, combo, idle, deals, tray`. `got[g]` is the freed count per gem colour.
  `tray` holds `{s: shapeIndex, c: colourIndex, g: gemPerCell}` or `null`. A `kiln-v1` save
  migrates progress only (`fromV1`); `validSave` rejects malformed v2 saves. The shape index depends on the
  order of `BASE` and `variants()`, so changing either invalidates saved trays: bump the
  storage key or add a migration if you do.
- **rendering**: DOM grid of 64 `.cell` elements, each containing a `.t` tile. State is
  rendered by class names (`f`, `gem` with `data-gem="1..5"`, `ghost`, `hint`, `land`, `pop`).
- **drag**: pointer events on the tray slots with pointer capture. The dragged piece floats
  above the finger (`lift`) so it is not hidden by the thumb; the board position is the
  rounded cell under the piece's top-left corner. `ghost` shows placement, `hint`
  highlights lines that would clear.
- **moves**: `placePiece` applies the move, animates clears (300 ms, skipped with reduced
  motion), deals a new tray when all three are used, then `afterMove` checks win and loss.
  Gems that count (`resolveMove(...).freed`, at most 8 per move) fly from their tile to
  their goal chip (`flyGems`, Web Animations API); the chip count lags via `flying[]`
  until each gem lands. Skipped with reduced motion.
- **sheet & menu**: one bottom-sheet dialog reused for win, loss and the menu.

## Visual design

Glazed ceramic tiles on a cool stone board. Colours are CSS custom properties on `:root`
with a dark-mode set under `prefers-color-scheme`. The `[data-theme]` selectors exist only
because the Claude.ai artifact viewer can force a theme; they can stay or go.
Font: Bricolage Grotesque (Google Fonts) with system fallbacks. The level number is the
one large typographic element; the rest is kept quiet on purpose.

## Balancing

`tools/sim.mjs` imports `src/core.js` and runs a bot that picks moves greedily while checking the rest of
the tray stays placeable. Current result: the bot wins nearly every level from 3 to 85,
and the slowest deal takes about 10 ms. A human loses sometimes, which is the intended
feel: relaxed, not punishing. Rerun the sim after any change to weights, density or goals.

## Suggested next steps

1. Make it an installable PWA: `manifest.webmanifest`, icons, a small service worker for
   offline play.

## Conventions

- No frameworks or build step unless a feature truly needs one.
- No em-dashes in UI copy or docs. Use typographic apostrophes (’) in visible text.
- Keep everything seeded and deterministic so levels can be reproduced and debugged.
- Any change that could affect fairness must keep the `solvable` check in `deal()`.

## Git

- Always ask before committing.
- Commit messages follow Conventional Commits: `type: subject`.
  - Types: `feat` (new feature), `fix` (bug fix), `docs` (docs only), `test` (tests),
    `ci` (CI config), `refactor` (no behaviour change), `chore` (maintenance).
  - Subject: imperative, lowercase, no period, about 72 characters max.
    Example: `feat: add gem goal to early levels`.
  - Body (optional): explain why, not what. Wrap at 72 characters.
- Never add `Co-Authored-By:` or "Generated with Claude Code" lines to commit messages
  or PR bodies.

# Endless mode

Date: 2026-11-22

## Intent

Some players do not want goals; they want one long board and a high score to beat, with the
big combos that come with it. Kiln already has everything such a mode needs (score levels,
combo multiplier, fair dealing). Endless mode puts them on a board without a target, next to
the levels, so a player can switch between the two at any time.

The owner’s view of these modes: sometimes a run goes really well, a long combo lands, and
the player then struggles to reach that score again. That is the appeal, so there is no
balancing work beyond picking one difficulty.

Success: a player opens the menu, switches to Endless, plays a run until no piece fits, sees
their score against their best, and starts again. Their level progress is untouched, and
switching back puts them exactly where they left off.

## Goals

1. An endless run: empty board, fair dealing at a flat difficulty, score-level scoring, no
   target, ends when no tray piece fits.
2. Best score and best combo kept for the mode.
3. Each mode keeps its own board; switching in the menu resumes it. The game opens in the
   mode played last.
4. A one-time welcome card: existing players learn that Endless exists and where it is; new
   players pick which mode to start.
5. A fresh look each run.

## Non-goals

- Difficulty that changes during a run, waves, or any balancing beyond `d` = 0.75.
- Continues in Endless (banked or free), or earning continues there.
- Gems, starting blocks, level numbers or chapters in Endless.
- Leaderboards, sharing a score, run history.
- A mode picker shown on every launch.

## Anti-goals

- Anything that can lose or change a player’s level progress or level save.
- Breaking the fairness promise: every tray must still be placeable in some order.
- Visible text in code (all copy in `lang/*.json`).

## Constraints

- Vanilla ES modules, no build step, no dependencies. Rules stay pure in `src/core.js` and
  are tested in `tests/core.test.mjs`; `tests/lang.test.mjs` checks keys.
- New text goes into every `lang/*.json` file (`en`, `de`).
- `CLAUDE.md` and `docs/game-design.md` are updated to describe the mode.

## Approaches

- **A. Two saves, one live state (chosen).** The level save stays as it is in `kiln-v2`.
  Endless has its own save `kiln-endless`. `ui.js` keeps the current mode in `kiln-mode` and
  points `S` at the live state, so the move code (`resolveMove`, `deal`, `clearCells`) works
  unchanged. Cost: a second save validator. Benefit: nothing about existing saves changes.
- B. One save holding both modes. Needs a migration of every existing save; a bug there could
  cost level progress. Rejected for that risk.
- C. Endless as a fourth level type through `makeLevel`. Least code, but only one board can
  be saved, so switching would throw away the other mode’s board. Rejected.

## Rules (decided)

- **Start:** empty board (`color` and `gem` all 0), `d` = 0.75 for the whole run. The owner
  chose 0.75 because it is the ceiling levels reach. A bot spike (8 runs per value, 3000-move
  cap) showed `d` barely changes run length (median 1,200 to 2,000 moves for `d` 0.25 to 1);
  runs vary from about 50 moves to past 3000 with the greedy bot.
- **Dealing:** `deal(S)` as it is: fair (`solvable`), piece weights from `d` and fill, the
  line-clear help when the board is over 40% full. No gems: `activeGems` must return `[]`.
- **Scoring:** as score levels: 1 per cell, `linePoints(n)`, combo multiplier with the
  two-misses grace, +300 board clear. The bonus toasts (Double, Triple, Combo, Board clear)
  show, as in score levels.
- **Never won.** `won(S)` is false for an endless run.
- **End:** when no piece in the tray fits (`anyFit`), the run is over. No continue offer.
- **Bests:** `best` (score) and `bestCombo` (highest combo reached in any run) are kept with
  the endless save and survive new runs. They update when the run ends (or live, builder’s
  call, as long as the run-over sheet can tell that a best was beaten).
- **No continues:** neither the bank nor the free continue is used or shown; combo streaks in
  Endless do not call `earnContinue()`.

## Look (decided)

- Each run draws a chapter look and a level look from its run seed, and keeps them for the
  whole run (saved with the run, so a reload looks the same).
- Chapter look: any `chapterTheme(n)`; the run picks `n` from its seed. Chapter 1 (classic)
  is one of the possible picks.
- Level look: normal, one colour (mono) or pattern (with one of the four patterns), as in
  levels. Builder’s call on the exact split; roughly 70/15/15 matches levels after their
  no-two-in-a-row rule. Pattern runs draw tray pieces neutral, as pattern levels do.
- `applyTheme()` and `tileColour()` read the chapter number and look from the live mode
  instead of `chapterOf(S.level)` and `levelLook(S.level)`.

## Switching (decided)

- The menu gets one entry to switch: “Endless” while in levels, “Levels” while in Endless.
- The game opens in the mode last played (`kiln-mode`). Each mode resumes its own board,
  tray, score and combo.
- Switching to Endless with no saved run (or after a finished run) starts a new run.
- In Endless, “New layout” becomes “New run” (abandons the current run; its score still
  counts toward the best if higher, builder’s call whether to ask first) and “Start over” is
  not shown (it is about level progress). Info stays.
- Menu stats in Endless: best score and best combo instead of best level, lines and
  continues.

## Screen in Endless (proposal, builder may adjust)

- Header: “Endless” where the level number sits (same large style), with the best score
  where the chapter label sits.
- Goal row: current score, and the current combo when it is above 0. No progress bar.
- Run-over sheet (does not close on a tap outside, like the loss sheet): title “Run over”,
  the score, best score and best combo, with “New best” when beaten. Buttons: “New run”
  (primary) and “Levels”.

## Welcome cards (decided)

Shown once, on the first launch of the version with Endless. A flag in `localStorage`
(`kiln-` prefix) records that it was shown; whichever card is shown sets it.

- **Existing players** (a level save or old `kiln-v1` save exists): “New: Endless mode”, one
  or two lines on what it is and that it is in the ⋯ menu. Buttons “Try it” (switches to
  Endless) and “Later”. Closes on a tap outside or Escape, like Info.
- **New players** (no save at all): a short explanation of both modes, one line each, and
  that they can switch any time in the ⋯ menu. Buttons “Levels” and “Endless”; the choice
  starts that mode. Does not close on a tap outside: a choice is needed.
- Copy is drafted by the builder in the existing tone (short, sentence case, typographic
  apostrophes, no em-dashes), English and German; the owner reviews it.

## Settled after review (Claude’s calls, owner to check)

- Chapter looks a run can draw: any chapter 1 to 50, also ones the player has not reached
  yet in levels (looks are not a reward there, and a wider pool means more variety).
- Reload after a run ended: the run-over sheet shows again (the startup check already does
  this for a stuck board).
- Welcome card on a stuck level board at launch: the loss sheet comes first, the card after
  it is closed.
- “Easier retries” only ever changes the level save, never an endless run.
- Level-only code in `ui.js` (first-level hint, chapter lookups, `S.level` reads) is guarded
  so it never runs on an endless state.

## Left to the builder

- Shape of the endless state and `validEndless` (it can reuse the level state fields:
  `color, gem, tray, score, combo, idle, deals, seed, d, got`, plus `goal`, `best`,
  `bestCombo`, `chapter`, `look`). Whatever lets `resolveMove`, `deal` and `clearCells`
  run unchanged.
- How `won`, `activeGems`, `comboContinue` and the toasts recognise an endless state (a
  `type:'endless'` and goal, or a flag).
- The run seed source (not from level numbers; the UI may use the clock or
  `crypto.getRandomValues`). `src/core.js` itself stays deterministic from the seed.
- Whether Endless lines count toward the level “Lines cleared” stat (proposal: no).
- A sim option for endless runs is not required.
- Tests: `startEndless` (empty board, `d`, look in range, tray solvable), `validEndless`
  (accepts a fresh state, rejects broken ones), `won` false, no gems dealt.

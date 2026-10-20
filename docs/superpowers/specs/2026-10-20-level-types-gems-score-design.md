# Level types, coloured gems and score

Date: 2026-10-20

## Intent

Kiln today has two goals: clear N lines, or free N gems sitting on grey stones. After a
while every level feels alike. The owner wants the variety of the block game they used to
play: score levels with combos, levels where you collect a few gems of several colours,
and long "gem rush" levels where every piece carries gems. The game stays relaxed and
endless; the mix of level types is what keeps it from getting boring.

Success: playing ten levels in a row feels varied, combos and full clears feel rewarding,
and nobody gets stuck because of the piece dice or a grindy goal.

## Goals

1. Three level types, mixed by the level generator (no mode picker):
   - **Score**: reach a target score. No gems anywhere.
   - **Gem goals**: free a small number of gems in 1 to 5 colours, each colour with its
     own target (for example 6 ruby, 4 sapphire, 3 emerald). Harder levels mean higher
     targets and more colours.
   - **Gem rush**: free a large number of gems of one colour. Every piece carries gems.
2. Score with combos and a full-clear bonus.
3. Five gem colours, each with its own shape.
4. Pre-placed blocks become normal coloured tiles (no more grey stone). Pre-placing is
   optional: some levels start empty.
5. Retries only get easier after about 4 failed attempts.

## Non-goals

- A mode picker or separate progress per mode. One endless level sequence.
- A bonus for clearing an 8x5 block. Dropped by the owner; multi-line clears already
  reward it.
- Changes to the piece set. The 14 families and their weights stay.
- Leaderboards, accounts, network calls.

## Anti-goals (would be a failure even if it works)

- A deal that cannot be placed. The `solvable` check in `deal()` stays for every type.
- A gem level that cannot be finished, or that drags because the right gems stop coming.
- Score numbers that feel inflated. Targets start around 100 and never go much above
  2000 to 3000.
- Gems that are hard to tell apart on a phone or for colour-blind players.

## Constraints

- No frameworks, no build step, no new dependencies.
- Everything seeded: a level, its type, its pre-placed tiles, gems and deals are
  reproducible from `(level, fails, salt)`.
- Pure logic goes in `src/core.js` (no DOM), so `tools/sim.mjs` can test it.
- UI copy in sentence case, no em-dashes, typographic apostrophes.
- Reduced motion is respected for any new animation or toast.

## Design

### Level types and the generator

- The level type is picked from the level seed. Owner's wish: mix them so it is not
  boring.
- *My call:* levels 1 and 2 are score levels (they teach the basics). Gem goals unlock at
  level 3, gem rush around level 6. After that the generator mixes all three, roughly
  even, and never gives the same type three times in a row. A retry keeps the type.
- *My call:* the type comes from a hash of the level number only (not `fails` or
  `salt`), so retries and "New layout" keep it. The three-in-a-row rule is checked
  against the types of the two previous levels.

### Pre-placed tiles

- Pre-placed tiles use the normal glaze colours 1 to 5 instead of stone (value `9` goes
  away). They clear like any placed tile and still never complete a line on their own.
- Some levels have no pre-placed tiles at all. *My call:* about 30% of levels, plus
  level 1. Density for the rest stays `0.04 + 0.2*d`, so harder levels start with more
  blocks.
- Owner's rule: the block count is fixed per level. It uses the level's difficulty
  without failures (`fails = 0`), so it never changes on retry. Every retry and every
  "New layout" places the same number of blocks in new spots (the seed already includes
  `fails` and `salt`). Whether a level starts empty also depends on the level number
  only, so an empty level stays empty.
- Gems on pre-placed tiles depend on the type: none in score levels, a few in gem goals
  levels, every pre-placed tile in gem rush.

### Gems

- A gem sits on one tile cell. Its colour is separate from the tile colour.
- A gem is freed when its tile is cleared as part of a full row or column, and it counts
  toward its colour's target.
- Only target colours appear. Once a colour's target is met, no new gems of that colour
  spawn in pieces. Gems of that colour already on the board just clear without counting.
- **Gem goals:** some tray pieces carry 1 or 2 gems (owner's estimate); tuned to one piece
  in two. After playtesting, the owner found early gem levels boring (1 colour, 2 gems),
  so each level now picks 1 to 5 colours from the level number (sometimes many colours
  with small counts, sometimes one colour with a big count), and a gem budget of about
  10 early to 27 late is split across them, at least 2 per colour.
- **Gem rush:** every cell of every piece carries a gem of the one target colour.
  Target varies with difficulty; 400 is near the top. *My call:* about 40 to 400; owner asked for shorter rush levels that stay the longest type.
- Colours and shapes (owner picked "own shape per colour" from mockups):
  ruby `#FF4D6D` diamond, sapphire `#4CC2FF` circle, emerald `#4BE08A` triangle,
  amber `#FFC83D` star, amethyst `#C792FF` hexagon. Each gem has a thin dark outline so it
  reads on any tile colour. Dark-mode tweaks are left to the builder.
- The goal row shows one chip per target colour: gem shape, then `freed / need`. A
  finished colour is dimmed and struck through.

### Score

Owner's rules: multiple lines at once score more, a combo counter rises with successive
clears and survives one or two placements without a clear, and a full clear gives a
bonus. Starting numbers (*my guesses, tune with the sim*):

- Placing a piece: 1 point per cell.
- Lines cleared in one move: 1 = 10, 2 = 30, 3 = 60, 4 = 100, n = `10 * n * (n + 1) / 2`.
- Combo: each clearing move raises the combo by 1 and multiplies that move's line
  points by the combo. Two placements without a clear keep the combo; the third resets
  it to 0.
- Full clear (board empty after a clear): +300.
- Score target grows with difficulty: about 100 on early levels, at most 2000 to 3000.
- Score drives only score levels. *My call:* gem levels do not show a score. Score and
  combo reset at the start of every level and every retry.
- Feedback: a "Combo 3" style toast next to the existing "Double" and "Triple" toasts,
  and a "Board clear" toast. Short, sentence case. Owner's rule: these toasts announce
  bonus points, and gem levels have no points, so all of them only show in score levels.

### Difficulty and failing

- Owner's rule: only make the game easier after about 4 or 5 failed attempts.
- *My call:* the first 3 failures give a fresh layout at the same difficulty. From the
  4th failure on, each failure lowers `d` by 0.18: `d - 0.18 * max(0, fails - 3)`.
- Owner's rule: easing comes from lower targets, never from fewer starting blocks. A
  lower `d` lowers the score target and the gem targets. It also keeps its current
  effect on piece weights in `deal()` (more small pieces).
- *My call:* the number of gem colours in a gem goals level stays the same on retry;
  only the count per colour drops.
- The loss sheet text changes to match (it currently promises an easier retry).
- Update design goal 4 in `CLAUDE.md`.

### Saved games

- The save format changes (tray pieces carry gems, goals change, stone goes away), so
  the storage key moves to `kiln-v2`.
- *My call:* on first load, read `level`, `best` and `lines` from `kiln-v1` if present,
  start that level fresh, and remove the old key.

### Balancing

- Extend `tools/sim.mjs` to play all three types and report win rate and slowest deal per
  type. Target: the bot wins nearly every level, the slowest deal stays around 10 ms.
- `makeLevel` gets an optional way to force the level type so the sim can test each
  type. The sim's 300-move cap goes up for long gem rush levels.
- Rerun after tuning gem frequency, score points and targets.

## Left to the builder

- Data shapes (how gems live on tray pieces and on the board, how goals are stored).
- Exact numbers for type mix, gem frequency, targets and score points, within the ranges
  above and guided by the sim.
- HUD layout details beyond the chip row described above, and dark-mode gem colours.
- Code structure inside `src/core.js` and `src/ui.js`.

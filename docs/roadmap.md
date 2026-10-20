# Roadmap

What might come next. Nothing here is promised; order can change.

## Next: chapters (in design)

Agreed so far:

- Levels are grouped into chapters of about 30 to 40 levels, so the look does not change
  too often. Chapter 1 is roughly levels 1 to 40 with today’s look.
- Each later chapter has its own generated look, seeded by the chapter number: background,
  board, tile colours, tile roundness, glaze shine, button colour, and its own five gem
  symbols (from a pool of 13 shapes) drawn in one style (jewel, matte, line, duotone or
  glow). Colours come from classic colour schemes in OKLCH with fixed lightness and
  saturation bands, so every set is harmonious and readable in light and dark mode.
- A gem never sits on a tile whose colour is too close to its own.
- Difficulty drops noticeably at the start of a chapter (not back to level 1, roughly
  mid-game), with lower targets and fewer gems, then ramps up slowly again.
- The goal text stays “Free the gems”.

Still open: the exact difficulty curve, how a new chapter is announced, and whether the
chapter number shows next to the level.

## Ideas, not decided

### Treat levels

Occasional short, clearly easier or more rewarding levels that break the rhythm.
Researched on 2026-10-20; the owner is not convinced yet.

What other games do: Royal Match has a bonus level at the end of each area (about every
10 levels) and labels hard levels; Candy Crush puts easy levels after hard ones and pays
out leftover moves; design writing describes a sawtooth difficulty curve whose valleys
are for relief and rewards.

Ideas that fit Kiln (no timers, fair, existing pieces):

- **Lucky trays:** every tray holds a piece that completes a line, plus extra 3x3s.
- **Combo playground:** rows that each miss one gap, and bars to fill them, for easy big
  combos.
- **Gem shower:** many gems of one colour on a mostly empty board, with a generous goal.
- **Prize level:** short and easy, with a continue as the prize, shown up front.
- **Victory lap:** right after the hardest stretch, a tiny target on a half-empty board.
- A small “Treat” badge next to the level number, so players know a break is coming.

A first version could make every 10th level a treat, rotate three of these types, and
pay a continue for each. Any treat type must pass the sim (the bot wins every one).

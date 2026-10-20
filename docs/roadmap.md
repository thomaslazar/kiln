# Roadmap

What might come next. Nothing here is promised; order can change.

## Done

- Chapters: difficulty waves and generated looks (see `docs/game-design.md`).

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

# Game design

Kiln is an ad-free 8x8 block puzzle for phones in the Block Blast style: drag pieces onto
the board, and full rows and columns clear. Levels are generated endlessly, one after
another, each with a small goal.

## Design goals

1. No ads, no accounts, no network calls to anyone else: every file, including the
   font, comes from the game’s own site.
2. Endless levels, one after another, each with a small goal.
3. Fairness: losing should come from the player’s moves, never from the piece dice.
   Every tray of three pieces can be placed in some order.
4. Nobody gets stuck on one level. Help comes in steps: continues are always on offer
   when a player has one, a free continue arrives after 2 fails, and from the 4th failed
   attempt on each retry has lower targets. The starting blocks never get fewer, they
   only move.
5. Short, plain UI copy in sentence case.
6. Relaxed, not punishing. A human loses sometimes; the balance bot wins nearly always.

## Level types

The generator mixes three types so play stays varied. Levels 1 and 2 are score levels,
gem goals start at level 3 and gem rush at level 6. The same type never comes three times
in a row, and a level keeps its type on retry and on “New layout”.

- **Score**: reach a target score. About 100 to 200 points early, up to about 1900.
  No gems.
- **Gem goals**: free gems of 1 to 5 colours, each colour with its own target. Sometimes
  many colours with small counts, sometimes one colour with a big count. The total grows
  from about 10 gems early to about 27 late. Pieces often carry 1 or 2 gems, and every
  tray has at least one gem while a colour is still open. Once a colour is done, no new
  gems of it appear.
- **Gem rush**: free many gems of one colour, about 40 early up to 400. Every piece
  carries that gem on every cell. The longest level type.

## Board and pieces

- Some levels start empty; the rest start with glazed blocks already placed. The number
  of starting blocks is fixed per level and grows with difficulty. A retry moves them,
  never removes them. Starting blocks never complete a line.
- 15 piece families with all rotations and mirrors: bars of 1 to 5, squares 2x2 and 3x3,
  a 2x3 rectangle, L, T, S/Z, small and big corners, and 2- and 3-block diagonals.
- Large pieces get rarer as the board fills, small ones more common. The single block and
  the diagonals only appear once the board is more than 45% full. The 3x3 square is the
  most common large piece, because it is the most satisfying one to drop.
- When the board is fairly full, a tray usually includes a piece that can complete a line.

## Gems

Five colours, each with its own shape so they read without colour: ruby diamond,
sapphire circle, emerald triangle, amber star, amethyst hexagon. A gem sits on a tile
and is freed when that tile clears as part of a full row or column. Freed gems fly from
the board to their counter in the goal row.

## Continues

When no piece fits, the player can use a continue instead of starting the level again.
The “No room left” sheet shows the three rescue pieces first, so the choice is informed;
“Try again” is always there and never costs anything.

- A continue swaps the stuck tray for three rescue pieces. Board, score and gems stay.
  The rescue pieces are found by search so that they can clear at least 2 lines (as many
  as possible on a hopeless board). The sheet does not promise this.
- Continues bank up with no cap and can be used one after another.
- Earned: +1 for clearing every 5th level the first time (said on the win sheet), +1 for
  every 10 in a combo streak in score levels (“Continue earned”). New rewards should go
  through the same earn function.
- Free: once a level has failed 2 times, one free continue for that level, which does
  not touch the bank.
- The menu shows how many continues the player has.

## Scoring (score levels only)

- 1 point per cell placed.
- Lines cleared in one move: 1 = 10, 2 = 30, 3 = 60, 4 = 100 (`10 * n * (n + 1) / 2`).
- Combo: each move that clears raises the combo by 1 and multiplies that move’s line
  points. Two moves without a clear keep the combo; the third resets it.
- Board clear: +300.
- The “Double”, “Triple”, “Combo” and “Board clear” messages only show in score levels,
  because they announce bonus points.

## Visual design

Glazed ceramic tiles on a cool stone board, light and dark themes. Font: Bricolage
Grotesque with system fallbacks. The level number is the one large typographic element;
the rest is kept quiet on purpose. Animations are skipped with reduced motion, and
messages then show without movement.

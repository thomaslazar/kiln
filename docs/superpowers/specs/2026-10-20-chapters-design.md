# Chapters: difficulty waves and generated looks

Date: 2026-10-20

## Intent

From about level 40 every level type sits at its target ceiling, so the game becomes one
hard level after another, and it always looks the same. The owner wants long chapters
that each feel fresh: a new look, and a difficulty that drops back and climbs again. The
owner’s mum plays this, so it must stay relaxed and readable.

Success: a player at level 120 still gets breathers, notices the move into a new chapter,
and every chapter looks different but tidy.

## Goals

1. Chapters of 30 to 40 levels; chapter 1 is levels 1 to 40.
2. Difficulty drops at the start of each chapter and ramps back up.
3. Each chapter has a generated look: colours, tile style, gem symbols and their style.
4. Single levels sometimes use a one-colour or pattern look.

## Non-goals

- Treat levels (parked, see `docs/roadmap.md`).
- New mechanics or rule changes per chapter.
- Hand-made palettes or a theme picker.
- Renaming gems: the goal text stays “Free the gems”.

## Anti-goals

- A look that is hard to read: gems blending into tiles, low contrast, garish colours.
- A chapter start so easy it feels like level 1, or a jump in difficulty mid-chapter.
- Breaking saves or determinism.

## Constraints

- No dependencies, no build step. Colours as CSS (OKLCH and `color-mix` are fine).
- Everything derives from the level number (and chapter number) via the existing
  `hash`/`mulberry32`; no `Math.random` in `src/`.
- Game rules stay in `src/core.js`; theme generation is pure (no DOM) and testable.
- The `solvable` check in `deal()` is untouched; looks never affect rules.
- Light and dark mode both supported (`prefers-color-scheme`).
- All visible text through `lang/*.json` (English and German).

## Design

### Chapters

- Chapter 1: levels 1 to 40. Chapter k ≥ 2: length `30 + hash(k) % 11` levels (30 to 40),
  following on directly. A pure function maps a level to `{chapter, start, length}`
  (computed iteratively and cached, like `levelType`).
- Existing saves need no migration: the chapter follows from the level.

### Difficulty

- Chapter 1: today’s curve, unchanged.
- Chapter k ≥ 2: a floor equal to today’s difficulty at level `10 + hash(k) % 6`
  (levels 10 to 15, so the floor varies per chapter). Over the first 70% of the chapter
  the base difficulty rises evenly from the floor to today’s ceiling (0.75), then stays
  there to the end.
- “Today’s difficulty at level X” means today’s base only, `(X - 1) / 50`. The 5-level
  wave (`[0, .06, .12, .18, -.08]` on top of the base) keeps its global phase
  `(level - 1) % 5`, and the retry easing stays as it is. *My call.* Block count and targets already follow `difficulty(level, 0)`, so
  they drop at chapter starts automatically.
- Example, 35-level chapter with floor at level 12: its first levels are about as hard as
  today’s levels 12 to 16; it reaches the ceiling around its 25th level.

### Chapter look (generated)

Chapter 1 keeps today’s look (today’s colours, gem shapes diamond, circle, triangle,
star, hexagon, today’s gem colours, matte style with today’s outline). Its gems are
redrawn with the same SVG system as all chapters, so the old CSS gem shapes can go, and
the gem-on-tile rule below applies in chapter 1 too. *My call: readability over pixel
identity; tiles under a few gems may change colour.* Chapters ≥ 2 are generated
from a seed per chapter (owner approved the mockups):

- Base hue `H` (0 to 359) and one scheme: analogous `[0, 28, 56, -28, -56]`, triadic
  `[0, 120, 240, 24, 144]`, split-complementary `[0, 150, 210, 30, 180]`, tetradic
  `[0, 90, 180, 270, 45]` (hue offsets for the 5 tile colours).
- Tile colours, light: `oklch(L C h)` with L per tile `[.62, .52, .72, .47, .66]`,
  C from .11 to .15 per chapter. Dark: same with L + .06.
- Surfaces, light: bg `oklch(.94 .014 H)`, ink `oklch(.26 .02 H)`, board
  `oklch(.83 .025 H)`, well `oklch(.89 .018 H)`, accent `oklch(.5 .13 <hue of tile 2>)`.
  Dark: bg `oklch(.2 .018 H)`, ink `oklch(.92 .01 H)`, board `oklch(.15 .02 H)`, well
  `oklch(.25 .022 H)`, accent `oklch(.58 .13 <hue of tile 2>)`. Muted text, track and
  sheet colours derive the same way (builder’s call, low chroma, readable).
- Tile style: corner radius one of 20%, 12%, 30%; glaze highlight strength one of
  .42, .25, .55.
- Gem colours: 5 hues evenly spaced 72° apart, rotated by a seeded offset from `H`,
  each `oklch(.84 .16 hue)`.
- Gem symbols: 5 distinct symbols from a pool of 13 (paths in the appendix): diamond,
  circle, ring, triangle, star, hexagon, square, heart, moon, drop, leaf, bolt, cross.
  Never two from a look-alike pair together: circle/ring, circle/hexagon,
  ring/hexagon, drop/leaf.
- Gem style, one per chapter: jewel (radial gradient from white to the colour, dark rim,
  small white glint), matte (flat fill, thin dark outline), line (outline only, coloured
  stroke over a darker halo stroke), duotone (fill and outline plus a light inner line),
  glow (fill with a soft halo in its own colour and a faint dark edge).
- Symbols are drawn as SVG so all styles work in tiles, tray, ghost, flying gems and
  goal chips.

### Gem on tile: never similar colours

Wherever a gem is drawn on a tile (board, tray, ghost), if the tile’s colour hue is
within 35° of the gem’s hue, the tile is drawn in the nearest palette colour that is not.
This is purely visual; the stored board values do not change. In every chapter,
including chapter 1. In pattern levels a board tile under a gem falls back from its mixed
colour to the nearest of the 5 palette colours that is not similar; tray, ghost and
dragged pieces stay neutral (low chroma, never similar). *My calls.*

### Level look modes

Each level gets a look mode from its level number (stable on retry): 70% normal, 15% one
colour, 15% pattern, never two non-normal levels in a row. Only the look changes.

- The mode and the pattern kind depend on the level number only, so retries and “New
  layout” keep them. *My call.*
- **One colour:** every block on the board and in the tray uses one palette colour,
  chosen so it is not similar (hue within 35°) to any gem colour used by the current
  attempt’s goal (the goal can differ per attempt, so the pick is made when the attempt
  starts, still deterministic from `(level, fails, salt)`); any palette colour in score
  levels. If no palette colour qualifies, use the one with the largest hue distance.
  *My calls.*
- **Pattern:** one of rows, columns, diagonal, rings (from the seed). A placed or starting
  block takes the colour of its cell: a position 0..1 (row/7, column/7, (row+col)/14,
  or ring distance from the centre/3.5) mapped smoothly through the 5 palette colours in
  order (OKLCH mixing). Tray pieces, the ghost and the dragged piece show in a neutral
  colour (`oklch(.62 .02 H)` light, `oklch(.55 .02 H)` dark; chapter 1 uses a neutral
  from its own surfaces).

### Chapter change in the UI

- The win sheet of a chapter’s last level adds a line: “Chapter {n} begins” (new key,
  English and German). After “Next level”, the new look applies.
- The header shows “Chapter {n}” small next to the level label (new key), from chapter 2
  on. *My call, the owner did not object.*

### Balancing and tests

- Unit tests (`node --test`): chapter boundaries and lengths, difficulty floor and ramp,
  look modes (shares near 70/15/15 over many levels, never two specials in a row,
  deterministic), theme generation (deterministic, 5 distinct symbols, no look-alike
  pairs, one-colour pick never similar to goal gems).
- Extend `tools/sim.mjs` runs to cover chapter starts and peaks (for example levels
  41, 60, 75, 110) for all three types; the bot must still win nearly every level.

## Left to the builder

- Module layout (a pure `src/theme.js` is suggested), how CSS variables are applied, and
  how SVG symbols are injected (for example an inline `<symbol>` sprite per chapter).
- Exact derived colours for muted text, track, sheet and focus outline.
- The similarity check details beyond the 35° hue rule.
- Transition polish (none required).

## Appendix: symbol paths (24x24 viewBox, use `fill-rule="evenodd"`)

```
diamond  M12 2 22 12 12 22 2 12Z
circle   M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Z
ring     M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Zm0 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z
triangle M12 3 22 20H2Z
star     M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6Z
hexagon  M7 3h10l5 9-5 9H7l-5-9Z
square   M7 4h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z
heart    M12 21S3 15.5 3 9.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 9 2.5C21 15.5 12 21 12 21Z
moon     M14 2.5A9.5 9.5 0 1 0 21.5 17 7.5 7.5 0 0 1 14 2.5Z
drop     M12 2s7 8 7 13a7 7 0 0 1-14 0c0-5 7-13 7-13Z
leaf     M4 20C4 10 10 4 21 3c-1 11-7 17-17 17Z
bolt     M14 1 4 14h7l-2 9 11-14h-7Z
cross    M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z
```

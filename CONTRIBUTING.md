# Contributing

## Code

- No frameworks, no dependencies, no build step unless a feature truly needs one.
- Game rules live in `src/core.js` as pure functions: no DOM, no storage. The UI in
  `src/ui.js` renders and animates, and the balance bot in `tools/sim.mjs` plays the
  same core.
- Everything random is seeded, so a level is reproducible from `(level, fails, salt)`.
  No `Math.random` in `src/`.
- Any change that could affect fairness keeps the `solvable` check in `deal()`.
- Add new piece families at the end of `BASE`. Saved trays store shape indices, so
  reordering `BASE` or `variants()` needs a new storage key or a migration.
- Match the surrounding style: compact, terse JS.

## Copy

- Sentence case, short and plain.
- No em-dashes in UI copy or docs. Use typographic apostrophes (’) in visible text.

## Tests and balance

- `node --test` runs the unit tests in `tests/`.
- `node tools/sim.mjs [levels] [runs] [types]` plays every level type with a greedy bot
  and reports win rate, slowest deal, average moves and average goal. Rerun it after any
  change to piece weights, starting density or goals. Targets: the bot wins nearly every
  level, the slowest deal stays around 10 ms or less, gem rush is the longest type and
  gem goals the shortest.

## Commits

Conventional Commits: `type: subject`.

- Types: `feat`, `fix`, `docs`, `test`, `ci`, `refactor` (no behaviour change), `chore`.
- Subject: imperative, lowercase, no period, about 72 characters max.
  Example: `feat: add gem goal to early levels`.
- Body (optional): explain why, not what. Wrap at 72 characters.

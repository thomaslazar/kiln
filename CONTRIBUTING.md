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
- All visible text lives in `lang/<code>.json`, never in the code. The UI reads it with
  `t('key', {placeholders})`. A new text needs a key in every language file; the tests
  fail until it has one.

## Add or improve a language

No code changes needed.

1. Copy `lang/en.json` to `lang/<code>.json`, using the two-letter language code
   (for example `fr.json` for French).
2. Translate every value. Keep the keys and the `{placeholders}` exactly as they are;
   you may move a placeholder within the sentence.
3. Add one line to `lang/languages.json`: `"<code>": "<the language’s own name>"`,
   for example `"fr": "Français"`.
4. Run `node --test` (or let the pull request checks run it). It fails if a key is
   missing or extra, a text is empty, or a placeholder differs from English.
5. Open a pull request.

The game picks a language from the phone’s settings and can be switched under Info in the menu.
Keys missing from a language fall back to English, but the tests require all of them.

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

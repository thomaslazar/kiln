# Level Types, Gems and Score Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the lines/stone-gem goals with three mixed level types (score, gem goals, gem rush), coloured gems with per-colour shapes, combo scoring, coloured pre-placed tiles, and easing only after the 4th fail.

**Architecture:** All rules live in `src/core.js` as pure functions over a plain state object `S`; `src/ui.js` renders and animates, and `tools/sim.mjs` plays the same core. Move resolution moves into core (`resolveMove` + `clearCells`) so UI and sim share it. Tests use Node's built-in `node:test`.

**Tech Stack:** Vanilla ES modules, CSS, Node 26 (`node --test`). No dependencies.

**Spec:** `docs/superpowers/specs/2026-10-20-level-types-gems-score-design.md`

## Global Constraints

- No frameworks, no build step, no new dependencies, no `package.json`.
- Everything seeded and deterministic from `(level, fails, salt)`; no `Math.random` in `src/`.
- `src/core.js` stays pure: no DOM, no `localStorage`.
- `deal()` keeps its `solvable(occ, set, 25000)` check on every path.
- UI copy: sentence case, no em-dashes, typographic apostrophes (’).
- New animations and toasts respect `prefers-reduced-motion` (existing global rule in `style.css` covers CSS animations).
- Match surrounding style: compact, terse JS like the existing core.
- Commits: Conventional Commits, `type: subject`, lowercase imperative. **No `Co-Authored-By:` or "Generated with" lines** (project rule in `CLAUDE.md`).
- Run all tests with `node --test tests/`.

## Shared data model (all tasks use these names)

- `S.type`: `'score' | 'gems' | 'rush'`.
- `S.color[64]`: `0` empty, `1..5` glaze colour. Value `9` (stone) no longer exists.
- `S.gem[64]`: `0` none, `1..5` gem colour (1 ruby, 2 sapphire, 3 emerald, 4 amber, 5 amethyst).
- `S.goal`: `{type:'score', need}` or `{type:'gems'|'rush', targets:[{g, need}]}`.
- `S.got[6]`: gems freed per colour (index 1..5 used).
- `S.score`, `S.combo`, `S.idle` (placements since last clear), `S.deals`, `S.seed`, `S.d`.
- Tray entry: `{s, c, g}` where `g[j]` is the gem colour (0 = none) of `SHAPES[s].cells[j]`.
- Persistent across levels: `level, fails, salt, best, lines`.

## Review Focus

1. A `kiln-v1` save (with stone `9` cells and old trays) loads into a fresh level with no `9` anywhere and keeps `level`, `best`, `lines` (test in Task 6).
2. A colour whose target is met while pieces with that gem are still in the tray: those gems place and clear without counting, and no new ones are dealt (tests in Tasks 3 and 4).
3. A broken or partial `kiln-v2` save (missing `g` on a tray entry, wrong array lengths) starts a fresh level instead of crashing (test in Task 6).
4. Reloading mid-level keeps the same type, goal, score and combo (S is saved whole; test in Task 6 round-trips it).
5. The last needed gem and a combo toast arrive on the same move: win is checked once, after clears (test in Task 4 via `won`).

---

### Task 1: Test harness, delayed easing, level type

**Files:**
- Create: `tests/core.test.mjs`
- Modify: `src/core.js` (`difficulty`, new `levelType`)

**Interfaces:**
- Produces: `difficulty(level, fails): number` (0..1), `levelType(level): 'score'|'gems'|'rush'`.

- [ ] **Step 1: Write failing tests** in `tests/core.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { difficulty, levelType } from '../src/core.js';

test('fails 1 to 3 do not ease', () => {
  for (const lv of [10, 37, 60]) for (const f of [1, 2, 3])
    assert.equal(difficulty(lv, f), difficulty(lv, 0));
});
test('each fail from the 4th eases by 0.18', () => {
  assert.ok(Math.abs(difficulty(40, 4) - (difficulty(40, 0) - 0.18)) < 1e-9);
  assert.ok(Math.abs(difficulty(40, 5) - Math.max(0, difficulty(40, 0) - 0.36)) < 1e-9);
});
test('level types: early levels, no three in a row, rough mix', () => {
  assert.equal(levelType(1), 'score'); assert.equal(levelType(2), 'score');
  for (let lv = 3; lv <= 5; lv++) assert.notEqual(levelType(lv), 'rush');
  const n = { score: 0, gems: 0, rush: 0 };
  for (let lv = 3; lv <= 2000; lv++) {
    const t = levelType(lv);
    assert.ok(!(t === levelType(lv - 1) && t === levelType(lv - 2)), `three in a row at ${lv}`);
    if (lv >= 6) n[t]++;
  }
  for (const t in n) assert.ok(n[t] > 0.25 * 1995, `${t} too rare: ${n[t]}`);
  assert.equal(levelType(123), levelType(123));
});
```

- [ ] **Step 2: Run** `node --test tests/` — Expected: FAIL (`levelType` is not exported; easing test fails).

- [ ] **Step 3: Implement.** In `difficulty`, replace `-.18*fails` with `-.18*Math.max(0,fails-3)`. Add `export function levelType(level)` in the `difficulty & levels` section: levels 1-2 `'score'`; 3-5 pick `'score'`/`'gems'` from `hash(level*31+5)`; 6+ pick one of three evenly from the same hash; if the pick equals both previous levels' types, take the next type in `['score','gems','rush']` order (skipping `'rush'` below level 6). Compute iteratively with a module-level cache array so it is not exponential.

- [ ] **Step 4: Run** `node --test tests/` — Expected: PASS.

- [ ] **Step 5: Commit** `git add tests/core.test.mjs src/core.js && git commit -m "feat: add level types and delay easing to the 4th fail"`

---

### Task 2: Level generation for the three types

**Files:**
- Modify: `src/core.js` (`makeLevel`, new `startsEmpty`)
- Test: `tests/core.test.mjs`

**Interfaces:**
- Consumes: `difficulty`, `levelType` (Task 1).
- Produces: `startsEmpty(level): boolean`; `makeLevel(level, fails, salt, type = levelType(level))` returning `{seed, d, type, color, gem, goal}` with the shapes from the shared data model.

Values (starting points, Task 5 may tune): empty share about 30% (`hash(level*97+13) % 10 < 3`), plus level 1. Block target `Math.round((.04+.2*difficulty(level,0))*64)` (never uses `fails`). Score need `Math.round((100+2600*d)/10)*10`. Gem goals: colour count `Math.min(5, 1+Math.floor(difficulty(level,0)*5))`, distinct colours, each `need = 3+Math.round(d*5)`; about one in four pre-placed cells gets a gem of a target colour. Rush: one random colour, `need = Math.min(500, Math.round((100+450*d)/10)*10)`; every pre-placed cell gets that gem. `d` here is `difficulty(level, fails)` (level 1 uses 0).

- [ ] **Step 1: Write failing tests** (append):

```js
import { makeLevel, startsEmpty, fullLines, occOf } from '../src/core.js';
const count = L => L.color.filter(Boolean).length;

test('block count is fixed per level, placement changes on retry', () => {
  let moved = 0, withBlocks = 0;
  for (let lv = 3; lv <= 80; lv++) {
    const base = makeLevel(lv, 0, 0), n = count(base);
    for (const [f, s] of [[1,0],[4,0],[6,0],[0,1],[0,3]]) assert.equal(count(makeLevel(lv, f, s)), n, `level ${lv}`);
    if (n) withBlocks++;
    if (n && makeLevel(lv, 1, 0).color.join() !== base.color.join()) moved++;
  }
  assert.ok(moved >= 0.9 * withBlocks);
});
test('empty starts: level 1 and roughly 30%, independent of retries', () => {
  assert.equal(count(makeLevel(1, 0, 0)), 0);
  let e = 0;
  for (let lv = 2; lv <= 401; lv++) { if (startsEmpty(lv)) { e++; assert.equal(count(makeLevel(lv, 5, 2)), 0); } }
  assert.ok(e > 80 && e < 160, `empty ${e}`);
});
test('pre-placed tiles are glaze colours and never complete a line', () => {
  for (let lv = 1; lv <= 120; lv++) {
    const L = makeLevel(lv, 0, 0);
    assert.ok(L.color.every(v => v >= 0 && v <= 5));
    const f = fullLines(occOf(L.color)); assert.equal(f.rows.length + f.cols.length, 0);
  }
});
test('score goal', () => {
  for (let lv = 3; lv <= 90; lv++) {
    const L = makeLevel(lv, 0, 0, 'score');
    assert.equal(L.goal.type, 'score'); assert.ok(L.gem.every(g => g === 0));
    assert.ok(L.goal.need >= 100 && L.goal.need <= 3000 && L.goal.need % 10 === 0);
  }
  assert.ok(makeLevel(40, 4, 0, 'score').goal.need < makeLevel(40, 0, 0, 'score').goal.need);
});
test('gem goals', () => {
  for (let lv = 3; lv <= 90; lv++) {
    const L = makeLevel(lv, 0, 0, 'gems'), t = L.goal.targets, gs = t.map(x => x.g);
    assert.ok(t.length >= 1 && t.length <= 5 && new Set(gs).size === t.length);
    assert.ok(gs.every(g => g >= 1 && g <= 5) && t.every(x => x.need >= 1));
    assert.equal(makeLevel(lv, 5, 0, 'gems').goal.targets.length, t.length);
    L.gem.forEach((g, i) => { if (g) { assert.ok(gs.includes(g)); assert.ok(L.color[i]); } });
  }
});
test('gem rush', () => {
  for (let lv = 6; lv <= 90; lv++) {
    const L = makeLevel(lv, 0, 0, 'rush'), [t] = L.goal.targets;
    assert.equal(L.goal.targets.length, 1); assert.ok(t.need >= 100 && t.need <= 500);
    L.color.forEach((v, i) => assert.equal(L.gem[i], v ? t.g : 0));
  }
});
```

- [ ] **Step 2: Run** `node --test tests/` — Expected: new tests FAIL.
- [ ] **Step 3: Implement** `startsEmpty` and the new `makeLevel` with the values above. Placement keeps the existing loop (small shapes, reject line-completing), but writes a random glaze `1..5` per placed piece instead of `9`; `gem` becomes a numeric array. The count must be exact on every seed: the current loop overshoots by up to 3 cells, so only draw shapes with `n <= target - filled`, and raise the try budget so it always lands (singles always fit on a board this sparse).
- [ ] **Step 4: Run** `node --test tests/` — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -am "feat: generate score, gem goal and gem rush levels"`

---

### Task 3: Gems on dealt pieces and level start state

**Files:**
- Modify: `src/core.js` (`deal`, new `activeGems`, new `startState`)
- Test: `tests/core.test.mjs`

**Interfaces:**
- Consumes: `makeLevel` (Task 2).
- Produces: `activeGems(S): number[]` (target colours with `S.got[g] < need`); `deal(S): {s, c, g}[]` (3 entries); `startState(level, fails, salt, type?)` returning `{seed, d, type, color, gem, goal, got:[0,0,0,0,0,0], score:0, combo:0, idle:0, deals:0, tray}` with `tray = deal(...)`.

Gem rules in `deal`: `'score'` all zeros; `'rush'` every cell gets the target colour while active, else zeros; `'gems'` each piece has a 1-in-3 chance (from the deal rng) of 1 or 2 gem cells, colours drawn from `activeGems(S)`. Gems are attached after the set is chosen, so `solvable` is untouched. Fallback paths get gems the same way.

- [ ] **Step 1: Write failing tests** (append):

```js
import { deal, startState, activeGems, SHAPES } from '../src/core.js';

test('score pieces carry no gems, g matches cell count', () => {
  const S = startState(12, 0, 0, 'score');
  for (let k = 0; k < 50; k++) for (const p of deal(S)) {
    assert.equal(p.g.length, SHAPES[p.s].n); assert.ok(p.g.every(g => g === 0));
  }
});
test('rush pieces are all gems until the target is met', () => {
  const S = startState(30, 0, 0, 'rush'), g = S.goal.targets[0].g;
  for (const p of deal(S)) assert.ok(p.g.every(x => x === g));
  S.got[g] = S.goal.targets[0].need;
  assert.deepEqual(activeGems(S), []);
  for (const p of deal(S)) assert.ok(p.g.every(x => x === 0));
});
test('gem goal pieces: about a third carry 1-2 gems of active colours only', () => {
  const S = startState(60, 0, 0, 'gems'), done = S.goal.targets[0];
  S.got[done.g] = done.need;
  let pieces = 0, withGems = 0;
  for (let k = 0; k < 300; k++) for (const p of deal(S)) {
    pieces++; const n = p.g.filter(Boolean).length;
    if (n) { withGems++; assert.ok(n <= 2); }
    assert.ok(!p.g.includes(done.g));
    p.g.forEach(x => assert.ok(x === 0 || activeGems(S).includes(x)));
  }
  assert.ok(withGems / pieces > 0.2 && withGems / pieces < 0.5);
});
test('deal is deterministic', () => {
  const a = startState(44, 2, 1), b = startState(44, 2, 1);
  assert.deepEqual(a.tray, b.tray); assert.deepEqual(deal(a), deal(b));
});
```

Note: the gem goals test needs at least 2 targets at level 60 (colour count there is 4 with the Task 2 formula).

- [ ] **Step 2: Run** `node --test tests/` — Expected: FAIL.
- [ ] **Step 3: Implement** `activeGems`, gem attachment in `deal`, and `startState`.
- [ ] **Step 4: Run** `node --test tests/` — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -am "feat: deal gem pieces for gem levels"`

---

### Task 4: Move resolution and scoring in core

**Files:**
- Modify: `src/core.js` (new `linePoints`, `resolveMove`, `clearCells`, `won`)
- Test: `tests/core.test.mjs`

**Interfaces:**
- Consumes: `startState`, `activeGems`, `fullLines`, `occOf` (earlier tasks).
- Produces:
  - `linePoints(n): number` = `10*n*(n+1)/2`.
  - `resolveMove(S, i, r, c)`: places `S.tray[i]` (colours and gems), sets `S.tray[i] = null`, finds full lines, updates `S.score`, `S.combo`, `S.idle`, `S.got`, and returns `{placed: number[], cleared: number[], lines, points, fullClear}`. Does **not** empty cleared cells.
  - `clearCells(S, cells)`: sets `color` and `gem` of those cells to 0.
  - `won(S): boolean`: score type `S.score >= need`; gem types every target `S.got[g] >= need`.

Rules (spec, starting values): points = cells placed + `linePoints(lines) * newCombo` + 300 if full clear. A move with lines: `combo += 1`, `idle = 0`. A move without: `idle += 1`; when `idle` reaches 3, `combo = 0`. Full clear = every cell not in `cleared` is empty after placement. Gems on cleared cells count only if their colour is in `activeGems(S)` at that moment, and `got` never exceeds the target need. Score is tracked in every type (cheap) but only shown in score levels.

- [ ] **Step 1: Write failing tests** (append). Helper builds a blank state:

```js
import { linePoints, resolveMove, clearCells, won, SINGLE } from '../src/core.js';
const blank = (type = 'score') => { const S = startState(1, 0, 0, type); S.color.fill(0); S.gem.fill(0); return S; };
const rowGap = S => { for (let c = 1; c < 8; c++) S.color[c] = 1; };   // row 0 full except (0,0)
const single = (S, g = 0) => { S.tray = [{ s: SINGLE, c: 2, g: [g] }, null, null]; };

test('line points', () => assert.deepEqual([1,2,3,4].map(linePoints), [10,30,60,100]));
test('single line clear with full clear bonus', () => {
  const S = blank(); rowGap(S); single(S);
  const m = resolveMove(S, 0, 0, 0);
  assert.equal(m.lines, 1); assert.equal(m.cleared.length, 8); assert.ok(m.fullClear);
  assert.equal(m.points, 1 + 10 + 300); assert.equal(S.combo, 1); assert.equal(S.tray[0], null);
  clearCells(S, m.cleared); assert.ok(S.color.every(v => v === 0));
});
test('combo multiplies and survives two idle moves, third resets', () => {
  const S = blank(); S.color[63] = 3;                       // keeps the board from full-clearing
  rowGap(S); single(S); clearCells(S, resolveMove(S, 0, 0, 0).cleared);
  rowGap(S); single(S); const m2 = resolveMove(S, 0, 0, 0); clearCells(S, m2.cleared);
  assert.equal(S.combo, 2); assert.equal(m2.points, 1 + 10 * 2);
  for (const k of [1, 2]) { single(S); resolveMove(S, 0, 4, k); assert.equal(S.combo, 2); }
  single(S); resolveMove(S, 0, 4, 3); assert.equal(S.combo, 0);
});
test('gems count for active colours only, capped at need', () => {
  const S = blank('gems'); S.goal = { type: 'gems', targets: [{ g: 1, need: 2 }] };
  rowGap(S); S.gem[1] = 1; S.gem[2] = 1; S.gem[3] = 1; S.gem[4] = 2; single(S, 1);
  const m = resolveMove(S, 0, 0, 0);
  assert.equal(S.got[1], 2); assert.equal(S.got[2], 0); assert.ok(won(S));
  clearCells(S, m.cleared); assert.ok(S.gem.every(g => g === 0));
});
test('score win', () => { const S = blank(); S.goal = { type: 'score', need: 300 }; S.score = 299; assert.ok(!won(S)); S.score = 300; assert.ok(won(S)); });
```

- [ ] **Step 2: Run** `node --test tests/` — Expected: FAIL.
- [ ] **Step 3: Implement** the four functions in a new `/* ---------- moves ---------- */` section of `src/core.js` (before the end of the file).
- [ ] **Step 4: Run** `node --test tests/` — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -am "feat: add scoring, combos and move resolution to core"`

---

### Task 5: Sim for all types and tuning

**Files:**
- Modify: `tools/sim.mjs`, tuning constants in `src/core.js`

**Interfaces:**
- Consumes: `startState`, `deal`, `resolveMove`, `clearCells`, `won`, `solvable`, `placeOcc`, `fits`, `occOf`, `SHAPES`.

- [ ] **Step 1: Rewrite the bot loop** to use `startState(level, 0, 0, type)` and, per move, `resolveMove` + `clearCells` (drop its own clear/progress code; keep its greedy scoring with the `solvable(..., 5000)` look-ahead). Deal a new tray with `S.tray = deal(S)` when all slots are `null`. Stop on `won(S)` or no fitting piece. Move cap: 300 for score and gems, 2000 for rush. Usage: `node tools/sim.mjs [levels] [runs] [types=score,gems,rush]`. Output one line per type per level range: `score levels 3-8: bot won 6/6, slowest deal 4 ms, avg moves 41`.
- [ ] **Step 2: Run** `node tools/sim.mjs 3,8,15,25,35,50,80 6` and record the output.
- [ ] **Step 3: Tune** only these knobs in `src/core.js` until every range wins at least 5/6 for every type, the slowest deal is at most 20 ms, and score targets stay 100..3000: score need formula, rush need formula, gem piece chance, per-colour gem need. Keep Task 2-4 tests passing; if a tuned value breaks a test range, update the test to the spec range, never beyond it.
- [ ] **Step 4: Run** `node --test tests/ && node tools/sim.mjs` — Expected: tests PASS, every line `won 5/6` or `6/6`.
- [ ] **Step 5: Commit** `git commit -am "test: simulate all level types and tune targets"` with the final sim output in the commit body.

---

### Task 6: UI, saves, styles and docs

**Files:**
- Modify: `src/ui.js`, `style.css`, `index.html` (only if markup for chips/score needs it), `CLAUDE.md`, `src/core.js` (save helpers)
- Test: `tests/core.test.mjs`

**Interfaces:**
- Consumes: everything above.
- Produces (core, pure): `fromV1(old): {level, fails:0, salt:0, best, lines}` (defaults 1/1/0 for missing or bad fields); `validSave(s): boolean` (type is one of three, `color`/`gem` length 64, `got` length 6, tray length 3 with each entry `null` or `{s in range, c, g array of SHAPES[s].n}`).

- [ ] **Step 1: Write failing tests** (append):

```js
import { fromV1, validSave } from '../src/core.js';
test('v1 save migrates progress only', () => {
  assert.deepEqual(fromV1({ level: 14, best: 20, lines: 311, color: Array(64).fill(9), tray: [{ s: 3, c: 1 }] }),
    { level: 14, fails: 0, salt: 0, best: 20, lines: 311 });
  assert.deepEqual(fromV1(null), { level: 1, fails: 0, salt: 0, best: 1, lines: 0 });
});
test('save validation', () => {
  const S = { level: 5, fails: 0, salt: 0, best: 5, lines: 0, ...startState(5, 0, 0) };
  assert.ok(validSave(JSON.parse(JSON.stringify(S))));
  assert.ok(!validSave({ ...S, tray: [{ s: 0, c: 1 }, null, null] }));
  assert.ok(!validSave({ ...S, gem: [] }));
  assert.ok(!validSave({ ...S, type: 'lines' }));
});
```

- [ ] **Step 2: Run** `node --test tests/` — Expected: FAIL. Then implement `fromV1` and `validSave`; Expected: PASS.

- [ ] **Step 3: Rewire `src/ui.js`.**
  - Storage: `KEY = 'kiln-v2'`. `load()` returns the v2 save if `validSave`; otherwise, if `kiln-v1` exists, build state from `fromV1(JSON.parse(...))`, remove `kiln-v1`, and start that level; otherwise new game `{level:1, fails:0, salt:0, best:1, lines:0}`.
  - `startLevel()`: `Object.assign(S, startState(S.level, S.fails, S.salt))`.
  - `placePiece`: call `resolveMove`, add `m.lines` to `S.lines`, render, animate `land`/`pop` as today, then `clearCells` in `finish`. Toasts: `Double`/`Triple`/`${n} lines` as today; `Combo ${S.combo}` when `S.combo >= 2`; `Board clear` on full clear (full clear wins if several apply). `afterMove` uses `won(S)`.
  - Rendering: cell gets class `gem` and `data-gem="1..5"` when `S.gem[i]`; tray and floating piece cells show their `p.g[j]` gem the same way. Stone class and rendering removed.
  - Goal row: score type shows `Reach ${need} points` and `${score} / ${need}` with the bar. Gem types hide the bar and show one chip per target: gem shape, then `${Math.min(got, need)} / ${need}`; a met target gets class `done` (dimmed, struck through).
  - Hint text: levels 1-2 keep the current tutorial line; gem types: `Clear a gem’s row or column to free it.`; otherwise empty.
  - Win sheet text: score `${S.score} points.`; gems `All gems freed.` Loss sheet text: `Every set of pieces could have been placed, so this one’s on the moves. Try a fresh layout.` and, when the next attempt will be easier (`S.fails + 1 >= 4`), `Every set of pieces could have been placed, so this one’s on the moves. The retry has easier targets.`
  - Menu text: keep, replacing nothing else.
- [ ] **Step 4: Styles in `style.css`.** Add `--gem1..--gem5` (ruby `#FF4D6D`, sapphire `#4CC2FF`, emerald `#4BE08A`, amber `#FFC83D`, amethyst `#C792FF`) with slightly deeper dark-mode values in both dark blocks. Gem shapes from the spec (1 diamond, 2 circle, 3 triangle, 4 star, 5 hexagon) via `[data-gem="n"] .t::after` and the same shapes for chips; thin dark outline (`box-shadow` for diamond/circle, `drop-shadow` filter for clip-path shapes). Remove `.stone` and `--stone` and `--gem`.
- [ ] **Step 5: Manual check.** Serve with `python3 -m http.server 8765` and open at 390x844. Verify per type (force by setting `localStorage['kiln-v2']` to a `startState(level,0,0,type)` save if needed): gems visible and distinct on board, tray and while dragging; chips count and strike through; score bar and combo toast; a `kiln-v1` save migrates; no console errors except `favicon.ico`.
- [ ] **Step 6: Update `CLAUDE.md`:** design goal 4 (easier only from the 4th fail, via lower targets), board values (no stone), gems, level types, scoring, state fields, storage key `kiln-v2`, tests (`node --test tests/`), sim usage.
- [ ] **Step 7: Run** `node --test tests/ && node tools/sim.mjs` — Expected: all PASS, sim lines unchanged from Task 5.
- [ ] **Step 8: Commit** `git add -A && git commit -m "feat: show level types, coloured gems and score in the game"`

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

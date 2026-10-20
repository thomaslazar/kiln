// Balance check: plays every level type with a greedy bot and reports win rates.
// Usage: node tools/sim.mjs [levels=3,8,15,25,35,50,80] [runsPerLevel=6] [types=score,gems,rush]
import { SHAPES, occOf, fits, placeOcc, solvable, startState, deal, resolveMove, clearCells, won } from '../src/core.js';

function sim(level, type){
  const S = startState(level, 0, 0, type), cap = type === 'rush' ? 2000 : 300;
  let moves = 0, maxDealMs = 0;
  while (moves < cap && !won(S)) {
    if (S.tray.every(p => !p)) {
      const t0 = Date.now(); S.tray = deal(S); maxDealMs = Math.max(maxDealMs, Date.now() - t0);
    }
    let best = null;
    S.tray.forEach((p, i) => {
      if (!p) return;
      const s = SHAPES[p.s], o = occOf(S.color);
      for (let r = 0; r <= 8 - s.h; r++) for (let c = 0; c <= 8 - s.w; c++) {
        if (!fits(o, s, r, c)) continue;
        const n = placeOcc(o, s, r, c);
        const rest = S.tray.filter((t, j) => t && j !== i).map(t => t.s);
        const sc = (solvable(n, rest, 5000) ? 100 : 0) - n.reduce((a, b) => a + b, 0) + Math.random();
        if (!best || sc > best.sc) best = { sc, r, c, i };
      }
    });
    if (!best) break;
    clearCells(S, resolveMove(S, best.i, best.r, best.c).cleared);
    moves++;
  }
  return { won: won(S), moves, maxDealMs, need: S.goal.need ?? S.goal.targets.reduce((a, t) => a + t.need, 0) };
}

const levels = (process.argv[2] || '3,8,15,25,35,50,80').split(',').map(Number);
const runs = Number(process.argv[3] || 6);
const types = (process.argv[4] || 'score,gems,rush').split(',');
for (const type of types) for (const lv of levels) {
  let wins = 0, slow = 0, moves = 0, need = 0;
  for (let k = 0; k < runs; k++) {
    const r = sim(lv + k, type);
    if (r.won) wins++;
    slow = Math.max(slow, r.maxDealMs); moves += r.moves; need += r.need;
  }
  console.log(`${type} levels ${lv}-${lv + runs - 1}: bot won ${wins}/${runs}, slowest deal ${slow} ms, avg moves ${Math.round(moves / runs)}, avg need ${Math.round(need / runs)}`);
}

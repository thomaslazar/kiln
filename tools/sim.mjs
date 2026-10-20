// Balance check: plays every level range with a simple bot and reports win rates.
// Usage: node tools/sim.mjs [levels=3,8,15,25,35,50,80] [runsPerLevel=6]
// It extracts the game core from index.html between two marker comments, so keep
// "const N = 8" and "/* ---------- state" intact until the core lives in its own module.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const js = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
const core = js.slice(js.indexOf('const N = 8'), js.indexOf('/* ---------- state'))
  .replace(/const reduced = .*?;/, '')
  .replace(/const \$ = .*?;/, '');

const ctx = { console };
vm.createContext(ctx);
vm.runInContext(core + `
var S;
function sim(level, fails){
  const L = makeLevel(level, fails, 0);
  S = { seed:L.seed, d:L.d, color:L.color, gem:L.gem, goal:L.goal, progress:0, deals:0 };
  let moves = 0, prog = 0, maxDealMs = 0;
  while (moves < 300 && prog < L.goal.need) {
    const t0 = Date.now(); const tray = deal(); maxDealMs = Math.max(maxDealMs, Date.now() - t0);
    while (tray.length) {
      let best = null;
      tray.forEach((p, i) => {
        const s = SHAPES[p.s], o = occOf(S.color);
        for (let r = 0; r <= 8 - s.h; r++) for (let c = 0; c <= 8 - s.w; c++) {
          if (!fits(o, s, r, c)) continue;
          const n = placeOcc(o, s, r, c);
          const rest = tray.filter((_, j) => j !== i).map(t => t.s);
          const sc = (solvable(n, rest, 5000) ? 100 : 0) - n.reduce((a, b) => a + b, 0) + Math.random();
          if (!best || sc > best.sc) best = { sc, r, c, i };
        }
      });
      if (!best) return { won:false, moves, prog, need:L.goal.need, maxDealMs };
      const p = tray[best.i], s = SHAPES[p.s]; tray.splice(best.i, 1);
      for (const [dr, dc] of s.cells) S.color[(best.r + dr) * 8 + best.c + dc] = p.c;
      const f = fullLines(occOf(S.color)), clr = new Set();
      f.rows.forEach(r => { for (let c = 0; c < 8; c++) clr.add(r * 8 + c); });
      f.cols.forEach(c => { for (let r = 0; r < 8; r++) clr.add(r * 8 + c); });
      if (L.goal.type === 'lines') prog += f.rows.length + f.cols.length;
      else clr.forEach(k => { if (S.gem[k]) prog++; });
      clr.forEach(k => { S.color[k] = 0; S.gem[k] = false; });
      moves++;
    }
  }
  return { won: prog >= L.goal.need, moves, prog, need:L.goal.need, maxDealMs };
}
globalThis.sim = sim;
`, ctx);

const levels = (process.argv[2] || '3,8,15,25,35,50,80').split(',').map(Number);
const runs = Number(process.argv[3] || 6);
for (const lv of levels) {
  let wins = 0, slow = 0;
  for (let k = 0; k < runs; k++) {
    const r = ctx.sim(lv + k, 0);
    if (r.won) wins++;
    slow = Math.max(slow, r.maxDealMs);
  }
  console.log(`levels ${lv}-${lv + runs - 1}: bot won ${wins}/${runs}, slowest deal ${slow} ms`);
}

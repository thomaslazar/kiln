// Pure game logic: no DOM, no storage. Imported by src/ui.js and tools/sim.mjs.
export const N = 8;

/* ---------- random ---------- */
export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
export function hash(n){n=(n^61)^(n>>>16);n=n+(n<<3)|0;n=n^(n>>>4);n=Math.imul(n,0x27d4eb2d);n=n^(n>>>15);return n>>>0}

/* ---------- shapes ---------- */
const BASE = [
  [[0,0]],
  [[0,0],[0,1]],
  [[0,0],[0,1],[0,2]],
  [[0,0],[0,1],[0,2],[0,3]],
  [[0,0],[0,1],[0,2],[0,3],[0,4]],
  [[0,0],[0,1],[1,0],[1,1]],
  [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2]],
  [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2]],
  [[0,0],[1,0],[1,1]],
  [[0,0],[1,0],[2,0],[2,1]],
  [[0,0],[0,1],[0,2],[1,1]],
  [[0,1],[0,2],[1,0],[1,1]],
  [[0,0],[1,0],[2,0],[2,1],[2,2]],
  [[0,0],[1,1]]
];
const CAT = ['s','s','s','m','l','m','l','l','s','m','m','m','l','s'];
function norm(cells){
  const mr=Math.min(...cells.map(c=>c[0])), mc=Math.min(...cells.map(c=>c[1]));
  return cells.map(([r,c])=>[r-mr,c-mc]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
}
function variants(base){
  const out=new Map(); let cur=base;
  for(let f=0;f<2;f++){
    for(let i=0;i<4;i++){cur=cur.map(([r,c])=>[c,-r]);const n=norm(cur);out.set(JSON.stringify(n),n);}
    cur=cur.map(([r,c])=>[r,-c]);
  }
  return [...out.values()];
}
export const SHAPES=[];
BASE.forEach((b,fam)=>{
  const vs=variants(b);
  vs.forEach(cells=>{
    SHAPES.push({cells,h:Math.max(...cells.map(x=>x[0]))+1,w:Math.max(...cells.map(x=>x[1]))+1,n:cells.length,fam,share:1/vs.length});
  });
});
export const SINGLE = SHAPES.findIndex(s=>s.n===1);

/* ---------- board helpers ---------- */
export const occOf = col => Uint8Array.from(col, v => v ? 1 : 0);
export function fits(o,s,r,c){
  if(r<0||c<0||r+s.h>N||c+s.w>N) return false;
  for(const [dr,dc] of s.cells) if(o[(r+dr)*N+c+dc]) return false;
  return true;
}
export function fullLines(o){
  const rows=[],cols=[];
  for(let r=0;r<N;r++){let f=1;for(let c=0;c<N;c++)if(!o[r*N+c]){f=0;break}if(f)rows.push(r)}
  for(let c=0;c<N;c++){let f=1;for(let r=0;r<N;r++)if(!o[r*N+c]){f=0;break}if(f)cols.push(c)}
  return {rows,cols};
}
export function placeOcc(o,s,r,c){
  const n=o.slice();
  for(const [dr,dc] of s.cells) n[(r+dr)*N+c+dc]=1;
  const {rows,cols}=fullLines(n);
  for(const rr of rows) for(let cc=0;cc<N;cc++) n[rr*N+cc]=0;
  for(const cc of cols) for(let rr=0;rr<N;rr++) n[rr*N+cc]=0;
  return n;
}
export function anyFit(o,s){
  for(let r=0;r<=N-s.h;r++) for(let c=0;c<=N-s.w;c++) if(fits(o,s,r,c)) return true;
  return false;
}
export function canClear(o,s){
  for(let r=0;r<=N-s.h;r++) for(let c=0;c<=N-s.w;c++){
    if(!fits(o,s,r,c)) continue;
    const n=o.slice(); for(const [dr,dc] of s.cells) n[(r+dr)*N+c+dc]=1;
    const f=fullLines(n); if(f.rows.length||f.cols.length) return true;
  }
  return false;
}
// Is there an order and placement that fits all pieces? (Line clears included.)
export function solvable(occ,list,budget){
  let nodes=0;
  function rec(o,rem){
    if(!rem.length) return true;
    const seen=new Set();
    for(let i=0;i<rem.length;i++){
      if(seen.has(rem[i])) continue; seen.add(rem[i]);
      const s=SHAPES[rem[i]], rest=rem.filter((_,j)=>j!==i);
      for(let r=0;r<=N-s.h;r++) for(let c=0;c<=N-s.w;c++){
        if(++nodes>budget) return true;
        if(fits(o,s,r,c) && rec(placeOcc(o,s,r,c),rest)) return true;
      }
    }
    return false;
  }
  return rec(occ,list);
}

/* ---------- difficulty & levels ---------- */
export function difficulty(level,fails){
  const base=Math.min(.75,(level-1)/50);
  const saw=[0,.06,.12,.18,-.08][(level-1)%5];   // gentle waves, every 5th level is a breather
  return Math.max(0,Math.min(1,base+saw-.18*Math.max(0,fails-3)));   // fails 1-3 retry at the same difficulty
}
const TYPES=['score','gems','rush'],typeCache=['score','score','score'];   // index = level, 1-2 always score
export function levelType(level){
  for(let l=typeCache.length;l<=level;l++){
    const k=l<6?2:3;let i=hash(l*31+5)%k;
    if(TYPES[i]===typeCache[l-1]&&TYPES[i]===typeCache[l-2])i=(i+1)%k;
    typeCache[l]=TYPES[i];
  }
  return typeCache[level];
}
export const startsEmpty=level=>level===1||hash(level*97+13)%10<3;
export function makeLevel(level,fails,salt,type=levelType(level)){
  const seed=hash(level*7919+fails*104729+salt*15485863+77);
  const rng=mulberry32(seed);
  const d=level===1?0:difficulty(level,fails), d0=level===1?0:difficulty(level,0);
  const color=new Array(64).fill(0), gem=new Array(64).fill(0);
  const target=startsEmpty(level)?0:Math.round((.04+.2*d0)*64);   // block count ignores fails, only placement moves
  const small=SHAPES.map((s,i)=>i).filter(i=>SHAPES[i].n<=4);
  let filled=0;
  for(let tries=0;filled<target&&tries<5000;tries++){
    const pool=small.filter(i=>SHAPES[i].n<=target-filled);   // exact count: never overshoot
    const s=SHAPES[pool[Math.floor(rng()*pool.length)]];
    const r=Math.floor(rng()*(N-s.h+1)), c=Math.floor(rng()*(N-s.w+1));
    if(!fits(occOf(color),s,r,c)) continue;
    const idx=s.cells.map(([dr,dc])=>(r+dr)*N+c+dc), col=1+Math.floor(rng()*5);
    idx.forEach(k=>color[k]=col);
    const f=fullLines(occOf(color));
    if(f.rows.length||f.cols.length){idx.forEach(k=>color[k]=0);continue}
    filled+=s.n;
  }
  const cells=color.map((v,i)=>v?i:-1).filter(i=>i>=0);
  let goal;
  if(type==='score') goal={type,need:Math.round((100+2600*d)/10)*10};
  else if(type==='gems'){
    const gs=[1,2,3,4,5];
    for(let i=4;i>0;i--){const j=Math.floor(rng()*(i+1));[gs[i],gs[j]]=[gs[j],gs[i]]}
    const need=3+Math.round(d*5);
    const targets=gs.slice(0,Math.min(5,1+Math.floor(d0*5))).map(g=>({g,need}));
    cells.forEach(i=>{if(rng()<.25)gem[i]=targets[Math.floor(rng()*targets.length)].g});
    goal={type,targets};
  }else{
    const g=1+Math.floor(rng()*5);
    cells.forEach(i=>gem[i]=g);
    goal={type,targets:[{g,need:Math.min(500,Math.round((100+450*d)/10)*10)}]};
  }
  return {seed,d,type,color,gem,goal};
}

/* ---------- fair dealing ---------- */
function weightFor(s,d,fill){
  const crowd=Math.max(0,fill-.45);
  const cat=CAT[s.fam];
  const w=cat==='s'?2-1.1*d+4*crowd:cat==='m'?2.2:.5+1.1*d-2.2*crowd;
  return Math.max(.05,w)*s.share;
}
export const activeGems=S=>S.goal.type==='score'?[]:S.goal.targets.filter(t=>S.got[t.g]<t.need).map(t=>t.g);
export function deal(S){
  const rng=mulberry32(hash(S.seed^Math.imul(S.deals+1,2654435761)));
  S.deals++;
  const occ=occOf(S.color);
  const fill=occ.reduce((a,b)=>a+b,0)/64;
  const weights=SHAPES.map(s=>weightFor(s,S.d,fill));
  const total=weights.reduce((a,b)=>a+b,0);
  const pick=()=>{let x=rng()*total;for(let i=0;i<SHAPES.length;i++){x-=weights[i];if(x<=0)return i}return SHAPES.length-1};
  const wantClear=fill>.4&&rng()<.55+.35*(1-S.d);
  const act=activeGems(S);
  const piece=s=>{
    const n=SHAPES[s].n,g=new Array(n).fill(0);
    if(act.length&&S.type==='rush')g.fill(act[0]);
    else if(act.length&&S.type==='gems'&&rng()<1/3)
      for(let k=1+Math.floor(rng()*2);k--;)g[Math.floor(rng()*n)]=act[Math.floor(rng()*act.length)];   // may collide: 1-2 gems
    return {s,c:1+Math.floor(rng()*5),g};
  };
  for(let a=0;a<40;a++){
    const set=[pick(),pick(),pick()];
    if(wantClear&&a<25&&!set.some(i=>canClear(occ,SHAPES[i]))) continue;
    if(!solvable(occ,set,25000)) continue;
    return set.map(piece);
  }
  // Fallback: small pieces that fit, verified; three singles always work.
  const fitting=SHAPES.map((s,i)=>i).filter(i=>SHAPES[i].n<=3&&anyFit(occ,SHAPES[i]));
  for(let a=0;a<30&&fitting.length;a++){
    const set=[0,0,0].map(()=>fitting[Math.floor(rng()*fitting.length)]);
    if(solvable(occ,set,25000)) return set.map(piece);
  }
  return [SINGLE,SINGLE,SINGLE].map(piece);
}
export function startState(level,fails,salt,type){
  const L=makeLevel(level,fails,salt,type),S={...L,got:[0,0,0,0,0,0],score:0,combo:0,idle:0,deals:0};
  S.tray=deal(S);return S;
}

/* ---------- moves ---------- */
export const linePoints=n=>10*n*(n+1)/2;
export function resolveMove(S,i,r,c){
  const p=S.tray[i],placed=[],cleared=new Set();
  SHAPES[p.s].cells.forEach(([dr,dc],j)=>{const k=(r+dr)*N+c+dc;S.color[k]=p.c;if(p.g[j])S.gem[k]=p.g[j];placed.push(k)});
  S.tray[i]=null;
  const {rows,cols}=fullLines(occOf(S.color)),lines=rows.length+cols.length;
  rows.forEach(rr=>{for(let cc=0;cc<N;cc++)cleared.add(rr*N+cc)});
  cols.forEach(cc=>{for(let rr=0;rr<N;rr++)cleared.add(rr*N+cc)});
  const act=activeGems(S);
  cleared.forEach(k=>{const g=S.gem[k];if(act.includes(g))S.got[g]++});
  act.forEach(g=>{S.got[g]=Math.min(S.got[g],S.goal.targets.find(t=>t.g===g).need)});
  let points=placed.length,fullClear=false;
  if(lines){
    S.combo++;S.idle=0;points+=linePoints(lines)*S.combo;
    fullClear=S.color.every((v,k)=>!v||cleared.has(k));
    if(fullClear)points+=300;
  }else if(++S.idle>=3)S.combo=0;
  S.score+=points;
  return {placed,cleared:[...cleared],lines,points,fullClear};
}
export function clearCells(S,cells){for(const k of cells)S.color[k]=S.gem[k]=0}
export const won=S=>S.goal.type==='score'?S.score>=S.goal.need:S.goal.targets.every(t=>S.got[t.g]>=t.need);

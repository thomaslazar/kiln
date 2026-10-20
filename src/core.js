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
  return Math.max(0,Math.min(1,base+saw-.18*fails));
}
export function makeLevel(level,fails,salt){
  const seed=hash(level*7919+fails*104729+salt*15485863+77);
  const rng=mulberry32(seed);
  const d=level===1?0:difficulty(level,fails);
  const color=new Array(64).fill(0), gem=new Array(64).fill(false);
  const target=level===1?0:Math.round((.04+.2*d)*64);
  const small=SHAPES.map((s,i)=>i).filter(i=>SHAPES[i].n<=4);
  let filled=0,tries=0;
  while(filled<target&&tries<500){
    tries++;
    const s=SHAPES[small[Math.floor(rng()*small.length)]];
    const r=Math.floor(rng()*(N-s.h+1)), c=Math.floor(rng()*(N-s.w+1));
    if(!fits(occOf(color),s,r,c)) continue;
    const idx=s.cells.map(([dr,dc])=>(r+dr)*N+c+dc);
    idx.forEach(k=>color[k]=9);
    const f=fullLines(occOf(color));
    if(f.rows.length||f.cols.length){idx.forEach(k=>color[k]=0);continue}
    filled+=s.n;
  }
  const stones=color.map((v,i)=>v===9?i:-1).filter(i=>i>=0);
  let goal;
  if(level>2&&stones.length>=3&&rng()<.45){
    const need=Math.min(stones.length,3+Math.round(d*5));
    for(let k=0;k<need;k++){
      const j=k+Math.floor(rng()*(stones.length-k));
      [stones[k],stones[j]]=[stones[j],stones[k]];
      gem[stones[k]]=true;
    }
    goal={type:'gems',need};
  }else{
    goal={type:'lines',need:3+Math.round(d*7)};
  }
  return {seed,d,color,gem,goal};
}

/* ---------- fair dealing ---------- */
function weightFor(s,d,fill){
  const crowd=Math.max(0,fill-.45);
  const cat=CAT[s.fam];
  const w=cat==='s'?2-1.1*d+4*crowd:cat==='m'?2.2:.5+1.1*d-2.2*crowd;
  return Math.max(.05,w)*s.share;
}
export function deal(S){
  const rng=mulberry32(hash(S.seed^Math.imul(S.deals+1,2654435761)));
  S.deals++;
  const occ=occOf(S.color);
  const fill=occ.reduce((a,b)=>a+b,0)/64;
  const weights=SHAPES.map(s=>weightFor(s,S.d,fill));
  const total=weights.reduce((a,b)=>a+b,0);
  const pick=()=>{let x=rng()*total;for(let i=0;i<SHAPES.length;i++){x-=weights[i];if(x<=0)return i}return SHAPES.length-1};
  const wantClear=fill>.4&&rng()<.55+.35*(1-S.d);
  const colorOf=()=>1+Math.floor(rng()*5);
  for(let a=0;a<40;a++){
    const set=[pick(),pick(),pick()];
    if(wantClear&&a<25&&!set.some(i=>canClear(occ,SHAPES[i]))) continue;
    if(!solvable(occ,set,25000)) continue;
    return set.map(s=>({s,c:colorOf()}));
  }
  // Fallback: small pieces that fit, verified; three singles always work.
  const fitting=SHAPES.map((s,i)=>i).filter(i=>SHAPES[i].n<=3&&anyFit(occ,SHAPES[i]));
  for(let a=0;a<30&&fitting.length;a++){
    const set=[0,0,0].map(()=>fitting[Math.floor(rng()*fitting.length)]);
    if(solvable(occ,set,25000)) return set.map(s=>({s,c:colorOf()}));
  }
  return [0,0,0].map(()=>({s:SINGLE,c:colorOf()}));
}

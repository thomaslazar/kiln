import {N,SHAPES,occOf,fits,fullLines,anyFit,startState,deal,resolveMove,clearCells,won,fromV1,validSave,difficulty} from './core.js';

const KEY = 'kiln-v2', OLD = 'kiln-v1';
const $ = s => document.querySelector(s);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- state ---------- */
let S;
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
function load(){
  let o=null;
  try{
    const s=JSON.parse(localStorage.getItem(KEY));
    if(validSave(s)) return s;
    if(s&&typeof s==='object') return fromV1(s);   // broken v2: keep progress, start fresh
  }catch(e){}
  try{
    const raw=localStorage.getItem(OLD); if(!raw) return null;
    o=fromV1(JSON.parse(raw));   // progress only, caller starts the level
    localStorage.removeItem(OLD);
  }catch(e){}
  return o;
}
function startLevel(){
  Object.assign(S,startState(S.level,S.fails,S.salt));
  save(); render();
}

/* ---------- rendering ---------- */
const boardEl=$('#board'), cellEls=[];
for(let i=0;i<64;i++){const c=document.createElement('div');c.className='cell';c.appendChild(Object.assign(document.createElement('div'),{className:'t'}));boardEl.appendChild(c);cellEls.push(c)}
const slots=[...document.querySelectorAll('.slot')];

const gemAttr=(el,g)=>{el.classList.toggle('gem',!!g);if(g)el.dataset.gem=g;else delete el.dataset.gem};
function renderCell(i){
  const el=cellEls[i], v=S.color[i];
  el.className='cell'+(v?' f':'');
  gemAttr(el,S.gem[i]);
  if(v) el.style.setProperty('--c',`var(--g${v})`); else el.style.removeProperty('--c');
}
function render(){
  for(let i=0;i<64;i++) renderCell(i);
  $('#lvl').textContent=S.level;
  const g=S.goal, bar=$('#bar'), chips=$('#gems');
  if(g.type==='score'){
    $('#goalText').textContent=`Reach ${g.need} points`;
    $('#goalCount').textContent=`${S.score} / ${g.need}`;
    bar.hidden=false; chips.hidden=true;
    bar.firstElementChild.style.width=(100*Math.min(1,S.score/g.need))+'%';
  }else{
    $('#goalText').textContent='Free the gems'; $('#goalCount').textContent='';
    bar.hidden=true; chips.hidden=false;
    chips.innerHTML=g.targets.map(t=>`<span class="chip${S.got[t.g]>=t.need?' done':''}"><i data-gem="${t.g}"><b></b></i>${Math.min(S.got[t.g],t.need)} / ${t.need}</span>`).join('');
  }
  $('#hintText').textContent=S.level<=2?'Drag a piece onto the board. Full rows and columns clear.':
    g.type!=='score'?'Clear a gem’s row or column to free it.':'';
  renderTray();
}
function buildPiece(container,p,unit){
  const s=SHAPES[p.s];
  container.style.gridTemplate=`repeat(${s.h},${unit})/repeat(${s.w},${unit})`;
  s.cells.forEach(([dr,dc],j)=>{
    const fc=document.createElement('div'); fc.className='fcell';
    fc.style.gridArea=`${dr+1}/${dc+1}`; gemAttr(fc,p.g[j]); fc.style.setProperty('--c',`var(--g${p.c})`);
    fc.appendChild(Object.assign(document.createElement('div'),{className:'t'}));
    container.appendChild(fc);
  });
}
function renderTray(){
  const occ=occOf(S.color);
  slots.forEach((slot,i)=>{
    slot.innerHTML=''; slot.classList.remove('lifted');
    const p=S.tray[i]; if(!p) return;
    const pc=document.createElement('div'); pc.className='piece';
    buildPiece(pc,p,'var(--mini)');
    if(!anyFit(occ,SHAPES[p.s])) pc.classList.add('nofit');
    slot.appendChild(pc);
  });
}

/* ---------- drag ---------- */
let drag=null, busy=false, sheetOpen=false;
function metrics(){const a=cellEls[0].getBoundingClientRect();return{left:a.left,top:a.top,pitch:a.width}}
function clearGhost(){
  for(let i=0;i<64;i++) if(cellEls[i].classList.contains('ghost')||cellEls[i].classList.contains('hint')) renderCell(i);
}
function showGhost(){
  clearGhost();
  if(!drag.ok) return;
  const {s,p,r,c}=drag, o=occOf(S.color);
  s.cells.forEach(([dr,dc],j)=>{
    const el=cellEls[(r+dr)*N+c+dc]; el.classList.add('ghost'); gemAttr(el,p.g[j]); el.style.setProperty('--c',`var(--g${p.c})`);
    o[(r+dr)*N+c+dc]=1;
  });
  const {rows,cols}=fullLines(o);
  rows.forEach(rr=>{for(let cc=0;cc<N;cc++)cellEls[rr*N+cc].classList.add('hint')});
  cols.forEach(cc=>{for(let rr=0;rr<N;rr++)cellEls[rr*N+cc].classList.add('hint')});
}
function moveDrag(e){
  const {s,m,f}=drag, w=s.w*m.pitch, h=s.h*m.pitch;
  const lift=e.pointerType==='mouse'?h/2:h+m.pitch*.9;
  const x=e.clientX-w/2, y=e.clientY-lift;
  f.style.transform=`translate(${x}px,${y}px)`;
  const c=Math.round((x-m.left)/m.pitch), r=Math.round((y-m.top)/m.pitch);
  if(r===drag.r&&c===drag.c) return;
  drag.r=r; drag.c=c; drag.ok=fits(occOf(S.color),s,r,c);
  showGhost();
}
function endDrag(commit){
  const d=drag; drag=null;
  d.f.remove(); clearGhost();
  if(commit&&d.ok) placePiece(d.i,d.r,d.c); else renderTray();
}
slots.forEach((slot,i)=>{
  slot.addEventListener('pointerdown',e=>{
    if(busy||drag||sheetOpen||!S.tray[i]) return;
    e.preventDefault();
    const p=S.tray[i], s=SHAPES[p.s], m=metrics();
    const f=document.createElement('div'); f.id='float';
    buildPiece(f,p,m.pitch+'px');
    document.body.appendChild(f);
    drag={i,p,s,f,m,r:null,c:null,ok:false,id:e.pointerId};
    slot.classList.add('lifted');
    try{slot.setPointerCapture(e.pointerId)}catch(err){}
    moveDrag(e);
  });
  slot.addEventListener('pointermove',e=>{if(drag&&e.pointerId===drag.id)moveDrag(e)});
  slot.addEventListener('pointerup',e=>{if(drag&&e.pointerId===drag.id)endDrag(true)});
  slot.addEventListener('pointercancel',()=>{if(drag)endDrag(false)});
});

/* ---------- moves ---------- */
function buzz(p){try{navigator.vibrate&&navigator.vibrate(p)}catch(e){}}
let toastT;
function toast(text){
  const t=$('#toast'); t.textContent=text; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
  clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('show'),800);
}
function placePiece(i,r,c){
  const m=resolveMove(S,i,r,c), nl=m.lines;
  S.lines=(S.lines||0)+nl;
  render();
  m.placed.forEach(k=>cellEls[k].classList.add('land'));
  buzz(nl?[10,30,10]:8);
  const finish=()=>{
    clearCells(S,m.cleared);
    if(S.tray.every(t=>!t)) S.tray=deal(S);
    save(); render(); busy=false; afterMove();
  };
  if(nl){
    busy=true;
    m.cleared.forEach(k=>cellEls[k].classList.add('pop'));
    if(S.type==='score'){   // these toasts announce bonus points, so gem levels skip them
      const combo=S.combo>=2;
      if(m.fullClear) toast('Board clear');
      else if(nl>1) toast((nl===2?'Double':nl===3?'Triple':`${nl} lines`)+(combo?`, combo ${S.combo}`:''));
      else if(combo) toast(`Combo ${S.combo}`);
    }
    setTimeout(finish,reduced?0:300);
  }else finish();
}
function afterMove(){
  if(won(S)){
    S.best=Math.max(S.best||1,S.level+1); save();
    buzz([20,40,20,40,60]);
    showSheet(`Level ${S.level} cleared`,S.goal.type==='score'?`${S.score} points.`:'All gems freed.',
      [{label:'Next level',primary:true,fn:()=>{S.level++;S.fails=0;S.salt=0;startLevel()}}]);
    return;
  }
  const occ=occOf(S.color);
  if(!S.tray.some(t=>t&&anyFit(occ,SHAPES[t.s]))){
    showSheet('No room left',
      'Every set of pieces could have been placed, so this one’s on the moves. '+(S.fails+1>=4&&difficulty(S.level,S.fails+1)<S.d?'The retry has easier targets.':'Try a fresh layout.'),
      [{label:'Try again',primary:true,fn:()=>{S.fails=(S.fails||0)+1;startLevel()}}]);
  }
}

/* ---------- sheet & menu ---------- */
function showSheet(title,text,buttons){
  sheetOpen=true;
  $('#sheetTitle').textContent=title; $('#sheetText').textContent=text;
  const box=$('#sheetBtns'); box.innerHTML='';
  buttons.forEach(b=>{
    const el=document.createElement('button'); el.textContent=b.label; if(b.primary) el.className='primary';
    el.addEventListener('click',()=>{hideSheet();b.fn&&b.fn()});
    box.appendChild(el);
  });
  $('#sheet').hidden=false;
  box.firstElementChild&&box.firstElementChild.focus({preventScroll:true});
}
function hideSheet(){$('#sheet').hidden=true;sheetOpen=false}
$('#menuBtn').addEventListener('click',()=>{
  if(busy||drag) return;
  showSheet(`Level ${S.level}`,`Best level reached: ${S.best||S.level}. Lines cleared overall: ${S.lines||0}.`,[
    {label:'Keep playing',primary:true},
    {label:'New layout for this level',fn:()=>{S.salt=(S.salt||0)+1;startLevel()}},
    {label:'Start over from level 1',fn:()=>showSheet('Start over?','Your level goes back to 1. Your best level is kept.',[
      {label:'Start over',primary:true,fn:()=>{S.level=1;S.fails=0;S.salt=0;startLevel()}},
      {label:'Cancel'}
    ])}
  ]);
});

/* ---------- boot ---------- */
S=load();
if(S&&S.color){render();afterMove()}
else{S=S||{level:1,fails:0,salt:0,best:1,lines:0};startLevel()}

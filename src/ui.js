import {N,SHAPES,occOf,fits,fullLines,anyFit,startState,deal,resolveMove,clearCells,won,fromV1,validSave,difficulty,
  rescueTray,comboContinue,levelContinue,freeContinue} from './core.js';

const KEY = 'kiln-v2', OLD = 'kiln-v1';
const $ = s => document.querySelector(s);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- language ---------- */
// Texts live in lang/<code>.json; lang/languages.json lists them. Missing keys fall back to English.
const LANG_KEY = 'kiln-lang';
const getJSON = f => fetch(f).then(r => r.json());
const LANGS = await getJSON('lang/languages.json');
let lang, T;
const t = (k, v = {}) => T[k].replace(/\{(\w+)\}/g, (_, n) => v[n]);
async function setLang(code){
  const [en, tr] = await Promise.all([getJSON('lang/en.json'), code === 'en' ? {} : getJSON(`lang/${code}.json`)]);
  T = {...en, ...tr}; lang = code; document.documentElement.lang = code;
  $('.lvl small').textContent = t('level');
  $('#menuBtn').setAttribute('aria-label', t('menu')); $('#board').setAttribute('aria-label', t('board'));
}
function pickLang(){
  try{const l = localStorage.getItem(LANG_KEY); if(LANGS[l]) return l}catch(e){}
  for(const n of navigator.languages || [navigator.language]){const b = String(n).slice(0,2).toLowerCase(); if(LANGS[b]) return b}
  return 'en';
}
await setLang(pickLang());

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
  flightGen++; flying=[0,0,0,0,0,0];   // gems still in the air belong to the old level
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
    $('#goalText').textContent=t('goalScore',{n:g.need});
    $('#goalCount').textContent=`${S.score} / ${g.need}`;
    bar.hidden=false; chips.hidden=true;
    bar.firstElementChild.style.width=(100*Math.min(1,S.score/g.need))+'%';
  }else{
    $('#goalText').textContent=t('goalGems'); $('#goalCount').textContent='';
    bar.hidden=true; chips.hidden=false;
    renderChips();
  }
  $('#hintText').textContent=S.level<=2?t('hintStart'):g.type!=='score'?t('hintGems'):'';
  renderTray();
}
// counters lag behind S.got while freed gems are still flying to them
let flying=[0,0,0,0,0,0], flightGen=0;
function renderChips(){
  $('#gems').innerHTML=S.goal.targets.map(t=>{const n=Math.min(S.got[t.g]-flying[t.g],t.need);
    return `<span class="chip${n>=t.need?' done':''}" data-t="${t.g}"><i data-gem="${t.g}"><b></b></i>${n} / ${t.need}</span>`}).join('');
}
function flyGems(cells){
  const gen=flightGen, pitch=cellEls[0].getBoundingClientRect().width, size=pitch*.42;
  cells.slice(0,8).forEach((k,n)=>{   // ponytail: cap at 8 flights per move, the rest count at once
    const g=S.gem[k], to=$(`#gems .chip[data-t="${g}"] i`); if(!to) return;
    const a=cellEls[k].getBoundingClientRect(), b=to.getBoundingClientRect();
    const x=a.left+a.width/2-size/2, y=a.top+a.height/2-size/2;
    const dx=b.left+b.width/2-size/2-x, dy=b.top+b.height/2-size/2-y;
    const el=document.createElement('span'); el.className='chip fly';
    el.innerHTML=`<i data-gem="${g}" style="width:${size}px;height:${size}px"><b></b></i>`;
    el.style.cssText=`left:${x}px;top:${y}px`;
    document.body.appendChild(el); flying[g]++;
    el.animate([
      {transform:'translate(0,0) scale(1)'},
      {transform:`translate(${dx*.25}px,${dy*.25-pitch}px) scale(1.2)`,offset:.35},
      {transform:`translate(${dx}px,${dy}px) scale(${13/size})`}
    ],{duration:520,delay:n*45,easing:'cubic-bezier(.45,0,.55,1)',fill:'both'}).onfinish=()=>{
      el.remove(); if(gen!==flightGen) return;
      flying[g]--; renderChips();
      const c=$(`#gems .chip[data-t="${g}"]`); c&&c.animate([{transform:'scale(1)'},{transform:'scale(1.25)'},{transform:'scale(1)'}],{duration:200});
    };
  });
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
  if(comboContinue(S,m)) earnContinue();
  if(!reduced) flyGems(m.freed);
  render();
  if(!reduced) m.freed.slice(0,8).forEach(k=>gemAttr(cellEls[k],0));   // the flying copy replaces the tile's gem
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
      if(m.fullClear) toast(t('boardClear'));
      else if(nl>1){const text=nl===2?t('double'):nl===3?t('triple'):t('lines',{n:nl}); toast(combo?t('withCombo',{text,n:S.combo}):text)}
      else if(combo) toast(t('combo',{n:S.combo}));
    }
    setTimeout(finish,reduced?0:300);
  }else finish();
}
// Every way of earning a continue goes through here.
function earnContinue(quiet){
  S.continues=(S.continues||0)+1;
  if(!quiet) setTimeout(()=>toast(t('continueEarned')),reduced?0:700);   // after any line toast
}
function afterMove(){
  if(won(S)){
    const earned=levelContinue(S.level,S.best||1);
    if(earned) earnContinue(true);   // said on the win sheet instead
    S.best=Math.max(S.best||1,S.level+1); save();
    buzz([20,40,20,40,60]);
    showSheet(t('wonTitle',{n:S.level}),(S.goal.type==='score'?t('wonScore',{n:S.score}):t('wonGems'))+(earned?' '+t('wonContinue'):''),
      [{label:t('nextLevel'),primary:true,fn:()=>{S.level++;S.fails=0;S.salt=0;startLevel()}}]);
    return;
  }
  const occ=occOf(S.color);
  if(!S.tray.some(t=>t&&anyFit(occ,SHAPES[t.s]))){
    const retry={label:t('tryAgain'),fn:()=>{S.fails=(S.fails||0)+1;startLevel()}};
    const text=t('lostText')+' '+(S.fails+1>=4&&difficulty(S.level,S.fails+1)<S.d?t('lostEasier'):t('lostFresh'));
    const free=freeContinue(S), bank=S.continues||0;
    if(!free&&!bank) return showSheet(t('lostTitle'),text,[{...retry,primary:true}]);
    const rescue=rescueTray(S);   // shown before the player decides
    const preview=rescue.map(p=>{const pc=document.createElement('div');pc.className='piece';buildPiece(pc,p,'16px');return pc});
    showSheet(t('lostTitle'),text,[
      {label:free?t('freeContinue'):t('useContinue',{n:bank}),primary:true,fn:()=>{
        if(free) S.freeLevel=S.level; else S.continues--;
        S.tray=rescue; save(); render();
      }},
      retry
    ],preview);
  }
}

/* ---------- sheet & menu ---------- */
function showSheet(title,text,buttons,extra){
  sheetOpen=true;
  $('#sheetTitle').textContent=title; $('#sheetText').textContent=text; $('#sheetText').hidden=!text;
  $('#sheetExtra').replaceChildren(...(extra||[])); $('#sheetExtra').hidden=!extra;
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
function openMenu(){
  showSheet(t('menuTitle',{n:S.level}),t('menuStats',{best:S.best||S.level,lines:S.lines||0,continues:S.continues||0}),[
    {label:t('keepPlaying'),primary:true},
    {label:t('newLayout'),fn:()=>{S.salt=(S.salt||0)+1;startLevel()}},
    {label:t('startOver'),fn:()=>showSheet(t('startOverTitle'),t('startOverText'),[
      {label:t('startOverConfirm'),primary:true,fn:()=>{S.level=1;S.fails=0;S.salt=0;startLevel()}},
      {label:t('cancel')}
    ])}
  ]);
  // language: a native dropdown, so the list can grow
  const row=document.createElement('label'), sel=document.createElement('select');
  row.className='pick'; row.append(t('language'),sel);
  for(const [code,name] of Object.entries(LANGS)) sel.add(new Option(name,code,false,code===lang));
  sel.addEventListener('change',async()=>{
    try{localStorage.setItem(LANG_KEY,sel.value)}catch(e){}
    await setLang(sel.value); render(); openMenu();   // reopen so the menu itself switches language
  });
  $('#sheetBtns').appendChild(row);
}
$('#menuBtn').addEventListener('click',()=>{if(!busy&&!drag) openMenu()});

/* ---------- boot ---------- */
if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});   // offline play
S=load();
if(S&&S.color){render();afterMove()}
else{S=S||{level:1,fails:0,salt:0,best:1,lines:0};startLevel()}

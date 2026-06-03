/* ═══ ВІДМАЛЮВАННЯ СХЕМИ (canvas.js) ═══
   Полотно, малювання стін/елементів, відмалювання результату. */

let cv,ctx,drawing=false,sx=0,sy=0;

function initCanvas(){
  cv=document.getElementById('cv');
  const wrap=document.getElementById('cwrap');
  function resize(){
    cv.width=wrap.clientWidth;
    cv.height=wrap.clientHeight||560;
    redraw();
  }
  resize();
  new ResizeObserver(resize).observe(wrap);
  ctx=cv.getContext('2d');

  cv.addEventListener('mousedown',e=>{
    // Режим розміщення елемента — вільна позиція, БЕЗ магніту
    if(S.placeEl){
      const r=cv.getBoundingClientRect();
      placeElOnCanvas(Math.round(e.clientX-r.left), Math.round(e.clientY-r.top));
      return;
    }
    const p=snap(e);
    if(S.tool!=='wall'&&S.tool!=='erase') return;
    drawing=true;
    // Магніт і для стартової точки
    sx=p.x; sy=p.y;
    document.getElementById('hint').style.display='none';
  });
  cv.addEventListener('mousemove',e=>{
    const p=pos(e);
    document.getElementById('coord').textContent=`x:${p.x} y:${p.y}`;
    const sp=snap(e);
    S.cursorX=sp.x; S.cursorY=sp.y;
    // Snap dot — зелений якщо магніт, синій якщо сітка
    const dot=document.getElementById('snapDot');
    dot.style.display='block';
    dot.style.left=sp.x+'px'; dot.style.top=sp.y+'px';
    dot.style.background=sp.snapped?'var(--ok)':'var(--ac)';
    dot.style.width=sp.snapped?'10px':'4px';
    dot.style.height=sp.snapped?'10px':'4px';
    dot.style.transform=sp.snapped?'translate(-5px,-5px)':'translate(-2px,-2px)';
    // Якщо режим place — перемальовуємо щоб показати привид (вільна позиція)
    if(S.placeEl){
      const r2=cv.getBoundingClientRect();
      S.cursorX=Math.round(e.clientX-r2.left);
      S.cursorY=Math.round(e.clientY-r2.top);
      redraw(); return;
    }
    if(!drawing) return;
    redraw();
    // preview wall
    const matCol=MAT_COLORS[document.getElementById('wMat').value]||getVar('--ac');
    const wType=document.getElementById('wType').value;
    ctx.strokeStyle=matCol;
    ctx.lineWidth=Math.max(3,parseInt(document.getElementById('wThick').value)/6);
    ctx.lineCap='round';
    ctx.setLineDash(wType==='part'?[6,4]:[]);
    ctx.globalAlpha=0.6;
    ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(sp.x,sp.y); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha=1;
    // Підсвітка магнітної точки кінця
    const mag=snapHighlight(e);
    if(mag){
      ctx.beginPath(); ctx.arc(mag.x,mag.y,8,0,Math.PI*2);
      ctx.strokeStyle='var(--ok)'; ctx.lineWidth=2; ctx.setLineDash([3,2]);
      ctx.globalAlpha=0.8; ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha=1;
    }
  });
  cv.addEventListener('mouseup',e=>{
    if(!drawing) return; drawing=false;
    const p=snap(e);
    if(S.tool==='erase'){eraseAt(p.x,p.y);return;}
    if(Math.abs(p.x-sx)<3&&Math.abs(p.y-sy)<3) return;
    const wall={x1:sx,y1:sy,x2:p.x,y2:p.y,
      mat:document.getElementById('wMat').value,
      thick:parseInt(document.getElementById('wThick').value),
      type:document.getElementById('wType').value};
    S.undo.push({type:'wall',idx:S.walls.length});
    S.walls.push(wall); redraw();
  });
  cv.addEventListener('mouseleave',()=>{
    drawing=false;
    document.getElementById('snapDot').style.display='none';
  });

  // ESC — скасувати режим розміщення елементу
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&S.placeEl){
      cancelPlaceEl();
      notify('↩️ Режим розміщення скасовано');
    }
  });
}

function pos(e){
  const r=cv.getBoundingClientRect();
  return{x:Math.round(e.clientX-r.left),y:Math.round(e.clientY-r.top)};
}
function snap(e){
  const r=cv.getBoundingClientRect();
  const rx2=e.clientX-r.left;
  const ry2=e.clientY-r.top;
  // Прив'язка до сітки (основний режим — малюємо по клітинках)
  const gx=Math.round(rx2/GRID)*GRID;
  const gy=Math.round(ry2/GRID)*GRID;
  // Магніт до кінців існуючих стін — лише якщо курсор дуже близько до кута
  // (радіус 0.4 клітинки). Інакше прилипало б до далеких кутів конструкції.
  const MAG=GRID*0.4;
  let best=null, bestD=MAG;
  S.walls.forEach(w=>{
    [{x:w.x1,y:w.y1},{x:w.x2,y:w.y2}].forEach(pt=>{
      const d=Math.hypot(rx2-pt.x, ry2-pt.y);
      if(d<bestD){bestD=d;best=pt;}
    });
  });
  // магніт спрацьовує тільки якщо вузол ближчий за вузол сітки
  if(best){
    const dGrid=Math.hypot(rx2-gx, ry2-gy);
    if(bestD<=dGrid) return{x:best.x,y:best.y,snapped:true};
  }
  return{x:gx,y:gy};
}

// Показуємо підсвітку магніту під час малювання
function snapHighlight(e){
  const r=cv.getBoundingClientRect();
  const rx2=e.clientX-r.left, ry2=e.clientY-r.top;
  const MAG=GRID*0.4;
  const gx=Math.round(rx2/GRID)*GRID, gy=Math.round(ry2/GRID)*GRID;
  let best=null, bestD=MAG;
  S.walls.forEach(w=>{
    [{x:w.x1,y:w.y1},{x:w.x2,y:w.y2}].forEach(pt=>{
      const d=Math.hypot(rx2-pt.x,ry2-pt.y);
      if(d<bestD){bestD=d;best=pt;}
    });
  });
  // підсвічуємо тільки якщо вузол реально ближчий за клітинку
  if(best && bestD<=Math.hypot(rx2-gx, ry2-gy)) return best;
  return null;
}
function getVar(v){return getComputedStyle(document.documentElement).getPropertyValue(v).trim();}

// Кольори матеріалів стін

function redraw(){
  if(!ctx) return;
  ctx.clearRect(0,0,cv.width,cv.height);
  drawGrid();
  S.walls.forEach(w=>{
    const col = MAT_COLORS[w.mat] || getVar('--ac');
    ctx.strokeStyle = col;
    ctx.lineWidth = Math.max(4, w.thick/6);
    ctx.lineCap = 'round';
    // Перегородка = частий пунктир, несуча = суцільна
    if(w.type==='part') ctx.setLineDash([6,4]);
    else ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(w.x1,w.y1); ctx.lineTo(w.x2,w.y2); ctx.stroke();
    ctx.setLineDash([]);
    // Підпис матеріалу
    const mx=(w.x1+w.x2)/2, my=(w.y1+w.y2)/2;
    ctx.fillStyle=col+'cc'; ctx.font='8px JetBrains Mono,monospace';
    ctx.fillText(w.thick+'см',mx+3,my-3);
  });
  S.elems.forEach(drawEl);
  // Підсвітка позиції курсору якщо режим place
  if(S.placeEl && S.cursorX!==undefined){
    drawElAt(S.placeEl, S.cursorX, S.cursorY, ctx, true);
  }
  calcArea();
}

function drawGrid(){
  // Тільки дрібна сітка: 1 клітинка = 1м
  ctx.strokeStyle=getVar('--b'); ctx.lineWidth=.5; ctx.setLineDash([]);
  for(let x=0;x<cv.width;x+=GRID){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,cv.height);ctx.stroke();}
  for(let y=0;y<cv.height;y+=GRID){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(cv.width,y);ctx.stroke();}
}

const EL_SIZE=14;

function drawElAt(type, x, y, cx, ghost){
  const col = EL_COLORS[type]||'#888';
  const label = EL_LABELS[type]||type;
  const isSource = EL_IS_SOURCE(type);
  const S2 = isSource ? 16 : EL_SIZE;

  cx.save();
  cx.globalAlpha = ghost ? 0.45 : 1;

  if(isSource){
    // Джерело звуку: концентричні кола що розходяться
    const rings=[0.9, 0.6, 0.35];
    rings.forEach((alpha,i)=>{
      cx.beginPath();
      cx.arc(x, y, S2*(1.5+i*0.8), 0, Math.PI*2);
      cx.strokeStyle=col;
      cx.lineWidth=1;
      cx.globalAlpha=(ghost?0.15:alpha*0.25);
      cx.stroke();
    });
    // Центральне коло — заповнене
    cx.globalAlpha=ghost?0.45:1;
    cx.beginPath();
    cx.arc(x, y, S2, 0, Math.PI*2);
    cx.fillStyle=col+'cc';
    cx.fill();
    cx.strokeStyle=col;
    cx.lineWidth=2;
    cx.stroke();
    // Хрестик у центрі
    cx.strokeStyle='#fff';
    cx.lineWidth=2;
    cx.globalAlpha=ghost?0.4:0.9;
    cx.beginPath(); cx.moveTo(x-6,y); cx.lineTo(x+6,y); cx.stroke();
    cx.beginPath(); cx.moveTo(x,y-6); cx.lineTo(x,y+6); cx.stroke();
  } else {
    // Звичайний елемент: прямокутна плашка
    cx.fillStyle = col + (ghost?'44':'88');
    cx.strokeStyle = col;
    cx.lineWidth = ghost ? 1 : 2;
    cx.setLineDash(ghost?[3,2]:[]);
    cx.beginPath();
    if(cx.roundRect) cx.roundRect(x-S2, y-S2, S2*2, S2*2, 5);
    else cx.rect(x-S2, y-S2, S2*2, S2*2);
    cx.fill(); cx.stroke(); cx.setLineDash([]);
  }

  // Підпис
  cx.globalAlpha = ghost ? 0.4 : (isSource?1:0.85);
  cx.fillStyle = isSource ? col : (col);
  cx.font = isSource ? 'bold 9px Manrope,sans-serif' : '8px Manrope,sans-serif';
  cx.textAlign = 'center';
  cx.textBaseline = 'alphabetic';
  cx.fillText(label, x, y + S2 + (isSource?10:7));

  cx.textAlign = 'left';
  cx.restore();
}

function drawEl(el){ drawElAt(el.type, el.x, el.y, ctx, false); }

// Будуємо впорядкований полігон зі стін і рахуємо площу формулою Гаусса
// ══════════════════════════════════════════════
// РОЗРАХУНОК ПЛОЩІ
// 1. Беремо тільки несучі стіни (type==='load')
// 2. Будуємо замкнений полігон з них (Shoelace)
// 3. Від зовнішньої площі аналітично відіймаємо площу стін:
//    A_inner = A_outer - периметр × halfThick
//    (формула Мінковського для відступу контуру)
// Перегородки повністю ігноруються.
// ══════════════════════════════════════════════

function calcArea(){
  const badge=document.getElementById('areaBadge');

  // 1. Беремо тільки несучі стіни
  const outerWalls=S.walls.filter(w=>w.type==='load');
  const walls=outerWalls.length>=3 ? outerWalls : S.walls;
  if(walls.length<3){badge.style.display='none';return 0;}

  // 2. Будуємо полігон
  const poly=buildOuterPolygon(walls);
  if(!poly){badge.style.display='none';return 0;}

  // 3. Зовнішня площа (Shoelace), px²
  const outerAreaPx=Math.abs(shoelaceSigned(poly));

  // 4. Периметр полігону, px
  const perimPx=perimeterPx(poly);

  // 5. Середня товщина стін в пікселях
  //    1кл = GRID px = 1м = 100см → 1см = GRID/100 px
  const CM_TO_PX=GRID/100;
  const avgThickCm=walls.reduce((s,w)=>s+(parseFloat(w.thick)||25),0)/walls.length;
  const halfThickPx=(avgThickCm/2)*CM_TO_PX;

  // 6. Внутрішня площа: A_inner = A_outer − P × halfThick + π × halfThick²
  //    (формула паралельного зміщення контуру всередину)
  const innerAreaPx=outerAreaPx - perimPx*halfThickPx + Math.PI*halfThickPx*halfThickPx;

  // 7. px² → м²: GRID px = 1м (1 клітинка)
  const PX_TO_M=1.0/GRID;
  const areaM2=Math.max(0, innerAreaPx*PX_TO_M*PX_TO_M).toFixed(1);

  badge.style.display='inline-flex';
  badge.textContent=areaM2+' м²';
  return parseFloat(areaM2);
}
function getArea(){return calcArea()||0;}

function setTool(t){
  S.tool=t;
  cancelPlaceEl(); // при виборі будь-якого інструменту — скидаємо режим place
  document.querySelectorAll('.titem').forEach(el=>el.classList.toggle('on',el.id==='tool-'+t));
  cv.style.cursor=t==='wall'?'crosshair':t==='erase'?'cell':'default';
}
function setDrawMode(btn,t){
  setTool(t);
  document.querySelectorAll('.ctbtn').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
}
function undoLast(){
  const u=S.undo.pop(); if(!u) return;
  if(u.type==='wall') S.walls.pop();
  if(u.type==='elem') S.elems.pop();
  redraw();
}
function clearAll(){
  if(!S.walls.length&&!S.elems.length){notify('Схема вже порожня','wa');return;}
  S.walls=[]; S.elems=[]; S.undo=[];
  cancelPlaceEl();
  redraw();
  document.getElementById('hint').style.display='block';
  document.getElementById('areaBadge').style.display='none';
  notify('🗑️ Схему очищено');
}
function eraseAt(x,y){
  const R=20;
  S.walls=S.walls.filter(w=>{
    // dist point to segment
    const dx=w.x2-w.x1,dy=w.y2-w.y1;
    const t=Math.max(0,Math.min(1,((x-w.x1)*dx+(y-w.y1)*dy)/(dx*dx+dy*dy||1)));
    const px=w.x1+t*dx,py=w.y1+t*dy;
    return Math.hypot(x-px,y-py)>R;
  });
  S.elems=S.elems.filter(el=>Math.hypot(x-el.x,y-el.y)>R);
  redraw();
}

/* CLICK-TO-PLACE ELEMENTS */
S.placeEl = null; // поточний вибраний тип елементу для розміщення
S.cursorX = 0; S.cursorY = 0;

// Скинути режим place
function cancelPlaceEl(){
  S.placeEl=null;
  document.getElementById('elHint').style.display='none';
  document.getElementById('srcHint').style.display='none';
  document.querySelectorAll('[id^=el-]').forEach(e=>e.classList.remove('on'));
  cv.style.cursor = S.tool==='wall'?'crosshair':'default';
}

function selectEl(type){
  if(S.placeEl===type){ cancelPlaceEl(); return; }
  S.placeEl=type;
  document.querySelectorAll('[id^=el-]').forEach(e=>e.classList.remove('on'));
  document.getElementById('el-'+type)?.classList.add('on');
  const names={
    window:'Вікно', door:'Двері', pipe:'Труба', vent:'Вентиляція',
    'src-person':'Людина (джерело)', 'src-pc':'Обладнання (джерело)',
    'src-multi':'Комбіноване (джерело)', 'src-table':'Стіл/зона (джерело)'
  };
  // ховаємо обидві плашки, показуємо ту, що відповідає блоку вибору
  document.getElementById('elHint').style.display='none';
  document.getElementById('srcHint').style.display='none';
  if(EL_IS_SOURCE(type)){
    document.getElementById('srcHintName').textContent=names[type]||type;
    document.getElementById('srcHint').style.display='block';
  } else {
    document.getElementById('elHintName').textContent=names[type]||type;
    document.getElementById('elHint').style.display='block';
  }
  cv.style.cursor='cell';
}

function updateSrcInfo(){
  const hasSrc=S.elems.some(e=>EL_IS_SOURCE(e.type));
  const info=document.getElementById('srcInfo');
  if(info) info.style.display=hasSrc?'none':'block';
}

function placeElOnCanvas(x,y){
  const names={
    window:'Вікно',door:'Двері',pipe:'Труба',vent:'Вентиляція',
    'src-person':'Людина','src-pc':'Обладнання','src-multi':'Комбіноване','src-table':'Стіл/зона'
  };
  S.undo.push({type:'elem',idx:S.elems.length});
  S.elems.push({type:S.placeEl,x,y}); redraw();
  updateSrcInfo();
  notify('✅ '+( names[S.placeEl]||S.placeEl )+' поставлено — вставити ще або Esc');
}

// залишаємо drag&drop як запасний варіант

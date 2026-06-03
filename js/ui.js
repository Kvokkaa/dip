/* ═══ ІНТЕРФЕЙС (ui.js) ═══
   Збереження/завантаження, експорт PDF, база компонентів, вивід результату. */

/* ══ SAVE/LOAD ══ */
// Зберігаємо схему: і в localStorage (швидкий доступ), і у файл .json (для перенесення)
function saveSchema(){
  if(!S.walls.length){notify('⚠️ Намалюйте схему спочатку','wa');return;}
  const sc={
    id:Date.now(),
    name:'Схема '+new Date().toLocaleTimeString('uk'),
    area:getArea(),
    walls:JSON.parse(JSON.stringify(S.walls)),
    elems:JSON.parse(JSON.stringify(S.elems)),
    mat:document.getElementById('wMat').value,
    thick:document.getElementById('wThick').value,
    roomH:document.getElementById('roomH').value,
    cls:document.querySelector('input[name=cls]:checked')?.value||'2'
  };
  // в пам'ять браузера
  S.schemas.push(sc);
  localStorage.setItem('ksc',JSON.stringify(S.schemas));
  updSelects();
  // у файл
  const blob=new Blob([JSON.stringify(sc,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='kszi_shema_'+new Date().toISOString().slice(0,10)+'.json';
  a.click();
  URL.revokeObjectURL(a.href);
  notify('💾 Схему збережено (у пам\'ять і файл .json)','ok');
}

// Завантаження: або з файлу .json, або зі збережених у пам'яті
function loadSchemaUI(){
  const inp=document.getElementById('schemaFile');
  if(inp) inp.click(); // відкриваємо діалог вибору файлу
}

// обробка вибраного файлу
function loadSchemaFromFile(ev){
  const file=ev.target.files[0];
  if(!file) return;
  const reader=new FileReader();
  reader.onload=function(e){
    try{
      const sc=JSON.parse(e.target.result);
      applySchema(sc);
      notify('📂 Схему завантажено з файлу!','ok');
    }catch(err){
      notify('❌ Помилка: файл пошкоджено або невірний формат','er');
    }
  };
  reader.readAsText(file);
  ev.target.value=''; // щоб можна було завантажити той самий файл ще раз
}

// застосувати завантажену схему до полотна
function applySchema(sc){
  if(!sc || !sc.walls){notify('❌ Невірний формат схеми','er');return;}
  S.walls=JSON.parse(JSON.stringify(sc.walls));
  S.elems=JSON.parse(JSON.stringify(sc.elems||[]));
  if(sc.mat) document.getElementById('wMat').value=sc.mat;
  if(sc.thick) document.getElementById('wThick').value=sc.thick;
  if(sc.roomH) document.getElementById('roomH').value=sc.roomH;
  if(sc.cls){
    const radio=document.querySelector('input[name=cls][value="'+sc.cls+'"]');
    if(radio) radio.checked=true;
  }
  redraw();
}

// завантаження зі збережених у пам'яті (резервний спосіб)
function loadSavedSchema(){
  if(!S.schemas.length){notify('📂 Немає збережених схем','wa');return;}
  const names=S.schemas.map((s,i)=>`${i+1}. ${s.name} (${s.area}м²)`).join('\n');
  const n=prompt('Оберіть схему за номером:\n\n'+names);
  if(!n) return;
  const sc=S.schemas[parseInt(n)-1];
  if(!sc){notify('❌ Невірний номер','er');return;}
  applySchema(sc);
  notify('📂 Схему завантажено з пам\'яті!','ok');
}


/* ══ ЕКСПОРТ У PDF ══ */
// Збираємо акуратний звіт і відкриваємо діалог друку (Зберегти як PDF).
// Працює у будь-якому браузері без зовнішніх бібліотек.
function exportResultPDF(){
  const res=S.lastResult;
  if(!res){notify('⚠️ Спочатку згенеруйте конфігурацію','wa');return;}
  const a=res.acoustic||{};

  // 1. малюнок схеми беремо з канви результату (як картинку PNG)
  let schemaImg='';
  const rc=document.getElementById('rcv');
  if(rc){
    try{ schemaImg=rc.toDataURL('image/png'); }catch(e){ schemaImg=''; }
  }

  // 2. таблиця компонентів
  let rows='';
  for(let i=0;i<res.components.length;i++){
    const c=res.components[i];
    rows+=`<tr>
      <td>${i+1}</td>
      <td>${c.name}</td>
      <td>${c.maker||'-'}</td>
      <td style="text-align:center">${c.effectDB} дБ</td>
      <td style="text-align:center">${c.qty}</td>
      <td style="text-align:right">${c.price.toLocaleString()} грн</td>
      <td style="text-align:right">${(c.price*c.qty).toLocaleString()} грн</td>
    </tr>`;
  }
  if(!rows) rows='<tr><td colspan="7" style="text-align:center;color:#888">Активні засоби не потрібні — пасивної ізоляції достатньо</td></tr>';

  // 3. вердикт
  const passText = a.pass ? 'ВІДПОВІДАЄ вимогам' : 'НЕ ВІДПОВІДАЄ вимогам';
  const passColor = a.pass ? '#1a7d3c' : '#c0392b';

  // 4. список вразливостей
  let vuln=[];
  if(a.counts){
    if(a.counts.window) vuln.push('вікна: '+a.counts.window);
    if(a.counts.door)   vuln.push('двері: '+a.counts.door);
    if(a.counts.vent)   vuln.push('вентиляція: '+a.counts.vent);
    if(a.counts.pipe)   vuln.push('труби: '+a.counts.pipe);
  }
  const vulnText = vuln.length ? vuln.join(', ') : 'немає';

  // 5. збираємо HTML звіту з фіксованою версткою A4
  const today=new Date().toLocaleString('uk');
  const html=`<!DOCTYPE html><html lang="uk"><head><meta charset="utf-8">
<title>Звіт КСЗІ — категорія ${res.cls}</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, 'DejaVu Sans', sans-serif; color:#1a1a1a; margin:0; font-size:12px; line-height:1.5; }
  h1 { font-size:20px; margin:0 0 2px; }
  h2 { font-size:14px; margin:18px 0 8px; padding-bottom:4px; border-bottom:2px solid #4f6cff; color:#2a3550; }
  .sub { color:#666; font-size:11px; margin-bottom:14px; }
  .verdict { padding:10px 14px; border:2px solid ${passColor}; border-radius:8px; margin:14px 0; }
  .verdict b { color:${passColor}; font-size:15px; }
  table { width:100%; border-collapse:collapse; margin:8px 0; font-size:11px; }
  th, td { border:1px solid #ccc; padding:5px 7px; }
  th { background:#f0f3fa; text-align:left; }
  .grid { width:100%; border-collapse:collapse; font-size:12px; }
  .grid td { border:none; padding:3px 0; }
  .grid td:first-child { color:#555; }
  .grid td:last-child { text-align:right; font-weight:bold; }
  .schema { text-align:center; margin:10px 0; }
  .schema img { max-width:100%; max-height:300px; border:1px solid #ddd; border-radius:6px; }
  .total { text-align:right; font-size:14px; font-weight:bold; margin-top:6px; }
  .foot { margin-top:24px; padding-top:8px; border-top:1px solid #ddd; color:#999; font-size:10px; }
  @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } .noprint { display:none; } }
</style></head><body>

  <h1>Звіт з підбору засобів технічного захисту мовної інформації</h1>
  <div class="sub">Комплексна система захисту інформації (КСЗІ) · сформовано: ${today}</div>

  <div class="verdict">
    Конфігурація <b>${passText}</b> категорії ${a.catName||res.cls} (норма словесної розбірливості W ≤ ${a.Wtarget}%).
    <br>Досягнута розбірливість: W = ${a.Wfinal}%.
  </div>

  <h2>1. Параметри приміщення</h2>
  <table class="grid">
    <tr><td>Площа приміщення</td><td>${res.area} м²</td></tr>
    <tr><td>Висота приміщення</td><td>${res.roomH} м</td></tr>
    <tr><td>Категорія об'єкта (ТПКО-95)</td><td>${a.catName||res.cls}</td></tr>
    <tr><td>Вразливі вузли</td><td>${vulnText}</td></tr>
  </table>

  <h2>2. Акустичний розрахунок (метод словесної розбірливості W)</h2>
  <table class="grid">
    <tr><td>Пасивна ізоляція оболонки (R)</td><td>${a.Rpass} дБ</td></tr>
    <tr><td>Штраф за близькість/кількість джерел</td><td>−${a.expo} дБ</td></tr>
    <tr><td>Бонус від перегородок</td><td>+${a.pbonus} дБ</td></tr>
    <tr><td>Ефективна ізоляція</td><td>${a.Reff} дБ</td></tr>
    <tr><td>Розбірливість без активного захисту</td><td>${a.Wpassive} %</td></tr>
    <tr><td>Потрібне маскування</td><td>${a.requiredActive} дБ</td></tr>
    <tr><td>Активні засоби дають (×покриття)</td><td>${a.achievedMask} дБ</td></tr>
    <tr><td>Підсумкова розбірливість W</td><td>${a.Wfinal} % (норма ≤ ${a.Wtarget} %)</td></tr>
  </table>

  <h2>3. Перелік засобів захисту</h2>
  <table>
    <thead><tr><th>№</th><th>Найменування</th><th>Виробник</th><th>Ефект</th><th>К-ть</th><th>Ціна/шт</th><th>Сума</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="total">Загальна вартість: ${res.total.toLocaleString()} грн</div>

  <h2>4. Схема приміщення</h2>
  <div class="schema">${schemaImg ? '<img src="'+schemaImg+'">' : '<p style="color:#888">Схема недоступна</p>'}</div>

  <div class="foot">
    Розрахунок виконано за методом оцінки словесної розбірливості мовлення W (Покровський, Хорєв) у 5 октавних смугах.
    Категорії об'єктів за ТПКО-95, норми захисту — НД ТЗІ. Документ сформовано автоматично системою КСЗІ v3.0.
  </div>

  <script>
    window.onload=function(){ setTimeout(function(){ window.print(); }, 350); };
  <\/script>
</body></html>`;

  // 6. відкриваємо звіт у новому вікні і друкуємо
  const win=window.open('','_blank');
  if(!win){ notify('❌ Дозвольте спливаючі вікна для друку PDF','er'); return; }
  win.document.open();
  win.document.write(html);
  win.document.close();
  notify('📄 Звіт відкрито — оберіть «Зберегти як PDF»','ok');
}

// Периметр контуру в метрах (по полігону, або сума довжин стін як запасний варіант)
function perimMeters(walls){
  const poly = buildOuterPolygon(walls);
  if(poly) return perimeterPx(poly)/GRID;
  let p=0;
  for(let i=0;i<walls.length;i++){
    const w=walls[i];
    p += Math.hypot(w.x2-w.x1, w.y2-w.y1);
  }
  return p/GRID;
}

// Композитна ізоляція оболонки (ДСТУ Б В.1.1-10 / ISO 12354):
// R = -10*log10( сума(Si * 10^(-Ri/10)) / Sзаг ).
// Слабкий елемент (вікно/вентиляція/труба) з малою площею різко знижує ізоляцію всієї стіни.
function envelopeR(loadWalls, elems, perimM, roomH){
  const Stot = Math.max(perimM*roomH, 1); // площа оболонки, м²

  // середня звукопроникність стін, зважена за довжиною сегментів
  let wallTauLen=0, totLen=0;
  for(let i=0;i<loadWalls.length;i++){
    const w=loadWalls[i];
    const len=Math.hypot(w.x2-w.x1, w.y2-w.y1)/GRID; // м
    const R=matR(w.mat, w.thick);
    wallTauLen += len * Math.pow(10, -R/10);
    totLen += len;
  }
  let wallTauPerArea;
  if(totLen>0) wallTauPerArea = wallTauLen/totLen;
  else wallTauPerArea = Math.pow(10, -52/10); // запасне значення (цегла)

  // рахуємо елементи-вразливості
  const counts={window:0, door:0, vent:0, pipe:0};
  for(let i=0;i<elems.length;i++){
    const t=elems[i].type;
    if(counts[t]!==undefined) counts[t]++;
  }
  let elemArea=0, elemTauArea=0;
  for(const key in counts){
    const n=counts[key];
    if(n>0){
      const cfg=EL_ACOUSTIC[key];
      const a=cfg.area*n;
      elemArea += a;
      elemTauArea += a * Math.pow(10, -cfg.R/10);
    }
  }

  const wallNet = Math.max(Stot-elemArea, Stot*0.05);
  const tauAvg = (wallNet*wallTauPerArea + elemTauArea)/Stot;
  return { R:-10*Math.log10(tauAvg), Stot:Stot, elemArea:elemArea, counts:counts };
}

// Штраф за джерела звуку. Враховуємо ТРИ фактори:
//  1) близькість найближчого джерела до стіни (вільне поле: 6 дБ на подвоєння відстані);
//  2) кількість джерел — більше джерел = більше сумарної енергії (+3 дБ на подвоєння кількості);
//  3) тип джерела — людина/обладнання/комбіноване мають різну гучність.
function exposurePenalty(sources, loadWalls, areaM2){
  if(sources.length===0 || loadWalls.length===0) return 0;

  // "гучність" за типом джерела (умовні рівні)
  const loudness={'src-person':1.0, 'src-pc':0.7, 'src-multi':1.3, 'src-table':0.9};

  // 1. мінімальна відстань від джерела до середини найближчої стіни
  let dmin=Infinity;
  for(let i=0;i<sources.length;i++){
    const s=sources[i];
    for(let j=0;j<loadWalls.length;j++){
      const w=loadWalls[j];
      const mx=(w.x1+w.x2)/2, my=(w.y1+w.y2)/2;
      const d=Math.hypot(s.x-mx, s.y-my)/GRID; // м
      if(d<dmin) dmin=d;
    }
  }
  if(!isFinite(dmin)) return 0;
  if(dmin<0.3) dmin=0.3;

  const dref=Math.max(1, Math.sqrt(areaM2)/2);
  let distPenalty = 6*Math.log2(dref/dmin); // штраф за близькість
  if(distPenalty<0) distPenalty=0;

  // 2. сумарна "гучність" усіх джерел з урахуванням типу
  let totalLoud=0;
  for(let i=0;i<sources.length;i++){
    totalLoud += (loudness[sources[i].type]||1.0);
  }
  // енергетичне додавання: +3 дБ на кожне подвоєння сумарної гучності
  let countPenalty = 3*Math.log2(totalLoud);
  if(countPenalty<0) countPenalty=0;

  let penalty = distPenalty + countPenalty;
  if(penalty>15) penalty=15; // обмежуємо зверху
  return penalty;
}

// Бонус від внутрішніх перегородок (додаткове поглинання звуку)
function partitionBonus(walls){
  let len=0;
  for(let i=0;i<walls.length;i++){
    const w=walls[i];
    if(w.type==='part') len += Math.hypot(w.x2-w.x1, w.y2-w.y1)/GRID;
  }
  let bonus=len*0.4;
  if(bonus>5) bonus=5; // не більше +5 дБ
  return bonus;
}


// ── Перевірка контуру / вивід результату ──
function isContourClosed(){
  // Перевіряємо ТІЛЬКИ зовнішні стіни (несучі, type==='load')
  // Перегородки навмисно незамкнені — їх ігноруємо
  const outer=S.walls.filter(w=>w.type==='load');
  const walls=outer.length>=3 ? outer : S.walls;
  if(walls.length<3) return false;

  const TOL=GRID*1.5;
  // Збираємо всі кінцеві точки
  const pts=[];
  walls.forEach(w=>{
    pts.push({x:w.x1,y:w.y1});
    pts.push({x:w.x2,y:w.y2});
  });
  // Кожна точка повинна мати хоча б одну пару в межах TOL
  // (з'єднана з іншою стіною)
  const unmatched=pts.filter(p=>{
    const paired=pts.some(q=>q!==p&&Math.hypot(p.x-q.x,p.y-q.y)<TOL);
    return !paired;
  });
  return unmatched.length===0;
}

function showContourError(){
  // Підсвічуємо тільки незамкнені кінці ЗОВНІШНІХ стін
  const outer=S.walls.filter(w=>w.type==='load');
  const walls=outer.length>=3 ? outer : S.walls;
  const TOL=GRID*1.5;

  // Збираємо всі точки зовнішніх стін
  const allPts=[];
  walls.forEach(w=>{allPts.push({x:w.x1,y:w.y1},{x:w.x2,y:w.y2});});

  ctx.save();
  walls.forEach(w=>{
    [{x:w.x1,y:w.y1},{x:w.x2,y:w.y2}].forEach(p=>{
      const paired=allPts.some(q=>(q.x!==p.x||q.y!==p.y)&&Math.hypot(p.x-q.x,p.y-q.y)<TOL);
      if(!paired){
        // Червоне коло на незамкненому кінці
        ctx.beginPath(); ctx.arc(p.x,p.y,10,0,Math.PI*2);
        ctx.fillStyle='rgba(255,90,90,0.25)'; ctx.fill();
        ctx.strokeStyle='#ff5a5a'; ctx.lineWidth=2; ctx.setLineDash([]);
        ctx.stroke();
        ctx.fillStyle='#ff5a5a'; ctx.font='bold 11px Manrope,sans-serif';
        ctx.textAlign='center'; ctx.fillText('!',p.x,p.y+4); ctx.textAlign='left';
      }
    });
  });
  ctx.restore();
}

// Скидання попереднього результату (щоб не лишався застарілий розрахунок)
function clearResult(){
  S.lastResult=null;
  const sec=document.getElementById('result');
  if(sec) sec.style.display='none';
}


function showResult(res){
  S.lastResult=res; // запам'ятовуємо для експорту в PDF
  const sec=document.getElementById('result');
  sec.style.display='block';
  const a=res.acoustic||{};

  // Інфо-рядок із джерелами
  const srcNames={'src-person':'Людина','src-pc':'Обладнання','src-multi':'Комбіноване','src-table':'Стіл/зона'};
  const srcLabel=res.sources&&res.sources.length
    ? res.sources.map(s=>srcNames[s.type]||s.type).join(', ')
    : 'без джерел (рівномірно)';
  const riskLabel=a.expo>1.5?'🔴 Підвищений (джерело близько до стіни)':'🟢 Стандартний';
  document.getElementById('resInfo').innerHTML=
    `Розраховано: ${new Date().toLocaleString('uk')} · Площа: ${res.area} м² · Висота: ${res.roomH} м · Категорія ${a.catName||res.cls}<br>
     <span style="font-size:12px;color:var(--t2)">Джерела: <b>${srcLabel}</b> · Ризик: ${riskLabel}</span>`;

  const units=res.components.reduce((s,c)=>s+c.qty,0);
  const passColor = a.pass ? 'var(--ok)' : 'var(--er)';
  const passText = a.pass ? '✅ ВІДПОВІДАЄ' : '❌ НЕ ВІДПОВІДАЄ';

  // Картки-показники: головний — словесна розбірливість W
  document.getElementById('resStats').innerHTML=`
    <div class="stat-card"><div class="stat-label">Площа</div><div class="stat-val">${res.area}</div><div class="stat-unit">м²</div></div>
    <div class="stat-card"><div class="stat-label">Одиниць</div><div class="stat-val">${units}</div><div class="stat-unit">шт</div></div>
    <div class="stat-card"><div class="stat-label">Вартість</div><div class="stat-val">${(res.total/1000).toFixed(1)}к</div><div class="stat-unit">грн</div></div>
    <div class="stat-card"><div class="stat-label">Розбірливість W</div><div class="stat-val" style="color:${passColor}">${a.Wfinal}%</div><div class="stat-unit">норма ≤${a.Wtarget}%</div></div>`;

  // Блок акустичного вердикту
  const breakdown=[];
  if(a.counts){
    if(a.counts.window) breakdown.push(`🪟 Вікна ×${a.counts.window} (Rw ${EL_ACOUSTIC.window.R} дБ)`);
    if(a.counts.door) breakdown.push(`🚪 Двері ×${a.counts.door} (Rw ${EL_ACOUSTIC.door.R} дБ)`);
    if(a.counts.vent) breakdown.push(`💨 Вентиляція ×${a.counts.vent} (Rw ${EL_ACOUSTIC.vent.R} дБ)`);
    if(a.counts.pipe) breakdown.push(`🔧 Труби ×${a.counts.pipe} (Rw ${EL_ACOUSTIC.pipe.R} дБ)`);
  }
  const verdict=document.getElementById('resVerdict');
  if(verdict){
    verdict.innerHTML=`
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <span style="font-size:15px;font-weight:700;color:${passColor}">${passText}</span>
        <span style="font-size:12px;color:var(--t2)">вимогам категорії ${a.catName||res.cls} (W ≤ ${a.Wtarget}%)</span>
      </div>
      <div class="acoustic-grid">
        <div><span>Пасивна ізоляція оболонки</span><b>${a.Rpass} дБ</b></div>
        <div><span>Штраф за близькість/кількість джерел</span><b>${a.expo>0?'−'+a.expo:'0'} дБ</b></div>
        <div><span>Бонус перегородок</span><b>${a.pbonus>0?'+'+a.pbonus:'0'} дБ</b></div>
        <div><span>Ефективна ізоляція</span><b>${a.Reff} дБ</b></div>
        <div><span>Розбірливість без захисту</span><b>${a.Wpassive}%</b></div>
        <div><span>Потрібно маскування</span><b>${a.requiredActive} дБ</b></div>
        <div><span>Активні засоби дають (×покриття)</span><b>${a.achievedMask} дБ</b></div>
        <div><span>Підсумкова розбірливість W</span><b style="color:${passColor}">${a.Wfinal}% (норма ≤${a.Wtarget}%)</b></div>
      </div>
      ${breakdown.length?`<div style="margin-top:9px;font-size:11px;color:var(--t2)">Вразливості: ${breakdown.join(' · ')}</div>`:''}
      ${!a.pass?`<div style="margin-top:9px;padding:8px 10px;background:rgba(255,90,90,.08);border:1px solid var(--er);border-radius:7px;font-size:11px;color:var(--er)">⚠️ Розбірливість ${a.Wfinal}% вища за норму ${a.Wtarget}%. Підсильте звукоізоляцію, зменшіть вразливості (вікна/вент/труби) або додайте потужніші засоби зашумлення.</div>`:''}`;
  }

  // Список компонентів (об'єднаний, без дублів)
  document.getElementById('resList').innerHTML = res.components.length ? res.components.map(c=>`
    <div class="clist-item">
      <div><div class="clist-name">${c.name}</div><div class="clist-sub">${c.maker} · ${c.effectDB} дБ · покр. ${c.coverage} м²</div></div>
      <div class="clist-price"><div>${c.qty} шт × ${c.price.toLocaleString()} грн</div><div class="clist-total">${(c.qty*c.price).toLocaleString()} грн</div></div>
    </div>`).join('')
    : `<div style="padding:14px;text-align:center;font-size:12px;color:var(--ok)">✅ Пасивної ізоляції оболонки достатньо — активні засоби не потрібні.</div>`;
  document.getElementById('resTot').textContent=res.total.toLocaleString()+' грн';

  drawResultCV(res);
  setTimeout(()=>sec.scrollIntoView({behavior:'smooth',block:'start'}),80);
  notify(a.pass?'✅ Конфігурацію згенеровано — категорію виконано!':'⚠️ Згенеровано, але категорію НЕ виконано', a.pass?'ok':'wa');
}

function drawResultCV(res){
  const rc=document.getElementById('rcv');
  const W=rc.parentElement.clientWidth||560;
  const H=Math.max(320, Math.round(W*0.62));
  rc.width=W; rc.height=H;
  const rx=rc.getContext('2d');
  rx.fillStyle=getVar('--bg'); rx.fillRect(0,0,W,H);

  const PAD=28;
  const walls=res.walls||[], elems=res.elems||[];

  // bounding box оригінальних координат
  let mnx=Infinity,mxx=-Infinity,mny=Infinity,mxy=-Infinity;
  walls.forEach(w=>{ mnx=Math.min(mnx,w.x1,w.x2); mxx=Math.max(mxx,w.x1,w.x2);
                     mny=Math.min(mny,w.y1,w.y2); mxy=Math.max(mxy,w.y1,w.y2); });
  if(!isFinite(mnx)){mnx=0;mxx=W;mny=0;mxy=H;}
  const srcW=Math.max(mxx-mnx,1), srcH=Math.max(mxy-mny,1);

  // масштаб, що вписує контур у холст із відступами (-18 під легенду)
  const scale=Math.min((W-PAD*2)/srcW, (H-PAD*2-18)/srcH);
  const offX=PAD+(W-PAD*2-srcW*scale)/2;
  const offY=PAD+(H-PAD*2-18-srcH*scale)/2;
  const tx=x=>(x-mnx)*scale+offX, ty=y=>(y-mny)*scale+offY;

  // сітка
  const gSize=Math.max(10,GRID*scale);
  rx.strokeStyle=getVar('--b'); rx.lineWidth=.35; rx.setLineDash([]);
  for(let x=offX%gSize;x<W;x+=gSize){rx.beginPath();rx.moveTo(x,0);rx.lineTo(x,H);rx.stroke();}
  for(let y=offY%gSize;y<H;y+=gSize){rx.beginPath();rx.moveTo(0,y);rx.lineTo(W,y);rx.stroke();}

  // стіни
  walls.forEach(w=>{
    const col=MAT_COLORS[w.mat]||getVar('--ac');
    rx.strokeStyle=col; rx.lineWidth=Math.max(2,(w.thick/8)*scale); rx.lineCap='round';
    rx.setLineDash(w.type==='part'?[6,4]:[]);
    rx.beginPath(); rx.moveTo(tx(w.x1),ty(w.y1)); rx.lineTo(tx(w.x2),ty(w.y2)); rx.stroke();
    rx.setLineDash([]);
  });

  // елементи приміщення та джерела (масштабовані)
  elems.forEach(el=>{
    const ex=tx(el.x), ey=ty(el.y);
    const col=EL_COLORS[el.type]||'#888', label=EL_LABELS[el.type]||el.type;
    const s=Math.max(6, (EL_IS_SOURCE(el.type)?12:10)*scale);
    rx.save();
    if(EL_IS_SOURCE(el.type)){
      rx.beginPath(); rx.arc(ex,ey,s,0,Math.PI*2); rx.fillStyle=col+'cc'; rx.fill();
      rx.strokeStyle=col; rx.lineWidth=2; rx.stroke();
      rx.strokeStyle='#fff'; rx.lineWidth=1.5;
      rx.beginPath(); rx.moveTo(ex-5,ey); rx.lineTo(ex+5,ey); rx.stroke();
      rx.beginPath(); rx.moveTo(ex,ey-5); rx.lineTo(ex,ey+5); rx.stroke();
    } else {
      rx.fillStyle=col+'88'; rx.strokeStyle=col; rx.lineWidth=1.5;
      rx.beginPath();
      if(rx.roundRect) rx.roundRect(ex-s,ey-s,s*2,s*2,3); else rx.rect(ex-s,ey-s,s*2,s*2);
      rx.fill(); rx.stroke();
    }
    rx.fillStyle=col; rx.font=`bold ${Math.max(7,8*scale)}px Manrope,sans-serif`;
    rx.textAlign='center'; rx.fillText(label,ex,ey+s+9); rx.textAlign='left';
    rx.restore();
  });

  // ── розміщення компонентів (глушилок) на захищуваних поверхнях ──
  const cols=['#4f8cff','#2dce78','#f5a623','#8b5cf6','#ff5a5a','#06b6d4','#f06090','#50e0d0'];
  const cx=(mnx+mxx)/2, cy=(mny+mxy)/2; // центр кімнати (щоб зсувати прилади трохи всередину)

  // точки вздовж периметра несучих стін (для основного покриття)
  const loadWalls=walls.filter(w=>w.type==='load');
  function pointsAlongWalls(n){
    const pts=[];
    if(loadWalls.length===0 || n<=0) return pts;
    // загальна довжина периметра
    let totLen=0;
    const segs=loadWalls.map(w=>{
      const len=Math.hypot(w.x2-w.x1,w.y2-w.y1); totLen+=len; return {w,len};
    });
    // рівномірно розкидаємо n точок по довжині
    for(let i=0;i<n;i++){
      let target=totLen*(i+0.5)/n, acc=0, chosenSeg=segs[0];
      for(const sg of segs){ if(acc+sg.len>=target){ chosenSeg=sg; break; } acc+=sg.len; }
      const sg=chosenSeg, t=sg.len>0?(target-acc)/sg.len:0.5;
      let x=sg.w.x1+(sg.w.x2-sg.w.x1)*t;
      let y=sg.w.y1+(sg.w.y2-sg.w.y1)*t;
      // зсуваємо точку всередину кімнати (щоб не лежала на лінії стіни і не злипалася
      // з приладами біля вікон/дверей, які стоять майже на стіні)
      x += (cx-x)*0.22; y += (cy-y)*0.22;
      pts.push({x,y});
    }
    return pts;
  }

  // елементи певного типу (для прив'язки глушилок до вікон/дверей/труб/вент)
  function elemsOfType(t){ return elems.filter(e=>e.type===t); }

  // збираємо всі прилади з прив'язкою до місця
  const placements=[]; // {x,y,name,ci}
  const targetToElem={windows:'window', doors:'door', vent:'vent', pipe:'pipe'};
  res.components.forEach((comp,ci)=>{
    const tgt=comp.target||'walls';
    if(tgt==='walls'){
      // основне покриття — вздовж стін
      const pts=pointsAlongWalls(comp.qty);
      pts.forEach(p=>placements.push({x:p.x,y:p.y,name:comp.name,ci}));
    } else {
      // прив'язуємо до відповідних елементів (вікна/двері/труби/вент)
      const targets=elemsOfType(targetToElem[tgt]);
      for(let q=0;q<comp.qty;q++){
        const el=targets[q%Math.max(1,targets.length)];
        if(el){
          // трохи зсуваємо до центру, щоб глушилка стояла "біля" елемента зсередини
          let x=el.x+(cx-el.x)*0.12, y=el.y+(cy-el.y)*0.12;
          placements.push({x,y,name:comp.name,ci});
        } else {
          // якщо елемента раптом нема — на стіну
          const pts=pointsAlongWalls(comp.qty);
          if(pts[q]) placements.push({x:pts[q].x,y:pts[q].y,name:comp.name,ci});
        }
      }
    }
  });

  // малюємо глушилки
  placements.forEach(pl=>{
    const px=tx(pl.x), py=ty(pl.y);
    if(px<2||py<2||px>W-2||py>H-18) return;
    const color=cols[pl.ci%cols.length];
    const radius=Math.max(8, 14*scale);
    rx.beginPath(); rx.arc(px,py,radius,0,Math.PI*2);
    rx.fillStyle=color+'20'; rx.fill();
    rx.strokeStyle=color; rx.lineWidth=1; rx.setLineDash([3,2]); rx.stroke(); rx.setLineDash([]);
    rx.beginPath(); rx.arc(px,py,3.5,0,Math.PI*2); rx.fillStyle=color; rx.fill();
    rx.fillStyle=color; rx.font='bold 7px JetBrains Mono,monospace'; rx.textAlign='center';
    rx.fillText(pl.name,px,py-radius-2); rx.textAlign='left';
  });

  // легенда матеріалів
  const mats=[...new Set(walls.map(w=>w.mat))];
  let lx=8, ly=H-6;
  rx.font='8px JetBrains Mono,monospace';
  mats.forEach(m=>{
    const col=MAT_COLORS[m]||'#888';
    const lbl=(MAT_AC[m]&&MAT_AC[m].name)||m;
    rx.fillStyle=col; rx.fillRect(lx,ly-8,12,4);
    rx.fillStyle=getVar('--t2'); rx.fillText(lbl,lx+15,ly-2);
    lx+=70; if(lx>W-80){lx=8;ly-=14;}
  });
}


/* ══ DB ══ */
let dbFilter='all';
function renderDB(){
  const q=(document.getElementById('dbQ')?.value||'').toLowerCase();
  let data=DB.filter(c=>dbFilter==='all'||c.type===dbFilter).filter(c=>
    !q||c.name.toLowerCase().includes(q)||c.maker.toLowerCase().includes(q)||(c.concl||'').toLowerCase().includes(q)
  );
  const tl={generator:'Генератор шуму',vibro:'Вібровипромінювач',combined:'Комбінований'};
  const bc={generator:'b-ok',vibro:'b-wa',combined:'b-ac'};
  const stCls={'Продовжено до кінця ВС':'color:var(--wa)','Продовжено':'color:var(--ok)','2024, діє':'color:var(--ac)'};
  document.getElementById('dbBody').innerHTML=data.length?data.map((c,i)=>`
    <tr>
      <td style="font-family:'JetBrains Mono',monospace;color:var(--tm)">${i+1}</td>
      <td><b>${c.name}</b></td>
      <td><span class="badge ${bc[c.type]}">${tl[c.type]}</span></td>
      <td style="color:var(--t2);font-size:12px;max-width:180px">${c.maker}</td>
      <td style="font-family:'JetBrains Mono',monospace;color:var(--ac)">${c.concl||'—'}</td>
      <td style="font-size:12px;font-weight:600;${stCls[c.status]||'color:var(--t2)'}">${c.status||'—'}</td>
      <td><span class="badge b-ac">${c.classMin}</span></td>
      <td style="font-family:'JetBrains Mono',monospace">${c.coverage}</td>
      <td style="font-family:'JetBrains Mono',monospace;color:var(--ac)">${c.effectDB}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--ok)">${c.price.toLocaleString()}</td>
      <td>${c.cert?'<span style="color:var(--ok)">✅</span>':'<span style="color:var(--er)">❌</span>'}</td>
    </tr>`).join('')
    :`<tr><td colspan="11"><div class="empty"><span class="empty-ic">📦</span>Не знайдено</div></td></tr>`;
}
function renderMats(){
  document.getElementById('matBody').innerHTML=MATS.map(m=>`
    <tr><td><b>${m.m}</b></td><td style="font-family:'JetBrains Mono',monospace">${m.t}</td>
    <td style="font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--ac)">${m.db}</td>
    <td style="font-size:11px;color:var(--t2)">${m.norm}</td>
    <td style="font-size:11px;color:var(--tm)">${m.use}</td></tr>`).join('');
}
function updateStats(){
  document.getElementById('stComp').textContent=DB.length;
  document.getElementById('stCert').textContent=DB.filter(c=>c.cert).length;
  document.getElementById('stMat').textContent=MATS.length;
}
function setChip(el,t){document.querySelectorAll('.chip').forEach(c=>c.classList.remove('on'));el.classList.add('on');dbFilter=t;renderDB();}

/* CSV */
function csvDrop(e){e.preventDefault();document.getElementById('csvZ').classList.remove('dov');const f=e.dataTransfer.files[0];if(f)parseCSV(f);}
function csvFile(e){const f=e.target.files[0];if(f)parseCSV(f);}
function parseCSV(f){
  const r=new FileReader();
  r.onload=e=>{
    const lines=e.target.result.split('\n').filter(l=>l.trim());
    const h=lines[0].split(',').map(x=>x.trim());
    let n=0;
    for(let i=1;i<lines.length;i++){
      const v=lines[i].split(',').map(x=>x.trim()); const row={};
      h.forEach((k,j)=>row[k]=v[j]);
      if(!row.name) continue;
      DB.push({id:Date.now()+i,name:row.name,type:row.type||'generator',maker:row.maker||'',
        power:+row.power||0,coverage:+row.coverage||0,price:+row.price||0,
        classMin:+row.classMin||1,cert:row.cert==='true'||row.cert==='1',
        effectDB:+row.effectDB||0,surfaces:(row.surfaces||'walls').split(';')});
      n++;
    }
    renderDB(); updateStats(); notify(`✅ Імпортовано ${n} компонентів`,'ok');
  };
  r.readAsText(f,'utf-8');
}
function dlTemplate(){
  const c='name,type,maker,power,coverage,price,classMin,cert,effectDB,surfaces\nVG-Example,generator,ТОВ "Приклад",6,25,8400,2,true,52,walls;floors\n';
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([c],{type:'text/csv'}));
  a.download='kszi_template.csv'; a.click();
}
function exportJSON(){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify(DB,null,2)],{type:'application/json'}));
  a.download='kszi_db.json'; a.click();
}
function exportCSV(){
  const h='name,type,maker,power,coverage,price,classMin,cert,effectDB';
  const rows=DB.map(c=>[c.name,c.type,c.maker,c.power,c.coverage,c.price,c.classMin,c.cert,c.effectDB].join(','));
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([[h,...rows].join('\n')],{type:'text/csv'}));
  a.download='kszi_components.csv'; a.click();
}

/* ══ SELECTS ══ */
function updSelects(){
  const opts=S.results.length
    ?S.results.map(r=>`<option value="${r.id}">${r.name} (${r.area}м²)</option>`).join('')
    :'<option value="">— Немає результатів —</option>';
  ['gaSrc','aiSel'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML=opts;});
}

/* ══ NOTIFY ══ */
function notify(msg,type=''){
  const c={ok:'var(--ok)',wa:'var(--wa)',er:'var(--er)'}[type]||'var(--ac)';
  const d=document.createElement('div');
  d.className='notif'; d.style.borderLeftColor=c; d.innerHTML=msg;
  document.getElementById('nf').appendChild(d);
  setTimeout(()=>{d.style.opacity='0';d.style.transition='opacity .3s';setTimeout(()=>d.remove(),300);},3000);
}

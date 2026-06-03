/* ═══ ЗАСТОСУНОК (app.js) ═══
   Стан, ініціалізація, вкладки, тема, зв'язок фронту з розрахунковим ядром. */



/* ══ INIT ══ */
window.addEventListener('DOMContentLoaded',()=>{
  setTheme(S.theme,1);
  initCanvas();
  renderDB(); renderMats(); updateStats();
  updSelects();
});

/* ══ TABS ══ */
function goTab(i,btn){
  // перемикаємо сторінки за id (p0 — схема, p3 — база компонентів)
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('on'));
  const page=document.getElementById('p'+i);
  if(page) page.classList.add('on');
  document.querySelectorAll('.ntab').forEach(b=>b.classList.remove('on'));
  if(btn) btn.classList.add('on');
  if(i===3){renderDB();updateStats();}
  updSelects();
}

/* ══ THEME ══ */
function setTheme(t,s){
  S.theme=t; document.documentElement.setAttribute('data-theme',t);
  localStorage.setItem('kth',t);
  const map={dark:'🌑',light:'☀️',spruce:'🌲',violet:'💜'};
  document.querySelectorAll('.tbtn').forEach(b=>{
    b.classList.toggle('on',b.title===t);
  });
  if(!s) notify('🎨 Тему змінено');
}


/* ═══ ЗВ'ЯЗОК З РОЗРАХУНКОВИМ ЯДРОМ ═══ */


const API_URL = 'http://kszi.khomyachella.workers.dev/';

// Тонкий generate(): збирає дані форми -> ядро (бекенд або локально) -> вивід.
async function generate(){
  if(!S.walls.length){ notify('⚠️ Намалюйте схему приміщення','wa'); clearResult(); return; }
  if(!isContourClosed()){
    notify('❌ Контур незамкнений! Зʼєднайте всі кути схеми','er');
    clearResult(); redraw(); showContourError(); return;
  }

  // дані форми
  const cls   = parseInt(document.querySelector('input[name=cls]:checked')?.value || '3');
  let roomH   = parseFloat(document.getElementById('roomH').value);
  if(!roomH || roomH<=0) roomH = ROOM_H_DEFAULT;
  const input = {
    walls: JSON.parse(JSON.stringify(S.walls)),
    elems: JSON.parse(JSON.stringify(S.elems)),
    cls, roomH
  };

  notify('⏳ Розрахунок…','wa');
  const resp = await computeRemoteOrLocal(input);

  if(!resp.ok){
    notify('❌ '+(resp.error||'Помилка розрахунку'),'er');
    clearResult(); return;
  }

  // зберігаємо й виводимо
  const res = resp.result;
  res.id = Date.now();
  res.name = 'Результат '+new Date().toLocaleTimeString('uk');
  res._source = resp._source || 'local';
  S.results.push(res);
  localStorage.setItem('kre', JSON.stringify(S.results));
  showResult(res); updSelects();
  notify(res.acoustic.pass ? '✅ Конфігурацію згенеровано — категорію виконано!' : '⚠️ Згенеровано, але категорію НЕ виконано', res.acoustic.pass?'ok':'wa');
}

// Спроба порахувати на бекенді; за будь-якої невдачі — локально тим самим ядром.
async function computeRemoteOrLocal(input){
  if(API_URL){
    try{
      const ctrl=new AbortController();
      const t=setTimeout(()=>ctrl.abort(), 4000); // не чекаємо довше 4с
      const r=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:ctrl.signal});
      clearTimeout(t);
      if(r.ok){ const data=await r.json(); data._source='backend'; return data; }
    }catch(e){ /* падаємо в локальний резерв */ }
  }
  // локальний резерв (те саме ядро, що й на воркері)
  const local=computeConfig(input);
  local._source='local';
  return local;
}

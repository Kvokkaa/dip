/* ═══ ДАНІ ТА КОНСТАНТИ ═══
   База приладів, матеріали, норми категорій, спектр мовлення.
   Використовується і розрахунковим ядром (engine.js), і інтерфейсом. */

/* ══ STATE ══ */
// localStorage існує лише в браузері. На сервері (Cloudflare Worker) його немає —
// тому всі звернення робимо через безпечну обгортку, щоб той самий data.js
// працював і у фронті, і в бекенді.
const hasLS = (typeof localStorage !== 'undefined');
function lsGet(key){ try{ return hasLS ? localStorage.getItem(key) : null; }catch(e){ return null; } }

// Безпечне читання масиву зі сховища (порожній масив, якщо немає або пошкоджено).
function loadLS(key){
  try{
    const raw=lsGet(key);
    if(!raw) return [];
    const v=JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  }catch(e){
    return [];
  }
}
const S = {
  theme: lsGet('kth')||'dark',
  tool: 'wall',
  format: 'short',
  optCrit: 'price',
  schemas: loadLS('ksc'),
  results: loadLS('kre'),
  dbFilter:'all',
  walls:[], elems:[], undo:[],
  lastResult:null
};

const GRID = 40; // px на 1 метр (1 клітинка сітки = 1 м)

const DB = [
  // ПП «РІАС» — ціни за даними Prozorro 2024–2025
  // РІАС-4ША: генератор шуму в телефонних лініях; ціна з Prozorro 2024 (~20 000 грн/шт держзакупівля)
  {id:1, name:'РІАС-4ША',     type:'generator', maker:'ПП «РІАС»',                         concl:'966',           status:'Продовжено до кінця ВС', cert:true, effectDB:52, coverage:25, classMin:2, surfaces:['walls','floors','windows'], price:19800,  priceNote:'Prozorro 2024'},
  // РІАС-1С: стаціонарний ВЧ-шум; Prozorro 2024 (В/ч А4355) — бюджет 35 000 грн за 1 шт
  {id:2, name:'РІАС-1С',      type:'generator', maker:'ПП «РІАС»',                         concl:'968',           status:'Продовжено',              cert:true, effectDB:48, coverage:20, classMin:1, surfaces:['walls','floors'],          price:34500,  priceNote:'Prozorro 2024'},
  // РІАС-1М (8Вт): мобільний ВЧ-шум; Prozorro 2025 БЕБ — 21 192 грн/шт
  {id:3, name:'РІАС-1М',      type:'generator', maker:'ПП «РІАС»',                         concl:'969',           status:'Продовжено',              cert:true, effectDB:46, coverage:18, classMin:1, surfaces:['walls','floors'],          price:21192,  priceNote:'Prozorro 2025 (БЕБ)'},
  // РІАС-2ГС: акуст. генератор; Prozorro 2021 — 14 160 грн (1 шт); з урахуванням інфляції 2024 ≈ 28 000–30 000 грн
  {id:4, name:'РІАС-2ГС',     type:'generator', maker:'ПП «РІАС»',                         concl:'970/1144',      status:'Продовжено',              cert:true, effectDB:54, coverage:30, classMin:2, surfaces:['walls','floors','windows'], price:29500,  priceNote:'Prozorro 2021 + індекс 2024'},
  // РІАС-2ВП: вібровипромінювач; Prozorro 2024 (13 шт = 20 000 грн) ≈ 1 500 грн/шт
  {id:5, name:'РІАС-2ВП',     type:'vibro',     maker:'ПП «РІАС»',                         concl:'971',           status:'Продовжено',              cert:true, effectDB:50, coverage:6,  classMin:2, surfaces:['walls','floors'],          price:1500,   priceNote:'Prozorro 2024'},
  // РІАС-2ВА: акуст. випромінювач; Prozorro 2024 ≈ 1 800–2 000 грн/шт
  {id:6, name:'РІАС-2ВА',     type:'vibro',     maker:'ПП «РІАС»',                         concl:'972',           status:'Продовжено',              cert:true, effectDB:49, coverage:8,  classMin:2, surfaces:['walls'],                   price:1900,   priceNote:'Prozorro 2024'},
  // РІАС-2ЕМ: вібровипромінювач електромагнітний; аналог РІАС-2ВП, ціна ≈ 2 200 грн/шт
  {id:7, name:'РІАС-2ЕМ',     type:'vibro',     maker:'ПП «РІАС»',                         concl:'1137',          status:'Продовжено',              cert:true, effectDB:51, coverage:7,  classMin:2, surfaces:['walls','floors'],          price:2200,   priceNote:'Оцінка на основі Prozorro 2024'},
  // ДП «Укрспецтехніка система» — ціни орієнтовні (офіційного прайсу немає у відкритому доступі)
  {id:8, name:'БАЗАЛЬТ-4ДВМ', type:'vibro',     maker:'ДП «Укрспецтехніка система»',       concl:'1165',          status:'Продовжено',              cert:true, effectDB:55, coverage:8,  classMin:2, surfaces:['walls','floors'],          price:3200,   priceNote:'Оцінка'},
  {id:9, name:'БАЗАЛЬТ-4ДА',  type:'vibro',     maker:'ДП «Укрспецтехніка система»',       concl:'1166',          status:'Продовжено',              cert:true, effectDB:53, coverage:7,  classMin:2, surfaces:['walls'],                   price:2800,   priceNote:'Оцінка'},
  // ПрАТ «МАРС» — ціни з OLX/відкритих джерел 2025
  // ВИ3-50, ВИ4-50: вібровипромінювачі; ціна з ринку ~1 200–1 800 грн/шт
  {id:10,name:'ВИ3-50',       type:'vibro',     maker:'ПрАТ «МАРС»',                       concl:'1286',          status:'Продовжено',              cert:true, effectDB:50, coverage:6,  classMin:2, surfaces:['walls','floors'],          price:1200,   priceNote:'Ринок 2025'},
  {id:11,name:'ВИ4-50',       type:'vibro',     maker:'ПрАТ «МАРС»',                       concl:'1287',          status:'Продовжено',              cert:true, effectDB:52, coverage:8,  classMin:2, surfaces:['walls','floors'],          price:1800,   priceNote:'Ринок 2025'},
  // МАРС-АКЗ: акустична колонка захищена; ціна з ринку ~3 500–4 500 грн/шт
  {id:12,name:'МАРС-АКЗ',     type:'combined',  maker:'ПрАТ «МАРС»',                       concl:'1288',          status:'Продовжено',              cert:true, effectDB:58, coverage:12, classMin:2, surfaces:['walls','windows','doors'], price:4200,   priceNote:'Ринок 2025'},
  // МАРС-ТЗО-4-2: генератор; OLX 2025 = 13 499 грн
  {id:13,name:'МАРС-ТЗО-4-2', type:'generator', maker:'ПрАТ «МАРС»',                       concl:'1289',          status:'Продовжено',              cert:true, effectDB:56, coverage:30, classMin:2, surfaces:['walls','floors','windows'], price:13499,  priceNote:'OLX 2025'},
  // ТОВ «ІНТЕКОН» — ціна орієнтовна (продукт преміум-класу)
  {id:14,name:'RESONANCE',    type:'combined',  maker:'ТОВ «ІНТЕКОН»',                     concl:'1316/59ЕВ/80ЕВ',status:'Продовжено',              cert:true, effectDB:62, coverage:35, classMin:3, surfaces:['walls','windows','floors','doors'], price:48000,  priceNote:'Оцінка (преміум)'},
  // ТОВ «Digital and Analog Systems» — офіційні ціни з сайту das-ua.com (2025–2026)
  // DNG-2300: офіційна ціна 39 160 грн (das-ua.com)
  {id:15,name:'DNG-2300',     type:'generator', maker:'ТОВ «Digital and Analog Systems»',  concl:'165ЕВ',         status:'2024, діє',               cert:true, effectDB:60, coverage:32, classMin:2, surfaces:['walls','floors','windows'], price:39160,  priceNote:'das-ua.com 2025'},
  // SP1300: акустичний випромінювач; ціна за запитом (орієнтовно ~5 000–7 000 грн)
  {id:16,name:'SP1300',       type:'vibro',     maker:'ТОВ «Digital and Analog Systems»',  concl:'166ЕВ',         status:'2024, діє',               cert:true, effectDB:55, coverage:10, classMin:2, surfaces:['walls','floors'],          price:6000,   priceNote:'Оцінка das-ua.com 2025'},
  // TD2300: вібровипромінювач; офіційна ціна 3 564 грн (das-ua.com)
  {id:17,name:'TD2300',       type:'vibro',     maker:'ТОВ «Digital and Analog Systems»',  concl:'167ЕВ',         status:'2024, діє',               cert:true, effectDB:53, coverage:6,  classMin:2, surfaces:['walls'],                   price:3564,   priceNote:'das-ua.com 2025'},
];
/* Нормалізація класу приладу за фактичною ефективністю (узгодження з порогами НД ТЗІ):
   ефект ≥60 дБ → клас 3, ≥50 дБ → клас 2, інакше клас 1.
   classMin означає «прилад забезпечує захист не нижче цього класу». */
DB.forEach(c=>{ c.classMin = c.effectDB>=60 ? 3 : c.effectDB>=50 ? 2 : 1; });
const MATS = [
  {m:'Цегла керамічна',       t:'250 мм',     db:52,norm:'ДСТУ Б В.1.1-10:2010',  use:'Зовн./несучі стіни'},
  {m:'Залізобетон',           t:'200 мм',     db:57,norm:'ДСТУ Б В.1.1-10:2010',  use:'Несучі стіни, перекриття'},
  {m:'Газобетон',             t:'300 мм',     db:44,norm:'ДСТУ Б В.2.7-137:2008', use:'Перегородки'},
  {m:'Гіпсокартон (2 шари)', t:'2×12.5 мм',  db:43,norm:'ДСТУ EN 520:2010',      use:'Перегородки, обшивка'},
  {m:'Дерево (масив)',        t:'100 мм',     db:38,norm:'ДСТУ Б В.1.1-10:2010',  use:'Перекриття'},
  {m:'Панель сендвіч',        t:'150 мм',     db:46,norm:'ДСТУ Б В.2.6-33:2008',  use:'Стіни'},
  {m:'Вікно одинарне',        t:'4 мм',       db:24,norm:'ДСТУ Б В.2.6-23:2009',  use:'Вікна'},
  {m:'Склопакет подвійний',   t:'4-16-4 мм',  db:35,norm:'ДСТУ Б В.2.6-23:2009',  use:'Вікна'},
  {m:'Двері металеві',        t:'60 мм',      db:40,norm:'ДСТУ Б В.2.7-53:96',    use:'Вхідні двері'},
  {m:'Вентиляційна шахта',    t:'—',          db:14,norm:'ДБН В.2.5-67:2013',     use:'Вентиляція'},
  {m:'Труби водопостачання',  t:'—',          db:10,norm:'ДБН В.2.5-74:2013',     use:'Комунікації'},
];
/* ── АКУСТИЧНА МОДЕЛЬ (ДСТУ Б В.1.1-10:2010 / ISO 717-1, композитна звукоізоляція) ──
   Rw — індекс ізоляції повітряного шуму при еталонній товщині ref (мм).
   Для іншої товщини застосовується закон маси: ΔR = 20·log10(t/ref) ≈ +6 дБ на подвоєння. */
const MAT_AC = {
  brick:    {Rw:52, ref:250, name:'Цегла'},
  concrete: {Rw:57, ref:200, name:'Залізобетон'},
  drywall:  {Rw:43, ref:25,  name:'Гіпсокартон'},
  aerated:  {Rw:44, ref:300, name:'Газобетон'},
  panel:    {Rw:46, ref:150, name:'Панель'},
  wood:     {Rw:38, ref:100, name:'Дерево'}
};
/* Елементи-«вразливості»: Rw слабкого вузла та його площа (м²).
   У композитній формулі мала площа з низьким Rw різко знижує ізоляцію всієї оболонки. */
const EL_ACOUSTIC = {
  window: {R:30, area:1.50, name:'Вікно (склопакет)'},
  door:   {R:40, area:1.80, name:'Двері металеві'},
  vent:   {R:14, area:0.20, name:'Вентиляція'},
  pipe:   {R:10, area:0.05, name:'Труба/комунікації'}
};
/* ── Критерій захищеності: словесна розбірливість W (метод Покровського–Хорєва) ──
   5 октавних смуг. Норми W за категоріями об'єкта ТПКО-95. */
const ROOM_H_DEFAULT = 3.0; // висота приміщення, м (якщо поле порожнє)

// Октавні смуги: середня частота, ваговий коеф. k, частотна корекція ізоляції стіни
const W_BANDS = [
  {f:250,  k:0.03, isoCorr:-4},
  {f:500,  k:0.12, isoCorr:-1},
  {f:1000, k:0.20, isoCorr:0},
  {f:2000, k:0.30, isoCorr:3},
  {f:4000, k:0.26, isoCorr:5},
];
// Рівень формант мовлення по смугах (для інтегрального рівня ~70 дБ — звичайна мова)
const SPEECH_LEVEL = {250:75, 500:77, 1000:74, 2000:69, 4000:63};
// Норми словесної розбірливості за категоріями ТПКО-95 (I…IV)
const CAT_W = {1:0.10, 2:0.20, 3:0.30, 4:0.40};
const CAT_NAME = {1:'I (особливої важливості)', 2:'II (цілком таємно)', 3:'III (таємно)', 4:'IV (ІзОД)'};


// Кольори та підписи (для відмалювання)
const MAT_COLORS={brick:'#c0703a',concrete:'#7a8fa6',drywall:'#c8b89a',aerated:'#9ab89a',panel:'#7ab0c8',wood:'#b8955a'};
const EL_COLORS={
  window:'#5bc4f5', door:'#f5a05b', pipe:'#a0a0c8', vent:'#78c878',
  'src-person':'#ff6b6b', 'src-pc':'#ffd93d', 'src-multi':'#ff9f43', 'src-table':'#ff6b9d'
};
const EL_LABELS={
  window:'Вікно', door:'Двері', pipe:'Труба', vent:'Вент.',
  'src-person':'Людина', 'src-pc':'Обладн.', 'src-multi':'Комбін.', 'src-table':'Стіл'
};
const EL_IS_SOURCE=(t)=>t&&t.startsWith('src-');
/* ═══ РОЗРАХУНКОВЕ ЯДРО (engine.js) ═══
   Чисті функції без DOM. Метод словесної розбірливості W (Покровський–Хорєв),
   композитна звукоізоляція (ДСТУ Б В.1.1-10), підбір засобів захисту.
   Цей самий файл працює:
     • у браузері (локальний резерв розрахунку),
   Залежить лише від констант з data.js (DB, MAT_AC, W_BANDS, CAT_W ...). */

// ── Метод словесної розбірливості W ──
function perceptionP(q){
  if(q<=0) return 0;
  if(q>=30) return 1;
  const t=[[0,0],[3,0.08],[6,0.18],[9,0.30],[12,0.42],[15,0.54],[18,0.66],[21,0.78],[24,0.88],[27,0.95],[30,1]];
  for(let i=0;i<t.length-1;i++){
    if(q>=t[i][0] && q<=t[i+1][0]){
      const u=(q-t[i][0])/(t[i+1][0]-t[i][0]);
      return t[i][1]+(t[i+1][1]-t[i][1])*u;
    }
  }
  return 1;
}
// Перехід від інтегрального індексу артикуляції R до словесної розбірливості W
function R2W(R){
  if(R<=0) return 0;
  if(R>=1) return 1;
  const t=[[0,0],[0.05,0.05],[0.1,0.12],[0.15,0.22],[0.2,0.34],[0.3,0.55],[0.4,0.70],[0.5,0.82],[0.6,0.90],[0.7,0.95],[0.85,0.99],[1,1]];
  for(let i=0;i<t.length-1;i++){
    if(R>=t[i][0] && R<=t[i+1][0]){
      const u=(R-t[i][0])/(t[i+1][0]-t[i][0]);
      return t[i][1]+(t[i+1][1]-t[i][1])*u;
    }
  }
  return 1;
}
// Словесна розбірливість W за пасивною ізоляцією Riso (дБ) та рівнем маскування mask (дБ)
function calcW(Riso, mask){
  let R=0, totK=0;
  for(let i=0;i<W_BANDS.length;i++){
    const b=W_BANDS[i];
    const leak = SPEECH_LEVEL[b.f] - (Riso + b.isoCorr); // рівень формант за стіною
    const q = leak - mask;                                // С/Ш по формантах
    R += b.k*perceptionP(q);
    totK += b.k;
  }
  return R2W(R/totK);
}
// Скільки маскування (дБ) потрібно, щоб досягти W <= Wtarget
function maskNeeded(Riso, Wtarget){
  for(let m=0;m<=80;m+=0.5){
    if(calcW(Riso,m)<=Wtarget) return m;
  }
  return 80;
}

/* Ізоляція стіни з урахуванням матеріалу та товщини (закон маси) */
function matR(matKey, thickCm){
  const m = MAT_AC[matKey] || MAT_AC.brick;
  let t = parseFloat(thickCm);
  if(isNaN(t)) t = 25;          // поле не задано -> типова товщина 25 см
  if(t < 1) return 10;          // майже нульова стіна -> мінімальна ізоляція (отвір)
  const tmm = t * 10;           // см -> мм
  const dR = 20 * Math.log10(tmm / m.ref);  // +6 дБ на подвоєння товщини
  return Math.max(10, m.Rw + dR);
}

// ── Геометрія приміщення (чисті функції) ──
function buildOuterPolygon(walls){
  // Будуємо впорядкований полігон методом ланцюга
  if(!walls||walls.length<3) return null;
  const TOL=GRID*2;
  const segs=walls.map((w,i)=>({x1:w.x1,y1:w.y1,x2:w.x2,y2:w.y2,used:false,orig:i}));

  // Стартуємо з крайньої лівої точки для надійності
  let startIdx=0;
  let minX=Infinity;
  segs.forEach((s,i)=>{
    if(Math.min(s.x1,s.x2)<minX){minX=Math.min(s.x1,s.x2);startIdx=i;}
  });

  segs[startIdx].used=true;
  const poly=[{x:segs[startIdx].x1,y:segs[startIdx].y1},
              {x:segs[startIdx].x2,y:segs[startIdx].y2}];

  for(let iter=0;iter<segs.length*2;iter++){
    const last=poly[poly.length-1];
    let bestI=-1, bestDist=TOL, flip=false;
    segs.forEach((s,i)=>{
      if(s.used) return;
      const d1=Math.hypot(last.x-s.x1,last.y-s.y1);
      const d2=Math.hypot(last.x-s.x2,last.y-s.y2);
      if(d1<bestDist){bestDist=d1;bestI=i;flip=false;}
      if(d2<bestDist){bestDist=d2;bestI=i;flip=true;}
    });
    if(bestI<0) break;
    segs[bestI].used=true;
    poly.push(flip?{x:segs[bestI].x1,y:segs[bestI].y1}:{x:segs[bestI].x2,y:segs[bestI].y2});
  }

  // Перевіряємо чи контур замкнений
  const first=poly[0], last=poly[poly.length-1];
  if(Math.hypot(first.x-last.x,first.y-last.y)>TOL) return null;
  poly.pop(); // прибираємо дубль останньої точки
  return poly.length>=3 ? poly : null;
}

function shoelaceSigned(poly){
  let area=0;
  const n=poly.length;
  for(let i=0;i<n;i++){
    const j=(i+1)%n;
    area+=poly[i].x*poly[j].y - poly[j].x*poly[i].y;
  }
  return area/2; // зі знаком: + = CCW, − = CW
}

function perimeterPx(poly){
  let p=0;
  const n=poly.length;
  for(let i=0;i<n;i++){
    const j=(i+1)%n;
    p+=Math.hypot(poly[j].x-poly[i].x,poly[j].y-poly[i].y);
  }
  return p;
}

// Площа приміщення з контуру стін (чиста версія calcArea, без DOM), м²
function areaFromWalls(walls){
  const load=walls.filter(w=>w.type==='load');
  const ws=load.length>=3?load:walls;
  if(ws.length<3) return 0;
  const poly=buildOuterPolygon(ws);
  if(!poly) return 0;
  const outerPx=Math.abs(shoelaceSigned(poly));
  const perimPx=perimeterPx(poly);
  const CM_TO_PX=GRID/100;
  const avgThickCm=ws.reduce((s,w)=>s+(parseFloat(w.thick)||25),0)/ws.length;
  const halfThickPx=(avgThickCm/2)*CM_TO_PX;
  const innerPx=outerPx - perimPx*halfThickPx + Math.PI*halfThickPx*halfThickPx;
  const PX_TO_M=1.0/GRID;
  return Math.max(0, innerPx*PX_TO_M*PX_TO_M);
}
// Чи замкнений контур (чиста версія)
function contourClosed(walls){
  const load=walls.filter(w=>w.type==='load');
  const ws=load.length>=3?load:walls;
  return !!buildOuterPolygon(ws);
}

// ── Акустичні розрахунки ──
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


// ═══ ГОЛОВНА ФУНКЦІЯ РОЗРАХУНКУ ═══
// Чиста: на вході — опис приміщення, на виході — готова конфігурація захисту.
//   input = { walls, elems, cls, roomH }
//   return = { ok:true, result:{...} }  або  { ok:false, error:'...' }
function computeConfig(input){
  const walls = input.walls || [];
  const elems = input.elems || [];
  const cls   = parseInt(input.cls) || 3;
  let roomH   = parseFloat(input.roomH);
  if(!roomH || roomH<=0) roomH = ROOM_H_DEFAULT;

  // валідація геометрії
  if(!walls.length)       return {ok:false, error:'Схема порожня'};
  if(!contourClosed(walls)) return {ok:false, error:'Контур незамкнений'};
  const area = areaFromWalls(walls);
  if(area<=0)             return {ok:false, error:'Не вдалося визначити площу'};

  const loadWalls   = walls.filter(w=>w.type==='load');
  const wallsForCalc= loadWalls.length>=3 ? loadWalls : walls;
  const perimM      = perimMeters(wallsForCalc);

  // 1. пасивна ізоляція оболонки
  const env   = envelopeR(wallsForCalc, elems, perimM, roomH);
  const Rpass = env.R;

  // 2. джерела й поправки
  const sources = elems.filter(e=>EL_IS_SOURCE(e.type));
  const expo    = exposurePenalty(sources, wallsForCalc, area);
  const pbonus  = partitionBonus(walls);

  // 3. критерій W
  const Reff     = Rpass - expo + pbonus;
  const Wtarget  = CAT_W[cls];
  const Wpassive = calcW(Reff, 0);
  const requiredActive = Wpassive<=Wtarget ? 0 : maskNeeded(Reff, Wtarget);

  // 4. підбір приладів
  const srcTypes  = sources.map(s=>s.type);
  const hasPerson = srcTypes.some(t=>t==='src-person'||t==='src-multi'||t==='src-table');
  const hasEquip  = srcTypes.some(t=>t==='src-pc'||t==='src-multi');

  let pool = DB.filter(c=>c.cert);
  pool.sort(function(a,b){
    let costA=a.price/a.coverage, costB=b.price/b.coverage;
    if(hasPerson&&!hasEquip){ if(a.type==='generator'||a.type==='combined')costA*=0.77; if(b.type==='generator'||b.type==='combined')costB*=0.77; }
    if(hasEquip&&!hasPerson){ if(a.type==='vibro')costA*=0.77; if(b.type==='vibro')costB*=0.77; }
    return costA-costB;
  });

  const chosen=[];
  function addComponent(comp,qty,target){
    if(!comp||qty<=0) return;
    const ex=chosen.find(x=>x.id===comp.id && x.target===target);
    if(ex) ex.qty+=qty; else chosen.push({...comp,qty:qty,target:target||'walls'});
  }

  // 4а. основне покриття
  const SAFETY={1:14, 2:9, 3:5, 4:2};
  const Mtarget = requiredActive + (SAFETY[cls]||3);
  let bulkComp=null, achievedMask=0;
  if(requiredActive>0.5 && area>0){
    for(let i=0;i<pool.length;i++){ if(pool[i].effectDB>=Mtarget){ bulkComp=pool[i]; break; } }
    if(!bulkComp){ bulkComp=pool[0]; for(let i=0;i<pool.length;i++) if(pool[i].effectDB>bulkComp.effectDB) bulkComp=pool[i]; }
    if(bulkComp){
      let qty=Math.max(1, Math.ceil(area/bulkComp.coverage));
      while(qty<80){ const dens=(qty*bulkComp.coverage)/area; if(bulkComp.effectDB+10*Math.log10(dens)>=Mtarget) break; qty++; }
      addComponent(bulkComp, qty, 'walls');
      const dens=(qty*bulkComp.coverage)/area;
      achievedMask=bulkComp.effectDB + 10*Math.log10(Math.max(dens,0.01));
    }
  }

  // 4б. захист вузлів
  const certDB=DB.filter(c=>c.cert);
  if(env.counts.window>0) addComponent(certDB.find(c=>c.surfaces.includes('windows')), env.counts.window, 'windows');
  if(env.counts.door>0){ const d=certDB.find(c=>c.surfaces.includes('doors'))||certDB.find(c=>c.surfaces.includes('walls')); addComponent(d, env.counts.door, 'doors'); }
  if(env.counts.vent>0){ let v=certDB.find(c=>c.type==='generator'&&c.surfaces.includes('walls')); if(!v)v=certDB.find(c=>c.type==='generator'); addComponent(v, env.counts.vent, 'vent'); }
  if(env.counts.pipe>0){ const p=certDB.find(c=>c.type==='vibro')||certDB.find(c=>c.type==='combined'); addComponent(p, env.counts.pipe, 'pipe'); }

  // 5. підсумки
  let units=0, totalCoverage=0, total=0;
  for(const c of chosen){ units+=c.qty; totalCoverage+=c.coverage*c.qty; total+=c.price*c.qty; }
  let coverageRatio = area>0 ? Math.min(1,totalCoverage/area) : 1;
  const Wfinal = (requiredActive>0.5) ? calcW(Reff, achievedMask) : Wpassive;
  const pass = Wfinal <= Wtarget+0.001;
  const r1=x=>Math.round(x*10)/10, rp=x=>Math.round(x*100);

  return {ok:true, result:{
    area:Math.round(area*10)/10, cls, roomH,
    components:chosen, total,
    sources:JSON.parse(JSON.stringify(sources)),
    acoustic:{
      Rpass:r1(Rpass), Reff:r1(Reff), expo:r1(expo), pbonus:r1(pbonus),
      Wtarget:rp(Wtarget), Wpassive:rp(Wpassive), Wfinal:rp(Wfinal),
      requiredActive:r1(requiredActive), achievedMask:r1(achievedMask),
      coverageRatio:Math.round(coverageRatio*100),
      pass, catName:CAT_NAME[cls], counts:env.counts, Senv:r1(env.Stot)
    },
    walls:JSON.parse(JSON.stringify(walls)),
    elems:JSON.parse(JSON.stringify(elems))
  }};
}

// Експорт для Node/Worker (у браузері — ігнорується)
if(typeof module!=='undefined' && module.exports){
  module.exports={computeConfig, calcW, maskNeeded, matR, areaFromWalls, contourClosed};
}
/* ═══ БЕКЕНД: Cloudflare Worker ═══*/

// ─────────────── HTTP-обробник ───────────────
const CORS = {
  'Access-Control-Allow-Origin': '*',                 // дозволяємо запити з GitHub Pages
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

addEventListener('fetch', event => {
  event.respondWith(handle(event.request));
});

async function handle(req){
  // preflight
  if(req.method === 'OPTIONS') return new Response(null, {headers: CORS});

  if(req.method === 'GET'){
    return json({service:'KSZI compute engine', status:'ok', method:'POST /'}, 200);
  }
  if(req.method !== 'POST'){
    return json({ok:false, error:'Use POST'}, 405);
  }

  let input;
  try { input = await req.json(); }
  catch(e){ return json({ok:false, error:'Невірний JSON'}, 400); }

  try {
    // computeConfig визначена у вкладеному ядрі (data.js + engine.js)
    const res = computeConfig(input);
    return json(res, res.ok ? 200 : 422);
  } catch(e){
    return json({ok:false, error:'Помилка розрахунку: '+e.message}, 500);
  }
}

function json(obj, status){
  return new Response(JSON.stringify(obj), {
    status,
    headers: {...CORS, 'Content-Type':'application/json; charset=utf-8'}
  });
}

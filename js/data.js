/* ═══ ДАНІ ТА КОНСТАНТИ ═══
   База приладів, матеріали, норми категорій, спектр мовлення.
   Використовується і розрахунковим ядром (engine.js), і інтерфейсом. */

/* ══ STATE ══ */

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
   5 октавних смуг. Норми W за категоріями об'єкта НД ТЗІ 1.6-005-2013. */
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
// Норми словесної розбірливості за категоріями НД ТЗІ 1.6-005-2013 (I…IV)
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

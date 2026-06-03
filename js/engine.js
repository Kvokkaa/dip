/* ═══ РОЗРАХУНКОВЕ ЯДРО (engine.js) ═══
   Чисті функції без DOM. Метод словесної розбірливості W (Покровський–Хорєв),
   композитна звукоізоляція (ДСТУ Б В.1.1-10), підбір засобів захисту.
   Цей самий файл працює:
     • у браузері (локальний резерв розрахунку),
     • на Cloudflare Worker (основний бекенд) — див. worker/worker.js.
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

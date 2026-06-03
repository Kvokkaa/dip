/* ═══ БЕКЕНД: Cloudflare Worker ═══
   
   Фронтенд надсилає опис приміщення -> Worker рахує -> повертає конфігурацію захисту. */

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

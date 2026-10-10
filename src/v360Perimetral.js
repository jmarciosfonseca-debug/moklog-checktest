// Visão 360 — zonas perimetrais com problema, por origem do dado.
// P505/P311A/B: doc perimetral/{pid} (testes[].zonas). Golgi: índice rondas/{pid}
// (plantoes[].perimetralResumo / perimetral). Puro, sem Firestore.
export const PERIMETRAL_VIA_RONDAS = ["P601","P602","P604","P605","P606","P607"];

export function zonasRuinsDeTestes(data){
  const testes = (data && data.testes) || [];
  if(!testes.length) return 0;
  const ult = [...testes].sort((a,b)=>(b.data||"").localeCompare(a.data||""))[0];
  return Object.values(ult.zonas||{}).filter(z=>(z?.status||"ok")!=="ok").length;
}

export function zonasRuinsDeRondas(idx){
  if(!idx) return 0;
  const del = idx.deletedIds || [];
  const cand = (idx.plantoes||[]).filter(p=>!del.includes(p.id)).map(p=>{
    const r = p.perimetralResumo && p.perimetralResumo.feito ? p.perimetralResumo : (p.perimetral && p.perimetral.feito ? p.perimetral : null);
    if(!r || !(r.zonas||[]).length) return null;
    return { data: r.data || p.dataPlantao || p.data || "", zonas: r.zonas };
  }).filter(Boolean);
  if(!cand.length) return 0;
  cand.sort((a,b)=>String(b.data).localeCompare(String(a.data)));
  return cand[0].zonas.filter(z=>(z?.status||"ok")!=="ok").length;
}

export function zonasRuinsProjeto(pid, periData, rondasIdx){
  return PERIMETRAL_VIA_RONDAS.includes(pid) ? zonasRuinsDeRondas(rondasIdx) : zonasRuinsDeTestes(periData);
}

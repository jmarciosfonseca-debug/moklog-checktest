// Teste determinístico de reconciliação e unicidade — P0 Registros.
// Roda com: node equipData.test.js (via loader Babel do repo, ou o harness abaixo).
// Prova: (1) cada projectId 1×; (2) Jatinox não duplica; (3) total==soma;
// (4) Firestore prevalece sobre cache; (5) cache só no fallback.

import { listaProjetosUnica, loadEquipData, contarEquip } from "./equipData";

// PROJECTS de fixture: inclui Jatinox (como no app real).
const PROJECTS = {
  P601:{id:"P601"}, P602:{id:"P602"}, P604:{id:"P604"}, P605:{id:"P605"},
  P606:{id:"P606"}, P607:{id:"P607"}, P311A:{id:"P311A"}, P311B:{id:"P311B"},
  P505:{id:"P505"}, P260A:{id:"P260A"}, P260B:{id:"P260B"}, P260C:{id:"P260C"},
};

export async function run() {
  let pass=0, fail=0;
  const ok=(n,c)=>{ c?pass++:(fail++,console.log("FAIL:",n)); };

  // (1) e (2) unicidade — cada projeto 1×, Jatinox não duplica.
  const lista = listaProjetosUnica(PROJECTS);
  const ids = lista.map(p=>p.id);
  ok("12 projetos", ids.length===12);
  ok("cada id unico", ids.length===new Set(ids).size);
  ok("P260A 1x", ids.filter(x=>x==="P260A").length===1);
  ok("P260B 1x", ids.filter(x=>x==="P260B").length===1);
  ok("P260C 1x", ids.filter(x=>x==="P260C").length===1);
  // defensivo: mesmo se PROJECTS tivesse duplicata, a fn deduplica
  const dup = listaProjetosUnica({...PROJECTS, P260A_dup:{id:"P260A"}});
  ok("dedup defensivo", dup.filter(p=>p.id==="P260A").length===1);

  // (4) Firestore prevalece sobre cache.
  const docFS = { radiosHT:[{status:"ok"},{status:"inop"}] };      // 2 itens, 1 inop
  const docCache = { radiosHT:[{status:"ok"}] };                    // 1 item (desatualizado)
  const depsAmbos = {
    db:{}, doc:(_,__,pid)=>pid, getDoc: async ()=>({exists:()=>true, data:()=>docFS}),
    getCache: ()=>docCache,
  };
  let r = await loadEquipData("P601", depsAmbos);
  ok("Firestore prevalece (fonte)", r.fonte==="firestore");
  ok("Firestore prevalece (dado)", contarEquip(r.data).total===2);

  // (5) cache só no fallback — doc não existe → usa cache.
  const depsSemDoc = {
    db:{}, doc:()=>"x", getDoc: async ()=>({exists:()=>false, data:()=>null}),
    getCache: ()=>docCache,
  };
  r = await loadEquipData("P602", depsSemDoc);
  ok("fallback usa cache", r.fonte==="cache" && contarEquip(r.data).total===1);

  // leitura falha → usa cache.
  const depsErro = {
    db:{}, doc:()=>"x", getDoc: async ()=>{ throw new Error("net"); },
    getCache: ()=>docCache,
  };
  r = await loadEquipData("P604", depsErro);
  ok("erro cai no cache", r.fonte==="cache");

  // sem doc e sem cache → vazio.
  const depsVazio = { db:{}, doc:()=>"x", getDoc: async ()=>({exists:()=>false}), getCache: ()=>null };
  r = await loadEquipData("P605", depsVazio);
  ok("sem nada => vazio", r.fonte==="vazio" && r.data===null);

  // (3) total consolidado == soma por projeto (com a lista ÚNICA).
  // Simula 3 projetos com inventário; P260B só uma vez (não em dobro).
  const inv = {
    P601:{ radiosHT:[{status:"ok"},{status:"inop"}], moto:{status:"ok"} }, // 3
    P260B:{ smartphones:[{status:"ok"},{status:"parcial"}] },              // 2
    P260C:{ lanternas:[{status:"critico"}] },                             // 1
  };
  const depsInv = {
    db:{}, doc:(_,__,pid)=>pid,
    getDoc: async (pid)=>({ exists:()=>!!inv[pid], data:()=>inv[pid] }),
    getCache: ()=>null,
  };
  let totalConsolidado=0; const somaLinhas=[];
  for(const p of lista){
    const { data } = await loadEquipData(p.id, depsInv);
    const c = contarEquip(data);
    totalConsolidado += c.total;
    if(c.total>0) somaLinhas.push([p.id, c.total]);
  }
  const somaPorProjeto = somaLinhas.reduce((n,[,t])=>n+t,0);
  ok("total == soma das linhas", totalConsolidado===somaPorProjeto);
  ok("total esperado 6 (sem duplicar P260B)", totalConsolidado===6);
  ok("P260B contado 1x (=2)", (somaLinhas.find(([id])=>id==="P260B")||[])[1]===2);

  console.log(`\n${pass} passaram, ${fail} falharam`);
  return fail===0;
}

// Execução direta.
if (typeof require !== "undefined" && require.main === module) {
  run().then(okAll=>process.exit(okAll?0:1));
}

const assert = require("assert");
const path = require("path");

const fake = { projects: {
  P601: { history: [{ meta:{date:"2026-09-01"}, state:{ cameras:[{status:"ok"},{status:"inop"}], cancela:{status:"partial"} } }] },
  P602: { history: [{ meta:{date:"2026-09-01"}, state:{ cameras:[{status:"ok"},{status:"ok"}], cancela:{status:"ok"} } }] },
  P260A: { history: [{ meta:{date:"2026-09-01"}, state:{ acesso:{status:"ok"} } }] },
  P260B: { history: [{ meta:{date:"2026-09-01"}, state:{ equipe:{status:"partial"} } }] },
  P260C: { history: [{ meta:{date:"2026-09-01"}, state:{ caoGuarda:{status:"inop"} } }] },
} };
const mockDb={collection:col=>({doc:id=>({get:async()=>({exists:!!fake[col]?.[id],data:()=>fake[col]?.[id]})})})};
const adminPath=require.resolve("../lib/firebaseAdmin");
require.cache[adminPath]={id:adminPath,filename:adminPath,loaded:true,exports:{getDb:()=>mockDb}};

const { computeHealthFromState, get_health_ranking, latestHistoryEntry }=require("../tools/health");
const { withAgeAndPolicy, isVulnerabilityRecord }=require("../tools/vulnerabilities");
let passed=0,failed=0;
async function test(name,fn){try{await fn();passed++;console.log("  ✓",name);}catch(e){failed++;console.log("  ✗",name,"\n     ",e.message);}}

(async()=>{
  console.log("\n[health ranking]");
  await test("fórmula espelha OK=1, Parcial=0,5, INOP=0",()=>{
    const h=computeHealthFromState({a:[{status:"ok"},{status:"inop"}],b:{status:"partial"}});
    assert.deepStrictEqual({total:h.total,ok:h.ok,partial:h.partial,inop:h.inop,healthPct:h.healthPct},{total:3,ok:1.5,partial:1,inop:1,healthPct:50});
  });
  await test("status desconhecido não vira INOP nem distorce o índice",()=>{
    const h=computeHealthFromState({a:[{status:"ok"},{status:"novo-status"}]});
    assert.deepStrictEqual({total:h.total,inop:h.inop,unknown:h.unknown,healthPct:h.healthPct},{total:1,inop:0,unknown:1,healthPct:100});
  });
  await test("histórico mais recente é escolhido por data, não por posição",()=>{
    const newest={meta:{date:"2026-09-03"},state:{a:{status:"ok"}}};
    const older={meta:{date:"2026-09-01"},state:{a:{status:"inop"}}};
    assert.strictEqual(latestHistoryEntry([newest,older]),newest);
  });
  await test("sem datas no histórico, a última entrada válida é escolhida",()=>{
    const first={state:{a:{status:"inop"}}};
    const last={state:{a:{status:"ok"}}};
    assert.strictEqual(latestHistoryEntry([first,last]),last);
  });
  await test("ranking pior primeiro",async()=>{
    const r=await get_health_ranking({order:"worst"});
    assert.strictEqual(r.ok,true); assert.strictEqual(r.records[0].projectId,"P260C");
  });
  await test("P260A/B/C aparecem individualmente",async()=>{
    const r=await get_health_ranking({});
    for(const id of ["P260A","P260B","P260C"]) assert.ok(r.records.some(x=>x.projectId===id));
  });
  console.log("\n[vulnerabilities]");
  await test("KeyAccess sem término é crítico e recebe idade",()=>{
    const r=withAgeAndPolicy({module:"keyaccess",status:"sem término formal",severity:"high",occurredAt:"2026-08-01T12:00:00-03:00",description:"Falha KeyAccess"});
    assert.strictEqual(r.severity,"critical"); assert.ok(Number.isInteger(r.ageDays));
  });
  await test("cancela INOP usa doutrina bloqueadora confirmada",()=>{
    const r=withAgeAndPolicy({module:"equipamentos",status:"inop",severity:"medium",occurredAt:null,description:"cancelas: Cancela principal em INOP"});
    assert.strictEqual(r.severity,"critical");
  });
  await test("itens resolvidos, OK e online não são vulnerabilidades",()=>{
    for(const status of ["resolvido","OK","online","concluída"]) assert.strictEqual(isVulnerabilityRecord({status}),false);
    assert.strictEqual(isVulnerabilityRecord({status:"inop"}),true);
  });
  console.log(`\n──────────────\nResultado: ${passed} passaram, ${failed} falharam\n`); process.exit(failed?1:0);
})();

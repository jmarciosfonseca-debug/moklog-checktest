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

const { computeHealthFromState, get_health_ranking }=require("../tools/health");
const { withAgeAndPolicy }=require("../tools/vulnerabilities");
const { cleanPlainText, requiredPrefetch }=require("../chat");
let passed=0,failed=0;
async function test(name,fn){try{await fn();passed++;console.log("  ✓",name);}catch(e){failed++;console.log("  ✗",name,"\n     ",e.message);}}

(async()=>{
  console.log("\n[health ranking]");
  await test("fórmula espelha OK=1, Parcial=0,5, INOP=0",()=>{
    const h=computeHealthFromState({a:[{status:"ok"},{status:"inop"}],b:{status:"partial"}});
    assert.deepStrictEqual({total:h.total,ok:h.ok,partial:h.partial,inop:h.inop,healthPct:h.healthPct},{total:3,ok:2,partial:1,inop:1,healthPct:67});
  });
  await test("ranking pior primeiro",async()=>{
    const r=await get_health_ranking({order:"worst"});
    assert.strictEqual(r.ok,true); assert.strictEqual(r.records[0].projectId,"P260C");
  });
  await test("P260A/B/C aparecem individualmente",async()=>{
    const r=await get_health_ranking({});
    for(const id of ["P260A","P260B","P260C"]) assert.ok(r.records.some(x=>x.projectId===id));
  });
  await test("percentual de saúde não é alterado por CTMK/maintenance/notes",()=>{
    const h=computeHealthFromState({
      equipamentos:{total:100,inoperative:Array(19).fill({})},
      maintenance:{ctmk:{status:"inop",days:228}},
      notes:{status:"inop"},
    },"P604");
    assert.strictEqual(h.healthPct,81);
    assert.strictEqual(h.total,100);
    assert.strictEqual(h.inop,19);
  });
  await test("total padrão do CFTV reproduz a base do dashboard",()=>{
    const h=computeHealthFromState({cftv:{inoperative:Array(14).fill({})}},"P604");
    assert.deepStrictEqual({total:h.total,inop:h.inop,healthPct:h.healthPct},{total:73,inop:14,healthPct:81});
  });
  await test("pergunta de pior saúde força ranking numérico",()=>{
    const p=requiredPrefetch("Qual projeto tem o pior índice de saúde hoje?");
    assert.deepStrictEqual({name:p.name,order:p.args.order},{name:"get_health_ranking",order:"worst"});
  });
  await test("roteamento reconhece equipe e comparação perimetral",()=>{
    assert.strictEqual(requiredPrefetch("Fale sobre a equipe do P311B").name,"get_staffing_and_vacation_gaps");
    assert.strictEqual(requiredPrefetch("Qual projeto tem menos rondas perimetrais?").name,"get_perimeter_round_gaps");
  });
  await test("resposta final remove Markdown bruto",()=>{
    const out=cleanPlainText("**P604** — `81%`\n* Ação **prioritária**");
    assert.strictEqual(out,"P604 — 81%\n- Ação prioritária");
    assert.ok(!/[`*]/.test(out));
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
  console.log(`\n──────────────\nResultado: ${passed} passaram, ${failed} falharam\n`); process.exit(failed?1:0);
})();

// Aceite do fluxo do Single no SERVIDOR REAL (singleServer.executar) com banco simulado em memória.
// Não substitui o teste com login e banco reais; cobre as regras que o fluxo exige.
const {executar}=require("./singleServer");
const {calcularInspecao,variacao}=require("./singleCalc");
const clone=x=>JSON.parse(JSON.stringify(x));
function banco(){
 const values={"usuarios/g":{active:true,role:"gerente",scopeAll:true},"usuarios/a":{active:true,role:"auditor"},"usuarios/b":{active:true,role:"auditor"}};
 let version=0,writes=0;
 // Consultas simples (where "==" + limit): os testes do Codex não cobriam listar/inspecoes/diagnosticos.
 const query=(prefix,filters=[],lim=Infinity)=>({
  where:(f,op,v)=>query(prefix,[...filters,[f,op,v]],lim),limit:n=>query(prefix,filters,n),
  get:async()=>({docs:Object.keys(values).filter(k=>k.startsWith(prefix+"/")&&!k.slice(prefix.length+1).includes("/"))
   .map(k=>({id:k.split("/").pop(),data:()=>clone(values[k])})).filter(d=>filters.every(([f,op,v])=>op==="=="&&d.data()[f]===v)).slice(0,lim)})});
 const ref=path=>({path,collection:n=>({doc:id=>ref(path+"/"+n+"/"+id),...query(path+"/"+n)}),get:async()=>snap(path)});
 const snap=p=>({exists:values[p]!=null,data:()=>values[p]==null?undefined:clone(values[p])});
 return {values,get writes(){return writes;},collection:n=>({doc:id=>ref(n+"/"+id),...query(n)}),
  runTransaction:async fn=>{for(let t=0;t<8;t++){let pending;const v=version;const r=await fn({get:async x=>snap(x.path),set:(x,d)=>{pending=[x.path,clone(d)];}});
   if(v!==version)continue;if(pending){values[pending[0]]=pending[1];version++;writes++;}return r;}throw Error("retry");}};
}
const G={uid:"g",role:"gerente",scopeAll:true},A={uid:"a",role:"auditor"},B={uid:"b",role:"auditor"};
const PID="sg_cliente_1";
const ATIVOS=[
 {id:"cam",familiaId:"cftv_cameras",nome:"Câmeras CFTV",grupo:"CFTV e CCO",total:100},
 {id:"mon",familiaId:"cftv_monitores",nome:"Monitores",grupo:"CFTV e CCO",total:12},
 {id:"tor",familiaId:"ped_torniquetes",nome:"Torniquetes",grupo:"Pedestres",total:8},
 {id:"zero",familiaId:"vei_bollards",nome:"Bollards",grupo:"Veículos",total:0},
 {id:"x1",familiaId:null,custom:true,nome:"Ativo próprio",grupo:"Personalizado",total:5},
];
async function preparar(db,usuario=G){
 await executar(db,usuario,{acao:"criar",pid:PID,revisao:0,data:{nome:"Condomínio XYZ",responsavel:"Equipe",dataVistoria:"2026-10-03"}});
 await executar(db,usuario,{acao:"ativos",pid:PID,revisao:1,data:{ativos:ATIVOS}});
}
const vistoria=(id,data,itens,extra={})=>({acao:"inspecao",pid:PID,inspecaoId:id,revisao:extra.revisao||0,data:{cenarioRevisao:2,tipo:"situacional",data,responsavel:"Equipe",estado:"concluida",observacoes:"",itens,...(extra.data||{})}});
const todos=(o={})=>[{id:"cam",parcial:4,inoperante:6},{id:"mon",parcial:0,inoperante:0},{id:"tor",parcial:0,inoperante:1},{id:"x1",parcial:0,inoperante:0}].map(x=>({...x,...(o[x.id]||{})}));

test("A1 fluxo: criar → cenário → vistoria → reabrir → comparar → relatório (números do Marcio)",async()=>{
 const db=banco();await preparar(db);
 const r=await executar(db,G,vistoria("i1","2026-10-03",todos()));
 const cam=r.data.itens.find(x=>x.id==="cam"),tor=r.data.itens.find(x=>x.id==="tor");
 expect(cam).toMatchObject({total:100,operante:90,disponibilidade:90});expect(tor).toMatchObject({total:8,operante:7,disponibilidade:87.5});
 expect(r.data.itens.map(x=>x.id)).not.toContain("zero");                 // família com total 0 não entra
 expect(r.data.disponibilidadeGeral).toBe(Math.round((90+12+7+5)/(100+12+8+5)*1000)/10);
 const lista=await executar(db,G,{acao:"inspecoes",pid:PID});expect(lista.inspecoes).toHaveLength(1);
 const seg=await executar(db,G,vistoria("i2","2026-10-10",todos({cam:{parcial:1,inoperante:2}})));
 const v=variacao(seg.data,r.data).find(x=>x.id==="cftv_cameras");expect(v).toEqual({id:"cftv_cameras",inoperantes:-4,disponibilidade:7});
});
test("A2 isolamento: auditor não vê nem altera projeto de outro; gerente scopeAll vê",async()=>{
 const db=banco();await preparar(db,A);
 await expect(executar(db,B,{acao:"inspecoes",pid:PID})).rejects.toMatchObject({status:403});
 await expect(executar(db,B,vistoria("i1","2026-10-03",todos()))).rejects.toMatchObject({status:403});
 expect((await executar(db,B,{acao:"listar"})).projetos).toHaveLength(0);
 expect((await executar(db,G,{acao:"listar"})).projetos).toHaveLength(1);
});
test("A3 arquivado: nenhuma nova vistoria nem alteração de cenário; histórico continua legível",async()=>{
 const db=banco();await preparar(db);await executar(db,G,vistoria("i1","2026-10-03",todos()));
 const p=(await executar(db,G,{acao:"listar"})).projetos[0];
 await executar(db,G,{acao:"arquivar",pid:PID,revisao:p.revisao});
 await expect(executar(db,G,vistoria("i2","2026-10-10",todos()))).rejects.toMatchObject({status:409});
 await expect(executar(db,G,{acao:"ativos",pid:PID,revisao:p.revisao+1,data:{ativos:ATIVOS}})).rejects.toMatchObject({status:409});
 expect((await executar(db,G,{acao:"inspecoes",pid:PID})).inspecoes).toHaveLength(1);
});
test("A4 conflito de vistoria: segunda gravação com a mesma revisão é recusada sem sobrescrever",async()=>{
 const db=banco();await preparar(db);await executar(db,G,vistoria("i1","2026-10-03",todos()));
 await expect(executar(db,G,vistoria("i1","2026-10-03",todos({cam:{inoperante:50}})))).rejects.toMatchObject({status:409});
 expect(db.values[`single_projetos/${PID}/inspecoes/i1`].itens.find(x=>x.id==="cam").inoperante).toBe(6);
});
test("A5 DEFEITO: vistoria com famílias omitidas não pode zerar pendências em silêncio",async()=>{
 const db=banco();await preparar(db);await executar(db,G,vistoria("i1","2026-10-03",todos()));
 // reenvio (revisão 1) só com a câmera: torniquete (1 inoperante) e as demais sumiriam como "100% operantes"
 await expect(executar(db,G,vistoria("i1","2026-10-03",[{id:"cam",parcial:4,inoperante:6}],{revisao:1}))).rejects.toMatchObject({status:400});
 expect(db.values[`single_projetos/${PID}/inspecoes/i1`].itens.find(x=>x.id==="tor").inoperante).toBe(1);
});
test("A5b DEFEITO: primeira vistoria com famílias omitidas também é recusada",async()=>{
 const db=banco();await preparar(db);
 await expect(executar(db,G,vistoria("i9","2026-10-03",[{id:"cam",parcial:0,inoperante:0}]))).rejects.toMatchObject({status:400});
});
test("A6 totais e excesso: parcial+inoperante acima do total é recusado; família total 0 dispensada",async()=>{
 const db=banco();await preparar(db);
 await expect(executar(db,G,vistoria("i1","2026-10-03",todos({tor:{parcial:5,inoperante:4}})))).rejects.toThrow(/ultrapassar/);
 expect(()=>calcularInspecao({itens:[{id:"z",total:0,parcial:0,inoperante:0}]}).itens).not.toThrow();
});
test("A7 diagnóstico: gravar, listar, recusar revisão antiga e isolar auditor",async()=>{
 const db=banco();await preparar(db,A);
 const cmd={acao:"diagnostico",pid:PID,diagnosticoId:"d1",revisao:0,data:{estado:"rascunho",catalogoId:"mestre",versaoCatalogo:"1",respostas:{cftv:{status:"parcial",situacao:"Teste"}}}};
 await executar(db,A,cmd);
 const lista=await executar(db,A,{acao:"diagnosticos",pid:PID});
 expect(lista.diagnosticos).toHaveLength(1);expect(lista.diagnosticos[0].respostas.cftv.status).toBe("parcial");
 await expect(executar(db,A,cmd)).rejects.toMatchObject({status:409});
 await expect(executar(db,B,{acao:"diagnosticos",pid:PID})).rejects.toMatchObject({status:403});
 expect(Object.keys(db.values).every(k=>k.startsWith("usuarios/")||k.startsWith("single_projetos/")||k.startsWith("diagnosticos/sg_"))).toBe(true);
});

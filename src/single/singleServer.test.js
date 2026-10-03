const {executar}=require("./singleServer");
const clone=x=>JSON.parse(JSON.stringify(x));
function banco(){
 const values={"usuarios/g":{active:true,role:"gerente",scopeAll:true},"usuarios/a":{active:true,role:"auditor"}};
 let version=0,writes=0;
 const ref=path=>({path,collection:n=>({doc:id=>ref(path+"/"+n+"/"+id)}),get:async()=>snap(path)});
 const snap=p=>({exists:values[p]!=null,data:()=>values[p]==null?undefined:clone(values[p])});
 return {values,get writes(){return writes;},collection:n=>({doc:id=>ref(n+"/"+id)}),
  runTransaction:async fn=>{for(let tries=0;tries<8;tries++){let pending;const v=version;const result=await fn({get:async r=>snap(r.path),set:(r,d)=>{pending=[r.path,clone(d)];}});
   if(v!==version)continue;if(pending){values[pending[0]]=pending[1];version++;writes++;}return result;}throw Error("retry");}};
}
const u={uid:"g",role:"gerente",scopeAll:true};
const create={acao:"criar",pid:"sg_teste_1",revisao:0,data:{nome:"Teste",responsavel:"Gerente",dataVistoria:"2026-10-03"}};
const asset={id:"cam",familiaId:"cftv_cameras",nome:"CFTV",grupo:"CFTV",total:100};
test("diagnóstico Single exige revisão e não grava nos projetos legados",async()=>{
 const db=banco();await executar(db,u,create);
 const cmd={acao:"diagnostico",pid:create.pid,diagnosticoId:"d1",revisao:0,data:{estado:"rascunho",catalogoId:"mestre",versaoCatalogo:"1",respostas:{cftv:{status:"parcial",situacao:"Teste"}}}};
 const result=await executar(db,u,cmd);expect(result.data.revisao).toBe(1);
 expect(db.values["diagnosticos/sg_teste_1/itens/d1"].respostas.cftv.status).toBe("parcial");
 await expect(executar(db,u,cmd)).rejects.toMatchObject({status:409});
 expect(db.writes).toBe(2);
});
test("cenário alterado impede nova inspeção com totais obsoletos",async()=>{
 const db=banco();await executar(db,u,create);
 await executar(db,u,{acao:"ativos",pid:create.pid,revisao:1,data:{ativos:[asset]}});
 await expect(executar(db,u,{acao:"inspecao",pid:create.pid,inspecaoId:"nova",revisao:0,data:{cenarioRevisao:1,itens:[]}})).rejects.toMatchObject({status:409});
 expect(db.writes).toBe(2);
});
test("criação isolada e uma gravação; sem tocar projects",async()=>{
 const db=banco();const r=await executar(db,u,create);
 expect(r.data).toMatchObject({orgId:"moked",modulo:"single",revisao:1});
 expect(db.writes).toBe(1);expect(Object.keys(db.values)).not.toContain("projects/sg_teste_1");
});
test("duas gravações concorrentes: uma confirma, outra conflita sem sobrescrever",async()=>{
 const db=banco();await executar(db,u,create);
 const command={acao:"ativos",pid:create.pid,revisao:1,data:{ativos:[asset]}};
 const out=await Promise.allSettled([executar(db,u,command),executar(db,u,{...command,data:{ativos:[{...asset,total:9}]}})]);
 expect(out.filter(x=>x.status==="fulfilled")).toHaveLength(1);
 expect(out.find(x=>x.status==="rejected").reason.status).toBe(409);expect(db.writes).toBe(2);
});
test("inspeção conserva snapshot após cenário e catálogo mudarem",async()=>{
 const db=banco();await executar(db,u,create);
 await executar(db,u,{acao:"ativos",pid:create.pid,revisao:1,data:{ativos:[asset]}});
 const cmd={acao:"inspecao",pid:create.pid,inspecaoId:"i1",revisao:0,data:{cenarioRevisao:2,data:"2026-10-03",responsavel:"G",estado:"concluida",itens:[{id:"cam",parcial:4,inoperante:6}]}};
 const first=await executar(db,u,cmd);expect(first.data.itens[0].operante).toBe(90);
 await executar(db,u,{acao:"ativos",pid:create.pid,revisao:2,data:{ativos:[{...asset,total:200,nome:"Novo nome"}]}});
 const second=await executar(db,u,{...cmd,revisao:1});
 expect(second.data.itens[0]).toMatchObject({total:100,nome:"CFTV",disponibilidade:90});
});
test("auditor não edita catálogo nem projeto alheio; perfil revogado nega",async()=>{
 const db=banco();await executar(db,u,create);const a={uid:"a",role:"auditor"};
 await expect(executar(db,a,{acao:"catalogo_salvar",revisao:0,data:{familias:[]}})).rejects.toMatchObject({status:403});
 await expect(executar(db,a,{acao:"arquivar",pid:create.pid,revisao:1})).rejects.toMatchObject({status:403});
 db.values["usuarios/g"].active=false;
 await expect(executar(db,u,{acao:"arquivar",pid:create.pid,revisao:1})).rejects.toMatchObject({status:403});
});
test("rejeita caminhos legados, datas falsas, excesso e famílias injetadas",async()=>{
 const db=banco();
 await expect(executar(db,u,{...create,pid:"P601"})).rejects.toMatchObject({status:400});
 await expect(executar(db,u,{...create,data:{...create.data,dataVistoria:"2026-02-31"}})).rejects.toMatchObject({status:400});
 await executar(db,u,create);
 await expect(executar(db,u,{acao:"inspecao",pid:create.pid,inspecaoId:"i1",revisao:0,data:{cenarioRevisao:1,itens:[{id:"injetado"}]}})).rejects.toMatchObject({status:400});
 expect(db.writes).toBe(1);
});

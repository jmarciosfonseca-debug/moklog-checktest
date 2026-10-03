// Server only. No client imports. Admin transactions enforce revision checks.
const {calcularInspecao, inteiro} = require("./singleCalc");
function erro(status,message){return Object.assign(new Error(message),{status});}
function texto(v,max=200){if(typeof v!=="string"||v.length>max)throw erro(400,"Texto inválido.");return v.trim();}
function id(v){if(typeof v!=="string"||!/^[-a-zA-Z0-9_]{1,120}$/.test(v))throw erro(400,"Identificador inválido.");return v;}
function data(v){const s=texto(v,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||isNaN(Date.parse(s))||new Date(s+"T12:00:00Z").toISOString().slice(0,10)!==s)throw erro(400,"Data inválida.");return s;}
function lista(v){if(!Array.isArray(v)||v.length>200)throw erro(400,"Lista inválida (máximo 200).");return v;}
function ativos(v){const out=lista(v).map(a=>({id:id(a.id),familiaId:a.familiaId==null?null:id(a.familiaId),custom:a.custom===true,nome:texto(a.nome),grupo:texto(a.grupo),total:inteiro(a.total)}));
if(out.some(a=>!a.nome)||new Set(out.map(a=>a.id)).size!==out.length)throw erro(400,"Ativos repetidos ou sem nome.");return out;}
function permitido(p,u){return p.orgId==="moked"&&p.modulo==="single"&&(p.criadoPorUid===u.uid||(u.role==="gerente"&&u.scopeAll===true));}
async function executar(db,u,b){
 if(!u||!["gerente","auditor"].includes(u.role))throw erro(403,"Perfil sem permissão.");
 const action=b?.acao;
 if(action==="listar"){
  let q=db.collection("single_projetos");
  if(!(u.role==="gerente"&&u.scopeAll===true))q=q.where("criadoPorUid","==",u.uid);
  const docs=(await q.limit(200).get()).docs.map(s=>s.data()).filter(p=>permitido(p,u));return {projetos:docs};
 }
 const catalogo=action==="catalogo_ler"||action==="catalogo_salvar";
 const pid=catalogo?null:id(b.pid);
 if(pid&&!/^sg_/.test(pid))throw erro(400,"Projeto Single inválido.");
 const projectRef=catalogo?null:db.collection("single_projetos").doc(pid);
 if(action==="inspecoes"||action==="diagnosticos"){
  const p=await projectRef.get();if(!p.exists||!permitido(p.data(),u))throw erro(403,"Projeto sem permissão.");
  if(action==="diagnosticos")return {diagnosticos:(await db.collection("diagnosticos").doc(pid).collection("itens").limit(200).get()).docs.map(s=>({id:s.id,...s.data()}))};
  return {inspecoes:(await projectRef.collection("inspecoes").limit(200).get()).docs.map(s=>s.data())};
 }
 if(!["criar","ativos","arquivar","inspecao","diagnostico","catalogo_ler","catalogo_salvar"].includes(action))throw erro(400,"Ação inválida.");
 return db.runTransaction(async tx=>{
  const profile=await tx.get(db.collection("usuarios").doc(u.uid));
  if(!profile.exists||profile.data().active!==true||profile.data().role!==u.role)throw erro(403,"Perfil revogado.");
  const identity={...profile.data(),uid:u.uid};
  const ref=catalogo?db.collection("catalogo_ativos").doc("mestre"):projectRef;
  const snap=await tx.get(ref), old=snap.exists?snap.data():null;
  if(action==="catalogo_ler")return {data:old};
  if(catalogo&&u.role!=="gerente")throw erro(403,"Catálogo exclusivo do gerente.");
  if(!catalogo&&action!=="criar"&&(!old||!permitido(old,identity)))throw erro(403,"Projeto sem permissão.");
  if(action==="criar"&&old)throw erro(409,"Identificador já existe; reabra o projeto.");
  const agora=new Date().toISOString();
  let target=ref, current=old, next;
  if(action==="diagnostico"){
   if(old.estado==="arquivado")throw erro(409,"Projeto arquivado.");
   target=db.collection("diagnosticos").doc(pid).collection("itens").doc(id(b.diagnosticoId));
   const ds=await tx.get(target);current=ds.exists?ds.data():null;
   const input=b.data||{};
   if(!["rascunho","arquivado"].includes(input.estado)||!input.respostas||typeof input.respostas!=="object"||Array.isArray(input.respostas))throw erro(400,"Diagnóstico inválido.");
   const respostas={};
   for(const [key,r] of Object.entries(input.respostas)){
    if(!/^[a-zA-Z0-9_.-]{1,100}$/.test(key)||["__proto__","constructor","prototype"].includes(key)||!r||!["conforme","parcial","nao_conforme","ausente_necessario","na","sem_dado"].includes(r.status))throw erro(400,"Resposta inválida.");
    respostas[key]={status:r.status,updatedAt:agora};
    for(const field of ["situacao","impacto","indicacao","observacao"])if(r[field]!=null)respostas[key][field]=texto(r[field],10000);
   }
   next={tipo:"novo",projetoRef:null,rotuloLivre:old.nome,grupo:null,estado:input.estado,respostas,
    catalogoId:current?.catalogoId||texto(input.catalogoId),versaoCatalogo:current?.versaoCatalogo||texto(input.versaoCatalogo),
    autorUid:current?.autorUid||u.uid,criadoEm:current?.criadoEm||agora,arquivadoEm:input.estado==="arquivado"?agora:null};
  }else if(action==="inspecao"){
   if(old.estado==="arquivado")throw erro(409,"Projeto arquivado.");
   target=projectRef.collection("inspecoes").doc(id(b.inspecaoId));
   const inspect=await tx.get(target);current=inspect.exists?inspect.data():null;
   if(!current&&b.data?.cenarioRevisao!==old.revisao)throw erro(409,"O cenário mudou. Reabra o projeto antes de criar a vistoria; rascunho preservado.");
   const template=current?.itens||old.ativos||[];
   const supplied=lista(b.data?.itens);
   const keyed=new Map(supplied.map(x=>[id(x.id),x]));
   if(keyed.size!==supplied.length||supplied.some(x=>!template.some(t=>t.id===x.id)))throw erro(400,"Família fora do cenário.");
   if(template.some(t=>inteiro(t.total)>0&&!keyed.has(t.id)))throw erro(400,"Vistoria incompleta: envie todas as famílias do cenário.");
   const itens=template.map(a=>{
    const s=keyed.get(a.id)||{};
    return {...a,parcial:inteiro(s.parcial),inoperante:inteiro(s.inoperante),falhas:lista(s.falhas||[]).map(f=>{
     if(!["baixa","media","alta"].includes(f.criticidade))throw erro(400,"Criticidade inválida.");
     return {descricao:texto(f.descricao,1000),qtd:inteiro(f.qtd),criticidade:f.criticidade,desde:data(f.desde)};
    })};
   });
   const input=b.data||{};
   if(!["rascunho","concluida"].includes(input.estado)||!["situacional","semanal"].includes(input.tipo||"situacional"))throw erro(400,"Estado ou tipo inválido.");
   next=calcularInspecao({id:b.inspecaoId,itens,cenarioRevisao:current?.cenarioRevisao||old.revisao,tipo:input.tipo||"situacional",data:data(input.data),responsavel:texto(input.responsavel),observacoes:texto(input.observacoes||"",10000),estado:input.estado,autorUid:current?.autorUid||u.uid,criadoEm:current?.criadoEm||agora});
  }else if(action==="criar"){
   const input=b.data||{};
   next={id:pid,nome:texto(input.nome),codigo:input.codigo?texto(input.codigo,50):null,responsavel:texto(input.responsavel||""),dataVistoria:data(input.dataVistoria),criadoEm:agora,criadoPorUid:u.uid,estado:"ativo",orgId:"moked",modulo:"single",ativos:[]};
   if(!next.nome)throw erro(400,"Informe o nome.");
  }else if(action==="ativos"){
   if(old.estado==="arquivado")throw erro(409,"Projeto arquivado.");
   next={...old,ativos:ativos(b.data?.ativos)};
  }else if(action==="arquivar")next={...old,estado:"arquivado"};
  else{
   const fs=lista(b.data?.familias).map((f,i)=>({id:id(f.id),grupo:texto(f.grupo),nome:texto(f.nome),ordem:i,ativo:f.ativo!==false,sinonimos:lista(f.sinonimos||[]).map(x=>texto(x))}));
   if(new Set(fs.map(x=>x.id)).size!==fs.length||fs.some(f=>!f.nome))throw erro(400,"Famílias inválidas.");
   next={versao:"single-v1",familias:fs};
  }
  if(!Number.isSafeInteger(b.revisao)||b.revisao!==(current?.revisao||0))throw erro(409,"Outra gravação alterou este registro. Seu rascunho foi preservado; recarregue antes de salvar.");
  next={...next,revisao:(current?.revisao||0)+1,atualizadoEm:agora};
  if(Buffer.byteLength(JSON.stringify(next),"utf8")>700000)throw erro(400,"Documento muito grande. Reduza as observações; fotos não são aceitas.");
  tx.set(target,next);return {data:next};
 });
}
module.exports={executar,permitido};

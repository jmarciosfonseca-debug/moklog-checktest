import {isDemo} from "../session";
export function criarStore(auth,request=fetch){
 async function call(acao,args={}){
  if(isDemo())throw new Error("Modo demonstração: nenhuma gravação permitida.");
  const user=auth.currentUser;
  if(!user||user.isAnonymous)throw new Error("Entre com o login do Diagnóstico.");
  const response=await request("/api/single",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+await user.getIdToken()},body:JSON.stringify({acao,...args})});
  const result=await response.json();
  if(!response.ok||!result.ok)throw Object.assign(new Error(result.erro||"Servidor indisponível. Rascunho preservado."),{status:response.status});
  return result;
 }
 return {
  listar:()=>call("listar"),
  criarSingle:(pid,data)=>call("criar",{pid,data,revisao:0}),
  salvarAtivos:(p,ativos)=>call("ativos",{pid:p.id,revisao:p.revisao,data:{ativos}}),
  arquivar:p=>call("arquivar",{pid:p.id,revisao:p.revisao}),
  salvarInspecao:(pid,inspecao)=>call("inspecao",{pid,inspecaoId:inspecao.id,revisao:inspecao.revisao||0,data:inspecao}),
  listarInspecoes:pid=>call("inspecoes",{pid}),
  listarDiagnosticos:pid=>call("diagnosticos",{pid}),
  salvarDiagnostico:(pid,diagnosticoId,revisao,data)=>call("diagnostico",{pid,diagnosticoId,revisao:revisao||0,data}),
  lerCatalogo:()=>call("catalogo_ler"),
  editarCatalogo:c=>call("catalogo_salvar",{revisao:c.revisao||0,data:c})
 };
}

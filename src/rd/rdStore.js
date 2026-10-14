import {isDemo} from "../session";
export function criarRdStore(auth,request=fetch){
 async function call(acao,args={}){
  if(isDemo())throw new Error("Modo demonstração: nenhuma gravação permitida.");
  const user=auth.currentUser;
  if(!user||user.isAnonymous)throw new Error("Entre com o login do Diagnóstico para usar o MK RD.");
  const response=await request("/api/rd",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+await user.getIdToken()},body:JSON.stringify({acao,...args})});
  const result=await response.json();
  if(!response.ok||!result.ok)throw Object.assign(new Error(result.erro||"Servidor indisponível. Rascunho local preservado."),{status:response.status});
  return result;
 }
 return {
  ler:(data)=>call("ler",{data}),
  dias:()=>call("dias"),
  periodo:(de,ate)=>call("periodo",{de,ate}),
  salvarFoto:(fotoId,b64)=>call("foto_salvar",{fotoId,b64}),
  lerFotos:(ids)=>call("fotos_ler",{ids}),
  salvar:({data,revisao,dia,memoria,memoriaRevisao})=>call("salvar",{data,revisao,dia,...(memoria?{memoria,memoriaRevisao}:{})})
 };
}

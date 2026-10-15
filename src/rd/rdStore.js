import {isDemo,getSession} from "../session";
export function criarRdStore(auth,request=fetch){
 // O MK RD é gerencial: vale o login do Diagnóstico (Firebase) OU a sessão do PIN gerencial do app.
 // Nesta fase de teste ninguém deve ter que digitar login e senha de novo — quem entrou em Registros já entrou.
 async function tokenAcesso(){
  const user=auth?.currentUser;
  if(user&&!user.isAnonymous)return user.getIdToken();
  const s=getSession();
  if(s&&s.nivel==="gerencial"&&s.token)return s.token;
  throw new Error("Sessão gerencial expirada. Volte e entre em Registros com o PIN gerencial.");
 }
 async function call(acao,args={}){
  if(isDemo())throw new Error("Modo demonstração: nenhuma gravação permitida.");
  const response=await request("/api/rd",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+await tokenAcesso()},body:JSON.stringify({acao,...args})});
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

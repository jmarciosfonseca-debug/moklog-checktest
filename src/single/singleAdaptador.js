const {calcularInspecao}=require("./singleCalc");
const rotuloUnidade=(x,k)=>x.nome+" nº "+(k+1);
// Datas e observações das falhas registradas na vistoria, uma por unidade inoperante (na ordem em que foram lançadas).
// O que sobra usa a data da vistoria: nunca inventa um aging maior do que o informado.
function pendencias(x,dataVistoria){
 if(Array.isArray(x.unidades)&&x.unidades.length){
  const por=st=>x.unidades.filter(u=>u.status===st).map(u=>({id:u.nome,since:u.desde||dataVistoria,note:u.nota||(st==="parcial"?"Parcial na vistoria Single":"Inoperante na vistoria Single")}));
  return {inoperative:por("inoperante"),partial:por("parcial")};
 }
 const falhas=[];
 for(const f of (x.falhas||[]))for(let k=0;k<(Number(f.qtd)||0);k++)falhas.push(f);
 const inoperative=Array.from({length:x.inoperante},(_,k)=>({id:rotuloUnidade(x,k),since:falhas[k]?.desde||dataVistoria,note:falhas[k]?.descricao||"Inoperante na vistoria Single"}));
 const partial=Array.from({length:x.parcial},(_,k)=>({id:rotuloUnidade(x,k),since:dataVistoria,note:"Parcial na vistoria Single"}));
 return {inoperative,partial};
}
function singleComoProjeto(single={},inspecao={}){
 const c=calcularInspecao(inspecao);
 const categories=c.itens.map((x,n)=>({id:x.id||x.familiaId||"single_"+n,label:x.familiaId==="cftv_cameras"?"CFTV":x.nome,type:"count",total:x.total}));
 const state={};c.itens.forEach((x,n)=>{state[categories[n].id]={total:x.total,...pendencias(x,c.data)};});
 return {project:{id:single.id,name:single.nome,categories},stored:{[single.id]:{history:[{meta:{date:c.data,lider:c.responsavel},state}]}},pendenciasParciais:c.itens.map((x,n)=>({id:categories[n].id,qtd:x.parcial}))};
}
module.exports={singleComoProjeto};
// Parciais ficam no estado (`partial`) mas o motor da Análise de Risco só conta INOPERANTE como falha de barreira
// (mesma regra do teste semanal dos 9 projetos): parcial sem evidência de via aberta não é tratada como indisponível.

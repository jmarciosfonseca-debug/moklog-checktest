const {calcularInspecao}=require("./singleCalc");
function singleComoProjeto(single={},inspecao={}){
 const c=calcularInspecao(inspecao);
 const categories=c.itens.map((x,n)=>({id:x.id||x.familiaId||"single_"+n,label:x.familiaId==="cftv_cameras"?"CFTV":x.nome,type:"count",total:x.total}));
 const state={};c.itens.forEach((x,n)=>{state[categories[n].id]={total:x.total,inoperative:Array.from({length:x.inoperante},(_,k)=>({id:"inop_"+k,since:c.data,note:"Inoperante na vistoria Single"})),partial:Array.from({length:x.parcial},(_,k)=>({id:"partial_"+k,since:c.data,note:"Parcial na vistoria Single"}))};});
 return {project:{id:single.id,name:single.nome,categories},stored:{[single.id]:{history:[{meta:{date:c.data,lider:c.responsavel},state}]}},pendenciasParciais:c.itens.map((x,n)=>({id:categories[n].id,qtd:x.parcial}))};
}
module.exports={singleComoProjeto};
// Prepared only. No import in risk engine. Partial pending items require explicit
// consumer support before activation; do not silently interpret them as available.

// Transferência de colaborador entre projetos (Marcio, 12/11/2026). Só o consultor (gerencial) move.
// Uma transação nos dois projetos: sai dos ativos da origem (fica no histórico como "Transferência", não como demissão)
// e entra nos ativos do destino com o MESMO cadastro (id, endereço, histórico, uniforme, férias). Nada é recadastrado.
// A distância casa → projeto é refeita para o destino; a rota de carro é zerada e o app recalcula ao abrir a equipe.
const {coordsDe}=require('../../../src/entorno/locais');
const {distanciaKm}=require('../../../src/entorno/core');
const TIPO='Transferência';
const erro=(status,msg)=>Object.assign(new Error(msg),{status});
const DATA=/^20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

// Função pura: recebe os dois documentos e devolve os dois já alterados + as fotos que precisam ir junto.
function mover(origem,destino,{colabId,de,para,data,agora}){
 if(de===para)throw erro(400,'Escolha um projeto diferente do atual.');
 if(!DATA.test(String(data||'')))throw erro(400,'Data da transferência inválida.');
 const o={colaboradores:[],desligados:[],...(origem||{})},d={colaboradores:[],desligados:[],...(destino||{})};
 const c=(o.colaboradores||[]).find(x=>x&&x.id===colabId);
 if(!c)throw erro(409,'Este colaborador não está mais ativo neste projeto. Reabra a tela.');
 if((d.colaboradores||[]).some(x=>x&&x.id===colabId))throw erro(409,`Este colaborador já consta como ativo no ${para}.`);
 const trajetoria=[...(Array.isArray(c.trajetoria)?c.trajetoria:[]),{id:'mov_'+Date.parse(agora),de,para,data,registradoEm:agora,por:'Gerencial'}];
 const saida={...c,status:'desligado',tipoDesligamento:TIPO,motivoDesligamento:`Transferido para ${para}`,desligadoEm:data,desligadoPor:'Gerencial',desligadoRegistroEm:agora,transferidoPara:para,trajetoria};
 const base=coordsDe(para),geo=c.geo&&typeof c.geo.lat==='number'&&typeof c.geo.lng==='number'?c.geo:null;
 const entrada={...c,status:'ativo',trajetoria,transferidoDe:de,atualizadoEm:agora,distanciaKm:geo&&base?distanciaKm(base,geo):null,rotaKm:null,rotaMin:null,rotaVersao:null,rotaEm:null};
 if('projectId' in c)entrada.projectId=para;
 for(const k of ['desligadoEm','motivoDesligamento','tipoDesligamento','desligadoPor','desligadoRegistroEm','transferidoPara'])delete entrada[k];
 const fotos=[...new Set([c.fotoRef,...(Array.isArray(c.historico)?c.historico:[]).map(h=>h&&h.fotoRef)].filter(r=>typeof r==='string'&&/^[-\w]{1,100}$/.test(r)))];
 return {
  origem:{...o,colaboradores:o.colaboradores.filter(x=>x.id!==colabId),desligados:[saida,...(o.desligados||[]).filter(x=>x&&x.id!==colabId)]},
  destino:{...d,colaboradores:[...d.colaboradores,entrada],desligados:(d.desligados||[]).filter(x=>x&&x.id!==colabId)}, // voltou a um projeto onde já esteve: sai do histórico de saídas dele
  fotos,
 };
}
async function moverNoBanco(db,dados){
 const {de,para}=dados,ro=db.collection('equipes').doc(de),rd=db.collection('equipes').doc(para);
 return db.runTransaction(async tx=>{
  const [so,sd]=[await tx.get(ro),await tx.get(rd)];
  const r=mover(so.exists?so.data():null,sd.exists?sd.data():null,{...dados,agora:new Date().toISOString()});
  const copias=[];
  for(const ref of r.fotos){const f=await tx.get(ro.collection('fotos').doc(ref));if(f.exists)copias.push([rd.collection('fotos').doc(ref),f.data()]);}
  tx.set(ro,r.origem);tx.set(rd,r.destino);
  for(const [ref,data] of copias)tx.set(ref,data);
  return r.origem;
 });
}
module.exports={mover,moverNoBanco,TIPO};

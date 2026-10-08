const stable=x=>Array.isArray(x)?x.map(stable):(x!==null&&typeof x==='object')?Object.keys(x).sort().reduce((o,k)=>{if(x[k]!==undefined)o[k]=stable(x[k]);return o;},{}):x;
const equal=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
// O caminho do conflito vai para o log. Só pode conter NOMES DE CAMPOS conhecidos e slots de checagem conhecidos:
// qualquer outra chave (nome de pessoa, id, texto digitado) vira "*" e qualquer slot desconhecido vira "?".
const CAMPOS=new Set(['colaboradores','desligados','checagemEquipe','checkins','alvo','concluidoEm','proximoAlvo','slotId','slotLabel','lider','statusEquipe','nota','em','historico','uniforme','solicitacoes','itens','ferias','perfilSeguranca','tipoEquipe','armada','ccoDedicada','fv','nome','cargo','turno','status','escala','telefone','projectId','criadoEm','atualizadoEm','dataContratacao','ultimaReciclagem','foto','fotoRef','temFoto','desligadoEm','motivoDesligamento','tipoDesligamento','id','tipo','data','dataFim','dataInicio','dataRetorno','subtipo','detalhe','obs','observacao','item','marca','tamanho','motivo','aprovacao','aprovacaoHist','solicitadoEm','whatsEnviadoEm','whatsEnvios','exigeWhats','whatsDispensadoEm','colabId','cobertura','usa','ultimaTroca','listaMontada']);
const SLOTS=/^(?:(?:sab|dom)_(?:diurno|noturno)|diurno|noturno|check_[1-9])$/;
function limparCaminho(p){
 return String(p||'').split('/').map(seg=>{
  const m=/^([^\[\]]*)(?:\[([\s\S]*)\])?$/.exec(seg);if(!m)return '*';
  const nome=m[1]===''?'':(CAMPOS.has(m[1])?m[1]:'*');
  return m[2]===undefined?nome:nome+'['+(m[2]===''?'':(SLOTS.test(m[2])?m[2]:'?'))+']';
 }).join('/').slice(0,160);
}
function conflict(path){const e=Error('Outro usuário alterou este registro. Reabra a tela antes de salvar. Nenhum dado foi sobrescrito.');e.status=409;e.path=limparCaminho(path);throw e;}
// checagemEquipe = { alvo, checkins:[{slotId,...}], concluidoEm?, proximoAlvo? }. Os check-ins não têm "id":
// a chave é o slotId. Une os check-ins de líderes diferentes, nunca apaga, nunca sobrescreve o mesmo slot em silêncio.
const slotKey=c=>(c&&typeof c==='object')?String(c.slotId||c.id||c.em||''):'';
function mergeChecagem(before,after,current){
 if(equal(before,after))return current;
 if(equal(current,after))return current;
 if(equal(before,current))return after;
 if(!object(after))conflict('checagemEquipe');
 if(!object(current))return after;
 const cAfter=String(after.alvo||''),cCur=String(current.alvo||'');
 if(cAfter&&cCur&&cAfter<cCur)return current;      // tela de um ciclo anterior não apaga o ciclo vigente
 if(cAfter!==cCur)return after;                    // início de um novo ciclo
 const list=x=>Array.isArray(x&&x.checkins)?x.checkins:[];
 const bef=object(before)&&String(before.alvo||'')===cAfter?list(before):[];
 const out=list(current).slice();
 for(const a of list(after)){
  const k=slotKey(a);if(!k)conflict('checagemEquipe/checkins');
  const b=bef.find(x=>slotKey(x)===k),i=out.findIndex(x=>slotKey(x)===k);
  if(b&&equal(a,b))continue;                       // este slot não foi alterado nesta edição
  if(i<0){out.push(a);continue;}                   // slot novo
  if(equal(out[i],a))continue;                     // retry idêntico: não duplica
  if(b&&equal(b,out[i])){out[i]=a;continue;}       // ninguém mexeu neste slot desde a base: substitui
  conflict('checagemEquipe/checkins['+k+']');      // o mesmo slot foi assinado por outra pessoa
 }
 const merged={...current,checkins:out};
 for(const key of Object.keys(after))if(key!=='checkins'&&merged[key]===undefined)merged[key]=after[key]; // concluidoEm, proximoAlvo
 return merged;
}
function merge(before,after,current,depth=0,path=''){
 if(equal(before,after))return current;
 if(equal(current,after))return current;
 if(equal(before,current))return after;
 if(object(before)&&object(after)&&object(current)){
  const out={...current};
  for(const key of new Set([...Object.keys(before),...Object.keys(after)])){
   if(['__proto__','constructor','prototype'].includes(key))conflict(path+'/'+key);
   const value=(depth===0&&key==='checagemEquipe')?mergeChecagem(before[key],after[key],current[key]):merge(before[key],after[key],current[key],depth+1,path+'/'+key);
   if(value===undefined)delete out[key];else out[key]=value;
  }return out;
 }
 if(Array.isArray(before)&&Array.isArray(after)&&Array.isArray(current)){
  const keyed=a=>a.every(x=>object(x)&&typeof x.id==='string'&&x.id)&&new Set(a.map(x=>x.id)).size===a.length;
  if(![before,after,current].every(keyed))conflict(path+'[]');
  const bm=new Map(before.map(x=>[x.id,x])),am=new Map(after.map(x=>[x.id,x]));
  const out=current.map(x=>merge(bm.get(x.id),am.has(x.id)?am.get(x.id):bm.has(x.id)?undefined:x,x,depth+1,path+'[]')).filter(x=>x!==undefined);
  for(const a of after)if(!current.some(x=>x.id===a.id)){
   const value=merge(bm.get(a.id),a,undefined,depth+1,path+'[]');if(value!==undefined)out.push(value);
  }return out;
 }
 conflict(path||'/');
}
const restricted=['aprovacao','aprovadoEm','aprovadoPor','aprovacaoHist','precoUnit','whatsDispensadoEm','whatsDispensadoPor'];
function validateQuantities(before,after){
 const pedidos=base=>[...(base.colaboradores||[]),...(base.desligados||[])].flatMap(c=>(c.uniforme?.solicitacoes||[]).map(s=>({c:c.id,s})));
 const antigos=pedidos(before);
 for(const {c,s} of pedidos(after)){
  const prev=antigos.find(x=>x.c===c&&x.s.id===s.id)?.s;
  if(prev&&equal(prev.qtd,s.qtd)&&equal(prev.quantidade,s.quantidade))continue;
  const qtd=Number(s.qtd??s.quantidade??1);
  if(!Number.isSafeInteger(qtd)||qtd<1||qtd>100000||(s.qtd!=null&&s.quantidade!=null&&Number(s.qtd)!==Number(s.quantidade))){
   const e=Error('Quantidade da solicitação inválida. Informe um inteiro entre 1 e 100000.');e.status=400;throw e;
  }
 }
}
function validateLeader(before,after){
 for(const field of ['fv','campanhasSazonais','historicoDesde','treinamentosEsperados'])if(!equal(before[field],after[field])){const e=Error('Alteração exclusivamente gerencial.');e.status=403;throw e;}
 const old=[...(before.colaboradores||[]),...(before.desligados||[])].flatMap(c=>(c.uniforme?.solicitacoes||[]).map(s=>({c:c.id,s})));
 for(const c of [...(after.colaboradores||[]),...(after.desligados||[])])for(const s of c.uniforme?.solicitacoes||[]){
  const prev=old.find(x=>x.c===c.id&&x.s.id===s.id)?.s;
  if(!prev){if(s.exigeWhats!==true||s.aprovacao!=='aguardando'||restricted.filter(k=>k!=='aprovacao').some(k=>s[k]!=null)){const e=Error('Solicitação do líder inválida.');e.status=403;throw e;}}
  else if([...restricted,'exigeWhats'].some(k=>!equal(prev[k],s[k]))){const e=Error('Aprovação exclusivamente gerencial.');e.status=403;throw e;}
  if(prev&&['qtd','quantidade'].some(k=>!equal(prev[k],s[k]))&&(prev.aprovacao!=='aguardando'||prev.status!=='pendente')){
   const e=Error('Quantidade já decidida só pode ser corrigida pelo gerencial.');e.status=403;throw e;
  }
  const mudouEnvio=['whatsEnviadoEm','whatsEnvios','whatsEventos'].some(k=>!equal(prev?.[k],s[k]));
  const temEnvio=!!s.whatsEnviadoEm||Number(s.whatsEnvios)>0||(s.whatsEventos||[]).length>0;
  if(mudouEnvio&&(!prev?temEnvio:prev.aprovacao!=='aprovado'||prev.status!=='pendente'||s.status!=='pendente')){
   const e=Error('Só solicitações aprovadas e pendentes podem registrar envio ao grupo. Reabra a ficha.');e.status=403;throw e;
  }
 }
}
function protegerChecagem(current,result,identity){
 const deny=()=>{throw Object.assign(Error('Plantão já checado. Somente o gerencial pode corrigir a assinatura.'),{status:403});};
 if(!equal(current.checagemCorrecoes,result.checagemCorrecoes))throw Object.assign(Error('Histórico de correções é mantido pelo servidor.'),{status:403});
 const old=current.checagemEquipe,next=result.checagemEquipe;
 if(equal(old,next)||!old)return;
 if(old.alvo!==next?.alvo){
  if(identity.nivel==='lider'){
   const hoje=new Date().toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'});
   const d=new Date(hoje+'T12:00:00Z'),day=d.getUTCDay();d.setUTCDate(d.getUTCDate()+(day===0?-1:(6-day+7)%7));
   if(!next||next.alvo!==d.toISOString().slice(0,10)||next.alvo<=old.alvo)deny();
  }
  return;
 }
 const changes=(old.checkins||[]).flatMap(prev=>{
  const novo=(next.checkins||[]).find(c=>slotKey(c)===slotKey(prev));
  if(equal(prev,novo))return [];
  if(identity.nivel!=='admin')deny();
  return [{alvo:old.alvo,slotId:slotKey(prev),anterior:prev,novo:novo||null,corrigidoEm:new Date().toISOString(),corrigidoPor:'Gerencial'}];
 });
 if(changes.length)result.checagemCorrecoes=[...(current.checagemCorrecoes||[]),...changes];
}
async function save(db,pid,before,after,identity){
 const ref=db.collection('equipes').doc(pid);
 return db.runTransaction(async tx=>{
  const snap=await tx.get(ref),current=snap.exists?snap.data():{colaboradores:[],desligados:[]};
  const result=merge(before,after,current);
  if(!equal(current.campanhasSazonais,result.campanhasSazonais)){
   const configs=result.campanhasSazonais;
   if(!object(configs)||Object.entries(configs).some(([k,v])=>! /^(natal|pascoa)_20\d{2}$/.test(k)||!object(v)||Object.keys(v).some(f=>!['oculta','valorCentavos'].includes(f))||(v.oculta!==undefined&&typeof v.oculta!=='boolean')||(v.valorCentavos!==undefined&&(!Number.isSafeInteger(v.valorCentavos)||v.valorCentavos<0||v.valorCentavos>100000000))))throw Object.assign(Error('Configuração de campanha inválida.'),{status:400});
  }
  protegerChecagem(current,result,identity);
  validateQuantities(current,result);
  if(identity.nivel==='lider')validateLeader(current,result);
  tx.set(ref,result);return result;
 });
}
module.exports={merge,save,validateLeader,validateQuantities};

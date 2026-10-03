const stable=x=>Array.isArray(x)?x.map(stable):(x!==null&&typeof x==='object')?Object.keys(x).sort().reduce((o,k)=>{if(x[k]!==undefined)o[k]=stable(x[k]);return o;},{}):x;
const equal=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function conflict(){const e=Error('Outro usuário alterou este registro. Reabra a tela antes de salvar. Nenhum dado foi sobrescrito.');e.status=409;throw e;}
// checagemEquipe = { alvo, checkins:[{slotId,...}], concluidoEm?, proximoAlvo? }. Os check-ins não têm "id":
// a chave é o slotId. Une os check-ins de líderes diferentes, nunca apaga, nunca sobrescreve o mesmo slot em silêncio.
const slotKey=c=>(c&&typeof c==='object')?String(c.slotId||c.id||c.em||''):'';
function mergeChecagem(before,after,current){
 if(equal(before,after))return current;
 if(equal(current,after))return current;
 if(equal(before,current))return after;
 if(!object(after))conflict();
 if(!object(current))return after;
 const cAfter=String(after.alvo||''),cCur=String(current.alvo||'');
 if(cAfter&&cCur&&cAfter<cCur)return current;      // tela de um ciclo anterior não apaga o ciclo vigente
 if(cAfter!==cCur)return after;                    // início de um novo ciclo
 const list=x=>Array.isArray(x&&x.checkins)?x.checkins:[];
 const bef=object(before)&&String(before.alvo||'')===cAfter?list(before):[];
 const out=list(current).slice();
 for(const a of list(after)){
  const k=slotKey(a);if(!k)conflict();
  const b=bef.find(x=>slotKey(x)===k),i=out.findIndex(x=>slotKey(x)===k);
  if(b&&equal(a,b))continue;                       // este slot não foi alterado nesta edição
  if(i<0){out.push(a);continue;}                   // slot novo
  if(equal(out[i],a))continue;                     // retry idêntico: não duplica
  if(b&&equal(b,out[i])){out[i]=a;continue;}       // ninguém mexeu neste slot desde a base: substitui
  conflict();                                      // o mesmo slot foi assinado por outra pessoa
 }
 const merged={...current,checkins:out};
 for(const key of Object.keys(after))if(key!=='checkins'&&merged[key]===undefined)merged[key]=after[key]; // concluidoEm, proximoAlvo
 return merged;
}
function merge(before,after,current,depth=0){
 if(equal(before,after))return current;
 if(equal(current,after))return current;
 if(equal(before,current))return after;
 if(object(before)&&object(after)&&object(current)){
  const out={...current};
  for(const key of new Set([...Object.keys(before),...Object.keys(after)])){
   if(['__proto__','constructor','prototype'].includes(key))conflict();
   const value=(depth===0&&key==='checagemEquipe')?mergeChecagem(before[key],after[key],current[key]):merge(before[key],after[key],current[key],depth+1);
   if(value===undefined)delete out[key];else out[key]=value;
  }return out;
 }
 if(Array.isArray(before)&&Array.isArray(after)&&Array.isArray(current)){
  const keyed=a=>a.every(x=>object(x)&&typeof x.id==='string'&&x.id)&&new Set(a.map(x=>x.id)).size===a.length;
  if(![before,after,current].every(keyed))conflict();
  const bm=new Map(before.map(x=>[x.id,x])),am=new Map(after.map(x=>[x.id,x]));
  const out=current.map(x=>merge(bm.get(x.id),am.has(x.id)?am.get(x.id):bm.has(x.id)?undefined:x,x,depth+1)).filter(x=>x!==undefined);
  for(const a of after)if(!current.some(x=>x.id===a.id)){
   const value=merge(bm.get(a.id),a,undefined,depth+1);if(value!==undefined)out.push(value);
  }return out;
 }
 conflict();
}
const restricted=['aprovacao','aprovadoEm','aprovadoPor','aprovacaoHist','precoUnit','whatsDispensadoEm','whatsDispensadoPor'];
function validateLeader(before,after){
 for(const field of ['fv'])if(!equal(before[field],after[field])){const e=Error('Alteração exclusivamente gerencial.');e.status=403;throw e;}
 const old=[...(before.colaboradores||[]),...(before.desligados||[])].flatMap(c=>(c.uniforme?.solicitacoes||[]).map(s=>({c:c.id,s})));
 for(const c of [...(after.colaboradores||[]),...(after.desligados||[])])for(const s of c.uniforme?.solicitacoes||[]){
  const prev=old.find(x=>x.c===c.id&&x.s.id===s.id)?.s;
  if(!prev){if(s.exigeWhats!==true||s.aprovacao!=='aguardando'||restricted.filter(k=>k!=='aprovacao').some(k=>s[k]!=null)){const e=Error('Solicitação do líder inválida.');e.status=403;throw e;}}
  else if([...restricted,'exigeWhats'].some(k=>!equal(prev[k],s[k]))){const e=Error('Aprovação exclusivamente gerencial.');e.status=403;throw e;}
 }
}
async function save(db,pid,before,after,identity){
 const ref=db.collection('equipes').doc(pid);
 return db.runTransaction(async tx=>{
  const snap=await tx.get(ref),current=snap.exists?snap.data():{colaboradores:[],desligados:[]};
  const result=merge(before,after,current);
  if(identity.nivel==='lider')validateLeader(current,result);
  tx.set(ref,result);return result;
 });
}
module.exports={merge,save,validateLeader};

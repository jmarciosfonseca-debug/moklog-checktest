const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function conflict(){const e=Error('Outro usuário alterou este registro. Reabra a tela antes de salvar. Nenhum dado foi sobrescrito.');e.status=409;throw e;}
function merge(before,after,current){
 if(equal(before,after))return current;
 if(equal(current,after))return current;
 if(equal(before,current))return after;
 if(object(before)&&object(after)&&object(current)){
  const out={...current};
  for(const key of new Set([...Object.keys(before),...Object.keys(after)])){
   if(['__proto__','constructor','prototype'].includes(key))conflict();
   const value=merge(before[key],after[key],current[key]);
   if(value===undefined)delete out[key];else out[key]=value;
  }return out;
 }
 if(Array.isArray(before)&&Array.isArray(after)&&Array.isArray(current)){
  const keyed=a=>a.every(x=>object(x)&&typeof x.id==='string'&&x.id)&&new Set(a.map(x=>x.id)).size===a.length;
  if(![before,after,current].every(keyed))conflict();
  const bm=new Map(before.map(x=>[x.id,x])),am=new Map(after.map(x=>[x.id,x]));
  const out=current.map(x=>merge(bm.get(x.id),am.has(x.id)?am.get(x.id):bm.has(x.id)?undefined:x,x)).filter(x=>x!==undefined);
  for(const a of after)if(!current.some(x=>x.id===a.id)){
   const value=merge(bm.get(a.id),a,undefined);if(value!==undefined)out.push(value);
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

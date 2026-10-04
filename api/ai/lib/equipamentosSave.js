const CATS=['smartphones','radiosHT','armamento','municao','placas','lanternas','ztrax','bodycam'];
const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;
const equal=(a,b)=>JSON.stringify(stable(a??null))===JSON.stringify(stable(b??null));
function fail(status,message){throw Object.assign(Error(message),{status});}
function validate(section,before,after,identity){
 if(![...CATS,'moto','checagemSemanal'].includes(section))fail(400,'Seção inválida.');
 if(CATS.includes(section)){
  if(!Array.isArray(after)||after.length>2000)fail(400,'Lista inválida.');
  const ids=new Set();
  for(const item of after){
   if(!item||!['string','number'].includes(typeof item.id)||!String(item.id)||ids.has(String(item.id)))fail(400,'Identificador inválido ou duplicado.');
   ids.add(String(item.id));const old=(before||[]).find(x=>x.id===item.id);
   if(equal(old,item))continue;
   if(!old||old.identificacao!==item.identificacao){if(typeof item.identificacao!=='string'||!item.identificacao.trim()||item.identificacao.length>200)fail(400,'Informe a identificação.');}
   if(!old||old.qtd!==item.qtd){const q=item.qtd??1;if(!Number.isSafeInteger(q)||q<(section==='municao'?0:1)||q>100000)fail(400,'Quantidade inválida.');}
  }
  if(identity.nivel==='lider'&&(before||[]).some(x=>!ids.has(String(x.id))))fail(403,'Exclusão de equipamento é gerencial.');
 }else{
  if(!after||typeof after!=='object'||Array.isArray(after))fail(400,'Dados inválidos.');
  if(section==='checagemSemanal'&&(!/^\d{4}-\d{2}-\d{2}$/.test(after.alvo||'')||typeof after.ultimoResultado?.por!=='string'||after.ultimoResultado.por.trim().length<3))fail(400,'Assinatura da checagem inválida.');
 }
}
async function save(db,pid,section,before,after,identity){
 if(![...CATS,'moto','checagemSemanal'].includes(section))fail(400,'Seção inválida.');
 const ref=db.collection('equipamentos').doc(pid);
 return db.runTransaction(async tx=>{
  const snap=await tx.get(ref),current=snap.exists?snap.data():{};
  if(equal(current[section],after))return current;
  if(!equal(current[section]??(CATS.includes(section)?[]:null),before??(CATS.includes(section)?[]:null)))fail(409,'Esta seção foi alterada em outra tela. Reconsulte os dados antes de tentar novamente.');
  validate(section,current[section],after,identity);
  const patch={[section]:after,updatedAt:new Date().toISOString()};
  if(snap.exists)tx.update(ref,patch);else tx.set(ref,patch);
  return {...current,...patch};
 });
}
module.exports={save,validate};

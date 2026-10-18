const CATS=['smartphones','radiosHT','armamento','municao','placas','lanternas','ztrax','bodycam','outros'];
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
// Baixa de equipamento (líder ou gerencial): o item sai da lista ativa e vai, inteiro, para `baixados` com o motivo.
// Uma única gravação (nada se perde no meio); as listas ativas continuam limpas para todas as telas e relatórios.
const MOTIVOS_BAIXA=['Substituído','Extraviado','Danificado / inservível','Devolvido','Outro'];
async function baixa(db,pid,pedido,identity){
 const p=pedido&&typeof pedido==='object'?pedido:{};
 if(!CATS.includes(p.categoria))fail(400,'Categoria inválida.');
 const semId=p.id==null;   // item antigo sem identificador: localizado por posição + identificação
 if(semId?!(Number.isSafeInteger(p.indice)&&p.indice>=0&&typeof p.identificacao==='string'):!['string','number'].includes(typeof p.id)||!String(p.id))fail(400,'Item inválido.');
 if(!MOTIVOS_BAIXA.includes(p.motivo))fail(400,'Escolha o motivo da baixa.');
 const obs=typeof p.obs==='string'?p.obs.trim().slice(0,500):'';
 if(p.motivo==='Outro'&&obs.length<3)fail(400,'Descreva o motivo da baixa.');
 const por=typeof p.por==='string'?p.por.trim().slice(0,120):'';
 const ref=db.collection('equipamentos').doc(pid);
 return db.runTransaction(async tx=>{
  const snap=await tx.get(ref),current=snap.exists?snap.data():{};
  const lista=Array.isArray(current[p.categoria])?current[p.categoria]:[];
  const alvo=semId?(lista[p.indice]&&lista[p.indice].id==null&&String(lista[p.indice].identificacao||'')===p.identificacao?lista[p.indice]:null):lista.find(x=>x&&String(x.id)===String(p.id));
  const baixados=Array.isArray(current.baixados)?current.baixados:[];
  if(!alvo){
   if(!semId&&baixados.some(x=>x&&x.categoria===p.categoria&&String(x.id)===String(p.id)))return current;   // reenvio: já baixado
   fail(404,'Este item não está mais no cadastro. Reabra a tela.');
  }
  const em=new Date().toISOString();
  const registro={...alvo,categoria:p.categoria,baixa:{motivo:p.motivo,obs,por,nivel:identity&&identity.nivel||'',em}};
  const patch={[p.categoria]:lista.filter(x=>x!==alvo),baixados:[...baixados,registro],updatedAt:em};
  if(snap.exists)tx.update(ref,patch);else tx.set(ref,patch);
  return {...current,...patch};
 });
}
async function save(db,pid,section,before,after,identity){
 if(section==='baixa')return baixa(db,pid,after,identity);
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
module.exports={save,validate,MOTIVOS_BAIXA};

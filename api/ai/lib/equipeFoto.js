// Fotos dos colaboradores: gravação IMUTÁVEL e com id derivado do conteúdo.
//   equipes/{pid}/fotos/{colabId}-{sha256[0..16]}  (criada uma única vez; nunca sobrescrita)
// O cadastro só passa a apontar para ela (fotoRef) na gravação normal da Equipe, que tem revisão e devolve 409 em conflito.
// Assim: foto nova nunca apaga a de outra pessoa, falha na gravação do cadastro deixa apenas uma foto sem uso (inofensiva)
// e duas trocas simultâneas viram um conflito visível no campo fotoRef.
const crypto=require('crypto');
const FOTO=/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_CHARS=150*1024;
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const erro=(status,msg)=>Object.assign(new Error(msg),{status});
function validar({pid,colabId,dataUrl},projetos){
 if(!projetos.includes(pid))throw erro(403,'Projeto sem permissão.');
 if(typeof colabId!=='string'||!/^[-a-zA-Z0-9_]{1,80}$/.test(colabId))throw erro(400,'Colaborador inválido.');
 if(typeof dataUrl!=='string'||dataUrl.length>MAX_CHARS||!FOTO.test(dataUrl))throw erro(400,'Foto inválida ou muito grande.');
}
const idDe=(colabId,dataUrl)=>colabId+'-'+sha(dataUrl).slice(0,16);
async function criarFoto(db,{pid,colabId,dataUrl},agora=()=>new Date().toISOString()){
 const id=idDe(colabId,dataUrl);
 const ref=db.collection('equipes').doc(pid).collection('fotos').doc(id);
 try{await ref.create({data:dataUrl,bytes:dataUrl.length,sha256:sha(dataUrl),colabId,criadoEm:agora(),origem:'app'});return {id,criada:true};}
 catch(e){
  if(!(e&&(e.code===6||/already exists/i.test(e.message||''))))throw e;
  const s=await ref.get();
  if(s.exists&&s.data().data===dataUrl)return {id,criada:false};   // mesma foto já gravada: idempotente
  throw erro(409,'Conflito de identificador da foto. Tente novamente.');   // colisão de hash: nunca sobrescreve
 }
}
module.exports={validar,idDe,criarFoto,sha,MAX_CHARS,FOTO};

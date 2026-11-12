const auth=require('./ai/lib/accessAuth');
const {getDb}=require('./ai/lib/firebaseAdmin');
const {save}=require('./ai/lib/equipeMerge');
// Telemetria sem dados pessoais: projeto, perfil, tempo (ms), tamanho do pedido (KB) e, em conflito, o CAMINHO das chaves.
function log(status,pid,a,t0,body,path){try{console.log(JSON.stringify({evt:'equipeSave',status,pid,nivel:a&&a.nivel,ms:Date.now()-t0,kbIn:Math.round(JSON.stringify(body||{}).length/1024),...(status===409?{conflitoEm:path||''}:{})}));}catch{}}
const {noProjeto}=require('./ai/lib/escopoDivisao');
const {moverNoBanco}=require('./ai/lib/equipeMover');
const {decifrar,formatar}=require('./ai/lib/cpf');
// Transferência entre projetos: só o consultor (gerencial) ou o gestor da divisão, e este só dentro da divisão dele.
async function moverColaborador(res,a,body,t0){
 const {pid,para,colabId,data}=body;
 if(![pid,para].every(p=>auth.PROJECTS.includes(p)&&noProjeto(a,p).nivel==='admin'))return res.status(403).json({ok:false,erro:'Só o consultor move colaboradores entre projetos.'});
 if(typeof colabId!=='string'||!/^[-\w]{1,80}$/.test(colabId))return res.status(400).json({ok:false,erro:'Colaborador inválido.'});
 try{const origem=await moverNoBanco(getDb(),{de:pid,para,colabId,data});console.log(JSON.stringify({evt:'equipeMover',status:200,de:pid,para,nivel:a.nivel,ms:Date.now()-t0}));return res.status(200).json({ok:true,data:origem});}
 catch(e){console.log(JSON.stringify({evt:'equipeMover',status:e.status||503,de:pid,para,nivel:a.nivel,ms:Date.now()-t0}));return res.status(e.status||503).json({ok:false,erro:e.status?e.message:'Não foi possível mover agora. Nada foi alterado; tente novamente.'});}
}
// Mostrar o CPF completo: só o consultor (ou o gestor da divisão, nos projetos dela). O número não vai para o log.
async function verCpf(res,a,body){
 const {pid,colabId}=body;
 if(!auth.PROJECTS.includes(pid)||noProjeto(a,pid).nivel!=='admin')return res.status(403).json({ok:false,erro:'Só o consultor vê o CPF completo.'});
 try{
  const snap=await getDb().collection('equipes').doc(pid).get(),d=snap.exists?snap.data():{};
  const c=[...(d.colaboradores||[]),...(d.desligados||[])].find(x=>x&&x.id===colabId);
  const cpf=c&&c.cpfCifrado?decifrar(c.cpfCifrado):null;
  console.log(JSON.stringify({evt:'equipeCpf',status:cpf?200:404,pid,nivel:a.nivel}));
  return cpf?res.status(200).json({ok:true,cpf:formatar(cpf)}):res.status(404).json({ok:false,erro:'CPF não cadastrado para este colaborador.'});
 }catch(e){return res.status(e.status||503).json({ok:false,erro:e.status?e.message:'Não foi possível consultar agora.'});}
}
module.exports=async(req,res)=>{
 const t0=Date.now();
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({ok:false,erro:'Método não permitido'});
 let a=auth.verify(/^Bearer (.+)$/.exec(req.headers?.authorization||'')?.[1]);
 if(!a)return res.status(401).json({ok:false,erro:'Sessão ausente ou expirada. Entre novamente.'});
 if(!['admin','lider','gestor'].includes(a.nivel))return res.status(403).json({ok:false,erro:'Perfil sem permissão para gravar.'});
 let body;try{body=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{return res.status(400).json({ok:false,erro:'Pedido inválido'});}
 if(body&&body.acao==='mover')return moverColaborador(res,a,body,t0);
 if(body&&body.acao==='cpf')return verCpf(res,a,body);
 const {pid,before,after}=body||{};
 a=noProjeto(a,pid);if(a.nivel==='negado')return res.status(403).json({ok:false,erro:'Projeto sem permissão.'}); // gestor de divisão: só os projetos dela
 if(!auth.PROJECTS.includes(pid)||(a.nivel==='lider'&&a.pid!==pid))return res.status(403).json({ok:false,erro:'Projeto sem permissão.'});
 if(!before||!after||Array.isArray(before)||Array.isArray(after)||!Array.isArray(after.colaboradores)||JSON.stringify(body).length>3500000)return res.status(400).json({ok:false,erro:'Dados inválidos ou muito grandes.'});
 try{const data=await save(getDb(),pid,before,after,a);log(200,pid,a,t0,body);return res.status(200).json({ok:true,data});}
 catch(e){log(e.status||503,pid,a,t0,body,e.path);return res.status(e.status||503).json({ok:false,erro:e.status?e.message:'Não foi possível salvar no servidor. Os dados locais foram mantidos; tente novamente.'});}
};

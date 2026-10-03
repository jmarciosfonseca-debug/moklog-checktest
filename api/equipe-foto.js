const auth=require('./ai/lib/accessAuth');
const {getDb}=require('./ai/lib/firebaseAdmin');
const {validar,criarFoto}=require('./ai/lib/equipeFoto');
// POST { pid, colabId, dataUrl } -> { ok, ref }. Mesma autorização da gravação da Equipe: gerencial em qualquer projeto,
// líder apenas no próprio. Demo e operador de ronda não gravam.
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({ok:false,erro:'Método não permitido'});
 const a=auth.verify(/^Bearer (.+)$/.exec(req.headers?.authorization||'')?.[1]);
 if(!a)return res.status(401).json({ok:false,erro:'Sessão ausente ou expirada. Entre novamente.'});
 if(!['admin','lider'].includes(a.nivel))return res.status(403).json({ok:false,erro:'Perfil sem permissão para gravar.'});
 let body;try{body=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{return res.status(400).json({ok:false,erro:'Pedido inválido'});}
 const {pid,colabId,dataUrl}=body||{};
 if(a.nivel==='lider'&&a.pid!==pid)return res.status(403).json({ok:false,erro:'Projeto sem permissão.'});
 try{validar({pid,colabId,dataUrl},auth.PROJECTS);const r=await criarFoto(getDb(),{pid,colabId,dataUrl});return res.status(200).json({ok:true,ref:r.id});}
 catch(e){return res.status(e.status||503).json({ok:false,erro:e.status?e.message:'Não foi possível gravar a foto. Tente novamente.'});}
};

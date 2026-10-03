const auth=require('./ai/lib/accessAuth');
const {getDb}=require('./ai/lib/firebaseAdmin');
const {save}=require('./ai/lib/equipeMerge');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({ok:false,erro:'Método não permitido'});
 const a=auth.verify(/^Bearer (.+)$/.exec(req.headers?.authorization||'')?.[1]);
 if(!a)return res.status(401).json({ok:false,erro:'Sessão ausente ou expirada. Entre novamente.'});
 if(!['admin','lider'].includes(a.nivel))return res.status(403).json({ok:false,erro:'Perfil sem permissão para gravar.'});
 let body;try{body=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{return res.status(400).json({ok:false,erro:'Pedido inválido'});}
 const {pid,before,after}=body||{};
 if(!auth.PROJECTS.includes(pid)||(a.nivel==='lider'&&a.pid!==pid))return res.status(403).json({ok:false,erro:'Projeto sem permissão.'});
 if(!before||!after||Array.isArray(before)||Array.isArray(after)||!Array.isArray(after.colaboradores)||JSON.stringify(body).length>3500000)return res.status(400).json({ok:false,erro:'Dados inválidos ou muito grandes.'});
 try{return res.status(200).json({ok:true,data:await save(getDb(),pid,before,after,a)});}
 catch(e){return res.status(e.status||503).json({ok:false,erro:e.status?e.message:'Não foi possível salvar no servidor. Os dados locais foram mantidos; tente novamente.'});}
};

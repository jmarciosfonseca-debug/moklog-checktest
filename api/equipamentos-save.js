const auth=require('./ai/lib/accessAuth');
const {getDb}=require('./ai/lib/firebaseAdmin');
const {save}=require('./ai/lib/equipamentosSave');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({ok:false,erro:'Método não permitido.'});
 const a=auth.verify(/^Bearer (.+)$/.exec(req.headers?.authorization||'')?.[1]);
 if(!a)return res.status(401).json({ok:false,erro:'Sessão ausente ou expirada.'});
 if(!['admin','lider'].includes(a.nivel))return res.status(403).json({ok:false,erro:'Perfil sem permissão.'});
 let b;try{b=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{return res.status(400).json({ok:false,erro:'Pedido inválido.'});}
 if(!b||!auth.PROJECTS.includes(b.pid)||(a.nivel==='lider'&&a.pid!==b.pid))return res.status(403).json({ok:false,erro:'Projeto sem permissão.'});
 if(typeof b.section!=='string'||b.after===undefined||!Object.hasOwn(b,'before')||JSON.stringify(b).length>2000000)return res.status(400).json({ok:false,erro:'Dados inválidos ou muito grandes.'});
 try{const data=await save(getDb(),b.pid,b.section,b.before,b.after,a);return res.status(200).json({ok:true,data});}
 catch(e){return res.status(e.status||503).json({ok:false,erro:e.status?e.message:'Não foi possível salvar no servidor. Tente novamente.'});}
};

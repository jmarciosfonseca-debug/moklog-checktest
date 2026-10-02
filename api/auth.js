const {getDb}=require('./ai/lib/firebaseAdmin');
const auth=require('./ai/lib/accessAuth');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');if(req.method!=='POST')return res.status(405).json({ok:false,erro:'Método não permitido'});
 let body;try{body=typeof req.body==='string'?JSON.parse(req.body):req.body||{};}catch{return res.status(400).json({ok:false,erro:'Pedido inválido'});}
 if(typeof body.pin!=='string'||body.pin.length>128||!body.pin.trim()||(body.pid&&!auth.PROJECTS.includes(body.pid)))return res.status(400).json({ok:false,erro:'Pedido inválido'});
 try{auth.secret();const c=auth.hashes(),r=await auth.attempt(getDb(),auth.clientIp(req),body.pin.trim(),c,body.pid,body.ronda===true);
 if(r.blocked){res.setHeader('Retry-After',String(r.retry));return res.status(429).json({ok:false,erro:'Limite de tentativas. Aguarde 15 minutos.',retryAfter:r.retry});}
 if(!r.identity)return res.status(401).json({ok:false,erro:'PIN inválido'});return res.status(200).json({ok:true,...auth.issue(r.identity,Date.now(),c)});
 }catch(e){console.error('Autenticação indisponível',{code:e.code||'auth_backend'});return res.status(503).json({ok:false,erro:'Autenticação indisponível. Tente novamente ou contate o responsável.'});}
};

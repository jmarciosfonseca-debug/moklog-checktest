const admin=require("firebase-admin");
const {getDb}=require("./ai/lib/firebaseAdmin");
const {executar}=require("../src/single/singleServer");
module.exports=async(req,res)=>{
 res.setHeader("Cache-Control","no-store");
 if(req.method!=="POST")return res.status(405).json({ok:false,erro:"Método não permitido."});
 const token=/^Bearer (.+)$/.exec(req.headers?.authorization||"")?.[1];
 if(!token)return res.status(401).json({ok:false,erro:"Entre com seu login do Diagnóstico."});
 let db,user;
 try{
  db=getDb();
  const claims=await admin.auth().verifyIdToken(token,true);
  if(claims.firebase?.sign_in_provider==="anonymous")throw Error("anonymous");
  const p=await db.collection("usuarios").doc(claims.uid).get();
  if(!p.exists||p.data().active!==true||!["gerente","auditor"].includes(p.data().role))return res.status(403).json({ok:false,erro:"Perfil sem permissão."});
  user={...p.data(),uid:claims.uid};
 }catch{return res.status(401).json({ok:false,erro:"Sessão inválida ou acesso indisponível."});}
 let body;
 try{body=typeof req.body==="string"?JSON.parse(req.body):req.body;if(!body||Buffer.byteLength(JSON.stringify(body))>750000)throw Error();}
 catch{return res.status(400).json({ok:false,erro:"Pedido inválido ou muito grande."});}
 try{return res.status(200).json({ok:true,...await executar(db,user,body)});}
 catch(e){const status=e.status||(e.message?.includes("Quantidade")||e.message?.includes("ultrapassar")?400:503);return res.status(status).json({ok:false,erro:status<500?e.message:"Não foi possível salvar. Seu rascunho deve ser mantido; tente novamente."});}
};

const admin=require("firebase-admin");
const {getDb}=require("./ai/lib/firebaseAdmin");
const acc=require("./ai/lib/accessAuth");
const {executar}=require("../src/rd/rdServer");
module.exports=async(req,res)=>{
 res.setHeader("Cache-Control","no-store");
 if(req.method!=="POST")return res.status(405).json({ok:false,erro:"Método não permitido."});
 const token=/^Bearer (.+)$/.exec(req.headers?.authorization||"")?.[1];
 if(!token)return res.status(401).json({ok:false,erro:"Entre em Registros com o PIN gerencial (ou com o login do Diagnóstico)."});
 let db,user;
 try{
  db=getDb();
  // 1) Sessão do PIN do app (mesmo token de Registros/Equipe). O RD é exclusivamente gerencial.
  const pin=(()=>{try{return acc.verify(token);}catch{return null;}})();
  if(pin){
   if(pin.nivel!=="admin")return res.status(403).json({ok:false,erro:"O MK RD é exclusivamente gerencial."});
   // Usa o perfil do único gerente ativo: os dados ficam no MESMO uid do login do Diagnóstico.
   const gs=await db.collection("usuarios").where("role","==","gerente").where("active","==",true).limit(2).get();
   user=gs.size===1?{...gs.docs[0].data(),uid:gs.docs[0].id}:{uid:"gerencial",role:"gerente",viaPin:true};
  }else{
   // 2) Login do Diagnóstico (Firebase).
   const claims=await admin.auth().verifyIdToken(token,true);
   if(claims.firebase?.sign_in_provider==="anonymous")throw Error("anonymous");
   const p=await db.collection("usuarios").doc(claims.uid).get();
   if(!p.exists||p.data().active!==true||!["gerente","auditor"].includes(p.data().role))return res.status(403).json({ok:false,erro:"Perfil sem permissão."});
   user={...p.data(),uid:claims.uid};
  }
 }catch{return res.status(401).json({ok:false,erro:"Sessão inválida ou acesso indisponível."});}
 let body;
 try{body=typeof req.body==="string"?JSON.parse(req.body):req.body;if(!body||Buffer.byteLength(JSON.stringify(body))>500000)throw Error();}
 catch{return res.status(400).json({ok:false,erro:"Pedido inválido ou muito grande."});}
 try{return res.status(200).json({ok:true,...await executar(db,user,body)});}
 catch(e){const status=e.status||503;return res.status(status).json({ok:false,erro:status<500?e.message:"Não foi possível salvar. Seu rascunho local foi mantido; tente novamente."});}
};

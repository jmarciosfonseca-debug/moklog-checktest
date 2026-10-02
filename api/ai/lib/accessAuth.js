const crypto=require('crypto'),net=require('net');
const TTL=8*3600000,WINDOW=15*60000;
const PROJECTS=['P260A','P260B','P260C','P311A','P311B','P505','P601','P602','P604','P605','P606','P607'];
function secret(){const s=process.env.SESSION_SECRET||'';if(Buffer.byteLength(s)<32)throw Error('AUTH_CONFIG');return s;}
function hashes(){
 const map=JSON.parse(process.env.LIDER_PIN_HASHES||'{}');if(!map||typeof map!=='object'||Array.isArray(map))throw Error('AUTH_CONFIG');
 const c={admin:process.env.ADMIN_PIN_HASH,demo:process.env.DEMO_PIN_HASH,lider:{},ronda:process.env.RONDA_PIN_HASH};
 for(const pid of PROJECTS)c.lider[pid]=process.env['LIDER_PIN_HASH_'+pid]||map[pid];
 if(!c.admin||!c.demo)throw Error('AUTH_CONFIG');
 for(const h of [c.admin,c.demo,c.ronda,...Object.values(c.lider)].filter(Boolean))if(!/^[a-f0-9]{64}$/i.test(h)&&!/^scrypt:[a-f0-9]{32}:[a-f0-9]{64}$/i.test(h))throw Error('AUTH_CONFIG');
 return c;
}
function equalPin(pin,h){if(!h)return false;let a,b;if(h.startsWith('scrypt:')){const [,salt,v]=h.split(':');a=crypto.scryptSync(pin,Buffer.from(salt,'hex'),32);b=Buffer.from(v,'hex');}else{a=crypto.createHash('sha256').update(pin).digest();b=Buffer.from(h,'hex');}return a.length===b.length&&crypto.timingSafeEqual(a,b);}
function classify(pin,c,pid,ronda){
 const admin=equalPin(pin,c.admin),demo=equalPin(pin,c.demo),leaders=PROJECTS.filter(p=>equalPin(pin,c.lider[p])),operator=equalPin(pin,c.ronda);
 if(Number(admin)+Number(demo)+leaders.length+Number(operator)>1)return null; // Ambiguous shared PINs never escalate a leader to admin.
 if(admin)return {nivel:'admin'};if(demo)return {nivel:'demo'};
 if(leaders.length===1&&(!pid||pid===leaders[0]))return {nivel:'lider',pid:leaders[0]};
 if(operator&&ronda&&PROJECTS.includes(pid))return {nivel:'ronda',pid};return null;
}
function version(c=hashes()){return crypto.createHmac('sha256',secret()).update(JSON.stringify(c)).digest('base64url');}
function issue(identity,now=Date.now(),c=hashes()){
 const p={...identity,iat:now,exp:now+TTL,aud:'moklog-access-v1',v:version(c),jti:crypto.randomUUID()};
 const body=Buffer.from(JSON.stringify(p)).toString('base64url');return {token:body+'.'+crypto.createHmac('sha256',secret()).update(body).digest('base64url'),nivel:p.nivel,...(p.pid?{pid:p.pid}:{}),exp:p.exp};
}
function verify(token,now=Date.now()){
 if(typeof token!=='string'||token.length>2048||!/^[-\w]+\.[-\w]+$/.test(token))return null;
 try{const [body,sig]=token.split('.'),expected=crypto.createHmac('sha256',secret()).update(body).digest(),supplied=Buffer.from(sig,'base64url');if(supplied.length!==expected.length||!crypto.timingSafeEqual(supplied,expected))return null;
 const p=JSON.parse(Buffer.from(body,'base64url').toString());
 if(p.aud!=='moklog-access-v1'||!['admin','lider','demo','ronda'].includes(p.nivel)||!Number.isSafeInteger(p.iat)||!Number.isSafeInteger(p.exp)||p.iat>now||p.exp<=now||p.exp-p.iat!==TTL||p.v!==version())return null;
 if(['lider','ronda'].includes(p.nivel)&&!PROJECTS.includes(p.pid))return null;return p;}catch{return null;}
}
function requireAdmin(req,res){const m=/^Bearer ([-\w]+\.[-\w]+)$/.exec(req.headers?.authorization||''),a=verify(m?.[1]);if(!a){res.status(401).json({ok:false,erro:'Sessão ausente ou expirada. Entre novamente.'});return null;}if(a.nivel!=='admin'){res.status(403).json({ok:false,erro:'Acesso exclusivamente gerencial.'});return null;}return a;}
function clientIp(req){const value=process.env.VERCEL==='1'?req.headers?.['x-vercel-forwarded-for']||req.headers?.['x-forwarded-for']:req.socket?.remoteAddress;const ip=typeof value==='string'?value.split(',')[0].trim():'';if(!net.isIP(ip))throw Error('AUTH_IP');return ip;}
async function attempt(db,ip,pin,c,pid,ronda,now=Date.now()){
 const ref=db.collection('auth_tentativas').doc(crypto.createHmac('sha256',secret()).update(ip).digest('hex'));
 return db.runTransaction(async t=>{const old=(await t.get(ref)).data()||{};if(old.bloqueadoAte>now)return {blocked:true,retry:Math.ceil((old.bloqueadoAte-now)/1000)};
 const identity=classify(pin,c,pid,ronda);if(identity){t.set(ref,{falhas:0,inicioMs:now,bloqueadoAte:0,expiraEm:new Date(now+WINDOW*2)});return {identity};}
 const reset=!old.inicioMs||now-old.inicioMs>=WINDOW||(old.bloqueadoAte&&old.bloqueadoAte<=now),falhas=reset?1:(old.falhas||0)+1;
 t.set(ref,{falhas,inicioMs:reset?now:old.inicioMs,bloqueadoAte:falhas>=5?now+WINDOW:0,expiraEm:new Date(now+WINDOW*2)});return falhas>=5?{blocked:true,retry:900}:{invalid:true};});
}
function audit(db,t,a,pid,acao,ip){t.set(db.collection('fv_auditoria').doc(),{nivel:a.nivel,pid,acao,em:new Date().toISOString(),ip});}
module.exports={TTL,WINDOW,PROJECTS,hashes,secret,classify,issue,verify,requireAdmin,clientIp,attempt,audit};

const crypto=require('crypto'),net=require('net');
const TTL=8*3600000,WINDOW=15*60000;
const {DIVISAO_IDS}=require('../../../src/divisoes');
// MokPat (11/11/2026): projetos patrimoniais entram na lista de projetos válidos; o gestor da divisão tem nível próprio
// ('gestor', com div) e só alcança os projetos da divisão dele. requireAdmin continua exclusivo do admin Moked.
const PROJECTS=['P260A','P260B','P260C','P311A','P311B','P505','P601','P602','P604','P605','P606','P607',...Object.values(DIVISAO_IDS).flat()];
const GESTORES={mokpat:'MOKPAT_PIN_HASH',mokimp:'MOKIMP_PIN_HASH'};
// Painel do Cliente (só leitura). PIN por projeto = gestor do parque; PIN por grupo = proprietário (vê todos do grupo).
const GRUPOS={GOLGI:['P601','P602','P604','P605','P606','P607'],MEGA:['P311A','P311B'],P260:['P260A','P260B','P260C'],P505:['P505'],
 // MokPat (11/11/2026): o cliente do P939 responde também pelo P944 (entra no escopo quando o projeto for cadastrado).
 P939:['P939','P944'].filter(p=>PROJECTS.includes(p))};
function escoposCliente(){const m=JSON.parse(process.env.CLIENTE_PIN_HASHES||'{}');if(!m||typeof m!=='object'||Array.isArray(m))throw Error('AUTH_CONFIG');
 // Também aceita uma variável por escopo (CLIENTE_PIN_HASH_<ESCOPO>), como nos líderes: acrescentar cliente não mexe no JSON existente.
 for(const k of [...Object.keys(GRUPOS),...PROJECTS])if(!m[k]&&process.env['CLIENTE_PIN_HASH_'+k])m[k]=process.env['CLIENTE_PIN_HASH_'+k];const out={};for(const [k,h] of Object.entries(m)){const pids=GRUPOS[k]||(PROJECTS.includes(k)?[k]:null);if(pids&&h)out[k]={hash:h,pids};}return out;}
function secret(){const s=process.env.SESSION_SECRET||'';if(Buffer.byteLength(s)<32)throw Error('AUTH_CONFIG');return s;}
function hashes(){
 const map=JSON.parse(process.env.LIDER_PIN_HASHES||'{}');if(!map||typeof map!=='object'||Array.isArray(map))throw Error('AUTH_CONFIG');
 const c={admin:process.env.ADMIN_PIN_HASH,demo:process.env.DEMO_PIN_HASH,lider:{},ronda:process.env.RONDA_PIN_HASH,cliente:escoposCliente(),gestor:{}};
 for(const [d,env] of Object.entries(GESTORES))if(process.env[env])c.gestor[d]=process.env[env];
 for(const pid of PROJECTS)c.lider[pid]=process.env['LIDER_PIN_HASH_'+pid]||map[pid];
 if(!c.admin||!c.demo)throw Error('AUTH_CONFIG');
 for(const h of [c.admin,c.demo,c.ronda,...Object.values(c.gestor),...Object.values(c.lider),...Object.values(c.cliente).map(x=>x.hash)].filter(Boolean))if(!/^[a-f0-9]{64}$/i.test(h)&&!/^scrypt:[a-f0-9]{32}:[a-f0-9]{64}$/i.test(h))throw Error('AUTH_CONFIG');
 return c;
}
function equalPin(pin,h){if(!h)return false;let a,b;if(h.startsWith('scrypt:')){const [,salt,v]=h.split(':');a=crypto.scryptSync(pin,Buffer.from(salt,'hex'),32);b=Buffer.from(v,'hex');}else{a=crypto.createHash('sha256').update(pin).digest();b=Buffer.from(h,'hex');}return a.length===b.length&&crypto.timingSafeEqual(a,b);}
function classify(pin,c,pid,ronda,div){
 const admin=equalPin(pin,c.admin),demo=equalPin(pin,c.demo),leaders=PROJECTS.filter(p=>equalPin(pin,c.lider[p])),operator=equalPin(pin,c.ronda);
 const clientes=Object.keys(c.cliente||{}).filter(k=>equalPin(pin,c.cliente[k].hash));
 const outros=Number(admin)+Number(demo)+leaders.length+Number(operator)+clientes.length;
 // PIN de gestor de divisão que coincide com outro PIN já existente não vale como gestor (e não derruba o acesso de quem já usava).
 let gestores=outros?[]:Object.keys(c.gestor||{}).filter(d=>equalPin(pin,c.gestor[d]));
 // Mesmo PIN de gestor em mais de uma divisão (PIN inicial provisório): vale a divisão da porta por onde entrou; sem porta
 // (Área do Cliente), a do projeto pedido ou a primeira que já tem projetos.
 if(gestores.length>1){const d=gestores.includes(div)?div:gestores.find(g=>pid&&DIVISAO_IDS[g].includes(pid))||(!div&&(gestores.find(g=>DIVISAO_IDS[g].length)||gestores[0]));gestores=d?[d]:[];if(!d)return null;}
 else if(gestores.length===1&&div&&DIVISAO_IDS[div]&&gestores[0]!==div)return null; // gestor de uma divisão na porta de outra
 if(outros+gestores.length>1)return null; // Ambiguous shared PINs never escalate a leader to admin.
 if(admin)return {nivel:'admin'};if(demo)return {nivel:'demo'};
 if(gestores.length===1)return pid&&!DIVISAO_IDS[gestores[0]].includes(pid)?null:{nivel:'gestor',div:gestores[0]};
 if(clientes.length===1)return {nivel:'cliente',escopo:clientes[0],pids:c.cliente[clientes[0]].pids};
 if(leaders.length===1&&(!pid||pid===leaders[0]))return {nivel:'lider',pid:leaders[0]};
 if(operator&&ronda&&PROJECTS.includes(pid))return {nivel:'ronda',pid};return null;
}
function version(c=hashes()){return crypto.createHmac('sha256',secret()).update(JSON.stringify(c)).digest('base64url');}
function issue(identity,now=Date.now(),c=hashes()){
 const p={...identity,iat:now,exp:now+TTL,aud:'moklog-access-v1',v:version(c),jti:crypto.randomUUID()};
 const body=Buffer.from(JSON.stringify(p)).toString('base64url');return {token:body+'.'+crypto.createHmac('sha256',secret()).update(body).digest('base64url'),nivel:p.nivel,...(p.div?{div:p.div}:{}),...(p.pid?{pid:p.pid}:{}),...(p.pids?{pids:p.pids,escopo:p.escopo}:{}),exp:p.exp};
}
function verify(token,now=Date.now()){
 if(typeof token!=='string'||token.length>2048||!/^[-\w]+\.[-\w]+$/.test(token))return null;
 try{const [body,sig]=token.split('.'),expected=crypto.createHmac('sha256',secret()).update(body).digest(),supplied=Buffer.from(sig,'base64url');if(supplied.length!==expected.length||!crypto.timingSafeEqual(supplied,expected))return null;
 const p=JSON.parse(Buffer.from(body,'base64url').toString());
 if(p.aud!=='moklog-access-v1'||!['admin','lider','demo','ronda','cliente','gestor'].includes(p.nivel)||!Number.isSafeInteger(p.iat)||!Number.isSafeInteger(p.exp)||p.iat>now||p.exp<=now||p.exp-p.iat!==TTL||p.v!==version())return null;
 if(['lider','ronda'].includes(p.nivel)&&!PROJECTS.includes(p.pid))return null;if(p.nivel==='gestor'&&!DIVISAO_IDS[p.div])return null;if(p.nivel==='cliente'&&!(Array.isArray(p.pids)&&p.pids.length&&p.pids.every(x=>PROJECTS.includes(x))))return null;return p;}catch{return null;}
}
const {noProjeto}=require('./escopoDivisao');
function requireAdmin(req,res){const m=/^Bearer ([-\w]+\.[-\w]+)$/.exec(req.headers?.authorization||''),a=verify(m?.[1]);if(!a){res.status(401).json({ok:false,erro:'Sessão ausente ou expirada. Entre novamente.'});return null;}if(a.nivel!=='admin'){res.status(403).json({ok:false,erro:'Acesso exclusivamente gerencial.'});return null;}return a;}
function clientIp(req){const value=process.env.VERCEL==='1'?req.headers?.['x-vercel-forwarded-for']||req.headers?.['x-forwarded-for']:req.socket?.remoteAddress;const ip=typeof value==='string'?value.split(',')[0].trim():'';if(!net.isIP(ip))throw Error('AUTH_IP');return ip;}
async function attempt(db,ip,pin,c,pid,ronda,now=Date.now(),div){
 const ref=db.collection('auth_tentativas').doc(crypto.createHmac('sha256',secret()).update(ip).digest('hex'));
 return db.runTransaction(async t=>{const old=(await t.get(ref)).data()||{};if(old.bloqueadoAte>now)return {blocked:true,retry:Math.ceil((old.bloqueadoAte-now)/1000)};
 const identity=classify(pin,c,pid,ronda,div);if(identity){t.set(ref,{falhas:0,inicioMs:now,bloqueadoAte:0,expiraEm:new Date(now+WINDOW*2)});return {identity};}
 const reset=!old.inicioMs||now-old.inicioMs>=WINDOW||(old.bloqueadoAte&&old.bloqueadoAte<=now),falhas=reset?1:(old.falhas||0)+1;
 t.set(ref,{falhas,inicioMs:reset?now:old.inicioMs,bloqueadoAte:falhas>=5?now+WINDOW:0,expiraEm:new Date(now+WINDOW*2)});return falhas>=5?{blocked:true,retry:900}:{invalid:true};});
}
function audit(db,t,a,pid,acao,ip){t.set(db.collection('fv_auditoria').doc(),{nivel:a.nivel,pid,acao,em:new Date().toISOString(),ip});}
module.exports={TTL,WINDOW,PROJECTS,GRUPOS,noProjeto,hashes,secret,classify,issue,verify,requireAdmin,clientIp,attempt,audit};

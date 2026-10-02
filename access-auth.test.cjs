const {test,beforeEach}=require('node:test'),assert=require('node:assert/strict'),crypto=require('crypto');
const auth=require('./api/ai/lib/accessAuth');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const state=new Map();let seq=0,queue=Promise.resolve();
const db={collection:c=>({doc:id=>({path:c+'/'+(id||'auto'+seq++),get:async()=>({exists:state.has(c+'/'+id),data:()=>state.get(c+'/'+id)})})}),runTransaction:fn=>{const next=queue.then(()=>fn({get:async r=>({data:()=>state.get(r.path)}),set:(r,d)=>state.set(r.path,d)}));queue=next.catch(()=>{});return next;}};
const helper=require.resolve('./api/ai/lib/firebaseAdmin');require.cache[helper]={id:helper,filename:helper,loaded:true,exports:{getDb:()=>db}};
const handler=require('./api/auth');
beforeEach(()=>{state.clear();delete process.env.VERCEL;process.env.SESSION_SECRET=crypto.randomBytes(32).toString('hex');process.env.ADMIN_PIN_HASH=hash('test-admin');process.env.DEMO_PIN_HASH=hash('test-demo');process.env.LIDER_PIN_HASHES=JSON.stringify({P601:hash('test-lider'),P602:hash('test-other')});process.env.RONDA_PIN_HASH=hash('test-ronda');});
const res=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(b){this.body=b;return this;}});
async function login(pin,extra={},ip='127.0.0.1'){const r=res();await handler({method:'POST',socket:{remoteAddress:ip},headers:{},body:{pin,...extra}},r);return r;}
test('login admin, líder com escopo, demo e operador de Ronda; PIN não entra no token',async()=>{
 for(const [pin,nivel,extra] of [['test-admin','admin',{}],['test-lider','lider',{pid:'P601'}],['test-demo','demo',{}],['test-ronda','ronda',{pid:'P601',ronda:true}]]){const r=await login(pin,extra);assert.equal(r.code,200);assert.equal(r.body.nivel,nivel);assert.equal(auth.verify(r.body.token).nivel,nivel);assert.ok(!Buffer.from(r.body.token.split('.')[0],'base64url').toString().includes(pin));}
 assert.equal((await login('test-lider',{pid:'P602'})).code,401);assert.equal((await login('test-ronda')).code,401);
});
test('token válido, expirado exatamente em 8h, adulterado, inválido e revogado por mudança de PIN',()=>{
 const now=Date.now(),t=auth.issue({nivel:'admin'},now).token;assert.equal(auth.verify(t,now).nivel,'admin');assert.equal(auth.verify(t,now+auth.TTL),null);assert.equal(auth.verify(t+'x',now),null);assert.equal(auth.verify(t+'.extra',now),null);assert.equal(auth.verify(t,now-1),null);
 const [body,sig]=t.split('.');const forged=JSON.parse(Buffer.from(body,'base64url'));forged.exp+=auth.TTL;assert.equal(auth.verify(Buffer.from(JSON.stringify(forged)).toString('base64url')+'.'+sig,now),null);
 process.env.ADMIN_PIN_HASH=hash('test-new');assert.equal(auth.verify(t,now),null);
});
test('cinco falhas bloqueiam por 15min inclusive o PIN válido, IP separado e desbloqueio',async()=>{
 const c=auth.hashes(),now=Date.now();for(let i=0;i<4;i++)assert.equal((await auth.attempt(db,'127.0.0.1','bad',c,null,false,now+i)).invalid,true);
 assert.equal((await auth.attempt(db,'127.0.0.1','bad',c,null,false,now+4)).blocked,true);
 assert.equal((await auth.attempt(db,'127.0.0.1','test-admin',c,null,false,now+5)).blocked,true);
 assert.equal((await auth.attempt(db,'127.0.0.2','test-admin',c,null,false,now+5)).identity.nivel,'admin');
 assert.equal((await auth.attempt(db,'127.0.0.1','test-admin',c,null,false,now+4+auth.WINDOW)).identity.nivel,'admin');
});
test('falhas simultâneas usam contador persistido, não memória do processo',async()=>{
 const c=auth.hashes();const results=await Promise.all(Array.from({length:8},()=>auth.attempt(db,'127.0.0.1','bad',c)));assert.equal(results.filter(x=>x.invalid).length,4);assert.equal(results.filter(x=>x.blocked).length,4);assert.equal([...state.values()][0].falhas,5);
});
test('API retorna 429, Retry-After e 503 se configuração falta; nunca libera acesso',async()=>{
 for(let i=0;i<4;i++)assert.equal((await login('bad')).code,401);const r=await login('bad');assert.equal(r.code,429);assert.equal(r.headers['Retry-After'],'900');delete process.env.SESSION_SECRET;assert.equal((await login('test-admin')).code,503);
});
test('todas as rotas FV recusam PIN direto e tokens líder/demo; admin tem guard válido',async()=>{
 for(const file of ['fv-read','fv-apply','fv-plano','fv-sync']){const h=require('./api/'+file);const r=res();await h({method:'POST',headers:{},body:{pin:'test-admin'}},r);assert.equal(r.code,401,file);}
 for(const nivel of ['lider','demo','ronda']){const r=res();const t=auth.issue({nivel,pid:'P601'}).token;assert.equal(auth.requireAdmin({headers:{authorization:'Bearer '+t}},r),null);assert.equal(r.code,403);}
 const r=res();assert.equal(auth.requireAdmin({headers:{authorization:'Bearer '+auth.issue({nivel:'admin'}).token}},r).nivel,'admin');
});
test('auditoria gravada junto à transação, sem PIN ou token',async()=>{
 await db.runTransaction(async t=>auth.audit(db,t,{nivel:'admin'},'P601','salvar','127.0.0.1'));const a=[...state.values()][0];assert.deepEqual(Object.keys(a).sort(),['acao','em','ip','nivel','pid']);assert.equal(a.pid,'P601');
});
test('IP local ignora cabeçalho falsificado; em Vercel prioriza cabeçalho da plataforma',()=>{
 assert.equal(auth.clientIp({socket:{remoteAddress:'127.0.0.1'},headers:{'x-forwarded-for':'1.2.3.4'}}),'127.0.0.1');process.env.VERCEL='1';assert.equal(auth.clientIp({headers:{'x-vercel-forwarded-for':'1.2.3.4','x-forwarded-for':'5.6.7.8'}}),'1.2.3.4');
});
test('hash scrypt funciona e PIN compartilhado entre perfis é recusado',async()=>{
 const salt=crypto.randomBytes(16),digest=crypto.scryptSync('test-admin',salt,32);process.env.ADMIN_PIN_HASH='scrypt:'+salt.toString('hex')+':'+digest.toString('hex');assert.equal((await login('test-admin')).code,200);
 process.env.LIDER_PIN_HASHES=JSON.stringify({P601:hash('test-admin')});assert.equal((await login('test-admin')).code,401);
});

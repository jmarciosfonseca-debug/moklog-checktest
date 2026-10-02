const {test}=require('node:test');const assert=require('node:assert/strict');const crypto=require('crypto');
const state=new Map(),writes=[];
const snap=path=>({exists:state.has(path),data:()=>state.get(path)});
const db={collection:c=>({doc:id=>({path:c+'/'+id,get:async()=>snap(c+'/'+id),collection:()=>({where:()=>({get:async()=>({size:0})})})})}),runTransaction:async fn=>fn({get:async r=>snap(r.path),set:(r,d)=>{writes.push(r.path);state.set(r.path,d);}})};
const helper=require.resolve('./api/ai/lib/firebaseAdmin');require.cache[helper]={id:helper,filename:helper,loaded:true,exports:{getDb:()=>db}};
const handler=require('./api/fv-plano');process.env.SESSION_SECRET=crypto.randomBytes(32).toString('hex');process.env.ADMIN_PIN_HASH=crypto.createHash('sha256').update('test-pin').digest('hex');process.env.DEMO_PIN_HASH=crypto.createHash('sha256').update('test-demo').digest('hex');const access=require('./api/ai/lib/accessAuth');const token=access.issue({nivel:'admin'}).token;
async function call(pid,extra){const res={setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};await handler({method:'POST',socket:{remoteAddress:'127.0.0.1'},headers:{authorization:extra.pin==='bad'?'Bearer invalid':'Bearer '+token},body:{pid,pin:'test-pin',...extra}},res);return res;}
const source=(id,item='Camisa / Camisão')=>({id,item,qtd:2,tamanho:'G',aprovacao:'aprovado',aprovadoEm:'2026-10-01T15:00:00Z'});
const seed=(pid,id,item)=>{const solic=source(id,item);const c={id:'c1',nome:'Ana',uniforme:{solicitacoes:[solic]}};state.set('equipes/'+pid,{colaboradores:[c]});return solic;};
const sync=(pid,id,decisao='aprovado')=>call(pid,{acao:'aprovacaoUniforme',solic:{id,colabId:'c1',valor:999999,item:'forjado'},decisao});
test('aprovação usa solicitação do servidor, preço e projeto certo; idempotência',async()=>{
 seed('P260A','s1');state.set('fv_plano/_catalogo',{itens:[{id:'camisa',nome:'Camisa',equipeItem:'Camisa / Camisão',valor:150}]});
 let r=await sync('P260A','s1');assert.equal(r.code,200);let l=r.body.plano.lancamentos[0];assert.equal(l.valor,300);assert.equal(l.id,'ap_s1');assert.equal(l.categoria,'uniforme');assert.equal(l.item,'Camisa / Camisão');assert.equal(l.mes,'2026-10');
 r=await sync('P260A','s1');assert.equal(r.body.plano.lancamentos.length,1);assert.ok(!state.has('fv_plano/P605'));
});
test('sem preço não bloqueia criação do previsto nem muda a aprovação',async()=>{
 seed('P605','s2','Sapato / Coturno');const r=await sync('P605','s2');assert.equal(r.code,200);assert.equal(r.body.plano.lancamentos[0].valor,0);assert.equal(r.body.plano.lancamentos[0].semPreco,true);assert.equal(state.get('equipes/P605').colaboradores[0].uniforme.solicitacoes[0].aprovacao,'aprovado');
});
test('negar remove previsto e nunca altera saldo oficial',async()=>{
 state.get('equipes/P260A').colaboradores[0].uniforme.solicitacoes[0].aprovacao='negado';const r=await sync('P260A','s1','negado');assert.equal(r.body.plano.lancamentos.length,0);assert.ok(writes.every(p=>p.startsWith('fv_plano/')||p.startsWith('fv_auditoria/')));
});
test('realizado congela preço; cancelamento preserva auditoria; edição manual recusada',async()=>{
 state.get('equipes/P260A').colaboradores[0].uniforme.solicitacoes[0].aprovacao='aprovado';await sync('P260A','s1');
 let r=await call('P260A',{acao:'realizarAprovacao',id:'ap_s1',realizado:true});assert.equal(r.code,200);assert.equal(r.body.plano.lancamentos[0].valorUnit,150);
 await call('P260A',{acao:'catalogo_salvar',item:{id:'camisa',nome:'Camisa',equipeItem:'Camisa / Camisão',valor:200}});
 r=await sync('P260A','s1');assert.equal(r.body.plano.lancamentos[0].valorUnit,150);assert.equal(r.body.plano.lancamentos[0].valor,300);
 state.get('equipes/P260A').colaboradores[0].uniforme.solicitacoes[0].aprovacao='aguardando';r=await sync('P260A','s1','aguardando');assert.equal(r.body.plano.lancamentos[0].origemCancelada,true);
 assert.equal((await call('P260A',{acao:'excluir',id:'ap_s1'})).code,409);
 assert.equal((await call('P260A',{acao:'realizarAprovacao',id:'ap_s1',realizado:false})).code,409);
});
test('mapeamento posterior resolve preço; dois projetos independentes',async()=>{
 await call('P605',{acao:'catalogo_salvar',item:{id:'sapato',nome:'Sapato',equipeItem:'Sapato / Coturno',valor:250}});
 const r=await sync('P605','s2');assert.equal(r.body.plano.lancamentos[0].valor,500);assert.equal(r.body.plano.lancamentos[0].semPreco,false);assert.equal(state.get('fv_plano/P260A').lancamentos[0].valor,300);
});
test('fonte ausente ou decisão divergente, PIN inválido e P311 recusados',async()=>{
 assert.equal((await sync('P260A','missing')).code,409);assert.equal((await sync('P260A','s1','aprovado')).code,409);
 assert.equal((await call('P311A',{acao:'ler'})).code,400);assert.equal((await call('P260A',{acao:'ler',pin:'bad'})).code,401);
});
test('catálogo recusa dois preços para mesmo item e exclusão vinculada',async()=>{
 assert.equal((await call('P605',{acao:'catalogo_salvar',item:{id:'outro',nome:'Outro',equipeItem:'Sapato / Coturno',valor:50}})).code,409);
 assert.equal((await call('P605',{acao:'catalogo_excluir',id:'sapato'})).code,409);
});

const {test}=require('node:test');const assert=require('node:assert/strict');const crypto=require('crypto');
const helper=require.resolve('./api/ai/lib/firebaseAdmin.js');
const state=new Map();let paths=[];
const db={collection:c=>({doc:id=>({path:c+'/'+id,get:async()=>({exists:state.has(c+'/'+id),data:()=>state.get(c+'/'+id)}),collection:()=>({where:()=>({get:async()=>({size:3})})})})}),runTransaction:async fn=>fn({get:r=>r.get(),set:(r,d)=>{paths.push(r.path);state.set(r.path,d);}})};
require.cache[require.resolve(helper)]={id:helper,filename:helper,loaded:true,exports:{getDb:()=>db}};
// Load the reviewed staging copy with backend dependencies resolved through its deployed imports.
const handler=require('./api/fv-plano.js');
process.env.SESSION_SECRET=crypto.randomBytes(32).toString('hex');process.env.ADMIN_PIN_HASH=crypto.createHash('sha256').update('test-pin').digest('hex');process.env.DEMO_PIN_HASH=crypto.createHash('sha256').update('test-demo').digest('hex');const access=require('./api/ai/lib/accessAuth');const token=access.issue({nivel:'admin'}).token;
async function call(extra){const res={setHeader(){},status(n){this.code=n;return this;},json(v){this.body=v;return this;}};await handler({method:'POST',socket:{remoteAddress:'127.0.0.1'},headers:{authorization:extra.pin==='bad'?'Bearer invalid':'Bearer '+token},body:{pid:'P260A',pin:'test-pin',...extra}},res);return res;}
const launch=(id,valor,tipo='reserva')=>({id,tipo,descricao:id,mes:'2026-11',realizado:false,valor});
test('salva 8000 e 1800 sem alterar fv; releitura mantém os dois; edição não duplica',async()=>{
 assert.equal((await call({acao:'salvar',lancamento:launch('treinamento',8000)})).code,200);
 assert.equal((await call({acao:'salvar',lancamento:launch('cesta',1800,'debito')})).code,200);
 const read=await call({acao:'ler'});assert.equal(read.body.plano.lancamentos.length,2);assert.equal(read.body.qtdCestas,3);
 assert.equal((await call({acao:'salvar',lancamento:launch('treinamento',8000)})).body.plano.lancamentos.length,2);
 assert.deepEqual([...new Set(paths.filter(p=>!p.startsWith('fv_auditoria/')))],['fv_plano/P260A']);assert.ok(paths.some(p=>p.startsWith('fv_auditoria/')));
});
test('alterar parâmetro preserva lançamentos; limpar retorna ao automático',async()=>{
 let r=await call({acao:'parametro',campo:'vtMensal',valor:500});assert.equal(r.body.plano.vtMensal,500);assert.equal(r.body.plano.lancamentos.length,2);
 r=await call({acao:'parametro',campo:'vtMensal',valor:null});assert.equal(r.body.plano.vtMensal,null);
});
test('excluir remove só o lançamento selecionado',async()=>{const r=await call({acao:'excluir',id:'cesta'});assert.equal(r.body.plano.lancamentos.length,1);assert.equal(r.body.plano.lancamentos[0].id,'treinamento');});
test('PIN inválido e P311 não gravam',async()=>{const before=paths.length;assert.equal((await call({acao:'ler',pin:'bad'})).code,401);assert.equal((await call({acao:'ler',pid:'P311'})).code,400);assert.equal(paths.length,before);});
test('valores negativos, campos indevidos, meses inválidos recusados',async()=>{
 assert.equal((await call({acao:'salvar',lancamento:launch('invalid',-1)})).code,400);
 assert.equal((await call({acao:'parametro',campo:'saldoAtual',valor:99})).code,400);
 assert.equal((await call({acao:'salvar',lancamento:{...launch('bad-month',100),mes:'2026-13'}})).code,400);
});
test('recorrente é persistido, editado sem duplicar e excluído',async()=>{
 const item={id:'cafe',descricao:'Café',valor:250,ativo:true};
 assert.equal((await call({acao:'recorrente_salvar',item})).body.plano.recorrentes[0].valor,250);
 assert.equal((await call({acao:'recorrente_salvar',item:{...item,valor:300}})).body.plano.recorrentes.length,1);
 assert.equal((await call({acao:'recorrente_excluir',id:'cafe'})).body.plano.recorrentes.length,0);
});
test('catálogo compartilhado e vínculo com quantidade, sem exclusão de item em uso',async()=>{
 const item={id:'kit',nome:'Kit uniforme',valor:650};
 let r=await call({acao:'catalogo_salvar',item});assert.equal(r.code,200);assert.equal(r.body.catalogo[0].valor,650);
 const lancamento={...launch('kits',0,'debito'),vinculo:'catalogo',itemId:'kit',qtd:12};
 r=await call({acao:'salvar',lancamento});assert.equal(r.code,200);assert.equal(r.body.plano.lancamentos.find(l=>l.id==='kits').qtd,12);
 assert.equal((await call({acao:'ler',pid:'P605'})).body.catalogo[0].id,'kit');
 assert.equal((await call({acao:'catalogo_excluir',id:'kit'})).code,409);
 await call({acao:'excluir',id:'kits'});assert.equal((await call({acao:'catalogo_excluir',id:'kit'})).code,200);
});
test('vínculo inexistente e quantidade fracionária recusados',async()=>{
 const lancamento={...launch('invalid-kit',0),vinculo:'catalogo',itemId:'missing',qtd:12};
 assert.equal((await call({acao:'salvar',lancamento})).code,409);
 assert.equal((await call({acao:'salvar',lancamento:{...lancamento,qtd:1.5}})).code,400);
 assert.equal((await call({acao:'catalogo_salvar',item:{id:'bad',nome:'bad',valor:-10}})).code,400);
});

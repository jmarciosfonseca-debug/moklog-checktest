// PIN de cliente: gestor do parque (um projeto) e proprietário (grupo). Só leitura, só pelo Painel do Cliente.
const crypto=require('crypto');
const sha=p=>crypto.createHash('sha256').update(p).digest('hex');
const auth=require('../api/ai/lib/accessAuth');
const env={SESSION_SECRET:'s'.repeat(40),ADMIN_PIN_HASH:sha('adm'),DEMO_PIN_HASH:sha('demo'),LIDER_PIN_HASHES:JSON.stringify({P601:sha('l601')}),CLIENTE_PIN_HASHES:JSON.stringify({P601:sha('c601'),GOLGI:sha('golgi'),XPTO:sha('x')})};
beforeEach(()=>{Object.assign(process.env,env);});
test('gestor do parque vê um projeto; proprietário vê o grupo; escopo desconhecido é ignorado',()=>{
  const c=auth.hashes();
  expect(auth.classify('c601',c)).toEqual({nivel:'cliente',escopo:'P601',pids:['P601']});
  expect(auth.classify('golgi',c)).toEqual({nivel:'cliente',escopo:'GOLGI',pids:['P601','P602','P604','P605','P606','P607']});
  expect(auth.classify('x',c)).toBeNull();
  expect(auth.classify('l601',c)).toEqual({nivel:'lider',pid:'P601'});
});
test('token de cliente carrega o escopo e é verificado',()=>{
  const t=auth.issue(auth.classify('golgi',auth.hashes()));
  expect(t.nivel).toBe('cliente');expect(t.pids).toHaveLength(6);
  const p=auth.verify(t.token);expect(p.nivel).toBe('cliente');expect(p.escopo).toBe('GOLGI');
});
test('PIN de cliente igual ao de líder é ambíguo e não entra',()=>{
  process.env.CLIENTE_PIN_HASHES=JSON.stringify({P601:sha('l601')});
  expect(auth.classify('l601',auth.hashes())).toBeNull();
});

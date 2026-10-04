jest.mock('../api/ai/lib/accessAuth',()=>({verify:jest.fn(),PROJECTS:['P505','P601']}));
jest.mock('../api/ai/lib/firebaseAdmin',()=>({getDb:jest.fn()}));
const {save,validate}=require('../api/ai/lib/equipamentosSave');
const auth=require('../api/ai/lib/accessAuth'),{getDb}=require('../api/ai/lib/firebaseAdmin'),handler=require('../api/equipamentos-save');
const item={id:'arma1',identificacao:'Arma 01',qtd:1,status:'ok',nSerie:'TESTE',historico:[{id:'h',texto:'preservar'}]};
const lider={nivel:'lider',pid:'P505'};
const banco=current=>{const set=jest.fn(),ref={};return {set,collection:jest.fn(()=>({doc:jest.fn(()=>ref)})),runTransaction:fn=>fn({get:async()=>({exists:!!current,data:()=>current}),set,update:set})};};
const res=()=>({setHeader:jest.fn(),status:jest.fn().mockReturnThis(),json:jest.fn()});
beforeEach(()=>jest.clearAllMocks());
test.each([null,{nivel:'demo'},{nivel:'ronda'}, {nivel:'lider',pid:'P601'}])('API bloqueia identidade sem acesso ao P505: %j',async a=>{
 auth.verify.mockReturnValue(a);const r=res();await handler({method:'POST',headers:{},body:{pid:'P505',section:'armamento',before:[],after:[item]}},r);expect(r.status).toHaveBeenCalledWith(a?403:401);expect(getDb).not.toHaveBeenCalled();
});
test('líder inclui armamento com quantidade e preserva outras seções',async()=>{
 const db=banco({radiosHT:[{id:'r'}],outro:'mantido'});getDb.mockReturnValue(db);auth.verify.mockReturnValue(lider);const r=res();
 await handler({method:'POST',headers:{},body:{pid:'P505',section:'armamento',before:[],after:[{...item,qtd:2}]}},r);
 expect(r.status).toHaveBeenCalledWith(200);expect(db.set.mock.calls[0][1]).toMatchObject({armamento:[{...item,qtd:2}]});expect(db.set.mock.calls[0][1]).not.toHaveProperty('radiosHT');
});
test('edição mantém id, histórico e campos existentes',async()=>{
 const db=banco({armamento:[item]});const data=await save(db,'P505','armamento',[item],[{...item,identificacao:'Arma revisada'}],lider);
 expect(data.armamento[0]).toMatchObject({id:'arma1',historico:item.historico,nSerie:'TESTE'});
});
test('mesma seção desatualizada recusa gravação; outra seção alterada não conflita',async()=>{
 const db=banco({armamento:[{...item,qtd:3}],radiosHT:[]});await expect(save(db,'P505','armamento',[item],[{...item,qtd:2}],lider)).rejects.toMatchObject({status:409});expect(db.set).not.toHaveBeenCalled();
 await expect(save(db,'P505','radiosHT',[],[{...item,id:'r'}],lider)).resolves.toMatchObject({armamento:[{...item,qtd:3}]});
});
test('líder não exclui; gerencial pode excluir',()=>{
 expect(()=>validate('armamento',[item],[],lider)).toThrow(/gerencial/);expect(()=>validate('armamento',[item],[],{nivel:'admin'})).not.toThrow();
});
test.each([0,-1,1.5,100001,'2'])('quantidade inválida recusada: %s',qtd=>expect(()=>validate('armamento',[],[{...item,qtd}],lider)).toThrow(/Quantidade/));
test('munição pode ter zero; ids duplicados e seção estranha recusados',()=>{
 expect(()=>validate('municao',[],[{...item,qtd:0}],lider)).not.toThrow();expect(()=>validate('armamento',[],[item,item],lider)).toThrow(/duplicado/);expect(()=>validate('fv',{}, {},lider)).toThrow(/Seção/);
});
test('documento novo e primeira checagem usam gravação parcial',async()=>{
 const db=banco(null);await save(db,'P505','armamento',[],[item],lider);expect(db.set).toHaveBeenCalledTimes(1);
 await save(db,'P505','checagemSemanal',null,{alvo:'2026-10-11',ultimoResultado:{por:'Teste'}},lider);expect(db.set.mock.calls[1][1]).not.toHaveProperty('armamento');
});
test('reenvio idêntico após perda da resposta é idempotente',async()=>{
 const db=banco({armamento:[item]});await expect(save(db,'P505','armamento',[],[item],lider)).resolves.toEqual({armamento:[item]});expect(db.set).not.toHaveBeenCalled();
});

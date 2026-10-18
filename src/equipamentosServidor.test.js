jest.mock('../api/ai/lib/accessAuth',()=>({verify:jest.fn(),PROJECTS:['P505','P601']}));
jest.mock('../api/ai/lib/firebaseAdmin',()=>({getDb:jest.fn()}));
const {save,validate}=require('../api/ai/lib/equipamentosSave');
const auth=require('../api/ai/lib/accessAuth'),{getDb}=require('../api/ai/lib/firebaseAdmin'),handler=require('../api/equipamentos-save');
const item={id:'arma1',identificacao:'Arma 01',qtd:1,status:'ok',nSerie:'TESTE',historico:[{id:'h',texto:'preservar'}]};
const lider={nivel:'lider',pid:'P505'};
const banco=current=>{const set=jest.fn(),ref={};return {set,collection:jest.fn(()=>({doc:jest.fn(()=>ref)})),runTransaction:fn=>fn({get:async()=>({exists:!!current,data:()=>current}),set,update:set})};};
const res=()=>({setHeader:jest.fn(),status:jest.fn().mockReturnThis(),json:jest.fn()});
beforeEach(()=>jest.clearAllMocks());
test('item livre é aditivo, valida nome/quantidade e protege contra conflito',async()=>{
 const novo={id:'guarda1',identificacao:'Guarda-chuva',qtd:3,status:'ok'};
 const db=banco({armamento:[item]});
 const result=await save(db,'P505','outros',null,[novo],lider);
 expect(result.armamento).toEqual([item]);expect(result.outros).toEqual([novo]);
 expect(db.set.mock.calls[0][1]).not.toHaveProperty('armamento');
 for(const bad of [{...novo,identificacao:' '},{...novo,qtd:0},{...novo,qtd:1.5}])expect(()=>validate('outros',[],[bad],lider)).toThrow();
 const changed=banco({outros:[{...novo,qtd:4}]});
 await expect(save(changed,'P505','outros',[novo],[{...novo,qtd:5}],lider)).rejects.toMatchObject({status:409});
 expect(changed.set).not.toHaveBeenCalled();
});
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
// Baixa pelo líder (campo 18/10, P604): o item sai da lista ativa e vai inteiro para `baixados`, numa gravação só.
test('baixa: líder tira o item da lista com motivo; histórico guarda o item inteiro; reenvio é idempotente',async()=>{
 const xrt={id:'l1',identificacao:'XRT-6000A',qtd:1,status:'ok',historico:[{id:'h'}]},outra={id:'l2',identificacao:'Lanterna 02',qtd:1,status:'ok'};
 const db=banco({lanternas:[xrt,outra],armamento:[item]});
 const r=await save(db,'P505','baixa',null,{categoria:'lanternas',id:'l1',motivo:'Substituído',obs:'Trocada por tática',por:'Luiz'},lider);
 expect(r.lanternas).toEqual([outra]);expect(r.armamento).toEqual([item]);
 expect(r.baixados).toEqual([expect.objectContaining({...xrt,categoria:'lanternas',baixa:expect.objectContaining({motivo:'Substituído',obs:'Trocada por tática',por:'Luiz',nivel:'lider'})})]);
 const patch=db.set.mock.calls[0][1];expect(Object.keys(patch).sort()).toEqual(['baixados','lanternas','updatedAt']);
 const depois=banco(r);await expect(save(depois,'P505','baixa',null,{categoria:'lanternas',id:'l1',motivo:'Substituído'},lider)).resolves.toBe(r);expect(depois.set).not.toHaveBeenCalled();
});
test('baixa: motivo obrigatório, "Outro" exige descrição, item inexistente e categoria estranha recusados',async()=>{
 const db=banco({lanternas:[{id:'l1',identificacao:'X',qtd:1}]});
 await expect(save(db,'P505','baixa',null,{categoria:'lanternas',id:'l1',motivo:''},lider)).rejects.toMatchObject({status:400});
 await expect(save(db,'P505','baixa',null,{categoria:'lanternas',id:'l1',motivo:'Outro',obs:' '},lider)).rejects.toMatchObject({status:400});
 await expect(save(db,'P505','baixa',null,{categoria:'lanternas',id:'zz',motivo:'Extraviado'},lider)).rejects.toMatchObject({status:404});
 await expect(save(db,'P505','baixa',null,{categoria:'moto',id:'l1',motivo:'Extraviado'},lider)).rejects.toMatchObject({status:400});
 expect(db.set).not.toHaveBeenCalled();
});
test('API: líder de outro projeto não dá baixa',async()=>{
 auth.verify.mockReturnValue({nivel:'lider',pid:'P601'});const r=res();
 await handler({method:'POST',headers:{},body:{pid:'P505',section:'baixa',before:null,after:{categoria:'lanternas',id:'l1',motivo:'Extraviado'}}},r);
 expect(r.status).toHaveBeenCalledWith(403);expect(getDb).not.toHaveBeenCalled();
});
test('baixa de item antigo sem id: confere posição e identificação; divergência recusa',async()=>{
 const velho={identificacao:'XRT-6000A',qtd:1,status:'ok'},outro={id:'l2',identificacao:'Lanterna 02',qtd:1};
 const db=banco({lanternas:[velho,outro]});
 const r=await save(db,'P505','baixa',null,{categoria:'lanternas',id:null,indice:0,identificacao:'XRT-6000A',motivo:'Substituído'},lider);
 expect(r.lanternas).toEqual([outro]);expect(r.baixados[0]).toMatchObject({identificacao:'XRT-6000A',categoria:'lanternas'});
 await expect(save(banco({lanternas:[velho]}),'P505','baixa',null,{categoria:'lanternas',id:null,indice:0,identificacao:'Outra',motivo:'Extraviado'},lider)).rejects.toMatchObject({status:404});
 await expect(save(banco({lanternas:[outro]}),'P505','baixa',null,{categoria:'lanternas',id:null,indice:0,identificacao:'Lanterna 02',motivo:'Extraviado'},lider)).rejects.toMatchObject({status:404});
});

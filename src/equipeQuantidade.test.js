import {criarSolicitacoes,mensagemSolicitacoes,quantidadeSolicitada} from './equipeSolicitacoes';
const {validateQuantities,validateLeader,save}=require('../api/ai/lib/equipeMerge');
const {synchronize}=require('../api/ai/lib/fvAprovacao');
const doc=s=>({colaboradores:[{id:'c',nome:'Teste',uniforme:{solicitacoes:[s]}}]});
const pedido={id:'p',item:'Camisa',status:'pendente',aprovacao:'aprovado',aprovadoEm:'2026-10-03T15:00:00Z',solicitadoEm:'2026-10-03T14:00:00Z',qtd:2};
test('quantidade estruturada persiste, vai à mensagem e multiplica preço no FV',()=>{
 const [s]=criarSolicitacoes([{item:'Camisa',qtd:'2',motivo:'troca'}],'lider','P604',pedido.solicitadoEm,()=> 'p');
 expect(s.qtd).toBe(2);
 expect(mensagemSolicitacoes('P604','Teste',[{...s,aprovacao:'aprovado',aprovadoEm:pedido.aprovadoEm}])).toContain('Quantidade: 2');
 const plano=synchronize({lancamentos:[]},pedido,{id:'c'},[{id:'cat',equipeItem:'Camisa',valor:150}]);
 expect(plano.lancamentos[0]).toMatchObject({qtd:2,valor:300,realizado:false});
 expect(synchronize(plano,pedido,{id:'c'},[{id:'cat',equipeItem:'Camisa',valor:150}]).lancamentos).toHaveLength(1);
});
test('legado fica em 1 e motivo nunca é interpretado como quantidade',()=>{
 const [s]=criarSolicitacoes([{item:'Camisa',motivo:'2 unidades'}],'lider','P604',pedido.solicitadoEm,()=> 'p');
 expect(s.qtd).toBe(1);expect(quantidadeSolicitada({quantidade:3})).toBe(3);
});
test.each([0,-1,1.5,'', 'abc',100001,Infinity])('rejeita quantidade inválida %s no cliente e servidor',qtd=>{
 expect(()=>criarSolicitacoes([{item:'Camisa',qtd}],'lider','P604',pedido.solicitadoEm,()=> 'p')).toThrow(/Quantidade/);
 expect(()=>validateQuantities({colaboradores:[]},doc({...pedido,qtd}))).toThrow(/Quantidade/);
});
test('API recusa antes da escrita e mantém compatibilidade dos registros antigos',async()=>{
 const current=doc({...pedido,qtd:1}),set=jest.fn();
 const db={collection:()=>({doc:()=>({})}),runTransaction:fn=>fn({get:async()=>({exists:true,data:()=>current}),set})};
 await expect(save(db,'P604',current,doc({...pedido,qtd:0}),{nivel:'admin'})).rejects.toMatchObject({status:400});expect(set).not.toHaveBeenCalled();
 expect(()=>validateQuantities(doc({...pedido,qtd:undefined}),doc({...pedido,qtd:undefined}))).not.toThrow();
 expect(()=>validateQuantities(doc(pedido),doc({...pedido,quantidade:3}))).toThrow(/Quantidade/);
});
test('líder não troca quantidade já aprovada, mas pode criar pedido aguardando com quantidade',()=>{
 expect(()=>validateLeader(doc({...pedido,qtd:1}),doc(pedido))).toThrow(/gerencial/);
 const [novo]=criarSolicitacoes([{item:'Camisa',qtd:2}],'lider','P604',pedido.solicitadoEm,()=> 'novo');
 expect(()=>validateLeader({colaboradores:[]},doc(novo))).not.toThrow();
});
test('FV sem preço preserva quantidade e não marca realizado',()=>{
 expect(synchronize({lancamentos:[]},pedido,{id:'c'},[]).lancamentos[0]).toMatchObject({qtd:2,valor:0,semPreco:true,realizado:false});
});

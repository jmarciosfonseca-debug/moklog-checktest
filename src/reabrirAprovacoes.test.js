const {resumir}=require('../scripts/migracao/reabrir-aprovacoes');
test('dry-run separa janela de São Paulo, estado e FV sem modificar dados',()=>{
 const s=(id,aprovadoEm,extra={})=>({id,aprovadoEm,aprovacao:'aprovado',status:'pendente',...extra});
 const e={colaboradores:[{id:'c',nome:'Teste',uniforme:{solicitacoes:[
  s('1','2026-10-02T03:00:00Z',{whatsEnviadoEm:'2026-10-02T04:00:00Z'}),
  s('2','2026-10-04T02:59:59Z'),s('3','2026-10-04T03:00:00Z'),s('4',null),
  s('5','2026-10-03T12:00:00Z',{status:'entregue'}),s('6',null,{aprovacao:'negado'})
 ]}}]};
 const p={lancamentos:[{id:'ap_1',colabId:'c',vinculo:'aprovacao',realizado:false},{id:'ap_2',colabId:'c',vinculo:'aprovacao',realizado:true},{id:'ap_3',colabId:'outro',vinculo:'aprovacao'}]};
 const original=JSON.stringify({e,p}),r=resumir('P601',e,p);
 expect(r).toMatchObject({pendentesAprovadas:4,comToque:1,janelaTestes:2,foraJanela:1,dataInvalida:1,previstos:1,realizados:1,negados:1,entregues:1});
 expect(JSON.stringify({e,p})).toBe(original);
});

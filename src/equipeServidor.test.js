const {merge,save,validateLeader}=require('../api/ai/lib/equipeMerge');
const clone=x=>JSON.parse(JSON.stringify(x));
const initial=()=>({colaboradores:[{id:'a',nome:'A',foto:'preservada',historico:[],uniforme:{solicitacoes:[]}},{id:'b',nome:'B',uniforme:{solicitacoes:[]}}],desligados:[]});
const request=id=>({id,item:'Camisa',status:'pendente',aprovacao:'aguardando',exigeWhats:true});
function banco(initial){let data=clone(initial),version=0;return {collection:()=>({doc:()=>({})}),get data(){return data;},runTransaction:async fn=>{for(;;){let pending;const v=version,snapshot=clone(data);const result=await fn({get:async()=>({exists:true,data:()=>snapshot}),set:(_,d)=>{pending=d;}});if(v!==version)continue;data=pending;version++;return result;}}};}
test('S1 servidor: líderes simultâneos preservam ambos os lotes',async()=>{
 const before=initial(),a=clone(before),b=clone(before),db=banco(before);
 a.colaboradores[0].uniforme.solicitacoes=[request('1'),request('2')];b.colaboradores[1].uniforme.solicitacoes=[request('3')];
 await Promise.all([save(db,'P260A',before,a,{nivel:'lider'}),save(db,'P260A',before,b,{nivel:'lider'})]);
 expect(db.data.colaboradores.map(c=>c.uniforme.solicitacoes.length)).toEqual([2,1]);expect(db.data.colaboradores[0].foto).toBe('preservada');
});
test('S2 servidor: FT, recebimento e aprovação de tela velha preservam pedidos novos',()=>{
 const old=initial();old.colaboradores[0].uniforme.solicitacoes=[request('antigo')];
 const current=clone(old);current.colaboradores[0].uniforme.solicitacoes.push(request('1'),request('2'),request('3'));let state=current;
 for(const tipo of ['FT','recebimento','aprovação']){const after=clone(old);
 if(tipo==='FT')after.colaboradores[0].historico.push({id:'ft',tipo:'FT'});
 else if(tipo==='recebimento')after.colaboradores[0].uniforme.solicitacoes[0].status='entregue';
 else after.colaboradores[0].uniforme.solicitacoes[0].aprovacao='aprovado';
 state=merge(old,after,state);expect(state.colaboradores[0].uniforme.solicitacoes).toHaveLength(4);}
 expect(state.colaboradores[0].historico).toHaveLength(1);expect(state.colaboradores[0].uniforme.solicitacoes[0]).toMatchObject({status:'entregue',aprovacao:'aprovado'});
});
test('conflito aborta sem recriar removidos; retry não duplica',()=>{
 const b=initial(),a=clone(b),c=clone(b);a.colaboradores[0].nome='A1';c.colaboradores[0].nome='A2';expect(()=>merge(b,a,c)).toThrow(/Outro usuário/);
 c.colaboradores.shift();expect(()=>merge(b,a,c)).toThrow();
 const n=clone(b);n.colaboradores[0].uniforme.solicitacoes.push(request('1'));expect(merge(b,n,n)).toEqual(n);
});
test('líder não aprova nem dispensa, mas pode confirmar recebimento',()=>{
 const b=initial();b.colaboradores[0].uniforme.solicitacoes=[request('1')];const a=clone(b);
 a.colaboradores[0].uniforme.solicitacoes[0].aprovacao='aprovado';expect(()=>validateLeader(b,a)).toThrow();
 a.colaboradores[0].uniforme.solicitacoes[0]={...request('1'),status:'entregue'};expect(()=>validateLeader(b,a)).not.toThrow();
});

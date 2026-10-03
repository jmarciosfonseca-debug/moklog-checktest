import {criarSolicitacoes,anexarSolicitacoes,marcarWhats,relerEGravarEquipe,alvosAguardando,resumoAprovacao,aprovarNaEquipe,mensagemSolicitacoes,auditarSolicitacoes} from './equipeSolicitacoes';
import {bloqueadaPorWhats,aplicarAprovacao} from './equipeAprovacao';
const now='2026-10-02T12:00:00.000Z';
const {synchronize}=require('../api/ai/lib/fvAprovacao');
const base=()=>({perfilSeguranca:{armada:'sim'},colaboradores:[{id:'c1',nome:'Ana',uniforme:{itens:{},solicitacoes:[]}},{id:'c2',nome:'Bia'}]});
let id;
beforeEach(()=>{id=0;});
const criar=(n=3,nivel='lider')=>criarSolicitacoes(Array.from({length:n},(_,i)=>({item:'Item '+i})),nivel,'P260A',now,()=>`uuid-${++id}`);

test('um lote cria todos os cinco protocolos distintos e preserva dados anteriores',()=>{
  const b=base(),orig=JSON.stringify(b),novas=criar(5),r=anexarSolicitacoes(b,'c1',novas);
  expect(r.colaboradores[0].uniforme.solicitacoes).toHaveLength(5);
  expect(new Set(novas.map(s=>s.id)).size).toBe(5);
  expect(novas.every(s=>s.exigeWhats&&s.aprovacao==='aguardando')).toBe(true);
  expect(JSON.stringify(b)).toBe(orig);
  expect(r.perfilSeguranca).toEqual(b.perfilSeguranca);
});

test('releitura seguida de gravação NÃO garante concorrência entre duas sessões (S1 bloqueante)',async()=>{
  let stored=base(),writes=0;
  const ler=async()=>{const snapshot=JSON.parse(JSON.stringify(stored));return {exists:()=>true,data:()=>snapshot};};
  const gravar=async(ref,patch)=>{stored={...stored,...patch};writes++;};
  const n1=criar(5),n2=criar(3);
  await Promise.all([relerEGravarEquipe('P260A',ler,gravar,b=>({base:anexarSolicitacoes(b,'c1',n1)})),relerEGravarEquipe('P260A',ler,gravar,b=>({base:anexarSolicitacoes(b,'c2',n2)}))]);
  expect(stored.colaboradores.map(c=>c.uniforme?.solicitacoes?.length||0)).toEqual([0,3]);
  expect(writes).toBe(2); // Documenta a perda, não declara o cenário aprovado.
});

test('marcação do toque em lote é idempotente na tentativa de novo e conta reenvio',()=>{
  const novas=criar(),ids=novas.map(s=>s.id),b=anexarSolicitacoes(base(),'c1',novas);
  const r1=marcarWhats(b,'c1',ids,now,'evento1');
  const r2=marcarWhats(r1,'c1',ids,now,'evento1');
  expect(r2.colaboradores[0].uniforme.solicitacoes.every(s=>s.whatsEnvios===1&&s.whatsEnviadoEm===now)).toBe(true);
  const r3=marcarWhats(r2,'c1',ids,now,'evento2');
  expect(r3.colaboradores[0].uniforme.solicitacoes.every(s=>s.whatsEnvios===2&&!bloqueadaPorWhats(s))).toBe(true);
});

test('aprovação bloqueia novos do líder; permite antigos, gerencial e enviados',()=>{
  let b=anexarSolicitacoes(base(),'c1',criar());
  const list=b.colaboradores[0].uniforme.solicitacoes;
  list[1].whatsEnviadoEm=now;list[2].exigeWhats=false;
  list.push({id:'antigo',status:'pendente',item:'Fone Lapela',solicitadoEm:now});
  list.push({id:'legado',status:'entregue',item:'Camisa',solicitadoEm:now});
  const alvos=alvosAguardando(b.colaboradores,2026);
  expect(alvos).toHaveLength(4);
  const r=aprovarNaEquipe(b,alvos,'aprovado',{somenteAguardando:true},now);
  expect(r.alterados).toBe(3);expect(r.bloqueados).toEqual([{colabId:'c1',solicId:list[0].id}]);
  expect(r.aplicados).not.toContainEqual(r.bloqueados[0]);
  expect(r.base.colaboradores[0].uniforme.solicitacoes[0]).toEqual(list[0]);
  expect(r.base.colaboradores[0].uniforme.solicitacoes[4].aprovacao).toBeUndefined();
  expect(resumoAprovacao(b.colaboradores,alvos,[{equipeItem:'Fone Lapela',valor:20}])).toEqual({total:4,aprovar:3,bloqueadas:1,semPreco:2,previstos:3});
});

test('dispensa explícita audita e permite aprovar; negar e aguardando não bloqueiam',()=>{
  const b=anexarSolicitacoes(base(),'c1',criar(1)),alvos=alvosAguardando(b.colaboradores,2026);
  const r=aprovarNaEquipe(b,alvos,'aprovado',{dispensarWhats:true},now);
  expect(r.base.colaboradores[0].uniforme.solicitacoes[0]).toMatchObject({aprovacao:'aprovado',whatsDispensadoEm:now,whatsDispensadoPor:'Gerencial'});
  for(const decisao of ['negado','aguardando'])expect(aplicarAprovacao(b.colaboradores,alvos,decisao).bloqueados).toEqual([]);
});

test('mensagem identifica unidade, líder e um protocolo por item',()=>{
  const novas=criar();const msg=mensagemSolicitacoes('P260A · Unidade A','Ana',novas);
  expect(msg).toContain('Líder P260A');expect(msg).toContain('Unidade A');
  expect(msg.match(/Protocolo:/g)).toHaveLength(3);
});

test('auditoria somente leitura separa duplicidade de indício de truncamento',()=>{
  const b=base();b.colaboradores[0].uniforme.solicitacoes=[{id:'s',motivo:'Solicitação múltipla',solicitadoEm:now},{id:'s'}];
  const old=JSON.stringify(b);expect(auditarSolicitacoes([b])).toEqual({totalPedidos:2,idsDuplicados:1,colaboradoresSuspeitos:1});expect(JSON.stringify(b)).toBe(old);
});

test('três bloqueadas não geram FV; após o toque geram três previstos sem mudar saldo real',()=>{
  const novas=criar(3),b=anexarSolicitacoes(base(),'c1',novas),alvos=alvosAguardando(b.colaboradores,2026);
  const bloqueadas=aprovarNaEquipe(b,alvos,'aprovado',{somenteAguardando:true},now);
  let plano={saldoAtual:62036.93,lancamentos:[]};
  const sincronizar=r=>r.aplicados.forEach(a=>{
    const c=r.base.colaboradores.find(c=>c.id===a.colabId);
    plano=synchronize(plano,c.uniforme.solicitacoes.find(s=>s.id===a.solicId),c,[]);
  });
  sincronizar(bloqueadas);
  expect(bloqueadas.bloqueados).toHaveLength(3);expect(plano.lancamentos).toHaveLength(0);
  const enviadas=marcarWhats(b,'c1',novas.map(s=>s.id),now,'click');
  sincronizar(aprovarNaEquipe(enviadas,alvos,'aprovado',{somenteAguardando:true},now));
  expect(plano.lancamentos).toHaveLength(3);
  expect(plano.lancamentos.every(l=>!l.realizado&&l.semPreco&&l.colabId==='c1')).toBe(true);
  expect(plano.saldoAtual).toBe(62036.93);
});

import {criarSolicitacoes,anexarSolicitacoes,marcarWhats,relerEGravarEquipe,alvosAguardando,resumoAprovacao,aprovarNaEquipe,mensagemSolicitacoes,auditarSolicitacoes,ASSINATURA_APROVADOR} from './equipeSolicitacoes';
import {podeEnviarAoGrupo,envioPendente,enviadoAposAprovacao,aplicarAprovacao} from './equipeAprovacao';
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

const aprovados=(b,n)=>aprovarNaEquipe(b,alvosAguardando(b.colaboradores,2026),'aprovado',{somenteAguardando:true},now).base;

test('marcação do toque em lote só vale para aprovados e é idempotente na tentativa de novo',()=>{
  const novas=criar(),ids=novas.map(s=>s.id),b=anexarSolicitacoes(base(),'c1',novas);
  expect(()=>marcarWhats(b,'c1',ids,now,'evento0')).toThrow(/aprovadas/);                    // ainda "aguardando": recusa
  const ap=aprovados(b);
  const r1=marcarWhats(ap,'c1',ids,now,'evento1');
  const r2=marcarWhats(r1,'c1',ids,now,'evento1');
  expect(r2.colaboradores[0].uniforme.solicitacoes.every(s=>s.whatsEnvios===1&&s.whatsEnviadoEm===now)).toBe(true);
  const r3=marcarWhats(r2,'c1',ids,now,'evento2');
  expect(r3.colaboradores[0].uniforme.solicitacoes.every(s=>s.whatsEnvios===2&&!envioPendente(s))).toBe(true);
});

test('NOVO FLUXO: a aprovação nunca depende do envio; o envio só é liberado depois de aprovar',()=>{
  let b=anexarSolicitacoes(base(),'c1',criar());
  const list=b.colaboradores[0].uniforme.solicitacoes;
  list[1].whatsEnviadoEm=now;list[2].exigeWhats=false;
  list.push({id:'antigo',status:'pendente',item:'Fone Lapela',solicitadoEm:now});
  list.push({id:'legado',status:'entregue',item:'Camisa',solicitadoEm:now});
  const alvos=alvosAguardando(b.colaboradores,2026);
  expect(alvos).toHaveLength(4);
  expect(list.slice(0,4).some(podeEnviarAoGrupo)).toBe(false);                                // antes de aprovar ninguém pode enviar
  const r=aprovarNaEquipe(b,alvos,'aprovado',{somenteAguardando:true},now);
  expect(r.alterados).toBe(4);expect(r.bloqueados).toEqual([]);                                 // nada fica bloqueado por falta de WhatsApp
  const novos=r.base.colaboradores[0].uniforme.solicitacoes;
  expect(novos.slice(0,4).every(podeEnviarAoGrupo)).toBe(true);
  expect(novos.slice(0,4).filter(envioPendente)).toHaveLength(3);                              // toque na mesma hora da aprovação conta como enviado depois
  expect(novos[4].aprovacao).toBeUndefined();                                                  // entregue/legado intocado
  expect(resumoAprovacao(b.colaboradores,alvos,[{equipeItem:'Fone Lapela',valor:20}])).toEqual({total:4,aprovar:4,bloqueadas:0,semPreco:3,previstos:4});
});

test('negado e aguardando nunca liberam o envio; entregue também não',()=>{
  const b=anexarSolicitacoes(base(),'c1',criar(1)),alvos=alvosAguardando(b.colaboradores,2026);
  for(const dec of ['negado','aguardando']){
    const r=aplicarAprovacao(b.colaboradores,alvos,dec,now);
    expect(r.bloqueados).toEqual([]);expect(podeEnviarAoGrupo(r.colaboradores[0].uniforme.solicitacoes[0])).toBe(false);
  }
  const ap=aprovados(b);const s=ap.colaboradores[0].uniforme.solicitacoes[0];
  expect(podeEnviarAoGrupo(s)).toBe(true);expect(podeEnviarAoGrupo({...s,status:'entregue'})).toBe(false);
});

test('se o gerencial voltar a decisão depois, o registro do envio é recusado (não envia pedido não aprovado)',()=>{
  const b=anexarSolicitacoes(base(),'c1',criar(2)),ids=b.colaboradores[0].uniforme.solicitacoes.map(s=>s.id);
  const ap=aprovados(b);
  const voltou=aplicarAprovacao(ap.colaboradores,[{colabId:'c1',solicId:ids[0]}],'aguardando',now).colaboradores;
  expect(()=>marcarWhats({...ap,colaboradores:voltou},'c1',ids,now,'e1')).toThrow(/aprovadas/);
});

test('mensagem só existe para pedidos aprovados e vai assinada por quem aprovou, com um protocolo por item',()=>{
  const novas=criar();
  expect(()=>mensagemSolicitacoes('P260A · Unidade A','Ana',novas)).toThrow(/aprovadas/);        // aguardando: não gera mensagem
  const ap=aprovados(anexarSolicitacoes(base(),'c1',novas)).colaboradores[0].uniforme.solicitacoes;
  const msg=mensagemSolicitacoes('P260A · Unidade A','Ana',ap);
  expect(msg).toContain('SOLICITAÇÃO APROVADA');expect(msg).toContain('Líder P260A');expect(msg).toContain('Unidade A');
  expect(msg.match(/Protocolo:/g)).toHaveLength(3);expect(msg.match(/Aprovada em:/g)).toHaveLength(3);
  expect(msg).toContain('Aprovado pelo '+ASSINATURA_APROVADOR);expect(ASSINATURA_APROVADOR).toBe('consultor Fonseca');
  expect(()=>mensagemSolicitacoes('P','A',[])).toThrow(/aprovadas/);
  expect(()=>mensagemSolicitacoes('P','A',[ap[0],{...ap[1],aprovacao:'negado'}])).toThrow(/aprovadas/);
});

test('auditoria somente leitura separa duplicidade de indício de truncamento',()=>{
  const b=base();b.colaboradores[0].uniforme.solicitacoes=[{id:'s',motivo:'Solicitação múltipla',solicitadoEm:now},{id:'s'}];
  const old=JSON.stringify(b);expect(auditarSolicitacoes([b])).toEqual({totalPedidos:2,idsDuplicados:1,colaboradoresSuspeitos:1});expect(JSON.stringify(b)).toBe(old);
});

test('aprovar gera os três previstos no FV sem esperar o envio e sem mudar o saldo real',()=>{
  const novas=criar(3),b=anexarSolicitacoes(base(),'c1',novas),alvos=alvosAguardando(b.colaboradores,2026);
  let plano={saldoAtual:62036.93,lancamentos:[]};
  const sincronizar=r=>r.aplicados.forEach(a=>{
    const c=r.base.colaboradores.find(c=>c.id===a.colabId);
    plano=synchronize(plano,c.uniforme.solicitacoes.find(s=>s.id===a.solicId),c,[]);
  });
  const r=aprovarNaEquipe(b,alvos,'aprovado',{somenteAguardando:true},now);
  sincronizar(r);
  expect(r.bloqueados).toHaveLength(0);expect(plano.lancamentos).toHaveLength(3);
  expect(plano.lancamentos.every(l=>!l.realizado&&l.semPreco&&l.colabId==='c1')).toBe(true);
  expect(plano.saldoAtual).toBe(62036.93);
});

test('pedidos do fluxo ANTIGO: toque anterior à aprovação não conta; ao reaprovar, o envio assinado volta a ser exigido',()=>{
  const ant='2026-10-01T10:00:00.000Z',aprov='2026-10-02T21:18:57.000Z',depois='2026-10-02T22:00:00.000Z';
  const base0={id:'x',status:'pendente',aprovacao:'aprovado',aprovadoEm:aprov};
  expect(enviadoAposAprovacao({...base0,whatsEnviadoEm:ant})).toBe(false);
  expect(envioPendente({...base0,whatsEnviadoEm:ant})).toBe(true);          // enviado sem assinatura no fluxo antigo: ainda falta o assinado
  expect(envioPendente({...base0,whatsEnviadoEm:depois})).toBe(false);
  expect(envioPendente({...base0})).toBe(true);
  expect(envioPendente({id:'x',status:'pendente',aprovacao:'aprovado',whatsEnviadoEm:ant})).toBe(false);   // sem data de aprovação gravada: tolerante
  // aprovado → aguardando → aprovado de novo: o toque antigo deixa de contar
  const b=anexarSolicitacoes(base(),'c1',criar(1)),alvos=alvosAguardando(b.colaboradores,2026);
  const a1=aprovarNaEquipe(b,alvos,'aprovado',{},'2026-10-02T12:00:00.000Z').base;
  const enviado=marcarWhats(a1,'c1',[a1.colaboradores[0].uniforme.solicitacoes[0].id],'2026-10-02T13:00:00.000Z','e1');
  expect(envioPendente(enviado.colaboradores[0].uniforme.solicitacoes[0])).toBe(false);
  const volta=aplicarAprovacao(enviado.colaboradores,[{colabId:'c1',solicId:enviado.colaboradores[0].uniforme.solicitacoes[0].id}],'aguardando','2026-10-03T09:00:00.000Z').colaboradores;
  const reaprov=aplicarAprovacao(volta,[{colabId:'c1',solicId:enviado.colaboradores[0].uniforme.solicitacoes[0].id}],'aprovado','2026-10-03T10:00:00.000Z').colaboradores;
  expect(envioPendente(reaprov[0].uniforme.solicitacoes[0])).toBe(true);
});

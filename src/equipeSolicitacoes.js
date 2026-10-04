import {aplicarAprovacao, podeEnviarAoGrupo, situacaoSolicitacao, solicitacoesPorAprovacao} from './equipeAprovacao';

export function quantidadeSolicitada(s) {
  const qtd=Number(s?.qtd??s?.quantidade??1);
  if(!Number.isSafeInteger(qtd)||qtd<1||qtd>100000)throw Error('Quantidade deve ser um número inteiro entre 1 e 100000.');
  return qtd;
}

export function criarSolicitacoes(itens, nivel, pid, agora = new Date().toISOString(), uuid = () => crypto.randomUUID()) {
  if (!['admin','lider'].includes(nivel)) throw Error('Acesso sem permissão para solicitar.');
  if (!Array.isArray(itens) || !itens.length || itens.some(i=>!i?.item?.trim())) throw Error('Selecione os itens da solicitação.');
  return itens.map(i=>({id:uuid(), item:i.item.trim(), qtd:quantidadeSolicitada(i), marca:i.marca||'', tamanho:i.tamanho||'', motivo:i.motivo||'',
    status:'pendente', aprovacao:'aguardando', solicitadoEm:agora, solicitadoPor:nivel==='admin'?'Gerencial':`Líder ${pid}`,
    exigeWhats:nivel==='lider', whatsEnvios:0}));
}

export function anexarSolicitacoes(base,colabId,novas) {
  if (!(base.colaboradores||[]).some(c=>c.id===colabId)) throw Error('Colaborador não encontrado. Reabra a ficha.');
  const todos = (base.colaboradores||[]).flatMap(c=>c.uniforme?.solicitacoes||[]);
  if (novas.some(s=>todos.some(x=>x.id===s.id))) throw Error('Protocolo já registrado. Reabra a ficha antes de repetir.');
  return {...base,colaboradores:base.colaboradores.map(c=>c.id!==colabId?c:{...c,uniforme:{...c.uniforme,solicitacoes:[...(c.uniforme?.solicitacoes||[]),...novas]}})};
}

export function marcarWhats(base,colabId,ids,em,eventoId) {
  const colab=(base.colaboradores||[]).find(c=>c.id===colabId);
  if (!colab || ids.some(id=>(colab.uniforme?.solicitacoes||[]).filter(s=>s.id===id).length!==1)) throw Error('Pedido ausente ou protocolo duplicado. Reabra a ficha.');
  // O envio ao grupo só vale para pedido APROVADO (relido do servidor): se o gerencial voltou a decisão, o registro é recusado.
  if (ids.some(id=>!podeEnviarAoGrupo(colab.uniforme.solicitacoes.find(s=>s.id===id)))) throw Error('Só solicitações aprovadas podem ser enviadas ao grupo. Reabra a ficha.');
  return {...base,colaboradores:base.colaboradores.map(c=>c.id!==colabId?c:{...c,uniforme:{...c.uniforme,
    solicitacoes:c.uniforme.solicitacoes.map(s=>!ids.includes(s.id)||(s.whatsEventos||[]).includes(eventoId)?s:{...s,
      whatsEnviadoEm:em,whatsEnvios:(Number(s.whatsEnvios)||0)+1,whatsEventos:[...(s.whatsEventos||[]),eventoId]})}})};
}

// Releitura exigida pelo projeto, com uma única escrita via fireGuard.
// Não equivale a uma transação: duas sessões simultâneas ainda podem conflitar.
export async function relerEGravarEquipe(ref,lerServidor,gravarProtegido,transformar) {
  const snap=await lerServidor(ref);
  if(!snap.exists()) throw Error('Equipe não encontrada no servidor.');
  const resultado=transformar(snap.data());
  await gravarProtegido(ref,{colaboradores:resultado.base.colaboradores},{merge:true});
  return resultado;
}

export function alvosAguardando(colaboradores,ano) {
  return (colaboradores||[]).flatMap(c=>solicitacoesPorAprovacao(c,'aguardando',ano).map(s=>({colabId:c.id,solicId:s.id})));
}
export function resumoAprovacao(colaboradores,alvos,catalogo=[],fvAtivo=true) {
  const pedidos=(colaboradores||[]).flatMap(c=>(c.uniforme?.solicitacoes||[]).filter(s=>alvos.some(a=>a.colabId===c.id&&a.solicId===s.id)));
  const pendentes=pedidos.filter(s=>situacaoSolicitacao(s)==='aguardando');
  return {total:pendentes.length,aprovar:pendentes.length,bloqueadas:0,
    semPreco:pendentes.filter(s=>!catalogo.some(i=>i.equipeItem===s.item)).length,previstos:fvAtivo?pendentes.length:0};
}
export function aprovarNaEquipe(base,alvos,decisao,opcoes,agora) {
  const r=aplicarAprovacao(base.colaboradores||[],alvos,decisao,agora,'Gerencial',opcoes);
  return {...r,base:{...base,colaboradores:r.colaboradores}};
}

// Assinatura da mensagem enviada ao grupo. Trocar aqui se mudar (a aprovação ainda é por PIN gerencial compartilhado).
export const ASSINATURA_APROVADOR = 'consultor Fonseca';
const quando = iso => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`; };
// Mensagem do grupo: SOMENTE de pedidos aprovados, já assinada por quem aprovou.
export function mensagemSolicitacoes(projectNome,colabNome,solicitacoes) {
  if (!solicitacoes?.length || solicitacoes.some(s=>situacaoSolicitacao(s)!=='aprovado')) throw Error('Só solicitações aprovadas podem ser enviadas ao grupo.');
  const linhas=['*SOLICITAÇÃO APROVADA — UNIFORME / MATERIAL* ✅',`*Unidade:* ${projectNome}`,`*Colaborador:* ${colabNome}`,'*Itens:*'];
  solicitacoes.forEach(s=>linhas.push(`• ${s.item}${s.tamanho?` (tam ${s.tamanho})`:''}${s.marca?` — ${s.marca}`:''}\n  Quantidade: ${quantidadeSolicitada(s)}\n  Motivo: ${s.motivo||'Não informado'}\n  Protocolo: ${s.id.slice(-6)}\n  Solicitante: ${s.solicitadoPor||'Não informado'}\n  Data: ${new Date(s.solicitadoEm).toLocaleDateString('pt-BR')}\n  Aprovada em: ${quando(s.aprovadoEm)}`));
  linhas.push('',`✅ *Aprovado pelo ${ASSINATURA_APROVADOR}*`);
  return linhas.join('\n');
}

export function auditarSolicitacoes(equipes) {
  let idsDuplicados=0,colaboradoresSuspeitos=0,totalPedidos=0;
  for(const base of equipes){
    const ids=new Map();
    for(const c of base.colaboradores||[]){
      const pedidos=c.uniforme?.solicitacoes||[];totalPedidos+=pedidos.length;
      pedidos.forEach(s=>ids.set(s.id,(ids.get(s.id)||0)+1));
      // Indício apenas: lote descrito como múltiplo que possui um único registro naquele instante.
      const lotes=new Map();pedidos.filter(s=>s.motivo==='Solicitação múltipla').forEach(s=>lotes.set(s.solicitadoEm,(lotes.get(s.solicitadoEm)||0)+1));
      if([...lotes.values()].some(n=>n===1)) colaboradoresSuspeitos++;
    }
    idsDuplicados += [...ids.values()].filter(n=>n>1).length;
  }
  return {totalPedidos,idsDuplicados,colaboradoresSuspeitos};
}

// ─────────────────────────────────────────────────────────────
// equipeAprovacao.js — Adendo Equipe (Cesta de Natal + FV + Aprovação)
//
// Funções PURAS (sem Firestore) usadas por Equipe.jsx e pdfSolicitacoes.js.
// Mantidas separadas para permitir testes unitários.
//
// Regras:
//   • aprovacao é eixo PARALELO a status/SLA. Nunca altera status,
//     solicitadoEm, entregueEm ou qualquer outro campo existente.
//   • Ausência de aprovacao = "aguardando" (leitura tolerante, sem migração).
//   • precoUnit reservado para a Fase 2 (calculadora do FV): sempre null aqui.
// ─────────────────────────────────────────────────────────────

export const APROVACAO_STATUS = ["aguardando", "aprovado", "negado"];

// Fluxo (decisão do Marcio, 03/10/2026): o líder SOLICITA → status "aguardando" → o gerencial aprova/nega → SÓ ENTÃO o líder
// envia a mensagem ao grupo, já assinada pelo aprovador. A aprovação nunca depende do envio.
// (O campo exigeWhats continua sendo gravado nos pedidos do líder e significa "deve ser enviado ao grupo DEPOIS de aprovado".)
export function podeEnviarAoGrupo(s) {
  return situacaoSolicitacao(s) === 'aprovado' && s?.status === 'pendente';
}
// A mensagem que vale é a ASSINADA, enviada DEPOIS da aprovação. Um toque do fluxo antigo (anterior à aprovação) não conta.
export function enviadoAposAprovacao(s) {
  if (!s?.whatsEnviadoEm) return false;
  if (!s.aprovadoEm) return false;
  return new Date(s.whatsEnviadoEm).getTime() >= new Date(s.aprovadoEm).getTime();
}
export function envioPendente(s) {
  return podeEnviarAoGrupo(s) && !enviadoAposAprovacao(s);
}

// Entregas antigas sem decisão não são solicitações aguardando aprovação.
export function situacaoSolicitacao(s) {
  if (APROVACAO_STATUS.includes(s?.aprovacao)) return s.aprovacao;
  return s?.status === 'pendente' ? 'aguardando' : 'legado';
}

// Leitura tolerante do status de aprovação.
export function statusAprovacao(solic) {
  const v = solic && solic.aprovacao;
  return APROVACAO_STATUS.includes(v) ? v : "aguardando";
}

// Ano (número) de um ISO; null se inválido.
export function anoDe(iso) {
  if (!iso) return null;
  const t = new Date(iso);
  return Number.isNaN(t.getTime()) ? null : t.getFullYear();
}

// Lista de anos para o filtro: ano atual e 3 anteriores.
export function anosFiltro(anoAtual = new Date().getFullYear(), qtd = 4) {
  return Array.from({ length: qtd }, (_, i) => anoAtual - i);
}

// Solicitações de um colaborador filtradas por aprovação e ano de solicitadoEm.
// status = "aprovado" | "aguardando" | "negado" | null (todas)
export function solicitacoesPorAprovacao(colab, status, ano) {
  const sl = colab && colab.uniforme && Array.isArray(colab.uniforme.solicitacoes)
    ? colab.uniforme.solicitacoes : [];
  return sl.filter(s => {
    if (status && situacaoSolicitacao(s) !== status) return false;
    if (ano != null && anoDe(s.solicitadoEm) !== Number(ano)) return false;
    return true;
  });
}

// Aplica uma decisão de aprovação a um conjunto de solicitações.
// colaboradores: array vindo do SERVIDOR (releitura).
// alvos: [{ colabId, solicId }]
// decisao: "aprovado" | "negado" | "aguardando"
// Retorna { colaboradores, alterados } sem mutar a entrada.
export function aplicarAprovacao(colaboradores, alvos, decisao, agoraIso = new Date().toISOString(), por = "Gerencial", opcoes = {}) {
  if (!APROVACAO_STATUS.includes(decisao)) throw new Error("Decisão inválida: " + decisao);
  const mapa = new Map();
  (alvos || []).forEach(a => {
    if (!a || !a.colabId || !a.solicId) return;
    if (!mapa.has(a.colabId)) mapa.set(a.colabId, new Set());
    mapa.get(a.colabId).add(a.solicId);
  });
  let alterados = 0;
  const bloqueados = [];   // mantido por compatibilidade: a aprovação não é mais bloqueada pelo envio ao WhatsApp
  const aplicados = [];
  const lista = (colaboradores || []).map(c => {
    const ids = mapa.get(c.id);
    if (!ids || !c.uniforme || !Array.isArray(c.uniforme.solicitacoes)) return c;
    let mudou = false;
    const solicitacoes = c.uniforme.solicitacoes.map(s => {
      if (!ids.has(s.id)) return s;
      if (opcoes.somenteAguardando && situacaoSolicitacao(s) !== 'aguardando') return s;
      if (c.uniforme.solicitacoes.filter(x=>x.id===s.id).length !== 1) throw new Error('Identificador duplicado: aprovação requer revisão do pedido.');
      const anterior = statusAprovacao(s);
      if (anterior === decisao && s.aprovacao === decisao) return s; // sem mudança real
      mudou = true; alterados++;
      aplicados.push({colabId:c.id, solicId:s.id});
      const hist = Array.isArray(s.aprovacaoHist) ? s.aprovacaoHist : [];
      return {
        ...s,
        aprovacao: decisao,
        aprovadoEm: agoraIso,
        aprovadoPor: por,
        precoUnit: s.precoUnit === undefined ? null : s.precoUnit,
        aprovacaoHist: [...hist, { de: anterior, para: decisao, em: agoraIso, por }],
      };
    });
    return mudou ? { ...c, uniforme: { ...c.uniforme, solicitacoes } } : c;
  });
  return { colaboradores: lista, alterados, bloqueados, aplicados };
}

// Contadores informativos (sem cálculo financeiro).
export function contadoresAprovacao(colaboradores, ano) {
  const r = { aprovado: 0, aguardando: 0, negado: 0, legado: 0 };
  (colaboradores || []).forEach(c => {
    solicitacoesPorAprovacao(c, null, ano).forEach(s => { r[situacaoSolicitacao(s)]++; });
  });
  return r;
}

// ID do documento de Cesta de Natal.
// Retorna null para entradas inválidas (ano não inteiro ou colabId vazio / com "/").
export function cestaDocId(ano, colabId) {
  const a = Number(ano);
  if (!Number.isInteger(a) || a < 2000 || a > 2100) return null;
  const id = colabId == null ? "" : String(colabId).trim();
  if (!id || id.includes("/")) return null;
  return `${a}_${id}`;
}

// Novo histórico do FV ao alterar o valor.
export function novoFV(fvAtual, valorNovo, agoraIso = new Date().toISOString()) {
  const anterior = fvAtual && typeof fvAtual.valor === "number" ? fvAtual.valor : null;
  const hist = fvAtual && Array.isArray(fvAtual.historico) ? fvAtual.historico : [];
  return {
    valor: valorNovo,
    atualizadoEm: agoraIso,
    historico: [...hist, { data: agoraIso, anterior, novo: valorNovo }],
  };
}

// Converte texto digitado ("35.000,50", "35000") em número; null se inválido.
export function parseValorBR(txt) {
  if (txt == null) return null;
  const limpo = String(txt).replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  if (limpo === "" || limpo === "-") return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

export function fmtBRL(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

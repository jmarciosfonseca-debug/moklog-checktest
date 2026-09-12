// ─────────────────────────────────────────────────────────────
// pendenciasLider.js — Qualidade de informação da pendência
//
// NÃO cria fonte de verdade. Consome o estado que já existe
// (item de equipamento com status/dataProblem/historico, e a
// checagem semanal dos módulos) e classifica a CONFIABILIDADE
// do registro. Um item antigo não é falha atual automática:
// pode ter sido corrigido fisicamente e não baixado no app.
//
// Reaproveita daysSince de pendencias.js (fonte ÚNICA da idade).
// Não troque daysSince por toISOString(): bug de fuso conhecido.
// ─────────────────────────────────────────────────────────────

import { daysSince } from "./pendencias";

// Marcadores de qualidade da informação. Ordem = confiabilidade.
export const QUALIDADE = {
  resolvido:      { id: "resolvido",        label: "Resolvido",                        cor: "#22c55e" },
  confirmado:     { id: "confirmado",       label: "Pendente confirmado",              cor: "#ef4444" },
  revisar:        { id: "revisar",          label: "Necessita revisão",                cor: "#f59e0b" },
  desatualizado:  { id: "desatualizado",    label: "Possível registro desatualizado",  cor: "#94a3b8" },
  revisarCadastro:{ id: "revisar-cadastro", label: "Necessita revisão de cadastro",    cor: "#f59e0b" },
};

const JANELA_REVISAO = 7;        // > 7 dias sem confirmação → revisar
const JANELA_DESATUALIZADO = 30; // > 30 dias sem confirmação recente → desatualizado

// Parse robusto → timestamp (ms) ou null. Ancora "YYYY-MM-DD" ao
// meio-dia local (bug de fuso conhecido). Rejeita ano insano.
function tsDe(v) {
  if (!v) return null;
  try {
    let d;
    if (v instanceof Date) d = v;
    else if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) d = new Date(v + "T12:00:00");
    else d = new Date(v);
    const t = d.getTime();
    if (Number.isNaN(t)) return null;
    const ano = d.getFullYear();
    if (ano < 2000 || ano > 2100) return null; // data malformada
    return t;
  } catch { return null; }
}

function diasDesdeTs(ts) {
  if (ts == null) return 0;
  return Math.max(0, Math.floor((Date.now() - ts) / 86400000));
}

// Item "aberto" = status indica problema.
export function itemAberto(status) {
  return !!status && status !== "ok";
}

// Identificador único válido do item (id não-vazio, ou identificacao).
// Retorna null quando não há como localizar com segurança → baixa bloqueada.
export function itemIdValido(item) {
  if (!item) return null;
  const id = item.id != null ? String(item.id).trim() : "";
  if (id) return id;
  const ident = item.identificacao != null ? String(item.identificacao).trim() : "";
  return ident || null;
}

// Data de abertura ("desde"), ou null se não houver data VÁLIDA.
// Nunca inventa "hoje".
export function abertoDesde(item) {
  if (!item) return null;
  if (tsDe(item.dataProblem)) return item.dataProblem;
  const hist = Array.isArray(item.historico) ? item.historico : [];
  const primeira = hist.find(h => h && itemAberto(h.status) && tsDe(h.data || h.em));
  return primeira ? (primeira.data || primeira.em) : null;
}

export function ultimaAtualizacao(item) {
  if (!item) return { data: null, responsavel: null };
  return {
    data: item.ultimaConfirmacao || item.atualizadoEm || item.dataStatus || null,
    responsavel: item.atualizadoPor || item.confirmadoPor || null,
  };
}

// Nº de testes semanais consecutivos que TERMINAM na semana mais recente.
export function semanasConsecutivas(flagsCronologicas) {
  const arr = Array.isArray(flagsCronologicas) ? flagsCronologicas : [];
  let n = 0;
  for (let i = arr.length - 1; i >= 0; i--) { if (arr[i]) n++; else break; }
  return n;
}

// Classifica a QUALIDADE da informação de um item aberto.
// - resolvido: baixado (status ok).
// - revisar-cadastro: aberto SEM data de abertura válida.
// - confirmado: confirmação registrada ≤ 7 dias.
// - desatualizado: aberto > 30 dias sem confirmação recente.
// - revisar: aberto, sem confirmação há mais de 7 dias.
export function classificarQualidade(item) {
  if (!itemAberto(item?.status)) return QUALIDADE.resolvido;

  const tsAbertura = tsDe(abertoDesde(item));
  if (tsAbertura == null) return QUALIDADE.revisarCadastro;

  const { data: ultConf } = ultimaAtualizacao(item);
  const tsConf = tsDe(ultConf);
  const diasSemConfirmar = tsConf != null ? diasDesdeTs(tsConf) : diasDesdeTs(tsAbertura);
  const diasAberto = daysSince(abertoDesde(item));

  if (tsConf != null && diasSemConfirmar <= JANELA_REVISAO) return QUALIDADE.confirmado;
  if (diasAberto > JANELA_DESATUALIZADO && diasSemConfirmar > JANELA_REVISAO) return QUALIDADE.desatualizado;
  if (diasSemConfirmar > JANELA_REVISAO) return QUALIDADE.revisar;
  return QUALIDADE.confirmado;
}

// Detalhe clicável de UMA pendência de equipamento (projeção segura).
// diasAberto = null sem data válida (UI mostra "Data de abertura não
// registrada", nunca "0 dias"). semanasConsecutivas = null enquanto o
// cruzamento semanal não estiver correlacionado (UI nunca mostra "0").
export function detalharPendenciaEquip(item, categoriaLabel, projectId, flagsSemanais) {
  const { data: ultData, responsavel: ultResp } = ultimaAtualizacao(item);
  const desde = abertoDesde(item);
  const temDataAbertura = tsDe(desde) != null;
  return {
    nome: item?.identificacao || categoriaLabel || "Item",
    categoria: categoriaLabel || "",
    status: item?.status || "ok",
    projeto: projectId,
    desde: temDataAbertura ? desde : null,
    diasAberto: temDataAbertura ? daysSince(desde) : null,
    ultimaAtualizacaoData: ultData,
    ultimaAtualizacaoResponsavel: ultResp,
    semanasConsecutivas: Array.isArray(flagsSemanais) ? semanasConsecutivas(flagsSemanais) : null,
    observacao: item?.justificativa || item?.observacao || "",
    qualidade: classificarQualidade(item),
    idValido: itemIdValido(item),
  };
}

// Auditoria de baixa: entrada aditiva com status anterior, novo status,
// responsável, data/hora e observação. Não exclui pendência.
export function entradaAuditoriaBaixa({ statusAnterior, statusNovo, responsavel, observacao }) {
  return {
    tipo: "Baixa de status",
    statusAnterior: statusAnterior || null,
    status: statusNovo || "ok",
    responsavel: responsavel || "",
    observacao: observacao || "",
    em: new Date().toISOString(),
  };
}

// ── Situação das checagens semanais (estrutura REAL de cada módulo) ────

// Equipamentos: checagemSemanal = { alvo, ultimaChecagem, ultimoResultado }.
// Pendente quando o alvo (domingo 23:59) já passou; senão concluída se
// ultimaChecagem existe. Espelha ContadorEquipamentos (não avança sozinho).
export function situacaoChecagemEquipamentos(chk, alvoTimestampFn) {
  if (!chk) return { situacao: "pendente", ultima: null, por: null, emAberto: null };
  const limite = typeof alvoTimestampFn === "function" && chk.alvo ? alvoTimestampFn(chk.alvo) : null;
  const venceu = limite != null ? (limite - Date.now() <= 0) : false;
  const temUltima = !!chk.ultimaChecagem;
  return {
    situacao: venceu ? "pendente" : (temUltima ? "concluida" : "pendente"),
    ultima: chk.ultimaChecagem || null,
    por: chk.ultimoResultado?.por || null,
    emAberto: chk.ultimoResultado ? !!chk.ultimoResultado.emAberto : null,
  };
}

// Alvo vigente da checagem de equipe = sábado da semana corrente (ou o
// próximo). Replica chkEqAlvoVigente de Equipe.jsx SEM o atalho chk.alvo,
// pois aqui precisamos justamente comparar o alvo salvo ao vigente.
export function alvoVigenteEquipe(hojeRef) {
  const hoje = hojeRef ? new Date(hojeRef) : new Date();
  hoje.setHours(0, 0, 0, 0);
  const dia = hoje.getDay();
  let base;
  if (dia === 6) base = hoje;                                   // sábado
  else if (dia === 0) { base = new Date(hoje); base.setDate(base.getDate() - 1); } // domingo → sábado
  else { const diff = (6 - dia + 7) % 7; base = new Date(hoje); base.setDate(base.getDate() + diff); }
  return base.toLocaleDateString("sv-SE");
}

// Equipe: checagemEquipe = { alvo, checkins:[...], concluidoEm }.
// SÓ é concluída quando o alvo salvo é o alvo VIGENTE. concluidoEm de um
// ciclo anterior não conta — nesse caso a situação reverte para pendente/
// parcial conforme os checkins do ciclo vigente.
export function situacaoChecagemEquipe(chk, numExigido, hojeRef) {
  const vigente = alvoVigenteEquipe(hojeRef);
  if (!chk) return { situacao: "pendente", feitos: 0, exigidos: numExigido || null, concluidoEm: null, alvoVigente: vigente };

  const alvoSalvo = chk.alvo || null;
  const cicloVigente = alvoSalvo === vigente;
  // checkins/concluidoEm só valem para o ciclo vigente.
  const feitos = cicloVigente && Array.isArray(chk.checkins) ? chk.checkins.length : 0;
  const concluida = cicloVigente && (!!chk.concluidoEm || (numExigido && feitos >= numExigido));

  return {
    situacao: concluida ? "concluida" : (feitos > 0 ? "parcial" : "pendente"),
    feitos,
    exigidos: numExigido || null,
    concluidoEm: cicloVigente ? (chk.concluidoEm || null) : null,
    alvoVigente: vigente,
  };
}

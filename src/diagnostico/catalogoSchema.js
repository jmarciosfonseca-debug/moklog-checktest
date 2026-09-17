// ─────────────────────────────────────────────────────────────
// catalogoSchema.js — Estrutura e enums do Diagnóstico Situacional
// Perfil: Centro Logístico. Contém APENAS enums, shapes e contrato de
// validação. NÃO contém conteúdo de catálogo (a matriz vive em
// scripts/seed/catalogoSeed.mjs, fora de src/, uso one-shot).
//
// CONTRATO DE HIERARQUIA (inviolável):
//   Após a carga one-shot, o Firestore é a fonte de verdade ÚNICA e
//   VENCEDORA do catálogo publicado. Este schema NÃO pode substituir,
//   completar nem servir de fallback para o catálogo publicado. Se houver
//   divergência entre schema e Firestore, prevalece o Firestore e a
//   divergência deve ser SINALIZADA como erro de versão — nunca corrigida
//   silenciosamente pelo app.
//
// Este módulo pode ser lido em runtime; o seed NÃO. Nada aqui toca PIN,
// sessão, App.jsx ou módulos existentes.
// ─────────────────────────────────────────────────────────────

// ── Estados do diagnóstico (ciclo de vida). Ordem = progressão esperada.
// em_geracao é RETOMÁVEL: se a cópia da revisão falhar, o diagnóstico não
// aparece como final; pode ser completado ou descartado com segurança.
// NÃO há promessa de rollback atômico.
export const ESTADO_DIAGNOSTICO = {
  RASCUNHO:   "rascunho",
  EM_REVISAO: "em_revisao",
  VALIDO:     "valido",
  EM_GERACAO: "em_geracao",
  CONGELADO:  "congelado",
};
export const ESTADOS_DIAGNOSTICO = Object.values(ESTADO_DIAGNOSTICO);

// ── Status possíveis de avaliação de cada item (doutrina do Diagnóstico).
export const STATUS_ITEM = {
  CONFORME:           "conforme",
  PARCIAL:            "parcial",
  NAO_CONFORME:       "nao_conforme",
  AUSENTE_NECESSARIO: "ausente_necessario",
  NA:                 "na",
  SEM_DADO:           "sem_dado",
};
// Conjunto de ESCOLHAS possíveis (apenas isso — não carrega regra de cálculo).
export const STATUS_ITEM_LISTA = Object.values(STATUS_ITEM);
export const STATUS_QUE_EXIGEM_ANALISE = [STATUS_ITEM.PARCIAL, STATUS_ITEM.NAO_CONFORME, STATUS_ITEM.AUSENTE_NECESSARIO];
export const STATUS_QUE_EXIGEM_OBSERVACAO = [STATUS_ITEM.SEM_DADO];

// ── Regras declarativas de denominador/avaliação.
// Espelham o que é persistido no doc raiz do catálogo no Firestore (fonte
// de verdade). Imutáveis por auditor; mudança exige nova versão de catálogo.
//   • na       → EXCLUI do denominador; exige justificativa; teto 20%/categoria (validação de aplicação).
//   • sem_dado → PERMANECE no denominador; NÃO conta como avaliado (nunca conforme).
export const STATUS_QUE_EXCLUEM_DENOMINADOR       = ["na"];
export const STATUS_QUE_PERMANECEM_NO_DENOMINADOR = ["sem_dado"];
export const STATUS_QUE_NAO_CONTAM_COMO_AVALIADOS = ["na", "sem_dado"];

// ── Criticidade dos itens (escala da Matriz v1.0.0 do Diagnóstico).
// NÃO confundir com a escala de criticidade do AnaliseRisco (doutrina distinta).
export const CRITICIDADE = {
  CRITICO:     "critico",
  RELEVANTE:   "relevante",
  INFORMATIVO: "informativo",
};
export const CRITICIDADE_LISTA = Object.values(CRITICIDADE);

// ── As 8 categorias fixas D01–D08 (rótulos + ordem; verdade final no Firestore).
export const CATEGORIAS_DIAGNOSTICO = [
  { id: "D01", nome: "Portaria e Controle de Acesso",  ordem: 1 },
  { id: "D02", nome: "CCO e Tecnologia",               ordem: 2 },
  { id: "D03", nome: "Perímetro e Detecção",           ordem: 3 },
  { id: "D04", nome: "Vias, Pátio e Áreas Comuns",     ordem: 4 },
  { id: "D05", nome: "Equipamentos Operacionais",      ordem: 5 },
  { id: "D06", nome: "Emergência, Saúde e Segurança",  ordem: 6 },
  { id: "D07", nome: "Equipe, Escala e Procedimentos", ordem: 7 },
  { id: "D08", nome: "Governança, Risco e Manutenção", ordem: 8 },
];

// ── Perfis de usuário do Diagnóstico (Firebase Auth por e-mail/senha).
export const ROLE = {
  AUDITOR: "auditor",
  GERENTE: "gerente",
};
export const ROLES = Object.values(ROLE);

// ── SHAPES (documentação de forma; não são validadores em runtime) ─────

// Item do catálogo (fonte: Firestore após carga do seed one-shot).
export const SHAPE_ITEM_CATALOGO = Object.freeze({
  id: "string",              // ex.: "D02.02.01" (ID literal da matriz, preservado)
  categoria: "string",       // "D01".."D08"
  subcategoria: "string",    // ex.: "D02.02"
  texto: "string",
  criticidade: "critico|relevante|informativo",
  aplicavelPadrao: "boolean",
  ordem: "number",
  origem: "manual",
  fonte_auto: "null",
  deprecado: "boolean",
});

// Documento de perfil/escopo: usuarios/{uid}
//   role, active, scopeAll, projectIds[], clientIds[], createdAt, updatedAt
//
// Fase 1 — a APLICACAO NAO ESCREVE em usuarios/{uid}. Criacao e alteracao
// de perfil, escopo, active e scopeAll ocorrem EXCLUSIVAMENTE por Console ou
// Admin SDK (a regra Firestore mantem a escrita do app em usuarios como
// `if false`). scopeAll:true (gerente-raiz) so existe por essa via — nunca
// criavel nem elevavel pela UI.
// Timestamps: Console usa timestamp literal; Admin SDK usa serverTimestamp().
export const SHAPE_USUARIO = Object.freeze({
  role: "auditor|gerente",
  active: "boolean",
  scopeAll: "boolean",
  projectIds: "string[]",
  clientIds: "string[]",
  createdAt: "timestamp (Console: literal | Admin SDK: serverTimestamp)",
  updatedAt: "timestamp (Console: literal | Admin SDK: serverTimestamp)",
});

// Referencia ao catalogo em uso (metadados; conteudo e verdade vem do Firestore).
export const CATALOGO_REF = Object.freeze({
  catalogoId: "centro_logistico_v1_0_0",
  versao: "1.0.0",
  perfil: "centro_logistico",
});

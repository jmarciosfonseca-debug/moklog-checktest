// ─────────────────────────────────────────────────────────────
// gerenciaisConfig.js — Registro ÚNICO de recursos gerenciais.
//
// Motivo: a "Visão 360" existia no código (score, dados, tela e PDF)
// mas ficou ÓRFÃ — o botão que a acionava foi removido e a função
// nunca mais era chamada. Para isso não se repetir, todo recurso
// gerencial que tem tela própria precisa estar registrado aqui, e
// o menu do painel renderiza os botões a PARTIR deste registro.
//
// Um teste (gerenciaisConfig.test.js) falha se um recurso habilitado
// não tiver ponto de entrada acionável — trava a regressão no build.
// ─────────────────────────────────────────────────────────────

// Cada recurso:
//   id            — identificador estável (usado no teste e na allowlist)
//   label         — texto do botão
//   icone         — emoji do botão
//   gerencialOnly — exige sessão gerencial (todos os atuais exigem)
//   enabled       — se false, não renderiza (nem exige ponto de entrada)
export const RECURSOS_GERENCIAIS = [
  {
    id: "visao-360",
    label: "Visão 360 Executiva",
    icone: "🎯",
    gerencialOnly: true,
    enabled: true,
  },
];

// Helper: recursos habilitados que exigem ponto de entrada acionável.
export function recursosHabilitados() {
  return RECURSOS_GERENCIAIS.filter(r => r.enabled);
}

// Helper de allowlist: um id é um recurso gerencial válido e habilitado?
export function isRecursoGerencial(id) {
  return RECURSOS_GERENCIAIS.some(r => r.id === id && r.enabled);
}

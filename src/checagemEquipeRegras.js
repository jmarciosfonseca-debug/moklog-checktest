// Regras da checagem de equipe do fim de semana — FONTE ÚNICA (Equipe, contador da home e Painel do Líder).
// Decisões do Marcio (03/10/2026):
//   • P260B não participa da checagem de equipe.
//   • P505, P260A e P260C (escala 4x2): 2 check-ins no fim de semana — Diurno e Noturno.
//   • Demais (12x36): 4 check-ins — sábado e domingo, diurno e noturno.
//   • O card só aparece no sábado e no domingo (janelaChecagem.js).
export const CHK_EQ_SEM_CHECAGEM = ["P260B"];
export const CHK_EQ_DOIS_TURNOS = ["P505", "P260A", "P260C"];

export const CHK_EQ_SLOTS_12x36 = [
  { id: "sab_diurno", label: "Sábado · Diurno", turno: "Diurno" },
  { id: "sab_noturno", label: "Sábado · Noturno", turno: "Noturno" },
  { id: "dom_diurno", label: "Domingo · Diurno", turno: "Diurno" },
  { id: "dom_noturno", label: "Domingo · Noturno", turno: "Noturno" },
];
export const CHK_EQ_SLOTS_DOIS_TURNOS = [
  { id: "diurno", label: "Fim de semana · Diurno", turno: "Diurno" },
  { id: "noturno", label: "Fim de semana · Noturno", turno: "Noturno" },
];

// Nº de check-ins exigidos. 0 = o projeto não faz checagem de equipe.
export function chkEqNumCheckins(projectId, colaboradores) {
  if (CHK_EQ_SEM_CHECAGEM.includes(projectId)) return 0;
  if (CHK_EQ_DOIS_TURNOS.includes(projectId)) return 2;
  const ativos = (colaboradores || []).filter(c => (c.status || "ativo") === "ativo");
  const n4x2 = ativos.filter(c => String(c.escala || "").includes("4x2")).length;
  if (ativos.length > 0 && n4x2 / ativos.length >= 0.5) return 2;   // escala 4x2 predominante: mesma regra do P505/P260A
  return 4;
}
export function chkEqSlots(numCheckins) {
  if (numCheckins === 2) return CHK_EQ_SLOTS_DOIS_TURNOS;
  if (numCheckins === 4) return CHK_EQ_SLOTS_12x36;
  return [];
}
export function checagemEquipeAplica(projectId, colaboradores) {
  return chkEqNumCheckins(projectId, colaboradores) > 0;
}
// Check-ins que contam no ciclo: um por plantão (slot), limitado ao exigido.
// Check-ins antigos (check_1..3, da regra anterior) continuam contando, para não zerar o que já foi assinado neste fim de semana.
export function chkEqFeitos(checkins, numCheckins) {
  const slots = new Set((Array.isArray(checkins) ? checkins : []).map(c => c && c.slotId).filter(Boolean));
  return Math.min(slots.size, numCheckins || 0);
}

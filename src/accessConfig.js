// ─────────────────────────────────────────────────────────────
// accessConfig.js — FONTE ÚNICA dos PINs de projeto (líder).
//
// Antes existiam mapas PROJECT_PINS duplicados em App.jsx,
// Equipe.jsx e Equipamentos.jsx, que saíram de sincronia
// (P311B ficou com o mesmo PIN de P311A). Este módulo elimina
// a duplicação: todos importam daqui.
//
// Regra dos PINs: "16" + número do projeto. P311A e P311B
// PRECISAM ser distintos (compartilhavam 16311, o que abria
// Itajaí como Curitiba). P311B passou a 163112.
// ─────────────────────────────────────────────────────────────

export const PROJECT_PINS = {
  P601: "16601",
  P602: "16602",
  P604: "16604",
  P605: "16605",
  P606: "16606",
  P607: "16607",
  P311A: "16311",
  P311B: "163112",
  P505: "16505",
  P260A: "162601",
  P260B: "162602",
  P260C: "162603",
};

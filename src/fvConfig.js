// ─────────────────────────────────────────────────────────────
// fvConfig.js — Adendo 2 (FV automático). Compartilhado por app e robô.
// Projetos do escopo. P311 e demais projetos ficam FORA.
// ─────────────────────────────────────────────────────────────
export const FV_PROJETOS = ["P260A","P260B","P260C","P601","P602","P604","P605","P606","P607"];

export const FV_NOMES = {
  P260A:"Jatinox Unidade A", P260B:"Jatinox Unidade B", P260C:"Jatinox Unidade C",
  P601:"Golgi Cajamar", P602:"Golgi Mauá I", P604:"Golgi Jundiaí", P605:"Golgi Arujá",
  P606:"Duque de Caxias", P607:"Santa Maria",
};

export const FV_TIPOS = ["credito","aporte","debito","vt","am"];
export const FV_TIPO_ROTULO = { credito:"Crédito", aporte:"Aporte", debito:"Débito", vt:"VT", am:"AM" };

// Horas sem sincronização até marcar como desatualizado (08h e 16h + folga).
export const FV_DESATUALIZADO_H = 18;

export function fvNoEscopo(pid) { return FV_PROJETOS.includes(pid); }

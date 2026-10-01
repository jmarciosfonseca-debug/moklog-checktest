// ─────────────────────────────────────────────────────────────
// fvConfig.js — Adendo 2 (FV automático). Compartilhado por app e robô.
// Projetos do escopo: todos, EXCETO P311A e P311B (fora do FV).
// ─────────────────────────────────────────────────────────────
export const FV_PROJETOS = ["P260A","P260B","P260C","P505","P601","P602","P604","P605","P606","P607"];

export const FV_NOMES = {
  P260A:"Jatinox Unidade A", P260B:"Jatinox Unidade B", P260C:"Jatinox Unidade C",
  P505:"Klog Guarulhos",
  P601:"Golgi Cajamar", P602:"Golgi Mauá", P604:"Golgi Jundiaí", P605:"Golgi Dutra",
  P606:"Golgi Duque de Caxias", P607:"Golgi Brasília",
};

// Crédito mensal oficial do FV por projeto (base da projeção; editável no painel).
export const FV_CREDITO_MENSAL = {
  P260A:6022.08, P260B:1860.75, P260C:2319.66, P505:5686.70, P601:4216.00,
  P602:4560.00, P604:6510.56, P605:6228.60, P606:2746.00, P607:5611.04,
};

export const FV_TIPOS = ["credito","aporte","debito","vt","am"];
export const FV_TIPO_ROTULO = { credito:"Crédito", aporte:"Aporte", debito:"Débito", vt:"VT", am:"AM" };

// Horas sem sincronização até marcar como desatualizado (08h e 16h + folga).
export const FV_DESATUALIZADO_H = 18;

export function fvNoEscopo(pid) { return FV_PROJETOS.includes(pid); }

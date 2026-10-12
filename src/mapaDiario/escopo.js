// Dimensionamento operacional por projeto (documento do Marcio, 11/10/2026; P260A corrigido por ele: VSPP 1 e VSPP 2 são dois postos 5x2) — fonte de conferência dos postos.
// Cada posto: [nome, horas, escala, diurnos, noturnos, folguistas]. "Foguista" no documento = folguista (4x2).
// O mapa (postos.js) é testado contra esta tabela: nº de postos por projeto, postos 24h que existem de dia e de noite.
export const ESCOPO = {
  P260A: [["VSPP Líder", 24, "4x2", 1, 1, 1], ["VSPP 1", 12, "5x2", 1, 0, 0], ["VSPP 2", 12, "5x2", 1, 0, 0], ["Vig. Monitoramento CCO", 24, "4x2", 1, 1, 1]],
  P260B: [["VSPP", 24, "4x2", 1, 1, 1]],
  P260C: [["VSPP Líder", 24, "4x2", 1, 1, 1], ["Vigilante Patrimonial", 24, "12x36", 2, 2, 0]],
  P311A: [["Líder", 24, "12x36", 2, 2, 0], ["Vigilante Ronda Tático", 24, "12x36", 2, 2, 0], ["Vigilante Apoio", 12, "12x36", 2, 0, 0], ["Porteiro CCO", 24, "12x36", 2, 2, 0]],
  P311B: [["Vigilante Líder", 24, "12x36", 2, 2, 0], ["Vigilante Ronda", 24, "12x36", 2, 2, 0], ["Vigilante CCO", 24, "12x36", 2, 2, 0]],
  P505: [["VSPP Líder", 24, "4x2", 1, 1, 1], ["VSPP Apoio", 24, "4x2", 1, 1, 1], ["Vig. Monitoramento CCO", 24, "4x2", 1, 1, 1], ["CDA", 24, "12x36", 2, 2, 0], ["VSPP Ronda (08–20)", 12, "5x2", 2, 0, 0]],
  P601: [["VSPP Líder", 24, "12x36", 2, 2, 0], ["Vig. Monitoramento CCO", 24, "12x36", 2, 2, 0], ["CDA", 24, "12x36", 2, 2, 0], ["VSPP Apoio", 12, "12x36", 2, 0, 0], ["VSPP Ronda (08–20)", 12, "12x36", 2, 0, 0]],
  P602: [["VSPP Líder", 24, "12x36", 2, 2, 0], ["Vig. Monitoramento CCO", 24, "12x36", 2, 2, 0], ["Vigilante Apoio", 24, "12x36", 2, 2, 0]],
  P604: [["VSPP Líder", 24, "12x36", 2, 2, 0], ["Vig. Monitoramento CCO", 24, "12x36", 2, 2, 0], ["VSPP Apoio 1", 24, "12x36", 2, 2, 0], ["VSPP Apoio 2", 24, "12x36", 2, 2, 0], ["Recepcionista (08–17)", 8, "5x2", 1, 0, 0], ["CDA", 12, "12x36", 2, 0, 0]],
  P605: [["VSPP Líder", 24, "12x36", 2, 2, 0], ["VSPP Apoio", 24, "12x36", 2, 2, 0], ["Vig. Monitoramento CCO", 24, "12x36", 2, 2, 0], ["Recepcionista (08–17)", 8, "5x2", 1, 0, 0], ["CDA", 12, "12x36", 2, 0, 0]],
  P606: [["Vigilante Líder", 24, "12x36", 2, 2, 0], ["Vig. Monitoramento CCO", 24, "12x36", 2, 2, 0], ["Vigilante Apoio", 24, "12x36", 2, 2, 0]],
  P607: [["Vig. Ronda (acumula Líder)", 24, "12x36", 2, 2, 0], ["Vigilante Pista", 24, "12x36", 2, 2, 0], ["AGP Monitoramento", 24, "12x36", 2, 2, 0], ["AGP Portaria", 12, "12x36", 2, 0, 0]],
};

export const totaisDoProjeto = (pid) => (ESCOPO[pid] || []).reduce((t, [, , , d, n, f]) => ({ postos: t.postos + 1, diurnos: t.diurnos + d, noturnos: t.noturnos + n, folguistas: t.folguistas + f }), { postos: 0, diurnos: 0, noturnos: 0, folguistas: 0 });

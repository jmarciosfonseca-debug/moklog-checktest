// Posição dos quadrantes sobre o mapa de cada projeto (public/mapas/<PID>.jpg), em % da largura e da altura
// da imagem. Usado pelo Relatório de Iluminação para apontar, no próprio mapa, onde estão os pontos
// deficientes. Pode ser sobrescrito pela configuração do módulo (data.mapa.posicoes = { A1:[x,y], ... }).
// Medido sobre as imagens com os quadrantes já desenhados (rótulos amarelos). [x%, y%] = centro do rótulo.
export const POSICOES_QUADRANTES = {
  P311A: { A1: [17.2, 54.8], A2: [41.7, 38.8], A3: [62.3, 25.8], B1: [36.3, 68.5], B2: [57.8, 57.5], B3: [78.0, 46.8], C1: [52.6, 87.8], C2: [74.7, 77.0], C3: [92.9, 63.3] },
  P311B: { A1: [53.6, 25.3], B1: [18.6, 53.3], B2: [51.9, 53.0], B3: [85.6, 53.3], C1: [18.0, 78.0], C2: [74.5, 78.3] },
  P260A: { A1: [21.5, 23.0], A2: [63.0, 21.5], B1: [22.5, 62.5], B2: [63.5, 61.5] },
  P260C: { A1: [35.5, 44.5], A2: [78.5, 44.5], B1: [35.0, 75.0], B2: [78.5, 75.0] },
  P605:  { A1: [29.0, 30.0], A2: [54.5, 30.0], B1: [28.0, 68.0], B2: [59.5, 68.0] },
};

const norm = (s) => String(s || "").trim().toUpperCase().replace(/\s+/g, "");

// Devolve { nome: [x,y] } para o projeto, aceitando nomes como "A1", "a1", "Quadrante A1".
export function posicoesDoProjeto(projectId, override) {
  const base = { ...(POSICOES_QUADRANTES[projectId] || {}), ...(override || {}) };
  const out = {};
  for (const k of Object.keys(base)) out[norm(k)] = base[k];
  return out;
}
export function posicaoQuadrante(tabela, nome) {
  const n = norm(nome);
  if (tabela[n]) return tabela[n];
  const m = n.match(/([A-Z]\d+)$/); // "QUADRANTEA1" → "A1"
  return m && tabela[m[1]] ? tabela[m[1]] : null;
}

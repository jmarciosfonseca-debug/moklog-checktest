// Posição dos quadrantes sobre o mapa de cada projeto (public/mapas/<PID>.jpg), em % da largura e da altura
// da imagem. Usado pelo Relatório de Iluminação para apontar, no próprio mapa, onde estão os pontos
// deficientes. Pode ser sobrescrito pela configuração do módulo (data.mapa.posicoes = { A1:[x,y], ... }).
// Medido em 09/10/2026 sobre as imagens com os quadrantes já desenhados: [x%, y%] = centro do rótulo amarelo.
export const POSICOES_QUADRANTES = {
  P311A: { A1: [17.4, 54.4], A2: [42.1, 38.7], A3: [62.6, 25.4], B1: [36.5, 68.3], B2: [57.8, 57.1], B3: [78.4, 46.9], C1: [53.2, 89.5], C2: [75.1, 77.9], C3: [93.1, 62.9] },
  P311B: { A1: [54.0, 25.4], B1: [18.8, 53.5], B2: [52.4, 52.9], B3: [86.4, 53.1], C1: [18.2, 77.9], C2: [75.1, 79.8] },
  P260A: { A1: [21.9, 22.8], A2: [63.2, 21.5], B1: [22.8, 62.4], B2: [63.9, 60.5] },
  P260C: { A1: [35.6, 45.0], A2: [78.7, 45.2], B1: [35.1, 75.1], B2: [78.6, 75.6] },
  P505:  { A1: [19.8, 41.4], B1: [70.2, 41.3] },
  P601:  { A1: [22.5, 33.6], A2: [66.4, 33.5], B1: [55.6, 70.5] },
  P602:  { A1: [25.6, 39.7], B1: [69.5, 41.6] },
  P604:  { A1: [26.2, 63.1], A2: [26.4, 22.5], B1: [81.3, 30.6], B2: [80.4, 71.5], C1: [54.8, 91.1] },
  P605:  { A1: [29.3, 29.7], A2: [54.9, 30.1], B1: [28.3, 67.6], B2: [59.4, 67.4] },
  P606:  { A1: [19.4, 28.9], A2: [43.2, 29.2], A3: [75.9, 30.2], B1: [16.9, 64.8], B2: [44.1, 65.3], B3: [75.9, 65.9] },
  P607:  { A1: [15.8, 23.4], A2: [44.4, 24.4], A3: [90.3, 25.3], B1: [15.4, 63.7], B2: [44.5, 64.7], B3: [90.0, 66.9] },
};

const norm = (s) => String(s || "").trim().toUpperCase();
// Código do quadrante dentro do nome: "A1", "a1", "Quadrante B2", "C1 - Portaria" → "A1", "B2", "C1".
export function codigoQuadrante(nome) {
  const n = norm(nome);
  if (/^[A-Z]\d{1,2}$/.test(n)) return n;
  const m = n.match(/(?:^|[^A-Z0-9])([A-Z]\d{1,2})(?![A-Z0-9])/);
  return m ? m[1] : null;
}

// Devolve { CODIGO: [x,y] } para o projeto (tabela fixa + sobrescrita da configuração).
export function posicoesDoProjeto(projectId, override) {
  const base = { ...(POSICOES_QUADRANTES[projectId] || {}), ...(override || {}) };
  const out = {};
  for (const k of Object.keys(base)) {
    const p = base[k];
    if (Array.isArray(p) && p.length === 2 && Number.isFinite(+p[0]) && Number.isFinite(+p[1])) out[norm(k)] = [+p[0], +p[1]];
  }
  return out;
}
export function posicaoQuadrante(tabela, nome) {
  const n = norm(nome);
  if (tabela[n]) return tabela[n];
  const c = codigoQuadrante(n);
  return c && tabela[c] ? tabela[c] : null;
}

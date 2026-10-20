// Listas datadas da tela (regra do Marcio, 20/10): sempre do mais recente para o mais antigo e em CASCATA —
// só as últimas N entradas visíveis; "ver mais" abre o resto. Ordena só a exibição: nada é alterado.
export const CASCATA_VISIVEIS = 3;

const chaveData = (r, campos) => {
  for (const c of campos) { const v = r && r[c]; if (v) return String(v); }
  return '';
};
// Mais recente primeiro; empate mantém a ordem original (novo no topo).
export function ordenarRecentePrimeiro(lista, campos = ['data', 'registradoEm', 'criadoEm', 'em']) {
  return (Array.isArray(lista) ? lista : []).map((r, i) => ({ r, i }))
    .sort((a, b) => chaveData(b.r, campos).localeCompare(chaveData(a.r, campos)) || a.i - b.i)
    .map(x => x.r);
}
export function cortarCascata(lista, aberto, n = CASCATA_VISIVEIS) {
  const l = Array.isArray(lista) ? lista : [];
  return { itens: aberto ? l : l.slice(0, n), resto: Math.max(0, l.length - n), cabe: l.length > n };
}

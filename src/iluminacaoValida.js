// Validação do quadrante de iluminação (pura): nunca corta número em silêncio.
export function validarQuadrante({ nome, total, deficientes }, existentes = [], editId = null) {
  const n = String(nome || "").trim();
  const t = Number(total) || 0;
  const d = Number(deficientes) || 0;
  if (!n) return { erro: "Informe o nome do quadrante (ex: A1)." };
  if (t <= 0) return { erro: "Informe quantos pontos de iluminação existem no quadrante." };
  if (d > t) return { erro: `Deficientes não pode ser maior que os pontos (${t}). Corrija um dos dois números.` };
  if (existentes.some((q) => String(q.nome || "").trim().toLowerCase() === n.toLowerCase() && q.id !== editId)) return { erro: `Já existe um quadrante chamado "${n}".` };
  return { nome: n, total: t, deficientes: d };
}

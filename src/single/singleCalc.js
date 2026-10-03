// Shared pure calculation: UI, API, PDF and adapter must use this module.
function inteiro(value) {
  const n = value === "" || value == null ? 0 : Number(value);
  if (!Number.isSafeInteger(n) || n < 0 || n > 100000) throw new Error("Quantidade inválida: informe inteiro entre 0 e 100000.");
  return n;
}
function calcularFamilia(item = {}) {
  const total = inteiro(item.total), parcial = inteiro(item.parcial), inoperante = inteiro(item.inoperante);
  if (parcial + inoperante > total) throw new Error("Parcial + inoperante não pode ultrapassar o total.");
  const operante = total - parcial - inoperante;
  const falhas = Array.isArray(item.falhas) ? item.falhas : [];
  const somaFalhas = falhas.reduce((n, f) => n + inteiro(f.qtd), 0);
  return {...item, total, parcial, inoperante, operante,
    disponibilidade: total ? Math.round(operante / total * 1000) / 10 : null,
    pendencias: parcial + inoperante,
    avisos: somaFalhas > parcial + inoperante ? ["Quantidade de falhas supera as pendências; revise a distribuição."] : []};
}
function calcularInspecao(inspecao) {
  inspecao = inspecao || {};
  const itens = (Array.isArray(inspecao.itens) ? inspecao.itens : []).map(calcularFamilia).filter(x => x.total > 0);
  const total = itens.reduce((s,x) => s+x.total,0), operante = itens.reduce((s,x) => s+x.operante,0);
  return {...inspecao, itens, total, operante, disponibilidadeGeral: total ? Math.round(operante/total*1000)/10 : null};
}
const chave = x => x.familiaId || x.id || (x.grupo || "") + "/" + x.nome;
function variacao(atual = {}, anterior = {}) {
  const prev = new Map(calcularInspecao(anterior).itens.map(x => [chave(x), x]));
  return calcularInspecao(atual).itens.map(x => {
    const p = prev.get(chave(x));
    return {id:chave(x), inoperantes:p ? x.inoperante-p.inoperante : null,
      disponibilidade:p ? Math.round((x.disponibilidade-p.disponibilidade)*10)/10 : null};
  });
}
// Vistoria anterior para comparação: a última CONCLUÍDA, de data anterior (rascunho não é referência).
function anteriorConcluida(historico = [], atual = {}) {
  return (Array.isArray(historico) ? historico : [])
    .filter(x => x && x.id !== atual.id && x.estado === "concluida" && String(x.data) < String(atual.data))
    .sort((a, b) => String(b.data).localeCompare(String(a.data)) || String(b.criadoEm).localeCompare(String(a.criadoEm)))[0] || null;
}
// "+2,5 p.p." / "−2,5 p.p." / "0,0 p.p." / "—"
function fmtVariacao(v) {
  if (v == null || !Number.isFinite(Number(v))) return "—";
  const n = Number(v), abs = Math.abs(n).toLocaleString("pt-BR", {minimumFractionDigits: 1, maximumFractionDigits: 1});
  return (n > 0 ? "+" : n < 0 ? "−" : "") + abs + " p.p.";
}
function dataBR(iso) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || "")); return m ? m[3] + "/" + m[2] + "/" + m[1] : String(iso || ""); }
module.exports = {inteiro, calcularFamilia, calcularInspecao, variacao, anteriorConcluida, fmtVariacao, dataBR};

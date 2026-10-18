// Quem está REALMENTE de plantão, segundo o Mapa de Equipe do turno (rascunho ou enviado).
// Serve aos outros registros do turno (Ronda Diária, Ronda VSPP, Perimetral, Ronda Virtual): o líder titular que faltou
// não aparece; quem cobre (FT, cobertura, troca, Base digitada) aparece no lugar. Puro, sem Firestore.
//
// Regras:
//  - Falta e "Sem ninguém" (vago) ficam fora;
//  - Presente, Atraso, FT, Cobertura e Troca entram com o nome que está no posto (cadastro ou Base digitada);
//  - Saída antecipada: quem saiu fica fora e quem cobriu entra no mesmo posto (herda "líder" se o posto é de líder).
const SITUACOES_NO_POSTO = new Set(["presente", "atraso", "ft", "cobertura", "troca"]);

export function quemEstaDePlantao(mapa) {
  if (!mapa || !Array.isArray(mapa.postos)) return [];
  const out = [];
  const vistos = new Set();
  const add = (p) => {
    const nome = String(p.pessoaNome || "").trim();
    if (!nome) return;
    const chave = p.pessoaId ? `id:${p.pessoaId}` : `nome:${nome.toLowerCase()}`;
    if (vistos.has(chave)) return;
    vistos.add(chave);
    out.push({ ...p, pessoaNome: nome });
  };
  mapa.postos.forEach((p) => {
    if (!p) return;
    const d = p.detalhe || {};
    const base = !!(d.base || (d.livre && !p.pessoaId));
    const lider = !!p.lider;
    if (!p.saida && SITUACOES_NO_POSTO.has(p.situacao)) add({ postoId: p.id, posto: p.rotulo || "", pessoaId: p.pessoaId || "", pessoaNome: p.pessoaNome, situacao: p.situacao, base, lider });
    if (p.saida) (p.saida.coberturas || []).forEach((c) => add({ postoId: p.id, posto: p.rotulo || "", pessoaId: c.pessoaId || "", pessoaNome: c.pessoaNome, situacao: "cobertura", base: c.tipo === "base", lider, desde: c.de || "" }));
  });
  // Líder do turno primeiro; depois a ordem dos postos.
  return out.sort((a, b) => Number(b.lider) - Number(a.lider));
}

// Quem está no posto de líder (ou null se o mapa não tem líder presente).
export const liderDePlantao = (lista) => (lista || []).find((x) => x.lider) || null;

// "Diurno"/"diurno"/"D" → "D"; "Noturno"/"noturno"/"N" → "N".
export const turnoDoMapa = (t) => (/^n/i.test(String(t || "")) ? "N" : "D");

export function rotuloNoPlantao(x) {
  const extra = x.lider ? "líder" : x.situacao === "ft" ? "FT" : x.situacao === "cobertura" ? (x.base ? "cobertura Base" : "cobertura") : x.situacao === "troca" ? "troca" : "";
  return `${x.pessoaNome}${x.posto ? ` · ${x.posto}` : ""}${extra && !x.lider ? ` (${extra})` : ""}`;
}

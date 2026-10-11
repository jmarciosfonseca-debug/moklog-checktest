// Fontes perimetrais da Análise de Risco — funções PURAS (sem Firestore).
// Regra do Marcio (11/10/2026): TODO projeto com histórico de teste/ronda
// perimetral alimenta a Análise de Risco. Só fica de fora o projeto SEM
// histórico (aí a fonte é desmarcada/desconsiderada). Nada de lista fixa.

export const normalizarZona = (valor) => {
  const texto = String(valor || "").trim();
  const m = texto.match(/(?:zona\s*|z\s*-?\s*)0*(\d{1,3})\b/i);
  return m ? `Z-${String(m[1]).padStart(2, "0")}` : texto.toUpperCase();
};

export const MOTIVO_SEM_HISTORICO = "sem histórico de teste perimetral neste projeto";

// Doc perimetral/{pid}: testes[] com zonas { "Zona 01": { status } }.
// Vale o teste mais recente. `fmt` formata a data para exibição.
export function resumirColecaoPerimetral(testes, fmt = (d) => d) {
  const lista = Array.isArray(testes) ? testes : [];
  if (!lista.length) return { ok: false, temDado: false, motivo: "sem testes perimetrais" };
  const ult = [...lista].sort((a, b) => String(b.data || "").localeCompare(String(a.data || "")))[0];
  const zonas = Object.entries(ult.zonas || {}).map(([nome, zv], i) => {
    const st = String(zv?.status || "ok").toLowerCase();
    return {
      nome, total: 1, ruins: st === "ok" ? 0 : 1, pctFalha: st === "ok" ? 0 : 100, status: st,
      // identidade canônica: sem ela a zona não entra na contagem da matriz
      zonaCanonica: normalizarZona(nome), pontoFisicoNumero: i + 1, pendenciaCadastro: false,
    };
  });
  if (!zonas.length) return { ok: false, temDado: false, motivo: "teste perimetral sem zonas registradas" };
  const ruins = zonas.filter((z) => z.ruins > 0);
  const pctOk = Math.round(((zonas.length - ruins.length) / zonas.length) * 100);
  return {
    ok: true, temDado: true, fonte: "colecao", totalTestes: lista.length,
    dataUltISO: String(ult.data || "").slice(0, 10), dataUlt: fmt(ult.data),
    pctOk, zonas, piorZona: ruins[0] || null,
  };
}

const diaISO = (v) => String(v || "").slice(0, 10);

// Une as duas origens possíveis do mesmo dado (ronda diária e teste perimetral).
// - só uma com dado → usa ela;  - as duas → usa a de leitura mais recente
//   (empate → ronda, que traz recência por zona);  - nenhuma → sem histórico
//   (ausência) OU erro de leitura (nunca confundir os dois).
export function escolherFontePerimetral(rondas, colecao) {
  const r = rondas || {}, c = colecao || {};
  const rOk = !!(r.ok && r.temDado), cOk = !!(c.ok && c.temDado);
  if (rOk && cOk) {
    const usaColecao = diaISO(c.dataUltISO) > diaISO(r.dataUltimaRonda);
    return { ...(usaColecao ? c : r), fontesLidas: ["rondas", "colecao"] };
  }
  if (rOk) return { ...r, fontesLidas: ["rondas"] };
  if (cOk) return { ...c, fontesLidas: ["colecao"] };
  if (r.erro || c.erro) {
    return { ok: false, temDado: false, erro: true, motivo: "erro ao ler o histórico perimetral — tente novamente (não significa ausência de dados)" };
  }
  // Há plantões antigos sem resumo perimetral: o histórico EXISTE, só não foi
  // consolidado — não é "sem histórico" e não deve ser tratado como ausência.
  if (r.historicoSemResumo) {
    return { ok: false, temDado: false, motivo: r.motivo, historicoSemResumo: r.historicoSemResumo };
  }
  return { ok: false, temDado: false, motivo: MOTIVO_SEM_HISTORICO, semHistorico: true };
}

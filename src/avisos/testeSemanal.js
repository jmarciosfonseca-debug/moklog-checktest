// Painel de Avisos — resumo do Teste Semanal por projeto (puro, sem Firestore nem relógio).
// Entrada: o histórico de relatórios semanais já carregado na Home (stored[pid].history). Saída: o último teste e o da
// semana anterior, para o painel comparar ("o que é novo, o que foi resolvido") e avisar o próximo teste.
// resolveStatus e computeHealth vêm do App (mesma conta da Home e do PDF), para o painel nunca divergir deles.

const itensNaoOk = (project, state, resolveStatus) => {
  const out = {};
  const st = state && typeof state === "object" ? state : {};
  for (const cat of project.categories || []) {
    const s = st[cat.id];
    if (!s) continue;
    if (cat.type === "single") {
      const r = resolveStatus(s);
      if (r !== "ok") out[`${cat.id}|0`] = { rotulo: cat.label, st: r };
    } else if (cat.type === "items") {
      (Array.isArray(s) ? s : []).forEach((v, i) => {
        const r = resolveStatus(v);
        if (r !== "ok") out[`${cat.id}|${i}`] = { rotulo: `${cat.label} — ${(cat.itemLabels || [])[i] || `item ${i + 1}`}`, st: r };
      });
    } else if (cat.type === "count") {
      (Array.isArray(s.inoperative) ? s.inoperative : []).forEach((it) => {
        out[`${cat.id}|${(it && it.id) || "?"}`] = { rotulo: `${cat.label} — ${(it && it.id) || "?"}`, st: "inop" };
      });
    }
  }
  return out;
};

export function resumoDoRegistro(project, registro, { resolveStatus, computeHealth }) {
  const data = registro && registro.meta && registro.meta.date;
  if (!data || !/^\d{4}-\d{2}-\d{2}/.test(String(data))) return null;
  const h = computeHealth(project, registro.state);
  return { data: String(data).slice(0, 10), pct: h.pct, total: h.total, inop: h.inop, parcial: h.partial, itens: itensNaoOk(project, registro.state, resolveStatus) };
}

// { [pid]: { ultima, anterior|null } } — só projetos com ao menos um relatório. O "anterior" é o último de data MENOR que a do último.
export function testesDoHistorico(projects, stored, deps) {
  const out = {};
  for (const project of Object.values(projects || {})) {
    const hist = ((stored && stored[project.id] && stored[project.id].history) || []).filter((r) => r && r.meta && r.meta.date);
    if (!hist.length) continue;
    const ord = [...hist].sort((a, b) => String(a.meta.date).localeCompare(String(b.meta.date)));
    const ult = ord[ord.length - 1];
    const dUlt = String(ult.meta.date).slice(0, 10);
    const ant = [...ord].reverse().find((r) => String(r.meta.date).slice(0, 10) < dUlt) || null;
    const ultima = resumoDoRegistro(project, ult, deps);
    if (!ultima) continue;
    out[project.id] = { ultima, anterior: ant ? resumoDoRegistro(project, ant, deps) : null };
  }
  return out;
}

// novos = não ok agora e ok (ou ausente) na semana anterior · resolvidos = o contrário · persistem = não ok nas duas.
export function compararTestes(ultima, anterior) {
  if (!ultima || !anterior) return null;
  const novos = [], resolvidos = [];
  let persistem = 0;
  for (const [k, v] of Object.entries(ultima.itens)) { if (anterior.itens[k]) persistem++; else novos.push(v.rotulo); }
  for (const [k, v] of Object.entries(anterior.itens)) if (!ultima.itens[k]) resolvidos.push(v.rotulo);
  return { novos, resolvidos, persistem, deltaPct: ultima.pct - anterior.pct };
}

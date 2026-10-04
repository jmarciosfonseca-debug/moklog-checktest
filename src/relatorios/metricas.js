// ─────────────────────────────────────────────────────────────
// Métricas ÚNICAS dos relatórios (laudo semanal e consolidado). Decisão do Marcio (04/10/2026):
//   • Saúde = (operacionais + 0,5 × parciais) ÷ dispositivos testados — a mesma fórmula nos dois documentos.
//   • CFTV (tipo "count") entra câmera a câmera: a lista "inoperative" do teste é a fonte (antes o gerador lia um
//     campo "inoper" que a tela nunca grava, e as câmeras paradas sumiam da saúde e do comparativo).
// ─────────────────────────────────────────────────────────────
export const PESO_PARCIAL = 0.5;
export const DIAS_FOLLOWUP_VENCIDO = 15;
const norm = s => (!s || s === "ok") ? "ok" : (s === "partial" ? "partial" : "inop");

// Dispositivos de UMA verificação. Câmeras OK do CFTV entram agregadas (qtd), as em falha uma a uma.
export function itensDoEstado(project, state) {
  const out = [];
  for (const cat of (project?.categories || [])) {
    const s = state?.[cat.id];
    if (!s || cat.type === "maintenance" || cat.type === "notes") continue;
    if (cat.type === "single") {
      out.push({ catId: cat.id, cat: cat.label, item: cat.label, key: cat.id, status: norm(s.status), since: s.since || null, note: s.note || "", unico: true });
    } else if (cat.type === "items" && Array.isArray(s)) {
      s.forEach((v, i) => {
        const lbl = cat.itemLabels?.[i] || `Item ${i + 1}`;
        out.push({ catId: cat.id, cat: cat.label, item: lbl, key: `${cat.id}|${lbl}`, status: norm(v?.status), since: v?.since || null, note: v?.note || "" });
      });
    } else if (cat.type === "count") {
      const total = Number(s.total ?? cat.total ?? 0) || 0;
      const lista = Array.isArray(s.inoperative) ? s.inoperative : [];
      lista.forEach((it, j) => {
        const id = String(it?.id || "").trim() || `Sem identificação ${j + 1}`;
        out.push({ catId: cat.id, cat: cat.label, item: id, key: `${cat.id}|${id}`, status: it?.status === "partial" ? "partial" : "inop",
          since: it?.since || null, note: it?.note || it?.descricao || "", camera: true });
      });
      const restantes = Math.max(0, total - lista.length);
      if (restantes) out.push({ catId: cat.id, cat: cat.label, item: "demais", key: `${cat.id}|__ok`, status: "ok", qtd: restantes, camera: true, agregado: true });
    }
  }
  return out;
}

export function resumo(itens) {
  let total = 0, ok = 0, parcial = 0, inop = 0;
  for (const it of itens) {
    const q = it.qtd || 1; total += q;
    if (it.status === "ok") ok += q; else if (it.status === "partial") parcial += q; else inop += q;
  }
  return { total, ok, parcial, inop, saude: total ? ((ok + PESO_PARCIAL * parcial) / total) * 100 : 100 };
}

export function porCategoria(itens) {
  const ordem = [], mapa = new Map();
  for (const it of itens) {
    if (!mapa.has(it.catId)) { mapa.set(it.catId, []); ordem.push({ catId: it.catId, cat: it.cat }); }
    mapa.get(it.catId).push(it);
  }
  return ordem.map(o => ({ ...o, ...resumo(mapa.get(o.catId)) }));
}

// Falhas agrupadas por sistema (para "Onde estão as falhas"), maior primeiro.
export function falhasPorSistema(itens) {
  const m = new Map();
  for (const it of itens) {
    if (it.status === "ok") continue;
    const r = m.get(it.cat) || { cat: it.cat, inop: 0, parcial: 0 };
    if (it.status === "partial") r.parcial++; else r.inop++;
    m.set(it.cat, r);
  }
  return [...m.values()].sort((a, b) => (b.inop + b.parcial) - (a.inop + a.parcial) || b.inop - a.inop || a.cat.localeCompare(b.cat));
}

// Situação de um dispositivo no período, pela sequência semanal (null = sem dado naquela semana).
export function classificar(seq) {
  const v = (seq || []).filter(x => x != null);
  if (!v.length || v.every(x => x === "ok")) return null;
  if (v[v.length - 1] === "ok") return "Resolvida";
  if (v.every(x => x !== "ok")) return "Persistente";
  const desde = v.findIndex(x => x !== "ok");
  return v.slice(desde).includes("ok") ? "Reincidente" : "Nova";
}

export const diasEntre = (isoDe, ate = new Date()) => {
  if (!isoDe) return null;
  const d = new Date(String(isoDe).length <= 10 ? isoDe + "T12:00:00" : isoDe);
  return Number.isNaN(d.getTime()) ? null : Math.floor((ate.getTime() - d.getTime()) / 86400000);
};

// Estado da tratativa: "sem" | "vencido" (> 15 dias sem atualização) | "emdia".
export function estadoTratativa(registro, hoje = new Date()) {
  if (!registro || registro.resolvido) return { estado: "sem" };
  const entries = Array.isArray(registro.entries) ? registro.entries : Array.isArray(registro.registros) ? registro.registros : [];
  if (!entries.length && !registro.statusAtual) return { estado: "sem" };
  const ult = entries.length ? entries[entries.length - 1] : {};
  const quando = ult.em || ult.data || null;
  const dias = diasEntre(quando, hoje);
  return { estado: dias != null && dias > DIAS_FOLLOWUP_VENCIDO ? "vencido" : "emdia", status: ult.status || registro.statusAtual || "aguardando", quando, dias };
}

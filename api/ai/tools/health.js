// Ranking de saúde usando a mesma regra de App.jsx::computeHealth:
// OK=1, Parcial=0,5, INOP=0; percentual = round(okEquivalente/total*100).
const { getDb } = require("../lib/firebaseAdmin");
const { ok, fail, PROJECT_IDS, PROJECT_NAMES } = require("../lib/shape");

const COUNT_DEFAULTS = {
  P601: { cftv: 71 }, P602: { cftv: 42 }, P604: { cftv: 73 },
  P605: { cftv: 54 }, P606: { cftv: 72 }, P607: { cftv: 44 },
  P311A: { cftv: 140 }, P311B: { cftv: 114 }, P505: { cftv: 73 },
  P260A: { cftv: 65, cam_sistema: 132 },
};

function statusOf(value) {
  const raw = value && typeof value === "object" ? value.status : value;
  const status = String(raw || "").toLowerCase();
  if (status === "ok") return "ok";
  if (status === "partial" || status === "parcial" || status === "baixo") return "partial";
  return "inop";
}

function computeHealthFromState(state, projectId) {
  let total = 0, okEquivalent = 0, partial = 0, inop = 0;
  const categories = [];
  for (const [category, value] of Object.entries(state || {})) {
    // App.jsx calcula apenas categorias operacionais. Metadados auxiliares
    // eventualmente persistidos junto ao estado não entram no denominador.
    if (["maintenance", "notes", "meta"].includes(category)) continue;
    let catTotal = 0, catOk = 0, catPartial = 0, catInop = 0;
    if (Array.isArray(value)) {
      catTotal = value.length;
      for (const item of value) {
        const s = statusOf(item);
        if (s === "ok") catOk += 1;
        else if (s === "partial") { catOk += 0.5; catPartial += 1; }
        else catInop += 1;
      }
    } else if (value && typeof value === "object" && (value.total != null || Array.isArray(value.inoperative) || COUNT_DEFAULTS[projectId]?.[category])) {
      catTotal = Number(value.total ?? COUNT_DEFAULTS[projectId]?.[category]) || 0;
      catInop = Array.isArray(value.inoperative) ? value.inoperative.length : 0;
      catOk = Math.max(0, catTotal - catInop);
    } else if (value && typeof value === "object" && value.status != null) {
      catTotal = 1;
      const s = statusOf(value);
      if (s === "ok") catOk = 1;
      else if (s === "partial") { catOk = 0.5; catPartial = 1; }
      else catInop = 1;
    } else continue;
    total += catTotal; okEquivalent += catOk; partial += catPartial; inop += catInop;
    if (catPartial || catInop) categories.push({ category, total: catTotal, partial: catPartial, inop: catInop });
  }
  return { total, ok: Math.round(okEquivalent), partial, inop, healthPct: total ? Math.round((Math.round(okEquivalent) / total) * 100) : 100, categories };
}

async function get_health_ranking(args = {}) {
  const order = args.order === "best" ? "best" : "worst";
  const db = getDb();
  const records = [], warnings = [];
  for (const pid of PROJECT_IDS) {
    let snap;
    try { snap = await db.collection("projects").doc(pid).get(); }
    catch (e) { return fail("QUERY_FAILED", "Falha ao consultar checklists de saúde.", true); }
    if (!snap.exists) { warnings.push(`${pid}: sem documento em projects.`); continue; }
    const history = Array.isArray((snap.data() || {}).history) ? snap.data().history : [];
    const latest = history[history.length - 1];
    if (!latest || !latest.state) { warnings.push(`${pid}: sem checklist semanal utilizável.`); continue; }
    const h = computeHealthFromState(latest.state, pid);
    records.push({ projectId: pid, projectName: PROJECT_NAMES[pid] || pid, inop: h.inop, partial: h.partial, total: h.total, healthPct: h.healthPct, categories: h.categories.sort((a,b)=>(b.inop+b.partial)-(a.inop+a.partial)), reportDate: latest.meta?.date || null, source: { collection: "projects", recordId: `${pid}/history/latest` } });
  }
  records.sort((a,b) => order === "best" ? b.healthPct-a.healthPct || a.inop-b.inop : a.healthPct-b.healthPct || b.inop-a.inop);
  return ok({ filters: { order }, summary: { formula: "round(round(OK + 0.5×Parcial) / Total × 100)", projectsWithData: records.length, requestedProjects: PROJECT_IDS.length }, records, dataQualityWarnings: warnings });
}

module.exports = { get_health_ranking, computeHealthFromState };

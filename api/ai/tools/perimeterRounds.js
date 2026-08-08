// ─────────────────────────────────────────────────────────────
// tools/perimeterRounds.js — get_perimeter_round_gaps
//
// Fonte real (auditada em App.jsx): coleção `perimetral/{pid}` com
// array `.testes[]`; cada teste { data:"YYYY-MM-DD", zonas:{ <id>:{ status } } }.
// Zona status != "ok" = zona ruim (não conformidade perimetral).
//
// Também há `ronda_vspp/{pid}` (ronda física VSPP) com `.registros[]`
// { data, slots:[], marcacoes:{ <slot>:{ status } } } — usado para % de
// cobertura. Só P601 hoje no painel; a ferramenta tenta ler todos.
//
// REGRA CRÍTICA: não classificar plantão AINDA ABERTO como falta.
// Aqui usamos o último teste registrado como referência; plantões em
// andamento (sem registro fechado) simplesmente não entram como falha.
// ─────────────────────────────────────────────────────────────

const { getDb } = require("../lib/firebaseAdmin");
const { toMillis, toIsoSaoPaulo } = require("../lib/time");
const {
  ok, fail, failFrom, record, validateProjectId, resolveTargets, applyLimit, PROJECT_NAMES,
} = require("../lib/shape");

// Elegíveis a perimetral (auditado: PERIMETRAL_ELIGIBLE no App.jsx).
const PERIMETRAL_ELIGIBLE = new Set(["P601", "P602", "P604", "P605", "P606", "P607", "P311A", "P311B", "P505"]);

async function get_perimeter_round_gaps(args = {}) {
  const v = validateProjectId(args.projectId);
  if (!v.valid) return fail("VALIDATION_ERROR", "projectId inválido.");

  const startMs = args.startDate ? toMillis(args.startDate) : null;
  const endMs = args.endDate ? toMillis(args.endDate) : null;

  const targets = resolveTargets(v.id).filter(pid => PERIMETRAL_ELIGIBLE.has(pid));
  const db = getDb();
  const records = [];
  const warnings = [];

  for (const pid of targets) {
    let snap;
    try {
      snap = await db.collection("perimetral").doc(pid).get();
    } catch (e) {
      return failFrom(e, "get_perimeter_round_gaps");
    }
    if (!snap.exists) { warnings.push(`${pid}: sem registros de teste perimetral.`); continue; }
    const data = snap.data() || {};
    const testes = Array.isArray(data.testes) ? data.testes : [];
    if (!testes.length) { warnings.push(`${pid}: sem testes perimetrais registrados.`); continue; }

    for (const t of testes) {
      const diaMs = toMillis(t.data);
      if (diaMs == null) continue;
      if (startMs != null && diaMs < startMs) continue;
      if (endMs != null && diaMs > endMs) continue;

      const zonas = t.zonas || {};
      const ruins = Object.entries(zonas).filter(([, z]) => (z && z.status ? z.status : "ok") !== "ok");
      if (!ruins.length) continue;

      records.push(record({
        projectId: pid,
        module: "perimetral",
        recordId: `${pid}-${t.data}`,
        status: "zonas não conformes",
        severity: ruins.length >= 3 ? "high" : "medium",
        occurredAt: toIsoSaoPaulo(diaMs),
        resolvedAt: null,
        durationMinutes: null,
        description: `Teste perimetral de ${t.data}: ${ruins.length} zona(s) fora de conformidade.`,
        evidence: [
          `Projeto ${PROJECT_NAMES[pid] || pid}`,
          `Zonas: ${ruins.map(([id, z]) => `${id}=${(z && z.status) || "?"}`).slice(0, 10).join(", ")}`,
        ],
        source: { collection: "perimetral", recordId: `${pid}/testes` },
      }));
    }
  }

  records.sort((a, b) => Date.parse(b.occurredAt || 0) - Date.parse(a.occurredAt || 0));
  const { rows, truncated } = applyLimit(records, args.limit, 100);

  return ok({
    filters: { projectId: v.id, startDate: args.startDate || null, endDate: args.endDate || null, shift: args.shift || null },
    summary: { total: records.length },
    records: rows,
    dataQualityWarnings: warnings.length ? warnings : ["Nota: plantões em andamento (sem teste fechado) não são contados como falta."],
    truncated,
  });
}

module.exports = { get_perimeter_round_gaps };

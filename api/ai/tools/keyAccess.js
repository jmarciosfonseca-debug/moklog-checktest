// ─────────────────────────────────────────────────────────────
// tools/keyAccess.js — get_keyaccess_failures
//
// Fonte real (auditada em KeyAccessFalha.jsx): coleção
// `keyaccess_falhas/{pid}`, documento por projeto:
//   { registros:[ { data:"YYYY-MM-DD", horaInicio, horaFim, tipos:[],
//                   tipoCustom, registradoPor:{ nome } } ] }
//
// horaFim ausente = falha sem término formal (em aberto).
// KeyAccess é sistema de TERCEIRO (não Moked) — apenas registramos.
// ─────────────────────────────────────────────────────────────

const { getDb } = require("../lib/firebaseAdmin");
const { toMillis, toIsoSaoPaulo } = require("../lib/time");
const {
  ok, fail, failFrom, record, validateProjectId, resolveTargets, applyLimit, PROJECT_NAMES,
} = require("../lib/shape");

// Duração em minutos a partir de "HH:MM" início/fim (mesmo dia; cruza meia-noite).
function minutosFalha(horaInicio, horaFim) {
  if (!horaInicio || !horaFim) return null;
  try {
    const [h1, m1] = horaInicio.split(":").map(Number);
    const [h2, m2] = horaFim.split(":").map(Number);
    let mins = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (mins < 0) mins += 1440; // cruzou a meia-noite
    return mins;
  } catch (e) { return null; }
}

async function get_keyaccess_failures(args = {}) {
  const v = validateProjectId(args.projectId);
  if (!v.valid) return fail("VALIDATION_ERROR", "projectId inválido.");

  const startMs = args.startDate ? toMillis(args.startDate) : null;
  const endMs = args.endDate ? toMillis(args.endDate) : null;
  const onlyOpen = !!args.onlyOpen;

  const targets = resolveTargets(v.id);
  const db = getDb();
  const records = [];
  const warnings = [];

  for (const pid of targets) {
    let snap;
    try {
      snap = await db.collection("keyaccess_falhas").doc(pid).get();
    } catch (e) {
      return failFrom(e, "get_keyaccess_failures");
    }
    if (!snap.exists) continue;
    const data = snap.data() || {};
    const registros = Array.isArray(data.registros) ? data.registros : [];

    for (const r of registros) {
      const diaMs = toMillis(r.data);
      if (diaMs == null) { warnings.push(`${pid}: falha sem data válida.`); continue; }
      if (startMs != null && diaMs < startMs) continue;
      if (endMs != null && diaMs > endMs) continue;

      const semTermino = !r.horaFim;
      if (onlyOpen && !semTermino) continue;

      const durMin = minutosFalha(r.horaInicio, r.horaFim);
      const tipos = Array.isArray(r.tipos) ? r.tipos.slice() : [];
      if (r.tipoCustom) tipos.push(r.tipoCustom);

      // Divergência: descrição/tipo indica restauração mas sem horaFim.
      const textoTipos = tipos.join(" ").toLowerCase();
      if (semTermino && /(normaliz|restaur|restabelec|resolvid)/.test(textoTipos)) {
        warnings.push(`${pid} (${r.data}): tipo indica restauração porém sem horário de término formal.`);
      }

      records.push(record({
        projectId: pid,
        module: "keyaccess",
        recordId: `${pid}-${r.data}-${r.horaInicio || ""}`,
        status: semTermino ? "sem término formal" : "normalizado",
        severity: semTermino ? "high" : "medium",
        occurredAt: toIsoSaoPaulo(diaMs),
        resolvedAt: null,
        durationMinutes: durMin,
        description: `Falha KeyAccess em ${r.data}${r.horaInicio ? ` às ${r.horaInicio}` : ""}${r.horaFim ? ` até ${r.horaFim}` : " — sem término registrado"}${tipos.length ? ` (${tipos.join(", ")})` : ""}.`,
        evidence: [
          `Projeto ${PROJECT_NAMES[pid] || pid}`,
          r.registradoPor && r.registradoPor.nome ? `Registrado por ${r.registradoPor.nome}` : null,
        ].filter(Boolean),
        source: { collection: "keyaccess_falhas", recordId: `${pid}/registros` },
      }));
    }
  }

  records.sort((a, b) => Date.parse(b.occurredAt || 0) - Date.parse(a.occurredAt || 0));
  const { rows, truncated } = applyLimit(records, args.limit, 100);

  return ok({
    filters: { projectId: v.id, startDate: args.startDate || null, endDate: args.endDate || null, onlyOpen },
    summary: {
      total: records.length,
      semTermino: records.filter(r => r.status === "sem término formal").length,
    },
    records: rows,
    dataQualityWarnings: warnings,
    truncated,
  });
}

module.exports = { get_keyaccess_failures, minutosFalha };

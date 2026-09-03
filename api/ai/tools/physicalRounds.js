// ─────────────────────────────────────────────────────────────
// tools/physicalRounds.js — get_physical_round_gaps
//
// Fonte real (auditada em RondaDiaria.jsx): índice leve por projeto em
// `rondas/{projectId}` = { plantoes:[entradaLeve...], deletedIds:[] }.
// Cada entradaLeve: { id, dataPlantao:"YYYY-MM-DD", turno, lider,
//   nRondas, enviado, enviadoEm, criadoEm }.
// O plantão completo (com fotos e a lista de rondas em si) mora em
// `rondas_plantoes/{plantaoId}`, mas essa ferramenta usa só o índice
// leve — é o suficiente pra apontar lacunas sem custar 1 leitura extra
// por plantão.
//
// IMPORTANTE — isto é uma PRIMEIRA VERSÃO (rascunho, risco 1-3):
// o índice leve não tem um campo explícito de "atraso" ou "conforme"
// como as rondas virtuais. A regra de "lacuna" abaixo é uma inferência
// minha a partir dos campos disponíveis, não uma regra confirmada por
// alguém que conhece o app — precisa de validação do Márcio/Codex antes
// de virar fonte de verdade operacional:
//
//   • nRondas === 0 E plantão encerrado     → nenhuma ronda registrada no
//                                             plantão (severity: critical)
//   • enviado === false E plantão encerrado → plantão não enviado depois
//     há mais de GRACE_DAYS                   do prazo de graça (severity: high)
//   • nRondas ausente                       → dado desconhecido (medium),
//                                             nunca convertido em zero
//   • lider ausente/vazio                   → sem responsável identificado
//                                             (severity: medium, mesmo se
//                                             os dois acima não ocorrerem)
//
// Não há registro de "não conformidade por atraso" aqui como nas rondas
// virtuais — só ausência de evidência (nRondas=0) ou de envio.
// ─────────────────────────────────────────────────────────────

const { getDb } = require("../lib/firebaseAdmin");
const { toMillis, toIsoSaoPaulo, ageDays } = require("../lib/time");
const {
  ok, fail, record, validateProjectId, resolveTargets, applyLimit, PROJECT_NAMES,
} = require("../lib/shape");

// Dias de tolerância após o encerramento do plantão antes de cobrar "não enviado".
const GRACE_DAYS = 1;

function proximaData(date) {
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function fimPlantaoMs(p) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(p.dataPlantao || ""))) return null;
  const turno = String(p.turno || "").toLowerCase();
  if (turno === "diurno") return Date.parse(`${p.dataPlantao}T18:00:00-03:00`);
  if (turno === "noturno") {
    const next = proximaData(p.dataPlantao);
    return next ? Date.parse(`${next}T06:00:00-03:00`) : null;
  }
  return null;
}

function classificarPlantao(p, nowMs = Date.now()) {
  const fimMs = fimPlantaoMs(p);
  if (fimMs == null || nowMs < fimMs) return null;

  const rondasInformadas = p.nRondas !== null && p.nRondas !== undefined && p.nRondas !== "" && Number.isFinite(Number(p.nRondas));
  const semRonda = rondasInformadas && Number(p.nRondas) <= 0;
  const rondasDesconhecidas = !rondasInformadas;
  const semLider = !p.lider || !String(p.lider).trim();
  const idade = ageDays(fimMs, nowMs);
  const naoEnviado = !p.enviado && idade > GRACE_DAYS;

  if (!semRonda && !rondasDesconhecidas && !naoEnviado && !semLider) return null; // sem lacuna

  let severity = "medium";
  const motivos = [];
  if (semRonda) { severity = "critical"; motivos.push("nenhuma ronda registrada"); }
  if (rondasDesconhecidas) motivos.push("quantidade de rondas não informada");
  if (naoEnviado) { severity = severity === "critical" ? "critical" : "high"; motivos.push(`relatório não enviado (${idade}d)`); }
  if (semLider) motivos.push("sem líder identificado");

  return { severity, motivos, idade };
}

async function get_physical_round_gaps(args = {}) {
  const v = validateProjectId(args.projectId);
  if (!v.valid) return fail("VALIDATION_ERROR", "projectId inválido.");

  const startMs = args.startDate ? toMillis(args.startDate) : null;
  const endMs = args.endDate ? toMillis(args.endDate) : null;
  const turno = args.turno ? String(args.turno).toLowerCase() : null;
  if (turno && !["diurno", "noturno"].includes(turno)) {
    return fail("VALIDATION_ERROR", "turno inválido; use diurno ou noturno.");
  }

  const targets = resolveTargets(v.id);
  const db = getDb();
  const records = [];
  const warnings = [];

  for (const pid of targets) {
    let snap;
    try {
      snap = await db.collection("rondas").doc(pid).get();
    } catch (e) {
      return fail("QUERY_FAILED", "Falha ao consultar rondas presenciais.", true);
    }
    if (!snap.exists) { warnings.push(`${pid}: sem índice de rondas presenciais.`); continue; }

    const data = snap.data() || {};
    const deletedIds = new Set(data.deletedIds || []);
    const plantoes = (Array.isArray(data.plantoes) ? data.plantoes : []).filter(p => p && !deletedIds.has(p.id));
    if (!plantoes.length) { warnings.push(`${pid}: nenhum plantão registrado.`); continue; }

    for (const p of plantoes) {
      const plantaoTurno = String(p.turno || "").toLowerCase();
      if (!["diurno", "noturno"].includes(plantaoTurno)) {
        warnings.push(`${pid}/${p.id || "?"}: turno ausente ou inválido; plantão não avaliado.`);
        continue;
      }
      if (turno && plantaoTurno !== turno) continue;
      const diaMs = toMillis(p.dataPlantao);
      if (startMs != null && (diaMs == null || diaMs < startMs)) continue;
      if (endMs != null && (diaMs == null || diaMs > endMs)) continue;

      const cls = classificarPlantao(p);
      if (!cls) continue;

      records.push(record({
        projectId: pid,
        module: "ronda_presencial",
        recordId: p.id || "",
        status: cls.motivos.join("; "),
        severity: cls.severity,
        occurredAt: diaMs != null ? toIsoSaoPaulo(diaMs) : null,
        resolvedAt: p.enviadoEm ? toIsoSaoPaulo(toMillis(p.enviadoEm)) : null,
        durationMinutes: null,
        description: `Plantão ${p.turno || "?"} de ${p.dataPlantao || "?"}: ${cls.motivos.join(", ")}.`,
        evidence: [
          `Projeto ${PROJECT_NAMES[pid] || pid}`,
          `Líder: ${p.lider || "não informado"}`,
          `Rondas registradas: ${p.nRondas ?? "não informado"}`,
          `Enviado: ${p.enviado ? "sim" : "não"}`,
        ],
        source: { collection: "rondas", recordId: `${pid}/plantoes/${p.id || "?"}` },
      }));
    }
  }

  records.sort((a, b) => Date.parse(b.occurredAt || 0) - Date.parse(a.occurredAt || 0));
  const { rows, truncated } = applyLimit(records, args.limit, 100);

  return ok({
    filters: { projectId: v.id, startDate: args.startDate || null, endDate: args.endDate || null, turno },
    summary: {
      plantoesComLacuna: records.length,
      semNenhumaRonda: records.filter(r => r.status.includes("nenhuma ronda registrada")).length,
      naoEnviados: records.filter(r => r.status.includes("não enviado")).length,
    },
    records: rows,
    dataQualityWarnings: [
      ...warnings,
      "A análise usa apenas o índice leve (nRondas/enviado/lider); ele não permite avaliar atraso de cada ronda individual.",
    ],
    truncated,
  });
}

module.exports = { get_physical_round_gaps, classificarPlantao, fimPlantaoMs, GRACE_DAYS };

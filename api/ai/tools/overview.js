// ─────────────────────────────────────────────────────────────
// tools/overview.js — get_project_status + get_operational_overview
//
// Ferramentas de agregação: chamam as ferramentas de domínio e montam
// um panorama. Não acessam Firestore diretamente (reuso + consistência).
// ─────────────────────────────────────────────────────────────

const { get_ctmk_status } = require("./ctmk");
const { get_recent_energy_events } = require("./energy");
const { get_virtual_round_nonconformities } = require("./virtualRounds");
const { get_keyaccess_failures } = require("./keyAccess");
const { get_weekly_report_items } = require("./weeklyReports");
const {
  ok, fail, validateProjectId, PROJECT_IDS, PROJECT_NAMES, SEVERITY_ORDER,
} = require("../lib/shape");

function piorSeveridade(sevs) {
  let best = "info";
  for (const s of sevs) if ((SEVERITY_ORDER[s] ?? 9) < (SEVERITY_ORDER[best] ?? 9)) best = s;
  return best;
}

async function get_project_status(args = {}) {
  const v = validateProjectId(args.projectId);
  if (!v.valid || !v.id) return fail("VALIDATION_ERROR", "projectId obrigatório e válido.");
  const pid = v.id;

  const [ctmk, energy, rounds, keyacc, equip] = await Promise.all([
    get_ctmk_status({ projectId: pid }),
    get_recent_energy_events({ projectId: pid, onlyOpen: true }),
    get_virtual_round_nonconformities({ projectId: pid, limit: 20 }),
    get_keyaccess_failures({ projectId: pid, onlyOpen: true }),
    get_weekly_report_items({ projectId: pid }),
  ]);

  const warnings = []
    .concat(ctmk.ok ? ctmk.dataQualityWarnings : ["CTMK: falha na consulta"])
    .concat(energy.ok ? energy.dataQualityWarnings : ["Energia: falha na consulta"])
    .concat(rounds.ok ? rounds.dataQualityWarnings : ["Rondas: falha na consulta"])
    .concat(keyacc.ok ? keyacc.dataQualityWarnings : ["KeyAccess: falha na consulta"])
    .concat(equip.ok ? equip.dataQualityWarnings : ["Equipamentos: falha na consulta"]);

  const sevs = [];
  if (ctmk.ok) sevs.push(...ctmk.records.map(r => r.severity));
  if (energy.ok) sevs.push(...energy.records.map(r => r.severity));
  if (rounds.ok) sevs.push(...rounds.records.map(r => r.severity));
  if (keyacc.ok) sevs.push(...keyacc.records.map(r => r.severity));
  if (equip.ok) sevs.push(...equip.records.map(r => r.severity));

  return ok({
    filters: { projectId: pid },
    summary: {
      projeto: PROJECT_NAMES[pid] || pid,
      statusGeral: piorSeveridade(sevs),
      ctmk: ctmk.ok ? (ctmk.summary.offline ? "offline" : "online") : "desconhecido",
      energiaEventosAbertos: energy.ok ? energy.summary.total : null,
      rondasComNaoConformidade: rounds.ok ? rounds.summary.turnosComNaoConformidade : null,
      keyaccessAbertas: keyacc.ok ? keyacc.summary.semTermino : null,
      equipamentosDanificados: equip.ok ? equip.summary.total : null,
      equipamentosAcima30d: equip.ok ? equip.summary.acima30dias : null,
    },
    records: [
      ...(ctmk.ok ? ctmk.records : []),
      ...(energy.ok ? energy.records : []),
      ...(rounds.ok ? rounds.records.slice(0, 5) : []),
      ...(keyacc.ok ? keyacc.records : []),
      ...(equip.ok ? equip.records.slice(0, 10) : []),
    ],
    dataQualityWarnings: warnings,
    truncated: false,
  });
}

async function get_operational_overview(args = {}) {
  const v = validateProjectId(args.projectId);
  if (!v.valid) return fail("VALIDATION_ERROR", "projectId inválido.");
  const targets = v.id ? [v.id] : PROJECT_IDS;

  const [ctmk, equip] = await Promise.all([
    get_ctmk_status({ projectId: v.id }),
    get_weekly_report_items({ projectId: v.id, olderThanDays: 30 }),
  ]);

  const projetosOffline = ctmk.ok ? ctmk.records.filter(r => r.status === "offline").map(r => ({
    projectId: r.projectId, desde: r.occurredAt, dias: r.durationMinutes != null ? Math.floor(r.durationMinutes / 1440) : null,
  })) : [];

  const inopAntigos = equip.ok ? equip.records.map(r => ({
    projectId: r.projectId, item: r.description, severity: r.severity, desde: r.occurredAt,
  })) : [];

  // Projetos que exigem atenção = têm CTMK offline OU equipamento crítico >30d.
  const atencao = new Set();
  projetosOffline.forEach(p => atencao.add(p.projectId));
  (equip.ok ? equip.records : []).filter(r => r.severity === "critical").forEach(r => atencao.add(r.projectId));

  return ok({
    filters: { projectId: v.id, startDate: args.startDate || null, endDate: args.endDate || null, severity: args.severity || null },
    summary: {
      totalProjetos: targets.length,
      projetosOffline: projetosOffline.length,
      equipamentosInopAcima30d: inopAntigos.length,
      projetosQueExigemAtencao: [...atencao],
    },
    records: [
      ...projetosOffline.map(p => ({
        projectId: p.projectId, module: "ctmk", recordId: p.projectId, status: "offline",
        severity: p.dias != null && p.dias >= 10 ? "critical" : "high",
        occurredAt: p.desde, resolvedAt: null, durationMinutes: null,
        description: `CTMK offline${p.dias != null ? ` há ${p.dias} dia(s)` : ""}.`,
        evidence: [PROJECT_NAMES[p.projectId] || p.projectId], source: { collection: "ctmk", recordId: p.projectId },
      })),
      ...(equip.ok ? equip.records.filter(r => r.severity === "critical").slice(0, 20) : []),
    ],
    dataQualityWarnings: (ctmk.ok ? ctmk.dataQualityWarnings : []).concat(equip.ok ? equip.dataQualityWarnings : []),
    truncated: false,
  });
}

module.exports = { get_project_status, get_operational_overview };

const { get_weekly_report_items } = require("./weeklyReports");
const { get_ctmk_status } = require("./ctmk");
const { get_keyaccess_failures } = require("./keyAccess");
const { get_perimeter_round_gaps } = require("./perimeterRounds");
const { get_virtual_round_nonconformities } = require("./virtualRounds");
const { get_recent_energy_events } = require("./energy");
const { ok, fail, validateProjectId, sortBySeverityThenAge } = require("../lib/shape");
const { ageDays } = require("../lib/time");

const BLOCKING = /(cancela|eclusa|bollard|bolard|pino retratil|dilacerador|garra|panico fixo|botao de panico fixo|perimetro|cerca eletr)/i;

function withAgeAndPolicy(r) {
  const age = r.occurredAt ? ageDays(Date.parse(r.occurredAt)) : null;
  let severity = r.severity;
  if (r.module === "keyaccess" && r.status === "sem término formal") severity = "critical";
  if (r.module === "equipamentos" && /INOP|CRITICO/i.test(r.status) && BLOCKING.test(r.description)) severity = "critical";
  return { ...r, severity, ageDays: age, category: r.description.split(":")[0] || r.module };
}

async function get_project_vulnerabilities(args = {}) {
  const v = validateProjectId(args.projectId);
  if (!v.valid || !v.id) return fail("VALIDATION_ERROR", "projectId obrigatório e válido.");
  const pid = v.id;
  const results = await Promise.all([
    get_weekly_report_items({ projectId: pid, limit: 150 }),
    get_ctmk_status({ projectId: pid }),
    get_keyaccess_failures({ projectId: pid, onlyOpen: true, limit: 100 }),
    get_perimeter_round_gaps({ projectId: pid, limit: 100 }),
    get_virtual_round_nonconformities({ projectId: pid, limit: 100 }),
    get_recent_energy_events({ projectId: pid, onlyOpen: true, limit: 100 }),
  ]);
  const warnings = [];
  const records = [];
  for (const result of results) {
    if (!result.ok) warnings.push(result.message || result.errorCode);
    else { records.push(...result.records); warnings.push(...(result.dataQualityWarnings || [])); }
  }
  const vulnerabilities = sortBySeverityThenAge(records.filter(r => r.status !== "online").map(withAgeAndPolicy));
  return ok({ filters: { projectId: pid }, summary: { total: vulnerabilities.length, critical: vulnerabilities.filter(r=>r.severity==="critical").length, high: vulnerabilities.filter(r=>r.severity==="high").length }, records: vulnerabilities, dataQualityWarnings: warnings });
}

module.exports = { get_project_vulnerabilities, withAgeAndPolicy };

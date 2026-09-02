// ─────────────────────────────────────────────────────────────
// tools/staffing.js — get_staffing_and_vacation_gaps
//
// Fonte real (auditada em Equipe.jsx / AcessoCCO.jsx): coleção
// `equipes/{pid}`. O documento tem `colaboradores[]` (e/ou `desligados[]`).
// Campos de colaborador variam; usamos apenas os seguros e presentes:
//   nome, cargo, status, ferias/afastamento (quando existirem).
//
// PRIVACIDADE (obrigatório): NUNCA expor telefone, documento ou dado
// pessoal desnecessário. Só nome (mínimo p/ operar), cargo e datas.
//
// Como a modelagem de férias/cobertura pode variar entre projetos, esta
// ferramenta é defensiva: reporta o que encontra e sinaliza campos
// ausentes em dataQualityWarnings, em vez de inventar estrutura.
// ─────────────────────────────────────────────────────────────

const { getDb } = require("../lib/firebaseAdmin");
const { toMillis, toIsoSaoPaulo } = require("../lib/time");
const {
  ok, fail, record, validateProjectId, resolveTargets, applyLimit, PROJECT_NAMES,
} = require("../lib/shape");

// Campos que NUNCA devem sair (defesa em profundidade).
const CAMPOS_PROIBIDOS = ["telefone", "celular", "fone", "cpf", "rg", "documento", "endereco", "email"];

function sanitizarNome(c) {
  return (c && (c.nome || c.name)) ? String(c.nome || c.name).trim() : "colaborador";
}

async function get_staffing_and_vacation_gaps(args = {}) {
  const v = validateProjectId(args.projectId);
  if (!v.valid) return fail("VALIDATION_ERROR", "projectId inválido.");

  const startMs = args.startDate ? toMillis(args.startDate) : null;
  const endMs = args.endDate ? toMillis(args.endDate) : null;
  const now = Date.now();

  const targets = resolveTargets(v.id);
  const db = getDb();
  const records = [];
  const warnings = [];
  const projectSummaries = [];

  for (const pid of targets) {
    let snap;
    try {
      snap = await db.collection("equipes").doc(pid).get();
    } catch (e) {
      return fail("QUERY_FAILED", "Falha ao consultar equipes.", true);
    }
    if (!snap.exists) continue;
    const data = snap.data() || {};
    const colaboradores = Array.isArray(data.colaboradores) ? data.colaboradores
      : Array.isArray(data.registros) ? data.registros : [];

    if (!colaboradores.length) {
      warnings.push(`${pid}: equipe sem colaboradores cadastrados.`);
      projectSummaries.push({ projectId: pid, projectName: PROJECT_NAMES[pid] || pid, totalAtivos: 0, porTurno: {}, porCargo: {}, afastamentosAbertos: 0 });
      continue;
    }

    const ativos = colaboradores.filter(c => c && typeof c === "object" && String(c.status || "ativo").toLowerCase() !== "desligado");
    const porTurno = {};
    const porCargo = {};
    let afastamentosAbertos = 0;
    for (const c of ativos) {
      const turno = String(c.turno || "Sem turno informado").trim();
      const cargo = String(c.cargo || "Sem cargo informado").trim();
      porTurno[turno] = (porTurno[turno] || 0) + 1;
      porCargo[cargo] = (porCargo[cargo] || 0) + 1;
      const historico = Array.isArray(c.historico) ? c.historico : [];
      if (c.afastamentoAberto || historico.some(h => h && h.emAberto)) afastamentosAbertos += 1;
    }
    projectSummaries.push({
      projectId: pid,
      projectName: PROJECT_NAMES[pid] || pid,
      totalAtivos: ativos.length,
      porTurno,
      porCargo,
      afastamentosAbertos,
    });

    let temCampoFerias = false;

    for (const c of colaboradores) {
      if (!c || typeof c !== "object") continue;
      if ((c.status || "").toLowerCase() === "desligado") continue;

      // Detecta férias/afastamento por campos comuns, sem inventar.
      const iniF = c.feriasInicio || c.inicioFerias || (c.ferias && c.ferias.inicio);
      const fimF = c.feriasFim || c.fimFerias || (c.ferias && c.ferias.fim);
      const afast = c.afastamento || c.afastado;

      if (iniF || fimF || afast) {
        temCampoFerias = true;
        const iniMs = toMillis(iniF), fimMs = toMillis(fimF);

        if (startMs != null && fimMs != null && fimMs < startMs) continue;
        if (endMs != null && iniMs != null && iniMs > endMs) continue;

        let estado = "férias/afastamento";
        if (fimMs != null && fimMs < now) estado = "concluída (verificar se ainda projetada)";
        else if (iniMs != null && iniMs <= now && (fimMs == null || fimMs >= now)) estado = "em andamento";
        else if (iniMs != null && iniMs > now) estado = "futura";

        const cobertura = c.cobertura || c.substituto || (c.ferias && c.ferias.cobertura) || null;
        const semCobertura = !cobertura;

        records.push(record({
          projectId: pid,
          module: "equipe",
          recordId: sanitizarNome(c),
          status: semCobertura ? "sem cobertura definida" : "com cobertura",
          severity: semCobertura && estado === "em andamento" ? "high" : "medium",
          occurredAt: iniMs != null ? toIsoSaoPaulo(iniMs) : null,
          resolvedAt: fimMs != null ? toIsoSaoPaulo(fimMs) : null,
          durationMinutes: null,
          description: `${sanitizarNome(c)}${c.cargo ? ` (${c.cargo})` : ""}: ${estado}${semCobertura ? " — sem cobertura definida" : ` — cobertura: ${cobertura}`}.`,
          evidence: [`Projeto ${PROJECT_NAMES[pid] || pid}`].filter(Boolean),
          source: { collection: "equipes", recordId: pid },
        }));
      }
    }

    if (!temCampoFerias) {
      warnings.push(`${pid}: sem campos de férias/afastamento na estrutura da equipe — não é possível avaliar coberturas.`);
    }
  }

  const { rows, truncated } = applyLimit(records, args.limit, 100);

  return ok({
    filters: { projectId: v.id, startDate: args.startDate || null, endDate: args.endDate || null },
    summary: {
      total: records.length,
      semCobertura: records.filter(r => r.status === "sem cobertura definida").length,
      emAndamento: records.filter(r => /em andamento/.test(r.description)).length,
      totalColaboradoresAtivos: projectSummaries.reduce((sum, p) => sum + p.totalAtivos, 0),
      projetos: projectSummaries,
    },
    records: rows,
    dataQualityWarnings: warnings.concat(["Privacidade: telefones e documentos pessoais não são retornados."]),
    truncated,
  });
}

module.exports = { get_staffing_and_vacation_gaps, CAMPOS_PROIBIDOS };

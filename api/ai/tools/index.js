// ─────────────────────────────────────────────────────────────
// tools/index.js — Registro de ferramentas: schemas OpenAI + dispatcher
//
// O modelo só pode chamar as funções declaradas aqui. Nenhuma delas
// aceita nome de coleção, caminho Firestore ou consulta arbitrária —
// apenas parâmetros validados. Escrita é impossível (só há leitura).
// ─────────────────────────────────────────────────────────────

const { get_ctmk_status } = require("./ctmk");
const { get_recent_energy_events } = require("./energy");
const { get_virtual_round_nonconformities } = require("./virtualRounds");
const { get_perimeter_round_gaps } = require("./perimeterRounds");
const { get_keyaccess_failures } = require("./keyAccess");
const { get_weekly_report_items } = require("./weeklyReports");
const { get_staffing_and_vacation_gaps } = require("./staffing");
const { get_project_status, get_operational_overview } = require("./overview");
const { get_health_ranking } = require("./health");
const { get_project_vulnerabilities } = require("./vulnerabilities");
const { fail } = require("../lib/shape");

const HANDLERS = {
  get_operational_overview,
  get_project_status,
  get_ctmk_status,
  get_recent_energy_events,
  get_virtual_round_nonconformities,
  get_perimeter_round_gaps,
  get_keyaccess_failures,
  get_weekly_report_items,
  get_staffing_and_vacation_gaps,
  get_health_ranking,
  get_project_vulnerabilities,
};

const projectIdParam = { type: "string", description: "ID do projeto (P601, P602, P604, P605, P606, P607, P311A, P311B, P505, P260A, P260B, P260C). Omitir = todos." };
const dateParam = (d) => ({ type: "string", description: `${d} (YYYY-MM-DD).` });
const limitParam = { type: "integer", description: "Máximo de registros (limitado pelo servidor)." };

// Schemas no formato OpenAI (tools / function calling).
const TOOL_SCHEMAS = [
  {
    type: "function",
    function: {
      name: "get_health_ranking",
      description: "Ranking de saúde dos projetos pela mesma fórmula do dashboard/checklist. Retorna total, INOP, parcial, percentual e categorias que mais pesam.",
      parameters: { type: "object", properties: { order: { type: "string", enum: ["worst", "best"], description: "worst=pior para melhor; best=melhor para pior." } } },
    },
  },
  {
    type: "function",
    function: {
      name: "get_project_vulnerabilities",
      description: "Explica as vulnerabilidades de um projeto por severidade e idade: equipamentos, CTMK, KeyAccess, rondas e energia.",
      parameters: { type: "object", properties: { projectId: projectIdParam }, required: ["projectId"] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_operational_overview",
      description: "Panorama operacional atual de todos os projetos (ou de um): criticidade, offline, INOP antigos, projetos que exigem atenção.",
      parameters: { type: "object", properties: { projectId: projectIdParam, startDate: dateParam("Início"), endDate: dateParam("Fim"), severity: { type: "string", enum: ["critical", "high", "medium", "low", "info"] } } },
    },
  },
  {
    type: "function",
    function: {
      name: "get_project_status",
      description: "Situação consolidada de UM projeto: CTMK, energia, rondas, KeyAccess, equipamentos danificados e pendências.",
      parameters: { type: "object", properties: { projectId: projectIdParam }, required: ["projectId"] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_ctmk_status",
      description: "Status da CTMK (central de câmera Moked) por projeto: online/offline, desde quando, tempo desconectado. Ordena maior tempo offline primeiro.",
      parameters: { type: "object", properties: { projectId: projectIdParam, status: { type: "string", enum: ["online", "offline", "partial", "unknown"] }, limit: limitParam } },
    },
  },
  {
    type: "function",
    function: {
      name: "get_recent_energy_events",
      description: "Ocorrências de energia (quedas): início, término, duração, normalização. Sinaliza eventos sem encerramento formal.",
      parameters: { type: "object", properties: { projectId: projectIdParam, startDate: dateParam("Início"), endDate: dateParam("Fim"), onlyOpen: { type: "boolean", description: "Só eventos sem término." }, limit: limitParam } },
    },
  },
  {
    type: "function",
    function: {
      name: "get_virtual_round_nonconformities",
      description: "Não conformidades das rondas virtuais (CFTV) em turnos arquivados: previstas, feitas, atrasadas, horários sem evidência. Não classifica turno em andamento como falta.",
      parameters: { type: "object", properties: { projectId: projectIdParam, startDate: dateParam("Início"), endDate: dateParam("Fim"), shift: { type: "string", enum: ["noturno", "diurno"] }, nonconformityType: { type: "string", enum: ["atraso", "falta", "sem_evidencia"] }, limit: limitParam } },
    },
  },
  {
    type: "function",
    function: {
      name: "get_perimeter_round_gaps",
      description: "Falhas de teste perimetral por zona. Plantões em andamento não contam como falta.",
      parameters: { type: "object", properties: { projectId: projectIdParam, startDate: dateParam("Início"), endDate: dateParam("Fim"), shift: { type: "string", enum: ["noturno", "diurno"] } } },
    },
  },
  {
    type: "function",
    function: {
      name: "get_keyaccess_failures",
      description: "Falhas do KeyAccess (controle de acesso terceiro): início, fim, duração, normalização. Detecta falhas sem término formal.",
      parameters: { type: "object", properties: { projectId: projectIdParam, startDate: dateParam("Início"), endDate: dateParam("Fim"), onlyOpen: { type: "boolean", description: "Só falhas sem término." }, limit: limitParam } },
    },
  },
  {
    type: "function",
    function: {
      name: "get_weekly_report_items",
      description: "Equipamentos INOP/parciais e idade da pendência. Use olderThanDays=30 para 'INOP há mais de 30 dias'.",
      parameters: { type: "object", properties: { projectId: projectIdParam, status: { type: "string", enum: ["inop", "critico", "parcial", "baixo"] }, olderThanDays: { type: "integer" }, limit: limitParam } },
    },
  },
  {
    type: "function",
    function: {
      name: "get_staffing_and_vacation_gaps",
      description: "Consulta EQUIPE e EFETIVO de um projeto: total de colaboradores ativos, distribuição por turno e cargo, faltas, afastamentos, férias e coberturas. Use também para perguntas gerais como 'fale sobre a equipe do P311B'. Retorna resumo útil mesmo sem lacunas. Não expõe telefone nem documentos pessoais.",
      parameters: { type: "object", properties: { projectId: projectIdParam, startDate: dateParam("Início"), endDate: dateParam("Fim") } },
    },
  },
];

// Dispatcher seguro: só executa handlers conhecidos; nunca eval/consulta livre.
async function runTool(name, args) {
  const handler = HANDLERS[name];
  if (!handler) return fail("NOT_FOUND", `Ferramenta desconhecida: ${name}`);
  try {
    const parsed = typeof args === "string" ? JSON.parse(args || "{}") : (args || {});
    return await handler(parsed);
  } catch (e) {
    return fail("QUERY_FAILED", "Falha ao executar a ferramenta.", true);
  }
}

module.exports = { TOOL_SCHEMAS, runTool, HANDLERS };

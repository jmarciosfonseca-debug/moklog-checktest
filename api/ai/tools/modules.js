// ─────────────────────────────────────────────────────────────
// tools/modules.js — query_module: leitura genérica e SEGURA dos
// módulos que não têm ferramenta específica.
//
// Catálogo fechado (MODULES): cada entrada fixa a coleção, o campo onde
// os registros vivem, o campo de data, os projetos onde o módulo existe e
// a LISTA BRANCA de campos que podem sair. Nada fora do catálogo é lido;
// campos fora da lista branca (nomes, documentos, telefones, fotos,
// assinaturas, contatos) nunca são devolvidos. Somente leitura.
//
// Formatos auditados nos componentes (AcessoCCO.jsx, BodycamSection.jsx,
// TempoGravacao.jsx, Ocorrencias.jsx, Ambulancia.jsx, Bolsao.jsx,
// Iluminacao.jsx, Inquilinos.jsx/App.jsx, RondaVSPP.jsx, Acesso.jsx).
// ─────────────────────────────────────────────────────────────

const { getDb } = require("../lib/firebaseAdmin");
const { toMillis, toIsoSaoPaulo } = require("../lib/time");
const { ok, fail, validateProjectId, PROJECT_IDS, PROJECT_NAMES } = require("../lib/shape");

const MEGA = ["P311A", "P311B"];
const COM_CCO = PROJECT_IDS.filter((p) => p !== "P260B" && p !== "P260C");

// kind: "list"     → documento {pid} com array em `field`, filtrado por período
//       "snapshot" → documento {pid} com o estado atual (sem período)
const MODULES = {
  cco_acesso: {
    label: "CCO — Acesso", kind: "list", col: "acesso_cco", field: "registros", date: "data",
    projects: COM_CCO, fields: ["data", "horaEntrada", "empresa", "arquivado"], groupBy: "empresa",
    synonyms: "acesso ao CCO, entrada na central, visitantes do CCO",
  },
  cco_intervalo: {
    label: "CCO — Intervalos", kind: "list", col: "cco_intervalo", field: "registros", date: "data",
    projects: COM_CCO, fields: ["data", "turno", "arquivado"], groupBy: "turno",
    synonyms: "intervalo, pausa, café, almoço da equipe do CCO",
  },
  cco_supervisao: {
    label: "CCO — Supervisão", kind: "list", col: "cco_supervisao", field: "registros", date: "data",
    projects: COM_CCO, fields: ["data", "turno", "chegada", "saida", "resumo", "arquivado"], groupBy: "turno",
    synonyms: "visita de supervisão, supervisor no posto",
  },
  cco_manutencao: {
    label: "CCO — Manutenção", kind: "list", col: "cco_manutencao", field: "registros", date: "data",
    projects: COM_CCO, fields: ["data", "empresa", "sistema", "status", "turno", "servico", "arquivado"], groupBy: "sistema",
    synonyms: "visita de manutenção, técnico, manutenção de sistema",
  },
  cco_bodycam: {
    label: "CCO — Bodycam", kind: "list", col: "cco_bodycam", field: "registros", date: "dia",
    projects: ["P311A"], fields: ["dia", "tipo"], groupBy: "tipo",
    synonyms: "bodycam, câmera corporal, falta de bodycam",
  },
  cftv_gravacao: {
    label: "CFTV — Tempo de gravação", kind: "snapshot", col: "cftv_gravacao", field: "cameras",
    projects: COM_CCO, fields: ["nome", "diasGravacao", "ultimaChecagem"],
    synonyms: "dias de gravação, retenção de imagens, câmeras gravando",
  },
  rs_ocorrencias: {
    label: "Registro Situacional (RS) do app", kind: "list", col: "ocorrencias", field: "registros", date: "dataHora",
    projects: PROJECT_IDS, fields: ["dataHora", "natureza", "subtipo", "severidade", "local", "resumo", "reincidente"], groupBy: "natureza",
    synonyms: "RS, ocorrência, registro situacional",
  },
  ambulancia: {
    label: "Acesso de Ambulância", kind: "list", col: "ambulancias", field: "registros", date: "data", subcollection: "registros",
    projects: MEGA, fields: ["data", "turno", "horaEntrada", "horaSaida", "inquilino", "tipo", "gravidade", "vitimaRemovida"], groupBy: "inquilino",
    synonyms: "ambulância, atendimento de saúde, mal súbito, remoção",
  },
  acesso_transportadoras: {
    label: "Acesso de Transportadoras", kind: "list", col: "acesso", field: "registros", date: "data",
    projects: ["P260A"], fields: ["data", "transportadora", "placa", "entradaPatio", "saidaPatio"], groupBy: "transportadora",
    synonyms: "transportadora, caminhão no pátio",
  },
  ronda_vspp: {
    label: "Ronda VSPP", kind: "list", col: "ronda_vspp", field: "registros", date: "data",
    projects: ["P601"], fields: ["data"],
    synonyms: "ronda VSPP, ronda hora a hora",
  },
  bolsao: {
    label: "Fiscalização de Bolsão", kind: "snapshot", col: "bolsao", field: "placas",
    projects: MEGA, fields: ["placa", "status", "diasConsecutivos", "bloqueado"],
    synonyms: "bolsão, placas, caminhão estacionado, pernoite",
  },
  iluminacao: {
    label: "Teste de Iluminação", kind: "snapshot", col: "iluminacao", field: "quadrantes",
    projects: PROJECT_IDS, fields: ["nome", "total", "deficientes", "atualizadoEm"],
    synonyms: "iluminação, lâmpadas, pontos de luz, quadrantes",
  },
  inquilinos: {
    label: "Inquilinos / Galpões", kind: "snapshot", col: "inquilinos", field: "unidades",
    projects: PROJECT_IDS.filter((p) => !/^P260/.test(p)), fields: ["tipo", "nome", "inquilino", "status", "docas", "opera24h"],
    synonyms: "inquilinos, galpões, armazéns, ocupação",
  },
};

// Registro de teste não entra nas contagens (ex.: "Fonseca teste").
function isTeste(r) {
  if (r && r.teste === true) return true;
  const txt = [r && r.paciente, r && r.observacao, r && r.obs].filter(Boolean).join(" ");
  return /\bteste\b/i.test(txt);
}

function pick(r, fields) {
  const o = {};
  for (const f of fields) if (r[f] !== undefined && r[f] !== "") o[f] = r[f];
  return o;
}

function countBy(rows, key) {
  const out = {};
  for (const r of rows) {
    const k = (r[key] == null || r[key] === "") ? "não informado" : String(r[key]).trim();
    out[k] = (out[k] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1]));
}

async function readList(db, cfg, pid) {
  const snap = await db.collection(cfg.col).doc(pid).get();
  let rows = snap.exists ? ((snap.data() || {})[cfg.field] || []) : [];
  if (!Array.isArray(rows)) rows = [];
  if (cfg.subcollection) {
    const sub = await db.collection(cfg.col).doc(pid).collection(cfg.subcollection).get();
    const ids = new Set(rows.map((r) => r && r.id));
    sub.forEach((d) => { const r = { id: d.id, ...d.data() }; if (!ids.has(r.id)) rows.push(r); });
  }
  return rows;
}

function summarizeSnapshot(key, rows, data) {
  if (key === "cftv_gravacao") {
    const med = rows.filter((c) => typeof c.diasGravacao === "number");
    return {
      cameras: rows.length, aferidas: med.length,
      criticas_menos15d: med.filter((c) => c.diasGravacao < 15).length,
      atencao_15a29d: med.filter((c) => c.diasGravacao >= 15 && c.diasGravacao < 30).length,
    };
  }
  if (key === "bolsao") {
    return {
      placas: rows.length, porStatus: countBy(rows, "status"),
      bloqueadas: rows.filter((p) => p.bloqueado).length,
    };
  }
  if (key === "iluminacao") {
    const total = rows.reduce((s, q) => s + (Number(q.total) || 0), 0);
    const def = rows.reduce((s, q) => s + (Number(q.deficientes) || 0), 0);
    const ult = data && data.testeQuinzenal && data.testeQuinzenal.ultimoRegistro;
    return {
      quadrantes: rows.length, pontos: total, deficientes: def,
      operantesPct: total ? Math.round(((total - def) / total) * 1000) / 10 : null,
      ultimoTesteQuinzenal: ult ? ult.data : null,
    };
  }
  if (key === "inquilinos") {
    return { unidades: rows.length, porStatus: countBy(rows, "status") };
  }
  return { total: rows.length };
}

async function query_module(args = {}) {
  const key = String(args.module || "").trim();
  const cfg = MODULES[key];
  if (!cfg) return fail("NOT_FOUND", `Módulo desconhecido: ${key || "(vazio)"}. Válidos: ${Object.keys(MODULES).join(", ")}.`);

  const v = validateProjectId(args.projectId);
  if (!v.valid) return fail("VALIDATION_ERROR", "projectId inválido.");
  if (v.id && !cfg.projects.includes(v.id)) {
    return ok({
      filters: { module: key, projectId: v.id },
      summary: { moduloExisteNoProjeto: false, mensagem: `O módulo ${cfg.label} não existe no ${v.id}. Existe em: ${cfg.projects.join(", ")}.` },
    });
  }
  const targets = v.id ? [v.id] : cfg.projects;
  const startMs = args.startDate ? toMillis(args.startDate) : null;
  const endMs = args.endDate ? toMillis(args.endDate) : null;
  const endIncl = endMs != null ? endMs + 12 * 3600 * 1000 : null; // data-only ancora 12h → inclui o dia todo
  const cap = Math.min(Math.max(1, args.limit || 20), 100);

  const db = getDb();
  const porProjeto = {};
  const records = [];
  const warnings = [];

  for (const pid of targets) {
    try {
      if (cfg.kind === "snapshot") {
        const snap = await db.collection(cfg.col).doc(pid).get();
        const data = snap.exists ? (snap.data() || {}) : {};
        let rows = data[cfg.field] || [];
        if (!Array.isArray(rows)) rows = Object.entries(rows).map(([k, val]) => ({ placa: k, ...val }));
        if (!snap.exists) warnings.push(`${pid}: sem dados no módulo.`);
        porProjeto[pid] = summarizeSnapshot(key, rows, data);
        if (key === "bolsao") rows = rows.sort((a, b) => (b.diasConsecutivos || 0) - (a.diasConsecutivos || 0));
        for (const r of rows) records.push({ projectId: pid, ...pick(r, cfg.fields) });
      } else {
        const all = await readList(db, cfg, pid);
        let excluidosTeste = 0;
        const rows = [];
        for (const r of all) {
          if (!r) continue;
          if (isTeste(r)) { excluidosTeste++; continue; }
          const ms = toMillis(r[cfg.date]);
          if (startMs != null && (ms == null || ms < startMs - 12 * 3600 * 1000)) continue;
          if (endIncl != null && (ms == null || ms > endIncl)) continue;
          rows.push({ r, ms });
        }
        rows.sort((a, b) => (b.ms || 0) - (a.ms || 0));
        const resumo = { total: rows.length };
        if (cfg.groupBy) resumo.por = { campo: cfg.groupBy, contagem: countBy(rows.map((x) => x.r), cfg.groupBy) };
        if (excluidosTeste) resumo.registrosDeTesteExcluidos = excluidosTeste;
        if (rows.length) {
          resumo.maisAntigo = rows[rows.length - 1].ms ? toIsoSaoPaulo(rows[rows.length - 1].ms) : null;
          resumo.maisRecente = rows[0].ms ? toIsoSaoPaulo(rows[0].ms) : null;
        }
        if (key === "ronda_vspp") {
          let prev = 0, feitas = 0;
          for (const { r } of rows) for (const m of Object.values(r.marcacoes || {})) { prev++; if (m && m.status && m.status !== "falta") feitas++; }
          resumo.horariosMarcados = prev; resumo.horariosCumpridos = feitas;
        }
        porProjeto[pid] = resumo;
        for (const { r } of rows) records.push({ projectId: pid, ...pick(r, cfg.fields) });
      }
    } catch (e) {
      warnings.push(`${pid}: falha ao consultar ${cfg.label}.`);
    }
  }

  const total = Object.values(porProjeto).reduce((s, x) => s + (x.total || 0), 0);
  return ok({
    filters: {
      module: key, label: cfg.label, projectId: v.id, projetosConsultados: targets,
      startDate: cfg.kind === "list" ? (args.startDate || null) : "estado atual",
      endDate: cfg.kind === "list" ? (args.endDate || null) : "estado atual",
    },
    summary: { moduloExisteNoProjeto: true, total: cfg.kind === "list" ? total : undefined, porProjeto, projetos: Object.fromEntries(targets.map((p) => [p, PROJECT_NAMES[p] || p])) },
    records: records.slice(0, cap),
    dataQualityWarnings: warnings,
    truncated: records.length > cap,
  });
}

const QUERY_MODULE_SCHEMA = {
  type: "function",
  function: {
    name: "query_module",
    description: "Consulta genérica e somente leitura dos módulos sem ferramenta específica: CCO (acesso, intervalos, supervisão, manutenção, bodycam), tempo de gravação do CFTV, RS do app, ambulância, acesso de transportadoras, Ronda VSPP, bolsão, iluminação e inquilinos. Responde se o módulo não existe no projeto. Não devolve nomes, documentos, telefones nem fotos.",
    parameters: {
      type: "object",
      properties: {
        module: { type: "string", enum: Object.keys(MODULES), description: Object.entries(MODULES).map(([k, m]) => `${k} = ${m.label} (${m.synonyms}; projetos: ${m.projects.join("/")})`).join(" | ") },
        projectId: { type: "string", description: "ID do projeto. Omitir = todos os projetos onde o módulo existe." },
        startDate: { type: "string", description: "Início (YYYY-MM-DD). Ignorado em módulos de estado atual (cftv_gravacao, bolsao, iluminacao, inquilinos)." },
        endDate: { type: "string", description: "Fim (YYYY-MM-DD)." },
        limit: { type: "integer", description: "Máximo de registros de exemplo (padrão 20, máx. 100)." },
      },
      required: ["module"],
    },
  },
};

module.exports = { query_module, QUERY_MODULE_SCHEMA, MODULES, isTeste, countBy };

const { getDb } = require("../lib/firebaseAdmin");
const { toMillis, toIsoSaoPaulo } = require("../lib/time");
const { ok, fail, record, validateProjectId, resolveTargets, applyLimit, PROJECT_NAMES } = require("../lib/shape");

function safeName(value) {
  return String(value?.nome || value?.name || "Colaborador sem nome").trim();
}

function isLeader(person, collaborators) {
  const role = String(person?.cargo || "");
  if (/l[íi]der/i.test(role)) return true;
  const hasFormalLeader = collaborators.some(item => /l[íi]der/i.test(String(item?.cargo || "")));
  return /ronda/i.test(role) && !hasFormalLeader;
}

async function readTeamDocument(db, projectId) {
  try {
    const snap = await db.collection("equipes").doc(projectId).get();
    return snap.exists ? { ok: true, data: snap.data() || {} } : { ok: true, data: null };
  } catch {
    return { ok: false };
  }
}

async function get_staff_departures(args = {}) {
  const validation = validateProjectId(args.projectId);
  if (!validation.valid) return fail("VALIDATION_ERROR", "projectId inválido.");
  const startMs = args.startDate ? toMillis(args.startDate) : null;
  const endMs = args.endDate ? toMillis(args.endDate) : null;
  const db = getDb();
  const records = [];
  const warnings = [];

  for (const projectId of resolveTargets(validation.id)) {
    const loaded = await readTeamDocument(db, projectId);
    if (!loaded.ok) return fail("QUERY_FAILED", "Falha ao consultar desligamentos da equipe.", true);
    if (!loaded.data) { warnings.push(`${projectId}: equipe não cadastrada.`); continue; }
    const departures = Array.isArray(loaded.data.desligados) ? loaded.data.desligados : [];
    if (!departures.length) warnings.push(`${projectId}: sem desligamentos registrados.`);
    for (const person of departures) {
      const occurredMs = toMillis(person?.desligadoEm);
      if (occurredMs == null) warnings.push(`${projectId}: desligamento sem data válida.`);
      if (startMs != null && (occurredMs == null || occurredMs < startMs)) continue;
      if (endMs != null && (occurredMs == null || occurredMs > endMs)) continue;
      records.push(record({
        projectId,
        module: "equipe_desligamentos",
        recordId: `${projectId}-${occurredMs || "sem-data"}-${records.length + 1}`,
        status: "desligado",
        severity: "info",
        occurredAt: occurredMs == null ? null : toIsoSaoPaulo(occurredMs),
        description: `${safeName(person)}${person?.cargo ? ` (${String(person.cargo)})` : ""}: ${String(person?.tipoDesligamento || "Desligamento")}.`,
        evidence: [`Projeto ${PROJECT_NAMES[projectId] || projectId}`],
        source: { collection: "equipes", recordId: projectId },
      }));
    }
  }
  records.sort((a, b) => Date.parse(b.occurredAt || 0) - Date.parse(a.occurredAt || 0));
  const { rows, truncated } = applyLimit(records, args.limit, 100);
  return ok({
    filters: { projectId: validation.id, startDate: args.startDate || null, endDate: args.endDate || null },
    summary: { totalDesligamentos: records.length }, records: rows,
    dataQualityWarnings: warnings.concat(["Privacidade: motivo livre, telefones e documentos pessoais não são retornados."]), truncated,
  });
}

async function get_team_composition(args = {}) {
  const validation = validateProjectId(args.projectId);
  if (!validation.valid) return fail("VALIDATION_ERROR", "projectId inválido.");
  const requestedShift = args.shift ? String(args.shift).toLowerCase() : null;
  const db = getDb();
  const records = [];
  const warnings = [];

  for (const projectId of resolveTargets(validation.id)) {
    const loaded = await readTeamDocument(db, projectId);
    if (!loaded.ok) return fail("QUERY_FAILED", "Falha ao consultar composição das equipes.", true);
    if (!loaded.data) { warnings.push(`${projectId}: equipe não cadastrada.`); continue; }
    const all = Array.isArray(loaded.data.colaboradores) ? loaded.data.colaboradores : [];
    const active = all.filter(person => person && String(person.status || "ativo").toLowerCase() !== "desligado");
    const leaders = active.filter(person => isLeader(person, active));
    for (const leader of leaders) {
      const shift = String(leader.turno || "Sem turno informado");
      if (requestedShift && shift.toLowerCase() !== requestedShift) continue;
      const linkedMembers = active.filter(person => person.equipeLiderId && person.equipeLiderId === leader.id);
      const members = requestedShift
        ? linkedMembers.filter(person => String(person.turno || "").toLowerCase() === requestedShift)
        : linkedMembers;
      const crossShift = linkedMembers.length - members.length;
      if (crossShift) warnings.push(`${projectId}: ${crossShift} membro(s) vinculado(s) ao líder ${safeName(leader)} ficaram fora por pertencerem a outro turno.`);
      records.push(record({
        projectId,
        module: "equipe_composicao",
        recordId: `${projectId}-${leader.id || safeName(leader)}`,
        status: members.length ? "equipe montada" : "líder sem membros vinculados",
        severity: members.length ? "info" : "medium",
        description: `Líder ${safeName(leader)} (${leader.cargo || "cargo não informado"}), turno ${shift}: ${members.length} membro(s).`,
        evidence: members.map(member => `${safeName(member)} — ${member.cargo || "cargo não informado"} — ${member.turno || "turno não informado"}`),
        source: { collection: "equipes", recordId: projectId },
      }));
    }
    const unassigned = active.filter(person => !isLeader(person, active) && !person.equipeLiderId);
    if (unassigned.length) warnings.push(`${projectId}: ${unassigned.length} colaborador(es) ativo(s) sem líder vinculado.`);
    if (!leaders.length) warnings.push(`${projectId}: nenhum líder identificável por cargo.`);
  }
  const { rows, truncated } = applyLimit(records, args.limit, 100);
  return ok({
    filters: { projectId: validation.id, shift: requestedShift },
    summary: { totalEquipes: records.length, totalMembrosVinculados: records.reduce((sum, item) => sum + item.evidence.length, 0) },
    records: rows,
    dataQualityWarnings: warnings.concat(["A ferramenta informa a composição cadastrada; não confirma quem está de plantão em uma data específica.", "Privacidade: telefones e documentos pessoais não são retornados."]),
    truncated,
  });
}

module.exports = { get_staff_departures, get_team_composition, isLeader };

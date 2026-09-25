export const DRAFT_SCHEMA_VERSION = 1;

export function draftKey(projectId, catalogoId) {
  return `moklog_diagnostico_draft_v${DRAFT_SCHEMA_VERSION}_${projectId}_${catalogoId}`;
}
export function calcularProgresso(itens, respostas, catalogo) {
  const excluem = new Set(catalogo?.statusQueExcluemDenominador || ["na"]);
  const naoAvaliados = new Set(catalogo?.statusQueNaoContamComoAvaliados || ["na", "sem_dado"]);
  let denominador = 0;
  let avaliados = 0;

  for (const item of itens || []) {
    const status = respostas?.[item.id]?.status || "";
    const entraPorPadrao = item.aplicavelPadrao !== false;
    const marcadoAplicavel = !!status && !excluem.has(status);
    if (!entraPorPadrao && !marcadoAplicavel) continue;
    if (excluem.has(status)) continue;
    denominador += 1;
    if (status && !naoAvaliados.has(status)) avaliados += 1;
  }

  return {
    avaliados,
    denominador,
    percentual: denominador ? Math.round((avaliados / denominador) * 100) : 0,
  };
}

export function lerRascunho(projectId, catalogoId, storage = window.localStorage) {
  try {
    const raw = storage.getItem(draftKey(projectId, catalogoId));
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data?.schemaVersion === DRAFT_SCHEMA_VERSION ? data : null;
  } catch (_) {
    return null;
  }
}

export function salvarRascunho(projectId, catalogoId, respostas, storage = window.localStorage) {
  const data = {
    schemaVersion: DRAFT_SCHEMA_VERSION,
    projectId,
    catalogoId,
    respostas,
    atualizadoEm: new Date().toISOString(),
  };
  storage.setItem(draftKey(projectId, catalogoId), JSON.stringify(data));
  return data;
}

export function limparRascunho(projectId, catalogoId, storage = window.localStorage) {
  storage.removeItem(draftKey(projectId, catalogoId));
}

// ─────────────────────────────────────────────────────────────
// Histórico de pendências de equipamento (Marcio, 18/11/2026: "o cliente pergunta quais foram as últimas
// pendências… isso demorou X dias, aquilo Y, isso ainda está em aberto").
// Até hoje, ao resolver, o app apagava dataProblem/justificativa e a pendência sumia sem rastro.
// Agora cada item guarda `ocorrencias`: [{abertaEm, status, justificativa, fechadaEm?, fechadaPor?}].
// Puro e aditivo: só mexe em itens cujo status/data/justificativa mudou; não toca no resto do cadastro.
// ─────────────────────────────────────────────────────────────
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const hojeISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const aberto = (i) => !!i && !!i.status && i.status !== "ok";

// Dias inteiros entre duas datas YYYY-MM-DD (ancoradas ao meio-dia local, como em pendencias.js).
export function diasEntre(de, ate) {
  if (!ISO.test(String(de || "")) || !ISO.test(String(ate || ""))) return null;
  return Math.max(0, Math.round((new Date(ate + "T12:00:00").getTime() - new Date(de + "T12:00:00").getTime()) / 86400000));
}

export function reconciliarItem(antes, depois, { agora = new Date(), por = "" } = {}) {
  if (!depois) return depois;
  const mudou = !antes || antes.status !== depois.status || antes.dataProblem !== depois.dataProblem || antes.justificativa !== depois.justificativa;
  if (!mudou) return depois;
  const hoje = hojeISO(agora);
  const lista = [...(Array.isArray(depois.ocorrencias) ? depois.ocorrencias : Array.isArray(antes && antes.ocorrencias) ? antes.ocorrencias : [])];
  let idx = -1;
  for (let k = lista.length - 1; k >= 0; k--) if (!lista[k].fechadaEm) { idx = k; break; }
  if (aberto(depois)) {
    const abertaEm = ISO.test(depois.dataProblem || "") ? depois.dataProblem : hoje;
    if (idx < 0) lista.push({ abertaEm, status: depois.status, justificativa: depois.justificativa || "" });
    else lista[idx] = { ...lista[idx], abertaEm, status: depois.status, justificativa: depois.justificativa || lista[idx].justificativa || "" };
  } else if (aberto(antes)) {
    const fecha = { fechadaEm: hoje, ...(por ? { fechadaPor: por } : {}) };
    if (idx >= 0) lista[idx] = { ...lista[idx], ...fecha };
    else lista.push({ abertaEm: ISO.test(antes.dataProblem || "") ? antes.dataProblem : hoje, status: antes.status, justificativa: antes.justificativa || "", ...fecha });
  } else return depois;
  return { ...depois, ocorrencias: lista };
}

// Lista de itens (categoria) — casa por id; item sem par é novo.
export function reconciliarLista(antes, depois, opc) {
  if (!Array.isArray(depois)) return depois;
  const mapa = new Map((Array.isArray(antes) ? antes : []).filter(Boolean).map((x) => [String(x.id), x]));
  return depois.map((d) => (d && d.id !== undefined ? reconciliarItem(mapa.get(String(d.id)), d, opc) : d));
}

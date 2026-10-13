// followups.js — Gestão de tratativas (follow-up) das pendências de equipamentos.
//
// Os follow-ups são guardados numa LISTA `registros: [{ key, entries, ... }]`,
// NÃO como objeto com chaves dinâmicas. Isso evita o erro do Firestore
// "o.indexOf is not a function", que ocorre quando um nome de campo começa com
// número (ex.: chave "04cancelas..."). Aqui a chave é sempre um VALOR.

import { doc, getDoc } from "firebase/firestore";
import { setDoc } from "./fireGuard";

// Normaliza o identificador de um item para casar variações ("CF35" == "CF 35").
export function canonicalFollowupKey(project, cat, item) {
  const norm = (v) => String(v ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${norm(cat)}__${norm(item)}`;
}

// Status possíveis de uma tratativa (ordem lógica de um chamado).
export const FOLLOWUP_STATUS = [
  { id: "aguardando", label: "Aguardando retorno", color: "#f59e0b" },
  { id: "proposta",   label: "Proposta enviada",   color: "#38bdf8" },
  { id: "aprovado",   label: "Aprovado",           color: "#a78bfa" },
  { id: "execucao",   label: "Em execução",        color: "#f5b942" },
  { id: "executado",  label: "Serviço executado (validar)", color: "#22d3ee" },
  { id: "reprovado",  label: "Reprovado pela administração", color: "#ef4444" },
  { id: "resolvido",  label: "Resolvido",          color: "#3fbf7f" },
];
export const statusInfo = (id) => FOLLOWUP_STATUS.find(s => s.id === id) || FOLLOWUP_STATUS[0];

// Converte a lista de registros do Firestore num mapa { [key]: registro } para a UI.
// Aceita também o formato antigo (objeto itens) por retrocompatibilidade.
function listaParaMapa(data) {
  const mapa = {};
  if (Array.isArray(data && data.registros)) {
    data.registros.forEach(r => { if (r && r.key) mapa[r.key] = r; });
  } else if (data && data.itens && typeof data.itens === "object") {
    Object.entries(data.itens).forEach(([k, v]) => { mapa[k] = { key: k, ...v }; });
  }
  return mapa;
}

// Carrega os follow-ups de um projeto como mapa { [key]: {entries, statusAtual, ...} }.
export async function loadFollowups(db, projectId) {
  try {
    const snap = await getDoc(doc(db, "followups", projectId));
    if (snap.exists()) return listaParaMapa(snap.data());
  } catch (e) { console.warn("loadFollowups falhou:", e); }
  return {};
}

// Adiciona uma tratativa a um item (aditivo). Grava como LISTA. Retorna o mapa atualizado.
export async function addFollowup(db, projectId, key, { status, texto, link, responsavel }) {
  const mapa = await loadFollowups(db, projectId);
  const registro = {
    id: (globalThis.crypto && globalThis.crypto.randomUUID ? crypto.randomUUID() : "fu-" + Date.now()),
    status: status || "aguardando",
    texto: texto || "",
    link: link || "",
    responsavel: responsavel || "Gerencial",
    em: new Date().toISOString(),
  };
  const item = mapa[key] || { key, entries: [] };
  item.key = key;
  item.entries = [registro, ...(item.entries || [])];
  item.statusAtual = registro.status;
  item.resolvido = registro.status === "resolvido";
  item.resolvidoEm = item.resolvido ? registro.em : "";
  const novoMapa = { ...mapa, [key]: item };
  const registros = Object.values(novoMapa);
  await setDoc(doc(db, "followups", projectId), { registros, updatedAt: new Date().toISOString() });
  return novoMapa;
}

// Recalcula o cabeçalho do registro a partir das entradas (usado após editar/excluir/concluir).
export function recalcularRegistro(reg) {
  const entries = Array.isArray(reg && reg.entries) ? reg.entries : [];
  const ultima = entries[0] || null;
  return {
    ...reg,
    entries,
    statusAtual: ultima ? ultima.status : "aguardando",
    resolvido: !!ultima && ultima.status === "resolvido",
    resolvidoEm: ultima && ultima.status === "resolvido" ? ultima.em : "",
  };
}

async function gravarRegistro(db, projectId, key, mudar) {
  const mapa = await loadFollowups(db, projectId);
  const atual = mapa[key];
  if (!atual) return mapa;
  const novo = mudar(atual);
  const novoMapa = { ...mapa };
  if (novo) novoMapa[key] = novo; else delete novoMapa[key];
  await setDoc(doc(db, "followups", projectId), { registros: Object.values(novoMapa), updatedAt: new Date().toISOString() });
  return novoMapa;
}

// Gerencial: apagar uma tratativa (se não sobrar nenhuma, o registro some e o item volta a "Sem tratativa").
export const excluirEntrada = (db, projectId, key, entryId) => gravarRegistro(db, projectId, key, (reg) => {
  const entries = (reg.entries || []).filter((e) => e.id !== entryId);
  return entries.length ? recalcularRegistro({ ...reg, entries }) : null;
});

// Gerencial: corrigir texto/status/link de uma tratativa.
export const editarEntrada = (db, projectId, key, entryId, campos) => gravarRegistro(db, projectId, key, (reg) =>
  recalcularRegistro({ ...reg, entries: (reg.entries || []).map((e) => (e.id === entryId ? { ...e, ...campos, editadoEm: new Date().toISOString() } : e)) }));

// Gerencial: marca como vistos os retornos novos que a empresa/administração enviou pelo link.
export async function marcarRetornosVistos(db, projectId) {
  const mapa = await loadFollowups(db, projectId);
  if (!Object.values(mapa).some((r) => r && r.retornoNovo)) return mapa;
  const novo = {};
  Object.entries(mapa).forEach(([k, r]) => { novo[k] = r && r.retornoNovo ? { ...r, retornoNovo: false } : r; });
  await setDoc(doc(db, "followups", projectId), { registros: Object.values(novo), updatedAt: new Date().toISOString() });
  return novo;
}

// Gerencial: concluir o item a qualquer momento.
export async function concluirFollowup(db, projectId, key, texto = "Concluído pela gestão Moked.") {
  const mapa = await addFollowup(db, projectId, key, { status: "resolvido", texto, responsavel: "Gerencial" });
  const reg = mapa[key];
  if (reg && reg.comQuem) {
    const sem = { ...reg, comQuem: "moked", pendenteValidacao: false };
    const novo = { ...mapa, [key]: sem };
    await setDoc(doc(db, "followups", projectId), { registros: Object.values(novo), updatedAt: new Date().toISOString() });
    return novo;
  }
  return mapa;
}

export function isResolvido(followupsMap, key) {
  return !!(followupsMap && followupsMap[key] && followupsMap[key].resolvido);
}

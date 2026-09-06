// followups.js — Gestão de tratativas (follow-up) das pendências de equipamentos.
//
// Cada pendência inoperante/parcial do painel pode ter um histórico de tratativas
// (o que está sendo feito sobre o problema): status, texto, link, data e responsável.
// Fica em followups/{projectId}, amarrado ao item por um id normalizado, para
// sobreviver entre relatórios semanais. É uma camada de GESTÃO — nunca contradiz
// a verdade de campo do teste semanal: um item "Resolvido" some do painel, mas
// reaparece se o próximo teste semanal ainda o reportar inoperante.

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
  { id: "resolvido",  label: "Resolvido",          color: "#3fbf7f" },
];
export const statusInfo = (id) => FOLLOWUP_STATUS.find(s => s.id === id) || FOLLOWUP_STATUS[0];

// Carrega os follow-ups de um projeto: { [key]: { entries:[...], resolvido:bool, resolvidoEm } }
export async function loadFollowups(db, projectId) {
  try {
    const snap = await getDoc(doc(db, "followups", projectId));
    if (snap.exists()) return snap.data()?.itens || {};
  } catch (e) { console.warn("loadFollowups falhou:", e); }
  return {};
}

// Adiciona uma tratativa a um item (aditivo). Retorna o mapa atualizado.
export async function addFollowup(db, projectId, key, { status, texto, link, responsavel }) {
  const atual = await loadFollowups(db, projectId);
  const registro = {
    id: (globalThis.crypto?.randomUUID ? crypto.randomUUID() : "fu-" + Date.now()),
    status: status || "aguardando",
    texto: texto || "",
    link: link || "",
    responsavel: responsavel || "Gerencial",
    em: new Date().toISOString(),
  };
  const item = atual[key] || { entries: [] };
  item.entries = [registro, ...(item.entries || [])];
  // O status mais recente vira o status corrente do item.
  item.statusAtual = registro.status;
  item.resolvido = registro.status === "resolvido";
  item.resolvidoEm = item.resolvido ? registro.em : "";
  const novo = { ...atual, [key]: item };
  await setDoc(doc(db, "followups", projectId), { itens: novo, updatedAt: new Date().toISOString() });
  return novo;
}

// Decide se um item deve ser OCULTADO do painel: só quando marcado resolvido.
// A "rede de segurança" (reaparecer se o teste ainda acusar) é aplicada em quem
// consome — o painel só oculta se o item está resolvido E o teste semanal atual
// concorda; se o teste ainda reporta inop, o painel ignora o "resolvido".
export function isResolvido(followupsMap, key) {
  return !!followupsMap?.[key]?.resolvido;
}

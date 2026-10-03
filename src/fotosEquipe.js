// ─────────────────────────────────────────────────────────────
// fotosEquipe.js — fotos dos colaboradores FORA do documento principal da equipe.
//
// Por quê: ~88% do documento equipes/{pid} eram fotos em base64 (estimativa da auditoria de 03/10/2026). Cada gravação
// reenviava tudo (antes+depois), a resposta devolvia tudo de novo e a home do gerencial baixava os 12 documentos.
//
// Modelo (aditivo, com leitura em dupla):
//   equipes/{pid}/fotos/{colabId}-{sha256[0..16]} = { data:"data:image/jpeg;base64,...", ... }   IMUTÁVEL: criada uma vez pelo
//   servidor (api/equipe-foto) e nunca sobrescrita. O colaborador no documento principal guarda  fotoRef:"<id>"  e  foto:"".
//   Trocar a foto = criar uma foto nova e mudar fotoRef pela gravação normal da Equipe (que tem revisão e devolve 409 em
//   conflito). Foto legada (campo foto no documento) continua aparecendo até ser migrada. NADA é removido nem reduzido.
// ─────────────────────────────────────────────────────────────
import { createContext, useEffect, useState, useCallback } from "react";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { authFetchEquipe, isDemo } from "./session";

export const FOTO_SUBCOLECAO = "fotos";
export const VALIDADE_CACHE_MS = 10 * 60 * 1000;
export const FotosCtx = createContext({});
const VAZIO = Object.freeze({});
const ehFoto = v => typeof v === "string" && v.startsWith("data:image/");

// ÚNICO resolvedor de foto (Avatar, férias, PDF, visão somente leitura).
//   temFoto:false      -> sem foto, mesmo que exista cópia legada
//   fotoRef presente   -> só a foto referenciada (nunca cai para a legada); "" enquanto não carregou
//   senão              -> foto legada do documento
export function fotoDe(colab, mapa) {
  if (!colab || colab.temFoto === false) return "";
  if (colab.fotoRef) { const f = mapa && mapa[colab.fotoRef]; return ehFoto(f) ? f : ""; }
  return ehFoto(colab.foto) ? colab.foto : "";
}
// Cópia da lista com a foto SEMPRE resolvida (inclusive vazia) para PDF/exportações: nunca vaza a cópia legada de quem não tem foto.
export function injetarFotos(lista, mapa) {
  return (lista || []).map(c => ({ ...c, foto: fotoDe(c, mapa) }));
}
export async function carregarFotos(db, pid) {
  const snap = await getDocs(collection(db, "equipes", pid, FOTO_SUBCOLECAO));
  const mapa = {};
  snap.forEach(d => { const v = d.data(); if (v && ehFoto(v.data)) mapa[d.id] = v.data; });
  return mapa;
}
// Envia a foto ao servidor (autorizado por perfil e projeto) e devolve a referência imutável. Demonstração não envia nada.
export async function enviarFoto(pid, colabId, dataUrl) {
  if (isDemo()) return "demo-" + colabId;
  const r = await authFetchEquipe("/api/equipe-foto", { method: "POST", body: JSON.stringify({ pid, colabId, dataUrl }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok || !j.ref) throw Object.assign(new Error(j.erro || "Não foi possível enviar a foto."), { status: r.status });
  return j.ref;
}
// O que vai para o documento principal. Puro.
//  • foto nova já enviada (ref): aponta para ela;
//  • sem foto nova: PRESERVA a existente (referência, legada ou temFoto) — inclusive se as fotos ainda não carregaram.
//    Nunca converte "ainda não carregou" em "foto removida".
export function prepararColaborador({ form, fotoFinal, ref, existente }) {
  const ex = existente || {};
  if (ehFoto(fotoFinal) && ref) return { ...form, foto: "", fotoRef: ref, temFoto: true };
  const refAtual = ex.fotoRef || form.fotoRef || "";
  const legada = ehFoto(ex.foto) ? ex.foto : (ehFoto(form.foto) && !refAtual ? form.foto : "");
  const colab = { ...form, foto: refAtual ? "" : legada, temFoto: !!(refAtual || legada || ex.temFoto === true) };
  if (refAtual) colab.fotoRef = refAtual;
  return colab;
}

// Cache por projeto (10 min). Fotos são imutáveis: unir mapas nunca perde nem corrompe nada.
const cache = new Map();
export function limparCacheFotos() { cache.clear(); }
export function useFotosEquipe(pid) {
  const [estado, setEstado] = useState(() => { const c = pid && cache.get(pid); return { pid, mapa: c ? c.mapa : VAZIO, carregado: !!c }; });
  useEffect(() => {
    if (!pid) return undefined;
    let vivo = true;
    const c = cache.get(pid);
    setEstado(e => e.pid === pid ? e : { pid, mapa: c ? c.mapa : VAZIO, carregado: !!c });   // nunca mantém o mapa de outro projeto
    if (c && Date.now() - c.em < VALIDADE_CACHE_MS) return undefined;
    carregarFotos(getFirestore(), pid)
      .then(m => {
        const uniao = { ...m, ...((cache.get(pid) || {}).mapa || {}) };
        cache.set(pid, { mapa: uniao, em: Date.now() });
        if (vivo) setEstado(e => e.pid === pid ? { pid, mapa: { ...uniao, ...e.mapa }, carregado: true } : e);
      })
      .catch(() => { /* sem foto: a tela mostra o ícone e continua funcionando */ });
    return () => { vivo = false; };
  }, [pid]);
  const definir = useCallback((ref, dataUrl) => {
    setEstado(e => {
      if (e.pid !== pid) return e;
      const n = { ...e.mapa, [ref]: dataUrl };
      cache.set(pid, { mapa: n, em: Date.now() });
      return { ...e, mapa: n };
    });
  }, [pid]);
  const atual = estado.pid === pid;
  return { mapa: atual ? estado.mapa : VAZIO, definir, carregado: atual && estado.carregado };
}

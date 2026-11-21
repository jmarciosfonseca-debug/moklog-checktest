// Leitura sem internet (Firestore com cache no aparelho). CAUTELA acima de tudo — em 11/10 o cache persistente derrubou o app
// ("INTERNAL ASSERTION FAILED: Unexpected state", firebase-js-sdk #8305: várias abas + localStorage cheio). Por isso:
//  - padrão = cache em memória (exatamente o comportamento de hoje); persistente só se a chave remota mandar E o perfil estiver listado;
//  - UMA aba só (persistentSingleTabManager), nunca o modo de várias abas;
//  - só liga com o localStorage folgado (higiene); cheio demais = fica em memória;
//  - se o erro antigo aparecer, entra em QUARENTENA: volta sozinho para memória, apaga o cache do aparelho e não liga por 7 dias;
//  - qualquer falha ao iniciar cai para memória; a mudança vale na PRÓXIMA abertura (nunca no meio do uso).
// O Firestore precisa ser iniciado ANTES dos módulos que usam o banco: este arquivo é importado primeiro em index.js.
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentSingleTabManager } from "firebase/firestore";

export const CHAVE_LIGADO = "mk-leitura-offline";
export const CHAVE_QUARENTENA = "mk-leitura-quarentena";
export const CHAVE_LIMPAR = "mk-leitura-limpar";
export const QUARENTENA_MS = 7 * 86400000;
export const LIMITE_LOCALSTORAGE = 2.5 * 1024 * 1024; // caracteres; o limite do navegador é ~5 MB

const firebaseConfig = {
  apiKey: "AIzaSyDLMwBqccgWDk7VFQdLYKuLNXWtkNn5WGA",
  authDomain: "moklog-checktest.firebaseapp.com",
  projectId: "moklog-checktest",
  storageBucket: "moklog-checktest.firebasestorage.app",
  messagingSenderId: "390165325023",
  appId: "1:390165325023:web:3147cd333503916b0d756a",
};

const seguro = (f, padrao) => { try { return f(); } catch { return padrao; } };
const ler = (st, k) => seguro(() => st.getItem(k), null);
const gravar = (st, k, v) => seguro(() => { st.setItem(k, v); return true; }, false);
const apagar = (st, k) => seguro(() => { st.removeItem(k); return true; }, false);
const localStorageSeguro = () => seguro(() => window.localStorage, null);

export function tamanhoLocalStorage(st) {
  return seguro(() => { let n = 0; for (let i = 0; i < st.length; i++) { const k = st.key(i); n += (k || "").length + (st.getItem(k) || "").length; } return n; }, 0);
}

export function emQuarentena(st, agora = Date.now()) {
  const t = Number(ler(st, CHAVE_QUARENTENA));
  return Number.isFinite(t) && t > 0 && agora - t < QUARENTENA_MS;
}

// "persistente" | "memoria" — lido na abertura, de forma síncrona.
export function modoDeCache(st, agora = Date.now()) {
  if (!st) return "memoria";
  if (ler(st, CHAVE_LIGADO) !== "1") return "memoria";
  if (emQuarentena(st, agora)) return "memoria";
  if (tamanhoLocalStorage(st) > LIMITE_LOCALSTORAGE) return "memoria";
  return "persistente";
}

// Iniciado uma vez, antes de tudo. Devolve { modo, motivo }; nunca lança.
export function iniciarFirestore({ st = localStorageSeguro(), agora = Date.now(), app: appInj } = {}) {
  let app;
  try { app = appInj || (getApps().length ? getApps()[0] : initializeApp(firebaseConfig)); } catch { return { modo: "memoria", motivo: "app" }; }
  const quer = !!st && ler(st, CHAVE_LIGADO) === "1";
  const modo = modoDeCache(st, agora);
  let motivo = quer && modo === "memoria" ? (emQuarentena(st, agora) ? "quarentena" : "localStorage cheio") : "";
  if (modo === "persistente") {
    try {
      initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentSingleTabManager(undefined) }) });
      return { modo: "persistente", motivo: "" };
    } catch {
      motivo = "falha ao iniciar";
      apagar(st, CHAVE_LIGADO);
    }
  }
  seguro(() => getFirestore(app), null); // cache em memória: o padrão de sempre
  return { modo: "memoria", motivo };
}

// Chave remota (offline-config.json → leitura: { ativo, perfis }). Vale na PRÓXIMA abertura.
export function decidirLeitura(config, perfil) {
  if (!config) return "manter";
  if (config.ativo === false) return "desligar"; // chave geral desligada derruba também a leitura
  const l = config.leitura;
  if (!l || l.ativo === false) return "desligar";
  if (l.ativo === true && perfil && Array.isArray(l.perfis) && (l.perfis.includes(perfil) || l.perfis.includes("todos"))) return "ligar";
  return "manter";
}
export function aplicarLeitura(config, perfil, st = localStorageSeguro()) {
  if (!st) return "indisponivel";
  const acao = decidirLeitura(config, perfil);
  if (acao === "desligar") {
    if (ler(st, CHAVE_LIGADO) !== null) { apagar(st, CHAVE_LIGADO); gravar(st, CHAVE_LIMPAR, "1"); } // desligou: some também o que ficou no aparelho
    return "desligado";
  }
  if (acao === "ligar") { if (emQuarentena(st)) return "quarentena"; gravar(st, CHAVE_LIGADO, "1"); return "ligado"; }
  return "mantido";
}

// Apaga o cache do Firestore neste aparelho (IndexedDB "firestore/…"). Só com o cache em MEMÓRIA, ou seja, sem o SDK usando o banco.
export async function limparCacheDoAparelho({ idb = seguro(() => window.indexedDB, null), st = localStorageSeguro() } = {}) {
  if (!idb) return false;
  try {
    let nomes;
    if (typeof idb.databases === "function") nomes = (await idb.databases()).map((d) => d.name).filter((n) => n && n.indexOf("firestore/") === 0);
    else nomes = [`firestore/[DEFAULT]/${firebaseConfig.projectId}/main`];
    await Promise.all(nomes.map((n) => new Promise((res) => { const r = idb.deleteDatabase(n); r.onsuccess = r.onerror = r.onblocked = () => res(); })));
    if (st) apagar(st, CHAVE_LIMPAR);
    return true;
  } catch { return false; }
}

// O erro antigo: quarentena imediata.
export const ehFalhaDoFirestore = (msg) => /INTERNAL ASSERTION FAILED/i.test(String(msg || ""));
export function vigiarFalha({ win = seguro(() => window, null), st = localStorageSeguro(), agora = () => Date.now(), aoFalhar } = {}) {
  if (!win || !win.addEventListener || !st) return () => {};
  const tratar = (msg) => {
    if (!ehFalhaDoFirestore(msg)) return;
    gravar(st, CHAVE_QUARENTENA, String(agora()));
    apagar(st, CHAVE_LIGADO);
    gravar(st, CHAVE_LIMPAR, "1");
    if (aoFalhar) seguro(() => aoFalhar(String(msg).slice(0, 300)), null);
  };
  const onErr = (e) => tratar((e && (e.message || (e.error && e.error.message))) || "");
  const onRej = (e) => tratar((e && e.reason && (e.reason.message || e.reason)) || "");
  win.addEventListener("error", onErr);
  win.addEventListener("unhandledrejection", onRej);
  return () => { win.removeEventListener("error", onErr); win.removeEventListener("unhandledrejection", onRej); };
}

// Roda na abertura: inicia o Firestore, liga a vigília e, se pendente, apaga o cache do aparelho (só com cache em memória).
export function iniciarLeituraOffline() {
  const r = iniciarFirestore();
  vigiarFalha();
  const st = localStorageSeguro();
  if (r.modo === "memoria" && st && ler(st, CHAVE_LIMPAR) === "1") limparCacheDoAparelho({ st }).catch(() => {});
  return r;
}

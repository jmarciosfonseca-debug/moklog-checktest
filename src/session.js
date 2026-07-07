// ─────────────────────────────────────────────────────────────
// session.js — Sessão global MokLog CheckTest (Etapa 1)
// Sessão local persistida em localStorage com expiração por INATIVIDADE.
//
// Níveis:
//   "gerencial" → PIN 872101. Acesso admin a TODOS os projetos/telas. 30 min.
//   "equipe"    → PIN do projeto (ex: 16601). Acesso líder SÓ ao próprio projeto. 5 min.
//   "demo"      → reservado para a Etapa 2 (PIN GAL 601604). 5 min.
//
// Qualquer PIN correto grava a sessão; enquanto válida, nenhuma tela
// volta a pedir PIN. Qualquer toque/clique renova lastActivity
// (listener global no App.jsx chama touchSession, com throttle aqui).
// Fechar o app e voltar dentro da janela → segue logado.
// ─────────────────────────────────────────────────────────────

const KEY = "moklog_session_v1";

export const SESSION_TIMEOUTS = {
  gerencial: 30 * 60 * 1000, // 30 min de inatividade
  equipe:     5 * 60 * 1000, // 5 min de inatividade
  demo:       5 * 60 * 1000, // 5 min de inatividade (Etapa 2)
};

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || !s.nivel || !SESSION_TIMEOUTS[s.nivel]) return null;
    return s;
  } catch (e) { return null; }
}

function write(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
}

// Sessão válida (não expirada) ou null. Sessão expirada é limpa.
export function getSession() {
  const s = read();
  if (!s) return null;
  const timeout = SESSION_TIMEOUTS[s.nivel];
  if (Date.now() - (s.lastActivity || 0) > timeout) { clearSession(); return null; }
  return s;
}

// Grava a sessão a partir do resultado de qualquer PinGate.
// level: "admin" (PIN gerencial) | "lider" (PIN do projeto)
export function grantSession(level, projectId) {
  if (level === "admin") {
    write({ nivel: "gerencial", lastActivity: Date.now() });
  } else if (level === "lider" && projectId) {
    write({ nivel: "equipe", projectId, lastActivity: Date.now() });
  }
}

// Nível de acesso da sessão atual para um projeto: "admin" | "lider" | null.
// Gerencial → admin em qualquer projeto; equipe → líder só no projeto dela.
export function getAccess(projectId) {
  const s = getSession();
  if (!s) return null;
  if (s.nivel === "gerencial") return "admin";
  if (s.nivel === "equipe") return projectId && s.projectId === projectId ? "lider" : null;
  return null;
}

// true se há sessão gerencial válida (telas 100% gerenciais)
export function hasGerencial() {
  const s = getSession();
  return !!s && s.nivel === "gerencial";
}

// Renova lastActivity (throttle interno de 15s para não martelar o localStorage)
let _lastTouch = 0;
export function touchSession() {
  const now = Date.now();
  if (now - _lastTouch < 15000) return;
  const s = getSession();
  if (!s) return;
  _lastTouch = now;
  s.lastActivity = now;
  write(s);
}

// Logout manual — limpa a sessão global
export function clearSession() {
  try { localStorage.removeItem(KEY); } catch (e) {}
}

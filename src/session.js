// ─────────────────────────────────────────────────────────────
// session.js — Sessão global MokLog CheckTest (Etapa 1)
// Sessão local persistida em localStorage com expiração por INATIVIDADE.
//
// Níveis:
//   "gerencial" → PIN 872101. Acesso admin a TODOS os projetos/telas. 30 min.
//   "equipe"    → PIN do projeto (ex: 16601). Acesso líder SÓ ao próprio projeto. 5 min.
//   "demo"      → PIN GAL 601604. Vê e mexe em tudo como admin, mas NADA é
//                 salvo (escritas interceptadas via fireGuard.js). Banner 🎭. 5 min.
//
// Qualquer PIN correto grava a sessão; enquanto válida, nenhuma tela
// volta a pedir PIN. Qualquer toque/clique renova lastActivity
// (listener global no App.jsx chama touchSession, com throttle aqui).
// Fechar o app e voltar dentro da janela → segue logado.
// ─────────────────────────────────────────────────────────────

const KEY = "moklog_session_v1";
const DEMO_PIN = "601604"; // PIN GAL — modo demonstração (nada é salvo)

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
// level: "admin" (PIN gerencial) | "lider" (PIN do projeto) | "demo" (GAL)
export function grantSession(level, projectId) {
  if (level === "admin") {
    write({ nivel: "gerencial", lastActivity: Date.now() });
  } else if (level === "lider" && projectId) {
    write({ nivel: "equipe", projectId, lastActivity: Date.now() });
  } else if (level === "demo") {
    write({ nivel: "demo", lastActivity: Date.now() });
  }
}

// Verificação central de PIN. Retorna o nível concedido ou null.
// Use isto nos PinGates: o PIN demo (601604) é reconhecido em QUALQUER tela.
//   checkPin(valor, { projectPin, allowAdmin, projectId })
// - allowAdmin: se true, aceita o PIN gerencial 872101
// - projectPin: PIN do projeto (ex "16601"); se casar → "lider"
// SEMPRE aceita o DEMO_PIN → "demo".
export function checkPin(valor, opts = {}) {
  const v = String(valor || "").trim();
  if (!v) return null;
  if (v === DEMO_PIN) { grantSession("demo"); return "demo"; }
  if (opts.allowAdmin !== false && v === "872101") { grantSession("admin"); return "admin"; }
  if (opts.projectPin && v === String(opts.projectPin)) {
    grantSession("lider", opts.projectId);
    return "lider";
  }
  return null;
}

// Nível de acesso da sessão atual para um projeto: "admin" | "lider" | null.
// Gerencial → admin em qualquer projeto; equipe → líder só no projeto dela.
export function getAccess(projectId) {
  const s = getSession();
  if (!s) return null;
  if (s.nivel === "gerencial") return "admin";
  if (s.nivel === "demo") return "admin"; // demo enxerga tudo como admin (mas não salva)
  if (s.nivel === "equipe") return projectId && s.projectId === projectId ? "lider" : null;
  return null;
}

// true se a sessão atual é o modo demonstração (GAL). Usado pelo fireGuard
// para bloquear TODA escrita, pelo banner 🎭 e pelos guards de e-mail/share.
export function isDemo() {
  const s = getSession();
  return !!s && s.nivel === "demo";
}

// true se há sessão gerencial válida (telas 100% gerenciais)
export function hasGerencial() {
  const s = getSession();
  // demo vê telas gerenciais (retorna true) mas a escrita é travada pelo fireGuard
  return !!s && (s.nivel === "gerencial" || s.nivel === "demo");
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

// ─────────────────────────────────────────────────────────────
// rateLimit.js — Rate limiting em memória por sessão/IP (BACKEND ONLY)
//
// Simples e suficiente para o MVP: janela deslizante por minuto.
// NOTA: memória por instância de função serverless. Em escala com
// múltiplas instâncias, migrar para um store compartilhado (Upstash
// Redis, Firestore com TTL, etc.) — documentado como próximo passo.
// ─────────────────────────────────────────────────────────────

const WINDOW_MS = 60 * 1000;
const _buckets = new Map(); // key -> { count, resetAt }

function limitPerMinute() {
  const n = parseInt(process.env.AI_MAX_REQUESTS_PER_MINUTE || "12", 10);
  return Number.isFinite(n) && n > 0 ? n : 12;
}

// Retorna { allowed, remaining, retryAfterSec }.
function check(key) {
  const now = Date.now();
  const max = limitPerMinute();
  let b = _buckets.get(key);
  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + WINDOW_MS };
    _buckets.set(key, b);
  }
  if (b.count >= max) {
    return { allowed: false, remaining: 0, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count += 1;
  return { allowed: true, remaining: max - b.count, retryAfterSec: 0 };
}

// Limpeza oportunista para não vazar memória.
function _sweep() {
  const now = Date.now();
  for (const [k, b] of _buckets) if (now >= b.resetAt) _buckets.delete(k);
}
setInterval(_sweep, 5 * 60 * 1000).unref?.();

function ipFromReq(req) {
  const xf = (req.headers && (req.headers["x-forwarded-for"] || req.headers["X-Forwarded-For"])) || "";
  return String(xf).split(",")[0].trim() || (req.socket && req.socket.remoteAddress) || "unknown";
}

module.exports = { check, ipFromReq, limitPerMinute };

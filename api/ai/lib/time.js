// ─────────────────────────────────────────────────────────────
// time.js — Normalização de tempo, fuso America/Sao_Paulo e durações
//
// Fonte ÚNICA de cálculo de tempo para todas as ferramentas de IA.
// Espelha as regras já usadas no app (ancorar data-only ao meio-dia
// local para evitar o bug de fuso das rondas noturnas), mas do lado
// do servidor e de forma testável isoladamente.
// ─────────────────────────────────────────────────────────────

const TIMEZONE = "America/Sao_Paulo";

// Converte várias formas de timestamp em epoch ms, ou null se inválido.
// Aceita: Firestore Timestamp ({seconds,nanoseconds} ou .toDate()),
// Date, ISO string, "YYYY-MM-DD" (ancorado ao meio-dia local).
function toMillis(v) {
  if (v == null) return null;
  try {
    if (typeof v === "object") {
      if (typeof v.toDate === "function") return v.toDate().getTime();
      if (typeof v.seconds === "number") return v.seconds * 1000;
      if (v instanceof Date) return v.getTime();
    }
    if (v instanceof Date) return v.getTime();
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const s = v.trim();
      if (!s) return null;
      // data-only → meio-dia local (evita cair no dia anterior por UTC)
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const t = new Date(s + "T12:00:00").getTime();
        return Number.isNaN(t) ? null : t;
      }
      const t = new Date(s).getTime();
      return Number.isNaN(t) ? null : t;
    }
  } catch (e) {
    return null;
  }
  return null;
}

// Epoch ms → ISO string com offset de São Paulo (ex.: 2026-08-07T14:30:00-03:00).
function toIsoSaoPaulo(ms) {
  if (ms == null) return null;
  try {
    const d = new Date(ms);
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: TIMEZONE,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
    }).formatToParts(d).reduce((a, p) => { a[p.type] = p.value; return a; }, {});
    // offset real de SP no instante (−02:00 no horário de verão histórico, −03:00 hoje)
    const asUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
    const offMin = Math.round((asUTC - ms) / 60000);
    const sign = offMin >= 0 ? "+" : "-";
    const abs = Math.abs(offMin);
    const oh = String(Math.floor(abs / 60)).padStart(2, "0");
    const om = String(abs % 60).padStart(2, "0");
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${sign}${oh}:${om}`;
  } catch (e) {
    return new Date(ms).toISOString();
  }
}

function nowIso() {
  return toIsoSaoPaulo(Date.now());
}

// Duração em minutos entre dois instantes. null se algum for inválido.
function durationMinutes(startMs, endMs) {
  if (startMs == null || endMs == null) return null;
  return Math.max(0, Math.round((endMs - startMs) / 60000));
}

// Idade em dias inteiros desde um instante até agora. null se inválido.
function ageDays(ms, nowMs = Date.now()) {
  if (ms == null) return null;
  return Math.max(0, Math.floor((nowMs - ms) / 86400000));
}

// Duração legível curta (ex.: "2h 15min", "45min", "3d 4h").
function humanDuration(minutes) {
  if (minutes == null) return null;
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m || parts.length === 0) parts.push(`${m}min`);
  return parts.join(" ");
}

module.exports = {
  TIMEZONE, toMillis, toIsoSaoPaulo, nowIso,
  durationMinutes, ageDays, humanDuration,
};

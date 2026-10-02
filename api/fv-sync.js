// ─────────────────────────────────────────────────────────────
// api/fv-sync.js — gatilho "Atualizar agora" (Vercel Serverless).
// POST { pin } → valida hash do PIN no servidor → dispara o workflow.
// Env (Vercel): GH_DISPATCH_TOKEN, FV_TRIGGER_PIN_HASH (sha256 hex do PIN),
//               GH_REPO (opcional, padrão jmarciosfonseca-debug/moklog-checktest)
// ─────────────────────────────────────────────────────────────
const {requireAdmin}=require('./ai/lib/accessAuth');

const REPO = process.env.GH_REPO || "jmarciosfonseca-debug/moklog-checktest";
const INTERVALO_MIN = 15;


async function gh(path, opts = {}) {
  const r = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${process.env.GH_DISPATCH_TOKEN}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(opts.headers || {}) },
  });
  return r;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ ok: false, erro: "Método não permitido" });
  res.setHeader('Cache-Control','no-store');
  if (!requireAdmin(req,res)) return;
  if (!process.env.GH_DISPATCH_TOKEN) return res.status(500).json({ ok: false, erro: "Gatilho não configurado" });
  try {
    const runs = await gh(`/actions/workflows/fv-sync.yml/runs?per_page=5`);
    if (runs.ok) {
      const j = await runs.json();
      const recente = (j.workflow_runs || []).find(r => r.status !== "completed" || (Date.now() - new Date(r.created_at).getTime()) < INTERVALO_MIN * 60000);
      if (recente) return res.status(429).json({ ok: false, erro: `Sincronização recente ou em andamento. Aguarde ${INTERVALO_MIN} min.` });
    }
    const d = await gh(`/actions/workflows/fv-sync.yml/dispatches`, { method: "POST", body: JSON.stringify({ ref: "main", inputs: { dry_run: false, origem: "manual" } }) });
    if (d.status !== 204) return res.status(502).json({ ok: false, erro: `GitHub respondeu ${d.status}` });
    return res.status(202).json({ ok: true, mensagem: "Sincronização iniciada. Leva de 1 a 3 minutos." });
  } catch (e) {
    return res.status(502).json({ ok: false, erro: "Falha ao acionar a sincronização" });
  }
};

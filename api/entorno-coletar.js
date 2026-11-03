// ─────────────────────────────────────────────────────────────
// api/entorno-coletar.js — Coletor do Entorno (Vercel Serverless).
//
// Lê o Google News RSS (que agrega G1/Globo, UOL, R7, Estadão, CNN e portais locais) para cada parque,
// em dois temas — segurança no entorno e mercado logístico —, pré-filtra pelo tema, pede à OpenAI
// (já configurada no projeto) para confirmar relevância/tipo/local, e grava em entorno/{pid}.
//
// Quem pode acionar:
//   GET  — rotina da Vercel (vercel.json → crons) com Authorization: Bearer ${CRON_SECRET}
//   POST — botão "Atualizar agora" da tela Entorno, com sessão gerencial (requireAdmin)
// Orçamento de tempo por chamada: ~50 s. Um cursor em entorno/_status continua de onde parou.
// Nunca apaga o que já está gravado; falha de um projeto não derruba os outros.
// ─────────────────────────────────────────────────────────────
const { requireAdmin } = require("./ai/lib/accessAuth");
const { getDb } = require("./ai/lib/firebaseAdmin");
const { callText } = require("./ai/lib/openai");
const core = require("../src/entorno/core");
const { projetosComEntorno, LOCAIS, GERAL } = require("../src/entorno/locais");

const ORCAMENTO_MS = 50000;
const TIMEOUT_RSS_MS = 8000;
const INTERVALO_MANUAL_MIN = 20;

async function lerRss(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_RSS_MS);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "MokLogCheckTest/1.0 (+https://moklog-checktest.vercel.app)", Accept: "application/rss+xml, application/xml, text/xml" } });
    if (!r.ok) throw new Error(`RSS ${r.status}`);
    return core.parseRss(await r.text());
  } finally { clearTimeout(t); }
}

// Classifica em lotes de até 25 (sem ferramentas — a Responses API recusa tool_choice com tools vazio; foi isso que
// derrubou a primeira coleta em 02/11). Falha da IA vira erro registrado, não exceção: o doc é gravado mesmo assim.
async function classificar(pid, itens, erros) {
  const out = [];
  for (let i = 0; i < itens.length; i += 25) {
    const lote = itens.slice(i, i + 25);
    try { out.push(...core.aplicarClassificacao(lote, await callText(core.promptClassificacao(pid, lote)))); }
    catch (e) { erros.push(`IA: ${(e && e.message) || "falha"}`); console.error("entorno/classificar", pid, e && e.message); }
  }
  return out;
}

async function coletarProjeto(db, pid) {
  const ref = db.collection("entorno").doc(pid);
  const atual = (await ref.get()).data() || {};
  const existentes = Array.isArray(atual.itens) ? atual.itens : [];
  const consultas = pid === GERAL.id ? core.consultasGerais() : core.consultasDoProjeto(pid);
  const so = !!(LOCAIS[pid] && LOCAIS[pid].soSeguranca);
  const lidos = await Promise.all(consultas.map((c) => lerRss(c.url).then((it) => ({ c, itens: it })).catch((e) => ({ c, erro: e.message, itens: [] }))));
  const erros = lidos.filter((l) => l.erro).map((l) => `${l.c.fonte || l.c.tema}: ${l.erro}`);
  const vistos = new Set();
  const candidatos = lidos.flatMap((l) => core.novosParaClassificar(l.itens, existentes, { ...l.c, soSeguranca: so })).filter((it) => !vistos.has(it.id) && vistos.add(it.id));
  const novos = await classificar(pid, candidatos, erros);
  const agora = new Date();
  const itens = core.mesclar(existentes, novos, agora);
  const fontes = lidos.map((l) => ({ fonte: l.c.fonte || l.c.tema, lidos: l.itens.length, ok: !l.erro }));
  const doc = {
    pid, itens, resumo: core.resumir(itens, agora), atualizadoEm: agora.toISOString(),
    ultimaColeta: { em: agora.toISOString(), lidos: lidos.reduce((n, l) => n + l.itens.length, 0), candidatos: candidatos.length, aceitos: novos.length, erros, fontes },
  };
  await ref.set(doc, { merge: true });
  return doc.ultimaColeta;
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const inicio = Date.now();
  let origem;
  if (req.method === "GET") {
    const secret = process.env.CRON_SECRET;
    if (!secret || (req.headers?.authorization || "") !== `Bearer ${secret}`) return res.status(401).json({ ok: false, erro: "Rotina não autorizada (CRON_SECRET)." });
    origem = "cron";
  } else if (req.method === "POST") {
    if (!requireAdmin(req, res)) return;
    origem = "manual";
  } else return res.status(405).json({ ok: false, erro: "Método não permitido" });

  let db;
  try { db = getDb(); } catch (e) { return res.status(500).json({ ok: false, erro: "Firebase não configurado no servidor." }); }
  const statusRef = db.collection("entorno").doc("_status");
  const status = (await statusRef.get()).data() || {};
  const agoraMs = Date.now();
  if (status.emAndamentoAte && status.emAndamentoAte > agoraMs) return res.status(429).json({ ok: false, erro: "Coleta em andamento. Aguarde um minuto." });
  if (origem === "manual" && status.ultimaEm && agoraMs - new Date(status.ultimaEm).getTime() < INTERVALO_MANUAL_MIN * 60000 && !status.cursor) {
    return res.status(429).json({ ok: false, erro: `Coleta recente. Aguarde ${INTERVALO_MANUAL_MIN} min.` });
  }
  await statusRef.set({ emAndamentoAte: agoraMs + ORCAMENTO_MS + 10000 }, { merge: true });

  const todos = [GERAL.id, ...projetosComEntorno()]; // o mercado geral entra primeiro (serve a todos os parques)
  const pedido = typeof req.query?.pid === "string" && todos.includes(req.query.pid) ? [req.query.pid] : null;
  let fila = pedido || todos;
  if (!pedido && status.cursor && todos.includes(status.cursor)) { const i = todos.indexOf(status.cursor); fila = [...todos.slice(i), ...todos.slice(0, i)]; }

  const feitos = {}; let proximo = null;
  for (const pid of fila) {
    if (Date.now() - inicio > ORCAMENTO_MS - 12000) { proximo = pid; break; }
    try { feitos[pid] = await coletarProjeto(db, pid); }
    catch (e) { feitos[pid] = { erro: (e && e.message) || "falha" }; console.error("entorno/coletar", pid, e && e.message); }
  }
  const fim = new Date().toISOString();
  await statusRef.set({ emAndamentoAte: 0, ultimaEm: fim, origem, cursor: pedido ? (status.cursor || null) : proximo, ultimaRodada: { em: fim, feitos, pendentes: proximo ? fila.slice(fila.indexOf(proximo)) : [] } }, { merge: true });
  return res.status(200).json({ ok: true, em: fim, feitos, pendentes: proximo ? fila.slice(fila.indexOf(proximo)) : [], mensagem: proximo ? "Parte dos parques foi atualizada; a rotina continua os demais na próxima rodada." : "Entorno atualizado para todos os parques." });
};

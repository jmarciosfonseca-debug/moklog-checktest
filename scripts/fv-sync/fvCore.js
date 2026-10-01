// ─────────────────────────────────────────────────────────────
// fvCore.js — lógica PURA do sincronizador (sem rede, sem Firestore).
// Entrada: dados brutos do extrator → saída: documentos prontos + validação.
// ─────────────────────────────────────────────────────────────
const crypto = require("crypto");

// Todos os projetos, EXCETO P311A e P311B.
const FV_PROJETOS = ["P260A","P260B","P260C","P505","P601","P602","P604","P605","P606","P607"];
const FV_TIPOS = ["credito","aporte","debito","vt","am"];
const ENTRADAS = ["credito","aporte"]; // somam no saldo; o resto subtrai

// "R$ -1.234,56" | "(1.234,56)" | "1234.56" → número (2 casas) ou null
function parseValor(v) {
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
  if (v == null) return null;
  let t = String(v).trim();
  if (!t) return null;
  const neg = /^\(.*\)$/.test(t) || /-/.test(t);
  t = t.replace(/[^\d,.]/g, "");
  if (!t) return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return Math.round((neg ? -n : n) * 100) / 100;
}

// "25/09/2026" | "2026-09-25" → "2026-09-25" ou null
function parseData(v) {
  if (!v) return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

function hashLancamento(pid, l, ocorrencia = 0) {
  // ocorrencia diferencia linhas idênticas no portal (ex.: dois "Saldo Mês" no mesmo dia).
  const base = [pid, l.data, l.tipo, l.valor.toFixed(2), l.posto || "", (l.descricao || "").trim(), ocorrencia].join("|");
  return crypto.createHash("sha1").update(base).digest("hex").slice(0, 24);
}

// bruto: { projetos: { [codigoPortal]: { saldo, lancamentos:[{data,tipo,valor,posto,descricao}] } } }
// mapa:  { [codigoPortal]: "P601", ... }
// Retorna { docs: {pid:{resumo, lancamentos:[]}}, erros:[], avisos:[] }
function normalizar(bruto, mapa, agoraIso = new Date().toISOString()) {
  const erros = [], avisos = [], docs = {};
  const projetos = (bruto && bruto.projetos) || {};
  for (const [codigo, p] of Object.entries(projetos)) {
    const pid = mapa[codigo];
    if (!pid) { avisos.push(`Projeto do portal sem mapeamento: "${codigo}" (ignorado)`); continue; }
    if (!FV_PROJETOS.includes(pid)) { avisos.push(`${pid} fora do escopo (ignorado)`); continue; }
    const saldo = parseValor(p.saldo);
    if (saldo === null) { erros.push(`${pid}: saldo ilegível ("${p.saldo}")`); continue; }
    const lancamentos = [], vistos = {};
    (p.lancamentos || []).forEach((l, i) => {
      const data = parseData(l.data), valor = parseValor(l.valor), tipo = String(l.tipo || "").toLowerCase();
      if (!data || valor === null || !FV_TIPOS.includes(tipo)) { erros.push(`${pid}: lançamento #${i + 1} inválido`); return; }
      const lanc = { data, tipo, valor: Math.abs(valor), posto: l.posto || null, descricao: l.descricao || "", status: l.status || null, empresa: l.empresa || null };
      const chave = [data, tipo, lanc.valor, lanc.descricao].join("|");
      vistos[chave] = (vistos[chave] || 0) + 1;
      lanc.id = hashLancamento(pid, lanc, vistos[chave] - 1);
      lancamentos.push(lanc);
    });
    // Conferência: soma dos lançamentos deve bater com o saldo do portal.
    if (p.conferirSoma) {
      const soma = Math.round(lancamentos.reduce((n, l) => n + (["credito","aporte"].includes(l.tipo) ? l.valor : -l.valor), 0) * 100) / 100;
      if (Math.abs(soma - saldo) > 0.05) { erros.push(`${pid}: soma dos lançamentos (${soma}) difere do saldo do portal (${saldo})`); continue; }
    }
    docs[pid] = { resumo: montarResumo(pid, saldo, lancamentos, agoraIso), lancamentos };
  }
  FV_PROJETOS.forEach(pid => { if (!docs[pid]) avisos.push(`${pid}: não encontrado no portal nesta execução`); });
  return { docs, erros, avisos };
}

function montarResumo(pid, saldo, lancamentos, agoraIso) {
  const mesRef = agoraIso.slice(0, 7);
  const totaisMes = { credito: 0, aporte: 0, debito: 0, vt: 0, am: 0 };
  lancamentos.filter(l => l.data.startsWith(mesRef)).forEach(l => { totaisMes[l.tipo] = Math.round((totaisMes[l.tipo] + l.valor) * 100) / 100; });
  const creditos = lancamentos.filter(l => ENTRADAS.includes(l.tipo)).sort((a, b) => b.data.localeCompare(a.data));
  return {
    pid,
    saldoAtual: saldo,
    positivo: saldo >= 0,
    ultimoCredito: creditos[0] ? { data: creditos[0].data, valor: creditos[0].valor, tipo: creditos[0].tipo } : null,
    totaisMes, mesReferencia: mesRef,
    qtdLancamentos: lancamentos.length,
    fonte: "Gestão FV",
    sincronizadoEm: agoraIso,
    statusSincronizacao: "ok",
    erroSincronizacao: null,
  };
}

// ── Portal mokedsystem (fundoVariavel/visualizar.php) ───────────────
// Colunas: Data | Descrição | Crédito | Débito | Status | Empresa
// Rodapé: "Total: <créditos> <débitos> Saldo atual: <saldo>"
const norm = t => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function classificar(descricao, ehCredito) {
  const d = norm(descricao);
  if (ehCredito) return /aporte/.test(d) ? "aporte" : "credito";
  if (/vale\s*tra|(^|[^a-z])vt([^a-z]|$)|combust/.test(d)) return "vt";
  if (/assis|convenio|conv\.?\s*med|medic|(^|[^a-z])a\.?\s*m([^a-z]|$)|ass\s*med/.test(d)) return "am";
  return "debito";
}

// linhas: arrays de células (texto) de TODAS as <tr> da tabela.
function parseTabelaPortal(linhas) {
  const lancamentos = [];
  let saldo = null, totalCred = null, totalDeb = null;
  (linhas || []).forEach(cel => {
    const c = (cel || []).map(x => String(x || "").replace(/\s+/g, " ").trim());
    const txt = c.join(" ");
    if (/saldo atual/i.test(txt)) {
      const valores = c.filter(x => /R\$/.test(x)).map(parseValor);
      if (valores.length >= 3) { [totalCred, totalDeb, saldo] = valores; }
      else if (valores.length) saldo = valores[valores.length - 1];
      return;
    }
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(c[0] || "")) return;
    const cred = /R\$/.test(c[2] || "") ? parseValor(c[2]) : null;
    const deb = /R\$/.test(c[3] || "") ? parseValor(c[3]) : null;
    const ehCredito = cred !== null && cred !== 0;
    const valor = ehCredito ? cred : deb;
    if (valor === null) return;
    const st = (c[4] || "").trim();
    lancamentos.push({
      data: c[0], descricao: c[1] || "", tipo: classificar(c[1], ehCredito), valor: Math.abs(valor),
      status: st && st !== "-" ? norm(st) : null, empresa: c[5] || null,
    });
  });
  return { saldo, totalCred, totalDeb, lancamentos, conferirSoma: true };
}

// Regra de gravação: só grava se não houver erro. Um projeto ausente vira aviso
// e mantém o dado anterior (não apaga).
function podeGravar(resultado) {
  return resultado.erros.length === 0 && Object.keys(resultado.docs).length > 0;
}

module.exports = { FV_PROJETOS, FV_TIPOS, parseValor, parseData, hashLancamento, normalizar, montarResumo, podeGravar, classificar, parseTabelaPortal };

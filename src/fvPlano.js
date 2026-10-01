// ─────────────────────────────────────────────────────────────
// fvPlano.js — lógica PURA do painel FV (séries, projeção, planejamento).
// Saldo real = portal/planilha (fv/{pid}). Plano = fv_plano/{pid} (gerencial).
// Catálogo de preços = fv_plano/_catalogo (compartilhado entre projetos).
// Lançamentos manuais são PLANEJAMENTO: afetam projeção e "disponível",
// nunca o saldo real. "realizado" = já descontado no FV → sai do cálculo.
// ─────────────────────────────────────────────────────────────
export const PLANO_TIPOS = ["reserva","debito","aporte","outros"];
export const PLANO_ROTULO = { reserva:"Reserva", debito:"Débito previsto", aporte:"Aporte previsto", outros:"Outros" };
export const CATEGORIAS = { vt:"Vale-transporte", am:"Assistência médica", uniforme:"Uniforme e EPI", outros:"Outros débitos" };
const ENTRADAS = ["credito","aporte"];
const r2 = n => Math.round(n * 100) / 100;
const num = v => (typeof v === "number" && Number.isFinite(v)) ? v : 0;

// ── Meses ────────────────────────────────────────────────────
export function mesDe(ref) { const d = new Date(ref); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
export function somaMes(mes, n) {
  const [a, m] = mes.split("-").map(Number);
  const t = a * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}
export function rotuloMes(mes) {
  const nomes = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  const [a, m] = mes.split("-").map(Number);
  return `${nomes[m - 1]}/${String(a).slice(2)}`;
}

// ── Histórico real ───────────────────────────────────────────
export function serieMensal(lancamentos, meses = 12, ref = new Date()) {
  const fim = mesDe(ref);
  const lista = Array.from({ length: meses }, (_, i) => somaMes(fim, i - meses + 1));
  const mapa = Object.fromEntries(lista.map(m => [m, { mes: m, creditos: 0, debitos: 0 }]));
  (lancamentos || []).forEach(l => {
    const m = String(l.data || "").slice(0, 7), x = mapa[m];
    if (!x || typeof l.valor !== "number") return;
    if (ENTRADAS.includes(l.tipo)) x.creditos = r2(x.creditos + l.valor); else x.debitos = r2(x.debitos + l.valor);
  });
  return lista.map(m => mapa[m]);
}

export function saldoHistorico(saldoAtual, serie) {
  if (typeof saldoAtual !== "number") return serie.map(s => ({ mes: s.mes, saldo: null }));
  const out = new Array(serie.length);
  let saldo = saldoAtual;
  for (let i = serie.length - 1; i >= 0; i--) {
    out[i] = { mes: serie[i].mes, saldo: r2(saldo) };
    saldo = saldo - serie[i].creditos + serie[i].debitos;
  }
  return out;
}

// Média mensal dos últimos N meses COMPLETOS (exclui o mês corrente).
export function mediaMensal(lancamentos, tipos, meses = 3, ref = new Date()) {
  const atual = mesDe(ref);
  const alvo = new Set(Array.from({ length: meses }, (_, i) => somaMes(atual, -(i + 1))));
  let total = 0;
  (lancamentos || []).forEach(l => {
    if (tipos.includes(l.tipo) && alvo.has(String(l.data || "").slice(0, 7)) && typeof l.valor === "number") total += l.valor;
  });
  return r2(total / meses);
}

// Categoria de um débito sincronizado (uniforme detectado pela descrição).
const RX_UNIFORME = /unif|galocha|coturno|sapato|bota|camis|cal[cç]a|jaqueta|epi|colete|bon[eé]/i;
export function categoriaDebito(l) {
  if (!l || ENTRADAS.includes(l.tipo)) return null;
  if (l.tipo === "vt") return "vt";
  if (l.tipo === "am") return "am";
  return RX_UNIFORME.test(String(l.descricao || "")) ? "uniforme" : "outros";
}

// Débitos dos últimos N meses por categoria + créditos totais.
export function resumoPeriodo(lancamentos, meses = 12, ref = new Date()) {
  const fim = mesDe(ref), ini = somaMes(fim, 1 - meses);
  const r = { creditos: 0, debitos: 0, porCategoria: { vt: 0, am: 0, uniforme: 0, outros: 0 }, maiores: [] };
  (lancamentos || []).forEach(l => {
    const m = String(l.data || "").slice(0, 7);
    if (m < ini || m > fim || typeof l.valor !== "number") return;
    if (ENTRADAS.includes(l.tipo)) { r.creditos = r2(r.creditos + l.valor); return; }
    r.debitos = r2(r.debitos + l.valor);
    const c = categoriaDebito(l); r.porCategoria[c] = r2(r.porCategoria[c] + l.valor);
    if (c !== "vt" && c !== "am") r.maiores.push({ data: l.data, descricao: l.descricao || "", valor: l.valor });
  });
  r.resultado = r2(r.creditos - r.debitos);
  r.maiores.sort((a, b) => b.valor - a.valor); r.maiores = r.maiores.slice(0, 5);
  return r;
}

// ── Plano: parâmetros ────────────────────────────────────────
export function recorrentesAtivos(plano) { return ((plano && plano.recorrentes) || []).filter(x => x.ativo !== false && typeof x.valor === "number"); }
export function totalRecorrentes(plano) { return r2(recorrentesAtivos(plano).reduce((n, x) => n + x.valor, 0)); }

export function parametros(plano, lancamentos, ref = new Date(), creditoOficial = null) {
  const p = plano || {};
  const auto = {
    credito: (typeof creditoOficial === "number" && creditoOficial > 0) ? creditoOficial : mediaMensal(lancamentos, ENTRADAS, 3, ref),
    vt: mediaMensal(lancamentos, ["vt"], 3, ref),
    am: mediaMensal(lancamentos, ["am"], 3, ref),
  };
  const pick = (v, a) => (typeof v === "number" && Number.isFinite(v) ? v : a);
  const recorrentes = totalRecorrentes(p);
  const par = {
    auto,
    creditoMensal: pick(p.creditoMensal, auto.credito),
    vt: pick(p.vtMensal, auto.vt),
    am: pick(p.amMensal, auto.am),
    recorrentes,
    creditoManual: typeof p.creditoMensal === "number",
    vtManual: typeof p.vtMensal === "number",
    amManual: typeof p.amMensal === "number",
    creditoOficial: typeof creditoOficial === "number" && creditoOficial > 0,
  };
  par.fixos = r2(par.vt + par.am + recorrentes);
  par.margem = r2(par.creditoMensal - par.fixos);
  return par;
}

// ── Plano: lançamentos ───────────────────────────────────────
// ctx = { qtdCestas, catalogo:[{id,nome,valor}] }
export function precoCatalogo(catalogo, itemId) {
  const it = (catalogo || []).find(x => x.id === itemId);
  return it && typeof it.valor === "number" ? it.valor : 0;
}
export function valorLanc(l, ctx = {}) {
  if (!l) return 0;
  if (l.vinculo === "cestaNatal") return r2(num(Number(l.valorMedio)) * num(ctx.qtdCestas));
  if (l.vinculo === "catalogo") return r2(precoCatalogo(ctx.catalogo, l.itemId) * num(Number(l.qtd)));
  return r2(num(Number(l.valor)));
}
export function efeito(l, ctx = {}) {
  const v = valorLanc(l, ctx);
  if (l.tipo === "aporte") return v;
  if (l.tipo === "outros") return l.sinal === "+" ? v : -v;
  return -v;
}
export function pendentes(plano) { return ((plano && plano.lancamentos) || []).filter(l => !l.realizado); }
export function totalReservas(plano, ctx = {}) {
  return r2(pendentes(plano).filter(l => l.tipo === "reserva").reduce((n, l) => n + valorLanc(l, ctx), 0));
}

// ── Projeção ─────────────────────────────────────────────────
// Começa no mês seguinte. Cada mês: saldo + margem (crédito − fixos) + previstos do mês.
export function projecao({ saldoAtual, plano, lancamentos, ctx = {}, meses = 12, ref = new Date(), creditoOficial = null }) {
  const par = parametros(plano, lancamentos, ref, creditoOficial);
  const atual = mesDe(ref);
  const serie = [];
  let saldo = typeof saldoAtual === "number" ? saldoAtual : 0;
  let primeiroNegativo = null, previstosSaida = 0, previstosEntrada = 0;
  const pend = pendentes(plano);
  for (let i = 1; i <= meses; i++) {
    const mes = somaMes(atual, i);
    const doMes = pend.filter(l => (l.mes && l.mes > atual ? l.mes : somaMes(atual, 1)) === mes);
    const eventos = doMes.map(l => ({ descricao: l.descricao || PLANO_ROTULO[l.tipo], valor: efeito(l, ctx), tipo: l.tipo }));
    const extra = r2(eventos.reduce((n, e) => n + e.valor, 0));
    eventos.forEach(e => { if (e.valor < 0) previstosSaida = r2(previstosSaida - e.valor); else previstosEntrada = r2(previstosEntrada + e.valor); });
    saldo = r2(saldo + par.margem + extra);
    serie.push({ mes, saldo, margem: par.margem, extra, eventos });
    if (saldo < 0 && !primeiroNegativo) primeiroNegativo = mes;
  }
  const gastosFixos = r2(par.fixos * meses), creditos = r2(par.creditoMensal * meses + previstosEntrada);
  return {
    parametros: par, margem: par.margem, serie, primeiroNegativo,
    saldoFinal: serie.length ? serie[serie.length - 1].saldo : saldo,
    totais: { creditos, gastosFixos, previstosSaida, previstosEntrada, gastos: r2(gastosFixos + previstosSaida), resultado: r2(creditos - gastosFixos - previstosSaida) },
  };
}

export function somaAportes12(lancamentos, ref = new Date()) {
  return r2(serieMensal(lancamentos, 12, ref).reduce((n, s) => n + s.creditos, 0));
}
export function novoIdPlano(prefixo = "pl") { return prefixo + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

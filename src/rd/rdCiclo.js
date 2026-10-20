// MK RD — pastas mensais do arquivo. O "mês" do relatório é um CICLO: abre no dia seguinte ao
// fechamento (dia 20) e fecha no dia de fechamento do mês seguinte (dia 19). O ciclo leva o nome do
// mês em que FECHA: outubro/26 = 20/09 a 19/10. Se o dia de abrir cair em sábado/domingo, o ciclo
// abre na segunda; se o dia de fechar cair em sábado/domingo, fecha na sexta anterior.
// Dia não útil = sábado, domingo ou feriado nacional (fixos + móveis calculados pela Páscoa).
export const FECHAMENTO_PADRAO = 19;
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const nomeMes = (m) => MESES[m - 1] || "";

const iso = (d) => d.toISOString().slice(0, 10);
const utc = (a, m, dia) => new Date(Date.UTC(a, m - 1, dia, 12));
const dow = (d) => d.getUTCDay(); // 0 dom … 6 sáb

// Feriados nacionais do Brasil (ano a ano). Fixos + Carnaval (seg/ter), Sexta-feira Santa e Corpus Christi.
const FIXOS = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"];
function pascoa(ano) { // algoritmo de Meeus/Jones/Butcher
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1; return utc(ano, mes, dia);
}
const mais = (d, n) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; };
export function feriadosDoAno(ano) {
  const p = pascoa(ano);
  return new Set([...FIXOS.map((md) => `${ano}-${md}`), ...[-48, -47, -2, 60].map((n) => iso(mais(p, n)))]);
}
export const ehFeriado = (dataISO) => feriadosDoAno(+dataISO.slice(0, 4)).has(dataISO);
export const ehDiaUtil = (d) => !(dow(d) === 0 || dow(d) === 6 || ehFeriado(iso(d)));

export function diaFechamentoValido(v) { const d = parseInt(v, 10); return d >= 1 && d <= 28 ? d : FECHAMENTO_PADRAO; }

// Ciclo que FECHA em (ano, mes). `f` = dia de fechamento.
export function ciclo(ano, mes, f = FECHAMENTO_PADRAO) {
  f = diaFechamentoValido(f);
  const pa = mes === 1 ? ano - 1 : ano, pm = mes === 1 ? 12 : mes - 1; // mês anterior
  const ini = utc(pa, pm, f + 1);
  while (!ehDiaUtil(ini)) ini.setUTCDate(ini.getUTCDate() + 1);
  const fim = utc(ano, mes, f);
  while (!ehDiaUtil(fim)) fim.setUTCDate(fim.getUTCDate() - 1);
  return { ano, mes, chave: `${ano}-${String(mes).padStart(2, "0")}`, nome: `${nomeMes(mes)} de ${String(ano).slice(2)}`, de: iso(ini), ate: iso(fim) };
}

// Em qual pasta cai uma data: dia > f vai para o ciclo do mês seguinte; senão, do próprio mês.
// (Um fim de semana entre o fechamento ajustado e a abertura ajustada cai pelo dia do mês.)
export function cicloDaData(dataISO, f = FECHAMENTO_PADRAO) {
  f = diaFechamentoValido(f);
  const a = +dataISO.slice(0, 4), m = +dataISO.slice(5, 7), d = +dataISO.slice(8, 10);
  if (d <= f) return ciclo(a, m, f);
  return m === 12 ? ciclo(a + 1, 1, f) : ciclo(a, m + 1, f);
}

// Último dia útil do ciclo = dia em que o consolidado do mês é gerado ao arquivar.
export const ehUltimoDiaDoCiclo = (dataISO, f = FECHAMENTO_PADRAO) => cicloDaData(dataISO, f).ate === dataISO;

// Pastas de um ano. 2026 mostra só out–dez (meses do teste); demais anos, os 12.
export function mesesDoAno(ano) { const ini = ano === 2026 ? 10 : 1; return Array.from({ length: 13 - ini }, (_, i) => ini + i); }
export const ANOS_PASTA = [2026, 2027];

// Exportação simples da pasta (CSV com ; — abre no Excel em pt-BR).
export function csvDoCiclo(linhas) {
  const q = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  return "﻿" + ["Data;Trechos;Km;Projetos", ...linhas.map((l) => [l.data, l.trechos, String(l.km ?? 0).replace(".", ","), q(l.projetos)].join(";"))].join("\r\n");
}

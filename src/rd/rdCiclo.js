// MK RD — pastas mensais do arquivo. O "mês" do relatório é um CICLO: abre no dia seguinte ao
// fechamento (dia 20) e fecha no dia de fechamento do mês seguinte (dia 19). O ciclo leva o nome do
// mês em que FECHA: outubro/26 = 20/09 a 19/10. Se o dia de abrir cair em sábado/domingo, o ciclo
// abre na segunda; se o dia de fechar cair em sábado/domingo, fecha na sexta anterior.
// (Só fim de semana é considerado "não útil"; feriados não entram nesta fase.)
export const FECHAMENTO_PADRAO = 19;
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const nomeMes = (m) => MESES[m - 1] || "";

const iso = (d) => d.toISOString().slice(0, 10);
const utc = (a, m, dia) => new Date(Date.UTC(a, m - 1, dia, 12));
const dow = (d) => d.getUTCDay(); // 0 dom … 6 sáb

export function diaFechamentoValido(v) { const d = parseInt(v, 10); return d >= 1 && d <= 28 ? d : FECHAMENTO_PADRAO; }

// Ciclo que FECHA em (ano, mes). `f` = dia de fechamento.
export function ciclo(ano, mes, f = FECHAMENTO_PADRAO) {
  f = diaFechamentoValido(f);
  const pa = mes === 1 ? ano - 1 : ano, pm = mes === 1 ? 12 : mes - 1; // mês anterior
  const ini = utc(pa, pm, f + 1);
  while (dow(ini) === 0 || dow(ini) === 6) ini.setUTCDate(ini.getUTCDate() + 1);
  const fim = utc(ano, mes, f);
  while (dow(fim) === 0 || dow(fim) === 6) fim.setUTCDate(fim.getUTCDate() - 1);
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

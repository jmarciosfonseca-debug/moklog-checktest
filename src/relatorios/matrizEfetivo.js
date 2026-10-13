// Matriz de Dimensionamento de Efetivo e Mapeamento de Postos — padrão Moked (cabeçalho oficial, tabela por unidade/escala,
// totalizador). Fonte do previsto: equipe/quadroPrevisto.js. Ativos/vagas entram quando `ocupacoes` é informado.
import { documentoMoked, escHTML, dataBR } from "./padraoMoked";
import { ORDEM_PROJETOS, QUADRO_PREVISTO, totalQuadro, totalGeral, TOTAL_HOMOLOGADO } from "../equipe/quadroPrevisto";

const pct = (n) => (n === null || n === undefined ? "—" : `${n}%`);

export function numeroMatriz(hoje) {
  const d = hoje instanceof Date ? hoje : new Date(hoje);
  return `MK-ME-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

// nomes: { P601: "Golgi Cajamar", ... } · ocupacoes: { P601: resultado de ocupacaoDoQuadro(...) } (opcional)
export function montarMatrizEfetivo({ nomes = {}, ocupacoes = null, hoje = new Date() } = {}) {
  const numero = numeroMatriz(hoje);
  const temOcup = !!ocupacoes && Object.keys(ocupacoes).length > 0;
  const total = totalGeral();
  const nomeDe = (pid) => escHTML(nomes[pid] || "");
  const comDados = temOcup ? ORDEM_PROJETOS.filter((pid) => ocupacoes[pid]) : [];
  const parcial = temOcup && comDados.length < ORDEM_PROJETOS.length;
  const previstoComDados = comDados.reduce((s, pid) => s + totalQuadro(pid), 0);
  const ativosTotal = temOcup ? comDados.reduce((s, pid) => s + ocupacoes[pid].ativos, 0) : null;
  const vagasTotal = temOcup ? comDados.reduce((s, pid) => s + ocupacoes[pid].vagas, 0) : null;
  const ocupTotal = temOcup && previstoComDados ? Math.round(ativosTotal / previstoComDados * 100) : null;
  const notaParcial = parcial ? `dados de ${comDados.length} de ${ORDEM_PROJETOS.length} unidades` : null;
  const postosTotal = ORDEM_PROJETOS.reduce((s, pid) => s + QUADRO_PREVISTO[pid].length, 0);

  const kpis = `<div class="mk-kpis">
    <div class="mk-k"><div class="mk-kl">Efetivo homologado</div><div class="mk-kv">${total}</div><div class="mk-nota">colaboradores previstos no quadro</div></div>
    <div class="mk-k"><div class="mk-kl">Unidades operacionais</div><div class="mk-kv">${ORDEM_PROJETOS.length}</div><div class="mk-nota">${postosTotal} postos mapeados</div></div>
    <div class="mk-k"><div class="mk-kl">Ativos hoje</div><div class="mk-kv">${temOcup ? ativosTotal : "—"}</div><div class="mk-nota">${temOcup ? (notaParcial || `${pct(ocupTotal)} do quadro`) : "não informado nesta emissão"}</div></div>
    <div class="mk-k"><div class="mk-kl">Postos vagos</div><div class="mk-kv ${temOcup && vagasTotal ? "mk-da" : ""}">${temOcup ? vagasTotal : "—"}</div><div class="mk-nota">${temOcup ? (notaParcial || "colaboradores a repor") : "não informado nesta emissão"}</div></div>
  </div>`;

  const regras = `<section><div class="mk-h2">Regras de cobertura por escala</div>
    <table class="mk-tb"><thead><tr><th>Escala</th><th>Regime</th><th>Composição por posto</th><th class="mk-num">Colaboradores</th></tr></thead><tbody>
    <tr><td><b>4x2</b></td><td>24h contínuo</td><td>1 Diurno + 1 Noturno + 1 Folguista (cobertura de folgas)</td><td class="mk-num">3</td></tr>
    <tr><td><b>12x36</b></td><td>24h contínuo</td><td>2 Diurnos (A/B) + 2 Noturnos (A/B)</td><td class="mk-num">4</td></tr>
    <tr><td><b>12x36</b></td><td>12h diurno</td><td>1 Diurno Turma A + 1 Diurno Turma B</td><td class="mk-num">2</td></tr>
    <tr><td><b>5x2</b></td><td>Diurna / comercial</td><td>Titulares diurnos fixos, conforme o posto</td><td class="mk-num">1 ou 2</td></tr>
    </tbody></table></section>`;

  const linhaResumo = (pid) => {
    const o = temOcup ? ocupacoes[pid] : null;
    return `<tr><td><b>${escHTML(pid)}</b></td><td>${nomeDe(pid)}</td><td class="mk-num">${QUADRO_PREVISTO[pid].length}</td><td class="mk-num"><b>${totalQuadro(pid)}</b></td>${temOcup ? `<td class="mk-num">${o ? o.ativos : "—"}</td><td class="mk-num">${o ? (o.vagas ? `<b class="mk-da">${o.vagas}</b>` : "0") : "—"}</td><td class="mk-num">${o ? pct(o.ocupacaoPct) : "—"}</td>` : ""}</tr>`;
  };
  const resumo = `<section><div class="mk-h2">Resumo por unidade</div>
    <table class="mk-tb mk-fixa">${temOcup ? '<colgroup><col style="width:9%"><col style="width:31%"><col style="width:10%"><col style="width:12%"><col style="width:12%"><col style="width:12%"><col style="width:14%"></colgroup>' : '<colgroup><col style="width:12%"><col style="width:48%"><col style="width:20%"><col style="width:20%"></colgroup>'}<thead><tr><th>Projeto</th><th>Unidade</th><th class="mk-num">Postos</th><th class="mk-num">Previsto</th>${temOcup ? '<th class="mk-num">Ativos</th><th class="mk-num">Vagas</th><th class="mk-num">Ocupação</th>' : ""}</tr></thead>
    <tbody>${ORDEM_PROJETOS.map(linhaResumo).join("")}
    <tr class="mk-tot"><td colspan="3"><b>Total geral consolidado</b></td><td class="mk-num"><b>${total}</b></td>${temOcup ? `<td class="mk-num"><b>${ativosTotal}</b></td><td class="mk-num"><b>${vagasTotal}</b></td><td class="mk-num"><b>${pct(ocupTotal)}</b></td>` : ""}</tr></tbody></table></section>`;

  const blocoUnidade = (pid) => {
    const o = temOcup ? ocupacoes[pid] : null;
    const linhas = (o ? o.linhas : QUADRO_PREVISTO[pid].map((x) => ({ ...x }))).map((x) => `<tr><td><b>${escHTML(x.cargo)}</b></td><td>${escHTML(x.regime)}</td><td>${escHTML(x.escala)}</td><td class="mk-mu">${escHTML(x.composicao)}</td><td class="mk-num"><b>${x.qtd}</b></td>${o ? `<td class="mk-num">${x.ocupados}</td><td class="mk-num">${x.vagas ? `<b class="mk-da">${x.vagas}</b>` : "0"}</td>` : ""}</tr>`).join("");
    const nota = o && (o.semPosto || o.excedente) ? `<div class="mk-nota">${o.semPosto ? `${o.semPosto} colaborador(es) ativo(s) com cargo não identificado em nenhum posto; ` : ""}${o.excedente ? `${o.excedente} acima do previsto. ` : ""}As vagas por posto consideram apenas os cargos reconhecidos; o total da unidade (${o.previsto} − ${o.ativos} ativos) é exato.</div>` : "";
    return `<section style="page-break-inside:avoid"><div class="mk-h2">${escHTML(pid)} — ${nomeDe(pid)} <span class="mk-mu">· ${totalQuadro(pid)} colaboradores</span></div>
      <table class="mk-tb mk-fixa">${o ? '<colgroup><col style="width:25%"><col style="width:14%"><col style="width:8%"><col style="width:33%"><col style="width:9%"><col style="width:6%"><col style="width:5%"></colgroup>' : '<colgroup><col style="width:26%"><col style="width:15%"><col style="width:9%"><col style="width:41%"><col style="width:9%"></colgroup>'}<thead><tr><th>Posto</th><th>Regime</th><th>Escala</th><th>Composição</th><th class="mk-num">Previsto</th>${o ? '<th class="mk-num">Ativos</th><th class="mk-num">Vagas</th>' : ""}</tr></thead>
      <tbody>${linhas}<tr class="mk-tot"><td colspan="4"><b>Total ${escHTML(pid)}</b></td><td class="mk-num"><b>${totalQuadro(pid)}</b></td>${o ? `<td class="mk-num"><b>${o.ativos}</b></td><td class="mk-num"><b>${o.vagas}</b></td>` : ""}</tr></tbody></table>${nota}</section>`;
  };

  const css = `<style>.mk-tot td{border-top:1.5px solid #111827;background:#F9FAFB}.mk-num{text-align:right;white-space:nowrap}.mk-da{color:#B91C1C}</style>`;
  const fecho = `<p class="mk-nota">Gabarito oficial de dimensionamento Moked: ${total === TOTAL_HOMOLOGADO ? `${TOTAL_HOMOLOGADO} colaboradores homologados em ${ORDEM_PROJETOS.length} unidades` : `${total} colaboradores`}. Ativos e vagas vêm do cadastro de equipe do MokLog CheckTest na data de emissão; vaga = previsto − ativos.${parcial ? ` Totais parciais: ${ORDEM_PROJETOS.length - comDados.length} unidade(s) sem cadastro de equipe no sistema.` : ""}</p>`;
  return documentoMoked({
    project: { id: "", name: "Rede Moked" }, titulo: "Matriz de Dimensionamento de Efetivo", numero, hoje, tag: "ACESSO GERENCIAL", empresaLogo: false,
    subtitulo: `Mapeamento de postos, escalas e efetivo · ${ORDEM_PROJETOS.length} unidades operacionais · referência ${dataBR(`${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`)}`,
    corpo: css + kpis + resumo + regras + ORDEM_PROJETOS.map(blocoUnidade).join("") + fecho,
    rodape: `${numero} · Matriz de Dimensionamento de Efetivo · Moked Consulting Security · MokLog CheckTest`,
  });
}

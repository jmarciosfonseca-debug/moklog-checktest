// ─────────────────────────────────────────────────────────────
// CFTV — Tempo de Gravação no padrão Moked, compacto: duas câmeras por linha,
// lado a lado (1 | 2, 3 | 4 …). Tabela única: quebra de página natural, cabeçalho
// repetido em cada folha e assinatura presa às últimas linhas (mesmo fecho da CCO).
// Só apresentação: ordenação, faixas (<15 / <30 / ≥30) e contagens são as mesmas
// do relatório anterior (TempoGravacao.jsx, gerarPDFGravacao até 924eef7).
// ─────────────────────────────────────────────────────────────
import { documentoMoked, escHTML, blocoFimMoked } from "./padraoMoked";
import { tabelaComFecho, MARCA_FECHO } from "./ccoRelatorio";

const temDias = (c) => c.diasGravacao !== null && c.diasGravacao !== undefined;

// Mesmas regras do relatório anterior (não alterar sem decisão do Marcio).
export function analisarGravacao(cameras) {
  const lista = Array.isArray(cameras) ? cameras : [];
  const ordenadas = [...lista].sort((a, b) => (a.diasGravacao || 0) - (b.diasGravacao || 0));
  const abaixo30 = ordenadas.filter(c => temDias(c) && c.diasGravacao < 30).length;
  const ok30 = lista.filter(c => c.diasGravacao >= 30).length;
  return { total: lista.length, abaixo30, ok30, ordenadas };
}

export function faixaGravacao(c) {
  if (!temDias(c)) return "sem";
  return c.diasGravacao < 15 ? "critico" : c.diasGravacao < 30 ? "atencao" : "ok";
}

const fmtCheck = (ts) => {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return escHTML(ts);
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

function selo(c) {
  const f = faixaGravacao(c);
  if (f === "sem") return '<span class="mk-nao">—</span>';
  const v = c.diasGravacao === "" ? "—" : `${escHTML(c.diasGravacao)} d`;
  const cls = f === "critico" ? "mk-b-da" : f === "atencao" ? "mk-b-wa" : "mk-b-ok";
  return `<span class="mk-b ${cls}">${v}</span>`;
}

const celulas = (x) => x
  ? `<td class="mk-num mk-mu">${x.n}</td><td><b>${escHTML(x.c.nome || "—")}</b>${x.c.especificacao ? `<div class="mk-mu">${escHTML(x.c.especificacao)}</div>` : ""}</td><td>${selo(x.c)}</td><td><span class="mk-sm">${fmtCheck(x.c.ultimaChecagem)}</span>${x.c.checadoPor ? `<div class="mk-mu">${escHTML(x.c.checadoPor)}</div>` : ""}</td>`
  : '<td></td><td></td><td></td><td></td>';

// Pares na ordem: linha j = câmera 2j+1 (esquerda) e 2j+2 (direita).
export function paresLadoALado(ordenadas) {
  const itens = ordenadas.map((c, i) => ({ c, n: i + 1 }));
  const pares = [];
  for (let i = 0; i < itens.length; i += 2) pares.push([itens[i], itens[i + 1] || null]);
  return pares;
}

const COLS = '<col style="width:4%"><col style="width:20%"><col style="width:9.5%"><col style="width:14.5%">';
const CAB = '<th class="mk-num">#</th><th>Câmera</th><th>Gravação</th><th>Última checagem</th>';

export function montarRelatorioGravacao(project, cameras, { hoje = new Date() } = {}) {
  const a = analisarGravacao(cameras);
  const numero = `MK-${project.id}-CFTV-${String(hoje.getMonth() + 1).padStart(2, "0")}${String(hoje.getDate()).padStart(2, "0")}`;
  const kpis = `<div class="mk-kpis" style="grid-template-columns:repeat(3,1fr)">
<div class="mk-k"><div class="mk-kv">${a.total}</div><div class="mk-kl">câmeras cadastradas</div></div>
<div class="mk-k"><div class="mk-kv${a.abaixo30 ? " mk-da" : ""}">${a.abaixo30}</div><div class="mk-kl">abaixo de 30 dias de gravação</div></div>
<div class="mk-k"><div class="mk-kv mk-ok">${a.ok30}</div><div class="mk-kl">com 30 dias ou mais</div></div></div>
<p class="mk-nota">Ordem: menor tempo de gravação primeiro. Faixas: <span class="mk-b mk-b-da">abaixo de 15 d</span> <span class="mk-b mk-b-wa">15 a 29 d</span> <span class="mk-b mk-b-ok">30 d ou mais</span> · "—" = sem medição. Duas câmeras por linha, numeradas na ordem.</p>`;
  const linhas = paresLadoALado(a.ordenadas).map(([e, d]) => `<tr>${celulas(e)}<td class="mk-cftv-sep"></td>${celulas(d)}</tr>`);
  const estilo = `<style>.mk-cftv{font-size:8.6pt;line-height:1.15}.mk-cftv td{padding:3px 4px;overflow-wrap:anywhere}.mk-cftv th{padding:4px 4px}.mk-cftv .mk-mu{font-size:7.8pt;line-height:1.15}.mk-cftv td.mk-cftv-sep,.mk-cftv th.mk-cftv-sep{border:none;padding:0}.mk-cftv thead{display:table-header-group}</style>`;
  const tabela = a.total ? tabelaComFecho(`<table class="mk-tb mk-fixa mk-cftv"><colgroup>${COLS}<col style="width:2%">${COLS}</colgroup><thead><tr>${CAB}<th class="mk-cftv-sep"></th>${CAB}</tr></thead><tbody>`, linhas, "</tbody></table>", 9) : `<div class="mk-vazio"><b>Nenhuma câmera cadastrada neste projeto.</b></div>${MARCA_FECHO}`;
  const corpo = (estilo + `<h2 class="mk-h2">Situação da gravação</h2>` + kpis + tabela).replace(MARCA_FECHO, blocoFimMoked());
  const html = documentoMoked({ project, titulo: "CFTV — Tempo de Gravação", subtitulo: `${escHTML(project.id)} — ${escHTML(project.name || "")} · posição em ${hoje.toLocaleDateString("pt-BR")}`, numero, corpo, hoje, fimEmbutido: true });
  return { html, numero, analise: a };
}

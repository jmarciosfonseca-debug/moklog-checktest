// ─────────────────────────────────────────────────────────────
// Inventário de Equipamentos no padrão Moked (Marcio, 17/11/2026: "esse relatório está fora do padrão").
// Só apresentação: mesmas seções, colunas, contagens e regras do relatório anterior (Equipamentos.jsx,
// gerarPDFEquipamentos até 4a08185) — cabeçalho, numeração, tipografia, tabelas e fecho passam a ser os de padraoMoked.
// ─────────────────────────────────────────────────────────────
import { documentoMoked, escHTML, dataBR, blocoFimMoked } from "./padraoMoked";

const ROTULO = { ok: "OK", parcial: "Parcial", inop: "Inoperante", baixo: "Baixo", critico: "Crítico" };
const CLASSE = { ok: "mk-b-ok", parcial: "mk-b-wa", baixo: "mk-b-wa", inop: "mk-b-da", critico: "mk-b-da" };
const st = (i) => (i && ROTULO[i.status] ? i.status : "ok");
const comProblema = (i) => st(i) !== "ok";
const selo = (i) => `<span class="mk-b ${CLASSE[st(i)]}">${ROTULO[st(i)]}</span>`;
const txt = (v) => (v === null || v === undefined || v === "" ? "—" : escHTML(v));

// Seções na ordem do relatório anterior. cols = colunas além de Identificação / Status / Observação.
export const SECOES_EQUIPAMENTOS = [
  { chave: "outros", titulo: "Outros equipamentos", cols: ["Quantidade"] },
  { chave: "smartphones", titulo: "Smartphones", cols: [] },
  { chave: "radiosHT", titulo: "Rádios HT", cols: ["Marca"] },
  { chave: "armamento", titulo: "Armamento", cols: ["Calibre", "Nº série", "Armeiro", "Últ. manutenção"] },
  { chave: "municao", titulo: "Munição", cols: ["Quantidade"] },
  { chave: "placas", titulo: "Placas balísticas", cols: ["Nº série", "Validade"] },
  { chave: "lanternas", titulo: "Lanternas", cols: [] },
  { chave: "ztrax", titulo: "Pânico ZTRAX", cols: [] },
  { chave: "bodycam", titulo: "Bodycam", cols: [] },
];

// Mesma contagem do relatório anterior: todos os itens das seções + a moto (quando cadastrada).
export function resumoEquipamentos(data = {}) {
  const itens = [...SECOES_EQUIPAMENTOS.flatMap((s) => (Array.isArray(data[s.chave]) ? data[s.chave] : [])), ...(data.moto ? [data.moto] : [])].filter(Boolean);
  const conta = (lista) => itens.filter((i) => lista.includes(i.status)).length;
  return { total: itens.length, inop: conta(["inop", "critico"]), parcial: conta(["parcial", "baixo"]), ok: itens.filter((i) => !i.status || i.status === "ok").length };
}

function celula(col, r, hoje) {
  if (col === "Marca") return `<td>${txt(r.marca)}</td>`;
  if (col === "Calibre") return `<td>${txt(r.calibre)}</td>`;
  if (col === "Nº série") return `<td>${txt(r.nSerie)}</td>`;
  if (col === "Armeiro") return `<td>${txt(r.armeiro)}</td>`;
  if (col === "Últ. manutenção") return `<td>${r.dataManutencao ? dataBR(r.dataManutencao) : "—"}</td>`;
  if (col === "Quantidade") return `<td><b>${escHTML(r.qtd || 0)}</b></td>`;
  if (col === "Validade") {
    if (!r.validade) return "<td>—</td>";
    const vencida = new Date(r.validade) < hoje;
    return `<td class="${vencida ? "mk-da" : ""}">${dataBR(r.validade)}${vencida ? ' <span class="mk-b mk-b-da">vencida</span>' : ""}</td>`;
  }
  return "<td>—</td>";
}

function observacao(i, hoje) {
  if (!comProblema(i)) return "—";
  const dias = i.dataProblem ? Math.max(0, Math.floor((hoje.getTime() - new Date(i.dataProblem + "T12:00:00").getTime()) / 86400000)) : 0;
  return `<b class="mk-da">${dias} d em aberto</b>${i.justificativa ? `<div class="mk-mu">${escHTML(i.justificativa)}</div>` : ""}`;
}

function secao(s, itens, hoje) {
  if (!itens.length) return "";
  const n = itens.filter(comProblema).length;
  const cab = ["Identificação", ...s.cols, "Status", "Observação"].map((h) => `<th>${h}</th>`).join("");
  const linhas = itens.map((r) => `<tr><td><b>${txt(r.identificacao)}</b></td>${s.cols.map((c) => celula(c, r, hoje)).join("")}<td>${selo(r)}</td><td>${observacao(r, hoje)}</td></tr>`).join("");
  return `<section class="mk-eq-sec"><h2 class="mk-h2">${s.titulo} <span class="mk-mu">· ${itens.length} ${itens.length === 1 ? "item" : "itens"}</span>${n ? ` <span class="mk-b mk-b-da">${n} com problema</span>` : ""}</h2>
<table class="mk-tb mk-eq"><thead><tr>${cab}</tr></thead><tbody>${linhas}</tbody></table></section>`;
}

function secaoMoto(moto) {
  if (!moto || !moto.placa) return "";
  const km = (v) => (v || v === 0 ? `${escHTML(v)} km` : "—");
  const vencido = moto.km && moto.kmManutencao && Number(moto.km) >= Number(moto.kmManutencao);
  const ult = moto.ultimaManutencao || ((moto.historico || [])[0] || {}).data;
  const hist = (moto.historico || []).slice(0, 5);
  const res = moto.reservaAtual;
  return `<section class="mk-eq-sec"><h2 class="mk-h2">Motocicleta${comProblema(moto) ? ` <span class="mk-b ${CLASSE[st(moto)]}">${ROTULO[st(moto)]}</span>` : ""}${vencido ? ' <span class="mk-b mk-b-da">km de manutenção atingido</span>' : ""}</h2>
<table class="mk-tb mk-eq"><thead><tr><th>Placa</th><th>Modelo</th><th>Ano</th><th>Km atual</th><th>Km da manutenção</th><th>Últ. manutenção</th></tr></thead>
<tbody><tr><td><b>${txt(moto.placa)}</b></td><td>${txt(moto.modelo)}</td><td>${txt(moto.ano)}</td><td${vencido ? " class=\"mk-da\"" : ""}><b>${km(moto.km)}</b></td><td>${km(moto.kmManutencao)}</td><td>${ult ? dataBR(ult) : "—"}</td></tr></tbody></table>
${res ? `<p class="mk-nota"><b>Moto reserva em uso</b>${res.placa ? ` (${escHTML(res.placa)})` : ""}: chegou com ${km(res.kmInicial)} · km atual ${km(res.km)}${res.desde ? ` · desde ${dataBR(res.desde)}` : ""}. A moto principal está parada no km acima.</p>` : ""}
${hist.length ? `<table class="mk-tb mk-eq" style="margin-top:6px"><thead><tr><th style="width:18%">Manutenção em</th><th style="width:16%">Km</th><th>Descrição</th></tr></thead><tbody>${hist.map((h) => `<tr><td>${h.data ? dataBR(h.data) : "—"}</td><td>${km(h.km)}</td><td>${txt(h.desc)}</td></tr>`).join("")}</tbody></table>` : ""}</section>`;
}

export function montarRelatorioEquipamentos(project, data = {}, { hoje = new Date() } = {}) {
  const r = resumoEquipamentos(data);
  const numero = `MK-${project.id}-EQ-${String(hoje.getMonth() + 1).padStart(2, "0")}${String(hoje.getDate()).padStart(2, "0")}`;
  const kpis = `<div class="mk-kpis" style="grid-template-columns:repeat(4,1fr)">
<div class="mk-k"><div class="mk-kv">${r.total}</div><div class="mk-kl">itens no inventário</div></div>
<div class="mk-k"><div class="mk-kv mk-ok">${r.ok}</div><div class="mk-kl">ok</div></div>
<div class="mk-k"><div class="mk-kv${r.parcial ? " mk-wa" : ""}">${r.parcial}</div><div class="mk-kl">parcial ou baixo</div></div>
<div class="mk-k"><div class="mk-kv${r.inop ? " mk-da" : ""}">${r.inop}</div><div class="mk-kl">inoperante ou crítico</div></div></div>`;
  const secoes = SECOES_EQUIPAMENTOS.map((s) => secao(s, (Array.isArray(data[s.chave]) ? data[s.chave] : []).filter(Boolean), hoje)).join("") + secaoMoto(data.moto);
  const estilo = `<style>.mk-eq{font-size:9.2pt}.mk-eq td{padding:4px 6px;vertical-align:top;overflow-wrap:anywhere}.mk-eq th{padding:4px 6px}.mk-eq-sec{break-inside:avoid;margin-top:2px}.mk-eq-sec .mk-h2{margin-bottom:4px}</style>`;
  const corpo = estilo + `<h2 class="mk-h2">Situação do inventário</h2>` + kpis + (r.total ? secoes : `<div class="mk-vazio"><b>Nenhum equipamento cadastrado neste projeto.</b></div>`) + blocoFimMoked();
  const html = documentoMoked({ project, titulo: "Inventário de Equipamentos", subtitulo: `${escHTML(project.id)} — ${escHTML(project.name || "")} · posição em ${hoje.toLocaleDateString("pt-BR")}`, numero, corpo, hoje, fimEmbutido: true });
  return { html, numero, resumo: r };
}

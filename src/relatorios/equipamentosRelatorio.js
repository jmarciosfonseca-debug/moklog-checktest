// ─────────────────────────────────────────────────────────────
// Inventário de Equipamentos no padrão Moked (Marcio, 17/11/2026: "esse relatório está fora do padrão").
// 18/11: compacto (uma tabela só, sem ícones) + "Pendências em aberto" + "Histórico de pendências e trocas" (dias para resolver).
// Só apresentação: mesmas seções, colunas, contagens e regras do relatório anterior (Equipamentos.jsx,
// gerarPDFEquipamentos até 4a08185) — cabeçalho, numeração, tipografia, tabelas e fecho passam a ser os de padraoMoked.
// ─────────────────────────────────────────────────────────────
import { documentoMoked, escHTML, dataBR, blocoFimMoked } from "./padraoMoked";
import { diasEntre } from "../equipamentosOcorrencias";

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

const ROT_CAT = Object.fromEntries(SECOES_EQUIPAMENTOS.map((s) => [s.chave, s.titulo]));
ROT_CAT.moto = "Motocicleta";
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
// `em` (ISO com hora, UTC) → data do dia em Brasília
const diaBR = (em) => { if (!em) return ""; const d = new Date(em); return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }); };
const diasTxt = (n) => (n === null || n === undefined ? "—" : `${n} d`);

// Pendências abertas (estado atual) e histórico (ocorrências fechadas + baixas), de todos os equipamentos.
export function pendenciasDoInventario(data = {}, hoje = new Date()) {
  const h = iso(hoje);
  const abertas = [], historico = [];
  const todos = [...SECOES_EQUIPAMENTOS.flatMap((s) => (Array.isArray(data[s.chave]) ? data[s.chave] : []).filter(Boolean).map((i) => ({ i, cat: s.chave }))), ...(data.moto && data.moto.placa ? [{ i: data.moto, cat: "moto" }] : [])];
  for (const { i, cat } of todos) {
    const nome = cat === "moto" ? `Moto ${i.placa}` : i.identificacao;
    if (comProblema(i)) abertas.push({ nome, cat, status: st(i), abertaEm: i.dataProblem || "", dias: diasEntre(i.dataProblem, h), motivo: i.justificativa || "" });
    for (const o of Array.isArray(i.ocorrencias) ? i.ocorrencias : []) if (o && o.fechadaEm) historico.push({ nome, cat, tipo: "Resolvida", abertaEm: o.abertaEm || "", fechadaEm: o.fechadaEm, dias: diasEntre(o.abertaEm, o.fechadaEm), motivo: o.justificativa || "", por: o.fechadaPor || "" });
  }
  for (const b of Array.isArray(data.baixados) ? data.baixados : []) {
    if (!b || !b.baixa) continue;
    const fechada = diaBR(b.baixa.em);
    const emAberto = Array.isArray(b.ocorrencias) ? [...b.ocorrencias].reverse().find((o) => o && !o.fechadaEm) : null;
    const abertaEm = (emAberto && emAberto.abertaEm) || (comProblema(b) ? b.dataProblem : "") || "";
    historico.push({ nome: b.identificacao || "—", cat: b.categoria, tipo: b.baixa.motivo || "Baixa", abertaEm, fechadaEm: fechada, dias: abertaEm && fechada ? diasEntre(abertaEm, fechada) : null, motivo: [b.baixa.obs, emAberto && emAberto.justificativa].filter(Boolean).join(" · "), por: b.baixa.por || "" });
  }
  abertas.sort((a, b) => (b.dias ?? -1) - (a.dias ?? -1));
  historico.sort((a, b) => String(b.fechadaEm).localeCompare(String(a.fechadaEm)));
  const comDias = historico.filter((x) => x.tipo === "Resolvida" && x.dias !== null);
  const media = comDias.length ? Math.round((comDias.reduce((t, x) => t + x.dias, 0) / comDias.length) * 10) / 10 : null;
  const maior = comDias.length ? Math.max(...comDias.map((x) => x.dias)) : null;
  return { abertas, historico, resumo: { resolvidas: comDias.length, trocas: historico.filter((x) => x.tipo !== "Resolvida").length, media, maior } };
}

function detalhe(chave, r, hoje) {
  const p = [];
  if (chave === "radiosHT" && r.marca) p.push(escHTML(r.marca));
  if (chave === "armamento") {
    if (r.calibre) p.push(`Cal. ${escHTML(r.calibre)}`);
    if (r.nSerie) p.push(`Série ${escHTML(r.nSerie)}`);
    if (r.armeiro) p.push(`Armeiro ${escHTML(r.armeiro)}`);
    if (r.dataManutencao) p.push(`Manut. ${dataBR(r.dataManutencao)}`);
  }
  if (chave === "placas") {
    if (r.nSerie) p.push(`Série ${escHTML(r.nSerie)}`);
    if (r.validade) { const v = new Date(r.validade) < hoje; p.push(`Val. ${dataBR(r.validade)}${v ? ' <span class="mk-b mk-b-da">vencida</span>' : ""}`); }
  }
  if (chave === "municao" || chave === "outros") p.push(`<b>${escHTML(r.qtd || 0)}</b> ${chave === "municao" ? "un." : ""}`.trim());
  return p.length ? p.join(" · ") : "—";
}

function inventario(data, hoje) {
  const h = iso(hoje);
  const grupos = SECOES_EQUIPAMENTOS.map((s) => ({ s, itens: (Array.isArray(data[s.chave]) ? data[s.chave] : []).filter(Boolean) })).filter((g) => g.itens.length);
  if (!grupos.length) return "";
  const linhas = grupos.map(({ s, itens }) => itens.map((r, k) => {
    const d = comProblema(r) ? diasEntre(r.dataProblem, h) : null;
    const cat = k === 0 ? `<td class="mk-eq-cat" rowspan="${itens.length}">${s.titulo}<div class="mk-mu">${itens.length} ${itens.length === 1 ? "item" : "itens"}</div></td>` : "";
    return `<tr${k === 0 ? ' class="mk-eq-ini"' : ""}>${cat}<td><b>${txt(r.identificacao)}</b></td><td>${detalhe(s.chave, r, hoje)}</td><td>${selo(r)}${d !== null ? ` <span class="mk-da mk-sm">${d} d</span>` : ""}</td></tr>`;
  }).join("")).join("");
  return `<h2 class="mk-h2">Inventário</h2><table class="mk-tb mk-eq"><thead><tr><th style="width:17%">Categoria</th><th style="width:30%">Identificação</th><th>Detalhes</th><th style="width:17%">Status</th></tr></thead><tbody>${linhas}</tbody></table>`;
}

function tabelaAbertas(abertas) {
  if (!abertas.length) return `<h2 class="mk-h2">Pendências em aberto</h2><p class="mk-vazio-linha">Nenhuma pendência de equipamento em aberto.</p>`;
  const l = abertas.map((a) => `<tr><td><b>${txt(a.nome)}</b></td><td>${escHTML(ROT_CAT[a.cat] || a.cat)}</td><td><span class="mk-b ${CLASSE[a.status]}">${ROTULO[a.status]}</span></td><td>${a.abertaEm ? dataBR(a.abertaEm) : "—"}</td><td><b class="mk-da">${diasTxt(a.dias)}</b></td><td>${txt(a.motivo)}</td></tr>`).join("");
  return `<h2 class="mk-h2">Pendências em aberto <span class="mk-b mk-b-da">${abertas.length}</span></h2><table class="mk-tb mk-eq"><thead><tr><th style="width:20%">Equipamento</th><th style="width:14%">Categoria</th><th style="width:12%">Status</th><th style="width:12%">Aberta em</th><th style="width:11%">Em aberto</th><th>Motivo</th></tr></thead><tbody>${l}</tbody></table>`;
}

const LIMITE_HISTORICO = 15;
function tabelaHistorico(p) {
  if (!p.historico.length) return `<h2 class="mk-h2">Histórico de pendências e trocas</h2><p class="mk-vazio-linha">Ainda não há pendência encerrada nem troca registrada. O histórico passa a ser montado a partir do momento em que a equipe abre e encerra as pendências no app.</p>`;
  const r = p.resumo;
  const resumo = [r.resolvidas ? `${r.resolvidas} ${r.resolvidas === 1 ? "resolvida" : "resolvidas"}` : "", r.trocas ? `${r.trocas} ${r.trocas === 1 ? "troca/baixa" : "trocas/baixas"}` : "", r.media !== null ? `média de ${String(r.media).replace(".", ",")} d para resolver` : "", r.maior !== null ? `maior: ${r.maior} d` : ""].filter(Boolean).join(" · ");
  const mostrar = p.historico.slice(0, LIMITE_HISTORICO);
  const l = mostrar.map((x) => `<tr><td><b>${txt(x.nome)}</b></td><td>${escHTML(ROT_CAT[x.cat] || x.cat || "—")}</td><td><span class="mk-b ${x.tipo === "Resolvida" ? "mk-b-ok" : "mk-b-in"}">${escHTML(x.tipo)}</span></td><td>${x.abertaEm ? dataBR(x.abertaEm) : "—"}</td><td>${x.fechadaEm ? dataBR(x.fechadaEm) : "—"}</td><td><b>${diasTxt(x.dias)}</b></td><td>${txt(x.motivo)}</td></tr>`).join("");
  const resto = p.historico.length - mostrar.length;
  return `<h2 class="mk-h2">Histórico de pendências e trocas <span class="mk-mu">· ${resumo}</span></h2><table class="mk-tb mk-eq"><thead><tr><th style="width:19%">Equipamento</th><th style="width:13%">Categoria</th><th style="width:12%">Ocorrência</th><th style="width:11%">Aberta em</th><th style="width:11%">Encerrada</th><th style="width:8%">Dias</th><th>Motivo</th></tr></thead><tbody>${l}</tbody></table>${resto > 0 ? `<p class="mk-nota">+ ${resto} registro(s) mais antigo(s) no app.</p>` : ""}`;
}

function secaoMoto(moto) {
  if (!moto || !moto.placa) return "";
  const km = (v) => (v || v === 0 ? `${escHTML(v)} km` : "—");
  const vencido = moto.km && moto.kmManutencao && Number(moto.km) >= Number(moto.kmManutencao);
  const ult = moto.ultimaManutencao || ((moto.historico || [])[0] || {}).data;
  const hist = (moto.historico || []).slice(0, 3);
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
  const pend = pendenciasDoInventario(data, hoje);
  const estilo = `<style>.mk-eq{font-size:8.6pt}.mk-eq td{padding:2.5px 6px;vertical-align:top;overflow-wrap:anywhere;line-height:1.25}.mk-eq th{padding:3px 6px}.mk-eq-cat{font-weight:700;background:#F8FAFC;border-right:1px solid #E5E7EB}.mk-eq-cat .mk-mu{font-weight:400}.mk-eq-ini td{border-top:1.5px solid #CBD5E1}.mk-kpis{margin-bottom:6px}.mk-k{padding:5px 8px}.mk-h2{margin-top:10px}.mk-vazio-linha{margin:2px 0 6px;font-size:9pt;color:#6B7280}.mk-eq-sec{break-inside:avoid}</style>`;
  const corpo = estilo + kpis + (r.total ? tabelaAbertas(pend.abertas) + tabelaHistorico(pend) + inventario(data, hoje) + secaoMoto(data.moto) : `<div class="mk-vazio"><b>Nenhum equipamento cadastrado neste projeto.</b></div>`) + blocoFimMoked();
  const html = documentoMoked({ project, titulo: "Inventário de Equipamentos", subtitulo: `${escHTML(project.id)} — ${escHTML(project.name || "")} · posição em ${hoje.toLocaleDateString("pt-BR")}`, numero, corpo, hoje, fimEmbutido: true });
  return { html, numero, resumo: r, pendencias: pend };
}

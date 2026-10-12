// Diagnóstico Situacional → entregáveis. Módulo puro (sem DOM, sem dependência nova):
//  • montarRelatorioDiagnostico: números e seções, uma única fonte para tela, PDF, TXT e cópia de segurança;
//  • gerarDiagnosticoHTML: relatório A4 no padrão Moked (abre para imprimir / salvar PDF);
//  • relatorioDiagnosticoTexto: TXT simples;
//  • copiaDeSegurancaRascunho: JSON do rascunho local (nada se perde se o salvar falhar).
// O relatório traz: leitura do diagnóstico, semáforo por categoria, plano de ação priorizado,
// padrão Moked × existente e evolução entre revisões.
import { documentoMoked, escHTML } from "../relatorios/padraoMoked";
import { padraoMokedDoItem, PADRAO_MOKED_VERSAO } from "./padraoMokedItens";

export const STATUS_LABEL = { conforme: "Conforme", parcial: "Parcial", nao_conforme: "Não conforme", ausente_necessario: "Ausente necessário", na: "Não aplicável", sem_dado: "Sem dado" };
const STATUS_BADGE = { conforme: "mk-b-ok", parcial: "mk-b-wa", nao_conforme: "mk-b-da", ausente_necessario: "mk-b-da", na: "mk-b-in", sem_dado: "mk-b-wa" };
const ACHADOS = ["nao_conforme", "ausente_necessario", "parcial", "sem_dado"]; // ordem de gravidade no relatório
const FALHAS = ["nao_conforme", "ausente_necessario"];
const CRIT_ORDEM = { critico: 0, relevante: 1, informativo: 2 };
const CRIT_LABEL = { critico: "Crítico", relevante: "Relevante", informativo: "Informativo" };

export const PRIORIDADE_LABEL = { 1: "Prioridade 1 — imediata", 2: "Prioridade 2 — curto prazo", 3: "Prioridade 3 — programar", 4: "Levantar informação" };
export const SEMAFORO_LABEL = { critico: "Crítico", atencao: "Atenção", observacao: "Observação", adequado: "Adequado", sem_resposta: "Sem resposta" };
const SEMAFORO_BADGE = { critico: "mk-b-da", atencao: "mk-b-wa", observacao: "mk-b-in", adequado: "mk-b-ok", sem_resposta: "mk-b-in" };

const texto = (v) => String(v ?? "").trim();
const dataBr = (v) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("pt-BR"); };
const dataCurta = (v) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR"); };
const slug = (v) => texto(v).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "diagnostico";

// 1 = crítico que falha; 2 = crítico parcial ou relevante que falha; 3 = demais achados; 4 = sem dado (levantar informação).
export function prioridadeAchado(criticidade, status) {
  if (status === "sem_dado") return 4;
  const falha = FALHAS.includes(status);
  if (criticidade === "critico") return falha ? 1 : 2;
  if (criticidade === "relevante") return falha ? 2 : 3;
  return 3;
}

function semaforoCategoria(achadosDaCategoria, respondidos) {
  if (!respondidos) return "sem_resposta";
  if (achadosDaCategoria.some((a) => a.prioridade === 1)) return "critico";
  if (achadosDaCategoria.some((a) => a.prioridade === 2)) return "atencao";
  if (achadosDaCategoria.length) return "observacao";
  return "adequado";
}

const RUIM = ["parcial", ...FALHAS];
// Compara a resposta atual com a da revisão anterior, item a item.
export function compararRevisoes(itens, respostas, respostasAnterior) {
  const grupos = { corrigidos: [], melhoraram: [], pioraram: [], novos: [], persistem: [] };
  itens.forEach((item) => {
    const atual = respostas[item.id]?.status;
    const antes = respostasAnterior[item.id]?.status;
    if (!atual) return;
    const base = { id: item.id, texto: item.texto, criticidade: item.criticidade || "informativo", antes, atual, resposta: respostas[item.id] || {} };
    const antesRuim = RUIM.includes(antes);
    const atualRuim = RUIM.includes(atual);
    if (antesRuim && !atualRuim && atual !== "sem_dado") grupos.corrigidos.push(base);
    else if (antes === "nao_conforme" || antes === "ausente_necessario") { if (atual === "parcial") grupos.melhoraram.push(base); else if (FALHAS.includes(atual)) grupos.persistem.push(base); }
    else if (antes === "parcial" && FALHAS.includes(atual)) grupos.pioraram.push(base);
    else if (antes === "parcial" && atual === "parcial") grupos.persistem.push(base);
    else if (antes === "conforme" && atualRuim) grupos.pioraram.push(base);
    else if (!antes || antes === "sem_dado" || antes === "na") { if (atualRuim) grupos.novos.push(base); }
  });
  return grupos;
}

export function montarRelatorioDiagnostico({ catalogo, itens = [], respostas = {}, contexto = {}, diagnosticoId = null, estado = "rascunho", geradoEm = new Date().toISOString(), anterior = null, rotuloRevisao = "" }) {
  const categorias = [...(catalogo?.categorias || [])].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  const subs = [...(catalogo?.subcategorias || [])].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  const ativos = [...itens].filter((i) => i && i.deprecado !== true).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  const secoes = categorias.map((cat) => {
    const subcategorias = subs.filter((s) => s.categoria === cat.id).map((sub) => ({
      id: sub.id, nome: sub.nome,
      itens: ativos.filter((item) => item.subcategoria === sub.id).map((item) => ({ id: item.id, texto: item.texto, criticidade: item.criticidade || "informativo", resposta: respostas[item.id] || {} })),
    }));
    const todos = subcategorias.flatMap((s) => s.itens);
    const respondidos = todos.filter((i) => STATUS_LABEL[i.resposta.status]).length;
    return { id: cat.id, nome: cat.nome, subcategorias, total: todos.length, respondidos };
  });
  const contagens = Object.keys(STATUS_LABEL).reduce((acc, st) => ({ ...acc, [st]: ativos.filter((i) => respostas[i.id]?.status === st).length }), {});
  const respondidos = Object.values(contagens).reduce((a, b) => a + b, 0);
  const achados = secoes.flatMap((s) => s.subcategorias.flatMap((sub) => sub.itens.filter((i) => ACHADOS.includes(i.resposta.status)).map((i) => ({ ...i, categoria: s.id, categoriaNome: s.nome, subcategoria: sub.id, subcategoriaNome: sub.nome, prioridade: prioridadeAchado(i.criticidade, i.resposta.status), padrao: padraoMokedDoItem(i.id) }))))
    .sort((a, b) => a.prioridade - b.prioridade || ACHADOS.indexOf(a.resposta.status) - ACHADOS.indexOf(b.resposta.status) || (CRIT_ORDEM[a.criticidade] ?? 3) - (CRIT_ORDEM[b.criticidade] ?? 3));
  const plano = [1, 2, 3, 4].map((p) => ({ prioridade: p, rotulo: PRIORIDADE_LABEL[p], itens: achados.filter((a) => a.prioridade === p) })).filter((g) => g.itens.length);
  secoes.forEach((s) => {
    const daCat = achados.filter((a) => a.categoria === s.id);
    s.semaforo = semaforoCategoria(daCat, s.respondidos);
    s.nAchados = daCat.length;
    s.porPrioridade = [1, 2, 3, 4].reduce((acc, p) => ({ ...acc, [p]: daCat.filter((a) => a.prioridade === p).length }), {});
  });
  // Padrão Moked × existente: itens com padrão definido que já foram avaliados (exceto "não aplicável").
  const padrao = secoes.flatMap((s) => s.subcategorias.flatMap((sub) => sub.itens
    .filter((i) => padraoMokedDoItem(i.id) && STATUS_LABEL[i.resposta.status] && i.resposta.status !== "na")
    .map((i) => ({ id: i.id, texto: i.texto, criticidade: i.criticidade, categoria: s.id, padrao: padraoMokedDoItem(i.id), status: i.resposta.status, resposta: i.resposta }))))
    .sort((a, b) => (FALHAS.includes(b.status) ? 1 : 0) - (FALHAS.includes(a.status) ? 1 : 0) || ACHADOS.indexOf(a.status) - ACHADOS.indexOf(b.status) || (CRIT_ORDEM[a.criticidade] ?? 3) - (CRIT_ORDEM[b.criticidade] ?? 3));
  const evolucao = anterior && anterior.respostas && Object.keys(anterior.respostas).length
    ? { rotulo: anterior.rotulo || "revisão anterior", data: anterior.data || "", ...compararRevisoes(ativos, respostas, anterior.respostas) }
    : null;
  const criticosAbertos = achados.filter((a) => a.prioridade === 1).length;
  return {
    titulo: "Diagnóstico Situacional",
    projeto: contexto.rotuloLivre || contexto.projetoRef || contexto.chave || "Projeto não identificado",
    nomeProjeto: contexto.nomeProjeto || "",
    grupo: contexto.grupo || "", catalogoId: catalogo?.id || catalogo?.catalogoId || "centro_logistico_v1_0_0",
    versao: catalogo?.versao || "", diagnosticoId, estado, rotuloRevisao, geradoEm, total: ativos.length, respondidos,
    percentual: ativos.length ? Math.round((respondidos / ativos.length) * 100) : 0,
    contagens, secoes, achados, nAchados: achados.length, plano, padrao, evolucao, criticosAbertos,
    porPrioridade: [1, 2, 3, 4].reduce((acc, p) => ({ ...acc, [p]: achados.filter((a) => a.prioridade === p).length }), {}),
  };
}

// Leitura em frases, geradas só do que foi marcado (nada inventado).
export function leituraDoDiagnostico(rel) {
  const l = [];
  if (!rel.respondidos) return ["Nenhum item foi respondido ainda."];
  if (rel.percentual < 100) l.push(`Preenchimento em ${rel.percentual}% (${rel.respondidos}/${rel.total} itens): a leitura abaixo considera só o que já foi respondido.`);
  const p1 = rel.plano.find((g) => g.prioridade === 1);
  if (p1) l.push(`${p1.itens.length} item(ns) crítico(s) não conforme(s) ou ausente(s) pedem ação imediata: ${p1.itens.slice(0, 4).map((i) => i.texto).join("; ")}${p1.itens.length > 4 ? "; …" : ""}.`);
  else l.push("Nenhum item crítico não conforme ou ausente.");
  const cats = rel.secoes.filter((s) => s.semaforo === "critico" || s.semaforo === "atencao");
  if (cats.length) l.push(`Categorias em ${cats.some((s) => s.semaforo === "critico") ? "estado crítico ou de atenção" : "atenção"}: ${cats.map((s) => `${s.id} ${s.nome}`).join("; ")}.`);
  if (rel.contagens.sem_dado) l.push(`${rel.contagens.sem_dado} item(ns) sem dado: não contam como avaliados e precisam de levantamento.`);
  const falhasPadrao = rel.padrao.filter((p) => FALHAS.includes(p.status));
  if (falhasPadrao.length) l.push(`${falhasPadrao.length} item(ns) distantes do padrão Moked de referência (ver quadro "Padrão Moked × existente").`);
  if (rel.evolucao) {
    const e = rel.evolucao;
    l.push(`Em relação à ${e.rotulo}: ${e.corrigidos.length} corrigido(s), ${e.melhoraram.length} melhorou(aram), ${e.persistem.length} persistem, ${e.pioraram.length} piorou(aram), ${e.novos.length} novo(s) achado(s).`);
  }
  return l;
}

export const nomeArquivoDiagnostico = (rel, extensao) => `diagnostico_${slug(rel.projeto)}_${String(rel.geradoEm).slice(0, 10)}.${extensao}`;
export const numeroDiagnostico = (rel) => `MK-DIA-${slug(rel.projeto).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 14) || "PROJ"}-${String(rel.geradoEm).slice(2, 10).replace(/-/g, "")}`;

const detTxt = (r) => [["Situação", r.situacao], ["Impacto", r.impacto], ["Indicação", r.indicacao], ["Observação", r.observacao]].filter(([, v]) => texto(v));

export function relatorioDiagnosticoTexto(rel) {
  const l = ["MOKLOG CHECKTEST - DIAGNÓSTICO SITUACIONAL", `Projeto: ${rel.projeto}${rel.nomeProjeto ? ` - ${rel.nomeProjeto}` : ""}`, ...(rel.rotuloRevisao ? [`Revisão: ${rel.rotuloRevisao}`] : []), `Estado: ${rel.estado}`, `Catálogo: ${rel.catalogoId} v${rel.versao}`, `Diagnóstico: ${rel.diagnosticoId || "rascunho local"}`, `Gerado em: ${dataBr(rel.geradoEm)}`, `Progresso: ${rel.respondidos}/${rel.total} (${rel.percentual}%)`, `Achados para análise: ${rel.nAchados}`, ""];
  l.push("LEITURA DO DIAGNÓSTICO", ...leituraDoDiagnostico(rel).map((x) => `  - ${x}`), "");
  l.push("SEMÁFORO POR CATEGORIA", ...rel.secoes.map((s) => `  ${s.id} ${s.nome}: ${SEMAFORO_LABEL[s.semaforo]} (${s.respondidos}/${s.total} respondidos, ${s.nAchados} achado(s))`), "");
  if (rel.plano.length) {
    l.push("PLANO DE AÇÃO PRIORIZADO");
    rel.plano.forEach((g) => {
      l.push(`  ${g.rotulo}`);
      g.itens.forEach((a) => {
        l.push(`    [${STATUS_LABEL[a.resposta.status]}] ${a.id} - ${a.texto} (${CRIT_LABEL[a.criticidade] || a.criticidade})`);
        detTxt(a.resposta).forEach(([k, v]) => l.push(`      ${k}: ${texto(v)}`));
        if (a.padrao) l.push(`      Padrão Moked: ${a.padrao}`);
      });
    });
    l.push("");
  }
  if (rel.evolucao) {
    const e = rel.evolucao;
    l.push(`EVOLUÇÃO EM RELAÇÃO À ${String(e.rotulo).toUpperCase()}`);
    [["Corrigidos", e.corrigidos], ["Melhoraram", e.melhoraram], ["Persistem", e.persistem], ["Pioraram", e.pioraram], ["Novos achados", e.novos]].forEach(([nome, lista]) => {
      l.push(`  ${nome}: ${lista.length}`);
      lista.forEach((i) => l.push(`    ${i.id} - ${i.texto}: ${STATUS_LABEL[i.antes] || "sem resposta"} -> ${STATUS_LABEL[i.atual]}`));
    });
    l.push("");
  }
  l.push("RESPOSTAS POR CATEGORIA");
  rel.secoes.forEach((secao) => {
    l.push(`${secao.id} - ${secao.nome}`);
    secao.subcategorias.forEach((sub) => {
      l.push(`  ${sub.id} - ${sub.nome}`);
      sub.itens.forEach((item) => {
        const r = item.resposta || {};
        l.push(`    [${STATUS_LABEL[r.status] || "Não respondido"}] ${item.id} - ${item.texto}`);
        detTxt(r).forEach(([rot, v]) => l.push(`      ${rot}: ${texto(v)}`));
      });
      l.push("");
    });
  });
  return l.join("\n");
}

const badge = (st) => `<span class="mk-b ${STATUS_BADGE[st] || "mk-b-in"}">${escHTML((STATUS_LABEL[st] || "Não respondido").toUpperCase())}</span>`;
const badgeSemaforo = (s) => `<span class="mk-b ${SEMAFORO_BADGE[s]}">${escHTML(SEMAFORO_LABEL[s].toUpperCase())}</span>`;
const campo = (rotulo, v) => (texto(v) ? `<div><b>${rotulo}:</b> ${escHTML(texto(v))}</div>` : "");
const th = (t, num, w) => `<th${num ? ' class="mk-num"' : ""} style="${num ? "text-align:right;" : ""}${w ? `width:${w}%` : ""}">${t}</th>`;

export function gerarDiagnosticoHTML(rel, { hoje = new Date() } = {}) {
  const c = rel.contagens;
  const kpis = `<div class="mk-kpis">
<div class="mk-k"><div class="mk-kv">${rel.percentual}<span class="mk-sm mk-mu">%</span></div><div class="mk-kl">Preenchido · ${rel.respondidos}/${rel.total} itens</div></div>
<div class="mk-k"><div class="mk-kv ${c.conforme ? "mk-ok" : ""}">${c.conforme}</div><div class="mk-kl">Conformes</div></div>
<div class="mk-k"><div class="mk-kv ${rel.nAchados ? "mk-wa" : ""}">${rel.nAchados}</div><div class="mk-kl">Achados (parcial, não conforme, ausente, sem dado)</div></div>
<div class="mk-k"><div class="mk-kv ${rel.criticosAbertos ? "mk-da" : ""}">${rel.criticosAbertos}</div><div class="mk-kl">Itens críticos não conformes ou ausentes</div></div>
</div>`;
  const leitura = `<section class="mk-bloco"><h2 class="mk-h2">Leitura do diagnóstico</h2>${leituraDoDiagnostico(rel).map((x) => `<p style="margin:3px 0">${escHTML(x)}</p>`).join("")}</section>`;
  const semaforo = `<section class="mk-bloco"><h2 class="mk-h2">Situação por categoria</h2><table class="mk-tb"><thead><tr>${th("Categoria")}${th("Situação")}${th("Respondidos", 1)}${th("P1", 1)}${th("P2", 1)}${th("P3", 1)}${th("Sem dado", 1)}</tr></thead><tbody>${rel.secoes.map((s) => `<tr><td><span class="mk-dv">${escHTML(s.id)}</span> ${escHTML(s.nome)}</td><td>${badgeSemaforo(s.semaforo)}</td><td class="mk-num">${s.respondidos}/${s.total}</td><td class="mk-num">${s.porPrioridade[1] || "—"}</td><td class="mk-num">${s.porPrioridade[2] || "—"}</td><td class="mk-num">${s.porPrioridade[3] || "—"}</td><td class="mk-num">${s.porPrioridade[4] || "—"}</td></tr>`).join("")}</tbody></table><p class="mk-nota">P1 = crítico não conforme ou ausente · P2 = crítico parcial ou relevante não conforme/ausente · P3 = demais achados.</p></section>`;
  const plano = rel.plano.length
    ? `<section><h2 class="mk-h2">Plano de ação priorizado <span class="mk-mu">· ${rel.nAchados}</span></h2>${rel.plano.map((g) => `<h3 class="mk-dv" style="margin:12px 0 4px">${escHTML(g.rotulo)} · ${g.itens.length}</h3><table class="mk-tb"><thead><tr>${th("Item", 0, 24)}${th("Situação", 0, 12)}${th("O que foi encontrado e risco", 0, 24)}${th("Ação recomendada", 0, 28)}${th("Responsável / prazo", 0, 12)}</tr></thead><tbody>${g.itens.map((a) => `<tr><td><span class="mk-dv">${escHTML(a.id)}</span><div class="mk-mu mk-sm">${escHTML(a.categoria)} · ${escHTML(a.subcategoriaNome)} · ${escHTML(CRIT_LABEL[a.criticidade] || a.criticidade)}</div><div>${escHTML(a.texto)}</div></td><td>${badge(a.resposta.status)}</td><td class="mk-sm">${campo("Situação", a.resposta.situacao)}${campo("Impacto", a.resposta.impacto)}${campo("Observação", a.resposta.observacao)}${texto(a.resposta.situacao) || texto(a.resposta.impacto) || texto(a.resposta.observacao) ? "" : '<span class="mk-inv">sem registro</span>'}</td><td class="mk-sm">${texto(a.resposta.indicacao) ? escHTML(texto(a.resposta.indicacao)) : '<span class="mk-inv">a definir</span>'}${a.padrao ? `<div class="mk-mu" style="margin-top:3px"><b>Padrão Moked:</b> ${escHTML(a.padrao)}</div>` : ""}</td><td style="min-width:72px">&nbsp;</td></tr>`).join("")}</tbody></table>`).join("")}</section>`
    : `<div class="mk-vazio"><div class="mk-dv">Nenhum achado registrado</div><div class="mk-nota">${rel.respondidos ? "Todos os itens respondidos estão conformes ou não aplicáveis." : "Nenhum item foi respondido ainda."}</div></div>`;
  const desvios = rel.padrao.filter((p) => p.status !== "conforme");
  const conformesPadrao = rel.padrao.filter((p) => p.status === "conforme");
  const padrao = rel.padrao.length
    ? `<section><h2 class="mk-h2">Padrão Moked × existente <span class="mk-mu">· ${rel.padrao.length} itens com padrão avaliados</span></h2>${desvios.length ? `<table class="mk-tb"><thead><tr>${th("Item", 0, 28)}${th("Padrão Moked de referência", 0, 44)}${th("Existente", 0, 28)}</tr></thead><tbody>${desvios.map((p) => `<tr><td><span class="mk-dv">${escHTML(p.id)}</span><div>${escHTML(p.texto)}</div></td><td class="mk-sm">${escHTML(p.padrao)}</td><td>${badge(p.status)}${texto(p.resposta.situacao) ? `<div class="mk-sm" style="margin-top:3px">${escHTML(texto(p.resposta.situacao))}</div>` : ""}</td></tr>`).join("")}</tbody></table>` : '<p class="mk-nota">Nenhum item avaliado está fora do padrão.</p>'}${conformesPadrao.length ? `<p class="mk-nota"><b>Conformes com o padrão (${conformesPadrao.length}):</b> ${conformesPadrao.map((p) => escHTML(p.texto)).join("; ")}.</p>` : ""}<p class="mk-nota">Padrão Moked de referência (${escHTML(PADRAO_MOKED_VERSAO)}): descreve o que se espera encontrar no item. Itens sem padrão definido aparecem só no plano de ação.</p></section>`
    : "";
  const evolucao = rel.evolucao ? (() => {
    const e = rel.evolucao;
    const tabela = (titulo, lista) => (lista.length ? `<h3 class="mk-dv" style="margin:10px 0 4px">${titulo} · ${lista.length}</h3><table class="mk-tb"><thead><tr>${th("Item")}${th("Antes")}${th("Agora")}</tr></thead><tbody>${lista.map((i) => `<tr><td><span class="mk-dv">${escHTML(i.id)}</span> ${escHTML(i.texto)}</td><td>${i.antes ? badge(i.antes) : '<span class="mk-inv">sem resposta</span>'}</td><td>${badge(i.atual)}</td></tr>`).join("")}</tbody></table>` : "");
    return `<section><h2 class="mk-h2">Evolução em relação à ${escHTML(e.rotulo)}${e.data ? ` <span class="mk-mu">· ${escHTML(e.data)}</span>` : ""}</h2><div class="mk-kpis"><div class="mk-k"><div class="mk-kv mk-ok">${e.corrigidos.length}</div><div class="mk-kl">Corrigidos</div></div><div class="mk-k"><div class="mk-kv">${e.melhoraram.length}</div><div class="mk-kl">Melhoraram</div></div><div class="mk-k"><div class="mk-kv ${e.persistem.length ? "mk-wa" : ""}">${e.persistem.length}</div><div class="mk-kl">Persistem</div></div><div class="mk-k"><div class="mk-kv ${e.pioraram.length + e.novos.length ? "mk-da" : ""}">${e.pioraram.length + e.novos.length}</div><div class="mk-kl">Pioraram ou novos</div></div></div>${tabela("Corrigidos", e.corrigidos)}${tabela("Melhoraram", e.melhoraram)}${tabela("Pioraram", e.pioraram)}${tabela("Novos achados", e.novos)}${tabela("Persistem", e.persistem)}</section>`;
  })() : "";
  const resumoStatus = `<section class="mk-bloco"><h2 class="mk-h2">Resumo por situação</h2><table class="mk-tb"><thead><tr><th>Situação</th><th class="mk-num" style="text-align:right">Itens</th></tr></thead><tbody>${Object.keys(STATUS_LABEL).map((st) => `<tr><td>${badge(st)}</td><td class="mk-num">${c[st]}</td></tr>`).join("")}<tr><td class="mk-mu">Não respondidos</td><td class="mk-num">${rel.total - rel.respondidos}</td></tr></tbody></table></section>`;
  const nota = `<p class="mk-nota">Base: marcações do consultor no catálogo ${escHTML(rel.catalogoId)} v${escHTML(rel.versao)}. "Não aplicável" sai do denominador; "Sem dado" permanece e não conta como avaliado. ${rel.estado === "arquivado" ? "Diagnóstico arquivado." : rel.diagnosticoId ? "" : "Documento gerado a partir do rascunho local deste aparelho, ainda não salvo no banco."}</p>`;
  const sub = `${escHTML(rel.projeto)}${rel.nomeProjeto ? ` — ${escHTML(rel.nomeProjeto)}` : ""}${rel.grupo ? ` · ${escHTML(rel.grupo)}` : ""}${rel.rotuloRevisao ? ` · ${escHTML(rel.rotuloRevisao)}` : ""} · catálogo v${escHTML(rel.versao)} · ${escHTML(rel.estado)} · dados de ${escHTML(dataBr(rel.geradoEm))}`;
  const numero = numeroDiagnostico(rel);
  const project = { id: rel.projeto, name: "" };
  return documentoMoked({ project, titulo: "Diagnóstico Situacional", subtitulo: sub, numero, corpo: `${kpis}${leitura}${semaforo}${plano}${padrao}${evolucao}${resumoStatus}${nota}`, interno: true, hoje, empresaLogo: false, rodape: `${numero} · Diagnóstico Situacional · ${rel.projeto} · Moked Consulting Security · MokLog CheckTest` });
}

// Cópia de segurança do rascunho local (JSON). Só lê; nunca altera nem apaga o rascunho.
export function copiaDeSegurancaRascunho({ chave, projeto, draft, diagnosticoId = null, exportadoEm = new Date().toISOString() }) {
  return { tipo: "moklog_diagnostico_copia", versaoCopia: 1, exportadoEm, projeto, chave, diagnosticoId, draft };
}
export const nomeCopiaSeguranca = (projeto, exportadoEm = new Date().toISOString()) => `copia_diagnostico_${slug(projeto)}_${String(exportadoEm).slice(0, 10)}.json`;

// Entrega no navegador (não coberto por teste de unidade: depende de DOM).
export function baixarArquivo(conteudo, nome, tipo) {
  const blob = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export { dataCurta };

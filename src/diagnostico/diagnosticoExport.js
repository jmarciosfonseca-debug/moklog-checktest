// Diagnóstico Situacional → entregáveis. Módulo puro (sem DOM, sem dependência nova):
//  • montarRelatorioDiagnostico: números e seções, uma única fonte para tela, PDF, TXT e cópia de segurança;
//  • gerarDiagnosticoHTML: relatório A4 no padrão Moked (abre para imprimir / salvar PDF);
//  • relatorioDiagnosticoTexto: TXT simples;
//  • copiaDeSegurancaRascunho: JSON do rascunho local (nada se perde se o salvar falhar).
import { documentoMoked, escHTML } from "../relatorios/padraoMoked";

export const STATUS_LABEL = { conforme: "Conforme", parcial: "Parcial", nao_conforme: "Não conforme", ausente_necessario: "Ausente necessário", na: "Não aplicável", sem_dado: "Sem dado" };
const STATUS_BADGE = { conforme: "mk-b-ok", parcial: "mk-b-wa", nao_conforme: "mk-b-da", ausente_necessario: "mk-b-da", na: "mk-b-in", sem_dado: "mk-b-wa" };
const ACHADOS = ["nao_conforme", "ausente_necessario", "parcial", "sem_dado"]; // ordem de gravidade no relatório
const CRIT_ORDEM = { critico: 0, relevante: 1, informativo: 2 };
const CRIT_LABEL = { critico: "Crítico", relevante: "Relevante", informativo: "Informativo" };

const texto = (v) => String(v ?? "").trim();
const dataBr = (v) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("pt-BR"); };
const slug = (v) => texto(v).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "diagnostico";

export function montarRelatorioDiagnostico({ catalogo, itens = [], respostas = {}, contexto = {}, diagnosticoId = null, estado = "rascunho", geradoEm = new Date().toISOString() }) {
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
  const achados = secoes.flatMap((s) => s.subcategorias.flatMap((sub) => sub.itens.filter((i) => ACHADOS.includes(i.resposta.status)).map((i) => ({ ...i, categoria: s.id, categoriaNome: s.nome, subcategoria: sub.id, subcategoriaNome: sub.nome }))))
    .sort((a, b) => ACHADOS.indexOf(a.resposta.status) - ACHADOS.indexOf(b.resposta.status) || (CRIT_ORDEM[a.criticidade] ?? 3) - (CRIT_ORDEM[b.criticidade] ?? 3));
  return {
    titulo: "Diagnóstico Situacional",
    projeto: contexto.rotuloLivre || contexto.projetoRef || contexto.chave || "Projeto não identificado",
    grupo: contexto.grupo || "", catalogoId: catalogo?.id || catalogo?.catalogoId || "centro_logistico_v1_0_0",
    versao: catalogo?.versao || "", diagnosticoId, estado, geradoEm, total: ativos.length, respondidos,
    percentual: ativos.length ? Math.round((respondidos / ativos.length) * 100) : 0,
    contagens, secoes, achados, nAchados: achados.length,
  };
}

export const nomeArquivoDiagnostico = (rel, extensao) => `diagnostico_${slug(rel.projeto)}_${String(rel.geradoEm).slice(0, 10)}.${extensao}`;
export const numeroDiagnostico = (rel) => `MK-DIA-${slug(rel.projeto).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 14) || "PROJ"}-${String(rel.geradoEm).slice(2, 10).replace(/-/g, "")}`;

export function relatorioDiagnosticoTexto(rel) {
  const l = ["MOKLOG CHECKTEST - DIAGNÓSTICO SITUACIONAL", `Projeto: ${rel.projeto}`, `Estado: ${rel.estado}`, `Catálogo: ${rel.catalogoId} v${rel.versao}`, `Diagnóstico: ${rel.diagnosticoId || "rascunho local"}`, `Gerado em: ${dataBr(rel.geradoEm)}`, `Progresso: ${rel.respondidos}/${rel.total} (${rel.percentual}%)`, `Achados para análise: ${rel.nAchados}`, ""];
  rel.secoes.forEach((secao) => {
    l.push(`${secao.id} - ${secao.nome}`);
    secao.subcategorias.forEach((sub) => {
      l.push(`  ${sub.id} - ${sub.nome}`);
      sub.itens.forEach((item) => {
        const r = item.resposta || {};
        l.push(`    [${STATUS_LABEL[r.status] || "Não respondido"}] ${item.id} - ${item.texto}`);
        [["Situação", r.situacao], ["Impacto", r.impacto], ["Indicação", r.indicacao], ["Observação", r.observacao]].forEach(([rot, v]) => { if (texto(v)) l.push(`      ${rot}: ${texto(v)}`); });
      });
      l.push("");
    });
  });
  return l.join("\n");
}

const badge = (st) => `<span class="mk-b ${STATUS_BADGE[st] || "mk-b-in"}">${escHTML((STATUS_LABEL[st] || "Não respondido").toUpperCase())}</span>`;

export function gerarDiagnosticoHTML(rel, { hoje = new Date() } = {}) {
  const c = rel.contagens;
  const criticosAbertos = rel.achados.filter((a) => a.criticidade === "critico" && ["nao_conforme", "ausente_necessario"].includes(a.resposta.status)).length;
  const kpis = `<div class="mk-kpis">
<div class="mk-k"><div class="mk-kv">${rel.percentual}<span class="mk-sm mk-mu">%</span></div><div class="mk-kl">Preenchido · ${rel.respondidos}/${rel.total} itens</div></div>
<div class="mk-k"><div class="mk-kv ${c.conforme ? "mk-ok" : ""}">${c.conforme}</div><div class="mk-kl">Conformes</div></div>
<div class="mk-k"><div class="mk-kv ${rel.nAchados ? "mk-wa" : ""}">${rel.nAchados}</div><div class="mk-kl">Achados (parcial, não conforme, ausente, sem dado)</div></div>
<div class="mk-k"><div class="mk-kv ${criticosAbertos ? "mk-da" : ""}">${criticosAbertos}</div><div class="mk-kl">Itens críticos não conformes ou ausentes</div></div>
</div>`;
  const resumoStatus = `<section class="mk-bloco"><h2 class="mk-h2">Resumo por situação</h2><table class="mk-tb"><thead><tr><th>Situação</th><th class="mk-num" style="text-align:right">Itens</th></tr></thead><tbody>${Object.keys(STATUS_LABEL).map((st) => `<tr><td>${badge(st)}</td><td class="mk-num">${c[st]}</td></tr>`).join("")}<tr><td class="mk-mu">Não respondidos</td><td class="mk-num">${rel.total - rel.respondidos}</td></tr></tbody></table></section>`;
  const porCategoria = `<section class="mk-bloco"><h2 class="mk-h2">Andamento por categoria</h2><table class="mk-tb"><thead><tr><th>Categoria</th><th class="mk-num" style="text-align:right">Respondidos</th><th class="mk-num" style="text-align:right">Achados</th></tr></thead><tbody>${rel.secoes.map((s) => { const a = rel.achados.filter((x) => x.categoria === s.id).length; return `<tr><td><span class="mk-dv">${escHTML(s.id)}</span> ${escHTML(s.nome)}</td><td class="mk-num">${s.respondidos}/${s.total}</td><td class="mk-num">${a || "—"}</td></tr>`; }).join("")}</tbody></table></section>`;
  const det = (r) => [["Situação", r.situacao], ["Impacto", r.impacto], ["Indicação", r.indicacao], ["Observação", r.observacao]].filter(([, v]) => texto(v)).map(([k, v]) => `<div><b>${k}:</b> ${escHTML(texto(v))}</div>`).join("");
  const achados = rel.achados.length
    ? `<section><h2 class="mk-h2">Achados <span class="mk-mu">· ${rel.achados.length}</span></h2><table class="mk-tb"><thead><tr><th>Item</th><th>Situação</th><th>Criticidade</th><th>Registro de campo</th></tr></thead><tbody>${rel.achados.map((a) => `<tr><td><span class="mk-dv">${escHTML(a.id)}</span><div class="mk-mu mk-sm">${escHTML(a.categoria)} · ${escHTML(a.subcategoriaNome)}</div><div>${escHTML(a.texto)}</div></td><td>${badge(a.resposta.status)}</td><td>${escHTML(CRIT_LABEL[a.criticidade] || a.criticidade)}</td><td class="mk-sm">${det(a.resposta) || '<span class="mk-inv">sem registro</span>'}</td></tr>`).join("")}</tbody></table></section>`
    : `<div class="mk-vazio"><div class="mk-dv">Nenhum achado registrado</div><div class="mk-nota">${rel.respondidos ? "Todos os itens respondidos estão conformes ou não aplicáveis." : "Nenhum item foi respondido ainda."}</div></div>`;
  const nota = `<p class="mk-nota">Base: marcações do consultor no catálogo ${escHTML(rel.catalogoId)} v${escHTML(rel.versao)}. "Não aplicável" sai do denominador; "Sem dado" permanece e não conta como avaliado. ${rel.estado === "arquivado" ? "Diagnóstico arquivado." : rel.diagnosticoId ? "" : "Documento gerado a partir do rascunho local deste aparelho, ainda não salvo no banco."}</p>`;
  const sub = `${escHTML(rel.projeto)}${rel.grupo ? ` · ${escHTML(rel.grupo)}` : ""} · catálogo v${escHTML(rel.versao)} · ${escHTML(rel.estado)} · dados de ${escHTML(dataBr(rel.geradoEm))}`;
  const numero = numeroDiagnostico(rel);
  const project = { id: rel.projeto, name: "" };
  return documentoMoked({ project, titulo: "Diagnóstico Situacional", subtitulo: sub, numero, corpo: `${kpis}${resumoStatus}${porCategoria}${achados}${nota}`, interno: true, hoje, empresaLogo: false, rodape: `${numero} · Diagnóstico Situacional · ${rel.projeto} · Moked Consulting Security · MokLog CheckTest` });
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

// Consolidado do Mapa de Equipe diário — padrão Moked (A4).
// Módulo puro (sem DOM): recebe o resultado de consolidar() (src/mapaDiario/consolidado.js) e devolve o HTML.
// Base: apenas mapas concluídos; os números do PDF são exatamente os das linhas listadas (mesmo filtro).
import { documentoMoked, escHTML, dataBR, horaBR, milhar } from "./padraoMoked";
import { descreverFiltros } from "../mapaDiario/consolidado";
import { rotuloTurno } from "../mapaDiario/texto";
import { ROTULO_SITUACAO, kmRodado } from "../mapaDiario/modelo";
import { fotoDaPessoa, iniciais } from "../mapaDiario/fotos";

const e = escHTML;
const BADGE = { falta: "mk-b-da", vago: "mk-b-da", atraso: "mk-b-wa", ft: "mk-b-in", cobertura: "mk-b-in", troca: "mk-b-in" };
const badge = (tipo) => `<span class="mk-b ${BADGE[tipo] || "mk-b-ok"}">${e((ROTULO_SITUACAO[tipo] || tipo).toUpperCase())}</span>`;
const turnoCurto = (t) => (t === "N" ? "Noturno" : "Diurno");

// Foto do cadastro como bolinha. Cada foto entra UMA vez no documento (classe CSS com a imagem); quem não tem foto ganha as iniciais.
// fotosPorProjeto: { [projetoId]: { porId, porNome } } (fotos.js) ou nulo = PDF sem fotos.
export function criarAvatares(fotosPorProjeto) {
  const classes = new Map();
  const html = (projetoId, pessoaId, nome, grande = false) => {
    if (!fotosPorProjeto) return "";
    const src = fotoDaPessoa(fotosPorProjeto[projetoId], pessoaId, nome);
    const g = grande ? " mk-avg" : "";
    if (!src) return `<span class="mk-av mk-ini${g}">${e(iniciais(nome))}</span>`;
    if (!classes.has(src)) classes.set(src, `mk-f${classes.size}`);
    return `<span class="mk-av ${classes.get(src)}${g}" role="img" aria-label="${e(nome || "Colaborador")}"></span>`;
  };
  const css = () => `<style>.mk-av{display:inline-block;width:22px;height:22px;border-radius:50%;background-color:#E5E7EB;background-size:cover;background-position:center;vertical-align:middle;margin-right:6px;flex:none;-webkit-print-color-adjust:exact;print-color-adjust:exact}.mk-avg{width:30px;height:30px}.mk-ini{font-size:7.4pt;font-weight:700;color:#4B5563;text-align:center;line-height:22px}.mk-ini.mk-avg{line-height:30px;font-size:9pt}${[...classes].map(([src, c]) => `.${c}{background-image:url("${src}")}`).join("")}</style>`;
  return { html, css, usadas: () => classes.size };
}

export const numeroConsolidado = (f = {}) => {
  const c = (iso) => String(iso || "").replace(/-/g, "").slice(2);
  return `MK-MEQ-${c(f.de)}-${c(f.ate)}`;
};

function kpis(t) {
  const outras = t.atraso + t.cobertura + t.troca + t.vago;
  return `<div class="mk-kpis">
<div class="mk-k"><div class="mk-kv">${t.mapas}</div><div class="mk-kl">Mapas concluídos</div></div>
<div class="mk-k"><div class="mk-kv ${t.falta ? "mk-da" : ""}">${t.falta}</div><div class="mk-kl">Faltas</div></div>
<div class="mk-k"><div class="mk-kv">${t.ft}</div><div class="mk-kl">FT (folgas trabalhadas)</div></div>
<div class="mk-k"><div class="mk-kv ${outras ? "mk-wa" : ""}">${outras}</div><div class="mk-kl">Atrasos, coberturas, trocas</div></div>
</div>`;
}

function tabelaProjetos(porProjeto, nomeProj) {
  if (porProjeto.length < 2) return "";
  const linhas = porProjeto.map((p) => `<tr><td class="mk-dv">${e(nomeProj(p.projetoId))}</td><td class="mk-num">${p.mapas}</td><td class="mk-num">${p.falta || "—"}</td><td class="mk-num">${p.ft || "—"}</td><td class="mk-num">${p.atraso || "—"}</td><td class="mk-num">${p.cobertura || "—"}</td><td class="mk-num">${p.troca || "—"}</td><td class="mk-num">${p.km ? milhar(p.km) : "—"}</td></tr>`).join("");
  return `<section class="mk-bloco"><h2 class="mk-h2">Resumo por projeto</h2><table class="mk-tb"><thead><tr><th>Projeto</th><th class="mk-num" style="text-align:right">Mapas</th><th class="mk-num" style="text-align:right">Faltas</th><th class="mk-num" style="text-align:right">FT</th><th class="mk-num" style="text-align:right">Atrasos</th><th class="mk-num" style="text-align:right">Coberturas</th><th class="mk-num" style="text-align:right">Trocas</th><th class="mk-num" style="text-align:right">Km</th></tr></thead><tbody>${linhas}</tbody></table></section>`;
}

function tabelaOcorrencias(ocorrencias, av) {
  if (!ocorrencias.length) return `<section class="mk-bloco"><h2 class="mk-h2">Ocorrências</h2><p class="mk-nota">Nenhuma ocorrência nos mapas filtrados.</p></section>`;
  const linhas = ocorrencias.map((o) => `<tr><td class="mk-num">${dataBR(o.data)}</td><td>${e(o.projetoId)}</td><td>${turnoCurto(o.turno)}</td><td>${e(o.lider || "—")}</td><td>${e(o.posto)}</td><td class="mk-dv">${av.html(o.projetoId, o.pessoaId, o.pessoa)}${e(o.pessoa || "—")}</td><td>${badge(o.tipo)}</td><td class="mk-mu">${e(o.detalhe)}</td></tr>`).join("");
  return `<section><h2 class="mk-h2">Ocorrências <span class="mk-mu">· ${ocorrencias.length} registro${ocorrencias.length === 1 ? "" : "s"}</span></h2><table class="mk-tb"><thead><tr><th class="mk-num" style="text-align:right">Data</th><th>Projeto</th><th>Plantão</th><th>Líder</th><th>Posto</th><th>Colaborador</th><th>Tipo</th><th>Detalhe</th></tr></thead><tbody>${linhas}</tbody></table></section>`;
}

function blocoMapa(m, nomeProj, av) {
  const postos = (m.postos || []).map((p) => `<tr><td>${e(p.rotulo || "")}</td><td class="mk-dv">${av.html(m.projetoId, p.pessoaId, p.pessoaNome, true)}${e((p.pessoaNome || "").trim() || "—")}</td><td>${p.situacao && p.situacao !== "presente" ? badge(p.situacao) : '<span class="mk-sim">Presente</span>'}</td></tr>`).join("");
  const mat = m.material || { semAlteracao: true };
  const exc = mat.excecoes || [];
  const material = mat.semAlteracao && !exc.length ? "Sem alteração" : `Com alteração — ${exc.map((x) => `${x.nome} (${x.situacao === "indisponivel" ? "indisponível" : "anomalia"}${x.obs ? `: ${x.obs}` : ""})`).join("; ") || (mat.obs || "")}`;
  const km = (m.veiculos || []).map((v) => { const r = kmRodado(v); return r != null ? `${v.rotulo || "Veículo"} ${milhar(r)} km` : ""; }).filter(Boolean).join(" · ");
  const vis = m.visita && typeof m.visita.houve === "boolean" ? (m.visita.houve ? `visita de ${m.visita.supervisor || "supervisão"} neste turno` : "sem visita neste turno") : "";
  const ult = m.supervisao && m.supervisao.ultimaData ? `última visita ${dataBR(m.supervisao.ultimaData)}${m.supervisao.supervisor ? ` (${m.supervisao.supervisor})` : ""}` : "";
  const env = m.enviadoEm ? ` · concluído ${dataBR(m.enviadoEm)} ${horaBR(m.enviadoEm)}` : "";
  return `<div class="mk-bloco mk-card" style="margin-bottom:8px"><div class="mk-dv">${dataBR(m.data)} · ${e(nomeProj(m.projetoId))} · ${e(rotuloTurno(m.turno, m.horario))}</div>
<div class="mk-mu mk-sm">Líder: ${e(m.liderNome || "—")}${e(env)}</div>
<table class="mk-tb"><thead><tr><th>Posto</th><th>Colaborador</th><th>Situação</th></tr></thead><tbody>${postos}</tbody></table>
<div class="mk-sm"><b>Material:</b> ${e(material)}${km ? ` · <b>Km:</b> ${e(km)}` : ""}${vis || ult ? ` · <b>Supervisão:</b> ${e([vis, ult].filter(Boolean).join("; "))}` : ""}</div>
${(m.resumo || "").trim() ? `<div class="mk-sm"><b>Resumo da passagem:</b> ${e(m.resumo.trim())}</div>` : ""}
${(m.observacoes || "").trim() ? `<div class="mk-sm"><b>Observações:</b> ${e(m.observacoes.trim())}</div>` : ""}</div>`;
}

// resultado = consolidar(...). nomeProj(pid) → texto do projeto. projeto = { id, name } só quando o filtro é de um projeto (logo da empresa).
export function gerarConsolidadoMapasHTML({ resultado, nomeProj = (p) => p, projeto = null, detalhado = false, hoje = new Date(), fotos = null }) {
  const av = criarAvatares(fotos);
  const f = resultado.filtros || {};
  const numero = numeroConsolidado(f);
  const sub = descreverFiltros(f, nomeProj).map(e).join(" · ");
  const vazio = resultado.totais.mapas === 0;
  const corpo = vazio
    ? `<div class="mk-vazio"><div class="mk-big">0</div><div class="mk-dv">Nenhum mapa concluído encontrado com esses filtros</div><div class="mk-nota">Confira o período, o projeto, o plantão e o líder escolhidos.</div></div>`
    : `${kpis(resultado.totais)}${tabelaProjetos(resultado.porProjeto, nomeProj)}${tabelaOcorrencias(resultado.ocorrencias, av)}${detalhado ? `<section><h2 class="mk-h2">Mapas do período <span class="mk-mu">· ${resultado.mapas.length}</span></h2>${resultado.mapas.map((m) => blocoMapa(m, nomeProj, av)).join("")}</section>` : ""}
<p class="mk-nota">Base: mapas concluídos pelos líderes no MokLog CheckTest. Falta e FT seguem para a ficha do colaborador na Equipe. Km = soma do rodado informado nos veículos de cada mapa.</p>`;
  const corpoFinal = fotos ? `${corpo}${av.css()}` : corpo; // css por último: já sabe quais fotos foram usadas
  const unico = projeto && projeto.id ? projeto : { id: f.projetos && f.projetos.length > 1 ? "Seleção de projetos" : "Todos os projetos", name: "" };
  return documentoMoked({ project: unico, titulo: "Consolidado do Mapa de Equipe", subtitulo: sub, numero, corpo: corpoFinal, tag: "ACESSO GERENCIAL", hoje, empresaLogo: !!(projeto && projeto.id), rodape: `${numero} · Consolidado do Mapa de Equipe · ${unico.id} ${unico.name || ""} · Moked Consulting Security · MokLog CheckTest` });
}

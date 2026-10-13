// Análise de Risco — MODELO 2 (com Diagnóstico Situacional). Módulo puro (sem Firestore, sem DOM).
// Regra do Marcio (13/10/2026): sem marcar o Diagnóstico, a Análise de Risco gera o relatório que já existe (modelo 1).
// Marcando, e só se o projeto tem um diagnóstico CONCLUÍDO (todos os itens respondidos, botão "Concluir"), entra o segundo motor
// (diagnosticoRisco.js: só sobe o nível) e o segundo modelo de relatório: a base do primeiro + as seções do Diagnóstico.
import { montarRelatorioDiagnostico, leituraDoDiagnostico, STATUS_LABEL, SEMAFORO_LABEL, PRIORIDADE_LABEL, dataCurta } from "./diagnosticoExport";
import { escolherAnterior, numerosRevisao, rotuloRevisaoDe } from "./diagnosticoSync";

export const ESTADO_CONCLUIDO = "concluido";

// Só diagnóstico concluído (e com respostas) entra; entre vários, o atualizado por último.
export function escolherDiagnosticoConcluido(docs = []) {
  return docs
    .filter((d) => d && d.estado === ESTADO_CONCLUIDO && d.respostas && Object.keys(d.respostas).length)
    .sort((a, b) => String(b.atualizadoEm || "").localeCompare(String(a.atualizadoEm || "")))[0] || null;
}

// Por que não entrou (para a mensagem de "fonte faltante" na geração).
export function motivoSemConcluido(docs = []) {
  const ativos = docs.filter((d) => d && d.estado !== "arquivado" && d.respostas && Object.keys(d.respostas).length);
  return ativos.length
    ? "há diagnóstico salvo, mas nenhum concluído: abra o Diagnóstico Situacional e use \"Concluir diagnóstico\""
    : "nenhum diagnóstico salvo para este projeto";
}

// Resumo compacto (vai dentro da análise): semáforo por categoria, plano priorizado, padrão Moked × existente e evolução.
export function resumoModelo2({ catalogo, itens = [], diag, todos = [], projetoRef = "", nomeProjeto = "" }) {
  const numeros = numerosRevisao(todos);
  const ant = escolherAnterior(todos, diag.id, diag.baseId || null);
  const rel = montarRelatorioDiagnostico({
    catalogo, itens, respostas: diag.respostas, contexto: { projetoRef, nomeProjeto }, diagnosticoId: diag.id, estado: diag.estado || "concluido",
    rotuloRevisao: rotuloRevisaoDe(numeros[diag.id]),
    anterior: ant ? { respostas: ant.respostas, rotulo: rotuloRevisaoDe(numeros[ant.id]) || "revisão anterior", data: ant.atualizadoEm ? dataCurta(ant.atualizadoEm) : "" } : null,
  });
  const resp = (i) => i.resposta || {};
  return {
    percentual: rel.percentual, total: rel.total, respondidos: rel.respondidos, nAchados: rel.nAchados, criticosAbertos: rel.criticosAbertos,
    leitura: leituraDoDiagnostico(rel),
    secoes: rel.secoes.map((s) => ({ id: s.id, nome: s.nome, total: s.total, respondidos: s.respondidos, semaforo: s.semaforo, nAchados: s.nAchados })),
    plano: rel.plano.map((g) => ({
      prioridade: g.prioridade, rotulo: g.rotulo,
      itens: g.itens.map((i) => ({ id: i.id, texto: i.texto, criticidade: i.criticidade, status: resp(i).status, situacao: resp(i).situacao || "", indicacao: resp(i).indicacao || "", categoriaNome: i.categoriaNome })),
    })),
    padrao: rel.padrao.map((p) => ({ id: p.id, texto: p.texto, padrao: p.padrao, status: p.status, situacao: (p.resposta || {}).situacao || "" })),
    evolucao: rel.evolucao ? { rotulo: rel.evolucao.rotulo, data: rel.evolucao.data, corrigidos: rel.evolucao.corrigidos.length, melhoraram: rel.evolucao.melhoraram.length, persistem: rel.evolucao.persistem.length, pioraram: rel.evolucao.pioraram.length, novos: rel.evolucao.novos.length } : null,
  };
}

const COR_SEMAFORO = { critico: "#B21E27", atencao: "#B45309", observacao: "#6B7280", adequado: "#15803D", sem_resposta: "#6B7280" };
const FALHAS = ["nao_conforme", "ausente_necessario"];

// Blocos HTML do modelo 2 (classes do relatório de Análise de Risco). `esc` é o escapador do chamador.
export function blocosModelo2(m, esc) {
  if (!m) return "";
  const cat = m.secoes.length ? `<div class="bloco"><div class="eyebrow">Diagnóstico Situacional — situação por categoria</div>
    <table class="ar-tb"><colgroup><col style="width:46%"><col style="width:18%"><col style="width:16%"><col style="width:20%"></colgroup><thead><tr><th>Categoria</th><th>Respondidos</th><th>Achados</th><th>Situação</th></tr></thead><tbody>
    ${m.secoes.map((s) => `<tr class="vt-linha"><td><div class="ar-dv">${esc(s.id)} ${esc(s.nome)}</div></td><td>${s.respondidos}/${s.total}</td><td>${s.nAchados}</td><td><b style="color:${COR_SEMAFORO[s.semaforo] || "#6B7280"}">${esc(SEMAFORO_LABEL[s.semaforo] || s.semaforo)}</b></td></tr>`).join("")}
    </tbody></table></div>` : "";
  const MAX = 12;
  let usados = 0, total = m.plano.reduce((t, g) => t + g.itens.length, 0);
  const planoHTML = m.plano.length ? `<div class="bloco"><div class="eyebrow">Plano de ação priorizado do Diagnóstico</div>
    ${m.plano.map((g) => {
      const itens = g.itens.slice(0, Math.max(0, MAX - usados)); usados += itens.length;
      if (!itens.length) return "";
      return `<p class="ar-mu"><b>${esc(PRIORIDADE_LABEL[g.prioridade] || g.rotulo)}</b> · ${g.itens.length} item(ns)</p><ol class="ar-acoes">${itens.map((i) => `<li><b>${esc(i.texto)}</b> — ${esc(STATUS_LABEL[i.status] || i.status)}${i.situacao ? `. ${esc(i.situacao)}` : ""}${i.indicacao ? ` <span class="ar-mu">Indicação: ${esc(i.indicacao)}</span>` : ""}</li>`).join("")}</ol>`;
    }).join("")}
    ${total > MAX ? `<div class="mais-anexo">Mais ${total - MAX} item(ns) no relatório do Diagnóstico Situacional.</div>` : ""}</div>` : "";
  const falhasPadrao = m.padrao.filter((p) => FALHAS.includes(p.status)).slice(0, 10);
  const padraoHTML = falhasPadrao.length ? `<div class="bloco"><div class="eyebrow">Padrão Moked × existente</div>
    <table class="ar-tb"><colgroup><col style="width:34%"><col style="width:36%"><col style="width:30%"></colgroup><thead><tr><th>Item</th><th>Padrão Moked</th><th>Encontrado</th></tr></thead><tbody>
    ${falhasPadrao.map((p) => `<tr class="vt-linha"><td><div class="ar-dv">${esc(p.texto)}</div><div class="ar-mu">${esc(p.id)}</div></td><td>${esc(p.padrao)}</td><td><b>${esc(STATUS_LABEL[p.status] || p.status)}</b>${p.situacao ? `<div class="ar-mu">${esc(p.situacao)}</div>` : ""}</td></tr>`).join("")}
    </tbody></table></div>` : "";
  const evo = m.evolucao ? `<div class="nota">Em relação à ${esc(m.evolucao.rotulo)}${m.evolucao.data ? ` (${esc(m.evolucao.data)})` : ""}: ${m.evolucao.corrigidos} corrigido(s), ${m.evolucao.melhoraram} melhorou(aram), ${m.evolucao.persistem} persistem, ${m.evolucao.pioraram} piorou(aram), ${m.evolucao.novos} novo(s) achado(s).</div>` : "";
  return `${cat}${planoHTML}${padraoHTML}${evo}`;
}

// Sufixo do número do documento para distinguir o modelo 2 do modelo 1.
export const refModelo2 = (ref) => (/-DX$/.test(ref) ? ref : `${ref}-DX`);

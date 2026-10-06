// ─────────────────────────────────────────────────────────────
// HTML Executivo (Visão 360) — arquivo HTML autocontido e navegável, por CLIENTE (nunca "Todos").
// Pedido do Marcio (05/10/2026): ao lado do "PDF Executivo", um relatório vivo de navegar: Cliente → Projeto → Resumo.
// Versão de demonstração: usa SÓ o que a tela da Visão 360 já calculou (linhas: score, base, penalidades, iluminação,
// energia) + o histórico de checklists em memória. Nenhuma leitura nova, nenhuma fórmula nova, nenhuma escrita.
// O que ainda não entra aparece como "não incluído nesta versão" — nunca como zero.
// ─────────────────────────────────────────────────────────────
import { escHTML, dataBR, hm } from "./padraoMoked";
import { analisarEnergia } from "./energiaRelatorio";
import { analisarAmbulancia } from "./ambulanciaRelatorio";
import { consolidarRondas, periodoUltimosDias } from "./rondaVirtualRelatorio";

// Nível 3 (resumo de cada relatório): cada fonte chega já carregada pelo app no clique (só leitura).
// Convenção das fontes em extras[pid]: undefined = não pedida; null = leitura falhou ("não aferido"); [] = sem registros.
export const MODULOS_FUTUROS = ["Análise de risco", "Equipamentos críticos"];
// Onde está o relatório completo de cada tema no MokLog CheckTest (nomes como aparecem no app).
export const RELATORIO_COMPLETO = {
  "Checklist semanal": "Laudo semanal — Histórico de Relatórios do projeto",
  "Consolidado (tendência)": "Consolidado do período — Histórico de Relatórios do projeto",
  "KeyAccess": "KeyAccess Falha",
  "Monitor CTMK": "status do CTMK no painel do projeto",
  "Bolsão": "Fiscalização de Bolsão",
  "Perímetro": "Teste Perimetral",
  "Ronda VSPP": "Ronda VSPP",
  "Energia": "Ocorrências de Energia (relatório do período)",
  "Iluminação": "Teste de Iluminação",
  "Ronda virtual (CFTV)": "CCO → Ronda Virtual (consolidado)",
  "Tempo de gravação (CFTV)": "CCO → CFTV Gravação",
  "Manutenção técnica": "CCO → Manutenção",
  "Acessos de ambulância": "Acesso de Ambulância (consolidado)",
};
const tab = (cab, linhas) => `<table><thead><tr>${cab.map((c) => `<th>${escHTML(c)}</th>`).join("")}</tr></thead><tbody>${linhas.map((l) => `<tr>${l.map((c) => `<td>${escHTML(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
const lis = (itens) => `<ul>${itens.map((t) => `<li>${escHTML(t)}</li>`).join("")}</ul>`;
const naoAferido = (titulo, motivo = "a fonte não pôde ser lida no momento da emissão") => ({ titulo, valor: "—", texto: `Não aferido: ${motivo}`, nivel: "neutro", efeito: "não aferido", detalhe: "" });

function cartoesRelatorios(pid, nome, ex, agora) {
  const out = [];
  // Laudo: falhas por sistema no último checklist
  if (Array.isArray(ex.falhasSistemas) && ex.falhasSistemas.length) {
    const linhas = ex.falhasSistemas.map((f) => [f.cat, String(f.inop), String(f.parcial)]);
    out.push({ ancora: "laudo", detalhe: `<p>Onde estão as falhas no checklist de ${escHTML(dataBR(ex.ultimo?.data))}:</p>${tab(["Sistema", "Inoperantes", "Parciais"], linhas)}` });
  }
  // Consolidado: tendência semanal
  if (Array.isArray(ex.tendencia) && ex.tendencia.length > 1) {
    const t = ex.tendencia, d = t[t.length - 1].pct - t[0].pct;
    const pts = Math.abs(d), un = pts === 1 ? "ponto" : "pontos";
    out.push({ titulo: "Consolidado (tendência)", valor: d < 0 ? `Queda de ${pts} ${un}` : d > 0 ? `Alta de ${pts} ${un}` : "Estável", texto: `nos últimos ${t.length} checklists semanais: de ${t[0].pct}% para ${t[t.length - 1].pct}%`, nivel: d < 0 ? "atencao" : "bom", efeito: "tendência do checklist semanal",
      detalhe: tab(["Checklist", "Resultado"], t.map((x) => [dataBR(x.data), `${x.pct}%`])) });
  }
  // KeyAccess: lista das falhas abertas lidas na emissão. Valor e desconto NÃO são recalculados aqui: o merge em
  // montarProjetos preserva os da linha da Visão 360 (sem fórmula paralela).
  if (ex.keyaccess === null) out.push(naoAferido("KeyAccess"));
  else if (Array.isArray(ex.keyaccess)) {
    const ab = ex.keyaccess.filter((r) => !r.horaFim);
    out.push({ titulo: "KeyAccess", abertasLidas: ab.length, semRegistros: !ex.keyaccess.length,
      detalhe: ab.length ? tab(["Data", "Início", "Ponto"], ab.slice(0, 15).map((r) => [dataBR(r.data), r.horaInicio || r.hora || "—", r.portal || r.local || r.ponto || r.equipamento || "—"])) : "" });
  }
  // Energia: histórico e últimos 30 dias
  if (ex.energia === null) out.push(naoAferido("Energia"));
  else if (Array.isArray(ex.energia)) {
    if (!ex.energia.length) out.push({ titulo: "Energia", valor: "—", texto: "Sem registros de energia no app para este projeto", nivel: "neutro", efeito: "não aferido", detalhe: "" });
    else {
      const a = analisarEnergia(ex.energia, agora); const corte = new Date(agora.getTime() - 30 * 86400000).toISOString();
      const q30 = a.quedas.filter((e) => e.inicioQueda >= corte).length;
      out.push({ titulo: "Energia", periodo: "30 dias", valor: `${q30} ${q30 === 1 ? "queda" : "quedas"}`, texto: `nos últimos 30 dias · ${a.quedas.length} no histórico`, nivel: q30 ? (q30 >= 3 ? "alerta" : "atencao") : "bom", efeito: "exibido, sem pontuação",
        detalhe: lis([`${a.quedas.length} quedas desde ${dataBR(a.inicioRegistro)}; ${a.emAberto.length} em aberto.`, `Tempo total sem energia da rede (quedas encerradas): ${hm(a.tempoTotal)}.`,
          a.maior ? `Maior queda: ${dataBR(a.maior.inicioQueda)}, ${hm(Math.round((new Date(a.maior.fimQueda) - new Date(a.maior.inicioQueda)) / 60000))}.` : "Sem queda encerrada registrada.",
          `Gerador acionado em ${a.gerador} de ${a.quedas.length} quedas.`, `${a.abastecimentos.length} abastecimentos de diesel, ${a.litros.toLocaleString("pt-BR")} L.`,
          a.diasDesdeUltima != null ? `Última queda há ${a.diasDesdeUltima} dia(s).` : "Nenhuma queda registrada."]) });
    }
  }
  // Ronda virtual (CFTV): últimos 30 dias, por colaboradora (nomes liberados pelo Marcio)
  if (ex.rondaTurnos === null) out.push(naoAferido("Ronda virtual (CFTV)"));
  else if (Array.isArray(ex.rondaTurnos) && !ex.rondaTurnos.length) out.push({ titulo: "Ronda virtual (CFTV)", valor: "—", texto: "Sem registros de ronda virtual no app", nivel: "neutro", efeito: "sem registros", detalhe: "" });
  else if (Array.isArray(ex.rondaTurnos)) {
    const per = periodoUltimosDias(30, agora); const c = consolidarRondas({ id: pid, name: nome }, ex.rondaTurnos, { agora, de: per.de, ate: per.ate });
    if (!c.totais.turnos) out.push({ titulo: "Ronda virtual (CFTV)", valor: "—", texto: "Nenhum turno nos últimos 30 dias (há registros anteriores)", nivel: "neutro", efeito: "sem registros no período", detalhe: "" });
    else out.push({ titulo: "Ronda virtual (CFTV)", valor: c.totais.execucao == null ? "—" : `${Math.round(c.totais.execucao)}%`, texto: `${c.totais.turnos} turnos em 30 dias · ${c.totais.naoExec} não executadas`, nivel: c.totais.execucao != null && c.totais.execucao < 90 ? "atencao" : "bom", efeito: "também lida pela análise de risco; sem pontuação aqui",
      detalhe: tab(["Colaboradora", "Turnos", "Execução", "Não exec.", "Sem justificativa"], c.colaboradoras.map((p) => [p.rotulo, String(p.turnos), p.execucao == null ? "não disponível" : `${Math.round(p.execucao)}%`, String(p.naoExec), String(p.semJust)])) });
  }
  // Tempo de gravação (CFTV): só o dado; o requisito de retenção do contrato ainda não foi definido
  if (ex.cameras === null) out.push(naoAferido("Tempo de gravação (CFTV)"));
  else if (Array.isArray(ex.cameras) && !ex.cameras.length) out.push({ titulo: "Tempo de gravação (CFTV)", valor: "—", texto: "Sem câmeras cadastradas no app", nivel: "neutro", efeito: "sem registros", detalhe: "" });
  else if (Array.isArray(ex.cameras)) {
    // só número de verdade conta como medição ("" ou texto não viram 0)
    const d = ex.cameras.map((c) => c.diasGravacao).filter((x) => (typeof x === "number" && Number.isFinite(x)) || (typeof x === "string" && x.trim() !== "" && Number.isFinite(Number(x)))).map(Number);
    const faixa = (lo, hi) => d.filter((x) => x >= lo && x < hi).length;
    out.push({ titulo: "Tempo de gravação (CFTV)", valor: d.length ? `${Math.min(...d)}–${Math.max(...d)} dias` : "—", texto: `${ex.cameras.length} câmeras${d.length < ex.cameras.length ? ` · ${ex.cameras.length - d.length} sem medição` : ""}`, nivel: "neutro", efeito: "evidência técnica, sem pontuação",
      detalhe: tab(["Faixa de gravação", "Câmeras"], [["menos de 15 dias", String(faixa(0, 15))], ["15 a 29 dias", String(faixa(15, 30))], ["30 dias ou mais", String(faixa(30, 1e9))], ["sem medição", String(ex.cameras.length - d.length)]]) + "<p>O requisito de retenção do contrato será indicado quando definido.</p>" });
  }
  // Manutenção técnica: pendências abertas por sistema (sem nomes, sem CPF, sem texto livre)
  if (ex.manutencao === null) out.push(naoAferido("Manutenção técnica"));
  else if (Array.isArray(ex.manutencao) && !ex.manutencao.length) out.push({ titulo: "Manutenção técnica", valor: "—", texto: "Sem registros de manutenção no app", nivel: "neutro", efeito: "sem registros", detalhe: "" });
  else if (Array.isArray(ex.manutencao)) {
    const hoje = agora.toISOString().slice(0, 10);
    const ab = ex.manutencao.filter((r) => !r.rascunho && (r.status === "pendente" || r.status === "parcial")).sort((a, b) => String(a.data).localeCompare(String(b.data)));
    const dias = (d) => Math.max(0, Math.round((new Date(hoje + "T12:00:00") - new Date(String(d) + "T12:00:00")) / 86400000));
    out.push({ titulo: "Manutenção técnica", valor: `${ab.length} em aberto`, texto: ab.length ? `mais antiga há ${dias(ab[0].data)} dias (${ab[0].sistema || "sistema não informado"})` : "Nenhuma pendência aberta", nivel: ab.length ? "atencao" : "bom", efeito: "pendências de reparo registradas pela CCO",
      detalhe: ab.length ? tab(["Desde", "Sistema", "Situação", "Em aberto"], ab.slice(0, 15).map((r) => [dataBR(r.data), r.sistema || "—", r.status === "parcial" ? "Parcial" : "Pendente", `${dias(r.data)} d`])) : "" });
  }
  // Iluminação: por quadrante (pontos cadastrados, checados, deficientes, pior quadrante). Só exibido, sem pontuação.
  if (ex.iluminacao === null) out.push(naoAferido("Iluminação"));
  else if (Array.isArray(ex.iluminacao) && !ex.iluminacao.length) out.push({ titulo: "Iluminação", valor: "—", texto: "Sem quadrantes de iluminação cadastrados no app", nivel: "neutro", efeito: "sem registros", detalhe: "" });
  else if (Array.isArray(ex.iluminacao)) {
    // deficientes válido = número finito ≥ 0 (número ou texto numérico); vazio, texto, negativo → não informado (null), nunca 0
    const num = (v) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN);
    const qs = ex.iluminacao.map((q) => { const tRaw = num(q.total); const total = Number.isFinite(tRaw) && tRaw > 0 ? tRaw : 0; const dRaw = num(q.deficientes);
      const valido = Number.isFinite(dRaw) && dRaw >= 0; const def = valido ? Math.min(total, dRaw) : null;
      return { nome: String(q.nome || "—"), total, def, invalido: q.deficientes != null && q.deficientes !== "" && !valido, em: q.atualizadoEm || null }; });
    const cad = qs.reduce((a, q) => a + q.total, 0), chec = qs.filter((q) => q.def != null), pontosChec = chec.reduce((a, q) => a + q.total, 0), def = chec.reduce((a, q) => a + q.def, 0);
    const pior = [...chec].sort((a, b) => b.def - a.def || (b.def / (b.total || 1)) - (a.def / (a.total || 1)))[0];
    const pctOp = pontosChec ? Math.round(((pontosChec - def) / pontosChec) * 1000) / 10 : null;
    const ord = [...qs].sort((a, b) => (b.def ?? -1) - (a.def ?? -1) || a.nome.localeCompare(b.nome));
    const tabelaQ = () => tab(["Quadrante", "Pontos", "Deficientes", "Operacionais", "Atualizado em"], ord.map((q) => [q.nome, String(q.total), q.def == null ? (q.invalido ? "valor inválido" : "não informado") : String(q.def),
        q.def == null || !q.total ? "—" : `${String(Math.round(((q.total - q.def) / q.total) * 1000) / 10).replace(".", ",")}%`, q.em ? dataBR(String(q.em).slice(0, 10)) : "—"]));
    if (!chec.length) out.push({ titulo: "Iluminação", valor: "—", texto: `${qs.length} quadrante(s), ${cad} pontos cadastrados, sem deficientes informados`, nivel: "neutro", efeito: "não aferido", detalhe: tabelaQ() });
    else out.push({ titulo: "Iluminação", valor: `${def} ${def === 1 ? "deficiente" : "deficientes"}`,
      texto: `${pontosChec} de ${cad} pontos checados${pctOp != null ? ` · ${String(pctOp).replace(".", ",")}% operacionais` : ""}${pior && pior.def ? ` · pior quadrante: ${pior.nome} (${pior.def} de ${pior.total})` : ""}`,
      nivel: def ? "atencao" : "bom", efeito: "exibido, sem pontuação",
      detalhe: tabelaQ()
        + (qs.length - chec.length ? `<p>${qs.length - chec.length} quadrante(s) sem deficientes informados não entram na contagem de checados.</p>` : "") });
  }
  // Ambulância (Mega): últimos 30 dias, sem dado de vítima
  if (ex.ambulancia === null) out.push(naoAferido("Acessos de ambulância"));
  else if (Array.isArray(ex.ambulancia) && !ex.ambulancia.length) out.push({ titulo: "Acessos de ambulância", valor: "—", texto: "Sem registros de ambulância no app", nivel: "neutro", efeito: "sem registros", detalhe: "" });
  else if (Array.isArray(ex.ambulancia)) {
    const per = periodoUltimosDias(30, agora); const a = analisarAmbulancia(ex.ambulancia, { inicio: per.de, fim: per.ate });
    out.push({ titulo: "Acessos de ambulância", valor: `${a.n}`, texto: `nos últimos 30 dias${a.permMedia != null ? ` · permanência média ${Math.round(a.permMedia)} min` : ""}`, nivel: a.n ? "atencao" : "bom", efeito: "registro de atendimento",
      detalhe: a.n ? tab(["Inquilino", "Atendimentos"], a.porInquilino.slice(0, 8).map((x) => [x[0], String(x[1])])) + tab(["Tipo de ocorrência", "Atendimentos"], a.porTipo.slice(0, 8).map((x) => [x[0], String(x[1])])) : "" });
  }
  return out;
}

// Converte as penalidades da Visão 360 em cartões legíveis (mesmos textos e valores calculados no app).
function cartoesPenalidade(row) {
  return (row.penalidades || []).map((p) => {
    const l = String(p.label || "");
    // tipo e quantidade vêm ESTRUTURADOS de computeScore360 (sem extrair número do rótulo). Sem eles: título genérico
    // e o próprio rótulo, sem número inventado.
    const TIT = { keyaccess: "KeyAccess", ctmk: "Monitor CTMK", bolsao: "Bolsão", perimetro: "Perímetro", ronda: "Ronda VSPP" };
    const titulo = TIT[p.tipo] || "Pendência";
    const n = Number.isFinite(p.qtd) ? p.qtd : null;
    const pl = (um, varios) => (n === 1 ? um : varios);
    const valor = n == null ? `−${p.val}` : p.tipo === "ronda" ? `${n}%` : p.tipo === "keyaccess" ? `${n} ${pl("aberta", "abertas")}` : p.tipo === "ctmk" ? `${n} d off-line`
      : p.tipo === "bolsao" ? `${n} ${pl("placa", "placas")}` : p.tipo === "perimetro" ? `${n} ${pl("zona", "zonas")}` : `−${p.val}`;
    return { titulo, valor, texto: l, nivel: p.val >= 10 ? "alerta" : "atencao", efeito: `−${p.val} na pontuação`,
      detalhe: `<p>${escHTML(l)}. Este item desconta ${p.val} ponto(s) da pontuação do projeto na Visão 360.</p>` };
  });
}

export function montarProjetos(rows, extras = {}, agora = new Date()) {
  return (rows || []).map((r) => {
    const ex = extras[r.id] || {};
    const cards = [];
    if (ex.ultimo) cards.push({ titulo: "Checklist semanal", valor: `${ex.ultimo.pct}%`, texto: `${ex.ultimo.total} pontos · ${ex.ultimo.inop} inoperantes · ${ex.ultimo.partial} parciais · checklist de ${dataBR(ex.ultimo.data)}`,
      nivel: ex.ultimo.pct >= 90 ? "bom" : ex.ultimo.pct >= 75 ? "atencao" : "alerta", efeito: "base da pontuação" });
    else cards.push({ titulo: "Checklist semanal", valor: "—", texto: "Nenhum checklist registrado", nivel: "neutro", efeito: "sem base para a pontuação" });
    cards.push(...cartoesPenalidade(r));
    if (r.energiaTemDados === false) cards.push({ titulo: "Energia", valor: "—", texto: "Sem registros de energia no app para este projeto", nivel: "neutro", efeito: "não aferido" });
    else if (r.energiaQuedas7d || r.energiaAberta) cards.push({ titulo: "Energia", periodo: "7 dias", valor: `${r.energiaQuedas7d}`, texto: `${r.energiaQuedas7d === 1 ? "queda" : "quedas"} nos últimos 7 dias${r.energiaAberta ? " · ocorrência em aberto" : ""}`, nivel: r.energiaAberta ? "alerta" : "atencao", efeito: "exibido, sem pontuação" });
    else cards.push({ titulo: "Energia", periodo: "7 dias", valor: "0", texto: "Nenhuma queda nos últimos 7 dias", nivel: "bom", efeito: "exibido, sem pontuação" });
    if (r.ilumTotal) cards.push({ titulo: "Iluminação", valor: `${r.ilumDeficientes}`, texto: `pontos deficientes de ${r.ilumTotal}`, nivel: r.ilumDeficientes ? "atencao" : "bom", efeito: "exibido, sem pontuação" });
    // Nível 3: relatórios com resumo (o laudo ganha o detalhe "onde estão as falhas"; energia completa substitui o resumo de 7 dias)
    const rel = cartoesRelatorios(r.id, r.name, ex, agora);
    const laudo = rel.find((x) => x.ancora === "laudo"); if (laudo && cards[0]) cards[0].detalhe = laudo.detalhe;
    rel.filter((x) => !x.ancora).forEach((x) => {
      const i = cards.findIndex((c) => c.titulo === x.titulo);
      if (x.titulo === "KeyAccess" && x.abertasLidas !== undefined) {
        const pen = (r.penalidades || []).find((p) => p.tipo === "keyaccess");
        const qtdLinha = pen && Number.isFinite(pen.qtd) ? pen.qtd : 0;
        const nota = x.abertasLidas !== qtdLinha ? `<p>Leitura na emissão: ${x.abertasLidas} em aberto. A pontuação usa a leitura da Visão 360 (${qtdLinha}).</p>` : "";
        if (i >= 0) { cards[i] = { ...cards[i], detalhe: `${x.detalhe}${nota}` }; return; }          // valor e desconto da linha
        cards.push(x.semRegistros
          ? { titulo: "KeyAccess", valor: "—", texto: "Sem registros de KeyAccess no app", nivel: "neutro", efeito: "sem registros", detalhe: "" }
          : { titulo: "KeyAccess", valor: "0 abertas", texto: "Nenhuma falha de acesso em aberto na Visão 360", nivel: "bom", efeito: "sem desconto na pontuação", detalhe: `${x.detalhe}${nota}` });
        return;
      }
      if (i >= 0) cards[i] = x; else cards.push(x);
    });
    cards.forEach((c) => {
      const rel = RELATORIO_COMPLETO[c.titulo]; if (!rel || c.efeito === "não aferido" || c.efeito === "sem registros") return;
      c.detalhe = `${c.detalhe || `<p>${escHTML(c.texto)}.</p>`}<p class="rel">Mais detalhes no relatório específico: <b>${escHTML(rel)}</b>, no MokLog CheckTest.</p>`;
    });
    return { id: r.id, nome: r.name, score: r.score, base: r.base, semChecklist: !!r.semChecklist, penalidades: r.penalidades || [], tendencia: ex.tendencia || [], cards };
  });
}

function sparkSVG(t) {
  if (!t || t.length < 2) return "";
  const w = 180, h = 40, v = t.map((x) => x.pct), mn = Math.min(...v) - 1, mx = Math.max(...v) + 1;
  const x = (i) => (i * w) / (v.length - 1), y = (a) => h - ((a - mn) / (mx - mn || 1)) * h;
  return `<svg viewBox="0 0 ${w} ${h + 4}" width="180" height="44" role="img" aria-label="Checklist nas últimas ${v.length} semanas"><polyline fill="none" stroke="currentColor" stroke-width="2" points="${v.map((a, i) => `${x(i).toFixed(1)},${y(a).toFixed(1)}`).join(" ")}"/><circle cx="${x(v.length - 1).toFixed(1)}" cy="${y(v[v.length - 1]).toFixed(1)}" r="3.5" fill="#B21E27"/></svg>`;
}

export function montarHTMLExecutivo({ rows, grupoLabel, agora = new Date(), extras = {}, notaCalculo = "", logoSrc = "" }) {
  if (!grupoLabel) throw new Error("HTML Executivo é por cliente: selecione um grupo (a visão Todos é interna).");
  const projetos = montarProjetos([...(rows || [])].sort((a, b) => b.score - a.score), extras, agora);
  const media = projetos.length ? Math.round(projetos.reduce((s, p) => s + p.score, 0) / projetos.length) : 0;
  const emissao = `${agora.toLocaleDateString("pt-BR")} às ${agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  const dados = projetos.map((p) => ({ ...p, spark: sparkSVG(p.tendencia), cards: p.cards.map((c) => ({ titulo: escHTML(c.titulo), valor: escHTML(c.valor), texto: escHTML(c.texto), efeito: escHTML(c.efeito), periodo: escHTML(c.periodo || ""), nivel: c.nivel, detalhe: c.detalhe || "" })),
    nome: escHTML(p.nome), penalidades: p.penalidades.map((x) => ({ val: x.val, label: escHTML(x.label) })) }));
  const json = JSON.stringify(dados).replace(/</g, "\\u003c");
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Relatório Executivo — ${escHTML(grupoLabel)}</title>
<style>
:root{--bg:#F5F6F8;--papel:#fff;--tinta:#121212;--tinta2:#4B5563;--mu:#6B7280;--linha:#E5E7EB;--moked:#B21E27;--ok:#15803D;--wa:#B45309;--barra:#1F2937;--suave:#F3F4F6}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0F1115;--papel:#171A21;--tinta:#F3F4F6;--tinta2:#CBD5E1;--mu:#94A3B8;--linha:#2A2F3A;--barra:#E5E7EB;--suave:#1F242E}}
:root{box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}*,*::before,*::after{box-sizing:inherit}
body{margin:0;background:var(--bg);color:var(--tinta);font-family:Calibri,Carlito,"Segoe UI",system-ui,Arial,sans-serif;font-size:15px;line-height:1.45}
.wrap{max-width:1040px;margin:0 auto;padding:18px 16px 40px}
header{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;border-bottom:3px solid var(--tinta);padding-bottom:12px;position:relative}
header::after{content:"";position:absolute;right:0;bottom:-3px;width:28%;height:3px;background:var(--moked)}
.marca{display:flex;align-items:center;gap:12px}.marca img{height:34px;background:#fff;border-radius:4px;padding:2px}.marca b{font-size:17px}.marca span{display:block;font-size:12.5px;color:var(--mu)}
.emit{font-size:12.5px;color:var(--mu);text-align:right}
.trilha{font-size:13.5px;color:var(--mu);margin:14px 0 6px}.trilha a{color:var(--tinta2);cursor:pointer;text-decoration:underline;text-underline-offset:2px}
h1{font-size:26px;margin:2px 0 4px}.sub{color:var(--tinta2);margin:0 0 16px}
.painel{background:var(--papel);border:1px solid var(--linha);border-radius:10px;padding:16px 18px;margin-bottom:14px}
.media{display:flex;align-items:baseline;gap:10px;margin-bottom:10px}.media b{font-size:40px;line-height:1}.media span{color:var(--tinta2)}
.lin{display:grid;grid-template-columns:34px minmax(150px,1.2fr) 3fr 56px;gap:12px;align-items:center;padding:10px 8px;border-radius:8px;cursor:pointer;border:1px solid transparent;background:none;font:inherit;color:inherit;text-align:left;width:100%}
.lin:hover,.lin:focus-visible{background:var(--suave);border-color:var(--linha);outline:none}
.pos{font-weight:700;color:var(--mu);text-align:center}.lin:first-child .pos{color:var(--moked)}.nome b{display:block}.nome span{font-size:12.5px;color:var(--mu)}
.trilho{height:12px;background:var(--suave);border-radius:3px;overflow:hidden}.trilho i{display:block;height:100%;background:var(--barra)}
.nota{font-size:22px;font-weight:700;text-align:right}.nota small{font-size:11px;color:var(--mu);font-weight:400}.fator{grid-column:2 / -1;font-size:12.5px;color:var(--mu);margin-top:-4px}
table{width:100%;border-collapse:collapse;font-size:13.5px}th{font-size:11.5px;color:var(--mu);text-align:left;border-bottom:1.5px solid var(--tinta);padding:6px}td{border-bottom:1px solid var(--linha);padding:7px 6px}.rol{overflow-x:auto}
.cab{display:grid;grid-template-columns:1fr auto;gap:16px;align-items:end}
.cadeia{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px}
.mod{background:var(--papel);border:1px solid var(--linha);border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:6px;min-height:120px;text-align:left;font:inherit;color:inherit}
button.mod{cursor:pointer}button.mod:hover,button.mod:focus-visible{border-color:var(--tinta2);outline:none}.mod .ver{font-size:12px;color:var(--moked);font-weight:700}
.det{background:var(--papel);border:1px solid var(--linha);border-radius:10px;padding:16px 18px;margin-top:12px}.det h2{font-size:18px;margin:0 0 8px}.det table{margin:8px 0}.det ul{margin:6px 0;padding-left:18px}
.det .rel{margin-top:12px;padding-top:10px;border-top:1px solid var(--linha);font-size:13.5px;color:var(--tinta2)}
.fechar{font:inherit;font-size:13px;border:1px solid var(--linha);background:var(--papel);color:var(--tinta);padding:6px 12px;border-radius:6px;cursor:pointer;margin-top:8px}
.mod .t{font-size:13px;color:var(--mu)}.mod .v{font-size:24px;font-weight:700;line-height:1.1}.mod .d{font-size:13px;color:var(--tinta2)}.mod .e{margin-top:auto;font-size:12px;color:var(--mu)}
.alerta{border-left:4px solid var(--moked)}.atencao{border-left:4px solid var(--wa)}.bom{border-left:4px solid var(--ok)}.neutro{border-left:4px solid var(--linha)}
.fut{font-size:13px;color:var(--mu);margin-top:12px}.rodape{font-size:12px;color:var(--mu);margin-top:22px;border-top:1px solid var(--linha);padding-top:10px}
button:focus-visible,a:focus-visible{outline:2px solid var(--moked);outline-offset:2px}
@media (max-width:620px){.lin{grid-template-columns:28px 1fr 46px}.lin .trilho{grid-column:2 / -1;grid-row:2}.cab{grid-template-columns:1fr}h1{font-size:22px}}
@media print{body{background:#fff}.lin{break-inside:avoid}}
</style></head><body><div class="wrap">
<header><div class="marca">${logoSrc ? `<img src="${escHTML(logoSrc)}" alt="Moked Consulting Security">` : ""}<div><b>Relatório Executivo — ${escHTML(grupoLabel)}</b><span>Saúde operacional consolidada por projeto</span></div></div>
<div class="emit">Emissão ${escHTML(emissao)}<br>Moked Consulting Security</div></header>
<main id="app"></main>
<div class="rodape">${escHTML(notaCalculo)} Documento gerado pelo MokLog CheckTest com os dados disponíveis no momento da emissão; não se atualiza sozinho.</div>
</div>
<script>
var D=${json};var GRUPO=${JSON.stringify(escHTML(grupoLabel))};var MEDIA=${media};var FUT=${JSON.stringify(MODULOS_FUTUROS)};var est=null;
var app=document.getElementById("app");
function grupo(){return '<div class="trilha">'+GRUPO+'</div><h1>'+GRUPO+': '+D.length+(D.length===1?' projeto':' projetos')+'</h1><p class="sub">Clique num projeto para ver o resumo dos relatórios dele.</p>'+
 '<section class="painel"><div class="media"><b>'+MEDIA+'</b><span>pontuação média de 100 — checklist semanal descontado das pendências abertas nos demais módulos</span></div><div>'+
 D.map(function(p,i){return '<button class="lin" data-p="'+p.id+'"><span class="pos">'+(i+1)+'º</span><span class="nome"><b>'+p.id+' · '+p.nome+'</b><span>'+(p.semChecklist?'sem checklist registrado':'checklist '+p.base+'%')+'</span></span><span class="trilho"><i style="width:'+Math.max(0,Math.min(100,p.score))+'%"></i></span><span class="nota">'+p.score+'<small>/100</small></span><span class="fator">'+(p.penalidades.length?p.penalidades.map(function(x){return x.label+' (−'+x.val+')';}).join(' · '):'Sem pendências que descontem a pontuação')+'</span></button>';}).join('')+'</div></section>'+
 '<section class="painel"><h2 style="font-size:17px;margin:0 0 8px">Comparação</h2><div class="rol"><table><thead><tr><th>Projeto</th><th>Pontuação</th><th>Checklist</th><th>Pendências que descontam</th><th>Energia (quedas)</th><th>Iluminação</th></tr></thead><tbody>'+
 D.map(function(p){var en=p.cards.filter(function(c){return c.titulo==='Energia';})[0];var il=p.cards.filter(function(c){return c.titulo==='Iluminação';})[0];return '<tr><td><b>'+p.id+'</b></td><td>'+p.score+'</td><td>'+(p.semChecklist?'—':p.base+'%')+'</td><td>'+p.penalidades.length+'</td><td>'+(en?en.valor+(en.periodo?' · '+en.periodo:''):'—')+'</td><td>'+(il?il.valor+' deficientes':'—')+'</td></tr>';}).join('')+'</tbody></table></div></section>';}
var abertoMod=null;
function projeto(p){return '<div class="trilha"><a tabindex="0" data-voltar>'+GRUPO+'</a> › '+p.id+'</div><div class="cab"><div><h1>'+p.id+' · '+p.nome+'</h1><p class="sub">'+p.score+' de 100'+(p.penalidades.length?' · '+p.penalidades.length+(p.penalidades.length===1?' pendência desconta':' pendências descontam')+' a pontuação':' · sem pendências que descontem a pontuação')+'.</p></div>'+
 (p.spark?'<div>'+p.spark+'<div style="font-size:12px;color:var(--mu)">checklist nas últimas '+p.tendencia.length+' semanas</div></div>':'')+'</div>'+
 '<div class="cadeia">'+p.cards.map(function(c,i){var corpo='<span class="t">'+c.titulo+'</span><span class="v">'+c.valor+'</span><span class="d">'+c.texto+'</span><span class="e">'+c.efeito+'</span>';
   return c.detalhe?'<button class="mod '+c.nivel+'" data-m="'+i+'">'+corpo+'<span class="ver">Ver resumo</span></button>':'<div class="mod '+c.nivel+'">'+corpo+'</div>';}).join('')+'</div>'+
 (abertoMod!==null&&p.cards[abertoMod]?'<section class="det" id="det"><h2>'+p.cards[abertoMod].titulo+' — '+p.cards[abertoMod].valor+'</h2>'+p.cards[abertoMod].detalhe+'<button class="fechar" data-fechar>Fechar resumo</button></section>':'')+
 '<p class="fut">Não incluídos nesta versão: '+FUT.join(', ')+'.</p>';}
function render(){app.innerHTML=est?projeto(D.filter(function(p){return p.id===est;})[0]):grupo();
 Array.prototype.forEach.call(app.querySelectorAll('[data-p]'),function(b){b.onclick=function(){est=b.getAttribute('data-p');abertoMod=null;render();window.scrollTo(0,0);};});
 Array.prototype.forEach.call(app.querySelectorAll('[data-m]'),function(b){b.onclick=function(){abertoMod=Number(b.getAttribute('data-m'));render();var d=document.getElementById('det');if(d&&d.scrollIntoView)d.scrollIntoView({behavior:'smooth',block:'nearest'});};});
 Array.prototype.forEach.call(app.querySelectorAll('[data-fechar]'),function(b){b.onclick=function(){abertoMod=null;render();};});
 Array.prototype.forEach.call(app.querySelectorAll('[data-voltar]'),function(a){a.onclick=function(){est=null;abertoMod=null;render();};a.onkeydown=function(e){if(e.key==='Enter')a.onclick();};});}
render();
</script></body></html>`;
}

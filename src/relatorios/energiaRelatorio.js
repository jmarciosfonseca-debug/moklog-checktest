// Relatório de Ocorrências de Energia — padrão Moked (aprovado em 04/10/2026).
// Correções em relação ao relatório anterior:
//  • "Abastecimento avulso de diesel" (tipoRegistro diesel_avulso) NÃO é queda: vai para uma seção própria.
//  • Protocolo válido = número (8+ dígitos); "Nao", "N/A" e vazio não contam; número repetido é sinalizado.
//  • Turno calculado pela hora de início (06:00–17:59 diurno).
//  • Inquilino afetado também conta como impacto; registros de teste ficam fora das contas.
import { documentoMoked, barrasMoked, escHTML, num1, milhar, hm, dataBR, horaBR } from "./padraoMoked";

const minutos = (e) => (e.inicioQueda && e.fimQueda) ? Math.max(0, Math.round((new Date(e.fimQueda) - new Date(e.inicioQueda)) / 60000)) : null;
export const protocoloValido = (p) => { const s = String(p || "").trim(); return !!s && !/^(?:\d{1,2}([/.\-])\d{1,2}\1\d{2,4}|\d{4}([/.\-])\d{1,2}\2\d{1,2})$/.test(s) && /^[\d\s/.\-]+$/.test(s) && s.replace(/\D/g, "").length >= 8; };   // data no lugar do nº não vale
export const turnoPelaHora = (iso) => { const h = new Date(iso).getHours(); return h >= 6 && h < 18 ? "Diurno" : "Noturno"; };
export const ehTeste = (e) => e?.teste === true || (/\bteste\b/i.test(`${e?.obs || ""} ${e?.obsGerador || ""}`) && minutos(e) != null && minutos(e) < 1);
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function analisarEnergia(eventos, hoje = new Date()) {
  const todos = (eventos || []).filter(e => e && e.inicioQueda);
  const testes = todos.filter(ehTeste);
  const reais = todos.filter(e => !ehTeste(e));
  const quedas = reais.filter(e => e.tipoRegistro !== "diesel_avulso").sort((a, b) => b.inicioQueda.localeCompare(a.inicioQueda));
  const abastecimentos = reais.filter(e => e.tipoRegistro === "diesel_avulso" || (e.diesel && e.diesel.acionado)).sort((a, b) => b.inicioQueda.localeCompare(a.inicioQueda));
  const encerradas = quedas.filter(e => minutos(e) != null);
  const tempoTotal = encerradas.reduce((a, e) => a + minutos(e), 0);
  const ds = encerradas.map(minutos).sort((a, b) => a - b);
  const mediana = ds.length ? (ds.length % 2 ? ds[(ds.length - 1) / 2] : (ds[ds.length / 2 - 1] + ds[ds.length / 2]) / 2) : 0;
  const maior = encerradas.reduce((m, e) => (!m || minutos(e) > minutos(m)) ? e : m, null);
  const asc = [...quedas].sort((a, b) => a.inicioQueda.localeCompare(b.inicioQueda));
  const intervalos = asc.slice(1).map((e, i) => (new Date(e.inicioQueda) - new Date(asc[i].inicioQueda)) / 86400000);
  const contagem = {}; quedas.forEach(e => { if (protocoloValido(e.protocolo)) contagem[e.protocolo.trim()] = (contagem[e.protocolo.trim()] || 0) + 1; });
  const repetidos = new Set(Object.keys(contagem).filter(k => contagem[k] > 1));
  const porMes = []; asc.forEach(e => { const d = new Date(e.inicioQueda); const k = `${MESES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`; let r = porMes.find(x => x.k === k); if (!r) porMes.push(r = { k, n: 0, min: 0 }); r.n++; r.min += minutos(e) || 0; });
  const faixas = [["até 15 min", 0], ["15–60 min", 0], ["1–4 h", 0], ["4–8 h", 0], ["mais de 8 h", 0]];
  encerradas.forEach(e => { const m = minutos(e); faixas[m <= 15 ? 0 : m <= 60 ? 1 : m <= 240 ? 2 : m <= 480 ? 3 : 4][1]++; });
  const afetadas = quedas.filter(e => e.impactoOperacao || e.inquilinoImpactado);
  const lancado = (e) => e.turno || e.turnoInicio || "";
  const inicioRegistro = todos.length ? todos.map(e => e.inicioQueda).sort()[0] : null;
  return {
    quedas, abastecimentos, testes, encerradas, tempoTotal, mediana, maior, intervalos,
    mediaIntervalo: intervalos.length ? intervalos.reduce((a, b) => a + b, 0) / intervalos.length : null,
    diasDesdeUltima: quedas.length ? Math.floor((hoje - new Date(quedas[0].inicioQueda)) / 86400000) : null,
    diasDeRegistro: inicioRegistro ? Math.max(1, Math.floor((hoje - new Date(inicioRegistro)) / 86400000)) : 0, inicioRegistro,
    gerador: quedas.filter(e => e.gerador === "sim").length, manutencista: quedas.filter(e => e.manutencista).length,
    protocolosValidos: quedas.filter(e => protocoloValido(e.protocolo)).length,
    protocolosTexto: quedas.filter(e => e.protocolo && !protocoloValido(e.protocolo)), repetidos,
    turnoDivergente: quedas.filter(e => lancado(e) && lancado(e) !== turnoPelaHora(e.inicioQueda)),
    impactoSemMarca: quedas.filter(e => e.inquilinoImpactado && !e.impactoOperacao),
    emAberto: quedas.filter(e => !e.fimQueda),
    noturnas: quedas.filter(e => turnoPelaHora(e.inicioQueda) === "Noturno").length,
    porMes, faixas, afetadas,
    litros: abastecimentos.reduce((a, e) => a + (Number(e.diesel?.litros) || 0), 0),
    fornecedores: new Set(abastecimentos.map(e => e.diesel?.fornecedor?.nome).filter(Boolean)).size,
  };
}

export function montarRelatorioEnergia(project, eventos, { subtitulo = "Histórico completo", interno = false, hoje = new Date() } = {}) {
  const a = analisarEnergia(eventos, hoje);
  const numero = `MK-${project.id}-EN-${String(hoje.getMonth() + 1).padStart(2, "0")}${String(hoje.getDate()).padStart(2, "0")}`;
  const periodo = a.inicioRegistro ? `${dataBR(a.inicioRegistro)} a ${hoje.toLocaleDateString("pt-BR")} · ${a.diasDeRegistro} dias de registro` : "sem registros";
  const sub = `<b>${escHTML(project.id)} — ${escHTML(project.name || "")}</b> · ${escHTML(subtitulo)} · ${periodo}`;
  const nq = a.quedas.length;
  const sim = (v) => v ? '<span class="mk-sim">Sim</span>' : '<span class="mk-nao">Não</span>';
  const prot = (p) => protocoloValido(p) ? (a.repetidos.has(p.trim()) ? `<span class="mk-inv">${escHTML(p)} *</span>` : escHTML(p)) : (p ? `<span class="mk-inv">“${escHTML(p)}” — inválido</span>` : '<span class="mk-nao">sem protocolo</span>');
  const afetadoTxt = (e) => e.inquilinosAfetados || e.obsImpacto || (e.impactoOperacao || e.inquilinoImpactado ? "Sim" : "");
  const obsCurta = (e) => [e.obsGerador, e.obs].filter(Boolean).join(" · ");
  let corpo;
  if (!nq) {
    corpo = `<div class="mk-vazio"><div class="mk-lb">Desde o início do registro</div><div class="mk-big">${a.diasDeRegistro} dias</div><div class="mk-kl">sem queda de energia registrada</div>
      ${a.testes.length ? `<div class="mk-mu mk-sm" style="margin-top:6px">${a.testes.length === 1 ? "O único lançamento é um teste" : `${a.testes.length} lançamentos são testes`} e fica${a.testes.length === 1 ? "" : "m"} fora das estatísticas.</div>` : ""}</div>
      <section class="mk-kpis"><div class="mk-k"><div class="mk-kv">0</div><div class="mk-kl">quedas de energia</div></div><div class="mk-k"><div class="mk-kv">0h00</div><div class="mk-kl">sem energia da rede</div></div>
      <div class="mk-k"><div class="mk-kv">${a.abastecimentos.length}</div><div class="mk-kl">abastecimentos de diesel</div></div><div class="mk-k"><div class="mk-kv">${a.testes.length}</div><div class="mk-kl">registros de teste</div><div class="mk-mu mk-sm">fora das contas</div></div></section>
      <section class="mk-dest"><div class="mk-h2">Leitura</div><ul><li>Nenhuma queda de energia lançada pelas equipes em ${a.diasDeRegistro} dias.</li><li>O relatório reflete apenas o que foi registrado: quedas curtas (menos de 15 minutos) também devem ser lançadas.</li></ul></section>`;
  } else {
    const mesMaior = a.porMes.reduce((m, x) => (!m || x.min > m.min) ? x : m, null);
    corpo = `<section class="mk-hero"><div><div class="mk-lb">Tempo sem energia da rede</div><div class="mk-big">${hm(a.tempoTotal)}</div>
      <div class="mk-chip ${a.gerador === nq ? "mk-chip-ok" : "mk-chip-wa"}">Gerador acionado em ${a.gerador} de ${nq} quedas</div>
      <div class="mk-mu mk-sm">${nq} ${nq === 1 ? "queda" : "quedas"}${a.mediaIntervalo != null ? ` · 1 a cada ${num1(a.mediaIntervalo)} dias em média` : ""}${a.emAberto.length ? ` · ${a.emAberto.length} em aberto` : ""}</div></div>
      <div><div class="mk-lb">Quedas e horas sem energia por mês</div>${barrasMoked(a.porMes.map(x => [`${x.k} · ${x.n}`, x.min]), hm)}</div></section>
      <section class="mk-kpis">
      <div class="mk-k"><div class="mk-kv">${nq}</div><div class="mk-kl">quedas de energia</div><div class="mk-mu mk-sm">${a.noturnas} noturnas pela hora de início</div></div>
      <div class="mk-k"><div class="mk-kv">${hm(a.mediana)}</div><div class="mk-kl">duração mediana</div><div class="mk-mu mk-sm">${a.maior ? `maior: ${hm(minutos(a.maior))} em ${dataBR(a.maior.inicioQueda).slice(0, 5)}` : ""}</div></div>
      <div class="mk-k"><div class="mk-kv ${a.protocolosValidos === nq ? "" : "mk-wa"}">${a.protocolosValidos} de ${nq}</div><div class="mk-kl">com protocolo válido</div><div class="mk-mu mk-sm">${nq - a.protocolosValidos} sem protocolo ou com texto no lugar do número</div></div>
      <div class="mk-k"><div class="mk-kv">${a.abastecimentos.length}${a.litros ? ` · ${milhar(a.litros)} L` : ""}</div><div class="mk-kl">abastecimentos de diesel</div><div class="mk-mu mk-sm">${a.fornecedores} ${a.fornecedores === 1 ? "fornecedor" : "fornecedores"}</div></div></section>
      <section class="mk-dest"><div class="mk-h2">Destaques do período</div><ul>
      ${a.maior ? `<li>A queda mais longa foi em <b>${dataBR(a.maior.inicioQueda).slice(0, 5)}</b>: <b>${hm(minutos(a.maior))}</b> sem energia da rede${afetadoTxt(a.maior) ? `, com impacto: ${escHTML(afetadoTxt(a.maior))}` : ""}.</li>` : ""}
      ${a.porMes.length > 1 && mesMaior ? `<li>${escHTML(mesMaior.k)} somou <b>${hm(mesMaior.min)}</b> sem energia em ${mesMaior.n} ${mesMaior.n === 1 ? "queda" : "quedas"}, o maior volume do período.</li>` : ""}
      <li>O gerador foi acionado em <b>${a.gerador === nq ? "todas" : `${a.gerador} de ${nq}`}</b> as quedas; o manutencista, em ${a.manutencista} de ${nq}.</li>
      ${a.afetadas.length ? `<li><b>${a.afetadas.length}</b> ${a.afetadas.length === 1 ? "queda afetou" : "quedas afetaram"} a operação de inquilinos.</li>` : ""}</ul></section>
      <div class="mk-duas"><div class="mk-card"><div class="mk-lb">Quedas por duração</div>${barrasMoked(a.faixas, v => `${v} ${v === 1 ? "queda" : "quedas"}`)}</div>
      <div class="mk-card"><div class="mk-lb">Impacto em inquilinos</div>${a.afetadas.length ? a.afetadas.map(e => `<div class="mk-sm" style="margin:4px 0"><b>${dataBR(e.inicioQueda).slice(0, 5)}</b> — ${escHTML(afetadoTxt(e))}${minutos(e) != null ? ` (${hm(minutos(e))})` : ""}</div>`).join("") : '<div class="mk-sm mk-mu" style="margin-top:6px">Nenhuma queda com inquilino afetado.</div>'}</div></div>
      <section><div class="mk-h2">Registro das quedas <span class="mk-mu">— mais recentes primeiro</span></div>
      <table class="mk-tb"><colgroup><col style="width:15%"><col style="width:8%"><col style="width:8%"><col style="width:8%"><col style="width:15%"><col style="width:20%"><col style="width:26%"></colgroup>
      <thead><tr><th>Início</th><th class="mk-num">Duração</th><th>Gerador</th><th>Manut.</th><th>Inquilino afetado</th><th>Protocolo</th><th>Observação</th></tr></thead><tbody>
      ${a.quedas.map(e => `<tr><td><b>${dataBR(e.inicioQueda)}</b> ${horaBR(e.inicioQueda)}<div class="mk-mu">${turnoPelaHora(e.inicioQueda)}</div></td><td class="mk-num"><b>${minutos(e) != null ? hm(minutos(e)) : "em aberto"}</b></td>
      <td>${sim(e.gerador === "sim")}</td><td>${sim(!!e.manutencista)}</td><td>${afetadoTxt(e) ? escHTML(afetadoTxt(e)) : '<span class="mk-nao">—</span>'}</td><td class="mk-sm">${prot(e.protocolo)}</td><td class="mk-sm mk-mu">${escHTML(obsCurta(e))}</td></tr>`).join("")}
      </tbody></table>${a.repetidos.size ? '<p class="mk-nota">* Número de protocolo repetido em mais de uma queda — conferir.</p>' : ""}</section>`;
  }
  if (a.abastecimentos.length) {
    const resp = (dz) => { if (!dz?.contatoEfetuadoEm || !dz?.entregaChegouEm) return "—"; const m = Math.round((new Date(dz.entregaChegouEm) - new Date(dz.contatoEfetuadoEm)) / 60000); return m > 0 ? hm(m) : '<span class="mk-inv">0 min</span>'; };
    corpo += `<section class="mk-bloco"><div class="mk-h2">Abastecimento de diesel <span class="mk-mu">— registrado à parte das quedas</span></div>
      <table class="mk-tb"><thead><tr><th>Data</th><th>Fornecedor</th><th class="mk-num">Litros</th><th class="mk-num">Resposta</th><th>Detalhe</th></tr></thead><tbody>
      ${a.abastecimentos.map(e => `<tr><td><b>${dataBR(e.inicioQueda)}</b> ${horaBR(e.inicioQueda)}</td><td>${escHTML(e.diesel?.fornecedor?.nome || "—")}</td><td class="mk-num">${e.diesel?.litros ? milhar(e.diesel.litros) + " L" : "—"}</td><td class="mk-num">${resp(e.diesel)}</td><td class="mk-sm mk-mu">${escHTML(e.diesel?.descricao || "")}${e.tipoRegistro !== "diesel_avulso" ? ` · junto com a queda de ${dataBR(e.inicioQueda).slice(0, 5)}` : ""}</td></tr>`).join("")}
      </tbody></table>${a.litros ? `<p class="mk-nota">Total abastecido: <b>${milhar(a.litros)} L</b>.</p>` : ""}</section>`;
  }
  if (interno) {
    const itens = [];
    if (a.protocolosTexto.length) itens.push(`<li><b>Protocolo:</b> ${a.protocolosTexto.length} ${a.protocolosTexto.length === 1 ? "queda tem" : "quedas têm"} texto no lugar do número (${[...new Set(a.protocolosTexto.map(e => `“${escHTML(e.protocolo)}”`))].join(", ")}).</li>`);
    if (a.repetidos.size) itens.push(`<li><b>Protocolo repetido:</b> ${[...a.repetidos].map(escHTML).join(", ")}.</li>`);
    if (a.turnoDivergente.length) itens.push(`<li><b>Turno:</b> ${a.turnoDivergente.map(e => `${dataBR(e.inicioQueda).slice(0, 5)} às ${horaBR(e.inicioQueda)} lançada como ${escHTML(e.turno || e.turnoInicio)}`).join("; ")} — o relatório usa o turno pela hora.</li>`);
    if (a.impactoSemMarca.length) itens.push(`<li><b>Impacto:</b> inquilino afetado sem a marcação "impacto na operação" em ${a.impactoSemMarca.map(e => dataBR(e.inicioQueda).slice(0, 5)).join(", ")}.</li>`);
    if (a.emAberto.length) itens.push(`<li><b>Quedas sem horário de fim:</b> ${a.emAberto.map(e => dataBR(e.inicioQueda).slice(0, 5)).join(", ")} — conferir o encerramento.</li>`);
    if (a.testes.length) itens.push(`<li><b>Registros de teste fora das contas:</b> ${a.testes.map(e => dataBR(e.inicioQueda)).join(", ")}.</li>`);
    corpo += `<section class="mk-qual mk-bloco"><div class="mk-h2">Conferência do registro <span class="mk-mu">— versão interna</span></div>${itens.length ? `<ul>${itens.join("")}</ul>` : '<div class="mk-sm">Nenhuma inconsistência encontrada.</div>'}</section>`;
  }
  return { html: documentoMoked({ project, titulo: "Ocorrências de Energia", subtitulo: sub, numero, corpo, interno, hoje }), analise: a, numero };
}

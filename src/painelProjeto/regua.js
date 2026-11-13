// Painel do projeto — régua da nota (Marcio, 12/11/2026). Motor PURO: sem banco, sem relógio, sem React.
// Recebe os números já resumidos do projeto (ver dados.js) e devolve a nota 0–100 explicada item por item.
// CommonJS de propósito: na Fase 3 o servidor calcula a mesma nota com este mesmo arquivo.
//
// Regras gerais (iguais ao OLAM):
//  • Sem dado      → o item vale METADE dos pontos ("nota neutra") e é avisado na tela.
//  • Não se aplica → o item sai da conta e o peso dele é redistribuído entre os outros.
//  • Travas        → limitam a faixa em "Alerta", independentemente da soma.
// Nada aqui usa dado pessoal: só contagens, funções e percentuais.

const PESOS = { equipamentos: 25, rotina: 20, pendencias: 15, equipe: 15, sistemas: 10, capacitacao: 10, ocorrencias: 5 };
const NOMES = { equipamentos: "Equipamentos de segurança funcionando", rotina: "Rotina cumprida (30 dias)", pendencias: "Pendências e tratativa", equipe: "Equipe completa e estável",
  sistemas: "Sistemas críticos no ar", capacitacao: "Capacitação", ocorrencias: "Ocorrências e sinistros" };
const ORDEM = ["equipamentos", "rotina", "pendencias", "equipe", "sistemas", "capacitacao", "ocorrencias"];
// Faixas da régua Moked do SIS+ (já em uso): 92+ Bom · 80–91 Alerta · abaixo de 80 Crítico.
const FAIXAS = { bom: 92, alerta: 80 };
const CFG = {
  mapaPontos: 10, rondaPontos: 10, rondaAtraso: 0.5,                 // ronda atrasada vale meia ronda
  pendSemTratativa: 1, pendComTratativa: 0.5, pendIdade: [[30, 3], [15, 2], [7, 1.5]], pendLimitePct: 0.15, pendLimiteMin: 5,
  equipeEfetivo: 8, equipeFaltas: 4, equipeTurnover: 3, faltasZero: 0.5, turnoverBom: 10, turnoverRuim: 40,
  ctmkDia: 2, ctmkMax: 20, keyCada: 5, keyMax: 15, zonaCada: 2, zonaMax: 10,   // penalidades da Visão 360, escaladas
  energiaCada: 0.5, energiaMax: 2, ambCada: 0.5, ambGrave: 0.5, ambMax: 2, sinistro: 3, ocorrenciasMax: 5,
  travaTesteDias: 10, travaCtmkDias: 3, travaCobertura: 0.6,
};

const lim01 = (v) => Math.max(0, Math.min(1, v));
const n = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const min1 = (t) => (/^[A-Z]{2}/.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1)); // "CTMK" fica; "Falhas" vira "falhas"
const pl = (q, s, p = s + "s") => `${q} ${q === 1 ? s : p}`;
const neutro = (frase, acao) => ({ estado: "neutro", fracao: 0.5, frase, perdas: [], acao });
const naoAplica = (frase) => ({ estado: "na", fracao: 0, frase, perdas: [], acao: null });

// 1 — Equipamentos: % de itens operantes no último teste semanal (régua Moked: parcial não conta).
function itemEquipamentos(d) {
  const t = d.teste;
  if (!t || !n(t.total)) return neutro("Sem teste semanal registrado — nota neutra.", "Fazer o teste semanal para o item deixar a nota neutra.");
  const ruins = n(t.inop) + n(t.parcial), ok = t.total - ruins;
  return { estado: "ok", fracao: lim01(ok / t.total),
    frase: ruins ? `${ok} de ${pl(t.total, "item", "itens")} operantes — ${pl(n(t.inop), "inoperante")}${t.parcial ? ` e ${pl(t.parcial, "parcial", "parciais")}` : ""}.` : `Todos os ${t.total} itens operantes no último teste.`,
    perdas: (t.ruins || []).map((x) => ({ texto: `${x.cat} — ${x.item}`, detalhe: x.status === "partial" ? "parcial" : "inoperante" })),
    acao: ruins ? `Recuperar ${pl(ruins, "item", "itens")} que não ${ruins === 1 ? "está operante" : "estão operantes"} no último teste.` : null };
}

// 2 — Rotina: mapa diário enviado + ronda virtual executada contra a grade. Sem ronda virtual no projeto, tudo vai para o mapa.
function itemRotina(d) {
  const m = d.mapa, r = d.ronda || {};
  const temMapa = m && n(m.esperados) > 0, rondaAplica = !!r.aplica, temRonda = rondaAplica && n(r.slots) > 0;
  if (!temMapa && !temRonda) return neutro("Sem mapa diário nem ronda virtual no período — nota neutra.", "Enviar o mapa de equipe de cada plantão.");
  const fMapa = temMapa ? lim01(m.enviados / m.esperados) : 0.5;
  const fRonda = temRonda ? lim01((n(r.executados) - CFG.rondaAtraso * n(r.atrasados)) / r.slots) : 0.5;
  const pMapa = rondaAplica ? CFG.mapaPontos : CFG.mapaPontos + CFG.rondaPontos, pRonda = rondaAplica ? CFG.rondaPontos : 0;
  const partes = [], perdas = [];
  if (temMapa) { partes.push(`${m.enviados} de ${m.esperados} mapas enviados`); if (m.enviados < m.esperados) perdas.push({ texto: "Mapas de equipe não enviados", detalhe: String(m.esperados - m.enviados) }); }
  else partes.push("sem mapa diário no período");
  if (temRonda) { partes.push(`ronda virtual: ${pl(n(r.naoExec), "não executada", "não executadas")} e ${pl(n(r.atrasados), "atrasada")} em ${r.slots}`);
    if (n(r.naoExec)) perdas.push({ texto: "Rondas virtuais não executadas", detalhe: String(r.naoExec) }); if (n(r.atrasados)) perdas.push({ texto: "Rondas virtuais com atraso", detalhe: String(r.atrasados) }); }
  else if (rondaAplica) partes.push("ronda virtual sem registro no período");
  const fracao = (pMapa * fMapa + pRonda * fRonda) / (pMapa + pRonda);
  return { estado: "ok", fracao, frase: partes.join("; ") + ".", perdas,
    acao: fracao >= 0.995 ? null : n(r.atrasados) + n(r.naoExec) > (temMapa ? m.esperados - m.enviados : 0) ? "Fazer a ronda virtual no horário da grade." : "Enviar o mapa de equipe de todos os plantões." };
}

// 3 — Pendências: os itens ruins do último teste, pesados pela idade e por ter ou não tratativa.
function itemPendencias(d) {
  const p = d.pendencias;
  if (!p || !n(p.totalItens)) return neutro("Sem teste semanal para listar pendências — nota neutra.", "Fazer o teste semanal.");
  const lista = p.lista || [];
  if (!lista.length) return { estado: "ok", fracao: 1, frase: "Nenhuma pendência aberta.", perdas: [], acao: null };
  let carga = 0, sem = 0, velhas = 0;
  const perdas = lista.map((x) => { const dias = n(x.semanas) * 7; const mult = (CFG.pendIdade.find(([lim]) => dias > lim) || [0, 1])[1];
    carga += (x.tratativa ? CFG.pendComTratativa : CFG.pendSemTratativa) * mult; if (!x.tratativa) sem++; if (dias > 30) velhas++;
    return { texto: `${x.cat} — ${x.item}`, detalhe: `${n(x.semanas) <= 1 ? "desde o último teste" : `há ${x.semanas} testes seguidos`} · ${x.tratativa ? "com tratativa" : "sem tratativa"}` }; });
  const limite = Math.max(CFG.pendLimiteMin, p.totalItens * CFG.pendLimitePct);
  return { estado: "ok", fracao: lim01(1 - carga / limite),
    frase: `${pl(lista.length, "pendência")} — ${sem} sem tratativa${velhas ? `, ${velhas} há mais de 30 dias` : ""}.`, perdas,
    acao: sem ? `Registrar tratativa para ${pl(sem, "pendência")} sem acompanhamento.` : "Concluir as pendências mais antigas." };
}

// 4 — Equipe: efetivo contra o previsto, faltas do mês e turnover de 12 meses.
function itemEquipe(d) {
  const e = d.equipe;
  if (!e || (!n(e.ativos) && !n(e.previsto))) return neutro("Sem equipe cadastrada — nota neutra.", "Cadastrar a equipe do projeto.");
  const fEfetivo = n(e.previsto) > 0 ? lim01(n(e.ativos) / e.previsto) : 0.5;
  const fFaltas = n(e.ativos) > 0 ? lim01(1 - n(e.faltas30) / e.ativos / CFG.faltasZero) : 0.5;
  const fTurn = typeof e.turnover === "number" ? lim01(1 - (e.turnover - CFG.turnoverBom) / (CFG.turnoverRuim - CFG.turnoverBom)) : 0.5;
  const partes = [n(e.previsto) > 0 ? `${n(e.ativos)} de ${e.previsto} postos ocupados` : `${pl(n(e.ativos), "ativo")} (quadro previsto não definido)`, `${pl(n(e.faltas30), "falta")} em 30 dias`,
    typeof e.turnover === "number" ? `turnover de ${Math.round(e.turnover)}% em 12 meses` : "turnover ainda não aferido"];
  const perdas = [];
  if (n(e.previsto) > n(e.ativos)) perdas.push({ texto: "Postos sem ocupante", detalhe: String(e.previsto - n(e.ativos)) });
  if (n(e.faltas30)) perdas.push({ texto: "Faltas nos últimos 30 dias", detalhe: String(e.faltas30) });
  if (typeof e.turnover === "number" && e.turnover > CFG.turnoverBom) perdas.push({ texto: "Turnover em 12 meses", detalhe: `${Math.round(e.turnover)}%` });
  const fracao = (CFG.equipeEfetivo * fEfetivo + CFG.equipeFaltas * fFaltas + CFG.equipeTurnover * fTurn) / (CFG.equipeEfetivo + CFG.equipeFaltas + CFG.equipeTurnover);
  return { estado: "ok", fracao, frase: partes.join("; ") + ".", perdas,
    acao: fracao >= 0.995 ? null : n(e.previsto) > n(e.ativos) ? `Repor ${pl(e.previsto - n(e.ativos), "posto")} em aberto.` : n(e.faltas30) ? "Reduzir as faltas do mês." : "Acompanhar a rotatividade da equipe." };
}

// 5 — Sistemas críticos: parte das penalidades da Visão 360 (CTMK, KeyAccess, perímetro), escaladas para os pontos do item.
function itemSistemas(d) {
  const s = d.sistemas || {}, c = s.ctmk || {}, k = s.key || {}, z = s.perimetro || {};
  const max = (c.aplica ? CFG.ctmkMax : 0) + (k.aplica ? CFG.keyMax : 0) + (z.aplica ? CFG.zonaMax : 0);
  if (!max) return naoAplica("Não se aplica a este projeto.");
  const pc = c.aplica ? Math.min(CFG.ctmkMax, n(c.diasOff) * CFG.ctmkDia) : 0, pk = k.aplica ? Math.min(CFG.keyMax, n(k.abertas) * CFG.keyCada) : 0, pz = z.aplica ? Math.min(CFG.zonaMax, n(z.zonasRuins) * CFG.zonaCada) : 0;
  const perdas = [];
  if (pc) perdas.push({ texto: "CTMK fora do ar", detalhe: pl(c.diasOff, "dia") });
  if (pk) perdas.push({ texto: "Falhas de KeyAccess em aberto", detalhe: String(k.abertas) });
  if (pz) perdas.push({ texto: "Zonas do perímetro com problema", detalhe: String(z.zonasRuins) });
  const sem = [c.aplica ? null : "CTMK", k.aplica ? null : "KeyAccess", z.aplica ? null : "perímetro"].filter(Boolean);
  return { estado: "ok", fracao: lim01(1 - (pc + pk + pz) / max),
    frase: (perdas.length ? perdas.map((x, i) => `${i ? min1(x.texto) : x.texto} (${x.detalhe})`).join("; ") : "CTMK, KeyAccess e perímetro sem pendência") + "." + (sem.length ? ` Não se aplica: ${sem.join(", ")}.` : ""),
    perdas, acao: pc ? "Restabelecer o CTMK." : pk ? "Encerrar as falhas de KeyAccess em aberto." : pz ? "Corrigir as zonas do perímetro com problema." : null };
}

// 6 — Capacitação: % da equipe com treinamento aplicado ou reciclagem em dia.
function itemCapacitacao(d) {
  const c = d.capacitacao;
  if (!c || !n(c.ativos)) return neutro("Sem equipe cadastrada para medir capacitação — nota neutra.", "Cadastrar a equipe e os treinamentos.");
  const fora = c.ativos - n(c.emDia);
  return { estado: "ok", fracao: lim01(n(c.emDia) / c.ativos), frase: `${n(c.emDia)} de ${c.ativos} em dia com treinamento ou reciclagem.`,
    perdas: fora > 0 ? [{ texto: "Sem treinamento nem reciclagem em dia", detalhe: String(fora) }] : [], acao: fora > 0 ? `Aplicar treinamento ou reciclagem para ${pl(fora, "colaborador", "colaboradores")}.` : null };
}

// 7 — Ocorrências: energia, ambulância e sinistro. Módulo que o projeto nunca usou não prova que "nada aconteceu".
function itemOcorrencias(d) {
  const e = d.eventos || {}, en = e.energia || {}, am = e.ambulancia || {}, si = e.sinistro || {};
  if (!en.usa && !am.usa && !si.registrado) return neutro("Sem registro de ocorrências neste projeto — nota neutra.", "Registrar quedas de energia e atendimentos quando ocorrerem.");
  const pe = en.usa ? Math.min(CFG.energiaMax, n(en.n30) * CFG.energiaCada) : 0, pa = am.usa ? Math.min(CFG.ambMax, n(am.n30) * CFG.ambCada + n(am.graves30) * CFG.ambGrave) : 0, ps = si.em30 ? CFG.sinistro : 0;
  const perdas = [];
  if (pe) perdas.push({ texto: "Quedas de energia em 30 dias", detalhe: String(en.n30) });
  if (pa) perdas.push({ texto: "Atendimentos de ambulância em 30 dias", detalhe: `${am.n30}${n(am.graves30) ? ` (${pl(am.graves30, "grave")})` : ""}` });
  if (ps) perdas.push({ texto: "Sinistro nos últimos 30 dias", detalhe: "1" });
  return { estado: "ok", fracao: lim01(1 - Math.min(CFG.ocorrenciasMax, pe + pa + ps) / CFG.ocorrenciasMax),
    frase: perdas.length ? perdas.map((x, i) => `${i ? min1(x.texto) : x.texto}: ${x.detalhe}`).join("; ") + "." : "Sem evento nos últimos 30 dias.", perdas,
    acao: perdas.length ? "Tratar a causa das ocorrências do mês." : null };
}

const CALC = { equipamentos: itemEquipamentos, rotina: itemRotina, pendencias: itemPendencias, equipe: itemEquipe, sistemas: itemSistemas, capacitacao: itemCapacitacao, ocorrencias: itemOcorrencias };

function travasDe(d, cobertura) {
  const t = [], s = d.sistemas || {};
  if (d.teste && typeof d.teste.diasAtras === "number" && d.teste.diasAtras > CFG.travaTesteDias) t.push({ id: "teste", texto: `Teste semanal há ${d.teste.diasAtras} dias (limite: ${CFG.travaTesteDias}).` });
  if (s.ctmk && s.ctmk.aplica && n(s.ctmk.diasOff) > CFG.travaCtmkDias) t.push({ id: "ctmk", texto: `CTMK fora do ar há ${s.ctmk.diasOff} dias (limite: ${CFG.travaCtmkDias}).` });
  if (s.perimetro && s.perimetro.aplica && n(s.perimetro.zonasRuins) > 0) t.push({ id: "perimetro", texto: `${pl(s.perimetro.zonasRuins, "zona")} do perímetro com problema no último teste.` });
  if (d.eventos && d.eventos.sinistro && d.eventos.sinistro.em30) t.push({ id: "sinistro", texto: "Sinistro registrado nos últimos 30 dias." });
  if (cobertura < CFG.travaCobertura) t.push({ id: "cobertura", texto: `Nota calculada com ${Math.round(cobertura * 100)}% dos dados — muitos itens sem registro.` });
  return t;
}

function faixaDe(nota, travado) {
  if (typeof nota !== "number") return "Sem dado";
  const f = nota >= FAIXAS.bom ? "Bom" : nota >= FAIXAS.alerta ? "Alerta" : "Crítico";
  return travado && f === "Bom" ? "Alerta" : f;
}

// Nota completa. `d` vem de dados.js (ou do exemplo do modo demo).
function calcularPainel(d) {
  const brutos = ORDEM.map((id) => { let r; try { r = CALC[id](d || {}); } catch (e) { r = neutro("Não foi possível calcular este item — nota neutra.", null); } return { id, nome: NOMES[id], peso: PESOS[id], ...r }; });
  const pesoAplicavel = brutos.filter((i) => i.estado !== "na").reduce((s, i) => s + i.peso, 0);
  const itens = brutos.map((i) => {
    if (i.estado === "na" || !pesoAplicavel) return { ...i, possivel: 0, pontos: 0 };
    const possivel = (i.peso * 100) / pesoAplicavel;
    return { ...i, possivel: Math.round(possivel * 10) / 10, pontos: Math.round(possivel * i.fracao * 10) / 10 };
  });
  const nota = pesoAplicavel ? Math.round(itens.reduce((s, i) => s + i.pontos, 0)) : null;
  const pesoNeutro = itens.filter((i) => i.estado === "neutro").reduce((s, i) => s + i.possivel, 0);
  const cobertura = pesoAplicavel ? 1 - pesoNeutro / 100 : 0;
  const travas = nota === null ? [] : travasDe(d || {}, cobertura);
  const semTrava = faixaDe(nota, false), faixa = faixaDe(nota, travas.length > 0);
  const acoes = itens.filter((i) => i.estado !== "na" && i.acao && i.possivel - i.pontos >= 0.5).sort((a, b) => b.possivel - b.pontos - (a.possivel - a.pontos)).slice(0, 3)
    .map((i) => ({ id: i.id, nome: i.nome, perdidos: Math.round((i.possivel - i.pontos) * 10) / 10, acao: i.acao }));
  return { nota, faixa, travaAplicada: faixa !== semTrava, travas, cobertura: Math.round(cobertura * 100), itens, acoes, redistribuido: pesoAplicavel !== 100, intervalos: (d && d.intervalos) || null };
}

module.exports = { calcularPainel, faixaDe, PESOS, NOMES, ORDEM, FAIXAS, CFG };

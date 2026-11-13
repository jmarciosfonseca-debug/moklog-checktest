// SIS+ — Sistema Integrado de Segurança (Marcio, 09–10/11/2026). Motor puro: sem banco, sem relógio global.
// Nota geral 0–100 = média ponderada de 3 pilares — RT (Recursos Técnicos), RH (Recursos Humanos) e
// RA (Recursos Administrativos) —, cada pilar = média ponderada dos seus indicadores.
// Duas réguas: a do CLIENTE (Área do Cliente) e a régua MOKED (gestor), mais rígida — "um passo à frente":
//  • parcial vale 0,5 para o cliente e 0 para a Moked;
//  • faixas: cliente ≥85 Bom · 70–84 Atenção · <70 Crítico | Moked ≥92 Bom · 80–91 Alerta · <80 Crítico.
// Indicador "a definir" (satisfação, salário, benefícios, MNP/POP) aparece zerado e NÃO entra na conta
// até a Moked definir a régua dele (peso: null). Quando definir, basta dar peso e a função de cálculo.

import { kmOficial } from "../equipe/enderecoColab";

export const PILARES = {
  RT: { sigla: "RT", nome: "Recursos Técnicos", peso: 0.45 },
  RH: { sigla: "RH", nome: "Recursos Humanos", peso: 0.35 },
  RA: { sigla: "RA", nome: "Recursos Administrativos", peso: 0.20 },
};
export const ORDEM_PILARES = ["RT", "RH", "RA"];

export const REGUAS = {
  cliente: { id: "cliente", nome: "Régua do cliente", bom: 85, meio: 70, rotulos: ["Bom", "Atenção", "Crítico"], cores: ["#22c55e", "#f59e0b", "#ef4444"], parcial: 0.5 },
  moked: { id: "moked", nome: "Régua Moked", bom: 92, meio: 80, rotulos: ["Bom", "Alerta", "Crítico"], cores: ["#22c55e", "#f97316", "#ef4444"], parcial: 0 },
};
export const CINZA_SIS = "#6b7280";
export function faixa(v, regua = REGUAS.cliente) {
  if (typeof v !== "number") return { rotulo: "Sem dado", cor: CINZA_SIS };
  const i = v >= regua.bom ? 0 : v >= regua.meio ? 1 : 2;
  return { rotulo: regua.rotulos[i], cor: regua.cores[i] };
}

const lim = (v) => Math.max(0, Math.min(100, Math.round(v)));
const pct = (n, d) => (d > 0 ? (n / d) * 100 : null);
const sem = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const plural = (n, s, p = s + "s") => `${n} ${n === 1 ? s : p}`;

// ── Categorias do teste semanal → indicadores técnicos (pelo rótulo do checklist de cada projeto) ──
// Ordem importa: o primeiro que casar leva a categoria.
const MAPA_CATEGORIAS = [
  ["ignorar", /VISITA DE MANUTENCAO|OBS\.?$|INFRAESTRUTURA \/ OBS|MATERIAIS OPERACIONAIS/],
  ["panico", /PANICO/],
  ["incendio", /INCENDIO|SDAI/],
  ["perimetro", /PERIMETR|CERCA|PARADOX|SIRENE|DILACERADOR|GARRA DE TIGRE/],
  ["cco", /MONITOR|JOYSTICK|MESA|COMPUTADOR|TELEVISOR|SALA DE CFTV|TELAS?\b/],
  ["cftv", /CFTV|CAMERA|IMAGENS/],
  ["energia", /NOBREAK|GERADOR|ENERGIA/],
  ["iluminacao", /ILUMINA|REFLETOR|POSTE/],
  ["comunicacao", /INTERNET|TELEFON|INTERFON|INTERCOMUN|RADIO|ALERTAS EXTERNOS|VIDEO PORTEIRO|CAMPAINHA/],
  ["acesso", /TORNIQUETE|CANCELA|ECLUSA|LEITOR|QR|FACIA|PORT[AO]|PORTOES|TOTE[MN]|BOLLARD|PINOS|SEMAFORO|PICTOGRAMA|GIROFLEX|ELETROIMA|KEYACCESS|TABLET|ANTI-ESMAGAMENTO|FAROIS|BALANCA|GUARITA|RECEPCAO|PORTARIA|COFRE/],
];
export function grupoDaCategoria(cat) {
  if (cat && cat.id === "cftv") return "cftv";
  if (cat && cat.grupo) return cat.grupo; // inventário das divisões novas já vem classificado pela seção da planilha
  const l = sem(cat && cat.label).replace(/^\d+\s*-\s*/, "");
  for (const [g, re] of MAPA_CATEGORIAS) if (re.test(l)) return g;
  return "infra";
}

// Contagem por grupo no último teste: total, inoperantes e parciais (mesma leitura do computeHealth do app).
function statusDe(o) {
  if (!o || typeof o !== "object") return "ok";
  const r = String(o.status ?? "").trim().toLowerCase();
  if (r === "ok" || r === "partial" || r === "inop") return r;
  return o.ok === false ? "inop" : "ok";
}
export function categoriasDoTeste(project, state) {
  const out = {};
  if (!state || typeof state !== "object") return out;
  for (const cat of project?.categories || []) {
    const s = state[cat.id]; if (!s) continue;
    const g = grupoDaCategoria(cat); if (g === "ignorar") continue;
    const o = out[g] || (out[g] = { total: 0, inop: 0, partial: 0, itens: [] });
    if (cat.type === "single") { const st = statusDe(s); o.total++; if (st === "inop") o.inop++; if (st === "partial") o.partial++; if (st !== "ok") o.itens.push({ cat: cat.label, item: "—", status: st, note: s.note || "" }); }
    else if (cat.type === "items") (Array.isArray(s) ? s : []).forEach((v, i) => { const st = statusDe(v); o.total++; if (st === "inop") o.inop++; if (st === "partial") o.partial++; if (st !== "ok") o.itens.push({ cat: cat.label, item: cat.itemLabels?.[i] || "—", status: st, note: v?.note || "" }); });
    else if (cat.type === "count") { const t = Number(s.total ?? cat.total ?? 0) || 0; const inop = Array.isArray(s.inoperative) ? s.inoperative : []; o.total += t; o.inop += inop.length; inop.forEach((it) => o.itens.push({ cat: cat.label, item: it?.id || "?", status: "inop", note: it?.note || "" })); }
  }
  return out;
}

// Chave da tratativa igual à do app (followups.js → canonicalFollowupKey).
export const chaveFu = (cat, item) => { const n = (v) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, ""); return `${n(cat)}__${n(item)}`; };

// ── Base do SIS por projeto: o que não está pronto em p (categorias, distância, maturidade, tratativas, mapas) ──
export function baseSIS({ project, state, equipeDoc, mapas, followups, maturidade, hojeISO, agoraMs = Date.now() }) {
  const categorias = categoriasDoTeste(project, state);
  // Distância casa → projeto (rota de carro, quando calculada)
  const ativos = (equipeDoc?.colaboradores || []).filter((c) => c && (c.status || "ativo") === "ativo");
  const kms = ativos.map(kmOficial).filter((k) => typeof k === "number");
  const distancia = { comEndereco: kms.length, ativos: ativos.length, media: kms.length ? kms.reduce((a, b) => a + b, 0) / kms.length : null, ate15: kms.filter((k) => k <= 15).length, ate25: kms.filter((k) => k <= 25).length, acima25: kms.filter((k) => k > 25).length };
  // Tratativas das pendências do último teste (follow-ups da gestão)
  const pend = Object.values(categorias).flatMap((g) => g.itens);
  let comTratativa = 0, recentes = 0;
  pend.forEach((x) => { const r = followups?.[chaveFu(x.cat, x.item)]; if (r && Array.isArray(r.entries) && r.entries.length) { comTratativa++; const t = Date.parse(r.entries[0].em); if (Number.isFinite(t) && agoraMs - t <= 7 * 86400000) recentes++; } });
  const tratativas = { pendencias: pend.length, comTratativa, recentes };
  // Mapa diário: plantões enviados nos últimos 7 dias
  const hoje = new Date(hojeISO + "T12:00:00Z"), ini = new Date(hoje); ini.setUTCDate(ini.getUTCDate() - 6); const iniISO = ini.toISOString().slice(0, 10);
  const lista = (mapas || []).filter((m) => m && m.data && m.data >= iniISO && m.data <= hojeISO);
  const enviados = lista.filter((m) => m.status === "enviado");
  const temNoturno = (mapas || []).some((m) => m && m.turno === "N");
  const dias = new Set(enviados.map((m) => m.data)).size;
  const turnos = new Set(enviados.map((m) => `${m.data}|${m.turno || "D"}`)).size;
  const mapa = { temHistorico: (mapas || []).some((m) => m && m.status === "enviado"), dias, turnos, turnosEsperados: 7 * (temNoturno ? 2 : 1) };
  const mat = maturidade ? { indice: typeof maturidade.indice === "number" ? Math.round(maturidade.indice) : null, classe: maturidade.classe || "", assiduidade: typeof maturidade.eixos?.assiduidade === "number" ? Math.round(maturidade.eixos.assiduidade) : null, reciclagem: typeof maturidade.eixos?.reciclagem === "number" ? Math.round(maturidade.eixos.reciclagem) : null } : null;
  return { categorias, distancia, tratativas, mapa, maturidade: mat };
}

// ── Indicadores ──────────────────────────────────────────────────────────────
// calc(p, r) → { valor: 0–100 | null, texto }. r = régua (r.id "moked" é a rígida). null = sem dado (não conta).
const porCategoria = (grupo, nome) => (p, r) => {
  const g = p.sisBase?.categorias?.[grupo];
  if (!g || !g.total) return { valor: null, texto: `Sem ${nome} no checklist do teste semanal.` };
  const ok = g.total - g.inop - g.partial;
  const v = pct(ok + g.partial * r.parcial, g.total);
  const partes = [`${g.total} ${g.total === 1 ? "item" : "itens"} testados`, g.inop ? `${g.inop} inoperante${g.inop === 1 ? "" : "s"}` : "", g.partial ? `${g.partial} parcia${g.partial === 1 ? "l" : "is"}` : ""].filter(Boolean);
  return { valor: lim(v), texto: partes.join(" · ") + (g.inop || g.partial ? "" : " · todos operantes") };
};

export const INDICADORES = [
  // RT — Recursos Técnicos
  { id: "cftv", pilar: "RT", nome: "CFTV", peso: 2, origem: "app", abrir: "teste", calc: porCategoria("cftv", "câmeras") },
  { id: "gravacao", pilar: "RT", nome: "Tempo de gravação", peso: 1, origem: "app", abrir: "teste", calc: (p, r) => {
    const g = p.teste?.gravacao;
    if (!g) return { valor: null, texto: "Projeto sem CFTV no teste semanal." };
    if (g.pct === null) return { valor: null, texto: "Não informado no último teste semanal." };
    return { valor: lim(100 - g.pct * (r.id === "moked" ? 2 : 1)), texto: g.pct === 0 ? `Todas as ${g.total} câmeras com 30 dias ou mais de gravação.` : `Até ${g.pct}% das câmeras (≈ ${g.cameras} de ${g.total}) com menos de 30 dias de gravação.${g.obs ? ` ${g.obs}` : ""}` };
  } },
  { id: "acesso", pilar: "RT", nome: "Controle de acesso", peso: 2, origem: "app", abrir: "teste", calc: porCategoria("acesso", "controle de acesso") },
  { id: "perimetro", pilar: "RT", nome: "Perímetro", peso: 2, origem: "app", abrir: "teste", calc: (p, r) => {
    const base = porCategoria("perimetro", "perímetro")(p, r); const z = p.sistemas?.perimetralZonasRuins || 0;
    if (base.valor === null && !z) return base;
    const v = (base.valor === null ? 100 : base.valor) - z * (r.id === "moked" ? 10 : 5);
    return { valor: lim(v), texto: [base.valor === null ? "" : base.texto, z ? `${plural(z, "zona")} da perimetral com falha recorrente` : ""].filter(Boolean).join(" · ") };
  } },
  { id: "panico", pilar: "RT", nome: "Botões de pânico", peso: 1, origem: "app", abrir: "teste", calc: porCategoria("panico", "botões de pânico") },
  { id: "incendio", pilar: "RT", nome: "Alarme de incêndio", peso: 1, origem: "app", abrir: "teste", calc: porCategoria("incendio", "alarme de incêndio") },
  { id: "cco", pilar: "RT", nome: "Central CCO", peso: 1, origem: "app", abrir: "teste", calc: porCategoria("cco", "equipamentos de CCO") },
  { id: "comunicacao", pilar: "RT", nome: "Comunicação", peso: 1, origem: "app", abrir: "teste", calc: porCategoria("comunicacao", "comunicação (internet, telefones, interfones)") },
  { id: "energia", pilar: "RT", nome: "Energia", peso: 1, origem: "app", abrir: "sistemas", calc: (p, r) => {
    const base = porCategoria("energia", "nobreak/gerador")(p, r); const s = p.sistemas || {};
    const pen = (s.energiaAberta ? (r.id === "moked" ? 30 : 15) : 0) + (r.id === "moked" ? (s.quedas7d || 0) * 5 : 0);
    if (base.valor === null && !s.energiaAberta && !s.quedas7d) return base;
    return { valor: lim((base.valor === null ? 100 : base.valor) - pen), texto: [base.valor === null ? "" : base.texto, s.energiaAberta ? "ocorrência de energia em aberto" : "", s.quedas7d ? `${plural(s.quedas7d, "queda")} em 7 dias` : ""].filter(Boolean).join(" · ") };
  } },
  { id: "iluminacao", pilar: "RT", nome: "Iluminação", peso: 1, origem: "app", abrir: "sistemas", calc: (p, r) => {
    const s = p.sistemas || {};
    if (s.ilumTotal) { const ok = s.ilumTotal - s.ilumDef; return { valor: lim(pct(r.id === "moked" && s.ilumDef ? ok - s.ilumDef * 0.5 : ok, s.ilumTotal)), texto: s.ilumDef ? `${s.ilumDef} de ${s.ilumTotal} pontos com deficiência` : `${s.ilumTotal} pontos sem deficiência` }; }
    return porCategoria("iluminacao", "iluminação")(p, r);
  } },
  { id: "infra", pilar: "RT", nome: "Demais equipamentos", peso: 1, origem: "app", abrir: "teste", calc: porCategoria("infra", "outros equipamentos") },
  // RH — Recursos Humanos
  { id: "turnover", pilar: "RH", nome: "Turnover (12 meses)", peso: 2, origem: "app", abrir: "turnover", calc: (p, r) => {
    const t = p.equipe?.turnover;
    if (typeof t !== "number") return { valor: null, texto: `Turnover não aferido${p.equipe?.turnoverMotivo ? ` (${p.equipe.turnoverMotivo})` : ""}.` };
    return { valor: lim(100 - t * (r.id === "moked" ? 3 : 2)), texto: `${t.toLocaleString("pt-BR")}% em 12 meses · ${plural(p.equipe.saidas12m || 0, "saída")} · ${plural(p.equipe.entradas12m || 0, "entrada")}.` };
  } },
  { id: "treino", pilar: "RH", nome: "Treinamento e reciclagem", peso: 2, origem: "app", abrir: "treino", calc: (p, r) => {
    const e = p.equipe || {};
    if (!e.ativos) return { valor: null, texto: "Sem colaboradores ativos cadastrados." };
    const v = r.id === "moked" ? pct(e.comReciclagem || 0, e.ativos) : e.treinadosPct;
    return { valor: v === null ? null : lim(v), texto: `${e.comReciclagem || 0} de ${e.ativos} com reciclagem em dia · ${e.comTreinoFicha || 0} com treinamento na ficha.` };
  } },
  { id: "assiduidade", pilar: "RH", nome: "Assiduidade", peso: 1, origem: "app", abrir: "plantao", calc: (p) => {
    const a = p.sisBase?.maturidade?.assiduidade;
    return a === null || a === undefined ? { valor: null, texto: "Não aferida (histórico de faltas com menos de 90 dias)." } : { valor: lim(a), texto: "Faltas e atrasos lançados nas fichas nos últimos 12 meses." };
  } },
  { id: "maturidade", pilar: "RH", nome: "Maturidade da equipe", peso: 1, origem: "app", abrir: "plantao", calc: (p) => {
    const m = p.sisBase?.maturidade;
    return !m || m.indice === null ? { valor: null, texto: "Índice de maturidade não aferido." } : { valor: lim(m.indice), texto: `Índice ${m.indice}/100${m.classe ? ` · ${m.classe}` : ""} — assiduidade, treinamentos, reciclagem e tempo de casa.` };
  } },
  { id: "distancia", pilar: "RH", nome: "Distância casa–projeto", peso: 1, origem: "app", abrir: "plantao", calc: (p, r) => {
    const d = p.sisBase?.distancia;
    if (!d || !d.comEndereco) return { valor: null, texto: "Endereços dos colaboradores ainda não cadastrados." };
    const v = pct(r.id === "moked" ? d.ate15 : d.ate25, d.comEndereco);
    return { valor: lim(v), texto: `Média de ${d.media.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km de carro (${d.comEndereco} de ${d.ativos} com endereço) · ${plural(d.acima25, "colaborador", "colaboradores")} acima de 25 km.` };
  } },
  { id: "satisfacao", pilar: "RH", nome: "Satisfação da equipe", peso: null, origem: "novo", calc: () => ({ valor: null, texto: "Régua a definir pela Moked (pesquisa de satisfação)." }) },
  { id: "salario", pilar: "RH", nome: "Padrão salarial", peso: null, origem: "novo", calc: () => ({ valor: null, texto: "Régua a definir pela Moked (piso da convenção × praticado)." }) },
  { id: "beneficios", pilar: "RH", nome: "Benefícios", peso: null, origem: "novo", calc: () => ({ valor: null, texto: "Régua a definir pela Moked (VR, VT, plano de saúde…)." }) },
  // RA — Recursos Administrativos
  { id: "teste", pilar: "RA", nome: "Teste semanal em dia", peso: 2, origem: "app", abrir: "teste", calc: (p, r) => {
    const t = p.teste || {};
    if (!t.data) return { valor: 0, texto: "Nenhum teste semanal registrado." };
    const d = t.diasAtras ?? 99;
    const v = r.id === "moked" ? (d <= 7 ? 100 : d <= 8 ? 80 : d <= 14 ? 50 : 0) : (d <= 8 ? 100 : d <= 14 ? 70 : 40);
    return { valor: v, texto: `Último teste há ${plural(d, "dia")}.` };
  } },
  { id: "tratativas", pilar: "RA", nome: "Tratativas e follow-ups", peso: 2, origem: "app", abrir: "teste", calc: (p, r) => {
    const t = p.sisBase?.tratativas;
    if (!t) return { valor: null, texto: "Sem leitura das tratativas." };
    if (!t.pendencias) return { valor: 100, texto: "Nenhuma pendência no último teste semanal." };
    const n = r.id === "moked" ? t.recentes : t.comTratativa;
    return { valor: lim(pct(n, t.pendencias)), texto: `${plural(t.pendencias, "pendência")} · ${t.comTratativa} com tratativa registrada${r.id === "moked" ? ` · ${t.recentes} atualizada${t.recentes === 1 ? "" : "s"} nos últimos 7 dias` : ""}.` };
  } },
  { id: "mapa", pilar: "RA", nome: "Mapa diário enviado", peso: 1, origem: "app", abrir: "plantao", calc: (p, r) => {
    const m = p.sisBase?.mapa;
    if (!m || !m.temHistorico) return { valor: null, texto: "Mapa diário ainda não usado neste projeto." };
    const v = r.id === "moked" ? pct(m.turnos, m.turnosEsperados) : pct(m.dias, 7);
    return { valor: lim(v), texto: `${m.dias} de 7 dias com mapa enviado · ${m.turnos} de ${m.turnosEsperados} plantões.` };
  } },
  { id: "ctmk", pilar: "RA", nome: "CTMK / KeyAccess", peso: 1, origem: "app", abrir: "sistemas", calc: (p, r) => {
    const s = p.sistemas || {};
    if (!s.temCtmk && !s.temKey) return { valor: null, texto: "Projeto sem CTMK/KeyAccess monitorado." };
    const v = 100 - (s.ctmkOff ? (r.id === "moked" ? 100 : 50) : 0) - (s.keyAbertas || 0) * (r.id === "moked" ? 15 : 10);
    return { valor: lim(v), texto: [s.temCtmk ? (s.ctmkOff ? `CTMK off-line há ${plural(s.ctmkDias || 0, "dia")}` : "CTMK on-line") : "", s.temKey ? (s.keyAbertas ? `${plural(s.keyAbertas, "falha")} KeyAccess em aberto` : "KeyAccess sem falha aberta") : ""].filter(Boolean).join(" · ") };
  } },
  { id: "documentos", pilar: "RA", nome: "MNP / POP vigentes", peso: null, origem: "novo", calc: () => ({ valor: null, texto: "Régua a definir pela Moked (MNP e POPs revisados)." }) },
];
export const indicador = (id) => INDICADORES.find((i) => i.id === id) || null;

// Média ponderada só do que tem valor e peso. Devolve null quando nada conta.
function mediaPonderada(itens) {
  let s = 0, w = 0;
  for (const i of itens) if (typeof i.valor === "number" && typeof i.peso === "number" && i.peso > 0) { s += i.valor * i.peso; w += i.peso; }
  return w ? Math.round(s / w) : null;
}

// Nota completa do projeto numa régua ("cliente" | "moked").
export function calcularSIS(p, reguaId = "cliente") {
  const r = REGUAS[reguaId] || REGUAS.cliente;
  const itens = INDICADORES.map((ind) => {
    let res; try { res = ind.calc(p, r) || {}; } catch { res = { valor: null, texto: "Não foi possível calcular." }; }
    const aDefinir = ind.peso === null;
    return { id: ind.id, pilar: ind.pilar, nome: ind.nome, peso: ind.peso, origem: ind.origem, abrir: ind.abrir || null, aDefinir, valor: aDefinir ? null : res.valor ?? null, exibir: aDefinir ? 0 : res.valor ?? null, texto: res.texto || "", ...faixaDoItem(aDefinir ? null : res.valor, r) };
  });
  const pilares = {};
  for (const k of ORDEM_PILARES) {
    const its = itens.filter((i) => i.pilar === k);
    const valor = mediaPonderada(its);
    pilares[k] = { ...PILARES[k], id: k, valor, itens: its, contam: its.filter((i) => typeof i.valor === "number" && i.peso).length, ...faixaDoItem(valor, r) };
  }
  let s = 0, w = 0; for (const k of ORDEM_PILARES) if (typeof pilares[k].valor === "number") { s += pilares[k].valor * PILARES[k].peso; w += PILARES[k].peso; }
  const geral = w ? Math.round(s / w) : null;
  return { regua: r, geral, ...faixaDoItem(geral, r), pilares, itens };
}
function faixaDoItem(v, r) { const f = faixa(v, r); return { faixa: f.rotulo, cor: f.cor }; }

// Favoritos por usuário (escopo do PIN) — só preferência de tela, guardada no aparelho.
export const FAVORITOS_PADRAO = ["cftv", "turnover", "acesso"];
const chaveFav = (escopo) => `sis_favs:${escopo || "anon"}`;
export function lerFavoritos(escopo) {
  try { const v = JSON.parse(window.localStorage.getItem(chaveFav(escopo)) || "null"); if (Array.isArray(v)) return v.filter((id) => indicador(id)); } catch { /* sem storage */ }
  return [...FAVORITOS_PADRAO];
}
export function gravarFavoritos(escopo, lista) {
  try { window.localStorage.setItem(chaveFav(escopo), JSON.stringify(lista)); } catch { /* sem storage: fica só na sessão */ }
}

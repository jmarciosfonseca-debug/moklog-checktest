// ─────────────────────────────────────────────────────────────
// riscoConfig.js — Motor de classificação de risco (MokLog CheckTest)
// Régua v2, fechada com Marcio em 27/07/2026.
//
// PRINCÍPIOS (invioláveis):
//  • Aditivo: este arquivo é NOVO e não altera nada existente. Só é
//    importado por AnaliseRisco.jsx para substituir `nivelPorDias`.
//  • Mapeamento por NOME-BASE do item, NUNCA por regex/prefixo numérico.
//  • Fallback de item não mapeado = Automação (peso 4) — nunca crítico
//    nem periférico por engano.
//
// FÓRMULA:
//   PVT = Peso × MultTemporal × FatorVolume/Proporção
//   → rótulo bruto por cortes de PVT
//   → REBAIXA para o TETO da classe do ativo (peso define o teto).
//
// TETO POR CLASSE:
//   Bloqueador(10) → CRÍTICO   (única classe que pode ser crítico)
//   Tático(7)      → ELEVADO   (rompe só em colapso: CFTV 30%+, etc.)
//   Automação(4)   → MODERADO
//   Iluminação(2)  → MODERADO  (fora do motor de proporção)
//   Periférico(0.5)→ BAIXO
//
// CONJUNTOS (proporção domina, tempo leve): cancela, CFTV, bollard.
//   fração inop/total é o fator principal — 1 de 5 não escala; maioria
//   fora escala. CFTV tem régua própria de % cego.
//
// PERÍMETRO (regra especial, fora da proporção):
//   • zona isolada inoperante → ELEVADO (não trava)
//   • TOTALMENTE desconfigurado E > 30 dias → CRÍTICO + TRAVA do site
//   • zona "em obra/instalação" → observação "em implantação" (fora do score)
//
// PÂNICO:
//   • móvel → peso 4 (teto MODERADO, sem trava; coberto pelo fixo)
//   • fixo  → Bloqueador 10 + trava
//
// DOIS ESCOPOS:
//   • CLIENTE → só vetores de segurança; teto ELEVADO no consolidado
//   • MOKED   → tudo (periférico, capacitação, Paradox…); chega a CRÍTICO
// ─────────────────────────────────────────────────────────────

// ── Níveis canônicos ─────────────────────────────────────────
export const NIVEL = { CRITICO: 4, ELEVADO: 3, MODERADO: 2, BAIXO: 1, SEMDADOS: 0 };
export const NIVEL_LABEL = { 4: "CRÍTICO", 3: "ELEVADO", 2: "MODERADO", 1: "BAIXO", 0: "SEM DADOS" };
export const NIVEL_ORDEM = (n) => n; // já é ordinal

// ── Classes de ativo (peso + teto) ───────────────────────────
export const CLASSE = {
  BLOQUEADOR: { nome: "Bloqueador", peso: 10, teto: NIVEL.CRITICO },
  TATICO:     { nome: "Tático",     peso: 7,  teto: NIVEL.ELEVADO },
  AUTOMACAO:  { nome: "Automação",  peso: 4,  teto: NIVEL.MODERADO },
  ILUMINACAO: { nome: "Iluminação", peso: 2,  teto: NIVEL.MODERADO },
  PERIFERICO: { nome: "Periférico", peso: 0.5, teto: NIVEL.BAIXO },
};

// ── Cortes de PVT → rótulo bruto (antes do teto) ─────────────
export const PVT_CORTES = { critico: 30, elevado: 15, moderado: 6 };

// ── Multiplicador temporal (dias em aberto) ──────────────────
export function multTemporal(dias) {
  if (dias == null) return 1.0;
  if (dias <= 9) return 1.0;
  if (dias <= 29) return 1.5;
  if (dias <= 59) return 2.5;
  if (dias <= 89) return 4.0;
  return 6.0; // 90+ teto
}

// ── Modulador temporal LEVE (para conjuntos) ─────────────────
export function multTemporalLeve(dias) {
  if (dias == null) return 1.0;
  if (dias <= 30) return 1.0;
  if (dias <= 90) return 1.15;
  return 1.3;
}

// ── Volume comprimido (itens repetidos NÃO-conjunto) ─────────
// Ex: 3 semáforos da mesma baia fora. Comprime para não estourar teto.
export function fatorVolume(n) {
  if (!n || n <= 1) return 1.0;
  return 1 + Math.sqrt(n - 1) * 0.7;
}

// ── Fator de PROPORÇÃO (itens de conjunto: cancela, bollard) ──
// A fração inop/total domina; tempo entra leve por fora.
export function fatorProporcao(inop, total) {
  if (!total || total <= 0) return 1.0;
  const f = inop / total;
  if (f <= 0.25) return 1.0;  // 1 de 5, 1 de 4 → redundância cobre
  if (f <= 0.50) return 2.5;  // metade
  if (f <= 0.75) return 4.5;  // maioria fora
  return 6.0;                 // praticamente tudo fora
}

// ── CFTV: régua própria (% circuito cego × tempo leve) ───────
export function fatorCoberturaCFTV(pctCego) {
  if (pctCego <= 5) return 1.0;
  if (pctCego <= 15) return 2.0;
  if (pctCego <= 30) return 3.5;
  return 5.0;
}

// ═════════════════════════════════════════════════════════════
// MAPA DE PESOS POR NOME-BASE
// Mapeamento por substring do nome do item/categoria (case/acento
// tolerante). Ordem importa: itens mais específicos primeiro.
// item interno manda sobre categoria-pai (ler inoperative[].label).
// ═════════════════════════════════════════════════════════════

// normaliza: minúsculas, sem acento
export function norm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// Cada regra: { match:[substrings], classe, flags }
// flags:
//   trava        → dispara CRÍTICO do site quando inoperante (regra própria)
//   conjunto     → usa fatorProporcao
//   cftv         → usa régua CFTV
//   perimetro    → regra especial de perímetro
//   panicoMovel  → peso 4, sem trava
//   panicoFixo   → bloqueador + trava
//   soMoked      → só entra no relatório MOKED (fora do cliente)
//   condTotal    → só pontua se inoperância TOTAL (ex: Paradox)
//   semTrava     → nunca dispara trava (ex: incêndio)
export const MAPA_NOMEBASE = [
  // ── Pânico: distinguir fixo vs móvel (item interno decide) ──
  // IMPORTANTE: exige "panico" ou "botao" — NÃO casar "telefone fixo" etc.
  { match: ["panico fixo", "botao de panico fixo", "botao fixo", "panico ztrax"], classe: "BLOQUEADOR", flags: { panicoFixo: true } },
  { match: ["panico movel", "panico móvel", "panico mov"], classe: "AUTOMACAO", flags: { panicoMovel: true, peso: 4 } },
  { match: ["botoes de panico", "botao de panico", "panico"], classe: "BLOQUEADOR", flags: { panicoFixo: true } }, // pânico genérico em categoria própria = fixo (conservador p/ trava)

  // ── Perímetro (regra especial) ──
  { match: ["alarme perimetral", "perimetro", "cerca eletr", "fibra otica", "sensor ir perimetr"], classe: "BLOQUEADOR", flags: { perimetro: true } },

  // ── Automação de acesso que CONTÉM nome de item forte (deve vir ANTES) ──
  // "Leitor QR Cancela" tem "cancela" no nome mas é automação, não contenção.
  { match: ["leitor qr", "qr cancela", "qr torniquete", "qr eclusa"], classe: "AUTOMACAO", flags: { antesDe: "cancela" } },

  // Controles administrativos não são barreira patrimonial. Devem constar
  // no plano de manutenção, mas não podem alterar a classificação do site.
  { match: ["cancela adm", "cancela administrativa", "portao adm", "portao administrativo"], classe: "PERIFERICO", flags: { observacaoManutencao: true } },

  // Cofre e periféricos são explicitamente mapeados antes do fallback. Sem
  // esta linha, "cofre" cairia em Automação e elevaria o risco indevidamente.
  { match: ["cofre"], classe: "PERIFERICO", flags: { observacaoManutencao: true } },

  // ── Contenção física (bloqueador) ──
  { match: ["bollard", "bolard", "pino retratil", "dilacerador", "garra"], classe: "BLOQUEADOR", flags: { conjunto: true, barreiraAcesso: true } },
  { match: ["cancela alta seg", "cancela veicular", "cancela inclusa", "cancela baia"], classe: "BLOQUEADOR", flags: { conjunto: true, barreiraAcesso: true } },
  // Uma "cancela" sem indicação de alta segurança ou de barreira crítica é
  // administrativa por padrão conservador de classificação (não infla risco).
  { match: ["cancela"], classe: "PERIFERICO", flags: { observacaoManutencao: true } },

  // ── CTMK / monitoramento central ──
  { match: ["ctmk", "central de monitor"], classe: "BLOQUEADOR", flags: { ctmk: true } },

  // ── Incêndio (pontua, sem trava) ──
  { match: ["alarme de incendio", "incendio", "sdai", "repetidora"], classe: "TATICO", flags: { semTrava: true } },

  // ── CFTV (régua própria) ──
  { match: ["cftv", "camera"], classe: "TATICO", flags: { cftv: true } },

  // ── Eclusa / torniquete de travamento ──
  { match: ["eclusa", "torniquete de travamento", "portoes eclusa", "portao eclusa"], classe: "TATICO", flags: {} },

  // ── Materiais operacionais críticos (P311) ──
  { match: ["moto de ronda", "moto ronda"], classe: "TATICO", flags: {} },
  { match: ["armamento"], classe: "TATICO", flags: {} },

  // ── Paradox (condicional a total desconfiguração) ──
  { match: ["paradox"], classe: "TATICO", flags: { condTotal: true, soMoked: false } },

  // ── Automação de acesso (teto MODERADO) ──
  { match: ["qr"], classe: "AUTOMACAO", flags: {} }, // QR genérico
  { match: ["semaforo", "pictograma", "farol"], classe: "AUTOMACAO", flags: {} },
  { match: ["sensor anti", "anti-esmag", "antiesmag"], classe: "AUTOMACAO", flags: {} },
  { match: ["totem", "token", "totem token"], classe: "AUTOMACAO", flags: {} },
  { match: ["botoeira"], classe: "AUTOMACAO", flags: {} },
  { match: ["torniquete", "catraca"], classe: "AUTOMACAO", flags: {} }, // pedestre
  { match: ["porta cco", "porta da cco", "porta do cco"], classe: "PERIFERICO", flags: { observacaoManutencao: true } },
  { match: ["portao", "portoes", "motor portao"], classe: "AUTOMACAO", flags: {} },

  // ── Iluminação (fora do motor de proporção) ──
  { match: ["iluminacao", "quadrante", "lampada", "refletor"], classe: "ILUMINACAO", flags: { iluminacao: true } },

  // ── Periféricos (só MOKED) ──
  { match: ["joystick", "mesa gatbox", "mesa controle", "mesa controladora"], classe: "PERIFERICO", flags: { observacaoManutencao: true } },
  { match: ["monitor", "cpu", "computador"], classe: "PERIFERICO", flags: { observacaoManutencao: true } },
  { match: ["ar-condicionado", "ar condicionado", "ar-cond"], classe: "PERIFERICO", flags: { observacaoManutencao: true } },
  { match: ["nobreak", "no-break", "transformador"], classe: "PERIFERICO", flags: { observacaoManutencao: true } },
  { match: ["internet", "telefone", "interfone", "intercomunicador", "radio ht", "bodycam", "lanterna", "smartphone", "tablet"], classe: "PERIFERICO", flags: { observacaoManutencao: true } },
  { match: ["guarita"], classe: "PERIFERICO", flags: { observacaoManutencao: true } },

  // ── Capacitação / brigada (só MOKED, não é equipamento) ──
  { match: ["brigada", "capacitacao", "reciclagem", "efetivo"], classe: "PERIFERICO", flags: { soMoked: true, naoEquipamento: true } },
];

// ── Resolve nome-base → regra (item interno manda) ───────────
export function resolverRegra(labelItem, labelCategoria) {
  const alvo = norm(labelItem) || norm(labelCategoria);
  const catn = norm(labelCategoria);
  // 1) tenta pelo item interno
  for (const r of MAPA_NOMEBASE) {
    for (const m of r.match) if (alvo.includes(m)) return { ...r, via: "item" };
  }
  // 2) tenta pela categoria
  for (const r of MAPA_NOMEBASE) {
    for (const m of r.match) if (catn.includes(m)) return { ...r, via: "categoria" };
  }
  // 3) fallback: Automação 4
  return { match: [], classe: "AUTOMACAO", flags: { fallback: true }, via: "fallback" };
}

// ── Aplica teto de classe a um rótulo bruto ──────────────────
export function aplicarTeto(rotuloBruto, classeKey, flags = {}) {
  const peso = (flags.peso != null) ? flags.peso : CLASSE[classeKey].peso;
  // teto derivado do peso efetivo (pânico móvel usa peso 4 → teto Automação)
  let teto;
  if (peso >= 10) teto = NIVEL.CRITICO;
  else if (peso >= 7) teto = NIVEL.ELEVADO;
  else if (peso >= 2) teto = NIVEL.MODERADO;
  else teto = NIVEL.BAIXO;
  return Math.min(rotuloBruto, teto);
}

// ── Rótulo bruto por PVT ─────────────────────────────────────
export function rotuloPorPVT(pvt) {
  if (pvt >= PVT_CORTES.critico) return NIVEL.CRITICO;
  if (pvt >= PVT_CORTES.elevado) return NIVEL.ELEVADO;
  if (pvt >= PVT_CORTES.moderado) return NIVEL.MODERADO;
  return NIVEL.BAIXO;
}

// Trava não é uma flag aberta. Só estes três eventos podem levar um site a
// CRÍTICO sem dois bloqueadores independentes. O campo semântico evita que
// uma regra futura de item (ex.: cancela) crie uma trava por acidente.
export function travaFechada(vetor) {
  return ["perimetroTotal30d"].includes(vetor?.travaTipo);
}

function chave(v) { return norm(v || "") || "pendente"; }

function ehPerimetroSemCadastro(v) {
  return chave(v.barreiraFisica) === "perimetro"
    && (chave(v.zonaCanonica || v.area) === "perimetro-sem-cadastro" || v.pendenciaCadastro === true);
}

// Agrupa todos os bloqueadores antes da contagem. Comparação pairwise falha
// quando há três ou mais eventos; a chave canônica deixa a regra auditável.
// Causa ambígua é agrupada conservadoramente como uma frente pendente, nunca
// inflada por inferência de independência.
export function agruparBloqueadores(vetores = []) {
  const grupos = new Map();
  vetores.filter((v) => v?.incluir !== false && v?.bloqueadorCaido
      && !ehPerimetroSemCadastro(v)
    ).forEach((v) => {
    const causa = chave(v.causaRaiz);
    const ambigua = !v.causaRaiz || causa === "pendente" || causa === "ambigua";
    const zona = chave(v.zonaCanonica || v.area);
    const zonaNomeada = zona !== "pendente" && zona !== "perimetro-sem-cadastro";
    const ehPerimetro = chave(v.barreiraFisica) === "perimetro";
    const key = (ehPerimetro && zonaNomeada)
      ? `perimetro:${zona}`
      : ambigua
        ? `pendente:${chave(v.barreiraFisica || v.grupo || "bloqueador")}`
      : `${chave(v.barreiraFisica)}:${chave(v.zonaCanonica || v.area)}:${causa}`;
    const anterior = grupos.get(key) || { key, vetores: [], pendente: ambigua && !(ehPerimetro && zonaNomeada) };
    anterior.vetores.push(v);
    grupos.set(key, anterior);
  });
  return [...grupos.values()];
}

// Conveniência para testes/documentação. A consolidação usa sempre o
// agrupamento acima, não esta comparação binária isolada.
export function saoIndependentes(a, b) {
  return agruparBloqueadores([a, b]).length === 2;
}

// ═════════════════════════════════════════════════════════════
// CLASSIFICADOR PRINCIPAL DE UM VETOR
// entrada: {
//   labelItem, labelCategoria,
//   dias,                 // dias em aberto (pior caso do conjunto)
//   inop, total,          // para conjuntos e CFTV
//   estadoTotal,          // bool: totalmente desconfigurado (perímetro/Paradox)
//   emObra,               // bool: zona em instalação
//   escopo                // "cliente" | "moked"
// }
// retorno: { nivel, label, classe, peso, pvt, trava, incluir, tag, motivo }
// ═════════════════════════════════════════════════════════════
export function classificarVetor(v) {
  const escopo = v.escopo || "moked";
  const regra = resolverRegra(v.labelItem, v.labelCategoria);
  const flags = regra.flags || {};
  const classeKey = regra.classe;
  const peso = (flags.peso != null) ? flags.peso : CLASSE[classeKey].peso;

  // filtro de escopo: itens soMoked não entram no relatório do cliente
  const incluir = !(escopo === "cliente" && flags.soMoked);

  const base = {
    classe: CLASSE[classeKey].nome, classeKey, peso,
    incluir,
    // Só aceita uma trava já nomeada na lista fechada; uma flag genérica
    // passada por qualquer fonte nunca promove o site a crítico.
    travaTipo: ["panicoFixoInoperante", "ctmkOffline", "perimetroTotal30d"].includes(v.travaTipo) ? v.travaTipo : null,
    bloqueadorCaido: !!v.bloqueadorCaido, observacaoManutencao: !!flags.observacaoManutencao,
    tag: null, motivo: "",
    via: regra.via,
    // Metadados de evidência pertencem ao vetor de origem, não à regra de
    // classificação. Preservá-los aqui permite verificar independência no
    // consolidado sem inventar relação entre zonas, causas ou coberturas.
    zonaCanonica: v.zonaCanonica || null,
    barreiraFisica: v.barreiraFisica || (flags.perimetro ? "perimetro" : null),
    causaRaiz: v.causaRaiz || null,
    coberturaAlternativa: v.coberturaAlternativa || "não informada",
    gravidade: v.gravidade || null,
    pendenciaCadastro: !!v.pendenciaCadastro,
  };

  if (flags.observacaoManutencao) {
    return { ...base, nivel: NIVEL.BAIXO, label: "OBSERVAÇÃO", pvt: 0,
             motivo: "item de manutenção sem impacto direto na classificação" };
  }

  // ── PERÍMETRO (regra especial) ──
  if (flags.perimetro) {
    if (v.emObra && !v.inop) {
      return { ...base, nivel: NIVEL.BAIXO, label: "observação", tag: "em implantação",
               pvt: 0, motivo: "zona em fase de instalação" };
    }
    // totalmente desconfigurado + >30d → CRÍTICO + trava
    if (v.estadoTotal && (v.dias || 0) > 30) {
      return { ...base, nivel: NIVEL.CRITICO, label: NIVEL_LABEL[NIVEL.CRITICO],
               pvt: 999, travaTipo: "perimetroTotal30d", bloqueadorCaido: true,
               motivo: "perímetro totalmente desconfigurado há mais de 30 dias" };
    }
    // desconfig recente OU zona(s) isolada(s) → ELEVADO, sem trava
    return { ...base, nivel: NIVEL.ELEVADO, label: NIVEL_LABEL[NIVEL.ELEVADO],
             pvt: 0, bloqueadorCaido: true, motivo: "zona perimetral inoperante" };
  }

  // ── PARADOX (condicional a total desconfiguração) ──
  if (flags.condTotal && !v.estadoTotal) {
    return { ...base, nivel: NIVEL.BAIXO, label: "observação", tag: "redundância ativa",
             pvt: 0, motivo: "Paradox parcial/OK — tem redundância" };
  }

  // ── CFTV (régua própria) ──
  if (flags.cftv) {
    const pctCego = v.total ? (v.inop / v.total) * 100 : 0;
    const pvt = 7 * fatorCoberturaCFTV(pctCego) * multTemporalLeve(v.dias);
    let nivel = aplicarTeto(rotuloPorPVT(pvt), classeKey, flags);
    const criticaExposta = !!v.cameraCritica && v.coberturaAlternativa !== "redundante";
    if (criticaExposta) nivel = NIVEL.ELEVADO;
    return { ...base, nivel, label: NIVEL_LABEL[nivel], pvt: round1(pvt),
             bloqueadorCaido: criticaExposta,
             motivo: `${v.inop} de ${v.total} câmeras (${pctCego.toFixed(1)}% cego)${criticaExposta ? "; câmera crítica sem cobertura alternativa" : ""}` };
  }

  // ── CONJUNTO (proporção domina) ──
  if (flags.conjunto) {
    if (flags.barreiraAcesso && (v.barreiraEfetiva === false || v.coberturaAlternativa === "redundante")) {
      return { ...base, nivel: NIVEL.BAIXO, label: "OBSERVAÇÃO", pvt: 0,
               observacaoManutencao: true, motivo: "barreira com cobertura alternativa ou sem criticidade confirmada" };
    }
    const pvt = peso * fatorProporcao(v.inop, v.total) * multTemporalLeve(v.dias);
    let nivel = aplicarTeto(rotuloPorPVT(pvt), classeKey, flags);
    const f = v.total ? Math.round((v.inop / v.total) * 100) : 0;
    return { ...base, nivel, label: NIVEL_LABEL[nivel], pvt: round1(pvt),
             bloqueadorCaido: !!flags.barreiraAcesso && v.barreiraEfetiva !== false && v.coberturaAlternativa !== "redundante",
             motivo: `${v.inop} de ${v.total} (${f}% do conjunto)` };
  }

  // ── ILUMINAÇÃO (fora da proporção; teto MODERADO; não escala por %) ──
  if (flags.iluminacao) {
    const pvt = peso * multTemporal(v.dias); // sem volume/proporção
    let nivel = aplicarTeto(rotuloPorPVT(pvt), classeKey, flags);
    return { ...base, nivel, label: NIVEL_LABEL[nivel], pvt: round1(pvt),
             motivo: "iluminação (impacto cruzado localizado)" };
  }

  // ── ISOLADO / demais (peso × tempo × volume) ──
  const nItens = v.inop && v.inop > 1 ? v.inop : 1;
  const pvt = peso * multTemporal(v.dias) * fatorVolume(nItens);
  let nivel = aplicarTeto(rotuloPorPVT(pvt), classeKey, flags);
  // Botão de pânico fixo inoperante é trava imediata; não depende do número
  // de dias informado no Teste Semanal.
  const travaTipo = base.travaTipo || (flags.panicoFixo ? "panicoFixoInoperante" : null);
  const bloqueadorCaido = base.bloqueadorCaido || (classeKey === "BLOQUEADOR" && nivel >= NIVEL.ELEVADO);
  return { ...base, nivel, label: NIVEL_LABEL[nivel], pvt: round1(pvt), travaTipo, bloqueadorCaido,
           motivo: flags.panicoMovel ? "pânico móvel (coberto pelo fixo)" : (regra.via === "fallback" ? "item não mapeado (fallback Automação)" : "") };
}

// ═════════════════════════════════════════════════════════════
// CONSOLIDAÇÃO DO SITE
// - se algum vetor tem trava → CRÍTICO
// - senão, pega o pior nível dos vetores incluídos
// - escopo cliente: teto ELEVADO no consolidado
// ═════════════════════════════════════════════════════════════
export function consolidarSite(vetoresClassificados, escopo = "moked") {
  const incl = vetoresClassificados.filter(v => v.incluir !== false && !v.observacaoManutencao);
  const travas = incl.filter(travaFechada);
  const grupos = agruparBloqueadores(incl);
  const nBloqueadores = grupos.length;
  const temTatico = incl.some(v => !v.bloqueadorCaido && (v.nivel || 0) >= NIVEL.MODERADO);
  let nivel = NIVEL.BAIXO;
  let motivo = "somente observações/manutenção";
  if (travas.length) {
    nivel = NIVEL.CRITICO;
    motivo = travas[0].motivo || "trava fechada de segurança acionada";
  } else if (nBloqueadores >= 2) {
    nivel = NIVEL.CRITICO;
    motivo = `${nBloqueadores} bloqueadores independentes identificados`;
  } else if (nBloqueadores === 1) {
    nivel = NIVEL.ELEVADO;
    motivo = "1 bloqueador identificado";
  } else if (temTatico) {
    nivel = NIVEL.MODERADO;
    motivo = "vetor(es) tático(s) sem bloqueador";
  }
  return { nivel, label: NIVEL_LABEL[nivel], motivo, temTrava: travas.length > 0, nBloqueadores, gruposBloqueadores: grupos };
}

// Matriz operacional final aprovada para o relatório executivo. Ela é
// intencionalmente pequena: manutenção e contexto territorial não podem
// promover o risco. A função é pura para poder ser testada sem Firestore.
export function classificarRiscoOperacional({
  zonasPerimetrais = 0,
  cftvInoperante = 0,
  barreirasCriticas = 0,        // bollard / garra / dilacerador (NÃO cancela AS)
  panicoFixoInoperante = false,
  ctmkOffline = false,
  perimetroTotal30d = false,
} = {}) {
  // ── Régua Marcio (20/09): SÓ o perímetro puxa CRÍTICO. ──
  // Perímetro totalmente desconfigurado >30d é falha do próprio perímetro → CRÍTICO.
  if (perimetroTotal30d) {
    return { nivel: NIVEL.CRITICO, label: NIVEL_LABEL[NIVEL.CRITICO], motivo: "perímetro totalmente desconfigurado (>30 dias)" };
  }
  // 2+ zonas perimetrais inoperantes → CRÍTICO (com ou sem outras falhas).
  if (zonasPerimetrais >= 2) {
    return { nivel: NIVEL.CRITICO, label: NIVEL_LABEL[NIVEL.CRITICO], motivo: "duas ou mais zonas perimetrais inoperantes" };
  }
  // 1 zona perimetral + outra falha relevante → CRÍTICO.
  const outraFalhaRelevante = cftvInoperante > 5 || barreirasCriticas > 0 || panicoFixoInoperante || ctmkOffline;
  if (zonasPerimetrais === 1 && outraFalhaRelevante) {
    return { nivel: NIVEL.CRITICO, label: NIVEL_LABEL[NIVEL.CRITICO], motivo: "uma zona perimetral inoperante somada a outra falha relevante" };
  }
  // 1 zona perimetral sozinha → ELEVADO.
  if (zonasPerimetrais === 1) {
    return { nivel: NIVEL.ELEVADO, label: NIVEL_LABEL[NIVEL.ELEVADO], motivo: "uma zona perimetral inoperante" };
  }
  // ── Sem zona perimetral inoperante: NUNCA crítico (barreira de pé). ──
  if (panicoFixoInoperante) {
    return { nivel: NIVEL.ELEVADO, label: NIVEL_LABEL[NIVEL.ELEVADO], motivo: "pânico fixo inoperante (perímetro íntegro)" };
  }
  if (ctmkOffline) {
    return { nivel: NIVEL.ELEVADO, label: NIVEL_LABEL[NIVEL.ELEVADO], motivo: "CTMK offline (perímetro íntegro)" };
  }
  if (cftvInoperante > 5) {
    return { nivel: NIVEL.ELEVADO, label: NIVEL_LABEL[NIVEL.ELEVADO], motivo: "mais de cinco câmeras inoperantes (perímetro íntegro)" };
  }
  if (barreirasCriticas > 0) {
    return { nivel: NIVEL.ELEVADO, label: NIVEL_LABEL[NIVEL.ELEVADO], motivo: "barreira crítica de bloqueio inoperante (perímetro íntegro)" };
  }
  // Tático sem bloqueador → MODERADO tratado no fluxo; aqui, base BAIXO.
  return { nivel: NIVEL.BAIXO, label: NIVEL_LABEL[NIVEL.BAIXO], motivo: "somente manutenção ou barreira isolada" };
}

// ── util ──
function round1(x) { return Math.round(x * 10) / 10; }

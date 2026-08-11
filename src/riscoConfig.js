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
export const NIVEL = { CRITICO_II: 5, CRITICO: 4, ELEVADO: 3, MODERADO: 2, BAIXO: 1, SEMDADOS: 0 };
export const NIVEL_LABEL = { 5: "CRÍTICO II", 4: "CRÍTICO", 3: "ELEVADO", 2: "MODERADO", 1: "BAIXO", 0: "SEM DADOS" };
export const NIVEL_ORDEM = (n) => n; // já é ordinal

// ── Classes de ativo (peso + teto) ───────────────────────────
export const CLASSE = {
  BLOQUEADOR: { nome: "Bloqueador", peso: 10, teto: NIVEL.CRITICO },
  TATICO:     { nome: "Tático",     peso: 7,  teto: NIVEL.ELEVADO },
  AUTOMACAO:  { nome: "Automação",  peso: 4,  teto: NIVEL.MODERADO },
  ILUMINACAO: { nome: "Iluminação", peso: 2,  teto: NIVEL.MODERADO },
  BAIXO:      { nome: "Baixo",      peso: 1,  teto: NIVEL.BAIXO },
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
// ESCALAS POR CONTAGEM (decididas com Marcio em 10/08/2026)
// Sobrepõem a fórmula PVT nos casos abaixo.
// ═════════════════════════════════════════════════════════════

// CFTV por CONTAGEM de câmeras inoperantes (não por % cego):
//   1-2 → BAIXO · 3 → MODERADO · 4+ → CRÍTICO. Pior câmera >5d sobe +1.
export function nivelCFTVContagem(qtdInop, piorDias) {
  let nivel;
  if (qtdInop <= 0) nivel = NIVEL.BAIXO;
  else if (qtdInop <= 2) nivel = NIVEL.BAIXO;
  else if (qtdInop === 3) nivel = NIVEL.MODERADO;
  else nivel = NIVEL.CRITICO;
  if (piorDias != null && piorDias > 5 && nivel < NIVEL.CRITICO) nivel = Math.min(NIVEL.CRITICO, nivel + 1);
  return nivel;
}

// Cancela AS (Alta Segurança) — escala GLOBAL por contagem:
//   1-2 → ELEVADO · 3+ → CRÍTICO.
export const CANCELA_AS_MATCH = ["cancela as", "cancelas as", "alta seguranca"];
export function nivelCancelaAS(qtdInop) {
  const q = Math.max(0, qtdInop || 0);
  if (q <= 0) return NIVEL.BAIXO;
  if (q <= 2) return NIVEL.ELEVADO;
  return NIVEL.CRITICO;
}

// Override de cancelas POR PROJETO (escala varia por parque).
export const CANCELA_CONFIG = {
  P601:  { match: ["cancela adm", "cancelas adm"], modo: "fixo", nivel: NIVEL.BAIXO },
  P604:  { match: ["cancela adm", "cancelas adm"], modo: "fora" },
  P311A: { match: ["cancela de acesso", "cancelas de acesso", "cancela"], modo: "escala",
           escala: { 1: NIVEL.BAIXO, 2: NIVEL.MODERADO, 3: NIVEL.ELEVADO, 4: NIVEL.CRITICO, 5: NIVEL.CRITICO } },
  P311B: { match: ["cancela de acesso", "cancelas de acesso", "cancela"], modo: "escala",
           escala: { 1: NIVEL.BAIXO, 2: NIVEL.MODERADO, 3: NIVEL.CRITICO, 4: NIVEL.CRITICO } },
  P606:  { match: ["cancela"], modo: "fora" },
};
export function overrideCancela(pid, catLabel, qtdInop) {
  const cfg = CANCELA_CONFIG[pid];
  if (!cfg) return null;
  const n = norm(catLabel);
  if (!cfg.match.some((m) => n.includes(m))) return null;
  if (cfg.modo === "fora") return { fora: true };
  if (cfg.modo === "fixo") return { nivel: cfg.nivel };
  if (cfg.modo === "escala") {
    const q = Math.max(0, qtdInop || 0);
    if (q <= 0) return { nivel: NIVEL.BAIXO };
    const chaves = Object.keys(cfg.escala).map(Number).sort((a,b)=>a-b);
    let nivel = cfg.escala[chaves[0]];
    for (const k of chaves) if (q >= k) nivel = cfg.escala[k];
    return { nivel };
  }
  return null;
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
  { match: ["panico fixo", "botao de panico fixo", "botao fixo", "panico ztrax"], classe: "BLOQUEADOR", flags: { panicoFixo: true, trava: true } },
  { match: ["panico movel", "panico móvel", "panico mov"], classe: "TATICO", flags: { panicoMovel: true } }, // HOJE(10/08): móvel teto ELEVADO
  { match: ["botoes de panico", "botao de panico", "panico"], classe: "BLOQUEADOR", flags: { panicoFixo: true, trava: true } }, // pânico genérico em categoria própria = fixo (conservador p/ trava)

  // ── Perímetro (regra especial) ──
  { match: ["alarme perimetral", "perimetro", "cerca eletr", "fibra otica", "sensor ir perimetr"], classe: "BLOQUEADOR", flags: { perimetro: true } },

  // ── Automação de acesso que CONTÉM nome de item forte (deve vir ANTES) ──
  // "Leitor QR Cancela" tem "cancela" no nome mas é automação, não contenção.
  { match: ["leitor qr", "qr cancela", "qr torniquete", "qr eclusa"], classe: "AUTOMACAO", flags: { antesDe: "cancela" } },

  // ── Contenção física (bloqueador) ──
  { match: ["bollard", "bolard", "pino retratil", "dilacerador", "garra"], classe: "BLOQUEADOR", flags: { conjunto: true } },
  { match: ["cancela alta seg", "cancela veicular", "cancela inclusa", "cancela baia", "cancela"], classe: "BLOQUEADOR", flags: { conjunto: true } },

  // ── CTMK / monitoramento central ──
  { match: ["ctmk", "central de monitor"], classe: "TATICO", flags: {} }, // HOJE(10/08): CTMK tático, sem trava

  // ── Incêndio (pontua, sem trava) ──
  { match: ["alarme de incendio", "incendio", "sdai", "repetidora"], classe: "BAIXO", flags: { semTrava: true } }, // HOJE(10/08): incêndio nunca sobe

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
  { match: ["semaforo", "pictograma", "farol", "giroflex"], classe: "BAIXO", flags: {} }, // HOJE(10/08)
  { match: ["sensor anti", "anti-esmag", "antiesmag"], classe: "BAIXO", flags: {} }, // HOJE(10/08)
  { match: ["totem", "token", "totem token"], classe: "AUTOMACAO", flags: {} },
  { match: ["botoeira", "mesa controladora", "mesa controle", "joystick"], classe: "BAIXO", flags: {} }, // HOJE(10/08)
  { match: ["torniquete", "catraca"], classe: "AUTOMACAO", flags: {} }, // pedestre
  { match: ["portao", "portoes", "porta cco", "motor portao"], classe: "AUTOMACAO", flags: {} },

  // ── Iluminação (fora do motor de proporção) ──
  { match: ["iluminacao", "quadrante", "lampada", "refletor"], classe: "ILUMINACAO", flags: { iluminacao: true } },

  // ── Periféricos (só MOKED) ──
  { match: ["joystick", "mesa gatbox", "mesa controle", "mesa controladora"], classe: "PERIFERICO", flags: { soMoked: true } },
  { match: ["monitor", "cpu", "computador"], classe: "PERIFERICO", flags: { soMoked: true } },
  { match: ["ar-condicionado", "ar condicionado", "ar-cond"], classe: "PERIFERICO", flags: { soMoked: true } },
  { match: ["nobreak", "no-break", "transformador"], classe: "PERIFERICO", flags: { soMoked: true } },
  { match: ["internet", "telefone", "nobreak cco"], classe: "TATICO", flags: {} }, // HOJE(10/08): infra crítica operacional → ELEVADO
  { match: ["interfone", "intercomunicador", "radio ht", "bodycam", "lanterna", "smartphone", "tablet"], classe: "PERIFERICO", flags: { soMoked: true } },
  { match: ["guarita"], classe: "PERIFERICO", flags: { soMoked: true } },

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

  // ── OVERRIDE DE CANCELA POR PROJETO (10/08) — antes da PVT ──
  const ov = overrideCancela(v.pid, v.labelCategoria || v.labelItem, v.inop);
  if (ov) {
    if (ov.fora) return { classe: "Fora do score", classeKey: "PERIFERICO", peso: 0,
      incluir: false, trava: false, tag: "fora do score", motivo: "cancela administrativa (fora do escopo)",
      nivel: NIVEL.SEMDADOS, label: "—", pvt: 0, via: "override" };
    return { classe: "Cancela", classeKey: "BLOQUEADOR", peso: 10, incluir: true, trava: false,
      tag: "override", motivo: "escala de cancela do projeto", nivel: ov.nivel,
      label: NIVEL_LABEL[ov.nivel], pvt: 0, via: "override" };
  }

  // ── ESCALA GLOBAL CANCELA AS (10/08) — antes da PVT ──
  {
    const nlbl = norm(v.labelCategoria || v.labelItem);
    if (CANCELA_AS_MATCH.some((m) => nlbl.includes(m))) {
      const nivel = nivelCancelaAS(v.inop);
      return { classe: "Cancela AS", classeKey: "BLOQUEADOR", peso: 10, incluir: true,
        trava: false, tag: "cancela-as", motivo: `${v.inop} cancela(s) AS inoperante(s)`,
        nivel, label: NIVEL_LABEL[nivel], pvt: 0, via: "escala-as" };
    }
  }

  const regra = resolverRegra(v.labelItem, v.labelCategoria);
  const flags = regra.flags || {};
  const classeKey = regra.classe;
  const peso = (flags.peso != null) ? flags.peso : CLASSE[classeKey].peso;

  // filtro de escopo: itens soMoked não entram no relatório do cliente
  const incluir = !(escopo === "cliente" && flags.soMoked);

  const base = {
    classe: CLASSE[classeKey].nome, classeKey, peso,
    incluir, trava: false, tag: null, motivo: "",
    via: regra.via,
  };

  // ── PERÍMETRO (regra especial — escala por Nº DE ZONAS, 10/08) ──
  if (flags.perimetro) {
    if (v.emObra && !v.inop) {
      return { ...base, nivel: NIVEL.BAIXO, label: "observação", tag: "em implantação",
               pvt: 0, motivo: "zona em fase de instalação" };
    }
    const zonas = Math.max(0, v.inop || 0);
    // totalmente desconfigurado + >30d → CRÍTICO + trava (mantido do repo)
    if (v.estadoTotal && (v.dias || 0) > 30) {
      return { ...base, nivel: NIVEL.CRITICO, label: NIVEL_LABEL[NIVEL.CRITICO],
               pvt: 999, trava: true, motivo: "perímetro totalmente desconfigurado há mais de 30 dias" };
    }
    // 1 zona = ELEVADO · 2+ zonas = CRÍTICO (decisão 10/08)
    let nivel = NIVEL.BAIXO;
    if (zonas === 1) nivel = NIVEL.ELEVADO;
    else if (zonas >= 2) nivel = NIVEL.CRITICO;
    // tempo pode subir 1 zona isolada a CRÍTICO se muito antiga (>90d)
    if (zonas === 1 && (v.dias || 0) > 90) nivel = NIVEL.CRITICO;
    return { ...base, nivel, label: NIVEL_LABEL[nivel],
             pvt: 0, motivo: `${zonas} zona(s) perimetral(is) inoperante(s)` };
  }

  // ── PARADOX (condicional a total desconfiguração) ──
  if (flags.condTotal && !v.estadoTotal) {
    return { ...base, nivel: NIVEL.BAIXO, label: "observação", tag: "redundância ativa",
             pvt: 0, motivo: "Paradox parcial/OK — tem redundância" };
  }

  // ── CFTV (régua própria: CONTAGEM — decidido 10/08) ──
  if (flags.cftv) {
    const nivel = nivelCFTVContagem(v.inop, v.dias);
    return { ...base, nivel, label: NIVEL_LABEL[nivel], pvt: 0,
             motivo: `${v.inop} câmera(s) inoperante(s)${v.dias != null ? ` (pior ${v.dias}d)` : ""}` };
  }

  // ── CONJUNTO (proporção domina) ──
  if (flags.conjunto) {
    const pvt = peso * fatorProporcao(v.inop, v.total) * multTemporalLeve(v.dias);
    let nivel = aplicarTeto(rotuloPorPVT(pvt), classeKey, flags);
    const f = v.total ? Math.round((v.inop / v.total) * 100) : 0;
    return { ...base, nivel, label: NIVEL_LABEL[nivel], pvt: round1(pvt),
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
  const trava = !!(flags.trava && (v.dias || 0) >= 10);
  return { ...base, nivel, label: NIVEL_LABEL[nivel], pvt: round1(pvt), trava,
           motivo: flags.panicoMovel ? "pânico móvel (coberto pelo fixo)" : (regra.via === "fallback" ? "item não mapeado (fallback Automação)" : "") };
}

// ═════════════════════════════════════════════════════════════
// CONSOLIDAÇÃO DO SITE
// - se algum vetor tem trava → CRÍTICO
// - senão, pega o pior nível dos vetores incluídos
// - escopo cliente: teto ELEVADO no consolidado
// ═════════════════════════════════════════════════════════════
export function consolidarSite(vetoresClassificados, escopo = "moked") {
  const incl = vetoresClassificados.filter(v => v.incluir);
  const temTrava = incl.some(v => v.trava);
  let nivel;
  let motivo;
  if (temTrava) {
    nivel = NIVEL.CRITICO;
    const g = incl.find(v => v.trava);
    motivo = g ? g.motivo : "trava de segurança acionada";
  } else {
    nivel = incl.reduce((m, v) => Math.max(m, v.nivel || 0), NIVEL.BAIXO);
    motivo = "pior vetor de segurança do período";
  }
  // ── ESCOPO (10/08): Moked = Cliente + 1 nível (alerta antecipado) ──
  // Cliente: teto CRÍTICO (nível 4). Moked: desloca +1, topo CRÍTICO II (5).
  if (escopo === "cliente") {
    if (nivel > NIVEL.CRITICO) nivel = NIVEL.CRITICO;
  } else {
    // moked: sobe um degrau acima do que o cliente veria, teto CRÍTICO II
    nivel = Math.min(NIVEL.CRITICO_II, nivel + 1);
  }
  return { nivel, label: NIVEL_LABEL[nivel], motivo, temTrava };
}

// ── util ──
function round1(x) { return Math.round(x * 10) / 10; }

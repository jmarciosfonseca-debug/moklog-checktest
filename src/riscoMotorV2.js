// ─────────────────────────────────────────────────────────────
// riscoMotorV2.js — Doutrina v2 da Análise de Risco (aprovada por
// Marcio em 08/10/2026 após cruzamento de 9 laudos × 9 relatórios AR).
//
// Camada ADITIVA sobre riscoConfig.js. Não altera a matriz histórica
// (classificarRiscoOperacional); recebe o resultado dela e aplica as
// quatro correções acordadas:
//   1. Perfil de barreiras por projeto — "a via está transponível?"
//      1 via de saída transponível = ELEVADO (piso); 2 ou mais = CRÍTICO.
//   2. CFTV graduado (> 5 câmeras = piso MODERADO; sobe a ELEVADO só com
//      aging, proporção ou perimetrais).
//   3. Pânico móvel = Tático (0/N → piso MODERADO). Pânico fixo sem
//      comunicação = trava de site = CRÍTICO.
//   4. Consolidado >= maior vetor; "por quê" cita o vetor de maior classe
//      (empate → maior aging); nenhum Bloqueador cai em "sem impacto".
// Tudo puro e testável sem Firestore.
// ─────────────────────────────────────────────────────────────
import { NIVEL, NIVEL_LABEL, norm } from "./riscoConfig";

// ── 1. Perfil de barreiras por projeto ───────────────────────
// `vias`: categorias cujo item inoperante = 1 via transponível.
// `cancelaAS`: cancela de alta segurança quebrada CONTINUA bloqueando,
//   salvo diagnóstico de haste erguida / retirada / não fecha.
// `cancelaTransponivel`: cancela é transponível por natureza (Mega) —
//   quebrada vira Automação MODERADO, nunca bloqueador.
// `naoAferido`: projeto sem bloqueador no teste semanal — segue o laudo.
export const PERFIL_BARREIRAS = {
  P601:  { nome: "Golgi Cajamar",  vias: ["bollard", "bolard", "pino"], cancelaAS: true },
  P604:  { nome: "Golgi Jundiaí",  vias: ["bollard", "bolard", "pino"], cancelaAS: true },
  P605:  { nome: "Golgi Dutra",    vias: ["bollard", "bolard", "pino"], cancelaAS: true },
  P602:  { nome: "Golgi Mauá",     vias: ["garra"] },
  P505:  { nome: "Klog Guarulhos", vias: ["garra", "dilacerador"] },
  P311A: { nome: "Mega Curitiba",  vias: ["dilacerador"], cancelaTransponivel: true },
  P311B: { nome: "Mega Itajaí",    vias: ["dilacerador"], cancelaTransponivel: true },
  P606:  { nome: "Golgi Caxias",   vias: ["dilacerador"], cancelaAS: true },
  P607:  { nome: "Golgi Brasília", vias: [], naoAferido: true },
};

export function perfilBarreiras(pid) {
  return PERFIL_BARREIRAS[pid] || { vias: ["bollard", "bolard", "pino", "garra", "dilacerador"], cancelaAS: true, generico: true };
}

// Diagnóstico que torna uma cancela AS transponível mesmo "quebrada".
// "não baixa no automático" NÃO entra: é ambíguo (pode baixar por comando) e
// está em confirmação com o gestor (P601, Acesso 01/03). Só evidência clara.
const RE_HASTE_ABERTA = /haste\s+(erguid|levantad|aberta)|erguid|retirad|nao fecha|n[ãa]o fecha|fica aberta|permanece aberta|sem haste|pista liberada/i;
const RE_CANCELA_AS = /cancela.*(alta seg|\bas\b)|\bas\s*\(/i;
const RE_CANCELA = /cancela/i;
const RE_PANICO_MOVEL = /panico mov/i;
const RE_PANICO_FIXO = /panico fixo|botao fixo|botoes de panico|botao de panico/i;
const RE_CFTV = /cftv|camera/i;
const RE_PERIMETRO = /alarme perimetral|perimetr|cerca eletr|alpha sense/i;

// Acessórios (botoeira, farol, giroflex, QR, totem) nunca são a barreira.
const RE_ACESSORIO = /botoeira|farol|led|giroflex|\bqr\b|totem|semaforo|sensor/i;
export const ehCategoriaVia = (perfil, catLabel) => {
  const cat = norm(catLabel);
  return !RE_ACESSORIO.test(cat) && (perfil.vias || []).some((m) => cat.includes(m));
};

const ehTransponivel = (p) => {
  const st = String(p.status || "").toUpperCase();
  if (st === "INOPERANTE") return true;
  // parcial só conta se o diagnóstico mostrar a via aberta
  return RE_HASTE_ABERTA.test(String(p.note || ""));
};

// Avalia as vias transponíveis de um projeto a partir das pendências do
// Teste Semanal ({ catLabel, itemLabel, status, dias, note }).
export function avaliarViasTransponiveis(pid, pend = []) {
  const perfil = perfilBarreiras(pid);
  const vias = [];
  const semAgravante = [];
  for (const p of pend) {
    const item = String(p.itemLabel || "").trim();
    const ehVia = ehCategoriaVia(perfil, p.catLabel);
    const ehCancelaAS = !ehVia && !!perfil.cancelaAS && RE_CANCELA_AS.test(String(p.catLabel || ""));
    if (ehVia) {
      if (ehTransponivel(p)) {
        vias.push({ categoria: p.catLabel, item, dias: p.dias ?? null, status: p.status, note: p.note || "" });
      } else {
        semAgravante.push({ categoria: p.catLabel, item, dias: p.dias ?? null, motivo: "parcial sem evidência de via aberta — barreira segue bloqueando" });
      }
      continue;
    }
    if (ehCancelaAS) {
      if (RE_HASTE_ABERTA.test(String(p.note || ""))) {
        vias.push({ categoria: p.catLabel, item, dias: p.dias ?? null, status: p.status, note: p.note || "", cancelaAS: true });
      } else {
        semAgravante.push({ categoria: p.catLabel, item, dias: p.dias ?? null, motivo: "cancela AS quebrada continua bloqueando (haste não erguida)" });
      }
    }
  }
  vias.sort((a, b) => (b.dias || 0) - (a.dias || 0));
  const n = vias.length;
  const nivel = n >= 2 ? NIVEL.CRITICO : n === 1 ? NIVEL.ELEVADO : NIVEL.BAIXO;
  return { perfil, vias, n, nivel, semAgravante, naoAferido: !!perfil.naoAferido };
}

// ── 2. CFTV graduado ─────────────────────────────────────────
// Retorna o nível do vetor CFTV. `nivelBase` é o nível da régua antiga
// (proporção) usado abaixo de 5 câmeras.
export function classificarCFTVGraduado({ inop = 0, total = 0, piorDias = null, perimetraisAntigas = 0, nivelBase = NIVEL.BAIXO } = {}) {
  const pct = total ? (inop / total) * 100 : 0;
  const pctTxt = `${pct.toFixed(1).replace(".", ",")}%`;
  const regras = [];
  if (inop > 5) {
    const gatilhos = [];
    if (piorDias != null && piorDias > 15) gatilhos.push(`aging ${piorDias} d (> 15 d)`);
    if (pct >= 10) gatilhos.push(`${pctTxt} do parque (≥ 10%)`);
    if (perimetraisAntigas >= 2) gatilhos.push(`${perimetraisAntigas} perimetrais > 7 d`);
    const nivel = gatilhos.length ? NIVEL.ELEVADO : NIVEL.MODERADO;
    regras.push(`${inop} câmeras (> 5) → piso MODERADO`);
    regras.push(gatilhos.length ? `${gatilhos.join(" e ")} → ELEVADO` : "sem aging, proporção ou perimetrais para ELEVADO");
    return { nivel, regras, pct, gatilhos };
  }
  const nivel = Math.min(nivelBase, NIVEL.ELEVADO);
  regras.push(`${inop} de ${total} câmeras (${pctTxt}) → proporção → ${NIVEL_LABEL[nivel]}`);
  return { nivel, regras, pct, gatilhos: [] };
}

// Conta câmeras perimetrais inoperantes há mais de 7 dias nas pendências.
export function contarPerimetraisAntigas(pend = []) {
  return pend.filter((p) => RE_CFTV.test(norm(p.catLabel)) && /perimet/i.test(`${p.itemLabel || ""} ${p.note || ""}`) && (p.dias || 0) > 7).length;
}

// ── 4. Consolidação v2 ───────────────────────────────────────
const RANK_CLASSE = { Bloqueador: 4, "Tático": 3, Tatico: 3, "Automação": 2, Automacao: 2, "Iluminação": 1, Iluminacao: 1, "Periférico": 0, Periferico: 0 };
export const rankClasse = (classe) => RANK_CLASSE[classe] ?? 2;

// "2 vias de saída transponíveis" / "1 via transponível"
export const descreverVias = (vias = []) => {
  const n = vias.length;
  const saida = vias.length && vias.every((x) => /sa[ií]da/i.test(x.item || ""));
  return `${n} via${n > 1 ? "s" : ""}${saida ? " de saída" : ""} transponíve${n > 1 ? "is" : "l"}`;
};
const nomeItem = (v) => {
  const m = String(v.descricao || "").match(/<b>([^<]+)<\/b>/);
  return (m && m[1]) || String(v.label || "").replace(/^\d+[A-Z]?\s*-\s*/, "");
};
const rotuloCat = (label) => String(label || "").replace(/^\d+[A-Z]?\s*-\s*/, "").replace(/\s*\(.*?\)\s*/g, " ").trim();

// Recebe os vetores já montados (Teste Semanal + demais fontes), as
// pendências do Teste Semanal e o resultado da matriz histórica. Devolve
// vetores ajustados, nível consolidado, vetor determinante e a memória
// de cálculo em forma de soma.
export function aplicarMotorV2({ pid, vetores = [], pend = [], matriz = null, dataTeste = "" }) {
  const avaliacao = avaliarViasTransponiveis(pid, pend);
  const perfil = avaliacao.perfil;
  const viasPorCat = new Map();
  avaliacao.vias.forEach((via) => {
    const k = norm(via.categoria);
    viasPorCat.set(k, (viasPorCat.get(k) || []).concat(via));
  });
  const semAgravantePorCat = new Map();
  avaliacao.semAgravante.forEach((s) => {
    const k = norm(s.categoria);
    semAgravantePorCat.set(k, (semAgravantePorCat.get(k) || []).concat(s));
  });

  const matrizNivel = Number(matriz?.nivel) || NIVEL.BAIXO;
  const matrizPerimetroCritico = matrizNivel === NIVEL.CRITICO && /zonas|per[ií]metro|Alpha Sense|falha simultânea/i.test(matriz?.motivo || "");

  const ajustados = vetores.map((v0) => {
    const v = { ...v0 };
    const cat = norm(v.label);
    const viasDaCat = viasPorCat.get(cat) || [];
    const ehCancela = RE_CANCELA.test(cat) && !/qr|totem|farol|led|semaforo|botoeira/i.test(cat);
    const ehBarreiraPerfil = ehCategoriaVia(perfil, v.label);

    // 1. Barreira do perfil: nível pelas vias transponíveis
    if (ehBarreiraPerfil || viasDaCat.length) {
      v.classeV2 = "Bloqueador";
      v.observacaoManutencao = false;
      if (viasDaCat.length) {
        v.bloqueadorCaido = true;
        v.nivel = Math.max(v.nivel || 0, viasDaCat.length >= 2 ? NIVEL.CRITICO : NIVEL.ELEVADO);
        v.viasTransponiveis = viasDaCat;
        v.regraV2 = `${descreverVias(viasDaCat)} → ${NIVEL_LABEL[viasDaCat.length >= 2 ? NIVEL.CRITICO : NIVEL.ELEVADO]}`;
      } else {
        v.bloqueadorCaido = false;
        v.nivel = Math.min(v.nivel || NIVEL.BAIXO, NIVEL.BAIXO);
        v.regraV2 = "barreira segue bloqueando";
      }
      return v;
    }

    // Cancela: Mega → Automação MODERADO; AS → só conta com haste erguida
    if (ehCancela) {
      if (perfil.cancelaTransponivel) {
        v.classeV2 = "Automação"; v.bloqueadorCaido = false; v.observacaoManutencao = false;
        v.nivel = Math.min(Math.max(v.nivel || NIVEL.BAIXO, NIVEL.MODERADO), NIVEL.MODERADO);
        v.regraV2 = "cancela transponível por natureza — vulnerabilidade pequena (Automação)";
        return v;
      }
      if (RE_CANCELA_AS.test(v.label || "")) {
        if (viasDaCat.length) {
          v.classeV2 = "Bloqueador"; v.bloqueadorCaido = true; v.observacaoManutencao = false;
          v.nivel = Math.max(v.nivel || 0, viasDaCat.length >= 2 ? NIVEL.CRITICO : NIVEL.ELEVADO);
          v.viasTransponiveis = viasDaCat;
          v.regraV2 = `haste erguida/retirada → ${viasDaCat.length} via(s) transponível(is)`;
        } else {
          v.classeV2 = "Bloqueador"; v.bloqueadorCaido = false; v.nivel = NIVEL.BAIXO; v.observacaoManutencao = false;
          v.regraV2 = "cancela AS quebrada continua bloqueando — sem agravante";
          v.semAgravanteV2 = true;
        }
        return v;
      }
    }

    // 2. CFTV graduado
    if (RE_CFTV.test(cat) && v.grupo === "teste") {
      const perimetrais = contarPerimetraisAntigas(pend.filter((p) => norm(p.catLabel) === cat));
      const g = classificarCFTVGraduado({ inop: v.inop, total: v.total, piorDias: v.piorDias, perimetraisAntigas: perimetrais, nivelBase: v.nivelBaseCFTV ?? v.nivel });
      v.nivel = g.nivel; v.classeV2 = "Tático"; v.regraV2 = g.regras.join("; "); v.cftvGraduado = g;
      return v;
    }

    // 3. Pânico móvel = Tático; 0/N → piso MODERADO. Fixo sem comunicação = trava CRÍTICO.
    if (RE_PANICO_MOVEL.test(cat)) {
      v.classeV2 = "Tático"; v.bloqueadorCaido = false; v.observacaoManutencao = false;
      const todos = v.total && v.inop >= v.total;
      // 0/N → exatamente MODERADO (aging agrava a urgência, não o nível)
      v.nivel = todos ? NIVEL.MODERADO : Math.min(v.nivel || NIVEL.BAIXO, NIVEL.MODERADO);
      v.regraV2 = todos ? `${v.inop}/${v.total} móveis sem comunicação → piso MODERADO (tático)` : `${v.inop} de ${v.total} móveis — coberto pelos demais`;
      return v;
    }
    if (RE_PANICO_FIXO.test(cat) && v.grupo === "teste") {
      v.classeV2 = "Bloqueador"; v.bloqueadorCaido = true; v.observacaoManutencao = false;
      v.travaTipo = "panicoFixoInoperante"; v.nivel = NIVEL.CRITICO;
      v.regraV2 = "pânico fixo sem comunicação (inclui 'não reportou') → trava de site → CRÍTICO";
      return v;
    }

    // Trava de perímetro total / perímetro em colapso: sobe à classe do consolidado
    if (v.travaTipo === "perimetroTotal30d") { v.nivel = NIVEL.CRITICO; v.classeV2 = "Bloqueador"; return v; }
    if (matrizPerimetroCritico && (v.barreiraFisica === "perimetro" || RE_PERIMETRO.test(cat)) && v.bloqueadorCaido && !v.observacaoManutencao) {
      v.nivel = NIVEL.CRITICO; v.classeV2 = v.classeV2 || "Bloqueador"; v.regraV2 = v.regraV2 || matriz.motivo;
      return v;
    }
    return v;
  });

  const incl = ajustados.filter((v) => v.incluirCliente !== false && !v.observacaoManutencao && !v.rebaixadoPorRonda);
  const maxVetor = incl.reduce((m, v) => Math.max(m, Number(v.nivel) || 0), NIVEL.BAIXO);
  const travas = incl.filter((v) => v.travaTipo === "panicoFixoInoperante" || v.travaTipo === "perimetroTotal30d");
  let nivel = Math.max(matrizNivel, avaliacao.nivel, maxVetor, travas.length ? NIVEL.CRITICO : NIVEL.BAIXO);
  if (nivel < NIVEL.BAIXO) nivel = NIVEL.BAIXO;

  // "Por quê": vetor de maior classe; empate → maior nível, depois maior aging.
  const ordenados = incl.filter((v) => (v.nivel || 0) >= NIVEL.MODERADO || v.bloqueadorCaido)
    .sort((a, b) => rankClasse(b.classeV2) - rankClasse(a.classeV2) || (b.nivel || 0) - (a.nivel || 0) || (b.piorDias || 0) - (a.piorDias || 0));
  const determinante = ordenados[0] || null;

  // Memória de cálculo em soma
  const linhas = [];
  const fonte = dataTeste ? `teste semanal de ${dataTeste}` : "teste semanal";
  const ehZonaPerimetro = (v) => !!v.zonaCanonica && /perimetro/.test(String(v.barreiraFisica || ""));
  ordenados.forEach((v) => {
    const pendsCat = pend.filter((p) => norm(p.catLabel) === norm(v.label));
    let fato;
    // Zonas perimetrais da mesma categoria viram UMA linha (Z04, Z07, Z06…)
    if (ehZonaPerimetro(v)) {
      const existente = linhas.find((l) => l.label === v.label && l.zonas);
      const zonaTxt = `${nomeItem(v)}${v.piorDias != null ? ` (${v.piorDias} d)` : ""}${/parcial/i.test(v.sinceTxt || "") ? " parcial" : ""}`;
      if (existente) {
        existente.zonas.push(zonaTxt);
        existente.fato = `Perímetro — ${existente.zonas.join(", ")} ${existente.zonas.length > 1 ? "indisponíveis" : "indisponível"} (${existente.zonas.length} de ${v.total || "?"} zonas)`;
        existente.nivel = Math.max(existente.nivel, v.nivel); existente.nivelLabel = NIVEL_LABEL[existente.nivel];
        return;
      }
      linhas.push({ ordem: linhas.length + 1, label: v.label, zonas: [zonaTxt],
        fato: `Perímetro — ${zonaTxt} indisponível (1 de ${v.total || "?"} zonas)`,
        regra: v.regraV2 || (v.travaTipo ? "trava de site" : "zona perimetral inoperante"),
        nivel: v.nivel, nivelLabel: NIVEL_LABEL[v.nivel] || "", classe: v.classeV2 || "Bloqueador", fonte, determinante: v === determinante });
      return;
    }
    if (v.viasTransponiveis?.length) {
      fato = `${rotuloCat(v.label)} — ${v.viasTransponiveis.map((x) => `${x.item}${x.dias != null ? ` (${x.dias} d)` : ""}`).join(", ")} ${v.viasTransponiveis.length > 1 ? "inoperantes" : "inoperante"}`;
    } else if (v.cftvGraduado) {
      const maior = pendsCat.reduce((m, p) => Math.max(m, p.dias || 0), v.piorDias || 0);
      fato = `CFTV — ${v.inop} de ${v.total} câmeras inoperantes${maior ? ` (até ${maior} d)` : ""}`;
    } else {
      const extras = (v.qtd || 1) > 1 ? ` e mais ${v.qtd - 1}` : "";
      fato = `${rotuloCat(v.label)} — ${nomeItem(v)}${extras}${v.piorDias != null ? ` (${v.piorDias} d)` : ""}${v.inop != null && v.total ? ` · ${v.inop} de ${v.total}` : ""}`;
    }
    const regra = v.regraV2 || (v.travaTipo ? "trava de site"
      : `${v.classeV2 || "vetor"}${v.piorDias != null ? `, ${v.piorDias} d em aberto` : ""} → ${NIVEL_LABEL[v.nivel] || ""} (teto da classe)`);
    linhas.push({ ordem: linhas.length + 1, label: v.label, fato, regra, nivel: v.nivel, nivelLabel: NIVEL_LABEL[v.nivel] || "", classe: v.classeV2 || "", fonte, determinante: v === determinante });
  });
  const semAgravante = [];
  ajustados.filter((v) => !ordenados.includes(v) && v.grupo === "teste").forEach((v) => {
    const motivo = v.semAgravanteV2 || v.regraV2 === "barreira segue bloqueando"
      ? (semAgravantePorCat.get(norm(v.label)) || []).map((s) => `${s.item} ${s.motivo}`).join("; ") || v.regraV2
      : v.observacaoManutencao ? "manutenção, sem impacto na classificação"
      : `${v.classeV2 || "vetor"} ${NIVEL_LABEL[v.nivel] || ""} — abaixo do piso de agravante`;
    semAgravante.push({ item: `${rotuloCat(v.label)}${v.inop != null && v.total ? ` ${v.total - v.inop}/${v.total}` : ""}`, motivo });
  });
  const resumoDeterminante = determinante
    ? `${determinante.classeV2 ? determinante.classeV2.toLowerCase() : "vetor"}${determinante.viasTransponiveis ? `, ${determinante.viasTransponiveis.length} via${determinante.viasTransponiveis.length > 1 ? "s" : ""}` : ""}${determinante.travaTipo ? ", trava de site" : ""}: ${rotuloCat(determinante.label)}`
    : "nenhum vetor determinante";
  const resultado = `= ${NIVEL_LABEL[nivel]} (vetor determinante: ${resumoDeterminante})`;

  const motivo = determinante
    ? (determinante.viasTransponiveis
        ? `${descreverVias(determinante.viasTransponiveis)} (${rotuloCat(determinante.label).toLowerCase()})`
        : determinante.travaTipo === "panicoFixoInoperante" ? "pânico fixo sem comunicação (trava de site)"
        : matrizNivel === nivel && matriz?.motivo ? matriz.motivo
        : `${(determinante.classeV2 || "vetor").toLowerCase()} ${rotuloCat(determinante.label).toLowerCase()} em ${NIVEL_LABEL[determinante.nivel]}`)
    : (matriz?.motivo || "somente observações/manutenção");

  return {
    vetores: ajustados, nivel, label: NIVEL_LABEL[nivel], motivo, determinante, vias: avaliacao,
    memoria: { linhas, semAgravante, resultado, fonte, matrizMotivo: matriz?.motivo || null, matrizNivel },
  };
}

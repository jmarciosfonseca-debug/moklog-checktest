// Cruzamento Diagnóstico Situacional × Análise de Risco. Módulo puro (sem Firestore, sem DOM).
// SÓ roda quando a fonte "Diagnóstico Situacional" é marcada na geração da Análise de Risco;
// sem a marca, o motor segue exatamente como estava.
//
// Regra (decisão do Marcio, 12/10/2026): o diagnóstico SÓ SOBE o nível, nunca baixa, e a conta aparece no documento.
//   1. Barreiras de bloqueio (cancela de alta segurança, eclusa, bollards, dilacerador, muro/gradil/portões)
//      marcadas "não conforme" ou "ausente necessário" = via transponível:
//      1 via → piso ELEVADO · 2 ou mais → piso CRÍTICO (mesma doutrina v2 do teste semanal).
//   2. Demais itens CRÍTICOS do catálogo não conformes ou ausentes (CCO, CFTV, energia, emergência, pânico, equipe...):
//      1 ou 2 → piso MODERADO · 3 ou mais → piso ELEVADO.
//   3. "Parcial" e "sem dado" não elevam; aparecem listados (agravante qualitativo / levantamento pendente).
//   4. Nível final = o maior entre o nível calculado pelos testes e o piso do diagnóstico.
// Os limiares ficam nas constantes abaixo, num só lugar, para ajuste futuro.
import { NIVEL, NIVEL_LABEL } from "../riscoConfig";
import { padraoMokedDoItem } from "./padraoMokedItens";

export const BARREIRAS_DE_BLOQUEIO = {
  "D01.03.02": "Cancela de alta segurança",
  "D01.03.07": "Eclusa de veículos e pessoas",
  "D01.03.03": "Bollards",
  "D01.03.04": "Dilaceradores",
  "D03.01.01": "Muro, gradil e portões",
};
export const LIMIARES = { viasCritico: 2, criticosElevado: 3 };

const FALHAS = ["nao_conforme", "ausente_necessario"];
const STATUS_TXT = { nao_conforme: "não conforme", ausente_necessario: "ausente", parcial: "parcial", sem_dado: "sem dado" };
const texto = (v) => String(v ?? "").trim();

export function avaliarDiagnosticoParaRisco({ respostas = {}, itens = [], nivelBase = NIVEL.BAIXO, meta = {} } = {}) {
  const ativos = itens.filter((i) => i && i.deprecado !== true);
  const porId = Object.fromEntries(ativos.map((i) => [i.id, i]));
  const reg = (id) => ({ id, texto: porId[id]?.texto || BARREIRAS_DE_BLOQUEIO[id] || id, criticidade: porId[id]?.criticidade || "informativo", resposta: respostas[id] || {} });

  const vias = Object.keys(BARREIRAS_DE_BLOQUEIO)
    .filter((id) => porId[id] && FALHAS.includes(respostas[id]?.status))
    .map((id) => ({ ...reg(id), status: respostas[id].status }));
  const criticosFalhos = ativos
    .filter((i) => i.criticidade === "critico" && !BARREIRAS_DE_BLOQUEIO[i.id] && FALHAS.includes(respostas[i.id]?.status))
    .map((i) => ({ ...reg(i.id), status: respostas[i.id].status }));
  const criticosParciais = ativos.filter((i) => i.criticidade === "critico" && respostas[i.id]?.status === "parcial").map((i) => ({ ...reg(i.id), status: "parcial" }));
  const criticosSemDado = ativos.filter((i) => i.criticidade === "critico" && respostas[i.id]?.status === "sem_dado").map((i) => ({ ...reg(i.id), status: "sem_dado" }));

  const linhas = [];
  let pisoVias = NIVEL.BAIXO;
  if (vias.length) {
    pisoVias = vias.length >= LIMIARES.viasCritico ? NIVEL.CRITICO : NIVEL.ELEVADO;
    linhas.push({
      fato: `Diagnóstico — ${vias.map((v) => `${v.texto} (${STATUS_TXT[v.status]})`).join(", ")}`,
      regra: `${vias.length} via${vias.length > 1 ? "s" : ""} de bloqueio transponíve${vias.length > 1 ? "is" : "l"} → piso ${NIVEL_LABEL[pisoVias]}`,
      nivel: pisoVias, nivelLabel: NIVEL_LABEL[pisoVias], classe: "Bloqueador", fonte: "Diagnóstico Situacional", diagnostico: true,
    });
  }
  let pisoCriticos = NIVEL.BAIXO;
  if (criticosFalhos.length) {
    pisoCriticos = criticosFalhos.length >= LIMIARES.criticosElevado ? NIVEL.ELEVADO : NIVEL.MODERADO;
    linhas.push({
      fato: `Diagnóstico — ${criticosFalhos.length} item(ns) crítico(s) não conforme(s) ou ausente(s): ${criticosFalhos.slice(0, 4).map((c) => c.texto).join("; ")}${criticosFalhos.length > 4 ? "; …" : ""}`,
      regra: `${criticosFalhos.length} crítico(s) fora do padrão → piso ${NIVEL_LABEL[pisoCriticos]}`,
      nivel: pisoCriticos, nivelLabel: NIVEL_LABEL[pisoCriticos], classe: "Tático", fonte: "Diagnóstico Situacional", diagnostico: true,
    });
  }
  const nivelPiso = Math.max(pisoVias, pisoCriticos);
  const nivelFinal = Math.max(Number(nivelBase) || NIVEL.BAIXO, nivelPiso);
  const subiu = nivelFinal > (Number(nivelBase) || NIVEL.BAIXO);
  linhas.forEach((l) => { l.determinante = subiu && l.nivel === nivelFinal; });
  if (subiu && linhas.length && !linhas.some((l) => l.determinante)) linhas[0].determinante = true;

  const motivo = subiu
    ? (pisoVias >= pisoCriticos && vias.length
      ? `Diagnóstico Situacional: ${vias.length} via${vias.length > 1 ? "s" : ""} de bloqueio transponíve${vias.length > 1 ? "is" : "l"} (${vias.map((v) => v.texto.toLowerCase()).join(", ")})`
      : `Diagnóstico Situacional: ${criticosFalhos.length} item(ns) crítico(s) fora do padrão`)
    : "";

  const recomendacoes = ativos
    .filter((i) => ["nao_conforme", "ausente_necessario", "parcial"].includes(respostas[i.id]?.status) && (i.criticidade === "critico" || FALHAS.includes(respostas[i.id]?.status) || BARREIRAS_DE_BLOQUEIO[i.id]))
    .map((i) => ({ id: i.id, texto: i.texto, criticidade: i.criticidade || "informativo", status: respostas[i.id].status, situacao: texto(respostas[i.id].situacao), impacto: texto(respostas[i.id].impacto), indicacao: texto(respostas[i.id].indicacao), padrao: padraoMokedDoItem(i.id), eleva: vias.some((v) => v.id === i.id) || criticosFalhos.some((c) => c.id === i.id) }))
    .sort((a, b) => Number(b.eleva) - Number(a.eleva) || (FALHAS.includes(b.status) ? 1 : 0) - (FALHAS.includes(a.status) ? 1 : 0) || String(a.id).localeCompare(String(b.id)));

  const semAgravante = [];
  if (criticosParciais.length) semAgravante.push({ item: `${criticosParciais.length} crítico(s) parcial(is): ${criticosParciais.map((c) => c.texto).join("; ")}`, motivo: "parcial não eleva o nível; segue como agravante qualitativo" });
  if (criticosSemDado.length) semAgravante.push({ item: `${criticosSemDado.length} crítico(s) sem dado: ${criticosSemDado.map((c) => c.texto).join("; ")}`, motivo: "sem dado não conta como avaliado; levantar informação" });

  return {
    ok: true, ...meta, nivelBase: Number(nivelBase) || NIVEL.BAIXO, nivelPiso, nivelFinal, subiu,
    labelBase: NIVEL_LABEL[Number(nivelBase) || NIVEL.BAIXO], labelFinal: NIVEL_LABEL[nivelFinal],
    vias, criticosFalhos, criticosParciais, criticosSemDado, linhas, motivo, recomendacoes, semAgravante,
    resultado: subiu
      ? `${NIVEL_LABEL[nivelFinal]} — o Diagnóstico Situacional elevou a classificação de ${NIVEL_LABEL[Number(nivelBase) || NIVEL.BAIXO]} para ${NIVEL_LABEL[nivelFinal]} (${motivo.replace(/^Diagnóstico Situacional: /, "")})`
      : `${NIVEL_LABEL[nivelFinal]} — o Diagnóstico Situacional foi considerado e não alterou a classificação`,
  };
}

// Aplica a avaliação sobre a memória de cálculo do motor v2 (soma de fatos → resultado). Não muta a entrada.
export function aplicarDiagnosticoNaMemoria(memoria, av) {
  if (!memoria || !av || !av.ok) return memoria;
  const base = (memoria.linhas || []).map((l) => (av.subiu ? { ...l, determinante: false } : l));
  const linhas = (av.subiu ? [...av.linhas, ...base] : [...base, ...av.linhas]).map((l, i) => ({ ...l, ordem: i + 1 }));
  const semAgravante = [...(memoria.semAgravante || []), ...av.semAgravante];
  return { ...memoria, linhas, semAgravante, resultado: `= ${av.resultado}` };
}

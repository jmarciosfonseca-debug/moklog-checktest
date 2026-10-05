// Tradução consultiva dos vetores já classificados pelo motor.
// Este módulo NÃO calcula nem altera a classe geral: apenas consolida as
// evidências presentes no relatório e descreve exposição/impacto de negócio.

const PESO_ORDEM = { BLOQUEADOR: 4, TATICO: 3, SOMA: 2, REGISTRA: 1 };
const PESO_LABEL = { BLOQUEADOR: "BLOQUEADOR", TATICO: "TÁTICO", SOMA: "SOMA", REGISTRA: "REGISTRA" };

const normalizar = (valor) => String(valor || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase();

const percentual = (inop, total) => total > 0 ? Math.round((inop / total) * 100) : null;

function familiaDoVetor(vetor = {}) {
  const texto = normalizar(`${vetor.label} ${vetor.chave} ${vetor.grupo} ${vetor.barreiraFisica}`);
  // Energia e equipe permanecem como dados informativos do laudo, mas não
  // integram a matriz de risco físico.
  if (/energia/.test(texto) || /equipe|lider|brigada|reciclagem/.test(texto)) return null;
  if (vetor.camadaPerimetral === "primaria" || /alpha sense/.test(texto)) return "PERIMETRO_PRIMARIO";
  if (vetor.camadaPerimetral === "secundaria" || /cerca eletrica/.test(texto)) return "PERIMETRO_SECUNDARIO";
  if (/perimetr|cerca|sensor ir|fibra/.test(texto)) return "PERIMETRO";
  if (/ctmk|central de camera/.test(texto)) return "CTMK";
  if (/ronda virtual/.test(texto)) return "RONDA_VIRTUAL";
  if (/cftv|camera|dvr|nvr/.test(texto)) return "CFTV";
  if (/bollard|bolard|dilacerador|garra/.test(texto)) return "BARREIRA_VEICULAR";
  if (/cancela|portao|eclusa veicular/.test(texto)) return "CANCELA";
  if (/panico/.test(texto)) return "PANICO";
  if (/ilumin/.test(texto)) return "ILUMINACAO";
  if (/catraca|leitor|qr|controle de acesso|torniquete/.test(texto)) return "CONTROLE_ACESSO";
  return null;
}

function pesoDoVetor(vetor, familia) {
  if (vetor.reclassificadoComposto) return "TATICO";
  if (vetor.bloqueadorCaido || ["PERIMETRO", "PERIMETRO_PRIMARIO", "BARREIRA_VEICULAR", "CANCELA", "PANICO"].includes(familia)) return "BLOQUEADOR";
  if (["CFTV", "CTMK", "RONDA_VIRTUAL"].includes(familia) || vetor.contribuicao === "tatico") return "TATICO";
  if (["ILUMINACAO", "CONTROLE_ACESSO", "ENERGIA"].includes(familia)) return "SOMA";
  return "REGISTRA";
}

function faixaDaFamilia(familia, inop, total, vetores) {
  const pct = percentual(inop, total);
  if (familia === "PERIMETRO_PRIMARIO") return inop >= 2 ? "MULTIPLA" : "UNITARIA";
  if (familia === "PERIMETRO_SECUNDARIO") return total > 0 && inop >= total ? "TOTAL" : "PARCIAL";
  if (familia === "PERIMETRO") {
    if (vetores.some((v) => v.travaTipo === "perimetroTotal30d")) return "TOTAL";
    return inop >= 2 ? "MULTIPLA" : "UNITARIA";
  }
  if (familia === "CFTV") return pct == null ? (inop > 5 ? "MEDIA" : "BAIXA") : pct > 40 ? "ALTA" : pct >= 20 ? "MEDIA" : "BAIXA";
  if (["BARREIRA_VEICULAR", "CANCELA"].includes(familia)) return inop >= 2 || (pct != null && pct >= 50) ? "OPERACIONAL" : "PARCIAL";
  if (familia === "ILUMINACAO") return pct != null && pct >= 50 ? "ALTA" : "PARCIAL";
  return "UNICA";
}

const TEXTOS = {
  PERIMETRO_PRIMARIO: {
    UNITARIA: {
      titulo: "Alpha Sense — barreira perimetral primária",
      exposicao: "Uma zona indisponível reduz a continuidade da detecção antecipada no trecho correspondente da primeira linha eletrônica de defesa.",
      consequencia: "A condição pode ampliar a possibilidade de aproximação ou tentativa de intrusão sem alerta no tempo esperado e reduzir a janela de reação da equipe.",
      impacto: "Exige validação imediata da cobertura do trecho, vigilância compensatória e restabelecimento prioritário da zona primária.",
    },
    MULTIPLA: {
      titulo: "Alpha Sense — perda ampliada da barreira primária",
      exposicao: "Duas ou mais zonas indisponíveis ampliam a extensão perimetral sem a detecção antecipada prevista para a camada principal.",
      consequencia: "A perda pode elevar de forma relevante a possibilidade de tentativa de intrusão bem-sucedida e reduzir a capacidade de localizar, confirmar e conter a aproximação.",
      impacto: "Requer resposta emergencial, cobertura humana ou eletrônica provisória dos trechos e recuperação das zonas antes da normalização operacional.",
    },
  },
  PERIMETRO_SECUNDARIO: {
    PARCIAL: {
      titulo: "Cerca elétrica — perda parcial de redundância",
      exposicao: "A camada Alpha Sense permanece íntegra, mas a falha parcial da cerca reduz a redundância disponível no trecho afetado.",
      consequencia: "A condição pode diminuir a capacidade de confirmação e contenção caso a barreira primária também venha a perder cobertura no mesmo setor.",
      impacto: "Permite correção programada com acompanhamento, preservando a prioridade de manter a camada primária testada e integralmente operante.",
    },
    TOTAL: {
      titulo: "Cerca elétrica — redundância perimetral indisponível",
      exposicao: "A camada Alpha Sense permanece ativa, porém a indisponibilidade integral da cerca elimina a segunda camada eletrônica de proteção.",
      consequencia: "A perda pode reduzir a capacidade de confirmação e contenção diante de uma falha subsequente ou tentativa concentrada sobre a barreira primária.",
      impacto: "Exige recuperação prioritária da redundância e medida compensatória até o retorno integral da cerca elétrica.",
    },
  },
  PERIMETRO: {
    UNITARIA: {
      titulo: "Perímetro eletrônico — brecha localizada",
      exposicao: "Uma zona inoperante cria um trecho sem a detecção eletrônica prevista na primeira linha de defesa.",
      consequencia: "A brecha pode elevar a possibilidade de tentativa de intrusão com êxito, reduzir o alerta prévio e encurtar o tempo disponível para pronta-resposta.",
      impacto: "Requer proteção compensatória do trecho e manutenção prioritária, com teste de restabelecimento documentado.",
    },
    MULTIPLA: {
      titulo: "Perímetro eletrônico — exposição ampliada",
      exposicao: "Duas ou mais zonas inoperantes ampliam a extensão sem detecção e caracterizam perda relevante da primeira linha de defesa.",
      consequencia: "O quadro pode elevar de forma significativa a possibilidade de intrusão bem-sucedida, dificultar a identificação do ponto de entrada e reduzir a capacidade de contenção.",
      impacto: "Exige resposta imediata, cobertura compensatória contínua e recuperação coordenada das zonas determinantes.",
    },
    TOTAL: {
      titulo: "Perímetro eletrônico — camada indisponível",
      exposicao: "A indisponibilidade total retira a capacidade eletrônica prevista para detectar a aproximação em toda a barreira monitorada.",
      consequencia: "A condição pode comprometer a detecção prévia de intrusão e tornar a resposta dependente de vigilância humana, observação por imagem ou aviso posterior.",
      impacto: "Demanda contingência imediata e restabelecimento emergencial, com validação técnica completa antes do encerramento.",
    },
  },
  CFTV: {
    BAIXA: {
      titulo: "CFTV — perda localizada de visibilidade",
      exposicao: "A indisponibilidade está concentrada em parte limitada do parque, mantendo cobertura predominante nas demais áreas.",
      consequencia: "Os pontos afetados podem reduzir a detecção de eventos em curso e comprometer evidências de intrusão, acidente, avaria, conluio interno ou rota de evasão.",
      impacto: "Requer priorização por criticidade de cena e validação de sobreposição de imagens até a recuperação.",
    },
    MEDIA: {
      titulo: "CFTV — cobertura parcialmente comprometida",
      exposicao: "A parcela indisponível cria lacunas relevantes de acompanhamento e reduz a continuidade visual entre áreas do ativo.",
      consequencia: "O quadro pode dificultar a detecção e o acompanhamento de ocorrências e comprometer a reconstrução de evidências para auditoria, sinistro, contrato ou perícia.",
      impacto: "Exige plano de recuperação priorizado, rondas compensatórias e confirmação das áreas críticas ainda cobertas.",
    },
    ALTA: {
      titulo: "CFTV — perda extensa de consciência situacional",
      exposicao: "A indisponibilidade superior a 40% reduz substancialmente a capacidade de acompanhar o ativo e correlacionar eventos entre setores.",
      consequencia: "A condição pode deixar a operação sem visibilidade suficiente durante intrusão, acidente ou evasão e comprometer de modo relevante a preservação de evidências.",
      impacto: "Demanda contingência imediata, reforço de vigilância e recuperação técnica por ordem de criticidade operacional.",
    },
  },
  BARREIRA_VEICULAR: {
    PARCIAL: {
      titulo: "Barreira veicular — redundância reduzida",
      exposicao: "A falha parcial reduz a capacidade física disponível para bloquear passagem forçada, invasão ou evasão por veículo.",
      consequencia: "A condição pode ampliar a possibilidade de transposição do acesso e reduzir a capacidade de retenção até a intervenção da equipe.",
      impacto: "Requer controle compensatório do acesso e reparo prioritário, preservando os dispositivos remanescentes em posição operacional.",
    },
    OPERACIONAL: {
      titulo: "Barreira veicular — contenção comprometida",
      exposicao: "A proporção indisponível compromete a função do conjunto destinado a impedir transposição veicular não autorizada.",
      consequencia: "O quadro pode elevar a possibilidade de invasão ou evasão por veículo e reduzir a capacidade de conter o evento sem exposição direta da equipe.",
      impacto: "Exige contingência imediata no acesso, reforço de pessoal e recuperação do conjunto de bloqueio.",
    },
  },
  CANCELA: {
    PARCIAL: {
      titulo: "Cancelas — margem operacional reduzida",
      exposicao: "Uma unidade indisponível reduz a redundância do fluxo, embora o conjunto ainda preserve capacidade parcial de controle.",
      consequencia: "Uma nova indisponibilidade pode comprometer a segregação dos acessos, ampliar filas e aumentar a dependência de intervenção manual.",
      impacto: "Requer manutenção programada e plano de contingência pronto, sem retirar desnecessariamente a equipe das rondas.",
    },
    OPERACIONAL: {
      titulo: "Cancelas — controle veicular degradado",
      exposicao: "Duas ou mais unidades indisponíveis reduzem materialmente a capacidade de ordenar e segregar entrada e saída.",
      consequencia: "A condição pode exigir controle manual, ampliar a possibilidade de passagem não autorizada e deslocar vigilantes de rondas ou postos críticos.",
      impacto: "Demanda reforço temporário do acesso e recuperação prioritária do conjunto.",
    },
  },
  PANICO: {
    UNICA: {
      titulo: "Pânico fixo — comunicação de emergência",
      exposicao: "A indisponibilidade retira do posto um canal dedicado de acionamento silencioso em situação de ameaça.",
      consequencia: "A falha pode atrasar o pedido de apoio, reduzir a capacidade de resposta coordenada e ampliar a exposição do colaborador durante uma crise.",
      impacto: "Exige meio alternativo formalmente testado e restabelecimento prioritário do dispositivo fixo.",
    },
  },
  CTMK: {
    UNICA: {
      titulo: "CTMK — monitoramento central indisponível",
      exposicao: "A central sem imagem reduz a visão de contexto e a capacidade de confirmação remota do evento.",
      consequencia: "A condição pode atrasar a detecção e a escalada de resposta e comprometer o acompanhamento e a preservação de evidências durante incidentes.",
      impacto: "Requer canal compensatório de monitoramento e recuperação prioritária da comunicação e das imagens.",
    },
  },
  ILUMINACAO: {
    PARCIAL: {
      titulo: "Iluminação — degradação de apoio",
      exposicao: "Pontos deficientes reduzem a visibilidade do quadrante e a qualidade das imagens no período noturno.",
      consequencia: "A condição pode ampliar áreas de sombra, dificultar a percepção de aproximação e reduzir a capacidade de registrar detalhes relevantes pelo CFTV.",
      impacto: "Requer correção do setor e validação noturna conjunta com as câmeras que cobrem a área.",
    },
    ALTA: {
      titulo: "Iluminação — quadrante severamente degradado",
      exposicao: "A deficiência igual ou superior à metade dos pontos reduz de forma relevante a visibilidade e a dissuasão no quadrante.",
      consequencia: "O quadro pode ampliar pontos de sombra, favorecer aproximação menos observada e comprometer a qualidade das evidências de imagem.",
      impacto: "Exige recuperação prioritária do quadrante e medida compensatória de vigilância no período noturno.",
    },
  },
  CONTROLE_ACESSO: {
    UNICA: {
      titulo: "Controle de acesso — rastreabilidade reduzida",
      exposicao: "A falha em leitor, catraca ou torniquete reduz a validação individual e o registro de circulação no ponto afetado.",
      consequencia: "A condição pode ampliar a possibilidade de passagem por aproveitamento, dificultar saber quem permanece no ativo e comprometer conferências em evacuação ou incidente.",
      impacto: "Requer procedimento manual rastreável e recuperação do dispositivo sem desorganizar a troca de turno.",
    },
  },
  ENERGIA: {
    UNICA: {
      titulo: "Energia — dependência sistêmica",
      exposicao: "A instabilidade de fornecimento pode atingir simultaneamente CFTV, controle de acesso, iluminação e comunicação.",
      consequencia: "Uma nova interrupção pode reduzir várias camadas de proteção ao mesmo tempo e ampliar a dependência da autonomia elétrica e da resposta manual.",
      impacto: "Requer validação de autonomia, contingência e estabilidade do fornecimento antes de encerrar o apontamento.",
    },
  },
  RONDA_VIRTUAL: {
    UNICA: {
      titulo: "Ronda virtual — cobertura de verificação",
      exposicao: "Execuções não realizadas ou não justificadas reduzem a continuidade da verificação remota planejada.",
      consequencia: "A lacuna pode retardar a identificação de anomalias entre ciclos e comprometer a rastreabilidade da rotina de monitoramento.",
      impacto: "Requer regularização da execução e das justificativas, preservando os horários e pontos críticos.",
    },
  },
  EQUIPE: {
    UNICA: {
      titulo: "Equipe e liderança — prontidão operacional",
      exposicao: "A lacuna de liderança, cobertura ou capacitação reduz a prontidão da resposta primária no turno.",
      consequencia: "A condição pode atrasar decisões, dificultar coordenação em emergência e comprometer requisitos internos, contratuais ou de seguro.",
      impacto: "Requer cobertura formal, atribuições claras e regularização documental ou de treinamento.",
    },
  },
};

function prioridade(peso, nivel, observacao) {
  if (peso === "BLOQUEADOR" && nivel >= 4) return "IMEDIATA";
  if (peso === "BLOQUEADOR" || nivel >= 3) return "ALTA";
  if (observacao) return "PROGRAMADA";
  return nivel >= 2 ? "PRIORITÁRIA" : "ACOMPANHAR";
}

function medidaDoGrupo(familia, vetores, inop, total) {
  const pct = percentual(inop, total);
  if (total > 0) return `${inop} de ${total} indisponíveis${pct != null ? ` · ${pct}%` : ""}`;
  if (["PERIMETRO", "PERIMETRO_PRIMARIO", "PERIMETRO_SECUNDARIO"].includes(familia)) return `${inop} zona(s) identificada(s)`;
  return `${inop || vetores.length} ocorrência(s) consolidada(s)`;
}

export function gerarImpactosOperacionais({ vetores = [], geral = {} } = {}) {
  // A matriz explica somente os vetores que sustentam uma elevação da classe.
  // Se o motor concluiu BAIXO, itens residuais de manutenção não podem reaparecer
  // como "bloqueadores" no laudo e contradizer selo, memória e somatório.
  if (Number(geral.nivel) === 1) return [];

  const grupos = new Map();
  const metricas = geral.metricas || {};
  for (const vetor of vetores) {
    const familia = familiaDoVetor(vetor);
    if (!familia) continue;
    const presenteNaMemoria = (
      (familia === "CFTV" && Number(metricas.cftvInoperante) > 0)
      || (familia === "PERIMETRO" && Number(metricas.zonasNomeadas) > 0)
      || (familia === "PERIMETRO_PRIMARIO" && Number(metricas.alphaSenseInoperante) > 0)
      || (familia === "PERIMETRO_SECUNDARIO" && Number(metricas.cercaEletricaInoperante) > 0)
      || (familia === "BARREIRA_VEICULAR" && Number(metricas.barreirasCriticas) > 0)
    );
    const determinante = vetor.bloqueadorCaido || (vetor.nivel || 0) >= 2
      || presenteNaMemoria
      || (familia === "PERIMETRO_SECUNDARIO" && vetor.observacaoManutencao);
    if (!determinante) continue;
    if (!grupos.has(familia)) grupos.set(familia, []);
    grupos.get(familia).push(vetor);
  }

  const cards = [];
  for (const [familia, itens] of grupos) {
    const primeiro = itens[0];
    let inop = itens.reduce((s, v) => s + (Number(v.inop) || 0), 0);
    let total = Math.max(...itens.map((v) => Number(v.total) || 0), 0);
    if (!inop) inop = itens.length;
    if (familia === "CFTV" && metricas.cftvInoperante) inop = Number(metricas.cftvInoperante);
    if (familia === "PERIMETRO_PRIMARIO" && metricas.alphaSenseInoperante != null) inop = Number(metricas.alphaSenseInoperante);
    if (familia === "PERIMETRO_SECUNDARIO" && metricas.cercaEletricaInoperante != null) inop = Number(metricas.cercaEletricaInoperante);
    // Reconciliação com a memória de cálculo (auditoria 04/10/2026, caso P607): o perímetro é contado por ZONA FÍSICA
    // distinta (metricas.zonasNomeadas, a mesma contagem da memória). Pontos da ronda sem zona identificada aparecem
    // à parte — não se afirma que sejam uma zona a mais. Só texto do relatório: a classificação não usa esta função.
    let complemento = "";
    if (familia === "PERIMETRO" && Number(metricas.zonasNomeadas) > 0) {
      const semZona = itens.filter((v) => v.pendenciaCadastro === true || v.zonaCanonica === "perimetro-sem-cadastro");
      const nomeados = itens.filter((v) => !semZona.includes(v));
      inop = Number(metricas.zonasNomeadas);
      total = Math.max(...nomeados.map((v) => Number(v.total) || 0), 0);
      const nSem = semZona.reduce((s, v) => s + (Number(v.inop) || 1), 0);
      if (nSem) complemento += ` · mais ${nSem} ponto(s) da ronda sem identificação de zona`;
    }
    const parciais = itens.reduce((s, v) => s + (Number(v.parciais) || 0), 0);
    if (total > 0) inop = Math.min(inop, total);
    const faixa = faixaDaFamilia(familia, inop, total, itens);
    const texto = TEXTOS[familia]?.[faixa] || TEXTOS[familia]?.UNICA;
    if (!texto) continue;
    const peso = itens.map((v) => pesoDoVetor(v, familia)).sort((a, b) => PESO_ORDEM[b] - PESO_ORDEM[a])[0];
    const nivel = Math.max(...itens.map((v) => Number(v.nivel) || 1));
    cards.push({
      familia,
      faixa,
      peso,
      pesoLabel: PESO_LABEL[peso],
      nivel,
      medida: `${medidaDoGrupo(familia, itens, inop, total)}${parciais ? ` (inclui ${parciais} parcial(is), tratado(s) como indisponível(is))` : ""}${complemento}`,
      prioridade: prioridade(peso, nivel, itens.every((v) => v.observacaoManutencao)),
      fontes: [...new Set(itens.map((v) => v.fonteCredito).filter(Boolean))].join(" · "),
      ...texto,
    });
  }

  return cards
    .sort((a, b) => PESO_ORDEM[b.peso] - PESO_ORDEM[a.peso] || b.nivel - a.nivel)
    .slice(0, 4);
}

export { TEXTOS as RISCO_IMPACTO_TEXTOS };

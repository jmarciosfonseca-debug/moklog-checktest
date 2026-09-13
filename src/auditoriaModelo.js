// ─────────────────────────────────────────────────────────────
// auditoriaModelo.js — Matriz OPERACIONAL MOKED (piloto P311A).
//
// NÃO é o PEC. É um modelo operacional baseado nos módulos que o
// app já tem. O PEC poderá virar um modelo configurável na Fase
// futura. Sem itens financeiros/documentais.
//
// Cada requisito aponta para um conector (módulo de origem) e uma
// prioridade. A situação vem do conector (nunca "ok" por ausência).
// ─────────────────────────────────────────────────────────────

// Prioridade: "critica" | "alta" | "media" | "baixa"
export const MATRIZ_MOKED_P311A = [
  {
    id: "cftv-retencao",
    requisito: "CFTV com retenção de gravação ≥ 30 dias por câmera",
    modulo: "CFTV / Tempo de Gravação",
    conector: "cftv",
    prioridade: "critica",
    acaoSeNaoConforme: "Ajustar retenção das câmeras abaixo de 30 dias junto à manutenção do NVR.",
  },
  {
    id: "teste-semanal",
    requisito: "Teste semanal de dispositivos executado e sem itens em aberto",
    modulo: "Teste Semanal",
    conector: "testeSemanal",
    prioridade: "alta",
    acaoSeNaoConforme: "Concluir a checagem semanal e tratar os itens em aberto.",
  },
  {
    id: "equipamentos-operacionais",
    requisito: "Inventário de equipamentos sem itens inoperantes/críticos",
    modulo: "Equipamentos",
    conector: "equipamentos",
    prioridade: "alta",
    acaoSeNaoConforme: "Substituir/reparar os itens inoperantes; tratar as pendências mais antigas.",
  },
  {
    id: "ronda-perimetral",
    requisito: "Zonas do perímetro com status operacional testado e conforme",
    modulo: "Ronda Perimetral",
    conector: "ronda",
    prioridade: "critica",
    acaoSeNaoConforme: "Registrar teste de ronda por zona; regularizar zonas não conformes.",
  },
  {
    id: "visao-360",
    requisito: "Score de segurança (Visão 360) em nível operacional adequado",
    modulo: "Visão 360",
    conector: "visao360",
    prioridade: "media",
    acaoSeNaoConforme: "Tratar as penalidades que mais derrubam o score.",
  },
];

// Rótulos e cores das situações (para a tela e o dossiê).
export const SIT_CFG = {
  "conforme":     { label: "Conforme",     cor: "#15803d", bg: "#dcfce7" },
  "nao-conforme": { label: "Não conforme", cor: "#b91c1c", bg: "#fee2e2" },
  "parcial":      { label: "Parcial",      cor: "#b45309", bg: "#fef3c7" },
  "pendente":     { label: "Pendente",     cor: "#a16207", bg: "#fef9c3" },
  "sem-dado":     { label: "Sem dado",     cor: "#64748b", bg: "#f1f5f9" },
};

export const PRIO_CFG = {
  "critica": { label: "Crítica", cor: "#b91c1c" },
  "alta":    { label: "Alta",    cor: "#c2410c" },
  "media":   { label: "Média",   cor: "#b45309" },
  "baixa":   { label: "Baixa",   cor: "#64748b" },
};

// Consolida a matriz a partir dos resultados dos conectores.
// resultados: { cftv, testeSemanal, equipamentos, ronda, visao360 }
// Retorna { linhas[], cobertura, conformidade, vulnerabilidades[], acoes[] }.
export function consolidarMatriz(resultados) {
  const linhas = MATRIZ_MOKED_P311A.map(req => {
    const r = resultados[req.conector] || { situacao: "sem-dado", cobertura: false, resumo: "Sem dado.", origem: "—" };
    return {
      id: req.id,
      requisito: req.requisito,
      modulo: req.modulo,
      prioridade: req.prioridade,
      situacao: r.situacao,
      evidencia: r.resumo || "—",
      origem: r.origem || "—",
      data: r.data || null,
      responsavel: r.responsavel || null,
      acao: (r.situacao === "nao-conforme" || r.situacao === "parcial" || r.situacao === "pendente")
        ? req.acaoSeNaoConforme
        : (r.situacao === "sem-dado" ? "Registrar a evidência no módulo de origem." : "—"),
    };
  });

  // Cobertura de evidência: quantos requisitos TÊM dado (cobertura=true).
  const comDado = linhas.filter(l => l.situacao !== "sem-dado").length;
  const cobertura = { comDado, total: linhas.length, pct: Math.round((comDado / linhas.length) * 100) };

  // Conformidade: SÓ entre os que têm dado (nunca conta "sem-dado" como OK).
  const avaliaveis = linhas.filter(l => l.situacao !== "sem-dado");
  const conformes = avaliaveis.filter(l => l.situacao === "conforme").length;
  const conformidade = {
    conformes, avaliaveis: avaliaveis.length,
    pct: avaliaveis.length ? Math.round((conformes / avaliaveis.length) * 100) : null,
  };

  // Vulnerabilidades = não conformes + parciais, ordenadas por prioridade.
  const ordemP = { critica: 0, alta: 1, media: 2, baixa: 3 };
  const vulnerabilidades = linhas
    .filter(l => l.situacao === "nao-conforme" || l.situacao === "parcial")
    .sort((a, b) => ordemP[a.prioridade] - ordemP[b.prioridade]);

  const acoes = linhas
    .filter(l => l.acao && l.acao !== "—")
    .map(l => ({ requisito: l.requisito, acao: l.acao, prioridade: l.prioridade }));

  return { linhas, cobertura, conformidade, vulnerabilidades, acoes };
}

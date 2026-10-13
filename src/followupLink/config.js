// Link de follow-up externo — piloto P601. Manter a lista igual à de api/ai/lib/followupLink.js.
export const PILOTO_PIDS = ["P601"];
export const linkLiberado = (pid) => PILOTO_PIDS.includes(pid);

export const COM_QUEM = {
  manutencao: { label: "Com a manutenção", cor: "#b45309", fundo: "#fef3c7" },
  moked: { label: "Com a Moked", cor: "#1d4ed8", fundo: "#dbeafe" },
  administracao: { label: "Aguardando a administração", cor: "#6d28d9", fundo: "#ede9fe" },
};
export const comQuemInfo = (id) => COM_QUEM[id] || COM_QUEM.manutencao;

// Situações que a empresa de manutenção pode informar.
export const SITUACOES_MANUTENCAO = [
  { id: "aguardando", label: "Análise do técnico (sem proposta)", dica: "Verificado, ainda sem proposta. Continua com você" },
  { id: "proposta", label: "Proposta enviada", dica: "Informe o número e o valor" },
  { id: "execucao", label: "Em execução", dica: "Serviço em andamento" },
  { id: "executado", label: "Serviço executado", dica: "Concluído; a Moked confere" },
];

export const ROTULO_STATUS = {
  aguardando: "Diagnóstico / aguardando", proposta: "Proposta enviada", aprovado: "Aprovado pela administração",
  execucao: "Em execução", executado: "Serviço executado", reprovado: "Reprovado pela administração", resolvido: "Resolvido",
};

// Item que está com a manutenção e não tem retorno há muito tempo (a Moked precisa cobrar).
export const DIAS_SEM_RETORNO = 7;
export function diasSemRetorno(reg, agora = Date.now()) {
  const ultima = reg && Array.isArray(reg.entries) ? reg.entries[0] : null;
  const t = ultima && Date.parse(ultima.em);
  return Number.isFinite(t) ? Math.max(0, Math.floor((agora - t) / 86400000)) : null; // null = nunca houve retorno
}
export const semRetorno = (comQuem, reg, agora = Date.now()) => {
  if (comQuem !== "manutencao") return false;
  const d = diasSemRetorno(reg, agora);
  return d === null || d >= DIAS_SEM_RETORNO;
};

// Aviso quando a Moked precisa agir: usado nos painéis.
export function resumoPorMao(itens = []) {
  const r = { manutencao: 0, moked: 0, administracao: 0 };
  itens.forEach((i) => { r[i.comQuem in r ? i.comQuem : "manutencao"] += 1; });
  return r;
}

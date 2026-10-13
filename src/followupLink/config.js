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
  { id: "aguardando", label: "Diagnóstico / aguardando", dica: "Já verificou ou agendou a visita" },
  { id: "proposta", label: "Proposta enviada", dica: "Informe o número e o valor" },
  { id: "execucao", label: "Em execução", dica: "Serviço em andamento" },
  { id: "executado", label: "Serviço executado", dica: "Concluído; a Moked confere" },
];

export const ROTULO_STATUS = {
  aguardando: "Diagnóstico / aguardando", proposta: "Proposta enviada", aprovado: "Aprovado pela administração",
  execucao: "Em execução", executado: "Serviço executado", reprovado: "Reprovado pela administração", resolvido: "Resolvido",
};

// Aviso quando a Moked precisa agir: usado nos painéis.
export function resumoPorMao(itens = []) {
  const r = { manutencao: 0, moked: 0, administracao: 0 };
  itens.forEach((i) => { r[i.comQuem in r ? i.comQuem : "manutencao"] += 1; });
  return r;
}

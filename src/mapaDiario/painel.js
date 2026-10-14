// Mapa de Equipe diário — painel do gerencial (puro): contador "n de N" e quem não enviou.
// Recebe `agora` e a lista de mapas já lidos; não lê Firestore nem relógio global.
import { somarDias, chaveMapa, inicioDoTurno, estadoDoMapa } from "./regras";
import { HORARIOS_PROJETO, horarioDoTurno } from "./horarios";

export const PROJETOS_DO_MAPA = Object.keys(HORARIOS_PROJETO);

// Data civil de Brasília (-03:00 fixo) de um instante.
export function dataBrasilia(agora) {
  return new Date(agora.getTime() - 3 * 3600000).toISOString().slice(0, 10);
}

// Turno em vigor de um projeto: o mais recente que já começou (ontem N, hoje D, hoje N).
// Antes do primeiro início do dia, vale o noturno que começou ontem.
export function turnoVigente(projetoId, agora) {
  const hoje = dataBrasilia(agora);
  let melhor = null;
  for (const data of [somarDias(hoje, -1), hoje]) {
    for (const turno of ["D", "N"]) {
      const h = horarioDoTurno(projetoId, turno);
      if (!h) return null;
      const inicio = inicioDoTurno(data, h.inicio);
      if (inicio <= agora && (!melhor || inicio > melhor.inicio)) melhor = { data, turno, inicio };
    }
  }
  return melhor;
}

// Ocorrências que pintam a bolinha de amarelo no painel: FT, falta, atraso e troca.
export const SITUACOES_OCORRENCIA = ["falta", "ft", "atraso", "troca"];
export function contarOcorrencias(mapa) {
  return (mapa?.postos || []).filter((x) => SITUACOES_OCORRENCIA.includes(x?.situacao)).length;
}

// Brilha para o gerencial: cobrança (até 1 h) e pendente. "aguardando" e "enviado" não.
export const brilha = (estado) => estado === "cobranca" || estado === "pendente";

// mapas: [{ projetoId, data, turno, enviadoEm }] (enviadoEm só existe se foi concluído).
export function resumoDoPainel({ agora, mapas = [], projetos = PROJETOS_DO_MAPA, janelaMin = 60 }) {
  const porChave = new Map();
  for (const m of mapas) {
    try { porChave.set(chaveMapa(m.projetoId, m.data, m.turno), m); } catch (e) { /* mapa malformado é ignorado */ }
  }
  const itens = projetos.map((projetoId) => {
    const v = turnoVigente(projetoId, agora);
    if (!v) return { projetoId, estado: "sem-horario", brilha: false, enviado: false };
    const m = porChave.get(chaveMapa(projetoId, v.data, v.turno));
    const enviadoEm = m && m.enviadoEm ? new Date(m.enviadoEm) : null;
    const estado = estadoDoMapa({ inicio: v.inicio, agora, enviadoEm, janelaMin });
    return { projetoId, data: v.data, turno: v.turno, inicio: v.inicio, enviadoEm, estado, brilha: brilha(estado), enviado: estado === "enviado", ocorrencias: m?.ocorrencias || 0 };
  });
  const ordem = { pendente: 0, cobranca: 1, aguardando: 2, enviado: 3, "sem-horario": 4 };
  itens.sort((a, b) => ordem[a.estado] - ordem[b.estado] || a.projetoId.localeCompare(b.projetoId));
  return {
    enviados: itens.filter((i) => i.enviado).length,
    total: itens.length,
    pendentes: itens.filter((i) => i.estado === "pendente"),
    emCobranca: itens.filter((i) => i.estado === "cobranca"),
    brilha: itens.some((i) => i.brilha),
    itens,
  };
}

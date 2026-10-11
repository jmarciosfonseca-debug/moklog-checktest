// Mapa de Equipe diário — horários dos turnos por projeto (e por posto, quando diferem).
// Só dados e funções puras: sem tela, sem gravação.
// `confirmado:false` = horário a confirmar com o Marcio; a tela deve sinalizar (hoje todos confirmados).

const PADRAO = { D: { inicio: "06:00", fim: "18:00" }, N: { inicio: "18:00", fim: "06:00" } };

export const HORARIOS_PROJETO = {
  P260A: { turnos: PADRAO, confirmado: true },
  P260B: { turnos: PADRAO, confirmado: true },
  P260C: { turnos: PADRAO, confirmado: true },
  P311A: { turnos: PADRAO, confirmado: true },
  P311B: { turnos: PADRAO, confirmado: true },
  P505: { turnos: PADRAO, confirmado: true, postos: { Ronda: { D: { inicio: "08:00", fim: "20:00" } } } },
  P601: { turnos: PADRAO, confirmado: true, postos: { Apoio: { D: { inicio: "08:00", fim: "20:00" } } } },
  P602: { turnos: PADRAO, confirmado: true },
  P604: { turnos: PADRAO, confirmado: true },
  P605: { turnos: PADRAO, confirmado: true },
  P606: { turnos: { D: { inicio: "07:00", fim: "19:00" }, N: { inicio: "19:00", fim: "07:00" } }, confirmado: true },
  P607: { turnos: PADRAO, confirmado: true },
};

// Horário do turno do projeto; se o posto tiver horário próprio, ele prevalece.
export function horarioDoTurno(projetoId, turno, posto = null) {
  const p = HORARIOS_PROJETO[projetoId];
  if (!p || (turno !== "D" && turno !== "N")) return null;
  const proprio = posto && p.postos && p.postos[posto] && p.postos[posto][turno];
  const h = proprio || p.turnos[turno];
  return { ...h, doPosto: !!proprio, confirmado: p.confirmado };
}

// Mapa de Equipe diário — regras puras (sem Firestore, sem React, sem relógio global).
// Tudo recebe datas ISO "AAAA-MM-DD" e, quando precisa de hora, recebe `agora` explícito.
// Isto é só o motor: ainda não há tela nem gravação.

const MS_DIA = 86400000;
const mod = (n, m) => ((n % m) + m) % m;

export function ehDataISO(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s || "") && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}
function utc(s) {
  if (!ehDataISO(s)) throw new Error(`Data inválida: ${s}`);
  return Date.parse(`${s}T00:00:00Z`);
}

export function diasEntre(deISO, ateISO) {
  return Math.round((utc(ateISO) - utc(deISO)) / MS_DIA);
}
export function somarDias(iso, n) {
  return new Date(utc(iso) + n * MS_DIA).toISOString().slice(0, 10);
}
export function diaDaSemana(iso) {
  return new Date(utc(iso)).getUTCDay(); // 0 = domingo
}
const DIAS_PT = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
// O dia da semana do cabeçalho sai SEMPRE da data (nos mapas do WhatsApp ele vinha errado).
export function rotuloDia(iso) {
  return DIAS_PT[diaDaSemana(iso)];
}

// ── 12x36: duas turmas por turno, alternando dia sim, dia não ──────────────────
// `ancoraISO` é um dia em que a turma 0 trabalha. Conta por diferença de dias
// (não por dia do mês par/ímpar, que quebra na virada de mês de 31 dias).
export function turma1236(ancoraISO, dataISO) {
  return mod(diasEntre(ancoraISO, dataISO), 2);
}

// ── 4x2: grupo de 3 por posto (titular diurno, titular noturno, folguista) ─────
// Ciclo de 6 dias. `ancoraISO` = primeiro dia do bloco de trabalho do titular diurno.
//   titular D trabalha nos dias 0–3 do ciclo e folga em 4–5;
//   titular N trabalha nos dias 2–5 e folga em 0–1;
//   folguista cobre a folga do D (dias 4–5, diurno) e a do N (dias 0–1, noturno) e descansa em 2–3.
export function posicaoCiclo42(ancoraISO, dataISO) {
  return mod(diasEntre(ancoraISO, dataISO), 6);
}
export function escala42(ancoraISO, dataISO) {
  const posicao = posicaoCiclo42(ancoraISO, dataISO);
  return {
    posicao,
    D: posicao <= 3 ? "titularD" : "folguista",
    N: posicao >= 2 ? "titularN" : "folguista",
    folguistaDescansa: posicao === 2 || posicao === 3,
    titularDFolga: posicao >= 4,
    titularNFolga: posicao <= 1,
  };
}

// ── 5x2: segunda a sexta (feriado quem ajusta é o líder no mapa) ───────────────
export function trabalha52(dataISO) {
  const s = diaDaSemana(dataISO);
  return s >= 1 && s <= 5;
}

// ── Previsto do dia para um grupo de postos ────────────────────────────────────
// regra 12x36: { tipo:"12x36", ancora, turmas:[[idsTurma0],[idsTurma1]] }
// regra 4x2:   { tipo:"4x2", ancora, titularD, titularN, folguista }   (ids)
// regra 5x2:   { tipo:"5x2", pessoas:[ids] }
// turno: "D" | "N" (a regra 4x2 é a única em que o turno muda quem vem).
// Devolve ids sugeridos; quem confirma é sempre o líder. Id ausente = posto sem sugestão.
export function previstoDoGrupo(regra, dataISO, turno) {
  if (!regra) return { pessoas: [], origem: "sem-regra" };
  if (regra.tipo === "12x36") {
    const i = turma1236(regra.ancora, dataISO);
    return { pessoas: [...((regra.turmas || [])[i] || [])], origem: "12x36", turma: i };
  }
  if (regra.tipo === "4x2") {
    const e = escala42(regra.ancora, dataISO);
    const papel = turno === "N" ? e.N : e.D;
    const id = regra[papel];
    return { pessoas: id ? [id] : [], origem: "4x2", papel, posicao: e.posicao };
  }
  if (regra.tipo === "5x2") {
    return { pessoas: trabalha52(dataISO) ? [...(regra.pessoas || [])] : [], origem: "5x2" };
  }
  return { pessoas: [], origem: "sem-regra" };
}

// ── Identidade do mapa e horário do turno ──────────────────────────────────────
// Um mapa por projeto, dia de INÍCIO do plantão e turno: não existe "duas versões" do mesmo plantão.
export function chaveMapa(projetoId, dataISO, turno) {
  if (!projetoId) throw new Error("Projeto obrigatório");
  if (turno !== "D" && turno !== "N") throw new Error(`Turno inválido: ${turno}`);
  utc(dataISO);
  return `${projetoId}_${dataISO}_${turno}`;
}

// O Brasil não tem horário de verão desde 2019: -03:00 fixo (America/Sao_Paulo).
export function inicioDoTurno(dataISO, horaInicio) {
  if (!/^\d{2}:\d{2}$/.test(horaInicio || "")) throw new Error(`Hora inválida: ${horaInicio}`);
  utc(dataISO);
  return new Date(`${dataISO}T${horaInicio}:00-03:00`);
}
export function rotuloHorario(horaInicio, horaFim) {
  return `${horaInicio}-${horaFim}`;
}

// ── Prazo do mapa: sem tolerância, cobrança piscando até 1 h, depois pendente ───
// "aguardando": a equipe ainda não assumiu · "enviado": já concluído ·
// "cobranca": passou do início e não foi enviado (alerta piscando, até `janelaMin`) ·
// "pendente": passou da janela sem envio (fica pendente até alguém concluir).
export function estadoDoMapa({ inicio, agora, enviadoEm = null, janelaMin = 60 }) {
  if (enviadoEm) return "enviado";
  const minutos = (agora.getTime() - inicio.getTime()) / 60000;
  if (minutos < 0) return "aguardando";
  return minutos <= janelaMin ? "cobranca" : "pendente";
}

// ─────────────────────────────────────────────────────────────
// rondaVirtualGrade.js — grade de horários e status das rondas (funções puras).
// Extraído de RondaVirtual.jsx SEM mudança de lógica (pacote F2-1, 05/10/2026) para que a tela e o relatório
// usem a mesma fonte sem importação circular. Quem altera regra de grade/tolerância altera aqui.
// ─────────────────────────────────────────────────────────────
const TOLERANCIA_MIN = 5;

// Projetos com grade ESPECIAL no noturno (30min após as 23h até 05:30).
// Também são os projetos com regra ESPECIAL de diurno: só domingo (+feriado).
const PROJETOS_GRADE_ESPECIAL = ["P311A", "P311B"];
function temGradeEspecial(projectId){ return PROJETOS_GRADE_ESPECIAL.includes(projectId); }

// offsetMin = minutos desde o horário de início do turno (18:00 noturno / 06:00 diurno)
// projectId define a cadência noturna: especial = 30min após 23h; demais = 1h até 05:00.
function buildSlots(tipo, projectId) {
  const slots = [];
  const especial = temGradeEspecial(projectId);
  // P606 (Duque de Caxias): janela deslocada +1h — diurno 07→19, noturno 19→07.
  const desloc = (projectId === "P606") ? 1 : 0;
  if (tipo === "noturno") {
    const iniN = 18 + desloc; // 18 normal, 19 no P606
    for (let h = iniN; h <= 22; h++) slots.push({ label:`${String(h).padStart(2,"0")}:00`, offsetMin:(h-iniN)*60 });
    if (especial) {
      // 23:00 → 05:30 a cada 30min (apenas P311A / P311B)
      let off = (23-iniN)*60, cur = 23*60, fim = (24+5)*60+30; // 05:30 do dia seguinte
      while (cur <= fim) {
        const hh = Math.floor((cur%1440)/60), mm = cur%60;
        slots.push({ label:`${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}`, offsetMin:off });
        cur += 30; off += 30;
      }
    } else {
      // 23:00 → 05:00 (ou 06:00 no P606) a cada 1h
      let off = (23-iniN)*60, cur = 23*60, fim = (24+5+desloc)*60; // 05:00 normal, 06:00 P606... ajustado p/ fechar 12h
      while (cur <= fim) {
        const hh = Math.floor((cur%1440)/60), mm = cur%60;
        slots.push({ label:`${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}`, offsetMin:off });
        cur += 60; off += 60;
      }
    }
  } else { // diurno: 06:00 → 17:00 (ou 07:00 → 18:00 no P606) de 1h
    const iniD = 6 + desloc, fimD = 17 + desloc;
    for (let h = iniD; h <= fimD; h++) slots.push({ label:`${String(h).padStart(2,"0")}:00`, offsetMin:(h-iniD)*60 });
  }
  return slots;
}

function inicioTurnoHora(tipo, projectId){
  const desloc = (projectId === "P606") ? 1 : 0;
  return (tipo==="noturno" ? 18 : 6) + desloc;
}

// Hora de ENCERRAMENTO da jornada de 12h (espelho de inicioTurnoHora).
// Noturno: 06:00 (07:00 no P606). Diurno: 18:00 (19:00 no P606).
// Usado para manter a janela do ÚLTIMO slot aberta até 1min antes do fim do
// turno — a última ronda (~05h) e o botão "Concluir e arquivar" ficam
// disponíveis até 05:59 (06:59 no P606), quando ainda é o turno da noite.
function fimTurnoHora(tipo, projectId){
  const desloc = (projectId === "P606") ? 1 : 0;
  return (tipo==="noturno" ? 6 : 18) + desloc;
}
// Minutos, contados a partir do início do turno, do instante 1min antes do fim
// da jornada (ex.: noturno normal = 18h→06h → 12h de janela → 05:59 = 719min).
function limiteFinalTurnoMin(tipo, projectId){
  const ini = inicioTurnoHora(tipo, projectId);
  let fim = fimTurnoHora(tipo, projectId);
  if (fim <= ini) fim += 24;                 // cruzou a meia-noite
  return (fim - ini) * 60 - 1;               // 1 min antes do fim (ex.: 05:59)
}

// minutos decorridos desde o início do turno, considerando a data de início.
// Trata a virada de meia-noite (turno noturno cruza para o dia seguinte).
function minutosDesdeInicio(tipo, dataInicio, agora=new Date(), projectId) {
  const [Y,M,D] = dataInicio.split("-").map(Number);
  const ini = new Date(Y, M-1, D, inicioTurnoHora(tipo, projectId), 0, 0, 0);
  return Math.floor((agora.getTime() - ini.getTime())/60000);
}

// Status de UM slot a partir do relógio (puro, testável).
// registro = entrada salva em turnoObj.rondas[offset] (ou null)
// Retorna: feita | feita_atrasada | em_andamento | naoexec | aguardando | aberto | atraso_aberto | bloqueado
// limiteFinalMin (opcional): quando informado, define o limite do ÚLTIMO slot
// (proximoOffset == null). Serve para manter a última ronda noturna registrável
// e a conclusão liberada até 1min antes do fim do turno (05:59 / 06:59 P606),
// em vez de bloquear em ini+30. Default null = comportamento original intacto
// (usado nos PDFs/consolidado, que avaliam turnos já encerrados).
function statusSlot(slot, proximoOffset, agoraMin, registro, limiteFinalMin=null) {
  if (registro && registro.naoExec) return "naoexec";
  // AUD-008: início SEM fim = ronda em andamento (não é "feita" ainda).
  // Só vira "feita"/"feita_atrasada" quando o fim é registrado.
  if (registro && registro.inicio && !registro.fim) return "em_andamento";
  if (registro && registro.inicio)  return registro.atrasada ? "feita_atrasada" : "feita";
  const ini = slot.offsetMin;
  const fimTol = ini + TOLERANCIA_MIN;
  const limitePadrao = (proximoOffset != null) ? proximoOffset : (ini + 30);
  // Último slot com limite estendido do turno: usa o maior entre o padrão e o
  // fim do turno, para não bloquear a última ronda antes do encerramento.
  const limite = (proximoOffset == null && limiteFinalMin != null)
    ? Math.max(limitePadrao, limiteFinalMin)
    : limitePadrao;
  if (agoraMin < ini)       return "aguardando";
  if (agoraMin <= fimTol)   return "aberto";          // iniciar no horário
  if (agoraMin < limite)    return "atraso_aberto";   // iniciar com atraso
  return "bloqueado";                                  // estourou → não executada
}

export { TOLERANCIA_MIN, PROJETOS_GRADE_ESPECIAL, temGradeEspecial, buildSlots, inicioTurnoHora, fimTurnoHora, limiteFinalTurnoMin, minutosDesdeInicio, statusSlot };

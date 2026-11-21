// Grade da Ronda Virtual extraída de RondaVirtual.jsx sem mudança de lógica (F2-1). Casos fixos de referência.
import { buildSlots, statusSlot, limiteFinalTurnoMin, minutosDesdeInicio, TOLERANCIA_MIN } from "./rondaVirtualGrade";
test("grades por projeto", () => {
  expect(buildSlots("noturno", "P601").map((s) => s.label)).toEqual(["18:00", "19:00", "20:00", "21:00", "22:00", "23:00", "00:00", "01:00", "02:00", "03:00", "04:00", "05:00"]);
  expect(buildSlots("noturno", "P606")[0]).toEqual({ label: "19:00", offsetMin: 0 });
  const e = buildSlots("noturno", "P311A"); expect(e[5].label).toBe("23:00"); expect(e[6].label).toBe("23:30"); expect(e[e.length - 1].label).toBe("05:30");
  expect(buildSlots("diurno", "P601").map((s) => s.label)[11]).toBe("17:00");
  expect(limiteFinalTurnoMin("noturno", "P601")).toBe(719); expect(TOLERANCIA_MIN).toBe(5);
});
test("status por relógio e registro", () => {
  const s = { label: "18:00", offsetMin: 0 };
  expect(statusSlot(s, 60, -1, null)).toBe("aguardando"); expect(statusSlot(s, 60, 5, null)).toBe("aberto");
  expect(statusSlot(s, 60, 6, null)).toBe("atraso_aberto"); expect(statusSlot(s, 60, 60, null)).toBe("bloqueado");
  expect(statusSlot(s, 60, 999, { inicio: "18:00" })).toBe("em_andamento"); expect(statusSlot(s, 60, 999, { inicio: "18:00", fim: "18:05" })).toBe("feita");
  expect(statusSlot(s, 60, 999, { naoExec: true })).toBe("naoexec");
  expect(minutosDesdeInicio("noturno", "2026-10-04", new Date("2026-10-05T00:30:00"), "P601")).toBe(390);
});

test("turno noturno aberto de madrugada pertence ao dia anterior (senão tudo fica 'aguardando')", () => {
  const { dataInicioNovoTurno, turnoEmJanela } = require("./rondaVirtualGrade");
  expect(dataInicioNovoTurno("noturno", "P260A", new Date(2026, 10, 21, 1, 0))).toBe("2026-11-20");
  expect(dataInicioNovoTurno("noturno", "P260A", new Date(2026, 10, 20, 22, 0))).toBe("2026-11-20");
  expect(dataInicioNovoTurno("noturno", "P260A", new Date(2026, 10, 21, 6, 0))).toBe("2026-11-21"); // 06h já é outro dia/turno
  expect(dataInicioNovoTurno("noturno", "P606", new Date(2026, 10, 21, 6, 30))).toBe("2026-11-20"); // P606 vai até 07h
  expect(dataInicioNovoTurno("diurno", "P260A", new Date(2026, 10, 21, 1, 0))).toBe("2026-11-21");
  expect(dataInicioNovoTurno("noturno", "P601", new Date(2026, 0, 1, 0, 30))).toBe("2025-12-31"); // virada de ano
  // com a data certa, de madrugada os horários correm (não ficam 'aguardando')
  const d = dataInicioNovoTurno("noturno", "P260A", new Date(2026, 10, 21, 1, 0));
  expect(minutosDesdeInicio("noturno", d, new Date(2026, 10, 21, 1, 0), "P260A")).toBe(420);
  expect(turnoEmJanela("noturno", "2026-11-20", new Date(2026, 10, 21, 1, 0), "P260A")).toBe(true);
  expect(turnoEmJanela("noturno", "2026-11-20", new Date(2026, 10, 21, 6, 0), "P260A")).toBe(false); // terminou
  expect(turnoEmJanela("noturno", "2026-11-20", new Date(2026, 10, 20, 17, 0), "P260A")).toBe(false); // ainda não começou
});

import { horarioDoTurno, HORARIOS_PROJETO } from "./horarios";

test("padrão 06–18 / 18–06 nos projetos de Moked confirmados", () => {
  for (const p of ["P260A", "P260B", "P260C", "P311A", "P311B", "P505", "P601", "P602", "P604", "P605", "P607"]) {
    expect(horarioDoTurno(p, "D")).toMatchObject({ inicio: "06:00", fim: "18:00", confirmado: true });
    expect(horarioDoTurno(p, "N")).toMatchObject({ inicio: "18:00", fim: "06:00" });
  }
});
test("P606 é 07–19 / 19–07 (e só ele)", () => {
  expect(horarioDoTurno("P606", "D")).toMatchObject({ inicio: "07:00", fim: "19:00", confirmado: true });
  expect(horarioDoTurno("P606", "N")).toMatchObject({ inicio: "19:00", fim: "07:00" });
});
test("Ronda do P505 e Apoio do P601 são 08–20; os demais postos seguem o turno", () => {
  expect(horarioDoTurno("P505", "D", "Ronda")).toMatchObject({ inicio: "08:00", fim: "20:00", doPosto: true });
  expect(horarioDoTurno("P601", "D", "Apoio")).toMatchObject({ inicio: "08:00", fim: "20:00", doPosto: true });
  expect(horarioDoTurno("P601", "D", "Líder")).toMatchObject({ inicio: "06:00", doPosto: false });
  expect(horarioDoTurno("P505", "N", "Ronda")).toMatchObject({ inicio: "18:00" });
});
test("projeto ou turno desconhecido não inventa horário", () => {
  expect(horarioDoTurno("P999", "D")).toBeNull();
  expect(horarioDoTurno("P311B", "X")).toBeNull();
  expect(Object.keys(HORARIOS_PROJETO)).toHaveLength(12);
});

import { ciclo, cicloDaData, ehUltimoDiaDoCiclo, mesesDoAno, csvDoCiclo } from "./rdCiclo";

test("outubro/26 = 20/09 (domingo → segunda 21/09) a 19/10 (segunda)", () => {
  expect(ciclo(2026, 10)).toMatchObject({ de: "2026-09-21", ate: "2026-10-19", nome: "outubro de 26", chave: "2026-10" });
});
test("novembro/26: abre 20/10 (terça) e fecha 19/11 (quinta)", () => {
  expect(ciclo(2026, 11)).toMatchObject({ de: "2026-10-20", ate: "2026-11-19" });
});
test("dia 19 em sábado fecha na sexta 18 (junho/27)", () => { expect(ciclo(2027, 6).ate).toBe("2027-06-18"); });
test("dia 20 em sábado abre na segunda 22 (março/27)", () => { expect(ciclo(2027, 3).de).toBe("2027-02-22"); });
test("janeiro cruza o ano", () => { expect(ciclo(2027, 1)).toMatchObject({ de: "2026-12-21", ate: "2027-01-19" }); });
test("data → pasta: 19/10 fica em outubro; 20/10 já é novembro", () => {
  expect(cicloDaData("2026-10-19").nome).toBe("outubro de 26");
  expect(cicloDaData("2026-10-20").nome).toBe("novembro de 26");
  expect(cicloDaData("2026-12-25").nome).toBe("janeiro de 27");
  expect(cicloDaData("2026-09-21").nome).toBe("outubro de 26");
});
test("último dia do ciclo respeita o ajuste de dia útil", () => {
  expect(ehUltimoDiaDoCiclo("2026-10-19")).toBe(true);
  expect(ehUltimoDiaDoCiclo("2027-06-18")).toBe(true);
  expect(ehUltimoDiaDoCiclo("2027-06-19")).toBe(false);
});
test("pastas: 2026 só out–dez; 2027 os 12", () => {
  expect(mesesDoAno(2026)).toEqual([10, 11, 12]);
  expect(mesesDoAno(2027)).toHaveLength(12);
});
test("dia de fechamento configurável", () => { expect(ciclo(2026, 10, 18)).toMatchObject({ de: "2026-09-21", ate: "2026-10-16" }); });
test("csv", () => { expect(csvDoCiclo([{ data: "2026-10-19", trechos: 2, km: 184.5, projetos: "MK505" }])).toContain('2026-10-19;2;184,5;"MK505"'); });

import {
  diasEntre, somarDias, rotuloDia, turma1236, escala42, trabalha52,
  previstoDoGrupo, chaveMapa, inicioDoTurno, estadoDoMapa,
} from "./regras";

// Os casos abaixo vêm do histórico de 01 a 11/10/2026 extraído dos mapas do WhatsApp:
// a regra tem que reproduzir quem realmente apareceu, antes de qualquer tela existir.

describe("datas", () => {
  test("diferença e soma de dias, inclusive na virada de mês e de ano", () => {
    expect(diasEntre("2026-10-01", "2026-10-11")).toBe(10);
    expect(diasEntre("2026-10-11", "2026-10-01")).toBe(-10);
    expect(somarDias("2026-10-31", 1)).toBe("2026-11-01");
    expect(somarDias("2026-12-31", 1)).toBe("2027-01-01");
  });
  test("dia da semana do cabeçalho sai da data (07/10 é quarta, 11/10 é domingo)", () => {
    expect(rotuloDia("2026-10-01")).toBe("Quinta-feira");
    expect(rotuloDia("2026-10-07")).toBe("Quarta-feira");
    expect(rotuloDia("2026-10-11")).toBe("Domingo");
  });
  test("data inválida não passa em silêncio", () => {
    expect(() => diasEntre("11/10/2026", "2026-10-11")).toThrow(/inválida/);
  });
});

describe("12x36 — duas turmas, dia sim dia não", () => {
  test("P311B: diurno ímpar (LD/MA/AA) e par (JV/AF/JP) de 01 a 11/10", () => {
    const ancora = "2026-10-01"; // turma 0 = dias ímpares de outubro
    const turmas = [["LD", "MA", "AA"], ["JV", "AF", "JP"]];
    const regra = { tipo: "12x36", ancora, turmas };
    for (const d of ["01", "03", "05", "07", "09", "11"]) {
      expect(previstoDoGrupo(regra, `2026-10-${d}`, "D").pessoas).toEqual(["LD", "MA", "AA"]);
    }
    for (const d of ["02", "04", "06", "08", "10"]) {
      expect(previstoDoGrupo(regra, `2026-10-${d}`, "D").pessoas).toEqual(["JV", "AF", "JP"]);
    }
  });
  test("a alternância não depende do dia do mês: 31/10 e 01/11 são turmas diferentes", () => {
    const ancora = "2026-10-30";
    expect(turma1236(ancora, "2026-10-30")).toBe(0);
    expect(turma1236(ancora, "2026-10-31")).toBe(1);
    expect(turma1236(ancora, "2026-11-01")).toBe(0);
  });
  test("a âncora pode estar no futuro ou no passado", () => {
    expect(turma1236("2026-10-20", "2026-10-11")).toBe(1);
    expect(turma1236("2026-10-20", "2026-10-10")).toBe(0);
  });
});

describe("4x2 — grupo de 3 (titular D, titular N, folguista)", () => {
  // P260B: SS titular D, GBS titular N, DV folguista. SS começou um bloco em 06/10.
  const regra = { tipo: "4x2", ancora: "2026-10-06", titularD: "SS", titularN: "GBS", folguista: "DV" };
  const quem = (dia, turno) => previstoDoGrupo(regra, `2026-10-${dia}`, turno).pessoas[0];

  test("P260B diurno: SS 01–03 e 06–09; DV cobre a folga de SS (04–05 e 10)", () => {
    expect(["01", "02", "03"].map((d) => quem(d, "D"))).toEqual(["SS", "SS", "SS"]);
    expect(["04", "05"].map((d) => quem(d, "D"))).toEqual(["DV", "DV"]);
    expect(["06", "07", "08", "09"].map((d) => quem(d, "D"))).toEqual(["SS", "SS", "SS", "SS"]);
    expect(quem("10", "D")).toBe("DV");
  });
  test("P260B noturno: GBS 02–05 e 08–10; DV cobre a folga de GBS (01 e 06–07)", () => {
    expect(quem("01", "N")).toBe("DV");
    expect(["02", "03", "04", "05"].map((d) => quem(d, "N"))).toEqual(["GBS", "GBS", "GBS", "GBS"]);
    expect(["06", "07"].map((d) => quem(d, "N"))).toEqual(["DV", "DV"]);
    expect(["08", "09", "10"].map((d) => quem(d, "N"))).toEqual(["GBS", "GBS", "GBS"]);
  });
  test("P260C, liderança: MF (D), JM (N), VR folguista — mesmo padrão do histórico", () => {
    const l = { tipo: "4x2", ancora: "2026-10-05", titularD: "MF", titularN: "JM", folguista: "VR" };
    const q = (dia, turno) => previstoDoGrupo(l, `2026-10-${dia}`, turno).pessoas[0];
    expect(["01", "02", "05", "06", "07", "08", "11"].map((d) => q(d, "D"))).toEqual(Array(7).fill("MF"));
    expect(["03", "04", "09", "10"].map((d) => q(d, "D"))).toEqual(Array(4).fill("VR"));
    expect(["01", "02", "03", "04", "07", "08", "09", "10"].map((d) => q(d, "N"))).toEqual(Array(8).fill("JM"));
    expect(["05", "06"].map((d) => q(d, "N"))).toEqual(["VR", "VR"]);
  });
  test("o folguista nunca está em dois turnos no mesmo dia e descansa 2 de cada 6 dias", () => {
    let descansa = 0;
    for (let i = 0; i < 12; i++) {
      const e = escala42("2026-10-06", somarDias("2026-10-06", i));
      const noD = e.D === "folguista", noN = e.N === "folguista";
      expect(noD && noN).toBe(false);
      if (!noD && !noN) descansa++;
      // cada titular folga exatamente quando o folguista cobre
      expect(e.titularDFolga).toBe(noD);
      expect(e.titularNFolga).toBe(noN);
    }
    expect(descansa).toBe(4); // 2 de cada 6 dias, em 12 dias
  });
  test("ids ausentes não geram sugestão", () => {
    const r = { tipo: "4x2", ancora: "2026-10-06", titularD: "SS", titularN: "GBS" };
    expect(previstoDoGrupo(r, "2026-10-04", "D").pessoas).toEqual([]);
  });
});

describe("5x2 — segunda a sexta", () => {
  test("P260A, VSPPs P1/P2: aparecem de seg a sex, nunca no fim de semana", () => {
    const regra = { tipo: "5x2", pessoas: ["P1", "P2"] };
    for (const d of ["01", "02", "05", "06", "07", "08", "09"]) {
      expect(previstoDoGrupo(regra, `2026-10-${d}`, "D").pessoas).toEqual(["P1", "P2"]);
    }
    for (const d of ["03", "04", "10", "11"]) {
      expect(previstoDoGrupo(regra, `2026-10-${d}`, "D").pessoas).toEqual([]);
    }
    expect(trabalha52("2026-10-05")).toBe(true);
    expect(trabalha52("2026-10-10")).toBe(false);
  });
});

describe("sem regra", () => {
  test("não inventa ninguém", () => {
    expect(previstoDoGrupo(null, "2026-10-01", "D")).toEqual({ pessoas: [], origem: "sem-regra" });
    expect(previstoDoGrupo({ tipo: "6x1" }, "2026-10-01", "D").pessoas).toEqual([]);
  });
});

describe("identidade e prazo do mapa", () => {
  test("um mapa por projeto, dia de início e turno", () => {
    expect(chaveMapa("P311B", "2026-10-10", "N")).toBe("P311B_2026-10-10_N");
    expect(() => chaveMapa("P311B", "2026-10-10", "X")).toThrow(/Turno/);
    expect(() => chaveMapa("", "2026-10-10", "D")).toThrow(/Projeto/);
  });
  test("início do turno em horário de Brasília (-03:00)", () => {
    expect(inicioDoTurno("2026-10-11", "06:00").toISOString()).toBe("2026-10-11T09:00:00.000Z");
    expect(inicioDoTurno("2026-10-10", "18:00").toISOString()).toBe("2026-10-10T21:00:00.000Z");
  });
  test("sem tolerância: cobrança piscando até 1 h depois de a equipe assumir; depois, pendente", () => {
    const inicio = inicioDoTurno("2026-10-11", "06:00");
    const em = (hhmm) => new Date(`2026-10-11T${hhmm}:00-03:00`);
    expect(estadoDoMapa({ inicio, agora: em("05:59") })).toBe("aguardando");
    expect(estadoDoMapa({ inicio, agora: em("06:00") })).toBe("cobranca");
    expect(estadoDoMapa({ inicio, agora: em("07:00") })).toBe("cobranca");
    expect(estadoDoMapa({ inicio, agora: em("07:01") })).toBe("pendente");
    expect(estadoDoMapa({ inicio, agora: em("23:00") })).toBe("pendente");
  });
  test("enviado vale em qualquer momento; o noturno conta a partir das 18h do dia de início", () => {
    const inicio = inicioDoTurno("2026-10-10", "18:00");
    expect(estadoDoMapa({ inicio, agora: new Date("2026-10-11T02:00:00-03:00"), enviadoEm: new Date("2026-10-10T18:10:00-03:00") })).toBe("enviado");
    expect(estadoDoMapa({ inicio, agora: new Date("2026-10-10T18:30:00-03:00") })).toBe("cobranca");
    expect(estadoDoMapa({ inicio, agora: new Date("2026-10-10T19:30:00-03:00") })).toBe("pendente");
  });
  test("horário de início diferente por projeto (P606 às 07:00)", () => {
    const inicio = inicioDoTurno("2026-10-11", "07:00");
    expect(estadoDoMapa({ inicio, agora: new Date("2026-10-11T07:20:00-03:00") })).toBe("cobranca");
  });
});

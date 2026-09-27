import { classificarRiscoOperacional, NIVEL, resolverRegra } from "./riscoConfig";

const camadas = (primariaInop, secundariaInop, secundariaTotal = 4) => ({
  primariaInop,
  secundariaInop,
  secundariaTotal,
});

describe("doutrina de perímetro em camadas do P311A", () => {
  test("reconhece Alpha Sense como perímetro nomeado", () => {
    const regra = resolverRegra("Alpha Zona 01", "01B - ALARME ALPHA SENSE");

    expect(regra.classe).toBe("BLOQUEADOR");
    expect(regra.flags.perimetro).toBe(true);
  });

  test("falha parcial somente na cerca elétrica fica baixa com Alpha Sense íntegro", () => {
    const risco = classificarRiscoOperacional({ camadasPerimetrais: camadas(0, 1) });

    expect(risco.nivel).toBe(NIVEL.BAIXO);
    expect(risco.motivo).toContain("Alpha Sense íntegro");
  });

  test("cerca elétrica totalmente inoperante fica elevada com Alpha Sense íntegro", () => {
    const risco = classificarRiscoOperacional({ camadasPerimetrais: camadas(0, 4) });

    expect(risco.nivel).toBe(NIVEL.ELEVADO);
  });

  test("uma zona do Alpha Sense isolada fica elevada", () => {
    const risco = classificarRiscoOperacional({ camadasPerimetrais: camadas(1, 0) });

    expect(risco.nivel).toBe(NIVEL.ELEVADO);
  });

  test("duas zonas do Alpha Sense tornam o risco crítico", () => {
    const risco = classificarRiscoOperacional({ camadasPerimetrais: camadas(2, 0) });

    expect(risco.nivel).toBe(NIVEL.CRITICO);
    expect(risco.motivo).toContain("duas ou mais zonas do Alpha Sense");
  });

  test("falha simultânea nas duas camadas torna o risco crítico", () => {
    const risco = classificarRiscoOperacional({ camadasPerimetrais: camadas(1, 1) });

    expect(risco.nivel).toBe(NIVEL.CRITICO);
    expect(risco.motivo).toContain("falha simultânea");
  });

  test("CFTV não se soma à cerca secundária para formar crítico", () => {
    const risco = classificarRiscoOperacional({
      camadasPerimetrais: camadas(0, 1),
      cftvInoperante: 6,
    });

    expect(risco.nivel).toBe(NIVEL.ELEVADO);
    expect(risco.motivo).toContain("câmeras inoperantes");
  });
});

describe("não regressão da régua sem camadas", () => {
  test("dois perímetros continuam críticos nos demais projetos", () => {
    expect(classificarRiscoOperacional({ zonasPerimetrais: 2 }).nivel).toBe(NIVEL.CRITICO);
  });

  test("uma zona mais seis câmeras continua crítica nos demais projetos", () => {
    expect(classificarRiscoOperacional({ zonasPerimetrais: 1, cftvInoperante: 6 }).nivel).toBe(NIVEL.CRITICO);
  });
});

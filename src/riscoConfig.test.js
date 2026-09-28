import { avaliarIluminacao, classificarRiscoOperacional, NIVEL, normalizarFracao, resolverRegra } from "./riscoConfig";

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

describe("correções mandatórias do motor", () => {
  test("falha composta de longa duração fica moderada sem forçar dado no Firestore", () => {
    const risco = classificarRiscoOperacional({
      barreirasCriticas: 1,
      cftvInoperante: 2,
      falhaCompostaModerada: true,
    });

    expect(risco.nivel).toBe(NIVEL.MODERADO);
    expect(risco.motivo).toContain("falhas localizadas de CFTV e portão");
  });

  test("fração impossível é limitada ao denominador", () => {
    expect(normalizarFracao(4, 3, "Pânico fixo")).toMatchObject({ inop: 3, total: 3, invalida: true });
  });

  test("iluminação com 91% global permanece estável", () => {
    expect(avaliarIluminacao({ quadrantes: [85, 91, 92, 95], disponibilidadeGlobal: 0.91 }).status).toBe("ESTÁVEL");
  });

  test("quatro quadrantes críticos tornam iluminação agravante", () => {
    expect(avaliarIluminacao({ quadrantes: [40, 35, 45, 30], disponibilidadeGlobal: 85 }).status).toBe("AGRAVANTE");
  });

  test("disponibilidade global abaixo de 75% torna iluminação agravante", () => {
    expect(avaliarIluminacao({ quadrantes: [80, 82], disponibilidadeGlobal: 74 }).agravante).toBe(true);
  });
});

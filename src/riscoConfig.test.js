import {
  NIVEL, PVT_CORTES, agruparBloqueadores, aplicarTeto,
  classificarRiscoOperacional, classificarVetor, consolidarSite,
  fatorCoberturaCFTV, fatorProporcao, fatorVolume, multTemporal,
  resolverRegra, rotuloPorPVT, saoIndependentes, travaFechada,
} from "./riscoConfig";

describe("régua operacional final", () => {
  test.each([
    [{ zonasPerimetrais: 0 }, NIVEL.BAIXO],
    [{ zonasPerimetrais: 1 }, NIVEL.ELEVADO],
    [{ zonasPerimetrais: 2 }, NIVEL.CRITICO],
    [{ zonasPerimetrais: 3 }, NIVEL.CRITICO],
    [{ zonasPerimetrais: 1, cftvInoperante: 6 }, NIVEL.CRITICO],
    [{ zonasPerimetrais: 1, barreirasCriticas: 1 }, NIVEL.CRITICO],
    [{ zonasPerimetrais: 1, panicoFixoInoperante: true }, NIVEL.CRITICO],
    [{ zonasPerimetrais: 1, ctmkOffline: true }, NIVEL.CRITICO],
    [{ panicoFixoInoperante: true }, NIVEL.ELEVADO],
    [{ ctmkOffline: true }, NIVEL.ELEVADO],
    [{ cftvInoperante: 6 }, NIVEL.ELEVADO],
    [{ cftvInoperante: 5 }, NIVEL.BAIXO],
    [{ barreirasCriticas: 1 }, NIVEL.ELEVADO],
    [{ perimetroTotal30d: true }, NIVEL.CRITICO],
    [{ panicoFixoInoperante: true, ctmkOffline: true, cftvInoperante: 10 }, NIVEL.ELEVADO],
  ])("classifica %o como nível %i", (entrada, esperado) => {
    expect(classificarRiscoOperacional(entrada).nivel).toBe(esperado);
  });

  test("sem zona e sem perímetro total nunca é crítico", () => {
    [false, true].forEach((panicoFixoInoperante) => {
      [false, true].forEach((ctmkOffline) => {
        [0, 5, 6, 10].forEach((cftvInoperante) => {
          [0, 1, 3].forEach((barreirasCriticas) => {
            expect(classificarRiscoOperacional({
              zonasPerimetrais: 0, perimetroTotal30d: false,
              panicoFixoInoperante, ctmkOffline, cftvInoperante, barreirasCriticas,
            }).nivel).toBeLessThan(NIVEL.CRITICO);
          });
        });
      });
    });
  });
});

describe("travas fechadas", () => {
  test.each([
    [{ travaTipo: "perimetroTotal30d" }, true],
    [{ travaTipo: "panicoFixoInoperante" }, false],
    [{ travaTipo: "ctmkOffline" }, false],
    [{}, false], [{ travaTipo: null }, false],
  ])("travaFechada(%o) é %s", (vetor, esperado) => expect(travaFechada(vetor)).toBe(esperado));
});

describe("classificação por vetor", () => {
  test("preserva zona nomeada de perímetro", () => {
    const vetor = classificarVetor({ labelCategoria: "Alarme Perimetral", labelItem: "Zona 04", zonaCanonica: "zona-04", inop: 1 });
    expect(vetor.barreiraFisica).toBe("perimetro");
    expect(vetor.zonaCanonica).toBe("zona-04");
  });

  test.each(["Cofre", "Joystick", "Porta CCO", "Cancela Administrativa"])("%s é observação", (labelItem) => {
    const vetor = classificarVetor({ labelItem, inop: 1, dias: 120 });
    expect(vetor.observacaoManutencao).toBe(true);
    expect(vetor.bloqueadorCaido).toBe(false);
    expect(vetor.nivel).toBe(NIVEL.BAIXO);
  });

  test("cancela AS não cria trava nem é injetada como barreira da matriz", () => {
    expect(classificarVetor({ labelItem: "Cancela Alta Segurança", inop: 1, total: 1, dias: 31 }).travaTipo).toBeNull();
    expect(classificarRiscoOperacional({ zonasPerimetrais: 0, barreirasCriticas: 0 }).nivel).toBe(NIVEL.BAIXO);
  });

  test("trava genérica não é aceita", () => {
    expect(classificarVetor({ labelItem: "Item qualquer", travaTipo: "qualquerCoisa" }).travaTipo).toBeNull();
  });

  test("brigada não entra no escopo cliente", () => {
    expect(classificarVetor({ labelItem: "Brigada", escopo: "cliente" }).incluir).toBe(false);
  });
});

describe("consolidação e zonas", () => {
  const perimetro = (zonaCanonica, causaRaiz) => ({
    incluir: true, bloqueadorCaido: true, barreiraFisica: "perimetro",
    zonaCanonica, causaRaiz, nivel: NIVEL.ELEVADO,
  });

  test("lista vazia é baixo", () => expect(consolidarSite([]).nivel).toBe(NIVEL.BAIXO));
  test("duas zonas nomeadas distintas contam como crítico", () => {
    expect(consolidarSite([perimetro("zona-04"), perimetro("zona-07")]).nivel).toBe(NIVEL.CRITICO);
  });
  test("a mesma zona em duas fontes conta uma vez", () => {
    expect(consolidarSite([perimetro("zona-04", "fibra"), perimetro("zona-04", "fibra")]).nBloqueadores).toBe(1);
  });
  test("observação de manutenção não eleva", () => {
    expect(consolidarSite([{ incluir: true, observacaoManutencao: true, bloqueadorCaido: true, nivel: NIVEL.CRITICO }]).nivel).toBe(NIVEL.BAIXO);
  });
  test("zonas distintas são independentes", () => {
    expect(saoIndependentes(perimetro("zona-04"), perimetro("zona-07"))).toBe(true);
  });
  test("mesma zona não é independente", () => {
    expect(saoIndependentes(perimetro("zona-04", "fibra"), perimetro("zona-04", "fibra"))).toBe(false);
  });
  test("ponto sem cadastro não infla ao lado de zona nomeada", () => {
    const anonimo = perimetro("perimetro-sem-cadastro");
    const nomeado = perimetro("zona-04", "fibra");
    expect(saoIndependentes(anonimo, nomeado)).toBe(false);
    expect(agruparBloqueadores([anonimo, nomeado])).toHaveLength(1);
  });

  test("a mesma zona com causas distintas continua sendo um bloqueador", () => {
    expect(agruparBloqueadores([perimetro("zona-04", "fibra"), perimetro("zona-04", "energia")]))
      .toHaveLength(1);
  });

  test("Z-04 e Z-07 sem causa continuam sendo dois bloqueadores", () => {
    expect(agruparBloqueadores([perimetro("zona-04"), perimetro("zona-07")]))
      .toHaveLength(2);
  });

  test("sem cadastro perimetral ao lado de Z-04 mantém somente Z-04", () => {
    expect(agruparBloqueadores([perimetro("perimetro-sem-cadastro"), perimetro("zona-04", "fibra")]))
      .toHaveLength(1);
  });

  test("pendência não perimetral continua na contagem", () => {
    const naoPerimetral = {
      incluir: true, bloqueadorCaido: true, barreiraFisica: "bollard",
      pendenciaCadastro: true, nivel: NIVEL.ELEVADO,
    };
    expect(agruparBloqueadores([naoPerimetral])).toHaveLength(1);
  });
});

describe("fatores PVT", () => {
  test("tempo, volume, proporção e cobertura são monotônicos", () => {
    expect(multTemporal(1)).toBeLessThanOrEqual(multTemporal(100));
    expect(fatorVolume(1)).toBeLessThan(fatorVolume(10));
    expect(fatorProporcao(1, 100)).toBeLessThan(fatorProporcao(50, 100));
    expect(fatorProporcao(0, 100)).toBe(1);
    expect(fatorCoberturaCFTV(0)).toBeLessThan(fatorCoberturaCFTV(50));
    expect(fatorCoberturaCFTV(0)).toBe(1);
  });
  test("cortes PVT permanecem estáveis", () => {
    expect(rotuloPorPVT(PVT_CORTES.critico + 1)).toBe(NIVEL.CRITICO);
    expect(rotuloPorPVT(20)).toBe(NIVEL.ELEVADO);
    expect(rotuloPorPVT(8)).toBe(NIVEL.MODERADO);
    expect(rotuloPorPVT(3)).toBe(NIVEL.BAIXO);
  });
  test("teto de periférico é baixo", () => expect(aplicarTeto(NIVEL.CRITICO, "PERIFERICO")).toBe(NIVEL.BAIXO));
  test("cofre é resolvido antes do fallback", () => expect(resolverRegra("Cofre", "").flags.observacaoManutencao).toBe(true));
});

describe("regressão dos projetos", () => {
  test("P601-like: pânico sem zona é elevado", () => expect(classificarRiscoOperacional({ panicoFixoInoperante: true }).nivel).toBe(NIVEL.ELEVADO));
  test("P604-like: duas zonas, CFTV e bollard é crítico", () => expect(classificarRiscoOperacional({ zonasPerimetrais: 2, cftvInoperante: 19, barreirasCriticas: 1 }).nivel).toBe(NIVEL.CRITICO));
  test("P607-like: três zonas é crítico", () => expect(classificarRiscoOperacional({ zonasPerimetrais: 3 }).nivel).toBe(NIVEL.CRITICO));
});

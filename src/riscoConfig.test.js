import { classificarRiscoOperacional, classificarVetor, NIVEL } from "./riscoConfig";

describe("matriz operacional final", () => {
  test("uma zona perimetral é elevado", () => expect(classificarRiscoOperacional({ zonasPerimetrais: 1 }).nivel).toBe(NIVEL.ELEVADO));
  test("duas zonas perimetrais são crítico", () => expect(classificarRiscoOperacional({ zonasPerimetrais: 2 }).nivel).toBe(NIVEL.CRITICO));
  test("uma zona com CFTV comprometido é crítico", () => expect(classificarRiscoOperacional({ zonasPerimetrais: 1, cftvInoperante: 6 }).nivel).toBe(NIVEL.CRITICO));
  test("mais de cinco câmeras é elevado com perímetro íntegro", () => expect(classificarRiscoOperacional({ cftvInoperante: 6 }).nivel).toBe(NIVEL.ELEVADO));
  test("uma cancela AS isolada permanece baixo", () => expect(classificarRiscoOperacional({ barreirasCriticas: 1 }).nivel).toBe(NIVEL.BAIXO));
  test("cancela AS e bollard são moderado", () => expect(classificarRiscoOperacional({ barreirasCriticas: 2 }).nivel).toBe(NIVEL.MODERADO));
  test("cofre e joystick não entram na matriz", () => expect(classificarRiscoOperacional({}).nivel).toBe(NIVEL.BAIXO));
  test("trava crítica vence qualquer outro estado", () => expect(classificarRiscoOperacional({ ctmkOffline: true }).nivel).toBe(NIVEL.CRITICO));
  test("pânico fixo inoperante é trava imediata", () => expect(classificarVetor({ labelCategoria: "Botão de pânico", labelItem: "Fixo", inop: 1 }).travaTipo).toBe("panicoFixoInoperante"));
});

import { consolidarPeriodo, htmlConsolidado, tipoClassificado, dedicacaoDoTrecho } from "./rdConsolidado";

const T = (data, h) => `${data}T${h}:00.000-03:00`;
const tr = (data, origem, destino, hIni, hFim, kmI, kmF, extra = {}) => ({ id: Math.random().toString(36).slice(2), origem, destino, kmInicial: kmI, kmFinal: kmF, abertura: { em: T(data, hIni) }, chegada: hFim ? { em: T(data, hFim) } : null, pedagios: [], gastos: [], atividades: [], obs: "", ...extra });

const dias = [
  { data: "2026-08-20", estado: "fechado", trechos: [
    // abriu 06:00 em casa, chegou 10:00, saiu do cliente 12:00 → 6h dedicadas ao MK604 (regra do Marcio)
    tr("2026-08-20", "MK_HOME", "MK604", "06:00", "10:00", 100, 160, { pedagios: [{ descricao: "Pedágio", valor: 14.5 }], atividades: [{ texto: "Visita", status: "aberto" }] }),
    tr("2026-08-20", "MK604", "MK_HOME", "12:00", "13:00", 160, 221, { gastos: [{ descricao: "Estacionamento", valor: 20 }, { descricao: "Almoço", valor: 35 }] }),
  ] },
  { data: "2026-08-21", estado: "fechado", trechos: [tr("2026-08-21", "MK_HOME", "MK_HOME", "07:00", "19:00", null, null, { obs: "Home office" })] },
];

test("dedicação ao cliente conta da abertura em casa até a saída do cliente; retorno conta nas horas gerais", () => {
  expect(dedicacaoDoTrecho(dias[0], 0)).toBe(6);                       // 06:00 → 12:00, não 10:00
  expect(dedicacaoDoTrecho(dias[0], 1)).toBe(1);                       // retorno 12:00 → 13:00
  const c = consolidarPeriodo(dias, {});
  expect(c.projetos).toEqual([{ codigo: "MK604", horas: 6, visitas: 1 }]);
  expect(c.horas).toBe(19);                                            // 6 + 1 + 12 (home office)
  expect(c.diasCampo).toBe(1);                                         // home office não é dia em campo
  expect(c.km).toBe(121);
  expect(c.maisVisitado).toBe("MK604");
});

test("despesas separadas por tipo e reembolso de km pelo valor configurado", () => {
  expect(tipoClassificado("Pedágio SP-348")).toBe("Pedágio");
  expect(tipoClassificado("Estacionamento shopping")).toBe("Estacionamento");
  expect(tipoClassificado("Almoço")).toBe("Alimentação");
  expect(tipoClassificado("Impressão")).toBe("Outros gastos");
  const c = consolidarPeriodo(dias, { config: { valorKm: "1,10" } });
  expect(c.despesasPorTipo).toEqual({ "Pedágio": 14.5, "Estacionamento": 20, "Alimentação": 35 });
  expect(c.despesas).toBe(69.5);
  expect(c.reembolsoKm).toBe(133.1);                                   // 121 km × R$ 1,10
  expect(c.totalGeral).toBe(202.6);
  const semValor = consolidarPeriodo(dias, {});
  expect(semValor.reembolsoKm).toBeNull();
});

test("agenda do período classifica visita, retorno e home office; HTML traz cards, agenda e escapa conteúdo", () => {
  const c = consolidarPeriodo(dias, {});
  expect(c.agenda.map((a) => a.tipo)).toEqual(["Visita in loco", "Retorno para casa", "Home office"]);
  const perigo = consolidarPeriodo([{ data: "2026-08-22", estado: "fechado", trechos: [tr("2026-08-22", "MK_HOME", "MK601", "06:00", "08:00", 0, 10, { atividades: [{ texto: "<script>x</script>", status: null }] })] }], {});
  const html = htmlConsolidado(perigo, {}, "José Fonseca");
  expect(html).not.toContain("<script>x");
  const html2 = htmlConsolidado(consolidarPeriodo(dias, { config: { valorKm: 1.1 } }), {}, "José Fonseca");
  expect(html2).toContain("horas registradas");
  expect(html2).toContain("Agenda do período");
  expect(html2).toContain("Home office");
  expect(html2).toContain("reembolso de km");
  expect(html2).toContain("Em aberto:");
});

test("reembolso separa carro e moto pelos valores configurados", () => {
  const diasV = [{ data: "2026-08-20", estado: "fechado", trechos: [
    tr("2026-08-20", "MK_HOME", "MK604", "06:00", "10:00", 0, 100),
    tr("2026-08-20", "MK604", "MK_HOME", "12:00", "13:00", 100, 200, { veiculo: "moto" }),
  ] }];
  const c = consolidarPeriodo(diasV, { config: { valorKm: "1,10", valorKmMoto: "0,70" } });
  expect(c.kmCarro).toBe(100); expect(c.kmMoto).toBe(100);
  expect(c.reembolsoKm).toBe(180);                                   // 100×1,10 + 100×0,70
  const semMoto = consolidarPeriodo(diasV, { config: { valorKm: "1,10" } });
  expect(semMoto.reembolsoKm).toBe(220);                             // moto sem valor próprio usa o do carro
});

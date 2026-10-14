import {
  listarDestinos, normalizarCodigoNovo, kmDoTrecho, herdarKmInicial, origemAtual, trechoAberto,
  projetarKmFinal, pedagiosSugeridos, memoriaAposTrecho, pendenciasDoDestino, memoriaAposVisita,
  totaisDoDia, permanencias, minutosFmt,
} from "./rdCalc";

const trecho = (o, d, extra = {}) => ({ id: Math.random().toString(36).slice(2), origem: o, destino: d, kmInicial: null, kmFinal: null, abertura: { em: "2026-10-14T06:00:00.000Z" }, chegada: null, pedagios: [], gastos: [], atividades: [], obs: "", ...extra });

test("cascata: fixos + rotina do Marcio + extras da memória; MK Home e MK Office presentes", () => {
  const ds = listarDestinos({ destinosExtras: [{ codigo: "MK077", sub: "Fora da rotina" }] }).map((d) => d.codigo);
  for (const c of ["MK_HOME", "MK_OFFICE", "MK260A", "MK260B", "MK260C", "MK311A", "MK311B", "MK601", "MK602", "MK604", "MK605", "MK606", "MK607", "MK505", "MK077"]) expect(ds).toContain(c);
});

test("projeto novo: prefixo MK automático, só o número; entradas sujas normalizam", () => {
  expect(normalizarCodigoNovo("077")).toBe("MK077");
  expect(normalizarCodigoNovo("mk 077")).toBe("MK077");
  expect(normalizarCodigoNovo("MK-901b")).toBe("MK901B");
  expect(normalizarCodigoNovo("")).toBeNull();
});

test("Jundiaí do Marcio: ida fecha com km calculado; chegada NÃO abre a volta; km inicial herdado", () => {
  const ida = trecho("MK_HOME", "MK604", { kmInicial: "41200", kmFinal: "41262,5", chegada: { em: "2026-10-14T10:00:00.000Z" } });
  const dia = { data: "2026-10-14", estado: "aberto", trechos: [ida] };
  expect(kmDoTrecho(ida)).toBe(62.5);
  expect(trechoAberto(dia)).toBeNull();                      // nada abre sozinho: o dia fica em aberto no cliente
  expect(origemAtual(dia)).toBe("MK604");                    // a volta sai de onde ele está
  expect(herdarKmInicial(dia)).toBe(62.5 + 41200);
});

test("memória viva: 2ª ida projeta km final pela média e sugere pedágios da última; edição atualiza", () => {
  let mem = {};
  mem = memoriaAposTrecho(mem, trecho("MK_HOME", "MK604", { kmInicial: 100, kmFinal: 160, pedagios: [{ descricao: "SP-348", valor: "14,80" }] }));
  mem = memoriaAposTrecho(mem, trecho("MK_HOME", "MK604", { kmInicial: 500, kmFinal: 564, pedagios: [{ descricao: "SP-348", valor: "16,00" }] }));
  expect(projetarKmFinal(mem, "MK_HOME", "MK604", 1000)).toBe(1062);        // média de 60 e 64
  expect(pedagiosSugeridos(mem, "MK_HOME", "MK604")).toEqual([{ descricao: "SP-348", valor: 16 }]); // reajuste virou o novo padrão
  expect(projetarKmFinal(mem, "MK604", "MK_HOME", 2000)).toBe(2062);        // volta usa a rota inversa como referência
  expect(projetarKmFinal(mem, "MK_HOME", "MK505", 100)).toBeNull();         // rota desconhecida: sem projeção
});

test("destino fora da lista entra na memória como fora da rotina após a primeira viagem", () => {
  const mem = memoriaAposTrecho({}, trecho("MK_HOME", "MK077", { kmInicial: 0, kmFinal: 10 }));
  expect(mem.destinosExtras).toEqual([{ codigo: "MK077", sub: "Fora da rotina" }]);
  expect(listarDestinos(mem).map((d) => d.codigo)).toContain("MK077");
});

test("tratativas: 'em aberto' vira lembrete da próxima visita; 'finalizado' dá baixa; sem marca não gera nada", () => {
  let mem = memoriaAposVisita({}, "MK604", [
    { texto: "Orçamento da cancela", status: "aberto" },
    { texto: "Reunião mensal", status: null },
    { texto: "Checklist ok", status: "finalizado" },
  ], "2026-10-14");
  expect(pendenciasDoDestino(mem, "MK604")).toEqual([{ texto: "Orçamento da cancela", desde: "2026-10-14" }]);
  mem = memoriaAposVisita(mem, "MK604", [{ texto: "Orçamento da cancela", status: "finalizado" }], "2026-10-21");
  expect(pendenciasDoDestino(mem, "MK604")).toEqual([]);
});

test("totais e permanência: tempo no cliente é da chegada até a abertura do trecho seguinte", () => {
  const dia = { data: "2026-10-14", estado: "aberto", trechos: [
    trecho("MK_HOME", "MK604", { kmInicial: 100, kmFinal: 160, abertura: { em: "2026-10-14T09:00:00.000Z" }, chegada: { em: "2026-10-14T10:00:00.000Z" }, pedagios: [{ descricao: "P", valor: "10" }] }),
    trecho("MK604", "MK_HOME", { kmInicial: 160, kmFinal: 221, abertura: { em: "2026-10-14T13:30:00.000Z" }, chegada: { em: "2026-10-14T14:30:00.000Z" }, gastos: [{ descricao: "Almoço", valor: "35,00" }] }),
  ] };
  expect(permanencias(dia)[0]).toBe(210);
  expect(minutosFmt(210)).toBe("3h30");
  const t = totaisDoDia(dia);
  expect(t).toMatchObject({ km: 121, pedagios: 10, gastos: 35, trechos: 2 });
  expect(t.inicio).toBe("2026-10-14T09:00:00.000Z");
  expect(t.fim).toBe("2026-10-14T14:30:00.000Z");
});

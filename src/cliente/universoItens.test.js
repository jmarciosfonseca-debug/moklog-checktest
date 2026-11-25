import { itensUniversoCliente } from "./universoItens";

const P = {
  pid: "P601", nome: "Golgi Cajamar",
  teste: { data: "2026-11-23", pct: 92, inop: 1, parcial: 2, atrasado: false },
  mapa: { temMapa: true, data: "2026-11-25", turno: "Diurno", hoje: true },
  sistemas: { ilumPct: 96, ilumDef: 3, quedas7d: 1, energiaAberta: true, temCtmk: true, ctmkOff: false },
  equip: { pct: 88, inop: 2, parcial: 1 }, ferias: { emFerias: [{}] },
  colabs: [{ treinos: 2 }, { treinos: 1 }], historico: [{ report: { x: 1 } }],
  informativos: [{ dataCurta: "20/11", titulo: "Roubo de carga na região" }],
};

test("monta os itens com os dados reais do projeto e as ações de cada um", () => {
  const plantao = [{ nome: "Ana", posto: "Portaria", situacaoRotulo: "Presente" }];
  const it = itensUniversoCliente(P, { plantao, sis: { geral: 86.4, faixa: "Bom" }, rotuloRisco: "Moderado" });
  const de = (id) => it.find((x) => x.id === id);
  expect(it.map((x) => x.id)).toEqual(["teste", "plantao", "equipe", "treino", "equip", "sistemas", "risco", "entorno", "sis", "local"]);
  expect(de("teste").linhas[0]).toBe("Último teste: 23/11/2026 · 92% operacional");
  expect(de("teste").acoes[0]).toEqual({ id: "pdf", rotulo: "Abrir o PDF do último teste", principal: true });
  expect(de("plantao").linhas).toEqual(["Mapa de 25/11/2026 · Diurno", "Ana · Portaria · Presente"]);
  expect(de("equipe").linhas).toEqual(["2 colaboradores ativos", "1 pessoa em férias"]);
  expect(de("treino").linhas[0]).toBe("3 treinamentos registrados");
  expect(de("sistemas").linhas).toEqual(["Iluminação: 96% (3 pontos deficientes)", "1 queda de energia nos últimos 7 dias", "Há ocorrência de energia em aberto", "CTMK on-line"]);
  expect(de("risco").linhas[0]).toBe("Nível atual: Moderado"); expect(de("sis").linhas[0]).toBe("Nota geral: 86 · Bom");
  it.forEach((x) => x.acoes.forEach((a) => expect(a.id === "pdf" || /^ver:(teste|plantao|turnover|ferias|treino|fotos|equip|sistemas|risco|entorno|sis|local)$/.test(a.id)).toBe(true)));
});

test("sem dados não inventa: sem teste não há PDF, sem mapa avisa, sem projeto devolve vazio", () => {
  const it = itensUniversoCliente({ pid: "X", nome: "X", colabs: [], historico: [] });
  expect(it.find((x) => x.id === "teste").acoes.map((a) => a.id)).toEqual(["ver:teste"]);
  expect(it.find((x) => x.id === "teste").linhas).toEqual(["Ainda não há teste registrado."]);
  expect(it.find((x) => x.id === "plantao").linhas).toEqual(["Nenhum mapa de equipe enviado ainda."]);
  expect(it.find((x) => x.id === "equip").linhas).toEqual(["Sem inventário registrado."]);
  expect(itensUniversoCliente(null)).toEqual([]);
});

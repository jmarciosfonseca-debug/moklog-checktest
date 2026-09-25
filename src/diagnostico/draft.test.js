import { calcularProgresso, draftKey, lerRascunho, salvarRascunho } from "./draft";

function memoria() {
  const data = new Map();
  return { getItem: (k) => data.get(k) || null, setItem: (k, v) => data.set(k, v), removeItem: (k) => data.delete(k) };
}

test("chave de rascunho separa projeto e catálogo", () => {
  expect(draftKey("P601", "cat_v1")).toBe("moklog_diagnostico_draft_v1_P601_cat_v1");
});
test("salva e recupera rascunho versionado", () => {
  const storage = memoria();
  salvarRascunho("P601", "cat_v1", { A: { status: "conforme" } }, storage);
  expect(lerRascunho("P601", "cat_v1", storage).respostas.A.status).toBe("conforme");
});

test("calcula progresso respeitando N/A, sem dado e aplicabilidade padrão", () => {
  const itens = [
    { id: "A", aplicavelPadrao: true },
    { id: "B", aplicavelPadrao: true },
    { id: "C", aplicavelPadrao: true },
    { id: "D", aplicavelPadrao: false },
  ];
  const catalogo = { statusQueExcluemDenominador:["na"], statusQueNaoContamComoAvaliados:["na","sem_dado"] };
  const respostas = { A:{status:"conforme"}, B:{status:"sem_dado"}, C:{status:"na"}, D:{status:"parcial"} };
  expect(calcularProgresso(itens, respostas, catalogo)).toEqual({ avaliados:2, denominador:3, percentual:67 });
});

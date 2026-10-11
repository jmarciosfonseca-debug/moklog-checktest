import { mensagemAprovacoesLote } from "./equipeSolicitacoes";
import { envioPendente } from "./equipeAprovacao";

const ap = (id, item, extra = {}) => ({ id, item, qtd: 2, status: "pendente", aprovacao: "aprovado", aprovadoEm: "2026-10-11T10:00:00Z", ...extra });

test("mensagem em lote reúne colaboradores e assina o aprovador", () => {
  const m = mensagemAprovacoesLote("P606 · Golgi", [
    { colabNome: "Carlos", solicitacoes: [ap("1", "Coturno", { tamanho: "42" })] },
    { colabNome: "Alexandre", solicitacoes: [ap("2", "Camisa"), ap("3", "Calça")] },
  ]);
  expect(m).toContain("Total:* 3 item(ns) · 2 colaborador(es)");
  expect(m).toContain("*Carlos*");
  expect(m).toContain("Coturno (tam 42)");
  expect(m).toContain("Aprovado pelo");
});

test("não permite enviar item não aprovado", () => {
  expect(() => mensagemAprovacoesLote("P", [{ colabNome: "X", solicitacoes: [ap("1", "Item", { aprovacao: "aguardando" })] }])).toThrow();
});

test("só aprovado e ainda não enviado após a aprovação fica liberado ao líder", () => {
  expect(envioPendente(ap("1", "a"))).toBe(true);
  expect(envioPendente(ap("2", "a", { whatsEnviadoEm: "2026-10-11T11:00:00Z" }))).toBe(false);
  expect(envioPendente(ap("3", "a", { aprovacao: "negado" }))).toBe(false);
});

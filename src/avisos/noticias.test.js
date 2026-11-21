import { noticiasDoEntorno, carregarNoticias, _limparMemoriaNoticias } from "./noticias";

const AG = new Date("2026-11-21T15:00:00Z");
const it = (id, over = {}) => ({ id, tema: "seguranca", tipo: "furto", titulo: `Notícia ${id}`, resumo: "r", fonte: "G1", link: `https://x/${id}`, data: "2026-11-20T10:00:00Z", ...over });
beforeEach(() => _limparMemoriaNoticias());

describe("notícias de fora", () => {
  test("converte o Entorno: só projetos do painel, só últimos 14 dias, geral vira TODOS", () => {
    const resp = { docs: { P601: { itens: [it("a"), it("velha", { data: "2026-10-01T10:00:00Z" }), it("sem-titulo", { titulo: "" })] }, P999: { itens: [it("z")] } }, geral: { itens: [it("g", { tema: "mercado", tipo: "mercado" })] } };
    const n = noticiasDoEntorno(resp, { projetos: ["P601"], agora: AG });
    expect(n.map((x) => x.id)).toEqual(["ext:P601:a", "ext:TODOS:g"]);
    expect(n[1].sev).toBe("info");
  });
  test("item sem data não é descartado", () => {
    expect(noticiasDoEntorno({ docs: { P601: { itens: [it("a", { data: null })] } } }, { agora: AG })).toHaveLength(1);
  });
  test("leitura boa devolve notícias, sem erro", async () => {
    const r = await carregarNoticias({ projetos: ["P601"], ler: async () => ({ docs: { P601: { itens: [it("a")] } }, geral: null, erro: "" }), agora: AG });
    expect(r).toMatchObject({ erro: "", deMemoria: false });
    expect(r.noticias).toHaveLength(1);
  });
  test("falha sem leitura anterior: erro explícito e lista vazia (nunca 'sem notícias' silencioso)", async () => {
    const r = await carregarNoticias({ ler: async () => ({ docs: {}, erro: "Sem conexão com o servidor." }), agora: AG });
    expect(r).toMatchObject({ noticias: [], erro: "Sem conexão com o servidor.", deMemoria: false });
  });
  test("falha depois de uma leitura boa: mostra a anterior marcada como de memória, com o horário", async () => {
    await carregarNoticias({ ler: async () => ({ docs: { P601: { itens: [it("a")] } }, erro: "" }), agora: AG });
    const r = await carregarNoticias({ ler: async () => { throw new Error("rede"); }, agora: new Date("2026-11-21T16:00:00Z") });
    expect(r.deMemoria).toBe(true);
    expect(r.noticias).toHaveLength(1);
    expect(r.lidoEm).toEqual(AG);
    expect(r.erro).toMatch(/conexão/i);
  });
});

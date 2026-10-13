// Link de follow-up (todos os projetos do teste semanal): token, validade, papéis e passagem de bastão manutenção → Moked → administração.
const L = require("../api/ai/lib/followupLink");

function banco() {
  const dados = {};
  const ref = (col, id) => ({
    get: async () => ({ exists: dados[`${col}/${id}`] !== undefined, data: () => JSON.parse(JSON.stringify(dados[`${col}/${id}`])), ref: ref(col, id), id }),
    set: async (v) => { dados[`${col}/${id}`] = JSON.parse(JSON.stringify(v)); },
    update: async (v) => { dados[`${col}/${id}`] = { ...dados[`${col}/${id}`], ...JSON.parse(JSON.stringify(v)) }; },
  });
  return {
    dados,
    collection: (col) => ({
      doc: (id) => ref(col, id),
      where: (campo, _op, valor) => ({
        get: async () => ({ docs: Object.keys(dados).filter((k) => k.startsWith(col + "/") && dados[k][campo] === valor).map((k) => ({ id: k.split("/")[1], data: () => JSON.parse(JSON.stringify(dados[k])), ref: ref(col, k.split("/")[1]) })) }),
      }),
    }),
    runTransaction: async (fn) => fn({ get: (r) => r.get(), set: (r, v) => r.set(v) }),
  };
}

const T0 = Date.parse("2026-10-13T12:00:00Z");
const itens = [
  { key: "04cancelas__saida04", cat: "04 - CANCELAS", item: "Saída 04", status: "inop", since: "2026-10-01" },
  { key: "06cftv__cf35", cat: "06 - CFTV", item: "CF35", status: "partial", since: "2026-09-20" },
];
async function preparar() {
  const db = banco();
  const manut = await L.criar(db, { pid: "P601", papel: "manutencao", empresa: "Cancelas Brasil", projetoNome: "Golgi Cajamar", itens }, T0);
  const adm = await L.criar(db, { pid: "P601", papel: "administracao", empresa: "Administração Golgi", projetoNome: "Golgi Cajamar", itens }, T0);
  return { db, manut, adm };
}
const reg = (db, key) => db.dados["followups/P601"].registros.find((r) => r.key === key);

test("só gera link para projeto liberado, nome da empresa é opcional e o token fica só como hash no id", async () => {
  const db = banco();
  await expect(L.criar(db, { pid: "P999", papel: "manutencao", itens }, T0)).rejects.toThrow("não liberado");
  const semNome = await L.criar(db, { pid: "P602", papel: "administracao", itens: [] }, T0);
  expect(semNome.empresa).toBe("Administração");
  const { manut } = await preparar();
  expect(L.tokenValido(manut.token)).toBe(true);
  expect(manut.id).toBe(L.hashToken(manut.token));
  expect(manut.expiraEm).toBe(new Date(T0 + 15 * 86400000).toISOString());
});

test("link inválido, expirado ou revogado não abre", async () => {
  const { db, manut } = await preparar();
  await expect(L.ver(db, "x".repeat(43), T0)).rejects.toThrow("inválido ou expirado");
  await expect(L.ver(db, manut.token, T0 + 16 * 86400000)).rejects.toThrow("inválido ou expirado");
  await L.revogar(db, { pid: "P601", id: manut.id });
  await expect(L.ver(db, manut.token, T0)).rejects.toThrow("inválido ou expirado");
});

test("manutenção envia proposta: exige número, vai para a Moked e sai da mão dela", async () => {
  const { db, manut } = await preparar();
  await expect(L.enviar(db, manut.token, [{ key: itens[0].key, status: "proposta" }], T0)).rejects.toThrow("número da proposta");
  await L.enviar(db, manut.token, [
    { key: itens[0].key, status: "proposta", propostaNumero: "XYZ-123", propostaValor: "R$ 12.500,00", texto: "Troca da haste" },
    { key: itens[1].key, status: "aguardando", texto: "Câmera sem imagem; técnico vai na quinta", previsao: "2026-10-16" },
  ], T0);
  expect(reg(db, itens[0].key)).toMatchObject({ comQuem: "moked", pendenteValidacao: true, statusAtual: "proposta" });
  expect(reg(db, itens[0].key).entries[0]).toMatchObject({ origem: "link", responsavel: "Cancelas Brasil", proposta: { numero: "XYZ-123", valor: "R$ 12.500,00" } });
  expect(reg(db, itens[1].key)).toMatchObject({ comQuem: "manutencao", pendenteValidacao: false });
  // todo envio da empresa acende o aviso de "retorno novo" para a Moked
  expect(reg(db, itens[0].key)).toMatchObject({ retornoNovo: true });
  expect(reg(db, itens[1].key)).toMatchObject({ retornoNovo: true });
  // já está com a Moked: não dá para reenviar
  await expect(L.enviar(db, manut.token, [{ key: itens[0].key, status: "execucao", texto: "x" }], T0)).rejects.toThrow("já foi enviado");
});

test("item de outro projeto/inexistente e status fora da lista são recusados", async () => {
  const { db, manut } = await preparar();
  await expect(L.enviar(db, manut.token, [{ key: "outro__item", status: "aguardando", texto: "x" }], T0)).rejects.toThrow("não pertence");
  await expect(L.enviar(db, manut.token, [{ key: itens[0].key, status: "resolvido", texto: "x" }], T0)).rejects.toThrow("Situação inválida");
});

test("Moked encaminha; só a administração decide; aprovado volta à manutenção, reprovado volta à Moked", async () => {
  const { db, manut, adm } = await preparar();
  await L.enviar(db, manut.token, [{ key: itens[0].key, status: "proposta", propostaNumero: "9", texto: "t" }], T0);
  await expect(L.decidir(db, adm.token, { key: itens[0].key, decisao: "aprovado" }, T0)).rejects.toThrow("não está aguardando a administração");
  await L.mover(db, { pid: "P601", key: itens[0].key, para: "administracao" }, T0);
  expect(reg(db, itens[0].key)).toMatchObject({ comQuem: "administracao", retornoNovo: false }); // Moked já viu e agiu
  await expect(L.decidir(db, manut.token, { key: itens[0].key, decisao: "aprovado" }, T0)).rejects.toThrow("não permite aprovar");
  await L.decidir(db, adm.token, { key: itens[0].key, decisao: "aprovado", texto: "Ok, pode executar" }, T0);
  expect(reg(db, itens[0].key)).toMatchObject({ comQuem: "manutencao", statusAtual: "aprovado", retornoNovo: true });
  // reprovação em outro item
  await L.enviar(db, manut.token, [{ key: itens[1].key, status: "proposta", propostaNumero: "10", texto: "t" }], T0);
  await L.mover(db, { pid: "P601", key: itens[1].key, para: "administracao" }, T0);
  await L.decidir(db, adm.token, { key: itens[1].key, decisao: "reprovado", texto: "Valor alto" }, T0);
  expect(reg(db, itens[1].key)).toMatchObject({ comQuem: "moked", statusAtual: "reprovado", pendenteValidacao: true });
});

test("visão pública: a administração não envia, a manutenção não aprova, e o link não expõe token nem outros dados", async () => {
  const { db, manut, adm } = await preparar();
  await expect(L.enviar(db, adm.token, [{ key: itens[0].key, status: "aguardando", texto: "x" }], T0)).rejects.toThrow("não permite enviar");
  const v = await L.ver(db, manut.token, T0 + 86400000);
  expect(v).toMatchObject({ pid: "P601", papel: "manutencao", projeto: "Golgi Cajamar" });
  expect(v.itens).toHaveLength(2);
  expect(v.itens[0]).toMatchObject({ comQuem: "manutencao", dias: 13 });
  expect(JSON.stringify(v)).not.toContain(manut.token);
});

test("sincronizar atualiza os itens dos links ativos; item resolvido some da visão", async () => {
  const { db, manut } = await preparar();
  await L.sincronizar(db, { pid: "P601", itens: [itens[1]] }, T0);
  expect((await L.ver(db, manut.token, T0)).itens.map((i) => i.key)).toEqual([itens[1].key]);
  await L.mover(db, { pid: "P601", key: itens[1].key, para: "moked" }, T0);
  db.dados["followups/P601"].registros.find((r) => r.key === itens[1].key).resolvido = true;
  expect((await L.ver(db, manut.token, T0)).itens).toHaveLength(0);
});

test("listar devolve links ativos do projeto sem expor a lista de itens", async () => {
  const { db, manut } = await preparar();
  await L.revogar(db, { pid: "P601", id: manut.id });
  const lista = await L.listar(db, "P601");
  expect(lista).toHaveLength(1);
  expect(lista[0]).toMatchObject({ papel: "administracao", nItens: 2 });
  expect(lista[0].itens).toBeUndefined();
});

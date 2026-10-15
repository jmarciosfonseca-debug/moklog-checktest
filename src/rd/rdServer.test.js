const { executar } = require("./rdServer");
const clone = (x) => JSON.parse(JSON.stringify(x));
function banco() {
  const values = { "usuarios/g": { active: true, role: "gerente", scopeAll: true }, "usuarios/a": { active: true, role: "auditor" } };
  let version = 0;
  const query = (prefix, filters = [], lim = Infinity) => ({
    where: (f, op, v) => query(prefix, [...filters, [f, op, v]], lim), limit: (n) => query(prefix, filters, n),
    get: async () => ({ docs: Object.keys(values).filter((k) => k.startsWith(prefix + "/") && !k.slice(prefix.length + 1).includes("/"))
      .map((k) => ({ id: k.split("/").pop(), data: () => clone(values[k]) })).filter((d) => filters.every(([f, op, v]) => op === "==" && d.data()[f] === v)).slice(0, lim) }) });
  const ref = (path) => ({ path, get: async () => snap(path), set: async (d) => { values[path] = clone(d); } });
  const snap = (p) => ({ exists: values[p] != null, data: () => (values[p] == null ? undefined : clone(values[p])) });
  return { values, collection: (n) => ({ doc: (id) => ref(n + "/" + id), ...query(n) }),
    runTransaction: async (fn) => { for (let t = 0; t < 8; t++) { const sets = []; const v = version; const r = await fn({ get: async (x) => snap(x.path), set: (x, d) => sets.push([x.path, clone(d)]) }); if (v !== version) continue; sets.forEach(([k, d]) => { values[k] = d; }); if (sets.length) version++; return r; } throw Error("retry"); } };
}
const G = { uid: "g", role: "gerente", scopeAll: true }, A = { uid: "a", role: "auditor" };
const T = { id: "t1", origem: "MK_HOME", destino: "MK604", kmInicial: 100, kmFinal: null, abertura: { em: "2026-10-14T09:00:00.000Z", gps: { lat: -23.55, lng: -46.63, acc: 12 }, endereco: "Taboão da Serra - SP" }, chegada: null, pedagios: [], gastos: [], atividades: [], obs: "" };

test("salvar e ler o dia com revisão; GPS e endereço preservados; conflito de revisão recusado", async () => {
  const db = banco();
  const r = await executar(db, G, { acao: "salvar", data: "2026-10-14", revisao: 0, dia: { estado: "aberto", trechos: [T] } });
  expect(r.dia.revisao).toBe(1);
  expect(r.dia.trechos[0].abertura.gps).toEqual({ lat: -23.55, lng: -46.63, acc: 12 });
  const lido = await executar(db, G, { acao: "ler", data: "2026-10-14" });
  expect(lido.dia.trechos[0].abertura.endereco).toBe("Taboão da Serra - SP");
  await expect(executar(db, G, { acao: "salvar", data: "2026-10-14", revisao: 0, dia: { estado: "aberto", trechos: [T] } })).rejects.toMatchObject({ status: 409 });
});

test("memória salva junto, com revisão própria; pendências e rotas validadas", async () => {
  const db = banco();
  const memoria = { rotas: { "MK_HOME>MK604": { viagens: 1, kmMedia: 60, pedagios: [{ descricao: "SP-348", valor: 16 }] } }, pendencias: { MK604: [{ texto: "Orçamento", desde: "2026-10-14" }] }, destinosExtras: [{ codigo: "MK077", sub: "Fora da rotina" }], config: { valorKm: 1.8 } };
  const r = await executar(db, G, { acao: "salvar", data: "2026-10-14", revisao: 0, dia: { estado: "aberto", trechos: [T] }, memoria, memoriaRevisao: 0 });
  expect(r.memoria.revisao).toBe(1);
  expect((await executar(db, G, { acao: "ler", data: "2026-10-14" })).memoria.pendencias.MK604).toHaveLength(1);
  await expect(executar(db, G, { acao: "salvar", data: "2026-10-14", revisao: 1, dia: { estado: "aberto", trechos: [T] }, memoria, memoriaRevisao: 0 })).rejects.toMatchObject({ status: 409 });
});

test("isolamento por usuário: cada um só vê os próprios dias; lista ordenada do mais recente", async () => {
  const db = banco();
  await executar(db, G, { acao: "salvar", data: "2026-10-13", revisao: 0, dia: { estado: "fechado", trechos: [T] } });
  await executar(db, G, { acao: "salvar", data: "2026-10-14", revisao: 0, dia: { estado: "aberto", trechos: [T] } });
  await executar(db, A, { acao: "salvar", data: "2026-10-14", revisao: 0, dia: { estado: "aberto", trechos: [{ ...T, id: "tA" }] } });
  expect((await executar(db, G, { acao: "dias" })).dias.map((d) => d.data)).toEqual(["2026-10-14", "2026-10-13"]);
  expect((await executar(db, A, { acao: "dias" })).dias).toHaveLength(1);
  expect((await executar(db, A, { acao: "ler", data: "2026-10-13" })).dia).toBeNull();
});

test("periodo devolve os dias completos do intervalo com a memória, só do próprio usuário", async () => {
  const db = banco();
  for (const d of ["2026-08-19", "2026-08-20", "2026-09-18", "2026-09-19"]) await executar(db, G, { acao: "salvar", data: d, revisao: 0, dia: { estado: "fechado", trechos: [T] } });
  await executar(db, A, { acao: "salvar", data: "2026-08-25", revisao: 0, dia: { estado: "fechado", trechos: [{ ...T, id: "tA" }] } });
  const r = await executar(db, G, { acao: "periodo", de: "2026-08-20", ate: "2026-09-18" });
  expect(r.dias.map((d) => d.data)).toEqual(["2026-08-20", "2026-09-18"]);
  expect(r.dias[0].trechos).toHaveLength(1);
  await expect(executar(db, G, { acao: "periodo", de: "2026-09-18", ate: "2026-08-20" })).rejects.toMatchObject({ status: 400 });
});

test("horário editado pelo consultor é preservado", async () => {
  const db = banco();
  const r = await executar(db, G, { acao: "salvar", data: "2026-10-14", revisao: 0, dia: { estado: "aberto", trechos: [{ ...T, abertura: { ...T.abertura, editado: true } }] } });
  expect(r.dia.trechos[0].abertura.editado).toBe(true);
});

test("validações: dois trechos abertos, destino inválido e data inválida são recusados", async () => {
  const db = banco();
  await expect(executar(db, G, { acao: "salvar", data: "2026-10-14", revisao: 0, dia: { estado: "aberto", trechos: [T, { ...T, id: "t2" }] } })).rejects.toMatchObject({ status: 400 });
  await expect(executar(db, G, { acao: "salvar", data: "2026-10-14", revisao: 0, dia: { estado: "aberto", trechos: [{ ...T, destino: "P604" }] } })).rejects.toMatchObject({ status: 400 });
  await expect(executar(db, G, { acao: "ler", data: "14/10/2026" })).rejects.toMatchObject({ status: 400 });
  await expect(executar(db, { uid: "x", role: "equipe" }, { acao: "ler", data: "2026-10-14" })).rejects.toMatchObject({ status: 403 });
});

test("comprovante: salva comprimido, é imutável, só o dono lê; foto inválida é recusada", async () => {
  const db = banco();
  const b64 = "data:image/jpeg;base64," + "A".repeat(2000);
  const r = await executar(db, G, { acao: "foto_salvar", fotoId: "fabc123", b64 });
  expect(r.fotoId).toBe("fabc123");
  await executar(db, G, { acao: "foto_salvar", fotoId: "fabc123", b64: "data:image/jpeg;base64,BBBB" }); // regravar é ignorado
  expect(db.values["rd_comprovantes/g_fabc123"].b64).toBe(b64);
  expect((await executar(db, G, { acao: "fotos_ler", ids: ["fabc123", "fnada99"] })).fotos).toEqual({ fabc123: b64 });
  expect((await executar(db, A, { acao: "fotos_ler", ids: ["fabc123"] })).fotos).toEqual({});
  await expect(executar(db, G, { acao: "foto_salvar", fotoId: "fx1234", b64: "data:text/html;base64,AAAA" })).rejects.toMatchObject({ status: 400 });
  await expect(executar(db, G, { acao: "foto_salvar", fotoId: "fx1234", b64: "data:image/jpeg;base64," + "A".repeat(260000) })).rejects.toMatchObject({ status: 400 });
});

test("gasto com fotoId e trecho com veículo moto são preservados", async () => {
  const db = banco();
  const t2 = { ...T, veiculo: "moto", gastos: [{ descricao: "Estacionamento", valor: 20, fotoId: "fabc123" }] };
  const r = await executar(db, G, { acao: "salvar", data: "2026-10-14", revisao: 0, dia: { estado: "aberto", trechos: [t2] } });
  expect(r.dia.trechos[0].veiculo).toBe("moto");
  expect(r.dia.trechos[0].gastos[0].fotoId).toBe("fabc123");
  const semV = await executar(db, G, { acao: "salvar", data: "2026-10-15", revisao: 0, dia: { estado: "aberto", trechos: [{ ...T }] } });
  expect(semV.dia.trechos[0].veiculo).toBe("carro");   // padrão
});

test("acesso via PIN gerencial sem perfil em usuarios (identidade 'gerencial') grava e lê normalmente", async () => {
  const db = banco();
  const P = { uid: "gerencial", role: "gerente", viaPin: true };   // api/rd.js monta isso quando o token é do PIN do app
  const r = await executar(db, P, { acao: "salvar", data: "2026-10-15", revisao: 0, dia: { estado: "aberto", trechos: [T] } });
  expect(r.dia.revisao).toBe(1);
  expect((await executar(db, P, { acao: "ler", data: "2026-10-15" })).dia.trechos).toHaveLength(1);
  // sem viaPin, o mesmo uid sem perfil cadastrado continua barrado
  await expect(executar(db, { uid: "gerencial", role: "gerente" }, { acao: "salvar", data: "2026-10-16", revisao: 0, dia: { estado: "aberto", trechos: [T] } })).rejects.toMatchObject({ status: 403 });
});

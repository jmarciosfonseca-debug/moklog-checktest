// Leitura em tempo real dos mapas do plantão: onSnapshot por plantão da janela de 24 h, sem releitura por tempo.
const mockAssin = [];
jest.mock("firebase/app", () => ({ getApps: () => [{}] }));
jest.mock("firebase/firestore", () => ({
  getFirestore: () => ({}),
  doc: (_db, ...caminho) => ({ caminho: caminho.join("/") }),
  getDoc: jest.fn(async () => ({ exists: () => false, data: () => ({}) })),
  onSnapshot: (ref, ok, erro) => { const a = { caminho: ref.caminho, ok, erro, ativo: true }; mockAssin.push(a); return () => { a.ativo = false; }; },
}));
import { assinarFontes } from "./fontes";

const snap = (dados) => ({ exists: () => dados !== null, data: () => dados });
const mapas = (pid) => mockAssin.filter((a) => a.ativo && a.caminho.startsWith(`equipes/${pid}/mapas/`));
let h, onDados, onErro;
const iniciar = (gerencial = true) => { onDados = jest.fn(); onErro = jest.fn(); h = assinarFontes({ projetos: [], gerencial, onDados, onErro, intervaloMapasMs: 60000 }); };
afterEach(() => { if (h) h.parar(); h = null; mockAssin.length = 0; jest.useRealTimers(); });

test("perfil não gerencial não assina os mapas (nome de quem faltou não sai do gerencial)", () => {
  jest.useFakeTimers().setSystemTime(new Date("2026-10-12T10:00:00-03:00"));
  iniciar(false);
  expect(mapas("P606")).toHaveLength(0);
});

test("liga o plantão atual e o anterior (janela de 24 h) de cada projeto", () => {
  jest.useFakeTimers().setSystemTime(new Date("2026-10-12T10:00:00-03:00"));
  iniciar();
  expect(mapas("P606").map((a) => a.caminho.split("/").pop()).sort()).toEqual(["P606_2026-10-11_N", "P606_2026-10-12_D"]);
  expect(mapas("P607").length).toBe(2);
  expect(h.esperados).toBeGreaterThanOrEqual(12);
});

test("só entrega o projeto quando TODOS os plantões responderam; depois, cada mudança chega na hora", () => {
  jest.useFakeTimers().setSystemTime(new Date("2026-10-12T10:00:00-03:00"));
  iniciar();
  const [a, b] = mapas("P606");
  a.ok(snap({ status: "rascunho", postos: [] }));
  expect(onDados.mock.calls.filter((c) => c[1] === "P606")).toHaveLength(0);
  b.ok(snap(null));
  const entregues = onDados.mock.calls.filter((c) => c[1] === "P606");
  expect(entregues).toHaveLength(1);
  expect(Object.values(entregues[0][2]).filter((v) => v === null)).toHaveLength(1); // documento que não existe = null
  a.ok(snap({ status: "rascunho", postos: [{ situacao: "falta" }] })); // o líder marcou falta
  expect(onDados.mock.calls.filter((c) => c[1] === "P606")).toHaveLength(2);
});

test("quando o plantão vira, o que saiu da janela é desligado e o novo é ligado (sem esperar o app reabrir)", () => {
  jest.useFakeTimers().setSystemTime(new Date("2026-10-12T17:59:00-03:00"));
  iniciar();
  const antes = mapas("P606").map((a) => a.caminho.split("/").pop()).sort();
  expect(antes).toEqual(["P606_2026-10-11_N", "P606_2026-10-12_D"].sort());
  jest.setSystemTime(new Date("2026-10-12T19:30:00-03:00")); // noturno de 12/10 começou às 19:00 em P606
  jest.advanceTimersByTime(60000);
  const depois = mapas("P606").map((a) => a.caminho.split("/").pop()).sort();
  expect(depois).toEqual(["P606_2026-10-12_D", "P606_2026-10-12_N"].sort());
  expect(mockAssin.find((a) => a.caminho.endsWith("P606_2026-10-11_N")).ativo).toBe(false);
});

test("erro de leitura é informado e a assinatura é refeita na rodada seguinte", () => {
  jest.useFakeTimers().setSystemTime(new Date("2026-10-12T10:00:00-03:00"));
  iniciar();
  const [a, b] = mapas("P606");
  b.ok(snap(null));
  a.erro(new Error("permissão"));
  expect(onErro.mock.calls.some((c) => c[0] === "mapas" && c[1] === "P606" && c[2] instanceof Error)).toBe(true);
  const antes = mockAssin.length;
  jest.advanceTimersByTime(60000);
  expect(mockAssin.length).toBeGreaterThan(antes); // refez a assinatura que caiu
  const nova = mapas("P606").find((x) => x.caminho === a.caminho && x !== a);
  nova.ok(snap({ status: "enviado", postos: [] }));
  expect(onErro.mock.calls.filter((c) => c[1] === "P606").pop()[2]).toBeNull(); // voltou
});

test("parar desliga todas as assinaturas", () => {
  jest.useFakeTimers().setSystemTime(new Date("2026-10-12T10:00:00-03:00"));
  iniciar();
  expect(mapas("P606").length).toBe(2);
  h.parar();
  expect(mockAssin.some((a) => a.ativo)).toBe(false);
  h = null;
});

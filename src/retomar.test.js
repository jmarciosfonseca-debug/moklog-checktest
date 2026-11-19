import { aberturaFria, lerRetomada, salvarLocal, marcarVisto, CHAVE_LOCAL, JANELA_RETOMAR_MS } from "./retomar";

const sessao = (nivel, extra = {}) => { const f = Date.now() + 3600e3; localStorage.setItem("moklog_session_v2", JSON.stringify({ token: "t", nivel, exp: f, srvExp: f, ...extra })); };
beforeEach(() => { localStorage.clear(); jest.resetModules(); });

test("sem sessão a abertura toca", () => { expect(aberturaFria()).toBe(true); });

test("salvarLocal só guarda moklog/cliente; em entrada apaga", () => {
  salvarLocal({ portal: "moklog", divisao: "moklog", homeGroup: "golgi" });
  expect(JSON.parse(localStorage.getItem(CHAVE_LOCAL)).homeGroup).toBe("golgi");
  salvarLocal({ portal: "entrada" });
  expect(localStorage.getItem(CHAVE_LOCAL)).toBeNull();
});

test("retomada fora da janela ou sem sessão não volta", () => {
  const agora = Date.now();
  salvarLocal({ portal: "moklog", divisao: "moklog", homeGroup: "golgi" }, agora - JANELA_RETOMAR_MS - 1000);
  expect(lerRetomada(agora)).toBeNull();
  salvarLocal({ portal: "moklog", divisao: "moklog", homeGroup: "golgi" }, agora);
  expect(lerRetomada(agora)).toBeNull(); // sem sessão gerencial
});

test("estado corrompido não quebra", () => {
  localStorage.setItem(CHAVE_LOCAL, "{ruim");
  expect(lerRetomada()).toBeNull();
});

test("com sessão ativa e uso recente: retoma o grupo e a abertura não toca", () => {
  sessao("demo");
  const m = require("./retomar");
  m.salvarLocal({ portal: "moklog", divisao: "moklog", homeGroup: "golgi" });
  expect(m.lerRetomada()).toEqual({ portal: "moklog", divisao: "moklog", homeGroup: "golgi" });
  expect(m.aberturaFria()).toBe(false);
});

test("sessão ativa mas app parado além da janela: abertura toca de novo", () => {
  sessao("demo");
  const m = require("./retomar");
  m.marcarVisto(Date.now() - JANELA_RETOMAR_MS - 5000);
  expect(m.aberturaFria()).toBe(true);
});

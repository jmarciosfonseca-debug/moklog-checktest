import { lerConexao, assinarConexao, definirOnline, definirPendentes, marcarSincronizando, registrarSync, resumoConexao, iniciarConexao, _reiniciarConexao } from "./conexao";

beforeEach(() => _reiniciarConexao());

describe("estado de conexão único", () => {
  test("começa online, sem pendência", () => {
    expect(lerConexao()).toMatchObject({ online: true, sincronizando: false, pendentes: 0 });
    expect(resumoConexao().chave).toBe("online");
  });
  test("ouvintes são avisados só quando algo muda, e um defeituoso não derruba os outros", () => {
    const a = jest.fn(), b = jest.fn(() => { throw new Error("x"); }), c = jest.fn();
    assinarConexao(b); assinarConexao(a); const sai = assinarConexao(c);
    definirOnline(true);                  // sem mudança
    expect(a).not.toHaveBeenCalled();
    definirOnline(false);
    expect(a).toHaveBeenCalledTimes(1);
    expect(c).toHaveBeenCalledTimes(1);
    sai(); definirOnline(true);
    expect(c).toHaveBeenCalledTimes(1);
    expect(a).toHaveBeenCalledTimes(2);
  });
  test("resumo: offline com e sem pendência, pendente, sincronizando e erro", () => {
    definirOnline(false);
    expect(resumoConexao().texto).toMatch(/último dado/);
    definirPendentes(1);
    expect(resumoConexao().texto).toBe("Sem conexão · 1 envio pendente");
    definirPendentes(3);
    expect(resumoConexao().texto).toBe("Sem conexão · 3 envios pendentes");
    definirOnline(true);
    expect(resumoConexao().chave).toBe("pendente");
    marcarSincronizando(true);
    expect(resumoConexao().chave).toBe("sincronizando");
    registrarSync(false, "Conflito na equipe");
    expect(resumoConexao()).toEqual({ chave: "erro", texto: "Conflito na equipe" });
    definirPendentes(0);
    registrarSync(true, "", new Date("2026-11-21T15:00:00"));
    expect(resumoConexao().chave).toBe("online");
    expect(lerConexao().ultimoSyncEm).toEqual(new Date("2026-11-21T15:00:00"));
  });
  test("pendentes nunca fica negativo nem NaN", () => {
    definirPendentes(-4); expect(lerConexao().pendentes).toBe(0);
    definirPendentes("abc"); expect(lerConexao().pendentes).toBe(0);
    definirPendentes(2.9); expect(lerConexao().pendentes).toBe(2);
  });
  test("iniciarConexao acompanha online/offline do aparelho e desliga limpo", () => {
    const h = {};
    const win = { navigator: { onLine: false }, addEventListener: (e, f) => { h[e] = f; }, removeEventListener: (e) => { delete h[e]; } };
    const parar = iniciarConexao(win);
    expect(lerConexao().online).toBe(false);
    h.online(); expect(lerConexao().online).toBe(true);
    h.offline(); expect(lerConexao().online).toBe(false);
    parar(); expect(h.online).toBeUndefined();
    expect(() => iniciarConexao(null)()).not.toThrow();
  });
});

import { importarComRetry } from "./lazyTela";

const winFalso = (ult) => {
  const store = ult ? { "mk-chunk-reload": String(ult) } : {};
  return { sessionStorage: { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } }, location: { reload: jest.fn() }, _store: store };
};

describe("importarComRetry", () => {
  test("resolve de primeira sem recarregar", async () => {
    const win = winFalso();
    await expect(importarComRetry(() => Promise.resolve("ok"), { win })).resolves.toBe("ok");
    expect(win.location.reload).not.toHaveBeenCalled();
  });
  test("tenta de novo e resolve se a segunda der certo", async () => {
    const win = winFalso();
    const f = jest.fn().mockRejectedValueOnce(new Error("rede")).mockResolvedValueOnce("ok");
    await expect(importarComRetry(f, { win, espera: 1 })).resolves.toBe("ok");
    expect(f).toHaveBeenCalledTimes(2);
    expect(win.location.reload).not.toHaveBeenCalled();
  });
  test("esgotadas as tentativas, recarrega o app uma vez e não rejeita", async () => {
    const win = winFalso();
    const f = jest.fn().mockRejectedValue(new Error("chunk velho"));
    let terminou = false;
    importarComRetry(f, { win, espera: 1 }).then(() => { terminou = true; }, () => { terminou = true; });
    await new Promise((r) => setTimeout(r, 60));
    expect(f).toHaveBeenCalledTimes(3);
    expect(win.location.reload).toHaveBeenCalledTimes(1);
    expect(terminou).toBe(false);
  });
  test("se acabou de recarregar (menos de 1 min), mostra o erro em vez de entrar em laço", async () => {
    const win = winFalso(Date.now());
    const f = jest.fn().mockRejectedValue(new Error("servidor fora"));
    await expect(importarComRetry(f, { win, espera: 1 })).rejects.toThrow("servidor fora");
    expect(win.location.reload).not.toHaveBeenCalled();
  });
  test("sessionStorage bloqueado não esconde o erro", async () => {
    const win = { sessionStorage: { getItem() { throw new Error("bloqueado"); } }, location: { reload: jest.fn() } };
    await expect(importarComRetry(() => Promise.reject(new Error("x")), { win, espera: 1 })).rejects.toThrow("x");
  });
});

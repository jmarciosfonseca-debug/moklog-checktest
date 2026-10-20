import { ordenarRecentePrimeiro, cortarCascata } from "./listaCascata";
test("mais recente primeiro; empate mantém ordem de inserção; registro com data retroativa vai para o lugar certo", () => {
  const l = [{ id: 1, data: "2026-10-18" }, { id: 2, data: "2026-10-20" }, { id: 3, data: "2026-10-05" }, { id: 4, data: "2026-10-20" }];
  expect(ordenarRecentePrimeiro(l).map(x => x.id)).toEqual([2, 4, 1, 3]);
  expect(ordenarRecentePrimeiro([{ id: 1, em: "2026-01-01T10:00" }, { id: 2, em: "2026-02-01T10:00" }]).map(x => x.id)).toEqual([2, 1]);
  expect(ordenarRecentePrimeiro(null)).toEqual([]);
});
test("cascata: 3 visíveis e o resto no ver mais", () => {
  const l = [1, 2, 3, 4, 5];
  expect(cortarCascata(l, false)).toEqual({ itens: [1, 2, 3], resto: 2, cabe: true });
  expect(cortarCascata(l, true).itens).toHaveLength(5);
  expect(cortarCascata([1, 2], false)).toEqual({ itens: [1, 2], resto: 0, cabe: false });
});

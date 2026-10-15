// BUG P505: o doc único do bolsão estourou 1 MB (fotos base64 embutidas) e TODA gravação passou a falhar.
// Estes testes cobrem a separação das fotos e a mescla servidor+aparelho que preserva o que ficou só no celular.
import { mesclarDados, separarFotos } from "./BolsaoInquilinos";

test("mescla: checagens que só existem no aparelho (gravação falhada) são preservadas; placas ficam com a última vista", () => {
  const servidor = { placas: { ABC1D23: { placa: "ABC1D23", ultimaVista: "2026-08-11T23:17:00Z", diasConsecutivos: 3 } },
    checagens: [{ id: "c1", criadoEm: "2026-08-11T23:17:00Z" }] };
  const local = { placas: { ABC1D23: { placa: "ABC1D23", ultimaVista: "2026-10-14T05:25:00Z", diasConsecutivos: 6 } },
    checagens: [{ id: "c1", criadoEm: "2026-08-11T23:17:00Z" }, { id: "c2", criadoEm: "2026-10-13T05:00:00Z" }, { id: "c3", criadoEm: "2026-10-14T05:25:00Z" }] };
  const m = mesclarDados(servidor, local);
  expect(m.checagens.map((c) => c.id)).toEqual(["c1", "c2", "c3"]);
  expect(m.placas.ABC1D23.diasConsecutivos).toBe(6);
  expect(mesclarDados(null, local).checagens).toHaveLength(3);
  expect(mesclarDados(servidor, null).checagens).toHaveLength(1);
});

test("separarFotos: base64 sai do documento e vira referência; falha de upload mantém a foto embutida (nada se perde)", async () => {
  const gravadas = {};
  const gravar = async (fid, b64) => { if (b64.includes("RUIM")) throw new Error("rede"); gravadas[fid] = b64; };
  const checagens = [
    { id: "c1", fotos: ["data:image/jpeg;base64,AAA", "data:image/jpeg;base64,RUIM"] },
    { id: "c2", fotos: [] },
    { id: "c3" },
  ];
  const out = await separarFotos("P505", checagens, gravar);
  expect(out[0].fotoRefs).toHaveLength(1);
  expect(out[0].fotos).toEqual(["data:image/jpeg;base64,RUIM"]);     // a que falhou fica embutida
  expect(Object.values(gravadas)).toEqual(["data:image/jpeg;base64,AAA"]);
  expect(out[1].fotos).toEqual([]);
  expect(out[2].fotoRefs).toBeUndefined();
  // documento final sem base64 das fotos migradas
  expect(JSON.stringify(out)).not.toContain("base64,AAA");
});

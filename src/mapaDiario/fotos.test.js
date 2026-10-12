import { montarFotos, fotoDaPessoa, iniciais, normNome } from "./fotos";

jest.mock("firebase/app", () => ({ getApps: () => [] }));
jest.mock("firebase/firestore", () => ({ getFirestore: () => ({}), doc: jest.fn(), getDoc: jest.fn(), collection: jest.fn(), getDocs: jest.fn(), getDocsFromServer: jest.fn() }));

const F1 = "data:image/jpeg;base64,AAA", F2 = "data:image/jpeg;base64,BBB";
const colabs = [
  { id: "a", nome: "Elaine Farias Pereira", fotoRef: "a-1" },
  { id: "b", nome: "Rosemeire Corrêa", foto: F2 },
  { id: "c", nome: "Sem Foto" },
  { id: "d", nome: "Removida", fotoRef: "d-1", temFoto: false },
  { id: "e", nome: "Ref Não Carregou", fotoRef: "e-1" },
];
const f = montarFotos(colabs, { "a-1": F1, "d-1": F1 });

test("resolve foto por referência, legada, e respeita temFoto:false e foto ainda não carregada", () => {
  expect(f.porId.a).toBe(F1);
  expect(f.porId.b).toBe(F2);
  expect(f.porId.c).toBeUndefined();
  expect(f.porId.d).toBeUndefined();
  expect(f.porId.e).toBeUndefined();
});
test("busca por id e, sem id, pelo nome completo (sem acento, caixa ou espaço duplo)", () => {
  expect(fotoDaPessoa(f, "a", "qualquer")).toBe(F1);
  expect(fotoDaPessoa(f, "", "  elaine  FARIAS pereira ")).toBe(F1);
  expect(fotoDaPessoa(f, "", "Rosemeire Correa")).toBe(F2);
  expect(fotoDaPessoa(f, "", "Elaine")).toBe(""); // nome parcial não adivinha
  expect(fotoDaPessoa(null, "a", "x")).toBe("");
  expect(normNome("Ação  Ré")).toBe("acao re");
});
test("iniciais", () => {
  expect(iniciais("Elaine Farias Pereira")).toBe("EP");
  expect(iniciais("Murilo")).toBe("M");
  expect(iniciais("")).toBe("?");
});

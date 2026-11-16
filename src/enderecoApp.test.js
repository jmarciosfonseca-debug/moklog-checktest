// Marcio, 16/11/2026: o endereço do app passa a ser moked-checktest; nenhum link gerado pode sair com o nome antigo.
import fs from "fs";
import path from "path";
import { ENDERECO_APP } from "./enderecoApp";
import { linkLocal, textoCompartilhar } from "./cliente/Localizacao";
import { urlDoLink } from "./followupLink/api";

jest.mock("firebase/app", () => ({ getApps: () => [] }));
jest.mock("firebase/firestore", () => ({ getFirestore: () => ({}), doc: jest.fn(), getDoc: jest.fn() }));

test("links gerados pelo app usam o endereço novo", () => {
  expect(ENDERECO_APP).toBe("https://moked-checktest.vercel.app");
  expect(linkLocal("P601")).toBe("https://moked-checktest.vercel.app/local/P601");
  expect(textoCompartilhar("P601", "Golgi Cajamar").split("\n")[0]).toBe("https://moked-checktest.vercel.app/local/P601");
  expect(urlDoLink("abc", "https://moklog-checktest.vercel.app")).toBe("https://moked-checktest.vercel.app/?fu=abc"); // aberto pelo endereço antigo: o link sai com o novo
});
test("nenhum arquivo do app ou do servidor fixa o endereço antigo (fora o identificador da Firebase)", () => {
  const raiz = path.join(__dirname, "..");
  const listar = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === "node_modules" ? [] : listar(path.join(dir, e.name))) : /\.(js|jsx|html)$/.test(e.name) && !/\.test\.js$/.test(e.name) ? [path.join(dir, e.name)] : []));
  const achados = ["src", "api", "public"].flatMap((d) => listar(path.join(raiz, d))).filter((f) => !/enderecoApp\.js$/.test(f) && /moklog-checktest\.vercel\.app/.test(fs.readFileSync(f, "utf8")));
  expect(achados.map((f) => path.relative(raiz, f))).toEqual([]);
});

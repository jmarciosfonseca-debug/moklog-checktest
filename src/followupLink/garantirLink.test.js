import { garantirLinkManutencao, itensDoLaudoParaLink, VALIDADE_DIAS } from "./garantirLink";
import { canonicalFollowupKey } from "../followups";

const P605 = { id: "P605", name: "Golgi Dutra" };
const itens = [
  { cat: "06 - CFTV", item: "MD 05", status: "inop", since: "2026-08-21", note: "Perda de imagem" },
  { cat: "05 - CANCELAS AS", item: "Saída 04", status: "partial", since: "2026-06-07", note: "" },
  { cat: "01 - ALARME", item: "Zona 01", status: "ok" },
  { cat: "06 - CFTV", item: "demais", status: "ok", agregado: true, qtd: 40 },
  { cat: "25 - TOTENS", item: "25 - TOTENS", status: "inop", unico: true, since: "2026-01-01" },
];
const AGORA = Date.parse("2026-10-13T12:00:00Z");
const TOKEN = "t".repeat(43);

function servidor(links = []) {
  const chamadas = [];
  const chamar = async (acao, corpo) => {
    chamadas.push({ acao, ...corpo });
    if (acao === "listar") return { links };
    if (acao === "criar") return { id: "id-" + corpo.papel, token: TOKEN, papel: corpo.papel, expiraEm: new Date(AGORA + 60 * 86400000).toISOString(), itensEm: new Date(AGORA).toISOString() };
    return { ok: true };
  };
  return { chamar, chamadas };
}

test("itens do laudo: só falhas, chave igual à do follow-up, item único vira '—'", () => {
  const r = itensDoLaudoParaLink(P605, itens);
  expect(r.map((x) => x.item)).toEqual(["MD 05", "Saída 04", "—"]);
  expect(r[0].key).toBe(canonicalFollowupKey("P605", "06 - CFTV", "MD 05"));
  expect(r[1].status).toBe("partial");
  expect(r[2].key).toBe(canonicalFollowupKey("P605", "25 - TOTENS", "—"));
});

test("projeto sem link: cria manutenção e administração (60 dias) com os itens do laudo e devolve o link do projeto", async () => {
  const { chamar, chamadas } = servidor([]);
  const r = await garantirLinkManutencao({ project: P605, itens, nomeProjeto: "Golgi Dutra", gerencialAtivo: true, chamar, agora: AGORA });
  const criados = chamadas.filter((c) => c.acao === "criar");
  expect(criados.map((c) => c.papel)).toEqual(["manutencao", "administracao"]);
  criados.forEach((c) => { expect(c.pid).toBe("P605"); expect(c.dias).toBe(VALIDADE_DIAS); expect(c.itens).toHaveLength(3); });
  expect(r.link.token).toBe(TOKEN);
  expect(r.novo).toBe(true);
});

test("link vencido ou perto de vencer é renovado; link saudável é mantido", async () => {
  const mk = (papel, dias) => ({ id: "id-" + papel, papel, token: TOKEN, expiraEm: new Date(AGORA + dias * 86400000).toISOString(), itensEm: "2026-10-01T00:00:00Z" });
  let s = servidor([mk("manutencao", -3), mk("administracao", 40)]);
  let r = await garantirLinkManutencao({ project: P605, itens, nomeProjeto: "x", gerencialAtivo: true, chamar: s.chamar, agora: AGORA });
  expect(s.chamadas.filter((c) => c.acao === "renovar")).toEqual([{ acao: "renovar", pid: "P605", id: "id-manutencao", dias: VALIDADE_DIAS }]);
  expect(r.renovado).toBe(true);
  expect(s.chamadas.some((c) => c.acao === "criar")).toBe(false);
  s = servidor([mk("manutencao", 40), mk("administracao", 40)]);
  r = await garantirLinkManutencao({ project: P605, itens, nomeProjeto: "x", gerencialAtivo: true, chamar: s.chamar, agora: AGORA });
  expect(s.chamadas.some((c) => c.acao === "renovar" || c.acao === "criar")).toBe(false);
  expect(r.link.token).toBe(TOKEN);
});

test("sincroniza itens só quando o teste não é mais antigo que a última atualização", async () => {
  const mk = (papel) => ({ id: "id-" + papel, papel, token: TOKEN, expiraEm: new Date(AGORA + 40 * 86400000).toISOString(), itensEm: "2026-10-12T10:00:00Z" });
  let s = servidor([mk("manutencao"), mk("administracao")]);
  await garantirLinkManutencao({ project: P605, itens, nomeProjeto: "x", gerencialAtivo: true, chamar: s.chamar, dataTeste: "2026-10-13", agora: AGORA });
  expect(s.chamadas.filter((c) => c.acao === "sincronizar")).toHaveLength(1);
  s = servidor([mk("manutencao"), mk("administracao")]);
  await garantirLinkManutencao({ project: P605, itens, nomeProjeto: "x", gerencialAtivo: true, chamar: s.chamar, dataTeste: "2026-10-04", agora: AGORA });
  expect(s.chamadas.some((c) => c.acao === "sincronizar")).toBe(false);
});

test("sem sessão gerencial ou projeto fora da lista: sem link, com motivo, sem chamar o servidor", async () => {
  const s = servidor([]);
  let r = await garantirLinkManutencao({ project: P605, itens, nomeProjeto: "x", gerencialAtivo: false, chamar: s.chamar, agora: AGORA });
  expect(r.link).toBeUndefined(); expect(r.motivo).toMatch(/gerencial/);
  r = await garantirLinkManutencao({ project: { id: "P999" }, itens, nomeProjeto: "x", gerencialAtivo: true, chamar: s.chamar, agora: AGORA });
  expect(r.link).toBeUndefined();
  expect(s.chamadas).toHaveLength(0);
});

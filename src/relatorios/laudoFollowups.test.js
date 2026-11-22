// 22/11/2026 (Marcio): follow-ups no laudo semanal sem repetição — itens iguais numa linha, tratativa compartilhada impressa uma vez.
import { montarLaudoSemanal, agruparPendencias, chaveTratativa, chaveEntrada, pendenciasDoLaudo, entradasRecentes, MAX_TRAT_ENTRADAS } from "./laudoSemanal";
import { itensDoEstado } from "./metricas";
import { projetoP601, estadoP601, followupsP601, hojeP601 } from "./laudoFollowups.fixture";

const html = () => montarLaudoSemanal(projetoP601, estadoP601, { date: "2026-11-22" }, { followupsInfo: followupsP601, hoje: hojeP601 });
const cont = (s, re) => (s.match(re) || []).length;

test("cenário P601: 26 pendências, mas cada follow-up repetido sai uma só vez", () => {
  const pend = pendenciasDoLaudo(projetoP601, itensDoEstado(projetoP601, estadoP601), followupsP601, hojeP601);
  expect(pend).toHaveLength(26);
  const h = html();
  expect(h).toContain("26 itens, por tempo em aberto");
  expect(cont(h, /OS 81700098/g)).toBe(1); // era 7
  expect(cont(h, /Placa controladora da cancela 03/g)).toBe(1); // era 6 (4 + 2 do histórico)
  expect(cont(h, /Há proposta em aberto, pendente aprovação/g)).toBe(1); // era 3
  expect(cont(h, /Orç\. 2026005613/g)).toBe(1); // torniquetes: Entrada 02 e Saída 02 iguais = uma linha, tratativa inline
});

test("itens iguais viram uma linha com a lista; itens diferentes não se misturam", () => {
  const g = agruparPendencias(pendenciasDoLaudo(projetoP601, itensDoEstado(projetoP601, estadoP601), followupsP601, hojeP601));
  const cftv = g.find((x) => x.itens[0].cat.includes("CFTV") && x.itens.length > 1);
  expect(cftv.itens.map((i) => i.item).sort()).toEqual(["CF-41", "CF-43", "CF-44", "CF-45", "CF-46", "SD-02"]);
  const h = html();
  expect(h).toContain("<b>6 itens</b>");
  expect(h).toContain("CF-41, CF-43, CF-44, CF-45, CF-46, SD-02");
  // CF-48 (sem tratativa) e CF-42 (início em 22/11) ficam à parte; nenhum item some do laudo
  ["CF-48", "CF-42", "Zona 01", "Zona 02", "Acesso 01", "Acesso 03"].forEach((n) => expect(h).toContain(n));
  expect(g.reduce((s, x) => s + x.itens.length, 0)).toBe(26);
  expect(g.length).toBeLessThan(26);
});

test("registro que vale para vários itens: bloco T1, T2… com a lista do que ele cobre e remissão (→ T1) nas linhas", () => {
  const h = html();
  expect(h).toContain("Registros que valem para vários itens");
  expect(h).toMatch(/T1 · vale para \d+ itens/);
  expect(h).toMatch(/→ T1/);
  const cobre = h.slice(h.indexOf("T1 · vale para"));
  expect(cobre.slice(0, 1200)).toContain("Acesso 03");
  expect(cont(h, /vale para \d+ iten/g)).toBeGreaterThanOrEqual(3);
});

test("tratativa de uma linha só continua inline, como antes; sem tratativa continua 'Sem tratativa'", () => {
  const h = html();
  expect(h).toContain("Tratativas registradas (2)"); // Zona 02 (OS 81774223 + visita 16/10)
  expect(h).toContain("OS 81774223");
  expect(h).toContain("Sem tratativa");
});

test("histórico longo: no máximo MAX_TRAT_ENTRADAS registros por tratativa, os mais recentes; avisa o resto", () => {
  const entries = [1, 2, 3, 4, 5].map((n) => ({ id: String(n), status: "aguardando", em: `2026-11-0${n}T10:00:00Z`, responsavel: "FM", texto: `registro ${n}` }));
  const projeto = { id: "P601", name: "x", categories: [{ id: "c", label: "01 - CANCELAS", type: "items", itemLabels: ["Saída 04"] }] };
  const { canonicalFollowupKey } = require("../followups");
  const key = canonicalFollowupKey("P601", "01 - CANCELAS", "Saída 04");
  const h = montarLaudoSemanal(projeto, { c: [{ status: "inop", since: "2026-10-01", note: "x" }] }, { date: "2026-11-22" }, { followupsInfo: { [key]: { key, statusAtual: "aguardando", entries: [...entries].reverse() } }, hoje: hojeP601 });
  expect(MAX_TRAT_ENTRADAS).toBe(3);
  ["registro 5", "registro 4", "registro 3"].forEach((t) => expect(h).toContain(t));
  ["registro 2", "registro 1"].forEach((t) => expect(h).not.toContain(t));
  expect(h).toContain("+ 2 registros anteriores no histórico do app");
  expect(entradasRecentes(entries).map((e) => e.id)).toEqual(["5", "4", "3", "2", "1"]);
});

test("chaveTratativa: conteúdo igual = mesma chave (espaços ignorados); vazio = sem chave", () => {
  const t = (txt) => ({ statusAtual: "aguardando", comQuem: "moked", entries: [{ status: "aguardando", em: "2026-11-02", responsavel: "FM", texto: txt }] });
  expect(chaveTratativa(t("OS  1\n x"))).toBe(chaveTratativa(t("OS 1 x")));
  expect(chaveTratativa(t("OS 1"))).not.toBe(chaveTratativa(t("OS 2")));
  expect(chaveTratativa(null)).toBe("");
  expect(chaveTratativa({ statusAtual: "aguardando", entries: [] })).toBe("");
});

test("chaveEntrada: o mesmo registro em itens diferentes tem a mesma chave", () => {
  const a = { status: "proposta", em: "2026-10-19T10:00:00Z", responsavel: "FM", proposta: { numero: "1" }, texto: "x  y" };
  expect(chaveEntrada(a)).toBe(chaveEntrada({ ...a, id: "outro", texto: "x y" }));
  expect(chaveEntrada(a)).not.toBe(chaveEntrada({ ...a, proposta: { numero: "2" } }));
});

test("sem pendências: continua a tela '0 pendências'", () => {
  const h = montarLaudoSemanal(projetoP601, {}, { date: "2026-11-22" }, { hoje: hojeP601 });
  expect(h).not.toContain("Registros que valem para vários itens");
});

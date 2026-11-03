// Entorno (02/11/2026): núcleo puro — buscas por projeto, leitura de RSS, pré-filtro de tema, mescla e resumo.
const { distanciaKm, faixaKm, ordenarPorProximidade, consultasDoProjeto, consultasGerais, parseRss, passaPreFiltro, novosParaClassificar, aplicarClassificacao, mesclar, resumir, idDe, promptClassificacao } = require("./core");
const { LOCAIS, projetosComEntorno, recebeGeral } = require("./locais");

const RSS = `<?xml version="1.0"?><rss><channel><title>x</title>
<item><title>Quadrilha rouba carga de eletrônicos em Cajamar - G1</title><link>https://g1.globo.com/a</link><pubDate>Thu, 30 Oct 2026 10:00:00 GMT</pubDate><source url="https://g1.globo.com">G1</source><description>&lt;a href="x"&gt;Roubo de carga na Anhanguera&lt;/a&gt;</description></item>
<item><title>Neymar ganha a bola de ouro - UOL</title><link>https://uol.com.br/b</link><pubDate>Thu, 30 Oct 2026 11:00:00 GMT</pubDate><source url="https://uol.com.br">UOL</source><description>Esporte</description></item>
<item><title><![CDATA[Mercado Livre anuncia novo centro de distribuição em Cajamar]]></title><link>https://r7.com/c</link><pubDate>Wed, 29 Oct 2026 11:00:00 GMT</pubDate><description>Expansão logística</description></item>
</channel></rss>`;

test("cada projeto tem buscas no Google News (segurança e mercado) + portais indicados; janela de 90 dias", () => {
  const q = consultasDoProjeto("P601");
  expect(q.slice(0, 2).map((x) => x.tema)).toEqual(["seguranca", "mercado"]);
  expect(q.slice(2, 5).map((x) => x.fonte)).toEqual(["Portal Notícia 360", "Portal Dois Pontos", "G1 Cajamar"]);
  expect(q.slice(5).map((x) => x.fonte)).toEqual(["Agência Brasil", "R7", "UOL Notícias", "CNN Brasil", "Metrópoles"]);
  expect(q.slice(5).every((x) => x.amplo && x.lugares.includes("Cajamar"))).toBe(true);
  expect(q[4].amplo).toBe(true); expect(q[2].amplo).toBe(false); expect(q[2].tema).toBeNull();
  expect(q[4].lugares).toEqual(expect.arrayContaining(["Cajamar", "Franco da Rocha"]));
  expect(q[0].url).toMatch(/^https:\/\/news\.google\.com\/rss\/search\?q=/);
  expect(decodeURIComponent(q[0].url)).toMatch(/Cajamar/);
  expect(decodeURIComponent(q[0].url)).toMatch(/when:90d/);
  expect(decodeURIComponent(q[1].url)).toMatch(/Mercado Livre/);
});

test("Jatinox (Ipiranga/SP e Indaiatuba): só segurança, sem busca de mercado; mercado geral só para os demais", () => {
  const q = consultasDoProjeto("P260A");
  expect(q.slice(0, 3).map((x) => x.tema)).toEqual(["seguranca", null, null]);
  expect(decodeURIComponent(q[0].url)).toMatch(/Ipiranga/);
  expect(consultasDoProjeto("P260C")[0].url).toMatch(/Indaiatuba/);
  expect(projetosComEntorno()).toEqual(expect.arrayContaining(["P601", "P505", "P311A", "P311B", "P606", "P607", "P260A", "P260B", "P260C"]));
  for (const pid of projetosComEntorno()) expect(LOCAIS[pid].uf).toMatch(/^[A-Z]{2}$/);
  expect(recebeGeral("P601")).toBe(true); expect(recebeGeral("P260A")).toBe(false);
  const g = consultasGerais();
  expect(g.every((x) => x.tema === "mercado")).toBe(true);
  expect(decodeURIComponent(g[0].url)).toMatch(/Black Friday/);
  expect(g.map((x) => x.fonte)).toContain("Mercado Livre Notícias");
});

test("feed amplo (G1 regional) só aceita notícia que cite o entorno; feed local separa segurança de mercado", () => {
  const it = parseRss(RSS);
  const amplo = { tema: null, amplo: true, lugares: ["Jundiaí", "Várzea Paulista"], fonte: "G1" };
  expect(novosParaClassificar(it, [], amplo)).toEqual([]); // fala de Cajamar, não de Jundiaí
  const local = { tema: null, fonte: "Portal X" };
  expect(novosParaClassificar(it, [], local).map((x) => [x.tema, x.fonte])).toEqual([["seguranca", "G1"], ["mercado", "Portal X"]]);
  expect(novosParaClassificar(it, [], { ...local, soSeguranca: true }).map((x) => x.tema)).toEqual(["seguranca"]);
});

test("parseRss lê título/fonte/link/data e limpa HTML/CDATA", () => {
  const it = parseRss(RSS);
  expect(it).toHaveLength(3);
  expect(it[0]).toMatchObject({ titulo: "Quadrilha rouba carga de eletrônicos em Cajamar", fonte: "G1", link: "https://g1.globo.com/a" });
  expect(it[0].data).toBe("2026-10-30T10:00:00.000Z");
  expect(it[0].descricao).toBe("Roubo de carga na Anhanguera");
  expect(it[2].titulo).toBe("Mercado Livre anuncia novo centro de distribuição em Cajamar");
  expect(it[2].fonte).toBe("");
});

test("pré-filtro derruba notícia fora do tema e separa segurança de mercado", () => {
  const it = parseRss(RSS);
  expect(passaPreFiltro(it[0], "seguranca")).toBe(true);
  expect(passaPreFiltro(it[1], "seguranca")).toBe(false);
  expect(passaPreFiltro(it[1], "mercado")).toBe(false);
  expect(passaPreFiltro(it[2], "mercado")).toBe(true);
  const novos = novosParaClassificar(it, [{ id: idDe("https://g1.globo.com/a") }], "seguranca");
  expect(novos).toEqual([]); // já gravado
  expect(novosParaClassificar(it, [], "mercado").map((x) => x.titulo)).toEqual(["Mercado Livre anuncia novo centro de distribuição em Cajamar"]);
});

test("classificação: só fica o relevante, da região e com confiança ≥ 60; tipo inválido vira 'outro'", () => {
  const it = novosParaClassificar(parseRss(RSS), [], "seguranca");
  const prompt = promptClassificacao("P601", it);
  expect(prompt).toMatch(/Golgi Cajamar — Cajamar\/SP/);
  expect(prompt).toMatch(new RegExp(`id=${it[0].id}`));
  const resp = `Aqui: [{"id":"${it[0].id}","relevante":true,"tipo":"roubo_carga","cidade":"Cajamar","bairro":"Anhanguera km 40","proximidade":"cidade","confianca":92,"resumo":"Carga roubada na Anhanguera."}]`;
  const ok = aplicarClassificacao(it, resp);
  expect(ok).toHaveLength(1);
  expect(ok[0]).toMatchObject({ tipo: "roubo_carga", proximidade: "cidade", confianca: 92, tema: "seguranca", fonte: "G1" });
  expect(aplicarClassificacao(it, `[{"id":"${it[0].id}","relevante":true,"tipo":"roubo","proximidade":"cidade","confianca":40}]`)).toEqual([]);
  expect(aplicarClassificacao(it, `[{"id":"${it[0].id}","relevante":true,"tipo":"roubo","proximidade":"fora","confianca":95}]`)).toEqual([]);
  expect(aplicarClassificacao(it, `[{"id":"${it[0].id}","relevante":false}]`)).toEqual([]);
  expect(aplicarClassificacao(it, `[{"id":"${it[0].id}","relevante":true,"tipo":"xpto","proximidade":"vizinha","confianca":70}]`)[0].tipo).toBe("outro");
  expect(aplicarClassificacao(it, "resposta sem json")).toEqual([]);
});

test("mesclar: sem duplicidade, só 90 dias, mais recente primeiro; resumir conta 30/60/90 e tendência", () => {
  const agora = new Date("2026-11-02T12:00:00Z");
  const d = (dias) => new Date(agora.getTime() - dias * 86400000).toISOString();
  const ex = [{ id: "a", tema: "seguranca", tipo: "roubo", data: d(10) }, { id: "velho", tema: "seguranca", tipo: "furto", data: d(120) }];
  const novos = [{ id: "a", tema: "seguranca", tipo: "roubo_carga", data: d(10) }, { id: "b", tema: "seguranca", tipo: "homicidio", data: d(45) }, { id: "c", tema: "mercado", tipo: "expansao", data: d(3) }];
  const m = mesclar(ex, novos, agora);
  expect(m.map((x) => x.id)).toEqual(["c", "a", "b"]);
  expect(m.find((x) => x.id === "a").tipo).toBe("roubo_carga"); // o novo prevalece
  const r = resumir(m, agora);
  expect(r.seguranca).toMatchObject({ d30: 1, d60: 2, d90: 2, graves: 2, anterior30: 1, tendencia: "estavel" });
  expect(r.seguranca.porTipo).toEqual({ roubo_carga: 1, homicidio: 1 });
  expect(r.mercado).toEqual({ d30: 1, d90: 1 });
  expect(r.total).toBe(3);
});

test("mesma notícia em dois portais vira um item com dois links", () => {
  const agora = new Date("2026-11-02T12:00:00Z");
  const a = { id: "x1", tema: "seguranca", tipo: "roubo", titulo: "Quadrilha rouba carga de eletrônicos em Cajamar", link: "https://g1/a", fonte: "G1", data: agora.toISOString() };
  const b = { id: "x2", tema: "seguranca", tipo: "roubo", titulo: "Quadrilha rouba carga de eletrônicos em Cajamar!", link: "https://portal/b", fonte: "Portal 360", data: agora.toISOString() };
  const m = mesclar([a], [b], agora);
  expect(m).toHaveLength(1);
  expect(m[0].links).toEqual([{ fonte: "G1", link: "https://g1/a" }, { fonte: "Portal 360", link: "https://portal/b" }]);
  expect(mesclar(m, [b], agora)[0].links).toHaveLength(2); // idempotente
});

test("proximidade: distância em km, faixas e ordenação (perto primeiro, depois cidade/vizinha, depois data)", () => {
  const km = distanciaKm({ lat: -23.35, lng: -46.88 }, { lat: -23.36, lng: -46.89 });
  expect(km).toBeGreaterThan(1); expect(km).toBeLessThan(2);
  expect(distanciaKm(null, { lat: 0, lng: 0 })).toBeNull();
  expect([faixaKm(2), faixaKm(8), faixaKm(20), faixaKm(50), faixaKm(null)]).toEqual(["muito perto", "perto", "na região", "longe", null]);
  const o = ordenarPorProximidade([{ id: "regiao", proximidade: "regiao", data: "2026-11-02" }, { id: "km9", km: 9, data: "2026-10-01" }, { id: "km2", km: 2, data: "2026-09-01" }, { id: "cidade", proximidade: "cidade", data: "2026-10-20" }, { id: "cidade2", proximidade: "cidade", data: "2026-10-25" }]);
  expect(o.map((x) => x.id)).toEqual(["km2", "km9", "cidade2", "cidade", "regiao"]);
});

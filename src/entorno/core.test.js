// Entorno (02/11/2026): núcleo puro — buscas por projeto, leitura de RSS, pré-filtro de tema, mescla e resumo.
const { consultasDoProjeto, parseRss, passaPreFiltro, novosParaClassificar, aplicarClassificacao, mesclar, resumir, idDe, promptClassificacao } = require("./core");
const { LOCAIS, projetosComEntorno } = require("./locais");

const RSS = `<?xml version="1.0"?><rss><channel><title>x</title>
<item><title>Quadrilha rouba carga de eletrônicos em Cajamar - G1</title><link>https://g1.globo.com/a</link><pubDate>Thu, 30 Oct 2026 10:00:00 GMT</pubDate><source url="https://g1.globo.com">G1</source><description>&lt;a href="x"&gt;Roubo de carga na Anhanguera&lt;/a&gt;</description></item>
<item><title>Neymar ganha a bola de ouro - UOL</title><link>https://uol.com.br/b</link><pubDate>Thu, 30 Oct 2026 11:00:00 GMT</pubDate><source url="https://uol.com.br">UOL</source><description>Esporte</description></item>
<item><title><![CDATA[Mercado Livre anuncia novo centro de distribuição em Cajamar]]></title><link>https://r7.com/c</link><pubDate>Wed, 29 Oct 2026 11:00:00 GMT</pubDate><description>Expansão logística</description></item>
</channel></rss>`;

test("cada projeto com cidade tem duas buscas (segurança e mercado) no Google News com a cidade e janela de 90 dias", () => {
  const q = consultasDoProjeto("P601");
  expect(q.map((x) => x.tema)).toEqual(["seguranca", "mercado"]);
  expect(q[0].url).toMatch(/^https:\/\/news\.google\.com\/rss\/search\?q=/);
  expect(decodeURIComponent(q[0].url)).toMatch(/Cajamar/);
  expect(decodeURIComponent(q[0].url)).toMatch(/when:90d/);
  expect(decodeURIComponent(q[1].url)).toMatch(/Mercado Livre/);
});

test("Jatinox sem cidade não entra na coleta (não inventa entorno)", () => {
  expect(consultasDoProjeto("P260A")).toEqual([]);
  expect(projetosComEntorno()).not.toContain("P260A");
  expect(projetosComEntorno()).toEqual(expect.arrayContaining(["P601", "P505", "P311A", "P311B", "P606", "P607"]));
  for (const pid of projetosComEntorno()) expect(LOCAIS[pid].uf).toMatch(/^[A-Z]{2}$/);
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

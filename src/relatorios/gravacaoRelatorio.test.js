import { analisarGravacao, faixaGravacao, paresLadoALado, montarRelatorioGravacao } from "./gravacaoRelatorio";

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const PROJ = { id: "P601", name: "Golgi Cajamar" };
const HOJE = new Date("2026-10-07T10:00:00");

// Regras do relatório anterior (gerarPDFGravacao em 924eef7), copiadas para comparação.
function antigo(cameras) {
  const sorted = [...cameras].sort((a, b) => (a.diasGravacao || 0) - (b.diasGravacao || 0));
  const abaixo30 = sorted.filter(c => c.diasGravacao !== null && c.diasGravacao !== undefined && c.diasGravacao < 30);
  return { total: cameras.length, abaixo30: abaixo30.length, ok30: cameras.filter(c => c.diasGravacao >= 30).length, ordem: sorted.map(c => c.nome) };
}

function gerar(n, seed = 7) {
  let s = seed; const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  return Array.from({ length: n }, (_, i) => {
    const x = r();
    const dias = x < 0.08 ? null : x < 0.12 ? undefined : x < 0.14 ? "" : Math.floor(r() * 60);
    return { id: "c" + i, nome: "CAM-" + String(i + 1).padStart(3, "0"), especificacao: i % 3 ? "Bullet IP 4MP" : "", diasGravacao: dias, ultimaChecagem: i % 4 ? "2026-10-05T14:30:00" : null, checadoPor: i % 5 ? "Operador " + (i % 7) : "" };
  });
}

describe("CFTV Tempo de Gravação — padrão Moked compacto", () => {
  test("contagens e ordem idênticas ao relatório anterior (vários tamanhos, com nulos, ausentes e vazios)", () => {
    for (const n of [0, 1, 7, 44, 45, 61, 130, 300]) {
      const cams = gerar(n, n + 3), a = analisarGravacao(cams), o = antigo(cams);
      expect({ total: a.total, abaixo30: a.abaixo30, ok30: a.ok30, ordem: a.ordenadas.map(c => c.nome) }).toEqual(o);
    }
  });
  test("faixas: <15 crítico, 15–29 atenção, ≥30 ok, sem medição", () => {
    expect([0, 14, 15, 29, 30, 90].map(d => faixaGravacao({ diasGravacao: d }))).toEqual(["critico", "critico", "atencao", "atencao", "ok", "ok"]);
    expect(faixaGravacao({ diasGravacao: null })).toBe("sem");
    expect(faixaGravacao({})).toBe("sem");
  });
  test("lado a lado: duas câmeras por linha, todas uma única vez e na ordem", () => {
    for (const n of [1, 2, 3, 44, 45, 300]) {
      const lista = gerar(n).map((c, i) => ({ ...c, nome: "N" + i }));
      const pares = paresLadoALado(lista);
      expect(pares.length).toBe(Math.ceil(n / 2));
      expect(pares.flat().filter(Boolean).map(x => x.c.nome)).toEqual(lista.map(c => c.nome));
      expect(pares.flat().filter(Boolean).map(x => x.n)).toEqual(lista.map((_, i) => i + 1));
    }
  });
  test("documento no padrão Moked: nº, sem emoji, tabelas lado a lado, assinatura com o último bloco", () => {
    const { html, numero } = montarRelatorioGravacao(PROJ, gerar(61), { hoje: HOJE });
    expect(numero).toBe("MK-P601-CFTV-1007");
    expect(html).toContain("CFTV — Tempo de Gravação");
    expect(html).toContain("pág. ");
    expect(html).not.toMatch(EMOJI);
    expect((html.match(/<table class="mk-tb mk-fixa mk-cftv">/g) || []).length).toBe(1);
    expect((html.match(/<tr>/g) || []).length).toBeGreaterThanOrEqual(31);
    expect(html.indexOf('class="mk-fecho-linhas"')).toBeLessThan(html.indexOf('class="mk-fim"'));
    expect(html).not.toContain("<!--mk-fecho-->");
    expect((html.match(/class="mk-fim"/g) || []).length).toBe(1);
  });
  test("escapa texto vindo do cadastro", () => {
    const { html } = montarRelatorioGravacao(PROJ, [{ nome: "<img src=x onerror=1>", especificacao: "a&b", diasGravacao: 5, checadoPor: '"x"' }], { hoje: HOJE });
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x");
    expect(html).toContain("a&amp;b");
  });
  test("diasGravacao vazio não vira '0 d' nem 'd' solto (contagem preservada como antes)", () => {
    const { html, analise } = montarRelatorioGravacao(PROJ, [{ nome: "A", diasGravacao: "" }], { hoje: HOJE });
    expect(analise.abaixo30).toBe(1);
    expect(html).not.toMatch(/>\s*d<\/span>/);
    expect(html).not.toContain(">0 d<");
  });
  test("sem câmeras: mensagem explícita, sem tabela", () => {
    const { html } = montarRelatorioGravacao(PROJ, [], { hoje: HOJE });
    expect(html).toContain("Nenhuma câmera cadastrada");
    expect((html.match(/class="mk-fim"/g) || []).length).toBe(1);
    expect(html).not.toContain("mk-cftv\">");
  });
});

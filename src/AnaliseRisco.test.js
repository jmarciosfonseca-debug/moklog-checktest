import { aplicarDoutrinaCamadasP311A, formatarPlantoes, gerarHTMLAnaliseRisco, MAPA_REGIONAL, obterNarrativaClassificacao, vetoresDoTesteSemanal } from "./AnaliseRisco";
import { REGIONAL } from "./regionalConfig";

function contexto(vetores = []) {
  return {
    project: { id: "P604", name: "Golgi Jundiaí" },
    pacoteLabel: "Golgi",
    vetores,
    geral: {
      label: "CRÍTICO",
      nivel: 4,
      nBloqueadores: 2,
      alerta: true,
      motivoMatriz: "duas ou mais zonas perimetrais inoperantes",
      metricas: { zonasNomeadas: 2, cftvInoperante: 14, barreirasCriticas: 1 },
    },
    fontesUsadas: [
      { titulo: "Teste Semanal", detalhe: "84%" },
      { titulo: "Ronda Perimetral", detalhe: "57% OK" },
    ],
    ts: { ok: true, pct: 84, total: 168, okItens: 141, dataRaw: "2026-09-20" },
    ctmk: { ok: true, offline: false },
    ilum: null,
    rondaVirtual: null,
    equipe: null,
    regional: { ok: false },
    contextos: {},
  };
}

const vetor = (i) => ({
  chave: `risco-${i}`,
  label: `Vetor ${i}`,
  nivel: 4,
  bloqueadorCaido: true,
  fonteCredito: "Teste Semanal",
  descricao: `Evidência operacional ${i}`,
  zonaCanonica: `Z-${String(i).padStart(2, "0")}`,
  barreiraFisica: "perimetro",
});

test("os nove projetos possuem referência de mapa no acervo operacional", () => {
  ["P601", "P602", "P604", "P605", "P606", "P607", "P311A", "P311B", "P505"].forEach((id) => {
    expect(MAPA_REGIONAL[id]).toBe(`/mapas/${id}.jpg`);
  });
});

test("PDF executivo usa três colunas, explica o cálculo e limita apontamentos", () => {
  const html = gerarHTMLAnaliseRisco(contexto(Array.from({ length: 12 }, (_, i) => vetor(i + 1))));

  expect(html).toContain("grid-template-columns:repeat(3,minmax(0,1fr))");
  expect(html).toContain("memória de cálculo");
  expect(html).toContain("duas ou mais zonas perimetrais inoperantes");
  expect(html).toContain("Mais 3 apontamento(s)");
  expect((html.match(/class=\"vuln\"/g) || [])).toHaveLength(9);
  expect(html).toContain("Anexo Técnico separado");
});

test("mapa territorial usa encaixe horizontal compacto sem perder proporção", () => {
  const html = gerarHTMLAnaliseRisco(contexto([vetor(1)]), "data:image/jpeg;base64,AA==");

  expect(html).toContain("bloco bloco-territorial");
  expect(html).toContain("territorial-resumo");
  expect(html).toContain("grid-template-columns:minmax(0,42%) minmax(0,1fr)");
  expect(html).toContain(".mapa{width:auto;max-width:100%;height:auto;max-height:96mm");
  expect(html).toContain("object-fit:contain");
});

test("matriz entra depois da memória de cálculo e antes do territorial", () => {
  const html = gerarHTMLAnaliseRisco(contexto([
    { ...vetor(1), inop: 1, total: 4 },
    { ...vetor(2), inop: 1, total: 4 },
    { ...vetor(3), label: "CFTV", barreiraFisica: null, zonaCanonica: null, bloqueadorCaido: false, nivel: 3, inop: 14, total: 73 },
  ]));
  const memoria = html.indexOf("Como se chega à classificação — memória de cálculo");
  const matriz = html.indexOf("Matriz de Impacto Operacional e Exposição ao Risco");
  const territorial = html.indexOf("Diagnóstico territorial — por que a falha importa aqui");

  expect(memoria).toBeGreaterThan(-1);
  expect(matriz).toBeGreaterThan(memoria);
  expect(territorial).toBeGreaterThan(matriz);
  expect(html).toContain("Perímetro eletrônico — exposição ampliada");
  expect(html).toContain("CFTV — perda localizada de visibilidade");
});

test("laudo BAIXO mantém matriz e textos coerentes com o motor", () => {
  const dados = contexto([
    { ...vetor(1), label: "Pânico fixo", inop: 4, total: 4 },
  ]);
  dados.geral = {
    label: "BAIXO",
    nivel: 1,
    nBloqueadores: 0,
    motivoMatriz: "somente manutenção ou barreira isolada",
    metricas: {},
  };

  const html = gerarHTMLAnaliseRisco(dados);

  expect(html).toContain("Nenhum vetor determinante de impacto foi identificado no período");
  expect(html).toContain("não foram identificados vetores determinantes capazes de elevar a classificação");
  expect(html).toContain("eventuais itens de manutenção de forma programada");
  expect(html).not.toContain("falta restaurar as barreiras eletrônicas");
  expect(html).not.toContain("Pânico fixo — comunicação de emergência");
});

test("projeto sem diagnóstico regional ainda exibe o mapa como referência", () => {
  const html = gerarHTMLAnaliseRisco(contexto([vetor(1)]), "data:image/jpeg;base64,AA==");

  expect(html).toContain("Mapa de referência do P604");
  expect(html).toContain("diagnóstico territorial interpretativo permanece em elaboração");
});

test("territorial do P606 exibe versão e fontes registradas sem prometer anexo inexistente", () => {
  const dados = contexto([vetor(1)]);
  dados.project = { id: "P606", name: "Golgi Duque de Caxias" };
  dados.regional = { ok: true, temDado: true, ...REGIONAL.P606 };

  const html = gerarHTMLAnaliseRisco(dados, "data:image/jpeg;base64,AA==");

  expect(html).toContain("AR-PAT-2026-606");
  expect(html).toContain("versão 1.0.0");
  expect(html).toContain("ISP-RJ · ano-base 2025 · consulta 2026-09-26");
  expect(html).toContain('href="https://www.ispdados.rj.gov.br/EstSeguranca.html"');
  expect(html).toContain("Indicadores criminais comparáveis");
  expect(html).toContain("não aferido · período de 12 meses não consolidado · Duque de Caxias/RJ");
  expect(html).toContain("podem encontrar menor resistência eletrônica");
  expect(html).not.toContain("versão completa em anexo");
});

test("territorial auditável explica método, recorte, limitação e escopo das fontes", () => {
  const dados = contexto([vetor(1)]);
  dados.project = { id: "P606", name: "Golgi Duque de Caxias" };
  dados.regional = { ok: true, temDado: true, ...REGIONAL.P606 };

  const html = gerarHTMLAnaliseRisco(dados, "data:image/jpeg;base64,AA==");

  expect(html).toContain("Como este diagnóstico foi construído");
  expect(html).toContain("Leitura consultiva.");
  expect(html).toContain("Limitação.");
  expect(html).toContain("recorte: Duque de Caxias/RJ");
  expect(html).toContain("não aferido");
  expect(html).toContain("O território contextualiza a urgência, mas não altera sozinho a classificação operacional.");
});

test("P311A crítico por zona mais falha relevante mantém selo, texto e somatório coerentes", () => {
  const dados = contexto([vetor(1)]);
  dados.project = { id: "P311A", name: "Mega CL Curitiba" };
  dados.geral = {
    label: "CRÍTICO",
    nivel: 4,
    nBloqueadores: 1,
    motivoMatriz: "uma zona perimetral inoperante somada a outra falha relevante",
    metricas: { zonasNomeadas: 1, cftvInoperante: 6, barreirasCriticas: 0 },
  };

  const html = gerarHTMLAnaliseRisco(dados);

  expect(html).toContain("Risco Geral</div><div class=\"val\">CRÍTICO");
  expect(html).toContain("resulta em <em>CRÍTICO</em>");
  expect(html).toContain("uma zona perimetral inoperante somada a outra falha relevante");
  expect(html).not.toContain("resulta em <em>ELEVADO</em>");
});

test("P607 crítico por colapso não recebe narrativa de bloqueador isolado", () => {
  const narrativa = obterNarrativaClassificacao({
    label: "CRÍTICO",
    nivel: 4,
    nBloqueadores: 1,
    motivoMatriz: "duas ou mais zonas perimetrais inoperantes",
  });

  expect(narrativa.label).toBe("CRÍTICO");
  expect(narrativa.complemento).toContain("colapso amplo");
  expect(narrativa.complemento).toContain("duas ou mais zonas perimetrais inoperantes");
});

test("classe final prevalece sobre contagem auxiliar divergente no somatório", () => {
  const dados = contexto([vetor(1), vetor(2)]);
  dados.project = { id: "P602", name: "Golgi Mauá" };
  dados.geral = {
    label: "ELEVADO",
    nivel: 3,
    nBloqueadores: 2,
    motivoMatriz: "barreira crítica de bloqueio inoperante (perímetro íntegro)",
    metricas: { zonasNomeadas: 0, cftvInoperante: 0, barreirasCriticas: 1 },
  };

  const html = gerarHTMLAnaliseRisco(dados);

  expect(html).toContain("resulta em <em>ELEVADO</em>");
  expect(html).not.toContain("resulta em <em>CRÍTICO</em>");
});

test("quantidade ausente de plantões é omitida em vez de imprimir undefined", () => {
  expect(formatarPlantoes(undefined, { prefixo: " em " })).toBe("");
  expect(formatarPlantoes(null)).toBe("");
  expect(formatarPlantoes(1)).toBe("1 plantão");
  expect(formatarPlantoes(3, { prefixo: " em " })).toBe(" em 3 plantões");
});

test("os nove projetos compartilham capa e a mesma estrutura institucional", () => {
  const projetos = ["P601", "P602", "P604", "P605", "P606", "P607", "P311A", "P311B", "P505"];

  projetos.forEach((id) => {
    const dados = contexto([]);
    dados.project = { id, name: `Projeto ${id}` };
    const html = gerarHTMLAnaliseRisco(dados);

    expect(html).toContain("Moked Consulting Security");
    expect(html).toContain("Análise de Risco de Segurança");
    expect(html).toContain("Risco Geral");
    expect(html).toContain("Vetores de vulnerabilidade — ação necessária");
    expect(html).toContain("Como se chega à classificação — memória de cálculo");
    expect(html).toContain("Matriz de Impacto Operacional e Exposição ao Risco");
    expect(html).toContain("Diagnóstico territorial — por que a falha importa aqui");
    expect(html).toContain("O que sustenta a operação — pontos fortes");
    expect(html).toContain("Palavra do consultor");
    expect(html).not.toContain("undefined");
  });
});

test("P311A rebaixa somente a falha parcial da cerca secundária quando Alpha Sense está íntegro", () => {
  const secundaria = {
    ...vetor(1),
    camadaPerimetral: "secundaria",
    zonaCanonica: "zona-01",
    observacaoManutencao: false,
  };
  const cftv = { ...vetor(2), barreiraFisica: null, camadaPerimetral: null, zonaCanonica: null };
  const project = {
    id: "P311A",
    categories: [{ id: "perimeter", itemLabels: ["Zona 01", "Zona 02", "Zona 03", "Alambrado/Gradil"] }],
  };

  const resultado = aplicarDoutrinaCamadasP311A([secundaria, cftv], project);

  expect(resultado.camadasPerimetrais).toEqual({ primariaInop: 0, secundariaInop: 1, secundariaTotal: 4 });
  expect(resultado.vetores[0].nivel).toBe(1);
  expect(resultado.vetores[0].bloqueadorCaido).toBe(false);
  expect(resultado.vetores[0].observacaoManutencao).toBe(true);
  expect(resultado.vetores[1]).toEqual(cftv);
});

test("memória de cálculo identifica separadamente Alpha Sense e cerca elétrica", () => {
  const dados = contexto([]);
  dados.project = { id: "P311A", name: "Mega CL Curitiba" };
  dados.geral = {
    label: "CRÍTICO",
    nivel: 4,
    motivoMatriz: "falha simultânea no Alpha Sense e na cerca elétrica",
    metricas: {
      zonasNomeadas: 0,
      alphaSenseInoperante: 1,
      cercaEletricaInoperante: 1,
      cftvInoperante: 0,
      barreirasCriticas: 0,
    },
  };

  const html = gerarHTMLAnaliseRisco(dados);

  expect(html).toContain("1 zona(s) do Alpha Sense inoperante(s)");
  expect(html).toContain("1 zona(s) da cerca elétrica inoperante(s)");
  expect(html).toContain("falha simultânea no Alpha Sense e na cerca elétrica");
});

test("Alambrado/Gradil conta como a quarta zona da cerca elétrica do P311A", () => {
  const itens = ["Zona 01", "Zona 02", "Zona 03", "Alambrado/Gradil"];
  const ts = {
    ok: true,
    pid: "P311A",
    pend: itens.map((itemLabel) => ({
      catId: "perimeter",
      catLabel: "01 - ALARME CERCA ELÉTRICA",
      itemLabel,
      status: "INOPERANTE",
      dias: 1,
    })),
    catAgg: {
      "01 - ALARME CERCA ELÉTRICA": { total: 4, inop: 4, piorDias: 1 },
    },
  };
  const project = {
    id: "P311A",
    categories: [{ id: "perimeter", itemLabels: itens }],
  };

  const vetores = vetoresDoTesteSemanal(ts, "27/09/2026");
  const resultado = aplicarDoutrinaCamadasP311A(vetores, project);

  expect(new Set(vetores.map((v) => v.zonaCanonica)).size).toBe(4);
  expect(resultado.camadasPerimetrais.secundariaInop).toBe(4);
  expect(resultado.vetores.every((v) => v.observacaoManutencao !== true)).toBe(true);
});

test("identificador técnico de zona órfã não aparece no relatório", () => {
  const dados = contexto([{
    ...vetor(1),
    label: "Perímetro eletrônico — ponto sem cadastro",
    zonaCanonica: "perimetro-sem-cadastro",
    pendenciaCadastro: true,
  }]);
  const html = gerarHTMLAnaliseRisco(dados);

  expect(html).not.toContain("Área/zona: perimetro-sem-cadastro");
  expect(html).toContain("Área/zona: Perímetro sem identificação nominal");
});

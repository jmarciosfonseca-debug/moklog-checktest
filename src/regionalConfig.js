// ─────────────────────────────────────────────────────────────
// regionalConfig.js — Diagnóstico Regional de Risco por projeto (Etapa c)
// MokLog CheckTest · Análise de Risco v2
//
// Terceira perna do tripé (Operacional + Sinistros + REGIONAL).
// O dado ESTRUTURADO vive aqui (versionado, auditável, lido pelo motor).
// A FIGURA/REFERÊNCIA territorial pode viver em public/regional ou ser
// incorporada ao gerador. `pdfPath` nunca deve apontar para arquivo inexistente.
//
// Para adicionar um projeto: duplique um bloco REGIONAL.Pxxx, preencha a
// partir do respectivo Documento de Análise Regional (AR-PAT-xxxx) e
// coloque o PDF em public/regional/Pxxx.pdf. Projetos sem entrada aqui
// simplesmente não recebem cruzamento regional (modulador neutro).
//
// GRAUS de risco do quadrante (do documento técnico):
//   "GRAVISSIMO" | "GRAVE" | "MODERADO" | "BAIXO"
// NATUREZA dos vetores (para casar com vulnerabilidade operacional):
//   "perimetro" | "acesso" | "furto" | "violento"
// ─────────────────────────────────────────────────────────────

export const GRAU_PESO = { GRAVISSIMO: 3, GRAVE: 2, MODERADO: 1, BAIXO: 0 };

const SINESP_URL = "https://www.gov.br/mj/pt-br/acesso-a-informacao/dados-abertos/ocorrencias-criminais-sinesp";
const METODO_TERRITORIAL = "Leitura qualitativa do mapa de referência do projeto, do marco zero e das características físicas do entorno, confrontada com portais oficiais de segurança pública. O território contextualiza a urgência de correção, mas não altera a classificação operacional.";

const auditoriaTerritorial = (recorte, conclusao) => ({
  metodo: METODO_TERRITORIAL,
  recorte,
  conclusao,
  limitacao: "Não foi usado número estimado nem indicador sem recorte e período comparáveis. Quando a extração oficial não está consolidada, o laudo registra o indicador como não aferido.",
});

const indicadorNaoAferido = (recorte) => ([{
  nome: "Indicadores criminais comparáveis",
  valor: null,
  periodo: "período de 12 meses não consolidado",
  recorte,
}]);

export const REGIONAL = {
  // ── P607 — Golgi Brasília (AR-PAT-2026-001) ────────────────
  P607: {
    codigo: "AR-PAT-2026-001",
    versao: "1.0 (Auditável)",
    emissao: "2026-08-10",
    ativo: "P607 Golgi Brasília",
    marcoZero: "Rodovia DF-290, KM 1,2 — Santa Maria/DF",
    municipioUF: "Santa Maria / DF (margem norte da DF-290)",
    coordenadas: "16°02'34\"S 47°58'12\"W",
    pdfPath: null,
    mapaIncorporado: true,
    auditoria: auditoriaTerritorial(
      "Santa Maria/DF e faixa de divisa com Valparaíso de Goiás/GO",
      "O marco zero está inserido em corredor logístico de divisa. A leitura territorial destaca acessos rodoviários, circulação nas trocas de turno e dependência de coordenação entre jurisdições como fatores contextuais, sem atribuir ocorrência criminal ao ativo.",
    ),
    indicadores: indicadorNaoAferido("Santa Maria/DF e município limítrofe de Valparaíso de Goiás/GO"),

    // Quadrantes limítrofes com grau e tipologias.
    quadrantes: [
      {
        lado: "NORTE (DF)",
        regiao: "Santa Maria / Polo Multi-industrial (DF-290)",
        grau: "GRAVE",
        vetores: [
          { natureza: "acesso", desc: "A proximidade de corredor logístico pode elevar a exposição a abordagem e transbordo de cargas." },
          { natureza: "perimetro", desc: "A configuração do entorno pode ampliar a possibilidade de aproximação ao perímetro fora do horário de maior circulação." },
          { natureza: "furto", desc: "A circulação de veículos e a infraestrutura externa podem ampliar a exposição patrimonial quando há falhas de detecção." },
        ],
      },
      {
        lado: "SUL (GO)",
        regiao: "Jardim Céu Azul / Valparaíso de Goiás",
        grau: "GRAVISSIMO",
        vetores: [
          { natureza: "violento", desc: "O contexto de divisa pode elevar a exposição a ocorrências violentas, sem permitir atribuição direta ao ativo." },
          { natureza: "violento", desc: "A faixa de divisa pode reduzir a previsibilidade jurisdicional da resposta em situações coordenadas." },
          { natureza: "violento", desc: "A circulação a pé e por transporte coletivo pode ampliar a exposição de trabalhadores nas trocas de turno." },
        ],
      },
    ],

    // Fatores protetivos (pronta-resposta). distanciaKm atenua conforme proximidade.
    protecao: [
      { orgao: "Hospital Regional de Santa Maria (HRSM)", uf: "DF", distanciaKm: 3.5, tempoMin: 5, tipo: "hospital", fonte: "estimativa operacional — validar" },
      { orgao: "26º BPM (PMDF)", uf: "DF", distanciaKm: 5.5, tempoMin: 8, tipo: "pm", titular: true, fonte: "estimativa operacional — validar" },
      { orgao: "18º CBMDF (Bombeiros)", uf: "DF", distanciaKm: 6.2, tempoMin: 9, tipo: "bombeiro", fonte: "estimativa operacional — validar" },
      { orgao: "Hospital Municipal de Valparaíso", uf: "GO", distanciaKm: 3.8, tempoMin: 6, tipo: "hospital", fonte: "estimativa operacional — validar" },
      { orgao: "20º BPM (PMGO)", uf: "GO", distanciaKm: 4.2, tempoMin: 7, tipo: "pm", fonte: "estimativa operacional — validar" },
    ],
    fontes: [
      { orgao: "SSP-DF", url: "https://ssp.df.gov.br/dados-por-regiao-administrativa/", periodo: "2025–2026", consulta: "2026-09-26", escopo: "DF e regiões administrativas" },
      { orgao: "Sinesp/MJSP", url: SINESP_URL, periodo: "base nacional disponível", consulta: "2026-09-26", escopo: "contexto nacional/municipal conforme disponibilidade" },
    ],
  },

  // ── P601 — Golgi Cajamar (AR-PAT-2026-002) ────────────────
  P601: {
    codigo: "AR-PAT-2026-002",
    versao: "1.0 (Auditável)",
    emissao: "2026-08-13",
    ativo: "P601 Golgi Cajamar",
    marcoZero: "Rod. dos Bandeirantes (SP-348/SP-354), margem leste — Cajamar/SP",
    municipioUF: "Cajamar / SP (limítrofe a Franco da Rocha a leste/nordeste)",
    coordenadas: "23°19'53\"S 46°48'55\"W",
    pdfPath: null,
    mapaIncorporado: true,
    auditoria: auditoriaTerritorial(
      "Cajamar/SP e divisa operacional com Franco da Rocha/SP",
      "O mapa de referência posiciona o ativo junto a corredor logístico e a uma faixa de divisa municipal. Esses elementos podem ampliar rotas de aproximação e a exposição nas trocas de turno quando coincidem com falhas operacionais, sem determinar a classe de risco.",
    ),
    indicadores: indicadorNaoAferido("Cajamar/SP e circunscrição consultada"),

    quadrantes: [
      {
        lado: "CORREDOR LOGÍSTICO (SP)",
        regiao: "Rod. dos Bandeirantes / polo de galpões (Cajamar)",
        grau: "GRAVE",
        vetores: [
          { natureza: "acesso", desc: "O corredor logístico pode elevar a exposição a abordagem de cargas em trânsito, desaceleração ou pátio." },
          { natureza: "perimetro", desc: "A configuração logística do entorno pode ampliar a possibilidade de aproximação ao perímetro fora do horário de maior circulação." },
          { natureza: "furto", desc: "Veículos e infraestrutura externa podem ficar mais expostos quando há redução da capacidade de detecção." },
        ],
      },
      {
        lado: "NÚCLEO COMUNITÁRIO (SP)",
        regiao: "Comunidade Roseira — divisa Cajamar/Franco da Rocha",
        grau: "GRAVISSIMO",
        vetores: [
          { natureza: "violento", desc: "O contexto urbano de divisa pode elevar a exposição a ocorrências violentas, sem permitir atribuição direta ao ativo." },
          { natureza: "violento", desc: "A circulação nas vias do entorno pode ampliar a exposição de colaboradores, especialmente nas trocas de turno." },
          { natureza: "acesso", desc: "O acesso pela Estrada Municipal para Parnaíba pode ampliar rotas de aproximação e tornar a resposta dependente de coordenação entre jurisdições." },
        ],
      },
    ],

    protecao: [
      { orgao: "3ª Cia 26º BPM/M — Jordanésia (PMESP)", uf: "SP", distanciaKm: 2.5, tempoMin: 5, tipo: "pm", titular: true, fonte: "estimativa operacional — validar" },
      { orgao: "UPA de Jordanésia (pronto-atendimento)", uf: "SP", distanciaKm: 4.0, tempoMin: 8, tipo: "hospital", fonte: "estimativa operacional — validar" },
      { orgao: "26º BPM/M (Sede) — Franco da Rocha", uf: "SP", distanciaKm: 7.0, tempoMin: 12, tipo: "pm", fonte: "estimativa operacional — validar" },
      { orgao: "Hospital Estadual Albano da Franca Rocha", uf: "SP", distanciaKm: 8.0, tempoMin: 14, tipo: "hospital", fonte: "estimativa operacional — validar" },
    ],
    fontes: [
      { orgao: "SSP-SP", url: "https://www.portal.ssp.sp.gov.br/estatistica/consultas", periodo: "dados criminais 2025–2026", consulta: "2026-09-26", escopo: "município/circunscrição conforme consulta" },
      { orgao: "Sinesp/MJSP", url: SINESP_URL, periodo: "base nacional disponível", consulta: "2026-09-26", escopo: "contexto nacional/municipal conforme disponibilidade" },
    ],
  },

  // ── P602 — Golgi Mauá (AR-PAT-2026-002 · MK-602-AR-0002) ────
  P602: {
    codigo: "AR-PAT-2026-002",
    versao: "1.0 (Auditável)",
    emissao: "2026-09-18",
    ativo: "P602 Golgi Mauá",
    marcoZero: "Estr. Mun. do Sertãozinho, 1.700 — Bairro Sertãozinho, Mauá/SP",
    municipioUF: "Mauá / SP (Sertãozinho, a ~1,8 km do Rodoanel Mário Covas)",
    coordenadas: "23°39'46.8\"S 46°26'12.4\"W",
    mapsUrl: "https://maps.app.goo.gl/j6s5AL2W32z5rW2u5",
    pdfPath: "/regional/P602.jpg",
    auditoria: auditoriaTerritorial(
      "Mauá/SP, bairro Sertãozinho e circunscrição correspondente",
      "O mapa de referência evidencia conexão com eixos rodoviários e áreas periurbanas limítrofes. A combinação pode aumentar a importância da detecção perimetral e do controle de acessos, mas não é usada para elevar a classificação operacional.",
    ),
    indicadores: indicadorNaoAferido("Mauá/SP e circunscrição consultada"),

    quadrantes: [
      {
        lado: "EIXO RODOVIÁRIO (SP-021 / Jacu-Pêssego / SP-031)",
        regiao: "Rodoanel Mário Covas (Trecho Sul) · Complexo Jacu-Pêssego · SP-031 (Índio Tibiriçá)",
        grau: "GRAVE",
        vetores: [
          { natureza: "acesso", desc: "O corredor rodoviário pode elevar a exposição a abordagem de cargas em trânsito ou desaceleração." },
          { natureza: "acesso", desc: "A proximidade da malha do Rodoanel pode ampliar as alternativas de deslocamento e reduzir o tempo disponível para contenção." },
          { natureza: "furto", desc: "As faixas de domínio podem ampliar a exposição a transbordo, desengate e subtração de cargas ou componentes." },
        ],
      },
      {
        lado: "NÚCLEO PERIURBANO (Complexo Zaíra / Jardim Itapeva)",
        regiao: "Comunidades limítrofes ao ativo — encostas e taludes",
        grau: "GRAVISSIMO",
        vetores: [
          { natureza: "perimetro", desc: "Encostas, taludes e vegetação podem reduzir a vigilância natural e ampliar pontos de aproximação ao perímetro." },
          { natureza: "violento", desc: "Pontos de ônibus e circulação a pé podem ampliar a exposição de trabalhadores nas trocas de turno." },
          { natureza: "furto", desc: "Cabeamento e infraestrutura nas vias de acesso podem ficar mais expostos quando há falhas de iluminação ou detecção." },
        ],
      },
    ],

    protecao: [
      { orgao: "1ª Cia 30º BPM/M (PMESP)", uf: "SP", distanciaKm: 3.8, tempoMin: 7, tipo: "pm", titular: true, fonte: "estimativa operacional — validar" },
      { orgao: "1º BPRv — Rodoanel Sul (PMRv)", uf: "SP", distanciaKm: 3.2, tempoMin: 5, tipo: "pm", fonte: "estimativa operacional — validar" },
      { orgao: "UPA Zaíra", uf: "SP", distanciaKm: 4.1, tempoMin: 8, tipo: "hospital", fonte: "estimativa operacional — validar" },
      { orgao: "Hospital Dr. Radamés Nardini", uf: "SP", distanciaKm: 6.5, tempoMin: 12, tipo: "hospital", fonte: "estimativa operacional — validar" },
    ],
    fontes: [
      { orgao: "SSP-SP", url: "https://www.portal.ssp.sp.gov.br/estatistica/consultas", periodo: "dados criminais 2025–2026", consulta: "2026-09-26", escopo: "Mauá/circunscrição conforme consulta" },
      { orgao: "Sinesp/MJSP", url: SINESP_URL, periodo: "base nacional disponível", consulta: "2026-09-26", escopo: "contexto nacional/municipal conforme disponibilidade" },
    ],
  },

  // ── P605 — Golgi Dutra (AR-PAT-2026-005) ─────────────────
  P605: {
    codigo: "AR-PAT-2026-005",
    versao: "1.0.0",
    emissao: "2026-09-20",
    ativo: "P605 Golgi Dutra",
    marcoZero: "Entroncamento Dutra (BR-116, km 204/205) × Rodoanel Mário Covas (SP-021 Leste)",
    municipioUF: "Arujá / SP (limite operacional com Guarulhos)",
    coordenadas: "23°24'36.2\"S 46°21'22.4\"W",
    mapsUrl: "",
    pdfPath: "/regional/P605.jpg",
    auditoria: auditoriaTerritorial(
      "Arujá/SP, limite operacional com Guarulhos/SP e entroncamento BR-116/SP-021",
      "O entorno é caracterizado por conexões rodoviárias e divisas laterais com ocupação descontínua. Essas condições podem reduzir o tempo disponível para contenção quando existem falhas de acesso, CFTV ou perímetro, sem alterar sozinhas a classe calculada.",
    ),
    indicadores: indicadorNaoAferido("Arujá/SP e Guarulhos/SP conforme circunscrição"),
    quadrantes: [
      {
        lado: "CORREDOR LOGÍSTICO RODOVIÁRIO (Dutra / Rodoanel Leste)",
        regiao: "BR-116 km 204/205 × SP-021 (entroncamento imediato)",
        grau: "GRAVE",
        vetores: [
          { natureza: "furto", desc: "A desaceleração de composições pesadas nas alças entre o Rodoanel Leste e a Dutra pode elevar a exposição a abordagem e subtração de cargas." },
          { natureza: "acesso", desc: "O acesso à BR-116 e ao Rodoanel pode ampliar alternativas de deslocamento e reduzir o tempo disponível para contenção." },
          { natureza: "furto", desc: "Faixas lindeiras e viadutos do entroncamento podem ampliar a exposição de infraestrutura e pátios quando há falhas de detecção." },
        ],
      },
      {
        lado: "NÚCLEO PERIURBANO E DIVISAS (Vetor Oeste / Sul)",
        regiao: "Vila Sadokim / Álamo (oeste) · Jardim Joia / Tupi (sul, junto às alças)",
        grau: "GRAVE",
        vetores: [
          { natureza: "perimetro", desc: "Vegetação, taludes e divisas laterais sem ocupação ativa contínua podem reduzir a vigilância natural e ampliar pontos cegos junto ao perímetro." },
          { natureza: "violento", desc: "A malha urbana periférica e os núcleos residenciais podem ampliar a exposição de colaboradores nas vias de acesso e trocas de turno." },
        ],
      },
    ],
    protecao: [
      { orgao: "31º BPM/M — 3ª Cia (Arujá)", uf: "SP", distanciaKm: null, tempoMin: 8, tipo: "pm", titular: true, fonte: "tempo estimado — distância não aferida" },
      { orgao: "1º BPRv — 3ª Cia (Rodoanel Leste)", uf: "SP", distanciaKm: null, tempoMin: 5, tipo: "pm", fonte: "tempo estimado — distância não aferida" },
      { orgao: "Posto de Bombeiros de Arujá (17º GB)", uf: "SP", distanciaKm: null, tempoMin: 10, tipo: "bombeiro", fonte: "tempo estimado — distância não aferida" },
      { orgao: "Pronto Atendimento Central de Arujá", uf: "SP", distanciaKm: null, tempoMin: 12, tipo: "hospital", fonte: "tempo estimado — distância não aferida" },
    ],
    fontes: [
      { orgao: "SSP-SP", url: "https://www.portal.ssp.sp.gov.br/estatistica/consultas", periodo: "dados criminais 2025–2026", consulta: "2026-09-26", escopo: "Arujá/Guarulhos conforme circunscrição" },
      { orgao: "Sinesp/MJSP", url: SINESP_URL, periodo: "base nacional disponível", consulta: "2026-09-26", escopo: "contexto nacional/municipal conforme disponibilidade" },
    ],
  },

  // ── P606 — Golgi Duque de Caxias (AR-PAT-2026-606) ──────
  // Distâncias e tempos abaixo são estimativas operacionais. Os órgãos,
  // a jurisdição e o marco zero foram conferidos no levantamento territorial.
  P606: {
    codigo: "AR-PAT-2026-606",
    versao: "1.0.0",
    emissao: "2026-09-21",
    ativo: "P606 Golgi Duque de Caxias",
    marcoZero: "Entroncamento Rod. Washington Luís (BR-040) × Arco Metropolitano (BR-493) — Duque de Caxias/RJ",
    municipioUF: "Duque de Caxias / RJ (Baixada Fluminense)",
    coordenadas: "22°39'51.3\"S 43°20'52.5\"W",
    mapsUrl: "https://maps.app.goo.gl/P9bW4mBQJYWJMh3f6",
    pdfPath: "/regional/P606.jpg",
    auditoria: auditoriaTerritorial(
      "Duque de Caxias/RJ, entorno do entroncamento BR-040/BR-493",
      "O marco zero combina entroncamento rodoviário, áreas abertas e cobertura vegetal no entorno imediato. Esses fatores podem ampliar alternativas de aproximação e tornar a pronta-resposta dependente do deslocamento viário quando coincidem com vulnerabilidades operacionais.",
    ),
    indicadores: indicadorNaoAferido("Duque de Caxias/RJ; série municipal oficial disponível no ISP-RJ"),

    quadrantes: [
      {
        lado: "ENTRONCAMENTO RODOVIÁRIO (BR-040 × BR-493)",
        regiao: "Washington Luís × Arco Metropolitano — alças e retornos complexos",
        grau: "GRAVE",
        vetores: [
          { natureza: "furto", desc: "A exposição ao corredor logístico pode elevar a possibilidade de abordagem e interceptação de cargas em trânsito ou desaceleração." },
          { natureza: "acesso", desc: "As conexões imediatas com BR-040 e BR-493 podem ampliar as alternativas de evasão e reduzir o tempo disponível para contenção." },
        ],
      },
      {
        lado: "ISOLAMENTO E COBERTURA VEGETAL (perímetro rural)",
        regiao: "Vegetação, relevo irregular e descampados no entorno imediato",
        grau: "GRAVISSIMO",
        vetores: [
          { natureza: "perimetro", desc: "Vegetação e relevo irregular podem facilitar aproximação menos observada e ampliar pontos cegos junto às divisas." },
          { natureza: "perimetro", desc: "Áreas abertas e baixa vigilância natural podem favorecer observação prévia do ativo e preparação de tentativa de intrusão." },
          { natureza: "violento", desc: "O isolamento geográfico pode elevar a exposição a ações coordenadas e tornar a resposta pública mais dependente do deslocamento rodoviário." },
        ],
      },
    ],

    protecao: [
      { orgao: "15º BPM/PMERJ — 1ª Cia (Duque de Caxias)", uf: "RJ", distanciaKm: 9, tempoMin: 12, tipo: "pm", titular: true, fonte: "estimativa operacional — validar" },
      { orgao: "PRF — Unidade Operacional Duque de Caxias (BR-040 Km 104)", uf: "RJ", distanciaKm: 6, tempoMin: 8, tipo: "pm", fonte: "estimativa operacional — validar" },
      { orgao: "14º GBM/CBMERJ (Duque de Caxias)", uf: "RJ", distanciaKm: 10, tempoMin: 14, tipo: "bombeiro", fonte: "estimativa operacional — validar" },
      { orgao: "Hospital Municipalizado Adão Pereira Nunes (BR-040 Km 109)", uf: "RJ", distanciaKm: 8, tempoMin: 11, tipo: "hospital", fonte: "estimativa operacional — validar" },
    ],

    fontes: [
      { orgao: "ISP-RJ", url: "https://www.ispdados.rj.gov.br/EstSeguranca.html", periodo: "ano-base 2025", consulta: "2026-09-26", escopo: "Duque de Caxias/RJ; série municipal oficial" },
      { orgao: "Sinesp/MJSP", url: SINESP_URL, periodo: "base nacional disponível", consulta: "2026-09-26", escopo: "contexto nacional/municipal conforme disponibilidade" },
    ],
  },

  // ── P604 — Golgi Jundiaí (AR-PAT-2026-004) ────────────────
  // Graus e textos seguem o parecer territorial v2, com redação prudencial.
  // Tempos de pronta-resposta são estimativas operacionais e devem ser
  // substituídos por medição/registro formal quando disponível.
  P604: {
    codigo: "AR-PAT-2026-004",
    versao: "1.0.0",
    emissao: "2026-09-17",
    ativo: "P604 Golgi Jundiaí",
    marcoZero: "Galpão P604 — Distrito Industrial, Vetor Oeste",
    municipioUF: "Jundiaí / SP",
    coordenadas: "23°10'32.4\"S 46°58'54.2\"W",
    pdfPath: "/regional/P604.pdf",
    auditoria: auditoriaTerritorial(
      "Jundiaí/SP, Distrito Industrial e Vetor Oeste",
      "O mapa de referência posiciona o ativo entre corredor logístico, faixa de vegetação e núcleos periurbanos. Esses elementos podem aumentar a importância da integridade perimetral, da iluminação e da detecção, sem substituir nem modificar a leitura dos equipamentos.",
    ),
    indicadores: indicadorNaoAferido("Jundiaí/SP e circunscrição consultada"),

    quadrantes: [
      {
        lado: "CORREDOR LOGÍSTICO (SP-300)",
        regiao: "Eixo SP-300 / SP-348 / SP-330 — Distrito Industrial",
        grau: "GRAVE",
        vetores: [
          { natureza: "furto", desc: "A circulação em eixo logístico de alto valor pode elevar a exposição a abordagem e subtração de cargas em trânsito." },
          { natureza: "acesso", desc: "O acesso direto à SP-300 pode ampliar alternativas de deslocamento em direção às alças da Bandeirantes e Anhanguera." },
          { natureza: "furto", desc: "Faixas de domínio limítrofes podem ampliar a exposição de cabeamento elétrico e óptico quando há falhas de detecção." },
        ],
      },
      {
        lado: "VETOR NORTE (mata / campo)",
        regiao: "Área não ocupada ao norte do galpão",
        grau: "MODERADO",
        vetores: [
          { natureza: "perimetro", desc: "Mata e campo ao norte podem favorecer aproximação a pé menos observada até as divisas perimetrais." },
          { natureza: "perimetro", desc: "Vegetação e declives limítrofes podem formar pontos cegos de cercamento, exigindo integridade perimetral." },
        ],
      },
      {
        lado: "NÚCLEO PERIURBANO (Vetor Oeste)",
        regiao: "Almerinda Chaves, Novo Horizonte, Residencial Jundiaí, Tereza Cristina e Medeiros",
        grau: "GRAVE",
        vetores: [
          { natureza: "perimetro", desc: "O adensamento residencial no entorno pode elevar a exposição a tentativas de transposição perimetral fora do horário de maior circulação." },
          { natureza: "violento", desc: "Vias vicinais e pontos de ônibus podem ampliar a exposição de colaboradores nas trocas de turno." },
        ],
      },
    ],

    protecao: [
      { orgao: "2ª Cia do 11º BPM/I — Jundiaí", uf: "SP", distanciaKm: 5.8, tempoMin: 9, tipo: "pm", titular: true, fonte: "estimativa operacional — validar" },
      { orgao: "4º BPRv — Base SP-300/Bandeirantes", uf: "SP", distanciaKm: 4.2, tempoMin: 7, tipo: "pm", fonte: "estimativa operacional — validar" },
      { orgao: "UPA Vetor Oeste — Novo Horizonte", uf: "SP", distanciaKm: 5.1, tempoMin: 9, tipo: "hospital", fonte: "estimativa operacional — validar" },
      { orgao: "Hospital São Vicente de Paulo", uf: "SP", distanciaKm: 11.5, tempoMin: 20, tipo: "hospital", fonte: "estimativa operacional — validar" },
    ],
    fontes: [
      { orgao: "SSP-SP", url: "https://www.portal.ssp.sp.gov.br/estatistica/consultas", periodo: "dados criminais 2025–2026", consulta: "2026-09-26", escopo: "Jundiaí/circunscrição conforme consulta" },
      { orgao: "Sinesp/MJSP", url: SINESP_URL, periodo: "base nacional disponível", consulta: "2026-09-26", escopo: "contexto nacional/municipal conforme disponibilidade" },
    ],
  },

  // ── Próximos projetos: duplicar o bloco acima quando a regional
  //    for elaborada. Ex.: P605, P311A... ──────────────
};

// Contextos qualitativos dos projetos que ainda não possuíam diagnóstico
// regional estruturado. Eles aparecem no laudo, mas permanecem neutros na
// régua até que o recorte quantitativo municipal seja validado.
Object.assign(REGIONAL, {
  P311A: {
    codigo: "AR-PAT-2026-311A", versao: "1.1 (leitura territorial documentada)", emissao: "2026-10-02",
    ativo: "P311A Mega Curitiba", marcoZero: "BR-116, 1500 — Campina Grande do Sul/PR (nome comercial Mega Curitiba)",
    municipioUF: "Campina Grande do Sul / PR", coordenadas: "não aferidas", pdfPath: null,
    localizacaoFonte: "https://capitalrealty.com.br/contatos/",
    leituraTerritorial: {
      base: "Captura Google Earth fornecida por Marcio em 02/10/2026; imagem exibe 18/08/2026. Endereço confrontado com a página de contatos da Capital Realty.",
      setores: [
        { setor: "Corredor rodoviário e acesso", observacao: "O marcador do empreendimento aparece junto a uma via rodoviária e a acessos locais. O cadastro da administradora situa o Mega Curitiba na BR-116, 1500, Campina Grande do Sul/PR.", implicacao: "A conexão rodoviária pode concentrar circulação de veículos nos acessos. A imagem não informa volume, horário ou situação das cancelas.", acao: "Confrontar falhas reais de portões, cancelas e identificação de veículos com o acesso correspondente; priorizar conforme a régua operacional existente." },
        { setor: "Vegetação e áreas abertas", observacao: "A captura mostra manchas de vegetação e áreas abertas próximas ao complexo; não delimita o perímetro cadastral nem a cobertura das barreiras.", implicacao: "Essas condições podem dificultar a observação de trechos do limite, quando houver contato com o perímetro e cobertura insuficiente.", acao: "Verificar em campo contato com o limite, iluminação e cobertura de detecção/CFTV. Não presumir sensores, cerca elétrica ou Alpha Sense operantes a partir da imagem." },
        { setor: "Ocupação urbana e referência de atendimento", observacao: "A imagem identifica ocupação urbana e o Hospital Angelina Caron no panorama regional.", implicacao: "A ocupação pode gerar circulação local; a presença do hospital no mapa não comprova trajeto, disponibilidade ou tempo de atendimento.", acao: "Validar rotas de entrada e saída, ponto de encontro e atendimento de emergência. Distância e tempo de resposta permanecem não aferidos." },
      ],
      limitacao: "Setores temáticos de leitura visual, não quadrantes georreferenciados. Não comprova ocorrências criminais, invasões, alagamento ou grau de ameaça. Limites e proteções exigem validação de campo.",
    },
    mapaIncorporado: true, aplicarModulador: false,
    auditoria: auditoriaTerritorial(
      "Campina Grande do Sul/PR; entorno imediato do complexo logístico",
      "A leitura documenta conexão rodoviária, vegetação/áreas abertas e ocupação urbana. As consequências são condicionais e devem ser cruzadas com falhas operacionais apuradas; não se presume proteção implantada nem grau de ameaça pela imagem.",
    ),
    indicadores: indicadorNaoAferido("Campina Grande do Sul/PR; recorte municipal ainda não extraído"),
    quadrantes: [],
    protecao: [],
    fontes: [
      { orgao: "SESP-PR/CAPE", url: "https://www.seguranca.pr.gov.br/CAPE/Estatisticas", periodo: "recorte municipal set/2025–set/2026 não aferido", consulta: "2026-09-27", escopo: "Campina Grande do Sul" },
      { orgao: "Google Earth — referência visual fornecida por Marcio", url: "https://earth.google.com/web/search/Mega+Curitiba/@-25.35002926,-49.06078926,886.23007508a,5740.38379566d,35y,0h,0t,0r/data=CiwiJgokCRUSarQO3jrAETrEh1F86DrAGbBuf-ZvVkjAIeOJMYHQYkjAQgIIATIpCicKJQohMTlaZ2pPWklqVnRXX2otVWNodEhDWlZCVnc5UXVJRmhoIAE6AwoBMEICCABKCAjd6rz6BhAB", periodo: "captura fornecida em 02/10/2026; imagem exibe 18/08/2026", consulta: "2026-10-02", escopo: "Campina Grande do Sul/PR; panorama regional com marcador P311A Mega Curitiba fornecido pelo responsável. Sem medição de distância, tempo de resposta ou grau de risco. Coordenadas da câmera não equivalem às do ativo." },
      { orgao: "Sinesp/MJSP", url: SINESP_URL, periodo: "base nacional disponível", consulta: "2026-09-27", escopo: "indicadores municipais conforme disponibilidade" },
    ],
  },
  P311B: {
    codigo: "AR-PAT-2026-311B", versao: "1.1 (leitura territorial documentada)", emissao: "2026-10-02",
    ativo: "P311B Mega Itajaí", marcoZero: "Av. Jorge Lacerda, 1010 — Itajaí/SC (Mega Itajaí)",
    municipioUF: "Itajaí / SC", coordenadas: "não aferidas", pdfPath: null,
    localizacaoFonte: "https://capitalrealty.com.br/contatos/",
    leituraTerritorial: {
      base: "Captura Google Earth com marcador P311B fornecida por Marcio em 02/10/2026; data de aquisição não aferida. Endereço confrontado com a página de contatos da Capital Realty.",
      setores: [
        { setor: "Eixo viário e complexo logístico", observacao: "A captura mostra galpões e conexão com o eixo viário junto ao marcador P311B. A administradora informa endereço na Av. Jorge Lacerda, 1010.", implicacao: "Os acessos podem concentrar circulação logística e demandar rastreabilidade. Não há medição de fluxo ou comprovação de falha de controle pela imagem.", acao: "Cruzar falhas reais de acesso/CFTV com os pontos de entrada, saída e carga. Não atribuir docas ou barreiras específicas sem planta e registro operacional." },
        { setor: "Áreas abertas e vegetação", observacao: "Há áreas abertas e manchas vegetadas no panorama, além de ocupação urbana identificada como Espinheiros e Cordeiros; os rótulos não definem o bairro cadastral do ativo.", implicacao: "A interface entre áreas abertas e ocupadas pode exigir atenção à visibilidade dos limites, se houver contato efetivo com o perímetro.", acao: "Conferir limites, iluminação e cobertura de detecção por trecho; manter grau territorial não aferido até validação." },
        { setor: "Rede hidrográfica e continuidade", observacao: "O panorama identifica Rio Itajaí-açu e Rio Itajaí-Mirim. A imagem não delimita cota, mancha de inundação ou exposição do empreendimento.", implicacao: "A proximidade regional de rios pode justificar consulta a mapas e alertas de Defesa Civil; não comprova que o imóvel esteja em área inundável.", acao: "Consultar a Defesa Civil de Itajaí para o endereço e validar alternativas de acesso/continuidade. Não lançar alagamento como sinistro ocorrido nem alterar a classe de risco por esta hipótese." },
      ],
      limitacao: "Setores temáticos, sem escala ou medição cadastral. Criminalidade, grau de ameaça, inundação do imóvel e pronta-resposta não aferidos. A imagem não prova funcionamento de proteções.",
    },
    mapaIncorporado: true, aplicarModulador: false,
    auditoria: auditoriaTerritorial(
      "Itajaí/SC; entorno imediato do complexo industrial/logístico",
      "A leitura distingue eixo viário/logístico, áreas abertas/vegetação e rede hidrográfica regional. As ações são verificações condicionais de acesso, visibilidade e continuidade; não constituem comprovação de crime ou inundação no ativo.",
    ),
    indicadores: indicadorNaoAferido("Itajaí/SC; recorte municipal ainda não extraído"),
    quadrantes: [],
    protecao: [],
    fontes: [
      { orgao: "SSP-SC/GEAC", url: "https://ssp.sc.gov.br/", periodo: "recorte municipal set/2025–set/2026 não aferido", consulta: "2026-09-27", escopo: "Itajaí" },
      { orgao: "Defesa Civil de Itajaí", url: "https://defesacivil.itajai.sc.gov.br/", periodo: "mapas e monitoramento disponíveis no portal; consulta específica do imóvel pendente", consulta: "2026-10-02", escopo: "Itajaí; referência para continuidade, não comprovação de inundação do P311B" },
      { orgao: "Google Earth — referência visual fornecida por Marcio", url: "https://earth.google.com/web/search/Mega+Iatajai/@-26.88777433,-48.72366288,6.55185544a,7174.17605097d,35y,0h,0t,0r/data=CiwiJgokCSghER8SZjfAERDoR1kvejfAGbOXFQjVLEfAIeYJPuoKREfAQgIIATIpCicKJQohMTlaZ2pPWklqVnRXX2otVWNodEhDWlZCVnc5UXVJRmhoIAE6AwoBMEICCABKCAjd6rz6BhAB", periodo: "captura fornecida em 02/10/2026; data de aquisição da imagem não aferida", consulta: "2026-10-02", escopo: "Itajaí; panorama regional com marcador P311B fornecido pelo responsável. Sem medição de distância, tempo de resposta ou grau de risco. Coordenadas da câmera não equivalem às do ativo." },
      { orgao: "Sinesp/MJSP", url: SINESP_URL, periodo: "base nacional disponível", consulta: "2026-09-27", escopo: "indicadores municipais conforme disponibilidade" },
    ],
  },
  P505: {
    codigo: "AR-PAT-2026-505", versao: "1.2 (leitura territorial documentada)", emissao: "2026-10-02",
    ativo: "P505 Klog Guarulhos", marcoZero: "Centro Logístico KLOG GUARULHOS — Rua Indubel, 940, Cumbica",
    municipioUF: "Guarulhos / SP", coordenadas: "-23.4420114, -46.4476851", pdfPath: null,
    mapsUrl: "https://maps.app.goo.gl/sZjhSZwo8Zzy1erVA",
    localizacaoFonte: "https://maps.app.goo.gl/sZjhSZwo8Zzy1erVA",
    localizacaoNota: "Local confirmado por Marcio em 02/10/2026; coordenadas do marcador do estabelecimento. Não representam levantamento topográfico.",
    leituraTerritorial: {
      base: "Local confirmado por Marcio e captura Google Earth fornecida em 02/10/2026; mosaico exibe 27/01/2020–18/08/2026. O enquadramento regional não delimita divisas do empreendimento.",
      setores: [
        { setor: "Complexo logístico e conexões viárias", observacao: "O marcador Klog Guarulhos aparece em conjunto de grandes edificações, com conexão ao tecido viário da região de Cumbica.", implicacao: "A inserção logística pode concentrar circulação de veículos e interfaces com vias externas; não comprova vulnerabilidade ou volume de tráfego específico.", acao: "Relacionar falhas de acesso, perímetro e CFTV efetivamente coletadas aos pontos de entrada e limites cadastrados, sem modificar a régua do motor." },
        { setor: "Ocupação urbana do entorno", observacao: "O panorama mostra ocupação urbana e rótulos como Jardim Presidente Dutra, Jardim Maria Dirce e Cumbica; esses nomes são referências regionais, não fronteiras cadastrais do P505.", implicacao: "Interfaces urbanas podem exigir controle de identificação e segregação de fluxos. Não permitem atribuir criminalidade a bairros ou moradores.", acao: "Validar acessos de pedestres, prestadores e veículos e cobertura das divisas. Não importar vetores do endereço anterior." },
        { setor: "Referência aeroportuária e continuidade", observacao: "O Aeroporto Internacional de São Paulo/Guarulhos é visível no panorama regional.", implicacao: "A proximidade regional pode orientar planejamento de rotas e continuidade logística; não comprova acesso direto, tempo de deslocamento ou proteção aeroportuária disponível ao ativo.", acao: "Confirmar rotas e alternativas com a operação local. Pronta-resposta policial, hospitalar e de bombeiros permanece sem distância ou tempo aferidos." },
      ],
      limitacao: "Sem quadrantes delimitados, escala cadastral, estatística criminal municipal consolidada ou grau de ameaça aferido. Não se transferem conclusões de outro endereço para o local confirmado.",
    },
    mapaIncorporado: true, aplicarModulador: false,
    auditoria: auditoriaTerritorial(
      "Guarulhos/SP; Rua Indubel, 940, Cumbica",
      "O local confirmado apresenta inserção logística, ocupação urbana regional e referência aeroportuária. O relatório cruza essas condições com os vetores operacionais, sem importar o diagnóstico do endereço antigo nem atribuir grau criminal por leitura da imagem.",
    ),
    indicadores: indicadorNaoAferido("Guarulhos/SP; recorte municipal ainda não extraído"),
    quadrantes: [],
    protecao: [],
    fontes: [
      { orgao: "SSP-SP/CAP", url: "https://www.portal.ssp.sp.gov.br/estatistica/consultas", periodo: "recorte municipal set/2025–set/2026 não aferido", consulta: "2026-10-02", escopo: "Guarulhos; página de consulta, sem indicador municipal extraído" },
      { orgao: "Google Earth — referência visual fornecida por Marcio", url: "https://earth.google.com/web/search/Kalog+Guarulhos/@-23.43812971,-46.4409589,748.99120683a,13097.45150187d,34.99999984y,0h,0t,0r/data=CiwiJgokCU06l6pBsDbAEQ79KrHxtjrAGYIA-RawtkTAISmhBYbTfUnAQgIIATIpCicKJQohMTlaZ2pPWklqVnRXX2otVWNodEhDWlZCVnc5UXVJRmhoIAE6AwoBMEICCABKCAjd6rz6BhAB", periodo: "captura fornecida em 02/10/2026; mosaico exibe 27/01/2020–18/08/2026", consulta: "2026-10-02", escopo: "Guarulhos; panorama regional, sem medição de distância, tempo de resposta ou grau de risco. Coordenadas da câmera não equivalem às do ativo." },
      { orgao: "Sinesp/MJSP", url: SINESP_URL, periodo: "base nacional disponível", consulta: "2026-09-27", escopo: "município de Guarulhos; extração pendente" },
    ],
  },
});

// Nível numérico da régua (espelha NIVEIS do AnaliseRisco): CRÍTICO4 ELEVADO3 MODERADO2 BAIXO1
const NIVEL_CRITICO = 4, NIVEL_ELEVADO = 3;

// ── COLETOR (síncrono — lê do config) ────────────────────────
export function coletarRegional(pid) {
  const r = REGIONAL[pid];
  if (!r) return { ok: false, temDado: false, motivo: "sem diagnóstico regional cadastrado" };
  return { ok: true, temDado: true, ...r };
}

// ── MODULADOR DE RISCO REGIONAL (delta) ──────────────────────
// Mesmo formato dos outros moduladores: { delta, motivo }.
//   • Grau do pior quadrante define a base do agravamento.
//   • Casa com vulnerabilidade operacional da MESMA natureza → agrava +1.
//   • Fatores protetivos próximos (PM < 5 km) atenuam parte do agravamento.
export function moduladorRegional(reg, vetores) {
  if (!reg?.ok || !reg.temDado) return { delta: 0, motivo: null };
  if (reg.aplicarModulador === false) {
    return { delta: 0, motivo: "contexto territorial qualitativo; sem modulador quantitativo validado" };
  }

  // 1) Pior grau entre os quadrantes
  let piorGrau = "BAIXO", piorQuad = null;
  for (const q of (reg.quadrantes || [])) {
    if ((GRAU_PESO[q.grau] ?? 0) > (GRAU_PESO[piorGrau] ?? 0)) { piorGrau = q.grau; piorQuad = q; }
  }
  const pesoGrau = GRAU_PESO[piorGrau] ?? 0;

  // Base do agravamento pelo grau: GRAVÍSSIMO +2, GRAVE +1, MODERADO 0, BAIXO 0.
  let delta = 0;
  if (pesoGrau >= 3) delta = 2;
  else if (pesoGrau === 2) delta = 1;

  // 2) Casamento de natureza: se algum vetor regional coincide com
  //    vulnerabilidade operacional (nível >= ELEVADO) da mesma natureza, +1.
  const naturezasRegionais = new Set();
  for (const q of (reg.quadrantes || [])) for (const v of (q.vetores || [])) if (v.natureza) naturezasRegionais.add(v.natureza);
  const reNat = {
    perimetro: /perimetr|cerca|bollard/i,
    acesso:    /cancela|eclusa|portao|acesso|garra|dilacerador/i,
    furto:     /cftv|camera|monitor|ctmk/i,
    violento:  /panico|efetivo|ronda/i,
  };
  let casaNat = null;
  const _norm = (s) => (s || "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (Array.isArray(vetores)) {
    for (const nat of naturezasRegionais) {
      const re = reNat[nat];
      if (re && vetores.some((v) => re.test(_norm(v.label)) && (v.nivel || 0) >= NIVEL_ELEVADO)) { casaNat = nat; break; }
    }
  }
  if (casaNat) delta += 1;

  // 3) Atenuação por pronta-resposta: PM titular/qualquer PM a < 5 km reduz 1
  //    (nunca abaixo de 0; a regional não atenua sozinha um quadro sem risco).
  const pmPerto = (reg.protecao || []).some((p) => p.tipo === "pm" && (p.distanciaKm ?? 99) < 5);
  if (pmPerto && delta > 0) delta -= 1;

  if (delta === 0) {
    return { delta: 0, motivo: `entorno ${piorGrau.toLowerCase()}, mitigado por pronta-resposta próxima` };
  }
  const casaTxt = casaNat ? `, coincidente com vulnerabilidade operacional (${casaNat})` : "";
  const pmTxt = pmPerto ? "; atenuado por PM a menos de 5 km" : "";
  return {
    delta,
    motivo: `diagnóstico regional ${reg.codigo || ""}: entorno ${piorGrau.toLowerCase()}${piorQuad ? ` (${piorQuad.regiao})` : ""}${casaTxt}${pmTxt}`.trim(),
  };
}

// ── Texto para o relatório (bloco de fonte/cruzamento) ───────
export function resumoRegionalTexto(reg) {
  if (!reg?.ok || !reg.temDado) return null;
  const graus = (reg.quadrantes || []).map((q) => `${q.lado}: ${q.grau}`).join(" · ");
  return {
    codigo: reg.codigo,
    marcoZero: reg.marcoZero,
    coordenadas: reg.coordenadas,
    graus,
    pdfPath: reg.pdfPath,
  };
}

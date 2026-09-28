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
    codigo: "AR-PAT-2026-311A", versao: "1.0 (qualitativo)", emissao: "2026-09-27",
    ativo: "P311A Mega Curitiba", marcoZero: "Complexo logístico P311A — Curitiba/PR",
    municipioUF: "Curitiba / PR", coordenadas: "não aferidas", pdfPath: null,
    mapaIncorporado: true, aplicarModulador: false,
    auditoria: auditoriaTerritorial(
      "Curitiba/PR; entorno imediato do complexo logístico",
      "O mapa de referência mostra faixas vegetadas e circulação interna de veículos e docas. O diagnóstico territorial reforça a relevância da continuidade das camadas Alpha Sense e cerca elétrica, sem recalcular a doutrina operacional do P311A.",
    ),
    indicadores: indicadorNaoAferido("Curitiba/PR; recorte municipal ainda não extraído"),
    quadrantes: [{
      lado: "ENTORNO IMEDIATO", regiao: "Complexo industrial/logístico e faixas vegetadas limítrofes", grau: "MODERADO",
      vetores: [
        { natureza: "perimetro", desc: "As faixas vegetadas observadas no mapa podem reduzir a visibilidade natural de alguns trechos limítrofes, tornando relevante a continuidade das camadas Alpha Sense e cerca elétrica." },
        { natureza: "acesso", desc: "A circulação interna de veículos e docas pode ampliar a necessidade de rastreabilidade nos acessos e nas rotas entre os blocos." },
      ],
    }],
    protecao: [],
    fontes: [
      { orgao: "SESP-PR/CAPE", url: "https://www.seguranca.pr.gov.br/CAPE/Estatisticas", periodo: "recorte municipal set/2025–set/2026 não aferido", consulta: "2026-09-27", escopo: "Curitiba" },
      { orgao: "Sinesp/MJSP", url: SINESP_URL, periodo: "base nacional disponível", consulta: "2026-09-27", escopo: "indicadores municipais conforme disponibilidade" },
    ],
  },
  P311B: {
    codigo: "AR-PAT-2026-311B", versao: "1.0 (qualitativo)", emissao: "2026-09-27",
    ativo: "P311B Mega Itajaí", marcoZero: "Complexo logístico P311B — Itajaí/SC",
    municipioUF: "Itajaí / SC", coordenadas: "não aferidas", pdfPath: null,
    mapaIncorporado: true, aplicarModulador: false,
    auditoria: auditoriaTerritorial(
      "Itajaí/SC; entorno imediato do complexo industrial/logístico",
      "O mapa de referência evidencia áreas abertas, docas e fluxos logísticos no entorno imediato. Esses elementos podem ampliar a necessidade de detecção antecipada e rastreabilidade de acessos, sem alterar a classificação calculada pelo motor.",
    ),
    indicadores: indicadorNaoAferido("Itajaí/SC; recorte municipal ainda não extraído"),
    quadrantes: [{
      lado: "ENTORNO IMEDIATO", regiao: "Complexo industrial com áreas abertas e operação de docas", grau: "MODERADO",
      vetores: [
        { natureza: "perimetro", desc: "As áreas abertas observadas no entorno podem ampliar a importância da detecção antecipada e da cobertura contínua dos limites do complexo." },
        { natureza: "acesso", desc: "O fluxo logístico e as docas podem exigir controle consistente de veículos, pessoas e permanência nas áreas de carga." },
      ],
    }],
    protecao: [],
    fontes: [
      { orgao: "SSP-SC/GEAC", url: "https://ssp.sc.gov.br/", periodo: "recorte municipal set/2025–set/2026 não aferido", consulta: "2026-09-27", escopo: "Itajaí" },
      { orgao: "Sinesp/MJSP", url: SINESP_URL, periodo: "base nacional disponível", consulta: "2026-09-27", escopo: "indicadores municipais conforme disponibilidade" },
    ],
  },
  P505: {
    codigo: "AR-PAT-2026-505", versao: "1.0 (qualitativo)", emissao: "2026-09-27",
    ativo: "P505 Klog Paes de Barros", marcoZero: "Complexo logístico P505 — São Paulo/SP",
    municipioUF: "São Paulo / SP (Zona Leste)", coordenadas: "não aferidas", pdfPath: null,
    mapaIncorporado: true, aplicarModulador: false,
    auditoria: auditoriaTerritorial(
      "São Paulo/SP, Zona Leste; entorno imediato do complexo logístico",
      "O mapa de referência mostra tecido industrial urbano, docas, pátios e divisas com imóveis adjacentes. O contexto pode ampliar a importância da segregação de fluxos e da visibilidade perimetral, sem determinar a classe operacional.",
    ),
    indicadores: indicadorNaoAferido("São Paulo/SP; recorte distrital ainda não extraído"),
    quadrantes: [{
      lado: "ENTORNO IMEDIATO", regiao: "Complexo logístico em tecido industrial urbano", grau: "MODERADO",
      vetores: [
        { natureza: "perimetro", desc: "A divisa com vegetação e imóveis industriais adjacentes, observada no mapa, pode demandar continuidade de detecção e visibilidade perimetral." },
        { natureza: "acesso", desc: "A operação de docas e pátios pode elevar a necessidade de identificação, segregação de fluxos e registro de acessos." },
      ],
    }],
    protecao: [],
    fontes: [
      { orgao: "SSP-SP/CAP", url: "https://www.ssp.sp.gov.br/estatistica/consultas", periodo: "recorte distrital set/2025–set/2026 não aferido", consulta: "2026-09-27", escopo: "Zona Leste de São Paulo" },
      { orgao: "Sinesp/MJSP", url: SINESP_URL, periodo: "base nacional disponível", consulta: "2026-09-27", escopo: "município de São Paulo" },
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

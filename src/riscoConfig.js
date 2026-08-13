// ─────────────────────────────────────────────────────────────
// regionalConfig.js — Diagnóstico Regional de Risco por projeto (Etapa c)
// MokLog CheckTest · Análise de Risco v2
//
// Terceira perna do tripé (Operacional + Sinistros + REGIONAL).
// O dado ESTRUTURADO vive aqui (versionado, auditável, lido pelo motor).
// O DOCUMENTO (PDF técnico) vive na pasta pública: public/regional/{PID}.pdf
// e é apenas APONTADO por `pdfPath` — anexado sob demanda na geração do PDF.
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
    pdfPath: "/regional/P607.pdf",   // arquivo em public/regional/P607.pdf

    // Quadrantes limítrofes com grau e tipologias.
    quadrantes: [
      {
        lado: "NORTE (DF)",
        regiao: "Santa Maria / Polo Multi-industrial (DF-290)",
        grau: "GRAVE",
        vetores: [
          { natureza: "acesso",    desc: "Quadrilhas de roubo e transbordo de cargas" },
          { natureza: "perimetro", desc: "Invasão perimetral e furto noturno em galpões" },
          { natureza: "furto",     desc: "Furto/roubo de veículos e de infraestrutura" },
        ],
      },
      {
        lado: "SUL (GO)",
        regiao: "Jardim Céu Azul / Valparaíso de Goiás",
        grau: "GRAVISSIMO",
        vetores: [
          { natureza: "violento", desc: "Crimes Violentos Letais Intencionais (CVLI) — ~20/100 mil hab." },
          { natureza: "violento", desc: "Tráfico e atuação de facções na faixa de divisa" },
          { natureza: "violento", desc: "Latrocínios e roubo a pedestres/trabalhadores" },
        ],
      },
    ],

    // Fatores protetivos (pronta-resposta). distanciaKm atenua conforme proximidade.
    protecao: [
      { orgao: "Hospital Regional de Santa Maria (HRSM)", uf: "DF", distanciaKm: 3.5, tempoMin: 5,  tipo: "hospital" },
      { orgao: "26º BPM (PMDF)", uf: "DF", distanciaKm: 5.5, tempoMin: 8, tipo: "pm", titular: true },
      { orgao: "18º CBMDF (Bombeiros)", uf: "DF", distanciaKm: 6.2, tempoMin: 9, tipo: "bombeiro" },
      { orgao: "Hospital Municipal de Valparaíso", uf: "GO", distanciaKm: 3.8, tempoMin: 6, tipo: "hospital" },
      { orgao: "20º BPM (PMGO)", uf: "GO", distanciaKm: 4.2, tempoMin: 7, tipo: "pm" },
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
    pdfPath: "/regional/P601.pdf",

    quadrantes: [
      {
        lado: "CORREDOR LOGÍSTICO (SP)",
        regiao: "Rod. dos Bandeirantes / polo de galpões (Cajamar)",
        grau: "GRAVE",
        vetores: [
          { natureza: "acesso",    desc: "Roubo e furto de carga em trânsito e em pátio" },
          { natureza: "perimetro", desc: "Invasão perimetral e furto noturno em galpões" },
          { natureza: "furto",     desc: "Furto de veículos e de infraestrutura" },
        ],
      },
      {
        lado: "NÚCLEO COMUNITÁRIO (SP)",
        regiao: "Comunidade Roseira — divisa Cajamar/Franco da Rocha",
        grau: "GRAVISSIMO",
        vetores: [
          { natureza: "violento", desc: "Tráfico de drogas com pontos fixos (operações da 3ª Cia 26º BPM)" },
          { natureza: "violento", desc: "Crime violento / homicídio por arma de fogo registrado" },
          { natureza: "acesso",   desc: "Acesso ao perímetro pela Estr. Mun. p/ Parnaíba (jurisdição partilhada)" },
        ],
      },
    ],

    protecao: [
      { orgao: "3ª Cia 26º BPM/M — Jordanésia (PMESP)", uf: "SP", distanciaKm: 2.5, tempoMin: 5, tipo: "pm", titular: true },
      { orgao: "UPA de Jordanésia (pronto-atendimento)", uf: "SP", distanciaKm: 4.0, tempoMin: 8, tipo: "hospital" },
      { orgao: "26º BPM/M (Sede) — Franco da Rocha", uf: "SP", distanciaKm: 7.0, tempoMin: 12, tipo: "pm" },
      { orgao: "Hospital Estadual Albano da Franca Rocha", uf: "SP", distanciaKm: 8.0, tempoMin: 14, tipo: "hospital" },
    ],
  },

  // ── Próximos projetos: duplicar o bloco acima quando a regional
  //    for elaborada. Ex.: P605, P311A... ──────────────
};

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

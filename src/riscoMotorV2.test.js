// Motor de risco v2 — doutrina aprovada por Marcio em 08/10/2026.
// Fixtures = pendências dos 9 laudos semanais de 04/10/2026 (aging em dias
// no dia do laudo). Cada caso tem de sair com o NÍVEL e o VETOR DETERMINANTE
// acordados; falhou um → não sobe prévia.
import { classificarProjeto, vetoresDoTesteSemanal, gerarHTMLAnaliseRisco } from "./AnaliseRisco";
import { NIVEL } from "./riscoConfig";
import { avaliarViasTransponiveis, classificarCFTVGraduado, PERFIL_BARREIRAS } from "./riscoMotorV2";

// ── helpers de fixture ────────────────────────────────────────
const since = (dias) => { const d = new Date("2026-10-04T12:00:00"); d.setDate(d.getDate() - dias); return d.toISOString().slice(0, 10); };
const P = (catId, catLabel, itemLabel, dias, status = "INOPERANTE", note = "") =>
  ({ catId, catLabel, itemLabel, status, dias, since: since(dias), note });
function ts(pid, pend, totais) {
  // catAgg: total e inop por categoria (inop = inoperantes + parciais, como no coletor)
  const catAgg = {};
  Object.entries(totais).forEach(([catLabel, total]) => { catAgg[catLabel] = { total, inop: 0, piorDias: null }; });
  pend.forEach((p) => {
    if (!catAgg[p.catLabel]) catAgg[p.catLabel] = { total: 1, inop: 0, piorDias: null };
    catAgg[p.catLabel].inop += 1;
    if (p.dias != null && (catAgg[p.catLabel].piorDias == null || p.dias > catAgg[p.catLabel].piorDias)) catAgg[p.catLabel].piorDias = p.dias;
  });
  return { ok: true, temDado: true, pid, pend, catAgg, data: "04/10/2026", dataRaw: "2026-10-04", pct: 90, total: 100, okItens: 90 };
}
const projeto = (id, name) => ({ id, name });
function rodar(pid, nome, pend, totais) {
  const dados = { ts: ts(pid, pend, totais) };
  const vetores = vetoresDoTesteSemanal(dados.ts, "04/10/2026");
  return classificarProjeto(projeto(pid, nome), vetores, dados);
}

// ── os 9 laudos de 04/10/2026 ────────────────────────────────
const CASOS = {
  P505: () => rodar("P505", "Klog Guarulhos", [
    P("garra", "10 - GARRA DE TIGRE (DILACERADORES)", "Unidade 04", 232, "INOPERANTE", "Não funcionou inoperante."),
    P("garra", "10 - GARRA DE TIGRE (DILACERADORES)", "Unidade 02", 18, "INOPERANTE", "Não elevou durante o teste"),
    P("garra", "10 - GARRA DE TIGRE (DILACERADORES)", "Unidade 03", 18, "INOPERANTE", "Não elevou durante o teste"),
    P("perimeter", "01 - ALARME PERIMETRAL", "Zona 12", 11, "INOPERANTE", "Não acionou"),
    P("panic_fix", "04 - PÂNICO FIXO", "Unidade 02", 11, "PARCIAL", "Pânico fixo portaria não está subindo para central Moked"),
    P("panic_mob", "04B - PÂNICO MÓVEL", "Unidade 01", 11, "INOPERANTE", "Nao está chegando na central"),
    P("panic_mob", "04B - PÂNICO MÓVEL", "Unidade 02", 11, "PARCIAL", "Não está subindo para central"),
    P("panic_mob", "04B - PÂNICO MÓVEL", "Unidade 03", 11, "PARCIAL", "Não está subindo para central"),
    P("cancelas", "05 - CANCELAS, HASTES E MECANISMOS", "Saída 04", 60, "INOPERANTE", "Portões da eclusa 04 inoperante interno e externo"),
    P("cancelas", "05 - CANCELAS, HASTES E MECANISMOS", "Entrada 01", 59, "INOPERANTE", "As duas cancelas inoperante"),
    P("cftv", "06 - CFTV FIXAS", "Câmera CF26", 23), P("cftv", "06 - CFTV FIXAS", "Câmera CF32", 23), P("cftv", "06 - CFTV FIXAS", "Câmera CF58", 23), P("cftv", "06 - CFTV FIXAS", "Câmera CF65", 23), P("cftv", "06 - CFTV FIXAS", "Câmera CF12", 38),
    P("torniquetes", "22 - TORNIQUETES (ESTRUTURA MECÂNICA)", "Unidade 04", 201), P("sensores", "20 - SENSORES ANTI-ESMAGAMENTO", "Unidade 04", 232),
    P("telefone", "21 - TELEFONE FIXO CCO E PORTARIA", "Ramal CCO", 232, "PARCIAL"), P("mesa", "14 - MESA CONTROLADORA (CCO 32 BOTÕES)", "Portaria", 116),
    P("farois", "09 - FARÓIS/LED DAS CANCELAS", "Cancela 02", 109), P("farois", "09 - FARÓIS/LED DAS CANCELAS", "Cancela 07", 74), P("farois", "09 - FARÓIS/LED DAS CANCELAS", "Cancela 06", 67), P("farois", "09 - FARÓIS/LED DAS CANCELAS", "Cancela 01", 27),
    P("portoes_controle", "18 - PORTÕES (FOLHAS)", "Portão pista 2", 11), P("portoes_controle", "18 - PORTÕES (FOLHAS)", "Portão pista 3", 11),
  ], { "10 - GARRA DE TIGRE (DILACERADORES)": 4, "01 - ALARME PERIMETRAL": 12, "04 - PÂNICO FIXO": 2, "04B - PÂNICO MÓVEL": 3, "05 - CANCELAS, HASTES E MECANISMOS": 8, "06 - CFTV FIXAS": 78, "22 - TORNIQUETES (ESTRUTURA MECÂNICA)": 4, "20 - SENSORES ANTI-ESMAGAMENTO": 8, "21 - TELEFONE FIXO CCO E PORTARIA": 2, "14 - MESA CONTROLADORA (CCO 32 BOTÕES)": 2, "09 - FARÓIS/LED DAS CANCELAS": 8, "18 - PORTÕES (FOLHAS)": 16 }),

  P604: () => rodar("P604", "Golgi Jundiaí", [
    P("perimeter", "02 - ALARME PERIMETRAL", "Zona 04", 613, "INOPERANTE", "Rompimento de fibra"),
    P("perimeter", "02 - ALARME PERIMETRAL", "Zona 07", 583, "INOPERANTE", "Rompimento de fibra"),
    P("perimeter", "02 - ALARME PERIMETRAL", "Zona 06", 8, "INOPERANTE", "Rompimento de fibra"),
    P("bollards", "20 - PINOS BOLLARDS", "Pino 05", 109, "INOPERANTE", "Não está recebendo comando"),
    P("bollards", "20 - PINOS BOLLARDS", "Pino 04", 18, "INOPERANTE", "Somente 1 pino funcionando"),
    P("cancelas_baia", "05 - CANCELAS AS (ALTA SEGURANÇA)", "Cancela 03", 18, "INOPERANTE", "Botoeira de funcionamento"),
    P("cancelas_baia", "05 - CANCELAS AS (ALTA SEGURANÇA)", "Cancela 02", 6, "INOPERANTE", "Motor com acionamento constante"),
    P("cancelas_estac", "04 - CANCELAS ADM (ADMINISTRATIVAS)", "Cancela 01", 704), P("cancelas_estac", "04 - CANCELAS ADM (ADMINISTRATIVAS)", "Cancela 02", 102),
    ...Array.from({ length: 16 }, (_, i) => P("cftv", "06 - CFTV", `CF ${i + 1}`, [142, 142, 142, 142, 74, 74, 74, 74, 59, 59, 59, 59, 53, 27, 13, 8][i], "INOPERANTE", "Conversor de mídia")),
    P("paradox", "19 - PARADOX", "CCO", 460, "PARCIAL"), P("semaforos", "21 - SEMÁFOROS (BAIA)", "Semáforo 04", 139), P("qr_torn", "10 - LEITORES QR (TORNIQUETES)", "QR 03", 67, "PARCIAL"),
  ], { "02 - ALARME PERIMETRAL": 7, "20 - PINOS BOLLARDS": 8, "05 - CANCELAS AS (ALTA SEGURANÇA)": 4, "04 - CANCELAS ADM (ADMINISTRATIVAS)": 2, "06 - CFTV": 73, "19 - PARADOX": 2, "21 - SEMÁFOROS (BAIA)": 4, "10 - LEITORES QR (TORNIQUETES)": 8 }),

  P607: () => rodar("P607", "Golgi Brasília", [
    P("perimeter", "02 - ALARME PERIMETRAL", "Zona 02", 269, "INOPERANTE", "Desativada pelo técnico"),
    P("perimeter", "02 - ALARME PERIMETRAL", "Zona 01", 255, "INOPERANTE", "Desativada pelo técnico"),
    P("perimeter", "02 - ALARME PERIMETRAL", "Zona 03", 61, "PARCIAL", "Faltando um pedaço do cabo"),
    P("fire", "01 - ALARME DE INCÊNDIO", "Painel Guarita", 468, "PARCIAL"), P("fire", "01 - ALARME DE INCÊNDIO", "Painel CCO", 206, "PARCIAL"),
    P("cftv", "06 - CFTV", "CF-20", 92), P("cftv", "06 - CFTV", "CF-09", 23), P("cftv", "06 - CFTV", "CF-17", 15),
  ], { "02 - ALARME PERIMETRAL": 4, "01 - ALARME DE INCÊNDIO": 3, "06 - CFTV": 45 }),

  P605: () => rodar("P605", "Golgi Dutra", [
    P("panic_fix", "20 - PÂNICO FIXO", "CCO", 30, "PARCIAL", "Não reportou"),
    P("perimeter", "01 - ALARME PERIMETRAL", "Zona 04", 7, "INOPERANTE", "Após manutenção na Z03 a Z04 ficou inoperante"),
    P("eclusas", "08 - ECLUSA CCO (ABERTURA)", "Porta 01 — Remota", 130, "INOPERANTE", "Remoto inoperante sem abertura"),
    P("eclusas", "08 - ECLUSA CCO (ABERTURA)", "Porta 02 — Remota", 130, "INOPERANTE", "Remota inoperante"),
    P("cancelas", "05 - CANCELAS AS (ALTA SEGURANÇA)", "Saída 03 Reversa", 123, "PARCIAL", "Placa instalada em teste"),
    P("cancelas", "05 - CANCELAS AS (ALTA SEGURANÇA)", "Saída 04", 123, "PARCIAL", "Falha no lastro, não fecha"),
    P("cftv", "06 - CFTV", "CF 11", 286), P("cftv", "06 - CFTV", "CF 30", 48),
    P("totens", "25 - TOTENS", "Visitantes", 393), P("pictogramas", "19 - PICTOGRAMAS / FARÓIS", "Farol 06", 285),
    P("telefone", "23 - TELEFONES", "CCO Ramal", 95, "PARCIAL"), P("mon_cftv", "16 - MONITOR CCO CFTV", "Monitor 04", 29), P("mon_cftv", "16 - MONITOR CCO CFTV", "Monitor 05", 29),
  ], { "20 - PÂNICO FIXO": 1, "01 - ALARME PERIMETRAL": 4, "08 - ECLUSA CCO (ABERTURA)": 4, "05 - CANCELAS AS (ALTA SEGURANÇA)": 4, "06 - CFTV": 54, "25 - TOTENS": 2, "19 - PICTOGRAMAS / FARÓIS": 6, "23 - TELEFONES": 5, "16 - MONITOR CCO CFTV": 5 }),

  P602: () => rodar("P602", "Golgi Mauá", [
    P("garras", "06 - GARRAS (ECLUSAS)", "Saída 01", 138, "INOPERANTE", "Garra não abre"),
    P("garras", "06 - GARRAS (ECLUSAS)", "Saída 02", 32, "INOPERANTE", "Garra não abre"),
    P("cftv", "05 - CFTV", "Câmera 25 - Perímetro 14", 231), P("cftv", "05 - CFTV", "Câmera 31 - Perimetro 16", 225), P("cftv", "05 - CFTV", "Câmera 33 - Perímetro 15", 214), P("cftv", "05 - CFTV", "Câmera 59 - Perimetro 13", 214),
    P("cftv", "05 - CFTV", "Câmera 54 - Perimetro 04", 184), P("cftv", "05 - CFTV", "Câmera 26 - Perimetro 03", 108), P("cftv", "05 - CFTV", "Câmera 49 - Perimetro 01", 79), P("cftv", "05 - CFTV", "Câmera 64 - Perímetro 09", 29),
    P("portaria", "11 - PORTARIA", "Joystick", 175, "INOPERANTE", "Desabilitado"),
  ], { "06 - GARRAS (ECLUSAS)": 4, "05 - CFTV": 49, "11 - PORTARIA": 4 }),

  P311B: () => rodar("P311B", "Mega CL Itajaí", [
    P("dilaceradores", "08 - DILACERADORES", "Cancela 04", 463, "INOPERANTE", "Dilacerador não instalado"),
    P("portoes", "13 - PORTÕES", "Portão 03", 28, "INOPERANTE", "Estrutura danificada por colisão."),
    P("qr_code", "09 - LEITORES QR CODE", "Saída Cancela 04 Sup", 25, "INOPERANTE", "Desativado por falta de peça de reposição."),
    P("totens_cancela", "16 - TOTENS NAS CANCELAS", "Totem Cancela 04", 28, "PARCIAL"),
    P("cftv", "06 - CFTV", "Cam 52", 35), P("cftv", "06 - CFTV", "Cam 33", 13), P("cftv", "06 - CFTV", "Cam 08", 4),
  ], { "08 - DILACERADORES": 4, "13 - PORTÕES": 4, "09 - LEITORES QR CODE": 12, "16 - TOTENS NAS CANCELAS": 6, "06 - CFTV": 114 }),

  P606: () => rodar("P606", "Golgi Duque de Caxias", [
    ...[280, 280, 252, 252, 215, 215, 130, 128, 124, 95, 46, 46, 46, 32, 19].map((d, i) => P("cftv", "05 - CFTV", `Câmera ${i + 1}`, d)),
    P("portoes_balanca", "15 - PORTÕES BALANÇA HUBLOG", "Portão 01", 248, "INOPERANTE", "Colisao"),
    P("qr_eclusas", "09 - LEITORAS QR ECLUSAS", "QR 01", 130), P("totens", "19 - TOTENS KEYACCESS", "Área Externa", 140, "PARCIAL"), P("mesa", "11 - MESA CONTROLADORA", "CFTV", 137, "PARCIAL"),
  ], { "05 - CFTV": 74, "15 - PORTÕES BALANÇA HUBLOG": 4, "09 - LEITORAS QR ECLUSAS": 12, "19 - TOTENS KEYACCESS": 2, "11 - MESA CONTROLADORA": 2 }),

  P601: () => rodar("P601", "Golgi Cajamar", [
    P("panic_mob", "21 - PÂNICO MÓVEL", "Reserva", 137, "INOPERANTE", "Conector da bateria danificado"),
    P("panic_mob", "21 - PÂNICO MÓVEL", "Ronda 01", 123, "INOPERANTE", "Sem bateria"),
    P("panic_mob", "21 - PÂNICO MÓVEL", "Ronda 02", 123, "INOPERANTE", "Sem bateria"),
    P("panic_mob", "21 - PÂNICO MÓVEL", "Líder", 121, "INOPERANTE", "Sem bateria"),
    P("cancelas_as", "06 - CANCELAS AS (ALTA SEGURANÇA)", "Acesso 03", 123, "PARCIAL", "Cancela sobe pelo comando da central, porém não baixa no automático."),
    P("cancelas_as", "06 - CANCELAS AS (ALTA SEGURANÇA)", "Acesso 01", 60, "PARCIAL", "Em manutenção"),
    P("qr_cancelas", "11 - LEITORES QR CANCELAS", "Entrada 03", 123, "INOPERANTE", "Retirada a controladora"),
    P("torniquetes", "25 - TORNIQUETES / QR CODE", "Entrada 02", 76, "INOPERANTE", "Não tem leitura dos QR Code"),
    P("torniquetes", "25 - TORNIQUETES / QR CODE", "Saída 02", 76, "INOPERANTE", "Não tem leitura dos QR Code"),
    P("semaforos", "22 - SEMÁFOROS", "Entrada 03", 203), P("semaforos", "22 - SEMÁFOROS", "Saída 03", 81), P("semaforos", "22 - SEMÁFOROS", "Entrada 01", 30), P("semaforos", "22 - SEMÁFOROS", "Saída 05", 20),
    P("sensores", "23 - SENSORES ANTI-ESMAGAMENTO", "Entrada 01", 148), P("sensores", "23 - SENSORES ANTI-ESMAGAMENTO", "Saída 01", 67), P("sensores", "23 - SENSORES ANTI-ESMAGAMENTO", "Entrada 04", 10),
  ], { "21 - PÂNICO MÓVEL": 4, "06 - CANCELAS AS (ALTA SEGURANÇA)": 5, "11 - LEITORES QR CANCELAS": 20, "25 - TORNIQUETES / QR CODE": 8, "22 - SEMÁFOROS": 10, "23 - SENSORES ANTI-ESMAGAMENTO": 10, "04 - BOLLARDS / PINOS": 7, "20 - PÂNICO FIXO": 2, "07 - CFTV": 71 }),

  P311A: () => rodar("P311A", "Mega CL Curitiba", [
    P("cftv", "07 - CFTV", "armazém 3, 2 cameras", 4), P("cftv", "07 - CFTV", "layout1, 1 camera", 4), P("cftv", "07 - CFTV", "armazém 7, 1 camera", 4),
    P("cftv", "07 - CFTV", "perimetral, 2 cameras", 4), P("cftv", "07 - CFTV", "cam 5", 4), P("cftv", "07 - CFTV", "cam 6", 4),
  ], { "07 - CFTV": 140, "09 - DILACERADORES": 5, "01 - ALARME CERCA ELÉTRICA": 4, "01B - ALARME ALPHA SENSE": 8, "04 - PÂNICO FIXO": 1 }),
};

const ESPERADO = {
  P505:  { nivel: NIVEL.CRITICO,  determinante: /GARRA DE TIGRE/i, vias: 3 },
  P604:  { nivel: NIVEL.CRITICO,  determinante: /ALARME PERIMETRAL/i, vias: 2 },
  P607:  { nivel: NIVEL.CRITICO,  determinante: /ALARME PERIMETRAL/i, vias: 0 },
  P605:  { nivel: NIVEL.CRITICO,  determinante: /PÂNICO FIXO/i, vias: 1 },
  P602:  { nivel: NIVEL.CRITICO,  determinante: /GARRAS/i, vias: 2 },
  P311B: { nivel: NIVEL.ELEVADO,  determinante: /DILACERADORES/i, vias: 1 },
  P606:  { nivel: NIVEL.ELEVADO,  determinante: /CFTV/i, vias: 0 },
  P601:  { nivel: NIVEL.MODERADO, determinante: /PÂNICO MÓVEL/i, vias: 0 },
  P311A: { nivel: NIVEL.MODERADO, determinante: /CFTV/i, vias: 0 },
};

describe("motor v2 — os 9 laudos de 04/10/2026", () => {
  test.each(Object.keys(ESPERADO))("%s: nível e vetor determinante acordados", (pid) => {
    const r = CASOS[pid]();
    const esp = ESPERADO[pid];
    expect(r.geral.nivel).toBe(esp.nivel);
    expect(r.geral.determinante?.label || "").toMatch(esp.determinante);
    expect(r.geral.vias.n).toBe(esp.vias);
    // consolidado nunca abaixo do maior vetor incluído
    const maior = r.vetores.filter((v) => !v.observacaoManutencao && v.incluirCliente !== false).reduce((m, v) => Math.max(m, v.nivel || 0), 0);
    expect(r.geral.nivel).toBeGreaterThanOrEqual(maior);
    // nenhum bloqueador em "sem impacto"
    r.vetores.filter((v) => v.classeV2 === "Bloqueador" || v.bloqueadorCaido).forEach((v) => expect(v.observacaoManutencao).toBeFalsy());
    // memória de cálculo termina em "= NÍVEL (vetor determinante: …)"
    expect(r.geral.memoria.resultado).toMatch(new RegExp(`^= ${r.geral.label} \\(vetor determinante:`));
    expect(r.geral.memoria.linhas[0].determinante).toBe(true);
  });

  test("P602: garras 2/4 = 2 vias de saída transponíveis → CRÍTICO; CFTV perimetral é agravante ELEVADO", () => {
    const r = CASOS.P602();
    const garras = r.vetores.find((v) => /GARRAS/.test(v.label));
    expect(garras.nivel).toBe(NIVEL.CRITICO);
    expect(garras.viasTransponiveis.map((x) => x.item)).toEqual(["Saída 01", "Saída 02"]);
    expect(r.geral.memoria.linhas[0].fato).toMatch(/Saída 01 \(138 d\), Saída 02 \(32 d\)/);
    const cftv = r.vetores.find((v) => /CFTV/.test(v.label));
    expect(cftv.nivel).toBe(NIVEL.ELEVADO);
    expect(r.geral.motivoMatriz).toMatch(/2 vias de saída transponíveis/);
  });

  test("P311B: dilacerador ausente 463 d = 1 via transponível → ELEVADO (não cai em manutenção; sem gatilho composto MODERADO)", () => {
    const r = CASOS.P311B();
    const dil = r.vetores.find((v) => /DILACERADORES/.test(v.label));
    expect(dil.nivel).toBe(NIVEL.ELEVADO);
    expect(dil.observacaoManutencao).toBe(false);
    expect(dil.reclassificadoComposto).toBeUndefined();
    expect(r.geral.nivel).toBe(NIVEL.ELEVADO);
  });

  test("P601: pânico móvel 0/4 é tático com piso MODERADO; cancela AS parcial segue bloqueando (sem agravante)", () => {
    const r = CASOS.P601();
    const movel = r.vetores.find((v) => /PÂNICO MÓVEL/.test(v.label));
    expect(movel.classeV2).toBe("Tático");
    expect(movel.nivel).toBe(NIVEL.MODERADO);
    const as = r.vetores.find((v) => /CANCELAS AS/.test(v.label));
    expect(as.bloqueadorCaido).toBe(false);
    expect(r.geral.memoria.semAgravante.some((x) => /CANCELAS AS/i.test(x.item) && /continua bloqueando/.test(x.motivo))).toBe(true);
    expect(r.geral.nivel).toBe(NIVEL.MODERADO);
  });

  test("P311A: 6 câmeras de 140 há 4 dias → piso MODERADO, sem pular para ELEVADO", () => {
    const r = CASOS.P311A();
    const cftv = r.vetores.find((v) => /CFTV/.test(v.label));
    expect(cftv.nivel).toBe(NIVEL.MODERADO);
    expect(cftv.regraV2).toMatch(/piso MODERADO/);
    expect(r.geral.nivel).toBe(NIVEL.MODERADO);
  });

  test("P505: pânico fixo 'não sobe para a central' é trava de site, mas o 'por quê' lidera pela garra (maior aging)", () => {
    const r = CASOS.P505();
    const fixo = r.vetores.find((v) => /PÂNICO FIXO/.test(v.label));
    expect(fixo.travaTipo).toBe("panicoFixoInoperante");
    expect(fixo.nivel).toBe(NIVEL.CRITICO);
    expect(r.geral.memoria.linhas.map((l) => l.classe).slice(0, 3)).toEqual(["Bloqueador", "Bloqueador", "Bloqueador"]);
    expect(r.geral.memoria.linhas[0].fato).toMatch(/Unidade 04 \(232 d\)/);
  });

  test("relatório AR imprime a memória em soma e o '= NÍVEL' com o vetor determinante", () => {
    const r = CASOS.P602();
    const html = gerarHTMLAnaliseRisco({ project: projeto("P602", "Golgi Mauá"), pacoteLabel: "Golgi", vetores: r.vetores, geral: r.geral,
      fontesUsadas: [{ titulo: "Teste Semanal", detalhe: "84%" }], ts: { ok: false }, ctmk: null, regional: { ok: false }, contextos: {} });
    expect(html).toContain('class="calc-soma"');
    expect(html).toContain("= CRÍTICO (vetor determinante: bloqueador, 2 vias: GARRAS");
    expect(html).toContain("2 vias de saída transponíveis → CRÍTICO");
    expect(html).toContain("Como se chega à classificação — memória de cálculo");
    expect(html).not.toMatch(/mais de cinco câmeras/);
  });
});

describe("regras unitárias v2", () => {
  test("perfil de barreiras cobre os 9 projetos", () => {
    ["P601", "P602", "P604", "P605", "P606", "P607", "P311A", "P311B", "P505"].forEach((pid) => expect(PERFIL_BARREIRAS[pid]).toBeDefined());
    expect(PERFIL_BARREIRAS.P607.naoAferido).toBe(true);
  });
  test("1 via = ELEVADO, 2 vias = CRÍTICO; parcial sem evidência não conta", () => {
    const uma = avaliarViasTransponiveis("P602", [P("garras", "06 - GARRAS (ECLUSAS)", "Saída 01", 10)]);
    expect(uma.n).toBe(1); expect(uma.nivel).toBe(NIVEL.ELEVADO);
    const duas = avaliarViasTransponiveis("P602", [P("garras", "06 - GARRAS (ECLUSAS)", "Saída 01", 10), P("garras", "06 - GARRAS (ECLUSAS)", "Entrada 02", 3)]);
    expect(duas.n).toBe(2); expect(duas.nivel).toBe(NIVEL.CRITICO);
    const parcial = avaliarViasTransponiveis("P602", [P("garras", "06 - GARRAS (ECLUSAS)", "Saída 01", 10, "PARCIAL", "lenta")]);
    expect(parcial.n).toBe(0); expect(parcial.semAgravante).toHaveLength(1);
  });
  test("cancela AS: quebrada continua bloqueando; haste erguida/retirada vira via transponível", () => {
    const quebrada = avaliarViasTransponiveis("P604", [P("c", "05 - CANCELAS AS (ALTA SEGURANÇA)", "Cancela 03", 18, "INOPERANTE", "Botoeira de funcionamento")]);
    expect(quebrada.n).toBe(0); expect(quebrada.semAgravante[0].motivo).toMatch(/continua bloqueando/);
    const erguida = avaliarViasTransponiveis("P604", [P("c", "05 - CANCELAS AS (ALTA SEGURANÇA)", "Cancela 03", 18, "INOPERANTE", "Haste erguida, pista liberada")]);
    expect(erguida.n).toBe(1);
  });
  test("botoeira do dilacerador não é barreira", () => {
    expect(avaliarViasTransponiveis("P311B", [P("b", "03 - BOTOEIRAS DO DILACERADOR", "Botoeira 01", 10)]).n).toBe(0);
  });
  test("CFTV graduado", () => {
    expect(classificarCFTVGraduado({ inop: 6, total: 140, piorDias: 4 }).nivel).toBe(NIVEL.MODERADO);
    expect(classificarCFTVGraduado({ inop: 6, total: 140, piorDias: 16 }).nivel).toBe(NIVEL.ELEVADO);
    expect(classificarCFTVGraduado({ inop: 8, total: 74, piorDias: 3 }).nivel).toBe(NIVEL.ELEVADO);   // ≥ 10 %
    expect(classificarCFTVGraduado({ inop: 6, total: 200, piorDias: 3, perimetraisAntigas: 2 }).nivel).toBe(NIVEL.ELEVADO);
    expect(classificarCFTVGraduado({ inop: 3, total: 100, piorDias: 300, nivelBase: NIVEL.BAIXO }).nivel).toBe(NIVEL.BAIXO);
  });
});

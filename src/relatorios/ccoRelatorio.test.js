import { acaoEquipamento, textoJornada, validarPeriodo, mascararCPF, tratarDisciplinar, turnoPelaHora, duracaoMin, correspondencia, montarRelatorioCCO, filtrarPeriodo } from "./ccoRelatorio";
const P = { id: "P601", name: "Golgi Cajamar" };
const AG = new Date("2026-10-05T10:00:00");
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

describe("3. CPF — proteção parcial", () => {
  test("mascara CPF formatado e CPF rotulado com 11 dígitos", () => {
    expect(mascararCPF("Técnico João – CPF: 933.707.925-91, entrada 13:55")).toEqual({ texto: "Técnico João – CPF: ***.***.***-91, entrada 13:55", mascarados: 1 });
    expect(mascararCPF("Thiago CPF 48705435838 saiu").texto).toBe("Thiago CPF ***.***.***-38 saiu");
    expect(mascararCPF("documento 123.456.789-09").mascarados).toBe(1);
  });
  test("não mexe em protocolo, telefone e contagens fora do padrão", () => {
    for (const t of ["Protocolo 20261004351592717", "Contato 11987654321", "(11) 98765-4321", "CPF 1234567890", "CPF 123456789012", "nº 2026090934179951"])
      expect(mascararCPF(t)).toEqual({ texto: t, mascarados: 0 });
  });
});

describe("4. Disciplinar — decisão do Marcio isolada", () => {
  const txt = "Equipe em ordem. Aplicada medida disciplinar ao vigilante. Houve suspensão de serviço da cancela.";
  test("interno e modo C mostram o original; B e pendente ocultam; A omite só a frase com a expressão", () => {
    expect(tratarDisciplinar(txt, { interno: true, modo: "pendente" }).texto).toBe(txt);
    expect(tratarDisciplinar(txt, { interno: false, modo: "C" }).texto).toBe(txt);
    expect(tratarDisciplinar(txt, { interno: false, modo: "B" }).oculto).toBe(true);
    expect(tratarDisciplinar(txt, { interno: false, modo: "pendente" }).oculto).toBe(true);
    const a = tratarDisciplinar(txt, { interno: false, modo: "A" });
    expect(a.omitidos).toBe(1); expect(a.texto).toContain("[trecho de uso interno omitido]");
    expect(a.texto).toContain("suspensão de serviço da cancela");   // palavra solta ambígua não é omitida
  });
});

describe("2. Turno pela configuração do projeto e duração", () => {
  test("faixas reais (P601 6h–18h; P606 +1h)", () => {
    expect(["05:59", "06:00", "17:59", "18:00"].map((h) => turnoPelaHora(h, "P601"))).toEqual(["noturno", "diurno", "diurno", "noturno"]);
    expect(["06:30", "07:00", "18:30", "19:00"].map((h) => turnoPelaHora(h, "P606"))).toEqual(["noturno", "diurno", "diurno", "noturno"]);
    expect(turnoPelaHora("", "P601")).toBeNull();
  });
  test("duração sem fabricar", () => {
    expect(duracaoMin("23:50", "00:10", "noturno")).toEqual({ min: 20, inconsistente: false });
    expect(duracaoMin("10:00", "09:50", "diurno")).toEqual({ min: null, inconsistente: true });
    expect(duracaoMin("10:00", "", "diurno")).toEqual({ min: null, inconsistente: false });
  });
});

const ACESSOS = [
  { id: "a1", data: "2026-09-29", horaEntrada: "09:10", nome: "Lucas Rodrigues", empresa: "FM Security" },
  { id: "a2", data: "2026-08-26", horaEntrada: "10:00", nome: "Alan e Valdivino", empresa: "Security" },
  { id: "a3", data: "2026-09-15", horaEntrada: "08:00", nome: "Fabio José", empresa: "FM Security (saída 09h25)" },
  { id: "a4", data: "2026-09-15", horaEntrada: "19:30", nome: "Visitante", empresa: "fm  security" },
  { id: "a5", data: "2026-09-20", horaEntrada: "08:00", nome: "Rascunho", empresa: "X", rascunho: true },
];
const MANUT = [
  { id: "m1", data: "2026-09-29", empresa: "FM Security", tecnico: "Lucas Rodrigues", sistema: "CFTV", status: "pendente", servico: "Troca de conversor. Técnico Lucas CPF: 933.707.925-91." },
  { id: "m2", data: "2026-09-24", empresa: "FM Security", tecnico: "João Dias", sistema: "Torniquete", status: "concluida", servico: "Configuração" },
  { id: "m3", data: "2026-09-15", empresa: "FM Security", tecnico: "Fábio José", sistema: "CFTV", status: "parcial", servico: "Zona 03 com sensibilidade alta", arquivado: false },
];

describe("1. Correspondência provável Acesso ↔ Manutenção", () => {
  test("fonte ausente ou vazia = não verificado (nunca 'ausente')", () => {
    expect(correspondencia(ACESSOS, null).verificavel).toBe(false);
    expect(correspondencia(ACESSOS, []).verificavel).toBe(false);
    const h = montarRelatorioCCO("manutencao", P, MANUT, { agora: AG, interno: true, outros: null }).html;
    expect(h).toContain("Acesso ↔ Manutenção: não verificado"); expect(h).toContain("consulta não concluída (fonte indisponível)");   // falha não some do relatório
    const h2 = montarRelatorioCCO("manutencao", P, MANUT, { agora: AG, interno: true, outros: [] }).html;
    expect(h2).toContain("Acesso ↔ Manutenção: não verificado");
  });
  test("casa por dia + nome do técnico (sem acento) e lista as faltas prováveis com critério e cobertura", () => {
    const c = correspondencia(ACESSOS.filter((a) => !a.rascunho), MANUT);
    expect(c.verificavel).toBe(true);
    expect(c.manutNaoLocalizada.map((m) => m.id)).toEqual(["m2"]);            // 24/09: dentro da faixa do Acesso, não localizado
    expect(c.acessoNaoLocalizado).toEqual([]);
    expect(c.acessoForaFaixa.map((a) => a.id)).toEqual(["a2"]);              // 26/08: fora da faixa da Manutenção → não verificado
    const h = montarRelatorioCCO("manutencao", P, MANUT, { agora: AG, interno: true, outros: ACESSOS }).html;
    expect(h).toContain("não é ausência operacional comprovada"); expect(h).toContain("registro(s) no período");
    expect(h).not.toMatch(/ausente/i);
  });
});

describe("revisão do Codex", () => {
  test("outra fonte só com registros fora do período = não verificado (sem falsas faltas)", () => {
    const c = correspondencia([{ data: "2026-07-01", nome: "X", empresa: "FM Security" }], MANUT, "2026-09-01", "2026-09-30");
    expect(c.verificavel).toBe(false); expect(c.manutNaoLocalizada).toEqual([]);
  });
  test("status desconhecido com tags é escapado", () => {
    const h = montarRelatorioCCO("manutencao", P, [{ data: "2026-09-01", empresa: "E", status: "<img src=x onerror=alert(1)>" }], { agora: AG }).html;
    expect(h).not.toContain("<img src=x"); expect(h).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });
  test("intervalo: homônimos com ids diferentes separados; sem id agregado por nome e declarado", () => {
    const iv = { cafe1: { saida: "09:00", retorno: "09:15" } };
    const INT = [{ data: "2026-10-01", turno: "diurno", colaboradores: [{ id: "c1", nome: "Ana", cargo: "Vig", intervalos: iv }, { id: "c2", nome: "Ana", cargo: "Vig", intervalos: iv }, { nome: "Bia", intervalos: iv }] }];
    const h = montarRelatorioCCO("intervalo", P, INT, { agora: AG, interno: true }).html;
    expect((h.match(/<b>Ana[^<]*<\/b>/g) || []).length).toBe(2);
    expect(h).toContain("agregado por nome (sem identificador)"); expect(h).toContain("Agregado por nome</b>");
  });
});

describe("lote consolidado da revisão (Codex)", () => {
  const SUP = (eqs, extra = {}) => [{ id: "s1", data: "2026-09-10", supervisor: "Israel", turno: "noturno", chegada: "19:42", saida: "20:10", resumo: "ok", equipamentos: eqs, ...extra }];
  test("equipamento 'aberto' = Em aberto (pendente) nas duas versões, com KPI e destaque; 'trocado' = resolvido", () => {
    for (const interno of [false, true]) {
      const h = montarRelatorioCCO("supervisao", P, SUP([{ acao: "aberto", catLabel: "Rádio TESTE" }, { acao: "trocado", catLabel: "Lanterna" }]), { agora: AG, interno }).html;
      expect(h).toContain("Em aberto (pendente)</span>: Rádio TESTE"); expect(h).not.toMatch(/Conferid/);
      expect(h).toContain("Trocado (resolvido)</span>: Lanterna");
      expect(h).toContain("<b>1</b> em aberto (pendente)"); expect(h).toContain("seguem em aberto após a visita");
    }
  });
  test("ação desconhecida: rótulo explícito, escapado, listado na conferência interna; não vira pendência nem resolvido", () => {
    expect(acaoEquipamento("xyz")).toEqual({ rotulo: "Ação não reconhecida: «xyz»", tipo: "desconhecida" });
    const h = montarRelatorioCCO("supervisao", P, SUP([{ acao: "<b>x</b>", catLabel: "Rádio" }]), { agora: AG, interno: true }).html;
    expect(h).not.toContain("<b>x</b>"); expect(h).toContain("Ação não reconhecida: «&lt;b&gt;x&lt;/b&gt;»"); expect(h).toContain("Ação de equipamento não reconhecida");
    expect(h).toContain("<b>0</b> em aberto (pendente)");
  });
  test("jornada da CCO confirmada pelo Marcio, com o deslocamento do P606", () => {
    expect(textoJornada("P606")).toBe("jornada da CCO: diurno 07h–19h, noturno 19h–07h");
    expect(montarRelatorioCCO("acesso", P, ACESSOS, { agora: AG }).html).toContain("Turnos pela jornada da CCO: diurno 06h–18h, noturno 18h–06h.");
  });
  test("situação arquivada visível na Supervisão e no anexo do Intervalo; agregados declarados", () => {
    expect(montarRelatorioCCO("supervisao", P, SUP([], { arquivado: true }), { agora: AG }).html).toContain('<div class="mk-mu">arquivado</div>');
    const INT = [{ data: "2026-10-01", turno: "diurno", arquivado: true, colaboradores: [{ id: "c1", nome: "Ana", intervalos: { cafe1: { saida: "09:00", retorno: "09:10" } } }] }];
    const h = montarRelatorioCCO("intervalo", P, INT, { agora: AG, comAnexo: true }).html;
    expect(h).toContain("1 arquivado(s) · ativos e arquivados somados"); expect(h).toMatch(/<td>09:00–09:10<\/td><td><td>|<td>09:00–09:10<\/td>(<td>—<\/td>)*<td><span class="mk-mu">arquivado<\/span><\/td>/);
  });
  test("fecho: assinatura nunca sozinha — conferência (interna) ou as últimas linhas da tabela vão junto", () => {
    const muitos = Array.from({ length: 12 }, (_, i) => ({ id: "x" + i, data: `2026-09-${String(10 + i).padStart(2, "0")}`, horaEntrada: "08:00", nome: "Pessoa " + i, empresa: "Empresa A" }));
    const cli = montarRelatorioCCO("acesso", P, muitos, { agora: AG }).html;
    const fecho = cli.slice(cli.indexOf('<div class="mk-fecho">'));
    expect(fecho).toContain("Pessoa 11"); expect(fecho).toContain("Pessoa 9"); expect(fecho).not.toContain("Pessoa 8");
    expect(fecho.indexOf("Pessoa 11")).toBeLessThan(fecho.indexOf('class="mk-fim"'));
    const int = montarRelatorioCCO("acesso", P, muitos, { agora: AG, interno: true }).html;
    const f2 = int.slice(int.indexOf('<div class="mk-fecho">'));
    expect(f2).toContain("Conferência do registro"); expect(f2.indexOf("Conferência do registro")).toBeLessThan(f2.indexOf('class="mk-fim"'));
    expect((cli.match(/Pessoa \d+</g) || []).length).toBe(12);   // nenhuma linha perdida ou duplicada
  });
  test("validação do período em execução", () => {
    expect(validarPeriodo("2026-09-10", "2026-09-01")).toBe("A data inicial é posterior à final.");
    expect(validarPeriodo("", "2026-09-01")).toBe("Informe as datas do período.");
    expect(validarPeriodo("2026-09-01", "2026-09-01")).toBeNull();
  });
});

describe("relatórios por tema", () => {
  test("Acesso: KPIs, turno pela hora, conferência (saída no campo empresa, grafias); rascunho fora", () => {
    const { html, registros } = montarRelatorioCCO("acesso", P, ACESSOS, { agora: AG, interno: true, outros: MANUT });
    expect(registros).toBe(4);
    expect(html).toContain("Saída digitada no campo Empresa"); expect(html).toContain("Grafias da mesma empresa");
    expect(html).toContain("entradas no noturno"); expect(html).not.toContain("Rascunho");
    const cli = montarRelatorioCCO("acesso", P, ACESSOS, { agora: AG }).html;
    expect(cli).not.toContain("Conferência do registro"); expect(cli).not.toMatch(EMOJI); expect(cli).toContain('counter(page) " de " counter(pages)');
  });
  test("Manutenção: em aberto em dias, CPF mascarado nas duas versões, aviso de proteção parcial só na interna", () => {
    const i = montarRelatorioCCO("manutencao", P, MANUT, { agora: AG, interno: true });
    const c = montarRelatorioCCO("manutencao", P, MANUT, { agora: AG });
    for (const h of [i.html, c.html]) { expect(h).not.toContain("933.707.925-91"); expect(h).toContain("***.***.***-91"); }
    expect(i.html).toContain("proteção parcial"); expect(c.html).not.toContain("proteção parcial");
    expect(i.html).toContain("Concluídas ainda ativas"); expect(c.html).toContain("20 d");   // 15/09 → 05/10
  });
  test("Supervisão: padrão C (decisão do Marcio) mostra a observação na versão cliente; modo pendente oculta e declara", () => {
    const SUP = [{ id: "s1", data: "2026-09-10", supervisor: "Israel", turno: "diurno", chegada: "19:42", saida: "20:10", resumo: "Ronda ok. Aplicada medida disciplinar ao vigilante X.", equipamentos: [{ acao: "trocado", catLabel: "Rádio HT" }] }];
    expect(montarRelatorioCCO("supervisao", P, SUP, { agora: AG }).html).toContain("Aplicada medida disciplinar ao vigilante X.");   // padrão = C
    const cli = montarRelatorioCCO("supervisao", P, SUP, { agora: AG, modoDisciplinar: "pendente" }).html;
    expect(cli).not.toContain("medida disciplinar"); expect(cli).toContain("decisão sobre conteúdo de uso interno pendente");
    const int = montarRelatorioCCO("supervisao", P, SUP, { agora: AG, interno: true }).html;
    expect(int).toContain("medida disciplinar"); expect(int).toContain("confirmada pelo gerencial em 05/10/2026"); expect(int).toContain("Tratamento na versão cliente: exibido");
    const a = montarRelatorioCCO("supervisao", P, SUP, { agora: AG, modoDisciplinar: "A" }).html;
    expect(a).toContain("Ronda ok."); expect(a).toContain("1 trecho(s) de uso interno omitido(s)");
  });
  test("Intervalo: resumo por colaborador, duplicados, turno × hora, anexo opcional", () => {
    const iv = (s, r) => ({ saida: s, retorno: r });
    const INT = [
      { id: "i1", data: "2026-10-02", turno: "noturno", colaboradores: [{ nome: "João Vicente", intervalos: { cafe1: iv("21:00", "21:15"), refeicao: iv("00:30", "01:30") } }] },
      { id: "i2", data: "2026-10-02", turno: "diurno", colaboradores: [{ nome: "João Vicente", intervalos: { cafe1: iv("21:00", "21:15"), refeicao: iv("00:30", "01:30") } }] },
      { id: "i3", data: "2026-10-03", turno: "diurno", colaboradores: [{ nome: "Sueli", intervalos: { refeicao: iv("11:09", "12:48") } }] },
    ];
    const i = montarRelatorioCCO("intervalo", P, INT, { agora: AG, interno: true, comAnexo: true }).html;
    expect(i).toContain("Registros duplicados"); expect(i).toContain("inclusive lançados em turnos diferentes");
    expect(i).toContain("jornada da CCO: diurno 06h–18h, noturno 18h–06h"); expect(i).toContain("Anexo — registros detalhados");
    expect(i).toContain("99 min");   // refeição 11:09→12:48, como dado
    expect(montarRelatorioCCO("intervalo", P, INT, { agora: AG }).html).not.toContain("Anexo — registros detalhados");
  });
  test("agrupamento ignora caixa, pontuação, parênteses e 'saída' digitada; rótulo = grafia mais usada", () => {
    const h = montarRelatorioCCO("manutencao", P, [{ data: "2026-09-01", empresa: "FM Security", status: "concluida" }, { data: "2026-09-02", empresa: "FM Security.", status: "concluida" },
      { data: "2026-09-03", empresa: "fm security", status: "concluida" }], { agora: AG, interno: true }).html;
    expect(h).toMatch(/<span>FM Security<\/span><span class="mk-tr"><span style="width:100.0%"><\/span><\/span><span class="mk-v">3<\/span>/);
    expect(h).toContain("Grafias da mesma empresa");
  });
  test("período inclusivo e regressão: sem período lista os mesmos registros (não rascunho) que o gerador anterior", () => {
    expect(filtrarPeriodo(ACESSOS, "2026-09-15", "2026-09-29").map((r) => r.id)).toEqual(["a3", "a4", "a1"]);
    expect(montarRelatorioCCO("acesso", P, ACESSOS, { agora: AG }).registros).toBe(ACESSOS.filter((r) => !r.rascunho).length);
  });
});

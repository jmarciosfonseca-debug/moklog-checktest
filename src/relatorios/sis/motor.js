// SIS⁺ Moked — motor puro (sem banco/relógio/React). Implementa o PROMPT_SIS_MOKED: camadas P/A/I/M/H,
// pesos 1–5, atendimento 1 / 0,5 / 0, fases I/90/E e teto. Nenhum valor derivado é digitado: tudo sai de `avaliar`.
// req: [codigo, nome, peso, fase, teto, o que fazer, origem('app' = medido pelo app | 'diag' = diagnóstico/validação)]
const CAMADAS = [
  { cod: "P", nome: "Perímetro", cat: "RT", reqs: [
    ["P1", "Barreira física contínua, sem trechos no nível da rua", 4, "E", 1, "Fechar os trechos baixos com muro ou gradil na altura padrão.", "diag"],
    ["P2", "Detecção de intrusão no perímetro", 5, "E", .5, "Especificar e instalar detecção por zona (cerca, laser ou análise de vídeo) com alarme na CCO.", "app"],
    ["P3", "Proteção elevada onde há apoio para transpor", 3, "90", 1, "Instalar concertina ou haste inclinada nos pontos com apoio.", "diag"],
    ["P4", "Barreiras naturais: taludes, perímetro duplo", 2, "E", .5, "Mapear os taludes e avaliar perímetro duplo nos trechos expostos.", "diag"],
    ["P5", "Faixa do perímetro livre de vegetação", 3, "I", 1, "Roçar e manter faixa livre junto ao gradil. Não exige obra.", "diag"],
    ["P6", "Iluminação perimetral eficaz", 3, "90", .5, "Refazer o projeto luminotécnico do perímetro e trocar os refletores apagados.", "app"],
    ["P7", "Câmeras ou speed domes com visão livre do perímetro", 3, "90", .5, "Reposicionar câmeras e liberar o campo de visão.", "diag"],
    ["P8", "Gradil e cercamento em bom estado", 2, "I", 1, "Reparar os trechos danificados.", "diag"] ] },
  { cod: "A", nome: "Acessos", cat: "RT", reqs: [
    ["A1", "Facial ou biometria no acesso de pedestres", 4, "E", 1, "Instalar leitor facial ou biométrico em todos os acessos de pedestres.", "diag"],
    ["A2", "Leitura de placa (LPR) e dupla checagem", 3, "90", 1, "Ativar a leitura de placa com conferência em dupla.", "diag"],
    ["A3", "Pré-cadastro com foto de quem dirige", 3, "I", 1, "Exigir pré-cadastro com foto do condutor antes da chegada.", "diag"],
    ["A4", "Anti-passback e registro consistente de entrada e saída", 3, "90", 1, "Ativar o anti-passback e corrigir os registros sem saída.", "diag"],
    ["A5", "Validade de visitante de até 24 h", 2, "I", 1, "Limitar a validade do cadastro de visitante a 24 h.", "diag"],
    ["A6", "Software de acesso adequado à LGPD", 2, "90", .5, "Avaliar o software de acesso e a política de dados.", "diag"],
    ["A7", "Bloqueio físico veicular: dilacerador e bollards", 5, "90", 1, "Consertar ou instalar o bloqueio veicular e testar toda semana.", "app"],
    ["A8", "Proteção do pedestre: redutores, balizadores, semáforo", 2, "90", 1, "Completar a sinalização e os redutores nos pontos de travessia.", "diag"],
    ["A9", "Catracas e leitores operando sem falha", 2, "I", 1, "Corrigir os leitores e catracas com falha.", "app"],
    ["A10", "Fluidez: entrada e saída sem fila", 2, "90", 1, "Ajustar os horários de pico e as faixas de atendimento.", "diag"],
    ["A11", "Cancelas e portões automáticos operando", 3, "I", 1, "Consertar as cancelas e portões e abrir chamado de manutenção.", "app"] ] },
  { cod: "I", nome: "Áreas internas", cat: "RA", reqs: [
    ["I1", "Iluminação interna sem pontos escuros", 4, "90", .5, "Refazer o projeto luminotécnico e trocar as luminárias apagadas.", "app"],
    ["I2", "Áreas técnicas e portões internos fechados", 3, "I", 1, "Trancar e controlar a chave das áreas técnicas.", "diag"],
    ["I3", "Combate a incêndio completo", 4, "90", 1, "Regularizar hidrantes, extintores e alarme, com teste registrado.", "app"],
    ["I4", "Pátio livre de entulho e material de obra", 2, "I", 1, "Retirar o entulho e o material de obra do pátio.", "diag"],
    ["I5", "Armazenamento externo controlado", 2, "I", 1, "Definir áreas de armazenamento e controlar o acesso.", "diag"],
    ["I6", "Sinalização de vagas e pedestres", 2, "90", 1, "Refazer a sinalização de vagas e travessias.", "diag"],
    ["I7", "Drenagem e calhas em bom estado", 1, "90", 1, "Limpar e reparar a drenagem e as calhas.", "diag"],
    ["I8", "Acessos laterais dos galpões controlados", 3, "90", .5, "Mapear os acessos laterais e controlar cada um.", "diag"],
    ["I9", "Motos e bicicletas em área própria", 1, "90", 1, "Criar área própria para motos e bicicletas.", "diag"],
    ["I10", "Infraestrutura de apoio operando: gerador, nobreak, interfones", 2, "I", 1, "Consertar o gerador, o nobreak ou os interfones com falha.", "app"] ] },
  { cod: "M", nome: "Monitoramento", cat: "RT", reqs: [
    ["M1", "Câmeras operando", 3, "I", 1, "Restabelecer as câmeras inoperantes e cobrar o prazo do mantenedor.", "app"],
    ["M2", "Cobertura sem pontos cegos, inclusive na portaria", 3, "E", .5, "Mapear os pontos cegos e incluir câmeras no projeto.", "diag"],
    ["M3", "Imagem noturna eficaz", 4, "90", .5, "Especificar câmeras e iluminação para imagem noturna útil.", "app"],
    ["M4", "CCO dedicado com operador", 5, "E", 1, "Dedicar um operador de CCO exclusivo ao empreendimento.", "diag"],
    ["M5", "Sala do CCO protegida", 3, "90", 1, "Restringir o acesso e proteger fisicamente a sala do CCO.", "diag"],
    ["M6", "Speed domes com joystick e rondas programadas", 3, "90", 1, "Programar as rondas virtuais e restabelecer o joystick.", "app"],
    ["M7", "Software de vídeo profissional e integrado", 2, "E", .5, "Especificar o software de vídeo e os servidores.", "diag"],
    ["M8", "Gravação de 30 dias e extração de imagens", 3, "I", 1, "Ajustar o armazenamento para 30 dias e testar a extração.", "app"],
    ["M9", "Alarme perimetral acionando câmeras", 3, "E", .5, "Integrar o alarme perimetral às câmeras.", "diag"],
    ["M10", "Cabeamento protegido", 2, "90", 1, "Proteger e organizar o cabeamento exposto.", "diag"],
    ["M11", "Energia de backup do CFTV", 2, "90", 1, "Garantir nobreak e autonomia mínima para o CFTV.", "app"],
    ["M12", "Botão de pânico no CCO", 3, "I", 1, "Consertar o botão de pânico da CCO e testar toda semana.", "app"],
    ["M13", "Botões de pânico operando", 2, "I", 1, "Consertar os botões de pânico inoperantes.", "app"] ] },
  { cod: "H", nome: "Pessoas e procedimentos", cat: "RH", reqs: [
    ["H1", "Controle de acesso presente 24 h", 3, "I", 1, "Cobrir os turnos descobertos no controle de acesso.", "diag"],
    ["H2", "Vigilância durante o dia", 4, "90", 1, "Incluir vigilância patrimonial diurna.", "diag"],
    ["H3", "Vigilância noturna com reforço e pronta resposta", 4, "E", 1, "Incluir reforço noturno com pronta resposta.", "diag"],
    ["H4", "Pronta resposta armada em todos os turnos", 4, "E", 1, "Contratar pronta resposta armada para todos os turnos.", "diag"],
    ["H5", "Ronda durante o dia", 3, "I", 1, "Programar rondas diurnas e registrar nos checkpoints.", "app"],
    ["H6", "Ronda noturna verificada, com checkpoints", 3, "I", 1, "Programar rondas noturnas verificadas por checkpoint.", "app"],
    ["H7", "Procedimento de pânico: senha, contrassenha e validação", 5, "I", 1, "Implantar senha, contrassenha e validação, e treinar todos os turnos.", "diag"],
    ["H8", "MNP e POPs", 4, "90", 1, "Revisar e publicar o MNP e os POPs, e treinar a equipe.", "diag"],
    ["H9", "Rádios HT e lanternas", 2, "I", 1, "Repor os rádios e lanternas que faltam.", "diag"],
    ["H10", "Equipe estável", 2, "90", 1, "Reduzir a rotatividade e cobrir as vagas abertas.", "app"],
    ["H11", "Remuneração que retém a equipe", 1, "E", 1, "Revisar o piso e os benefícios com a empresa de vigilância.", "diag"],
    ["H12", "Controle de chaves", 2, "I", 1, "Implantar livro ou armário de chaves com registro.", "diag"],
    ["H13", "Central de monitoramento com tempo de resposta em contrato", 3, "90", 1, "Incluir o tempo de resposta no contrato da central.", "diag"],
    ["H14", "Registro de visitantes e prestadores", 2, "I", 1, "Registrar todos os visitantes e prestadores na entrada.", "app"] ] },
];
const FASES = { I: "Imediato", "90": "Até 90 dias", E: "Estruturante" };
const REGUAS = {
  cliente: { nome: "Versão do cliente", bom: 85, meio: 70, rotulos: ["Bom", "Atenção", "Crítico"], cores: ["#22c55e", "#f59e0b", "#ef4444"] },
  moked: { nome: "Versão Moked", bom: 92, meio: 80, rotulos: ["Bom", "Alerta", "Crítico"], cores: ["#22c55e", "#f97316", "#ef4444"] },
};
const faixa = (v, r) => { const i = v >= r.bom ? 0 : v >= r.meio ? 1 : 2; return { rotulo: r.rotulos[i], cor: r.cores[i], i }; };
const ROT_STATUS = { 1: "Atende", .5: "Parcial", 0: "Não atende" };

// dados: { codigo: { s: 1|.5|0, ev: "evidência", conf: true se 'a confirmar' } }
// padrao: o que vale para o código ausente em `dados`. "conf" (padrão do app) = a confirmar (0,5); "atende" = 1.
function lista(dados, { padrao = "conf" } = {}) {
  const out = [];
  for (const c of CAMADAS) for (const [cod, nome, peso, fase, teto, acao, origem] of c.reqs) {
    const d = (dados && dados[cod]) || null;
    const conf = d ? !!d.conf : padrao === "conf";
    const s = conf ? 0.5 : (d?.s ?? 1);                // sem evidência = "a confirmar" = parcial até validar
    out.push({ cod, camada: c.cod, nome, peso, fase: s >= 1 ? "—" : fase, teto: s >= 1 ? 1 : teto, acao, origem, s, conf, medido: !conf, ev: (d && d.ev) || "", regra: (d && d.regra) || "" });
  }
  return out;
}
const pontos = (reqs) => reqs.reduce((a, r) => a + r.peso * r.s, 0);
const maximo = (reqs) => reqs.reduce((a, r) => a + r.peso, 0);
const pc = (reqs) => (maximo(reqs) ? Math.round((pontos(reqs) / maximo(reqs)) * 100) : 0);
function avaliar(dados, opcoes) {
  const reqs = lista(dados, opcoes);
  const camadas = CAMADAS.map((c) => { const rs = reqs.filter((r) => r.camada === c.cod); return { cod: c.cod, nome: c.nome, cat: c.cat, pontos: pontos(rs), maximo: maximo(rs), valor: pc(rs), reqs: rs }; });
  const total = maximo(reqs);
  reqs.forEach((r) => { r.impacto = Math.round((r.peso * (Math.max(r.s, r.teto) - r.s) / total) * 1000) / 10; });
  const geral = pc(reqs);
  // plano: cada fase leva o requisito ao teto, acumulando
  const ate = (fases) => pc(reqs.map((r) => ({ ...r, s: fases.includes(r.fase) ? Math.max(r.s, r.teto) : r.s })));
  const plano = { hoje: geral, imediato: ate(["I"]), "90_dias": ate(["I", "90"]), estruturante: ate(["I", "90", "E"]) };
  const final = reqs.map((r) => ({ ...r, s: r.fase !== "—" ? Math.max(r.s, r.teto) : r.s }));
  const porQueNao100 = final.filter((r) => r.s < 1);
  const cen = (cods) => pc(reqs.map((r) => ({ ...r, s: r.camada === "H" && cods.includes(r.cod) ? Math.max(r.s, r.teto) : r.s })));
  const H = reqs.filter((r) => r.camada === "H");
  const cenarios = { atual: pc(H), aceitavel: pc(H.map((r) => ({ ...r, s: ["H1", "H2", "H5", "H6", "H7"].includes(r.cod) ? Math.max(r.s, r.teto) : r.s }))), recomendado: pc(H.map((r) => ({ ...r, s: Math.max(r.s, r.teto) }))) };
  return { reqs, camadas, geral, pontos: pontos(reqs), maximo: total, plano, meta: plano.estruturante, porQueNao100, cenarios, aConfirmar: reqs.filter((r) => r.conf) };
}
export { CAMADAS, FASES, REGUAS, ROT_STATUS, faixa, avaliar, lista };

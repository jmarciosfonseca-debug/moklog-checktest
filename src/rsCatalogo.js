// ─────────────────────────────────────────────────────────────
// rsCatalogo.js — Catálogo do módulo RS (Registro Situacional)
// MokLog CheckTest
//
// FONTE ÚNICA da taxonomia de ocorrências. Puro dado, sem lógica —
// pensado para o Marcio editar textos livremente sem tocar em componentes.
//
// Estrutura:
//   NATUREZAS = [ { key, label, icon, cor, subtipos:[ SUBTIPO ] } ]
//   SUBTIPO   = {
//     key,                 // ID estável — NUNCA muda (usado no histórico Firestore)
//     label,               // rótulo exibido (pode mudar sem quebrar dados)
//     modelo,              // trecho-modelo do detalhamento (auto-gerado, editável)
//     obrigatorios: [],    // campos que o líder DEVE preencher p/ este subtipo
//     fotos,               // dica do que fotografar (ajuda Nível 2)
//     ajuda,               // texto de orientação contextual (ajuda Nível 2)
//   }
//
// ── Placeholders do `modelo` (o app substitui pelos valores do form) ──
//   {hora}         horário de início da ocorrência
//   {nome}         nome do envolvido (motorista/pessoa)
//   {doc}          documento do envolvido (mascarado conforme acesso)
//   {placaCavalo}  placa do cavalo
//   {placaCarreta} placa da carreta
//   {transportadora}
//   {inquilino}
//   {local}        doca / zona / ponto do fato
//   {quemAvisou}
//   {medidas}      medidas imediatamente tomadas
//   {horaFim}      horário de término / normalização
// Placeholder sem valor no registro é removido pelo app (não deixa "{x}" cru).
//
// ── Campos válidos em `obrigatorios` (o form valida antes de salvar) ──
//   "local","envolvidoNome","placaCavalo","transportadora","inquilino",
//   "quemAvisou","quemAvisado","detalhamento","medidas","horaInicio",
//   "horaFim","fotoLocal","fotoCftv"
//
// Severidade SUGERIDA por subtipo é só um default do seletor; o líder
// sempre pode alterar. Níveis: "info" | "atencao" | "critico".
// ─────────────────────────────────────────────────────────────

export const SEVERIDADES = [
  { key: "info",    label: "Informativo", cor: "#64748b" },
  { key: "atencao", label: "Atenção",     cor: "#f59e0b" },
  { key: "critico", label: "Crítico",     cor: "#ef4444" },
];

// Flags transversais (aparecem em todo registro; abrem blocos condicionais)
export const FLAGS = [
  { key: "vitima",      label: "Houve vítima / dano pessoal?" },
  { key: "danoMaterial",label: "Houve dano material / estrutural?" },
  { key: "terceiro",    label: "Envolveu terceiro identificável?" },
  { key: "acionamento", label: "Acionou apoio externo (PM / bombeiros / SAMU / manutenção)?" },
];

// Status do ciclo de vida de um RS. PENDENTE = registro aberto/em acompanhamento;
// ARQUIVADO = encerrado (permanece no histórico e nos PDFs). Consumido pelo
// rsPdf.js (cor do selo) e pelo Ocorrencias.jsx (filtros e ação de arquivar).
export const RS_STATUS = {
  PENDENTE: "pendente",
  ARQUIVADO: "arquivado",
};

export const NATUREZAS = [
  // ───────────────────────────────────────────────────────────
  // 1. VEÍCULO / TRÁFEGO
  // ───────────────────────────────────────────────────────────
  {
    key: "VEICULO",
    label: "Veículo / Tráfego",
    icon: "🚚",
    cor: "#185fa5",
    subtipos: [
      {
        key: "VEIC_COLISAO_ESTRUTURA",
        label: "Colisão contra estrutura (cancela, totem, meio-fio, placa, portão)",
        sevPadrao: "atencao",
        modelo: "Informo que, às {hora}, o motorista {nome}, conduzindo o veículo de placa {placaCavalo}/{placaCarreta} da transportadora {transportadora} (inquilino {inquilino}), ao manobrar em {local}, colidiu contra a estrutura, ocasionando danos. {medidas} Situação normalizada às {horaFim}.",
        obrigatorios: ["local", "detalhamento", "medidas", "horaInicio", "fotoLocal"],
        fotos: "Fotografe o dano de perto, uma panorâmica do ponto, a placa do cavalo e, se possível, a imagem do CFTV do momento da manobra.",
        ajuda: "Descreva a manobra que causou a colisão e o que exatamente foi avariado (quantidade de meios-fios, placa, cone). Identifique a transportadora e o inquilino responsável — isso alimenta a cobrança e o histórico de reincidência.",
      },
      {
        key: "VEIC_COLISAO_VEICULOS",
        label: "Colisão entre veículos",
        sevPadrao: "atencao",
        modelo: "Informo que, às {hora}, em {local}, houve colisão entre veículos. Um dos condutores, {nome} (placa {placaCavalo}, transportadora {transportadora}), esteve envolvido. {medidas} Situação normalizada às {horaFim}.",
        obrigatorios: ["local", "detalhamento", "medidas", "horaInicio", "fotoLocal"],
        fotos: "Fotografe os dois veículos, as placas de ambos, os pontos de contato/dano e a posição final no pátio.",
        ajuda: "Registre os dados dos dois condutores e veículos. Deixe claro se houve vítima (marque a flag) e se algum veículo ficou impossibilitado de circular.",
      },
      {
        key: "VEIC_VELOCIDADE",
        label: "Excesso de velocidade / direção perigosa",
        sevPadrao: "atencao",
        modelo: "Informo que, às {hora}, o condutor {nome} (placa {placaCavalo}, transportadora {transportadora}, inquilino {inquilino}) foi flagrado em {local} praticando direção perigosa / excesso de velocidade nas vias internas. {medidas}",
        obrigatorios: ["local", "detalhamento", "placaCavalo", "horaInicio"],
        fotos: "Se houver, anexe a imagem do CFTV que evidencia a conduta e uma foto da placa do veículo.",
        ajuda: "Aponte o trecho/via onde ocorreu e o risco gerado (pedestres, empilhadeiras, área de docas). Identifique placa e transportadora para notificação ao inquilino.",
      },
      {
        key: "VEIC_TOMBAMENTO",
        label: "Tombamento / capotamento",
        sevPadrao: "critico",
        modelo: "Informo que, às {hora}, o veículo de placa {placaCavalo}/{placaCarreta} (transportadora {transportadora}) tombou/capotou em {local}. {medidas} Situação acompanhada até {horaFim}.",
        obrigatorios: ["local", "detalhamento", "medidas", "horaInicio", "fotoLocal"],
        fotos: "Panorâmica do veículo tombado, condição da carga, danos à via/estrutura e sinalização de isolamento montada.",
        ajuda: "Prioridade é segurança: confirme se há vítima (flag) e se acionou apoio externo (flag). Descreva o isolamento feito e o estado da carga.",
      },
      {
        key: "VEIC_ATROPELAMENTO",
        label: "Atropelamento / quase-atropelamento",
        sevPadrao: "critico",
        modelo: "Informo que, às {hora}, em {local}, ocorreu atropelamento/quase-atropelamento envolvendo o veículo de placa {placaCavalo} (transportadora {transportadora}). {medidas}",
        obrigatorios: ["local", "detalhamento", "medidas", "horaInicio"],
        fotos: "Local do fato, posição do veículo e do pedestre, sinalização existente. Preserve a imagem de CFTV.",
        ajuda: "Se houve vítima, marque a flag e registre o acionamento de socorro (SAMU/bombeiros) com horários. Este registro tende a ter desdobramento — descreva os fatos com precisão.",
      },
      {
        key: "VEIC_CONTENCAO",
        label: "Avaria em dispositivo de contenção (garras de tigre, eclusa, bollard)",
        sevPadrao: "atencao",
        modelo: "Informo que, às {hora}, o veículo de placa {placaCavalo} (transportadora {transportadora}) causou avaria no dispositivo de contenção em {local}. {medidas} Situação normalizada às {horaFim}.",
        obrigatorios: ["local", "detalhamento", "medidas", "horaInicio", "fotoLocal"],
        fotos: "Dispositivo avariado (dentes das garras de tigre, motor, eclusa/bollard), placa do veículo e o CFTV da passagem.",
        ajuda: "Especifique qual dispositivo e o tipo de dano (dente travado, motor queimado, passagem na contramão). Informe se o dispositivo ficou inoperante — isso é ponto crítico de segurança.",
      },
      {
        key: "VEIC_OBSTRUCAO",
        label: "Veículo enguiçado / retido obstruindo via",
        sevPadrao: "atencao",
        modelo: "Informo que, às {hora}, o veículo de placa {placaCavalo} (transportadora {transportadora}) ficou retido/enguiçado em {local}, obstruindo a via/cancela. {medidas} Fluxo normalizado às {horaFim}.",
        obrigatorios: ["local", "detalhamento", "horaInicio"],
        fotos: "Posição do veículo obstruindo, extensão do congestionamento gerado e a cancela/via afetada.",
        ajuda: "Descreva o impacto no fluxo (fila de caminhões, acesso bloqueado) e a solução aplicada (remoção, guincho). Registre horário de início e de normalização.",
      },
      {
        key: "VEIC_PERNOITE",
        label: "Pernoite / estacionamento irregular",
        sevPadrao: "info",
        modelo: "Informo que, às {hora}, foi constatado pernoite/estacionamento irregular do veículo de placa {placaCavalo} (transportadora {transportadora}) em {local}. {medidas}",
        obrigatorios: ["local", "placaCavalo", "horaInicio"],
        fotos: "Veículo estacionado fora de vaga/bolsão e uma foto que situe o local.",
        ajuda: "Registre a placa e a transportadora. Se houve orientação ao motorista e ele foi realocado, descreva em medidas tomadas.",
      },
      {
        key: "VEIC_QUEDA_CARGA",
        label: "Queda de carga durante manobra / movimentação",
        sevPadrao: "atencao",
        modelo: "Informo que, às {hora}, houve queda de carga durante manobra/movimentação em {local}, envolvendo o veículo de placa {placaCavalo} (transportadora {transportadora}). {medidas} Situação normalizada às {horaFim}.",
        obrigatorios: ["local", "detalhamento", "medidas", "horaInicio", "fotoLocal"],
        fotos: "Carga caída, dano ao piso/estrutura, e o equipamento envolvido (empilhadeira, veículo).",
        ajuda: "Descreva o que caiu e se houve dano material (flag) ou risco a pessoas (flag). Informe se a área foi isolada.",
      },
      {
        key: "VEIC_OUTRO",
        label: "Outro (descrever)",
        sevPadrao: "info",
        modelo: "Informo que, às {hora}, em {local}, ocorreu a seguinte situação envolvendo veículo/tráfego: ",
        obrigatorios: ["local", "detalhamento", "horaInicio"],
        fotos: "Fotografe o que for relevante para evidenciar a ocorrência.",
        ajuda: "Use quando nenhum subtipo se encaixa. Descreva com clareza — situações recorrentes aqui podem virar um subtipo próprio no futuro.",
      },
    ],
  },

  // ───────────────────────────────────────────────────────────
  // 2. PESSOA (conflito humano + crime/dano patrimonial por pessoa)
  // ───────────────────────────────────────────────────────────
  {
    key: "PESSOA",
    label: "Pessoa",
    icon: "👤",
    cor: "#993556",
    subtipos: [
      {
        key: "PES_BRIGA",
        label: "Briga / agressão física",
        sevPadrao: "critico",
        modelo: "Informo que, às {hora}, em {local}, houve briga/agressão física entre indivíduos. {medidas} Situação controlada às {horaFim}.",
        obrigatorios: ["local", "detalhamento", "medidas", "horaInicio"],
        fotos: "Local do fato (sem expor rostos de vítimas desnecessariamente) e imagem de CFTV. Evite fotografar ferimentos sem necessidade.",
        ajuda: "Descreva quem se envolveu e o que motivou. Se houve vítima, marque a flag e registre acionamento de socorro/PM com horários. Cuidado com dados sensíveis das pessoas envolvidas.",
      },
      {
        key: "PES_AMEACA",
        label: "Ameaça / desacato / desobediência a agente",
        sevPadrao: "atencao",
        modelo: "Informo que, às {hora}, em {local}, o indivíduo {nome} proferiu ameaça / praticou desacato ao agente de segurança. {medidas}",
        obrigatorios: ["local", "detalhamento", "horaInicio"],
        fotos: "Imagem de CFTV do momento, se disponível. Registre o contexto do local.",
        ajuda: "Transcreva o que foi dito/feito de forma objetiva. Identifique o agente envolvido e testemunhas. Se houve encaminhamento à PM, registre.",
      },
      {
        key: "PES_ASSALTO",
        label: "Assalto / roubo (com violência ou grave ameaça)",
        sevPadrao: "critico",
        modelo: "Informo que, às {hora}, em {local}, ocorreu assalto/roubo com violência ou grave ameaça. {medidas} Ocorrência acompanhada até {horaFim}.",
        obrigatorios: ["local", "detalhamento", "medidas", "horaInicio"],
        fotos: "Local, pontos de entrada/fuga e imagem de CFTV. Preserve as gravações — podem ser requisitadas pela polícia.",
        ajuda: "Descreva o modo de ação, o que foi levado e se houve vítima (flag). Registre acionamento e chegada da PM (flag + horários). Marque sigilo elevado se necessário.",
      },
      {
        key: "PES_FURTO",
        label: "Furto consumado (carga, cobre, bicicleta, pertence, componente)",
        sevPadrao: "atencao",
        modelo: "Informo que, às {hora}, foi constatado furto em {local}. {medidas} Registro concluído às {horaFim}.",
        obrigatorios: ["local", "detalhamento", "medidas", "horaInicio", "fotoLocal"],
        fotos: "Local violado, objeto/veículo alvo, sinais de arrombamento e imagem de CFTV do autor, se houver.",
        ajuda: "Especifique o que foi furtado e o valor/impacto estimado. Se identificou autor pelo CFTV, descreva. Marque dano material (flag).",
      },
      {
        key: "PES_TENTATIVA_FURTO",
        label: "Tentativa de furto / intrusão perimetral",
        sevPadrao: "atencao",
        modelo: "Informo que, às {hora}, houve tentativa de furto / intrusão perimetral em {local}. {medidas} Situação normalizada às {horaFim}.",
        obrigatorios: ["local", "detalhamento", "medidas", "horaInicio"],
        fotos: "Ponto de tentativa de intrusão (tela cortada, alambrado), e imagem de CFTV do indivíduo.",
        ajuda: "Descreva como foi percebida (ronda, CFTV, alarme) e a ação da equipe. Indique o ponto do perímetro — reincidência no mesmo ponto indica vulnerabilidade a corrigir.",
      },
      {
        key: "PES_VANDALISMO",
        label: "Pichação / vandalismo / dano deliberado ao patrimônio",
        sevPadrao: "atencao",
        modelo: "Informo que, às {hora}, foi constatada pichação/vandalismo/dano deliberado ao patrimônio em {local}. {medidas}",
        obrigatorios: ["local", "detalhamento", "horaInicio", "fotoLocal"],
        fotos: "Dano/pichação de perto e panorâmica situando o local. CFTV do autor, se houver.",
        ajuda: "Descreva o que foi danificado e a extensão. Marque dano material (flag). Se identificou autor, registre com cautela quanto a dados pessoais.",
      },
      {
        key: "PES_INTRUSAO_PESSOA",
        label: "Invasão / pessoa não autorizada no perímetro",
        sevPadrao: "atencao",
        modelo: "Informo que, às {hora}, foi identificada pessoa não autorizada / invasão em {local}. {medidas} Situação resolvida às {horaFim}.",
        obrigatorios: ["local", "detalhamento", "medidas", "horaInicio"],
        fotos: "Local de acesso indevido e imagem de CFTV do indivíduo, quando disponível.",
        ajuda: "Descreva como a pessoa entrou e a abordagem feita. Se pessoa em situação de rua tentando pernoitar, registre o encaminhamento dado.",
      },
      {
        key: "PES_MAL_SUBITO",
        label: "Mal súbito / emergência médica",
        sevPadrao: "critico",
        modelo: "Informo que, às {hora}, em {local}, uma pessoa apresentou mal súbito / necessitou de atendimento médico. {medidas} Situação acompanhada até {horaFim}.",
        obrigatorios: ["local", "detalhamento", "medidas", "horaInicio"],
        fotos: "Evite fotografar a pessoa. Registre apenas o local, se necessário para contexto.",
        ajuda: "Prioridade é o socorro. Registre horário do acionamento e chegada do SAMU/resgate (flag acionamento). Preserve a privacidade e os dados de saúde da pessoa (dado sensível).",
      },
      {
        key: "PES_OUTRO",
        label: "Outro (descrever)",
        sevPadrao: "info",
        modelo: "Informo que, às {hora}, em {local}, ocorreu a seguinte situação envolvendo pessoa(s): ",
        obrigatorios: ["local", "detalhamento", "horaInicio"],
        fotos: "Fotografe o que for relevante, preservando a privacidade das pessoas.",
        ajuda: "Use quando nenhum subtipo se encaixa. Descreva com objetividade e atenção a dados sensíveis.",
      },
    ],
  },

  // ───────────────────────────────────────────────────────────
  // 3. INQUILINO / ACESSO & CONDUTA
  // ───────────────────────────────────────────────────────────
  {
    key: "INQUILINO",
    label: "Inquilino / Acesso & Conduta",
    icon: "🪪",
    cor: "#7f77dd",
    subtipos: [
      {
        key: "INQ_QRCODE",
        label: "Uso indevido de QR Code / crachá / credencial",
        sevPadrao: "atencao",
        modelo: "Informo que, às {hora}, em {local}, foi constatado uso indevido de QR Code/credencial por {nome} (inquilino {inquilino}). {medidas}",
        obrigatorios: ["local", "detalhamento", "inquilino", "horaInicio"],
        fotos: "Credencial/QR Code utilizado, tela do sistema de acesso e imagem de CFTV do momento.",
        ajuda: "Descreva a irregularidade (credencial de outra pessoa, empréstimo, credencial de desligado). Identifique o inquilino responsável — este registro é insumo para notificação contratual ao inquilino.",
      },
      {
        key: "INQ_EMPRESTIMO",
        label: "Empréstimo de credencial entre pessoas",
        sevPadrao: "atencao",
        modelo: "Informo que, às {hora}, em {local}, constatou-se empréstimo de credencial entre {nome} e terceiro (inquilino {inquilino}). {medidas}",
        obrigatorios: ["local", "detalhamento", "inquilino", "horaInicio"],
        fotos: "Registro da credencial e das pessoas envolvidas (via CFTV), preservando dados sensíveis.",
        ajuda: "Deixe claro quem emprestou e quem usou, e o vínculo de cada um com o inquilino. Reincidência do mesmo inquilino é dado de gestão relevante.",
      },
      {
        key: "INQ_BURLA_ACESSO",
        label: "Burla de acesso (catraca / cancela / eclusa / tailgating)",
        sevPadrao: "atencao",
        modelo: "Informo que, às {hora}, em {local}, {nome} (inquilino {inquilino}) burlou o controle de acesso. {medidas}",
        obrigatorios: ["local", "detalhamento", "horaInicio"],
        fotos: "Ponto de acesso burlado e imagem de CFTV evidenciando a passagem indevida.",
        ajuda: "Descreva o método (passou colado a outro veículo, pulou catraca, forçou eclusa). Aponte a vulnerabilidade do ponto de acesso.",
      },
      {
        key: "INQ_HORARIO_AREA",
        label: "Acesso fora de horário / área restrita",
        sevPadrao: "info",
        modelo: "Informo que, às {hora}, {nome} (inquilino {inquilino}) acessou {local} fora do horário autorizado / em área restrita. {medidas}",
        obrigatorios: ["local", "detalhamento", "inquilino", "horaInicio"],
        fotos: "Local de acesso restrito e registro de CFTV do momento.",
        ajuda: "Informe o horário/área autorizados versus o efetivamente acessado. Registre a orientação dada à pessoa.",
      },
      {
        key: "INQ_RECUSA_REVISTA",
        label: "Recusa a revista / vistoria de veículo",
        sevPadrao: "atencao",
        modelo: "Informo que, às {hora}, em {local}, {nome} (transportadora {transportadora}, inquilino {inquilino}) recusou-se à revista/vistoria. {medidas}",
        obrigatorios: ["local", "detalhamento", "horaInicio"],
        fotos: "Veículo e ponto de revista; CFTV do momento da recusa.",
        ajuda: "Registre a abordagem feita, a justificativa da recusa e o encaminhamento (liberação, retenção, acionamento da gestão).",
      },
      {
        key: "INQ_FUMO_ALCOOL",
        label: "Fumo em local proibido / álcool / suspeita de embriaguez",
        sevPadrao: "atencao",
        modelo: "Informo que, às {hora}, em {local}, {nome} (inquilino {inquilino}) foi flagrado fumando em local proibido / sob suspeita de embriaguez. {medidas}",
        obrigatorios: ["local", "detalhamento", "horaInicio"],
        fotos: "Local (risco de incêndio, se fumo) e CFTV, preservando a pessoa.",
        ajuda: "Fumo em área de risco (docas, abastecimento) é grave — considere severidade maior. Para suspeita de embriaguez, descreva os sinais observados sem afirmar diagnóstico.",
      },
      {
        key: "INQ_DESCARTE",
        label: "Descarte irregular de resíduo pelo inquilino",
        sevPadrao: "info",
        modelo: "Informo que, às {hora}, em {local}, constatou-se descarte irregular de resíduo pelo inquilino {inquilino}. {medidas}",
        obrigatorios: ["local", "detalhamento", "inquilino", "horaInicio", "fotoLocal"],
        fotos: "Resíduo descartado, local impróprio e, se possível, CFTV de quem descartou.",
        ajuda: "Descreva o tipo de resíduo e o local. Identifique o inquilino para notificação. Se for resíduo químico/perigoso, eleve a severidade.",
      },
      {
        key: "INQ_DIVERGENCIA",
        label: "Divergência de agendamento (placa / motorista / carga)",
        sevPadrao: "info",
        modelo: "Informo que, às {hora}, em {local}, constatou-se divergência entre o agendamento e o apresentado: {nome}, placa {placaCavalo} (inquilino {inquilino}). {medidas}",
        obrigatorios: ["local", "detalhamento", "inquilino", "horaInicio"],
        fotos: "Documento/agendamento e placa real do veículo para confronto.",
        ajuda: "Aponte o que divergiu (placa não confere, motorista diferente, carga sem nota). Registre se foi liberado ou retido e quem autorizou.",
      },
      {
        key: "INQ_OUTRO",
        label: "Outro (descrever)",
        sevPadrao: "info",
        modelo: "Informo que, às {hora}, em {local}, ocorreu a seguinte situação envolvendo inquilino/acesso: ",
        obrigatorios: ["local", "detalhamento", "horaInicio"],
        fotos: "Fotografe o que for relevante para evidenciar a ocorrência.",
        ajuda: "Use quando nenhum subtipo se encaixa. Identifique sempre o inquilino responsável quando aplicável.",
      },
    ],
  },

  // ───────────────────────────────────────────────────────────
  // 4. INCÊNDIO & PCI
  // ───────────────────────────────────────────────────────────
  {
    key: "INCENDIO",
    label: "Incêndio & PCI",
    icon: "🔥",
    cor: "#d85a30",
    subtipos: [
      {
        key: "INC_PRINCIPIO",
        label: "Princípio de incêndio (lixeira, sanitário, depósito, vegetação/vizinho)",
        sevPadrao: "critico",
        modelo: "Informo que, às {hora}, {quemAvisou} comunicou princípio de incêndio em {local}. {medidas} Situação controlada às {horaFim}.",
        obrigatorios: ["local", "detalhamento", "medidas", "horaInicio", "fotoLocal"],
        fotos: "Foco do incêndio, extensão da fumaça, atuação da brigada/bombeiros e o local após contenção.",
        ajuda: "Descreva a origem, a evolução e a contenção. Se acionou bombeiros/brigada, marque a flag e registre horário de acionamento e chegada. Confirme se houve dano ou vítima.",
      },
      {
        key: "INC_ALARME",
        label: "Disparo de alarme / botoeira (falso ou real)",
        sevPadrao: "atencao",
        modelo: "Informo que, às {hora}, houve disparo de alarme/botoeira em {local}. {medidas} Situação normalizada às {horaFim}.",
        obrigatorios: ["local", "detalhamento", "horaInicio"],
        fotos: "Painel/dispositivo que disparou e o ponto verificado.",
        ajuda: "Informe se foi disparo real ou falso, a causa identificada e a verificação feita. Registre o rearme do sistema.",
      },
      {
        key: "INC_BOMBA",
        label: "Falha em bomba de incêndio (jockey / diesel)",
        sevPadrao: "critico",
        modelo: "Informo que, às {hora}, foi constatada falha na bomba de incêndio ({local}). {medidas}",
        obrigatorios: ["local", "detalhamento", "horaInicio", "fotoLocal"],
        fotos: "Bomba/painel, indicadores de pressão e qualquer alarme/falha exibido.",
        ajuda: "Falha em PCI é crítica. Descreva o sintoma (não parte, sem pressão, alarme) e o acionamento da manutenção. Informe se o sistema ficou sem cobertura.",
      },
      {
        key: "INC_HIDRANTE",
        label: "Avaria em hidrante / sprinkler / mangueira / caixa de incêndio",
        sevPadrao: "atencao",
        modelo: "Informo que, às {hora}, foi constatada avaria em equipamento de PCI em {local}. {medidas}",
        obrigatorios: ["local", "detalhamento", "horaInicio", "fotoLocal"],
        fotos: "Equipamento avariado (hidrante, sprinkler, mangueira) de perto e o ponto onde se localiza.",
        ajuda: "Especifique o equipamento e o dano. Se comprometeu a cobertura de PCI daquela área, informe e acione a manutenção.",
      },
      {
        key: "INC_FUMACA",
        label: "Fumaça / cheiro de queimado sem origem localizada",
        sevPadrao: "atencao",
        modelo: "Informo que, às {hora}, foi detectada fumaça/cheiro de queimado sem origem localizada em {local}. {medidas} Verificação concluída às {horaFim}.",
        obrigatorios: ["local", "detalhamento", "horaInicio"],
        fotos: "Área onde foi percebido; se localizada a origem depois, fotografe-a.",
        ajuda: "Descreva a varredura feita para localizar a origem. Mesmo sem foco confirmado, registrar ajuda a cruzar com falhas elétricas recorrentes.",
      },
      {
        key: "INC_OUTRO",
        label: "Outro (descrever)",
        sevPadrao: "atencao",
        modelo: "Informo que, às {hora}, em {local}, ocorreu a seguinte situação de incêndio/PCI: ",
        obrigatorios: ["local", "detalhamento", "horaInicio"],
        fotos: "Fotografe o que for relevante para evidenciar a ocorrência.",
        ajuda: "Use quando nenhum subtipo se encaixa. Em dúvida sobre gravidade, prefira severidade maior.",
      },
    ],
  },

  // ───────────────────────────────────────────────────────────
  // 5. INFRAESTRUTURA & TECNOLOGIA (inclui ambiental/climático)
  // ───────────────────────────────────────────────────────────
  {
    key: "INFRA",
    label: "Infraestrutura & Tecnologia",
    icon: "⚙️",
    cor: "#0f6e56",
    subtipos: [
      {
        key: "INF_ENERGIA",
        label: "Queda / oscilação de energia (com / sem gerador)",
        sevPadrao: "atencao",
        modelo: "Informo que, às {hora}, houve queda/oscilação de energia afetando {local}. {medidas} Energia normalizada às {horaFim}.",
        obrigatorios: ["local", "detalhamento", "horaInicio"],
        fotos: "Painel/quadro, gerador (se acionou) e áreas afetadas.",
        ajuda: "Informe se o gerador entrou e em quanto tempo. Aponte os sistemas impactados (CFTV, acesso, iluminação). Registre início e normalização.",
      },
      {
        key: "INF_CFTV",
        label: "Câmeras de CFTV offline / perda de sinal",
        sevPadrao: "atencao",
        modelo: "Informo que, às {hora}, foi constatada perda de sinal/CFTV offline em {local}. {medidas} Situação normalizada às {horaFim}.",
        obrigatorios: ["local", "detalhamento", "horaInicio"],
        fotos: "Tela do sistema mostrando as câmeras offline e o setor coberto por elas.",
        ajuda: "Liste quais câmeras/setores ficaram sem imagem e o tempo de indisponibilidade — isso gera ponto cego. Registre o acionamento da manutenção/CFTV.",
      },
      {
        key: "INF_ACESSO",
        label: "Instabilidade no sistema de acesso (KeyAccess / Concierge)",
        sevPadrao: "atencao",
        modelo: "Informo que, às {hora}, houve instabilidade no sistema de acesso em {local}. {medidas} Situação normalizada às {horaFim}.",
        obrigatorios: ["local", "detalhamento", "horaInicio"],
        fotos: "Tela/sistema com a falha e a fila/impacto gerado no acesso.",
        ajuda: "Descreva o sintoma (travamento, não valida credencial) e o procedimento de contingência adotado para não parar o fluxo.",
      },
      {
        key: "INF_ILUMINACAO",
        label: "Falha de iluminação (torre, pátio, via, perímetro)",
        sevPadrao: "atencao",
        modelo: "Informo que, às {hora}, foi constatada falha de iluminação em {local}. {medidas}",
        obrigatorios: ["local", "detalhamento", "horaInicio", "fotoLocal"],
        fotos: "Área escura/ponto cego gerado e o ponto de iluminação com defeito.",
        ajuda: "Iluminação apagada em perímetro/pátio gera ponto cego de segurança. Indique a extensão e acione a manutenção. Registre se reforçou ronda na área.",
      },
      {
        key: "INF_VAZAMENTO",
        label: "Vazamento (água / óleo / produto químico)",
        sevPadrao: "atencao",
        modelo: "Informo que, às {hora}, foi constatado vazamento em {local}. {medidas} Situação controlada às {horaFim}.",
        obrigatorios: ["local", "detalhamento", "medidas", "horaInicio", "fotoLocal"],
        fotos: "Ponto do vazamento, extensão do espalhamento e a contenção aplicada.",
        ajuda: "Identifique o líquido — vazamento de óleo/químico é ambiental e pode exigir contenção especial (eleve a severidade). Descreva o isolamento e a limpeza.",
      },
      {
        key: "INF_ALAGAMENTO",
        label: "Alagamento / bueiro entupido / evento climático",
        sevPadrao: "atencao",
        modelo: "Informo que, às {hora}, ocorreu alagamento/evento climático afetando {local}. {medidas} Situação normalizada às {horaFim}.",
        obrigatorios: ["local", "detalhamento", "horaInicio", "fotoLocal"],
        fotos: "Extensão do alagamento, ponto de drenagem/bueiro e danos causados.",
        ajuda: "Descreva a causa (chuva forte, bueiro entupido) e o impacto (via interditada, doca alagada). Registre a ação de contenção e se houve dano material.",
      },
      {
        key: "INF_LINK",
        label: "Rompimento de link / fibra / falha de comunicação",
        sevPadrao: "atencao",
        modelo: "Informo que, às {hora}, houve rompimento de link/falha de comunicação afetando {local}. {medidas} Comunicação restabelecida às {horaFim}.",
        obrigatorios: ["local", "detalhamento", "horaInicio"],
        fotos: "Equipamento/rack afetado e a tela indicando a queda de conexão.",
        ajuda: "Informe quais sistemas ficaram sem comunicação (CCO, CFTV remoto) e a contingência. Registre o acionamento do provedor/TI.",
      },
      {
        key: "INF_OUTRO",
        label: "Outro (descrever)",
        sevPadrao: "info",
        modelo: "Informo que, às {hora}, em {local}, ocorreu a seguinte situação de infraestrutura/tecnologia: ",
        obrigatorios: ["local", "detalhamento", "horaInicio"],
        fotos: "Fotografe o que for relevante para evidenciar a ocorrência.",
        ajuda: "Use quando nenhum subtipo se encaixa. Descreva o sistema afetado e o impacto operacional.",
      },
    ],
  },
  {
    key: "EMERGENCIA_MEDICA",
    label: "Emergência Médica",
    icon: "🚑",
    cor: "#c0392b",
    subtipos: [
      {
        key: "MED_MAL_SUBITO",
        label: "Mal súbito / desmaio",
        sevPadrao: "critico",
        modelo: "Informo que, às {hora}, em {local}, houve mal súbito envolvendo {nome}. {medidas} Situação normalizada às {horaFim}.",
        obrigatorios: ["local", "detalhamento", "medidas", "horaInicio"],
        fotos: "Evite fotografar a pessoa. Registre apenas o local, se necessário. Preserve a dignidade e a privacidade do envolvido.",
        ajuda: "Descreva os sintomas observados, se a pessoa estava consciente, e o que foi feito. Registre acionamento de SAMU/resgate com horários. Marque a flag de apoio externo. Cuidado com dados de saúde (dado sensível).",
      },
      {
        key: "MED_ACIDENTE_TRABALHO",
        label: "Acidente de trabalho / lesão",
        sevPadrao: "critico",
        modelo: "Informo que, às {hora}, em {local}, ocorreu acidente de trabalho/lesão envolvendo {nome}. {medidas} Situação normalizada às {horaFim}.",
        obrigatorios: ["local", "detalhamento", "medidas", "horaInicio"],
        fotos: "Fotografe o local/condição que causou o acidente, se relevante. Evite fotografar ferimentos sem necessidade.",
        ajuda: "Descreva como ocorreu, a parte do corpo afetada e a gravidade aparente. Registre socorro acionado e encaminhamento. Marque apoio externo se houve SAMU/resgate.",
      },
      {
        key: "MED_ATENDIMENTO",
        label: "Atendimento / remoção médica",
        sevPadrao: "atencao",
        modelo: "Informo que, às {hora}, em {local}, foi prestado atendimento/remoção médica a {nome}. {medidas} Concluído às {horaFim}.",
        obrigatorios: ["local", "detalhamento", "horaInicio"],
        fotos: "Registre apenas o necessário. Preserve a privacidade do envolvido.",
        ajuda: "Use para atendimento ou remoção já em andamento. Registre a equipe que atendeu (SAMU, resgate, ambulância particular) e o destino, se informado.",
      },
      {
        key: "MED_OUTRO",
        label: "Outra emergência médica",
        sevPadrao: "atencao",
        modelo: "Informo que, às {hora}, em {local}, ocorreu a seguinte emergência médica: ",
        obrigatorios: ["local", "detalhamento", "horaInicio"],
        fotos: "Fotografe apenas o que for estritamente necessário, preservando a privacidade.",
        ajuda: "Use quando nenhum subtipo se encaixa. Descreva a situação de saúde e as medidas adotadas.",
      },
    ],
  },
  {
    key: "AUTORIDADES",
    label: "Acesso de Autoridades",
    icon: "🚓",
    cor: "#1f3a93",
    subtipos: [
      {
        key: "AUT_POLICIA",
        label: "Polícia (PM / Civil / PRF / GCM)",
        sevPadrao: "atencao",
        modelo: "Informo que, às {hora}, houve acesso de autoridade policial ao local ({local}). {medidas}",
        obrigatorios: ["local", "detalhamento", "horaInicio"],
        fotos: "Registre a viatura/identificação institucional se possível, sem obstruir a ação. Não fotografe abordagens de forma que exponha terceiros.",
        ajuda: "Registre a corporação, o motivo informado do acesso, nome/matrícula do agente (se fornecido) e o horário de entrada e saída. Comunique o CCO e a gerência.",
      },
      {
        key: "AUT_FISCALIZACAO",
        label: "Fiscalização (Prefeitura / Bombeiros / Vigilância / Trabalho)",
        sevPadrao: "atencao",
        modelo: "Informo que, às {hora}, houve acesso de fiscalização ao local ({local}). {medidas}",
        obrigatorios: ["local", "detalhamento", "horaInicio"],
        fotos: "Registre a identificação do órgão e eventual documento/ordem apresentado, se autorizado.",
        ajuda: "Registre o órgão fiscalizador, o objeto da fiscalização, nome do agente e documento apresentado. Acione a gerência antes de liberar acesso a áreas restritas.",
      },
      {
        key: "AUT_OFICIAL_JUSTICA",
        label: "Oficial de Justiça / mandado judicial",
        sevPadrao: "critico",
        modelo: "Informo que, às {hora}, compareceu oficial de justiça ao local ({local}) para cumprimento de ato judicial. {medidas}",
        obrigatorios: ["local", "detalhamento", "horaInicio"],
        fotos: "Registre a identificação funcional e o documento/mandado apresentado, se autorizado.",
        ajuda: "Registre o nome do oficial, a vara/processo (se informado) e o objeto do mandado. NÃO impeça o cumprimento; acione imediatamente a gerência e o jurídico. Anote horário de entrada e saída.",
      },
      {
        key: "AUT_OUTRO",
        label: "Outro acesso de autoridade",
        sevPadrao: "atencao",
        modelo: "Informo que, às {hora}, houve o seguinte acesso de autoridade ao local ({local}): ",
        obrigatorios: ["local", "detalhamento", "horaInicio"],
        fotos: "Registre a identificação institucional, se possível.",
        ajuda: "Use quando nenhum subtipo se encaixa. Descreva o órgão, o motivo e as medidas adotadas.",
      },
    ],
  },
  {
    key: "DISPOSITIVOS",
    label: "Dispositivos de Segurança",
    icon: "🔒",
    cor: "#6d28d9",
    subtipos: [
      {
        key: "DISP_CFTV",
        label: "CFTV / câmeras (falha, perda de sinal, vandalismo)",
        sevPadrao: "atencao",
        modelo: "Informo que, às {hora}, em {local}, foi identificada a seguinte ocorrência no sistema de CFTV: ",
        obrigatorios: ["local", "detalhamento", "horaInicio"],
        fotos: "Fotografe o equipamento/monitor afetado e, se possível, a tela do sistema indicando a falha.",
        ajuda: "Informe quais câmeras/DVR foram afetadas, se houve perda de gravação e o impacto na cobertura. Registre acionamento da manutenção.",
      },
      {
        key: "DISP_ALARME_PERIMETRAL",
        label: "Alarme perimetral (disparo, falha, setor inoperante)",
        sevPadrao: "atencao",
        modelo: "Informo que, às {hora}, em {local}, houve a seguinte ocorrência no alarme perimetral: ",
        obrigatorios: ["local", "detalhamento", "horaInicio"],
        fotos: "Registre o setor/painel afetado e a central de alarme, se acessível.",
        ajuda: "Informe o setor/zona, se foi disparo real ou falso, e a ação tomada. Registre se a barreira ficou vulnerável.",
      },
      {
        key: "DISP_INTERNET",
        label: "Internet / rede / comunicação (queda, instabilidade)",
        sevPadrao: "atencao",
        modelo: "Informo que, às {hora}, em {local}, houve a seguinte ocorrência de internet/comunicação: ",
        obrigatorios: ["local", "detalhamento", "horaInicio"],
        fotos: "Registre o equipamento de rede/rack se relevante.",
        ajuda: "Informe o que ficou sem comunicação (CFTV, acesso, telefonia), o tempo de indisponibilidade e o provedor acionado.",
      },
      {
        key: "DISP_CATRACA_TORNIQUETE",
        label: "Catraca / torniquete (travamento, falha, liberação indevida)",
        sevPadrao: "atencao",
        modelo: "Informo que, às {hora}, em {local}, houve a seguinte ocorrência em catraca/torniquete: ",
        obrigatorios: ["local", "detalhamento", "horaInicio"],
        fotos: "Fotografe o equipamento e o ponto de acesso afetado.",
        ajuda: "Informe se travou, liberou indevidamente ou ficou inoperante, e como o acesso foi controlado no período.",
      },
      {
        key: "DISP_BOLLARD_ECLUSA",
        label: "Bollard / eclusa / cancela CCO (falha, travamento)",
        sevPadrao: "atencao",
        modelo: "Informo que, às {hora}, em {local}, houve a seguinte ocorrência em bollard/eclusa/cancela: ",
        obrigatorios: ["local", "detalhamento", "horaInicio"],
        fotos: "Fotografe o dispositivo e o ponto de bloqueio afetado.",
        ajuda: "Informe qual dispositivo de bloqueio físico falhou (bollard, eclusa, cancela CCO), se ficou aberto/travado e o controle de acesso adotado.",
      },
      {
        key: "DISP_GARRA_TIGRE",
        label: "Garra de tigre / barreira física (dano, rompimento)",
        sevPadrao: "atencao",
        modelo: "Informo que, às {hora}, em {local}, foi constatado o seguinte na barreira física (garra de tigre): ",
        obrigatorios: ["local", "detalhamento", "horaInicio"],
        fotos: "Fotografe o trecho danificado da barreira/garra de tigre.",
        ajuda: "Informe o trecho afetado, se há vulnerabilidade no perímetro e a contenção provisória adotada.",
      },
      {
        key: "DISP_CANCELA",
        label: "Cancela de acesso (falha, quebra, travamento)",
        sevPadrao: "atencao",
        modelo: "Informo que, às {hora}, em {local}, houve a seguinte ocorrência na cancela de acesso: ",
        obrigatorios: ["local", "detalhamento", "horaInicio"],
        fotos: "Fotografe a cancela e o ponto de acesso.",
        ajuda: "Informe se a cancela quebrou, travou aberta/fechada e como o fluxo foi controlado.",
      },
      {
        key: "DISP_OUTRO",
        label: "Outro dispositivo de segurança",
        sevPadrao: "info",
        modelo: "Informo que, às {hora}, em {local}, houve a seguinte ocorrência em dispositivo de segurança: ",
        obrigatorios: ["local", "detalhamento", "horaInicio"],
        fotos: "Fotografe o dispositivo afetado.",
        ajuda: "Use para outros dispositivos de segurança. Descreva o equipamento, a falha e o impacto na proteção.",
      },
    ],
  },
];

// ── Helpers de consulta (usados pelo módulo; sem estado) ──────

// Retorna a natureza pelo key, ou null.
// Subtipos (fora de VEÍCULO) que ainda envolvem veículo/transportadora — ex.: furto de carga.
export const SUBTIPOS_COM_VEICULO = [
  "PES_FURTO",           // furto consumado (carga, cobre, etc.)
  "PES_TENTATIVA_FURTO", // tentativa de furto / intrusão perimetral
  "PES_ASSALTO",         // assalto/roubo com violência
  "PES_INTRUSAO_PESSOA", // invasão/pessoa não autorizada (pode chegar de veículo)
];
// Decide se os campos de veículo/placa/transportadora devem aparecer para o subtipo.
export function subtipoTemVeiculo(naturezaKey, subtipoKey) {
  if (naturezaKey === "VEICULO") return true;
  return SUBTIPOS_COM_VEICULO.includes(subtipoKey);
}

export function getNatureza(key) {
  return NATUREZAS.find((n) => n.key === key) || null;
}

// Retorna o subtipo { ...subtipo, natureza } pelo key do subtipo, ou null.
// Percorre todas as naturezas — o key do subtipo é único no catálogo.
export function getSubtipo(subKey) {
  for (const nat of NATUREZAS) {
    const s = (nat.subtipos || []).find((x) => x.key === subKey);
    if (s) return { ...s, naturezaKey: nat.key, naturezaLabel: nat.label, naturezaCor: nat.cor };
  }
  return null;
}

// Rótulo legível de severidade.
export function sevLabel(key) {
  const s = SEVERIDADES.find((x) => x.key === key);
  return s ? s.label : "—";
}
export function sevCor(key) {
  const s = SEVERIDADES.find((x) => x.key === key);
  return s ? s.cor : "#64748b";
}

// Monta o rascunho do detalhamento a partir do modelo do subtipo + valores
// do formulário. Remove placeholders sem valor e limpa espaços/pontuação órfã.
// `vals` é um objeto { hora, nome, doc, placaCavalo, ... }.
export function montarRascunho(subKey, vals = {}) {
  const s = getSubtipo(subKey);
  if (!s || !s.modelo) return "";
  let txt = s.modelo;
  // Frases de fecho que dependem de horaFim: se horaFim vazio, remove a frase inteira.
  const temHoraFim = String(vals.horaFim == null ? "" : vals.horaFim).trim() !== "";
  if (!temHoraFim) {
    // remove trechos do tipo "Situação normalizada às {horaFim}." / "... até {horaFim}."
    txt = txt.replace(/[^.]*\{horaFim\}[^.]*\.?/g, "").trim();
  }
  const chaves = ["hora","nome","doc","placaCavalo","placaCarreta","transportadora","inquilino","local","quemAvisou","medidas","horaFim"];
  chaves.forEach((k) => {
    const v = (vals[k] == null ? "" : String(vals[k])).trim();
    if (v) {
      txt = txt.split(`{${k}}`).join(v);
    } else {
      // remove construções entre parênteses que ficaram vazias, ex "(inquilino {inquilino})"
      txt = txt
        .replace(new RegExp(`\\s*\\(([^()]*)\\{${k}\\}([^()]*)\\)`, "g"), "")
        .split(`{${k}}`).join("");
    }
  });
  // limpeza de resíduos
  txt = txt
    .replace(/\/(?=\s|[,.);])/g, "")     // barra órfã: "CSK0J33/ da" ou "CSK0J33/," → remove a barra
    .replace(/(?:^|\s)\/(?=\S)/g, " ")   // barra órfã no início do par: "/ELQ2C01" sem cavalo
    .replace(/\s*\/\s*/g, "/")           // normaliza "A / B" → "A/B" quando ambos existem
    .replace(/\(\s*\)/g, "")             // parênteses vazios
    .replace(/\s+([,.;])/g, "$1")        // espaço antes de pontuação
    .replace(/,\s*,/g, ",")              // vírgulas duplas
    .replace(/\s{2,}/g, " ")
    .replace(/\s+\.$/,".")
    .trim();
  return txt;
}

// Padrão Moked de referência por item do Diagnóstico Situacional (catálogo centro_logistico v1.0.0).
// Texto curto: "o que a Moked espera encontrar". Só itens com padrão definido entram no quadro
// "Padrão Moked × existente" do relatório. Versão de referência: a redação é do consultor e pode
// ser ajustada aqui sem mexer no catálogo publicado (que é somente leitura).
export const PADRAO_MOKED_VERSAO = "referência 0";

export const PADRAO_MOKED_ITENS = {
  "D01.02.05.03": "Procedimento escrito de contingência da portaria (queda de energia, sistema fora do ar, abertura manual), conhecido e treinado em todos os turnos.",
  "D01.03.01": "Cancelas operantes, com sensor de segurança e abertura manual de emergência.",
  "D01.03.02": "Cancela de alta segurança (haste reforçada, resistente a impacto) nos acessos veiculares; mesmo com falha, continua bloqueando a passagem.",
  "D01.03.03": "Bollards fixos ou retráteis protegendo acessos e áreas críticas contra transposição e impacto veicular.",
  "D01.03.04": "Dilacerador (garra de tigre) na saída veicular, operante e sinalizado, impedindo a saída forçada.",
  "D01.03.07": "Eclusa de veículos e pessoas com intertravamento operante: uma porta só abre com a outra fechada, e o bloqueador de saída funcionando.",
  "D02.01.01": "CCO em ambiente segregado, com acesso restrito e controlado (credencial ou chave), sem passagem de terceiros.",
  "D02.01.03": "Todos os monitores operantes e posicionados para visualização contínua dos acessos e áreas críticas.",
  "D02.01.07": "POP de monitoramento e de contingência do CCO documentado, vigente e treinado.",
  "D02.02.01": "Câmeras cobrindo 100% dos acessos, perímetro e áreas críticas definidas no projeto.",
  "D02.02.02": "Sem pontos cegos nos acessos e no perímetro; os existentes mapeados e com mitigação definida.",
  "D02.02.04": "NVR e servidores operantes, com alerta de falha, manutenção em dia e redundância quando o projeto exigir.",
  "D02.02.05": "Retenção de imagens conforme contrato ou política do cliente, com qualidade para identificar pessoas e placas.",
  "D02.03.03": "Link principal estável e monitorado, com alternativa em caso de queda.",
  "D02.03.07": "Nobreak e gerador sustentando CCO, CFTV, portaria e cancelas na queda de energia, com autonomia definida e testes periódicos.",
  "D03.01.01": "Perímetro físico íntegro e contínuo, sem trechos caídos, abertos ou transponíveis; portões fechando e travando.",
  "D03.01.02": "Cerca elétrica ligada, com central operante e alarme integrado ao CCO.",
  "D03.01.03": "Concertina ou coroa-de-cristo contínua nos trechos definidos no projeto, sem falhas.",
  "D03.02.01": "Sensores ou fibra sensitiva operantes por zona, com o alarme chegando ao CCO.",
  "D03.02.02": "Iluminação perimetral sem trechos apagados, suficiente para o CFTV e para a ronda.",
  "D03.02.03": "CFTV perimetral cobrindo todo o perímetro, com imagem noturna utilizável.",
  "D03.02.04": "Pontos cegos e rotas de evasão conhecidos, mapeados e cobertos por ronda ou câmera.",
  "D03.02.06": "Alarmes do perímetro chegam ao CCO e geram resposta registrada em tempo definido.",
  "D04.01.06": "Rotas de emergência livres, sinalizadas e conhecidas pela equipe.",
  "D05.01.05": "Botão de pânico fixo (e móvel quando previsto) operante, com comunicação confirmada ao CCO e testes periódicos.",
  "D06.00.01": "Extintores e hidrantes sinalizados, desobstruídos e dentro da validade.",
  "D06.00.02": "Rotas de fuga sinalizadas e desobstruídas.",
  "D06.00.03": "Iluminação de emergência funcionando nas rotas de fuga.",
  "D06.00.04": "Portas corta-fogo fechando e travando, sem calço.",
  "D06.00.06": "Plano de emergência vigente, divulgado e com responsáveis definidos.",
  "D06.00.08": "Procedimentos para queda de energia, incêndio, invasão e acidente documentados e treinados.",
  "D07.01.06": "Nenhum posto descoberto nos horários de pico; cobertura planejada.",
  "D07.02.02": "Integração e reciclagem periódicas, registradas, para toda a equipe.",
  "D07.02.06": "MNP vigente, atualizado e conhecido pela equipe.",
  "D07.02.07": "POPs do posto vigentes, atualizados e treinados.",
  "D07.02.08": "Plano de contingência do projeto vigente e treinado, com responsáveis definidos.",
};

export const padraoMokedDoItem = (id) => PADRAO_MOKED_ITENS[id] || "";

// Painel de Avisos da Home — limites e catálogo. Tudo calibrável aqui; o motor (regras.js) não tem número solto.
export const AVISOS_CFG = {
  // KeyAccess fica DESLIGADO no painel: o botão "KeyAccess Falha" da Home já mostra as falhas abertas (e hoje há dezenas antigas, que afogavam o painel).
  keyAccess: { ativo: false, criticoH: 48 },
  ctmk: { criticoDias: 3 },                         // central off-line há ≥ 3 dias vira crítico
  energia: { criticoH: 4 },                         // queda de energia aberta há ≥ 4 h vira crítico
  manutencao: { atencaoDias: 3, criticoDias: 7 },   // serviço pendente/parcial na CCO
  checklistInop: { criticoDias: 30 },               // equipamento inoperante no último checklist
  checklistAtraso: { atencaoDias: 9, criticoDias: 15 }, // sem relatório semanal
  supervisao: { atencaoDias: 15, criticoDias: 30 }, // sem visita da supervisão
  plantoes: 3,                                      // plantões lidos por projeto: o atual + os 2 anteriores (cobre o dia e o fim do dia anterior)
  iluminacaoTeste: { criticoDias: 7 },              // teste quinzenal de iluminação pendente há ≥ 7 dias vira crítico
  ferias: { saidaDias: 7, retornoDias: 3 },         // avisa saída nos próximos 7 dias e retorno nos próximos 3
  janelaMapaMin: 60,                                // mesma janela da barra do Mapa de Equipe
  tickerMs: 5000,                                   // troca da manchete no painel recolhido
  tickerMax: 10,                                    // quantas manchetes (as mais importantes primeiro) entram na rotação
};

// gerencial: true = traz dado de pessoa/supervisão; só aparece no perfil gerencial.
// ordem: dentro da mesma severidade, o que está acontecendo AGORA (falta, posto vago, queda de energia) vem antes do que é crônico.
export const CATEGORIAS = {
  falta: { rotulo: "Falta", gerencial: true, ordem: 0 },
  vago: { rotulo: "Posto vago", gerencial: true, ordem: 0 },
  atraso: { rotulo: "Atraso", gerencial: true, ordem: 2 },
  ferias: { rotulo: "Férias", gerencial: true, ordem: 3 },
  troca: { rotulo: "Troca", gerencial: true, ordem: 2 },
  cobertura: { rotulo: "Cobertura", gerencial: true, ordem: 2 },
  ft: { rotulo: "FT", gerencial: true, ordem: 2 },
  mapa: { rotulo: "Mapa de Equipe", gerencial: true, ordem: 1 },
  material: { rotulo: "Material no mapa", gerencial: true, ordem: 2 },
  supervisao: { rotulo: "Supervisão", gerencial: true, ordem: 5 },
  keyaccess: { rotulo: "KeyAccess", gerencial: false, ordem: 2 },
  ctmk: { rotulo: "CTMK", gerencial: false, ordem: 2 },
  energia: { rotulo: "Energia", gerencial: false, ordem: 1 },
  manutencao: { rotulo: "Manutenção", gerencial: false, ordem: 3 },
  inop: { rotulo: "Equipamento", gerencial: false, ordem: 3 },
  relatorio: { rotulo: "Relatório semanal", gerencial: false, ordem: 5 },
  iluminacao: { rotulo: "Iluminação", gerencial: false, ordem: 4 },
  bolsao: { rotulo: "Bolsão", gerencial: false, ordem: 4 },
};
export const SEVERIDADES = { critico: 0, atencao: 1, info: 2 };

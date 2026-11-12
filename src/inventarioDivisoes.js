// Inventário de equipamentos dos projetos das divisões novas → checklist do Teste Semanal.
// Fonte: planilha "MOKED — Inventário de itens por projeto" preenchida pela equipe de cada divisão.
// Cada linha: [nº do item na planilha, nome, quantidade instalada, prefixo opcional das unidades].
// Quantidade 0 ou em branco na planilha = o projeto não tem o item (não entra aqui).
// O nº da planilha vira o id da categoria (inv_NN): não renumerar, senão o histórico dos testes perde o vínculo.
const INVENTARIO = {
  // P939 — aba MOKPAT, recebida em 12/11/2026 (levantamento parcial da equipe MokPat)
  P939: [
    [1, "Câmera CFTV fixa", 38],
    [5, "NVR / Servidor de gravação", 1],
    [6, "Monitor de CFTV – CCO", 4, "Monitor"],
    [7, "Monitor de CFTV – Portaria/Recepção", 4, "Monitor"],
    [8, "Joystick / Mesa de CFTV", 1],
    [16, "Eclusa de pedestre (clausura)", 2, "Eclusa"],
    [17, "Porta blindada", 1],
    [18, "Fechadura eletromagnética (eletroímã)", 6],
    [19, "Fechadura eletrônica / elétrica", 6],
    [21, "Interfone / Porteiro eletrônico", 8],
    [29, "Portão automático de garagem", 2, "Portão"],
    [31, "Motor de portão", 3, "Motor"],
    [32, "Eclusa veicular", 1],
    [34, "Sensor anti-esmagamento", 2],
    [35, "Semáforo / Sinalização de via", 2],
    [37, "Controle veicular (Sistema Linear)", 1],
    [40, "Leitor facial", 1],
    [44, "Controladora de acesso", 1],
    [45, "Software / Sistema de controle de acesso", 2, "Sistema"],
    [46, "Monitor de controle de acesso (CDA)", 2, "Monitor"],
    [59, "Botão de pânico móvel", 2, "Móvel"],
    [60, "Central de alarme", 1],
    [63, "Sensor magnético de porta / janela", 3],
    [64, "Cerca elétrica", 2, "Zona"],
    [65, "Sirene", 1],
    [70, "Central / Painel SDAI", 1],
    [71, "Acionador manual", 6],
    [76, "Computador / Estação de trabalho", 1],
    [77, "Mesa controladora / Botoeiras", 1],
    [79, "Telefone / Ramal", 1],
    [80, "Link de internet", 1],
    [81, "Nobreak", 3, "Nobreak"],
    [82, "Gerador", 1],
    [83, "Ar-condicionado CCO / Portaria", 1],
    [84, "Rádio comunicador (HT)", 6, "Rádio"],
    [90, "Claviculário / Gerenciador de chaves", 1],
    [91, "Cofre", 1],
  ],
};

const dois = (n) => String(n).padStart(2, "0");
// Indicador técnico (SIS+) de cada item, pela seção da planilha — não depende do nome que a equipe der ao item.
const FAIXAS_GRUPO = [[5, "cftv"], [8, "cco"], [11, "cftv"], [20, "acesso"], [22, "comunicacao"], [45, "acesso"], [46, "cco"], [57, "acesso"], [59, "panico"], [69, "perimetro"], [75, "incendio"], [77, "cco"], [80, "comunicacao"], [82, "energia"], [83, "infra"], [84, "comunicacao"]];
const grupoDoItem = (n) => (FAIXAS_GRUPO.find(([ate]) => n <= ate) || [0, "infra"])[1];
const ITEM_CAMERAS = 1; // "Câmera CFTV fixa": vira contagem (id "cftv"), com o bloco de gravação do teste

// Monta as categorias do Teste Semanal no mesmo formato do MokLog:
// câmeras = contagem; 1 unidade = item único (ok / parcial / inoperante); 2+ = uma linha por unidade.
function categoriasDoInventario(pid) {
  const itens = INVENTARIO[pid];
  if (!itens) return [];
  const cats = itens.filter(([, , q]) => q > 0).map(([n, nome, q, prefixo], i) => {
    const label = `${dois(i + 1)} - ${nome.toUpperCase()}`;
    if (n === ITEM_CAMERAS) return { id: "cftv", label, type: "count", total: q };
    const base = { id: `inv_${dois(n)}`, label, grupo: grupoDoItem(n) };
    if (q === 1) return { ...base, type: "single" };
    return { ...base, type: "items", itemLabels: Array.from({ length: q }, (_, k) => (prefixo ? `${prefixo} ${dois(k + 1)}` : dois(k + 1))) };
  });
  const k = cats.length;
  return [...cats,
    { id: "manutencao", label: `${dois(k + 1)} - VISITA DE MANUTENÇÃO`, type: "maintenance" },
    { id: "infra", label: `${dois(k + 2)} - INFRAESTRUTURA / OBS.`, type: "notes" }];
}
const temInventario = (pid) => !!INVENTARIO[pid];

module.exports = { INVENTARIO, grupoDoItem, categoriasDoInventario, temInventario };

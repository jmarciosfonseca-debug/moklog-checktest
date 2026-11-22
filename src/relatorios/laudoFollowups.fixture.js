// Cenário do P601 de 22/11/2026 (PDF de 7 páginas, 5 só de pendências): mesma OS/orçamento repetida em vários itens.
import { canonicalFollowupKey } from "../followups";

export const projetoP601 = {
  id: "P601", name: "Golgi Cajamar",
  categories: [
    { id: "alarme", label: "02 - ALARME PERIMETRAL", type: "items", itemLabels: ["Zona 01", "Zona 02"] },
    { id: "cancelas", label: "06 - CANCELAS AS (ALTA SEGURANÇA)", type: "items", itemLabels: ["Acesso 01", "Acesso 03"] },
    { id: "cftv", label: "07 - CFTV", type: "count", total: 71 },
    { id: "qr", label: "12 - LEITORES QR CANCELAS", type: "items", itemLabels: ["Entrada 03"] },
    { id: "panico", label: "18 - PÂNICO MÓVEL", type: "items", itemLabels: ["Reserva", "Ronda 01", "Ronda 02", "Líder"] },
    { id: "semaforos", label: "21 - SEMÁFOROS", type: "items", itemLabels: ["Entrada 03", "Saída 03"] },
    { id: "sensores", label: "22 - SENSORES ANTI-ESMAGAMENTO", type: "items", itemLabels: ["Entrada 03", "Saída 03"] },
    { id: "torn", label: "24 - TORNIQUETES / QR CODE", type: "items", itemLabels: ["Entrada 01", "Entrada 02", "Entrada 03", "Saída 02", "Saída 03"] },
  ],
};
const f = (status, since, note) => ({ status, since, note });
export const estadoP601 = {
  alarme: [f("partial", "2026-11-05", "O cabo não esta fixado na sua totalidade na grade"), f("inop", "2026-10-10", "Ao realizar teste não está acionando")],
  cancelas: [f("partial", "2026-11-22", "Cancela apresentando falha após a leitura do qr code"), f("partial", "2026-06-07", "Cancela sobe pelo comando da central, porém não baixa no automático.")],
  cftv: { total: 71, inoperative: ["CF-41", "CF-43", "CF-44", "CF-45", "CF-46", "SD-02", "CF-48"].map((id) => ({ id, status: "inop", since: "2026-10-26", note: "Sem gravação" })).concat([{ id: "CF-42", status: "inop", since: "2026-11-22", note: "Sem gravação" }]) },
  qr: [f("inop", "2026-06-07", "foi Retirada a controladora")],
  panico: [f("inop", "2026-05-24", "Conector da bateria danificado"), f("inop", "2026-06-07", "Sem bateria"), f("inop", "2026-06-07", "Sem bateria 14/06/2026"), f("inop", "2026-06-09", "Sem bateria")],
  semaforos: [f("inop", "2026-09-13", "parou de funcionar"), f("inop", "2026-07-19", "parou de funcionar")],
  sensores: [f("inop", "2026-05-13", "parou de funcionar"), f("inop", "2026-08-02", "parou de funcionar")],
  torn: [f("inop", "2026-11-18", "Catraca registando entrada como saída"), f("inop", "2026-10-28", "Catraca travando"), f("inop", "2026-11-22", "Girando direto e leitor preto"), f("inop", "2026-10-28", "Catraca travando"), f("inop", "2026-11-22", "Saída verde direta e destravada girando direto")],
};
const A = { id: "a", status: "proposta", em: "2026-10-19T10:00:00Z", responsavel: "FM Security", proposta: { numero: "2026005472" }, texto: "Placa controladora da cancela 03 retirada pela FM em 19/03. Aprovado pelo gestor em 28/09/2026 — aguardando execução pela FM." };
const B = { id: "b", status: "proposta", em: "2026-10-19T10:00:00Z", responsavel: "FM Security", proposta: { numero: "2026005472" }, texto: "Orç. 2026005472 (substituição dos controles de pânico móvel + placa KeyAccess cancela 03), laudo OS 76187785. Aprovado pelo gestor em 28/09/2026." };
const C = { id: "c", status: "proposta", em: "2026-09-07T10:00:00Z", responsavel: "Gerencial", texto: "A funcionalidade deste está ligada a aprovação da proposta para a troca da placa da cancela." };
const D = { id: "d", status: "proposta", em: "2026-09-07T10:00:00Z", responsavel: "Gerencial", texto: "Há proposta em aberto, pendente aprovação. Laudo que aponta dano no equipamento." };
const OS = { id: "os", status: "aguardando", em: "2026-11-02T10:00:00Z", responsavel: "FM Security", texto: "OS 81700098. Visita 27/10: falha nas câmeras do armário 9 por ausência de sinal de fibra óptica. Retorno programado para 03/11." };
const TORN = { id: "t", status: "proposta", em: "2026-10-19T10:00:00Z", responsavel: "FM Security", proposta: { numero: "2026005613" }, texto: "Orç. 2026005613 (placa fonte do torniquete 2 + conversores do quadro 5) aprovado em 23/09/2026. Aguardando execução." };
const ZONA = [{ id: "z1", status: "aguardando", em: "2026-11-02T10:00:00Z", responsavel: "FM Security", texto: "OS 81774223. Fibra atenuada; necessária máquina de fusão e OTDR." }, { id: "z2", status: "aguardando", em: "2026-10-19T10:00:00Z", responsavel: "FM Security", texto: "Visita FM 16/10/2026: zona permanece inoperante. Sem proposta." }];
const reg = (cat, item, entries, comQuem) => { const key = canonicalFollowupKey("P601", cat, item); return [key, { key, statusAtual: entries[0].status, comQuem, entries }]; };
export const followupsP601 = Object.fromEntries([
  reg("06 - CANCELAS AS (ALTA SEGURANÇA)", "Acesso 03", [A], "moked"),
  reg("12 - LEITORES QR CANCELAS", "Entrada 03", [A], "moked"),
  reg("21 - SEMÁFOROS", "Saída 03", [A], "moked"), reg("21 - SEMÁFOROS", "Entrada 03", [A, C], "moked"),
  reg("22 - SENSORES ANTI-ESMAGAMENTO", "Saída 03", [A], "moked"), reg("22 - SENSORES ANTI-ESMAGAMENTO", "Entrada 03", [A, C], "moked"),
  reg("18 - PÂNICO MÓVEL", "Ronda 01", [B], "moked"), reg("18 - PÂNICO MÓVEL", "Reserva", [B, D], "moked"), reg("18 - PÂNICO MÓVEL", "Ronda 02", [B, D], "moked"), reg("18 - PÂNICO MÓVEL", "Líder", [B, D], "moked"),
  ...["CF-41", "CF-43", "CF-44", "CF-45", "CF-46", "SD-02", "CF-42"].map((id) => reg("07 - CFTV", id, [OS], "manutencao")),
  reg("24 - TORNIQUETES / QR CODE", "Entrada 02", [TORN], "moked"), reg("24 - TORNIQUETES / QR CODE", "Saída 02", [TORN], "moked"),
  reg("02 - ALARME PERIMETRAL", "Zona 02", ZONA, "manutencao"),
]);
export const hojeP601 = new Date("2026-11-22T17:00:00Z");

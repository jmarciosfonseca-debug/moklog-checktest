// Acesso de veículos: cada marco (estacionou → chamado → entrada → saída) guarda DATA + hora.
// Se um marco "volta" no relógio em relação ao anterior, a pergunta é se foi no dia seguinte.
export const MARCOS = [["estacionou", "Estacionou (Ext.)"], ["chamado", "Chamado CCO"], ["entradaPatio", "Entrada Pátio"], ["saidaPatio", "Saída Pátio"]];

const somarDia = (dataISO, n) => new Date(Date.parse(`${dataISO}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

// horas: { estacionou:"19:20", chamado:"07:12", ... } (campos vazios são ignorados).
// Devolve { marcos: { campo:"AAAA-MM-DDTHH:MM" }, viradas:[{ campo, rotulo, anterior, hora }], invalidos:[campo] }.
// `viradas` = marcos que só ficam na ordem se forem no dia seguinte.
export function analisarMarcos(dataISO, horas) {
  const marcos = {}, viradas = [], invalidos = [];
  let dia = dataISO, anterior = null;
  MARCOS.forEach(([campo, rotulo]) => {
    const h = horas && horas[campo];
    if (!h) return;
    if (!HORA.test(h)) { invalidos.push(campo); return; }
    if (anterior && h < anterior.hora) { dia = somarDia(dia, 1); viradas.push({ campo, rotulo, anterior: anterior.rotulo, anteriorHora: anterior.hora, hora: h }); }
    marcos[campo] = `${dia}T${h}`;
    anterior = { rotulo, hora: h };
  });
  return { marcos, viradas, invalidos };
}

export function minutosEntre(inicioISO, fimISO) {
  if (!inicioISO || !fimISO) return null;
  const m = Math.round((Date.parse(`${fimISO}:00Z`) - Date.parse(`${inicioISO}:00Z`)) / 60000);
  return Number.isFinite(m) && m > 0 ? m : null;
}

export function textoDuracao(mins) {
  if (mins == null) return null;
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ""}` : `${m}min`;
}

export function perguntaVirada(viradas) {
  return `${viradas.map((v) => `${v.rotulo} (${v.hora}) vem antes de ${v.anterior} (${v.anteriorHora})`).join("; ")}.\n\nIsso aconteceu no DIA SEGUINTE?\n\nOK = sim, foi no dia seguinte. Cancelar = vou corrigir o horário.`;
}

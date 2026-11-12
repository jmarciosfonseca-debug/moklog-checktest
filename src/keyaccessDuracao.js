// Duração da falha de KeyAccess (12/11/2026). Antes só havia hora de início e de retorno, então falha que durava
// mais de um dia era medida como se tivesse voltado no dia seguinte. Agora o registro guarda também `dataFim`.
// Registro antigo, sem `dataFim`: vale a regra anterior (mesma data; se a hora de retorno é menor, virou o dia).
const DATA = /^\d{4}-\d{2}-\d{2}$/, HORA = /^\d{2}:\d{2}$/;
const horaInicioDe = (r) => (r && (r.horaInicio || r.hora)) || "";

// Data em que a falha voltou ao normal. null = ainda aberta.
export function dataFimDaFalha(r) {
  if (!r || !r.horaFim) return null;
  if (DATA.test(String(r.dataFim || ""))) return r.dataFim;
  return DATA.test(String(r.data || "")) ? r.data : null;
}
// Minutos entre o início e o retorno. null = aberta, sem hora válida ou intervalo não positivo.
export function minutosDaFalha(r) {
  const hi = horaInicioDe(r), hf = r && r.horaFim;
  if (!HORA.test(String(hi)) || !HORA.test(String(hf || ""))) return null;
  const [h1, m1] = hi.split(":").map(Number), [h2, m2] = hf.split(":").map(Number);
  let mins = h2 * 60 + m2 - (h1 * 60 + m1);
  if (DATA.test(String(r.data || "")) && DATA.test(String(r.dataFim || ""))) {
    mins += Math.round((Date.parse(r.dataFim + "T12:00:00Z") - Date.parse(r.data + "T12:00:00Z")) / 86400000) * 1440;
  } else if (mins < 0) mins += 1440; // registro antigo: virou o dia
  return mins > 0 ? mins : null;
}
export function duracaoDaFalha(r) {
  const mins = minutosDaFalha(r); if (!mins) return null;
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
  return d > 0 ? `${d}d ${h}h ${m}min` : h > 0 ? `${h}h ${m}min` : `${m} min`;
}

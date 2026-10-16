// Datas de registro: nunca no futuro; retroativo acima de 7 dias pede confirmação e fica marcado.
export const DIAS_RETROATIVO = 7;

// Data civil de Brasília (-03:00) como AAAA-MM-DD.
export const hojeISO = (agora = new Date()) => new Date(agora.getTime() - 3 * 3600000).toISOString().slice(0, 10);

export const diasAtras = (dataISO, hoje = hojeISO()) => Math.round((Date.parse(`${hoje}T00:00:00Z`) - Date.parse(`${dataISO}T00:00:00Z`)) / 86400000);

// { valida, futura, retroativo, dias }: retroativo = mais de 7 dias antes de hoje.
export function avaliarDataRegistro(dataISO, hoje = hojeISO()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dataISO || ""))) return { valida: false, futura: false, retroativo: false, dias: 0 };
  const dias = diasAtras(dataISO, hoje);
  return { valida: true, futura: dias < 0, retroativo: dias > DIAS_RETROATIVO, dias };
}

// Usado ao escolher a data. Devolve { aceita, retroativo }. `confirmar` e `avisar` injetáveis para teste.
export function escolherDataRegistro(dataISO, { hoje = hojeISO(), confirmar = (t) => window.confirm(t), avisar = (t) => window.alert(t) } = {}) {
  const a = avaliarDataRegistro(dataISO, hoje);
  if (!a.valida) return { aceita: true, retroativo: false };          // campo limpo
  if (a.futura) { avisar("Esta data ainda não chegou. Escolha hoje ou uma data anterior."); return { aceita: false, retroativo: false }; }
  if (a.retroativo) {
    const ok = confirmar(`Esta data é ${a.dias} dias atrás. Registrar como RETROATIVO?\n\nOK confirma; Cancelar mantém a data anterior.`);
    return { aceita: !!ok, retroativo: !!ok };
  }
  return { aceita: true, retroativo: false };
}

// Seletor de data de REGISTRO: calendário nativo, sem futuro e com confirmação para retroativo (>7 dias).
import { escolherDataRegistro, hojeISO } from "./datas";

export default function CampoData({ value, onChange, ...resto }) {
  return (
    <input {...resto} type="date" value={value} max={hojeISO()}
      onChange={(e) => {
        const v = e.target.value;
        const r = escolherDataRegistro(v);
        if (r.aceita) onChange(v, { retroativo: r.retroativo });
      }} />
  );
}

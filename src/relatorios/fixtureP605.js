// Fixture inspirada no P605 (04/10/2026) para os testes dos relatórios. Não é dado real de produção.
export const PROJ = { id: "P605", name: "Golgi Dutra", categories: [
  { id: "alarme", label: "01 - ALARME PERIMETRAL", type: "items", itemLabels: ["Zona 01", "Zona 02", "Zona 03", "Zona 04"] },
  { id: "cftv", label: "06 - CFTV", type: "count", total: 54 },
  { id: "panico", label: "20 - PÂNICO FIXO", type: "single" },
  { id: "tel", label: "23 - TELEFONES", type: "items", itemLabels: ["CCO Ramal", "CCO Emergencial"] },
  { id: "notas", label: "Observações", type: "notes" },
]};
const ok = { status: "ok" };
export const SEMANAS = [
  { meta: { date: "2026-09-20", leader: "Wanderley", cco: "Aline", moked: "Victoria", start: "09:29", end: "10:40", tempoPreenchimentoSeg: 900 },
    state: { alarme: [ok, ok, { status: "inop", since: "2026-09-13", note: "Sem sinal" }, ok],
      cftv: { total: 54, inoperative: [{ id: "CF 05", status: "inop", since: "2025-12-26", note: "Perda de imagens" }] },
      panico: { status: "ok" }, tel: [ok, { status: "partial", since: "2026-07-05", note: "Só faz ligação" }], notas: "x" } },
  { meta: { date: "2026-09-27", leader: "Wanderley", cco: "Cristiane", moked: "Camila", start: "09:57", end: "10:45", tempoPreenchimentoSeg: 1380 },
    state: { alarme: [ok, ok, { status: "partial", since: "2026-09-13" }, ok],
      cftv: { total: 54, inoperative: [{ id: "CF 05", status: "inop", since: "2025-12-26", note: "Perda de imagens" }, { id: "MD 05", status: "inop", since: "2026-08-21", note: "Perda de imagem" }] },
      panico: { status: "ok" }, tel: [ok, { status: "partial", since: "2026-07-05", note: "Só faz ligação" }] } },
  { meta: { date: "2026-10-04", leader: "Alex", cco: "Aline", moked: "Thais", start: "09:58", end: "10:32", tempoPreenchimentoSeg: 1602, mokedContact: true },
    state: { alarme: [ok, ok, ok, { status: "inop", since: "2026-10-01", note: "Após manutenção na Z03" }],
      cftv: { total: 54, inoperative: [{ id: "CF 05", status: "inop", since: "2025-12-26", note: "Perda de imagens" }, { id: "MD 05", status: "inop", since: "2026-08-21", note: "Perda de imagem" }] },
      panico: { status: "partial", since: "2026-09-08", note: "Não reportou" }, tel: [ok, { status: "partial", since: "2026-07-05", note: "Só faz ligação" }] } },
];

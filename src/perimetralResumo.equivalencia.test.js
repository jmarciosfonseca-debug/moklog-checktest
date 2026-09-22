// Equivalência pura: documento completo × resumo persistido no índice.
const normalizarZona = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, "-");
const peso = (s) => ({ inoperante: 3, parcial: 2, ok: 1 }[String(s || "ok").toLowerCase()] || 2);
const dia = (d) => String(d || "").slice(0, 10);
const temHora = (d) => /T\d{2}:\d{2}|\d{2}:\d{2}:\d{2}/.test(String(d || ""));

function agregar(comPeri) {
  const nomeLegivel = (z) => z.nome || z.zona || z.label || null;
  const dataDe = (p) => p.data || p.dataISO || p.dataPlantao || p.id || "";
  const zonaStats = {};
  for (const p of comPeri) for (const [ordem, z] of (p.perimetral.zonas || []).entries()) {
    const nome = nomeLegivel(z); const chave = nome ? normalizarZona(nome) : "__sem-cadastro__";
    if (!zonaStats[chave]) zonaStats[chave] = { chave, ordem, nomeReal: nome, total: 0, ruins: 0 };
    zonaStats[chave].total++;
    if ((z.status || "ok").toLowerCase() !== "ok") zonaStats[chave].ruins++;
  }
  const leituras = {};
  for (const p of [...comPeri].sort((a, b) => String(dataDe(a)).localeCompare(String(dataDe(b))))) {
    const data = String(dataDe(p));
    for (const z of (p.perimetral.zonas || [])) {
      const nome = nomeLegivel(z); const chave = nome ? normalizarZona(nome) : "__sem-cadastro__";
      (leituras[chave] ||= []).push({ status: (z.status || "ok").toLowerCase(), data, temHora: temHora(data) });
    }
  }
  const ultimo = {};
  for (const [chave, itens] of Object.entries(leituras)) {
    const ultimoDia = [...itens].map((x) => dia(x.data)).sort().at(-1);
    const candidatos = itens.filter((x) => dia(x.data) === ultimoDia);
    const todosComHora = candidatos.every((x) => x.temHora);
    const escolhido = todosComHora
      ? [...candidatos].sort((a, b) => String(a.data).localeCompare(String(b.data))).at(-1)
      : [...candidatos].sort((a, b) => peso(b.status) - peso(a.status))[0];
    ultimo[chave] = { status: escolhido.status, conflito: !todosComHora && new Set(candidatos.map((x) => x.status)).size > 1 };
  }
  return { zonaStats, ultimo };
}

function resumoPerimetral(p) {
  const per = p.perimetral;
  if (!(per && per.feito && (per.zonas || []).length)) return null;
  return { versao: 1, feito: true, data: p.dataPlantao || null,
    zonas: (per.zonas || []).map((z) => ({ nome: z.nome ?? z.zona ?? z.label ?? null, status: z.status ?? "ok" })) };
}
function doResumo(p) {
  const r = resumoPerimetral(p);
  return { id: p.id, data: r.data || p.dataPlantao || null, rondas: [],
    perimetral: { feito: true, zonas: r.zonas.map((z) => ({ nome: z.nome ?? null, status: z.status ?? "ok" })) } };
}
function equivalentes(plantoes) { return [agregar(plantoes), agregar(plantoes.map(doResumo))]; }

const casos = [
  ["zonas nomeadas ok/inoperante", [{ id: "p1", dataPlantao: "2026-09-21", perimetral: { feito: true, zonas: [{ nome: "Z-04", status: "inoperante" }, { nome: "Z-07", status: "ok" }] } }]],
  ["zona sem nome preservada como null", [{ id: "p2", dataPlantao: "2026-09-20", perimetral: { feito: true, zonas: [{ status: "parcial" }, { nome: "Portão", status: "ok" }] } }]],
  ["campos zona e label alternativos", [{ id: "p3", dataPlantao: "2026-09-19", perimetral: { feito: true, zonas: [{ zona: "Fundos", status: "ok" }, { label: "Doca", status: "inoperante" }] } }]],
  ["status ausente assume ok", [{ id: "p4", dataPlantao: "2026-09-18", perimetral: { feito: true, zonas: [{ nome: "Z-01" }] } }]],
  ["conflito sem hora no mesmo dia usa pior caso", [
    { id: "a", dataPlantao: "2026-09-21", perimetral: { feito: true, zonas: [{ nome: "Z-04", status: "ok" }] } },
    { id: "b", dataPlantao: "2026-09-21", perimetral: { feito: true, zonas: [{ nome: "Z-04", status: "inoperante" }] } },
  ]],
  ["leitura mais recente com horário confiável prevalece", [
    { id: "c", dataPlantao: "2026-09-21T08:00:00", perimetral: { feito: true, zonas: [{ nome: "Z-05", status: "inoperante" }] } },
    { id: "d", dataPlantao: "2026-09-21T12:00:00", perimetral: { feito: true, zonas: [{ nome: "Z-05", status: "ok" }] } },
  ]],
];

test.each(casos)("resumo preserva agregação: %s", (_nome, plantoes) => {
  const [completo, resumo] = equivalentes(plantoes);
  expect(resumo).toEqual(completo);
});

test("conflito sem hora permanece inoperante", () => {
  const [, resumo] = equivalentes(casos[4][1]);
  expect(resumo.ultimo["z-04"]).toEqual({ status: "inoperante", conflito: true });
});

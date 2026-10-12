// Mapa de Equipe diário → ficha do colaborador (puro).
// Falta, FT e Atraso informados no mapa viram lançamento no histórico da ficha, uma vez só:
// o id é determinístico (mapa:{mapaId}:{colaborador}:{tipo}), então concluir de novo ou corrigir o mapa
// não duplica; se a correção desfaz a exceção, o lançamento que o próprio mapa criou sai.
// COBERTURA (Base ou colaborador): quem cobre NÃO recebe FT nem nada na ficha (não é do posto); quem foi coberto
// recebe a FALTA — desde que escolhido do cadastro (deQuemId) e não marcado "não foi falta" (férias, atestado, folga).
// NÃO viram lançamento: troca/permuta, posto vago e "sem ninguém" — ficam só no histórico do mapa.
// Nome digitado (sem cadastro) e campo vazio também não geram nada. A observação do posto não vai
// para a ficha (pode ter dado sensível).

const dataBR = (iso) => iso.split("-").reverse().join("/");
const idDe = (mapaId, colabId, tipo) => `mapa:${mapaId}:${colabId}:${tipo}`;
const TIPOS = { falta: "Falta", ft: "FT", atraso: "Atraso" };

export function lancamentosDoMapa(mapa) {
  const turno = mapa.turno === "N" ? "noturno" : "diurno";
  const origem = `mapa de ${dataBR(mapa.data)} (${turno})`;
  const out = [];
  (mapa.postos || []).forEach((p) => {
    const dc = p.detalhe || {};
    // Cobertura: a falta é de quem foi coberto, não de quem cobre.
    if (p.situacao === "cobertura" && dc.deQuemId && !dc.semFalta && dc.deQuemId !== p.pessoaId) {
      const quem = (p.pessoaNome || "").trim();
      const por = quem ? ` (coberta ${dc.base ? "pela Base: " : "por "}${quem})` : "";
      const falta = { id: idDe(mapa.id, dc.deQuemId, "Falta"), colabId: dc.deQuemId, tipo: "Falta", data: mapa.data, detalhe: `Falta no posto ${p.rotulo}${por} — ${origem}`, origem: "mapa", mapaId: mapa.id, diasFalta: 1, subtipo: "1 dia", label: dataBR(mapa.data) };
      if (!out.some((x) => x.id === falta.id)) out.push(falta);
      return;
    }
    const tipo = TIPOS[p.situacao];
    if (!tipo || !p.pessoaId) return;
    let detalhe;
    if (tipo === "Atraso") {
      const d = p.detalhe || {};
      detalhe = `Atraso ${d.minutos ? `de ${d.minutos} min` : d.hora ? `(chegou às ${d.hora})` : ""} no posto ${p.rotulo} — ${origem}`.replace(/\s+/g, " ");
    } else if (tipo === "FT") detalhe = `FT no posto ${p.rotulo} — ${origem}`;
    else {
      const ft = (mapa.postos || []).find((x) => x.id === (p.detalhe || {}).porFtDe);
      detalhe = `Falta no posto ${p.rotulo}${ft && ft.pessoaNome ? ` (coberta por FT de ${ft.pessoaNome})` : ""} — ${origem}`;
    }
    const item = { id: idDe(mapa.id, p.pessoaId, tipo), colabId: p.pessoaId, tipo, data: mapa.data, detalhe, origem: "mapa", mapaId: mapa.id };
    if (tipo === "Falta") Object.assign(item, { diasFalta: 1, subtipo: "1 dia", label: dataBR(mapa.data) });
    if (!out.some((x) => x.id === item.id)) out.push(item);
    // FT: quem faltou (escolhido do cadastro) recebe a falta na própria ficha, coberta por esta FT.
    const d = p.detalhe || {};
    if (tipo === "FT" && d.quemFaltouId && d.quemFaltouId !== p.pessoaId) {
      const nomeFt = (p.pessoaNome || "").trim();
      const falta = { id: idDe(mapa.id, d.quemFaltouId, "Falta"), colabId: d.quemFaltouId, tipo: "Falta", data: mapa.data, detalhe: `Falta no posto ${p.rotulo}${nomeFt ? ` (coberta por FT de ${nomeFt})` : ""} — ${origem}`, origem: "mapa", mapaId: mapa.id, diasFalta: 1, subtipo: "1 dia", label: dataBR(mapa.data) };
      if (!out.some((x) => x.id === falta.id)) out.push(falta);
    }
  });
  return out;
}

// Aplica sobre o documento da Equipe (equipes/{pid}). Devolve { after, mudou, adicionados, atualizados, removidos, ignorados }.
export function aplicarNaFicha(doc, mapa, agora = new Date()) {
  const desejados = lancamentosDoMapa(mapa);
  const ids = new Set(desejados.map((d) => d.id));
  let adicionados = 0, atualizados = 0, removidos = 0, ignorados = 0;
  const colaboradores = (doc.colaboradores || []).map((c) => {
    let hist = Array.isArray(c.historico) ? c.historico : [];
    const meus = desejados.filter((d) => d.colabId === c.id);
    // sai só o que ESTE mapa criou e que a correção desfez
    const manter = hist.filter((h) => !(h && h.origem === "mapa" && h.mapaId === mapa.id && !ids.has(h.id)));
    removidos += hist.length - manter.length;
    hist = manter;
    meus.forEach((d) => {
      const { colabId, ...item } = d;
      const i = hist.findIndex((h) => h && h.id === d.id);
      if (i >= 0) {
        const igual = ["detalhe", "data", "tipo"].every((k) => hist[i][k] === item[k]);
        if (!igual) { hist = hist.map((h, j) => (j === i ? { ...h, ...item } : h)); atualizados += 1; }
      } else {
        hist = [{ ...item, registradoEm: agora.toISOString() }, ...hist];
        adicionados += 1;
      }
    });
    return hist === c.historico ? c : { ...c, historico: hist };
  });
  const achados = new Set(colaboradores.map((c) => c.id));
  desejados.forEach((d) => { if (!achados.has(d.colabId)) ignorados += 1; });
  const mudou = adicionados + atualizados + removidos > 0;
  return { after: mudou ? { ...doc, colaboradores } : doc, mudou, adicionados, atualizados, removidos, ignorados };
}

export function resumoLancamento(r, mapa) {
  const l = lancamentosDoMapa(mapa);
  const cont = (t) => l.filter((x) => x.tipo === t).length;
  const partes = [["Falta", "falta", "faltas"], ["FT", "FT", "FT"], ["Atraso", "atraso", "atrasos"]].map(([t, s, p]) => (cont(t) ? `${cont(t)} ${cont(t) > 1 ? p : s}` : "")).filter(Boolean);
  if (!partes.length && !r.removidos) return "Nenhum lançamento para a ficha neste mapa.";
  return `Ficha atualizada: ${partes.join(", ") || "lançamentos removidos"}${r.removidos ? ` (${r.removidos} desfeito${r.removidos > 1 ? "s" : ""} pela correção)` : ""}.`;
}

// "Falta de Elaine", "FT de Rosemary"…: o que o mapa pede para a ficha, em palavras, para o líder conferir na tela.
export function descricaoLancamentos(mapa) {
  const nome = (id) => {
    const p = (mapa.postos || []).find((x) => x.pessoaId === id && x.pessoaNome);
    if (p) return p.pessoaNome;
    const f = (mapa.postos || []).find((x) => x.detalhe && x.detalhe.quemFaltouId === id);
    if (f) return f.detalhe.quemFaltou || "colaborador";
    const c = (mapa.postos || []).find((x) => x.detalhe && x.detalhe.deQuemId === id);
    return (c && c.detalhe.deQuem) || "colaborador";
  };
  return lancamentosDoMapa(mapa).map((l) => `${l.tipo} de ${nome(l.colabId)}`);
}

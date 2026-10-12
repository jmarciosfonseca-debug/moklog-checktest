// Mapa de Equipe diário — consolidado (puro, sem Firestore nem relógio): filtra os mapas concluídos
// por período, projeto, plantão (turno), líder, colaborador e tipo de ocorrência (falta / FT) e soma os números.
// Só mapas "enviado" (concluídos) entram: rascunho não é fato consumado.
import { kmRodado } from "./modelo";

export const OCORRENCIAS = [
  { id: "todos", rotulo: "Todos os mapas", tipos: null },
  { id: "qualquer", rotulo: "Só mapas com ocorrência (falta, FT, atraso, troca, cobertura)", tipos: ["falta", "ft", "atraso", "cobertura", "troca", "vago"] },
  { id: "falta_ft", rotulo: "Falta ou FT", tipos: ["falta", "ft"] },
  { id: "falta", rotulo: "Só falta", tipos: ["falta"] },
  { id: "ft", rotulo: "Só FT", tipos: ["ft"] },
];
const TIPOS_LINHA = ["falta", "ft", "atraso", "cobertura", "troca", "vago"]; // tudo que sai do "presente"
export const MAX_DIAS_PERIODO = 92;

const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const nomeDe = (p) => String(p?.pessoaNome || "").trim();
const hh = (h) => (h ? String(h).replace(":", "h") : "");

export const liderDoMapa = (mapa) => {
  const ps = mapa.postos || [];
  const p = ps.find((x) => x.lider && nomeDe(x)) || null;
  return p ? nomeDe(p) : "";
};

const ordemTurno = (t) => (t === "D" ? 0 : 1);
const porData = (a, b) => String(a.data).localeCompare(String(b.data)) || String(a.projetoId).localeCompare(String(b.projetoId)) || ordemTurno(a.turno) - ordemTurno(b.turno);

// Uma linha por posto que saiu do normal, já com o texto do detalhe.
export function ocorrenciasDoMapa(mapa) {
  const postos = mapa.postos || [];
  const lider = liderDoMapa(mapa);
  const ctx = { data: mapa.data, projetoId: mapa.projetoId, turno: mapa.turno, lider };
  const linhas = [];
  for (const p of postos) {
    if (!p.situacao || p.situacao === "presente" || !TIPOS_LINHA.includes(p.situacao)) continue;
    const d = p.detalhe || {};
    let detalhe = "";
    const envolvidos = [nomeDe(p)];
    if (p.situacao === "falta") {
      const ft = postos.find((x) => x.id && x.id === d.porFtDe);
      if (ft && nomeDe(ft)) { detalhe = `coberta por FT de ${nomeDe(ft)}`; envolvidos.push(nomeDe(ft)); }
    } else if (p.situacao === "ft") {
      if (d.quemFaltou) { detalhe = `cobrindo a falta de ${d.quemFaltou}`; envolvidos.push(d.quemFaltou); }
      else if (d.semFalta) detalhe = "sem falta (folga trabalhada)";
    } else if (p.situacao === "cobertura") {
      detalhe = `${d.base ? "Base, " : ""}cobrindo ${d.deQuem || "—"}`; envolvidos.push(d.deQuem);
    } else if (p.situacao === "troca") {
      detalhe = `no lugar de ${d.noLugarDe || "—"}`; envolvidos.push(d.noLugarDe);
    } else if (p.situacao === "atraso") {
      detalhe = [d.hora ? `chegou às ${hh(d.hora)}` : "", d.minutos ? `${d.minutos} min` : ""].filter(Boolean).join(" · ");
    } else if (p.situacao === "vago") {
      detalhe = "posto sem ninguém";
    }
    if ((p.obs || "").trim()) detalhe = detalhe ? `${detalhe} — ${p.obs.trim()}` : p.obs.trim();
    linhas.push({ ...ctx, tipo: p.situacao, posto: p.rotulo || "", pessoa: nomeDe(p), detalhe, envolvidos: envolvidos.filter(Boolean) });
  }
  return linhas;
}

export function descreverFiltros(f = {}, nomeProj = (p) => p) {
  const dt = (iso) => (iso ? iso.split("-").reverse().join("/") : "—");
  const oc = OCORRENCIAS.find((o) => o.id === (f.ocorrencia || "todos")) || OCORRENCIAS[0];
  const partes = [`Período ${dt(f.de)} a ${dt(f.ate)}`];
  partes.push(f.projetos && f.projetos.length ? `Projeto${f.projetos.length > 1 ? "s" : ""}: ${f.projetos.map((p) => nomeProj(p)).join(", ")}` : "Todos os projetos");
  partes.push(f.turno === "D" ? "Plantão diurno" : f.turno === "N" ? "Plantão noturno" : "Plantões diurno e noturno");
  if (f.lider) partes.push(`Líder: ${f.lider}`);
  if ((f.colaborador || "").trim()) partes.push(`Colaborador: ${f.colaborador.trim()}`);
  if (oc.id !== "todos") partes.push(oc.rotulo.replace(/^Só /, "Somente ").replace("Só mapas", "Somente mapas"));
  return partes;
}

const somaKm = (mapa) => (mapa.veiculos || []).reduce((s, v) => { const r = kmRodado(v); return r != null && r >= 0 ? s + r : s; }, 0);

// Líderes que aparecem nos mapas já lidos (para o seletor).
export function listaLideres(mapas) {
  return [...new Set((mapas || []).map(liderDoMapa).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

// `mapas`: documentos lidos do Firestore. Aplica os filtros e devolve mapas, ocorrências e totais coerentes entre si.
export function consolidar(mapas, filtros = {}) {
  const f = { ocorrencia: "todos", projetos: [], turno: "", lider: "", colaborador: "", ...filtros };
  const oc = OCORRENCIAS.find((o) => o.id === f.ocorrencia) || OCORRENCIAS[0];
  const col = norm(f.colaborador);
  const projetos = new Set(f.projetos || []);

  const baseMapas = (mapas || []).filter((m) => m && m.status === "enviado" && m.data
    && (!f.de || m.data >= f.de) && (!f.ate || m.data <= f.ate)
    && (!projetos.size || projetos.has(m.projetoId))
    && (!f.turno || m.turno === f.turno)
    && (!f.lider || liderDoMapa(m) === f.lider));

  const saida = [];
  for (const m of baseMapas) {
    let linhas = ocorrenciasDoMapa(m);
    if (oc.tipos) linhas = linhas.filter((l) => oc.tipos.includes(l.tipo));
    if (col) {
      const citaNoEfetivo = (m.postos || []).some((p) => norm(nomeDe(p)).includes(col));
      linhas = linhas.filter((l) => l.envolvidos.some((n) => norm(n).includes(col)));
      if (!citaNoEfetivo && !linhas.length) continue; // a pessoa nem aparece neste mapa
    }
    if (oc.tipos && !linhas.length) continue; // filtro por ocorrência: só entra o mapa que tem
    saida.push({ mapa: m, linhas });
  }
  saida.sort((a, b) => porData(a.mapa, b.mapa));

  const vazio = () => ({ mapas: 0, falta: 0, ft: 0, atraso: 0, cobertura: 0, troca: 0, vago: 0, km: 0 });
  const totais = vazio();
  const proj = new Map();
  const ocorrencias = [];
  for (const { mapa, linhas } of saida) {
    const t = proj.get(mapa.projetoId) || vazio();
    proj.set(mapa.projetoId, t);
    t.mapas++; totais.mapas++;
    const km = somaKm(mapa); t.km += km; totais.km += km;
    for (const l of linhas) { t[l.tipo]++; totais[l.tipo]++; ocorrencias.push(l); }
  }
  const porProjeto = [...proj.entries()].map(([projetoId, v]) => ({ projetoId, ...v })).sort((a, b) => a.projetoId.localeCompare(b.projetoId));
  return { mapas: saida.map((s) => ({ ...s.mapa, liderNome: liderDoMapa(s.mapa), ocorrencias: s.linhas })), ocorrencias, totais, porProjeto, filtros: f };
}

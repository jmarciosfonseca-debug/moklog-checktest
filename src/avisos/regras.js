// Painel de Avisos — motor puro. Cada aviso é CALCULADO do estado atual das fontes: se o problema deixa de existir,
// o aviso some sozinho (nada é gravado, nada fica "esquecido"). Fonte não lida (undefined) não gera aviso nem "tudo certo".
import { AVISOS_CFG, CATEGORIAS, SEVERIDADES } from "./config";
import { turnoVigente } from "../mapaDiario/painel";
import { horarioDoTurno } from "../mapaDiario/horarios";
import { chaveMapa, inicioDoTurno, somarDias, estadoDoMapa } from "../mapaDiario/regras";

const MIN = 60000, HORA = 3600000, DIA = 86400000;
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const dataBR = (iso) => (iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : "");
const turnoNome = (t) => (t === "N" ? "noturno" : "diurno");

// "há 5 min / 3 h / 2 dias". null = sem data de início conhecida.
export function idadeTexto(desde, agora) {
  if (!desde) return "";
  const ms = agora.getTime() - desde.getTime();
  if (Number.isNaN(ms)) return "";
  if (ms < HORA) return ms < 5 * MIN ? "agora há pouco" : `há ${Math.floor(ms / MIN)} min`;
  if (ms < DIA) return `há ${Math.floor(ms / HORA)} h`;
  const d = Math.floor(ms / DIA);
  return `há ${d} ${d === 1 ? "dia" : "dias"}`;
}

const instante = (dataISO, hhmm = "12:00") => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dataISO || ""))) return null;
  const d = new Date(`${dataISO}T${/^\d{2}:\d{2}$/.test(hhmm || "") ? hhmm : "12:00"}:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};
const iso = (v) => { if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; };

// Plantão em vigor e o anterior (12 h antes) de um projeto. Sem horário cadastrado = [].
export function plantoesDoAviso(projetoId, agora) {
  const v = turnoVigente(projetoId, agora);
  if (!v) return [];
  const lista = [{ slot: "atual", data: v.data, turno: v.turno, inicio: v.inicio, chave: chaveMapa(projetoId, v.data, v.turno) }];
  const tAnt = v.turno === "D" ? "N" : "D";
  const dAnt = v.turno === "D" ? somarDias(v.data, -1) : v.data;
  const h = horarioDoTurno(projetoId, tAnt);
  if (h) lista.push({ slot: "anterior", data: dAnt, turno: tAnt, inicio: inicioDoTurno(dAnt, h.inicio), chave: chaveMapa(projetoId, dAnt, tAnt) });
  return lista;
}

const A = (o) => ({ gerencial: !!(CATEGORIAS[o.tipo] || {}).gerencial, desde: null, detalhe: "", ...o });

// ── Mapa de Equipe: falta (inclui a falta coberta por FT), posto vago, atraso, material com alteração ──
function avisosDoMapa(pid, p, mapa) {
  const out = [];
  const quando = `Plantão ${turnoNome(p.turno)} ${dataBR(p.data)}`;
  const base = `${pid}:${p.data}:${p.turno}`;
  const postos = mapa.postos || [];
  const nome = (x) => String((x && x.pessoaNome) || "").trim();
  const faltas = [];
  for (const x of postos) {
    if (x.situacao !== "falta") continue;
    const d = x.detalhe || {};
    const ft = postos.find((y) => y.id && y.id === d.porFtDe);
    faltas.push({ posto: x, pessoa: nome(x) || "Colaborador", ftNome: ft ? nome(ft) : "" });
  }
  // FT cobrindo uma falta que o mapa não marcou no posto da pessoa: a falta existe do mesmo jeito (mesma regra da ficha).
  for (const f of postos.filter((y) => y.situacao === "ft")) {
    const d = f.detalhe || {};
    if (d.semFalta || !String(d.quemFaltou || "").trim()) continue;
    const jaTem = faltas.some((x) => (d.quemFaltouId && x.posto.pessoaId === d.quemFaltouId) || (d.faltaPostoId && x.posto.id === d.faltaPostoId) || x.posto.detalhe?.porFtDe === f.id || norm(x.pessoa) === norm(d.quemFaltou));
    if (!jaTem) faltas.push({ posto: { id: `ft-${f.id}`, rotulo: f.rotulo }, pessoa: String(d.quemFaltou).trim(), ftNome: nome(f) });
  }
  for (const f of faltas) {
    out.push(A({ id: `falta:${base}:${norm(f.pessoa)}`, tipo: "falta", sev: "critico", projetoId: pid, titulo: `Falta de ${f.pessoa}`, detalhe: `${f.posto.rotulo || "Posto"} · ${quando}${f.ftNome ? ` · coberta por FT de ${f.ftNome}` : " · sem cobertura registrada"}`, desde: p.inicio }));
  }
  for (const x of postos) {
    if (x.situacao === "vago") out.push(A({ id: `vago:${base}:${norm(x.rotulo)}`, tipo: "vago", sev: "critico", projetoId: pid, titulo: `Posto sem ninguém: ${x.rotulo || "posto"}`, detalhe: quando, desde: p.inicio }));
    else if (x.situacao === "atraso") {
      const d = x.detalhe || {};
      out.push(A({ id: `atraso:${base}:${norm(nome(x) || x.rotulo)}`, tipo: "atraso", sev: "info", projetoId: pid, titulo: `Atraso de ${nome(x) || "colaborador"}`, detalhe: [x.rotulo, quando, d.minutos ? `${d.minutos} min` : ""].filter(Boolean).join(" · "), desde: p.inicio }));
    }
  }
  const mat = mapa.material || {};
  for (const e of mat.excecoes || []) {
    if (!e || !String(e.nome || "").trim()) continue;
    const indisp = e.situacao === "indisponivel";
    out.push(A({ id: `material:${base}:${norm(e.nome)}`, tipo: "material", sev: indisp ? "atencao" : "info", projetoId: pid, titulo: `${e.nome}: ${indisp ? "indisponível" : "com anomalia"}`, detalhe: [quando, (e.obs || "").trim()].filter(Boolean).join(" · "), desde: p.inicio }));
  }
  return out;
}

function avisosMapas({ agora, mapas, cfg }) {
  const out = [];
  for (const pid of Object.keys(mapas || {})) {
    for (const p of plantoesDoAviso(pid, agora)) {
      const lido = mapas[pid] ? mapas[pid][p.chave] : undefined;
      if (lido === undefined) continue; // ainda não lido
      const enviado = !!(lido && lido.status === "enviado" && lido.enviadoEm);
      const estado = estadoDoMapa({ inicio: p.inicio, agora, enviadoEm: enviado ? new Date(lido.enviadoEm) : null, janelaMin: cfg.janelaMapaMin });
      if (estado === "pendente") {
        out.push(A({ id: `mapa:${pid}:${p.data}:${p.turno}`, tipo: "mapa", sev: p.slot === "anterior" ? "critico" : "atencao", projetoId: pid, titulo: `Mapa de equipe não enviado (${turnoNome(p.turno)})`, detalhe: `${lido ? "Está em rascunho" : "Ainda não foi aberto"} · plantão de ${dataBR(p.data)}`, desde: p.inicio }));
      }
      if (lido) out.push(...avisosDoMapa(pid, p, lido));
    }
  }
  return out;
}

// ── Fontes de campo ──
const avisosKeyAccess = ({ agora, keyaccess, cfg }) => Object.entries(keyaccess || {}).flatMap(([pid, regs]) => (regs || []).filter((r) => r && !r.horaFim).map((r) => {
  const desde = instante(r.data, r.horaInicio || r.hora);
  const horas = desde ? (agora - desde) / HORA : 0;
  const tipos = Array.isArray(r.tipos) && r.tipos.length ? r.tipos.join(", ") : "";
  return A({ id: `keyaccess:${pid}:${r.id || `${r.data}-${r.horaInicio || r.hora || ""}`}`, tipo: "keyaccess", sev: horas >= cfg.keyAccess.criticoH ? "critico" : "atencao", projetoId: pid, titulo: "Falha de acesso aberta (KeyAccess)", detalhe: [tipos, r.local || r.descricao || ""].filter(Boolean).join(" · "), desde });
}));

const avisosCtmk = ({ agora, ctmk, cfg }) => Object.entries(ctmk || {}).filter(([, c]) => c && c.status === "offline").map(([pid, c]) => {
  const desde = iso(c.offlineSince);
  const dias = desde ? (agora - desde) / DIA : 0;
  return A({ id: `ctmk:${pid}`, tipo: "ctmk", sev: dias >= cfg.ctmk.criticoDias ? "critico" : "atencao", projetoId: pid, titulo: "CTMK off-line (central de monitoramento)", desde });
});

const avisosEnergia = ({ agora, energia, cfg }) => Object.entries(energia || {}).flatMap(([pid, evs]) => (evs || []).filter((e) => e && !e.concluido && e.tipoRegistro !== "diesel_avulso" && e.inicioQueda).slice(0, 1).map((e) => {
  const desde = iso(e.inicioQueda);
  const horas = desde ? (agora - desde) / HORA : 0;
  return A({ id: `energia:${pid}:${e.id || e.inicioQueda}`, tipo: "energia", sev: horas >= cfg.energia.criticoH ? "critico" : "atencao", projetoId: pid, titulo: "Queda de energia em aberto", detalhe: e.tipo ? String(e.tipo) : "", desde });
}));

const avisosManutencao = ({ agora, manutencao, cfg }) => Object.entries(manutencao || {}).flatMap(([pid, regs]) => (regs || []).filter((r) => r && !r.arquivado && (r.status === "pendente" || r.status === "parcial")).map((r) => {
  const desde = instante(r.data);
  const dias = desde ? Math.floor((agora - desde) / DIA) : 0;
  if (dias < cfg.manutencao.atencaoDias) return null;
  return A({ id: `manutencao:${pid}:${r.id}`, tipo: "manutencao", sev: dias >= cfg.manutencao.criticoDias ? "critico" : "atencao", projetoId: pid, titulo: `Manutenção ${r.status === "parcial" ? "parcial" : "pendente"}: ${r.sistema || r.empresa || "serviço"}`, detalhe: [r.empresa, String(r.servico || "").slice(0, 90)].filter(Boolean).join(" · "), desde });
}).filter(Boolean));

// pendencias: [{projetoId, cat, item, status, days}] do último checklist de cada planta (só "inop" vira aviso).
function avisosInop({ agora, pendencias, cfg }) {
  const por = {};
  for (const p of pendencias || []) if (p && p.status === "inop") (por[p.projetoId] = por[p.projetoId] || []).push(p);
  return Object.entries(por).map(([pid, lista]) => {
    lista.sort((a, b) => (b.days || 0) - (a.days || 0));
    const maior = lista[0].days || 0;
    const nome = (p) => (p.item && p.item !== "—" ? `${p.cat} — ${p.item}` : p.cat);
    const resto = lista.length > 2 ? ` e mais ${lista.length - 2}` : "";
    return A({ id: `inop:${pid}`, tipo: "inop", sev: maior >= cfg.checklistInop.criticoDias ? "critico" : "atencao", projetoId: pid, titulo: `${lista.length} ${lista.length === 1 ? "equipamento inoperante" : "equipamentos inoperantes"}`, detalhe: `${lista.slice(0, 2).map((p) => `${nome(p)}${p.days ? ` (${p.days} d)` : ""}`).join("; ")}${resto}`, desde: maior ? new Date(agora.getTime() - maior * DIA) : null });
  });
}

const avisosRelatorio = ({ agora, ultimoRelatorio, cfg }) => Object.entries(ultimoRelatorio || {}).filter(([, d]) => d).map(([pid, d]) => {
  const desde = instante(d);
  const dias = desde ? Math.floor((agora - desde) / DIA) : 0;
  if (dias < cfg.checklistAtraso.atencaoDias) return null;
  return A({ id: `relatorio:${pid}`, tipo: "relatorio", sev: dias >= cfg.checklistAtraso.criticoDias ? "critico" : "atencao", projetoId: pid, titulo: "Relatório semanal atrasado", detalhe: `Último em ${dataBR(d)}`, desde });
}).filter(Boolean);

const avisosSupervisao = ({ agora, supervisao, cfg }) => Object.entries(supervisao || {}).map(([pid, regs]) => {
  const datas = (regs || []).filter((r) => r && !r.rascunho && r.data).map((r) => r.data).sort();
  if (!datas.length) return null;
  const ult = datas[datas.length - 1];
  const desde = instante(ult);
  const dias = desde ? Math.floor((agora - desde) / DIA) : 0;
  if (dias < cfg.supervisao.atencaoDias) return null;
  return A({ id: `supervisao:${pid}`, tipo: "supervisao", sev: dias >= cfg.supervisao.criticoDias ? "critico" : "atencao", projetoId: pid, titulo: `Sem visita da supervisão há ${dias} dias`, detalhe: `Última visita em ${dataBR(ult)}`, desde });
}).filter(Boolean);

const avisosIluminacao = ({ iluminacao }) => Object.entries(iluminacao || {}).map(([pid, quads]) => {
  const def = (quads || []).reduce((a, q) => a + (Number(q && q.deficientes) || 0), 0);
  return def > 0 ? A({ id: `iluminacao:${pid}`, tipo: "iluminacao", sev: "atencao", projetoId: pid, titulo: `${def} ${def === 1 ? "ponto de iluminação deficiente" : "pontos de iluminação deficientes"}` }) : null;
}).filter(Boolean);

const avisosBolsao = ({ bolsao }) => Object.entries(bolsao || {}).map(([pid, placas]) => {
  const n = Object.values(placas || {}).filter((x) => x && x.status === "critico").length;
  return n > 0 ? A({ id: `bolsao:${pid}`, tipo: "bolsao", sev: "atencao", projetoId: pid, titulo: `${n} ${n === 1 ? "placa crítica" : "placas críticas"} no bolsão` }) : null;
}).filter(Boolean);

// fontes: ver FONTES em fontes.js. gerencial=false esconde os avisos de pessoas/supervisão.
export function calcularAvisos({ agora = new Date(), fontes = {}, gerencial = false, cfg = AVISOS_CFG } = {}) {
  const ctx = { agora, cfg, ...fontes };
  const todos = [
    ...avisosMapas({ agora, cfg, mapas: fontes.mapas }),
    ...avisosKeyAccess(ctx), ...avisosCtmk(ctx), ...avisosEnergia(ctx), ...avisosManutencao(ctx), ...avisosInop(ctx),
    ...avisosRelatorio(ctx), ...avisosSupervisao(ctx), ...avisosIluminacao(ctx), ...avisosBolsao(ctx),
  ].filter((a) => gerencial || !a.gerencial);
  const ordem = (a) => (CATEGORIAS[a.tipo] || {}).ordem ?? 9;
  todos.sort((a, b) => SEVERIDADES[a.sev] - SEVERIDADES[b.sev] || ordem(a) - ordem(b) || ((a.desde ? a.desde.getTime() : Infinity) - (b.desde ? b.desde.getTime() : Infinity)) || a.projetoId.localeCompare(b.projetoId) || a.id.localeCompare(b.id));
  const avisos = todos.map((a) => ({ ...a, idade: idadeTexto(a.desde, agora) }));
  return { avisos, contagem: { critico: avisos.filter((a) => a.sev === "critico").length, atencao: avisos.filter((a) => a.sev === "atencao").length, info: avisos.filter((a) => a.sev === "info").length } };
}

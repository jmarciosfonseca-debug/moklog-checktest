// Painel do Cliente — métricas puras (sem banco, sem relógio global). Lê os mesmos dados do app e devolve
// o "painel do carro": marcadores grandes (teste semanal, equipe) e pequenos (mapa do dia, equipamentos,
// treinamentos, pendências). Nada aqui grava.
import { calcularEstabilidade, calcularTreinamento } from "../equipe/maturidade";
import { contarEquip } from "../equipData";
import { ordenarHistorico } from "../equipeEventos";

export const GRUPOS_CLIENTE = {
  GOLGI: { label: "Golgi", pids: ["P601", "P602", "P604", "P605", "P606", "P607"] },
  MEGA: { label: "Mega", pids: ["P311A", "P311B"] },
  P260: { label: "Jatinox", pids: ["P260A", "P260B", "P260C"] },
  P505: { label: "Klog", pids: ["P505"] },
};
export const grupoDe = (escopo) => GRUPOS_CLIENTE[escopo] || null;

const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : null);
const diasEntre = (a, b) => Math.round((new Date(b + "T12:00:00Z") - new Date(a + "T12:00:00Z")) / 86400000);

// Teste semanal: último relatório do projeto (projects/{pid}.history[]).
export function testeSemanal(history, computeHealth, project, hojeISO) {
  const h = Array.isArray(history) ? history : [];
  const last = h[h.length - 1];
  if (!last || !last.meta) return { pct: null, inop: 0, parcial: 0, total: 0, data: null, diasAtras: null, atrasado: true, serie: [] };
  const hc = computeHealth(project, last.state);
  const serie = h.slice(-8).map((r) => { try { return { data: r.meta?.date || null, pct: computeHealth(project, r.state).pct }; } catch { return { data: r.meta?.date || null, pct: null }; } });
  const dias = last.meta.date ? diasEntre(last.meta.date, hojeISO) : null;
  return { pct: hc.pct, inop: hc.inop, parcial: hc.partial, total: hc.total, data: last.meta.date || null, diasAtras: dias, atrasado: dias === null || dias > 8, serie };
}

// Equipe: efetivo, turnover 12 m (fórmula já usada na maturidade), tempo de casa, treinamento.
export function equipeResumo(equipe, hojeISO, catalogo = []) {
  const colabs = (equipe?.colaboradores || []).filter((c) => c && typeof c === "object");
  const ativos = colabs.filter((c) => (c.status || "ativo") === "ativo");
  let est = null; try { est = calcularEstabilidade({ colaboradores: colabs, desligados: equipe?.desligados || [] }, hojeISO); } catch { est = null; }
  const tempos = ativos.map((c) => (c.dataContratacao && /^\d{4}-\d{2}-\d{2}$/.test(c.dataContratacao) ? diasEntre(c.dataContratacao, hojeISO) : null)).filter((d) => d !== null && d >= 0);
  const tempoMedioMeses = tempos.length ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length / 30.4) : null;
  const porCargo = {}; ativos.forEach((c) => { const k = c.cargo || "Sem cargo"; porCargo[k] = (porCargo[k] || 0) + 1; });
  // "Não aplicado" / "não realizado" lançado como Treinamento é registro de ausência: não conta como treinado.
  const aplicado = (x) => x && x.tipo === "Treinamento" && !/n[ãa]o\s+(aplicad|realizad|concluíd|conclu[ií]d)/i.test(`${x.detalhe || ""} ${x.label || ""}`);
  const comTreino = ativos.filter((c) => (c.historico || []).some(aplicado)).length;
  let treinoPct = null; try { const v = ativos.map((c) => calcularTreinamento(c, catalogo, hojeISO)).filter((x) => typeof x === "number"); treinoPct = v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; } catch { treinoPct = null; }
  const todosTreinos = ordenarHistorico(ativos.flatMap((c) => (c.historico || []).filter((x) => x && x.tipo === "Treinamento").map((x) => ({ ...x, colabNome: c.nome, colabId: c.id, aplicado: aplicado(x) })))).reverse();
  const ultimosTreinos = todosTreinos.filter((x) => x.aplicado).slice(0, 12);
  const naoAplicados = todosTreinos.filter((x) => !x.aplicado).length;
  const entradas12m = (() => { const ini = new Date(hojeISO + "T12:00:00Z"); ini.setUTCFullYear(ini.getUTCFullYear() - 1); const i = ini.toISOString().slice(0, 10); return ativos.filter((c) => c.dataContratacao && c.dataContratacao >= i && c.dataContratacao <= hojeISO).map((c) => ({ id: c.id, nome: c.nome, cargo: c.cargo, desde: c.dataContratacao })); })();
  const evidencias = todosTreinos.filter((x) => x.fotoRef).slice(0, 30); // galeria: só treinamentos com foto
  return {
    ativos: ativos.length, porCargo, tempoMedioMeses,
    turnover: est && est.turnover !== null ? Math.round(est.turnover * 10) / 10 : null,
    turnoverMotivo: est ? est.motivoNaoAferido : "sem dados",
    entradas12m: est ? est.entradas12m : 0, saidas12m: est ? est.desligados12m : 0,
    treinadosPct: pct(comTreino, ativos.length), treinoIndicePct: treinoPct, ultimosTreinos, evidencias, naoAplicados, entradas12mLista: entradas12m,
  };
}

// Mapa do dia: último mapa ENVIADO (equipes/{pid}/mapas) — presença por posto.
export function mapaResumo(mapas, hojeISO) {
  const enviados = (mapas || []).filter((m) => m && m.status === "enviado").sort((a, b) => `${b.data}${b.turno === "N" ? 1 : 0}`.localeCompare(`${a.data}${a.turno === "N" ? 1 : 0}`));
  const m = enviados[0];
  if (!m) return { temMapa: false, data: null, turno: null, postos: 0, presentes: 0, faltas: 0, ft: 0, atrasos: 0, vagos: 0, hoje: false, lista: [] };
  const postos = (m.postos || []).filter((p) => p && (p.pessoaId || p.pessoaNome || p.situacao === "vago"));
  const cont = (s) => postos.filter((p) => p.situacao === s).length;
  return {
    temMapa: true, data: m.data, turno: m.turno, hoje: m.data === hojeISO, postos: postos.length,
    presentes: postos.filter((p) => ["presente", "atraso", "cobertura", "troca", "ft"].includes(p.situacao || "presente")).length,
    faltas: cont("falta"), ft: cont("ft"), atrasos: cont("atraso"), vagos: cont("vago"),
    lista: postos.map((p) => ({ posto: p.rotulo, nome: p.pessoaNome || "", situacao: p.situacao || "presente", pessoaId: p.pessoaId || "" })),
  };
}

export function equipamentosResumo(doc) {
  const c = contarEquip(doc);
  return { ...c, ok: c.total - c.inop - c.parcial, pct: c.total ? Math.round(((c.total - c.inop - c.parcial * 0.5) / c.total) * 100) : null };
}

// Cor de marcador: verde ≥ 90, amarelo ≥ 70, vermelho abaixo; cinza sem dado.
export const corDe = (p) => (p === null || p === undefined ? "#64748b" : p >= 90 ? "#22c55e" : p >= 70 ? "#f59e0b" : "#ef4444");

// Visão macro (proprietário): média dos projetos do grupo.
export function consolidarGrupo(porProjeto) {
  const xs = Object.values(porProjeto).filter(Boolean);
  const med = (sel) => { const v = xs.map(sel).filter((n) => typeof n === "number"); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };
  return {
    projetos: xs.length,
    testePct: med((x) => x.teste?.pct), testesAtrasados: xs.filter((x) => x.teste?.atrasado).length,
    equipeAtivos: xs.reduce((a, x) => a + (x.equipe?.ativos || 0), 0),
    turnover: med((x) => x.equipe?.turnover),
    equipPct: med((x) => x.equip?.pct), equipInop: xs.reduce((a, x) => a + (x.equip?.inop || 0), 0),
    faltasHoje: xs.reduce((a, x) => a + (x.mapa?.hoje ? x.mapa.faltas : 0), 0),
    mapasHoje: xs.filter((x) => x.mapa?.hoje).length,
    treinadosPct: med((x) => x.equipe?.treinadosPct),
  };
}

// ── Sistemas (os mesmos insumos da Visão 360): CTMK, KeyAccess, iluminação, energia, perimetral ──
export function sistemasResumo({ ctmk, keyaccess, iluminacao, energia, perimetralZonasRuins, score360 }, agoraMs = Date.now()) {
  const keyAbertas = (keyaccess?.registros || []).filter((r) => r && !r.horaFim).length;
  const quads = iluminacao?.quadrantes || [];
  const ilumTotal = quads.reduce((a, q) => a + (Number(q.total) || 0), 0), ilumDef = quads.reduce((a, q) => a + (Number(q.deficientes) || 0), 0);
  const eventos = energia?.eventos || []; const corte = agoraMs - 7 * 86400000;
  const quedas7d = eventos.filter((e) => e && e.inicioQueda && new Date(e.inicioQueda).getTime() >= corte).length;
  const energiaAberta = eventos.some((e) => e && !e.concluido);
  const ctmkOff = ctmk?.status === "offline";
  const ctmkDias = ctmkOff && ctmk.offlineSince ? Math.max(0, Math.floor((agoraMs - new Date(ctmk.offlineSince).getTime()) / 86400000)) : 0;
  const ctmkOnlineDesde = !ctmkOff && ctmk?.lastOfflinePeriod?.to ? ctmk.lastOfflinePeriod.to : null;
  const ctmkOnlineDias = ctmkOnlineDesde ? Math.max(0, Math.floor((agoraMs - new Date(ctmkOnlineDesde).getTime()) / 86400000)) : null;
  const quadrantes = quads.map((q) => ({ nome: q.nome || q.id || "", total: Number(q.total) || 0, deficientes: Number(q.deficientes) || 0 }));
  const eventosEnergia = eventos.filter((e) => e && e.inicioQueda).sort((a, b) => String(b.inicioQueda).localeCompare(String(a.inicioQueda))).slice(0, 5).map((e) => ({ inicio: e.inicioQueda, fim: e.fimQueda || e.retorno || null, concluido: !!e.concluido, obs: e.descricao || e.obs || "" }));
  const keyFalhas = (keyaccess?.registros || []).filter((r) => r && !r.horaFim).slice(0, 8).map((r) => ({ data: r.data || "", hora: r.horaInicio || r.hora || "", local: r.local || r.portao || r.descricao || "" }));
  return {
    ctmkOff, ctmkDias, ctmkOnlineDias, ctmkOnlineDesde, keyAbertas, keyFalhas, quadrantes, eventosEnergia, ilumTotal, ilumDef, ilumPct: ilumTotal ? Math.round(((ilumTotal - ilumDef) / ilumTotal) * 100) : null,
    quedas7d, energiaAberta, perimetralZonasRuins: perimetralZonasRuins || 0,
    score360: typeof score360?.score === "number" ? Math.round(score360.score) : null, vulnerabilidades: score360?.vulnerabilidades || [],
  };
}

// Luzes de aviso do cluster (acendem quando há problema).
export function luzes(p) {
  return [
    { id: "teste", rotulo: "Teste atrasado", on: !!p.teste?.atrasado },
    { id: "falta", rotulo: "Falta hoje", on: !!(p.mapa?.hoje && (p.mapa.faltas || p.mapa.vagos)) },
    { id: "inop", rotulo: "Inoperante", on: (p.teste?.inop || 0) + (p.equip?.inop || 0) > 0 },
    { id: "ctmk", rotulo: "CTMK off", on: !!p.sistemas?.ctmkOff },
    { id: "energia", rotulo: "Energia", on: !!p.sistemas?.energiaAberta },
    { id: "key", rotulo: "KeyAccess", on: (p.sistemas?.keyAbertas || 0) > 0 },
  ];
}

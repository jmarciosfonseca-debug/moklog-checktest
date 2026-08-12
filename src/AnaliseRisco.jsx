// ─────────────────────────────────────────────────────────────
// AnaliseRisco.jsx — Relatório Situacional / Análise de Risco (MokLog CheckTest)
// Consolida até 7 fontes JÁ inseridas no app e gera PDF padrão MOKED.
//
// Fontes:
//   1. Teste Semanal / Comparativo  → projects history[] (state[cat.id])
//   2. CTMK                         → ctmk/{pid} (status/offlineSince) — painel
//   3. Iluminação                   → iluminacao/{pid} (quadrantes[])
//   4. Perimetral (ROTEADA):
//        Golgi P601/602/604-607     → rondas_plantoes (plantao.perimetral.zonas)
//        Klog P505                  → perimetral/{pid} (testes[].zonas)
//        Mega P311A/B               → sem perimetral
//   5. Ronda Virtual                → cco_ronda/{pid} (registros[] arquivados; rondas{off})
//   6. Energia                      → energia_ocorrencias/{pid} (eventos[])
//   7. Equipe                       → equipes/{pid} (colaboradores[])
//
// Navegação: pacote (Golgi/Mega/Klog) → projeto → seleção de fontes → PDF.
// Acesso: gerencial (872101) e demo (601604). Renderizado atrás do gate no App.
//
// Régua (definida com o Marcio, 24/07/2026):
//   Dias em aberto: >90 CRÍTICO · 30–90 ELEVADO · 10–29 MODERADO · <10 BAIXO
//   Preponderantes (câmera/CFTV, pânico, perímetro, CTMK): >10d → ELEVADO mín.
//   Consolidação: ≥1 preponderante-alto crítico OU ≥1 crítico → MÉDIO;
//     ≥3 críticos → MÉDIO-ALTO; ≥5 críticos ou ≥2 prep-alto críticos → ALTO.
//
// Aditivo: NÃO grava nada no Firestore — só lê. Backward-compatible.
// ─────────────────────────────────────────────────────────────

import React, { useState } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { setDoc } from "./fireGuard"; // escrita guardada (demo-safe) p/ contador AR
import { classificarVetor, consolidarSite, NIVEL as RC_NIVEL, NIVEL_LABEL as RC_LABEL } from "./riscoConfig";
import { coletarSinistros, moduladorSinistro } from "./Sinistros";
import { coletarRegional, moduladorRegional } from "./regionalConfig";

const firebaseConfig = {
  apiKey: "AIzaSyDLMwBqccgWDk7VFQdLYKuLNXWtkNn5WGA",
  authDomain: "moklog-checktest.firebaseapp.com",
  projectId: "moklog-checktest",
  storageBucket: "moklog-checktest.firebasestorage.app",
  messagingSenderId: "390165325023",
  appId: "1:390165325023:web:3147cd333503916b0d756a",
};
const fbApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(fbApp);

// ─────────────────────────────────────────────────────────────
// NÚMERO SEQUENCIAL DA ANÁLISE DE RISCO — MK-{proj}-AR-{NNNN}
// Contador B (decidido 11/08): número FIXO por projeto/análise.
//   • 1ª geração do projeto → assume o próximo número global e GRAVA.
//   • Gerações seguintes → REUSAM o mesmo número (não queima novo).
// Persistência aditiva/retrocompatível, SEM runTransaction:
//   contadores/{pid}      { arSeq, arRef, criadoEm }
//   contadores/_arGlobal  { seq }   ← sequência global única entre projetos
// Escrita via fireGuard (demo GAL não grava). Falha de rede → fallback local
// determinístico pelo número do projeto (nunca quebra a geração do PDF).
// ─────────────────────────────────────────────────────────────
function numeroProjeto(pid) {
  return (pid || "").replace(/\D/g, "") || "000";
}
function formatarRefAR(pid, seq) {
  const nnnn = String(seq).padStart(4, "0");
  return `MK-${numeroProjeto(pid)}-AR-${nnnn}`;
}
async function obterRefSequencial(pid) {
  const projNum = numeroProjeto(pid);
  try {
    // 1) já existe número fixo para este projeto? → reutiliza (contador B)
    const cSnap = await getDoc(doc(db, "contadores", pid));
    if (cSnap.exists()) {
      const d = cSnap.data() || {};
      if (d.arRef) return d.arRef;
      if (d.arSeq != null) return formatarRefAR(pid, d.arSeq);
    }
    // 2) primeira geração: pega próximo da sequência GLOBAL e grava tudo.
    const gRef = doc(db, "contadores", "_arGlobal");
    const gSnap = await getDoc(gRef);
    const atual = gSnap.exists() ? (gSnap.data().seq || 0) : 0;
    const proximo = atual + 1;
    const ref = formatarRefAR(pid, proximo);
    // grava a sequência global (merge) e o número fixo do projeto (merge).
    await setDoc(gRef, { seq: proximo }, { merge: true });
    await setDoc(doc(db, "contadores", pid), {
      arSeq: proximo, arRef: ref, criadoEm: new Date().toLocaleDateString("sv-SE"),
    }, { merge: true });
    return ref;
  } catch (e) {
    // fallback determinístico: nunca impede a geração do documento.
    return formatarRefAR(pid, 1);
  }
}

// Projetos elegíveis (Jatinox P260A/B/C fora) e pacotes de cliente.
export const ANALISE_RISCO_ELIGIBLE = ["P601","P602","P604","P605","P606","P607","P311A","P311B","P505"];
export const PACOTES = {
  golgi: { label: "Golgi", ids: ["P601","P602","P604","P605","P606","P607"] },
  mega:  { label: "Mega",  ids: ["P311A","P311B"] },
  klog:  { label: "Klog",  ids: ["P505"] },
};
// Perimetral por rondas_plantoes (Caminho B) — todos os Golgi.
const PERIMETRAL_RONDAS = ["P601","P602","P604","P605","P606","P607"];
// Perimetral por coleção perimetral/{pid} — P505.
const PERIMETRAL_COLECAO = ["P505"];

// ── Identidade visual MOKED ──────────────────────────────────
const MOKED = {
  verde: "#0F6E56", verde2: "#1D9E75", grafite: "#1a2b32",
  critico: "#B02A1E", elevado: "#B7791F", moderado: "#0F6E56", baixo: "#5F7A6E",
  texto: "#1f2d33", cinza: "#5b6b70", linha: "#dfe5e3",
};

// ── Régua de classificação ───────────────────────────────────
const REGUA = { critico: 90, elevado: 30, moderado: 10, preponderanteMinDias: 10 };
const NIVEIS = { CRITICO: 4, ELEVADO: 3, MODERADO: 2, BAIXO: 1, SEMDADOS: 0 };
const NIVEL_LABEL = { 4: "CRÍTICO", 3: "ELEVADO", 2: "MODERADO", 1: "BAIXO", 0: "SEM DADOS" };
const NIVEL_COR = { 4: MOKED.critico, 3: MOKED.elevado, 2: MOKED.moderado, 1: MOKED.baixo, 0: MOKED.cinza };
// Palavras que marcam categoria/vetor como preponderante-alto.
const PREPONDERANTE_ALTO = [
  { re: /p[âa]nico/i, nome: "pânico" },
  { re: /per[íi]metr|cerca|bollard|bolard/i, nome: "perímetro" },
  { re: /c[âa]mera|cftv|ctmk|dvr|nvr/i, nome: "câmeras/CFTV" },
];

// ── Helpers de data (anti-fuso: ancora meio-dia) ─────────────
function daysSince(dateStr) {
  if (!dateStr) return null;
  const p = String(dateStr).split("T")[0].split("-");
  if (p.length !== 3) return null;
  const d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 12, 0, 0);
  if (isNaN(d.getTime())) return null;
  const hoje = new Date(); hoje.setHours(12, 0, 0, 0);
  return Math.max(0, Math.floor((hoje - d) / 86400000));
}
function daysSinceISO(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}
const fmtDate = (d) => { if (!d) return "—"; const p = String(d).split("T")[0].split("-"); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d; };
const fmtISOdate = (iso) => { if (!iso) return "—"; const d = new Date(iso); if (isNaN(d.getTime())) return "—"; return d.toLocaleDateString("pt-BR"); };
const hojeBR = () => new Date().toLocaleDateString("pt-BR");
const isoParaLocal = (iso) => { const d = new Date(iso); return isNaN(d.getTime()) ? null : d.toLocaleDateString("sv-SE"); };

// ── Classificação por dias ───────────────────────────────────
function nivelPorDias(dias) {
  if (dias == null) return NIVEIS.BAIXO;
  if (dias > REGUA.critico) return NIVEIS.CRITICO;
  if (dias >= REGUA.elevado) return NIVEIS.ELEVADO;
  if (dias >= REGUA.moderado) return NIVEIS.MODERADO;
  return NIVEIS.BAIXO;
}
function ehPreponderante(label) {
  for (const p of PREPONDERANTE_ALTO) if (p.re.test(label || "")) return p;
  return null;
}

// ═════════════════════════════════════════════════════════════
// COLETORES DAS 7 FONTES
// Cada coletor retorna { ok, temDado, ...dados } — ok=false quando
// a fonte foi marcada mas não há dado (para avisar o usuário).
// ═════════════════════════════════════════════════════════════

// ── FONTE 1: Teste Semanal (state do último history) ─────────
function coletarTesteSemanal(project, stored) {
  const hist = stored?.[project.id]?.history ?? [];
  if (!hist.length) return { ok: false, temDado: false, motivo: "sem relatório semanal registrado" };
  const last = hist[hist.length - 1];
  const state = last.state || {};
  const pend = [];
  let totalItens = 0, okItens = 0;
  const catAgg = {};  // catLabel -> { catLabel, total, inop, piorDias, itemLabel }
  const pid = project.id;
  const agg = (catLabel, total, inop, dias, itemLabel) => {
    if (!catAgg[catLabel]) catAgg[catLabel] = { catLabel, total: 0, inop: 0, piorDias: null, itemLabel: null };
    const a = catAgg[catLabel];
    a.total += total; a.inop += inop;
    if (dias != null && (a.piorDias == null || dias > a.piorDias)) { a.piorDias = dias; a.itemLabel = itemLabel || a.itemLabel; }
  };
  for (const cat of (project.categories || [])) {
    const s = state[cat.id];
    if (s == null) continue;
    const prep = ehPreponderante(cat.label);
    if (cat.type === "single") {
      totalItens++;
      const st = s.status ?? (s.ok === false ? "inop" : "ok");
      if (st === "ok") { okItens++; agg(cat.label, 1, 0, null, null); }
      else { const p = mkPend(cat.label, "", s, st, prep); pend.push(p); agg(cat.label, 1, 1, p.dias, ""); }
    } else if (cat.type === "items") {
      const arr = Array.isArray(s) ? s : [];
      arr.forEach((v, i) => {
        totalItens++;
        const st = v?.status ?? (v?.ok === false ? "inop" : "ok");
        const lbl = cat.itemLabels?.[i] || `Item ${i + 1}`;
        if (st === "ok") { okItens++; agg(cat.label, 1, 0, null, null); }
        else { const p = mkPend(cat.label, lbl, v, st, prep); pend.push(p); agg(cat.label, 1, 1, p.dias, lbl); }
      });
    } else if (cat.type === "count") {
      const inop = Array.isArray(s.inoperative) ? s.inoperative : [];
      const tot = Number(s.total) || 0;
      totalItens += tot; okItens += Math.max(0, tot - inop.length);
      agg(cat.label, tot, inop.length, null, null);
      inop.forEach((it) => { const p = mkPend(cat.label, it.id || "?", it, "inop", prep); pend.push(p); agg(cat.label, 0, 0, p.dias, it.id || "?"); });
    }
  }
  const pct = totalItens ? Math.round((okItens / totalItens) * 100) : null;
  return {
    ok: true, temDado: true, pend, total: totalItens, okItens, pct, catAgg, pid,
    data: fmtDate(last.meta?.date), dataRaw: last.meta?.date || null,
    lider: last.meta?.lider || last.meta?.liderName || null,
  };
}
function mkPend(catLabel, itemLabel, obj, st, prep) {
  const dias = daysSince(obj?.since);
  return {
    catLabel, itemLabel,
    pontoFisico: detectarPontoFisico(itemLabel),
    status: st === "partial" ? "PARCIAL" : "INOPERANTE",
    dias, since: obj?.since || null, note: obj?.note || "",
    preponderante: !!prep, prepNome: prep?.nome || null,
  };
}
function detectarPontoFisico(itemLabel) {
  if (!itemLabel) return null;
  const m = String(itemLabel).match(/\b(entrada|sa[íi]da|via|acesso|eclusa|cancela|torniquete)\s*0*(\d+)/i);
  if (!m) return null;
  const tipo = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase().replace("ida", "ída");
  return `${tipo} ${String(m[2]).padStart(2, "0")}`;
}

// ── FONTE 2: CTMK (painel) ───────────────────────────────────
async function coletarCTMK(pid) {
  try {
    const snap = await getDoc(doc(db, "ctmk", pid));
    if (!snap.exists()) return { ok: false, temDado: false, motivo: "sem registro de CTMK" };
    const d = snap.data();
    if (d.status !== "offline") return { ok: true, temDado: true, offline: false };
    const dias = daysSinceISO(d.offlineSince);
    return { ok: true, temDado: true, offline: true, dias, desde: isoParaLocal(d.offlineSince), desdeISO: d.offlineSince };
  } catch (e) { return { ok: false, temDado: false, motivo: "erro ao ler CTMK" }; }
}

// ── FONTE 3: Iluminação ──────────────────────────────────────
async function coletarIluminacao(pid) {
  try {
    const snap = await getDoc(doc(db, "iluminacao", pid));
    if (!snap.exists()) return { ok: false, temDado: false, motivo: "sem dados de iluminação" };
    const quads = snap.data().quadrantes || [];
    if (!quads.length) return { ok: false, temDado: false, motivo: "sem quadrantes cadastrados" };
    let total = 0, def = 0;
    const setores = quads.map((q) => {
      const t = Number(q.total) || 0, dfc = Number(q.deficientes) || 0;
      total += t; def += dfc;
      return { nome: q.nome || q.label || q.id || "—", total: t, deficientes: dfc, pct: t ? Math.round(((t - dfc) / t) * 100) : null };
    });
    const pct = total ? Math.round(((total - def) / total) * 100) : null;
    // pior setor (menor %)
    const pior = setores.filter((s) => s.total > 0).sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101))[0] || null;
    return { ok: true, temDado: true, total, def, pct, setores, pior };
  } catch (e) { return { ok: false, temDado: false, motivo: "erro ao ler iluminação" }; }
}

// ── FONTE 4: Perimetral (roteada por projeto) ────────────────
async function coletarPerimetral(pid) {
  if (PERIMETRAL_RONDAS.includes(pid)) return coletarPerimetralRondas(pid);
  if (PERIMETRAL_COLECAO.includes(pid)) return coletarPerimetralColecao(pid);
  return { ok: false, temDado: false, motivo: "este projeto não possui teste perimetral" };
}
// Golgi: rondas_plantoes via índice rondas/{pid}
async function coletarPerimetralRondas(pid) {
  try {
    const idxSnap = await getDoc(doc(db, "rondas", pid));
    if (!idxSnap.exists()) return { ok: false, temDado: false, motivo: "sem plantões de ronda registrados" };
    const idx = idxSnap.data();
    const entradas = (idx.plantoes || []).filter((p) => !(idx.deletedIds || []).includes(p.id));
    if (!entradas.length) return { ok: false, temDado: false, motivo: "sem plantões no período" };
    // busca os plantões completos (com perimetral.zonas)
    const plantoes = await Promise.all(entradas.map(async (e) => {
      if (e.perimetral || e.rondas) return e; // formato antigo já completo
      try { const s = await getDoc(doc(db, "rondas_plantoes", e.id)); return s.exists() ? s.data() : e; }
      catch { return e; }
    }));
    const comPeri = plantoes.filter((p) => p.perimetral?.feito && (p.perimetral.zonas || []).length);
    if (!comPeri.length) return { ok: false, temDado: false, motivo: "nenhum teste perimetral com zonas no período" };
    // agrega por zona
    // Identidade estável = campo de nome legível, ou o id (UUID) apenas como CHAVE
    // interna de agrupamento (nunca exibida). O rótulo mostrado ao cliente segue a
    // mesma convenção do Relatório de Ronda: ordem fixa Z-01..Z-0n. Se houver nome
    // legível real no dado, ele tem prioridade sobre o rótulo derivado da ordem.
    const zonaStats = {};
    const nomeLegivel = (z) => z.nome || z.zona || z.label || null; // sem z.id
    let totalAcion = 0, okAcion = 0;
    comPeri.forEach((p) => {
      (p.perimetral.zonas || []).forEach((z, i) => {
        const chave = z.id || nomeLegivel(z) || `pos_${i}`; // agrupamento interno
        const st = (z.status || "ok").toLowerCase();
        if (!zonaStats[chave]) {
          zonaStats[chave] = { chave, ordem: i, nomeReal: nomeLegivel(z), total: 0, ruins: 0 };
        }
        // preserva a menor ordem observada (posição de cadastro) para rotular
        if (i < zonaStats[chave].ordem) zonaStats[chave].ordem = i;
        if (!zonaStats[chave].nomeReal) zonaStats[chave].nomeReal = nomeLegivel(z);
        zonaStats[chave].total++;
        totalAcion++;
        if (st === "ok") okAcion++;
        else zonaStats[chave].ruins++;
      });
    });
    const zonas = Object.values(zonaStats)
      .sort((a, b) => a.ordem - b.ordem)
      .map((z, idx) => ({
        ...z,
        // nome exibido: nome real do dado, senão Z-01..Z-0n pela ordem de cadastro
        nome: z.nomeReal || `Z-${String(idx + 1).padStart(2, "0")}`,
        pctFalha: z.total ? Math.round((z.ruins / z.total) * 100) : 0,
      }));
    const piorZona = zonas.filter((z) => z.ruins > 0).sort((a, b) => b.pctFalha - a.pctFalha)[0] || null;
    const pctOk = totalAcion ? Math.round((okAcion / totalAcion) * 100) : null;
    const totalRondas = plantoes.reduce((a, p) => a + ((p.rondas || []).length), 0);
    return { ok: true, temDado: true, fonte: "rondas", plantoes: comPeri.length, totalPlantoes: plantoes.length, totalRondas, pctOk, zonas, piorZona };
  } catch (e) { return { ok: false, temDado: false, motivo: "erro ao ler ronda perimetral" }; }
}
// P505: coleção perimetral/{pid}
async function coletarPerimetralColecao(pid) {
  try {
    const snap = await getDoc(doc(db, "perimetral", pid));
    if (!snap.exists()) return { ok: false, temDado: false, motivo: "sem dados perimetrais" };
    const testes = snap.data().testes || [];
    if (!testes.length) return { ok: false, temDado: false, motivo: "sem testes perimetrais" };
    const ult = [...testes].sort((a, b) => (b.data || "").localeCompare(a.data || ""))[0];
    const zonasObj = ult.zonas || {};
    const zonas = Object.entries(zonasObj).map(([nome, zv]) => {
      const st = (zv?.status || "ok").toLowerCase();
      return { nome, total: 1, ruins: st === "ok" ? 0 : 1, pctFalha: st === "ok" ? 0 : 100, status: st };
    });
    const ruins = zonas.filter((z) => z.ruins > 0);
    const pctOk = zonas.length ? Math.round(((zonas.length - ruins.length) / zonas.length) * 100) : null;
    const piorZona = ruins[0] || null;
    return { ok: true, temDado: true, fonte: "colecao", dataUlt: fmtDate(ult.data), pctOk, zonas, piorZona };
  } catch (e) { return { ok: false, temDado: false, motivo: "erro ao ler perimetral" }; }
}

// ── FONTE 5: Ronda Virtual (cco_ronda) ───────────────────────
// A Ronda Virtual é feita dentro do módulo CCO (AcessoCCO → RondaVirtual) e
// grava em cco_ronda/{pid} como registros[], cada turno com:
//   { id, tipo:"noturno"|"diurno", dataInicio, plantonista:{...},
//     arquivado, arquivadoEm, rondas:{ "<offsetMin>": { inicio, atrasada, naoExec } } }
// Regra (Marcio, 05/08/2026): agregar TODOS os turnos ARQUIVADOS (ciclos
// completos) do período; ignora o turno em aberto para não penalizar rondas
// que ainda vão ocorrer. previstas = buildSlotsRV(tipo,pid).length; feitas =
// slots com rondas[off].inicio; naoexec = rondas[off].naoExec.

// Cópia self-contained do buildSlots do RondaVirtual.jsx (não importa cruzado).
const RV_GRADE_ESPECIAL = ["P311A", "P311B"];
function buildSlotsRV(tipo, projectId) {
  const slots = [];
  const especial = RV_GRADE_ESPECIAL.includes(projectId);
  const desloc = (projectId === "P606") ? 1 : 0;
  if (tipo === "noturno") {
    const iniN = 18 + desloc;
    for (let h = iniN; h <= 22; h++) slots.push({ offsetMin: (h - iniN) * 60 });
    if (especial) {
      let off = (23 - iniN) * 60, cur = 23 * 60, fim = (24 + 5) * 60 + 30;
      while (cur <= fim) { slots.push({ offsetMin: off }); cur += 30; off += 30; }
    } else {
      let off = (23 - iniN) * 60, cur = 23 * 60, fim = (24 + 5 + desloc) * 60;
      while (cur <= fim) { slots.push({ offsetMin: off }); cur += 60; off += 60; }
    }
  } else {
    const iniD = 6 + desloc, fimD = 17 + desloc;
    for (let h = iniD; h <= fimD; h++) slots.push({ offsetMin: (h - iniD) * 60 });
  }
  return slots;
}

async function coletarRondaVirtual(pid) {
  try {
    const snap = await getDoc(doc(db, "cco_ronda", pid));
    if (!snap.exists()) return { ok: false, temDado: false, motivo: "sem dados de ronda virtual" };
    const regs = snap.data().turnos || [];  // ◀ o RondaVirtual grava o array como .turnos (não .registros)
    if (!regs.length) return { ok: false, temDado: false, motivo: "sem registros de ronda virtual" };

    // Só ciclos completos (turnos arquivados). Turno em aberto não conta.
    const arquivados = regs.filter((t) => t && t.arquivado);
    if (!arquivados.length) {
      return { ok: false, temDado: false, motivo: "sem turnos de ronda concluídos (arquivados) no período" };
    }

    let previstas = 0, feitas = 0, naoexec = 0, semJustif = 0;
    for (const t of arquivados) {
      const slots = buildSlotsRV(t.tipo, pid);
      const rondas = t.rondas || {};
      for (const s of slots) {
        previstas += 1;
        const reg = rondas[String(s.offsetMin)];
        if (reg && reg.inicio) {
          feitas += 1;
          if (reg.atrasada && !(reg.justificativa || "").trim()) semJustif += 1;
        } else if (reg && reg.naoExec) {
          naoexec += 1;
          if (!(reg.justificativa || "").trim()) semJustif += 1;
        }
      }
    }

    const pct = previstas ? Math.round((feitas / previstas) * 100) : null;
    // data do turno arquivado mais recente (dataInicio; tolera legado .data)
    const ordenados = arquivados
      .slice()
      .sort((a, b) => (b.dataInicio || b.data || "").localeCompare(a.dataInicio || a.data || ""));
    const dataUlt = fmtDate(ordenados[0]?.dataInicio || ordenados[0]?.data);

    return {
      ok: true, temDado: true, fonte: "cco_ronda",
      turnos: arquivados.length, previstas, feitas, naoexec, semJustif, pct, data: dataUlt,
    };
  } catch (e) { return { ok: false, temDado: false, motivo: "erro ao ler ronda virtual" }; }
}

// ── FONTE 6: Energia ─────────────────────────────────────────
async function coletarEnergia(pid) {
  try {
    const snap = await getDoc(doc(db, "energia_ocorrencias", pid));
    if (!snap.exists()) return { ok: false, temDado: false, motivo: "sem ocorrências de energia" };
    const eventos = snap.data().eventos || [];
    if (!eventos.length) return { ok: true, temDado: true, quedas: 0, aberto: false, graves: [] };
    const corte30 = Date.now() - 30 * 86400000;
    const noPeriodo = eventos.filter((e) => e.inicioQueda && new Date(e.inicioQueda).getTime() >= corte30);
    const aberto = eventos.some((e) => !e.concluido);
    const abertoEv = eventos.find((e) => !e.concluido) || null;
    // graves = duração longa ou ainda aberto
    const graves = eventos.filter((e) => {
      if (!e.concluido) return true;
      if (e.inicioQueda && e.fimQueda) {
        const dur = (new Date(e.fimQueda) - new Date(e.inicioQueda)) / 3600000;
        return dur >= 2;
      }
      return false;
    }).map((e) => ({
      inicio: fmtISOdate(e.inicioQueda), aberto: !e.concluido,
      diasAberto: !e.concluido ? daysSinceISO(e.inicioQueda) : null,
    }));
    return { ok: true, temDado: true, quedas: noPeriodo.length, aberto, graves, abertoDesde: abertoEv ? fmtISOdate(abertoEv.inicioQueda) : null };
  } catch (e) { return { ok: false, temDado: false, motivo: "erro ao ler energia" }; }
}

// ── FONTE 7: Equipe ──────────────────────────────────────────
async function coletarEquipe(pid) {
  try {
    const snap = await getDoc(doc(db, "equipes", pid));
    if (!snap.exists()) return { ok: false, temDado: false, motivo: "sem equipe cadastrada" };
    const colabs = (snap.data().colaboradores || []).filter((c) => (c.status || "ativo") !== "desligado");
    if (!colabs.length) return { ok: false, temDado: false, motivo: "sem colaboradores ativos" };
    let brigadaNaoAplicada = 0, reciclagemVencida = 0, reciclagemAlerta = 0;
    colabs.forEach((c) => {
      const temBrigada = (c.historico || []).some((h) =>
        (h.tipo === "Treinamento" || /brigada/i.test(h.tipo || "")) && /brigada/i.test(h.label || "") && !/n[ãa]o aplicad/i.test(h.label || ""));
      const marcadaNaoAplicada = (c.historico || []).some((h) => /brigada/i.test(h.label || "") && /n[ãa]o aplicad/i.test(h.label || ""));
      if (!temBrigada || marcadaNaoAplicada) brigadaNaoAplicada++;
      // reciclagem: ciclo 2 anos, alerta 45 dias
      if (c.ultimaReciclagem) {
        const d = daysSince(c.ultimaReciclagem);
        if (d != null) {
          const diasPara2Anos = 730 - d;
          if (diasPara2Anos < 0) reciclagemVencida++;
          else if (diasPara2Anos <= 45) reciclagemAlerta++;
        }
      }
    });
    // Perfil de Segurança consolidado em equipes/{pid}.perfilSeguranca
    // (Equipe.jsx): { tipoEquipe:"vspp"|"vigilantes"|"mista", armada:"sim"|"nao"|"", ccoDedicada:"sim"|"nao"|"" }
    const perfilSeguranca = snap.data().perfilSeguranca || { tipoEquipe:"", armada:"", ccoDedicada:"" };
    return { ok: true, temDado: true, total: colabs.length, brigadaNaoAplicada, reciclagemVencida, reciclagemAlerta, perfilSeguranca };
  } catch (e) { return { ok: false, temDado: false, motivo: "erro ao ler equipe" }; }
}

// ── MODULADOR DE EQUIPE (perfilSeguranca) ────────────────────
// Regra B (Marcio, 05/08/2026): a COMBINAÇÃO decide 1 degrau, não a soma.
//   Perfil FORTE  (armada=sim E ccoDedicada=sim E tipo∈{vspp,mista})  → -1 nível
//   Perfil FRÁGIL (armada=nao E ccoDedicada=nao)                       → +1 nível
//   Qualquer combinação intermediária                                 →  0 (neutro)
// Retorna { delta:-1|0|1, motivo, forte, fragil }. Perfil não preenchido = neutro.
function calcularModuladorEquipe(perfil) {
  const p = perfil || {};
  const armadaSim = p.armada === "sim";
  const armadaNao = p.armada === "nao";
  const ccoSim    = p.ccoDedicada === "sim";
  const ccoNao    = p.ccoDedicada === "nao";
  const tipoForte = p.tipoEquipe === "vspp" || p.tipoEquipe === "mista";
  const forte  = armadaSim && ccoSim && tipoForte;
  const fragil = armadaNao && ccoNao;
  if (forte)  return { delta: -1, forte: true,  fragil: false, motivo: "equipe armada com CCO dedicada" };
  if (fragil) return { delta:  1, forte: false, fragil: true,  motivo: "equipe desarmada sem CCO dedicada" };
  return { delta: 0, forte: false, fragil: false, motivo: "perfil de equipe intermediário/incompleto" };
}

// -- Logo MOKED (base64) --
const MOKED_LOGO = "data:image/jpeg;base64,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GOgaPLAwspxWm29uWOXjjjenFfq+/wDO0abGuEmmNUkv5v7aLkAc5xmXv/QtW2kpfqrd/UtruG4FxbcI7xVvFgqHRtNaxzWltRgjLu/Qjp0U7U1JTUbHspKaGBsjjI8RMDOZ5+0447k4HVfy630D7m25OoaQ1jG8rarwW+MB6B+MgKIw68v4bp6hE2yxrtfX9oR/eblVRcU2k7W2VgpJrHXTyNMbS4vbIzlIcfeGBnoDheHuHLqq7b4W/Sdn1lcdPUR07PdJDRBhdJLHKQM8w7Y74UvOo6V1ZHWOp4vao2ljZiwF7Wnu0O7gLDqKjfVtrJKWF9S1hiEzowXhp7jm74OT07KZxzMTG2GHn1xzWde1dNH2/wBVXvUHDvbdVVLI6u8SWyWUtb9maaMvY3p+0WNOB5nCiPb/AFxdazWeg5nboVl4uWoZpRerBK1hZSFsUjuVjQOaLlc3lwftYVloKemoqFtLR00UELGkMiiaGtZk590DoOvXK0xu1tkdu03XlTWVEtRC4yUlE2NkcFNIY+R0g5QHPe7r1cTjJwsL479tS6OPzOPT1fUjUTuYmP8AH7N47nuiIulSCIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiBnKIiB6JlEQEREBERABwMJlEQEREGc9FhEQMIiICZwiIGUREBMoiAiIgIiIR2kREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERB//9k=";

// ═════════════════════════════════════════════════════════════
// CONSOLIDAÇÃO — transforma os dados das 7 fontes em VETORES de risco
// Cada vetor: { chave, label, nivel, fonteCredito, sinceTxt, diasTxt,
//   descricao, impactoCruzado, camposupervisorKey, preponderante }
// ═════════════════════════════════════════════════════════════

// Monta vetores a partir do Teste Semanal (agrupando por ponto físico).
function vetoresDoTesteSemanal(ts, dataUlt) {
  if (!ts?.ok || !ts.pend?.length) return [];
  // v2 (motor riscoConfig): nível por CATEGORIA via classificarVetor.
  // Cada vetor guarda nivelMoked e nivelCliente (Moked = Cliente + 1, feito
  // no consolidarSite; aqui guardamos o nível-base e o flag incluir/soMoked).
  const porCat = {};
  for (const p of ts.pend) {
    const chave = `cat:${p.catLabel}`;
    if (!porCat[chave]) porCat[chave] = { catLabel: p.catLabel, itens: [], preponderante: p.preponderante };
    porCat[chave].itens.push(p);
    if (p.preponderante) porCat[chave].preponderante = true;
  }
  const out = [];
  for (const g of Object.values(porCat)) {
    const aggc = (ts.catAgg && ts.catAgg[g.catLabel]) || { total: g.itens.length, inop: g.itens.length, piorDias: null };
    let piorDias = aggc.piorDias, piorItem = null;
    for (const it of g.itens) if (it.dias != null && (piorDias == null || it.dias >= piorDias)) { piorDias = it.dias; piorItem = it; }
    if (!piorItem) piorItem = g.itens[0];

    const rc = classificarVetor({
      pid: ts.pid, labelCategoria: g.catLabel, labelItem: piorItem?.itemLabel || "",
      inop: aggc.inop, total: aggc.total, dias: piorDias, escopo: "moked",
    });
    if (rc.incluir === false && rc.nivel <= RC_NIVEL.SEMDADOS) continue; // fora do score

    const it = piorItem;
    const outros = g.itens.length > 1 ? ` (+${g.itens.length - 1} ponto${g.itens.length - 1 > 1 ? "s" : ""} do mesmo conjunto)` : "";
    const propTxt = aggc.total ? ` — ${aggc.inop} de ${aggc.total}` : "";
    const sinceTxt = it?.since ? `inoperante desde ${fmtDate(it.since)}` : null;
    out.push({
      chave: `cat:${g.catLabel}`, label: g.catLabel,
      nivel: rc.nivel, classeV2: rc.classe, incluirCliente: rc.incluir !== false,
      bloqueadorCaido: !!rc.bloqueadorCaido, // v3: contagem de bloqueadores
      preponderante: g.preponderante, piorDias, qtd: g.itens.length,
      fonteCredito: `Teste Semanal · ${dataUlt}`, sinceTxt,
      descricao: `${it?.itemLabel ? `<b>${it.itemLabel}</b>` : "Conjunto"} ${(it?.status || "inoperante").toLowerCase()} ${piorDias != null ? `há ${piorDias} dias` : "recentemente"}${outros}${propTxt}. <i>${rc.motivo || ""}</i>`,
      note: it?.note || "", grupo: "teste",
    });
  }
  return out;
}

// Vetor CTMK (fonte painel).
function vetorCTMK(ctmk) {
  if (!ctmk?.ok || !ctmk.offline) return null;
  const dias = ctmk.dias;
  // v3: CTMK é TÁTICO (teto ELEVADO), não bloqueador. Offline = perda de
  // cobertura de imagem = vetor ELEVADO; não estoura o site sozinho.
  const nivel = NIVEIS.ELEVADO;
  return {
    chave: "ctmk", label: "CTMK — central de câmera Moked", nivel, preponderante: true,
    bloqueadorCaido: false,
    piorDias: dias, qtd: 1,
    fonteCredito: "Monitor CTMK · painel",
    sinceTxt: ctmk.desde ? `off-line desde ${fmtDate(ctmk.desde)}` : null,
    descricao: `Central de câmera Moked (CTMK) <b>off-line ${dias != null ? `há ${dias} dias` : ""} sem imagem</b> — perda de cobertura de contexto. Vetor crítico de vigilância eletrônica.`,
    impactoCruzado: null, // preenchido no cruzamento (depende de ronda virtual)
    grupo: "ctmk",
  };
}

// Vetor Iluminação (pior setor).
function vetorIluminacao(ilum) {
  if (!ilum?.ok || !ilum.pior) return null;
  const pior = ilum.pior;
  // nível por gravidade do déficit
  let nivel = NIVEIS.BAIXO;
  if (pior.pct != null) {
    if (pior.pct < 50) nivel = NIVEIS.ELEVADO;
    else if (pior.pct < 80) nivel = NIVEIS.MODERADO;
  }
  return {
    chave: "iluminacao", label: `Iluminação — quadrante ${pior.nome}`, nivel, preponderante: false,
    piorDias: null, qtd: 1,
    fonteCredito: "Iluminação",
    sinceTxt: null,
    descricao: `Quadrante ${pior.nome} com apenas <b>${pior.pct}% operante</b> (${pior.deficientes} de ${pior.total} pontos deficientes). Iluminação geral do projeto em ${ilum.pct}%.`,
    impactoCruzado: `baixa iluminação no ${pior.nome} <b>degrada a eficácia do CFTV noturno exatamente nessa região</b> e reduz a dissuasão perimetral — dois sistemas afetados por uma causa.`,
    impactoFontes: "Iluminação + CFTV",
    grupo: "iluminacao",
  };
}

// Vetor Perimetral (pior zona).
function vetorPerimetral(peri) {
  if (!peri?.ok || !peri.piorZona) return null;
  const z = peri.piorZona;
  // v3: perímetro é BLOQUEADOR. Zona perimetral em falha satura em ELEVADO
  // no vetor; a subida a CRÍTICO só vem da contagem (2+ bloqueadores).
  let nivel = NIVEIS.ELEVADO;
  const bloqueadorCaido = true;
  const base = peri.fonte === "rondas"
    ? `Teste perimetral com <b>${peri.pctOk}% de acionamentos OK</b> em ${peri.plantoes} plantões; falhas concentradas na <b>${z.nome}</b> (${z.pctFalha}% de falha).`
    : `Teste perimetral (${peri.dataUlt}) com <b>${peri.pctOk}% OK</b>; <b>${z.nome}</b> com falha registrada.`;
  return {
    chave: "perimetral", label: `Perímetro eletrônico — ${z.nome}`, nivel, preponderante: true,
    bloqueadorCaido, piorDias: null, qtd: 1,
    fonteCredito: "Ronda Perimetral",
    sinceTxt: null,
    descricao: base,
    impactoCruzado: `mesmo com ronda física consistente, uma zona perimetral com falha representa <b>vulnerabilidade apontada</b> que a presença humana cobre apenas em parte.`,
    impactoFontes: "Ronda Perimetral",
    grupo: "perimetral",
  };
}

// Vetor Energia (se houver evento aberto ou grave).
function vetorEnergia(en) {
  if (!en?.ok || (!en.aberto && !(en.graves || []).length)) return null;
  let nivel = en.aberto ? NIVEIS.ELEVADO : NIVEIS.MODERADO;
  const desc = en.aberto
    ? `Ocorrência de energia <b>em aberto</b>${en.abertoDesde ? ` desde ${en.abertoDesde}` : ""}. ${en.quedas} queda(s) nos últimos 30 dias.`
    : `${en.graves.length} ocorrência(s) grave(s) de energia no período; ${en.quedas} queda(s) nos últimos 30 dias.`;
  return {
    chave: "energia", label: "Fornecimento de energia", nivel, preponderante: false,
    piorDias: null, qtd: (en.graves || []).length,
    fonteCredito: "Ocorrências de Energia",
    sinceTxt: en.abertoDesde ? `em aberto desde ${en.abertoDesde}` : null,
    descricao: desc,
    impactoCruzado: `interrupções de energia afetam diretamente <b>CFTV, controle de acesso e iluminação</b> simultaneamente — impacto sistêmico enquanto não estabilizado.`,
    impactoFontes: "Energia + CFTV + Acessos",
    grupo: "energia",
  };
}

// Vetor Equipe (brigada/reciclagem).
// v3 (11/08): capacitação de brigada NÃO pondera e NÃO entra no documento
// ("vigilante não é bombeiro"). Mantido como no-op para não quebrar chamadas.
function vetorEquipe(eq) {
  return null;
  // ── código legado desativado (brigada fora do score/documento) ──
  // eslint-disable-next-line no-unreachable
  if (!eq?.ok) return null;
  if (!eq.brigadaNaoAplicada && !eq.reciclagemVencida) return null;
  let nivel = NIVEIS.MODERADO;
  if (eq.reciclagemVencida > 0 || eq.brigadaNaoAplicada >= Math.ceil(eq.total / 2)) nivel = NIVEIS.ELEVADO;
  const partes = [];
  if (eq.brigadaNaoAplicada) partes.push(`brigada não aplicada para ${eq.brigadaNaoAplicada} colaborador(es)`);
  if (eq.reciclagemVencida) partes.push(`${eq.reciclagemVencida} reciclagem(ns) vencida(s)`);
  if (eq.reciclagemAlerta) partes.push(`${eq.reciclagemAlerta} próxima(s) do vencimento`);
  return {
    chave: "equipe", label: "Efetivo — capacitação", nivel, preponderante: false,
    piorDias: null, qtd: eq.total,
    fonteCredito: "Mapa de Equipe",
    sinceTxt: null,
    descricao: `Efetivo de ${eq.total} colaboradores. Pendências: ${partes.join("; ")}.`,
    impactoCruzado: `capacitação incompleta compromete a <b>prontidão de resposta a emergências</b> e a adequação normativa até regularização.`,
    impactoFontes: "Mapa de Equipe",
    grupo: "equipe",
  };
}

// Aplica cruzamentos que dependem de mais de uma fonte.
function aplicarCruzamentos(vetores, dados) {
  const rv = dados.rondaVirtual;
  const ctmkVet = vetores.find((v) => v.grupo === "ctmk");
  if (ctmkVet) {
    if (rv?.ok && rv.temDado) {
      ctmkVet.impactoCruzado = `por estar entre as câmeras cobertas pela ronda virtual, sua ausência de imagem <b>abre um ponto cego na rota de verificação</b> — a ronda virtual segue rodando (${rv.pct}%), mas sem cobrir este ângulo.`;
      ctmkVet.impactoFontes = "CFTV + Ronda Virtual";
    } else {
      ctmkVet.impactoCruzado = `câmera de contexto sem imagem <b>reduz a cobertura visual</b> do parque de CFTV enquanto não restabelecida.`;
      ctmkVet.impactoFontes = "CFTV";
    }
  }
  return vetores;
}

// Consolidação do risco geral.
function consolidarRiscoGeral(vetores, modulador) {
  const criticos = vetores.filter((v) => v.nivel === NIVEIS.CRITICO);
  const prepCriticos = criticos.filter((v) => v.preponderante);
  let label = "BAIXO", cor = MOKED.baixo;
  const temAcimaModerado = vetores.some((v) => v.nivel >= NIVEIS.ELEVADO);
  if (criticos.length >= 5 || prepCriticos.length >= 2) { label = "ALTO"; cor = MOKED.critico; }
  else if (criticos.length >= 3) { label = "MÉDIO-ALTO"; cor = MOKED.elevado; }
  else if (prepCriticos.length >= 1 || criticos.length >= 1) { label = "MÉDIO"; cor = MOKED.elevado; }
  else if (temAcimaModerado) { label = "MODERADO"; cor = MOKED.elevado; }

  // ── MODULADOR DE EQUIPE (perfilSeguranca) — Regra B, com PISO ──────────
  // Ordem consolidada: BAIXO(0) < MODERADO(1) < MÉDIO(1) < MÉDIO-ALTO(2)
  //                    < ELEVADO(2) < ALTO(3). Trabalhamos por índice.
  const ORDEM  = ["BAIXO", "MODERADO", "MÉDIO", "MÉDIO-ALTO", "ELEVADO", "ALTO"];
  const CORDEM = { "BAIXO": MOKED.baixo, "MODERADO": MOKED.elevado, "MÉDIO": MOKED.elevado,
                   "MÉDIO-ALTO": MOKED.elevado, "ELEVADO": MOKED.elevado, "ALTO": MOKED.critico };
  const delta = modulador ? (modulador.delta || 0) : 0;
  let moduladoAplicado = null;
  if (delta !== 0) {
    let idx = ORDEM.indexOf(label); if (idx < 0) idx = 0;
    let novoIdx = Math.max(0, Math.min(ORDEM.length - 1, idx + delta));

    // PISO INVIOLÁVEL: o modulador NUNCA rebaixa um quadro que tem vetor
    // crítico preponderante (pânico fixo/Bloqueador, via-única sem redundância,
    // perímetro totalmente desconfigurado) OU qualquer crítico. Mínimo = MÉDIO.
    if (delta < 0) {
      const pisoMedio = (prepCriticos.length >= 1 || criticos.length >= 1);
      if (pisoMedio) {
        const idxMedio = ORDEM.indexOf("MÉDIO");
        if (novoIdx < idxMedio) novoIdx = idxMedio;
      }
    }
    if (novoIdx !== idx) {
      const antigo = label;
      label = ORDEM[novoIdx];
      cor = CORDEM[label] || cor;
      moduladoAplicado = { de: antigo, para: label, delta, motivo: modulador.motivo };
    } else {
      // aplicável mas travado pelo piso (ou já no extremo)
      moduladoAplicado = { de: label, para: label, delta, motivo: modulador.motivo, travadoPeloPiso: delta < 0 };
    }
  }

  return { label, cor, criticos: criticos.length, prepCriticos: prepCriticos.length, modulador: moduladoAplicado };
}

// Recomendações automáticas (dos vetores >= elevado).
function gerarRecomendacoes(vetores) {
  const recs = [];
  for (const v of vetores.filter((x) => x.nivel >= NIVEIS.ELEVADO).sort((a, b) => b.nivel - a.nivel)) {
    const alvo = v.label.replace(/^\d+\s*-\s*/, "").replace(/^(Acesso|Perímetro eletrônico —|Iluminação —|CTMK —)\s*/i, "");
    const dtxt = v.piorDias != null ? ` (há ${v.piorDias} dias)` : "";
    recs.push({ texto: `Restabelecer / regularizar ${v.label.toLowerCase()}${dtxt}.`, nivel: v.nivel });
  }
  return recs;
}

// prob/impacto por nível (para a matriz).
function probImpacto(v) {
  if (v.nivel === NIVEIS.CRITICO) return { prob: "Alta", impacto: "Alto" };
  if (v.nivel === NIVEIS.ELEVADO) return v.preponderante ? { prob: "Alta", impacto: "Médio" } : { prob: "Média", impacto: "Médio" };
  if (v.nivel === NIVEIS.MODERADO) return { prob: "Média", impacto: "Médio" };
  return { prob: "Baixa", impacto: "Baixo" };
}

// ═════════════════════════════════════════════════════════════
// GERADOR DE PDF — visual MOKED aprovado (cabeçalho grafite, logo
// grande, medidor de risco, timeline de exposição, impacto cruzado,
// campos de supervisor que só aparecem se preenchidos).
// ═════════════════════════════════════════════════════════════

// escapeHTML simples
const esc = (s) => String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

const NIVEL_PILL_CLASS = { 4: "b-crit", 3: "b-elev", 2: "b-mod", 1: "b-baixo" };

function gerarHTMLAnaliseRisco(ctx) {
  const {
    project, pacoteLabel, vetores, geral, recomendacoes, fontesUsadas,
    ts, ctmk, ilum, rondaVirtual, contextos,
  } = ctx;
  // Nº do documento: usa o sequencial fixo (ctx.ref) quando resolvido;
  // fallback ao formato antigo se por algum motivo não vier injetado.
  const ref = ctx.ref || `MK-${project.id.replace(/\D/g, "") || "000"}-AR-0001`;
  const hoje = hojeBR();
  const nCrit = vetores.filter((v) => v.nivel === NIVEIS.CRITICO).length;
  const nElev = vetores.filter((v) => v.nivel === NIVEIS.ELEVADO).length;

  // período: do relatório mais antigo ao mais recente (aproximação via teste semanal)
  const periodo = ts?.dataRaw ? `até ${fmtDate(ts.dataRaw)}` : hoje;

  // KPIs
  const saudePct = ts?.pct != null ? ts.pct : "—";
  const ilumPct = ilum?.ok ? ilum.pct : null;

  // Timeline: só vetores críticos/elevados com dias (ordena por dias desc)
  const comDias = vetores.filter((v) => v.nivel >= NIVEIS.ELEVADO && v.piorDias != null).sort((a, b) => b.piorDias - a.piorDias);
  const maxDias = comDias.length ? Math.max(...comDias.map((v) => v.piorDias), 90) : 90;
  const timelineRows = comDias.map((v) => {
    const w = Math.max(8, Math.round((v.piorDias / maxDias) * 100));
    const cls = v.nivel === NIVEIS.CRITICO ? "f-crit" : "f-elev";
    const desde = v.sinceTxt ? v.sinceTxt.replace(/^(inoperante|off-line|em aberto) desde /, "desde ") : "";
    return `<div class="tlrow"><div class="tll">${esc(v.label.replace(/ —.*/, ""))}<small>${esc(desde)}</small></div><div class="tlbar"><div class="fill ${cls}" style="width:${w}%">${v.piorDias} dias</div></div></div>`;
  }).join("");
  // marcador do limiar crítico (90 dias) na régua
  const limiarPct = Math.min(100, Math.round((90 / maxDias) * 100));

  // medidor de risco — mapeado pelo NÍVEL NUMÉRICO real (não pela string),
  // para o ponteiro sempre bater com o RISCO GERAL exibido. Escala v2:
  //   BAIXO(1)→0 · MODERADO(2)→1(MÉDIO) · ELEVADO(3)→2 · CRÍTICO(4)/CRÍTICO II(5)→3
  const nivelGeral = geral.nivel ?? geral.nivelMoked ?? 1; // 1..4 (v3)
  const geralIdx = nivelGeral >= 4 ? 3 : nivelGeral >= 3 ? 2 : nivelGeral >= 2 ? 1 : 0;
  const escalaOrder = ["BAIXO", "MÉDIO", "ELEVADO", "CRÍTICO"];
  const escalaHTML = escalaOrder.map((lb, i) => `<div class="s${i + 1}${i === geralIdx ? " on" : ""}">${lb}</div>`).join("");
  const markerLeft = (geralIdx * 25 + 12.5).toFixed(2);

  // KPIs efetivo
  const efetivo = ctx.equipe?.ok ? ctx.equipe.total : null;

  // destaques
  const destCrit = vetores.filter((v) => v.nivel === NIVEIS.CRITICO).map((v) => v.label.replace(/ —.*/, "") + (v.piorDias != null ? ` há ${v.piorDias} dias` : "")).join(". ");
  const destElev = vetores.filter((v) => v.nivel === NIVEIS.ELEVADO).map((v) => v.label.replace(/ —.*/, "")).join(", ");

  // base documental (só fontes usadas)
  const fontesLinhas = fontesUsadas.map((f, i) => `<div class="fonte"><span class="fn">${i + 1}</span><div class="fc"><div class="ft">${esc(f.titulo)}</div><div class="fd">${f.detalhe}</div></div></div>`).join("");

  // vetores (panorama)
  const vetoresHTML = vetores.length ? vetores.map((v) => {
    const pill = NIVEL_PILL_CLASS[v.nivel] || "b-baixo";
    const sinceTag = v.sinceTxt ? `<span class="vsince">${esc(v.sinceTxt)}</span>` : "";
    const cred = `<span class="cred">${esc(v.fonteCredito)}</span>`;
    const impacto = v.impactoCruzado
      ? `<div class="impacto">↳ <b>${v.impactoFontes && /\+/.test(v.impactoFontes) ? "Impacto cruzado:" : "Impacto:"}</b> ${v.impactoCruzado}${v.impactoFontes ? ` <span class="xfonte">Fonte: ${esc(v.impactoFontes)}.</span>` : ""}</div>`
      : "";
    // contexto de campo — só aparece se preenchido
    const ctxTxt = contextos?.[v.chave];
    const campo = ctxTxt && ctxTxt.trim() ? `<div class="campo">✎ <b>Contexto de campo:</b> ${esc(ctxTxt.trim())}</div>` : "";
    return `<div class="vet"><div class="vet-h"><span class="vt">${esc(v.label)}</span>${sinceTag}<span class="badge ${pill}">${NIVEL_LABEL[v.nivel]}</span></div>
      <p>${v.descricao} ${cred}</p>${impacto}${campo}</div>`;
  }).join("") : `<p style="font-size:11px;color:${MOKED.cinza}">Nenhuma pendência de risco registrada nas fontes selecionadas — sistemas verificados operantes no período.</p>`;

  // matriz
  const matrizLinhas = vetores.map((v) => {
    const pi = probImpacto(v);
    const pill = NIVEL_PILL_CLASS[v.nivel] || "b-baixo";
    const sit = v.descricao.replace(/<[^>]+>/g, "");
    return `<tr><td><div class="vname">${esc(v.label.replace(/ —.*/, ""))}</div><div class="vsrc">${esc(v.fonteCredito.replace(/ ·.*/, ""))}</div></td><td>${esc(sit.slice(0, 90))}</td><td class="c">${pi.prob}</td><td class="c">${pi.impacto}</td><td class="c"><span class="pill ${pill}">${NIVEL_LABEL[v.nivel]}</span></td></tr>`;
  }).join("");

  // recomendações
  const recsHTML = recomendacoes.length ? recomendacoes.map((r) => {
    const pill = NIVEL_PILL_CLASS[r.nivel] || "b-mod";
    return `<div class="rec"><div class="rc"><b>${esc(r.texto)}</b><span class="rp ${pill}">${NIVEL_LABEL[r.nivel]}</span></div></div>`;
  }).join("") : `<div class="rec"><div class="rc">Nenhuma recomendação prioritária — nenhum vetor em nível elevado ou crítico no período.</div></div>`;

  const nFontes = fontesUsadas.length;

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${ref} · ${project.id}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=Inter:wght@400;500;600;700;800&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#e7ebe9;font-family:'Inter',sans-serif;color:${MOKED.texto};-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{width:210mm;min-height:297mm;background:#fff;margin:16px auto;padding:0 0 24mm;box-shadow:0 2px 18px rgba(0,0,0,.14);position:relative;overflow:hidden}
  .hdr{background:${MOKED.grafite};color:#fff;padding:22px 26px 20px;display:flex;align-items:center;gap:18px;position:relative}
  .hdr::after{content:"";position:absolute;left:0;right:0;bottom:0;height:4px;background:linear-gradient(90deg,${MOKED.verde},${MOKED.verde2} 60%,#7fd8bd)}
  .hdr .logo{height:74px;width:auto;background:#fff;border-radius:8px;padding:8px 12px;flex-shrink:0}
  .hdr .titleblock{flex:1;min-width:0}
  .hdr .eyebrow{font-size:10px;letter-spacing:3.5px;font-weight:700;color:#7fd8bd;text-transform:uppercase}
  .hdr h1{font-family:'Newsreader',serif;font-size:26px;font-weight:600;line-height:1.1;margin:3px 0 2px}
  .hdr .sub{font-size:12px;color:#b9c6c2;font-weight:400}
  .hdr .refbox{text-align:right;font-size:10.5px;line-height:1.85;color:#c9d4d0;flex-shrink:0}
  .hdr .refbox b{color:#fff;font-weight:600}
  .hdr .refbox .ref{font-size:13px;font-weight:700;color:#7fd8bd;letter-spacing:.5px}
  .body{padding:26px 26px 0}
  .sec{margin-top:22px}
  .sec-h{display:flex;align-items:baseline;gap:10px;border-bottom:2px solid ${MOKED.verde};padding-bottom:6px;margin-bottom:13px}
  .sec-n{font-family:'Newsreader',serif;font-size:15px;font-weight:600;color:${MOKED.verde};font-variant-numeric:tabular-nums}
  .sec-t{font-size:14.5px;font-weight:700;color:${MOKED.texto};letter-spacing:.2px;text-transform:uppercase}
  .lead{font-size:11.5px;line-height:1.72;color:#39474d;text-align:justify}
  .lead b{color:${MOKED.texto};font-weight:600}
  .kpis{display:grid;grid-template-columns:1.25fr 1fr 1fr 1fr;gap:11px;margin:16px 0 4px}
  .kpi{border:1px solid ${MOKED.linha};border-radius:10px;padding:13px 14px}
  .kpi.risco{background:${MOKED.grafite};border-color:${MOKED.grafite}}
  .kpi .kl{font-size:8.5px;letter-spacing:1.4px;text-transform:uppercase;font-weight:700;color:${MOKED.cinza};margin-bottom:7px}
  .kpi.risco .kl{color:#8fa39d}
  .kpi .kv{font-family:'Newsreader',serif;font-size:26px;font-weight:600;line-height:.95;letter-spacing:-.5px}
  .kpi .kvu{font-size:12px;font-weight:500;color:${MOKED.cinza}}
  .kpi .ks{font-size:9px;color:${MOKED.cinza};margin-top:4px;font-weight:500}
  .kpi.risco .kv{color:#fff} .kpi.risco .ks{color:#8fa39d}
  .gauge{margin:18px 0 4px;border:1px solid ${MOKED.linha};border-radius:10px;padding:15px 18px}
  .gauge-top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:11px}
  .gauge-top .gt{font-size:9px;letter-spacing:1.4px;text-transform:uppercase;font-weight:700;color:${MOKED.cinza}}
  .gauge-top .gc{font-family:'Newsreader',serif;font-size:15px;font-weight:600;color:${MOKED.elevado}}
  .scale{display:flex;height:32px;border-radius:6px;overflow:hidden;position:relative}
  .scale div{flex:1;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;letter-spacing:.5px;color:#fff;opacity:.32}
  .scale div.on{opacity:1}
  .s1{background:${MOKED.baixo}} .s2{background:${MOKED.moderado}} .s3{background:${MOKED.elevado}} .s4{background:${MOKED.critico}}
  .scale .marker{position:absolute;top:-4px;bottom:-4px;width:3px;background:${MOKED.texto};box-shadow:0 0 0 2px #fff}
  .tl{margin-top:6px}
  .tlrow{display:flex;align-items:center;gap:11px;margin-bottom:9px}
  .tlrow .tll{width:120px;font-size:10px;font-weight:600;color:${MOKED.texto};text-align:right;flex-shrink:0;line-height:1.2}
  .tlrow .tll small{display:block;font-size:8px;color:${MOKED.cinza};font-weight:500}
  .tlbar{flex:1;height:20px;background:#f1f4f3;border-radius:4px;position:relative;overflow:hidden}
  .tlbar .fill{position:absolute;left:0;top:0;bottom:0;border-radius:4px;display:flex;align-items:center;padding-left:9px;font-size:9px;font-weight:800;color:#fff}
  .f-crit{background:${MOKED.critico}} .f-elev{background:${MOKED.elevado}}
  .tl-axis{display:flex;justify-content:space-between;font-size:8px;color:${MOKED.cinza};margin:5px 0 0 131px;font-weight:600}
  .panorama{margin-top:16px;background:#f6f9f8;border-left:3px solid ${MOKED.verde};border-radius:0 8px 8px 0;padding:12px 15px;font-size:11px;line-height:1.68;color:#39474d}
  .panorama b{color:${MOKED.texto};font-weight:600}
  .dest{margin-top:13px;display:flex;flex-direction:column;gap:7px}
  .drow{display:flex;gap:12px;align-items:flex-start;padding:9px 13px;border-radius:8px;font-size:10.5px;line-height:1.55}
  .drow .dt{font-size:8.5px;font-weight:800;letter-spacing:.9px;min-width:62px;padding-top:1px}
  .d-pos{background:#eef7f2;color:#2f4f42} .d-pos .dt{color:${MOKED.verde}}
  .d-att{background:#fdf6e9;color:#5c481f} .d-att .dt{color:${MOKED.elevado}}
  .d-cri{background:#fbeeec;color:#5e2019} .d-cri .dt{color:${MOKED.critico}}
  .fontes{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:2px}
  .fonte{display:flex;gap:11px;align-items:flex-start;border:1px solid ${MOKED.linha};border-radius:8px;padding:10px 12px}
  .fonte .fn{font-family:'Newsreader',serif;font-size:16px;font-weight:600;color:${MOKED.verde};line-height:1;flex-shrink:0;width:20px}
  .fonte .fc .ft{font-size:10.5px;font-weight:700;color:${MOKED.texto};line-height:1.25}
  .fonte .fc .fd{font-size:9.5px;color:${MOKED.cinza};margin-top:3px;line-height:1.45}
  .vet{border:1px solid ${MOKED.linha};border-radius:10px;padding:14px 16px;margin-bottom:12px}
  .vet-h{display:flex;align-items:center;gap:9px;margin-bottom:8px}
  .vet-h .vt{font-size:12px;font-weight:700;color:${MOKED.texto};flex:1}
  .vet-h .vsince{font-size:9px;color:${MOKED.cinza};font-weight:600}
  .badge{font-size:8px;font-weight:800;letter-spacing:.8px;padding:3px 9px;border-radius:20px;color:#fff}
  .b-crit{background:${MOKED.critico}} .b-elev{background:${MOKED.elevado}} .b-mod{background:${MOKED.moderado}} .b-baixo{background:${MOKED.baixo}}
  .vet p{font-size:10.5px;line-height:1.62;color:#3a484e}
  .cred{display:inline-flex;align-items:center;gap:4px;font-size:8.5px;font-weight:600;color:${MOKED.verde};background:#eef7f2;border-radius:4px;padding:1px 6px;white-space:nowrap;vertical-align:middle}
  .impacto{margin-top:9px;padding:9px 12px;background:#faf9f6;border-left:2px solid ${MOKED.elevado};border-radius:0 6px 6px 0;font-size:9.8px;line-height:1.58;color:#4a463a}
  .impacto b{color:${MOKED.critico};font-weight:700}
  .impacto .xfonte{color:#8a7a3a;font-weight:600}
  .campo{margin-top:8px;font-size:9.8px;color:#3a484e;background:#eef7f2;border-left:2px solid ${MOKED.verde};border-radius:0 6px 6px 0;padding:8px 12px;line-height:1.55}
  .campo b{color:${MOKED.verde};font-weight:700}
  table{width:100%;border-collapse:collapse;font-size:10px;margin-top:2px}
  thead th{background:${MOKED.grafite};color:#fff;font-size:8.5px;letter-spacing:.6px;text-transform:uppercase;font-weight:700;padding:9px 10px;text-align:left}
  thead th.c{text-align:center}
  tbody td{padding:10px;border-bottom:1px solid ${MOKED.linha};line-height:1.4;vertical-align:middle}
  tbody tr:nth-child(even){background:#f8fbfa}
  td .vname{font-weight:700;color:${MOKED.texto};font-size:10px}
  td .vsrc{font-size:8px;color:${MOKED.verde};font-weight:600;margin-top:2px}
  td.c{text-align:center;font-weight:600}
  .pill{font-size:8px;font-weight:800;letter-spacing:.5px;padding:3px 9px;border-radius:20px;color:#fff;display:inline-block}
  .crit-note{margin-top:10px;font-size:9px;color:${MOKED.cinza};line-height:1.5;font-style:italic}
  .recs{counter-reset:r}
  .rec{display:flex;gap:13px;align-items:flex-start;padding:12px 4px;border-bottom:1px solid ${MOKED.linha}}
  .rec:last-child{border-bottom:none}
  .rec::before{counter-increment:r;content:counter(r);font-family:'Newsreader',serif;font-size:17px;font-weight:600;color:${MOKED.verde};min-width:24px;text-align:center;line-height:1.2}
  .rec .rc{font-size:10.5px;line-height:1.55;color:#3a484e}
  .rec .rc b{color:${MOKED.texto};font-weight:600}
  .rp{display:inline-block;font-size:7.5px;font-weight:800;letter-spacing:.5px;padding:2px 7px;border-radius:20px;margin-left:7px;vertical-align:1px;color:#fff}
  .metod{margin-top:22px;background:#f6f9f8;border:1px solid ${MOKED.linha};border-radius:9px;padding:14px 17px;font-size:9px;line-height:1.6;color:#4a565b}
  .metod b{color:${MOKED.verde};font-weight:700}
  .metod .mt{font-size:10px;font-weight:700;color:${MOKED.texto};margin-bottom:5px}
  .assina{margin-top:18px;padding-top:14px;border-top:2px solid ${MOKED.verde};font-size:9.5px;line-height:1.6;color:#4a565b}
  .assina b{color:${MOKED.texto}}
  .assina .inst{margin-top:6px;font-size:8.8px;color:${MOKED.cinza}}
  .foot{position:absolute;bottom:0;left:0;right:0;padding:9px 26px;font-size:8px;color:#9aa8ac;border-top:1px solid ${MOKED.linha};display:flex;justify-content:space-between;background:#fff}
  @media print{body{background:#fff}.page{margin:0;box-shadow:none;width:auto;min-height:auto;page-break-after:always}.page:last-child{page-break-after:auto}@page{margin:0;size:A4}}
</style></head><body>

<div class="page">
  <div class="hdr"><img class="logo" src="${MOKED_LOGO}" alt="Moked">
    <div class="titleblock"><div class="eyebrow">Moked Consulting Security</div>
      <h1>Relatório Situacional de Segurança</h1>
      <div class="sub">${esc(project.id)} — ${esc(project.name)} · Análise de Risco do Condomínio</div></div>
    <div class="refbox"><div class="ref">${ref}</div><div><b>Período:</b> ${esc(periodo)}</div><div><b>Base:</b> ${nFontes} relatório(s) operacional(is)</div></div></div>
  <div class="body">
    <div class="sec" style="margin-top:20px">
      <div class="sec-h"><span class="sec-n">—</span><span class="sec-t">Resumo Executivo</span></div>
      <p class="lead">Este relatório apresenta a <b>fotografia real da operação de segurança</b> do condomínio ${esc(project.id)} — ${esc(project.name)} (grupo ${esc(pacoteLabel)}), consolidada a partir de <b>${nFontes} relatório(s) operacional(is)</b> gerado(s) pelo sistema MokLog CheckTest. Cada indicador é rastreável à sua fonte de origem, permitindo à administração uma visão integrada e auditável.</p>
      <div class="kpis">
        <div class="kpi risco"><div class="kl">Risco Geral</div><div class="kv">${esc(geral.label)}</div><div class="ks">${geral.alerta && geral.nBloqueadores === 1 ? "1 bloqueador de segurança caído — sob alerta" : geral.nBloqueadores >= 2 ? `${geral.nBloqueadores} bloqueadores simultâneos` : geral.nBloqueadores === 0 ? "sem bloqueador de segurança caído" : `${geral.nBloqueadores} vetor(es) bloqueador(es)`}</div></div>
        <div class="kpi"><div class="kl">Saúde equip.</div><div class="kv">${saudePct}<span class="kvu">${ts?.pct != null ? "%" : ""}</span></div><div class="ks">${ts?.ok ? "Teste Semanal" : "sem dado"}</div></div>
        <div class="kpi"><div class="kl">Iluminação</div><div class="kv">${ilumPct != null ? ilumPct : "—"}<span class="kvu">${ilumPct != null ? "%" : ""}</span></div><div class="ks">${ilum?.ok ? `${ilum.total - ilum.def} de ${ilum.total} pontos` : "não incluída"}</div></div>
        <div class="kpi"><div class="kl">Efetivo</div><div class="kv">${efetivo != null ? efetivo : "—"}</div><div class="ks">${efetivo != null ? "colaboradores" : "não incluído"}</div></div>
      </div>
      <div class="gauge">
        <div class="gauge-top"><span class="gt">Classificação consolidada de risco</span><span class="gc">▸ ${esc(geral.label)}</span></div>
        <div class="scale">${escalaHTML}<div class="marker" style="left:calc(${markerLeft}% - 1.5px)"></div></div>
      </div>
      ${timelineRows ? `<div class="sec" style="margin-top:20px">
        <div class="sec-h"><span class="sec-n">▸</span><span class="sec-t" style="font-size:12.5px">Tempo de exposição — pendências críticas</span></div>
        <div class="tl">${timelineRows}</div>
        <div class="tl-axis"><span>0 dias</span><span>tempo de exposição (fator secundário)</span><span>${maxDias} dias</span></div>
      </div>` : ""}
      <div class="panorama"><b>Panorama.</b> ${geral.label === "BAIXO"
        ? "As fontes selecionadas não revelam vetores de risco relevantes no período — operação dentro dos parâmetros."
        : (() => {
            const partes = [];
            if (geral.nBloqueadores >= 2) partes.push(`${geral.nBloqueadores} vetores bloqueadores caídos simultaneamente`);
            else if (geral.nBloqueadores === 1) partes.push(`1 vetor bloqueador de segurança caído (sob alerta)`);
            if (nElev) partes.push(`${nElev} vetor(es) em nível elevado`);
            const detalhe = partes.length ? ` ${partes.join(", ")}` : "";
            return `O quadro consolidado classifica o risco geral como <b>${esc(geral.label)}</b>${geral.alerta && geral.nBloqueadores === 1 ? ", com <b>selo de alerta</b> por bloqueador isolado" : ""}.${detalhe ? ` Fatores:${detalhe}.` : ""} Cada apontamento é detalhado a seguir por vetor, com a fonte de origem.`;
          })()}</div>
      <div class="dest">
        <div class="drow d-pos"><span class="dt">POSITIVO</span><span>${ts?.ok ? `Dos ${ts.total} pontos verificados, ${ts.okItens} operam normalmente (${ts.pct}% de saúde).` : "Base operacional consolidada no período."}</span></div>
        ${destElev ? `<div class="drow d-att"><span class="dt">ATENÇÃO</span><span>${esc(destElev)}.</span></div>` : ""}
        ${destCrit ? `<div class="drow d-cri"><span class="dt">CRÍTICO</span><span>${esc(destCrit)}.</span></div>` : ""}
        ${geral.modulador && geral.modulador.delta < 0 && geral.modulador.de !== geral.modulador.para
          ? `<div class="drow d-pos"><span class="dt">EQUIPE</span><span>Classificação ajustada de <b>${esc(geral.modulador.de)}</b> para <b>${esc(geral.modulador.para)}</b> em razão do perfil operacional (${esc(geral.modulador.motivo)}), que reforça a capacidade de resposta.</span></div>`
          : ""}
        ${geral.modulador && geral.modulador.delta < 0 && geral.modulador.travadoPeloPiso
          ? `<div class="drow d-att"><span class="dt">EQUIPE</span><span>O perfil operacional (${esc(geral.modulador.motivo)}) mitiga o risco, mas <b>não rebaixa</b> a classificação: há vetor crítico preponderante que se mantém como piso.</span></div>`
          : ""}
        ${geral.modulador && geral.modulador.delta > 0 && geral.modulador.de !== geral.modulador.para
          ? `<div class="drow d-att"><span class="dt">EQUIPE</span><span>Classificação elevada de <b>${esc(geral.modulador.de)}</b> para <b>${esc(geral.modulador.para)}</b> em razão do perfil operacional (${esc(geral.modulador.motivo)}), que reduz a capacidade de resposta.</span></div>`
          : ""}
      </div>
    </div>
  </div>
  <div class="foot"><span>MokLog CheckTest · Documento situacional — uso interno / administração</span><span>${ref}</span></div>
</div>

<div class="page">
  <div class="hdr"><img class="logo" src="${MOKED_LOGO}" alt="Moked">
    <div class="titleblock"><div class="eyebrow">Moked Consulting Security</div>
      <h1>Relatório Situacional de Segurança</h1>
      <div class="sub">${esc(project.id)} — ${esc(project.name)} · Análise de Risco do Condomínio</div></div>
    <div class="refbox"><div class="ref">${ref}</div><div><b>Período:</b> ${esc(periodo)}</div><div><b>Base:</b> ${nFontes} relatório(s)</div></div></div>
  <div class="body">
    <div class="sec">
      <div class="sec-h"><span class="sec-n">01</span><span class="sec-t">Base Documental</span></div>
      <p class="lead" style="margin-bottom:14px">A análise consolida os relatórios a seguir, todos gerados pelo MokLog CheckTest. <b>A classificação de risco deriva exclusivamente destes dados.</b></p>
      <div class="fontes">${fontesLinhas}</div>
    </div>
    <div class="sec">
      <div class="sec-h"><span class="sec-n">02</span><span class="sec-t">Panorama por Vetor de Segurança</span></div>
      ${vetoresHTML}
    </div>
  </div>
  <div class="foot"><span>MokLog CheckTest · Documento situacional — uso interno / administração</span><span>${ref}</span></div>
</div>

<div class="page">
  <div class="hdr"><img class="logo" src="${MOKED_LOGO}" alt="Moked">
    <div class="titleblock"><div class="eyebrow">Moked Consulting Security</div>
      <h1>Relatório Situacional de Segurança</h1>
      <div class="sub">${esc(project.id)} — ${esc(project.name)} · Análise de Risco do Condomínio</div></div>
    <div class="refbox"><div class="ref">${ref}</div><div><b>Período:</b> ${esc(periodo)}</div><div><b>Base:</b> ${nFontes} relatório(s)</div></div></div>
  <div class="body">
    <div class="sec">
      <div class="sec-h"><span class="sec-n">03</span><span class="sec-t">Matriz de Risco por Vetor</span></div>
      <table><thead><tr><th style="width:26%">Vetor</th><th>Situação atual</th><th class="c" style="width:9%">Prob.</th><th class="c" style="width:10%">Impacto</th><th class="c" style="width:13%">Risco</th></tr></thead>
      <tbody>${matrizLinhas || `<tr><td colspan="5" style="text-align:center;color:${MOKED.cinza}">Sem vetores de risco no período.</td></tr>`}</tbody></table>
      <div class="crit-note">Critério: o risco de cada vetor resulta do cruzamento entre probabilidade de materialização e impacto sobre a segurança patrimonial. A classificação geral consolidada segue a contagem de vetores <b>bloqueadores</b> caídos (perímetro, pânico fixo, cancela de alta segurança): 1 bloqueador → ELEVADO sob alerta; 2 ou mais simultâneos → CRÍTICO.</div>
    </div>
    <div class="sec">
      <div class="sec-h"><span class="sec-n">04</span><span class="sec-t">Recomendações Prioritárias</span></div>
      <div class="recs">${recsHTML}</div>
    </div>
    <div class="metod">
      <div class="mt">Como esta análise foi construída</div>
      Documento gerado automaticamente pelo <b>MokLog CheckTest</b> a partir dos dados operacionais já inseridos no aplicativo. Cada dado exibe sua <b>fonte de origem</b> e, onde há relação entre sistemas, o <b>impacto cruzado</b> é apontado. A classificação combina <b>criticidade do item</b> com a <b>proporção de falha</b>, não apenas o tempo em aberto. Cada item tem um <b>teto de risco</b> conforme sua classe: itens <b>bloqueadores</b> (pânico fixo, cancela de alta segurança, perímetro) são os que definem o risco geral; itens <b>táticos</b> (telefonia, internet, nobreak, CTMK, pânico móvel) chegam a <b>ELEVADO</b>; <b>automação/iluminação</b> a <b>MODERADO</b>; e <b>periféricos</b> permanecem em <b>BAIXO</b>. A consolidação do site segue a <b>contagem de bloqueadores caídos</b>: <b>1 bloqueador</b> classifica o site como <b>ELEVADO sob alerta</b> (vetor grave isolado); <b>2 ou mais bloqueadores simultâneos</b> configuram <b>CRÍTICO</b> (colapso amplo). O <b>CFTV</b> é avaliado por contagem de câmeras inoperantes e o <b>perímetro</b>, gradualmente, pela fração de zonas comprometidas. O <b>alarme de incêndio (SDAI)</b> registra ocorrência mas não eleva o risco geral. O <b>entorno regional</b> é fator contextual agravante e pode elevar a classificação até <b>ELEVADO</b>, mas não configura CRÍTICO sozinho. Apontamentos de infraestrutura têm natureza consultiva e não substituem laudo técnico dos fornecedores.
    </div>
    <div class="assina">
      Documento produzido pela <b>Moked Consulting Security</b> no exercício de supervisão operacional do projeto ${esc(project.id)}, com base em ${nFontes} relatório(s) operacional(is) do período.
      <div class="inst"><b>MOKED CONSULTING SECURITY</b> · Consultoria de segurança há mais de 30 anos · Certificada ISO 9001:2015 e ISO 37001:2016 · MokLog — Segurança de Centros Logísticos · www.moked.com.br/moklog · Ref. ${ref} · Gerado em ${hoje}.</div>
    </div>
  </div>
  <div class="foot"><span>MokLog CheckTest · Documento situacional — uso interno / administração</span><span>${ref}</span></div>
</div>

<button class="btn-baixar" onclick="window.print()">📥 Baixar / Imprimir PDF</button>
<style>
  .btn-baixar{position:fixed;bottom:20px;right:20px;z-index:9999;background:linear-gradient(135deg,#1D9E75,#0F6E56);color:#fff;border:none;border-radius:30px;padding:14px 24px;font-size:15px;font-weight:800;font-family:'Inter',sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.28);cursor:pointer}
  .btn-baixar:active{transform:scale(.96)}
  @media print{.btn-baixar{display:none !important}}
</style>
<script>
  // dica no topo pra mobile: no diálogo de impressão, escolher "Salvar como PDF"
  document.title = "${ref} — ${esc(project.id)}";
</script>
</body></html>`;
}

// ═════════════════════════════════════════════════════════════
// ORQUESTRAÇÃO — coleta as fontes marcadas, valida, monta vetores
// ═════════════════════════════════════════════════════════════

// Definição das fontes selecionáveis (ordem de exibição).
const FONTES_DEF = [
  { key: "teste",    label: "Teste Semanal / Comparativo", desc: "Saúde dos equipamentos e pendências datadas" },
  { key: "ctmk",     label: "Monitor CTMK",                desc: "Câmera de contexto — status do painel" },
  { key: "iluminacao", label: "Iluminação",                desc: "Pontos operantes por quadrante" },
  { key: "perimetral", label: "Ronda Perimetral",          desc: "Teste de zonas do perímetro" },
  { key: "rondaVirtual", label: "Ronda Virtual (CFTV)",     desc: "Execução das rondas por câmera" },
  { key: "energia",  label: "Ocorrências de Energia",      desc: "Quedas e estabilidade no período" },
  { key: "equipe",   label: "Mapa de Equipe",              desc: "Brigada e reciclagens do efetivo" },
];

// Coleta todas as fontes marcadas para um projeto.
// Retorna { dados, faltantes: [{key,label,motivo}] }.
async function coletarFontes(project, stored, marcadas) {
  const dados = {};
  const faltantes = [];

  if (marcadas.teste) {
    const r = coletarTesteSemanal(project, stored);
    dados.ts = r;
    if (!r.ok) faltantes.push({ key: "teste", label: "Teste Semanal", motivo: r.motivo });
  }
  if (marcadas.ctmk) {
    const r = await coletarCTMK(project.id);
    dados.ctmk = r;
    if (!r.ok) faltantes.push({ key: "ctmk", label: "Monitor CTMK", motivo: r.motivo });
  }
  if (marcadas.iluminacao) {
    const r = await coletarIluminacao(project.id);
    dados.ilum = r;
    if (!r.ok) faltantes.push({ key: "iluminacao", label: "Iluminação", motivo: r.motivo });
  }
  if (marcadas.perimetral) {
    const r = await coletarPerimetral(project.id);
    dados.peri = r;
    if (!r.ok) faltantes.push({ key: "perimetral", label: "Ronda Perimetral", motivo: r.motivo });
  }
  if (marcadas.rondaVirtual) {
    const r = await coletarRondaVirtual(project.id);
    dados.rondaVirtual = r;
    if (!r.ok) faltantes.push({ key: "rondaVirtual", label: "Ronda Virtual", motivo: r.motivo });
  }
  if (marcadas.energia) {
    const r = await coletarEnergia(project.id);
    dados.energia = r;
    if (!r.ok) faltantes.push({ key: "energia", label: "Ocorrências de Energia", motivo: r.motivo });
  }
  if (marcadas.equipe) {
    const r = await coletarEquipe(project.id);
    dados.equipe = r;
    if (!r.ok) faltantes.push({ key: "equipe", label: "Mapa de Equipe", motivo: r.motivo });
  }
  { const r = await coletarSinistros(project.id); dados.sinistros = r; }
  { dados.regional = coletarRegional(project.id); }
  return { dados, faltantes };
}

// Monta a lista de vetores + base documental a partir dos dados coletados.
function montarAnalise(project, pacoteLabel, dados, contextos) {
  const vetores = [];
  const dataUlt = dados.ts?.ok ? dados.ts.data : hojeBR();

  if (dados.ts?.ok) vetores.push(...vetoresDoTesteSemanal(dados.ts, dataUlt));
  const vC = vetorCTMK(dados.ctmk); if (vC) vetores.push(vC);
  const vI = vetorIluminacao(dados.ilum); if (vI) vetores.push(vI);
  const vP = vetorPerimetral(dados.peri); if (vP) vetores.push(vP);
  const vEn = vetorEnergia(dados.energia); if (vEn) vetores.push(vEn);
  const vEq = vetorEquipe(dados.equipe); if (vEq) vetores.push(vEq);

  aplicarCruzamentos(vetores, { rondaVirtual: dados.rondaVirtual });
  vetores.sort((a, b) => b.nivel - a.nivel || (b.piorDias || 0) - (a.piorDias || 0));

  // ── CONSOLIDAÇÃO v3 (11/08) — DOCUMENTO ÚNICO, por CONTAGEM de bloqueadores ──
  // Doutrina: 0 bloq → pior vetor (teto ELEVADO) · 1 bloq → ELEVADO + alerta ·
  // ≥2 bloq → CRÍTICO. Sem dualidade cliente/Moked. Sem CRÍTICO II.
  //
  // DEDUP DE PERÍMETRO: o mesmo perímetro físico aparece em DOIS cards
  // (Alarme Perimetral do Teste Semanal + Perímetro eletrônico da Ronda).
  // Sem dedup, contaria como 2 bloqueadores e viraria CRÍTICO falso. Aqui,
  // toda a família "perímetro" conta como UM ÚNICO bloqueador.
  const ehPerimetro = (v) => v.grupo === "perimetral" || v.chave === "perimetral"
    || /perimetr|perímetr/i.test(v.label || "");
  let perimetroBloqJaContado = false;
  const vetoresRC = vetores.map((v) => {
    let bloq = !!v.bloqueadorCaido;
    if (bloq && ehPerimetro(v)) {
      if (perimetroBloqJaContado) bloq = false; // colapsa duplicatas de perímetro
      else perimetroBloqJaContado = true;
    }
    return {
      nivel: v.nivel,
      incluir: v.incluirCliente !== false,
      bloqueadorCaido: bloq,
      motivo: v.label,
    };
  });
  const cons = consolidarSite(vetoresRC);

  // Moduladores (sinistro + regional) — somados como delta CONTEXTUAL.
  // Equipe/capacitação NÃO pondera na v3 (fora do score).
  const modSin = moduladorSinistro(dados.sinistros, vetores);
  const modReg = moduladorRegional(dados.regional, vetores);
  const deltaTot = (modSin?.delta || 0) + (modReg?.delta || 0);
  const motivosMod = [modSin?.motivo, modReg?.motivo].filter(Boolean).join(" · ");

  // OPÇÃO B (decidida 11/08): moduladores/território sobem no máximo até
  // ELEVADO. NUNCA cruzam para CRÍTICO sozinhos — CRÍTICO só com 2+ bloqueadores.
  // Se a consolidação já é CRÍTICA (2+ bloq), o delta não rebaixa.
  const nivelBase = cons.nivel || RC_NIVEL.BAIXO;
  let nivelAjustado = nivelBase;
  if (deltaTot !== 0) {
    if (nivelBase >= RC_NIVEL.CRITICO) {
      nivelAjustado = RC_NIVEL.CRITICO; // já crítico por bloqueadores; delta não mexe
    } else {
      const tetoDelta = RC_NIVEL.ELEVADO; // território não cruza para CRÍTICO
      nivelAjustado = Math.max(RC_NIVEL.BAIXO, Math.min(tetoDelta, nivelBase + deltaTot));
    }
  }
  const labelAjustado = RC_LABEL[nivelAjustado];

  const nBloq = cons.nBloqueadores || 0;
  const CORES = { 4: MOKED.critico, 3: MOKED.elevado, 2: MOKED.moderado, 1: MOKED.baixo, 0: MOKED.cinza };
  const geral = {
    label: labelAjustado, cor: CORES[nivelAjustado] || MOKED.elevado,
    criticos: nBloq, prepCriticos: 0,
    nBloqueadores: nBloq, alerta: !!cons.alerta,
    // compat: campos antigos preservados p/ o template (agora nível único)
    nivelMoked: nivelAjustado, nivelCliente: nivelAjustado,
    labelMoked: labelAjustado, labelCliente: labelAjustado,
    nivel: nivelAjustado,
    modulador: motivosMod ? { delta: deltaTot, motivo: motivosMod, de: nivelBase, para: nivelAjustado } : null,
  };
  const recomendacoes = gerarRecomendacoes(vetores);

  // base documental — só fontes que trouxeram dado
  const fontesUsadas = [];
  if (dados.ts?.ok) fontesUsadas.push({ titulo: "Teste Semanal / Comparativo", detalhe: `Saúde ${dados.ts.pct}% · ${dados.ts.total} pontos · ${dataUlt}` });
  if (dados.ctmk?.ok) fontesUsadas.push({ titulo: "Monitor CTMK (painel)", detalhe: dados.ctmk.offline ? `Off-line há ${dados.ctmk.dias} dias` : "Online" });
  if (dados.ilum?.ok) fontesUsadas.push({ titulo: "Relatório de Iluminação", detalhe: `${dados.ilum.total} pontos · ${dados.ilum.pct}% operante` });
  if (dados.peri?.ok) fontesUsadas.push({ titulo: "Ronda Perimetral", detalhe: dados.peri.fonte === "rondas" ? `${dados.peri.plantoes} plantões · ${dados.peri.pctOk}% OK` : `${dados.peri.pctOk}% OK · ${dados.peri.dataUlt}` });
  if (dados.rondaVirtual?.ok) fontesUsadas.push({ titulo: "Ronda Virtual (CFTV)", detalhe: `${dados.rondaVirtual.turnos} turnos · ${dados.rondaVirtual.feitas}/${dados.rondaVirtual.previstas} rondas · ${dados.rondaVirtual.pct}% execução` });
  if (dados.energia?.ok) fontesUsadas.push({ titulo: "Ocorrências de Energia", detalhe: `${dados.energia.quedas} queda(s) em 30 dias${dados.energia.aberto ? " · evento aberto" : ""}` });
  if (dados.equipe?.ok) {
    const ps = dados.equipe.perfilSeguranca || {};
    const rotTipo = { vspp:"VSPP", vigilantes:"Vigilantes", mista:"Mista" }[ps.tipoEquipe] || null;
    const rotSN = (v) => v === "sim" ? "sim" : v === "nao" ? "não" : null;
    const perfilPartes = [];
    if (rotTipo) perfilPartes.push(rotTipo);
    if (rotSN(ps.armada)) perfilPartes.push(`armada: ${rotSN(ps.armada)}`);
    if (rotSN(ps.ccoDedicada)) perfilPartes.push(`CCO dedicada: ${rotSN(ps.ccoDedicada)}`);
    const perfilTxt = perfilPartes.length ? ` · ${perfilPartes.join(" · ")}` : "";
    fontesUsadas.push({ titulo: "Mapa de Equipe", detalhe: `${dados.equipe.total} colaboradores${perfilTxt}` });
  }
  if (dados.sinistros?.ok) fontesUsadas.push({ titulo: "Histórico de Sinistros", detalhe: dados.sinistros.houve ? "Sinistro registrado" : "Sem sinistro recente" });
  if (dados.regional?.ok) {
    fontesUsadas.push({ titulo: "Diagnóstico Regional", detalhe: `${dados.regional.codigo} · ${(dados.regional.quadrantes||[]).map(q=>q.grau).join("/")}` });
  }

  return {
    project, pacoteLabel, vetores, geral, geralCliente: geral, geralMoked: geral, recomendacoes, fontesUsadas,
    sinistros: dados.sinistros, regional: dados.regional,
    ts: dados.ts, ctmk: dados.ctmk, ilum: dados.ilum, rondaVirtual: dados.rondaVirtual, equipe: dados.equipe,
    contextos,
  };
}

// ═════════════════════════════════════════════════════════════
// COMPONENTE REACT
// props: { projects (obj PROJECTS), stored, pacote ("golgi"|"mega"|"klog"), onBack }
// ═════════════════════════════════════════════════════════════
export default function AnaliseRisco({ projects, stored, pacote, onBack }) {
  const pacoteInfo = PACOTES[pacote] || PACOTES.golgi;
  const projetosDoPacote = pacoteInfo.ids.map((id) => projects[id]).filter(Boolean);

  const [selProjeto, setSelProjeto] = useState(null);
  const [marcadas, setMarcadas] = useState(() => {
    const m = {}; FONTES_DEF.forEach((f) => (m[f.key] = true)); return m;
  });
  const [contextos, setContextos] = useState({});
  const [estado, setEstado] = useState("idle"); // idle | coletando | aviso | pronto
  const [faltantes, setFaltantes] = useState([]);
  const [analisePronta, setAnalisePronta] = useState(null);

  const toggleFonte = (k) => setMarcadas((m) => ({ ...m, [k]: !m[k] }));
  const algumaMarcada = Object.values(marcadas).some(Boolean);

  async function gerar(forcar) {
    if (!selProjeto) return;
    setEstado("coletando");
    const { dados, faltantes: falt } = await coletarFontes(selProjeto, stored, marcadas);
    if (falt.length && !forcar) {
      setFaltantes(falt);
      setEstado("aviso");
      return;
    }
    const analise = montarAnalise(selProjeto, pacoteInfo.label, dados, contextos);
    analise.ref = await obterRefSequencial(selProjeto.id); // Nº AR fixo (contador B)
    setAnalisePronta(analise);
    setEstado("pronto");
    abrirPDF(analise);
  }

  // ── Etapa (d): geração COMPLETA com fusão do Diagnóstico Regional (B1-a) ──
  // Fluxo (2 toques, fidelidade máxima, iPhone/Safari-safe):
  //  1) abre o relatório fiel (window.print) para o usuário SALVAR como PDF;
  //  2) o usuário re-seleciona o PDF salvo; o app funde com public/regional/{PID}.pdf
  //     via pdf-lib (import dinâmico) e baixa UM único arquivo final.
  const [fusaoAguardando, setFusaoAguardando] = useState(null); // { analise, regional }
  const [fusaoErro, setFusaoErro] = useState("");
  const [fusaoBusy, setFusaoBusy] = useState(false);

  async function gerarCompleto() {
    if (!selProjeto) return;
    setFusaoErro("");
    setEstado("coletando");
    const { dados, faltantes: falt } = await coletarFontes(selProjeto, stored, marcadas);
    const analise = montarAnalise(selProjeto, pacoteInfo.label, dados, contextos);
    analise.ref = await obterRefSequencial(selProjeto.id); // Nº AR fixo (contador B)
    setAnalisePronta(analise);
    setEstado("pronto");
    const reg = dados.regional;
    if (!reg || !reg.ok || !reg.pdfPath) {
      // sem regional cadastrado: cai para o relatório simples e avisa.
      setFusaoErro("Este projeto não possui Diagnóstico Regional cadastrado; gerado apenas o relatório operacional.");
      abrirPDF(analise);
      return;
    }
    // Toque 1: abre o relatório fiel para salvar como PDF.
    abrirPDF(analise);
    // Arma o toque 2 (seleção + fusão).
    setFusaoAguardando({ analise, regional: reg });
  }

  async function fundirComRegional(file) {
    if (!fusaoAguardando) return;
    const { regional } = fusaoAguardando;
    setFusaoBusy(true);
    setFusaoErro("");
    try {
      const { PDFDocument } = await import("pdf-lib");
      // 1) relatório salvo pelo usuário
      const relBytes = new Uint8Array(await file.arrayBuffer());
      const relDoc = await PDFDocument.load(relBytes);
      // 2) regional em public/regional/{PID}.pdf
      const resp = await fetch(regional.pdfPath);
      if (!resp.ok) throw new Error("não foi possível carregar o Diagnóstico Regional em " + regional.pdfPath);
      const regBytes = new Uint8Array(await resp.arrayBuffer());
      const regDoc = await PDFDocument.load(regBytes);
      // 3) fusão: relatório primeiro, regional em anexo
      const out = await PDFDocument.create();
      const relPages = await out.copyPages(relDoc, relDoc.getPageIndices());
      relPages.forEach((pg) => out.addPage(pg));
      const regPages = await out.copyPages(regDoc, regDoc.getPageIndices());
      regPages.forEach((pg) => out.addPage(pg));
      const finalBytes = await out.save();
      const codigo = (regional.codigo || "Regional").replace(/[^\w-]/g, "_");
      const nome = `${selProjeto.id}_Analise_de_Risco_Completa_${codigo}.pdf`;
      const blob = new Blob([finalBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = nome;
      document.body.appendChild(a); a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 4000);
      setFusaoAguardando(null);
    } catch (e) {
      setFusaoErro("Falha na fusão: " + (e && e.message ? e.message : "erro desconhecido") + ". Você ainda tem o relatório e o regional separados.");
    } finally {
      setFusaoBusy(false);
    }
  }

  function abrirPDF(analise) {
    const html = gerarHTMLAnaliseRisco(analise);
    // Tenta abrir em nova aba; se o navegador bloquear (comum no mobile),
    // cai para um blob URL, que funciona em celular e desktop.
    try {
      const w = window.open("", "_blank");
      if (w && w.document) { w.document.write(html); w.document.close(); return; }
    } catch (e) { /* fallback abaixo */ }
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.target = "_blank"; a.rel = "noopener";
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 4000);
  }

  // ── estilos inline (dark, padrão do app) ──
  const CV = "#1D9E75";
  const S = {
    wrap: { minHeight: "100vh", background: "#04080f", color: "#e2e8f0", fontFamily: "system-ui, 'Segoe UI', sans-serif", padding: "18px 16px 40px" },
    top: { display: "flex", alignItems: "center", gap: 12, marginBottom: 18 },
    back: { background: "transparent", border: "1px solid #1e293b", color: "#94a3b8", borderRadius: 9, padding: "8px 12px", fontSize: 13, cursor: "pointer" },
    h: { fontSize: 17, fontWeight: 800, color: "#f1f5f9" },
    sub: { fontSize: 12, color: "#64748b", marginTop: 2 },
    card: { background: "#060c18", border: "1px solid #0f2318", borderRadius: 14, padding: "14px 16px", marginBottom: 12 },
    ctxInput: { width: "100%", background: "#060c18", border: "1px solid #1e293b", borderRadius: 8, color: "#e2e8f0", fontSize: 12, padding: "8px 10px", marginTop: 6, fontFamily: "inherit" },
    btn: { width: "100%", border: "none", borderRadius: 11, padding: "15px", fontSize: 15, fontWeight: 800, cursor: "pointer", background: "linear-gradient(135deg,#1D9E75,#0F6E56)", color: "#fff", marginTop: 8 },
    btnOff: { opacity: 0.5, cursor: "not-allowed" },
    aviso: { background: "#2a1400", border: "1px solid #b7791f66", borderRadius: 12, padding: "14px 16px", marginTop: 12 },
    avisoT: { fontSize: 13, fontWeight: 800, color: "#f59e0b", marginBottom: 8 },
    avisoItem: { fontSize: 12, color: "#fbbf24", marginBottom: 4 },
    avisoBtns: { display: "flex", gap: 10, marginTop: 12 },
    smallBtn: { flex: 1, borderRadius: 9, padding: "10px", fontSize: 13, fontWeight: 700, cursor: "pointer", border: "1px solid #1e293b", background: "transparent", color: "#e2e8f0" },
  };
  function stProjBtn(sel) { return { width: "100%", textAlign: "left", background: sel ? "#0f6e5622" : "#060c18", border: "1px solid " + (sel ? CV : "#0f172a"), color: "#e2e8f0", borderRadius: 12, padding: "13px 15px", fontSize: 14, fontWeight: 700, cursor: "pointer", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }; }
  function stFonteRow(on) { return { display: "flex", alignItems: "center", gap: 11, padding: "11px 13px", borderRadius: 10, border: "1px solid " + (on ? "#1D9E7566" : "#1e293b"), background: on ? "#0f6e5615" : "transparent", marginBottom: 8, cursor: "pointer" }; }
  function stCheck(on) { return { width: 22, height: 22, borderRadius: 6, border: "2px solid " + (on ? CV : "#475569"), background: on ? CV : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#fff", flexShrink: 0 }; }

  return (
    <div style={S.wrap}>
      <div style={S.top}>
        <button style={S.back} onClick={onBack}>← Voltar</button>
        <div>
          <div style={S.h}>📋 Análise de Risco — {pacoteInfo.label}</div>
          <div style={S.sub}>Selecione o projeto e as fontes; o PDF consolidado é gerado a partir da sua seleção.</div>
        </div>
      </div>

      <div style={S.card}>
        <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>Projeto</div>
        {projetosDoPacote.map((p) => (
          <button key={p.id} style={stProjBtn(selProjeto?.id === p.id)} onClick={() => { setSelProjeto(p); setEstado("idle"); setFaltantes([]); }}>
            <span>{p.id} — {p.name}</span>
            <span style={{ fontSize: 16, color: selProjeto?.id === p.id ? "#1D9E75" : "#334155" }}>{selProjeto?.id === p.id ? "●" : "○"}</span>
          </button>
        ))}
      </div>

      {selProjeto && (
        <div style={S.card}>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>Fontes a incluir</div>
          {FONTES_DEF.map((f) => {
            const on = !!marcadas[f.key];
            return (
              <div key={f.key}>
                <div style={stFonteRow(on)} onClick={() => toggleFonte(f.key)}>
                  <div style={stCheck(on)}>{on ? "✓" : ""}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>{f.label}</div>
                    <div style={{ fontSize: 10.5, color: "#64748b", marginTop: 1 }}>{f.desc}</div>
                  </div>
                </div>
                {on && (
                  <input
                    style={S.ctxInput}
                    placeholder={`Contexto de campo p/ ${f.label} (opcional — só aparece se preenchido)`}
                    value={contextos[f.key === "teste" ? "teste" : f.key] || ""}
                    onChange={(e) => setContextos((c) => ({ ...c, [f.key]: e.target.value }))}
                  />
                )}
              </div>
            );
          })}

          {estado === "aviso" && (
            <div style={S.aviso}>
              <div style={S.avisoT}>⚠️ Fontes marcadas sem dado neste projeto</div>
              {faltantes.map((f) => (
                <div key={f.key} style={S.avisoItem}>• <b>{f.label}</b> — {f.motivo}</div>
              ))}
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>Você marcou essas fontes, mas {selProjeto.id} não tem dado delas no período. Gere só com as fontes que têm dado, ou volte e desmarque.</div>
              <div style={S.avisoBtns}>
                <button style={S.smallBtn} onClick={() => setEstado("idle")}>Revisar seleção</button>
                <button style={{ ...S.smallBtn, background: "#0f6e56", border: "none", color: "#fff" }} onClick={() => gerar(true)}>Gerar assim mesmo</button>
              </div>
            </div>
          )}

          <button
            style={{ ...S.btn, ...((!algumaMarcada || estado === "coletando") ? S.btnOff : {}) }}
            disabled={!algumaMarcada || estado === "coletando"}
            onClick={() => gerar(false)}
          >
            {estado === "coletando" ? "Consolidando…" : "📄 Gerar Análise de Risco (PDF)"}
          </button>
          {estado === "pronto" && (
            <button style={{ ...S.smallBtn, marginTop: 8, width: "100%" }} onClick={() => abrirPDF(analisePronta)}>Reabrir PDF</button>
          )}

          <button
            style={{ ...S.btn, marginTop: 10, background: "linear-gradient(135deg,#B21E27,#7a1319)", ...((!algumaMarcada || estado === "coletando") ? S.btnOff : {}) }}
            disabled={!algumaMarcada || estado === "coletando"}
            onClick={() => gerarCompleto()}
          >
            📄 Gerar Completo (com Regional)
          </button>

          {fusaoAguardando && (
            <div style={{ ...S.aviso, background: "#0a1420", border: "1px solid #1D9E7566" }}>
              <div style={{ ...S.avisoT, color: "#5eead4" }}>Passo 2 de 2 — anexar o Diagnóstico Regional</div>
              <div style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.5, marginBottom: 10 }}>
                O relatório foi aberto para você <b>salvar como PDF</b>. Depois de salvar, selecione o arquivo abaixo — o app vai fundi-lo com o Diagnóstico Regional {fusaoAguardando.regional.codigo || ""} num único PDF.
              </div>
              <input
                type="file"
                accept="application/pdf"
                disabled={fusaoBusy}
                onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) fundirComRegional(f); }}
                style={{ width: "100%", color: "#e2e8f0", fontSize: 12 }}
              />
              {fusaoBusy && <div style={{ fontSize: 12, color: "#5eead4", marginTop: 8 }}>Fundindo…</div>}
              <button
                style={{ ...S.smallBtn, marginTop: 10, width: "100%" }}
                onClick={() => { setFusaoAguardando(null); setFusaoErro(""); }}
              >
                Cancelar fusão
              </button>
            </div>
          )}

          {fusaoErro && (
            <div style={{ ...S.aviso, marginTop: 10 }}>
              <div style={S.avisoItem}>{fusaoErro}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

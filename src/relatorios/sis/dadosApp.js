// SIS⁺ — liga o que o app JÁ MEDE aos requisitos. Só vira "medido" o requisito com leitura real; o resto fica
// de fora do mapa e o motor trata como "a confirmar" (0,5 até validar). Puro: sem Firestore, sem relógio.
// Regra única de atendimento por saúde de equipamentos: 100% operando = Atende (1); a partir de 80% = Parcial (0,5);
// abaixo disso = Não atende (0). A regra aparece na memória de cálculo de cada requisito medido.
import { dataBR } from "../padraoMoked";

const pt = (x) => String(Math.round(x * 10) / 10).replace(".", ",");
export const LIMITE_PARCIAL = 80;
export const REGRA_SAUDE = "Equipamentos: 100% operando = Atende; a partir de 80% = Parcial; abaixo de 80% = Não atende.";

// catId (id da categoria do checklist) → requisito. Exclui categorias "LEGADO".
const MAPA = {
  P2: /^perimeter/,
  A7: /^(bollards|garras)/,
  A9: /^(torniquetes|qr_)/,
  A11: /^(cancelas|portoes|motores)/,
  I10: /^(nobreak|interfone)/,
  M1: /^cftv$/,
  M11: /^nobreak/,
  M12: /^panic_fix$/,
  M13: /^panic_mob$/,
};

const sPorSaude = (t) => (t.inop === 0 && t.parcial === 0 ? 1 : t.saude >= LIMITE_PARCIAL ? 0.5 : 0);
const somar = (cats) => {
  const t = cats.reduce((a, c) => ({ total: a.total + c.total, ok: a.ok + c.ok, parcial: a.parcial + c.parcial, inop: a.inop + c.inop }), { total: 0, ok: 0, parcial: 0, inop: 0 });
  return { ...t, saude: t.total ? ((t.ok + 0.5 * t.parcial) / t.total) * 100 : 100 };
};
const evSaude = (t, quando) => `${t.ok} de ${t.total} operando${t.parcial ? `, ${t.parcial} parcial(is)` : ""}${t.inop ? `, ${t.inop} inoperante(s)` : ""}${quando ? ` · checklist de ${quando}` : ""}`;

const num = (v) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN);

/**
 * @param row     linha da Visão 360 (penalidades, ilumTotal, ilumDeficientes…)
 * @param ex      extras lidos no clique (ultimo, cameras, rondaTurnos…) — pode ser {}
 * @param categorias resultado de porCategoria(itensDoEstado(...)) do último checklist (ou [])
 * @param ronda   { execucao: número 0–100 | null } já consolidada dos últimos 30 dias (opcional)
 * @returns { dados, medidos }  dados no formato do motor; medidos = códigos com leitura real
 */
export function dadosDoApp({ row = {}, ex = {}, categorias = [], ronda = null } = {}) {
  const dados = {};
  const quando = ex?.ultimo?.data ? dataBR(ex.ultimo.data) : "";
  const cats = (categorias || []).filter((c) => c && c.total > 0 && !/LEGADO/i.test(c.cat || ""));

  for (const [cod, re] of Object.entries(MAPA)) {
    const grupo = cats.filter((c) => re.test(c.catId));
    if (!grupo.length) continue;
    const t = somar(grupo);
    dados[cod] = { s: sPorSaude(t), ev: evSaude(t, quando), regra: REGRA_SAUDE };
  }

  // P2: as zonas com problema do Teste Perimetral rebaixam a leitura do checklist (no máximo Parcial).
  const zonas = (row.penalidades || []).find((p) => p.tipo === "perimetro");
  if (zonas && Number.isFinite(zonas.qtd) && zonas.qtd > 0) {
    const base = dados.P2 ? dados.P2.s : 1;
    dados.P2 = { s: Math.min(base, 0.5), ev: `${zonas.qtd} zona(s) com problema no Teste Perimetral${dados.P2 ? " · " + dados.P2.ev : ""}`, regra: "Zona perimetral com problema no último teste = no máximo Parcial." };
  }

  // I1: iluminação interna pelos quadrantes do Teste de Iluminação.
  const tot = num(row.ilumTotal), def = num(row.ilumDeficientes);
  if (Number.isFinite(tot) && tot > 0 && Number.isFinite(def) && def >= 0) {
    const pct = ((tot - Math.min(def, tot)) / tot) * 100;
    dados.I1 = { s: def === 0 ? 1 : pct >= LIMITE_PARCIAL ? 0.5 : 0, ev: `Teste de iluminação: ${def} de ${tot} pontos deficientes (${pt(pct)}% operacionais)`, regra: "Iluminação: nenhum ponto deficiente = Atende; a partir de 80% operacionais = Parcial; abaixo = Não atende." };
  }

  // M8: gravação — dias medidos por câmera (só número de verdade conta).
  if (Array.isArray(ex?.cameras)) {
    const d = ex.cameras.map((c) => num(c?.diasGravacao)).filter((x) => Number.isFinite(x) && x >= 0);
    if (d.length) {
      const ok30 = d.filter((x) => x >= 30).length, min = Math.min(...d);
      dados.M8 = { s: ok30 === d.length ? 1 : ok30 / d.length >= 0.8 ? 0.5 : 0, ev: `${ok30} de ${d.length} câmeras medidas com 30 dias ou mais · menor gravação: ${min} dias`, regra: "Gravação: todas as câmeras medidas com 30 dias ou mais = Atende; a partir de 80% delas = Parcial; abaixo = Não atende." };
    }
  }

  // M6: ronda virtual (execução em 30 dias) — junto do joystick, quando o checklist o mede.
  if (ronda && Number.isFinite(ronda.execucao)) {
    const e = ronda.execucao;
    dados.M6 = { s: e >= 90 ? 1 : e >= 70 ? 0.5 : 0, ev: `Ronda virtual: ${Math.round(e)}% de execução em 30 dias`, regra: "Ronda virtual: execução a partir de 90% = Atende; a partir de 70% = Parcial; abaixo = Não atende." };
    const joy = cats.filter((c) => /^joystick$/.test(c.catId));
    if (joy.length) {
      const t = somar(joy), sj = sPorSaude(t);
      if (sj < dados.M6.s) dados.M6 = { s: sj, ev: `${dados.M6.ev} · joystick: ${evSaude(t, "")}`, regra: dados.M6.regra + " O joystick inoperante rebaixa o requisito." };
    }
  }

  return { dados, medidos: Object.keys(dados) };
}

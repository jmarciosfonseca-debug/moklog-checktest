// MK RD — consolidado do período de fechamento (ex.: 20/08 a 18/09). Regras do Marcio:
// - Tempo dedicado ao cliente conta DESDE a abertura do trecho em casa até a saída do cliente
//   (abertura do trecho seguinte). Abriu 06:00 em casa e saiu do cliente 12:00 → 6h dedicadas,
//   mesmo que a chegada tenha sido 10:00.
// - O retorno para casa conta nas horas registradas do dia, mas não nas horas do projeto.
// - MK Home sem km é home office (conta horas, não conta como dia em campo).
// - Despesas separadas por tipo (pedágio, estacionamento, alimentação, outros) e, com o valor
//   do km em Configurar, o reembolso de km = km rodados × valor.
import { LOGO_MOKED_30 } from "../fvLogo";
import { kmDoTrecho, rotuloDestino, listarDestinos, brl, kmFmt, dataBR } from "./rdCalc";

const num = (v) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
const horas1 = (h) => (Math.round(h * 10) / 10).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " h";
const hhmm = (iso) => (iso ? String(iso).slice(11, 16) : "—");
const difH = (a, b) => (a && b ? Math.max(0, (new Date(b) - new Date(a)) / 3600000) : 0);
const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const diaSemana = (iso) => DIAS_SEMANA[new Date(iso + "T12:00:00Z").getUTCDay()] + " " + iso.slice(8, 10) + "/" + iso.slice(5, 7);

export const ehHomeOffice = (t) => t.origem === "MK_HOME" && t.destino === "MK_HOME";
export const ehRetorno = (t) => t.destino === "MK_HOME" && !ehHomeOffice(t);

export function tipoClassificado(descricao) {
  const s = String(descricao || "").toLowerCase();
  if (/ped[aá]gio/.test(s)) return "Pedágio";
  if (/estacion/.test(s)) return "Estacionamento";
  if (/aliment|almo[cç]|refei|comida|lanche|jantar|caf[eé]/.test(s)) return "Alimentação";
  return "Outros gastos";
}

// Horas dedicadas de cada trecho: da abertura até a abertura do PRÓXIMO trecho do dia
// (inclui viagem + permanência). O último trecho do dia fecha na própria chegada.
export function dedicacaoDoTrecho(dia, i) {
  const t = dia.trechos[i], prox = dia.trechos[i + 1];
  return difH(t.abertura?.em, prox?.abertura?.em || t.chegada?.em);
}

export function consolidarPeriodo(dias, memoria) {
  const ordenados = [...(dias || [])].filter((d) => d?.trechos?.length).sort((a, b) => String(a.data).localeCompare(String(b.data)));
  const porProjeto = {}, despesasPorTipo = {}, kmPorDia = [], agenda = [];
  let horas = 0, km = 0, despesas = 0, diasCampo = 0, registros = 0;
  for (const dia of ordenados) {
    let kmDia = 0, campo = false;
    dia.trechos.forEach((t, i) => {
      registros++;
      const ded = dedicacaoDoTrecho(dia, i);
      horas += ded;
      const kmT = kmDoTrecho(t) || 0; kmDia += kmT;
      const gastosT = [...(t.pedagios || []), ...(t.gastos || [])];
      for (const g of gastosT) { const v = num(g.valor); if (!v) continue; despesas += v; const tipo = tipoClassificado(g.descricao); despesasPorTipo[tipo] = (despesasPorTipo[tipo] || 0) + v; }
      if (ehHomeOffice(t)) {
        agenda.push({ data: dia.data, destino: "MK_HOME", tipo: "Home office", inicio: t.abertura?.em, fim: t.chegada?.em, km: null, despesas: 0, texto: resumoTrecho(t) });
        return;
      }
      campo = true;
      const despTrecho = gastosT.reduce((a, g) => a + num(g.valor), 0);
      if (ehRetorno(t)) {
        agenda.push({ data: dia.data, destino: "MK_HOME", tipo: "Retorno para casa", inicio: t.abertura?.em, fim: t.chegada?.em, km: kmT || null, despesas: despTrecho, texto: resumoTrecho(t) || "Casa" });
      } else {
        const p = (porProjeto[t.destino] = porProjeto[t.destino] || { horas: 0, visitas: 0 });
        p.horas += ded; p.visitas++;
        agenda.push({ data: dia.data, destino: t.destino, tipo: "Visita in loco", inicio: t.abertura?.em, fim: t.chegada?.em, km: kmT || null, despesas: despTrecho, texto: resumoTrecho(t) });
      }
    });
    km += kmDia; if (campo) diasCampo++;
    kmPorDia.push({ data: dia.data, km: Math.round(kmDia * 10) / 10 });
  }
  const projetos = Object.entries(porProjeto).map(([codigo, p]) => ({ codigo, horas: Math.round(p.horas * 10) / 10, visitas: p.visitas })).sort((a, b) => b.horas - a.horas);
  const visitas = projetos.reduce((a, p) => a + p.visitas, 0);
  const valorKm = memoria?.config?.valorKm != null && memoria?.config?.valorKm !== "" ? num(memoria.config.valorKm) : null;
  const reembolsoKm = valorKm != null ? Math.round(km * valorKm * 100) / 100 : null;
  return {
    de: ordenados[0]?.data || null, ate: ordenados[ordenados.length - 1]?.data || null,
    registros, dias: ordenados.length, diasCampo, visitas,
    horas: Math.round(horas * 10) / 10, km: Math.round(km * 10) / 10,
    despesas: Math.round(despesas * 100) / 100, despesasPorTipo, reembolsoKm, valorKm,
    totalGeral: reembolsoKm != null ? Math.round((reembolsoKm + despesas) * 100) / 100 : null,
    projetos, maisVisitado: projetos[0]?.codigo || null, kmPorDia, agenda,
  };
}

function resumoTrecho(t) {
  const partes = (t.atividades || []).map((a) => (a.status === "aberto" ? "⚠ Em aberto: " : "") + a.texto);
  if (t.obs) partes.push(t.obs);
  return partes.join(" · ");
}

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function htmlConsolidado(c, memoria, consultor) {
  const subDe = (codigo) => listarDestinos(memoria).find((d) => d.codigo === codigo)?.sub;
  const nome = (codigo) => { const r = rotuloDestino(memoria, codigo), s = subDe(codigo); return codigo === "MK_HOME" ? "Casa (MK)" : s ? `${r} · ${s}` : r; };
  const barra = (v, max, cor = "#1d3a5f") => `<span class="bar"><i style="width:${max > 0  ? Math.round((v / max) * 100) : 0}%;background:${cor}"></i></span>`;
  const maxH = Math.max(...c.projetos.map((p) => p.horas), 1);
  const maxDesp = Math.max(...Object.values(c.despesasPorTipo), 1);
  // Km por dia: colunas finas em um só matiz; dias sem km aparecem como tique na base.
  const graficoKm = (() => {
    const ds = c.kmPorDia; if (!ds.length) return "";
    const H = 150, topo = 22, base = H - 26, W = 940, pad = 8;
    const colW = (W - pad * 2) / ds.length, larg = Math.min(34, Math.max(8, colW - 6));
    const maxKm = Math.max(...ds.map((d) => d.km), 1);
    const emCampo = ds.filter((d) => d.km > 0);
    const media = emCampo.length ? emCampo.reduce((a, d) => a + d.km, 0) / emCampo.length : 0;
    const yDe = (v) => base - (v / maxKm) * (base - topo);
    const cols = ds.map((d, i) => {
      const x = pad + i * colW + (colW - larg) / 2, y = yDe(d.km), h = Math.max(0, base - y);
      const rotulo = d.data.slice(8, 10) + "/" + d.data.slice(5, 7);
      return `
      ${d.km > 0
        ? `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${larg.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="#1d3a5f"/>
           <text x="${(x + larg / 2).toFixed(1)}" y="${(y - 4).toFixed(1)}" text-anchor="middle" font-size="8.5" fill="#475569">${Math.round(d.km)}</text>`
        : `<rect x="${x.toFixed(1)}" y="${base - 2}" width="${larg.toFixed(1)}" height="2" rx="1" fill="#cbd5e1"/>`}
      <text x="${(x + larg / 2).toFixed(1)}" y="${base + 12}" text-anchor="middle" font-size="8" fill="#64748b">${rotulo}</text>`;
    }).join("");
    const yM = yDe(media);
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Km por dia" style="width:100%;height:auto">
     <line x1="${pad}" y1="${base}" x2="${W - pad}" y2="${base}" stroke="#e2e8f0" stroke-width="1"/>
     ${media > 0 ? `<line x1="${pad}" y1="${yM.toFixed(1)}" x2="${W - pad}" y2="${yM.toFixed(1)}" stroke="#d55a26" stroke-width="1" stroke-dasharray="4 4"/>
     <line x1="${pad}" y1="9" x2="${pad + 18}" y2="9" stroke="#d55a26" stroke-width="1" stroke-dasharray="4 4"/>
     <text x="${pad + 24}" y="12" text-anchor="start" font-size="8.5" fill="#d55a26">média dos dias em campo · ${Math.round(media)} km</text>` : ""}
     ${cols}</svg>
     <p class="nota">Tique cinza na base = dia sem deslocamento (home office ou sem registro de km).</p>`;
  })();
  const CORES_DESP = { "Pedágio": "#b45309", "Estacionamento": "#1d4ed8", "Alimentação": "#15803d", "Outros gastos": "#475569" };
  const card = (valor, rotulo) => `<div class="card"><strong>${valor}</strong><span>${esc(rotulo)}</span></div>`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>MK RD - Consolidado ${esc(dataBR(c.de))} a ${esc(dataBR(c.ate))}</title><style>
  @page{size:A4;margin:14mm}body{color:#142335;font:12px Arial,sans-serif;line-height:1.5;max-width:960px;margin:auto;padding:24px}
  header{display:flex;justify-content:space-between;align-items:center;gap:20px;border-bottom:2px solid #d55a26;padding-bottom:14px}header img{width:200px}
  h1{font:25px Georgia,serif;margin:0 0 2px}h2{font-size:14px;border-bottom:1px solid #c7ced5;padding-bottom:6px;margin:26px 0 10px}
  .intro{color:#475569;font-size:11.5px;margin-top:6px}
  .cards{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}.card{border:1px solid #d6dde4;border-radius:10px;padding:10px 16px;min-width:120px}
  .card strong{display:block;font-size:19px}.card span{font-size:10.5px;color:#64748b}
  .cols{display:flex;gap:24px;flex-wrap:wrap}.col{flex:1;min-width:300px}
  .linha{display:flex;align-items:center;gap:8px;font-size:11.5px;margin:6px 0}.linha b{width:168px;flex-shrink:0;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .linha u{width:62px;text-decoration:none;color:#64748b;font-size:10px;flex-shrink:0}
  .nota{color:#64748b;font-size:10px;margin:2px 0 8px}
  .bar{flex:1;height:10px;background:#eef2f7;border-radius:5px;overflow:hidden;display:inline-block}.bar i{display:block;height:100%;border-radius:5px}
  .linha em{width:52px;text-align:right;font-style:normal;flex-shrink:0}
  table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border-bottom:1px solid #e2e8f0;padding:6px 8px;font-size:10.8px;text-align:left;vertical-align:top}
  th{background:#f1f5f9;font-size:10px;text-transform:uppercase;letter-spacing:.4px;color:#475569}
  td.n,th.n{text-align:right;white-space:nowrap}td.c{white-space:nowrap}
  .ab{color:#b45309;font-weight:700}
  footer{margin-top:24px;border-top:1px solid #c7ced5;padding-top:8px;font-size:10px;color:#64748b;line-height:1.6}
  </style></head><body>
  <header><div><h1>MK RD · Consolidado do período</h1><div>${esc(dataBR(c.de))} a ${esc(dataBR(c.ate))}${consultor ? " · " + esc(consultor) : ""}</div>
  <p class="intro">Fechamento do Relatório Diário: horas, deslocamentos, visitas e custos do período, apurados das marcações do app. As horas de cada projeto contam da abertura do trecho (saída de casa) até a saída do cliente.</p></div>
  <img src="${LOGO_MOKED_30}" alt="Moked 30 anos"/></header>
  <div class="cards">
   ${card(horas1(c.horas), "horas registradas")}
   ${card(esc(kmFmt(c.km)), "rodados")}
   ${card(esc(brl(c.despesas)), "despesas do período")}
   ${card(c.reembolsoKm != null ? esc(brl(c.reembolsoKm)) : "—", c.valorKm != null ? `reembolso de km (${esc(kmFmt(c.km))} × ${esc(brl(c.valorKm))})` : "reembolso de km: defina o valor em Configurar")}
   ${c.totalGeral != null ? card(esc(brl(c.totalGeral)), "total a reembolsar (km + despesas)") : ""}
   ${card(String(c.diasCampo), "dias em campo")}
   ${card(String(c.visitas), "visitas in loco")}
   ${card(String(c.projetos.length), "projetos tratados" + (c.maisVisitado ? " · mais visitado: " + esc(rotuloDestino(memoria, c.maisVisitado)) : ""))}
  </div>
  <h2>Km por dia</h2>
  ${graficoKm}
  <div class="cols">
  <div class="col"><h2>Horas e visitas por projeto</h2>
  <p class="nota">Horas dedicadas: da saída de casa (abertura do trecho) até a saída do cliente — viagem + permanência.</p>
  ${c.projetos.map((p) => `<div class="linha"><b>${esc(nome(p.codigo))}</b>${barra(p.horas, maxH)}<em>${esc(horas1(p.horas))}</em><u>${p.visitas} visita${p.visitas > 1 ? "s" : ""}</u></div>`).join("") || "<p>Sem visitas no período.</p>"}
  </div>
  <div class="col"><h2>Despesas por tipo</h2>
  <p class="nota">Classificadas pela descrição de cada lançamento; pedágio sempre separado dos demais gastos.</p>
  ${Object.entries(c.despesasPorTipo).sort((a, b) => b[1] - a[1]).map(([tipo, v]) => `<div class="linha"><b>${esc(tipo)}</b>${barra(v, maxDesp, CORES_DESP[tipo] || "#475569")}<em>${esc(brl(v))}</em></div>`).join("") || "<p>Sem despesas no período.</p>"}
  </div></div>
  <h2>Agenda do período</h2>
  <table><thead><tr><th>Dia</th><th>Projeto</th><th>Tipo</th><th class="n">Horário</th><th class="n">Km</th><th class="n">Despesas</th><th>O que foi tratado</th></tr></thead><tbody>
  ${c.agenda.map((a) => `<tr><td class="c">${esc(diaSemana(a.data))}</td><td>${esc(nome(a.destino))}</td><td class="c">${esc(a.tipo)}</td><td class="n">${hhmm(a.inicio)}–${hhmm(a.fim)}</td><td class="n">${a.km != null ? esc(kmFmt(a.km)) : "—"}</td><td class="n">${a.despesas ? esc(brl(a.despesas)) : "—"}</td><td>${esc(a.texto || "—").replace(/⚠ Em aberto:/g, '<span class="ab">⚠ Em aberto:</span>')}</td></tr>`).join("")}
  </tbody></table>
  <footer>Horas por projeto = da abertura do trecho (saída de casa ou do ponto anterior) até a saída do cliente; o retorno para casa conta nas horas registradas do período. Km = km de término − km de início (painel do veículo), conferido pelas marcações com GPS. Despesas separadas por tipo a partir da descrição de cada lançamento. Reembolso de km = km rodados × valor por km definido em Configurar. Documento gerado pelo MokLog CheckTest · MK RD.</footer>
  </body></html>`;
}

export function imprimirConsolidado(dias, memoria, consultor) {
  const c = consolidarPeriodo(dias, memoria);
  const win = window.open("", "_blank");
  if (!win) throw new Error("Permita a abertura da janela do relatório.");
  win.document.open(); win.document.write(htmlConsolidado(c, memoria, consultor)); win.document.close();
}

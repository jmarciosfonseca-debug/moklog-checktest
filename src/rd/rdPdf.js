import { LOGO_MOKED_30 } from "../fvLogo";
import { kmDoTrecho, permanencias, minutosFmt, totaisDoDia, horaDe, brl, kmFmt, dataBR, rotuloDestino } from "./rdCalc";
import { linkMapa } from "./rdGeo";

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const hhmm = (m) => esc(horaDe(m));
const local = (m) => {
  if (!m) return "—";
  const partes = [hhmm(m)];
  if (m.endereco) partes.push(esc(m.endereco));
  const mapa = linkMapa(m.gps);
  if (mapa) partes.push(`<a href="${mapa}">mapa</a>`);
  return partes.join(" · ");
};

export function htmlRd(dia, memoria, consultor) {
  const ts = dia?.trechos || [];
  const perm = permanencias(dia);
  const tot = totaisDoDia(dia);
  const linhas = ts.map((t, i) => {
    const pedagios = (t.pedagios || []).reduce((a, p) => a + (Number(String(p.valor).replace(",", ".")) || 0), 0);
    return `<tr><td>${esc(rotuloDestino(memoria, t.origem))} → ${esc(rotuloDestino(memoria, t.destino))}</td><td>${local(t.abertura)}</td><td>${local(t.chegada)}</td><td>${esc(kmFmt(kmDoTrecho(t)))}</td><td>${pedagios ? esc(brl(pedagios)) : "—"}</td><td>${perm[i] == null ? "—" : esc(minutosFmt(perm[i]))}</td></tr>`;
  }).join("");
  const visitas = ts.filter((t) => (t.atividades || []).length || t.obs).map((t) => `
   <section class="vis"><h3>${esc(rotuloDestino(memoria, t.destino))}</h3>
   ${(t.atividades || []).map((a) => `<p class="at st-${a.status || "neutro"}">${a.status === "aberto" ? "⚠ Em aberto: " : a.status === "finalizado" ? "✔ Finalizado: " : ""}${esc(a.texto)}</p>`).join("")}
   ${t.obs ? `<p class="obs">${esc(t.obs)}</p>` : ""}</section>`).join("");
  const kmValor = memoria?.config?.valorKm;
  const reembolso = kmValor != null ? tot.km * kmValor + tot.pedagios + tot.gastos : null;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>MK RD - ${esc(dataBR(dia?.data))}</title><style>
  @page{size:A4;margin:16mm}body{color:#142335;font:12px Arial,sans-serif;line-height:1.55;max-width:900px;margin:auto;padding:24px}
  header{display:flex;justify-content:space-between;align-items:center;gap:20px;border-bottom:2px solid #d55a26;padding-bottom:14px}header img{width:210px}
  h1{font:26px Georgia,serif;margin:0 0 2px}h2{font-size:14px;border-bottom:1px solid #c7ced5;padding-bottom:6px;margin-top:26px}h3{font-size:13px;margin:14px 0 4px}
  table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #d6dde4;padding:6px 8px;font-size:11px;text-align:center}th{background:#f1f5f9}
  td:first-child{text-align:left;font-weight:700}a{color:#2563eb;text-decoration:none}
  .tot{display:flex;gap:18px;flex-wrap:wrap;margin-top:12px}.tot div{border:1px solid #d6dde4;border-radius:8px;padding:8px 14px}.tot strong{display:block;font-size:15px}
  .at{margin:3px 0}.st-aberto{color:#b45309;font-weight:700}.st-finalizado{color:#15803d}.obs{color:#475569;font-style:italic}
  footer{margin-top:26px;border-top:1px solid #c7ced5;padding-top:8px;font-size:10px;color:#64748b}</style></head><body>
  <header><div><h1>MK RD · Relatório Diário</h1><div>${esc(dataBR(dia?.data))}${consultor ? " · " + esc(consultor) : ""}</div></div><img src="${LOGO_MOKED_30}" alt="Moked 30 anos"/></header>
  <h2>01 Trechos do dia</h2>
  <div class="tw"><table><thead><tr><th>Trecho</th><th>Saída</th><th>Chegada</th><th>Km</th><th>Pedágios</th><th>Permanência</th></tr></thead><tbody>${linhas || '<tr><td colspan="6">Sem trechos.</td></tr>'}</tbody></table></div>
  <div class="tot">
   <div>Km total<strong>${esc(kmFmt(tot.km))}</strong></div>
   <div>Pedágios<strong>${esc(brl(tot.pedagios))}</strong></div>
   <div>Outros gastos<strong>${esc(brl(tot.gastos))}</strong></div>
   <div>Jornada<strong>${hhmm({ em: tot.inicio })} – ${hhmm({ em: tot.fim })}</strong></div>
   ${reembolso != null ? `<div>Km + despesas<strong>${esc(brl(reembolso))}</strong></div>` : ""}
  </div>
  ${visitas ? `<h2>02 Visitas e tratativas</h2>${visitas}` : ""}
  ${dia?.obs ? `<h2>Observações do dia</h2><p>${esc(dia.obs)}</p>` : ""}
  <footer>Horários e localizações cravados pelo aparelho no momento de cada marcação. Documento gerado pelo MokLog CheckTest · MK RD.</footer>
  </body></html>`;
}

export function imprimirRd(dia, memoria, consultor) {
  const win = window.open("", "_blank");
  if (!win) throw new Error("Permita a abertura da janela do relatório.");
  win.document.open(); win.document.write(htmlRd(dia, memoria, consultor)); win.document.close();
}

import { LOGO_MOKED_30 } from "../fvLogo";
import { kmDoTrecho, permanencias, minutosFmt, totaisDoDia, horaDe, brl, kmFmt, dataBR, rotuloDestino } from "./rdCalc";
import { linkMapa } from "./rdGeo";

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const hhmm = (m) => esc(horaDe(m));

export function htmlRd(dia, memoria, consultor, fotos = {}) {
  const ts = dia?.trechos || [];
  const perm = permanencias(dia);
  const tot = totaisDoDia(dia);
  // Marco em duas linhas: hora grande, lugar embaixo — alinhado e legível.
  const marco2 = (m) => {
    if (!m) return "<b>—</b>";
    const mapa = linkMapa(m.gps);
    return `<b>${hhmm(m)}</b>${m.endereco ? `<small>${esc(m.endereco)}${mapa ? ` · <a href="${mapa}">mapa</a>` : ""}</small>` : ""}`;
  };
  const linhas = ts.map((t, i) => {
    const pedagios = (t.pedagios || []).reduce((a, p) => a + (Number(String(p.valor).replace(",", ".")) || 0), 0);
    return `<tr>
     <td class="rota"><b>${i + 1}</b><div>${esc(rotuloDestino(memoria, t.origem))} → ${esc(rotuloDestino(memoria, t.destino))}<small>${t.veiculo === "moto" ? "🏍 Moto" : "🚗 Carro"}</small></div></td>
     <td class="mrc">${marco2(t.abertura)}</td><td class="mrc">${marco2(t.chegada)}</td>
     <td class="num">${esc(kmFmt(kmDoTrecho(t)))}</td><td class="num">${pedagios ? esc(brl(pedagios)) : "—"}</td><td class="num">${perm[i] == null ? "—" : esc(minutosFmt(perm[i]))}</td></tr>`;
  }).join("");
  const lembretes = ts.flatMap((t) => (t.atividades || []).filter((a) => a.status === "aberto").map((a) => ({ destino: rotuloDestino(memoria, t.destino), texto: a.texto })));
  const visitas = ts.filter((t) => (t.atividades || []).some((a) => a.status !== "aberto") || t.obs).map((t) => `
   <section class="vis"><h3>${esc(rotuloDestino(memoria, t.destino))}</h3>
   ${(t.atividades || []).filter((a) => a.status !== "aberto").map((a) => {
    const [titulo, resto] = a.texto.includes(" — ") ? [a.texto.slice(0, a.texto.indexOf(" — ")), a.texto.slice(a.texto.indexOf(" — ") + 3)] : [null, a.texto];
    return `<p class="at st-${a.status || "neutro"}">${a.status === "finalizado" ? "✔ Concluído: " : ""}${titulo ? `<b>${esc(titulo)}</b> — ` : ""}${esc(resto)}</p>`;
   }).join("")}
   ${t.obs ? `<p class="obs">${esc(t.obs)}</p>` : ""}</section>`).join("");
  const kmValor = memoria?.config?.valorKm;
  const reembolso = kmValor != null ? tot.km * kmValor + tot.pedagios + tot.gastos : null;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>MK RD - ${esc(dataBR(dia?.data))}</title><style>
  @page{size:A4;margin:14mm}body{color:#142335;font:12px Arial,sans-serif;line-height:1.5;max-width:900px;margin:auto;padding:24px}
  header{display:flex;justify-content:space-between;align-items:center;gap:20px;border-bottom:3px solid #d55a26;padding-bottom:12px}header img{width:200px}
  h1{font:25px Georgia,serif;margin:0 0 2px}.sub{color:#475569;font-size:12px}
  h2{font:700 11px Arial;letter-spacing:1.4px;text-transform:uppercase;color:#d55a26;border-bottom:1px solid #e3e8ee;padding-bottom:5px;margin:26px 0 0}
  h3{font-size:13px;margin:0 0 6px}
  table{width:100%;border-collapse:collapse;margin-top:10px}
  th{font:700 9.5px Arial;letter-spacing:.8px;text-transform:uppercase;color:#64748b;text-align:left;padding:5px 8px;border-bottom:2px solid #d6dde4}
  th.num,td.num{text-align:right}
  td{padding:8px;border-bottom:1px solid #e9eef3;font-size:11.5px;vertical-align:top}
  tr:nth-child(even) td{background:#f8fafc}
  td.rota{display:flex;gap:8px;font-weight:700}td.rota>b{color:#d55a26;font-size:13px}td.rota small,td.mrc small{display:block;font-weight:400;color:#64748b;font-size:9.5px;margin-top:2px}
  td.mrc b{font-size:12.5px}td.num{font-weight:700;white-space:nowrap}
  a{color:#2563eb;text-decoration:none}
  .tot{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}.tot div{flex:1;min-width:110px;border:1px solid #d6dde4;border-left:4px solid #d55a26;border-radius:8px;padding:8px 12px;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.6px}.tot strong{display:block;font-size:16px;color:#142335;letter-spacing:0;text-transform:none;margin-top:2px}
  .vis{border-left:4px solid #2563eb;background:#f8fafc;border-radius:0 8px 8px 0;padding:10px 14px;margin-top:12px}
  .at{margin:4px 0}.st-finalizado{color:#15803d}.obs{color:#475569;font-style:italic;margin:6px 0 0}
  .lem{background:#fff7ed;border:1px solid #fdba74;border-radius:10px;padding:10px 14px;margin-top:12px}
  .lem h3{color:#b45309}.lem p{margin:4px 0;color:#7c2d12}.lem b{color:#b45309}
  .cps{display:flex;flex-wrap:wrap;gap:12px;margin-top:10px}.cps figure{margin:0;width:200px}.cps img{width:100%;border:1px solid #d6dde4;border-radius:6px}.cps figcaption{font-size:9.5px;color:#475569;margin-top:3px}
  footer{margin-top:26px;border-top:1px solid #c7ced5;padding-top:8px;font-size:9.5px;color:#64748b}</style></head><body>
  <header><div><h1>MK RD · Relatório Diário</h1><div class="sub">${esc(dataBR(dia?.data))}${consultor ? " · " + esc(consultor) : ""}</div></div><img src="${LOGO_MOKED_30}" alt="Moked 30 anos"/></header>
  <h2>01 · Trechos do dia</h2>
  <table><thead><tr><th>Trecho</th><th>Saída</th><th>Chegada</th><th class="num">Km</th><th class="num">Pedágios</th><th class="num">Permanência</th></tr></thead><tbody>${linhas || '<tr><td colspan="6">Sem trechos.</td></tr>'}</tbody></table>
  <div class="tot">
   <div>Km total<strong>${esc(kmFmt(tot.km))}</strong></div>
   <div>Pedágios<strong>${esc(brl(tot.pedagios))}</strong></div>
   <div>Outros gastos<strong>${esc(brl(tot.gastos))}</strong></div>
   <div>Jornada<strong>${hhmm({ em: tot.inicio })} – ${hhmm({ em: tot.fim })}</strong></div>
   ${reembolso != null ? `<div>Km + despesas<strong>${esc(brl(reembolso))}</strong></div>` : ""}
  </div>
  ${visitas ? `<h2>02 · Visitas e tratativas</h2>${visitas}` : ""}
  ${lembretes.length ? `<h2>03 · Lembretes para a próxima visita</h2><div class="lem"><h3>⚠ Em aberto — reaparecem automaticamente na próxima visita</h3>${lembretes.map((l) => `<p><b>${esc(l.destino)}:</b> ${esc(l.texto)}</p>`).join("")}</div>` : ""}
  ${dia?.obs ? `<h2>Observações do dia</h2><p>${esc(dia.obs)}</p>` : ""}
  ${(() => {
    const itens = ts.flatMap((t) => [...(t.pedagios || []), ...(t.gastos || [])].filter((x) => x.fotoId && fotos[x.fotoId]).map((x) => ({ ...x, rota: rotuloDestino(memoria, t.origem) + " → " + rotuloDestino(memoria, t.destino) })));
    if (!itens.length) return "";
    return `<h2>Comprovantes</h2><div class="cps">` + itens.map((x) => `<figure><img src="${fotos[x.fotoId]}" alt="Comprovante"/><figcaption>${esc(x.descricao || "Gasto")} · ${esc(brl(Number(String(x.valor).replace(",", ".")) || 0))}<br/>${esc(x.rota)}</figcaption></figure>`).join("") + `</div>`;
  })()}
  <footer>Horários e localizações cravados pelo aparelho no momento de cada marcação. Documento gerado pelo MokLog CheckTest · MK RD.</footer>
  </body></html>`;
}

export function imprimirRd(dia, memoria, consultor) {
  const win = window.open("", "_blank");
  if (!win) throw new Error("Permita a abertura da janela do relatório.");
  win.document.open(); win.document.write(htmlRd(dia, memoria, consultor)); win.document.close();
}

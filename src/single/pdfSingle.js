import {calcularInspecao,variacao,fmtVariacao,dataBR} from "./singleCalc";
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pct=v=>v==null?"—":Number(v).toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1})+"%";
import { montarLaudoSemanal } from "../relatorios/laudoSemanal";
import { escHTML } from "../relatorios/padraoMoked";
const { singleComoProjeto } = require("./singleAdaptador");
const codigoDoSingle = (single = {}) => { const limpo = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, ""); return limpo(single.codigo).slice(0, 12) || limpo(single.nome).slice(0, 12) || "SG" + limpo(single.id).slice(-4); };

// Relatório Situacional do Single no PADRÃO MOKED (Marcio, 06/11/2026): o mesmo documento do Relatório Semanal dos
// parques (hero, KPIs, disponibilidade por sistema, pendências), com numeração MK-<código>-RS-MMDD, mais o bloco de
// falhas por criticidade registradas na vistoria. `anterior` (vistoria anterior concluída) alimenta a coluna de variação.
export function htmlSingle(projeto, inspecao, anterior, { hoje = new Date() } = {}) {
  const c = calcularInspecao(inspecao), changes = variacao(c, anterior);
  const { project, stored } = singleComoProjeto({ ...projeto, id: codigoDoSingle(projeto) }, c);
  const hist = stored[project.id].history[0];
  const falhas = c.itens.flatMap((i) => (i.falhas || []).map((f) => ({ ...f, familia: i.nome }))).sort((a, b) => ["alta", "media", "baixa"].indexOf(a.criticidade) - ["alta", "media", "baixa"].indexOf(b.criticidade));
  const ROT = { alta: ["Alta", "mk-b-da"], media: ["Média", "mk-b-wa"], baixa: ["Baixa", "mk-b-ok"] };
  const linhasFalhas = falhas.map((f) => { const [r, cls] = ROT[f.criticidade] || ["—", ""]; return `<tr><td><b>${escHTML(f.familia)}</b></td><td class="mk-num">${Number(f.qtd) || 1}</td><td>${escHTML(f.descricao || "")}</td><td>${f.desde ? dataBR(f.desde) : "—"}</td><td><span class="mk-b ${cls}">${r}</span></td></tr>`; }).join("");
  const varTxt = anterior ? `<div class="mk-nota" style="margin-top:6px">Variação em relação à vistoria de ${dataBR(anterior.data)}: ${c.itens.map((i, n) => changes[n] && changes[n].disponibilidade != null && changes[n].disponibilidade !== 0 ? `${escHTML(i.nome)} ${fmtVariacao(changes[n].disponibilidade)}` : null).filter(Boolean).join(" · ") || "sem alteração"}.</div>` : "";
  const extrasHTML = (falhas.length ? `<section><div class="mk-h2">Falhas registradas na vistoria <span class="mk-mu">· ${falhas.length} ${falhas.length === 1 ? "registro" : "registros"} · por criticidade</span></div>
    <table class="mk-tb"><colgroup><col style="width:24%"><col style="width:8%"><col style="width:44%"><col style="width:12%"><col style="width:12%"></colgroup>
    <thead><tr><th>Família</th><th class="mk-num">Qtd</th><th>Descrição</th><th>Desde</th><th>Criticidade</th></tr></thead><tbody>${linhasFalhas}</tbody></table></section>` : "") + varTxt;
  return montarLaudoSemanal(project, hist.state, { date: c.data, lider: c.responsavel }, { hoje, single: { tipo: inspecao.tipo, revisao: inspecao.cenarioRevisao, codigo: projeto.codigo || "", observacoes: inspecao.observacoes || "", extrasHTML } });
}
export function imprimirSingle(p,i,a){
 const win=window.open("","_blank");
 if(!win)throw new Error("Permita a abertura da janela do relatório.");
 win.document.open();win.document.write(htmlSingle(p,i,a));win.document.close();
}

export function baixarHtmlSingle(p,i,a){
 const html=htmlSingle(p,i,a);
 const nome=String(p.nome||"single").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,40)||"single";
 const url=URL.createObjectURL(new Blob([html],{type:"text/html;charset=utf-8"}));
 const el=document.createElement("a");el.href=url;el.download="Relatorio-Single-"+nome+"-"+String(i.data||"").slice(0,10)+".html";
 document.body.appendChild(el);el.click();el.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

// ambulanciaPdf.js — Registro individual de Acesso de Ambulância no padrão visual Moked.
// Usa o mesmo padrão dos demais relatórios (relatorios/padraoMoked.js). Abre em nova aba com
// "Imprimir / Salvar PDF". O cartão (cardRegistroAmbulancia) também é reaproveitado no anexo do consolidado.
import { documentoMoked, abrirParaImpressao, escHTML as esc, dataBR } from "./relatorios/padraoMoked";

const TAG = "USO INTERNO E CONFIDENCIAL";

function idAmb(project, reg) {
  const base = reg?.id || Date.now();
  return `${project?.id || ""}-AMB-${String(base).slice(-10)}`;
}
const fmtData = (d) => dataBR(d);
const corGravidade = (g) => {
  const k = String(g || "").toLowerCase();
  if (k.startsWith("grave")) return "mk-b-da";
  if (k.startsWith("moder")) return "mk-b-wa";
  if (k.startsWith("leve")) return "mk-b-ok";
  return "mk-b-in";
};

// Cabeçalho pequeno de cada registro (usado no anexo do consolidado).
export function cabecalhoRegistroAmbulancia(project, reg) {
  return `<div class="mk-h2">Registro de atendimento <span class="mk-mu">· Nº ${esc(idAmb(project, reg))}</span></div>`;
}

// Cartão de um atendimento. Sem quebra forçada: o anexo quebra página por registro.
export function cardRegistroAmbulancia(project, reg) {
  const info = [];
  const push = (l, v) => { if (v != null && String(v).trim() !== "") info.push([l, v]); };
  push("Inquilino solicitante", reg.inquilino);
  push("Data", fmtData(reg.data));
  push("Turno", reg.turno);
  push("Hora de entrada", reg.horaEntrada);
  push("Hora de saída", reg.horaSaida);
  push("Tipo de ocorrência", reg.tipo === "Outro" && reg.tipoOutro ? reg.tipoOutro : reg.tipo);
  push("Condutor da ambulância", reg.condutor);
  push("Socorrista 1", reg.socorrista1);
  push("Socorrista 2", reg.socorrista2);
  push("Vítima removida", reg.vitimaRemovida);
  push("Acompanhante", reg.acompanhante);

  const grav = reg.gravidade || "—";
  const infoHtml = `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px 16px">${info.map(([l, v]) =>
    `<div><div class="mk-lb" style="font-size:7.6pt">${esc(l)}</div><div style="font-weight:600">${esc(v)}</div></div>`).join("")}</div>`;

  const sub = `${esc(fmtData(reg.data))}${reg.turno ? ` · ${esc(reg.turno)}` : ""}${reg.horaEntrada ? ` · Entrada ${esc(reg.horaEntrada)}` : ""}${reg.horaSaida ? ` · Saída ${esc(reg.horaSaida)}` : ""}`;

  const fotos = Array.isArray(reg.fotos) ? reg.fotos.filter(Boolean) : [];
  const galeria = fotos.length ? `<div class="mk-h2" style="margin-top:12px">Registro fotográfico</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${fotos.map((src, i) => `<div class="mk-card" style="padding:6px;page-break-inside:avoid">
      <img src="${src}" alt="Foto ${i + 1}" style="width:100%;height:170px;object-fit:cover;display:block;background:#E5E7EB;border-radius:4px">
      <div class="mk-sm" style="margin-top:4px">Foto ${i + 1}</div></div>`).join("")}</div>` : "";

  const obs = reg.observacao && reg.observacao.trim()
    ? `<div class="mk-h2" style="margin-top:12px">Observações / sintomas / tipo de socorro</div><div class="mk-dest" style="white-space:pre-wrap">${esc(reg.observacao)}</div>` : "";

  const responsavel = reg.registradoPor || "—";

  return `<section>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;border-bottom:1px solid #E5E7EB;padding-bottom:8px;margin-bottom:8px">
      <div><div class="mk-lb">Registro de atendimento</div><div style="font-size:14pt;font-weight:700;color:#111827;margin-top:2px">${esc(reg.inquilino || "Atendimento de ambulância")}</div><div class="mk-sub" style="margin:1px 0 0">${sub}</div></div>
      <div><span class="mk-b ${corGravidade(reg.gravidade)}">${esc(grav)}</span></div>
    </div>
    <div class="mk-h2">Dados do atendimento</div>${infoHtml}
    ${obs}
    ${galeria}
    <div class="mk-sm" style="width:240px;margin:18px 0 0 auto;text-align:center"><div class="mk-linha"></div><b>${esc(responsavel)}</b><div class="mk-mu">Responsável pelo registro</div></div>
  </section>`;
}

export function gerarPdfAmbulancia(project, reg) {
  if (!project || !reg) return;
  const numero = idAmb(project, reg);
  const html = documentoMoked({
    project, titulo: "Acesso de Ambulância", subtitulo: `${esc(reg.inquilino || "Registro individual")} · ${esc(fmtData(reg.data))}`,
    numero, corpo: cardRegistroAmbulancia(project, reg), tag: TAG, fimEmbutido: false,
  });
  abrirParaImpressao(html, `Ambulancia_${project.id}_${String(reg.data || "").replace(/-/g, "")}.html`);
}

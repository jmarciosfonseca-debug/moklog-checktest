// ── MokLog CheckTest — rsPdf.js (padrão Moked)
// Relatório Situacional (RS) de ocorrências: RS individual → gerarPdfRS(project, registro);
// pacote de RS → gerarPdfPacoteRS(project, registros, meta).
// Usa o padrão visual Moked (relatorios/padraoMoked.js), igual aos demais relatórios.
// LGPD: documento e telefone dos envolvidos SEMPRE mascarados no documento.
import { getNatureza, getSubtipo, RS_STATUS, FLAGS } from "./rsCatalogo";
import { documentoMoked, abrirParaImpressao, escHTML as esc } from "./relatorios/padraoMoked";

const TAG = "USO INTERNO E CONFIDENCIAL";

function fmtDataHora(iso) {
  if (!iso) return "--";
  const [d, h] = String(iso).split("T");
  if (!d) return "--";
  const [ano, mes, dia] = d.split("-");
  if (!ano) return esc(iso);
  const dataBR = `${dia}/${mes}/${ano}`;
  return h ? `${dataBR} às ${h.slice(0, 5)}` : dataBR;
}
function mascararDoc(doc) {
  if (!doc) return "";
  const so = String(doc).replace(/\D/g, "");
  if (so.length === 11) return `${so.slice(0, 3)}.***.***-${so.slice(9)}`;
  if (so.length === 14) return `${so.slice(0, 2)}.***.***/****-${so.slice(12)}`;
  if (so.length <= 4) return "***";
  return `${so.slice(0, 2)}${"*".repeat(Math.max(0, so.length - 4))}${so.slice(-2)}`;
}
function mascararTelefone(tel) {
  if (!tel) return "";
  const so = String(tel).replace(/\D/g, "");
  if (so.length < 6) return "****";
  return `(${so.slice(0, 2)}) *****-${so.slice(-2)}`;
}
function numeroRS(project, registro) {
  const seq = registro?.seq != null ? String(registro.seq).padStart(4, "0") : String(registro?.id || "----").slice(-8);
  return `MK-${project?.id || "RS"}-RS-${seq}`;
}
// Severidade → rótulo formal + classe de selo (padrão Moked)
function sevInfo(sev) {
  const map = {
    info:    { txt: "INFORMATIVO / BAIXA", cls: "mk-b-in" },
    atencao: { txt: "ATENÇÃO / MÉDIA",     cls: "mk-b-wa" },
    critico: { txt: "CRÍTICO / ALTA",      cls: "mk-b-da" },
  };
  return map[sev] || map.info;
}
// Envolvidos: formato novo (envolvidos[]) e legado.
function envolvidosDe(r) {
  if (r && Array.isArray(r.envolvidos) && r.envolvidos.length) return r.envolvidos;
  if (r && (r.nomeEnvolvido || r.documentoEnvolvido))
    return [{ nome: r.nomeEnvolvido || "", documento: r.documentoEnvolvido || "" }];
  return [];
}
const bloco = (titulo) => `<div class="mk-h2" style="margin-top:12px">${esc(titulo)}</div>`;
const texto = (conteudo) => `<div class="mk-dest" style="white-space:pre-wrap">${esc(conteudo)}</div>`;

// Um RS (cartão). Não quebra no meio da página.
function cardRS(project, registro) {
  const nat = getNatureza(registro?.natureza);
  const sub = getSubtipo(registro?.subtipo);
  const natLabel = nat?.label || registro?.natureza || "—";
  const subLabel = sub?.label || registro?.subtipo || "";
  const sev = registro?.severidade || sub?.sevPadrao || "info";
  const si = sevInfo(sev);
  const st = registro?.status || RS_STATUS.PENDENTE;
  const arq = st === RS_STATUS.ARQUIVADO;
  const stTxt = arq ? "ARQUIVADO" : "PENDENTE";
  const stCls = arq ? "mk-b-in" : "mk-b-wa";

  const evs = envolvidosDe(registro);
  const info = [];
  const push = (label, val) => { if (val) info.push([label, val]); };
  push("Data / Hora", fmtDataHora(registro?.dataHora || registro?.data));
  if (registro?.horaFim) push("Normalização", registro.horaFim);
  push("Líder Operacional", registro?.lider);
  push("Origem do Alerta", registro?.quemAvisou);
  push("Comunicado a", registro?.quemAvisado);
  if (evs[0]?.nome) push("Envolvido", evs[0].nome);
  if (evs[0]?.documento) push("Documento (CPF)", mascararDoc(evs[0].documento));
  if (registro?.telefoneEnvolvido) push("Telefone", mascararTelefone(registro.telefoneEnvolvido));
  push("Transportadora / Inquilino", registro?.transportadora || registro?.inquilino);
  const veics = (registro?.veiculos && registro.veiculos.length)
    ? registro.veiculos.filter(v => v && v.placa)
    : [registro?.placaCavalo, registro?.placaCarreta, registro?.placaVeiculo].filter(Boolean).map(p => ({ placa: p, tipo: "" }));
  if (veics.length) push("Veículo(s)", veics.map(v => v.tipo ? `${v.placa} (${v.tipo})` : v.placa).join(" · "));
  push("Local do Evento", registro?.local);

  const infoHtml = info.length
    ? `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px 16px">${info.map(([l, v]) =>
        `<div><div class="mk-lb" style="font-size:7.6pt">${esc(l)}</div><div style="font-weight:600">${esc(v)}</div></div>`).join("")}</div>`
    : "";

  const demais = evs.length > 1
    ? `${bloco("Demais envolvidos")}<div class="mk-dest">${evs.slice(1).map((ev, i) => {
        const partes = [];
        if (ev.nome) partes.push(esc(ev.nome));
        if (ev.documento) partes.push("doc " + esc(mascararDoc(ev.documento)));
        return `<div>${i + 2}º — ${partes.join(" — ")}</div>`;
      }).join("")}</div>`
    : "";

  const fl = Array.isArray(registro?.flags) ? registro.flags : [];
  const descs = registro?.flagDescs || {};
  const labelDe = (k) => (FLAGS.find(f => f.key === k)?.label) || k;
  const flagsHtml = fl.length
    ? `${bloco("Classificação secundária")}<div class="mk-dest">${fl.map(k => {
        const d = (descs[k] || "").trim();
        return `<div><b>• ${esc(labelDe(k))}</b>${d ? ` — ${esc(d)}` : ""}</div>`;
      }).join("")}</div>`
    : "";

  const fotos = Array.isArray(registro?.fotos) ? registro.fotos : [];
  const galeriaHtml = fotos.length
    ? `${bloco("Evidências fotográficas")}<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${fotos.map(f => {
        const cftv = (f?.origem || "").toUpperCase() === "CFTV";
        return `<div class="mk-card" style="padding:6px;page-break-inside:avoid">
          <img src="${f?.dataUrl || f?.url || ""}" alt="evidência" style="width:100%;height:150px;object-fit:cover;display:block;background:#E5E7EB;border-radius:4px">
          <div class="mk-sm" style="margin-top:4px"><span class="mk-b ${cftv ? "mk-b-in" : "mk-b-ok"}">${cftv ? "CFTV" : "LOCAL"}</span> ${esc(f?.legenda || "")}</div></div>`;
      }).join("")}</div>`
    : "";

  const assinante = (registro?.assinatura || registro?.lider || "").trim();
  const assinaturaHtml = assinante
    ? `<div class="mk-sm" style="width:240px;margin:18px 0 0 auto;text-align:center"><div class="mk-linha"></div><b>${esc(assinante)}</b><div class="mk-mu">Responsável pelo registro</div></div>`
    : "";

  return `<section>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;border-bottom:1px solid #E5E7EB;padding-bottom:8px;margin-bottom:8px">
      <div><div class="mk-lb">Registro operacional</div><div style="font-size:14pt;font-weight:700;color:#111827;margin-top:2px">${esc(natLabel)}</div>${subLabel ? `<div class="mk-sub" style="margin:1px 0 0">${esc(subLabel)}</div>` : ""}</div>
      <div style="text-align:right"><span class="mk-b ${si.cls}">${esc(si.txt)}</span><div style="margin-top:4px"><span class="mk-b ${stCls}">${stTxt}</span></div></div>
    </div>
    ${registro?.reincidente ? `<div class="mk-qual"><b>REINCIDENTE</b> — vinculado a ${(registro.reincidenteDe || []).length} RS anterior(es)</div>` : ""}
    ${bloco("Dados da ocorrência")}${infoHtml}
    ${demais}
    ${registro?.resumo ? `${bloco("Resumo do evento")}<div style="font-weight:700;font-size:10.5pt">${esc(registro.resumo)}</div>` : ""}
    ${registro?.detalhamento ? `${bloco("Detalhamento operacional")}${texto(registro.detalhamento)}` : ""}
    ${registro?.medidas ? `${bloco("Medidas imediatas adotadas")}<div class="mk-qual" style="white-space:pre-wrap">${esc(registro.medidas)}</div>` : ""}
    ${registro?.observacao ? `${bloco("Observações de inteligência / CFTV")}${texto(registro.observacao)}` : ""}
    ${flagsHtml}
    ${galeriaHtml}
    ${assinaturaHtml}
  </section>`;
}

// Slug do nome do arquivo a partir da ocorrência escolhida em campo.
function slugOcorrencia(txt) {
  return (txt || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-{2,}/g, "-")
    .slice(0, 60) || "ocorrencia";
}
function tituloOcorrencia(registro) {
  const sub = getSubtipo(registro?.subtipo);
  return sub?.label || registro?.natureza || "Ocorrência";
}

// ── API pública ───────────────────────────────────────────────
export function gerarPdfRS(project, registro) {
  if (!project || !registro) return;
  const sub = getSubtipo(registro?.subtipo);
  const subtitulo = sub?.label ? `Ocorrência: ${esc(sub.label)}` : "Ocorrência";
  const nomeOcorr = tituloOcorrencia(registro);
  const html = documentoMoked({
    project, titulo: "Relatório Situacional (RS)", subtitulo, numero: numeroRS(project, registro),
    corpo: cardRS(project, registro), tag: TAG,
  });
  abrirParaImpressao(html, `RS_${project.id}_${slugOcorrencia(nomeOcorr)}.html`);
}

export function gerarPdfPacoteRS(project, registros, meta = {}) {
  if (!project || !Array.isArray(registros) || registros.length === 0) return;
  const n = registros.length;
  const subtitulo = esc(meta.titulo || `Pacote de ${n} ocorrência${n > 1 ? "s" : ""}`);
  const dataArq = new Date().toLocaleDateString("sv-SE");
  const corpo = registros.map((r, i) =>
    `<div${i ? ' style="page-break-before:always"' : ""}>${cardRS(project, r)}</div>`).join("");
  const html = documentoMoked({
    project, titulo: "Relatório Situacional (RS) — Pacote", subtitulo, numero: `MK-${project.id}-RS-PACOTE-${dataArq}`,
    corpo, tag: TAG, hoje: new Date(),
  });
  abrirParaImpressao(html, `RS_${project.id}_pacote_${dataArq}.html`);
}

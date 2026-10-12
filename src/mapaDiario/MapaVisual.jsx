// Mapa de Equipe diário — visão de leitura (gerencial): o mapa já preenchido, direto e visual.
// Só mostra; não edita nem grava. Ocorrências (falta, FT, atraso…) em destaque no topo; falta de quem a FT cobriu sempre aparece.
import { ocorrenciasDoMapa, detalheDoPosto, liderDoMapa } from "./consolidado";
import { kmRodado } from "./modelo";
import { fotoDaPessoa, iniciais } from "./fotos";

export const ESTILO = {
  presente: { cor: "#16a34a", ic: "✓", rot: "Presente" },
  falta: { cor: "#dc2626", ic: "✕", rot: "Falta" },
  ft: { cor: "#2563eb", ic: "↻", rot: "FT" },
  atraso: { cor: "#d97706", ic: "◔", rot: "Atraso" },
  cobertura: { cor: "#7c3aed", ic: "⇄", rot: "Cobertura" },
  troca: { cor: "#0891b2", ic: "⇆", rot: "Troca" },
  vago: { cor: "#64748b", ic: "○", rot: "Sem ninguém" },
};
const est = (s) => ESTILO[s] || ESTILO.presente;
const dataBR = (iso) => (iso ? iso.split("-").reverse().join("/") : "—");
const horaBR = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }); };

export function Pilula({ tipo, children }) {
  const e = est(tipo);
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: e.cor + "22", color: e.cor, border: `1px solid ${e.cor}55`, borderRadius: 999, padding: "2px 9px", fontSize: 11.5, fontWeight: 800, whiteSpace: "nowrap" }}>{e.ic} {children || e.rot}</span>;
}

// Foto do cadastro; sem foto, as iniciais. `fotos` = { porId, porNome } (fotos.js) ou nulo.
export function Avatar({ fotos, pessoaId, nome, tam = 36, dark, cor = "#64748b" }) {
  const src = fotoDaPessoa(fotos, pessoaId, nome);
  const base = { width: tam, height: tam, borderRadius: "50%", flexShrink: 0, border: `2px solid ${cor}` };
  return src
    ? <img src={src} alt={nome || "Colaborador"} data-testid="avatar-foto" style={{ ...base, objectFit: "cover" }} />
    : <span aria-hidden="true" data-testid="avatar-iniciais" style={{ ...base, display: "inline-flex", alignItems: "center", justifyContent: "center", background: dark ? "#1e293b" : "#e2e8f0", color: dark ? "#cbd5e1" : "#475569", fontSize: Math.round(tam * 0.36), fontWeight: 800 }}>{iniciais(nome)}</span>;
}

export default function MapaVisual({ mapa, dark, fotos = null }) {
  const txt = dark ? "#f1f5f9" : "#0f172a";
  const txt2 = dark ? "#94a3b8" : "#64748b";
  const borda = dark ? "#1e293b" : "#e2e8f0";
  const fundo = dark ? "#0b1220" : "#f8fafc";
  const postos = mapa.postos || [];
  const ocs = ocorrenciasDoMapa(mapa);
  const lider = liderDoMapa(mapa);
  const mat = mapa.material || { semAlteracao: true };
  const exc = mat.excecoes || [];
  const veic = (mapa.veiculos || []).map((v) => ({ rotulo: v.rotulo || "Veículo", r: kmRodado(v) })).filter((v) => v.r != null);
  const vis = mapa.visita && typeof mapa.visita.houve === "boolean" ? (mapa.visita.houve ? `Visita de ${mapa.visita.supervisor || "supervisão"} neste plantão` : "Sem visita neste plantão") : "";
  const ult = mapa.supervisao && mapa.supervisao.ultimaData ? `Última visita: ${dataBR(mapa.supervisao.ultimaData)}${mapa.supervisao.supervisor ? ` (${mapa.supervisao.supervisor.trim()})` : ""}` : "";
  const rascunho = mapa.status !== "enviado";

  return (
    <div data-testid="mapa-visual" style={{ background: fundo, border: `1px solid ${borda}`, borderRadius: 12, padding: 10, display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", fontSize: 12, color: txt2 }}>
        <span>Líder: <b style={{ color: txt }}>{lider || "—"}</b></span>
        <span>{rascunho ? <Pilula tipo="atraso">Rascunho — ainda não concluído</Pilula> : `Concluído ${horaBR(mapa.enviadoEm)} · ${dataBR((mapa.enviadoEm || "").slice(0, 10) || mapa.data)}`}</span>
      </div>

      {ocs.length > 0 && (
        <div style={{ border: "1px solid #dc262655", background: "#dc262612", borderRadius: 10, padding: "6px 10px", display: "grid", gap: 4 }}>
          {ocs.map((o, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap", fontSize: 12.5 }}>
              <Avatar fotos={fotos} pessoaId={o.pessoaId} nome={o.pessoa} tam={26} dark={dark} cor={est(o.tipo).cor} />
              <Pilula tipo={o.tipo} />
              <b style={{ color: txt }}>{o.pessoa || "—"}</b>
              <span style={{ color: txt2 }}>{o.posto && o.posto !== "—" ? `${o.posto}` : ""}{o.detalhe ? `${o.posto && o.posto !== "—" ? " · " : ""}${o.detalhe}` : ""}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gap: 4 }}>
        {postos.map((p, i) => {
          const e = est(p.situacao || "presente");
          const { detalhe } = p.situacao && p.situacao !== "presente" ? detalheDoPosto(p, postos) : { detalhe: "" };
          return (
            <div key={p.id || i} style={{ display: "flex", alignItems: "center", gap: 10, borderLeft: `4px solid ${e.cor}`, background: dark ? "#0f172a" : "#fff", borderRadius: 8, padding: "6px 10px" }}>
              <Avatar fotos={fotos} pessoaId={p.pessoaId} nome={p.pessoaNome} dark={dark} cor={e.cor} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: txt2, textTransform: "uppercase", letterSpacing: ".05em" }}>{p.rotulo || "Posto"}{p.horario ? ` · ${String(p.horario.inicio || "").replace(":", "h")}–${String(p.horario.fim || "").replace(":", "h")}` : ""}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: txt, overflowWrap: "anywhere" }}>{(p.pessoaNome || "").trim() || "—"}</div>
                {detalhe && <div style={{ fontSize: 11.5, color: txt2 }}>{detalhe}</div>}
              </div>
              <Pilula tipo={p.situacao || "presente"} />
            </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gap: 3, fontSize: 12.5, color: txt }}>
        <div><b>Material:</b> {mat.semAlteracao && !exc.length ? <span style={{ color: "#16a34a", fontWeight: 700 }}>✓ Sem alteração</span> : <span style={{ color: "#d97706", fontWeight: 700 }}>⚠ Com alteração — {exc.map((x) => `${x.nome} (${x.situacao === "indisponivel" ? "indisponível" : "anomalia"}${x.obs ? `: ${x.obs}` : ""})`).join("; ") || (mat.obs || "")}</span>}</div>
        {veic.length > 0 && <div><b>Km rodado:</b> {veic.map((v) => `${v.rotulo} ${v.r} km`).join(" · ")}</div>}
        {(vis || ult) && <div><b>Supervisão:</b> {[vis, ult].filter(Boolean).join(" · ")}</div>}
        {(mapa.resumo || "").trim() && <div><b>Resumo da passagem:</b> <span style={{ color: txt2 }}>{mapa.resumo.trim()}</span></div>}
        {(mapa.observacoes || "").trim() && <div><b>Observações:</b> <span style={{ color: txt2 }}>{mapa.observacoes.trim()}</span></div>}
      </div>
    </div>
  );
}

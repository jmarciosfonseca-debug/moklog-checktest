// Visão "equipe montada" (líder → membros, por turno). Compartilhada entre o módulo Equipe (líder/gerencial,
// com botão Montar/Editar) e a Área do Cliente (só leitura). Sem acesso ao banco: recebe colaboradores e fotos.
import { useState } from "react";
import { Ico } from "../Icones";
import { pertenceA, semEquipeAlguma } from "./vinculos";
import { fotoDe } from "../fotosEquipe";

export const EQUIPES_EXCLUIDOS = ["P260A", "P260B", "P260C"];
export const TURNO_CONFIG = {
  "Diurno":    { bg: "#1a2e1a", border: "#22c55e33", badge: "#22c55e", icon: <><Ico n="sol"/></> },
  "Noturno":   { bg: "#0a0a2e", border: "#6366f133", badge: "#818cf8", icon: <><Ico n="lua"/></> },
  "Folguista": { bg: "#1a1a10", border: "#f59e0b33", badge: "#f59e0b", icon: <><Ico n="sol"/><Ico n="lua"/></> },
  "Ferista":   { bg: "#0a1a2e", border: "#0ea5e933", badge: "#0ea5e9", icon: <><Ico n="atualizar"/></> },
};
export function TurnoIcone({ turno, tc, size = 44 }) {
  const [falhou, setFalhou] = useState(false);
  const slug = String(turno || "").toLowerCase();
  if (falhou) return <span style={{ fontSize: Math.round(size * 0.55), display: "inline-flex", color: tc.badge }}>{tc.icon}</span>;
  return <img src={`/icones/modulos/turno-${slug}.svg`} alt="" width={size} height={size} draggable={false}
    onError={() => setFalhou(true)} style={{ display: "block", filter: `drop-shadow(0 0 8px ${tc.badge}66)` }}/>;
}
export function montarEquipesDisponivel(projectId, colaboradores) {
  if (EQUIPES_EXCLUIDOS.includes(projectId)) return false;
  const ativos = (colaboradores || []).filter((c) => (c.status || "ativo") === "ativo");
  if (ativos.length === 0) return true;
  const n1236 = ativos.filter((c) => String(c.escala || "12x36").includes("12x36")).length;
  return n1236 / ativos.length >= 0.5;
}
// "Líder" no cargo sempre encabeça; "Ronda" só encabeça em projetos SEM cargo de líder (ex.: P607).
export const temCargoLider = (colaboradores) => (colaboradores || []).some((c) => /l[íi]der/i.test(String(c?.cargo || "")));
export function ehLider(c, colaboradores) {
  const cg = String(c?.cargo || "");
  if (/l[íi]der/i.test(cg)) return true;
  if (/ronda/i.test(cg) && colaboradores && !temCargoLider(colaboradores)) return true;
  return false;
}

export function AvatarEquipe({ colab, fotos, size = 52, border = "#1e293b" }) {
  const src = fotoDe(colab, fotos);
  return <div style={{ width: size, height: size, borderRadius: size / 4, overflow: "hidden", border: `2px solid ${border}`, flexShrink: 0, background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", color: "#475569" }}>
    {src ? <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/> : <span style={{ fontSize: size * 0.45 }}><Ico n="usuario"/></span>}
  </div>;
}

// props: colaboradores (todos), fotos (mapa ref→dataUrl), dark, onSelecionar(colab), onMontar(liderId) [opcional: mostra Montar/Editar]
export default function EquipesMontadas({ colaboradores, fotos = {}, dark = true, onSelecionar, onMontar }) {
  const txt = dark ? "#f1f5f9" : "#0f172a";
  const ativos = (colaboradores || []).filter((c) => c && (c.status || "ativo") === "ativo");
  const lideres = ativos.filter((c) => ehLider(c, colaboradores)).sort((a, b) => (a.turno || "").localeCompare(b.turno || ""));
  const semEquipe = ativos.filter((c) => !ehLider(c, colaboradores) && semEquipeAlguma(c));
  const turnos = [...new Set(lideres.map((l) => l.turno))];
  return <div data-testid="equipes-montadas" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    {turnos.map((turno) => {
      const tc = TURNO_CONFIG[turno] || TURNO_CONFIG["Diurno"];
      return <div key={turno}>
        <div style={{ fontSize: 12, fontWeight: 700, color: tc.badge, marginBottom: 8, letterSpacing: .5, display: "flex", alignItems: "center", gap: 8 }}><TurnoIcone turno={turno} tc={tc} size={26}/> {String(turno || "").toUpperCase()}</div>
        {lideres.filter((l) => l.turno === turno).map((lider) => {
          const membros = ativos.filter((c) => pertenceA(c, lider.id));
          return <div key={lider.id} style={{ border: `1px solid ${dark ? "#232b4a" : "#e2e8f0"}`, borderRadius: 12, padding: 10, marginBottom: 10, background: dark ? "#0a1120" : "#fff" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, padding: 8, background: dark ? "#0d1f2e" : "#f0f9ff", borderRadius: 8, border: "1px solid #0ea5e933" }}>
              <AvatarEquipe colab={lider} fotos={fotos} size={34} border="#0ea5e9"/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: txt }}>{lider.nome}</div>
                <div style={{ fontSize: 10, color: "#0ea5e9" }}>{lider.cargo}</div>
              </div>
              {onMontar && <button onClick={() => onMontar(lider.id)} style={{ background: dark ? "#020510" : "#f8fafc", border: "1px solid #0ea5e944", color: "#0ea5e9", borderRadius: 6, padding: "5px 10px", fontSize: 10, cursor: "pointer", fontWeight: 600 }}>
                {membros.length ? <><Ico n="editar"/>{" Editar"}</> : <><Ico n="mais"/>{" Montar"}</>}
              </button>}
            </div>
            {membros.length === 0 ? <div style={{ fontSize: 11, color: "#64748b", padding: "8px 0 2px 20px" }}>Sem membros vinculados</div>
              : membros.map((m) => <div key={m.id} onClick={() => onSelecionar && onSelecionar(m)} role={onSelecionar ? "button" : undefined}
                style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 8px 7px 20px", marginTop: 4, position: "relative", cursor: onSelecionar ? "pointer" : "default" }}>
                <div style={{ position: "absolute", left: 8, top: 0, bottom: "50%", width: 2, background: dark ? "#232b4a" : "#cbd5e1" }}/>
                <div style={{ position: "absolute", left: 8, top: "50%", width: 9, height: 2, background: dark ? "#232b4a" : "#cbd5e1" }}/>
                <AvatarEquipe colab={m} fotos={fotos} size={28} border={dark ? "#232b4a" : "#e2e8f0"}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: txt }}>{m.nome}</div>
                  <div style={{ fontSize: 9.5, color: "#94a3b8" }}>{m.cargo}</div>
                </div>
              </div>)}
          </div>;
        })}
      </div>;
    })}
    {semEquipe.length > 0 && <div style={{ opacity: .75, fontSize: 11, color: "#94a3b8", padding: 10, border: `1px dashed ${dark ? "#232b4a" : "#cbd5e1"}`, borderRadius: 8 }}>
      <Ico n="usuarios"/> Sem equipe ({semEquipe.length}): {semEquipe.map((c) => c.nome).join(", ")}
    </div>}
    {lideres.length === 0 && <div style={{ fontSize: 12, color: "#64748b", textAlign: "center", padding: 16 }}>Nenhum líder cadastrado. Cadastre colaboradores com cargo de líder para montar as equipes.</div>}
  </div>;
}

// "Ver" do painel gerencial: plantão atual + os três anteriores de um projeto, em cascata (toca no plantão e o mapa abre).
// Leitura direta por id (equipes/{pid}/mapas/{projeto_data_turno}); nada é gravado. Falha de leitura é dita, nunca vira "sem mapa".
import { useEffect, useMemo, useState } from "react";
import { chaveMapa, somarDias, rotuloDia } from "./regras";
import { horarioDoTurno } from "./horarios";
import { rotuloTurno } from "./texto";
import { loadMapa } from "./dados";
import { loadFotosProjeto } from "./fotos";
import { ocorrenciasDoMapa } from "./consolidado";
import MapaVisual, { Pilula } from "./MapaVisual";

export const QTD_PLANTOES = 4; // o atual + 3 anteriores

// Plantões do mais novo para o mais antigo, a partir do vigente (D ← N do dia anterior ← D ← N…).
export function plantoesRecentes(data, turno, qtd = QTD_PLANTOES) {
  const out = [];
  let d = data, t = turno;
  for (let i = 0; i < qtd; i++) {
    out.push({ data: d, turno: t });
    if (t === "N") t = "D"; else { t = "N"; d = somarDias(d, -1); }
  }
  return out;
}

const dm = (iso) => iso.split("-").reverse().slice(0, 2).join("/");

export default function VerMapasProjeto({ projetoId, data, turno, dark, ler = loadMapa, lerFotos = loadFotosProjeto }) {
  const txt = dark ? "#f1f5f9" : "#0f172a";
  const txt2 = dark ? "#94a3b8" : "#64748b";
  const borda = dark ? "#1e293b" : "#e2e8f0";
  const plantoes = useMemo(() => plantoesRecentes(data, turno), [data, turno]);
  const [itens, setItens] = useState(null); // null = lendo
  const [aberto, setAberto] = useState(0); // o atual já vem aberto
  const [fotos, setFotos] = useState(null); // chega depois dos mapas; sem foto (ou falha), a tela mostra as iniciais

  useEffect(() => {
    let vivo = true;
    setFotos(null);
    Promise.resolve().then(() => lerFotos(projetoId)).then((f) => { if (vivo) setFotos(f); }).catch(() => { /* sem foto: iniciais */ });
    return () => { vivo = false; };
  }, [projetoId, lerFotos]);

  useEffect(() => {
    let vivo = true;
    setItens(null);
    Promise.all(plantoes.map(async (p) => {
      try { return { ...p, mapa: await ler(projetoId, chaveMapa(projetoId, p.data, p.turno)), erro: false }; }
      catch (e) { return { ...p, mapa: null, erro: true }; }
    })).then((r) => { if (vivo) setItens(r); });
    return () => { vivo = false; };
  }, [projetoId, plantoes, ler]);

  if (!itens) return <div style={{ padding: "8px 4px", fontSize: 12, color: txt2 }}>Lendo os mapas…</div>;
  return (
    <div data-testid="ver-mapas" style={{ display: "grid", gap: 6, padding: "6px 0 10px 14px", borderLeft: `2px solid ${borda}`, marginLeft: 3 }}>
      {itens.map((it, idx) => {
        const h = horarioDoTurno(projetoId, it.turno);
        const m = it.mapa;
        const ocs = m ? ocorrenciasDoMapa(m) : [];
        const faltas = ocs.filter((o) => o.tipo === "falta").length;
        const fts = ocs.filter((o) => o.tipo === "ft").length;
        const outras = ocs.length - faltas - fts;
        const aberto_ = aberto === idx;
        return (
          <div key={`${it.data}${it.turno}`}>
            <div onClick={() => setAberto(aberto_ ? -1 : idx)} role="button" aria-expanded={aberto_} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", cursor: "pointer", padding: "6px 8px", borderRadius: 8, border: `1px solid ${borda}`, background: aberto_ ? (dark ? "#0f172a" : "#f1f5f9") : "transparent" }}>
              <div style={{ flex: 1, minWidth: 130 }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: txt }}>{idx === 0 ? "Plantão atual" : idx === 1 ? "Anterior" : `${idx}º anterior`} · {rotuloTurno(it.turno, h)}</div>
                <div style={{ fontSize: 11, color: txt2 }}>{rotuloDia(it.data)}, {dm(it.data)}</div>
              </div>
              {it.erro ? <span style={{ fontSize: 11.5, color: "#dc2626", fontWeight: 700 }}>Não consegui ler</span>
                : !m ? <span style={{ fontSize: 11.5, color: txt2, fontWeight: 700 }}>Sem mapa</span>
                : (
                  <>
                    {faltas > 0 && <Pilula tipo="falta">{faltas} falta{faltas > 1 ? "s" : ""}</Pilula>}
                    {fts > 0 && <Pilula tipo="ft">{fts} FT</Pilula>}
                    {outras > 0 && <Pilula tipo="atraso">{outras} outra{outras > 1 ? "s" : ""}</Pilula>}
                    {!ocs.length && m.status === "enviado" && <Pilula tipo="presente">Sem ocorrência</Pilula>}
                    {m.status !== "enviado" && <Pilula tipo="atraso">Rascunho</Pilula>}
                  </>
                )}
              <span style={{ color: txt2, fontSize: 16 }}>{aberto_ ? "⌄" : "›"}</span>
            </div>
            {aberto_ && (
              <div style={{ marginTop: 6 }}>
                {m ? <MapaVisual mapa={m} dark={dark} fotos={fotos} />
                  : <div style={{ fontSize: 12, color: it.erro ? "#dc2626" : txt2, padding: "6px 4px" }}>{it.erro ? "Não consegui ler este mapa agora. Tente de novo em instantes." : idx === 0 ? "Este plantão ainda não tem mapa preenchido." : "Não há mapa para este plantão."}</div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

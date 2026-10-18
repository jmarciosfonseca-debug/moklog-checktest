// "De plantão pelo Mapa de Equipe": atalho de um toque para escolher quem está REALMENTE no posto (cobertura, FT,
// troca e Base digitada incluídos; quem faltou não aparece). Usado nos registros do turno. Sem mapa do turno, não aparece.
import { useEffect, useState } from "react";
import { turnoVigente } from "./painel";
import { rotuloNoPlantao, turnoDoMapa } from "./plantao";
import * as dados from "./dados";

const dataBR = (iso) => String(iso || "").split("-").reverse().join("/");

// data/turno: o plantão do registro ("D"/"N" ou "diurno"/"noturno"). undefined = plantão em vigor do projeto; null = não lê.
// filtro(pessoa) → boolean: só mostra quem serve para aquele campo (ex.: só cadastrados).
export function usePlantaoDoMapa(projectId, data, turno, io = dados) {
  const [res, setRes] = useState(null);
  useEffect(() => {
    let vivo = true;
    setRes(null);
    (async () => {
      try {
        if (data === null || turno === null) return;          // null = desligado (ex.: formulário fechado)
        let d = data, t = turno;
        if (!d || !t) { const v = turnoVigente(projectId, new Date()); if (!v) return; d = v.data; t = v.turno; }
        const r = io.loadPlantaoDoMapa ? await io.loadPlantaoDoMapa(projectId, d, turnoDoMapa(t)) : null;
        if (vivo && r) setRes({ ...r, data: d, turno: turnoDoMapa(t) });
      } catch (e) { /* sem mapa ou sem leitura: o registro segue como sempre */ }
    })();
    return () => { vivo = false; };
  }, [projectId, data, turno]); // eslint-disable-line
  return res;
}

export default function PlantaoDoMapa({ plantao, selecionado = "", onEscolher, filtro = null, dark, titulo = "De plantão pelo Mapa de Equipe" }) {
  if (!plantao || !plantao.pessoas || !plantao.pessoas.length) return null;
  const lista = filtro ? plantao.pessoas.filter(filtro) : plantao.pessoas;
  if (!lista.length) return null;
  const cor = dark ? { txt: "#f1f5f9", txt2: "#94a3b8", borda: "#1e293b", ac: "#0ea5e9", fundo: "#001a2e" } : { txt: "#0f172a", txt2: "#64748b", borda: "#e2e8f0", ac: "#0284c7", fundo: "#e0f2fe" };
  const norm = (s) => String(s || "").trim().toLowerCase();
  return (
    <div data-testid="plantao-do-mapa" style={{ border: `1px solid ${cor.ac}55`, borderRadius: 10, padding: "8px 10px", marginBottom: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: cor.ac, marginBottom: 6 }}>
        {titulo} · {plantao.turno === "N" ? "noturno" : "diurno"} {dataBR(plantao.data)}{plantao.mapa && plantao.mapa.status !== "enviado" ? " (rascunho)" : ""}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {lista.map((x) => {
          const on = norm(selecionado) === norm(x.pessoaNome);
          return (
            <button type="button" key={`${x.postoId}:${x.pessoaId || x.pessoaNome}`} aria-pressed={on} aria-label={`Usar ${x.pessoaNome} (Mapa de Equipe)`} onClick={() => onEscolher && onEscolher(x)}
              style={{ background: on ? cor.fundo : "transparent", border: `1px solid ${on ? cor.ac : cor.borda}`, color: on ? cor.ac : cor.txt, borderRadius: 999, padding: "6px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer", minHeight: 32 }}>
              {on ? "✓ " : ""}{rotuloNoPlantao(x)}{x.lider ? " · líder" : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}

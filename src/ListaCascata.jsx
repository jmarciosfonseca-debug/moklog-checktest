import { useState } from "react";
import { ordenarRecentePrimeiro, cortarCascata, CASCATA_VISIVEIS } from "./listaCascata";

// Envolve uma lista datada: ordena (mais recente primeiro), mostra N e oferece "ver mais".
export default function ListaCascata({ itens, campos, render, n = CASCATA_VISIVEIS, dark = true, rotulo = "anteriores" }) {
  const [aberto, setAberto] = useState(false);
  const ordenada = ordenarRecentePrimeiro(itens, campos);
  const { itens: vis, resto, cabe } = cortarCascata(ordenada, aberto, n);
  return <>
    {vis.map(render)}
    {cabe && <button type="button" onClick={() => setAberto(a => !a)} style={{ alignSelf: "flex-start", background: "transparent", border: `1px solid ${dark ? "#33415566" : "#cbd5e1"}`, color: dark ? "#94a3b8" : "#475569", fontSize: 10, cursor: "pointer", padding: "4px 10px", borderRadius: 6, marginTop: 2 }}>
      {aberto ? `▴ Mostrar só as últimas ${n}` : `▾ Ver mais ${resto} (${rotulo})`}
    </button>}
  </>;
}

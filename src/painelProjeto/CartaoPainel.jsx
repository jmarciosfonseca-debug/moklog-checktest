// Cartão de entrada do Painel do projeto, na tela do projeto. Carrega em segundo plano: a tela do projeto abre na mesma
// velocidade de sempre e a nota aparece logo depois. Projeto fora desta versão mostra "Painel disponível em breve".
import { useEffect, useState } from "react";
import "@fontsource-variable/archivo";
import "@fontsource-variable/public-sans";
import "../tema/tokensOlam.css";
import { carregarPainel, painelEmMemoria } from "./carregar";
import { painelDisponivel } from "./dados";
import { classeFaixa } from "./PainelProjeto";

export default function CartaoPainel({ project, history, ctmk, dark = true, onAbrir, carregar = carregarPainel }) {
  const disponivel = painelDisponivel(project.id);
  const [r, setR] = useState(() => (disponivel ? painelEmMemoria(project.id) : null));
  const [falhou, setFalhou] = useState(false);
  useEffect(() => {
    if (!disponivel) return undefined; let vivo = true; setFalhou(false);
    const m = painelEmMemoria(project.id); if (m) { setR(m); return undefined; }
    setR(null);
    carregar({ pid: project.id, project, history, ctmk }).then((x) => { if (vivo) setR(x); }).catch(() => { if (vivo) setFalhou(true); });
    return () => { vivo = false; };
  }, [project.id, disponivel]);
  const cls = `olam ol-entrada${dark ? "" : " olam-claro"}`;
  if (!disponivel) return (
    <button type="button" className={cls} disabled data-testid="cartao-painel">
      <div className="ol-entrada-nota ol-semdado">—</div>
      <div><div className="ol-entrada-tit">Painel do projeto</div><div className="ol-entrada-sub">Painel disponível em breve.</div></div>
    </button>
  );
  return (
    <button type="button" className={cls} data-testid="cartao-painel" onClick={() => onAbrir(r)} aria-label="Abrir o Painel do projeto">
      <div className={`ol-entrada-nota ${r ? classeFaixa(r.faixa) : "ol-semdado"}`}>{r && r.nota !== null ? r.nota : "…"}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="ol-entrada-tit">Painel do projeto{r ? <> — nota {r.nota === null ? "—" : r.nota} · <span className={classeFaixa(r.faixa)}>{r.faixa}</span></> : ""}</div>
        <div className="ol-entrada-sub">{r ? (r.travas.length ? `${r.travas.length === 1 ? "1 trava em vigor" : `${r.travas.length} travas em vigor`} · toque para ver por quê` : "Toque para ver de onde vem cada ponto") : falhou ? "Não foi possível calcular agora. Toque para tentar." : "Calculando a nota…"}</div>
      </div>
      <span aria-hidden="true" style={{ color: "var(--ol-fg-muted)", fontSize: "1.2rem" }}>›</span>
    </button>
  );
}

// SIS+ na Área do Cliente (Marcio, 10/11/2026) — mostrador 360°, pilares RT/RH/RA, favoritos e detalhe por indicador.
// Só leitura. A nota vem de sis.js (calcularSIS); aqui é só a tela, no padrão visual do cluster Moked.
import { C } from "./Cluster";
import { ORDEM_PILARES, PILARES, REGUAS, faixa } from "./sis";

const CHANFRO8 = "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)";
const ANEL = "conic-gradient(from 180deg, #b91c1c 0deg, #ef4444 25deg, #f97316 55deg, #facc15 95deg, #84cc16 135deg, #16a34a 180deg, #84cc16 225deg, #facc15 265deg, #f97316 305deg, #ef4444 335deg, #b91c1c 360deg)";
const MASCARA = "radial-gradient(circle, transparent 58%, #000 59%, #000 70%, transparent 71%)";
const txt = (v) => (typeof v === "number" ? `${v}%` : "—");
const botaoLimpo = { background: "transparent", border: "none", color: "inherit", cursor: "pointer", textAlign: "left", padding: 0, font: "inherit" };

// Mostrador 360°: vermelho na base, verde no topo; 0% embaixo e sobe pelo lado direito até 100% no topo.
export function Mostrador360({ valor, regua, onMais, tam = 300 }) {
  const v = typeof valor === "number" ? Math.max(0, Math.min(100, valor)) : null;
  const f = faixa(v, regua);
  const cx = 150, cy = 150, t = ((v ?? 0) * 1.8 * Math.PI) / 180;
  const P = (r, d = 0) => [cx + Math.sin(t + d) * r, cy + Math.cos(t + d) * r];
  const [ax, ay] = P(134), [l1x, l1y] = P(98, 0.07), [l2x, l2y] = P(98, -0.07), [i1x, i1y] = P(86), [i2x, i2y] = P(120);
  const ticks = [];
  for (let i = 0; i < 60; i++) { const u = (i * 6 * Math.PI) / 180, r1 = i % 5 ? 126 : 121; ticks.push(<line key={i} x1={cx + Math.sin(u) * r1} y1={cy - Math.cos(u) * r1} x2={cx + Math.sin(u) * 130} y2={cy - Math.cos(u) * 130} stroke={i % 5 ? "#00000066" : "#000000aa"} strokeWidth={i % 5 ? 1 : 2} />); }
  return <div role="img" aria-label={`SIS+ condição geral: ${v === null ? "sem dado" : `${v}% · ${f.rotulo}`}`} style={{ position: "relative", width: "100%", maxWidth: tam, aspectRatio: "1 / 1", margin: "8px auto 4px" }}>
    <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: ANEL, WebkitMaskImage: MASCARA, maskImage: MASCARA, opacity: v === null ? 0.35 : 1 }} />
    <div style={{ position: "absolute", inset: "16%", borderRadius: "50%", background: "radial-gradient(circle at 50% 40%, #17171c 0%, #09090b 70%)", border: "1px solid #26262c", boxShadow: "inset 0 0 30px #000" }} />
    <svg viewBox="0 0 300 300" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} aria-hidden="true">
      {ticks}
      {v !== null && <g style={{ filter: "drop-shadow(0 0 4px #ffffffaa)" }}>
        <line x1={i1x} y1={i1y} x2={i2x} y2={i2y} stroke="#f3f4f6" strokeWidth={3} strokeLinecap="round" />
        <polygon points={`${ax},${ay} ${l1x},${l1y} ${l2x},${l2y}`} fill="#f3f4f6" />
      </g>}
    </svg>
    <div style={{ position: "absolute", top: "23%", left: 0, right: 0, textAlign: "center", fontWeight: 900, letterSpacing: 5, fontSize: 15, color: "#f3f4f6" }}>MOKED</div>
    <div style={{ position: "absolute", top: "33%", left: 0, right: 0, textAlign: "center", fontSize: "clamp(36px, 15vw, 52px)", fontWeight: 900, letterSpacing: -1, lineHeight: 1, fontVariantNumeric: "tabular-nums", color: v === null ? "#6b7280" : "#f3f4f6" }}>{txt(v)}</div>
    <div style={{ position: "absolute", top: "56%", left: 0, right: 0, textAlign: "center" }}><span style={{ fontSize: 12, fontWeight: 800, padding: "5px 12px", background: f.cor + "22", color: f.cor, border: `1px solid ${f.cor}88`, clipPath: "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)" }}>Condição geral · {f.rotulo}</span></div>
    <div style={{ position: "absolute", bottom: "22%", left: 0, right: 0, textAlign: "center" }}>
      <b style={{ fontSize: 22, fontWeight: 900, fontStyle: "italic", letterSpacing: 1, color: "#f3f4f6" }}>SIS<sup style={{ color: "#FF1E27" }}>+</sup></b>
      <div style={{ fontSize: 8.5, color: "#9ca3af", letterSpacing: 0.5, textTransform: "uppercase" }}>Sistema Integrado de Segurança</div>
    </div>
    {onMais && <button onClick={onMais} aria-label="Ver detalhes do SIS+" style={{ position: "absolute", right: -4, top: "50%", transform: "translateY(-50%)", width: 42, height: 42, borderRadius: "50%", background: "#0b0b0e", border: "2px solid #f3f4f6", color: "#fff", fontSize: 24, fontWeight: 300, lineHeight: "36px", cursor: "pointer", boxShadow: "0 0 0 4px #000, 0 0 18px #FF1E2766" }}>+</button>}
  </div>;
}

// Semicírculo pequeno (pilar).
export function Semi({ valor, regua, tam = 90 }) {
  const f = faixa(valor, regua), r = tam / 2 - 7, c = tam / 2, L = Math.PI * r, v = typeof valor === "number" ? valor : 0;
  return <svg width={tam} height={tam / 2 + 8} viewBox={`0 0 ${tam} ${tam / 2 + 8}`} aria-hidden="true" style={{ display: "block", flexShrink: 0 }}>
    <path d={`M7 ${c} A${r} ${r} 0 0 1 ${tam - 7} ${c}`} stroke="#1f1f25" strokeWidth={8} fill="none" strokeLinecap="round" />
    {typeof valor === "number" && <path d={`M7 ${c} A${r} ${r} 0 0 1 ${tam - 7} ${c}`} stroke={f.cor} strokeWidth={8} fill="none" strokeLinecap="round" strokeDasharray={`${(L * v) / 100} ${L}`} />}
    <text x={c} y={c + 2} textAnchor="middle" fontSize={tam / 4.4} fontWeight="900" fill={typeof valor === "number" ? "#f3f4f6" : "#6b7280"}>{txt(valor)}</text>
  </svg>;
}

const Etiqueta = ({ item }) => <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 6px", border: `1px solid ${item.cor}88`, color: item.cor, background: item.cor + "14", letterSpacing: 0.5, textTransform: "uppercase", whiteSpace: "nowrap" }}>{item.aDefinir ? "a definir" : item.faixa}</span>;
const Estrela = ({ on, nome, onClick }) => <button onClick={(e) => { e.stopPropagation(); onClick(); }} aria-pressed={on} aria-label={`${on ? "Tirar dos" : "Pôr nos"} favoritos: ${nome}`} style={{ ...botaoLimpo, fontSize: 17, color: on ? "#facc15" : "#52525b", padding: "0 2px" }}>★</button>;

// Faixa do gestor (Moked): régua interna e a opção de ver como o cliente vê.
export function FaixaGestor({ reguaId, onRegua }) {
  return <div style={{ ...C.card, padding: "8px 10px", borderColor: "#E5091488", background: "#160507", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
    <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", color: "#fecaca" }}>Área do Gestor · {reguaId === "moked" ? "régua interna Moked" : "vendo como o cliente"}</span>
    <div role="group" aria-label="Régua" style={{ display: "flex" }}>
      {[["moked", "Régua Moked"], ["cliente", "Como o cliente vê"]].map(([k, l]) => <button key={k} aria-pressed={reguaId === k} onClick={() => onRegua(k)} style={{ background: reguaId === k ? "linear-gradient(180deg, #FF1E27, #9f0710)" : "#111115", color: reguaId === k ? "#fff" : "#9ca3af", border: "1px solid #3a3a42", padding: "5px 9px", fontSize: 10, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", cursor: "pointer" }}>{l}</button>)}
    </div>
  </div>;
}

// Início do parque: mostrador + 3 pilares + favoritos.
export function SisInicio({ sis, favs, onAbrir }) {
  const fav = favs.map((id) => sis.itens.find((i) => i.id === id)).filter(Boolean);
  return <div>
    <Mostrador360 valor={sis.geral} regua={sis.regua} onMais={() => onAbrir("sis")} />
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 6, marginBottom: 12 }}>
      {ORDEM_PILARES.map((k) => { const pl = sis.pilares[k]; return <button key={k} onClick={() => onAbrir(`pilar:${k}`)} aria-label={`Abrir ${pl.nome}`} style={{ position: "relative", background: "#0f0f13", border: "1px solid #2a2a31", padding: "10px 6px 12px", textAlign: "center", cursor: "pointer", color: "inherit", clipPath: CHANFRO8 }}>
        <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 1, color: "#f3f4f6" }}>{pl.sigla}</div>
        <div style={{ fontSize: 10, color: "#9ca3af", lineHeight: 1.2, marginTop: 2 }}>{pl.nome}</div>
        <div style={{ fontSize: 15, fontWeight: 900, marginTop: 6, color: pl.cor, fontVariantNumeric: "tabular-nums" }}>{txt(pl.valor)}</div>
        <span aria-hidden="true" style={{ position: "absolute", right: 6, bottom: 6, width: 18, height: 18, borderRadius: "50%", border: "1.5px solid #d1d5db", fontSize: 13, lineHeight: "15px", color: "#fff" }}>+</span>
      </button>; })}
    </div>
    <div style={C.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div style={{ ...C.titulo, marginBottom: 0 }}>★ Favoritos</div><button onClick={() => onAbrir("favs")} style={{ ...botaoLimpo, color: "#FF1E27", fontWeight: 800, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" }} aria-label="Editar favoritos">Editar</button></div>
      {fav.length === 0 && <div style={{ ...C.micro, marginTop: 6 }}>Toque na ★ de um indicador para fixá-lo aqui.</div>}
      {fav.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 8 }}>
        {fav.slice(0, 6).map((i) => <button key={i.id} onClick={() => onAbrir(`ind:${i.id}`)} aria-label={`Abrir ${i.nome}`} style={{ border: `1px solid ${i.cor}88`, padding: "10px 6px", textAlign: "center", cursor: "pointer", clipPath: CHANFRO8, background: "#0b0b0e", color: "inherit" }}>
          <div style={{ fontSize: 10.5, color: "#d1d5db", fontWeight: 700, minHeight: 26 }}>{i.nome}</div>
          <div style={{ fontSize: 18, fontWeight: 900, marginTop: 4, color: i.cor }}>{i.aDefinir ? "0%" : txt(i.valor)}</div>
        </button>)}
      </div>}
    </div>
  </div>;
}

const Voltar = ({ rotulo, onVoltar, titulo }) => <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8 }}><button style={C.back} onClick={onVoltar}>← {rotulo}</button><div style={{ ...C.titulo, marginBottom: 0, textAlign: "right" }}>{titulo}</div></div>;

function LinhaItem({ i, favs, onFav, onAbrir }) {
  return <div onClick={() => onAbrir(`ind:${i.id}`)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onAbrir(`ind:${i.id}`)} aria-label={`Abrir ${i.nome}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 2px", borderTop: "1px solid #1f1f25", cursor: "pointer" }}>
    <Estrela on={favs.includes(i.id)} nome={i.nome} onClick={() => onFav(i.id)} />
    <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{i.nome}{i.aDefinir && <div style={C.micro}>régua a definir — não entra na nota</div>}</div>
    <Etiqueta item={i} />
    <div style={{ fontWeight: 900, fontSize: 14, fontVariantNumeric: "tabular-nums", color: i.cor, minWidth: 40, textAlign: "right" }}>{i.aDefinir ? "0%" : txt(i.valor)}</div>
    <span style={{ color: "#6b7280" }}>›</span>
  </div>;
}

// Telas de detalhe: "sis" (os 3 pilares), "pilar:XX", "ind:id", "favs".
export function SisDetalhe({ tipo, sis, nomeParque, favs, onFav, onAbrir, onVoltar, gestor }) {
  const r = sis.regua;
  if (tipo === "sis") return <>
    <Voltar rotulo={nomeParque} onVoltar={onVoltar} titulo="SIS+ · como a nota é formada" />
    <div style={C.card}>
      <div style={{ ...C.micro, marginBottom: 6 }}>Nota geral {txt(sis.geral)} = {ORDEM_PILARES.map((k) => `${k} × ${Math.round(PILARES[k].peso * 100)}%`).join(" + ")} · {r.nome}: ≥ {r.bom} {r.rotulos[0]} · {r.meio}–{r.bom - 1} {r.rotulos[1]} · &lt; {r.meio} {r.rotulos[2]}</div>
      {ORDEM_PILARES.map((k, n) => { const pl = sis.pilares[k]; return <button key={k} onClick={() => onAbrir(`pilar:${k}`)} aria-label={`Abrir ${pl.nome}`} style={{ ...botaoLimpo, display: "flex", alignItems: "center", gap: 12, padding: "12px 4px", borderTop: n ? "1px solid #1f1f25" : "none", width: "100%" }}>
        <Semi valor={pl.valor} regua={r} tam={92} />
        <div style={{ flex: 1 }}><div style={{ fontWeight: 800 }}>{pl.sigla} — {pl.nome}</div><div style={C.micro}>{pl.contam} de {pl.itens.length} indicadores contando · peso {Math.round(pl.peso * 100)}%</div></div>
        <Etiqueta item={pl} /><span style={{ color: "#6b7280" }}>›</span>
      </button>; })}
    </div>
  </>;
  if (tipo === "favs") return <>
    <Voltar rotulo={nomeParque} onVoltar={onVoltar} titulo="Editar favoritos" />
    <div style={{ ...C.micro, marginBottom: 8 }}>Toque na ★ para fixar o indicador no início. Fica salvo neste aparelho.</div>
    {ORDEM_PILARES.map((k) => <div key={k} style={C.card}><div style={C.titulo}>{k} — {PILARES[k].nome}</div>{sis.pilares[k].itens.map((i) => <LinhaItem key={i.id} i={i} favs={favs} onFav={onFav} onAbrir={onAbrir} />)}</div>)}
  </>;
  if (tipo.startsWith("pilar:")) {
    const pl = sis.pilares[tipo.slice(6)]; if (!pl) return null;
    return <>
      <Voltar rotulo="Voltar" onVoltar={onVoltar} titulo={`${pl.sigla} — ${pl.nome}`} />
      <div style={{ ...C.card, display: "flex", alignItems: "center", gap: 14 }}><Semi valor={pl.valor} regua={r} tam={120} /><div><Etiqueta item={pl} /><div style={{ ...C.micro, marginTop: 6 }}>Média ponderada dos indicadores com dado. Os "a definir" aparecem zerados e não entram na conta.</div></div></div>
      <div style={C.card}>{pl.itens.map((i) => <LinhaItem key={i.id} i={i} favs={favs} onFav={onFav} onAbrir={onAbrir} />)}</div>
    </>;
  }
  if (tipo.startsWith("ind:")) {
    const i = sis.itens.find((x) => x.id === tipo.slice(4)); if (!i) return null;
    return <>
      <Voltar rotulo="Voltar" onVoltar={onVoltar} titulo={i.nome} />
      <div style={C.card}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Semi valor={i.aDefinir ? 0 : i.valor} regua={r} tam={120} />
          <div style={{ flex: 1 }}><Etiqueta item={i} /><div style={{ ...C.micro, marginTop: 6 }}>{PILARES[i.pilar].sigla} — {PILARES[i.pilar].nome}{i.peso ? ` · peso ${i.peso}` : ""}</div></div>
          <Estrela on={favs.includes(i.id)} nome={i.nome} onClick={() => onFav(i.id)} />
        </div>
        <div style={{ fontSize: 13, marginTop: 10, lineHeight: 1.45 }}>{i.texto}</div>
        {i.aDefinir && <div style={{ ...C.micro, marginTop: 6 }}>Indicador novo: aparece zerado e não entra na nota até a Moked definir a régua e o peso.</div>}
        {gestor && <ComparaReguas id={i.id} sisOutra={gestor.outra} />}
        {i.abrir && <button onClick={() => onAbrir(i.abrir)} style={{ ...C.back, marginTop: 12, width: "100%" }} aria-label={`Ver dados de ${i.nome}`}>Ver os dados no painel ›</button>}
      </div>
    </>;
  }
  return null;
}

function ComparaReguas({ id, sisOutra }) {
  const o = sisOutra?.itens.find((x) => x.id === id); if (!o) return null;
  return <div style={{ ...C.micro, marginTop: 8, color: "#fecaca" }}>{sisOutra.regua.nome}: {o.aDefinir ? "a definir" : `${txt(o.valor)} · ${o.faixa}`}</div>;
}

export const REGUA_PADRAO = (gerencial) => (gerencial ? REGUAS.moked.id : REGUAS.cliente.id);

// Área do Cliente — SIS+ (Marcio, 10/11/2026): réplica do modelo aprovado (Area_do_Cliente_SIS_previa.html).
// Mesma estrutura, mesmas classes e mesmo CSS da prévia, agora com os dados reais do app. Só leitura.
import { ORDEM_PILARES, PILARES, faixa } from "./sis";

// CSS da prévia, escopado em .sx (não vaza para o resto do app).
export const CSS_SIS = `
.sx{--bg:#050507;--linha:#2a2a31;--txt:#e5e7eb;--mu:#9ca3af;--mu2:#6b7280;--red:#E50914;--red2:#FF1E27;--ok:#22c55e;--wa:#f59e0b;--or:#f97316;--da:#ef4444;min-height:100vh;background:radial-gradient(120% 60% at 50% -10%,#1d0406 0%,#0a0a0d 45%,#050507 100%);color:var(--txt);font-family:'Segoe UI',system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto}
.sx *{box-sizing:border-box}
.sx .barra{display:flex;align-items:center;justify-content:space-between;padding:14px 16px 10px;border-bottom:1px solid var(--linha)}
.sx .logo{font-weight:900;letter-spacing:4px;font-size:18px;color:#f3f4f6}.sx .logo span{color:var(--red2)}
.sx .ico{width:34px;height:34px;display:grid;place-items:center;background:#111115;border:1px solid #3a3a42;color:#d1d5db;cursor:pointer;clip-path:polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px);font-size:15px;position:relative;padding:0}
.sx .ico .b{position:absolute;top:-2px;right:-2px;background:var(--red2);color:#fff;font-size:9px;font-weight:800;border-radius:9px;padding:1px 5px}
.sx .corpo{padding:14px 14px 22px}
.sx .ola{font-size:17px;font-weight:800}.sx .sub{font-size:12px;color:var(--mu);margin-top:2px}
.sx .card{background:linear-gradient(160deg,#121216 0%,#0b0b0e 60%,#09090b 100%);border:1px solid var(--linha);padding:12px 14px;margin-top:12px;clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px)}
.sx .tit{font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#d1d5db}
.sx .mu{color:var(--mu);font-size:11px}
.sx .g360{position:relative;width:300px;max-width:100%;aspect-ratio:1/1;margin:14px auto 4px}
.sx .anel{position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 180deg,#b91c1c 0deg,#ef4444 25deg,#f97316 55deg,#facc15 95deg,#84cc16 135deg,#16a34a 180deg,#84cc16 225deg,#facc15 265deg,#f97316 305deg,#ef4444 335deg,#b91c1c 360deg);-webkit-mask:radial-gradient(circle,transparent 58%,#000 59%,#000 70%,transparent 71%);mask:radial-gradient(circle,transparent 58%,#000 59%,#000 70%,transparent 71%)}
.sx .face{position:absolute;inset:16%;border-radius:50%;background:radial-gradient(circle at 50% 40%,#17171c 0%,#09090b 70%);border:1px solid #26262c;box-shadow:inset 0 0 30px #000}
.sx .g360 svg{position:absolute;inset:0;width:100%;height:100%}
.sx .gtop{position:absolute;top:23%;left:0;right:0;text-align:center;font-weight:900;letter-spacing:5px;font-size:15px;color:#f3f4f6}
.sx .gnum{font-size:52px;font-weight:900;letter-spacing:-1px;font-variant-numeric:tabular-nums;line-height:1}
.sx .gchip{font-size:12px;font-weight:800;padding:5px 12px;margin-top:2px;clip-path:polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)}
.sx .gbot{position:absolute;bottom:24%;left:0;right:0;text-align:center}
.sx .gbot b{font-size:22px;font-weight:900;font-style:italic;letter-spacing:1px}.sx .gbot b sup{color:var(--red2)}
.sx .gbot div{font-size:9px;color:var(--mu);letter-spacing:1px;text-transform:uppercase}
.sx .mais{position:absolute;right:-4px;top:50%;transform:translateY(-50%);width:42px;height:42px;border-radius:50%;background:#0b0b0e;border:2px solid #f3f4f6;color:#fff;font-size:24px;font-weight:300;display:grid;place-items:center;cursor:pointer;box-shadow:0 0 0 4px #000,0 0 18px #FF1E2766;padding:0}
.sx .mais:hover{background:var(--red)}
.sx .pil3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}
.sx .pil{position:relative;background:#0f0f13;border:1px solid var(--linha);padding:10px 8px 12px;text-align:center;cursor:pointer;color:inherit;font:inherit;clip-path:polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)}
.sx .pil:hover{border-color:#52525b}
.sx .pil .s{font-size:20px;font-weight:900;letter-spacing:1px}.sx .pil .n{font-size:10px;color:var(--mu);line-height:1.2;margin-top:2px}
.sx .pil .v{font-size:15px;font-weight:900;margin-top:6px;font-variant-numeric:tabular-nums}
.sx .pmais{position:absolute;right:6px;bottom:6px;width:20px;height:20px;border-radius:50%;border:1.5px solid #d1d5db;font-size:14px;line-height:16px;color:#fff}
.sx .favs{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px}
.sx .fav{border:1px solid;padding:10px 6px;text-align:center;cursor:pointer;color:inherit;font:inherit;clip-path:polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px);background:#0b0b0e}
.sx .fav .l{font-size:10.5px;color:#d1d5db;font-weight:700;min-height:26px}.sx .fav .v{font-size:18px;font-weight:900;margin-top:4px}
.sx .lnk{background:none;border:0;color:var(--red2);font-weight:800;font-size:11px;cursor:pointer;letter-spacing:1px;text-transform:uppercase;padding:0}
.sx .row{display:flex;align-items:center;gap:10px;padding:11px 2px;border-top:1px solid #1f1f25;cursor:pointer;width:100%;background:none;border-left:0;border-right:0;border-bottom:0;color:inherit;font:inherit;text-align:left}
.sx .row:first-child{border-top:0}
.sx .row .nm{flex:1;font-size:13px;font-weight:600}
.sx .row .vl{font-weight:900;font-size:14px;font-variant-numeric:tabular-nums}
.sx .star{background:none;border:0;font-size:17px;cursor:pointer;color:#52525b;padding:0 2px}
.sx .star.on{color:#facc15}
.sx .chev{color:var(--mu2)}
.sx .voltar{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.sx .voltar button{background:#111115;border:1px solid #3a3a42;color:#d1d5db;padding:6px 12px;font-size:12px;cursor:pointer;clip-path:polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)}
.sx .semi{display:block;margin:4px auto 0}
.sx .pilar{display:flex;align-items:center;gap:12px;padding:12px 4px;border-top:1px solid #1f1f25;cursor:pointer;width:100%;background:none;border-left:0;border-right:0;border-bottom:0;color:inherit;font:inherit;text-align:left}
.sx .pilar:first-child{border-top:0}
.sx .tag{font-size:9px;font-weight:800;padding:2px 6px;border:1px solid;letter-spacing:.5px;text-transform:uppercase;white-space:nowrap}
.sx .origem{display:inline-block;font-size:9px;font-weight:700;margin-left:6px;padding:1px 5px;border-radius:3px}
.sx .o-novo{background:#1e3a8a;color:#bfdbfe}
.sx .news{display:flex;gap:10px;padding:9px 0;border-top:1px solid #1f1f25;text-decoration:none;color:inherit}.sx .news:first-of-type{border-top:0}
.sx .news i{width:6px;border-radius:2px;flex:none}
.sx .btnp{display:block;width:100%;text-align:center;padding:12px;border:1px solid #f9731688;background:#1a0d02;color:#fdba74;font-weight:800;letter-spacing:1px;text-transform:uppercase;font-size:12px;cursor:pointer;margin-top:12px;clip-path:polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)}
.sx .plantao{display:flex;gap:8px;overflow:auto;padding-bottom:2px}
.sx .pp{flex:none;width:68px;text-align:center}.sx .pp .av{width:44px;height:44px;border-radius:50%;margin:0 auto;background:#1f2937;display:grid;place-items:center;font-weight:800;border:2px solid;overflow:hidden}
.sx .pp .av img{width:100%;height:100%;object-fit:cover}
.sx .pp div{font-size:9.5px;color:#d1d5db;margin-top:3px;line-height:1.15}
.sx .big{font-size:30px;font-weight:900}
.sx .gestor-faixa{background:#160507;border:1px solid #E5091488;color:#fecaca;font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:6px 10px;text-align:center}
.sx .gestor-faixa button{background:none;border:0;color:#fca5a5;font:inherit;font-size:10px;letter-spacing:1px;text-decoration:underline;cursor:pointer;margin-left:8px}
.sx .duas{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.sx .menu{position:absolute;left:0;right:0;top:58px;z-index:20;padding:0 14px}
.sx input{font:inherit}
`;

const fx = (v, r) => faixa(v, r);
const pc = (v) => (typeof v === "number" ? `${v}%` : "—");
const iniciais = (n) => String(n || "?").trim().split(/\s+/).filter(Boolean).map((x) => x[0]).slice(0, 2).join("").toUpperCase();
const nomeCurto = (n) => { const a = String(n || "—").trim().split(/\s+/); return a.length > 1 ? `${a[0]} ${a[a.length - 1][0]}.` : a[0]; };

// ── Mostrador 360° (idêntico à prévia): 0% na base, sobe pelo lado direito até 100% no topo ──
export function G360({ v, regua, onMais }) {
  const f = fx(v, regua), val = typeof v === "number" ? Math.max(0, Math.min(100, v)) : 0;
  const t = (val * 1.8 * Math.PI) / 180, cx = 150, cy = 150, P = (r, d = 0) => [cx + Math.sin(t + d) * r, cy + Math.cos(t + d) * r];
  const [ax, ay] = P(134), [l1x, l1y] = P(98, 0.07), [l2x, l2y] = P(98, -0.07), [i1x, i1y] = P(86), [i2x, i2y] = P(120);
  const ticks = []; for (let i = 0; i < 60; i++) { const u = (i * 6 * Math.PI) / 180, r1 = i % 5 ? 126 : 121, r2 = 130; ticks.push(<line key={i} x1={cx + Math.sin(u) * r1} y1={cy - Math.cos(u) * r1} x2={cx + Math.sin(u) * r2} y2={cy - Math.cos(u) * r2} stroke={i % 5 ? "#00000066" : "#000000aa"} strokeWidth={i % 5 ? 1 : 2} />); }
  return <div className="g360" role="img" aria-label={`SIS+ condição geral: ${typeof v === "number" ? `${v}% · ${f.rotulo}` : "sem dado"}`}>
    <div className="anel" /><div className="face" />
    <svg viewBox="0 0 300 300" aria-hidden="true">{ticks}
      {typeof v === "number" && <>
        <line x1={i1x} y1={i1y} x2={i2x} y2={i2y} stroke="#f3f4f6" strokeWidth="3" strokeLinecap="round" style={{ filter: "drop-shadow(0 0 4px #fff)" }} />
        <polygon points={`${ax},${ay} ${l1x},${l1y} ${l2x},${l2y}`} fill="#f3f4f6" style={{ filter: "drop-shadow(0 0 5px #fffa)" }} />
      </>}
    </svg>
    <div className="gtop">MOKED</div>
    <div style={{ position: "absolute", top: "33%", left: 0, right: 0, textAlign: "center" }}><div className="gnum">{pc(v)}</div></div>
    <div style={{ position: "absolute", top: "56%", left: 0, right: 0, textAlign: "center" }}><span className="gchip" style={{ background: f.cor + "22", color: f.cor, border: `1px solid ${f.cor}88` }}>Condição geral · {f.rotulo}</span></div>
    <div className="gbot"><b>SIS<sup>+</sup></b><div>Sistema Integrado de Segurança</div></div>
    {onMais && <button className="mais" onClick={onMais} aria-label="Ver detalhes da nota">+</button>}
  </div>;
}

export function Semi({ v, regua, tam = 86 }) {
  const f = fx(v, regua), r = tam / 2 - 7, c = tam / 2, L = Math.PI * r, val = typeof v === "number" ? v : 0;
  return <svg className="semi" width={tam} height={tam / 2 + 8} viewBox={`0 0 ${tam} ${tam / 2 + 8}`} aria-hidden="true">
    <path d={`M7 ${c} A${r} ${r} 0 0 1 ${tam - 7} ${c}`} stroke="#1f1f25" strokeWidth="8" fill="none" strokeLinecap="round" />
    {typeof v === "number" && <path d={`M7 ${c} A${r} ${r} 0 0 1 ${tam - 7} ${c}`} stroke={f.cor} strokeWidth="8" fill="none" strokeLinecap="round" strokeDasharray={`${(L * val) / 100} ${L}`} />}
    <text x={c} y={c + 2} textAnchor="middle" fontSize={tam / 4.2} fontWeight="900" fill={typeof v === "number" ? "#f3f4f6" : "#6b7280"}>{pc(v)}</text>
  </svg>;
}
export const Chip = ({ v, regua, rotulo }) => { const f = fx(v, regua); return <span className="tag" style={{ color: f.cor, borderColor: f.cor + "88", background: f.cor + "14" }}>{rotulo || f.rotulo}</span>; };
const valItem = (i) => (i.aDefinir ? 0 : i.valor);
const corItem = (i, r) => (i.aDefinir ? "#6b7280" : fx(i.valor, r).cor);

// ── Barra superior: ☰ · MOKED · 🔔 ──
export function Barra({ onMenu, onAvisos, avisos = 0 }) {
  return <div className="barra">
    <button className="ico" onClick={onMenu} title="Menu" aria-label="Menu">☰</button>
    <div className="logo">MOK<span>E</span>D</div>
    <button className="ico" onClick={onAvisos} title="Avisos" aria-label={`Avisos: ${avisos}`}>🔔{avisos > 0 && <span className="b">{avisos}</span>}</button>
  </div>;
}

// ── Início do parque (home da prévia) ──
export function Home({ p, sis, favs, onIr, atualizado, plantao }) {
  const r = sis.regua, fav = favs.map((id) => sis.itens.find((i) => i.id === id)).filter(Boolean);
  const m = p.mapa;
  return <>
    <div className="ola">Olá, {p.nome}</div>
    <div className="sub">{p.pid} · status da sua segurança{atualizado ? ` · atualizado às ${atualizado}` : ""}</div>
    <G360 v={sis.geral} regua={r} onMais={() => onIr("sis")} />
    <div className="pil3">{ORDEM_PILARES.map((k) => { const pl = sis.pilares[k], [a, ...b] = pl.nome.split(" "); return <button key={k} className="pil" onClick={() => onIr(`pilar:${k}`)} aria-label={`Abrir ${pl.nome}`}>
      <div className="s">{pl.sigla}</div><div className="n">{a}<br />{b.join(" ")}</div><div className="v" style={{ color: fx(pl.valor, r).cor }}>{pc(pl.valor)}</div><div className="pmais">+</div>
    </button>; })}</div>
    <div className="card"><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div className="tit">⭐ Favoritos</div><button className="lnk" onClick={() => onIr("favs")} aria-label="Editar favoritos">Editar</button></div>
      {fav.length ? <div className="favs">{fav.slice(0, 6).map((i) => <button key={i.id} className="fav" style={{ borderColor: corItem(i, r) + "88" }} onClick={() => onIr(`ind:${i.id}`)} aria-label={`Abrir ${i.nome}`}><div className="l">{i.nome}</div><div className="v" style={{ color: corItem(i, r) }}>{pc(valItem(i))}</div></button>)}</div>
        : <div className="mu" style={{ marginTop: 6 }}>Nenhum favorito. Toque na ⭐ de qualquer indicador.</div>}
    </div>
    <div className="card"><div style={{ display: "flex", justifyContent: "space-between" }}><div className="tit">Equipe de plantão agora</div><span className="mu">{m.temMapa ? `${m.turno === "N" ? "Noturno" : "Diurno"} · ${m.data.slice(8, 10)}/${m.data.slice(5, 7)}${m.hoje ? "" : " (último)"}` : ""}</span></div>
      {m.temMapa ? <>
        <div className="plantao" style={{ marginTop: 8 }}>{plantao.map((x, n) => <div key={n} className="pp"><div className="av" style={{ borderColor: x.cor }} title={x.situacaoRotulo}>{x.foto ? <img src={x.foto} alt="" /> : iniciais(x.nome || x.posto)}</div><div>{nomeCurto(x.nome)}<br /><span className="mu">{x.posto}</span></div></div>)}</div>
        <button className="lnk" style={{ color: "var(--mu)", textTransform: "none", letterSpacing: 0, fontWeight: 400, marginTop: 6, textAlign: "left" }} onClick={() => onIr("plantao")} aria-label="Abrir equipe de plantão">
          {m.presentes} de {m.postos} postos{m.faltas ? ` · ${m.faltas} falta${m.faltas === 1 ? "" : "s"}` : ""}{m.atrasos ? ` · ${m.atrasos} atraso${m.atrasos === 1 ? "" : "s"}` : ""}{m.vagos ? ` · ${m.vagos} vago${m.vagos === 1 ? "" : "s"}` : ""} · Mapa de Equipe completo ›</button>
      </> : <div className="mu" style={{ marginTop: 6 }}>Nenhum mapa enviado ainda.</div>}
    </div>
    <Informativos p={p} onIr={onIr} />
    <button className="btnp" onClick={() => onIr("comunicar")} title="Fase 2 — a decidir">⚠ Comunicar problema</button>
  </>;
}

const COR_NEWS = (i) => (i.tema === "mercado" ? "#22c55e" : i.grave ? "#ef4444" : "#f59e0b");
function Informativos({ p, onIr }) {
  const itens = (p.informativos || []).slice(0, 3);
  return <div className="card"><div style={{ display: "flex", justifyContent: "space-between" }}><div className="tit">Informativos · entorno</div><button className="lnk" style={{ color: "var(--mu)", textTransform: "none", letterSpacing: 0, fontWeight: 400 }} onClick={() => onIr("entorno")} aria-label="Abrir entorno">Ver todos ›</button></div>
    <div style={{ marginTop: 6 }}>{itens.length ? itens.map((i) => <a key={i.id} className="news" href={i.link || undefined} target="_blank" rel="noopener noreferrer"><i style={{ background: COR_NEWS(i) }} /><div><div style={{ fontSize: 12.5, fontWeight: 700 }}>{i.titulo}</div><div className="mu">{[i.fonte, i.dataCurta, typeof i.km === "number" ? `a ${i.km.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km do parque` : ""].filter(Boolean).join(" · ")}</div></div></a>)
      : <div className="mu">Sem notícias coletadas para a região nos últimos 30 dias.</div>}</div>
  </div>;
}

const Voltar = ({ rotulo = "← Voltar", onVoltar, children }) => <div className="voltar"><button onClick={onVoltar}>{rotulo}</button><div className="tit">{children}</div></div>;

// ── SIS+ · detalhamento ──
export function TelaSis({ sis, onIr, onVoltar }) {
  const r = sis.regua, f = fx(sis.geral, r);
  return <>
    <Voltar rotulo="← Início" onVoltar={onVoltar}>SIS<sup style={{ color: "var(--red2)" }}>+</sup> · detalhamento</Voltar>
    <div className="card" style={{ textAlign: "center" }}><div className="mu">Nota geral = {ORDEM_PILARES.map((k) => `${k} ${Math.round(PILARES[k].peso * 100)}%`).join(" + ")}</div><div className="big" style={{ color: f.cor }}>{pc(sis.geral)}</div><Chip v={sis.geral} regua={r} />
      <div className="mu" style={{ marginTop: 8 }}>{r.nome}: ≥ {r.bom} {r.rotulos[0]} · {r.meio}–{r.bom - 1} {r.rotulos[1]} · &lt; {r.meio} {r.rotulos[2]}</div></div>
    <div className="card">{ORDEM_PILARES.map((k) => { const pl = sis.pilares[k]; return <button key={k} className="pilar" onClick={() => onIr(`pilar:${k}`)} aria-label={`Abrir ${pl.nome}`}>
      <Semi v={pl.valor} regua={r} tam={92} />
      <div style={{ flex: 1 }}><div style={{ fontWeight: 800 }}>{pl.sigla} — {pl.nome}</div><div className="mu">{pl.itens.length} indicadores · peso {Math.round(pl.peso * 100)}%</div><div style={{ marginTop: 4 }}><Chip v={pl.valor} regua={r} /></div></div>
      <div className="ico" style={{ width: 30, height: 30 }}>+</div>
    </button>; })}</div>
  </>;
}

// ── Pilar ──
export function TelaPilar({ k, sis, favs, onFav, onIr, onVoltar }) {
  const pl = sis.pilares[k]; if (!pl) return null; const r = sis.regua;
  return <>
    <Voltar onVoltar={onVoltar}>{pl.sigla} — {pl.nome}</Voltar>
    <div className="card" style={{ textAlign: "center" }}><Semi v={pl.valor} regua={r} tam={170} /><div style={{ marginTop: 4 }}><Chip v={pl.valor} regua={r} /></div></div>
    <div className="card">{pl.itens.map((i) => <LinhaInd key={i.id} i={i} r={r} favs={favs} onFav={onFav} onIr={onIr} />)}</div>
  </>;
}
function LinhaInd({ i, r, favs, onFav, onIr, semChev }) {
  const on = favs.includes(i.id);
  return <div className="row" role="button" tabIndex={0} onClick={() => onIr(`ind:${i.id}`)} onKeyDown={(e) => e.key === "Enter" && onIr(`ind:${i.id}`)} aria-label={`Abrir ${i.nome}`}>
    <button className={`star${on ? " on" : ""}`} onClick={(e) => { e.stopPropagation(); onFav(i.id); }} aria-label={`${on ? "Tirar dos" : "Pôr nos"} favoritos: ${i.nome}`} aria-pressed={on}>★</button>
    <div className="nm">{i.nome}{i.aDefinir && <span className="origem o-novo">a definir</span>}</div>
    <div className="vl" style={{ color: corItem(i, r) }}>{pc(valItem(i))}</div>
    {!semChev && <span className="chev">›</span>}
  </div>;
}

// ── Indicador ──
export function TelaItem({ id, p, sis, sisOutra, favs, onFav, onIr, onVoltar }) {
  const i = sis.itens.find((x) => x.id === id); if (!i) return null; const r = sis.regua, on = favs.includes(id);
  const o = sisOutra ? sisOutra.itens.find((x) => x.id === id) : null;
  const cftv = id === "cftv" ? p.sisBase?.categorias?.cftv : null, g = p.teste?.gravacao;
  return <>
    <Voltar onVoltar={onVoltar}>{i.nome}</Voltar>
    <div className="card" style={{ textAlign: "center" }}><Semi v={valItem(i)} regua={r} tam={170} /><div style={{ marginTop: 4 }}>{i.aDefinir ? <Chip v={null} rotulo="a definir" /> : <Chip v={i.valor} regua={r} />}</div>
      <div style={{ marginTop: 10 }}><button className={`star${on ? " on" : ""}`} onClick={() => onFav(id)} style={{ fontSize: 14, color: on ? "#facc15" : "#9ca3af" }} aria-pressed={on}>★ {on ? "Nos favoritos" : "Adicionar aos favoritos"}</button></div></div>
    <div className="card"><div className="tit">O que compõe</div><div style={{ fontSize: 13, marginTop: 6 }}>{i.texto}</div>
      {i.aDefinir && <div className="mu" style={{ marginTop: 6 }}>Indicador novo: aparece zerado e não entra na nota até a Moked definir a régua e o peso.</div>}
      {o && <div className="mu" style={{ marginTop: 8, color: "#fecaca" }}>{r.id === "moked" ? `Régua Moked: ${pc(i.valor)} (cliente vê ${pc(o.valor)}).` : `Cliente vê ${pc(i.valor)} (régua Moked: ${pc(o.valor)}).`}</div>}
    </div>
    {cftv && <div className="card"><div className="duas"><div><div className="big">{cftv.total}</div><div className="mu">câmeras instaladas</div></div><div><div className="big" style={{ color: cftv.inop ? "var(--da)" : "var(--ok)" }}>{cftv.inop}</div><div className="mu">com problema</div></div></div>
      <div className="row" style={{ cursor: "default" }}><div className="nm">Gravação ≥ 30 dias</div><div className="vl" style={{ color: g && g.pct !== null ? g.cor : "var(--mu2)" }}>{!g || g.pct === null ? "não informado" : g.pct === 0 ? "todas ok" : `até ${g.pct}% abaixo`}</div></div>
      {cftv.itens.slice(0, 8).map((x, n) => <div key={n} className="row" style={{ cursor: "default" }}><div className="nm">{x.item && x.item !== "?" ? x.item : x.cat}{x.note ? <div className="mu">{x.note}</div> : null}</div><span className="tag" style={{ color: "var(--da)", borderColor: "#ef444488" }}>{x.status === "partial" ? "parcial" : "inoperante"}</span></div>)}
      <button className="row" onClick={() => onIr("teste")}><div className="nm">Histórico do teste semanal</div><span className="chev">›</span></button>
    </div>}
    {!cftv && i.abrir && <div className="card"><button className="row" onClick={() => onIr(i.abrir)} aria-label={`Ver dados de ${i.nome}`}><div className="nm">Ver os dados no painel</div><span className="chev">›</span></button></div>}
  </>;
}

// ── Editar favoritos ──
export function TelaFavs({ sis, favs, onFav, onIr, onVoltar }) {
  return <>
    <Voltar rotulo="← Início" onVoltar={onVoltar}>⭐ Editar favoritos</Voltar>
    {ORDEM_PILARES.map((k) => <div key={k} className="card"><div className="tit">{k} — {PILARES[k].nome}</div>{sis.pilares[k].itens.map((i) => <LinhaInd key={i.id} i={i} r={sis.regua} favs={favs} onFav={onFav} onIr={onIr} semChev />)}</div>)}
  </>;
}

// ── Menu ☰ (o que já existia na Área do Cliente continua aqui) ──
export function TelaMenu({ itens, onIr, onVoltar, perfil }) {
  return <>
    <Voltar rotulo="← Início" onVoltar={onVoltar}>Menu</Voltar>
    {perfil && <div className="mu" style={{ marginBottom: 4 }}>{perfil}</div>}
    <div className="card">{itens.map(([k, rotulo, sub]) => <button key={k} className="row" onClick={() => onIr(k)} aria-label={rotulo}><div className="nm">{rotulo}{sub && <div className="mu">{sub}</div>}</div><span className="chev">›</span></button>)}</div>
  </>;
}

// ── Avisos 🔔 ──
export function TelaAvisos({ avisos, onVoltar }) {
  return <>
    <Voltar rotulo="← Início" onVoltar={onVoltar}>🔔 Avisos</Voltar>
    <div className="card">{avisos.length ? avisos.map((a, n) => <div key={n} className="row" style={{ cursor: "default" }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--red2)", boxShadow: "0 0 8px var(--red2)", flex: "none" }} /><div className="nm">{a.rotulo}{a.parque && <div className="mu">{a.parque}</div>}</div></div>)
      : <div className="mu">Nenhum aviso agora.</div>}</div>
  </>;
}

// ── Comunicar problema (fase 2) ──
export function TelaComunicar({ onVoltar }) {
  return <>
    <Voltar rotulo="← Início" onVoltar={onVoltar}>⚠ Comunicar problema</Voltar>
    <div className="card"><div style={{ fontSize: 13 }}>Em breve: abrir um chamado direto para a gestão Moked, com foto e local.</div><div className="mu" style={{ marginTop: 6 }}>Enquanto isso, fale com o consultor Moked do seu parque.</div></div>
  </>;
}

// ── Visão macro do proprietário (vários parques) no mesmo padrão ──
export function Macro({ nome, parques, sisPorPid, onAbrir, sub, hojeGrupo }) {
  const vs = parques.map((p) => sisPorPid[p.pid]?.geral).filter((v) => typeof v === "number");
  const media = vs.length ? Math.round(vs.reduce((a, b) => a + b, 0) / vs.length) : null;
  const regua = parques.length ? sisPorPid[parques[0].pid]?.regua : undefined;
  return <>
    <div className="ola">Olá, {nome}</div>
    <div className="sub">{sub}</div>
    <G360 v={media} regua={regua} />
    <div className="card"><div className="tit">Seus parques</div>
      {parques.map((p) => { const s = sisPorPid[p.pid]; return <button key={p.pid} className="pilar" onClick={() => onAbrir(p.pid)} aria-label={`Abrir ${p.nome}`}>
        <Semi v={s?.geral ?? null} regua={regua} tam={92} />
        <div style={{ flex: 1 }}><div style={{ fontWeight: 800 }}>{p.nome}</div><div className="mu">{ORDEM_PILARES.map((k) => `${k} ${pc(s?.pilares[k].valor)}`).join(" · ")}</div><div style={{ marginTop: 4 }}><Chip v={s?.geral ?? null} regua={regua} /></div></div>
        <div className="ico" style={{ width: 30, height: 30 }}>+</div>
      </button>; })}
    </div>
    {hojeGrupo}
  </>;
}

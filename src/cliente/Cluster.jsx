// Cluster Moked — componentes visuais puros (sem dados, sem banco).
// Versão limpa (Marcio, 26/10/2026): mantém os relógios com agulha, mas sem bisel metálico, sem vidro e com
// graduação discreta. Preto profundo, metal escovado só nas linhas, vermelho #E50914 / #FF1E27 como acento.
export const VERMELHO = "#E50914", VERMELHO2 = "#FF1E27", VERDE = "#22c55e", AMARELO = "#f59e0b", CINZA = "#6b7280", AZUL = "#38bdf8";
export const LINHA = "#2a2a31";
const CHANFRO = "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)";
const CARD_BG = "linear-gradient(160deg, #121216 0%, #0b0b0e 60%, #09090b 100%)";

export const C = {
  main: { minHeight: "100vh", background: "radial-gradient(120% 60% at 50% -10%, #220507 0%, #0a0a0d 45%, #050507 100%)", color: "#e5e7eb", padding: "12px 12px 40px", fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif", maxWidth: 560, margin: "0 auto" },
  card: { position: "relative", background: CARD_BG, border: `1px solid ${LINHA}`, borderRadius: 6, padding: "14px 16px", marginBottom: 12, clipPath: CHANFRO, boxShadow: "inset 0 1px 0 rgba(255,255,255,.04), 0 6px 18px rgba(0,0,0,.45)" },
  cardBtn: { position: "relative", background: CARD_BG, border: `1px solid ${LINHA}`, borderRadius: 6, padding: "14px 16px", marginBottom: 12, clipPath: CHANFRO, boxShadow: "inset 0 1px 0 rgba(255,255,255,.04), 0 6px 18px rgba(0,0,0,.45)", width: "100%", textAlign: "left", color: "#e5e7eb", cursor: "pointer" },
  titulo: { fontSize: 12, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#d1d5db", marginBottom: 8 },
  micro: { fontSize: 10.5, color: "#9ca3af" },
  chip: (c) => ({ display: "inline-block", fontSize: 10, fontWeight: 700, letterSpacing: .5, padding: "3px 8px", borderRadius: 3, background: c + "14", color: c, border: `1px solid ${c}55`, marginRight: 6, marginTop: 4, textTransform: "uppercase" }),
  back: { minHeight: 34, background: "#111115", border: "1px solid #3a3a42", color: "#d1d5db", borderRadius: 4, padding: "6px 12px", fontSize: 12, cursor: "pointer", clipPath: "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)" },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  badge: { background: "#160507", border: `1px solid ${VERMELHO}88`, color: "#fecaca", fontSize: 10.5, fontWeight: 800, letterSpacing: 1.5, padding: "5px 10px", clipPath: "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)", textTransform: "uppercase" },
  numero: (c) => ({ fontSize: 26, fontWeight: 800, color: c, fontVariantNumeric: "tabular-nums" }),
};

export const corDe = (p) => (p === null || p === undefined ? CINZA : p >= 90 ? VERDE : p >= 70 ? AMARELO : VERMELHO2);

// Mostrador: face escura lisa, arco de 270° fino, graduação discreta (sem números), zonas
// como segmentos finos por fora, agulha vermelha fina com ponta iluminada, valor grande no centro.
export function Mostrador({ valor, max = 100, rotulo, sub, tam = 220, cor, unidade = "%", invertido = false, zonaCritica, zonas, valorTexto }) {
  const cx = tam / 2, cy = tam / 2 + 8, r = tam / 2 - 22;
  const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25; // 270°
  const ang = (v) => a0 + (a1 - a0) * Math.max(0, Math.min(1, v / max));
  const pt = (a, rr = r) => [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
  const arco = (x, y, c, w, op = 1, rr = r) => { const [ax, ay] = pt(ang(x), rr), [bx, by] = pt(ang(y), rr); return <path d={`M${ax} ${ay} A${rr} ${rr} 0 ${ang(y) - ang(x) > Math.PI ? 1 : 0} 1 ${bx} ${by}`} stroke={c} strokeWidth={w} fill="none" strokeLinecap="round" opacity={op} />; };
  const v = typeof valor === "number" ? valor : null;
  const c = cor || (v === null ? CINZA : invertido ? (v <= max * 0.1 ? VERDE : v <= max * 0.25 ? AMARELO : VERMELHO2) : corDe((v / max) * 100));
  const crit = zonaCritica !== undefined ? zonaCritica : invertido ? [max * 0.25, max] : [0, max * 0.7];
  const ticks = []; const n = 10;
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * (i / n); const [x1, y1] = pt(a, r - 12), [x2, y2] = pt(a, r - 6);
    ticks.push(<line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={i % 5 === 0 ? "#d1d5db" : "#4b5563"} strokeWidth={i % 5 === 0 ? 1.6 : 1} strokeLinecap="round" />);
  }
  const na = v === null ? a0 : ang(v); const [nx, ny] = pt(na, r - 9); const [bx, by] = pt(na + Math.PI, 10);
  const [px, py] = pt(na + Math.PI / 2, 2.4), [qx, qy] = pt(na - Math.PI / 2, 2.4);
  const uid = `mk${Math.round(tam)}`;
  const segs = zonas || [[crit[0], crit[1], VERMELHO]];
  return <svg width="100%" viewBox={`0 0 ${tam} ${tam * 0.9}`} role="img" aria-label={`${rotulo}: ${valorTexto !== undefined ? valorTexto : v === null ? "sem dado" : v + unidade}`} style={{ display: "block", maxWidth: tam, margin: "0 auto" }}>
    <defs>
      <radialGradient id={uid + "face"} cx="50%" cy="45%" r="60%"><stop offset="0%" stopColor="#141418" /><stop offset="100%" stopColor="#09090b" /></radialGradient>
      <filter id={uid + "glow"} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    </defs>
    <circle cx={cx} cy={cy} r={r + 10} fill={`url(#${uid}face)`} stroke="#26262c" strokeWidth={1} />
    {arco(0, max, "#1f1f25", 6)}
    {segs.map(([x, y, zc], i) => <g key={i}>{arco(x, y, zc, 2.5, .9, r + 7)}</g>)}
    {v !== null && v > 0 && arco(0, v, c, 6, 1)}
    {ticks}
    <text x={cx} y={cy - r * 0.28} textAnchor="middle" fontSize={tam / 22} fontWeight="700" letterSpacing="2" fill="#9ca3af">{rotulo.toUpperCase()}</text>
    {v !== null && <g filter={`url(#${uid}glow)`}><polygon points={`${px} ${py} ${nx} ${ny} ${qx} ${qy} ${bx} ${by}`} fill={VERMELHO2} strokeLinejoin="round" /></g>}
    <circle cx={cx} cy={cy} r={6} fill="#0b0b0e" stroke="#6b7280" strokeWidth={1.5} />
    <circle cx={cx} cy={cy} r={2.2} fill={VERMELHO2} />
    <text x={cx} y={cy + r * 0.46} textAnchor="middle" fontSize={valorTexto !== undefined && String(valorTexto).length > 3 ? tam / 10.5 : tam / 7.5} fontWeight="800" fill={v === null ? CINZA : "#f3f4f6"} style={{ fontVariantNumeric: "tabular-nums" }}>{valorTexto !== undefined ? valorTexto : v === null ? "—" : `${v}${unidade}`}</text>
    {sub && <text x={cx} y={cy + r * 0.46 + tam / 16} textAnchor="middle" fontSize={tam / 21} fill="#9ca3af">{sub}</text>}
  </svg>;
}

// Anel: trilho fino + arco colorido; valor no centro, rótulo ao lado.
export function Anel({ valor, rotulo, sub, cor, tam = 96, unidade = "%" }) {
  const r = tam / 2 - 9, cx = tam / 2, cy = tam / 2, circ = 2 * Math.PI * r;
  const v = typeof valor === "number" ? Math.max(0, Math.min(100, valor)) : null; const c = cor || corDe(v);
  return <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
    <svg width={tam} height={tam} viewBox={`0 0 ${tam} ${tam}`} role="img" aria-label={`${rotulo}: ${v === null ? "sem dado" : valor + unidade}`}>
      <circle cx={cx} cy={cy} r={r} fill="#0b0b0e" stroke="#1f1f25" strokeWidth={5} />
      {v !== null && <circle cx={cx} cy={cy} r={r} fill="none" stroke={c} strokeWidth={5} strokeDasharray={`${(circ * v) / 100} ${circ}`} strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`} />}
      <text x={cx} y={cy + 6} textAnchor="middle" fontSize={tam / 4.8} fontWeight="800" fill={v === null ? CINZA : "#f3f4f6"} style={{ fontVariantNumeric: "tabular-nums" }}>{v === null ? "—" : `${valor}${unidade}`}</text>
    </svg>
    <div><div style={{ ...C.titulo, fontSize: 11, marginBottom: 2 }}>{rotulo}</div>{sub && <div style={C.micro}>{sub}</div>}</div>
  </div>;
}

// Luz de aviso (acende quando há problema).
export function Luz({ on, rotulo, cor = VERMELHO2 }) {
  return <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 56 }}>
    <span style={{ width: 10, height: 10, borderRadius: "50%", background: on ? cor : "#1f1f25", border: `1px solid ${on ? cor : "#3a3a42"}`, boxShadow: on ? `0 0 8px ${cor}, 0 0 18px ${cor}55` : "none" }} />
    <span style={{ fontSize: 8.5, letterSpacing: .5, color: on ? "#fecaca" : "#6b7280", textTransform: "uppercase", fontWeight: 700, textAlign: "center" }}>{rotulo}</span>
  </div>;
}

export function Cabecalho({ logo, badge, direita }) {
  return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingBottom: 10, borderBottom: `1px solid ${LINHA}` }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>{logo ? <img src={logo} alt="Moked" style={{ height: 26 }} /> : <span style={{ fontWeight: 900, letterSpacing: 3, color: "#f3f4f6" }}>MOKED</span>}</div>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={C.badge}>{badge}</span>{direita}</div>
  </div>;
}

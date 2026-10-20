// Cluster automotivo Moked — componentes visuais puros (sem dados, sem banco).
// Identidade: preto profundo, metal escovado, vermelho neon #E50914 / #FF1E27.
export const VERMELHO = "#E50914", VERMELHO2 = "#FF1E27", VERDE = "#22c55e", AMARELO = "#f59e0b", CINZA = "#64748b";

export const C = {
  main: { minHeight: "100vh", background: "radial-gradient(120% 80% at 50% 0%, #1a0608 0%, #07070a 45%, #030305 100%)", color: "#e5e7eb", padding: "12px 12px 40px", fontFamily: "'Segoe UI', system-ui, sans-serif", maxWidth: 560, margin: "0 auto" },
  // card "chanfrado" (bordas angulares) com borda metálica
  card: { position: "relative", background: "linear-gradient(180deg, #121216 0%, #0a0a0d 100%)", border: "1px solid #2a2a31", borderRadius: 10, padding: 14, marginBottom: 12, clipPath: "polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.05), 0 8px 24px rgba(0,0,0,.6)" },
  cardBtn: { position: "relative", background: "linear-gradient(180deg, #121216 0%, #0a0a0d 100%)", border: "1px solid #2a2a31", borderRadius: 10, padding: 14, marginBottom: 12, clipPath: "polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.05), 0 8px 24px rgba(0,0,0,.6)", width: "100%", textAlign: "left", color: "#e5e7eb", cursor: "pointer" },
  titulo: { fontSize: 13, fontWeight: 900, letterSpacing: 2, textTransform: "uppercase", color: "#f3f4f6", marginBottom: 6 },
  micro: { fontSize: 10.5, color: "#9ca3af" },
  chip: (c) => ({ display: "inline-block", fontSize: 10, fontWeight: 800, letterSpacing: .5, padding: "3px 8px", borderRadius: 4, background: c + "1f", color: c, border: `1px solid ${c}55`, marginRight: 6, marginTop: 4, textTransform: "uppercase" }),
  back: { background: "linear-gradient(180deg,#1b1b20,#0e0e12)", border: "1px solid #3a3a42", color: "#d1d5db", borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer", clipPath: "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)" },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  badge: { background: "linear-gradient(180deg,#2a0b0e,#160507)", border: `1px solid ${VERMELHO}aa`, color: "#fecaca", fontSize: 10.5, fontWeight: 900, letterSpacing: 1.5, padding: "5px 10px", clipPath: "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)", textTransform: "uppercase" },
  numero: (c) => ({ fontSize: 26, fontWeight: 900, color: c, textShadow: `0 0 12px ${c}88`, fontVariantNumeric: "tabular-nums" }),
};

export const corDe = (p) => (p === null || p === undefined ? CINZA : p >= 90 ? VERDE : p >= 70 ? AMARELO : VERMELHO2);

// Mostrador grande (conta-giros): arco graduado 0..max, zona crítica em vermelho, agulha iluminada, valor central.
export function Mostrador({ valor, max = 100, rotulo, sub, tam = 220, cor, unidade = "%", invertido = false, zonaCritica }) {
  const cx = tam / 2, cy = tam / 2 + 10, r = tam / 2 - 18;
  const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25; // 270°
  const ang = (v) => a0 + (a1 - a0) * Math.max(0, Math.min(1, v / max));
  const pt = (a, rr = r) => [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
  const arco = (x, y, c, w, op = 1) => { const [ax, ay] = pt(ang(x)), [bx, by] = pt(ang(y)); return <path d={`M${ax} ${ay} A${r} ${r} 0 ${ang(y) - ang(x) > Math.PI ? 1 : 0} 1 ${bx} ${by}`} stroke={c} strokeWidth={w} fill="none" strokeLinecap="butt" opacity={op} />; };
  const v = typeof valor === "number" ? valor : null;
  const c = cor || (v === null ? CINZA : invertido ? (v <= max * 0.1 ? VERDE : v <= max * 0.25 ? AMARELO : VERMELHO2) : corDe((v / max) * 100));
  const crit = zonaCritica !== undefined ? zonaCritica : invertido ? [max * 0.25, max] : [0, max * 0.7];
  const ticks = []; const n = 10;
  for (let i = 0; i <= n * 5; i++) { const a = a0 + (a1 - a0) * (i / (n * 5)); const maior = i % 5 === 0; const [x1, y1] = pt(a, r - (maior ? 14 : 8)), [x2, y2] = pt(a, r - 2); ticks.push(<line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={maior ? "#e5e7eb" : "#6b7280"} strokeWidth={maior ? 2 : 1} />); if (maior) { const [tx, ty] = pt(a, r - 26); ticks.push(<text key={"t" + i} x={tx} y={ty + 3} textAnchor="middle" fontSize={tam / 22} fontWeight="700" fill="#cbd5e1">{Math.round((max * i) / (n * 5))}</text>); } }
  const na = v === null ? a0 : ang(v); const [nx, ny] = pt(na, r - 20); const [bx, by] = pt(na + Math.PI, 14);
  return <svg width="100%" viewBox={`0 0 ${tam} ${tam * 0.92}`} role="img" aria-label={`${rotulo}: ${v === null ? "sem dado" : v + unidade}`} style={{ display: "block", maxWidth: tam, margin: "0 auto" }}>
    <defs>
      <radialGradient id="mkFace" cx="50%" cy="45%" r="60%"><stop offset="0%" stopColor="#16161b" /><stop offset="100%" stopColor="#050507" /></radialGradient>
      <linearGradient id="mkBezel" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b8f99" /><stop offset="50%" stopColor="#2b2e36" /><stop offset="100%" stopColor="#9aa0ab" /></linearGradient>
      <filter id="mkGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    </defs>
    <circle cx={cx} cy={cy} r={r + 10} fill="url(#mkBezel)" />
    <circle cx={cx} cy={cy} r={r + 5} fill="url(#mkFace)" stroke="#1f2127" />
    {arco(0, max, "#1f2127", 8)}
    {arco(crit[0], crit[1], VERMELHO, 8, .85)}
    {v !== null && v > 0 && arco(0, v, c, 4, .9)}
    {ticks}
    <text x={cx} y={cy - r * 0.38} textAnchor="middle" fontSize={tam / 17} fontWeight="900" letterSpacing="2" fill="#d1d5db">{rotulo.toUpperCase()}</text>
    {v !== null && <g filter="url(#mkGlow)"><line x1={bx} y1={by} x2={nx} y2={ny} stroke={VERMELHO2} strokeWidth={4} strokeLinecap="round" /></g>}
    <circle cx={cx} cy={cy} r={11} fill="#0b0b0e" stroke="#9aa0ab" strokeWidth={3} />
    <text x={cx} y={cy + r * 0.55} textAnchor="middle" fontSize={tam / 7} fontWeight="900" fill={v === null ? CINZA : c} style={{ filter: "drop-shadow(0 0 8px rgba(229,9,20,.5))" }}>{v === null ? "—" : `${v}${unidade}`}</text>
    {sub && <text x={cx} y={cy + r * 0.55 + tam / 14} textAnchor="middle" fontSize={tam / 20} fill="#9ca3af">{sub}</text>}
  </svg>;
}

// Mini-relógio (anel) para os marcadores auxiliares.
export function Anel({ valor, rotulo, sub, cor, tam = 96, unidade = "%" }) {
  const r = tam / 2 - 9, cx = tam / 2, cy = tam / 2, circ = 2 * Math.PI * r;
  const v = typeof valor === "number" ? Math.max(0, Math.min(100, valor)) : null; const c = cor || corDe(v);
  return <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
    <svg width={tam} height={tam} viewBox={`0 0 ${tam} ${tam}`} role="img" aria-label={`${rotulo}: ${v === null ? "sem dado" : valor + unidade}`}>
      <circle cx={cx} cy={cy} r={r + 6} fill="none" stroke="#2b2e36" strokeWidth={2} />
      <circle cx={cx} cy={cy} r={r} fill="#0a0a0d" stroke="#1f2127" strokeWidth={7} />
      {v !== null && <circle cx={cx} cy={cy} r={r} fill="none" stroke={c} strokeWidth={7} strokeDasharray={`${(circ * v) / 100} ${circ}`} strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`} style={{ filter: `drop-shadow(0 0 6px ${c})` }} />}
      <text x={cx} y={cy + 6} textAnchor="middle" fontSize={tam / 4.5} fontWeight="900" fill={v === null ? CINZA : "#f3f4f6"}>{v === null ? "—" : `${valor}${unidade}`}</text>
    </svg>
    <div><div style={{ ...C.titulo, fontSize: 11, marginBottom: 2 }}>{rotulo}</div>{sub && <div style={C.micro}>{sub}</div>}</div>
  </div>;
}

// Luz de aviso (acende quando há problema).
export function Luz({ on, rotulo, cor = VERMELHO2 }) {
  return <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 56 }}>
    <span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid #3a3a42", background: on ? cor : "#15151a", boxShadow: on ? `0 0 10px ${cor}, 0 0 20px ${cor}66` : "inset 0 1px 2px #000" }} />
    <span style={{ fontSize: 8.5, letterSpacing: .5, color: on ? "#fecaca" : "#6b7280", textTransform: "uppercase", fontWeight: 700, textAlign: "center" }}>{rotulo}</span>
  </div>;
}

export function Cabecalho({ logo, badge, direita }) {
  return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingBottom: 10, borderBottom: "1px solid #2a2a31" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>{logo ? <img src={logo} alt="Moked" style={{ height: 26, filter: "drop-shadow(0 0 6px rgba(229,9,20,.35))" }} /> : <span style={{ fontWeight: 900, letterSpacing: 3, color: "#f3f4f6" }}>MOKED</span>}</div>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={C.badge}>{badge}</span>{direita}</div>
  </div>;
}

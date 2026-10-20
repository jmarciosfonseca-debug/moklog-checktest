// Cluster automotivo Moked — componentes visuais puros (sem dados, sem banco).
// Identidade (referência do Marcio, 20/10): preto profundo com reflexos, metal escovado, vermelho neon
// #E50914 / #FF1E27, cards chanfrados, mostradores com graduação branca, zona crítica vermelha e agulha iluminada.
export const VERMELHO = "#E50914", VERMELHO2 = "#FF1E27", VERDE = "#22c55e", AMARELO = "#f59e0b", CINZA = "#6b7280", AZUL = "#38bdf8";
export const LINHA = "#2a2a31";
const CHANFRO = "polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)";
const CARD_BG = "linear-gradient(160deg, #15151a 0%, #0b0b0e 55%, #08080a 100%)";

export const C = {
  main: { minHeight: "100vh", background: "radial-gradient(140% 70% at 50% -10%, #2a0609 0%, #0a0a0d 45%, #050507 100%)", color: "#e5e7eb", padding: "12px 12px 40px", fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif", maxWidth: 560, margin: "0 auto" },
  card: { position: "relative", background: CARD_BG, border: `1px solid ${LINHA}`, borderRadius: 6, padding: "14px 16px", marginBottom: 12, clipPath: CHANFRO, boxShadow: "inset 0 1px 0 rgba(255,255,255,.06), 0 10px 26px rgba(0,0,0,.65)" },
  cardBtn: { position: "relative", background: CARD_BG, border: `1px solid ${LINHA}`, borderRadius: 6, padding: "14px 16px", marginBottom: 12, clipPath: CHANFRO, boxShadow: "inset 0 1px 0 rgba(255,255,255,.06), 0 10px 26px rgba(0,0,0,.65)", width: "100%", textAlign: "left", color: "#e5e7eb", cursor: "pointer" },
  titulo: { fontSize: 13, fontWeight: 900, letterSpacing: 2, textTransform: "uppercase", color: "#f3f4f6", marginBottom: 8 },
  micro: { fontSize: 10.5, color: "#9ca3af" },
  chip: (c) => ({ display: "inline-block", fontSize: 10, fontWeight: 800, letterSpacing: .5, padding: "3px 8px", borderRadius: 3, background: c + "1f", color: c, border: `1px solid ${c}66`, marginRight: 6, marginTop: 4, textTransform: "uppercase" }),
  back: { minHeight: 34, background: "linear-gradient(180deg,#1f1f25,#0e0e12)", border: "1px solid #3a3a42", color: "#d1d5db", borderRadius: 4, padding: "6px 12px", fontSize: 12, cursor: "pointer", clipPath: "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)" },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  badge: { background: "linear-gradient(180deg,#2a0b0e,#160507)", border: `1px solid ${VERMELHO}aa`, color: "#fecaca", fontSize: 10.5, fontWeight: 900, letterSpacing: 1.5, padding: "5px 10px", clipPath: "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)", textTransform: "uppercase" },
  numero: (c) => ({ fontSize: 26, fontWeight: 900, color: c, textShadow: `0 0 12px ${c}88`, fontVariantNumeric: "tabular-nums" }),
};

export const corDe = (p) => (p === null || p === undefined ? CINZA : p >= 90 ? VERDE : p >= 70 ? AMARELO : VERMELHO2);

// Mostrador (conta-giros): bisel metálico, face carbono, graduação branca, zonas coloridas, agulha vermelha iluminada.
export function Mostrador({ valor, max = 100, rotulo, sub, tam = 220, cor, unidade = "%", invertido = false, zonaCritica, zonas, valorTexto }) {
  const cx = tam / 2, cy = tam / 2 + 10, r = tam / 2 - 18;
  const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25; // 270°
  const ang = (v) => a0 + (a1 - a0) * Math.max(0, Math.min(1, v / max));
  const pt = (a, rr = r) => [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
  const arco = (x, y, c, w, op = 1, rr = r) => { const [ax, ay] = pt(ang(x), rr), [bx, by] = pt(ang(y), rr); return <path d={`M${ax} ${ay} A${rr} ${rr} 0 ${ang(y) - ang(x) > Math.PI ? 1 : 0} 1 ${bx} ${by}`} stroke={c} strokeWidth={w} fill="none" strokeLinecap="butt" opacity={op} />; };
  const v = typeof valor === "number" ? valor : null;
  const c = cor || (v === null ? CINZA : invertido ? (v <= max * 0.1 ? VERDE : v <= max * 0.25 ? AMARELO : VERMELHO2) : corDe((v / max) * 100));
  const crit = zonaCritica !== undefined ? zonaCritica : invertido ? [max * 0.25, max] : [0, max * 0.7];
  const ticks = []; const n = tam >= 200 ? 10 : 5;
  for (let i = 0; i <= n * 5; i++) { const a = a0 + (a1 - a0) * (i / (n * 5)); const maior = i % 5 === 0; const [x1, y1] = pt(a, r - (maior ? 15 : 9)), [x2, y2] = pt(a, r - 3); ticks.push(<line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={maior ? "#f3f4f6" : "#9ca3af"} strokeWidth={maior ? 2.2 : 1} />); if (maior && i !== 0 && i !== n * 5) { const [tx, ty] = pt(a, r - 27); ticks.push(<text key={"t" + i} x={tx} y={ty + 3} textAnchor="middle" fontSize={tam / 23} fontWeight="700" fill="#e5e7eb">{Math.round((max * i) / (n * 5))}</text>); } }
  const na = v === null ? a0 : ang(v); const [nx, ny] = pt(na, r - 22); const [bx, by] = pt(na + Math.PI, 16);
  const [px, py] = pt(na + Math.PI / 2, 5), [qx, qy] = pt(na - Math.PI / 2, 5);
  const uid = `mk${Math.round(tam)}`;
  return <svg width="100%" viewBox={`0 0 ${tam} ${tam * 0.92}`} role="img" aria-label={`${rotulo}: ${valorTexto !== undefined ? valorTexto : v === null ? "sem dado" : v + unidade}`} style={{ display: "block", maxWidth: tam, margin: "0 auto" }}>
    <defs>
      <radialGradient id={uid + "face"} cx="50%" cy="40%" r="65%"><stop offset="0%" stopColor="#1c1c22" /><stop offset="70%" stopColor="#0a0a0d" /><stop offset="100%" stopColor="#050506" /></radialGradient>
      <linearGradient id={uid + "bezel"} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#d1d5db" /><stop offset="35%" stopColor="#4b5563" /><stop offset="60%" stopColor="#1f2937" /><stop offset="100%" stopColor="#9ca3af" /></linearGradient>
      <linearGradient id={uid + "glass"} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ffffff" stopOpacity=".10" /><stop offset="45%" stopColor="#ffffff" stopOpacity="0" /></linearGradient>
      <filter id={uid + "glow"} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    </defs>
    <circle cx={cx} cy={cy} r={r + 12} fill={`url(#${uid}bezel)`} />
    <circle cx={cx} cy={cy} r={r + 7} fill="#050506" />
    <circle cx={cx} cy={cy} r={r + 5} fill={`url(#${uid}face)`} stroke="#2a2a31" />
    {arco(0, max, "#26262c", 9)}
    {zonas ? zonas.map(([x, y, zc], i) => <g key={i}>{arco(x, y, zc, 9, .85)}</g>) : arco(crit[0], crit[1], VERMELHO, 9, .9)}
    <g filter={`url(#${uid}glow)`}>{zonas ? zonas.filter(([, , zc]) => zc === VERMELHO2 || zc === VERMELHO).map(([x, y], i) => <g key={"g" + i}>{arco(x, y, VERMELHO2, 3, .9, r + 7)}</g>) : arco(crit[0], crit[1], VERMELHO2, 3, .9, r + 7)}</g>
    {v !== null && v > 0 && arco(0, v, c, 3, .95, r - 6)}
    {ticks}
    <text x={cx} y={cy - r * 0.2} textAnchor="middle" fontSize={tam / 21} fontWeight="900" letterSpacing="1.5" fill="#d1d5db">{rotulo.toUpperCase()}</text>
    {v !== null && <g filter={`url(#${uid}glow)`}><polygon points={`${px} ${py} ${nx} ${ny} ${qx} ${qy} ${bx} ${by}`} fill={VERMELHO2} stroke="#fecaca" strokeWidth={.8} strokeLinejoin="round" /></g>}
    <circle cx={cx} cy={cy} r={11} fill="#0b0b0e" stroke="#9ca3af" strokeWidth={3} />
    <circle cx={cx} cy={cy} r={4} fill={VERMELHO2} />
    <text x={cx} y={cy + r * 0.30} textAnchor="middle" fontSize={valorTexto !== undefined && String(valorTexto).length > 3 ? tam / 10.5 : tam / 8.5} fontWeight="900" fill={v === null ? CINZA : c} style={{ filter: `drop-shadow(0 0 8px ${c}99)` }}>{valorTexto !== undefined ? valorTexto : v === null ? "—" : `${v}${unidade}`}</text>
    {sub && <text x={cx} y={cy + r * 0.30 + tam / 17} textAnchor="middle" fontSize={tam / 20} fill="#9ca3af">{sub}</text>}
    <circle cx={cx} cy={cy} r={r + 5} fill={`url(#${uid}glass)`} pointerEvents="none" />
  </svg>;
}

// Mini-relógio (anel) para os marcadores auxiliares — bisel metálico e arco vermelho/colorido com brilho.
export function Anel({ valor, rotulo, sub, cor, tam = 96, unidade = "%" }) {
  const r = tam / 2 - 11, cx = tam / 2, cy = tam / 2, circ = 2 * Math.PI * r;
  const v = typeof valor === "number" ? Math.max(0, Math.min(100, valor)) : null; const c = cor || corDe(v);
  const segs = 24; const marcas = [];
  for (let i = 0; i < segs; i++) { const a = (-Math.PI / 2) + (i / segs) * 2 * Math.PI; marcas.push(<line key={i} x1={cx + (r - 9) * Math.cos(a)} y1={cy + (r - 9) * Math.sin(a)} x2={cx + (r - 5) * Math.cos(a)} y2={cy + (r - 5) * Math.sin(a)} stroke="#6b7280" strokeWidth={1} />); }
  return <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
    <svg width={tam} height={tam} viewBox={`0 0 ${tam} ${tam}`} role="img" aria-label={`${rotulo}: ${v === null ? "sem dado" : valor + unidade}`}>
      <circle cx={cx} cy={cy} r={r + 8} fill="none" stroke="#4b5563" strokeWidth={2.5} />
      <circle cx={cx} cy={cy} r={r + 8} fill="none" stroke="#d1d5db" strokeWidth={1} strokeDasharray={`${circ * 0.18} ${circ}`} transform={`rotate(-150 ${cx} ${cy})`} />
      <circle cx={cx} cy={cy} r={r + 8} fill="none" stroke="#d1d5db" strokeWidth={1} strokeDasharray={`${circ * 0.18} ${circ}`} transform={`rotate(30 ${cx} ${cy})`} />
      <circle cx={cx} cy={cy} r={r} fill="#0b0b0e" stroke="#26262c" strokeWidth={6} />
      {marcas}
      {v !== null && <circle cx={cx} cy={cy} r={r} fill="none" stroke={c} strokeWidth={6} strokeDasharray={`${(circ * v) / 100} ${circ}`} strokeLinecap="butt" transform={`rotate(-90 ${cx} ${cy})`} style={{ filter: `drop-shadow(0 0 6px ${c})` }} />}
      <text x={cx} y={cy + 6} textAnchor="middle" fontSize={tam / 4.6} fontWeight="900" fill={v === null ? CINZA : "#f3f4f6"}>{v === null ? "—" : `${valor}${unidade}`}</text>
    </svg>
    <div><div style={{ ...C.titulo, fontSize: 11, marginBottom: 2 }}>{rotulo}</div>{sub && <div style={C.micro}>{sub}</div>}</div>
  </div>;
}

// Luz de aviso (acende quando há problema).
export function Luz({ on, rotulo, cor = VERMELHO2 }) {
  return <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 56 }}>
    <span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid #4b5563", background: on ? cor : "#15151a", boxShadow: on ? `0 0 10px ${cor}, 0 0 22px ${cor}66` : "inset 0 1px 2px #000" }} />
    <span style={{ fontSize: 8.5, letterSpacing: .5, color: on ? "#fecaca" : "#6b7280", textTransform: "uppercase", fontWeight: 700, textAlign: "center" }}>{rotulo}</span>
  </div>;
}

export function Cabecalho({ logo, badge, direita }) {
  return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingBottom: 10, borderBottom: `1px solid ${LINHA}` }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>{logo ? <img src={logo} alt="Moked" style={{ height: 26, filter: "drop-shadow(0 0 6px rgba(229,9,20,.35))" }} /> : <span style={{ fontWeight: 900, letterSpacing: 3, color: "#f3f4f6" }}>MOKED</span>}</div>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={C.badge}>{badge}</span>{direita}</div>
  </div>;
}

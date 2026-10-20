// Painel do Cliente — só leitura. "Painel do carro": marcadores grandes (teste semanal, equipe) e
// pequenos (mapa do dia, equipamentos, treinamentos, pendências). Proprietário (PIN de grupo) vê o macro e
// entra em cada parque; gestor do parque (PIN de projeto) vê só o seu. Gerencial vê tudo.
import { useEffect, useMemo, useState } from "react";
import { getApps } from "firebase/app";
import { getFirestore, doc, getDoc, collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { checkPin, clearSession, getClienteScope } from "../session";
import { carregarFotos, fotoDe } from "../fotosEquipe";
import { testeSemanal, equipeResumo, mapaResumo, equipamentosResumo, consolidarGrupo, corDe, GRUPOS_CLIENTE } from "./metricas";
import { ROTULO_SITUACAO } from "../mapaDiario/modelo";

const db = () => getFirestore(getApps()[0]);
const hojeISO = () => new Date().toLocaleDateString("sv-SE");
const fmtD = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—");

// ── Marcador (velocímetro) ────────────────────────────────────────────────────
function Gauge({ valor, rotulo, sub, tam = 150, cor, unidade = "%" }) {
  const r = tam / 2 - 12, cx = tam / 2, cy = tam / 2 + 6;
  const arc = (a0, a1, c, w) => { const p = (a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)]; const [x0, y0] = p(a0), [x1, y1] = p(a1); return <path d={`M${x0} ${y0} A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1} ${y1}`} stroke={c} strokeWidth={w} fill="none" strokeLinecap="round" />; };
  const ini = Math.PI * 0.8, fim = Math.PI * 2.2;
  const v = typeof valor === "number" ? Math.max(0, Math.min(100, valor)) : null;
  const c = cor || corDe(v);
  return <svg width={tam} height={tam * 0.78} viewBox={`0 0 ${tam} ${tam * 0.78}`} role="img" aria-label={`${rotulo}: ${v === null ? "sem dado" : v + unidade}`}>
    {arc(ini, fim, "#1e293b", 10)}
    {v !== null && v > 0 && arc(ini, ini + (fim - ini) * (v / 100), c, 10)}
    <text x={cx} y={cy - 6} textAnchor="middle" fontSize={tam / 5} fontWeight="900" fill={v === null ? "#64748b" : "#f8fafc"}>{v === null ? "—" : `${valor}${unidade}`}</text>
    <text x={cx} y={cy + tam / 9} textAnchor="middle" fontSize={tam / 13} fontWeight="700" fill="#94a3b8">{rotulo}</text>
    {sub && <text x={cx} y={cy + tam / 9 + tam / 11} textAnchor="middle" fontSize={tam / 15} fill="#64748b">{sub}</text>}
  </svg>;
}

const S = {
  main: { minHeight: "100vh", background: "#0b1220", color: "#e2e8f0", padding: "14px 14px 40px", fontFamily: "system-ui, sans-serif", maxWidth: 560, margin: "0 auto" },
  card: { background: "#111a2e", border: "1px solid #1e293b", borderRadius: 14, padding: 14, marginBottom: 12 },
  cardBtn: { background: "#111a2e", border: "1px solid #1e293b", borderRadius: 14, padding: 14, marginBottom: 12, width: "100%", textAlign: "left", color: "#e2e8f0", cursor: "pointer" },
  h: { fontSize: 13, fontWeight: 800, color: "#f8fafc", marginBottom: 6 },
  micro: { fontSize: 10.5, color: "#94a3b8" },
  chip: (c) => ({ display: "inline-block", fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 7, background: c + "22", color: c, marginRight: 6, marginTop: 4 }),
  back: { background: "transparent", border: "1px solid #334155", color: "#cbd5e1", borderRadius: 9, padding: "6px 12px", fontSize: 12, cursor: "pointer" },
  mini: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
};

// ── Carregamento por projeto (só leitura) ─────────────────────────────────────
async function carregarProjeto(pid, PROJECTS, stored, computeHealth) {
  const hoje = hojeISO();
  const [eq, equip, mapasSnap, fotos] = await Promise.all([
    getDoc(doc(db(), "equipes", pid)).then((s) => (s.exists() ? s.data() : {})).catch(() => ({})),
    getDoc(doc(db(), "equipamentos", pid)).then((s) => (s.exists() ? s.data() : null)).catch(() => null),
    getDocs(query(collection(db(), "equipes", pid, "mapas"), orderBy("data", "desc"), limit(6))).then((s) => s.docs.map((d) => d.data())).catch(() => []),
    carregarFotos(db(), pid).catch(() => ({})),
  ]);
  return {
    pid, nome: PROJECTS[pid]?.name || pid,
    teste: testeSemanal(stored?.[pid]?.history, computeHealth, PROJECTS[pid], hoje),
    equipe: equipeResumo(eq, hoje, eq.treinamentosEsperados || []),
    mapa: mapaResumo(mapasSnap, hoje),
    equip: equipamentosResumo(equip),
    colabs: (eq.colaboradores || []).filter((c) => c && (c.status || "ativo") === "ativo").map((c) => ({ id: c.id, nome: c.nome, cargo: c.cargo, turno: c.turno, desde: c.dataContratacao, foto: fotoDe(c, fotos), treinos: (c.historico || []).filter((h) => h && h.tipo === "Treinamento").length })),
    pendencias: (() => { const h = stored?.[pid]?.history || []; const last = h[h.length - 1]; if (!last) return []; const out = []; for (const cat of PROJECTS[pid]?.categories || []) { const s = last.state?.[cat.id]; const arr = Array.isArray(s) ? s : s && typeof s === "object" && cat.type === "single" ? [s] : []; arr.forEach((it, i) => { if (it && (it.status === "inop" || it.status === "partial")) out.push({ cat: cat.label, item: cat.itemLabels?.[i] || "", status: it.status, since: it.since || null, note: it.note || "" }); }); } return out; })(),
  };
}

// ── Telas ─────────────────────────────────────────────────────────────────────
function Avatar({ foto, nome, tam = 34 }) {
  const ini = (nome || "?").split(/\s+/).slice(0, 2).map((x) => x[0] || "").join("").toUpperCase();
  return foto ? <img src={foto} alt={nome} style={{ width: tam, height: tam, borderRadius: "50%", objectFit: "cover", border: "2px solid #1e293b" }} />
    : <div style={{ width: tam, height: tam, borderRadius: "50%", background: "#1e293b", color: "#94a3b8", fontSize: tam / 2.8, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{ini}</div>;
}

function TelaProjeto({ p, onBack, onAbrir }) {
  return <>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
      {onBack ? <button style={S.back} onClick={onBack}>← Meus parques</button> : <span />}
      <div style={{ fontSize: 15, fontWeight: 900 }}>{p.nome}</div>
    </div>
    {/* marcadores grandes */}
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      <button style={S.cardBtn} onClick={() => onAbrir("teste")} aria-label="Abrir teste semanal">
        <Gauge valor={p.teste.pct} rotulo="Teste semanal" sub={p.teste.data ? `${fmtD(p.teste.data)}${p.teste.atrasado ? " · atrasado" : ""}` : "sem teste"} cor={p.teste.atrasado && p.teste.pct !== null ? "#f59e0b" : undefined} />
        <div style={S.micro}>{p.teste.inop} inoperante{p.teste.inop === 1 ? "" : "s"} · {p.teste.parcial} parcial{p.teste.parcial === 1 ? "" : "is"}</div>
      </button>
      <button style={S.cardBtn} onClick={() => onAbrir("equipe")} aria-label="Abrir equipe">
        <Gauge valor={p.equipe.turnover} rotulo="Turnover 12 m" sub={p.equipe.turnover === null ? (p.equipe.turnoverMotivo || "não aferido") : `${p.equipe.saidas12m} saída${p.equipe.saidas12m === 1 ? "" : "s"} · ${p.equipe.entradas12m} entrada${p.equipe.entradas12m === 1 ? "" : "s"}`} cor={p.equipe.turnover === null ? undefined : p.equipe.turnover <= 10 ? "#22c55e" : p.equipe.turnover <= 25 ? "#f59e0b" : "#ef4444"} />
        <div style={S.micro}>{p.equipe.ativos} ativos{p.equipe.tempoMedioMeses !== null ? ` · ${p.equipe.tempoMedioMeses} meses de casa (média)` : ""}</div>
      </button>
    </div>
    {/* marcadores pequenos */}
    <div style={S.mini}>
      <button style={S.cardBtn} onClick={() => onAbrir("mapa")} aria-label="Abrir mapa do dia">
        <div style={S.h}>Mapa de equipe</div>
        {p.mapa.temMapa ? <>
          <div style={{ fontSize: 22, fontWeight: 900, color: p.mapa.faltas || p.mapa.vagos ? "#ef4444" : "#22c55e" }}>{p.mapa.presentes}/{p.mapa.postos}</div>
          <div style={S.micro}>{fmtD(p.mapa.data)} · {p.mapa.turno === "N" ? "noturno" : "diurno"}{p.mapa.hoje ? "" : " (último enviado)"}</div>
          <div>{p.mapa.faltas > 0 && <span style={S.chip("#ef4444")}>{p.mapa.faltas} falta{p.mapa.faltas === 1 ? "" : "s"}</span>}{p.mapa.ft > 0 && <span style={S.chip("#a855f7")}>{p.mapa.ft} FT</span>}{p.mapa.vagos > 0 && <span style={S.chip("#ef4444")}>{p.mapa.vagos} vago{p.mapa.vagos === 1 ? "" : "s"}</span>}{!p.mapa.faltas && !p.mapa.vagos && <span style={S.chip("#22c55e")}>equipe completa</span>}</div>
        </> : <div style={S.micro}>Sem mapa enviado</div>}
      </button>
      <button style={S.cardBtn} onClick={() => onAbrir("equip")} aria-label="Abrir equipamentos">
        <div style={S.h}>Equipamentos</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: corDe(p.equip.pct) }}>{p.equip.pct === null ? "—" : `${p.equip.pct}%`}</div>
        <div style={S.micro}>{p.equip.total} itens · {p.equip.inop} inop · {p.equip.parcial} parcial</div>
      </button>
      <button style={S.cardBtn} onClick={() => onAbrir("treino")} aria-label="Abrir treinamentos">
        <div style={S.h}>Treinamentos</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: corDe(p.equipe.treinadosPct) }}>{p.equipe.treinadosPct === null ? "—" : `${p.equipe.treinadosPct}%`}</div>
        <div style={S.micro}>da equipe com treinamento registrado{p.equipe.treinoIndicePct !== null ? ` · obrigatórios ${p.equipe.treinoIndicePct}%` : ""}</div>
      </button>
      <button style={S.cardBtn} onClick={() => onAbrir("pend")} aria-label="Abrir pendências">
        <div style={S.h}>Pendências</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: p.pendencias.length ? "#f59e0b" : "#22c55e" }}>{p.pendencias.length}</div>
        <div style={S.micro}>itens do teste semanal em aberto</div>
      </button>
    </div>
    {/* evidências */}
    <div style={S.card}>
      <div style={{ display: "flex", justifyContent: "space-between" }}><div style={S.h}>Últimos treinamentos</div><button style={{ ...S.back, padding: "3px 8px", fontSize: 11 }} onClick={() => onAbrir("treino")}>Ver todos ›</button></div>
      {p.equipe.ultimosTreinos.length === 0 && <div style={S.micro}>Nenhum treinamento registrado.</div>}
      {p.equipe.ultimosTreinos.slice(0, 3).map((t, i) => { const c = p.colabs.find((x) => x.id === t.colabId); return <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "6px 0", borderTop: i ? "1px solid #1e293b" : "none" }}>
        <Avatar foto={c?.foto} nome={t.colabNome} /><div><div style={{ fontSize: 12, fontWeight: 700 }}>{t.detalhe || t.label || "Treinamento"}</div><div style={S.micro}>{fmtD(t.data)} · {t.colabNome}</div></div></div>; })}
    </div>
  </>;
}

function Detalhe({ p, tipo, onBack }) {
  const sit = (s) => ({ presente: "#22c55e", atraso: "#f59e0b", falta: "#ef4444", ft: "#a855f7", cobertura: "#0ea5e9", troca: "#0ea5e9", vago: "#ef4444" }[s] || "#64748b");
  const titulo = { teste: "Teste semanal", equipe: "Equipe", mapa: "Mapa de equipe", equip: "Equipamentos", treino: "Treinamentos", pend: "Pendências" }[tipo];
  return <>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
      <button style={S.back} onClick={onBack}>← {p.nome}</button><div style={{ fontSize: 15, fontWeight: 900 }}>{titulo}</div>
    </div>
    {tipo === "teste" && <div style={S.card}>
      <Gauge valor={p.teste.pct} rotulo="Saúde dos sistemas" sub={p.teste.data ? `teste de ${fmtD(p.teste.data)}` : "sem teste"} tam={200} />
      <div style={S.h}>Últimas semanas</div>
      <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 70 }}>{p.teste.serie.map((s, i) => <div key={i} title={`${fmtD(s.data)} · ${s.pct}%`} style={{ flex: 1, textAlign: "center" }}><div style={{ height: Math.max(4, (s.pct || 0) * 0.6), background: corDe(s.pct), borderRadius: 4 }} /><div style={{ fontSize: 9, color: "#64748b" }}>{s.data ? s.data.slice(8, 10) + "/" + s.data.slice(5, 7) : ""}</div></div>)}</div>
      <div style={{ ...S.micro, marginTop: 8 }}>{p.teste.total} itens testados · {p.teste.inop} inoperantes · {p.teste.parcial} parciais{p.teste.atrasado ? " · ⚠️ teste da semana ainda não registrado" : ""}</div>
    </div>}
    {tipo === "equipe" && <div style={S.card}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>{Object.entries(p.equipe.porCargo).map(([c, n]) => <span key={c} style={S.chip("#0ea5e9")}>{n} {c}</span>)}</div>
      <div style={{ ...S.micro, marginBottom: 10 }}>Turnover 12 m: {p.equipe.turnover === null ? `não aferido (${p.equipe.turnoverMotivo})` : `${p.equipe.turnover}%`} · {p.equipe.saidas12m} saídas · {p.equipe.entradas12m} entradas</div>
      {p.colabs.map((c) => <div key={c.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "7px 0", borderTop: "1px solid #1e293b" }}>
        <Avatar foto={c.foto} nome={c.nome} tam={40} /><div style={{ flex: 1 }}><div style={{ fontSize: 12.5, fontWeight: 700 }}>{c.nome}</div><div style={S.micro}>{c.cargo}{c.turno ? ` · ${c.turno}` : ""}{c.desde ? ` · desde ${fmtD(c.desde)}` : ""}</div></div><span style={S.chip(c.treinos ? "#22c55e" : "#64748b")}>{c.treinos} trein.</span></div>)}
    </div>}
    {tipo === "mapa" && <div style={S.card}>
      {!p.mapa.temMapa && <div style={S.micro}>Sem mapa enviado.</div>}
      {p.mapa.temMapa && <div style={{ ...S.micro, marginBottom: 8 }}>{fmtD(p.mapa.data)} · turno {p.mapa.turno === "N" ? "noturno" : "diurno"} · {p.mapa.presentes} de {p.mapa.postos} postos cobertos</div>}
      {p.mapa.lista.map((x, i) => { const c = p.colabs.find((k) => k.id === x.pessoaId); return <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "6px 0", borderTop: "1px solid #1e293b" }}>
        <Avatar foto={c?.foto} nome={x.nome || x.posto} /><div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 700 }}>{x.nome || "—"}</div><div style={S.micro}>{x.posto}</div></div><span style={S.chip(sit(x.situacao))}>{ROTULO_SITUACAO[x.situacao] || x.situacao}</span></div>; })}
    </div>}
    {tipo === "equip" && <div style={S.card}>
      <Gauge valor={p.equip.pct} rotulo="Equipamentos operantes" sub={`${p.equip.total} itens`} tam={200} />
      <div style={S.micro}>{p.equip.ok} ok · {p.equip.parcial} parciais · {p.equip.inop} inoperantes. Detalhe por item fica com a gestão Moked.</div>
    </div>}
    {tipo === "treino" && <div style={S.card}>
      <div style={{ ...S.micro, marginBottom: 8 }}>{p.equipe.treinadosPct === null ? "" : `${p.equipe.treinadosPct}% da equipe com treinamento registrado.`} Evidências (fotos dos treinamentos) entram na próxima fase.</div>
      {p.equipe.ultimosTreinos.length === 0 && <div style={S.micro}>Nenhum treinamento registrado.</div>}
      {p.equipe.ultimosTreinos.map((t, i) => { const c = p.colabs.find((x) => x.id === t.colabId); return <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "6px 0", borderTop: "1px solid #1e293b" }}>
        <Avatar foto={c?.foto} nome={t.colabNome} /><div><div style={{ fontSize: 12, fontWeight: 700 }}>{t.detalhe || t.label || "Treinamento"}</div><div style={S.micro}>{fmtD(t.data)} · {t.colabNome}</div></div></div>; })}
    </div>}
    {tipo === "pend" && <div style={S.card}>
      {p.pendencias.length === 0 && <div style={S.micro}>Nenhuma pendência no último teste semanal.</div>}
      {p.pendencias.map((x, i) => <div key={i} style={{ padding: "7px 0", borderTop: i ? "1px solid #1e293b" : "none" }}><span style={S.chip(x.status === "inop" ? "#ef4444" : "#f59e0b")}>{x.status === "inop" ? "INOPERANTE" : "PARCIAL"}</span><div style={{ fontSize: 12, fontWeight: 700 }}>{x.cat}{x.item ? ` — ${x.item}` : ""}</div><div style={S.micro}>{x.since ? `desde ${fmtD(x.since)}` : ""}{x.note ? ` · ${x.note}` : ""}</div></div>)}
    </div>}
  </>;
}

function TelaMacro({ escopo, dados, onAbrir }) {
  const g = consolidarGrupo(dados);
  const label = GRUPOS_CLIENTE[escopo]?.label || escopo;
  return <>
    <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 10 }}>{label} · {g.projetos} parques</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      <div style={S.card}><Gauge valor={g.testePct} rotulo="Testes semanais" sub={g.testesAtrasados ? `${g.testesAtrasados} atrasado${g.testesAtrasados === 1 ? "" : "s"}` : "em dia"} /></div>
      <div style={S.card}><Gauge valor={g.turnover} rotulo="Turnover 12 m" sub={`${g.equipeAtivos} colaboradores`} cor={g.turnover === null ? undefined : g.turnover <= 10 ? "#22c55e" : g.turnover <= 25 ? "#f59e0b" : "#ef4444"} /></div>
    </div>
    <div style={S.mini}>
      <div style={S.card}><div style={S.h}>Equipes hoje</div><div style={{ fontSize: 22, fontWeight: 900, color: g.faltasHoje ? "#ef4444" : "#22c55e" }}>{g.faltasHoje} falta{g.faltasHoje === 1 ? "" : "s"}</div><div style={S.micro}>{g.mapasHoje} de {g.projetos} mapas enviados hoje</div></div>
      <div style={S.card}><div style={S.h}>Equipamentos</div><div style={{ fontSize: 22, fontWeight: 900, color: corDe(g.equipPct) }}>{g.equipPct === null ? "—" : `${g.equipPct}%`}</div><div style={S.micro}>{g.equipInop} inoperantes no grupo</div></div>
    </div>
    <div style={{ ...S.h, marginTop: 6 }}>Parques</div>
    {Object.values(dados).map((p) => <button key={p.pid} style={S.cardBtn} onClick={() => onAbrir(p.pid)} aria-label={`Abrir ${p.nome}`}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div><div style={{ fontSize: 13, fontWeight: 800 }}>{p.nome}</div><div style={S.micro}>{p.equipe.ativos} colaboradores · teste {p.teste.data ? fmtD(p.teste.data) : "—"}</div></div>
        <div style={{ display: "flex", gap: 6 }}>
          <span title="Teste semanal" style={{ width: 12, height: 12, borderRadius: "50%", background: p.teste.atrasado ? "#f59e0b" : corDe(p.teste.pct) }} />
          <span title="Mapa do dia" style={{ width: 12, height: 12, borderRadius: "50%", background: !p.mapa.hoje ? "#64748b" : p.mapa.faltas || p.mapa.vagos ? "#ef4444" : "#22c55e" }} />
          <span title="Equipamentos" style={{ width: 12, height: 12, borderRadius: "50%", background: corDe(p.equip.pct) }} />
        </div>
      </div>
    </button>)}
    <div style={S.micro}>Marcadores: teste semanal · mapa do dia · equipamentos</div>
  </>;
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function PainelCliente({ PROJECTS, stored, computeHealth, onBack }) {
  const [escopo, setEscopo] = useState(() => getClienteScope());
  const [pin, setPin] = useState(""), [erro, setErro] = useState("");
  const [dados, setDados] = useState(null), [carregando, setCarregando] = useState(false);
  const [pid, setPid] = useState(null), [detalhe, setDetalhe] = useState(null);
  const pids = useMemo(() => (escopo ? (escopo.pids || Object.keys(PROJECTS)) : []), [escopo, PROJECTS]);

  useEffect(() => {
    if (!escopo) return;
    let vivo = true; setCarregando(true);
    Promise.all(pids.map((p) => carregarProjeto(p, PROJECTS, stored, computeHealth).catch(() => null))).then((xs) => {
      if (!vivo) return; const m = {}; xs.forEach((x) => { if (x) m[x.pid] = x; }); setDados(m); setCarregando(false);
      if (pids.length === 1) setPid(pids[0]);
    });
    return () => { vivo = false; };
  }, [escopo, pids, PROJECTS, stored, computeHealth]);

  const entrar = async () => { setErro(""); const n = await checkPin(pin, { cliente: true }); if (!n) { setErro("PIN inválido para o Painel do Cliente."); return; } setPin(""); setEscopo(getClienteScope()); };
  const sair = () => { clearSession(); setEscopo(null); setDados(null); setPid(null); setDetalhe(null); onBack && onBack(); };

  if (!escopo) return <main style={S.main}>
    <button style={S.back} onClick={onBack}>← Início</button>
    <div style={{ marginTop: 30, textAlign: "center" }}>
      <div style={{ fontSize: 20, fontWeight: 900 }}>Painel do Cliente</div>
      <div style={{ ...S.micro, marginBottom: 16 }}>Acesso de leitura: gestor do parque ou proprietário</div>
      <input type="password" inputMode="numeric" aria-label="PIN do cliente" value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => e.key === "Enter" && entrar()} placeholder="PIN" style={{ width: "100%", maxWidth: 260, padding: 12, borderRadius: 10, border: "1px solid #334155", background: "#0f172a", color: "#f8fafc", fontSize: 18, textAlign: "center", letterSpacing: 6 }} />
      {erro && <div role="alert" style={{ color: "#ef4444", fontSize: 12, marginTop: 8 }}>{erro}</div>}
      <div><button onClick={entrar} style={{ marginTop: 12, background: "#2563eb", color: "#fff", border: "none", borderRadius: 10, padding: "10px 28px", fontWeight: 800, cursor: "pointer" }}>Entrar</button></div>
    </div>
  </main>;

  return <main style={S.main}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
      <div><div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, letterSpacing: 1 }}>PAINEL DO CLIENTE</div><div style={S.micro}>{escopo.escopo === "MOKED" ? "Visão Moked (gerencial)" : escopo.pids.length > 1 ? "Proprietário · visão macro" : "Gestor do parque"} · somente leitura</div></div>
      <button style={S.back} onClick={sair}>Sair</button>
    </div>
    {carregando && <p role="status" style={S.micro}>Lendo os dados dos parques…</p>}
    {!carregando && dados && (
      pid && dados[pid]
        ? (detalhe ? <Detalhe p={dados[pid]} tipo={detalhe} onBack={() => setDetalhe(null)} />
          : <TelaProjeto p={dados[pid]} onBack={pids.length > 1 ? () => setPid(null) : null} onAbrir={setDetalhe} />)
        : <TelaMacro escopo={escopo.escopo} dados={dados} onAbrir={setPid} />
    )}
  </main>;
}

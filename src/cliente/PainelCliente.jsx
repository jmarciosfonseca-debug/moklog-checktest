// Área do Cliente — cluster automotivo Moked, só leitura. Proprietário (PIN de grupo) vê o macro e entra em
// cada parque; gestor do parque (PIN de projeto) vê só o seu. Gerencial vê tudo. Nada aqui grava.
import { useEffect, useMemo, useState } from "react";
import { getApps } from "firebase/app";
import { getFirestore, doc, getDoc, collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { checkPin, clearSession, getClienteScope } from "../session";
import { carregarFotos, fotoDe } from "../fotosEquipe";
import { testeSemanal, equipeResumo, mapaResumo, equipamentosResumo, consolidarGrupo, sistemasResumo, luzes, GRUPOS_CLIENTE } from "./metricas";
import { PERIMETRAL_VIA_RONDAS, zonasRuinsProjeto } from "../v360Perimetral";
import { ROTULO_SITUACAO } from "../mapaDiario/modelo";
import { MOKED_LOGO } from "../generatePDF";
import { C, Mostrador, Anel, Luz, Cabecalho, corDe, VERMELHO2, VERDE, AMARELO, CINZA } from "./Cluster";

const db = () => getFirestore(getApps()[0]);
const hojeISO = () => new Date().toLocaleDateString("sv-SE");
const fmtD = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—");
const corSit = (s) => ({ presente: VERDE, atraso: AMARELO, falta: VERMELHO2, ft: "#a855f7", cobertura: "#38bdf8", troca: "#38bdf8", vago: VERMELHO2 }[s] || CINZA);
const corTurnover = (t) => (t === null ? CINZA : t <= 10 ? VERDE : t <= 25 ? AMARELO : VERMELHO2);
const ler = (col, pid) => getDoc(doc(db(), col, pid)).then((s) => (s.exists() ? s.data() : null)).catch(() => null);

// ── Carregamento por projeto: tudo que a gestão vê hoje, em leitura ──────────
async function carregarProjeto(pid, PROJECTS, stored, computeHealth, ctmkData, score360) {
  const hoje = hojeISO();
  const [eq, equip, mapasSnap, fotos, keyaccess, ilum, energia, peri, rondas, s360] = await Promise.all([
    ler("equipes", pid).then((d) => d || {}),
    ler("equipamentos", pid),
    getDocs(query(collection(db(), "equipes", pid, "mapas"), orderBy("data", "desc"), limit(6))).then((s) => s.docs.map((d) => d.data())).catch(() => []),
    carregarFotos(db(), pid).catch(() => ({})),
    ler("keyaccess_falhas", pid), ler("iluminacao", pid), ler("energia_ocorrencias", pid), ler("perimetral", pid),
    PERIMETRAL_VIA_RONDAS.includes(pid) ? ler("rondas", pid) : Promise.resolve(null),
    score360 ? score360(pid).catch(() => null) : Promise.resolve(null),
  ]);
  const colabs = (eq.colaboradores || []).filter((c) => c && (c.status || "ativo") === "ativo").map((c) => ({ id: c.id, nome: c.nome, cargo: c.cargo, turno: c.turno, desde: c.dataContratacao, foto: fotoDe(c, fotos), treinos: (c.historico || []).filter((h) => h && h.tipo === "Treinamento").length }));
  const h = stored?.[pid]?.history || []; const last = h[h.length - 1];
  const pendencias = []; if (last) for (const cat of PROJECTS[pid]?.categories || []) { const s = last.state?.[cat.id]; const arr = Array.isArray(s) ? s : s && typeof s === "object" && cat.type === "single" ? [s] : []; arr.forEach((it, i) => { if (it && (it.status === "inop" || it.status === "partial")) pendencias.push({ cat: cat.label, item: cat.itemLabels?.[i] || "", status: it.status, since: it.since || null, note: it.note || "" }); }); }
  let perimetralZonasRuins = 0; try { perimetralZonasRuins = zonasRuinsProjeto(pid, peri, rondas); } catch { perimetralZonasRuins = 0; }
  const p = {
    pid, nome: PROJECTS[pid]?.name || pid,
    teste: testeSemanal(h, computeHealth, PROJECTS[pid], hoje),
    equipe: equipeResumo(eq, hoje, eq.treinamentosEsperados || []),
    mapa: mapaResumo(mapasSnap, hoje),
    equip: equipamentosResumo(equip),
    sistemas: sistemasResumo({ ctmk: ctmkData?.[pid], keyaccess, iluminacao: ilum, energia, perimetralZonasRuins, score360: s360 }),
    colabs, pendencias,
  };
  p.luzes = luzes(p);
  return p;
}

function Avatar({ foto, nome, tam = 36 }) {
  const ini = (nome || "?").split(/\s+/).slice(0, 2).map((x) => x[0] || "").join("").toUpperCase();
  const borda = { width: tam, height: tam, clipPath: "polygon(20% 0, 100% 0, 100% 80%, 80% 100%, 0 100%, 0 20%)" };
  return foto ? <img src={foto} alt={nome} style={{ ...borda, objectFit: "cover" }} />
    : <div style={{ ...borda, background: "#1b1b20", color: "#9ca3af", fontSize: tam / 2.8, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{ini}</div>;
}
const Linha = ({ children, primeiro }) => <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "7px 0", borderTop: primeiro ? "none" : "1px solid #1f2127" }}>{children}</div>;
const Luzes = ({ p }) => <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 4px 4px", borderTop: "1px solid #2a2a31", marginTop: 4 }}>{p.luzes.map((l) => <Luz key={l.id} on={l.on} rotulo={l.rotulo} />)}</div>;

// ── Parque ────────────────────────────────────────────────────────────────────
function TelaProjeto({ p, onBack, onAbrir }) {
  const m = p.mapa, s = p.sistemas;
  const presencaPct = m.temMapa && m.postos ? Math.round((m.presentes / m.postos) * 100) : null;
  return <>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
      {onBack ? <button style={C.back} onClick={onBack}>← Meus parques</button> : <span />}
      <div style={{ ...C.titulo, marginBottom: 0 }}>{p.nome}</div>
    </div>
    {/* conta-giros: turnover */}
    <button style={C.cardBtn} onClick={() => onAbrir("equipe")} aria-label="Abrir equipe">
      <Mostrador valor={p.equipe.turnover} max={50} rotulo="Turnover 12 m" unidade="%" invertido cor={corTurnover(p.equipe.turnover)} sub={p.equipe.turnover === null ? (p.equipe.turnoverMotivo || "não aferido") : `${p.equipe.saidas12m} saída${p.equipe.saidas12m === 1 ? "" : "s"} · ${p.equipe.entradas12m} entrada${p.equipe.entradas12m === 1 ? "" : "s"}`} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}><span style={C.micro}>{p.equipe.ativos} ativos{p.equipe.tempoMedioMeses !== null ? ` · ${p.equipe.tempoMedioMeses} meses de casa (média)` : ""}</span><span style={C.micro}>toque para ver a equipe ›</span></div>
    </button>
    {/* velocímetro: equipe hoje + saúde dos sistemas */}
    <div style={C.grid2}>
      <button style={C.cardBtn} onClick={() => onAbrir("mapa")} aria-label="Abrir mapa do dia">
        <Mostrador valor={presencaPct} rotulo="Equipe hoje" tam={180} sub={m.temMapa ? `${m.presentes}/${m.postos} postos · ${fmtD(m.data)}${m.hoje ? "" : " (último)"}` : "sem mapa"} />
        <div>{m.faltas > 0 && <span style={C.chip(VERMELHO2)}>{m.faltas} falta{m.faltas === 1 ? "" : "s"}</span>}{m.ft > 0 && <span style={C.chip("#a855f7")}>{m.ft} FT</span>}{m.vagos > 0 && <span style={C.chip(VERMELHO2)}>{m.vagos} vago{m.vagos === 1 ? "" : "s"}</span>}{m.temMapa && !m.faltas && !m.vagos && <span style={C.chip(VERDE)}>completa</span>}</div>
      </button>
      <button style={C.cardBtn} onClick={() => onAbrir("teste")} aria-label="Abrir teste semanal">
        <Mostrador valor={p.teste.pct} rotulo="Sistemas" tam={180} cor={p.teste.atrasado && p.teste.pct !== null ? AMARELO : undefined} sub={p.teste.data ? `teste ${fmtD(p.teste.data)}${p.teste.atrasado ? " · atrasado" : ""}` : "sem teste"} />
        <div><span style={C.chip(p.teste.inop ? VERMELHO2 : VERDE)}>{p.teste.inop} inop</span><span style={C.chip(p.teste.parcial ? AMARELO : CINZA)}>{p.teste.parcial} parcial</span>{s.score360 !== null && <span style={C.chip(corDe(s.score360))}>360: {s.score360}</span>}</div>
      </button>
    </div>
    {/* relógios menores */}
    <div style={C.card}>
      <div style={C.titulo}>Progressos</div>
      <div style={C.grid2}>
        <button style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", textAlign: "left", padding: 0 }} onClick={() => onAbrir("treino")} aria-label="Abrir treinamentos"><Anel valor={p.equipe.treinadosPct} rotulo="Formação" sub={`${p.equipe.ultimosTreinos.length ? "último " + fmtD(p.equipe.ultimosTreinos[0].data) : "sem registro"}`} /></button>
        <button style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", textAlign: "left", padding: 0 }} onClick={() => onAbrir("equip")} aria-label="Abrir equipamentos"><Anel valor={p.equip.pct} rotulo="Equipamentos" sub={`${p.equip.total} itens · ${p.equip.inop} inop`} /></button>
        <button style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", textAlign: "left", padding: 0 }} onClick={() => onAbrir("sistemas")} aria-label="Abrir sistemas"><Anel valor={s.ilumPct} rotulo="Iluminação" sub={s.ilumTotal ? `${s.ilumDef} deficientes de ${s.ilumTotal}` : "sem dados"} /></button>
        <button style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", textAlign: "left", padding: 0 }} onClick={() => onAbrir("pend")} aria-label="Abrir pendências"><Anel valor={p.pendencias.length} unidade="" rotulo="Pendências" cor={p.pendencias.length ? AMARELO : VERDE} sub="itens do teste em aberto" /></button>
      </div>
      <Luzes p={p} />
    </div>
    {/* evidências */}
    <div style={C.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div style={C.titulo}>Equipe · evidências</div><button style={{ ...C.back, padding: "3px 8px", fontSize: 11 }} onClick={() => onAbrir("equipe")}>Visualizar todas ›</button></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
        {p.colabs.filter((c) => c.foto).slice(0, 6).map((c) => <div key={c.id} style={{ position: "relative" }}><img src={c.foto} alt={c.nome} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", clipPath: "polygon(12% 0, 100% 0, 100% 88%, 88% 100%, 0 100%, 0 12%)", border: "1px solid #2a2a31" }} /><div style={{ position: "absolute", left: 6, bottom: 6, fontSize: 9, fontWeight: 800, color: "#f3f4f6", textShadow: "0 1px 3px #000" }}>{(c.nome || "").split(" ")[0]}</div></div>)}
        {p.colabs.filter((c) => c.foto).length === 0 && <div style={{ ...C.micro, gridColumn: "1 / -1" }}>Sem fotos cadastradas. Fotos de treinamento/campo entram na próxima fase.</div>}
      </div>
      {p.equipe.ultimosTreinos.slice(0, 2).map((t, i) => <Linha key={i} primeiro={false}><div><div style={{ fontSize: 12, fontWeight: 700 }}>{t.detalhe || t.label || "Treinamento"}</div><div style={C.micro}>{fmtD(t.data)} · {t.colabNome}</div></div></Linha>)}
    </div>
  </>;
}

// ── Detalhes ──────────────────────────────────────────────────────────────────
function Detalhe({ p, tipo, onBack }) {
  const s = p.sistemas;
  const titulo = { teste: "Teste semanal", equipe: "Equipe", mapa: "Mapa de equipe", equip: "Equipamentos", treino: "Formação", pend: "Pendências", sistemas: "Sistemas" }[tipo];
  return <>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}><button style={C.back} onClick={onBack}>← {p.nome}</button><div style={{ ...C.titulo, marginBottom: 0 }}>{titulo}</div></div>
    {tipo === "teste" && <div style={C.card}>
      <Mostrador valor={p.teste.pct} rotulo="Sistemas" sub={p.teste.data ? `teste de ${fmtD(p.teste.data)}` : "sem teste"} />
      <div style={C.titulo}>Últimas semanas</div>
      <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 70 }}>{p.teste.serie.map((x, i) => <div key={i} title={`${fmtD(x.data)} · ${x.pct}%`} style={{ flex: 1, textAlign: "center" }}><div style={{ height: Math.max(4, (x.pct || 0) * 0.6), background: corDe(x.pct), borderRadius: 2, boxShadow: `0 0 6px ${corDe(x.pct)}66` }} /><div style={{ fontSize: 9, color: "#6b7280" }}>{x.data ? x.data.slice(8, 10) + "/" + x.data.slice(5, 7) : ""}</div></div>)}</div>
      <div style={{ ...C.micro, marginTop: 8 }}>{p.teste.total} itens testados · {p.teste.inop} inoperantes · {p.teste.parcial} parciais{p.teste.atrasado ? " · ⚠️ teste da semana ainda não registrado" : ""}</div>
    </div>}
    {tipo === "equipe" && <div style={C.card}>
      <div style={{ marginBottom: 8 }}>{Object.entries(p.equipe.porCargo).map(([c, n]) => <span key={c} style={C.chip("#38bdf8")}>{n} {c}</span>)}</div>
      <div style={{ ...C.micro, marginBottom: 8 }}>Turnover 12 m: {p.equipe.turnover === null ? `não aferido (${p.equipe.turnoverMotivo})` : `${p.equipe.turnover}%`} · {p.equipe.saidas12m} saídas · {p.equipe.entradas12m} entradas</div>
      {p.colabs.map((c, i) => <Linha key={c.id} primeiro={i === 0}><Avatar foto={c.foto} nome={c.nome} tam={42} /><div style={{ flex: 1 }}><div style={{ fontSize: 12.5, fontWeight: 700 }}>{c.nome}</div><div style={C.micro}>{c.cargo}{c.turno ? ` · ${c.turno}` : ""}{c.desde ? ` · desde ${fmtD(c.desde)}` : ""}</div></div><span style={C.chip(c.treinos ? VERDE : CINZA)}>{c.treinos} trein.</span></Linha>)}
    </div>}
    {tipo === "mapa" && <div style={C.card}>
      {!p.mapa.temMapa && <div style={C.micro}>Sem mapa enviado.</div>}
      {p.mapa.temMapa && <div style={{ ...C.micro, marginBottom: 6 }}>{fmtD(p.mapa.data)} · turno {p.mapa.turno === "N" ? "noturno" : "diurno"} · {p.mapa.presentes} de {p.mapa.postos} postos cobertos</div>}
      {p.mapa.lista.map((x, i) => { const c = p.colabs.find((k) => k.id === x.pessoaId); return <Linha key={i} primeiro={i === 0}><Avatar foto={c?.foto} nome={x.nome || x.posto} /><div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 700 }}>{x.nome || "—"}</div><div style={C.micro}>{x.posto}</div></div><span style={C.chip(corSit(x.situacao))}>{ROTULO_SITUACAO[x.situacao] || x.situacao}</span></Linha>; })}
    </div>}
    {tipo === "equip" && <div style={C.card}>
      <Mostrador valor={p.equip.pct} rotulo="Equipamentos" sub={`${p.equip.total} itens`} />
      <div style={C.micro}>{p.equip.ok} ok · {p.equip.parcial} parciais · {p.equip.inop} inoperantes. Detalhe por item fica com a gestão Moked.</div>
    </div>}
    {tipo === "treino" && <div style={C.card}>
      <div style={{ ...C.micro, marginBottom: 8 }}>{p.equipe.treinadosPct === null ? "" : `${p.equipe.treinadosPct}% da equipe com treinamento registrado.`} Evidências (fotos dos treinamentos) entram na próxima fase.</div>
      {p.equipe.ultimosTreinos.length === 0 && <div style={C.micro}>Nenhum treinamento registrado.</div>}
      {p.equipe.ultimosTreinos.map((t, i) => { const c = p.colabs.find((x) => x.id === t.colabId); return <Linha key={i} primeiro={i === 0}><Avatar foto={c?.foto} nome={t.colabNome} /><div><div style={{ fontSize: 12, fontWeight: 700 }}>{t.detalhe || t.label || "Treinamento"}</div><div style={C.micro}>{fmtD(t.data)} · {t.colabNome}</div></div></Linha>; })}
    </div>}
    {tipo === "pend" && <div style={C.card}>
      {p.pendencias.length === 0 && <div style={C.micro}>Nenhuma pendência no último teste semanal.</div>}
      {p.pendencias.map((x, i) => <div key={i} style={{ padding: "7px 0", borderTop: i ? "1px solid #1f2127" : "none" }}><span style={C.chip(x.status === "inop" ? VERMELHO2 : AMARELO)}>{x.status === "inop" ? "Inoperante" : "Parcial"}</span><div style={{ fontSize: 12, fontWeight: 700 }}>{x.cat}{x.item ? ` — ${x.item}` : ""}</div><div style={C.micro}>{x.since ? `desde ${fmtD(x.since)}` : ""}{x.note ? ` · ${x.note}` : ""}</div></div>)}
    </div>}
    {tipo === "sistemas" && <div style={C.card}>
      {s.score360 !== null && <Mostrador valor={s.score360} rotulo="Visão 360" sub="nota do parque" />}
      {[["CTMK (central)", s.ctmkOff ? `OFF-LINE há ${s.ctmkDias} dia${s.ctmkDias === 1 ? "" : "s"}` : "on-line", s.ctmkOff ? VERMELHO2 : VERDE],
        ["KeyAccess", s.keyAbertas ? `${s.keyAbertas} falha${s.keyAbertas === 1 ? "" : "s"} em aberto` : "sem falhas abertas", s.keyAbertas ? VERMELHO2 : VERDE],
        ["Iluminação", s.ilumTotal ? `${s.ilumDef} deficientes de ${s.ilumTotal} (${s.ilumPct}% ok)` : "sem dados", s.ilumTotal ? corDe(s.ilumPct) : CINZA],
        ["Energia", `${s.quedas7d} queda${s.quedas7d === 1 ? "" : "s"} em 7 dias${s.energiaAberta ? " · ocorrência em aberto" : ""}`, s.energiaAberta ? VERMELHO2 : s.quedas7d ? AMARELO : VERDE],
        ["Perimetral", s.perimetralZonasRuins ? `${s.perimetralZonasRuins} zona${s.perimetralZonasRuins === 1 ? "" : "s"} com problema` : "zonas ok", s.perimetralZonasRuins ? VERMELHO2 : VERDE],
      ].map(([r, v, c], i) => <Linha key={r} primeiro={i === 0}><span style={{ width: 10, height: 10, borderRadius: "50%", background: c, boxShadow: `0 0 8px ${c}` }} /><div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 700 }}>{r}</div><div style={C.micro}>{v}</div></div></Linha>)}
      {s.vulnerabilidades.length > 0 && <div style={{ ...C.micro, marginTop: 8 }}>Vulnerabilidades: {s.vulnerabilidades.join(" · ")}</div>}
    </div>}
  </>;
}

// ── Macro (proprietário) ──────────────────────────────────────────────────────
function TelaMacro({ escopo, dados, onAbrir }) {
  const g = consolidarGrupo(dados);
  const label = GRUPOS_CLIENTE[escopo]?.label || escopo;
  return <>
    <div style={{ ...C.titulo, marginBottom: 10 }}>{label} · {g.projetos} parques</div>
    <div style={C.grid2}>
      <div style={C.card}><Mostrador valor={g.turnover} max={50} invertido rotulo="Turnover" tam={180} cor={corTurnover(g.turnover)} sub={`${g.equipeAtivos} colaboradores`} /></div>
      <div style={C.card}><Mostrador valor={g.testePct} rotulo="Sistemas" tam={180} sub={g.testesAtrasados ? `${g.testesAtrasados} teste${g.testesAtrasados === 1 ? "" : "s"} atrasado${g.testesAtrasados === 1 ? "" : "s"}` : "testes em dia"} /></div>
    </div>
    <div style={C.card}><div style={C.grid2}>
      <Anel valor={g.faltasHoje} unidade="" rotulo="Faltas hoje" cor={g.faltasHoje ? VERMELHO2 : VERDE} sub={`${g.mapasHoje} de ${g.projetos} mapas enviados`} />
      <Anel valor={g.equipPct} rotulo="Equipamentos" sub={`${g.equipInop} inoperantes no grupo`} />
    </div></div>
    <div style={C.titulo}>Parques</div>
    {Object.values(dados).map((p) => <button key={p.pid} style={C.cardBtn} onClick={() => onAbrir(p.pid)} aria-label={`Abrir ${p.nome}`}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div><div style={{ fontSize: 13, fontWeight: 800 }}>{p.nome}</div><div style={C.micro}>{p.equipe.ativos} colaboradores · teste {p.teste.data ? fmtD(p.teste.data) : "—"}{p.equipe.turnover !== null ? ` · turnover ${p.equipe.turnover}%` : ""}</div></div>
        <div style={{ display: "flex", gap: 6 }}>
          {[[p.teste.atrasado ? AMARELO : corDe(p.teste.pct), "Teste semanal"], [!p.mapa.hoje ? CINZA : p.mapa.faltas || p.mapa.vagos ? VERMELHO2 : VERDE, "Mapa do dia"], [corDe(p.equip.pct), "Equipamentos"], [p.sistemas.ctmkOff ? VERMELHO2 : VERDE, "CTMK"]].map(([c, t]) => <span key={t} title={t} style={{ width: 12, height: 12, borderRadius: "50%", background: c, boxShadow: `0 0 8px ${c}` }} />)}
        </div>
      </div>
    </button>)}
    <div style={C.micro}>Luzes: teste semanal · mapa do dia · equipamentos · CTMK</div>
  </>;
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function PainelCliente({ PROJECTS, stored, computeHealth, ctmkData, score360, onBack }) {
  const [escopo, setEscopo] = useState(() => getClienteScope());
  const [pin, setPin] = useState(""), [erro, setErro] = useState("");
  const [dados, setDados] = useState(null), [carregando, setCarregando] = useState(false);
  const [pid, setPid] = useState(null), [detalhe, setDetalhe] = useState(null);
  const pids = useMemo(() => (escopo ? (escopo.pids || Object.keys(PROJECTS)) : []), [escopo, PROJECTS]);

  useEffect(() => {
    if (!escopo) return;
    let vivo = true; setCarregando(true);
    Promise.all(pids.map((p) => carregarProjeto(p, PROJECTS, stored, computeHealth, ctmkData, score360).catch(() => null))).then((xs) => {
      if (!vivo) return; const m = {}; xs.forEach((x) => { if (x) m[x.pid] = x; }); setDados(m); setCarregando(false);
      if (pids.length === 1) setPid(pids[0]);
    });
    return () => { vivo = false; };
  }, [escopo, pids, PROJECTS, stored, computeHealth, ctmkData, score360]);

  const entrar = async () => { setErro(""); const n = await checkPin(pin, { cliente: true }); if (!n) { setErro("PIN inválido para a Área do Cliente."); return; } setPin(""); setEscopo(getClienteScope()); };
  const sair = () => { clearSession(); setEscopo(null); setDados(null); setPid(null); setDetalhe(null); onBack && onBack(); };
  const perfil = !escopo ? "" : escopo.escopo === "MOKED" ? "Visão Moked (gerencial)" : escopo.pids.length > 1 ? "Proprietário · visão macro" : "Gestor do parque";

  if (!escopo) return <main style={C.main}>
    <Cabecalho logo={MOKED_LOGO} badge="Área do Cliente" direita={<button style={C.back} onClick={onBack}>← Início</button>} />
    <div style={{ ...C.card, marginTop: 30, textAlign: "center" }}>
      <div style={C.titulo}>Acesso de leitura</div>
      <div style={{ ...C.micro, marginBottom: 16 }}>Gestor do parque ou proprietário</div>
      <input type="password" inputMode="numeric" aria-label="PIN do cliente" value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => e.key === "Enter" && entrar()} placeholder="PIN" style={{ width: "100%", maxWidth: 240, padding: 12, border: "1px solid #3a3a42", background: "#0a0a0d", color: "#f3f4f6", fontSize: 20, textAlign: "center", letterSpacing: 8, borderRadius: 6 }} />
      {erro && <div role="alert" style={{ color: VERMELHO2, fontSize: 12, marginTop: 8 }}>{erro}</div>}
      <div><button onClick={entrar} style={{ marginTop: 14, background: `linear-gradient(180deg, ${VERMELHO2}, #9f0710)`, color: "#fff", border: "none", padding: "10px 32px", fontWeight: 900, letterSpacing: 2, cursor: "pointer", clipPath: "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)", boxShadow: `0 0 16px ${VERMELHO2}55` }}>ENTRAR</button></div>
    </div>
  </main>;

  return <main style={C.main}>
    <Cabecalho logo={MOKED_LOGO} badge="Área do Cliente" direita={<button style={C.back} onClick={sair} aria-label="Sair">Sair</button>} />
    <div style={{ ...C.micro, marginBottom: 8 }}>{perfil} · somente leitura</div>
    {carregando && <p role="status" style={C.micro}>Lendo os dados dos parques…</p>}
    {!carregando && dados && (
      pid && dados[pid]
        ? (detalhe ? <Detalhe p={dados[pid]} tipo={detalhe} onBack={() => setDetalhe(null)} />
          : <TelaProjeto p={dados[pid]} onBack={pids.length > 1 ? () => setPid(null) : null} onAbrir={setDetalhe} />)
        : <TelaMacro escopo={escopo.escopo} dados={dados} onAbrir={setPid} />
    )}
  </main>;
}

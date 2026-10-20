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
import VerMapasProjeto from "../mapaDiario/VerMapasProjeto";
import { turnoVigente } from "../mapaDiario/painel";
import QuadroEfetivo from "../equipe/QuadroEfetivo";
import MaturidadeResumo from "../equipe/MaturidadeResumo";
import EquipesMontadas, { montarEquipesDisponivel } from "../equipe/EquipesMontadas";
import { EQUIP_CATS } from "../equipData";
import { NIVEL_LABEL } from "../riscoConfig";
import { MOKED_LOGO } from "../generatePDF";
import { C, Mostrador, Anel, Luz, Cabecalho, corDe, VERMELHO2, VERDE, AMARELO, CINZA } from "./Cluster";
const LARANJA = "#f97316";
const B = "#2a2a31"; // borda padrão do app
const COR_RISCO = { 1: VERDE, 2: AMARELO, 3: LARANJA, 4: VERMELHO2, 0: CINZA };
const EQUIP_LABEL = { smartphones: "Smartphones", radiosHT: "Rádios HT", armamento: "Armamento", municao: "Munição", placas: "Placas balísticas", lanternas: "Lanternas", ztrax: "Ztrax", bodycam: "Bodycam", outros: "Outros" };

const db = () => getFirestore(getApps()[0]);
const hojeISO = () => new Date().toLocaleDateString("sv-SE");
const fmtD = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—");
const corSit = (s) => ({ presente: VERDE, atraso: AMARELO, falta: VERMELHO2, ft: "#a855f7", cobertura: "#38bdf8", troca: "#38bdf8", vago: VERMELHO2 }[s] || CINZA);
const corTurnover = (t) => (t === null ? CINZA : t <= 10 ? VERDE : t <= 25 ? AMARELO : VERMELHO2);
const ler = (col, pid) => getDoc(doc(db(), col, pid)).then((s) => (s.exists() ? s.data() : null)).catch(() => null);

// ── Carregamento por projeto: tudo que a gestão vê hoje, em leitura ──────────
async function carregarProjeto(pid, PROJECTS, stored, computeHealth, ctmkData, score360, risco) {
  const hoje = hojeISO();
  const [eq, equip, mapasSnap, fotos, keyaccess, ilum, energia, peri, rondas, s360, risc] = await Promise.all([
    ler("equipes", pid).then((d) => d || {}),
    ler("equipamentos", pid),
    getDocs(query(collection(db(), "equipes", pid, "mapas"), orderBy("data", "desc"), limit(6))).then((s) => s.docs.map((d) => d.data())).catch(() => []),
    carregarFotos(db(), pid).catch(() => ({})),
    ler("keyaccess_falhas", pid), ler("iluminacao", pid), ler("energia_ocorrencias", pid), ler("perimetral", pid),
    PERIMETRAL_VIA_RONDAS.includes(pid) ? ler("rondas", pid) : Promise.resolve(null),
    score360 ? score360(pid).catch(() => null) : Promise.resolve(null),
    risco ? risco(pid).catch(() => null) : Promise.resolve(null),
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
    risco: risc, equipeDoc: eq, equipDoc: equip, fotos,
    historico: h.map((r, i) => ({ idx: i, data: r.meta?.date || null, pct: (() => { try { return computeHealth(PROJECTS[pid], r.state).pct; } catch { return null; } })(), report: r })).reverse().slice(0, 12),
    ferias: (() => { const f = (eq.ferias || []).filter((x) => x && x.colabId && x.dataInicio); const em7 = (d) => { const n = (new Date(d + "T12:00:00Z") - new Date(hoje + "T12:00:00Z")) / 86400000; return n >= 0 && n <= 7; };
      const nomeDe = (id) => { const c = (eq.colaboradores || []).find((x) => x && x.id === id); return c ? { nome: c.nome, cargo: c.cargo, foto: fotoDe(c, fotos) } : { nome: id, cargo: "", foto: "" }; };
      return { emFerias: f.filter((x) => x.dataInicio <= hoje && (!x.dataRetorno || hoje <= x.dataRetorno)).map((x) => ({ ...nomeDe(x.colabId), inicio: x.dataInicio, retorno: x.dataRetorno || null, cobertura: x.cobertura || "" })),
        saindo: f.filter((x) => x.dataInicio > hoje && em7(x.dataInicio)).map((x) => ({ ...nomeDe(x.colabId), inicio: x.dataInicio, retorno: x.dataRetorno || null })),
        voltando: f.filter((x) => x.dataRetorno && x.dataRetorno >= hoje && em7(x.dataRetorno) && x.dataInicio <= hoje).map((x) => ({ ...nomeDe(x.colabId), inicio: x.dataInicio, retorno: x.dataRetorno })) }; })(),
    desligados: (eq.desligados || []).filter((c) => c && typeof c === "object").map((c) => ({ id: c.id, nome: c.nome, cargo: c.cargo, saida: c.desligadoEm || null, motivo: c.motivoDesligamento || c.tipoDesligamento || "", foto: fotoDe(c, fotos) })).sort((a, b) => String(b.saida || "").localeCompare(String(a.saida || ""))),
  };
  p.luzes = luzes(p);
  return p;
}

function Avatar({ foto, nome, tam = 36 }) {
  const ini = (nome || "?").split(/\s+/).slice(0, 2).map((x) => x[0] || "").join("").toUpperCase();
  const borda = { width: tam, height: tam, clipPath: "polygon(20% 0, 100% 0, 100% 80%, 80% 100%, 0 100%, 0 20%)" };
  return foto ? <img src={foto} alt={nome} style={{ ...borda, objectFit: "cover" }} />
    : <div style={{ ...borda, background: "#2a2a31", color: "#64748b", fontSize: tam / 2.8, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{ini}</div>;
}
const Linha = ({ children, primeiro }) => <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "7px 0", borderTop: primeiro ? "none" : "1px solid #2a2a31" }}>{children}</div>;
const Luzes = ({ p }) => <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 4px 4px", borderTop: "1px solid #2a2a31", marginTop: 4 }}>{p.luzes.map((l) => <Luz key={l.id} on={l.on} rotulo={l.rotulo} />)}</div>;

// ── Parque ────────────────────────────────────────────────────────────────────
function MostradorRisco({ risco, tam = 180 }) {
  // 4 zonas: baixo (verde) · moderado (amarelo) · elevado (laranja) · crítico (vermelho); ponteiro no nível.
  const n = risco?.nivel ?? null; const v = n === null || n === 0 ? null : (n - 0.5) * 25;
  return <Mostrador valor={v} max={100} unidade="" rotulo="Análise de risco" tam={tam} cor={COR_RISCO[n] || CINZA} zonaCritica={[75, 100]} sub={n ? (risco.label || NIVEL_LABEL[n]) : "sem avaliação"} valorTexto={n ? (NIVEL_LABEL[n] || "") : "—"} zonas={[[0, 25, VERDE], [25, 50, AMARELO], [50, 75, LARANJA], [75, 100, VERMELHO2]]} />;
}

function TelaProjeto({ p, onBack, onAbrir }) {
  const m = p.mapa, s = p.sistemas;
  const plantao = m.lista.map((x) => ({ ...x, foto: p.colabs.find((k) => k.id === x.pessoaId)?.foto }));
  return <>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
      {onBack ? <button style={C.back} onClick={onBack}>← Meus parques</button> : <span />}
      <div style={{ ...C.titulo, marginBottom: 0 }}>{p.nome}</div>
    </div>
    {/* turnover */}
    <button style={C.cardBtn} onClick={() => onAbrir("turnover")} aria-label="Abrir turnover">
      <Mostrador valor={p.equipe.turnover} max={50} tam={250} rotulo="Turnover 12 m" unidade="%" invertido cor={corTurnover(p.equipe.turnover)} zonas={[[0, 5, VERDE], [5, 12.5, AMARELO], [12.5, 25, LARANJA], [25, 50, VERMELHO2]]} sub={p.equipe.turnover === null ? (p.equipe.turnoverMotivo || "não aferido") : `${p.equipe.ativos} hoje · ${p.equipe.saidas12m} saíram · ${p.equipe.entradas12m} entraram`} />
      <div style={{ textAlign: "right", ...C.micro }}>quantos temos × quantos saíram ›</div>
    </button>
    {/* saúde do parque + análise de risco */}
    <div style={C.grid2}>
      <button style={C.cardBtn} onClick={() => onAbrir("teste")} aria-label="Abrir teste semanal">
        <Mostrador valor={p.teste.pct} rotulo="Saúde do parque" tam={160} cor={p.teste.atrasado && p.teste.pct !== null ? AMARELO : undefined} zonas={[[0, 70, VERMELHO2], [70, 90, AMARELO], [90, 100, VERDE]]} sub={p.teste.data ? `teste ${fmtD(p.teste.data)}${p.teste.atrasado ? " · atrasado" : ""}` : "sem teste"} />
        <div><span style={C.chip(p.teste.inop ? VERMELHO2 : VERDE)}>{p.teste.inop} inop</span><span style={C.chip(p.teste.parcial ? AMARELO : CINZA)}>{p.teste.parcial} parcial</span></div>
      </button>
      <button style={C.cardBtn} onClick={() => onAbrir("risco")} aria-label="Abrir análise de risco">
        <MostradorRisco risco={p.risco} tam={160} />
        <div>{p.risco?.determinante ? <span style={C.chip(COR_RISCO[p.risco.nivel] || CINZA)}>{p.risco.determinante}</span> : <span style={C.micro}>&nbsp;</span>}</div>
      </button>
    </div>
    {/* equipe de plantão */}
    <button style={C.cardBtn} onClick={() => onAbrir("plantao")} aria-label="Abrir equipe de plantão">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div style={C.titulo}>Equipe de plantão</div><span style={C.micro}>{m.temMapa ? `${fmtD(m.data)} · ${m.turno === "N" ? "noturno" : "diurno"}${m.hoje ? "" : " (último)"}` : "sem mapa"}</span></div>
      {m.temMapa ? <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {plantao.map((x, i) => <div key={i} style={{ textAlign: "center", width: 54 }}>
          <div style={{ position: "relative", display: "inline-block" }}><Avatar foto={x.foto} nome={x.nome || x.posto} tam={44} /><span title={ROTULO_SITUACAO[x.situacao] || x.situacao} style={{ position: "absolute", right: -2, bottom: -2, width: 12, height: 12, borderRadius: "50%", background: corSit(x.situacao), border: "2px solid #0b0b0e", boxShadow: `0 0 6px ${corSit(x.situacao)}` }} /></div>
          <div style={{ fontSize: 9, color: "#d1d5db", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{(x.nome || "—").split(" ")[0]}</div>
          <div style={{ fontSize: 8, color: "#6b7280", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.posto}</div>
        </div>)}
      </div> : <div style={C.micro}>Nenhum mapa enviado ainda.</div>}
      <div style={{ marginTop: 4 }}>{m.faltas > 0 && <span style={C.chip(VERMELHO2)}>{m.faltas} falta{m.faltas === 1 ? "" : "s"}</span>}{m.atrasos > 0 && <span style={C.chip(AMARELO)}>{m.atrasos} atraso{m.atrasos === 1 ? "" : "s"}</span>}{m.ft > 0 && <span style={C.chip("#a855f7")}>{m.ft} FT</span>}{m.vagos > 0 && <span style={C.chip(VERMELHO2)}>{m.vagos} vago{m.vagos === 1 ? "" : "s"}</span>}<span style={{ ...C.micro, float: "right" }}>mapa de hoje · equipe completa ›</span></div>
    </button>
    {/* férias */}
    <button style={C.cardBtn} onClick={() => onAbrir("ferias")} aria-label="Abrir férias">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div style={C.titulo}>Férias</div><span style={C.micro}>{p.ferias.emFerias.length} em férias hoje</span></div>
      {p.ferias.emFerias.length === 0 && p.ferias.saindo.length === 0 && p.ferias.voltando.length === 0 && <div style={C.micro}>Ninguém de férias, saindo ou voltando nos próximos 7 dias.</div>}
      {[["Em férias", p.ferias.emFerias, "#38bdf8"], ["Saindo em 7 dias", p.ferias.saindo, AMARELO], ["Voltando em 7 dias", p.ferias.voltando, VERDE]].map(([r, l, c]) => l.length ? <div key={r} style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: c, flexShrink: 0 }} /><div style={{ fontSize: 12 }}><b>{l.length} {r.toLowerCase()}</b><div style={C.micro}>{l.map((x) => `${(x.nome || "").split(" ").slice(0, 2).join(" ")}${r === "Voltando em 7 dias" ? ` (volta ${fmtD(x.retorno)})` : r === "Saindo em 7 dias" ? ` (sai ${fmtD(x.inicio)})` : x.retorno ? ` (até ${fmtD(x.retorno)})` : ""}`).join(" · ")}</div></div>
      </div> : null)}
    </button>
    {/* fotos — evidências de treinamento */}
    <div style={C.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div style={C.titulo}>Fotos · treinamentos</div>{p.equipe.evidencias.length > 3 && <button style={{ ...C.back, padding: "3px 8px", fontSize: 11, color: "#FF1E27", textDecoration: "underline" }} onClick={() => onAbrir("fotos")}>Visualizar todas ›</button>}</div>
      {p.equipe.evidencias.length === 0 && <div style={C.micro}>Sem fotos ainda. O líder anexa a foto ao registrar o treinamento na ficha.</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
        {p.equipe.evidencias.slice(0, 6).map((t, i) => <button key={t.id || i} onClick={() => onAbrir("fotos")} aria-label={`Foto: ${t.detalhe || "treinamento"}`} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", position: "relative" }}>
          <img src={p.fotos[t.fotoRef]} alt="" style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", clipPath: "polygon(12% 0, 100% 0, 100% 88%, 88% 100%, 0 100%, 0 12%)", border: "1px solid #3a3a42", outline: "1px solid #FF1E2744" }} />
          <div style={{ position: "absolute", left: 6, right: 6, bottom: 6, fontSize: 9, fontWeight: 700, color: "#f1f5f9", textShadow: "0 1px 3px #000", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "left" }}>{t.detalhe || "Treinamento"}</div>
        </button>)}
      </div>
    </div>
    {/* relógios menores */}
    <div style={C.card}>
      <div style={C.titulo}>Progressos</div>
      <div style={C.grid2}>
        <button style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", textAlign: "left", padding: 0 }} onClick={() => onAbrir("treino")} aria-label="Abrir treinamentos"><Anel valor={p.equipe.treinadosPct} rotulo="Treinamentos" sub={p.equipe.ultimosTreinos.length ? `último ${fmtD(p.equipe.ultimosTreinos[0].data)}` : "sem registro"} /></button>
        <button style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", textAlign: "left", padding: 0 }} onClick={() => onAbrir("equip")} aria-label="Abrir equipamentos"><Anel valor={p.equip.pct} rotulo="Equip. de plantão" sub={`${p.equip.total} itens · ${p.equip.inop} inop`} /></button>
        <button style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", textAlign: "left", padding: 0, gridColumn: "1 / -1" }} onClick={() => onAbrir("sistemas")} aria-label="Abrir sistemas"><Anel valor={s.score360} rotulo="Sistemas · 360" sub={`CTMK ${s.ctmkOff ? "off-line" : "on-line"} · iluminação ${s.ilumPct === null ? "—" : s.ilumPct + "%"} · energia ${s.quedas7d} queda${s.quedas7d === 1 ? "" : "s"}/7d`} /></button>
      </div>
      <Luzes p={p} />
    </div>
  </>;
}

// ── Detalhes ──────────────────────────────────────────────────────────────────
function Abas({ abas, atual, onMudar }) {
  return <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>{abas.map(([k, r]) => <button key={k} aria-pressed={atual === k} onClick={() => onMudar(k)} style={{ ...C.back, flex: 1, textAlign: "center", borderColor: atual === k ? "#FF1E27" : "#3a3a42", color: atual === k ? "#fecaca" : "#d1d5db", background: atual === k ? "#2a0b0e" : undefined, boxShadow: atual === k ? "0 0 10px #FF1E2755" : "none" }}>{r}</button>)}</div>;
}

function Detalhe({ p, tipo, onBack, abrirPDF }) {
  const s = p.sistemas;
  const [aba, setAba] = useState("mapa"), [sel, setSel] = useState(null), [verSaidas, setVerSaidas] = useState(false);
  const titulo = { teste: "Teste semanal", risco: "Análise de risco", plantao: "Equipe de plantão", turnover: "Turnover", equip: "Equipamentos de plantão", treino: "Treinamentos", sistemas: "Sistemas", ferias: "Férias", fotos: "Fotos · treinamentos" }[tipo];
  const vig = turnoVigente(p.pid, new Date());
  return <>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}><button style={C.back} onClick={onBack}>← {p.nome}</button><div style={{ ...C.titulo, marginBottom: 0 }}>{titulo}</div></div>

    {tipo === "teste" && <div style={C.card}>
      <Mostrador valor={p.teste.pct} rotulo="Saúde do parque" zonas={[[0, 70, VERMELHO2], [70, 90, AMARELO], [90, 100, VERDE]]} sub={p.teste.data ? `teste de ${fmtD(p.teste.data)}` : "sem teste"} />
      <div style={{ ...C.micro, marginBottom: 6 }}>Toque num teste para abrir o relatório (PDF).</div>
      {p.historico.length === 0 && <div style={C.micro}>Nenhum teste registrado.</div>}
      {p.historico.map((r, i) => <button key={r.idx} aria-label={`Abrir teste de ${fmtD(r.data)}`} onClick={() => abrirPDF && abrirPDF(p.pid, r.report)} style={{ width: "100%", background: "transparent", border: "none", color: "inherit", cursor: "pointer", textAlign: "left", padding: 0 }}><Linha primeiro={i === 0}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: corDe(r.pct), boxShadow: `0 0 8px ${corDe(r.pct)}` }} /><div style={{ flex: 1 }}><div style={{ fontSize: 12.5, fontWeight: 700 }}>Teste de {fmtD(r.data)}</div><div style={C.micro}>{r.pct === null ? "—" : `${r.pct}% dos sistemas operantes`}</div></div><span style={C.chip(VERMELHO2)}>PDF ›</span>
      </Linha></button>)}
    </div>}

    {tipo === "risco" && <div style={C.card}>
      <MostradorRisco risco={p.risco} tam={220} />
      {!p.risco && <div style={C.micro}>Análise de risco indisponível para este parque.</div>}
      {p.risco && <>
        <div style={{ fontSize: 12, marginBottom: 6 }}>{p.risco.motivo}</div>
        {p.risco.vetores.map((v, i) => <Linha key={i} primeiro={i === 0}><span style={{ width: 10, height: 10, borderRadius: "50%", background: COR_RISCO[v.nivel] || CINZA, boxShadow: `0 0 8px ${COR_RISCO[v.nivel] || CINZA}` }} /><div style={{ flex: 1, fontSize: 12 }}>{v.label}</div><span style={C.chip(COR_RISCO[v.nivel] || CINZA)}>{NIVEL_LABEL[v.nivel] || ""}</span></Linha>)}
        {p.risco.faltantes.length > 0 && <div style={{ ...C.micro, marginTop: 8 }}>Sem dados de: {p.risco.faltantes.join(", ")}</div>}
      </>}
    </div>}

    {tipo === "plantao" && <>
      <Abas abas={[["mapa", "Mapa de hoje"], ["equipe", "Equipe montada"], ["maturidade", "Maturidade"]]} atual={aba} onMudar={setAba} />
      {aba === "mapa" && <div style={C.card}>{vig ? <VerMapasProjeto projetoId={p.pid} data={vig.data} turno={vig.turno} dark /> : <div style={C.micro}>Sem turno configurado.</div>}</div>}
      {aba === "maturidade" && <div style={C.card}><QuadroEfetivo projectId={p.pid} equipe={p.equipeDoc} hoje={hojeISO()} dark /><div style={{ height: 10 }} /><MaturidadeResumo equipe={p.equipeDoc} hoje={hojeISO()} dark /></div>}
      {aba === "equipe" && montarEquipesDisponivel(p.pid, p.equipeDoc.colaboradores) && <div style={C.card}><EquipesMontadas colaboradores={p.equipeDoc.colaboradores} fotos={p.fotos} dark /></div>}
      {aba === "equipe" && !montarEquipesDisponivel(p.pid, p.equipeDoc.colaboradores) && <div style={C.card}>
        {["Diurno", "Noturno", "Outros"].map((t) => { const lista = p.colabs.filter((c) => (t === "Outros" ? !["Diurno", "Noturno"].includes(c.turno) : c.turno === t)); if (!lista.length) return null; return <div key={t} style={{ marginTop: 12 }}>
          <div style={C.titulo}>{t} <span style={{ color: "#6b7280", letterSpacing: 0 }}>({lista.length})</span></div>
          {lista.map((c, i) => <Linha key={c.id} primeiro={i === 0}><Avatar foto={c.foto} nome={c.nome} tam={42} /><div style={{ flex: 1 }}><div style={{ fontSize: 12.5, fontWeight: 700 }}>{c.nome}</div><div style={C.micro}>{c.cargo}{c.desde ? ` · desde ${fmtD(c.desde)}` : ""}</div></div><span style={C.chip(c.treinos ? VERDE : CINZA)}>{c.treinos} trein.</span></Linha>)}
        </div>; })}
      </div>}
    </>}

    {tipo === "turnover" && <div style={C.card}>
      <Mostrador valor={p.equipe.turnover} max={50} invertido rotulo="Turnover 12 m" cor={corTurnover(p.equipe.turnover)} zonas={[[0, 5, VERDE], [5, 12.5, AMARELO], [12.5, 25, LARANJA], [25, 50, VERMELHO2]]} sub="saídas ÷ efetivo médio · 12 meses" />
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <tbody>
          <tr><td style={{ padding: "6px 0", borderTop: "1px solid #1f2127" }}>Quantos temos hoje</td><td style={{ textAlign: "right", fontWeight: 900, borderTop: "1px solid #1f2127" }}>{p.equipe.ativos}</td></tr>
          {Object.entries(p.equipe.porCargo).map(([c, n]) => <tr key={c}><td style={{ padding: "3px 0 3px 12px", color: "#9ca3af" }}>{c}</td><td style={{ textAlign: "right", color: "#9ca3af" }}>{n}</td></tr>)}
          <tr><td style={{ padding: "6px 0", borderTop: "1px solid #1f2127" }}>Entraram (12 m)</td><td style={{ textAlign: "right", fontWeight: 900, borderTop: "1px solid #1f2127", color: VERDE }}>{p.equipe.entradas12m}</td></tr>
          <tr><td style={{ padding: "6px 0", borderTop: "1px solid #1f2127" }}>Saíram (12 m)</td><td style={{ textAlign: "right", borderTop: "1px solid #1f2127" }}><button aria-label="Ver quem saiu" onClick={() => setVerSaidas((v) => !v)} style={{ ...C.back, color: VERMELHO2, fontWeight: 900 }}>{p.equipe.saidas12m} {verSaidas ? "▴" : "▾ ver quem"}</button></td></tr>
          <tr><td style={{ padding: "6px 0", borderTop: "1px solid #1f2127" }}>Total de desligamentos registrados</td><td style={{ textAlign: "right", borderTop: "1px solid #1f2127", color: "#9ca3af" }}>{p.desligados.length}</td></tr>
        </tbody>
      </table>
      {verSaidas && <div style={{ marginTop: 8 }}>
        {p.desligados.length === 0 && <div style={C.micro}>Nenhum desligamento registrado.</div>}
        {p.desligados.map((c, i) => <Linha key={c.id || i} primeiro={i === 0}><Avatar foto={c.foto} nome={c.nome} tam={38} /><div style={{ flex: 1 }}><div style={{ fontSize: 12.5, fontWeight: 700 }}>{c.nome}</div><div style={C.micro}>{c.cargo}{c.saida ? ` · saiu em ${fmtD(c.saida)}` : ""}{c.motivo ? ` · ${c.motivo}` : ""}</div></div></Linha>)}
      </div>}
    </div>}

    {tipo === "equip" && <div style={C.card}>
      <div style={{ ...C.micro, marginBottom: 6 }}>{p.equip.total} itens · {p.equip.ok} ok · {p.equip.parcial} parciais · {p.equip.inop} inoperantes</div>
      {EQUIP_CATS.map((k) => { const itens = (p.equipDoc?.[k] || []).filter((it) => it && typeof it === "object"); if (!itens.length) return null; return <div key={k} style={{ marginTop: 10 }}>
        <div style={C.titulo}>{EQUIP_LABEL[k] || k} <span style={{ color: "#6b7280", letterSpacing: 0 }}>({itens.length})</span></div>
        {itens.map((it, i) => { const st = it.status === "inop" || it.status === "critico" ? VERMELHO2 : it.status === "parcial" || it.status === "baixo" ? AMARELO : VERDE; return <Linha key={it.id || i} primeiro={i === 0}><span style={{ width: 10, height: 10, borderRadius: "50%", background: st, boxShadow: `0 0 8px ${st}` }} /><div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 700 }}>{it.identificacao || it.nome || it.modelo || "Item"}</div><div style={C.micro}>{[it.modelo, it.nSerie ? `série ${it.nSerie}` : "", it.qtd ? `qtd ${it.qtd}` : ""].filter(Boolean).join(" · ")}</div></div><span style={C.chip(st)}>{it.status || "ok"}</span></Linha>; })}
      </div>; })}
      {p.equipDoc?.moto?.placa && <div style={{ marginTop: 10 }}><div style={C.titulo}>Motocicleta</div><Linha primeiro><div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 700 }}>{p.equipDoc.moto.placa}{p.equipDoc.moto.modelo ? ` · ${p.equipDoc.moto.modelo}` : ""}</div><div style={C.micro}>{p.equipDoc.moto.km ? `${p.equipDoc.moto.km} km` : ""}{p.equipDoc.moto.ultimaManutencao ? ` · últ. manutenção ${fmtD(p.equipDoc.moto.ultimaManutencao)}` : ""}</div></div></Linha></div>}
    </div>}

    {tipo === "treino" && <div style={C.card}>
      <div style={{ ...C.micro, marginBottom: 8 }}>{p.equipe.treinadosPct === null ? "" : `${p.equipe.treinadosPct}% da equipe com treinamento registrado · `}{p.equipe.ultimosTreinos.length ? `último em ${fmtD(p.equipe.ultimosTreinos[0].data)}` : "sem registro"}. Toque num colaborador para ver os treinamentos dele.</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
        {p.colabs.map((c) => <button key={c.id} aria-pressed={sel === c.id} aria-label={`Treinamentos de ${c.nome}`} onClick={() => setSel(sel === c.id ? null : c.id)} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "center", width: 54, opacity: sel && sel !== c.id ? .45 : 1 }}>
          <div style={{ display: "inline-block", outline: sel === c.id ? "2px solid #FF1E27" : "none", outlineOffset: 2 }}><Avatar foto={c.foto} nome={c.nome} tam={44} /></div>
          <div style={{ fontSize: 9, color: "#d1d5db", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{(c.nome || "").split(" ")[0]}</div>
          <div style={{ fontSize: 8, color: c.treinos ? VERDE : "#6b7280" }}>{c.treinos} trein.</div>
        </button>)}
      </div>
      {(() => { const c = p.colabs.find((x) => x.id === sel); if (!c) return null; const ts = (p.equipeDoc.colaboradores || []).find((x) => x.id === sel)?.historico?.filter((h) => h && h.tipo === "Treinamento").sort((a, b) => String(b.data || "").localeCompare(String(a.data || ""))) || [];
        return <div style={{ borderTop: "1px solid #2a2a31", paddingTop: 8 }}><div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6 }}><Avatar foto={c.foto} nome={c.nome} tam={48} /><div><div style={{ fontSize: 13, fontWeight: 800 }}>{c.nome}</div><div style={C.micro}>{c.cargo}{c.desde ? ` · desde ${fmtD(c.desde)}` : ""}</div></div></div>
          {ts.length === 0 && <div style={C.micro}>Sem treinamento registrado.</div>}
          {ts.map((t, i) => <Linha key={t.id || i} primeiro={i === 0}><span style={{ width: 10, height: 10, borderRadius: "50%", background: VERDE, boxShadow: `0 0 8px ${VERDE}` }} /><div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 700 }}>{t.detalhe || t.label || "Treinamento"}</div><div style={C.micro}>{fmtD(t.data)}</div></div></Linha>)}
        </div>; })()}
      {!sel && <div style={{ borderTop: "1px solid #2a2a31", paddingTop: 8 }}><div style={C.titulo}>Últimos treinamentos</div>{p.equipe.ultimosTreinos.slice(0, 5).map((t, i) => <Linha key={i} primeiro={i === 0}><div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 700 }}>{t.detalhe || t.label || "Treinamento"}</div><div style={C.micro}>{fmtD(t.data)} · {t.colabNome}</div></div></Linha>)}</div>}
    </div>}

    {tipo === "fotos" && <div style={C.card}>
      {p.equipe.evidencias.length === 0 && <div style={C.micro}>Sem fotos de treinamento.</div>}
      {p.equipe.evidencias.map((t, i) => <div key={t.id || i} style={{ marginBottom: 12 }}>
        <img src={p.fotos[t.fotoRef]} alt="" style={{ width: "100%", clipPath: "polygon(6% 0, 100% 0, 100% 94%, 94% 100%, 0 100%, 0 6%)", border: "1px solid #3a3a42" }} />
        <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 4 }}>{t.detalhe || t.label || "Treinamento"}</div>
        <div style={C.micro}>{fmtD(t.data)} · {t.colabNome}</div>
      </div>)}
    </div>}
    {tipo === "ferias" && <div style={C.card}>
      {[["Em férias hoje", p.ferias.emFerias, "#38bdf8"], ["Saindo nos próximos 7 dias", p.ferias.saindo, AMARELO], ["Voltando nos próximos 7 dias", p.ferias.voltando, VERDE]].map(([r, l, c]) => <div key={r} style={{ marginBottom: 12 }}>
        <div style={{ ...C.titulo, color: c }}>{r} ({l.length})</div>
        {l.length === 0 && <div style={C.micro}>Ninguém.</div>}
        {l.map((x, i) => <Linha key={i} primeiro={i === 0}><Avatar foto={x.foto} nome={x.nome} tam={38} /><div style={{ flex: 1 }}><div style={{ fontSize: 12.5, fontWeight: 700 }}>{x.nome}</div><div style={C.micro}>{x.cargo}{x.inicio ? ` · sai ${fmtD(x.inicio)}` : ""}{x.retorno ? ` · volta ${fmtD(x.retorno)}` : ""}{x.cobertura ? ` · cobertura: ${x.cobertura}` : ""}</div></div></Linha>)}
      </div>)}
    </div>}
    {tipo === "sistemas" && <div style={C.card}>
      {s.score360 !== null && <Mostrador valor={s.score360} rotulo="Visão 360" sub="nota do parque" zonas={[[0, 70, VERMELHO2], [70, 90, AMARELO], [90, 100, VERDE]]} />}
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

// ── Macro (proprietário): resumo do grupo + um card por parque, no padrão do app ─────────────
function TelaMacro({ escopo, dados, onAbrir }) {
  const g = consolidarGrupo(dados);
  const label = GRUPOS_CLIENTE[escopo]?.label || escopo;
  const parques = Object.values(dados);
  const riscoPior = Math.max(0, ...parques.map((p) => p.risco?.nivel || 0));
  const feriasHoje = parques.reduce((a, p) => a + (p.ferias?.emFerias.length || 0), 0);
  const Luzinha = ({ c, t }) => <span title={t} style={{ width: 10, height: 10, borderRadius: "50%", background: c, boxShadow: `0 0 6px ${c}`, display: "inline-block" }} />;
  return <>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}><div style={{ fontSize: 15, fontWeight: 800, color: "#f1f5f9" }}>{label}</div><span style={C.micro}>{g.projetos} parques · {g.equipeAtivos} colaboradores</span></div>
    <div style={C.grid2}>
      <div style={C.card}><Mostrador valor={g.testePct} rotulo="Saúde dos parques" tam={180} zonas={[[0, 70, VERMELHO2], [70, 90, AMARELO], [90, 100, VERDE]]} sub={g.testesAtrasados ? `${g.testesAtrasados} teste${g.testesAtrasados === 1 ? "" : "s"} atrasado${g.testesAtrasados === 1 ? "" : "s"}` : "testes em dia"} /></div>
      <div style={C.card}><Mostrador valor={g.turnover} max={50} invertido rotulo="Turnover 12 m" tam={180} cor={corTurnover(g.turnover)} zonas={[[0, 5, VERDE], [5, 12.5, AMARELO], [12.5, 25, LARANJA], [25, 50, VERMELHO2]]} sub="média dos parques" /></div>
    </div>
    <div style={C.card}>
      <div style={C.titulo}>Hoje no grupo</div>
      {[[g.faltasHoje ? VERMELHO2 : VERDE, `${g.faltasHoje} falta${g.faltasHoje === 1 ? "" : "s"} nos mapas de hoje`, `${g.mapasHoje} de ${g.projetos} mapas enviados`],
        [riscoPior ? COR_RISCO[riscoPior] : CINZA, `Risco mais alto: ${riscoPior ? NIVEL_LABEL[riscoPior] : "sem avaliação"}`, parques.filter((p) => p.risco?.nivel === riscoPior && riscoPior).map((p) => p.nome).join(" · ")],
        ["#38bdf8", `${feriasHoje} em férias hoje`, parques.filter((p) => p.ferias?.emFerias.length).map((p) => `${p.nome} (${p.ferias.emFerias.length})`).join(" · ") || "ninguém"],
        [g.equipInop ? AMARELO : VERDE, `${g.equipInop} equipamento${g.equipInop === 1 ? "" : "s"} inoperante${g.equipInop === 1 ? "" : "s"}`, `${g.equipPct === null ? "—" : g.equipPct + "%"} operantes no grupo`],
        [parques.some((p) => p.sistemas?.ctmkOff) ? VERMELHO2 : VERDE, `CTMK: ${parques.filter((p) => p.sistemas?.ctmkOff).length} off-line`, parques.filter((p) => p.sistemas?.ctmkOff).map((p) => p.nome).join(" · ") || "todas on-line"],
      ].map(([c, t, d], i) => <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "7px 0", borderTop: i ? "1px solid #2a2a31" : "none" }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: c, flexShrink: 0 }} /><div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 700 }}>{t}</div><div style={C.micro}>{d}</div></div></div>)}
    </div>
    <div style={C.titulo}>Parques — toque para abrir o painel</div>
    {parques.map((p) => <button key={p.pid} style={C.cardBtn} onClick={() => onAbrir(p.pid)} aria-label={`Abrir ${p.nome}`}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: "#f1f5f9" }}>{p.nome}</div>
        <div style={{ display: "flex", gap: 6 }}><Luzinha c={p.teste.atrasado ? AMARELO : corDe(p.teste.pct)} t="Teste semanal" /><Luzinha c={COR_RISCO[p.risco?.nivel] || CINZA} t="Risco" /><Luzinha c={!p.mapa.hoje ? CINZA : p.mapa.faltas || p.mapa.vagos ? VERMELHO2 : VERDE} t="Mapa do dia" /><Luzinha c={corDe(p.equip.pct)} t="Equipamentos" /><Luzinha c={p.sistemas.ctmkOff ? VERMELHO2 : VERDE} t="CTMK" /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
        {[["Saúde", p.teste.pct === null ? "—" : `${p.teste.pct}%`, p.teste.atrasado ? AMARELO : corDe(p.teste.pct)], ["Risco", p.risco?.nivel ? NIVEL_LABEL[p.risco.nivel] : "—", COR_RISCO[p.risco?.nivel] || CINZA], ["Plantão", p.mapa.temMapa ? `${p.mapa.presentes}/${p.mapa.postos}` : "—", p.mapa.faltas || p.mapa.vagos ? VERMELHO2 : VERDE], ["Turnover", p.equipe.turnover === null ? "—" : `${p.equipe.turnover}%`, corTurnover(p.equipe.turnover)]].map(([r, v, c]) => <div key={r} style={{ background: "#15151a", borderRadius: 8, padding: "6px 4px", textAlign: "center" }}><div style={{ fontSize: 13, fontWeight: 900, color: c }}>{v}</div><div style={{ fontSize: 9, color: "#64748b", textTransform: "uppercase", letterSpacing: .5 }}>{r}</div></div>)}
      </div>
      <div style={{ ...C.micro, marginTop: 6 }}>{p.equipe.ativos} colaboradores · teste {p.teste.data ? fmtD(p.teste.data) : "—"}{p.ferias?.emFerias.length ? ` · ${p.ferias.emFerias.length} em férias` : ""}{p.mapa.faltas ? ` · ${p.mapa.faltas} falta${p.mapa.faltas === 1 ? "" : "s"} hoje` : ""}</div>
    </button>)}
  </>;
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function PainelCliente({ PROJECTS, stored, computeHealth, ctmkData, score360, risco, abrirPDF, onBack }) {
  const [escopo, setEscopo] = useState(() => getClienteScope());
  const [pin, setPin] = useState(""), [erro, setErro] = useState("");
  const [dados, setDados] = useState(null), [carregando, setCarregando] = useState(false);
  const [pid, setPid] = useState(null), [detalhe, setDetalhe] = useState(null);
  const pids = useMemo(() => (escopo ? (escopo.pids || Object.keys(PROJECTS)) : []), [escopo, PROJECTS]);

  useEffect(() => {
    if (!escopo) return;
    let vivo = true; setCarregando(true);
    Promise.all(pids.map((p) => carregarProjeto(p, PROJECTS, stored, computeHealth, ctmkData, score360, risco).catch(() => null))).then((xs) => {
      if (!vivo) return; const m = {}; xs.forEach((x) => { if (x) m[x.pid] = x; }); setDados(m); setCarregando(false);
      if (pids.length === 1) setPid(pids[0]);
    });
    return () => { vivo = false; };
  }, [escopo, pids, PROJECTS, stored, computeHealth, ctmkData, score360, risco]);

  const entrar = async () => { setErro(""); const n = await checkPin(pin, { cliente: true }); if (!n) { setErro("PIN inválido para a Área do Cliente."); return; } setPin(""); setEscopo(getClienteScope()); };
  const sair = () => { clearSession(); setEscopo(null); setDados(null); setPid(null); setDetalhe(null); onBack && onBack(); };
  const perfil = !escopo ? "" : escopo.escopo === "MOKED" ? "Visão Moked (gerencial)" : escopo.pids.length > 1 ? "Proprietário · visão macro" : "Gestor do parque";

  if (!escopo) return <main style={C.main}>
    <Cabecalho logo={MOKED_LOGO} badge="Área do Cliente" direita={<button style={C.back} onClick={onBack}>← Início</button>} />
    <div style={{ ...C.card, marginTop: 30, textAlign: "center" }}>
      <div style={C.titulo}>Acesso de leitura</div>
      <div style={{ ...C.micro, marginBottom: 16 }}>Gestor do parque ou proprietário</div>
      <input type="password" inputMode="numeric" aria-label="PIN do cliente" value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => e.key === "Enter" && entrar()} placeholder="PIN" style={{ width: "100%", maxWidth: 240, padding: 12, border: "1px solid #3a3a42", background: "#08080a", color: "#f1f5f9", fontSize: 20, textAlign: "center", letterSpacing: 8, borderRadius: 6 }} />
      {erro && <div role="alert" style={{ color: VERMELHO2, fontSize: 12, marginTop: 8 }}>{erro}</div>}
      <div><button onClick={entrar} style={{ marginTop: 14, background: "linear-gradient(180deg, #FF1E27, #9f0710)", color: "#fff", border: "none", padding: "11px 32px", fontWeight: 900, letterSpacing: 2, cursor: "pointer", clipPath: "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)", boxShadow: "0 0 16px #FF1E2755" }}>ENTRAR</button></div>
    </div>
  </main>;

  return <main style={C.main}>
    <Cabecalho logo={MOKED_LOGO} badge="Área do Cliente" direita={<button style={C.back} onClick={sair} aria-label="Sair">Sair</button>} />
    <div style={{ ...C.micro, marginBottom: 8 }}>{perfil} · somente leitura</div>
    {carregando && <p role="status" style={C.micro}>Lendo os dados dos parques…</p>}
    {!carregando && dados && (
      pid && dados[pid]
        ? (detalhe ? <Detalhe key={detalhe} p={dados[pid]} tipo={detalhe} onBack={() => setDetalhe(null)} abrirPDF={abrirPDF} />
          : <TelaProjeto p={dados[pid]} onBack={pids.length > 1 ? () => setPid(null) : null} onAbrir={setDetalhe} />)
        : <TelaMacro escopo={escopo.escopo} dados={dados} onAbrir={setPid} />
    )}
  </main>;
}

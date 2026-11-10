// Área do Cliente — cluster automotivo Moked, só leitura. Proprietário (PIN de grupo) vê o macro e entra em
// cada parque; gestor do parque (PIN de projeto) vê só o seu. Gerencial vê tudo. Nada aqui grava.
import { useEffect, useMemo, useRef, useState } from "react";
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
import { C, Mostrador, corDe, VERMELHO2, VERDE, AMARELO, CINZA } from "./Cluster";
import EntornoLista, { filtrar as filtrarEntorno } from "../entorno/EntornoLista";
import { LOCAIS as LOCAIS_ENTORNO, recebeGeral, TIPOS_GRAVES } from "../entorno/locais";
import { lerEntorno } from "../entorno/lerEntorno";
import Localizacao from "./Localizacao";
import { mesclar as mesclarEntorno, resumir as resumirEntorno } from "../entorno/core";
import { calcularMapaEquipe } from "../equipe/maturidade";
import { baseSIS, calcularSIS, lerFavoritos, gravarFavoritos } from "./sis";
import { CSS_SIS, Barra, Home, TelaSis, TelaPilar, TelaItem, TelaFavs, TelaMenu, TelaAvisos, TelaComunicar, Macro } from "./AreaSIS";
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
  const [eq, equip, mapasSnap, fotos, keyaccess, ilum, energia, peri, rondas, s360, risc, entornoResp, fuDoc] = await Promise.all([
    ler("equipes", pid).then((d) => d || {}),
    ler("equipamentos", pid),
    getDocs(query(collection(db(), "equipes", pid, "mapas"), orderBy("data", "desc"), limit(20))).then((s) => s.docs.map((d) => d.data())).catch(() => []),
    carregarFotos(db(), pid).catch(() => ({})),
    ler("keyaccess_falhas", pid), ler("iluminacao", pid), ler("energia_ocorrencias", pid), ler("perimetral", pid),
    PERIMETRAL_VIA_RONDAS.includes(pid) ? ler("rondas", pid) : Promise.resolve(null),
    score360 ? score360(pid).catch(() => null) : Promise.resolve(null),
    risco ? risco(pid).catch(() => null) : Promise.resolve(null),
    lerEntorno(pid).catch(() => ({ docs: {}, geral: null })), // Entorno (03/11/2026): lido pelo servidor com a sessão do cliente
    ler("followups", pid), // SIS+ (10/11/2026): tratativas das pendências
  ]);
  const entorno = entornoResp?.docs?.[pid] || null, entornoGeral = recebeGeral(pid) ? entornoResp?.geral || null : null;
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
    entorno: (() => { const prop = entorno && Array.isArray(entorno.itens) ? entorno.itens : []; const ger = entornoGeral && Array.isArray(entornoGeral.itens) ? entornoGeral.itens.map((i) => ({ ...i, geral: true })) : [];
      if (!prop.length && !ger.length && !entorno) return null; const itens = mesclarEntorno(prop, ger); return { ...(entorno || {}), itens, resumo: resumirEntorno(itens) }; })(),
    historico: h.map((r, i) => ({ idx: i, data: r.meta?.date || null, pct: (() => { try { return computeHealth(PROJECTS[pid], r.state).pct; } catch { return null; } })(), report: r })).reverse().slice(0, 12),
    ferias: (() => { const f = (eq.ferias || []).filter((x) => x && x.colabId && x.dataInicio); const em7 = (d) => { const n = (new Date(d + "T12:00:00Z") - new Date(hoje + "T12:00:00Z")) / 86400000; return n >= 0 && n <= 7; };
      const nomeDe = (id) => { const c = (eq.colaboradores || []).find((x) => x && x.id === id); return c ? { nome: c.nome, cargo: c.cargo, foto: fotoDe(c, fotos) } : { nome: id, cargo: "", foto: "" }; };
      return { emFerias: f.filter((x) => x.dataInicio <= hoje && (!x.dataRetorno || hoje <= x.dataRetorno)).map((x) => ({ ...nomeDe(x.colabId), inicio: x.dataInicio, retorno: x.dataRetorno || null, cobertura: x.cobertura || "" })),
        saindo: f.filter((x) => x.dataInicio > hoje && em7(x.dataInicio)).map((x) => ({ ...nomeDe(x.colabId), inicio: x.dataInicio, retorno: x.dataRetorno || null })),
        voltando: f.filter((x) => x.dataRetorno && x.dataRetorno >= hoje && em7(x.dataRetorno) && x.dataInicio <= hoje).map((x) => ({ ...nomeDe(x.colabId), inicio: x.dataInicio, retorno: x.dataRetorno })) }; })(),
    desligados: (eq.desligados || []).filter((c) => c && typeof c === "object").map((c) => ({ id: c.id, nome: c.nome, cargo: c.cargo, saida: c.desligadoEm || null, motivo: c.motivoDesligamento || c.tipoDesligamento || "", foto: fotoDe(c, fotos) })).sort((a, b) => String(b.saida || "").localeCompare(String(a.saida || ""))),
  };
  p.luzes = luzes(p);
  // Informativos da home (padrão SIS+): até 3 notícias dos últimos 30 dias, as mais próximas do parque primeiro
  p.informativos = p.entorno ? filtrarEntorno(p.entorno.itens, { dias: 30, ordem: "proximidade" }).slice(0, 3).map((i) => ({ id: i.id, titulo: i.titulo, link: (i.links && i.links[0]?.link) || i.link || "", fonte: (i.links && i.links[0]?.fonte) || i.fonte || "", dataCurta: i.data ? new Date(i.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }) : "", km: typeof i.km === "number" ? i.km : null, tema: i.tema, grave: TIPOS_GRAVES.includes(i.tipo) })) : [];
  // SIS+ (10/11/2026): base pura para a nota (categorias do teste, distância, maturidade, tratativas, mapas)
  let maturidade = null; try { maturidade = calcularMapaEquipe(eq, hoje); } catch { maturidade = null; }
  const followups = Object.fromEntries((Array.isArray(fuDoc?.registros) ? fuDoc.registros : []).filter((r) => r && r.key).map((r) => [r.key, r]));
  try { p.sisBase = baseSIS({ project: PROJECTS[pid], state: last?.state, equipeDoc: eq, mapas: mapasSnap, followups, maturidade, hojeISO: hoje }); } catch { p.sisBase = null; }
  return p;
}

function Avatar({ foto, nome, tam = 36 }) {
  const ini = (nome || "?").split(/\s+/).slice(0, 2).map((x) => x[0] || "").join("").toUpperCase();
  const borda = { width: tam, height: tam, clipPath: "polygon(20% 0, 100% 0, 100% 80%, 80% 100%, 0 100%, 0 20%)" };
  return foto ? <img src={foto} alt={nome} style={{ ...borda, objectFit: "cover" }} />
    : <div style={{ ...borda, background: "#2a2a31", color: "#64748b", fontSize: tam / 2.8, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{ini}</div>;
}
const Linha = ({ children, primeiro }) => <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "7px 0", borderTop: primeiro ? "none" : "1px solid #2a2a31" }}>{children}</div>;

// ── Parque ────────────────────────────────────────────────────────────────────
function MostradorRisco({ risco, tam = 180 }) {
  // 4 zonas: baixo (verde) · moderado (amarelo) · elevado (laranja) · crítico (vermelho); ponteiro no nível.
  const n = risco?.nivel ?? null; const v = n === null || n === 0 ? null : (n - 0.5) * 25;
  return <Mostrador valor={v} max={100} unidade="" rotulo="Análise de risco" tam={tam} cor={COR_RISCO[n] || CINZA} zonaCritica={[75, 100]} sub={n ? (risco.label || NIVEL_LABEL[n]) : "sem avaliação"} valorTexto={n ? (NIVEL_LABEL[n] || "") : "—"} zonas={[[0, 25, VERDE], [25, 50, AMARELO], [50, 75, LARANJA], [75, 100, VERMELHO2]]} />;
}

// ── Detalhes ──────────────────────────────────────────────────────────────────
function Abas({ abas, atual, onMudar }) {
  return <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>{abas.map(([k, r]) => <button key={k} aria-pressed={atual === k} onClick={() => onMudar(k)} style={{ ...C.back, flex: 1, textAlign: "center", borderColor: atual === k ? "#FF1E27" : "#3a3a42", color: atual === k ? "#fecaca" : "#d1d5db", background: atual === k ? "#2a0b0e" : undefined, boxShadow: atual === k ? "0 0 10px #FF1E2755" : "none" }}>{r}</button>)}</div>;
}

function Detalhe({ p, tipo, onBack, abrirPDF }) {
  const s = p.sistemas;
  const [aba, setAba] = useState("mapa"), [sel, setSel] = useState(null), [verSaidas, setVerSaidas] = useState(false), [verEntradas, setVerEntradas] = useState(false), [aberto, setAberto] = useState({}), [maisTestes, setMaisTestes] = useState(false);
  const alternar = (k) => setAberto((a) => ({ ...a, [k]: !a[k] }));
  const Seta = ({ on }) => <span style={{ color: "#9ca3af", fontSize: 11 }}>{on ? "▴" : "▾"}</span>;
  const titulo = { teste: "Teste semanal", risco: "Análise de risco", plantao: "Equipe de plantão", turnover: "Turnover", equip: "Equipamentos de plantão", treino: "Treinamentos", sistemas: "Sistemas", ferias: "Férias", fotos: "Fotos · treinamentos", entorno: "Entorno" }[tipo];
  const vig = turnoVigente(p.pid, new Date());
  return <>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}><button style={C.back} onClick={onBack}>← {p.nome}</button><div style={{ ...C.titulo, marginBottom: 0 }}>{titulo}</div></div>

    {tipo === "teste" && <div style={C.card}>
      <Mostrador valor={p.teste.pct} rotulo="Saúde do parque" zonas={[[0, 70, VERMELHO2], [70, 90, AMARELO], [90, 100, VERDE]]} sub={p.teste.data ? `último teste · ${fmtD(p.teste.data)}` : "sem teste"} />
      {p.historico[0] && <button aria-label={`Abrir teste de ${fmtD(p.historico[0].data)}`} onClick={() => abrirPDF && abrirPDF(p.pid, p.historico[0].report)} style={{ width: "100%", background: "linear-gradient(180deg, #FF1E27, #9f0710)", color: "#fff", border: "none", padding: "10px 12px", fontWeight: 900, letterSpacing: 1, cursor: "pointer", clipPath: "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)", marginBottom: 10 }}>ABRIR RELATÓRIO DO ÚLTIMO TESTE (PDF)</button>}
      {p.teste.gravacao && <div style={{ ...C.micro, marginBottom: 8, borderLeft: `3px solid ${p.teste.gravacao.cor}`, paddingLeft: 8 }}><b style={{ color: p.teste.gravacao.cor }}>Gravação CFTV:</b> {p.teste.gravacao.pct === null ? "não informado no último teste" : p.teste.gravacao.pct === 0 ? `todas as ${p.teste.gravacao.total} câmeras com 30 dias ou mais` : `até ${p.teste.gravacao.pct}% das câmeras (até ≈ ${p.teste.gravacao.cameras} de ${p.teste.gravacao.total}) com menos de 30 dias`}{p.teste.gravacao.obs ? ` — ${p.teste.gravacao.obs}` : ""}</div>}
      <div style={C.titulo}>O que está puxando a nota para baixo</div>
      {p.pendencias.length === 0 && <div style={C.micro}>Nada: todos os sistemas operantes no último teste.</div>}
      {p.pendencias.slice(0, aberto.pend ? 100 : 5).map((x, i) => <Linha key={i} primeiro={i === 0}><span style={{ width: 10, height: 10, borderRadius: "50%", background: x.status === "inop" ? VERMELHO2 : AMARELO, boxShadow: `0 0 8px ${x.status === "inop" ? VERMELHO2 : AMARELO}` }} /><div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 700 }}>{x.cat}{x.item ? ` — ${x.item}` : ""}</div><div style={C.micro}>{x.status === "inop" ? "Inoperante" : "Parcial"}{x.since ? ` · desde ${fmtD(x.since)}` : ""}{x.note ? ` · ${x.note}` : ""}</div></div></Linha>)}
      {p.pendencias.length > 5 && <button style={{ ...C.back, marginTop: 6 }} onClick={() => alternar("pend")}>{aberto.pend ? "▴ Mostrar só os 5 primeiros" : `▾ Ver mais ${p.pendencias.length - 5}`}</button>}
      <div style={{ ...C.titulo, marginTop: 14 }}>Testes anteriores</div>
      {p.historico.length <= 1 && <div style={C.micro}>Nenhum teste anterior.</div>}
      {p.historico.slice(1, maisTestes ? 100 : 4).map((r, i) => <button key={r.idx} aria-label={`Abrir teste de ${fmtD(r.data)}`} onClick={() => abrirPDF && abrirPDF(p.pid, r.report)} style={{ width: "100%", background: "transparent", border: "none", color: "inherit", cursor: "pointer", textAlign: "left", padding: 0 }}><Linha primeiro={i === 0}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: corDe(r.pct), boxShadow: `0 0 8px ${corDe(r.pct)}` }} /><div style={{ flex: 1 }}><div style={{ fontSize: 12.5, fontWeight: 700 }}>Teste de {fmtD(r.data)}</div><div style={C.micro}>{r.pct === null ? "—" : `${r.pct}% dos sistemas operantes`}</div></div><span style={C.chip(VERMELHO2)}>PDF ›</span>
      </Linha></button>)}
      {p.historico.length > 4 && <button style={{ ...C.back, marginTop: 6 }} onClick={() => setMaisTestes((v) => !v)}>{maisTestes ? "▴ Mostrar só os 3 últimos" : `▾ Ver mais ${p.historico.length - 4} testes`}</button>}
    </div>}

    {tipo === "risco" && <div style={C.card}>
      <MostradorRisco risco={p.risco} tam={220} />
      {!p.risco && <div style={C.micro}>Análise de risco indisponível para este parque.</div>}
      {p.risco && <>
        <div style={{ fontSize: 12, marginBottom: 6 }}>{p.risco.motivo}</div>
        <div style={{ ...C.micro, marginBottom: 4 }}>Toque num item para ver o detalhe.</div>
        {p.risco.vetores.map((v, i) => <div key={i}>
          <button aria-label={`Detalhe: ${v.label}`} onClick={() => alternar("v" + i)} style={{ width: "100%", background: "transparent", border: "none", color: "inherit", cursor: "pointer", textAlign: "left", padding: 0 }}><Linha primeiro={i === 0}><span style={{ width: 10, height: 10, borderRadius: "50%", background: COR_RISCO[v.nivel] || CINZA, boxShadow: `0 0 8px ${COR_RISCO[v.nivel] || CINZA}` }} /><div style={{ flex: 1, fontSize: 12, fontWeight: 700 }}>{v.label}</div><span style={C.chip(COR_RISCO[v.nivel] || CINZA)}>{NIVEL_LABEL[v.nivel] || ""}</span><Seta on={aberto["v" + i]} /></Linha></button>
          {aberto["v" + i] && <div style={{ margin: "0 0 8px 20px", padding: "8px 10px", background: "#15151a", borderLeft: `2px solid ${COR_RISCO[v.nivel] || CINZA}`, fontSize: 11.5, color: "#d1d5db" }}>
            {(v.inop !== null && v.inop !== undefined) && <div><b>{v.inop}</b>{v.total ? ` de ${v.total}` : ""} inoperante{v.inop === 1 ? "" : "s"}{v.piorDias !== null && v.piorDias !== undefined ? ` · há ${v.piorDias} dia${v.piorDias === 1 ? "" : "s"}` : ""}</div>}
            {v.detalhe && <div style={{ marginTop: 3, color: "#9ca3af" }}>{v.detalhe}</div>}
            {v.note && <div style={{ marginTop: 3, color: "#9ca3af" }}>Obs.: {v.note}</div>}
            {!v.detalhe && (v.inop === null || v.inop === undefined) && <div style={{ color: "#9ca3af" }}>Sem detalhe adicional registrado.</div>}
          </div>}
        </div>)}
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
      <Mostrador valor={p.equipe.turnover} max={50} invertido rotulo="Turnover 12 m" cor={corTurnover(p.equipe.turnover)} zonas={[[0, 5, VERDE], [5, 12.5, AMARELO], [12.5, 25, LARANJA], [25, 50, VERMELHO2]]} sub="saídas ÷ efetivo médio · últimos 12 meses" />
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <tbody>
          <tr><td style={{ padding: "6px 0", borderTop: "1px solid #2a2a31" }}>Quantos temos hoje</td><td style={{ textAlign: "right", fontWeight: 900, borderTop: "1px solid #2a2a31" }}>{p.equipe.ativos}</td></tr>
          {Object.entries(p.equipe.porCargo).map(([c, n]) => <tr key={c}><td style={{ padding: "3px 0 3px 12px", color: "#9ca3af" }}>{c}</td><td style={{ textAlign: "right", color: "#9ca3af" }}>{n}</td></tr>)}
          <tr><td style={{ padding: "6px 0", borderTop: "1px solid #2a2a31" }}>Entraram nos últimos 12 meses</td><td style={{ textAlign: "right", borderTop: "1px solid #2a2a31" }}><button aria-label="Ver quem entrou" onClick={() => setVerEntradas((v) => !v)} style={{ ...C.back, color: VERDE, fontWeight: 900 }}>{p.equipe.entradas12m} {verEntradas ? "▴" : "▾ ver quem"}</button></td></tr>
          {verEntradas && <tr><td colSpan={2} style={{ padding: "4px 0 8px 12px", color: "#9ca3af", fontSize: 11.5 }}>{p.equipe.entradas12mLista.length ? p.equipe.entradas12mLista.map((c) => `${c.nome} (${c.cargo || "—"}, desde ${fmtD(c.desde)})`).join(" · ") : "Ninguém admitido no período."}</td></tr>}
          <tr><td style={{ padding: "6px 0", borderTop: "1px solid #2a2a31" }}>Saíram nos últimos 12 meses</td><td style={{ textAlign: "right", borderTop: "1px solid #2a2a31" }}><button aria-label="Ver quem saiu" onClick={() => setVerSaidas((v) => !v)} style={{ ...C.back, color: VERMELHO2, fontWeight: 900 }}>{p.equipe.saidas12m} {verSaidas ? "▴" : "▾ ver quem"}</button></td></tr>
          <tr><td style={{ padding: "6px 0", borderTop: "1px solid #2a2a31" }}>Total de desligamentos registrados</td><td style={{ textAlign: "right", borderTop: "1px solid #2a2a31", color: "#9ca3af" }}>{p.desligados.length}</td></tr>
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
      <div style={{ ...C.micro, marginBottom: 8 }}>{p.equipe.treinoIndicePct !== null ? `Obrigatórios concluídos: ${p.equipe.treinoIndicePct}% · ` : ""}{p.equipe.treinadosPct === null ? "" : `${p.equipe.treinadosPct}% da equipe com treinamento aplicado · `}{p.equipe.ultimosTreinos.length ? `último em ${fmtD(p.equipe.ultimosTreinos[0].data)}` : "sem registro"}{p.equipe.naoAplicados ? ` · ${p.equipe.naoAplicados} registro${p.equipe.naoAplicados === 1 ? "" : "s"} "não aplicado" (não contam)` : ""}. Toque num colaborador para ver os treinamentos dele.</div>
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
          {ts.map((t, i) => { const na = /n[ãa]o\s+(aplicad|realizad|conclu)/i.test(`${t.detalhe || ""} ${t.label || ""}`); return <Linha key={t.id || i} primeiro={i === 0}><span style={{ width: 10, height: 10, borderRadius: "50%", background: na ? VERMELHO2 : VERDE, boxShadow: `0 0 8px ${na ? VERMELHO2 : VERDE}` }} /><div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 700 }}>{t.detalhe || t.label || "Treinamento"}</div><div style={C.micro}>{fmtD(t.data)}{na ? " · NÃO APLICADO — não conta como treinado" : ""}</div></div></Linha>; })}
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
    {tipo === "entorno" && <div style={C.card}>
      <div style={C.micro}>{LOCAIS_ENTORNO[p.pid]?.cidade}/{LOCAIS_ENTORNO[p.pid]?.uf} · entorno: {(LOCAIS_ENTORNO[p.pid]?.vizinhas || []).join(", ") || "—"}{p.entorno?.atualizadoEm ? ` · coleta ${new Date(p.entorno.atualizadoEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : ""}</div>
      {!p.entorno && <div style={{ ...C.micro, marginTop: 8 }}>Sem notícias coletadas ainda para este parque.</div>}
      {p.entorno && <div style={{ marginTop: 8 }}><EntornoLista itens={p.entorno.itens} /></div>}
    </div>}
    {tipo === "sistemas" && <div style={C.card}>
      {s.score360 !== null && <Mostrador valor={s.score360} rotulo="Visão 360" sub="nota do parque" zonas={[[0, 70, VERMELHO2], [70, 90, AMARELO], [90, 100, VERDE]]} />}
      <div style={{ ...C.micro, marginBottom: 4 }}>Toque numa linha para ver o detalhe.</div>
      {[["ctmk", "CTMK (central)", s.ctmkOff ? `OFF-LINE há ${s.ctmkDias} dia${s.ctmkDias === 1 ? "" : "s"}` : s.ctmkOnlineDias !== null ? `on-line há ${s.ctmkOnlineDias} dia${s.ctmkOnlineDias === 1 ? "" : "s"}` : "on-line", s.ctmkOff ? VERMELHO2 : VERDE,
          s.ctmkOff ? `Sem comunicação com a central desde ${s.ctmkDias} dia${s.ctmkDias === 1 ? "" : "s"}.` : s.ctmkOnlineDesde ? `Restabelecida em ${fmtD(String(s.ctmkOnlineDesde).slice(0, 10))}.` : "Sem registro de queda."],
        ["key", "KeyAccess", s.keyAbertas ? `${s.keyAbertas} falha${s.keyAbertas === 1 ? "" : "s"} em aberto` : "sem falhas abertas", s.keyAbertas ? VERMELHO2 : VERDE,
          s.keyFalhas.length ? s.keyFalhas.map((f) => `${f.data ? fmtD(f.data) : ""}${f.hora ? ` ${f.hora}` : ""}${f.local ? ` · ${f.local}` : ""}`).join("\n") : "Nenhuma falha em aberto."],
        ["ilum", "Iluminação", s.ilumTotal ? `${s.ilumDef} deficientes de ${s.ilumTotal} (${s.ilumPct}% ok)` : "sem dados", s.ilumTotal ? corDe(s.ilumPct) : CINZA,
          s.quadrantes.length ? s.quadrantes.map((q) => `${q.nome || "Quadrante"}: ${q.total - q.deficientes}/${q.total} ok${q.deficientes ? ` · ${q.deficientes} deficiente${q.deficientes === 1 ? "" : "s"}` : ""}`).join("\n") : "Sem registro de iluminação."],
        ["energia", "Energia", `${s.quedas7d} queda${s.quedas7d === 1 ? "" : "s"} em 7 dias${s.energiaAberta ? " · ocorrência em aberto" : ""}`, s.energiaAberta ? VERMELHO2 : s.quedas7d ? AMARELO : VERDE,
          s.eventosEnergia.length ? s.eventosEnergia.map((e) => `${fmtD(String(e.inicio).slice(0, 10))} ${String(e.inicio).slice(11, 16)}${e.fim ? ` → ${String(e.fim).slice(11, 16)}` : ""} · ${e.concluido ? "concluída" : "EM ABERTO"}${e.obs ? ` · ${e.obs}` : ""}`).join("\n") : "Sem ocorrências registradas."],
        ["peri", "Perimetral", s.perimetralZonasRuins ? `${s.perimetralZonasRuins} zona${s.perimetralZonasRuins === 1 ? "" : "s"} com problema` : "zonas ok", s.perimetralZonasRuins ? VERMELHO2 : VERDE, "Zonas do teste perimetral com falha no último teste. O detalhe por zona está no relatório perimetral."],
      ].map(([k, r, v, c, det], i) => <div key={k}>
        <button aria-label={`Detalhe: ${r}`} onClick={() => alternar(k)} style={{ width: "100%", background: "transparent", border: "none", color: "inherit", cursor: "pointer", textAlign: "left", padding: 0 }}><Linha primeiro={i === 0}><span style={{ width: 10, height: 10, borderRadius: "50%", background: c, boxShadow: `0 0 8px ${c}` }} /><div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 700 }}>{r}</div><div style={C.micro}>{v}</div></div><Seta on={aberto[k]} /></Linha></button>
        {aberto[k] && <div style={{ margin: "0 0 8px 20px", padding: "8px 10px", background: "#15151a", borderLeft: `2px solid ${c}`, fontSize: 11.5, color: "#d1d5db", whiteSpace: "pre-line" }}>{det}</div>}
      </div>)}
      {s.vulnerabilidades.length > 0 && <div style={{ ...C.micro, marginTop: 8 }}>Vulnerabilidades: {s.vulnerabilidades.join(" · ")}</div>}
    </div>}
  </>;
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function PainelCliente({ PROJECTS, stored, computeHealth, ctmkData, score360, risco, abrirPDF, onBack }) {
  const [escopo, setEscopo] = useState(() => getClienteScope());
  const [pin, setPin] = useState(""), [erro, setErro] = useState("");
  const [dados, setDados] = useState(null), [carregando, setCarregando] = useState(false);
  const [pid, setPidBruto] = useState(null), [pilha, setPilha] = useState([]); // pilha de telas de detalhe (SIS+ → pilar → indicador → dados)
  const detalhe = pilha.length ? pilha[pilha.length - 1] : null;
  const abrirDetalhe = (t) => setPilha((s) => [...s, t]), voltarDetalhe = () => setPilha((s) => s.slice(0, -1));
  const setPid = (x) => { setPidBruto(x); setPilha([]); };
  // SIS+ (10/11/2026): gerencial vê a régua Moked (mais rígida) e pode ver como o cliente vê; cliente só vê a dele.
  const gerencial = escopo?.escopo === "MOKED";
  const [reguaId, setReguaId] = useState(() => (getClienteScope()?.escopo === "MOKED" ? "moked" : "cliente"));
  useEffect(() => { setReguaId(gerencial ? "moked" : "cliente"); }, [gerencial]);
  const [favs, setFavs] = useState(() => lerFavoritos(getClienteScope()?.escopo));
  useEffect(() => { if (escopo) setFavs(lerFavoritos(escopo.escopo)); }, [escopo]);
  const alternarFav = (id) => setFavs((f) => { const n = f.includes(id) ? f.filter((x) => x !== id) : [...f, id]; gravarFavoritos(escopo?.escopo, n); return n; });
  const sisAtual = useMemo(() => (pid && dados?.[pid] ? calcularSIS(dados[pid], gerencial ? reguaId : "cliente") : null), [pid, dados, reguaId, gerencial]);
  const sisOutra = useMemo(() => (gerencial && pid && dados?.[pid] ? calcularSIS(dados[pid], reguaId === "moked" ? "cliente" : "moked") : null), [pid, dados, reguaId, gerencial]);
  const [falhas, setFalhas] = useState({}), [atualizadoEm, setAtualizadoEm] = useState(null), [versao, setVersao] = useState(0);
  const pids = useMemo(() => (escopo ? (escopo.pids || Object.keys(PROJECTS)) : []), [escopo, PROJECTS]);
  // Carga estável (28/10/2026): as funções e dados vindos do App mudam a cada render dele; antes isso reiniciava a
  // leitura a cada atualização e cancelava a leitura em andamento (painel em branco/zerado). Agora a leitura roda
  // uma vez por escopo (ou ao tocar em Atualizar) e usa sempre a versão mais recente dos dados do App.
  const ult = useRef({ PROJECTS, stored, computeHealth, ctmkData, score360, risco });
  ult.current = { PROJECTS, stored, computeHealth, ctmkData, score360, risco };
  const storedPronto = !!(stored && Object.keys(stored).length);

  useEffect(() => {
    if (!escopo || !pids.length) return;
    let vivo = true; setCarregando(true);
    const { PROJECTS: P, stored: st, computeHealth: ch, ctmkData: ck, score360: s3, risco: rk } = ult.current;
    Promise.all(pids.map((p) => carregarProjeto(p, P, st, ch, ck, s3, rk).then((x) => ({ ok: true, x })).catch((e) => ({ ok: false, pid: p, erro: (e && e.message) || "erro de leitura" })))).then((xs) => {
      if (!vivo) return;
      const m = {}, f = {};
      xs.forEach((r) => { if (r.ok && r.x) m[r.x.pid] = r.x; else if (!r.ok) f[r.pid] = r.erro; });
      setDados(m); setFalhas(f); setAtualizadoEm(new Date()); setCarregando(false);
      if (pids.length === 1) setPid(pids[0]);
    });
    return () => { vivo = false; };
  }, [escopo, pids, versao, storedPronto]); // eslint-disable-line

  // Mostra o motivo real do servidor (PIN inválido, limite de tentativas, servidor indisponível) em vez de um texto genérico.
  const entrar = async () => {
    setErro(""); let motivo = "";
    const ouvir = (e) => { motivo = (e && e.detail) || ""; };
    window.addEventListener("moklog-auth-error", ouvir);
    try {
      const n = await checkPin(pin, { cliente: true });
      if (!n) { setErro(motivo || "PIN inválido para a Área do Cliente."); return; }
      setPin(""); setEscopo(getClienteScope());
    } finally { window.removeEventListener("moklog-auth-error", ouvir); }
  };
  const sair = () => { clearSession(); setEscopo(null); setDados(null); setPid(null); onBack && onBack(); };
  const perfil = !escopo ? "" : escopo.escopo === "MOKED" ? "Visão Moked (gerencial)" : escopo.pids.length > 1 ? "Proprietário · visão macro" : "Gestor do parque";

  const pAtual = pid && dados?.[pid] ? dados[pid] : null;
  const sisPorPid = useMemo(() => { const o = {}; Object.values(dados || {}).forEach((x) => { try { o[x.pid] = calcularSIS(x, gerencial ? reguaId : "cliente"); } catch { o[x.pid] = null; } }); return o; }, [dados, reguaId, gerencial]);
  const hhmm = atualizadoEm ? atualizadoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
  const avisos = pAtual ? pAtual.luzes.filter((l) => l.on) : Object.values(dados || {}).flatMap((x) => x.luzes.filter((l) => l.on).map((l) => ({ ...l, parque: x.nome })));
  const plantao = pAtual ? pAtual.mapa.lista.map((x) => ({ ...x, foto: pAtual.colabs.find((k) => k.id === x.pessoaId)?.foto, cor: corSit(x.situacao), situacaoRotulo: ROTULO_SITUACAO[x.situacao] || x.situacao })) : [];
  const irMenu = (k) => {
    if (k === "sair") return sair();
    if (k === "atualizar") { setPilha([]); return setVersao((v) => v + 1); }
    if (k === "parques") return setPid(null);
    setPilha((s) => [...s.filter((x) => x !== "menu"), k]);
  };
  const itensMenu = [
    ...(pAtual ? [["teste", "Teste semanal", pAtual.teste.data ? `último em ${fmtD(pAtual.teste.data)}` : "sem teste"], ["risco", "Análise de risco", pAtual.risco?.nivel ? NIVEL_LABEL[pAtual.risco.nivel] : ""], ["plantao", "Mapa de Equipe", ""], ["turnover", "Turnover", ""], ["ferias", "Férias", ""], ["treino", "Treinamentos", ""], ["fotos", "Fotos · treinamentos", ""], ["equip", "Equipamentos de plantão", ""], ["sistemas", "Sistemas", ""], ["entorno", "Informativos · entorno", ""], ["local", "Localização · como chegar", ""]] : []),
    ...(pids.length > 1 && pAtual ? [["parques", "Meus parques", ""]] : []),
    ["atualizar", "Atualizar dados", hhmm ? `atualizado às ${hhmm}` : ""], ["sair", "Sair", ""],
  ];
  const Voltar = ({ children }) => <div className="voltar"><button onClick={voltarDetalhe}>← Voltar</button><div className="tit">{children}</div></div>;

  if (!escopo) return <main className="sx"><style>{CSS_SIS}</style>
    <div className="barra"><button className="ico" onClick={onBack} aria-label="← Início" title="Início">←</button><div className="logo">MOK<span>E</span>D</div><span style={{ width: 34 }} /></div>
    <div className="corpo">
      <div className="ola">Área do Cliente</div><div className="sub">Gestor do parque ou proprietário · acesso de leitura</div>
      <div className="card" style={{ marginTop: 30, textAlign: "center" }}>
        <div className="tit" style={{ marginBottom: 12 }}>Digite seu PIN</div>
        <input type="password" inputMode="numeric" aria-label="PIN do cliente" value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => e.key === "Enter" && entrar()} placeholder="PIN" style={{ width: "100%", maxWidth: 240, padding: 12, border: "1px solid #3a3a42", background: "#08080a", color: "#f1f5f9", fontSize: 20, textAlign: "center", letterSpacing: 8 }} />
        {erro && <div role="alert" style={{ color: VERMELHO2, fontSize: 12, marginTop: 8 }}>{erro}</div>}
        <div><button onClick={entrar} style={{ marginTop: 14, background: "linear-gradient(180deg, #FF1E27, #9f0710)", color: "#fff", border: "none", padding: "11px 32px", fontWeight: 900, letterSpacing: 2, cursor: "pointer", clipPath: "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)", boxShadow: "0 0 16px #FF1E2755" }}>ENTRAR</button></div>
      </div>
    </div>
  </main>;

  let tela = null;
  if (detalhe === "menu") tela = <TelaMenu itens={itensMenu} onIr={irMenu} onVoltar={voltarDetalhe} perfil={`${perfil} · somente leitura`} />;
  else if (detalhe === "avisos") tela = <TelaAvisos avisos={avisos} onVoltar={voltarDetalhe} />;
  else if (detalhe === "comunicar") tela = <TelaComunicar onVoltar={voltarDetalhe} />;
  else if (pAtual) {
    const sis = sisAtual, comum = { sis, favs, onFav: alternarFav, onIr: abrirDetalhe, onVoltar: voltarDetalhe };
    if (!detalhe) tela = <Home p={pAtual} sis={sis} favs={favs} onIr={abrirDetalhe} atualizado={hhmm} plantao={plantao} />;
    else if (detalhe === "sis") tela = <TelaSis {...comum} />;
    else if (detalhe === "favs") tela = <TelaFavs {...comum} />;
    else if (detalhe.startsWith("pilar:")) tela = <TelaPilar k={detalhe.slice(6)} {...comum} />;
    else if (detalhe.startsWith("ind:")) tela = <TelaItem id={detalhe.slice(4)} p={pAtual} sisOutra={sisOutra} {...comum} />;
    else if (detalhe === "local") tela = <><Voltar>Localização</Voltar><Localizacao pid={pAtual.pid} nome={pAtual.nome} /></>;
    else tela = <Detalhe key={detalhe} p={pAtual} tipo={detalhe} onBack={voltarDetalhe} abrirPDF={abrirPDF} />;
  } else if (dados) {
    const parques = Object.values(dados), g = consolidarGrupo(dados);
    const riscoPior = Math.max(0, ...parques.map((x) => x.risco?.nivel || 0));
    tela = <Macro nome={escopo.escopo === "MOKED" ? "Moked" : GRUPOS_CLIENTE[escopo.escopo]?.label || escopo.escopo} parques={parques} sisPorPid={sisPorPid} onAbrir={setPid}
      sub={`${g.projetos} parques · ${g.equipeAtivos} colaboradores · ${perfil}${hhmm ? ` · atualizado às ${hhmm}` : ""}`}
      hojeGrupo={<div className="card"><div className="tit">Hoje no grupo</div>
        {[[g.faltasHoje ? VERMELHO2 : VERDE, `${g.faltasHoje} falta${g.faltasHoje === 1 ? "" : "s"} nos mapas de hoje`, `${g.mapasHoje} de ${g.projetos} mapas enviados`],
          [riscoPior ? COR_RISCO[riscoPior] : CINZA, `Risco mais alto: ${riscoPior ? NIVEL_LABEL[riscoPior] : "sem avaliação"}`, parques.filter((x) => x.risco?.nivel === riscoPior && riscoPior).map((x) => x.nome).join(" · ")],
          [g.testesAtrasados ? AMARELO : VERDE, `${g.testesAtrasados} teste${g.testesAtrasados === 1 ? "" : "s"} semana${g.testesAtrasados === 1 ? "l" : "is"} atrasado${g.testesAtrasados === 1 ? "" : "s"}`, ""],
          [parques.some((x) => x.sistemas?.ctmkOff) ? VERMELHO2 : VERDE, `CTMK: ${parques.filter((x) => x.sistemas?.ctmkOff).length} off-line`, parques.filter((x) => x.sistemas?.ctmkOff).map((x) => x.nome).join(" · ") || "todas on-line"],
        ].map(([c, t, d], i) => <div key={i} className="row" style={{ cursor: "default" }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: c, flex: "none" }} /><div className="nm">{t}{d && <div className="mu">{d}</div>}</div></div>)}
      </div>} />;
  }

  return <main className="sx"><style>{CSS_SIS}</style>
    <Barra onMenu={() => setPilha((s) => (s[s.length - 1] === "menu" ? s.slice(0, -1) : [...s, "menu"]))} onAvisos={() => setPilha((s) => [...s, "avisos"])} avisos={avisos.length} />
    {gerencial && <div className="gestor-faixa">Área do Gestor · {reguaId === "moked" ? "régua interna Moked" : "vendo como o cliente"}<button onClick={() => setReguaId(reguaId === "moked" ? "cliente" : "moked")}>{reguaId === "moked" ? "ver como o cliente" : "voltar à régua Moked"}</button></div>}
    <div className="corpo">
      {carregando && <p role="status" className="mu">Lendo os dados dos parques…</p>}
      {!carregando && Object.keys(falhas).length > 0 && <div role="alert" className="card" style={{ borderColor: VERMELHO2 }}>
        <div className="tit" style={{ color: VERMELHO2 }}>Não consegui ler {Object.keys(falhas).length === 1 ? "um parque" : `${Object.keys(falhas).length} parques`}</div>
        {Object.entries(falhas).map(([k, v]) => <div key={k} className="mu">{k}: {v}</div>)}
        <div className="mu" style={{ marginTop: 6 }}>Abra o menu ☰ e toque em Atualizar dados.</div>
      </div>}
      {!carregando && tela}
    </div>
  </main>;
}

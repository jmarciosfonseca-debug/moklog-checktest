// Entorno — painel do gestor (Marcio, 02/11/2026). Notícias de segurança e de mercado logístico no entorno de cada parque,
// coletadas no servidor (api/entorno-coletar.js) e gravadas em entorno/{pid}. Somente leitura + "Atualizar agora" (gerencial).
import { useEffect, useMemo, useState } from "react";
import { getApps } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { authFetch } from "../session";
import { LOCAIS, GERAL, recebeGeral, projetosComEntorno, TIPO_ROTULO } from "./locais";
import { mesclar, resumir } from "./core";
import EntornoLista, { corTipo, fmtData } from "./EntornoLista";
import { C, Cabecalho, VERMELHO2, VERDE, AMARELO, CINZA, AZUL } from "../cliente/Cluster";
import { MOKED_LOGO } from "../generatePDF";

const db = () => getFirestore(getApps()[0]);
const ler = (id) => getDoc(doc(db(), "entorno", id)).then((s) => (s.exists() ? s.data() : null)).catch(() => null);

const corTend = (t) => (t === "alta" ? VERMELHO2 : t === "queda" ? VERDE : AMARELO);
const setaTend = (t) => (t === "alta" ? "▲" : t === "queda" ? "▼" : "▶");

function CardParque({ pid, d, onAbrir }) {
  const l = LOCAIS[pid]; const r = d?.resumo;
  const seg = r?.seguranca, mer = r?.mercado;
  const topo = seg ? Object.entries(seg.porTipo || {}).sort((a, b) => b[1] - a[1]).slice(0, 3) : [];
  return <button onClick={() => onAbrir(pid)} style={C.cardBtn} aria-label={`Abrir entorno de ${l.nome}`}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
      <div><div style={{ fontSize: 13, fontWeight: 800, color: "#f3f4f6" }}>{l.nome}</div><div style={C.micro}>{l.cidade}/{l.uf}</div></div>
      {d?.atualizadoEm ? <div style={{ ...C.micro, textAlign: "right" }}>coleta {fmtData(d.atualizadoEm)}</div> : <span style={C.chip(CINZA)}>sem coleta</span>}
    </div>
    {!d && <div style={{ ...C.micro, marginTop: 8 }}>Ainda sem dados. Toque em "Atualizar agora".</div>}
    {d && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 10 }}>
      <div><div style={C.numero(seg?.d30 ? (seg.graves ? VERMELHO2 : AMARELO) : VERDE)}>{seg?.d30 ?? 0}</div><div style={C.micro}>segurança · 30 dias</div></div>
      <div><div style={{ ...C.numero(corTend(seg?.tendencia)), fontSize: 20, marginTop: 4 }}>{setaTend(seg?.tendencia)} {seg?.anterior30 ?? 0}→{seg?.d30 ?? 0}</div><div style={C.micro}>tendência vs. 30 anteriores</div></div>
      <div><div style={C.numero(AZUL)}>{mer?.d30 ?? 0}</div><div style={C.micro}>mercado · 30 dias</div></div>
    </div>}
    {topo.length > 0 && <div style={{ marginTop: 6 }}>{topo.map(([t, n]) => <span key={t} style={C.chip(corTipo(t))}>{TIPO_ROTULO[t] || t} {n}</span>)}</div>}
  </button>;
}

export default function Entorno({ onBack }) {
  const [dados, setDados] = useState(null), [status, setStatus] = useState(null), [pid, setPid] = useState(null);
  const [versao, setVersao] = useState(0), [atualizando, setAtualizando] = useState(false), [msg, setMsg] = useState("");
  const pids = useMemo(() => projetosComEntorno(), []);

  useEffect(() => {
    let vivo = true;
    Promise.all([...pids.map((p) => ler(p).then((d) => [p, d])), ler("_status").then((s) => ["_status", s]), ler(GERAL.id).then((g) => [GERAL.id, g])]).then((xs) => {
      if (!vivo) return;
      const m = {}; let st = null, geral = null;
      xs.forEach(([k, v]) => { if (k === "_status") st = v; else if (k === GERAL.id) geral = v; else m[k] = v; });
      // Mercado geral (Black Friday, e-commerce…) entra no entorno de todo parque elegível; o resumo é recalculado aqui.
      for (const p of pids) {
        if (!m[p] && !(geral && recebeGeral(p))) continue;
        const itens = mesclar(m[p]?.itens || [], recebeGeral(p) ? (geral?.itens || []).map((i) => ({ ...i, geral: true })) : []);
        m[p] = { ...(m[p] || {}), itens, resumo: resumir(itens) };
      }
      setDados(m); setStatus(st);
    });
    return () => { vivo = false; };
  }, [pids, versao]);

  const atualizar = async () => {
    setAtualizando(true); setMsg("");
    try {
      const r = await authFetch("/api/entorno-coletar" + (pid ? `?pid=${pid}` : ""), { method: "POST" });
      const j = await r.json().catch(() => ({}));
      const falhas = Object.entries(j.feitos || {}).filter(([, v]) => v && v.erro).map(([k, v]) => `${k}: ${v.erro}`);
      setMsg((j.mensagem || j.erro || (r.ok ? "Atualizado." : `Falha (${r.status}).`)) + (falhas.length ? ` Falhas — ${falhas.join("; ")}` : ""));
      if (r.ok) setVersao((v) => v + 1);
    } catch (e) { setMsg((e && e.message) || "Falha ao acionar a coleta."); }
    finally { setAtualizando(false); }
  };

  const totais = useMemo(() => {
    if (!dados) return null;
    let seg = 0, graves = 0, mer = 0, alta = 0;
    for (const p of pids) { const r = dados[p]?.resumo; if (!r) continue; seg += r.seguranca.d30; graves += r.seguranca.graves; mer += r.mercado.d30; if (r.seguranca.tendencia === "alta") alta++; }
    return { seg, graves, mer, alta };
  }, [dados, pids]);

  const d = pid ? dados?.[pid] : null;
  return <main style={{ ...C.main, maxWidth: 680 }} data-testid="entorno">
    <Cabecalho logo={MOKED_LOGO} badge="Entorno" direita={<button style={C.back} onClick={pid ? () => setPid(null) : onBack}>← {pid ? "Parques" : "Voltar"}</button>} />
    <div style={{ ...C.micro, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span>Notícias de segurança e mercado logístico no entorno dos parques · {status?.ultimaEm ? `última coleta ${new Date(status.ultimaEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : "rotina diária às 06h"}</span>
      <button onClick={atualizar} disabled={atualizando} style={{ ...C.back, minHeight: 28, padding: "3px 10px", fontSize: 11 }} aria-label="Atualizar agora">{atualizando ? "Coletando… (até 1 min)" : pid ? `Atualizar ${pid}` : "Atualizar agora"}</button>
    </div>
    {msg && <div role="status" style={{ ...C.micro, marginBottom: 8, color: /falha|erro|aguarde|não/i.test(msg) ? AMARELO : VERDE }}>{msg}</div>}
    {!dados && <p role="status" style={C.micro}>Lendo o entorno dos parques…</p>}

    {dados && !pid && <>
      {totais && <div style={C.card}>
        <div style={C.titulo}>Últimos 30 dias · todos os parques</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
          <div><div style={C.numero(totais.seg ? AMARELO : VERDE)}>{totais.seg}</div><div style={C.micro}>ocorrências noticiadas</div></div>
          <div><div style={C.numero(totais.graves ? VERMELHO2 : VERDE)}>{totais.graves}</div><div style={C.micro}>graves (90 d)</div></div>
          <div><div style={C.numero(totais.alta ? VERMELHO2 : VERDE)}>{totais.alta}</div><div style={C.micro}>parques em alta</div></div>
          <div><div style={C.numero(AZUL)}>{totais.mer}</div><div style={C.micro}>notícias de mercado</div></div>
        </div>
      </div>}
      {pids.map((p) => <CardParque key={p} pid={p} d={dados[p]} onAbrir={setPid} />)}
      <div style={{ ...C.micro, marginTop: 6 }}>Mercado geral (Black Friday, e-commerce, grandes ocupantes) entra em todos os parques, exceto Jatinox (só segurança).</div>
    </>}

    {dados && pid && <div style={C.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
        <div><div style={{ fontSize: 14, fontWeight: 800, color: "#f3f4f6" }}>{LOCAIS[pid].nome}</div><div style={C.micro}>{LOCAIS[pid].cidade}/{LOCAIS[pid].uf} · entorno: {(LOCAIS[pid].vizinhas || []).join(", ") || "—"}</div></div>
        {d?.ultimaColeta && <div style={{ ...C.micro, textAlign: "right" }}>coleta {fmtData(d.ultimaColeta.em)} · {d.ultimaColeta.lidos} lidas · {d.ultimaColeta.aceitos} novas{d.ultimaColeta.erros?.length ? ` · ${d.ultimaColeta.erros.length} falha(s) de fonte` : ""}</div>}
      </div>
      {d?.ultimaColeta?.fontes && <div style={{ ...C.micro, marginBottom: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>{d.ultimaColeta.fontes.map((f, i) => <span key={i} style={C.chip(f.ok ? VERDE : VERMELHO2)} title={f.ok ? `${f.lidos} lidas` : "falha ao ler"}>{f.fonte} {f.ok ? f.lidos : "✕"}</span>)}</div>}
      {d?.ultimaColeta?.erros?.length > 0 && <div role="alert" style={{ ...C.micro, color: AMARELO, marginBottom: 8 }}>{d.ultimaColeta.erros.join(" · ")}</div>}
      {!d && <div style={C.micro}>Sem coleta ainda para este parque.</div>}
      {d && <EntornoLista itens={d.itens} />}
    </div>}
  </main>;
}

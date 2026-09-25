import React, { useEffect, useMemo, useState } from "react";
import { carregarCatalogoDiagnostico } from "./diagnostico/catalogoClient";
import { calcularProgresso, lerRascunho, limparRascunho, salvarRascunho } from "./diagnostico/draft";

const STATUS = {
  conforme: { rotulo: "Conforme", cor: "#22c55e", icone: "✓" },
  parcial: { rotulo: "Parcial", cor: "#f59e0b", icone: "◐" },
  nao_conforme: { rotulo: "Não conforme", cor: "#ef4444", icone: "!" },
  ausente_necessario: { rotulo: "Ausente necessário", cor: "#e11d48", icone: "×" },
  na: { rotulo: "N/A", cor: "#64748b", icone: "—" },
  sem_dado: { rotulo: "Sem dado", cor: "#8b5cf6", icone: "?" },
};

const CRITICIDADE = {
  critico: { rotulo: "Crítico", cor: "#ef4444" },
  relevante: { rotulo: "Relevante", cor: "#f59e0b" },
  informativo: { rotulo: "Informativo", cor: "#38bdf8" },
};

export default function DiagnosticoSituacional({ project, dark = true, onBack }) {
  const [catalogo, setCatalogo] = useState(null);
  const [respostas, setRespostas] = useState({});
  const [categoriaId, setCategoriaId] = useState("");
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [salvoEm, setSalvoEm] = useState("");
  const [alterado, setAlterado] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    setErro("");
    carregarCatalogoDiagnostico()
      .then((data) => {
        if (!ativo) return;
        setCatalogo(data);
        setCategoriaId(data.categorias?.[0]?.id || "");
        const draft = lerRascunho(project.id, data.id);
        if (draft?.respostas) {
          setRespostas(draft.respostas);
          setSalvoEm(draft.atualizadoEm || "");
        }
        setAlterado(false);
      })
      .catch((e) => { if (ativo) setErro(e.message || "Falha ao carregar catálogo."); })
      .finally(() => { if (ativo) setLoading(false); });
    return () => { ativo = false; };
  }, [project.id, tentativa]);

  useEffect(() => {
    if (!catalogo || !alterado) return;
    const timer = setTimeout(() => {
      try {
        const draft = salvarRascunho(project.id, catalogo.id, respostas);
        setSalvoEm(draft.atualizadoEm);
        setAlterado(false);
      } catch (_) {
        setErro("Não foi possível salvar o rascunho neste aparelho.");
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [alterado, catalogo, project.id, respostas]);

  const categorias = catalogo?.categorias || [];
  const itens = catalogo?.itens || [];
  const itensVisiveis = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return itens.filter((item) => {
      const mesmaCategoria = !categoriaId || item.categoria === categoriaId;
      const bateBusca = !termo || `${item.id} ${item.texto}`.toLocaleLowerCase("pt-BR").includes(termo);
      return mesmaCategoria && bateBusca && item.deprecado !== true;
    });
  }, [itens, categoriaId, busca]);

  const progresso = useMemo(
    () => calcularProgresso(itens.filter((item) => item.deprecado !== true), respostas, catalogo),
    [itens, respostas, catalogo]
  );

  const subcategorias = useMemo(
    () => new Map((catalogo?.subcategorias || []).map((sub) => [sub.id, sub.nome])),
    [catalogo]
  );

  const marcar = (itemId, status) => {
    setAlterado(true);
    setRespostas((atuais) => ({
      ...atuais,
      [itemId]: { ...(atuais[itemId] || {}), status, atualizadoEm: new Date().toISOString() },
    }));
  };

  const descartar = () => {
    if (!catalogo || !window.confirm("Descartar todas as marcações deste diagnóstico neste aparelho?")) return;
    limparRascunho(project.id, catalogo.id);
    setRespostas({});
    setSalvoEm("");
    setAlterado(false);
  };

  const bg = dark ? "#04080f" : "#f1f5f9";
  const card = dark ? "#08111f" : "#ffffff";
  const borda = dark ? "#1e293b" : "#dbe3ee";
  const texto = dark ? "#e2e8f0" : "#0f172a";
  const secundario = dark ? "#94a3b8" : "#64748b";

  if (loading) return (
    <div style={{ minHeight:"100vh", background:bg, display:"grid", placeItems:"center", color:texto, fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <div style={{ textAlign:"center" }}><div style={{ fontSize:34 }}>🧭</div><div style={{ marginTop:10, fontWeight:800 }}>Carregando catálogo publicado…</div></div>
    </div>
  );

  if (erro && !catalogo) return (
    <div style={{ minHeight:"100vh", background:bg, display:"grid", placeItems:"center", padding:24, color:texto, fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <div style={{ maxWidth:420, width:"100%", background:card, border:`1px solid ${borda}`, borderRadius:18, padding:24, textAlign:"center" }}>
        <div style={{ fontSize:36 }}>⚠️</div><h2 style={{ fontSize:18 }}>Catálogo indisponível</h2><p style={{ color:secundario, fontSize:13 }}>{erro}</p>
        <button onClick={() => setTentativa((n) => n + 1)} style={{ width:"100%", padding:12, border:0, borderRadius:10, background:"#2563eb", color:"#fff", fontWeight:800, cursor:"pointer" }}>Tentar novamente</button>
        <button onClick={onBack} style={{ width:"100%", marginTop:8, padding:11, border:`1px solid ${borda}`, borderRadius:10, background:"transparent", color:secundario, fontWeight:700, cursor:"pointer" }}>Voltar</button>
      </div>
    </div>
  );

  const categoriaAtual = categorias.find((cat) => cat.id === categoriaId);
  return (
    <div style={{ minHeight:"100vh", background:bg, color:texto, fontFamily:"'Segoe UI',system-ui,sans-serif", paddingBottom:48 }}>
      <header style={{ position:"sticky", top:0, zIndex:10, background:dark?"rgba(4,8,15,.96)":"rgba(241,245,249,.96)", borderBottom:`1px solid ${borda}`, backdropFilter:"blur(12px)" }}>
        <div style={{ maxWidth:920, margin:"0 auto", padding:"12px 16px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <button onClick={onBack} aria-label="Voltar" style={{ width:38, height:38, borderRadius:10, border:`1px solid ${borda}`, background:card, color:texto, cursor:"pointer", fontSize:18 }}>←</button>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:17, fontWeight:900 }}>Diagnóstico Situacional</div>
              <div style={{ fontSize:11, color:secundario }}>{project.id} · {project.name} · Catálogo v{catalogo.versao}</div>
            </div>
            <div style={{ textAlign:"right" }}><div style={{ fontSize:20, fontWeight:900, color:"#38bdf8" }}>{progresso.percentual}%</div><div style={{ fontSize:9, color:secundario }}>{progresso.avaliados}/{progresso.denominador}</div></div>
          </div>
          <div style={{ height:7, background:dark?"#111827":"#dbe3ee", borderRadius:99, marginTop:10, overflow:"hidden" }}><div style={{ height:"100%", width:`${progresso.percentual}%`, background:"linear-gradient(90deg,#0ea5e9,#22c55e)", transition:"width .25s ease" }}/></div>
        </div>
      </header>

      <main style={{ maxWidth:920, margin:"0 auto", padding:"16px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", gap:12, alignItems:"center", marginBottom:12 }}>
          <div><div style={{ fontSize:12, color:secundario }}>Rascunho local</div><div style={{ fontSize:11, color:"#22c55e", fontWeight:700 }}>{salvoEm ? `Salvo ${new Date(salvoEm).toLocaleTimeString("pt-BR", {hour:"2-digit",minute:"2-digit"})}` : "Pronto para salvar"}</div></div>
          <button onClick={descartar} style={{ border:`1px solid ${borda}`, background:"transparent", color:secundario, borderRadius:9, padding:"8px 10px", cursor:"pointer", fontSize:11, fontWeight:700 }}>Descartar rascunho</button>
        </div>

        <label style={{ display:"block", marginBottom:12 }}><span style={{ position:"absolute", width:1, height:1, overflow:"hidden" }}>Buscar item</span><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por código ou descrição…" style={{ width:"100%", boxSizing:"border-box", background:card, border:`1px solid ${borda}`, color:texto, borderRadius:11, padding:"12px 14px", outline:"none", fontSize:13 }}/></label>

        <nav aria-label="Categorias do diagnóstico" style={{ display:"flex", gap:7, overflowX:"auto", paddingBottom:10, marginBottom:8 }}>
          {categorias.map((cat) => <button key={cat.id} onClick={() => setCategoriaId(cat.id)} style={{ flex:"0 0 auto", border:`1px solid ${cat.id===categoriaId?"#38bdf8":borda}`, background:cat.id===categoriaId?"#0ea5e922":card, color:cat.id===categoriaId?"#38bdf8":secundario, borderRadius:10, padding:"9px 11px", cursor:"pointer", fontSize:11, fontWeight:800 }}>{cat.id} · {cat.nome}</button>)}
        </nav>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"end", margin:"8px 0 12px" }}><div><div style={{ fontSize:18, fontWeight:900 }}>{categoriaAtual?.nome}</div><div style={{ color:secundario, fontSize:11 }}>{itensVisiveis.length} item(ns) exibido(s)</div></div></div>

        <div style={{ display:"grid", gap:10 }}>
          {itensVisiveis.map((item) => {
            const atual = respostas[item.id]?.status || "";
            const crit = CRITICIDADE[item.criticidade] || CRITICIDADE.informativo;
            return <article key={item.id} style={{ background:card, border:`1px solid ${atual?(STATUS[atual]?.cor||borda)+"66":borda}`, borderRadius:14, padding:14, contentVisibility:"auto" }}>
              <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                <div style={{ flex:1 }}><div style={{ display:"flex", gap:7, flexWrap:"wrap", alignItems:"center" }}><span style={{ fontSize:10, fontWeight:900, color:"#38bdf8" }}>{item.id}</span><span style={{ fontSize:9, fontWeight:800, color:crit.cor, border:`1px solid ${crit.cor}55`, borderRadius:99, padding:"2px 6px" }}>{crit.rotulo}</span>{item.aplicavelPadrao===false&&<span style={{ fontSize:9, color:secundario }}>opcional</span>}</div><div style={{ fontSize:14, fontWeight:750, marginTop:5, lineHeight:1.35 }}>{item.texto}</div><div style={{ fontSize:10, color:secundario, marginTop:3 }}>{subcategorias.get(item.subcategoria) || item.subcategoria}</div></div>
              </div>
              <div role="group" aria-label={`Status de ${item.id}`} style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:12 }}>
                {(catalogo.statusPossiveisPadrao || Object.keys(STATUS)).map((status) => { const conf=STATUS[status]||{rotulo:status,cor:"#64748b",icone:"•"}; const ativo=atual===status; return <button key={status} onClick={() => marcar(item.id,status)} aria-pressed={ativo} style={{ border:`1px solid ${ativo?conf.cor:borda}`, background:ativo?`${conf.cor}22`:"transparent", color:ativo?conf.cor:secundario, borderRadius:8, padding:"7px 9px", cursor:"pointer", fontSize:10, fontWeight:800 }}>{conf.icone} {conf.rotulo}</button>; })}
              </div>
            </article>;
          })}
        </div>
        {itensVisiveis.length===0&&<div style={{ textAlign:"center", color:secundario, padding:40 }}>Nenhum item encontrado.</div>}
      </main>
    </div>
  );
}

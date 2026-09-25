// ─────────────────────────────────────────────────────────────
// PainelLider.jsx — Painel do Líder por Projeto (dentro de Registros)
//
// Recebe SOMENTE o projectId já autorizado pela sessão de líder
// (session.getScopedProjectId). Sem seletor, sem PIN novo, sem
// outros projetos. Lê apenas equipes/{pid} e equipamentos/{pid}.
//
// Privacidade: projeta só nome/função/turno/situação. NUNCA
// renderiza foto ampliada, telefone, documento ou histórico
// disciplinar.
//
// SOMENTE LEITURA. O líder não baixa status aqui — baixas de
// equipamento ocorrem apenas no módulo Equipamentos, sob validação
// gerencial. Este painel apenas consolida e detalha.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { statusReciclagem } from "./pendencias";
import { gerarPDFSolicitacoesColaborador, gerarPDFSolicitacoesLote } from "./pdfSolicitacoes";
import {
  QUALIDADE, detalharPendenciaEquip,
  situacaoChecagemEquipamentos, situacaoChecagemEquipe,
} from "./pendenciasLider";

const firebaseConfig = {
  apiKey: "AIzaSyDLMwBqccgWDk7VFQdLYKuLNXWtkNn5WGA",
  authDomain: "moklog-checktest.firebaseapp.com",
  projectId: "moklog-checktest",
  storageBucket: "moklog-checktest.firebasestorage.app",
};
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

// Categorias canônicas de equipamento (espelha Equipamentos.jsx).
const EQUIP_CATS = [
  { key: "radiosHT",    label: "Rádios HT" },
  { key: "smartphones", label: "Smartphones" },
  { key: "armamento",   label: "Armamento" },
  { key: "municao",     label: "Munição" },
  { key: "bodycam",     label: "Bodycam" },
  { key: "lanternas",   label: "Lanternas" },
  { key: "ztrax",       label: "ZTRAX" },
  { key: "placas",      label: "Placas" },
];

const NOMES_PROJETO = {
  P601:"Golgi Cajamar", P602:"Golgi Mauá", P604:"Golgi Jundiaí", P605:"Golgi Dutra",
  P606:"Golgi Duque de Caxias", P607:"Golgi Brasília",
  P311A:"Mega Curitiba", P311B:"Mega Itajaí", P505:"KLOG Guarulhos",
  P260A:"Jatinox A", P260B:"Jatinox B", P260C:"Jatinox C",
};

// Alvo da checagem de equipamentos → timestamp do domingo 23:59.
// Recriação pura da lógica de Equipamentos.jsx (evita editar aquele módulo).
function chkAlvoTimestamp(alvoISO) {
  const [y, m, d] = String(alvoISO).split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setHours(23, 59, 0, 0);
  return dt.getTime();
}

const hojeISO = () => new Date().toLocaleDateString("sv-SE");
const fmtBR = (d) => { if(!d) return "—"; try { return new Date(String(d).length===10?d+"T12:00:00":d).toLocaleDateString("pt-BR"); } catch { return String(d); } };

// Reciclagem obrigatória só para funções de VIGILÂNCIA (espelha RegistrosMenu).
const NAO_RECICLA = ["cda","porteiro","porteiro cco","recepção","recepcao","recepcionista","agp","agp cco"];
const fazReciclagem = (cargo) => {
  const c = String(cargo||"").trim().toLowerCase();
  return !!c && !NAO_RECICLA.includes(c);
};

// Nº de check-ins de equipe exigidos (espelha chkEqNumCheckins de Equipe.jsx).
const CHK_EQUIPE_4X2 = ["P505","P260A","P260B","P260C"];
function numCheckinsEquipe(projectId, colaboradores) {
  if (CHK_EQUIPE_4X2.includes(projectId)) return 3;
  const ativos = (colaboradores||[]).filter(c => (c.status||"ativo")==="ativo");
  const n4x2 = ativos.filter(c => String(c.escala||"").includes("4x2")).length;
  if (ativos.length>0 && n4x2/ativos.length>=0.5) return 3;
  return 4;
}

export default function PainelLider({ projectId, dark, onBack, onToggleTheme, onEquipe, onEquipamentos }) {
  const bg = dark ? "#04080f" : "#f1f5f9";
  const cardBg = dark ? "#060c18" : "#ffffff";
  const border = dark ? "#0f172a" : "#e2e8f0";
  const txt = dark ? "#f1f5f9" : "#0f172a";
  const txt2 = dark ? "#64748b" : "#94a3b8";
  const hdrBg = dark ? "#04080f" : "#f8fafc";

  const [equipe, setEquipe] = useState(null);
  const [equip, setEquip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [drill, setDrill] = useState(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    let eq = null, ep = null;
    try { const s = await getDoc(doc(db,"equipes",projectId)); if(s.exists()) eq = s.data(); } catch(e){}
    try { const s = await getDoc(doc(db,"equipamentos",projectId)); if(s.exists()) ep = s.data(); } catch(e){}
    setEquipe(eq); setEquip(ep); setLoading(false);
  }, [projectId]);

  useEffect(()=>{ carregar(); }, [carregar]);

  // ── Derivações (projeção segura) ──────────────────────────────────────
  const cols = (equipe?.colaboradores || []).filter(c => c.status === "ativo");
  const colById = {}; cols.forEach(c => { if(c.id!=null) colById[String(c.id)] = c; });
  const hoje = hojeISO();

  // Card 1 — Minha Equipe Hoje (+ equipes montadas por líder via equipeLiderId)
  const porTurno = {};
  cols.forEach(c => { const t = c.turno || "—"; porTurno[t] = (porTurno[t]||0)+1; });
  const semVinculo = cols.filter(c => !c.turno).length;
  const lideres = cols.filter(c => /l[íi]der/i.test(String(c.cargo||"")));
  const equipesMontadas = lideres.map(l => ({
    lider: l.nome || "Líder",
    membros: cols.filter(c => c.equipeLiderId === l.id).length,
  })).filter(e => e.membros>0);
  const semEquipe = cols.filter(c => !c.equipeLiderId && !/l[íi]der/i.test(String(c.cargo||""))).length;

  // Card 2 — Férias e Cobertura (cruzando colabId → nome/cargo/turno)
  const ferias = Array.isArray(equipe?.ferias) ? equipe.ferias : [];
  const projetarFerias = (f) => {
    const c = f?.colabId != null ? colById[String(f.colabId)] : null;
    return {
      nome: c?.nome || f?.nome || "Colaborador",
      cargo: c?.cargo || "",
      turno: c?.turno || "",
      inicio: f?.dataInicio || null,
      retorno: f?.dataRetorno || null,
      cobertura: f?.cobertura || f?.coberturaPor || null,
    };
  };
  const feriasHoje = ferias.filter(f => f?.dataInicio && f?.dataRetorno && f.dataInicio<=hoje && hoje<=f.dataRetorno).map(projetarFerias);
  const retornos7 = ferias.filter(f => {
    if(!f?.dataRetorno) return false;
    const dd = Math.round((new Date(f.dataRetorno+"T12:00:00").getTime() - Date.now())/86400000);
    return dd>=0 && dd<=7;
  }).map(projetarFerias);
  const feriasFuturas = ferias.filter(f => f?.dataInicio && f.dataInicio>hoje).map(projetarFerias);
  const coberturaPendente = feriasHoje.filter(f => !f.cobertura).length;

  // Card 3 — Reciclagens (usando .estado / .diasRestantes)
  const recicl = cols.filter(c => fazReciclagem(c.cargo)).map(c => {
    const info = statusReciclagem(c.ultimaReciclagem);
    return { nome: c.nome || "—", cargo: c.cargo || "", ultima: c.ultimaReciclagem || null, estado: info.estado, diasRestantes: info.diasRestantes };
  });
  const reciclVencida = recicl.filter(r => r.estado === "vencido");
  const reciclAlerta = recicl.filter(r => r.estado === "alerta");
  const reciclSemData = recicl.filter(r => r.estado === "sem-data");

  // Card 4 — Equipamentos da Equipe
  const equipItens = [];
  EQUIP_CATS.forEach(cat => {
    const arr = Array.isArray(equip?.[cat.key]) ? equip[cat.key] : [];
    arr.forEach(it => equipItens.push({ item: it, catKey: cat.key, catLabel: cat.label }));
  });
  if (equip?.moto) equipItens.push({ item: equip.moto, catKey: "moto", catLabel: "Moto" });
  const totalEquip = equipItens.length;
  const inop = equipItens.filter(x => x.item.status==="inop" || x.item.status==="critico");
  const parcial = equipItens.filter(x => x.item.status==="parcial" || x.item.status==="baixo");
  const okEquip = totalEquip - inop.length - parcial.length;

  // Card 5 — Pendências de Material (uniforme.solicitacoes)
  const solicMaterial = [];
  cols.forEach(c => {
    const sl = c.uniforme && Array.isArray(c.uniforme.solicitacoes) ? c.uniforme.solicitacoes : [];
    sl.forEach(s => solicMaterial.push({ colab: c.nome || "—", item: s.item || s.nome || "Material", status: s.status || "pendente", desde: s.desde || s.em || null }));
  });
  const materialPendente = solicMaterial.filter(s => s.status === "pendente");

  // Card 6 — Checagens Semanais (estrutura real de cada módulo)
  const sitEquip = situacaoChecagemEquipamentos(equip?.checagemSemanal, chkAlvoTimestamp);
  const sitEquipe = situacaoChecagemEquipe(equipe?.checagemEquipe, numCheckinsEquipe(projectId, cols));
  const diasParaDomingo = (() => { const d = new Date(); return (7 - d.getDay()) % 7; })();

  // Card de Próximos Passos — consolida prazos e pendências que se aproximam.
  const alertas = [];
  const prazoDom = diasParaDomingo === 0 ? "hoje (domingo)" : `em ${diasParaDomingo} dia(s)`;
  if (sitEquipe.situacao !== "concluida") alertas.push({ cor:"#f59e0b", icone:"👥", txt:`Checagem de equipe pendente — vence ${prazoDom}` });
  if (sitEquip.situacao !== "concluida") alertas.push({ cor:"#f59e0b", icone:"🛡️", txt:`Checagem de equipamentos pendente — vence ${prazoDom}` });
  if (inop.length > 0) alertas.push({ cor:"#ef4444", icone:"⚠️", txt:`${inop.length} equipamento(s) inoperante(s)/crítico(s)` });
  if (reciclVencida.length > 0) alertas.push({ cor:"#ef4444", icone:"🔄", txt:`${reciclVencida.length} reciclagem(ns) vencida(s)` });
  if (reciclAlerta.length > 0) alertas.push({ cor:"#f59e0b", icone:"🔄", txt:`${reciclAlerta.length} reciclagem(ns) a vencer` });
  if (retornos7.length > 0) alertas.push({ cor:"#0ea5e9", icone:"🏖️", txt:`${retornos7.length} retorno(s) de férias em 7 dias` });
  if (coberturaPendente > 0) alertas.push({ cor:"#f59e0b", icone:"🏖️", txt:`${coberturaPendente} cobertura(s) de férias pendente(s)` });
  if (materialPendente.length > 0) alertas.push({ cor:"#f59e0b", icone:"📦", txt:`${materialPendente.length} solicitação(ões) de material pendente(s)` });
  const rotuloSit = (s) => s==="concluida" ? "Concluída" : s==="parcial" ? "Parcial" : "Pendente";
  const corSit = (s) => s==="concluida" ? "#22c55e" : s==="parcial" ? "#f59e0b" : "#f59e0b";

  // ── Drill-down de equipamento (com marcador de qualidade) ─────────────
  const abrirDrillEquip = (lista, titulo) => {
    const itens = lista.map(x => detalharPendenciaEquip(x.item, x.catLabel, projectId, null));
    setDrill({ titulo, tipo:"equip", itens });
  };

  const nomeProjeto = NOMES_PROJETO[projectId] || projectId;

  // ── UI helpers ────────────────────────────────────────────────────────
  const Card = ({ children }) => (
    <div style={{ background:cardBg, border:`1px solid ${border}`, borderRadius:12, padding:"14px 16px", marginBottom:10 }}>{children}</div>
  );
  const CardTitle = ({ icon, children, onOpen, openLabel }) => (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
      <div style={{ fontSize:14, fontWeight:800, color:txt }}>{icon} {children}</div>
      {onOpen && <button onClick={onOpen} style={{ background:"transparent", border:`1px solid ${border}`, color:txt2, borderRadius:7, padding:"5px 10px", fontSize:11, cursor:"pointer", fontWeight:600 }}>{openLabel}</button>}
    </div>
  );
  const Metric = ({ label, value, cor, onClick }) => (
    <button onClick={onClick} disabled={!onClick} style={{ flex:1, background: dark?"#020510":"#f8fafc", border:`1px solid ${border}`, borderRadius:10, padding:"10px 8px", textAlign:"center", cursor:onClick?"pointer":"default" }}>
      <div style={{ fontSize:20, fontWeight:800, color: cor||txt }}>{value}</div>
      <div style={{ fontSize:10, color:txt2, marginTop:2 }}>{label}</div>
    </button>
  );
  const QualBadge = ({ q }) => (
    <span style={{ fontSize:9, fontWeight:700, color:q.cor, background:q.cor+"22", padding:"2px 6px", borderRadius:4 }}>{q.label}</span>
  );
  const secBtn = { background:dark?"#020510":"#f8fafc", border:`1px solid ${border}`, color:txt, borderRadius:10, padding:"12px", fontSize:12, fontWeight:600, cursor:"pointer" };

  return (
    <div style={{ minHeight:"100vh", background:bg, display:"flex", justifyContent:"center", fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <div style={{ width:"100%", maxWidth:480, display:"flex", flexDirection:"column" }}>
        {/* Header */}
        <div style={{ position:"sticky", top:0, zIndex:10, background:hdrBg, borderBottom:`1px solid ${border}`, padding:"14px 16px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <button onClick={onBack} style={{ background:"transparent", border:`1px solid ${border}`, color:txt2, borderRadius:7, padding:"7px 12px", fontSize:12, cursor:"pointer", fontWeight:600 }}>← Início</button>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:15, fontWeight:800, color:txt }}>📋 Painel do Líder</div>
              <div style={{ fontSize:11, color:txt2 }}>{projectId} — {nomeProjeto} · Sessão de líder ativa</div>
            </div>
            {onToggleTheme && <button onClick={onToggleTheme} style={{ background:"transparent", border:`1px solid ${border}`, borderRadius:8, padding:"5px 10px", cursor:"pointer", fontSize:14, color:txt2 }}>{dark?"☀️":"🌙"}</button>}
          </div>
        </div>

        <div style={{ padding:"14px 16px" }}>
          {loading ? (
            <div style={{ color:txt2, fontSize:13, textAlign:"center", padding:"40px 0" }}>Carregando dados do projeto…</div>
          ) : (
          <>
            {/* Card 0 — Próximos Passos / Alertas */}
            <Card>
              <CardTitle icon="🔔">Próximos Passos</CardTitle>
              {alertas.length === 0 ? (
                <div style={{ fontSize:12, color:"#22c55e", fontWeight:600 }}>✓ Tudo em dia. Nenhum alerta no momento.</div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                  {alertas.map((a,i)=>(
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, color:txt }}>
                      <span style={{ width:6, height:6, borderRadius:"50%", background:a.cor, flexShrink:0 }}/>
                      <span>{a.icone} {a.txt}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Card 1 — Minha Equipe Hoje */}
            <Card>
              <CardTitle icon="👥" onOpen={()=>onEquipe && onEquipe(projectId)} openLabel="Ver equipe">Minha Equipe Hoje</CardTitle>
              <div style={{ display:"flex", gap:8, marginBottom:8 }}>
                <Metric label="Ativos" value={cols.length} cor="#0ea5e9" />
                <Metric label="Sem vínculo" value={semEquipe} cor={semEquipe>0?"#f59e0b":txt} />
                <Metric label="Sem turno" value={semVinculo} cor={semVinculo>0?"#f59e0b":txt} />
              </div>
              <div style={{ fontSize:11, color:txt2, marginBottom:6 }}>
                {Object.entries(porTurno).map(([t,n])=>`${t}: ${n}`).join("  ·  ") || "Sem distribuição de turno"}
              </div>
              {equipesMontadas.length>0 && (
                <div style={{ fontSize:11, color:txt2 }}>
                  Equipes montadas: {equipesMontadas.map(e=>`${e.lider} (${e.membros})`).join("  ·  ")}
                </div>
              )}
            </Card>

            {/* Card 2 — Férias e Cobertura */}
            <Card>
              <CardTitle icon="🏖️">Férias e Cobertura</CardTitle>
              <div style={{ display:"flex", gap:8, marginBottom:8 }}>
                <Metric label="De férias hoje" value={feriasHoje.length} cor="#a855f7" onClick={feriasHoje.length?()=>setDrill({titulo:"De férias hoje", tipo:"ferias", itens:feriasHoje}):null} />
                <Metric label="Retornam ≤7d" value={retornos7.length} cor="#22c55e" onClick={retornos7.length?()=>setDrill({titulo:"Retornos em 7 dias", tipo:"ferias", itens:retornos7}):null} />
                <Metric label="Cobertura pend." value={coberturaPendente} cor={coberturaPendente>0?"#f59e0b":txt} />
              </div>
              {feriasFuturas.length>0 && <div style={{ fontSize:11, color:txt2 }}>Férias futuras programadas: {feriasFuturas.length}</div>}
            </Card>

            {/* Card 3 — Reciclagens */}
            <Card>
              <CardTitle icon="🔄">Reciclagens</CardTitle>
              <div style={{ display:"flex", gap:8 }}>
                <Metric label="Vencidas" value={reciclVencida.length} cor={reciclVencida.length?"#ef4444":txt} onClick={reciclVencida.length?()=>setDrill({titulo:"Reciclagens vencidas", tipo:"recicl", itens:reciclVencida}):null} />
                <Metric label="Em alerta" value={reciclAlerta.length} cor={reciclAlerta.length?"#f59e0b":txt} onClick={reciclAlerta.length?()=>setDrill({titulo:"Reciclagens em alerta", tipo:"recicl", itens:reciclAlerta}):null} />
                <Metric label="Sem data" value={reciclSemData.length} cor={reciclSemData.length?"#94a3b8":txt} onClick={reciclSemData.length?()=>setDrill({titulo:"Sem data de reciclagem", tipo:"recicl", itens:reciclSemData}):null} />
              </div>
            </Card>

            {/* Card 4 — Equipamentos da Equipe */}
            <Card>
              <CardTitle icon="🛡️" onOpen={()=>onEquipamentos && onEquipamentos(projectId)} openLabel="Ver inventário">Equipamentos da Equipe</CardTitle>
              <div style={{ display:"flex", gap:8 }}>
                <Metric label="Total" value={totalEquip} cor={txt} />
                <Metric label="Inop/Crítico" value={inop.length} cor={inop.length?"#ef4444":txt} onClick={inop.length?()=>abrirDrillEquip(inop,"Equipamentos inoperantes/críticos"):null} />
                <Metric label="Parcial" value={parcial.length} cor={parcial.length?"#f59e0b":txt} onClick={parcial.length?()=>abrirDrillEquip(parcial,"Equipamentos parciais"):null} />
                <Metric label="OK" value={okEquip} cor="#22c55e" />
              </div>
            </Card>

            {/* Card 5 — Pendências de Material */}
            <Card>
              <CardTitle icon="📦">Pendências de Material</CardTitle>
              <div style={{ display:"flex", gap:8 }}>
                <Metric label="Pendentes" value={materialPendente.length} cor={materialPendente.length?"#f59e0b":txt} onClick={materialPendente.length?()=>setDrill({titulo:"Solicitações de material", tipo:"material", itens:materialPendente}):null} />
                <Metric label="Total" value={solicMaterial.length} cor={txt} />
              </div>
              <div style={{ fontSize:10, color:txt2, marginTop:8 }}>Aprovação/conclusão é gerencial. O líder pode abrir ou complementar.</div>
              {materialPendente.length>0 && (
                <button onClick={()=>gerarPDFSolicitacoesLote({id:projectId}, equipe?.colaboradores||[])}
                  style={{ marginTop:10, width:"100%", background:"linear-gradient(135deg,#B21E27,#121212)", color:"#fff", border:"none", borderRadius:8, padding:"10px", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                  📄 Baixar PDF das pendências (lote)
                </button>
              )}
            </Card>

            {/* Card 6 — Checagens Semanais */}
            <Card>
              <CardTitle icon="✅">Checagens Semanais</CardTitle>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:txt }}>
                  <span>Equipe {sitEquipe.exigidos ? `(${sitEquipe.feitos}/${sitEquipe.exigidos})` : ""}</span>
                  <span style={{ color:corSit(sitEquipe.situacao), fontWeight:700 }}>{rotuloSit(sitEquipe.situacao)}</span>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:txt }}>
                  <span>Equipamentos{sitEquip.ultima?` · últ. ${fmtBR(sitEquip.ultima)}`:""}</span>
                  <span style={{ color:corSit(sitEquip.situacao), fontWeight:700 }}>{rotuloSit(sitEquip.situacao)}</span>
                </div>
                <div style={{ fontSize:10, color:txt2, marginTop:4 }}>
                  {diasParaDomingo===0 ? "Prazo: hoje (domingo 23:59)" : `Faltam ${diasParaDomingo} dia(s) para o domingo`}
                </div>
              </div>
            </Card>

            {/* Card 7 — Ações rápidas */}
            <Card>
              <CardTitle icon="⚡">Ações rápidas</CardTitle>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                <button onClick={()=>onEquipe && onEquipe(projectId)} style={secBtn}>Abrir minha equipe</button>
                <button onClick={()=>onEquipamentos && onEquipamentos(projectId)} style={secBtn}>Abrir equipamentos</button>
                <button onClick={()=>setDrill({titulo:"Férias e retornos", tipo:"ferias", itens:[...feriasHoje, ...retornos7]})} style={secBtn}>Ver férias</button>
                <button onClick={()=>setDrill({titulo:"Reciclagens", tipo:"recicl", itens:[...reciclVencida, ...reciclAlerta, ...reciclSemData]})} style={secBtn}>Ver reciclagens</button>
                <button onClick={()=>setDrill({titulo:"Solicitações de material", tipo:"material", itens:solicMaterial})} style={{...secBtn, gridColumn:"1/-1"}}>Ver pendências de material</button>
              </div>
            </Card>
          </>
          )}
        </div>
      </div>

      {/* Drill-down: lista detalhada clicável */}
      {drill && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.75)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:900 }} onClick={()=>setDrill(null)}>
          <div style={{ background:cardBg, borderTop:`1px solid ${border}`, borderRadius:"16px 16px 0 0", width:"100%", maxWidth:480, maxHeight:"80vh", overflowY:"auto", padding:"16px" }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <div style={{ fontSize:14, fontWeight:800, color:txt }}>{drill.titulo}</div>
              <button onClick={()=>setDrill(null)} style={{ background:"transparent", border:"none", color:txt2, fontSize:20, cursor:"pointer" }}>✕</button>
            </div>
            {drill.tipo==="material" && drill.itens.length>0 && (
              <button onClick={()=>gerarPDFSolicitacoesLote({id:projectId}, equipe?.colaboradores||[])}
                style={{ width:"100%", marginBottom:12, background:"linear-gradient(135deg,#B21E27,#121212)", color:"#fff", border:"none", borderRadius:8, padding:"10px", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                📄 Baixar PDF de todas as pendências (lote)
              </button>
            )}
            {drill.itens.length===0 && <div style={{ color:txt2, fontSize:13 }}>Nenhum item.</div>}
            {drill.itens.map((it,i)=>(
              <div key={i} style={{ border:`1px solid ${border}`, borderRadius:10, padding:"12px", marginBottom:8 }}>
                {drill.tipo==="equip" && (<>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8 }}>
                    <div style={{ fontSize:13, fontWeight:800, color:txt }}>{it.nome}</div>
                    <QualBadge q={it.qualidade} />
                  </div>
                  <div style={{ fontSize:11, color:txt2, marginTop:2 }}>{it.projeto} · {it.categoria}</div>
                  <div style={{ fontSize:11, color:txt, marginTop:6 }}>Status: <b>{String(it.status).toUpperCase()}</b></div>
                  {it.desde
                    ? <div style={{ fontSize:11, color:txt2 }}>Aberto desde: {fmtBR(it.desde)} · há {it.diasAberto} dia(s)</div>
                    : <div style={{ fontSize:11, color:"#f59e0b" }}>Data de abertura não registrada</div>}
                  {it.ultimaAtualizacaoData && <div style={{ fontSize:11, color:txt2 }}>Última atualização: {fmtBR(it.ultimaAtualizacaoData)}{it.ultimaAtualizacaoResponsavel?` · ${it.ultimaAtualizacaoResponsavel}`:""}</div>}
                  {it.semanasConsecutivas==null
                    ? <div style={{ fontSize:10, color:txt2, fontStyle:"italic", marginTop:2 }}>Histórico semanal ainda não correlacionado</div>
                    : <div style={{ fontSize:11, color:txt2 }}>Aparece em {it.semanasConsecutivas} teste(s) semanal(is) consecutivo(s)</div>}
                  {it.observacao && <div style={{ fontSize:11, color:txt2, marginTop:4 }}>Obs.: "{it.observacao}"</div>}
                  {it.qualidade.id==="desatualizado" && <div style={{ fontSize:10, color:"#94a3b8", marginTop:6, fontStyle:"italic" }}>Item antigo sem confirmação recente — pode já ter sido corrigido fisicamente e não baixado no app.</div>}
                  <div style={{ fontSize:10, color:txt2, marginTop:8, fontStyle:"italic" }}>Baixas de status somente no módulo Equipamentos (validação gerencial).</div>
                </>)}
                {drill.tipo==="recicl" && (<>
                  <div style={{ fontSize:13, fontWeight:800, color:txt }}>{it.nome}</div>
                  <div style={{ fontSize:11, color:txt2 }}>{it.cargo} · {it.ultima ? `Última: ${fmtBR(it.ultima)}${it.diasRestantes!=null?` · ${it.diasRestantes<0?`vencida há ${Math.abs(it.diasRestantes)}d`:`vence em ${it.diasRestantes}d`}`:""}` : "Sem data"}</div>
                </>)}
                {drill.tipo==="ferias" && (<>
                  <div style={{ fontSize:13, fontWeight:800, color:txt }}>{it.nome}</div>
                  <div style={{ fontSize:11, color:txt2 }}>{[it.cargo, it.turno].filter(Boolean).join(" · ")}</div>
                  <div style={{ fontSize:11, color:txt2 }}>{it.inicio?`Início ${fmtBR(it.inicio)} · `:""}Retorno {fmtBR(it.retorno)}</div>
                  <div style={{ fontSize:11, color: it.cobertura?txt2:"#f59e0b" }}>Cobertura: {it.cobertura || "pendente"}</div>
                </>)}
                {drill.tipo==="material" && (<>
                  <div style={{ fontSize:13, fontWeight:800, color:txt }}>{it.item}</div>
                  <div style={{ fontSize:11, color:txt2 }}>{it.colab} · {it.status}{it.desde?` · desde ${fmtBR(it.desde)}`:""}</div>
                </>)}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

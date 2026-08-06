// ════════════════════════════════════════════════════════════════════════
// KeyAccessFalha.jsx — Registro de falhas do sistema KeyAccess
// MokLog CheckTest · Moked Consulting Security
//
// Fluxo de campo (SEM PIN): Home → escolhe projeto → escolhe quem está
// registrando (lista da Equipe) → marca o tipo de falha → salva.
//
// Fluxo gerencial (COM PIN): Relatório por projeto ou consolidado, com
// filtros de período/projeto/impacto, e contagem automática de "dias sem
// falha" entre um registro e outro.
//
// Coleção Firestore: keyaccess_falhas/{projectId} → { registros:[...] }
// ════════════════════════════════════════════════════════════════════════
import { useState, useEffect } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { setDoc } from "./fireGuard";

const firebaseConfig = {
  apiKey: "AIzaSyDLMwBqccgWDk7VFQdLYKuLNXWtkNn5WGA",
  authDomain: "moklog-checktest.firebaseapp.com",
  projectId: "moklog-checktest",
  storageBucket: "moklog-checktest.firebasestorage.app",
  messagingSenderId: "390165325023",
  appId: "1:390165325023:web:3147cd333503916b0d756a"
};
const fbApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(fbApp);

import { grantSession, hasGerencial } from "./session";

const ADMIN_PIN = "872101";
const COL = "keyaccess_falhas";

// Brasão Moked (mesmo do Mapa de Equipe) — usado no cabeçalho do PDF.
const MOKED_LOGO_SVG = `<svg class="logo" width="54" height="54" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="kbg" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#2a2a2a"/><stop offset="100%" stop-color="#111"/></radialGradient>
    <linearGradient id="kmetal" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#d0d0d0"/><stop offset="40%" stop-color="#888"/><stop offset="100%" stop-color="#555"/></linearGradient>
    <linearGradient id="kred" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#cc2222"/><stop offset="50%" stop-color="#991111"/><stop offset="100%" stop-color="#7a0e0e"/></linearGradient>
  </defs>
  <rect width="100" height="100" rx="14" fill="url(#kbg)"/>
  <circle cx="50" cy="50" r="38" fill="none" stroke="url(#kmetal)" stroke-width="7"/>
  <circle cx="50" cy="50" r="26" fill="none" stroke="url(#kred)" stroke-width="8"/>
  <circle cx="50" cy="50" r="7" fill="#111"/>
  <rect x="47.5" y="8" width="5" height="18" rx="2" fill="url(#kred)"/>
  <rect x="47.5" y="74" width="5" height="18" rx="2" fill="url(#kred)"/>
  <rect x="8" y="47.5" width="18" height="5" rx="2" fill="url(#kmetal)"/>
  <rect x="74" y="47.5" width="18" height="5" rx="2" fill="url(#kmetal)"/>
</svg>`;

// Apenas estes 8 projetos usam KeyAccess (P260A/B/C e P505 não usam).
export const PROJETOS_KA = [
  { id:"P601",  name:"Golgi Cajamar" },
  { id:"P602",  name:"Golgi Mauá" },
  { id:"P604",  name:"Golgi Jundiaí" },
  { id:"P605",  name:"Golgi Dutra" },
  { id:"P606",  name:"Golgi Duque de Caxias" },
  { id:"P607",  name:"Golgi Brasília" },
  { id:"P311A", name:"Mega CL Curitiba" },
  { id:"P311B", name:"Mega CL Itajaí" },
];

// Tipos de falha extraídos do uso real (grupo das equipes). Os mesmos tipos
// se repetem em todos os projetos — não são nomes de portal por projeto.
const TAGS_FALHA = [
  { key:"sistema_inoperante",   label:"Sistema KeyAccess inoperante / fora do ar",          cor:"#ef4444" },
  { key:"instabilidade",        label:"Sistema operando com instabilidade",                  cor:"#f59e0b" },
  { key:"parcial",              label:"Sistema operando parcialmente",                       cor:"#f59e0b" },
  { key:"concierge",            label:"Concierge inoperante",                                cor:"#ef4444" },
  { key:"dupla_checagem",       label:"Dupla checagem de veículos inoperante",               cor:"#ef4444" },
  { key:"liberacao_caminhoes",  label:"Liberação de caminhões/motoristas não sobe",          cor:"#ef4444" },
  { key:"painel_alertas",       label:"Painel de alertas offline",                           cor:"#ef4444" },
  { key:"saida_motorista",      label:"Informações de saída do motorista não sobem pra CCO", cor:"#ef4444" },
  { key:"internet_local",       label:"KeyAccess em falha por queda de Internet Local",        cor:"#f59e0b" },
];
const TAG_OUTRO = { key:"outro", label:"✏️ Editar Falha (digitar)", cor:"#818cf8" };

// Suporta tanto registros antigos (impacto era uma string única) quanto os
// novos (array, pois agora dá pra marcar Entrada e Saída ao mesmo tempo).
function getImpactos(r){
  if(Array.isArray(r.impacto)) return r.impacto;
  if(r.impacto) return [r.impacto];
  return [];
}
function labelImpacto(k){ return k==="entrada" ? "↘ Entrada" : k==="saida" ? "↗ Saída" : "🏢 Inquilino"; }

// Suporta registros antigos (tipo único) e novos (array de tipos — agora
// dá pra marcar mais de uma falha no mesmo registro).
function getTipos(r){
  if(Array.isArray(r.tipos)) return r.tipos;
  if(r.tipo) return [r.tipo];
  return [];
}
// Hora de início, com fallback pro campo antigo "hora" (registros anteriores).
function getHoraInicio(r){ return r.horaInicio || r.hora || ""; }

// Calcula quanto tempo a falha ficou no ar, quando há hora de início e de retorno.
function calcDuracaoFalha(horaInicio, horaFim){
  if(!horaInicio||!horaFim) return null;
  try{
    const [h1,m1]=horaInicio.split(":").map(Number);
    const [h2,m2]=horaFim.split(":").map(Number);
    let mins=(h2*60+m2)-(h1*60+m1);
    if(mins<0) mins+=24*60; // virou o dia
    if(mins<=0) return null;
    const h=Math.floor(mins/60), m=mins%60;
    return h>0 ? `${h}h ${m}min` : `${m} min`;
  }catch{ return null; }
}

// Texto de exibição do responsável: P607 usa um colaborador específico
// (Vigilante Ronda); os demais projetos usam o toggle Rondas/AGP de CCO.
function getResponsavelTexto(r){
  if(r.vigilanteRonda?.nome) return `Vigilante Ronda: ${r.vigilanteRonda.nome}`;
  if(r.responsavelTurno?.length) return `Responsável: ${r.responsavelTurno.join(", ")}`;
  return "";
}

// Versão numérica (em minutos) da duração — usada pra somar nos relatórios.
function calcMinutosFalha(horaInicio, horaFim){
  if(!horaInicio||!horaFim) return null;
  try{
    const [h1,m1]=horaInicio.split(":").map(Number);
    const [h2,m2]=horaFim.split(":").map(Number);
    let mins=(h2*60+m2)-(h1*60+m1);
    if(mins<0) mins+=24*60;
    return mins>0 ? mins : null;
  }catch{ return null; }
}

function todayStr(){ return new Date().toLocaleDateString("sv-SE"); }
function nowHM(){ const n=new Date(); return `${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}`; }
function fmtDate(d){ if(!d) return "--"; try{ return new Date(d+"T12:00:00").toLocaleDateString("pt-BR"); }catch{ return d; } }
function diffDias(d1, d2){
  try{ return Math.floor((new Date(d2+"T12:00:00").getTime()-new Date(d1+"T12:00:00").getTime())/86400000); }
  catch{ return null; }
}

// "Dias sem falha" = hoje − data da última falha registrada (null se nunca houve falha).
function calcDiasSemFalha(registros){
  if(!registros||!registros.length) return null;
  const datas = registros.map(r=>r.data).filter(Boolean).sort();
  const ultima = datas[datas.length-1];
  return diffDias(ultima, todayStr());
}

// Para o relatório: calcula o intervalo (em dias) entre cada falha e a anterior.
function calcIntervalos(registrosOrdenados){
  const out=[];
  for(let i=0;i<registrosOrdenados.length;i++){
    const atual=registrosOrdenados[i];
    const anterior=registrosOrdenados[i-1];
    out.push({ ...atual, diasDesdeAnterior: anterior?diffDias(anterior.data,atual.data):null });
  }
  return out;
}

async function loadFalhas(projectId){
  try{
    const snap = await getDoc(doc(db,COL,projectId));
    if(snap.exists()){
      const data = snap.data().registros||[];
      try{ localStorage.setItem(`${COL}_${projectId}`, JSON.stringify(data)); }catch(e){}
      return data;
    }
  }catch(e){}
  try{ const l=localStorage.getItem(`${COL}_${projectId}`); if(l) return JSON.parse(l); }catch(e){}
  return [];
}
async function saveFalhas(projectId, registros){
  try{ await setDoc(doc(db,COL,projectId),{ registros, updatedAt:new Date().toISOString() }); }
  catch(e){ console.error("KeyAccess save error:",e); throw e; }
  try{ localStorage.setItem(`${COL}_${projectId}`, JSON.stringify(registros)); }catch(e){}
}
// Quem registra a falha do KeyAccess só pode ser Líder (Vigilante Líder /
// VSPP Líder) ou CCO (Vigilante CCO / Porteiro CCO) — não CDA, Ronda, Apoio etc.
function ehLiderOuCCO(cargo){
  const c = (cargo||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  return c.includes("lider") || c.includes("cco");
}

async function loadEquipe(projectId){
  try{
    const snap = await getDoc(doc(db,"equipes",projectId));
    if(snap.exists()){
      const cols = snap.data().colaboradores||[];
      return cols.filter(c=>c.status!=="desligado"&&c.nome&&c.nome.trim());
    }
  }catch(e){}
  return [];
}

function getStyles(dark){
  return {
    page:    { minHeight:"100vh", background:dark?"#04080f":"#f1f5f9", display:"flex", justifyContent:"center", padding:"0 0 80px", fontFamily:"'Segoe UI',system-ui,sans-serif" },
    wrap:    { width:"100%", maxWidth:480, display:"flex", flexDirection:"column" },
    card:    { background:dark?"#060c18":"#ffffff", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, borderRadius:12, padding:"14px 16px" },
    btn:     { background:"linear-gradient(135deg,#dc2626,#991b1b)", color:"#fff", border:"none", borderRadius:10, padding:"13px 16px", fontSize:14, fontWeight:700, cursor:"pointer", width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:8 },
    btnGreen:{ background:"linear-gradient(135deg,#16a34a,#15803d)", color:"#fff", border:"none", borderRadius:10, padding:"13px 16px", fontSize:14, fontWeight:700, cursor:"pointer", width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:8 },
    btnSec:  { background:dark?"#060c18":"#f8fafc", color:dark?"#94a3b8":"#475569", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, borderRadius:10, padding:"13px 16px", fontSize:15, fontWeight:600, cursor:"pointer", width:"100%", display:"flex", alignItems:"center", justifyContent:"center" },
    btnSm:   { background:dark?"#020510":"#f8fafc", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, color:dark?"#94a3b8":"#475569", borderRadius:6, padding:"5px 10px", fontSize:12, cursor:"pointer", fontWeight:600 },
    backBtn: { background:"transparent", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, color:dark?"#cbd5e1":"#64748b", borderRadius:7, padding:"7px 12px", fontSize:13, cursor:"pointer", flexShrink:0, fontWeight:600 },
    inp:     { width:"100%", background:dark?"#020510":"#ffffff", border:`1px solid ${dark?"#1e293b":"#cbd5e1"}`, borderRadius:7, color:dark?"#f1f5f9":"#1e293b", padding:"11px 12px", fontSize:14, boxSizing:"border-box", outline:"none" },
    lbl:     { display:"block", fontSize:11, color:dark?"#94a3b8":"#64748b", fontWeight:700, marginBottom:4, textTransform:"uppercase", letterSpacing:.5 },
    hdrBg:   { background:dark?"#1a0202":"#fef2f2", borderBottom:`1px solid ${dark?"#3a0a0a":"#fecaca"}` },
    txt:     { color:dark?"#ffffff":"#0f172a" },
    txt2:    { color:dark?"#cbd5e1":"#475569" },
  };
}

// ════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ════════════════════════════════════════════════════════════════════════
export default function KeyAccessFalha({ dark, onToggleTheme, onBack }){
  const S = getStyles(dark);
  const [screen, setScreen] = useState("projetos"); // projetos | form | lista | relatorios_pin | relatorios
  const [project, setProject] = useState(null);
  const [equipe, setEquipe] = useState([]);
  const [equipeCompleta, setEquipeCompleta] = useState([]); // sem filtro de cargo — pra achar Vigilante Ronda (P607)
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [diasPorProjeto, setDiasPorProjeto] = useState({}); // {pid: dias|null} — pra mostrar na tela de seleção

  // Carrega o resumo de "dias sem falha" de todos os projetos, pra mostrar
  // já na tela inicial de seleção, sem precisar abrir cada um.
  useEffect(()=>{
    (async()=>{
      const entries = await Promise.all(PROJETOS_KA.map(async p=>{
        const f = await loadFalhas(p.id);
        return [p.id, calcDiasSemFalha(f)];
      }));
      setDiasPorProjeto(Object.fromEntries(entries));
    })();
  },[]);

  const abrirProjeto = async (p) => {
    setProject(p);
    setLoading(true);
    const [f, eq] = await Promise.all([loadFalhas(p.id), loadEquipe(p.id)]);
    setRegistros(f);
    setEquipe(eq.filter(c=>ehLiderOuCCO(c.cargo)));
    setEquipeCompleta(eq);
    setLoading(false);
    setScreen("lista");
  };

  // ── TELA: escolha de projeto (sem PIN)
  if(screen==="projetos") return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{position:"sticky",top:0,zIndex:10,...S.hdrBg,padding:"14px 16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button onClick={onBack} style={S.backBtn} aria-label="Voltar">← Voltar</button>
            <div style={{flex:1}}>
              <div style={{fontSize:16,fontWeight:800,color:"#ef4444"}}>🚨 KeyAccess Falha</div>
              <div style={{fontSize:11,...S.txt2}}>Escolha o projeto</div>
            </div>
            <button onClick={onToggleTheme} style={{background:"transparent",border:`1px solid ${dark?"#1e293b":"#cbd5e1"}`,borderRadius:8,padding:"5px 10px",cursor:"pointer",fontSize:14,...S.txt2}} aria-label="Alternar tema claro/escuro">{dark?"☀️":"🌙"}</button>
          </div>
        </div>
        <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:8}}>
          <style>{`@keyframes kaGlow{0%,100%{box-shadow:0 0 14px #ef444455, inset 0 1px 0 #ef444422}50%{box-shadow:0 0 6px #ef444422, inset 0 1px 0 #ef444411}}`}</style>
          {PROJETOS_KA.map(p=>{
            const dias = diasPorProjeto[p.id];
            const temDias = dias!==undefined && dias!==null;
            const falhaRecente = temDias && dias<2;             // falha hoje ou ontem → glow vermelho
            const cor = !temDias?"#64748b":dias>=7?"#22c55e":dias>=2?"#f59e0b":"#ef4444";
            const META = 30;                                     // 30 dias sem falha = barra cheia
            const pct = temDias ? Math.min(dias/META,1)*100 : 0;
            return (
            <button key={p.id} onClick={()=>abrirProjeto(p)}
              style={{...S.card,cursor:"pointer",textAlign:"left",display:"flex",flexDirection:"column",gap:0,
                border:`1px solid ${falhaRecente?"#ef444488":(dark?"#0f172a":"#e2e8f0")}`,
                boxShadow:falhaRecente?"0 0 14px #ef444455":"none",
                animation:falhaRecente?"kaGlow 1.6s ease-in-out infinite":"none"}}>
              <div style={{display:"flex",alignItems:"center",gap:12,width:"100%"}}>
                <div style={{width:40,height:40,borderRadius:10,background:dark?"#1a0202":"#fef2f2",border:"1px solid #ef444433",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:18}}>🚨</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:800,...S.txt}}>{p.id}</div>
                  <div style={{fontSize:11,...S.txt2}}>{p.name}</div>
                </div>
                {dias!==undefined && (
                  dias===null ? (
                    <span style={{fontSize:10,...S.txt2,flexShrink:0}}>Sem registros</span>
                  ) : (
                    <div style={{textAlign:"center",flexShrink:0}}>
                      <div style={{fontSize:16,fontWeight:900,color:cor}}>{dias}</div>
                      <div style={{fontSize:8,...S.txt2,fontWeight:700,whiteSpace:"nowrap"}}>DIAS S/ FALHA</div>
                    </div>
                  )
                )}
                <span style={{...S.txt2,fontSize:16}}>›</span>
              </div>
              {temDias && (
                <div style={{width:"100%",marginTop:10}}>
                  <div style={{width:"100%",height:6,borderRadius:4,background:dark?"#0a0f1e":"#e2e8f0",overflow:"hidden"}}>
                    <div style={{width:`${pct}%`,height:"100%",borderRadius:4,
                      background:`linear-gradient(90deg, ${cor}99, ${cor})`,
                      boxShadow:`0 0 8px ${cor}66`,
                      transition:"width .5s ease"}}/>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:3}}>
                    <span style={{fontSize:8,...S.txt2,fontWeight:700}}>{dias>=META?"META ATINGIDA \u2705":`META ${META}D`}</span>
                    <span style={{fontSize:8,fontWeight:800,color:cor}}>{Math.round(pct)}%</span>
                  </div>
                </div>
              )}
            </button>
            );
          })}
          <button onClick={()=>setScreen(hasGerencial()?"relatorios":"relatorios_pin")} style={{...S.btnSec,marginTop:10,color:"#a855f7",borderColor:"#a855f733"}}>📊 Relatórios Gerenciais</button>
        </div>
      </div>
    </div>
  );

  if(loading) return (
    <div style={{...S.page,alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center"}}><div style={{fontSize:30,marginBottom:10}}>🚨</div><div style={{fontSize:13,...S.txt2}}>Carregando...</div></div>
    </div>
  );

  // ── TELA: lista de falhas do projeto + ação de nova falha
  if(screen==="lista"&&project) {
    const diasSemFalha = calcDiasSemFalha(registros);
    const recentes = [...registros].sort((a,b)=>(b.data+b.hora).localeCompare(a.data+a.hora)).slice(0,10);
    return (
      <div style={S.page}>
        <div style={S.wrap}>
          <div style={{position:"sticky",top:0,zIndex:10,...S.hdrBg,padding:"14px 16px"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <button onClick={()=>{setScreen("projetos");setProject(null);}} style={S.backBtn} aria-label="Voltar">← Voltar</button>
              <div style={{flex:1}}>
                <div style={{fontSize:15,fontWeight:800,color:"#ef4444"}}>🚨 {project.id}</div>
                <div style={{fontSize:11,...S.txt2}}>{project.name}</div>
              </div>
            </div>
          </div>
          <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:10}}>
            <div style={{...S.card,textAlign:"center",border:`1px solid ${diasSemFalha===null?"#64748b44":diasSemFalha>=7?"#22c55e44":"#f59e0b44"}`}}>
              {diasSemFalha===null ? (
                <div style={{fontSize:13,...S.txt2}}>Nenhuma falha registrada ainda</div>
              ) : (
                <>
                  <div style={{fontSize:30,fontWeight:900,color:diasSemFalha>=7?"#22c55e":diasSemFalha>=2?"#f59e0b":"#ef4444"}}>{diasSemFalha}</div>
                  <div style={{fontSize:10,...S.txt2,fontWeight:700,textTransform:"uppercase",letterSpacing:.5}}>dia(s) sem falha registrada</div>
                </>
              )}
            </div>

            <button onClick={()=>setScreen("form")} style={S.btn}>+ Registrar Nova Falha</button>

            {recentes.length>0 && (
              <>
                <div style={{fontSize:10,...S.txt2,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginTop:4}}>Últimos registros</div>
                {recentes.map(r=>{
                  const tipos = getTipos(r);
                  const horaIni = getHoraInicio(r);
                  const dur = calcDuracaoFalha(horaIni, r.horaFim);
                  return (
                    <div key={r.id} style={{...S.card,padding:"10px 12px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,flexWrap:"wrap"}}>
                        {tipos.map(tk=>{
                          const tag = TAGS_FALHA.find(t=>t.key===tk) || TAG_OUTRO;
                          return <span key={tk} style={{fontSize:10,fontWeight:700,color:tag.cor,background:tag.cor+"22",padding:"2px 8px",borderRadius:6}}>{tk==="outro"?"Outro":tag.label}</span>;
                        })}
                        {getImpactos(r).map(imp=>(
                          <span key={imp} style={{fontSize:10,fontWeight:700,color:"#0ea5e9",background:"#0ea5e922",padding:"2px 8px",borderRadius:6}}>{labelImpacto(imp)}</span>
                        ))}
                      </div>
                      {tipos.includes("outro")&&r.tipoCustom&&<div style={{fontSize:12,...S.txt,marginBottom:3}}>{r.tipoCustom}</div>}
                      <div style={{fontSize:11,...S.txt2}}>
                        📅 {fmtDate(r.data)} · ⏱ {horaIni}{r.horaFim?` – ${r.horaFim}`:""}{dur?` (${dur})`:""} · 👤 {r.registradoPor?.nome||"—"}
                      </div>
                      {r.obs&&<div style={{fontSize:11,...S.txt2,marginTop:3,fontStyle:"italic"}}>{r.obs}</div>}
                    </div>
                  );
                })}
              </>
            )}
            {recentes.length===0&&<div style={{textAlign:"center",padding:"20px 0",fontSize:12,...S.txt2}}>Nenhum registro ainda neste projeto.</div>}
          </div>
        </div>
      </div>
    );
  }

  // ── TELA: formulário de registro
  if(screen==="form"&&project) return (
    <FormularioFalha project={project} equipe={equipe} equipeCompleta={equipeCompleta} dark={dark} S={S}
      onVoltar={()=>setScreen("lista")}
      onSalvo={async(novo)=>{
        setSaving(true);
        const novaLista=[novo,...registros];
        setRegistros(novaLista);
        try{ await saveFalhas(project.id, novaLista); } catch(e){ alert("Erro ao salvar — verifique a conexão e tente de novo."); }
        setSaving(false);
        setScreen("lista");
      }}
      saving={saving}/>
  );

  // ── PIN gerencial p/ relatórios
  if(screen==="relatorios_pin") return (
    <RelatoriosPinGate dark={dark} S={S}
      onBack={()=>setScreen("projetos")}
      onSuccess={()=>{grantSession("admin");setScreen("relatorios");}}/>
  );

  if(screen==="relatorios") return (
    <RelatoriosKA dark={dark} S={S} onBack={()=>setScreen("projetos")}/>
  );

  return null;
}

// ── Formulário de registro de falha
function FormularioFalha({ project, equipe, equipeCompleta, dark, S, onVoltar, onSalvo, saving }){
  const [registradoPor, setRegistradoPor] = useState(()=>{
    try{ const l=localStorage.getItem(`ka_last_user_${project.id}`); if(l) return JSON.parse(l); }catch(e){}
    return null;
  });
  const [tipos, setTipos] = useState([]); // array: pode marcar mais de um tipo de falha
  const [tipoCustom, setTipoCustom] = useState("");
  const [data, setData] = useState(todayStr());
  const [horaInicio, setHoraInicio] = useState(nowHM());
  const [horaFim, setHoraFim] = useState("");
  const [impactos, setImpactos] = useState([]); // array: pode ter "entrada", "saida", "inquilino"
  const [vigilanteRonda, setVigilanteRonda] = useState(null); // colaborador com cargo "Vigilante Ronda" — universal, todos os projetos
  const [obs, setObs] = useState("");

  const duracao = calcDuracaoFalha(horaInicio, horaFim);
  const podeSalvar = registradoPor && tipos.length>0 && (!tipos.includes("outro")||tipoCustom.trim());

  const salvar = () => {
    if(!registradoPor){ alert("Selecione quem está registrando."); return; }
    if(tipos.length===0){ alert("Selecione ao menos um tipo de falha."); return; }
    if(tipos.includes("outro")&&!tipoCustom.trim()){ alert("Descreva a falha."); return; }
    try{ localStorage.setItem(`ka_last_user_${project.id}`, JSON.stringify(registradoPor)); }catch(e){}
    onSalvo({
      id: Date.now().toString()+Math.random().toString(36).substring(2,5),
      data, horaInicio, horaFim, tipos, tipoCustom: tipos.includes("outro")?tipoCustom.trim():"",
      impacto: impactos,
      vigilanteRonda: vigilanteRonda ? {id:vigilanteRonda.id, nome:vigilanteRonda.nome} : null,
      obs: obs.trim(),
      registradoPor: { id:registradoPor.id, nome:registradoPor.nome },
      registradoEm: new Date().toISOString(),
    });
  };

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{position:"sticky",top:0,zIndex:10,...S.hdrBg,padding:"14px 16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button onClick={onVoltar} style={S.backBtn} aria-label="Voltar">← Voltar</button>
            <div style={{flex:1}}>
              <div style={{fontSize:15,fontWeight:800,color:"#ef4444"}}>🚨 Registrar Falha</div>
              <div style={{fontSize:11,...S.txt2}}>{project.id} · {project.name}</div>
            </div>
          </div>
        </div>
        <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:14}}>

          <div>
            <label style={S.lbl}>Quem está registrando? *</label>
            <select value={registradoPor?.id||""} onChange={e=>{const c=equipe.find(x=>String(x.id)===e.target.value);setRegistradoPor(c?{id:c.id,nome:c.nome}:null);}} style={{...S.inp,cursor:"pointer"}}>
              <option value="">Selecione...</option>
              {equipe.map(c=>(<option key={c.id} value={c.id}>{c.nome}{c.cargo?` — ${c.cargo}`:""}</option>))}
            </select>
            {equipe.length===0&&<div style={{fontSize:11,color:"#ef4444",marginTop:4}}>Nenhum colaborador cadastrado na Equipe deste projeto.</div>}
          </div>

          <div>
            <label style={S.lbl}>Tipo de Falha * (pode marcar mais de uma)</label>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {[...TAGS_FALHA, TAG_OUTRO].map(t=>{
                const sel = tipos.includes(t.key);
                return (
                  <button key={t.key} onClick={()=>setTipos(prev=> prev.includes(t.key) ? prev.filter(x=>x!==t.key) : [...prev,t.key])}
                    style={{textAlign:"left",background:sel?t.cor+"22":dark?"#020510":"#fff",border:`2px solid ${sel?t.cor:dark?"#1e293b":"#e2e8f0"}`,borderRadius:9,padding:"11px 14px",cursor:"pointer",fontSize:14,fontWeight:sel?700:500,color:sel?t.cor:dark?"#e2e8f0":"#334155",display:"flex",alignItems:"center",gap:8}}>
                    <span style={{width:18,height:18,borderRadius:5,border:`2px solid ${sel?t.cor:dark?"#475569":"#cbd5e1"}`,background:sel?t.cor:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#fff"}}>{sel?"✓":""}</span>
                    {t.label}
                  </button>
                );
              })}
            </div>
            {tipos.includes("outro")&&(
              <textarea value={tipoCustom} onChange={e=>setTipoCustom(e.target.value)} placeholder="Descreva a falha..."
                style={{...S.inp,height:60,resize:"vertical",fontSize:14,marginTop:8}}/>
            )}
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div>
              <label style={S.lbl}>Data</label>
              <input type="date" value={data} onChange={e=>setData(e.target.value)} style={S.inp}/>
            </div>
            <div>
              <label style={S.lbl}>Hora de Início</label>
              <input type="time" value={horaInicio} onChange={e=>setHoraInicio(e.target.value)} style={S.inp}/>
            </div>
          </div>
          <div>
            <label style={S.lbl}>Hora de Retorno (quando voltou ao normal — opcional)</label>
            <input type="time" value={horaFim} onChange={e=>setHoraFim(e.target.value)} style={S.inp}/>
          </div>
          {duracao && (
            <div style={{fontSize:12,fontWeight:700,color:"#f59e0b",background:dark?"#1a1000":"#fffbeb",border:"1px solid #f59e0b44",borderRadius:8,padding:"7px 11px"}}>
              ⏱ Tempo fora do ar: {duracao}
            </div>
          )}
          <div style={{fontSize:11,...S.txt2}}>💡 Os horários vêm preenchidos com o atual, mas podem ser ajustados pra registrar uma falha retroativa (ex: ocorreu de manhã, só deu pra lançar à tarde).</div>

          <div>
            <label style={S.lbl}>Impacto Operacional (pode marcar mais de um)</label>
            <div style={{display:"flex",gap:8}}>
              {[["entrada","↘ Entrada"],["saida","↗ Saída"],["inquilino","🏢 Inquilino"]].map(([k,lb])=>{
                const sel = impactos.includes(k);
                return (
                  <button key={k} onClick={()=>setImpactos(prev=> prev.includes(k) ? prev.filter(x=>x!==k) : [...prev,k])}
                    style={{flex:1,padding:"10px",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer",border:`2px solid ${sel?"#0ea5e9":dark?"#1e293b":"#e2e8f0"}`,background:sel?"#0ea5e922":dark?"#020510":"#fff",color:sel?"#0ea5e9":dark?"#94a3b8":"#64748b"}}>
                    {sel?"✓ ":""}{lb}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label style={S.lbl}>Vigilante Ronda responsável</label>
            <select value={vigilanteRonda?.id||""} onChange={e=>{const c=equipeCompleta.find(x=>String(x.id)===e.target.value);setVigilanteRonda(c?{id:c.id,nome:c.nome}:null);}} style={{...S.inp,cursor:"pointer"}}>
              <option value="">Selecione...</option>
              {equipeCompleta.filter(c=>(c.cargo||"").toLowerCase().includes("ronda")).map(c=>(
                <option key={c.id} value={c.id}>{c.nome}{c.cargo?` — ${c.cargo}`:""}</option>
              ))}
            </select>
            {equipeCompleta.filter(c=>(c.cargo||"").toLowerCase().includes("ronda")).length===0&&(
              <div style={{fontSize:11,color:"#ef4444",marginTop:4}}>Nenhum colaborador com cargo "Vigilante Ronda" cadastrado na Equipe deste projeto.</div>
            )}
          </div>

          <div>
            <label style={S.lbl}>Observação (opcional)</label>
            <textarea value={obs} onChange={e=>setObs(e.target.value)} placeholder="Detalhe curto, se necessário..."
              style={{...S.inp,height:54,resize:"vertical",fontSize:14}}/>
          </div>

          <button onClick={salvar} disabled={!podeSalvar||saving} style={{...S.btn,opacity:(!podeSalvar||saving)?0.5:1,cursor:(!podeSalvar||saving)?"not-allowed":"pointer"}}>
            {saving?"⟳ Salvando...":"✓ Registrar Falha"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PIN gate dos relatórios (gerencial)
function RelatoriosPinGate({ dark, S, onBack, onSuccess }){
  const [pin, setPin] = useState("");
  const [err, setErr] = useState(false);
  const tryPin = () => { if(pin==="601604"){grantSession("demo");onSuccess();return;} if(pin===ADMIN_PIN) onSuccess(); else setErr(true); };
  return (
    <div style={{...S.page,alignItems:"center",justifyContent:"center"}}>
      <div style={{...S.card,maxWidth:320,width:"100%",margin:16,textAlign:"center"}}>
        <div style={{fontSize:32,marginBottom:8}}>📊</div>
        <div style={{fontSize:16,fontWeight:800,...S.txt,marginBottom:4}}>Relatórios Gerenciais</div>
        <div style={{fontSize:12,...S.txt2,marginBottom:20}}>PIN gerencial</div>
        <input type="password" inputMode="numeric" placeholder="PIN" maxLength={8} value={pin}
          onChange={e=>{setPin(e.target.value);setErr(false);}}
          onKeyDown={e=>{if(e.key==="Enter") tryPin();}}
          style={{...S.inp,textAlign:"center",fontSize:22,letterSpacing:10,marginBottom:8}}/>
        {err&&<div role="alert" style={{fontSize:12,color:"#ef4444",marginBottom:8}}>PIN incorreto</div>}
        <div style={{display:"flex",gap:8}}>
          <button onClick={onBack} style={{...S.btnSec,flex:1,fontSize:13}}>← Voltar</button>
          <button onClick={tryPin} style={{...S.btnGreen,flex:1,fontSize:13}}>Entrar</button>
        </div>
      </div>
    </div>
  );
}

// ── Relatórios gerenciais (unitário + consolidado)
function RelatoriosKA({ dark, S, onBack }){
  const [modo, setModo] = useState("unitario"); // unitario | consolidado
  const [projsSel, setProjsSel] = useState([]); // ids selecionados (consolidado) ou [id] (unitário)
  const [dataIni, setDataIni] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [impactoFiltro, setImpactoFiltro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [dadosPorProjeto, setDadosPorProjeto] = useState({}); // {pid: registros[]}
  const [gerado, setGerado] = useState(false);

  const toggleProj = (pid) => {
    if(modo==="unitario"){ setProjsSel([pid]); return; }
    setProjsSel(prev=> prev.includes(pid) ? prev.filter(x=>x!==pid) : [...prev,pid]);
  };
  const selecionarTodos = () => setProjsSel(PROJETOS_KA.map(p=>p.id));

  const gerar = async () => {
    if(projsSel.length===0){ alert("Selecione ao menos um projeto."); return; }
    setCarregando(true);
    const out={};
    for(const pid of projsSel){ out[pid] = await loadFalhas(pid); }
    setDadosPorProjeto(out);
    setGerado(true);
    setCarregando(false);
  };

  const filtrar = (lista) => lista.filter(r=>{
    if(dataIni && r.data < dataIni) return false;
    if(dataFim && r.data > dataFim) return false;
    if(impactoFiltro && !getImpactos(r).includes(impactoFiltro)) return false;
    return true;
  });

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{position:"sticky",top:0,zIndex:10,...S.hdrBg,padding:"14px 16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button onClick={onBack} style={S.backBtn} aria-label="Voltar">← Voltar</button>
            <div style={{flex:1}}>
              <div style={{fontSize:15,fontWeight:800,color:"#ef4444"}}>📊 Relatórios KeyAccess</div>
              <div style={{fontSize:11,...S.txt2}}>Falhas registradas em campo</div>
            </div>
          </div>
        </div>

        <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>{setModo("unitario");setProjsSel([]);setGerado(false);}} style={{...S.btnSm,flex:1,padding:"9px",...(modo==="unitario"?{background:"#ef444422",border:"1px solid #ef444466",color:"#ef4444"}:{})}}>Relatório Unitário</button>
            <button onClick={()=>{setModo("consolidado");setProjsSel([]);setGerado(false);}} style={{...S.btnSm,flex:1,padding:"9px",...(modo==="consolidado"?{background:"#ef444422",border:"1px solid #ef444466",color:"#ef4444"}:{})}}>Consolidado</button>
          </div>

          <div style={S.card}>
            <label style={S.lbl}>{modo==="unitario"?"Projeto":"Projetos (selecione um ou mais)"}</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:modo==="consolidado"?8:0}}>
              {PROJETOS_KA.map(p=>{
                const sel = projsSel.includes(p.id);
                return (
                  <button key={p.id} onClick={()=>toggleProj(p.id)}
                    style={{padding:"6px 12px",borderRadius:7,fontSize:11,fontWeight:700,cursor:"pointer",border:`1px solid ${sel?"#ef4444":dark?"#0f172a":"#e2e8f0"}`,background:sel?"#ef444422":"transparent",color:sel?"#ef4444":dark?"#64748b":"#94a3b8"}}>
                    {p.id}
                  </button>
                );
              })}
            </div>
            {modo==="consolidado"&&<button onClick={selecionarTodos} style={{...S.btnSm,width:"100%"}}>Selecionar Todos</button>}
          </div>

          <div style={S.card}>
            <label style={S.lbl}>Período</label>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
              <input type="date" value={dataIni} onChange={e=>setDataIni(e.target.value)} style={S.inp}/>
              <input type="date" value={dataFim} onChange={e=>setDataFim(e.target.value)} style={S.inp}/>
            </div>
            <label style={S.lbl}>Impacto</label>
            <div style={{display:"flex",gap:6}}>
              {[["","Todos"],["entrada","Entrada"],["saida","Saída"],["inquilino","Inquilino"]].map(([k,lb])=>(
                <button key={k} onClick={()=>setImpactoFiltro(k)}
                  style={{flex:1,padding:"7px",borderRadius:7,fontSize:11,fontWeight:700,cursor:"pointer",border:`1px solid ${impactoFiltro===k?"#0ea5e9":dark?"#0f172a":"#e2e8f0"}`,background:impactoFiltro===k?"#0ea5e922":"transparent",color:impactoFiltro===k?"#0ea5e9":dark?"#64748b":"#94a3b8"}}>
                  {lb}
                </button>
              ))}
            </div>
          </div>

          <button onClick={gerar} disabled={carregando} style={{...S.btnGreen,opacity:carregando?0.6:1}}>
            {carregando?"⟳ Gerando...":"📊 Gerar Relatório"}
          </button>

          {gerado && (
            <button onClick={async ()=>{ await gerarPDFRelatorioKA({modo,projsSel,dadosPorProjeto,dataIni,dataFim,impactoFiltro}); }}
              style={{...S.btnSec,color:"#a855f7",borderColor:"#a855f733"}}>📄 Exportar PDF</button>
          )}

          {gerado && (
            <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:6}}>
              {projsSel.map(pid=>{
                const proj = PROJETOS_KA.find(p=>p.id===pid);
                const lista = filtrar(dadosPorProjeto[pid]||[]).sort((a,b)=>(a.data+a.hora).localeCompare(b.data+b.hora));
                const comIntervalos = calcIntervalos(lista);
                const diasSemFalhaAtual = calcDiasSemFalha(dadosPorProjeto[pid]||[]);
                return (
                  <div key={pid} style={S.card}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                      <div>
                        <div style={{fontSize:13,fontWeight:800,...S.txt}}>{pid} — {proj?.name}</div>
                        <div style={{fontSize:11,...S.txt2}}>{lista.length} falha(s) no período</div>
                      </div>
                      {diasSemFalhaAtual!==null&&(
                        <div style={{textAlign:"center",flexShrink:0}}>
                          <div style={{fontSize:18,fontWeight:900,color:diasSemFalhaAtual>=7?"#22c55e":"#f59e0b"}}>{diasSemFalhaAtual}</div>
                          <div style={{fontSize:8,...S.txt2,fontWeight:700}}>DIAS S/ FALHA</div>
                        </div>
                      )}
                    </div>
                    {comIntervalos.length===0&&<div style={{fontSize:12,...S.txt2,textAlign:"center",padding:"10px 0"}}>Nenhuma falha no período selecionado.</div>}
                    {comIntervalos.map(r=>{
                      const tiposR = getTipos(r);
                      const horaIni = getHoraInicio(r);
                      const dur = calcDuracaoFalha(horaIni, r.horaFim);
                      return (
                        <div key={r.id} style={{borderTop:`1px solid ${dark?"#0f172a":"#f1f5f9"}`,padding:"8px 0"}}>
                          {r.diasDesdeAnterior!==null&&(
                            <div style={{fontSize:10,color:"#22c55e",fontWeight:700,marginBottom:4}}>✅ {r.diasDesdeAnterior} dia(s) sem falha antes deste registro</div>
                          )}
                          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:3}}>
                            {tiposR.map(tk=>{
                              const tag = TAGS_FALHA.find(t=>t.key===tk) || TAG_OUTRO;
                              return <span key={tk} style={{fontSize:10,fontWeight:700,color:tag.cor,background:tag.cor+"22",padding:"2px 7px",borderRadius:5}}>{tk==="outro"?"Outro":tag.label}</span>;
                            })}
                            {getImpactos(r).map(imp=>(
                              <span key={imp} style={{fontSize:10,fontWeight:700,color:"#0ea5e9",background:"#0ea5e922",padding:"2px 7px",borderRadius:5}}>{labelImpacto(imp)}</span>
                            ))}
                          </div>
                          {tiposR.includes("outro")&&r.tipoCustom&&<div style={{fontSize:11,...S.txt}}>{r.tipoCustom}</div>}
                          <div style={{fontSize:10,...S.txt2}}>
                            📅 {fmtDate(r.data)} · ⏱ {horaIni}{r.horaFim?` – ${r.horaFim}`:""}{dur?` (${dur})`:""} · 👤 {r.registradoPor?.nome||"—"}
                          </div>
                          {getResponsavelTexto(r)&&<div style={{fontSize:10,color:"#a855f7",fontWeight:700,marginTop:2}}>{getResponsavelTexto(r)}</div>}
                          {r.obs&&<div style={{fontSize:10,...S.txt2,fontStyle:"italic",marginTop:2}}>{r.obs}</div>}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── PDF do relatório (modelo "Consolidado Executivo", funciona também pra unitário)
// ── CRUZAMENTO GLOBAL: um dia é GERAL só quando TODOS os 8 parques KeyAccess
// registraram falha naquela MESMA DATA (o KeyAccess é plataforma central; se o
// núcleo cai, cai pra todos). Sem janela de hora — basta a data bater em todos.
// Se faltar um parque naquele dia, todas as falhas do dia são LOCAIS.
// O cruzamento é SEMPRE sobre os 8 parques, independente da seleção do relatório.
function calcularDatasGerais(dadosTodos8) {
  const ids = PROJETOS_KA.map(p => p.id);
  const datasPorParque = {};              // { data: Set(pids) }
  ids.forEach(pid => {
    (dadosTodos8[pid] || []).forEach(r => {
      if (!r.data) return;
      (datasPorParque[r.data] = datasPorParque[r.data] || new Set()).add(pid);
    });
  });
  const datasGerais = new Set();
  Object.keys(datasPorParque).forEach(data => {
    if (datasPorParque[data].size >= ids.length) datasGerais.add(data); // TODOS os 8
  });
  return datasGerais;
}

async function gerarPDFRelatorioKA({ modo, projsSel, dadosPorProjeto, dataIni, dataFim, impactoFiltro }){
  const filtrar = (lista) => lista.filter(r=>{
    if(dataIni && r.data < dataIni) return false;
    if(dataFim && r.data > dataFim) return false;
    if(impactoFiltro && !getImpactos(r).includes(impactoFiltro)) return false;
    return true;
  });
  const hoje = new Date().toLocaleDateString("pt-BR");
  const periodoIni = dataIni ? fmtDate(dataIni) : "início dos registros";
  const periodoFim = dataFim ? fmtDate(dataFim) : hoje;

  // Carrega os 8 parques (mesmo os não selecionados) só para o cruzamento global.
  // Reaproveita o que já está em memória; busca o restante via loadFalhas.
  const dadosTodos8 = { ...dadosPorProjeto };
  for(const p of PROJETOS_KA){
    if(!dadosTodos8[p.id]) dadosTodos8[p.id] = await loadFalhas(p.id);
  }
  const datasGerais = calcularDatasGerais(dadosTodos8);
  const isGeral = (r)=> datasGerais.has(r.data);

  // Monta os dados de cada projeto selecionado (lista filtrada, intervalos, minutos, contagem local/geral).
  const dadosProjetos = projsSel.map(pid=>{
    const proj = PROJETOS_KA.find(p=>p.id===pid);
    const listaCompleta = dadosTodos8[pid]||[];
    const lista = filtrar(listaCompleta).sort((a,b)=>(a.data+getHoraInicio(a)).localeCompare(b.data+getHoraInicio(b)));
    const comIntervalos = calcIntervalos(lista);
    const minutosTotais = lista.reduce((acc,r)=> acc + (calcMinutosFalha(getHoraInicio(r), r.horaFim)||0), 0);
    const temPendente = lista.some(r=>!r.horaFim);
    const diasAtual = calcDiasSemFalha(listaCompleta);
    const nGerais = lista.filter(isGeral).length;
    const nLocais = lista.length - nGerais;
    const ultimaData = listaCompleta.map(r=>r.data).filter(Boolean).sort().slice(-1)[0] || null;
    const afetouInquilino = lista.some(r=>getImpactos(r).includes("inquilino"));
    return { pid, proj, lista, comIntervalos, minutosTotais, temPendente, diasAtual, nGerais, nLocais, ultimaData, afetouInquilino };
  });

  // KPIs consolidados
  const totalOcorrencias = dadosProjetos.reduce((a,d)=>a+d.lista.length,0);
  const tempoTotalImpactado = dadosProjetos.reduce((a,d)=>a+d.minutosTotais,0);
  const parquesAfetados = dadosProjetos.filter(d=>d.lista.length>0).length;
  const algumPendente = dadosProjetos.some(d=>d.temPendente);
  const totalGerais = dadosProjetos.reduce((a,d)=>a+d.nGerais,0);
  const totalLocais = dadosProjetos.reduce((a,d)=>a+d.nLocais,0);

  // Eventos GERAIS do sistema, no período visível: datas gerais que caem dentro do filtro.
  const datasGeraisVisiveis = Array.from(datasGerais).filter(data=>{
    if(dataIni && data < dataIni) return false;
    if(dataFim && data > dataFim) return false;
    return true;
  }).sort();
  const blocoGeralHTML = datasGeraisVisiveis.length ? `
    <div class="sysbox">
      <div class="sysbox-h">🌐 Falhas Gerais do Sistema KeyAccess (${datasGeraisVisiveis.length})</div>
      <p class="sysbox-p">Nas datas abaixo, <b>todos os ${PROJETOS_KA.length} parques atendidos pelo KeyAccess registraram falha simultaneamente</b>. Isso caracteriza uma indisponibilidade da plataforma central (não um problema isolado de um parque), impactando toda a operação ao mesmo tempo.</p>
      <ul class="sysbox-list">
        ${datasGeraisVisiveis.map(data=>{
          const parquesNoDia = PROJETOS_KA.filter(p=>(dadosTodos8[p.id]||[]).some(r=>r.data===data)).map(p=>p.id);
          return `<li><b>${fmtDate(data)}</b> — falha simultânea em ${parquesNoDia.length} parques (${parquesNoDia.join(", ")})</li>`;
        }).join("")}
      </ul>
    </div>` : "";

  // Tabela comparativa de impacto por projeto (agora com local/geral).
  const linhasComparacao = dadosProjetos.map(d=>`
    <tr>
      <td><strong>${d.pid}</strong></td>
      <td>${d.proj?.name||""}</td>
      <td style="text-align:center">${d.lista.length}</td>
      <td style="text-align:center;color:#b45309;font-weight:700">${d.nLocais}</td>
      <td style="text-align:center;color:#B21E27;font-weight:700">${d.nGerais}</td>
      <td style="color:${d.minutosTotais>0?"#B21E27":"#16a34a"};font-weight:700">${d.minutosTotais>0?d.minutosTotais+" min":"Sem impacto"}</td>
      <td style="text-align:center;font-weight:700;color:${d.diasAtual!=null&&d.diasAtual>=7?"#16a34a":"#b45309"}">${d.diasAtual!=null?d.diasAtual:"—"}</td>
    </tr>`).join("");

  const corImpacto = (imp)=> imp==="entrada" ? "#2563eb" : imp==="saida" ? "#B21E27" : "#7c3aed";

  // Blocos individuais por projeto (com narrativa + selos local/geral).
  const blocos = dadosProjetos.map(d=>{
    // Narrativa executiva do parque.
    let narrativa;
    if(!d.lista.length){
      narrativa = `No período de ${periodoIni} a ${periodoFim}, <b>${d.pid} — ${d.proj?.name||""}</b> não registrou nenhuma falha do sistema KeyAccess.`;
    } else {
      const partes = [];
      partes.push(`No período de ${periodoIni} a ${periodoFim}, <b>${d.pid} — ${d.proj?.name||""}</b> registrou <b>${d.lista.length} ocorrência(s)</b>`);
      const compo = [];
      if(d.nLocais) compo.push(`${d.nLocais} local(is)`);
      if(d.nGerais) compo.push(`${d.nGerais} geral(is) do sistema`);
      if(compo.length) partes.push(` (${compo.join(" e ")})`);
      if(d.minutosTotais>0) partes.push(`, com impacto operacional acumulado de <b>${d.minutosTotais} minutos</b>`);
      partes.push(`.`);
      if(d.afetouInquilino) partes.push(` Ao menos uma ocorrência afetou o fluxo de inquilinos.`);
      if(d.diasAtual!=null && d.ultimaData){
        partes.push(` Desde a última ocorrência em <b>${fmtDate(d.ultimaData)}</b>, o parque está há <b>${d.diasAtual} dia(s) sem registro de falha</b>.`);
      }
      narrativa = partes.join("");
    }

    const rows = d.comIntervalos.map(r=>{
      const geral = isGeral(r);
      const tiposR = getTipos(r);
      const tagsTxt = tiposR.length
        ? tiposR.map(tk=>{ const tag=TAGS_FALHA.find(t=>t.key===tk)||TAG_OUTRO; return tk==="outro"?(r.tipoCustom||"Outro"):tag.label; }).join("; ")
        : "Não informado";
      const horaIni = getHoraInicio(r);
      const minutos = calcMinutosFalha(horaIni, r.horaFim);
      const tratativa = r.horaFim
        ? `Voltou a funcionar às ${r.horaFim}${minutos?` (Duração: ${minutos} min)`:""}.${r.obs?" "+r.obs:""}`
        : (r.obs ? r.obs : "Não informado");
      const respTxt = getResponsavelTexto(r);
      const impactosBadges = getImpactos(r).length
        ? getImpactos(r).map(imp=>`<span class="imp" style="background:${corImpacto(imp)}">${imp==="entrada"?"ENTRADA":imp==="saida"?"SAÍDA":"INQUILINO"}</span>`).join("")
        : "<span style='color:#94a3b8'>--</span>";
      const selo = geral
        ? `<span class="selo selo-g">🌐 GERAL</span>`
        : `<span class="selo selo-l">📍 LOCAL</span>`;
      return `<tr class="${geral?"row-geral":""}">
        <td style="white-space:nowrap"><strong>${fmtDate(r.data)}</strong><br><span style="color:#64748b">${horaIni||"--"}</span></td>
        <td>${selo}</td>
        <td>${tagsTxt}</td>
        <td>${impactosBadges}</td>
        <td>${r.registradoPor?.nome||"Não informado"}</td>
        <td style="font-size:10px">${[respTxt,tratativa].filter(Boolean).join(" — ")}</td>
      </tr>`;
    }).join("");

    return `<div class="card">
      <div class="card-title">
        <span>${d.pid} — ${d.proj?.name||""}</span>
        <span class="badge-dias">${d.diasAtual!=null?d.diasAtual+" dia(s) sem falha":"Sem registros"}</span>
      </div>
      <p class="narr">${narrativa}</p>
      ${d.lista.length?`<table><thead><tr><th>Data / Hora</th><th>Classif.</th><th>Tipo de Falha</th><th>Impacto</th><th>Registrado por</th><th>Observação / Tratativa</th></tr></thead>
      <tbody>${rows}</tbody></table>`:""}
    </div>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>Análise KeyAccess — ${hoje}</title>
<style>
  @page { size:A4; margin:16mm 13mm; }
  @page { @bottom-right { content:"Página " counter(page); font-size:9px; color:#94a3b8; } }
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:#121212;font-size:12px;padding:18px}
  .hdr{display:flex;align-items:center;gap:16px;border-bottom:3px solid #B21E27;padding-bottom:14px;margin-bottom:16px}
  .hdr .logo{width:54px;height:54px;flex:none}
  .hdr .brand{font-size:11px;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:.7px}
  .hdr .title{font-size:20px;font-weight:900;color:#121212;line-height:1.15;margin-top:2px}
  .hdr .sub{font-size:12px;color:#B21E27;font-weight:700;margin-top:2px}
  .meta{font-size:11px;color:#475569;margin-bottom:16px}
  .explica{background:#faf7f7;border:1px solid #e7d9d9;border-left:4px solid #B21E27;border-radius:8px;padding:13px 16px;margin-bottom:18px;page-break-inside:avoid}
  .explica h3{font-size:12px;color:#B21E27;text-transform:uppercase;letter-spacing:.4px;margin-bottom:7px}
  .explica p{font-size:10.8px;line-height:1.6;color:#3a3a3a;margin-bottom:5px}
  .explica b{color:#121212}
  .kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:9px;margin-bottom:18px;page-break-inside:avoid}
  .kpi{border:1px solid #e2e8f0;border-radius:9px;padding:11px 6px;text-align:center}
  .kpi .lbl{font-size:8px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.3px;margin-bottom:5px}
  .kpi .val{font-size:19px;font-weight:900;color:#121212}
  .kpi.danger .val{color:#B21E27}
  .kpi.warn .val{color:#b45309}
  .kpi.ok .val{color:#16a34a;font-size:14px}
  .sysbox{background:#fff5f5;border:1.5px solid #B21E27;border-radius:9px;padding:14px 16px;margin-bottom:20px;page-break-inside:avoid}
  .sysbox-h{font-size:13px;font-weight:900;color:#B21E27;margin-bottom:8px}
  .sysbox-p{font-size:10.8px;line-height:1.6;color:#3a3a3a;margin-bottom:8px}
  .sysbox-list{list-style:none;font-size:11px;color:#121212}
  .sysbox-list li{padding:4px 0;border-bottom:1px dashed #e7d9d9}
  .sysbox-list li:last-child{border-bottom:none}
  .comparativo{border:1px solid #e2e8f0;border-radius:9px;padding:15px;margin-bottom:22px;page-break-inside:avoid}
  .comparativo h2{font-size:12.5px;color:#334155;margin-bottom:10px;text-transform:uppercase;letter-spacing:.3px}
  .card{border:1px solid #e2e8f0;border-radius:9px;padding:14px;margin-bottom:16px;page-break-inside:avoid}
  .card-title{display:flex;justify-content:space-between;align-items:baseline;gap:10px;font-size:14px;font-weight:900;color:#121212;border-bottom:2px solid #B21E27;padding-bottom:8px;margin-bottom:9px}
  .badge-dias{font-size:9.5px;color:#64748b;font-weight:700;white-space:nowrap}
  .narr{font-size:11px;line-height:1.6;color:#3a3a3a;margin-bottom:11px;background:#f8fafc;border-radius:7px;padding:9px 12px}
  .narr b{color:#121212}
  table{width:100%;border-collapse:collapse;font-size:10.5px}
  th{background:#121212;color:#fff;padding:7px 8px;text-align:left;font-size:8.5px;text-transform:uppercase;letter-spacing:.2px}
  td{padding:7px 8px;border-bottom:1px solid #f1f5f9;vertical-align:top}
  tr:nth-child(even) td{background:#f8fafc}
  tr.row-geral td{background:#fff5f5}
  .selo{display:inline-block;font-size:8.5px;font-weight:800;padding:2px 7px;border-radius:12px;white-space:nowrap}
  .selo-g{background:#B21E27;color:#fff}
  .selo-l{background:#fef3c7;color:#b45309;border:1px solid #fcd9a1}
  .imp{display:inline-block;color:#fff;font-size:9px;font-weight:700;padding:2px 7px;border-radius:5px;margin:1px 2px 1px 0;white-space:nowrap}
  .footer{text-align:center;margin-top:20px;font-size:9px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px}
  .no-print{text-align:center;margin-bottom:16px}
  @media print{.no-print{display:none}body{padding:0}}
</style></head>
<body>
<div class="no-print">
  <button onclick="window.print()" style="background:#B21E27;color:#fff;border:none;border-radius:8px;padding:10px 28px;font-size:14px;font-weight:700;cursor:pointer">🖨️ Imprimir / Salvar PDF</button>
</div>

<div class="hdr">
  ${MOKED_LOGO_SVG}
  <div>
    <div class="brand">Moked Consulting Security</div>
    <div class="title">Análise KeyAccess</div>
    <div class="sub">Relatório ${modo==="unitario"?"Individual":"Consolidado"} de Falhas de Acesso</div>
  </div>
</div>
<div class="meta">Período de auditoria: <b>${periodoIni}</b> até <b>${periodoFim}</b> &nbsp;|&nbsp; Gerado em: ${hoje} &nbsp;|&nbsp; Parques no relatório: ${dadosProjetos.length}</div>

<div class="explica">
  <h3>Como ler este relatório</h3>
  <p><b>📍 Falha LOCAL</b> — ocorrência registrada em um único parque (ou em parte deles). Afeta apenas aquela unidade e pode ter causa local: manutenção, obra, queda de internet do parque, energia, etc. Zera o contador de "dias sem falha" somente daquele parque.</p>
  <p><b>🌐 Falha GERAL do sistema</b> — ocorrência registrada por <b>todos os ${PROJETOS_KA.length} parques atendidos pelo KeyAccess na mesma data</b>. Como o KeyAccess é uma plataforma central (nuvem), quando o núcleo fica indisponível a falha atinge toda a operação simultaneamente. Este é o indicador de indisponibilidade da plataforma.</p>
  <p style="margin-top:7px">É por isso que os <b>"dias sem falha" variam entre os parques</b>: uma falha local afeta apenas o contador de uma unidade, enquanto os demais seguem contando normalmente. Quanto maior o número de dias, melhor a estabilidade daquele parque.</p>
</div>

<div class="kpis">
  <div class="kpi danger"><div class="lbl">Total de Ocorrências</div><div class="val">${totalOcorrencias}</div></div>
  <div class="kpi warn"><div class="lbl">Falhas Locais</div><div class="val">${totalLocais}</div></div>
  <div class="kpi danger"><div class="lbl">Falhas Gerais</div><div class="val">${totalGerais}</div></div>
  <div class="kpi danger"><div class="lbl">Tempo Impactado</div><div class="val">${tempoTotalImpactado}<span style="font-size:11px"> min</span></div></div>
  <div class="kpi ${algumPendente?"danger":"ok"}"><div class="lbl">Status Atual</div><div class="val">${algumPendente?"Pendente":"100% Online"}</div></div>
</div>

${blocoGeralHTML}

<div class="comparativo">
  <h2>Métricas de Inoperabilidade por Parque</h2>
  <table><thead><tr><th>Projeto</th><th>Planta Operacional</th><th style="text-align:center">Ocorr.</th><th style="text-align:center">Locais</th><th style="text-align:center">Gerais</th><th>Tempo Impactado</th><th style="text-align:center">Dias s/ Falha</th></tr></thead>
  <tbody>${linhasComparacao}</tbody></table>
</div>

${blocos}

<div class="footer">MokLog CheckTest © Moked Consulting Security · Análise Técnica de Falhas KeyAccess · Classificação Local/Geral por cruzamento dos ${PROJETOS_KA.length} parques</div>
</body></html>`;

  const blob = new Blob([html],{type:"text/html"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href=url; a.download=`analise_keyaccess_${modo}_${hoje.replace(/\//g,"-")}.html`; a.click();
  URL.revokeObjectURL(url);
}

export const _internal = { calcDiasSemFalha, calcIntervalos, diffDias, calcDuracaoFalha, calcMinutosFalha, getTipos, getImpactos };

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
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

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

const ADMIN_PIN = "872101";
const COL = "keyaccess_falhas";

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
];
const TAG_OUTRO = { key:"outro", label:"✏️ Editar Falha (digitar)", cor:"#818cf8" };

function todayStr(){ return new Date().toISOString().split("T")[0]; }
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
    btnSec:  { background:dark?"#060c18":"#f8fafc", color:dark?"#64748b":"#475569", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, borderRadius:10, padding:"13px 16px", fontSize:14, fontWeight:600, cursor:"pointer", width:"100%", display:"flex", alignItems:"center", justifyContent:"center" },
    btnSm:   { background:dark?"#020510":"#f8fafc", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, color:dark?"#64748b":"#475569", borderRadius:6, padding:"5px 10px", fontSize:11, cursor:"pointer", fontWeight:600 },
    backBtn: { background:"transparent", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, color:dark?"#94a3b8":"#64748b", borderRadius:7, padding:"7px 12px", fontSize:12, cursor:"pointer", flexShrink:0, fontWeight:600 },
    inp:     { width:"100%", background:dark?"#020510":"#ffffff", border:`1px solid ${dark?"#0f172a":"#cbd5e1"}`, borderRadius:7, color:dark?"#e2e8f0":"#1e293b", padding:"10px 12px", fontSize:13, boxSizing:"border-box", outline:"none" },
    lbl:     { display:"block", fontSize:10, color:dark?"#475569":"#64748b", fontWeight:700, marginBottom:4, textTransform:"uppercase", letterSpacing:.5 },
    hdrBg:   { background:dark?"#1a0202":"#fef2f2", borderBottom:`1px solid ${dark?"#3a0a0a":"#fecaca"}` },
    txt:     { color:dark?"#f1f5f9":"#0f172a" },
    txt2:    { color:dark?"#94a3b8":"#64748b" },
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
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const abrirProjeto = async (p) => {
    setProject(p);
    setLoading(true);
    const [f, eq] = await Promise.all([loadFalhas(p.id), loadEquipe(p.id)]);
    setRegistros(f);
    setEquipe(eq);
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
          {PROJETOS_KA.map(p=>(
            <button key={p.id} onClick={()=>abrirProjeto(p)}
              style={{...S.card,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:12,border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`}}>
              <div style={{width:40,height:40,borderRadius:10,background:dark?"#1a0202":"#fef2f2",border:"1px solid #ef444433",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:18}}>🚨</div>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:800,...S.txt}}>{p.id}</div>
                <div style={{fontSize:11,...S.txt2}}>{p.name}</div>
              </div>
              <span style={{...S.txt2,fontSize:16}}>›</span>
            </button>
          ))}
          <button onClick={()=>setScreen("relatorios_pin")} style={{...S.btnSec,marginTop:10,color:"#a855f7",borderColor:"#a855f733"}}>📊 Relatórios Gerenciais</button>
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
                  const tag = TAGS_FALHA.find(t=>t.key===r.tipo) || TAG_OUTRO;
                  return (
                    <div key={r.id} style={{...S.card,padding:"10px 12px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                        <span style={{fontSize:10,fontWeight:700,color:tag.cor,background:tag.cor+"22",padding:"2px 8px",borderRadius:6}}>{r.tipo==="outro"?"Outro":tag.label}</span>
                        {r.impacto&&<span style={{fontSize:10,fontWeight:700,color:"#0ea5e9",background:"#0ea5e922",padding:"2px 8px",borderRadius:6}}>{r.impacto==="entrada"?"↘ Entrada":"↗ Saída"}</span>}
                      </div>
                      {r.tipo==="outro"&&r.tipoCustom&&<div style={{fontSize:12,...S.txt,marginBottom:3}}>{r.tipoCustom}</div>}
                      <div style={{fontSize:11,...S.txt2}}>📅 {fmtDate(r.data)} · {r.hora} · 👤 {r.registradoPor?.nome||"—"}</div>
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
    <FormularioFalha project={project} equipe={equipe} dark={dark} S={S}
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
      onSuccess={()=>setScreen("relatorios")}/>
  );

  if(screen==="relatorios") return (
    <RelatoriosKA dark={dark} S={S} onBack={()=>setScreen("projetos")}/>
  );

  return null;
}

// ── Formulário de registro de falha
function FormularioFalha({ project, equipe, dark, S, onVoltar, onSalvo, saving }){
  const [registradoPor, setRegistradoPor] = useState(()=>{
    try{ const l=localStorage.getItem(`ka_last_user_${project.id}`); if(l) return JSON.parse(l); }catch(e){}
    return null;
  });
  const [tipo, setTipo] = useState("");
  const [tipoCustom, setTipoCustom] = useState("");
  const [data, setData] = useState(todayStr());
  const [hora, setHora] = useState(nowHM());
  const [impacto, setImpacto] = useState("");
  const [obs, setObs] = useState("");

  const podeSalvar = registradoPor && tipo && (tipo!=="outro"||tipoCustom.trim());

  const salvar = () => {
    if(!registradoPor){ alert("Selecione quem está registrando."); return; }
    if(!tipo){ alert("Selecione o tipo de falha."); return; }
    if(tipo==="outro"&&!tipoCustom.trim()){ alert("Descreva a falha."); return; }
    try{ localStorage.setItem(`ka_last_user_${project.id}`, JSON.stringify(registradoPor)); }catch(e){}
    onSalvo({
      id: Date.now().toString()+Math.random().toString(36).substring(2,5),
      data, hora, tipo, tipoCustom: tipo==="outro"?tipoCustom.trim():"",
      impacto, obs: obs.trim(),
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
            <label style={S.lbl}>Tipo de Falha *</label>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {[...TAGS_FALHA, TAG_OUTRO].map(t=>{
                const sel = tipo===t.key;
                return (
                  <button key={t.key} onClick={()=>setTipo(t.key)}
                    style={{textAlign:"left",background:sel?t.cor+"22":dark?"#020510":"#fff",border:`2px solid ${sel?t.cor:dark?"#0f172a":"#e2e8f0"}`,borderRadius:9,padding:"11px 14px",cursor:"pointer",fontSize:13,fontWeight:sel?700:500,color:sel?t.cor:dark?"#cbd5e1":"#475569"}}>
                    {t.label}
                  </button>
                );
              })}
            </div>
            {tipo==="outro"&&(
              <textarea value={tipoCustom} onChange={e=>setTipoCustom(e.target.value)} placeholder="Descreva a falha..."
                style={{...S.inp,height:60,resize:"vertical",fontSize:13,marginTop:8}}/>
            )}
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div>
              <label style={S.lbl}>Data</label>
              <input type="date" value={data} onChange={e=>setData(e.target.value)} style={S.inp}/>
            </div>
            <div>
              <label style={S.lbl}>Hora</label>
              <input type="time" value={hora} onChange={e=>setHora(e.target.value)} style={S.inp}/>
            </div>
          </div>
          <div style={{fontSize:10,...S.txt2}}>💡 Preenchido com a hora atual, mas pode ajustar pra registrar uma falha de outro horário.</div>

          <div>
            <label style={S.lbl}>Impacto Operacional</label>
            <div style={{display:"flex",gap:8}}>
              {[["entrada","↘ Impacto na Entrada"],["saida","↗ Impacto na Saída"]].map(([k,lb])=>(
                <button key={k} onClick={()=>setImpacto(impacto===k?"":k)}
                  style={{flex:1,padding:"10px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",border:`2px solid ${impacto===k?"#0ea5e9":dark?"#0f172a":"#e2e8f0"}`,background:impacto===k?"#0ea5e922":dark?"#020510":"#fff",color:impacto===k?"#0ea5e9":dark?"#64748b":"#94a3b8"}}>
                  {lb}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={S.lbl}>Observação (opcional)</label>
            <textarea value={obs} onChange={e=>setObs(e.target.value)} placeholder="Detalhe curto, se necessário..."
              style={{...S.inp,height:54,resize:"vertical",fontSize:13}}/>
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
  const tryPin = () => { if(pin===ADMIN_PIN) onSuccess(); else setErr(true); };
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
    if(impactoFiltro && r.impacto !== impactoFiltro) return false;
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
              {[["","Todos"],["entrada","Entrada"],["saida","Saída"]].map(([k,lb])=>(
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
                      const tag = TAGS_FALHA.find(t=>t.key===r.tipo) || TAG_OUTRO;
                      return (
                        <div key={r.id} style={{borderTop:`1px solid ${dark?"#0f172a":"#f1f5f9"}`,padding:"8px 0"}}>
                          {r.diasDesdeAnterior!==null&&(
                            <div style={{fontSize:10,color:"#22c55e",fontWeight:700,marginBottom:4}}>✅ {r.diasDesdeAnterior} dia(s) sem falha antes deste registro</div>
                          )}
                          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:3}}>
                            <span style={{fontSize:10,fontWeight:700,color:tag.cor,background:tag.cor+"22",padding:"2px 7px",borderRadius:5}}>{r.tipo==="outro"?"Outro":tag.label}</span>
                            {r.impacto&&<span style={{fontSize:10,fontWeight:700,color:"#0ea5e9",background:"#0ea5e922",padding:"2px 7px",borderRadius:5}}>{r.impacto==="entrada"?"Entrada":"Saída"}</span>}
                          </div>
                          {r.tipo==="outro"&&r.tipoCustom&&<div style={{fontSize:11,...S.txt}}>{r.tipoCustom}</div>}
                          <div style={{fontSize:10,...S.txt2}}>📅 {fmtDate(r.data)} · {r.hora} · 👤 {r.registradoPor?.nome||"—"}</div>
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

export const _internal = { calcDiasSemFalha, calcIntervalos, diffDias };

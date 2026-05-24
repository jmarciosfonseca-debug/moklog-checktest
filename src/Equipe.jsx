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
const MAX_DESLIGADOS = 10;

// Cargos por projeto
const CARGOS_PROJETO = {
  P601: ["VSPP Líder","VSPP Apoio","Vig CCO","CDA","Recepção"],
  P602: ["VSPP Líder","VSPP Apoio","Vig CCO","CDA","Recepção"],
  P604: ["VSPP Líder","VSPP Apoio","Vig CCO","CDA","Recepção"],
  P605: ["VSPP Líder","VSPP Apoio","Vig CCO","CDA","Recepção"],
  P505: ["VSPP Líder","VSPP Apoio","Vig CCO","CDA","Recepção"],
  P260A:["VSPP Líder","VSPP Apoio","Vig CCO"],
  P311A:["Vigilante Líder","Vigilante Apoio","Vigilante Ronda","Porteiro CCO"],
  P311B:["Vigilante Líder","Vigilante Apoio","Vigilante Ronda","Vig CCO"],
  P606: ["Vigilante Líder","Vigilante Apoio","Vig CCO"],
  P607: ["Vigilante Ronda","Vigilante Apoio","AGP","AGP CCO"],
};

function todayStr() { return new Date().toISOString().split("T")[0]; }
function fmtDate(d) {
  if(!d) return "--";
  try { return new Date(d+"T12:00:00").toLocaleDateString("pt-BR"); } catch { return d; }
}

async function loadEquipe(projectId) {
  try {
    const snap = await getDoc(doc(db,"equipes",projectId));
    if(snap.exists()) return snap.data();
  } catch(e) {}
  // Fallback to localStorage
  try {
    const local = localStorage.getItem(`equipe_${projectId}`);
    if(local) return JSON.parse(local);
  } catch(e) {}
  return { colaboradores: [], desligados: [] };
}

async function saveEquipe(projectId, data) {
  try {
    await setDoc(doc(db,"equipes",projectId), data);
  } catch(e) { console.error(e); }
  try {
    localStorage.setItem(`equipe_${projectId}`, JSON.stringify(data));
  } catch(e) {}
}

const S = {
  page:{minHeight:"100vh",background:"#04080f",display:"flex",justifyContent:"center",padding:"0 0 60px",fontFamily:"'Segoe UI',system-ui,sans-serif"},
  wrap:{width:"100%",maxWidth:480,padding:"16px 14px 40px",display:"flex",flexDirection:"column",gap:8},
  card:{background:"#060c18",border:"1px solid #0f172a",borderRadius:12,padding:"12px 14px"},
  btn:{background:"linear-gradient(135deg,#1d4ed8,#1e40af)",color:"#fff",border:"none",borderRadius:10,padding:"12px 16px",fontSize:14,fontWeight:700,cursor:"pointer",width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:6},
  btnSec:{background:"#060c18",color:"#64748b",border:"1px solid #0f172a",borderRadius:10,padding:"12px 16px",fontSize:14,fontWeight:600,cursor:"pointer",width:"100%",display:"flex",alignItems:"center",justifyContent:"center"},
  btnSm:{background:"#020510",border:"1px solid #0f172a",color:"#64748b",borderRadius:6,padding:"5px 10px",fontSize:11,cursor:"pointer",fontWeight:600},
  backBtn:{background:"transparent",border:"1px solid #0f172a",color:"#334155",borderRadius:7,padding:"6px 10px",fontSize:11,cursor:"pointer",flexShrink:0},
  inp:{width:"100%",background:"#020510",border:"1px solid #0f172a",borderRadius:7,color:"#e2e8f0",padding:"9px 11px",fontSize:13,boxSizing:"border-box",outline:"none"},
  lbl:{display:"block",fontSize:10,color:"#334155",fontWeight:700,marginBottom:3,textTransform:"uppercase",letterSpacing:.5},
};

function emptyColab(cargo, projectId) {
  return {
    id: Date.now().toString(),
    cargo, projectId,
    nome:"", telefone:"", dataContratacao:"",
    ultimaReciclagem:"", foto:"",
    escala:"12x36", turno:"Diurno",
    status:"ativo",
    historico:[],
    criadoEm: new Date().toISOString()
  };
}

export default function EquipeApp({ project, onBack }) {
  const [equipeData, setEquipeData] = useState({ colaboradores:[], desligados:[] });
  const [screen, setScreen] = useState("list"); // list | view | add | edit | addHist
  const [selColab, setSelColab] = useState(null);
  const [form, setForm] = useState(null);
  const [histForm, setHistForm] = useState({ tipo:"Falta", data:todayStr(), detalhe:"" });
  const [adminPin, setAdminPin] = useState("");
  const [adminAuth, setAdminAuth] = useState(false);
  const [adminErr, setAdminErr] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showDesligados, setShowDesligados] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const cargos = CARGOS_PROJETO[project.id] || ["Colaborador"];

  useEffect(() => {
    loadEquipe(project.id).then(data => {
      setEquipeData(data || { colaboradores:[], desligados:[] });
      setLoading(false);
    });
  }, [project.id]);

  const save = async (newData) => {
    setSaving(true);
    setEquipeData(newData);
    await saveEquipe(project.id, newData);
    setSaving(false);
  };

  const setF = (k,v) => setForm(f=>({...f,[k]:v}));

  const handleFoto = (e) => {
    const file = e.target.files?.[0]; if(!file) return;
    if(file.size > 3*1024*1024) { alert("Foto muito grande. Max 3MB"); return; }
    const r = new FileReader();
    r.onload = ev => setF("foto", ev.target.result);
    r.readAsDataURL(file);
  };

  const saveColab = async () => {
    if(!form.nome.trim()) { alert("Informe o nome"); return; }
    if(!form.foto) { alert("Foto obrigatória"); return; }
    setSaving(true);
    const isNew = !equipeData.colaboradores.find(c=>c.id===form.id);
    const newColabs = isNew
      ? [...equipeData.colaboradores, form]
      : equipeData.colaboradores.map(c=>c.id===form.id?form:c);
    await save({...equipeData, colaboradores:newColabs});
    setSaving(false);
    setScreen("list");
    setForm(null);
  };

  const addHistorico = async () => {
    if(!histForm.data) { alert("Informe a data"); return; }
    if(histForm.tipo==="Medida Disciplinar" && !histForm.detalhe) { alert("Especifique o tipo de medida"); return; }
    const item = { ...histForm, id:Date.now().toString(), registradoEm:new Date().toISOString() };
    const newColabs = equipeData.colaboradores.map(c=>{
      if(c.id!==selColab.id) return c;
      return {...c, historico:[...(c.historico||[]), item]};
    });
    const updated = {...equipeData, colaboradores:newColabs};
    await save(updated);
    setSelColab(newColabs.find(c=>c.id===selColab.id));
    setHistForm({tipo:"Falta",data:todayStr(),detalhe:""});
    setScreen("view");
  };

  const removeHist = async (colabId, histId) => {
    if(!adminAuth) return;
    const newColabs = equipeData.colaboradores.map(c=>{
      if(c.id!==colabId) return c;
      return {...c, historico:(c.historico||[]).filter(h=>h.id!==histId)};
    });
    const updated = {...equipeData, colaboradores:newColabs};
    await save(updated);
    setSelColab(newColabs.find(c=>c.id===colabId));
  };

  const desligarColab = async (colab) => {
    if(!adminAuth) return;
    const desligado = {...colab, status:"desligado", desligadoEm:todayStr(),
      historico:(colab.historico||[]).slice(-MAX_DESLIGADOS)};
    const newColabs = equipeData.colaboradores.filter(c=>c.id!==colab.id);
    const newDesligados = [desligado, ...(equipeData.desligados||[])].slice(0,MAX_DESLIGADOS*5);
    await save({...equipeData, colaboradores:newColabs, desligados:newDesligados});
    setScreen("list");
    setSelColab(null);
  };

  const reativarColab = async (colab) => {
    if(!adminAuth) return;
    const reativado = {...colab, status:"ativo", desligadoEm:null};
    const newDesligados = (equipeData.desligados||[]).filter(c=>c.id!==colab.id);
    const newColabs = [...equipeData.colaboradores, reativado];
    await save({...equipeData, colaboradores:newColabs, desligados:newDesligados});
  };

  const histColor = (tipo) => tipo==="Falta"?"#ef4444":tipo==="FT"?"#f59e0b":"#7c3aed";
  const histBg = (tipo) => tipo==="Falta"?"#fef2f2":tipo==="FT"?"#fffbeb":"#f5f3ff";

  if(loading) return (
    <div style={{...S.page,alignItems:"center",justifyContent:"center"}}>
      <div style={{fontSize:14,color:"#64748b"}}>Carregando equipe...</div>
    </div>
  );

  // ── ADD/EDIT COLAB (admin only) ──
  if((screen==="add"||screen==="edit")&&form&&adminAuth) return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{display:"flex",alignItems:"center",gap:8,paddingBottom:10,borderBottom:"1px solid #0f172a"}}>
          <button onClick={()=>{setScreen("list");setForm(null);}} style={S.backBtn}>← Voltar</button>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:800,color:"#f1f5f9"}}>{screen==="add"?"Novo Colaborador":"Editar Colaborador"}</div>
            <div style={{fontSize:11,color:"#334155"}}>{project.id} · {form.cargo}</div>
          </div>
        </div>

        {/* Foto */}
        <div style={{...S.card,display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:72,height:72,borderRadius:10,overflow:"hidden",border:"2px solid #0f172a",flexShrink:0,background:"#020510",display:"flex",alignItems:"center",justifyContent:"center"}}>
            {form.foto?<img src={form.foto} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:28}}>👤</span>}
          </div>
          <label style={{flex:1,cursor:"pointer"}}>
            <div style={{fontSize:12,fontWeight:700,color:"#0ea5e9",marginBottom:2}}>📷 {form.foto?"Trocar foto":"Adicionar foto *"}</div>
            <div style={{fontSize:10,color:"#64748b"}}>Obrigatória · Max 3MB</div>
            <input type="file" accept="image/*" style={{position:"absolute",opacity:0,width:0,height:0}} onChange={handleFoto}/>
          </label>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            <button onClick={()=>setF("status","ativo")} style={{...S.btnSm,color:form.status==="ativo"?"#22c55e":"#334155",border:`1px solid ${form.status==="ativo"?"#22c55e44":"#0f172a"}`}}>🟢 Ativo</button>
            <button onClick={()=>setF("status","desligado")} style={{...S.btnSm,color:form.status==="desligado"?"#ef4444":"#334155",border:`1px solid ${form.status==="desligado"?"#ef444444":"#0f172a"}`}}>🔴 Deslig.</button>
          </div>
        </div>

        <div style={S.card}>
          <div style={{marginBottom:8}}><label style={S.lbl}>Nome Completo *</label><input value={form.nome} onChange={e=>setF("nome",e.target.value)} placeholder="Nome do colaborador..." style={S.inp}/></div>
          <div style={{marginBottom:8}}><label style={S.lbl}>Telefone</label><input value={form.telefone} onChange={e=>setF("telefone",e.target.value)} placeholder="(00) 00000-0000" style={S.inp}/></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <div><label style={S.lbl}>Contratação no Posto</label><input type="date" value={form.dataContratacao} onChange={e=>setF("dataContratacao",e.target.value)} style={S.inp}/></div>
            <div><label style={S.lbl}>Última Reciclagem</label><input type="date" value={form.ultimaReciclagem} onChange={e=>setF("ultimaReciclagem",e.target.value)} style={S.inp}/></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
            <div>
              <label style={S.lbl}>Escala</label>
              <select value={form.escala||"12x36"} onChange={e=>setF("escala",e.target.value)} style={{...S.inp,cursor:"pointer"}}>
                <option>12x36</option>
                <option>4x2</option>
                <option>5x2</option>
                <option>Outros</option>
              </select>
            </div>
            <div>
              <label style={S.lbl}>Turno</label>
              <select value={form.turno||"Diurno"} onChange={e=>setF("turno",e.target.value)} style={{...S.inp,cursor:"pointer"}}>
                <option>Diurno</option>
                <option>Noturno</option>
                <option value="Diurno/Noturno">Diurno/Noturno</option>
              </select>
            </div>
          </div>
        </div>

        <button onClick={saveColab} disabled={saving} style={{...S.btn,opacity:saving?.7:1}}>
          {saving?"⟳ Salvando...":"✓ Salvar Colaborador"}
        </button>
        <button onClick={()=>{setScreen("list");setForm(null);}} style={S.btnSec}>Cancelar</button>
      </div>
    </div>
  );

  // ── ADD HISTORICO ──
  if(screen==="addHist"&&selColab) return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{display:"flex",alignItems:"center",gap:8,paddingBottom:10,borderBottom:"1px solid #0f172a"}}>
          <button onClick={()=>setScreen("view")} style={S.backBtn}>← Voltar</button>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:800,color:"#f1f5f9"}}>Adicionar Registro</div>
            <div style={{fontSize:11,color:"#334155"}}>{selColab.nome}</div>
          </div>
        </div>

        <div style={S.card}>
          <div style={{fontSize:11,color:"#0ea5e9",fontWeight:700,marginBottom:10}}>Tipo de Registro</div>
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            {["Falta","FT","Medida Disciplinar"].map(tipo=>(
              <button key={tipo} onClick={()=>setHistForm(h=>({...h,tipo,detalhe:""}))}
                style={{...S.btnSm,flex:1,padding:"8px 4px",color:histForm.tipo===tipo?histColor(tipo):"#475569",
                  border:`1px solid ${histForm.tipo===tipo?histColor(tipo)+"44":"#0f172a"}`,
                  background:histForm.tipo===tipo?histColor(tipo)+"11":"#020510",fontSize:10}}>
                {tipo}
              </button>
            ))}
          </div>
          <div style={{marginBottom:8}}>
            <label style={S.lbl}>Data</label>
            <input type="date" value={histForm.data} onChange={e=>setHistForm(h=>({...h,data:e.target.value}))} style={S.inp}/>
          </div>
          {histForm.tipo==="Medida Disciplinar"&&(
            <div style={{marginBottom:8}}>
              <label style={S.lbl}>Tipo de Medida</label>
              <div style={{display:"flex",gap:8}}>
                {["Advertência","Suspensão"].map(d=>(
                  <button key={d} onClick={()=>setHistForm(h=>({...h,detalhe:d}))}
                    style={{...S.btnSm,flex:1,padding:"8px",color:histForm.detalhe===d?"#7c3aed":"#475569",
                      border:`1px solid ${histForm.detalhe===d?"#7c3aed44":"#0f172a"}`,
                      background:histForm.detalhe===d?"#7c3aed11":"#020510"}}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <button onClick={addHistorico} style={S.btn}>✓ Adicionar Registro</button>
        <button onClick={()=>setScreen("view")} style={S.btnSec}>Cancelar</button>
      </div>
    </div>
  );

  // ── VIEW COLAB ──
  if(screen==="view"&&selColab) {
    const colab = equipeData.colaboradores.find(c=>c.id===selColab.id) || selColab;
    return (
      <div style={S.page}>
        <div style={S.wrap}>
          <div style={{display:"flex",alignItems:"center",gap:8,paddingBottom:10,borderBottom:"1px solid #0f172a"}}>
            <button onClick={()=>{setScreen("list");setSelColab(null);}} style={S.backBtn}>← Voltar</button>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:800,color:"#f1f5f9"}}>{colab.nome}</div>
              <div style={{fontSize:11,color:"#334155"}}>{colab.cargo} · {project.id}</div>
            </div>
            {adminAuth&&<button onClick={()=>{setForm({...colab});setScreen("edit");}} style={{...S.btnSm,color:"#f59e0b",border:"1px solid #f59e0b44"}}>✏ Editar</button>}
          </div>

          {/* Profile card */}
          <div style={{...S.card,display:"flex",gap:12,alignItems:"center"}}>
            <div style={{width:80,height:80,borderRadius:12,overflow:"hidden",border:"2px solid #1e293b",flexShrink:0}}>
              {colab.foto?<img src={colab.foto} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",background:"#0f172a",fontSize:32}}>👤</div>}
            </div>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                <span style={{fontSize:10,fontWeight:700,color:colab.status==="ativo"?"#22c55e":"#ef4444",background:colab.status==="ativo"?"#021a0d":"#1a0202",padding:"2px 7px",borderRadius:6}}>
                  {colab.status==="ativo"?"🟢 ATIVO":"🔴 DESLIGADO"}
                </span>
              </div>
              <div style={{fontSize:12,color:"#64748b"}}>{colab.cargo}</div>
              {colab.telefone&&<div style={{fontSize:12,color:"#94a3b8",marginTop:2}}>📱 {colab.telefone}</div>}
              {colab.dataContratacao&&<div style={{fontSize:11,color:"#475569",marginTop:2}}>📅 Contratação: {fmtDate(colab.dataContratacao)}</div>}
              {colab.ultimaReciclagem&&<div style={{fontSize:11,color:"#475569",marginTop:2}}>🔄 Reciclagem: {fmtDate(colab.ultimaReciclagem)}</div>}
              <div style={{display:"flex",gap:8,marginTop:4}}>
                {colab.escala&&<span style={{fontSize:10,color:"#0ea5e9",background:"#001a2e",padding:"2px 7px",borderRadius:5,fontWeight:700}}>{colab.escala}</span>}
                {colab.turno&&<span style={{fontSize:10,color:"#f59e0b",background:"#0a0800",padding:"2px 7px",borderRadius:5,fontWeight:700}}>{colab.turno}</span>}
              </div>
            </div>
          </div>

          {/* Historico */}
          <div style={S.card}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
              <div style={{fontSize:12,fontWeight:700,color:"#f1f5f9"}}>Histórico ({(colab.historico||[]).length})</div>
              <button onClick={()=>setScreen("addHist")}
                style={{...S.btnSm,color:"#0ea5e9",border:"1px solid #0ea5e944",background:"#001a2e",fontSize:12,padding:"6px 12px"}}>
                + Adicionar
              </button>
            </div>
            {(colab.historico||[]).length===0&&(
              <div style={{textAlign:"center",padding:"16px 0",color:"#334155",fontSize:12}}>Nenhum registro ainda</div>
            )}
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {[...(colab.historico||[])].reverse().map(h=>(
                <div key={h.id} style={{display:"flex",alignItems:"center",gap:8,background:"#020510",borderRadius:8,padding:"8px 10px",border:`1px solid ${histColor(h.tipo)}22`}}>
                  <span style={{fontSize:9,fontWeight:700,color:histColor(h.tipo),background:histColor(h.tipo)+"11",padding:"2px 6px",borderRadius:5,flexShrink:0}}>
                    {h.tipo}
                  </span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:11,color:"#f1f5f9",fontWeight:600}}>{fmtDate(h.data)}</div>
                    {h.detalhe&&<div style={{fontSize:10,color:"#64748b"}}>{h.detalhe}</div>}
                  </div>
                  {adminAuth&&<button onClick={()=>removeHist(colab.id,h.id)}
                    style={{background:"transparent",border:"none",color:"#ef444466",fontSize:12,cursor:"pointer",padding:"2px 4px"}}>✕</button>}
                </div>
              ))}
            </div>
          </div>

          {adminAuth&&colab.status==="ativo"&&(
            <button onClick={()=>{ if(window.confirm(`Desligar ${colab.nome}?`)) desligarColab(colab); }}
              style={{...S.btnSec,color:"#ef4444",borderColor:"#ef444433",fontSize:13}}>
              🔴 Desligar Colaborador
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── LIST ──
  const ativos = equipeData.colaboradores.filter(c=>c.status==="ativo");
  const desligados = equipeData.desligados || [];

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{display:"flex",alignItems:"center",gap:8,paddingBottom:10,borderBottom:"1px solid #0f172a"}}>
          <button onClick={onBack} style={S.backBtn}>← Início</button>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:800,color:"#f1f5f9"}}>👥 Equipe</div>
            <div style={{fontSize:11,color:"#334155"}}>{project.id} · {project.name} · {ativos.length} ativo(s)</div>
          </div>
          {saving&&<span style={{fontSize:10,color:"#0ea5e9"}}>⟳</span>}
        </div>

        {/* Admin toggle */}
        {!adminAuth?(
          <div style={{...S.card,border:"1px solid #0f172a"}}>
            {!showAdmin?(
              <button onClick={()=>setShowAdmin(true)} style={{...S.btnSec,fontSize:12,color:"#f59e0b",borderColor:"#f59e0b33"}}>
                🔐 Acesso Gerencial
              </button>
            ):(
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <input type="password" inputMode="numeric" placeholder="PIN gerencial" maxLength={8} value={adminPin}
                  onChange={e=>{setAdminPin(e.target.value);setAdminErr(false);}}
                  onKeyDown={e=>{if(e.key==="Enter"){if(adminPin===ADMIN_PIN){setAdminAuth(true);setShowAdmin(false);}else setAdminErr(true);}}}
                  style={{...S.inp,flex:1,fontSize:14,letterSpacing:8,textAlign:"center"}}/>
                <button onClick={()=>{if(adminPin===ADMIN_PIN){setAdminAuth(true);setShowAdmin(false);}else setAdminErr(true);}}
                  style={{...S.btn,width:"auto",padding:"9px 14px",fontSize:13}}>OK</button>
              </div>
            )}
            {adminErr&&<div style={{fontSize:11,color:"#ef4444",marginTop:4,textAlign:"center"}}>PIN incorreto</div>}
          </div>
        ):(
          <div style={{background:"#021a0d",border:"1px solid #22c55e33",borderRadius:10,padding:"8px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span style={{fontSize:11,color:"#22c55e",fontWeight:700}}>🔓 Modo Gerencial Ativo</span>
            <button onClick={()=>{setAdminAuth(false);setAdminPin("");}} style={{...S.btnSm,color:"#64748b",fontSize:10}}>Sair</button>
          </div>
        )}

        {/* Add button - admin only */}
        {adminAuth&&(
          <button onClick={()=>{setForm(emptyColab(cargos[0],project.id));setScreen("add");}}
            style={{...S.btn,fontSize:13}}>+ Cadastrar Colaborador</button>
        )}

        {/* Cargos */}
        {cargos.map(cargo=>{
          const colabsCargo = ativos.filter(c=>c.cargo===cargo);
          return(
            <div key={cargo} style={S.card}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:colabsCargo.length>0?10:0}}>
                <div style={{fontSize:12,fontWeight:700,color:"#94a3b8"}}>{cargo}</div>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <span style={{fontSize:10,color:"#475569"}}>{colabsCargo.length}</span>
                  {adminAuth&&<button onClick={()=>{setForm({...emptyColab(cargo,project.id)});setScreen("add");}}
                    style={{...S.btnSm,fontSize:10,color:"#0ea5e9",border:"1px solid #0ea5e944",padding:"3px 8px"}}>+</button>}
                </div>
              </div>
              {colabsCargo.length===0&&(
                <div style={{fontSize:11,color:"#334155",textAlign:"center",padding:"8px 0"}}>Nenhum cadastrado</div>
              )}
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {colabsCargo.map(c=>(
                  <div key={c.id} onClick={()=>{setSelColab(c);setScreen("view");}}
                    style={{display:"flex",alignItems:"center",gap:10,background:"#020510",borderRadius:8,padding:"8px 10px",cursor:"pointer",border:"1px solid #0a0f1e"}}>
                    <div style={{width:42,height:42,borderRadius:8,overflow:"hidden",flexShrink:0,border:"1px solid #1e293b"}}>
                      {c.foto?<img src={c.foto} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:
                        <div style={{width:"100%",height:"100%",background:"#0f172a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>👤</div>}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:700,color:"#f1f5f9",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.nome}</div>
                      <div style={{display:"flex",gap:5,marginTop:2,flexWrap:"wrap"}}>
                        {c.escala&&<span style={{fontSize:9,color:"#0ea5e9",background:"#001a2e",padding:"1px 5px",borderRadius:4,fontWeight:700}}>{c.escala}</span>}
                        {c.turno&&<span style={{fontSize:9,color:"#f59e0b",background:"#0a0800",padding:"1px 5px",borderRadius:4,fontWeight:700}}>{c.turno}</span>}
                      </div>
                      <div style={{fontSize:10,color:"#475569"}}>{c.telefone||"—"}</div>
                    </div>
                    <div style={{flexShrink:0,textAlign:"right"}}>
                      {(c.historico||[]).filter(h=>h.tipo==="Falta").length>0&&(
                        <div style={{fontSize:9,color:"#ef4444",fontWeight:700}}>{(c.historico||[]).filter(h=>h.tipo==="Falta").length}F</div>
                      )}
                      {(c.historico||[]).filter(h=>h.tipo==="FT").length>0&&(
                        <div style={{fontSize:9,color:"#f59e0b",fontWeight:700}}>{(c.historico||[]).filter(h=>h.tipo==="FT").length}FT</div>
                      )}
                      {(c.historico||[]).filter(h=>h.tipo==="Medida Disciplinar").length>0&&(
                        <div style={{fontSize:9,color:"#7c3aed",fontWeight:700}}>{(c.historico||[]).filter(h=>h.tipo==="Medida Disciplinar").length}MD</div>
                      )}
                      <span style={{color:"#334155",fontSize:12,marginTop:2,display:"block"}}>›</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Desligados */}
        {desligados.length>0&&(
          <div style={S.card}>
            <button onClick={()=>setShowDesligados(!showDesligados)}
              style={{width:"100%",background:"transparent",border:"none",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",padding:0}}>
              <span style={{fontSize:12,fontWeight:700,color:"#ef4444"}}>🔴 Desligados ({desligados.length})</span>
              <span style={{color:"#334155",fontSize:12}}>{showDesligados?"▲":"▼"}</span>
            </button>
            {showDesligados&&(
              <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:6}}>
                {desligados.map(c=>(
                  <div key={c.id} style={{display:"flex",alignItems:"center",gap:10,background:"#1a0202",borderRadius:8,padding:"8px 10px",border:"1px solid #ef444422"}}>
                    <div style={{width:38,height:38,borderRadius:7,overflow:"hidden",flexShrink:0,border:"1px solid #ef444433",opacity:.7}}>
                      {c.foto?<img src={c.foto} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:
                        <div style={{width:"100%",height:"100%",background:"#0f172a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>👤</div>}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,fontWeight:700,color:"#94a3b8"}}>{c.nome}</div>
                      <div style={{fontSize:10,color:"#475569"}}>{c.cargo}{c.desligadoEm?` · Deslig: ${fmtDate(c.desligadoEm)}`:""}</div>
                    </div>
                    {adminAuth&&<button onClick={()=>reativarColab(c)}
                      style={{...S.btnSm,color:"#22c55e",border:"1px solid #22c55e44",fontSize:10}}>Reativar</button>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{fontSize:10,color:"#1e293b",textAlign:"center",marginTop:4}}>
          Líder: adicionar registros · Gerencial: cadastrar e editar
        </div>
      </div>
    </div>
  );
}

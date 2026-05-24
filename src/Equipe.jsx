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
const MAX_DESLIGADOS = 50;

// PINs de acesso por projeto (líder pode cadastrar + adicionar histórico)
const PROJECT_PINS = {
  P601:"16601", P602:"16602", P604:"16604", P605:"16605",
  P606:"16606", P607:"16607", P311A:"16311", P311B:"16311",
  P505:"16505", P260A:"162601", P260B:"162602", P260C:"162603"
};

const CARGOS_PROJETO = {
  P601:  ["VSPP Líder","VSPP Apoio","Vig CCO","CDA","Recepção"],
  P602:  ["VSPP Líder","VSPP Apoio","Vig CCO","CDA","Recepção"],
  P604:  ["VSPP Líder","VSPP Apoio","Vig CCO","CDA","Recepção"],
  P605:  ["VSPP Líder","VSPP Apoio","Vig CCO","CDA","Recepção"],
  P505:  ["VSPP Líder","VSPP Apoio","Vig CCO","CDA","Recepção"],
  P260A: ["VSPP Líder","VSPP Apoio","Vig CCO"],
  P260B: ["VSPP Líder","VSPP Apoio","Vig CCO"],
  P260C: ["VSPP Líder","VSPP Apoio","Vig CCO","Cão de Guarda"],
  P311A: ["Vigilante Líder","Vigilante Apoio","Vigilante Ronda","Porteiro CCO"],
  P311B: ["Vigilante Líder","Vigilante Apoio","Vigilante Ronda","Vig CCO"],
  P606:  ["Vigilante Líder","Vigilante Apoio","Vig CCO"],
  P607:  ["Vigilante Ronda","Vigilante Apoio","AGP","AGP CCO"],
};

const TURNOS = ["Diurno","Noturno","Folguista"];
const ESCALAS = ["12x36","4x2","5x2","6x1"];

const TURNO_CONFIG = {
  "Diurno":    { bg:"#1a2e1a", border:"#22c55e33", badge:"#22c55e", icon:"☀️" },
  "Noturno":   { bg:"#0a0a2e", border:"#6366f133", badge:"#818cf8", icon:"🌙" },
  "Folguista": { bg:"#1a1a10", border:"#f59e0b33", badge:"#f59e0b", icon:"☀️🌙" },
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
  } catch(e){}
  try {
    const local = localStorage.getItem(`equipe_${projectId}`);
    if(local) return JSON.parse(local);
  } catch(e){}
  return { colaboradores:[], desligados:[] };
}

async function saveEquipe(projectId, data) {
  try { await setDoc(doc(db,"equipes",projectId), data); } catch(e){ console.error(e); }
  try { localStorage.setItem(`equipe_${projectId}`, JSON.stringify(data)); } catch(e){}
}

function emptyColab(cargo, projectId, turno) {
  return {
    id: Date.now().toString() + Math.random().toString(36).substring(2,6),
    cargo, projectId,
    nome:"", telefone:"",
    dataContratacao:"", ultimaReciclagem:"",
    foto:"", escala:"12x36",
    turno: turno || "Diurno",
    status:"ativo",
    historico:[],
    criadoEm: new Date().toISOString()
  };
}

// ── Styles (dark padrão)
function getStyles(dark) {
  return {
    page:    { minHeight:"100vh", background: dark?"#04080f":"#f1f5f9", display:"flex", justifyContent:"center", padding:"0 0 80px", fontFamily:"'Segoe UI',system-ui,sans-serif" },
    wrap:    { width:"100%", maxWidth:480, padding:"0 0 40px", display:"flex", flexDirection:"column", gap:0 },
    card:    { background: dark?"#060c18":"#ffffff", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, borderRadius:12, padding:"14px 16px" },
    btn:     { background:"linear-gradient(135deg,#1d4ed8,#1e40af)", color:"#fff", border:"none", borderRadius:10, padding:"13px 16px", fontSize:14, fontWeight:700, cursor:"pointer", width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:6 },
    btnSec:  { background: dark?"#060c18":"#f8fafc", color: dark?"#64748b":"#475569", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, borderRadius:10, padding:"13px 16px", fontSize:14, fontWeight:600, cursor:"pointer", width:"100%", display:"flex", alignItems:"center", justifyContent:"center" },
    btnSm:   { background: dark?"#020510":"#f8fafc", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, color: dark?"#64748b":"#475569", borderRadius:6, padding:"5px 10px", fontSize:11, cursor:"pointer", fontWeight:600 },
    backBtn: { background:"transparent", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, color: dark?"#334155":"#64748b", borderRadius:7, padding:"6px 10px", fontSize:11, cursor:"pointer", flexShrink:0 },
    inp:     { width:"100%", background: dark?"#020510":"#ffffff", border:`1px solid ${dark?"#0f172a":"#cbd5e1"}`, borderRadius:7, color: dark?"#e2e8f0":"#1e293b", padding:"10px 12px", fontSize:13, boxSizing:"border-box", outline:"none" },
    lbl:     { display:"block", fontSize:10, color: dark?"#334155":"#64748b", fontWeight:700, marginBottom:4, textTransform:"uppercase", letterSpacing:.5 },
    headerBg:{ background: dark?"#04080f":"#f8fafc", borderBottom:`1px solid ${dark?"#0a0f1e":"#e2e8f0"}` },
    txtPrimary:  { color: dark?"#f1f5f9":"#0f172a" },
    txtSecondary:{ color: dark?"#475569":"#64748b" },
  };
}

function Header({ title, sub, onBack, saving, dark, onToggleTheme }) {
  const S = getStyles(dark);
  return (
    <div style={{ position:"sticky", top:0, zIndex:10, ...S.headerBg, padding:"16px 16px 12px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <button onClick={onBack} style={S.backBtn}>← Início</button>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:15, fontWeight:800, ...S.txtPrimary }}>👥 {title}</div>
          <div style={{ fontSize:11, ...S.txtSecondary }}>{sub}</div>
        </div>
        {saving && <div style={{ fontSize:10, color:"#0ea5e9", fontWeight:700 }}>⟳</div>}
        <button onClick={onToggleTheme}
          style={{ background:"transparent", border:`1px solid ${dark?"#1e293b":"#cbd5e1"}`, borderRadius:8, padding:"5px 10px", cursor:"pointer", fontSize:14, color: dark?"#94a3b8":"#475569" }}>
          {dark?"☀️":"🌙"}
        </button>
      </div>
    </div>
  );
}

function Avatar({ foto, size=52, border="#1e293b" }) {
  return (
    <div style={{ width:size, height:size, borderRadius:size/4, overflow:"hidden", border:`2px solid ${border}`, flexShrink:0, background:"#0f172a", display:"flex", alignItems:"center", justifyContent:"center" }}>
      {foto
        ? <img src={foto} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
        : <span style={{ fontSize:size*0.45 }}>👤</span>
      }
    </div>
  );
}

// ── Tela de ficha completa
function FichaScreen({ colab, adminAuth, liderAuth, onBack, onEdit, onAddHist, onDesligar, onRemoveHist, dark }) {
  const S = getStyles(dark);
  const hist = [...(colab.historico||[])].reverse();
  const faltas = (colab.historico||[]).filter(h=>h.tipo==="Falta").length;
  const fts    = (colab.historico||[]).filter(h=>h.tipo==="FT").length;
  const mds    = (colab.historico||[]).filter(h=>h.tipo==="Medida Disciplinar").length;
  const tc = TURNO_CONFIG[colab.turno] || TURNO_CONFIG["Diurno"];
  const canAddHist = adminAuth || liderAuth;

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{ background:`linear-gradient(160deg,${dark?"#0c1220":"#f8fafc"} 0%,${tc.bg} 100%)`, borderBottom:`1px solid ${tc.border}`, padding:"20px 16px 18px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
            <button onClick={onBack} style={S.backBtn}>← Voltar</button>
            {adminAuth && (
              <button onClick={onEdit} style={{ ...S.btnSm, color:"#f59e0b", border:"1px solid #f59e0b44", marginLeft:"auto", padding:"6px 14px", fontSize:12 }}>
                ✏️ Editar
              </button>
            )}
          </div>
          <div style={{ display:"flex", gap:16, alignItems:"flex-start" }}>
            <Avatar foto={colab.foto} size={78} border={tc.badge+"66"}/>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:18, fontWeight:800, ...S.txtPrimary, lineHeight:1.2 }}>{colab.nome || "—"}</div>
              <div style={{ fontSize:12, color:"#94a3b8", marginTop:3 }}>{colab.cargo}</div>
              {colab.telefone && <div style={{ fontSize:12, color:"#64748b", marginTop:2 }}>📱 {colab.telefone}</div>}
              <div style={{ display:"flex", gap:6, marginTop:8, flexWrap:"wrap" }}>
                <span style={{ fontSize:10, fontWeight:700, color:tc.badge, background:tc.bg, border:`1px solid ${tc.border}`, padding:"3px 9px", borderRadius:6 }}>
                  {TURNO_CONFIG[colab.turno]?.icon || "⏰"} {colab.turno}
                </span>
                {colab.escala && <span style={{ fontSize:10, fontWeight:700, color:"#0ea5e9", background:"#001a2e", border:"1px solid #0ea5e922", padding:"3px 9px", borderRadius:6 }}>{colab.escala}</span>}
                <span style={{ fontSize:10, fontWeight:700, color:colab.status==="ativo"?"#22c55e":"#ef4444", background:colab.status==="ativo"?"#021a0d":"#1a0202", border:`1px solid ${colab.status==="ativo"?"#22c55e33":"#ef444433"}`, padding:"3px 9px", borderRadius:6 }}>
                  {colab.status==="ativo"?"🟢 ATIVO":"🔴 DESLIGADO"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Contadores */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:1, background:"#0a0f1e" }}>
          {[
            { label:"Faltas",    val:faltas, color:"#ef4444", bg:"#1a0202" },
            { label:"FT",        val:fts,    color:"#f59e0b", bg:"#1a1000" },
            { label:"Med. Disc", val:mds,    color:"#a855f7", bg:"#120a2e" },
          ].map(({ label, val, color, bg }) => (
            <div key={label} style={{ background:bg, padding:"12px 8px", textAlign:"center" }}>
              <div style={{ fontSize:22, fontWeight:900, color }}>{val}</div>
              <div style={{ fontSize:9, color:"#64748b", fontWeight:700, textTransform:"uppercase" }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ padding:"14px 16px", display:"flex", flexDirection:"column", gap:10 }}>
          {/* Datas */}
          <div style={{ ...S.card, display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div>
              <div style={S.lbl}>Contratação no Posto</div>
              <div style={{ fontSize:13, ...S.txtPrimary, fontWeight:600 }}>{fmtDate(colab.dataContratacao)}</div>
            </div>
            <div>
              <div style={S.lbl}>Última Reciclagem</div>
              <div style={{ fontSize:13, color:colab.ultimaReciclagem?"#22c55e":"#ef4444", fontWeight:600 }}>{fmtDate(colab.ultimaReciclagem)}</div>
            </div>
          </div>

          {/* Histórico */}
          <div style={S.card}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
              <div style={{ fontSize:13, fontWeight:700, ...S.txtPrimary }}>Histórico <span style={{ fontSize:11, color:"#64748b" }}>({(colab.historico||[]).length})</span></div>
              {canAddHist && (
                <button onClick={onAddHist} style={{ ...S.btnSm, color:"#0ea5e9", border:"1px solid #0ea5e944", background:"#001a2e", padding:"7px 14px", fontSize:12 }}>
                  + Adicionar
                </button>
              )}
            </div>
            {hist.length === 0 && (
              <div style={{ textAlign:"center", padding:"20px 0", color:"#334155", fontSize:12 }}>Nenhum registro ainda</div>
            )}
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {hist.map(h => {
                const hColor = h.tipo==="Falta"?"#ef4444":h.tipo==="FT"?"#f59e0b":"#a855f7";
                const hBg    = h.tipo==="Falta"?"#1a0202":h.tipo==="FT"?"#1a1000":"#120a2e";
                return (
                  <div key={h.id} style={{ display:"flex", alignItems:"center", gap:10, background:hBg, borderRadius:8, padding:"9px 12px", border:`1px solid ${hColor}22` }}>
                    <span style={{ fontSize:9, fontWeight:700, color:hColor, background:hColor+"22", padding:"2px 7px", borderRadius:5, flexShrink:0, textTransform:"uppercase" }}>
                      {h.tipo}
                    </span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, color:"#f1f5f9", fontWeight:600 }}>{fmtDate(h.data)}</div>
                      {h.detalhe && <div style={{ fontSize:10, color:"#64748b" }}>{h.detalhe}</div>}
                    </div>
                    {adminAuth && (
                      <button onClick={()=>onRemoveHist(colab.id, h.id)} style={{ background:"transparent", border:"none", color:"#ef444466", fontSize:14, cursor:"pointer", padding:"2px 5px" }}>✕</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Desligar — admin only */}
          {adminAuth && colab.status==="ativo" && (
            <button onClick={()=>{ if(window.confirm(`Desligar ${colab.nome}?`)) onDesligar(colab); }}
              style={{ ...S.btnSec, color:"#ef4444", borderColor:"#ef444433", fontSize:13 }}>
              🔴 Desligar Colaborador
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Formulário (admin only — cadastrar/editar)
function FormScreen({ form, setF, cargos, onSave, onCancel, saving, isEdit, dark }) {
  const S = getStyles(dark);
  const handleFoto = (e) => {
    const file = e.target.files?.[0]; if(!file) return;
    if(file.size > 3*1024*1024) { alert("Foto muito grande. Max 3MB"); return; }
    const r = new FileReader();
    r.onload = ev => setF("foto", ev.target.result);
    r.readAsDataURL(file);
  };

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{ position:"sticky", top:0, zIndex:10, ...S.headerBg, padding:"16px 16px 12px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <button onClick={onCancel} style={S.backBtn}>← Cancelar</button>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:800, ...S.txtPrimary }}>{isEdit?"Editar Colaborador":"Novo Colaborador"}</div>
              <div style={{ fontSize:11, ...S.txtSecondary }}>{form.cargo} · {form.projectId}</div>
            </div>
          </div>
        </div>

        <div style={{ padding:"14px 16px", display:"flex", flexDirection:"column", gap:10 }}>
          {/* Foto */}
          <div style={{ ...S.card, display:"flex", gap:14, alignItems:"center" }}>
            <label style={{ cursor:"pointer", flexShrink:0 }}>
              <div style={{ width:82, height:82, borderRadius:14, overflow:"hidden", border:`2px dashed ${form.foto?"#0ea5e9":"#1e293b"}`, background:"#020510", display:"flex", alignItems:"center", justifyContent:"center" }}>
                {form.foto
                  ? <img src={form.foto} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                  : <div style={{ textAlign:"center" }}><div style={{ fontSize:26 }}>📷</div><div style={{ fontSize:8, color:"#475569", marginTop:2 }}>FOTO</div></div>
                }
              </div>
              <input type="file" accept="image/*" style={{ position:"absolute", opacity:0, width:0, height:0 }} onChange={handleFoto}/>
            </label>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:700, color:form.foto?"#0ea5e9":"#64748b" }}>{form.foto?"✓ Foto adicionada":"Adicionar foto (opcional)"}</div>
              <div style={{ fontSize:11, color:"#475569", marginTop:2 }}>Toque no avatar para escolher</div>
            </div>
          </div>

          {/* Dados */}
          <div style={{ ...S.card, display:"flex", flexDirection:"column", gap:10 }}>
            <div>
              <label style={S.lbl}>Nome Completo *</label>
              <input value={form.nome} onChange={e=>setF("nome",e.target.value)} placeholder="Nome do colaborador..." style={S.inp}/>
            </div>
            <div>
              <label style={S.lbl}>Cargo</label>
              <select value={form.cargo} onChange={e=>setF("cargo",e.target.value)} style={{ ...S.inp, cursor:"pointer" }}>
                {cargos.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={S.lbl}>Telefone</label>
              <input value={form.telefone} onChange={e=>setF("telefone",e.target.value)} placeholder="(00) 00000-0000" style={S.inp}/>
            </div>
          </div>

          {/* Turno e Escala */}
          <div style={S.card}>
            <div style={{ fontSize:12, fontWeight:700, ...S.txtPrimary, marginBottom:10 }}>Turno e Escala</div>
            <div style={{ marginBottom:10 }}>
              <label style={S.lbl}>Turno</label>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6 }}>
                {TURNOS.map(t => {
                  const tc = TURNO_CONFIG[t];
                  const isSel = form.turno===t;
                  return (
                    <button key={t} onClick={()=>setF("turno",t)}
                      style={{ background:isSel?tc.bg:"#020510", border:`2px solid ${isSel?tc.badge+"66":"#0f172a"}`, borderRadius:8, padding:"12px 6px", cursor:"pointer", textAlign:"center" }}>
                      <div style={{ fontSize:18, marginBottom:3 }}>{tc.icon}</div>
                      <div style={{ fontSize:11, fontWeight:700, color:isSel?tc.badge:"#475569" }}>{t}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label style={S.lbl}>Escala</label>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {ESCALAS.map(e => (
                  <button key={e} onClick={()=>setF("escala",e)}
                    style={{ ...S.btnSm, padding:"7px 12px", color:form.escala===e?"#0ea5e9":"#475569", border:`1px solid ${form.escala===e?"#0ea5e944":"#0f172a"}`, background:form.escala===e?"#001a2e":"#020510", fontSize:12 }}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Datas */}
          <div style={{ ...S.card, display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div>
              <label style={S.lbl}>Contratação no Posto</label>
              <input type="date" value={form.dataContratacao} onChange={e=>setF("dataContratacao",e.target.value)} style={S.inp}/>
            </div>
            <div>
              <label style={S.lbl}>Última Reciclagem</label>
              <input type="date" value={form.ultimaReciclagem} onChange={e=>setF("ultimaReciclagem",e.target.value)} style={S.inp}/>
            </div>
          </div>

          <button onClick={onSave} disabled={saving} style={{ ...S.btn, opacity:saving?0.7:1 }}>
            {saving?"⟳ Salvando...":"✓ Salvar Colaborador"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tela adicionar histórico (líder ou admin)
function AddHistScreen({ colabNome, histForm, setHistForm, onSave, onCancel, dark }) {
  const S = getStyles(dark);
  const hColor = histForm.tipo==="Falta"?"#ef4444":histForm.tipo==="FT"?"#f59e0b":"#a855f7";
  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{ position:"sticky", top:0, zIndex:10, ...S.headerBg, padding:"16px 16px 12px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <button onClick={onCancel} style={S.backBtn}>← Cancelar</button>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:800, ...S.txtPrimary }}>Adicionar Registro</div>
              <div style={{ fontSize:11, ...S.txtSecondary }}>{colabNome}</div>
            </div>
          </div>
        </div>
        <div style={{ padding:"14px 16px", display:"flex", flexDirection:"column", gap:10 }}>
          <div style={S.card}>
            <div style={{ fontSize:12, fontWeight:700, ...S.txtPrimary, marginBottom:12 }}>Tipo de Registro</div>
            <div style={{ display:"flex", gap:8, marginBottom:14 }}>
              {["Falta","FT","Medida Disciplinar"].map(tipo=>{
                const c  = tipo==="Falta"?"#ef4444":tipo==="FT"?"#f59e0b":"#a855f7";
                const bg = tipo==="Falta"?"#1a0202":tipo==="FT"?"#1a1000":"#120a2e";
                const isSel = histForm.tipo===tipo;
                return (
                  <button key={tipo} onClick={()=>setHistForm(h=>({...h,tipo,detalhe:""}))}
                    style={{ flex:1, background:isSel?bg:"#020510", border:`2px solid ${isSel?c+"66":"#0f172a"}`, borderRadius:8, padding:"10px 4px", cursor:"pointer", textAlign:"center" }}>
                    <div style={{ fontSize:11, fontWeight:700, color:isSel?c:"#475569", lineHeight:1.3 }}>{tipo}</div>
                  </button>
                );
              })}
            </div>
            <div style={{ marginBottom:10 }}>
              <label style={S.lbl}>Data do Registro</label>
              <input type="date" value={histForm.data} onChange={e=>setHistForm(h=>({...h,data:e.target.value}))} style={S.inp}/>
            </div>
            {histForm.tipo==="Medida Disciplinar" && (
              <div>
                <label style={S.lbl}>Tipo de Medida</label>
                <div style={{ display:"flex", gap:8 }}>
                  {["Advertência","Suspensão"].map(d=>(
                    <button key={d} onClick={()=>setHistForm(h=>({...h,detalhe:d}))}
                      style={{ ...S.btnSm, flex:1, padding:"10px 8px", color:histForm.detalhe===d?"#a855f7":"#475569", border:`1px solid ${histForm.detalhe===d?"#a855f744":"#0f172a"}`, background:histForm.detalhe===d?"#120a2e":"#020510", fontSize:12 }}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {histForm.tipo==="FT" && (
              <div style={{ marginTop:10 }}>
                <label style={S.lbl}>Observação (opcional)</label>
                <input value={histForm.detalhe||""} onChange={e=>setHistForm(h=>({...h,detalhe:e.target.value}))} placeholder="Ex: Banco de horas, folga compensatória..." style={S.inp}/>
              </div>
            )}
          </div>
          <button onClick={onSave} style={{ ...S.btn, background:`linear-gradient(135deg,${hColor},${hColor}cc)` }}>
            ✓ Adicionar Registro
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tela de PIN (entrada)
function PinScreen({ project, onSuccess, onBack, dark }) {
  const S = getStyles(dark);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState(false);
  const [mode, setMode] = useState(null); // "lider" | "admin"

  const tryPin = (inputPin) => {
    if(inputPin === ADMIN_PIN) { onSuccess("admin"); return; }
    if(inputPin === PROJECT_PINS[project.id]) { onSuccess("lider"); return; }
    setErr(true);
  };

  return (
    <div style={{ ...S.page, alignItems:"center", justifyContent:"center" }}>
      <div style={{ background: dark?"#060c18":"#ffffff", border:`1px solid ${dark?"#1e293b":"#e2e8f0"}`, borderRadius:16, padding:"28px 24px", maxWidth:320, width:"100%", textAlign:"center", margin:16 }}>
        <div style={{ fontSize:32, marginBottom:8 }}>👥</div>
        <div style={{ fontSize:16, fontWeight:800, ...S.txtPrimary, marginBottom:4 }}>Equipe — {project.id}</div>
        <div style={{ fontSize:12, ...S.txtSecondary, marginBottom:20 }}>{project.name}</div>

        {!mode && (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            <button onClick={()=>setMode("lider")}
              style={{ ...S.btn, background:"linear-gradient(135deg,#0369a1,#0c4a6e)", fontSize:13 }}>
              👷 Acesso Líder
            </button>
            <button onClick={()=>setMode("admin")}
              style={{ ...S.btnSec, fontSize:13, color:"#f59e0b", borderColor:"#f59e0b33" }}>
              🔐 Acesso Gerencial
            </button>
            <button onClick={onBack} style={{ ...S.btnSec, fontSize:13, marginTop:4 }}>← Voltar</button>
          </div>
        )}

        {mode && (
          <>
            <div style={{ fontSize:12, ...S.txtSecondary, marginBottom:12 }}>
              {mode==="lider"?"PIN do projeto":"PIN gerencial"}
            </div>
            <input type="password" inputMode="numeric" placeholder="PIN" maxLength={8} value={pin}
              onChange={e=>{ setPin(e.target.value); setErr(false); }}
              onKeyDown={e=>{ if(e.key==="Enter") tryPin(pin); }}
              style={{ ...S.inp, textAlign:"center", fontSize:22, letterSpacing:10, marginBottom:8 }}/>
            {err && <div style={{ fontSize:12, color:"#ef4444", marginBottom:8 }}>PIN incorreto</div>}
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={()=>{ setMode(null); setPin(""); setErr(false); }} style={{ ...S.btnSec, flex:1, fontSize:13 }}>← Voltar</button>
              <button onClick={()=>tryPin(pin)} style={{ ...S.btn, flex:1, fontSize:13 }}>Entrar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── App principal
export default function EquipeApp({ project, onBack }) {
  const [equipeData, setEquipeData] = useState({ colaboradores:[], desligados:[] });
  const [screen, setScreen] = useState("pin"); // pin | list | add | edit | view | addHist
  const [authLevel, setAuthLevel] = useState(null); // null | "lider" | "admin"
  const [selColab, setSelColab] = useState(null);
  const [form, setForm] = useState(null);
  const [histForm, setHistForm] = useState({ tipo:"Falta", data:todayStr(), detalhe:"" });
  const [showDesligados, setShowDesligados] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dark, setDark] = useState(true);

  const S = getStyles(dark);
  const adminAuth = authLevel === "admin";
  const liderAuth = authLevel === "lider" || authLevel === "admin";
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

  const saveColab = async () => {
    if(!form.nome.trim()) { alert("Informe o nome"); return; }
    if(!adminAuth) return; // só admin cadastra
    const isNew = !equipeData.colaboradores.find(c=>c.id===form.id);
    const newColabs = isNew
      ? [...equipeData.colaboradores, form]
      : equipeData.colaboradores.map(c=>c.id===form.id?form:c);
    await save({...equipeData, colaboradores:newColabs});
    setScreen("list"); setForm(null);
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
    const desligado = {...colab, status:"desligado", desligadoEm:todayStr()};
    const newColabs = equipeData.colaboradores.filter(c=>c.id!==colab.id);
    const newDesligados = [desligado, ...(equipeData.desligados||[])].slice(0, MAX_DESLIGADOS);
    await save({...equipeData, colaboradores:newColabs, desligados:newDesligados});
    setScreen("list"); setSelColab(null);
  };

  const reativarColab = async (colab) => {
    if(!adminAuth) return;
    const reativado = {...colab, status:"ativo", desligadoEm:null};
    const newDesligados = (equipeData.desligados||[]).filter(c=>c.id!==colab.id);
    await save({...equipeData, colaboradores:[...equipeData.colaboradores, reativado], desligados:newDesligados});
  };

  if(loading) return (
    <div style={{...S.page,alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:30,marginBottom:10}}>👥</div>
        <div style={{fontSize:13,color:"#64748b"}}>Carregando equipe...</div>
      </div>
    </div>
  );

  // ── PIN
  if(screen==="pin") return (
    <PinScreen project={project} dark={dark}
      onBack={onBack}
      onSuccess={(level)=>{ setAuthLevel(level); setScreen("list"); }}/>
  );

  // ── Formulário (admin only)
  if(screen==="add"&&form&&adminAuth) return (
    <FormScreen form={form} setF={setF} cargos={cargos} onSave={saveColab}
      onCancel={()=>{setScreen("list");setForm(null);}} saving={saving} isEdit={false} dark={dark}/>
  );
  if(screen==="edit"&&form&&adminAuth) return (
    <FormScreen form={form} setF={setF} cargos={cargos} onSave={saveColab}
      onCancel={()=>{setScreen("view");setForm(null);}} saving={saving} isEdit={true} dark={dark}/>
  );

  // ── Adicionar histórico (líder ou admin)
  if(screen==="addHist"&&selColab) return (
    <AddHistScreen colabNome={selColab.nome} histForm={histForm} setHistForm={setHistForm}
      onSave={addHistorico} onCancel={()=>setScreen("view")} dark={dark}/>
  );

  // ── Ficha
  if(screen==="view"&&selColab) {
    const colab = equipeData.colaboradores.find(c=>c.id===selColab.id) || selColab;
    return (
      <FichaScreen colab={colab} adminAuth={adminAuth} liderAuth={liderAuth} dark={dark}
        onBack={()=>{setScreen("list");setSelColab(null);}}
        onEdit={()=>{setForm({...colab});setScreen("edit");}}
        onAddHist={()=>setScreen("addHist")}
        onDesligar={desligarColab}
        onRemoveHist={removeHist}/>
    );
  }

  // ── Lista principal
  const ativos = equipeData.colaboradores.filter(c=>c.status==="ativo");
  const desligados = equipeData.desligados || [];
  const turnosComEquipe = TURNOS.filter(t => ativos.some(c=>c.turno===t));
  const semTurno = ativos.filter(c=>!TURNOS.includes(c.turno));

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <Header
          title="Equipe"
          sub={`${project.id} · ${project.name} · ${ativos.length} ativo(s)`}
          onBack={onBack}
          saving={saving}
          dark={dark}
          onToggleTheme={()=>setDark(!dark)}
        />

        <div style={{ padding:"12px 16px", display:"flex", flexDirection:"column", gap:10 }}>

          {/* Barra de auth */}
          {adminAuth ? (
            <div style={{ background:"#021a0d", border:"1px solid #22c55e33", borderRadius:10, padding:"10px 14px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ fontSize:12, color:"#22c55e", fontWeight:700 }}>🔓 Modo Gerencial Ativo</div>
              <button onClick={()=>{setAuthLevel(null);setScreen("pin");}} style={{ ...S.btnSm, color:"#64748b", fontSize:10 }}>Sair</button>
            </div>
          ) : liderAuth ? (
            <div style={{ background:"#001a2e", border:"1px solid #0ea5e933", borderRadius:10, padding:"10px 14px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ fontSize:12, color:"#0ea5e9", fontWeight:700 }}>👷 Acesso Líder — Pode adicionar registros</div>
              <button onClick={()=>{setAuthLevel(null);setScreen("pin");}} style={{ ...S.btnSm, color:"#64748b", fontSize:10 }}>Sair</button>
            </div>
          ) : null}

          {/* Botão cadastrar — admin only */}
          {adminAuth && (
            <button onClick={()=>{setForm(emptyColab(cargos[0],project.id,"Diurno"));setScreen("add");}}
              style={{ ...S.btn, fontSize:13 }}>
              + Cadastrar Colaborador
            </button>
          )}

          {/* Resumo por turno */}
          {turnosComEquipe.length > 0 && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6 }}>
              {turnosComEquipe.map(t=>{
                const tc = TURNO_CONFIG[t];
                const count = ativos.filter(c=>c.turno===t).length;
                return (
                  <div key={t} style={{ background:tc.bg, border:`1px solid ${tc.border}`, borderRadius:10, padding:"10px 12px", textAlign:"center" }}>
                    <div style={{ fontSize:18, marginBottom:3 }}>{tc.icon}</div>
                    <div style={{ fontSize:12, fontWeight:700, color:tc.badge }}>{t}</div>
                    <div style={{ fontSize:11, color:"#64748b", marginTop:2 }}>{count}</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Cards por turno */}
          {TURNOS.map(turno=>{
            const tc = TURNO_CONFIG[turno];
            const colabsDoTurno = ativos.filter(c=>c.turno===turno);
            if(colabsDoTurno.length===0 && !adminAuth) return null;
            return (
              <div key={turno} style={{ borderRadius:12, overflow:"hidden", border:`1px solid ${tc.border}` }}>
                <div style={{ background:tc.bg, padding:"10px 14px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:16 }}>{tc.icon}</span>
                    <span style={{ fontSize:13, fontWeight:700, color:tc.badge }}>{turno}</span>
                    <span style={{ fontSize:10, color:"#64748b", background:"#0a0f1e", padding:"2px 8px", borderRadius:10 }}>{colabsDoTurno.length}</span>
                  </div>
                  {adminAuth && (
                    <button onClick={()=>{setForm(emptyColab(cargos[0],project.id,turno));setScreen("add");}}
                      style={{ ...S.btnSm, fontSize:10, color:tc.badge, border:`1px solid ${tc.badge}44`, padding:"4px 10px" }}>
                      + Adicionar
                    </button>
                  )}
                </div>
                <div style={{ background: dark?"#04080f":"#f8fafc", padding:"8px" }}>
                  {colabsDoTurno.length===0 && (
                    <div style={{ textAlign:"center", padding:"14px 0", fontSize:11, color:"#334155" }}>
                      {adminAuth?"Nenhum cadastrado — toque em + Adicionar":"Nenhum cadastrado"}
                    </div>
                  )}
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    {colabsDoTurno.map(c=>{
                      const faltas = (c.historico||[]).filter(h=>h.tipo==="Falta").length;
                      const fts    = (c.historico||[]).filter(h=>h.tipo==="FT").length;
                      const mds    = (c.historico||[]).filter(h=>h.tipo==="Medida Disciplinar").length;
                      return (
                        <div key={c.id} onClick={()=>{setSelColab(c);setScreen("view");}}
                          style={{ display:"flex", alignItems:"center", gap:10, background: dark?"#060c18":"#ffffff", borderRadius:10, padding:"10px 12px", cursor:"pointer", border:`1px solid ${tc.border}` }}>
                          <Avatar foto={c.foto} size={46} border={tc.badge+"44"}/>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:13, fontWeight:700, ...S.txtPrimary, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.nome}</div>
                            <div style={{ fontSize:11, ...S.txtSecondary, marginTop:1 }}>{c.cargo}</div>
                            <div style={{ display:"flex", gap:5, marginTop:4, flexWrap:"wrap" }}>
                              {c.escala && <span style={{ fontSize:9, color:"#0ea5e9", background:"#001a2e", padding:"1px 6px", borderRadius:4, fontWeight:700 }}>{c.escala}</span>}
                              {c.telefone && <span style={{ fontSize:9, color:"#475569", padding:"1px 5px" }}>📱 {c.telefone}</span>}
                            </div>
                          </div>
                          <div style={{ flexShrink:0, textAlign:"right" }}>
                            {faltas>0 && <div style={{ fontSize:9, color:"#ef4444", fontWeight:700 }}>{faltas}F</div>}
                            {fts>0    && <div style={{ fontSize:9, color:"#f59e0b", fontWeight:700 }}>{fts}FT</div>}
                            {mds>0    && <div style={{ fontSize:9, color:"#a855f7", fontWeight:700 }}>{mds}MD</div>}
                            <span style={{ color:"#334155", fontSize:14, display:"block", marginTop:2 }}>›</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Sem turno */}
          {semTurno.length > 0 && (
            <div style={S.card}>
              <div style={{ fontSize:12, fontWeight:700, color:"#64748b", marginBottom:8 }}>Sem turno ({semTurno.length})</div>
              {semTurno.map(c=>(
                <div key={c.id} onClick={()=>{setSelColab(c);setScreen("view");}}
                  style={{ display:"flex", alignItems:"center", gap:10, background:"#020510", borderRadius:8, padding:"10px 12px", cursor:"pointer", marginBottom:6, border:"1px solid #0a0f1e" }}>
                  <Avatar foto={c.foto} size={42}/>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:700, ...S.txtPrimary }}>{c.nome}</div>
                    <div style={{ fontSize:11, ...S.txtSecondary }}>{c.cargo}</div>
                  </div>
                  <span style={{ color:"#334155", fontSize:14 }}>›</span>
                </div>
              ))}
            </div>
          )}

          {/* Desligados */}
          {desligados.length > 0 && (
            <div style={S.card}>
              <button onClick={()=>setShowDesligados(!showDesligados)}
                style={{ width:"100%", background:"transparent", border:"none", display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer", padding:0 }}>
                <span style={{ fontSize:12, fontWeight:700, color:"#ef4444" }}>🔴 Desligados ({desligados.length})</span>
                <span style={{ color:"#334155", fontSize:12 }}>{showDesligados?"▲":"▼"}</span>
              </button>
              {showDesligados && (
                <div style={{ marginTop:10, display:"flex", flexDirection:"column", gap:6 }}>
                  {desligados.map(c=>(
                    <div key={c.id} style={{ display:"flex", alignItems:"center", gap:10, background:"#1a0202", borderRadius:8, padding:"10px 12px", border:"1px solid #ef444422" }}>
                      <Avatar foto={c.foto} size={40} border="#ef444444"/>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12, fontWeight:700, color:"#94a3b8" }}>{c.nome}</div>
                        <div style={{ fontSize:10, color:"#475569" }}>{c.cargo}{c.desligadoEm?` · Deslig: ${fmtDate(c.desligadoEm)}`:""}</div>
                      </div>
                      {adminAuth && (
                        <button onClick={()=>reativarColab(c)} style={{ ...S.btnSm, color:"#22c55e", border:"1px solid #22c55e44", fontSize:10 }}>Reativar</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {ativos.length === 0 && (
            <div style={{ textAlign:"center", padding:"40px 0" }}>
              <div style={{ fontSize:40, marginBottom:10 }}>👥</div>
              <div style={{ fontSize:14, ...S.txtPrimary, marginBottom:4 }}>Equipe vazia</div>
              <div style={{ fontSize:12, ...S.txtSecondary }}>
                {adminAuth?"Toque em + Cadastrar Colaborador para começar":"Acesso gerencial para cadastrar colaboradores"}
              </div>
            </div>
          )}

          <div style={{ fontSize:10, color:"#1e293b", textAlign:"center", marginTop:4 }}>
            Líder: adicionar FT/Falta/Medida · Gerencial: cadastrar, editar, desligar
          </div>
        </div>
      </div>
    </div>
  );
}

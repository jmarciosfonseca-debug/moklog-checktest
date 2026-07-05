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
const COL = "inquilinos";

function fmtDate(d){ if(!d) return "—"; try{ return new Date(d+"T12:00:00").toLocaleDateString("pt-BR"); }catch{ return d; } }

// Tipos de unidade sugeridos por cliente (o usuário pode digitar qualquer um)
const TIPOS_SUGERIDOS = {
  mega: ["Armazém","Bloco","Barracão","Galpão"],
  golgi: ["Bloco","Armazém","Barracão","Galpão"],
  klog: ["Bloco","Armazém","Barracão","Galpão"],
  jatinox: ["Galpão","Unidade","Armazém","Bloco"],
  default: ["Armazém","Bloco","Barracão","Galpão"],
};

function getCliente(pid) {
  if(["P601","P602","P604","P605","P606","P607"].includes(pid)) return "golgi";
  if(["P311A","P311B"].includes(pid)) return "mega";
  if(pid==="P505") return "klog";
  if(["P260A","P260B","P260C"].includes(pid)) return "jatinox";
  return "default";
}

function getStyles(dark) {
  return {
    page:    {minHeight:"100vh",background:dark?"#04080f":"#f1f5f9",display:"flex",justifyContent:"center",padding:"0 0 80px",fontFamily:"'Segoe UI',system-ui,sans-serif"},
    wrap:    {width:"100%",maxWidth:480,display:"flex",flexDirection:"column"},
    card:    {background:dark?"#060c18":"#fff",border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`,borderRadius:12,padding:"14px 16px"},
    btn:     {background:"linear-gradient(135deg,#1d4ed8,#1e40af)",color:"#fff",border:"none",borderRadius:10,padding:"13px 16px",fontSize:14,fontWeight:700,cursor:"pointer",width:"100%"},
    btnSec:  {background:dark?"#060c18":"#f8fafc",color:dark?"#94a3b8":"#64748b",border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`,borderRadius:10,padding:"11px 16px",fontSize:13,fontWeight:600,cursor:"pointer",width:"100%"},
    btnSm:   {background:dark?"#020510":"#f8fafc",border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`,color:dark?"#94a3b8":"#64748b",borderRadius:6,padding:"5px 10px",fontSize:11,cursor:"pointer",fontWeight:600},
    backBtn: {background:"transparent",border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`,color:dark?"#94a3b8":"#64748b",borderRadius:7,padding:"7px 12px",fontSize:12,cursor:"pointer",flexShrink:0,fontWeight:600},
    inp:     {width:"100%",background:dark?"#020510":"#fff",border:`1px solid ${dark?"#0f172a":"#cbd5e1"}`,borderRadius:7,color:dark?"#e2e8f0":"#1e293b",padding:"10px 12px",fontSize:13,boxSizing:"border-box",outline:"none"},
    lbl:     {display:"block",fontSize:11,color:dark?"#94a3b8":"#64748b",fontWeight:700,marginBottom:4,textTransform:"uppercase",letterSpacing:.5},
    txt:     {color:dark?"#f1f5f9":"#0f172a"},
    txt2:    {color:dark?"#94a3b8":"#64748b"},
  };
}

function gerarPDFInquilinos(project, unidades) {
  const hoje = new Date().toLocaleDateString("pt-BR");
  const ativos = unidades.filter(u=>u.status==="ativo");
  const vazios = unidades.filter(u=>u.status==="vazio");
  const pctOcupacao = unidades.length ? Math.round((ativos.length/unidades.length)*100) : 0;

  const rows = unidades.map(u=>{
    const bg = u.status==="vazio"?"background:#fef2f233":"";
    return `<tr style="${bg}">
      <td style="font-weight:700">${u.tipo} ${u.nome}</td>
      <td style="font-weight:700">${u.inquilino||"—"}</td>
      <td>${u.docas||"—"}</td>
      <td style="text-align:center">${u.opera24h?"✅ 24h":(u.horarioOperacao||"—")}</td>
      <td style="font-size:11px">${u.contato||"—"}</td>
      <td style="text-align:center"><span style="padding:2px 8px;border-radius:5px;font-size:10px;font-weight:700;${u.status==="ativo"?"background:#dcfce7;color:#15803d":"background:#fee2e2;color:#dc2626"}">${u.status==="ativo"?"Ativo":"Vazio"}</span></td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8">
<title>Inquilinos — ${project.id}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;padding:20px;color:#1e293b;font-size:13px}
  .header{background:linear-gradient(135deg,#0f172a,#334155);color:#fff;padding:18px 22px;border-radius:12px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px}
  .kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px}
  .kpi{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:12px;text-align:center}
  .kpi-val{font-size:24px;font-weight:900}
  .kpi-lbl{font-size:9px;color:#64748b;font-weight:700;text-transform:uppercase;margin-top:3px}
  table{width:100%;border-collapse:collapse;font-size:12px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden}
  th{background:#1e293b;color:#fff;padding:7px 10px;text-align:left;font-size:10px;text-transform:uppercase}
  td{padding:6px 10px;border-bottom:1px solid #f1f5f9}
  .footer{text-align:center;margin-top:14px;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px}
  @media print{body{padding:8px}@page{margin:10mm}.no-print{display:none}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}}
</style></head><body>
<div class="no-print" style="text-align:center;margin-bottom:14px">
  <button onclick="window.print()" style="background:#334155;color:#fff;border:none;border-radius:8px;padding:10px 28px;font-size:14px;font-weight:700;cursor:pointer">🖨️ Imprimir / Salvar PDF</button>
</div>
<div class="header">
  <div>
    <p style="font-size:10px;opacity:.7;text-transform:uppercase;letter-spacing:.8px;margin-bottom:3px">Moked Consulting Security</p>
    <h1 style="font-size:18px;font-weight:900;margin-bottom:3px">🏢 Inquilinos e Ocupação</h1>
    <p style="font-size:12px;opacity:.85">${project.id} — ${project.name||""}</p>
  </div>
  <div style="text-align:right;font-size:11px;opacity:.8">
    <div>Gerado em ${hoje}</div>
    <div style="margin-top:2px">José Fonseca — Moked Consulting</div>
  </div>
</div>
<div class="kpis">
  <div class="kpi"><div class="kpi-val" style="color:#0ea5e9">${unidades.length}</div><div class="kpi-lbl">Total Unidades</div></div>
  <div class="kpi"><div class="kpi-val" style="color:#15803d">${ativos.length} <span style="font-size:12px;color:#64748b">(${pctOcupacao}%)</span></div><div class="kpi-lbl">Ocupados</div></div>
  <div class="kpi"><div class="kpi-val" style="color:#dc2626">${vazios.length}</div><div class="kpi-lbl">Vazios</div></div>
</div>
<table>
  <thead><tr><th>Unidade</th><th>Inquilino</th><th>Docas</th><th style="text-align:center">Operação</th><th>Contato</th><th style="text-align:center">Status</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="footer">
  <div>MokLog CheckTest © Moked Consulting Security · Inquilinos</div>
  <div style="margin-top:3px">${project.id} — ${project.name||""} · ${hoje}</div>
</div></body></html>`;

  const blob=new Blob([html],{type:"text/html"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url; a.download=`inquilinos_${project.id}_${hoje.replace(/\//g,"-")}.html`;
  a.click(); URL.revokeObjectURL(url);
}

export default function Inquilinos({ project, onBack, dark, sharedAuth, onAuthGranted }) {
  const S = getStyles(dark);
  const [unidades, setUnidades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [filtro, setFiltro] = useState("todos"); // todos | ativos | vazios

  const adminAuth = sharedAuth==="admin";
  const cliente = getCliente(project.id);
  const tiposSugeridos = TIPOS_SUGERIDOS[cliente] || TIPOS_SUGERIDOS.default;

  // Form state
  const blank = {tipo:tiposSugeridos[0]||"Armazém",nome:"",inquilino:"",docas:"",opera24h:false,horarioOperacao:"",contato:"",status:"ativo"};
  const [form, setForm] = useState({...blank});

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,COL,project.id));
        if(snap.exists()) setUnidades(snap.data().unidades||[]);
      }catch(e){}
      setLoading(false);
    })();
  },[project.id]);

  const salvar = async(lista)=>{
    setSaving(true);
    setUnidades(lista);
    try{ await setDoc(doc(db,COL,project.id),{unidades:lista,updatedAt:new Date().toISOString()}); }catch(e){ console.error(e); }
    setSaving(false);
  };

  const addUnidade = ()=>{
    if(!form.nome.trim()){ alert("Informe o nome/número da unidade."); return; }
    const nova = { ...form, id:crypto.randomUUID(), criadoEm:new Date().toISOString() };
    salvar([...unidades, nova].sort((a,b)=>(a.tipo+a.nome).localeCompare(b.tipo+b.nome)));
    setForm({...blank}); setShowAdd(false);
  };

  const updateUnidade = ()=>{
    if(!form.nome.trim()){ alert("Informe o nome/número da unidade."); return; }
    const lista = unidades.map(u=>u.id===editId?{...u,...form}:u);
    salvar(lista);
    setEditId(null); setForm({...blank});
  };

  const removeUnidade = (id)=>{
    if(!window.confirm("Remover esta unidade? Os dados do inquilino serão perdidos.")) return;
    salvar(unidades.filter(u=>u.id!==id));
  };

  const startEdit = (u)=>{
    setForm({tipo:u.tipo,nome:u.nome,inquilino:u.inquilino||"",docas:u.docas||"",opera24h:!!u.opera24h,horarioOperacao:u.horarioOperacao||"",contato:u.contato||"",status:u.status||"ativo"});
    setEditId(u.id);
    setExpandedId(u.id);
  };

  if(loading) return(
    <div style={{...S.page,alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center"}}><div style={{fontSize:30,marginBottom:10}}>🏢</div><div style={{fontSize:13,...S.txt2}}>Carregando...</div></div>
    </div>
  );

  const filtradas = filtro==="ativos"?unidades.filter(u=>u.status==="ativo"):filtro==="vazios"?unidades.filter(u=>u.status==="vazio"):unidades;
  const ativos = unidades.filter(u=>u.status==="ativo").length;
  const vazios = unidades.filter(u=>u.status==="vazio").length;
  const pctOcup = unidades.length?Math.round((ativos/unidades.length)*100):0;

  return(
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 16px",borderBottom:`1px solid ${dark?"#0a0f1e":"#e2e8f0"}`}}>
          <button onClick={onBack} style={S.backBtn}>← Voltar</button>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:800,...S.txt}}>🏢 Inquilinos e Ocupação</div>
            <div style={{fontSize:11,...S.txt2}}>{project.id} · {project.name}</div>
          </div>
          <button onClick={()=>gerarPDFInquilinos(project, unidades)}
            style={{...S.btnSm,color:"#0ea5e9",borderColor:"#0ea5e944",fontWeight:700,padding:"7px 10px"}}>📄 PDF</button>
        </div>

        <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:10}}>
          {/* KPIs */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
            <div style={{...S.card,textAlign:"center",padding:"10px"}}>
              <div style={{fontSize:20,fontWeight:900,color:"#0ea5e9"}}>{unidades.length}</div>
              <div style={{fontSize:10,...S.txt2,fontWeight:700}}>UNIDADES</div>
            </div>
            <div style={{...S.card,textAlign:"center",padding:"10px"}}>
              <div style={{fontSize:20,fontWeight:900,color:"#22c55e"}}>{pctOcup}%</div>
              <div style={{fontSize:10,...S.txt2,fontWeight:700}}>OCUPAÇÃO</div>
            </div>
            <div style={{...S.card,textAlign:"center",padding:"10px",border:vazios?"1px solid #ef444444":undefined}}>
              <div style={{fontSize:20,fontWeight:900,color:vazios?"#ef4444":"#22c55e"}}>{vazios}</div>
              <div style={{fontSize:10,...S.txt2,fontWeight:700}}>VAZIOS</div>
            </div>
          </div>

          {/* Ações */}
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <button onClick={()=>{setShowAdd(true);setEditId(null);setForm({...blank});}} style={{...S.btnSm,color:"#22c55e",borderColor:"#22c55e44",fontWeight:700,padding:"8px 14px",fontSize:12}}>+ Adicionar Unidade</button>
            <div style={{marginLeft:"auto",display:"flex",gap:4}}>
              {[["todos","Todos"],["ativos","✅ Ativos"],["vazios","🔴 Vazios"]].map(([k,l])=>(
                <button key={k} onClick={()=>setFiltro(k)}
                  style={{...S.btnSm,fontSize:11,padding:"6px 10px",fontWeight:filtro===k?700:500,
                    background:filtro===k?"#1d4ed822":"transparent",
                    color:filtro===k?"#60a5fa":(dark?"#94a3b8":"#64748b"),
                    borderColor:filtro===k?"#1d4ed866":(dark?"#0f172a":"#e2e8f0")
                  }}>{l}</button>
              ))}
            </div>
          </div>

          {/* Form de adicionar */}
          {showAdd&&!editId&&(
            <div style={{...S.card,border:"1px solid #22c55e44"}}>
              <div style={{fontSize:13,fontWeight:800,...S.txt,marginBottom:10}}>Nova Unidade</div>
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <div>
          <label style={S.lbl}>Tipo de unidade</label>
          <select value={form.tipo} onChange={e=>setForm(f=>({...f,tipo:e.target.value}))} style={S.inp}>
            {tiposSugeridos.map(t=><option key={t} value={t}>{t}</option>)}
            {!tiposSugeridos.includes(form.tipo)&&<option value={form.tipo}>{form.tipo}</option>}
            <option value="__outro">Outro...</option>
          </select>
          {form.tipo==="__outro"&&<input style={{...S.inp,marginTop:6}} placeholder="Tipo customizado..." onChange={e=>setForm(f=>({...f,tipo:e.target.value}))}/>}
        </div>
        <div>
          <label style={S.lbl}>Número / Nome</label>
          <input value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))} placeholder={form.tipo==="Armazém"?"Ex: A, B, 01...":form.tipo==="Bloco"?"Ex: A, 100, 200...":"Ex: 01, 02..."} style={S.inp}/>
        </div>
      </div>
      <div>
        <label style={S.lbl}>Inquilino (empresa)</label>
        <input value={form.inquilino} onChange={e=>setForm(f=>({...f,inquilino:e.target.value}))} placeholder="Nome da empresa locatária" style={S.inp}/>
      </div>
      <div>
        <label style={S.lbl}>Faixa de docas</label>
        <input value={form.docas} onChange={e=>setForm(f=>({...f,docas:e.target.value}))} placeholder="Ex: 80 a 112" style={S.inp}/>
      </div>
      <div>
        <label style={S.lbl}>Operação</label>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setForm(f=>({...f,opera24h:true,horarioOperacao:""}))}
            style={{...S.btnSm,flex:1,padding:"10px",fontSize:13,fontWeight:700,...(form.opera24h?{background:"#22c55e22",borderColor:"#22c55e66",color:"#22c55e"}:{})}}>🕐 24h</button>
          <button onClick={()=>setForm(f=>({...f,opera24h:false}))}
            style={{...S.btnSm,flex:1,padding:"10px",fontSize:13,fontWeight:700,...(!form.opera24h?{background:"#f59e0b22",borderColor:"#f59e0b66",color:"#f59e0b"}:{})}}>⏰ Horário definido</button>
        </div>
        {!form.opera24h&&<input value={form.horarioOperacao} onChange={e=>setForm(f=>({...f,horarioOperacao:e.target.value}))} placeholder="Ex: 06h às 22h, Seg a Sex" style={{...S.inp,marginTop:6}}/>}
      </div>
      <div>
        <label style={S.lbl}>Contato do responsável</label>
        <input value={form.contato} onChange={e=>setForm(f=>({...f,contato:e.target.value}))} placeholder="Nome — (xx) xxxxx-xxxx" style={S.inp}/>
      </div>
      <div>
        <label style={S.lbl}>Status</label>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setForm(f=>({...f,status:"ativo"}))}
            style={{...S.btnSm,flex:1,padding:"10px",fontSize:13,fontWeight:700,...(form.status==="ativo"?{background:"#22c55e22",borderColor:"#22c55e66",color:"#22c55e"}:{})}}>✅ Ativo</button>
          <button onClick={()=>setForm(f=>({...f,status:"vazio",inquilino:"",docas:"",opera24h:false,horarioOperacao:"",contato:""}))}
            style={{...S.btnSm,flex:1,padding:"10px",fontSize:13,fontWeight:700,...(form.status==="vazio"?{background:"#ef444422",borderColor:"#ef444466",color:"#ef4444"}:{})}}>🔴 Vazio</button>
        </div>
      </div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={()=>{setShowAdd(false);setEditId(null);setForm({...blank});}} style={{...S.btnSec,fontSize:13}}>Cancelar</button>
        <button onClick={addUnidade} style={{...S.btn,fontSize:13}}>✓ Adicionar</button>
      </div>
    </div>
            </div>
          )}

          {/* Lista */}
          {filtradas.length===0&&<div style={{textAlign:"center",padding:"30px 0",...S.txt2,fontSize:13}}>
            {unidades.length===0?"Nenhuma unidade cadastrada ainda.":"Nenhuma unidade neste filtro."}
          </div>}

          {filtradas.map(u=>{
            const isExpanded = expandedId===u.id;
            const isEditing = editId===u.id;
            return(
              <div key={u.id} style={{...S.card,border:`1px solid ${u.status==="vazio"?"#ef444444":dark?"#0f172a":"#e2e8f0"}`,overflow:"hidden"}}>
                {/* Header — clicável pra expandir */}
                <div onClick={()=>setExpandedId(isExpanded?null:u.id)} style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",userSelect:"none"}}>
                  <div style={{width:40,height:40,borderRadius:10,background:u.status==="ativo"?(dark?"#021a0d":"#f0fdf4"):(dark?"#1a0202":"#fef2f2"),display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <span style={{fontSize:20}}>{u.status==="ativo"?"🏢":"🔴"}</span>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:800,...S.txt}}>{u.tipo} {u.nome}</div>
                    <div style={{fontSize:12,...S.txt2}}>{u.status==="ativo"?(u.inquilino||"Sem inquilino"):"Vazio"}</div>
                  </div>
                  {u.status==="ativo"&&u.opera24h&&<span style={{fontSize:10,color:"#22c55e",fontWeight:700,background:"#22c55e11",padding:"2px 8px",borderRadius:5}}>24h</span>}
                  <span style={{color:dark?"#475569":"#94a3b8",fontSize:14,flexShrink:0,transform:isExpanded?"rotate(90deg)":"none",transition:"transform .15s"}}>▸</span>
                </div>

                {/* Corpo expandido */}
                {isExpanded&&!isEditing&&(
                  <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${dark?"#0f172a":"#f1f5f9"}`,display:"flex",flexDirection:"column",gap:6}}>
                    {u.inquilino&&<div style={{fontSize:13,...S.txt}}><span style={{...S.txt2,fontSize:11}}>Inquilino: </span><strong>{u.inquilino}</strong></div>}
                    {u.docas&&<div style={{fontSize:13,...S.txt}}><span style={{...S.txt2,fontSize:11}}>Docas: </span>{u.docas}</div>}
                    <div style={{fontSize:13,...S.txt}}><span style={{...S.txt2,fontSize:11}}>Operação: </span>{u.opera24h?"24 horas":(u.horarioOperacao||"Não informado")}</div>
                    {u.contato&&<div style={{fontSize:13,...S.txt}}><span style={{...S.txt2,fontSize:11}}>Contato: </span>{u.contato}</div>}
                    {adminAuth&&(
                      <div style={{display:"flex",gap:8,marginTop:6}}>
                        <button onClick={()=>startEdit(u)} style={{...S.btnSm,color:"#f59e0b",borderColor:"#f59e0b44",padding:"7px 12px",fontSize:12,fontWeight:700}}>✏️ Editar</button>
                        <button onClick={()=>removeUnidade(u.id)} style={{...S.btnSm,color:"#ef4444",borderColor:"#ef444444",padding:"7px 12px",fontSize:12}}>🗑 Remover</button>
                      </div>
                    )}
                    {!adminAuth&&(
                      <div style={{display:"flex",gap:8,marginTop:6}}>
                        <button onClick={()=>startEdit(u)} style={{...S.btnSm,color:"#f59e0b",borderColor:"#f59e0b44",padding:"7px 12px",fontSize:12,fontWeight:700}}>✏️ Editar</button>
                      </div>
                    )}
                  </div>
                )}

                {/* Form de edição inline */}
                {isExpanded&&isEditing&&(
                  <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${dark?"#0f172a":"#f1f5f9"}`}}>
                        <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <div>
          <label style={S.lbl}>Tipo de unidade</label>
          <select value={form.tipo} onChange={e=>setForm(f=>({...f,tipo:e.target.value}))} style={S.inp}>
            {tiposSugeridos.map(t=><option key={t} value={t}>{t}</option>)}
            {!tiposSugeridos.includes(form.tipo)&&<option value={form.tipo}>{form.tipo}</option>}
            <option value="__outro">Outro...</option>
          </select>
          {form.tipo==="__outro"&&<input style={{...S.inp,marginTop:6}} placeholder="Tipo customizado..." onChange={e=>setForm(f=>({...f,tipo:e.target.value}))}/>}
        </div>
        <div>
          <label style={S.lbl}>Número / Nome</label>
          <input value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))} placeholder={form.tipo==="Armazém"?"Ex: A, B, 01...":form.tipo==="Bloco"?"Ex: A, 100, 200...":"Ex: 01, 02..."} style={S.inp}/>
        </div>
      </div>
      <div>
        <label style={S.lbl}>Inquilino (empresa)</label>
        <input value={form.inquilino} onChange={e=>setForm(f=>({...f,inquilino:e.target.value}))} placeholder="Nome da empresa locatária" style={S.inp}/>
      </div>
      <div>
        <label style={S.lbl}>Faixa de docas</label>
        <input value={form.docas} onChange={e=>setForm(f=>({...f,docas:e.target.value}))} placeholder="Ex: 80 a 112" style={S.inp}/>
      </div>
      <div>
        <label style={S.lbl}>Operação</label>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setForm(f=>({...f,opera24h:true,horarioOperacao:""}))}
            style={{...S.btnSm,flex:1,padding:"10px",fontSize:13,fontWeight:700,...(form.opera24h?{background:"#22c55e22",borderColor:"#22c55e66",color:"#22c55e"}:{})}}>🕐 24h</button>
          <button onClick={()=>setForm(f=>({...f,opera24h:false}))}
            style={{...S.btnSm,flex:1,padding:"10px",fontSize:13,fontWeight:700,...(!form.opera24h?{background:"#f59e0b22",borderColor:"#f59e0b66",color:"#f59e0b"}:{})}}>⏰ Horário definido</button>
        </div>
        {!form.opera24h&&<input value={form.horarioOperacao} onChange={e=>setForm(f=>({...f,horarioOperacao:e.target.value}))} placeholder="Ex: 06h às 22h, Seg a Sex" style={{...S.inp,marginTop:6}}/>}
      </div>
      <div>
        <label style={S.lbl}>Contato do responsável</label>
        <input value={form.contato} onChange={e=>setForm(f=>({...f,contato:e.target.value}))} placeholder="Nome — (xx) xxxxx-xxxx" style={S.inp}/>
      </div>
      <div>
        <label style={S.lbl}>Status</label>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setForm(f=>({...f,status:"ativo"}))}
            style={{...S.btnSm,flex:1,padding:"10px",fontSize:13,fontWeight:700,...(form.status==="ativo"?{background:"#22c55e22",borderColor:"#22c55e66",color:"#22c55e"}:{})}}>✅ Ativo</button>
          <button onClick={()=>setForm(f=>({...f,status:"vazio",inquilino:"",docas:"",opera24h:false,horarioOperacao:"",contato:""}))}
            style={{...S.btnSm,flex:1,padding:"10px",fontSize:13,fontWeight:700,...(form.status==="vazio"?{background:"#ef444422",borderColor:"#ef444466",color:"#ef4444"}:{})}}>🔴 Vazio</button>
        </div>
      </div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={()=>{setShowAdd(false);setEditId(null);setForm({...blank});}} style={{...S.btnSec,fontSize:13}}>Cancelar</button>
        <button onClick={updateUnidade} style={{...S.btn,fontSize:13}}>✓ Salvar alterações</button>
      </div>
    </div>
                  </div>
                )}
              </div>
            );
          })}

          {saving&&<div style={{textAlign:"center",fontSize:12,...S.txt2}}>Salvando...</div>}
        </div>
      </div>
    </div>
  );
}

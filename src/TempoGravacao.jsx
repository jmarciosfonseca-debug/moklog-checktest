import { useState, useEffect } from "react";

const COL = "cftv_gravacao";

function todayStr(){ return new Date().toLocaleDateString("sv-SE"); }
function fmtDate(d){ if(!d) return "—"; try{ return new Date(d+"T12:00:00").toLocaleDateString("pt-BR"); }catch{ return d; } }
function fmtDateTime(ts){ if(!ts) return "—"; try{ const d=new Date(ts); return d.toLocaleDateString("pt-BR")+" "+d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}); }catch{ return ts; } }

function gerarPDFGravacao(project, cameras) {
  const hoje = new Date().toLocaleDateString("pt-BR");
  const sorted = [...cameras].sort((a,b)=>(a.diasGravacao||0)-(b.diasGravacao||0));
  const abaixo30 = sorted.filter(c=>c.diasGravacao!==null && c.diasGravacao!==undefined && c.diasGravacao<30);

  const rows = sorted.map((c,i)=>{
    const dias = c.diasGravacao!==null&&c.diasGravacao!==undefined ? c.diasGravacao : null;
    const cor = dias===null?"#94a3b8":dias<15?"#dc2626":dias<30?"#d97706":"#15803d";
    const bg = dias===null?"":"style=\"background:"+(dias<15?"#fef2f2":dias<30?"#fffbeb":"")+"\"";
    return `<tr ${bg}>
      <td style="text-align:center;font-weight:800;color:#475569">${i+1}</td>
      <td style="font-weight:700">${c.nome||"—"}</td>
      <td style="font-size:11px;color:#64748b">${c.especificacao||"—"}</td>
      <td style="text-align:center;font-weight:800;color:${cor}">${dias!==null?dias+"d":"—"}</td>
      <td style="font-size:11px;color:#64748b">${fmtDateTime(c.ultimaChecagem)||"—"}</td>
      <td style="font-size:11px;color:#64748b">${c.checadoPor||"—"}</td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8">
<title>CFTV Tempo de Gravação — ${project.id}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;padding:20px;color:#1e293b;font-size:13px}
  .header{background:linear-gradient(135deg,#0f172a,#1e3a8a);color:#fff;padding:18px 22px;border-radius:12px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px}
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
  <button onclick="window.print()" style="background:#1e3a8a;color:#fff;border:none;border-radius:8px;padding:10px 28px;font-size:14px;font-weight:700;cursor:pointer">🖨️ Imprimir / Salvar PDF</button>
</div>
<div class="header">
  <div>
    <p style="font-size:10px;opacity:.7;text-transform:uppercase;letter-spacing:.8px;margin-bottom:3px">Moked Consulting Security</p>
    <h1 style="font-size:18px;font-weight:900;margin-bottom:3px">📹 CFTV — Tempo de Gravação</h1>
    <p style="font-size:12px;opacity:.85">${project.id} — ${project.name||""}</p>
  </div>
  <div style="text-align:right;font-size:11px;opacity:.8">
    <div>Gerado em ${hoje}</div>
    <div style="margin-top:2px">José Fonseca — Moked Consulting</div>
  </div>
</div>
<div class="kpis">
  <div class="kpi"><div class="kpi-val" style="color:#0ea5e9">${cameras.length}</div><div class="kpi-lbl">Total Câmeras</div></div>
  <div class="kpi"><div class="kpi-val" style="color:#dc2626">${abaixo30.length}</div><div class="kpi-lbl">Abaixo de 30 dias</div></div>
  <div class="kpi"><div class="kpi-val" style="color:#15803d">${cameras.filter(c=>c.diasGravacao>=30).length}</div><div class="kpi-lbl">≥ 30 dias OK</div></div>
</div>
<table>
  <thead><tr><th>#</th><th>Câmera</th><th>Especificação</th><th style="text-align:center">Gravação</th><th>Última Checagem</th><th>Checado por</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="footer">
  <div>MokLog CheckTest © Moked Consulting Security · CFTV Tempo de Gravação</div>
  <div style="margin-top:3px">${project.id} — ${project.name||""} · ${hoje}</div>
</div></body></html>`;

  const blob=new Blob([html],{type:"text/html"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url; a.download=`cftv_gravacao_${project.id}_${hoje.replace(/\//g,"-")}.html`;
  a.click(); URL.revokeObjectURL(url);
}

export default function TempoGravacao({ project, dark, S, adminAuth, db, doc, setDoc, getDoc, loadEquipe }) {
  const [cameras, setCameras] = useState([]);
  const [equipe, setEquipe] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addNome, setAddNome] = useState("");
  const [addEspec, setAddEspec] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editDias, setEditDias] = useState("");
  const [editPor, setEditPor] = useState("");
  const [filtro, setFiltro] = useState("todos"); // todos | alerta | ok

  useEffect(()=>{
    (async()=>{
      try{
        const snap = await getDoc(doc(db,COL,project.id));
        if(snap.exists()) setCameras(snap.data().cameras||[]);
      }catch(e){}
      try{
        const eq = await loadEquipe(project.id);
        setEquipe((eq||[]).filter(c=>c.status==="ativo"));
      }catch(e){}
      setLoading(false);
    })();
  },[project.id]);

  const salvar = async (lista) => {
    setSaving(true);
    setCameras(lista);
    try{ await setDoc(doc(db,COL,project.id),{ cameras:lista, updatedAt:new Date().toISOString() }); }catch(e){ console.error(e); }
    setSaving(false);
  };

  const addCamera = () => {
    if(!addNome.trim()) return;
    const nova = { id:crypto.randomUUID(), nome:addNome.trim(), especificacao:addEspec.trim(), diasGravacao:null, ultimaChecagem:null, checadoPor:"" };
    salvar([...cameras, nova]);
    setAddNome(""); setAddEspec(""); setShowAdd(false);
  };

  const removeCamera = (id) => {
    if(!window.confirm("Remover esta câmera da lista?")) return;
    salvar(cameras.filter(c=>c.id!==id));
  };

  const registrarChecagem = (id) => {
    const dias = parseFloat(editDias);
    if(isNaN(dias)||dias<0){ alert("Informe um valor válido de dias."); return; }
    const lista = cameras.map(c=>c.id===id?{...c, diasGravacao:dias, ultimaChecagem:new Date().toISOString(), checadoPor:editPor||"—"}:c);
    salvar(lista);
    setEditingId(null); setEditDias(""); setEditPor("");
  };

  if(loading) return(
    <div style={{textAlign:"center",padding:"40px 0"}}>
      <div style={{fontSize:28,marginBottom:8}}>📹</div>
      <div style={{fontSize:13,...S.txt2}}>Carregando câmeras...</div>
    </div>
  );

  const filtradas = filtro==="alerta" ? cameras.filter(c=>c.diasGravacao!==null&&c.diasGravacao<30) :
                    filtro==="ok"     ? cameras.filter(c=>c.diasGravacao>=30) : cameras;
  const abaixo30 = cameras.filter(c=>c.diasGravacao!==null&&c.diasGravacao!==undefined&&c.diasGravacao<30).length;
  const semChecagem = cameras.filter(c=>c.diasGravacao===null||c.diasGravacao===undefined).length;

  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
        <div style={{...S.card,textAlign:"center",padding:"10px"}}>
          <div style={{fontSize:20,fontWeight:900,color:"#0ea5e9"}}>{cameras.length}</div>
          <div style={{fontSize:10,...S.txt2,fontWeight:700}}>TOTAL</div>
        </div>
        <div style={{...S.card,textAlign:"center",padding:"10px",border:abaixo30>0?"1px solid #ef444444":undefined}}>
          <div style={{fontSize:20,fontWeight:900,color:abaixo30>0?"#ef4444":"#22c55e"}}>{abaixo30}</div>
          <div style={{fontSize:10,...S.txt2,fontWeight:700}}>{"<"} 30 DIAS</div>
        </div>
        <div style={{...S.card,textAlign:"center",padding:"10px"}}>
          <div style={{fontSize:20,fontWeight:900,color:semChecagem>0?"#f59e0b":"#22c55e"}}>{semChecagem}</div>
          <div style={{fontSize:10,...S.txt2,fontWeight:700}}>SEM CHECK</div>
        </div>
      </div>

      {/* Ações */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <button onClick={()=>setShowAdd(true)} style={{...S.btnSm,color:"#22c55e",borderColor:"#22c55e44",fontWeight:700,padding:"8px 14px",fontSize:12}}>+ Adicionar Câmera</button>
        <button onClick={()=>gerarPDFGravacao(project, cameras)} style={{...S.btnSm,color:"#0ea5e9",borderColor:"#0ea5e944",fontWeight:700,padding:"8px 14px",fontSize:12}}>📄 PDF</button>
        <div style={{marginLeft:"auto",display:"flex",gap:4}}>
          {[["todos","Todos"],["alerta","⚠ <30d"],["ok","✅ OK"]].map(([k,l])=>(
            <button key={k} onClick={()=>setFiltro(k)}
              style={{...S.btnSm,fontSize:11,padding:"6px 10px",fontWeight:filtro===k?700:500,
                background:filtro===k?(k==="alerta"?"#ef444422":k==="ok"?"#22c55e22":"#1d4ed822"):"transparent",
                color:filtro===k?(k==="alerta"?"#ef4444":k==="ok"?"#22c55e":"#60a5fa"):(dark?"#94a3b8":"#64748b"),
                borderColor:filtro===k?(k==="alerta"?"#ef444466":k==="ok"?"#22c55e66":"#1d4ed866"):(dark?"#0f172a":"#e2e8f0")
              }}>{l}</button>
          ))}
        </div>
      </div>

      {/* Form de adicionar */}
      {showAdd&&(
        <div style={{...S.card,display:"flex",flexDirection:"column",gap:8,border:"1px solid #22c55e44"}}>
          <div style={{fontSize:12,fontWeight:700,...S.txt}}>Nova Câmera</div>
          <input value={addNome} onChange={e=>setAddNome(e.target.value)} placeholder="Nome da câmera (ex: CAM-01 Doca Norte)" style={{...S.inp,fontSize:13}}/>
          <input value={addEspec} onChange={e=>setAddEspec(e.target.value)} placeholder="Especificação (ex: Hikvision DS-2CD2T47, 4MP)" style={{...S.inp,fontSize:12}}/>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>{setShowAdd(false);setAddNome("");setAddEspec("");}} style={{...S.btnSec,flex:1,fontSize:13}}>Cancelar</button>
            <button onClick={addCamera} style={{...S.btn,flex:1,fontSize:13}}>✓ Adicionar</button>
          </div>
        </div>
      )}

      {/* Lista de câmeras */}
      {filtradas.length===0&&(
        <div style={{textAlign:"center",padding:"30px 0",...S.txt2,fontSize:13}}>
          {cameras.length===0?"Nenhuma câmera cadastrada — toque em + Adicionar":"Nenhuma câmera neste filtro."}
        </div>
      )}

      {filtradas.map(cam=>{
        const dias = cam.diasGravacao;
        const temDias = dias!==null&&dias!==undefined;
        const cor = !temDias?"#94a3b8":dias<15?"#ef4444":dias<30?"#f59e0b":"#22c55e";
        const isEditing = editingId===cam.id;
        return(
          <div key={cam.id} style={{...S.card,border:`1px solid ${temDias&&dias<30?cor+"44":(dark?"#0f172a":"#e2e8f0")}`}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:42,height:42,borderRadius:10,background:dark?"#0a0f1e":"#f1f5f9",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <span style={{fontSize:20}}>📹</span>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:800,...S.txt}}>{cam.nome}</div>
                {cam.especificacao&&<div style={{fontSize:11,...S.txt2,marginTop:1}}>{cam.especificacao}</div>}
                <div style={{display:"flex",gap:10,marginTop:4,flexWrap:"wrap",alignItems:"center"}}>
                  <span style={{fontSize:13,fontWeight:900,color:cor}}>{temDias?dias+"d":"—"}</span>
                  {temDias&&<span style={{fontSize:10,padding:"2px 7px",borderRadius:5,fontWeight:700,
                    background:dias<15?"#fef2f2":dias<30?"#fffbeb":"#f0fdf4",
                    color:cor,border:`1px solid ${cor}33`}}>{dias<15?"Crítico":dias<30?"Atenção":"OK"}</span>}
                  {cam.ultimaChecagem&&<span style={{fontSize:10,...S.txt2}}>Check: {fmtDateTime(cam.ultimaChecagem)}</span>}
                </div>
              </div>
              <button onClick={()=>{setEditingId(isEditing?null:cam.id);setEditDias(temDias?String(dias):"");setEditPor("");}}
                style={{...S.btnSm,color:"#0ea5e9",borderColor:"#0ea5e944",padding:"7px 10px",fontSize:11,fontWeight:700,flexShrink:0}}>
                {isEditing?"✕":"📝 Check"}
              </button>
            </div>

            {isEditing&&(
              <div style={{marginTop:10,padding:"10px 12px",background:dark?"#020510":"#f8fafc",borderRadius:8,display:"flex",flexDirection:"column",gap:8}}>
                <div>
                  <label style={S.lbl}>Tempo de gravação (dias)</label>
                  <input type="number" inputMode="decimal" min="0" step="1" value={editDias}
                    onChange={e=>setEditDias(e.target.value)} placeholder="Ex: 25" style={{...S.inp,fontSize:14,fontWeight:700}}/>
                </div>
                <div>
                  <label style={S.lbl}>Checado por</label>
                  {equipe.length>0?(
                    <select value={editPor} onChange={e=>setEditPor(e.target.value)} style={S.inp}>
                      <option value="">— Selecione —</option>
                      {equipe.map(c=><option key={c.id||c.nome} value={c.nome}>{c.nome} · {c.cargo||""}</option>)}
                    </select>
                  ):(
                    <input value={editPor} onChange={e=>setEditPor(e.target.value)} placeholder="Nome..." style={S.inp}/>
                  )}
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>setEditingId(null)} style={{...S.btnSec,flex:1,fontSize:13}}>Cancelar</button>
                  <button onClick={()=>registrarChecagem(cam.id)} style={{...S.btn,flex:1,fontSize:13}}>✓ Registrar</button>
                </div>
              </div>
            )}

            {adminAuth&&!isEditing&&(
              <div style={{marginTop:6,display:"flex",justifyContent:"flex-end"}}>
                <button onClick={()=>removeCamera(cam.id)} style={{background:"transparent",border:"none",color:"#ef444466",fontSize:11,cursor:"pointer",padding:"4px 8px"}}>🗑 Remover</button>
              </div>
            )}
          </div>
        );
      })}

      {saving&&<div style={{textAlign:"center",fontSize:12,...S.txt2}}>Salvando...</div>}
    </div>
  );
}

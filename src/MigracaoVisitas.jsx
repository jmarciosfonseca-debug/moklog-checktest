// ════════════════════════════════════════════════════════════════════════
// MigracaoVisitas.jsx — Ferramenta de migração (uso gerencial, pontual)
// MokLog CheckTest · Moked Consulting Security
//
// O QUE FAZ: copia as visitas de SEGURANÇA de empresa_info/{projectId}
// (campo seguranca.visitas[]) para cco_supervisao/{projectId} (registros[]),
// SEM apagar a origem. Idempotente: rodar de novo não duplica (usa id "mig_").
//
// SEGURANÇA:
//   - Não toca em manutencao.visitas (fora de escopo).
//   - Só atua em projetos COM aba CCO. P260B/P260C ficam intactos.
//   - Preview obrigatório antes de gravar. Migração por projeto, sob confirmação.
//   - Mantém os dados nos dois lugares (reversível).
//
// Coleções:
//   ORIGEM : empresa_info/{pid}     { seguranca:{ supervisor, visitas:[{id,data,turno,resumo}] }, ... }
//   DESTINO: cco_supervisao/{pid}   { registros:[ {id,data,turno,supervisor,chegada,saida,resumo,equipamentos,obs,arquivado,...} ] }
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

// Projetos COM aba CCO (recebem migração). P260B/C ficam de fora.
const PROJETOS_COM_CCO = [
  { id:"P601", name:"Golgi Cajamar" },
  { id:"P602", name:"Golgi Mauá" },
  { id:"P604", name:"Golgi Jundiaí" },
  { id:"P605", name:"Golgi Dutra" },
  { id:"P606", name:"Golgi Duque de Caxias" },
  { id:"P607", name:"Golgi Brasília" },
  { id:"P311A", name:"Mega CL Curitiba" },
  { id:"P311B", name:"Mega CL Itajaí" },
  { id:"P505", name:"Klog Guarulhos" },
  { id:"P260A", name:"Jatinox Unidade A" },
];

const COL_ORIGEM = "empresa_info";
const COL_DESTINO = "cco_supervisao";

function fmtDate(d){ if(!d) return "--"; try{ return new Date(d+"T12:00:00").toLocaleDateString("pt-BR"); }catch{ return d; } }

// Converte uma visita de segurança -> registro de supervisão do CCO.
function migrarVisita(v, supervisorCabecalho){
  return {
    id: "mig_" + (v.id || (Date.now().toString()+Math.random().toString(36).slice(2,6))),
    data: v.data || "",
    turno: (v.turno||"").toLowerCase()==="noturno" ? "noturno" : "diurno",
    supervisor: supervisorCabecalho || "",
    chegada: "",
    saida: "",
    resumo: v.resumo || "",
    equipamentos: [],
    obs: "",
    arquivado: false,
    origem: "empresa_info",
    migradoEm: new Date().toISOString(),
    registradoEm: v.data ? (v.data+"T12:00:00.000Z") : new Date().toISOString(),
  };
}

async function lerOrigem(pid){
  try { const s = await getDoc(doc(db,COL_ORIGEM,pid)); if(s.exists()) return s.data(); } catch(e){}
  try { const l = localStorage.getItem(`${COL_ORIGEM}_${pid}`); if(l) return JSON.parse(l); } catch(e){}
  return null;
}
async function lerDestino(pid){
  try { const s = await getDoc(doc(db,COL_DESTINO,pid)); if(s.exists()) return s.data().registros||[]; } catch(e){}
  try { const l = localStorage.getItem(`${COL_DESTINO}_${pid}`); if(l) return JSON.parse(l); } catch(e){}
  return [];
}
async function gravarDestino(pid, registros){
  try { await setDoc(doc(db,COL_DESTINO,pid),{ registros, updatedAt:new Date().toISOString() }); }
  catch(e){ console.error("Migração — erro ao gravar destino:",e); throw e; }
  try { localStorage.setItem(`${COL_DESTINO}_${pid}`, JSON.stringify(registros)); } catch(e){}
}

// Calcula o preview de um projeto sem gravar nada.
async function analisar(pid){
  const origem = await lerOrigem(pid);
  const visitas = origem?.seguranca?.visitas || [];
  const supervisor = origem?.seguranca?.supervisor || "";
  const destino = await lerDestino(pid);
  const idsDestino = new Set(destino.map(r=>r.id));
  const convertidas = visitas.map(v=>migrarVisita(v, supervisor));
  const novas = convertidas.filter(c=>!idsDestino.has(c.id));
  const jaMigradas = convertidas.length - novas.length;
  return { pid, totalOrigem:visitas.length, novas, jaMigradas, supervisor, destinoAtual:destino.length };
}

export default function MigracaoVisitas({ dark=true, onBack }){
  const [pin, setPin] = useState("");
  const [auth, setAuth] = useState(false);
  const [pinErr, setPinErr] = useState(false);
  const [previews, setPreviews] = useState({});      // pid -> análise
  const [loading, setLoading] = useState(false);
  const [migrando, setMigrando] = useState(null);     // pid em migração
  const [resultado, setResultado] = useState({});     // pid -> "ok" | "erro"
  const [confirm, setConfirm] = useState(null);       // pid aguardando confirmação

  const bg=dark?"#04080f":"#f1f5f9", cardBg=dark?"#060c18":"#fff", border=dark?"#0f172a":"#e2e8f0";
  const txt=dark?"#f1f5f9":"#0f172a", txt2=dark?"#475569":"#64748b";
  const inp={width:"100%",background:dark?"#020510":"#fff",border:`1px solid ${border}`,borderRadius:7,color:txt,padding:"10px 12px",fontSize:13,boxSizing:"border-box",outline:"none"};
  const btn={background:"linear-gradient(135deg,#1d4ed8,#1e40af)",color:"#fff",border:"none",borderRadius:10,padding:"12px 16px",fontSize:14,fontWeight:700,cursor:"pointer"};
  const btnSec={background:cardBg,color:txt2,border:`1px solid ${border}`,borderRadius:10,padding:"12px 16px",fontSize:14,fontWeight:600,cursor:"pointer"};
  const btnSm={background:dark?"#020510":"#f8fafc",border:`1px solid ${border}`,color:txt2,borderRadius:6,padding:"6px 12px",fontSize:12,cursor:"pointer",fontWeight:600};

  const carregarPreviews = async () => {
    setLoading(true);
    const res = {};
    for(const p of PROJETOS_COM_CCO){
      try { res[p.id] = await analisar(p.id); }
      catch(e){ res[p.id] = { pid:p.id, erro:true }; }
    }
    setPreviews(res);
    setLoading(false);
  };

  useEffect(()=>{ if(auth) carregarPreviews(); },[auth]);

  const executarMigracao = async (pid) => {
    setConfirm(null);
    setMigrando(pid);
    try {
      const prev = previews[pid];
      if(!prev || !prev.novas.length){ setMigrando(null); return; }
      const destinoAtual = await lerDestino(pid);
      const idsDestino = new Set(destinoAtual.map(r=>r.id));
      const adicionar = prev.novas.filter(n=>!idsDestino.has(n.id)); // dupla checagem
      const novaLista = [...adicionar, ...destinoAtual];
      await gravarDestino(pid, novaLista);
      setResultado(r=>({...r,[pid]:"ok"}));
      // recarrega o preview desse projeto (agora deve mostrar 0 novas)
      const novoPrev = await analisar(pid);
      setPreviews(p=>({...p,[pid]:novoPrev}));
    } catch(e){
      console.error(e);
      setResultado(r=>({...r,[pid]:"erro"}));
    }
    setMigrando(null);
  };

  // ── PIN gate
  if(!auth) return (
    <div style={{minHeight:"100vh",background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
      <div style={{background:cardBg,border:`1px solid ${border}`,borderRadius:16,padding:"28px 24px",maxWidth:340,width:"100%",textAlign:"center",margin:16}}>
        <div style={{fontSize:32,marginBottom:8}}>🔄</div>
        <div style={{fontSize:16,fontWeight:800,color:txt,marginBottom:4}}>Migração de Visitas</div>
        <div style={{fontSize:12,color:txt2,marginBottom:6}}>Empresas → CCO Supervisão</div>
        <div style={{fontSize:11,color:"#f59e0b",marginBottom:18}}>Ferramenta gerencial · uso pontual</div>
        <input type="password" inputMode="numeric" placeholder="PIN gerencial" maxLength={8} value={pin}
          onChange={e=>{setPin(e.target.value);setPinErr(false);}}
          onKeyDown={e=>{if(e.key==="Enter"){ if(pin===ADMIN_PIN) setAuth(true); else setPinErr(true); }}}
          style={{...inp,textAlign:"center",fontSize:22,letterSpacing:10,marginBottom:8}}/>
        {pinErr && <div style={{fontSize:12,color:"#ef4444",marginBottom:8}}>PIN incorreto</div>}
        <div style={{display:"flex",gap:8}}>
          {onBack && <button onClick={onBack} style={{...btnSec,flex:1}}>← Voltar</button>}
          <button onClick={()=>{ if(pin===ADMIN_PIN) setAuth(true); else setPinErr(true); }} style={{...btn,flex:1}}>Entrar</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:bg,display:"flex",justifyContent:"center",fontFamily:"'Segoe UI',system-ui,sans-serif",paddingBottom:60}}>
      <div style={{width:"100%",maxWidth:520}}>
        <div style={{position:"sticky",top:0,zIndex:10,background:bg,borderBottom:`1px solid ${border}`,padding:"14px 16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {onBack && <button onClick={onBack} style={{...btnSec,padding:"7px 12px",fontSize:12}}>← Voltar</button>}
            <div style={{flex:1}}>
              <div style={{fontSize:15,fontWeight:800,color:txt}}>🔄 Migração de Visitas</div>
              <div style={{fontSize:11,color:txt2}}>Segurança (Empresas) → CCO Supervisão</div>
            </div>
            <button onClick={carregarPreviews} style={btnSm}>↻ Atualizar</button>
          </div>
        </div>

        <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:10}}>
          <div style={{background:dark?"#001a2e":"#e0f2fe",border:"1px solid #0ea5e933",borderRadius:10,padding:"10px 14px",fontSize:12,color:dark?"#7dd3fc":"#0369a1",lineHeight:1.6}}>
            As visitas são <strong>copiadas</strong> para o CCO, sem apagar de Empresas. Pode rodar mais de uma vez — não duplica. P260B e P260C não aparecem aqui (não têm CCO).
          </div>

          {loading ? (
            <div style={{textAlign:"center",padding:"40px 0",color:txt2}}>
              <div style={{fontSize:28,marginBottom:8}}>🔄</div>Analisando projetos...
            </div>
          ) : (
            PROJETOS_COM_CCO.map(p=>{
              const prev = previews[p.id];
              const res = resultado[p.id];
              const isMig = migrando===p.id;
              if(!prev) return null;
              if(prev.erro) return (
                <div key={p.id} style={{background:cardBg,border:"1px solid #ef444433",borderRadius:12,padding:"12px 14px"}}>
                  <div style={{fontSize:13,fontWeight:700,color:txt}}>{p.id} — {p.name}</div>
                  <div style={{fontSize:11,color:"#ef4444"}}>Erro ao ler dados deste projeto.</div>
                </div>
              );
              const nNovas = prev.novas.length;
              return (
                <div key={p.id} style={{background:cardBg,border:`1px solid ${nNovas>0?"#0ea5e944":border}`,borderRadius:12,padding:"12px 14px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:700,color:txt}}>{p.id} — {p.name}</div>
                      <div style={{fontSize:11,color:txt2,marginTop:2}}>
                        {prev.totalOrigem} visita(s) na origem · {prev.jaMigradas} já no CCO · <strong style={{color:nNovas>0?"#0ea5e9":"#22c55e"}}>{nNovas} a migrar</strong>
                      </div>
                      {prev.supervisor && <div style={{fontSize:10,color:txt2,marginTop:2}}>Supervisor (cabeçalho): {prev.supervisor}</div>}
                    </div>
                    {res==="ok" && <span style={{fontSize:11,color:"#22c55e",fontWeight:700,flexShrink:0}}>✓ migrado</span>}
                    {res==="erro" && <span style={{fontSize:11,color:"#ef4444",fontWeight:700,flexShrink:0}}>✗ erro</span>}
                    {nNovas>0 && !isMig && (
                      <button onClick={()=>setConfirm(p.id)} style={{...btn,padding:"8px 14px",fontSize:12,flexShrink:0}}>Migrar {nNovas}</button>
                    )}
                    {isMig && <span style={{fontSize:12,color:"#0ea5e9",fontWeight:700,flexShrink:0}}>⟳ migrando...</span>}
                    {nNovas===0 && res!=="erro" && <span style={{fontSize:11,color:"#22c55e",fontWeight:700,flexShrink:0}}>✓ em dia</span>}
                  </div>

                  {/* Preview das visitas a migrar */}
                  {nNovas>0 && (
                    <div style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${border}`,display:"flex",flexDirection:"column",gap:5}}>
                      {prev.novas.slice(0,5).map(n=>(
                        <div key={n.id} style={{fontSize:11,color:txt2}}>
                          <span style={{color:n.turno==="noturno"?"#818cf8":"#f59e0b",fontWeight:700}}>{n.turno==="noturno"?"🌙":"☀️"}</span>{" "}
                          {fmtDate(n.data)} — {n.resumo ? (n.resumo.length>70?n.resumo.slice(0,70)+"…":n.resumo) : "(sem resumo)"}
                        </div>
                      ))}
                      {nNovas>5 && <div style={{fontSize:11,color:txt2}}>…e mais {nNovas-5} visita(s).</div>}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Modal de confirmação */}
        {confirm && (()=>{
          const prev = previews[confirm];
          return (
            <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999,padding:16}}>
              <div style={{background:cardBg,border:"1px solid #0ea5e9",borderRadius:14,padding:"24px 20px",maxWidth:340,width:"100%",textAlign:"center"}}>
                <div style={{fontSize:28,marginBottom:10}}>🔄</div>
                <div style={{fontSize:15,fontWeight:700,color:txt,marginBottom:6}}>Migrar {prev?.novas.length} visita(s)?</div>
                <div style={{fontSize:12,color:txt2,marginBottom:18}}>
                  {confirm} — copia para o CCO Supervisão. As visitas continuam em Empresas também. Esta ação não apaga nada.
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>setConfirm(null)} style={{...btnSec,flex:1}}>Cancelar</button>
                  <button onClick={()=>executarMigracao(confirm)} style={{...btn,flex:1}}>✓ Migrar</button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// utilitários puros para teste
export const _internal = { migrarVisita };

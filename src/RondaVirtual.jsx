// ════════════════════════════════════════════════════════════════════════
// RondaVirtual.jsx — Aba "Ronda Virtual (CFTV)" do módulo CCO
// MokLog CheckTest · Moked Consulting Security
//
// Integração: este componente é renderizado DENTRO do AcessoCCO quando
// tema === "ronda". Ele recebe por props os helpers já existentes no
// AcessoCCO (db, doc, setDoc, getDoc, loadEquipe, estilos, etc.) para não
// duplicar Firebase nem quebrar nada.
//
// Coleção Firestore: cco_ronda/{projectId}  (NOVA — não toca coleções legadas)
// Estrutura do doc: { turnos: [ <turnoObj> ], updatedAt }
//   turnoObj = {
//     id, tipo:"noturno"|"diurno", dataInicio:"YYYY-MM-DD",
//     plantonista:{ id, nome, cargo }, abertoEm, arquivado, arquivadoEm,
//     rondas: { "<offsetMin>": { inicio:"HH:MM", fim:"HH:MM",
//               atrasada:bool, naoExec:bool, anomalia:bool,
//               justificativa:"", obs:"" } }
//   }
// ════════════════════════════════════════════════════════════════════════
import { useState, useEffect, useMemo } from "react";

const TOLERANCIA_MIN = 5;

// ── Definição das grades (turnos)
// Noturno (DIÁRIO): 18:00→22:00 a cada 1h, 23:00→05:30(+1) a cada 30min
// Diurno (FIM DE SEMANA / FERIADO): 06:00→17:00 a cada 1h, janela final 17:30
export const RONDA_TURNOS = {
  noturno: { key:"noturno", label:"Noturno", icon:"🌙", color:"#818cf8", bg:"#0a0a2e", obs:"Preenchimento diário" },
  diurno:  { key:"diurno",  label:"Diurno",  icon:"☀️", color:"#f59e0b", bg:"#1a1000", obs:"Apenas finais de semana e feriados" },
};

// offsetMin = minutos desde o horário de início do turno (18:00 noturno / 06:00 diurno)
function buildSlots(tipo) {
  const slots = [];
  if (tipo === "noturno") {
    for (let h = 18; h <= 22; h++) slots.push({ label:`${String(h).padStart(2,"0")}:00`, offsetMin:(h-18)*60 });
    let off = (23-18)*60, cur = 23*60, fim = (24+5)*60+30; // 05:30 do dia seguinte
    while (cur <= fim) {
      const hh = Math.floor((cur%1440)/60), mm = cur%60;
      slots.push({ label:`${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}`, offsetMin:off });
      cur += 30; off += 30;
    }
  } else { // diurno: 06:00 → 17:00 de 1h (janela final 17:30)
    for (let h = 6; h <= 17; h++) slots.push({ label:`${String(h).padStart(2,"0")}:00`, offsetMin:(h-6)*60 });
  }
  return slots;
}

function inicioTurnoHora(tipo){ return tipo==="noturno" ? 18 : 6; }

// minutos decorridos desde o início do turno, considerando a data de início.
// Trata a virada de meia-noite (turno noturno cruza para o dia seguinte).
function minutosDesdeInicio(tipo, dataInicio, agora=new Date()) {
  const [Y,M,D] = dataInicio.split("-").map(Number);
  const ini = new Date(Y, M-1, D, inicioTurnoHora(tipo), 0, 0, 0);
  return Math.floor((agora.getTime() - ini.getTime())/60000);
}

// Status de UM slot a partir do relógio (puro, testável).
// registro = entrada salva em turnoObj.rondas[offset] (ou null)
// Retorna: feita | feita_atrasada | naoexec | aguardando | aberto | atraso_aberto | bloqueado
function statusSlot(slot, proximoOffset, agoraMin, registro) {
  if (registro && registro.naoExec) return "naoexec";
  if (registro && registro.inicio)  return registro.atrasada ? "feita_atrasada" : "feita";
  const ini = slot.offsetMin;
  const fimTol = ini + TOLERANCIA_MIN;
  const limite = (proximoOffset != null) ? proximoOffset : (ini + 30);
  if (agoraMin < ini)       return "aguardando";
  if (agoraMin <= fimTol)   return "aberto";          // iniciar no horário
  if (agoraMin < limite)    return "atraso_aberto";   // iniciar com atraso
  return "bloqueado";                                  // estourou → não executada
}

const STATUS_META = {
  feita:          { label:"No horário",     color:"#22c55e", bg:"#021a0d", icon:"✅" },
  feita_atrasada: { label:"Feita c/ atraso",color:"#f59e0b", bg:"#1a1000", icon:"⏱️" },
  naoexec:        { label:"Não executada",  color:"#ef4444", bg:"#1a0202", icon:"❌" },
  aguardando:     { label:"Aguardando",     color:"#64748b", bg:"transparent", icon:"🕓" },
  aberto:         { label:"Iniciar agora",  color:"#22c55e", bg:"#021a0d", icon:"▶" },
  atraso_aberto:  { label:"Atrasada",       color:"#f59e0b", bg:"#1a1000", icon:"⚠️" },
  bloqueado:      { label:"Não executada",  color:"#ef4444", bg:"#1a0202", icon:"🔒" },
};

function hojeISO(){ return new Date().toISOString().split("T")[0]; }
function nowHM(){ const n=new Date(); return `${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}`; }
function fmtDataBR(d){ if(!d) return "--"; try{ return new Date(d+"T12:00:00").toLocaleDateString("pt-BR"); }catch{ return d; } }
function isFimDeSemana(dISO){ try{ const dt=new Date(dISO+"T12:00:00"); const w=dt.getDay(); return w===0||w===6; }catch{ return false; } }

// ════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL DA ABA
// props:
//   project, dark, S (estilos), adminAuth
//   loadEquipe(projectId) -> [colaboradores ativos]
//   db, doc, setDoc, getDoc  (handles do Firebase vindos do AcessoCCO)
// ════════════════════════════════════════════════════════════════════════
export default function RondaVirtual({ project, dark, S, adminAuth, loadEquipe, db, doc, setDoc, getDoc }) {
  const COL = "cco_ronda";
  const [turnos, setTurnos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [equipe, setEquipe] = useState([]);
  const [showArquivados, setShowArquivados] = useState(false);
  const [tick, setTick] = useState(0); // força recálculo do relógio
  const [novoTipo, setNovoTipo] = useState("noturno");
  const [novoPlant, setNovoPlant] = useState("");
  const [abrindo, setAbrindo] = useState(false);

  // Relógio: recalcula status a cada 30s (e ao montar/abrir o app)
  useEffect(()=>{
    const t = setInterval(()=>setTick(x=>x+1), 30000);
    return ()=>clearInterval(t);
  },[]);

  // Carregamento inicial
  useEffect(()=>{
    if(!project?.id) return;
    setLoading(true);
    (async()=>{
      try {
        const snap = await getDoc(doc(db,COL,project.id));
        if(snap.exists()){
          const data = snap.data();
          setTurnos(data.turnos||[]);
          try{ localStorage.setItem(`${COL}_${project.id}`, JSON.stringify(data.turnos||[])); }catch(e){}
        } else {
          try{ const l=localStorage.getItem(`${COL}_${project.id}`); if(l) setTurnos(JSON.parse(l)); }catch(e){}
        }
      } catch(e){
        try{ const l=localStorage.getItem(`${COL}_${project.id}`); if(l) setTurnos(JSON.parse(l)); }catch(_){}
      }
      try{ const eq = await loadEquipe(project.id); setEquipe(eq||[]); }catch(e){ setEquipe([]); }
      setLoading(false);
    })();
  },[project?.id]);

  const persist = async (lista) => {
    setTurnos(lista);
    try{ localStorage.setItem(`${COL}_${project.id}`, JSON.stringify(lista)); }catch(e){}
    try{ await setDoc(doc(db,COL,project.id),{ turnos:lista, updatedAt:new Date().toISOString() }); }
    catch(e){ console.error("Ronda save error:",e); }
  };

  const abrirTurno = async () => {
    if(!novoPlant){ alert("Selecione o plantonista de plantão."); return; }
    const col = equipe.find(c=>String(c.id)===String(novoPlant));
    if(!col){ alert("Plantonista inválido."); return; }
    setAbrindo(true);
    const novo = {
      id: Date.now().toString()+Math.random().toString(36).substring(2,6),
      tipo: novoTipo,
      dataInicio: hojeISO(),
      plantonista: { id:col.id, nome:col.nome, cargo:col.cargo||"" },
      abertoEm: new Date().toISOString(),
      arquivado: false,
      rondas: {},
    };
    await persist([novo, ...turnos]);
    setNovoPlant("");
    setAbrindo(false);
  };

  const updTurno = async (turnoId, fn) => {
    const lista = turnos.map(t=> t.id===turnoId ? fn({...t}) : t);
    await persist(lista);
  };
  const arquivarTurno   = (turnoId)=> updTurno(turnoId, t=>({...t, arquivado:true, arquivadoEm:new Date().toISOString()}));
  const desarquivarTurno= (turnoId)=> updTurno(turnoId, t=>({...t, arquivado:false}));
  const excluirTurno    = async (turnoId)=> { await persist(turnos.filter(t=>t.id!==turnoId)); };

  const ativos = turnos.filter(t=>!t.arquivado);
  const arquivados = turnos.filter(t=>t.arquivado);
  const visiveis = showArquivados ? arquivados : ativos;

  if(loading) return (
    <div style={{textAlign:"center",padding:"40px 0"}}>
      <div style={{fontSize:28,marginBottom:8}}>🎥</div>
      <div style={{fontSize:13,...S.txt2}}>Carregando rondas virtuais...</div>
    </div>
  );

  return (
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
        <KpiBox S={S} val={turnos.length} label="TURNOS" color="#818cf8"/>
        <KpiBox S={S} val={ativos.length} label="ATIVOS" color="#22c55e"/>
        <KpiBox S={S} val={arquivados.length} label="ARQUIVADOS" color="#64748b"/>
      </div>

      {/* Abrir novo turno */}
      {!showArquivados && (
        <div style={S.card}>
          <div style={{fontSize:11,color:"#818cf8",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:10}}>🎥 Abrir turno de ronda</div>
          <label style={S.lbl}>Turno</label>
          <div style={{display:"flex",gap:6,marginBottom:10}}>
            {Object.values(RONDA_TURNOS).map(t=>{
              const sel=novoTipo===t.key;
              return (
                <button key={t.key} onClick={()=>setNovoTipo(t.key)}
                  style={{flex:1,background:sel?t.bg:"transparent",border:`1px solid ${sel?t.color+"66":dark?"#0f172a":"#e2e8f0"}`,color:sel?t.color:dark?"#475569":"#94a3b8",borderRadius:8,padding:"9px 8px",fontSize:12,cursor:"pointer",fontWeight:sel?700:500}}>
                  {t.icon} {t.label}
                </button>
              );
            })}
          </div>
          <div style={{fontSize:11,...S.txt2,marginBottom:10,background:dark?"#020510":"#f8fafc",border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`,borderRadius:8,padding:"8px 10px"}}>
            <strong style={{color:RONDA_TURNOS[novoTipo].color}}>{RONDA_TURNOS[novoTipo].icon} {RONDA_TURNOS[novoTipo].label}</strong> · {RONDA_TURNOS[novoTipo].obs}
            <br/>{novoTipo==="noturno"
              ? "18h→22h a cada 1h · 23h→05:30 a cada 30min"
              : "06h→17h a cada 1h (janela final 17:30)"}
          </div>
          <label style={S.lbl}>Plantonista *</label>
          <select value={novoPlant} onChange={e=>setNovoPlant(e.target.value)} style={{...S.inp,marginBottom:10}}>
            <option value="">Selecione o plantonista...</option>
            {equipe.map(c=>(<option key={c.id} value={c.id}>{c.nome}{c.cargo?` — ${c.cargo}`:""}{c.turno?` · ${c.turno}`:""}</option>))}
          </select>
          {equipe.length===0 && <div style={{fontSize:11,color:"#ef4444",marginBottom:8}}>Nenhum colaborador em equipes/{"{projeto}"}. Cadastre a equipe primeiro.</div>}
          <button onClick={abrirTurno} disabled={abrindo} style={{...S.btn,opacity:abrindo?0.7:1}}>{abrindo?"⟳ Abrindo...":"▶ Abrir turno de ronda"}</button>
        </div>
      )}

      {/* Toggle ativos / arquivados */}
      <div style={{display:"flex",gap:6}}>
        <button onClick={()=>setShowArquivados(false)} style={{...S.btnSm,flex:1,padding:"7px",...(!showArquivados?{background:"#818cf822",border:"1px solid #818cf866",color:"#818cf8"}:{})}}>Ativos ({ativos.length})</button>
        <button onClick={()=>setShowArquivados(true)} style={{...S.btnSm,flex:1,padding:"7px",...(showArquivados?{background:"#64748b22",border:"1px solid #64748b66",color:"#94a3b8"}:{})}}>📦 Arquivados ({arquivados.length})</button>
      </div>

      {visiveis.length===0 && (
        <div style={{textAlign:"center",padding:"36px 0"}}>
          <div style={{fontSize:30,marginBottom:8}}>{showArquivados?"📦":"🎥"}</div>
          <div style={{fontSize:13,...S.txt}}>{showArquivados?"Nenhum turno arquivado":"Nenhum turno de ronda aberto"}</div>
        </div>
      )}

      {visiveis.map(t=>(
        <TurnoCard key={t.id} turno={t} dark={dark} S={S} adminAuth={adminAuth} tick={tick}
          onUpd={updTurno} onArquivar={()=>arquivarTurno(t.id)} onDesarquivar={()=>desarquivarTurno(t.id)}
          onExcluir={()=>{ if(window.confirm("Excluir turno definitivamente?")) excluirTurno(t.id); }}
          onPDF={()=>gerarPDFRonda(project, t)}/>
      ))}
    </div>
  );
}

// ── KPI local (mesmo visual do KPI do AcessoCCO)
function KpiBox({ S, val, label, color }) {
  return (
    <div style={{...S.card,textAlign:"center",padding:"10px 8px"}}>
      <div style={{fontSize:22,fontWeight:900,color}}>{val}</div>
      <div style={{fontSize:9,...S.txt2,fontWeight:700}}>{label}</div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// CARTÃO DE UM TURNO — lista os slots e gerencia início/fim/justificativa
// ════════════════════════════════════════════════════════════════════════
function TurnoCard({ turno, dark, S, adminAuth, tick, onUpd, onArquivar, onDesarquivar, onExcluir, onPDF }) {
  const [open, setOpen] = useState(!turno.arquivado);
  const tinfo = RONDA_TURNOS[turno.tipo] || RONDA_TURNOS.noturno;
  const slots = useMemo(()=>buildSlots(turno.tipo),[turno.tipo]);
  const agoraMin = minutosDesdeInicio(turno.tipo, turno.dataInicio); // recalculado a cada render (tick)
  void tick;

  // Computa status de cada slot + estatísticas
  const linhas = slots.map((s,i)=>{
    const prox = slots[i+1] ? slots[i+1].offsetMin : null;
    const reg = turno.rondas?.[String(s.offsetMin)] || null;
    const st = statusSlot(s, prox, agoraMin, reg);
    return { slot:s, prox, reg, st };
  });
  const feitas = linhas.filter(l=>l.st==="feita"||l.st==="feita_atrasada").length;
  const naoexec = linhas.filter(l=>l.st==="naoexec"||l.st==="bloqueado").length;
  const pendJust = linhas.filter(l=>l.st==="bloqueado" || (l.reg && l.reg.naoExec && !l.reg.justificativa)).length
                 + linhas.filter(l=>l.st==="feita_atrasada" && !(l.reg&&l.reg.justificativa)).length;

  // Ações sobre um slot
  const setRonda = (offset, patch) => onUpd(turno.id, t=>{
    const rondas = {...(t.rondas||{})};
    rondas[String(offset)] = {...(rondas[String(offset)]||{}), ...patch};
    return {...t, rondas};
  });

  const iniciar = (linha) => {
    const atrasada = linha.st==="atraso_aberto";
    setRonda(linha.slot.offsetMin, { inicio:nowHM(), atrasada, naoExec:false, fim:"", anomalia:false, justificativa:linha.reg?.justificativa||"" });
  };
  const fechar = (linha, anomalia) => {
    setRonda(linha.slot.offsetMin, { fim:nowHM(), anomalia });
  };
  const marcarNaoExec = (linha) => {
    setRonda(linha.slot.offsetMin, { naoExec:true, inicio:"", fim:"" });
  };
  const setJustificativa = (linha, val) => setRonda(linha.slot.offsetMin, { justificativa:val });
  const setObs = (linha, val) => setRonda(linha.slot.offsetMin, { obs:val });

  return (
    <div style={{...S.card,border:`1px solid ${tinfo.color}33`,opacity:turno.arquivado?0.75:1}}>
      <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={()=>setOpen(!open)}>
        <div style={{width:40,height:40,borderRadius:10,background:tinfo.bg,border:`1px solid ${tinfo.color}33`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:18}}>{tinfo.icon}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:700,...S.txt}}>
            {turno.plantonista?.nome||"—"}
            {turno.arquivado&&<span style={{fontSize:9,color:"#64748b",fontWeight:700,marginLeft:6,background:dark?"#0f172a":"#f1f5f9",padding:"1px 6px",borderRadius:6}}>📦 Arquivado</span>}
          </div>
          <div style={{display:"flex",gap:8,marginTop:3,flexWrap:"wrap"}}>
            <span style={{fontSize:10,color:tinfo.color,fontWeight:700}}>{tinfo.icon} {tinfo.label}</span>
            <span style={{fontSize:10,...S.txt2}}>📅 {fmtDataBR(turno.dataInicio)}</span>
            <span style={{fontSize:10,color:"#22c55e"}}>✅ {feitas}</span>
            <span style={{fontSize:10,color:"#ef4444"}}>❌ {naoexec}</span>
            {pendJust>0 && <span style={{fontSize:10,color:"#f59e0b",fontWeight:700}}>⚠ {pendJust} p/ justificar</span>}
          </div>
        </div>
        <span style={{...S.txt2,fontSize:12}}>{open?"▲":"▼"}</span>
      </div>

      {turno.tipo==="diurno" && !isFimDeSemana(turno.dataInicio) && (
        <div style={{fontSize:10,color:"#f59e0b",marginTop:8,background:dark?"#1a1000":"#fffbeb",border:"1px solid #f59e0b44",borderRadius:7,padding:"6px 9px"}}>
          ⚠ Turno diurno é previsto apenas para finais de semana e feriados.
        </div>
      )}

      {open && (
        <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${dark?"#0f172a":"#f1f5f9"}`,display:"flex",flexDirection:"column",gap:6}}>
          {linhas.map((l)=>(
            <SlotRow key={l.slot.offsetMin} linha={l} dark={dark} S={S}
              disabled={turno.arquivado}
              onIniciar={()=>iniciar(l)} onFecharSem={()=>fechar(l,false)} onFecharCom={()=>fechar(l,true)}
              onNaoExec={()=>marcarNaoExec(l)} onJust={(v)=>setJustificativa(l,v)} onObs={(v)=>setObs(l,v)}/>
          ))}

          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}>
            <button onClick={onPDF} style={{...S.btnSm,color:"#a855f7",border:"1px solid #a855f733"}}>📄 PDF</button>
            {!turno.arquivado
              ? <button onClick={onArquivar} style={{...S.btnSm,color:"#64748b",border:`1px solid ${dark?"#1e293b":"#cbd5e1"}`}}>📦 Concluir e arquivar</button>
              : <button onClick={onDesarquivar} style={{...S.btnSm,color:"#0ea5e9",border:"1px solid #0ea5e944"}}>↩ Desarquivar</button>}
            {adminAuth && <button onClick={onExcluir} style={{...S.btnSm,color:"#ef4444",border:"1px solid #ef444433"}}>🗑 Excluir</button>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Linha de um slot
function SlotRow({ linha, dark, S, disabled, onIniciar, onFecharSem, onFecharCom, onNaoExec, onJust, onObs }) {
  const { slot, reg, st } = linha;
  const meta = STATUS_META[st] || STATUS_META.aguardando;
  const iniciada = reg && reg.inicio;
  const fechada = reg && reg.fim;
  const precisaJust = st==="bloqueado" || st==="naoexec" || st==="feita_atrasada" || (st==="atraso_aberto");
  const borderC = (st==="naoexec"||st==="bloqueado") ? "#ef4444"
                : (st==="feita_atrasada"||st==="atraso_aberto") ? "#f59e0b"
                : (st==="feita") ? "#22c55e"
                : (st==="aberto") ? "#22c55e" : (dark?"#0f172a":"#e2e8f0");

  return (
    <div style={{background:dark?"#020510":"#f8fafc",border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`,borderLeft:`3px solid ${borderC}`,borderRadius:8,padding:"8px 10px"}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:14,fontWeight:800,...S.txt,minWidth:46}}>{slot.label}</span>
        <span style={{fontSize:10,fontWeight:700,color:meta.color,background:meta.bg==="transparent"?"transparent":meta.bg,border:`1px solid ${meta.color}44`,borderRadius:6,padding:"2px 7px"}}>{meta.icon} {meta.label}</span>
        <div style={{flex:1}}/>
        {/* Ações conforme estado */}
        {!disabled && (st==="aberto"||st==="atraso_aberto") && !iniciada && (
          <button onClick={onIniciar} style={{...S.btnSm,color:meta.color,border:`1px solid ${meta.color}66`,padding:"5px 10px"}}>▶ Iniciar</button>
        )}
        {!disabled && iniciada && !fechada && (
          <div style={{display:"flex",gap:4}}>
            <button onClick={onFecharSem} style={{...S.btnSm,color:"#22c55e",border:"1px solid #22c55e66",padding:"5px 8px"}}>✓ Sem anomalia</button>
            <button onClick={onFecharCom} style={{...S.btnSm,color:"#ef4444",border:"1px solid #ef444466",padding:"5px 8px"}}>⚠ Com anomalia</button>
          </div>
        )}
        {!disabled && st==="bloqueado" && !reg?.naoExec && (
          <button onClick={onNaoExec} style={{...S.btnSm,color:"#ef4444",border:"1px solid #ef444466",padding:"5px 10px"}}>Marcar não exec.</button>
        )}
      </div>

      {/* Detalhes de horário */}
      {(iniciada || fechada) && (
        <div style={{fontSize:11,...S.txt2,marginTop:5}}>
          {reg.inicio && <>Início <strong style={{color:reg.atrasada?"#f59e0b":"#22c55e"}}>{reg.inicio}</strong></>}
          {reg.fim && <> · Fim <strong>{reg.fim}</strong></>}
          {fechada && <> · {reg.anomalia
            ? <span style={{color:"#ef4444",fontWeight:700}}>Com anomalias</span>
            : <span style={{color:"#22c55e",fontWeight:700}}>Sem anomalias</span>}</>}
        </div>
      )}

      {/* Justificativa (obrigatória em atraso / não executada) */}
      {!disabled && precisaJust && (
        <div style={{marginTop:6}}>
          <label style={{...S.lbl,color:"#f59e0b"}}>
            {(st==="bloqueado"||st==="naoexec") ? "Justifique a não execução *" : "Justifique o atraso *"}
          </label>
          <input value={reg?.justificativa||""} onChange={e=>onJust(e.target.value)}
            placeholder="Ex.: fluxo intenso de saída de veículos..." style={{...S.inp,fontSize:12}}/>
        </div>
      )}

      {/* Observação da anomalia */}
      {!disabled && fechada && reg.anomalia && (
        <div style={{marginTop:6}}>
          <label style={S.lbl}>O que foi observado *</label>
          <textarea value={reg?.obs||""} onChange={e=>onObs(e.target.value)}
            placeholder="Câmera, local, situação e ações tomadas..." style={{...S.inp,height:54,resize:"vertical",fontSize:12}}/>
        </div>
      )}

      {disabled && reg?.justificativa && (
        <div style={{fontSize:11,color:"#f59e0b",marginTop:5}}>⚠ {reg.justificativa}</div>
      )}
      {disabled && reg?.obs && (
        <div style={{fontSize:11,...S.txt2,marginTop:4,lineHeight:1.4}}>{reg.obs}</div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// PDF do turno de ronda (mesmo padrão visual do gerarPDFTema do AcessoCCO)
// ════════════════════════════════════════════════════════════════════════
export function gerarPDFRonda(project, turno) {
  const tinfo = RONDA_TURNOS[turno.tipo] || RONDA_TURNOS.noturno;
  const slots = buildSlots(turno.tipo);
  const hoje = new Date().toLocaleDateString("pt-BR");

  const rows = slots.map((s,i)=>{
    const prox = slots[i+1] ? slots[i+1].offsetMin : null;
    const reg = turno.rondas?.[String(s.offsetMin)] || null;
    const st = statusSlot(s, prox, minutosDesdeInicio(turno.tipo, turno.dataInicio), reg);
    const meta = STATUS_META[st] || STATUS_META.aguardando;
    const inicio = reg?.inicio || "--";
    const fim = reg?.fim || "--";
    const result = (reg && reg.fim) ? (reg.anomalia ? "Com anomalias" : "Sem anomalias") : "--";
    const just = reg?.justificativa || "";
    const obs = reg?.obs || "";
    const cor = meta.color;
    return `<tr>
      <td><strong>${s.label}</strong></td>
      <td style="color:${cor};font-weight:700">${meta.label}</td>
      <td>${inicio}</td><td>${fim}</td><td>${result}</td>
      <td style="font-size:10px">${[just,obs].filter(Boolean).join(" — ")||"--"}</td>
    </tr>`;
  }).join("");

  const feitas = slots.filter((s,i)=>{ const reg=turno.rondas?.[String(s.offsetMin)]; return reg&&reg.inicio; }).length;
  const naoexec = slots.filter((s,i)=>{
    const prox = slots[i+1] ? slots[i+1].offsetMin : null;
    const reg = turno.rondas?.[String(s.offsetMin)] || null;
    const st = statusSlot(s, prox, minutosDesdeInicio(turno.tipo, turno.dataInicio), reg);
    return st==="naoexec"||st==="bloqueado";
  }).length;

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>Ronda Virtual — ${project.id} ${hoje}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;padding:20px;color:#1e293b}
  .header{background:linear-gradient(135deg,#0c2340,#081626);color:#fff;padding:20px 24px;border-radius:12px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center}
  .header h1{font-size:18px;margin-bottom:4px}
  .header p{font-size:11px;opacity:.75}
  .card{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:14px}
  .card h2{font-size:13px;color:#475569;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #f1f5f9;padding-bottom:8px;margin-bottom:12px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{background:#1e293b;color:#fff;padding:8px 10px;text-align:left;font-size:11px}
  td{padding:8px 10px;border-bottom:1px solid #f1f5f9;vertical-align:top}
  tr:nth-child(even) td{background:#f8fafc}
  .footer{text-align:center;margin-top:16px;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:12px}
  .kpi{display:flex;gap:10px;margin-bottom:14px}
  .kpibox{flex:1;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:12px;text-align:center}
  .kpibox .n{font-size:22px;font-weight:800;color:#0c2340}
  .kpibox .l{font-size:10px;color:#64748b;font-weight:700}
  .meta{display:flex;gap:16px;font-size:12px;margin-bottom:12px;flex-wrap:wrap}
  .meta b{color:#0c2340}
  @media print{body{padding:8px}@page{margin:12mm}.no-print{display:none}}
</style></head>
<body>
<div class="no-print" style="text-align:center;margin-bottom:16px">
  <button onclick="window.print()" style="background:#1d4ed8;color:#fff;border:none;border-radius:8px;padding:10px 28px;font-size:14px;font-weight:700;cursor:pointer">🖨️ Imprimir / Salvar PDF</button>
</div>
<div class="header">
  <div>
    <h1>🎥 Ronda Virtual (CFTV) — CCO</h1>
    <p>${project.id} — ${project.name||""}</p>
    <p>Relatório gerado em ${hoje}</p>
  </div>
  <div style="text-align:right;font-size:11px;opacity:.75">
    <div>Moked Consulting Security</div>
    <div>MokLog CheckTest</div>
  </div>
</div>
<div class="meta">
  <div><b>Turno:</b> ${tinfo.label}</div>
  <div><b>Plantonista:</b> ${turno.plantonista?.nome||"--"}${turno.plantonista?.cargo?` (${turno.plantonista.cargo})`:""}</div>
  <div><b>Data de início:</b> ${fmtDataBR(turno.dataInicio)}</div>
</div>
<div class="kpi">
  <div class="kpibox"><div class="n">${slots.length}</div><div class="l">RONDAS PREVISTAS</div></div>
  <div class="kpibox"><div class="n">${feitas}</div><div class="l">REALIZADAS</div></div>
  <div class="kpibox"><div class="n">${naoexec}</div><div class="l">NÃO EXECUTADAS</div></div>
</div>
<div class="card">
  <h2>Rondas do turno</h2>
  <table><thead><tr><th>Horário</th><th>Status</th><th>Início</th><th>Fim</th><th>Resultado</th><th>Justificativa / Observação</th></tr></thead>
  <tbody>${rows}</tbody></table>
</div>
<div class="footer">
  <div>MokLog CheckTest © Moked Consulting Security</div>
  <div>Ronda Virtual · ${project.id} · ${tinfo.label} · ${fmtDataBR(turno.dataInicio)}</div>
</div>
</body></html>`;

  const blob = new Blob([html],{type:"text/html"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href=url; a.download=`cco_ronda_${project.id}_${turno.tipo}_${turno.dataInicio}.html`; a.click();
  URL.revokeObjectURL(url);
}

// Exporta utilitários puros para teste
export const _internal = { buildSlots, statusSlot, minutosDesdeInicio, TOLERANCIA_MIN };

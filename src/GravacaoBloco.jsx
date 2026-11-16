import { useEffect, useState } from "react";
import { getApps } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { FAIXAS_GRAVACAO, legendaGravacao, camerasDaFaixa, corGravacao, MINIMO_DIAS, resumoGravacaoCCO, gravacaoDaCCO } from "./gravacaoSemanal";

// Lê o registro da CCO (cftv_gravacao/{pid}) e devolve o resumo, ou null quando a CCO ainda não mediu.
export async function lerResumoCCO(pid){
  const app=getApps()[0];
  if(!app) return null;
  const sn=await getDoc(doc(getFirestore(app),"cftv_gravacao",pid));
  return sn.exists()?resumoGravacaoCCO(sn.data()):null;
}

// Tempo de gravação no teste semanal (06/11/2026): faixa (%) de câmeras com menos de 30 dias, com a legenda em
// quantidade do projeto. Não entra na Saúde Geral — é indicador próprio da CFTV.
export default function GravacaoBloco({total,value,onChange,pid,S,ler=lerResumoCCO}){
  const pct=value&&FAIXAS_GRAVACAO.includes(Number(value.pct))?Number(value.pct):null;
  const obs=value?.obs||"";
  // 16/11/2026 (Marcio): a CCO já mede câmera por câmera. Em teste NOVO (ainda sem valor) o app puxa sozinho a quantidade abaixo
  // de 30 dias; teste antigo em edição não é mexido. Sem medição da CCO, ou se o líder preferir, vale a faixa à mão como antes.
  const [cco,setCco]=useState(undefined); // undefined = lendo · null = CCO sem medição
  useEffect(()=>{
    let vivo=true;
    if(!pid){setCco(null);return undefined;}
    Promise.resolve().then(()=>ler(pid)).then(r=>{if(vivo)setCco(r||null);}).catch(()=>{if(vivo)setCco(null);});
    return()=>{vivo=false;};
  },[pid,ler]);
  const semValor=!value;
  useEffect(()=>{ if(cco&&semValor) onChange(gravacaoDaCCO(cco,total,"")); },[cco,semValor,total]); // eslint-disable-line
  const daCCO=!!value&&value.origem==="cco";
  const set=(patch)=>onChange({pct,obs,origem:"manual",...patch});
  const fmtReg=(ts)=>{const d=ts?new Date(ts):null;return d&&!Number.isNaN(d.getTime())?d.toLocaleDateString("pt-BR"):"";};
  if(daCCO){
    const n=Number(value.cameras)||0, real=total?Math.round(n/total*100):0, c=corGravacao(pct);
    return(
      <div data-testid="gravacao-bloco" style={{marginTop:10,paddingTop:10,borderTop:"1px solid #1e293b"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8,flexWrap:"wrap"}}>
          <span style={{fontSize:12,fontWeight:800,color:"#cbd5e1"}}>Tempo de gravação · mínimo {MINIMO_DIAS} dias</span>
          <span style={{fontSize:11,color:"#64748b"}}>{total} câmeras no projeto</span>
        </div>
        <div data-testid="gravacao-cco" style={{marginTop:6,padding:"8px 10px",border:`1px solid ${c}`,borderRadius:8}}>
          <div style={{fontSize:13,fontWeight:800,color:c}}>{n===0?`Nenhuma câmera com menos de ${MINIMO_DIAS} dias`:`${n} de ${total} câmeras (${real}%) com menos de ${MINIMO_DIAS} dias`}</div>
          <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>Puxado automático do registro da CCO{fmtReg(value.registradoEm)?` de ${fmtReg(value.registradoEm)}`:""} · {value.medidas||0} câmeras medidas. Não precisa contar.</div>
        </div>
        <input placeholder="Observação (ex.: menos de 15 dias no NVR 2, HD em troca)…" value={obs} onChange={e=>onChange({...value,obs:e.target.value})} maxLength={160} style={{...S.inp,width:"100%",boxSizing:"border-box",fontSize:12,marginTop:6}}/>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:6}}>
          {cco&&<button onClick={()=>onChange(gravacaoDaCCO(cco,total,obs))} style={{...S.iconBtn,width:"auto",padding:"4px 10px",fontSize:11}}>Atualizar da CCO</button>}
          <button onClick={()=>onChange({pct:null,obs,origem:"manual"})} style={{...S.iconBtn,width:"auto",padding:"4px 10px",fontSize:11}}>Informar à mão</button>
        </div>
      </div>
    );
  }
  return(
    <div data-testid="gravacao-bloco" style={{marginTop:10,paddingTop:10,borderTop:"1px solid #1e293b"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8,flexWrap:"wrap"}}>
        <span style={{fontSize:12,fontWeight:800,color:"#cbd5e1"}}>Tempo de gravação · mínimo {MINIMO_DIAS} dias</span>
        <span style={{fontSize:11,color:"#64748b"}}>{total} câmeras no projeto</span>
      </div>
      {cco===null&&<div style={{fontSize:11,color:"#94a3b8",margin:"4px 0 0"}}>A CCO ainda não registrou o tempo de gravação deste projeto; informe a faixa abaixo.</div>}
      {cco&&<button onClick={()=>onChange(gravacaoDaCCO(cco,total,obs))} style={{...S.iconBtn,width:"auto",padding:"4px 10px",fontSize:11,marginTop:6}}>Usar o registro da CCO ({cco.abaixo} abaixo de {MINIMO_DIAS} dias)</button>}
      <div style={{fontSize:11,color:"#94a3b8",margin:"4px 0 6px"}}>Quantas câmeras estão com <b>menos de {MINIMO_DIAS} dias</b> de gravação? Escolha a faixa (<b>até</b> X%). Legenda deste projeto: {legendaGravacao(total).map(l=>`até ${l.pct}% ≈ ${l.cameras}`).join(" · ")}</div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {FAIXAS_GRAVACAO.map(f=>{const on=pct===f;const c=corGravacao(f);return(
          <button key={f} aria-pressed={on} onClick={()=>set({pct:on?null:f})} style={{...S.iconBtn,width:"auto",minWidth:64,padding:"6px 10px",fontSize:12,fontWeight:800,color:on?"#fff":c,background:on?c:"transparent",border:`1px solid ${c}`,borderRadius:8}}>
            {f===0?"0% · nenhuma":`até ${f}%${f===50?" (máx.)":""} ≈ ${camerasDaFaixa(total,f)}`}
          </button>);})}
      </div>
      {pct===null&&<div style={{fontSize:11,color:"#f59e0b",marginTop:6}}>Não informado — escolha uma faixa.</div>}
      {pct!==null&&<div style={{fontSize:11,color:corGravacao(pct),marginTop:6,fontWeight:700}}>{pct===0?`Todas as ${total} câmeras com ${MINIMO_DIAS} dias ou mais.`:`Até ≈ ${camerasDaFaixa(total,pct)} de ${total} câmeras abaixo de ${MINIMO_DIAS} dias.`}</div>}
      <input placeholder="Observação (ex.: menos de 15 dias no NVR 2, HD em troca)…" value={obs} onChange={e=>set({obs:e.target.value})} maxLength={160} style={{...S.inp,width:"100%",boxSizing:"border-box",fontSize:12,marginTop:6}}/>
    </div>
  );
}


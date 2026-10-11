import { Ico } from "./Icones";
import {useRef,useState} from 'react';
import {situacaoSolicitacao,enviadoAposAprovacao} from './equipeAprovacao';
import {mensagemSolicitacoes,mensagemAprovacoesLote,ASSINATURA_APROVADOR} from './equipeSolicitacoes';
import {envioPendente} from './equipeAprovacao';
import {gerarPDFAprovacaoLider} from './pdfSolicitacoes';

export function SeloWhats({solic}) {
  const s=solic,st=situacaoSolicitacao(s),pend=s.status==='pendente';
  const quando=iso=>new Date(iso).toLocaleString('pt-BR');
  let texto,cor;
  if(st==='negado'){texto='Negada — não enviar ao grupo';cor='#ef4444';}
  else if(st==='aguardando'&&pend){texto='⏳ Aguardando aprovação do gerencial';cor='#94a3b8';}
  else if(enviadoAposAprovacao(s)){texto=`Toque no WhatsApp registrado em ${quando(s.whatsEnviadoEm)} · ${s.whatsEnvios||1} toque(s)`;cor='#22c55e';}
  else if(st==='aprovado'&&pend&&s.whatsEnviadoEm){texto='✅ Aprovada — falta enviar a mensagem assinada (sem toque posterior à aprovação comprovado)';cor='#d97706';}
  else if(st==='aprovado'&&pend){texto='✅ Aprovada — falta enviar ao grupo';cor='#d97706';}
  else if(s.whatsEnviadoEm){texto=`Toque anterior registrado em ${quando(s.whatsEnviadoEm)} (sem comprovação de envio após aprovação)`;cor='#94a3b8';}
  else if(s.whatsDispensadoEm){texto=`Dispensado por ${s.whatsDispensadoPor||'Gerencial'} em ${quando(s.whatsDispensadoEm)}`;cor='#22c55e';}
  else {texto='Sem registro de envio';cor='#94a3b8';}
  return <div style={{fontSize:11,marginTop:5,color:cor}}>{texto}</div>;
}

export function FolhaWhats({solicitacoes,projectNome,colab,grupos,onRegistrar,onFechar,dark}) {
  const [busy,setBusy]=useState(false),[erro,setErro]=useState(''),[feito,setFeito]=useState(false);
  const evento=useRef(null);
  const destino=useRef(null);
  const msg=grupos?mensagemAprovacoesLote(projectNome,grupos.map(g=>({colabNome:g.colab.nome,solicitacoes:g.solicitacoes}))):mensagemSolicitacoes(projectNome,colab.nome,solicitacoes);
  const url=`https://wa.me/?text=${encodeURIComponent(msg)}`;
  const registrar=async()=>{
    setBusy(true);setErro('');
    try {
      if(grupos){for(const g of grupos)await onRegistrar(g.colab.id,g.solicitacoes.map(s=>s.id),evento.current);}
      else await onRegistrar(colab.id,solicitacoes.map(s=>s.id),evento.current);
      setFeito(true);
      if(destino.current&&!destino.current.closed)destino.current.location.replace(url);
    }
    catch(e){setErro('Não foi possível registrar o envio');}
    finally{setBusy(false);}
  };
  const enviar=()=>{
    if(busy)return;
    // Reserva janela no gesto. Só abre o app externo após persistência confirmada.
    destino.current=window.open('about:blank','_blank');
    if(destino.current)destino.current.opener=null;
    evento.current={id:crypto.randomUUID(),em:new Date().toISOString()};
    registrar();
  };
  return <div role="dialog" aria-modal="true" aria-label="Enviar solicitação aprovada ao grupo" style={{position:'fixed',inset:0,zIndex:230,background:'#0009',display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
    <div style={{background:dark?'#0b1220':'#fff',color:dark?'#e8ecf5':'#0f172a',borderRadius:14,padding:20,maxWidth:440,width:'100%'}}>
      <h3>Solicitação aprovada</h3><p>{grupos?grupos.reduce((n,g)=>n+g.solicitacoes.length,0):solicitacoes.length} item(ns) aprovado(s), pronto(s) para enviar ao grupo{grupos?` — mensagem única, ${grupos.length} colaborador(es)`:''}.</p>
      <p>A mensagem segue assinada: Aprovado pelo {ASSINATURA_APROVADOR}. O app registra o toque no botão, não a entrega da mensagem. Escolha o grupo ou contato no WhatsApp.</p>
      {feito?<div><p role="status">Toque registrado.</p><a href={url} target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a></div>:<button disabled={busy||!!erro} onClick={enviar} style={{width:'100%',padding:15,background:'#25d366',border:0,borderRadius:9,fontWeight:800,fontSize:16}}><Ico n="celular"/> Enviar no WhatsApp</button>}
      {erro&&<div role="alert"><p>{erro}</p><button disabled={busy} onClick={registrar}>Tentar registrar de novo</button></div>}
      <button disabled={busy} onClick={onFechar} style={{marginTop:14,padding:10}}>{feito?'Concluir':'Enviar depois'}</button>
    </div>
  </div>;
}

export function BotaoAprovarTodas({alvos,onTodas,rotulo}) {
  const [busy,setBusy]=useState(false),[erro,setErro]=useState('');
  return <div><button disabled={busy||!alvos.length} onClick={async()=>{
    setBusy(true);setErro('');try{await onTodas(alvos);}catch(e){setErro(e.message||'Não foi possível aprovar.');}finally{setBusy(false);}
  }}>{busy?'Processando…':rotulo||`Aprovar todas (${alvos.length})`}</button>{erro&&<div role="alert">{erro}</div>}</div>;
}

// Painel do LÍDER: aprovações liberadas pelo gerencial, com aviso pulsando, seleção em lote,
// mensagem única no WhatsApp e PDF de aprovação. O botão do WhatsApp existe só aqui (líder).
export function PainelAprovacoesLider({project,projectNome,colaboradores,onRegistrar,dark}) {
  const [sel,setSel]=useState({});
  const [aberta,setAberta]=useState(false);
  const itens=(colaboradores||[]).filter(c=>(c.status||'ativo')==='ativo').flatMap(c=>(c.uniforme?.solicitacoes||[]).filter(envioPendente).map(s=>({colab:c,s})));
  if(!itens.length)return null;
  const marcados=itens.filter(x=>sel[x.s.id]);
  const todos=marcados.length===itens.length;
  const grupos=Object.values(marcados.reduce((m,x)=>{(m[x.colab.id]=m[x.colab.id]||{colab:x.colab,solicitacoes:[]}).solicitacoes.push(x.s);return m;},{}));
  const txt=dark?'#e8ecf5':'#0f172a',txt2=dark?'#94a3b8':'#64748b';
  return <div style={{border:'1.5px solid #22c55e',background:dark?'#052e1a':'#f0fdf4',borderRadius:14,padding:'12px 14px',marginBottom:12,animation:'mkAprovPulse 2s ease-in-out infinite'}}>
    <style>{'@keyframes mkAprovPulse{0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,.55)}70%{box-shadow:0 0 0 12px rgba(34,197,94,0)}}'}</style>
    <button onClick={()=>setAberta(a=>!a)} style={{all:'unset',cursor:'pointer',display:'flex',alignItems:'center',gap:8,width:'100%'}}>
      <span style={{fontSize:20,color:'#22c55e'}}><Ico n="sino"/></span>
      <span style={{flex:1,fontWeight:800,fontSize:14,color:txt}}>{itens.length} aprovação(ões) liberada(s) para enviar<div style={{fontWeight:500,fontSize:11,color:txt2}}>Aprovadas pelo gerencial — toque para selecionar e enviar</div></span>
      <span style={{color:txt2}}>{aberta?'▾':'›'}</span>
    </button>
    {aberta&&<div style={{marginTop:10}}>
      <label style={{display:'flex',gap:8,alignItems:'center',fontSize:12,fontWeight:700,color:txt,marginBottom:8}}>
        <input type="checkbox" checked={todos} onChange={e=>setSel(e.target.checked?Object.fromEntries(itens.map(x=>[x.s.id,true])):{})}/> Selecionar todas ({itens.length})
      </label>
      {itens.map(({colab,s})=><label key={s.id} style={{display:'flex',gap:8,alignItems:'flex-start',padding:'8px 0',borderTop:`1px solid ${dark?'#14532d':'#bbf7d0'}`,fontSize:12.5,color:txt}}>
        <input type="checkbox" checked={!!sel[s.id]} onChange={e=>setSel(p=>({...p,[s.id]:e.target.checked}))} style={{marginTop:3}}/>
        <span><b>{colab.nome}</b><br/>{s.item}{s.tamanho?` · ${s.tamanho}`:''} · Qtd {s.qtd??s.quantidade??1}</span>
      </label>)}
      <button disabled={!marcados.length} onClick={()=>setAberta('envio')} style={{marginTop:10,width:'100%',padding:13,background:marcados.length?'#25d366':'#64748b',border:0,borderRadius:9,fontWeight:800,color:'#04210f',cursor:marcados.length?'pointer':'not-allowed'}}>Enviar selecionadas no WhatsApp ({marcados.length})</button>
      <button disabled={!marcados.length} onClick={()=>gerarPDFAprovacaoLider(project,grupos)} style={{marginTop:8,width:'100%',padding:11,background:'transparent',border:'1px solid #22c55e',borderRadius:9,fontWeight:700,color:txt,cursor:marcados.length?'pointer':'not-allowed'}}>Gerar PDF das selecionadas</button>
    </div>}
    {aberta==='envio'&&marcados.length>0&&<FolhaWhats grupos={grupos} solicitacoes={marcados.map(x=>x.s)} projectNome={projectNome} colab={grupos[0].colab} onRegistrar={onRegistrar} onFechar={()=>{setAberta(true);setSel({});}} dark={dark}/>}
  </div>;
}

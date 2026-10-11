import { Ico } from "./Icones";
import {useRef,useState} from 'react';
import {situacaoSolicitacao,enviadoAposAprovacao} from './equipeAprovacao';
import {mensagemSolicitacoes,ASSINATURA_APROVADOR} from './equipeSolicitacoes';

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

export function FolhaWhats({solicitacoes,projectNome,colab,onRegistrar,onFechar,dark}) {
  const [busy,setBusy]=useState(false),[erro,setErro]=useState(''),[feito,setFeito]=useState(false);
  const evento=useRef(null);
  const destino=useRef(null);
  const url=`https://wa.me/?text=${encodeURIComponent(mensagemSolicitacoes(projectNome,colab.nome,solicitacoes))}`;
  const registrar=async()=>{
    setBusy(true);setErro('');
    try {
      await onRegistrar(colab.id,solicitacoes.map(s=>s.id),evento.current);
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
      <h3>Solicitação aprovada</h3><p>{solicitacoes.length} item(ns) aprovado(s), pronto(s) para enviar ao grupo.</p>
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

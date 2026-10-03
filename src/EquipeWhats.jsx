import {useRef,useState} from 'react';
import {bloqueadaPorWhats} from './equipeAprovacao';
import {mensagemSolicitacoes} from './equipeSolicitacoes';

export function SeloWhats({solic}) {
  const s=solic;
  const texto=s.whatsDispensadoEm?`Dispensado por ${s.whatsDispensadoPor||'Gerencial'} em ${new Date(s.whatsDispensadoEm).toLocaleString('pt-BR')}`
    :s.whatsEnviadoEm?`Enviado em ${new Date(s.whatsEnviadoEm).toLocaleString('pt-BR')} · ${s.whatsEnvios||1} toque(s)`
    :bloqueadaPorWhats(s)?'🔒 Envio ao WhatsApp pendente':s.exigeWhats===undefined?'Sem registro de envio':'⚠ Envio pendente';
  return <div style={{fontSize:11,marginTop:5,color:s.whatsDispensadoEm||s.whatsEnviadoEm?'#22c55e':s.exigeWhats===undefined?'#94a3b8':'#d97706'}}>{texto}</div>;
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
  return <div role="dialog" aria-modal="true" aria-label="Solicitação registrada" style={{position:'fixed',inset:0,zIndex:230,background:'#0009',display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
    <div style={{background:dark?'#0b1220':'#fff',color:dark?'#e8ecf5':'#0f172a',borderRadius:14,padding:20,maxWidth:440,width:'100%'}}>
      <h3>Solicitação registrada</h3><p>{solicitacoes.length} item(ns) registrado(s).</p>
      <p>O app registra o toque no botão, não a entrega da mensagem. Escolha o grupo ou contato no WhatsApp.</p>
      {solicitacoes.some(s=>s.exigeWhats)&&<p>O gestor só consegue aprovar depois que o envio ao WhatsApp for registrado.</p>}
      {feito?<div><p role="status">Toque registrado. A solicitação pode ser analisada pelo gestor.</p><a href={url} target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a></div>:<button disabled={busy||!!erro} onClick={enviar} style={{width:'100%',padding:15,background:'#25d366',border:0,borderRadius:9,fontWeight:800,fontSize:16}}>📲 Enviar no WhatsApp</button>}
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

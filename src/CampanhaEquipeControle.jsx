import { useState } from 'react';
import { CAMPANHAS, valorCampanhaCentavos, resumoPorValor, totaisExtras } from './campanhasEquipe';
import { fmtBRL } from './equipeAprovacao';
import { reduzirFoto, lerArquivo } from './fotoCampanha';

export default function CampanhaEquipeControle({ tipo, ano, config = {}, quantidade, onSalvar, onPDF, carregando, fotos = {}, idFoto, onEnviarFoto }) {
  const [valor, setValor] = useState(config.valorCentavos == null ? '' : (config.valorCentavos / 100).toFixed(2).replace('.', ','));
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const pr = config.principal || {};
  const [desc, setDesc] = useState(pr.descricao || '');
  const [obs, setObs] = useState(pr.obs || '');
  const [fotoNova, setFotoNova] = useState('');
  const [semFoto, setSemFoto] = useState(false);
  const extras = config.extras || [];
  const cents = valorCampanhaCentavos(valor);
  const alterado = cents !== (config.valorCentavos ?? null);
  const principalAlterado = desc.trim() !== (pr.descricao || '') || obs.trim() !== (pr.obs || '') || !!fotoNova || semFoto;
  const linhas = resumoPorValor(quantidade, cents, extras);
  const totQtd = linhas.reduce((n, l) => n + l.qtd, 0);
  const totValor = Math.round(linhas.reduce((n, l) => n + (l.total || 0), 0) * 100) / 100;
  const fotoPrincipal = fotoNova || (!semFoto && pr.fotoRef && fotos[pr.fotoRef]) || '';
  const unidades = quantidade + totaisExtras(extras).qtd;

  const escolherFoto = async e => {
    const arq = e.target.files && e.target.files[0]; e.target.value = '';
    if (!arq) return;
    setErro('');
    const url = await reduzirFoto(await lerArquivo(arq));
    if (!url) { setErro('Não foi possível usar esta imagem. Escolha outra foto (JPG/PNG).'); return; }
    setFotoNova(url); setSemFoto(false);
  };
  const patchPrincipal = async (fotosNovas) => {
    let fotoRef = semFoto ? undefined : pr.fotoRef;
    if (fotoNova) { fotoRef = await onEnviarFoto(idFoto, fotoNova); if (fotoRef) fotosNovas[fotoRef] = fotoNova; }
    const principal = { ...(desc.trim() ? { descricao: desc.trim() } : {}), ...(obs.trim() ? { obs: obs.trim() } : {}), ...(fotoRef ? { fotoRef } : {}) };
    return { principal };
  };
  // Devolve o que foi gravado e as fotos novas (o PDF usa a foto que acabou de subir, não a do cache).
  const salvarTudo = async (fotosNovas = {}) => {
    const patch = {};
    if (alterado && cents != null) patch.valorCentavos = cents;
    if (principalAlterado) Object.assign(patch, await patchPrincipal(fotosNovas));
    if (Object.keys(patch).length) await onSalvar(patch);
    setFotoNova(''); setSemFoto(false);
    return patch;
  };
  const executar = async fn => {
    setBusy(true); setErro('');
    try { await fn(); } catch (e) { setErro(e.message || 'Não foi possível salvar.'); }
    finally { setBusy(false); }
  };
  const gerarPDF = () => executar(async () => {
    const fotosNovas = {};
    const patch = await salvarTudo(fotosNovas);
    const principal = patch.principal || config.principal || {};
    await onPDF({ valorCentavos: cents, principal, fotosNovas });
  });
  const pendente = alterado || principalAlterado;
  const semValor = quantidade > 0 && cents == null;

  return <section style={{ padding: 14, border: '1px solid #64748b', borderRadius: 10, display: 'grid', gap: 10 }}>
    <strong>{CAMPANHAS[tipo].nome} · {ano}</strong>
    <label>Valor unitário (R$) <input aria-label="Valor unitário da campanha" inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} disabled={busy} style={{ width: 110, padding: 8 }}/></label>
    {valor.trim() && cents == null && <small role="alert">Valor inválido. Use o formato 159,90 (ou 159.90).</small>}
    <div style={{ display: 'grid', gap: 2 }}>
      {linhas.length === 0 && <div>{quantidade} unidade(s) × — = —</div>}
      {linhas.map(l => <div key={l.centavos}>{l.qtd} unidade(s) × {fmtBRL(l.centavos / 100)} = <strong>{fmtBRL(l.total)}</strong></div>)}
      {linhas.length > 0 && <div style={{ borderTop: '1px solid #94a3b8', paddingTop: 4 }}>Total: {totQtd} unidade(s) · <strong>{fmtBRL(totValor)}</strong></div>}
    </div>
    <div style={{ display: 'grid', gap: 6, border: '1px dashed #94a3b8', borderRadius: 8, padding: 8 }}>
      <strong style={{ fontSize: 12 }}>Modelo da solicitação da equipe (opcional)</strong>
      <input aria-label="Modelo da cesta da equipe" placeholder="Ex.: Cesta Munique" maxLength={120} value={desc} onChange={e => setDesc(e.target.value)} disabled={busy} style={{ padding: 8 }}/>
      <input aria-label="Observação do modelo da equipe" placeholder="Observação (opcional)" maxLength={300} value={obs} onChange={e => setObs(e.target.value)} disabled={busy} style={{ padding: 8 }}/>
      <label>Foto do catálogo <input aria-label="Foto do modelo da equipe" type="file" accept="image/*" onChange={escolherFoto} disabled={busy}/></label>
      {fotoPrincipal ? <img src={fotoPrincipal} alt="Foto do modelo da equipe" style={{ maxWidth: 160, borderRadius: 6 }}/> : null}
      {(fotoNova || (pr.fotoRef && !semFoto)) && <button disabled={busy} onClick={() => { setFotoNova(''); setSemFoto(true); }}>Remover foto</button>}
    </div>
    <small>Itens com o mesmo valor somam na mesma linha; valores diferentes geram cálculos separados. Este cálculo não altera o saldo real nem cria lançamento no FV.</small>
    <button disabled={busy || !pendente || (alterado && cents == null)} onClick={() => executar(salvarTudo)}>{busy ? 'Salvando...' : 'Salvar valor e modelo'}</button>
    <button disabled={busy} onClick={() => executar(() => onSalvar({ oculta: !config.oculta }))}>{config.oculta ? 'Restaurar calendário automático' : 'Ocultar solicitação nesta campanha'}</button>
    <small>{config.oculta ? 'Oculta manualmente neste tipo e ano. O próximo ciclo anual não é afetado.' : 'Natal: 01/10 a 30/11. Páscoa: 01/02 a 31/03. Histórico sempre disponível ao gerencial.'}</small>
    <button disabled={busy || carregando || unidades === 0 || semValor || (alterado && cents == null)} onClick={gerarPDF}>Gerar PDF da solicitação ({unidades})</button>
    {semValor && <small>Informe o valor unitário para gerar o PDF.</small>}
    {!semValor && <small>Cada PDF sai como versão nova (data e hora no documento e no nome do arquivo), sempre com o que está salvo agora.</small>}
    {pendente && !semValor && <small>O PDF salva o valor e o modelo automaticamente.</small>}
    {erro && <div role="alert">{erro}</div>}
  </section>;
}

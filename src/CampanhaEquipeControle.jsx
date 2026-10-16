import { useState } from 'react';
import { CAMPANHAS, valorCampanhaCentavos, totalCampanha, totalGeralCampanha } from './campanhasEquipe';
import { fmtBRL } from './equipeAprovacao';

export default function CampanhaEquipeControle({ tipo, ano, config = {}, quantidade, onSalvar, onPDF, carregando }) {
  const [valor, setValor] = useState(config.valorCentavos == null ? '' : (config.valorCentavos / 100).toFixed(2).replace('.', ','));
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const cents = valorCampanhaCentavos(valor);
  const alterado = cents !== (config.valorCentavos ?? null);
  const salvar = async patch => {
    setBusy(true); setErro('');
    try { await onSalvar(patch); } catch (e) { setErro(e.message || 'Não foi possível salvar.'); }
    finally { setBusy(false); }
  };
  return <section style={{ padding: 14, border: '1px solid #64748b', borderRadius: 10, display: 'grid', gap: 10 }}>
    <strong>{CAMPANHAS[tipo].nome} · {ano}</strong>
    <label>Valor unitário (R$) <input aria-label="Valor unitário da campanha" inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} disabled={busy} style={{ width: 110, padding: 8 }}/></label>
    <div>{quantidade} unidade(s) × {fmtBRL(cents == null ? null : cents / 100)} = <strong>{fmtBRL(totalCampanha(quantidade, cents))}</strong></div>
    {(config.extras || []).length > 0 && <div>Total geral (colaboradores + extras): {totalGeralCampanha(quantidade, config.valorCentavos ?? null, config.extras).qtd} unidade(s) · <strong>{fmtBRL(totalGeralCampanha(quantidade, config.valorCentavos ?? null, config.extras).valor)}</strong></div>}
    <small>Uma unidade por colaborador selecionado. Este cálculo não altera o saldo real nem cria lançamento no FV.</small>
    <button disabled={busy || cents == null || !alterado} onClick={() => salvar({ valorCentavos: cents })}>{busy ? 'Salvando...' : 'Salvar valor unitário'}</button>
    <button disabled={busy} onClick={() => salvar({ oculta: !config.oculta })}>{config.oculta ? 'Restaurar calendário automático' : 'Ocultar solicitação nesta campanha'}</button>
    <small>{config.oculta ? 'Oculta manualmente neste tipo e ano. O próximo ciclo anual não é afetado.' : 'Natal: 01/10 a 30/11. Páscoa: 01/02 a 31/03. Histórico sempre disponível ao gerencial.'}</small>
    <button disabled={busy || carregando || (!quantidade && !(config.extras || []).length) || (quantidade > 0 && cents == null) || alterado} onClick={onPDF}>Gerar PDF da solicitação ({quantidade + (config.extras || []).reduce((n, x) => n + x.qtd, 0)})</button>
    {alterado && <small>Salve o valor antes de gerar o PDF.</small>}
    {erro && <div role="alert">{erro}</div>}
  </section>;
}

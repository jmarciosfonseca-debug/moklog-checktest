import React, { useState } from 'react';

export default function ConfiguracaoMaturidade({ equipe, onSave }) {
  const [desde, setDesde] = useState(equipe.historicoDesde || '');
  const [catalogo, setCatalogo] = useState(equipe.treinamentosEsperados || []);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const mudar = (n, patch) => setCatalogo(lista => lista.map((t, i) => i === n ? { ...t, ...patch } : t));
  const salvar = async () => {
    setErro('');
    if (catalogo.some(t => !String(t.nome || '').trim() || (t.validadeMeses !== undefined && (!Number.isInteger(t.validadeMeses) || t.validadeMeses < 1)))) { setErro('Informe nomes e validades inteiras positivas, ou deixe a validade vazia.'); return; }
    setSalvando(true);
    try { await onSave({ historicoDesde: desde || null, treinamentosEsperados: catalogo.map(t => ({ ...t, nome: t.nome.trim() })) }); }
    catch (e) { setErro(e.message || 'Não foi possível salvar.'); }
    finally { setSalvando(false); }
  };
  return <details style={{ border: '1px solid #94a3b8', borderRadius: 8, padding: 10 }}><summary>Configuração gerencial da maturidade</summary>
    <p>Defina somente a cobertura efetivamente conhecida. Sem cobertura de pelo menos 90 dias, faltas e FT ficam não aferidos.</p>
    <label>Histórico registrado desde <input type="date" value={desde} onChange={e => setDesde(e.target.value)} /></label>
    <h4>Catálogo de treinamentos esperados</h4>
    {catalogo.map((t, n) => <fieldset key={n}><label>Nome <input value={t.nome} onChange={e => mudar(n, { nome: e.target.value })} /></label><label><input type="checkbox" checked={!!t.obrigatorio} onChange={e => mudar(n, { obrigatorio: e.target.checked })} />Obrigatório</label><label>Validade (meses, vazio = não expira) <input type="number" min="1" step="1" value={t.validadeMeses ?? ''} onChange={e => mudar(n, { validadeMeses: e.target.value === '' ? undefined : Number(e.target.value) })} /></label><button type="button" onClick={() => setCatalogo(lista => lista.filter((_, i) => i !== n))}>Retirar do catálogo</button></fieldset>)}
    <button type="button" onClick={() => setCatalogo(lista => [...lista, { nome: '', obrigatorio: true }])}>Adicionar treinamento</button>
    <button type="button" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar configuração'}</button>
    {erro && <p role="alert">{erro}</p>}
  </details>;
}

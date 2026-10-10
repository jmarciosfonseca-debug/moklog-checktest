import React, { useState } from 'react';
import { paleta } from './MaturidadeResumo';
import { primeiroRegistro, SUGESTOES_TREINAMENTO } from './maturidade';

export default function ConfiguracaoMaturidade({ equipe, onSave, dark = true }) {
  const c = paleta(dark);
  const mu = { fontSize: 12, color: c.mu, lineHeight: 1.4, margin: '4px 0' };
  const campo = { width: '100%', boxSizing: 'border-box', padding: '8px', marginTop: 4, background: c.sub, color: c.fg, border: `1px solid ${c.bd}`, borderRadius: 6, fontSize: 14 };
  const botao = { padding: '9px 12px', margin: '6px 6px 0 0', background: c.sub, color: c.fg, border: `1px solid ${c.bd}`, borderRadius: 6, fontSize: 13, cursor: 'pointer' };
  const [desde, setDesde] = useState(equipe.historicoDesde || '');
  const [catalogo, setCatalogo] = useState(equipe.treinamentosEsperados || []);
  const primeiro = primeiroRegistro(equipe);
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
  return <details id="cfg-maturidade" style={{ border: `1px solid ${c.bd}`, borderRadius: 10, padding: 12, background: c.bg, color: c.fg }}><summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>Configuração gerencial da maturidade</summary>
    <p style={mu}><b>Para que serve:</b> informa ao cálculo o que ele não consegue saber sozinho. Nada aqui altera fichas ou registros dos colaboradores; só muda como a maturidade é calculada.</p>
    <label style={{ display: 'block', fontSize: 13, marginTop: 8 }}>Histórico registrado desde
      <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={campo} /></label>
    {primeiro && <button type="button" style={botao} onClick={() => setDesde(primeiro)}>Usar o 1º registro da equipe ({primeiro.split('-').reverse().join('/')})</button>}
    <p style={mu}>A data a partir da qual faltas, atrasos e folgas trabalhadas passaram a ser lançados no MokLog. Sem ao menos 90 dias de cobertura, esses eixos ficam "não aferidos" (em vez de parecerem 100%).</p>
    <h4 style={{ margin: '12px 0 4px', fontSize: 13 }}>Catálogo de treinamentos esperados</h4>
    <p style={mu}>Lista dos cursos que o posto exige. Com catálogo, o eixo "Obrigatórios" mede quantos o colaborador concluiu. Sem catálogo, aparece "Sem catálogo para aferir conclusão". Para lançar um treinamento a uma pessoa, use a ficha dela; aqui só se define o que é esperado. "Retirar do catálogo" remove apenas o item da lista, nenhum registro de colaborador é apagado.</p>
    {catalogo.map((t, n) => <fieldset key={n} style={{ border: `1px solid ${c.bd}`, borderRadius: 8, margin: '8px 0', padding: 10 }}>
      <label style={{ display: 'block', fontSize: 13 }}>Nome do treinamento <input value={t.nome} onChange={e => mudar(n, { nome: e.target.value })} style={campo} /></label>
      <label style={{ display: 'block', fontSize: 13, marginTop: 8 }}><input type="checkbox" checked={!!t.obrigatorio} onChange={e => mudar(n, { obrigatorio: e.target.checked })} /> Obrigatório</label>
      <label style={{ display: 'block', fontSize: 13, marginTop: 8 }}>Validade em meses (vazio = não expira) <input type="number" min="1" step="1" value={t.validadeMeses ?? ''} onChange={e => mudar(n, { validadeMeses: e.target.value === '' ? undefined : Number(e.target.value) })} style={campo} /></label>
      <button type="button" style={botao} onClick={() => setCatalogo(lista => lista.filter((_, i) => i !== n))}>Retirar do catálogo</button>
    </fieldset>)}
    <button type="button" style={botao} onClick={() => setCatalogo(lista => [...lista, { nome: '', obrigatorio: true }])}>Adicionar ao catálogo</button>
    <p style={mu}>Sugestões (edite e confirme antes de salvar):</p>
    {SUGESTOES_TREINAMENTO.filter(s => !catalogo.some(t => t.nome === s.nome)).map(s => <button key={s.nome} type="button" style={botao} onClick={() => setCatalogo(lista => [...lista, { ...s }])}>+ {s.nome}</button>)}
    <button type="button" style={{ ...botao, background: '#1d4ed8', color: '#fff', borderColor: '#1d4ed8' }} disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar configuração'}</button>
    {erro && <p role="alert" style={{ color: '#ef4444', fontSize: 13 }}>{erro}</p>}
  </details>;
}

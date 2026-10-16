import { useState } from 'react';
import { valorCampanhaCentavos, totalExtra, totaisExtras, extraValido, novoIdExtra, MAX_EXTRAS } from './campanhasEquipe';
import { fmtBRL } from './equipeAprovacao';
import { reduzirFoto, lerArquivo } from './fotoCampanha';

const VAZIO = { descricao: '', qtd: '1', valor: '', obs: '', fotoRef: '', fotoNova: '' };

// Itens extras da campanha (somente gerencial). Cada alteração grava a lista completa; nada é apagado sem confirmação.
export default function CampanhaExtras({ extras = [], fotos = {}, idFoto, onSalvar, onEnviarFoto }) {
  const [f, setF] = useState(VAZIO);
  const [editando, setEditando] = useState(null);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const cents = valorCampanhaCentavos(f.valor);
  const qtd = /^\d+$/.test(f.qtd) ? Number(f.qtd) : null;
  const previa = qtd != null && cents != null ? qtd * cents / 100 : null;
  const tot = totaisExtras(extras);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const escolherFoto = async e => {
    const arq = e.target.files && e.target.files[0]; e.target.value = '';
    if (!arq) return;
    setErro('');
    const url = await reduzirFoto(await lerArquivo(arq));
    if (!url) { setErro('Não foi possível usar esta imagem. Escolha outra foto (JPG/PNG).'); return; }
    set('fotoNova', url);
  };
  const gravar = async lista => {
    setBusy(true); setErro('');
    try { await onSalvar({ extras: lista }); return true; }
    catch (e) { setErro(e.message || 'Não foi possível salvar.'); return false; }
    finally { setBusy(false); }
  };
  const salvarItem = async () => {
    if (!f.descricao.trim()) { setErro('Informe o modelo/descrição.'); return; }
    if (qtd == null || qtd < 1) { setErro('Informe a quantidade (pessoas), mínimo 1.'); return; }
    if (cents == null) { setErro('Informe o valor unitário (ex.: 150,00).'); return; }
    setBusy(true); setErro('');
    try {
      let fotoRef = f.fotoRef || undefined;
      if (f.fotoNova) fotoRef = await onEnviarFoto(idFoto, f.fotoNova);
      const item = { id: editando || novoIdExtra(), descricao: f.descricao.trim(), qtd, valorCentavos: cents, ...(f.obs.trim() ? { obs: f.obs.trim() } : {}), ...(fotoRef ? { fotoRef } : {}) };
      if (!extraValido(item)) throw new Error('Dados do item inválidos.');
      const lista = editando ? extras.map(x => x.id === editando ? item : x) : [...extras, item];
      await onSalvar({ extras: lista });
      setF(VAZIO); setEditando(null);
    } catch (e) { setErro(e.message || 'Não foi possível salvar.'); }
    finally { setBusy(false); }
  };
  const editar = x => {
    setEditando(x.id); setErro('');
    setF({ descricao: x.descricao, qtd: String(x.qtd), valor: (x.valorCentavos / 100).toFixed(2).replace('.', ','), obs: x.obs || '', fotoRef: x.fotoRef || '', fotoNova: '' });
  };
  const remover = async x => {
    if (!window.confirm(`Remover o item "${x.descricao}"?`)) return;
    await gravar(extras.filter(y => y.id !== x.id));
    if (editando === x.id) { setEditando(null); setF(VAZIO); }
  };
  const fotoAtual = f.fotoNova || (f.fotoRef && fotos[f.fotoRef]) || '';

  return <section aria-label="Itens extras da campanha" style={{ padding: 14, border: '1px solid #64748b', borderRadius: 10, display: 'grid', gap: 8 }}>
    <strong>Itens extras (gerencial)</strong>
    <small>Acrescente cestas além das marcadas pela equipe (ex.: administração), com valor e observação próprios.</small>
    {extras.map(x => <div key={x.id} style={{ display: 'flex', gap: 8, alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: 8, padding: 8 }}>
      {x.fotoRef && fotos[x.fotoRef] ? <img src={fotos[x.fotoRef]} alt={`Foto: ${x.descricao}`} style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 6 }}/> : null}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700 }}>{x.descricao}</div>
        <div style={{ fontSize: 12 }}>{x.qtd} × {fmtBRL(x.valorCentavos / 100)} = <strong>{fmtBRL(totalExtra(x))}</strong></div>
        {x.obs ? <div style={{ fontSize: 11, opacity: .8 }}>{x.obs}</div> : null}
      </div>
      <button disabled={busy} onClick={() => editar(x)}>Editar</button>
      <button disabled={busy} onClick={() => remover(x)} aria-label={`Remover ${x.descricao}`}>Remover</button>
    </div>)}
    {extras.length > 0 && <div>Extras: {tot.qtd} unidade(s) · <strong>{fmtBRL(tot.valor)}</strong></div>}
    {(extras.length < MAX_EXTRAS || editando) && <div style={{ display: 'grid', gap: 6 }}>
      <strong style={{ fontSize: 12 }}>{editando ? 'Editar item' : 'Novo item'}</strong>
      <input aria-label="Modelo ou descrição do item extra" placeholder="Ex.: Cesta modelo XY — Administração" maxLength={120} value={f.descricao} onChange={e => set('descricao', e.target.value)} disabled={busy} style={{ padding: 8 }}/>
      <div style={{ display: 'flex', gap: 8 }}>
        <label>Pessoas/qtd <input aria-label="Quantidade do item extra" inputMode="numeric" value={f.qtd} onChange={e => set('qtd', e.target.value.replace(/\D/g, '').slice(0, 5))} disabled={busy} style={{ width: 70, padding: 8 }}/></label>
        <label>Valor unit. (R$) <input aria-label="Valor unitário do item extra" inputMode="decimal" value={f.valor} onChange={e => set('valor', e.target.value)} disabled={busy} style={{ width: 100, padding: 8 }}/></label>
      </div>
      <div aria-live="polite">Total do item: <strong>{fmtBRL(previa)}</strong></div>
      <textarea aria-label="Observação do item extra" placeholder="Observação (opcional)" maxLength={300} value={f.obs} onChange={e => set('obs', e.target.value)} disabled={busy} rows={2} style={{ padding: 8 }}/>
      <label>Foto do catálogo (opcional) <input aria-label="Foto do item extra" type="file" accept="image/*" onChange={escolherFoto} disabled={busy}/></label>
      {fotoAtual ? <img src={fotoAtual} alt="Pré-visualização da foto" style={{ maxWidth: 160, borderRadius: 6 }}/> : null}
      {(f.fotoNova || f.fotoRef) && <button disabled={busy} onClick={() => setF(p => ({ ...p, fotoNova: '', fotoRef: '' }))}>Remover foto do item</button>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button disabled={busy} onClick={salvarItem}>{busy ? 'Salvando...' : editando ? 'Salvar alterações do item' : 'Adicionar item'}</button>
        {editando && <button disabled={busy} onClick={() => { setEditando(null); setF(VAZIO); setErro(''); }}>Cancelar</button>}
      </div>
    </div>}
    {erro && <div role="alert">{erro}</div>}
  </section>;
}

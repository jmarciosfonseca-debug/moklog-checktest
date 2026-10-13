import React from 'react';
import { ocupacaoDoQuadro, turnoverSobreQuadro } from './quadroPrevisto';
import { calcularMapaEquipe } from './maturidade';
import { paleta } from './MaturidadeResumo';

// Quadro de efetivo do projeto: postos previstos x ativos x vagas (gabarito Moked) e turnover sobre o quadro.
export default function QuadroEfetivo({ projectId, equipe, hoje, dark = true, gerando = false, onMatriz }) {
  const ocup = ocupacaoDoQuadro(projectId, equipe.colaboradores || []);
  if (!ocup) return null;
  const c = paleta(dark);
  const mu = { fontSize: 12, color: c.mu, lineHeight: 1.4, margin: '4px 0' };
  let modelo = null;
  try { modelo = calcularMapaEquipe(equipe, hoje); } catch (e) { modelo = null; }
  const turnQuadro = modelo ? turnoverSobreQuadro(projectId, modelo.desligados12m) : null;
  const completo = ocup.vagas === 0;
  const cor = completo ? '#22c55e' : '#f59e0b';
  const porPosto = ocup.semPosto === 0;
  return <details style={{ border: `1px solid ${c.bd}`, borderRadius: 10, padding: 12, background: c.bg, color: c.fg }}>
    <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
      Quadro de efetivo: {ocup.ativos}/{ocup.previsto}
      <span style={{ color: cor }}>{completo ? ' · quadro completo' : ` · ${ocup.vagas} vaga(s)`}</span>
      {ocup.excedente > 0 && <span style={{ color: '#f59e0b' }}> · {ocup.excedente} acima do previsto</span>}
    </summary>
    <p style={mu}>Previsto pela Matriz de Dimensionamento de Efetivo Moked. Vaga = previsto − ativos. {porPosto ? '' : `${ocup.semPosto} ativo(s) com cargo que não identifica um posto único; a vaga por posto considera só os cargos reconhecidos.`}</p>
    <div style={{ display: 'grid', gap: 4, marginTop: 6 }}>
      {ocup.linhas.map((l, i) => <div key={i} style={{ background: c.sub, borderRadius: 6, padding: '6px 8px', fontSize: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <b>{l.cargo}</b>
          <span style={{ fontWeight: 700, color: l.vagas ? '#f59e0b' : '#22c55e', whiteSpace: 'nowrap' }}>{l.ocupados}/{l.qtd}{l.vagas ? ` · ${l.vagas} vaga(s)` : ''}</span>
        </div>
        <div style={{ color: c.mu, fontSize: 11 }}>{l.regime} · {l.escala} · {l.composicao}</div>
      </div>)}
    </div>
    <p style={mu}>
      Turnover 12 meses: {turnQuadro === null ? 'não aferido' : `${Math.round(turnQuadro)}% sobre o quadro (${modelo.desligados12m} deslig. ÷ ${ocup.previsto} postos)`}
      {modelo && modelo.turnover !== null ? ` · ${Math.round(modelo.turnover)}% sobre o efetivo médio real` : ''}
    </p>
    {onMatriz && <button type="button" disabled={gerando} onClick={onMatriz}
      style={{ width: '100%', marginTop: 6, background: '#0369a1', color: '#fff', border: 'none', borderRadius: 10, padding: 11, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: gerando ? 0.6 : 1 }}>
      {gerando ? 'Gerando...' : 'Matriz de efetivo (PDF) — todas as unidades'}
    </button>}
  </details>;
}

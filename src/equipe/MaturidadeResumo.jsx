import React from 'react';
import { calcularMapaEquipe, rotuloTreinamentos } from './maturidade';
import { radarEquipe } from '../relatorios/mapaEquipeRelatorio';

export const ROTULOS_EIXOS = { assiduidade: 'Assiduidade', ft: 'Folga trabalhada', treinamento: 'Treinamento', reciclagem: 'Reciclagem', tempoCasa: 'Tempo de casa' };
const nota = n => n === null ? 'Não aferido' : `${Math.round(n)}/100`;

export function IndiceIndividual({ resultado }) {
  if (!resultado) return null;
  return <details style={{ marginTop: 8 }}>
    <summary style={{ cursor: 'pointer', fontSize: 12 }}>Índice: {nota(resultado.indice)} · {resultado.classe}{resultado.afastado ? ' · Afastado (fora da média)' : ''}</summary>
    {resultado.indice !== null && <meter aria-label="Índice individual" min="0" max="100" value={resultado.indice} style={{ width: '100%' }} />}
    {Object.entries(ROTULOS_EIXOS).map(([k, label]) => <div key={k} style={{ fontSize: 11, marginTop: 5 }}>
      <span>{k === 'treinamento' ? 'Obrigatórios' : label}: {k === 'treinamento' && resultado.eixos[k] === null ? 'Sem catálogo para aferir conclusão' : nota(resultado.eixos[k])}</span>
      {resultado.eixos[k] !== null && <meter aria-label={label} min="0" max="100" value={resultado.eixos[k]} style={{ display: 'block', width: '100%' }} />}
    </div>)}
    {resultado.treinamentosRegistrados?.registros > 0 && <p>Treinamentos registrados: {resultado.treinamentosRegistrados.registros} ({resultado.treinamentosRegistrados.recentes} nos últimos 12 meses).</p>}
  </details>;
}

export default function MaturidadeResumo({ equipe, hoje }) {
  const modelo = calcularMapaEquipe(equipe, hoje);
  return <details style={{ border: '1px solid #94a3b8', borderRadius: 10, padding: 12 }}>
    <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Maturidade da equipe: {nota(modelo.indice)} · {modelo.classe}</summary>
    <p style={{ fontSize: 12 }}>Base: {hoje} · {modelo.quantidadeAferida} colaboradores aferidos · Estabilidade: {nota(modelo.estabilidade)}</p>
    <p style={{ fontSize: 12 }}>Indicador descritivo dos registros disponíveis. Não substitui avaliação individual ou de conhecimento do posto.</p>
    <p><strong>Treinamentos aplicados:</strong> {rotuloTreinamentos(modelo.treinamentos)}</p>
    <div style={{ maxWidth: 320, background: '#fff', color: '#111827' }} dangerouslySetInnerHTML={{ __html: radarEquipe(modelo.eixos) }} />
    {Object.entries(ROTULOS_EIXOS).map(([k, label]) => <div key={k}>{k === 'treinamento' ? 'Conclusão dos obrigatórios' : label}: {k === 'treinamento' && modelo.eixos[k] === null ? 'Sem catálogo para aferir' : nota(modelo.eixos[k])}</div>)}
    <h4>Destaques por índice (inclui empates)</h4>
    {modelo.top.length ? modelo.top.map(i => <div key={i.colaborador.id}>{i.colaborador.nome}: {nota(i.indice)}</div>) : <p>Sem índices aferidos.</p>}
    <h4>Alertas</h4>
    {modelo.alertas.length ? <ul>{modelo.alertas.map((a, n) => <li key={`${a.colabId}-${n}`}>{a.nome}: {a.texto}</li>)}</ul> : <p>Nenhum alerta nos dados aferidos.</p>}
    {modelo.individuos.map(i => <div key={i.colaborador.id} style={{ borderTop: '1px solid #94a3b8', marginTop: 10, paddingTop: 8 }}><strong>{i.colaborador.nome}</strong><IndiceIndividual resultado={i} /></div>)}
  </details>;
}

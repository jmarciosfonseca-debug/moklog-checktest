import React from 'react';
import { calcularMapaEquipe, rotuloTreinamentos, notaTreinamentos, TITULO_TREINAMENTOS, primeiroRegistro, diasEntre } from './maturidade';
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
    {resultado.treinamentosRegistrados?.registros > 0 && <p style={{ fontSize: 11 }}>Treinamentos registrados na ficha: {resultado.treinamentosRegistrados.registros} ({resultado.treinamentosRegistrados.recentes} nos últimos 12 meses{resultado.treinamentosRegistrados.futuros ? `, ${resultado.treinamentosRegistrados.futuros} agendado(s)` : ''}).</p>}
  </details>;
}

export const paleta = dark => dark
  ? { bg: '#060c18', fg: '#e5e7eb', mu: '#94a3b8', bd: '#1e293b', sub: '#0b1424' }
  : { bg: '#ffffff', fg: '#111827', mu: '#64748b', bd: '#cbd5e1', sub: '#f1f5f9' };

export default function MaturidadeResumo({ equipe, hoje, dark = true }) {
  const modelo = calcularMapaEquipe(equipe, hoje);
  const c = paleta(dark);
  const sec = { margin: '12px 0 4px', fontSize: 13, color: c.fg };
  const mu = { fontSize: 12, color: c.mu, lineHeight: 1.4, margin: '4px 0' };
  return <details style={{ border: `1px solid ${c.bd}`, borderRadius: 10, padding: 12, background: c.bg, color: c.fg }}>
    <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>Maturidade da equipe: {nota(modelo.indice)} · {modelo.classe}</summary>
    <p style={mu}><b>Para que serve:</b> resume, em um número de 0 a 100, o que está registrado na equipe (faltas, folgas trabalhadas, treinamentos, reciclagem e tempo de casa). É o mesmo cálculo do PDF "Mapa de Equipe". Eixo sem registro aparece como "não aferido" e fica fora da conta. Não avalia competência de ninguém.</p>
    <p style={mu}>Referência {hoje} · {modelo.individuos.length} ativos · {modelo.quantidadeAferida} aferidos · Turnover 12 meses: {modelo.turnover === null ? 'Não aferido' : `${Math.round(modelo.turnover)}%`} · Estabilidade: {nota(modelo.estabilidade)}</p>
    <p style={{ ...mu, color: c.fg }}><strong>{TITULO_TREINAMENTOS}:</strong> {rotuloTreinamentos(modelo.treinamentos)}<br /><span style={mu}>{notaTreinamentos(modelo.treinamentos)}</span></p>
    <ComoCompletar equipe={equipe} modelo={modelo} hoje={hoje} dark={dark} />
    <div style={{ maxWidth: 300, width: '100%', margin: '8px auto', background: '#fff', color: '#111827', borderRadius: 8, padding: 4 }} dangerouslySetInnerHTML={{ __html: radarEquipe(modelo.eixos) }} />
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 4, fontSize: 12 }}>
      {Object.entries(ROTULOS_EIXOS).map(([k, label]) => <div key={k} style={{ background: c.sub, borderRadius: 6, padding: '4px 8px' }}>{k === 'treinamento' ? 'Conclusão dos obrigatórios' : label}: <b>{k === 'treinamento' && modelo.eixos[k] === null ? 'Sem catálogo para aferir' : nota(modelo.eixos[k])}</b></div>)}
    </div>
    <h4 style={sec}>Destaques por índice (inclui empates)</h4>
    {modelo.top.length ? modelo.top.map(i => <div key={i.colaborador.id} style={{ fontSize: 12 }}>{i.colaborador.nome}: {nota(i.indice)}</div>) : <p style={mu}>Sem índices aferidos.</p>}
    <h4 style={sec}>Alertas</h4>
    {modelo.alertas.length ? <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>{modelo.alertas.map((a, n) => <li key={`${a.colabId}-${n}`}>{a.nome}: {a.texto}</li>)}</ul> : <p style={mu}>Nenhum alerta nos dados aferidos.</p>}
    <details style={{ marginTop: 12 }}>
      <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Índice por colaborador ({modelo.individuos.length})</summary>
      {modelo.individuos.map(i => <div key={i.colaborador.id} style={{ borderTop: `1px solid ${c.bd}`, marginTop: 8, paddingTop: 6, fontSize: 13 }}><strong>{i.colaborador.nome}</strong><IndiceIndividual resultado={i} /></div>)}
    </details>
  </details>;
}

const brData = iso => iso ? iso.split('-').reverse().join('/') : '';
// Painel vermelho: diz, eixo a eixo, o que falta para o radar ficar completo e como aferir.
export function ComoCompletar({ equipe, modelo, hoje, dark = true }) {
  const faltando = [];
  if (modelo.eixos.assiduidade === null || modelo.eixos.ft === null) {
    const prim = primeiroRegistro(equipe), dias = prim ? diasEntre(prim, hoje) : null;
    let dica;
    if (!equipe.historicoDesde) dica = prim
      ? `O cálculo já usa automaticamente o 1º registro da equipe (${brData(prim)}, ${dias} dias de histórico). Faltam ${Math.max(0, 90 - dias)} dias para o mínimo de 90 — até lá, "não aferido" é o correto, não uma falha.`
      : 'Ainda não há faltas, atrasos ou folgas lançados na equipe: lance-os nas fichas.';
    else dica = `Início definido em ${brData(equipe.historicoDesde)}, mas a cobertura ainda não chega a 90 dias (ou a data é inválida/futura).`;
    faltando.push({ eixo: 'Assiduidade e Folga trabalhada', passo: 'Lance faltas, atrasos e folgas trabalhadas nas fichas. O eixo é aferido sozinho quando o histórico completar 90 dias (ou fixe outra data em "Configuração gerencial").', dica });
  }
  if (modelo.eixos.treinamento === null) faltando.push({ eixo: 'Conclusão dos obrigatórios', passo: 'Em "Configuração gerencial da maturidade", cadastre o catálogo de treinamentos exigidos (marque "Obrigatório", validade opcional) e salve. Depois lance cada treinamento na ficha, com o mesmo nome do catálogo.', dica: 'Na configuração, o botão "Importar dos treinamentos já lançados nas fichas" monta o catálogo com o que a equipe já tem registrado; há também sugestões prontas — edite conforme o posto.' });
  if (!faltando.length) return null;
  const abrir = () => { const el = document.getElementById('cfg-maturidade'); if (el) { el.open = true; el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } };
  const t = dark ? { fg: '#fecaca', bg: '#1a0202', bd: '#ef4444' } : { fg: '#991b1b', bg: '#fef2f2', bd: '#dc2626' };
  return <div role="alert" style={{ margin: '10px 0', padding: '10px 12px', background: t.bg, border: `1px solid ${t.bd}`, borderLeft: `5px solid ${t.bd}`, borderRadius: 8, color: t.fg, fontSize: 12.5, lineHeight: 1.45 }}>
    <b style={{ fontSize: 13 }}>⚠ Radar incompleto — como aferir</b>
    {faltando.map(f => <div key={f.eixo} style={{ marginTop: 8 }}><b>{f.eixo}:</b> {f.passo}<br /><span style={{ opacity: .9 }}>{f.dica}</span></div>)}
    <button type="button" onClick={abrir} style={{ marginTop: 8, padding: '8px 12px', background: t.bd, color: '#fff', border: 'none', borderRadius: 6, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Abrir configuração</button>
  </div>;
}

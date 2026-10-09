// Adaptador: plantões da Ronda Diária (projetos Golgi) → modelo do consolidado perimetral Moked.
// O teste perimetral do plantão é posicional (índice = Nª zona); o turno vem em minúsculas.
import { gerarConsolidadoPerimetralHTML } from './perimetralConsolidado';

export const nomeZonaPlantao = (i) => `Zona ${String(i + 1).padStart(2, '0')}`;

export function plantoesParaTestes(plantoes) {
  return (plantoes || [])
    .filter(p => p && p.perimetral && p.perimetral.feito && (p.perimetral.zonas || []).length)
    .map(p => {
      const zonas = {};
      p.perimetral.zonas.forEach((z, i) => {
        const st = z && z.status === 'inoperante' ? 'inop' : (z && z.status) || 'ok';
        zonas[nomeZonaPlantao(i)] = { status: st, obs: (z && z.obs) || '' };
      });
      return {
        id: p.id, data: p.dataPlantao, turno: p.turno === 'noturno' ? 'Noturno' : 'Diurno',
        quemFez: p.lider || '', zonas,
        rondas: (p.rondas || []).map(r => ({
          hora: `${r.inicio || '—'} – ${r.fim || '—'}`,
          executante: r.executante || p.lider || '—',
          obs: [r.externa ? 'Externa' : '', r.obs || ''].filter(Boolean).join(' · '),
        })),
      };
    });
}

export function gerarConsolidadoPlantoesHTML({ project, plantoes, zonaMapa, mapa, modo = 'perim', hoje = new Date() }) {
  const pos = zonaMapa || [];
  const zonas = pos.map((_, i) => nomeZonaPlantao(i));
  const zonaPos = {};
  pos.forEach((q, i) => { zonaPos[zonas[i]] = q; });
  const testes = plantoesParaTestes(plantoes);
  const datas = testes.map(t => t.data).filter(Boolean).sort();
  return gerarConsolidadoPerimetralHTML({
    testes, project, hoje,
    pcfg: { zonas, zonaPos, mapaB64: mapa || '', clienteNome: project.name },
    escopo: 'periodo', incluirPerim: true, incluirRondas: modo === 'ambos',
    periodoDe: datas[0] || null, periodoAte: datas[datas.length - 1] || null,
  });
}

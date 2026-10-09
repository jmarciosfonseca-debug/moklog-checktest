import { plantoesParaTestes, gerarConsolidadoPlantoesHTML } from './perimetralPlantao';

const pl = (id, d, turno, zs, extra = {}) => ({ id, dataPlantao: d, turno, lider: 'Fulano Teste', rondas: [{ inicio: '08:00', fim: '08:40', executante: 'Ciclano', externa: true, obs: 'ok' }], perimetral: { feito: true, zonas: zs }, ...extra });
const pos = [{ x: 10, y: 10 }, { x: 50, y: 50 }, { x: 80, y: 20 }];
const proj = { id: 'P606', name: 'Cliente Ficticio' };
const base = [
  pl('a', '2026-10-01', 'diurno', [{ status: 'ok' }, { status: 'parcial', obs: 'cerca baixa' }, { status: 'inoperante', obs: 'sensor' }]),
  pl('b', '2026-10-01', 'noturno', [{ status: 'ok' }, { status: 'ok' }, { status: 'ok' }]),
  pl('c', '2026-10-03', 'diurno', [{ status: 'ok' }, { status: 'ok' }, { status: 'ok' }]),
  { id: 'd', dataPlantao: '2026-10-02', turno: 'diurno', perimetral: { feito: false }, rondas: [] },
];

test('mapeia status, turno e zonas posicionais', () => {
  const t = plantoesParaTestes(base);
  expect(t).toHaveLength(3);
  expect(t[0].turno).toBe('Diurno'); expect(t[1].turno).toBe('Noturno');
  expect(t[0].zonas['Zona 03'].status).toBe('inop');
  expect(t[0].zonas['Zona 02'].obs).toBe('cerca baixa');
});

test('perim: documento Moked sem seção de rondas, aponta dia sem teste e turno faltante', () => {
  const h = gerarConsolidadoPlantoesHTML({ project: proj, plantoes: base, zonaMapa: pos, mapa: 'data:image/jpeg;base64,AAAA', modo: 'perim', hoje: new Date(2026, 9, 5) });
  expect(h).toContain('data:image/jpeg;base64,AAAA');
  expect(h).not.toContain('base64,data:');
  expect(h).toContain('cerca baixa');
  expect(h).toMatch(/02\/10\/2026/);
  expect(h).not.toMatch(/NaN%|>NaN<|Infinity/);
  expect(h).not.toContain('Continuidade');
});

test('ambos: inclui rondas dos plantões', () => {
  const h = gerarConsolidadoPlantoesHTML({ project: proj, plantoes: base, zonaMapa: pos, mapa: '', modo: 'ambos', hoje: new Date(2026, 9, 5) });
  expect(h).toContain('08:00 – 08:40');
  expect(h).toContain('Externa');
});

test('sem plantões com teste não quebra', () => {
  const h = gerarConsolidadoPlantoesHTML({ project: proj, plantoes: [], zonaMapa: pos, mapa: '', modo: 'perim' });
  expect(h).not.toMatch(/NaN%|>NaN<|Infinity/);
});

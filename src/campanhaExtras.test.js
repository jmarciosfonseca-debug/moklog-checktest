import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import CampanhaExtras from './CampanhaExtras';
import { extraValido, totaisExtras, totalGeralCampanha } from './campanhasEquipe';
import { gerarPDFCestaNatal } from './pdfSolicitacoes';
const { save } = require('../api/ai/lib/equipeMerge');

const base = { colaboradores: [], desligados: [], checagemEquipe: { alvo: '2026-10-03', checkins: [] } };
const banco = () => { const set = jest.fn(); return { set, collection: () => ({ doc: () => ({}) }), runTransaction: fn => fn({ get: async () => ({ exists: true, data: () => base }), set }) }; };
const item = { id: 'x1', descricao: 'Cesta XY — Administração', qtd: 3, valorCentavos: 15000, obs: 'aprovado', fotoRef: 'campanha-natal-2026-abc' };

test('cálculo dos extras e total geral', () => {
  expect(extraValido(item)).toBe(true);
  expect(extraValido({ ...item, qtd: 0 })).toBe(false);
  expect(extraValido({ ...item, valorCentavos: 1.5 })).toBe(false);
  expect(totaisExtras([item, { ...item, id: 'x2', qtd: 2, valorCentavos: 1000 }])).toEqual({ qtd: 5, valor: 470 });
  expect(totalGeralCampanha(10, 10000, [item])).toEqual({ qtd: 13, valor: 1450, baseCalculada: true });
});

test('API: gerencial grava extras; líder não; lixo é rejeitado', async () => {
  const next = { ...base, campanhasSazonais: { natal_2026: { valorCentavos: 10000, extras: [item] } } };
  await expect(save(banco(), 'P601', base, next, { nivel: 'lider' })).rejects.toMatchObject({ status: 403 });
  expect(await save(banco(), 'P601', base, next, { nivel: 'admin' })).toEqual(next);
  for (const ruim of [{ ...item, qtd: -1 }, { ...item, descricao: '' }, { ...item, extra: 1 }, { ...item, fotoRef: '../x' }, { ...item, id: 'a b' }]) {
    await expect(save(banco(), 'P601', base, { ...base, campanhasSazonais: { natal_2026: { extras: [ruim] } } }, { nivel: 'admin' })).rejects.toMatchObject({ status: 400 });
  }
  await expect(save(banco(), 'P601', base, { ...base, campanhasSazonais: { natal_2026: { extras: [item, item] } } }, { nivel: 'admin' })).rejects.toBeDefined();
});

test('PDF inclui itens extras, observação, foto e total geral', () => {
  const OldBlob = global.Blob; let html = ''; global.Blob = class { constructor(p) { html = p.join(''); } };
  global.URL.createObjectURL = jest.fn(() => 'blob:t'); global.URL.revokeObjectURL = jest.fn();
  const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  try {
    const n = gerarPDFCestaNatal({ id: 'P601' }, [{ nome: 'A' }], 2026, { tipo: 'natal', valorCentavos: 10000, extras: [item], fotos: { [item.fotoRef]: 'data:image/jpeg;base64,AAAA' } });
    expect(n).toBe(4);
    expect(html).toContain('Cesta XY'); expect(html).toContain('aprovado'); expect(html).toContain('data:image/jpeg;base64,AAAA');
    expect(html).toContain('TOTAL GERAL'); expect(html).toContain('550,00');
    gerarPDFCestaNatal({ id: 'P601' }, [], 2026, { tipo: 'natal', extras: [item] });   // só extras, sem colaboradores
    expect(html).toContain('450,00');
  } finally { global.Blob = OldBlob; click.mockRestore(); }
});

const digitar = (el, v) => { const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set; set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
const montar = async props => { global.IS_REACT_ACT_ENVIRONMENT = true; const host = document.createElement('div'); document.body.appendChild(host); const root = createRoot(host); await act(async () => root.render(<CampanhaExtras fotos={{}} idFoto="campanha-natal-2026" onEnviarFoto={async () => 'ref1'} {...props} />)); return { host, root }; };
const q = (host, l) => host.querySelector(`[aria-label="${l}"]`);
const btn = (host, t) => [...host.querySelectorAll('button')].find(b => b.textContent === t);

test('tela: calcula total do item e salva lista completa', async () => {
  const onSalvar = jest.fn(async () => {});
  const { host, root } = await montar({ extras: [], onSalvar });
  await act(async () => { digitar(q(host, 'Modelo ou descrição do item extra'), 'Cesta XY'); digitar(q(host, 'Quantidade do item extra'), '3a'); digitar(q(host, 'Valor unitário do item extra'), '150,00'); });
  expect(q(host, 'Quantidade do item extra').value).toBe('3');
  expect(host.textContent).toMatch(/450,00/);
  await act(async () => { btn(host, 'Adicionar item').click(); });
  expect(onSalvar).toHaveBeenCalledTimes(1);
  const lista = onSalvar.mock.calls[0][0].extras;
  expect(lista).toHaveLength(1);
  expect(lista[0]).toMatchObject({ descricao: 'Cesta XY', qtd: 3, valorCentavos: 15000 });
  await act(async () => root.unmount());
});

test('tela: valida campos e confirma antes de remover', async () => {
  const onSalvar = jest.fn(async () => {});
  const { host, root } = await montar({ extras: [item], onSalvar });
  await act(async () => { btn(host, 'Adicionar item').click(); });
  expect(host.querySelector('[role="alert"]').textContent).toMatch(/descrição/);
  const conf = jest.spyOn(window, 'confirm').mockReturnValue(false);
  await act(async () => { q(host, 'Remover Cesta XY — Administração').click(); });
  expect(onSalvar).not.toHaveBeenCalled();
  conf.mockReturnValue(true);
  await act(async () => { q(host, 'Remover Cesta XY — Administração').click(); });
  expect(onSalvar).toHaveBeenCalledWith({ extras: [] });
  conf.mockRestore();
  await act(async () => root.unmount());
});

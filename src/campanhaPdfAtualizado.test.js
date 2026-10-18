// Campo 18/10 (P311B): reajuste da Cesta de Natal de R$ 114,90 para R$ 126,39 e troca da foto do catálogo;
// o PDF tem que sair SEMPRE com a última versão salva (valor, modelo, foto e itens adicionais).
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { gerarPDFCestaNatal } from './pdfSolicitacoes';
import CampanhaEquipeControle from './CampanhaEquipeControle';

const FOTO_NOVA = 'data:image/jpeg;base64,Tk9WQQ==';
const FOTO_VELHA = 'data:image/jpeg;base64,VkVMSEE=';
jest.mock('./fotoCampanha', () => ({ lerArquivo: async () => 'x', reduzirFoto: async () => 'data:image/jpeg;base64,Tk9WQQ==' }));

const capturar = (fn) => {
  const OldBlob = global.Blob; let html = '', arquivo = '';
  global.Blob = class { constructor(parts) { html = parts.join(''); } };
  global.URL.createObjectURL = jest.fn(() => 'blob:t'); global.URL.revokeObjectURL = jest.fn();
  const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () { arquivo = this.download; });
  try { fn(); } finally { global.Blob = OldBlob; click.mockRestore(); }
  return { html, arquivo };
};
const equipe = Array.from({ length: 12 }, (_, i) => ({ nome: `Colaborador ${String(i + 1).padStart(2, '0')}`, cargo: 'Vig CCO', turno: 'Noturno' }));

test('PDF com o valor reajustado em tudo (principal, adicionais, resumo e total geral) e a foto nova', () => {
  const { html, arquivo } = capturar(() => gerarPDFCestaNatal({ id: 'P311B' }, equipe, 2026, {
    tipo: 'natal', valorCentavos: 12639,
    principal: { descricao: 'Cesta base de catálogo', obs: 'Valor diferente devido custo de frete', fotoRef: 'nova' },
    extras: [{ id: 'z', descricao: 'Cesta padrão para (conservação e Zeladoria)', qtd: 2, valorCentavos: 12639 }],
    fotos: { nova: FOTO_NOVA, velha: FOTO_VELHA }, geradoEm: new Date(2026, 9, 18, 10, 15),
  }));
  expect(html).not.toContain('114,90');
  expect(html).toContain('126,39');
  expect(html).toContain('1.516,68');                       // 12 × 126,39
  expect(html).toContain('252,78');                         // adicionais 2 × 126,39
  expect(html).toContain('TOTAL GERAL:</b> 14 unidade(s)');
  expect(html).toContain('1.769,46');                       // total geral
  expect(html).toContain(FOTO_NOVA); expect(html).not.toContain(FOTO_VELHA);
  expect(html).toContain('Valor diferente devido custo de frete');
  expect(html).toContain('Versão gerada em <b>18/10/2026 10:15</b>');
  expect(arquivo).toBe('solicitacao_natal_P311B_2026_2026-10-18_10h15.html');
});

test('controle: reajuste + foto nova → salva e manda ao PDF o valor novo e a foto recém-enviada', async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div'); const root = createRoot(host);
  const onSalvar = jest.fn(async () => {}), onPDF = jest.fn(async () => {}), onEnviarFoto = jest.fn(async () => 'ref-nova');
  await act(async () => root.render(<CampanhaEquipeControle tipo="natal" ano={2026} quantidade={12} idFoto="campanha-natal-2026"
    config={{ valorCentavos: 11490, principal: { descricao: 'Cesta base de catálogo', fotoRef: 'ref-velha' }, extras: [{ id: 'z', descricao: 'Zeladoria', qtd: 2, valorCentavos: 12639 }] }}
    fotos={{ 'ref-velha': FOTO_VELHA }} onSalvar={onSalvar} onPDF={onPDF} onEnviarFoto={onEnviarFoto}/>));
  const valor = host.querySelector('input[aria-label="Valor unitário da campanha"]');
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(valor, '126,39'); valor.dispatchEvent(new Event('input', { bubbles: true })); });
  const arq = host.querySelector('input[aria-label="Foto do modelo da equipe"]');
  await act(async () => { Object.defineProperty(arq, 'files', { value: [new File(['x'], 'cesta.jpg', { type: 'image/jpeg' })], configurable: true }); arq.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(host.textContent).toContain('14 unidade(s) × R$');
  await act(async () => [...host.querySelectorAll('button')].find(b => b.textContent.startsWith('Gerar PDF')).click());
  expect(onEnviarFoto).toHaveBeenCalledWith('campanha-natal-2026', FOTO_NOVA);
  expect(onSalvar).toHaveBeenCalledWith({ valorCentavos: 12639, principal: { descricao: 'Cesta base de catálogo', fotoRef: 'ref-nova' } });
  expect(onPDF).toHaveBeenCalledWith({ valorCentavos: 12639, principal: { descricao: 'Cesta base de catálogo', fotoRef: 'ref-nova' }, fotosNovas: { 'ref-nova': FOTO_NOVA } });
  await act(async () => root.unmount());
});

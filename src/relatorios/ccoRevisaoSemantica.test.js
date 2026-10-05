import { montarRelatorioCCO } from './ccoRelatorio';

test('Supervisão preserva equipamento em aberto no relatório', () => {
  const { html } = montarRelatorioCCO('supervisao', {id:'P601',name:'TESTE'}, [{
    id:'teste', data:'2026-10-05', turno:'diurno', supervisor:'Supervisor TESTE',
    chegada:'08:00', saida:'08:30', resumo:'Dados fictícios',
    equipamentos:[{acao:'aberto',catLabel:'Rádio TESTE',identificacao:'TESTE-01'}],
  }], {agora:new Date('2026-10-05T12:00:00'),interno:true});
  const texto = html.replace(/<[^>]*>/g, '');
  expect(texto).toMatch(/Em aberto \(pendente\): Rádio TESTE/i);
  expect(texto).toMatch(/1 em aberto \(pendente\)/i);
  expect(texto).not.toContain('Conferido: Rádio TESTE');
});

// Checagem de equipe no fim de semana — merge no servidor (api/ai/lib/equipeMerge.js).
// IMPL permite rodar os mesmos cenários contra outra versão do arquivo (ex.: a anterior).
const impl = require(process.env.IMPL || '../api/ai/lib/equipeMerge');
const { merge, save } = impl;
const clone = x => JSON.parse(JSON.stringify(x));
const ALVO = '2026-10-03', ALVO_ANT = '2026-09-26';
const colabs = () => [
  { id: 'l1', nome: 'Líder 1', cargo: 'Vigilante Líder', status: 'ativo', historico: [], uniforme: { solicitacoes: [{ id: 's1', item: 'Camisa', status: 'pendente', aprovacao: 'aprovado' }] } },
  { id: 'l2', nome: 'Líder 2', cargo: 'Vigilante Líder', status: 'ativo', historico: [{ id: 'h1', tipo: 'FT' }], uniforme: { solicitacoes: [] } },
  { id: 'v1', nome: 'Vigilante', cargo: 'Vigilante Ronda', status: 'ativo', historico: [], uniforme: { solicitacoes: [] } },
];
const base = (chk) => ({ colaboradores: colabs(), desligados: [], ...(chk ? { checagemEquipe: chk } : {}) });
// Ordem de chaves igual à do app (registrarCheckinEquipe) — diferente da ordenada do Firestore.
const checkin = (slotId, lider, extra = {}) => ({ slotId, slotLabel: slotId, lider, statusEquipe: 'sem_alteracoes', nota: '', em: '2026-10-03T14:0' + slotId.length + ':00.000Z', ...extra });
// Como o Firestore devolve (chaves em ordem alfabética).
const ordenado = x => Array.isArray(x) ? x.map(ordenado) : (x && typeof x === 'object') ? Object.fromEntries(Object.keys(x).sort().map(k => [k, ordenado(x[k])])) : x;
const comChk = (d, chk) => ({ ...clone(d), checagemEquipe: chk });
const banco = ini => { let data = clone(ini); return {
  collection: () => ({ doc: () => ({}) }), get data() { return data; },
  runTransaction: async fn => { const snap = clone(data); let w; const r = await fn({ get: async () => ({ exists: true, data: () => clone(snap) }), set: (_r, v) => { w = clone(v); } }); if (w) data = w; return r; } }; };
const slots = r => (r.checagemEquipe.checkins || []).map(c => c.slotId);

test('1 primeira assinatura do ciclo (sem concorrência, sem checagem anterior)', () => {
  const b = base(); const a = comChk(b, { alvo: ALVO, checkins: [checkin('sab_diurno', 'Líder 1')] });
  expect(slots(merge(b, a, clone(b)))).toEqual(['sab_diurno']);
});
test('2 dois líderes assinando slots diferentes ao mesmo tempo: preserva os dois', () => {
  const b = base(); const A = comChk(b, { alvo: ALVO, checkins: [checkin('sab_diurno', 'Líder 1')] });
  const B = comChk(b, { alvo: ALVO, checkins: [checkin('sab_noturno', 'Líder 2')] });
  const apos1 = merge(b, A, clone(b));              // A grava primeiro
  const final = merge(b, B, apos1);                 // B ainda parte da base antiga
  expect(slots(final).sort()).toEqual(['sab_diurno', 'sab_noturno']);
});
test('2b quatro líderes quase juntos: os quatro ficam gravados', async () => {
  const b = base(); const db = banco(b); const ids = ['sab_diurno', 'sab_noturno', 'dom_diurno', 'dom_noturno'];
  for (const id of ids) { const a = comChk(b, { alvo: ALVO, checkins: [checkin(id, 'L ' + id)] }); await save(db, 'P311B', b, a, { nivel: 'lider', pid: 'P311B' }); }
  expect(slots(db.data).sort()).toEqual(ids.sort());
});
test('3 o mesmo slot assinado por duas pessoas: não sobrescreve em silêncio', () => {
  const b = base(); const A = comChk(b, { alvo: ALVO, checkins: [checkin('sab_diurno', 'Líder 1')] });
  const B = comChk(b, { alvo: ALVO, checkins: [checkin('sab_diurno', 'Líder 2', { nota: 'outro texto' })] });
  const apos1 = merge(b, A, clone(b));
  expect(() => merge(b, B, apos1)).toThrow(/Outro usuário/);
  expect(apos1.checagemEquipe.checkins[0].lider).toBe('Líder 1');
});
test('4 dados legados sem id e slots check_1..3 do ciclo anterior', () => {
  const leg = { alvo: ALVO_ANT, checkins: [checkin('check_1', 'X'), checkin('check_2', 'Y'), checkin('check_3', 'Z')], concluidoEm: '2026-09-27T10:00:00.000Z' };
  const b = base(leg);
  const A = comChk(b, { alvo: ALVO, checkins: [checkin('sab_diurno', 'Líder 1')] });
  const B = comChk(b, { alvo: ALVO, checkins: [checkin('sab_noturno', 'Líder 2')] });
  const apos1 = merge(b, A, clone(b));
  expect(slots(merge(b, B, apos1)).sort()).toEqual(['sab_diurno', 'sab_noturno']);
});
test('4b legado no MESMO ciclo (check_1..3) continua contando', () => {
  const leg = { alvo: ALVO, checkins: [checkin('check_1', 'X'), checkin('check_2', 'Y')] };
  const b = base(leg); const a = comChk(b, { alvo: ALVO, checkins: [...leg.checkins, checkin('check_3', 'Z')] });
  expect(slots(merge(b, a, clone(b)))).toEqual(['check_1', 'check_2', 'check_3']);
});
test('5 mesmo conteúdo com chaves em ordem diferente não gera conflito', () => {
  const noApp = base({ alvo: ALVO, checkins: [checkin('sab_diurno', 'Líder 1')] });   // ordem do app
  const noBanco = ordenado(noApp);                                                      // ordem do Firestore
  const a = comChk(noApp, { alvo: ALVO, checkins: [...noApp.checagemEquipe.checkins, checkin('sab_noturno', 'Líder 2')] });
  expect(slots(merge(noApp, a, noBanco)).sort()).toEqual(['sab_diurno', 'sab_noturno']);
});
test('5b uma pessoa sozinha, documento parado, ciclo anterior gravado com chaves em outra ordem: primeira assinatura do novo ciclo', () => {
  // Caso do teste do Marcio com PIN gerencial no P601 (14:11): ninguém mais editando, 0/4, e mesmo assim dava conflito.
  const cicloAnt = { alvo: ALVO_ANT, checkins: [checkin('sab_diurno', 'X'), checkin('sab_noturno', 'Y'), checkin('dom_diurno', 'Z'), checkin('dom_noturno', 'W')], concluidoEm: '2026-09-27T20:00:00.000Z', proximoAlvo: ALVO };
  const naTela = base(cicloAnt);                 // o que o app carregou
  const noServidor = ordenado(naTela);           // o mesmo conteúdo, lido pelo servidor com as chaves em outra ordem
  const a = comChk(naTela, { alvo: ALVO, checkins: [checkin('sab_diurno', 'Matheus')] });
  expect(slots(merge(naTela, a, noServidor))).toEqual(['sab_diurno']);
  expect(merge(naTela, a, noServidor).checagemEquipe.alvo).toBe(ALVO);
});
test('6 troca de ciclo preserva colaboradores/históricos/uniformes e não perde o ciclo vigente', () => {
  const velho = base({ alvo: ALVO_ANT, checkins: [checkin('check_1', 'X')] });
  const novo = comChk(velho, { alvo: ALVO, checkins: [checkin('sab_diurno', 'Líder 1')] });
  const r = merge(velho, novo, clone(velho));
  expect(r.checagemEquipe.alvo).toBe(ALVO); expect(r.colaboradores).toEqual(velho.colaboradores);
  // tela velha (ciclo anterior) tentando gravar depois de o ciclo vigente já existir: não apaga o vigente
  const vigente = r; const telaVelha = comChk(velho, { alvo: ALVO_ANT, checkins: [checkin('check_1', 'X'), checkin('check_2', 'Y')] });
  expect(merge(velho, telaVelha, vigente).checagemEquipe.alvo).toBe(ALVO);
});
test('7 checagem concorrente com outras edições: FT, histórico, pedido de uniforme e aprovação preservados', () => {
  const b = base(); const outro = clone(b);                                 // alguém registra FT e o gerencial aprova
  outro.colaboradores[2].historico.push({ id: 'h2', tipo: 'FT' }); outro.colaboradores[0].uniforme.solicitacoes[0].aprovacao = 'negado';
  const a = comChk(b, { alvo: ALVO, checkins: [checkin('sab_diurno', 'Líder 1')] });
  const r = merge(b, a, outro);
  expect(r.colaboradores[2].historico).toHaveLength(1); expect(r.colaboradores[0].uniforme.solicitacoes[0].aprovacao).toBe('negado');
  expect(r.colaboradores[1].historico).toHaveLength(1); expect(slots(r)).toEqual(['sab_diurno']);
});
test('8 retry da mesma assinatura não duplica', () => {
  const b = base(); const a = comChk(b, { alvo: ALVO, checkins: [checkin('sab_diurno', 'Líder 1')] });
  const apos1 = merge(b, a, clone(b)); const apos2 = merge(b, a, apos1);
  expect(slots(apos2)).toEqual(['sab_diurno']);
});
test('9 conclusão registrada pelo cliente é preservada e a contagem vem dos slots reais', () => {
  const b = base(); const ids = ['sab_diurno', 'sab_noturno', 'dom_diurno', 'dom_noturno'];
  let atual = clone(b);
  ids.forEach((id, i) => { const lista = ids.slice(0, i + 1).map(x => checkin(x, 'L')); const chk = { alvo: ALVO, checkins: lista };
    if (lista.length >= 4) { chk.concluidoEm = '2026-10-04T20:00:00.000Z'; chk.proximoAlvo = '2026-10-10'; }
    atual = merge(atual, comChk(atual, chk), atual); });
  expect(atual.checagemEquipe.checkins).toHaveLength(4); expect(atual.checagemEquipe.concluidoEm).toBeTruthy();
});

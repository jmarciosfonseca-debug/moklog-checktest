import { resumirTreinamentos, rotuloTreinamentos, calcularMapaEquipe } from './maturidade';
const curso = (data = '2026-05-01') => ({ tipo: 'Treinamento', detalhe: 'Brigada / estande de tiro', data });
const pessoa = (id, historico = []) => ({ id, nome: id, status: 'ativo', cargo: 'porteiro', dataContratacao: '2020-01-01', historico });
test('um treinado entre dois aparece como 50% sem catálogo', () => {
 const m = calcularMapaEquipe({ colaboradores: [pessoa('a', [curso()]), pessoa('b')] }, '2026-10-08');
 expect(m.treinamentos).toMatchObject({ comRegistro: 1, comRegistro12m: 1, percentual12m: 50, total: 2 });
 expect(rotuloTreinamentos(m.treinamentos)).toContain('1/2 pessoas (50%)');
 expect(m.eixos.treinamento).toBeNull(); // cobertura não inventa conclusão de obrigatórios
});
test('vários cursos da mesma pessoa não multiplicam a cobertura', () => {
 expect(resumirTreinamentos([pessoa('a', [curso(), curso()]), pessoa('b')], '2026-10-08').percentual12m).toBe(50);
});
test('sem nenhum registro fica não aferido', () => {
 expect(rotuloTreinamentos(resumirTreinamentos([pessoa('a')], '2026-10-08'))).toContain('Não aferido');
});
test('histórico antigo ou sem data é destacado sem inflar últimos12m', () => {
 const r = resumirTreinamentos([pessoa('a', [curso('2020-01-01')]), pessoa('b', [curso('')])], '2026-10-08');
 expect(r).toMatchObject({ comRegistro: 2, comRegistro12m: 0, percentual12m: 0 });
 expect(rotuloTreinamentos(r)).toContain('2 com histórico');
});
test('exclui registros futuros e texto vazio; inclui borda12m', () => {
 const r = resumirTreinamentos([pessoa('a', [curso('2027-01-01'), {tipo:'Treinamento', detalhe:' '}]), pessoa('b', [curso('2025-10-08')])], '2026-10-08');
 expect(r).toMatchObject({ comRegistro: 1, comRegistro12m: 1 });
});
test('somente ativos entram no denominador', () => {
 const m = calcularMapaEquipe({ colaboradores: [pessoa('a',[curso()]), {...pessoa('b'), status:'desligado'}] }, '2026-10-08');
 expect(m.treinamentos.percentual12m).toBe(100);
});

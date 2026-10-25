import { badgeMoked, ESTADOS_MOKED, temaMoked } from './temaMoked';
import { aplicarTema, temaSalvo, proximoTema } from './temaClaro';

const luminance = hex => {
  const rgb = hex.slice(1).match(/../g).map(v => parseInt(v,16)/255)
    .map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4);
  return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
};
const contrast = (a,b) => {
  const values = [luminance(a),luminance(b)].sort((x,y)=>y-x);
  return (values[0]+.05)/(values[1]+.05);
};

test('textos e estados mantêm contraste de pelo menos 4,5:1 nos dois modos', () => {
  Object.keys(ESTADOS_MOKED).forEach(state => {
    const b = badgeMoked(state);
    expect(contrast(b.background,b.color === '#fff' ? '#FFFFFF' : b.color)).toBeGreaterThanOrEqual(4.5);
  });
  [true,false].forEach(dark => {
    const t = temaMoked(dark);
    expect(contrast(t.card,t.cardTxt)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t.card,t.cardSub)).toBeGreaterThanOrEqual(4.5);
  });
});

test('trocar Lua, Nuvem e Sol mantém preferência e remove o ajuste claro ao voltar', () => {
  ['nuvem','sol','lua'].forEach(tema => {
    aplicarTema(tema);
    expect(temaSalvo()).toBe(tema);
    expect(document.documentElement.dataset.mokedTema).toBe(tema);
    expect(Boolean(document.getElementById('mk-tema-claro'))).toBe(tema !== 'lua');
  });
  expect(proximoTema('lua')).toBe('nuvem');
});

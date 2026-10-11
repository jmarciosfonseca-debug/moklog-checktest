// Vínculo de colaborador a equipes de líder (Equipe → Montagem). Puro.
// `equipeLiderId` = líder principal (campo antigo, continua valendo); `equipeLideresExtra` = outros líderes
// quando o colaborador é DUPLICADO. Ex.: a recepcionista trabalha 5x2 e as equipes são 12x36, então ela
// precisa estar na equipe dos dois líderes ao mesmo tempo.

export const lideresDe = (c) => {
  const extra = Array.isArray(c && c.equipeLideresExtra) ? c.equipeLideresExtra : [];
  return [c && c.equipeLiderId, ...extra].filter((x, i, a) => x && a.indexOf(x) === i);
};
export const pertenceA = (c, liderId) => !!liderId && lideresDe(c).includes(liderId);
export const semEquipeAlguma = (c) => lideresDe(c).length === 0;

const montar = (c, lista) => {
  const [principal = null, ...extra] = lista;
  const { equipeLideresExtra, ...resto } = c;
  return { ...resto, equipeLiderId: principal, ...(extra.length ? { equipeLideresExtra: extra } : {}) };
};

// Toque no membro: se já está nesta equipe, sai SÓ desta (continua nas outras).
// Se está em outra equipe: `duplicar` mantém nas outras e entra nesta; sem `duplicar` MOVE para esta.
export function alternarVinculo(c, liderId, { duplicar = false } = {}) {
  const atuais = lideresDe(c);
  if (atuais.includes(liderId)) return montar(c, atuais.filter((x) => x !== liderId));
  return montar(c, duplicar ? [...atuais, liderId] : [liderId]);
}

// Desfazer a equipe de um líder: remove só o vínculo com ele.
export const removerVinculo = (c, liderId) => (pertenceA(c, liderId) ? montar(c, lideresDe(c).filter((x) => x !== liderId)) : c);

// Cargos que normalmente trabalham fora da escala 12x36 das equipes (a recepção é 5x2): o toque já duplica.
export const cargoCompartilhado = (cargo) => /recep/i.test(String(cargo || ""));

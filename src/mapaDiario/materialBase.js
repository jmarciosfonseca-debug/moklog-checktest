// Base de material por projeto, levantada pelo Codex nos mapas do WhatsApp (09–11/10/2026).
// É a LISTA DE REFERÊNCIA para o líder conferir no mapa: o que cada projeto declara de fato
// (ex.: bodycam só no P311A; P505 sem armamento). Quantidade null = o mapa não informou o número.
// Quando o cadastro de Equipamentos do projeto tem itens de uma categoria, o cadastro (com
// identificação/nº de série) substitui a linha genérica desta base naquela categoria.
// Item: [categoria, nome, quantidade|null, detalhe]. Turno: base.D / base.N ou base.todos.
const REV38 = ["armamento", "Revólver .38"];
const PLACAS = ["placas", "Par de placas balísticas"];

export const MATERIAL_BASE = {
  P601: { todos: [[...REV38, null], [...PLACAS, null]] },
  P602: { todos: [[...REV38, null], [...PLACAS, null]] },
  P604: {
    D: [[...REV38, 3], [...PLACAS, null], ["municao", "Munição", null], ["radiosHT", "Rádio", null], ["smartphones", "Smartphone", null], ["outros", "Tablet", null], ["outros", "Documentação", null]],
    N: [[...REV38, 3], [...PLACAS, null]],
  },
  P605: { todos: [[...REV38, 2], [...PLACAS, 2]] },
  P606: { todos: [[...REV38, 2], ["municao", "Munição .38", 24, "24 munições"], [...PLACAS, 2]] },
  P607: { todos: [[...REV38, 2], [...PLACAS, 2]] },
  P311A: {
    D: [[...REV38, 4], [...PLACAS, 4], ["bodycam", "Bodycam", 4], ["radiosHT", "Rádio HT", 5], ["municao", "Munição .38", 72, "72 munições"]],
    N: [[...REV38, 3], [...PLACAS, 3], ["bodycam", "Bodycam", 3], ["radiosHT", "Rádio HT", 4], ["municao", "Munição .38", 72, "72 munições"]],
  },
  P311B: { todos: [[...REV38, 2], [...PLACAS, 4], ["municao", "Munição .38", 36, "36 munições"]] },
  P505: { todos: [["outros", "Carga dos equipamentos", null], ["lanternas", "Lanterna", null], ["outros", "Documentação", null], ["radiosHT", "Rádio HT", null], ["smartphones", "Smartphone", null]] },
  P260A: { todos: [["armamento", "Pistola .380", 3], ["municao", "Munição .380", 90, "90 munições"], [...PLACAS, 4]] },
  P260B: { todos: [["armamento", "Pistola .380", 1], ["armamento", "Carregador", 2], ["municao", "Munição .380", 30, "30 munições"], [...PLACAS, 2]] },
  P260C: { todos: [["outros", "Algemas", null], ["armamento", "Pistola .380", null], ["armamento", "Revólver .38", null], ["armamento", "Carregador", null], ["municao", "Munição", null], ["outros", "Jet loader", null], [...PLACAS, null]] },
};

// Itens da base para o projeto/turno, já expandidos (uma linha por unidade quando a quantidade é conhecida).
export function itensDaBase(projetoId, turno, rotulos) {
  const b = MATERIAL_BASE[projetoId];
  if (!b) return [];
  const lista = (turno && b[turno]) || b.todos || b.D || [];
  const out = [];
  lista.forEach(([cat, nome, qtd, det], idx) => {
    const unidades = qtd && qtd > 1 && cat !== "municao" ? qtd : 1;
    for (let u = 1; u <= unidades; u++) {
      out.push({
        id: `base:${cat}:${idx}:${u}`, categoria: cat, rotuloCategoria: rotulos[cat] || "Outros",
        nome: unidades > 1 ? `${nome} ${u} de ${unidades}` : nome,
        detalhe: det || (unidades === 1 && qtd > 1 ? `${qtd} un.` : ""), cadastro: "ok", origem: "base",
      });
    }
  });
  return out;
}

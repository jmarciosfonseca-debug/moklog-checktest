import { mergeRespostasPorAtualizacao } from "./diagnosticoSync";
test("aparelho B abre diagnóstico 100% sem regredir",()=>{
  const celular={D01:{status:"c",updatedAt:"2026-09-23T10:00:00Z"},D02:{status:"c",updatedAt:"2026-09-23T10:01:00Z"}};
  expect(Object.keys(mergeRespostasPorAtualizacao(celular,{}))).toHaveLength(2);
});
test("preserva itens e usa a atualização mais recente no conflito",()=>{
  const remoto={D01:{status:"c",updatedAt:"2026-09-23T10:00:00Z"},D02:{status:"p",updatedAt:"2026-09-23T10:05:00Z"}};
  const local={D03:{status:"c",updatedAt:"2026-09-23T10:06:00Z"},D02:{status:"nc",updatedAt:"2026-09-23T10:07:00Z"}};
  expect(mergeRespostasPorAtualizacao(remoto,local)).toEqual({D01:remoto.D01,D02:local.D02,D03:local.D03});
});

import {tratarErroGravacao,gravarComRecuperacao,MSG_CONFLITO,MSG_CONFLITO_SEM_ATUALIZAR} from "./equipeConflito";
import {janelaChecagemAberta} from "./janelaChecagem";
import fs from "fs";
test("409: recarrega e confirma SÓ quando a tela foi realmente atualizada",async()=>{
  const recarregar=jest.fn(async()=>true);
  const msg=await tratarErroGravacao(Object.assign(Error("x"),{status:409}),recarregar);
  expect(recarregar).toHaveBeenCalledTimes(1);expect(msg).toBe(MSG_CONFLITO);
});
test("409 com falha na releitura (sem rede) NÃO afirma que atualizou",async()=>{
  const msg=await tratarErroGravacao({status:409},async()=>{throw Error("offline");});
  expect(msg).toBe(MSG_CONFLITO_SEM_ATUALIZAR);expect(msg).not.toContain("Atualizei a tela");expect(msg).toMatch(/reabra a Equipe/);
});
test("409 com documento inexistente (recarregar devolve false) NÃO afirma que atualizou",async()=>{
  expect(await tratarErroGravacao({status:409},async()=>false)).toBe(MSG_CONFLITO_SEM_ATUALIZAR);
  expect(await tratarErroGravacao({status:409},async()=>undefined)).toBe(MSG_CONFLITO_SEM_ATUALIZAR);
});
test("outros erros não recarregam nada e mantêm a mensagem do servidor",async()=>{
  const recarregar=jest.fn();
  expect(await tratarErroGravacao(Object.assign(Error("Sessão ausente ou expirada."),{status:401}),recarregar)).toBe("Sessão ausente ou expirada.");
  expect(await tratarErroGravacao(new Error(""),recarregar)).toBe("Não foi possível salvar.");
  expect(await tratarErroGravacao(null,recarregar)).toBe("Não foi possível salvar.");
  expect(recarregar).not.toHaveBeenCalled();
});
test("gravarComRecuperacao: sucesso passa direto; 409 recarrega e relança com a mensagem; outros erros não recarregam",async()=>{
  const recarregar=jest.fn(async()=>true);
  expect(await gravarComRecuperacao(async()=>({ok:1}),recarregar)).toEqual({ok:1});expect(recarregar).not.toHaveBeenCalled();
  const e409=Object.assign(Error("Outro usuário alterou..."),{status:409});
  await expect(gravarComRecuperacao(async()=>{throw e409;},recarregar)).rejects.toMatchObject({status:409,message:MSG_CONFLITO});
  expect(recarregar).toHaveBeenCalledTimes(1);
  const e503=Object.assign(Error("Servidor indisponível"),{status:503});
  await expect(gravarComRecuperacao(async()=>{throw e503;},recarregar)).rejects.toMatchObject({status:503,message:"Servidor indisponível"});
  expect(recarregar).toHaveBeenCalledTimes(1);
});
test("janela da checagem: só sábado e domingo",()=>{
  expect(janelaChecagemAberta(new Date(2026,9,3,10))).toBe(true);
  expect(janelaChecagemAberta(new Date(2026,9,4,22))).toBe(true);
  [5,6,7,8,9].forEach(d=>expect(janelaChecagemAberta(new Date(2026,9,d,12))).toBe(false));
});
test("a Equipe não cria mais relógios em segundo plano e usa os módulos novos",()=>{
  const src=fs.readFileSync("src/Equipe.jsx","utf8");
  expect(src).not.toMatch(/setInterval/);
  expect(src).toContain("gravarComRecuperacao");expect(src).toContain("janelaChecagemAberta");
  expect(src.match(/saveEquipe\(/g).length).toBe(2);                    // definição + a única chamada, dentro de gravar()
  expect(src).toMatch(/Object\.assign\(Error\(result\.erro\|\|"Não foi possível salvar\."\),\{status:response\.status\}\)/);
});

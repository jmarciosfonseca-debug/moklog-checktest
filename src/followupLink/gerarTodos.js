// Gera, de uma vez, os links de follow-up que faltam (manutenção e administração) nos projetos liberados.
// Os itens vêm das pendências do último teste de cada projeto; o nome da empresa fica genérico (o servidor preenche).
import { PROJETOS_LIBERADOS } from "./config";
import { gerencial } from "./api";
import { itensEmAberto } from "./GestaoLinks";

export async function gerarLinksFaltantes({ pendencias, nomeDe, dias = 15, chamar = gerencial }) {
  let criados = 0;
  const projetos = [];
  for (const pid of PROJETOS_LIBERADOS) {
    const { links } = await chamar("listar", { pid });
    const itens = itensEmAberto(pendencias.filter((p) => p.project.id === pid));
    let novo = false;
    for (const papel of ["manutencao", "administracao"]) {
      if ((links || []).some((l) => l.papel === papel)) continue;
      await chamar("criar", { pid, papel, empresa: "", projetoNome: nomeDe(pid), dias, itens });
      criados += 1; novo = true;
    }
    if (novo) projetos.push(pid);
  }
  return { criados, projetos };
}

// Mantém a lista de itens dos links ativos igual ao último teste de cada projeto.
export async function sincronizarTodos({ pendencias, chamar = gerencial }) {
  for (const pid of PROJETOS_LIBERADOS) {
    await chamar("sincronizar", { pid, itens: itensEmAberto(pendencias.filter((p) => p.project.id === pid)) });
  }
}

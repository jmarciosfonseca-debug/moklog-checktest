// Garante que o laudo semanal saia com um link/QR de follow-up FUNCIONAL do próprio projeto:
// cria o link de manutenção se não existir, renova se estiver vencido ou perto de vencer e,
// ao criar, já carrega os itens em aberto do laudo. Devolve { link } ou { motivo } (nunca falha em silêncio).
import { linkLiberado } from "./config";
import { canonicalFollowupKey } from "../followups";

export const VALIDADE_DIAS = 60;       // máximo permitido no servidor: o QR vai impresso/enviado em PDF
export const RENOVAR_ANTES_DIAS = 14;  // renova quando faltarem menos dias que isso

// Itens em aberto do laudo, no formato dos links (mesma chave do follow-up e mesmo recorte do PDF).
export function itensDoLaudoParaLink(project, itens) {
  return (itens || []).filter((x) => x.status !== "ok" && !x.agregado).map((x) => {
    const item = x.unico ? "—" : (x.item || "—");
    return {
      key: canonicalFollowupKey(project.id, x.cat, item),
      cat: x.cat, item, status: x.status === "partial" ? "partial" : "inop", since: x.since || "", note: x.note || "",
    };
  });
}

export async function garantirLinkManutencao({ project, itens, nomeProjeto, gerencialAtivo, chamar, dataTeste = "", agora = Date.now() }) {
  if (!linkLiberado(project.id)) return { motivo: "Projeto fora da lista de follow-up externo." };
  if (!gerencialAtivo) return { motivo: "Sem sessão gerencial: o QR do follow-up só é incluído com o login gerencial." };
  const lista = (await chamar("listar", { pid: project.id })).links || [];
  const dosItens = itensDoLaudoParaLink(project, itens);
  const garantir = async (papel) => {
    const atual = lista.find((l) => l.papel === papel);
    if (!atual) {
      const criado = await chamar("criar", { pid: project.id, papel, empresa: "", projetoNome: nomeProjeto, dias: VALIDADE_DIAS, itens: dosItens });
      return { link: criado.link || criado, novo: true };
    }
    const restam = (Date.parse(atual.expiraEm) - agora) / 86400000;
    if (!(restam > RENOVAR_ANTES_DIAS)) {
      await chamar("renovar", { pid: project.id, id: atual.id, dias: VALIDADE_DIAS });
      return { link: { ...atual, expiraEm: new Date(agora + VALIDADE_DIAS * 86400000).toISOString() }, renovado: true };
    }
    return { link: atual };
  };
  const manut = await garantir("manutencao");
  const adm = await garantir("administracao"); // o fluxo precisa do par: manutenção → Moked → administração
  // Links já existentes passam a refletir este teste, desde que ele não seja mais antigo que a última atualização
  // (reimprimir um laudo antigo não pode desfazer a lista atual).
  const antigos = [manut, adm].filter((x) => !x.novo && x.link && x.link.itensEm);
  const atualizar = antigos.length && /^\d{4}-\d{2}-\d{2}/.test(dataTeste) && antigos.every((x) => dataTeste >= String(x.link.itensEm).slice(0, 10));
  if (atualizar) await chamar("sincronizar", { pid: project.id, itens: dosItens });
  if (!manut.link || !manut.link.token) return { motivo: "O servidor não devolveu o link de manutenção." };
  return { link: manut.link, novo: !!manut.novo, renovado: !!manut.renovado };
}

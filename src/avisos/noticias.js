// Notícias de FORA para a central de avisos: lê o Entorno (coleta diária no servidor) e entrega no formato do contrato.
// Nunca devolve "lista vazia" quando a leitura falhou: devolve { erro } para a tela dizer que não conseguiu ler.
import { lerEntorno } from "../entorno/lerEntorno";
import { noticiaExterna } from "./contrato";

const DIA = 86400000;
let ultima = null; // último resultado bom deste aparelho (a tela mostra com o horário se a leitura seguinte falhar)

export function noticiasDoEntorno(resp, { projetos = null, dias = 14, agora = new Date() } = {}) {
  const limite = agora.getTime() - dias * DIA;
  const ok = (p) => !projetos || projetos.includes(p);
  const docs = (resp && resp.docs) || {};
  const out = [];
  for (const [pid, d] of Object.entries(docs)) {
    if (!ok(pid)) continue;
    for (const it of (d && d.itens) || []) {
      const t = it && it.data ? new Date(it.data).getTime() : NaN;
      if (Number.isFinite(t) && t < limite) continue;
      const n = noticiaExterna(it, pid);
      if (n) out.push(n);
    }
  }
  for (const it of (resp && resp.geral && resp.geral.itens) || []) {
    const t = it && it.data ? new Date(it.data).getTime() : NaN;
    if (Number.isFinite(t) && t < limite) continue;
    const n = noticiaExterna(it, "TODOS");
    if (n) out.push(n);
  }
  return out;
}

// { noticias, erro, deMemoria, lidoEm }. Falhou mas há leitura anterior: devolve a anterior marcada como "deMemoria".
export async function carregarNoticias({ projetos = null, ler = lerEntorno, agora = new Date() } = {}) {
  let resp;
  try { resp = await ler(); } catch { resp = { erro: "Sem conexão com o servidor." }; }
  if (!resp || resp.erro) {
    if (ultima) return { noticias: ultima.noticias, erro: resp && resp.erro ? resp.erro : "Falha ao ler.", deMemoria: true, lidoEm: ultima.lidoEm };
    return { noticias: [], erro: (resp && resp.erro) || "Falha ao ler.", deMemoria: false, lidoEm: null };
  }
  const noticias = noticiasDoEntorno(resp, { projetos, agora });
  ultima = { noticias, lidoEm: agora };
  return { noticias, erro: "", deMemoria: false, lidoEm: agora };
}
export const _limparMemoriaNoticias = () => { ultima = null; };

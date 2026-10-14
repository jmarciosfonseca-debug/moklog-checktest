// Análise de Risco do Single: cruza a vistoria do Single + o Diagnóstico (se concluído) com o mesmo motor dos projetos fixos.
// Regras confirmadas pelo Marcio (13/10/2026):
//   1) o perfil de barreiras sai dos itens cadastrados no Single (não de uma tabela por projeto);
//   2) território é só contexto — Single não tem diagnóstico regional e nada disso altera a classe;
//   3) Diagnóstico CONCLUÍDO → Modelo 2 (só sobe o nível); sem ele → Modelo 1.
import { singleComoProjeto } from "./singleAdaptador";
import { classificar } from "./catalogoV2";
import { coletarTesteSemanal, montarAnalise, montarDadoDiagnostico, gerarHTMLAnaliseRisco } from "../AnaliseRisco";
export { fontesDoSingle } from "./singleFontes";

// Id do catálogo v2 do item (itens personalizados são reconhecidos pelo nome).
const idDoItem = (a) => (a.familiaId && !a.custom ? a.familiaId : classificar(a.nome || "", "") );

// Perfil de barreiras montado SÓ com o que o cliente tem (total > 0 no cenário da vistoria).
export function perfilDoSingle(itens = []) {
  const ids = new Set(itens.filter((a) => (Number(a.total) || 0) > 0).map(idDoItem));
  const vias = [];
  if (ids.has("vei_bollards")) vias.push("bollard", "bolard");
  if (ids.has("vei_pinos")) vias.push("pino");
  if (ids.has("vei_dilaceradores")) vias.push("dilacerador");
  const cancelaAS = ids.has("vei_cancelas_as");
  const cancelaTransponivel = !cancelaAS && ids.has("vei_cancelas");
  const naoAferido = !vias.length && !cancelaAS;
  return { nome: "Single — perfil dos itens cadastrados", vias, cancelaAS, cancelaTransponivel, naoAferido, singleItens: true };
}

// Código curto do documento: código do cadastro; senão o nome do cliente (ex.: PXXX123); senão "SG" + final do id.
export function codigoDoSingle(single = {}) {
  const limpo = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return limpo(single.codigo).slice(0, 12) || limpo(single.nome).slice(0, 12) || "SG" + limpo(single.id).slice(-4);
}

// Monta a análise (objeto) e o HTML. `usarDiagnostico=false` força o Modelo 1.
export async function gerarAnaliseSingle({ single, inspecao, diagnosticos = [], usarDiagnostico = true }) {
  if (!inspecao || inspecao.estado !== "concluida") throw new Error("Conclua uma vistoria do Single antes de gerar a Análise de Risco.");
  const pid = codigoDoSingle(single);
  const base = singleComoProjeto(single, inspecao);
  const project = { id: pid, name: single.nome, categories: base.project.categories, perfilBarreiras: perfilDoSingle(inspecao.itens || []), single: true };
  const stored = { [pid]: base.stored[single.id] };
  const ts = coletarTesteSemanal(project, stored);
  const dados = { ts, regional: { ok: false, temDado: false, motivo: "Single: sem diagnóstico regional — território fica só como contexto" }, followups: {} };
  if (usarDiagnostico) {
    const diag = await montarDadoDiagnostico(diagnosticos, { projetoRef: single.id, nomeProjeto: single.nome });
    if (diag.ok) dados.diag = diag;
  }
  const analise = montarAnalise(project, "Single", dados, {});
  analise.ref = `MK-${pid}-AR-0001`;
  analise.single = { id: single.id, vistoriaId: inspecao.id, vistoriaData: inspecao.data, modelo: dados.diag?.ok ? 2 : 1 };
  return { analise, html: gerarHTMLAnaliseRisco(analise, null, null), modelo: analise.single.modelo };
}

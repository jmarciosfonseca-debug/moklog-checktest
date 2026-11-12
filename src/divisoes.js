// Divisões da plataforma Moked (Marcio, 11/11/2026): MokLog (condomínios logísticos), MokPat (patrimonial — Residencial e
// Comercial) e MokImp (implantação). CommonJS de propósito: lido pelo app (React) e pelo servidor (api/).
// Regra de separação: o PIN do gestor de uma divisão só abre os projetos dela; o PIN de líder segue sendo por projeto.
// O PIN gerencial Moked (admin) é global.
const { categoriasDoInventario } = require("./inventarioDivisoes");
const lista = (residencial, comercial) => [...residencial.map((id) => [id, "residencial"]), ...comercial.map((id) => [id, "comercial"])].sort((a, b) => a[0].localeCompare(b[0]));
const MOKPAT = lista(["P032", "P035", "P160", "P256", "P380", "P560", "P925", "P936", "P939", "P946", "P947", "P955", "P956"], ["P740", "P770", "P777", "P868"]);
// MokImp (lista do Marcio, 11/11/2026). Atenção: estes 15 são do MokImp, não do MokPat.
const MOKIMP = lista(["P931", "P932", "P942", "P944", "P950", "P951", "P952", "P953", "P954", "P957", "P958", "P959", "P961"], ["P703", "P760", "P761", "P763"]);
const SEGMENTOS = {
  residencial: { key: "residencial", label: "Projetos Residencial", nome: "Residencial", cor: "#c9a48a" },
  comercial: { key: "comercial", label: "Projetos Comercial", nome: "Comercial", cor: "#38bdf8" },
};
const DIVISOES = {
  mokpat: { id: "mokpat", nome: "MokPat", sub: "Patrimonial · Residencial e Comercial", lista: MOKPAT, segmentos: ["residencial", "comercial"] },
  mokimp: { id: "mokimp", nome: "MokImp", sub: "Implantação · Residencial e Comercial", lista: MOKIMP, segmentos: ["residencial", "comercial"] },
};
const MOKPAT_IDS = MOKPAT.map(([id]) => id);
const DIVISAO_IDS = Object.fromEntries(Object.values(DIVISOES).map((d) => [d.id, d.lista.map(([id]) => id)]));
const idsDoSegmento = (seg, div) => Object.values(DIVISOES).filter((d) => !div || d.id === div).flatMap((d) => d.lista.filter(([, s]) => (s || d.segmentos[0]) === seg).map(([id]) => id));
// Projeto de divisão nova nasce sem checklist; ganha o Teste Semanal quando o inventário dele entra em inventarioDivisoes.js.
const projetosDaDivisaoNova = (div) => Object.fromEntries((DIVISOES[div]?.lista || []).map(([id, s]) => { const seg = s || DIVISOES[div].segmentos[0]; return [id, { id, name: SEGMENTOS[seg].nome, short: `${SEGMENTOS[seg].nome} ${id}`, div, seg, categories: categoriasDoInventario(id) }]; }));
const projetosMokpat = () => projetosDaDivisaoNova("mokpat");
const projetosNovasDivisoes = () => Object.assign({}, ...Object.keys(DIVISOES).map(projetosDaDivisaoNova));
// Funções do cadastro de colaborador nas divisões novas (Marcio, 11/11/2026). "VSPP Líder" é o mesmo nome do MokLog de
// propósito: é ele que identifica o líder no mapa de equipe e nas regras de liderança. Faltou alguma? É só acrescentar aqui.
const CARGOS_MOKPAT = ["VSPP Líder", "VSPP Apoio", "Vigilante de Monitoramento", "Vigilante", "Controlador de Acesso", "Recepcionista", "Porteiro", "Mensageiro", "Ascensorista"];
const divisaoDoProjeto = (pid) => Object.keys(DIVISAO_IDS).find((d) => DIVISAO_IDS[d].includes(pid)) || "moklog";
const ehDivisao = (d) => d === "moklog" || !!DIVISOES[d];
const faixa = (ids) => (ids.length > 2 ? `${ids[0]} — ${ids[ids.length - 1]}` : ids.join(", "));

module.exports = { CARGOS_MOKPAT, MOKPAT, MOKPAT_IDS, MOKIMP, SEGMENTOS, DIVISOES, DIVISAO_IDS, idsDoSegmento, projetosMokpat, projetosNovasDivisoes, divisaoDoProjeto, ehDivisao, faixa };

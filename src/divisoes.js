// Divisões da plataforma Moked (Marcio, 11/11/2026): MokLog (condomínios logísticos) e MokPat (patrimonial),
// esta dividida em Residencial e Comercial. CommonJS de propósito: lido pelo app (React) e pelo servidor (api/).
// Regra de separação: o PIN do gestor MokPat só abre projetos MokPat; o PIN de líder segue sendo por projeto.
// O PIN gerencial Moked (admin) é global.
const MOKPAT = [
  ["P032", "residencial"], ["P035", "residencial"], ["P160", "residencial"], ["P256", "residencial"], ["P380", "residencial"], ["P560", "residencial"],
  ["P740", "comercial"], ["P770", "comercial"], ["P777", "comercial"], ["P868", "comercial"],
  ["P925", "residencial"], ["P936", "residencial"], ["P939", "residencial"], ["P946", "residencial"], ["P947", "residencial"], ["P955", "residencial"], ["P956", "residencial"],
];
const SEGMENTOS = {
  residencial: { key: "residencial", label: "Projetos Residencial", nome: "Residencial", cor: "#c9a48a" },
  comercial: { key: "comercial", label: "Projetos Comercial", nome: "Comercial", cor: "#38bdf8" },
};
const MOKPAT_IDS = MOKPAT.map(([id]) => id);
const idsDoSegmento = (seg) => MOKPAT.filter(([, s]) => s === seg).map(([id]) => id);
// Projeto MokPat nasce sem checklist: o inventário de equipamentos é cadastrado pelo líder (etapa seguinte).
const projetosMokpat = () => Object.fromEntries(MOKPAT.map(([id, seg]) => [id, { id, name: SEGMENTOS[seg].nome, short: `${SEGMENTOS[seg].nome} ${id}`, div: "mokpat", seg, categories: [] }]));
const DIVISAO_IDS = { mokpat: MOKPAT_IDS };
// Funções do cadastro de colaborador no MokPat (Marcio, 11/11/2026). "VSPP Líder" é o mesmo nome do MokLog de propósito:
// é ele que identifica o líder no mapa de equipe e nas regras de liderança. Faltou alguma? É só acrescentar aqui.
const CARGOS_MOKPAT = ["VSPP Líder", "VSPP Apoio", "Vigilante de Monitoramento", "Vigilante", "Controlador de Acesso", "Recepcionista", "Porteiro", "Mensageiro"];
const divisaoDoProjeto = (pid) => (MOKPAT_IDS.includes(pid) ? "mokpat" : "moklog");
const faixa = (ids) => (ids.length > 2 ? `${ids[0]} — ${ids[ids.length - 1]}` : ids.join(", "));

module.exports = { CARGOS_MOKPAT, MOKPAT, MOKPAT_IDS, SEGMENTOS, DIVISAO_IDS, idsDoSegmento, projetosMokpat, divisaoDoProjeto, faixa };

// Entorno (Marcio, 27/10 e 02/11/2026): notícias de segurança e de mercado logístico no entorno de cada parque.
// Cada projeto tem a SUA busca (cidade, bairro, termos de interesse) — o cliente só vê o que é do parque dele.
// CommonJS de propósito: lido pelo app (React) e pelo coletor na Vercel (api/entorno-coletar.js).
const LOCAIS = {
  P601:  { nome: "Golgi Cajamar",         grupo: "golgi",   cidade: "Cajamar",         uf: "SP", vizinhas: ["Franco da Rocha", "Jordanésia", "Rodoanel"], interesse: ["Anhanguera", "Rodoanel"] },
  P602:  { nome: "Golgi Mauá",            grupo: "golgi",   cidade: "Mauá",            uf: "SP", vizinhas: ["Santo André", "Ribeirão Pires"], interesse: ["ABC Paulista"] },
  P604:  { nome: "Golgi Jundiaí",         grupo: "golgi",   cidade: "Jundiaí",         uf: "SP", vizinhas: ["Várzea Paulista", "Campo Limpo Paulista"], interesse: ["Anhanguera", "Bandeirantes"] },
  P605:  { nome: "Golgi Dutra",           grupo: "golgi",   cidade: "Arujá",           uf: "SP", vizinhas: ["Guarulhos", "Itaquaquecetuba", "Santa Isabel"], interesse: ["Dutra"] },
  P606:  { nome: "Golgi Duque de Caxias", grupo: "golgi",   cidade: "Duque de Caxias", uf: "RJ", vizinhas: ["Baixada Fluminense", "Washington Luiz"], interesse: ["Washington Luiz", "Arco Metropolitano"] },
  P607:  { nome: "Golgi Brasília",        grupo: "golgi",   cidade: "Santa Maria",     uf: "DF", vizinhas: ["Gama", "Valparaíso de Goiás", "Novo Gama"], interesse: ["BR-040", "Brasília"] },
  P311A: { nome: "Mega Curitiba",         grupo: "mega",    cidade: "Quatro Barras",   uf: "PR", vizinhas: ["Curitiba", "Colombo", "Campina Grande do Sul", "Pinhais"], interesse: ["BR-116", "Régis Bittencourt"] },
  P311B: { nome: "Mega Itajaí",           grupo: "mega",    cidade: "Itajaí",          uf: "SC", vizinhas: ["Navegantes", "Balneário Camboriú", "Brusque"], interesse: ["Porto de Itajaí", "BR-101"] },
  P505:  { nome: "Klog Guarulhos",        grupo: "klog",    cidade: "Guarulhos",       uf: "SP", vizinhas: ["Cumbica", "Bonsucesso", "Pimentas"], interesse: ["Dutra", "Aeroporto de Guarulhos", "Cumbica"] },
  // Jatinox: cidade a confirmar com o Marcio — enquanto vazia, o coletor pula o projeto (sem inventar entorno).
  P260A: { nome: "Jatinox Unidade A",     grupo: "jatinox", cidade: "",                uf: "SP", vizinhas: [], interesse: [] },
  P260B: { nome: "Jatinox Unidade B",     grupo: "jatinox", cidade: "",                uf: "SP", vizinhas: [], interesse: [] },
  P260C: { nome: "Jatinox Unidade C",     grupo: "jatinox", cidade: "",                uf: "SP", vizinhas: [], interesse: [] },
};

// Temas. "seguranca" = o que afeta o risco do parque; "mercado" = movimento do setor logístico que interessa ao cliente.
const TEMAS = {
  seguranca: {
    rotulo: "Segurança no entorno",
    termos: ["roubo", "furto", "assalto", "homicídio", "latrocínio", "tiroteio", "arrastão", "invasão", "arrombamento", "tráfico", "roubo de carga", "sequestro", "quadrilha", "receptação", "operação policial"],
    // Tipos que o classificador pode devolver (os 9 do Monitor OSINT + roubo de carga e operação policial).
    tipos: ["latrocinio", "homicidio", "tiroteio", "arrastao", "invasao", "arrombamento", "roubo", "furto", "trafico", "roubo_carga", "operacao_policial", "outro"],
  },
  mercado: {
    rotulo: "Mercado logístico",
    termos: ["condomínio logístico", "centro logístico", "galpão logístico", "centro de distribuição", "Mercado Livre", "Amazon", "Shopee", "Black Friday", "e-commerce", "expansão", "investimento", "inauguração", "Golgi", "Klog", "Mega Centro Logístico", "porto", "aeroporto de cargas"],
    tipos: ["expansao", "novo_ocupante", "sazonalidade", "infraestrutura", "setor", "outro"],
  },
};

const TIPO_ROTULO = {
  latrocinio: "Latrocínio", homicidio: "Homicídio", tiroteio: "Tiroteio", arrastao: "Arrastão", invasao: "Invasão", arrombamento: "Arrombamento",
  roubo: "Roubo", furto: "Furto", trafico: "Tráfico", roubo_carga: "Roubo de carga", operacao_policial: "Operação policial",
  expansao: "Expansão", novo_ocupante: "Novo ocupante", sazonalidade: "Sazonalidade", infraestrutura: "Infraestrutura", setor: "Setor", outro: "Outro",
};

// Tipos de segurança que pesam mais na leitura do entorno (para a ordenação e o destaque).
const TIPOS_GRAVES = ["latrocinio", "homicidio", "tiroteio", "arrastao", "roubo_carga", "invasao"];

const projetosComEntorno = () => Object.keys(LOCAIS).filter((pid) => LOCAIS[pid].cidade);

module.exports = { LOCAIS, TEMAS, TIPO_ROTULO, TIPOS_GRAVES, projetosComEntorno };

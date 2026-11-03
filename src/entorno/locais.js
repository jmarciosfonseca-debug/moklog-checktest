// Entorno (Marcio, 27/10 e 02/11/2026): notícias de segurança e de mercado logístico no entorno de cada parque.
// Cada projeto tem a SUA busca (cidade, bairro, termos de interesse) — o cliente só vê o que é do parque dele.
// CommonJS de propósito: lido pelo app (React) e pelo coletor na Vercel (api/entorno-coletar.js).
//
// "fontes": portais indicados pelo Marcio (02/11). Lidos direto pelo RSS do portal (WordPress: /feed/), além da busca
// no Google News (que agrega G1/Globo, UOL, R7, Estadão, CNN…). Se um feed falhar, a coleta segue e o painel mostra a falha.
const LOCAIS = {
  P601:  { nome: "Golgi Cajamar",         grupo: "golgi",   cidade: "Cajamar",         uf: "SP", vizinhas: ["Franco da Rocha", "Jordanésia", "Rodoanel"], interesse: ["Anhanguera", "Rodoanel"],
           fontes: [["Portal Notícia 360", "https://portalnoticia360.com.br/feed/"], ["Portal Dois Pontos", "https://www.portaldoispontos.com.br/feed/"], ["G1 Cajamar", "https://g1.globo.com/rss/g1/sp/sao-paulo/"]] },
  P602:  { nome: "Golgi Mauá",            grupo: "golgi",   cidade: "Mauá",            uf: "SP", vizinhas: ["Santo André", "Ribeirão Pires"], interesse: ["ABC Paulista"],
           fontes: [["G1 ABC", "https://g1.globo.com/rss/g1/sp/sao-paulo/"]] },
  P604:  { nome: "Golgi Jundiaí",         grupo: "golgi",   cidade: "Jundiaí",         uf: "SP", vizinhas: ["Várzea Paulista", "Campo Limpo Paulista"], interesse: ["Anhanguera", "Bandeirantes"],
           fontes: [["Portal Jundiaí", "https://portaljundiai.com.br/feed/"], ["Tribuna de Jundiaí", "https://tribunadejundiai.com.br/feed/"], ["Jundiaí Notícias", "https://jundiainoticias.com.br/feed/"], ["Jornal da Região", "https://jr.jor.br/feed/"], ["Destaque Regional", "https://destaqueregional.com.br/feed/"], ["G1 Sorocaba e Jundiaí", "https://g1.globo.com/rss/g1/sp/sorocaba-jundiai/"]] },
  P605:  { nome: "Golgi Dutra",           grupo: "golgi",   cidade: "Arujá",           uf: "SP", vizinhas: ["Guarulhos", "Itaquaquecetuba", "Santa Isabel"], interesse: ["Dutra"],
           fontes: [["Arujá Repórter", "https://www.arujareporter.com.br/feed/"], ["Prefeitura de Arujá", "https://portaldenoticias.prefeituradearuja.sp.gov.br/feed/"], ["G1 Mogi das Cruzes e Suzano", "https://g1.globo.com/rss/g1/sp/mogi-das-cruzes-suzano/"]] },
  P606:  { nome: "Golgi Duque de Caxias", grupo: "golgi",   cidade: "Duque de Caxias", uf: "RJ", vizinhas: ["Baixada Fluminense", "Washington Luiz"], interesse: ["Washington Luiz", "Arco Metropolitano"],
           fontes: [["G1 Rio", "https://g1.globo.com/rss/g1/rj/rio-de-janeiro/"]] },
  P607:  { nome: "Golgi Brasília",        grupo: "golgi",   cidade: "Santa Maria",     uf: "DF", vizinhas: ["Gama", "Valparaíso de Goiás", "Novo Gama"], interesse: ["BR-040", "Brasília"],
           fontes: [["Diário de Santa Maria", "https://diariosm.com.br/feed/"], ["Adm. Regional de Santa Maria", "https://www.santamaria.df.gov.br/feed/"], ["Jornal de Brasília", "https://jornaldebrasilia.com.br/feed/"], ["Alô Valparaíso", "https://alovalparaiso.com.br/feed/"], ["Grande Brasília", "https://grandebrasilia.com/feed/"], ["Prefeitura de Valparaíso", "https://valparaisodegoias.go.gov.br/feed/"], ["G1 DF", "https://g1.globo.com/rss/g1/df/distrito-federal/"], ["G1 Goiás", "https://g1.globo.com/rss/g1/go/goias/"]] },
  P311A: { nome: "Mega Curitiba",         grupo: "mega",    cidade: "Quatro Barras",   uf: "PR", vizinhas: ["Curitiba", "Colombo", "Campina Grande do Sul", "Pinhais"], interesse: ["BR-116", "Régis Bittencourt"],
           fontes: [["G1 Paraná", "https://g1.globo.com/rss/g1/pr/parana/"]] },
  P311B: { nome: "Mega Itajaí",           grupo: "mega",    cidade: "Itajaí",          uf: "SC", vizinhas: ["Navegantes", "Balneário Camboriú", "Brusque"], interesse: ["Porto de Itajaí", "Porto de Navegantes", "BR-101"],
           fontes: [["Jornal de Navegantes", "https://www.jornaldenavegantes.com.br/feed/"], ["Diarinho", "https://diarinho.net/feed/"], ["NSC Total", "https://www.nsctotal.com.br/rss"], ["Município de Itajaí", "https://itajai.sc.gov.br/noticias/feed"], ["G1 Santa Catarina", "https://g1.globo.com/rss/g1/sc/santa-catarina/"]] },
  P505:  { nome: "Klog Guarulhos",        grupo: "klog",    cidade: "Guarulhos",       uf: "SP", vizinhas: ["Cumbica", "Bonsucesso", "Pimentas"], interesse: ["Dutra", "Aeroporto de Guarulhos", "Cumbica"],
           fontes: [["Guarulhos Todo Dia", "https://guarulhostododia.com.br/feed/"], ["Click Guarulhos", "https://www.clickguarulhos.com.br/feed/"], ["GuarulhosWeb", "https://guarulhosweb.com.br/feed/"], ["G1 São Paulo", "https://g1.globo.com/rss/g1/sp/sao-paulo/"]] },
  // Jatinox (02/11): A e B no Ipiranga (São Paulo); C em Indaiatuba. Só segurança — não recebem o mercado geral (Black Friday etc.).
  P260A: { nome: "Jatinox Unidade A",     grupo: "jatinox", cidade: "São Paulo",       uf: "SP", bairro: "Ipiranga", vizinhas: ["Ipiranga", "Vila Prudente", "Sacomã", "Cursino"], interesse: ["Ipiranga"], soSeguranca: true,
           fontes: [["Ipiranga News", "https://ipiranganews.inf.br/feed/"], ["Gazzeta Paulista", "https://gazzetapaulista.com.br/feed/"]] },
  P260B: { nome: "Jatinox Unidade B",     grupo: "jatinox", cidade: "São Paulo",       uf: "SP", bairro: "Ipiranga", vizinhas: ["Ipiranga", "Vila Prudente", "Sacomã", "Cursino"], interesse: ["Ipiranga"], soSeguranca: true,
           fontes: [["Ipiranga News", "https://ipiranganews.inf.br/feed/"], ["Gazzeta Paulista", "https://gazzetapaulista.com.br/feed/"]] },
  P260C: { nome: "Jatinox Unidade C",     grupo: "jatinox", cidade: "Indaiatuba",      uf: "SP", vizinhas: ["Salto", "Itu", "Campinas"], interesse: ["Indaiatuba"], soSeguranca: true,
           fontes: [["G1 Campinas", "https://g1.globo.com/rss/g1/sp/campinas-regiao/"]] },
};

// Mercado geral (02/11): Black Friday, e-commerce e grandes ocupantes interessam a todos os parques, menos Jatinox.
// Coletado uma vez (entorno/_geral) e exibido junto do entorno de cada parque elegível.
const GERAL = {
  id: "_geral", nome: "Mercado logístico — geral",
  termos: ["Black Friday", "e-commerce", "Mercado Livre", "Amazon", "Shopee", "centro de distribuição", "condomínio logístico", "galpão logístico", "logística"],
  fontes: [["Mercado Livre Notícias", "https://news.mercadolivre.com/pt/feed/"], ["Shopee Blog", "https://shopee.com.br/blog/feed/"], ["Shopee Ads News", "https://ads.shopee.com.br/news/feed"], ["Mundo Logística", "https://mundologistica.com.br/feed/"], ["Logweb", "https://logweb.com.br/feed/"], ["G1 Economia", "https://g1.globo.com/rss/g1/economia/"]],
};
const recebeGeral = (pid) => !!LOCAIS[pid] && !LOCAIS[pid].soSeguranca;

// Temas. "seguranca" = o que afeta o risco do parque; "mercado" = movimento do setor logístico que interessa ao cliente.
const TEMAS = {
  seguranca: {
    rotulo: "Segurança no entorno",
    termos: ["roubo", "furto", "assalto", "homicídio", "latrocínio", "tiroteio", "arrastão", "invasão", "arrombamento", "tráfico", "roubo de carga", "sequestro", "quadrilha", "receptação", "operação policial", "assaltante", "ladrão", "criminoso", "bandido", "polícia", "GCM", "preso", "crime"],
    // Tipos que o classificador pode devolver (os 9 do Monitor OSINT + roubo de carga e operação policial).
    tipos: ["latrocinio", "homicidio", "tiroteio", "arrastao", "invasao", "arrombamento", "roubo", "furto", "trafico", "roubo_carga", "operacao_policial", "outro"],
  },
  mercado: {
    rotulo: "Mercado logístico",
    termos: ["condomínio logístico", "centro logístico", "galpão", "centro de distribuição", "Mercado Livre", "Amazon", "Shopee", "Black Friday", "e-commerce", "expansão", "investimento", "inauguração", "Golgi", "Klog", "Mega Centro Logístico", "porto", "aeroporto", "logística", "varejo", "transportadora"],
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

module.exports = { LOCAIS, GERAL, recebeGeral, TEMAS, TIPO_ROTULO, TIPOS_GRAVES, projetosComEntorno };

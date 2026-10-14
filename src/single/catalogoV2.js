// Catálogo Single v2 — itens SEPARADOS, um a um (decisão do Marcio, 13/10/2026): nada de agrupar cancela, dilacerador e portão.
// Origem: os 137 rótulos reais dos testes semanais dos parques (ver catalogoCobertura.cjs). O catálogo é editável pelo gerente;
// o que não existir aqui o usuário acrescenta como "ativo personalizado".
const { classificar: classificarV1, normalizar } = require("./catalogoAtivos");

const VERSAO = "single-v2";
const rows = [
  ["ped_torniquetes", "Pedestres", "Torniquetes / catracas"],
  ["ped_qr_torniquetes", "Pedestres", "Leitores QR dos torniquetes"],
  ["ped_facial", "Pedestres", "Leitores faciais"],
  ["ped_qr_eclusas", "Pedestres", "Leitores QR das eclusas"],
  ["ped_qr_cancelas", "Pedestres", "Leitores QR das cancelas / vias"],
  ["ped_qr_outros", "Pedestres", "Leitores QR (outros locais)"],
  ["ped_keyaccess", "Pedestres", "Sistema KeyAccess"],
  ["ped_totens", "Pedestres", "Totens de autoatendimento"],
  ["ped_tablets", "Pedestres", "Tablets"],
  ["ecl_portas", "Eclusas", "Eclusas (portas / abertura pelo CCO)"],
  ["ecl_garras", "Eclusas", "Garras de tigre das eclusas"],
  ["ecl_giroflex", "Eclusas", "Giroflex das eclusas"],
  ["ecl_eletroimas", "Eclusas", "Eletroímãs das eclusas"],
  ["vei_cancelas_as", "Veículos", "Cancelas de alta segurança"],
  ["vei_cancelas", "Veículos", "Cancelas comuns (administrativas / acesso)"],
  ["vei_dilaceradores", "Veículos", "Dilaceradores"],
  ["vei_bollards", "Veículos", "Bollards / pinos"],
  ["vei_portoes", "Veículos", "Portões (folhas)"],
  ["vei_motores", "Veículos", "Motores dos portões"],
  ["vei_botoeiras", "Veículos", "Botoeiras"],
  ["vei_sensores_portao", "Veículos", "Sensores dos portões"],
  ["vei_antiesmag", "Veículos", "Sensores anti-esmagamento"],
  ["vei_semaforos", "Veículos", "Semáforos"],
  ["vei_pictogramas", "Veículos", "Pictogramas"],
  ["vei_farois", "Veículos", "Faróis / LED das cancelas"],
  ["vei_sirenes", "Veículos", "Sirenes"],
  ["vei_campainhas", "Veículos", "Campainhas"],
  ["cftv_fixas", "CFTV e CCO", "Câmeras fixas"],
  ["cftv_speed", "CFTV e CCO", "Câmeras speed dome"],
  ["cftv_monitores", "CFTV e CCO", "Monitores do CFTV"],
  ["cco_monitores_acesso", "CFTV e CCO", "Monitores do controle de acesso"],
  ["cco_televisores", "CFTV e CCO", "Televisores / monitores de recepção"],
  ["cftv_joystick", "CFTV e CCO", "Joysticks"],
  ["cftv_mesa", "CFTV e CCO", "Mesas controladoras / botoeiras do CCO"],
  ["cftv_computadores", "CFTV e CCO", "Computadores / CPU"],
  ["cftv_nobreaks", "CFTV e CCO", "Nobreaks"],
  ["per_alarme", "Perímetro", "Alarme perimetral (zonas)"],
  ["per_cerca", "Perímetro", "Cerca elétrica"],
  ["per_alpha", "Perímetro", "Alpha Sense"],
  ["ala_incendio", "Alarmes", "Alarme de incêndio / SDAI"],
  ["ala_paradox", "Alarmes", "Alarme patrimonial (Paradox)"],
  ["ala_panico_fixo", "Alarmes", "Botões de pânico fixos"],
  ["ala_panico_movel", "Alarmes", "Botões de pânico móveis"],
  ["ala_alertas", "Alarmes", "Recebimento de alertas externos"],
  ["com_telefonia", "Comunicação", "Telefones"],
  ["com_interfones", "Comunicação", "Interfones / intercomunicadores"],
  ["com_video_porteiro", "Comunicação", "Vídeo porteiro"],
  ["inf_internet", "Infraestrutura", "Internet / link de dados"],
  ["inf_ar", "Infraestrutura", "Ar-condicionado"],
  ["inf_cofres", "Infraestrutura", "Cofres"],
];
const familias = rows.map(([id, grupo, nome], ordem) => ({ id, grupo, nome, sinonimos: [], ordem, ativo: true }));

// Regras em ordem: a primeira que casar vence. Entrada = rótulo real do teste semanal.
const regras = [
  [/speed dome/, "cftv_speed"],
  [/^(monitor|monitores)/, (s) => (/cftv/.test(s) ? "cftv_monitores" : /(cda|controle de acesso|keyaccess)/.test(s) ? "cco_monitores_acesso" : "cco_televisores")],
  [/^televisor/, "cco_televisores"],
  [/joystick/, "cftv_joystick"],
  [/^mesa/, "cftv_mesa"],
  [/^botoeiras/, "vei_botoeiras"],
  [/^motores/, "vei_motores"],
  [/^sensores dos portoes/, "vei_sensores_portao"],
  [/esmagamento/, "vei_antiesmag"],
  [/^(portao|portoes)/, "vei_portoes"],
  [/alta seguranca/, "vei_cancelas_as"],
  [/^(torniquete|catraca)/, "ped_torniquetes"],
  [/^(leitor|leitora|qr)/, (s) => (/facia/.test(s) ? "ped_facial" : /torniquete/.test(s) ? "ped_qr_torniquetes" : /eclus/.test(s) ? "ped_qr_eclusas" : /(cancela|baia|via)/.test(s) ? "ped_qr_cancelas" : "ped_qr_outros")],
  [/^sistema keyaccess/, "ped_keyaccess"],
  [/^tablet/, "ped_tablets"],
  [/^(totem|totens)/, "ped_totens"],
  [/^garras/, "ecl_garras"],
  [/giroflex/, "ecl_giroflex"],
  [/eletroima/, "ecl_eletroimas"],
  [/^(eclusa|cco \/ controle de acesso)/, "ecl_portas"],
  [/^(farol|farois)/, "vei_farois"],
  [/^cancela/, "vei_cancelas"],
  [/(dilacerador|garra de tigre)/, "vei_dilaceradores"],
  [/(bollard|pino)/, "vei_bollards"],
  [/semaforo/, "vei_semaforos"],
  [/^pictograma/, "vei_pictogramas"],
  [/^sirene/, "vei_sirenes"],
  [/^campainha/, "vei_campainhas"],
  [/^(cftv|imagens cftv|cameras)/, "cftv_fixas"],
  [/computador/, "cftv_computadores"],
  [/nobreak/, "cftv_nobreaks"],
  [/perimetral/, "per_alarme"],
  [/(^alarme cerca|^cerca)/, "per_cerca"],
  [/alpha/, "per_alpha"],
  [/(incendio|sdai)/, "ala_incendio"],
  [/paradox/, "ala_paradox"],
  [/panico mo/, "ala_panico_movel"],
  [/(panico fixo|botoes de panico)/, "ala_panico_fixo"],
  [/alertas externos/, "ala_alertas"],
  [/telefon/, "com_telefonia"],
  [/(interfon|intercomunic)/, "com_interfones"],
  [/video porteiro/, "com_video_porteiro"],
  [/^internet/, "inf_internet"],
  [/(ar-condicionado|ar condicionado)/, "inf_ar"],
  [/cofre/, "inf_cofres"],
];

// Devolve o id do item do catálogo v2, "fora_v1" (observações, manutenção, legado) ou "revisar".
function classificar(label, type) {
  if (classificarV1(label, type) === "fora_v1") return "fora_v1";
  const s = normalizar(label);
  for (const [re, dest] of regras) if (re.test(s)) return typeof dest === "function" ? dest(s) : dest;
  return "revisar";
}

module.exports = { familias, classificar, versao: VERSAO, VERSAO };

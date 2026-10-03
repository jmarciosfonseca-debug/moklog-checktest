// Provisional seed. Never persisted automatically; manager approval is required.
const rows = [
["ped_torniquetes","Pedestres","Torniquetes e catracas",["torniquete","catraca"]],
["ped_leitores","Pedestres","Leitores QR e faciais",["leitor","leitora","qr","keyaccess"]],
["ped_totens","Pedestres","Totens e tablets",["totem","totens","tablet","atm"]],
["ped_eclusas","Pedestres","Eclusas (portas, garras, giroflex, eletroímãs)",["eclusa","garra","giroflex","eletroima","cco / controle de acesso"]],
["vei_cancelas_as","Veículos","Cancelas de alta segurança",["alta seguranca"]],
["vei_cancelas","Veículos","Cancelas (administrativas e de acesso)",["cancela"]],
["vei_dilaceradores","Veículos","Dilaceradores / garra de tigre",["dilacerador","garra de tigre"]],
["vei_bollards","Veículos","Bollards e pinos",["bollard","pino"]],
["vei_portoes","Veículos","Portões, motores e botoeiras",["portao","portoes","motores dos","sensores dos","botoeiras de"]],
["vei_antiesmag","Veículos","Sensores anti-esmagamento",["esmagamento"]],
["vei_sinalizacao","Veículos","Sinalização (semáforos, pictogramas, faróis, sirenes)",["semaforo","pictograma","farol","farois","led das","sirene","campainha"]],
["cftv_cameras","CFTV e CCO","Câmeras CFTV (fixas e speed dome)",["cftv","camera","speed dome"]],
["cftv_monitores","CFTV e CCO","Monitores e televisores",["monitor","televisor","tv"]],
["cftv_joystick","CFTV e CCO","Joystick e mesa controladora",["joystick","mesa"]],
["cftv_computadores","CFTV e CCO","Computadores e CPU",["computador","cpu"]],
["cftv_nobreaks","CFTV e CCO","Nobreaks",["nobreak","no-break"]],
["per_alarme","Perímetro","Alarme perimetral (zonas)",["perimetral"]],
["per_cerca","Perímetro","Cerca elétrica e Alpha Sense",["cerca el","alpha","alambrado"]],
["ala_incendio","Alarmes","Alarme de incêndio / SDAI",["incendio","sdai"]],
["ala_paradox","Alarmes","Alarme patrimonial (Paradox)",["paradox","patrimonial"]],
["ala_panico","Alarmes","Botão de pânico (fixo e móvel)",["panico"]],
["ala_alertas","Alarmes","Recebimento de alertas externos",["alertas externos"]],
["com_telefonia","Comunicação","Telefonia",["telefon"]],
["com_interfonia","Comunicação","Interfonia e vídeo porteiro",["interfon","intercomunic","video porteiro"]],
["inf_internet","Infraestrutura","Internet / link de dados",["internet","link de dados"]],
["inf_ar","Infraestrutura","Ar-condicionado",["ar-condicionado","ar condicionado"]],
["inf_cofres","Infraestrutura","Cofres",["cofre"]]
];
const familias = rows.map(([id,grupo,nome,sinonimos],ordem)=>({id,grupo,nome,sinonimos,ordem,ativo:true}));
function normalizar(s) {return String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/^\s*\d+[a-z]?\s*[-–.]\s*/i,"").toLowerCase().trim();}
function classificar(label, type) {
 const s=normalizar(label);
 if (type==="notes" || type==="maintenance" || /^(legado|visita de manutencao|infraestrutura|materiais operacionais|salas e postos)/.test(s) || ["portaria","guarita/recepcao","sala de cftv cco","recepcao p3","cco equipamentos"].includes(s.replace(/\s*\/\s*/g,"/").replace(/[()]/g,""))) return "fora_v1";
 if (/^(totem|totens|tablet|atm)/.test(s)) return "ped_totens";
 if (/^(torniquete|catraca)/.test(s)) return "ped_torniquetes";
 if (/^botoeiras.*(port|dilacerador)/.test(s)) return "vei_portoes";
 if (/^(monitor|televisor|tv\b)/.test(s)) return "cftv_monitores";
 if (/^(joystick|mesa)/.test(s)) return "cftv_joystick";
 if (/^(interfon|intercomunic|video porteiro)/.test(s)) return "com_interfonia";
 if (/^(farol|farois|led|semaforo|pictograma|sirene|campainha)/.test(s)) return "vei_sinalizacao";
 // More specific families take precedence over broad camera/cancela labels.
 const order=["vei_antiesmag","vei_portoes","vei_dilaceradores","vei_cancelas_as","ped_leitores","cftv_monitores","ped_totens","cftv_joystick","ala_alertas",...familias.map(x=>x.id)];
 return order.map(id=>familias.find(f=>f.id===id)).find(f=>f.sinonimos.some(v=>v==="tv" ? /\btv\b/.test(s) : s.includes(v)))?.id || "revisar";
}
module.exports={familias, normalizar, classificar, versao:"single-v1-provisoria"};

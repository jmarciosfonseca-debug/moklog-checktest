// Painel do projeto — leitura dos documentos de UM projeto (só quando a tela ou o cartão pede) e cálculo da nota.
// O resultado fica guardado alguns minutos no aparelho para o cartão não reler tudo a cada vez que o projeto abre.
import { getFirestore, doc, getDoc, getDocs, collection, query, orderBy, limit } from "firebase/firestore";
import { getApps } from "firebase/app";
import { calcularPainel } from "./regua";
import { montarDados, DADOS_DEMO } from "./dados";
import { PERIMETRAL_VIA_RONDAS } from "../v360Perimetral";
import { isDemo } from "../session";

const VALIDADE_MS = 10 * 60000;
const memoria = new Map(); // pid → { em, resultado }
const db = () => getFirestore(getApps()[0]);
const ler = (col, pid) => getDoc(doc(db(), col, pid)).then((s) => (s.exists() ? s.data() : null)).catch(() => null);

export function painelEmMemoria(pid) { const m = memoria.get(pid); return m && Date.now() - m.em < VALIDADE_MS ? m.resultado : null; }
export function esquecerPainel(pid) { if (pid) memoria.delete(pid); else memoria.clear(); }

export async function carregarPainel({ pid, project, history, ctmk, forcar = false }) {
  if (isDemo()) return { ...calcularPainel(DADOS_DEMO), calculadoEm: new Date().toISOString(), demo: true };
  if (!forcar) { const m = painelEmMemoria(pid); if (m) return m; }
  const [equipeDoc, mapas, rondaDoc, keyDoc, periDoc, rondasDoc, energiaDoc, ambulancias, sinistroDoc, followupsDoc, intervaloDoc] = await Promise.all([
    ler("equipes", pid),
    getDocs(query(collection(db(), "equipes", pid, "mapas"), orderBy("data", "desc"), limit(70))).then((s) => s.docs.map((d) => d.data())).catch(() => []),
    ler("cco_ronda", pid), ler("keyaccess_falhas", pid), ler("perimetral", pid),
    PERIMETRAL_VIA_RONDAS.includes(pid) ? ler("rondas", pid) : Promise.resolve(null),
    ler("energia_ocorrencias", pid),
    getDocs(collection(db(), "ambulancias", pid, "registros")).then((s) => s.docs.map((d) => d.data())).catch(() => []),
    ler("sinistros", pid), ler("followups", pid), ler("cco_intervalo", pid),
  ]);
  const agora = new Date();
  const dados = montarDados({ pid, project, history, equipeDoc, mapas, rondaDoc, keyDoc, periDoc, rondasDoc, energiaDoc, ambulancias, sinistroDoc, followupsDoc, intervaloDoc, ctmk,
    hojeISO: agora.toLocaleDateString("sv-SE"), agoraMs: agora.getTime() });
  const resultado = { ...calcularPainel(dados), calculadoEm: agora.toISOString() };
  memoria.set(pid, { em: Date.now(), resultado });
  return resultado;
}

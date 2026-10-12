// Painel de Avisos — leitura em tempo real das fontes (somente leitura; nada é gravado).
// Documentos: onSnapshot (o Firestore avisa na hora em que mudam). Mapas do plantão: releitura a cada 60 s,
// ao voltar para o app e ao voltar a conexão. Falha de uma fonte é informada; nunca vira "sem avisos".
import { getApps } from "firebase/app";
import { getFirestore, doc, onSnapshot } from "firebase/firestore";
import { loadMapa } from "../mapaDiario/dados";
import { PROJETOS_DO_MAPA } from "../mapaDiario/painel";
import { plantoesDoAviso } from "./regras";

export const FONTES_DOC = [
  { chave: "keyaccess", rotulo: "KeyAccess", col: "keyaccess_falhas", campo: "registros", pids: "todos" },
  { chave: "energia", rotulo: "Energia", col: "energia_ocorrencias", campo: "eventos", pids: "todos" },
  { chave: "manutencao", rotulo: "Manutenção", col: "cco_manutencao", campo: "registros", pids: "todos" },
  { chave: "iluminacao", rotulo: "Iluminação", col: "iluminacao", campo: "quadrantes", pids: "todos" },
  { chave: "bolsao", rotulo: "Bolsão", col: "bolsao", campo: "placas", pids: ["P311A", "P311B"], objeto: true },
  { chave: "supervisao", rotulo: "Supervisão", col: "cco_supervisao", campo: "registros", pids: "mapa", gerencial: true },
];
export const ROTULO_FONTE = { ...Object.fromEntries(FONTES_DOC.map((f) => [f.chave, f.rotulo])), mapas: "Mapa de Equipe" };

// onDados(fonte, pid, valor) · onErro(fonte, pid, erro|null). Devolve { parar, esperados }.
export function assinarFontes({ projetos, gerencial, mapasAtivo = true, onDados, onErro, intervaloMapasMs = 60000 }) {
  const db = getFirestore(getApps()[0]);
  const paradas = [];
  let esperados = 0;
  for (const f of FONTES_DOC) {
    if (f.gerencial && !gerencial) continue;
    const pids = f.pids === "todos" ? projetos : f.pids === "mapa" ? PROJETOS_DO_MAPA : f.pids;
    for (const pid of pids) {
      esperados++;
      paradas.push(onSnapshot(doc(db, f.col, pid), (snap) => {
        const d = snap.exists() ? snap.data()[f.campo] : null;
        onDados(f.chave, pid, f.objeto ? (d && typeof d === "object" ? d : {}) : (Array.isArray(d) ? d : []));
        onErro(f.chave, pid, null);
      }, (e) => onErro(f.chave, pid, e || new Error("falha"))));
    }
  }
  let vivo = true;
  if (gerencial && mapasAtivo) {
    esperados += PROJETOS_DO_MAPA.length;
    const ler = async () => {
      const agora = new Date();
      await Promise.all(PROJETOS_DO_MAPA.map(async (pid) => {
        try {
          const pls = plantoesDoAviso(pid, agora);
          const lidos = {};
          for (const p of pls) lidos[p.chave] = (await loadMapa(pid, p.chave)) || null; // null = o documento não existe
          if (vivo) { onDados("mapas", pid, lidos); onErro("mapas", pid, null); }
        } catch (e) { if (vivo) onErro("mapas", pid, e); }
      }));
    };
    ler();
    const t = setInterval(ler, intervaloMapasMs);
    const aoVoltar = () => { if (typeof document === "undefined" || document.visibilityState === "visible") ler(); };
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", aoVoltar);
    if (typeof window !== "undefined") window.addEventListener("online", ler);
    paradas.push(() => { clearInterval(t); if (typeof document !== "undefined") document.removeEventListener("visibilitychange", aoVoltar); if (typeof window !== "undefined") window.removeEventListener("online", ler); });
  }
  return { esperados, parar: () => { vivo = false; paradas.forEach((p) => { try { p(); } catch (e) { /* já parado */ } }); } };
}

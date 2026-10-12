// Painel de Avisos — leitura em tempo real das fontes (somente leitura; nada é gravado).
// Documentos: onSnapshot (o Firestore avisa na hora em que mudam). Mapas do plantão: releitura a cada 60 s,
// ao voltar para o app e ao voltar a conexão. Falha de uma fonte é informada; nunca vira "sem avisos".
import { getApps } from "firebase/app";
import { getFirestore, doc, onSnapshot, getDoc } from "firebase/firestore";
import { loadMapa } from "../mapaDiario/dados";
import { PROJETOS_DO_MAPA } from "../mapaDiario/painel";
import { plantoesDoAviso } from "./regras";
import { AVISOS_CFG } from "./config";

export const FONTES_DOC = [
  { chave: "keyaccess", rotulo: "KeyAccess", col: "keyaccess_falhas", campo: "registros", pids: "todos" },
  { chave: "energia", rotulo: "Energia", col: "energia_ocorrencias", campo: "eventos", pids: "todos" },
  { chave: "manutencao", rotulo: "Manutenção", col: "cco_manutencao", campo: "registros", pids: "todos" },
  { chave: "iluminacao", rotulo: "Iluminação", col: "iluminacao", pids: "todos", ler: (d) => ({ quadrantes: Array.isArray(d && d.quadrantes) ? d.quadrantes : [], testeQuinzenal: (d && d.testeQuinzenal) || null }) },
  { chave: "bolsao", rotulo: "Bolsão", col: "bolsao", campo: "placas", pids: ["P311A", "P311B"], objeto: true },
  { chave: "supervisao", rotulo: "Supervisão", col: "cco_supervisao", campo: "registros", pids: "mapa", gerencial: true },
];
export const ROTULO_FONTE = { ...Object.fromEntries(FONTES_DOC.map((f) => [f.chave, f.rotulo])), mapas: "Mapa de Equipe", equipes: "Férias" };

// Férias mudam devagar e o documento da equipe é grande: leitura a cada 10 min (e ao voltar para o app), só nomes dos ativos.
export const lerEquipe = (d) => {
  const nomes = {};
  for (const c of (d && d.colaboradores) || []) if (c && c.status === "ativo" && c.id != null) nomes[c.id] = c.nome || "";
  return { ferias: Array.isArray(d && d.ferias) ? d.ferias : [], nomes };
};

// onDados(fonte, pid, valor) · onErro(fonte, pid, erro|null). Devolve { parar, esperados }.
export function assinarFontes({ projetos, gerencial, mapasAtivo = true, onDados, onErro, intervaloMapasMs = 60000 }) {
  const db = getFirestore(getApps()[0]);
  const paradas = [];
  let esperados = 0;
  for (const f of FONTES_DOC) {
    if (f.gerencial && !gerencial) continue;
    if (f.chave === "keyaccess" && !AVISOS_CFG.keyAccess.ativo) continue; // o botão KeyAccess da Home já cobre
    const pids = f.pids === "todos" ? projetos : f.pids === "mapa" ? PROJETOS_DO_MAPA : f.pids;
    for (const pid of pids) {
      esperados++;
      paradas.push(onSnapshot(doc(db, f.col, pid), (snap) => {
        const dados = snap.exists() ? snap.data() : null;
        if (f.ler) { onDados(f.chave, pid, f.ler(dados)); onErro(f.chave, pid, null); return; }
        const d = dados ? dados[f.campo] : null;
        onDados(f.chave, pid, f.objeto ? (d && typeof d === "object" ? d : {}) : (Array.isArray(d) ? d : []));
        onErro(f.chave, pid, null);
      }, (e) => onErro(f.chave, pid, e || new Error("falha"))));
    }
  }
  let vivo = true;
  if (gerencial) {
    esperados += PROJETOS_DO_MAPA.length; // equipes (férias)
    const lerEquipes = async () => {
      await Promise.all(PROJETOS_DO_MAPA.map(async (pid) => {
        try {
          const snap = await getDoc(doc(db, "equipes", pid));
          if (vivo) { onDados("equipes", pid, lerEquipe(snap.exists() ? snap.data() : null)); onErro("equipes", pid, null); }
        } catch (e) { if (vivo) onErro("equipes", pid, e); }
      }));
    };
    lerEquipes();
    const te = setInterval(lerEquipes, 10 * 60000);
    paradas.push(() => clearInterval(te));
    if (typeof document !== "undefined") { const v = () => { if (document.visibilityState === "visible") lerEquipes(); }; document.addEventListener("visibilitychange", v); paradas.push(() => document.removeEventListener("visibilitychange", v)); }
  }
  if (gerencial && mapasAtivo) {
    esperados += PROJETOS_DO_MAPA.length;
    const concluidos = new Map(); // plantão anterior já enviado não muda mais: não relê (poupa leituras)
    const ler = async () => {
      const agora = new Date();
      await Promise.all(PROJETOS_DO_MAPA.map(async (pid) => {
        try {
          const lidos = {};
          for (const p of plantoesDoAviso(pid, agora)) {
            if (p.slot !== "atual" && concluidos.has(p.chave)) { lidos[p.chave] = concluidos.get(p.chave); continue; }
            const m = (await loadMapa(pid, p.chave)) || null; // null = o documento não existe
            lidos[p.chave] = m;
            if (m && m.status === "enviado" && p.slot !== "atual") concluidos.set(p.chave, m);
          }
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

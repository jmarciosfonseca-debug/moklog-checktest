// Painel de Avisos — leitura em tempo real das fontes (somente leitura; nada é gravado).
// Documentos E mapas do plantão: onSnapshot (o Firestore avisa na hora em que mudam — falta marcada no mapa, central off-line,
// queda de energia aparecem sem esperar). Os mapas são só os plantões da janela de 24 h; a cada 60 s (e ao voltar para o app ou a
// conexão) a lista de plantões é recalculada: o que saiu da janela é desligado, o que entrou é ligado, e uma assinatura que caiu é refeita.
// Falha de uma fonte é informada; nunca vira "sem avisos".
import { getApps } from "firebase/app";
import { getFirestore, doc, onSnapshot, getDoc } from "firebase/firestore";
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
  if (mapasAtivo) {
    esperados += PROJETOS_DO_MAPA.length;
    const por = new Map(); // pid -> { subs: Map(chave -> desligar), lidos, faltam: Set, erros: Map }
    const emitir = (pid, st) => {
      if (!vivo || st.faltam.size) return; // só entrega quando TODOS os plantões da janela responderam (nunca um mapa pela metade)
      if (st.erros.size) { onErro("mapas", pid, [...st.erros.values()][0] || new Error("falha")); return; }
      onDados("mapas", pid, { ...st.lidos });
      onErro("mapas", pid, null);
    };
    const sincronizar = () => {
      const agora = new Date();
      for (const pid of PROJETOS_DO_MAPA) {
        if (!por.has(pid)) por.set(pid, { subs: new Map(), lidos: {}, faltam: new Set(), erros: new Map() });
        const st = por.get(pid);
        const plantoes = plantoesDoAviso(pid, agora, AVISOS_CFG.plantoes, AVISOS_CFG.janelaPessoasH);
        const chaves = new Set(plantoes.map((p) => p.chave));
        let mudouJanela = false;
        for (const [ch, desligar] of [...st.subs]) {
          if (chaves.has(ch)) continue;
          try { desligar(); } catch (e) { /* já desligado */ }
          st.subs.delete(ch); delete st.lidos[ch]; st.faltam.delete(ch); st.erros.delete(ch); mudouJanela = true;
        }
        for (const ch of [...st.erros.keys()]) if (!chaves.has(ch)) { st.erros.delete(ch); mudouJanela = true; }
        for (const p of plantoes) {
          if (st.subs.has(p.chave)) continue;
          st.faltam.add(p.chave);
          st.subs.set(p.chave, onSnapshot(doc(db, "equipes", pid, "mapas", p.chave), (snap) => {
            st.lidos[p.chave] = snap.exists() ? snap.data() : null; // null = o documento não existe
            st.faltam.delete(p.chave); st.erros.delete(p.chave);
            emitir(pid, st);
          }, (e) => {
            st.erros.set(p.chave, e || new Error("falha")); st.faltam.delete(p.chave);
            st.subs.delete(p.chave); // a assinatura caiu: a próxima rodada refaz
            emitir(pid, st);
          }));
        }
        if (mudouJanela) emitir(pid, st);
      }
    };
    sincronizar();
    const t = setInterval(sincronizar, intervaloMapasMs);
    const aoVoltar = () => { if (typeof document === "undefined" || document.visibilityState === "visible") sincronizar(); };
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", aoVoltar);
    if (typeof window !== "undefined") window.addEventListener("online", sincronizar);
    paradas.push(() => {
      clearInterval(t);
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", aoVoltar);
      if (typeof window !== "undefined") window.removeEventListener("online", sincronizar);
      por.forEach((st) => st.subs.forEach((d) => { try { d(); } catch (e) { /* já desligado */ } }));
    });
  }
  return { esperados, parar: () => { vivo = false; paradas.forEach((p) => { try { p(); } catch (e) { /* já parado */ } }); } };
}

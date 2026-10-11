// backup.js — exporta TODOS os dados do app em um único JSON (cópia de segurança manual).
import { getFirestore, collection, collectionGroup, getDocsFromServer } from "firebase/firestore";

export const COLECOES_BACKUP = ["acesso","acesso_cco","acessos_jatinox","acessos_p260a","ambulancias","bolsao","bolsao_inquilinos",
  "cco_bodycam","cco_intervalo","cco_manutencao","cco_ronda","cco_supervisao","cftv_gravacao","config","contadores","ctmk",
  "empresa_info","energia_ocorrencias","equipamentos","equipes","followups","iluminacao","inquilinos","intervalos",
  "keyaccess_falhas","ocorrencias","perimetral","projects","ronda_vspp","rondas","rondas_plantoes","visitas","diagnosticos","lixeira"];
// Subcoleções conhecidas (lidas por collectionGroup)
export const SUBCOLECOES_BACKUP = ["registros","fotos","itens","cestaNatal","ovoPascoa"];

export async function coletarBackup(aoProgredir = () => {}) {
  const db = getFirestore();
  const saida = { geradoEm: new Date().toISOString(), versao: 1, colecoes: {}, subcolecoes: {}, falhas: [] };
  const total = COLECOES_BACKUP.length + SUBCOLECOES_BACKUP.length;
  let n = 0;
  for (const nome of COLECOES_BACKUP) {
    try {
      const s = await getDocsFromServer(collection(db, nome));
      saida.colecoes[nome] = s.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) { saida.falhas.push(`${nome}: ${e && e.message}`); }
    aoProgredir(++n, total, nome);
  }
  for (const nome of SUBCOLECOES_BACKUP) {
    try {
      const s = await getDocsFromServer(collectionGroup(db, nome));
      saida.subcolecoes[nome] = s.docs.map(d => ({ path: d.ref.path, ...d.data() }));
    } catch (e) { saida.falhas.push(`${nome}: ${e && e.message}`); }
    aoProgredir(++n, total, nome);
  }
  return saida;
}

export async function baixarBackup(aoProgredir) {
  const dados = await coletarBackup(aoProgredir);
  const blob = new Blob([JSON.stringify(dados)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `backup_moklog_${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return { colecoes: Object.keys(dados.colecoes).length, docs: Object.values(dados.colecoes).reduce((n, l) => n + l.length, 0), falhas: dados.falhas };
}

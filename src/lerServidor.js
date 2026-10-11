// lerServidor.js — leitura de coleções "servidor primeiro".
// Com o cache offline do Firestore, getDocs pode devolver lista vazia/antiga do
// aparelho sem avisar. Aqui buscamos SEMPRE no servidor; só se ele estiver
// inacessível caímos no cache (comportamento de abrir offline).
import { getDocs, getDocsFromServer } from "firebase/firestore";
export async function getDocsSeguro(q) {
  try { return await getDocsFromServer(q); }
  catch (e) { return await getDocs(q); }
}

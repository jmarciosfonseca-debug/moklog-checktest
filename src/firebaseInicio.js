// Precisa ser importado ANTES do App (ver index.js): define o tipo de cache do Firestore na abertura. Ver cacheLeitura.js.
import { iniciarLeituraOffline } from "./cacheLeitura";
export const resultadoCache = iniciarLeituraOffline();

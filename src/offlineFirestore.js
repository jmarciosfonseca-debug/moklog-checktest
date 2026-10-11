// offlineFirestore.js — cache offline persistente do Firestore (IndexedDB).
// DEVE ser o primeiro import do index.js: precisa rodar antes de qualquer
// getFirestore(). Efeito: os últimos dados lidos ficam no aparelho (abrir sem
// internet) e as escritas feitas offline entram numa fila local que sobe
// sozinha quando a conexão volta. Se o navegador não suportar, segue como antes.
import { initializeApp, getApps } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDLMwBqccgWDk7VFQdLYKuLNXWtkNn5WGA",
  authDomain: "moklog-checktest.firebaseapp.com",
  projectId: "moklog-checktest",
  storageBucket: "moklog-checktest.firebasestorage.app",
  messagingSenderId: "390165325023",
  appId: "1:390165325023:web:3147cd333503916b0d756a"
};

try {
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
} catch (e) {
  try { console.warn("[offline] cache persistente indisponível:", e && e.message); } catch {}
}

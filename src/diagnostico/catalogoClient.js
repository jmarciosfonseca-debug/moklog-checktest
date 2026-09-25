import { getAuth, onAuthStateChanged } from "firebase/auth";

async function usuarioAtual(timeoutMs = 5000) {
  const auth = getAuth();
  if (auth.currentUser) return auth.currentUser;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      unsub();
      reject(new Error("A autenticação do aplicativo não ficou pronta."));
    }, timeoutMs);
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      clearTimeout(timer);
      unsub();
      resolve(user);
    });
  });
}
export async function carregarCatalogoDiagnostico() {
  const user = await usuarioAtual();
  const token = await user.getIdToken();
  const response = await fetch("/api/diagnostico/catalogo", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok || !data.catalogo) {
    throw new Error(data.message || "Não foi possível carregar o catálogo do diagnóstico.");
  }
  return data.catalogo;
}

// Carrega uma tela pesada só quando ela é aberta. Se o download falhar (rede fraca, ou o app aberto é de uma versão antiga cujos
// arquivos já saíram do ar depois de uma publicação), tenta de novo e, em último caso, recarrega o app UMA vez para pegar a versão
// nova. Sem essa guarda, o usuário veria uma tela de erro ao abrir um módulo logo depois de uma atualização.
import React from "react";

const CHAVE = "mk-chunk-reload";

export function importarComRetry(carregar, { tentativas = 2, espera = 400, win = typeof window !== "undefined" ? window : null } = {}) {
  const tentar = (n) => carregar().catch((erro) => {
    if (n < tentativas) return new Promise((ok) => setTimeout(ok, espera * (n + 1))).then(() => tentar(n + 1));
    // Última saída: recarrega uma vez por minuto no máximo (evita laço de recarga se o servidor estiver fora).
    try {
      const ult = Number(win && win.sessionStorage && win.sessionStorage.getItem(CHAVE)) || 0;
      if (win && win.location && Date.now() - ult > 60000) {
        win.sessionStorage.setItem(CHAVE, String(Date.now()));
        win.location.reload();
        return new Promise(() => {}); // a página vai recarregar; não resolve nem rejeita
      }
    } catch { /* sessionStorage bloqueado: segue para o erro normal */ }
    throw erro;
  });
  return tentar(0);
}

export const lazyTela = (carregar) => React.lazy(() => importarComRetry(carregar));

export const TelaCarregando = ({ texto = "Abrindo…" }) => (
  <div role="status" aria-live="polite" style={{ color: "#94a3b8", padding: 20, fontSize: 14 }}>{texto}</div>
);

// Componente que já traz o "Abrindo…" embutido: no lugar do import direto basta trocar por telaLazy(() => import("./Tela")).
export function telaLazy(carregar, texto = "Abrindo…") {
  const Tela = lazyTela(carregar);
  const Envolta = (props) => <React.Suspense fallback={<TelaCarregando texto={texto} />}><Tela {...props} /></React.Suspense>;
  Envolta.displayName = "TelaLazy";
  return Envolta;
}

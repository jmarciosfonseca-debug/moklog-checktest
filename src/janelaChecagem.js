import { useState, useEffect } from "react";
// A checagem de equipe do fim de semana vale de sábado 00:00 a domingo 23:59.
export function janelaChecagemAberta(ref) {
  const d = (ref ? new Date(ref) : new Date()).getDay();
  return d === 6 || d === 0;
}
// Reavalia a tela só quando a pessoa volta à aba/app. Sem relógio em segundo plano (antes: 2 intervalos de 30 s).
export function useAtualizarAoVoltar() {
  const [, setN] = useState(0);
  useEffect(() => {
    const f = () => { if (typeof document === "undefined" || !document.hidden) setN(n => n + 1); };
    document.addEventListener("visibilitychange", f);
    window.addEventListener("focus", f);
    return () => { document.removeEventListener("visibilitychange", f); window.removeEventListener("focus", f); };
  }, []);
}

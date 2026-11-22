// Abertura SIS⁺ (Marcio, 20–21/11/2026), versão aprovada na prévia:
//  0) A frase "o software por trás do hardware" surge em vermelho, em 3D, e recua para o fundo.
//  1) Ignição: uma bolinha branca sobe, acende e a tela ofusca e liga. Tocar durante a ignição pula para a órbita.
//  2) SIS em órbita 3D: os componentes do Sistema Integrado de Segurança giram em torno do MOKED SIS⁺ (arraste para girar).
//     - Segurar um ícone: o anel enche e abre o cartão do que ele alimenta no app.
//     - Segurar o MOKED (ou afastar dois dedos / rolar o mouse sobre ele): plasma, explosão, túnel e a História da Moked
//       (capítulos + Universo SIS⁺). O ✕ volta para a órbita.
//     - "Entrar", tocar/clicar fora dos ícones, Enter ou Espaço: vai para a escolha de Áreas Moked.
// Funciona em toque (Android, iPhone) e em mouse/teclado (PC). Só toca na abertura de verdade (ver src/retomar.js).
// Com "reduzir movimento", a órbita aparece parada. Tudo roda dentro de um Shadow DOM: o estilo da abertura não vaza para o app.
import { useEffect, useRef } from "react";
import { iniciarSIS } from "./sisMotor";

export default function AberturaSIS({ onFim }) {
  const host = useRef(null);
  const fim = useRef(onFim);
  fim.current = onFim;

  useEffect(() => {
    const el = host.current; if (!el) return undefined;
    const raiz = el.shadowRoot || (el.attachShadow ? el.attachShadow({ mode: "open" }) : el);
    const parar = iniciarSIS(raiz, el, { onFim: () => { if (fim.current) fim.current(); } });
    return () => { parar(); if (raiz !== el) raiz.innerHTML = ""; else el.innerHTML = ""; };
  }, []);

  return (
    <div
      ref={host}
      data-testid="entrada-abertura"
      role="group"
      aria-label="Abertura Moked SIS. Pressione Enter para entrar na escolha de áreas."
      style={{ position: "fixed", inset: 0, zIndex: 60, background: "#050507", overflow: "hidden" }}
    />
  );
}

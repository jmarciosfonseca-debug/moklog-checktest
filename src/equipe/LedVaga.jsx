import React from 'react';

// LED piscante de "posto vago": aparece sempre que o efetivo ativo está abaixo do quadro previsto do projeto.
export default function LedVaga({ vagas, tamanho = 9 }) {
  if (!(vagas > 0)) return null;
  return <span role="img" aria-label={`${vagas} posto(s) vago(s)`} title={`${vagas} posto(s) vago(s)`} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 5 }}>
    <style>{'@keyframes mkLedVaga{0%,100%{opacity:1;box-shadow:0 0 6px 2px rgba(239,68,68,.75)}50%{opacity:.25;box-shadow:0 0 0 0 rgba(239,68,68,0)}}'}</style>
    <span style={{ display: 'block', width: tamanho, height: tamanho, borderRadius: '50%', background: '#ef4444', animation: 'mkLedVaga 1.1s ease-in-out infinite' }} />
  </span>;
}

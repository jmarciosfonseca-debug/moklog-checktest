import React from "react";

// Ícone oficial do Assistente IA MokLog (emblema Moked em placa de vidro).
// Arquivo: public/icones/ia-moked.svg (carregado como imagem: sem conflito de ids de gradiente).
export const ICONE_IA_SRC = "/icones/ia-moked.svg";

export default function IconeIA({ size = 56 }) {
  return (
    <img
      src={ICONE_IA_SRC}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable={false}
      style={{ display: "block", width: size, height: size, flexShrink: 0 }}
    />
  );
}

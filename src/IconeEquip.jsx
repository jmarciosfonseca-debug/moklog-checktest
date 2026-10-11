import React from "react";
// Ícones realistas (placa 3D) dos equipamentos; se a imagem faltar, volta ao emoji.
const SLUG = { "📱":"smartphone","📻":"radio-ht","🔫":"armamento","💊":"municao","🦺":"placas","🔦":"lanterna","🏍️":"motocicleta","🚨":"ztrax","📹":"bodycam" };
export default function IconeEquip({ icon, size = 32 }) {
  const [erro, setErro] = React.useState(false);
  const slug = SLUG[icon];
  if (!slug || erro) return <span style={{ fontSize: Math.round(size * 0.7) }}>{icon}</span>;
  return <img src={`/icones/equipamentos/${slug}.svg`} alt="" width={size} height={size} onError={() => setErro(true)} style={{ display: "block", flexShrink: 0 }} />;
}

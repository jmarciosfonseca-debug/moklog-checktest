// Símbolo oficial Moked (SVG enviado pelo Marcio em 12/11/2026). Substitui o "alvo" redondo antigo em todo o app.
// No desenho original os arcos e o ponto central são pretos; em fundo escuro (o app) eles vão em branco — o vermelho
// Moked (#AE1C13) não muda. `fundo="claro"` devolve o desenho exatamente como no arquivo.
export const VERMELHO_MOKED = "#AE1C13";
const ARCOS = [
  "M 159.39 31 L 108 31 A 107 107 0 0 0 1.3 130 L 48.54 130 A 60 60 0 0 1 108 78 L 111.77 78 A 122 122 0 0 0 159.39 31 Z",
  "M 159.39 245 L 108 245 A 107 107 0 0 1 1.3 146 L 48.54 146 A 60 60 0 0 0 108 198 L 111.77 198 A 122 122 0 0 1 159.39 245 Z",
  "M 350.61 31 L 402 31 A 107 107 0 0 1 508.7 130 L 461.46 130 A 60 60 0 0 0 402 78 L 398.23 78 A 122 122 0 0 1 350.61 31 Z",
  "M 350.61 245 L 402 245 A 107 107 0 0 0 508.7 146 L 461.46 146 A 60 60 0 0 1 402 198 L 398.23 198 A 122 122 0 0 0 350.61 245 Z",
];
const NUCLEO = [
  "M 230 0 L 246 0 L 246 78 L 218 78 A 60 60 0 0 0 158.54 130 L 111.3 130 A 107 107 0 0 1 218 31 L 230 31 Z",
  "M 230 276 L 246 276 L 246 198 L 218 198 A 60 60 0 0 1 158.54 146 L 111.3 146 A 107 107 0 0 0 218 245 L 230 245 Z",
  "M 280 0 L 264 0 L 264 78 L 292 78 A 60 60 0 0 1 351.46 130 L 398.7 130 A 107 107 0 0 0 292 31 L 280 31 Z",
  "M 280 276 L 264 276 L 264 198 L 292 198 A 60 60 0 0 0 351.46 146 L 398.7 146 A 107 107 0 0 1 292 245 L 280 245 Z",
];
// Miolo do SVG (sem a tag <svg>), para tela e para os documentos em HTML.
export const mioloSimbolo = (neutro) => `${ARCOS.map((d) => `<path d="${d}" fill="${neutro}"/>`).join("")}${NUCLEO.map((d) => `<path d="${d}" fill="${VERMELHO_MOKED}"/>`).join("")}<circle cx="255" cy="138" r="30" fill="${neutro}"/>`;
export const simboloSVG = ({ largura = 54, fundo = "claro", classe = "" } = {}) => `<svg${classe ? ` class="${classe}"` : ""} width="${largura}" height="${Math.round((largura * 276) / 510)}" viewBox="0 0 510 276" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Moked">${mioloSimbolo(fundo === "escuro" ? "#ffffff" : "#000000")}</svg>`;

// Só o símbolo (proporção 510 × 276).
export function MokedSimbolo({ largura = 60, fundo = "escuro", style }) {
  const neutro = fundo === "escuro" ? "#ffffff" : "#000000";
  return <svg width={largura} height={(largura * 276) / 510} viewBox="0 0 510 276" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Moked" style={style}>
    {ARCOS.map((d, i) => <path key={`a${i}`} d={d} fill={neutro} />)}
    {NUCLEO.map((d, i) => <path key={`n${i}`} d={d} fill={VERMELHO_MOKED} />)}
    <circle cx="255" cy="138" r="30" fill={neutro} />
  </svg>;
}

// Selo quadrado (mesmo espaço que o alvo antigo ocupava nos cabeçalhos): fundo escuro com o símbolo dentro.
export default function MokedSelo({ size = 44 }) {
  return <span aria-hidden="false" style={{ width: size, height: size, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: size * 0.22, background: "radial-gradient(circle at 50% 40%, #1c1c22 0%, #0a0a0d 75%)", border: "1px solid #2a2a31" }}>
    <MokedSimbolo largura={size * 0.8} />
  </span>;
}

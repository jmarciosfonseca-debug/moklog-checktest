// Selo "falta no posto": discreto, vermelho, com um ponto que pulsa devagar. Aparece só enquanto a falta é do dia.
import { textoFalta, textoPlantao } from "./faltasDoDia";

const COR = "#ef4444";

export default function SeloFalta({ info, onClick, aberto = false, detalhe = false, tamanho = 11 }) {
  const texto = textoFalta(info);
  if (!texto) return null;
  const quando = detalhe ? textoPlantao(info) : "";
  const Tag = onClick ? "button" : "span";
  return (
    <Tag data-testid="selo-falta" type={onClick ? "button" : undefined} onClick={onClick} aria-expanded={onClick ? aberto : undefined}
      aria-label={`${texto}${quando ? `, plantão ${quando}` : ""}${onClick ? ". Ver o mapa" : ""}`}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, maxWidth: "100%", background: COR + "1c", border: `1px solid ${COR}66`, color: COR, borderRadius: 999, padding: onClick ? "6px 11px" : "2px 9px", fontSize: tamanho, fontWeight: 800, lineHeight: 1.2, cursor: onClick ? "pointer" : "inherit", fontFamily: "inherit" }}>
      <style>{`@keyframes mkFaltaPulso{0%,100%{box-shadow:0 0 0 0 ${COR}99}60%{box-shadow:0 0 0 6px ${COR}00}}@media (prefers-reduced-motion:reduce){.mk-falta-ponto{animation:none!important}}`}</style>
      <span className="mk-falta-ponto" aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: COR, flexShrink: 0, animation: "mkFaltaPulso 1.8s ease-out infinite" }} />
      <span>{texto}{quando ? <span style={{ fontWeight: 600, opacity: .85 }}> · {quando}</span> : null}</span>
      {onClick && <span aria-hidden="true" style={{ fontWeight: 700, opacity: .85 }}>{aberto ? "Fechar ⌄" : "Ver ›"}</span>}
    </Tag>
  );
}

// Teste quinzenal de iluminação — regra do ciclo (sempre aos domingos às 21h). Puro: usado pela tela de Iluminação,
// pelo contador da Home e pelo Painel de Avisos (src/avisos). Âncora do 1º ciclo: 09/08/2026 (domingo), ciclo = +14 dias.
// O contador NÃO avança sozinho: trava no alvo vigente ("pendente") até a equipe concluir; só então crava +14 dias.
export const TQ_ANCORA = "2026-08-09";
export const TQ_HORA = 21;
export function tqParseISO(iso){ return new Date(iso+"T12:00:00"); }
export function tqISO(d){ return d.toLocaleDateString("sv-SE"); }
export function tqAjustaDomingo(d){ const diff=(7-d.getDay())%7; if(diff!==0){ const nd=new Date(d); nd.setDate(nd.getDate()+diff); return nd; } return d; }
export function tqProximoAPartirDe(baseISO){ const b=tqParseISO(baseISO); b.setDate(b.getDate()+14); return tqISO(tqAjustaDomingo(b)); }
// Alvo vigente quando ainda não há registro: o primeiro domingo do ciclo (âncora
// ou seguinte) que ainda não passou do horário de teste. NÃO pula ciclos sozinho.
export function tqAlvoVigente(tq, agora = new Date()){
  if(tq && tq.alvo) return tq.alvo;
  // sem registro: parte da âncora e avança de 14 em 14 só até alcançar "hoje",
  // mas para no primeiro alvo cujo horário-limite (21h) ainda não passou.
  let alvo = tqParseISO(TQ_ANCORA);
  while(true){
    const limite = new Date(alvo); limite.setHours(TQ_HORA,0,0,0);
    if(agora < limite) break;                 // ainda não chegou no teste deste ciclo
    const prox = new Date(alvo); prox.setDate(prox.getDate()+14);
    // se o próximo ciclo ainda é futuro mas este já passou, este vira "pendente":
    const proxLimite = new Date(prox); proxLimite.setHours(TQ_HORA,0,0,0);
    if(agora < proxLimite){ /* mantém alvo atual como pendente */ break; }
    alvo = prox;
  }
  return tqISO(tqAjustaDomingo(alvo));
}
// Alvo como timestamp no horário do teste (21h de domingo).
export function tqAlvoTimestamp(alvoISO){ const d=tqParseISO(alvoISO); d.setHours(TQ_HORA,0,0,0); return d.getTime(); }


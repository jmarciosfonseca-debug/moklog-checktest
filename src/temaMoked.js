// Base visual compartilhada: superfícies neutras; cor comunica estado ou ação.
export const ESTADOS_MOKED = Object.freeze({ ok: '#15803D', parcial: '#92400E', falha: '#B91C1C' });
export const estadoMoked = (estado) => ({
  background: ESTADOS_MOKED[estado] || '#475569', color: '#fff',
  border: '1px solid transparent', textShadow: 'none', boxShadow: 'none',
});
export const badgeMoked = (estado) => ({
  ...estadoMoked(estado), borderRadius: 6, padding: '3px 8px', fontWeight: 700,
});

export function temaMoked(dark) {
  const surface = dark ? '#1F2937' : '#FFFFFF';
  const text = dark ? '#F3F4F6' : '#111827';
  const muted = dark ? '#CBD5E1' : '#475569';
  const border = dark ? '#475569' : '#CBD5E1';
  const soft = dark ? '#111827' : '#F5F6F8';
  const shadow = dark ? '0 2px 8px rgba(0,0,0,.16)' : '0 2px 8px rgba(15,23,42,.06)';
  return {
    title: text, sub: muted, hdrBg: surface, hdrBorder: border, hdrTxt: text,
    divLine: border, divTxt: muted,
    diagBg: surface, diagBorder: border, diagShadow: shadow,
    diagTxt: text, diagSub: muted, diagArrow: muted,
    card: surface, cardTxt: text, cardSub: muted, cardBorderNeutral: border,
    cardShadow: () => shadow, track: border,
    saudeBg: surface, saudeLabel: muted, saudeShadow: shadow,
    draftBg: surface, draftShadow: shadow,
    mod: () => surface, modShadow: shadow, modChev: () => muted,
    modIconBg: () => soft, ttl: () => text,
    chev: muted, listBg: surface, listBgActive: soft,
    listBorder: border, listName: muted, listHdr: surface,
  };
}

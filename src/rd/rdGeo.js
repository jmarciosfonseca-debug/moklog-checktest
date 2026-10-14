// GPS do aparelho em cada marcação. Nunca trava o fluxo: sem permissão ou sem sinal, a marcação sai sem localização.
export function capturarPosicao(nav = typeof navigator !== "undefined" ? navigator : null, timeoutMs = 12000) {
  return new Promise((resolve) => {
    if (!nav?.geolocation) return resolve(null);
    let done = false;
    const fim = (v) => { if (!done) { done = true; resolve(v); } };
    const relogio = setTimeout(() => fim(null), timeoutMs + 500);
    try {
      nav.geolocation.getCurrentPosition(
        (p) => { clearTimeout(relogio); fim({ lat: Math.round(p.coords.latitude * 1e6) / 1e6, lng: Math.round(p.coords.longitude * 1e6) / 1e6, acc: Math.round(p.coords.accuracy || 0) }); },
        () => { clearTimeout(relogio); fim(null); },
        { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30000 }
      );
    } catch { clearTimeout(relogio); fim(null); }
  });
}

// Coordenada → endereço legível (geocodificação reversa gratuita, sem chave). A coordenada crua é o dado auditável.
export async function resolverEndereco(gps, request = typeof fetch !== "undefined" ? fetch : null) {
  if (!gps || !request) return null;
  try {
    const r = await request(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${gps.lat}&longitude=${gps.lng}&localityLanguage=pt`);
    if (!r.ok) return null;
    const d = await r.json();
    const partes = [[d.locality, d.principalSubdivisionCode?.replace(/^BR-/, "")].filter(Boolean).join(" - ")];
    const rua = (d.localityInfo?.administrative || []).concat(d.localityInfo?.informative || [])
      .filter((x) => x.order >= 8 && x.name).sort((a, b) => b.order - a.order)[0]?.name;
    return [rua, ...partes].filter(Boolean).join(", ") || null;
  } catch { return null; }
}

export const linkMapa = (gps) => (gps ? `https://www.google.com/maps?q=${gps.lat},${gps.lng}` : null);

// Marco completo de uma marcação: horário sempre; GPS e endereço quando o aparelho permitir.
export async function criarMarco(deps = {}) {
  const gps = await capturarPosicao(deps.nav, deps.timeoutMs);
  const endereco = gps ? await resolverEndereco(gps, deps.request) : null;
  return { em: new Date().toISOString(), ...(gps ? { gps } : {}), ...(endereco ? { endereco } : {}) };
}

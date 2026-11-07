// Endereço residencial do colaborador (Marcio, 06/11/2026): cadastro completo, geocodificação automática ao salvar
// (OpenStreetMap/Nominatim, sem chave) e distância casa → projeto. O endereço fica recolhido na ficha e, no Mapa de
// Equipe do cliente, sai mascarado (sem número e sem CEP) — só a distância é informação aberta.
const { coordsDe } = require("../entorno/locais");
const { distanciaKm } = require("../entorno/core");

const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

export const enderecoVazio = () => ({ cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "" });

export const limparCep = (cep) => String(cep || "").replace(/\D/g, "").slice(0, 8);
export const fmtCep = (cep) => { const d = limparCep(cep); return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : d; };

export function enderecoPreenchido(e) {
  return !!(e && (e.logradouro || "").trim() && (e.cidade || "").trim());
}

// Texto completo (ficha, uso interno).
export function enderecoTexto(e) {
  if (!enderecoPreenchido(e)) return "";
  const l1 = [e.logradouro, e.numero].filter((x) => String(x || "").trim()).join(", ") + (e.complemento ? ` — ${e.complemento}` : "");
  const l2 = [e.bairro, [e.cidade, e.uf].filter(Boolean).join("/")].filter(Boolean).join(", ");
  return [l1, l2, e.cep ? `CEP ${fmtCep(e.cep)}` : ""].filter(Boolean).join(" · ");
}

// Texto mascarado (relatório do cliente): sem número, sem complemento, CEP com asteriscos.
export function enderecoMascarado(e) {
  if (!enderecoPreenchido(e)) return "";
  const l1 = `${e.logradouro}, ***`;
  const l2 = [e.bairro, [e.cidade, e.uf].filter(Boolean).join("/")].filter(Boolean).join(", ");
  return [l1, l2, e.cep ? "CEP *****-***" : ""].filter(Boolean).join(" · ");
}

// Chave do endereço para saber se mudou (e precisa geocodificar de novo).
export const chaveEndereco = (e) => enderecoPreenchido(e) ? [e.logradouro, e.numero, e.bairro, e.cidade, e.uf, limparCep(e.cep)].map((x) => String(x || "").trim().toLowerCase()).join("|") : "";

export const fmtKm = (km) => (typeof km !== "number" ? "—" : km < 1 ? `${Math.round(km * 1000)} m` : `${km.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`);

// ViaCEP: preenche logradouro/bairro/cidade/UF a partir do CEP (gratuito, sem chave).
export async function buscarCep(cep, fetchFn = typeof fetch !== "undefined" ? fetch : null) {
  const d = limparCep(cep);
  if (d.length !== 8 || !fetchFn) return null;
  try {
    const r = await fetchFn(`https://viacep.com.br/ws/${d}/json/`);
    const j = r.ok ? await r.json() : null;
    if (!j || j.erro) return null;
    return { cep: d, logradouro: j.logradouro || "", bairro: j.bairro || "", cidade: j.localidade || "", uf: UFS.includes(j.uf) ? j.uf : "" };
  } catch { return null; }
}

// Nominatim: endereço → lat/lng. Tenta com número; se não achar, tenta só a rua/bairro/cidade (precisão de rua).
export async function geocodificarEndereco(e, fetchFn = typeof fetch !== "undefined" ? fetch : null) {
  if (!enderecoPreenchido(e) || !fetchFn) return null;
  const tentativas = [
    [e.logradouro && e.numero ? `${e.logradouro}, ${e.numero}` : e.logradouro, e.bairro, e.cidade, e.uf, "Brasil"],
    [e.logradouro, e.cidade, e.uf, "Brasil"],
    [e.bairro, e.cidade, e.uf, "Brasil"],
  ].map((p) => p.filter((x) => String(x || "").trim()).join(", "));
  for (let i = 0; i < tentativas.length; i++) {
    try {
      const r = await fetchFn(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(tentativas[i])}`, { headers: { Accept: "application/json", "Accept-Language": "pt-BR" } });
      const j = r.ok ? await r.json() : [];
      if (j && j[0]) return { lat: Number(j[0].lat), lng: Number(j[0].lon), precisao: i === 0 ? "endereco" : i === 1 ? "rua" : "bairro" };
    } catch { /* tenta a próxima */ }
  }
  return null;
}

// Distância casa → projeto (km em linha reta; o trajeto real é maior). null quando falta coordenada.
export function distanciaAteProjeto(geo, projectId) {
  const base = coordsDe(projectId);
  if (!geo || !base) return null;
  return distanciaKm(base, geo);
}

// Rota de carro casa → projeto (07/11/2026): a linha reta subestimava (ex.: 4,2 km em linha reta = 8,8 km de carro).
// OSRM (malha viária do OpenStreetMap, gratuito, sem chave). Devolve { km, min } ou null (sem rede/sem rota).
export const ROTA_VERSAO = 1;
export async function rotaAteProjeto(geo, projectId, fetchFn = typeof fetch !== "undefined" ? fetch : null) {
  const base = coordsDe(projectId);
  if (!geo || !base || !fetchFn || typeof geo.lat !== "number") return null;
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${geo.lng},${geo.lat};${base.lng},${base.lat}?overview=false&alternatives=false`;
    const r = await fetchFn(url, { headers: { Accept: "application/json" } });
    const j = r.ok ? await r.json() : null;
    const rota = j && j.code === "Ok" && j.routes && j.routes[0];
    if (!rota || !(rota.distance > 0)) return null;
    return { km: Math.round(rota.distance / 100) / 10, min: Math.max(1, Math.round(rota.duration / 60)) };
  } catch { return null; }
}

// Colaborador com localização mas sem rota calculada (cadastros anteriores a 07/11 ou rota que falhou).
export const precisaRota = (c) => !!(c && c.geo && typeof c.geo.lat === "number" && c.rotaVersao !== ROTA_VERSAO);

// Texto para a tela e relatórios: rota quando existe; senão a linha reta, dita como tal.
export function textoDistancia(c, { comLinhaReta = true } = {}) {
  if (c && typeof c.rotaKm === "number") return `${fmtKm(c.rotaKm)} de carro${typeof c.rotaMin === "number" ? ` · ~${c.rotaMin} min` : ""}${comLinhaReta && typeof c.distanciaKm === "number" ? ` (${fmtKm(c.distanciaKm)} em linha reta)` : ""}`;
  if (c && typeof c.distanciaKm === "number") return `${fmtKm(c.distanciaKm)} em linha reta`;
  return "";
}
// Distância "oficial" para o relatório: rota quando houver.
export const kmOficial = (c) => (c && typeof c.rotaKm === "number" ? c.rotaKm : c && typeof c.distanciaKm === "number" ? c.distanciaKm : null);

// Aplica no colaborador ao salvar: geocodifica só quando o endereço mudou (ou nunca foi geocodificado) e calcula a rota.
export async function aplicarEnderecoAoSalvar(colab, projectId, fetchFn) {
  const e = colab.endereco || null;
  if (!enderecoPreenchido(e)) return { ...colab, endereco: e || null, geo: null, distanciaKm: null, rotaKm: null, rotaMin: null, enderecoChave: "" };
  const chave = chaveEndereco(e);
  if (colab.enderecoChave === chave && colab.geo && typeof colab.distanciaKm === "number") {
    if (!precisaRota(colab)) return colab;
    return { ...colab, ...(await camposRota(colab.geo, projectId, fetchFn)) };
  }
  const geo = await geocodificarEndereco(e, fetchFn);
  const km = distanciaAteProjeto(geo, projectId);
  return { ...colab, endereco: e, enderecoChave: chave, geo: geo || null, distanciaKm: typeof km === "number" ? km : null, geoEm: new Date().toISOString(), ...(await camposRota(geo, projectId, fetchFn)) };
}
async function camposRota(geo, projectId, fetchFn) {
  const r = await rotaAteProjeto(geo, projectId, fetchFn);
  return r ? { rotaKm: r.km, rotaMin: r.min, rotaVersao: ROTA_VERSAO, rotaEm: new Date().toISOString() } : { rotaKm: null, rotaMin: null };
}

export { UFS };

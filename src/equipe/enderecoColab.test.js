// Endereço do colaborador (06/11/2026): máscara para o cliente, geocodificação e distância até o projeto.
import { enderecoTexto, enderecoMascarado, chaveEndereco, fmtKm, buscarCep, geocodificarEndereco, distanciaAteProjeto, aplicarEnderecoAoSalvar, enderecoPreenchido, rotaAteProjeto, precisaRota, textoDistancia, kmOficial, ROTA_VERSAO } from "./enderecoColab";
import { mapsDirUrl, mapsEmbedUrl, COORDS } from "../entorno/locais";
import { gerarMapaEquipeHTML } from "../relatorios/mapaEquipeRelatorio";
import { textoCompartilhar, whatsappUrl } from "../cliente/Localizacao";

const end = { cep: "04221060", logradouro: "Rua Roberto Koch", numero: "363", complemento: "fundos", bairro: "Vila Independência", cidade: "São Paulo", uf: "SP" };

test("texto completo (interno) × mascarado (cliente): sem número, sem complemento, CEP com asteriscos", () => {
  expect(enderecoTexto(end)).toBe("Rua Roberto Koch, 363 — fundos · Vila Independência, São Paulo/SP · CEP 04221-060");
  expect(enderecoMascarado(end)).toBe("Rua Roberto Koch, *** · Vila Independência, São Paulo/SP · CEP *****-***");
  expect(enderecoMascarado(end)).not.toMatch(/363|fundos|04221/);
  expect(enderecoPreenchido({ logradouro: "", cidade: "x" })).toBe(false);
  expect(chaveEndereco(end)).toBe(chaveEndereco({ ...end, complemento: "outro" })); // complemento não muda a geocodificação
  expect([fmtKm(0.4), fmtKm(12.34), fmtKm(null)]).toEqual(["400 m", "12,3 km", "—"]);
});

test("ViaCEP preenche rua/bairro/cidade/UF; Nominatim devolve lat/lng (com fallback para a rua)", async () => {
  const fetchCep = async () => ({ ok: true, json: async () => ({ logradouro: "Rua Roberto Koch", bairro: "Vila Independência", localidade: "São Paulo", uf: "SP" }) });
  expect(await buscarCep("04221-060", fetchCep)).toMatchObject({ cep: "04221060", logradouro: "Rua Roberto Koch", uf: "SP" });
  expect(await buscarCep("123", fetchCep)).toBeNull();
  let n = 0;
  const fetchGeo = async (url) => { n++; return { ok: true, json: async () => (n === 1 ? [] : [{ lat: "-23.5927", lon: "-46.5915" }]) }; };
  const g = await geocodificarEndereco(end, fetchGeo);
  expect(g).toMatchObject({ lat: -23.5927, lng: -46.5915, precisao: "rua" });
});

test("distância casa → projeto e aplicação ao salvar (só geocodifica quando o endereço muda)", async () => {
  const geo = { lat: -23.5846, lng: -46.598 }; // Barão de Resende
  const km = distanciaAteProjeto(geo, "P260A");
  expect(km).toBeGreaterThan(0.5); expect(km).toBeLessThan(2);
  expect(distanciaAteProjeto(geo, "PXXX")).toBeNull();
  let chamadas = 0;
  const fetchGeo = async (url) => url.includes("router.project-osrm.org") ? { ok: true, json: async () => ({ code: "Ok", routes: [{ distance: 2480, duration: 410 }] }) } : (chamadas++, { ok: true, json: async () => [{ lat: "-23.5846", lon: "-46.598" }] });
  const c1 = await aplicarEnderecoAoSalvar({ id: "c1", nome: "Ana", endereco: end }, "P260A", fetchGeo);
  expect(c1.distanciaKm).toBeGreaterThan(0.5); expect(c1.geo).toEqual({ lat: -23.5846, lng: -46.598, precisao: "endereco" }); expect(chamadas).toBe(1);
  expect(c1).toMatchObject({ rotaKm: 2.5, rotaMin: 7, rotaVersao: ROTA_VERSAO });
  const c2 = await aplicarEnderecoAoSalvar(c1, "P260A", fetchGeo);
  expect(chamadas).toBe(1); expect(c2).toBe(c1); // mesmo endereço: não refaz
  const c3 = await aplicarEnderecoAoSalvar({ ...c1, endereco: { ...end, numero: "500" } }, "P260A", fetchGeo);
  expect(chamadas).toBe(2); expect(c3.enderecoChave).not.toBe(c1.enderecoChave);
  const c4 = await aplicarEnderecoAoSalvar({ id: "c4", nome: "Bia", endereco: null }, "P260A", fetchGeo);
  expect(c4).toMatchObject({ geo: null, distanciaKm: null });
});

test("links do Maps: Como chegar parte da posição atual; embed em satélite; todos os 12 parques têm coordenada", () => {
  expect(Object.keys(COORDS).filter((p) => p !== "P939").sort()).toEqual(["P260A", "P260B", "P260C", "P311A", "P311B", "P505", "P601", "P602", "P604", "P605", "P606", "P607"]); // P939 = MokPat (11/11/2026), coberto em mokpat.test.js
  expect(mapsDirUrl("P604")).toBe("https://www.google.com/maps/dir/?api=1&destination=-23.1625984,-46.9951726&travelmode=driving");
  expect(mapsEmbedUrl("P604")).toMatch(/t=k/);
  expect(mapsDirUrl("PXXX")).toBe("");
  const t = textoCompartilhar("P604", "P604 — Golgi Jundiaí");
  expect(t.split("\n")[0]).toBe("https://moklog-checktest.vercel.app/local/P604"); // link primeiro → prévia com o logo da Moked em cima
  expect(t).toMatch(/Compartilhamos o endereço para sua chegada tranquila no Golgi Jundiaí \(P604\) — projeto com consultoria da Moked\./);
  expect(t).toMatch(/📍 Av\. Odila Chaves Rodrigues, 1200/);
  expect(t).toMatch(/Como chegar: https:\/\/www\.google\.com\/maps\/dir/);
  expect(whatsappUrl(t)).toMatch(/^https:\/\/wa\.me\/\?text=https/);
  const { paginaHTML } = require("../../api/local");
  const html = paginaHTML("P601");
  expect(html).toMatch(/<meta property="og:image" content="https:\/\/moklog-checktest\.vercel\.app\/moked\/logo-moked\.png">/);
  expect(html).toMatch(/og:title" content="Golgi Cajamar — P601 · consultoria Moked"/);
  expect(html).toMatch(/Como chegar/);
});

test("Mapa de Equipe (relatório do cliente) mostra a distância e o endereço mascarado, nunca o número/CEP", () => {
  const equipe = { colaboradores: [{ id: "a", nome: "Ana Lima", cargo: "Vigilante", status: "ativo", dataContratacao: "2024-01-10", ultimaReciclagem: "2026-01-10", historico: [], endereco: end, distanciaKm: 3.1, rotaKm: 7.8, rotaMin: 14 }] };
  const html = gerarMapaEquipeHTML({ project: { id: "P260A", name: "Jatinox A" }, equipe, hoje: "2026-11-06" });
  expect(html).toMatch(/Reside a <b>7,8 km<\/b> do projeto \(de carro, ~14 min\) · Rua Roberto Koch, \*\*\* · Vila Independência, São Paulo\/SP · CEP \*\*\*\*\*-\*\*\*/);
  // o logo oficial é um SVG embutido (números nas curvas): a checagem de privacidade vale para o conteúdo, não para a imagem
  expect(html.replace(/src="data:image\/[^"]+"/g, 'src=""')).not.toMatch(/363|04221/);
});

test("rota de carro (07/11): OSRM com origem casa e destino projeto; linha reta só como referência; falha de rede não quebra", async () => {
  // Nilton (P311A): 4,2 km em linha reta, 8,8 km / 11 min de carro
  const urls = [];
  const fetchOk = async (url) => { urls.push(url); return { ok: true, json: async () => ({ code: "Ok", routes: [{ distance: 8812, duration: 660 }] }) }; };
  const r = await rotaAteProjeto({ lat: -25.31, lng: -49.09 }, "P311A", fetchOk);
  expect(r).toEqual({ km: 8.8, min: 11 });
  expect(urls[0]).toBe("https://router.project-osrm.org/route/v1/driving/-49.09,-25.31;-49.0588546,-25.3491912?overview=false&alternatives=false");
  expect(await rotaAteProjeto({ lat: -25.31, lng: -49.09 }, "P311A", async () => { throw new Error("rede"); })).toBeNull();
  expect(await rotaAteProjeto({ lat: -25.31, lng: -49.09 }, "P311A", async () => ({ ok: true, json: async () => ({ code: "NoRoute", routes: [] }) }))).toBeNull();
  const nilton = { geo: { lat: -25.31, lng: -49.09 }, distanciaKm: 4.2, rotaKm: 8.8, rotaMin: 11, rotaVersao: ROTA_VERSAO };
  expect(textoDistancia(nilton)).toBe("8,8 km de carro · ~11 min (4,2 km em linha reta)");
  expect(textoDistancia({ distanciaKm: 4.2 })).toBe("4,2 km em linha reta");
  expect([kmOficial(nilton), kmOficial({ distanciaKm: 4.2 }), kmOficial({})]).toEqual([8.8, 4.2, null]);
  // cadastro antigo (só linha reta) precisa de rota; o salvar sem mudar endereço calcula só a rota
  const antigo = { endereco: end, enderecoChave: chaveEndereco(end), geo: { lat: -23.58, lng: -46.59 }, distanciaKm: 1.2 };
  expect(precisaRota(antigo)).toBe(true); expect(precisaRota(nilton)).toBe(false); expect(precisaRota({ distanciaKm: 3 })).toBe(false);
  const atualizado = await aplicarEnderecoAoSalvar(antigo, "P260A", fetchOk);
  expect(atualizado).toMatchObject({ distanciaKm: 1.2, rotaKm: 8.8, rotaMin: 11, rotaVersao: ROTA_VERSAO });
});

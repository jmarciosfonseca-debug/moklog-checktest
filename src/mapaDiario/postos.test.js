import { puxarEquipe, projetoPuxaEquipe, defDoPosto, postosDoProjeto } from "./postos";
import { novoMapa } from "./modelo";

const colabs = [
  { id: "l1", nome: "Matheus L.", cargo: "VSPP Líder", equipeLiderId: null },
  { id: "c1", nome: "Monica C.", cargo: "Vig CCO", equipeLiderId: "l1" },
  { id: "d1", nome: "Davi D.", cargo: "CDA", equipeLiderId: "l1" },
  { id: "a1", nome: "Ana A.", cargo: "VSPP Apoio", equipeLiderId: "l1" },
  { id: "a2", nome: "Aline B.", cargo: "VSPP Apoio", equipeLiderId: "l1", emFerias: true },
  { id: "l2", nome: "Jorge L.", cargo: "VSPP Líder", equipeLiderId: null },
  { id: "c2", nome: "Carla C.", cargo: "Vig CCO", equipeLiderId: "l2" },
  { id: "x1", nome: "Sem Equipe", cargo: "CDA", equipeLiderId: null },
];
const mapa601 = () => novoMapa({ projetoId: "P601", data: "2026-10-12", turno: "D" });

test("só os projetos 12x36 puxam a equipe; P505 e P260A/B/C não", () => {
  ["P601", "P602", "P604", "P605", "P606", "P607", "P311A", "P311B"].forEach((p) => expect(projetoPuxaEquipe(p)).toBe(true));
  ["P505", "P260A", "P260B", "P260C"].forEach((p) => expect(projetoPuxaEquipe(p)).toBe(false));
});
test("escolher o líder puxa quem ele montou, por cargo, sem repetir e sem quem está de férias", () => {
  const m = mapa601();
  const r = puxarEquipe({ postos: m.postos, lider: colabs[0], colabs, pid: "P601", turno: "D" });
  const por = Object.fromEntries(r.postos.map((p) => [p.rotulo, p.pessoaNome]));
  expect(por["CCO"]).toBe("Monica C.");
  expect(por["CDA"]).toBe("Davi D.");
  expect(por["VSPP Apoio"]).toBe("Ana A.");
  expect(por["VSPP P1"]).toBe(""); // Aline está de férias: não entra
  expect(r.puxados).toBe(3);
  expect(r.semEquipe).toBe(false);
});
test("trocar de líder troca a equipe; exceção e nome digitado não são mexidos", () => {
  const m = mapa601();
  const com = puxarEquipe({ postos: m.postos, lider: colabs[0], colabs, pid: "P601", turno: "D" }).postos;
  const edit = com.map((p) => (p.rotulo === "CDA" ? { ...p, situacao: "falta" } : p.rotulo === "VSPP Apoio" ? { ...p, pessoaNome: "Fulano da Base", detalhe: { livre: true } } : p));
  const r = puxarEquipe({ postos: edit, lider: colabs[5], colabs, pid: "P601", turno: "D" });
  const por = Object.fromEntries(r.postos.map((p) => [p.rotulo, p]));
  expect(por["CCO"].pessoaNome).toBe("Carla C.");
  expect(por["CDA"].pessoaNome).toBe("Davi D."); // em falta: preservado
  expect(por["VSPP Apoio"].pessoaNome).toBe("Fulano da Base");
});
test("líder sem equipe montada: não mexe ao abrir; ao trocar manualmente limpa a equipe do líder anterior", () => {
  const m = mapa601();
  const base = puxarEquipe({ postos: m.postos, lider: colabs[0], colabs, pid: "P601", turno: "D" }).postos;
  const semAbrir = puxarEquipe({ postos: base, lider: colabs[7], colabs, pid: "P601", turno: "D" });
  expect(semAbrir.semEquipe).toBe(true);
  expect(semAbrir.postos).toBe(base);
  const limpo = puxarEquipe({ postos: base, lider: colabs[7], colabs, pid: "P601", turno: "D", limparSeSemEquipe: true });
  expect(limpo.postos.filter((p) => !p.lider).every((p) => !p.pessoaNome)).toBe(true);
});
test("P607: sem posto de líder; a ronda (Honda) é quem encabeça", () => {
  const d = postosDoProjeto("P607", "D");
  expect(d.map((p) => p.rotulo)).toEqual(["Vigilante Honda", "AGP CCO", "Vigilante Pista", "AGP Portaria"]);
  expect(d.filter((p) => p.lider).map((p) => p.rotulo)).toEqual(["Vigilante Honda"]);
  expect(defDoPosto("P311B", "D", "P2").rotulo).toBe("P2 · Vigilante Honda"); // rótulo antigo ainda é reconhecido
});
test("12x36: o mapa novo aproveita as pessoas do mapa base; 4x2 não repete ninguém", () => {
  const base = { data: "2026-10-10", turno: "D", postos: [{ rotulo: "Líder", pessoaId: "l1", pessoaNome: "Matheus L." }, { rotulo: "CCO", pessoaId: "c1", pessoaNome: "Monica C." }] };
  const m = novoMapa({ projetoId: "P601", data: "2026-10-12", turno: "D", base });
  expect(m.postos.find((p) => p.rotulo === "Líder").pessoaNome).toBe("Matheus L.");
  expect(m.preenchidoDe).toEqual({ data: "2026-10-10", turno: "D" });
  const b505 = { data: "2026-10-10", turno: "D", postos: [{ rotulo: "VSPP Líder", pessoaId: "l1", pessoaNome: "Matheus L." }] };
  const n = novoMapa({ projetoId: "P505", data: "2026-10-12", turno: "D", base: b505 });
  expect(n.postos.every((p) => !p.pessoaNome)).toBe(true);
  expect(n.preenchidoDe).toBeNull();
});

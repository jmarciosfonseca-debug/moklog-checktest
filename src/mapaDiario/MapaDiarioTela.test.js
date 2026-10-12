import React, { act } from "react";
import { createRoot } from "react-dom/client";
import MapaDiarioTela from "./MapaDiarioTela";

global.IS_REACT_ACT_ENVIRONMENT = true;
jest.mock("firebase/app", () => ({ getApps: () => [] }));
jest.mock("firebase/firestore", () => ({}));
jest.mock("../fireGuard", () => ({ setDoc: jest.fn(() => { throw new Error("Gravação real proibida neste teste"); }) }));

const AGORA = new Date("2026-10-11T09:00:00-03:00"); // domingo, diurno já em andamento
const colabs = [
  { id: "a", nome: "Luiz D.", cargo: "Vigilante Líder", turno: "Diurno", emFerias: false },
  { id: "b", nome: "Marta A.", cargo: "Vig CCO", turno: "Diurno", emFerias: false },
  { id: "c", nome: "Ari A.", cargo: "Vigilante Ronda", turno: "Diurno", emFerias: false },
  { id: "d", nome: "Joao V.", cargo: "Vigilante Ronda", turno: "Folguista", emFerias: false },
];
const BASE601 = { postos: [["Líder", "a"], ["VSPP Apoio", "b"], ["VSPP Ronda", "c"], ["CCO", "d"], ["CDA", "a2"]].map(([rotulo, id]) => ({ rotulo, pessoaId: id, pessoaNome: id })), veiculos: [] };
let host, root, io, salvos;
const montar = async (extraTodo = {}) => {
  const { __pid, __semObrig, ...extra } = extraTodo;
  salvos = [];
  io = {
    loadColaboradores: jest.fn(async () => colabs),
    loadMapa: jest.fn(async () => null),
    loadUltimoMapa: jest.fn(async () => ({ postos: [{ rotulo: "L1", pessoaId: "a", pessoaNome: "Luiz D." }, { rotulo: "P1", pessoaId: "b", pessoaNome: "Marta A." }, { rotulo: "P2", pessoaId: "c", pessoaNome: "Ari A." }], veiculos: [{ id: "m", rotulo: "Moto", kmAtual: 1200 }] })),
    loadEquipamentos: jest.fn(async () => ({ armamento: [{ id: "a1", identificacao: "Arma 01", calibre: ".38", nSerie: "123", status: "ok" }], municao: [{ id: "m1", identificacao: "Munição .38", qtd: 24, status: "ok" }] })),
    loadUltimaVisita: jest.fn(async () => ({ ultimaData: "2026-10-09", supervisor: "Marcio", turno: "Diurno" })),
    saveMapa: jest.fn(async (m) => { salvos.push(m); return { ...m, atualizadoEm: "x" }; }),
    ...extra,
  };
  await act(async () => root.render(<MapaDiarioTela project={{ id: __pid || "P311B", name: "Mega Itajaí B" }} dark onBack={() => {}} io={io} agoraFn={() => AGORA} />));
  await act(async () => { await Promise.resolve(); });
  if (!__semObrig) await obrigatorios();
};
// km da moto, resumo e "houve visita?" agora são obrigatórios: os testes que concluem já abrem com eles preenchidos.
const obrigatorios = async () => {
  const km = host.querySelector('input[aria-label^="Km atual"]');
  if (km) await digitar(km, "27900");
  const r = host.querySelector('textarea[aria-label="Resumo da passagem"]');
  if (r && !r.value) await digitar(r, "Sem alteração");
  const nao = [...host.querySelectorAll("button")].find((b) => b.textContent.trim() === "Não houve");
  if (nao) await act(async () => nao.click());
};
beforeEach(() => { jest.useFakeTimers("modern"); jest.setSystemTime(AGORA); host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); jest.useRealTimers(); });
const q = (sel) => host.querySelector(sel);
const clicar = async (el) => act(async () => el.click());
const abrirExc = async (rot) => clicar(q(`button[aria-label="Exceção do posto ${rot}"]`));
const botao = (txt) => [...host.querySelectorAll("button")].find((b) => b.textContent.trim() === txt);
const digitar = async (el, v) => act(async () => { const proto = el.tagName === "SELECT" ? HTMLSelectElement.prototype : el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v); el.dispatchEvent(new Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); });

test("abre pré-preenchido do último mapa, com cabeçalho pela data e supervisão da CCO", async () => {
  await montar();
  expect(host.textContent).toContain("Domingo, 11/10/2026");
  expect(host.textContent).toContain("Diurno 06h00–18h00");
  expect(q('select[aria-label="Quem está no posto L1 · Vigilante Líder"]').value).toBe("a");
  expect(q('select[aria-label="Quem está no posto P2 · Vigilante Honda"]').value).toBe("c");
  expect(host.textContent).toContain("09/10/2026 — Marcio (Diurno)");
  expect(host.textContent).toContain("anterior 1200");
  expect(q('input[type="checkbox"]').checked).toBe(true); // material sem alteração já marcado
  expect(host.textContent).toContain("Mapa pendente"); // 09:00, 3 h depois de assumir, sem envio
});
test("concluir só grava depois de validar; atraso exige hora ou minutos", async () => {
  await montar();
  await abrirExc("L1 · Vigilante Líder");
  await clicar(botao("Atraso")); // primeiro posto (L1)
  await clicar(botao("Concluir mapa"));
  expect(q('[role="alert"]').textContent).toContain("informe a hora de chegada ou os minutos");
  expect(io.saveMapa).not.toHaveBeenCalled();
  await digitar(q('input[aria-label="Minutos de atraso"]'), "15");
  await clicar(botao("Concluir mapa"));
  expect(io.saveMapa).toHaveBeenCalledTimes(1);
  const m = salvos[0];
  expect(m.status).toBe("enviado");
  expect(m.enviadoEm).toBe(AGORA.toISOString());
  expect(m.postos[0]).toMatchObject({ situacao: "atraso", pessoaNome: "Luiz D." });
});
test("só libera o WhatsApp depois de gravar; se a gravação falhar, não libera", async () => {
  await montar({ saveMapa: jest.fn(async () => { throw new Error("offline"); }) });
  await clicar(botao("Concluir mapa"));
  expect(host.textContent).not.toContain("Abrir WhatsApp");
  expect(q('[role="alert"]').textContent).toContain("Não gravou");
});
test("depois de gravar mostra o texto e o link do WhatsApp", async () => {
  await montar();
  await clicar(botao("Concluir mapa"));
  expect(host.textContent).toContain("Mapa gravado");
  const t = q('pre[aria-label="Texto do mapa"]').textContent;
  expect(t).toContain("*MAPA DE EQUIPE*");
  expect(t).toContain("✅ *L1 · Vigilante Líder:* Luiz D.");
  expect(t).toContain("Sem ocorrências");
  expect(q('a[href^="https://wa.me/?text="]')).not.toBeNull();
});
test("troca não é FT e exige 'no lugar de quem'", async () => {
  await montar();
  await abrirExc("P1 · Vigilante CCO");
  await clicar(botao("Troca")); // P1
  await clicar(botao("Concluir mapa"));
  expect(q('[role="alert"]').textContent).toContain("P1 · Vigilante CCO: troca no lugar de quem?");
  await digitar(q('select[aria-label="Troca no lugar de quem"]'), "d");
  await clicar(botao("Concluir mapa"));
  const t = q('pre[aria-label="Texto do mapa"]').textContent;
  expect(t).toContain("🔁 *P1 · Vigilante CCO:* Marta A. — *TROCA DE PLANTÃO*, no lugar de Joao V.");
  expect(t).not.toContain("FT (folga trabalhada)");
});
test("autosalva o rascunho depois de alterar", async () => {
  await montar();
  await digitar(q('textarea[aria-label="Resumo da passagem"]'), "Preleção feita");
  expect(io.saveMapa).not.toHaveBeenCalled();
  await act(async () => { jest.advanceTimersByTime(1600); });
  expect(io.saveMapa).toHaveBeenCalledTimes(1);
  expect(salvos[0].resumo).toBe("Preleção feita");
  expect(salvos[0].status).toBe("rascunho");
});
test("erro ao abrir não destrói nada e avisa", async () => {
  await montar({ loadColaboradores: jest.fn(async () => { throw new Error("x"); }) });
  expect(q('[role="alert"]').textContent).toContain("Não consegui abrir o mapa agora");
  expect(io.saveMapa).not.toHaveBeenCalled();
});

test("material: botão Conferir expande a lista do cadastro e anomalia exige observação", async () => {
  await montar();
  expect(host.textContent).toContain("Sem alteração · tudo disponível");
  expect(host.textContent).not.toContain("Arma 01");
  expect(host.textContent).toContain("Lista do projeto: Armamento 1 · Munição 1");
  await clicar(q('button[aria-label="Conferir material"]'));
  expect(host.textContent).toContain("Arma 01");
  expect(host.textContent).toContain(".38 · nº 123");
  await clicar(q('button[aria-label="Arma 01: Anomalia"]'));
  expect(host.textContent).toContain("1 com alteração");
  await clicar(botao("Concluir mapa"));
  expect(q('[role="alert"]').textContent).toContain("Material — Arma 01: descreva a anomalia");
  expect(io.saveMapa).not.toHaveBeenCalled();
  await digitar(q('input[aria-label="Observação: Arma 01"]'), "Coronha trincada");
  await clicar(botao("Concluir mapa"));
  expect(io.saveMapa).toHaveBeenCalledTimes(1);
  const t = q('pre[aria-label="Texto do mapa"]').textContent;
  expect(t).toContain("• Arma 01 (.38 · nº 123) — *ANOMALIA:* Coronha trincada");
  expect(salvos[0].material.excecoes[0]).toMatchObject({ situacao: "anomalia", obs: "Coronha trincada" });
});
test("material: item novo fora do cadastro e voltar para Disponível limpa a exceção", async () => {
  await montar();
  await clicar(q('button[aria-label="Conferir material"]'));
  await clicar(botao("+ Outro item"));
  expect(q('input[aria-label="Nome do item"]')).not.toBeNull();
  await clicar(q('button[aria-label="Remover item"]'));
  expect(host.textContent).toContain("Sem alteração · tudo disponível");
  await clicar(q('button[aria-label="Munição .38: Indisponível"]'));
  expect(host.textContent).toContain("1 com alteração");
  await clicar(q('button[aria-label="Munição .38: Disponível"]'));
  expect(host.textContent).toContain("Sem alteração · tudo disponível");
});
test("sem cadastro de equipamentos a tela avisa e ainda deixa registrar anomalia", async () => {
  await montar({ loadEquipamentos: jest.fn(async () => null) });
  await clicar(q('button[aria-label="Conferir material"]'));
  expect(host.textContent).toContain("Lista do projeto: Armamento 2 · Munição 1 · Placas balísticas 4");
  expect(q('button[aria-label="Revólver .38 1 de 2: Anomalia"]')).not.toBeNull();
  expect(botao("+ Outro item")).toBeDefined();
});

test("tudo ok: conclui sem observação e o texto diz o que foi conferido; sem cadastro avisa", async () => {
  await montar();
  await clicar(botao("Concluir mapa"));
  expect(q('pre[aria-label="Texto do mapa"]').textContent).toContain("Sem alteração — conferido e disponível (Armamento 1 · Munição 1 · Placas balísticas 4)");
  expect(salvos[0].material.conferidos).toBe("Armamento 1 · Munição 1 · Placas balísticas 4");
});
test("sem cadastro, a lista de referência do projeto (base do Codex) aparece no cabeçalho do material", async () => {
  await montar({ loadEquipamentos: jest.fn(async () => null) });
  expect(host.textContent).toContain("Lista do projeto: Armamento 2 · Munição 1 · Placas balísticas 4");
});

test("P601: placas sem quantidade na base — líder informa, não conclui sem, e vai no WhatsApp", async () => {
  await montar({ __pid: "P601", loadEquipamentos: jest.fn(async () => null), loadUltimoMapa: jest.fn(async () => BASE601) });
  expect(q('input[aria-label="Quantidade: Par de placas balísticas"]')).not.toBeNull();
  await clicar(botao("Concluir mapa"));
  expect(q('[role="alert"]').textContent).toContain("Material — informe a quantidade de Par de placas balísticas");
  expect(io.saveMapa).not.toHaveBeenCalled();
  await digitar(q('input[aria-label="Quantidade: Par de placas balísticas"]'), "3");
  await clicar(botao("Concluir mapa"));
  expect(q('pre[aria-label="Texto do mapa"]').textContent).toContain("Quantidades conferidas: Par de placas balísticas 3");
  expect(salvos[0].material.quantidades["placas:Par de placas balísticas"]).toEqual({ nome: "Par de placas balísticas", qtd: "3" });
});
test("P601: a quantidade informada abre preenchida no próximo mapa", async () => {
  await montar({ __pid: "P601", loadEquipamentos: jest.fn(async () => null), loadUltimoMapa: jest.fn(async () => ({ postos: BASE601.postos, veiculos: [], material: { quantidades: { "placas:Par de placas balísticas": { nome: "Par de placas balísticas", qtd: "3" } } } })) });
  expect(q('input[aria-label="Quantidade: Par de placas balísticas"]').value).toBe("3");
});
test("P311B: sem item de quantidade desconhecida não aparece o bloco de contagem", async () => {
  await montar();
  expect(host.textContent).not.toContain("CONTE E INFORME A QUANTIDADE");
});

const colabsEq = colabs.map((c) => ({ ...c, equipeLiderId: c.id === "b" || c.id === "c" ? "a" : null }));
test("12x36: escolher o líder puxa a equipe montada em Equipes, automaticamente", async () => {
  await montar({ loadUltimoMapa: jest.fn(async () => null), loadColaboradores: jest.fn(async () => colabsEq) });
  expect(q('select[aria-label="Quem está no posto P1 · Vigilante CCO"]').value).toBe("");
  await digitar(q('select[aria-label="Quem está no posto L1 · Vigilante Líder"]'), "a");
  expect(q('select[aria-label="Quem está no posto P1 · Vigilante CCO"]').value).toBe("b");
  expect(q('select[aria-label="Quem está no posto P2 · Vigilante Honda"]').value).toBe("c");
  expect(host.textContent).toContain("Equipe de Luiz D. puxada da montagem em Equipes (2 postos)");
});
test("12x36: líder sem equipe montada avisa e deixa escolher à mão", async () => {
  await montar({ loadUltimoMapa: jest.fn(async () => null) });
  await digitar(q('select[aria-label="Quem está no posto L1 · Vigilante Líder"]'), "a");
  expect(host.textContent).toContain("Luiz D. ainda não tem equipe montada em Equipes");
});
test("12x36: a base é buscada só de turma par (mesma turma)", async () => {
  await montar();
  expect(io.loadUltimoMapa).toHaveBeenCalledWith("P311B", "D", "2026-10-11", { gapPar: true });
});
test("P505 (4x2): não puxa nem repete ninguém e avisa o líder", async () => {
  await montar({ __pid: "P505", loadEquipamentos: jest.fn(async () => null) });
  expect(host.textContent).toContain("a equipe muda a cada plantão e não é puxada sozinha");
  expect(q('select[aria-label="Quem está no posto VSPP Líder"]').value).toBe("");
  expect(io.loadUltimoMapa).toHaveBeenCalledWith("P505", "D", "2026-10-11", { gapPar: false });
});

test("concluir: grava o mapa e só depois lança Falta/FT/Atraso na ficha, mostrando o resumo", async () => {
  const ordem = [];
  await montar({
    saveMapa: jest.fn(async (m) => { ordem.push("mapa"); salvos.push(m); return { ...m, atualizadoEm: "x" }; }),
    lancarNaFicha: jest.fn(async () => { ordem.push("ficha"); return { removidos: 0 }; }),
  });
  await abrirExc("L1 · Vigilante Líder");
  await clicar(botao("Falta"));
  await clicar(botao("Concluir mapa"));
  expect(ordem).toEqual(["mapa", "ficha"]);
  expect(io.lancarNaFicha.mock.calls[0][0].postos[0]).toMatchObject({ situacao: "falta" });
  expect(host.textContent).toContain("Ficha atualizada: 1 falta.");
});
test("se a ficha falhar, o mapa e o WhatsApp continuam liberados e o líder é avisado", async () => {
  await montar({ lancarNaFicha: jest.fn(async () => { throw new Error("Sessão expirada"); }) });
  await abrirExc("L1 · Vigilante Líder");
  await clicar(botao("Falta"));
  await clicar(botao("Concluir mapa"));
  expect(q('pre[aria-label="Texto do mapa"]')).not.toBeNull();
  expect(host.textContent).toContain("Falta/FT/Atraso NÃO entraram na ficha (Sessão expirada)");
});

test("rascunho reaberto: não troca o que o líder já escolheu; 'Puxar de novo' preenche só o que falta depois de montar a equipe", async () => {
  const existente = { id: "P311B_2026-10-11_D", projetoId: "P311B", data: "2026-10-11", turno: "D", status: "rascunho", horario: null, material: { semAlteracao: true, obs: "", excecoes: [] }, veiculos: [], resumo: "", observacoes: "",
    postos: [{ id: "p1", rotulo: "L1 · Vigilante Líder", lider: true, pessoaId: "a", pessoaNome: "Luiz D.", situacao: "presente", detalhe: {}, obs: "" }, { id: "p2", rotulo: "P1 · Vigilante CCO", pessoaId: "d", pessoaNome: "Joao V.", situacao: "presente", detalhe: {}, obs: "" }, { id: "p3", rotulo: "P2 · Vigilante Honda", pessoaId: "", pessoaNome: "", situacao: "presente", detalhe: {}, obs: "" }] };
  let lista = colabs; // ainda sem equipe montada
  await montar({ loadMapa: jest.fn(async () => existente), loadColaboradores: jest.fn(async () => lista) });
  expect(q('select[aria-label="Quem está no posto P1 · Vigilante CCO"]').value).toBe("d"); // escolha manual preservada
  expect(q('select[aria-label="Quem está no posto P2 · Vigilante Honda"]').value).toBe("");
  lista = colabsEq; // o líder montou a equipe em Equipe
  await clicar(botao("Puxar de novo"));
  expect(q('select[aria-label="Quem está no posto P1 · Vigilante CCO"]').value).toBe("d"); // continua o manual
  expect(q('select[aria-label="Quem está no posto P2 · Vigilante Honda"]').value).toBe("c"); // preencheu o vazio
});

test("resumo cita extra sem exceção marcada: avisa uma vez e só envia no segundo toque", async () => {
  await montar();
  await digitar(q('textarea[aria-label="Resumo da passagem"]'), "A vigilante Rosemeire está de extra.");
  await clicar(botao("Concluir mapa"));
  expect(q('[role="alert"]').textContent).toContain('O resumo fala de "extra"');
  expect(io.saveMapa).not.toHaveBeenCalled();
  await clicar(botao("Concluir mapa"));
  expect(io.saveMapa).toHaveBeenCalledTimes(1);
  expect(q('pre[aria-label="Texto do mapa"]')).not.toBeNull();
});

test("FT: pergunta 'Quem faltou?', o posto dele vira Falta e a falta vai para a ficha dele", async () => {
  await montar({ lancarNaFicha: jest.fn(async () => ({ removidos: 0 })) });
  await clicar(botao("+ Posto extra"));
  await digitar(q('select[aria-label="Quem está no posto Posto extra"]'), "d");
  await clicar(botao("FT"));
  expect(host.textContent).toContain("Quem faltou?");
  const sel = q('select[aria-label="Quem faltou (FT)"]');
  await clicar(botao("Concluir mapa"));
  expect(q('[role="alert"]').textContent).toContain("FT cobrindo falta de quem?");
  const optB = [...sel.options].find((o) => o.value.startsWith("p:") && o.textContent.includes("Marta A."));
  expect(optB).toBeTruthy();
  await digitar(sel, optB.value);
  expect(q('button[aria-label="Exceção do posto P1 · Vigilante CCO"]').textContent).toContain("Falta");
  await clicar(botao("Concluir mapa"));
  const t = q('pre[aria-label="Texto do mapa"]').textContent;
  expect(t).toContain("❌ *P1 · Vigilante CCO:* Marta A. — *FALTA*");
  expect(t).toContain("Joao V. — *FT* (folga trabalhada), cobrindo a falta de Marta A.");
  const postos = io.lancarNaFicha.mock.calls[0][0].postos;
  expect(postos.find((p) => p.rotulo === "P1 · Vigilante CCO")).toMatchObject({ situacao: "falta" });
  expect(postos.find((p) => p.rotulo === "Posto extra")).toMatchObject({ situacao: "ft", detalhe: { quemFaltouId: "b" } });
});

// ---- fechamento: obrigatórios, posto fixo x extra, Presente, Editar mapa ----
test("obrigatórios: sem km da moto, resumo e visita não conclui; preenchidos, conclui", async () => {
  await montar({ __semObrig: true });
  await clicar(botao("Concluir mapa"));
  const t = q('[role="alert"]').textContent;
  expect(t).toContain("Moto: informe a quilometragem atual");
  expect(t).toContain("Resumo da passagem");
  expect(t).toContain("Supervisão: informe se houve visita");
  expect(io.saveMapa).not.toHaveBeenCalled();
  await obrigatorios();
  await clicar(botao("Concluir mapa"));
  expect(io.saveMapa).toHaveBeenCalledTimes(1);
  expect(salvos[0].visita).toMatchObject({ houve: false });
});
test("posto fixo não tem X; só o posto extra pode ser removido", async () => {
  await montar();
  expect(q('button[aria-label^="Remover posto L1"]')).toBeNull();
  await clicar(botao("+ Posto extra"));
  const x = q('button[aria-label="Remover posto Posto extra"]');
  expect(x).toBeTruthy();
  await clicar(x);
  expect(q('button[aria-label="Remover posto Posto extra"]')).toBeNull();
});
test("com nome escolhido o botão do posto mostra 'Presente' (verde); falta muda o texto", async () => {
  await montar();
  expect(q('button[aria-label="Exceção do posto L1 · Vigilante Líder"]').textContent).toContain("Presente");
  await abrirExc("L1 · Vigilante Líder");
  await clicar(botao("Falta"));
  expect(q('button[aria-label="Exceção do posto L1 · Vigilante Líder"]').textContent).toContain("Falta");
});
test("Editar mapa: depois de concluir o formulário trava; Editar libera e conclui de novo", async () => {
  await montar();
  await clicar(botao("Concluir mapa"));
  expect(io.saveMapa).toHaveBeenCalledTimes(1);
  expect(q("fieldset").disabled).toBe(true);
  expect(botao("Concluir mapa")).toBeUndefined();
  await clicar(botao("Editar mapa"));
  expect(q("fieldset").disabled).toBe(false);
  await clicar(botao("Concluir mapa"));
  expect(io.saveMapa).toHaveBeenCalledTimes(2);
  expect(q("fieldset").disabled).toBe(true);
});
test("12x36: pessoa de fora da equipe → pergunta 'É FT?'; FT sozinho já escolhe quem faltou da equipe", async () => {
  await montar({ loadUltimoMapa: jest.fn(async () => null), loadColaboradores: jest.fn(async () => colabsEq) });
  await digitar(q('select[aria-label="Quem está no posto L1 · Vigilante Líder"]'), "a");
  await digitar(q('select[aria-label="Quem está no posto P2 · Vigilante Honda"]'), "d"); // Joao V. não é da equipe do Luiz
  expect(host.textContent).toContain("Joao V. não é da equipe de Luiz D.");
  await clicar(botao("É FT"));
  expect(host.textContent).toContain("Quem faltou?");
  const sel = q('select[aria-label="Quem faltou (FT)"]');
  expect(sel.value).toMatch(/^[cp]:/); // só sobrou Ari A. da equipe, fora do mapa → já vem escolhido
  expect(sel.selectedOptions[0].textContent).toContain("Ari A.");
  expect(host.textContent).not.toContain("não é da equipe de Luiz D.");
});
test("12x36: 'É da equipe' dispensa o aviso", async () => {
  await montar({ loadUltimoMapa: jest.fn(async () => null), loadColaboradores: jest.fn(async () => colabsEq) });
  await digitar(q('select[aria-label="Quem está no posto L1 · Vigilante Líder"]'), "a");
  await digitar(q('select[aria-label="Quem está no posto P2 · Vigilante Honda"]'), "d");
  await clicar(botao("É da equipe"));
  expect(host.textContent).not.toContain("não é da equipe de Luiz D.");
});
test("mapa enviado que perdeu um posto fixo: abre já em edição com o posto de volta e avisa", async () => {
  const gravado = { id: "P311B_2026-10-11_D", projetoId: "P311B", data: "2026-10-11", turno: "D", status: "enviado", enviadoEm: AGORA.toISOString(), veiculos: [{ id: "moto", rotulo: "Moto", kmAnterior: 1, kmAtual: 5 }], material: { semAlteracao: true, obs: "", excecoes: [] }, resumo: "ok", visita: { houve: false },
    postos: [{ id: "x1", rotulo: "P1 · Vigilante CCO", pessoaId: "b", pessoaNome: "Marta A.", situacao: "presente", detalhe: {}, obs: "" }, { id: "x2", rotulo: "P2 · Vigilante Honda", pessoaId: "c", pessoaNome: "Ari A.", situacao: "presente", detalhe: {}, obs: "" }] }; // sem o líder
  await montar({ loadMapa: jest.fn(async () => gravado), __semObrig: true });
  expect(q('select[aria-label="Quem está no posto L1 · Vigilante Líder"]')).toBeTruthy();
  expect(q("fieldset").disabled).toBe(false);
  expect(host.textContent).toContain("enviado sem o posto fixo (L1 · Vigilante Líder)");
  expect(io.saveMapa).not.toHaveBeenCalled(); // nada gravado até concluir
});
test("mapa enviado completo continua travado até 'Editar mapa'", async () => {
  await montar();
  await clicar(botao("Concluir mapa"));
  expect(q("fieldset").disabled).toBe(true);
  expect(host.textContent).not.toContain("enviado sem o posto fixo");
});

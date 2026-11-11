// Trava de segurança: identificador sem import/declaração só estoura em produção ("x is not defined").
const { ESLint } = require('eslint');
test('nenhum arquivo do app usa identificador indefinido', async () => {
  const eslint = new ESLint({
    useEslintrc: false, ignore: false,
    overrideConfig: { parserOptions: { ecmaVersion: 2022, sourceType: 'module', ecmaFeatures: { jsx: true } }, env: { browser: true, es2022: true, node: true }, rules: { 'no-undef': 'error' } },
  });
  const res = await eslint.lintFiles(['src/**/*.{js,jsx}', 'api/**/*.js'].map(p => p));
  const erros = res.filter(r => !/\.test\.js$|setupTests|__mocks__/.test(r.filePath))
    .flatMap(r => r.messages.filter(m => m.ruleId === 'no-undef').map(m => `${r.filePath.split('/moklog-checktest/')[1]}:${m.line} ${m.message}`));
  expect(erros).toEqual([]);
}, 120000);

test("porta de entrada Moked: App abre em Entrada e a Área do Cliente saiu da Home", () => {
  const app = require("fs").readFileSync("src/App.jsx", "utf8");
  expect(app).toContain('const [portal,setPortal]=useState("entrada")');
  expect(app).toContain('if(portal==="entrada") return <Entrada');
  expect(app).not.toMatch(/arq="cliente"/);
  expect(app).not.toMatch(/screen==="cliente"/);
});

test("histórico de relatórios semanais: cascata com 3 últimos, mais recente primeiro, filtro por data", () => {
  const app = require("fs").readFileSync("src/App.jsx", "utf8");
  const fn = app.slice(app.indexOf("function HistoryScreen("), app.indexOf("function ReportScreen("));
  expect(fn).toContain(".slice().reverse();");                       // mais recente no topo
  expect(fn).toContain("filtrados.slice(0,3)");                      // 3 últimos
  expect(fn).toContain('aria-label="Buscar relatório por data"');    // filtro por data
  expect(fn).toContain("Ver mais ${filtrados.length-3}");            // cascata
  expect(fn).toContain('aria-expanded={aberto}');                    // bloco expansível
});

test("painel gerencial: relatórios do projeto organizados por mês (chips), 4 à vista, cascata", () => {
  const app = require("fs").readFileSync("src/App.jsx", "utf8");
  expect(app).toContain("const mesesDisp=[...new Set(hist.map(mesDe)");
  expect(app).toContain("listaMes.slice(0,4)");
  expect(app).toContain("Ver mais ${listaMes.length-4} relatório(s) de ${rotuloMes(mesAtivo)}");
  expect(app).toContain("aria-pressed={m===mesAtivo}");
});

// Porta do MokLog (Marcio, 26/10/2026): PIN antes da Home; líder cai só no próprio projeto; gerencial vê a Home completa.
test("porta do MokLog: PIN antes da Home e escopo do líder", () => {
  const fs = require("fs"), path = require("path");
  const app = fs.readFileSync(path.join(__dirname, "App.jsx"), "utf8");
  expect(app).toMatch(/portal==="moklog_pin"/);
  expect(app).toMatch(/setPortal\(gerencialNaDivisao\(a\)\?"moklog":"moklog_pin"\)/); // MokPat (11/11): a sessão precisa valer na divisão aberta
  expect(app).toMatch(/entrarNoProjetoDoLider\(pid\)/);
  expect(app).toMatch(/groupProjects = \[_escopoLider\]/);
  expect(fs.existsSync(path.join(__dirname, "entrada", "PinMoklog.jsx"))).toBe(true);
});

// Ronda Perimetral (26/10/2026, P260A): concluir o plantão anterior carrega o plantão COMPLETO antes de gravar;
// nunca grava a entrada leve do índice por cima das rondas do turno anterior.
test("ronda diária: concluir plantão anterior usa o plantão completo e mostra erro na tela", () => {
  const fs = require("fs"), path = require("path");
  const src = fs.readFileSync(path.join(__dirname, "RondaDiaria.jsx"), "utf8");
  const i = src.indexOf("const concluirAnterior = async () => {");
  const bloco = src.slice(i, i + 2200);
  expect(bloco).toMatch(/await loadPlantaoFull\(plantaoAnt\)/);
  expect(bloco).toMatch(/saveIndexEntry\(project\.id, entradaLeve\(concluido\)/);
  expect(bloco).toMatch(/setEnvioErr\(`Não consegui concluir o plantão anterior/);
});

// Ronda (06/11/2026, P260A): plantão vigente é estado com virada detectada; lista de responsáveis sem nome repetido;
// com plantão anterior aberto, primeiro conclui, depois registra a ronda de agora.
test("ronda diária: virada de plantão, nomes sem repetição e gate do plantão anterior", () => {
  const fs = require("fs"), path = require("path");
  const src = fs.readFileSync(path.join(__dirname, "RondaDiaria.jsx"), "utf8");
  expect(src).toMatch(/const \[slot, setSlot\] = useState\(\(\)=>\(\{ turno:turnoAtual\(\), dataP:dataPlantaoAtual\(\) \}\)\)/);
  expect(src).toMatch(/\},\[turno, dataP\]\); \/\/ eslint-disable-line/);
  expect(src).toMatch(/filtrados = filtrados\.filter\(c=>\{ const k=norm\(c\.nome\); if\(vistos\.has\(k\)\) return false;/);
  expect(src).toMatch(/Conclua o plantão anterior \(acima\) para registrar as rondas de agora/);
  expect(src).toMatch(/Concluir plantão anterior e abrir o de agora/);
});

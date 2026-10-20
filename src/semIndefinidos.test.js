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

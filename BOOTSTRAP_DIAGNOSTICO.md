# Bootstrap — Primeiro gerente e catálogo do Diagnóstico Situacional

Documento operacional. Sequência manual e controlada, executada uma única
vez por Marcio, para carregar o catálogo inicial e criar o gerente-raiz
antes de publicar as regras restritivas. Nada aqui toca PIN, sessão,
`App.jsx` ou módulos legados.

## Status real (atualizado 15/09)

Já concluído no Console `moklog-checktest`:
- ✅ Passo 2 — Login E-mail/Senha habilitado.
- ✅ Passo 4 — Conta do gerente criada no Firebase Authentication.
- ✅ Passo 5 — `usuarios/{uid}` criado com `role:"gerente"`, `active:true`, `scopeAll:true`.
- ✅ Passo 1 — Regras atuais extraídas; regra candidata testada só como rascunho
  no Rules Playground e descartada — **nada publicado**. Cenários comprovados (5):
  1. anônimo lê `projects/P311A` → permitido;
  2. anônimo lê catálogo de diagnóstico → negado;
  3. anônimo lê `usuarios` → negado;
  4. anônimo cria catálogo → negado;
  5. anônimo cria em coleção legada conhecida → permitido.

Pendente:
- ⏳ Passo 3 — Executar o seed one-shot (`scripts/seed/run.mjs`).
- ⏳ Passo 6 — Publicar as regras (só após aprovação expressa do Marcio).
- ⏳ Passo 7 — Testar os três perfis com as regras valendo.
- Storage segue não inicializado (fase de evidências).

A sequência abaixo permanece como referência canônica da ordem segura.

## Por que existe um bootstrap

Na Fase 1, a aplicação NÃO escreve em `usuarios/{uid}` — a regra Firestore mantém esse caminho como `allow write: if false`. Perfil, escopo, `active` e `scopeAll` são criados e alterados exclusivamente por Console ou Admin SDK, que não passam pelas regras de segurança do cliente. Por isso, o gerente-raiz é criado manualmente antes de as regras restritivas irem ao ar: garante que, quando as regras forem publicadas, já exista ao menos um perfil autorizado a operar o Diagnóstico.

Se, em fase futura, a aplicação passar a escrever em `usuarios/{uid}` — por exemplo, uma UI administrativa de perfis — aí sim surgirá o clássico "ovo-e-galinha". Nesse caso, o primeiro gerente-raiz continuará precisando ser criado enquanto a regra restritiva ainda não estiver publicada.


## Ordem segura (obrigatória)

1. **Obter e guardar as regras Firestore atuais.** Copiar o texto vigente em
   Firestore → Regras (Console). Não existe `firestore.rules` no repositório;
   as regras vivem só no Console e serão **mescladas** (legado verbatim +
   caminhos novos), nunca sobrescritas às cegas.
2. **Habilitar E-mail/Senha** em Authentication → Sign-in method. (Anonymous
   já está habilitado e permanece — é o crachá dos módulos legados.)
   Observação: E-mail/Senha é necessário para **criar o gerente**, não para
   executar o seed.
3. **Executar o seed controlado (one-shot).** Rodar `scripts/seed/run.mjs`
   com credencial administrativa (service account) **fora do repositório**.
   O seed **não depende de Firebase Auth**. Após esta carga, o **Firestore é
   a fonte de verdade única e vencedora** do catálogo publicado.
4. **Criar a conta Auth do gerente** (E-mail/Senha). Anotar o `uid`.
5. **Criar o documento `usuarios/{uid}`** do gerente-raiz, pelo Console:
   - `role: "gerente"`
   - `active: true`
   - `scopeAll: true`  <- apenas o gerente-raiz do bootstrap
   - `projectIds`, `clientIds` (podem ficar vazios; `scopeAll` já dá acesso total)
   - `createdAt`, `updatedAt` (ver "Timestamps" abaixo)
   Feito pelo Console, este passo não depende de regra — por isso precede a
   publicação. Nenhuma UI nem gerente comum pode criar/alterar `scopeAll:true`.
6. **Mesclar e publicar as regras restritivas** do Diagnóstico (com as legadas
   preservadas verbatim). A partir daqui: caminhos legados seguem como hoje;
   caminhos do Diagnóstico exigem identidade **não anônima** + gerente/auditor
   ativo com escopo válido. **Na Fase 1, escrita de perfil, escopo, `active` e
   `scopeAll` NÃO é feita pela aplicação; somente Console/Admin SDK** (a regra
   mantém a escrita do app em `usuarios/` como `if false`).
7. **Testar os três perfis:** gerente (acesso conforme escopo/`scopeAll`),
   auditor (escopo restrito), anônimo (bloqueado nos caminhos do Diagnóstico,
   e ainda funcional nos módulos legados).

## Timestamps — dois fluxos

- **Console manual:** NÃO usar `serverTimestamp()` (não disponível na escrita
  manual do Console). Usar **timestamp literal atual**, ou omitir `createdAt`/
  `updatedAt` até um script Admin SDK preenchê-los.
- **Script / Admin SDK:** usar `serverTimestamp()` (é o que `run.mjs` faz).

## Invariantes a preservar

- **Não** criar segundo Firebase App. O Diagnóstico reutiliza o `auth` global.
  Login e-mail/senha promove a identidade global de anônima a real; os módulos
  legados não dependem de `uid` (varredura confirmou), então a promoção é
  transparente para eles.
- **Não** adicionar `signOut` ao "sair do Diagnóstico": rebaixar para anônimo
  quebraria a premissa acima. Sair é só navegação de UI, não logout do Firebase.
- Convites e UI administrativa de perfis ficam **fora** desta fase.

## Fronteira do seed (regra dura)

- `scripts/seed/catalogoSeed.mjs` e `scripts/seed/run.mjs` ficam **fora de
  `src/`**. **Nenhum** arquivo de `src/` importa qualquer arquivo de
  `scripts/seed/`. O seed jamais entra no bundle CRA nem é lido em runtime.

## Fora de escopo desta entrega

Não aplicar o seed, não publicar regras, não criar UI, não persistir
diagnóstico, respostas, fotos ou Storage. Os arquivos entregues são apenas
estrutura, dados e este roteiro, para auditoria final.

## Execução do seed — credencial, DRY RUN e timestamps

### Credencial (fora do repositório)
- O executor `scripts/seed/run.mjs` usa **Application Default Credentials**.
- Convenção: um arquivo `service-account.json` mantido **fora do repositório**
  (nunca versionado — coberto pelo `.gitignore`: `scripts/seed/*service-account*.json`,
  `scripts/seed/.env*`).
- A variável de ambiente `GOOGLE_APPLICATION_CREDENTIALS` aponta para esse arquivo:
  ```
  export GOOGLE_APPLICATION_CREDENTIALS=/caminho/seguro/service-account.json
  ```

### DRY RUN (validação sem Firebase)
- `SEED_DRY_RUN=1 node scripts/seed/run.mjs` valida a integridade da matriz
  (8 categorias, 16 subcategorias, 110 itens, sem órfãos, sem duplicados) e
  **retorna antes** de qualquer import de `firebase-admin`, credencial,
  `initializeApp` ou I/O.
- Funciona **sem `firebase-admin` instalado, sem credencial e sem Firebase** —
  serve para conferência em qualquer máquina.

### Execução real (one-shot)
- Instalar as dependências **apenas dentro de `scripts/seed/`** (isoladas do
  bundle CRA em `src/`):
  ```
  cd scripts/seed && npm install
  GOOGLE_APPLICATION_CREDENTIALS=/caminho/service-account.json node run.mjs
  ```
- `scripts/seed/node_modules/` é ignorado pelo Git.

### Timestamps (`createdAt` / `updatedAt`)
- Ambos **existem** no documento raiz do catálogo.
- Na **criação inicial**, podem ser **iguais** (mesmo `serverTimestamp()`).
- Numa **retomada** (mesma versão, `seedCompleto` ainda não `true`), o
  `createdAt` **não muda** e o `updatedAt` **é atualizado**.
- No Console (escrita manual de `usuarios/{uid}`): timestamp **literal**.
  No Admin SDK (seed): **`serverTimestamp()`**.

Seed e publicação de regras permanecem **vedados** até autorização expressa
do Marcio.

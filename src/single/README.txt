SINGLE — relatório situacional isolado
Base: main bbf3c0a. Branch feat/single em worktree separado.
Exceção autorizada pelo Marcio em 03/10/2026: API exclusiva com transação no servidor.
Etapa atual: interface, cálculo, persistência, histórico e relatório implementados.
Publicação em produção autorizada pelo Marcio após validação técnica.

API /api/single:
- usa token Firebase Auth individual do Diagnóstico, não PIN/token do Adendo 6;
- recusa anônimo/perfil inativo; autor vê próprios Singles;
- gerente scopeAll vê todos os Singles moked; catálogo só gerente;
- transação relê perfil e documento, verifica revisão e faz uma gravação;
- conflito retorna 409: nunca declarar sucesso ou descartar rascunho;
- duas alterações concorrentes no mesmo documento: uma vence e outra recebe conflito.
Não é merge automático. É controle otimista explícito, sem perda silenciosa.
- inspeções mantêm nomes/totais do snapshot inicial; catálogo não reescreve histórico.
- listagens limitadas a 200; paginação necessária antes de expansão.
- nenhuma escrita em projects, equipes, FV ou outros documentos legados.

Entrada: Diagnóstico Situacional, autenticação individual, Novo projeto (Single).
Rascunhos locais separados por usuário/projeto; cópias locais antes de trocar vistoria.
Diagnóstico sg_ usa exclusivamente a API autenticada, sem alterar regras existentes.
Relatório imprimível/PDF com logo Moked 30 anos e introdução. Adaptador preparado,
mas não conectado ao motor de risco. Nenhum módulo operacional legado foi alterado.
Validação automatizada usa dados simulados; não equivale a teste de gravação real.
Limitação: paginação da impressão depende do navegador; cópias locais não são backup remoto.
Semente provisória não deve ser gravada sem aprovação da tabela.
Backups devem incluir catalogo_ativos e single_projetos/**; diagnóstico continuará
em diagnosticos/{singleId}/itens.
Não publicar regras, seeds ou dados de teste no banco real.

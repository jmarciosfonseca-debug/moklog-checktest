SINGLE — início de construção
Base: main bbf3c0a. Branch feat/single em worktree separado.
Exceção autorizada pelo Marcio em 03/10/2026: API exclusiva com transação no servidor.
Etapa atual: fundação, cálculo e persistência; ainda SEM UI e SEM publicação.

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

Pendente: UI/rascunhos, diagnóstico com chave sg_ (regra antiga o bloqueia),
PDF, adaptador, tabela de classificação conferida, preview.
Não declarar roteiro completo executável enquanto essas etapas estiverem pendentes.
Semente provisória não deve ser gravada sem aprovação da tabela.
Backups devem incluir catalogo_ativos e single_projetos/**; diagnóstico continuará
em diagnosticos/{singleId}/itens quando o vínculo estiver implementado.
Não publicar regras, seeds ou dados de teste no banco real.

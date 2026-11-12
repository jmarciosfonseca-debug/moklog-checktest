# moklog-checktest
MokLog CheckTest - Sistema de Teste Semanal

## CPF dos colaboradores (Equipe)

O CPF nunca é gravado em texto. O servidor cifra com a variável de ambiente `CPF_CHAVE` (64 caracteres hexadecimais,
só em produção na Vercel) e guarda `cpfCifrado`, `cpfFinal` (2 últimos dígitos) e `cpfHmac` (para localizar por CPF).
**Não trocar nem apagar `CPF_CHAVE`:** sem ela os CPFs já gravados não abrem. Regras em `api/ai/lib/cpf.js`.

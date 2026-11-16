// Endereço público oficial do app (Marcio, 16/11/2026): passou de moklog-checktest para moked-checktest.
// O endereço antigo continua funcionando (os dois apontam para o mesmo app); os links que o app GERA saem sempre com o novo.
// CommonJS: usado pelo app e pelas rotas /api.
const ENDERECO_APP = "https://moked-checktest.vercel.app";
const ENDERECO_ANTIGO = "https://moklog-checktest.vercel.app";
module.exports = { ENDERECO_APP, ENDERECO_ANTIGO };

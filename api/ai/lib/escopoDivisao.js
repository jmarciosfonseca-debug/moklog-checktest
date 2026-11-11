// Gestor de divisão (MokPat, 11/11/2026) age como admin SÓ nos projetos da divisão dele; fora dela, fica sem permissão.
const {DIVISAO_IDS}=require('../../../src/divisoes');
function noProjeto(a,pid){if(a&&a.nivel==='gestor')return (DIVISAO_IDS[a.div]||[]).includes(pid)?{...a,nivel:'admin',gestor:a.div}:{...a,nivel:'negado'};return a;}
module.exports={noProjeto};

// Fila de gravação por tela: UMA gravação por vez, na ordem em que a pessoa agiu.
// Motivo (telemetria de produção, 03/10/2026): gravações rápidas e seguidas do mesmo líder podiam chegar ao servidor fora
// de ordem (uma função "fria" demora mais) e a segunda conflitava com a primeira, que ainda não tinha sido confirmada.
// Uma falha não trava as próximas; cada chamada recebe o próprio resultado ou erro.
export function criarFila() {
  let ultima = Promise.resolve();
  let pendentes = 0;
  const enfileirar = (tarefa) => {
    pendentes++;
    const executar = async () => { try { return await tarefa(); } finally { pendentes--; } };
    const p = ultima.then(executar, executar);
    ultima = p.then(() => undefined, () => undefined);
    return p;
  };
  enfileirar.pendentes = () => pendentes;
  return enfileirar;
}

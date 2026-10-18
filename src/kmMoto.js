// Km da Moto no cadastro de Equipamentos: só dígitos, inteiro e nunca menor que o último km informado no mapa.
// Exceções (não travam): moto trocada depois do último mapa (é outra moto) — ver motoTrocadaDesde em mapaDiario/modelo.
export const soDigitosKm = (v) => String(v ?? "").replace(/\D/g, "");

export function validarKmMoto({ km, kmManutencao }, ultimoKmMapa = null) {
  const k = soDigitosKm(km);
  if (k === "") return { ok: true, km: null, kmManutencao: soDigitosKm(kmManutencao) === "" ? null : Number(soDigitosKm(kmManutencao)) };
  const n = Number(k);
  if (ultimoKmMapa != null && n < ultimoKmMapa) return { ok: false, erro: `O km (${n}) é menor que o último informado no Mapa de Equipe (${ultimoKmMapa}). Confira o odômetro. Se o km do mapa estava errado (erro de digitação), corrija no próprio Mapa de Equipe: "Corrigir km anterior".` };
  const m = soDigitosKm(kmManutencao);
  return { ok: true, km: n, kmManutencao: m === "" ? null : Number(m) };
}

// Último km da Moto num mapa enviado (para a trava acima). O km corrigido depois (erro de digitação) vence o digitado.
export const kmMotoDoMapa = (mapa) => {
  const v = ((mapa && mapa.veiculos) || []).find((x) => x && (x.id === "moto" || /moto/i.test(x.rotulo || "")));
  if (!v) return null;
  const bruto = v.kmAtualCorrigido != null && v.kmAtualCorrigido !== "" ? v.kmAtualCorrigido : v.kmAtual;
  const n = Number(soDigitosKm(bruto));
  return Number.isFinite(n) && soDigitosKm(bruto) !== "" ? n : null;
};

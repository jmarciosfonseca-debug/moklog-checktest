// Km da Moto no cadastro de Equipamentos: só dígitos, inteiro e nunca menor que o último km informado no mapa.
export const soDigitosKm = (v) => String(v ?? "").replace(/\D/g, "");

export function validarKmMoto({ km, kmManutencao }, ultimoKmMapa = null) {
  const k = soDigitosKm(km);
  if (k === "") return { ok: true, km: null, kmManutencao: soDigitosKm(kmManutencao) === "" ? null : Number(soDigitosKm(kmManutencao)) };
  const n = Number(k);
  if (ultimoKmMapa != null && n < ultimoKmMapa) return { ok: false, erro: `O km (${n}) é menor que o último informado no Mapa de Equipe (${ultimoKmMapa}). Confira o odômetro.` };
  const m = soDigitosKm(kmManutencao);
  return { ok: true, km: n, kmManutencao: m === "" ? null : Number(m) };
}

// Último km da Moto num mapa enviado (para a trava acima).
export const kmMotoDoMapa = (mapa) => {
  const v = ((mapa && mapa.veiculos) || []).find((x) => x && (x.id === "moto" || /moto/i.test(x.rotulo || "")));
  const n = v ? Number(soDigitosKm(v.kmAtual)) : NaN;
  return Number.isFinite(n) && soDigitosKm(v.kmAtual) !== "" ? n : null;
};

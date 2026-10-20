// Registro de manutenção da motocicleta (regra do usuário, 19/10):
// • registrar manutenção = data + km do dia + descrição; o cadastro atualiza sozinho (KM Atual e
//   Últ. manutenção) — sem precisar de "Editar";
// • não existe "próxima revisão (data)": a empresa recolhe a moto em datas aleatórias;
// • "KM para próxima manutenção" continua opcional (alerta de km atingido); ao registrar manutenção
//   ele é limpo — a moto acabou de ser revisada — e quem controla preenche de novo quando souber.
import { soDigitosKm } from "./kmMoto";

export function ultimaManutencao(moto) {
  const h = (moto?.historico || []).filter((x) => x && x.data);
  if (!h.length) return null;
  return h.slice().sort((a, b) => String(b.data).localeCompare(String(a.data)))[0];
}

// Retorna { ok, erro } ou { ok:true, moto } com cadastro e histórico atualizados.
export function registrarManutencao(moto, { data, km, desc, proximoKm }, ultimoKmMapa = null) {
  const d = String(data || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return { ok: false, erro: "Informe a data da manutenção." };
  const k = soDigitosKm(km);
  if (k === "") return { ok: false, erro: "Informe o km da moto no dia da manutenção." };
  const n = Number(k);
  if (ultimoKmMapa != null && n < Number(ultimoKmMapa)) return { ok: false, erro: `Km (${n}) menor que o último km lançado no Mapa de Equipe (${ultimoKmMapa}).` };
  if (!String(desc || "").trim()) return { ok: false, erro: "Informe a descrição (o que foi feito)." };
  const p = soDigitosKm(proximoKm);
  if (p !== "" && Number(p) <= n) return { ok: false, erro: "KM para próxima manutenção precisa ser maior que o km atual." };
  const item = { id: Date.now().toString(), data: d, km: n, desc: String(desc).trim() };
  const historico = [item, ...(moto?.historico || [])];
  return { ok: true, moto: { ...moto, km: n, ultimaManutencao: d, kmManutencao: p === "" ? "" : Number(p), historico } };
}

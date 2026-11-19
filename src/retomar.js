// Abertura e retomada (Marcio, 19/11/2026):
// - A abertura animada só toca quando o app abre "de verdade": sessão expirada/ausente, ou app fechado por um tempo.
// - Fechou sem querer e voltou logo, ou deu F5: volta para onde estava, já logado, sem abertura.
// Guarda só onde o usuário estava (portal, divisão, grupo), nunca dados de preenchimento.
import { getSession, gerencialNaDivisao, getClienteScope, setDivisaoAtiva } from "./session";

export const CHAVE_LOCAL = "moked_retomar_v1";
export const CHAVE_VISTO = "moked_visto_em_v1";
export const JANELA_RETOMAR_MS = 30 * 60000; // mesma janela da sessão gerencial/cliente

const ler = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const gravar = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* modo privado: sem retomada */ } };

export function marcarVisto(agora = Date.now()) { gravar(CHAVE_VISTO, String(agora)); }

export function salvarLocal({ portal, divisao, homeGroup }, agora = Date.now()) {
  if (portal !== "moklog" && portal !== "cliente") { try { localStorage.removeItem(CHAVE_LOCAL); } catch (e) { /* ok */ } return; }
  gravar(CHAVE_LOCAL, JSON.stringify({ portal, divisao: divisao || "moklog", homeGroup: homeGroup || null, t: agora }));
  marcarVisto(agora);
}

// Abertura fria = sem sessão válida OU sem uso recente.
export function aberturaFria(agora = Date.now()) {
  if (!getSession()) return true;
  const v = Number(ler(CHAVE_VISTO));
  return !v || agora - v > JANELA_RETOMAR_MS;
}

// Onde estava (só se a sessão ainda vale para aquele lugar). Retorna null quando não dá para retomar.
export function lerRetomada(agora = Date.now()) {
  let r; try { r = JSON.parse(ler(CHAVE_LOCAL) || "null"); } catch (e) { r = null; }
  if (!r || typeof r.t !== "number") return null;
  const ultimo = Math.max(r.t, Number(ler(CHAVE_VISTO)) || 0); // visto por último (batimento a cada minuto)
  if (agora - ultimo > JANELA_RETOMAR_MS) return null;
  if (r.portal === "moklog") {
    if (r.divisao !== "moklog" || !gerencialNaDivisao("moklog")) return null;
    setDivisaoAtiva("moklog");
    return { portal: "moklog", divisao: "moklog", homeGroup: typeof r.homeGroup === "string" ? r.homeGroup : null };
  }
  if (r.portal === "cliente") {
    const s = getSession();
    if (!s || !getClienteScope()) return null;
    return { portal: "cliente", divisao: "moklog", homeGroup: null };
  }
  return null;
}

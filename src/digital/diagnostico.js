// Diagnóstico da entrada por digital / Face ID (22/11/2026): em vez de o botão simplesmente não aparecer, mostra PASSO A PASSO
// o que está certo e o que está impedindo neste aparelho. Só lê; nunca cadastra nem altera nada. Nunca lança.
import { lerConfigDigital, aparelhoSuporta, K_TESTE, K_ID } from "./digital";

import { ENDERECO_APP, ENDERECO_ANTIGO } from "../enderecoApp";
export const ENDERECOS_OFICIAIS = [ENDERECO_APP, ENDERECO_ANTIGO].map((u) => u.replace(/^https?:\/\//, ""));
const seguro = (f, p = null) => { try { return f(); } catch { return p; } };

async function perguntarAoServidor(fetchFn) {
  if (!fetchFn) return { status: -1 };
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const t = ctrl ? setTimeout(() => ctrl.abort(), 6000) : null;
  try {
    const r = await fetchFn("/api/digital", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "opcoes-login", credentialId: "" }), ...(ctrl ? { signal: ctrl.signal } : {}) });
    return { status: r.status };
  } catch { return { status: 0 }; } finally { if (t) clearTimeout(t); }
}

export async function diagnosticarDigital({ win = typeof window !== "undefined" ? window : null, fetchFn = typeof fetch !== "undefined" ? fetch : null } = {}) {
  const itens = [];
  const add = (id, rotulo, ok, detalhe) => itens.push({ id, rotulo, ok, detalhe });
  const host = seguro(() => win.location.hostname, "") || "";
  add("endereco", "Endereço do app", ENDERECOS_OFICIAIS.includes(host), ENDERECOS_OFICIAIS.includes(host) ? host : `${host || "desconhecido"}: a digital só funciona em ${ENDERECOS_OFICIAIS.join(" ou ")}.`);
  add("seguro", "Conexão segura (https)", !!seguro(() => win.isSecureContext, false), seguro(() => win.isSecureContext, false) ? "Sim." : "Abra o app pelo endereço https.");
  const cfg = await lerConfigDigital(fetchFn);
  add("chave", "Chave remota da digital", cfg.modo !== "desligado", cfg.modo === "desligado" ? "Desligada no app." : cfg.modo === "teste" ? "Em teste: só aparelhos habilitados." : "Ligada para todos.");
  const st = seguro(() => win.localStorage, null);
  const marca = !!(st && seguro(() => st.getItem(K_TESTE), null) === "1");
  if (cfg.modo === "teste") add("marca", "Este aparelho está habilitado para o teste", marca, marca ? "Sim." : "Não. Abra o app UMA vez com ?digital=1 no final do endereço neste mesmo navegador.");
  const api = !!(seguro(() => win.PublicKeyCredential, null) && seguro(() => win.navigator.credentials, null));
  add("navegador", "Navegador com suporte a digital/rosto", api, api ? "Sim." : "Este navegador não tem o recurso. Abra no Chrome (não dentro do WhatsApp, Instagram ou e-mail).");
  const leitor = api ? await aparelhoSuporta(win) : false;
  add("leitor", "Leitor de digital, rosto ou bloqueio de tela do aparelho", leitor, leitor ? "Reconhecido." : api ? "O aparelho não informou nenhum leitor. Ative um bloqueio de tela com digital ou rosto nas configurações do Android e use o Chrome atualizado." : "Depende do item anterior.");
  const sv = await perguntarAoServidor(fetchFn);
  const detalheSv = sv.status === 200 ? "Respondendo e liberado." : sv.status === 503 ? "Digital desligada no servidor." : sv.status === 403 ? "O servidor não aceita este endereço." : sv.status === 429 ? "Muitas tentativas; aguarde 15 minutos." : sv.status === 0 ? "Sem conexão com o servidor." : `Resposta inesperada (${sv.status}).`;
  add("servidor", "Servidor de acesso", sv.status === 200, detalheSv);
  const cad = !!(st && seguro(() => st.getItem(K_ID), null));
  add("cadastro", "Digital cadastrada neste aparelho", cad, cad ? "Sim. O app pede a biometria ao abrir a tela do PIN." : "Ainda não. Entre com o PIN (gerencial ou cliente) e toque em 'Ativar neste aparelho'.");
  const primeiro = itens.find((i) => !i.ok && i.id !== "cadastro");
  return { itens, pronto: !primeiro, motivo: primeiro ? `${primeiro.rotulo}: ${primeiro.detalhe}` : "" };
}

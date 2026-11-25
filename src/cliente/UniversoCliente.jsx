// Universo da Área do Cliente: tela cheia com o 3D (carregado sob demanda). Quem acessa faz parte dele: um ponto com a sua foto
// (guardada só neste aparelho), ligado à MOKED e ao projeto. "Início" e as ações devolvem o controle à área.
import { useEffect, useRef, useState } from "react";

const chave = (id) => `mk-foto-perfil:${id || "eu"}`;
export const lerFotoPerfil = (id) => { try { return localStorage.getItem(chave(id)) || ""; } catch { return ""; } };
export const gravarFotoPerfil = (id, url) => { try { if (url) localStorage.setItem(chave(id), url); else localStorage.removeItem(chave(id)); return true; } catch { return false; } };
// Reduz a foto escolhida para um quadrado pequeno (cabe com folga no armazenamento do aparelho).
export function reduzirFoto(arquivo, lado = 256) {
  return new Promise((ok, erro) => {
    const url = URL.createObjectURL(arquivo), img = new Image();
    img.onload = () => { try { const c = document.createElement("canvas"); c.width = c.height = lado; const k = Math.max(lado / img.width, lado / img.height), w = img.width * k, h = img.height * k;
      c.getContext("2d").drawImage(img, (lado - w) / 2, (lado - h) / 2, w, h); URL.revokeObjectURL(url); ok(c.toDataURL("image/jpeg", 0.82)); } catch (e) { erro(e); } };
    img.onerror = () => { URL.revokeObjectURL(url); erro(new Error("imagem")); }; img.src = url;
  });
}

export default function UniversoCliente({ nome, divisao, perfilId, perfilNome, itens, onAcao, onInicio, carregar = () => import("../entrada/universo3d") }) {
  const raiz = useRef(null), arquivo = useRef(null), api = useRef(null), acao = useRef(onAcao), inicio = useRef(onInicio);
  const [falhou, setFalhou] = useState(false), [aviso, setAviso] = useState("");
  acao.current = onAcao; inicio.current = onInicio;
  useEffect(() => {
    let vivo = true;
    const aoAcao = (item, a) => {
      if (item === "eu") { if (a === "foto") arquivo.current && arquivo.current.click(); else if (a === "sem-foto") { gravarFotoPerfil(perfilId, ""); api.current && api.current.foto(""); } return; }
      acao.current && acao.current(item, a);
    };
    Promise.resolve().then(carregar).then((m) => {
      if (!vivo || !raiz.current) return;
      api.current = m.iniciarUniverso3D({ raiz: raiz.current, dados: { MODS: [], LIG: [], cliente: { nome, divisao, itens, eu: { nome: perfilNome, foto: lerFotoPerfil(perfilId) } } }, aoAcao, aoInicio: () => inicio.current && inicio.current() });
      if (!api.current) setFalhou(true);
    }).catch(() => vivo && setFalhou(true));
    return () => { vivo = false; if (api.current) api.current.parar(); api.current = null; };
  }, []); // monta uma vez: os dados são os do momento em que o cliente abriu
  const escolher = async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
    try { const url = await reduzirFoto(f); if (!gravarFotoPerfil(perfilId, url)) setAviso("Não consegui guardar a foto neste aparelho."); api.current && api.current.foto(url); } catch { setAviso("Não consegui abrir essa imagem."); }
  };
  return <div data-testid="universo-cliente" style={{ position: "fixed", inset: 0, zIndex: 9000, background: "#04050a", color: "#eef1f6" }}>
    <div ref={raiz} style={{ position: "absolute", inset: 0 }} />
    <input ref={arquivo} type="file" accept="image/*" hidden aria-label="Escolher foto do perfil" onChange={escolher} />
    {aviso && <div role="alert" onClick={() => setAviso("")} style={{ position: "absolute", left: 16, right: 16, top: 90, padding: 12, background: "rgba(8,10,18,.92)", border: "1px solid #ff5a5f", borderRadius: 10, fontSize: 13, textAlign: "center" }}>{aviso}</div>}
    {falhou && <div role="alert" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center", padding: 30 }}>
      <div><div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>Este aparelho não abriu o universo 3D.</div><div style={{ color: "#98a1b3", fontSize: 13, marginBottom: 16 }}>Tudo continua disponível na sua área.</div>
        <button onClick={onInicio} style={{ background: "linear-gradient(180deg,#d63224,#a0201a)", color: "#fff", border: 0, borderRadius: 999, padding: "11px 22px", fontWeight: 700, letterSpacing: 2, cursor: "pointer" }}>⌂ INÍCIO</button></div>
    </div>}
  </div>;
}

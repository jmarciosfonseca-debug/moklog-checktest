// MANUTENÇÃO TEMPORÁRIA (remover após o uso) — correção da quilometragem da Moto nos mapas do P311A.
//
// Contexto (15/10/2026): os primeiros mapas registraram números soltos (221…), no plantão de
// 14/10 N o líder digitou o odômetro cheio (71.415) sobre essa base, e o 15/10 D repetiu o valor.
// Resultado: o rascunho do 15/10 N abriu com "anterior 71415" e a moto marca de verdade 71.330 —
// o líder fica travado em "km atual menor que o anterior" e não consegue concluir o mapa.
//
// Este endpoint reescreve SOMENTE os campos kmAnterior/kmAtual da Moto nos 5 documentos listados
// abaixo (estimativa combinada de ~45 km por plantão rodado), terminando com anterior 71285 no
// rascunho de 15/10 N — o líder digita 71330 e fecha com "rodou 45 km".
//
// Uso (GET):   /api/mapa-fix-p311a?k=SEGREDO            → só LÊ e mostra antes/depois previsto
//              /api/mapa-fix-p311a?k=SEGREDO&gravar=1   → aplica (idempotente)
// Segurança: segredo de uso único abaixo; só toca a subcoleção equipes/P311A/mapas, só os ids
// da tabela, só os campos de km do veículo Moto. Nenhum outro dado é lido ou alterado.

const { getDb } = require("./ai/lib/firebaseAdmin");

const SEGREDO = "63bd7b4f37058a3d23d1e95d987e74bb2c9d4fac10e2337f";
const PID = "P311A";

// id do documento → km da Moto. kmAtual null = NÃO mexer no atual (rascunho que o líder vai preencher).
const PLANO = {
  // Cadeia real lida do banco (anterior → atual): 71109 → 71133 → 71171 → 71241 → [15 D] → [15 N].
  // Erros encontrados: 13/10 N atual 71330 (odômetro de HOJE digitado cedo) e 14/10 D atual 71.415
  // (idem, com ponto de milhar); 15/10 D com 71375 repetido. Os ~89 km entre 71241 e o odômetro de
  // hoje (71330) são divididos nos dois plantões de 15/10 (~45 km cada).
  "P311A_2026-10-13_N": { kmAnterior: "71109", kmAtual: "71133" },
  "P311A_2026-10-14_D": { kmAnterior: "71133", kmAtual: "71171" },
  "P311A_2026-10-14_N": { kmAnterior: "71171", kmAtual: "71241" },
  "P311A_2026-10-15_D": { kmAnterior: "71241", kmAtual: "71285" },
  "P311A_2026-10-15_N": { kmAnterior: "71285", kmAtual: null },  // líder digita 71330 e conclui (rodou 45)
};

const ehMoto = (v) => !!v && (v.id === "moto" || /moto/i.test(v.rotulo || ""));

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const q = req.query || {};
  if (q.k !== SEGREDO) return res.status(404).json({ ok: false });
  const gravar = q.gravar === "1";
  try {
    const db = getDb();
    const itens = [];
    for (const [id, alvo] of Object.entries(PLANO)) {
      const ref = db.collection("equipes").doc(PID).collection("mapas").doc(id);
      const snap = await ref.get();
      if (!snap.exists) { itens.push({ id, existe: false }); continue; }
      const d = snap.data();
      const veiculos = Array.isArray(d.veiculos) ? d.veiculos : [];
      const antes = veiculos.filter(ehMoto).map((v) => ({ rotulo: v.rotulo, kmAnterior: v.kmAnterior ?? null, kmAtual: v.kmAtual ?? null }));
      let temMoto = veiculos.some(ehMoto);
      const depois = (temMoto ? veiculos : [{ id: "moto", rotulo: "Moto", kmAnterior: null, kmAtual: null }, ...veiculos])
        .map((v) => (ehMoto(v) ? { ...v, kmAnterior: alvo.kmAnterior, ...(alvo.kmAtual != null ? { kmAtual: alvo.kmAtual } : {}) } : v));
      if (gravar) await ref.update({ veiculos: depois });
      itens.push({ id, existe: true, status: d.status, motoTinha: temMoto, antes, depoisMoto: depois.filter(ehMoto).map((v) => ({ kmAnterior: v.kmAnterior, kmAtual: v.kmAtual ?? null })), gravado: gravar });
    }
    return res.status(200).json({ ok: true, modo: gravar ? "GRAVADO" : "somente leitura", itens });
  } catch (e) {
    console.error("mapa-fix-p311a:", e && e.message);
    return res.status(503).json({ ok: false, erro: "falha ao acessar o banco" });
  }
};

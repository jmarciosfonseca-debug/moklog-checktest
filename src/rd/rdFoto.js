// Comprovante de gasto: foto comprimida na hora (não precisa de qualidade alta — é um recibo).
// Reduz para no máximo 900px no lado maior, JPEG 0,55 → tipicamente 60–150 KB.
export const LADO_MAXIMO = 900;
export const LIMITE_B64 = 250000; // ~180 KB de imagem; acima disso o servidor recusa

export function comprimirFoto(file, doc = typeof document !== "undefined" ? document : null) {
  return new Promise((resolve, reject) => {
    if (!file || !doc) return reject(new Error("Nenhuma foto selecionada."));
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error("Não foi possível ler a foto."));
    leitor.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Arquivo não é uma imagem."));
      img.onload = () => {
        try {
          const escala = Math.min(1, LADO_MAXIMO / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * escala)), h = Math.max(1, Math.round(img.height * escala));
          const canvas = doc.createElement("canvas");
          canvas.width = w; canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0, w, h);
          let b64 = canvas.toDataURL("image/jpeg", 0.55);
          if (b64.length > LIMITE_B64) b64 = canvas.toDataURL("image/jpeg", 0.35);
          if (b64.length > LIMITE_B64) {
            const c2 = doc.createElement("canvas");
            c2.width = Math.round(w / 2); c2.height = Math.round(h / 2);
            c2.getContext("2d").drawImage(img, 0, 0, c2.width, c2.height);
            b64 = c2.toDataURL("image/jpeg", 0.45);
          }
          if (b64.length > LIMITE_B64) return reject(new Error("Foto grande demais mesmo comprimida. Tente de novo mais perto do comprovante."));
          resolve(b64);
        } catch (e) { reject(new Error("Não foi possível comprimir a foto.")); }
      };
      img.src = leitor.result;
    };
    leitor.readAsDataURL(file);
  });
}

export const novoIdFoto = () => "f" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

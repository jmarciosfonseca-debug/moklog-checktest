// Reduz a foto de catálogo (JPEG ≤ ~100 KB) antes de enviar. Devolve data URL ou "" se não for imagem legível.
export function reduzirFoto(dataUrl, max = 640) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w >= h && w > max) { h = Math.round(h * max / w); w = max; }
      else if (h > w && h > max) { w = Math.round(w * max / h); h = max; }
      const tentar = (q, esc) => {
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w * esc)); c.height = Math.max(1, Math.round(h * esc));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        return c.toDataURL('image/jpeg', q);
      };
      let out = tentar(0.7, 1);
      if (out.length > 140 * 1024) out = tentar(0.55, 0.7);
      if (out.length > 140 * 1024) out = tentar(0.45, 0.5);
      resolve(out.length <= 150 * 1024 ? out : '');
    };
    img.onerror = () => resolve('');
    img.src = dataUrl;
  });
}
export const lerArquivo = f => new Promise(res => { const r = new FileReader(); r.onload = () => res(String(r.result || '')); r.onerror = () => res(''); r.readAsDataURL(f); });

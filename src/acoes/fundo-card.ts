/* Imagem de fundo dos cards (KAN-294, fase 2, pelada-v127): reduz no aparelho (lado maior até 1080 px, sem cortar),
   grava em WebP (sem WebP, JPEG) no Storage e devolve o nome do arquivo. Vem com a janela de cards. */
import { caminhoFundo, chaveDemoFundo } from '../ui/cards-src';
import { abrirImagem, paraBlob, subirArquivo } from './arquivos-storage';

export const FUNDO_TIPOS = ['image/jpeg', 'image/png', 'image/webp'];
export const FUNDO_MAX_MB = 8;
const LADO = 1080,
  MAX_GRAVADO = 900 * 1024;

export function arquivoFundo(f: { type: string; size: number }): 'tipo' | 'grande' | null {
  if (!FUNDO_TIPOS.includes(f.type)) return 'tipo';
  if (!f.size || f.size > FUNDO_MAX_MB * 1024 * 1024) return 'grande';
  return null;
}

export async function subirFundo(gid: string, f: Blob): Promise<string | null> {
  let im: HTMLImageElement;
  try {
    im = await abrirImagem(f);
  } catch (e) {
    return null;
  }
  URL.revokeObjectURL(im.src);
  const k = Math.min(1, LADO / Math.max(im.naturalWidth, im.naturalHeight));
  const w = Math.round(im.naturalWidth * k),
    h = Math.round(im.naturalHeight * k);
  if (!w || !h) return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d');
  if (!x) return null;
  x.imageSmoothingQuality = 'high';
  x.fillStyle = '#ffffff';
  x.fillRect(0, 0, w, h);
  x.drawImage(im, 0, 0, w, h);
  let b = await paraBlob(c, 'image/webp', 0.82);
  if (!b || b.type !== 'image/webp') b = await paraBlob(c, 'image/jpeg', 0.82);
  if (!b || b.size > MAX_GRAVADO) return null;
  const nome = 'fundo-' + Date.now() + (b.type === 'image/webp' ? '.webp' : '.jpg');
  await subirArquivo(caminhoFundo(gid, nome), b, chaveDemoFundo(gid, nome));
  return nome;
}

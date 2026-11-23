/* Foto do jogador (KAN-293, pelada-v125): prepara a imagem no aparelho e grava no Firebase Storage. Baixa só quando a
   ficha do jogador mostra a foto. A regra (tipos, limite, tamanho, nome do arquivo) fica em dominio/foto.ts. */
import {
  FOTO_MAX_GRAVADO,
  caminhoFoto,
  formatoSemWebp,
  nomeFoto,
  nomeFotoValido,
  tamanhoReduzido,
} from '../dominio/foto';
import { chaveDemoFoto } from '../ui/foto-src';
import { abrirImagem, apagarArquivo, paraBlob, subirArquivo } from './arquivos-storage';

type Arq = Blob & { type: string };

/* Algum ponto com transparência? (só confere PNG e WebP; JPEG não tem). Lê uma amostra, para não pesar. */
function temTransparencia(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  const d = ctx.getImageData(0, 0, w, h).data,
    passo = Math.max(4, Math.floor(d.length / 4 / 20000)) * 4;
  for (let i = 3; i < d.length; i += passo) if (d[i]! < 250) return true;
  return false;
}

/* Reduz (o lado maior até 800 px, sem cortar) e grava em WebP; sem WebP, PNG (com transparência) ou JPEG. Devolve
   null se a imagem não abrir ou ficar grande demais. */
export async function prepararFoto(f: Blob & { type?: string }): Promise<Arq | null> {
  let im: HTMLImageElement;
  try {
    im = await abrirImagem(f);
  } catch (e) {
    return null;
  }
  URL.revokeObjectURL(im.src);
  const t = tamanhoReduzido(im.naturalWidth, im.naturalHeight);
  if (!t.w) return null;
  const c = document.createElement('canvas');
  c.width = t.w;
  c.height = t.h;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(im, 0, 0, t.w, t.h);
  let b = await paraBlob(c, 'image/webp', 0.85);
  if (!b || b.type !== 'image/webp') {
    const tipo = formatoSemWebp(f.type !== 'image/jpeg' && temTransparencia(ctx, t.w, t.h));
    if (tipo === 'image/jpeg') {
      /* JPEG não tem transparência: fundo branco, como no logotipo. */
      const c2 = document.createElement('canvas');
      c2.width = t.w;
      c2.height = t.h;
      const x = c2.getContext('2d')!;
      x.fillStyle = '#fff';
      x.fillRect(0, 0, t.w, t.h);
      x.drawImage(c, 0, 0);
      b = await paraBlob(c2, tipo, 0.85);
    } else b = await paraBlob(c, tipo, 0.92);
  }
  if (!b || b.size > FOTO_MAX_GRAVADO) return null;
  return b as Arq;
}

/* Grava o arquivo e devolve o nome dele (o jogador guarda o nome no campo "foto"). */
export async function subirFoto(gid: string, pid: string, b: Arq): Promise<string> {
  const nome = nomeFoto(Date.now(), b.type);
  await subirArquivo(caminhoFoto(gid, pid, nome), b, chaveDemoFoto(gid, pid, nome));
  return nome;
}

/* Apaga o arquivo antigo (depois de trocar, remover ou excluir o jogador). */
export async function apagarFoto(gid: string, pid: string, nome: unknown): Promise<void> {
  if (!nomeFotoValido(nome)) return;
  await apagarArquivo(caminhoFoto(gid, pid, nome), chaveDemoFoto(gid, pid, nome));
}

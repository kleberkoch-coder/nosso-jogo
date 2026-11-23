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
import { fundoLiso } from '../dominio/fundo-liso';
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

/* KAN-301 (pelada-v127): a mesma foto sem o fundo liso, quando dá (fundo claro e sem cor encostando nas bordas).
   Devolve null quando o fundo não é liso, quando a foto já vem sem fundo ou quando não sobra nada para tirar. */
export async function semFundoLiso(f: Blob): Promise<Arq | null> {
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
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(im, 0, 0, t.w, t.h);
  const dados = ctx.getImageData(0, 0, t.w, t.h);
  const r = fundoLiso(dados.data, t.w, t.h);
  if (typeof r === 'string') return null;
  /* Tira o fundo e corta o espaço vazio em volta (a pessoa ocupa mais o card), com uma pequena margem. */
  let x0 = t.w,
    y0 = t.h,
    x1 = -1,
    y1 = -1;
  for (let p = 0; p < r.alfa.length; p++) {
    dados.data[p * 4 + 3] = r.alfa[p]!;
    if (r.alfa[p]! > 20) {
      const x = p % t.w,
        y = (p - x) / t.w;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  ctx.putImageData(dados, 0, 0);
  const mg = Math.round(Math.max(t.w, t.h) * 0.02);
  x0 = Math.max(0, x0 - mg);
  y0 = Math.max(0, y0 - mg);
  x1 = Math.min(t.w - 1, x1 + mg);
  y1 = Math.min(t.h - 1, y1 + mg);
  const c2 = document.createElement('canvas');
  c2.width = x1 - x0 + 1;
  c2.height = y1 - y0 + 1;
  c2.getContext('2d')!.drawImage(c, x0, y0, c2.width, c2.height, 0, 0, c2.width, c2.height);
  let b = await paraBlob(c2, 'image/webp', 0.9);
  if (!b || b.type !== 'image/webp') b = await paraBlob(c2, 'image/png', 0.92);
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

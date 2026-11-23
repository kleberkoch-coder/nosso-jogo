/* Logotipo do grupo (KAN-273): prepara a imagem no aparelho e grava no Firebase Storage. Baixa junto com o formulário
   do grupo (Editar grupo). A regra (tipos, limite, recorte, nome do arquivo) fica em dominio/logo.ts.
   - Firebase: a biblioteca do Storage só baixa aqui, na primeira troca de logotipo.
   - Modo demonstração: a imagem fica neste navegador (ui/logo-src.ts lê pela mesma chave). */
import { LOGO_LADO, LOGO_MAX_GRAVADO, nomeLogo, nomeLogoValido, recorteQuadrado } from '../dominio/logo';
import { abrirImagem, apagarArquivo, paraBlob, subirArquivo } from './arquivos-storage';
import { chaveDemo } from '../ui/logo-src';

type Arq = Blob & { type: string };

/* Corta no centro, reduz para 256 × 256 e grava em WebP (ou JPEG, se o navegador não gravar WebP). GIF animado: o
   navegador desenha só o primeiro quadro. Devolve null se a imagem não abrir. */
export async function prepararLogo(f: Blob): Promise<Arq | null> {
  let im: HTMLImageElement;
  try {
    im = await abrirImagem(f);
  } catch (e) {
    return null;
  }
  URL.revokeObjectURL(im.src);
  const r = recorteQuadrado(im.naturalWidth, im.naturalHeight);
  if (!r.lado) return null;
  const c = document.createElement('canvas');
  c.width = c.height = LOGO_LADO;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#fff'; // PNG transparente vira fundo branco (o JPEG não tem transparência)
  ctx.fillRect(0, 0, LOGO_LADO, LOGO_LADO);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(im, r.x, r.y, r.lado, r.lado, 0, 0, LOGO_LADO, LOGO_LADO);
  let b = await paraBlob(c, 'image/webp', 0.85);
  if (!b || b.type !== 'image/webp') b = await paraBlob(c, 'image/jpeg', 0.85);
  if (!b || b.size > LOGO_MAX_GRAVADO) return null;
  return b as Arq;
}

const caminho = (gid: string, nome: string) => 'grupos/' + gid + '/' + nome;

/* Grava o arquivo e devolve o nome dele (o grupo guarda o nome no campo "logo"). */
export async function subirLogo(gid: string, b: Arq): Promise<string> {
  const nome = nomeLogo(Date.now(), b.type);
  await subirArquivo(caminho(gid, nome), b, chaveDemo(gid, nome));
  return nome;
}

/* Apaga o arquivo antigo (depois de trocar ou remover). Se falhar, só sobra um arquivo sem uso. */
export async function apagarLogo(gid: string, nome: unknown): Promise<void> {
  if (!nomeLogoValido(nome)) return;
  await apagarArquivo(caminho(gid, nome), chaveDemo(gid, nome));
}

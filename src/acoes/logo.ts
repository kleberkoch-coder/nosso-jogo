/* Logotipo do grupo (KAN-273): prepara a imagem no aparelho e grava no Firebase Storage. Baixa junto com o formulário
   do grupo (Editar grupo). A regra (tipos, limite, recorte, nome do arquivo) fica em dominio/logo.ts.
   - Firebase: a biblioteca do Storage só baixa aqui, na primeira troca de logotipo.
   - Modo demonstração: a imagem fica neste navegador (ui/logo-src.ts lê pela mesma chave). */
import { LOGO_LADO, LOGO_MAX_GRAVADO, nomeLogo, nomeLogoValido, recorteQuadrado } from '../dominio/logo';
import * as banco from '../nucleo/backend.js';
import { chaveDemo } from '../ui/logo-src';

type Arq = Blob & { type: string };
const demo = () => !!(banco.B as { demo?: boolean } | null)?.demo;

function abrirImagem(f: Blob): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(f),
      im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('imagem'));
    im.src = url;
  });
}
const paraBlob = (c: HTMLCanvasElement, tipo: string, q: number) =>
  new Promise<Blob | null>(r => c.toBlob(b => r(b), tipo, q));

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

const lerDataUrl = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result));
    fr.onerror = rej;
    fr.readAsDataURL(b);
  });

type Ref = {
  put: (b: Blob, m: Record<string, string>) => Promise<unknown>;
  delete: () => Promise<unknown>;
};
type Fb = { storage: () => { ref: (p: string) => Ref } };

let carregando: Promise<void> | null = null;
function bibliotecaStorage(): Promise<Fb> {
  const fb = (window as unknown as { firebase: Fb & { SDK_VERSION?: string } }).firebase;
  if (typeof fb.storage === 'function') return Promise.resolve(fb);
  carregando =
    carregando ||
    new Promise<void>((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://www.gstatic.com/firebasejs/' + (fb.SDK_VERSION || '10.12.2') + '/firebase-storage-compat.js';
      s.onload = () => res();
      s.onerror = () => {
        carregando = null;
        rej(new Error('storage'));
      };
      document.head.appendChild(s);
    });
  return carregando.then(() => fb);
}
const caminho = (gid: string, nome: string) => 'grupos/' + gid + '/' + nome;

/* Grava o arquivo e devolve o nome dele (o grupo guarda o nome no campo "logo"). */
export async function subirLogo(gid: string, b: Arq): Promise<string> {
  const nome = nomeLogo(Date.now(), b.type);
  if (demo()) {
    localStorage.setItem(chaveDemo(gid, nome), await lerDataUrl(b));
    return nome;
  }
  const fb = await bibliotecaStorage();
  await fb
    .storage()
    .ref(caminho(gid, nome))
    .put(b, { contentType: b.type, cacheControl: 'public, max-age=31536000, immutable' });
  return nome;
}

/* Apaga o arquivo antigo (depois de trocar ou remover). Se falhar, só sobra um arquivo sem uso. */
export async function apagarLogo(gid: string, nome: unknown): Promise<void> {
  if (!nomeLogoValido(nome)) return;
  try {
    if (demo()) localStorage.removeItem(chaveDemo(gid, nome));
    else await (await bibliotecaStorage()).storage().ref(caminho(gid, nome)).delete();
  } catch (e) {
    console.warn('logo antigo', e);
  }
}

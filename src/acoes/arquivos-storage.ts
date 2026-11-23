/* Arquivos no Firebase Storage (logotipo do grupo, KAN-273; foto do jogador, KAN-293): a biblioteca do Storage só
   baixa na primeira gravação. No modo demonstração, o arquivo fica neste navegador (localStorage), na chave dada. */
import * as banco from '../nucleo/backend.js';

export function abrirImagem(f: Blob): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(f),
      im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('imagem'));
    im.src = url;
  });
}
export const paraBlob = (c: HTMLCanvasElement, tipo: string, q: number) =>
  new Promise<Blob | null>(r => c.toBlob(b => r(b), tipo, q));

export const demo = () => !!(banco.B as { demo?: boolean } | null)?.demo;

export const lerDataUrl = (b: Blob) =>
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

let carregando: Promise<void> | null = null,
  usandoEmulador = false;
export function bibliotecaStorage(): Promise<Fb> {
  const fb = (window as unknown as { firebase: Fb & { SDK_VERSION?: string } }).firebase;
  if (typeof fb.storage === 'function') return Promise.resolve(fb);
  /* Testes no emulador do Firebase (KAN-170): grava no Storage do emulador. */
  const em = (window as unknown as { FIREBASE_EMULADOR?: { storage?: string } }).FIREBASE_EMULADOR?.storage;
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
  return carregando.then(() => {
    if (em && !usandoEmulador) {
      usandoEmulador = true;
      const [h, p] = em.split(':');
      (fb.storage() as unknown as { useEmulator: (h: string, p: number) => void }).useEmulator(h!, +p!);
    }
    return fb;
  });
}

/* Grava o arquivo (no demo, no localStorage, na chave). */
export async function subirArquivo(caminho: string, b: Blob & { type: string }, chaveDemo: string): Promise<void> {
  if (demo()) {
    localStorage.setItem(chaveDemo, await lerDataUrl(b));
    return;
  }
  const fb = await bibliotecaStorage();
  await fb.storage().ref(caminho).put(b, { contentType: b.type, cacheControl: 'public, max-age=31536000, immutable' });
}

/* Apaga o arquivo. Se falhar, só sobra um arquivo sem uso. */
export async function apagarArquivo(caminho: string, chaveDemo: string): Promise<void> {
  try {
    if (demo()) localStorage.removeItem(chaveDemo);
    else await (await bibliotecaStorage()).storage().ref(caminho).delete();
  } catch (e) {
    console.warn('apagar arquivo', e);
  }
}

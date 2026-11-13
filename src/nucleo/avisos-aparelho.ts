/* Este celular e os avisos (KAN-242, pelada-v116): pedir a permissão, pegar o endereço de entrega do Firebase Cloud
   Messaging (token) e guardar em usuarios/{conta}/aparelhos/{id}. Baixa só quando a pessoa abre "Avisos no celular",
   quando sai da conta com os avisos ligados, ou para renovar o token de quem já ligou.
   No modo demonstração (sem Firebase) o token é de mentira: a tela funciona, mas nada chega. */
import * as banco from './backend.js';
import { S } from './estado.js';
import { LOCAL } from '../i18n/formatos.js';

type Obj = Record<string, any>;
const st = (): Obj => S as Obj;
/* O banco é trocado ao iniciar (setB): lido na hora. */
const bk = (): Obj => (banco as Obj).B;
const w = window as unknown as Obj;
const CHAVE = 'nj-avisos';
const VERSAO_SDK = '10.12.2';

export type Estado = 'semSuporte' | 'instalarIphone' | 'negado' | 'desligado' | 'ligado';

const lerLocal = (): { id?: string; uid?: string } => {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) || '{}') || {};
  } catch (e) {
    return {};
  }
};
const gravarLocal = (o: { id?: string; uid?: string } | null) => {
  try {
    if (o) localStorage.setItem(CHAVE, JSON.stringify(o));
    else localStorage.removeItem(CHAVE);
  } catch (e) {
    /* sem armazenamento: o aparelho só não lembra que ligou */
  }
};
/* Ligado neste celular, para esta conta? (sem ler o banco) */
export const ligadoAqui = () => {
  const l = lerLocal();
  return !!(l.id && st().user && l.uid === st().user.uid);
};

export const ehIphone = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const instalado = () => matchMedia('(display-mode: standalone)').matches || (navigator as Obj).standalone === true;
const demo = () => !(w.FIREBASE_CONFIG && w.FIREBASE_CONFIG.apiKey);

export function estado(): Estado {
  const temPush = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  /* No iPhone, os avisos só existem com o app instalado na tela de início (iOS 16.4 ou mais novo). */
  if (ehIphone() && !instalado() && !demo()) return 'instalarIphone';
  if (!temPush || (!demo() && !w.VAPID_KEY && !w.__njTokenTeste)) return 'semSuporte';
  if (Notification.permission === 'denied') return 'negado';
  return ligadoAqui() ? 'ligado' : 'desligado';
}

function carregarScript(src: string) {
  return new Promise((ok, erro) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = ok;
    s.onerror = erro;
    document.head.appendChild(s);
  });
}
let mensagens: Obj | null = null;
async function sdk(): Promise<Obj> {
  if (mensagens) return mensagens;
  const fb = w.firebase as Obj;
  if (!fb.messaging)
    await carregarScript('https://www.gstatic.com/firebasejs/' + VERSAO_SDK + '/firebase-messaging-compat.js');
  mensagens = fb.messaging();
  return mensagens!;
}

async function pegarToken(): Promise<string> {
  if (demo()) return 'demo-token';
  /* Roteiro de gravação no emulador (KAN-170): sem o Firebase Cloud Messaging de verdade. */
  if (w.__njTokenTeste) return w.__njTokenTeste;
  const m = await sdk();
  const reg = await navigator.serviceWorker.ready;
  return m.getToken({ vapidKey: w.VAPID_KEY, serviceWorkerRegistration: reg });
}

const plataforma = () => (ehIphone() ? 'ios' : /android/i.test(navigator.userAgent) ? 'android' : 'web');

/* Liga neste celular: pede a permissão (uma vez) e guarda o token. Devolve o estado depois. */
export async function ligar(): Promise<Estado> {
  const B = bk();
  const uid = st().user && st().user.uid;
  if (!uid) return 'desligado';
  const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (p !== 'granted') return p === 'denied' ? 'negado' : 'desligado';
  const token = await pegarToken();
  const id = lerLocal().id || B.newId();
  await B.set('usuarios/' + uid + '/aparelhos/' + id, { token, lang: LOCAL, em: Date.now(), plat: plataforma() });
  gravarLocal({ id, uid });
  return 'ligado';
}

/* Desliga neste celular (e ao sair da conta): apaga o registro e o token. Sem internet, apaga o que der. */
export async function desligar(): Promise<void> {
  const B = bk();
  const l = lerLocal();
  gravarLocal(null);
  const tarefas: Promise<unknown>[] = [];
  if (l.id && l.uid) tarefas.push(B.del('usuarios/' + l.uid + '/aparelhos/' + l.id));
  if (!demo() && w.firebase && w.firebase.messaging)
    tarefas.push(
      sdk()
        .then(m => m.deleteToken())
        .catch(() => {})
    );
  await Promise.race([Promise.allSettled(tarefas), new Promise(r => setTimeout(r, 3000))]);
}

/* Quem já ligou: confere o token de vez em quando (o Firebase pode trocar) e o idioma. */
export async function renovar(): Promise<void> {
  const B = bk();
  if (!ligadoAqui() || demo() || Notification.permission !== 'granted') return;
  const l = lerLocal(),
    caminho = 'usuarios/' + l.uid + '/aparelhos/' + l.id;
  try {
    const [token, atual] = await Promise.all([pegarToken(), B.get(caminho)]);
    if (token && (!atual || atual.token !== token || atual.lang !== LOCAL))
      await B.set(caminho, { token, lang: LOCAL, em: Date.now(), plat: plataforma() });
  } catch (e) {
    console.warn('avisos: renovar', e);
  }
}

import { $, toast } from './nucleo/util.js';
import { openDlg } from './ui/dialogos.js';

/* =================== PWA =================== */
function isStandalone() {
  return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}
let installEvt = null;
const ib = $('#installBtn');
const isIOS =
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  installEvt = e;
  if (!isStandalone()) ib.hidden = false;
});
window.addEventListener('appinstalled', () => {
  ib.hidden = true;
  installEvt = null;
  toast('App instalado.');
});
if (isIOS && !isStandalone() && location.protocol.startsWith('http')) ib.hidden = false;
ib.addEventListener('click', async () => {
  if (installEvt) {
    installEvt.prompt();
    const r = await installEvt.userChoice;
    if (r.outcome === 'accepted') ib.hidden = true;
    installEvt = null;
    return;
  }
  openDlg(`<h3>Instalar no celular</h3>${
    isIOS
      ? `<ol class="small" style="padding-left:18px;line-height:1.8"><li>Abra esta página no <b>Safari</b>.</li><li>Toque no botão <b>Compartilhar</b> (quadrado com seta para cima).</li><li>Escolha <b>Adicionar à Tela de Início</b> e confirme.</li></ol>`
      : `<ol class="small" style="padding-left:18px;line-height:1.8"><li>Abra o menu do navegador (⋮).</li><li>Toque em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</li></ol>`
  }
  <p class="small muted">O ícone do Nosso Jogo aparece junto dos seus apps e abre direto, em tela cheia.</p><div class="dlg-f"><button class="btn primary" data-a="close">Entendi</button></div>`);
});
const netBar = () => {
  $('#net').hidden = navigator.onLine;
};
window.addEventListener('online', netBar);
window.addEventListener('offline', netBar);
netBar();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('sw.js')
      .then(reg => {
        const show = () => {
          $('#upd').hidden = false;
        };
        if (reg.waiting && navigator.serviceWorker.controller) show();
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          nw &&
            nw.addEventListener('statechange', () => {
              if (nw.state === 'installed' && navigator.serviceWorker.controller) show();
            });
        });
        $('#updBtn').onclick = () => {
          (reg.waiting || reg.installing)?.postMessage('skipWaiting');
        };
        setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
      })
      .catch(() => {});
  });
  /* Só recarrega quando uma versão nova substitui a antiga. Na primeira visita não recarrega,
     para não apagar o que a pessoa já começou a digitar. */
  const hadCtrl = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded || !hadCtrl) return;
    reloaded = true;
    location.reload();
  });
}

export { isStandalone };

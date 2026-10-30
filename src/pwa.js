import { $, toast } from './nucleo/util.js';
import { openDlg } from './ui/dialogos.js';
import { tx } from './i18n/index.js';

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
  toast(tx('pwa.instalado'));
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
  const passos = isIOS ? ['pwa.ios1', 'pwa.ios2', 'pwa.ios3'] : ['pwa.and1', 'pwa.and2'];
  openDlg(`<h3>${tx('pwa.titulo')}</h3><ol class="small" style="padding-left:18px;line-height:1.8">${passos.map(k => `<li>${tx(k)}</li>`).join('')}</ol>
  <p class="small muted">${tx('pwa.icone')}</p><div class="dlg-f"><button class="btn primary" data-a="close">${tx('comum.entendi')}</button></div>`);
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

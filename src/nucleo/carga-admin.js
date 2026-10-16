/* Carrega a parte de gestão do app (src/admin.js) na primeira vez que ela é necessária (KAN-149).
   Depois de carregada, as ações de gestão entram no mesmo mapa de botões (ACT). */
import { ACT } from '../acoes.js';

/* Pede ao service worker para guardar a gestão neste aparelho (para abrir sem internet). */
function guardarParaOffline() {
  try {
    navigator.serviceWorker?.ready.then(r => r.active?.postMessage('gestao')).catch(() => {});
  } catch (e) {
    /* sem service worker */
  }
}

let ADM = null,
  carregando = null;
const adm = () => ADM;
function carregarAdmin() {
  return (
    carregando ||
    (carregando = import('../admin.js')
      .then(m => {
        Object.assign(ACT, m.ACOES);
        ADM = m;
        guardarParaOffline();
        return m;
      })
      .catch(e => {
        carregando = null;
        throw e;
      }))
  );
}

export { adm, carregarAdmin };

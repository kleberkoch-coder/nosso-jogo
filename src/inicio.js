import { B, FirebaseBackend, LocalBackend, setB, wrapBackend } from './nucleo/backend.js';
import { S } from './nucleo/estado.js';
import { $, main, toast } from './nucleo/util.js';
import { isStandalone } from './pwa.js';
import { setupRoute } from './rotas.js';
import { carregarEntrar } from './nucleo/carga-entrar';
import { render } from './ui/render.js';
import { applyTheme } from './ui/tema.js';
import { tx } from './i18n/index.js';

/* =================== boot =================== */
const ORG_K = 'nj-organizador';
function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = res;
    s.onerror = rej;
    document.head.appendChild(s);
  });
}
async function boot() {
  applyTheme();
  $('#net').textContent = tx('comum.semInternetBarra');
  const C = window.FIREBASE_CONFIG || {};
  if (C.apiKey && C.projectId) {
    try {
      const v = '10.12.2',
        base = `https://www.gstatic.com/firebasejs/${v}/`;
      await loadScript(base + 'firebase-app-compat.js');
      await loadScript(base + 'firebase-auth-compat.js');
      await loadScript(base + 'firebase-firestore-compat.js');
      /* App Check (KAN-88): prova invisível de que a chamada vem do app oficial. Se o script não carregar, o app segue (enquanto a proteção não estiver ligada no console). */
      const ak = window.APP_CHECK_KEY;
      if (ak) {
        try {
          await loadScript(base + 'firebase-app-check-compat.js');
        } catch (e) {
          console.warn('App Check não carregou', e);
        }
      }
      setB(wrapBackend(FirebaseBackend(C, ak)));
    } catch (e) {
      main.innerHTML =
        '<div class="panel empty"><h2>Não foi possível carregar</h2><p class="muted">Verifique sua conexão e recarregue a página.</p></div>';
      return;
    }
  } else setB(wrapBackend(LocalBackend()));
  // Testes (KAN-170): o roteiro espera as gravações chegarem ao banco antes de recarregar a página.
  if (window.S) window.__njPendentes = ms => B.semPendencias(ms);
  try {
    S.authMode = localStorage.getItem('pelada-mode') || 'signup';
  } catch (e) {
    S.authMode = 'signup';
  }
  if (B.redirectResult)
    /* Volta do login com Google por redirecionamento: a tela de entrar (KAN-183) só baixa se houver algo a avisar. */
    B.redirectResult()
      .then(r => {
        if (!(r && r.additionalUserInfo)) return;
        return carregarEntrar().then(m => {
          const av = m.avisoGoogle(r, S.authMode);
          if (av) setTimeout(() => toast(av, 6000), 300);
        });
      })
      .catch(e =>
        carregarEntrar().then(m => {
          if (m.AUTH_CANCEL.includes(e && e.code)) return;
          console.warn(e);
          const msg = m.authMsg(e);
          setTimeout(() => {
            const le = $('#lerr');
            if (le) le.textContent = msg;
            else toast(msg, 6000);
          }, 300);
        })
      );
  let first = true;
  B.onAuth(u => {
    const prev = S.user;
    S.user = u;
    /* KAN-171: aparelho em que alguém já entrou com conta é de organizador. A marca fica mesmo depois de Sair,
       e esse aparelho nunca é levado sozinho para o último link de jogador. */
    let organizador = false;
    try {
      if (u && !u.anon) localStorage.setItem(ORG_K, '1');
      organizador = localStorage.getItem(ORG_K) === '1';
    } catch (e) {}
    if (first && !organizador && isStandalone() && (!location.hash || location.hash === '#/') && (!u || u.anon)) {
      let last = null;
      try {
        last = localStorage.getItem('pelada-last');
      } catch (e) {}
      if (last) {
        first = false;
        S.user = u;
        location.hash = last;
        return;
      }
    }
    const changedUser = first || prev?.uid !== u?.uid;
    first = false;
    if (changedUser) {
      S.me = null;
      S.homeShown = false;
      setupRoute();
    } else render();
  });
  window.addEventListener('hashchange', setupRoute);
}

export { boot };

/* Ponto de partida do Portal do Nosso Jogo (site separado, KAN-116). Usa o mesmo Firebase do app,
   mas nenhuma tela do app dos clientes: só o login com o Google e a lista de clientes. */
import '../estilos/app.css';
import { FirebaseBackend, LocalBackend } from '../nucleo/backend.js';
import { ligar } from './tela.js';

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = res;
    s.onerror = rej;
    document.head.appendChild(s);
  });
}
(async () => {
  const C = window.FIREBASE_CONFIG || {};
  if (C.apiKey && C.projectId) {
    try {
      const v = '10.12.2',
        base = `https://www.gstatic.com/firebasejs/${v}/`;
      await loadScript(base + 'firebase-app-compat.js');
      await loadScript(base + 'firebase-auth-compat.js');
      await loadScript(base + 'firebase-firestore-compat.js');
      const ak = window.APP_CHECK_KEY;
      if (ak) {
        try {
          await loadScript(base + 'firebase-app-check-compat.js');
        } catch (e) {}
      }
      ligar(FirebaseBackend(C, ak));
    } catch (e) {
      document.getElementById('pmain').innerHTML =
        '<div class="panel empty"><p class="muted">Não foi possível carregar. Verifique a conexão e recarregue a página.</p></div>';
    }
  } else {
    document.getElementById('demo').hidden = false;
    ligar(LocalBackend());
  }
})();

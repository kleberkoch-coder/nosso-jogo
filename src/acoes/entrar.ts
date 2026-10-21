/* Ações da tela de entrar e criar conta (KAN-183): baixam junto com a tela (src/entrar.ts), fora do link do jogador. */
import { tx } from '../i18n/index.js';
import { copyText } from '../eventos.js';
import * as banco from '../nucleo/backend.js';
import { S as estado } from '../nucleo/estado.js';
import { $, inAppBrowser, toast } from '../nucleo/util.js';
import { AUTH_CANCEL, authMsg, avisoGoogle, pwFalta, pwOk } from '../telas/login.js';
import { openDlg, val } from '../ui/dialogos.js';
import { render } from '../ui/render.js';

// O estado e o banco ainda são JavaScript sem tipos; o banco é lido na hora (setB troca o banco ao iniciar).
const S = estado as any,
  bk = (): any => (banco as any).B;

const acoes = {
  authMode: (el: HTMLElement) => {
    const em = val('le');
    S.authMode = el.dataset.v;
    try {
      localStorage.setItem('pelada-mode', S.authMode);
    } catch (e) {}
    render();
    const i = $('#le');
    if (i) {
      i.value = em;
      (em ? $('#lp') : i).focus();
    }
  },
  login: async () => {
    const e = val('le'),
      p = $('#lp').value;
    $('#lerr').textContent = '';
    if (!e || !p) {
      $('#lerr').textContent = tx('auth.preencha');
      return;
    }
    try {
      await bk().login(e, p);
      try {
        localStorage.setItem('pelada-mode', 'login');
      } catch (x) {}
    } catch (x) {
      $('#lerr').textContent = authMsg(x);
    }
  },
  signup: async () => {
    S.paisNovo = val('lpais') || S.paisNovo;
    const e = val('le'),
      p = $('#lp').value;
    if (!pwOk(p)) {
      $('#lerr').textContent = tx('auth.senhaFalta', { itens: pwFalta(p).join(', ') });
      return;
    }
    if (p !== $('#lp2').value) {
      $('#lerr').textContent = tx('senha.naoConferem');
      return;
    }
    $('#lerr').textContent = '';
    try {
      await bk().signup(e, p);
      try {
        localStorage.setItem('pelada-mode', 'login');
      } catch (x) {}
    } catch (x) {
      $('#lerr').textContent = authMsg(x, p);
    }
  },
  google: async () => {
    const le = $('#lerr');
    if (le) le.textContent = '';
    if (!bk().demo && inAppBrowser()) {
      openDlg(`<h3>Abra no navegador</h3><p>O Google não permite entrar por dentro deste aplicativo. Abra o link no <b>Chrome</b> ou no <b>Safari</b> e toque de novo em <b>Continuar com o Google</b>.</p>
      <p class="small muted">Dica: toque nos três pontinhos (⋮ ou ⋯) no canto da tela e escolha <b>Abrir no navegador</b>. Ou entre com e-mail e senha aqui mesmo.</p>
      <div class="dlg-f"><button class="btn" data-a="close">Fechar</button><button class="btn primary" data-a="copyHere">Copiar link</button></div>`);
      return;
    }
    if (S.authMode === 'signup') S.paisNovo = val('lpais') || S.paisNovo;
    try {
      const modo = S.authMode,
        r = await bk().google(val('le')),
        av = avisoGoogle(r, modo);
      if (av) toast(av, 6000);
      try {
        localStorage.setItem('pelada-mode', 'login');
      } catch (x) {}
    } catch (x) {
      if (AUTH_CANCEL.includes(String((x as { code?: string } | null)?.code))) return;
      console.warn(x);
      const m = authMsg(x);
      if ($('#lerr')) $('#lerr').textContent = m;
      else toast(m, 6000);
    }
  },
  copyHere: () => copyText(location.href),
  reset: async () => {
    const e = val('le');
    if (!e) {
      $('#lerr').textContent = tx('auth.digiteEmail');
      return;
    }
    try {
      await bk().reset(e);
      toast(tx('auth.linkEnviado', { email: e }));
    } catch (x) {
      $('#lerr').textContent = authMsg(x);
    }
  },
  /* Mostrar/ocultar a senha enquanto digita (pelada-v17). */
  verSenha: (el: HTMLElement) => {
    const i = $('#' + el.dataset.v);
    if (!i) return;
    const on = i.type === 'password';
    i.type = on ? 'text' : 'password';
    el.setAttribute('aria-pressed', String(on));
    el.textContent = tx(on ? 'login.ocultar' : 'login.mostrar');
    el.setAttribute('aria-label', tx(on ? 'login.ocultarSenha' : 'login.mostrarSenha'));
    i.focus();
  },
};

export { acoes };

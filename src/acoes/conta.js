/* Ações: Conta, login, tema e diálogos gerais. Fazem parte de ACT (src/acoes.js). */
import { tx } from '../i18n/index.js';
import { copyText } from '../eventos.js';
import { B } from '../nucleo/backend.js';
import { S } from '../nucleo/estado.js';
import { $, inAppBrowser, toast } from '../nucleo/util.js';
import { avisar, closeDlg, confirmou, dlg, naoConfirmar, openDlg, responder, val } from '../ui/dialogos.js';
import { render } from '../ui/render.js';
import { TEMA_K, applyTheme, closeThemeMenu, openThemeMenu, themeAnchor, themeMenuEl } from '../ui/tema.js';
import { ACT } from '../acoes.js';
import { abrirMenuConta } from '../ui/menu-conta.ts';

async function sairDaConta(destino, el) {
  if (!(el && el._conf === 'sim') && !(await B.semPendencias(3000))) {
    confirmou(el, {
      titulo: tx('sair.pendentesTitulo'),
      texto: tx('sair.pendentes'),
      acao: tx('sair.mesmoAssim'),
      perigo: true,
    });
    return;
  }
  if (el) delete el._conf;
  const limpou = await B.logout();
  if (limpou === false) await avisar(tx('sair.outrasAbasTitulo'), tx('sair.outrasAbas'));
  try {
    sessionStorage.clear();
  } catch (e) {}
  location.replace(location.pathname + location.search + destino);
  location.reload();
}
const acoes = {
  tab: el => {
    S.tab = el.dataset.v;
    render();
    window.scrollTo(0, 0);
  },
  /* Menu da conta (KAN-166): abre e fecha como o do tema. */
  contaMenu: el => {
    if (themeMenuEl && themeAnchor === el) {
      closeThemeMenu(true);
      return;
    }
    abrirMenuConta(el);
  },
  /* Tema pelo menu da conta (KAN-169): abre as três opções no mesmo lugar do menu da conta. */
  temaConta: () => {
    const b = $('#topright [data-a=contaMenu]');
    if (b) openThemeMenu(b);
  },
  themeMenu: el => {
    if (themeMenuEl && themeAnchor === el) {
      closeThemeMenu(true);
      return;
    }
    openThemeMenu(el);
  },
  setTheme: el => {
    const t = el.dataset.v;
    try {
      if (t === 'auto') localStorage.removeItem(TEMA_K);
      else localStorage.setItem(TEMA_K, t);
    } catch (e) {}
    const fromMenu = !!el.closest('.theme-menu');
    closeThemeMenu(fromMenu);
    applyTheme();
    render();
  },
  close: closeDlg,
  /* Janela de confirmação do app (KAN-128) */
  confSim: () => responder('sim', ACT),
  confOutro: () => responder('nao', ACT),
  confNao: () => naoConfirmar(),
  copy: () => {
    const t = $('#shtxt');
    copyText(t.value, t);
  },
  /* Sair (KAN-80): confere se ficou algo sem enviar, desconecta, apaga os dados do grupo guardados neste aparelho e recarrega. */
  logout: el => sairDaConta('#/', el),
  invSwitch: el => sairDaConta(location.hash, el),
};

export { acoes, sairDaConta };

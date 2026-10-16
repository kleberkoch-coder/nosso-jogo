/* Menu da conta (KAN-166): o botão redondo com a inicial do e-mail, no canto do cabeçalho, como nos apps conhecidos.
   Junta o que é da pessoa (e não do grupo): o e-mail, o país da conta (que vale para os grupos novos) e o Sair.
   Montado elemento por elemento, sem HTML em texto. As ações (contaPais, logout) são as de sempre. */
import { LOCAL } from '../i18n/formatos.js';
import { tx } from '../i18n/index.js';
import { carregarAdmin } from '../nucleo/carga-admin.js';
import { S as estado } from '../nucleo/estado.js';
import { abrirMenu, closeThemeMenu } from './tema.js';

const st = (): any => estado;
const inicial = (email: string) => (String(email || '?').trim()[0] || '?').toUpperCase();
const { fromCodePoint } = String;
const bandeira = (iso: string) => fromCodePoint(...[...iso].map(c => 127397 + c.charCodeAt(0)));
function nomePais(iso: string) {
  try {
    return new Intl.DisplayNames([LOCAL], { type: 'region' }).of(iso) || iso;
  } catch (e) {
    return iso;
  }
}

/* Botão do cabeçalho. */
export function botaoConta(): HTMLButtonElement {
  const email = (st().user && st().user.email) || '',
    b = document.createElement('button');
  b.className = 'chip conta-chip';
  b.dataset.a = 'contaMenu';
  b.setAttribute('aria-haspopup', 'menu');
  b.setAttribute('aria-expanded', 'false');
  b.setAttribute('aria-label', tx('conta.menu', { email }));
  b.title = email;
  b.textContent = inicial(email);
  return b;
}

function item(icone: string, texto: string, acao: string, dica?: string) {
  const b = document.createElement('button'),
    ic = document.createElement('span');
  b.setAttribute('role', 'menuitem');
  b.dataset.a = acao;
  ic.className = 'ic';
  ic.setAttribute('aria-hidden', 'true');
  ic.textContent = icone;
  b.append(ic, texto);
  if (dica) {
    const h = document.createElement('span');
    h.className = 'hint';
    h.textContent = dica;
    b.append(h);
  }
  return b;
}

/* Abre o menu: e-mail, "País e formatos" (com o país atual) e "Sair". Tocar num item fecha o menu. */
export function abrirMenuConta(anchor: HTMLElement) {
  carregarAdmin().catch(() => {}); // "País e formatos" é da gestão; quem tem conta já costuma ter baixado
  const S = st(),
    pais = (S.me && S.me.pais) || 'BR';
  abrirMenu(anchor, tx('conta.titulo'), (m: HTMLElement) => {
    const t = document.createElement('p');
    t.className = 'tm-t conta-email';
    t.textContent = (S.user && S.user.email) || '';
    const sep = document.createElement('hr');
    sep.className = 'menu-sep';
    m.append(
      t,
      item('🌐', tx('conta.pais'), 'contaPais', bandeira(pais) + ' ' + nomePais(pais)),
      sep,
      item('↪', tx('conta.sair'), 'logout')
    );
    m.addEventListener('click', (e: Event) => {
      if ((e.target as HTMLElement).closest('[data-a]')) setTimeout(() => closeThemeMenu(), 0);
    });
  });
}

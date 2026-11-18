/* Menu da conta (KAN-166): o botão redondo com a inicial do e-mail, no canto do cabeçalho, como nos apps conhecidos.
   Junta o que é da pessoa (e não do grupo): o e-mail, o país da conta (que vale para os grupos novos), o tema
   (KAN-169: com conta, o botão do tema sai do cabeçalho) e o Sair.
   Montado elemento por elemento, sem HTML em texto. As ações (contaPais, logout) são as de sempre. */
import { LOCAL } from '../i18n/formatos.js';
import { tx } from '../i18n/index.js';
import { IDIOMAS } from '../i18n/idiomas';
import { S as estado } from '../nucleo/estado.js';
import { abrirMenu } from './tema.js';

const st = () => estado;
const inicial = (email: string) => (String(email || '?').trim()[0] || '?').toUpperCase();

/* Idioma (KAN-164): as opções abrem no mesmo lugar do menu da conta, como o tema. Cada nome aparece na própria língua. */
export function abrirMenuIdioma(anchor: HTMLElement) {
  abrirMenu(anchor, tx('conta.idioma'), (m: HTMLElement) => {
    const p = document.createElement('p');
    p.className = 'tm-t';
    p.setAttribute('aria-hidden', 'true');
    p.textContent = tx('conta.idioma');
    m.append(
      p,
      ...IDIOMAS.map(({ id, nome }) => {
        const b = document.createElement('button');
        b.setAttribute('role', 'menuitemradio');
        b.setAttribute('aria-checked', String(LOCAL === id));
        b.setAttribute('lang', id);
        b.dataset.a = 'setIdioma';
        b.dataset.v = id;
        b.textContent = nome;
        return b;
      })
    );
  });
}

/* Botão do cabeçalho. */
export function botaoConta(): HTMLButtonElement {
  const email = st().user?.email || '',
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

/* KAN-274 (pelada-v119): o menu aberto (e-mail, País e formatos, Tema, Idioma, Plano, Avisos e Sair) baixa no primeiro
   toque no botão (ui/menu-conta-aberto.ts), porque o link do jogador nunca o usa. */
export const abrirMenuConta = (anchor: HTMLElement) =>
  import('./menu-conta-aberto').then(m => m.abrirMenuConta(anchor));

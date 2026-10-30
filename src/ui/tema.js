import { w } from '../nucleo/estado.js';
import { render } from './render.js';
import { tx } from '../i18n/index.js';

/* =================== tema (Automático, Claro, Escuro) =================== */
/* A escolha fica salva neste aparelho e vale para todos, inclusive jogadores sem conta. */
/* O terceiro item é a chave do nome no dicionário (tx). */
const THEMES = [
  ['auto', '🌓', 'tema.auto'],
  ['light', '☀️', 'tema.claro'],
  ['dark', '🌙', 'tema.escuro'],
];
const TEMA_K = 'nj-tema';
const darkMQ = matchMedia('(prefers-color-scheme: dark)');
function getTheme() {
  try {
    const t = localStorage.getItem(TEMA_K);
    return t === 'light' || t === 'dark' ? t : 'auto';
  } catch (e) {
    return 'auto';
  }
}
function effTheme() {
  const t = getTheme();
  return t === 'auto' ? (darkMQ.matches ? 'dark' : 'light') : t;
}
const themeDef = () => THEMES.find(x => x[0] === getTheme());
const themeLabel = () => tx('tema.rotulo', { tema: tx(themeDef()[2]) });
function applyTheme() {
  const t = getTheme(),
    h = document.documentElement;
  if (t === 'auto') h.removeAttribute('data-theme');
  else h.setAttribute('data-theme', t);
  const m = document.querySelector('meta[name=theme-color]');
  if (m) m.content = effTheme() === 'dark' ? '#173A2A' : '#1F5A40';
  document.querySelectorAll('[data-a=themeMenu]').forEach(b => {
    b.textContent = themeDef()[1];
    b.setAttribute('aria-label', themeLabel());
    b.title = themeLabel();
  });
}
/* Opções do menu do tema, montadas como elementos (sem HTML em texto). */
function themeOpts() {
  const t = getTheme(),
    agora = tx(effTheme() === 'dark' ? 'tema.agoraEscuro' : 'tema.agoraClaro');
  return THEMES.map(([k, ic, l]) => {
    const b = document.createElement('button'),
      s = document.createElement('span');
    b.setAttribute('role', 'menuitemradio');
    b.setAttribute('aria-checked', String(t === k));
    b.dataset.a = 'setTheme';
    b.dataset.v = k;
    s.className = 'ic';
    s.setAttribute('aria-hidden', 'true');
    s.textContent = ic;
    b.append(s, tx(l));
    if (k === 'auto') {
      const h = document.createElement('span');
      h.className = 'hint';
      h.textContent = agora;
      b.append(h);
    }
    return b;
  });
}
let themeMenuEl = null,
  themeAnchor = null;
function closeThemeMenu(back) {
  if (!themeMenuEl) return;
  themeMenuEl.remove();
  themeMenuEl = null;
  if (themeAnchor) {
    themeAnchor.setAttribute('aria-expanded', 'false');
    if (back && themeAnchor.isConnected) themeAnchor.focus({ preventScroll: true });
  }
  themeAnchor = null;
}
/* Menu que abre embaixo de um botão do cabeçalho: o do tema e, desde a v48, o da conta (KAN-166).
   Setas, Esc e tocar fora funcionam igual nos dois (eventos.js). */
function abrirMenu(anchor, rotulo, montar) {
  closeThemeMenu();
  themeAnchor = anchor;
  anchor.setAttribute('aria-expanded', 'true');
  const m = document.createElement('div');
  m.className = 'theme-menu';
  m.setAttribute('role', 'menu');
  m.setAttribute('aria-label', rotulo);
  montar(m);
  document.body.appendChild(m);
  themeMenuEl = m;
  const r = anchor.getBoundingClientRect(),
    w = m.offsetWidth;
  m.style.top = Math.round(r.bottom + scrollY + 8) + 'px';
  m.style.left = Math.round(scrollX + Math.max(8, Math.min(innerWidth - w - 8, r.right - w))) + 'px';
  (m.querySelector('[aria-checked=true]') || m.querySelector('button')).focus({ preventScroll: true });
}
function openThemeMenu(anchor) {
  abrirMenu(anchor, tx('tema.titulo'), m => {
    const p = document.createElement('p');
    p.className = 'tm-t';
    p.setAttribute('aria-hidden', 'true');
    p.textContent = tx('tema.titulo');
    m.append(p, ...themeOpts());
  });
}
/* Quando o celular troca entre claro e escuro, o modo Automático acompanha. */
darkMQ.addEventListener('change', () => {
  applyTheme();
  if (getTheme() === 'auto') render();
});

export {
  THEMES,
  effTheme,
  getTheme,
  TEMA_K,
  abrirMenu,
  applyTheme,
  closeThemeMenu,
  openThemeMenu,
  themeAnchor,
  themeDef,
  themeLabel,
  themeMenuEl,
};

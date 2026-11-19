import { APP, sport, sportName } from '../dominio/esportes.js';
import {
  curRodada,
  fdia,
  gname,
  grpAtivo,
  grpBloq,
  isAdmin,
  isOwnerMe,
  posso,
  recurso,
  soVer,
} from '../dominio/grupo.js';
import { hora } from '../dominio/rodadas.js';
import { B, applyBusy } from '../nucleo/backend.js';
import { S } from '../nucleo/estado.js';
import { $, fdate, main } from '../nucleo/util.js';
import { isStandalone } from '../pwa.js';
import { ensurePres, ensureVotos } from '../rotas';
import { adm, carregarAdmin } from '../nucleo/carga-admin.js';
import { tx } from '../i18n/index.js';
import { LOCAL } from '../i18n/formatos.js';
import { IDIOMAS } from '../i18n/idiomas.ts';
import { desmontarPublico } from '../telas/PublicoRodada.tsx';
import { botaoConta } from './menu-conta.ts';
import { srcLogo } from './logo-src';
import { carregarEntrar, entrarPronto } from '../nucleo/carga-entrar';
import { renderPublicRodada } from '../telas/publico-rodada.js';

/* =================== render =================== */
/* Parte do app que baixa sob demanda (gestão, apresentação, aba Partida): mostra "Carregando…" e desenha de novo quando
   chega; sem internet, avisa que não carregou. */
let apresentacao = null,
  voto = null,
  aval = null,
  rapido = null;
function baixar(promessa, guardar, onde = main) {
  onde.replaceChildren(el('div', 'empty muted', tx('comum.carregando')));
  promessa.then(
    m => {
      if (guardar) guardar(m);
      render();
    },
    () => {
      const p = el('div', 'panel empty');
      p.append(el('h2', '', tx('comum.naoCarregouTitulo')), el('p', 'muted', tx('comum.naoCarregou')));
      onde.replaceChildren(p);
    }
  );
}
let rq = false;
function changed() {
  if (rq) return;
  rq = true;
  requestAnimationFrame(() => {
    rq = false;
    render();
  });
}
/* Abas de recursos do Plano A (KAN-119): sem o recurso, a aba aparece com o cadeado e o convite. */
const travada = k => (k === 'caixa' || k === 'votacao' || k === 'historico') && !recurso(k);
/* Elemento simples sem montar HTML como texto (KAN-154). */
function el(tag, cls, txt, attrs) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt) e.textContent = txt;
  if (attrs) for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}
/* Lugar vazio onde uma tela (componente) se desenha: as telas devolvem o id do lugar delas (vRodada, vCaixa…). */
const lugar = id => el('div', '', '', { id });
function render() {
  renderCore();
  applyBusy();
  subtituloCompleto();
}
/* KAN-146: texto que pode ser longo (local, subtítulo) fica numa linha só, com "…". Quando corta, o texto inteiro aparece
   ao passar o mouse (title) e ao tocar nele, que abre e fecha (no celular não existe "passar o mouse"). Vale para #gsub, o nome do grupo no celular (#gname, KAN-194) e [data-corta]. */
function subtituloCompleto() {
  document.querySelectorAll('#gsub,#gname,[data-corta]').forEach(g => {
    const ab = g.classList.contains('aberto'),
      corta = ab || g.scrollWidth > g.clientWidth + 1;
    g.classList.toggle('cortado', corta && !ab);
    if (corta) {
      g.title = g.textContent;
      g.setAttribute('role', 'button');
      g.tabIndex = 0;
      g.setAttribute('aria-expanded', String(ab));
    } else {
      g.removeAttribute('title');
      g.removeAttribute('role');
      g.removeAttribute('tabindex');
      g.removeAttribute('aria-expanded');
    }
  });
}
/* KAN-283: "← Início" no computador e só "←" (chip-ic, 36 × 36px) até 420px, com o nome inteiro para o leitor de tela. */
function voltarInicio() {
  const a = el('a', 'chip chip-volta', '', { href: '#/', 'aria-label': tx('render.voltarInicio') }),
    curto = el('span', 'cab-curto', '←'),
    longo = el('span', 'cab-longo', tx('render.inicio'));
  a.append(curto, longo);
  return a;
}
function renderCore() {
  document.body.classList.remove('is-landing');
  $('#gsub').classList.remove('sub-app');
  const demo = $('#demo');
  demo.hidden = !(B && B.demo);
  if (!demo.hidden) demo.textContent = tx('demo.aviso'); // KAN-164: no idioma da pessoa
  const R = S.route,
    logged = !!(S.user && !S.user.anon);
  const title = R.n === 'home' || R.n === 'auth' ? APP : S.app ? gname() : APP;
  $('#gname').textContent = title;
  /* KAN-273: logotipo do grupo ao lado do nome (gestão, link do jogador e link da votação). */
  const lg = $('#glogo'),
    ls = title === APP ? '' : srcLogo(S.gid, S.app && S.app.logo);
  lg.hidden = !ls;
  /* KAN-287: nas telas sem grupo (título "Nosso Jogo"), o símbolo do app ao lado do nome, como na apresentação. */
  $('#amarca').hidden = title !== APP;
  lg.onerror = () => (lg.hidden = true);
  if (ls && lg.getAttribute('src') !== ls) lg.src = ls;
  document.title = title;
  // KAN-169: com conta, o tema fica no menu da conta; sem conta (link, login, apresentação), o botão continua.
  $('#themeBtn').hidden = logged && R.n !== 'r' && R.n !== 'v' && R.n !== 'a';
  /* KAN-164: sem conta (apresentação, entrar, link), o idioma fica num botão no topo; com conta, no menu da conta. */
  const lb = $('#langBtn');
  lb.hidden = $('#themeBtn').hidden;
  /* KAN-283: até 420px o chip mostra só a sigla ("PT"); o 🌐 fica num pedaço que some no celular (.cab-longo). */
  const ic = document.createElement('span');
  ic.className = 'cab-longo';
  ic.textContent = '🌐 ';
  lb.replaceChildren(ic, LOCAL === 'pt-BR' ? 'PT' : LOCAL.toUpperCase());
  lb.setAttribute(
    'aria-label',
    tx('conta.idiomaAtual', { nome: (IDIOMAS.find(i => i.id === LOCAL) || IDIOMAS[0]).nome })
  );
  $('#installBtn').textContent = tx('pwa.botao');
  if (R.n !== 'r') desmontarPublico();
  if (R.n === 'r') return renderPublicRodada();
  /* KAN-183: a votação pública baixa só quando o link de votação é aberto. */
  if (R.n === 'v') {
    if (!voto) return baixar(import('../telas/PublicoVoto'), m => (voto = m));
    return voto.renderPublicVoto();
  }
  /* KAN-214: a avaliação de notas pelo link baixa só quando o link é aberto. */
  if (R.n === 'a') {
    if (!aval) return baixar(import('../telas/PublicoAvaliacao'), m => (aval = m));
    return aval.renderPublicoAvaliacao();
  }
  $('#tabsnav').hidden = true;
  $('#gsub').textContent = tx('render.subtitulo');
  /* KAN-283: o subtítulo das telas sem grupo some no celular (a gestão do grupo troca o texto e tira a marca). */
  $('#gsub').classList.add('sub-app');
  /* KAN-245: sortear times agora, sem cadastro (baixa só quando aberto). */
  if (R.n === 'sortear') {
    $('#topright').replaceChildren(voltarInicio());
    if (!rapido) return baixar(import('../telas/SorteioRapido'), m => (rapido = m));
    return rapido.montarSorteioRapido(main);
  }
  // Com conta: "⇄ Grupos" (fora da página inicial) e o botão da conta, que abre o menu com país e Sair (KAN-166).
  $('#topright').replaceChildren(
    ...(logged
      ? R.n !== 'home'
        ? [el('button', 'chip', tx('render.grupos'), { 'data-a': 'groupsDlg' })]
        : []
      : R.n === 'auth'
        ? [voltarInicio()]
        : [])
  );
  if (logged) $('#topright').append(botaoConta());
  document.body.classList.remove('is-landing', 'so-ver');
  /* KAN-175: a apresentação (quem ainda não tem conta) baixa sozinha, sem esperar a gestão. */
  if (R.n === 'home' && !logged && !isStandalone()) {
    if (!apresentacao) return baixar(import('../telas/Apresentacao'), m => (apresentacao = m));
    document.body.classList.add('is-landing');
    $('#tabsnav').hidden = true;
    apresentacao.montarApresentacao(main);
    return;
  }
  /* KAN-149: página inicial, convite e gestão vêm da parte de gestão, que carrega na primeira vez. */
  const A = adm();
  if (!A && (R.n === 'home' || R.n === 'inv' || (logged && R.n === 'admin'))) return baixar(carregarAdmin());
  /* KAN-183: a tela de entrar (e o convite, que usa a mesma tela) baixa só quando precisa. */
  if ((R.n === 'inv' || !logged) && !entrarPronto()) return baixar(carregarEntrar());
  if (R.n === 'inv') return A.renderInvite();
  if (!logged) {
    /* A tela de entrar já está aberta no mesmo modo: não desenha de novo, para não apagar o que a pessoa
       está digitando (um aviso do login anônimo logo depois de sair redesenhava e esvaziava os campos). */
    if ($('#authRaiz #le') && main.dataset.auth === S.authMode) return;
    main.dataset.auth = S.authMode;
    main.replaceChildren(lugar(entrarPronto().vAuth()));
    entrarPronto().montarAuth();
    return;
  }
  /* KAN-274 (pelada-v119): a página inicial e a gestão do grupo (abas, avisos, sem acesso) são desenhadas pela parte de
     gestão (ui/render-gestao.ts), que o link do jogador não baixa. */
  A.renderGestao({ el, lugar, baixar, travada, abasNoLugar });
}

/* KAN-72: a aba aberta fica no centro da barra (só quando muda de aba ou de grupo, para não brigar com quem está rolando)
   e uma sombra mostra que há mais abas para o lado. */
let abaCentrada = '';
function sombraAbas() {
  const t = $('#tabs'),
    n = $('#tabsnav');
  if (!t || !n) return;
  n.classList.toggle('mais-esq', t.scrollLeft > 2);
  n.classList.toggle('mais-dir', t.scrollLeft + t.clientWidth < t.scrollWidth - 2);
}
function abasNoLugar() {
  const t = $('#tabs'),
    k = S.gid + '/' + S.tab;
  if (k !== abaCentrada) {
    abaCentrada = k;
    const a = t.querySelector('[aria-selected="true"]');
    if (a) {
      const ar = a.getBoundingClientRect(),
        tr = t.getBoundingClientRect();
      t.scrollLeft += ar.left + ar.width / 2 - (tr.left + tr.width / 2);
    }
  }
  sombraAbas();
}
$('#tabs').addEventListener('scroll', sombraAbas, { passive: true });
addEventListener('resize', () => {
  sombraAbas();
  subtituloCompleto();
});

export { changed, render, subtituloCompleto };

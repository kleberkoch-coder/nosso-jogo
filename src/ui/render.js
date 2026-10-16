import { APP, sport, sportName } from '../dominio/esportes.js';
import { curRodada, fdia, gname, grpAtivo, isAdmin, isOwnerMe } from '../dominio/grupo.js';
import { hora } from '../dominio/rodadas.js';
import { B, applyBusy } from '../nucleo/backend.js';
import { S } from '../nucleo/estado.js';
import { $, esc, fdate, main } from '../nucleo/util.js';
import { isStandalone } from '../pwa.js';
import { ensureExtras, ensurePres, ensureVotos } from '../rotas.js';
import { adm, carregarAdmin } from '../nucleo/carga-admin.js';
import { tx } from '../i18n/index.js';
import { desmontarPublico } from '../telas/PublicoRodada.tsx';
import { botaoConta } from './menu-conta.ts';
import { vAuth } from '../telas/login.js';
import { renderPublicRodada } from '../telas/publico-rodada.js';
import { renderPublicVoto } from '../telas/publico-voto.js';

/* =================== render =================== */
let rq = false;
function changed() {
  if (rq) return;
  rq = true;
  requestAnimationFrame(() => {
    rq = false;
    render();
  });
}
const TABS = [
  ['rodada', 'Rodada'],
  ['historico', 'abas.historico'],
  ['jogadores', 'Jogadores'],
  ['partida', 'Partida'],
  ['ranking', 'Ranking'],
  ['caixa', 'Caixa'],
  ['votacao', 'Votação'],
  ['grupo', 'Grupo'],
];
/* Elemento simples sem montar HTML como texto (KAN-154). */
function el(tag, cls, txt) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt) e.textContent = txt;
  return e;
}
function render() {
  renderCore();
  applyBusy();
  subtituloCompleto();
}
/* KAN-146: texto que pode ser longo (local, subtítulo) fica numa linha só, com "…". Quando corta, o texto inteiro aparece
   ao passar o mouse (title) e ao tocar nele, que abre e fecha (no celular não existe "passar o mouse"). Vale para #gsub e [data-corta]. */
function subtituloCompleto() {
  document.querySelectorAll('#gsub,[data-corta]').forEach(g => {
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
function renderCore() {
  document.body.classList.remove('is-landing');
  $('#demo').hidden = !(B && B.demo);
  const R = S.route,
    logged = !!(S.user && !S.user.anon);
  const title = R.n === 'home' || R.n === 'auth' ? APP : S.app ? gname() : APP;
  $('#gname').textContent = title;
  document.title = title;
  // KAN-169: com conta, o tema fica no menu da conta; sem conta (link, login, apresentação), o botão continua.
  $('#themeBtn').hidden = logged && R.n !== 'r' && R.n !== 'v';
  if (R.n !== 'r') desmontarPublico();
  if (R.n === 'r') return renderPublicRodada();
  if (R.n === 'v') return renderPublicVoto();
  $('#tabsnav').hidden = true;
  $('#gsub').textContent = 'Presença, sorteio de times, placar, ranking e caixa dos seus jogos';
  // Com conta: "⇄ Grupos" (fora da página inicial) e o botão da conta, que abre o menu com país e Sair (KAN-166).
  $('#topright').innerHTML = logged
    ? R.n !== 'home'
      ? '<button class="chip" data-a="groupsDlg">⇄ Grupos</button>'
      : ''
    : R.n === 'auth'
      ? '<a class="chip" href="#/">← Início</a>'
      : '';
  if (logged) $('#topright').append(botaoConta());
  document.body.classList.remove('is-landing');
  /* KAN-149: página inicial, convite e gestão vêm da parte de gestão, que carrega na primeira vez. */
  const A = adm();
  if (!A && (R.n === 'home' || R.n === 'inv' || (logged && R.n === 'admin'))) {
    main.replaceChildren(el('div', 'empty muted', tx('comum.carregando')));
    carregarAdmin().then(
      () => render(),
      () => {
        const p = el('div', 'panel empty');
        p.append(el('h2', '', tx('comum.naoCarregouTitulo')), el('p', 'muted', tx('comum.naoCarregou')));
        main.replaceChildren(p);
      }
    );
    return;
  }
  if (R.n === 'home' && !logged && !isStandalone()) {
    document.body.classList.add('is-landing');
    $('#tabsnav').hidden = true;
    main.innerHTML = A.vLanding();
    return;
  }
  if (R.n === 'inv') return A.renderInvite();
  if (!logged) {
    main.innerHTML = vAuth();
    return;
  }
  if (R.n === 'home') {
    main.innerHTML = A.vHome();
    A.montarHome();
    return;
  }
  if (!S.loaded.mem || !S.loaded.app) {
    main.innerHTML = '<div class="empty muted">Carregando…</div>';
    return;
  }
  if (!S.app) {
    main.innerHTML = `<div class="panel empty auth"><h2>Grupo não encontrado</h2><p class="muted">Ele pode ter sido excluído.</p><a class="btn" href="#/">Meus grupos</a></div>`;
    return;
  }
  if (!isAdmin()) {
    main.innerHTML = `<div class="panel empty auth"><h2>Sem acesso</h2><p class="muted">Sua conta (${esc(S.user.email)}) não administra o grupo ${esc(gname())}. Peça ao organizador um link de convite.</p><div class="row" style="justify-content:center"><a class="btn" href="#/">Meus grupos</a>${S.me?.grupos?.[S.gid] ? '<button class="btn ghost danger" data-a="forgetGroup">Remover da minha lista</button>' : ''}</div></div>`;
    return;
  }
  const r0 = curRodada();
  $('#gsub').textContent =
    `${sport().e} ${sportName()}` +
    (r0 ? ' · ' : '') +
    (r0 ? `Próxima: ${fdate(r0.date)}${r0.time ? ' · ' + hora(r0) : ''}` : '');
  $('#tabsnav').hidden = false;
  $('#tabs').innerHTML = TABS.map(
    ([k, l]) =>
      `<button class="tab" role="tab" aria-selected="${S.tab === k}" data-a="tab" data-v="${k}">${l.startsWith('abas.') ? tx(l) : l}</button>`
  ).join('');
  abasNoLugar();
  ensurePres();
  ensureVotos();
  ensureExtras();
  main.innerHTML =
    (grpAtivo()
      ? ''
      : `<div class="inbar"><span>Grupo inativo desde ${fdia(S.app.inativadoEm)}. Os links públicos não aceitam confirmações nem votos.</span>${isOwnerMe() ? '<button class="btn sm" data-a="toggleAtivo">Reativar</button>' : ''}</div>`) +
    {
      rodada: A.vRodada,
      jogadores: A.vJogadores,
      partida: A.vPartida,
      ranking: A.vRanking,
      caixa: A.vCaixa,
      votacao: A.vVotacao,
      historico: A.vHistorico,
      grupo: A.vGrupo,
    }[S.tab]();
  if (S.tab === 'caixa') A.montarCaixa();
  if (S.tab === 'rodada') A.montarRodada();
  if (S.tab === 'jogadores') A.montarJogadores();
  if (S.tab === 'partida') {
    A.montarPartida();
    A.tick();
  }
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

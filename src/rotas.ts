/* Endereços do app e o que cada um abre (KAN-225: era rotas.js; a carga de cada assunto fica em src/carga/).
   #/p/{grupo}[/r|v|a/{id}] link público · #/g/{grupo} gestão · #/entrar, #/criar · #/convite/{grupo}/{token} · #/ início */
import { ACT } from './acoes.js';
import { migrarPrivado, sincronizarVagas } from './dominio/caixa.js';
import { tx } from './i18n/index.js';
import * as banco from './nucleo/backend.js';
import { carregarAdmin } from './nucleo/carga-admin.js';
import { S, dropAll, sub, subQ, subRaw } from './nucleo/estado';
import type { Rota } from './nucleo/tipos';
import { $, toast } from './nucleo/util.js';
import { closeDlgNow, dlg } from './ui/dialogos.js';
import { render } from './ui/render.js';
import { ensureExtras } from './carga/abas';
import { cargaLinkAvaliacao } from './carga/avaliacao';
import { aplicarRegiao, gravarPaisConta, registrarAcesso, syncName, upMyGroup } from './carga/conta';
import { startData } from './carga/gestao';
import { syncPerm, syncVia } from './carga/permissoes';
import { Q_PROX, dia, ensurePres, resolveNext, subLimAv, subLimCfg } from './carga/rodada';
import { cargaLinkVotacao, ensureVotos } from './carga/votacao';
// O banco é JavaScript sem tipos e é trocado ao iniciar (setB): lido na hora.
const bk = (): any => (banco as any).B;

function parseRoute(): Rota {
  const h = location.hash.replace(/^#\/?/, '').split('/');
  if (h[0] === 'p' && h[1]) {
    if (h[2] === 'r' && h[3]) return { n: 'r', gid: h[1], id: h[3] };
    if (h[2] === 'v' && h[3]) return { n: 'v', gid: h[1], id: h[3] };
    /* KAN-214: link da avaliação de notas. */
    if (h[2] === 'a' && h[3]) return { n: 'a', gid: h[1], id: h[3] };
    return { n: 'r', gid: h[1], id: null, next: true };
  }
  if (h[0] === 'g' && h[1]) return { n: 'admin', gid: h[1] };
  if (h[0] === 'entrar') return { n: 'auth', mode: 'login' };
  if (h[0] === 'criar') return { n: 'auth', mode: 'signup' };
  if (h[0] === 'convite' && h[1] && h[2]) return { n: 'inv', gid: h[1], token: h[2] };
  return { n: 'home' };
}
/* Tudo que a troca de endereço limpa (a memória de um grupo não passa para outro). */
const LIMPO = () => ({
  avul: {},
  af: {},
  cont: {},
  pc: null,
  migrando: false,
  app: null,
  mem: null,
  membros: {},
  convite: null,
  rat: null,
  av: null,
  minhaAv: null,
  presRid: undefined,
  limAv: null,
  limVg: null,
  limCfg: null,
  conta: null,
  planosCfg: null,
  votosVid: undefined,
  dataOn: false,
  rod: {},
  rodF: {},
  rodP: {},
  rodAll: null,
  res: null,
  resK: null,
  parts: {},
  partsRid: null,
  migr: null,
  migrandoDados: false,
  rodMes: {},
  rodMesM: null,
  rodPag: {},
  rodPagDe: null,
  caixa: {},
  caixaDe: null,
  rodJunt: null,
  resCx: null,
  rodX: {},
  rodXid: null,
  hist: null,
  pres: {},
  vot: {},
  votos: {},
  trocas: {},
  myVote: null,
  jog: {},
  rid: null,
  vid: null,
  live: null,
});
const publico = (n: string) => n === 'r' || n === 'v' || n === 'a';

/* Conta logada: "Meus grupos" (abre o único grupo, ou o "Novo grupo" para quem não tem nenhum) e o plano. */
function cargaConta(uid: string) {
  subRaw('me', 'usuarios/' + uid, d => {
    S.me = d || { grupos: {} };
    gravarPaisConta();
    if (!S.gid) aplicarRegiao(S.me);
    syncName();
    if (S.route.n === 'home' && !S.homeShown) {
      S.homeShown = true;
      const all = Object.entries((S.me && S.me.grupos) || {}) as [string, { ativo?: boolean }][],
        g = all.filter(([, v]) => v.ativo !== false).map(([k]) => k);
      if (g.length === 1) location.hash = '#/g/' + g[0];
      else if (!all.length)
        setTimeout(() => {
          if (S.route.n === 'home' && !dlg.open)
            carregarAdmin().then(
              () => (ACT as Record<string, (el: unknown) => unknown>).newGroup({ dataset: { auto: '1' } }),
              () => {}
            );
        }, 250);
    }
  });
  /* Planos (KAN-119): a ficha da própria conta (plano, teste, grupos ativos) e o catálogo com a data da transição. */
  subRaw('conta', 'contas/' + uid, d => {
    S.conta = d;
  });
  subRaw('planosCfg', 'sistema/planos', d => {
    S.planosCfg = d;
  });
  registrarAcesso();
}
/* Link da rodada (#/p/{grupo} ou #/p/{grupo}/r/{rodada}): elenco, avulsos, a rodada, presenças e partidas. */
function cargaLinkRodada(R: Rota) {
  sub('jog', 'jogadores', d => {
    S.jog = d || {};
  });
  sub('avul', 'avulsos', d => {
    S.avul = d || {};
  });
  if (R.next) {
    /* Link do jogador: só as próximas rodadas, nunca o histórico (KAN-82). */
    subQ('rods', 'rodadas', Object.assign({ de: dia(-1) }, Q_PROX, { limite: 6 }), d => {
      S.rod = d || {};
      resolveNext();
    });
    return;
  }
  const id = R.id as string;
  sub('r', 'rodadas/' + id, d => {
    if (d) S.rod = { [id]: d };
    else S.rod = {};
  });
  S.presRid = id;
  sub('pres', 'rodadas/' + id + '/presencas', d => {
    S.pres = d || {};
  });
  subLimAv(id);
  S.partsRid = id;
  sub('parts', 'rodadas/' + id + '/partidas', d => {
    S.parts = d || {};
  });
}

function setupRoute() {
  closeDlgNow();
  dropAll();
  S.route = parseRoute();
  const R = S.route,
    logged = !!(S.user && !S.user.anon);
  // Até o grupo carregar, vale o país da conta (ou Brasil); o grupo traz o dele (KAN-162).
  aplicarRegiao(!R.gid ? S.me : null);
  /* KAN-149: fora do link público, a parte de gestão já começa a baixar enquanto o Firebase conecta. */
  /* KAN-175: na gestão, a aba Partida também já vem logo depois, para abrir na hora (e na quadra, sem sinal). */
  if (!publico(R.n) && R.n !== 'auth')
    carregarAdmin()
      .then((A: { carregarPartida: () => Promise<unknown> }) => {
        if (R.n === 'admin') setTimeout(() => A.carregarPartida().catch(() => {}), 1500);
      })
      .catch(() => {});
  if (R.n === 'auth') {
    if (logged) {
      location.hash = '#/';
      return;
    }
    S.authMode = R.mode as string;
  }
  window.scrollTo(0, 0);
  if (publico(R.n)) {
    try {
      localStorage.setItem('pelada-last', location.hash);
    } catch (e) {}
  }
  Object.assign(S, LIMPO(), { gid: R.gid || null });
  if (logged && S.user) cargaConta(S.user.uid);
  if (S.gid)
    sub('app', 'config/app', d => {
      S.app = d;
      aplicarRegiao(d && d.cfg);
      if (R.next) resolveNext();
      syncName();
      migrarPrivado();
      sincronizarVagas();
      sincronizarVagas();
    });
  const anon = () => {
    if (!S.user)
      bk()
        .anon()
        .catch(() => toast(tx('erro.conectar')));
  };
  if (R.n === 'r') {
    subLimCfg();
    anon();
    cargaLinkRodada(R);
  } else if (R.n === 'v') {
    anon();
    cargaLinkVotacao(R.id as string);
  } else if (R.n === 'a') {
    anon();
    cargaLinkAvaliacao(R.id as string);
  } else if ((R.n === 'admin' || R.n === 'inv') && logged && S.user) {
    sub('mem', 'membros/' + S.user.uid, d => {
      S.mem = d;
      if (d && R.n === 'admin') startData();
      syncPerm();
      syncName();
      syncVia();
    });
  }
  render();
  if (R.n === 'auth' || (R.n === 'inv' && !logged)) focusEmail();
}
document.addEventListener('nj-via', syncVia);
/* Gravação recusada pelo banco (KAN-170): lê de novo o que está gravado, para a tela não mostrar o que não foi salvo. */
document.addEventListener('nj-gravacao-falhou', () => setTimeout(setupRoute, 0));
function focusEmail() {
  let n = 0;
  const t = setInterval(() => {
    const i = $('#le');
    if (i) {
      i.focus();
      clearInterval(t);
    } else if (++n > 40) clearInterval(t);
  }, 50);
}

export { dia, ensureExtras, ensurePres, ensureVotos, setupRoute, upMyGroup };

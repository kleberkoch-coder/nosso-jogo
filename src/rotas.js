import { adm, carregarAdmin } from './nucleo/carga-admin.js';
import { ACT } from './acoes.js';
import { migrarPrivado, sincronizarVagas } from './dominio/caixa.js';
import { curRodada, isAdmin, upcoming, ymd } from './dominio/grupo.js';
import { B } from './nucleo/backend.js';
import { GB, S, SUBS, drop, dropAll, sub, subQ, subRaw, w } from './nucleo/estado.js';
import { $, cl, toast } from './nucleo/util.js';
import { closeDlgNow, dlg } from './ui/dialogos.js';
import { render } from './ui/render.js';
import { agora, definirRegiao } from './i18n/formatos.js';
import { regiaoDe } from './dominio/regiao.ts';
/* Datas, números, moeda e relógio do grupo aberto; fora de um grupo, os da conta (KAN-162). */
const aplicarRegiao = c => definirRegiao(regiaoDe(c));

/* =================== assinaturas por rota =================== */
function ensurePres() {
  if (S.route.n === 'admin' && !(S.loaded.rodF && S.loaded.rodP)) return;
  const r = curRodada(),
    id = r ? r.id : null;
  if (S.presRid === id) return;
  S.presRid = id;
  S.pres = {};
  drop('pres');
  if (id)
    sub('pres', 'rodadas/' + id + '/presencas', d => {
      S.pres = d || {};
      regAvulsos();
    });
  subLimAv(id);
}
/* Contador de avulsos novos pelo link nesta rodada (KAN-89). */
function subLimAv(id) {
  S.limAv = null;
  S.limVg = null;
  drop('limAv');
  drop('limVg');
  if (!id) return;
  sub('limAv', 'rodadas/' + id + '/limites/avulsos', d => {
    S.limAv = d;
  });
  /* Vagas para diaristas e avulsos ocupadas pelo link (KAN-63). */
  sub('limVg', 'rodadas/' + id + '/limites/vagas', d => {
    S.limVg = d;
  });
}
const subLimCfg = () =>
  subRaw('limCfg', 'sistema/limites', d => {
    S.limCfg = d;
  });
function regAvulsos() {
  if (!isAdmin() || !S.loaded.avul || !S.presRid) return;
  const r = S.rod[S.presRid],
    jogou = new Set(r && r.times ? r.times.flatMap(t => t.players) : []);
  Object.entries(S.pres).forEach(([id, p]) => {
    if (jogou.has(id) && p.avulso && p.nome && !S.jog[id] && !S.avul[id]) {
      const o = { nome: p.nome, pos: p.pos || '', criado: Date.now() };
      S.avul[id] = o;
      GB.set('avulsos/' + id, o).catch(() => {});
    }
  });
}
function ensureVotos() {
  const id =
    S.tab === 'votacao'
      ? S.vid || Object.keys(S.vot).sort((a, b) => (S.vot[b].createdAt || 0) - (S.vot[a].createdAt || 0))[0]
      : null;
  if (S.votosVid === id) return;
  S.votosVid = id;
  S.votos = {};
  drop('votos');
  if (id)
    sub('votos', 'votacoes/' + id + '/votos', d => {
      S.votos = d || {};
    });
}
/* Data relativa a hoje (AAAA-MM-DD). */
const dia = n => {
  const d = agora();
  d.setDate(d.getDate() + n);
  return ymd(d);
};
/* Rodadas da janela da aba Rodada (D10): as próximas (a partir de ontem, para pegar o jogo que vira a meia-noite) e as recentes
   (até hoje: as últimas 4 mais uma folga para o jogo de hoje). */
const Q_PROX = { campo: 'date', ordem: 'asc', limite: 12 },
  Q_REC = { campo: 'date', ordem: 'desc', limite: 5 };
function juntarRod() {
  S.rod = Object.assign({}, S.rodP || {}, S.rodF || {});
  regAvulsos();
}
/* Dados que só carregam quando a aba precisa deles (D10): todas as rodadas no ranking, as do mês no caixa e a rodada de uma votação antiga. */
function ensureExtras() {
  const A = adm();
  if (S.route.n !== 'admin' || !S.dataOn || !A) return;
  /* Partidas e totais por mês (pelada-v18): move dados antigos uma vez e mantém tudo no lugar novo. */
  A.migrar();
  A.verificarRodadas();
  /* Fichas de resumo: o ranking lê só as do ano escolhido (até 12). */
  const want = S.tab === 'ranking' ? A.anoRank() : null;
  if (want) {
    if (S.resK !== want) {
      S.resK = want;
      S.res = {};
      subQ(
        'res',
        'resumos',
        want === 'todos'
          ? { campo: 'mes', ordem: 'asc' }
          : { campo: 'mes', de: want + '-01', ate: want + '-12', ordem: 'asc' },
        d => {
          S.res = d || {};
        }
      );
    }
  } else if (SUBS.res) {
    drop('res');
    S.res = null;
    S.resK = null;
  }
  /* Partidas só da rodada aberta na aba Partida. */
  if (S.tab === 'partida') {
    const r = curRodada(),
      id = r && r.id;
    if (id && S.partsRid !== id) {
      S.partsRid = id;
      S.parts = {};
      sub('parts', 'rodadas/' + id + '/partidas', d => {
        S.parts = d || {};
      });
    }
  } else if (SUBS.parts) {
    drop('parts');
    S.partsRid = null;
    S.parts = {};
  }
  if (S.tab === 'caixa') {
    const m = S.month;
    if (S.rodMesM !== m) {
      S.rodMesM = m;
      S.rodMes = {};
      subQ('rodMes', 'rodadas', { campo: 'date', de: m + '-01', ate: m + '-31', ordem: 'asc' }, d => {
        S.rodMes = d || {};
      });
    }
  } else if (SUBS.rodMes) {
    drop('rodMes');
    S.rodMesM = null;
  }
  /* A pagar por jogo (KAN-172): rodadas desde o primeiro dia em que alguém passou a receber, em qualquer mês. */
  const desde = S.tab === 'caixa' ? A.inicioAPagar() : null;
  if (desde) {
    if (S.rodPagDe !== desde) {
      S.rodPagDe = desde;
      S.rodPag = {};
      subQ('rodPag', 'rodadas', { campo: 'date', de: desde, ordem: 'asc' }, d => {
        S.rodPag = d || {};
      });
    }
  } else if (SUBS.rodPag) {
    drop('rodPag');
    S.rodPagDe = null;
    S.rodPag = {};
  }
  if (S.tab === 'historico') {
    const h = A.estadoHist();
    if (!h.buscou && !h.carregando && !h.auto) {
      h.auto = true;
      A.buscarHist(false);
    }
  }
  if (S.tab === 'votacao') {
    const v = S.vot[S.vid];
    const rid = v && v.rid;
    if (rid && !S.rod[rid] && S.rodXid !== rid) {
      S.rodXid = rid;
      sub('rodX', 'rodadas/' + rid, d => {
        S.rodX = d ? { [rid]: d } : {};
      });
    }
  }
}
function parseRoute() {
  const h = location.hash.replace(/^#\/?/, '').split('/');
  if (h[0] === 'p' && h[1]) {
    if (h[2] === 'r' && h[3]) return { n: 'r', gid: h[1], id: h[3] };
    if (h[2] === 'v' && h[3]) return { n: 'v', gid: h[1], id: h[3] };
    return { n: 'r', gid: h[1], id: null, next: true };
  }
  if (h[0] === 'g' && h[1]) return { n: 'admin', gid: h[1] };
  if (h[0] === 'entrar') return { n: 'auth', mode: 'login' };
  if (h[0] === 'criar') return { n: 'auth', mode: 'signup' };
  if (h[0] === 'convite' && h[1] && h[2]) return { n: 'inv', gid: h[1], token: h[2] };
  return { n: 'home' };
}
/* Último acesso da conta (KAN-116): no máximo uma vez por dia por aparelho, sem atrasar a abertura.
   Na primeira vez, grava também a data de registro e o e-mail (vistos na área administrativa do portal). */
function registrarAcesso() {
  const u = S.user;
  if (!u || u.anon) return;
  const k = 'nj-acesso-' + u.uid,
    hoje = new Date().toDateString();
  try {
    if (localStorage.getItem(k) === hoje) return;
    localStorage.setItem(k, hoje);
  } catch (e) {}
  B.get('contas/' + u.uid)
    .catch(() => null)
    .then(c => {
      const agora = Date.now(),
        o = { acesso: agora };
      if (u.email) o.email = u.email;
      if (!c || !c.criada) o.criada = agora;
      return B.patch('contas/' + u.uid, o);
    })
    .catch(e => console.warn('acesso', e));
}
/* País da conta (KAN-162): o escolhido ao criar a conta; quem ainda não tem (conta antiga, ou entrou pelo Google na aba
   Entrar) recebe o sugerido pelo aparelho. Grava uma vez só; depois a pessoa troca em "Meus grupos" → País. */
function gravarPaisConta() {
  const u = S.user,
    n = S.route.n;
  if (!u || u.anon || !S.me || S.me.pais || S.paisGravando || n === 'r' || n === 'v') return;
  S.paisGravando = true;
  // A tabela de países vem com a gestão (quem tem conta já baixa a gestão; o link do jogador não).
  carregarAdmin()
    .then(A => {
      const o = A.contaRegiao(S.paisNovo);
      Object.assign(S.me, o);
      if (!S.gid) aplicarRegiao(o);
      return B.patch('usuarios/' + u.uid, o);
    })
    .catch(e => console.warn('pais', e))
    .finally(() => {
      S.paisGravando = false;
    });
}
function upMyGroup(gid, patch) {
  const me = cl(S.me) || { grupos: {} };
  me.grupos = me.grupos || {};
  me.grupos[gid] = Object.assign({}, me.grupos[gid] || {}, patch);
  S.me = me;
  return B.set('usuarios/' + S.user.uid, me);
}
function addMyGroup(gid, name, role, sp, spn) {
  return upMyGroup(gid, { name, role, sport: sp || 'futebol', sportName: spn || '' });
}
function syncName() {
  const g = S.me?.grupos?.[S.gid],
    a = S.app;
  if (S.route.n !== 'admin' || !a || !S.mem || !g) return;
  const want = {
    name: a.name,
    sport: a.sport || 'futebol',
    sportName: a.sportName || '',
    ativo: a.ativo !== false,
    criado: a.createdAt || null,
  };
  if (Object.keys(want).some(k => (g[k] ?? null) !== (want[k] ?? null))) upMyGroup(S.gid, want).catch(() => {});
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
  if (R.n !== 'r' && R.n !== 'v' && !(R.n === 'auth'))
    carregarAdmin()
      .then(A => {
        if (R.n === 'admin') setTimeout(() => A.carregarPartida().catch(() => {}), 1500);
      })
      .catch(() => {});
  if (R.n === 'auth') {
    if (logged) {
      location.hash = '#/';
      return;
    }
    S.authMode = R.mode;
  }
  window.scrollTo(0, 0);
  if (R.n === 'r' || R.n === 'v') {
    try {
      localStorage.setItem('pelada-last', location.hash);
    } catch (e) {}
  }
  Object.assign(S, {
    avul: {},
    cont: {},
    pc: null,
    migrando: false,
    gid: R.gid || null,
    app: null,
    mem: null,
    membros: {},
    convite: null,
    rat: null,
    caixa: {},
    presRid: undefined,
    limAv: null,
    limVg: null,
    limCfg: null,
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
    rodX: {},
    rodXid: null,
    hist: null,
    pres: {},
    vot: {},
    votos: {},
    myVote: null,
    jog: {},
    rid: null,
    vid: null,
    live: null,
  });
  if (logged)
    subRaw('me', 'usuarios/' + S.user.uid, d => {
      S.me = d || { grupos: {} };
      gravarPaisConta();
      if (!S.gid) aplicarRegiao(S.me);
      syncName();
      if (S.route.n === 'home' && !S.homeShown) {
        S.homeShown = true;
        const all = Object.entries(S.me.grupos || {}),
          g = all.filter(([, v]) => v.ativo !== false).map(([k]) => k);
        if (g.length === 1) location.hash = '#/g/' + g[0];
        else if (!all.length)
          setTimeout(() => {
            if (S.route.n === 'home' && !dlg.open)
              carregarAdmin().then(
                () => ACT.newGroup(),
                () => {}
              );
          }, 250);
      }
    });
  if (logged) registrarAcesso();
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
    if (!S.user) B.anon().catch(() => toast('Não foi possível conectar. Recarregue a página.'));
  };
  if (R.n === 'r') subLimCfg();
  if (R.n === 'r' && R.next) {
    anon();
    sub('jog', 'jogadores', d => {
      S.jog = d || {};
    });
    sub('avul', 'avulsos', d => {
      S.avul = d || {};
    });
    /* Link do jogador: só as próximas rodadas, nunca o histórico (KAN-82). */
    subQ('rods', 'rodadas', Object.assign({ de: dia(-1) }, Q_PROX, { limite: 6 }), d => {
      S.rod = d || {};
      resolveNext();
    });
  } else if (R.n === 'r') {
    anon();
    sub('jog', 'jogadores', d => {
      S.jog = d || {};
    });
    sub('avul', 'avulsos', d => {
      S.avul = d || {};
    });
    sub('r', 'rodadas/' + R.id, d => {
      if (d) S.rod = { [R.id]: d };
      else S.rod = {};
    });
    S.presRid = R.id;
    sub('pres', 'rodadas/' + R.id + '/presencas', d => {
      S.pres = d || {};
    });
    subLimAv(R.id);
    S.partsRid = R.id;
    sub('parts', 'rodadas/' + R.id + '/partidas', d => {
      S.parts = d || {};
    });
  } else if (R.n === 'v') {
    anon();
    sub('jog', 'jogadores', d => {
      S.jog = d || {};
    });
    sub('v', 'votacoes/' + R.id, d => {
      S.vot = d ? { [R.id]: d } : {};
      if (d && !SUBS.rv)
        sub('rv', 'rodadas/' + d.rid, x => {
          S.rod = x ? { [d.rid]: x } : {};
        });
    });
    if (S.user)
      sub('mv', 'votacoes/' + R.id + '/votos/' + S.user.uid, d => {
        const keep = S.myVote?.pid;
        S.myVote = d || (keep ? { pid: keep, v: {} } : null);
      });
  } else if ((R.n === 'admin' || R.n === 'inv') && logged) {
    sub('mem', 'membros/' + S.user.uid, d => {
      S.mem = d;
      if (d && R.n === 'admin') startData();
      syncName();
      syncVia();
    });
  }
  render();
  if (R.n === 'auth' || (R.n === 'inv' && !logged)) focusEmail();
}
/* Grava no cadastro do administrador como ele entrou (Google ou e-mail e senha). Só muda esse campo. */
function syncVia() {
  const m = S.mem,
    u = S.user;
  if (!m || !u || !u.via || m.via === u.via || !S.gid) return;
  w(GB.patch('membros/' + u.uid, { via: u.via }));
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
function resolveNext() {
  if (!S.loaded.app || !S.loaded.rods) return;
  const r = upcoming()[0],
    id = r ? r.id : null;
  if (S.route.id !== id || S.presRid !== id) {
    S.route.id = id;
    S.presRid = id;
    S.pres = {};
    drop('pres');
    if (id)
      sub('pres', 'rodadas/' + id + '/presencas', d => {
        S.pres = d || {};
      });
    subLimAv(id);
    S.partsRid = id;
    S.parts = {};
    drop('parts');
    if (id)
      sub('parts', 'rodadas/' + id + '/partidas', d => {
        S.parts = d || {};
      });
  }
}
function startData() {
  if (S.dataOn) return;
  S.dataOn = true;
  sub('rat', 'privado/ratings', d => {
    S.rat = d;
  });
  sub('cont', 'privado/contatos', d => {
    S.cont = d || {};
  });
  sub('avul', 'avulsos', d => {
    S.avul = d || {};
    regAvulsos();
  });
  sub('jog', 'jogadores', d => {
    S.jog = d || {};
    migrarPrivado();
    sincronizarVagas();
  });
  subQ('rodF', 'rodadas', Object.assign({ de: dia(-1) }, Q_PROX), d => {
    S.rodF = d || {};
    juntarRod();
  });
  subQ('rodP', 'rodadas', Object.assign({ ate: dia(0) }, Q_REC), d => {
    S.rodP = d || {};
    juntarRod();
  });
  sub('pc', 'privado/caixa', d => {
    S.pc = d;
    migrarPrivado();
    sincronizarVagas();
  });
  sub('migr', 'privado/migracao', d => {
    S.migr = d || { v: 0 };
  });
  sub('caixa', 'caixa', d => {
    S.caixa = d || {};
  });
  sub('vot', 'votacoes', d => {
    S.vot = d || {};
  });
  sub('membros', 'membros', d => {
    S.membros = d || {};
  });
  subLimCfg();
  sub('convite', 'privado/convite', d => {
    S.convite = d;
  });
}

export { dia, ensureExtras, ensurePres, ensureVotos, setupRoute, upMyGroup };

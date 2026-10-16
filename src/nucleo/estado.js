import { B } from './backend.js';
import { toast, today } from './util.js';
import { changed } from '../ui/render.js';

/* =================== estado =================== */
const S = {
  user: null,
  route: { n: 'admin' },
  tab: 'rodada',
  rid: null,
  vid: null,
  month: today().slice(0, 7),
  live: null,
  rankSort: 'pts',
  owner: undefined,
  admins: {},
  myInv: null,
  app: null,
  rat: null,
  jog: {},
  rod: {},
  pres: {},
  caixa: {},
  vot: {},
  votos: {},
  conv: {},
  loaded: {},
};
const SUBS = {};
function gp(p) {
  const base = 'grupos/' + S.gid;
  return p === 'config/app' ? base : base + '/' + p;
}
const GB = {
  set: (p, o) => B.set(gp(p), o),
  patch: (p, o) => B.patch(gp(p), o),
  del: p => B.del(gp(p)),
  lote: ops => B.lote(ops.map(x => Object.assign({}, x, { p: gp(x.p) }))),
};
function subRaw(k, path, cb) {
  drop(k);
  SUBS[k] = B.sub(
    path,
    d => {
      S.loaded[k] = true;
      cb(d);
      changed();
    },
    e => {
      S.loaded[k] = true;
      console.warn(k, e);
      changed();
    }
  );
}
function sub(k, path, cb) {
  drop(k);
  SUBS[k] = B.sub(
    gp(path),
    d => {
      S.loaded[k] = true;
      cb(d);
      changed();
    },
    e => {
      S.loaded[k] = true;
      console.warn(k, e);
      changed();
    }
  );
}
/* Assinatura de uma consulta (rodadas por data, com limite): ver D10 em docs/ARQUITETURA.md. */
function subQ(k, path, q, cb) {
  drop(k);
  SUBS[k] = B.query(
    gp(path),
    q,
    d => {
      S.loaded[k] = true;
      cb(d);
      changed();
    },
    e => {
      S.loaded[k] = true;
      console.warn(k, e);
      changed();
    }
  );
}
function drop(k) {
  if (SUBS[k]) {
    SUBS[k]();
    delete SUBS[k];
  }
  delete S.loaded[k];
}
function dropAll() {
  Object.keys(SUBS).forEach(drop);
}
/* Gravação com aviso. Se o banco recusar, avisa e pede para a tela voltar ao que está gravado (KAN-170):
   rotas.js ouve "nj-gravacao-falhou" e recarrega os dados, desfazendo o que a tela mostrou antes da hora. */
function w(p) {
  return Promise.resolve(p).catch(e => {
    console.error(e);
    toast(
      e && e.code === 'permission-denied' ? 'Sem permissão para isso.' : 'Não foi possível salvar. Verifique a conexão.'
    );
    document.dispatchEvent(new Event('nj-gravacao-falhou'));
    throw e;
  });
}
const clean = o => JSON.parse(JSON.stringify(o));

export { GB, S, SUBS, clean, drop, dropAll, gp, sub, subQ, subRaw, w };

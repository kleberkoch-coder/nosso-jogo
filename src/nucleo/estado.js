import { B } from './backend.js';
import { toast, today } from './util.js';
import { changed } from '../ui/render.js';
import { proximaTentativa } from './carga.ts';
import { tx } from '../i18n/index.js';

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
/* Assinatura com nova tentativa (KAN-184): erro de rede repete depois de 1, 2 e 4 s antes de desistir.
   Só depois de desistir a leitura conta como pronta, com a falha anotada em S.falhou[k] para a tela avisar
   "Não foi possível carregar" (e não "não encontrado"). */
function assinar(k, abrir, cb) {
  drop(k);
  let tentativa = 0;
  const ligar = () => {
    SUBS[k] = abrir(
      d => {
        tentativa = 0;
        S.loaded[k] = true;
        if (S.falhou) delete S.falhou[k];
        cb(d);
        changed();
      },
      e => {
        const espera = proximaTentativa(e && e.code, tentativa++);
        console.warn(k, e);
        if (espera != null) {
          const t = setTimeout(ligar, espera);
          SUBS[k] = () => clearTimeout(t);
          return;
        }
        S.loaded[k] = true;
        S.falhou = Object.assign({}, S.falhou, { [k]: (e && e.code) || 'erro' });
        changed();
      }
    );
  };
  ligar();
}
function subRaw(k, path, cb) {
  assinar(k, (ok, erro) => B.sub(path, ok, erro), cb);
}
function sub(k, path, cb) {
  assinar(k, (ok, erro) => B.sub(gp(path), ok, erro), cb);
}
/* Assinatura de uma consulta (rodadas por data, com limite): ver D10 em docs/ARQUITETURA.md. */
function subQ(k, path, q, cb) {
  assinar(k, (ok, erro) => B.query(gp(path), q, ok, erro), cb);
}
function drop(k) {
  if (SUBS[k]) {
    SUBS[k]();
    delete SUBS[k];
  }
  delete S.loaded[k];
  if (S.falhou) delete S.falhou[k];
}
function dropAll() {
  Object.keys(SUBS).forEach(drop);
}
/* Gravação com aviso. Se o banco recusar, avisa e pede para a tela voltar ao que está gravado (KAN-170):
   rotas.js ouve "nj-gravacao-falhou" e recarrega os dados, desfazendo o que a tela mostrou antes da hora. */
function w(p) {
  return Promise.resolve(p).catch(e => {
    console.error(e);
    toast(tx(e && e.code === 'permission-denied' ? 'erro.semPermissao' : 'erro.salvar'));
    document.dispatchEvent(new Event('nj-gravacao-falhou'));
    throw e;
  });
}
const clean = o => JSON.parse(JSON.stringify(o));

export { GB, S, SUBS, clean, drop, dropAll, gp, sub, subQ, subRaw, w };

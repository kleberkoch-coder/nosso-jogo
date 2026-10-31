import * as backend from './backend.js';
import { toast, today } from './util.js';
import { changed } from '../ui/render.js';
import { proximaTentativa } from './carga.ts';
import { tx } from '../i18n/index.js';
import type { Estado } from './tipos';

/* =================== estado =================== */
/* A memória do app, com tipos desde a v87 (KAN-220; nucleo/tipos.ts). */
const S: Estado = {
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
type Parar = () => void;
const SUBS: Record<string, Parar> = {};
function gp(p: string) {
  const base = 'grupos/' + S.gid;
  return p === 'config/app' ? base : base + '/' + p;
}
type Op = { tipo: string; p: string; o?: unknown };
const banco = (): any => (backend as any).B;
/* Gravações dentro do grupo aberto: o caminho é relativo a grupos/{gid}. */
const GB = {
  set: (p: string, o: unknown) => banco().set(gp(p), o),
  patch: (p: string, o: unknown) => banco().patch(gp(p), o),
  del: (p: string) => banco().del(gp(p)),
  lote: (ops: Op[]) => banco().lote(ops.map(x => Object.assign({}, x, { p: gp(x.p) }))),
};
type Abrir = (ok: (d: any) => void, erro: (e: any) => void) => Parar;
/* Assinatura com nova tentativa (KAN-184): erro de rede repete depois de 1, 2 e 4 s antes de desistir.
   Só depois de desistir a leitura conta como pronta, com a falha anotada em S.falhou[k] para a tela avisar
   "Não foi possível carregar" (e não "não encontrado"). */
function assinar(k: string, abrir: Abrir, cb: (d: any) => void) {
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
function subRaw(k: string, path: string, cb: (d: any) => void) {
  assinar(k, (ok, erro) => banco().sub(path, ok, erro), cb);
}
function sub(k: string, path: string, cb: (d: any) => void) {
  assinar(k, (ok, erro) => banco().sub(gp(path), ok, erro), cb);
}
/* Assinatura de uma consulta (rodadas por data, com limite): ver D10 em docs/ARQUITETURA.md. */
function subQ(k: string, path: string, q: unknown, cb: (d: any) => void) {
  assinar(k, (ok, erro) => banco().query(gp(path), q, ok, erro), cb);
}
function drop(k: string) {
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
function w<T>(p: T | Promise<T>): Promise<T> {
  return Promise.resolve(p).catch(e => {
    console.error(e);
    toast(tx(e && e.code === 'permission-denied' ? 'erro.semPermissao' : 'erro.salvar'));
    document.dispatchEvent(new Event('nj-gravacao-falhou'));
    throw e;
  });
}
const clean = <T>(o: T): T => JSON.parse(JSON.stringify(o));

export { GB, S, SUBS, clean, drop, dropAll, gp, sub, subQ, subRaw, w };

/* O que grava no caixa privado (KAN-201, KAN-63). Vem só com a gestão (KAN-262, pelada-v106: saiu de caixa.js, que
   vai no link do jogador). */
import * as banco from '../nucleo/backend.js';
import { GB, S as estado, clean, gp, w } from '../nucleo/estado.js';
import { cl, today } from '../nucleo/util.js';
import { changed } from '../ui/render.js';
import { CAIXA_K, ptipo } from './caixa.js';
import { isAdmin, posso, recurso } from './grupo.js';
import { marcasParaAjustar } from './vagas';

type Obj = Record<string, any>;
const st = (): Obj => estado as Obj;
const B = (): any => (banco as Obj).B;

/* Sem a permissão de caixa (KAN-201), nada é gravado no caixa: as regras do Firebase recusariam. */
export function editPc(fn: (a: Obj) => void) {
  if (!posso('caixa') || !recurso('caixa')) return Promise.resolve(); // KAN-119: caixa só com o Plano A
  const a = cl(st().pc) || {};
  a.tipos = a.tipos || {};
  fn(a);
  st().pc = a;
  changed();
  return w(GB.set('privado/caixa', clean(a)));
}
export function migrarPrivado() {
  if (
    st().migrando ||
    !st().dataOn ||
    !isAdmin() ||
    !st().app ||
    !st().loaded.app ||
    !st().loaded.jog ||
    !st().loaded.pc
  )
    return;
  const c = st().app.cfg || {},
    ks = CAIXA_K.filter(k => k in c),
    js = Object.entries(st().jog as Record<string, Obj | null>).filter(([, j]) => j && 'tipo' in j);
  if (!ks.length && !js.length) return;
  st().migrando = true;
  const p = cl(st().pc) || {};
  p.tipos = p.tipos || {};
  ks.forEach(k => {
    if (p[k] == null) p[k] = c[k];
  });
  js.forEach(([id, j]) => {
    if (!p.tipos[id]) p.tipos[id] = j!.tipo;
  });
  st().pc = p;
  B()
    .set(gp('privado/caixa'), clean(p))
    .then(() => {
      const ps = [];
      if (ks.length) {
        const a = cl(st().app);
        ks.forEach((k: string) => delete a.cfg[k]);
        st().app = a;
        ps.push(B().set(gp('config/app'), clean(a)));
      }
      js.forEach(([id]) => {
        const o = cl(st().jog[id]);
        if (!o) return;
        delete o.tipo;
        st().jog[id] = o;
        ps.push(B().set(gp('jogadores/' + id), clean(o)));
      });
      return Promise.all(ps);
    })
    .catch((e: unknown) => console.warn('migração do caixa', e))
    .finally(() => {
      st().migrando = false;
      changed();
    });
}

/* KAN-63: a marca pública "só entra com vaga aberta" acompanha o tipo do jogador (só diarista, só com o controle ligado).
   Roda quando o elenco, o caixa privado ou o grupo chegam, e grava só quem precisa mudar. */
export function sincronizarVagas() {
  if (
    st().ajVagas ||
    !st().dataOn ||
    !isAdmin() ||
    !st().app ||
    !st().loaded.app ||
    !st().loaded.jog ||
    !st().loaded.pc
  )
    return;
  const aj = marcasParaAjustar(st().jog, ptipo as (id: string) => string, !!(st().app.cfg || {}).vagasCtrl);
  if (!aj.length) return;
  st().ajVagas = true;
  const fim = () => {
    st().ajVagas = false;
  };
  w(GB.lote(aj.map(([id, m]) => ({ tipo: 'patch', p: 'jogadores/' + id, o: { vaga: m } })))).then(fim, fim);
}

/* KAN-271: a marca pública "af" (só as datas dos afastamentos atuais e futuros, sem motivo) para o link mostrar o afastado
   como "Não vou". Precisa da permissão de Elenco (grava no jogador) e do caixa (o ciclo da mensalidade, para as datas);
   roda quando o elenco, os afastamentos ou o caixa chegam, e grava só quem precisa mudar. */
export function sincronizarAfast() {
  const L = st().loaded || {};
  if (st().ajAfast || !st().dataOn || !isAdmin() || !posso('elenco') || !L.jog || !L.af || !L.pc) return;
  /* A conta baixa só aqui (dominio/afast-link.ts), para a gestão abrir leve; quase sempre não há nada a mudar. */
  st().ajAfast = true;
  const fim = () => {
    st().ajAfast = false;
  };
  const apagar = (banco as Obj).op.apagar;
  import('./afast-link')
    .then(m => {
      const aj = m.marcasAfastParaAjustar(st().jog, st().af || {}, (st().pc || {}).ciclo, today());
      if (!aj.length) return;
      return w(
        GB.lote(aj.map(([id, af]) => ({ tipo: 'patch', p: 'jogadores/' + id, o: { af: af.length ? af : apagar() } })))
      );
    })
    .then(fim, fim);
}

import { linkWhatsApp } from '../dominio/contato';
import { isAdmin, posso, rodById } from '../dominio/grupo.js';
import { GB, S as estado, clean, w } from './estado.js';
import { cl, toast } from './util.js';
import { respostaDePresenca, type Presenca } from '../dominio/presenca';
import { tx } from '../i18n/index.js';
import * as banco from './backend.js';
import { changed } from '../ui/render.js';

/* Edições otimistas: a tela muda na hora e a gravação vai depois (KAN-262: em TypeScript desde a pelada-v106). */
type Obj = Record<string, any>;
type Op = { tipo: string; p: string; o?: unknown };
const st = (): Obj => estado as Obj;
const op = (): { apagar: () => unknown; somar: (n: number) => unknown } => (banco as Obj).op;
/* Rodada: grava só os campos que mudaram (D4). Assim, se dois administradores mexem ao mesmo tempo
   em coisas diferentes (um fecha a lista, outro salva uma partida), nada se perde, inclusive sem internet.
   Rodada fixa ainda não gravada (virtual) é criada inteira. */
function editRod(id: string, fn: (r: Obj) => void) {
  const existe = !!st().rod[id];
  const base =
    st().rod[id] ||
    (() => {
      const v = rodById(id);
      if (!v) return {};
      const o = Object.assign({}, v);
      delete o.id;
      delete o.virtual;
      o.createdAt = Date.now();
      return o;
    })();
  const antes = cl(base),
    r = cl(base);
  fn(r);
  st().rod[id] = r;
  changed();
  if (!existe) return w(GB.set('rodadas/' + id, clean(r)));
  const campos: Obj = {};
  new Set(Object.keys(antes).concat(Object.keys(r))).forEach(k => {
    if (!(k in r)) campos[k] = op().apagar();
    else if (JSON.stringify(antes[k]) !== JSON.stringify(r[k])) campos[k] = clean(r[k]);
  });
  return Object.keys(campos).length ? w(GB.patch('rodadas/' + id, campos)) : Promise.resolve();
}
function editLocal(id: string, fn: (r: Obj) => void) {
  const base =
    st().rod[id] ||
    (() => {
      const v = rodById(id) || {};
      const o = Object.assign({}, v);
      delete o.id;
      delete o.virtual;
      o.createdAt = Date.now();
      return o;
    })();
  const r = cl(base);
  fn(r);
  st().rod[id] = r;
  changed();
}
function editApp(fn: (a: Obj & { cfg: Obj }) => void) {
  const a = cl(st().app) || { name: 'Pelada', cfg: {} };
  a.cfg = a.cfg || {};
  fn(a);
  st().app = a;
  changed();
  return w(GB.set('config/app', clean(a)));
}
function saveContato(id: string, tel: string, email: string) {
  if (!posso('elenco')) return;
  const c = cl(st().cont) || {},
    o = c[id] || {};
  if ((o.tel || '') === (tel || '') && (o.email || '') === (email || '')) return;
  if (tel || email) c[id] = { tel: tel || '', email: email || '' };
  else delete c[id];
  st().cont = c;
  return w(GB.set('privado/contatos', clean(c)));
}
/* KAN-156: aceita número internacional (+código do país); os antigos sem "+" continuam brasileiros. */
const waUrl = linkWhatsApp;
/* Notas e pares separados só com a permissão de notas; contatos só com a de elenco (KAN-201). */
function editRat(fn: (a: Obj) => void) {
  if (!posso('notas')) return Promise.resolve();
  const a = cl(st().rat) || {};
  a.stars = a.stars || {};
  a.nivel = a.nivel || {};
  a.sep = a.sep || [];
  fn(a);
  st().rat = a;
  changed();
  return w(GB.set('privado/ratings', clean(a)));
}
/* Presença: a regra do que grava está em dominio/presenca.ts (KAN-262). Aqui fica a tela otimista e o lote. */
function setPres(rid: string, pid: string, data: Partial<Presenca> & { s: string }) {
  const cur: Presenca | null = st().presRid === rid ? st().pres[pid] : null;
  const g = respostaDePresenca(data, {
    atual: cur,
    eu: st().user ? st().user.uid : '',
    admin: isAdmin(),
    jogador: (st().jog || {})[pid],
    vagasCtrl: !!((st().app || {}).cfg || {}).vagasCtrl,
    vagasOcupadas: (st().limVg || {}).n || 0,
    agora: Date.now(),
  });
  const d = g.pres;
  if (st().presRid === rid) {
    st().pres[pid] = d;
    changed();
  }
  const caminho = 'rodadas/' + rid + '/presencas/' + pid;
  if (!g.avulsoNovo && !g.vaga) return w(GB.set(caminho, clean(d)));
  /* Avulso novo ou vaga pelo link (KAN-89, KAN-63): grava junto com o contador; passou do limite, o Firebase recusa tudo. */
  const ops: Op[] = [{ tipo: 'set', p: caminho, o: clean(d) }];
  if (g.avulsoNovo)
    ops.push({ tipo: 'patch', p: 'rodadas/' + rid + '/limites/avulsos', o: { n: op().somar(1), ult: pid } });
  if (g.vaga)
    ops.push({ tipo: 'patch', p: 'rodadas/' + rid + '/limites/vagas', o: { n: op().somar(g.vaga), ult: pid } });
  return GB.lote(ops).catch((e: { code?: string }) => {
    console.error(e);
    if (st().presRid === rid) {
      if (cur) st().pres[pid] = cur;
      else delete st().pres[pid];
      changed();
    }
    toast(
      e && e.code === 'permission-denied'
        ? tx(g.vaga > 0 ? 'vagaslink.fechadas' : 'limite.avulsosPublico')
        : tx('erro.salvar')
    );
    throw e;
  });
}
/* Resposta mudada por um aparelho diferente do que respondeu primeiro (e que não é de administrador). */
function presAlterada(id: string) {
  const p = st().pres[id];
  return !!(p && p.dev && p.by && p.by !== p.dev && !(st().membros || {})[p.by]);
}

export { editApp, editRat, editRod, presAlterada, saveContato, setPres, waUrl };

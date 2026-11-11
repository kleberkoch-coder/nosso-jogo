/* Ações: Link público (jogador sem conta): presença e voto. Fazem parte de ACT (src/acoes.js).
   TypeScript desde a pelada-v106 (KAN-262). */
import { isAvulso, normName, players, pname, rodById } from '../dominio/grupo.js';
import { tx } from '../i18n/index.js';
import { semConexao } from '../eventos.js';
import * as banco from '../nucleo/backend.js';
import { avulsosEsgotados } from '../dominio/limites';
import { precisaVaga, situacao } from '../dominio/vagas';
import { proximoVoto } from '../dominio/votacao';
import { setPres } from '../nucleo/edicoes';
import { GB, S as estado, w } from '../nucleo/estado.js';
import { $, toast } from '../nucleo/util.js';
import { MEK, myLocal } from '../telas/publico-rodada';
import { closeDlg, dlg, val } from '../ui/dialogos.js';
import { changed } from '../ui/render.js';
import { ACT } from '../acoes.js';

type Obj = Record<string, any>;
type El = { dataset: Record<string, string | undefined> };
const st = (): Obj => estado as Obj;
const B = (): Obj => (banco as Obj).B;
const op = (): { agora: () => unknown } => (banco as Obj).op;

/* KAN-63: sem vaga aberta, quem precisa de vaga não entra; o aviso diz por quê (o Firebase também recusa). */
function semVaga(id: string) {
  const r = rodById(st().route.id),
    v = situacao(!!((st().app || {}).cfg || {}).vagasCtrl, r && r.vagas, st().limVg);
  if (v.podeEntrar || !precisaVaga((st().jog || {})[id]) || (st().pres[id] && st().pres[id].s === 'in')) return false;
  closeDlg();
  toast(tx(v.cheia ? 'vagaslink.esgotadas' : 'vagaslink.fechadas'));
  return true;
}
const acoes: Record<string, (el: El) => unknown> = {
  /* KAN-184: "Tentar de novo" quando o link não carregou. */
  recarregar: () => location.reload(),
  /* público */
  pubMark: el => {
    const r = rodById(st().route.id);
    if (!r || r.locked) return;
    const id = el.dataset.p as string,
      cur = st().pres[id] || {};
    if (!st().user) {
      semConexao();
      return;
    }
    if (el.dataset.v === 'in' && semVaga(id)) return;
    try {
      localStorage.setItem(MEK, id);
    } catch (e) {}
    setPres(
      st().route.id,
      id,
      Object.assign(isAvulso(id) ? { nome: cur.nome, avulso: true, pos: cur.pos } : {}, { s: el.dataset.v as string })
    )
      .then(() => {
        changed();
        toast(tx(el.dataset.v === 'in' ? 'publico.confirmado' : 'publico.okNaoVai', { nome: pname(id) }));
      })
      .catch(() => {});
  },
  /* KAN-127: o que o jogador digitou na busca já vem no nome. */
  /* KAN-262: a janela baixa sob demanda; devolver a promessa faz o botão girar até ela abrir. */
  pubAdd: el =>
    import('../ui/JanelasLink').then(m => {
      m.janelaMeuNome((el && el.dataset.v) || '');
      if (el && el.dataset.v) $('#anm')?.dispatchEvent(new Event('input', { bubbles: true }));
    }, semConexao),
  pubPick: el => {
    const id = el.dataset.p as string,
      a = st().avul[id];
    if (!st().user) {
      semConexao();
      return;
    }
    if (semVaga(id)) return;
    if (!st().pres[id] && avulsosEsgotados(st().limAv, st().limCfg)) {
      closeDlg();
      toast(tx('limite.avulsosPublico'));
      return;
    }
    closeDlg();
    try {
      localStorage.setItem(MEK, id);
    } catch (e) {}
    return setPres(st().route.id, id, { s: 'in', nome: a.nome, avulso: true, pos: a.pos || '' })
      .then(() => {
        changed();
        toast(tx('publico.confirmado', { nome: a.nome }));
      })
      .catch(() => {});
  },
  pubSaveAdd: () => {
    const n = val('anm');
    if (n.length < 2) {
      toast(tx('publico.digiteNome'));
      return;
    }
    if (!st().user) {
      semConexao();
      return;
    }
    const el = players().find(p => normName(p.name) === normName(n));
    if (el) {
      closeDlg();
      toast(tx('publico.jaNaLista', { nome: el.name }));
      return;
    }
    const same = Object.entries((st().avul || {}) as Record<string, { nome: string }>).find(
      ([, a]) => normName(a.nome) === normName(n)
    );
    if (same) return (ACT as Record<string, (el: El) => unknown>).pubPick({ dataset: { p: same[0] } });
    if (semVaga('')) return;
    if (avulsosEsgotados(st().limAv, st().limCfg)) {
      closeDlg();
      toast(tx('limite.avulsosPublico'));
      return;
    }
    const id: string = B().newId(),
      pos = val('apos');
    closeDlg();
    try {
      localStorage.setItem(MEK, id);
    } catch (e) {}
    return setPres(st().route.id, id, { s: 'in', nome: n, avulso: true, pos })
      .then(() => {
        changed();
        toast(tx('publico.confirmado', { nome: n }));
      })
      .catch(() => {});
  },
  pubVote: el => {
    const me = st().myVote?.pid || myLocal();
    if (!me || !st().user) return;
    const c = el.dataset.c2 as string,
      p = el.dataset.p as string;
    /* KAN-223: tocar de novo no nome já escolhido (ou dois toques rápidos) não grava nada.
       KAN-224: cada troca ganha o id {aparelho}_{contador}; o Firebase recusa a 51ª. */
    const prox = proximoVoto(st().myVote, me, c, p, Date.now());
    if (!prox) return;
    const d = prox.voto;
    st().myVote = d;
    changed();
    /* KAN-222: junto com o voto, no mesmo lote, o registro da troca com a hora do servidor (auditoria). */
    const vid = st().route.id,
      uid = st().user.uid;
    const l: { tipo: string; p: string; o: unknown }[] = [
      { tipo: 'set', p: 'votacoes/' + vid + '/votos/' + uid, o: d },
    ];
    if (prox.troca)
      l.push({
        tipo: 'patch',
        p: 'votacoes/' + vid + '/trocas/' + uid + '_' + prox.troca,
        o: { u: uid, pid: me, c, p, em: op().agora() },
      });
    w(GB.lote(l));
  },
};

export { acoes };

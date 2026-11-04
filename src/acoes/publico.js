/* Ações: Link público (jogador sem conta): presença e voto. Fazem parte de ACT (src/acoes.js). */
import { isAvulso, normName, players, pname, rodById } from '../dominio/grupo.js';
import { tx } from '../i18n/index.js';
import { semConexao } from '../eventos.js';
import { B, op } from '../nucleo/backend.js';
import { avulsosEsgotados, limite } from '../dominio/limites.ts';
import { precisaVaga, situacao } from '../dominio/vagas.ts';
import { proximoVoto } from '../dominio/votacao.ts';
import { setPres } from '../nucleo/edicoes.js';
import { GB, S, w } from '../nucleo/estado.js';
import { $, toast } from '../nucleo/util.js';
import { MEK, myLocal } from '../telas/publico-rodada.js';
import { closeDlg, dlg, val } from '../ui/dialogos.js';
import { janelaMeuNome } from '../ui/JanelasLink';
import { changed } from '../ui/render.js';
import { ACT } from '../acoes.js';

/* KAN-63: sem vaga aberta, quem precisa de vaga não entra; o aviso diz por quê (o Firebase também recusa). */
function semVaga(id) {
  const r = rodById(S.route.id),
    v = situacao(!!((S.app || {}).cfg || {}).vagasCtrl, r && r.vagas, S.limVg);
  if (v.podeEntrar || !precisaVaga((S.jog || {})[id]) || (S.pres[id] && S.pres[id].s === 'in')) return false;
  closeDlg();
  toast(tx(v.cheia ? 'vagaslink.esgotadas' : 'vagaslink.fechadas'));
  return true;
}
const acoes = {
  /* KAN-184: "Tentar de novo" quando o link não carregou. */
  recarregar: () => location.reload(),
  /* público */
  pubMark: el => {
    const r = rodById(S.route.id);
    if (!r || r.locked) return;
    const id = el.dataset.p,
      cur = S.pres[id] || {};
    if (!S.user) {
      semConexao();
      return;
    }
    if (el.dataset.v === 'in' && semVaga(id)) return;
    try {
      localStorage.setItem(MEK, id);
    } catch (e) {}
    setPres(
      S.route.id,
      id,
      Object.assign(isAvulso(id) ? { nome: cur.nome, avulso: true, pos: cur.pos } : {}, { s: el.dataset.v })
    )
      .then(() => {
        changed();
        toast(tx(el.dataset.v === 'in' ? 'publico.confirmado' : 'publico.okNaoVai', { nome: pname(id) }));
      })
      .catch(() => {});
  },
  /* KAN-127: o que o jogador digitou na busca já vem no nome. */
  pubAdd: el => {
    janelaMeuNome((el && el.dataset.v) || '');
    if (el && el.dataset.v) $('#anm')?.dispatchEvent(new Event('input', { bubbles: true }));
  },
  pubPick: el => {
    const id = el.dataset.p,
      a = S.avul[id];
    if (!S.user) {
      semConexao();
      return;
    }
    if (semVaga(id)) return;
    if (!S.pres[id] && avulsosEsgotados(S.limAv, S.limCfg)) {
      closeDlg();
      toast(tx('limite.avulsosPublico'));
      return;
    }
    closeDlg();
    try {
      localStorage.setItem(MEK, id);
    } catch (e) {}
    return setPres(S.route.id, id, { s: 'in', nome: a.nome, avulso: true, pos: a.pos || '' })
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
    if (!S.user) {
      semConexao();
      return;
    }
    const el = players().find(p => normName(p.name) === normName(n));
    if (el) {
      closeDlg();
      toast(tx('publico.jaNaLista', { nome: el.name }));
      return;
    }
    const same = Object.entries(S.avul || {}).find(([, a]) => normName(a.nome) === normName(n));
    if (same) return ACT.pubPick({ dataset: { p: same[0] } });
    if (semVaga('')) return;
    if (avulsosEsgotados(S.limAv, S.limCfg)) {
      closeDlg();
      toast(tx('limite.avulsosPublico'));
      return;
    }
    const id = B.newId(),
      pos = val('apos');
    closeDlg();
    try {
      localStorage.setItem(MEK, id);
    } catch (e) {}
    return setPres(S.route.id, id, { s: 'in', nome: n, avulso: true, pos })
      .then(() => {
        changed();
        toast(tx('publico.confirmado', { nome: n }));
      })
      .catch(() => {});
  },
  pubVote: el => {
    const me = S.myVote?.pid || myLocal();
    if (!me || !S.user) return;
    const c = el.dataset.c2,
      p = el.dataset.p;
    /* KAN-223: tocar de novo no nome já escolhido (ou dois toques rápidos) não grava nada.
       KAN-224: cada troca ganha o id {aparelho}_{contador}; o Firebase recusa a 51ª. */
    const prox = proximoVoto(S.myVote, me, c, p, Date.now());
    if (!prox) return;
    const d = prox.voto;
    S.myVote = d;
    changed();
    /* KAN-222: junto com o voto, no mesmo lote, o registro da troca com a hora do servidor (auditoria). */
    const vid = S.route.id,
      uid = S.user.uid;
    const l = [{ tipo: 'set', p: 'votacoes/' + vid + '/votos/' + uid, o: d }];
    if (prox.troca)
      l.push({
        tipo: 'patch',
        p: 'votacoes/' + vid + '/trocas/' + uid + '_' + prox.troca,
        o: { u: uid, pid: me, c, p, em: op.agora() },
      });
    w(GB.lote(l));
  },
};

export { acoes };
